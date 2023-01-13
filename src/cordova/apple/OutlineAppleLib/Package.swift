// swift-tools-version: 5.6
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "OutlineAppleLib",
    products: [
        .library(
            name: "OutlineAppleLib",
            targets: ["Tun2socks", "OutlineTunnel", "PacketTunnelProvider"]),
    ],
    dependencies: [
        .package(url: "https://github.com/CocoaLumberjack/CocoaLumberjack.git", exact: "3.7.4"),
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
            path: "./Sources/PacketTunnelProviderSources/",
            cSettings: [
                .headerSearchPath("Internal"),
            ]
        ),
        .target(
            name: "OutlineTunnel",
            dependencies: [],
            path: "Sources/OutlineTunnelSources"
        ),
        .binaryTarget(
            name: "Tun2socks",
            url: "https://github.com/Jigsaw-Code/outline-go-tun2socks/releases/download/outline-v3.0.0/apple.zip",
            checksum: "14d4ced347b3c6a4bf6264c7b33e4899b6e7b2885a3dc4fc0d9b2c3c49159791"
        ),
        .testTarget(
            name: "OutlineTunnelTest",
            dependencies: ["OutlineTunnel", "PacketTunnelProvider"]),
    ]
)
