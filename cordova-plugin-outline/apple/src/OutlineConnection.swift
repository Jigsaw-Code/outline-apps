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

// Serializable class to wrap a connection's configuration.
// Properties must be kept in sync with ServerConfig in www/types/outlinePlugin.d.ts
@objcMembers
class OutlineConnection: NSObject, Codable {
  var id: String?
  var host: String?
  var port: String?
  var method: String?
  var password: String?
  var config: [String: String] {
    return ["host": host ?? "", "port": port ?? "", "password": password ?? "",
            "method": method ?? ""]
  }

  @objc
  enum ConnectionStatus: Int {
    case connected = 0
    case disconnected = 1
    case reconnecting = 2
  }

  convenience init(id: String, config: [String: Any]) {
    self.init()
    self.id = id
    self.host = config["host"] as? String
    self.password = config["password"] as? String
    self.method = config["method"] as? String
    if let port = config["port"] {
      self.port = String(describing: port)  // Handle numeric values
    }
  }

  func encode() -> Data? {
    return try? JSONEncoder().encode(self)
  }

  static func decode(_ jsonData: Data) -> OutlineConnection? {
    return try? JSONDecoder().decode(OutlineConnection.self, from: jsonData)
  }

}
