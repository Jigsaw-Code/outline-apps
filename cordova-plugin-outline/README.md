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


## JavaScript API

```ts
declare namespace cordova.plugins.outline {

  const log: {
    // Initializes the error reporting framework with the supplied credentials.
    initialize(apiKey: string): Promise<void>;

    // Sends previously captured logs and events to the error reporting framework.
    // Associates the report to the provided unique identifier.
    send(uuid: string): Promise<void>;
  }

  const net: {
    // Returns whether a server is reachable over TCP by attempting to establish
    // a socket to |host:port|.
    isReachable(host: string, port: number): Promise<boolean>;
  }

  // Represents a VPN tunnel to a proxy through the plugin.
  class Tunnel {
    // Creates a new instance with |id|.
    constructor(public readonly id: string);

    // Starts the VPN service, and tunnels all the traffic to a Shadowsocks proxy
    // server as dictated by its configuration. If there is another running
    // instance, broadcasts a disconnect event and stops the active tunnel.
    // In such case, the VPN is not torn down.
    start(config: ShadowsocksConfig): Promise<void>;

    // Stops the tunnel and VPN service.
    stop(): Promise<void>;

    // Returns whether the tunnel instance is active.
    isRunning(): Promise<boolean>;

    // Sets a listener, to be called when the VPN tunnel status changes.
    onStatusChange(listener: (status: TunnelStatus) => void): void;
  }
}
```

## Additional Apple Dependencies

We use the [Carthage dependency manager](https://github.com/Carthage/Carthage) to install third party dependencies: sentry-cocoa and CocoaLumberjack.

To upgrade the Carthage dependencies:
* Install Carthage by running `brew install carthage`.
* Update the framework's version in Cartfile (e.g. `github "getsentry/sentry-cocoa" "x.y.z"`).
* Run `carthage update`. This will fetch the frameworks for macOS and iOS.
* Copy the frameworks to the `cordova-plugin-outline/apple/lib` (e.g. `cp -R Carthage/Build/iOS/Sentry.framework cordova-plugin-outline/apple/lib/Sentry/ios/`)
* Add Cartfile and Cartfile.resolved to git and commit the changes.

