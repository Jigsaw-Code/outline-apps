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
#include <rpcdce.h>

#pragma comment(lib, "iphlpapi.lib")
#pragma comment(lib, "fwpuclnt.lib")
#pragma comment(lib, "rpcrt4.lib")

using namespace ::std;

PCWSTR TAP_DEVICE_NAME = L"outline-tap0";
ULONG GET_ADAPTERS_ADDRESSES_BUFFER_SIZE = 16384;

PCWSTR FILTER_PROVIDER_NAME = L"Outline";
PCWSTR SUBLAYER_NAME = L"Smart DNS Block";

UINT64 LOWER_FILTER_WEIGHT = 10;
UINT64 HIGHER_FILTER_WEIGHT = 20;

int main(int argc, char **argv) {
  // Lookup the interface index of outline-tap0.
  PIP_ADAPTER_ADDRESSES adaptersAddresses =
      (IP_ADAPTER_ADDRESSES *)malloc(GET_ADAPTERS_ADDRESSES_BUFFER_SIZE);
  DWORD result = GetAdaptersAddresses(AF_INET, 0, NULL, adaptersAddresses,
                                      &GET_ADAPTERS_ADDRESSES_BUFFER_SIZE);
  if (result != NO_ERROR) {
    wcerr << "could not fetch network device list: " << result << endl;
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
    wcerr << "could not connect to to filtering engine: " << result << endl;
    return 1;
  }
  wcout << "connected to filtering engine" << endl;

  // Create our own sublayer.
  //
  // This is recommended by the API documentation to avoid weird interactions with other
  // applications' filters:
  //   https://docs.microsoft.com/en-us/windows/desktop/fwp/best-practices
  //
  // Notes:
  //  - Without a unique ID our filters will be added to FWPM_SUBLAYER_UNIVERSAL *even if they
  //    reference this new sublayer*.
  //  - Since the documentation doesn't say much about sublayer weights, we specify the highest
  //    possible sublayer weight. This seems to work well.
  FWPM_SUBLAYER0 sublayer;
  memset(&sublayer, 0, sizeof(sublayer));
  UuidCreate(&sublayer.subLayerKey);
  sublayer.displayData.name = (PWSTR)SUBLAYER_NAME;
  sublayer.weight = MAXUINT16;

  result = FwpmSubLayerAdd0(engine, &sublayer, NULL);
  if (result != ERROR_SUCCESS) {
    wcerr << "could not create filtering sublayer: " << result << endl;
    return 1;
  }
  wcout << "created filtering sublayer" << endl;

  // Create our filters:
  //  - The first blocks all UDP traffic bound for port 53.
  //  - The second whitelists all traffic on the TAP device.
  //
  // Crucially, the second has a higher weight.
  //
  // Note:
  //  - Since OutlineService adds a blanket block on all IPv6 traffic, we only need to create IPv4
  //    filters.
  //  - Thanks to the simplicity of the filters and how they will be automatically destroyed on
  //    exit, there's no need to use a transaction here.

  // Blanket UDP port 53 block.
  FWPM_FILTER_CONDITION0 udpBlockConditions[2];
  udpBlockConditions[0].fieldKey = FWPM_CONDITION_IP_PROTOCOL;
  udpBlockConditions[0].matchType = FWP_MATCH_EQUAL;
  udpBlockConditions[0].conditionValue.type = FWP_UINT8;
  udpBlockConditions[0].conditionValue.uint16 = IPPROTO_UDP;
  udpBlockConditions[1].fieldKey = FWPM_CONDITION_IP_REMOTE_PORT;
  udpBlockConditions[1].matchType = FWP_MATCH_EQUAL;
  udpBlockConditions[1].conditionValue.type = FWP_UINT16;
  udpBlockConditions[1].conditionValue.uint16 = 53;

  FWPM_FILTER0 udpBlockFilter;
  memset(&udpBlockFilter, 0, sizeof(udpBlockFilter));
  udpBlockFilter.filterCondition = udpBlockConditions;
  udpBlockFilter.numFilterConditions = 2;
  udpBlockFilter.displayData.name = (PWSTR)FILTER_PROVIDER_NAME;
  udpBlockFilter.subLayerKey = sublayer.subLayerKey;
  udpBlockFilter.layerKey = FWPM_LAYER_ALE_AUTH_CONNECT_V4;
  udpBlockFilter.action.type = FWP_ACTION_BLOCK;
  udpBlockFilter.weight.type = FWP_UINT64;
  udpBlockFilter.weight.uint64 = &LOWER_FILTER_WEIGHT;
  UINT64 filterId;
  result = FwpmFilterAdd0(engine, &udpBlockFilter, NULL, &filterId);
  if (result != ERROR_SUCCESS) {
    wcerr << "could not block port 53: " << result << endl;
    return 1;
  }
  wcout << "port 53 blocked with filter " << filterId << endl;

  // Whitelist all traffic on the TAP device.
  FWPM_FILTER_CONDITION0 tapDeviceWhitelistCondition[1];
  tapDeviceWhitelistCondition[0].fieldKey = FWPM_CONDITION_LOCAL_INTERFACE_INDEX;
  tapDeviceWhitelistCondition[0].matchType = FWP_MATCH_EQUAL;
  tapDeviceWhitelistCondition[0].conditionValue.type = FWP_UINT32;
  tapDeviceWhitelistCondition[0].conditionValue.uint32 = interfaceIndex;

  FWPM_FILTER0 tapDeviceWhitelistFilter;
  memset(&tapDeviceWhitelistFilter, 0, sizeof(tapDeviceWhitelistFilter));
  tapDeviceWhitelistFilter.filterCondition = tapDeviceWhitelistCondition;
  tapDeviceWhitelistFilter.numFilterConditions = 1;
  tapDeviceWhitelistFilter.displayData.name = (PWSTR)FILTER_PROVIDER_NAME;
  tapDeviceWhitelistFilter.subLayerKey = sublayer.subLayerKey;
  tapDeviceWhitelistFilter.layerKey = FWPM_LAYER_ALE_AUTH_CONNECT_V4;
  tapDeviceWhitelistFilter.action.type = FWP_ACTION_PERMIT;
  tapDeviceWhitelistFilter.weight.type = FWP_UINT64;
  tapDeviceWhitelistFilter.weight.uint64 = &HIGHER_FILTER_WEIGHT;

  result = FwpmFilterAdd0(engine, &tapDeviceWhitelistFilter, NULL, &filterId);
  if (result != ERROR_SUCCESS) {
    wcerr << "could not whitelist traffic on " << TAP_DEVICE_NAME << ": " << result << endl;
    return 1;
  }
  wcout << "whitelisted traffic on " << TAP_DEVICE_NAME << " with filter " << filterId << endl;

  // Wait forever.
  system("pause");
}
