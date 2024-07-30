# HOWTO re-generate `license.txt`

## Steps

- `cd` to the root of your clone of this repo
- Ensure `node_modules` is up to date and only include dependencies of the Electron app by running `npm ci && npm run action server_manager/www/build`
- Copy `LICENSE` and the entire `node_modules` folder to `./server_manager/LICENSE` and `./server_manager/node_modules`
- `cd server_manager`
- `npx generate-license-file --input package.json --output www/ui_components/licenses/licenses.txt`
- `cd www/ui_components/licenses`
- `cat db-ip_license.txt >> licenses.txt`

Done! (remember to delete the `./server_manager/node_modules` folder)

> Note that the third step of copying `LICENSE` and `node_modules` is required because:
>
> - `generate-license-file` iterates all dependencies under `node_modules` folder in the current directory
> - `generate-license-file` will try to find a `LICENSE` file in the current directory, if not found, it will use `README.md` instead which is not what we want

## Check

To quickly look for non-compliant licenses:

```bash
yarn licenses list --prod|grep -Ev \(@\|VendorUrl:\|VendorName:\|URL:\)
```
