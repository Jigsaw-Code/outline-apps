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

#if targetEnvironment(macCatalyst)
    import Foundation

    @objcMembers class AppKitBundleLoader: NSObject {
        private enum BridgeBundle {
            static let fileName = "AppKitBridge.bundle"
        }

        var appKitBridge: AppKitBridgeProtocol?

        override required init() {
            super.init()
            loadBundle()
        }

        private func loadBundle() {
            guard let bundleURL = Bundle.main.builtInPlugInsURL?.appendingPathComponent(BridgeBundle.fileName) else {
                preconditionFailure("[AppKitBundleLoader] \(BridgeBundle.fileName) should exist")
            }
            guard let bundle = Bundle(url: bundleURL) else {
                preconditionFailure("[AppKitBundleLoader] \(BridgeBundle.fileName) should exist")
            }
            NSLog("[AppKitBundleLoader] Loaded Successfully")
            let className = "AppKitBridge.AppKitBridge"
            guard let appKitBridgeClass = bundle.classNamed(className) as? AppKitBridgeProtocol.Type else {
                preconditionFailure("[AppKitBundleLoader] Cannot initialise \(className) from \(BridgeBundle.fileName)")
            }
            appKitBridge = appKitBridgeClass.init()
        }
    }
#endif
