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
import ServiceManagement

class AppKitController: NSObject {
    static let shared = AppKitController()
    private var statusItemController: StatusItemController?
    private var windowCloseObservers: [NSWindow: NSObjectProtocol] = [:]

    override public required init() {
        super.init()
        NSApp.setActivationPolicy(.regular)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(windowDidBecomeMain(_:)),
            name: NSWindow.didBecomeMainNotification,
            object: nil
        )
        // After the app has fully launched, forcibly attach an observer to the initial UIWindow.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            for window in NSApp.windows {
                if String(describing: window).contains("UINSWindow") {
                    self.observeWindowClose(for: window)
                }
            }
        }
    }

    @objc public func observeWindowClose(for window: NSWindow) {
        // Remove previous observer for this window if any
        if let observer = windowCloseObservers[window] {
            NotificationCenter.default.removeObserver(observer)
        }
        let observer = NotificationCenter.default.addObserver(
            forName: NSWindow.willCloseNotification, object: window, queue: .main
        ) { [weak self] notification in
            self?.handleWindowClosed(notification)
        }
        windowCloseObservers[window] = observer
    }

    private func handleWindowClosed(_ notification: Notification) {
        guard let closedWindow = notification.object as? NSWindow,
            String(describing: closedWindow).contains("UINSWindow")
        else {
            return
        }
        NSLog("[AppKitController] Main window closed, hiding Dock icon")
        AppKitController.shared.setDockIconVisible(false)
        // Remove observer for this window
        if let observer = windowCloseObservers[closedWindow] {
            NotificationCenter.default.removeObserver(observer)
            windowCloseObservers.removeValue(forKey: closedWindow)
        }
    }

    @objc private func windowDidBecomeMain(_ notification: Notification) {
        guard let window = notification.object as? NSWindow,
            String(describing: window).contains("UINSWindow")
        else {
            return
        }
        observeWindowClose(for: window)
    }

    @objc public func setDockIconVisible(_ visible: Bool) {
        if visible {
            NSApp.setActivationPolicy(.regular)
        } else {
            NSApp.setActivationPolicy(.accessory)
        }
    }

    /// Set the connection status in the app's menu in the system-wide menu bar.
    @objc public func _AppKitBridge_setConnectionStatus(_ status: ConnectionStatus) {
        if statusItemController == nil {
            NSLog("[AppKitController] No status item controller found. Creating one now.")
            statusItemController = StatusItemController()
        }
        statusItemController!.setStatus(status: status)
    }
}
