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
            comment: "Tray menu entry to connect to the last connected server."
        )
        static let disconnect = NSLocalizedString(
            "disconnect",
            bundle: Bundle(for: StatusItemController.self),
            comment: "Tray menu entry to disconnect from the current server."
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
        
        // Add Connect/Disconnect menu item
        let toggleConnectionMenuItem = NSMenuItem(title: MenuTitle.connect, action: #selector(toggleConnection), keyEquivalent: "")
        toggleConnectionMenuItem.target = self
        menu.addItem(toggleConnectionMenuItem)
        
        menu.addItem(NSMenuItem.separator())
        let closeMenuItem = NSMenuItem(title: MenuTitle.quit, action: #selector(closeApplication), keyEquivalent: "q")
        closeMenuItem.target = self
        menu.addItem(closeMenuItem)
        StatusItem.menu = menu

        // Add observer for opening the app
        NotificationCenter.default.addObserver(self,
                                             selector: #selector(openApplication),
                                             name: NSNotification.Name("openApplication"),
                                             object: nil)
    }

    func setStatus(status: ConnectionStatus) {
        NSLog("[StatusItemController] Setting status: \(status)")
        let isConnected = status == .connected
        let appIconImage = isConnected ? AppIconImage.statusConnected : AppIconImage.statusDisconnected
        appIconImage.isTemplate = true
        StatusItem.button?.image = appIconImage

        let connectionStatusTitle = isConnected ? MenuTitle.statusConnected : MenuTitle.statusDisconnected
        connectionStatusMenuItem.title = connectionStatusTitle
        
        // Update the Connect/Disconnect menu item title
        if let menu = StatusItem.menu {
            for item in menu.items {
                if item.action == #selector(toggleConnection) {
                    item.title = isConnected ? MenuTitle.disconnect : MenuTitle.connect
                    break
                }
            }
        }
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

    @objc func toggleConnection(_: AnyObject?) {
        NSLog("[StatusItemController] Toggling connection")
        NotificationCenter.default.post(name: Notification.Name("toggleConnection"), object: nil)
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
