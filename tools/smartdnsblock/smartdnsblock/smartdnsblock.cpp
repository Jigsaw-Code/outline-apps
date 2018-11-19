// Copyright 2018 The Outline Authors
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

// If this doesn't come first, there will be compile errors.
#include <winsock2.h>

#include <iostream>

#include <iphlpapi.h>

#include <fwpmtypes.h>
#include <fwpmu.h>

#pragma comment(lib, "iphlpapi.lib")
#pragma comment(lib, "fwpuclnt.lib")

using namespace ::std;

PCWSTR TAP_DEVICE_NAME = L"outline-tap0";
ULONG GET_ADAPTERS_ADDRESSES_BUFFER_SIZE = 16384;

PCWSTR FILTER_PROVIDER_NAME = L"Outline";

int main(int argc, char **argv) {
  // Lookup the interface index of outline-tap0.
  PIP_ADAPTER_ADDRESSES adaptersAddresses =
      (IP_ADAPTER_ADDRESSES *)malloc(GET_ADAPTERS_ADDRESSES_BUFFER_SIZE);
  DWORD result = GetAdaptersAddresses(AF_INET, 0, NULL, adaptersAddresses,
                                      &GET_ADAPTERS_ADDRESSES_BUFFER_SIZE);
  if (result != NO_ERROR) {
    cerr << "could not fetch network device list: " << result << endl;
    return 1;
  }

  UINT32 interfaceIndex;
  PIP_ADAPTER_ADDRESSES adapterAddress = adaptersAddresses;
  while (adapterAddress && wcscmp(TAP_DEVICE_NAME, adapterAddress->FriendlyName) != 0) {
    adapterAddress = adapterAddress->Next;
  }

  if (!adapterAddress) {
    wcerr << "could not find " << TAP_DEVICE_NAME << endl;
    return 1;
  }

  interfaceIndex = adapterAddress->IfIndex;
  wcout << "found " << TAP_DEVICE_NAME << " at index " << interfaceIndex << endl;

  // Connect to the filtering engine. By using a dynamic session, all of our changes are
  // *non-destructive* and will vanish on exit/crash/whatever.
  FWPM_SESSION0 session;
  memset(&session, 0, sizeof(session));
  session.flags = FWPM_SESSION_FLAG_DYNAMIC;

  HANDLE engine = 0;
  result = FwpmEngineOpen0(NULL, RPC_C_AUTHN_DEFAULT, NULL, &session, &engine);
  if (result != ERROR_SUCCESS) {
    cerr << "could not connect to to filtering engine: " << result << endl;
    return 1;
  }
  cout << "connected to filtering engine" << endl;

  // Create our filters.
  //
  // We create two filters, each with multiple conditions:
  //  - The first filter blocks all UDP traffic on port 53.
  //  - The second "extends" the first filter to allow such traffic *on the TAP device*.
  //
  // This approach of "layering" conditions is the same as that used in the SDK documentation:
  //   https://docs.microsoft.com/en-us/windows/desktop/fwp/reserving-ports
  //
  // Note:
  //  - Since OutlineService adds a blanket block on all IPv6 traffic, we only need to create IPv4
  //    filters.
  //  - Thanks to the simplicity of the filters and how they will be automatically destroyed on
  //    exit, there's no need to use a transaction here.
  FWPM_FILTER_CONDITION0 conditions[3];

  conditions[0].fieldKey = FWPM_CONDITION_IP_PROTOCOL;
  conditions[0].matchType = FWP_MATCH_EQUAL;
  conditions[0].conditionValue.type = FWP_UINT8;
  conditions[0].conditionValue.uint16 = IPPROTO_UDP;

  conditions[1].fieldKey = FWPM_CONDITION_IP_REMOTE_PORT;
  conditions[1].matchType = FWP_MATCH_EQUAL;
  conditions[1].conditionValue.type = FWP_UINT16;
  conditions[1].conditionValue.uint16 = 53;

  conditions[2].fieldKey = FWPM_CONDITION_LOCAL_INTERFACE_INDEX;
  conditions[2].matchType = FWP_MATCH_EQUAL;
  conditions[2].conditionValue.type = FWP_UINT32;
  conditions[2].conditionValue.uint32 = interfaceIndex;

  FWPM_FILTER0 filter;
  memset(&filter, 0, sizeof(filter));
  filter.displayData.name = (PWSTR)FILTER_PROVIDER_NAME;
  filter.filterCondition = conditions;
  filter.layerKey = FWPM_LAYER_ALE_AUTH_CONNECT_V4;

  UINT64 filterId;

  // Blanket UDP port 53 block.
  filter.numFilterConditions = 2;
  filter.action.type = FWP_ACTION_BLOCK;
  result = FwpmFilterAdd0(engine, &filter, NULL, &filterId);
  if (result != ERROR_SUCCESS) {
    cerr << "could not block port 53: " << result << endl;
    return 1;
  }
  cout << "port 53 blocked with filter " << filterId << endl;

  // Whitelist UDP port 53 on the TAP device.
  filter.numFilterConditions = 3;
  filter.action.type = FWP_ACTION_PERMIT;
  result = FwpmFilterAdd0(engine, &filter, NULL, &filterId);
  if (result != ERROR_SUCCESS) {
    wcerr << "could not whitelist port 53 on " << TAP_DEVICE_NAME << ": " << result << endl;
    return 1;
  }
  wcout << "port 53 whitelisted on " << TAP_DEVICE_NAME << " with filter " << filterId << endl;

  // Wait forever.
  system("pause");
}
