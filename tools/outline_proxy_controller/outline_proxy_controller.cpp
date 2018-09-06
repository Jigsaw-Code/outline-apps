#include <cstdio>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <array>
#include <map>

#include "outline_proxy_controller.h"

using namespace std;
using namespace outline;

string OutlineProxyController::getParamValueInResult(string resultString, string param) {
    auto paramPosition = resultString.find(param);
    if (paramPosition == string::npos)
        throw std::runtime_error("param not found");

    auto valuePosition = paramPosition + param.length() + resultDelimiter.length();
    if (valuePosition > resultString.length())
        return "";
    
    auto delimiterPosition = resultString.find(resultDelimiter, valuePosition);
    delimiterPosition = (delimiterPosition != string::npos) ? delimiterPosition : resultString.length();

    return resultString.substr(valuePosition, delimiterPosition - valuePosition);

}

std::string OutlineProxyController::executeIPRoute(const std::map<string, string> args) {

    array<char, 128> buffer;
    string result;
    string cmd = IPRouteCommand;
    
    for (auto it = args.cbegin(); it != args.cend(); it++) {
		cmd += " " + (it->first) + " " + (it->second);
	}

    std::shared_ptr<FILE> pipe(popen(cmd.c_str(), "r"), pclose);
    if (!pipe) throw std::runtime_error("failed to run ip route command!");
    
    while (!feof(pipe.get())) {
        if (fgets(buffer.data(), 128, pipe.get()) != nullptr)
            result += buffer.data();
    }
    
    return result;
}


OutlineProxyController::OutlineProxyController() {
    detectBestInterfaceIndex();
}

void OutlineProxyController::detectBestInterfaceIndex()
{
    map<string,string> getRouteCommand;

    getRouteCommand["get"] = outlineServerIP;
    std::string routingData = executeIPRoute(getRouteCommand);

    routingGatewayIP = getParamValueInResult(routingData, "via");
    clientToServerRoutingInterface = getParamValueInResult(routingData, "dev");
    clientLocalIP = getParamValueInResult(routingData, "src");

}

void OutlineProxyController::routeThroughOutline() {
    //TODO: make sure the routing rule isn't already in the table
    createDefaultRouteThroughTun();
    createRouteforOutlineServer();
    //disableIpv6Routing();
    
}

void OutlineProxyController::createDefaultRouteThroughTun()
{
    map<string,string> createRouteCommand;

    createRouteCommand["add"] = "default";
    createRouteCommand["via"] = tunInterfaceRouterIp;
    std::string routingData = executeIPRoute(createRouteCommand);
    
}

void OutlineProxyController::createRouteforOutlineServer()
{
    //make sure we have IP for the outline server
    if (outlineServerIP.empty())
        throw runtime_error("no outline server is specified");

    //make sure we have the default Gateway IP
    if (routingGatewayIP.empty())
        throw runtime_error("default routing gateway is unknown");
    
    map<string,string> createRouteCommand;

    createRouteCommand["add"] = outlineServerIP;
    createRouteCommand["via"] = routingGatewayIP;
    std::string routingData = executeIPRoute(createRouteCommand);
    
}
