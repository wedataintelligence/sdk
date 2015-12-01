
AC_DEFUN([MEGASDK_CHECK_EXAMPLES],[

if test "x$check_examples" = "xtrue"; then

# Examples
AC_MSG_CHECKING([if building example applications])
AC_ARG_ENABLE(examples,
    AS_HELP_STRING([--enable-examples], [build example applications]),
    [], [enable_examples=yes])
AC_MSG_RESULT([$enable_examples])


USE_FUSE=0
# if Examples are enables, check for specific libraries
if test "x$enable_examples" = "xyes" ; then
    #termcap
    AC_MSG_CHECKING(for termcap)
    AC_ARG_WITH(termcap,
      AS_HELP_STRING(--with-termcap=PATH, base of termcap installation),
      [AC_MSG_RESULT($with_termcap)
       case $with_termcap in
       no)
         ;;
       yes)
        AC_CHECK_LIB([termcap], [tputs], [TERMCAP_LIBS="-ltermcap"],
            [AC_MSG_NOTICE([termcap library not found or not usable.])]
        )
        ;;
       *)

        # determine if library is installed
        if test -d "$with_termcap/lib"; then
            LDFLAGS="-L$with_termcap/lib $LDFLAGS"
            CXXFLAGS="-I$with_termcap/include $CXXFLAGS"
            CPPFLAGS="-I$with_termcap/include $CPPFLAGS"

            AC_CHECK_HEADERS([termcap.h],[
                TERMCAP_LDFLAGS="-L$with_termcap/lib"
                TERMCAP_CXXFLAGS="-I$with_termcap/include"
                TERMCAP_CPPFLAGS="-I$with_termcap/include"],
                AC_MSG_NOTICE([termcap.h header not found or not usable])
            )
        else
            LDFLAGS="-L$with_termcap $LDFLAGS"
            CXXFLAGS="-I$with_termcap $CXXFLAGS"
            CPPFLAGS="-I$with_termcap $CPPFLAGS"

            AC_CHECK_HEADERS([termcap.h],[
                TERMCAP_LDFLAGS="-L$with_termcap"
                TERMCAP_CXXFLAGS="-I$with_termcap"
                TERMCAP_CPPFLAGS="-I$with_termcap"],
                AC_MSG_NOTICE([termcap.h header not found or not usable])
            )
        fi

        AC_CHECK_LIB([termcap], [tputs], [TERMCAP_LIBS="-ltermcap"], [
            AC_MSG_NOTICE([termcap library not found or not usable.])])

        #restore
        LDFLAGS=$SAVE_LDFLAGS
        CXXFLAGS=$SAVE_CXXFLAGS
        CPPFLAGS=$SAVE_CPPFLAGS

        ;;
       esac
      ],
      [AC_MSG_RESULT([--with-termcap not specified])
        AC_CHECK_LIB([termcap], [tputs], [TERMCAP_LIBS="-ltermcap"],
            [AC_MSG_NOTICE([termcap library not found or not usable.])]
        )
      ]
    )
    AC_SUBST(TERMCAP_LDFLAGS)
    AC_SUBST(TERMCAP_LIBS)
    AC_SUBST(TERMCAP_CXXFLAGS)
    AC_SUBST(TERMCAP_CPPFLAGS)

      # ReadLine
    AC_MSG_CHECKING(for Readline)
    AC_ARG_WITH(readline,
      AS_HELP_STRING(--with-readline=PATH, base of Readline installation),
      [AC_MSG_RESULT($with_readline)
       case $with_readline in
       no)
        AC_MSG_ERROR([readline library is required for the sample client.])
         ;;
       yes)
        AC_CHECK_HEADERS([readline/readline.h],, [
            AC_MSG_ERROR([readline/readline.h header not found or not usable])
        ])
        # readline requires termcap (or ncurses)
        SAVE_LIBS=$LIBS
        LIBS="$TERMCAP_LIBS $LIBS"
        AC_CHECK_LIB([readline], [rl_save_prompt], [RL_LIBS="-lreadline"], [
            AC_MSG_ERROR([readline library is required for the sample client.])])
        LIBS=$SAVE_LIBS
         ;;
       *)

        # determine if library is installed
        if test -d "$with_readline/lib"; then
            LDFLAGS="-L$with_readline/lib $LDFLAGS"
            CXXFLAGS="-I$with_readline/include $CXXFLAGS"
            CPPFLAGS="-I$with_readline/include $CPPFLAGS"
            AC_CHECK_HEADERS([readline/readline.h], [
             RL_LDFLAGS="-L$with_readline/lib "
             RL_CXXFLAGS="-I$with_readline/include "],
             AC_MSG_ERROR([readline/readline.h header not found or not usable])
            )
        else
            LDFLAGS="-L$with_readline $LDFLAGS"
            CXXFLAGS="-I$with_readline $CXXFLAGS"
            CPPFLAGS="-I$with_readline $CPPFLAGS"
            AC_CHECK_HEADERS([readline/readline.h], [
             RL_LDFLAGS="-L$with_readline"
             RL_CXXFLAGS="-I$with_readline"],
             AC_MSG_ERROR([readline/readline.h header not found or not usable])
            )
        fi

        # readline requires termcap (or ncurses)
        SAVE_LIBS=$LIBS
        LIBS="$TERMCAP_LIBS $LIBS"
        AC_CHECK_LIB([readline], [rl_save_prompt], [RL_LIBS="-lreadline"], [
            AC_MSG_ERROR([readline library is required for the sample client.])])
        LIBS=$SAVE_LIBS

        #restore
        LDFLAGS=$SAVE_LDFLAGS
        CXXFLAGS=$SAVE_CXXFLAGS
        CPPFLAGS=$SAVE_CPPFLAGS
        ;;
       esac
      ],
      [AC_MSG_RESULT([--with-readline not specified])
        AC_CHECK_HEADERS([readline/readline.h],, [
            AC_MSG_ERROR([readline/readline.h header not found or not usable])
        ])
        # readline requires termcap (or ncurses)
        SAVE_LIBS=$LIBS
        LIBS="$TERMCAP_LIBS $LIBS"
        AC_CHECK_LIB([readline], [rl_save_prompt], [RL_LIBS="-lreadline"], [
            AC_MSG_ERROR([readline library is required for the sample client.])])
        LIBS=$SAVE_LIBS
      ]
      )
      AC_SUBST(RL_LDFLAGS)
      AC_SUBST(RL_LIBS)
      AC_SUBST(RL_CXXFLAGS)

    # FUSE
    AC_MSG_CHECKING(for FUSE)
    AC_ARG_WITH(fuse,
      AS_HELP_STRING(--with-fuse=PATH, base of FUSE installation),
      [AC_MSG_RESULT($with_fuse)
       case $with_fuse in
       no)
         ;;
       yes)
        CXXFLAGS="$CXXFLAGS -D_FILE_OFFSET_BITS=64"
        CPPFLAGS="$CPPFLAGS -D_FILE_OFFSET_BITS=64"

        AC_CHECK_HEADERS([fuse.h], [USE_FUSE=1], [
            AC_MSG_ERROR([fuse.h header not found or not usable])])

        AC_CHECK_LIB([fuse], [fuse_main], [FUSE_LIBS="-lfuse"], [
            AC_MSG_ERROR([FUSE library is required for the sample client.])])

        FUSE_CXXFLAGS="-D_FILE_OFFSET_BITS=64 -std=c++11"

        CXXFLAGS=$SAVE_CXXFLAGS
        CPPFLAGS=$SAVE_CPPFLAGS
         ;;
       *)

        LDFLAGS="-L$with_fuse/lib $LDFLAGS"
        CXXFLAGS="-I$with_fuse/include $CXXFLAGS -D_FILE_OFFSET_BITS=64"
        CPPFLAGS="-I$with_fuse/include $CPPFLAGS -D_FILE_OFFSET_BITS=64"

        AC_CHECK_HEADERS([fuse.h], [
            USE_FUSE=1
            FUSE_LDFLAGS="-L$with_fuse/lib "
            FUSE_CXXFLAGS="-I$with_fuse/include -D_FILE_OFFSET_BITS=64 -std=c++11"],
            [AC_MSG_ERROR([fuse.h header not found or not usable])]
        )

        AC_CHECK_LIB([fuse], [fuse_main], [FUSE_LIBS="-lfuse"], [
            AC_MSG_ERROR([FUSE library is required for the sample client.])])

        #restore
        LDFLAGS=$SAVE_LDFLAGS
        CXXFLAGS=$SAVE_CXXFLAGS
        CPPFLAGS=$SAVE_CPPFLAGS
        ;;
       esac
      ],
      [AC_MSG_RESULT([--with-fuse not specified])
        CXXFLAGS="$CXXFLAGS -D_FILE_OFFSET_BITS=64"
        AC_CHECK_HEADERS([fuse.h], [
            USE_FUSE=1
            FUSE_CXXFLAGS="-D_FILE_OFFSET_BITS=64 -std=c++11"],
            [USE_FUSE=0]
        )
        AC_CHECK_LIB([fuse], [fuse_main], [FUSE_LIBS="-lfuse"], [USE_FUSE=0])
        CXXFLAGS=$SAVE_CXXFLAGS
      ]
      )

      AC_SUBST(FUSE_LDFLAGS)
      AC_SUBST(FUSE_LIBS)
      AC_SUBST(FUSE_CXXFLAGS)
fi
AC_SUBST(USE_FUSE)

# if test
fi

AM_CONDITIONAL([BUILD_EXAMPLES], [test "$enable_examples" = "yes"])
AM_CONDITIONAL([BUILD_FUSE_EXAMPLE], [test "x$USE_FUSE" = "x1"])

])
