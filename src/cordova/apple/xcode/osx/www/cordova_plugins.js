cordova.define('cordova/plugin_list', function(require, exports, module) {
  module.exports = [
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
    "cordova-webintent": "2.0.0"
  };
});