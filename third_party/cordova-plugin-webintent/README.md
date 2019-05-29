# WebIntent Android Plugin for Cordova

## History

- Originally [written](http://smus.com/android-phonegap-plugins/)
  by [Boris Smus](https://github.com/borismus)
  and published to
  [phonegap/phonegap-plugins](https://github.com/phonegap/phonegap-plugins/tree/DEPRECATED/Android/WebIntent)
  (now deprecated)

- Forked by [Rafael Agostini](https://github.com/Initsogar)
  and published to
  [Initsogar/cordova-webintent](https://github.com/Initsogar/cordova-webintent)
  (now removed)

- Forked by [Chris E. Kelley](https://github.com/chrisekelley)
  and published to
  [cordova-misc/cordova-webintent](https://github.com/cordova-misc/cordova-webintent)

- Many people forked but for some reason did not submit PRs,
  leaving their forks divergent.

## Intention to maintain

**This repo is actively maintained. Please feel free to treat it as the
canonical upstream, and submit PRs for any changes you'd like merged.**

## Adding this plugin to your project

1. To install the plugin, use the Cordova CLI:

    ```bash
    cordova plugin add https://github.com/chrisekelley/cordova-webintent.git
    ```

1. Confirm that the following is now in your `config.xml` file:

    ```xml
    <plugin name="WebIntent" value="com.borismus.webintent.WebIntent" />
    ```

## Sample code

Here is an example of using webintent to open an Android .apk package, which then launches the Installer:

```javascript
window.plugins.webintent.startActivity({
      action: window.plugins.webintent.ACTION_VIEW,
      url: 'file://' + theFile.fullPath,
      type: 'application/vnd.android.package-archive'
    },
    function () {},
    function () {
      alert('Failed to open URL via Android Intent.');
      console.log('Failed to open URL via Android Intent. URL: ' + theFile.fullPath);
    }
);
```

## Using the plugin

The plugin creates the object `window.plugins.webintent` with five methods:

### startActivity

Launches an Android intent. For example:

```javascript
window.plugins.webintent.startActivity({
    action: window.plugins.webintent.ACTION_VIEW,
    url: 'geo:0,0?q=' + address},
    function () {},
    function () { alert('Failed to open URL via Android Intent'); }
);
```

### hasExtra

Checks if this app was invoked with the specified extra. For example:

```javascript
window.plugins.webintent.hasExtra(WebIntent.EXTRA_TEXT,
    function (has) {
        // `has` is true iff app invoked with specified extra
    }, function () {
        // `hasExtra` check failed
    }
);
```

### getExtra

Gets the extra that this app was invoked with. For example:

```javascript
window.plugins.webintent.getExtra(WebIntent.EXTRA_TEXT,
    function (url) {
        // `url` is the value of EXTRA_TEXT
    }, function () {
        // There was no extra supplied.
    }
);
```

### getUri

Gets the URI the app was invoked with. For example:

```javascript
window.plugins.webintent.getUri(function (uri) {
    if (uri !== '') {
        // `uri` is the uri the intent was launched with.
        //
        // If this is the first run after the app was installed via a link with an install referrer
        // (e.g. https://play.google.com/store/apps/details?id=com.example.app&referrer=referrer.com)
        // then the Play Store will have fired an INSTALL_REFERRER intent that this plugin handles,
        // and `uri` will contain the referrer value ("referrer.com" in the example above).
        // ref: https://help.tune.com/marketing-console/how-google-play-install-referrer-works/
    }
});
```

### onNewIntent

Gets called when `onNewIntent` is called for the parent activity.
Used in only certain launchModes. For example:

```javascript
window.plugins.webintent.onNewIntent(function (uri) {
    if (uri !== '') {
        // `uri` is the uri that was passed to onNewIntent
    }
});
```

### sendBroadcast
Sends a custom intent passing optional extras

```javascript
window.plugins.webintent.sendBroadcast({
    action: 'com.dummybroadcast.action.triggerthing',
    extras: { option: true }
  }, function() {
  }, function() {
});
```

## Licence ##

The MIT License

Copyright (c) 2010-2017 Boris Smus and contributors

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
