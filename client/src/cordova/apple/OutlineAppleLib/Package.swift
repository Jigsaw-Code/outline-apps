// swift-tools-version: 5.6
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "OutlineAppleLib",
    defaultLocalization: "en",
    platforms: [
        // CocoaLumberjack 3.8.0 dropped support for iOS < 11 and macOS < 10.13.
        // See https://github.com/CocoaLumberjack/CocoaLumberjack/releases/tag/3.8.0.
        // These cannot be upgraded without also upgrading the entire project.
       .iOS(.v13),
       .macOS(.v10_14),
    ],
    products: [
        .library(
            name: "OutlineAppleLib",
            targets: ["OutlineSentryLogger", "OutlineTunnel", "OutlineCatalystApp", "OutlineNotification"]
        ),
        // Expose OutlineTunnel so the VpnExtension can use it.
        .library(
            name: "OutlineTunnel",
            targets: ["OutlineTunnel"]
        ),
        .library(
            name: "OutlineLauncher",
            targets: ["OutlineLauncher"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/CocoaLumberjack/CocoaLumberjack.git", from: "3.8.5"),
        .package(url: "https://github.com/getsentry/sentry-cocoa", from: "8.26.0"),
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
            ]
        ),
        .testTarget(
            name: "OutlineTunnelTest",
            dependencies: ["OutlineTunnel"]
        ),
    ]
)
