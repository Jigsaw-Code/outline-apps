# Localization

## UI Messages

The master messages file is at `resources/master_messages.json`. It is encoded in the Chrome Apps JSON format. The translated files, consumed by the application's UI, live in `www/messages/<locale>.json`.

### Validation

To validate that all keys in the master messages file have been localized, run:

```
python scripts/l10n/validate_localized_keys.py
```

## Native Messages

### Android

Native Android strings are located at `cordova-plugin-outline/android/resources/strings/values-${LOCALE}/strings.xml`. The keys and messages for each locale must be present in the corresponding UI messages file.

To import new strings, update the keys in `scripts/l10n/import_native_android_strings.py` and run:

```
yarn do scripts/l10n/import_native_android_strings
```

### Windows

Native Windows strings must be present in the localized UI messages file, as they are dynamically retrieved by Electron's main process through IPC with the UI process.


## Transifex

This translation service is not currently in use by the project.

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
