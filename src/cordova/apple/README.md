# Apple Development Instructions

This document describes how to develop and debug for macOS (formerly known as OS X) and iOS.

## Install requirements

You will need:

- An Apple Developer Account. You will need to be invited to your developer team as well.
- XCode 13.2+ ([download](https://developer.apple.com/xcode/))
- XCode command line tools: `xcode-select --install`

> NOTE: Should you encounter issues with your build, there may be apple-specific dependencies that are out of date. Run `npm run reset` and try again!



## Set up XCode project

The XCode project is created by Cordova. To create the project and open it on XCode, use `npm run action cordova/setup $PLATFORM`, then open the XCode workspace file (not the project).

For the **iOS** client and **Mac Catalyst** client:

```sh
npm run action cordova/build ios && open ./src/cordova/apple/ios.xcworkspace
```

For the **macOS** client:

```sh
SENTRY_DSN=https://public@sentry.example.com/1 npm run action cordova/setup macos -- --buildMode=release --versionName=0.0.0-dev && open ./src/cordova/apple/macos.xcworkspace
```

> **Note** On Apple Silicon the macOS web UI is broken in debug mode, so we need to build it in release mode. We are specifying a fake `SENTRY_DSN`, you should specify your own in your releases.

## Set up signing

1. In XCode, make sure you are logged into your Apple Developer account. Go to **Preferences > Accounts** and make sure your account is set.
1. Select "Outline" in the left navigation bar.
1. Under the "Signing & Capabilities" tab, select the "Jigsaw Operations LLC" for "Team".

## Run the App

### Specify the Destination

For the **macOS** client, you can run it directly on your macOS computer: **Product > Destination > My Mac**.

For the **iOS** client, you have a few options:
- Run on your macOS computer: **Product > Destination > My Mac (designed for iPad)**
  - This is a great option for development, but only available on Apple Silicon computers.
- Run on a physical iOS device
  - This is a great option to evaluate how it performs on a real device. You will need to enable development mode and register your device.
- Run on a simulator
  - This is helpful to test the UI, but the VPN doesn't work on simulators, so this option is not recommended.

See [Devices and Simulator](https://developer.apple.com/documentation/xcode/devices-and-simulator) for details on running on a physical iOS device or the simulator.

#### Adding support for your iOS device in XCode

You may find that your iOS version is _too modern_ for XCode. You'll need to do the following:

1. Download a folder corresponding to your iOS version from [this community-managed repository](https://github.com/iGhibli/iOS-DeviceSupport/tree/master/DeviceSupport).
2. Unzip the file and add it to XCode:

```
Applications >> Xcode >> Right Click >> Show Package Contents >> Contents >> Developer >> Platforms >> iPhoneOS.platform >> DeviceSupport
```

3. Restart XCode.


### Build and Start the App

To run the app, first **clean the build** (**Product > Clean Build Folder…** (Cmd+Shift+K)), then **run** (**Product > Run** (Cmd+Run)), via the menu or the play button:
<img width="802" alt="image" src="https://github.com/Jigsaw-Code/outline-internal-sdk/assets/113565/f3289c08-5f33-423a-a496-d5d764f4fce0">

> **Warning**
>
> If you don't clean the build first, it will fail with `Command CodeSign failed with a nonzero exit code`.


## Development

Most of the Apple-specific development can happen directly on XCode. However, if you edit files in the generated `platforms/ios` or `platforms/osx`, you will need to copy your changes to the appropriate version-controlled location at [`src/cordova/apple/xcode`](./xcode) or [`src/cordova/plugin/apple`](../plugin/apple).

Changes to the [OutlineAppleLib](./OutlineAppleLib) package don't need to be copied, since the package is linked by the XCode workspace and the changes happen in the original location.

## Inspect Logs

The easiest way to inspect logs is to use the `log` command. To see the client app logs in real time, you can use `log stream` with a `--predicate` flag to select the messages sent by the Outline code:

```sh
log stream  --info --predicate 'senderImagePath contains "Outline.app"'
```

In the Console app, select the **Action > Include Info Messages** manu, and set the filter to "Library Path" "contains" "Outline.app":

<img width="1371" alt="image" src="https://github.com/Jigsaw-Code/outline-client/assets/113565/812c9e14-be11-4a64-b90f-58a4bac138b1">

> 💡 Tip: You can **save searches** in the MacOS Console app.

For further debugging, you can include relevant messages from the Network Extension subsystem:
```sh
log stream  --info --predicate 'senderImagePath contains "Outline.app" or (processImagePath contains "Outline.app" and subsystem contains "com.apple.networkextension")'
```

To see past logs use `log show` and the `--last` flag.

For details on Apple logging, see [Your Friend the System Log](https://developer.apple.com/forums/thread/705868/) and [Mac Logging and the log Command: A Guide for Apple Admins](https://blog.kandji.io/mac-logging-and-the-log-command-a-guide-for-apple-admins#:~:text=The%20log%20command%20is%20built,(Press%20q%20to%20exit.)).


## Debug the Vpn Extension
The VpnExtension runs in a separate process and its output is not logged to the Xcode console. To view its log statements see the "Inspect Logs" section.

XCode doesn't automatically attach to the VpnExtension because it's started on demand by the system.

- If the Vpn Extension is running:
  - In XCode, select **Debug > Attach to Process > VpnExtension**
- If the VpnExtension is not running:
  - In Xcode, select **Debug > Attach to Process by PID or Name…**
  - Fill **PID or Process Name** with `VpnExtension` and press **Attach**

You won't see the log messages in the Xcode console. To see the messagges, refer to the "[Inspect Logs](#Inspect-Logs)" instructions.
For more info, see [Debug, Profile, and Test Your App Extension](https://developer.apple.com/library/content/documentation/General/Conceptual/ExtensibilityPG/ExtensionCreation.html#//apple_ref/doc/uid/TP40014214-CH5-SW8).

### Debug `VpnStartFailure`

Sometimes the app will refuse to connect, with a `VpnStartFailure` error:

<img width="283" alt="image" src="https://github.com/Jigsaw-Code/outline-client/assets/113565/5f6ff845-8be3-431d-a40c-98bcfbd6ec8a">

If that happens, there are some things you can try.


#### Kill any leftover processes

You can kill the app and extension with the [`pkill` command](https://man7.org/linux/man-pages/man1/pgrep.1.html):
```sh
pkill -9 Outline VpnExtension
```

Sometimes the processes will not die, even with `-9`. For the Outline process, you may need to kill its parent process, usually `debugserver`.

You can check running processes with the [`pgrep` command](https://man7.org/linux/man-pages/man1/pgrep.1.html):
```sh
pgrep Outline VpnExtension
```


#### Ensure the right extension is being loaded

The VpnExtension is an [application extension](https://developer.apple.com/library/content/documentation/General/Conceptual/ExtensibilityPG/) that handles the device’s traffic when the VPN is enabled. The system must be aware of the extension in order to invoke it. Normally, running the app is enough to trigger the registration of the VpnExtension. However, the system can get confused in a development environment, failing to register the plugin automatically, or using the extension from the production app, if you have it installed, or from a different build.

In your terminal, use the `pluginkit` command to inspect the registered plugins:
```sh
pluginkit -mvA | grep outline
```

You should see an for the VpnExtension in your Xcode project, where the version and binary location match.  This should output something similar to:

`org.outline.macos.client.VpnExtension(0.0.0-dev)   508D6616-9FCB-4302-B00F-22121C236AAC    2023-07-14 00:05:34 +0000       /Users/$USER/Library/Developer/Xcode/DerivedData/macos-bnidlwvulcdazjfxleynwzkychqi/Build/Products/Debug/Outline.app/Contents/PlugIns/VpnExtension.appex`

Note how `VpnExtension.appex` is inside `Outline.app/`.

It's safe to unregister all the Outline VPN Extensions, since the system will load them on demand. To do so, for each of them, call

```
plugintkit -r $APP_EXTENSION_PATH
```

Where the `$APP_EXTENSION_PATH` is the location of the `VpnExtension.appex` file from the pluginkit command.

If your extenstion is still not loading, you can try to force register it:

1. Determine the VpnExtension path
  1. In XCode, go to **Product > Show Build Folder in Finder**. That will open the `Build/` folder.
  1. The VpnExtension will be at `Build/Products/Debug/Outline.app/Contents/PlugIns/VpnExtension.appex`
1. Run `run pluginkit -a <your appex file>`, e.g. `pluginkit -a /Users/$USER/Library/Developer/Xcode/DerivedData/macos-bnidlwvulcdazjfxleynwzkychqi/Build/Products/Debug/Outline.app/Contents/PlugIns/VpnExtension.appex`

#### Delete the existing VPN configuration

You may want to also delete the VPN configurations:
1. Open the System Settings
1. Go to *VPN*
1. Press the Info button for the Outline service
1. Press *Remove Configuration…* and confirm


#### Restart

If all fails, restart your device. That usually takes care of the issue.

## Debug the web UI

To debug the webview:

1. You may need to enable the Develop menu first, by selecting **Settings > Advanced > Show Develop menu** in menu bar
1. In your terminal, run `defaults write org.outline.osx.client WebKitDeveloperExtras -bool true`.  This is only needed once, to make the Outline webview debuggable.  You may need to re-run the whole Outline app (use Cmd+R).
1. In the Outline Client app, right click → Inspect Context. This will open the Safari debugger

To reload the UI without re-running the application, right-click → Reload.
