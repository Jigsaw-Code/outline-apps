# Capacitor Development Instructions

This document describes how to develop and debug for iOS & Android for Capacitor.



## Set up your environment

Install these pre-requisites:

  ```shell
 npm install @capacitor/cli @capacitor/core @capacitor/device @capacitor/assets
 npm install -D webpack-cli 
  ```


## Set up the Apps

Then run the following on the command-line:


  ```shell
npx webpack    
npx cap sync
  ```


## Run the Apps

For iOS:

  ```shell
npx cap open ios
  ```

For Android:

  ```shell
npx cap open android
  ```
  