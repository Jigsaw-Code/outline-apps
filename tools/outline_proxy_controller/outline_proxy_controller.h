#pragma once

#include <string>
#include <map>

namespace outline {

class OutlineProxyController {
public:

    OutlineProxyController();

    /**
     *  set the routing table so user traffic get routed though outline 
     */
    void routeThroughOutline();
    void routeDirectly();
    
private:
    //add a tun device
    //void addTunInterface();
    /**
     *  set the ip and netmask for the tun inteface
     */
    //void configureTunInterface();
    std::string executeIPRoute(const std::map<std::string, std::string> args); 
    void detectBestInterfaceIndex();
    void processRoutingTable();

    void createDefaultRouteThroughTun();
    void createRouteforOutlineServer();

    void getIntefraceMetric();
    void createRoute();
    void deleteRoute();
    void disableIpv6Routing();
    void enableIpv6Routing();

    //utility functions
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
    const std::string IPRouteCommand = "ip route";
    std::string tunInterfaceName = "tun0";
    std::string tunInterfaceIp = "10.0.85.1";
    std::string tunInterfaceRouterIp = "10.0.85.2";
    std::string outlineServerIP = "138.197.150.245";

    std::string clientLocalIP;
    std::string routingGatewayIP;
    std::string clientToServerRoutingInterface;

};        

}
