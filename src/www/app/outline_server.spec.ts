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
import {EventQueue} from '../model/events';

import {ShadowsocksConfig} from './config';
import {FakeOutlineTunnel} from './fake_tunnel';
import {OutlineServer, OutlineServerFactory, OutlineServerRepository, ServersStorageV0, ServersStorageV1, shadowsocksConfigToAccessKey} from './outline_server';

// TODO(alalama): unit tests for OutlineServer and OutlineServerRepository.

describe('OutlineServerRepository', () => {
  const CONFIG_0: ShadowsocksConfig = {
    host: '127.0.0.1',
    port: 1080,
    password: 'test',
    method: 'chacha20-ietf-poly1305',
    name: 'fake server 0'
  };

  const CONFIG_1: ShadowsocksConfig = {
    host: '10.0.0.1',
    port: 1089,
    password: 'test',
    method: 'chacha20-ietf-poly1305',
    name: 'fake server 1'
  };

  it('loads V0 servers', () => {
    const storageV0: ServersStorageV0 = {'server-0': CONFIG_0, 'server-1': CONFIG_1};
    const storage = new InMemoryStorage(
        new Map([[OutlineServerRepository.SERVERS_STORAGE_KEY_V0, JSON.stringify(storageV0)]]));
    const repo = new OutlineServerRepository(getFakeServerFactory(), new EventQueue(), storage);
    const server0 = repo.getById('server-0');
    expect(server0?.accessKey).toEqual(shadowsocksConfigToAccessKey(CONFIG_0));
    expect(server0?.name).toEqual(CONFIG_0.name);
    const server1 = repo.getById('server-1');
    expect(server1?.accessKey).toEqual(shadowsocksConfigToAccessKey(CONFIG_1));
    expect(server1?.name).toEqual(CONFIG_1.name);
  });

  it('loads V1 servers', () => {
    // Store V0 servers with different ids.
    const storageV0: ServersStorageV0 = {'v0-server-0': CONFIG_0, 'v0-server-1': CONFIG_1};
    const storageV1: ServersStorageV1 = [
      {id: 'server-0', name: 'fake server 0', accessKey: shadowsocksConfigToAccessKey(CONFIG_0)},
      {id: 'server-1', name: 'renamed server', accessKey: shadowsocksConfigToAccessKey(CONFIG_1)}
    ];
    const storage = new InMemoryStorage(new Map([
      [OutlineServerRepository.SERVERS_STORAGE_KEY_V0, JSON.stringify(storageV0)],
      [OutlineServerRepository.SERVERS_STORAGE_KEY, JSON.stringify(storageV1)]
    ]));
    const repo = new OutlineServerRepository(getFakeServerFactory(), new EventQueue(), storage);
    const server0 = repo.getById('server-0');
    expect(server0?.accessKey).toEqual(shadowsocksConfigToAccessKey(CONFIG_0));
    expect(server0?.name).toEqual(CONFIG_0.name);
    const server1 = repo.getById('server-1');
    expect(server1?.accessKey).toEqual(shadowsocksConfigToAccessKey(CONFIG_1));
    expect(server1?.name).toEqual('renamed server');
  });

  it('stores V1 servers', () => {
    const storageV0: ServersStorageV0 = {'server-0': CONFIG_0, 'server-1': CONFIG_1};
    const storage = new InMemoryStorage(
        new Map([[OutlineServerRepository.SERVERS_STORAGE_KEY_V0, JSON.stringify(storageV0)]]));
    const repo = new OutlineServerRepository(getFakeServerFactory(), new EventQueue(), storage);
    // Trigger storage change.
    repo.forget('server-1');
    repo.undoForget('server-1');

    const serversJson = JSON.parse(storage.getItem(OutlineServerRepository.SERVERS_STORAGE_KEY));
    expect(serversJson).toContain({
      id: 'server-0',
      name: 'fake server 0',
      accessKey: shadowsocksConfigToAccessKey(CONFIG_0)
    });
    expect(serversJson).toContain({
      id: 'server-1',
      name: 'fake server 1',
      accessKey: shadowsocksConfigToAccessKey(CONFIG_1)
    });
  });
});

function getFakeServerFactory(): OutlineServerFactory {
  return (id: string, accessKey: string, config: ShadowsocksConfig, eventQueue: EventQueue) => {
    return new OutlineServer(id, accessKey, config, new FakeOutlineTunnel(id), eventQueue);
  };
}
