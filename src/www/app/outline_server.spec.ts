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

import {InMemoryStorage} from '../infrastructure/memory_storage';

import {ShadowsocksConfig} from './config';
import {AccessKeyById, ConfigById, migrateServerStorageToV1, OutlineServerRepository, shadowsocksConfigToAccessKey} from './outline_server';

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
    const configById: ConfigById = {'server-0': config0, 'server-1': config1};
    const configByIdJson = JSON.stringify(configById);
    const storage = new InMemoryStorage(
        new Map([[OutlineServerRepository.SERVERS_STORAGE_KEY_V0, configByIdJson]]));

    migrateServerStorageToV1(storage);

    const accessKeyByIdJson = storage.getItem(OutlineServerRepository.SERVERS_STORAGE_KEY);
    expect(accessKeyByIdJson).toBeDefined();
    const accessKeyById: AccessKeyById = JSON.parse(accessKeyByIdJson || '');
    expect(accessKeyById['server-0']).toEqual(shadowsocksConfigToAccessKey(config0));
    expect(accessKeyById['server-1']).toEqual(shadowsocksConfigToAccessKey(config1));
  });

  it('loads migrated V1 servers', () => {
    const accessKey0 = shadowsocksConfigToAccessKey({
      host: '127.0.0.1',
      port: 1080,
      password: 'test',
      method: 'chacha20-ietf-poly1305',
      name: 'fake server',
    });
    const accessKey1 = shadowsocksConfigToAccessKey({
      host: '127.0.0.1',
      port: 1089,
      password: 'test',
      method: 'chacha20-ietf-poly1305',
      name: 'fake outline server',
      extra: {outline: '1'},
    });

    const accessKeyById: AccessKeyById = {'server-0': accessKey0, 'server-1': accessKey1};
    const accessKeyByIdJson = JSON.stringify(accessKeyById);
    const storage = new InMemoryStorage(
        new Map([[OutlineServerRepository.SERVERS_STORAGE_KEY, accessKeyByIdJson]]));

    migrateServerStorageToV1(storage);

    const accessKeyByIdStorageJson = storage.getItem(OutlineServerRepository.SERVERS_STORAGE_KEY);
    expect(accessKeyByIdStorageJson).toBeDefined();
    const accessKeyByIdStorage: AccessKeyById = JSON.parse(accessKeyByIdStorageJson || '');
    expect(accessKeyByIdStorage).toEqual(accessKeyById);
  });
});
