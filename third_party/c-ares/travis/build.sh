#!/bin/sh
set -e

if [ "$BUILD_TYPE" != "cmake" ]; then
    ./buildconf
    $SCAN_WRAP ./configure --disable-symbol-hiding --enable-expose-statics --enable-maintainer-mode --enable-debug $CONFIG_OPTS
    $SCAN_WRAP make
else
    mkdir cmakebld
    cd cmakebld
    cmake -DCMAKE_BUILD_TYPE=DEBUG -DCARES_STATIC=ON -DCARES_STATIC_PIC=ON ..
    make
    ./bin/adig www.google.com
    ./bin/acountry www.google.com
    ./bin/ahost www.google.com
    cd ..
fi
