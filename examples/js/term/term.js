var accesslevels = [ "read-only", "read/write", "full access" ];

function MegaTerminalListener(aClient, aTerm, aCallback) {
    var self = this;
    var listener = MEGASDK.getMegaListener({
        onRequestFinish: function(api, request, error) {
            self.abort(request, error.getErrorCode());
        },
        onTransferUpdate: function(api, transfer) {
            var speed = MEGASDK.formatBytes(MEGASDK.getUint64(transfer.getSpeed()));
            var size = MEGASDK.getUint64(transfer.getTotalBytes());
            var offset = MEGASDK.getUint64(transfer.getTransferredBytes());

            _term.echo('[[;#11bc78;]' + termEscape(transfer.getPath()
                + ': transfered ' + offset + ' of ' + size
                + ' bytes. ('+~~(offset*100/size)+'%, '+speed+'/s)') + ']');
            $(window).trigger('resize');
        },
        onTransferStart: function(api, transfer) {
            var dir = (transfer.getTransferString() == "DOWNLOAD" ? "Incoming" : "Outgoing");

            _term.echo('[[;#11bc78;]' + termEscape(transfer.getPath()
                + ': ' + dir + ' file transfer starting.') + ']');
        },
        onTransferTemporaryError: function(api, transfer, error) {

        },
        onTransferFinish: function(api, transfer, error) {
            var ec = error.getErrorCode();
            error = error.getErrorString();

            if (ec !== MEGASDK.MegaError.API_OK) {
                _term.echo('TRANSFER "' + transfer.getPath() + '" FAILED: ' + error);
            }
            else {
                this.onTransferUpdate(api, transfer);
            }
        }
    });
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

function dumptreeFormatResult(lines, foldersFirst)
{
    var result = [];
    var sizelen = 11;
    var fnlen = Math.min(80, lines.maxNameLen + 3);
    delete lines.maxNameLen;

    if (foldersFirst) {
        var files = [], folders = [], nop = [];
        for (var i in lines) {
            if (typeof lines[i] !== 'object') nop.push(lines[i]);
            else if (lines[i].size) files.push(lines[i]);
            else folders.push(lines[i]);
        }
        lines = folders.concat(files, nop);
    }

    for (var ln in lines)
    {
        ln = lines[ln];

        if (typeof ln !== 'object') {
            result.push(ln);
        }
        else {
            var fl = Math.max(10, fnlen - (ln.depth * 3));
            var line = [Array(ln.depth).join("   ")];
            var raw = [(ln.name + Array(fl).join(" ")).slice(0, fl)];

            if (ln.size) {
                line.push('&#128196;');
                raw.push((Array(sizelen).join(" ") + ln.size).slice(-sizelen));
            }
            else {
                line.push("&#128193;");
                raw.push(Array(sizelen+1).join(" "));
            }

            line.push("");
            raw.push(ln.mtime);
            raw.push(ln.handle);
            if (ln.hash) {
                raw.push(ln.hash);
            }
            raw.push(ln.comm);

            line = (line.join(" ") + termEscape(raw.join(" ")));
            if (result.length % 2) line = '[[;;#1e1e1f]' + line + ']';
            result.push(line);
        }
    }

    return result;
}
function dumptree(api, lines, n, recurse, depth)
{
    depth = depth | 0;
    lines.maxNameLen |= 0;

    // console.debug('dumptree', n.getName(), recurse, depth);

    if (depth)
    {
        var title = n.getName() || "CRYPTO_ERROR";
        var line = {
            name: title,
            handle: n.getBase64Handle(),
            comm: '',
            depth: depth
        };

        if (title.length > lines.maxNameLen) {
            lines.maxNameLen = title.length;
        }

        switch (n.getType())
        {
            case MEGASDK.MegaNode.TYPE_FILE:
                line.size = MEGASDK.formatBytes(MEGASDK.getUint64(n.getSize()));
                line.mtime = n.getModificationTime();
                line.hash = crc32s(api.getFingerprint(n));

                // const char* p;
                // if ((p = strchr(n->fileattrstring.c_str(), ':')))
                // {
                    // line += ", has attributes " << p + 1;
                // }

                if (n.isExported())
                {
                    line.comm += "Shared as exported";
                    if (n.getExpirationTime() > 0)
                    {
                        line.comm += " temporal";
                    }
                    else
                    {
                        line.comm += " permanent";
                    }
                    line.comm += " file link";
                    var et = n.getExpirationTime();
                    if (et > 0) {
                        line.comm += ' (expires on ' + MEGASDK.timeStampToDate(et) + ')';
                    }
                }
                break;

            case MEGASDK.MegaNode.TYPE_FOLDER:
                line.mtime = n.getCreationTime();

                if (n.isOutShare())
                {
                    MEGASDK.mapMegaList(api.getOutShares(n), function(share) {
                        if (share.getUser()) {
                            if (line.comm) line.comm += ', ';
                            line.comm += "Shared with " + share.getUser()
                                + ", access " + accesslevels[share.getAccess()];
                        }
                    });

                    if (n.isExported())
                    {
                        if (line.comm) line.comm += ', ';
                        line.comm += "Shared as exported";
                        if (n.getExpirationTime() > 0)
                        {
                            line.comm += " temporal";
                        }
                        else
                        {
                            line.comm += " permanent";
                        }
                        line.comm += " folder link";
                    }
                }

                if (api.isPendingShare(n))
                {
                    MEGASDK.mapMegaList(api.getPendingOutShares(n), function(share) {
                        // XXX: is this ok? Ie, pcr->targetemail
                        if (line.comm) line.comm += ', ';
                        line.comm += "Shared (still pending) with " << share.getUser() + ", access "
                                + accesslevels[share.getAccess()];
                    });
                    // for (share_map::iterator it = n->pendingshares->begin(); it != n->pendingshares->end(); it++)
                    // {
                        // if (it->first)
                        // {
                            // line += ", shared (still pending) with " << it->second->pcr->targetemail << ", access "
                                 // << accesslevels[it->second->access];
                        // }
                    // }
                }

                if (n.isInShare())
                {
                    if (line.comm) line.comm += ', ';
                    line.comm += "Inbound " << accesslevels[api.getAccess(n)] + " share";
                }
                break;

            default:
                line.comm += " -- unsupported type, please upgrade";
        }

        line.mtime = MEGASDK.timeStampToDate(line.mtime, 1).replace('T', ' ').replace('.000Z', '');
        line.comm += (n.hasChanged(MEGASDK.MegaNode.CHANGE_TYPE_REMOVED) ? " (DELETED)" : "");

        if (4e3 === lines.push(/*Array(depth).join("    ") + termEscape*/(line))) {
            // XXX: jquery.terminal.js seem to have troubles handling too many entries, and
            //      using his flush capabilities does not help since their cache seem buggy...
            lines.push('[[;#fe1112;] -- Too many entries, output truncated.]');
            return -1;
        }

        if (!recurse)
        {
            return;
        }
    }

    var r;
    if (n.isFolder())
    {
        api.getChildren(n, MEGASDK.MegaApi.ORDER_ALPHABETICAL_ASC)
            .forEach(function(node) {
                r = dumptree(api, lines, node, recurse, depth + 1);
                return r === -1;
            })
            .free();
    }
    return r;
}

function termEscape(str) {
    return String(str).replace(/\W/g, function(ch) {
        if (ch === ' ') return '&nbsp;';
        return '&#' + ch.charCodeAt(0) + ';';
    });
}

function crc32s(str) {
    return ("0000000" + MEGASDK.StringView(str).crc32.toString(16).toUpperCase()).slice(-8);
}

var cwd = false;
var debug = false;
var quiet = false;
var _term;
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
                                    cwd.free();
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
            argv = localStorage.sid ? '':'.';
        }
        if (cmd === 'login' && String(argv) === '.') {
            argv = ['jssdk@yopmail.com', 'jssdktest'];
        }
        if (cmd === 'mkdir') {
            client.createFolder(argv[0], cwd);
        }
        else if (cmd === 'debug') {
            debug = !debug;
            listener.abort(null, MEGASDK.MegaError.API_OK);
        }
        else if (cmd === 'findleaks') {
            var cl = argv[0], m = argv[1];
            Object.getOwnPropertyNames(MEGASDK)
                .filter(function(n) {
                    return n.substr(0,4) === 'Mega';
                })
                .forEach(function(o) {
                    var cache = MEGASDK.getCache(MEGASDK[o]);
                    var len = Object.keys(cache).length;
                    if (len) {
                        if ((o !== 'MegaApi' && o !== 'MegaListenerInterface' && o !== 'MegaNode') || len > 1) {
                            assert(false, 'Found possible leak in interface ' + o);
                            console.warn(o, cache);
                            if (o === cl) {
                                o = Object.keys(cache).map(function(c) {
                                    try {
                                        return cache[c][m]();
                                    }
                                    catch (ex) {
                                        console.warn('Call failed', c, cache[c]);
                                        return '$$'+c;
                                    }
                                });
                                console.debug(o);
                            }
                        }
                    }
                });
            listener.abort(null, MEGASDK.MegaError.API_OK);
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
            client.getUserData(MEGASDK.getMegaListener({
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
                        client.getExtendedAccountDetails(true, true, true, MEGASDK.getMegaListener({
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
                                        // var handle = node.getBase64Handle();
                                        var info = MEGASDK.getTreeInfo(client, node);
                                        term.echo("    In " + p.toUpperCase()
                                            // XXX: getStorageUsed does not seem to return a correct size..
                                            // + ": " + MEGASDK.formatBytes(data.getStorageUsed(handle))
                                            + ": " + MEGASDK.formatBytes(info.bytes)
                                            + " in " + info.files + " file(s)"
                                            + " and " + info.folders + " folder(s)");
                                        node.free();
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
                                                a.free();
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
                                            p.free();
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
                                            p.free();
                                        });

                                    term.echo("Currently Active Sessions:");
                                    MEGASDK.getMegaAccountList('Session', data)
                                        .forEach(function(p) {
                                            if (p.isAlive()) {
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
                                            }
                                            p.free();
                                        });

                                    data.free();
                                }
                                quiet = false;
                                listener.resume();
                                listener.abort(null, MEGASDK.MegaError.API_OK);
                                return true;
                            }
                        }));
                    }
                    else {
                        listener.resume();
                        listener.abort();
                    }
                    return true;
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
            if (!node.isValid) {
                assert(false, argv[0] + ': No such file or directory.');
            }
            else if (!node.isFolder()) {
                assert(false, argv[0] + ': Not a directory.');
            }
            else {
                cwd.free();
                cwd = node;
                e = MEGASDK.MegaError.API_OK;
            }
            listener.abort(null, e);
        }
        else if (cmd === 'cp') {
            argv = argv.map(String);
            if (argv.length === 2) {
                var srcNode = client.getNodeByPath(argv[0], cwd);
                if (!srcNode.isValid) {
                    assert(false, argv[0] + ': No such file or directory.');
                    listener.abort();
                }
                else {
                    var target = argv[1];

                    if (target[target.length - 1] === ':') {
                        client.sendFileToUser(srcNode, target.substr(0,target.length-1));
                    }
                    else {
                        var dstNode = client.getNodeByPath(target, cwd);

                        if (!dstNode.isValid || dstNode.isFile()) {
                            assert(false, target + ': Not a directory.');
                            listener.abort();
                        }
                        else {
                            var access = client.checkAccess(dstNode.getBase64Handle(), MEGASDK.MegaShare.ACCESS_READWRITE);

                            if (access !== MEGASDK.MegaError.API_OK) {
                                assert(false, "Write access denied.");
                                listener.abort();
                            }
                            else {
                                client.copyNode(srcNode, dstNode);
                            }
                        }
                    }
                }
            }
        }
        else if (cmd === 'mv') {
            argv = argv.map(String);
            var srcNode = client.getNodeByPath(argv[0], cwd);
            if (!srcNode.isValid) {
                assert(false, argv[0] + ': No such file or directory.');
                listener.abort();
            }
            else if (argv.length !== 2) {
                listener.abort();
            }
            else {
                var dstNode = client.getNodeByPath(argv[1], cwd);

                if (dstNode.isValid) {
                    if (dstNode.isFile()) {
                        assert(false, argv[1] + ': Not a directory.');
                        listener.abort();
                    }

                    return client.moveNode(srcNode, dstNode);
                }

                var path = argv[1].split(/[\\\/]/);

                if (path.length === 1) {
                    return client.renameNode(srcNode, argv[1]);
                }

                var name = path.pop();
                path = path.join("/");

                dstNode = client.getNodeByPath(path, cwd);

                if (!dstNode.isValid || dstNode.isFile()) {
                    assert(false, path + ': Not a directory.');
                    return listener.abort();
                }

                listener.pause();
                client.moveNode(srcNode, dstNode, MEGASDK.getMegaListener({
                    onRequestFinish: function(api, request, error) {
                        listener.resume();
                        if (error.getErrorCode() === MEGASDK.MegaError.API_OK) {
                            client.renameNode(srcNode, name);
                        }
                        return true;
                    }
                }));



                return;
                if (!dstNode.isValid) {
                    assert(false, argv[1] + ': No such directory.');
                    listener.abort();
                }
                else {
                    var error;
                    var srcHandle = srcNode.getBase64Handle();
                    var dstHandle = dstNode.getBase64Handle();
                    var proceed = function() {
                        var srcParentNode = client.getParentNode(srcNode);
                        var srcParentHandle = srcParentNode.getBase64Handle();

                        if (srcParentHandle !== dstHandle) {
                            if (error === MEGASDK.MegaError.API_OK) {

                            }
                            else {
                                assert(false, "Move not permitted - try copy");
                            }
                        }
                        listener.resume();
                        listener.abort(null, error);
                        proceed = undefined;
                    };

                    listener.pause();

                    if (srcNode.getType() === MEGASDK.MegaNode.TYPE_FILE) {
                        var dstParentNode = client.getParentNode(dstNode);

                        // (there should never be any orphaned filenodes)
                        if (!dstParentNode.isValid) {
                            listener.resume();
                            listener.abort();
                            return;
                        }

                        var dstParentHandle = dstParentNode.getBase64Handle();

                        error = client.checkMove(srcHandle, dstParentHandle);

                        if (error === MEGASDK.MegaError.API_OK) {

                        }

                        // ...and set target to original target's parent
                        dstNode = dstParentNode;
                        dstHandle = dstParentHandle;
                    }
                    else {
                        error = client.checkMove(srcHandle, dstHandle);
                        proceed();
                    }
                }
            }
        }
        else if (cmd === 'rm') {
            var node = client.getNodeByPath(argv[0], cwd);
            if (!node.isValid) {
                assert(false, argv[0] + ': No such file or directory.');
                listener.abort();
            }
            else {
                var handle = node.getBase64Handle();
                var error = client.checkAccess(handle, MEGASDK.MegaShare.ACCESS_FULL);

                if (error !== MEGASDK.MegaError.API_OK) {
                    assert(false, argv[0] + ': Access denied.');
                    listener.abort(null, error);
                }
                else {
                    client.remove(node);
                }
            }
            node.free();
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

            if (!node.isValid) {
                assert(false, argv[recursive] + ': No such file or directory.');
                listener.abort();
            }
            else {
                var lines = [];
                console.time('dumptree');
                dumptree(client, lines, node, recursive, 0);
                lines = dumptreeFormatResult(lines, !recursive);
                console.timeEnd('dumptree');
                for (var i in lines) {
                    term.echo(lines[i]);
                }
                listener.abort(null, MEGASDK.MegaError.API_OK);
            }
        }
        else if (cmd === 'put') {
            var target = cwd;

            if (argv.length) {
                target = client.getNodeByPath(argv[0], cwd);

                if (!target.isValid || target.isFile()) {
                    assert(false, argv[0] + ': Not a directory.');
                    return listener.abort();
                }
            }

            $('#uploader').show();
            $(window).one('startUpload', function(ev, file) {
                if (file instanceof File) {
                    _term = term;
                    client.startUpload(file, target);
                }
            });
            listener.abort(null, MEGASDK.MegaError.API_OK);
        }
        else if (cmd === 'getq' || cmd === 'putq') {
            var cancel = argv.length ? +argv[0] : -1;
            var tfs = client.getTransfers();
            var stm = client.getStreamingTransfers();
            var wts = cmd === 'getq' ? 'DOWNLOAD':'UPLOAD';

            [].concat(tfs.toArray(), stm.toArray())
                .forEach(function(it) {
                    var ts = it.getTransferString();
                    if (wts !== ts) return;

                    var line = [];
                    var tag = it.getTag();

                    line.push(tag + ': ' + it.getFileName());
                    line.push('['+ts+']');

                    if (cancel === tag) {
                        line.push('Canceling...');
                        client.cancelTransferByTag(tag);
                    }

                    term.echo('[[;#11bc78;]' + termEscape(line.join(" ")) + ']');
                });

                stm.free();
                tfs.free();
                listener.abort(null, MEGASDK.MegaError.API_OK);
        }
        else if (cmd === 'get') {
            argv = argv.map(String);
            var a1 = String(argv[0]);
            var node = client.getNodeByPath(a1, cwd);
            if (!node.isValid || !node.isFile()) {
                assert(false, a1 + ': No such file.');
                listener.abort();
            }
            else {
                client.startDownload(node, '/');
                listener.abort(null, MEGASDK.MegaError.API_OK);
            }
            _term = term;
        }
        else if (cmd === 'gets') { // old `get`, streaming based
            argv = argv.map(String);
            var a1 = String(argv[0]);
            if (~a1.indexOf('#')) {
                assert(false, 'TODO');
                listener.abort();
            }
            else {
                var node = client.getNodeByPath(a1, cwd);
                if (!node.isValid || !node.isFile()) {
                    assert(false, a1 + ': No such file.');
                    listener.abort();
                }
                else {
                    var name = node.getName();
                    var size = MEGASDK.getUint64(node.getSize());
                    var download = MEGASDK.Download();
                    var startError = function(ex) {
                        assert(false, 'Unable to start download: ' + ex);
                        listener.abort();
                    };

                    download.then(function(meth) {
                        download = meth;
                        console.info('Using download method: ' + meth.name, meth);

                        var pending = 0;
                        var finish = function(name) {
                            if (name) download.save(name);
                            else download.close(true);
                            transfersListener.free();
                            $(window).trigger('resize');
                        };
                        var transfersListener = MEGASDK.getMegaListener('Transfer', {
                            onTransferData: function(api, transfer, data, size) {
                                console.debug('onTransferData', arguments, data);
                                if (!(data instanceof Uint8Array)) {
                                    console.error('** check this **', arguments);
                                }
                                else {
                                    pending++;
                                    download
                                        .write(data)
                                        .then(function() {
                                            pending--;
                                        }, function(ex) {
                                            pending = -1;
                                            assert(false, 'Write Error: ' + ex);
                                        });
                                }
                            },
                            onTransferFinish: function(api, transfer, error) {
                                var ec = error.getErrorCode();
                                var error = error.getErrorString();

                                if (ec !== MEGASDK.MegaError.API_OK) {
                                    term.echo('TRANSFER "'+name+'" FAILED: ' + error);
                                    finish();
                                }
                                else {
                                    var speed = MEGASDK.formatBytes(MEGASDK.getUint64(transfer.getSpeed()));

                                    (function save() {
                                        if (pending) {
                                            if (pending < 0) {
                                                term.echo('TRANSFER "'+name+'" FAILED: ' + error);
                                                finish();
                                            }
                                            else {
                                                console.warn('Pending writes, waiting...', pending);
                                                setTimeout(save, 200);
                                            }
                                        }
                                        else {
                                            term.echo('[[;#11bc78;]' + termEscape(name
                                                + ': transfered ' + offset + ' of ' + size
                                                + ' bytes. ('+~~(offset*100/size)+'%, '+speed+'/s)') + ']');

                                            if (offset !== size) {
                                                nextChunk();
                                            }
                                            else {
                                                console.info('Saving...', name);
                                                finish(name);
                                            }
                                        }
                                    })();
                                }
                            }
                        });
                        var offset = 0;
                        var chunkSize = 8 * 1024 * 1024;
                        // var chunkSize = 102400;
                        var nextChunk = function() {
                            var length = chunkSize;
                            if (offset + chunkSize > size) {
                                length = size - offset;
                            }
                            $(window).trigger('resize');
                            client.startStreaming(node, offset, length, transfersListener);
                            offset += length;
                        };

                        download
                            .open(name, '', size)
                            .then(function() {
                                term.echo('[[;#11bc78;]' + termEscape(name + ': Incoming file transfer starting (streaming mode)') + ']');
                                nextChunk();
                                listener.abort(null, MEGASDK.MegaError.API_OK);
                            }, startError);

                    }, startError);
                }
            }
        }
        else if (cmd === 'export') {
            var node = client.getNodeByPath(String(argv[0]), cwd);

            if (!node.isValid) {
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

                client.exportNode(node, ets || undefined, MEGASDK.getMegaListener({
                    onRequestFinish: function(api, request, error) {
                        if (error.getErrorCode() === MEGASDK.MegaError.API_OK) {
                            term.echo("Exported link: " + request.getLink());
                        }
                        return true;
                    }
                }));
            }
        }
        else if (cmd === 'mount') {
            var rootnodenames = [ "ROOT", "INBOX", "RUBBISH" ];
            var rootnodepaths = [ "/", "//in", "//bin" ];

            for (var i = 0 ; i < 3 ; ++i ) {
                term.echo(rootnodenames[i] + " on " + rootnodepaths[i]);
            }

            MEGASDK.mapMegaList(client.getContacts(), function(user) {
                var shares = client.getInShares(user);

                if (shares.isList && shares.size()) {
                    shares.forEach(function(share) {
                        var handle = share.getBase64Handle();
                        var node = client.getNodeByBase64Handle(handle);

                        if (node.isValid && node.isInShare()) {
                            term.echo("INSHARE on " + user.getEmail() + ":" + node.getName() + ' (' + accesslevels[client.getAccess(node)] + ')');
                        }
                    });
                }
                shares.free();
            });
            listener.abort(null, MEGASDK.MegaError.API_OK);
        }
        else if (cmd === 'share') {
            if (!argv.length) {
                // list all shares (incoming and outgoing)

                term.echo("Shared folders:");

                MEGASDK.mapMegaList(client.getOutShares(), function(share) {
                    var handle = share.getBase64Handle();
                    var node = client.getNodeByBase64Handle(handle);
                    var name = node.isValid && node.getName() || '???';
                    var line = '    ' + name + ', shared ';

                    if (node.isExported()) {
                        line += 'as exported link';
                    }
                    else {
                        line += 'with ' + share.getUser() + ' (' + accesslevels[share.getAccess()] + ')';
                    }

                    line += ', on ' + MEGASDK.timeStampToDate(share.getTimestamp(), true);

                    term.echo(line);
                });

                // XXX: getInSharesList returns nothing (!?)
                // MEGASDK.getMegaList(client.getInSharesList())
                    // .forEach(function(share) {
                        // var email = share.getUser();

                        // term.echo("From " + email + ":");
                    // });

                MEGASDK.mapMegaList(client.getContacts(), function(user) {
                    var shares = client.getInShares(user);

                    if (shares.isList && shares.size()) {
                        term.echo("From " + user.getEmail() + ":");

                        shares.forEach(function(share) {
                            term.echo("    " + share.getName() + ' (' + accesslevels[client.getAccess(share)] + ')');
                        });
                    }
                    shares.free();
                });
                listener.abort(null, MEGASDK.MegaError.API_OK);
            }
            else {
                var node = client.getNodeByPath(String(argv[0]), cwd);

                if (!node.isValid || !node.isFolder()) {
                    assert(false, argv[0] + ': Not such directory.');
                    listener.abort();
                }
                else if (argv.length == 1) {
                    // XXX: Sometimes node.isOutShare() retuns false for a node which is indeed an outshare :-/
                    if (node.isOutShare()) {
                        // var name = node.getName()
                        MEGASDK.mapMegaList(client.getOutShares(node), function(share) {
                            var handle = share.getBase64Handle();
                            console.debug('handle', handle);
                            node = client.getNodeByBase64Handle(handle);
                            var name = node.isValid && node.getName() || '???';
                            var line = '    ' + name;

                            // XXX: just using node.isExported() always detect the node
                            // as exported, so additionaly checking for !share.getUser() :-/

                            if (!share.getUser() && node.isExported()) {
                                line += ', shared as exported link';
                            }
                            else {
                                line += ', shared with ' + share.getUser() + ' (' + accesslevels[share.getAccess()] + ')';
                            }

                            line += ', on ' + MEGASDK.timeStampToDate(share.getTimestamp(), true);

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

                    client.share(node, argv[1], a, MEGASDK.getMegaListener({
                        onRequestFinish: function(api, request, error) {
                            assert(error.getErrorCode() === MEGASDK.MegaError.API_OK,
                                'Error sharing folder: ' + argv[0]);
                            return true;
                        }
                    }));

                }
            }
        }
        else if (cmd === 'users') {
            var visibility = ['hidden','visible','session user'];
            MEGASDK.mapMegaList(client.getContacts(), function(user) {
                var shares = client.getInShares(user);
                var line = '    ' + (user.getEmail() || '???')
                    + ', ' + (visibility[user.getVisibility()] || 'unknown visibility');

                if (shares.isList) {
                    var size = shares.size();
                    if (size) {
                        line += ', sharing ' + size + ' folder(s)';
                    }
                    shares.free();
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
        else if (cmd === 'passwd') {
            if (!client.isLoggedIn() || argv.length !== 3) {
                assert(false, 'Invalid operation.');
                listener.abort();
            }
            else if (argv[1] !== argv[2]) {
                assert(false, 'These passwords does not match.');
                listener.abort();
            }
            else {
                client.changePassword( argv[0], argv[1]);
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
                        "mount",
                        "ls [-R] [remotepath]",
                        "cd [remotepath]",
                        "pwd",
                        // "lcd [localpath]",
                        // "import exportedfilelink#key",
                        // "put localpattern [dstremotepath|dstemail:]",
                        "put [dstremotepath|dstemail:]",
                        "putq [cancelslot]",
                        // "get remotepath [offset [length]]",
                        // "get exportedfilelink#key [offset [length]]",
                        "get exportedfilelink#key",
                        "get remotepath",
                        "getq [cancelslot]",
                        // "pause [get|put] [hard] [status]",
                        // "getfa type [path] [cancel]",
                        "mkdir remotepath",
                        "rm remotepath",
                        "mv srcremotepath dstremotepath",
                        "cp srcremotepath dstremotepath|dstemail:",
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
                        "passwd oldpw newpw confirmpw",
                        "retry",
                        "recon",
                        "reload",
                        "logout",
                        "locallogout",
                        // "symlink",
                        "version",
                        "debug",
                        "findleaks",
                        "test"
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
'                                                               MEGA SDK version:  %% (4ba7cc6e)    \n';
