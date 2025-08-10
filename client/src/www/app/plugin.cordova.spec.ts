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

import { AppInfo, getInstalledApplications, OUTLINE_PLUGIN_NAME } from './plugin.cordova';
import { PlatformError } from '../model/platform_error';

describe('Cordova Plugin Interface', () => {
  let mockCordovaExec: jasmine.Spy;

  beforeEach(() => {
    // Mock cordova.exec for each test
    mockCordovaExec = spyOn(window.cordova, 'exec');
  });

  describe('getInstalledApplications', () => {
    it('should call cordova.exec with correct parameters', async () => {
      await getInstalledApplications();
      expect(mockCordovaExec).toHaveBeenCalledWith(
        jasmine.any(Function), // success callback
        jasmine.any(Function), // error callback
        OUTLINE_PLUGIN_NAME,
        'getInstalledApps',
        [] // arguments array
      );
    });

    it('should resolve with a list of apps on success', async () => {
      const mockApps: AppInfo[] = [
        { packageName: 'com.example.app1', label: 'App 1' },
        { packageName: 'com.example.app2', label: 'App 2' },
      ];
      mockCordovaExec.and.callFake((successCallback) => {
        successCallback(mockApps);
      });

      const apps = await getInstalledApplications();
      expect(apps).toEqual(mockApps);
    });

    it('should reject with an error on failure', async () => {
      const mockError = { message: 'Plugin error' };
      mockCordovaExec.and.callFake((_, errorCallback) => {
        errorCallback(mockError);
      });

      try {
        await getInstalledApplications();
        fail('Expected getInstalledApplications to reject');
      } catch (error) {
        // Expecting a PlatformError due to deserializeError in pluginExec
        expect(error instanceof PlatformError).toBeTrue();
      }
    });
  });

  // TODO: Add tests for other pluginExec calls if necessary, specifically for 'start' action
  // to verify `allowedApplications` is passed correctly. This might be better placed
  // in a test file for `vpn.cordova.ts` where `CordovaVpnApi.start` is defined.
});
