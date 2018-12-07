#pragma once

#include <queue>
#include <sstream>
#include <string>
#include <utility>

#include <cstdlib>

namespace outline {

typedef std::pair<std::string, uint8_t> OutputAndStatus;
typedef std::pair<const std::string, const std::string> SubCommandPart;
typedef std::queue<SubCommandPart> SubCommand;

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
  ~OutlineProxyController();

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
    IPV6_ROUTING_FAILED

  };

  enum OutlineConnectionStatus {
    ROUTING_THROUGH_OUTLINE,
    ROUTING_THROUGH_DEFAULT_GATEWAY
  } routingStatus;
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
  OutputAndStatus executeCommand(const std::string commandName, const SubCommand args);

  OutputAndStatus executeIPCommand(const SubCommand args);
  OutputAndStatus executeIPRoute(const SubCommand args);
  OutputAndStatus executeIPLink(const SubCommand args);
  OutputAndStatus executeIPTunTap(const SubCommand args);
  OutputAndStatus executeIPAddress(const SubCommand args);

  OutputAndStatus executeSysctl(const SubCommand args);

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

  /**
   *  store created route as an string so it can be deleted later
   */
  std::string createRoutingString(SubCommand args);

 private:
  const std::string c_redirect_stderr_into_stdout = " 2>&1";

  const std::string resultDelimiter = " ";

  const std::string IPCommand = "ip";
  const std::string IPRouteCommand = "ip route";
  const std::string IPAddressCommand = "ip addr";
  const std::string IPLinkCommand = "ip link";
  const std::string IPTunTapCommand = "ip tuntap";
  const std::string sysctlCommand = "sysctl";

  const std::string c_normal_traffic_priority_metric = "10";
  const std::string c_proxy_priority_metric = "5";

  std::string tunInterfaceName = "outline-tun0";
  std::string tunInterfaceIp = "10.0.85.1";
  std::string tunInterfaceRouterIp = "10.0.85.2";
  std::string outlineServerIP;
  std::string outlineDNSServer = "216.146.35.35";

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
