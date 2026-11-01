import type { ComposeDslContext } from '../../types/compose-dsl';
import ToolLogScreen from './log-screen';
const prefix = '<tool_result name="theme.preview" status="success"><content>';
const suffix = '<' + '/content><' + '/tool_result>';
const samples = {
  neutral: prefix + ['Claude Code 风格日志', '第一行：运行完成', '第二行：支持复制', '第三行：展开查看', '最后一行：完整内容保留'].join('\n') + suffix,
  success: prefix + JSON.stringify({success:true,output:'成功状态验证'}) + suffix,
  error: prefix + JSON.stringify({success:true,data:{result:{success:false,error:'业务失败验证'}}}) + suffix
};
export default function LogDemo(ctx: ComposeDslContext) {
  const [mode, setMode] = ctx.useState<'neutral' | 'success' | 'error'>('demoMode', 'neutral');
  const seeded = Object.assign({}, ctx, {
    useState: <T>(key: string, value: T): [T, (value: T) => void] => key === 'xmlContent' ? [samples[mode] as T, (_value: T) => {}] : ctx.useState<T>(key, value)
  });
  return ctx.UI.Column({ padding: 16, spacing: 12, fillMaxWidth: true, content: [
    ctx.UI.Text({ text: '工具日志预览', fontSize: 20, color: ctx.MaterialTheme.colorScheme.onSurface }),
    ctx.UI.Row({ spacing: 8, content: [
      ctx.UI.Button({ text: '返回', onClick: () => setMode('neutral') }),
      ctx.UI.Button({ text: '成功', onClick: () => setMode('success') }),
      ctx.UI.Button({ text: '业务失败', onClick: () => setMode('error') })
    ] }),
    ToolLogScreen(seeded)
  ] });
}