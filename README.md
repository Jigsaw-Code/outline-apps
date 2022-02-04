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

    npm run action gulp build browser
    npx cordova run browser

The latter command will open a browser instance running the app. Browser platform development will use fake servers to test successful and unsuccessful connections.

UI components are located in [src/www/ui_components](src/www/ui_components). The app logic is located in [src/www/app](src/www/app).

*Tip: Build with `(export BUILD_ENV=development; npm run action gulp -- build browser)` to enable source maps.*

## Building the Android app

Additional requirements for Android:

* [Android Studio 2020.3.1+](https://developer.android.com/studio)
* [Latest Android Sdk Commandline Tools](https://developer.android.com/studio/command-line)
* Android SDK 30 (with build-tools) via commandline `sdkmanager "platforms;android-30" "build-tools;30.0.3"`
* [Gradle 7.3+](https://gradle.org/install/)

> 💡 NOTE: If you're running linux, you can automatically set up the development environment by running `bash ./tools/build/setup_linux_android.sh`

To build for android, run:

    npm run action gulp build android

To rebuild after modifying platform dependent files, run:

    npx cordova platform rm android && npm run action gulp build android

If this gives you unexpected Cordova errors, run:

    npm run clean && npm ci && npm run action gulp build android

Cordova will generate a new Android project in the platforms/android directory. Install the built apk by `platforms/android/app/build/outputs/apk/<processor>/debug/app-<processor>-debug.apk` (You will need to find the corresponding `<processor>` architecture if you choose to install the apk on a device).

To learn more about developing for Android, see [docs/android-development](docs/android-development.md).

### Building for Android with Docker

A Docker image with all pre-requisites for Android builds is included.  To build:

* Install dependencies with `./tools/build/build.sh npm ci`
* Then build with `./tools/build/build.sh npm run action gulp -- build android`
  
## Apple (macOS and iOS)

Additional requirements for Apple:

* An Apple Developer Account.  You will need to be invited to join the "Jigsaw Operations LLC" team
* XCode 13+ ([download](https://developer.apple.com/xcode/))
* XCode command line tools: `xcode-select --install`

To build for macOS (OS X), run:

    npm run action gulp build osx

To build for iOS, run:

    npm run action gulp build ios

To open the macOS project on XCode:

    open ./platforms/osx/Outline.xcodeproj

To open the iOS project on XCode:

    open ./platforms/ios/Outline.xcodeproj

To learn more about developing for Apple, see [docs/apple-development](docs/apple-development.md)

## Electron

Unlike the Android and Apple clients, the Windows and Linux clients use the Electron framework, rather than Cordova.

Additional requirements for building on Windows:

* [Cygwin](https://cygwin.com/install.html). It provides the "missing Unix pieces" required by build system such as rsync (and many others). Besides the default selected Unix tools such as `bash` and `rsync`, please also make sure to install `git` during Cygwin installation as well. You will need to clone this repository using `git` in Cygwin instead of the native Windows version of git, in order to ensure Unix line endings.

To build the Electron clients, run (it will also package an installer executable into `build/dist`):

```sh
npm run action src/electron/build [windows|linux]
```

To run the Electron clients, run:

```sh
npm run action src/electron/start [windows|linux]
```


## Error reporting

To enable error reporting through [Sentry](https://sentry.io/) for local builds, run:

``` bash
export SENTRY_DSN=[Sentry development API key]
[platform-specific build command]
```
Release builds on CI are configured with a production Sentry API key.

## Support

For support and to contact us, see: https://support.getoutline.org.  
