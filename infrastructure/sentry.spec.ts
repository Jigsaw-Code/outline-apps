// Copyright 2020 The Outline Authors
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

import * as sentry from './sentry';

describe('getSentryApiUrl', () => {
  it('returns the right URL', () => {
    const url = sentry.getSentryApiUrl(
      'https://_key_@_org_.ingest.sentry.io/_project_'
    );
    expect(url).toEqual(
      'https://_org_.ingest.sentry.io/api/_project_/store/?sentry_version=7&sentry_key=_key_'
    );
  });
});
