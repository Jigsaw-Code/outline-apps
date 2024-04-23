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

// Returns Sentry URL for DSN string or undefined if `sentryDsn` is falsy.
// e.g. for DSN "https://[API_KEY]@[SUBDOMAIN].ingest.sentry.io/[PROJECT_ID]"
// this will return
// "https://[SUBDOMAIN].ingest.sentry.io/api/[PROJECT_ID]/store/?sentry_version=7&sentry_key=[API_KEY]"
export function getSentryApiUrl(sentryDsn?: string): string | undefined {
  if (!sentryDsn) {
    return undefined;
  }
  const dsnUrl = new URL(sentryDsn);
  const sentryKey = dsnUrl.username;
  // Trims leading '/';
  const project = dsnUrl.pathname.substr(1);
  return `https://${encodeURIComponent(dsnUrl.hostname)}/api/${encodeURIComponent(
    project
  )}/store/?sentry_version=7&sentry_key=${sentryKey}`;
}
