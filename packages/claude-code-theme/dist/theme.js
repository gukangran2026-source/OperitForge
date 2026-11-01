"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_OPTIONS = exports.PALETTE = exports.SEMANTIC_COLORS = exports.PALETTES = exports.PACKAGE_ID = exports.VERSION = void 0;
exports.systemIsDark = systemIsDark;
exports.detectedVariant = detectedVariant;
exports.globalPalette = globalPalette;
exports.onGlobalPaletteLifecycle = onGlobalPaletteLifecycle;
exports.status = status;
exports.applyTheme = applyTheme;
exports.applyThemeToAll = applyThemeToAll;
exports.switchEmptyStateBackground = switchEmptyStateBackground;
exports.restoreTheme = restoreTheme;
exports.restoreAllTheme = restoreAllTheme;
exports.updateOptions = updateOptions;
exports.roundTripProbe = roundTripProbe;
const target_state_1 = require("./target-state");
const greeting_choice_1 = require("./greeting-choice");
exports.VERSION = '2.0.0';
exports.PACKAGE_ID = 'local.operit.claude_code_theme';
exports.PALETTES = {
    dark: { background: '#1C1B19', panel: '#262521', text: '#E8E6DC', muted: '#A6A398', accent: '#D97757', border: '#45423B' },
    light: { background: '#FAF9F5', panel: '#F0EEE6', text: '#3D3A32', muted: '#757166', accent: '#B85335', border: '#DDD9CE' }
};
// Inspired semantic palette; these are not published Anthropic preset values.
exports.SEMANTIC_COLORS = {
    dark: { success: '#8BC98B', info: '#8FC7D9', warning: '#D6B56D', error: '#F0A08D' },
    light: { success: '#327548', info: '#357A91', warning: '#9A6A18', error: '#B44232' }
};
exports.PALETTE = exports.PALETTES.dark;
/**
 * SharedPreferences file for this plugin.
 *
 * Keyed by a fixed name rather than the package id so that renaming the id
 * (required before publishing to the marketplace) keeps user settings intact.
 */
const PREFS = 'claude_code_theme_v1';
/**
 * Mirror of resources/ on external storage, kept in sync by build.py.
 * Hook callbacks cannot resolve toolpkg resources, so background switching
 * reads these files directly.
 */
const RESOURCE_DIR = '/sdcard/Download/Operit/plugins/' + exports.PACKAGE_ID + '/resources';
/**
 * Every pre-rendered empty-chat image that has to exist on disk before the
 * empty-state background can be switched from a hook.
 *
 * The art ships inside the toolpkg, but manifest resources are only extracted
 * on demand by ToolPkg.readResource, and hooks have no runtime target to call
 * it. So the first call that does have a target (theme screen / apply) expands
 * the whole set once and records the resulting absolute paths here. Hooks then
 * read the recorded path, with the legacy external mirror as a fallback.
 */
const ART_STEMS = [
    'afternoon', 'back-at-it', 'evening', 'fri', 'how-can-i-help', 'iam-claude',
    'latenight', 'mon', 'morning', 'night-owl', 'sat', 'sun', 'thu', 'tue',
    'wed', 'welcome-back', 'welcome-claude'
];
const PREF_ART_PREFIX = 'art:';
function assetNames() {
    const names = ['mark-light.png', 'mark-dark.png'];
    for (const stem of ART_STEMS) {
        for (const variant of ['light', 'dark']) {
            names.push(stem + '-' + variant + '.png');
            names.push('text-' + stem + '-' + variant + '.png');
        }
    }
    return names;
}
function artResourceKey(name) {
    return 'art_' + name.replace('.png', '').replace(/-/g, '_');
}
function fileExists(path) {
    if (!path)
        return false;
    try {
        return Java.type('java.io.File').newInstance(path).isFile();
    }
    catch (error) {
        return false;
    }
}
function artPathFor(storage, name) {
    const cached = String(storage.getString(PREF_ART_PREFIX + name, ''));
    if (fileExists(cached))
        return cached;
    const mirrored = RESOURCE_DIR + '/empty3/' + name;
    if (fileExists(mirrored))
        return mirrored;
    return '';
}
/** Expands any missing art once. Safe to call repeatedly; already-present files are skipped. */
async function ensureArtAssets(storage) {
    const names = assetNames();
    const failed = [];
    let fetched = 0;
    for (const name of names) {
        const cached = String(storage.getString(PREF_ART_PREFIX + name, ''));
        if (fileExists(cached))
            continue;
        try {
            const path = await ToolPkg.readResource(artResourceKey(name), name, true);
            const resolved = String(path);
            if (!resolved)
                throw new Error('返回路径为空');
            storage.edit().putString(PREF_ART_PREFIX + name, resolved).apply();
            fetched += 1;
        }
        catch (error) {
            failed.push(name + ': ' + String(error));
        }
    }
    return { total: names.length, fetched, failed };
}
function assetStatus(storage) {
    const names = assetNames();
    let ready = 0;
    for (const name of names) {
        if (artPathFor(storage, name))
            ready += 1;
    }
    return { total: names.length, ready, missing: names.length - ready };
}
const OPT_AUTO_VARIANT = 'opt:auto_variant';
const OPT_TRANSPARENT_INPUT = 'opt:transparent_input';
const OPT_LAST_VARIANT = 'opt:last_variant';
const OPT_AUTO_STAMP = 'opt:auto_stamp';
const OPT_EMPTY_ICON = 'opt:empty_icon';
const OPT_EMPTY_SLOGAN = 'opt:empty_slogan';
// Both plugin switches default to on.
exports.DEFAULT_OPTIONS = { autoVariant: true, transparentInput: true, emptyIcon: true, emptySlogan: true };
let running = false;
function argb(hex) { return (parseInt(hex.replace('#', ''), 16) | 0xFF000000) >> 0; }
function toNumber(value) {
    if (typeof value === 'number')
        return value;
    return Number(String(value));
}
function serialize(v) { return JSON.parse(JSON.stringify({ strings: v.getStrings(), booleans: v.getBooleans(), ints: v.getInts(), floats: v.getFloats() })); }
function readFlag(storage, key, fallback) {
    const raw = String(storage.getString(key, ''));
    if (raw === 'on')
        return true;
    if (raw === 'off')
        return false;
    return fallback;
}
function readOptions(storage) {
    // The previous single "empty state" switch is honoured on upgrade so that an
    // existing user who turned it off does not silently get art back.
    const legacy = storage.getString('opt:empty_state_test', '');
    const iconFallback = legacy === 'on' ? true : legacy === 'off' ? false : exports.DEFAULT_OPTIONS.emptyIcon;
    return {
        autoVariant: readFlag(storage, OPT_AUTO_VARIANT, exports.DEFAULT_OPTIONS.autoVariant),
        transparentInput: readFlag(storage, OPT_TRANSPARENT_INPUT, exports.DEFAULT_OPTIONS.transparentInput),
        emptyIcon: readFlag(storage, OPT_EMPTY_ICON, iconFallback),
        emptySlogan: readFlag(storage, OPT_EMPTY_SLOGAN, iconFallback),
    };
}
function storeOptions(storage, options) {
    const ok = storage.edit().putString(OPT_AUTO_VARIANT, options.autoVariant ? 'on' : 'off').putString(OPT_TRANSPARENT_INPUT, options.transparentInput ? 'on' : 'off').putString(OPT_EMPTY_ICON, options.emptyIcon ? 'on' : 'off').putString(OPT_EMPTY_SLOGAN, options.emptySlogan ? 'on' : 'off').commit();
    if (!ok)
        throw new Error('保存主题设置失败，操作已停止。');
}
// Host dark state at OS level; the same source Operit uses for its own system-following theme.
function systemIsDark() {
    const app = Java.getApplicationContext();
    const configuration = app.getResources().getConfiguration();
    const uiMode = toNumber(configuration.uiMode);
    return (uiMode & 0x30) === 0x20;
}
function detectedVariant() { return systemIsDark() ? 'dark' : 'light'; }
/**
 * Resolves a bundled resource to a real file path.
 *
 * Hook callbacks have no toolpkg runtime target, so `readResource` throws
 * "package/toolpkg runtime target is empty" there. To keep the empty-state
 * switch usable from hooks, the same files are mirrored to a fixed external
 * directory by build.py and preferred when present.
 */
function staticPath(key) {
    const names = {
        empty_light: 'empty-light.png',
        empty_dark: 'empty-dark.png',
        background_light: 'background-light.png',
        background: 'background.png',
    };
    const name = names[key];
    return name ? RESOURCE_DIR + '/' + name : '';
}
async function resourcePath(key, fallbackName) {
    const direct = staticPath(key);
    if (direct) {
        try {
            if (Java.type('java.io.File').newInstance(direct).isFile())
                return direct;
        }
        catch (error) {
            // ignore, fall through to readResource
        }
    }
    return await ToolPkg.readResource(key, fallbackName, true);
}
/**
 * Path of the empty-state art for the current greeting and variant.
 *
 * The greeting id doubles as the filename stem, so art stays a fixed set of
 * names and the runtime never has to encode text into a path.
 *
 * Four combinations share the same background, so the art is pre-rendered per
 * combination rather than composited at runtime: `mark` (icon only), `text-*`
 * (slogan only), `<id>` (both) and none at all (plain background).
 */
function emptyArtName(variant, options, storage) {
    const choice = (0, greeting_choice_1.chooseGreeting)(storage, new Date());
    if (!options.emptySlogan)
        return 'mark-' + variant + '.png';
    if (!options.emptyIcon)
        return 'text-' + choice.id + '-' + variant + '.png';
    return choice.id + '-' + variant + '.png';
}
function emptyStatePath(variant, options) {
    if (!options.emptyIcon && !options.emptySlogan)
        return null;
    const app = Java.getApplicationContext();
    const storage = app.getSharedPreferences(PREFS, 0);
    return artPathFor(storage, emptyArtName(variant, options, storage));
}
async function normalBackground(variant) {
    return variant === 'light'
        ? await resourcePath('background_light', 'claude-code-background-light.png')
        : await resourcePath('background', 'claude-code-background.png');
}
async function backgroundResource(variant, options, emptyState) {
    if (emptyState) {
        const art = emptyStatePath(variant, options);
        if (art)
            return art;
        if (art !== null)
            throw new Error('星芒图缺失，请打开主题页重新生成资源后重试。');
    }
    return await normalBackground(variant);
}
async function scope() {
    const app = Java.type('android.app.ActivityThread').currentApplication();
    const version = app.getPackageManager().getPackageInfo(app.getPackageName(), 0).versionName;
    // Uses version-pinned internal Kotlin APIs. Refuse unknown host versions before writes.
    if (version !== '1.12.2')
        throw new Error('此插件已验证 Operit 1.12.2；当前为 ' + version + '。请适配后再应用。');
    const manager = Java.type('com.ai.assistance.operit.data.preferences.ActivePromptManager').Companion.getInstance(app);
    const prefs = Java.type('com.ai.assistance.operit.data.preferences.UserPreferencesManager').Companion.getInstance(app);
    const target = await manager.callSuspend('getActivePrompt');
    const id = target.getId();
    const group = target.className.indexOf('CharacterGroup') >= 0;
    const snap = await prefs.callSuspend('resolveThemePreferenceSnapshot', group ? null : id, group ? id : null);
    return { app, manager, prefs, target, id, group, key: (group ? 'group:' : 'card:') + id, values: snap.getValues(), storage: app.getSharedPreferences(PREFS, 0) };
}
function save(s, key, value) {
    if (!s.storage.edit().putString(key, value).commit())
        throw new Error('保存主题备份失败，操作已停止。');
}
function rebuild(data) {
    let v = Java.type('com.ai.assistance.operit.data.preferences.ThemePreferenceValues').Companion.defaultVisual();
    for (const key of Object.keys(data.strings))
        v = v.withString(key, data.strings[key]);
    for (const key of Object.keys(data.booleans))
        v = v.withBoolean(key, data.booleans[key]);
    for (const key of Object.keys(data.ints))
        v = v.withInt(key, data.ints[key]);
    for (const key of Object.keys(data.floats))
        v = v.withFloat(key, data.floats[key]);
    return v;
}
function modified(original, backgroundPath, variant, options) {
    const palette = exports.PALETTES[variant];
    const light = variant === 'light';
    let v = original;
    const strings = { theme_mode: variant, background_media_type: 'image', background_image_uri: 'file://' + backgroundPath, chat_style: 'bubble', input_style: 'agent', on_color_mode: light ? 'light' : 'dark', app_bar_content_color_mode: light ? 'dark' : 'light', font_type: 'system', system_font_name: 'monospace', bubble_user_font_type: 'system', bubble_user_system_font_name: 'monospace', bubble_ai_font_type: 'system', bubble_ai_system_font_name: 'monospace' };
    const booleans = { use_system_theme: false, use_custom_font: true, use_custom_colors: true, use_background_image: true, use_background_blur: false, toolbar_transparent: false, navigation_drawer_water_glass: false, navigation_drawer_button_liquid_glass: false, use_custom_navigation_drawer_background_color: true, use_custom_navigation_drawer_accent_color: true, use_custom_app_bar_color: true, use_custom_status_bar_color: true, status_bar_transparent: false, chat_header_transparent: true, chat_header_overlay_mode: false, chat_input_transparent: options.transparentInput, chat_input_floating: false, chat_input_liquid_glass: false, chat_input_water_glass: false, force_app_bar_content_color_enabled: true, bubble_show_avatar: false, bubble_wide_layout_enabled: true, cursor_user_bubble_follow_theme: false, cursor_user_bubble_liquid_glass: false, cursor_user_bubble_water_glass: false, bubble_user_bubble_liquid_glass: false, bubble_user_bubble_water_glass: false, bubble_ai_bubble_liquid_glass: false, bubble_ai_bubble_water_glass: false, bubble_user_use_image: false, bubble_ai_use_image: false, bubble_user_use_custom_font: true, bubble_ai_use_custom_font: true };
    // Operit dark mode lightens primary/secondary by 20%; compensate for orange/cyan.
    const ints = { custom_primary_color: argb(light ? palette.accent : '#D05D2D'), custom_secondary_color: argb(light ? exports.SEMANTIC_COLORS.light.info : '#73B9D0'), custom_navigation_drawer_background_color: argb(palette.background), custom_navigation_drawer_accent_color: argb(palette.accent), custom_app_bar_color: argb(palette.background), custom_status_bar_color: argb(palette.background), bubble_user_bubble_color: argb(palette.panel), cursor_user_bubble_color: argb(palette.panel), bubble_ai_bubble_color: argb(palette.background), bubble_user_text_color: argb(palette.text), bubble_ai_text_color: argb(palette.text), chat_header_history_icon_color: argb(palette.muted), chat_header_pip_icon_color: argb(palette.muted) };
    for (const key of Object.keys(strings))
        v = v.withString(key, strings[key]);
    for (const key of Object.keys(booleans))
        v = v.withBoolean(key, booleans[key]);
    for (const key of Object.keys(ints))
        v = v.withInt(key, ints[key]);
    v = v.withFloat('background_image_opacity', 1);
    return v;
}
async function commit(s, next) {
    // Double commit with a tiny font scale nudge forces the host to re-read the palette.
    await s.manager.callSuspend('commitThemeDraft', s.target, next.withFloat('font_scale', Number(next.float('font_scale')) + 0.0001));
    await s.manager.callSuspend('commitThemeDraft', s.target, next);
}
async function globalPalette(restore = false) {
    const app = Java.getApplicationContext();
    const version = app.getPackageManager().getPackageInfo(app.getPackageName(), 0).versionName;
    if (version !== '1.12.2')
        throw new Error('全局色表仅适配 Operit 1.12.2');
    const path = await ToolPkg.readResource('global_palette_dex', 'global-palette-1.6.0.dex', true);
    Java.loadDex(path);
    const result = Java.type('local.operit.theme.PaletteBridgeV160').callStatic('apply', app, restore);
    return String(result);
}
// Re-applies the palette when the host switched between light and dark while auto mode is on.
async function autoFollow() {
    if (running)
        return null;
    const app = Java.getApplicationContext();
    const store = app.getSharedPreferences(PREFS, 0);
    if (!readOptions(store).autoVariant)
        return null;
    if (store.getString('global:enabled', '') !== 'yes')
        return null;
    const now = Date.now();
    const last = Number(store.getString(OPT_AUTO_STAMP, '0')) || 0;
    if (now - last < 1200)
        return null;
    store.edit().putString(OPT_AUTO_STAMP, String(now)).apply();
    const s = await scope();
    if (s.storage.getString('applied:' + s.key, '') !== 'yes')
        return null;
    const current = s.values.string('theme_mode') === 'light' ? 'light' : 'dark';
    const wanted = detectedVariant();
    if (current === wanted)
        return null;
    await applyTheme(null, wanted);
    console.log('[claude_theme_auto] switched to ' + wanted);
    return wanted;
}
// Host lifecycle replay may run after the first Compose composition.
async function onGlobalPaletteLifecycle() {
    const app = Java.getApplicationContext();
    const store = app.getSharedPreferences(PREFS, 0);
    if (store.getString('global:enabled', '') !== 'yes')
        return;
    try {
        await globalPalette(false);
        const s = await scope();
        const bridge = Java.type('local.operit.theme.PaletteBridgeV160');
        const token = 'v170:' + s.key;
        if (bridge.claimRefresh(token)) {
            let completed = false;
            try {
                if (store.getString('global:enabled', '') !== 'yes')
                    return;
                const oldPrimary = Number(s.values.int('custom_primary_color'));
                const pulsePrimary = oldPrimary ^ 1;
                await s.manager.callSuspend('commitThemeDraft', s.target, s.values.withInt('custom_primary_color', pulsePrimary));
                try {
                    await new Promise(resolve => setTimeout(resolve, 250));
                }
                finally {
                    // Preserve concurrent edits and restore only our temporary accent value.
                    const now = await s.prefs.callSuspend('resolveThemePreferenceSnapshot', s.group ? null : s.id, s.group ? s.id : null);
                    const current = now.getValues();
                    if (Number(current.int('custom_primary_color')) === pulsePrimary) {
                        await s.manager.callSuspend('commitThemeDraft', s.target, current.withInt('custom_primary_color', oldPrimary));
                    }
                }
                completed = true;
                store.edit().putString('startup:last_success', String(Date.now())).putString('startup:last_error', '').apply();
                console.log('[claude_theme_startup] palette and Compose refresh ready');
            }
            finally {
                bridge.finishRefresh(token, completed);
            }
        }
        try {
            const switched = await autoFollow();
            if (switched)
                store.edit().putString('auto:last_switch', switched).apply();
        }
        catch (error) {
            // Auto follow must never break the startup palette refresh.
            store.edit().putString('auto:last_error', String(error)).apply();
            console.error('[claude_theme_auto] ' + String(error));
        }
    }
    catch (error) {
        store.edit().putString('startup:last_error', String(error)).apply();
        console.error('[claude_theme_startup] ' + String(error));
        throw error;
    }
}
function activeThemeTargets(storage) {
    const values = JSON.parse(JSON.stringify(storage.getAll()));
    return (0, target_state_1.activeTargetKeys)(values);
}
function diag(message) {
    try {
        const path = '/sdcard/Download/Operit/dev_package/theme-all.log';
        const FileOutputStream = Java.type('java.io.FileOutputStream');
        const StringClass = Java.type('java.lang.String');
        const fos = new FileOutputStream(path, true);
        fos.write(StringClass.newInstance(message + '\n').getBytes('UTF-8'));
        fos.flush();
        fos.close();
    }
    catch (error) {
        // logging must never break the operation
    }
}
function listToArray(list) {
    const out = [];
    if (!list)
        return out;
    // The bridge may hand back a JS array, a JS array-like wrapper, a Java
    // List or a Kotlin List. Try each shape instead of assuming one.
    try {
        if (Array.isArray(list)) {
            diag('[list] js array len=' + list.length);
            return list.slice();
        }
    }
    catch (error) {
        // ignore
    }
    try {
        const length = Number(list.length);
        if (Number.isFinite(length) && length >= 0 && length < 100000) {
            for (let i = 0; i < length; i += 1)
                out.push(list[i]);
            if (out.length) {
                diag('[list] array-like len=' + length);
                return out;
            }
        }
    }
    catch (error) {
        diag('[list] length failed: ' + String(error));
    }
    try {
        const size = Number(list.size());
        if (Number.isFinite(size) && size >= 0) {
            for (let i = 0; i < size; i += 1)
                out.push(list.get(i));
            diag('[list] java list size=' + size);
            return out;
        }
        diag('[list] size not finite: ' + String(list.size()));
    }
    catch (error) {
        diag('[list] size failed: ' + String(error));
    }
    try {
        const iterator = list.iterator();
        while (iterator.hasNext())
            out.push(iterator.next());
        diag('[list] iterator len=' + out.length);
    }
    catch (error) {
        diag('[list] iterator failed: ' + String(error));
    }
    return out;
}
/**
 * Every character card plus every character group, as ActivePrompt targets.
 *
 * Both managers expose a suspend getAll* function returning a Kotlin List; the
 * elements are the same ActivePrompt instances commitThemeDraft already accepts
 * for the active target, so no activation switch is needed.
 */
async function collectPromptTargets(app) {
    const items = [];
    const problems = [];
    try {
        const CardManager = Java.type('com.ai.assistance.operit.data.preferences.CharacterCardManager');
        const cardManager = CardManager.Companion.getInstance(app);
        diag('[collect] card manager ok');
        const cards = await cardManager.callSuspend('getAllCharacterCards');
        diag('[collect] cards raw=' + String(cards && cards.className) + ' type=' + typeof cards);
        const cardList = listToArray(cards);
        diag('[collect] cards parsed=' + cardList.length);
        for (const card of cardList)
            items.push({ target: card, group: false });
    }
    catch (error) {
        diag('[collect] card manager failed: ' + String(error));
        problems.push('character card list failed: ' + String(error));
    }
    try {
        const GroupManager = Java.type('com.ai.assistance.operit.data.preferences.CharacterGroupCardManager');
        const groupManager = GroupManager.Companion.getInstance(app);
        const groups = await groupManager.callSuspend('getAllCharacterGroupCards');
        diag('[collect] groups raw=' + String(groups && groups.className) + ' type=' + typeof groups);
        const groupList = listToArray(groups);
        diag('[collect] groups parsed=' + groupList.length);
        for (const group of groupList)
            items.push({ target: group, group: true });
    }
    catch (error) {
        diag('[collect] group manager failed: ' + String(error));
        problems.push('character group list failed: ' + String(error));
    }
    diag('[collect] total items=' + items.length);
    return { items, problems };
}
async function status() {
    const s = await scope();
    let assets = assetStatus(s.storage);
    if (assets.missing > 0) {
        // The theme screen always runs with a runtime target, so it can heal a
        // fresh install that never expanded the empty-chat art yet.
        try {
            await ensureArtAssets(s.storage);
            assets = assetStatus(s.storage);
        }
        catch (error) {
            // Keep the counted status; the UI reports how many are still missing.
        }
    }
    const variant = s.values.string('theme_mode') === 'light' ? 'light' : 'dark';
    return { activeTargetCount: activeThemeTargets(s.storage).length, version: exports.VERSION, target: s.group ? '当前角色群组' : '当前角色卡', targetId: s.id, hasBackup: s.storage.contains('backup:' + s.key), applied: s.storage.getString('applied:' + s.key, '') === 'yes', theme: s.values.string('theme_mode'), globalEnabled: s.storage.getString('global:enabled', '') === 'yes', variant, options: readOptions(s.storage), systemDark: systemIsDark(), detected: detectedVariant(), assets };
}
async function applyTheme(backgroundPath = null, variant) {
    if (variant !== undefined && variant !== 'dark' && variant !== 'light')
        throw new Error('未知配色：' + String(variant));
    if (running)
        throw new Error('主题操作正在进行。');
    running = true;
    try {
        const s = await scope();
        const options = readOptions(s.storage);
        // A fresh install has no expanded empty-chat art yet. Expand it here,
        // because this call still has the runtime target readResource needs;
        // hooks run without one and can only read the files afterwards.
        const resolved = variant ?? (options.autoVariant ? detectedVariant() : 'dark');
        const art = await ensureArtAssets(s.storage);
        const path = backgroundPath ?? await backgroundResource(resolved, options, s.storage.getString('empty:active', '') === 'yes');
        const file = Java.type('java.io.File').newInstance(path);
        if (!file.isFile())
            throw new Error('主题背景资源不存在。');
        // Always capture the immediately previous state for this application session; repeated apply retains original.
        if (s.storage.getString('applied:' + s.key, '') !== 'yes')
            save(s, 'backup:' + s.key, JSON.stringify(serialize(s.values)));
        await globalPalette(false);
        save(s, 'global:enabled', 'yes');
        const next = modified(s.values, path, resolved, options);
        await commit(s, next);
        save(s, 'applied:' + s.key, 'yes');
        save(s, OPT_LAST_VARIANT, resolved);
        const check = await s.prefs.callSuspend('resolveThemePreferenceSnapshot', s.group ? null : s.id, s.group ? s.id : null);
        if (check.getValues().string('theme_mode') !== resolved)
            throw new Error('主题写入后读回校验失败。');
        const label = resolved === 'light' ? 'Claude Code 米白主题' : 'Claude Code 暖黑主题';
        const auto = variant === undefined && options.autoVariant;
        const artNote = art.failed.length ? '；星芒图有 ' + art.failed.length + ' 张未就绪' : '';
        return { success: true, version: exports.VERSION, variant: resolved, auto, assets: assetStatus(s.storage), message: label + '已应用' + (auto ? '（自动跟随系统深浅色）' : '') + '；原外观备份已保留' + artNote + '。' };
    }
    finally {
        running = false;
    }
}
function themePrefixOf(s, id, group) {
    try {
        const viaHost = group ? s.prefs.getCharacterGroupThemePrefix(id) : s.prefs.getCharacterCardThemePrefix(id);
        const text = String(viaHost);
        if (text)
            return text;
    }
    catch (error) {
        diag('[prefix] host method failed: ' + String(error));
    }
    return (group ? 'character_group_theme_' : 'character_card_theme_') + id;
}
async function loadBulkBridge() {
    const path = await ToolPkg.readResource('bulk_theme_dex', 'bulk-theme.dex', true);
    Java.loadDex(path);
    return Java.type('local.operit.theme.BulkThemeBridge');
}
async function applyThemeToAll(variant) {
    diag('[apply-all] enter variant=' + String(variant));
    if (variant !== undefined && variant !== 'dark' && variant !== 'light')
        throw new Error('未知配色：' + String(variant));
    if (running)
        throw new Error('主题操作正在进行。');
    running = true;
    try {
        const s = await scope();
        const options = readOptions(s.storage);
        const resolved = variant ?? (options.autoVariant ? detectedVariant() : 'dark');
        const art = await ensureArtAssets(s.storage);
        const path = await normalBackground(resolved);
        const file = Java.type('java.io.File').newInstance(path);
        if (!file.isFile())
            throw new Error('主题背景资源不存在。');
        await globalPalette(false);
        save(s, 'global:enabled', 'yes');
        const bridge = await loadBulkBridge();
        diag('[apply-all] bridge ready');
        const found = await collectPromptTargets(s.app);
        diag('[apply-all] targets=' + found.items.length);
        const failed = found.problems.slice();
        let applied = 0;
        for (const item of found.items) {
            let label = '';
            try {
                const id = String(item.target.getId());
                const key = (item.group ? 'group:' : 'card:') + id;
                label = (item.group ? '群组 ' : '角色 ') + id;
                const snap = await s.prefs.callSuspend('resolveThemePreferenceSnapshot', item.group ? null : id, item.group ? id : null);
                const values = snap.getValues();
                if (s.storage.getString('applied:' + key, '') !== 'yes')
                    save(s, 'backup:' + key, JSON.stringify(serialize(values)));
                const next = modified(values, path, resolved, options);
                const result = String(bridge.callStatic(item.group ? 'commitGroupTheme' : 'commitCardTheme', s.app, id, next));
                if (result !== 'ok')
                    throw new Error(result);
                save(s, 'applied:' + key, 'yes');
                applied += 1;
                diag('[apply-all] ' + key + ' ok');
            }
            catch (error) {
                diag('[apply-all] ' + (label || 'unknown') + ' failed: ' + String(error));
                failed.push((label || '未命名目标') + '：' + String(error));
            }
        }
        save(s, OPT_LAST_VARIANT, resolved);
        const name = resolved === 'light' ? '米白' : '暖黑';
        let message = '已把' + name + '主题应用到 ' + applied + ' 个角色';
        if (failed.length)
            message += '；' + failed.length + ' 项失败：' + failed.slice(0, 3).join(' / ');
        if (art.failed.length)
            message += '；星芒图有 ' + art.failed.length + ' 张未就绪';
        diag('[apply-all] done applied=' + applied + ' failed=' + failed.length);
        return { success: failed.length === 0, version: exports.VERSION, variant: resolved, applied, failed, message };
    }
    finally {
        running = false;
    }
}

/**
 * Switches only the background image, keeping palette/options untouched.
 *
 * Used by the empty-chat hook: an empty conversation shows the icon+greeting
 * art, and the first message swaps it back to the normal background.
 *
 * @param emptyState true to show the empty-state art, false for the normal one
 */
async function switchEmptyStateBackground(emptyState) {
    if (running)
        return { success: false, reason: 'busy' };
    running = true;
    const app = Java.getApplicationContext();
    const storage = app.getSharedPreferences(PREFS, 0);
    try {
        const s = await scope();
        // Only touch targets that actually carry this theme.
        if (s.storage.getString('applied:' + s.key, '') !== 'yes') {
            return { success: false, reason: 'not-applied' };
        }
        const options = readOptions(s.storage);
        const resolved = s.values.string('theme_mode') === 'light' ? 'light' : 'dark';
        const path = await backgroundResource(resolved, options, emptyState);
        const file = Java.type('java.io.File').newInstance(path);
        if (!file.isFile())
            throw new Error('空状态背景资源不存在。');
        // Single commit: only the background URI changes, so the host does not have
        // to rebuild typography the way the double-commit applyTheme() does.
        await s.manager.callSuspend('commitThemeDraft', s.target, s.values.withString('background_image_uri', 'file://' + path));
        storage.edit().putString('empty:active', emptyState ? 'yes' : 'no').apply();
        return { success: true, emptyState };
    }
    catch (error) {
        return { success: false, reason: String(error) };
    }
    finally {
        running = false;
    }
}
async function restoreAllTheme() {
    diag('[restore-all] enter');
    if (running)
        throw new Error('主题操作正在进行。');
    running = true;
    try {
        const s = await scope();
        const active = activeThemeTargets(s.storage);
        if (!active.length)
            throw new Error('没有已应用主题的角色。');
        const bridge = await loadBulkBridge();
        const found = await collectPromptTargets(s.app);
        diag('[restore-all] targets=' + found.items.length);
        const failed = found.problems.slice();
        let restored = 0;
        let missing = 0;
        for (const item of found.items) {
            let label = '';
            try {
                const id = String(item.target.getId());
                const key = (item.group ? 'group:' : 'card:') + id;
                label = (item.group ? '群组 ' : '角色 ') + id;
                if (s.storage.getString('applied:' + key, '') !== 'yes') {
                    missing += 1;
                    continue;
                }
                const raw = s.storage.getString('backup:' + key, '');
                if (!raw)
                    throw new Error('缺少原外观备份');
                const data = JSON.parse(raw);
                const snap = await s.prefs.callSuspend('resolveThemePreferenceSnapshot', item.group ? null : id, item.group ? id : null);
                const current = serialize(snap.getValues());
                for (const field of ['custom_chat_title', 'custom_ai_avatar_uri', 'custom_user_avatar_uri']) {
                    if (current.strings[field] === undefined)
                        delete data.strings[field];
                    else
                        data.strings[field] = current.strings[field];
                }
                const result = String(bridge.callStatic(item.group ? 'commitGroupTheme' : 'commitCardTheme', s.app, id, rebuild(data)));
                if (result !== 'ok')
                    throw new Error(result);
                save(s, 'applied:' + key, 'no');
                restored += 1;
                diag('[restore-all] ' + key + ' ok');
            }
            catch (error) {
                diag('[restore-all] ' + (label || 'unknown') + ' failed: ' + String(error));
                failed.push((label || '未命名目标') + '：' + String(error));
            }
        }
        const present = {};
        for (const item of found.items) {
            try {
                present[(item.group ? 'group:' : 'card:') + String(item.target.getId())] = true;
            }
            catch (error) {
                // ignore
            }
        }
        for (const appliedKey of activeThemeTargets(s.storage)) {
            const shortKey = appliedKey.replace('applied:', '');
            if (!present[shortKey])
                save(s, 'applied:' + shortKey, 'no');
        }
        const remaining = activeThemeTargets(s.storage).length;
        if (remaining === 0) {
            await globalPalette(true);
            save(s, 'global:enabled', 'no');
        }
        let message = '已恢复 ' + restored + ' 个角色的原外观';
        if (missing)
            message += '；' + missing + ' 个角色本来未应用主题';
        if (failed.length)
            message += '；' + failed.length + ' 项失败：' + failed.slice(0, 3).join(' / ');
        if (remaining)
            message += '；仍有 ' + remaining + ' 个角色保留主题';
        diag('[restore-all] done restored=' + restored + ' missing=' + missing + ' failed=' + failed.length);
        return { success: failed.length === 0, version: exports.VERSION, restored, missing, failed, remaining, message };
    }
    finally {
        running = false;
    }
}

async function restoreTheme() {
    if (running)
        throw new Error('主题操作正在进行。');
    running = true;
    try {
        const s = await scope();
        const raw = s.storage.getString('backup:' + s.key, '');
        if (!raw)
            throw new Error('当前角色尚无备份，请先应用主题。');
        const data = JSON.parse(raw);
        // Preserve current identity fields if the user changed them since applying this palette.
        const current = serialize(s.values);
        for (const key of ['custom_chat_title', 'custom_ai_avatar_uri', 'custom_user_avatar_uri']) {
            if (current.strings[key] === undefined)
                delete data.strings[key];
            else
                data.strings[key] = current.strings[key];
        }
        const allTargets = JSON.parse(JSON.stringify(s.storage.getAll()));
        const keepGlobal = (0, target_state_1.keepGlobalOnRestore)(allTargets, s.key);
        await globalPalette(!keepGlobal);
        await s.manager.callSuspend('commitThemeDraft', s.target, rebuild(data));
        save(s, 'applied:' + s.key, 'no');
        save(s, 'global:enabled', keepGlobal ? 'yes' : 'no');
        return { success: true, version: exports.VERSION, message: keepGlobal ? '已恢复当前角色；其他角色仍在使用主题，全局配色保持启用。' : '已恢复当前角色，并关闭全局配色与日志接管。' };
    }
    finally {
        running = false;
    }
}
// Persists the plugin switches; when this target already carries the theme, apply immediately.
async function updateOptions(patch) {
    const app = Java.getApplicationContext();
    const storage = app.getSharedPreferences(PREFS, 0);
    const next = { ...readOptions(storage), ...patch };
    storeOptions(storage, next);
    const head = patch.autoVariant !== undefined
        ? (next.autoVariant ? '已开启自动跟随系统深浅色' : '已关闭自动跟随，改为手动配色')
        : patch.transparentInput !== undefined
            ? (next.transparentInput ? '已开启透明输入框' : '已关闭透明输入框')
            : patch.emptyIcon !== undefined
                ? (next.emptyIcon ? '已开启星芒图标' : '已关闭星芒图标')
                : (next.emptySlogan ? '已开启标语' : '已关闭标语');
    let tail = '';
    let variant = null;
    try {
        const s = await scope();
        if (s.storage.getString('applied:' + s.key, '') === 'yes') {
            const current = s.values.string('theme_mode') === 'light' ? 'light' : 'dark';
            const wanted = next.autoVariant ? detectedVariant() : current;
            variant = wanted;
            await applyTheme(null, wanted);
            tail = '，已按新设置重新应用' + (wanted === 'light' ? '米白' : '暖黑');
        }
    }
    catch (error) {
        tail = '，但立即刷新失败：' + String(error);
    }
    return { success: true, version: exports.VERSION, options: next, variant, message: head + tail };
}
async function roundTripProbe() {
    const s = await scope();
    const data = serialize(s.values);
    const rebuilt = serialize(rebuild(data));
    return { success: JSON.stringify(data) === JSON.stringify(rebuilt), original: data, rebuilt };
}
// Diagnostic probe removed: the overlay dex and Probe class no longer exist,
// this would throw on the missing probe_dex resource.
