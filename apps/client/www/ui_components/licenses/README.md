# HOWTO re-generate `licenses.txt`

## Steps

- `cd` to the root of your clone of this repo.
- Ensure `node_modules` is up to date by running `npm ci`.
- `npx generate-license-file --input package.json --output apps/client/www/ui_components/licenses/licenses.txt`
- `./apps/client/www/ui_components/licenses/third_party.sh >> ./apps/client/www/ui_components/licenses/licenses.txt`

Done!
