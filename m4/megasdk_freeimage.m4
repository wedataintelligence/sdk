# check for freeimage headers and libraries presence
# define USE_FREEIMAGE

AC_DEFUN([MEGASDK_CHECK_FREEIMAGE],[

# save
SAVE_LDFLAGS="$LDFLAGS"
SAVE_CXXFLAGS="$CXXFLAGS"
SAVE_CPPFLAGS="$CPPFLAGS"

freeimage=false
if test "x$check_freeimage" = "xtrue"; then
AC_MSG_CHECKING(for FreeImage)
AC_ARG_WITH(freeimage,
  AS_HELP_STRING(--with-freeimage=PATH, base of FreeImage installation),
  [AC_MSG_RESULT($with_freeimage)
   case $with_freeimage in
   no)
     freeimage=false
     ;;
   yes)
    AC_CHECK_HEADERS([FreeImage.h],, [
        AC_MSG_ERROR([FreeImage.h header not found or not usable])
    ])
    AC_CHECK_LIB([freeimage], [main], [FI_LIBS="-lfreeimage"], [
        AC_MSG_ERROR([FreeImage library is not found!])])

     freeimage=true
     ;;
   *)

    # determine if library is installed
    if test -d "$with_freeimage/lib"; then
        LDFLAGS="-L$with_freeimage/lib $LDFLAGS"
        CXXFLAGS="-I$with_freeimage/include $CXXFLAGS"
        CPPFLAGS="-I$with_freeimage/include $CPPFLAGS"

        AC_CHECK_HEADERS([FreeImage.h],[
         FI_LDFLAGS="-L$with_freeimage/lib"
         FI_CXXFLAGS="-I$with_freeimage/include"
         FI_CPPFLAGS="-I$with_freeimage/include"],
         AC_MSG_ERROR([FreeImage.h header not found or not usable])
        )
    else
        LDFLAGS="-L$with_freeimage/Dist $LDFLAGS"
        CXXFLAGS="-I$with_freeimage/Dist $CXXFLAGS"
        CPPFLAGS="-I$with_freeimage/Dist $CPPFLAGS"

        AC_CHECK_HEADERS([FreeImage.h],[
         FI_LDFLAGS="-L$with_freeimage/Dist"
         FI_CXXFLAGS="-I$with_freeimage/Dist"
         FI_CPPFLAGS="-I$with_freeimage/Dist"],
         AC_MSG_ERROR([FreeImage.h header not found or not usable])
        )
    fi

    # check and set FI library
    AC_CHECK_LIB([freeimage], [main], [FI_LIBS="-lfreeimage"], [
        AC_MSG_ERROR([FreeImage library is not found!])])

    #restore
    LDFLAGS=$SAVE_LDFLAGS
    CXXFLAGS=$SAVE_CXXFLAGS
    CPPFLAGS=$SAVE_CPPFLAGS
    freeimage=true
    ;;
   esac
  ],
  [AC_MSG_RESULT([--with-freeimage not specified])
    AC_CHECK_HEADERS([FreeImage.h],, [
        AC_MSG_ERROR([FreeImage.h header not found or not usable])
    ])
    AC_CHECK_LIB([freeimage], [main], [FI_LIBS="-lfreeimage"], [
        AC_MSG_ERROR([FreeImage library is not found!])])

     freeimage=true
  ]
  )

SDK_CXXFLAGS="$SDK_CXXFLAGS $FI_CXXFLAGS"
SDK_CPPFLAGS="$SDK_CPPFLAGS $FI_CPPFLAGS"
SDK_LDFLAGS="$SDK_LDFLAGS $FI_LDFLAGS"
SDK_LIBS="$SDK_LIBS $FI_LIBS"

# if test
fi

if test x$enable_static = xyes; then
    AC_DEFINE(FREEIMAGE_LIB, [1], [Define to use FreeImage as a static library.])
    AM_CONDITIONAL([FREEIMAGE_LIB], [test "x$freeimage" = "xtrue"])
else
    AC_DEFINE(FREEIMAGE_LIB, [0], [Define to use FreeImage as a static library.])
    AM_CONDITIONAL([FREEIMAGE_LIB], [test "x$freeimage" = "xnone"])
fi

if test "x$freeimage" = "xtrue" ; then
    AC_DEFINE(USE_FREEIMAGE, [1], [Define to use FreeImage library.])
else
    AC_DEFINE(USE_FREEIMAGE, [0], [Define to use FreeImage library.])
fi
AM_CONDITIONAL([USE_FREEIMAGE], [test "x$freeimage" = "xtrue"])

#restore
LDFLAGS="$SAVE_LDFLAGS"
CXXFLAGS="$SAVE_CXXFLAGS"
CPPFLAGS="$SAVE_CPPFLAGS"
])
