# <img alt="Outline Client Logo" src="../docs/resources/logo_client.png" title="Outline Client" width="32">&nbsp;&nbsp;Outline Client

This document provides a guide for AI agents working on the Outline Client.

## Directory Structure

The `/client` directory contains the source code for all Outline client applications. Here's a breakdown of the key subdirectories:

*   `/electron`: Contains the Electron-specific code for the desktop client, including the main process, preload scripts, and build configurations.
*   `/go`: Contains the Go source code for the client-side VPN tunnel.
*   `/src/cordova`: Contains the Cordova-specific code for the mobile clients (iOS and Android).
*   `/src/www`: Contains the shared web-based UI components, built with Polymer and TypeScript. This code is used by both the Electron and Cordova applications.

## Key Technologies

*   **Electron**: Used to build the desktop client for Windows, macOS, and Linux.
*   **Cordova**: Used to build the mobile clients for iOS and Android.
*   **Polymer**: The primary UI framework for the client's web-based components.
*   **TypeScript**: Used for all web-based code.
*   **Go**: Used to implement the client-side VPN tunnel.

## Building and Running the Client

The `npm run action` command is used to build and run the client applications.

### Shared Web App Development

If you are making changes to the shared web app and do not need to test platform-specific functionality, you can test in a desktop browser by running:

```sh
npm run action client/src/www/start
```

The app logic is located in `src/www/app`. UI components are located in `src/www/ui_components`. To work on an individual UI element, use Storybook:

```sh
npm run action storybook
```

### Electron Client

*   **Build (Linux)**: `npm run action client/electron/build linux`
*   **Build (Windows)**: `npm run action client/electron/build windows`
*   **Build (macOS)**: `npm run action client/electron/build macos`
*   **Run**: `npm run action client/electron/start`

### Cordova Clients (Mobile)

*   **Setup**: `npm run action client/src/cordova/setup` (run once before building)
*   **Build (Android)**: `npm run action client/src/cordova/build android`
*   **Build (iOS)**: `npm run action client/src/cordova/build ios`
*   **Run (Android)**: `npm run action client/src/cordova/run android`
*   **Run (iOS)**: `npm run action client/src/cordova/run ios`

### Configuration Flags

Certain actions take configuration flags. Since they are run through `npm`, you must use the `--` separator to pass them to the underlying process. For example:

```sh
SENTRY_DSN=<your sentry dsn> npm run action client/src/cordova/setup macos -- --buildMode=release --versionName=<your version name>
```

## Testing the Client

*   **Web Components**: `npm run action client/src/www/test`
*   **Go Backend**: `go test -race -bench=. -benchtime=100ms ./client/...`
*   **OutlineAppleLib (macOS)**: `npm run action client/src/cordova/test macos`
*   **OutlineAppleLib (iOS)**: `npm run action client/src/cordova/test ios`

## Additional Resources

*   [Life of a Packet](/docs/life_of_a_packet.md): Learn how the Outline Client works.
*   [Accepting a server invite](/docs/invitation_instructions.md): Instructions on how to accept a server invite.
*   [Developing for Apple (macOS and iOS)](src/cordova/apple)
*   [Developing for Android](src/cordova/android)
*   [Developing for Electron (Windows and Linux)](electron)
