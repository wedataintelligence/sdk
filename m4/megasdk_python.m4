# check for Python headers and libraries presence
# define BUILD_PYTHON

AC_DEFUN([MEGASDK_CHECK_PYTHON],[

# Python
AC_MSG_CHECKING([if building Python bindings])
AC_ARG_ENABLE(python,
    AS_HELP_STRING([--enable-python], [build Python language bindings]),
    [AC_MSG_RESULT([$enableval])],
    [
     AC_MSG_RESULT([$enableval])
     enable_python=no]
)

USE_PYTHON3=no
if test "x$enable_python" = "xyes" ; then

    AC_ARG_WITH(python3,
      AS_HELP_STRING([--with-python3], [build Python 3 language bindings]),
      [
       case $with_python3 in
       yes)
        USE_PYTHON3=yes
         ;;
       *)
        USE_PYTHON3=yes
        ;;
       esac
      ],
    )

    if test "x$USE_PYTHON3" = "xyes" ; then
        SWIG_FLAGS="-py3"
	    AC_SUBST([SWIG_FLAGS])

        AM_PATH_PYTHON(3)
        AX_PYTHON_DEVEL(>= '3.0.0')
    else
        AM_PATH_PYTHON
        AX_PYTHON_DEVEL
    fi

    AX_PKG_SWIG(2.0.0, [], [
        AC_MSG_ERROR([SWIG executable not found!])
    ])
    AX_SWIG_ENABLE_CXX
    AX_SWIG_MULTI_MODULE_SUPPORT
    AX_SWIG_PYTHON

    if test -z "$SWIG"; then
        AC_MSG_ERROR([SWIG executable not found!])
    fi

    if test -z "$PYTHON_VERSION"; then
        AC_MSG_ERROR([Python development files not found!])
    fi

fi
AM_CONDITIONAL([BUILD_PYTHON], [test "$enable_python" = "yes"])

])
