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
    return Module;
}));
