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

import AppKit
import NetworkExtension

@objc
public enum ConnectionStatus: Int {
    case unknown
    case connected
    case disconnected
}

var StatusItem = NSStatusItem()

class StatusItemController: NSObject {
    let connectionStatusMenuItem = NSMenuItem(title: MenuTitle.statusDisconnected,
                                              action: nil,
                                              keyEquivalent: "")
    let connectDisconnectMenuItem = NSMenuItem(title: MenuTitle.connect,
                                               action: #selector(toggleVpnConnection),
                                               keyEquivalent: "c")

    private enum AppIconImage {
        static let statusConnected = getImage(name: "status_bar_button_image_connected")
        static let statusDisconnected = getImage(name: "status_bar_button_image")
    }

    private enum MenuTitle {
        static let open = NSLocalizedString(
            "tray_open_window",
            bundle: Bundle(for: StatusItemController.self),
            comment: "Tray menu entry to show the application window."
        )
        static let quit = NSLocalizedString(
            "quit",
            bundle: Bundle(for: StatusItemController.self),
            comment: "Tray menu entry to quit the application."
        )
        static let statusConnected = NSLocalizedString(
            "connected_server_state",
            bundle: Bundle(for: StatusItemController.self),
            comment: "Tray menu entry indicating a server is currently connected and in use."
        )
        static let statusDisconnected = NSLocalizedString(
            "disconnected_server_state",
            bundle: Bundle(for: StatusItemController.self),
            comment: "Tray menu entry indicating no server is currently connected."
        )
        static let connect = NSLocalizedString(
            "connect",
            bundle: Bundle(for: StatusItemController.self),
            comment: "Menu item to connect to VPN."
        )
        static let disconnect = NSLocalizedString(
            "disconnect",
            bundle: Bundle(for: StatusItemController.self),
            comment: "Menu item to disconnect from VPN."
        )
    }

    override init() {
        super.init()

        NSLog("[StatusItemController] Creating status menu")
        StatusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        setStatus(status: .disconnected)

        let menu = NSMenu()
        let openMenuItem = NSMenuItem(title: MenuTitle.open, action: #selector(openApplication), keyEquivalent: "o")
        openMenuItem.target = self
        menu.addItem(openMenuItem)
        menu.addItem(connectionStatusMenuItem)
        menu.addItem(NSMenuItem.separator())
        connectDisconnectMenuItem.target = self
        menu.addItem(connectDisconnectMenuItem)
        menu.addItem(NSMenuItem.separator())
        let closeMenuItem = NSMenuItem(title: MenuTitle.quit, action: #selector(closeApplication), keyEquivalent: "q")
        closeMenuItem.target = self
        menu.addItem(closeMenuItem)
        StatusItem.menu = menu
    }

    func setStatus(status: ConnectionStatus) {
        NSLog("[StatusItemController] Setting status: \(status)")
        let isConnected = status == .connected
        let appIconImage = isConnected ? AppIconImage.statusConnected : AppIconImage.statusDisconnected
        appIconImage.isTemplate = true
        StatusItem.button?.image = appIconImage

        let connectionStatusTitle = isConnected ? MenuTitle.statusConnected : MenuTitle.statusDisconnected
        connectionStatusMenuItem.title = connectionStatusTitle
        
        // Update connect/disconnect menu item
        let connectDisconnectTitle = isConnected ? MenuTitle.disconnect : MenuTitle.connect
        connectDisconnectMenuItem.title = connectDisconnectTitle
    }

    @objc func openApplication(_: AnyObject?) {
        NSLog("[StatusItemController] Opening application")
        NSApp.activate(ignoringOtherApps: true)
        guard let uiWindow = getUiWindow() else {
            return
        }
        uiWindow.makeKeyAndOrderFront(self)
    }

    @objc func closeApplication(_: AnyObject?) {
        NSLog("[StatusItemController] Closing application")
        NotificationCenter.default.post(name: Notification.Name("appQuit"), object: nil)
        NSApplication.shared.terminate(self)
    }
    
    @objc func toggleVpnConnection(_: AnyObject?) {
        NSLog("[StatusItemController] Toggle VPN connection")
        
        // Check current VPN status
        Task {
            let managers = try? await NETunnelProviderManager.loadAllFromPreferences()
            let hasProfile = managers?.count ?? 0 > 0
            
            if hasProfile {
                // Get the first (and only) VPN profile
                guard let manager = managers?.first else {
                    NSLog("[StatusItemController] Failed to get VPN manager")
                    return
                }
                
                let isActive = manager.connection.status == .connected || 
                              manager.connection.status == .connecting || 
                              manager.connection.status == .reasserting
                
                if isActive {
                    // Disconnect
                    NSLog("[StatusItemController] Disconnecting VPN")
                    manager.connection.stopVPNTunnel()
                } else {
                    // Connect - start the VPN tunnel directly
                    NSLog("[StatusItemController] Connecting to VPN tunnel")
                    do {
                        try manager.connection.startVPNTunnel()
                    } catch {
                        NSLog("[StatusItemController] Failed to connect VPN: \(error.localizedDescription)")
                        // If connection fails, open the app
                        DispatchQueue.main.async {
                            self.openApplication(nil)
                        }
                    }
                }
            } else {
                // No VPN profile exists, open the app
                NSLog("[StatusItemController] No VPN profile found, opening app")
                DispatchQueue.main.async {
                    self.openApplication(nil)
                }
            }
        }
    }
}

private func getUiWindow() -> NSWindow? {
    for window in NSApp.windows {
        if String(describing: window).contains("UINSWindow") {
            return window
        }
    }
    return nil
}

private func getImage(name: String) -> NSImage {
    guard let image = Bundle(for: StatusItemController.self).image(forResource: NSImage.Name(name)) else {
        fatalError("Unable to load image asset named \(name).")
    }
    return image
}
