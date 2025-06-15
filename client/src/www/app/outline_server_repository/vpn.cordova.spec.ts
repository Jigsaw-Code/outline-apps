// Copyright 2024 The Outline Authors
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

import { CordovaVpnApi } from './vpn.cordova';
import { StartRequestJson, TunnelStatus } from './vpn';
import { OUTLINE_PLUGIN_NAME } from '../plugin.cordova';
import { IllegalServerConfiguration } from '../../model/errors';

describe('CordovaVpnApi', () => {
  let vpnApi: CordovaVpnApi;
  let mockCordovaExec: jasmine.Spy;

  beforeEach(() => {
    vpnApi = new CordovaVpnApi();
    mockCordovaExec = spyOn(window.cordova, 'exec');
  });

  describe('start', () => {
    const MOCK_REQUEST_BASE: Omit<StartRequestJson, 'allowedApplications'> = {
      id: 'server1',
      name: 'My Server',
      config: {
        client: {
          accessKey: 'ss://mock-key',
          method: 'chacha20-ietf-poly1305',
          password: 'password',
          serverAddress: '127.0.0.1',
          serverPort: 12345,
        },
        firstHop: '127.0.0.1:12345',
      },
    };

    it('should throw IllegalServerConfiguration if config is missing', () => {
      const request = { id: 'id', name: 'name' } as StartRequestJson; // Missing config
      expect(() => vpnApi.start(request)).toThrowError(IllegalServerConfiguration);
    });

    it('should call cordova.exec with correct parameters including allowedApplications', async () => {
      const request: StartRequestJson = {
        ...MOCK_REQUEST_BASE,
        allowedApplications: ['com.example.app1', 'com.example.app2'],
      };
      await vpnApi.start(request);
      expect(mockCordovaExec).toHaveBeenCalledWith(
        jasmine.any(Function), // success
        jasmine.any(Function), // error
        OUTLINE_PLUGIN_NAME,
        'start',
        [
          request.id,
          request.name,
          request.config.client,
          request.allowedApplications,
        ]
      );
    });

    it('should pass an empty array for allowedApplications if undefined', async () => {
      const request: StartRequestJson = { ...MOCK_REQUEST_BASE, allowedApplications: undefined };
      await vpnApi.start(request);
      expect(mockCordovaExec).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.any(Function),
        OUTLINE_PLUGIN_NAME,
        'start',
        [
          request.id,
          request.name,
          request.config.client,
          [], // Expect empty array
        ]
      );
    });

    it('should pass an empty array for allowedApplications if null', async () => {
      const request: StartRequestJson = { ...MOCK_REQUEST_BASE, allowedApplications: null as any };
      await vpnApi.start(request);
      expect(mockCordovaExec).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.any(Function),
        OUTLINE_PLUGIN_NAME,
        'start',
        [
          request.id,
          request.name,
          request.config.client,
          [], // Expect empty array
        ]
      );
    });

    it('should pass an empty array for allowedApplications if it is an empty array', async () => {
        const request: StartRequestJson = { ...MOCK_REQUEST_BASE, allowedApplications: [] };
        await vpnApi.start(request);
        expect(mockCordovaExec).toHaveBeenCalledWith(
          jasmine.any(Function),
          jasmine.any(Function),
          OUTLINE_PLUGIN_NAME,
          'start',
          [
            request.id,
            request.name,
            request.config.client,
            [], // Expect empty array
          ]
        );
      });
  });

  describe('stop', () => {
    it('should call cordova.exec with correct parameters', async () => {
      const serverId = 'server1';
      await vpnApi.stop(serverId);
      expect(mockCordovaExec).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.any(Function),
        OUTLINE_PLUGIN_NAME,
        'stop',
        [serverId]
      );
    });
  });

  describe('isRunning', () => {
    it('should call cordova.exec with correct parameters', async () => {
      const serverId = 'server1';
      await vpnApi.isRunning(serverId);
      expect(mockCordovaExec).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.any(Function),
        OUTLINE_PLUGIN_NAME,
        'isRunning',
        [serverId]
      );
    });
  });

  describe('onStatusChange', () => {
    it('should call cordova.exec with correct parameters for onStatusChange', () => {
      const listener = jasmine.createSpy('listener');
      vpnApi.onStatusChange(listener);
      expect(mockCordovaExec).toHaveBeenCalledWith(
        jasmine.any(Function), // The internal callback that calls the listener
        jasmine.any(Function), // error callback
        OUTLINE_PLUGIN_NAME,
        'onStatusChange',
        []
      );
    });

    it('listener should be called when plugin invokes the success callback', () => {
      const listener = jasmine.createSpy('listener');
      vpnApi.onStatusChange(listener);

      // Simulate the plugin calling the success callback
      const mockPluginResponse = {id: 'server1', status: TunnelStatus.CONNECTED};
      const successCallback = mockCordovaExec.calls.mostRecent().args[0];
      successCallback(mockPluginResponse);

      expect(listener).toHaveBeenCalledWith(mockPluginResponse.id, mockPluginResponse.status);
    });
  });
});
