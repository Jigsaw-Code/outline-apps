set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED TRUE)
set(CMAKE_CXX_EXTENSIONS FALSE)

enable_language(CXX)

find_package(Threads)

# create target to access and use internal cares library
set(ARES_SRC_DIR ${c-ares_SOURCE_DIR})
add_library(caresinternal INTERFACE)
target_compile_definitions(caresinternal INTERFACE HAVE_CONFIG_H=1)
target_include_directories(caresinternal INTERFACE ${ARES_SRC_DIR})
target_link_libraries(caresinternal INTERFACE ${PROJECT_NAME})

# Google Test and Mock
set(GMOCK_DIR gmock-1.8.0)
add_library(gmock STATIC
  ${GMOCK_DIR}/gmock-gtest-all.cc
  ${GMOCK_DIR}/gmock/gmock.h
  ${GMOCK_DIR}/gtest/gtest.h
)
target_include_directories(gmock PUBLIC SYSTEM ${GMOCK_DIR})
target_link_libraries(gmock PRIVATE ${CMAKE_THREAD_LIBS_INIT})

# test targets

transform_makefile_inc("Makefile.inc" "${CMAKE_CURRENT_BINARY_DIR}/Makefile.inc.cmake")
include(${CMAKE_CURRENT_BINARY_DIR}/Makefile.inc.cmake)

configure_file(${ARES_SRC_DIR}/ares_config.h.cmake config.h)

add_executable(arestest ${TESTSOURCES} ${TESTHEADERS})
target_include_directories(arestest PRIVATE ${CMAKE_CURRENT_BINARY_DIR})
target_link_libraries(arestest PRIVATE caresinternal gmock)

add_executable(aresfuzz ${FUZZSOURCES})
target_link_libraries(aresfuzz PRIVATE caresinternal)

add_executable(aresfuzzname ${FUZZNAMESOURCES})
target_link_libraries(aresfuzzname PRIVATE caresinternal)

add_executable(dnsdump ${DUMPSOURCES})
target_link_libraries(dnsdump PRIVATE caresinternal)

# register tests

add_test(NAME arestest COMMAND $<TARGET_FILE:arestest>)

file(GLOB_RECURSE FUZZINPUT_FILES RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}/fuzzinput" "fuzzinput/*")
add_test(
  NAME aresfuzz
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/fuzzinput"
  COMMAND $<TARGET_FILE:aresfuzz> ${FUZZINPUT_FILES}
)

file(GLOB_RECURSE FUZZNAMES_FILES RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}/fuzznames" "fuzznames/*")
add_test(
  NAME aresfuzzname
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/fuzznames"
  COMMAND $<TARGET_FILE:aresfuzzname> ${FUZZNAMES_FILES}
)
