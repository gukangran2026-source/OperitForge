"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolLogPreview = toolLogPreview;
// Keep the original result intact for copy; only simplify a display preview.
function toolLogPreview(body) {
    try {
        const data = JSON.parse(body);
        if (!data || typeof data !== 'object' || Array.isArray(data))
            return body;
        const obj = data;
        for (const key of ['output', 'stdout', 'error', 'message']) {
            if (typeof obj[key] === 'string' && obj[key].trim()) {
                const command = typeof obj.command === 'string' ? '$ ' + obj.command + '\n' : '';
                return command + obj[key];
            }
        }
    }
    catch (_error) { /* ordinary text is already a valid preview */ }
    return body;
}
