// Copyright 2019 The Outline Authors
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

package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/neterrors"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/shadowsocks"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/tun2socks"
	_ "github.com/eycorsican/go-tun2socks/common/log/simple" // Register a simple logger.
	"github.com/eycorsican/go-tun2socks/core"
	"github.com/eycorsican/go-tun2socks/proxy/dnsfallback"
	"github.com/eycorsican/go-tun2socks/tun"
)

// tun2socks exit codes. Must be kept in sync with definitions in "go_vpn_tunnel.ts"
// TODO: replace exit code with structured JSON output
const (
	exitCodeSuccess           = 0
	exitCodeFailure           = 1
	exitCodeNoUDPConnectivity = 4
)

const (
	mtu        = 1500
	udpTimeout = 30 * time.Second
	persistTun = true // Linux: persist the TUN interface after the last open file descriptor is closed.
)

var logger = slog.New(slog.NewTextHandler(os.Stdout, nil))

var args struct {
	tunAddr *string
	tunGw   *string
	tunMask *string
	tunName *string
	tunDNS  *string

	transportConfig *string

	logLevel          *string
	checkConnectivity *bool
	dnsFallback       *bool
	version           *bool
}
var version string // Populated at build time through `-X main.version=...`

// This app sets up a local network stack to handle requests from a tun device.
//
// If the app runs successfully, it exits with code 0.
// If there's an error, it exits with code 1 and prints a detailed error message in JSON format to stderr.
//
// The app also prints logs, but these are not meant to be read by the parent process.
func main() {
	args.tunAddr = flag.String("tunAddr", "10.0.85.2", "TUN interface IP address")
	args.tunGw = flag.String("tunGw", "10.0.85.1", "TUN interface gateway")
	args.tunMask = flag.String("tunMask", "255.255.255.0", "TUN interface network mask; prefixlen for IPv6")
	args.tunDNS = flag.String("tunDNS", "1.1.1.1,9.9.9.9,208.67.222.222", "Comma-separated list of DNS resolvers for the TUN interface (Windows only)")
	args.tunName = flag.String("tunName", "tun0", "TUN interface name")
	args.transportConfig = flag.String("transport", "", "A JSON object containing the transport config, UTF8-encoded")
	args.logLevel = flag.String("logLevel", "info", "Logging level: debug|info|warn|error|none")
	args.dnsFallback = flag.Bool("dnsFallback", false, "Enable DNS fallback over TCP (overrides the UDP handler).")
	args.checkConnectivity = flag.Bool("checkConnectivity", false, "Check the proxy TCP and UDP connectivity and exit.")
	args.version = flag.Bool("version", false, "Print the version and exit.")

	flag.Parse()

	if *args.version {
		fmt.Println(version)
		os.Exit(exitCodeSuccess)
	}

	setLogLevel(*args.logLevel)

	if len(*args.transportConfig) == 0 {
		printErrorAndExit(errors.New("transport config missing"), 1)
	}
	client, err := shadowsocks.NewClientFromJSON(*args.transportConfig)
	if err != nil {
		printErrorAndExit(err, exitCodeFailure)
	}

	if *args.checkConnectivity {
		checkConnectivityAndExit(client)
	}

	// Open TUN device
	dnsResolvers := strings.Split(*args.tunDNS, ",")
	tunDevice, err := tun.OpenTunDevice(*args.tunName, *args.tunAddr, *args.tunGw, *args.tunMask, dnsResolvers, persistTun)
	if err != nil {
		printErrorAndExit(platerrors.PlatformError{
			Code:    platerrors.SetupSystemVPNFailed,
			Message: "failed to open TUN device",
			Cause:   platerrors.ToPlatformError(err),
		}, exitCodeFailure)
	}
	// Output packets to TUN device
	core.RegisterOutputFn(tunDevice.Write)

	// Register TCP and UDP connection handlers
	core.RegisterTCPConnHandler(tun2socks.NewTCPHandler(client))
	if *args.dnsFallback {
		// UDP connectivity not supported, fall back to DNS over TCP.
		logger.Debug("Registering DNS fallback UDP handler")
		core.RegisterUDPConnHandler(dnsfallback.NewUDPHandler())
	} else {
		core.RegisterUDPConnHandler(tun2socks.NewUDPHandler(client, udpTimeout))
	}

	// Configure LWIP stack to receive input data from the TUN device
	lwipWriter := core.NewLWIPStack()
	go func() {
		_, err := io.CopyBuffer(lwipWriter, tunDevice, make([]byte, mtu))
		if err != nil {
			printErrorAndExit(platerrors.PlatformError{
				Code:    platerrors.DataTransmissionFailed,
				Message: "failed to write data to network stack",
				Cause:   platerrors.ToPlatformError(err),
			}, exitCodeFailure)
		}
	}()

	// This message is used in TypeScript to determine whether tun2socks has been started successfully
	logger.Info("tun2socks running...")

	osSignals := make(chan os.Signal, 1)
	signal.Notify(osSignals, os.Interrupt, syscall.SIGTERM, syscall.SIGHUP)
	sig := <-osSignals
	logger.Debug("Received signal", "signal", sig)
}

func setLogLevel(level string) {
	slvl := slog.LevelInfo
	switch strings.ToLower(level) {
	case "debug":
		slvl = slog.LevelDebug
	case "info":
		slvl = slog.LevelInfo
	case "warn":
		slvl = slog.LevelWarn
	case "error":
		slvl = slog.LevelError
	case "none":
		logger = slog.New(slog.NewTextHandler(io.Discard, &slog.HandlerOptions{Level: slog.LevelError}))
		return
	}
	logger = slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slvl}))
}

func printErrorAndExit(e error, exitCode int) {
	pe := platerrors.ToPlatformError(e)
	errJson, err := platerrors.MarshalJSONString(*pe)
	if err != nil {
		// TypeScript's PlatformError can unmarshal a raw string
		errJson = string(pe.Code)
	}
	fmt.Fprintln(os.Stderr, errJson)
	os.Exit(exitCode)
}

// checkConnectivity checks whether the remote Shadowsocks server supports TCP or UDP,
// and converts the neterrors to a PlatformError.
// TODO: remove this function once we migrated CheckConnectivity to return a PlatformError.
func checkConnectivityAndExit(c *shadowsocks.Client) {
	connErrCode, err := shadowsocks.CheckConnectivity(c)
	if err != nil {
		printErrorAndExit(platerrors.PlatformError{
			Code:    platerrors.InternalError,
			Message: "failed to check connectivity",
			Cause:   platerrors.ToPlatformError(err),
		}, exitCodeFailure)
	}
	switch connErrCode {
	case neterrors.NoError.Number():
		os.Exit(exitCodeSuccess)
	case neterrors.AuthenticationFailure.Number():
		printErrorAndExit(platerrors.PlatformError{
			Code:    platerrors.Unauthenticated,
			Message: "authentication failed",
		}, exitCodeFailure)
	case neterrors.Unreachable.Number():
		printErrorAndExit(platerrors.PlatformError{
			Code:    platerrors.ProxyServerUnreachable,
			Message: "cannot connect to Shadowsocks server",
		}, exitCodeFailure)
	case neterrors.UDPConnectivity.Number():
		printErrorAndExit(platerrors.PlatformError{
			Code:    platerrors.ProxyServerUDPUnsupported,
			Message: "Shadowsocks server does not support UDP",
		}, exitCodeNoUDPConnectivity)
	}
	printErrorAndExit(platerrors.PlatformError{
		Code:    platerrors.InternalError,
		Message: "failed to check connectivity",
	}, exitCodeFailure)
}
