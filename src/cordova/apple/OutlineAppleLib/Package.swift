// swift-tools-version: 5.6
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "OutlineAppleLib",
    products: [
        .library(
            name: "OutlineAppleLib",
            targets: ["Tun2socks", "OutlineSentryLogger", "OutlineTunnel"]),
        .library(
            name: "PacketTunnelProvider",
            targets: ["PacketTunnelProvider"]),
    ],
    dependencies: [
        .package(url: "https://github.com/CocoaLumberjack/CocoaLumberjack.git", from: "3.7.4"),
        .package(url: "https://github.com/getsentry/sentry-cocoa", from: "7.31.3"),
    ],
    targets: [
        .target(
            name: "PacketTunnelProvider",
            dependencies:
                ["CocoaLumberjack",
                 .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
                 "Tun2socks",
                 "OutlineTunnel"
                ],
            cSettings: [
                .headerSearchPath("Internal"),
            ]
        ),
        .target(
            name: "OutlineSentryLogger",
            dependencies: [
                .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
                .product(name: "Sentry", package: "sentry-cocoa")
            ]
        ),
        .target(
            name: "OutlineTunnel",
            dependencies: [
                .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
            ]
        ),
        .binaryTarget(
            name: "Tun2socks",
            url: "https://github.com/Jigsaw-Code/outline-go-tun2socks/releases/download/v3.3.0/apple.zip",
            checksum: "ec6d98aef1dc66cd518da38c6b53f47ff8ae330f41e81c8c52e93803e93d9721"
        ),
        .testTarget(
            name: "OutlineTunnelTest",
            dependencies: ["OutlineTunnel", "PacketTunnelProvider"]),
    ]
)
