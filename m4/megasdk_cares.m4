# check for c-ares headers and libraries presence
# set "check_cares" to "true" to perform the check
# define HAVE_CARES

AC_DEFUN([MEGASDK_CHECK_CARES],[
# save
SAVE_LDFLAGS="$LDFLAGS"
SAVE_CXXFLAGS="$CXXFLAGS"
SAVE_CPPFLAGS="$CPPFLAGS"

cares=false
if test "x$check_cares" = "xtrue"; then

AC_MSG_CHECKING(for c-ares)
AC_ARG_WITH([cares],
  AS_HELP_STRING(--with-cares=PATH, base of c-ares installation),
  [
   case $with_cares in
   no)
     AC_MSG_ERROR([Please specify path to c-ares installation directory!])
     ;;
   yes)
        AC_CHECK_HEADERS([ares.h], [],
            AC_MSG_ERROR([ares.h header not found or not usable])
        )
        AC_CHECK_LIB(cares, [ares_library_init], [CARES_LIBS="-lcares"],
            AC_MSG_ERROR([Could not find c-ares library!])
        )

        AC_SUBST(CARES_LIBS)
        cares=true
     ;;
   *)
    # determine if library is installed
    LDFLAGS="-L$with_cares/lib $LDFLAGS"
    CXXFLAGS="-I$with_cares/include $CXXFLAGS"

    CARES_LDFLAGS="-L$with_cares/lib"
    CARES_FLAGS="-I$with_cares/include"

    AC_CHECK_HEADERS([ares.h], [],
        AC_MSG_ERROR([ares.h header not found or not usable])
    )
    AC_CHECK_LIB(cares, [ares_library_init], [CARES_LIBS="-lcares"],
        AC_MSG_ERROR([Could not find c-ares library!])
    )

    AC_SUBST(CARES_FLAGS)
    AC_SUBST(CARES_LDFLAGS)
    AC_SUBST(CARES_LIBS)
    cares=true

    #restore
    LDFLAGS=$SAVE_LDFLAGS
    CXXFLAGS=$SAVE_CXXFLAGS
    CPPFLAGS=$SAVE_CPPFLAGS
    ;;
   esac
  ],
  [
    AC_MSG_RESULT([--with-cares not specified])

    AC_CHECK_HEADERS([ares.h], [],
        AC_MSG_ERROR([ares.h header not found or not usable])
    )
    AC_CHECK_LIB(cares, [ares_library_init], [CARES_LIBS="-lcares"],
        AC_MSG_ERROR([Could not find c-ares library!])
    )

    AC_SUBST(CARES_LIBS)
    cares=true
  ]
)

# if test
fi

# define on all platforms
if test "x$cares" = "xtrue" ; then
    AC_DEFINE(USE_CARES, [1], [Define to use c-ares])
else
    AC_DEFINE(USE_CARES, [0], [Define to use c-ares])
fi
AM_CONDITIONAL(HAVE_CARES, test x$cares = xtrue)


#restore
LDFLAGS="$SAVE_LDFLAGS"
CXXFLAGS="$SAVE_CXXFLAGS"
CPPFLAGS="$SAVE_CPPFLAGS"
])
