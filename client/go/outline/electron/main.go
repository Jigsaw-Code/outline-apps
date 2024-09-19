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
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/tun2socks"
	_ "github.com/eycorsican/go-tun2socks/common/log/simple" // Register a simple logger.
	"github.com/eycorsican/go-tun2socks/core"
	"github.com/eycorsican/go-tun2socks/proxy/dnsfallback"
	"github.com/eycorsican/go-tun2socks/tun"
)

// tun2socks exit codes. Must be kept in sync with definitions in "go_vpn_tunnel.ts"
// TODO: replace exit code with structured JSON output
const (
	exitCodeSuccess = 0
	exitCodeFailure = 1
)

const (
	mtu        = 1500
	udpTimeout = 30 * time.Second
	persistTun = true // Linux: persist the TUN interface after the last open file descriptor is closed.
)

var logger = slog.New(slog.NewTextHandler(os.Stdout, nil))

// The result JSON containing two error strings when "--checkConnectivity".
type CheckConnectivityResult struct {
	TCPErrorJson string `json:"tcp"`
	UDPErrorJson string `json:"udp"`
}

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
		printErrorAndExit(platerrors.PlatformError{Code: platerrors.IllegalConfig, Message: "transport config missing"}, exitCodeFailure)
	}
	clientResult := outline.NewClient(*args.transportConfig)
	if clientResult.Error != nil {
		printErrorAndExit(clientResult.Error, exitCodeFailure)
	}
	client := clientResult.Client

	if *args.checkConnectivity {
		result := outline.CheckTCPAndUDPConnectivity(client)
		output := CheckConnectivityResult{
			TCPErrorJson: marshalErrorToJSON(result.TCPError),
			UDPErrorJson: marshalErrorToJSON(result.UDPError),
		}
		jsonBytes, err := json.Marshal(output)
		if err != nil {
			printErrorAndExit(err, exitCodeFailure)
		}
		fmt.Println(string(jsonBytes))
		os.Exit(exitCodeSuccess)
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

func marshalErrorToJSON(e error) string {
	pe := platerrors.ToPlatformError(e)
	if pe == nil {
		return ""
	}
	errJson, err := platerrors.MarshalJSONString(pe)
	if err != nil {
		// TypeScript's PlatformError can unmarshal a raw string
		return string(pe.Code)
	}
	return errJson
}

func printErrorAndExit(e error, exitCode int) {
	fmt.Fprintln(os.Stderr, marshalErrorToJSON(e))
	os.Exit(exitCode)
}
