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

private let log = OSLog(subsystem: "org.getoutline.OutlinePacketTunnel", category: "vpn")

class OutlinePacketTunnel: NEPacketTunnelProvider {
  override func startTunnel(options: [String : NSObject]?, completionHandler: @escaping (Error?) -> Void) {
    os_log(.info, log: log, "Starting tunnel with options: %{private}@", String(describing: options))
    Task {
      completionHandler(await startTunnelAsync(options: options))
    }
  }

  private func startTunnelAsync(options: [String : NSObject]?) async -> Error? {
    os_log(.info, log: log, "Starting tunnel with options: %{private}@", String(describing: options))

    guard let protocolConfig = protocolConfiguration as? NETunnelProviderProtocol,
          let transportConfig = protocolConfig.providerConfiguration else {
      os_log(.error, log: log, "Could not get NETunnelProviderProtocol.providerConfiguration")
      return NEVPNError(.configurationInvalid)
    }
    // TODO: Make this private
    os_log(.info, log: log, "NETunnelProviderProtocol is %{public}@", protocolConfig.description)


    // TODO: Investigate Connectivity Result: errorCode: 5 (serverUnreachable), error: nil, tcp: false, udp: false
    let outlineDevice: OutlineDevice
    do {
      outlineDevice = try await newOutlineDevice(transportConfig: transportConfig)
    } catch {
      os_log(.error, log: log, "Failed to create OutlineDevice: %{public}@", String(describing: error))
      return error
    }

    // TODO(fortuna): Figure out what value we want here.
    let networkSettings = OutlineTunnel.getTunnelNetworkSettings(tunnelRemoteAddress: "0.0.0.0")
    do {
      os_log(.info, log: log, "Setting tunnel network settings: %{public}@", networkSettings)
      try await self.setTunnelNetworkSettings(networkSettings)
      os_log(.info, log: log, "Network settings done")
    } catch {
      os_log(.error, log: log, "Network settings failed: %{public}@", String(describing: error))
      return error
    }

    // TODO:
    //outlineDevice.relay(with: self.packetFlow)

      // - New Device: new Client/device + connectivity
      // - device.Relay()
//    let client: ShadowsocksClient
//    switch OutlinePacketTunnel.newClient(transportConfig) {
//    case .failure(let error):
//      os_log(.error, log: log, "Failed to create client: %@", String(describing:error))
//      completionHandler(NEVPNError(.configurationInvalid))
//    case .success(let result):
//      client = result
//    }
    return nil
  }

  override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
    os_log(.info, log:log, "Stopping tunnel...")
    completionHandler()
    // Stop OnDemand? Perhaps in the caller.
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

private func newGoClient(_ transportConfig: [String: Any]) throws -> ShadowsocksClient {
  // TODO(fortuna): forward config to Go without inspection.
  let ssConfig = ShadowsocksConfig()
  // See ShadowsocksSessionConfig in tunnel.ts
  if let host = transportConfig["host"] as? String {
    ssConfig.host = host
  }
  if let port = transportConfig["port"] as? Int {
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
  // TODO(fortuna): Make it private
  os_log(.info, log:log, "ssConfig is host: %{public}@, port: %{public}@, password: %{public}@, method: %{public}@",
         ssConfig.host, String(describing: ssConfig.port), ssConfig.password ,ssConfig.cipherName)
  var errorPtr: NSError?
  guard let client = ShadowsocksNewClient(ssConfig, &errorPtr) else {
    if let error = errorPtr {
      throw error
    }
    throw NSError(
      domain: "OutlinePacketTunnel", code: 1, userInfo: [ NSLocalizedDescriptionKey: "got no client and no error from ShadowsocksNewClient"])
  }
  return client
}

func newOutlineDevice(transportConfig: [String: Any]) async throws -> OutlineDevice {
  let goClient = try newGoClient(transportConfig)

  var errorInt = OutlineVpn.ErrorCode.noError.rawValue
  var connectivityError: NSError?
  // TODO(fortuna): Should we run this on a separate thread?
  ShadowsocksCheckConnectivity(goClient, &errorInt, &connectivityError)
  let errorCode = OutlineVpn.ErrorCode(rawValue: errorInt)
  let tcpOk = (errorCode == OutlineVpn.ErrorCode.noError ||
      errorCode == OutlineVpn.ErrorCode.udpRelayNotEnabled)
  let udpOk = errorCode == OutlineVpn.ErrorCode.noError
  os_log(.info, log: log, "Connectivity Result: errorCode: %{public}d, error: %{public}@, tcp: %{public}@, udp: %{public}@", errorInt, String(describing: connectivityError), String(describing: tcpOk), String(describing: udpOk))
  guard tcpOk else {
    throw NEVPNError(.connectionFailed)
  }
  return OutlineDevice(client: goClient, isUdpEnabled: udpOk)
}

class OutlineDevice {
  private let goClient: ShadowsocksClient
  private var isUdpEnabled: Bool
  private var goTunnel: Tun2socksOutlineTunnelProtocol?

  init(client: ShadowsocksClient, isUdpEnabled: Bool) {
    self.goClient = client
    self.isUdpEnabled = isUdpEnabled
  }

  func relay(with packetFlow: NEPacketTunnelFlow) {
    // TODO: implement Tun2socksTunWriter interface.
    let tunWriter = makeTunWriter(packetFlow)
    var connectError: NSError?
    // Tun2socksConnectShadowsocksTunnel sets up the packet flow from the proxy to the local system, and returns a
    // Tun2socksOutlineTunnelProtocol object to set up the packet flow from the local system to the proxy.
    // TODO: handle error
    self.goTunnel = Tun2socksConnectShadowsocksTunnel(
      tunWriter, self.goClient, self.isUdpEnabled, &connectError);
//    self.relayFromLocalToProxy()
  }

//  private func relayFromLocalToProxy() {
//     self.packetFlow.readPacketObjects() { packets in
//       for packet in packets {
//         self.goTunnel?.write(<#T##data: Data?##Data?#>, ret0_: <#T##UnsafeMutablePointer<Int>?#>)
//       }
////
////    }
//    Task { [weak self] in
//      self?.relayFromLocalToProxy()
//    }
//  }

  /// Updates the UDP support
  func updateUdpSupport() async {
    guard let goTunnel = self.goTunnel else {
      return
    }
    self.isUdpEnabled = await Task.detached {
      // This function runs the connectivity test, which takes time, so we run it detached.
      return goTunnel.updateUDPSupport()
    }.value
  }

  func stop() {
    guard let goTunnel = self.goTunnel else {
      return
    }
    goTunnel.disconnect()
    self.goTunnel = nil
  }
}

private func makeTunWriter(_ packetFlow: NEPacketTunnelFlow) -> Tun2socksTunWriter {
  // TODO: implement
  return Tun2socksTunWriter()
}
