# check for sync subsystem
# set "check_sync" to "true" to perform the check
# define ENABLE_SYNC

AC_DEFUN([MEGASDK_CHECK_SYNC],[

if test "x$check_sync" = "xtrue"; then

AC_ARG_ENABLE(sync,
    AS_HELP_STRING([--enable-sync], [include sync subsystem [default=yes]]),
    [enable_sync=$enableval],
    [enable_sync=yes])
if test x$enable_sync = xyes; then
    AC_DEFINE(ENABLE_SYNC, 1, [Defined if sync subsystem is enabled])
fi

else
    enable_sync=no
fi

])
