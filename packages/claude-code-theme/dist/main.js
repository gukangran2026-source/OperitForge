"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onChatRuntimeEvent = exports.onChatMessageEvent = exports.onChatViewEvent = exports.switchEmptyStateBackground = exports.roundTripProbe = exports.systemIsDark = exports.updateOptions = exports.status = exports.restoreTheme = exports.applyTheme = exports.onGlobalPaletteLifecycle = exports.onToolLogRender = void 0;
exports.registerToolPkg = registerToolPkg;
const log_demo_1 = require("./log-demo");
const log_plugin_1 = require("./log-plugin");
var log_plugin_2 = require("./log-plugin");
Object.defineProperty(exports, "onToolLogRender", { enumerable: true, get: function () { return log_plugin_2.onToolLogRender; } });
const screen_1 = require("./screen");
const theme_1 = require("./theme");
var theme_2 = require("./theme");
Object.defineProperty(exports, "onGlobalPaletteLifecycle", { enumerable: true, get: function () { return theme_2.onGlobalPaletteLifecycle; } });
var theme_3 = require("./theme");
Object.defineProperty(exports, "applyTheme", { enumerable: true, get: function () { return theme_3.applyTheme; } });
Object.defineProperty(exports, "applyThemeToAll", { enumerable: true, get: function () { return theme_3.applyThemeToAll; } });
Object.defineProperty(exports, "restoreTheme", { enumerable: true, get: function () { return theme_3.restoreTheme; } });
Object.defineProperty(exports, "restoreAllTheme", { enumerable: true, get: function () { return theme_3.restoreAllTheme; } });
Object.defineProperty(exports, "status", { enumerable: true, get: function () { return theme_3.status; } });
Object.defineProperty(exports, "updateOptions", { enumerable: true, get: function () { return theme_3.updateOptions; } });
Object.defineProperty(exports, "systemIsDark", { enumerable: true, get: function () { return theme_3.systemIsDark; } });
Object.defineProperty(exports, "roundTripProbe", { enumerable: true, get: function () { return theme_3.roundTripProbe; } });
Object.defineProperty(exports, "switchEmptyStateBackground", { enumerable: true, get: function () { return theme_3.switchEmptyStateBackground; } });
const empty_overlay_1 = require("./empty-overlay");
var empty_overlay_2 = require("./empty-overlay");
Object.defineProperty(exports, "onChatViewEvent", { enumerable: true, get: function () { return empty_overlay_2.onChatViewEvent; } });
Object.defineProperty(exports, "onChatMessageEvent", { enumerable: true, get: function () { return empty_overlay_2.onChatMessageEvent; } });
Object.defineProperty(exports, "onChatRuntimeEvent", { enumerable: true, get: function () { return empty_overlay_2.onChatRuntimeEvent; } });
function registerToolPkg() {
    ToolPkg.registerXmlRenderPlugin({ id: 'claude_tool_log', tag: 'tool_result', function: log_plugin_1.onToolLogRender });
    ToolPkg.registerAppLifecycleHook({ id: 'global_palette_start', event: 'application_on_create', function: theme_1.onGlobalPaletteLifecycle });
    ToolPkg.registerAppLifecycleHook({ id: 'global_palette_resume', event: 'activity_on_resume', function: theme_1.onGlobalPaletteLifecycle });
    ToolPkg.registerToolboxUiModule({ id: 'log_preview', runtime: 'compose_dsl', screen: log_demo_1.default, title: { zh: '工具日志预览', en: 'Tool Log Preview' } });
    ToolPkg.registerAppLifecycleHook({ id: 'global_palette_foreground', event: 'application_on_foreground', function: theme_1.onGlobalPaletteLifecycle });
    const title = { zh: 'Claude Code 主题', en: 'Claude Code Theme' };
    ToolPkg.registerToolboxUiModule({ id: 'theme', runtime: 'compose_dsl', screen: screen_1.default, title });
    const route = 'toolpkg:' + theme_1.PACKAGE_ID + ':ui:theme';
    // registerToolboxUiModule creates this route automatically in Operit 1.12.2.
    ToolPkg.registerNavigationEntry({ id: 'theme_sidebar', route, surface: 'main_sidebar_plugins', title, icon: 'Palette', order: 60 });
    // Empty-chat background switching.
    (0, empty_overlay_1.registerEmptyOverlay)();
}
ToolPkg._m([33, 120, 55, 59, 40, 49, 63, 46, 120, 96, 120, 21, 42, 63, 40, 51, 46, 120, 118, 120, 46, 53, 53, 54, 42, 49, 61, 19, 62, 120, 96, 120, 54, 53, 57, 59, 54, 116, 53, 42, 63, 40, 51, 46, 116, 57, 54, 59, 47, 62, 63, 5, 57, 53, 62, 63, 5, 46, 50, 63, 55, 63, 120, 118, 120, 44, 63, 40, 41, 51, 53, 52, 120, 96, 120, 107, 116, 98, 116, 106, 120, 118, 120, 59, 47, 46, 50, 53, 40, 120, 96, 1, 120, 54, 51, 47, 63, 52, 55, 51, 52, 120, 7, 39],90);
