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

// This file can be referenced in electron renderer scripts. It defines
// the strongly typed global objects injected by preload.ts

export interface INativeOsAPI {
  platform: string;
}

export interface IIpcAPI {
  sendQuitApp(): void;
  sendEnvironmentInfo(env: {appVersion: string; dsn: string}): void;
  sendInstallOutlineServices(): Promise<import('../www/model/errors').ErrorCode>;
  onAddServer(callback: (url: string) => void): void;
  onLocalizationRequest(callback: (localizationKeys: string[]) => void): void;
  sendLocalizationResponse(result?: {[key: string]: string}): void;
  onPushClipboard(callback: () => void): void;
  onUpdateDownloaded(callback: () => void): void;
}

declare global {
  interface Window {
    /**
     * The OS platform object, should only be used in electron renderer.
     */
    os: INativeOsAPI;

    /**
     * The IpcRenderer object, should only be used in electron renderer.
     */
    ipc: IIpcAPI;
  }
}
