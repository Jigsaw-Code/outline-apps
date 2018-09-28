#include <cstdio>
#include <iostream>
#include <map>
#include <memory>
#include <stdexcept>
#include <string>

#include "outline_proxy_controller.h"

    using namespace std;
using namespace outline;

string OutlineProxyController::getParamValueInResult(string resultString, string param) {
  auto paramPosition = resultString.find(param);
  if (paramPosition == string::npos) throw std::runtime_error("param not found");

  auto valuePosition = paramPosition + param.length() + resultDelimiter.length();
  if (valuePosition > resultString.length()) return "";

  auto delimiterPosition = resultString.find(resultDelimiter, valuePosition);
  delimiterPosition =
      (delimiterPosition != string::npos) ? delimiterPosition : resultString.length();

  return resultString.substr(valuePosition, delimiterPosition - valuePosition);
}

std::string OutlineProxyController::executeIPRoute(const std::map<string, string> args) {
  return executeCommand(IPRouteCommand, args);
}

std::string OutlineProxyController::executeIPLink(const std::map<string, string> args) {
  return executeCommand(IPLinkCommand, args);
}

std::string OutlineProxyController::executeIPTunTap(const std::map<string, string> args) {
  return executeCommand(IPTunTapCommand, args);
}

std::string OutlineProxyController::executeCommand(const std::string commandName,
                                                   const std::map<string, string> args) {
  array<char, 128> buffer;
  string result;
  string cmd = commandName;

  for (auto it = args.cbegin(); it != args.cend(); it++) {
    cmd += " " + (it->first) + " " + (it->second);
  }

  std::shared_ptr<FILE> pipe(popen(cmd.c_str(), "r"), pclose);
  if (!pipe) throw std::runtime_error("failed to run " + commandName + " command!");

  while (!feof(pipe.get())) {
    if (fgets(buffer.data(), 128, pipe.get()) != nullptr) result += buffer.data();
  }

  return result;
}

OutlineProxyController::OutlineProxyController() {
  detectBestInterfaceIndex();
  addOutlineTunDev();
  setTunDeviceIP();
}

void OutlineProxyController::addOutlineTunDev() {
  if (!outlineTunDeviceExsits()) {
    map<string, string> createTunDeviceCommand;
    createTunDeviceCommand["add dev"] = tunInterfaceName;
    createTunDeviceCommand["mode"] = "tun";
    std::string tunDeviceAdditionResult = executeIPTunTap(createTunDeviceCommand);

    if (!outlineTunDeviceExsits()) {
      throw runtime_error("failed to add outline tun network interface");
    }
  }

  // set the device up
  map<string, string> setUpTunDeviceCommand;
  setUpTunDeviceCommand["set"] = tunInterfaceName;
  setUpTunDeviceCommand["up"] = "";
  std::string tunDeviceAdditionResult = executeIPLink(setUpTunDeviceCommand);
}

bool OutlineProxyController::outlineTunDeviceExsits() {
  map<string, string> checkDevCommand;

  checkDevCommand["show"] = tunInterfaceName;
  std::string tunDeviceExistanceResult = executeIPLink(checkDevCommand);

  return (!tunDeviceExistanceResult.empty());
}

void OutlineProxyController::setTunDeviceIP() {
  if (!outlineTunDeviceExsits()) {
    throw runtime_error(
        "can not set the ip address of a non-existing tun network interface, gone?");
  }

  map<string, string> addIPCommand;

  addIPCommand["add"] = tunInterfaceIp + "/24";
  addIPCommand["dev"] = tunInterfaceName;
  std::string tunDeviceAdditionResult = executeIPAddress(addIPCommand);
}

void OutlineProxyController::detectBestInterfaceIndex() {
  map<string, string> getRouteCommand;

  // our best guest is the route that outline server already can be reached
  // it is the default gateway if outline is connected or not
  getRouteCommand["get"] = outlineServerIP;
  std::string routingData = executeIPRoute(getRouteCommand);

  routingGatewayIP = getParamValueInResult(routingData, "via");
  clientToServerRoutingInterface = getParamValueInResult(routingData, "dev");
  clientLocalIP = getParamValueInResult(routingData, "src");
}

void OutlineProxyController::routeThroughOutline(std::string outlineServerIP) {
  // TODO: make sure the routing rule isn't already in the table
  this->outlineServerIP = outlineServerIP;

  createRouteforOutlineServer();
  deleteDefaultRoute();  // drop the default route before adding another one
  createDefaultRouteThroughTun();
  toggleIPv6(false);
}

void OutlineProxyController::deleteDefaultRoute() {
  map<string, string> deleteRouteCommand;

  deleteRouteCommand["del"] = "default";
  std::string routingData = executeIPRoute(deleteRouteCommand);
}

void OutlineProxyController::createDefaultRouteThroughTun() {
  map<string, string> createRouteCommand;

  createRouteCommand["add"] = "default";
  createRouteCommand["via"] = tunInterfaceRouterIp;
  std::string routingData = executeIPRoute(createRouteCommand);
}

void OutlineProxyController::createRouteforOutlineServer() {
  // make sure we have IP for the outline server
  if (outlineServerIP.empty()) throw runtime_error("no outline server is specified");

  // make sure we have the default Gateway IP
  if (routingGatewayIP.empty()) throw runtime_error("default routing gateway is unknown");

  map<string, string> createRouteCommand;

  createRouteCommand["add"] = outlineServerIP;
  createRouteCommand["via"] = routingGatewayIP;
  std::string routingData = executeIPRoute(createRouteCommand);
}

void OutlineProxyController::toggleIPv6(bool IPv6Status) {
  // TODO: Don't enable everything keep track of what was enabled before
  map<string, string> disableIPv6Command;

  std::string IPv6Disabled = (IPv6Status) ? "0" : "1";

  disableIPv6Command["-w"] = "net.ipv6.conf.all.disable_ipv6=" + IPv6Disabled;
  std::string sysctlResultAll = executeSysctl(disableIPv6Command);

  disableIPv6Command["-w"] = "net.ipv6.conf.default.disable_ipv6=" + IPv6Disabled;
  std::string sysctlResultDefault = executeSysctl(disableIPv6Command);
}

std::string OutlineProxyController::executeSysctl(
    const std ::map<std ::string, std ::string> args) {
  return executeCommand(sysctlCommand, args);
}

void OutlineProxyController::routeDirectly() {
  deleteDefaultRoute();
  createDefaultRouteThroughGateway();
  deleteOutlineServerRouting();

  toggleIPv6(true);
}

void OutlineProxyController::createDefaultRouteThroughGateway() {
  map<string, string> createRouteCommand;

  createRouteCommand["add"] = "default";
  createRouteCommand["via"] = routingGatewayIP;
  std::string routingData = executeIPRoute(createRouteCommand);
}

void OutlineProxyController::deleteOutlineServerRouting() {
  map<string, string> deleteRouteCommand;

  deleteRouteCommand["del"] = outlineServerIP;
  std::string routingData = executeIPRoute(deleteRouteCommand);
}

void OutlineProxyController::processRoutingTable() {}

void OutlineProxyController::getIntefraceMetric() {}

void OutlineProxyController::deleteOutlineTunDev() {
  if (outlineTunDeviceExsits()) {
    map<string, string> deleteTunDeviceCommand;

    deleteTunDeviceCommand["del dev"] = tunInterfaceName;
    deleteTunDeviceCommand["mode"] = "tun";
    std::string tunDeviceAdditionResult = executeIPTunTap(deleteTunDeviceCommand);
  }
}

std::string OutlineProxyController::executeIPCommand(
    const std ::map<std ::string, std ::string> args) {
  return executeCommand(IPCommand, args);
}

std::string OutlineProxyController::executeIPAddress(
    const std ::map<std ::string, std ::string> args) {
  return executeCommand(IPAddressCommand, args);
}

std::string OutlineProxyController::getTunDeviceName() { return tunInterfaceName; }

OutlineProxyController::~OutlineProxyController() {
  routeDirectly();
  // deleteOutlineTunDev();
}
