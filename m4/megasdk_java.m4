# check for Java headers and libraries presence
# define BUILD_JAVA

AC_DEFUN([MEGASDK_CHECK_JAVA],[

# Java
AC_MSG_CHECKING([if building Java bindings])
AC_ARG_ENABLE(java,
    AS_HELP_STRING([--enable-java], [build Java language bindings]),
    [AC_MSG_RESULT([yes])],
    [
     AC_MSG_RESULT([no])
     enable_java=no]
)
AC_ARG_WITH(java-include-dir,
    AS_HELP_STRING([--with-java-include-dir=DIR], [look in DIR for Java headers]),
	[JAVA_INCLUDE_DIR=$withval],)
AC_SUBST(JAVA_INCLUDE_DIR)

if test "x$enable_java" = "xyes" ; then
    AX_PKG_SWIG(2.0.0, [], [
        AC_MSG_ERROR([SWIG executable not found!])
    ])
    AX_SWIG_ENABLE_CXX
    AX_SWIG_MULTI_MODULE_SUPPORT

    if test -z "$SWIG"; then
        AC_MSG_ERROR([SWIG executable not found!])
    fi

    AC_CHECK_PROG(JAVA, java, yes, no)
    if test "x$JAVA" = "xno"; then
      AC_MSG_ERROR([no java binary in PATH])
    fi
    AC_CHECK_PROG(JAVAC, javac, yes, no)
    if test "x$JAVAC" = "xno"; then
      AC_MSG_ERROR([no javac binary in PATH])
    fi
    AC_CHECK_PROG(JAR, jar, yes, no)
    if test "x$JAR" = "xno"; then
      AC_MSG_ERROR([no jar binary in PATH])
    fi

    SAVE_CPPFLAGS=$CPPFLAGS
    CPPFLAGS="$CPPFLAGS -I$JAVA_INCLUDE_DIR"

    # on Fedora / CentOS jni_md.h header is not included
    if test -d "$JAVA_INCLUDE_DIR/linux"; then
        CPPFLAGS="$CPPFLAGS -I$JAVA_INCLUDE_DIR/linux"
        JAVA_INCLUDE_DIR_LINUX="$JAVA_INCLUDE_DIR/linux"
        AC_SUBST(JAVA_INCLUDE_DIR_LINUX)
    fi

    AC_CHECK_HEADER(jni.h,, [AC_MSG_ERROR([could not find jni.h, please specify JAVA include directory using --with-java-include-dir option.])])
    CPPFLAGS=$SAVE_CPPFLAGS
fi
AM_CONDITIONAL([BUILD_JAVA], [test "$enable_java" = "yes"])

])
