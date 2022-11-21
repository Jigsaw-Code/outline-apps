# Copyright 2018 The Outline Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

cmake_minimum_required (VERSION 3.10)
project (OutlineProxyController VERSION 0.1.0)
set(BOOST_VERSION 1.80)
set(Boost_USE_STATIC_LIBS ON)
find_package(Boost ${BOOST_VERSION} REQUIRED COMPONENTS json
                                                        regex
                                                        program_options
                                                        filesystem
                                                        coroutine
                                                        context)

# configure a header file to pass some of the CMake settings
# to the source code
configure_file (
  "${PROJECT_SOURCE_DIR}/OutlineProxyControllerConfig.h.in"
  "${PROJECT_SOURCE_DIR}/OutlineProxyControllerConfig.h"
  )

set(CMAKE_BUILD_TYPE "Release")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -pthread -Wall -ggdb ${SANITIZE}")

include_directories(
    "${Boost_INCLUDE_DIR}")

######################################
add_executable(OutlineProxyController
    logger.cpp
    network_monitor.cpp
    outline_controller_server.cpp
    outline_daemon.cpp
    outline_error.cpp
    outline_proxy_controller.cpp
    )

target_compile_features(OutlineProxyController PRIVATE cxx_std_20)
target_compile_options(OutlineProxyController PRIVATE "-fcoroutines")
target_link_libraries(OutlineProxyController
    -static-libstdc++
    ${Boost_LIBRARIES})
