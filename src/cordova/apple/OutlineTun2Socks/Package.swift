// swift-tools-version: 5.7
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "OutlineTun2Socks",
    products: [
        .library(
            name: "OutlineTun2Socks",
            targets: ["Tun2socks", "OutlineDependencies"]),
    ],
    dependencies: [
      .package(url: "https://github.com/CocoaLumberjack/CocoaLumberjack.git", from: "3.8.0"),
      .package(url: "https://github.com/getsentry/sentry-cocoa", from: "7.31.5"),
    ],
    targets: [
        .target(
            name: "OutlineDependencies",
            dependencies:
                ["CocoaLumberjack",
                 .product(name: "CocoaLumberjackSwift", package: "CocoaLumberjack"),
                 .product(name: "Sentry", package: "sentry-cocoa")
                ]
        ),
        .binaryTarget(
            name: "Tun2socks",
            url: "https://github.com/Jigsaw-Code/outline-go-tun2socks/releases/download/outline-v3.0.0/apple.zip",
            checksum: "14d4ced347b3c6a4bf6264c7b33e4899b6e7b2885a3dc4fc0d9b2c3c49159791"
        )
    ]
)
