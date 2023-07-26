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

#if canImport(AppKit)
import AppKit
import CocoaLumberjackSwift
import OutlineShared

var StatusItem = NSStatusItem()

class StatusItemController: NSObject {
    let connectionStatusMenuItem = NSMenuItem(title: MenuTitle.statusDisconnected,
                                              action: nil,
                                              keyEquivalent: "")

    private enum AppIconImage {
        static let statusConnected = NSImage(named: NSImage.Name("StatusBarButtonImageConnected"))!
        static let statusDisconnected = NSImage(named: NSImage.Name("StatusBarButtonImage"))!
    }

    // TODO: Internationalize these user-facing strings.
    private enum MenuTitle {
        static let open = "Open"
        static let quit = "Quit"
        static let statusConnected = "Connected"
        static let statusDisconnected = "Disconnected"
    }

    override init() {
        super.init()

        DDLogInfo("[StatusItemController] Creating status menu")
        StatusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        setStatus(status: .disconnected)

        let menu = NSMenu()
        let openMenuItem = NSMenuItem(title: MenuTitle.open, action: #selector(openApplication), keyEquivalent: "o")
        openMenuItem.target = self
        menu.addItem(openMenuItem)
        menu.addItem(connectionStatusMenuItem)
        menu.addItem(NSMenuItem.separator())
        let closeMenuItem = NSMenuItem(title: MenuTitle.quit, action: #selector(closeApplication), keyEquivalent: "q")
        closeMenuItem.target = self
        menu.addItem(closeMenuItem)
        StatusItem.menu = menu
    }

    func setStatus(status: ConnectionStatus) {
        let isConnected = status == .connected
        let appIconImage = isConnected ? AppIconImage.statusConnected : AppIconImage.statusDisconnected
        appIconImage.isTemplate = true
        StatusItem.button?.image = appIconImage

        let connectionStatusTitle = isConnected ? MenuTitle.statusConnected : MenuTitle.statusDisconnected
        connectionStatusMenuItem.title = connectionStatusTitle
    }

    private func getUiWindow() -> NSWindow? {
        for window in NSApp.windows {
            if String(describing: window).contains("UINSWindow") {
                return window
            }
        }
        return nil
    }

    @objc func openApplication(_: AnyObject?) {
        DDLogInfo("[StatusItemController] Opening application")
        NSApp.activate(ignoringOtherApps: true)
        guard let uiWindow = getUiWindow() else {
            return
        }
        uiWindow.makeKeyAndOrderFront(self)
    }

    @objc func closeApplication(_: AnyObject?) {
        DDLogInfo("[StatusItemController] Closing application")
        NotificationCenter.default.post(name: .kAppQuit, object: nil)
        NSApplication.shared.terminate(self)
    }
}
#endif
