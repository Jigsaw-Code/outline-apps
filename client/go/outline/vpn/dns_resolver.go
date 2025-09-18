// Copyright 2025 The Outline Authors
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

package vpn

import (
	"context"
	"errors"
	"log/slog"
	"sync/atomic"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/connectivity"
	"github.com/Jigsaw-Code/outline-sdk/dns"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"golang.org/x/net/dns/dnsmessage"
)

type DefaultResolver struct {
	useUDP   atomic.Bool
	tcp, udp dns.Resolver
	pl       transport.PacketListener
}

var _ dns.Resolver = (*DefaultResolver)(nil)

func NewDefaultResolver(sd transport.StreamDialer, pl transport.PacketListener, resolverAddr string) (*DefaultResolver, error) {
	if sd == nil {
		return nil, errors.New("StreamDialer must be provided")
	}
	if pl == nil {
		return nil, errors.New("PacketListener must be provided")
	}
	r := &DefaultResolver{
		tcp: dns.NewTCPResolver(sd, resolverAddr),
		udp: dns.NewUDPResolver(transport.PacketListenerDialer{Listener: pl}, resolverAddr),
		pl:  pl,
	}
	r.OnNotifyNetworkChanged()
	return r, nil
}

func (r *DefaultResolver) Query(ctx context.Context, q dnsmessage.Question) (*dnsmessage.Message, error) {
	if r.useUDP.Load() {
		return r.udp.Query(ctx, q)
	}
	return r.tcp.Query(ctx, q)
}

func (r *DefaultResolver) OnNotifyNetworkChanged() {
	go func() {
		slog.Debug("checking UDP connectivity...")
		if err := connectivity.CheckUDPConnectivity(r.pl); err == nil {
			slog.Info("remote device UDP is healthy")
			r.useUDP.Store(true)
		} else {
			slog.Warn("remote device UDP is not healthy", "err", err)
			r.useUDP.Store(false)
		}
	}()
}
