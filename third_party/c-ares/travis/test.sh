#!/bin/sh
set -e
if [ "$BUILD_TYPE" != "ios" -a "$BUILD_TYPE" != "analyse" -a "$BUILD_TYPE" != "cmake" ]; then
    $TEST_WRAP ./adig www.google.com
    $TEST_WRAP ./acountry www.google.com
    $TEST_WRAP ./ahost www.google.com
    cd test
    make
    $TEST_WRAP ./arestest -v $TEST_FILTER
    ./fuzzcheck.sh
    cd ..
fi
