<!-- markdownlint-disable-file MD033 -->

# Outline Config Reference

Outline uses a YAML-based configuration to specify the VPN parameters and how to handle TCP and UDP traffic.

## Interfaces

### <a id=TunnelConfig></a>TunnelConfig

This is the format of the configuration returned by [Dynamic Access Keys](https://www.reddit.com/r/outlinevpn/wiki/index/dynamic_access_keys/).

Format: [ExplicitTunnelConfig](#ExplicitTunnelConfig) | [LegacyShadowsocksConfig](#LegacyShadowsocksConfig) | [LegacyShadowsocksURI](#LegacyShadowsocksURI)

### <a id=TransportConfig></a>TransportConfig

Format: [Interface](#Interface)

Supported Interface types:

- `tcpudp`: [TCPUDPConfig](#TCPUDPConfig)

### <a id=DialerConfig></a>DialerConfig

Format: _null_ | [Interface](#Interface)

The _null_ (absent) Dialer means the default Dialer, which is a TCP dialer for stream and UDP dialer for packets.

Supported Interface types:

- `shadowsocks`: [ShadowsocksConfig](#ShadowsocksConfig)

### <a id=PacketListenerConfig></a>PacketListenerConfig

Format: _null_ | [Interface](#Interface)

The _null_ (absent) Packet Listener means the default Packet Listener, which is a UDP Packet Listener.

Supported Interface types:

- `shadowsocks`: [ShadowsocksConfig](#ShadowsocksConfig)

### <a id=EndpointConfig></a>EndpointConfig

Format: _string_ | [Interface](#Interface)

The _string_ Endpoint is the host:port address of the desired endpoint. The connection is established using the default Dialer.

Supported Interface types:

- `dial`: [DialEndpointConfig](#DialEndpointConfig)
<!-- - `shadowsocks`: [ShadowsocksConfig](#ShadowsocksConfig) -->
<!-- - `websocket`: [WebsocketEndpointConfig](#WebsocketEndpointConfig) -->

## Implementations

### <a id=DialEndpointConfig></a>DialEndpointConfig

Format: _struct_

Fields:

- `address` (_string_): the endpoint address to dial
- `dialer` ([DialerConfig](#DialerConfig)): the dialer to use to dial the address

### <a id=Interface></a>Interface

Interfaces allow for choosing one of multiple implementations. It uses the `$type` field to specify the type that config represents.

Example:

```yaml
$type: shadowsocks
endpoint: example.com:4321
cipher: chacha20-ietf-poly1305
secret: SECRET
```

### <a id=LegacyShadowsocksConfig></a>LegacyShadowsocksConfig

Format: _struct_

Fields:

- `server` (_string_): the host to connect to
- `server_port` (_number_): the port number to connect to
- `method` (_string_): the [AEAD cipher](https://shadowsocks.org/doc/aead.html#aead-ciphers) to use
- `password` (_string_): used to generate the encryption key
- `prefix` (_string_): the [prefix disguise](https://www.reddit.com/r/outlinevpn/wiki/index/prefixing/) to use. Currently only supported on stream connections.

Example:

```yaml
server: example.com
server_port: 4321
method: chacha20-ietf-poly1305
password: SECRET
prefix: "POST "
```

### <a id=LegacyShadowsocksURI></a>LegacyShadowsocksURI

Format: _string_

See [Legacy Shadowsocks URI Format](https://shadowsocks.org/doc/configs.html#uri-and-qr-code) and [SIP002 URI scheme](https://shadowsocks.org/doc/sip002.html). We don't support plugins.

Example:

```yaml
ss://chacha20-ietf-poly1305:SECRET@example.com:443?prefix=POST%20
```

### <a id=ShadowsocksConfig></a>ShadowsocksConfig

Format: _struct_

Fields:

- `endpoint` ([EndpointConfig](#EndpointConfig)): the Shadowsocks endpoint to connect to
- `cipher` (_string_): the [AEAD cipher](https://shadowsocks.org/doc/aead.html#aead-ciphers) to use
- `secret` (_string_): used to generate the encryption key
- `prefix` (_string_): the [prefix disguise](https://www.reddit.com/r/outlinevpn/wiki/index/prefixing/) to use. Currently only supported on stream connections.

Example:

```yaml
endpoint: example.com:4321
cipher: chacha20-ietf-poly1305
secret: SECRET
prefix: "POST "
```

### <a id=TCPUDPConfig></a>TCPUDPConfig

Format: _struct_

Fields:

- `tcp` ([StreamDialer](#DialerConfig))
- `udp` ([PacketListener](#PacketListenerConfig))

Example sending TCP and UDP to different endpoints:

```yaml
tcp:
  $type: shadowsocks
  endpoint: ss.example.com:80
  <<: &cipher
    cipher: chacha20-ietf-poly1305
    secret: SECRET
  prefix: "POST "

udp:
  $type: shadowsocks
  endpoint: ss.example.com:53
  <<: *cipher
```

### <a id=ExplicitTunnelConfig></a>ExplicitTunnelConfig

Format: _struct_

Fields:

- `transport` ([TransportConfig](#TransportConfig)): the transports to use
- `error` (_struct_): information to communicate to the user in case of service error (e.g. key expired, quota exhausted)
  - `message` (_string_): user-friendly message to display to the user
  - `details` (_string_): message to display when the user opens the error details. Helpful for troubleshooting.

Fields `error` and `transport` must be mutually exclusive.

Successful example:

```yaml
transport:
  $type: tcpudp
  tcp:
    ...  # Stream Dialer for TCP
  udp:
    ...  # Packet Listener for UDP
```

Error example:

```yaml
error:
  message: Quota exceeded
  details: Used 100GB out of 100GB
```

<!--
### <a id=WebsocketEndpointConfig></a>WebsocketEndpointConfig
Format: _struct_

Fields:
- `url` (_string_): the url to connect to
-->
