// Copyright 2023 Jigsaw Operations LLC
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

package outline

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"sync/atomic"
	"time"

	"localhost/Intra/Android/app/src/go/doh"
	"localhost/Intra/Android/app/src/go/intra/protect"

	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

type intraPacketProxy struct {
	fakeDNSAddr netip.AddrPort
	dns         atomic.Pointer[doh.Resolver]
	proxy       network.PacketProxy
	listener    UDPListener
	ctx         context.Context
}

var _ network.PacketProxy = (*intraPacketProxy)(nil)

func newIntraPacketProxy(
	ctx context.Context, fakeDNS netip.AddrPort, dns doh.Resolver, protector protect.Protector, listener UDPListener,
) (*intraPacketProxy, error) {
	if dns == nil {
		return nil, errors.New("dns is required")
	}

	pl := &transport.UDPPacketListener{
		ListenConfig: *protect.MakeListenConfig(protector),
	}

	// RFC 4787 REQ-5 requires a timeout no shorter than 5 minutes.
	pp, err := network.NewPacketProxyFromPacketListener(pl, network.WithPacketListenerWriteIdleTimeout(5*time.Minute))
	if err != nil {
		return nil, fmt.Errorf("failed to create packet proxy from listener: %w", err)
	}

	dohpp := &intraPacketProxy{
		fakeDNSAddr: fakeDNS,
		proxy:       pp,
		listener:    listener,
		ctx:         ctx,
	}
	dohpp.dns.Store(&dns)

	return dohpp, nil
}

// NewSession implements PacketProxy.NewSession.
func (p *intraPacketProxy) NewSession(resp network.PacketResponseReceiver) (network.PacketRequestSender, error) {
	dohResp := &dohPacketRespReceiver{
		PacketResponseReceiver: resp,
		stats:                  makeTracker(),
		listener:               p.listener,
	}
	req, err := p.proxy.NewSession(dohResp)
	if err != nil {
		return nil, fmt.Errorf("failed to create new session: %w", err)
	}

	return &dohPacketReqSender{
		PacketRequestSender: req,
		proxy:               p,
		response:            dohResp,
		stats:               dohResp.stats,
	}, nil
}

func (p *intraPacketProxy) SetDNS(dns doh.Resolver) error {
	if dns == nil {
		return errors.New("dns is required")
	}
	p.dns.Store(&dns)
	return nil
}

// DoH PacketRequestSender wrapper
type dohPacketReqSender struct {
	network.PacketRequestSender

	response *dohPacketRespReceiver
	proxy    *intraPacketProxy
	stats    *tracker
}

// DoH PacketResponseReceiver wrapper
type dohPacketRespReceiver struct {
	network.PacketResponseReceiver

	stats    *tracker
	listener UDPListener
}

var _ network.PacketRequestSender = (*dohPacketReqSender)(nil)
var _ network.PacketResponseReceiver = (*dohPacketRespReceiver)(nil)

// WriteTo implements PacketRequestSender.WriteTo. It will query the DoH server if the packet a DNS packet.
func (req *dohPacketReqSender) WriteTo(p []byte, destination netip.AddrPort) (int, error) {
	if isEquivalentAddrPort(destination, req.proxy.fakeDNSAddr) {
		defer func() {
			// conn was only used for this DNS query, so it's unlikely to be used again
			if req.stats.download.Load() == 0 && req.stats.upload.Load() == 0 {
				req.Close()
			}
		}()

		resp, err := (*req.proxy.dns.Load()).Query(req.proxy.ctx, p)
		if err != nil {
			return 0, fmt.Errorf("DoH request error: %w", err)
		}
		if len(resp) == 0 {
			return 0, errors.New("empty DoH response")
		}

		return req.response.writeFrom(resp, net.UDPAddrFromAddrPort(req.proxy.fakeDNSAddr), false)
	}

	req.stats.upload.Add(int64(len(p)))
	return req.PacketRequestSender.WriteTo(p, destination)
}

// Close terminates the UDP session, and reports session stats to the listener.
func (resp *dohPacketRespReceiver) Close() error {
	if resp.listener != nil {
		resp.listener.OnUDPSocketClosed(&UDPSocketSummary{
			Duration:      int32(time.Since(resp.stats.start)),
			UploadBytes:   resp.stats.upload.Load(),
			DownloadBytes: resp.stats.download.Load(),
		})
	}
	return resp.PacketResponseReceiver.Close()
}

// WriteFrom implements PacketResponseReceiver.WriteFrom.
func (resp *dohPacketRespReceiver) WriteFrom(p []byte, source net.Addr) (int, error) {
	return resp.writeFrom(p, source, true)
}

// writeFrom writes to the underlying PacketResponseReceiver.
// It will also add len(p) to downloadBytes if doStat is true.
func (resp *dohPacketRespReceiver) writeFrom(p []byte, source net.Addr, doStat bool) (int, error) {
	if doStat {
		resp.stats.download.Add(int64(len(p)))
	}
	return resp.PacketResponseReceiver.WriteFrom(p, source)
}