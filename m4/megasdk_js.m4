# check for EMSCRIPTEN application presence
# define BUILD_JS

AC_DEFUN([MEGASDK_CHECK_JS],[
#save
SAVE_LDFLAGS="$LDFLAGS"
SAVE_CXXFLAGS="$CXXFLAGS"
SAVE_CPPFLAGS="$CPPFLAGS"

AC_MSG_CHECKING([if building JavaScript bindings])
AC_ARG_ENABLE(javascript,
    AS_HELP_STRING([--enable-javascript], [build JavaScript language bindings]),
    [AC_MSG_RESULT([yes])],
    [AC_MSG_RESULT([no])
     enable_javascript=no]
)

if test "x$enable_javascript" = "xyes" ; then

AC_ARG_WITH([emscripten],
  AS_HELP_STRING(--with-emscripten=PATH, base of emscripten installation),
  [
   case $with_emscripten in
   no)
     AC_MSG_ERROR([Please specify path to emscripten installation directory!])
     ;;
   yes)
    EMSCRIPTEN_ROOT="/usr/share/emscripten"
    EMCC="$EMSCRIPTEN_ROOT/emcc"
    AC_CHECK_PROG(HAVE_EMCC, emcc, true, false, $EMSCRIPTEN_ROOT)
    if test "x$HAVE_EMCC" != "xtrue" ; then
        AC_MSG_ERROR([emcc application not found])
    fi

    CXXFLAGS="-I$EMSCRIPTEN_ROOT/system/include/emscripten/ $CXXFLAGS"
    EMSCRIPTEN_FLAGS="-I$EMSCRIPTEN_ROOT/system/include/emscripten/"
    AC_CHECK_HEADERS([emscripten.h], [],
        AC_MSG_ERROR([emscripten.h header not found or not usable])
    )

    AC_SUBST(EMSCRIPTEN_FLAGS)
    AC_SUBST(EMSCRIPTEN_ROOT)
    AC_SUBST(EMCC)
     ;;
   *)
    EMSCRIPTEN_ROOT="$with_emscripten"
    EMCC="$EMSCRIPTEN_ROOT/emcc"
    AC_CHECK_PROG(HAVE_EMCC, emcc, true, false, $EMSCRIPTEN_ROOT)
    if test "x$HAVE_EMCC" != "xtrue" ; then
        AC_MSG_ERROR([emcc application not found])
    fi

    CXXFLAGS="-I$EMSCRIPTEN_ROOT/system/include/emscripten/ $CXXFLAGS"
    EMSCRIPTEN_FLAGS="-I$EMSCRIPTEN_ROOT/system/include/emscripten/"
    AC_CHECK_HEADERS([emscripten.h], [],
        AC_MSG_ERROR([emscripten.h header not found or not usable])
    )

    AC_SUBST(EMSCRIPTEN_FLAGS)
    AC_SUBST(EMSCRIPTEN_ROOT)
    AC_SUBST(EMCC)
     ;;
   esac
  ],
  [
    EMSCRIPTEN_ROOT="/usr/share/emscripten"
    EMCC="$EMSCRIPTEN_ROOT/emcc"
    AC_CHECK_PROG(HAVE_EMCC, emcc, true, false, $EMSCRIPTEN_ROOT)
    if test "x$HAVE_EMCC" != "xtrue" ; then
        AC_MSG_ERROR([emcc application not found])
    fi

    CXXFLAGS="-I$EMSCRIPTEN_ROOT/system/include/emscripten/ $CXXFLAGS"
    EMSCRIPTEN_FLAGS="-I$EMSCRIPTEN_ROOT/system/include/emscripten/"
    AC_CHECK_HEADERS([emscripten.h], [],
        AC_MSG_ERROR([emscripten.h header not found or not usable])
    )

    AC_SUBST(EMSCRIPTEN_FLAGS)
    AC_SUBST(EMSCRIPTEN_ROOT)
    AC_SUBST(EMCC)
  ]
)
    AC_DEFINE(EMSCRIPTEN, [1], [Define to build JS bindings])
fi

AM_PATH_PYTHON
if test -z "$PYTHON_VERSION"; then
    AC_MSG_ERROR([Python executable not found!])
fi

AM_CONDITIONAL([BUILD_JS], [test "$enable_javascript" = "yes"])

#restore
LDFLAGS="$SAVE_LDFLAGS"
CXXFLAGS="$SAVE_CXXFLAGS"
CPPFLAGS="$SAVE_CPPFLAGS"

])
