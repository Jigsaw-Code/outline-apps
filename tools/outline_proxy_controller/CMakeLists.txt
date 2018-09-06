cmake_minimum_required (VERSION 2.6)
project (OutlineProxyController)

# configure a header file to pass some of the CMake settings
# to the source code
configure_file (
  "${PROJECT_SOURCE_DIR}/OutlineProxyControllerConfig.h.in"
  "${PROJECT_BINARY_DIR}/OutlineProxyControllerConfig.h"
  )

set(CMAKE_BUILD_TYPE "Debug")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++14 -Wall -O0 -ggdb ${SANITIZE}")

#add_executable(OutlineProxyController outline_proxy_controller.cpp)
add_executable(OutlineProxyControllerTester outline_proxy_controller.cpp
                                            tests/outline_proxy_controller_tester.cpp)
