# check for c-ares headers and libraries presence
# define USE_CURL

m4_include([m4/curlchk.m4])

AC_DEFUN([MEGASDK_CHECK_CURL],[
# save
SAVE_LDFLAGS="$LDFLAGS"
SAVE_CXXFLAGS="$CXXFLAGS"
SAVE_CPPFLAGS="$CPPFLAGS"

if test "x$check_curl" = "xtrue"; then

AC_ARG_ENABLE([curl-checks], AS_HELP_STRING([--enable-curl-checks], [enable cURL checks [default=yes]]), [enable_curl_checks=$enableval], [enable_curl_checks=yes])

# check for cURL library
AC_ARG_WITH([curl],
  AS_HELP_STRING(--with-curl=PATH, base of cURL installation),
  [
   case $with_curl in
   no)
     AC_MSG_ERROR([Please specify path to cURL installation directory!])
     ;;
   yes)
        LIBCURL_LIBS="-lcurl"
        SAVE_LIBS=$LIBS
        LIBS="-lcurl $LIBS"

        AC_CHECK_HEADERS([curl/curl.h], [],
            AC_MSG_ERROR([curl.h header not found or not usable])
        )
        AC_CHECK_LIB(curl, [main], [],
            AC_MSG_ERROR([Could not find libcurl!])
        )

        AC_SUBST(LIBCURL_LIBS)

        if test "x$enable_curl_checks" = "xyes" ; then
            CURL_CHK()
        else
            AC_MSG_NOTICE([skipping cURL checks.])
        fi

        LIBS=$SAVE_LIBS
     ;;
   *)

    # determine if library is installed
    LDFLAGS="-L$with_curl/lib $LDFLAGS"
    CXXFLAGS="-I$with_curl/include $CXXFLAGS"
    SAVE_LIBS=$LIBS
    LIBS="-lcurl $LIBS"

    LIBCURL_LIBS="-L$with_curl/lib -lcurl"
    LIBCURL_FLAGS="-I$with_curl/include"

    AC_CHECK_HEADERS([curl/curl.h], [],
        AC_MSG_ERROR([curl.h header not found or not usable])
    )

    AC_CHECK_LIB(curl, [main], [],
        AC_MSG_ERROR([Could not find libcurl!])
    )

    AC_SUBST(LIBCURL_FLAGS)
    AC_SUBST(LIBCURL_LIBS)

    if test "x$enable_curl_checks" = "xyes" ; then
        CURL_CHK()
    else
        AC_MSG_NOTICE([skipping cURL checks.])
    fi

    #restore
    LIBS=$SAVE_LIBS
    LDFLAGS=$SAVE_LDFLAGS
    CXXFLAGS=$SAVE_CXXFLAGS
    CPPFLAGS=$SAVE_CPPFLAGS
     ;;
   esac
  ],
  [
    LIBCURL_LIBS="-lcurl"
    SAVE_LIBS=$LIBS
    LIBS="-lcurl $LIBS"

    AC_CHECK_HEADERS([curl/curl.h], [],
        AC_MSG_ERROR([curl.h header not found or not usable])
    )
    AC_CHECK_LIB(curl, [main], [],
        AC_MSG_ERROR([Could not find libcurl!])
    )

    AC_SUBST(LIBCURL_LIBS)

    if test "x$enable_curl_checks" = "xyes" ; then
        CURL_CHK()
    else
        AC_MSG_NOTICE([skipping cURL checks.])
    fi
    LIBS=$SAVE_LIBS
  ]
)

SDK_CXXFLAGS="$SDK_CXXFLAGS $LIBCURL_FLAGS"
SDK_CPPFLAGS="$SDK_CPPFLAGS $LIBCURL_FLAGS"
SDK_LIBS="$SDK_LIBS $LIBCURL_LIBS"

# if test
fi


#restore
LDFLAGS="$SAVE_LDFLAGS"
CXXFLAGS="$SAVE_CXXFLAGS"
CPPFLAGS="$SAVE_CPPFLAGS"
])
