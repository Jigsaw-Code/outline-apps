Clipboard
=========

Clipboard management plugin for Cordova/PhoneGap that supports iOS, Android, and Windows Phone 8.

## Usage

Install the plugin using the CLI, for instance with PhoneGap:

	phonegap local plugin add https://github.com/VersoSolutions/CordovaClipboard

The plugin creates the object `cordova.plugins.clipboard` with the methods `copy(text, onSuccess, onError)` and `paste(onSuccess, onError)`.

Example:

	var text = "Hello World!";

	cordova.plugins.clipboard.copy(text);

	cordova.plugins.clipboard.paste(function (text) { alert(text); });

## Notes

### All platforms

- The plugin only works with text content.

### Windows Phone

- The Windows Phone platform doesn't allow applications to read the content of the clipboard. Using the `paste` method will return an error.

### Android

- The minimum supported API Level is 11. Make sure that `minSdkVersion` is larger or equal to 11 in `AndroidManifest.xml`.

## Acknowledgements

This plugin was inspired by [ClipboardManagerPlugin](https://github.com/jacob/ClipboardManagerPlugin) (Android) and [ClipboardPlugin](https://github.com/phonegap/phonegap-plugins/tree/master/iPhone/ClipboardPlugin) (iOS).

## License

The MIT License (MIT)

Copyright (c) 2013 Verso Solutions LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
