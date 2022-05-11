# Android Development Instructions

This document describes how to develop and debug for Android.

The main entrypoint to Android's Java code is `cordova-plugin-outline/android/java/org/outline/OutlinePlugin.java`

## Building the Android app

Additional requirements for Android:

- [Android Studio 2020.3.1+](https://developer.android.com/studio)
  - Optional for building, but useful for development
- [Latest Android Sdk Commandline Tools](https://developer.android.com/studio/command-line)
  - Place it at `$HOME/Android/Sdk/cmdline-tools/latest`
- Android SDK 30 (with build-tools) via commandline `$HOME/Android/Sdk/cmdline-tools/latest/bin/sdkmanager "platforms;android-30" "build-tools;30.0.3"`
  - Set up the environment: `export ANDROID_SDK_ROOT=$HOME/Android/Sdk` (`ANDROID_HOME` is the [recommendation](https://developer.android.com/studio/command-line/variables), but Cordova wants `ANDROID_SDK_ROOT`)
- [Gradle 7.3+](https://gradle.org/install/)

> 💡 NOTE: If you're running linux, you can automatically set up the development environment by running `bash ./tools/build/setup_linux_android.sh`

To build for android, run:

```sh
  npm run action cordova/build android
```

Make sure to rebuild after modifying platform dependent files!

> 💡 NOTE: If this command ever gives you unexpected Cordova errors, try runnning `npm run reset` first.

Cordova will generate a new Android project in the platforms/android directory. Install the built apk by `platforms/android/app/build/outputs/apk/<processor>/debug/app-<processor>-debug.apk` (You will need to find the corresponding `<processor>` architecture if you choose to install the apk on a device).

### Building for Android with Docker

A Docker image with all pre-requisites for Android builds is included. To build:

- Install dependencies with `./tools/build/build.sh npm ci`
- Then build with `./tools/build/build.sh npm run action gulp -- build android`

### To install the APK

* Connect an Android device and enable [USB debugging](https://developer.android.com/studio/debug/dev-options.html#enable).
* Build the app, with `npm run action cordova/build android`
* From the project root, run: `adb install -r -d platforms/android/app/build/outputs/apk/<processor>/debug/app-<processor>-debug.apk`

### To debug the web app on Android

Run Outline on your phone with [USB debugging enabled](https://developer.android.com/studio/debug/dev-options.html#enable), then on Chrome:

* Go to [chrome://inspect](chrome://inspect)
* Find Outline
* Click inspect
* Open the Console
* Note that all TypeScript code is browserified in a single cordova_main.js

### To debug Java code

Using Android Studio

* Open existing project → `<root_project_dir>/platforms/android`
* Click on "Android Monitor" at the bottom
* Make sure `org.outline.android.client` is selected from the middle menu (it should not say "no debuggable processes")
