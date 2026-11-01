import type { ToolPkg as TP } from '../../types/toolpkg';
import ToolLogScreen from './log-screen';
import { parseToolLog } from './log-model';
export function onToolLogRender(event: TP.XmlRenderHookEvent): TP.XmlRenderHookReturn {
  const enabled = Java.getApplicationContext().getSharedPreferences('claude_code_theme_v1', 0).getString('global:enabled', '') === 'yes';
  const xmlContent = String(event.eventPayload?.xmlContent || '');
  const parsed = parseToolLog(xmlContent);
  if (!enabled || !parsed) return { handled: false };
  return { handled: true, composeDsl: { screen: ToolLogScreen, state: { xmlContent } } };
}
