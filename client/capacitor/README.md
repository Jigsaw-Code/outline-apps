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
npx webpack    
npx capacitor-assets generate
npx cap sync
```

## Run the Apps

For iOS:

```sh
npx cap open ios
```

For Android:

```sh
npx cap open android
```
  

  ## TODOs

- [ ] Merge dependencies with parent package.json (Milestone 3)
