// Copyright 2018 The Outline Authors
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

import Cocoa
import OutlineTunnel
import UIKit	

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
  static let kAppGroup = "QT8Z3Q9V3A.org.outline.macos.client"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let appKitBundle = AppKitBundleLoader()
        defer {
            NSLog("Exiting...")
            appKitBundle.appKitBridge!.terminate()
        }

        if !self.shouldLaunchMainApp() {
            NSLog("Not launching, Outline not connected at shutdown")
            return false
        }
        NSLog("Outline connected at shutdown. Launching")

        guard let launcherBundleId = Bundle.main.bundleIdentifier else {
            NSLog("Failed to retrieve the bundle ID for the launcher app.")
            return false
        }
        appKitBundle.appKitBridge!.loadMainApp(launcherBundleId)
        return true
    }
    
    // Returns whether the launcher should launch the main app.
    private func shouldLaunchMainApp() -> Bool {
        let tunnelStore = OutlineTunnelStore(appGroup: AppDelegate.kAppGroup)
        return tunnelStore.status == OutlineTunnel.TunnelStatus.connected
    }
}
