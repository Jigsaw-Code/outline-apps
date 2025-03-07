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

interface QuayTagsJsonPayload {
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
interface QuayTag {
  name: string;
  reversion: boolean;
  startTimestamp: number;
  manifestDigest: string;
  isManifestList: boolean;
  size: number;
  lastModified: string;
  endTimestamp?: number;
  expiration?: string;
}

/**
 * Fetches the latest version tags of Shadowbox from Quay.io (does not paginate).
 *
 * @returns {Promise<QuayTag[]>} The latest version of the Outline Server, if found.
 */
export async function fetchRecentShadowboxVersionTags(): Promise<QuayTag[]> {
  try {
    const response = await fetch(
      QUAY_API_BASE + `repository/${OUTLINE_SERVER_REPOSITORY_PATH}/tag`
    );

    if (!(response.status === 200 && response.ok)) {
      return Promise.reject(response.statusText);
    }

    const json = (await response.json()) as QuayTagsJsonPayload;

    return json.tags.map(tag => ({
      endTimestamp: tag.end_ts,
      expiration: tag.expiration,
      isManifestList: tag.is_manifest_list,
      lastModified: tag.last_modified,
      manifestDigest: tag.manifest_digest,
      name: tag.name,
      reversion: tag.reversion,
      size: tag.size,
      startTimestamp: tag.start_ts,
    }));
  } catch (e) {
    console.error(e);

    return Promise.reject(e.message);
  }
}
