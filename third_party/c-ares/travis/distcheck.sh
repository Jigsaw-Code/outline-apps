#!/bin/sh
set -e

if [ "$BUILD_TYPE" = "normal" -a "$TRAVIS_OS_NAME" = "linux" ]; then
    ./maketgz 99.98.97
    tar xvf c-ares-99.98.97.tar.gz
    cd c-ares-99.98.97
    ./configure --disable-symbol-hiding --enable-expose-statics --enable-maintainer-mode --enable-debug
    make

    cd test
    make
    $TEST_WRAP ./arestest -v $TEST_FILTER
    cd ..

    cd ..
fi
