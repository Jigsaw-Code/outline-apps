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

We use [Swift Packages](https://developer.apple.com/documentation/xcode/swift-packages) for third party dependencies: sentry-cocoa and CocoaLumberjack.

To upgrade the Swift Package dependencies, update the `version` field for the corresponding package under the `XCRemoteSwiftPackageReference` section in the Outline.pbxproj file for [macOS](https://github.com/Jigsaw-Code/outline-client/blob/master/src/cordova/apple/xcode/macos/Outline.xcodeproj/project.pbxproj) or [iOS](https://github.com/Jigsaw-Code/outline-client/blob/master/src/cordova/apple/xcode/ios/Outline.xcodeproj/project.pbxproj).

Alternatively, open the xcworkspace file for the curresponding OS, and update the packages via the XCode UI.
