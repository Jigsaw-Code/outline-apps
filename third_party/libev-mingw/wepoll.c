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

#include <malloc.h>
#include <stdlib.h>

#define WEPOLL_INTERNAL static
#define WEPOLL_INTERNAL_VAR static

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#if defined(_WIN32_WINNT) && _WIN32_WINNT < 0x0600
#undef _WIN32_WINNT
#endif

#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0600
#endif

#ifndef __GNUC__
#pragma warning(push, 1)
#endif

#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>

#ifndef __GNUC__
#pragma warning(pop)
#endif

WEPOLL_INTERNAL int nt_global_init(void);

typedef LONG NTSTATUS;
typedef NTSTATUS* PNTSTATUS;

#ifndef NT_SUCCESS
#define NT_SUCCESS(status) (((NTSTATUS)(status)) >= 0)
#endif

#ifndef STATUS_SUCCESS
#define STATUS_SUCCESS ((NTSTATUS) 0x00000000L)
#endif

#ifndef STATUS_WAIT_0
#define STATUS_WAIT_0 ((NTSTATUS) 0x00000000L)
#endif

#ifndef STATUS_WAIT_1
#define STATUS_WAIT_1 ((NTSTATUS) 0x00000001L)
#endif

#ifndef STATUS_WAIT_2
#define STATUS_WAIT_2 ((NTSTATUS) 0x00000002L)
#endif

#ifndef STATUS_WAIT_3
#define STATUS_WAIT_3 ((NTSTATUS) 0x00000003L)
#endif

#ifndef STATUS_WAIT_63
#define STATUS_WAIT_63 ((NTSTATUS) 0x0000003FL)
#endif

#ifndef STATUS_ABANDONED
#define STATUS_ABANDONED ((NTSTATUS) 0x00000080L)
#endif

#ifndef STATUS_ABANDONED_WAIT_0
#define STATUS_ABANDONED_WAIT_0 ((NTSTATUS) 0x00000080L)
#endif

#ifndef STATUS_ABANDONED_WAIT_63
#define STATUS_ABANDONED_WAIT_63 ((NTSTATUS) 0x000000BFL)
#endif

#ifndef STATUS_USER_APC
#define STATUS_USER_APC ((NTSTATUS) 0x000000C0L)
#endif

#ifndef STATUS_KERNEL_APC
#define STATUS_KERNEL_APC ((NTSTATUS) 0x00000100L)
#endif

#ifndef STATUS_ALERTED
#define STATUS_ALERTED ((NTSTATUS) 0x00000101L)
#endif

#ifndef STATUS_TIMEOUT
#define STATUS_TIMEOUT ((NTSTATUS) 0x00000102L)
#endif

#ifndef STATUS_PENDING
#define STATUS_PENDING ((NTSTATUS) 0x00000103L)
#endif

#ifndef STATUS_CANCELLED
#define STATUS_CANCELLED ((NTSTATUS) 0xC0000120L)
#endif

typedef struct _IO_STATUS_BLOCK {
  union {
    NTSTATUS Status;
    PVOID Pointer;
  };
  ULONG_PTR Information;
} IO_STATUS_BLOCK, *PIO_STATUS_BLOCK;

typedef VOID(NTAPI* PIO_APC_ROUTINE)(PVOID ApcContext,
                                     PIO_STATUS_BLOCK IoStatusBlock,
                                     ULONG Reserved);

typedef struct _LSA_UNICODE_STRING {
  USHORT Length;
  USHORT MaximumLength;
  PWSTR Buffer;
} LSA_UNICODE_STRING, *PLSA_UNICODE_STRING, UNICODE_STRING, *PUNICODE_STRING;

typedef struct _OBJECT_ATTRIBUTES {
  ULONG Length;
  HANDLE RootDirectory;
  PUNICODE_STRING ObjectName;
  ULONG Attributes;
  PVOID SecurityDescriptor;
  PVOID SecurityQualityOfService;
} OBJECT_ATTRIBUTES, *POBJECT_ATTRIBUTES;

#define NTDLL_IMPORT_LIST(X)                                                 \
  X(NTSTATUS,                                                                \
    NTAPI,                                                                   \
    NtDeviceIoControlFile,                                                   \
    (HANDLE FileHandle,                                                      \
     HANDLE Event,                                                           \
     PIO_APC_ROUTINE ApcRoutine,                                             \
     PVOID ApcContext,                                                       \
     PIO_STATUS_BLOCK IoStatusBlock,                                         \
     ULONG IoControlCode,                                                    \
     PVOID InputBuffer,                                                      \
     ULONG InputBufferLength,                                                \
     PVOID OutputBuffer,                                                     \
     ULONG OutputBufferLength))                                              \
                                                                             \
  X(ULONG, WINAPI, RtlNtStatusToDosError, (NTSTATUS Status))                 \
                                                                             \
  X(NTSTATUS,                                                                \
    NTAPI,                                                                   \
    NtCreateKeyedEvent,                                                      \
    (PHANDLE handle,                                                         \
     ACCESS_MASK access,                                                     \
     POBJECT_ATTRIBUTES attr,                                                \
     ULONG flags))                                                           \
                                                                             \
  X(NTSTATUS,                                                                \
    NTAPI,                                                                   \
    NtWaitForKeyedEvent,                                                     \
    (HANDLE handle, PVOID key, BOOLEAN alertable, PLARGE_INTEGER mstimeout)) \
                                                                             \
  X(NTSTATUS,                                                                \
    NTAPI,                                                                   \
    NtReleaseKeyedEvent,                                                     \
    (HANDLE handle, PVOID key, BOOLEAN alertable, PLARGE_INTEGER mstimeout))

#define X(return_type, attributes, name, parameters) \
  WEPOLL_INTERNAL_VAR return_type(attributes* name) parameters;
NTDLL_IMPORT_LIST(X)
#undef X

#include <stddef.h>

#ifndef _SSIZE_T_DEFINED
#define _SSIZE_T_DEFINED
typedef intptr_t ssize_t;
#endif

#define array_count(a) (sizeof(a) / (sizeof((a)[0])))

#define container_of(ptr, type, member) \
  ((type*) ((char*) (ptr) -offsetof(type, member)))

#define safe_container_of(ptr, type, member) \
  ((type*) util_safe_container_of_helper((ptr), offsetof(type, member)))

#define unused_var(v) ((void) (v))

#if defined(__clang__) || defined(__GNUC__)
#define unused_fn __attribute__((__unused__))
#else
#define unused_fn /* nothing */
#endif

#if defined(_MSC_VER) && _MSC_VER < 1900
/* Polyfill `inline` for msvc 12 (Visual Studio 2013) */
#define inline __inline
#endif

#if (defined(__clang__) || defined(__GNUC__)) && !defined(static_assert)
/* Polyfill `static_assert` for some versions of clang and gcc. */
#define static_assert(condition, message) typedef __attribute__( \
    (__unused__)) int __static_assert_##__LINE__[(condition) ? 1 : -1];
#endif

WEPOLL_INTERNAL void* util_safe_container_of_helper(void* ptr, size_t offset);

/* clang-format off */

#define AFD_NO_FAST_IO                  0x00000001
#define AFD_OVERLAPPED                  0x00000002
#define AFD_IMMEDIATE                   0x00000004

#define AFD_POLL_RECEIVE_BIT            0
#define AFD_POLL_RECEIVE                (1 << AFD_POLL_RECEIVE_BIT)
#define AFD_POLL_RECEIVE_EXPEDITED_BIT  1
#define AFD_POLL_RECEIVE_EXPEDITED      (1 << AFD_POLL_RECEIVE_EXPEDITED_BIT)
#define AFD_POLL_SEND_BIT               2
#define AFD_POLL_SEND                   (1 << AFD_POLL_SEND_BIT)
#define AFD_POLL_DISCONNECT_BIT         3
#define AFD_POLL_DISCONNECT             (1 << AFD_POLL_DISCONNECT_BIT)
#define AFD_POLL_ABORT_BIT              4
#define AFD_POLL_ABORT                  (1 << AFD_POLL_ABORT_BIT)
#define AFD_POLL_LOCAL_CLOSE_BIT        5
#define AFD_POLL_LOCAL_CLOSE            (1 << AFD_POLL_LOCAL_CLOSE_BIT)
#define AFD_POLL_CONNECT_BIT            6
#define AFD_POLL_CONNECT                (1 << AFD_POLL_CONNECT_BIT)
#define AFD_POLL_ACCEPT_BIT             7
#define AFD_POLL_ACCEPT                 (1 << AFD_POLL_ACCEPT_BIT)
#define AFD_POLL_CONNECT_FAIL_BIT       8
#define AFD_POLL_CONNECT_FAIL           (1 << AFD_POLL_CONNECT_FAIL_BIT)
#define AFD_POLL_QOS_BIT                9
#define AFD_POLL_QOS                    (1 << AFD_POLL_QOS_BIT)
#define AFD_POLL_GROUP_QOS_BIT          10
#define AFD_POLL_GROUP_QOS              (1 << AFD_POLL_GROUP_QOS_BIT)
#define AFD_NUM_POLL_EVENTS             11
#define AFD_POLL_ALL                    ((1 << AFD_NUM_POLL_EVENTS) - 1)

/* clang-format on */

typedef struct _AFD_POLL_HANDLE_INFO {
  HANDLE Handle;
  ULONG Events;
  NTSTATUS Status;
} AFD_POLL_HANDLE_INFO, *PAFD_POLL_HANDLE_INFO;

typedef struct _AFD_POLL_INFO {
  LARGE_INTEGER Timeout;
  ULONG NumberOfHandles;
  ULONG Exclusive;
  AFD_POLL_HANDLE_INFO Handles[1];
} AFD_POLL_INFO, *PAFD_POLL_INFO;

WEPOLL_INTERNAL int afd_global_init(void);

WEPOLL_INTERNAL int afd_create_driver_socket(HANDLE iocp,
                                             SOCKET* driver_socket_out);

WEPOLL_INTERNAL int afd_poll(SOCKET driver_socket,
                             AFD_POLL_INFO* poll_info,
                             OVERLAPPED* overlapped);

#include <errno.h>

#define _return_error_helper(error, value) \
  do {                                     \
    err_set_win_error(error);              \
    return (value);                        \
  } while (0)

#define return_error(value, ...) _return_error_helper(__VA_ARGS__ + 0, value)

WEPOLL_INTERNAL errno_t err_map_win_error_to_errno(DWORD error);
WEPOLL_INTERNAL void err_set_win_error(DWORD error);
WEPOLL_INTERNAL int err_check_handle(HANDLE handle);

WEPOLL_INTERNAL int ws_global_init(void);

WEPOLL_INTERNAL SOCKET ws_get_base_socket(SOCKET socket);
WEPOLL_INTERNAL ssize_t ws_get_protocol_catalog(WSAPROTOCOL_INFOW** infos_out);

#define FILE_DEVICE_NETWORK 0x00000012
#define METHOD_BUFFERED 0
#define AFD_POLL 9

#define _AFD_CONTROL_CODE(operation, method) \
  ((FILE_DEVICE_NETWORK) << 12 | (operation << 2) | method)

#define IOCTL_AFD_POLL _AFD_CONTROL_CODE(AFD_POLL, METHOD_BUFFERED)

#define _AFD_ANY_PROTOCOL -1

/* clang-format off */
static const GUID _AFD_PROVIDER_GUID_LIST[] = {
  /* MSAFD Tcpip [TCP+UDP+RAW / IP] */
  {0xe70f1aa0, 0xab8b, 0x11cf,
   {0x8c, 0xa3, 0x00, 0x80, 0x5f, 0x48, 0xa1, 0x92}},
  /* MSAFD Tcpip [TCP+UDP+RAW / IPv6] */
  {0xf9eab0c0, 0x26d4, 0x11d0,
   {0xbb, 0xbf, 0x00, 0xaa, 0x00, 0x6c, 0x34, 0xe4}},
  /* MSAFD RfComm [Bluetooth] */
  {0x9fc48064, 0x7298, 0x43e4,
   {0xb7, 0xbd, 0x18, 0x1f, 0x20, 0x89, 0x79, 0x2a}},
  /* MSAFD Irda [IrDA] */
  {0x3972523d, 0x2af1, 0x11d1,
   {0xb6, 0x55, 0x00, 0x80, 0x5f, 0x36, 0x42, 0xcc}}};
/* clang-format on */

/* This protocol info record is used by afd_create_driver_socket() to create
 * sockets that can be used as the first argument to afd_poll(). It is
 * populated on startup by afd_global_init().
 */
static WSAPROTOCOL_INFOW _afd_driver_socket_template;

static const WSAPROTOCOL_INFOW* _afd_find_protocol_info(
    const WSAPROTOCOL_INFOW* infos, size_t infos_count, int protocol_id) {
  size_t i, j;

  for (i = 0; i < infos_count; i++) {
    const WSAPROTOCOL_INFOW* info = &infos[i];

    /* Apply protocol id filter. */
    if (protocol_id != _AFD_ANY_PROTOCOL && protocol_id != info->iProtocol)
      continue;

    /* Filter out non-MSAFD protocols. */
    for (j = 0; j < array_count(_AFD_PROVIDER_GUID_LIST); j++) {
      if (memcmp(&info->ProviderId,
                 &_AFD_PROVIDER_GUID_LIST[j],
                 sizeof info->ProviderId) == 0)
        return info;
    }
  }

  return NULL; /* Not found. */
}

int afd_global_init(void) {
  WSAPROTOCOL_INFOW* infos;
  ssize_t infos_count;
  const WSAPROTOCOL_INFOW* afd_info;

  /* Load the winsock catalog. */
  infos_count = ws_get_protocol_catalog(&infos);
  if (infos_count < 0)
    return_error(-1);

  /* Find a WSAPROTOCOL_INDOW structure that we can use to create an MSAFD
   * socket. Preferentially we pick a UDP socket, otherwise try TCP or any
   * other type.
   */
  do {
    afd_info = _afd_find_protocol_info(infos, infos_count, IPPROTO_UDP);
    if (afd_info != NULL)
      break;

    afd_info = _afd_find_protocol_info(infos, infos_count, IPPROTO_TCP);
    if (afd_info != NULL)
      break;

    afd_info = _afd_find_protocol_info(infos, infos_count, _AFD_ANY_PROTOCOL);
    if (afd_info != NULL)
      break;

    free(infos);
    return_error(-1, WSAENETDOWN); /* No suitable protocol found. */
  } while (0);

  /* Copy found protocol information from the catalog to a static buffer. */
  _afd_driver_socket_template = *afd_info;

  free(infos);
  return 0;
}

int afd_create_driver_socket(HANDLE iocp, SOCKET* driver_socket_out) {
  SOCKET socket;

  socket = WSASocketW(_afd_driver_socket_template.iAddressFamily,
                      _afd_driver_socket_template.iSocketType,
                      _afd_driver_socket_template.iProtocol,
                      &_afd_driver_socket_template,
                      0,
                      WSA_FLAG_OVERLAPPED);
  if (socket == INVALID_SOCKET)
    return_error(-1);

  /* TODO: use WSA_FLAG_NOINHERIT on Windows versions that support it. */
  if (!SetHandleInformation((HANDLE) socket, HANDLE_FLAG_INHERIT, 0))
    goto error;

  if (CreateIoCompletionPort((HANDLE) socket, iocp, 0, 0) == NULL)
    goto error;

  *driver_socket_out = socket;
  return 0;

error:;
  DWORD error = GetLastError();
  closesocket(socket);
  return_error(-1, error);
}

int afd_poll(SOCKET driver_socket,
             AFD_POLL_INFO* poll_info,
             OVERLAPPED* overlapped) {
  IO_STATUS_BLOCK iosb;
  IO_STATUS_BLOCK* iosb_ptr;
  HANDLE event = NULL;
  void* apc_context;
  NTSTATUS status;

  if (overlapped != NULL) {
    /* Overlapped operation. */
    iosb_ptr = (IO_STATUS_BLOCK*) &overlapped->Internal;
    event = overlapped->hEvent;

    /* Do not report iocp completion if hEvent is tagged. */
    if ((uintptr_t) event & 1) {
      event = (HANDLE)((uintptr_t) event & ~(uintptr_t) 1);
      apc_context = NULL;
    } else {
      apc_context = overlapped;
    }

  } else {
    /* Blocking operation. */
    iosb_ptr = &iosb;
    event = CreateEventW(NULL, FALSE, FALSE, NULL);
    if (event == NULL)
      return_error(-1);
    apc_context = NULL;
  }

  iosb_ptr->Status = STATUS_PENDING;
  status = NtDeviceIoControlFile((HANDLE) driver_socket,
                                 event,
                                 NULL,
                                 apc_context,
                                 iosb_ptr,
                                 IOCTL_AFD_POLL,
                                 poll_info,
                                 sizeof *poll_info,
                                 poll_info,
                                 sizeof *poll_info);

  if (overlapped == NULL) {
    /* If this is a blocking operation, wait for the event to become
     * signaled, and then grab the real status from the io status block.
     */
    if (status == STATUS_PENDING) {
      DWORD r = WaitForSingleObject(event, INFINITE);

      if (r == WAIT_FAILED) {
        DWORD error = GetLastError();
        CloseHandle(event);
        return_error(-1, error);
      }

      status = iosb_ptr->Status;
    }

    CloseHandle(event);
  }

  if (status == STATUS_SUCCESS)
    return 0;
  else if (status == STATUS_PENDING)
    return_error(-1, ERROR_IO_PENDING);
  else
    return_error(-1, RtlNtStatusToDosError(status));
}

WEPOLL_INTERNAL int api_global_init(void);

WEPOLL_INTERNAL int init(void);

#include <stdbool.h>

typedef struct queue_node queue_node_t;

typedef struct queue_node {
  queue_node_t* prev;
  queue_node_t* next;
} queue_node_t;

typedef struct queue {
  queue_node_t head;
} queue_t;

WEPOLL_INTERNAL void queue_init(queue_t* queue);
WEPOLL_INTERNAL void queue_node_init(queue_node_t* node);

WEPOLL_INTERNAL queue_node_t* queue_first(const queue_t* queue);
WEPOLL_INTERNAL queue_node_t* queue_last(const queue_t* queue);

WEPOLL_INTERNAL void queue_prepend(queue_t* queue, queue_node_t* node);
WEPOLL_INTERNAL void queue_append(queue_t* queue, queue_node_t* node);
WEPOLL_INTERNAL void queue_move_first(queue_t* queue, queue_node_t* node);
WEPOLL_INTERNAL void queue_move_last(queue_t* queue, queue_node_t* node);
WEPOLL_INTERNAL void queue_remove(queue_node_t* node);

WEPOLL_INTERNAL bool queue_empty(const queue_t* queue);
WEPOLL_INTERNAL bool queue_enqueued(const queue_node_t* node);

typedef struct ep_port ep_port_t;
typedef struct poll_group poll_group_t;

WEPOLL_INTERNAL poll_group_t* poll_group_acquire(ep_port_t* port);
WEPOLL_INTERNAL void poll_group_release(poll_group_t* poll_group);

WEPOLL_INTERNAL void poll_group_delete(poll_group_t* poll_group);

WEPOLL_INTERNAL poll_group_t* poll_group_from_queue_node(
    queue_node_t* queue_node);
WEPOLL_INTERNAL SOCKET poll_group_get_socket(poll_group_t* poll_group);

/* The reflock is a special kind of lock that normally prevents a chunk of
 * memory from being freed, but does allow the chunk of memory to eventually be
 * released in a coordinated fashion.
 *
 * Under normal operation, threads increase and decrease the reference count,
 * which are wait-free operations.
 *
 * Exactly once during the reflock's lifecycle, a thread holding a reference to
 * the lock may "destroy" the lock; this operation blocks until all other
 * threads holding a reference to the lock have dereferenced it. After
 * "destroy" returns, the calling thread may assume that no other threads have
 * a reference to the lock.
 *
 * Attemmpting to lock or destroy a lock after reflock_unref_and_destroy() has
 * been called is invalid and results in undefined behavior. Therefore the user
 * should use another lock to guarantee that this can't happen.
 */

typedef struct reflock {
  uint32_t state;
} reflock_t;

WEPOLL_INTERNAL int reflock_global_init(void);

WEPOLL_INTERNAL void reflock_init(reflock_t* reflock);
WEPOLL_INTERNAL void reflock_ref(reflock_t* reflock);
WEPOLL_INTERNAL void reflock_unref(reflock_t* reflock);
WEPOLL_INTERNAL void reflock_unref_and_destroy(reflock_t* reflock);

/* NB: the tree functions do not set errno or LastError when they fail. Each of
 * the API functions has at most one failure mode. It is up to the caller to
 * set an appropriate error code when necessary.
 */

typedef struct tree tree_t;
typedef struct tree_node tree_node_t;

typedef struct tree {
  tree_node_t* root;
} tree_t;

typedef struct tree_node {
  tree_node_t* left;
  tree_node_t* right;
  tree_node_t* parent;
  uintptr_t key;
  bool red;
} tree_node_t;

WEPOLL_INTERNAL void tree_init(tree_t* tree);
WEPOLL_INTERNAL void tree_node_init(tree_node_t* node);

WEPOLL_INTERNAL int tree_add(tree_t* tree, tree_node_t* node, uintptr_t key);
WEPOLL_INTERNAL void tree_del(tree_t* tree, tree_node_t* node);

WEPOLL_INTERNAL tree_node_t* tree_find(const tree_t* tree, uintptr_t key);
WEPOLL_INTERNAL tree_node_t* tree_root(const tree_t* tree);

typedef struct reflock_tree {
  tree_t tree;
  SRWLOCK lock;
} reflock_tree_t;

typedef struct reflock_tree_node {
  tree_node_t tree_node;
  reflock_t reflock;
} reflock_tree_node_t;

WEPOLL_INTERNAL void reflock_tree_init(reflock_tree_t* rtl);
WEPOLL_INTERNAL void reflock_tree_node_init(reflock_tree_node_t* node);

WEPOLL_INTERNAL int reflock_tree_add(reflock_tree_t* rlt,
                                     reflock_tree_node_t* node,
                                     uintptr_t key);

WEPOLL_INTERNAL reflock_tree_node_t* reflock_tree_del_and_ref(
    reflock_tree_t* rlt, uintptr_t key);
WEPOLL_INTERNAL reflock_tree_node_t* reflock_tree_find_and_ref(
    reflock_tree_t* rlt, uintptr_t key);

WEPOLL_INTERNAL void reflock_tree_node_unref(reflock_tree_node_t* node);
WEPOLL_INTERNAL void reflock_tree_node_unref_and_destroy(
    reflock_tree_node_t* node);

typedef struct ep_port ep_port_t;
typedef struct poll_req poll_req_t;

typedef struct ep_sock {
  tree_node_t tree_node;
  queue_node_t queue_node;
} ep_sock_t;

WEPOLL_INTERNAL ep_sock_t* ep_sock_new(ep_port_t* port_info, SOCKET socket);
WEPOLL_INTERNAL void ep_sock_delete(ep_port_t* port_info,
                                    ep_sock_t* sock_info);
WEPOLL_INTERNAL void ep_sock_force_delete(ep_port_t* port_info,
                                          ep_sock_t* sock_info);

WEPOLL_INTERNAL int ep_sock_set_event(ep_port_t* port_info,
                                      ep_sock_t* sock_info,
                                      const struct epoll_event* ev);

WEPOLL_INTERNAL int ep_sock_update(ep_port_t* port_info, ep_sock_t* sock_info);
WEPOLL_INTERNAL int ep_sock_feed_event(ep_port_t* port_info,
                                       OVERLAPPED* overlapped,
                                       struct epoll_event* ev);

typedef struct ep_port ep_port_t;
typedef struct ep_sock ep_sock_t;

typedef struct ep_port {
  HANDLE iocp;
  tree_t sock_tree;
  queue_t sock_update_queue;
  queue_t sock_deleted_queue;
  queue_t poll_group_queue;
  reflock_tree_node_t handle_tree_node;
  CRITICAL_SECTION lock;
  size_t active_poll_count;
} ep_port_t;

WEPOLL_INTERNAL ep_port_t* ep_port_new(HANDLE* iocp_out);
WEPOLL_INTERNAL int ep_port_close(ep_port_t* port_info);
WEPOLL_INTERNAL int ep_port_delete(ep_port_t* port_info);

WEPOLL_INTERNAL int ep_port_wait(ep_port_t* port_info,
                                 struct epoll_event* events,
                                 int maxevents,
                                 int timeout);

WEPOLL_INTERNAL int ep_port_ctl(ep_port_t* port_info,
                                int op,
                                SOCKET sock,
                                struct epoll_event* ev);

WEPOLL_INTERNAL int ep_port_register_socket_handle(ep_port_t* port_info,
                                                   ep_sock_t* sock_info,
                                                   SOCKET socket);
WEPOLL_INTERNAL void ep_port_unregister_socket_handle(ep_port_t* port_info,
                                                      ep_sock_t* sock_info);
WEPOLL_INTERNAL ep_sock_t* ep_port_find_socket(ep_port_t* port_info,
                                               SOCKET socket);

WEPOLL_INTERNAL void ep_port_request_socket_update(ep_port_t* port_info,
                                                   ep_sock_t* sock_info);
WEPOLL_INTERNAL void ep_port_cancel_socket_update(ep_port_t* port_info,
                                                  ep_sock_t* sock_info);

WEPOLL_INTERNAL void ep_port_add_deleted_socket(ep_port_t* port_info,
                                                ep_sock_t* sock_info);
WEPOLL_INTERNAL void ep_port_remove_deleted_socket(ep_port_t* port_info,
                                                   ep_sock_t* sock_info);

static reflock_tree_t _epoll_handle_tree;

static inline ep_port_t* _handle_tree_node_to_port(
    reflock_tree_node_t* tree_node) {
  return container_of(tree_node, ep_port_t, handle_tree_node);
}

int api_global_init(void) {
  reflock_tree_init(&_epoll_handle_tree);
  return 0;
}

static HANDLE _epoll_create(void) {
  ep_port_t* port_info;
  HANDLE ephnd;

  if (init() < 0)
    return NULL;

  port_info = ep_port_new(&ephnd);
  if (port_info == NULL)
    return NULL;

  if (reflock_tree_add(&_epoll_handle_tree,
                       &port_info->handle_tree_node,
                       (uintptr_t) ephnd) < 0) {
    /* This should never happen. */
    ep_port_delete(port_info);
    return_error(NULL, ERROR_ALREADY_EXISTS);
  }

  return ephnd;
}

HANDLE epoll_create(int size) {
  if (size <= 0)
    return_error(NULL, ERROR_INVALID_PARAMETER);

  return _epoll_create();
}

HANDLE epoll_create1(int flags) {
  if (flags != 0)
    return_error(NULL, ERROR_INVALID_PARAMETER);

  return _epoll_create();
}

int epoll_close(HANDLE ephnd) {
  reflock_tree_node_t* tree_node;
  ep_port_t* port_info;

  if (init() < 0)
    return -1;

  tree_node = reflock_tree_del_and_ref(&_epoll_handle_tree, (uintptr_t) ephnd);
  if (tree_node == NULL) {
    err_set_win_error(ERROR_INVALID_PARAMETER);
    goto err;
  }

  port_info = _handle_tree_node_to_port(tree_node);
  ep_port_close(port_info);

  reflock_tree_node_unref_and_destroy(tree_node);

  return ep_port_delete(port_info);

err:
  err_check_handle(ephnd);
  return -1;
}

int epoll_ctl(HANDLE ephnd, int op, SOCKET sock, struct epoll_event* ev) {
  reflock_tree_node_t* tree_node;
  ep_port_t* port_info;
  int r;

  if (init() < 0)
    return -1;

  tree_node =
      reflock_tree_find_and_ref(&_epoll_handle_tree, (uintptr_t) ephnd);
  if (tree_node == NULL) {
    err_set_win_error(ERROR_INVALID_PARAMETER);
    goto err;
  }

  port_info = _handle_tree_node_to_port(tree_node);
  r = ep_port_ctl(port_info, op, sock, ev);

  reflock_tree_node_unref(tree_node);

  if (r < 0)
    goto err;

  return 0;

err:
  /* On Linux, in the case of epoll_ctl_mod(), EBADF takes precendence over
   * other errors. Wepoll copies this behavior. */
  err_check_handle(ephnd);
  err_check_handle((HANDLE) sock);
  return -1;
}

int epoll_wait(HANDLE ephnd,
               struct epoll_event* events,
               int maxevents,
               int timeout) {
  reflock_tree_node_t* tree_node;
  ep_port_t* port_info;
  int num_events;

  if (maxevents <= 0)
    return_error(-1, ERROR_INVALID_PARAMETER);

  if (init() < 0)
    return -1;

  tree_node =
      reflock_tree_find_and_ref(&_epoll_handle_tree, (uintptr_t) ephnd);
  if (tree_node == NULL) {
    err_set_win_error(ERROR_INVALID_PARAMETER);
    goto err;
  }

  port_info = _handle_tree_node_to_port(tree_node);
  num_events = ep_port_wait(port_info, events, maxevents, timeout);

  reflock_tree_node_unref(tree_node);

  if (num_events < 0)
    goto err;

  return num_events;

err:
  err_check_handle(ephnd);
  return -1;
}

#define _ERROR_ERRNO_MAP(X)                  \
  X(ERROR_ACCESS_DENIED, EACCES)             \
  X(ERROR_ALREADY_EXISTS, EEXIST)            \
  X(ERROR_BAD_COMMAND, EACCES)               \
  X(ERROR_BAD_EXE_FORMAT, ENOEXEC)           \
  X(ERROR_BAD_LENGTH, EACCES)                \
  X(ERROR_BAD_NETPATH, ENOENT)               \
  X(ERROR_BAD_NET_NAME, ENOENT)              \
  X(ERROR_BAD_NET_RESP, ENETDOWN)            \
  X(ERROR_BAD_PATHNAME, ENOENT)              \
  X(ERROR_BROKEN_PIPE, EPIPE)                \
  X(ERROR_CANNOT_MAKE, EACCES)               \
  X(ERROR_COMMITMENT_LIMIT, ENOMEM)          \
  X(ERROR_CONNECTION_ABORTED, ECONNABORTED)  \
  X(ERROR_CONNECTION_ACTIVE, EISCONN)        \
  X(ERROR_CONNECTION_REFUSED, ECONNREFUSED)  \
  X(ERROR_CRC, EACCES)                       \
  X(ERROR_DIR_NOT_EMPTY, ENOTEMPTY)          \
  X(ERROR_DISK_FULL, ENOSPC)                 \
  X(ERROR_DUP_NAME, EADDRINUSE)              \
  X(ERROR_FILENAME_EXCED_RANGE, ENOENT)      \
  X(ERROR_FILE_NOT_FOUND, ENOENT)            \
  X(ERROR_GEN_FAILURE, EACCES)               \
  X(ERROR_GRACEFUL_DISCONNECT, EPIPE)        \
  X(ERROR_HOST_DOWN, EHOSTUNREACH)           \
  X(ERROR_HOST_UNREACHABLE, EHOSTUNREACH)    \
  X(ERROR_INSUFFICIENT_BUFFER, EFAULT)       \
  X(ERROR_INVALID_ADDRESS, EADDRNOTAVAIL)    \
  X(ERROR_INVALID_FUNCTION, EINVAL)          \
  X(ERROR_INVALID_HANDLE, EBADF)             \
  X(ERROR_INVALID_NETNAME, EADDRNOTAVAIL)    \
  X(ERROR_INVALID_PARAMETER, EINVAL)         \
  X(ERROR_INVALID_USER_BUFFER, EMSGSIZE)     \
  X(ERROR_IO_PENDING, EINPROGRESS)           \
  X(ERROR_LOCK_VIOLATION, EACCES)            \
  X(ERROR_MORE_DATA, EMSGSIZE)               \
  X(ERROR_NETNAME_DELETED, ECONNABORTED)     \
  X(ERROR_NETWORK_ACCESS_DENIED, EACCES)     \
  X(ERROR_NETWORK_BUSY, ENETDOWN)            \
  X(ERROR_NETWORK_UNREACHABLE, ENETUNREACH)  \
  X(ERROR_NOACCESS, EFAULT)                  \
  X(ERROR_NONPAGED_SYSTEM_RESOURCES, ENOMEM) \
  X(ERROR_NOT_ENOUGH_MEMORY, ENOMEM)         \
  X(ERROR_NOT_ENOUGH_QUOTA, ENOMEM)          \
  X(ERROR_NOT_FOUND, ENOENT)                 \
  X(ERROR_NOT_LOCKED, EACCES)                \
  X(ERROR_NOT_READY, EACCES)                 \
  X(ERROR_NOT_SAME_DEVICE, EXDEV)            \
  X(ERROR_NOT_SUPPORTED, ENOTSUP)            \
  X(ERROR_NO_MORE_FILES, ENOENT)             \
  X(ERROR_NO_SYSTEM_RESOURCES, ENOMEM)       \
  X(ERROR_OPERATION_ABORTED, EINTR)          \
  X(ERROR_OUT_OF_PAPER, EACCES)              \
  X(ERROR_PAGED_SYSTEM_RESOURCES, ENOMEM)    \
  X(ERROR_PAGEFILE_QUOTA, ENOMEM)            \
  X(ERROR_PATH_NOT_FOUND, ENOENT)            \
  X(ERROR_PIPE_NOT_CONNECTED, EPIPE)         \
  X(ERROR_PORT_UNREACHABLE, ECONNRESET)      \
  X(ERROR_PROTOCOL_UNREACHABLE, ENETUNREACH) \
  X(ERROR_REM_NOT_LIST, ECONNREFUSED)        \
  X(ERROR_REQUEST_ABORTED, EINTR)            \
  X(ERROR_REQ_NOT_ACCEP, EWOULDBLOCK)        \
  X(ERROR_SECTOR_NOT_FOUND, EACCES)          \
  X(ERROR_SEM_TIMEOUT, ETIMEDOUT)            \
  X(ERROR_SHARING_VIOLATION, EACCES)         \
  X(ERROR_TOO_MANY_NAMES, ENOMEM)            \
  X(ERROR_TOO_MANY_OPEN_FILES, EMFILE)       \
  X(ERROR_UNEXP_NET_ERR, ECONNABORTED)       \
  X(ERROR_WAIT_NO_CHILDREN, ECHILD)          \
  X(ERROR_WORKING_SET_QUOTA, ENOMEM)         \
  X(ERROR_WRITE_PROTECT, EACCES)             \
  X(ERROR_WRONG_DISK, EACCES)                \
  X(WSAEACCES, EACCES)                       \
  X(WSAEADDRINUSE, EADDRINUSE)               \
  X(WSAEADDRNOTAVAIL, EADDRNOTAVAIL)         \
  X(WSAEAFNOSUPPORT, EAFNOSUPPORT)           \
  X(WSAECONNABORTED, ECONNABORTED)           \
  X(WSAECONNREFUSED, ECONNREFUSED)           \
  X(WSAECONNRESET, ECONNRESET)               \
  X(WSAEDISCON, EPIPE)                       \
  X(WSAEFAULT, EFAULT)                       \
  X(WSAEHOSTDOWN, EHOSTUNREACH)              \
  X(WSAEHOSTUNREACH, EHOSTUNREACH)           \
  X(WSAEINPROGRESS, EBUSY)                   \
  X(WSAEINTR, EINTR)                         \
  X(WSAEINVAL, EINVAL)                       \
  X(WSAEISCONN, EISCONN)                     \
  X(WSAEMSGSIZE, EMSGSIZE)                   \
  X(WSAENETDOWN, ENETDOWN)                   \
  X(WSAENETRESET, EHOSTUNREACH)              \
  X(WSAENETUNREACH, ENETUNREACH)             \
  X(WSAENOBUFS, ENOMEM)                      \
  X(WSAENOTCONN, ENOTCONN)                   \
  X(WSAENOTSOCK, ENOTSOCK)                   \
  X(WSAEOPNOTSUPP, EOPNOTSUPP)               \
  X(WSAEPROCLIM, ENOMEM)                     \
  X(WSAESHUTDOWN, EPIPE)                     \
  X(WSAETIMEDOUT, ETIMEDOUT)                 \
  X(WSAEWOULDBLOCK, EWOULDBLOCK)             \
  X(WSANOTINITIALISED, ENETDOWN)             \
  X(WSASYSNOTREADY, ENETDOWN)                \
  X(WSAVERNOTSUPPORTED, ENOSYS)

errno_t err_map_win_error_to_errno(DWORD error) {
  switch (error) {
#define X(error_sym, errno_sym) \
  case error_sym:               \
    return errno_sym;
    _ERROR_ERRNO_MAP(X)
#undef X
  }
  return EINVAL;
}

void err_set_win_error(DWORD error) {
  if (error == 0)
    error = GetLastError();
  else
    SetLastError(error);
  errno = err_map_win_error_to_errno(error);
}

int err_check_handle(HANDLE handle) {
  DWORD flags;

  /* GetHandleInformation() succeeds when passed INVALID_HANDLE_VALUE, so check
   * for this condition explicitly. */
  if (handle == INVALID_HANDLE_VALUE)
    return_error(-1, ERROR_INVALID_HANDLE);

  if (!GetHandleInformation(handle, &flags))
    return_error(-1);

  return 0;
}

static bool _initialized = false;
static INIT_ONCE _once = INIT_ONCE_STATIC_INIT;

static BOOL CALLBACK _init_once_callback(INIT_ONCE* once,
                                         void* parameter,
                                         void** context) {
  unused_var(once);
  unused_var(parameter);
  unused_var(context);

  /* N.b. that initialization order matters here. */
  if (ws_global_init() < 0 || nt_global_init() < 0 || afd_global_init() < 0 ||
      reflock_global_init() < 0 || api_global_init() < 0)
    return FALSE;

  _initialized = true;
  return TRUE;
}

int init(void) {
  if (!_initialized &&
      !InitOnceExecuteOnce(&_once, _init_once_callback, NULL, NULL))
    return -1; /* LastError and errno aren't touched InitOnceExecuteOnce. */

  return 0;
}

#define X(return_type, attributes, name, parameters) \
  WEPOLL_INTERNAL return_type(attributes* name) parameters = NULL;
NTDLL_IMPORT_LIST(X)
#undef X

int nt_global_init(void) {
  HMODULE ntdll;

  ntdll = GetModuleHandleW(L"ntdll.dll");
  if (ntdll == NULL)
    return -1;

#define X(return_type, attributes, name, parameters)                         \
  name = (return_type(attributes*) parameters) GetProcAddress(ntdll, #name); \
  if (name == NULL)                                                          \
    return -1;
  NTDLL_IMPORT_LIST(X)
#undef X

  return 0;
}

#include <assert.h>

static const size_t _POLL_GROUP_MAX_SIZE = 32;

typedef struct poll_group {
  ep_port_t* port_info;
  queue_node_t queue_node;
  SOCKET socket;
  size_t group_size;
} poll_group_t;

static poll_group_t* _poll_group_new(ep_port_t* port_info) {
  poll_group_t* poll_group = malloc(sizeof *poll_group);
  if (poll_group == NULL)
    return_error(NULL, ERROR_NOT_ENOUGH_MEMORY);

  memset(poll_group, 0, sizeof *poll_group);

  queue_node_init(&poll_group->queue_node);
  poll_group->port_info = port_info;

  if (afd_create_driver_socket(port_info->iocp, &poll_group->socket) < 0) {
    free(poll_group);
    return NULL;
  }

  queue_append(&port_info->poll_group_queue, &poll_group->queue_node);

  return poll_group;
}

void poll_group_delete(poll_group_t* poll_group) {
  assert(poll_group->group_size == 0);
  closesocket(poll_group->socket);
  queue_remove(&poll_group->queue_node);
  free(poll_group);
}

poll_group_t* poll_group_from_queue_node(queue_node_t* queue_node) {
  return container_of(queue_node, poll_group_t, queue_node);
}

SOCKET poll_group_get_socket(poll_group_t* poll_group) {
  return poll_group->socket;
}

poll_group_t* poll_group_acquire(ep_port_t* port_info) {
  queue_t* queue = &port_info->poll_group_queue;
  poll_group_t* poll_group =
      !queue_empty(queue)
          ? container_of(queue_last(queue), poll_group_t, queue_node)
          : NULL;

  if (poll_group == NULL || poll_group->group_size >= _POLL_GROUP_MAX_SIZE)
    poll_group = _poll_group_new(port_info);
  if (poll_group == NULL)
    return NULL;

  if (++poll_group->group_size == _POLL_GROUP_MAX_SIZE)
    queue_move_first(&port_info->poll_group_queue, &poll_group->queue_node);

  return poll_group;
}

void poll_group_release(poll_group_t* poll_group) {
  ep_port_t* port_info = poll_group->port_info;

  poll_group->group_size--;
  assert(poll_group->group_size < _POLL_GROUP_MAX_SIZE);

  queue_move_last(&port_info->poll_group_queue, &poll_group->queue_node);

  /* Poll groups are currently only freed when the epoll port is closed. */
}

#define _PORT_MAX_ON_STACK_COMPLETIONS 256

static ep_port_t* _ep_port_alloc(void) {
  ep_port_t* port_info = malloc(sizeof *port_info);
  if (port_info == NULL)
    return_error(NULL, ERROR_NOT_ENOUGH_MEMORY);

  return port_info;
}

static void _ep_port_free(ep_port_t* port) {
  assert(port != NULL);
  free(port);
}

static HANDLE _ep_port_create_iocp(void) {
  HANDLE iocp = CreateIoCompletionPort(INVALID_HANDLE_VALUE, NULL, 0, 0);
  if (iocp == NULL)
    return_error(NULL);

  return iocp;
}

ep_port_t* ep_port_new(HANDLE* iocp_out) {
  ep_port_t* port_info;
  HANDLE iocp;

  port_info = _ep_port_alloc();
  if (port_info == NULL)
    goto err1;

  iocp = _ep_port_create_iocp();
  if (iocp == NULL)
    goto err2;

  memset(port_info, 0, sizeof *port_info);

  port_info->iocp = iocp;
  tree_init(&port_info->sock_tree);
  queue_init(&port_info->sock_update_queue);
  queue_init(&port_info->sock_deleted_queue);
  queue_init(&port_info->poll_group_queue);
  reflock_tree_node_init(&port_info->handle_tree_node);
  InitializeCriticalSection(&port_info->lock);

  *iocp_out = iocp;
  return port_info;

err2:
  _ep_port_free(port_info);
err1:
  return NULL;
}

static int _ep_port_close_iocp(ep_port_t* port_info) {
  HANDLE iocp = port_info->iocp;
  port_info->iocp = NULL;

  if (!CloseHandle(iocp))
    return_error(-1);

  return 0;
}

int ep_port_close(ep_port_t* port_info) {
  int result;

  EnterCriticalSection(&port_info->lock);
  result = _ep_port_close_iocp(port_info);
  LeaveCriticalSection(&port_info->lock);

  return result;
}

int ep_port_delete(ep_port_t* port_info) {
  tree_node_t* tree_node;
  queue_node_t* queue_node;

  /* At this point the IOCP port should have been closed. */
  assert(port_info->iocp == NULL);

  while ((tree_node = tree_root(&port_info->sock_tree)) != NULL) {
    ep_sock_t* sock_info = container_of(tree_node, ep_sock_t, tree_node);
    ep_sock_force_delete(port_info, sock_info);
  }

  while ((queue_node = queue_first(&port_info->sock_deleted_queue)) != NULL) {
    ep_sock_t* sock_info = container_of(queue_node, ep_sock_t, queue_node);
    ep_sock_force_delete(port_info, sock_info);
  }

  while ((queue_node = queue_first(&port_info->poll_group_queue)) != NULL) {
    poll_group_t* poll_group = poll_group_from_queue_node(queue_node);
    poll_group_delete(poll_group);
  }

  DeleteCriticalSection(&port_info->lock);

  _ep_port_free(port_info);

  return 0;
}

static int _ep_port_update_events(ep_port_t* port_info) {
  queue_t* sock_update_queue = &port_info->sock_update_queue;

  /* Walk the queue, submitting new poll requests for every socket that needs
   * it. */
  while (!queue_empty(sock_update_queue)) {
    queue_node_t* queue_node = queue_first(sock_update_queue);
    ep_sock_t* sock_info = container_of(queue_node, ep_sock_t, queue_node);

    if (ep_sock_update(port_info, sock_info) < 0)
      return -1;

    /* ep_sock_update() removes the socket from the update list if
     * successfull. */
  }

  return 0;
}

static void _ep_port_update_events_if_polling(ep_port_t* port_info) {
  if (port_info->active_poll_count > 0)
    _ep_port_update_events(port_info);
}

static int _ep_port_feed_events(ep_port_t* port_info,
                                struct epoll_event* epoll_events,
                                OVERLAPPED_ENTRY* iocp_events,
                                int iocp_event_count) {
  int epoll_event_count = 0;
  int i;

  for (i = 0; i < iocp_event_count; i++) {
    OVERLAPPED* overlapped = iocp_events[i].lpOverlapped;
    struct epoll_event* ev = &epoll_events[epoll_event_count];

    epoll_event_count += ep_sock_feed_event(port_info, overlapped, ev);
  }

  return epoll_event_count;
}

static int _ep_port_poll(ep_port_t* port_info,
                         struct epoll_event* epoll_events,
                         OVERLAPPED_ENTRY* iocp_events,
                         int maxevents,
                         DWORD timeout) {
  ULONG completion_count;

  if (_ep_port_update_events(port_info) < 0)
    return -1;

  port_info->active_poll_count++;

  LeaveCriticalSection(&port_info->lock);

  BOOL r = GetQueuedCompletionStatusEx(port_info->iocp,
                                       iocp_events,
                                       maxevents,
                                       &completion_count,
                                       timeout,
                                       FALSE);

  EnterCriticalSection(&port_info->lock);

  port_info->active_poll_count--;

  if (!r)
    return_error(-1);

  return _ep_port_feed_events(
      port_info, epoll_events, iocp_events, completion_count);
}

int ep_port_wait(ep_port_t* port_info,
                 struct epoll_event* events,
                 int maxevents,
                 int timeout) {
  OVERLAPPED_ENTRY stack_iocp_events[_PORT_MAX_ON_STACK_COMPLETIONS];
  OVERLAPPED_ENTRY* iocp_events;
  ULONGLONG due = 0;
  DWORD gqcs_timeout;
  int result;

  /* Check whether `maxevents` is in range. */
  if (maxevents <= 0)
    return_error(-1, ERROR_INVALID_PARAMETER);

  /* Decide whether the IOCP completion list can live on the stack, or allocate
   * memory for it on the heap. */
  if ((size_t) maxevents <= array_count(stack_iocp_events)) {
    iocp_events = stack_iocp_events;
  } else if ((iocp_events = malloc(maxevents * sizeof *iocp_events)) == NULL) {
    iocp_events = stack_iocp_events;
    maxevents = array_count(stack_iocp_events);
  }

  /* Compute the timeout for GetQueuedCompletionStatus, and the wait end
   * time, if the user specified a timeout other than zero or infinite.
   */
  if (timeout > 0) {
    due = GetTickCount64() + timeout;
    gqcs_timeout = (DWORD) timeout;
  } else if (timeout == 0) {
    gqcs_timeout = 0;
  } else {
    gqcs_timeout = INFINITE;
  }

  EnterCriticalSection(&port_info->lock);

  /* Dequeue completion packets until either at least one interesting event
   * has been discovered, or the timeout is reached.
   */
  for (;;) {
    ULONGLONG now;

    result =
        _ep_port_poll(port_info, events, iocp_events, maxevents, gqcs_timeout);
    if (result < 0 || result > 0)
      break; /* Result, error, or time-out. */

    if (timeout < 0)
      continue; /* When timeout is negative, never time out. */

    /* Update time. */
    now = GetTickCount64();

    /* Do not allow the due time to be in the past. */
    if (now >= due) {
      SetLastError(WAIT_TIMEOUT);
      break;
    }

    /* Recompute time-out argument for GetQueuedCompletionStatus. */
    gqcs_timeout = (DWORD)(due - now);
  }

  _ep_port_update_events_if_polling(port_info);

  LeaveCriticalSection(&port_info->lock);

  if (iocp_events != stack_iocp_events)
    free(iocp_events);

  if (result >= 0)
    return result;
  else if (GetLastError() == WAIT_TIMEOUT)
    return 0;
  else
    return -1;
}

static int _ep_port_ctl_add(ep_port_t* port_info,
                            SOCKET sock,
                            struct epoll_event* ev) {
  ep_sock_t* sock_info = ep_sock_new(port_info, sock);
  if (sock_info == NULL)
    return -1;

  if (ep_sock_set_event(port_info, sock_info, ev) < 0) {
    ep_sock_delete(port_info, sock_info);
    return -1;
  }

  _ep_port_update_events_if_polling(port_info);

  return 0;
}

static int _ep_port_ctl_mod(ep_port_t* port_info,
                            SOCKET sock,
                            struct epoll_event* ev) {
  ep_sock_t* sock_info = ep_port_find_socket(port_info, sock);
  if (sock_info == NULL)
    return -1;

  if (ep_sock_set_event(port_info, sock_info, ev) < 0)
    return -1;

  _ep_port_update_events_if_polling(port_info);

  return 0;
}

static int _ep_port_ctl_del(ep_port_t* port_info, SOCKET sock) {
  ep_sock_t* sock_info = ep_port_find_socket(port_info, sock);
  if (sock_info == NULL)
    return -1;

  ep_sock_delete(port_info, sock_info);

  return 0;
}

static int _ep_port_ctl_op(ep_port_t* port_info,
                           int op,
                           SOCKET sock,
                           struct epoll_event* ev) {
  switch (op) {
    case EPOLL_CTL_ADD:
      return _ep_port_ctl_add(port_info, sock, ev);
    case EPOLL_CTL_MOD:
      return _ep_port_ctl_mod(port_info, sock, ev);
    case EPOLL_CTL_DEL:
      return _ep_port_ctl_del(port_info, sock);
    default:
      return_error(-1, ERROR_INVALID_PARAMETER);
  }
}

int ep_port_ctl(ep_port_t* port_info,
                int op,
                SOCKET sock,
                struct epoll_event* ev) {
  int result;

  EnterCriticalSection(&port_info->lock);
  result = _ep_port_ctl_op(port_info, op, sock, ev);
  LeaveCriticalSection(&port_info->lock);

  return result;
}

int ep_port_register_socket_handle(ep_port_t* port_info,
                                   ep_sock_t* sock_info,
                                   SOCKET socket) {
  if (tree_add(&port_info->sock_tree, &sock_info->tree_node, socket) < 0)
    return_error(-1, ERROR_ALREADY_EXISTS);
  return 0;
}

void ep_port_unregister_socket_handle(ep_port_t* port_info,
                                      ep_sock_t* sock_info) {
  tree_del(&port_info->sock_tree, &sock_info->tree_node);
}

ep_sock_t* ep_port_find_socket(ep_port_t* port_info, SOCKET socket) {
  ep_sock_t* sock_info = safe_container_of(
      tree_find(&port_info->sock_tree, socket), ep_sock_t, tree_node);
  if (sock_info == NULL)
    return_error(NULL, ERROR_NOT_FOUND);
  return sock_info;
}

void ep_port_request_socket_update(ep_port_t* port_info,
                                   ep_sock_t* sock_info) {
  if (queue_enqueued(&sock_info->queue_node))
    return;
  queue_append(&port_info->sock_update_queue, &sock_info->queue_node);
}

void ep_port_cancel_socket_update(ep_port_t* port_info, ep_sock_t* sock_info) {
  unused_var(port_info);
  if (!queue_enqueued(&sock_info->queue_node))
    return;
  queue_remove(&sock_info->queue_node);
}

void ep_port_add_deleted_socket(ep_port_t* port_info, ep_sock_t* sock_info) {
  if (queue_enqueued(&sock_info->queue_node))
    return;
  queue_append(&port_info->sock_deleted_queue, &sock_info->queue_node);
}

void ep_port_remove_deleted_socket(ep_port_t* port_info,
                                   ep_sock_t* sock_info) {
  unused_var(port_info);
  if (!queue_enqueued(&sock_info->queue_node))
    return;
  queue_remove(&sock_info->queue_node);
}

void queue_init(queue_t* queue) {
  queue_node_init(&queue->head);
}

void queue_node_init(queue_node_t* node) {
  node->prev = node;
  node->next = node;
}

static inline void _queue_detach(queue_node_t* node) {
  node->prev->next = node->next;
  node->next->prev = node->prev;
}

queue_node_t* queue_first(const queue_t* queue) {
  return !queue_empty(queue) ? queue->head.next : NULL;
}

queue_node_t* queue_last(const queue_t* queue) {
  return !queue_empty(queue) ? queue->head.prev : NULL;
}

void queue_prepend(queue_t* queue, queue_node_t* node) {
  node->next = queue->head.next;
  node->prev = &queue->head;
  node->next->prev = node;
  queue->head.next = node;
}

void queue_append(queue_t* queue, queue_node_t* node) {
  node->next = &queue->head;
  node->prev = queue->head.prev;
  node->prev->next = node;
  queue->head.prev = node;
}

void queue_move_first(queue_t* queue, queue_node_t* node) {
  _queue_detach(node);
  queue_prepend(queue, node);
}

void queue_move_last(queue_t* queue, queue_node_t* node) {
  _queue_detach(node);
  queue_append(queue, node);
}

void queue_remove(queue_node_t* node) {
  _queue_detach(node);
  queue_node_init(node);
}

bool queue_empty(const queue_t* queue) {
  return !queue_enqueued(&queue->head);
}

bool queue_enqueued(const queue_node_t* node) {
  return node->prev != node;
}

void reflock_tree_init(reflock_tree_t* rlt) {
  tree_init(&rlt->tree);
  InitializeSRWLock(&rlt->lock);
}

void reflock_tree_node_init(reflock_tree_node_t* node) {
  tree_node_init(&node->tree_node);
  reflock_init(&node->reflock);
}

int reflock_tree_add(reflock_tree_t* rlt,
                     reflock_tree_node_t* node,
                     uintptr_t key) {
  int r;

  AcquireSRWLockExclusive(&rlt->lock);
  r = tree_add(&rlt->tree, &node->tree_node, key);
  ReleaseSRWLockExclusive(&rlt->lock);

  return r;
}

reflock_tree_node_t* reflock_tree_del_and_ref(reflock_tree_t* rlt,
                                              uintptr_t key) {
  tree_node_t* tree_node;
  reflock_tree_node_t* rlt_node;

  AcquireSRWLockExclusive(&rlt->lock);

  tree_node = tree_find(&rlt->tree, key);
  rlt_node = safe_container_of(tree_node, reflock_tree_node_t, tree_node);

  if (rlt_node != NULL) {
    tree_del(&rlt->tree, tree_node);
    reflock_ref(&rlt_node->reflock);
  }

  ReleaseSRWLockExclusive(&rlt->lock);

  return rlt_node;
}

reflock_tree_node_t* reflock_tree_find_and_ref(reflock_tree_t* rlt,
                                               uintptr_t key) {
  tree_node_t* tree_node;
  reflock_tree_node_t* rlt_node;

  AcquireSRWLockShared(&rlt->lock);

  tree_node = tree_find(&rlt->tree, key);
  rlt_node = safe_container_of(tree_node, reflock_tree_node_t, tree_node);
  if (rlt_node != NULL)
    reflock_ref(&rlt_node->reflock);

  ReleaseSRWLockShared(&rlt->lock);

  return rlt_node;
}

void reflock_tree_node_unref(reflock_tree_node_t* node) {
  reflock_unref(&node->reflock);
}

void reflock_tree_node_unref_and_destroy(reflock_tree_node_t* node) {
  reflock_unref_and_destroy(&node->reflock);
}

/* clang-format off */
static const uint32_t _REF          = 0x00000001;
static const uint32_t _REF_MASK     = 0x0fffffff;
static const uint32_t _DESTROY      = 0x10000000;
static const uint32_t _DESTROY_MASK = 0xf0000000;
static const uint32_t _POISON       = 0x300DEAD0;
/* clang-format on */

static HANDLE _keyed_event = NULL;

int reflock_global_init(void) {
  NTSTATUS status =
      NtCreateKeyedEvent(&_keyed_event, ~(ACCESS_MASK) 0, NULL, 0);
  if (status != STATUS_SUCCESS)
    return_error(-1, RtlNtStatusToDosError(status));
  return 0;
}

void reflock_init(reflock_t* reflock) {
  reflock->state = 0;
}

static void _signal_event(const void* address) {
  NTSTATUS status =
      NtReleaseKeyedEvent(_keyed_event, (PVOID) address, FALSE, NULL);
  if (status != STATUS_SUCCESS)
    abort();
}

static void _await_event(const void* address) {
  NTSTATUS status =
      NtWaitForKeyedEvent(_keyed_event, (PVOID) address, FALSE, NULL);
  if (status != STATUS_SUCCESS)
    abort();
}

static inline uint32_t _sync_add_and_fetch(volatile uint32_t* target,
                                           uint32_t value) {
  static_assert(sizeof(*target) == sizeof(long), "");
  return InterlockedAdd((volatile long*) target, value);
}

static inline uint32_t _sync_fetch_and_set(volatile uint32_t* target,
                                           uint32_t value) {
  static_assert(sizeof(*target) == sizeof(long), "");
  return InterlockedExchange((volatile long*) target, value);
}

void reflock_ref(reflock_t* reflock) {
  uint32_t state = _sync_add_and_fetch(&reflock->state, _REF);
  unused_var(state);
  assert((state & _DESTROY_MASK) == 0); /* Overflow or destroyed. */
}

void reflock_unref(reflock_t* reflock) {
  uint32_t state = _sync_add_and_fetch(&reflock->state, -(int32_t) _REF);
  uint32_t ref_count = state & _REF_MASK;
  uint32_t destroy = state & _DESTROY_MASK;

  unused_var(ref_count);
  unused_var(destroy);

  if (state == _DESTROY)
    _signal_event(reflock);
  else
    assert(destroy == 0 || ref_count > 0);
}

void reflock_unref_and_destroy(reflock_t* reflock) {
  uint32_t state = _sync_add_and_fetch(&reflock->state, _DESTROY - _REF);
  uint32_t ref_count = state & _REF_MASK;

  assert((state & _DESTROY_MASK) ==
         _DESTROY); /* Underflow or already destroyed. */

  if (ref_count != 0)
    _await_event(reflock);

  state = _sync_fetch_and_set(&reflock->state, _POISON);
  assert(state == _DESTROY);
}

#define _KNOWN_EPOLL_EVENTS                                            \
  (EPOLLIN | EPOLLPRI | EPOLLOUT | EPOLLERR | EPOLLHUP | EPOLLRDNORM | \
   EPOLLRDBAND | EPOLLWRNORM | EPOLLWRBAND | EPOLLRDHUP)

typedef struct _poll_req {
  OVERLAPPED overlapped;
  AFD_POLL_INFO poll_info;
} _poll_req_t;

typedef enum _poll_status {
  _POLL_IDLE = 0,
  _POLL_PENDING,
  _POLL_CANCELLED
} _poll_status_t;

typedef struct _ep_sock_private {
  ep_sock_t pub;
  _poll_req_t poll_req;
  poll_group_t* poll_group;
  SOCKET base_socket;
  epoll_data_t user_data;
  uint32_t user_events;
  uint32_t pending_events;
  _poll_status_t poll_status;
  bool delete_pending;
} _ep_sock_private_t;

static DWORD _epoll_events_to_afd_events(uint32_t epoll_events) {
  /* Always monitor for AFD_POLL_LOCAL_CLOSE, which is triggered when the
   * socket is closed with closesocket() or CloseHandle(). */
  DWORD afd_events = AFD_POLL_LOCAL_CLOSE;

  if (epoll_events & (EPOLLIN | EPOLLRDNORM))
    afd_events |= AFD_POLL_RECEIVE | AFD_POLL_ACCEPT;
  if (epoll_events & (EPOLLPRI | EPOLLRDBAND))
    afd_events |= AFD_POLL_RECEIVE_EXPEDITED;
  if (epoll_events & (EPOLLOUT | EPOLLWRNORM | EPOLLWRBAND))
    afd_events |= AFD_POLL_SEND | AFD_POLL_CONNECT;
  if (epoll_events & (EPOLLIN | EPOLLRDNORM | EPOLLRDHUP))
    afd_events |= AFD_POLL_DISCONNECT;
  if (epoll_events & EPOLLHUP)
    afd_events |= AFD_POLL_ABORT;
  if (epoll_events & EPOLLERR)
    afd_events |= AFD_POLL_CONNECT_FAIL;

  return afd_events;
}

static uint32_t _afd_events_to_epoll_events(DWORD afd_events) {
  uint32_t epoll_events = 0;

  if (afd_events & (AFD_POLL_RECEIVE | AFD_POLL_ACCEPT))
    epoll_events |= EPOLLIN | EPOLLRDNORM;
  if (afd_events & AFD_POLL_RECEIVE_EXPEDITED)
    epoll_events |= EPOLLPRI | EPOLLRDBAND;
  if (afd_events & (AFD_POLL_SEND | AFD_POLL_CONNECT))
    epoll_events |= EPOLLOUT | EPOLLWRNORM | EPOLLWRBAND;
  if (afd_events & AFD_POLL_DISCONNECT)
    epoll_events |= EPOLLIN | EPOLLRDNORM | EPOLLRDHUP;
  if (afd_events & AFD_POLL_ABORT)
    epoll_events |= EPOLLHUP;
  if (afd_events & AFD_POLL_CONNECT_FAIL)
    epoll_events |= EPOLLERR;

  return epoll_events;
}

static int _poll_req_submit(_poll_req_t* poll_req,
                            uint32_t epoll_events,
                            SOCKET socket,
                            SOCKET driver_socket) {
  int r;

  memset(&poll_req->overlapped, 0, sizeof poll_req->overlapped);

  poll_req->poll_info.Exclusive = FALSE;
  poll_req->poll_info.NumberOfHandles = 1;
  poll_req->poll_info.Timeout.QuadPart = INT64_MAX;
  poll_req->poll_info.Handles[0].Handle = (HANDLE) socket;
  poll_req->poll_info.Handles[0].Status = 0;
  poll_req->poll_info.Handles[0].Events =
      _epoll_events_to_afd_events(epoll_events);

  r = afd_poll(driver_socket, &poll_req->poll_info, &poll_req->overlapped);
  if (r != 0 && GetLastError() != ERROR_IO_PENDING)
    return_error(-1);

  return 0;
}

static int _poll_req_cancel(_poll_req_t* poll_req, SOCKET driver_socket) {
  OVERLAPPED* overlapped = &poll_req->overlapped;

  if (!CancelIoEx((HANDLE) driver_socket, overlapped)) {
    DWORD error = GetLastError();
    if (error == ERROR_NOT_FOUND)
      return 0; /* Already completed or canceled. */
    else
      return_error(-1);
  }

  return 0;
}

static void _poll_req_complete(const _poll_req_t* poll_req,
                               uint32_t* epoll_events_out,
                               bool* socket_closed_out) {
  const OVERLAPPED* overlapped = &poll_req->overlapped;

  uint32_t epoll_events = 0;
  bool socket_closed = false;

  if ((NTSTATUS) overlapped->Internal == STATUS_CANCELLED) {
    /* The poll request was cancelled by CancelIoEx. */
  } else if (!NT_SUCCESS(overlapped->Internal)) {
    /* The overlapped request itself failed in an unexpected way. */
    epoll_events = EPOLLERR;
  } else if (poll_req->poll_info.NumberOfHandles < 1) {
    /* This overlapped request succeeded but didn't report any events. */
  } else {
    /* Events related to our socket were reported. */
    DWORD afd_events = poll_req->poll_info.Handles[0].Events;

    if (afd_events & AFD_POLL_LOCAL_CLOSE)
      socket_closed = true; /* Socket closed locally be silently dropped. */
    else
      epoll_events = _afd_events_to_epoll_events(afd_events);
  }

  *epoll_events_out = epoll_events;
  *socket_closed_out = socket_closed;
}

static inline _ep_sock_private_t* _ep_sock_private(ep_sock_t* sock_info) {
  return container_of(sock_info, _ep_sock_private_t, pub);
}

static inline _ep_sock_private_t* _ep_sock_alloc(void) {
  _ep_sock_private_t* sock_private = malloc(sizeof *sock_private);
  if (sock_private == NULL)
    return_error(NULL, ERROR_NOT_ENOUGH_MEMORY);
  return sock_private;
}

static inline void _ep_sock_free(_ep_sock_private_t* sock_private) {
  free(sock_private);
}

static int _ep_sock_cancel_poll(_ep_sock_private_t* sock_private) {
  assert(sock_private->poll_status == _POLL_PENDING);

  if (_poll_req_cancel(&sock_private->poll_req,
                       poll_group_get_socket(sock_private->poll_group)) < 0)
    return -1;

  sock_private->poll_status = _POLL_CANCELLED;
  sock_private->pending_events = 0;

  return 0;
}

ep_sock_t* ep_sock_new(ep_port_t* port_info, SOCKET socket) {
  SOCKET base_socket;
  poll_group_t* poll_group;
  _ep_sock_private_t* sock_private;

  if (socket == 0 || socket == INVALID_SOCKET)
    return_error(NULL, ERROR_INVALID_HANDLE);

  base_socket = ws_get_base_socket(socket);
  if (base_socket == INVALID_SOCKET)
    return NULL;

  poll_group = poll_group_acquire(port_info);
  if (poll_group == NULL)
    return NULL;

  sock_private = _ep_sock_alloc();
  if (sock_private == NULL)
    goto err1;

  memset(sock_private, 0, sizeof *sock_private);

  sock_private->base_socket = base_socket;
  sock_private->poll_group = poll_group;

  tree_node_init(&sock_private->pub.tree_node);
  queue_node_init(&sock_private->pub.queue_node);

  if (ep_port_register_socket_handle(port_info, &sock_private->pub, socket) <
      0)
    goto err2;

  return &sock_private->pub;

err2:
  _ep_sock_free(sock_private);
err1:
  poll_group_release(poll_group);

  return NULL;
}

static void _ep_sock_delete(ep_port_t* port_info,
                            ep_sock_t* sock_info,
                            bool force) {
  _ep_sock_private_t* sock_private = _ep_sock_private(sock_info);

  if (!sock_private->delete_pending) {
    if (sock_private->poll_status == _POLL_PENDING)
      _ep_sock_cancel_poll(sock_private);

    ep_port_cancel_socket_update(port_info, sock_info);
    ep_port_unregister_socket_handle(port_info, sock_info);

    sock_private->delete_pending = true;
  }

  /* If the poll request still needs to complete, the ep_sock object can't
   * be free()d yet. `ep_sock_feed_event()` or `ep_port_close()` will take care
   * of this later. */
  if (force || sock_private->poll_status == _POLL_IDLE) {
    /* Free the sock_info now. */
    ep_port_remove_deleted_socket(port_info, sock_info);
    poll_group_release(sock_private->poll_group);
    _ep_sock_free(sock_private);
  } else {
    /* Free the socket later. */
    ep_port_add_deleted_socket(port_info, sock_info);
  }
}

void ep_sock_delete(ep_port_t* port_info, ep_sock_t* sock_info) {
  _ep_sock_delete(port_info, sock_info, false);
}

void ep_sock_force_delete(ep_port_t* port_info, ep_sock_t* sock_info) {
  _ep_sock_delete(port_info, sock_info, true);
}

int ep_sock_set_event(ep_port_t* port_info,
                      ep_sock_t* sock_info,
                      const struct epoll_event* ev) {
  _ep_sock_private_t* sock_private = _ep_sock_private(sock_info);

  /* EPOLLERR and EPOLLHUP are always reported, even when not requested by the
   * caller. However they are disabled after a event has been reported for a
   * socket for which the EPOLLONESHOT flag as set. */
  uint32_t events = ev->events | EPOLLERR | EPOLLHUP;

  sock_private->user_events = events;
  sock_private->user_data = ev->data;

  if ((events & _KNOWN_EPOLL_EVENTS & ~sock_private->pending_events) != 0)
    ep_port_request_socket_update(port_info, sock_info);

  return 0;
}

int ep_sock_update(ep_port_t* port_info, ep_sock_t* sock_info) {
  _ep_sock_private_t* sock_private = _ep_sock_private(sock_info);
  bool socket_closed = false;

  assert(!sock_private->delete_pending);
  if ((sock_private->poll_status == _POLL_PENDING) &&
      (sock_private->user_events & _KNOWN_EPOLL_EVENTS &
       ~sock_private->pending_events) == 0) {
    /* All the events the user is interested in are already being monitored
     * by the pending poll request. It might spuriously complete because of an
     * event that we're no longer interested in; if that happens we just
     * submit another poll request with the right event mask. */

  } else if (sock_private->poll_status == _POLL_PENDING) {
    /* A poll request is already pending, but it's not monitoring for all the
     * events that the user is interested in. Cancel the pending poll request;
     * when it completes it will be submitted again with the correct event
     * mask. */
    if (_ep_sock_cancel_poll(sock_private) < 0)
      return -1;

  } else if (sock_private->poll_status == _POLL_CANCELLED) {
    /* The poll request has already been cancelled, we're still waiting for it
     * to return. For now, there's nothing that needs to be done. */

  } else if (sock_private->poll_status == _POLL_IDLE) {
    SOCKET driver_socket = poll_group_get_socket(sock_private->poll_group);

    if (_poll_req_submit(&sock_private->poll_req,
                         sock_private->user_events,
                         sock_private->base_socket,
                         driver_socket) < 0) {
      if (GetLastError() == ERROR_INVALID_HANDLE)
        /* The socket is broken. It will be dropped from the epoll set. */
        socket_closed = true;
      else
        /* Another error occurred, which is propagated to the caller. */
        return -1;

    } else {
      /* The poll request was successfully submitted. */
      sock_private->poll_status = _POLL_PENDING;
      sock_private->pending_events = sock_private->user_events;
    }
  } else {
    /* Unreachable. */
    assert(false);
  }

  ep_port_cancel_socket_update(port_info, sock_info);

  /* If we saw an ERROR_INVALID_HANDLE error, drop the socket. */
  if (socket_closed)
    ep_sock_delete(port_info, sock_info);

  return 0;
}

int ep_sock_feed_event(ep_port_t* port_info,
                       OVERLAPPED* overlapped,
                       struct epoll_event* ev) {
  _ep_sock_private_t* sock_private =
      container_of(overlapped, _ep_sock_private_t, poll_req.overlapped);
  ep_sock_t* sock_info = &sock_private->pub;
  uint32_t epoll_events;
  bool socket_closed;
  int ev_count = 0;

  sock_private->poll_status = _POLL_IDLE;
  sock_private->pending_events = 0;

  if (sock_private->delete_pending) {
    /* Ignore completion for overlapped poll operation if the socket is pending
     * deletion; instead, delete the socket. */
    ep_sock_delete(port_info, sock_info);
    return 0;
  }

  _poll_req_complete(&sock_private->poll_req, &epoll_events, &socket_closed);

  /* Filter events that the user didn't ask for. */
  epoll_events &= sock_private->user_events;

  /* Clear the event mask if EPOLLONESHOT is set and there are any events
   * to report. */
  if (epoll_events != 0 && (sock_private->user_events & EPOLLONESHOT))
    sock_private->user_events = 0;

  /* Fill the ev structure if there are any events to report. */
  if (epoll_events != 0) {
    ev->data = sock_private->user_data;
    ev->events = epoll_events;
    ev_count = 1;
  }

  if (socket_closed)
    /* Drop the socket from the epoll set. */
    ep_sock_delete(port_info, sock_info);
  else
    /* Put the socket back onto the attention list so a new poll request will
     * be submitted. */
    ep_port_request_socket_update(port_info, sock_info);

  return ev_count;
}

#include <string.h>

void tree_init(tree_t* tree) {
  memset(tree, 0, sizeof *tree);
}

void tree_node_init(tree_node_t* node) {
  memset(node, 0, sizeof *node);
}

#define _tree_rotate(cis, trans, tree, node) \
  do {                                       \
    tree_node_t* p = node;                   \
    tree_node_t* q = node->trans;            \
    tree_node_t* parent1 = p->parent;        \
                                             \
    if (parent1) {                           \
      if (parent1->left == p)                \
        parent1->left = q;                   \
      else                                   \
        parent1->right = q;                  \
    } else {                                 \
      tree->root = q;                        \
    }                                        \
                                             \
    q->parent = parent1;                     \
    p->parent = q;                           \
    p->trans = q->cis;                       \
    if (p->trans)                            \
      p->trans->parent = p;                  \
    q->cis = p;                              \
  } while (0)

#define _tree_add_insert_or_descend(side, parent, node) \
  if (parent->side) {                                   \
    parent = parent->side;                              \
  } else {                                              \
    parent->side = node;                                \
    break;                                              \
  }

#define _tree_add_fixup(cis, trans, tree, parent, node) \
  tree_node_t* grandparent = parent->parent;            \
  tree_node_t* uncle = grandparent->trans;              \
                                                        \
  if (uncle && uncle->red) {                            \
    parent->red = uncle->red = false;                   \
    grandparent->red = true;                            \
    node = grandparent;                                 \
  } else {                                              \
    if (node == parent->trans) {                        \
      _tree_rotate(cis, trans, tree, parent);           \
      node = parent;                                    \
      parent = node->parent;                            \
    }                                                   \
    parent->red = false;                                \
    grandparent->red = true;                            \
    _tree_rotate(trans, cis, tree, grandparent);        \
  }

int tree_add(tree_t* tree, tree_node_t* node, uintptr_t key) {
  tree_node_t* parent;

  parent = tree->root;
  if (parent) {
    for (;;) {
      if (key < parent->key) {
        _tree_add_insert_or_descend(left, parent, node);
      } else if (key > parent->key) {
        _tree_add_insert_or_descend(right, parent, node);
      } else {
        return -1;
      }
    }
  } else {
    tree->root = node;
  }

  node->key = key;
  node->left = node->right = NULL;
  node->parent = parent;
  node->red = true;

  for (; parent && parent->red; parent = node->parent) {
    if (parent == parent->parent->left) {
      _tree_add_fixup(left, right, tree, parent, node);
    } else {
      _tree_add_fixup(right, left, tree, parent, node);
    }
  }
  tree->root->red = false;

  return 0;
}

#define _tree_del_fixup(cis, trans, tree, node)    \
  tree_node_t* sibling = parent->trans;            \
                                                   \
  if (sibling->red) {                              \
    sibling->red = false;                          \
    parent->red = true;                            \
    _tree_rotate(cis, trans, tree, parent);        \
    sibling = parent->trans;                       \
  }                                                \
  if ((sibling->left && sibling->left->red) ||     \
      (sibling->right && sibling->right->red)) {   \
    if (!sibling->trans || !sibling->trans->red) { \
      sibling->cis->red = false;                   \
      sibling->red = true;                         \
      _tree_rotate(trans, cis, tree, sibling);     \
      sibling = parent->trans;                     \
    }                                              \
    sibling->red = parent->red;                    \
    parent->red = sibling->trans->red = false;     \
    _tree_rotate(cis, trans, tree, parent);        \
    node = tree->root;                             \
    break;                                         \
  }                                                \
  sibling->red = true;

void tree_del(tree_t* tree, tree_node_t* node) {
  tree_node_t* parent = node->parent;
  tree_node_t* left = node->left;
  tree_node_t* right = node->right;
  tree_node_t* next;
  bool red;

  if (!left) {
    next = right;
  } else if (!right) {
    next = left;
  } else {
    next = right;
    while (next->left)
      next = next->left;
  }

  if (parent) {
    if (parent->left == node)
      parent->left = next;
    else
      parent->right = next;
  } else {
    tree->root = next;
  }

  if (left && right) {
    red = next->red;
    next->red = node->red;
    next->left = left;
    left->parent = next;
    if (next != right) {
      parent = next->parent;
      next->parent = node->parent;
      node = next->right;
      parent->left = node;
      next->right = right;
      right->parent = next;
    } else {
      next->parent = parent;
      parent = next;
      node = next->right;
    }
  } else {
    red = node->red;
    node = next;
  }

  if (node)
    node->parent = parent;
  if (red)
    return;
  if (node && node->red) {
    node->red = false;
    return;
  }

  do {
    if (node == tree->root)
      break;
    if (node == parent->left) {
      _tree_del_fixup(left, right, tree, node);
    } else {
      _tree_del_fixup(right, left, tree, node);
    }
    node = parent;
    parent = parent->parent;
  } while (!node->red);

  if (node)
    node->red = false;
}

tree_node_t* tree_find(const tree_t* tree, uintptr_t key) {
  tree_node_t* node = tree->root;
  while (node) {
    if (key < node->key)
      node = node->left;
    else if (key > node->key)
      node = node->right;
    else
      return node;
  }
  return NULL;
}

tree_node_t* tree_root(const tree_t* tree) {
  return tree->root;
}

void* util_safe_container_of_helper(void* ptr, size_t offset) {
  if (ptr == NULL)
    return NULL;
  else
    return (char*) ptr - offset;
}

#ifndef SIO_BASE_HANDLE
#define SIO_BASE_HANDLE 0x48000022
#endif

#define _WS_INITIAL_CATALOG_BUFFER_SIZE 0x4000 /* 16kb. */

int ws_global_init(void) {
  int r;
  WSADATA wsa_data;

  r = WSAStartup(MAKEWORD(2, 2), &wsa_data);
  if (r != 0)
    return_error(-1, r);

  return 0;
}

SOCKET ws_get_base_socket(SOCKET socket) {
  SOCKET base_socket;
  DWORD bytes;

  if (WSAIoctl(socket,
               SIO_BASE_HANDLE,
               NULL,
               0,
               &base_socket,
               sizeof base_socket,
               &bytes,
               NULL,
               NULL) == SOCKET_ERROR)
    return_error(INVALID_SOCKET);

  return base_socket;
}

/* Retrieves a copy of the winsock catalog.
 * The infos pointer must be released by the caller with free().
 */
ssize_t ws_get_protocol_catalog(WSAPROTOCOL_INFOW** infos_out) {
  DWORD buffer_size = _WS_INITIAL_CATALOG_BUFFER_SIZE;
  int count;
  WSAPROTOCOL_INFOW* infos;

  for (;;) {
    infos = malloc(buffer_size);
    if (infos == NULL)
      return_error(-1, ERROR_NOT_ENOUGH_MEMORY);

    count = WSAEnumProtocolsW(NULL, infos, &buffer_size);
    if (count == SOCKET_ERROR) {
      free(infos);
      if (WSAGetLastError() == WSAENOBUFS)
        continue; /* Try again with bigger buffer size. */
      else
        return_error(-1);
    }

    *infos_out = infos;
    return count;
  }
}
