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

#include <algorithm>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <map>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <tuple>

#include <sys/wait.h>
#include <unistd.h>

#include "logger.h"
#include "outline_proxy_controller.h"

using namespace std;
using namespace outline;

extern Logger logger;

/**
 * @brief
 * Create a new child process of `cmd` with arguments `args`, and return its
 * process id as well as the redirected stdout/stderr stream.
 *
 * This function is similar to popen, but popen executes an arbitrary command
 * in a shell context which opens a hole of os command injection; while this
 * function will make sure we only execute `cmd` itself.
 * 
 * @param cmd The process name to be executed.
 * @param args The arguments of the process (don't include `cmd` itself).
 * @return std::tuple<pid_t, FILE*> The process ID and its stdout/stderr stream.
 */
static tuple<pid_t, FILE*> safe_popen(const string &cmd, const vector<string> &args) {
  // pipefd[0] is read-only; pipefd[1] is write-only
  int pipefd[2];
  if (pipe(pipefd) == -1) {
    throw runtime_error("failed to create pipe for " + cmd + " command");
  }

  pid_t pid;
  switch (pid = fork()) {
  case -1:
    close(pipefd[0]);
    close(pipefd[1]);
    throw runtime_error("failed to fork a new process for " + cmd + " command");
  case 0:
    // child process:
    //   redirect stdout/stderr to write pipe and close read pipe
    close(pipefd[0]);
    dup2(pipefd[1], STDOUT_FILENO);
    dup2(pipefd[1], STDERR_FILENO);
    close(pipefd[1]);

    // argv must start with the command itself, and end with NULL
    vector<const char*> subProcArgv{ cmd.c_str() };
    transform(cbegin(args), cend(args),
              back_inserter(subProcArgv),
              [](const auto &e) { return e.c_str(); });
    subProcArgv.push_back(nullptr);

    // const_cast might mess up on the std::string memory,
    // but it's ok cuz the entire memory space will be replaced soon
    execvp(subProcArgv[0], const_cast<char* const*>(subProcArgv.data()));
    _exit(EXIT_FAILURE);
  }

  close(pipefd[1]);
  FILE* redirectedStdout = fdopen(pipefd[0], "r");
  if (!redirectedStdout) {
    close(pipefd[0]);
    throw runtime_error("failed to read from pipe for " + cmd + " command");
  }
  return { pid, redirectedStdout };
}

/**
 * @brief
 * Wait the child process created by `safe_popen` to be terminated and get
 * its exit code. Will also clean up the redirected stream.
 *
 * @param pid The child process ID.
 * @param pipe The child process's stdout/stderr stream.
 * @return uint8_t The exit code (or signal) of the child process.
 */
static uint8_t safe_pclose(pid_t pid, FILE* pipe) {
  fclose(pipe);

  pid_t exitedPid;
  int status;
  do {
    exitedPid = waitpid(pid, &status, 0);
    // ignore any signals received in this process
  } while (exitedPid == -1 && errno == EINTR);

  if (exitedPid != pid) {
    throw runtime_error("failed to get exit code");
  }
  if (WIFEXITED(status)) {
    return WEXITSTATUS(status);
  } else if (WIFSIGNALED(status)) {
    return WTERMSIG(status);
  } else {
    throw runtime_error("failed to get exit code");
  }
}

string OutlineProxyController::getParamValueInResult(const string resultString,
                                                     const string param) {
  auto paramPosition = resultString.find(param);
  if (paramPosition == string::npos) throw std::invalid_argument("param not found");

  auto valuePosition = paramPosition + param.length() + resultDelimiter.length();
  if (valuePosition > resultString.length()) return "";

  auto delimiterPosition = resultString.find(resultDelimiter, valuePosition);
  delimiterPosition =
      (delimiterPosition != string::npos) ? delimiterPosition : resultString.length();

  return resultString.substr(valuePosition, delimiterPosition - valuePosition);
}

OutputAndStatus OutlineProxyController::executeIPRoute(const SubCommand args) {
  return executeCommand(IPRouteCommand, args);
}

OutputAndStatus OutlineProxyController::executeIPLink(const SubCommand args) {
  return executeCommand(IPLinkCommand, args);
}

OutputAndStatus OutlineProxyController::executeIPTunTap(const SubCommand args) {
  return executeCommand(IPTunTapCommand, args);
}

OutputAndStatus OutlineProxyController::executeCommand(const std::string commandName,
                                                       const SubCommand received_args) {
  array<char, 128> buffer;
  string result;

  vector<string> commandArgs;
  SubCommand args = received_args;

  while (!args.empty()) {
    auto arg{ args.front() };
    if (!arg.first.empty()) {
      commandArgs.push_back(arg.first);
    }
    if (!arg.second.empty()) {
      commandArgs.push_back(arg.second);
    }
    args.pop();
  }

  pid_t pid;
  FILE *pipe;
  tie(pid, pipe) = safe_popen(commandName.c_str(), commandArgs);

  while (!feof(pipe)) {
    if (fgets(buffer.data(), 128, pipe) != nullptr) result += buffer.data();
  }

  return { result, safe_pclose(pid, pipe) };
}

OutlineProxyController::OutlineProxyController() {
  addOutlineTunDev();
  setTunDeviceIP();

  // we try to detect the best interface as early as possible before
  // outline mess up with the routing table. But if we fail, we try
  // again when the connect request comes in
  try {
    detectBestInterfaceIndex();
  } catch (runtime_error& e) {
    logger.warn(e.what());
    logger.warn("we could not detect the best interface, will try again at connect");
  }
}

void OutlineProxyController::addOutlineTunDev() {
  if (!outlineTunDeviceExsits()) {
    // first we check if it exists and not try to add it
    SubCommand createTunDeviceCommand;
    createTunDeviceCommand.push(SubCommandPart("add dev", tunInterfaceName));
    createTunDeviceCommand.push(SubCommandPart("mode", "tun"));

    auto tunDeviceAdditionResult = executeIPTunTap(createTunDeviceCommand);

    if (!outlineTunDeviceExsits()) {
      logger.error(tunDeviceAdditionResult.first);
      throw runtime_error("failed to add outline tun network interface");
    }
  } else {
    logger.warn("tune device " + tunInterfaceName +
                " already exists. is another instance of outline controller is running?");
  }

  // set the device up
  SubCommand setUpTunDeviceCommand;
  setUpTunDeviceCommand.push(SubCommandPart("set", tunInterfaceName));
  setUpTunDeviceCommand.push(SubCommandPart("up", ""));
  auto tunDeviceAdditionResult = executeIPLink(setUpTunDeviceCommand);

  // if we fail to set bring up the device that's an unrecoverable
  if (!isSuccessful(tunDeviceAdditionResult)) {
    logger.error(tunDeviceAdditionResult.first);
    throw runtime_error("unable to bring up outline tun interface");
  }
}

bool OutlineProxyController::outlineTunDeviceExsits() {
  SubCommand checkDevCommand;

  checkDevCommand.push(SubCommandPart("show", tunInterfaceName));

  // this commands return non zero status if the device doesn't exists
  auto tunDeviceExistanceResult = executeIPLink(checkDevCommand);

  return isSuccessful(tunDeviceExistanceResult);
}

void OutlineProxyController::setTunDeviceIP() {
  if (!outlineTunDeviceExsits()) {
    throw runtime_error(
        "can not set the ip address of a non-existing tun network interface, gone?");
  }

  SubCommand addIPCommand;

  addIPCommand.push(SubCommandPart("replace", tunInterfaceIp + "/24"));
  addIPCommand.push(SubCommandPart("dev", tunInterfaceName));
  auto tunDeviceAdditionResult = executeIPAddress(addIPCommand);

  if (!isSuccessful(tunDeviceAdditionResult)) {
    logger.error(tunDeviceAdditionResult.first);
    throw runtime_error("failed to set the tun device ip address");
  }
}

void OutlineProxyController::detectBestInterfaceIndex() {
  SubCommand getRouteCommand;

  // our best guest is the route that outline server already can be reached
  // it is the default gateway if outline is connected or not
  getRouteCommand.push(make_pair("get", outlineServerIP));
  auto result = executeIPRoute(getRouteCommand);

  if (!isSuccessful(result)) {
    logger.error(result.first);
    throw runtime_error("unable to query the default route to the outline proxy");
  }

  std::string routingData = result.first;

  try {
    routingGatewayIP = getParamValueInResult(routingData, "via");
    clientToServerRoutingInterface = getParamValueInResult(routingData, "dev");
    clientLocalIP = getParamValueInResult(routingData, "src");
  } catch (runtime_error& e) {
    logger.error(e.what());
    throw runtime_error("Failed to parse the routing query response");
  }
}

void OutlineProxyController::routeThroughOutline(std::string outlineServerIP) {
  // Sanity checks
  if (outlineServerIP.empty()) {
    logger.error("Outline Server IP address cannot be empty");
    throw runtime_error("outlineServerIP is empty");
  }

  logger.info("attempting to route through outline server " + outlineServerIP);

  // TODO: make sure the routing rule isn't already in the table
  if (routingStatus == ROUTING_THROUGH_OUTLINE) {
    logger.warn("it seems that we are already routing through outline server");
  }

  this->outlineServerIP = outlineServerIP;

  backupDNSSetting();

  try {
    createRouteforOutlineServer();
  } catch (exception& e) {
    // we can not continue
    logger.error("failed to create a proirity route to outline proxy: " + string(e.what()));
    // We failed to make a route through outline proxy. We just remove the flag
    // indicating DNS is backed up.
    resetFailRoutingAttempt(OUTLINE_PRIORITY_SET_UP);
    return;
  }

  try {
    deleteAllDefaultRoutes();  // drop the default route before adding another one
  } catch (exception& e) {
    logger.error("failed to remove the default route throw the current default router: " +
                 string(e.what()));
    resetFailRoutingAttempt(DEFAULT_GATEWAY_ROUTE_DELETED);
    return;
  }

  try {
    createDefaultRouteThroughTun();
  } catch (exception& e) {
    logger.error("failed to route network traffic through outline tun interfacet: ", e.what());
    resetFailRoutingAttempt(TRAFFIC_ROUTED_THROUGH_TUN);
    return;
  }

  try {
    toggleIPv6(false);
  } catch (exception& e) {
    // We are going to fail if we are not able to disable all IPV6 routes.
    logger.error("possible net traffic leakage. failed to disable IPv6 routes on all interfaces: " +
                 string(e.what()));
    resetFailRoutingAttempt(IPV6_ROUTING_FAILED);
    return;
  }

  try {
    enforceGloballyReachableDNS();

  } catch (exception& e) {
    // this might not break routing through outline if the DNS is in the same
    // internal network or is a globally reachable. Notheless the user is
    // vulnerable to DNS poisening so we are going to reverse everthing
    logger.error("failed to enforce outline DNS server: ", e.what());
    resetFailRoutingAttempt(OUTLINE_DNS_SET);
    return;
  }

  routingStatus = ROUTING_THROUGH_OUTLINE;
  logger.info("successfully routing through the outline server");
}

void OutlineProxyController::backupDNSSetting() {
  // backing up resolv.conf
  if (DNSSettingBackedup) {
    logger.warn("double backuping of DNS configuration");
    return;
  }

  try {
    std::ifstream resolveFile("/etc/resolv.conf");
    backedupResolveConf << resolveFile.rdbuf();

    resolveFile.close();

    DNSSettingBackedup = true;

  } catch (std::exception& e) {
    // If we can not backup the setting too bad,
    // we won't reset the setting after disconnect
    logger.warn("unable to backup current DNS configuration");
  }

  // backing up resolv.conf.head
  try {
    std::ifstream resolveHeadFile("/etc/resolv.conf.head");
    backedupResolveConfHeader << resolveHeadFile.rdbuf();

    resolveHeadFile.close();

  } catch (std::exception& e) {
    // it doesn't exists necessarily
    logger.info("unable to read resolv.conf.head. might not exits:" + string(e.what()));
  }
}

void OutlineProxyController::deleteAllDefaultRoutes() {
  SubCommand deleteRouteCommand;
  deleteRouteCommand.push(SubCommandPart("del", "default"));

  // TODO: we are going to delete all default routes
  // but the correct way of dealing with is to find the minimum
  // metric of all default routing if it 0, then bump up all routing
  // so no one has 0 routing, then setup our routing equal to min - 1

  // try to see if there is still default route in the table
  while (checkRoutingTableForSpecificRoute("default via")) {
    // routing table has "default via" string, delete it
    auto result = executeIPRoute(deleteRouteCommand);

    if (!isSuccessful(result)) {
      logger.error(result.first);
      throw runtime_error("failed to delete default route from the routing table");
    }
  }
}

bool OutlineProxyController::checkRoutingTableForSpecificRoute(std::string routePart) {
  SubCommand getRoutingTableCommand;  // that's just empty

  auto routingTableResult = executeIPRoute(getRoutingTableCommand);
  if (!isSuccessful(routingTableResult)) {
    logger.error(routingTableResult.first);
    throw runtime_error("failed to query the routing table");
  }

  // try to see if the route part shows up in the routing table
  try {
    auto default_via = getParamValueInResult(routingTableResult.first, routePart);

  } catch (const std::invalid_argument& e) {
    // part was not found in the routing table
    return false;
  }

  // no error means routing table has routePart string, delete it
  return true;
}

void OutlineProxyController::createDefaultRouteThroughTun() {
  SubCommand createRouteCommand;

  createRouteCommand.push(SubCommandPart("add", "default"));
  createRouteCommand.push(SubCommandPart("via", tunInterfaceRouterIp));
  createRouteCommand.push(SubCommandPart("metric", c_normal_traffic_priority_metric));

  auto result = executeIPRoute(createRouteCommand);
  if (!isSuccessful(result)) {
    logger.error(result.first);
    throw runtime_error("failed to execute create default route through the tun device");
  }
}

void OutlineProxyController::createRouteforOutlineServer() {
  // make sure we have IP for the outline server
  if (outlineServerIP.empty()) throw runtime_error("no outline server is specified");

  // make sure we have the default Gateway IP
  if (routingGatewayIP.empty()) {
    logger.warn("default routing gateway is unknown");
    // because creating the priority route for outline proxy is the first
    // step in routing through outline, we can still hope by query the routing
    // table we get the default gateway IP.
    detectBestInterfaceIndex();
  }

  SubCommand createRouteCommand;

  createRouteCommand.push(SubCommandPart("add", outlineServerIP));
  createRouteCommand.push(SubCommandPart("via", routingGatewayIP));
  createRouteCommand.push(SubCommandPart("metric", c_proxy_priority_metric));

  auto result = executeIPRoute(createRouteCommand);
  if (!isSuccessful(result)) {
    logger.error(result.first);
    throw runtime_error("failed to create route for outline proxy");
  }
}

void OutlineProxyController::toggleIPv6(bool IPv6Status) {
  // TODO: Don't enable everything keep track of what was enabled before
  SubCommand disableIPv6Command;

  std::string IPv6Disabled = (IPv6Status) ? "0" : "1";

  disableIPv6Command.push(SubCommandPart("-w", "net.ipv6.conf.all.disable_ipv6=" + IPv6Disabled));
  auto sysctlResultAll = executeSysctl(disableIPv6Command);

  disableIPv6Command.push(
      SubCommandPart("-w", "net.ipv6.conf.default.disable_ipv6=" + IPv6Disabled));
  auto sysctlResultDefault = executeSysctl(disableIPv6Command);

  if (!isSuccessful(sysctlResultAll) || !isSuccessful(sysctlResultDefault)) {
    logger.error(sysctlResultAll.first);
    logger.error(sysctlResultDefault.first);
    throw runtime_error("failed to toggle systemwide ipv6 status");
  }
}

void OutlineProxyController::enforceGloballyReachableDNS() {
  // if we fail to write into DNS we let the exception
  // to go down it is the connect routine's duting  to deal with
  // it
  try {
    std::ofstream resolveConfFile("/etc/resolv.conf");

    resolveConfFile << "# Generated by outline \n";
    resolveConfFile << "nameserver " + outlineDNSServer + "\n";

    // doing dns over tcp instead
    resolveConfFile << "options use-vc\n";

    resolveConfFile.close();

  } catch (exception& e) {
    // if we are unable to open resolve conf
    logger.error(e.what());
    throw runtime_error("unable to apply outline dns configuration");
  }

  try {
    // we also put our favorite dns in the head
    // file in case resolvconf re-write resolv.conf
    std::ofstream resolveHeadFile("/etc/resolv.conf.head");

    resolveHeadFile << "nameserver " + outlineDNSServer + "\n";
    // doing dns over tcp instead
    resolveHeadFile << "options use-vc\n";

    resolveHeadFile.close();
  } catch (exception& e) {
    // this is less fatal
    logger.warn("unable to update reslov.conf.head: " + string(e.what()));
  }
}

void OutlineProxyController::resetFailRoutingAttempt(OutlineConnectionStage failedStage) {
  switch (failedStage) {
    case OUTLINE_DNS_SET:
      restoreDNSSetting();

    case IPV6_ROUTING_FAILED:
    case TRAFFIC_ROUTED_THROUGH_TUN:
    case DEFAULT_GATEWAY_ROUTE_DELETED:
      // We need to delete the priority path to the default gateway
      // plus make sure default route to the gateway is there.
      createDefaultRouteThroughGateway();
      deleteOutlineServerRouting();

    case OUTLINE_PRIORITY_SET_UP:
      // we just need to forget that we have backed up DNS
      // in case DNS setting changes before our next attempt
      DNSSettingBackedup = false;

    default:
      // we basically have to do nothing in other cases
      break;
  }

  routingStatus = ROUTING_THROUGH_DEFAULT_GATEWAY;
}

OutputAndStatus OutlineProxyController::executeSysctl(const SubCommand args) {
  return executeCommand(sysctlCommand, args);
}

void OutlineProxyController::routeDirectly() {
  logger.info("attempting to dismantle routing through outline server");
  if (routingStatus == ROUTING_THROUGH_DEFAULT_GATEWAY) {
    logger.warn("it does not seem that we are routing through outline server");
  }

  try {
    // before deleting all route make sure that we have kept track of default
    // router info.
    if (routingGatewayIP.empty()) {
      logger.warn("default routing gateway is unknown");
      detectBestInterfaceIndex();
    }

    deleteAllDefaultRoutes();
  } catch (exception& e) {
    logger.error("failed to delete the route through outline proxy " + string(e.what()));
    // this might be because our route got deleted, we are going to add the
    // original default route nonetheless
  }

  try {
    createDefaultRouteThroughGateway();
  } catch (exception& e) {
    logger.error("failed to make a default route through the network gateway: " + string(e.what()));
  }

  try {
    deleteOutlineServerRouting();
  } catch (exception& e) {
    logger.warn("unable to delete priority route for outline proxy: " + string(e.what()));
  }

  try {
    toggleIPv6(true);
  } catch (exception& e) {
    logger.error("failed to enable IPv6 for all interfaces:" + string(e.what()));
  }

  try {
    restoreDNSSetting();
  } catch (exception& e) {
    logger.warn("unable restoring DNS configuration " + string(e.what()));
  }

  routingStatus = ROUTING_THROUGH_DEFAULT_GATEWAY;
  logger.info("now routing through the network default gateway");
}

void OutlineProxyController::createDefaultRouteThroughGateway() {
  SubCommand createRouteCommand;

  createRouteCommand.push(SubCommandPart("add", "default"));
  createRouteCommand.push(SubCommandPart("via", routingGatewayIP));

  auto result = executeIPRoute(createRouteCommand);
  if (!isSuccessful(result)) {
    logger.error(result.first);
    throw runtime_error("failed to create back the route through the network default gateway");
  }
}

void OutlineProxyController::deleteOutlineServerRouting() {
  SubCommand deleteRouteCommand;

  // first we check if such a route exists
  if (checkRoutingTableForSpecificRoute(outlineServerIP + " via")) {
    deleteRouteCommand.push(SubCommandPart("del", outlineServerIP));

    auto result = executeIPRoute(deleteRouteCommand);
    if (!isSuccessful(result)) {
      logger.error(result.first);
      throw runtime_error("failed to delete outline server direct routing entry.");
    }
  } else {
    logger.warn("no specific routing entry for outline server to be deleted.");
  }
}

void OutlineProxyController::restoreDNSSetting() {
  // we only restore if we were able to successfully
  // backup
  if (DNSSettingBackedup) {
    // if we fail to restore, worst case is that
    // user continues using outline dns
    try {
      std::ofstream resolveConfFile("/etc/resolv.conf");
      resolveConfFile << backedupResolveConf.rdbuf();
      resolveConfFile.close();

    } catch (exception& e) {
      logger.warn("failed to restore original DNS configuration");
      logger.warn(e.what());
    }

    try {
      std::ofstream resolveHeadFile("/etc/resolv.conf.head");
      resolveHeadFile << backedupResolveConfHeader.rdbuf();
      resolveHeadFile.close();

    } catch (exception& e) {
      logger.warn("failed to restore original DNS configuration header.");
      logger.warn(e.what());
    }

    backedupResolveConf.clear();
    backedupResolveConfHeader.clear();
    DNSSettingBackedup = false;
  }
}

void OutlineProxyController::processRoutingTable() {}

void OutlineProxyController::getIntefraceMetric() {}

void OutlineProxyController::deleteOutlineTunDev() {
  if (outlineTunDeviceExsits()) {
    SubCommand deleteTunDeviceCommand;

    deleteTunDeviceCommand.push(SubCommandPart("del dev", tunInterfaceName));
    deleteTunDeviceCommand.push(SubCommandPart("mode", "tun"));
    try {
      OutputAndStatus tunDeviceAdditionResult = executeIPTunTap(deleteTunDeviceCommand);
    } catch (exception& e) {
      logger.warn("failed to delete outline tun interface: " + string(e.what()));
    }
  }
}

OutputAndStatus OutlineProxyController::executeIPCommand(const SubCommand args) {
  return executeCommand(IPCommand, args);
}

OutputAndStatus OutlineProxyController::executeIPAddress(const SubCommand args) {
  return executeCommand(IPAddressCommand, args);
}

std::string OutlineProxyController::getTunDeviceName() { return tunInterfaceName; }

OutlineProxyController::~OutlineProxyController() {
  if (routingStatus == ROUTING_THROUGH_OUTLINE) routeDirectly();
  deleteOutlineTunDev();
}
