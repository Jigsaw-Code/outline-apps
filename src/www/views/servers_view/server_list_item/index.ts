import {LitElement} from "lit";
import {property} from "lit/decorators.js";

import {ServerConnectionState} from "../server_connection_indicator";

export enum ServerListItemEvent {
  CONNECT = "ConnectPressed",
  DISCONNECT = "DisconnectPressed",
  FORGET = "ForgetPressed",
  RENAME = "ShowServerRename",
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
}
