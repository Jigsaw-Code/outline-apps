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

#if os(macOS)
    import AppKit
    import CocoaLumberjackSwift
    import ServiceManagement

    public class AppKitBridge: NSObject, AppKitBridgeProtocol {
        private var statusItemController: StatusItemController?
        static let kAppGroup = "QT8Z3Q9V3A.org.outline.macos.client"
        static let kAppLauncherName = "launcher3"

        override public required init() {
            super.init()
        }

        /// Terminates the application.
        @objc public func terminate() {
            NSApp.terminate(self)
        }

        /// Set the connection status in the app's menu in the system-wide menu bar.
        @objc public func setConnectionStatus(_ status: ConnectionStatus) {
            if statusItemController == nil {
                DDLogInfo("[AppKitBridge] No status item controller found. Creating one now.")
                statusItemController = StatusItemController()
            }
            statusItemController!.setStatus(status: status)
        }

        /// Enables or disables the embedded app launcher as a login item.
        @objc public func setAppLauncherEnabled(_ isEnabled: Bool) {
            guard let launcherBundleId = getLauncherBundleId() else {
                return DDLogError("[AppKitBridge] Unable to set launcher for missing bundle ID.")
            }

            if !SMLoginItemSetEnabled(launcherBundleId as! CFString, isEnabled) {
                return DDLogError("[AppKitBridge] Failed to set enable=\(isEnabled) for launcher \(launcherBundleId).")
            }

            return DDLogInfo("[AppKitBridge] Successfully set enable=\(isEnabled) for launcher \(launcherBundleId).")
        }

        /// Loads the main application from a given launcher bundle.
        @objc public func loadMainApp(_ launcherBundleId: String) {
            // Retrieve the main app's bundle ID programmatically from the embedded launcher bundle ID.
            let mainAppBundleId = getMainBundleId(launcherBundleId)
            DDLogInfo("[AppKitBridge] Loading main app \(mainAppBundleId) from launcher \(launcherBundleId).")

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
            DDLogError("[AppKitBridge] Failed to retrieve the application's bundle ID.")
            return nil
        }
        return String(format: "%@.%@", bundleId, AppKitBridge.kAppLauncherName)
    }

    /// Returns the main application's bundle ID from the embedded launcher bundle ID.
    private func getMainBundleId(_ launcherBundleId: String) -> String {
        return (launcherBundleId as NSString).deletingPathExtension
    }
#endif
