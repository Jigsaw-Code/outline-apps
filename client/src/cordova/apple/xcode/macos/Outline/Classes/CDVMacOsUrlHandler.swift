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

import Foundation

// Class to handle URL interception in Cordova MacOS by surfacing the intercepted URL to JavaScript.
@objcMembers
class CDVMacOsUrlHandler: NSObject {
  static let kCDVHandleOpenURLNotification = "CDVOpenURLNotification"
  static let kHandleOpenUrlJsFormat = "document.addEventListener('deviceready',function(){" +
      "if (typeof handleOpenURL === 'function') { handleOpenURL(\"%@\");}});"
  static let kPageLoadWaitSecs = 0.5

  private let webView: WebView
  private var url: String? = nil

  init(_ webView: WebView) {
    self.webView = webView
    super.init()

    NotificationCenter.default.addObserver(
        self, selector: #selector(self.handleOpenUrl),
        name: NSNotification.Name(rawValue:CDVMacOsUrlHandler.kCDVHandleOpenURLNotification),
        object: nil)
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  @objc private func handleOpenUrl(_ notification: Notification) {
    guard let url = notification.object as? String else {
      return NSLog("Received non-String object.");
    }
    self.url = url
    NSLog("Intercepted URL.");
    Thread.detachNewThreadSelector(#selector(self.sendUrlToJs), toTarget: self, with: nil);
  }

  @objc func sendUrlToJs() {
    guard let url = self.url else {
      return
    }
    while (self.webView.isLoading) {
      // Wait until the page is loaded in case the app launched with the intercepted URL.
      Thread.sleep(forTimeInterval: CDVMacOsUrlHandler.kPageLoadWaitSecs)
    }
    let handleOpenUrlJs = String.init(format: CDVMacOsUrlHandler.kHandleOpenUrlJsFormat, url)
    DispatchQueue.main.async {
      self.webView.stringByEvaluatingJavaScript(from: handleOpenUrlJs)
      self.url = nil
    }
  }
}
