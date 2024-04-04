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
#include <array>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <map>
#include <memory>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <system_error>
#include <tuple>

#include <sys/wait.h>
#include <unistd.h>

#include "logger.h"
#include "outline_error.h"
#include "outline_proxy_controller.h"

using namespace std;
using namespace outline;

// TODO: we extensively use shell command `ip route` and parse the output
//       string in the implementation, replace it with raw netlink API

static const std::regex kDefaultRoutingEntryPattern{"^default via (\\S+) dev (\\S+).*"};
static const std::regex kRoutingEntryPattern{"^(\\S+) dev (\\S+).*"};

/**
 * @brief
 * Create a new child process of `cmd` with arguments `args`, and return its
 * process id as well as the redirected stdout/stderr stream.
 *
 * This function is similar to popen, but popen executes an arbitrary command
 * in a shell context which opens a hole of os command injection; while this
 * function will make sure we only execute `cmd` itself.
 * 
 * @param filename The process name to be executed.
 * @param args The arguments of the process (don't include `cmd` itself).
 * @return std::tuple<pid_t, FILE*> The process ID and its stdout/stderr stream.
 */
static tuple<pid_t, FILE*> safe_popen(const string &filename,
                                      const CommandArguments &args) {
  // pipefd[0] is read-only; pipefd[1] is write-only
  int pipefd[2];
  if (pipe(pipefd) == -1) {
    throw runtime_error("failed to create pipe for " + filename + " command");
  }

  pid_t pid;
  switch (pid = fork()) {
  case -1:
    close(pipefd[0]);
    close(pipefd[1]);
    throw runtime_error("failed to fork a new process for " + filename + " command");
  case 0:
    // child process:
    //   redirect stdout/stderr to write pipe and close read pipe
    close(pipefd[0]);
    dup2(pipefd[1], STDOUT_FILENO);
    dup2(pipefd[1], STDERR_FILENO);
    close(pipefd[1]);

    // argv must start with the command itself, and end with NULL
    vector<const char*> subProcArgv{ filename.c_str() };
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
    throw runtime_error("failed to read from pipe for " + filename + " command");
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

OutputAndStatus OutlineProxyController::executeIPRoute(const CommandArguments &args) {
  return executeCommand(IPCommand, IPRouteSubCommand, args);
}

OutputAndStatus OutlineProxyController::executeIPLink(const CommandArguments &args) {
  return executeCommand(IPCommand, IPLinkSubCommand, args);
}

OutputAndStatus OutlineProxyController::executeIPTunTap(const CommandArguments &args) {
  return executeCommand(IPCommand, IPTunTapSubCommand, args);
}

OutputAndStatus OutlineProxyController::executeCommand(const std::string commandName,
                                                       const std::string subCommandName,
                                                       CommandArguments received_args) {
  if (!subCommandName.empty()) {
    received_args.insert(begin(received_args), subCommandName);
  }

  auto [pid, pipe] = safe_popen(commandName.c_str(), received_args);

  array<char, 128> buffer;
  string result;
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
    auto tunDeviceAdditionResult = executeIPTunTap({
      "add", "dev", tunInterfaceName,
      "mode", "tun"
    });

    if (!outlineTunDeviceExsits()) {
      logger.error(tunDeviceAdditionResult.first);
      throw runtime_error("failed to add outline tun network interface");
    }
  } else {
    logger.warn("tune device " + tunInterfaceName +
                " already exists. is another instance of outline controller is running?");
  }

  // set the device up
  auto tunDeviceAdditionResult = executeIPLink({
    "set", tunInterfaceName,
    "up"
  });

  // if we fail to set bring up the device that's an unrecoverable
  if (!isSuccessful(tunDeviceAdditionResult)) {
    logger.error(tunDeviceAdditionResult.first);
    throw runtime_error("unable to bring up outline tun interface");
  }
}

bool OutlineProxyController::outlineTunDeviceExsits() {
  // this commands return non zero status if the device doesn't exists
  auto tunDeviceExistanceResult = executeIPLink({ "show", tunInterfaceName });

  return isSuccessful(tunDeviceExistanceResult);
}

void OutlineProxyController::setTunDeviceIP() {
  if (!outlineTunDeviceExsits()) {
    throw runtime_error(
        "can not set the ip address of a non-existing tun network interface, gone?");
  }

  auto tunDeviceAdditionResult = executeIPAddress({
    "replace", tunInterfaceIp + "/32",
    "dev", tunInterfaceName
  });

  if (!isSuccessful(tunDeviceAdditionResult)) {
    logger.error(tunDeviceAdditionResult.first);
    throw runtime_error("failed to set the tun device ip address");
  }
  logger.info("successfully set the tun device ip address");

  // Because we are using `10.0.85.1/32` single-host subnet, the gateway
  // IP `10.0.85.2` is not configured, we need to explicityly add it, otherwise
  // we cannot configure the default gateway due to "Nexthop has invalid gateway".
  // If we are using `10.0.85.0/24` we don't need to do this step.
  auto gatewayRouteResult = executeIPRoute({
    "replace", tunInterfaceRouterIp,
    "dev", tunInterfaceName,
    "src", tunInterfaceIp,
  });

  if (!isSuccessful(gatewayRouteResult)) {
    logger.error(gatewayRouteResult.first);
    throw runtime_error("failed to add outline gateway routing entry");
  }
  logger.info("successfully added outline gateway routing entry");
}

void OutlineProxyController::detectBestInterfaceIndex() {
  // our best guess is the route that outline server already can be reached
  // it is the default gateway if outline is connected or not
  auto result = executeIPRoute({ "get", outlineServerIP });

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

bool OutlineProxyController::IsOutlineRoutingPolluted() noexcept {
  if (routing_status_ == OutlineConnectionStatus::kReconfiguringRouting) {
    return true;
  }
  if (routing_status_ != OutlineConnectionStatus::kRoutingThroughOutline) {
    return false;
  }

  try {
    auto result = executeIPRoute({});
    if (!isSuccessful(result)) {
      logger.warn("[routing polluted] failed to get routing table: " + result.first);
      return true;
    }

    // A valid Outline'd `ip route` output must contains:
    //   - One and only one default gateway through Outline `default via 10.0.85.2 dev outline-tun0`
    //   - At least one non-Outline routing entry like `192.168.1.0/24 dev ens33 ...` (otherwise it
    //     means the NIC might be turned off, and we need to enter "reconnecting" state)
    bool has_outline_default_entry = false;
    bool has_non_outline_device = false;

    std::istringstream routing_table{result.first};
    for (std::string routing_entry; std::getline(routing_table, routing_entry);) {
      std::smatch entry_match;
      if (std::regex_match(routing_entry, entry_match, kDefaultRoutingEntryPattern)) {
        if (entry_match[1].str() == tunInterfaceRouterIp && entry_match[2].str() == tunInterfaceName) {
          has_outline_default_entry = true;
        } else {
          logger.info("[routing polluted] extra non-Outline default gateway: " + routing_entry);
          return true;
        }
      } else if (std::regex_match(routing_entry, entry_match, kRoutingEntryPattern)) {
        if (entry_match[1].str() != tunInterfaceRouterIp && entry_match[2].str() != tunInterfaceName) {
          has_non_outline_device = true;
        }
      }
    }

    if (!has_outline_default_entry || !has_non_outline_device) {
      logger.info(std::string{"[routing polluted]"}
        + (!has_outline_default_entry ? " no Outline default gateway;" : "")
        + (!has_non_outline_device ? " no outgoing network interface;" : ""));
      return true;
    }
    return false;
  } catch (const std::exception &err) {
    logger.warn("[routing polluted] unexpected error: " + std::string{err.what()});
    return true;
  }
}

bool OutlineProxyController::ReconfigureRouting() noexcept {
  try {
    routing_status_ = OutlineConnectionStatus::kReconfiguringRouting;
    routeDirectly();
    routeThroughOutline(outlineServerIP);
    return true;
  } catch (const std::exception &err) {
    logger.warn("failed to reconnect, will retry later: " + std::string{err.what()});
    routing_status_ = OutlineConnectionStatus::kReconfiguringRouting;
    return false;
  }
}

void OutlineProxyController::routeThroughOutline(std::string outlineServerIP) {
  // Sanity checks
  if (outlineServerIP.empty()) {
    throw std::system_error{
      ErrorCode::kInvalidServerConfiguration,
      "Outline Server IP address cannot be empty"};
  }

  logger.info("attempting to route through outline server " + outlineServerIP);

  // TODO: make sure the routing rule isn't already in the table
  if (routing_status_ != OutlineConnectionStatus::kRoutingThroughDefaultGateway) {
    logger.warn("it seems that we are already routing through outline server");
  }
  routing_status_ = OutlineConnectionStatus::kConfiguringRouting;

  this->outlineServerIP = outlineServerIP;

  backupDNSSetting();

  // TODO: add more details when throwing system_error (e.g., use different error
  // codes, or append detail messages)
  try {
    createRouteforOutlineServer();
  } catch (exception& e) {
    // we can not continue
    logger.error("failed to create a priority route to outline proxy: " + string(e.what()));
    // We failed to make a route through outline proxy. We just remove the flag
    // indicating DNS is backed up.
    resetFailRoutingAttempt(OUTLINE_PRIORITY_SET_UP);
    throw std::system_error{ErrorCode::kConfigureSystemProxyFailure};
  }

  try {
    deleteAllDefaultRoutes();  // drop the default route before adding another one
  } catch (exception& e) {
    logger.error("failed to remove the default route throw the current default router: " +
                 string(e.what()));
    resetFailRoutingAttempt(DEFAULT_GATEWAY_ROUTE_DELETED);
    throw std::system_error{ErrorCode::kConfigureSystemProxyFailure};
  }

  try {
    createDefaultRouteThroughTun();
  } catch (exception& e) {
    logger.error("failed to route network traffic through outline tun interfacet: ", e.what());
    resetFailRoutingAttempt(TRAFFIC_ROUTED_THROUGH_TUN);
    throw std::system_error{ErrorCode::kConfigureSystemProxyFailure};
  }

  try {
    toggleIPv6(false);
  } catch (exception& e) {
    // We are going to fail if we are not able to disable all IPV6 routes.
    logger.error("possible net traffic leakage. failed to disable IPv6 routes on all interfaces: " +
                 string(e.what()));
    resetFailRoutingAttempt(IPV6_ROUTING_FAILED);
    throw std::system_error{ErrorCode::kConfigureSystemProxyFailure};
  }

  try {
    enforceGloballyReachableDNS();

  } catch (exception& e) {
    // this might not break routing through outline if the DNS is in the same
    // internal network or is a globally reachable. Notheless the user is
    // vulnerable to DNS poisening so we are going to reverse everthing
    logger.error("failed to enforce outline DNS server: ", e.what());
    resetFailRoutingAttempt(OUTLINE_DNS_SET);
    throw std::system_error{ErrorCode::kConfigureSystemProxyFailure};
  }

  routing_status_ = OutlineConnectionStatus::kRoutingThroughOutline;
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
  // TODO: we are going to delete all default routes
  // but the correct way of dealing with is to find the minimum
  // metric of all default routing if it 0, then bump up all routing
  // so no one has 0 routing, then setup our routing equal to min - 1

  // try to see if there is still default route in the table
  while (checkRoutingTableForSpecificRoute("default via")) {
    // routing table has "default via" string, delete it
    auto result = executeIPRoute({ "del", "default" });

    if (!isSuccessful(result)) {
      logger.error(result.first);
      throw runtime_error("failed to delete default route from the routing table");
    }
  }
}

bool OutlineProxyController::checkRoutingTableForSpecificRoute(std::string routePart) {
  auto routingTableResult = executeIPRoute({});  // just empty args
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
  auto result = executeIPRoute({
    "add", "default",
    "via", tunInterfaceRouterIp,
    "metric", c_normal_traffic_priority_metric
  });
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

  auto result = executeIPRoute({
    "add", outlineServerIP,
    "via", routingGatewayIP,
    "metric", c_proxy_priority_metric
  });
  if (!isSuccessful(result)) {
    logger.error(result.first);
    throw runtime_error("failed to create route for outline proxy");
  }
}

void OutlineProxyController::toggleIPv6(bool IPv6Status) {
  // TODO: Don't enable everything keep track of what was enabled before

  std::string IPv6Disabled = (IPv6Status) ? "0" : "1";

  auto sysctlResultAll = executeSysctl({
    "-w", "net.ipv6.conf.all.disable_ipv6=" + IPv6Disabled
  });

  auto sysctlResultDefault = executeSysctl({
    "-w", "net.ipv6.conf.default.disable_ipv6=" + IPv6Disabled
  });

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

  routing_status_ = OutlineConnectionStatus::kRoutingThroughDefaultGateway;
}

OutputAndStatus OutlineProxyController::executeSysctl(const CommandArguments &args) {
  return executeCommand(sysctlCommand, "", args);
}

void OutlineProxyController::routeDirectly() {
  logger.info("attempting to dismantle routing through outline server");
  if (routing_status_ == OutlineConnectionStatus::kRoutingThroughDefaultGateway) {
    logger.warn("it does not seem that we are routing through outline server");
  }
  routing_status_ = OutlineConnectionStatus::kConfiguringRouting;

  try {
    deleteAllDefaultRoutes();
  } catch (const exception& e) {
    logger.error("failed to delete the route through outline proxy " + string(e.what()));
    // this might be because our route got deleted, we are going to add the
    // original default route nonetheless
  }

  try {
    if (routingGatewayIP.empty()) {
      logger.warn("default routing gateway is unknown");
      detectBestInterfaceIndex();
    }
    createDefaultRouteThroughGateway();
  } catch (const exception& e) {
    logger.error("failed to make a default route through the network gateway: " + string(e.what()));
    // the old routingGatewayIP is invalid (might because NIC is turned off), just clear it and
    // hopefully next time we can get a new default gateway IP
    routingGatewayIP.clear();
  }

  try {
    deleteOutlineServerRouting();
  } catch (const exception& e) {
    logger.warn("unable to delete priority route for outline proxy: " + string(e.what()));
  }

  try {
    toggleIPv6(true);
  } catch (const exception& e) {
    logger.error("failed to enable IPv6 for all interfaces:" + string(e.what()));
  }

  try {
    restoreDNSSetting();
  } catch (const exception& e) {
    logger.warn("unable restoring DNS configuration " + string(e.what()));
  }

  routing_status_ = OutlineConnectionStatus::kRoutingThroughDefaultGateway;
  logger.info("now routing through the network default gateway");
}

void OutlineProxyController::createDefaultRouteThroughGateway() {
  auto result = executeIPRoute({
    "add", "default",
    "via", routingGatewayIP
  });
  if (!isSuccessful(result)) {
    logger.error(result.first);
    throw runtime_error("failed to create back the route through the network default gateway");
  }
}

void OutlineProxyController::deleteOutlineServerRouting() {
  // first we check if such a route exists
  if (checkRoutingTableForSpecificRoute(outlineServerIP + " via")) {
    auto result = executeIPRoute({ "del", outlineServerIP });
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
    try {
      OutputAndStatus tunDeviceAdditionResult = executeIPTunTap({
        "del", "dev", tunInterfaceName,
        "mode", "tun"
      });
    } catch (exception& e) {
      logger.warn("failed to delete outline tun interface: " + string(e.what()));
    }
  }
}

OutputAndStatus OutlineProxyController::executeIPCommand(const CommandArguments &args) {
  return executeCommand(IPCommand, "", args);
}

OutputAndStatus OutlineProxyController::executeIPAddress(const CommandArguments &args) {
  return executeCommand(IPCommand, IPAddressSubCommand, args);
}

std::string OutlineProxyController::getTunDeviceName() { return tunInterfaceName; }

OutlineProxyController::~OutlineProxyController() noexcept {
  try {
    if (routing_status_ != OutlineConnectionStatus::kRoutingThroughDefaultGateway) {
      routeDirectly();
    }
    deleteOutlineTunDev();
  } catch (...) {
    // destructors must not throw exception
  }
}
