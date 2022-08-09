# Localization

## UI Messages

The source of truth messages file is at `resources/original_messages.json`. It is encoded in the Chrome Apps JSON format. The translated files, consumed by the application's UI, live in `www/messages/<locale>.json`.

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
npm run action scripts/l10n/import_native_android_strings
```

### Windows

Native Windows strings must be present in the localized UI messages file, as they are dynamically retrieved by Electron's main process through IPC with the UI process.
