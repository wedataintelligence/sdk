# check for WinHTTP headers and libraries presence (only on Windows platform)
# set "check_winhttp" to "true" to perform the check

AC_DEFUN([MEGASDK_CHECK_WINHTTP],[
# save
SAVE_LDFLAGS="$LDFLAGS"
SAVE_CXXFLAGS="$CXXFLAGS"
SAVE_CPPFLAGS="$CPPFLAGS"

if test "x$check_winhttp" = "xtrue"; then

AC_MSG_CHECKING(for WinHTTP)
AC_ARG_WITH(winhttp,
  AS_HELP_STRING(--with-winhttp=PATH, base of WinHTTP installation),
  [AC_MSG_RESULT($with_winhttp)
   case $with_winhttp in
   no)
     ;;
   *)
    WINHTTP_LDFLAGS="-L$with_winhttp"
    WINHTTP_LIBS="-lwinhttp"
    WINHTTP_CXXFLAGS="-I$with_winhttp"
    WINHTTP_CPPFLAGS="-I$with_winhttp"
    ;;
   esac
  ],
    AC_MSG_ERROR([WinHTTP.h header not found or not usable])
  )
  AC_SUBST(WINHTTP_LDFLAGS)
  AC_SUBST(WINHTTP_LIBS)
  AC_SUBST(WINHTTP_CXXFLAGS)
  AC_SUBST(WINHTTP_CPPFLAGS)

SDK_CXXFLAGS="$SDK_CXXFLAGS $WINHTTP_CPPFLAGS"
SDK_CPPFLAGS="$SDK_CPPFLAGS $WINHTTP_CXXFLAGS"
SDK_LDFLAGS="$SDK_LDFLAGS $WINHTTP_LDFLAGS"
SDK_LIBS="$SDK_LIBS $WINHTTP_LIBS"

# if test
fi

#restore
LDFLAGS="$SAVE_LDFLAGS"
CXXFLAGS="$SAVE_CXXFLAGS"
CPPFLAGS="$SAVE_CPPFLAGS"
])
