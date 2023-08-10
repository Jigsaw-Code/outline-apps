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

#pragma once

#include <sstream>
#include <string>
#include <utility>
#include <vector>

#include <cstdlib>

namespace outline {

typedef std::pair<std::string, uint8_t> OutputAndStatus;
typedef std::vector<std::string> CommandArguments;

class OutlineProxyController {
public:
  OutlineProxyController();

  /**
   * the destructor:
   *     - restore routing table
   *      - stops tun2sock
   *      - delete the tun device
   *
   */
  ~OutlineProxyController() noexcept;

  /**
   *  set the routing table so user traffic get routed though outline
   */
  void routeThroughOutline(std::string outlineServerIP);

  /**
   *
   * set up the routing table in a way that it route directly through defualt gateway
   *
   */
  void routeDirectly();

  /**
   *
   * Returns the name of the tun device to be used by the app
   *
   */
  std::string getTunDeviceName();

public:
  /**
   * @brief Loop through the current routing table and determine whether
   *        we need to reconfigure it (for example, when someone else has
   *        modified the routing table; or wifi disconnected).
   */
  bool IsOutlineRoutingPolluted() noexcept;

  /**
   * @brief Try to disconnect and connect again, and returns whether we have
   *        successfully reconnected to the target server.
   */
  bool ReconfigureRouting() noexcept;

private:
  // this enum is representing different stage of outing and "de"routing
  // through outline proxy server. And is used for exmaple in undoing
  // different steps in case the routing process fails
  enum OutlineConnectionStage {
    DNS_BACKED_UP,
    OUTLINE_PRIORITY_SET_UP,
    DEFAULT_GATEWAY_ROUTE_DELETED,
    TRAFFIC_ROUTED_THROUGH_TUN,
    OUTLINE_DNS_SET,
    IPV6_ROUTING_FAILED,
  };

  enum class OutlineConnectionStatus {
    kConfiguringRouting,
    kReconfiguringRouting,
    kRoutingThroughOutline,
    kRoutingThroughDefaultGateway,
  } routing_status_;

  /**
   * auxilary function to check the status code of a command
   */
  inline bool isSuccessful(OutputAndStatus& result) { return (result.second == EXIT_SUCCESS); }

  /**
   * adds outline tun interface in case it is missing.
   * while Windows client creates the TAP device at installation time.
   * Linux Outline service tries to create the tun device at start of
   * each run.
   */
  void addOutlineTunDev();

  /**
   * check if outline tun device exists
   */
  bool outlineTunDeviceExsits();

  void deleteOutlineTunDev();

  void setTunDeviceIP();

  /**
   *  Should be called before changing DNS setting to backup the DNS
   *  setting to restore after.
   */
  void backupDNSSetting();

  /**
   *  Should be called after diconnect to restore original DNS
   *  setting
   */
  void restoreDNSSetting();

  /**
   * set outline DNS setting
   */
  void enforceGloballyReachableDNS();

  /**
   * reset routing setting to original setting in case we fail to
   * accomplish routing through outline in the intermediary stage
   *
   */
  void resetFailRoutingAttempt(OutlineConnectionStage failedStage);

  /**
   * exectues a shell command and returns the stdout
   */
  OutputAndStatus executeCommand(const std::string commandName,
                                 const std::string subCommandName,
                                 CommandArguments args);

  OutputAndStatus executeIPCommand(const CommandArguments &args);
  OutputAndStatus executeIPRoute(const CommandArguments &args);
  OutputAndStatus executeIPLink(const CommandArguments &args);
  OutputAndStatus executeIPTunTap(const CommandArguments &args);
  OutputAndStatus executeIPAddress(const CommandArguments &args);

  OutputAndStatus executeSysctl(const CommandArguments &args);

  void detectBestInterfaceIndex();
  void processRoutingTable();

  void createDefaultRouteThroughTun();
  void createRouteforOutlineServer();

  void createDefaultRouteThroughGateway();

  void deleteAllDefaultRoutes();
  void deleteOutlineServerRouting();

  /**
   * returns true  if the specific routePart shows up in the routing table
   * returns false otherwise
   *
   */
  bool checkRoutingTableForSpecificRoute(std::string routePart);

  void toggleIPv6(bool IPv6Status);

  void getIntefraceMetric();

  // utility functions
  /**
   * search for a value in the result of ip route command
   * the string should be formated as follow
   * param1 value1 param2 value2 etc. Throws an exception
   * in case of not founding param in resulting String
   *
   * return the value corresponding to the parameter
   */
  std::string getParamValueInResult(std::string resultString, std::string param);

private:
  const std::string resultDelimiter = " ";

  const std::string IPCommand = "/usr/sbin/ip";
  const std::string IPRouteSubCommand = "route";
  const std::string IPAddressSubCommand = "addr";
  const std::string IPLinkSubCommand = "link";
  const std::string IPTunTapSubCommand = "tuntap";
  const std::string sysctlCommand = "/usr/sbin/sysctl";

  const std::string c_normal_traffic_priority_metric = "10";
  const std::string c_proxy_priority_metric = "5";

  // TODO: Configure these values at runtime.
  std::string tunInterfaceName = "outline-tun0";
  std::string tunInterfaceIp = "10.0.85.1";
  std::string tunInterfaceRouterIp = "10.0.85.2";
  std::string outlineServerIP;
  std::string outlineDNSServer = "9.9.9.9";

  std::string clientLocalIP;
  std::string routingGatewayIP;
  std::string clientToServerRoutingInterface;

  // TODO [vmon] We have to keep track of connect request so if we receive two
  // consequective connect request we have to disconnect first. So we don't
  // over write our recovery data

  // we are going to backup both resolve.conf and resolv.conf.head
  // and modify both to make sure that we are going to do stuff
  std::stringstream backedupResolveConf;
  std::stringstream backedupResolveConfHeader;
  bool DNSSettingBackedup = false;

  // storing different route inorder to delete them later
  std::string throughGatewayRoute;
  std::string throughOutlineTunDeviceRoute;
  std::string outlineProxyThroughGatewayRoute;
};

}  // namespace outline
