// swift-tools-version: 5.6
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "OutlineAppleLib",
    defaultLocalization: "en",
    products: [
        .library(
            name: "OutlineAppleLib",
            targets: ["Tun2socks", "OutlineSentryLogger", "OutlineTunnel", "OutlineCatalystApp", "OutlineNotification"]
        ),
        .library(
            name: "OutlineLauncher",
            targets: ["OutlineLauncher"]
        ),
        .library(
            name: "OutlineAppKitBridge",
            targets: ["OutlineAppKitBridge"]
        ),
        .library(
            name: "PacketTunnelProvider",
            targets: ["PacketTunnelProvider"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/CocoaLumberjack/CocoaLumberjack.git", from: "3.7.4"),
        .package(url: "https://github.com/getsentry/sentry-cocoa", from: "7.31.3"),
    ],
    targets: [
        .target(
            name: "OutlineLauncher",
            dependencies:
            ["CocoaLumberjack",
             .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
             "OutlineCatalystApp"]
        ),
        .target(
            name: "OutlineCatalystApp",
            dependencies: [
                "OutlineAppKitBridge",
                .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
            ]
        ),
        .target(
            name: "OutlineAppKitBridge",
            dependencies: [
                .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
                "OutlineNotification",
            ]
        ),
        .target(
            name: "PacketTunnelProvider",
            dependencies:
            ["CocoaLumberjack",
             .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
             "Tun2socks",
             "OutlineTunnel"],
            cSettings: [
                .headerSearchPath("Internal"),
            ]
        ),
        .target(name: "OutlineNotification"),
        .target(
            name: "OutlineSentryLogger",
            dependencies: [
                .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
                .product(name: "Sentry", package: "sentry-cocoa"),
            ]
        ),
        .target(
            name: "OutlineTunnel",
            dependencies: [
                .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
                "Tun2socks",
            ]
        ),
        .binaryTarget(
            name: "Tun2socks",
            url: "https://github.com/Jigsaw-Code/outline-go-tun2socks/releases/download/v3.4.0/apple.zip",
            checksum: "6c6880fa7d419a5fddc10588edffa0b23b5a44f0f840cf6865372127285bcc42"
        ),
        .testTarget(
            name: "OutlineTunnelTest",
            dependencies: ["OutlineTunnel", "PacketTunnelProvider"]
        ),
    ]
)
