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

import {unwrapInvite, isOutlineAccessKey} from './app';

describe('unwrapInvite', () => {
  it('ignores empty string', () => {
    expect(unwrapInvite('')).toEqual('');
  });

  it('ignores garbage', () => {
    const s = 'i am not a shadowsocks link';
    expect(unwrapInvite(s)).toEqual(s);
  });

  it('ignores url without fragment', () => {
    const s = 'https://whatever.com/invite.html';
    expect(unwrapInvite(s)).toEqual(s);
  });

  it('ignores non-ss fragment', () => {
    const s = 'https://whatever.com/invite.html#iamjustaname';
    expect(unwrapInvite(s)).toEqual(s);
  });

  it('detects ss fragment', () => {
    const s = 'ss://myhost.com:3333';
    expect(unwrapInvite(`https://whatever.com/invite.html#${encodeURIComponent(s)}`)).toEqual(s);
  });

  it('handles fragment after redirect', () => {
    const s = 'ss://myhost.com:3333';
    expect(unwrapInvite(`https://whatever.com/invite.html#/en/invite/${encodeURIComponent(s)}`)).toEqual(s);
  });
});

describe('isOutlineAccessKey', () => {
  it('ignores empty string', () => expect(isOutlineAccessKey('')).toBe(false));
  it('ignores garbage', () => expect(isOutlineAccessKey('i am not a outline service location')).toBe(false));
  it('ignores random https links', () => expect(isOutlineAccessKey('https://example.com')).toBe(false));

  it('detects static keys', () => expect(isOutlineAccessKey('ss://myhost.com:3333')).toBe(true));
  it('detects dynamic keys', () => expect(isOutlineAccessKey('ssconf://my.cool.server.com:3423#veryfast')).toBe(true));
});

// Add tests for the App class
import { App } from './app';
import { EventQueue } from '../model/events';
import { ServerRepository, Server } from '../model/server';
import { Settings, SettingsKey } from './settings';
import { FakeClipboard } from './clipboard';
import { FakeErrorReporter } from '../shared/error_reporter';
import { EnvironmentVariables } from './environment';
import { FakeUpdater } from './updater';
import { FakeVpnInstaller } from './vpn_installer';
import { ServerConnectionState } from '../views/servers_view';

describe('App', () => {
  let app: App;
  let mockEventQueue: EventQueue;
  let mockServerRepo: jasmine.SpyObj<ServerRepository>;
  let mockRootEl: any;
  let mockClipboard: FakeClipboard;
  let mockErrorReporter: FakeErrorReporter;
  let mockSettings: jasmine.SpyObj<Settings>;
  let mockEnvironment: EnvironmentVariables;
  let mockUpdater: FakeUpdater;
  let mockInstaller: FakeVpnInstaller;
  let mockQuitApplication: jasmine.Spy<() => void>;
  let mockDocument: Document;

  beforeEach(() => {
    mockEventQueue = new EventQueue(); // Real EventQueue, can spy on its methods if needed
    mockServerRepo = jasmine.createSpyObj('ServerRepository', ['getById', 'getAll', 'add', 'forget', 'rename', 'updateServer', 'undoForget']);
    mockRootEl = {
      // Mock Polymer element properties and methods as needed by App constructor and tested methods
      $: {
        serversView: jasmine.createSpyObj('serversView', ['addEventListener']),
        addServerView: { open: false, accessKeyValidator: null },
        privacyView: { open: false },
        drawer: { open: false },
        autoConnectDialog: { open: false }
      },
      servers: [],
      localize: (msgId: string) => msgId, // Simple mock localize
      setLanguage: jasmine.createSpy('setLanguage'),
      changePage: jasmine.createSpy('changePage'),
      showToast: jasmine.createSpy('showToast'),
      showErrorDetails: jasmine.createSpy('showErrorDetails'),
      addEventListener: jasmine.createSpy('addEventListener'), // For App's own event listeners
      DEFAULT_PAGE: 'servers',
      // Mock other properties if App's constructor or tested methods access them
    };
    mockClipboard = new FakeClipboard();
    mockErrorReporter = new FakeErrorReporter();
    mockSettings = jasmine.createSpyObj('Settings', ['get', 'set']);
    mockEnvironment = { APP_VERSION: '1.0.0', APP_BUILD_NUMBER: '1' };
    mockUpdater = new FakeUpdater();
    mockInstaller = new FakeVpnInstaller();
    mockQuitApplication = jasmine.createSpy('quitApplication');
    mockDocument = document; // Or a more specific mock if needed

    // Provide default return values for settings
    mockSettings.get.and.callFake((key: SettingsKey) => {
      if (key === SettingsKey.PRIVACY_ACK) return 'true';
      return undefined;
    });

    app = new App(
      mockEventQueue,
      mockServerRepo,
      mockRootEl,
      false, // debugMode
      undefined, // urlInterceptor
      mockClipboard,
      mockErrorReporter,
      mockSettings,
      mockEnvironment,
      mockUpdater,
      mockInstaller,
      mockQuitApplication,
      mockDocument
    );
  });

  describe('handleUpdateServerConfig', () => {
    let mockServer: jasmine.SpyObj<Server>;
    const serverId = 'server123';
    const initialAllowedApps = ['com.initial.app'];
    const newAllowedApps = ['com.new.app1', 'com.new.app2'];

    beforeEach(() => {
      mockServer = jasmine.createSpyObj('Server', ['checkRunning', 'connect', 'disconnect']);
      mockServer.id = serverId;
      mockServer.name = 'Test Server';
      mockServer.allowedApps = [...initialAllowedApps]; // Start with initial set
      mockServerRepo.getById.and.returnValue(mockServer);
    });

    it('should update server.allowedApps and call serverRepo.updateServer', async () => {
      mockServer.checkRunning.and.returnValue(Promise.resolve(false)); // Simulate server not running

      // Directly call the method - it's private, so for testing purposes, we cast 'app' to 'any'
      // or it would need to be made protected/internal for easier testing.
      // A better way might be to trigger the event on rootEl if the listener is set up.
      // For simplicity, we'll assume direct call is possible for this test.
      await (app as any).handleUpdateServerConfig({
        detail: { serverId, allowedApps: newAllowedApps, propertyName: 'allowedApps' },
      } as CustomEvent);

      expect(mockServerRepo.getById).toHaveBeenCalledWith(serverId);
      expect(mockServer.allowedApps).toEqual(newAllowedApps);
      expect(mockServerRepo.updateServer).toHaveBeenCalledWith(mockServer);
      expect(mockRootEl.showToast).toHaveBeenCalledWith('Settings saved', 2000);
    });

    it('should not call disconnect/connect if server is not running', async () => {
      mockServer.checkRunning.and.returnValue(Promise.resolve(false));

      await (app as any).handleUpdateServerConfig({
        detail: { serverId, allowedApps: newAllowedApps, propertyName: 'allowedApps' },
      } as CustomEvent);

      expect(mockServer.disconnect).not.toHaveBeenCalled();
      expect(mockServer.connect).not.toHaveBeenCalled();
    });

    it('should call disconnect and connect if server is running', async () => {
      mockServer.checkRunning.and.returnValue(Promise.resolve(true)); // Simulate server running
      mockServer.disconnect.and.returnValue(Promise.resolve());
      mockServer.connect.and.returnValue(Promise.resolve());

      await (app as any).handleUpdateServerConfig({
        detail: { serverId, allowedApps: newAllowedApps, propertyName: 'allowedApps' },
      } as CustomEvent);

      expect(mockServer.disconnect).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalled(); // connect is called after disconnect
      expect(mockRootEl.showToast).toHaveBeenCalledWith('Reconnecting server to apply changes...', 3000);
      expect(mockRootEl.showToast).toHaveBeenCalledWith('Server reconnected with new settings.', 3000);
    });

    it('should only handle "allowedApps" propertyName', async () => {
      await (app as any).handleUpdateServerConfig({
        detail: { serverId, someOtherData: ['test'], propertyName: 'someOtherProperty' },
      } as CustomEvent);

      expect(mockServerRepo.getById).toHaveBeenCalledWith(serverId);
      expect(mockServer.allowedApps).toEqual(initialAllowedApps); // Should not change
      expect(mockServerRepo.updateServer).not.toHaveBeenCalled();
    });
  });

  // Basic test for connectServer to ensure it uses the server object which would contain allowedApps
  describe('connectServer', () => {
    it('should call server.connect()', async () => {
      const serverId = 'serverConnectTest';
      const mockServerObj = jasmine.createSpyObj<Server>('Server', ['connect', 'checkRunning', 'disconnect']);
      mockServerObj.id = serverId;
      mockServerObj.name = 'Connect Test Server';
      mockServerObj.allowedApps = ['com.specific.app']; // Server object has allowedApps

      mockServerRepo.getById.and.returnValue(mockServerObj);
      mockServerObj.connect.and.returnValue(Promise.resolve());

      // Simulate the event that triggers connectServer
      const event = new CustomEvent('ConnectPressed', { detail: { serverId } });
      await (app as any).connectServer(event); // Cast to any to access private method for test

      expect(mockServerRepo.getById).toHaveBeenCalledWith(serverId);
      expect(mockServerObj.connect).toHaveBeenCalled();
      // Further testing that OutlineServer.connect passes allowedApps to vpnApi.start
      // is implicitly covered by vpn.cordova.spec.ts and the OutlineServer implementation.
    });
  });
});
