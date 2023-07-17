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

class AppKitBridge: NSObject, AppKitBridgeProtocol {
    private var statusItemController: OutlineStatusItemController?
    static let kAppGroup = "QT8Z3Q9V3A.org.outline.macos.client"
    static let kAppLauncherName = "launcher"

    override required init() {
        super.init()
    }

    @objc func terminate() {
        NSApp.terminate(self)
    }

    @objc func setConnectionStatus(_ isConnected: Bool) {
        if statusItemController == nil {
            NSLog("[AppKitBridge] No status item controller found. Creating one now.")
            statusItemController = OutlineStatusItemController()
        }
        statusItemController!.setStatus(isConnected: isConnected)
    }

    // Enables or disables the embedded app launcher as a login item.
    @objc func setAppLauncherEnabled(_ isEnabled: Bool) {
        guard let launcherBundleId = self.getLauncherBundleId() else {
          return NSLog("[AppKitBridge] Unable to set launcher for missing bundle ID.")
        }

      if !SMLoginItemSetEnabled((launcherBundleId as! CFString), isEnabled) {
        return NSLog("[AppKitBridge] Failed to set enable=%@ for launcher %@", String(isEnabled), launcherBundleId)
      }

      return NSLog("[AppKitBridge] Successfully set enable=%@ for launcher %@.", String(isEnabled), launcherBundleId)
    }

    // Loads the main application from a given launcher bundle.
    @objc func loadMainApp(_ launcherBundleId: String) {
        // Retrieve the main app's bundle ID programmatically from the embedded launcher bundle ID.
        let mainAppBundleId = self.getMainBundleId(launcherBundleId)

        NSLog("[AppKitBridge] Loading main app %@ from launcher %@.", mainAppBundleId!, launcherBundleId)

        let descriptor = NSAppleEventDescriptor(string: launcherBundleId)
        NSWorkspace.shared.launchApplication(withBundleIdentifier: mainAppBundleId!,
                                             options: [.withoutActivation, .andHide],
                                             additionalEventParamDescriptor: descriptor,
                                             launchIdentifier: nil)
    }

    // Returns the embedded launcher application's bundle ID.
    private func getLauncherBundleId() -> String! {
        guard let bundleId = Bundle.main.bundleIdentifier else {
            NSLog("[AppKitBridge] Failed to retrieve the application's bundle ID.")
            return nil
        }
        return String(format:"%@.%@", bundleId, AppKitBridge.kAppLauncherName)
    }

    // Returns the main application's bundle ID from the embedded launcher bundle ID.
    private func getMainBundleId(_ launcherBundleId: String) -> String! {
        return (launcherBundleId as NSString).deletingPathExtension
    }
}
