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
            url: "https://github.com/Jigsaw-Code/outline-go-tun2socks/releases/download/v3.1.0/apple.zip",
            checksum: "dcdd8ea539426858fccc8b3ee2f771297c0edde6d4f9f8f76f7148fee397d784"
        ),
        .testTarget(
            name: "OutlineTunnelTest",
            dependencies: ["OutlineTunnel", "PacketTunnelProvider"]),
    ]
)
