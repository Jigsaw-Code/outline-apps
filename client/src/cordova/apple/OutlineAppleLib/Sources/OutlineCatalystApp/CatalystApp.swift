// Copyright 2025 The Outline Authors
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

#if targetEnvironment(macCatalyst)

    import CocoaLumberjack
    import CocoaLumberjackSwift
    import Foundation
    import OutlineNotification
    import ServiceManagement
    import UIKit
    import OutlineTunnel
    import NetworkExtension

    @objcMembers
    public class OutlineCatalystApp: NSObject {
        public static func initApp() {
            DDLog.add(DDOSLogger.sharedInstance)

            let appKitController = loadAppKitIntegrationFramework()

            // Configure the window.
            let scenes = UIApplication.shared.connectedScenes
            for scene in scenes {
                let windowScene = (scene as! UIWindowScene)
                windowScene.titlebar?.titleVisibility = .hidden
                windowScene.titlebar?.toolbar = nil
                windowScene.sizeRestrictions?.minimumSize = CGSizeMake(400, 680)
                windowScene.sizeRestrictions?.maximumSize = CGSizeMake(400, 680)
            }

            // Initiate the connection status menu in unknown state by default.
            // TODO: Check status in case the the VPN is already running.
            appKitController._AppKitBridge_setConnectionStatus(.unknown)

            NotificationCenter.default.addObserver(forName: NSNotification.kVpnConnected,
                                                   object: nil,
                                                   queue: nil)
            { _ in
                appKitController._AppKitBridge_setConnectionStatus(.connected)
            }
            NotificationCenter.default.addObserver(forName: NSNotification.kVpnDisconnected,
                                                   object: nil,
                                                   queue: nil)
            { _ in
                appKitController._AppKitBridge_setConnectionStatus(.disconnected)
            }
            
            // Handle connection toggle from tray menu
            NotificationCenter.default.addObserver(forName: NSNotification.Name("toggleConnection"),
                                                   object: nil,
                                                   queue: nil)
            { _ in
                Task {
                    if let manager = await getTunnelManager() {
                        if isActiveSession(manager.connection) {
                            // If connected, disconnect
                            if let tunnelId = getTunnelId(forManager: manager) {
                                do {
                                    await OutlineVpn.shared.stop(tunnelId)
                                }
                            }
                        } else {
                            // If disconnected, try to connect to the last server
                            if let tunnelConfig = manager.protocolConfiguration as? NETunnelProviderProtocol,
                               let tunnelId = tunnelConfig.providerConfiguration?["id"] as? String,
                               let transportConfig = tunnelConfig.providerConfiguration?["transport"] as? String {
                                do {
                                    try await OutlineVpn.shared.start(tunnelId, named: "Outline Server", withTransport: transportConfig)
                                } catch {
                                    DDLogError("Failed to start VPN: \(error.localizedDescription)")
                                    NotificationCenter.default.post(name: NSNotification.Name("openApplication"), object: nil)
                                }
                            } else {
                                // No server available, open the app
                                NotificationCenter.default.post(name: NSNotification.Name("openApplication"), object: nil)
                            }
                        }
                    } else {
                        // No tunnel manager available, open the app
                        NotificationCenter.default.post(name: NSNotification.Name("openApplication"), object: nil)
                    }
                }
            }
        }
    }

    public func loadAppKitIntegrationFramework() -> NSObject {
        if let frameworksPath = Bundle.main.privateFrameworksPath {
            let bundlePath = "\(frameworksPath)/AppKitIntegration.framework"
            do {
                try Bundle(path: bundlePath)?.loadAndReturnError()

                let bundle = Bundle(path: bundlePath)!
                DDLogInfo("[CatalystApp] AppKit bundle loaded successfully")

                if let appKitControllerClass = bundle.classNamed("AppKitIntegration.AppKitController") as? NSObject.Type {
                    return appKitControllerClass.init()
                }
            } catch {
                DDLogInfo("[CatalystApp] Error loading: \(error)")
            }
        }
        preconditionFailure("[CatalystApp] Unable to load")
    }

    // Helper functions for VPN management
    func getTunnelManager() async -> NETunnelProviderManager? {
        do {
            let managers: [NETunnelProviderManager] = try await NETunnelProviderManager.loadAllFromPreferences()
            guard managers.count > 0 else { return nil }
            return managers.first
        } catch {
            return nil
        }
    }

    func getTunnelId(forManager manager: NETunnelProviderManager?) -> String? {
        let protoConfig = manager?.protocolConfiguration as? NETunnelProviderProtocol
        return protoConfig?.providerConfiguration?["id"] as? String
    }

    func isActiveSession(_ session: NEVPNConnection?) -> Bool {
        let vpnStatus = session?.status
        return vpnStatus == .connected || vpnStatus == .connecting || vpnStatus == .reasserting
    }

#endif
