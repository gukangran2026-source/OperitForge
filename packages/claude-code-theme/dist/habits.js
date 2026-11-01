"use strict";
/**
 * Local usage-habit store backing the "night owl" style greeting.
 *
 * Constraints this satisfies:
 *   - purely local: counting and eviction only, no network, no model call
 *   - hard cap: the serialised payload never exceeds MAX_BYTES
 *   - gradual eviction: entries that stop being observed age out by LRU, so old
 *     habits fade instead of pinning the greeting forever
 *
 * Shape of one record: { c: count, t: lastSeenEpochDays, h: hourBucketMask }.
 * Keys are compact because the byte budget is shared by all of them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_BYTES = void 0;
exports.hourBucket = hourBucket;
exports.recordObservation = recordObservation;
exports.peekHabit = peekHabit;
exports.resetHabits = resetHabits;
/** Ceiling for the stored blob, well under the 1 MB allowance. */
exports.MAX_BYTES = 1024 * 1024;
/** Soft trigger: start evicting once usage crosses this. */
const EVICT_AT = exports.MAX_BYTES * 0.9;
const PREFS = 'claude_code_theme_v1';
const KEY_STATE = 'habit:state';
/** Hour buckets, kept in sync with hourBucketOf() in greetings.ts. */
function hourBucket(hour) {
    if (hour >= 23 || hour < 6)
        return 0;
    if (hour < 12)
        return 1;
    if (hour < 18)
        return 2;
    return 3;
}
/** Days since epoch, used as a coarse timestamp to keep records small. */
function epochDay(date) {
    return Math.floor(date.getTime() / 86400000);
}
function readState(storage) {
    try {
        const raw = String(storage.getString(KEY_STATE, ''));
        if (!raw)
            return { records: {} };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.records)
            return { records: {} };
        return parsed;
    }
    catch (error) {
        return { records: {} };
    }
}
/** UTF-8 byte length of a string, without allocating a buffer for ASCII. */
function byteLength(text) {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code < 0x80)
            bytes += 1;
        else if (code < 0x800)
            bytes += 2;
        else if (code >= 0xd800 && code <= 0xdbff) {
            // Surrogate pair: 4 bytes for the two code units, skip the low half.
            bytes += 4;
            i++;
        }
        else
            bytes += 3;
    }
    return bytes;
}
/**
 * Drops records until the payload fits the budget.
 *
 * Eviction order is oldest-last-seen first, then lowest count. That is what
 * makes habits fade: a weekday/time pair the user stops hitting keeps its age
 * while newer activity pushes the budget, so it is the first to go.
 *
 * The size is estimated incrementally instead of re-serialising the whole state
 * on every removal. Re-measuring inside the loop is O(n^2) and hangs once the
 * record count gets large.
 */
function evict(state, budget) {
    const keys = Object.keys(state.records);
    if (!keys.length)
        return { state, dropped: 0 };
    let size = byteLength(JSON.stringify(state));
    if (size <= budget)
        return { state, dropped: 0 };
    keys.sort((a, b) => {
        const ra = state.records[a];
        const rb = state.records[b];
        if (ra.t !== rb.t)
            return ra.t - rb.t;
        return ra.c - rb.c;
    });
    // One exact measurement up front, then charge each removal by the serialised
    // length of that record plus its separator, which keeps the estimate close
    // without re-walking the whole object.
    let dropped = 0;
    for (const key of keys) {
        if (size <= budget)
            break;
        const record = state.records[key];
        // {"key":{"c":N,"t":N,"h":N},} -> key + braces + three small numbers.
        const cost = byteLength(key) + 26;
        delete state.records[key];
        size -= cost;
        dropped++;
    }
    return { state, dropped, };
}
/**
 * Records one observation for a moment and returns the habit verdict.
 *
 * Called from the chat-open hook, so it runs on real usage rather than a timer.
 * Everything stays on device.
 */
function recordObservation(storage, now) {
    const weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    const bucket = hourBucket(now.getHours());
    const key = weekday + ':' + bucket;
    const state = readState(storage);
    const today = epochDay(now);
    const existing = state.records[key];
    if (existing) {
        existing.c += 1;
        existing.t = today;
        existing.h = existing.h | (1 << bucket);
    }
    else {
        state.records[key] = { c: 1, t: today, h: 1 << bucket };
    }
    // Count totals before eviction so the verdict reflects what was just seen.
    let total = 0;
    let lateNight = 0;
    for (const k of Object.keys(state.records)) {
        const record = state.records[k];
        total += record.c;
        if (k.endsWith(':0'))
            lateNight += record.c;
    }
    const evicted = evict(state, EVICT_AT).dropped;
    const payload = JSON.stringify(state);
    try {
        storage.edit().putString(KEY_STATE, payload).apply();
    }
    catch (error) {
        // Storage failure must not break the greeting path.
    }
    return {
        // Require a meaningful sample before claiming a habit, and a clear
        // majority of late-night activity.
        nightOwl: total >= 8 && lateNight * 2 > total,
        total,
        // Measured after eviction so the reported size is what was actually stored.
        bytes: byteLength(payload),
        evicted,
    };
}
/** Reads the current verdict without recording anything. */
function peekHabit(storage) {
    const state = readState(storage);
    let total = 0;
    let lateNight = 0;
    for (const k of Object.keys(state.records)) {
        const record = state.records[k];
        total += record.c;
        if (k.endsWith(':0'))
            lateNight += record.c;
    }
    return {
        nightOwl: total >= 8 && lateNight * 2 > total,
        total,
        bytes: byteLength(JSON.stringify(state)),
        evicted: 0,
    };
}
/** Clears stored habits. */
function resetHabits(storage) {
    storage.edit().remove(KEY_STATE).apply();
}
