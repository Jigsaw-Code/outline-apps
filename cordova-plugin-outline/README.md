# cordova-plugin-outline

Cordova plugin that implements a system-wide VPN to tunnel device traffic over [Shadowsocks](https://shadowsocks.org/).

## Supported Platforms

This plugin supports Android, iOS, and macOS.

### Android

This plugin targets Android devices running Lollipop (API 22), or higher.

### Apple

This plugin targets Apple devices running iOS 11.0+ and macOS/OS X 10.11+.

## tun2socks

Native platforms consume [outline-go-tun2socks](https://github.com/Jigsaw-Code/outline-go-tun2socks) as a library to assemble IP traffic and implement the Shadowsocks protocol: it receives all of the device’s traffic through the VPN network interface (TUN) and forwards it to a [Shadowsocks proxy server](https://github.com/Jigsaw-Code/outline-ss-server).

## Additional Apple Dependencies

We use the [Carthage dependency manager](https://github.com/Carthage/Carthage) to install third party dependencies: sentry-cocoa and CocoaLumberjack.

To upgrade the Carthage dependencies:

- Install Carthage by running `brew install carthage`.
- Update the framework's version in Cartfile (e.g. `github "getsentry/sentry-cocoa" "x.y.z"`).
- From the dependency directory (e.g. `third_party/CocoaLumberjack`), run `make`. This will build the frameworks for macOS and iOS.
- Add Cartfile and Cartfile.resolved to git and commit the changes.
