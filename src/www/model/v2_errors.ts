// import {OutlineError} from '../../infrastructure/outline_error';

export enum NativeOSErrorCodes {
  // TODO: NO_ERROR is weird. Only used internally by the Android plugin?
  NO_ERROR = 0,
  // TODO: Rename to something more specific, or remove - only used by Android?
  UNEXPECTED = 1,
  VPN_PERMISSION_NOT_GRANTED = 2,
  INVALID_SERVER_CREDENTIALS = 3,
  UDP_RELAY_NOT_ENABLED = 4,
  SERVER_UNREACHABLE = 5,
  VPN_START_FAILURE = 6,
  ILLEGAL_SERVER_CONFIGURATION = 7,
  SHADOWSOCKS_START_FAILURE = 8,
  CONFIGURE_SYSTEM_PROXY_FAILURE = 9,
  NO_ADMIN_PERMISSIONS = 10,
  UNSUPPORTED_ROUTING_TABLE = 11,
  SYSTEM_MISCONFIGURED = 12,
}

export enum TunnelConnectionErrorCodes {}

export enum ShadowsocksSessionErrorCodes {
  DYNAMIC_FETCH_FAILURE = 200,
  JSON_PARSE_FAILURE = 201,
  KEY_PARSE_FAILURE = 202,
  MISSING_METHOD = 203,
  MISSING_PASSWORD = 204,
  MISSING_HOST = 205,
  MISSING_PORT = 206,
}
