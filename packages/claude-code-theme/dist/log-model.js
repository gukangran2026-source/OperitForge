"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseToolLog = parseToolLog;
const log_outcomes_1 = require("./log-outcomes");
const MAX_XML_LENGTH = 16000;
const RICH_CONTENT_TAG = /<(?:file-diff|file_diff|html|img|image|audio|video)\b/i;
const KNOWN_STATUSES = {
    success: 'success',
    error: 'error',
    failed: 'error',
    failure: 'error',
    warning: 'warning',
    cancelled: 'cancelled',
    canceled: 'cancelled'
};
/**
 * Decode one XML entity pass only. Decoding ampersands last on the mapping is
 * deliberate: nested/entity-looking text such as `&amp;lt;` stays literal.
 */
function decodeEntities(text) {
    return text.replace(/&(?:lt|gt|quot|apos|amp);|&#(?:x[0-9a-f]+|[0-9]+);/gi, entity => {
        const amp = String.fromCharCode(38);
        const named = {};
        named[amp + 'lt;'] = '<';
        named[amp + 'gt;'] = '>';
        named[amp + 'quot;'] = String.fromCharCode(34);
        named[amp + 'apos;'] = String.fromCharCode(39);
        named[amp + 'amp;'] = amp;
        const value = named[entity.toLowerCase()];
        if (value !== undefined)
            return value;
        const hexadecimal = /^&#x/i.test(entity);
        const digits = entity.slice(hexadecimal ? 3 : 2, -1);
        const codePoint = parseInt(digits, hexadecimal ? 16 : 10);
        if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10FFFF)
            return entity;
        try {
            return String.fromCodePoint(codePoint);
        }
        catch (_error) {
            return entity;
        }
    });
}
function unwrapCdata(text) {
    return text.split(/(<!\[CDATA\[[\s\S]*?\]\]>)/g).map(part => part.startsWith('<![CDATA[') ? part.slice(9, -3) : decodeEntities(part)).join('');
}
function parseAttributes(source) {
    const attributes = {};
    const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let match;
    while ((match = pattern.exec(source)) !== null) {
        attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? '');
    }
    return attributes;
}
/** Returns a compact model only for completed, ordinary text results. */
function parseToolLog(xml) {
    if (typeof xml !== 'string' || xml.length === 0 || xml.length > MAX_XML_LENGTH)
        return null;
    // Accept nonce-suffixed envelopes without rewriting literal result text.
    const envelope = /^\s*<(tool_result(?:_[A-Za-z0-9]+)?)\b([^>]*)>([\s\S]*)<\/\1>\s*$/i.exec(xml);
    const outer = envelope ? [envelope[0], envelope[2], envelope[3]] : null;
    if (!outer)
        return null;
    const inner = outer[2];
    // Leave media, HTML and diff payloads to the host's specialized renderers.
    if (RICH_CONTENT_TAG.test(inner))
        return null;
    const attrs = parseAttributes(outer[1]);
    const rawStatus = (attrs.status || 'success').trim().toLowerCase();
    let status = Object.prototype.hasOwnProperty.call(KNOWN_STATUSES, rawStatus) ? KNOWN_STATUSES[rawStatus] : undefined;
    if (!status)
        return null;
    const content = /^\s*<content\b[^>]*>([\s\S]*)<\/content>\s*$/i.exec(inner);
    let body = content ? content[1] : inner;
    body = unwrapCdata(body).trim();
    if (RICH_CONTENT_TAG.test(body))
        return null;
    const errorBlock = /^\s*<error\b[^>]*>([\s\S]*)<\/error>\s*$/i.exec(body);
    // Only traverse documented wrapper keys; unrelated payload objects are not status.
    if (status === 'success') {
        if (errorBlock)
            status = 'error';
        else {
            try {
                status = (0, log_outcomes_1.explicitOutcome)(JSON.parse(body));
            }
            catch (_error) {
                status = 'returned';
            }
        }
    }
    // Keep native Markdown/link/media interactions; do not flatten rich results.
    if (/https?:\/\/|content:\/\/|file:\/\/|\[[^\]\n]+\]\([^\n]+\)|```|~~~|<(?:a|details|table|svg|file|attachment)\b/i.test(body))
        return null;
    return { name: attrs.name || 'tool', status, body };
}
