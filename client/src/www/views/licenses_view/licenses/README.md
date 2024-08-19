# HOWTO re-generate `licenses.txt`

## Steps

- `cd` to the root of your clone of this repo.
- Ensure `node_modules` is up to date by running `npm ci`.
- `npx generate-license-file --input package.json --output client/src/www/views/licenses_view/licenses/licenses.txt`
- `./client/src/www/views/licenses_view/licenses/third_party.sh >> ./client/src/www/views/licenses_view/licenses/licenses.txt`

Done!
