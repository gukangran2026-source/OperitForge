"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ThemeScreen;
const theme_1 = require("./theme");
function ThemeScreen(ctx) {
    const { UI } = ctx;
    const [message, setMessage] = ctx.useState('message', '选择配色预览，然后应用到当前角色。');
    const [busy, setBusy] = ctx.useState('busy', false);
    const [selected, setSelected] = ctx.useState('selected', 'light');
    const [hasBackup, setBackup] = ctx.useState('backup', false);
    const [auto, setAuto] = ctx.useState('auto_variant', true);
    const [transparentInput, setTransparentInput] = ctx.useState('transparent_input', true);
    const [systemDark, setSystemDark] = ctx.useState('system_dark', false);
    const [emptyIcon, setEmptyIcon] = ctx.useState('empty_icon', true);
    const [emptySlogan, setEmptySlogan] = ctx.useState('empty_slogan', true);
    // With auto mode on the preview always mirrors the host light/dark state.
    const effective = auto ? (systemDark ? 'dark' : 'light') : selected;
    const P = theme_1.PALETTES[effective];
    const S = theme_1.SEMANTIC_COLORS[effective];
    const syncState = async () => {
        const s = await (0, theme_1.status)();
        setBackup(s.hasBackup);
        setAuto(s.options.autoVariant);
        setTransparentInput(s.options.transparentInput);
        setSystemDark(s.systemDark);
        setEmptyIcon(s.options.emptyIcon);
        setEmptySlogan(s.options.emptySlogan);
        if (!s.options.autoVariant)
            setSelected(s.variant);
        return s;
    };
    const action = async (kind) => {
        if (busy)
            return;
        setBusy(true);
        try {
            if (kind === 'apply') {
                const result = auto ? await (0, theme_1.applyTheme)(null) : await (0, theme_1.applyTheme)(null, selected);
                setMessage(result.message);
                await ctx.showToast(result.message);
            }
            else if (kind === 'applyAll') {
                const result = auto ? await (0, theme_1.applyThemeToAll)() : await (0, theme_1.applyThemeToAll)(selected);
                setMessage(result.message);
                await ctx.showToast(result.message);
            }
            else if (kind === 'restoreAll') {
                const result = await (0, theme_1.restoreAllTheme)();
                setMessage(result.message);
                await ctx.showToast(result.message);
            }
            else if (kind === 'restore') {
                const result = await (0, theme_1.restoreTheme)();
                setMessage(result.message);
                await ctx.showToast(result.message);
            }
            const s = await syncState();
            if (kind === 'status') {
                const assetText = s.assets ? ' · 星芒图 ' + s.assets.ready + '/' + s.assets.total + ' 就绪' : '';
                setMessage(s.target + ' · ' + (s.applied ? (s.variant === 'light' ? '米白已应用' : '暖黑已应用') : '未应用') + ' · 系统当前' + (s.systemDark ? '深色' : '浅色') + ' · ' + (s.hasBackup ? '原外观可恢复' : '应用时自动备份') + assetText);
            }
        }
        catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            setMessage(text);
            await ctx.showToast(text);
        }
        finally {
            setBusy(false);
        }
    };
    const toggle = async (kind, value) => {
        if (busy)
            return;
        setBusy(true);
        try {
            if (kind === 'auto')
                setAuto(value);
            else if (kind === 'input')
                setTransparentInput(value);
            else if (kind === 'icon')
                setEmptyIcon(value);
            else
                setEmptySlogan(value);
            const patch = kind === 'auto' ? { autoVariant: value } : kind === 'input' ? { transparentInput: value } : kind === 'icon' ? { emptyIcon: value } : { emptySlogan: value };
            const result = await (0, theme_1.updateOptions)(patch);
            setMessage(result.message);
            await ctx.showToast(result.message);
            await syncState();
        }
        catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            setMessage(text);
            await ctx.showToast(text);
            try {
                await syncState();
            }
            catch (ignored) { /* keep local state */ }
        }
        finally {
            setBusy(false);
        }
    };
    const text = (value, color = P.text, fontSize = 14) => UI.Text({ text: value, color, fontSize });
    const option = (title, hint, checked, onCheckedChange) => UI.Row({ fillMaxWidth: true, horizontalArrangement: 'spaceBetween', verticalAlignment: 'center', paddingVertical: 6, content: [
            UI.Column({ spacing: 2, content: [text(title, P.text, 14), text(hint, P.muted, 11)] }),
            UI.Switch({ checked, enabled: !busy, onCheckedChange, uncheckedTrackColor: P.border })
        ] });
    return UI.Column({ fillMaxSize: true, background: P.background,
        onLoad: async () => { try {
            const s = await syncState();
            setSelected(s.variant);
        }
        catch (e) {
            setMessage(String(e));
        } },
        content: [UI.LazyColumn({ fillMaxSize: true, padding: 12, spacing: 6, content: [
                    text('CLAUDE CODE / OPERIT', P.accent, 12),
                    text(effective === 'light' ? '纸感米白' : '终端暖黑', P.text, 25),
                    text(auto ? '自动模式 · 系统当前：' + (systemDark ? '深色 → 暖黑' : '浅色 → 米白') : '手动模式 · 请选择配色', P.muted, 11),
                    UI.Row({ spacing: 10, content: [
                            UI.Button({ enabled: !busy && !auto, onClick: () => setSelected('dark'), containerColor: '#262521', content: UI.Text({ text: (!auto && selected === 'dark') ? '✓ 暖黑' : '暖黑', color: '#E8E6DC' }) }),
                            UI.Button({ enabled: !busy && !auto, onClick: () => setSelected('light'), containerColor: '#F0EEE6', content: UI.Text({ text: (!auto && selected === 'light') ? '✓ 米白' : '米白', color: '#3D3A32' }) })
                        ] }),
                    option('跟随系统深浅色', '深色模式用暖黑，浅色用米白', auto, (value) => toggle('auto', value)),
                    option('透明输入框', '默认开启；关闭后输入框使用实心底色', transparentInput, (value) => toggle('input', value)),
                    option('星芒图标', '新对话显示 Claude 星芒，发出第一条消息后自动消失', emptyIcon, (value) => toggle('icon', value)),
                    option('标语', '星芒下方按时段/星期显示问候语，可单独关闭', emptySlogan, (value) => toggle('slogan', value)),
                    UI.Column({ fillMaxWidth: true, padding: 14, spacing: 8, background: P.panel, content: [
                            UI.Text({ text: '> 帮我检查这个项目', color: P.text, fontSize: 14, fontFamily: 'monospace' }),
                            UI.Text({ text: '✳ 正在分析工作区…', color: P.accent, fontSize: 14, fontFamily: 'monospace' }),
                            UI.Text({ text: '● Read  src/main.ts · 完成', color: S.success, fontSize: 13, fontFamily: 'monospace' }),
                            UI.Text({ text: 'ℹ 信息  ·  ! 警告  ·  × 错误', color: P.muted, fontSize: 12, fontFamily: 'monospace' }),
                            UI.Row({ spacing: 10, content: [UI.Text({ text: '信息', color: S.info, fontSize: 12 }), UI.Text({ text: '警告', color: S.warning, fontSize: 12 }), UI.Text({ text: '错误', color: S.error, fontSize: 12 })] }),
                            UI.Row({ spacing: 8, content: [P.background, P.panel, P.accent, P.text, P.muted].map(color => UI.Box({ width: 32, height: 12, background: color })) })
                        ] }),
                    text(message, P.muted, 12),
                    UI.Button({ text: busy ? '处理中…' : '应用' + (effective === 'light' ? '米白' : '暖黑') + '到当前角色' + (auto ? '（自动）' : ''), enabled: !busy, onClick: () => action('apply'), containerColor: P.accent, fillMaxWidth: true }),
                    UI.Button({ text: '恢复当前角色原外观', enabled: !busy && hasBackup, onClick: () => action('restore'), fillMaxWidth: true }),
                    UI.Button({ text: busy ? '处理中…' : '恢复所有角色原外观', enabled: !busy, onClick: () => action('restoreAll'), fillMaxWidth: true }),
                    UI.Button({ text: busy ? '处理中…' : '应用到全部角色', enabled: !busy, onClick: () => action('applyAll'), fillMaxWidth: true }),
                    UI.Button({ text: '刷新状态', enabled: !busy, onClick: () => action('status') }),
                    UI.Button({ text: '工具日志预览', onClick: () => ctx.navigate('toolpkg:' + theme_1.PACKAGE_ID + ':ui:log_preview') }),
                    text('两个开关立即保存；角色已应用主题时切换开关会马上重新应用。系统深浅色变化后，下次进入界面或重启 Operit 时自动跟随。', P.muted, 11),
                    text('恢复当前角色；仅最后一个主题角色退出时关闭全局配色。', P.muted, 11),
                    text('v' + theme_1.VERSION + ' · Operit 1.12.2 · 非官方主题\n基础色表与日志已适配；部分文字和代码块仍需宿主补丁。', P.muted, 11)
                ] })] });
}
