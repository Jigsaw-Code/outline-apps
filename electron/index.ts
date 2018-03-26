// Copyright 2018 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {SentryClient} from '@sentry/electron';
import {app, BrowserWindow, dialog, ipcMain, Menu, shell} from 'electron';
import {PromiseIpc} from 'electron-promise-ipc';
import {autoUpdater} from 'electron-updater';
import * as path from 'path';
import * as process from 'process';
import * as url from 'url';

import * as process_manager from './process_manager';

// TODO: Figure out the TypeScript magic to use the default, export-ed instance.
const myPromiseIpc = new PromiseIpc();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: Electron.BrowserWindow|null;

const debugMode = process.env.OUTLINE_DEBUG === 'true';

const iconPath = path.join(__dirname, 'outline.ico');

const enum Options {
  AUTOSTART = '--autostart'
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 360, height: 640, resizable: false, icon: iconPath});

  const pathToIndexHtml = path.join(__dirname, '..', 'www', 'electron_index.html');
  const webAppUrl = new url.URL(`file://${pathToIndexHtml}`);

  // Debug mode, etc.
  const queryParams = new url.URLSearchParams();
  if (debugMode) {
    queryParams.set('debug', 'true');
  }
  webAppUrl.search = queryParams.toString();

  const webAppUrlAsString = webAppUrl.toString();

  console.log(`loading web app from ${webAppUrlAsString}`);
  mainWindow.loadURL(webAppUrlAsString);

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // TODO: is this the most appropriate event?
  mainWindow.webContents.on('did-finish-load', () => {
    interceptShadowsocksLink(process.argv);
  });

  // The client is a single page app - loading any other page means the
  // user clicked on one of the Privacy, Terms, etc., links. These should
  // open in the user's browser.
  mainWindow.webContents.on('will-navigate', (event: Event, url: string) => {
    shell.openExternal(url);
    event.preventDefault();
  });
}

const isSecondInstance = app.makeSingleInstance((argv, workingDirectory) => {
  interceptShadowsocksLink(argv);

  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

if (isSecondInstance) {
  app.quit();
}

app.setAsDefaultProtocolClient('ss');

function interceptShadowsocksLink(argv: string[]) {
  if (argv.length > 1) {
    const url = argv[1];
    if (url.startsWith('ss://')) {
      if (mainWindow) {
        mainWindow.webContents.send('add-server', url);
      } else {
        console.error('called with URL but mainWindow not open');
      }
    }
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // TODO: Run this periodically, e.g. every 4-6 hours.
  autoUpdater.checkForUpdates();

  if (debugMode) {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{
      label: 'Developer',
      submenu: [{role: 'reload'}, {role: 'forcereload'}, {role: 'toggledevtools'}]
    }]));
  }

  // Set the app to launch at startup to reset the system proxy configuration
  // in case of a showdown while proxying.
  app.setLoginItemSettings({openAtLogin: true, args: [Options.AUTOSTART]});

  if (process.argv.includes(Options.AUTOSTART)) {
    app.quit();  // Quitting the app will reset the system proxy configuration before exiting.
  } else {
    createWindow();
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', () => {
  try {
    process_manager.teardownProxy();
  } catch (e) {
    console.error('could not tear down proxy on exit', e);
  }
});

myPromiseIpc.on('is-reachable', (config: cordova.plugins.outline.ServerConfig) => {
  return process_manager.isServerReachable(config)
      .then(() => {
        return true;
      })
      .catch((e) => {
        return false;
      });
});

myPromiseIpc.on(
    'start-proxying', (args: {config: cordova.plugins.outline.ServerConfig, id: string}) => {
      return process_manager.teardownProxy()
          .catch((e) => {
            console.error('error tearing down current proxy', e);
          })
          .then(() => {
            return process_manager.launchProxy(args.config, () => {
              if (mainWindow) {
                mainWindow.webContents.send(`proxy-disconnected-${args.id}`);
              } else {
                console.error(`received proxy-disconnected event but no mainWindow to notify`);
              }
            });
          });
    });

myPromiseIpc.on('stop-proxying', () => {
  return process_manager.teardownProxy();
});

// This event fires whenever the app's window receives focus.
app.on('browser-window-focus', () => {
  if (mainWindow) {
    mainWindow.webContents.send('push-clipboard');
  }
});

// Error reporting.
ipcMain.on('environment-info', (event: Event, info: {appVersion: string, sentryDsn: string}) => {
  SentryClient.create({dsn: info.sentryDsn, release: info.appVersion});
});

// Notify the UI of updates.
autoUpdater.on('update-downloaded', (ev, info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded');
  }
});
