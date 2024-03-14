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

// Persistence layer for a single |OutlineTunnel| object.
// Note that this class and its non-private properties must be public in order to be visible to the ObjC
// target of the OutlineAppleLib Swift Package.
@objcMembers
public class OutlineTunnelStore: NSObject {
  // TODO(alalama): s/connection/tunnel when we update the schema.
  private static let kTunnelStoreKey = "connectionStore"
  private static let kTunnelStatusKey = "connectionStatus"
  private static let kUdpSupportKey = "udpSupport"

  private let defaults: UserDefaults?

  // Constructs the store with UserDefaults as the storage.
  public required init(appGroup: String) {
    defaults = UserDefaults(suiteName: appGroup)
    super.init()
  }

  // Loads a previously saved tunnel from the store.
  public func load() -> OutlineTunnel? {
    if let encodedTunnel = defaults?.data(forKey: OutlineTunnelStore.kTunnelStoreKey) {
      return OutlineTunnel.decode(encodedTunnel)
    }
    return nil
  }

  // Writes |tunnel| to the store.
  @discardableResult
  public func save(_ tunnel: OutlineTunnel) -> Bool {
    if let encodedTunnel = tunnel.encode() {
      defaults?.set(encodedTunnel, forKey: OutlineTunnelStore.kTunnelStoreKey)
    }
    return true
  }

  public var status: OutlineTunnel.TunnelStatus {
    get {
      let status = defaults?.integer(forKey: OutlineTunnelStore.kTunnelStatusKey)
          ?? OutlineTunnel.TunnelStatus.disconnected.rawValue
      return OutlineTunnel.TunnelStatus(rawValue:status)
          ?? OutlineTunnel.TunnelStatus.disconnected
    }
    set(newStatus) {
      defaults?.set(newStatus.rawValue, forKey: OutlineTunnelStore.kTunnelStatusKey)
    }
  }

  public var isUdpSupported: Bool {
    get {
      return defaults?.bool(forKey: OutlineTunnelStore.kUdpSupportKey) ?? false
    }
    set(udpSupport) {
      defaults?.set(udpSupport, forKey: OutlineTunnelStore.kUdpSupportKey)
    }
  }
}
