# Android Development Instructions

This document describes how to develop and debug for Android.  It assumes you have already successfully completed the build instructions from the top-level README.

The main entrypoint to Android's Java code is `cordova-plugin-outline/android/java/org/outline/OutlinePlugin.java`

### To install the APK

* Connect an Android device and enable [USB debugging](https://developer.android.com/studio/debug/dev-options.html#enable).
* Build the app, with `yarn gulp build --platform=android`
* From the project root, run:  `adb install -r -d platforms/android/build/outputs/apk/android-armv7-debug.apk`

### To debug the web app on Android

Run Outline on your phone with [USB debugging enabled](https://developer.android.com/studio/debug/dev-options.html#enable), then on Chrome:

* Go to chrome://inspect
* Find Outline
* Click inspect
* Open the Console
* Note that all TypeScript code is browserified in a single cordova_main.js

### To debug Java code

Using Android Studio

* Open existing project → <root_project_dir>/platforms/android
* Click on "Android Monitor" at the bottom
* Make sure org.outline.android.client is selected from the middle menu (it should not say "no debuggable processes")
