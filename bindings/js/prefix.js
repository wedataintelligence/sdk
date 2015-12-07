/**
 * This file is part of the MEGA SDK - Client Access Engine.
 * (c) 2013-2016 by Mega Limited, Auckland, New Zealand
 *
 * Applications using the MEGA API must present a valid application key
 * and comply with the the rules set forth in the Terms of Service.
 *
 * The MEGA SDK is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 *
 * @copyright Simplified (2-clause) BSD License.
 *
 * You should have received a copy of the license along with this
 * program.
 */

;(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(factory);
    }
    else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    }
    else {
        root.MEGASDK = factory();
    }
}(this, /** @lends MEGASDK */ function(Module) {

var _emscripten_async_call = function(func, arg, ms) {
    Module["noExitRuntime"] = true;
    setTimeout(function() {
        if (!ABORT) {
            Runtime.getFuncWrapper(func, "vi")(arg);
        }
    }, ms | 0);
}
