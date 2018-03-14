//
//  TunnelInterface.m
//  Potatso
//
//  Created by LEI on 12/23/15.
//  Copyright © 2015 TouchingApp. All rights reserved.
//

#import "TunnelInterface.h"
#include "inet_chksum.h"
#include "ipv4/lwip/ip4.h"
#include "lwip/udp.h"
#include "lwip/ip.h"
#include "misc/socks_proto.h"
#include "system/BAddr.h"
#include "tun2socks/tun2socks.h"
@import CocoaAsyncSocket;

#define kTunnelInterfaceErrorDomain [NSString stringWithFormat:@"%@.TunnelInterface", [[NSBundle mainBundle] bundleIdentifier]]

NSString* const LOCALHOST_IP = @"127.0.0.1";
const NSTimeInterval UDP_TIMEOUT_SECS = 10;
const uint16_t DNS_PORT = 53;
const size_t DNS_HEADER_NUM_BYTES = 12;
const size_t SOCKS_HEADER_NUM_BYTES = sizeof(struct socks_udp_header);
const size_t SOCKS_ADDRESS_NUM_BYTES = sizeof(struct socks_addr_ipv4);

typedef struct {
    struct ip_hdr *ipHeader;
    struct udp_hdr *udpHeader;
    uint8_t *data;
    size_t dataNumBytes;
    BAddr srcAddress;
    BAddr destAddress;
} PacketMetadata;

@interface TunnelInterface () <GCDAsyncUdpSocketDelegate>
@property (nonatomic) NEPacketTunnelFlow *tunnelPacketFlow;
@property (nonatomic) NSMutableDictionary *localAddrByDnsReqId;
@property (nonatomic) GCDAsyncUdpSocket *udpSocket;
@property (nonatomic) int readFd;
@property (nonatomic) int writeFd;
@property (nonatomic) uint16_t socksServerPort;
@property (nonatomic) dispatch_queue_t dispatchQueue;
@end

@implementation TunnelInterface

+ (TunnelInterface *)sharedInterface {
    static dispatch_once_t onceToken;
    static TunnelInterface *interface;
    dispatch_once(&onceToken, ^{
        interface = [TunnelInterface new];
    });
    return interface;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _localAddrByDnsReqId = [NSMutableDictionary dictionaryWithCapacity:10];
        _dispatchQueue = dispatch_queue_create("udp", NULL);
    }
    return self;
}

+ (NSError *)setupWithPacketTunnelFlow:(NEPacketTunnelFlow *)packetFlow {
    if (packetFlow == nil) {
        return [NSError errorWithDomain:kTunnelInterfaceErrorDomain code:1 userInfo:@{NSLocalizedDescriptionKey: @"PacketTunnelFlow can't be nil."}];
    }
    [TunnelInterface sharedInterface].tunnelPacketFlow = packetFlow;

    NSError *error = [[TunnelInterface sharedInterface] createUdpSocket];
    if (error != nil) {
      NSLog(@"Failed to create UDP socket: %@", error);
      return error;
    }

    int fds[2];
    if (pipe(fds) < 0) {
        return [NSError errorWithDomain:kTunnelInterfaceErrorDomain code:-1 userInfo:@{NSLocalizedDescriptionKey: @"Unable to pipe."}];
    }
    [TunnelInterface sharedInterface].readFd = fds[0];
    [TunnelInterface sharedInterface].writeFd = fds[1];
    return nil;
}


+ (void)startTun2Socks: (int)socksServerPort {
    [NSThread detachNewThreadSelector:@selector(_startTun2Socks:) toTarget:[TunnelInterface sharedInterface] withObject:@(socksServerPort)];
}

+ (void)stop {
    stop_tun2socks();
}

+ (void)writePacket:(NSData *)packet {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[TunnelInterface sharedInterface].tunnelPacketFlow writePackets:@[packet] withProtocols:@[@(AF_INET)]];
    });
}

+ (void)processPackets {
    __weak typeof(self) weakSelf = self;
    [[TunnelInterface sharedInterface].tunnelPacketFlow readPacketsWithCompletionHandler:^(NSArray<NSData *> * _Nonnull packets, NSArray<NSNumber *> * _Nonnull protocols) {
        for (NSData *packet in packets) {
            uint8_t *data = (uint8_t *)packet.bytes;
            struct ip_hdr *iphdr = (struct ip_hdr *)data;
            uint8_t proto = IPH_PROTO(iphdr);
            if (proto == IP_PROTO_UDP) {
                [[TunnelInterface sharedInterface] handleUDPPacket:packet];
            }else if (proto == IP_PROTO_TCP) {
                [[TunnelInterface sharedInterface] sendPacketToTun2Socks:packet];
            }
        }
        [weakSelf processPackets];
    }];
}

+ (NSError *)onNetworkConnectivityChange {
  return [[TunnelInterface sharedInterface] createUdpSocket];
}

// Creates a UDP socket on the shared instance's dispatch queue and assigns the instance's |udpSocket| property.
- (NSError *)createUdpSocket {
  NSError *error;
  GCDAsyncUdpSocket *udpSocket = [[GCDAsyncUdpSocket alloc] initWithDelegate:[TunnelInterface sharedInterface]
                                                               delegateQueue:[TunnelInterface sharedInterface].dispatchQueue];
  [udpSocket bindToPort:0 error:&error];
  if (error) {
    return [NSError errorWithDomain:kTunnelInterfaceErrorDomain code:1
                           userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:@"UDP bind fail (%@).",
                                                                 [error localizedDescription]]}];
  }
  [udpSocket beginReceiving:&error];
  if (error) {
    return [NSError errorWithDomain:kTunnelInterfaceErrorDomain code:1
                           userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:@"UDP begin receive fail (%@).",
                                                                 [error localizedDescription]]}];
  }
  self.udpSocket = udpSocket;
  return nil;
}

- (void)_startTun2Socks: (NSNumber *)socksServerPort {
    self.socksServerPort = [socksServerPort intValue];
    NSString* socksServerAddress = [NSString stringWithFormat:@"%@:%d", LOCALHOST_IP,
                                    self.socksServerPort];
    char* socks_server = (char *)[socksServerAddress cStringUsingEncoding:kCFStringEncodingUTF8];
    char *argv[] = {
        "tun2socks",
        "--netif-ipaddr",
        "192.0.2.4",
        "--netif-netmask",
        "255.255.255.0",
        "--loglevel",
        "warning",
        "--socks-server-addr",
        socks_server,
        "--socks5-udp"
    };
    tun2socks_main(sizeof(argv)/sizeof(argv[0]), argv, self.readFd, TunnelMTU);
    close(self.readFd);
    close(self.writeFd);
    [[NSNotificationCenter defaultCenter] postNotificationName:kTun2SocksStoppedNotification object:nil];
}

- (void)sendPacketToTun2Socks: (NSData *)packet {
    uint8_t message[TunnelMTU+2];
    memcpy(message + 2, packet.bytes, packet.length);
    message[0] = packet.length / 256;
    message[1] = packet.length % 256;
    write(self.writeFd , message , packet.length + 2);
}

- (void)handleUDPPacket: (NSData *)packet {
    PacketMetadata metadata = [self parseIpPacketMetadata:packet];
    if (![self isDnsPacket:&metadata]) {
        // Send non-DNS UDP packets to tun2socks.
        [self sendPacketToTun2Socks:packet];
        return;
    }
    // Handle DNS here to get better memory usage (single socket for all DNS queries; the UDP SOCKS
    // client in tun2socks opens a socket for each query).
    uint16_t dnsRequestId = [self getDnsRequestId:metadata.data];
    [self.localAddrByDnsReqId setObject:[self encodeIpAddress:&metadata.srcAddress]
                                 forKey:[NSString stringWithFormat:@"%d", dnsRequestId]];

    struct socks_udp_header socksHeader = { .rsv = 0, .frag = 0, .atyp = SOCKS_ATYP_IPV4 };
    struct socks_addr_ipv4 address = { .addr = metadata.ipHeader->dest.addr,
                                       .port = metadata.udpHeader->dest };
    size_t packetNumBytes = SOCKS_HEADER_NUM_BYTES + SOCKS_ADDRESS_NUM_BYTES + metadata.dataNumBytes;
    uint8_t socksPacket[packetNumBytes];
    memset(socksPacket, 0, packetNumBytes);
    memcpy(socksPacket, &socksHeader, SOCKS_HEADER_NUM_BYTES);
    memcpy(socksPacket + SOCKS_HEADER_NUM_BYTES, &address, SOCKS_ADDRESS_NUM_BYTES);
    memcpy(socksPacket + SOCKS_HEADER_NUM_BYTES + SOCKS_ADDRESS_NUM_BYTES,
           metadata.data, metadata.dataNumBytes);

    NSData* packetData = [[NSData alloc] initWithBytes:socksPacket length:packetNumBytes];
    [self.udpSocket sendData:packetData toHost:LOCALHOST_IP port:self.socksServerPort
                 withTimeout:UDP_TIMEOUT_SECS
                         tag:dnsRequestId];
}

- (void)udpSocket:(GCDAsyncUdpSocket *)sock didReceiveData:(NSData *)data fromAddress:(NSData *)address withFilterContext:(id)filterContext {
    size_t dataNumBytes = data.length;
    if (dataNumBytes < SOCKS_HEADER_NUM_BYTES) {
        return NSLog(@"Received UDP packet payload of size %zu, expected > %zu. Dropping packet.",
                     dataNumBytes, SOCKS_HEADER_NUM_BYTES);
    }
    uint8_t* packetBytes = (uint8_t *)data.bytes;

    // Read the DNS request ID in order to retrieve the local destination address
    uint8_t* dnsResponse = packetBytes + SOCKS_HEADER_NUM_BYTES + SOCKS_ADDRESS_NUM_BYTES;
    uint16_t dnsRequestId = [self getDnsRequestId:dnsResponse];
    NSString* dnsRequestIdStr = [NSString stringWithFormat:@"%d", dnsRequestId];
    NSString* destAddressStr = [self.localAddrByDnsReqId objectForKey:dnsRequestIdStr];
    if (destAddressStr == nil) {
        return NSLog(@"Failed to retrieve mapping for DNS request ID %d", dnsRequestId);
    }
    [self.localAddrByDnsReqId removeObjectForKey:dnsRequestIdStr];  // Unmap entry
    BAddr destAddress = [self parseIpAddressString:destAddressStr];
    if (destAddress.type == BADDR_TYPE_NONE) {
        return NSLog(@"Failed to parse source address for DNS request ID %d", dnsRequestId);
    }
    ip_addr_p_t destIp = { destAddress.ipv4.ip };

    // Compute packet sizes
    size_t dnsResponseNumBytes = dataNumBytes - SOCKS_HEADER_NUM_BYTES;
    size_t udpPacketNumBytes = dnsResponseNumBytes + UDP_HLEN;
    size_t ipPacketNumBytes = udpPacketNumBytes + IP_HLEN;

    // Get source address from the SOCKS header
    struct socks_addr_ipv4* srcAddress = (struct socks_addr_ipv4 *)(packetBytes + SOCKS_HEADER_NUM_BYTES);
    ip_addr_p_t srcIp = { .addr = srcAddress->addr };
    uint16_t srcPort = srcAddress->port;

    // Synthesize UDP packet
    struct udp_hdr udpHeader = { .src = srcPort, .dest = destAddress.ipv4.port,
                                 .len = hton16(udpPacketNumBytes), .chksum = 0 };
    uint8_t udpPacket[udpPacketNumBytes];
    memset(udpPacket, 0, udpPacketNumBytes);
    memcpy(udpPacket, &udpHeader, UDP_HLEN);
    memcpy(udpPacket + UDP_HLEN, dnsResponse, dnsResponseNumBytes);

    // Checksum UDP packet
    struct pbuf *buffer = pbuf_alloc(PBUF_TRANSPORT, udpPacketNumBytes, PBUF_RAM);
    pbuf_take(buffer, udpPacket, udpPacketNumBytes);
    ip_addr_t src = { srcIp.addr }, dest = { destIp.addr };
    struct udp_hdr* udpHeaderPtr = (struct udp_hdr *)udpPacket;  // Update checksum in packet buffer
    udpHeaderPtr->chksum = inet_chksum_pseudo(buffer, IP_PROTO_UDP, buffer->len, &src, &dest);

    // Synthesize IP packet
    struct ip_hdr *ipHeader = generateNewIPHeader(IP_PROTO_UDP, srcIp, destIp, ipPacketNumBytes);
    uint8_t ipdata[ipPacketNumBytes];
    memset(ipdata, 0, ipPacketNumBytes);
    memcpy(ipdata, ipHeader, IP_HLEN);
    memcpy(ipdata + IP_HLEN, udpPacket, udpPacketNumBytes);

    // Send packet
    NSData *outData = [[NSData alloc] initWithBytes:ipdata length:ipPacketNumBytes];
    free(ipHeader);
    pbuf_free(buffer);
    [TunnelInterface writePacket:outData];
}

- (void)udpSocket:(GCDAsyncUdpSocket *)sock didNotSendDataWithTag:(long)tag dueToError:(NSError *)error {
    NSString* dnsRequestId = [NSString stringWithFormat:@"%u", (uint16_t)tag];
    NSLog(@"Failed to send DNS request ID %@ due to error: %@", dnsRequestId, error);
    [self.localAddrByDnsReqId removeObjectForKey:dnsRequestId];
}

- (PacketMetadata)parseIpPacketMetadata:(NSData *)packet {
    PacketMetadata metadata;
    uint8_t *data = (uint8_t *)packet.bytes;
    size_t dataNumBytes = (size_t)packet.length;

    struct ip_hdr *ipHeader = (struct ip_hdr *)data;
    uint16_t ipHeaderNumBytes = IPH_HL(ipHeader) * 4;
    data = data + ipHeaderNumBytes;
    dataNumBytes -= ipHeaderNumBytes;

    struct udp_hdr *udpHeader = (struct udp_hdr *)data;
    data += UDP_HLEN;
    dataNumBytes -= UDP_HLEN;

    metadata.srcAddress = BAddr_MakeIPv4(ipHeader->src.addr, udpHeader->src);
    metadata.destAddress = BAddr_MakeIPv4(ipHeader->dest.addr, udpHeader->dest);

    metadata.ipHeader = ipHeader;
    metadata.udpHeader = udpHeader;
    metadata.data = data;
    metadata.dataNumBytes = dataNumBytes;
    return metadata;
}

// Returns whether |metadata| is a DNS packet by matching the destination address to the VPN's DNS
// resolvers and port 53.
- (BOOL)isDnsPacket:(PacketMetadata *)metadata {
    if (metadata->dataNumBytes < DNS_HEADER_NUM_BYTES) {
        return NO;
    }
    uint16_t destPort = ntoh16(metadata->udpHeader->dest);
    return destPort == DNS_PORT;
}

// Returns the first two bytes of the DNS header, which represent the DNS request ID.
- (uint16_t) getDnsRequestId:(uint8_t *)dnsHeader {
    return *((uint16_t *)dnsHeader);
}

struct ip_hdr *generateNewIPHeader(u8_t proto, ip_addr_p_t src, ip_addr_p_t dest, uint16_t total_len) {
    struct ip_hdr *iphdr = malloc(sizeof(struct ip_hdr));
    IPH_VHL_SET(iphdr, 4, IP_HLEN / 4);
    IPH_TOS_SET(iphdr, 0);
    IPH_LEN_SET(iphdr, htons(total_len));
    IPH_ID_SET(iphdr, 0);
    IPH_OFFSET_SET(iphdr, 0);
    IPH_TTL_SET(iphdr, 64);
    IPH_PROTO_SET(iphdr, IP_PROTO_UDP);
    iphdr->src = src;
    iphdr->dest = dest;
    IPH_CHKSUM_SET(iphdr, 0);
    IPH_CHKSUM_SET(iphdr, inet_chksum(iphdr, IP_HLEN));
    return iphdr;
}

- (NSString *)encodeIpAddress:(BAddr *)address {
    return [NSString stringWithFormat:@"%d:%d", address->ipv4.ip, address->ipv4.port];
}

- (BAddr)parseIpAddressString:(NSString*)str {
    if (str == nil) {
        return BAddr_MakeNone();
    }
    NSArray* components = [str componentsSeparatedByString:@":"];
    if (components.count < 2) {
        return BAddr_MakeNone();
    }
    uint32_t ip = [components[0] intValue];
    uint16_t port = [components[1] intValue];
    return BAddr_MakeIPv4(ip, port);
}

@end
