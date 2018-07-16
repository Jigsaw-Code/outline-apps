/*
 * wepoll - epoll for Windows
 * https://github.com/piscisaureus/wepoll
 *
 * Copyright 2012-2018, Bert Belder <bertbelder@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#ifndef WEPOLL_H_
#define WEPOLL_H_

#ifndef WEPOLL_EXPORT
#define WEPOLL_EXPORT
#endif

#include <stdint.h>

/* clang-format off */

enum EPOLL_EVENTS {
  EPOLLIN      = 1 <<  0,
  EPOLLPRI     = 1 <<  1,
  EPOLLOUT     = 1 <<  2,
  EPOLLERR     = 1 <<  3,
  EPOLLHUP     = 1 <<  4,
  EPOLLRDNORM  = 1 <<  6,
  EPOLLRDBAND  = 1 <<  7,
  EPOLLWRNORM  = 1 <<  8,
  EPOLLWRBAND  = 1 <<  9,
  EPOLLMSG     = 1 << 10, /* Never reported. */
  EPOLLRDHUP   = 1 << 13,
  EPOLLONESHOT = 1 << 31
};

#define EPOLLIN      ((uint32_t) EPOLLIN)
#define EPOLLPRI     ((uint32_t) EPOLLPRI)
#define EPOLLOUT     ((uint32_t) EPOLLOUT)
#define EPOLLERR     ((uint32_t) EPOLLERR)
#define EPOLLHUP     ((uint32_t) EPOLLHUP)
#define EPOLLRDNORM  ((uint32_t) EPOLLRDNORM)
#define EPOLLRDBAND  ((uint32_t) EPOLLRDBAND)
#define EPOLLWRNORM  ((uint32_t) EPOLLWRNORM)
#define EPOLLWRBAND  ((uint32_t) EPOLLWRBAND)
#define EPOLLMSG     ((uint32_t) EPOLLMSG)
#define EPOLLRDHUP   ((uint32_t) EPOLLRDHUP)
#define EPOLLONESHOT ((uint32_t) EPOLLONESHOT)

#define EPOLL_CTL_ADD 1
#define EPOLL_CTL_MOD 2
#define EPOLL_CTL_DEL 3

/* clang-format on */

typedef void* HANDLE;
typedef uintptr_t SOCKET;

typedef union epoll_data {
  void* ptr;
  int fd;
  uint32_t u32;
  uint64_t u64;
  SOCKET sock; /* Windows specific */
  HANDLE hnd;  /* Windows specific */
} epoll_data_t;

struct epoll_event {
  uint32_t events;   /* Epoll events and flags */
  epoll_data_t data; /* User data variable */
};

#ifdef __cplusplus
extern "C" {
#endif

WEPOLL_EXPORT HANDLE epoll_create(int size);
WEPOLL_EXPORT HANDLE epoll_create1(int flags);

WEPOLL_EXPORT int epoll_close(HANDLE ephnd);

WEPOLL_EXPORT int epoll_ctl(HANDLE ephnd,
                            int op,
                            SOCKET sock,
                            struct epoll_event* event);

WEPOLL_EXPORT int epoll_wait(HANDLE ephnd,
                             struct epoll_event* events,
                             int maxevents,
                             int timeout);

#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* WEPOLL_H_ */
