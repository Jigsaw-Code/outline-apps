// Copyright 2019 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
  "encoding/binary"
  "flag"
  "fmt"
  "io/ioutil"
  "log"
  "sort"
  "strings"

  "golang.org/x/sys/windows/registry"
)

const (
  // netAdaptersKeyPath is the registry location of the system's network adapters.
  netAdaptersKeyPath = `SYSTEM\CurrentControlSet\Control\Class\{4D36E972-E325-11CE-BFC1-08002BE10318}`
  // netConfigKeyPath is the registry location of the network adapters network configuration.
  netConfigKeyPath = `SYSTEM\CurrentControlSet\Control\Network\{4D36E972-E325-11CE-BFC1-08002BE10318}`
)

type networkAdapter struct {
  name string
  installTimestamp uint64
}

// getAdapterNameAndInstallTimestamp returns the name and install timestamp of a network adapter with
// registry location `adapterKeyPath`. Returns a non-nil error on failure, or if the adapter's
// hardware component ID does not match `componentID`.
func getAdapterNameAndInstallTimestamp(adapterKeyPath, componentID string) (name string, installTimestamp uint64, err error) {
  adapterKey, err := registry.OpenKey(registry.LOCAL_MACHINE, adapterKeyPath, registry.READ)
  if err != nil {
    log.Println("Failed to open adapter key:", err)
    return
  }
  defer adapterKey.Close()

  adapterComponentID, _, err := adapterKey.GetStringValue("ComponentId")
  if err != nil {
    log.Println("Failed to read adapter component ID:", err)
    return
  }
  if adapterComponentID != componentID {
    err = fmt.Errorf("Network adapter component ID does not match %v", componentID)
    return
  }

  installTimestampBytes, _, err := adapterKey.GetBinaryValue("InstallTimeStamp")
  if err != nil {
    log.Println("Failed to read adapter install timestamp:", err)
    return
  }
  // Although Windows is little endian, we have observed that network adapters' install timestamps
  // are encoded as big endian in the registry.
  installTimestamp = binary.BigEndian.Uint64(installTimestampBytes)

  netConfigID, _, err := adapterKey.GetStringValue("NetCfgInstanceId")
  if err != nil {
    log.Println("Failed to read network configuration ID:", err)
    return
  }
  adapterConfigKeyPath := fmt.Sprintf(`%s\%s\Connection`, netConfigKeyPath, netConfigID)
  adapterConfigKey, err := registry.OpenKey(registry.LOCAL_MACHINE, adapterConfigKeyPath, registry.READ)
  if err != nil {
    log.Println("Failed to open network configuration key:", err)
    return
  }
  defer adapterConfigKey.Close()

  name, _, err = adapterConfigKey.GetStringValue("Name")
  if err != nil {
    log.Println("Failed to read adapter name:", err)
    return
  }
  return
}

// findNetworkAdapters searches the Windows registry for network adapters with `componentID`.
// Returns an empty slice and an error if no network adapters are found.
func findNetworkAdapters(componentID string, ignoredNames map[string]bool) ([]networkAdapter, error) {
  netAdapters := make([]networkAdapter, 0)
  netAdaptersKey, err := registry.OpenKey(registry.LOCAL_MACHINE, netAdaptersKeyPath, registry.READ)
  if err != nil {
    return netAdapters, fmt.Errorf("Failed to open the network adapter registry, %w", err)
  }
  defer netAdaptersKey.Close()

  // List all network adapters.
  adapterKeys, err := netAdaptersKey.ReadSubKeyNames(-1)
  if err != nil {
    return netAdapters, err
  }

  for _, k := range adapterKeys {
    adapterKeyPath := fmt.Sprintf(`%s\%s`, netAdaptersKeyPath, k)
    adapterName, adapterInstallTimestamp, err := getAdapterNameAndInstallTimestamp(adapterKeyPath, componentID)
    if err != nil {
      continue
    }
    if ignoredNames[adapterName] {
      continue
    }
    netAdapters = append(netAdapters, networkAdapter{name: adapterName, installTimestamp: adapterInstallTimestamp})
  }

  if len(netAdapters) == 0 {
    err = fmt.Errorf("Could not find network adapters with the specified component ID")
  }
  return netAdapters, err
}

// readIgnoredNetworkAdapterNames reads a comma-separated list of network interface names at
// `filename` and returns a map keyed by name.
func readIgnoredNetworkAdapterNames(filename string) map[string]bool {
  ignoredNames := make(map[string]bool)
  if filename == "" {
    return ignoredNames
  }

  names, err := ioutil.ReadFile(filename)
  if err != nil {
    log.Println("Failed to read ignored network adapters file:", err)
    return ignoredNames
  }

  for _, name := range strings.Split(string(names), ",") {
    if len(name) == 0 {
      continue;
    }
    ignoredNames[name] = true
  }
  return ignoredNames
}

func main() {
  componentID := flag.String("component-id", "tap0901", "Hardware component ID of the network adapter")
  ignoredNamesPath := flag.String("ignored-names", "", "Path to a comma-separated list of network adapter names to exclude from the search")
  flag.Parse()

  // Remove timestamps, output to stderr by default.
  log.SetFlags(0)

  ignoredNames := readIgnoredNetworkAdapterNames(*ignoredNamesPath)
  log.Println("Ignoring:", ignoredNames)

  netAdapters, err := findNetworkAdapters(*componentID, ignoredNames)
  if err != nil {
    log.Fatalf(err.Error())
  }
  // Sort the network adapters by most recent install timestamp.
  sort.Slice(netAdapters, func(i, j int) bool {
    return netAdapters[i].installTimestamp > netAdapters[j].installTimestamp
  })
  log.Println("Network adapters", netAdapters)

  // Output the most recently installed adapter name to stdout.
  fmt.Print(netAdapters[0].name)
}
