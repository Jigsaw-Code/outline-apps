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

import CocoaLumberjack
import CocoaLumberjackSwift
import Foundation
import OutlineShared
import ServiceManagement


@objcMembers
public class OutlineCatalystApp: NSObject {
    let appKitBridge: AppKitBridgeProtocol

    override public required init() {
        DDLog.add(DDOSLogger.sharedInstance)
        appKitBridge = createAppKitBridge()

        super.init()

        configureWindow()
        configureConnectionStatusMenu()

        // Enable app launcher to start on boot.
        appKitBridge.setAppLauncherEnabled(true)
    }

    private func configureWindow() {
        let scenes = UIApplication.shared.connectedScenes
        for scene in scenes {
            let windowScene = (scene as! UIWindowScene)
            windowScene.titlebar?.titleVisibility = .hidden
            windowScene.titlebar?.toolbar = nil
            windowScene.sizeRestrictions?.minimumSize = CGSizeMake(400, 550)
            windowScene.sizeRestrictions?.maximumSize = CGSizeMake(400, 550)
        }
    }

    private func configureConnectionStatusMenu() {
        // Initiate the connection status menu in disabled state by default.
        self.appKitBridge.setConnectionStatus(false)

        NotificationCenter.default.addObserver(forName: NSNotification.kVpnConnected,
                                               object: nil,
                                               queue: nil)
        { _ in
            self.appKitBridge.setConnectionStatus(true)
        }
        NotificationCenter.default.addObserver(forName: NSNotification.kVpnDisconnected,
                                               object: nil,
                                               queue: nil)
        { _ in
            self.appKitBridge.setConnectionStatus(false)
        }
    }
}
