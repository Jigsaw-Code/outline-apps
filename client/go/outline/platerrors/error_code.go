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

//////////
// Error code definitions that will be shared across language boundaries.
// Update corresponding values in "platform_error.ts" when modifying.
//////////

// ErrorCode can be used to identify the specific type of a [PlatformError].
// All possible ErrorCodes are defined as constants in this package.
// You can reliably use these values in TypeScript to check for specific errors.
type ErrorCode = string

//////////
// Common error codes - general
//////////

const (
	// InternalError represents a general internal service error.
	InternalError ErrorCode = "ERR_INTERNAL_ERROR"

	// OperationCanceled means that user canceled the long running operation.
	OperationCanceled ErrorCode = "ERR_OPERATION_CANCELED_BY_USER"
)

//////////
// Common error codes - network
//////////

const (
	// ResolveIPFailed means that we failed to resolve the IP address of a hostname.
	ResolveIPFailed ErrorCode = "ERR_RESOLVE_IP_FAILURE"
)

//////////
// Common error codes - I/O device
//////////

const (
	// SetupTrafficHandlerFailed means we failed to setup the traffic handler for a protocol.
	SetupTrafficHandlerFailed ErrorCode = "ERR_TRAFFIC_HANDLER_SETUP_FAILURE"

	// VPNPermissionNotGranted means user did not grant us the required permission to setup VPN.
	VPNPermissionNotGranted ErrorCode = "ERR_VPN_PERMISSION_NOT_GRANTED"

	// SetupSystemVPNFailed means we failed to configure the system VPN to route to us.
	SetupSystemVPNFailed ErrorCode = "ERR_SYSTEM_VPN_SETUP_FAILURE"

	// DisconnectSystemVPNFailed means we failed to remove the system VPN.
	// This typically indicates that a reboot is needed.
	DisconnectSystemVPNFailed ErrorCode = "ERR_SYSTEM_VPN_DISCONNECT_FAILURE"

	// DataTransmissionFailed means we failed to copy data from one device to another.
	DataTransmissionFailed ErrorCode = "ERR_DATA_TRANSMISSION_FAILURE"
)

//////////
// Business logic error codes - proxy server
//////////

const (
	// ProxyServerUnreachable means we failed to establish a connection to a remote server.
	ProxyServerUnreachable ErrorCode = "ERR_PROXY_SERVER_UNREACHABLE"

	// ProxyServerWriteFailed means we failed to write data to a remote server.
	ProxyServerWriteFailed ErrorCode = "ERR_PROXY_SERVER_WRITE_FAILURE"

	// ProxyServerReadFailed means we failed to read data from a remote server.
	ProxyServerReadFailed ErrorCode = "ERR_PROXY_SERVER_READ_FAILURE"

	// Unauthenticated indicates that the client failed to communicate with a remote server
	// due to the lack of valid authentication credentials.
	Unauthenticated ErrorCode = "ERR_CLIENT_UNAUTHENTICATED"

	// ProxyServerUDPUnsupported means the remote proxy doesn't support relaying UDP traffic.
	ProxyServerUDPUnsupported ErrorCode = "ERR_PROXY_SERVER_UDP_NOT_SUPPORTED"
)

//////////
// Business logic error codes - config
//////////

const (
	// FetchConfigFailed means we failed to fetch a config from a remote location.
	FetchConfigFailed ErrorCode = "ERR_FETCH_CONFIG_FAILURE"

	// ProviderError indicates an error returned by the provider in the Dynamic Config.
	ProviderError ErrorCode = "ERR_PROVIDER"

	// InvalidConfig indicates an invalid config to connect to a remote server.
	InvalidConfig ErrorCode = "ERR_INVALID_CONFIG"
)
