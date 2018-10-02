cmake_minimum_required (VERSION 2.6)
project (OutlineProxyController)
set(BOOST_VERSION 1.67)
find_package(Boost ${BOOST_VERSION} REQUIRED COMPONENTS filesystem
                                                        regex
                                                        unit_test_framework
                                                        program_options
                                                        coroutine
                                                        context
                                                        thread
                                                        date_time
                                                        system)

# configure a header file to pass some of the CMake settings
# to the source code
configure_file (
  "${PROJECT_SOURCE_DIR}/OutlineProxyControllerConfig.h.in"
  "${PROJECT_BINARY_DIR}/OutlineProxyControllerConfig.h"
  )

set(CMAKE_BUILD_TYPE "Debug")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++14 -pthread -Wall -O0 -ggdb ${SANITIZE}")

include_directories(
    "${Boost_INCLUDE_DIR}")

##############################
add_executable(OutlineProxyControllerTester outline_proxy_controller.cpp
                                            tests/outline_proxy_controller_tester.cpp)

######################################
add_executable(OutlineProxyController
    outline_proxy_controller.cpp
    outline_controller_server.cpp
    outline_daemon.cpp
    )

target_link_libraries(OutlineProxyController
    ${Boost_LIBRARIES}
)
