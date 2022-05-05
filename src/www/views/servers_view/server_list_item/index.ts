import {LitElement} from 'lit';
import {property} from 'lit/decorators.js';

import {ServerConnectionState} from '../server_connection_indicator';

export enum ServerListItemEvent {
  CONNECT = 'ConnectPressed',
  DISCONNECT = 'DisconnectPressed',
  FORGET = 'ForgetPressed',
  RENAME = 'ShowServerRename',
}

export interface ServerListItem {
  disabled: boolean;
  errorMessageId?: string;
  isOutlineServer: boolean;
  address: string;
  id: string;
  name: string;
  connectionState: ServerConnectionState;
}

export class ServerListItemElement extends LitElement {
  @property() server: ServerListItem;

  get isConnected() {
    return [
      ServerConnectionState.CONNECTING,
      ServerConnectionState.CONNECTED,
      ServerConnectionState.RECONNECTING,
    ].includes(this.server.connectionState);
  }

  dispatchServerRenameEvent() {
    this.dispatchEvent(new CustomEvent(ServerListItemEvent.RENAME, {detail: this.server}));
  }

  dispatchServerForgetEvent() {
    this.dispatchEvent(new CustomEvent(ServerListItemEvent.FORGET, {detail: this.server}));
  }

  dispatchServerConnectEvent() {
    this.dispatchEvent(
      new CustomEvent(this.isConnected ? ServerListItemEvent.DISCONNECT : ServerListItemEvent.CONNECT, {
        detail: this.server,
      })
    );
  }
}
