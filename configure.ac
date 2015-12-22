##
# @file configure.ac
# @brief an input file for autoconf tool
#
# (c) 2013-2015 by Mega Limited, Auckland, New Zealand
#
# This file is part of the MEGA SDK - Client Access Engine.
#
# Applications using the MEGA API must present a valid application key
# and comply with the the rules set forth in the Terms of Service.
#
# The MEGA SDK is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
#
# @copyright Simplified (2-clause) BSD License.
#
# You should have received a copy of the license along with this
# program.
##

AC_PREREQ([2.61])

# The Mega SDK version number is generated into config.h.
# The version in Git should reflect the *next* version planned.
m4_define([mega_major_version], [2])
m4_define([mega_minor_version], [6])
m4_define([mega_micro_version], [0])
m4_define([mega_version],
          [mega_major_version.mega_minor_version.mega_micro_version])

# libtool interface versioning
m4_define([mega_lt_revision], [0])
m4_define([mega_lt_current], [m4_eval(100 * mega_minor_version + mega_micro_version)])
m4_define([mega_lt_age], [0])

AC_INIT([libmega], [mega_version], [https://github.com/meganz/sdk])

# Define _GNU_SOURCE
# AC_GNU_SOURCE
AC_USE_SYSTEM_EXTENSIONS

AM_INIT_AUTOMAKE([1.11 foreign silent-rules])
AC_CONFIG_HEADERS([include/mega/config.h])
LT_INIT([shared disable-static win32-dll])
AC_CONFIG_MACRO_DIR([m4])
# enable silent build
m4_ifndef([AM_SILENT_RULES], [m4_define([AM_SILENT_RULES],[])])
AM_SILENT_RULES([yes])

MEGA_MAJOR_VERSION=mega_major_version
MEGA_MINOR_VERSION=mega_minor_version
MEGA_MICRO_VERSION=mega_micro_version

AC_SUBST(MEGA_MAJOR_VERSION)
AC_SUBST(MEGA_MINOR_VERSION)
AC_SUBST(MEGA_MICRO_VERSION)

AC_DEFINE(MEGA_MAJOR_VERSION, [mega_major_version],
    [MEGA SDK major version.])
AC_DEFINE(MEGA_MINOR_VERSION, [mega_minor_version],
    [MEGA SDK minor version.])
AC_DEFINE(MEGA_MICRO_VERSION, [mega_micro_version],
    [MEGA SDK micro version.])

LT_CURRENT=mega_lt_current
LT_REVISION=mega_lt_revision
LT_AGE=mega_lt_age

AC_SUBST(LT_CURRENT)
AC_SUBST(LT_REVISION)
AC_SUBST(LT_AGE)

# Checks for typedefs, structures, and compiler characteristics.
AC_TYPE_SIZE_T
AC_TYPE_UINT8_T
AC_TYPE_UINT16_T
AC_TYPE_UINT32_T
AC_TYPE_UINT64_T
AC_TYPE_PID_T
AC_TYPE_OFF_T

AH_VERBATIM([__STDC_FORMAT_MACROS],
            [/* C99 says: define this to get the PRI... macros from stdint.h */
#ifndef __STDC_FORMAT_MACROS
# define __STDC_FORMAT_MACROS 1
#endif])

AC_CHECK_TYPES([ssize_t])

AC_CANONICAL_HOST
AC_DEFINE_UNQUOTED(OS, "${host}", [cpu-machine-OS])

# Check programs
AC_PROG_CXX
if test "$CXX" = no || test "$CXX:$GXX" = "g++:"; then
  AC_MSG_ERROR([C++ compiler not found !])
fi

AC_PROG_LIBTOOL
AM_SANITY_CHECK

# Check for cppcheck
AC_CHECK_PROG(HAVE_CPPCHECK, cppcheck, yes)
AM_CONDITIONAL(CPPCHECK, test -n "$HAVE_CPPCHECK")

# set C++
AC_LANG_CPLUSPLUS

# Check headers
AC_STDC_HEADERS
AC_HEADER_STDC
AC_HEADER_STDBOOL
AC_HEADER_DIRENT

AC_DEFINE(__STDC_CONSTANT_MACROS, [], [Force definition of constant macros for C++])
AC_DEFINE(__STDC_FORMAT_MACROS, [], [Force definition of format macros for C++])
AC_DEFINE(__STDC_LIMIT_MACROS, [], [Force definition of limit macros for C++])

# Add 64-bits file support on some hosts
AC_SYS_LARGEFILE
# use new interfaces
AC_FUNC_FSEEKO
AC_TYPE_OFF_T

# Checks for typedefs, structures, and compiler characteristics.
AC_CHECK_SIZEOF([uint64_t])
AC_STRUCT_TM
AC_TYPE_OFF_T
AC_TYPE_SIZE_T

AC_CHECK_HEADERS([arpa/inet.h netdb.h netinet/in.h stddef.h stdint.h stdlib.h sys/socket.h sys/timeb.h htonl glob.h malloc.h sys/malloc.h malloc/malloc.h])

# Debug
AC_ARG_ENABLE(debug,
    AS_HELP_STRING([--enable-debug], [enable support for running in debug mode]),
    [], [enable_debug=no])

# Enable debug flags / build
if test "x$enable_debug" = "xyes" ; then
    AM_CXXFLAGS="-Wall -g -ggdb3 -O0"
    CXXFLAGS="-Wall -g -ggdb3 -O0"
    AC_SUBST([AM_CXXFLAGS])
    AC_DEFINE(DEBUG, 1, [Define to enable debug logging])
fi

# Check if we can use -fPIC flag
AX_CHECK_COMPILE_FLAG([-fPIC], [
  AX_CHECK_LINK_FLAG([-fPIC],
    [CXXFLAGS="$CXXFLAGS -fPIC"]
  )
])

AM_CONDITIONAL(ENABLE_STATIC, test x$enable_static = xyes)
AC_SUBST(ENABLE_STATIC)

AC_CHECK_LIB(dl, dlopen, [LIBS="-ldl $LIBS"])

# Check for inotify support.
AC_ARG_ENABLE(inotify,
    AS_HELP_STRING([--enable-inotify], [enable inotify support [default=yes]])],
    [enable_inotify=$enableval],
    [enable_inotify=yes]
)

AS_IF([test "x$enable_inotify" = "xyes"], [
    AC_CHECK_HEADERS([sys/inotify.h mcheck.h])
    AC_CHECK_FUNCS([inotify_init1], [AC_DEFINE([USE_INOTIFY], [1], [Use inotify API])])
])

# Check for particular functions
AC_CHECK_FUNCS(fdopendir select)
AC_CHECK_LIB([sendfile], [sendfile])
AC_CHECK_LIB([socket], [socket])
AC_CHECK_LIB([rt], [clock_gettime])

# check for malloc only on for native builds
# users report issues with cross-compiling builds
#AS_IF([test "x$cross_compiling" != "xyes"], [AC_FUNC_MALLOC AC_FUNC_REALLOC])

# Check if building for Win32, determine Win32 API libs
WIN32=no
DARWIN=no
AC_MSG_CHECKING([if building for Win32 platform])
case $host in
  *-*-cygwin*)
    LIBS_EXTRA="-luser32 -lkernel32"
    WIN32=yes
    ;;
  *-*-mingw*)
    LIBS_EXTRA="-lws2_32 -lcrypt32 -lole32 -lwinmm -lshlwapi"
    CXXFLAGS="$CXXFLAGS -DUNICODE"
    WIN32=yes
    ;;
  *-apple-darwin*)
    AC_DEFINE([_XOPEN_SOURCE], [500], [Define _XOPEN_SOURCE])
    AC_DEFINE([_DARWIN_C_SOURCE], [1], [Define _DARWIN_C_SOURCE])
    DARWIN=yes
    ;;
  *)
    LIBS_EXTRA=""
    ;;
esac
AC_MSG_RESULT([${WIN32}])
AM_CONDITIONAL([WIN32], [test "${WIN32}" = "yes"])
AM_CONDITIONAL([DARWIN], [test "${DARWIN}" = "yes"])
AC_SUBST(LIBS_EXTRA)

# check for Pthreads
AC_ARG_ENABLE(posix-threads,
    AS_HELP_STRING(--disable-posix-threads, disable POSIX threads support),
    [enable_posix_threads=no],
    [enable_posix_threads=yes])
if test x$enable_posix_threads != xno; then
    AC_CHECK_LIB(pthread, pthread_create, [HAVE_PTHREAD=yes], [HAVE_PTHREAD=no])
else
    HAVE_PTHREAD=no
fi
if test "$HAVE_PTHREAD" = "yes"; then
    AC_DEFINE(USE_PTHREAD, 1, [Defined if pthreads are available])
fi

# hardening options
AC_ARG_ENABLE(gcc-hardening,
    AS_HELP_STRING(--disable-gcc-hardening, disable compiler security checks),
    [],
    [enable_gcc_hardening=no])
if test x$enable_gcc_hardening != xno; then
    CXXFLAGS="$CXXFLAGS -D_FORTIFY_SOURCE=2"
    AX_CHECK_COMPILE_FLAG([-fstack-protector-all], [
        AX_CHECK_LINK_FLAG([-fstack-protector-all],
        [CXXFLAGS="$CXXFLAGS -fstack-protector-all"]
    )
])
fi

# sync subsystem
AC_ARG_ENABLE(sync,
    AS_HELP_STRING([--enable-sync], [include sync subsystem [default=yes]]),
    [enable_sync=$enableval],
    [enable_sync=yes])
if test x$enable_sync = xyes; then
    AC_DEFINE(ENABLE_SYNC, 1, [Defined if sync subsystem is enabled])
fi

# MEGA API
AC_ARG_ENABLE(megaapi,
    AS_HELP_STRING([--disable-megaapi], [disable MEGA API support]),
    [enable_megaapi=no],
    [enable_megaapi=yes])
if test x$enable_megaapi = xyes; then
    AC_DEFINE(USE_MEGAAPI, 1, [Defined if MEGA API enabled])
fi
AM_CONDITIONAL([BUILD_MEGAAPI], [test "$enable_megaapi" = "yes"])

# Chat
AC_ARG_ENABLE(chat,
    AS_HELP_STRING([--enable-chat], [enable chat support]),
    [], [enable_chat=no])
if test "x$enable_chat" = "xyes" ; then
    AC_DEFINE(ENABLE_CHAT, 1, [Define to enable chat])
fi

# determine platform include path
if test "x$WIN32" = "xyes" ; then
    platform_include="mega/win32"
else
    platform_include="mega/posix"
fi
AC_SUBST(platform_include)

# dependencies
SDK_CXXFLAGS=""
SDK_CPPFLAGS=""
SDK_LDFLAGS=""
SDK_LIBS=""

# default values
check_cryptopp=true
check_zlib=true
check_freeimage=true
check_db=true
check_ssl=true
check_cares=true
check_curl=true
check_examples=true
check_winhttp=false

# libsodium is disabled
check_sodium=false

# disable cURL on Windows platform
if test "x$WIN32" = "xyes" ; then
    check_ssl=false
    check_cares=false
    check_curl=false
fi

# Windows specific checks
if test "x$WIN32" = "xyes" ; then
    check_winhttp=true
fi

# JavaScript bindings don't require the most of dependencies
MEGASDK_CHECK_JS

# disable for dependency checking when JS bindings is enabled
if test "x$enable_javascript" = "xyes" ; then
    check_zlib=false
    check_db=false
    check_ssl=false
    check_cares=false
    check_curl=false
    check_freeimage=false
    check_examples=false
fi

# dependencies checking
MEGASDK_CHECK_CRYPTOPP
MEGASDK_CHECK_SODIUM
MEGASDK_CHECK_ZLIB
MEGASDK_CHECK_FREEIMAGE
MEGASDK_CHECK_DB
MEGASDK_CHECK_SSL
MEGASDK_CHECK_CARES
MEGASDK_CHECK_CURL
MEGASDK_CHECK_WINHTTP

# example applications
MEGASDK_CHECK_EXAMPLES

## Bindings
MEGASDK_CHECK_PYTHON
MEGASDK_CHECK_PHP
MEGASDK_CHECK_JAVA

# Tests
AC_MSG_CHECKING([if building tests])
AC_ARG_ENABLE(tests,
    AS_HELP_STRING([--enable-tests], [build test applications]),
    [], [enable_tests=no])
if test "x$enable_tests" = "xyes" ; then
    AC_ARG_WITH(gtest,
        AS_HELP_STRING(--with-gtest=PATH, specify GTest location),
        [AC_SUBST([GTEST_DIR],[$with_gtest])],
        [AC_MSG_ERROR([GTest location must be specified])]
    )
fi
AM_CONDITIONAL([BUILD_TESTS], [test "$enable_tests" = "yes"])
AC_MSG_RESULT([$enable_tests])

AC_SUBST(SDK_CPPFLAGS)
AC_SUBST(SDK_CXXFLAGS)
AC_SUBST(SDK_LDFLAGS)
AC_SUBST(SDK_LIBS)

dnl #########################################################################
dnl Doxygen settings
dnl #########################################################################

DX_INIT_DOXYGEN($PACKAGE_NAME, doc/Doxyfile, doc/api)
DX_DOXYGEN_FEATURE(ON)
DX_DOT_FEATURE(ON)
DX_HTML_FEATURE(ON)
DX_CHM_FEATURE(OFF)
DX_CHI_FEATURE(OFF)
DX_MAN_FEATURE(OFF)
DX_RTF_FEATURE(OFF)
DX_XML_FEATURE(OFF)
DX_PDF_FEATURE(OFF)
DX_PS_FEATURE(OFF)

# Output
AC_CONFIG_FILES([
 Makefile
 include/Makefile
 libmega.pc
 doc/Doxyfile
])
AC_OUTPUT

AC_MSG_NOTICE([Configured to build Mega SDK:

  SDK version:      mega_version
  Host setup:       ${host}
  Install prefix:   $prefix
  Compiler:         $CXX
  CXXFLAGS:         $CXXFLAGS
  gcc hardening:    $enable_gcc_hardening
  debug:            $enable_debug
  static:           $enable_static
  sync subsystem    $enable_sync
  MEGA API          $enable_megaapi
  example apps:     $enable_examples

  inotify:          $enable_inotify
  posix threads:    $enable_posix_threads

  Python bindings:  $enable_python
  Python3 bindings: $USE_PYTHON3
  PHP bindings:     $enable_php
  Java bindings:    $enable_java
  JS bindings:      $enable_javascript

  CPP_FLAGS:        $SDK_CPPFLAGS
  CXX_FLAGS:        $SDK_CXXFLAGS
  LDFLAGS:          $SDK_LDFLAGS
  SDK_LIBS:         $SDK_LIBS
])
