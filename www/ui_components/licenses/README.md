# HOWTO re-generate `licenses.txt`

## Requirements

* `yarn`
* `https://github.com/Jigsaw-Code/bower-disclaimer`

## Steps

* `cd` to the root of your clone of this repo.
* Ensure `bower_components` and `node_modules` are up to date by running `yarn`.
* `yarn licenses generate-disclaimer --prod > /tmp/yarn`
* `cd www`
* `node <path to your bower-disclaimer repo root>/build > /tmp/bower`
* `./ui_components/licenses/third_party.sh > /tmp/third_party`
* `cat /tmp/{yarn,bower,third_party} > ui_components/licenses/licenses.txt`

Done!
