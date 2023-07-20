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
import NetworkExtension
import UIKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let appKitBundle = AppKitBundleLoader()
        self.shouldLaunchMainApp() { shouldLaunch in
            defer {
                NSLog("Exiting launcher...")
                appKitBundle.appKitBridge!.terminate()
            }
            if !shouldLaunch {
                NSLog("Not launching, Outline not connected at shutdown")
                return
            }
            NSLog("Outline connected at shutdown. Launching")

            guard let launcherBundleId = Bundle.main.bundleIdentifier else {
                NSLog("Failed to retrieve the bundle ID for the launcher app.")
                return
            }
            appKitBundle.appKitBridge!.loadMainApp(launcherBundleId)
        }
        return true
    }

    // Returns whether the launcher should launch the main app.
    private func shouldLaunchMainApp(completion: @escaping(Bool) -> Void) {
        NETunnelProviderManager.loadAllFromPreferences() { (managers, error) in
            guard error == nil, managers != nil else {
                NSLog("Failed to get tunnel manager: \(String(describing: error))")
                return completion(false)
            }
            guard let manager: NETunnelProviderManager = managers!.first, managers!.count > 0 else {
                NSLog("No tunnel managers found.")
                return completion(false)
            }
            NSLog("Tunnel manager found.")
            return completion(manager.isOnDemandEnabled)
        }
    }
}
