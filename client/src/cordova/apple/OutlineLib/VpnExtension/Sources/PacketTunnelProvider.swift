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

import CocoaLumberjackSwift
import NetworkExtension
import OutlineError
import Tun2socks

/// SwiftBridge is a transitional class to allow the incremental migration of our PacketTunnelProvider from Objective-C to Swift.
@objcMembers
public class SwiftBridge: NSObject {

  /** Helper function that we can call from Objective-C. */
  public static func getTunnelNetworkSettings(conf: VPNConfig) -> NEPacketTunnelNetworkSettings {
    // The remote address is not required, but needs to be valid, or else you get a
    // "Invalid NETunnelNetworkSettings tunnelRemoteAddress" error.
    let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: "::")

    // Configure VPN address and routing.
    let ipv4Settings = NEIPv4Settings(addresses: [conf.tunAddress], subnetMasks: ["255.255.255.0"])
    ipv4Settings.includedRoutes = [NEIPv4Route.default()]
    ipv4Settings.excludedRoutes = conf.excludedIpv4Routes
    settings.ipv4Settings = ipv4Settings
    settings.dnsSettings = NEDNSSettings(servers: [conf.localDnsAddress])

    return settings
  }

  /** Creates a new Outline Client based on the given transportConfig. */
  public static func newClient(id: String, transportConfig: String) -> OutlineNewClientResult {
    let clientConfig = OutlineClientConfig()
    do {
      clientConfig.dataDir = try FileManager.default.url(
        for: .applicationSupportDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
      ).path
    } catch {
      DDLogWarn("Error finding Application Support directory: \(error)")
    }
    let result = clientConfig.new(id, providerClientConfigText: transportConfig)
    if result?.error != nil {
      DDLogInfo(
        "Failed to construct client: \(String(describing: result?.error))."
      )
    }
    return result!
  }

  /**
   Creates a NSError (of `OutlineError.errorDomain`) from the `OutlineError.internalError`.
   */
  public static func newInternalOutlineError(message: String) -> NSError {
    return OutlineError.internalError(message: message) as NSError
  }

  /**
   Creates a NSError (of `OutlineError.errorDomain`) from the `OutlineError.invalidConfig` error.
   */
  public static func newInvalidConfigOutlineError(message: String) -> NSError {
    return OutlineError.invalidConfig(message: message) as NSError
  }

  /**
   Creates a NSError (of `OutlineError.errorDomain`) from a Go's PlatformError.
   */
  public static func newOutlineErrorFrom(platformError: PlaterrorsPlatformError?) -> NSError? {
    guard let perr = platformError else {
      return nil
    }
    return OutlineError.platformError(perr) as NSError
  }

  /**
   Creates a NSError (of `OutlineError.errorDomain`) with detailed JSON from another NSError.
   */
  public static func newOutlineErrorFrom(nsError: Error?) -> NSError? {
    guard let nserr = nsError else {
      return nil
    }
    return toOutlineError(error: nserr) as NSError
  }

  // TODO: Remove this code once we only support newer systems (macOS 13.0+, iOS 16.0+)
  public static func saveLastError(nsError: Error?) {
    saveLastDisconnectErrorDetails(error: nsError)
  }

  // TODO: Remove this code once we only support newer systems (macOS 13.0+, iOS 16.0+)
  public static func loadLastErrorToIPCResponse() -> NSData? {
    return loadLastDisconnectErrorDetailsToIPCResponse() as? NSData
  }
}

// MARK: - fetch last disconnect error

// TODO: Remove this code once we only support newer systems (macOS 13.0+, iOS 16.0+)

/**
  In the app, we need to use [NEVPNConnection fetchLastDisconnectErrorWithCompletionHandler] to
  retrive the most recent error that caused the VPN extension to disconnect.
  But it's only available on newer systems (macOS 13.0+, iOS 16.0+), so we need a workaround for
  older ones.
  The workaround lets the app to use [NETunnelProviderSession sendProviderMessage] to get the
  error through an IPC method.
  The extension also needs to save the last error to disk, as the system will unload the extension
  after a failed connection.
  We use [NSUserDefaults standardUserDefaults] to store the error, so it's available even after
  the extension restarts.
*/

let lastDisconnectErrorPersistenceKey = "lastDisconnectError"

/// Keep it in sync with the data type defined in OutlineVpn.Swift
/// Also keep in mind that we will always use PropertyListEncoder and PropertyListDecoder to marshal this data.
private struct LastErrorIPCData: Codable {
  let errorCode: String
  let errorJson: String
}

func saveLastDisconnectErrorDetails(error: Error?) {
  guard let err = error else {
    return UserDefaults.standard.removeObject(forKey: lastDisconnectErrorPersistenceKey)
  }
  let outlineErr = toOutlineError(error: err)
  let persistObj = LastErrorIPCData(
    errorCode: outlineErr.code, errorJson: marshalErrorJson(error: err))
  do {
    let encodedObj = try PropertyListEncoder().encode(persistObj)
    UserDefaults.standard.setValue(encodedObj, forKey: lastDisconnectErrorPersistenceKey)
  } catch {
    DDLogError("failed to persist lastDisconnectError \(persistObj): \(error)")
  }
}

func loadLastDisconnectErrorDetailsToIPCResponse() -> Data? {
  return UserDefaults.standard.data(forKey: lastDisconnectErrorPersistenceKey)
}
