// Copyright 2024 The Outline Authors
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
import NetworkExtension

public enum TunnelProviderKeys {
  static let keyVersion = "version"
}

public extension NETunnelProviderManager {
  // Checks if the configuration has gone stale, which means clients should discard it.
  var isStale: Bool {
    #if targetEnvironment(macCatalyst)
      // When migrating from macOS to Mac Catalyst, we can't use managers created by the macOS app.
      // Instead, we need to create a new one. We track such "stale" managers by a version on the
      // provider configuration.
      if let protocolConfiguration = protocolConfiguration as? NETunnelProviderProtocol {
          var providerConfig: [String: Any] = protocolConfiguration.providerConfiguration ?? [:]
          let version = providerConfig[TunnelProviderKeys.keyVersion, default: 0] as! Int
          return version != 1
      }
      return true
    #else
     return false
    #endif
  }

  var autoConnect: Bool {
    get {
      let hasOnDemandRules = !(self.onDemandRules?.isEmpty ?? true)
      return self.isEnabled && hasOnDemandRules
    }
    set {
      if newValue {
        let connectRule = NEOnDemandRuleConnect()
        connectRule.interfaceTypeMatch = .any
        self.onDemandRules = [connectRule]
      } else {
        self.onDemandRules = nil
      }
      self.isEnabled = newValue
    }
  }
}
