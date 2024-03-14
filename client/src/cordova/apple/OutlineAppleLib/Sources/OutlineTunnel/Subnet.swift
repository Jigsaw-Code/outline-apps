// Copyright 2018 The Outline Authors
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

import Foundation

// Represents an IP subnetwork.
// Note that this class and its non-private properties must be public in order to be visible to the ObjC
// target of the OutlineAppleLib Swift Package.
@objcMembers
public class Subnet: NSObject {
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
    let mask = (0xffffffff as UInt32) << (32 - prefix);
    self.mask = mask.IPv4String()
  }
}

extension UInt32 {
  // Returns string representation of the integer as an IP address.
  public func IPv4String() -> String {
    let ip = self
    let a = UInt8((ip>>24) & 0xff)
    let b = UInt8((ip>>16) & 0xff)
    let c = UInt8((ip>>8) & 0xff)
    let d = UInt8(ip & 0xff)
    return "\(a).\(b).\(c).\(d)"
  }
}

