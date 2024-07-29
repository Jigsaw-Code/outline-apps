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
import {OutlineServerRepository} from './outline_server_repository';
import {Updater} from './updater';
import {UrlInterceptor} from './url_interceptor';
import {VpnInstaller} from './vpn_installer';
import {EventQueue} from '../model/events';
import {OutlineErrorReporter} from '../shared/error_reporter';

// Provides platform-specific dependencies.
// TODO(fortuna): pick platform-specific implementations at build time instead.
export interface OutlinePlatform {
  // Creates the OutlineServerRepository for this platform. Returns undefined if the platform is not supported.
  newServerRepo(eventQueue: EventQueue): OutlineServerRepository | undefined;

  getUrlInterceptor(): UrlInterceptor | undefined;

  getClipboard(): Clipboard;

  getErrorReporter(environment: EnvironmentVariables): OutlineErrorReporter;

  getUpdater(): Updater;

  getVpnServiceInstaller(): VpnInstaller;

  quitApplication(): void;
}
