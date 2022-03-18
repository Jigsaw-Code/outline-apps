# Outline Client
[![Build Release Candidates](https://github.com/Jigsaw-Code/outline-client/actions/workflows/build_release_candidates.yml/badge.svg)](https://github.com/Jigsaw-Code/outline-client/actions/workflows/build_release_candidates.yml)

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

### Windows Release

To build the release version of Windows installer, you need the following additional requirements:

* [Java 8+ Runtime](https://www.java.com/en/download/). This is required for the cross-platform Windows executable signing tool [Jsign](https://ebourg.github.io/jsign/). If you don't need to sign the executables, feel free to skip this.


## Error reporting

To enable error reporting through [Sentry](https://sentry.io/) for local builds, run:

``` bash
export SENTRY_DSN=[Sentry development API key]
[platform-specific build command]
```
Release builds on CI are configured with a production Sentry API key.


## Github Action Secrets

For your Github Actions to run smoothly, you'll need the following [Github Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) and [Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) set up:

### Repository-level Secrets
- `SENTRY_DSN` - [dsn required](https://docs.sentry.io/product/sentry-basics/dsn-explainer/) to enable sentry integration. Same across all platforms.

### `Client Apple` Environment

- `APPLE_CREDENTIALS_REPOSITORY_URL` - the url to the git repository containing your apple certificates and provisioning profiles, managed by [Match](https://docs.fastlane.tools/actions/match/)
- `APPLE_MATCH_GIT_BASIC_AUTHORIZATION` - the base64'd username and access token necessary to access that credentials repository
- `APPLE_MATCH_PASSWORD` - your Match password

- `APPLE_DEV_PORTAL_EMAIL_ADDRESS` - email address that your [Apple Developer Portal](https://developer.apple.com/) Account is under
- `APPLE_DEV_PORTAL_TEAM_ID` - ID of your Apple Developer Portal Account
- `APPLE_ITUNES_CONNECT_ID` - ID of your iTunes Connect Team Account

### `Client Android Release` Environment
- `ANDROID_KEY_STORE_CONTENTS` - the base64'd contents of your [android keystore.jkr](https://developer.android.com/training/articles/keystore) file
- `ANDROID_KEY_STORE_PASSWORD` - the password required to unlock your android keystore. We assume your key and keystore password are the same.

### `Releases Repository` Environment
- `RELEASES_REPOSITORY` - the username and repository name of the repository you're pushing releases to. In our case, `Jigsaw-Code/outline-releases`
- `RELEASES_DEPLOY_KEY` - an ssh secret key for the matching releases repository public deploy key - [how to set this up](https://docs.github.com/en/developers/overview/managing-deploy-keys#setup-2)

## Support

For support and to contact us, see: https://support.getoutline.org.  
