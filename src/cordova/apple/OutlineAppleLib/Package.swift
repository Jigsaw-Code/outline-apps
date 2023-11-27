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
            dependencies: [
                "CocoaLumberjack",
                .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
                "OutlineCatalystApp",
            ]
        ),
        .target(
            name: "OutlineCatalystApp",
            dependencies: [
                .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
                "OutlineNotification",
            ]
        ),
        .target(
            name: "PacketTunnelProvider",
            dependencies: [
                "CocoaLumberjack",
                .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
                "Tun2socks",
                "OutlineTunnel",
            ],
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
            path: "../../../../build/ios/tun2socks.xcframework"
        ),
        .testTarget(
            name: "OutlineTunnelTest",
            dependencies: ["OutlineTunnel", "PacketTunnelProvider"]
        ),
    ]
)
