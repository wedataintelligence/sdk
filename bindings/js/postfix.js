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
    Module.mapMegaList = function mapMegaList(aMegaList, free, callback) {
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
    Module.getMegaAccountList = function getMegaAccountList(type, obj) {
        var list = [];
        if (typeof obj['getNum' + type + 's'] === 'function') {
            var items = obj['getNum' + type + 's']() | 0;
            type = 'get' + type;
            for (var i = 0 ; i < items ; ++i ) {
                list.push(obj[type](i));
            }
        }
        return list;
    };
    Module.getTreeInfo = function getTreeInfo(api, node) {
        var info = { bytes: 0, files: 0, folders: 0 };
        var proc = new MegaTreeProcessorInterface();
        proc.processMegaNode = function(node) {
            if (node.isFile()) {
                info.files++;
                info.bytes += Module.getUint64(node.getSize());
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
    };
    Module.getMegaListener = function getMegaListener(aListener) {
        var fn = [
            "onRequestStart", "onRequestFinish", "onRequestUpdate", "onRequestTemporaryError",
            "onTransferStart", "onTransferFinish", "onTransferUpdate", "onTransferTemporaryError",
            "onUsersUpdate", "onNodesUpdate", "onAccountUpdate",
            "onContactRequestsUpdate", "onReloadNeeded"
        ];
        var l = new MegaListenerInterface();

        for (var m in fn) {
            if (fn.hasOwnProperty(m)) {
                m = fn[m];
                l[m] = (function(m) {
                    return function(a1, a2, a3) {
                        var aa, nfo = [], r = false;
                        aa = [].slice.call(arguments).map(String);
                        if (a2 instanceof MegaRequest) {
                            nfo.push(a2.getRequestString());
                        }
                        else if (Object(a2).isList) {
                            nfo = a2.toArray();
                        }
                        console.debug(m, aa, arguments, nfo);
                        if (a3 instanceof MegaError) {
                            var c = a3.getErrorCode();
                            if (c !== MegaError.API_OK) {
                                console.error(m, c, a3.getErrorString());
                            }
                        }
                        if (aListener[m]) {
                            try {
                                r = aListener[m].apply(l, arguments);
                            }
                            catch (ex) {
                                Module.printErr(ex);
                            }
                        }
                        // [].slice.call(arguments, 2).map(destroy);
                        if (r === true) {
                            l.free();
                            l = aListener = undefined;
                        }
                    };
                })(m);
            }
        }
        fn = undefined;

        return l;
    };
    Module.getInt64 = function getInt64(value, unsigned) {
        var tempRet0 = Module.Runtime.getTempRet0();
        return Module.Runtime.makeBigInt(value, tempRet0, unsigned);
    };
    Module.getUint64 = function getUint64(value) {
        return Module.getInt64(value, true);
    };
    Module.formatBytes = function formatBytes(a) {
        var b = ["bytes", "KB", "MB", "GB", "TB", "PB", "EB"];
        if (a === 0) {
            return a + " " + b[1];
        }
        var c = Math.floor(Math.log(a) / Math.log(1024));
        return (a / Math.pow(1024, Math.floor(c))).toFixed(2) + " " + b[c];
    };
    Module.timeStampToDate = function timeStampToDate(time, iso) {
        var date = new Date((time | 0) * 1000);
        if (iso) date = date.toISOString();
        return date;
    };
    return Module;
}));
