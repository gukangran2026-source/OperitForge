import LogDemo from './log-demo';
import { onToolLogRender } from './log-plugin';
export { onToolLogRender } from './log-plugin';
import ThemeScreen from './screen';
import { PACKAGE_ID, onGlobalPaletteLifecycle } from './theme';
export { onGlobalPaletteLifecycle } from './theme';
export { applyTheme, restoreTheme, status, updateOptions, systemIsDark, roundTripProbe, switchEmptyStateBackground } from './theme';
import { registerEmptyOverlay } from './empty-overlay';
export { onChatViewEvent, onChatMessageEvent, onChatRuntimeEvent } from './empty-overlay';

export function registerToolPkg() {
  ToolPkg.registerXmlRenderPlugin({ id: 'claude_tool_log', tag: 'tool_result', function: onToolLogRender });
  ToolPkg.registerAppLifecycleHook({ id: 'global_palette_start', event: 'application_on_create', function: onGlobalPaletteLifecycle });
  ToolPkg.registerAppLifecycleHook({ id: 'global_palette_resume', event: 'activity_on_resume', function: onGlobalPaletteLifecycle });
  ToolPkg.registerToolboxUiModule({ id: 'log_preview', runtime: 'compose_dsl', screen: LogDemo, title: { zh: '工具日志预览', en: 'Tool Log Preview' } });
  ToolPkg.registerAppLifecycleHook({ id: 'global_palette_foreground', event: 'application_on_foreground', function: onGlobalPaletteLifecycle });
  const title = { zh: 'Claude Code 主题', en: 'Claude Code Theme' };
  ToolPkg.registerToolboxUiModule({ id: 'theme', runtime: 'compose_dsl', screen: ThemeScreen, title });
  const route = 'toolpkg:' + PACKAGE_ID + ':ui:theme';
  // registerToolboxUiModule creates this route automatically in Operit 1.12.2.
  ToolPkg.registerNavigationEntry({ id: 'theme_sidebar', route, surface: 'main_sidebar_plugins', title, icon: 'Palette', order: 60 });

  // Empty-chat background switching.
  registerEmptyOverlay();
}