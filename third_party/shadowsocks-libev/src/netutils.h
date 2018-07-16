/*
 * netutils.h - Network utilities
 *
 * Copyright (C) 2013 - 2018, Max Lv <max.c.lv@gmail.com>
 *
 * This file is part of the shadowsocks-libev.
 *
 * shadowsocks-libev is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * shadowsocks-libev is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with shadowsocks-libev; see the file COPYING. If not, see
 * <http://www.gnu.org/licenses/>.
 */

#ifndef _NETUTILS_H
#define _NETUTILS_H

#ifdef __MINGW32__
#include "winsock.h"
#else
#include <sys/socket.h>
#endif

#ifdef HAVE_LINUX_TCP_H
#include <linux/tcp.h>
#elif defined(HAVE_NETINET_TCP_H)
#include <netinet/tcp.h>
#endif

#ifdef HAVE_NETDB_H
#include <netdb.h>
#endif

/* Hard coded defines for TCP fast open on Android */
#ifdef __ANDROID__
#ifndef TCP_FASTOPEN
#define TCP_FASTOPEN   23
#endif
#ifndef MSG_FASTOPEN
#define MSG_FASTOPEN   0x20000000
#endif
#ifdef TCP_FASTOPEN_CONNECT
#undef TCP_FASTOPEN_CONNECT
#endif
#endif

/* MPTCP_ENABLED setsockopt values for kernel 4 & 3, best behaviour to be independant of kernel version is to test from newest to the latest values */
#ifndef MPTCP_ENABLED
static const char mptcp_enabled_values[] = { 42, 26, 0 };
#else
static const char mptcp_enabled_values[] = { MPTCP_ENABLED, 0 };
#endif

#ifndef UPDATE_INTERVAL
#define UPDATE_INTERVAL 5
#endif

/** byte size of ip4 address */
#define INET_SIZE 4
/** byte size of ip6 address */
#define INET6_SIZE 16

size_t get_sockaddr_len(struct sockaddr *addr);
ssize_t get_sockaddr(char *host, char *port,
                     struct sockaddr_storage *storage, int block,
                     int ipv6first);
int set_reuseport(int socket);

#ifdef SET_INTERFACE
int setinterface(int socket_fd, const char *interface_name);
#endif

int bind_to_address(int socket_fd, const char *address);

/**
 * Compare two sockaddrs. Imposes an ordering on the addresses.
 * Compares address and port.
 * @param addr1: address 1.
 * @param addr2: address 2.
 * @param len: lengths of addr.
 * @return: 0 if addr1 == addr2. -1 if addr1 is smaller, +1 if larger.
 */
int sockaddr_cmp(struct sockaddr_storage *addr1,
                 struct sockaddr_storage *addr2, socklen_t len);

/**
 * Compare two sockaddrs. Compares address, not the port.
 * @param addr1: address 1.
 * @param addr2: address 2.
 * @param len: lengths of addr.
 * @return: 0 if addr1 == addr2. -1 if addr1 is smaller, +1 if larger.
 */
int sockaddr_cmp_addr(struct sockaddr_storage *addr1,
                      struct sockaddr_storage *addr2, socklen_t len);

int validate_hostname(const char *hostname, const int hostname_len);

#endif
