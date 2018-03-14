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

# Localization

### Prerequisites

- [Transifex CLI](https://docs.transifex.com/client/installing-the-client) (`tx`), to work with translations.
- Access to the [outline-client](https://www.transifex.com/outline/outline-client/dashboard) Transifex project. Ask a team member if you don't have access.

### Setup

Next, you need to set up your Transifex credentials to access the project remotely. Follow [these instructions](https://docs.transifex.com/client/client-configuration#~/-transifexrc) to configure `~/.transifexrc`.

Transifex CLI supports authentication via username/password or [API token](https://docs.transifex.com/api/introduction#authentication). Note that if you change your credentials or delete the API token, you will have to update `~/.transifexrc`.

Learn about the details of Transifex tool in the [Introduction to the Client](https://docs.transifex.com/client/introduction).

### Message Files and Transifex Configuration

The [.tx/config](.tx/config) file is used to map message files in our repo to resources in Transifex. See [Configuration Files](https://docs.transifex.com/client/client-configuration#-tx/config) for more information on the config format.

The message files use the [JSON Format](https://docs.transifex.com/formats/json) and are named `www/messages/<lang>.json`.

### Add new messages or translations

When you add new messages or new translations, you need to push them to Transifex for the messages to be translated or the translations to be updated.

To push new messages and translations to Transifex:

    tx push -s -t

### Retrieve translations

To get translations from Transifex:

    tx pull
