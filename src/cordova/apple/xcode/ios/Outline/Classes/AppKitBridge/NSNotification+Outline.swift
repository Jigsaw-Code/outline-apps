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

import Foundation

extension Notification.Name {
    static let kAppOpen = Notification.Name("appOpen")
    static let kAppQuit = Notification.Name("appQuit")
    static let kVpnConnected = Notification.Name("vpnConnected")
    static let kVpnDisconnected = Notification.Name("vpnDisconnected")
}

@objc extension NSNotification {
    public static let kAppOpen = Notification.Name.kAppOpen
    public static let kAppQuit = Notification.Name.kAppQuit
    public static let kVpnConnected = Notification.Name.kVpnConnected
    public static let kVpnDisconnected = Notification.Name.kVpnDisconnected
}
