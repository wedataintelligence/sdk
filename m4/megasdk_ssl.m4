# check for OpenSSL headers and libraries presence
# define HAVE_OPENSSL

AC_DEFUN([MEGASDK_CHECK_SSL],[
# save
SAVE_LDFLAGS="$LDFLAGS"
SAVE_CXXFLAGS="$CXXFLAGS"
SAVE_CPPFLAGS="$CPPFLAGS"

openssl=false
if test "x$check_ssl" = "xtrue"; then

AC_MSG_CHECKING(for OpenSSL)
AC_ARG_WITH([openssl],
  AS_HELP_STRING(--with-openssl=PATH, base of OpenSSL installation),
  [
   case $with_openssl in
   no)
     AC_MSG_ERROR([Please specify path to OpenSSL installation directory!])
     ;;
   yes)
        AC_CHECK_HEADERS([openssl/ssl.h], [],
            AC_MSG_ERROR([ssl.h header not found or not usable])
        )
        LIBS="-lcrypto $LIBS"
        AC_CHECK_LIB(ssl, [SSL_new], [LIBSSL_LIBS="-lssl -lcrypto"],
            AC_MSG_ERROR([Could not find OpenSSL library!])
        )
        LIBS=$SAVE_LIBS
        AC_SUBST(LIBSSL_LIBS)
        openssl=true
     ;;
   *)
    # determine if library is installed
    LDFLAGS="-L$with_openssl/lib $LDFLAGS"
    CXXFLAGS="-I$with_openssl/include $CXXFLAGS"

    LIBSSL_LDFLAGS="-L$with_openssl/lib"
    LIBSSL_FLAGS="-I$with_openssl/include"
    SAVE_LIBS=$LIBS
    LIBS="-lcrypto $LIBS"

    AC_CHECK_HEADERS([openssl/ssl.h], [],
        AC_MSG_ERROR([ssl.h header not found or not usable])
    )
    AC_CHECK_LIB(ssl, [SSL_new], [LIBSSL_LIBS="-lssl -lcrypto"],
        AC_MSG_ERROR([Could not find OpenSSL library!])
    )

    AC_SUBST(LIBSSL_FLAGS)
    AC_SUBST(LIBSSL_LDFLAGS)
    AC_SUBST(LIBSSL_LIBS)
    openssl=true

    #restore
    LIBS=$SAVE_LIBS
    LDFLAGS=$SAVE_LDFLAGS
    CXXFLAGS=$SAVE_CXXFLAGS
    CPPFLAGS=$SAVE_CPPFLAGS
    ;;
   esac
  ],
  [
    AC_MSG_RESULT([--with-openssl not specified])

    AC_CHECK_HEADERS([openssl/ssl.h], [],
        AC_MSG_ERROR([ssl.h header not found or not usable])
    )
    LIBS="-lcrypto $LIBS"
    AC_CHECK_LIB(ssl, [SSL_new], [LIBSSL_LIBS="-lssl -lcrypto"],
        AC_MSG_ERROR([Could not find OpenSSL library!])
    )
    LIBS=$SAVE_LIBS
    AC_SUBST(LIBSSL_LIBS)
    openssl=true
  ]
)

SDK_CXXFLAGS="$SDK_CXXFLAGS $LIBSSL_FLAGS"
SDK_CPPFLAGS="$SDK_CPPFLAGS $LIBSSL_FLAGS"
SDK_LDFLAGS="$SDK_LDFLAGS $LIBSSL_LDFLAGS"
SDK_LIBS="$SDK_LIBS $LIBSSL_LIBS"

# if test
fi

if test "x$openssl" = "xtrue" ; then
    AC_DEFINE(USE_OPENSSL, [1], [Define to use OpenSSL])
else
    AC_DEFINE(USE_OPENSSL, [0], [Define to use OpenSSL])
fi
AM_CONDITIONAL(HAVE_OPENSSL, test x$openssl = xtrue)

#restore
LDFLAGS="$SAVE_LDFLAGS"
CXXFLAGS="$SAVE_CXXFLAGS"
CPPFLAGS="$SAVE_CPPFLAGS"
])
