// swift-tools-version: 5.6
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "OutlineTun2Socks",
    products: [
        .library(
            name: "OutlineTun2Socks",
            targets: ["Tun2socks"]),
    ],
    dependencies: [
    ],
    targets: [
        .binaryTarget(
            name: "Tun2socks",
            url: "https://github.com/Jigsaw-Code/outline-go-tun2socks/releases/download/outline-v3.0.0/apple.zip",
            checksum: "14d4ced347b3c6a4bf6264c7b33e4899b6e7b2885a3dc4fc0d9b2c3c49159791"
        )
    ]
)
