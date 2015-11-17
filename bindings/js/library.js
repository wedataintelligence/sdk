
mergeInto(LibraryManager.library, {
    jsnet_init : function() {
		this._xhrStack =  [];
		this._useragent = null;
	},
    jsnet_setuseragent: function(ua) {
        this._useragent = Module.Pointer_stringify(ua);
    },
    jsnet_getuseragent: function() {
        return allocate(intArrayFromString(this._useragent || ''), 'i8', ALLOC_STACK);
    },
    jsnet_cancel: function(ctx) {
        this._xhrStack[ctx].abort();
    },
    jsnet_post: function(url, data) {
        url = Module.Pointer_stringify(url);
        data = Module.Pointer_stringify(data);

        var ctx = this._xhrStack.length;
        while (ctx--) {
            if (this._xhrStack[ctx].readyState === 4) {
                break;
            }
        }

        if (ctx < 0) {
            var xhr = typeof window === 'undefined' ? require("xhr2") : XMLHttpRequest;
            ctx = this._xhrStack.push(new xhr) - 1;
        }

        try {
            var xhr = this._xhrStack[ctx];

            if (!this.cxxnet_progress) {
				this.cxxnet_progress = Module.cwrap('jsnet_progress', 'number', ['number', 'number']);
				this.cxxnet_onloadend = Module.cwrap('jsnet_onloadend', 'number', ['number', 'number', 'string', 'number']);
			}

            xhr.onloadend = function(ev) {
                var data = 0, len = 0;
                if (this.status === 200) {
					var u8 = new Uint8Array(this.response);
					data = String.fromCharCode.apply(null, u8);
					len = data.length;
                }
                cxxnet_onloadend(ctx, this.status, data, len);
                if (data) {
                    Module._free(data);
                }
            };

            xhr.upload.onprogress =
            xhr.onprogress = function(ev) {
                cxxnet_progress(ctx, ev.loaded);
            };

            xhr.open('POST', url);
            xhr.responseType = 'arraybuffer';

            /*if (this._useragent) {
                xhr.setRequestHeader('User-Agent', this._useragent, false);
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
