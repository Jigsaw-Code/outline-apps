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
    private var statusItemController: StatusItemController?
    static let kAppGroup = "QT8Z3Q9V3A.org.outline.macos.client"
    static let kAppLauncherName = "launcher3"

    override public required init() {
        super.init()
    }

    /// Terminates the application.
    @objc public func _AppKitBridge_terminate() {
        NSApp.terminate(self)
    }

    /// Set the connection status in the app's menu in the system-wide menu bar.
    @objc public func _AppKitBridge_setConnectionStatus(_ status: ConnectionStatus) {
        if statusItemController == nil {
            NSLog("[AppKitController] No status item controller found. Creating one now.")
            statusItemController = StatusItemController()
        }
        statusItemController!.setStatus(status: status)
    }

    /// Enables or disables the embedded app launcher as a login item.
    @objc public func _AppKitBridge_setAppLauncherEnabled(_ isEnabled: Bool) {
        guard let launcherBundleId = getLauncherBundleId() else {
            return NSLog("[AppKitController] Unable to set launcher for missing bundle ID.")
        }

        if !SMLoginItemSetEnabled(launcherBundleId as! CFString, isEnabled) {
            return NSLog("[AppKitController] Failed to set enable=\(isEnabled) for launcher \(launcherBundleId).")
        }

        return NSLog("[AppKitController] Successfully set enable=\(isEnabled) for launcher \(launcherBundleId).")
    }

    /// Loads the main application from a given launcher bundle.
    @objc public func _AppKitBridge_loadMainApp(_ launcherBundleId: String) {
        // Retrieve the main app's bundle ID programmatically from the embedded launcher bundle ID.
        let mainAppBundleId = getMainBundleId(launcherBundleId)
        NSLog("[AppKitController] Loading main app \(mainAppBundleId) from launcher \(launcherBundleId).")

        let descriptor = NSAppleEventDescriptor(string: launcherBundleId)
        NSWorkspace.shared.launchApplication(withBundleIdentifier: mainAppBundleId,
                                             options: [.withoutActivation, .andHide],
                                             additionalEventParamDescriptor: descriptor,
                                             launchIdentifier: nil)
    }
}

/// Returns the embedded launcher application's bundle ID.
private func getLauncherBundleId() -> String? {
    guard let bundleId = Bundle.main.bundleIdentifier else {
        NSLog("[AppKitController] Failed to retrieve the application's bundle ID.")
        return nil
    }
    return String(format: "%@.%@", bundleId, AppKitController.kAppLauncherName)
}

/// Returns the main application's bundle ID from the embedded launcher bundle ID.
private func getMainBundleId(_ launcherBundleId: String) -> String {
    return (launcherBundleId as NSString).deletingPathExtension
}
