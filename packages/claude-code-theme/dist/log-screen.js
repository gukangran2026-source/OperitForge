"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ToolLogScreen;
const log_preview_1 = require("./log-preview");
const log_model_1 = require("./log-model");
function ToolLogScreen(ctx) {
    const [xml] = ctx.useState('xmlContent', '');
    const [expanded, setExpanded] = ctx.useState('expanded', false);
    const model = (0, log_model_1.parseToolLog)(xml);
    const { UI, MaterialTheme: { colorScheme: C } } = ctx;
    if (!model)
        return UI.Text({ text: xml, fontSize: 12, fontFamily: 'monospace' });
    const error = model.status === 'error';
    const label = { success: '完成', error: '失败', warning: '警告', cancelled: '已取消', returned: '已返回' }[model.status];
    const color = error ? C.error : model.status === 'success' ? C.tertiary : model.status === 'warning' ? C.primary : C.onSurfaceVariant;
    const lines = (0, log_preview_1.toolLogPreview)(model.body).split('\n');
    const preview = lines.slice(0, 3).join('\n');
    const long = lines.length > 3 || model.body.length > 220 || (0, log_preview_1.toolLogPreview)(model.body) !== model.body;
    const body = expanded ? model.body : preview.slice(0, 220);
    const copy = async () => {
        const clipboard = Java.getApplicationContext().getSystemService('clipboard');
        if (!clipboard)
            throw new Error('系统剪贴板不可用');
        clipboard.setPrimaryClip(Java.type('android.content.ClipData').newPlainText(model.name, model.body));
        await ctx.showToast('已复制完整结果');
    };
    return UI.Column({ fillMaxWidth: true, spacing: 4,
        modifier: ctx.Modifier.fillMaxWidth().border(1, C.outlineVariant, { type: 'rounded', cornerRadius: 4 }).padding(8),
        content: [
            UI.Row({ spacing: 8, verticalAlignment: 'center', content: [
                    UI.Text({ text: (error ? '× ' : model.status === 'warning' ? '! ' : '● ') + model.name, fontSize: 12, fontFamily: 'monospace', color, maxLines: 1, overflow: 'ellipsis', weight: 1 }),
                    UI.Text({ text: label, fontSize: 11, color }),
                    UI.TextButton({ onClick: copy, content: UI.Text({ text: '复制', fontSize: 11, color: C.primary }) })
                ] }),
            UI.Text({ text: body || '（无文本结果）', color: C.onSurfaceVariant, fontSize: 12, fontFamily: 'monospace' }),
            ...(long ? [UI.TextButton({ onClick: () => setExpanded(!expanded), content: UI.Text({ text: expanded ? '收起' : '展开完整结果', color: C.primary, fontSize: 11 }) })] : [])
        ] });
}
