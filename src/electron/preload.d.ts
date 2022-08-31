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

import {Clipboard} from 'electron';
import {ElectronRendererMethodChannel} from './preload';

// This file can be referenced in electron renderer scripts. It defines
// the strongly typed global objects injected by preload.ts

export interface NativeOsApi {
  platform: string;
}

export interface ElectronApi {
  readonly os: NativeOsApi;
  readonly clipboard: Clipboard;
  readonly methodChannel: ElectronRendererMethodChannel;
}

declare global {
  interface Window {
    /**
     * All electron or node features exposed to electron's renderer process.
     */
    electron: ElectronApi;
  }
}
