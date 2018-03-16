[![Build Status](https://travis-ci.com/Jigsaw-Code/outline-client.svg?token=HiP4RTme8LSvyrP9kNJq&branch=master)](https://travis-ci.com/Jigsaw-Code/outline-client)

# Requirements for all builds

All builds require [yarn](https://yarnpkg.com/en/docs/install), in addition to other per-platform requirements.  After cloning this repo, you should run "yarn" to install all dependencies.

# Building the web app

Outline clients shares the same web app across all platforms.  This code is located in the www directory.  If you are making changes to the shared web app and do not need to test platform-specific functionality, you can test in a desktop browser by running:

    yarn gulp build --platform=browser --watch

This command will automatically rebuild after any typescript file in the www directory changes, however it will need to be re-run to pick up other file changes.

Browser platform development will use fake servers to test successful and unsuccessful connections.

UI components are located in www/ui_components.  The app logic is located in www/app.

# Building the Android app

Additional requirements for Android:

* Android Studio
* Android SDK 23

To build for android, run:

    yarn gulp build --platform=android

To rebuild after modifying platform dependent files, run:

    yarn cordova platform rm android && yarn gulp build --platform=android

If this gives you unexpected Cordova errors, run:

    yarn run clean && yarn && yarn gulp build --platform=android

Cordova will generate a new Android project in the platforms/android directory.  Install the built apk by  platforms/android/build/outputs/apk/android-armv7-debug.apk

To learn more about developing for Android, see docs/android-development.md

## Building for Android with Docker

A Docker image with all pre-requisites for Android builds is included.  To build:

* Install dependencies with `./tools/build/build.sh yarn`
* Then build with `./tools/build/build.sh yarn gulp build --platform=android`

# Apple (macOS and iOS)

Additional requirements for Apple:

* An Apple Developer Account.  You will need to be invited to join the "Jigsaw Operations LLC" team
* XCode 9+ ([download](https://developer.apple.com/xcode/))
* XCode command line tools

To build for macOS (OS X), run:

    yarn run clean && yarn && yarn gulp build --platform=osx

To build for iOS, run:

    yarn run clean && yarn && yarn gulp build --platform=ios

To learn more about developing for Android, see docs/apple-development.md

# Windows

To build for Windows, run:

    yarn do electron/build

Unlike the Android and Apple clients, the Windows build uses the Electron framework, rather than Cordova.
