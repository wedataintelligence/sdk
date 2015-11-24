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
        console.debug('onNodesUpdate', arguments/*, nodes.size(), nodes.get()*/);
    };
    listener.onUsersUpdate = function(api, users) {
        console.debug('onUsersUpdate', arguments);
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
}
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

    var isEMOBJ = function(obj) {
        return (obj && typeof obj === 'object' && typeof obj.ptr === 'number');
    };
    var isNULL = function(obj) {
        return !isEMOBJ(obj) || obj.ptr === 0;
    };

    var UNIT_TEST = false;
    var cwd = false;

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
            if (type === 'info' || type === 'error') {
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
                            tty('fetchNodes', term);
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

        var cmd = argv.shift().toLowerCase();
        if (cmd === 'createfolder' || cmd === 'mkdir') {
            client.createFolder(argv[0], cwd);
        }
        else if (cmd === 'cd') {
            var e;
            var node = client.getNodeByPath(argv[0], cwd);
            if (isNULL(node)) {
                assert(false, argv[0] + ': No such file or directory.');
            }
            else if (node.getType() !== MEGASDK.MegaNode.TYPE_FOLDER) {
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
            if (isNULL(node)) {
                assert(false, argv[0] + ': No such file or directory.');
                listener.abort();
            }
            else {
                client.remove(node);
            }
        }
        else if (cmd === 'ls') {

        }
        else {
            cmd = apiFuncs[cmd] || cmd;

            if (cmd === 'test') {
                UNIT_TEST = 1;
                cmd = 'login';
                argv = '.';
            }

            if (cmd === 'login' && String(argv) === '.') {
                argv = ['jssdk@yopmail.com', 'jssdktest'];
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
                    term.echo("API Commands:");
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
                }
                else {
                    term.echo("Unknown command: " + (cmd || '(null)'));
                }
                listener.abort();
            }
        }
    }, {
        greetings : 'Javascript SDK',
        name : 'jssdk',
        width : '99%',
        prompt : 'jssdk> '
    });

    var $term = $('.terminal-output');
    $term.css({
        "overflow-y" : "auto",
        "overflow-x" : "hidden",
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
