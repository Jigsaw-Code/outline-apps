#pragma once

#include <map>
#include <string>
#include <sstream>

namespace outline {

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
  // add a tun device
  // void addTunInterface();

  /**
   * adds outline tun interface in case it is missing
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
   * exectues a shell command and returns the stdout
   */
  std::string executeCommand(const std::string commandName,
                             const std::map<std::string, std::string> args);

  std::string executeIPCommand(const std::map<std::string, std::string> args);
  std::string executeIPRoute(const std::map<std::string, std::string> args);
  std::string executeIPLink(const std::map<std::string, std::string> args);
  std::string executeIPTunTap(const std::map<std::string, std::string> args);
  std::string executeIPAddress(const std::map<std::string, std::string> args);

  std::string executeSysctl(const std::map<std::string, std::string> args);

  void detectBestInterfaceIndex();
  void processRoutingTable();

  void createDefaultRouteThroughTun();
  void createRouteforOutlineServer();

  void createDefaultRouteThroughGateway();

  void deleteDefaultRoute();
  void deleteOutlineServerRouting();

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
  std::string createRoutingString(std::map<std::string, std::string> args);

 private:
  const std::string resultDelimiter = " ";

  const std::string IPCommand = "ip";
  const std::string IPRouteCommand = "ip route";
  const std::string IPAddressCommand = "ip addr";
  const std::string IPLinkCommand = "ip link";
  const std::string IPTunTapCommand = "ip tuntap";
  const std::string sysctlCommand = "sysctl";

  const std::string c_normal_traffic_priority_metric = "6";
  const std::string c_proxy_priority_metric = "100";

  std::string tunInterfaceName = "outline-tun0";
  std::string tunInterfaceIp = "10.0.85.1";
  std::string tunInterfaceRouterIp = "10.0.85.2";
  std::string outlineServerIP = "138.197.150.245";
  std::string outlineDNSServer = "8.8.8.8";



  std::string clientLocalIP;
  std::string routingGatewayIP;
  std::string clientToServerRoutingInterface;

  //TODO [vmon] We have to keep track of connect request so if we receive two
  //consequective connect request we have to disconnect first. So we don't
  //over write our recovery data
  
  //we are going to backup both resolve.conf and resolv.conf.head
  //and modify both to make sure that we are going to do stuff
  std::stringstream backedupResolveConf;
  std::stringstream backedupResolveConfHeader;
  bool DNSSettingBackedup = false;

  // storing different route inorder to delete them later
  std::string throughGatewayRoute;
  std::string throughOutlineTunDeviceRoute;
  std::string outlineProxyThroughGatewayRoute;
};

}  // namespace outline
