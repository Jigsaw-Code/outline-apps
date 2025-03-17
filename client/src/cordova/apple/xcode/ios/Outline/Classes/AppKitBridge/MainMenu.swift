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

import Cocoa

class MainMenu: NSMenu {
    private enum Messages {
        static let quit = NSLocalizedString(
            "quit",
            bundle: Bundle(for: MainMenu.self),
            comment: "Tray menu entry to quit the application."
        )
        static let confirmAlert = NSLocalizedString(
            "quit_confirm_alert",
            bundle: Bundle(for: MainMenu.self),
            comment: "Alert title to confirm quitting the application."
        )
        static let confirmAlertInfo = NSLocalizedString(
            "quit_confirm_alert_info",
            bundle: Bundle(for: MainMenu.self),
            comment: "Alert info to confirm quitting the application."
        )
        static let confirmCloseWindow = NSLocalizedString(
            "quit_confirm_close_window",
            bundle: Bundle(for: MainMenu.self),
            comment: "Alert button to close the application window."
        )
        static let confirmQuitApplication = NSLocalizedString(
            "quit_confirm_terminate_application",
            bundle: Bundle(for: MainMenu.self),
            comment: "Alert button to terminate the application."
        )
    }

    init() {
        super.init(title: "")
        addSubmenu(createApplicationMenu())
    }

    @available(*, unavailable)
    required init(coder _: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func addSubmenu(_ menu: NSMenu) {
        // Menu item titles are internal identifiers and should not be translated.
        // Menu bar text is derived from submenu titles, except for the application menu,
        // which uses a system-provided title.
        let menuItem = addItem(withTitle: "", action: nil, keyEquivalent: "")
        setSubmenu(menu, for: menuItem)
    }

    private func createApplicationMenu() -> NSMenu {
        let menu = NSMenu()

        let closeMenuItem = NSMenuItem(title: Messages.quit, action: #selector(confirmAndQuit), keyEquivalent: "q")
        closeMenuItem.target = self
        menu.addItem(closeMenuItem)

        return menu
    }

    @objc func confirmAndQuit() {
        let alert = NSAlert()
        alert.messageText = Messages.confirmAlert
        alert.informativeText = Messages.confirmAlertInfo
        alert.addButton(withTitle: Messages.confirmCloseWindow)
        alert.addButton(withTitle: Messages.confirmQuitApplication)

        guard let mainWindow = NSApp.getMainWindow() else {
            NSApp.terminate(nil)
            return
        }
        mainWindow.orderFront(self)
        alert.beginSheetModal(for: mainWindow) { response in
            switch response {
            case .alertFirstButtonReturn:
                mainWindow.close()
            case .alertSecondButtonReturn:
                NSApp.terminate(nil)
            default:
                break
            }
        }
    }
}
