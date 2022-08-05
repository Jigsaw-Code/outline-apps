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

// Starting from electron 12, contextIsolation is turned on by default.
// So we are not able to use node APIs or electron APIs in renderer scripts
// any more. We have to inject key features into the global window object
// in preload: https://www.electronjs.org/docs/latest/tutorial/tutorial-preload.

// Please also update preload.d.ts whenever you changed this file.

import {contextBridge} from 'electron';
import * as os from 'os';
import {OutlineIpcPreloadImpl} from './ipc-preload';

contextBridge.exposeInMainWorld('electron', {
  os: {
    platform: os.platform(),
  },
  ipc: new OutlineIpcPreloadImpl(),
});
