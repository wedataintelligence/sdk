# check for CryptoPP headers and libraries presence
# set "check_cryptopp" to "true" to perform the check
# define USE_CRYPTOPP

AC_DEFUN([MEGASDK_CHECK_CRYPTOPP],[

# save
SAVE_LDFLAGS="$LDFLAGS"
SAVE_CXXFLAGS="$CXXFLAGS"
SAVE_CPPFLAGS="$CPPFLAGS"

cryptopp=false
if test "x$check_cryptopp" = "xtrue"; then

CRYPTO_LIBS="-lcryptopp"
AC_MSG_CHECKING(for libcryptopp)
AC_ARG_WITH(cryptopp,
  AS_HELP_STRING(--with-cryptopp=PATH, base of libcrypto installation),
  [
   case $with_cryptopp in
   no)
    cryptopp=false
     ;;
   yes)
    AC_CHECK_HEADERS([cryptopp/cryptlib.h],, [
        AC_MSG_ERROR([cryptopp/cryptlib.h header not found or not usable])
    ])
    AC_CHECK_LIB(cryptopp, [main], [CRYPTO_LIBS="-lcryptopp"],[
            AC_MSG_ERROR([Could not find libcryptopp])
    ])
    cryptopp=true
     ;;
   *)

    # determine if library is installed
    if test -d "$with_cryptopp/lib"; then
        LDFLAGS="-L$with_cryptopp/lib $LDFLAGS"
        CXXFLAGS="-I$with_cryptopp/include $CXXFLAGS"
        CPPFLAGS="-I$with_cryptopp/include $CPPFLAGS"

        AC_CHECK_HEADERS(cryptopp/cryptlib.h,
         CRYPTO_CXXFLAGS="-I$with_cryptopp/include"
         CRYPTO_CPPFLAGS="-I$with_cryptopp/include"
         CRYPTO_LDFLAGS="-L$with_cryptopp/lib",
         AC_MSG_ERROR([cryptopp/cryptlib.h header not found or not usable])
         )
    # assume we are using crypto source directory
    else
        LDFLAGS="-L$with_cryptopp/cryptopp $LDFLAGS"
        CXXFLAGS="-I$with_cryptopp $CXXFLAGS"
        CPPFLAGS="-I$with_cryptopp $CPPFLAGS"

        AC_CHECK_HEADERS(cryptopp/cryptlib.h,
         CRYPTO_CXXFLAGS="-I$with_cryptopp"
         CRYPTO_CPPFLAGS="-I$with_cryptopp"
         CRYPTO_LDFLAGS="-L$with_cryptopp/cryptopp",
         AC_MSG_ERROR([cryptopp/cryptlib.h header not found or not usable])
         )
    fi

    AC_CHECK_LIB(cryptopp, [main], [CRYPTO_LIBS="-lcryptopp"],[
            AC_MSG_ERROR([Could not find libcryptopp])
    ])

    cryptopp=true
    ;;
   esac
  ],
  [AC_MSG_RESULT([--with-cryptopp not specified])
    AC_CHECK_HEADERS([cryptopp/cryptlib.h],, [
        AC_MSG_ERROR([cryptopp/cryptlib.h header not found or not usable])
    ])
    AC_CHECK_LIB(cryptopp, [main], [CRYPTO_LIBS="-lcryptopp"],[
            AC_MSG_ERROR([Could not find libcryptopp])
    ])
    cryptopp=true
  ])

SDK_CXXFLAGS="$SDK_CXXFLAGS $CRYPTO_CXXFLAGS"
SDK_CPPFLAGS="$SDK_CPPFLAGS $CRYPTO_CPPFLAGS"
SDK_LDFLAGS="$SDK_LDFLAGS $CRYPTO_LDFLAGS"
SDK_LIBS="$SDK_LIBS $CRYPTO_LIBS"

# if test
fi

if test "x$cryptopp" = "xtrue" ; then
    AC_DEFINE(USE_CRYPTOPP, [1], [Define to use libcryptopp])
fi
AM_CONDITIONAL([USE_CRYPTOPP], [test "x$cryptopp" = "xtrue"])

#restore
LDFLAGS="$SAVE_LDFLAGS"
CXXFLAGS="$SAVE_CXXFLAGS"
CPPFLAGS="$SAVE_CPPFLAGS"
])
