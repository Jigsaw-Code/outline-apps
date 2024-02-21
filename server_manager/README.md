# Outline Manager

## Running

To run the Outline Manager Electron app:

```
npm run action server_manager/electron_app/start ${PLATFORM}
```

To run the Outline Manager Electron app with a development build (code not minified):

```
BUILD_ENV=development npm run action server_manager/electron_app/start ${PLATFORM}
```

Where `${PLATFORM}` is one of `linux`, `macos`, `windows`.

## Development Server

To run the Outline Manager as a web app on the browser and listen for changes:

```
npm run action server_manager/web_app/start
```

## Gallery Server for UI Development

We have a server app to for quickly iterating on UI components. To spin it up, run

```
npm run action server_manager/web_app/start_gallery
```

Changes to UI components will be hot reloaded into the gallery.

## Debug an existing binary

You can run an existing binary in debug mode by setting `OUTLINE_DEBUG=true`.
This will enable the Developer menu on the application window.

## Packaging

To build the app binary:

```
npm run action server_manager/electron_app/build ${PLATFORM} -- --buildMode=[debug,release]
```

Where `${PLATFORM}` is one of `linux`, `macos`, `windows`.

The per-platform standalone apps will be at `build/electron_app/static/dist`.

- Windows: zip files. Only generated if you have [wine](https://www.winehq.org/download) installed.
- Linux: tar.gz files.
- macOS: dmg files if built from macOS, zip files otherwise.

> NOTE: If you are building for macOS, you may need to run `security unlock-keychain login.keychain` so electron-builder has access to your certificates.

## Error reporting

To enable error reporting through [Sentry](https://sentry.io/) for local builds, run:

```bash
export SENTRY_DSN=[Sentry development API key]
npm run action server_manager/electron_app/start ${PLATFORM}
```
