// Copyright 2022 The Outline Authors
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

import {ShadowsocksSessionConfig} from '../tunnel';

// ConfigQueue holds a collection of session configs.  It provides
// iterative access to the configs via the GetConfig() function and also
// supports updating the collection.
export class ConfigQueue {
  // readyConfigs are the remaining configs to try.  We pop from the end of this list,
  // so the most preferable configs should be last.
  private readyConfigs: ShadowsocksSessionConfig[] = [];
  // usedConfigs the configs that have already been tried since the last
  // reset().  We push onto the end of this list as config are used, so they are
  // stored in the order they were used since the last call to reset().
  private usedConfigs: ShadowsocksSessionConfig[] = [];

  constructor() {}

  reset() {
    // All configs will now become "ready".  But we want to first prioritize
    // configs that have not been tried yet.  After that, we can reuse the
    // used configs, prioritizing those that were tried furthest in the past.
    //
    // Since elements are popped from the end of readyConfigs, we therefore
    // want the lowest priorities first.  So our new readyConfigs list should
    // be the reverse of usedConfigs, followed by readyConfigs.
    //
    // We build this up in usedConfigs first, then swap with readyConfigs.
    this.usedConfigs.reverse()
    for (const config of this.readyConfigs) {
      this.usedConfigs.push(config);
    }
    this.readyConfigs = this.usedConfigs;
    this.usedConfigs = [];
  }

  getConfig() : ShadowsocksSessionConfig {
    if (this.readyConfigs.length == 0) return null;
    const config = this.readyConfigs.pop();
    this.usedConfigs.push(config);
    return config;
  }

  updateConfigs(configs: ShadowsocksSessionConfig[]) {
    // Add the new list of configs to a Map (which we're roughly using
    // only as a Set).
    const configsMap = new Map<string, ShadowsocksSessionConfig>();
    for (const config of configs) {
      configsMap.set(JSON.stringify(config), config);
    }

    // Remove all configs that are not in the map, and remove from
    // the map all of the configs that are already in our lists.
    this.readyConfigs = this.readyConfigs.filter(
      config => configsMap.delete(JSON.stringify(config)));
    this.usedConfigs = this.usedConfigs.filter(
      config => configsMap.delete(JSON.stringify(config)));

    // Now all that's left in the map is configs we haven't seen before.
    // They are fresh and new, so add them to the end of readyConfigs, in
    // the original order provided in `configs`.
    const newConfigs = configs.filter(
      config => configsMap.has(JSON.stringify(config))).reverse();
    for (const newConfig of newConfigs) {
      this.readyConfigs.push(newConfig);
    }
  }
}
