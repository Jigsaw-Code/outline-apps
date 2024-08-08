// Copyright 2021 The Outline Authors
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

import {getShellExportCommands, ShadowboxSettings} from './server_install';

describe('getShellExportCommands', () => {
  it('fully populated', () => {
    const settings: ShadowboxSettings = {
      imageId: 'foo',
      metricsUrl: 'https://metrics.example/',
      sentryApiUrl: 'https://sentry.example/',
      watchtowerRefreshSeconds: 999,
    };
    const serverName = 'Outline Server Foo';
    expect(getShellExportCommands(settings, serverName, false)).toEqual(
      "export SB_IMAGE='foo'\n" +
        "export WATCHTOWER_REFRESH_SECONDS='999'\n" +
        "export SENTRY_API_URL='https://sentry.example/'\n" +
        "export SB_METRICS_URL='https://metrics.example/'\n" +
        "export SB_METRICS_ENABLED='false'\n" +
        'export SB_DEFAULT_SERVER_NAME="$(printf \'Outline Server Foo\')"\n'
    );
  });

  it('minimal', () => {
    const settings: ShadowboxSettings = {
      imageId: null,
      metricsUrl: '',
    };
    const serverName = '';
    expect(getShellExportCommands(settings, serverName, false)).toEqual(
      "export SB_METRICS_ENABLED='false'\nexport SB_DEFAULT_SERVER_NAME=\"$(printf '')\"\n"
    );
  });

  it('metricsEnabled', () => {
    const settings: ShadowboxSettings = {
      imageId: null,
      metricsUrl: '',
    };
    const serverName = '';
    expect(getShellExportCommands(settings, serverName, true)).toEqual(
      "export SB_METRICS_ENABLED='true'\nexport SB_DEFAULT_SERVER_NAME=\"$(printf '')\"\n"
    );
  });

  it('server name escaping', () => {
    const settings: ShadowboxSettings = {
      imageId: '',
      metricsUrl: null,
    };
    const serverName = 'Outline Server فرانكفورت';
    expect(getShellExportCommands(settings, serverName, false)).toEqual(
      "export SB_METRICS_ENABLED='false'\nexport SB_DEFAULT_SERVER_NAME=\"$(printf 'Outline Server \\u0641\\u0631\\u0627\\u0646\\u0643\\u0641\\u0648\\u0631\\u062a')\"\n"
    );
  });
});
