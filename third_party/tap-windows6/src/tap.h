/*
 *  TAP-Windows -- A kernel driver to provide virtual tap
 *                 device functionality on Windows.
 *
 *  This code was inspired by the CIPE-Win32 driver by Damion K. Wilson.
 *
 *  This source code is Copyright (C) 2002-2014 OpenVPN Technologies, Inc.,
 *  and is released under the GPL version 2 (see below).
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License version 2
 *  as published by the Free Software Foundation.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program (see the file COPYING included with this
 *  distribution); if not, write to the Free Software Foundation, Inc.,
 *  59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */
#ifndef __TAP_H
#define __TAP_H

#include <ndis.h>
#include <netioapi.h>
#include <ntifs.h>
#include <ntstrsafe.h>

#include "adapter.h"
#include "config.h"
#include "constants.h"
#include "device.h"
#include "dhcp.h"
#include "endian.h"
#include "error.h"
#include "lock.h"
#include "macinfo.h"
#include "mem.h"
#include "proto.h"
#include "prototypes.h"
#include "tap-windows.h"
#include "types.h"

//========================================================
// Check for truncated IPv4 packets, log errors if found.
//========================================================
#define PACKET_TRUNCATION_CHECK 0

//========================================================
// EXPERIMENTAL -- Configure TAP device object to be
// accessible from non-administrative accounts, based
// on an advanced properties setting.
//
// Duplicates the functionality of OpenVPN's
// --allow-nonadmin directive.
//========================================================
#define ENABLE_NONADMIN 1

//
// The driver has exactly one instance of the TAP_GLOBAL structure.  NDIS keeps
// an opaque handle to this data, (it doesn't attempt to read or interpret this
// data), and it passes the handle back to the miniport in MiniportSetOptions
// and MiniportInitializeEx.
//
typedef struct _TAP_GLOBAL {
  LIST_ENTRY AdapterList;

  NDIS_RW_LOCK Lock;

  NDIS_HANDLE NdisDriverHandle;  // From NdisMRegisterMiniportDriver

} TAP_GLOBAL, *PTAP_GLOBAL;

// Global data
extern TAP_GLOBAL GlobalData;

#endif  // __TAP_H
