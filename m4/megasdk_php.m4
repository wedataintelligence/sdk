# check for PHP headers and libraries presence
# define BUILD_PHP

AC_DEFUN([MEGASDK_CHECK_PHP],[

AC_MSG_CHECKING([if building PHP bindings])
AC_ARG_ENABLE(php,
    AS_HELP_STRING([--enable-php], [build PHP language bindings]),
    [AC_MSG_RESULT([yes])],
    [AC_MSG_RESULT([no])
     enable_php=no]
)
if test "x$enable_php" = "xyes" ; then
    AC_CHECK_PROGS(PHPCONFIG, php-config php5-config php-config5 php4-config php-config4)
    AC_MSG_CHECKING(for PHP header files)
    PHPINC="`$PHPCONFIG --includes 2>/dev/null`"
    if test "$PHPINC"; then
        AC_MSG_RESULT($PHPINC)
    else
        dirs="/usr/include/php /usr/local/include/php /usr/include/php5 /usr/local/include/php5 /usr/include/php4 /usr/local/include/php4 /usr/local/apache/php"
        for i in $dirs; do
            if test -r $i/main/php_config.h -o -r $i/main/php_version.h; then
                AC_MSG_RESULT($i is found)
                PHPEXT="$i"
                PHPINC="-I$PHPEXT -I$PHPEXT/main -I$PHPEXT/TSRM -I$PHPEXT/Zend"
                break;
            fi
        done
    fi
    if test -z "$PHPINC"; then
        AC_MSG_ERROR([PHP headers not found!])
    fi

    AC_MSG_CHECKING(for PHP extension-dir)
    PHPLIBDIR="`$PHPCONFIG --extension-dir 2>/dev/null | sed "s#/lib/#/lib${LIBPOSTFIX}/#g"`"
    if test ! -z "$PHPLIBDIR"; then
        AC_MSG_RESULT($PHPLIBDIR)
    else
        AC_MSG_ERROR([PHP development files not found!])
    fi

    AC_SUBST(PHPINC)
	AC_SUBST(PHPEXT)
	AC_SUBST(PHPLIBDIR)

    AX_PKG_SWIG(2.0.0, [], [
        AC_MSG_ERROR([SWIG executable not found!])
    ])
    AX_SWIG_ENABLE_CXX
    AX_SWIG_MULTI_MODULE_SUPPORT

    if test -z "$SWIG"; then
        AC_MSG_ERROR([SWIG executable not found!])
    fi
fi
AM_CONDITIONAL([BUILD_PHP], [test "$enable_php" = "yes"])

])
