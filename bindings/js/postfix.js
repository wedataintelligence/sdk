    Module.isMyObject = function isMyObject(obj) {
        return (obj && typeof obj === 'object' && typeof obj.ptr === 'number');
    };
    Module.isNULL = function isNULL(obj) {
        return !Module.isMyObject(obj) || obj.ptr === 0;
    };
    Module.isMegaList = function isMegaList(obj) {
        return !Module.isNULL(obj) && typeof obj.size === 'function' && typeof obj.get === 'function';
    };
    Module.getMegaList = function getMegaList(aMegaList) {
        var list = [];
        if (Module.isMegaList(aMegaList)) {
            for (var len = aMegaList.size(), i = 0 ; i < len ; ++i ) {
                list.push(aMegaList.get(i));
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
        return info;
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
