cordova.define('cordova/plugin_list', function(require, exports, module) {
  module.exports = [
    {
      "id": "cordova-plugin-clipboard.Clipboard",
      "file": "plugins/cordova-plugin-clipboard/www/clipboard.js",
      "pluginId": "cordova-plugin-clipboard",
      "clobbers": [
        "cordova.plugins.clipboard"
      ]
    },
    {
      "id": "cordova-plugin-statusbar.statusbar",
      "file": "plugins/cordova-plugin-statusbar/www/statusbar.js",
      "pluginId": "cordova-plugin-statusbar",
      "clobbers": [
        "window.StatusBar"
      ]
    },
    {
      "id": "cordova-webintent.WebIntent",
      "file": "plugins/cordova-webintent/www/webintent.js",
      "pluginId": "cordova-webintent",
      "clobbers": [
        "WebIntent"
      ]
    }
  ];
  module.exports.metadata = {
    "cordova-plugin-clipboard": "2.0.0",
    "cordova-plugin-outline": "0.0.0",
    "cordova-plugin-splashscreen": "6.0.2",
    "cordova-plugin-statusbar": "2.4.3",
    "cordova-webintent": "2.0.0"
  };
});