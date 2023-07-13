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

    override required init() {
        super.init()
    }

    @objc func setConnectionStatus(_ isConnected: Bool) {
        if statusItemController == nil { NSLog("No status item controller found. Creating one now.")
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

      return NSLog("[AppKitBridge] Successfully set enable=%@ for launcher %@", String(isEnabled), launcherBundleId)
    }

    // Returns the embedded launcher application's bundle ID.
    private func getLauncherBundleId() -> String! {
      let kAppLauncherName:String! = "launcher"
      let bundleId: String! = Bundle.main.bundleIdentifier
      if bundleId == nil {
        NSLog("[AppKitBridge] Failed to retrieve the application's bundle ID")
        return nil
      }
      return String(format:"%@.%@", bundleId, kAppLauncherName)
    }
}
