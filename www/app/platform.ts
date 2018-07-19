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

import {Clipboard} from './clipboard';
import {EnvironmentVariables} from './environment';
import {OutlineErrorReporter} from './error_reporter';
import {PersistentServerFactory} from './persistent_server';
import {Updater} from './updater';
import {UrlInterceptor} from './url_interceptor';

// Provides platform-specific dependencies.
// TODO: Remove one of hasDeviceSupport and getPersistentServerFactory; they're almost the same
//       thing and currently hasDeviceSupport is only used to populate the server list when running
//       in demo mode.
export interface OutlinePlatform {
  // Returns true iff the system has support for proxying. When this returns false, the UI should
  // assume it's running in demo mode, e.g. Electron on macOS.
  hasDeviceSupport(): boolean;

  getPersistentServerFactory(): PersistentServerFactory;

  getUrlInterceptor(): UrlInterceptor|undefined;

  getClipboard(): Clipboard;

  getErrorReporter(environment: EnvironmentVariables): OutlineErrorReporter;

  getUpdater(): Updater;

  quitApplication(): void;
}
