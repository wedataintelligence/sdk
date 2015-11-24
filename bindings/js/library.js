
mergeInto(LibraryManager.library, {
    jsnet_init : function() {
        Module._xhrStack =  [];
        Module._useragent = null;
    },
    jsnet_setuseragent: function(ua) {
        Module._useragent = Module.Pointer_stringify(ua);
    },
    jsnet_getuseragent: function() {
        return allocate(intArrayFromString(Module._useragent || ''), 'i8', ALLOC_STACK);
    },
    jsnet_cancel: function(ctx) {
        Module._xhrStack[ctx].abort();
    },
    jsnet_post: function(url, data) {
        url = Module.Pointer_stringify(url);
        data = Module.Pointer_stringify(data);

        var ctx = Module._xhrStack.length;
        while (ctx--) {
            if (Module._xhrStack[ctx].readyState === 4) {
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

            xhr.onloadend = function(ev) {
                var data = 0, len = 0;
                if (this.status === 200) {
                    var u8 = new Uint8Array(this.response || []);
                    len = u8.length;
                    if ((data = Module._malloc(len))) {
                        Module.HEAPU8.set(u8, data);
                    }
                }
                Module.cxxnet_onloadend(ctx, this.status, data, len);
                if (data) {
                    Module._free(data);
                }
            };

            xhr.upload.onprogress =
            xhr.onprogress = function(ev) {
                Module.cxxnet_progress(ctx, ev.loaded);
            };

            xhr.open('POST', url);
            xhr.responseType = 'arraybuffer';

            /*if (Module._useragent) {
                xhr.setRequestHeader('User-Agent', Module._useragent, false);
            }*/

            xhr.send(data);
        }
        catch (ex) {
            console.error(ex);
            return -1;
        }

        return ctx;
    }
});
