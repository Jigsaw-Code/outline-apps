// Copyright 2025 The Outline Authors
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

    import CocoaLumberjack
    import CocoaLumberjackSwift
    import Foundation
    import OutlineNotification
    import NetworkExtension
    import UIKit
    import WebKit

    @objcMembers
    public class OutlineCatalystApp: NSObject {
        private static var webViewReference: WKWebView?
        
        public static func initApp() {
            DDLog.add(DDOSLogger.sharedInstance)

            let appKitController = loadAppKitIntegrationFramework()

            // Configure the window.
            let scenes = UIApplication.shared.connectedScenes
            for scene in scenes {
                let windowScene = (scene as! UIWindowScene)
                windowScene.titlebar?.titleVisibility = .hidden
                windowScene.titlebar?.toolbar = nil
                windowScene.sizeRestrictions?.minimumSize = CGSizeMake(400, 680)
                windowScene.sizeRestrictions?.maximumSize = CGSizeMake(400, 680)
            }

            // Initiate the connection status menu in unknown state by default.
            // TODO: Check status in case the the VPN is already running.
            appKitController._AppKitBridge_setConnectionStatus(.unknown)

            NotificationCenter.default.addObserver(forName: NSNotification.kVpnConnected,
                                                   object: nil,
                                                   queue: nil)
            { _ in
                appKitController._AppKitBridge_setConnectionStatus(.connected)
            }
            NotificationCenter.default.addObserver(forName: NSNotification.kVpnDisconnected,
                                                   object: nil,
                                                   queue: nil)
            { _ in
                appKitController._AppKitBridge_setConnectionStatus(.disconnected)
            }
            
            // Handle connection toggle from tray menu
            NotificationCenter.default.addObserver(forName: NSNotification.Name("toggleConnection"),
                                                   object: nil,
                                                   queue: nil)
            { _ in
                Task {
                    // First, ensure the window is open
                    NotificationCenter.default.post(name: NSNotification.Name("openApplication"), object: nil)
                    
                    // Wait a bit for the window to open
                    try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
                    
                    // Try to get the web view from our stored reference first
                    var webView = webViewReference
                    
                    // If we don't have a stored reference, try to find it once
                    if webView == nil {
                        webView = getWebView()
                        if webView != nil {
                            webViewReference = webView
                        }
                    }
                    
                    if let webView = webView {
                        // Let JS handle the connection
                        let js = """
                        window.dispatchEvent(new CustomEvent('connectFromMenu'));
                        """
                        try? await webView.evaluateJavaScript(js)
                    }
                }
            }
            
            // Listen for web view lifecycle events to store the reference
            NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
                                                   object: nil,
                                                   queue: nil)
            { _ in
                // Update web view reference when app becomes active
                webViewReference = getWebView()
            }
        }
    }

    public func loadAppKitIntegrationFramework() -> NSObject {
        if let frameworksPath = Bundle.main.privateFrameworksPath {
            let bundlePath = "\(frameworksPath)/AppKitIntegration.framework"
            do {
                try Bundle(path: bundlePath)?.loadAndReturnError()

                let bundle = Bundle(path: bundlePath)!
                DDLogInfo("[CatalystApp] AppKit bundle loaded successfully")

                if let appKitControllerClass = bundle.classNamed("AppKitIntegration.AppKitController") as? NSObject.Type {
                    return appKitControllerClass.init()
                }
            } catch {
                DDLogInfo("[CatalystApp] Error loading: \(error)")
            }
        }
        preconditionFailure("[CatalystApp] Unable to load")
    }

    func isActiveSession(_ session: NEVPNConnection?) -> Bool {
        let vpnStatus = session?.status
        return vpnStatus == .connected || vpnStatus == .connecting || vpnStatus == .reasserting
    }

    // Helper function to get the web view
    private func getWebView() -> WKWebView? {
        DDLogInfo("[Outline] Searching for web view in scenes")
        for scene in UIApplication.shared.connectedScenes {
            if let windowScene = scene as? UIWindowScene {
                for window in windowScene.windows {
                    if let webView = findWebView(in: window) {
                        return webView
                    }
                }
            }
        }
        DDLogInfo("[Outline] No web view found in any scene")
        return nil
    }
    
    // Helper function to recursively search for web view
    private func findWebView(in view: UIView) -> WKWebView? {
        if let webView = view as? WKWebView {
            return webView
        }
        
        for subview in view.subviews {
            if let webView = findWebView(in: subview) {
                return webView
            }
        }
        
        return nil
    }

#endif
