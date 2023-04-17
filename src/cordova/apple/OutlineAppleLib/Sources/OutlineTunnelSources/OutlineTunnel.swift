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

@objcMembers
public class OutlineTunnel: NSObject, Codable {
  public var id: String?
  public var host: String?
  public var proxyConfigString: String?

  @objc
  public enum TunnelStatus: Int {
    case connected = 0
    case disconnected = 1
    case reconnecting = 2
  }

  public convenience init?(_ tunnelConfig: [String: Any]?) {
    if containsExpectedKeys(tunnelConfig)
      return nil
    self.init(tunnelConfig?["id"], tunnelConfig?["host"], tunnelConfig?["proxyConfigString"])
  }

  public init(id: String, host: String, configString: String) {
    self.init()
    self.id = id
    self.host = host
    self.proxyConfigString = proxyConfigString
  }
  
  func encode() -> Data? {
    let encoder = JSONEncoder()

    do {
      let json = try encoder.encode(self)
      return Data(json.utf8)
    } catch {
      print("Failed to encode the tunnel")
      return nil
    }    
  }

  static func decode(_ encodedTunnelData: Data) -> OutlineTunnel? {
    let decoder = JSONDecoder()

    do {
      let decodedTunnel = try decoder.decode([OutlineTunnel].self, from: encodedTunnelData)
      return decodedTunnel
    } catch {
      print("Failed to decode the tunnel")
      return nil
    }
  }

  private func containsExpectedKeys(_ tunnelConfig: [String: Any]?) -> Bool {
    return tunnelConfig?["id"] != nil && 
        tunnelConfig?["host"] != nil &&
        tunnelConfig?["proxyConfigString"] != nil
  }

}
