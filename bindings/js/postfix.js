    var DEBUG = true;
    Module.randomDevice = (function() {
        var device;
        if (typeof crypto !== "undefined") {
            var randomBuffer;
            device = function(seedSize) {
                if (!randomBuffer || seedSize > randomBuffer.byteLength) {
                    randomBuffer = new Uint8Array(seedSize+1);
                    crypto.getRandomValues(randomBuffer);
                }
                var b = randomBuffer[seedSize];
                if (seedSize < 2) {
                    randomBuffer = null;
                }
                return b;
            };
        }
        else if (ENVIRONMENT_IS_NODE) {
            device = function() {
                return require("crypto").randomBytes(1)[0];
            };
        }
        else {
            Module.printErr('Using weak random number generator.');
            device = function() {
                return Math.random() * 256 | 0;
            };
        }
        return device;
    })();
    function readStruct(ptr, spec, outv) {
        // readStruct(ctx, {op: 16, access: 20, size: [24, 64]});
        var result = outv || {};
        var lastm;

        if (typeof spec === 'number') {
            spec = { __value__: spec };
        }

        for (var m in spec) {
            if (spec.hasOwnProperty(m)) {
                var a = spec[m];
                if (typeof a === 'number') {
                    a = [a];
                }
                var op = null;
                var type = a[1];
                var offset = a[0];
                switch(type) {
                    case readStruct.OP_STRING:
                    case readStruct.OP_BUFFER:
                        op = type;
                        type = 0;
                }
                if (!type) {
                    type = 32;
                }
                if (typeof type === 'number') {
                    type = 'i' + type;
                }
                var value = getValue(ptr + offset, type);

                if (type !== 'i64') {
                    if (op === readStruct.OP_STRING) {
                        result[m] = Pointer_stringify(value);
                    }
                    else if (op === readStruct.OP_BUFFER) {
                        result[m] = getArrayBuffer(value, result[lastm]);
                    }
                    else {
                        result[m] = value;
                    }
                }
                else {
                    Runtime.setTempRet0(getValue(ptr + offset + 4, type, 1));
                    result[m] = getUint64(value);
                }
                lastm = m;
            }
        }
        return result.__value__ || result;
    }
    readStruct.OP_STRING = 0;
    readStruct.OP_BUFFER = -1;
    define('readStruct', freeze(readStruct));
    function mapMegaList(aMegaList, free, callback) {
        var list = [];
        if (Object(aMegaList).isList) {
            if (typeof free === 'function') {
                callback = free;
                free = true;
            }
            list = aMegaList.map(callback)
            if (free) {
                aMegaList.free();
            }
        }
        return list;
    };
    define('mapMegaList', mapMegaList);
    function getMegaAccountList(type, obj) {
        var list = [];
        if (typeof obj['getNum' + type + 's'] === 'function') {
            var items = obj['getNum' + type + 's']() | 0;
            type = 'get' + type;
            for (var i = 0 ; i < items ; ++i ) {
                list.push(obj[type](i));
            }
        }
        return list;
    }
    define('getMegaAccountList', getMegaAccountList);
    function getTreeInfo(api, node) {
        var info = { bytes: 0, files: 0, folders: 0 };
        var proc = new MegaTreeProcessorInterface();
        proc.processMegaNode = function(node) {
            node = weakPointer(node, MegaNode);
            if (node.isFile()) {
                info.files++;
                info.bytes += getUint64(node.getSize());
            }
            else {
                info.folders++;
            }
            return true;
        };
        api.processMegaTree(node, proc, true);
        info.folders--;
        proc.free();
        return info;
    }
    define('getTreeInfo', getTreeInfo);
    var ic = {
        Global: ["onUsersUpdate", "onNodesUpdate", "onAccountUpdate", "onContactRequestsUpdate", "onReloadNeeded"],
        Transfer: ["onTransferStart", "onTransferFinish", "onTransferUpdate", "onTransferData", "onTransferTemporaryError"],
        Request: ["onRequestStart", "onRequestFinish", "onRequestUpdate", "onRequestTemporaryError"]
    };
    ic['*'] = Object.keys(ic).reduce(function(d,a) { return d.concat(ic[a]) }, []);
    function getMegaListener(aType, aListener) {
        if (typeof aType === 'object') {
            aListener = aType;
            aType = '';
        }

        var l = new Module['Mega' + aType + 'ListenerInterface']();
        var fn = getMegaListener.ifaces[aType || '*'];
        var a2c, a3c;

        for (var m in fn) {
            if (fn.hasOwnProperty(m)) {

                m = fn[m];

                if (m[2] === 'C') a2c = 'MegaContactRequestList';
                else if (m[2] === 'U') a2c = 'MegaUserList';
                else if (m[2] === 'R') a2c = 'MegaRequest';
                else if (m[2] === 'A') a2c = 'MegaTransfer';
                else if (m[2] === 'N') a2c = 'MegaNodeList';
                else if (m[2] === 'T') a2c = 'MegaTransfer';
                else a2c = null;

                a3c = (m.substr(-6) === 'Finish' || m.substr(-5) === 'Error') ? 'MegaError' : null;

                l[m] = (function(m, a2c, a3c) {
                    return function(a1, a2, a3) {
                        var onTransferData = (m === 'onTransferUpdate' && aListener.onTransferData);

                        if (DEBUG) console.debug(m, arguments);

                        if (aListener[m] || onTransferData) {
                            var r = false;
                            var args = [].slice.call(arguments);

                            a1 = wrapPointer(a1, MegaApi);
                            if (a2c) a2 = wrapPointer(a2, Module[a2c]);
                            if (a3c) a3 = wrapPointer(a3, Module[a3c]);

                            if (DEBUG) {
                                var nfo;
                                if (a2 instanceof MegaRequest) {
                                    nfo = a2.getRequestString();
                                }
                                else if (a2 instanceof MegaTransfer) {
                                    nfo = [a2.getTransferString(), a2.getPath(),
                                            a2.getBase64NodeHandle(), a2.getTag()];
                                }
                                else if (Object(a2).isList) {
                                    nfo = a2.toArray();
                                }
                                if (a3 instanceof MegaError) {
                                    var c = a3.getErrorCode();
                                    if (c !== MegaError.API_OK) {
                                        console.error(m, c, a3.getErrorString());
                                    }
                                }
                                console.debug(m, [a1,a2,a3].map(String), nfo);
                            }

                            // XXX: There is some problem with onTransferData, let's mimic it through onTransferUpdate
                            //      except that we pass an ArrayBuffer rather than a string (byte *lastBytes)
                            if (onTransferData) {
                                var size = a2.getDeltaSize();
                                var voidPtr = a2.getLastBytes();
                                var data = getArrayBuffer(voidPtr, size);
                                unwrapPointer(voidPtr);

                                try {
                                    aListener.onTransferData(a1, a2, data, size);
                                }
                                catch (ex) {
                                    Module.printErr(ex);
                                }
                            }

                            if (aListener[m]) {
                                try {
                                    args[0] = a1;
                                    args[1] = a2;
                                    args[2] = a3;
                                    r = aListener[m].apply(aListener, args);
                                }
                                catch (ex) {
                                    Module.printErr(ex);
                                }
                            }

                            if (a3c) {
                                if (a2c) unwrapPointer(a2);
                                unwrapPointer(a3);
                            }

                            if (r === true) {
                                l.free();
                                l = aListener = undefined;
                            }
                        }
                    };
                })(m, a2c, a3c);
            }
        }
        fn = undefined;

        return l;
    }
    getMegaListener.ifaces = ic;
    ic = undefined;
    define('getMegaListener', getMegaListener);
    function getInt64(value, unsigned) {
        var tempRet0 = Module.Runtime.getTempRet0();
        return Module.Runtime.makeBigInt(value, tempRet0, unsigned);
    }
    define('getInt64', getInt64);
    function getUint64(value) {
        return getInt64(value, true);
    }
    define('getUint64', getUint64);
    function Pointer_length(ptr) {
        var t, i = 0;
        ptr |= 0;
        while (ptr + i < TOTAL_MEMORY) {
            t = HEAPU8[ptr + i >> 0];
            if (t == 0) break;
            i++;
        }
        return i;
    }
    define('Pointer_length', Pointer_length);
    function writeArrayBufferToMemory(buffer) {
        buffer = new Uint8Array(buffer);
        var data = _malloc(buffer.byteLength);
        if (data) {
            Module.HEAPU8.set(buffer, data);
        }
        return data;
    }
    define('writeArrayBufferToMemory', writeArrayBufferToMemory);
    function getArrayBuffer(ptr, size) {
        if (ptr && typeof ptr === 'object') ptr = ptr.ptr;
        return new Uint8Array(Module.HEAPU8.buffer, ptr | 0, size | 0);
    }
    define('getArrayBuffer', getArrayBuffer);
    function neuterArrayBuffer(ab) {
        if (!(ab instanceof ArrayBuffer)) {
            ab = ab && ab.buffer;
        }
        try {
            if (typeof ArrayBuffer.transfer === 'function') {
                ArrayBuffer.transfer(ab, 0); // ES7
            }
            else {
                if (!neuterArrayBuffer.dataWorker) {
                    neuterArrayBuffer.dataWorker = new Worker("data:application/javascript,var%20d%3B");
                }
                neuterArrayBuffer.dataWorker.postMessage(ab, [ab]);
            }
        }
        catch (ex) {}
    }
    define('neuterArrayBuffer', neuterArrayBuffer);
    function formatBytes(a) {
        var b = ["bytes", "KB", "MB", "GB", "TB", "PB", "EB"];
        if (a === 0) return a + " " + b[1];
        var c = Math.floor(Math.log(a) / Math.log(1024));
        a /= Math.pow(1024, Math.floor(c));
        if (c) a = a.toFixed(2);
        return a + " " + b[c];
    }
    define('formatBytes', formatBytes);
    function timeStampToDate(time, iso) {
        var date = new Date((time | 0) * 1000);
        if (iso) date = date.toISOString();
        return date;
    }
    define('timeStampToDate', timeStampToDate);
    return Module;
}));
