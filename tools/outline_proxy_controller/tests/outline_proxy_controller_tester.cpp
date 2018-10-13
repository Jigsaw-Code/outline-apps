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
#define CATCH_CONFIG_MAIN  // This tells Catch to provide a main() - only do this in one cpp file
#include <map>
#include <regex>
#include <string>

#include "catch.hpp"

#define private public
#include "../outline_proxy_controller.h"

using namespace std;
using namespace outline;

namespace testFixtures {
const string bestInterface = "wlp4s0";
const string randomHost = "54.243.197.34";
}  // namespace testFixtures

TEST_CASE("Detectng Best interface index") {
  OutlineProxyController
      testOutlineProxyController;  // detectBestInterfaceIndex is called in the constructor

  REQUIRE(testOutlineProxyController.clientToServerRoutingInterface == testFixtures::bestInterface);
}

TEST_CASE("Tun device creation") {
  OutlineProxyController testOutlineProxyController;  // device gets created on construction

  REQUIRE(testOutlineProxyController.outlineTunDeviceExsits());
}

TEST_CASE("Tun device gets deleted on delete") {
  OutlineProxyController testOutlineProxyController;

  testOutlineProxyController.deleteOutlineTunDev();
  // REQUIRE(!testOutlineProxyController.outlineTunDeviceExsits());
}

TEST_CASE("Tun device gets the expected IP") {
  OutlineProxyController testOutlineProxyController;

  SubCommand getRouteCommand;

  getRouteCommand.push(SubCommandPart("show", testOutlineProxyController.tunInterfaceName));
  auto result = testOutlineProxyController.executeIPAddress(getRouteCommand);

  REQUIRE(testOutlineProxyController.isSuccessful(result));
  string AddressInfo = result.first;

  std::regex IPRegex(testOutlineProxyController.tunInterfaceIp, std::regex_constants::ECMAScript);
  REQUIRE(std::regex_search(AddressInfo, IPRegex));
}

TEST_CASE("verifying routing to a random host through outline") {
  OutlineProxyController testOutlineProxyController;

  testOutlineProxyController.routeThroughOutline(testOutlineProxyController.outlineServerIP);

  SubCommand getRouteCommand;

  getRouteCommand.push(SubCommandPart("get", testFixtures::randomHost));
  auto result = testOutlineProxyController.executeIPRoute(getRouteCommand);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  string routingData = result.first;

  REQUIRE(testOutlineProxyController.getParamValueInResult(routingData, "via") ==
          testOutlineProxyController.tunInterfaceRouterIp);

  getRouteCommand.pop();
  getRouteCommand.push(SubCommandPart("get", testOutlineProxyController.outlineServerIP));
  result = testOutlineProxyController.executeIPRoute(getRouteCommand);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  routingData = result.first;

  REQUIRE(testOutlineProxyController.getParamValueInResult(routingData, "via") ==
          testOutlineProxyController.routingGatewayIP);

  testOutlineProxyController.routeDirectly();
}

TEST_CASE("verifying a normal routing after disconnect") {
  OutlineProxyController testOutlineProxyController;

  testOutlineProxyController.routeThroughOutline(testOutlineProxyController.outlineServerIP);

  SubCommand getRouteCommand;

  getRouteCommand.push(SubCommandPart("get", testFixtures::randomHost));
  auto result = testOutlineProxyController.executeIPRoute(getRouteCommand);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  string routingData = result.first;

  REQUIRE(testOutlineProxyController.getParamValueInResult(routingData, "via") ==
          testOutlineProxyController.tunInterfaceRouterIp);

  getRouteCommand.pop();
  getRouteCommand.push(SubCommandPart("get", testOutlineProxyController.outlineServerIP));
  result = testOutlineProxyController.executeIPRoute(getRouteCommand);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  routingData = result.first;

  REQUIRE(testOutlineProxyController.getParamValueInResult(routingData, "via") ==
          testOutlineProxyController.routingGatewayIP);

  testOutlineProxyController.routeDirectly();

  getRouteCommand.pop();
  getRouteCommand.push(SubCommandPart("get", testFixtures::randomHost));
  result = testOutlineProxyController.executeIPRoute(getRouteCommand);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  routingData = result.first;

  REQUIRE(testOutlineProxyController.getParamValueInResult(routingData, "via") ==
          testOutlineProxyController.routingGatewayIP);
}

TEST_CASE("verifying to a random host through outline and normal routing after disconnect") {
  OutlineProxyController testOutlineProxyController;

  testOutlineProxyController.routeThroughOutline(testOutlineProxyController.outlineServerIP);

  SubCommand getRouteCommand;

  getRouteCommand.push(SubCommandPart("get", testFixtures::randomHost));
  auto result = testOutlineProxyController.executeIPRoute(getRouteCommand);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  string routingData = result.first;

  REQUIRE(testOutlineProxyController.getParamValueInResult(routingData, "via") ==
          testOutlineProxyController.tunInterfaceRouterIp);

  getRouteCommand.pop();
  getRouteCommand.push(SubCommandPart("get", testOutlineProxyController.outlineServerIP));
  result = testOutlineProxyController.executeIPRoute(getRouteCommand);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  routingData = result.first;

  REQUIRE(testOutlineProxyController.getParamValueInResult(routingData, "via") ==
          testOutlineProxyController.routingGatewayIP);

  testOutlineProxyController.routeDirectly();

  getRouteCommand.pop();
  getRouteCommand.push(SubCommandPart("get", testFixtures::randomHost));
  result = testOutlineProxyController.executeIPRoute(getRouteCommand);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  routingData = result.first;

  REQUIRE(testOutlineProxyController.getParamValueInResult(routingData, "via") ==
          testOutlineProxyController.routingGatewayIP);
}

TEST_CASE("verifying ipv6 is disbaled when outline is enabled") {
  OutlineProxyController testOutlineProxyController;

  testOutlineProxyController.routeThroughOutline(testOutlineProxyController.outlineServerIP);

  SubCommand getSystemStatusCommand;

  getSystemStatusCommand.push(SubCommandPart("-a", ""));
  auto result = testOutlineProxyController.executeSysctl(getSystemStatusCommand);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  string systemStatus = result.first;

  std::regex enabledIPv6Regex("disable_ipv6 = 0", std::regex_constants::ECMAScript);
  REQUIRE(std::regex_search(systemStatus, enabledIPv6Regex) == false);

  testOutlineProxyController.routeDirectly();
}

TEST_CASE("verify dns setting gets set and reset") {
  OutlineProxyController testOutlineProxyController;

  SubCommand nslookupDomain;

  nslookupDomain.push(SubCommandPart("google.com", ""));

  // we just keep the first line
  auto result = testOutlineProxyController.executeCommand("nslookup", nslookupDomain);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  auto originalDNSServer = result.first.substr(0, result.first.find("\n"));

  testOutlineProxyController.backupDNSSetting();
  testOutlineProxyController.enforceGloballyReachableDNS();

  result = testOutlineProxyController.executeCommand("nslookup", nslookupDomain);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  auto outlineDNSServer = result.first.substr(0, result.first.find("\n"));

  REQUIRE(outlineDNSServer == "Server:\t\t" + testOutlineProxyController.outlineDNSServer);

  testOutlineProxyController.restoreDNSSetting();

  result = testOutlineProxyController.executeCommand("nslookup", nslookupDomain);
  REQUIRE(testOutlineProxyController.isSuccessful(result));
  auto restoredDNSServer = result.first.substr(0, result.first.find("\n"));

  REQUIRE(restoredDNSServer == originalDNSServer);
}
