// swift-tools-version: 5.6
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "OutlineAppleLib",
    products: [
        .library(
            name: "OutlineAppleLib",
            targets: ["Tun2socks", "OutlineTunnel"]),
        .library(
            name: "PacketTunnelProvider",
            targets: ["PacketTunnelProvider"]),
    ],
    dependencies: [
        .package(url: "https://github.com/CocoaLumberjack/CocoaLumberjack.git", from: "3.7.4"),
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
