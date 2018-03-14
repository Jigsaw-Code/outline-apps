# Potatso

This repository contains an Xcode project to build PacketProcessor, a dependency of the Outline macOS/iOS clients.
PacketProcessor is a framework that encapsulates tun2socks in order to forward TCP and UDP traffic to a SOCKS server.


## Prerequisites

- Xcode ≥ 8.3
- [CocoaPods](https://cocoapods.org/) (`brew install cocoapods`)

## Build

To build the PacketProcessor frameworks for macOS and iOS, run:

```
yarn do third_party/Potatso/build
```

This will install `PacketProcessor_[iOS|macOS].framework` to `third_party/Potatso/frameworks`.


## Sources
The code in this repository is adapted from [Potatso](https://github.com/haxpor/Potatso). We have used its Xcode project structure and configuration as a starting point for this repository. We have removed all application logic, UI, tests, and additional dependencies from the source.

**TODO: build from original [tun2socks](https://github.com/ambrop72/badvpn/) repository.**
