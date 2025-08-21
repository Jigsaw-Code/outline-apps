# Outline Server Manager

This document provides a guide for AI agents working on the Outline Server Manager.

## Directory Structure

The `/server_manager` directory contains the source code for the Outline Server Manager, which is available as a web-based application and an Electron desktop application.

*   `/www`: Contains the Svelte-based web application that serves as the main UI for the Server Manager.
*   `/electron`: Houses the Electron-specific code for the desktop version of the Server Manager.
*   `/cloud`: Includes the APIs for interacting with cloud providers like DigitalOcean and Google Cloud Platform.
*   `/install_scripts`: Contains the shell scripts used to install and configure Outline servers on various cloud providers.

## Key Technologies

*   **Svelte**: The primary UI framework for the Server Manager's web-based components.
*   **Electron**: Used to build the desktop version of the Server Manager.
*   **TypeScript**: Used for all web-based code.
*   **Shadowbox**: The core proxy component of Outline, which is managed by the Server Manager.

## Building and Running the Server Manager

The `npm run action` command is used to build and run the Server Manager.

### Web Application

*   **Build**: `npm run action server_manager/www/build`
*   **Run for development**: `npm run action server_manager/www/start`

### Electron Application

*   **Build (Linux)**: `npm run action server_manager/electron/build linux`
*   **Build (Windows)**: `npm run action server_manager/electron/build windows`
*   **Build (macOS)**: `npm run action server_manager/electron/build macos`
*   **Run**: `npm run action server_manager/electron/start ${PLATFORM}` (where `${PLATFORM}` is one of `linux`, `macos`, `windows`)
*   **Run with development build**: `BUILD_ENV=development npm run action server_manager/electron/start ${PLATFORM}`

### Packaging

To build the app binary:

```
npm run action server_manager/electron/package ${PLATFORM} -- --buildMode=[debug,release]
```

The per-platform standalone apps will be at `output/build/server_manager/electron/static/dist`.

## Debugging

You can run an existing binary in debug mode by setting `OUTLINE_DEBUG=true`. This will enable the Developer menu on the application window.

## Error Reporting

To enable error reporting through [Sentry](https://sentry.io/) for local builds, run:

```bash
export SENTRY_DSN=[Sentry development API key]
npm run action server_manager/electron/start ${PLATFORM}
```

## Testing the Server Manager

*   **Web Application**: `npm run action server_manager/test`
