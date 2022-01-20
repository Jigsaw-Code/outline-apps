# Outline Client
[![Build Status](https://travis-ci.org/Jigsaw-Code/outline-client.svg?branch=master)](https://travis-ci.org/Jigsaw-Code/outline-client)

The Outline Client is a cross-platform VPN or proxy client for Windows, macOS, iOS, Android, and ChromeOS.  The Outline Client is designed for use with the [Outline Server](https://github.com/Jigsaw-Code/outline-server) software, but it is fully compatible with any [Shadowsocks](https://shadowsocks.org/) server.

The client's user interface is implemented in [Polymer](https://www.polymer-project.org/) 2.0.  Platform support is provided by [Cordova](https://cordova.apache.org/) and [Electron](https://electronjs.org/), with additional native components in this repository.

## Requirements for all builds

All builds require [Node](https://nodejs.org/) 16, in addition to other per-platform requirements. 

> 💡 NOTE: if you have `nvm` installed, run `nvm use` to switch to the correct node version!

After cloning this repo, install all node dependencies:
```sh
npm install
```

## Building the web app

Outline clients share the same web app across all platforms. This code is located in the src/www directory. If you are making changes to the shared web app and do not need to test platform-specific functionality, you can test in a desktop browser by running:

    npx gulp build --platform=browser
    npx cordova run browser

The latter command will open a browser instance running the app. Browser platform development will use fake servers to test successful and unsuccessful connections.

UI components are located in [src/www/ui_components](src/www/ui_components). The app logic is located in [src/www/app](src/www/app).

*Tip: Build with `(export BUILD_ENV=development; npx gulp build --platform=browser)` to enable source maps.*

## Building the Android app

Additional requirements for Android:

* Android Studio 4+
* Android SDK 29

> 💡 NOTE: If you're running linux, you can automatically set up the development environment by running `bash ./tools/build/setup_linux_android.sh`

To build for android, run:

    npx gulp build --platform=android

To rebuild after modifying platform dependent files, run:

    npx cordova platform rm android && npx gulp build --platform=android

If this gives you unexpected Cordova errors, run:

    npm run clean && npm ci && npx gulp build --platform=android

Cordova will generate a new Android project in the platforms/android directory.  Install the built apk by  platforms/android/build/outputs/apk/android-armv7-debug.apk

To learn more about developing for Android, see [docs/android-development](docs/android-development.md).

### Building for Android with Docker

A Docker image with all pre-requisites for Android builds is included.  To build:

* Install dependencies with `./tools/build/build.sh npm ci`
* Then build with `./tools/build/build.sh npx gulp build --platform=android`
  
## Apple (macOS and iOS)

Additional requirements for Apple:

* An Apple Developer Account.  You will need to be invited to join the "Jigsaw Operations LLC" team
* XCode 13+ ([download](https://developer.apple.com/xcode/))
* XCode command line tools: `xcode-select --install`


To open the macOS project on XCode (need to build first):
```
open ./platforms/osx/Outline.xcodeproj
```

To open the iOS project on XCode (need to build first):
```
open ./platforms/ios/Outline.xcodeproj
```

To build for macOS (OS X), run:
```
npx gulp build --platform=osx
```

To build for iOS, run:
```
npx gulp build --platform=ios
```

To learn more about developing for Apple, see [docs/apple-development](docs/apple-development.md)


## Electron

Unlike the Android and Apple clients, the Windows and Linux clients use the Electron framework, rather than Cordova.

### Windows

Additional requirements for building on Windows:

* [Cygwin](https://cygwin.com/install.html). It provides the "missing Unix pieces" required by build system such as rsync (and many others).  It may be necessary to manually choose to install `rsync` in the Cygwin installer.

To build the Electron clients, run:

    npm run action src/electron/build

To run the Electron clients, run:

    npm run action src/electron/start

To package the Electron clients into an installer executable, run:

    npm run action src/electron/package_[linux|windows]


## Error reporting

To enable error reporting through [Sentry](https://sentry.io/) for local builds, run:
``` bash
export SENTRY_DSN=[Sentry development API key]
[platform-specific build command]
```
Release builds on CI are configured with a production Sentry API key.

## Support

For support and to contact us, see: https://support.getoutline.org.  
