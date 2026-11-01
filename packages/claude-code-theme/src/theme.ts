import { activeTargetKeys, keepGlobalOnRestore } from './target-state';
import type { JavaBridgeInstance } from '../../types/java-bridge';
import { chooseGreeting } from './greeting-choice';
import { recordObservation } from './habits';

export const VERSION = '1.8.0';
export const PACKAGE_ID = 'local.operit.claude_code_theme';
export type ThemeVariant = 'dark' | 'light';
export const PALETTES = {
  dark: { background: '#1C1B19', panel: '#262521', text: '#E8E6DC', muted: '#A6A398', accent: '#D97757', border: '#45423B' },
  light: { background: '#FAF9F5', panel: '#F0EEE6', text: '#3D3A32', muted: '#757166', accent: '#B85335', border: '#DDD9CE' }
};
// Inspired semantic palette; these are not published Anthropic preset values.
export const SEMANTIC_COLORS = {
  dark: { success: '#8BC98B', info: '#8FC7D9', warning: '#D6B56D', error: '#F0A08D' },
  light: { success: '#327548', info: '#357A91', warning: '#9A6A18', error: '#B44232' }
};
export const PALETTE = PALETTES.dark;
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
const RESOURCE_DIR = '/sdcard/Download/Operit/plugins/' + PACKAGE_ID + '/resources';
const OPT_AUTO_VARIANT = 'opt:auto_variant';
const OPT_TRANSPARENT_INPUT = 'opt:transparent_input';
const OPT_LAST_VARIANT = 'opt:last_variant';
const OPT_AUTO_STAMP = 'opt:auto_stamp';
const OPT_EMPTY_ICON = 'opt:empty_icon';
const OPT_EMPTY_SLOGAN = 'opt:empty_slogan';
export type ThemeOptions = { autoVariant: boolean; transparentInput: boolean; emptyIcon: boolean; emptySlogan: boolean };
// Both plugin switches default to on.
export const DEFAULT_OPTIONS: ThemeOptions = { autoVariant: true, transparentInput: true, emptyIcon: true, emptySlogan: true };
type Values = { strings: Record<string, string>; booleans: Record<string, boolean>; ints: Record<string, number>; floats: Record<string, number> };
type Scope = { app: JavaBridgeInstance; manager: JavaBridgeInstance; prefs: JavaBridgeInstance; target: JavaBridgeInstance; id: string; group: boolean; key: string; values: JavaBridgeInstance; storage: JavaBridgeInstance };
let running = false;
function argb(hex: string): number { return (parseInt(hex.replace('#', ''), 16) | 0xFF000000) >> 0; }
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  return Number(String(value));
}
function serialize(v: JavaBridgeInstance): Values { return JSON.parse(JSON.stringify({ strings: v.getStrings(), booleans: v.getBooleans(), ints: v.getInts(), floats: v.getFloats() })); }
function readFlag(storage: JavaBridgeInstance, key: string, fallback: boolean): boolean {
  const raw = String(storage.getString(key, ''));
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  return fallback;
}
function readOptions(storage: JavaBridgeInstance): ThemeOptions {
  // The previous single "empty state" switch is honoured on upgrade so that an
  // existing user who turned it off does not silently get art back.
  const legacy = storage.getString('opt:empty_state_test', '');
  const iconFallback = legacy === 'on' ? true : legacy === 'off' ? false : DEFAULT_OPTIONS.emptyIcon;
  return {
    autoVariant: readFlag(storage, OPT_AUTO_VARIANT, DEFAULT_OPTIONS.autoVariant),
    transparentInput: readFlag(storage, OPT_TRANSPARENT_INPUT, DEFAULT_OPTIONS.transparentInput),
    emptyIcon: readFlag(storage, OPT_EMPTY_ICON, iconFallback),
    emptySlogan: readFlag(storage, OPT_EMPTY_SLOGAN, iconFallback),
  };
}
function storeOptions(storage: JavaBridgeInstance, options: ThemeOptions): void {
  const ok = storage.edit().putString(OPT_AUTO_VARIANT, options.autoVariant ? 'on' : 'off').putString(OPT_TRANSPARENT_INPUT, options.transparentInput ? 'on' : 'off').putString(OPT_EMPTY_ICON, options.emptyIcon ? 'on' : 'off').putString(OPT_EMPTY_SLOGAN, options.emptySlogan ? 'on' : 'off').commit();
  if (!ok) throw new Error('保存主题设置失败，操作已停止。');
}
// Host dark state at OS level; the same source Operit uses for its own system-following theme.
export function systemIsDark(): boolean {
  const app = Java.getApplicationContext();
  const configuration = app.getResources().getConfiguration();
  const uiMode = toNumber(configuration.uiMode);
  return (uiMode & 0x30) === 0x20;
}
export function detectedVariant(): ThemeVariant { return systemIsDark() ? 'dark' : 'light'; }
/**
 * Resolves a bundled resource to a real file path.
 *
 * Hook callbacks have no toolpkg runtime target, so `readResource` throws
 * "package/toolpkg runtime target is empty" there. To keep the empty-state
 * switch usable from hooks, the same files are mirrored to a fixed external
 * directory by build.py and preferred when present.
 */
function staticPath(key: string): string {
  const names: Record<string, string> = {
    empty_light: 'empty-light.png',
    empty_dark: 'empty-dark.png',
    background_light: 'background-light.png',
    background: 'background.png',
  };
  const name = names[key];
  return name ? RESOURCE_DIR + '/' + name : '';
}

async function resourcePath(key: string, fallbackName: string): Promise<string> {
  const direct = staticPath(key);
  if (direct) {
    try {
      if (Java.type('java.io.File').newInstance(direct).isFile()) return direct;
    } catch (error) {
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
function emptyStatePath(variant: ThemeVariant, options: ThemeOptions): string | null {
  if (!options.emptyIcon && !options.emptySlogan) return null;
  const app = Java.getApplicationContext();
  const storage = app.getSharedPreferences(PREFS, 0);
  const choice = chooseGreeting(storage, new Date());
  if (!options.emptySlogan) return RESOURCE_DIR + '/empty3/mark-' + variant + '.png';
  if (!options.emptyIcon) return RESOURCE_DIR + '/empty3/text-' + choice.id + '-' + variant + '.png';
  return RESOURCE_DIR + '/empty3/' + choice.id + '-' + variant + '.png';
}

async function backgroundResource(variant: ThemeVariant, options: ThemeOptions, emptyState: boolean): Promise<string> {
  if (emptyState) {
    const art = emptyStatePath(variant, options);
    if (art) return art;
  }
  return variant === 'light'
    ? await resourcePath('background_light', 'claude-code-background-light.png')
    : await resourcePath('background', 'claude-code-background.png');
}
async function scope(): Promise<Scope> {
  const app = Java.type('android.app.ActivityThread').currentApplication();
  const version = app.getPackageManager().getPackageInfo(app.getPackageName(), 0).versionName;
  // Uses version-pinned internal Kotlin APIs. Refuse unknown host versions before writes.
  if (version !== '1.12.2') throw new Error('此插件已验证 Operit 1.12.2；当前为 ' + version + '。请适配后再应用。');
  const manager = Java.type('com.ai.assistance.operit.data.preferences.ActivePromptManager').Companion.getInstance(app);
  const prefs = Java.type('com.ai.assistance.operit.data.preferences.UserPreferencesManager').Companion.getInstance(app);
  const target = await manager.callSuspend('getActivePrompt') as JavaBridgeInstance;
  const id = target.getId() as string;
  const group = target.className.indexOf('CharacterGroup') >= 0;
  const snap = await prefs.callSuspend('resolveThemePreferenceSnapshot', group ? null : id, group ? id : null) as JavaBridgeInstance;
  return { app, manager, prefs, target, id, group, key: (group ? 'group:' : 'card:') + id, values: snap.getValues(), storage: app.getSharedPreferences(PREFS, 0) };
}
function save(s: Scope, key: string, value: string): void {
  if (!s.storage.edit().putString(key, value).commit()) throw new Error('保存主题备份失败，操作已停止。');
}
function rebuild(data: Values): JavaBridgeInstance {
  let v = Java.type('com.ai.assistance.operit.data.preferences.ThemePreferenceValues').Companion.defaultVisual();
  for (const key of Object.keys(data.strings)) v = v.withString(key, data.strings[key]);
  for (const key of Object.keys(data.booleans)) v = v.withBoolean(key, data.booleans[key]);
  for (const key of Object.keys(data.ints)) v = v.withInt(key, data.ints[key]);
  for (const key of Object.keys(data.floats)) v = v.withFloat(key, data.floats[key]);
  return v;
}
function modified(original: JavaBridgeInstance, backgroundPath: string, variant: ThemeVariant, options: ThemeOptions): JavaBridgeInstance {
  const palette = PALETTES[variant];
  const light = variant === 'light';
  let v = original;
  const strings: Record<string, string> = { theme_mode: variant, background_media_type: 'image', background_image_uri: 'file://' + backgroundPath, chat_style: 'bubble', input_style: 'agent', on_color_mode: light ? 'light' : 'dark', app_bar_content_color_mode: light ? 'dark' : 'light', font_type: 'system', system_font_name: 'monospace', bubble_user_font_type: 'system', bubble_user_system_font_name: 'monospace', bubble_ai_font_type: 'system', bubble_ai_system_font_name: 'monospace' };
  const booleans: Record<string, boolean> = { use_system_theme: false, use_custom_font: true, use_custom_colors: true, use_background_image: true, use_background_blur: false, toolbar_transparent: false, navigation_drawer_water_glass: false, navigation_drawer_button_liquid_glass: false, use_custom_navigation_drawer_background_color: true, use_custom_navigation_drawer_accent_color: true, use_custom_app_bar_color: true, use_custom_status_bar_color: true, status_bar_transparent: false, chat_header_transparent: true, chat_header_overlay_mode: false, chat_input_transparent: options.transparentInput, chat_input_floating: false, chat_input_liquid_glass: false, chat_input_water_glass: false, force_app_bar_content_color_enabled: true, bubble_show_avatar: false, bubble_wide_layout_enabled: true, cursor_user_bubble_follow_theme: false, cursor_user_bubble_liquid_glass: false, cursor_user_bubble_water_glass: false, bubble_user_bubble_liquid_glass: false, bubble_user_bubble_water_glass: false, bubble_ai_bubble_liquid_glass: false, bubble_ai_bubble_water_glass: false, bubble_user_use_image: false, bubble_ai_use_image: false, bubble_user_use_custom_font: true, bubble_ai_use_custom_font: true };
  // Operit dark mode lightens primary/secondary by 20%; compensate for orange/cyan.
  const ints: Record<string, number> = { custom_primary_color: argb(light ? palette.accent : '#D05D2D'), custom_secondary_color: argb(light ? SEMANTIC_COLORS.light.info : '#73B9D0'), custom_navigation_drawer_background_color: argb(palette.background), custom_navigation_drawer_accent_color: argb(palette.accent), custom_app_bar_color: argb(palette.background), custom_status_bar_color: argb(palette.background), bubble_user_bubble_color: argb(palette.panel), cursor_user_bubble_color: argb(palette.panel), bubble_ai_bubble_color: argb(palette.background), bubble_user_text_color: argb(palette.text), bubble_ai_text_color: argb(palette.text), chat_header_history_icon_color: argb(palette.muted), chat_header_pip_icon_color: argb(palette.muted) };
  for (const key of Object.keys(strings)) v = v.withString(key, strings[key]);
  for (const key of Object.keys(booleans)) v = v.withBoolean(key, booleans[key]);
  for (const key of Object.keys(ints)) v = v.withInt(key, ints[key]);
  v = v.withFloat('background_image_opacity', 1);
  return v;
}
async function commit(s: Scope, next: JavaBridgeInstance): Promise<void> {
  // Double commit with a tiny font scale nudge forces the host to re-read the palette.
  await s.manager.callSuspend('commitThemeDraft', s.target, next.withFloat('font_scale', Number(next.float('font_scale')) + 0.0001));
  await s.manager.callSuspend('commitThemeDraft', s.target, next);
}
export async function globalPalette(restore = false) {
  const app = Java.getApplicationContext();
  const version = app.getPackageManager().getPackageInfo(app.getPackageName(), 0).versionName;
  if (version !== '1.12.2') throw new Error('全局色表仅适配 Operit 1.12.2');
  const path = await ToolPkg.readResource('global_palette_dex', 'global-palette-1.6.0.dex', true);
  Java.loadDex(path);
  const result = Java.type('local.operit.theme.PaletteBridgeV160').callStatic('apply', app, restore);
  return String(result);
}
// Re-applies the palette when the host switched between light and dark while auto mode is on.
async function autoFollow(): Promise<ThemeVariant | null> {
  if (running) return null;
  const app = Java.getApplicationContext();
  const store = app.getSharedPreferences(PREFS, 0);
  if (!readOptions(store).autoVariant) return null;
  if (store.getString('global:enabled', '') !== 'yes') return null;
  const now = Date.now();
  const last = Number(store.getString(OPT_AUTO_STAMP, '0')) || 0;
  if (now - last < 1200) return null;
  store.edit().putString(OPT_AUTO_STAMP, String(now)).apply();
  const s = await scope();
  if (s.storage.getString('applied:' + s.key, '') !== 'yes') return null;
  const current: ThemeVariant = s.values.string('theme_mode') === 'light' ? 'light' : 'dark';
  const wanted = detectedVariant();
  if (current === wanted) return null;
  await applyTheme(null, wanted);
  console.log('[claude_theme_auto] switched to ' + wanted);
  return wanted;
}
// Host lifecycle replay may run after the first Compose composition.
export async function onGlobalPaletteLifecycle() {
  const app = Java.getApplicationContext();
  const store = app.getSharedPreferences(PREFS, 0);
  if (store.getString('global:enabled', '') !== 'yes') return;
  try {
    await globalPalette(false);
    const s = await scope();
    const bridge = Java.type('local.operit.theme.PaletteBridgeV160');
    const token = 'v170:' + s.key;
    if (bridge.claimRefresh(token)) {
      let completed = false;
      try {
        if (store.getString('global:enabled', '') !== 'yes') return;
        const oldPrimary = Number(s.values.int('custom_primary_color'));
        const pulsePrimary = oldPrimary ^ 1;
        await s.manager.callSuspend('commitThemeDraft', s.target, s.values.withInt('custom_primary_color', pulsePrimary));
        try {
          await new Promise<void>(resolve => setTimeout(resolve, 250));
        } finally {
          // Preserve concurrent edits and restore only our temporary accent value.
          const now = await s.prefs.callSuspend('resolveThemePreferenceSnapshot', s.group ? null : s.id, s.group ? s.id : null) as JavaBridgeInstance;
          const current = now.getValues();
          if (Number(current.int('custom_primary_color')) === pulsePrimary) {
            await s.manager.callSuspend('commitThemeDraft', s.target, current.withInt('custom_primary_color', oldPrimary));
          }
        }
        completed = true;
        store.edit().putString('startup:last_success', String(Date.now())).putString('startup:last_error', '').apply();
        console.log('[claude_theme_startup] palette and Compose refresh ready');
      } finally { bridge.finishRefresh(token, completed); }
    }
    try {
      const switched = await autoFollow();
      if (switched) store.edit().putString('auto:last_switch', switched).apply();
    } catch (error) {
      // Auto follow must never break the startup palette refresh.
      store.edit().putString('auto:last_error', String(error)).apply();
      console.error('[claude_theme_auto] ' + String(error));
    }
  } catch (error) {
    store.edit().putString('startup:last_error', String(error)).apply();
    console.error('[claude_theme_startup] ' + String(error));
    throw error;
  }
}
function activeThemeTargets(storage: JavaBridgeInstance): string[] {
  const values: Record<string, unknown> = JSON.parse(JSON.stringify(storage.getAll()));
  return activeTargetKeys(values);
}
export async function status() {
  const s = await scope();
  const variant: ThemeVariant = s.values.string('theme_mode') === 'light' ? 'light' : 'dark';
  return { activeTargetCount: activeThemeTargets(s.storage).length, version: VERSION, target: s.group ? '当前角色群组' : '当前角色卡', targetId: s.id, hasBackup: s.storage.contains('backup:' + s.key), applied: s.storage.getString('applied:' + s.key, '') === 'yes', theme: s.values.string('theme_mode'), globalEnabled: s.storage.getString('global:enabled', '') === 'yes', variant, options: readOptions(s.storage), systemDark: systemIsDark(), detected: detectedVariant() };
}
export async function applyTheme(backgroundPath: string | null = null, variant?: ThemeVariant) {
  if (variant !== undefined && variant !== 'dark' && variant !== 'light') throw new Error('未知配色：' + String(variant));
  if (running) throw new Error('主题操作正在进行。');
  running = true;
  try {
    const s = await scope();
    const options = readOptions(s.storage);
    const resolved: ThemeVariant = variant ?? (options.autoVariant ? detectedVariant() : 'dark');
    const path = backgroundPath ?? await backgroundResource(resolved, options, s.storage.getString('empty:active', '') === 'yes');
    const file = Java.type('java.io.File').newInstance(path);
    if (!file.isFile()) throw new Error('主题背景资源不存在。');
    // Always capture the immediately previous state for this application session; repeated apply retains original.
    if (s.storage.getString('applied:' + s.key, '') !== 'yes') save(s, 'backup:' + s.key, JSON.stringify(serialize(s.values)));
    await globalPalette(false);
    save(s, 'global:enabled', 'yes');
    const next = modified(s.values, path, resolved, options);
    await commit(s, next);
    save(s, 'applied:' + s.key, 'yes');
    save(s, OPT_LAST_VARIANT, resolved);
    const check = await s.prefs.callSuspend('resolveThemePreferenceSnapshot', s.group ? null : s.id, s.group ? s.id : null) as JavaBridgeInstance;
    if (check.getValues().string('theme_mode') !== resolved) throw new Error('主题写入后读回校验失败。');
    const label = resolved === 'light' ? 'Claude Code 米白主题' : 'Claude Code 暖黑主题';
    const auto = variant === undefined && options.autoVariant;
    return { success: true, version: VERSION, variant: resolved, auto, message: label + '已应用' + (auto ? '（自动跟随系统深浅色）' : '') + '；原外观备份已保留。' };
  } finally { running = false; }
}
/**
 * Switches only the background image, keeping palette/options untouched.
 *
 * Used by the empty-chat hook: an empty conversation shows the icon+greeting
 * art, and the first message swaps it back to the normal background.
 *
 * @param emptyState true to show the empty-state art, false for the normal one
 */
export async function switchEmptyStateBackground(emptyState: boolean) {
  if (running) return { success: false, reason: 'busy' };
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
    const resolved: ThemeVariant = s.values.string('theme_mode') === 'light' ? 'light' : 'dark';
    const path = await backgroundResource(resolved, options, emptyState);
    const file = Java.type('java.io.File').newInstance(path);
    if (!file.isFile()) throw new Error('空状态背景资源不存在。');
    // Single commit: only the background URI changes, so the host does not have
    // to rebuild typography the way the double-commit applyTheme() does.
    await s.manager.callSuspend('commitThemeDraft', s.target, s.values.withString('background_image_uri', 'file://' + path));
    storage.edit().putString('empty:active', emptyState ? 'yes' : 'no').apply();
    return { success: true, emptyState };
  } catch (error) {
    return { success: false, reason: String(error) };
  } finally {
    running = false;
  }
}

export async function restoreTheme() {
  if (running) throw new Error('主题操作正在进行。');
  running = true;
  try {
    const s = await scope();
    const raw = s.storage.getString('backup:' + s.key, '');
    if (!raw) throw new Error('当前角色尚无备份，请先应用主题。');
    const data: Values = JSON.parse(raw);
    // Preserve current identity fields if the user changed them since applying this palette.
    const current = serialize(s.values);
    for (const key of ['custom_chat_title', 'custom_ai_avatar_uri', 'custom_user_avatar_uri']) {
      if (current.strings[key] === undefined) delete data.strings[key]; else data.strings[key] = current.strings[key];
    }
    const allTargets: Record<string, unknown> = JSON.parse(JSON.stringify(s.storage.getAll()));
    const keepGlobal = keepGlobalOnRestore(allTargets, s.key);
    await globalPalette(!keepGlobal);
    await s.manager.callSuspend('commitThemeDraft', s.target, rebuild(data));
    save(s, 'applied:' + s.key, 'no');
    save(s, 'global:enabled', keepGlobal ? 'yes' : 'no');
    return { success: true, version: VERSION, message: keepGlobal ? '已恢复当前角色；其他角色仍在使用主题，全局配色保持启用。' : '已恢复当前角色，并关闭全局配色与日志接管。' };
  } finally { running = false; }
}
// Persists the plugin switches; when this target already carries the theme, apply immediately.
export async function updateOptions(patch: Partial<ThemeOptions>) {
  const app = Java.getApplicationContext();
  const storage = app.getSharedPreferences(PREFS, 0);
  const next: ThemeOptions = { ...readOptions(storage), ...patch };
  storeOptions(storage, next);
  const head = patch.autoVariant !== undefined
    ? (next.autoVariant ? '已开启自动跟随系统深浅色' : '已关闭自动跟随，改为手动配色')
    : patch.transparentInput !== undefined
      ? (next.transparentInput ? '已开启透明输入框' : '已关闭透明输入框')
      : patch.emptyIcon !== undefined
        ? (next.emptyIcon ? '已开启星芒图标' : '已关闭星芒图标')
        : (next.emptySlogan ? '已开启标语' : '已关闭标语');
  let tail = '';
  let variant: ThemeVariant | null = null;
  try {
    const s = await scope();
    if (s.storage.getString('applied:' + s.key, '') === 'yes') {
      const current: ThemeVariant = s.values.string('theme_mode') === 'light' ? 'light' : 'dark';
      const wanted: ThemeVariant = next.autoVariant ? detectedVariant() : current;
      variant = wanted;
      await applyTheme(null, wanted);
      tail = '，已按新设置重新应用' + (wanted === 'light' ? '米白' : '暖黑');
    }
  } catch (error) {
    tail = '，但立即刷新失败：' + String(error);
  }
  return { success: true, version: VERSION, options: next, variant, message: head + tail };
}
export async function roundTripProbe() {
  const s = await scope();
  const data = serialize(s.values);
  const rebuilt = serialize(rebuild(data));
  return { success: JSON.stringify(data) === JSON.stringify(rebuilt), original: data, rebuilt };
}
// Diagnostic probe removed: the overlay dex and Probe class no longer exist,
// this would throw on the missing probe_dex resource.
