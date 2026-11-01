"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeTargetKeys = activeTargetKeys;
exports.keepGlobalOnRestore = keepGlobalOnRestore;
function activeTargetKeys(values) {
    return Object.keys(values).filter(key => key.startsWith('applied:') && values[key] === 'yes');
}
function keepGlobalOnRestore(values, currentScopeKey) {
    return activeTargetKeys(values).some(key => key !== 'applied:' + currentScopeKey);
}
