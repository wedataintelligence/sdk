MEGASDK.Terminal = function (client) {
    var $e = $('#terminal').empty();

    client.setLogLevel(5);
    client.addListener({
        onRequestStart : function (client, request) {
            console.debug('onRequestStart', arguments);
        },
        onRequestUpdate : function (client, request) {
            console.debug('onRequestUpdate', arguments);
        },
        onRequestFinish : function (client, request, error) {
            console.debug('onRequestFinish', arguments);
        }
    });

    var colors = {
        'error': '#ff0000',
        'debug': '#0000ff',
        'warn': '#C25700',
        'info': '#00899E',
    };

    var apiFuncs = {_:[]};

    for (var fn in client) {
        if (client.hasOwnProperty(fn)) {
            apiFuncs[fn.toLowerCase()] = fn;
            apiFuncs._.push(fn);
        }
    }

    $e.terminal(function tty(line, term) {
        var argv = $.terminal.parseArguments(line);
        console.debug(argv, arguments);

        var oldc = console.log;
        var ready = function() {
            term.resume();
            console.log = oldc;
            $(window).trigger('resize');
        };
        console.log = function() {
            var type;
            var msg = String(arguments[0]);
            var args = [].slice.call(arguments, 1);
            var done = /Request \(.*?\) finished/.test(msg);
            if (msg[0] === '[') {
                msg = msg.replace(/\[[\d:]+\]\[(.+?)\]\s*/, function(a, b) {
                    type = b;
                    return '';
                });
            }
            if (type === 'err') {
                type = 'error';
            }
            if (typeof console[type] !== 'function' || type === 'log') {
                type = 'debug';
            }
            console[type].apply(console, arguments);
            if (!type || type === 'info' || type === 'error' || done) {
                var color = colors[type];
                if (color) {
                    var tag = type[0] === 'e' || type[0] === 'w' ? '&#91;!&#93;' : '';
                    msg = '[[;' + color + ';]' + tag + ' ' + msg;
                }
                term.echo.apply(term, [msg].concat(args));
            }
            if (done) {
                ready();
                if (cmd === 'login' && type === 'info') {
                    tty('fetchNodes', term);
                }
            }
        };

        term.pause();

        var cmd = argv.shift();
        if (cmd === 'createfolder') {
            client.createFolder(argv[0], client.getRootNode());
        }
        else {
            cmd = apiFuncs[cmd] || cmd;

            if (typeof client[cmd] === 'function') {
                client[cmd].apply(client, argv);
            }
            else {
                term.echo("Unknown command: " + (cmd || '(null)'));
                ready();
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
        "overflow-y" : "scroll",
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
