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
import CocoaLumberjack
import CocoaLumberjackSwift

// Persistence layer for a single |OutlineConnection| object.
@objcMembers
class OutlineConnectionStore: NSObject {
  private static let kConnectionStoreKey = "connectionStore"
  private static let kConnectionStatusKey = "connectionStatus"

  private let defaults: UserDefaults?

  // Constructs the store with UserDefaults as the storage.
  required init(appGroup: String) {
    defaults = UserDefaults(suiteName: appGroup)
    super.init()
  }

  // Loads a previously saved connection from the store.
  func load() -> OutlineConnection? {
    if let encodedConnection = defaults?.data(forKey: OutlineConnectionStore.kConnectionStoreKey) {
      return OutlineConnection.decode(encodedConnection)
    }
    return nil
  }

  // Writes |connection| to the store.
  @discardableResult
  func save(_ connection: OutlineConnection) -> Bool {
    if let encodedConnection = connection.encode() {
      defaults?.set(encodedConnection, forKey: OutlineConnectionStore.kConnectionStoreKey)
    }
    return true
  }

  var status: OutlineConnection.ConnectionStatus {
    get {
      let status = defaults?.integer(forKey: OutlineConnectionStore.kConnectionStatusKey)
          ?? OutlineConnection.ConnectionStatus.disconnected.rawValue
      return OutlineConnection.ConnectionStatus(rawValue:status)
          ?? OutlineConnection.ConnectionStatus.disconnected
    }
    set(newStatus) {
      defaults?.set(newStatus.rawValue, forKey: OutlineConnectionStore.kConnectionStatusKey)
    }
  }
}
