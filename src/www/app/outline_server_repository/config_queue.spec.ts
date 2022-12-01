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

import {ConfigQueue} from './config_queue';
import {ShadowsocksSessionConfig} from '../tunnel';

const CONFIG_1 = {
  host: "host1",
  port: 1111,
  method: "http",
  password: "aHVudGVyMg==",
  prefix: "prefix1",
}

const CONFIG_2 = {
  host: "host2",
  port: 2222,
  method: "ssconf",
  password: "b3V0bGluZQ==",
  prefix: "prefix2",
}

const CONFIG_3 = {
  host: "host3",
  port: 3333,
  method: "http",
  password: "T1BF",
  prefix: "prefix3",
}

// ### Need to include tests with config4,5 to prove order after updateConfigs for
// both ready and used configs.

const CONFIG_4 = {
  host: "host4",
  port: 4444,
  method: "ssconf",
  password: "bXl2b2ljZWlzbXlwYXNzcG9ydA==",
  prefix: "prefix4",
}

const CONFIG_5 = {
  host: "host5",
  port: 5555,
  method: "http",
  password: "c3dvcmRmaXNo",
  prefix: "prefix5",
}

function slurpConfigs(queue: ConfigQueue) : ShadowsocksSessionConfig[] {
  const ret = [];
  while(true) {
    const config = queue.getConfig();
    if (config === null) return ret;
    ret.push(config)
  }
}

describe('ConfigQueue', () => {
  it('junk test', () => {
    expect(1).toEqual(1);
  });
  it('empty queue', () => {
    const queue = new ConfigQueue();
    expect(slurpConfigs(queue)).toEqual([]);

    queue.reset();
    expect(slurpConfigs(queue)).toEqual([]);

    queue.updateConfigs([]);
    expect(slurpConfigs(queue)).toEqual([]);

    queue.reset();
    expect(slurpConfigs(queue)).toEqual([]);
  });
  it('order maintained', () => {
    const queue = new ConfigQueue();
    queue.updateConfigs([CONFIG_1, CONFIG_2, CONFIG_3]);
    expect(slurpConfigs(queue)).toEqual([CONFIG_1, CONFIG_2, CONFIG_3]);
  });
  it('once null, always null (until reset)', () => {
    const queue = new ConfigQueue();
    queue.updateConfigs([CONFIG_1, CONFIG_2, CONFIG_3]);
    expect(slurpConfigs(queue)).toEqual([CONFIG_1, CONFIG_2, CONFIG_3]);

    expect(queue.getConfig()).toBeNull();
    expect(queue.getConfig()).toBeNull();
    expect(queue.getConfig()).toBeNull();
    expect(queue.getConfig()).toBeNull();

    queue.reset();
    expect(slurpConfigs(queue)).toEqual([CONFIG_1, CONFIG_2, CONFIG_3]);
  });
  it('update ready configs', () => {
    const queue = new ConfigQueue();
    queue.updateConfigs([CONFIG_1, CONFIG_2, CONFIG_3]);
    queue.updateConfigs([CONFIG_3, CONFIG_1, CONFIG_2]);
    // Order from original call is maintained.
    expect(slurpConfigs(queue)).toEqual([CONFIG_1, CONFIG_2, CONFIG_3]);

    // All configs come out again after reset.
    queue.reset();
    expect(slurpConfigs(queue)).toEqual([CONFIG_1, CONFIG_2, CONFIG_3]);
  });
  it('update used config', () => {
    const queue = new ConfigQueue();
    queue.updateConfigs([CONFIG_1, CONFIG_2, CONFIG_3]);
    expect(queue.getConfig()).toEqual(CONFIG_1);
    queue.updateConfigs([CONFIG_2, CONFIG_1, CONFIG_3]);

    // CONFIG_1 was already used, so it won't come out again.
    expect(slurpConfigs(queue)).toEqual([CONFIG_2, CONFIG_3]);

    // All configs come out again after reset.
    queue.reset();
    expect(slurpConfigs(queue)).toEqual([CONFIG_1, CONFIG_2, CONFIG_3]);
  });
  it('update with new config', () => {
    const queue = new ConfigQueue();
    queue.updateConfigs([CONFIG_1, CONFIG_2]);
    expect(queue.getConfig()).toEqual(CONFIG_1);
    queue.updateConfigs([CONFIG_2, CONFIG_3, CONFIG_1]);

    // CONFIG_1 was already used, so it won't come out again.
    // But CONFIG_3 was newly added, so it will come out,
    // and will come out first.
    expect(slurpConfigs(queue)).toEqual([CONFIG_3, CONFIG_2]);

    // All configs come out again after reset, in same order they came out
    // before.
    queue.reset();
    expect(slurpConfigs(queue)).toEqual([CONFIG_1, CONFIG_3, CONFIG_2]);
  });
  it('update to remove a used config', () => {
    const queue = new ConfigQueue();
    queue.updateConfigs([CONFIG_1, CONFIG_2, CONFIG_3]);
    expect(queue.getConfig()).toEqual(CONFIG_1);
    queue.updateConfigs([CONFIG_2, CONFIG_3]);

    expect(slurpConfigs(queue)).toEqual([CONFIG_2, CONFIG_3]);

    // CONFIG_1 has been removed so it won't come out even after reset.
    queue.reset();
    expect(slurpConfigs(queue)).toEqual([CONFIG_2, CONFIG_3]);
  });
  it('prioritize untried configs', () => {
    const queue = new ConfigQueue();
    queue.updateConfigs([CONFIG_1, CONFIG_2, CONFIG_3]);
    expect(queue.getConfig()).toEqual(CONFIG_1);
    expect(queue.getConfig()).toEqual(CONFIG_2);

    // CONFIG_3 was never seen, so it has highest priority.
    // CONFIG_1 was seen before CONFIG_2, so it comes next.
    queue.reset();
    expect(slurpConfigs(queue)).toEqual([CONFIG_3, CONFIG_1, CONFIG_2]);
  });
  it('prioritize configs whose most recent use is furthest in past', () => {
    // ### need to implement/correct this one. Right now it's same as above.
    const queue = new ConfigQueue();
    queue.updateConfigs([CONFIG_1, CONFIG_2, CONFIG_3]);
    expect(queue.getConfig()).toEqual(CONFIG_1);
    expect(queue.getConfig()).toEqual(CONFIG_2);

    // CONFIG_3 was never seen, so it has highest priority.
    // CONFIG_1 was seen before CONFIG_2, so it comes next.
    queue.reset();
    expect(slurpConfigs(queue)).toEqual([CONFIG_3, CONFIG_1, CONFIG_2]);
  });
  it('junk###', () => {
    const x:object = JSON.parse('[{ "a": 1, "b": 2 }, { "a": 3 }]');
    expect(typeof x).toEqual("sillytype");
    /*
    expect(x).toEqual(1);
    expect(x[0]).toEqual(1);
    expect(x instanceof Array).toEqual(true);
    expect(x[0] instanceof Array).toEqual(false);
   */
  });
});
