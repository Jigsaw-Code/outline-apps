## Unreleased

### Feat

- **service/linux**: ✨ add network monitoring logic (#1477)
- salt prefix support (#1454)

### Fix

- **www**: don't autopaste non-s3 https links (#1465)

### Refactor

- **service/linux**: ♻️ upgrade boost and gcc to use co_await (#1462)

## macos-v1.8.1 (2022-11-02)

### Feat

- **www**: dynamic key text body support (#1445)
- **devtools**: add link to mattermost channel (#1424)
- **electron**: ✨ switch from badvpn-tun2socks to golang based tun2socks (#1404)
- **www**: basic dynamic key support (#1406)
- **service/linux**: 🔒️ add outlinevpn group to further restrict permissions (#1410)
- **www**: 🌐 import translations for installation messages (#1359)
- **devtools**: restrict invalid import paths (#1337)
- **www**: 🌐 prepare translations for newly added messages (#1336)
- **www**: 🌐 introduce new i18n languages support (#1323)
- **devtools**: eslint compat (#1314)
- **devtools**: eslint (#1307)
- **devtools**: browserslist (#1306)
- **devtools**: pull request checks (#1301)
- **actions**: remove gulp (#1264)

### Fix

- **service/linux**: 💊 propagate VPN errors back to client (#1441)
- **devtools**: add publish config url so we can get proper client updates (#1439)
- **www**: 💊 `localize` is not initialized during `syncServersToUI` (#1427)
- **cordova/apple/macos**: updated macOS app icon to match new spec #1249 (#1416)
- **www**: adds basic server connection toggle timeouts (#1414)
- **service/linux**: 🔒️ use absolute path for binaries to prevent PATH pollution (#1405)
- **build**: 🚧 fix `buildMode` typo in cordova build script (#1407)
- **service/linux**: 🔒️ verify service installation scripts before execution (#1392)
- **service**: 🔒️ reduce tun device subnet size to one (/32) (#1399)
- **www**: support old/other platform's filter transition (#1395)
- **build**: don't run the size label on forks (#1391)
- **service/linux**: 🔒️ prevent command injection issue (#1386)
- wrap long words in server name (#1375)
- **www**: 💊 hide server list scroll bar when there is enough space (#1371)
- **electron**: add url protection (#1370)
- additional small issues (#1354)
- **cordova/apple/ios**: fixed white lines on iOS launch screen [#1355] #1358
- **www**: empty name, body inset, list padding (#1353)
- **www**: 🌐 refine wording during installation (#1347)
- server card ip address text wrapping, platform in www/build (#1349)
- **docs**: create invitation-instructions.md link-through (#1345)
- breaking ios issues and update ios version (#1341)
- **build**: ⬆️ upgrade setup-node action version (#1340)
- explicitly add rimraf dependency
- **electron**: 💊 fix routing daemon installation issue in Linux (#1274)
- **devtools**: allow ambient modules (#1326)
- **electron/linux**: outline icon is not shown in Ubuntu Dock (#1327)
- **www**: restore initial indicator appearance (#1303)
- **ui**: fix server empty state (#1290)
- **release**: build for ios emulator in the CI (#1257)
- **actions**: failed to spread action parameters. remove release automation. (#1284)

### Refactor

- **electron**: ♻️ use async model for ChildProcessHelper (#1455)
- **www**: move ShadowsocksSessionConfig to tunnel.ts (#1401)
- **electron**: ♻️ a huge upgrade to electron 19.0.8 (#1365)
- intrastructure, types, and cordova macos folder (#1351)
- **actions**: renaming platform osx to macos (#1294)

## windows-v1.7.1 (2022-04-18)

### Feat

- **storybook**: server-list story (#1237)

### Fix

- **release**: remove fastlane and iOS process (#1255)
- **storybook**: add message formatting to storybook localizer (#1250)

## android-1.7.0 (2022-03-31)

### Feat

- **dev**: Storybook setup (#1136)
- **release**: copy current iOS CI process over to the build_release_candidates workflow (#1231)

## windows-v1.7.0 (2022-03-21)

### Feat

- **release**: android (#1183)
- **release**: linux (#1141)

### Fix

- **dev**: replace clang with prettier (#1221)
- **release**: remove outdated windows flag (#1216)
- **sentry**: clear name in device context
- **release**: catch invalid sentry DSN (#1180)
- **build**: browser tests (#1164)
- **ui**: refresh new server name after renaming (#1137)
- **ui**: navigation menu can be scrollable when window is too small (#1118)

### Refactor

- **release**: create version and build number getters (#1140)

## daily-2021-07-02 (2021-07-01)

## daily-2021-07-01 (2021-06-30)

## daily-2021-06-30 (2021-06-23)

## daily-2021-05-21 (2021-05-20)

## android-alalama-test (2021-05-04)

## daily-2021-04-29 (2021-04-28)

## daily-2021-04-24 (2021-04-23)

## daily-2021-04-23 (2021-04-22)

## daily-2021-04-16 (2021-04-15)

## daily-2021-04-15 (2021-04-14)

## daily-2021-04-06 (2021-04-05)

## daily-2021-03-26 (2021-03-25)

## daily-2021-03-25 (2021-03-24)

## daily-2021-03-24 (2021-03-23)

## daily-2021-03-02 (2021-03-01)

## daily-2021-02-26 (2021-02-25)

## daily-2021-02-25 (2021-02-24)

## daily-2021-02-24 (2021-02-23)

## daily-2021-02-23 (2021-02-22)

## daily-2021-02-20 (2021-02-19)

## daily-2021-02-19 (2021-02-18)

## daily-2021-02-17 (2021-02-16)

## daily-2021-02-13 (2021-02-12)

## daily-2021-02-11 (2021-02-11)

## daily-2021-02-06 (2021-02-05)

## daily-2021-01-30 (2021-01-29)

## daily-2021-01-26 (2021-01-25)

## daily-2021-01-23 (2021-01-22)

## daily-2020-12-18 (2020-12-17)

## Test-hub-edit (2020-12-14)

## daily-2020-12-08 (2020-12-07)

## daily-2020-12-04 (2020-12-03)

## daily-2020-12-03 (2020-12-02)

## daily-2020-11-24 (2020-11-23)

## daily-2020-11-20 (2020-11-19)

## daily-2020-11-19 (2020-11-18)

## daily-2020-11-18 (2020-11-17)

## daily-2020-11-17 (2020-11-16)

## daily-2020-11-14 (2020-11-13)

## daily-2020-11-11 (2020-11-10)

## daily-2020-10-03 (2020-10-02)

## daily-2020-09-22 (2020-09-21)

## daily-2020-09-15 (2020-09-14)

## daily-2020-09-12 (2020-09-11)

## android-v1.4.0 (2020-07-29)

## daily-2020-07-29 (2020-07-28)

## daily-2020-07-24 (2020-07-23)

## daily-2020-07-11 (2020-07-10)

## daily-2020-07-10 (2020-07-09)

## daily-2020-06-26 (2020-06-25)

## daily-2020-06-25 (2020-06-24)

## daily-2020-06-24 (2020-06-23)

## daily-2020-06-19 (2020-06-18)

## daily-2020-06-18 (2020-06-17)

## daily-2020-06-11 (2020-06-10)

## daily-2020-06-05 (2020-06-04)

## daily-2020-05-27 (2020-05-26)

## android-v1.2.13 (2020-05-21)

## daily-2020-05-21 (2020-05-20)

## daily-2020-05-02 (2020-05-01)

## daily-2020-04-15 (2020-04-14)

## daily-2020-04-14 (2020-04-13)

## daily-2020-04-02 (2020-04-01)

## daily-2020-03-17 (2020-03-16)

## daily-2020-03-11 (2020-03-10)

## daily-2020-02-22 (2020-02-21)

## daily-2020-02-11 (2020-02-10)

## daily-2020-02-04 (2020-02-03)

## daily-2020-01-30 (2020-01-29)

## daily-2020-01-29 (2020-01-28)

## daily-2020-01-24 (2020-01-23)

## daily-2020-01-23 (2020-01-22)

## daily-2020-01-22 (2020-01-21)

## daily-2020-01-04 (2020-01-03)

## daily-2019-12-11 (2019-12-10)

## daily-2019-12-10 (2019-12-09)

## daily-2019-11-06 (2019-11-05)

## daily-2019-10-23 (2019-10-22)

## daily-2019-10-22 (2019-10-21)

## daily-2019-10-11 (2019-10-10)

## android-v1.2.12 (2019-08-30)

## android-v1.2.11 (2019-08-26)

## daily-2019-08-24 (2019-08-23)

## daily-2019-08-20 (2019-08-19)

## daily-2019-08-17 (2019-08-16)

## daily-2019-08-02 (2019-08-01)

## daily-2019-08-01 (2019-07-31)

## daily-2019-07-24 (2019-07-23)

## daily-2019-07-11 (2019-07-11)

## daily-2019-07-10 (2019-07-09)

## daily-2019-06-01 (2019-05-31)

## daily-2019-05-24 (2019-05-23)

## daily-2019-05-04 (2019-05-03)

## daily-2019-04-30 (2019-04-29)

## daily-2019-04-16 (2019-04-15)

## daily-2019-04-12 (2019-04-11)

## daily-2019-03-29 (2019-03-28)

## daily-2019-03-28 (2019-03-27)

## daily-2019-03-27 (2019-03-26)

## android-v1.2.10 (2019-03-07)

## ios-v1.2.7 (2019-03-07)

## daily-2019-03-06 (2019-03-06)

## daily-2019-03-05 (2019-03-05)

## daily-2019-02-28 (2019-02-28)

## daily-2019-02-25 (2019-02-25)

## daily-2019-02-21 (2019-02-21)

## daily-2019-02-20 (2019-02-20)

## daily-2019-02-11 (2019-02-11)

## daily-2019-02-08 (2019-02-08)

## daily-2019-02-05 (2019-02-05)

## daily-2019-02-04 (2019-02-04)

## daily-2019-01-30 (2019-01-30)

## daily-2019-01-23 (2019-01-23)

## daily-2019-01-22 (2019-01-22)

## daily-2019-01-16 (2019-01-16)

## daily-2019-01-15 (2019-01-15)

## daily-2019-01-14 (2019-01-14)

## daily-2019-01-11 (2019-01-11)

## daily-2019-01-10 (2019-01-10)

## android-v1.2.9 (2019-01-10)

## daily-2019-01-09 (2019-01-09)

## linux-v1.0.2 (2019-01-09)

## windows-v1.2.24 (2019-01-09)

## daily-2019-01-08 (2019-01-08)

## daily-2019-01-04 (2019-01-04)

## daily-2019-01-03 (2019-01-03)

## daily-2018-12-20 (2018-12-19)

## daily-2018-12-18 (2018-12-18)

## daily-2018-12-17 (2018-12-17)

## daily-2018-12-14 (2018-12-14)

## daily-2018-12-13 (2018-12-13)

## windows-v1.2.23 (2018-12-13)

## windows-v1.2.22 (2018-12-13)

## daily-2018-12-11 (2018-12-11)

## daily-2018-12-10 (2018-12-10)

## daily-2018-12-07 (2018-12-07)

## daily-2018-12-06 (2018-12-05)

## daily-2018-12-05 (2018-12-05)

## daily-2018-12-04 (2018-12-04)

## daily-2018-12-03 (2018-12-03)

## daily-2018-11-29 (2018-11-29)

## daily-2018-11-28 (2018-11-28)

## daily-2018-11-26 (2018-11-26)

## daily-2018-11-19 (2018-11-19)

## daily-2018-11-15 (2018-11-15)

## daily-2018-11-14 (2018-11-14)

## daily-2018-11-13 (2018-11-13)

## daily-2018-11-08 (2018-11-08)

## daily-2018-11-07 (2018-11-07)

## daily-2018-11-06 (2018-11-06)

## daily-2018-11-01 (2018-11-01)

## daily-2018-10-31 (2018-10-31)

## android-v1.2.7 (2018-10-31)

## daily-2018-10-29 (2018-10-29)

## daily-2018-10-25 (2018-10-25)

## daily-2018-10-17 (2018-10-17)

## ios-v1.2.1 (2018-10-17)

## windows-v1.2.17 (2018-10-17)

## daily-2018-10-16 (2018-10-16)

## daily-2018-10-11 (2018-10-11)

## daily-2018-10-10 (2018-10-10)

## windows-v1.2.16 (2018-10-10)

## windows-v1.2.15 (2018-10-10)

## daily-2018-10-08 (2018-10-08)

## daily-2018-10-04 (2018-10-04)

## daily-2018-10-03 (2018-10-03)

## windows-v1.2.14 (2018-10-03)

## daily-2018-10-02 (2018-10-02)

## daily-2018-10-01 (2018-10-01)

## daily-2018-09-27 (2018-09-27)

## daily-2018-09-24 (2018-09-24)

## daily-2018-09-21 (2018-09-21)

## daily-2018-09-20 (2018-09-20)

## daily-2018-09-18 (2018-09-18)

## daily-2018-09-14 (2018-09-14)

## windows-v1.2.11 (2018-09-14)

## daily-2018-09-13 (2018-09-13)

## daily-2018-09-12 (2018-09-12)

## daily-2018-09-10 (2018-09-10)

## daily-2018-09-06 (2018-09-06)

## daily-2018-09-05 (2018-09-05)

## daily-2018-08-30 (2018-08-30)

## windows-v1.2.8 (2018-08-30)

## daily-2018-08-29 (2018-08-29)

## daily-2018-08-28 (2018-08-28)

## daily-2018-08-24 (2018-08-24)

## daily-2018-08-23 (2018-08-23)

## windows-v1.2.5 (2018-08-23)

## daily-2018-08-22 (2018-08-22)

## daily-2018-08-21 (2018-08-21)

## daily-2018-08-17 (2018-08-17)

## daily-2018-08-13 (2018-08-13)

## daily-2018-08-10 (2018-08-10)

## daily-2018-08-09 (2018-08-09)

## daily-2018-08-06 (2018-08-06)

## daily-2018-07-30 (2018-07-30)

## daily-2018-07-26 (2018-07-26)

## daily-2018-07-24 (2018-07-24)

## daily-2018-07-23 (2018-07-23)

## daily-2018-07-19 (2018-07-19)

## daily-2018-07-18 (2018-07-18)

## daily-2018-07-17 (2018-07-17)

## windows-v1.1.2 (2018-07-17)

## android-v1.1.4 (2018-07-16)

## rm (2018-07-16)

## daily-2018-07-16 (2018-07-16)

## daily-2018-07-12 (2018-07-12)

## daily-2018-06-29 (2018-06-29)

## daily-2018-06-25 (2018-06-25)

## daily-2018-06-22 (2018-06-21)

## daily-2018-06-21 (2018-06-21)

## daily-2018-06-20 (2018-06-20)

## daily-2018-06-18 (2018-06-18)

## daily-2018-06-08 (2018-06-08)

## daily-2018-06-07 (2018-06-07)

## daily-2018-05-23 (2018-05-23)

## daily-2018-05-22 (2018-05-22)

## android-v1.1.0 (2018-05-18)

## daily-2018-05-14 (2018-05-14)

## daily-2018-05-07 (2018-05-07)

## android-v1.0.3 (2018-05-07)

## daily-2018-05-04 (2018-05-04)

## daily-2018-05-02 (2018-05-02)

## daily-2018-04-30 (2018-04-30)

## daily-2018-04-17 (2018-04-17)

## android-v1.0.2 (2018-04-12)

## daily-2018-04-10 (2018-04-10)

## windows-v1.0.2 (2018-04-10)

## daily-2018-04-09 (2018-04-09)

## daily-2018-04-05 (2018-04-04)

## daily-2018-04-03 (2018-04-03)

## daily-2018-03-29 (2018-03-29)

## daily-2018-03-28 (2018-03-28)

## windows-v1.0.1 (2018-03-28)

## daily-2018-03-27 (2018-03-27)

## daily-2018-03-26 (2018-03-26)

## daily-2018-03-23 (2018-03-23)

## daily-2018-03-22 (2018-03-22)

## daily-2018-03-21 (2018-03-21)

## android-v1.0.0 (2018-03-19)

## daily-2018-03-17 (2018-03-16)

## daily-2018-03-16 (2018-03-16)

## daily-2018-03-15 (2018-03-15)
