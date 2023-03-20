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
class OutlineTunnel: NSObject, Codable {
  var id: String?
  var configString: String?

  @objc
  public enum TunnelStatus: Int {
    case connected = 0
    case disconnected = 1
    case reconnecting = 2
  }

  public convenience init(id: String?, configString: String) {
    self.init()
    self.id = id
    self.configString = configString
  }
  
  public func encode() -> Data? {
    return configString!.data(using: .utf8)
  }

  static func decode(_ encodedTunnelData: Data) -> OutlineTunnel? {
    return OutlineTunnel(id: nil,
                         configString: String(decoding: encodedTunnelData,
                                              as: UTF8.self))
  }

  // Private helper to retrieve the host from the config string.
  private func configToDictionary() -> [String: Any]? {
      if let data = configString!.data(using: .utf8) {
        do {
          return try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
        } catch {
          print(error.localizedDescription)
        }
      }
      return nil
    }

  public func host() -> String? {
    guard let host = configToDictionary()!["host"] else {
      return nil
    }
    return host as? String
  }

}
