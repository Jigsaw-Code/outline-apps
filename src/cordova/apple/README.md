# Apple Development Instructions

This document describes how to develop and debug for macOS (formerly known as OS X) and iOS. You will need:

- An Apple Developer Account. You will need to be invited to your developer team as well.
- XCode 13.2+ ([download](https://developer.apple.com/xcode/))
- XCode command line tools: `xcode-select --install`

> NOTE: Should you encounter issues with your build, there may be apple-specific dependencies that are out of date. Run `npm run clean` and try again!

## iOS

To build for iOS, run:

```sh
  npm run action cordova/build ios
```

To open the iOS project on XCode:

```sh
  open ./platforms/ios/Outline.xcworkspace
```

### Adding support for your device in XCode

You may find that your iOS version is _too modern_ for XCode. You'll need to do the following:

1. Download a folder corresponding to your iOS version from [this community-managed repository](https://github.com/iGhibli/iOS-DeviceSupport/tree/master/DeviceSupport).
2. Unzip the file and add it to XCode:

```
Applications >> Xcode >> Right Click >> Show Package Contents >> Contents >> Developer >> Platforms >> iPhoneOS.platform >> DeviceSupport
```

3. Restart XCode!

## macOS

To build for macOS (OS X), run:

```sh
  npm run action cordova/build macos
```

To open the macOS project on XCode:

```sh
  open ./platforms/osx/Outline.xcodeproj
```

### MacOS Development in XCode

We recommend that you develop OS X specific functionality in the `platforms/osx` directory.  However this is not version-controlled.  Once you have made your changes in the `platforms/osx` directory, be sure to copy it to the version-controlled source code in `cordova-plugin-outline/apple/`

To run the project in XCode:

* open `platforms/osx/Outline.xcodeproj`
* Make sure you are logged into your Apple Developer account.  Go to Preferences → Accounts, make sure your account is set.
* Click "Outline" in the left navigation bar:
  * Under "Signing" select "Jigsaw Operations LLC"
  * Click Register Device - needed the first time running the app on a new device.
* Press Cmd+R to run

The main entry point for Apple specific code is `Outline/Plugins/OutlinePlugin.swift`

### To debug the MacOS VpnExtension process

* VpnExtension runs in a separate process and its output is not logged to the Xcode console. To view its log statements, open the Console.app and filter messages that contain "Outline" or “VpnExtension”.
* In XCode, click top Debug menu → Attach to Process → VpnExtension
  * This can only be done once the VPN Extension is running (after you are connected).
  * [Detailed instructions](https://developer.apple.com/library/content/documentation/General/Conceptual/ExtensibilityPG/ExtensionCreation.html#//apple_ref/doc/uid/TP40014214-CH5-SW8).

### Debugging the MacOS UI

To debug the macOS webview:

* In your terminal, run `defaults write org.outline.osx.client WebKitDeveloperExtras -bool true`.  This is only needed once, to make the Outline webview debuggable.  You may need to re-run the whole Outline app (use Cmd+R).
* Once this is done, right click → Inspect Context in the Outline client app. This will open the safari debugger
* To reload the UI without re-running the application, right-click → Reload.

### Fixing the MacOS VpnExtension configuration:

The VpnExtension is an [application extension](https://developer.apple.com/library/content/documentation/General/Conceptual/ExtensibilityPG/) that handles the device’s traffic when the VPN is enabled. The system must be aware of the extension in order to invoke it. Normally, running the app is enough to trigger the registration of the VpnExtension. However, the system can get confused in a development environment, failing to register the plugin automatically.

If you cannot connect to a server due to a VPN error:

* In your terminal, run `pluginkit -m -v | grep outline` to search for the VpnExtension plugin - you should see one for your new Xcode project, where the version and binary location match.  This should output something similar to:
  * `org.outline.osx.client.VpnExtension(0.1.2) 970A0E28-06F0-4658-A194-EE755155644C  2018-01-26 21:51:06 +0000 /Users/$USER/Library/Developer/Xcode/DerivedData/Outline-buohazzevizjuxclukgvoyyvsonu/Build/Products/Debug/Outline.app/Contents/PlugIns/VpnExtension.appex`
* To learn the path of your VpnExtension:
  * In XCode, click on the Folder Icon (top left), then navigate to the Products folder
  * Drag the "Outline.app" item to the terminal - this will tell you the path of the app, something like `/Users/$USER/Library/Developer/Xcode/DerivedData/Outline-buohazzevizjuxclukgvoyyvsonu/Build/Products/Debug/Outline.app/`
  * In that directory, look for `Contents/PlugIns/VpnExtension.appex/`, e.g. `/Users/$USER/Library/Developer/Xcode/DerivedData/Outline-buohazzevizjuxclukgvoyyvsonu/Build/Products/Debug/Outline.app/Contents/PlugIns/VpnExtension.appex/`
* In the terminal, run pluginkit -a <your appex file>, e.g. `pluginkit -a /Users/$USER/Library/Developer/Xcode/DerivedData/Outline-buohazzevizjuxclukgvoyyvsonu/Build/Products/Debug/Outline.app/Contents/PlugIns/VpnExtension.appex/`
* Open Mac Settings → Network, then delete the Outline network
