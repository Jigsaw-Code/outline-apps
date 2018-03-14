## Shadowsocks iOS & macOS Framework

This collection of scripts and version-controlled binaries build shadowsocks-libev as static frameworks for iOS and macOS. shadowsocks-libev and its dependencies (libev, pcre, mbedtls, libsodium, c-ares), have been compiled as static libraries for the following architectures: x86_64 (macOS), armv7, armv7s, arm64 (iOS) - the iOS simulator is not supported.

### Pre-requisites

macOS 10.12 system with Xcode >=8.2 and Xcode command line tools installed.

### Directory structure
We keep each static library in its own directory, which has the following structure - in this example libev:
```
libev/
|__ build_libev.sh
|__ build_action.sh  # Convenience script for building library through yarn
|__ lib/libev.a  # FAT binary
|__ include  # Header files
```

The `Shadowsocks` subdirectory contains an Xcode project to build static frameworks for iOS and macOS. The Xcode project file relies on this directory structure.

### Update
The `build_action.sh` scripts enable us to recompile each static library through
yarn. Update the version number in the build_lib*.sh script. Anywhere in the project root, run:

```bash
LIBRARY=[libcares | libev | libpcre | libsodium | libmbedtls | libshadowsocks-libev]
yarn do cordova-plugin-outline/apple/lib/Shadowsocks/$LIBRARY/build
```

To rebuild the Shadowsocks frameworks, run:
```bash
yarn do third_party/shadowsocks-libev/apple/build
```

If there is a change in version number, commit changes to the build scripts.
