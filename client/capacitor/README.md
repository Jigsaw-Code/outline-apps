# Capacitor Development Instructions

This document describes how to develop and debug for iOS & Android for Capacitor.



## Set up your environment

Install these pre-requisites:

```sh
 npm install @capacitor/cli @capacitor/core @capacitor/device @capacitor/assets
 npm install -D webpack-cli 
```

## Set up the Apps

Then run the following on the command-line:

```sh
npm run action client/capacitor/setup
```

## Run the Apps

For iOS:

```sh
npm run action client/capacitor/build ios
```

For Android:

```sh
npm run action client/capacitor/build android
```