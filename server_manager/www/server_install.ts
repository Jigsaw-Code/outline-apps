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

/** Represents the settings needed to launch a dockerized shadowbox. */
export interface ShadowboxSettings {
  imageId: string;
  metricsUrl: string;
  sentryApiUrl?: string;
  watchtowerRefreshSeconds?: number;
}

export function getShellExportCommands(
  settings: ShadowboxSettings,
  serverName: string,
  metricsEnabled: boolean
): string {
  const variables: {[name: string]: string | number} = {
    SB_IMAGE: settings.imageId,
    WATCHTOWER_REFRESH_SECONDS: settings.watchtowerRefreshSeconds,
    SENTRY_API_URL: settings.sentryApiUrl,
    SB_METRICS_URL: settings.metricsUrl,
    SB_METRICS_ENABLED: String(metricsEnabled),
  };
  const lines: string[] = [];
  for (const name in variables) {
    if (variables[name]) {
      lines.push(`export ${name}='${variables[name]}'`);
    }
  }
  lines.push(
    `export SB_DEFAULT_SERVER_NAME="$(printf '${bashEscape(serverName)}')"`
  );
  return lines.join('\n') + '\n';
}

function bashEscape(s: string): string {
  // Replace each non-ASCII character with a unicode escape sequence that
  // is understood by bash.  This avoids an apparent bug in DigitalOcean's
  // handling of unicode characters in the user_data value.
  return s.replace(
    /\P{ASCII}/gu,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  );
}
