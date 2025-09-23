// Copyright 2025 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import CocoaLumberjackSwift
import Foundation
import NetworkExtension

/// Stores related IP settings required to configure the VPN tunnel.
@objc
public class VPNConfig: NSObject {
  public let tunAddress: String
  @objc public let localDnsAddress: String
  @objc public let dnsResolverAddress: String
  public let excludedIpv4Routes: [NEIPv4Route]

  public init(tunIp: String, localDnsIp: String, resolverAddress: String, excludedIpv4Routes: [NEIPv4Route]) {
    self.tunAddress = tunIp
    self.localDnsAddress = localDnsIp
    self.dnsResolverAddress = resolverAddress
    self.excludedIpv4Routes = excludedIpv4Routes
    super.init()
  }

  /// Scans the local network and builds a new VPNConfig whose IP addresses are not used
  @objc
  public static func create() -> VPNConfig {
    let nicAddrs = getNetworkInterfaceAddresses()
    let vpnAddr = selectUnusedVpnAddress(interfaceAddresses: nicAddrs)
    let resolver = kPublicDnsResolvers[0]  // TODO: support multiple DNS resolvers
    let excludes = getExcludedIpv4Routes()
    
    return VPNConfig(
      tunIp: vpnAddr.tun,
      localDnsIp: vpnAddr.dns,
      resolverAddress: resolver,
      excludedIpv4Routes: excludes)
  }

  // MARK: - private helpers

  private struct VpnAddress { let tun, dns: String }

  private static let kVpnSubnetCandidates: [String: VpnAddress] = [
    "10": VpnAddress(tun: "10.111.222.0", dns: "10.111.222.53"),
    "172": VpnAddress(tun: "172.16.9.1", dns: "172.16.9.53"),
    "192": VpnAddress(tun: "192.168.20.1", dns: "192.168.20.53"),
    "169": VpnAddress(tun: "169.254.19.0", dns: "169.254.19.53"),
  ]

  /** Cloudflare, Quad9, and OpenDNS resolver addresses. */
  private static let kPublicDnsResolvers = [
    "1.1.1.1", "9.9.9.9", "208.67.222.222", "208.67.220.220",
  ]

  private static let kExcludedSubnets = [
    "10.0.0.0/8",
    "100.64.0.0/10",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.0.0.0/24",
    "192.0.2.0/24",
    "192.31.196.0/24",
    "192.52.193.0/24",
    "192.88.99.0/24",
    "192.168.0.0/16",
    "192.175.48.0/24",
    "198.18.0.0/15",
    "198.51.100.0/24",
    "203.0.113.0/24",
    "240.0.0.0/4",
  ]

  /** Given the list of known interface addresses, returns two local network IP addresses to use for the VPN. */
  private static func selectUnusedVpnAddress(interfaceAddresses: [String]) -> VpnAddress {
    var candidates = kVpnSubnetCandidates

    for address in interfaceAddresses {
      for subnetPrefix in kVpnSubnetCandidates.keys {
        if address.hasPrefix(subnetPrefix) {
          // The subnet (not necessarily the address) is in use, remove it from our list.
          candidates.removeValue(forKey: subnetPrefix)
        }
      }
    }
    guard !candidates.isEmpty else {
      // Even though there is an interface bound to the subnet candidates, the collision probability
      // with an actual address is low.
      return kVpnSubnetCandidates.randomElement()!.value
    }
    // Select a random subnet from the remaining candidates.
    return candidates.randomElement()!.value
  }

  private static func getExcludedIpv4Routes() -> [NEIPv4Route] {
    var excludedIpv4Routes = [NEIPv4Route]()
    for cidrSubnet in kExcludedSubnets {
      if let subnet = Subnet.parse(cidrSubnet) {
        let route = NEIPv4Route(destinationAddress: subnet.address, subnetMask: subnet.mask)
        excludedIpv4Routes.append(route)
      }
    }
    return excludedIpv4Routes
  }

  /** Returns all IPv4 addresses of all interfaces. */
  private static func getNetworkInterfaceAddresses() -> [String] {
    var interfaces: UnsafeMutablePointer<ifaddrs>?
    var addresses = [String]()

    guard getifaddrs(&interfaces) == 0 else {
      DDLogError("Failed to retrieve network interface addresses")
      return addresses
    }

    var interface = interfaces
    while interface != nil {
      // Only consider IPv4 interfaces.
      if interface!.pointee.ifa_addr.pointee.sa_family == UInt8(AF_INET) {
        let addr = interface!.pointee.ifa_addr!.withMemoryRebound(to: sockaddr_in.self, capacity: 1) {
          $0.pointee.sin_addr
        }
        if let ip = String(cString: inet_ntoa(addr), encoding: .utf8) {
          addresses.append(ip)
        }
      }
      interface = interface!.pointee.ifa_next
    }

    freeifaddrs(interfaces)

    return addresses
  }
}

extension UInt32 {
  // Returns string representation of the integer as an IP address.
  public func IPv4String() -> String {
    let ip = self
    let a = UInt8((ip >> 24) & 0xff)
    let b = UInt8((ip >> 16) & 0xff)
    let c = UInt8((ip >> 8) & 0xff)
    let d = UInt8(ip & 0xff)
    return "\(a).\(b).\(c).\(d)"
  }
}

/**
 Represents an IP subnetwork.
 Note that this class and its non-private properties must be public in order to be visible to the ObjC
 target of the OutlineAppleLib Swift Package.
 */
class Subnet: NSObject {
  // Parses a CIDR subnet into a Subnet object. Returns nil on failure.
  public static func parse(_ cidrSubnet: String) -> Subnet? {
    let components = cidrSubnet.components(separatedBy: "/")
    guard components.count == 2 else {
      NSLog("Malformed CIDR subnet")
      return nil
    }
    guard let prefix = UInt16(components[1]) else {
      NSLog("Invalid subnet prefix")
      return nil
    }
    return Subnet(address: components[0], prefix: prefix)
  }

  public var address: String
  public var prefix: UInt16
  public var mask: String

  public init(address: String, prefix: UInt16) {
    self.address = address
    self.prefix = prefix
    let mask = (0xffff_ffff as UInt32) << (32 - prefix)
    self.mask = mask.IPv4String()
  }
}
