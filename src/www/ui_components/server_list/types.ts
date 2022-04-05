import {ServerConnectionState} from "../server_card";

export interface ServerListItem {
  disabled: boolean;
  errorMessageId: string;
  isOutlineServer: boolean;
  address: string;
  id: string;
  name: string;
  state: typeof ServerConnectionState;
}
