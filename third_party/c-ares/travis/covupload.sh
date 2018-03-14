#!/bin/sh
set -e
if [ "$BUILD_TYPE" = "coverage" ]; then
    coveralls --gcov /usr/bin/gcov-4.8 --gcov-options '\-lp'
fi
