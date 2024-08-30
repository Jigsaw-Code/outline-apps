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

import './ui_components/app-root';

import {App, LAST_DISPLAYED_SERVER_STORAGE_KEY} from './app';
import {
  FakeCloudAccounts,
  FakeDigitalOceanAccount,
  FakeManualServerRepository,
} from './testing/models';
import {AppRoot} from './ui_components/app-root';
import * as accounts from '../model/accounts';
import {Region} from '../model/digitalocean';
import * as server from '../model/server';

// Define functions from preload.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).onUpdateDownloaded = () => {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).bringToFront = () => {};

// Inject app-root element into DOM once before each test.
beforeEach(() => {
  document.body.innerHTML = "<app-root id='appRoot' language='en'></app-root>";
});

describe('App', () => {
  it('shows intro when starting with no manual servers or DigitalOcean token', async () => {
    const appRoot = document.getElementById('appRoot') as AppRoot;
    const app = createTestApp(appRoot);
    await app.start();
    expect(appRoot.currentPage).toEqual('intro');
  });

  it('will not create a manual server with invalid input', async () => {
    // Create a new app with no existing servers or DigitalOcean token.
    const appRoot = document.getElementById('appRoot') as AppRoot;
    const app = createTestApp(appRoot);
    await app.start();
    expect(appRoot.currentPage).toEqual('intro');
    await expectAsync(
      app.createManualServer('bad input')
    ).toBeRejectedWithError();
  });

  it('creates a manual server with valid input', async () => {
    // Create a new app with no existing servers or DigitalOcean token.
    const appRoot = document.getElementById('appRoot') as AppRoot;
    const app = createTestApp(appRoot);
    await app.start();
    expect(appRoot.currentPage).toEqual('intro');
    await app.createManualServer(
      JSON.stringify({certSha256: 'cert', apiUrl: 'url'})
    );
    expect(appRoot.currentPage).toEqual('serverView');
  });

  it('initially shows servers', async () => {
    // Create fake servers and simulate their metadata being cached before creating the app.
    const fakeAccount = new FakeDigitalOceanAccount();
    await fakeAccount.createServer(new Region('_fake-region-id'));
    const cloudAccounts = new FakeCloudAccounts(fakeAccount);

    const manualServerRepo = new FakeManualServerRepository();
    await manualServerRepo.addServer({
      certSha256: 'cert',
      apiUrl: 'fake-manual-server-api-url-1',
    });
    await manualServerRepo.addServer({
      certSha256: 'cert',
      apiUrl: 'fake-manual-server-api-url-2',
    });

    const appRoot = document.getElementById('appRoot') as AppRoot;
    expect(appRoot.serverList.length).toEqual(0);
    const app = createTestApp(appRoot, cloudAccounts, manualServerRepo);

    await app.start();
    // Validate that server metadata is shown.
    const managedServers = await fakeAccount.listServers();
    expect(managedServers.length).toEqual(1);
    const manualServers = await manualServerRepo.listServers();
    expect(manualServers.length).toEqual(2);
    await appRoot.getServerView('');
    const serverList = appRoot.serverList;

    expect(serverList.length).toEqual(
      manualServers.length + managedServers.length
    );
    expect(serverList).toContain(
      jasmine.objectContaining({id: 'fake-manual-server-api-url-1'})
    );
    expect(serverList).toContain(
      jasmine.objectContaining({id: 'fake-manual-server-api-url-2'})
    );
    expect(serverList).toContain(
      jasmine.objectContaining({id: '_fake-region-id'})
    );
  });

  it('initially shows the last selected server', async () => {
    const LAST_DISPLAYED_SERVER_ID = 'fake-manual-server-api-url-1';
    const manualServerRepo = new FakeManualServerRepository();
    const lastDisplayedServer = await manualServerRepo.addServer({
      certSha256: 'cert',
      apiUrl: LAST_DISPLAYED_SERVER_ID,
    });
    await manualServerRepo.addServer({
      certSha256: 'cert',
      apiUrl: 'fake-manual-server-api-url-2',
    });
    localStorage.setItem('lastDisplayedServer', LAST_DISPLAYED_SERVER_ID);
    const appRoot = document.getElementById('appRoot') as AppRoot;
    const app = createTestApp(appRoot, undefined, manualServerRepo);
    await app.start();
    expect(appRoot.currentPage).toEqual('serverView');
    expect(appRoot.selectedServerId).toEqual(
      lastDisplayedServer.getManagementApiUrl()
    );
  });

  it('shows selected server and access keys', async done => {
    const SERVER_ID = 'fake-manual-server-api-url-1';
    const manualServerRepo = new FakeManualServerRepository();
    const server = await manualServerRepo.addServer({
      certSha256: 'cert',
      apiUrl: SERVER_ID,
    });
    await server.addAccessKey();

    const appRoot = document.getElementById('appRoot') as AppRoot;
    const app = createTestApp(appRoot, undefined, manualServerRepo);
    await app.start();
    await app.showServer(server);
    const view = await appRoot.getServerView(SERVER_ID);

    expect(appRoot.currentPage).toEqual('serverView');
    expect(appRoot.selectedServerId).toEqual(SERVER_ID);
    setTimeout(() => {
      expect(view.accessKeyRows.length).toEqual(1);
      done();
    }, 100);
  });

  it('shows selected server and access keys for non-semantic version server', async done => {
    const SERVER_ID = 'fake-manual-server-api-url-1';
    const manualServerRepo = new FakeManualServerRepository();
    const server = await manualServerRepo.addServer({
      certSha256: 'cert',
      apiUrl: SERVER_ID,
    });
    spyOn(server, 'getVersion').and.returnValue('dev');
    await server.addAccessKey();

    const appRoot = document.getElementById('appRoot') as AppRoot;
    const app = createTestApp(appRoot, undefined, manualServerRepo);
    await app.start();
    await app.showServer(server);
    const view = await appRoot.getServerView(SERVER_ID);

    expect(appRoot.currentPage).toEqual('serverView');
    expect(appRoot.selectedServerId).toEqual(SERVER_ID);
    setTimeout(() => {
      expect(view.accessKeyRows.length).toEqual(1);
      done();
    }, 100);
  });

  it('shows progress screen once DigitalOcean droplets are created', async () => {
    // Start the app with a fake DigitalOcean token.
    const appRoot = document.getElementById('appRoot') as AppRoot;
    const cloudAccounts = new FakeCloudAccounts(new FakeDigitalOceanAccount());
    const app = createTestApp(appRoot, cloudAccounts);
    await app.start();
    await app.createDigitalOceanServer(new Region('_fake-region-id'), false);
    expect(appRoot.currentPage).toEqual('serverView');
    const view = await appRoot.getServerView(appRoot.selectedServerId);
    expect(view.selectedPage).toEqual('progressView');
  });

  it('shows progress screen when starting with DigitalOcean servers still being created', async () => {
    const appRoot = document.getElementById('appRoot') as AppRoot;
    const fakeAccount = new FakeDigitalOceanAccount();
    const server = await fakeAccount.createServer(
      new Region('_fake-region-id')
    );
    const cloudAccounts = new FakeCloudAccounts(fakeAccount);
    const app = createTestApp(appRoot, cloudAccounts);
    // Sets last displayed server.
    localStorage.setItem(LAST_DISPLAYED_SERVER_STORAGE_KEY, server.getId());
    await app.start();
    expect(appRoot.currentPage).toEqual('serverView');
    const view = await appRoot.getServerView(appRoot.selectedServerId);
    expect(view.selectedPage).toEqual('progressView');
  });
});

function createTestApp(
  appRoot: AppRoot,
  cloudAccounts?: accounts.CloudAccounts,
  manualServerRepo?: server.ManualServerRepository
) {
  const VERSION = '0.0.1';
  if (!cloudAccounts) {
    cloudAccounts = new FakeCloudAccounts();
  }
  if (!manualServerRepo) {
    manualServerRepo = new FakeManualServerRepository();
  }
  return new App(appRoot, VERSION, manualServerRepo, cloudAccounts);
}
