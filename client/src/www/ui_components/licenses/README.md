# HOWTO re-generate `licenses.txt`

## Steps

- `cd` to the root of your clone of this repo.
- Ensure `node_modules` is up to date by running `npm ci`.
- `npx generate-license-file --input package.json --output src/www/ui_components/licenses/licenses.txt`
- `./src/www/ui_components/licenses/third_party.sh >> ./src/www/ui_components/licenses/licenses.txt`

Done!
