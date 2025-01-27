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

import {invokeGoMethod, newCallback} from './go_plugin';
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

export async function establishVpn(request: StartRequestJson) {
  const config: EstablishVpnRequest = {
    vpn: {
      id: request.id,

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

  await invokeGoMethod('EstablishVPN', JSON.stringify(config));
}

export async function closeVpn(): Promise<void> {
  await invokeGoMethod('CloseVPN', '');
}

export type VpnStatusCallback = (id: string, status: TunnelStatus) => void;

/**
 * Registers a callback function to be invoked when the VPN status changes.
 *
 * @param cb - The callback function to be invoked when the VPN status changes.
 *             The callback will receive the VPN connection ID as well as the new status.
 *
 * @remarks The caller should subscribe to this event **only once**.
 *          Use the `id` parameter in the callback to identify the firing VPN connection.
 */
export async function onVpnStatusChanged(cb: VpnStatusCallback): Promise<void> {
  if (!cb) {
    return;
  }

  const cbToken = await newCallback(data => {
    const conn = JSON.parse(data) as VPNConnectionState;
    console.debug(`received ${StatusChangedEvent}`, conn);
    switch (conn?.status) {
      case VPNConnConnected:
        cb(conn.id, TunnelStatus.CONNECTED);
        break;
      case VPNConnConnecting:
        cb(conn.id, TunnelStatus.RECONNECTING);
        break;
      case VPNConnDisconnecting:
        cb(conn.id, TunnelStatus.DISCONNECTING);
        break;
      case VPNConnDisconnected:
        cb(conn.id, TunnelStatus.DISCONNECTED);
        break;
    }
    return '';
  });

  await invokeGoMethod(
    'AddEventListener',
    JSON.stringify({
      name: StatusChangedEvent,
      callbackToken: cbToken,
    })
  );
}

//#region type definitions of VPNConnection in Go

// The following constants and types should be aligned with the corresponding definitions
// in `./client/go/outline/vpn/vpn.go`.

const StatusChangedEvent = 'VPNConnStatusChanged';

type VPNConnStatus = string;
const VPNConnConnecting: VPNConnStatus = 'Connecting';
const VPNConnConnected: VPNConnStatus = 'Connected';
const VPNConnDisconnecting: VPNConnStatus = 'Disconnecting';
const VPNConnDisconnected: VPNConnStatus = 'Disconnected';

interface VPNConnectionState {
  readonly id: string;
  readonly status: VPNConnStatus;
}

//#endregion type definitions of VPNConnection in Go
