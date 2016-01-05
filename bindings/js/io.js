var dlmavail = {};
var dlmethods = [];

function Download(flags) {
    if ((flags |= 0) === Download.TYPE_ANY) {
        flags = 0xffff;
    }
    return new Promise(function(resolve, reject) {
        var meth = Download.get(flags);
        if (meth) {
            return resolve(meth);
        }

        var pending = 0;
        var walk = function(name) {
            if (--pending === 0) {
                meth = Download.get(flags);
                if (meth) {
                    resolve(meth);
                }
                else {
                    reject(-0xBADF);
                }
            }
            delete dlmavail[name];
        };
        var check = function(name, meth) {
            pending++;

            meth.validate()
                .then(function() {
                    dlmethods.push(meth);
                    walk(name);
                }, function() {
                    walk(name);
                });
        };

        for (var n in dlmavail) {
            if (dlmavail.hasOwnProperty(n)) {
                var meth = dlmavail[n];

                if (meth.flags & flags) {
                    check(n, meth);
                }
            }
        }

        if (!pending) {
            Module.printErr('No Download method available.');
            reject(0xBADF);
        }
    });
}
Download.TYPE_ANY       = 0;
Download.TYPE_MEMBASED  = 1;
Download.TYPE_DISKBASED = 2;
Download.TYPE_TRANSPORT = 4;
Download.add = function(name, flags, pri, proto) {
    var dlmethod = function() {};
    dlmethod.pri = pri;
    dlmethod.flags = flags;
    dlmethod.validate = proto.validate;
    delete proto.validate;
    dlmethod.prototype = proto;
    dlmethod.prototype.constructor = dlmethod;
    dlmethod.prototype.pri = pri;
    dlmethod.prototype.name = name;
    dlmethod.prototype.flags = flags;
    freeze(dlmethod.prototype);
    freeze(dlmethod);
    dlmavail[name] = dlmethod;
};
Download.get = function(flags) {
    var meths = [];
    var len = dlmethods.length;
    while (len--) {
        var meth = dlmethods[len];

        if (meth.flags & flags) {
            meths.push(meth);
        }
    }

    if (meths.length) {
        meths.sort(function(a,b) { return a.pri < b.pri });
        return new meths[0];
    }
    return null;
};
define('Download', freeze(Download));

if (ENVIRONMENT_IS_WEB) {
    Download.add('MemIO', Download.TYPE_MEMBASED, -3, {
        validate: function() {
            if ("download" in document.createElementNS("http://www.w3.org/1999/xhtml", "a")) {
                return Promise.resolve();
            }
            return Promise.reject();
        },
        open: function(name, path, size) {
            this.offset = 0;
            this.buffer = new Uint8Array(size | 0);
            return Promise.resolve();
        },
        close: function() {
            Module.neuterArrayBuffer(this.buffer);
            this.buffer = null;
            return Promise.resolve();
        },
        save: function(name, path) {
            var self = this;
            return new Promise(function(resolve, reject) {
                var blob = new Blob([self.buffer]);
                var uri = URL.createObjectURL(blob);
                var node = document.getElementById('dllink');
                node.download = name;
                node.href = uri;
                node.click();

                setTimeout(function() {
                    URL.revokeObjectURL(uri);
                    self.close().then(resolve);
                }, 2000);
            });
        },
        write: function(data) {
            this.buffer.set(data, this.offset);
            this.offset += data.byteLength;
            return Promise.resolve();
        }
    });
    Download.add('MSMemIO', Download.TYPE_MEMBASED, -2, {
        validate: function() {
            if (navigator.msSaveOrOpenBlob) {
                return Promise.resolve();
            }
            return Promise.reject();
        },
        open: function() {
            this.bb = new MSBlobBuilder();
            return Promise.resolve();
        },
        close: function() {
            if (this.bb) {

                this.bb = null;
            }
            return Promise.resolve();
        },
        save: function(name) {
            navigator.msSaveOrOpenBlob(this.bb.getBlob(), name);
            return this.close();
        },
        write: function(data) {
            this.bb.append(data.buffer || data);
            return Promise.resolve();
        }
    });
}

var FileAccess = {
    _statCache: {},

    _linkDynCall: function(promise, context, callback, retry) {
        function dynCall(failed, data) {
            if (data instanceof ArrayBuffer) {
                data = writeArrayBufferToMemory(data);
            }
            Runtime.dynCall('viiiii', callback, [context, failed | 0, retry | 0, true, data | 0]);
            if (data) Module._free(data);
        };

        promise.then(function(data) { dynCall(false, data); }, function(ex) {
            Module.printErr('Promise rejected, ' + ex);
            dynCall(true);
        });

        return promise;
    },

    _readContext: function(context, spec) {
        spec = spec || {op: 16, access: 20, pos: [24, 64], name: [40, 0]};
        spec.fa = 48;

        var ctx = readStruct(context, spec);
        readStruct(ctx.fa, {size: [8, 64], mtime: [16, 64]}, ctx);

        return ctx;
    },

    _wrap: function(fn, args) {
        try {
            args[0] = Pointer_stringify(args[0]);
            var meth = this._stat(args[0]).dlmeth;

            if (DEBUG) console.debug('FileAccess.' + fn, args, meth);

            if (meth && typeof meth[fn] === 'function') {
                return meth[fn].apply(meth, args);
            }
        }
        catch (ex) {
            Module.printErr(ex);
        }

        return true;
    },

    _setStatEntry: function(uid, data) {
        if (DEBUG) console.debug('FileAccess._setStatEntry', uid, data);
        assert(this._stat(uid, 1) === false, 'Stat entry exists.');
        this._statCache[uid] = data;
    },
    _removeStatEntry: function(uid) {
        var r = false;

        if (DEBUG) console.debug('FileAccess._removeStatEntry', uid);

        if (this._statCache[uid]) {
            r = this._statCache[id];
            delete this._statCache[uid];
        }
        else {
            var c = this._statCache;

            for (var id in c) {
                if (c.hasOwnProperty(id)) {
                    var i = c[id];

                    if (i.fileAccess === uid || i.name === uid) {
                        r = i;
                        delete this._statCache[id];
                        break;
                    }
                }
            }
        }

        return r;
    },
    _stat: function(uid, silent) {
        var c = this._statCache;

        if (typeof uid === 'object') {
            uid = String(uid);
        }

        if (DEBUG) console.debug('FileAccess._stat', uid);

        if (c[uid]) {
            return c[uid];
        }

        for (var i in c) {
            if (c.hasOwnProperty(i)) {
                i = c[i];

                if (i.fileAccess === uid || i.name === uid) {
                    return i;
                }
            }
        }

        if (!silent) {
            throw new Error('Stat entry not found: ' + uid);
        }

        return false;
    },

    utime: function() {
        return this._wrap('utime', arguments);
    },
    unlink: function() {
        return this._wrap('unlink', arguments);
    },

    save: function(oldname, newname) {
        var r = true;

        oldname = Pointer_stringify(oldname);
        newname = Pointer_stringify(newname);

        try {
            this._stat(oldname).dlmeth.save(newname);
        }
        catch (ex) {
            Module.printErr(ex);
            r = false;
        }

        this._removeStatEntry(oldname);

        return r;
    },
    read: function(context, callback) {
        var ctx = this._readContext(context, {offset: [24, 64], length: 32});
        var promise;

        if (DEBUG) console.debug('FileAccess.read', arguments, ctx);

        try {
            promise = fileReader(this._stat(ctx.fa), ctx.offset, ctx.offset + ctx.length);
        }
        catch (ex) {
            promise = Promise.reject(ex);
        }
        return this._linkDynCall(promise, context, callback);
    },
    write: function(context, callback) {
        var ctx = this._readContext(context, {offset: [24, 64], length: 32, buffer: [40, -1]});
        var promise;

        if (DEBUG) console.debug('FileAccess.write', arguments, ctx);

        try {
            promise = this._stat(ctx.fa).dlmeth.write(ctx.buffer, ctx.length, ctx.offset);
        }
        catch (ex) {
            promise = Promise.reject(ex);
        }
        return this._linkDynCall(promise, context, callback);
    },
    open: function(context, callback) {
        var promise, ctx;

        try {
            ctx = this._readContext(context);

            if (DEBUG) console.debug('FileAccess.open', arguments, ctx);

            if (ctx.op !== 3) {
                throw new Error('Invalid FileAccess.open mode, ' + ctx.op);
            }
            if (!(ctx.access & 3)) {
                throw new Error('Invalid access mode ' + ctx.access);
            }
            if ((ctx.access & 2) && !ctx.mtime) {
                throw new Error('Write access error...');
            }
        }
        catch (ex) {
            promise = ex;
        }

        if (promise) {
            promise = Promise.reject(promise);
        }
        else if (ctx.access & 1) {
            var file = this._stat(ctx.name, 1);
            if (!file) {
                promise = Promise.reject('Stat entry not found.');
            }
            else if (!(file instanceof File)) {
                promise = Promise.reject('Unpexted non-File entry.');
            }
            else {
                file.fileAccess = ctx.fa;
                promise = Promise.resolve();
            }
        }
        else if (ctx.access & 2) {
            promise = Download()
                .then(function(meth) {
                    var filename = ctx.name;

                    if (DEBUG) console.debug('Using download method %s for %s', meth.name, filename, meth);

                    FileAccess._setStatEntry(ctx.fa, {
                        fileAccess: ctx.fa,
                        name: ctx.name,
                        size: ctx.size,
                        mtime: ctx.mtime,
                        dlmeth: meth
                    });

                    var path = filename.split(/[\\\/]/);
                    if (path.length < 2) {
                        path = '';
                    }
                    else {
                        filename = path.pop();
                        path = path.join("/");
                    }

                    return meth.open(filename, path, ctx.size);
                });
        }

        return this._linkDynCall(promise, context, callback);
    }
};
define('FileAccess', freeze(FileAccess));

MegaApi.prototype._startUpload = MegaApi.prototype.startUpload;
MegaApi.prototype.startUpload = function(aFile) {
    if (!(aFile instanceof File)) {
        throw new Error('Invalid argument.');
    }
    var args = [].slice.call(arguments, 1);
    args.unshift(aFile.name);
    aFile.mtime = Math.floor(aFile.lastModifiedDate / 1000);
    FileAccess._setStatEntry(aFile.name, aFile);
    return this._startUpload.apply(this, args);
};

function StringView(data, size) {
    if (!(this instanceof StringView)) {
        return new StringView(data, size);
    }

    define('size', size | 0, this);
    define('ptr',  typeof data === 'number' ? data : null, this);

    if (ArrayBuffer.isView(data)) {
        var offset = data.byteOffset;
        var length = data.byteLength;
        data = data.buffer;
        if (offset) {
            data = data.slice(offset, offset + length);
            this._ownBuffer = true;
        }
    }

    if (data instanceof ArrayBuffer) {
        this._buffer = data;
    }
    else if (!this.ptr) {
        this._rawData = String(data);
    }
}
StringView.__cache__ = {};
StringView.prototype = {
    constructor: StringView,
    get rawData() {
        if (!this._rawData) {
            if (this.ptr) {
                if (!StringView.__cache__[this.ptr]) {
                    StringView.__cache__[this.ptr] = Pointer_stringify(this.ptr);
                }
                this._rawData = StringView.__cache__[this.ptr];
            }
            else {
                var u8 = new Uint8Array(this._buffer);
                this._rawData = UTF8ArrayToString(u8, 0);
            }
        }
        return this._rawData;
    },
    get buffer() {
        if (!this._buffer) {
            if (this.ptr) {
                var size = this.size > 0
                    ? this.size
                    : Pointer_length(this.ptr);
                this._buffer = getArrayBuffer(this.ptr, size);
            }
            else {
                var str = this._rawData;
                var len = str.length * 6 + 1;
                var ab = new ArrayBuffer(len);
                var u8 = new Uint8Array(ab);

                len = stringToUTF8Array(str, u8, 0, len);
                this._buffer = ab.slice(0, len);
                this._ownBuffer = true;
            }
        }
        return this._buffer;
    },
    get crc32() {
        if (!this._crc32) {
            if (this.ptr) {
                var size = this.size > 0
                    ? this.size
                    : Pointer_length(this.ptr);
                this._crc32 = _crc32(this.ptr, size);
            }
            else {
                var data = this.buffer;
                var size = data.byteLength;
                data = writeArrayBufferToMemory(data, size);
                this._crc32 = _crc32(data, size);
                _free(data);
            }
            this._crc32 >>>= 0;
        }
        return this._crc32;
    },
    toString: function() {
        return this.rawData;
    },
    crud: function() {
        var v = String(this);
        this.free();
        return v;
    },
    free: function() {
        if (this._ownBuffer && this._buffer) {
            neuterArrayBuffer(this._buffer);
        }
        if (this.ptr) {
            delete StringView.__cache__[this.ptr];
        }
        delete this._crc32;
        delete this._buffer;
        delete this._rawData;
    }
};
freeze(StringView.prototype);
define('StringView', freeze(StringView));

function fileReader(aFile, aStart, aEnd) {
    return new Promise(function(resolve, reject) {
        if (!aFile.slice) {
            aFile.slice = aFile.webkitSlice;
        }
        var blob = aFile.slice(aStart | 0, aEnd);
        var reader = new FileReader();
        reader.onerror = function(ev) {
            reject(ev);
        };
        reader.onload = function(ev) {
            try {
                var t = ev.target;
                if (t.readyState !== FileReader.DONE) {
                    throw new Error('Invalid state: ' + t.readyState);
                }
                var ab = t.result;
                if (!(ab instanceof ArrayBuffer)) {
                    throw new Error('Invalid data type.');
                }
                resolve(ab);
            }
            catch (ex) {
                Module.printErr(ex);
                reject(ex);
            }
        };
        reader.readAsArrayBuffer(blob);
        aFile = blob = reader = undefined;
    });
}
define('fileReader', fileReader);
