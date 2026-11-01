"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.explicitOutcome = explicitOutcome;
function explicitOutcome(data, depth = 0) {
    if (depth > 4 || !data || typeof data !== 'object' || Array.isArray(data))
        return 'returned';
    const obj = data;
    if (obj.success === false || obj.ok === false || (typeof obj.exitCode === 'number' && obj.exitCode !== 0))
        return 'error';
    let result = obj.success === true || obj.ok === true || obj.exitCode === 0 ? 'success' : 'returned';
    for (const key of ['data', 'result', 'execution_result']) {
        const child = explicitOutcome(obj[key], depth + 1);
        if (child === 'error')
            return 'error';
        if (child === 'success')
            result = child;
    }
    return result;
}
