# check for zlib headers and libraries presence
# set "check_zlib" to "true" to perform the check
# define USE_ZLIB

AC_DEFUN([MEGASDK_CHECK_ZLIB],[

# save
SAVE_LDFLAGS="$LDFLAGS"
SAVE_CXXFLAGS="$CXXFLAGS"
SAVE_CPPFLAGS="$CPPFLAGS"

zlib=false
if test "x$check_zlib" = "xtrue"; then
AC_MSG_CHECKING(for zlib)
AC_ARG_WITH(zlib,
  AS_HELP_STRING(--with-zlib=PATH, base of zlib installation),
  [
   case $with_zlib in
   no)
    zlib=false
     ;;
   yes)
    AC_CHECK_HEADERS([zlib.h],, [
        AC_MSG_ERROR([zlib.h header not found or not usable])
    ])
    AC_CHECK_LIB(z, [main], [ZLIB_LIBS="-lz"],[
            AC_MSG_ERROR([Could not find zlib])
    ])
    zlib=true
     ;;
   *)

    if test -d "$with_zlib/lib"; then
        LDFLAGS="-L$with_zlib/lib $LDFLAGS"
        CXXFLAGS="-I$with_zlib/include $CXXFLAGS"
        CPPFLAGS="-I$with_zlib/include $CPPFLAGS"

        AC_CHECK_HEADERS(zlib.h,
         ZLIB_CXXFLAGS="-I$with_zlib/include"
         ZLIB_CPPFLAGS="-I$with_zlib/include"
         ZLIB_LDFLAGS="-L$with_zlib/lib",
         AC_MSG_ERROR([zlib.h header not found or not usable])
         )

        AC_CHECK_LIB(z, [main], [ZLIB_LIBS="-lz"],[
                AC_MSG_ERROR([Could not find zlib])
        ])
    else
        LDFLAGS="-L$with_zlib $LDFLAGS"
        CXXFLAGS="-I$with_zlib $CXXFLAGS"
        CPPFLAGS="-I$with_zlib $CPPFLAGS"

        AC_CHECK_HEADERS(zlib.h,
         ZLIB_CXXFLAGS="-I$with_zlib"
         ZLIB_CPPFLAGS="-I$with_zlib"
         ZLIB_LDFLAGS="-L$with_zlib",
         AC_MSG_ERROR([zlib.h header not found or not usable])
         )

        AC_CHECK_LIB(z, [main], [ZLIB_LIBS="-lz"],[
                AC_MSG_ERROR([Could not find zlib])
        ])
    fi

    zlib=true

    #restore
    LDFLAGS=$SAVE_LDFLAGS
    CXXFLAGS=$SAVE_CXXFLAGS
    CPPFLAGS=$SAVE_CPPFLAGS
    ;;
   esac
  ],
  [AC_MSG_RESULT([--with-zlib not specified])
    AC_CHECK_HEADERS([zlib.h],, [
        AC_MSG_ERROR([zlib.h header not found or not usable])
    ])
    AC_CHECK_LIB(z, [main], [ZLIB_LIBS="-lz"],[
            AC_MSG_ERROR([Could not find zlib])
    ])
  ])

SDK_CXXFLAGS="$SDK_CXXFLAGS $ZLIB_CXXFLAGS"
SDK_CPPFLAGS="$SDK_CPPFLAGS $ZLIB_CPPFLAGS"
SDK_LDFLAGS="$SDK_LDFLAGS $ZLIB_LDFLAGS"
SDK_LIBS="$SDK_LIBS $ZLIB_LIBS"

# if test
fi

if test "x$zlib" = "xtrue" ; then
    AC_DEFINE(USE_ZLIB, [1], [Define to use zlib])
else
    AC_DEFINE(USE_ZLIB, [0], [Define to use zlib])
fi
AM_CONDITIONAL([USE_ZLIB], [test "x$zlib" = "xtrue"])

#restore
LDFLAGS="$SAVE_LDFLAGS"
CXXFLAGS="$SAVE_CXXFLAGS"
CPPFLAGS="$SAVE_CPPFLAGS"
])
