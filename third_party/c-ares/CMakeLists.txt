CMAKE_MINIMUM_REQUIRED (VERSION 2.8.12)

# Fix for CMake policy warning when building with CMake >= 3.0.
# TODO: remove this fix once minimum version is updated to 3.0 or newer.
IF (NOT CMAKE_VERSION VERSION_LESS 3.0)
	CMAKE_POLICY (SET CMP0048 NEW)
ENDIF ()

INCLUDE (CheckIncludeFiles)
INCLUDE (CheckTypeSize)
INCLUDE (CheckFunctionExists)
INCLUDE (CheckSymbolExists)
INCLUDE (CheckCSourceCompiles)
INCLUDE (CheckStructHasMember)
INCLUDE (CheckLibraryExists)
INCLUDE (GNUInstallDirs)

PROJECT (c-ares C)

# This is for libtool compatibility, and specified in a form that is easily
# translatable from libtool (even if the actual form doesn't make sense).
# For instance, in an autotools project, in Makefile.am there is a line that
# contains something like:
#     -version-info 4:0:2
# This breaks down into sections of current:revision:age
# This then generates a version of  "(current-age).age.revision"  with an
# interface version of "(current-age)"
# For example, a version of 4:0:2 would generate output such as:
#    libname.so   -> libname.so.2
#    libname.so.2 -> libname.so.2.2.0
SET (CARES_LIB_VERSIONINFO "4:0:2")


OPTION (CARES_STATIC     "Build as a static library"                                             OFF)
OPTION (CARES_SHARED     "Build as a shared library"                                             ON)
OPTION (CARES_INSTALL    "Create installation targets (chain builders may want to disable this)" ON)
OPTION (CARES_STATIC_PIC "Build the static library as PIC (position independent)"                OFF)


# Keep build organized.
SET (CMAKE_RUNTIME_OUTPUT_DIRECTORY ${PROJECT_BINARY_DIR}/bin)
SET (CMAKE_LIBRARY_OUTPUT_DIRECTORY ${PROJECT_BINARY_DIR}/lib)
SET (CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${PROJECT_BINARY_DIR}/lib)
SET (PACKAGE_DIRECTORY ${PROJECT_BINARY_DIR}/package)

# Destinations for installing different kinds of targets (pass to install command).
SET (TARGETS_INST_DEST
	RUNTIME DESTINATION  ${CMAKE_INSTALL_BINDIR}
	LIBRARY DESTINATION  ${CMAKE_INSTALL_LIBDIR}
	ARCHIVE DESTINATION  ${CMAKE_INSTALL_LIBDIR}
	INCLUDES DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}
)

# Look for dependent/required libraries
CHECK_LIBRARY_EXISTS (resolv res_servicename "" HAVE_RES_SERVICENAME_IN_LIBRESOLV)
IF (HAVE_RES_SERVICENAME_IN_LIBRESOLV)
	SET (HAVE_LIBRESOLV 1)
ENDIF ()

IF (APPLE)
	CHECK_C_SOURCE_COMPILES ("
	#include <stdio.h>
	#include <TargetConditionals.h>
	int main() {
#if TARGET_OS_IPHONE == 0
#error Not an iPhone target
#endif
return 0;
	}
	"
	IOS)

	CHECK_C_SOURCE_COMPILES ("
#include <stdio.h>
#include <TargetConditionals.h>
	int main() {
#if TARGET_OS_IPHONE == 0 || __IPHONE_OS_VERSION_MIN_REQUIRED < 100000
#  error Not iOS v10
#endif
return 0;
	}
	"
	IOS_V10)

	CHECK_C_SOURCE_COMPILES ("
#include <stdio.h>
#include <AvailabilityMacros.h>
#ifndef MAC_OS_X_VERSION_10_12
#  define MAC_OS_X_VERSION_10_12 101200
#endif
	int main() {
#if MAC_OS_X_VERSION_MIN_REQUIRED < MAC_OS_X_VERSION_10_12
#  error Not MacOSX 10.12 or higher
#endif
return 0;
	}
	"
	MACOS_V1012)
ENDIF ()

IF (IOS AND HAVE_LIBRESOLV)
	SET (CARES_USE_LIBRESOLV 1)
ENDIF()

CHECK_LIBRARY_EXISTS (nsl gethostbyname "" HAVE_LIBNSL)
CHECK_LIBRARY_EXISTS (socket gethostbyname "" HAVE_LIBSOCKET)
IF (NOT HAVE_LIBSOCKET)
	CHECK_LIBRARY_EXISTS (socket socket "" HAVE_LIBSOCKET)
ENDIF ()
CHECK_LIBRARY_EXISTS (rt clock_gettime "" HAVE_LIBRT)


# Look for necessary includes
CHECK_INCLUDE_FILES (sys/types.h           HAVE_SYS_TYPES_H)
CHECK_INCLUDE_FILES (sys/socket.h          HAVE_SYS_SOCKET_H)
CHECK_INCLUDE_FILES (arpa/inet.h           HAVE_ARPA_INET_H)
CHECK_INCLUDE_FILES (arpa/nameser_compat.h HAVE_ARPA_NAMESER_COMPAT_H)
CHECK_INCLUDE_FILES (arpa/nameser.h        HAVE_ARPA_NAMESER_H)
CHECK_INCLUDE_FILES (assert.h              HAVE_ASSERT_H)
CHECK_INCLUDE_FILES (errno.h               HAVE_ERRNO_H)
CHECK_INCLUDE_FILES (fcntl.h               HAVE_FCNTL_H)
CHECK_INCLUDE_FILES (inttypes.h            HAVE_INTTYPES_H)
CHECK_INCLUDE_FILES (limits.h              HAVE_LIMITS_H)
CHECK_INCLUDE_FILES (malloc.h              HAVE_MALLOC_H)
CHECK_INCLUDE_FILES (memory.h              HAVE_MEMORY_H)
CHECK_INCLUDE_FILES (netdb.h               HAVE_NETDB_H)
CHECK_INCLUDE_FILES (netinet/in.h          HAVE_NETINET_IN_H)
CHECK_INCLUDE_FILES (netinet/tcp.h         HAVE_NETINET_TCP_H)
CHECK_INCLUDE_FILES (net/if.h              HAVE_NET_IF_H)
CHECK_INCLUDE_FILES (signal.h              HAVE_SIGNAL_H)
CHECK_INCLUDE_FILES (socket.h              HAVE_SOCKET_H)
CHECK_INCLUDE_FILES (stdbool.h             HAVE_STDBOOL_H)
CHECK_INCLUDE_FILES (stdint.h              HAVE_STDINT_H)
CHECK_INCLUDE_FILES (stdlib.h              HAVE_STDLIB_H)
CHECK_INCLUDE_FILES (strings.h             HAVE_STRINGS_H)
CHECK_INCLUDE_FILES (string.h              HAVE_STRING_H)
CHECK_INCLUDE_FILES (stropts.h             HAVE_STROPTS_H)
CHECK_INCLUDE_FILES (sys/ioctl.h           HAVE_SYS_IOCTL_H)
CHECK_INCLUDE_FILES (sys/param.h           HAVE_SYS_PARAM_H)
CHECK_INCLUDE_FILES (sys/select.h          HAVE_SYS_SELECT_H)
CHECK_INCLUDE_FILES (sys/socket.h          HAVE_SYS_SOCKET_H)
CHECK_INCLUDE_FILES (sys/stat.h            HAVE_SYS_STAT_H)
CHECK_INCLUDE_FILES (sys/time.h            HAVE_SYS_TIME_H)
CHECK_INCLUDE_FILES (sys/types.h           HAVE_SYS_TYPES_H)
CHECK_INCLUDE_FILES (sys/uio.h             HAVE_SYS_UIO_H)
CHECK_INCLUDE_FILES (time.h                HAVE_TIME_H)
CHECK_INCLUDE_FILES (dlfcn.h               HAVE_DLFCN_H)
CHECK_INCLUDE_FILES (unistd.h              HAVE_UNISTD_H)

# Include order matters for these windows files.
CHECK_INCLUDE_FILES ("winsock2.h;windows.h"            HAVE_WINSOCK2_H)
CHECK_INCLUDE_FILES ("winsock2.h;ws2tcpip.h;windows.h" HAVE_WS2TCPIP_H)
CHECK_INCLUDE_FILES ("winsock.h;windows.h"             HAVE_WINSOCK_H)
CHECK_INCLUDE_FILES (windows.h                         HAVE_WINDOWS_H)


# Set system-specific compiler flags
IF (CMAKE_SYSTEM_NAME STREQUAL "Darwin")
	LIST (APPEND SYSFLAGS -D_DARWIN_C_SOURCE)
ELSEIF (CMAKE_SYSTEM_NAME STREQUAL "Linux")
	LIST (APPEND SYSFLAGS -D_GNU_SOURCE -D_POSIX_C_SOURCE=199309L -D_XOPEN_SOURCE=600)
ELSEIF (CMAKE_SYSTEM_NAME STREQUAL "SunOS")
	LIST (APPEND SYSFLAGS -D__EXTENSIONS__ -D_REENTRANT -D_XOPEN_SOURCE=600)
ELSEIF (CMAKE_SYSTEM_NAME STREQUAL "AIX")
	LIST (APPEND SYSFLAGS -D_ALL_SOURCE -D_XOPEN_SOURCE=600)
ELSEIF (CMAKE_SYSTEM_NAME STREQUAL "FreeBSD")
	# Don't define _XOPEN_SOURCE on FreeBSD, it actually reduces visibility instead of increasing it
ELSEIF (WIN32)
	LIST (APPEND SYSFLAGS -DWIN32_LEAN_AND_MEAN -D_CRT_SECURE_NO_DEPRECATE -D_CRT_NONSTDC_NO_DEPRECATE -D_WIN32_WINNT=0x0600)
ENDIF ()
ADD_DEFINITIONS(${SYSFLAGS})



# Tell C-Ares about libraries to depend on
IF (HAVE_LIBRESOLV)
	LIST (APPEND CARES_DEPENDENT_LIBS resolv)
ENDIF ()
IF (HAVE_LIBNSL)
	LIST (APPEND CARES_DEPENDENT_LIBS nsl)
ENDIF ()
IF (HAVE_LIBSOCKET)
	LIST (APPEND CARES_DEPENDENT_LIBS socket)
ENDIF ()
IF (HAVE_LIBRT)
	LIST (APPEND CARES_DEPENDENT_LIBS rt)
ENDIF ()
IF (WIN32)
	LIST (APPEND CARES_DEPENDENT_LIBS ws2_32)
ENDIF ()


# When checking for symbols, we need to make sure we set the proper
# headers, libraries, and definitions for the detection to work properly
# CMAKE_REQUIRED_DEFINITIONS, CMAKE_REQUIRED_LIBRARIES, and
# CMAKE_EXTRA_INCLUDE_FILES.  When we're done with the detection, we'll
# unset them.

SET (CMAKE_REQUIRED_DEFINITIONS ${SYSFLAGS})
LIST (APPEND CMAKE_REQUIRED_LIBRARIES ${CARES_DEPENDENT_LIBS})

MACRO (CARES_EXTRAINCLUDE_IFSET var include)
	IF (${var})
		LIST (APPEND CMAKE_EXTRA_INCLUDE_FILES ${include})
	ENDIF ()
ENDMACRO ()

CARES_EXTRAINCLUDE_IFSET (HAVE_STDBOOL_H      stdbool.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_SYS_TYPES_H    sys/types.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_ARPA_INET_H    arpa/inet.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_ARPA_NAMESER_H arpa/nameser.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_NETDB_H        netdb.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_NET_IF_H       net/if.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_NETINET_IN_H   netinet/in.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_NETINET_TCP_H  netinet/tcp.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_SIGNAL_H       signal.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_STDLIB_H       stdlib.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_STRING_H       string.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_STRINGS_H      strings.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_SYS_IOCTL_H    sys/ioctl.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_SYS_SELECT_H   sys/select.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_SYS_SOCKET_H   sys/socket.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_SYS_TIME_H     sys/time.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_SYS_UIO_H      sys/uio.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_TIME_H         time.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_FCNTL_H        fcntl.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_UNISTD_H       unistd.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_WINSOCK2_H     winsock2.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_WS2TCPIP_H     ws2tcpip.h)
CARES_EXTRAINCLUDE_IFSET (HAVE_WINDOWS_H      windows.h)

# Check Types
# CHECK_TYPE_SIZE can't be used to see if a type exists because on Apple when
# building multi-arch, it will throw an error.  So we need to wrap
# CHECK_C_SOURCE_COMPILES for our tests.
MACRO (CARES_TYPE_EXISTS type var)
	SET(_CARES_C_SOURCE "
		#include <stdio.h>
		#include <stdlib.h>
	")
	FOREACH(_C_HEADER ${CMAKE_EXTRA_INCLUDE_FILES})
		SET(_CARES_C_SOURCE "${_CARES_C_SOURCE}
		#include <${_C_HEADER}>")
	ENDFOREACH(_C_HEADER)

	SET(_CARES_C_SOURCE "${_CARES_C_SOURCE}
		int main() {
			${type} var_exists;
			return 0;
		}
	")
	CHECK_C_SOURCE_COMPILES ("${_CARES_C_SOURCE}" ${var})
ENDMACRO ()

CARES_TYPE_EXISTS (socklen_t                 HAVE_SOCKLEN_T)
CARES_TYPE_EXISTS (SOCKET                    HAVE_TYPE_SOCKET)
CARES_TYPE_EXISTS (bool                      HAVE_BOOL_T)
CARES_TYPE_EXISTS (ssize_t                   HAVE_SSIZE_T)
CARES_TYPE_EXISTS ("long long"               HAVE_LONGLONG)
CARES_TYPE_EXISTS (sig_atomic_t              HAVE_SIG_ATOMIC_T)
CARES_TYPE_EXISTS ("struct addrinfo"         HAVE_STRUCT_ADDRINFO)
CARES_TYPE_EXISTS ("struct in6_addr"         HAVE_STRUCT_IN6_ADDR)
CARES_TYPE_EXISTS ("struct sockaddr_in6"     HAVE_STRUCT_SOCKADDR_IN6)
CARES_TYPE_EXISTS ("struct sockaddr_storage" HAVE_STRUCT_SOCKADDR_STORAGE)
CARES_TYPE_EXISTS ("struct timeval"          HAVE_STRUCT_TIMEVAL)


# Check for preprocessor defines
CHECK_SYMBOL_EXISTS (AF_INET6        "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_AF_INET6)
CHECK_SYMBOL_EXISTS (O_NONBLOCK      "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_O_NONBLOCK)
CHECK_SYMBOL_EXISTS (FIONBIO         "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_FIONBIO)
CHECK_SYMBOL_EXISTS (SIOCGIFADDR     "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_IOCTL_SIOCGIFADDR)
CHECK_SYMBOL_EXISTS (MSG_NOSIGNAL    "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_MSG_NOSIGNAL)
CHECK_SYMBOL_EXISTS (PF_INET6        "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_PF_INET6)
CHECK_SYMBOL_EXISTS (SO_NONBLOCK     "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_SO_NONBLOCK)

# XCode v8 bug: iOS when targeting less than v10, or MacOS when targeting less than v10.12 will
# say clock_gettime exists, it is a weak symbol that only exists in iOS10/MacOS10.12 and will
# cause a crash at runtime when running on older versions.  Skip finding CLOCK_MONOTONIC on older
# OS's.
IF ((NOT APPLE) OR IOS_V10 OR MACOS_V1012)
	CHECK_SYMBOL_EXISTS (CLOCK_MONOTONIC "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_CLOCK_GETTIME_MONOTONIC)
ENDIF ()

CHECK_STRUCT_HAS_MEMBER("struct sockaddr_in6" sin6_scope_id "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_SOCKADDR_IN6_SIN6_SCOPE_ID LANGUAGE C)

# Check for "LL" numeric suffix support
CHECK_C_SOURCE_COMPILES ("int main() { int n=1234LL; return 0; }" HAVE_LL)


CHECK_SYMBOL_EXISTS (bitncmp         "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_BITNCMP)
CHECK_SYMBOL_EXISTS (closesocket     "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_CLOSESOCKET)
CHECK_SYMBOL_EXISTS (CloseSocket     "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_CLOSESOCKET_CAMEL)
CHECK_SYMBOL_EXISTS (connect         "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_CONNECT)
CHECK_SYMBOL_EXISTS (fcntl           "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_FCNTL)
CHECK_SYMBOL_EXISTS (freeaddrinfo    "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_FREEADDRINFO)
CHECK_SYMBOL_EXISTS (getaddrinfo     "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_GETADDRINFO)
CHECK_SYMBOL_EXISTS (getenv          "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_GETENV)
CHECK_SYMBOL_EXISTS (gethostbyaddr   "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_GETHOSTBYADDR)
CHECK_SYMBOL_EXISTS (gethostbyname   "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_GETHOSTBYNAME)
CHECK_SYMBOL_EXISTS (gethostname     "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_GETHOSTNAME)
CHECK_SYMBOL_EXISTS (getnameinfo     "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_GETNAMEINFO)
CHECK_SYMBOL_EXISTS (getservbyport_r "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_GETSERVBYPORT_R)
CHECK_SYMBOL_EXISTS (gettimeofday    "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_GETTIMEOFDAY)
CHECK_SYMBOL_EXISTS (if_indextoname  "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_IF_INDEXTONAME)
CHECK_SYMBOL_EXISTS (inet_net_pton   "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_INET_NET_PTON)
IF (NOT WIN32)
	# Disabled on Windows, because these functions are only really supported on Windows
	# Vista or newer (_WIN32_WINNT >= 0x0600). Older versions of Windows may provide
	# them as experimental non-working features, so we have to disable them manually.
	CHECK_SYMBOL_EXISTS (inet_ntop       "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_INET_NTOP)
	CHECK_SYMBOL_EXISTS (inet_pton       "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_INET_PTON)
ENDIF ()
CHECK_SYMBOL_EXISTS (ioctl           "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_IOCTL)
CHECK_SYMBOL_EXISTS (ioctlsocket     "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_IOCTLSOCKET)
CHECK_SYMBOL_EXISTS (IoctlSocket     "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_IOCTLSOCKET_CAMEL)
CHECK_SYMBOL_EXISTS (recv            "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_RECV)
CHECK_SYMBOL_EXISTS (recvfrom        "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_RECVFROM)
CHECK_SYMBOL_EXISTS (send            "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_SEND)
CHECK_SYMBOL_EXISTS (setsockopt      "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_SETSOCKOPT)
CHECK_SYMBOL_EXISTS (socket          "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_SOCKET)
CHECK_SYMBOL_EXISTS (strcasecmp      "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_STRCASECMP)
CHECK_SYMBOL_EXISTS (strcmpi         "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_STRCMPI)
CHECK_SYMBOL_EXISTS (strdup          "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_STRDUP)
CHECK_SYMBOL_EXISTS (stricmp         "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_STRICMP)
CHECK_SYMBOL_EXISTS (strncasecmp     "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_STRNCASECMP)
CHECK_SYMBOL_EXISTS (strncmpi        "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_STRNCMPI)
CHECK_SYMBOL_EXISTS (strnicmp        "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_STRNICMP)
CHECK_SYMBOL_EXISTS (writev          "${CMAKE_EXTRA_INCLUDE_FILES}" HAVE_WRITEV)

# Unset temporary data
SET (CMAKE_EXTRA_INCLUDE_FILES)
SET (CMAKE_REQUIRED_DEFINITIONS)
SET (CMAKE_REQUIRED_LIBRARIES)


################################################################################
# recv, recvfrom, send, getnameinfo, gethostname
# ARGUMENTS AND RETURN VALUES
#
# The AutoTools build tries to be really thorough here.  So much so that it
# takes forever.  We really don't want to do that.  Lets make some educated
# guesses based on datatypes we have available, and for others, use some 'sane'
# defaults.  This should be much quicker and nearly as accurate ... and even
# if not, it probably won't matter in the least.

IF (HAVE_SSIZE_T AND HAVE_SOCKLEN_T)
	# If we have ssize_t and socklen_t, the API is usually sane and uses ssize_t and size_t for lengths
	SET (RECVFROM_TYPE_RETV ssize_t)
	SET (RECVFROM_TYPE_ARG3 size_t)
ELSE ()
	SET (RECVFROM_TYPE_RETV int)
	SET (RECVFROM_TYPE_ARG3 int)
ENDIF ()

IF (HAVE_TYPE_SOCKET)
	# If the SOCKET type is defined, it uses socket ... should be windows only
	SET (RECVFROM_TYPE_ARG1 SOCKET)
ELSE ()
	SET (RECVFROM_TYPE_ARG1 int)
ENDIF()

IF (HAVE_SOCKLEN_T)
	# If we have socklen_t the APIs pretty much always actually use it
	SET (RECVFROM_TYPE_ARG6 "socklen_t *")
	SET (GETNAMEINFO_TYPE_ARG2 socklen_t)
	SET (GETNAMEINFO_TYPE_ARG46 socklen_t)
ELSE ()
	SET (RECVFROM_TYPE_ARG6 "int *")
	SET (GETNAMEINFO_TYPE_ARG2 int)
	SET (GETNAMEINFO_TYPE_ARG46 int)
ENDIF ()

# Functions are typically consistent so the equivalent fields map ... equivalently
SET (RECV_TYPE_RETV ${RECVFROM_TYPE_RETV})
SET (SEND_TYPE_RETV ${RECVFROM_TYPE_RETV})
SET (RECV_TYPE_ARG1 ${RECVFROM_TYPE_ARG1})
SET (SEND_TYPE_ARG1 ${RECVFROM_TYPE_ARG1})
SET (RECV_TYPE_ARG3 ${RECVFROM_TYPE_ARG3})
SET (SEND_TYPE_ARG3 ${RECVFROM_TYPE_ARG3})
SET (GETHOSTNAME_TYPE_ARG2 ${RECVFROM_TYPE_ARG3})

# These should always be "sane" values to use always
SET (RECVFROM_QUAL_ARG5 )
SET (RECVFROM_TYPE_ARG2 "void *")
SET (RECVFROM_TYPE_ARG4 int)
SET (RECVFROM_TYPE_ARG5 "struct sockaddr *")
SET (RECV_TYPE_ARG2 "void *")
SET (RECV_TYPE_ARG4 int)
SET (GETNAMEINFO_TYPE_ARG1 "struct sockaddr *")
SET (GETNAMEINFO_TYPE_ARG7 int)
SET (SEND_TYPE_ARG2 "void *")
SET (SEND_TYPE_ARG4 int)
################################################################################


# HAVE_CXX11  ??
# HAVE_SIG_ATOMIC_T_VOLATILE  ??


# Set a few variables by hand that C-Ares wants, logically, based on detection
# data.

IF (HAVE_SOCKLEN_T)
	Set (CARES_TYPEOF_ARES_SOCKLEN_T "socklen_t")
ELSE ()
	Set (CARES_TYPEOF_ARES_SOCKLEN_T "int")
ENDIF ()

IF (HAVE_SSIZE_T)
	Set (CARES_TYPEOF_ARES_SSIZE_T "ssize_t")
ELSE ()
	IF (WIN32)
		IF ("${CMAKE_SIZEOF_VOID_P}" EQUAL "8")
			Set (CARES_TYPEOF_ARES_SSIZE_T "__int64")
		ELSE ()
			Set (CARES_TYPEOF_ARES_SSIZE_T "int")
		ENDIF ()
	ELSE ()
		Set (CARES_TYPEOF_ARES_SSIZE_T "long")
	ENDIF ()
ENDIF ()

IF (HAVE_FCNTL AND HAVE_O_NONBLOCK)
	SET (HAVE_FCNTL_O_NONBLOCK 1)
ENDIF ()

IF (HAVE_IOCTL AND HAVE_FIONBIO)
	SET (HAVE_IOCTL_FIONBIO 1)
ENDIF ()

IF (HAVE_IOCTLSOCKET AND HAVE_FIONBIO)
	SET (HAVE_IOCTLSOCKET_FIONBIO 1)
ENDIF ()

IF (HAVE_IOCTLSOCKET_CAMEL AND HAVE_FIONBIO)
	SET (HAVE_IOCTLSOCKET_CAMEL_FIONBIO 1)
ENDIF ()

IF (HAVE_GETADDRINFO)
	IF (CMAKE_SYSTEM_NAME STREQUAL "Darwin" OR
		CMAKE_SYSTEM_NAME STREQUAL "HPUX" OR
		CMAKE_SYSTEM_NAME STREQUAL "NetBSD" OR
		CMAKE_SYSTEM_NAME STREQUAL "SunOS" OR
		CMAKE_SYSTEM_NAME STREQUAL "FreeBSD" OR
		CMAKE_SYSTEM_NAME STREQUAL "AIX" OR
		WIN32)
			SET (HAVE_GETADDRINFO_THREADSAFE 1)
	ENDIF ()
ENDIF ()

IF (HAVE_TIME_H AND HAVE_SYS_TIME_H)
	SET (TIME_WITH_SYS_TIME 1)
ENDIF ()

IF (HAVE_GETSERVBYPORT_R)
	# TODO : Should probably autodetect
	IF (CMAKE_SYSTEM_NAME STREQUAL "SunOS")
		SET (GETSERVBYPORT_R_ARGS 5)
	ELSEIF (CMAKE_SYSTEM_NAME STREQUAL "AIX" OR
		CMAKE_SYSTEM_NAME STREQUAL "OpenBSD")
		SET (GETSERVBYPORT_R_ARGS 4)
	ELSE ()
		# Probably linux
		SET (GETSERVBYPORT_R_ARGS 6)
	ENDIF ()
ENDIF ()

# Set some aliases used for ares_build.h
IF (HAVE_SYS_TYPES_H)
	SET (CARES_HAVE_SYS_TYPES_H 1)
ENDIF ()
IF (HAVE_SYS_SOCKET_H)
	SET (CARES_HAVE_SYS_SOCKET_H 1)
ENDIF()
IF (HAVE_WS2TCPIP_H)
	SET (CARES_HAVE_WS2TCPIP_H 1)
ENDIF()
IF (HAVE_WINSOCK2_H)
	SET (CARES_HAVE_WINSOCK2_H 1)
ENDIF()
IF (HAVE_WINDOWS_H)
	SET (CARES_HAVE_WINDOWS_H 1)
ENDIF()

# Write ares_build.h configuration file.  This is an installed file.
CONFIGURE_FILE (ares_build.h.cmake ${PROJECT_BINARY_DIR}/ares_build.h)

# Write ares_config.h configuration file.  This is used only for the build.
CONFIGURE_FILE (ares_config.h.cmake ${PROJECT_BINARY_DIR}/ares_config.h)


# TRANSFORM_MAKEFILE_INC
#
# This function consumes the "Makefile.inc" autotools file, and converts it into
#  "Makefile.inc.cmake", a cmake include file; transforming this:
#
# CSOURCES = ares__close_sockets.c	\
#   ares__get_hostent.c			\
#   ares__read_line.c			\
#   ...
#
#   into this:
#
# SET (CSOURCES
# 	ares__close_sockets.c
# 	ares__get_hostent.c
# 	ares__read_line.c
#	...
function(TRANSFORM_MAKEFILE_INC INPUT_FILE OUTPUT_FILE)
  file(READ ${INPUT_FILE} MAKEFILE_INC_TEXT)
  string(REPLACE "$(top_srcdir)"   "\${PROJECT_SOURCE_DIR}" MAKEFILE_INC_TEXT ${MAKEFILE_INC_TEXT})
  string(REPLACE "$(top_builddir)" "\${PROJECT_BINARY_DIR}" MAKEFILE_INC_TEXT ${MAKEFILE_INC_TEXT})

  string(REGEX REPLACE "\\\\\n" "ß!ß" MAKEFILE_INC_TEXT ${MAKEFILE_INC_TEXT})
  string(REGEX REPLACE "([a-zA-Z_][a-zA-Z0-9_]*)[\t ]*=[\t ]*([^\n]*)" "SET(\\1 \\2)" MAKEFILE_INC_TEXT ${MAKEFILE_INC_TEXT})
  string(REPLACE "ß!ß" "\n" MAKEFILE_INC_TEXT ${MAKEFILE_INC_TEXT})

  string(REGEX REPLACE "\\$\\(([a-zA-Z_][a-zA-Z0-9_]*)\\)" "\${\\1}" MAKEFILE_INC_TEXT ${MAKEFILE_INC_TEXT})    # Replace $() with ${}
  string(REGEX REPLACE "@([a-zA-Z_][a-zA-Z0-9_]*)@" "\${\\1}" MAKEFILE_INC_TEXT ${MAKEFILE_INC_TEXT})    # Replace @@ with ${}, even if that may not be read by CMake scripts.
  file(WRITE ${OUTPUT_FILE} ${MAKEFILE_INC_TEXT})
endfunction()

# run the function...
transform_makefile_inc("Makefile.inc" "${PROJECT_BINARY_DIR}/Makefile.inc.cmake")
include(${PROJECT_BINARY_DIR}/Makefile.inc.cmake)



# Build the dynamic/shared library
IF (CARES_SHARED)
	ADD_LIBRARY (${PROJECT_NAME} SHARED ${CSOURCES})

	# Convert CARES_LIB_VERSIONINFO libtool version format into VERSION and SOVERSION
	# Convert from ":" separated into CMake list format using ";"
	STRING (REPLACE ":" ";" CARES_LIB_VERSIONINFO ${CARES_LIB_VERSIONINFO})
	LIST (GET CARES_LIB_VERSIONINFO 0 CARES_LIB_VERSION_CURRENT)
	LIST (GET CARES_LIB_VERSIONINFO 1 CARES_LIB_VERSION_REVISION)
	LIST (GET CARES_LIB_VERSIONINFO 2 CARES_LIB_VERSION_AGE)
	MATH (EXPR CARES_LIB_VERSION_MAJOR "${CARES_LIB_VERSION_CURRENT} - ${CARES_LIB_VERSION_AGE}")
	SET  (CARES_LIB_VERSION_MINOR "${CARES_LIB_VERSION_AGE}")
	SET  (CARES_LIB_VERSION_RELEASE "${CARES_LIB_VERSION_REVISION}")

	SET_TARGET_PROPERTIES (${PROJECT_NAME} PROPERTIES
		EXPORT_NAME cares
		OUTPUT_NAME cares
		VERSION     "${CARES_LIB_VERSION_MAJOR}.${CARES_LIB_VERSION_MINOR}.${CARES_LIB_VERSION_RELEASE}"
		SOVERSION   "${CARES_LIB_VERSION_MAJOR}"
	)

	TARGET_INCLUDE_DIRECTORIES (${PROJECT_NAME} PUBLIC "$<BUILD_INTERFACE:${PROJECT_BINARY_DIR}>")
	TARGET_INCLUDE_DIRECTORIES (${PROJECT_NAME} PUBLIC "$<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}>")

	TARGET_COMPILE_DEFINITIONS (${PROJECT_NAME} PRIVATE HAVE_CONFIG_H=1 CARES_BUILDING_LIBRARY)

	TARGET_LINK_LIBRARIES (${PROJECT_NAME} PUBLIC ${CARES_DEPENDENT_LIBS})

	IF (CARES_INSTALL)
		INSTALL (TARGETS ${PROJECT_NAME} EXPORT ${PROJECT_NAME}-targets
			${TARGETS_INST_DEST}
		)
	ENDIF ()
	SET (STATIC_SUFFIX "_static")

	# For chain building: add alias targets that look like import libs that would be returned by find_package(c-ares).
	ADD_LIBRARY (${PROJECT_NAME}::cares_shared ALIAS ${PROJECT_NAME})
	ADD_LIBRARY (${PROJECT_NAME}::cares        ALIAS ${PROJECT_NAME})
ENDIF ()

# Build the static library
IF (CARES_STATIC)
	SET (LIBNAME ${PROJECT_NAME}${STATIC_SUFFIX})

	ADD_LIBRARY (${LIBNAME} STATIC ${CSOURCES})

	SET_TARGET_PROPERTIES (${LIBNAME} PROPERTIES
		EXPORT_NAME cares${STATIC_SUFFIX}
		OUTPUT_NAME cares${STATIC_SUFFIX}
	)

	IF (CARES_STATIC_PIC)
		SET_TARGET_PROPERTIES (${LIBNAME} PROPERTIES POSITION_INDEPENDENT_CODE True)
	ENDIF ()

	TARGET_INCLUDE_DIRECTORIES (${LIBNAME} PUBLIC "$<BUILD_INTERFACE:${PROJECT_BINARY_DIR}>")
	TARGET_INCLUDE_DIRECTORIES (${LIBNAME} PUBLIC "$<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}>")

	TARGET_COMPILE_DEFINITIONS (${LIBNAME}
		PUBLIC  CARES_STATICLIB
		PRIVATE HAVE_CONFIG_H=1
	)

	TARGET_LINK_LIBRARIES (${LIBNAME} PUBLIC ${CARES_DEPENDENT_LIBS})
	IF (CARES_INSTALL)
		INSTALL (TARGETS ${LIBNAME} EXPORT ${PROJECT_NAME}-targets
			${TARGETS_INST_DEST}
		)
	ENDIF ()

	# For chain building: add alias targets that look like import libs that would be returned by find_package(c-ares).
	ADD_LIBRARY (${PROJECT_NAME}::cares_static ALIAS ${LIBNAME})
	IF (NOT TARGET ${PROJECT_NAME}::cares)
		# Only use static for the generic alias if shared lib wasn't built.
		ADD_LIBRARY (${PROJECT_NAME}::cares ALIAS ${LIBNAME})
	ENDIF ()
ENDIF ()


# Headers installation target
IF (CARES_INSTALL)
	SET (CARES_HEADERS ares.h ares_version.h ares_dns.h "${PROJECT_BINARY_DIR}/ares_build.h" ares_rules.h)
	INSTALL (FILES ${CARES_HEADERS} DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})
ENDIF ()

# Export targets
IF (CARES_INSTALL)
	SET (CMAKECONFIG_INSTALL_DIR "${CMAKE_INSTALL_LIBDIR}/cmake/${PROJECT_NAME}")
	INCLUDE (CMakePackageConfigHelpers)
	CONFIGURE_PACKAGE_CONFIG_FILE (${PROJECT_NAME}-config.cmake.in ${PROJECT_NAME}-config.cmake
		INSTALL_DESTINATION ${CMAKECONFIG_INSTALL_DIR}
		PATH_VARS CMAKE_INSTALL_INCLUDEDIR
		NO_CHECK_REQUIRED_COMPONENTS_MACRO
	)
	INSTALL (EXPORT ${PROJECT_NAME}-targets DESTINATION ${CMAKECONFIG_INSTALL_DIR} NAMESPACE ${PROJECT_NAME}::)
	INSTALL (FILES "${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}-config.cmake" DESTINATION ${CMAKECONFIG_INSTALL_DIR})
ENDIF ()

# Legacy chain-building variables (provided for compatibility with old code).
# Don't use these, external code should be updated to refer to the aliases directly (e.g., Cares::cares).
SET (CARES_FOUND 1 CACHE INTERNAL "CARES LIBRARY FOUND")
SET (CARES_LIBRARIES ${PROJECT_NAME}::cares CACHE INTERNAL "CARES LIBRARIES")


# Build ahost
ADD_EXECUTABLE (ahost ahost.c ${SAMPLESOURCES})
TARGET_COMPILE_DEFINITIONS (ahost PRIVATE HAVE_CONFIG_H=1)
TARGET_LINK_LIBRARIES (ahost PRIVATE ${PROJECT_NAME})
IF (CARES_INSTALL)
	INSTALL (TARGETS ahost ${TARGETS_INST_DEST})
ENDIF ()


# Build adig
ADD_EXECUTABLE (adig adig.c ${SAMPLESOURCES})
TARGET_COMPILE_DEFINITIONS (adig PRIVATE HAVE_CONFIG_H=1)
TARGET_LINK_LIBRARIES (adig PRIVATE ${PROJECT_NAME})
IF (CARES_INSTALL)
	INSTALL (TARGETS adig ${TARGETS_INST_DEST})
ENDIF ()


# Build acountry
ADD_EXECUTABLE (acountry acountry.c ${SAMPLESOURCES})
TARGET_COMPILE_DEFINITIONS (acountry PRIVATE HAVE_CONFIG_H=1)
TARGET_LINK_LIBRARIES (acountry PRIVATE ${PROJECT_NAME})
IF (CARES_INSTALL)
	INSTALL (TARGETS acountry ${TARGETS_INST_DEST})
ENDIF ()
