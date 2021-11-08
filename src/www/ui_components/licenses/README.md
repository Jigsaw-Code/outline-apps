# HOWTO re-generate `licenses.txt`

## Requirements

* `npm ci`
* `https://github.com/Jigsaw-Code/bower-disclaimer`

## Steps

* `cd` to the root of your clone of this repo.
* Ensure `node_modules` is up to date by running `npm ci`.
* `yarn licenses generate-disclaimer --prod > /tmp/yarn`
* `cd www`
* `node <path to your bower-disclaimer repo root>/build > /tmp/bower`
* `./ui_components/licenses/third_party.sh > /tmp/third_party`
* `cat /tmp/{yarn,bower,third_party} > ui_components/licenses/licenses.txt`

Done!
