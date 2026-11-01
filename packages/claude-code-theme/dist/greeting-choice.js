"use strict";
/**
 * Picks which greeting to show for a given moment.
 *
 * Structure follows the requirement that both axes matter: the day of week and
 * the time of day each select a slot, giving a 7 x 4 grid. Selection is fully
 * deterministic and needs no model; the only adaptive input is the local habit
 * counter, which can swap in the late-night address once the user's own usage
 * shows that pattern.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.chooseGreeting = chooseGreeting;
exports.gridGreetingIds = gridGreetingIds;
exports.gridGreetingText = gridGreetingText;
const greetings_1 = require("./greetings");
const habits_1 = require("./habits");
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
/**
 * The 7 x 4 grid: for each weekday, which greeting id fills each hour bucket
 * (0 = late night 23-5, 1 = morning 6-11, 2 = afternoon 12-17, 3 = evening 18-22).
 *
 * The weekday's own line takes the morning slot, when someone opening the app is
 * most likely to register "which day is it". The remaining slots use the
 * time-of-day line, so the grid is populated on both axes without inventing
 * text that the source does not contain.
 */
const GRID = {
    mon: ['latenight', 'mon', 'afternoon', 'evening'],
    tue: ['latenight', 'tue', 'afternoon', 'evening'],
    wed: ['latenight', 'wed', 'afternoon', 'evening'],
    thu: ['latenight', 'thu', 'afternoon', 'evening'],
    fri: ['latenight', 'fri', 'afternoon', 'evening'],
    sat: ['latenight', 'sat', 'afternoon', 'evening'],
    sun: ['latenight', 'sun', 'afternoon', 'evening'],
};
/** Weekday key, mon-first, matching the grid keys. */
function dayKey(date) {
    const jsToGrid = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const key = jsToGrid[date.getDay()];
    return WEEKDAYS.indexOf(key) >= 0 ? key : 'mon';
}
/** Looks up text for an id in the static pool. */
function textOf(id) {
    const found = greetings_1.ALL_GREETINGS.find((entry) => entry.id === id);
    return found ? found.text : greetings_1.TIME_GREETINGS[0].text;
}
/**
 * Resolves the greeting for a moment.
 *
 * Order:
 *   1. Late-night window plus a confirmed night-owl habit -> night-owl address.
 *   2. Otherwise the grid cell for (weekday, hour bucket).
 *
 * @param storage shared-preferences handle used to read the habit summary
 */
function chooseGreeting(storage, now) {
    const day = dayKey(now);
    const bucket = (0, greetings_1.hourBucketOf)(now.getHours());
    if (bucket === 0) {
        const habit = (0, habits_1.peekHabit)(storage);
        if (habit.nightOwl) {
            return { id: 'night-owl', text: '你好，夜猫子', day, bucket, byHabit: true };
        }
    }
    const row = GRID[day] || GRID.mon;
    const id = row[bucket];
    return { id, text: textOf(id), day, bucket, byHabit: false };
}
/** Every distinct greeting id the grid can produce, for art generation. */
function gridGreetingIds() {
    const seen = {};
    const out = [];
    for (const day of WEEKDAYS) {
        for (const id of GRID[day]) {
            if (seen[id])
                continue;
            seen[id] = true;
            out.push(id);
        }
    }
    // The night-owl address is reachable through the habit path, so it needs art.
    if (!seen['night-owl'])
        out.push('night-owl');
    return out;
}
/**
 * Text for an id, including the habit-only one.
 *
 * Kept here rather than in greetings.ts because the night-owl line is reachable
 * only via the habit branch above.
 */
function gridGreetingText(id) {
    if (id === 'night-owl')
        return '你好，夜猫子';
    return textOf(id);
}
