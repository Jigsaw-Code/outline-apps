// Copyright 2023 The Outline Authors
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

import os.log
import NetworkExtension

import OutlineTunnel
import Tun2socks

@available(macOS 10.15, *)
class OutlinePacketTunnel: NEPacketTunnelProvider {
  private let log = OSLog(subsystem: "org.getoutline.OutlinePacketTunnel", category: "vpn")

  override func startTunnel(options: [String : NSObject]?, completionHandler: @escaping (Error?) -> Void) {
    // TODO: make config private
    os_log(.info, log: log, "Starting tunnel with options: %@", String(describing: options))

    guard let protocolConfig = protocolConfiguration as? NETunnelProviderProtocol else {
      os_log(.error, log: log, "NETunnelProvider.protocolConfiguration is not NETunnelProviderProtocol")
      completionHandler(NEVPNError(.configurationInvalid))
      return
    }
    os_log(.info, log: log, "NETunnelProviderProtocol is %{public}@", protocolConfig.description)

    guard let transportConfig = protocolConfig.providerConfiguration else {
      os_log(.error, log: log, "providerConfiguration no found")
      completionHandler(NEVPNError(.configurationInvalid))
      return
    }

    Task {
      let networkSettings = OutlineTunnel.getTunnelNetworkSettings(tunnelRemoteAddress: "0.0.0.0")
      do {
        os_log(.info, log: log, "Setting tunnel network settings: %{public}@", networkSettings)
        try await self.setTunnelNetworkSettings(networkSettings)
        os_log(.info, log: log, "Network settings done")
      } catch {
        os_log(.error, log: log, "Network settings failed: %{public}@", String(describing: error))
        completionHandler(error)
        return
      }

//      let client: ShadowsocksClient
//      switch OutlinePacketTunnel.newClient(transportConfig) {
//      case .failure(let error):
//        os_log(.error, log: log, "Failed to create client: %@", String(describing:error))
//        completionHandler(NEVPNError(.configurationInvalid))
//      case .success(let result):
//        client = result
//      }

      completionHandler(nil)
    }
  }

  private static func newClient(_ transportConfig: [String: Any]) -> Result<ShadowsocksClient, Error> {
    // TODO(fortuna): forward config to Go without inspection.
    let ssConfig = ShadowsocksConfig()
    if let host = transportConfig["host"] as? String {
      ssConfig.host = host
    }
    if let portStr = transportConfig["port"] as? String,
       let port = Int(portStr) {
      ssConfig.port = port
    }
    if let password = transportConfig["password"] as? String {
      ssConfig.password = password
    }
    if let cipherName = transportConfig["method"] as? String {
      ssConfig.cipherName = cipherName
    }
    if let prefixStr = transportConfig["prefix"] as? String {
      ssConfig.prefix = Data(prefixStr.utf16.map{UInt8($0)})
    }
    var errorPtr: NSError?
    if let client = ShadowsocksNewClient(ssConfig, &errorPtr) {
      return .success(client)
    }
    if let error = errorPtr {
      return .failure(error)
    }
    return .failure(NSError(
      domain: "OutlinePacketTunnel", code: 1, userInfo: [ NSLocalizedDescriptionKey: "got no client and no error from ShadowsocksNewClient"]))
  }

  override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
    os_log(.info, log:log, "Stopping tunnel...")
    completionHandler()
  }

  override func handleAppMessage(_ messageData: Data, completionHandler: ((Data?) -> Void)?) {
    os_log(.info, log:log, "Handling app message...")
    if let handler = completionHandler {
      handler(messageData)
    }
  }

  override func sleep(completionHandler: @escaping () -> Void) {
    os_log(.info, log:log, "Preparing to sleep...")
    completionHandler()
  }

  override func wake() {
    os_log(.info, log:log, "Waking up...")
  }
}
