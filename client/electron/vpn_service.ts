// Copyright 2024 The Outline Authors
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

import {invokeMethod} from './go_plugin';
import {
  StartRequestJson,
  TunnelStatus,
} from '../src/www/app/outline_server_repository/vpn';

interface VpnConfig {
  id: string;
  interfaceName: string;
  ipAddress: string;
  dnsServers: string[];
  routingTableId: number;
  routingPriority: number;
  protectionMark: number;
  transport: string;
}

let currentRequestId: string | undefined = undefined;

export async function establishVpn(request: StartRequestJson) {
  currentRequestId = request.id;
  statusCb?.(currentRequestId, TunnelStatus.RECONNECTING);
  const config: VpnConfig = {
    id: currentRequestId,
    interfaceName: 'outline-tun0',
    ipAddress: '10.0.85.5',
    dnsServers: ['9.9.9.9'],
    routingTableId: 7113,
    routingPriority: 28958,
    protectionMark: 0x711e,
    transport: JSON.stringify(request.config.transport),
  };
  await invokeMethod('EstablishVPN', JSON.stringify(config));
  statusCb?.(currentRequestId, TunnelStatus.CONNECTED);
}

export async function closeVpn(): Promise<void> {
  statusCb?.(currentRequestId!, TunnelStatus.DISCONNECTING);
  await invokeMethod('CloseVPN', '');
  statusCb?.(currentRequestId!, TunnelStatus.DISCONNECTED);
}

export type VpnStatusCallback = (id: string, status: TunnelStatus) => void;

let statusCb: VpnStatusCallback | undefined = undefined;

export function onVpnStatusChanged(cb: VpnStatusCallback): void {
  statusCb = cb;
}
