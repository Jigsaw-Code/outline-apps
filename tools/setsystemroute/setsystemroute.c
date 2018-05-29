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

// TODO: Make import order irrelevant!
// clang-format off
#include <winsock2.h>
#include <ws2tcpip.h>
#include <iphlpapi.h>
#include <netioapi.h>
#include <stdio.h>
// clang-format on

#define MALLOC(x) HeapAlloc(GetProcessHeap(), 0, (x))
#define FREE(x) HeapFree(GetProcessHeap(), 0, (x))

void usage(const char* path) {
  printf("usage: on <tun2socks> <proxy>|off <tun2socks> <proxy> <previous gateway>\n");
  exit(1);
}

// Although it's not usually necessary to specify the interface index
// when using the route command, weird things happen with the system calls
// if you do not.
DWORD getBestInterfaceIndexForIp(DWORD ip) {
  DWORD interfaceIndex;
  DWORD status = GetBestInterface(ip, &interfaceIndex);
  if (status != NO_ERROR) {
    printf("could not figure interfaceIndex interface for IP: %lu\n", status);
    exit(1);
  }
  return interfaceIndex;
}

DWORD getInterfaceMetric(DWORD interfaceIndex) {
  MIB_IPINTERFACE_ROW interfaceRow = {0};
  interfaceRow.Family = AF_INET;
  interfaceRow.InterfaceIndex = interfaceIndex;
  DWORD status = GetIpInterfaceEntry(&interfaceRow);
  if (status != NO_ERROR) {
    printf("could not call GetIpInterfaceEntry: %lu\n", status);
    exit(1);
  }
  return interfaceRow.Metric;
}

PMIB_IPFORWARDROW createIpForwardRow() {
  PMIB_IPFORWARDROW route = (PMIB_IPFORWARDROW)malloc(sizeof(MIB_IPFORWARDROW));
  if (!route) {
    printf("could not allocate memory for new route\n");
    exit(1);
  }

  // https://msdn.microsoft.com/en-us/library/windows/desktop/aa366850(v=vs.85).aspx
  route->dwForwardDest = 0;
  route->dwForwardMask = 0xFFFFFFFF;  // 255.255.255.255
  route->dwForwardPolicy = 0;
  route->dwForwardNextHop = 0;
  route->dwForwardIfIndex = 0;
  route->dwForwardType = 4;
  route->dwForwardProto = 3;
  route->dwForwardAge = 0;
  route->dwForwardNextHopAS = 0;
  route->dwForwardMetric1 = 0;
  route->dwForwardMetric2 = 0;
  route->dwForwardMetric3 = 0;
  route->dwForwardMetric4 = 0;
  route->dwForwardMetric5 = 0;

  return route;
}

void createRoute(PMIB_IPFORWARDROW route) {
  DWORD status = CreateIpForwardEntry(route);
  if (status != ERROR_SUCCESS) {
    printf("could not create route: %lu\n", status);
    exit(1);
  }
}

void deleteRoute(PMIB_IPFORWARDROW route) {
  DWORD status = DeleteIpForwardEntry(route);
  if (status != ERROR_SUCCESS) {
    printf("could not delete route: %lu\n", status);
    exit(1);
  }
}

// TODO: handle host names
int main(int argc, char* argv[]) {
  if (argc < 2) {
    usage(argv[0]);
  }

  int connecting = strcmp(argv[1], "on") == 0;

  if (argc != (connecting ? 4 : 5)) {
    usage(argv[0]);
  }

  DWORD tun2socksGatewayIp = INADDR_NONE;
  tun2socksGatewayIp = inet_addr(argv[2]);
  if (tun2socksGatewayIp == INADDR_NONE) {
    printf("could not parse tun2socks virtual router IP\n");
    return 1;
  }

  DWORD proxyServerIp = INADDR_NONE;
  proxyServerIp = inet_addr(argv[3]);
  if (proxyServerIp == INADDR_NONE) {
    printf("could not parse proxy server IP\n");
    return 1;
  }

  DWORD systemGatewayIp = INADDR_NONE;
  if (!connecting) {
    systemGatewayIp = inet_addr(argv[4]);
    if (systemGatewayIp == INADDR_NONE) {
      printf("could not parse system gateway IP\n");
      return 1;
    }
  }

  // Fetch the system's routing table.
  PMIB_IPFORWARDTABLE routingTable = (MIB_IPFORWARDTABLE*)MALLOC(sizeof(MIB_IPFORWARDTABLE));
  if (routingTable == NULL) {
    printf("could not allocate memory for routing table\n");
    return 1;
  }

  DWORD dwSize = 0;
  if (GetIpForwardTable(routingTable, &dwSize, 0) == ERROR_INSUFFICIENT_BUFFER) {
    FREE(routingTable);
    routingTable = (MIB_IPFORWARDTABLE*)MALLOC(dwSize);
    if (routingTable == NULL) {
      printf("Error allocating memory\n");
      return 1;
    }
  }

  if (GetIpForwardTable(routingTable, &dwSize, 0) != NO_ERROR) {
    printf("could not query routing table\n");
    FREE(routingTable);
    return 1;
  }

  // Process the routing table, picking out any routes of interest that
  // may have lingered around (due to crashes, etc.) and aborting if
  // we find an unsupported configuration (currently: multiple default gateways).

  PMIB_IPFORWARDROW systemGatewayRoute = NULL;
  PMIB_IPFORWARDROW tun2socksGatewayRoute = NULL;
  PMIB_IPFORWARDROW proxyServerRoute = NULL;

  for (int i = 0; i < routingTable->dwNumEntries; i++) {
    PMIB_IPFORWARDROW route = &(routingTable->table[i]);

    if (route->dwForwardDest == 0) {
      // Gateway.
      if (route->dwForwardNextHop == tun2socksGatewayIp) {
        tun2socksGatewayRoute = route;
      } else if (route->dwForwardNextHop == systemGatewayIp) {
        printf("the previous gateway already exists\n");
        systemGatewayRoute = route;
      } else {
        if (systemGatewayRoute) {
          printf("found multiple default gateways, cannot handle\n");
          exit(1);
        }
        systemGatewayRoute = route;
      }
    } else if (route->dwForwardDest == proxyServerIp) {
      if (proxyServerRoute) {
        printf("found multiple routes to proxy server, cannot handle\n");
        exit(1);
      }
      proxyServerRoute = route;
    }
  }

  // Finally, adjust the routing table.
  //
  // If tun2socks crashes, a kind of "shadow" route is left behind
  // which is invisible until tun2socks is *restarted*.
  // Because of this, if we find a gateway via the tun2socks device
  // we leave it alone.

  if (connecting) {
    // Connect to Shadowsocks:
    //  - add a (default, gateway) route to tun2socks virtual router
    //  - print the IP of the previous default gateway
    //  - delete the route to the previous default gateway
    //
    // Ideally, we would *modify* the gateway rather than adding one and deleting
    // the old. That way, we could be almost certain of not leaving the user's
    // computer in an unuseable state. However, that does *not* work - as the
    // documentation for SetIpForwardEntry explicitly states:
    //   https://msdn.microsoft.com/en-us/library/windows/desktop/aa366363(v=vs.85).aspx
    //
    // Instead, we first add the new gateway before deleting the old.
    //
    // And what about just keeping the old one around? There are enough posts and
    // questions on the web around the topic of multiple gateways to suggest
    // this is dangerous thinking: and in Outline's case, the TAP interface seems to
    // always have a higher priority than any existing ethernet device - messing
    // with that is probably not going to end well.

    if (!systemGatewayRoute) {
      printf("found no other gateway, cannot handle\n");
      exit(1);
    }

    if (!tun2socksGatewayRoute) {
      // NOTE: tun2socks *must* have made its own additions to the routing table
      //       before this returns the correct result.
      int tun2socksGatewayInterfaceIndex = getBestInterfaceIndexForIp(tun2socksGatewayIp);

      // Note: Fetching the interface metric is *crucial*, or else you will run
      //       into extremely weird and day-wasting errors. This step is *not*
      //       mentioned in any of the SDK documentation; the most useful page
      //       I could find was this:
      //         http://www.nynaeve.net/?p=74
      DWORD tun2socksGatewayInterfaceMetric = getInterfaceMetric(tun2socksGatewayInterfaceIndex);

      tun2socksGatewayRoute = createIpForwardRow();
      tun2socksGatewayRoute->dwForwardMask = 0;
      tun2socksGatewayRoute->dwForwardNextHop = tun2socksGatewayIp;
      tun2socksGatewayRoute->dwForwardIfIndex = tun2socksGatewayInterfaceIndex;
      tun2socksGatewayRoute->dwForwardMetric1 = tun2socksGatewayInterfaceMetric;

      createRoute(tun2socksGatewayRoute);
      printf("added new gateway\n");
    }

    // Delete the previous gateway and print its IP so that Outline can restore it
    // when the user disconnects.
    systemGatewayIp = systemGatewayRoute->dwForwardNextHop;
    char systemGatewayIpString[128];
    struct in_addr ip;
    ip.S_un.S_addr = (u_long)systemGatewayRoute->dwForwardNextHop;
    strcpy(systemGatewayIpString, inet_ntoa(ip));
    // This *must* be kept in sync with the code in process_manager.ts.
    printf("current gateway: %s\n", systemGatewayIpString);

    deleteRoute(systemGatewayRoute);
    printf("removed old gateway\n");

    int systemGatewayInterfaceIndex = getBestInterfaceIndexForIp(systemGatewayIp);
    DWORD systemGatewayInterfaceMetric = getInterfaceMetric(systemGatewayInterfaceIndex);

    // Add a route to the proxy server.
    if (proxyServerRoute) {
      deleteRoute(proxyServerRoute);
      printf("removed old route to proxy server\n");
    }
    proxyServerRoute = createIpForwardRow();
    proxyServerRoute->dwForwardDest = proxyServerIp;
    proxyServerRoute->dwForwardNextHop = systemGatewayIp;
    proxyServerRoute->dwForwardMetric1 = systemGatewayInterfaceMetric;
    proxyServerRoute->dwForwardIfIndex = systemGatewayInterfaceIndex;
    createRoute(proxyServerRoute);
    printf("added route to proxy server\n");
  } else {
    // Disconnect from Shadowsocks:
    //  - delete the routes to the proxy server and tun2socks virtual router, if found
    //  - add a route to the actual system gateway
    //
    // TODO: When we aren't told the previous gateway, make a guess.
    if (tun2socksGatewayRoute) {
      deleteRoute(tun2socksGatewayRoute);
      printf("removed tun2socks gateway\n");
    }

    if (!systemGatewayRoute) {
      int systemGatewayInterfaceIndex = getBestInterfaceIndexForIp(systemGatewayIp);
      DWORD systemGatewayInterfaceMetric = getInterfaceMetric(systemGatewayInterfaceIndex);

      systemGatewayRoute = createIpForwardRow();
      systemGatewayRoute->dwForwardMask = 0;
      systemGatewayRoute->dwForwardNextHop = systemGatewayIp;
      systemGatewayRoute->dwForwardIfIndex = systemGatewayInterfaceIndex;
      systemGatewayRoute->dwForwardMetric1 = systemGatewayInterfaceMetric;

      createRoute(systemGatewayRoute);
      printf("restored gateway\n");
    }

    if (proxyServerRoute) {
      deleteRoute(proxyServerRoute);
      printf("removed route to proxy server\n");
    }
  }

  exit(0);
}
