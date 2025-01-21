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

// TODO: Separate this config into LinuxVpnConfig and WindowsVpnConfig. Some fields may share.
interface VpnConfig {
  id: string;
  interfaceName: string;
  connectionName: string;
  ipAddress: string;
  dnsServers: string[];
  routingTableId: number;
  routingPriority: number;
  protectionMark: number;
}

interface EstablishVpnRequest {
  vpn: VpnConfig;
  transport: string;
}

let currentRequestId: string | undefined = undefined;

export async function establishVpn(request: StartRequestJson) {
  currentRequestId = request.id;
  statusCb?.(currentRequestId, TunnelStatus.RECONNECTING);

  const config: EstablishVpnRequest = {
    vpn: {
      id: currentRequestId,

      // TUN device name, being compatible with old code:
      // https://github.com/Jigsaw-Code/outline-apps/blob/client/linux/v1.14.0/client/electron/linux_proxy_controller/outline_proxy_controller.h#L203
      interfaceName: 'outline-tun0',

      // Network Manager connection name, Use "TUN Connection" instead of "VPN Connection"
      // because Network Manager has a dedicated "VPN Connection" concept that we did not implement
      connectionName: 'Outline TUN Connection',

      // TUN IP, being compatible with old code:
      // https://github.com/Jigsaw-Code/outline-apps/blob/client/linux/v1.14.0/client/electron/linux_proxy_controller/outline_proxy_controller.h#L204
      ipAddress: '10.0.85.1',

      // DNS server list, being compatible with old code:
      // https://github.com/Jigsaw-Code/outline-apps/blob/client/linux/v1.14.0/client/electron/linux_proxy_controller/outline_proxy_controller.h#L207
      dnsServers: ['9.9.9.9'],

      // Outline magic numbers, 7113 and 0x711E visually resembles "T L I E" in "ouTLInE"
      routingTableId: 7113,
      routingPriority: 0x711e,
      protectionMark: 0x711e,
    },

    // The actual transport config
    transport: request.config.transport,
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
