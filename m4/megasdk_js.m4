# check for EMSCRIPTEN application presence
# define BUILD_JS

AC_DEFUN([MEGASDK_CHECK_JS],[

AC_MSG_CHECKING([if building JavaScript bindings])
AC_ARG_ENABLE(javascript,
    AS_HELP_STRING([--enable-javascript], [build JavaScript language bindings]),
    [AC_MSG_RESULT([yes])],
    [AC_MSG_RESULT([no])
     enable_javascript=no]
)

if test "x$enable_javascript" = "xyes" ; then
    AC_CHECK_PROG(HAVE_EMCC, emcc, true)

    if test "x$HAVE_EMCC" != "xtrue" ; then
        AC_MSG_ERROR([emcc application not found])
    fi
fi

AM_CONDITIONAL([BUILD_JS], [test "$enable_javascript" = "yes"])
])
