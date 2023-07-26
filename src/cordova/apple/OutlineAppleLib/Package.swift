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
            name: "OutlineCatalystApp",
            targets: ["OutlineCatalystApp"]),
        .library(
            name: "OutlineLauncher",
            targets: ["OutlineLauncher"]),
        .library(
            name: "OutlineAppKitBridge",
            targets: ["OutlineAppKitBridge"]),
        .library(
            name: "PacketTunnelProvider",
            targets: ["PacketTunnelProvider"]),
    ],
    dependencies: [
        .package(url: "https://github.com/CocoaLumberjack/CocoaLumberjack.git", from: "3.7.4"),
        .package(url: "https://github.com/getsentry/sentry-cocoa", from: "7.31.3"),
    ],
    targets: [
        .target(name: "OutlineShared"),
        .target(
            name: "OutlineLauncher",
            dependencies:
                ["CocoaLumberjack",
                 .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
                 "Tun2socks",
                 "OutlineTunnel",
                 "OutlineCatalystApp"
                ]
        ),
        .target(
            name: "OutlineCatalystApp",
            dependencies: [
                "OutlineShared",
                .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
            ]
        ),
        .target(
            name: "OutlineAppKitBridge",
            dependencies: [
                "OutlineShared",
                .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
            ]
        ),
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
            url: "https://github.com/Jigsaw-Code/outline-go-tun2socks/releases/download/v3.1.0/apple.zip",
            checksum: "78f291482da13fd035de19d21a075048407658aab077fdeb23ce435f33cec3a2"
        ),
        .testTarget(
            name: "OutlineTunnelTest",
            dependencies: ["OutlineTunnel", "PacketTunnelProvider"]),
    ]
)
