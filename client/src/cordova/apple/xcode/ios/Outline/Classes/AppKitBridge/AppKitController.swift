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

    override public required init() {
        super.init()

        // Indicates that the application is an ordinary app that appears in the Dock and may have a user interface.
        NSApp.setActivationPolicy(.regular)
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
