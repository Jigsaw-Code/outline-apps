# Web Development Instructions

## Building the shared web app

Outline clients share the same web app across all platforms. This code is located in the src/www directory. If you are making changes to the shared web app and do not need to test platform-specific functionality, you can test in a desktop browser by running:

```sh
npm run action src/www/start
```

The latter command will open a browser instance running the app. Browser platform development will use fake servers to test successful and unsuccessful connections.

The app logic is located in [src/www/app](src/www/app). UI components are located in [src/www/ui_components](src/www/ui_components). If you want to work specifically on an individual UI element, try the storybook!:

```sh
npm run action src/www/storybook
```

> 💡 NOTE: the `src` part of the path is optional. `npm run action www/start` resolves to the same script.

> 💡 NOTE: every script in this repository can be run with `npm run action` -
> for a CLI-like experience, add something like
>
> ```sh
> alias outline="npm run action"
> ```
>
> _(you can call it whatever you like)_
>
> to your shell, then try `outline www/start`!

## UI Messages

The source of truth messages file is at `www/resources/original_messages.json`. It is encoded in the Chrome Apps JSON format. The translated files, consumed by the application's UI, live in `www/resources/messages/<locale>.json`.

### Validation

To validate that all keys in the master messages file have been localized, run:

```
python src/www/scripts/validate_localized_keys.py
```

### Windows

Native Windows strings must be present in the localized UI messages file, as they are dynamically retrieved by Electron's main process through IPC with the UI process.
