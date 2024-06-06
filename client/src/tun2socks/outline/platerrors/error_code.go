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

package platerrors

// ErrorCode can be used to identify the specific type of a [PlatformError].
// All possible ErrorCodes are defined as constants in this package.
// You can reliably use these values in TypeScript to check for specific errors.
type ErrorCode string

// Internal error codes

const (
	// GoError represents a general error in Go that is not a [PlatformError].
	// It is typically the last error in the chain of the causes in a [PlatformError].
	// This error code is for internal use only. You should not use it to create a [PlatformError]
	// in your Go code.
	GoError ErrorCode = "ERR_GOLANG_ERROR"

	// InvalidLogic indicates a development mistake that should be identified and
	// corrected during the development process. It should not be expected to occur in production.
	// Typically this error code is for internal use only. You should not use it to create a
	// [PlatformError] in your Go code.
	InvalidLogic ErrorCode = "ERR_INVALID_LOGIC"
)

// Common error codes

const (
	// IllegalArgument indicates that the caller (usually from TypeScript code) passed an
	// illegal argument to a native Go function.
	IllegalArgument ErrorCode = "ERR_ILLEGAL_ARGUMENT"

	// IllegalJSONString means that a string is not a valid JSON string.
	IllegalJSONString ErrorCode = "ERR_ILLEGAL_JSON_STRING"
)

// Common network error codes

const (
	// ResolveIPFailed means that we failed to resolve the IP address of a hostname.
	ResolveIPFailed ErrorCode = "ERR_NET_RESOLVE_IP"

	// ServerUnreachable means we failed to establish a connection to a remote server.
	ServerUnreachable ErrorCode = "ERR_SERVER_UNREACHABLE"

	// Unauthenticated indicates that the client failed to communicate with a remote server
	// due to the lack of valid authentication credentials.
	Unauthenticated ErrorCode = "ERR_CLIENT_UNAUTHENTICATED"
)

// Shadowsocks network error codes

const (
	// SSIllegalConfig indicates an invalid config to connect to a Shadowsocks server.
	SSIllegalConfig ErrorCode = "ERR_SHADOWSOCKS_ILLEGAL_CONFIG"

	// SSStreamDialerFailed means we failed to create a Shadowsocks StreamDialer.
	SSStreamDialerFailed ErrorCode = "ERR_SHADOWSOCKS_NEW_STREAM_DIALER"

	// SSPacketListenerFailed means we failed to create a Shadowsocks PacketListener.
	SSPacketListenerFailed ErrorCode = "ERR_SHADOWSOCKS_NEW_PACKET_LISTENER"

	// SSTCPConnectFailed means we failed to do a TCP connectivity test against the Shadowsocks server.
	SSTCPConnectFailed ErrorCode = "ERR_SHADOWSOCKS_TCP_CONNECT"

	// SSUDPUnsupported indicates that a Shadowsocks server does not support UDP.
	SSUDPUnsupported ErrorCode = "ERR_SHADOWSOCKS_UDP_NOT_SUPPORTED"
)

// I/O device error codes

const (
	// OpenTunDeviceFailed means we failed to open a specific tun/tap device.
	OpenTunDeviceFailed ErrorCode = "ERR_OPEN_TUN"

	// DeviceCopyDataFailed means we failed to copy data from one device to another.
	DeviceCopyDataFailed ErrorCode = "ERR_IO_COPY_DATA"
)
