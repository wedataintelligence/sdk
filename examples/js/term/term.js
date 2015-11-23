function MegaTerminalListener(aClient, aTerm, aCallback) {
    var self = this;
    var listener = new MegaListenerInterface();
    listener.onRequestStart = function(client, request) {
        console.debug('onRequestStart', arguments, request.getRequestString());
    };
    listener.onRequestFinish = function(client, request, error) {
        console.debug('onRequestFinish', arguments, request.getRequestString(), error.getErrorCode(), error.getErrorString());
        self.abort(request.getRequestString(), error.getErrorCode());
    };
    listener.onRequestUpdate = function(client, request) {
        console.debug('onRequestUpdate', arguments, request.getRequestString());
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
            if (type === 'err') {
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
                    msg = '[[;' + color + ';]' + tag + ' ' + msg;
                }
                term.echo.apply(term, [msg].concat(args));
            }
        };

        listener.reset(term,
            function(cmd, e) {
                console.log = oldc;
                $(window).trigger('resize');
                if (cmd === 'LOGIN' && e === MEGASDK.MegaError.API_OK) {
                    tty('fetchNodes', term);
                }
            });

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
                mtl.abort();
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
