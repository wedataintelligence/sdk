# check for sqlite headers and libraries presence
# set "check_db" to "true" to perform the check
# define USE_SQLITE

AC_DEFUN([MEGASDK_CHECK_DB],[

# save
SAVE_LDFLAGS="$LDFLAGS"
SAVE_CXXFLAGS="$CXXFLAGS"
SAVE_CPPFLAGS="$CPPFLAGS"

sqlite=false
if test "x$check_db" = "xtrue"; then

AC_MSG_CHECKING(for SQLite)
AC_ARG_WITH(sqlite,
  AS_HELP_STRING(--with-sqlite=PATH, base of SQLite installation),
  [AC_MSG_RESULT($with_sqlite)
   case $with_sqlite in
   no)
    sqlite=false
     ;;
   yes)
    AC_CHECK_HEADERS([sqlite3.h],, [
        AC_MSG_ERROR([sqlite3.h header not found or not usable])
    ])
    AC_CHECK_LIB(sqlite3, [sqlite3_open], [DB_LIBS="-lsqlite3"],[
            AC_MSG_ERROR([Could not find libsqlite3])
    ])
    AC_SUBST(DB_LIBS)
    sqlite=true
     ;;
   *)

    # determine if library is installed
    if test -d "$with_sqlite/lib"; then
        LDFLAGS="-L$with_sqlite/lib $LDFLAGS"
        CXXFLAGS="-I$with_sqlite/include $CXXFLAGS"

        AC_CHECK_HEADERS(sqlite3.h,[
         DB_LDFLAGS="-L$with_sqlite/lib"
         DB_CXXFLAGS="-I$with_sqlite/include"
         DB_CPPFLAGS="-I$with_sqlite/include"],
         AC_MSG_ERROR([sqlite3.h header not found or not usable])
        )

        # use sqlite3 library
        AC_CHECK_LIB(sqlite3, [main], [DB_LIBS="-lsqlite3"],[
                AC_MSG_ERROR([Could not find libsqlite3])
        ])
        AC_SUBST(DB_LIBS)
    else
        LDFLAGS="-L$with_sqlite $LDFLAGS"
        CXXFLAGS="-I$with_sqlite $CXXFLAGS"

        AC_CHECK_HEADERS(sqlite3.h,[
         DB_LDFLAGS="-L$with_sqlite"
         DB_CXXFLAGS="-I$with_sqlite"
         DB_CPPFLAGS="-I$with_sqlite"],
         AC_MSG_ERROR([sqlite3.h header not found or not usable])
        )
        DB_LIBS="-lsqlite3"
        AC_SUBST(DB_LIBS)
    fi

    sqlite=true

    #restore
    LDFLAGS=$SAVE_LDFLAGS
    CXXFLAGS=$SAVE_CXXFLAGS
    CPPFLAGS=$SAVE_CPPFLAGS
    ;;
   esac
  ],
  [AC_MSG_RESULT([--with-sqlite not specified])]
  )
AC_SUBST(DB_CXXFLAGS)
AC_SUBST(DB_CPPFLAGS)
AC_SUBST(DB_LDFLAGS)

# Berkeley DB
db=false
AC_MSG_CHECKING(for Berkeley DB)
AC_ARG_WITH(db,
  AS_HELP_STRING(--with-db=PATH, base of Berkeley DB installation),
  [AC_MSG_RESULT($with_db)
   case $with_db in
   no)
     db=false
     ;;
   yes)
    AC_CHECK_HEADERS([db_cxx.h],, [
        AC_MSG_ERROR([db_cxx.h header not found or not usable])
    ])

    AC_CHECK_LIB(db_cxx, [open], [DB_LIBS="-ldb_cxx"],[
            AC_MSG_ERROR([Could not find libdb_cxx])
    ])
    AC_SUBST(DB_LIBS)
    db=true
     ;;
   *)
    # set temp variables
    LDFLAGS="-L$with_db/lib $LDFLAGS"
    CXXFLAGS="-I$with_db/include $CXXFLAGS"

    AC_CHECK_HEADERS(db_cxx.h,
     DB_LDFLAGS="-L$with_db/lib"
     DB_CXXFLAGS="-I$with_db/include",
     AC_MSG_ERROR([db_cxx.h header not found or not usable])
     )
    AC_CHECK_LIB(db_cxx, [open], [DB_LIBS="-ldb_cxx"],[
            AC_MSG_ERROR([Could not find libdb_cxx])
    ])
    AC_SUBST(DB_LIBS)
    db=true

    #restore
    LDFLAGS=$SAVE_LDFLAGS
    CXXFLAGS=$SAVE_CXXFLAGS
    ;;
   esac
  ],
  [AC_MSG_RESULT([--with-db not specified])]
  )
AC_SUBST(DB_CXXFLAGS)
AC_SUBST(DB_LDFLAGS)

# check if both DB layers are selected
if test "x$sqlite" = "xtrue" ; then
    if test "x$db" = "xtrue" ; then
        AC_MSG_ERROR([Please provide exactly one DB access layer, either --with-sqlite or --with-db.])
    fi
fi

# check if no DB layer is selected, use SQLite by the default
if test "x$sqlite" = "xfalse" ; then
    if test "x$db" = "xfalse" ; then
        AC_MSG_NOTICE([Using SQLite3 as the default DB access layer.])

        AC_CHECK_HEADERS([sqlite3.h],, [
            AC_MSG_ERROR([sqlite3.h header not found or not usable])
        ])
        AC_CHECK_LIB(sqlite3, [sqlite3_open], [DB_LIBS="-lsqlite3"],[
                AC_MSG_ERROR([Could not find libsqlite3])
        ])
        sqlite=true

        AC_SUBST(DB_LIBS)
    fi
fi

SDK_CXXFLAGS="$SDK_CXXFLAGS $DB_CXXFLAGS"
SDK_CPPFLAGS="$SDK_CPPFLAGS $CPPFLAGS"
SDK_LDFLAGS="$SDK_LDFLAGS $DB_LDFLAGS"
SDK_LIBS="$SDK_LIBS $DB_LIBS"

# if test
fi

if test "x$sqlite" = "xtrue" ; then
    AC_DEFINE(USE_SQLITE, [1], [Define to use SQLite])
else
    AC_DEFINE(USE_DB, [1], [Define to use Berkeley DB])
fi
AM_CONDITIONAL(USE_SQLITE, test x$sqlite = xtrue)
AM_CONDITIONAL(USE_DB, test "x$db = xtrue")

#restore
LDFLAGS="$SAVE_LDFLAGS"
CXXFLAGS="$SAVE_CXXFLAGS"
CPPFLAGS="$SAVE_CPPFLAGS"
])
