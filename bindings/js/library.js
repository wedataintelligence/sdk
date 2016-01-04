
mergeInto(LibraryManager.library, {
    jsnet_post: function(url, data, len) {
        url = Module.Pointer_stringify(url);

        if (DEBUG) console.debug('jsnet_post', arguments);

        var ctx = Module._xhrStack.length;
        while (ctx--) {
            var rs = Module._xhrStack[ctx].readyState;
            if (rs === 4 || rs === 0) {
                break;
            }
        }

        if (ctx < 0) {
            ctx = Module._xhrStack.push(new XMLHttpRequest) - 1;
        }

        try {
            var xhr = Module._xhrStack[ctx];

            if (!Module.cxxnet_progress) {
                Module.cxxnet_progress = Module.cwrap('jsnet_progress', 'number', ['number', 'number']);
                Module.cxxnet_onloadend = Module.cwrap('jsnet_onloadend', 'number', ['number', 'number', 'number', 'number']);
            }

            if (len) {
                data = Module.getArrayBuffer(data, len);
            }
            else {
                data = null;
            }

            xhr.onloadend = function(ev) {
                if (DEBUG) console.debug(ev.type, this.status, this);

                var data = 0, len = 0;
                if (this.status === 200) {
                    var u8 = new Uint8Array(this.response || []);
                    if ((data = Module._malloc(u8.length+1))) {
                        Module.HEAPU8.set(u8, data);
                        len = u8.length;
                    }
                }
                Module.cxxnet_onloadend(Module._ctxStack[ctx], this.status, data | 0, len);
                if (data) {
                    Module._free(data);
                }
                if (this.response) {
                    Module.neuterArrayBuffer(this.response);
                }
            };

            xhr.onprogress = function(ev) {
                if (DEBUG) console.debug(ev.type, ev.loaded, ev.total, ev, this);
                Module.cxxnet_progress(Module._ctxStack[ctx], ev.loaded);
            };

            xhr.open('POST', url);
            xhr.responseType = 'arraybuffer';
            if (xhr.responseType !== 'arraybuffer') {
                xhr.abort();
                throw new Error('ArrayBuffer responseType not supported.');
            }

            /*if (Module._useragent) {
                xhr.setRequestHeader('User-Agent', Module._useragent, false);
            }*/

            if (DEBUG) console.debug('jsnet_post.send', len, data && StringView(data).crud());

            xhr.send(data);
            data = xhr = undefined;
        }
        catch (ex) {
            Module.printErr(ex);
            return -1;
        }

        return ctx;
    }
});
