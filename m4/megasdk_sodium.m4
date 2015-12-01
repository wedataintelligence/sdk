# check for libsodium headers and libraries presence
# define USE_SODIUM

AC_DEFUN([MEGASDK_CHECK_SODIUM],[

# save
SAVE_LDFLAGS="$LDFLAGS"
SAVE_CXXFLAGS="$CXXFLAGS"
SAVE_CPPFLAGS="$CPPFLAGS"

sodium=false
if test "x$check_sodium" = "xtrue"; then
AC_MSG_CHECKING(for libsodium)
AC_ARG_WITH(sodium,
  AS_HELP_STRING(--with-sodium=PATH, base of libsodium installation),
  [
   case $with_sodium in
   no)
    sodium=false
     ;;
   yes)
    AC_CHECK_HEADERS([sodium/core.h],, [
        AC_MSG_ERROR([sodium/core.h header not found or not usable])
    ])
    AC_CHECK_LIB(sodium, [sodium_init], [SODIUM_LIBS="-lsodium"],[
            AC_MSG_ERROR([Could not find libsodium])
    ])
    sodium=true
     ;;
   *)

    # determine if library is installed
    if test -d "$with_sodium/lib"; then
        LDFLAGS="-L$with_sodium/lib $LDFLAGS"
        CXXFLAGS="-I$with_sodium/include $CXXFLAGS"
        CPPFLAGS="-I$with_sodium/include $CPPFLAGS"

        AC_CHECK_HEADERS(sodium/core.h,
         SODIUM_CXXFLAGS="-I$with_sodium/include"
         SODIUM_CPPFLAGS="-I$with_sodium/include"
         SODIUM_LDFLAGS="-L$with_sodium/lib",
         AC_MSG_ERROR([sodium/sodium.h header not found or not usable])
         )
    # assume we are using sodium source directory
    else
        LDFLAGS="-L$with_sodium/src/libsodium/.libs $LDFLAGS"
        CXXFLAGS="-I$with_sodium/src/libsodium/include $CXXFLAGS"
        CPPFLAGS="-I$with_sodium/src/libsodium/include $CPPFLAGS"

        AC_CHECK_HEADERS(sodium/core.h,
         SODIUM_CXXFLAGS="-I$with_sodium/src/libsodium/include"
         SODIUM_CPPFLAGS="-I$with_sodium/src/libsodium/include"
         SODIUM_LDFLAGS="-L$with_sodium/src/libsodium/.libs",
         AC_MSG_ERROR([sodium/core.h header not found or not usable])
         )
    fi

    AC_CHECK_LIB(sodium, [sodium_init], [SODIUM_LIBS="-lsodium"],[
            AC_MSG_ERROR([Could not find libsodium])
    ])

    sodium=true
    ;;
   esac
  ],
  [AC_MSG_RESULT([--with-sodium not specified])
    AC_CHECK_HEADERS([sodium/core.h], [sodium=true], [])
    AC_CHECK_LIB(sodium, [sodium_init], [SODIUM_LIBS="-lsodium"],[])
    ]
  )

SDK_CXXFLAGS="$SDK_CXXFLAGS $SODIUM_CXXFLAGS"
SDK_CPPFLAGS="$SDK_CPPFLAGS $SODIUM_CPPFLAGS"
SDK_LDFLAGS="$SDK_LDFLAGS $SODIUM_LDFLAGS"
SDK_LIBS="$SDK_LIBS $SODIUM_LIBS"

# if test
fi

if test "x$sodium" = "xtrue" ; then
    AC_DEFINE(USE_SODIUM, [1], [Define to use libsodium])
else
    AC_DEFINE(USE_SODIUM, [0], [Define to use libsodium])
fi
AM_CONDITIONAL([USE_SODIUM], [test "x$sodium" = "xtrue"])

#restore
LDFLAGS="$SAVE_LDFLAGS"
CXXFLAGS="$SAVE_CXXFLAGS"
CPPFLAGS="$SAVE_CPPFLAGS"
])
