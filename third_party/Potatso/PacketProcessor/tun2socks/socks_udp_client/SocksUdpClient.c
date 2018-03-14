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

#include <stdlib.h>
#include <string.h>

#include "misc/balloc.h"
#include "misc/offset.h"
#include "misc/byteorder.h"
#include "misc/compare.h"
#include "base/BLog.h"

#include "SocksUdpClient.h"

#include "generated/blog_channel_SocksUdpClient.h"

static int addr_comparator (void *unused, BAddr *v1, BAddr *v2);
static struct SocksUdpClient_connection * find_connection_by_addr (SocksUdpClient *o, BAddr addr);
static void init_localhost4(uint32_t *ip4);
static void init_localhost6(uint8_t ip6[static 16]);
static void socks_state_handler(struct SocksUdpClient_connection *con, int event);
static void datagram_state_handler(struct SocksUdpClient_connection *con, int event);
static void send_monitor_handler (struct SocksUdpClient_connection *con);
static void recv_if_handler_send (struct SocksUdpClient_connection *con, uint8_t *data, int data_len);
static struct SocksUdpClient_connection * connection_init(SocksUdpClient *o, BAddr local_addr,
                                                          BAddr first_remote_addr,
                                                          const uint8_t *first_data, int first_data_len);
static void connection_free (struct SocksUdpClient_connection *con);
static void connection_send (struct SocksUdpClient_connection *con, BAddr remote_addr, const uint8_t *data, int data_len);
static void first_job_handler(struct SocksUdpClient_connection *con);
static int compute_mtu(int udp_mtu);

static int addr_comparator (void *unused, BAddr *v1, BAddr *v2)
{
    return BAddr_CompareOrder(v1, v2);
}

static struct SocksUdpClient_connection * find_connection_by_addr (SocksUdpClient *o, BAddr addr)
{
    BAVLNode *tree_node = BAVL_LookupExact(&o->connections_tree, &addr);
    if (!tree_node) {
        return NULL;
    }

    return UPPER_OBJECT(tree_node, struct SocksUdpClient_connection, connections_tree_node);
}

static void init_localhost4(uint32_t *ip4)
{
    *ip4 = 1<<24 | 127;
}

static void init_localhost6(uint8_t ip6[static 16])
{
    memset(ip6, 0, 16);
    ip6[15] = 1;
}

static void socks_state_handler(struct SocksUdpClient_connection *con, int event)
{
    switch (event) {
        case BSOCKSCLIENT_EVENT_UP: {
            BIPAddr localhost;
            localhost.type = con->client->server_addr.type;
            if (localhost.type == BADDR_TYPE_IPV4) {
                init_localhost4(&localhost.ipv4);
            } else if (localhost.type == BADDR_TYPE_IPV6) {
                init_localhost6(localhost.ipv6);
            } else {
                BLog(BLOG_ERROR, "Bad address type");
            }
            // This will unblock the queue of pending packets.
            BDatagram_SetSendAddrs(&con->socket, con->socks.bind_addr, localhost);
        } break;
        case BSOCKSCLIENT_EVENT_ERROR: {
            BLog(BLOG_ERROR, "Socks error event");
        } // Fallthrough
        case BSOCKSCLIENT_EVENT_ERROR_CLOSED: {
            connection_free(con);
        } break;
        default: {
            BLog(BLOG_ERROR, "Unknown event");
        }
    }
}

static void datagram_state_handler(struct SocksUdpClient_connection *con, int event)
{
    if (event == BDATAGRAM_EVENT_ERROR) {
        char local_buffer[BADDR_MAX_PRINT_LEN];
        BAddr_Print(&con->local_addr, local_buffer);
        BLog(BLOG_ERROR, "Failing connection for %s due to a datagram send error", local_buffer);
        connection_free(con);
    }
}

static void send_monitor_handler (struct SocksUdpClient_connection *con)
{
    // The connection has passed its idle timeout.  Remove it.
    connection_free(con);
}

static void recv_if_handler_send(struct SocksUdpClient_connection *con, uint8_t *data, int data_len)
{
    SocksUdpClient *o = con->client;
    DebugObject_Access(&con->client->d_obj);
    ASSERT(data_len >= 0)
    ASSERT(data_len <= compute_mtu(o->udp_mtu))

    // accept packet
    PacketPassInterface_Done(&con->recv_if);

    // check header
    if (data_len < sizeof(struct socks_udp_header)) {
        BLog(BLOG_ERROR, "missing header");
        return;
    }
    struct socks_udp_header *header = (struct socks_udp_header *)data;
    uint8_t *addr_data = data + sizeof(struct socks_udp_header);

    // parse address
    BAddr remote_addr;
    size_t addr_size;
    switch (header->atyp) {
        case SOCKS_ATYP_IPV4: {
            remote_addr.type = BADDR_TYPE_IPV4;
            struct socks_addr_ipv4 *addr_ipv4 = (struct socks_addr_ipv4 *)addr_data;
            remote_addr.ipv4.ip = addr_ipv4->addr;
            remote_addr.ipv4.port = addr_ipv4->port;
            addr_size = sizeof(*addr_ipv4);
        } break;
        case SOCKS_ATYP_IPV6: {
            remote_addr.type = BADDR_TYPE_IPV6;
            struct socks_addr_ipv6 *addr_ipv6 = (struct socks_addr_ipv6 *)addr_data;
            memcpy(remote_addr.ipv6.ip, addr_ipv6->addr, sizeof(remote_addr.ipv6.ip));
            remote_addr.ipv6.port = addr_ipv6->port;
            addr_size = sizeof(*addr_ipv6);
        } break;
        default: {
            BLog(BLOG_ERROR, "Bad address type");
            return;
        }
    }

    uint8_t *body_data = addr_data + addr_size;
    size_t body_len = data_len - (body_data - data);

    // check remaining data
    if (body_len > o->udp_mtu) {
        BLog(BLOG_ERROR, "too much data");
        return;
    }

    // pass packet to user
    SocksUdpClient *client = con->client;
    client->handler_received(client->user, con->local_addr, remote_addr, body_data, body_len);
}

static struct SocksUdpClient_connection *connection_init(SocksUdpClient *o, BAddr local_addr,
                                                         BAddr first_remote_addr,
                                                         const uint8_t *first_data, int first_data_len)
{
    DebugObject_Access(&o->d_obj);
    ASSERT(o->num_connections <= o->max_connections)
    ASSERT(!find_connection_by_addr(o, local_addr))

    char buffer[BADDR_MAX_PRINT_LEN];
    BAddr_Print(&local_addr, buffer);
    BLog(BLOG_DEBUG, "Creating new connection for %s", buffer);

    // allocate structure
    struct SocksUdpClient_connection *con = (struct SocksUdpClient_connection *)malloc(sizeof(*con));
    if (!con) {
        BLog(BLOG_ERROR, "malloc failed");
        goto fail0;
    }

    // init arguments
    con->client = o;
    con->local_addr = local_addr;
    con->first_data = BAlloc(first_data_len);
    con->first_data_len = first_data_len;
    con->first_remote_addr = first_remote_addr;
    memcpy(con->first_data, first_data, first_data_len);

    BPendingGroup *pg = BReactor_PendingGroup(o->reactor);

    // init first job, to send the first packet asynchronously.  This has to happen asynchronously
    // because con->send_writer (a BufferWriter) cannot accept writes until after it is linked with
    // its PacketBuffer (con->send_buffer), which happens asynchronously.
    BPending_Init(&con->first_job, pg, (BPending_handler)first_job_handler, con);
    // Add the first job to the pending set.  BPending acts as a LIFO stack, and first_job_handler
    // needs to run after async actions that occur in PacketBuffer_Init, so we need to put first_job
    // on the stack first.
    BPending_Set(&con->first_job);

    // Create a datagram socket
    if (!BDatagram_Init(&con->socket, con->local_addr.type, o->reactor, con,
                        (BDatagram_handler)datagram_state_handler)) {
        BLog(BLOG_ERROR, "Failed to create a UDP socket");
        goto fail1;
    }

    // Bind to 127.0.0.1:0 (or [::1]:0).  Port 0 signals the kernel to choose an open port.
    BAddr socket_addr;
    socket_addr.type = local_addr.type;
    if (local_addr.type == BADDR_TYPE_IPV4) {
        init_localhost4(&socket_addr.ipv4.ip);
        socket_addr.ipv4.port = 0;
    } else if (local_addr.type == BADDR_TYPE_IPV6) {
        init_localhost6(socket_addr.ipv6.ip);
        socket_addr.ipv6.port = 0;
    } else {
        BLog(BLOG_ERROR, "Unknown local address type");
        goto fail2;
    }
    if (!BDatagram_Bind(&con->socket, socket_addr)) {
        BLog(BLOG_ERROR, "Bind to localhost failed");
        goto fail2;
    }

    // Bind succeeded, so the kernel has found an open port.
    // Update socket_addr to the actual port that was bound.
    uint16_t port;
    if (!BDatagram_GetLocalPort(&con->socket, &port)) {
        BLog(BLOG_ERROR, "Failed to get bound port");
        goto fail2;
    }
    if (socket_addr.type == BADDR_TYPE_IPV4) {
        socket_addr.ipv4.port = port;
    } else {
        socket_addr.ipv6.port = port;
    }

    // Initiate connection to socks server
    if (!BSocksClient_Init(&con->socks, o->server_addr, o->auth_info, o->num_auth_info, socket_addr,
                           true, (BSocksClient_handler)socks_state_handler, con, o->reactor)) {
        BLog(BLOG_ERROR, "Failed to initialize SOCKS client");
        goto fail2;
    }

    // Ensure that the UDP handling pipeline can handle queries big enough to include
    // all data plus the SOCKS-UDP header.
    int socks_mtu = compute_mtu(o->udp_mtu);

    // Send pipeline: send_writer -> send_buffer -> send_monitor -> send_if -> socket.
    BDatagram_SendAsync_Init(&con->socket, socks_mtu);
    PacketPassInterface *send_if = BDatagram_SendAsync_GetIf(&con->socket);
    PacketPassInactivityMonitor_Init(&con->send_monitor, send_if, o->reactor, o->keepalive_time,
                                     (PacketPassInactivityMonitor_handler)send_monitor_handler, con);
    BufferWriter_Init(&con->send_writer, compute_mtu(o->udp_mtu), pg);
    if (!PacketBuffer_Init(&con->send_buffer, BufferWriter_GetOutput(&con->send_writer),
                           PacketPassInactivityMonitor_GetInput(&con->send_monitor),
                           SOCKS_UDP_SEND_BUFFER_PACKETS, pg)) {
        BLog(BLOG_ERROR, "Send buffer init failed");
        goto fail3;
    }

    // Receive pipeline: socket -> recv_buffer -> recv_if
    BDatagram_RecvAsync_Init(&con->socket, socks_mtu);
    PacketPassInterface_Init(&con->recv_if, socks_mtu,
                            (PacketPassInterface_handler_send)recv_if_handler_send, con, pg);
    if (!SinglePacketBuffer_Init(&con->recv_buffer, BDatagram_RecvAsync_GetIf(&con->socket),
                                &con->recv_if, pg)) {
        BLog(BLOG_ERROR, "Receive buffer init failed");
        goto fail4;
    }

    // insert to connections tree
    ASSERT_EXECUTE(BAVL_Insert(&o->connections_tree, &con->connections_tree_node, NULL))

    o->num_connections++;

    return con;

fail4:
    PacketPassInterface_Free(&con->recv_if);
    BDatagram_RecvAsync_Free(&con->socket);
    PacketBuffer_Free(&con->send_buffer);
fail3:
    BufferWriter_Free(&con->send_writer);
    PacketPassInactivityMonitor_Free(&con->send_monitor);
    BDatagram_SendAsync_Free(&con->socket);
fail2:
    BDatagram_Free(&con->socket);
fail1:
    BPending_Free(&con->first_job);
    BFree(con->first_data);
    free(con);
fail0:
    return NULL;
}

static void connection_free (struct SocksUdpClient_connection *con)
{
    SocksUdpClient *o = con->client;
    DebugObject_Access(&o->d_obj);

    // decrement number of connections
    o->num_connections--;

    // remove from connections tree
    BAVL_Remove(&o->connections_tree, &con->connections_tree_node);

    // Free UDP send pipeline components
    PacketBuffer_Free(&con->send_buffer);
    BufferWriter_Free(&con->send_writer);
    PacketPassInactivityMonitor_Free(&con->send_monitor);
    BDatagram_SendAsync_Free(&con->socket);

    // Free UDP receive pipeline components
    SinglePacketBuffer_Free(&con->recv_buffer);
    PacketPassInterface_Free(&con->recv_if);
    BDatagram_RecvAsync_Free(&con->socket);

    // Free UDP socket
    BDatagram_Free(&con->socket);

    // Free SOCKS client
    BSocksClient_Free(&con->socks);

    BPending_Free(&con->first_job);
    if (con->first_data) {
      BFree(con->first_data);
    }
    // free structure
    free(con);
}

static void connection_send (struct SocksUdpClient_connection *con, BAddr remote_addr,
                             const uint8_t *data, int data_len)
{
    SocksUdpClient *o = con->client;
    DebugObject_Access(&o->d_obj);
    ASSERT(data_len >= 0)
    ASSERT(data_len <= o->udp_mtu)

    // Check if we're sending to an IPv4 or IPv6 destination.
    int atyp;
    size_t address_size;
    // write address
    switch (remote_addr.type) {
        case BADDR_TYPE_IPV4: {
            atyp = SOCKS_ATYP_IPV4;
            address_size = sizeof(struct socks_addr_ipv4);
        } break;
        case BADDR_TYPE_IPV6: {
            atyp = SOCKS_ATYP_IPV6;
            address_size = sizeof(struct socks_addr_ipv6);
        } break;
        default: {
          BLog(BLOG_ERROR, "bad address type");
          return;
        }
    }

    // Wrap the payload in a UDP SOCKS header.
    size_t socks_data_len = sizeof(struct socks_udp_header) + address_size + data_len;
    if (socks_data_len > compute_mtu(o->udp_mtu)) {
        BLog(BLOG_ERROR, "Packet is too big: %d > %d", socks_data_len, compute_mtu(o->udp_mtu));
        return;
    }
    uint8_t *socks_data;
    if (!BufferWriter_StartPacket(&con->send_writer, &socks_data)) {
        BLog(BLOG_ERROR, "Send buffer is full");
        return;
    }
    // Write header
    struct socks_udp_header *header = (struct socks_udp_header *)socks_data;
    header->rsv = 0;
    header->frag = 0;
    header->atyp = atyp;
    uint8_t *addr_data = socks_data + sizeof(struct socks_udp_header);
    switch (atyp) {
        case SOCKS_ATYP_IPV4: {
            struct socks_addr_ipv4 *addr_ipv4 = (struct socks_addr_ipv4 *)addr_data;
            addr_ipv4->addr = remote_addr.ipv4.ip;
            addr_ipv4->port = remote_addr.ipv4.port;
        } break;
        case SOCKS_ATYP_IPV6: {
            struct socks_addr_ipv6 *addr_ipv6 = (struct socks_addr_ipv6 *)addr_data;
            memcpy(addr_ipv6->addr, remote_addr.ipv6.ip, sizeof(addr_ipv6->addr));
            addr_ipv6->port = remote_addr.ipv6.port;
        } break;
    }
    // write packet to buffer
    memcpy(addr_data + address_size, data, data_len);
    BufferWriter_EndPacket(&con->send_writer, socks_data_len);
}

static void first_job_handler(struct SocksUdpClient_connection *con)
{
    connection_send(con, con->first_remote_addr, con->first_data, con->first_data_len);
    BFree(con->first_data);
    con->first_data = NULL;
    con->first_data_len = 0;
}

static int compute_mtu(int udp_mtu)
{
    return udp_mtu + sizeof(struct socks_udp_header) + sizeof(struct socks_addr_ipv6);
}

void SocksUdpClient_Init (SocksUdpClient *o, int udp_mtu, int max_connections, btime_t keepalive_time,
                          BAddr server_addr, const struct BSocksClient_auth_info *auth_info, size_t num_auth_info,
                          BReactor *reactor, void *user,
                          SocksUdpClient_handler_received handler_received)
{
    ASSERT(udp_mtu >= 0)
    ASSERT(compute_mtu(udp_mtu) >= 0)
    ASSERT(max_connections > 0)

    // init arguments
    o->server_addr = server_addr;
    o->auth_info = auth_info;
    o->num_auth_info = num_auth_info;
    o->udp_mtu = udp_mtu;
    o->num_connections = 0;
    o->max_connections = max_connections;
    o->keepalive_time = keepalive_time;
    o->reactor = reactor;
    o->user = user;
    o->handler_received = handler_received;

    // limit max connections to number of conid's
    if (o->max_connections > UINT16_MAX + 1) {
        o->max_connections = UINT16_MAX + 1;
    }

    // init connections tree
    BAVL_Init(&o->connections_tree, OFFSET_DIFF(struct SocksUdpClient_connection, local_addr, connections_tree_node), (BAVL_comparator)addr_comparator, NULL);

    DebugObject_Init(&o->d_obj);
}

void SocksUdpClient_Free (SocksUdpClient *o)
{
    DebugObject_Free(&o->d_obj);

    // free connections
    while (!BAVL_IsEmpty(&o->connections_tree)) {
        struct SocksUdpClient_connection *con = UPPER_OBJECT(BAVL_GetFirst(&o->connections_tree), struct SocksUdpClient_connection, connections_tree_node);
        connection_free(con);
    }
}

void SocksUdpClient_SubmitPacket (SocksUdpClient *o, BAddr local_addr, BAddr remote_addr, const uint8_t *data, int data_len)
{
    DebugObject_Access(&o->d_obj);
    ASSERT(local_addr.type == BADDR_TYPE_IPV4 || local_addr.type == BADDR_TYPE_IPV6)
    ASSERT(remote_addr.type == BADDR_TYPE_IPV4 || remote_addr.type == BADDR_TYPE_IPV6)
    ASSERT(data_len >= 0)

    // lookup connection
    struct SocksUdpClient_connection *con = find_connection_by_addr(o, local_addr);
    if (!con) {
        if (o->num_connections == o->max_connections) {
            // Drop the packet.
            BLog(BLOG_ERROR, "Dropping UDP packet, reached max number of connections.");
            return;
        }
        // create new connection and enqueue the packet
        connection_init(o, local_addr, remote_addr, data, data_len);
    } else {
      // send packet
      connection_send(con, remote_addr, data, data_len);
    }
}
