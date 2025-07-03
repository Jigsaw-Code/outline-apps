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

import {deserializeError} from '../model/platform_error';

export const OUTLINE_PLUGIN_NAME = 'OutlinePlugin';

// Describes the structure of application information retrieved from the plugin.
export interface AppInfo {
  packageName: string;
  label: string;
  // icon?: string; // Future: consider adding app icons
}

// Helper function to call the Outline Cordova plugin.
export async function pluginExec<T>(
  cmd: string,
  ...args: unknown[]
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const wrappedReject = (e: unknown) => reject(deserializeError(e));
    cordova.exec(resolve, wrappedReject, OUTLINE_PLUGIN_NAME, cmd, args);
  });
}

// Fetches the list of installed applications from the native plugin.
export async function getInstalledApplications(): Promise<AppInfo[]> {
  return pluginExec<AppInfo[]>('getInstalledApps');
}
