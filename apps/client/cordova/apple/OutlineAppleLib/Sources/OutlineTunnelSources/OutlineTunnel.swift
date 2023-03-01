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

// Serializable class to wrap a tunnel's configuration.
// Properties must be kept in sync with ServerConfig in www/types/outlinePlugin.d.ts
// Note that this class and its non-private properties must be public in order to be visible to the ObjC
// target of the OutlineAppleLib Swift Package.
@objcMembers
public class OutlineTunnel: NSObject, Codable {
  public var id: String?
  public var host: String?
  public var port: String?
  public var method: String?
  public var password: String?
  public var prefix: Data?
  public var config: [String: String] {
    let scalars = prefix?.map{Unicode.Scalar($0)}
    let characters = scalars?.map{Character($0)}
    let prefixStr = String(characters ?? [])
    return ["host": host ?? "", "port": port ?? "", "password": password ?? "",
            "method": method ?? "", "prefix": prefixStr]
  }

  @objc
  public enum TunnelStatus: Int {
    case connected = 0
    case disconnected = 1
    case reconnecting = 2
  }

  public convenience init(id: String, config: [String: Any]) {
    self.init()
    self.id = id
    self.host = config["host"] as? String
    self.password = config["password"] as? String
    self.method = config["method"] as? String
    if let port = config["port"] {
      self.port = String(describing: port)  // Handle numeric values
    }
    if let prefix = config["prefix"] as? String {
      self.prefix = Data(prefix.utf16.map{UInt8($0)})
    }
  }

  public func encode() -> Data? {
    return try? JSONEncoder().encode(self)
  }

  public static func decode(_ jsonData: Data) -> OutlineTunnel? {
    return try? JSONDecoder().decode(OutlineTunnel.self, from: jsonData)
  }

}
