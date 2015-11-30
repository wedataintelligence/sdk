function MegaTerminalListener(aClient, aTerm, aCallback) {
    var self = this;
    var listener = new MEGASDK.MegaListenerInterface();
    listener.onRequestStart = function(api, request) {
        console.debug('onRequestStart', arguments, request.getRequestString());
    };
    listener.onRequestFinish = function(api, request, error) {
        console.debug('onRequestFinish', arguments, request.getRequestString(), error.getErrorCode(), error.getErrorString());
        self.abort(request, error.getErrorCode());
    };
    listener.onRequestUpdate = function(api, request) {
        console.debug('onRequestUpdate', arguments, request.getRequestString());
    };
    listener.onNodesUpdate = function(api, nodes) {
        console.debug('onNodesUpdate', arguments, MEGASDK.getMegaList(nodes));
    };
    listener.onUsersUpdate = function(api, users) {
        console.debug('onUsersUpdate', arguments, MEGASDK.getMegaList(users));
    };
    listener.onRequestTemporaryError = function(api, request, error) {
        console.debug('onRequestTemporaryError', arguments);
    };
    listener.onTransferStart = function(api, transfer) {
        console.debug('onTransferStart', arguments);
    };
    listener.onTransferUpdate = function(api, transfer) {
        console.debug('onTransferUpdate', arguments);
    };
    listener.onTransferTemporaryError = function(api, transfer, error) {
        console.debug('onTransferTemporaryError', arguments);
    };
    listener.onTransferFinish = function(api, transfer, error) {
        console.debug('onTransferFinish', arguments);
    };
    listener.onAccountUpdate = function(api) {
        console.debug('onAccountUpdate', arguments);
    };
    listener.onReloadNeeded = function(api) {
        console.debug('onReloadNeeded', arguments);
    };
    listener.onContactRequestsUpdate = function(api, requests) {
        console.debug('onContactRequestsUpdate', arguments, MEGASDK.getMegaList(requests));
    };
    aClient.addListener(listener);

    this.abort = function() {
        aTerm.resume();
        aCallback.apply(this, arguments);
    };

    this.reset = function(term, cb) {
        term.pause();
        aTerm = term;
        aCallback = cb;
    };

    this.pause = function() {
        aClient.removeListener(listener);
    };
    this.resume = function() {
        aClient.addListener(listener);
    };
}

var accesslevels = [ "read-only", "read/write", "full access" ];
function dumptree(api, term, n, recurse, depth)
{
    depth = depth || 0;

    console.debug('dumptree', n.getName(), recurse, depth);

    if (depth)
    {
        var title = n.getName() || "CRYPTO_ERROR";
        var line = Array(depth).join("    ") + title + ' (';

        switch (n.getType())
        {
            case MEGASDK.MegaNode.TYPE_FILE:
                line += n.getSize();

                // const char* p;
                // if ((p = strchr(n->fileattrstring.c_str(), ':')))
                // {
                    // line += ", has attributes " << p + 1;
                // }

                // if (n->plink)
                if (n.isExported())
                {
                    line += ", shared as exported";
                    // if (n->plink->ets)
                    // {
                        // line += " temporal";
                    // }
                    // else
                    // {
                        // line += " permanent";
                    // }
                    line += " file link";
                }
                break;

            case MEGASDK.MegaNode.TYPE_FOLDER:
                line += "folder";

                // if(n->outshares)
                if (n.isOutShare())
                {
                    MEGASDK.getMegaList(api.getOutShares(n))
                        .forEach(function(share) {
                            line += ", shared with " + share.getUser()
                                + ", access " + accesslevels[share.getAccess()];
                        });

                    if (n.isExported())
                    {
                        line += ", shared as exported";
                        // if (n->plink->ets)
                        // {
                            // line += " temporal";
                        // }
                        // else
                        // {
                            // line += " permanent";
                        // }
                        line += " folder link";
                    }
                }

                // if (n->pendingshares)
                // {
                    // for (share_map::iterator it = n->pendingshares->begin(); it != n->pendingshares->end(); it++)
                    // {
                        // if (it->first)
                        // {
                            // line += ", shared (still pending) with " << it->second->pcr->targetemail << ", access "
                                 // << accesslevels[it->second->access];
                        // }
                    // }
                // }

                if (n.isInShare())
                {
                    // line += ", inbound " << accesslevels[n->inshare->access] << " share";
                }
                break;

            default:
                line += "unsupported type, please upgrade";
        }

        line += ")" + (n.hasChanged(MEGASDK.MegaNode.CHANGE_TYPE_REMOVED) ? " (DELETED)" : "");
        term.echo(line);

        if (!recurse)
        {
            return;
        }
    }

    if (n.isFolder())
    {
        var nodes = api.getChildren(n, MEGASDK.MegaApi.ORDER_ALPHABETICAL_DESC);

        MEGASDK.getMegaList(nodes)
            .forEach(function(node) {
                dumptree(api, term, node, recurse, depth + 1);
            });
    }
}

function MegaListener(aListener) {
    var methods = [
        "onRequestStart", "onRequestFinish", "onRequestUpdate", "onRequestTemporaryError",
        "onTransferStart", "onTransferFinish", "onTransferUpdate", "onTransferTemporaryError",
        "onUsersUpdate", "onNodesUpdate", "onAccountUpdate",
        "onContactRequestsUpdate", "onReloadNeeded"
    ];

    var listener = new MEGASDK.MegaListenerInterface();

    for (var method in methods) {
        if (methods.hasOwnProperty(method)) {
            method = methods[method];
            listener[method] = aListener[method] || (function dummyMegaListenerMethod(){});
        }
    }

    methods = undefined;

    return listener;
}

var cwd = false;
var debug = false;
var quiet = false;
MEGASDK.Terminal = function (client) {
    var $e = $('#terminal').empty();

    client.setLogLevel(5);
    var listener = new MegaTerminalListener(client);

    var colors = {
        'error': '#ff0000',
        'debug': '#0000ff',
        'warn': '#C25700',
        'info': '#00899E',
    };

    var apiFuncs = {_:[],_l:0};

    for (var fn in client.__proto__) {
        if (client.__proto__.hasOwnProperty(fn)
                && fn[0] !== '_'
                && fn !== 'constructor'
                && fn !== 'strdup') {

            apiFuncs[fn.toLowerCase()] = fn;
            apiFuncs._.push(fn);
            apiFuncs._l = Math.max(apiFuncs._l,fn.length);
        }
    }
    apiFuncs._l += 2;
    apiFuncs._.sort();

    var termEscape = function(str) {
        return String(str).replace(/\W/g, function(ch) {
            return '&#' + ch.charCodeAt(0) + ';';
        });
    }

    var UNIT_TEST = false;

    $e.terminal(function tty(line, term) {
        var argv = $.terminal.parseArguments(line);
        console.debug(argv, arguments);

        var assert = function(expr, msg) {
            console.assert(expr, msg);
            if (!expr) {
                term.echo('[[;#fede00;] &#91;!!&#93; ' + termEscape(msg) + ']');
                if (UNIT_TEST) {
                    UNIT_TEST = false;
                }
            }
            return !!expr;
        };

        var oldc = console.log;
        console.log = function() {
            var type;
            var msg = String(arguments[0]);
            var args = [].slice.call(arguments, 1);
            if (msg[0] === '[') {
                msg = msg.replace(/\[[\d:]+\]\[(.+?)\]\s*/, function(a, b) {
                    type = b;
                    return '';
                });
            }
            if (type === 'err' || type === 'FATAL') {
                type = 'error';
            }
            if (typeof console[type] !== 'function' || type === 'log') {
                type = 'debug';
            }
            console[type].apply(console, arguments);
            if ((debug || type === 'info' || type === 'error' || type === 'warn') && !quiet) {
                var color = colors[type];
                if (color) {
                    var tag = type[0] === 'e' || type[0] === 'w' ? '&#91;!&#93;' : '';
                    msg = '[[;' + color + ';]' + tag + ' ' + termEscape(msg) + ']';
                }
                term.echo.apply(term, [msg].concat(args));
            }
        };

        listener.reset(term,
            function(req, e) {
                console.log = oldc;
                $(window).trigger('resize');

                if (e !== MEGASDK.MegaError.API_OK) {
                    console.error('Request failed.', e, cmd);
                    assert(!UNIT_TEST, 'Unit test failed.');
                }
                else {
                    var type = req && req.getType();

                    switch(type) {
                        case MEGASDK.MegaRequest.TYPE_LOGIN:
                            localStorage.sid = client.dumpSession();
                            tty('fetchNodes', term);
                            break;
                        case MEGASDK.MegaRequest.TYPE_LOGOUT:
                            delete localStorage.sid;
                            break;
                        case MEGASDK.MegaRequest.TYPE_FETCH_NODES:
                            cwd = client.getRootNode();
                            break;
                    }

                    if (UNIT_TEST) {
                        switch(++UNIT_TEST) {
                            case 3:
                                assert(client.getMyUserHandle() === '6O9Chiwwy4A', 'Error retrieving userhandle.');
                                assert(client.getMyEmail() === 'jssdk@yopmail.com', 'Error retrieving email.');
                                listener.newFolder = 'test-' + ~~(Math.random() * 0x10000);
                                tty('mkdir ' + listener.newFolder, term);
                                break;
                            case 4:
                                var ocwd = cwd;
                                tty('cd ' + listener.newFolder, term);
                                if (cwd !== ocwd) {
                                    cwd = client.getRootNode();
                                    tty('rm ' + listener.newFolder, term);
                                }
                                break;
                            case 5:
                            case 2:
                                break;
                            default:
                                term.echo('[[;#0afe00;] Unit test succeed.]');
                                UNIT_TEST = false;
                                break;
                        }
                    }
                }
            });

        var cmd = String(argv.shift()).toLowerCase();
        if (cmd === 'test') {
            UNIT_TEST = 1;
            cmd = 'login';
            argv = '.';
        }
        if (cmd === 'login' && String(argv) === '.') {
            argv = ['jssdk@yopmail.com', 'jssdktest'];
        }
        if (cmd === 'mkdir') {
            client.createFolder(argv[0], cwd);
        }
        else if (cmd === 'debug') {
            debug = !debug;
        }
        else if (cmd === 'version') {
            term.echo("MEGA SDK version: " + client.getVersion());
            listener.abort(null, MEGASDK.MegaError.API_OK);
        }
        else if (cmd === 'session') {
            term.echo("Your (secret) session is: " + client.dumpSession());
            listener.abort(null, MEGASDK.MegaError.API_OK);
        }
        else if (cmd === 'pwd') {
            term.echo(client.getNodePath(cwd));
            listener.abort(null, MEGASDK.MegaError.API_OK);
        }
        else if (cmd === 'login') {
            if (localStorage.sid) {
                if (!argv.length || argv[0] === localStorage.mail) {
                    argv = [ localStorage.sid ];
                }
            }
            if (!UNIT_TEST && client.isLoggedIn()) {
                term.echo("Already logged in. Please log out first.");
                listener.abort(null, MEGASDK.MegaError.API_OK);
            }
            else if (!argv.length) {
                term.echo("Type 'help' for assistance.");
                listener.abort(null, MEGASDK.MegaError.API_OK);
            }
            else if (~String(argv[0]).indexOf('@')) {
                localStorage.mail = argv[0];
                client.login.apply(client, argv);
            }
            else if (~String(argv[0]).indexOf('#')) {
                term.echo("TODO");
                listener.abort();
            }
            else {
                term.echo("Resuming session...");
                client.fastLogin(argv[0]);
            }
        }
        else if (cmd === 'whoami') {
            listener.pause();
            client.getUserData(MegaListener({
                onRequestFinish: function(api, request, error) {
                    assert(client === api, 'getUserData: Unexpected MegaApi instance');
                    assert(request.getType() === MEGASDK.MegaRequest.TYPE_GET_USER_DATA,
                        'getUserData: Request type is not TYPE_GET_USER_DATA');

                    if (error.getErrorCode() === MEGASDK.MegaError.API_OK) {
                        term.echo("[[;#C6C7C6;]Account Owner:] " + request.getName());
                        term.echo("[[;#C6C7C6;]Account E-Mail:] " + api.getMyEmail());
                        // term.echo("[[;#C6C7C6;]Account PUBKEY:] " + request.getPassword());
                        // term.echo("[[;#C6C7C6;]Account PRIVKEY:] " + request.getPrivateKey());

                        quiet = true;
                        client.getExtendedAccountDetails(true, true, true, MegaListener({
                            onRequestFinish: function(api, request, error) {
                                if (error.getErrorCode() === MEGASDK.MegaError.API_OK) {
                                    var data = request.getMegaAccountDetails();
                                    var total = MEGASDK.getUint64(data.getStorageMax());
                                    var used = MEGASDK.getUint64(data.getStorageUsed());

                                    term.echo("Used storage: " + MEGASDK.formatBytes(used)
                                        + " (" + used + " bytes) " + Math.ceil(100 * used / total) + "%");
                                    term.echo("Available storage: " + MEGASDK.formatBytes(total)
                                        + " (" + total + " bytes)");

                                    ['Root', 'Inbox', 'Rubbish'].forEach(function(p) {
                                        var node = client['get' + p + 'Node']();
                                        var handle = node.getBase64Handle();
                                        term.echo("    In " + p.toUpperCase()
                                            + ": " + MEGASDK.formatBytes(data.getStorageUsed(handle))
                                            + " in " + data.getNumFiles(handle) + " file(s)"
                                            + " and " + data.getNumFolders(handle) + " folder(s)");
                                    });

                                    // TODO: transfers

                                    var proLevel = data.getProLevel();
                                    if (proLevel) {
                                        term.echo("PRO Level: " + proLevel);
                                        term.echo("Subscription type: " + data.getSubscriptionStatus());
                                        term.echo("Account Balance:");

                                        MEGASDK.getMegaAccountList('Balance', data)
                                            .forEach(function(a) {
                                                term.echo("    Balance: " + a.getCurrency() + " " + a.getAmount());
                                            });
                                    }

                                    term.echo("Purchase history:");
                                    MEGASDK.getMegaAccountList('Purchase', data)
                                        .forEach(function(p) {
                                            var data = [
                                                'ID: ' + p.getHandle(),
                                                'Time: ' + MEGASDK.timeStampToDate(p.getTimestamp(), true),
                                                'Amount: ' + p.getCurrency() + ' ' + p.getAmount(),
                                                'Payment Method: ' + p.getMethod()
                                            ];
                                            term.echo("    " + data.join(", "));
                                        });

                                    term.echo("Transaction history:");
                                    MEGASDK.getMegaAccountList('Transaction', data)
                                        .forEach(function(p) {
                                            var data = [
                                                'ID: ' + p.getHandle(),
                                                'Time: ' + MEGASDK.timeStampToDate(p.getTimestamp(), true),
                                                'Delta: ' + p.getCurrency() + ' ' + p.getAmount() // XXX: no it->delta here ??
                                            ];
                                            term.echo("    " + data.join(", "));
                                        });

                                    term.echo("Currently Active Sessions:");
                                    MEGASDK.getMegaAccountList('Session', data)
                                        .forEach(function(p) {
                                            if (!p.isAlive()) return;
                                            var data = [
                                                'Session ID: ' + p.getBase64Handle() + (p.isCurrent() ? " **CURRENT**" : ''),
                                                'Session Start: ' + MEGASDK.timeStampToDate(p.getCreationTimestamp(), true),
                                                'Most recent activity: ' + MEGASDK.timeStampToDate(p.getMostRecentUsage(), true),
                                                'IP: ' + p.getIP() + ' (' + p.getCountry() + ')',
                                                'User-Agent: ' + p.getUserAgent()
                                            ];
                                            data.map(function(ln) {
                                                term.echo("    " + ln);
                                            });
                                            term.echo("----");
                                        });

                                    window.data=data;
                                }
                                quiet = false;
                                listener.resume();
                                listener.abort(null, MEGASDK.MegaError.API_OK);
                            }
                        }));
                    }
                    else {
                        listener.resume();
                        listener.abort();
                    }
                }
            }));
        }
        else if (cmd === 'cd') {
            var node, e;
            if (!argv.length || argv[0] === '/') {
                node = client.getRootNode();
            }
            else {
                node = client.getNodeByPath(String(argv[0]), cwd);
            }
            if (MEGASDK.isNULL(node)) {
                assert(false, argv[0] + ': No such file or directory.');
            }
            else if (!node.isFolder()) {
                assert(false, argv[0] + ': Not a directory.');
            }
            else {
                cwd = node;
                e = MEGASDK.MegaError.API_OK;
            }
            listener.abort(null, e);
        }
        else if (cmd === 'rm') {
            var node = client.getNodeByPath(argv[0], cwd);
            if (MEGASDK.isNULL(node)) {
                assert(false, argv[0] + ': No such file or directory.');
                listener.abort();
            }
            else {
                client.remove(node);
            }
        }
        else if (cmd === 'ls') {
            var node;
            var recursive = (argv[0] === '-R') | 0;

            if (argv.length > recursive) {
                node = client.getNodeByPath(argv[recursive], cwd);
            }
            else {
                node = cwd;
            }

            if (MEGASDK.isNULL(node)) {
                assert(false, argv[recursive] + ': No such file or directory.');
                listener.abort();
            }
            else {
                dumptree(client, term, node, recursive);
                listener.abort(null, MEGASDK.MegaError.API_OK);
            }
        }
        else if (cmd === 'export') {
            var node = client.getNodeByPath(String(argv[0]), cwd);

            if (MEGASDK.isNULL(node)) {
                assert(false, argv[0] + ': Not such file/directory.');
                listener.abort();
            }
            else if (argv[1] === 'del') {
                client.disableExport(node);
            }
            else {
                var ets;

                if (typeof argv[1] === 'string') {
                    if (argv[1][0] === '*') {
                        ets = Math.floor(Date.now() / 1000) + parseInt(argv[1].substr(1));
                    }
                }
                else if (typeof argv[1] === 'number') {
                    ets = argv[1];
                }

                client.exportNode(node, ets || undefined, MegaListener({
                    onRequestFinish: function(api, request, error) {
                        if (error.getErrorCode() === MEGASDK.MegaError.API_OK) {
                            term.echo("Exported link: " + request.getLink());
                        }
                    }
                }));
            }
        }
        else if (cmd === 'share') {
            if (!argv.length) {
                // list all shares (incoming and outgoing)

                term.echo("Shared folders:");

                MEGASDK.getMegaList(client.getOutShares())
                    .forEach(function(share) {
                        var handle = share.getBase64Handle();
                        var node = client.getNodeByBase64Handle(handle);
                        var name = !MEGASDK.isNULL(node) && node.getName() || '???';
                        var line = '    ' + name + ', shared ';

                        if (node.isExported()) {
                            line += 'as exported link';
                        }
                        else {
                            line += 'with ' + share.getUser() + ' (' + accesslevels[share.getAccess()] + ')';
                        }

                        line += ', on ' + new Date(share.getTimestamp() * 1000).toISOString();

                        term.echo(line);
                    });

                // XXX: getInSharesList returns nothing (!?)
                // MEGASDK.getMegaList(client.getInSharesList())
                    // .forEach(function(share) {
                        // var email = share.getUser();

                        // term.echo("From " + email + ":");
                    // });

                MEGASDK.getMegaList(client.getContacts())
                    .forEach(function(user) {
                        var shares = client.getInShares(user);

                        if (MEGASDK.isMegaList(shares) && shares.size()) {
                            term.echo("From " + user.getEmail() + ":");

                            MEGASDK.getMegaList(shares)
                                .forEach(function(share) {
                                    term.echo("    " + share.getName() + ' (' + accesslevels[client.getAccess(share)] + ')');
                                });
                        }
                    });
                listener.abort(null, MEGASDK.MegaError.API_OK);
            }
            else {
                var node = client.getNodeByPath(String(argv[0]), cwd);

                if (MEGASDK.isNULL(node) || !node.isFolder()) {
                    assert(false, argv[0] + ': Not such directory.');
                    listener.abort();
                }
                else if (argv.length == 1) {
                    // XXX: Sometimes node.isOutShare() retuns false for a node which is indeed an outshare :-/
                    if (node.isOutShare()) {
                        // var name = node.getName()
                        MEGASDK.getMegaList(client.getOutShares(node))
                            .forEach(function(share) {
                                var handle = share.getBase64Handle();
                                console.debug('handle', handle);
                                node = client.getNodeByBase64Handle(handle);
                                var name = !MEGASDK.isNULL(node) && node.getName() || '???';
                                var line = '    ' + name;

                                // XXX: just using node.isExported() always detect the node
                                // as exported, so additionaly checking for !share.getUser() :-/

                                if (!share.getUser() && node.isExported()) {
                                    line += ', shared as exported link';
                                }
                                else {
                                    line += ', shared with ' + share.getUser() + ' (' + accesslevels[share.getAccess()] + ')';
                                }

                                line += ', on ' + new Date(share.getTimestamp() * 1000).toISOString();

                                term.echo(line);
                            });
                    }
                    else {
                        assert(false, 'That is not being shared.');
                    }
                    listener.abort(null, MEGASDK.MegaError.API_OK);
                }
                else {
                    var a = MEGASDK.MegaShare.ACCESS_UNKNOWN;

                    if (argv.length > 2) {
                        if (argv[2] == "r" || argv[2] == "ro") {
                            a = MEGASDK.MegaShare.ACCESS_READ;
                        }
                        else if (argv[2] == "rw") {
                            a = MEGASDK.MegaShare.ACCESS_READWRITE;
                        }
                        else if (argv[2] == "full") {
                            a = MEGASDK.MegaShare.ACCESS_FULL;
                        }
                        else {
                            assert(false, "Access level must be one of r, rw or full");

                            return listener.abort();
                        }
                    }

                    client.share(node, argv[1], a, MegaListener({
                        onRequestFinish: function(api, request, error) {
                            assert(error.getErrorCode() === MEGASDK.MegaError.API_OK,
                                'Error sharing folder: ' + argv[0]);
                        }
                    }));

                }
            }
        }
        else if (cmd === 'users') {
            var visibility = ['hidden','visible','session user'];
            MEGASDK.getMegaList(client.getContacts())
                .forEach(function(user) {
                    var shares = client.getInShares(user);
                    var line = '    ' + (user.getEmail() || '???')
                        + ', ' + (visibility[user.getVisibility()] || 'unknown visibility');

                    if (MEGASDK.isMegaList(shares)) {
                        var size = shares.size();
                        if (size) {
                            line += ', sharing ' + size + ' folder(s)';
                        }
                    }

                    // XXX: it->second.pubk.isvalid()

                    term.echo(line);
                });
            listener.abort(null, MEGASDK.MegaError.API_OK);
        }
        else if (cmd === 'killsession') {
            if (argv[0] === 'all') {
                client.killSession();
            }
            else if (typeof argv[0] === 'string') {
                client.killSession(argv[0]);
            }
            else {
                listener.abort();
            }
        }
        else if (cmd === 'retry') {
            // XXX: client->abortbackoff ??
            client.retryPendingConnections();
        }
        else if (cmd === 'recon') {
            // XXX: client->disconnect ??
            client.retryPendingConnections(true);
        }
        else {
            cmd = apiFuncs[cmd] || cmd;

            if (cmd === 'reload') {
                cmd = 'fetchNodes';
            }

            if (typeof client[cmd] === 'function') {
                var rc = client[cmd].apply(client, argv);
                if (rc !== undefined) {
                    var rcs = String(rc);
                    window.lastReturnCode = rc;
                    if (typeof rc === 'object' && "ptr" in rc) {
                        rcs += ' (' + Object(rc.constructor).name + ')';
                        if (rc.ptr === 0) {
                            console.log('[1][err] Invalid API call.');
                        }
                    }
                    term.echo('[[;#fffeff;] RC: ' + termEscape(rcs) + ']');
                    listener.abort();
                }
            }
            else {
                if (cmd === 'help' || cmd === 'h') {
                    term.echo("[[;#51C6ED;]API Functions:]");
                    var line = '';
                    var lineLength = window.innerWidth / 7;
                    apiFuncs._.map(function(fn) {
                        fn = (Array(apiFuncs._l).join(" ") + fn).slice(-apiFuncs._l);
                        if (line.length + fn.length > lineLength) {
                            term.echo(line);
                            line = '';
                        }
                        line += fn;
                    });
                    term.echo("");
                    term.echo("[[;#51C6ED;]TERM Commands:]");

                    var indent = 4;
                    [
                        "login email [password]",
                        "login exportedfolderurl#key",
                        "login session",
                        // "begin [ephemeralhandle#ephemeralpw]",
                        // "signup [email name|confirmationlink]",
                        // "confirm",
                        "session",
                        // "mount",
                        "ls [-R] [remotepath]",
                        "cd [remotepath]",
                        "pwd",
                        // "lcd [localpath]",
                        // "import exportedfilelink#key",
                        // "put localpattern [dstremotepath|dstemail:]",
                        // "putq [cancelslot]",
                        // "get remotepath [offset [length]]",
                        // "get exportedfilelink#key [offset [length]]",
                        // "getq [cancelslot]",
                        // "pause [get|put] [hard] [status]",
                        // "getfa type [path] [cancel]",
                        "mkdir remotepath",
                        "rm remotepath",
                        // "mv srcremotepath dstremotepath",
                        // "cp srcremotepath dstremotepath|dstemail:",
                    /*  "sync [localpath dstremotepath|cancelslot]",*/
                        "export remotepath [expireTime|del]",
                        // "share [remotepath [dstemail [r|rw|full] [origemail]]]",
                        "share [remotepath [dstemail [r|rw|full]]]",
                        // "invite dstemail [origemail|del|rmd]",
                        // "ipc handle a|d|i",
                        // "showpcr", HOW??
                        "users",
                        // "getua attrname [email]",
                        // "putua attrname [del|set string|load file]",
                        // "putbps [limit|auto|none]",
                        "killsession [all|sessionid]",
                        "whoami",
                        // "passwd",
                        "retry",
                        "recon",
                        "reload",
                        "logout",
                        "locallogout",
                        // "symlink",
                        "version",
                        "debug",
                        "quit"
                    ].map(function(ln) {
                        term.echo('[[;#D5F5B8;]' + Array(indent).join(" ") + termEscape(ln) + ']');
                    });
                }
                else {
                    term.echo("Unknown command: " + (cmd || '(null)'));
                }
                listener.abort(null, MEGASDK.MegaError.API_OK);
            }
        }
    }, {
        greetings : BANNER.replace('%%', client.getVersion()),
        name : 'jssdk',
        width : '99%',
        prompt : '[[;#FFFEDD;]jssdk>] '
    });

    var $term = $('.terminal-output');
    $term.css({
        "overflow-y" : "auto",
        "overflow-x" : "hidden",
        "min-height" : "120px"
    });
    $(document.body).css('overflow', 'hidden');
    $(window).resize(function() {
        $('.terminal').css({
            "max-height" : window.innerHeight + "px"
        });
        $('.terminal-output').css({
            "max-height" : (window.innerHeight - 32) + "px"
        });
        $term.animate({
            scrollTop : $term[0].scrollHeight
        }, 90);
    }).trigger('resize');
};

var BANNER =
'       ____.                    _________            .__        __     ________________   ____  __. \n'+
'      |    _____ ___  ______   /   _____/ ___________|_________/  |_  /   _____\\______ \\ |    |/ _| \n'+
'      |    \\__  \\\\  \\/ \\__  \\  \\_____  \\_/ ___\\_  __ |  \\____ \\   __\\ \\_____  \\ |    |  \\|      <   \n'+
'  /\\__|    |/ __ \\\\   / / __ \\_/        \\  \\___|  | \\|  |  |_> |  |   /        \\|    `   |    |  \\  \n'+
'  \\________(____  /\\_/ (____  /_______  /\\___  |__|  |__|   __/|__|  /_______  /_______  |____|__ \\ \n'+
'                \\/          \\/        \\/     \\/         |__|                 \\/        \\/        \\/ \n'+
'                                                               MEGA SDK version:  %% (e79794aa)    \n';
