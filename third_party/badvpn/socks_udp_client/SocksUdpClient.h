/*
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the author nor the
 *    names of its contributors may be used to endorse or promote products
 *    derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#ifndef BADVPN_SOCKS_UDP_CLIENT_SOCKSUDPCLIENT_H
#define BADVPN_SOCKS_UDP_CLIENT_SOCKSUDPCLIENT_H

#include <stdint.h>

#include <base/BPending.h>
#include <base/DebugObject.h>
#include <flow/BufferWriter.h>
#include <flow/PacketBuffer.h>
#include <flow/SinglePacketBuffer.h>
#include <flowextra/PacketPassInactivityMonitor.h>
#include <misc/debug.h>
#include <misc/socks_proto.h>
#include <socksclient/BSocksClient.h>
#include <structure/BAVL.h>
#include <system/BAddr.h>
#include <system/BDatagram.h>
#include <system/BReactor.h>
#include <system/BTime.h>

// This sets the number of packets to accept while waiting for SOCKS server to authenticate and
// connect.  A slow or far-away SOCKS server could require 300 ms to connect, and a chatty
// client (e.g. STUN) could send a packet every 20 ms, so a limit of 16 seems reasonable.
#define SOCKS_UDP_SEND_BUFFER_PACKETS 16

typedef void (*SocksUdpClient_handler_received) (void *user, BAddr local_addr, BAddr remote_addr, const uint8_t *data, int data_len);

typedef struct {
    BAddr server_addr;
    const struct BSocksClient_auth_info *auth_info;
    size_t num_auth_info;
    int num_connections;
    int max_connections;
    int udp_mtu;
    btime_t keepalive_time;
    BReactor *reactor;
    void *user;
    SocksUdpClient_handler_received handler_received;
    BAVL connections_tree;  // By local_addr
    DebugObject d_obj;
} SocksUdpClient;

struct SocksUdpClient_connection {
    SocksUdpClient *client;
    BAddr local_addr;
    BSocksClient socks;
    BufferWriter send_writer;
    PacketBuffer send_buffer;
    PacketPassInactivityMonitor send_monitor;
    PacketPassInterface send_if;
    BDatagram socket;
    PacketPassInterface recv_if;
    SinglePacketBuffer recv_buffer;
    // The first_* members represent the initial packet, which has to be stored so it can wait for
    // send_writer to become ready.
    uint8_t *first_data;
    int first_data_len;
    BAddr first_remote_addr;
    BPending first_job;
    BAVLNode connections_tree_node;
};

/**
 * Initializes the SOCKS5-UDP client object.
 * This function does not perform network access, so it will always succeed if the arguments
 * are valid.
 * 
 * Currently, this function only supports connection to a SOCKS5 server that is routable from
 * localhost (i.e. running on the local machine).  It may be possible to add support for remote
 * servers, but SOCKS5 does not support UDP if there is a NAT or firewall between the client
 * and the proxy.
 * 
 * @param o the object
 * @param udp_mtu the maximum size of packets that will be sent through the tunnel
 * @param max_connections how many local ports to track before dropping packets
 * @param keepalive_time how long to track an idle local port before forgetting it
 * @param server_addr SOCKS5 server address.  MUST BE ON LOCALHOST.
 * @param reactor reactor we live in
 * @param user value passed to handler
 * @param handler_received handler for incoming UDP packets
 */
void SocksUdpClient_Init (SocksUdpClient *o, int udp_mtu, int max_connections, btime_t keepalive_time,
                          BAddr server_addr, const struct BSocksClient_auth_info *auth_info, size_t num_auth_info,
                          BReactor *reactor, void *user, SocksUdpClient_handler_received handler_received);
void SocksUdpClient_Free (SocksUdpClient *o);

/**
 * Submit a packet to be sent through the proxy.
 *
 * This will reuse an existing connection for packets from local_addr, or create one if
 * there is none.  If the number of live connections exceeds max_connections, or if the number of
 * buffered packets from this port exceeds a limit, packets will be dropped silently.
 * 
 * @param o the object
 * @param local_addr the UDP packet's source address, and the expected destination for replies
 * @param remote_addr the destination of the packet after it exits the proxy
 * @param data the packet contents.  Caller retains ownership.
 */
void SocksUdpClient_SubmitPacket (SocksUdpClient *o, BAddr local_addr, BAddr remote_addr, const uint8_t *data, int data_len);

#endif
