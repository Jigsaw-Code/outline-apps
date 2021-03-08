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

import {InMemoryStorage} from '../infrastructure/memory_storage';

import {ShadowsocksConfig, shadowsocksConfigToAccessKey} from './config';
import {ConfigById, ConfigByIdV0, migrateServerStorageToV1, OutlineServerRepository} from './outline_server';

// TODO(alalama): unit tests for OutlineServer and OutlineServerRepository.

describe('migrateServerStorageToV1', () => {
  it('migrates storage to V1', () => {
    const config0: ShadowsocksConfig = {
      host: '127.0.0.1',
      port: 1080,
      password: 'test',
      method: 'chacha20-ietf-poly1305',
      name: 'fake server 0'
    };
    const config1: ShadowsocksConfig = {
      host: '127.0.0.1',
      port: 1089,
      password: 'test',
      method: 'chacha20-ietf-poly1305',
      name: 'fake server 1'
    };
    const configByIdV0: ConfigByIdV0 = {'server-0': config0, 'server-1': config1};
    const configByIdV0Json = JSON.stringify(configByIdV0);
    const storage = new InMemoryStorage(
        new Map([[OutlineServerRepository.SERVERS_STORAGE_KEY_V0, configByIdV0Json]]));

    migrateServerStorageToV1(storage);

    const configByIdV1Json = storage.getItem(OutlineServerRepository.SERVERS_STORAGE_KEY);
    expect(configByIdV1Json).toBeDefined();
    const configByIdV1: ConfigById = JSON.parse(configByIdV1Json || '');
    expect(configByIdV1['server-0'].accessKey).toEqual(shadowsocksConfigToAccessKey(config0));
    expect(configByIdV1['server-0'].name).toEqual(config0.name);
    expect(configByIdV1['server-1'].accessKey).toEqual(shadowsocksConfigToAccessKey(config1));
    expect(configByIdV1['server-1'].name).toEqual(config1.name);
  });

  it('loads migrated V1 servers', () => {
    const serverJson0 = {
      accessKey: shadowsocksConfigToAccessKey({
        host: '127.0.0.1',
        port: 1080,
        password: 'test',
        method: 'chacha20-ietf-poly1305',
      }),
      name: 'fake server 0',
    };
    const serverJson1 = {
      accessKey: shadowsocksConfigToAccessKey({
        host: '127.0.0.1',
        port: 1089,
        password: 'test',
        method: 'chacha20-ietf-poly1305',
      }),
      name: 'fake server 1',
    };

    const configByIdV1: ConfigById = {'server-0': serverJson0, 'server-1': serverJson1};
    const configByIdV0Json = JSON.stringify(configByIdV1);
    const storage = new InMemoryStorage(
        new Map([[OutlineServerRepository.SERVERS_STORAGE_KEY, configByIdV0Json]]));

    migrateServerStorageToV1(storage);

    const configByIdV1Json = storage.getItem(OutlineServerRepository.SERVERS_STORAGE_KEY);
    expect(configByIdV1Json).toBeDefined();
    const configByIdV1Storage: ConfigById = JSON.parse(configByIdV1Json || '');
    expect(configByIdV1Storage).toEqual(configByIdV1);
  });
});
