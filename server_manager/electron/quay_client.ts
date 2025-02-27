/**
 * Copyright 2025 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fetch from 'node-fetch';

const QUAY_API_BASE = 'https://quay.io/api/v1/';
const OUTLINE_SERVER_REPOSITORY_PATH = 'outline/shadowbox';

interface QuayTagsJson {
  tags: {
    name: string;
    reversion: boolean;
    start_ts: number;
    manifest_digest: string;
    is_manifest_list: boolean;
    size: number;
    last_modified: string;
    end_ts?: number;
    expiration?: string;
  }[];
  page: number;
  has_additional: boolean;
}

/**
 * Fetches the latest version name of the Outline Server from Quay.io.
 *
 * @returns {Promise<string | undefined>} The latest version of the Outline Server, if found.
 */
export async function fetchCurrentServerVersionName() {
  try {
    const response = await fetch(
      QUAY_API_BASE + `repository/${OUTLINE_SERVER_REPOSITORY_PATH}/tag`
    );

    const json = (await response.json()) as QuayTagsJson;

    return json.tags.find(tag => tag.name.startsWith('v')).name.slice(1);
  } catch (e) {
    console.error(e);

    return undefined;
  }
}
