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
#include <string>

#include "catch.hpp"

#define private public
#include "../outline_proxy_controller.h"

using namespace std;
using namespace outline;


namespace testFixtures {
    const string bestInterface = "wlp4s0";
    const string randomHost = "54.243.197.34";
}

TEST_CASE("Detectng Best interface index") {
    OutlineProxyController testOutlineProxyController; //detectBestInterfaceIndex is called in the constructor

    REQUIRE(testOutlineProxyController.clientToServerRoutingInterface == testFixtures::bestInterface);
    
}

TEST_CASE("verifying routing through a random host") {
    OutlineProxyController testOutlineProxyController;

    testOutlineProxyController.routeThroughOutline();

    map<string,string> getRouteCommand;

    getRouteCommand["get"] = testFixtures::randomHost;
    string routingData = testOutlineProxyController.executeIPRoute(getRouteCommand);

    REQUIRE(testOutlineProxyController.getParamValueInResult(routingData, "via") == testOutlineProxyController.tunInterfaceRouterIp);

    getRouteCommand["get"] = testOutlineProxyController.outlineServerIP;
    routingData = testOutlineProxyController.executeIPRoute(getRouteCommand);

    REQUIRE(testOutlineProxyController.getParamValueInResult(routingData, "via") == testOutlineProxyController.routingGatewayIP);

}
