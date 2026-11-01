# Claude Code 主题 · v2.0.0

面向 Operit 1.12.2 的非官方主题插件。提供「终端暖黑」和「纸感米白」两套配色，保留陶土橙强调色、等宽聊天字体、宽消息布局和简洁头像设置。

## 安装和使用

1. 在 Operit 插件管理中导入 `.toolpkg`，启用插件。
2. 打开工具箱或侧栏的「Claude Code 主题」。
3. 选择「暖黑」或「米白」预览，再点击「应用到当前角色」。
4. 想恢复时，进入同一角色，点击「恢复之前的外观」。
5. 想一次铺到所有角色卡和角色群组，点击「应用到全部角色」。

页面顶部有两个开关，改动立即保存；当前角色已应用主题时会马上重新应用一次：

- **跟随系统深浅色**（默认开）：系统深色模式用暖黑，浅色用米白。开启后手动配色按钮变灰，系统深浅色变化后在下一次进入前台或重启 Operit 时自动切换。
- **透明输入框**（默认开）：关闭后输入框改用实心底色。

每个角色卡或角色群组分别存储外观。首次应用会保存原外观，深浅切换、重复应用和升级插件不会覆盖该备份；恢复后再次应用会建立新备份。卸载插件不会自动恢复颜色，请先恢复再卸载。备份位于 Operit 私有 SharedPreferences `claude_code_theme_v1`，不包含模型、密钥和聊天正文。

## 配色

| 用途 | 暖黑 | 米白 |
|---|---|---|
| 背景 | `#1C1B19` | `#FAF9F5` |
| 用户消息面板 | `#262521` | `#F0EEE6` |
| 消息文字 | `#E8E6DC` | `#3D3A32` |
| 次要文字 | `#A6A398` | `#757166` |
| 强调色 | `#D97757` | `#B85335` |

## 兼容边界

这是 `.toolpkg` 主题管理插件，**不是 `.otheme` 归档**。Operit 1.12.2 的公开 ToolPkg API 没有全局主题注册接口，因此插件经 Java Bridge 调用此版本已有的 `ActivePromptManager.commitThemeDraft` 保存外观，并由应用的 DataStore 更新界面。未知版本会在写入前拒绝应用，需要针对新版本重新验证。

主题只影响外观。角色名称、自定义标题、头像文件、模型配置和聊天数据保持不变。恢复时保留应用主题后更新的标题和头像。从 1.4.0 起，插件通过版本固定的 DEX 适配器更新宿主四套 Material3 基础色表，覆盖全局 surface/container/outline/tint 等颜色角色，并调整 primary/secondary/tertiary/error 角色。绿色和青色分别映射到第三、第二强调色，不代表全局成功/信息状态钩子；黄色仅作为配色预设和插件预览，宿主没有对应 Material 角色。全局 UI 和聊天正文优先使用 Android Monospace 字体，代码块仍由 Markdown 专用等宽字体处理。设置卡片、Material 弹窗、输入控件和边框不再使用内置紫色色表。独立第三方插件、WebView 页面及硬编码的语义色不保证跟随宿主主题。系统中文字体仍使用 Android 字体回退。

背景资源会经 `ToolPkg.readResource(..., true)` 提取到应用内部资源目录。无需网络、Root、Shizuku 或常驻服务。

## 构建

在 Android 已挂载存储的 Linux 终端运行 `python3 build.py`。需要 Node/npm，脚本用 npx 调用 TypeScript，并复制本机已更新的官方类型。`src/` 是源码，`resources/palette.json` 是配色预设源文件。

## 来源

开发接口依据 [Operit v1.12.2](https://github.com/AAswordman/Operit/tree/v1.12.2) 和官方 SandboxPackage_DEV 类型定义。Claude Code 名称仅用于描述视觉灵感；本插件与 Anthropic 无隶属关系。

## 全局色表实现

DEX 适配器仅通过反射更新应用进程中的 Material3 色表，不修改 APK。颜色在 UI 主线程更新并清空组件颜色缓存。启动和 Activity 恢复时根据持久开关重新应用；恢复按钮同时关闭全局覆盖。进程内原始色表按字段保存，跨 QuickJS 运行时共享。仅支持 Operit 1.12.2，升级应用后必须重新验证。卸载前请点击恢复；关闭插件后重启进程可移除内存色表覆盖。

构建 DEX 需要 JDK 和 Google R8 8.3.37（native/r8.jar）。

## 与 Claude Code 的对照

官方 Claude Code 文档说明，主题继承终端配色，并允许覆盖 `claude`、`error`、`success` 等语义 token；它不控制终端自己的背景。这个插件把同一思路投影到 Operit：背景和 surface 使用暖黑 / 米白，主操作使用陶土橙，成功使用低饱和绿，信息使用青色，警告使用暗金黄，错误使用砖红。紫色不再作为默认强调色。

## 本轮核对后的实际边界

Claude Code 终端背景由终端控制，这里的米白 / 暖黑是风格化预设，并非从官方完整色表逐值复制。代码块在 Operit 1.12.2 的 EnhancedCodeBlock.kt 中硬编码为 VS Code 风格深色及语法色，不能通过当前 Material 色表覆盖。工具状态、diff、选中文本、圆角与控件间距须分别检查渲染器，不能把 Material 第三强调色直接称为全局成功色。详细对照见 STYLE-AUDIT.md。

## 1.4.0 工具日志

完成的普通 tool_result 可通过 XML 渲染插件呈现为等宽日志，支持状态、三行预览、展开、收起与复制完整原文。命令返回的 JSON 预览优先展示 output/stdout/error/message，展开与复制仍使用完整原始结果。文件差异、HTML/媒体、未知状态和超过 16000 字符的结果回退宿主。关闭全局主题覆盖后插件停止接管新渲染。

普通 Markdown 代码块仍是宿主组件。host-patch/claude-code-blocks.patch 是针对官方 v1.12.2 的源码补丁，不会由本 ToolPkg 自动安装，也尚未进行 Android 构建验证。

## 1.5.0 审查修复

外层调用成功不代表业务成功。明确 success:false / ok:false / 非零 exitCode（含 data/result/execution_result 包装）显示失败；普通无法判断文本显示已返回。保留完整原文复制。包含链接、代码围栏、媒体与专用标签的结果回退宿主渲染。米白强调色加深为 #B85335，配白字对比度超过 4.5:1。

恢复按钮仅恢复当前角色；仍有其他角色应用主题时保持全局覆盖，最后一个退出才关闭。全局基础色表恢复已在当前进程中读回原始值，角色设置与备份逐项比较通过。完整冷启动和跨真实角色切换仍需验证。

最终正文色仍可能被宿主生成规则覆盖为纯黑白；host-patch/claude-final-foreground.patch 配合代码块补丁才能从源码消除此差异。两份补丁只通过应用检查，未构建 APK。当前本机源码缺少 local.properties、app/libs、app/src/main/jniLibs，不具备完整官方构建依赖。本插件不重签或替换当前应用，避免破坏用户数据与升级链。

## 1.6.0 启动配色修复

旧版本启动 Hook 只修改进程内色表，无法使首次已生成的 Compose 配色失效，导致橙色保留、卡片回到紫色。新版增加 application_on_foreground 回放，并在每个进程/角色首次加载成功后触发一次有界刷新；临时 font_scale 增量在 finally 中撤回，恢复时读取最新值以保留并发编辑。进程级标记阻止多个生命周期事件重复刷新。诊断存储 startup:last_success 与 startup:last_error，不含密钥或对话内容。

真机已确认进程号变化 21026 → 29552、新进程启动记录成功，进入设置页后多处卡片取色 #FAF9F5，font_scale=1。仅验收了当前米白角色一次实际冷启动，不能据此声称所有设备和主题均已测试。启动插件为异步加载，首次绘制可能短暂显示宿主颜色；修复目标是加载完成后不再一直停留于紫色。

## 1.6.1 重复冷启动修复

1.6.0 的字号变化不能可靠触发主题生成器重算。1.6.1 改为刷新实际依赖的 custom_primary_color，只改变一个色值位，等待 250ms 后读取最新值，仅当临时值仍在时恢复原主色。原外观备份不变。

当前设备连续两次实际重启：26291 → 32177 → 4323。两轮都没有点击应用主题，设置卡片取色 #FAF9F5；第二轮四处设置卡片一致。最终主色 -4697291，字号倍率 1，启动错误为空。

仅实测当前米白角色。首帧异步加载可能短暂显示宿主颜色；普通代码块、其他宿主硬编码颜色仍是原有限制。1.6.0 不能继续作为已修复版本发布。

## 1.7.0 双开关：自动深浅色与透明输入框

新版在主题页顶部加入两个开关，状态保存在 `claude_code_theme_v1` 的 `opt:auto_variant` / `opt:transparent_input`（`on`/`off`），未写入时都按开启处理。

- 自动深浅色：`systemIsDark()` 读取 `Resources.configuration.uiMode & UI_MODE_NIGHT_MASK`，与 Operit 自身「跟随系统」使用同一来源。开启后 `applyTheme` 不传配色时按该值解析；手动配色按钮置灰。
- 自动切换触发点：复用已有的 `application_on_create` / `activity_on_resume` / `application_on_foreground` 生命周期钩子，在全局色表刷新完成后调用 `autoFollow()`。只有「已应用主题 + 检测结果与当前 `theme_mode` 不一致」才写入，并有 1200ms 节流，失败只记录 `auto:last_error`，不影响启动刷新。
- 透明输入框：写入 `chat_input_transparent`，默认开启；关闭后输入框回到实心底色。

真机验证（Operit 1.12.2，米白角色）：`commitThemeDraft` 写入 `chat_input_transparent=true` 后读回为 true；手动把 `theme_mode` 改成 `dark` 制造不一致，切到别的应用再回到 Operit，`autoFollow` 自动把主题改回 `light`，`opt:last_variant=light`、`auto:last_switch=light`，原外观备份未被覆盖。本机没有 `WRITE_SECURE_SETTINGS`/Root，无法直接切换系统深夜模式，因此「系统深色 → 暖黑」方向未在真机实测，只验证了同一路径的反向切换。

自动切换依赖宿主在深浅色变化时重建 Activity 或重新回到前台；如果宿主在同一次前台停留内切换深浅色且不重建 Activity，需要重新进入前台或重启 Operit 才会生效。

## 1.9.0 空状态资源自举与全部角色

1.8.0 的空状态图只认外部固定目录 `resources/empty3/`，而 manifest 只登记了 5 个资源键，图片一张都没被提取。结果就是：跑过构建的机器有图，任何干净设备装上都是普通背景，钩子日志里反复出现「空状态背景资源不存在」。

1.9.0 的处理：

- manifest 把 70 张空状态图全部登记为独立资源键（`art_*`），随包分发，不依赖构建副作用。
- 新增 `ensureArtAssets()`：在主题页加载、点「刷新状态」、点「应用」这些有 runtime target 的时机，把缺失的图逐张经 `ToolPkg.readResource(..., true)` 展开一次，把绝对路径存进 `claude_code_theme_v1` 的 `art:<文件名>`。
- 钩子侧改为先读这个记录的路径，再回退旧的 `resources/empty3/` 镜像。两条都没有才报错，且错误文案直接说明怎么修。
- 主题页状态行显示「星芒图 70/70 就绪」，缺图时能直接看出来。

新增「应用到全部角色」：

- 遍历 `CharacterCardManager.getAllCharacterCards()` 与 `CharacterGroupCardManager.getAllCharacterGroupCards()`，对每个 `ActivePrompt` 调用同一个 `commitThemeDraft`，不需要切换当前角色。
- 每个角色单独记录 `applied:<key>` 与 `backup:<key>`，恢复一个角色不会影响其他角色。
- 当前可见角色走原有的双次提交（font_scale 微调），其余角色只提交一次，减少重绘开销。
- 单个角色失败不中断，结果里列出失败项与原因。

已知边界：全部角色应用是串行提交，角色很多时需要几秒；它只处理角色卡与角色群组，不改变聊天记录、模型配置和头像。

## 2.0.0 应用到全部角色 / 恢复所有角色

1.9.x 里这两个按钮在真机上一直失败，实测定位到三层原因：

- ToolPkg 桥接按参数的运行时类型匹配方法。`getAllCharacterCards()` 返回的是 `CharacterCard` 实体，而 `commitThemeDraft` 声明参数是 `ActivePrompt` 接口，两者对不上，直接报 `no suspend method matched`
- 多个 manager 方法在桥接里根本不可见：`getCharacterCardThemePrefix`、`cloneThemeBetweenPrefixes` 都返回 `not found`，所以克隆路线也走不通
- 中途我在 `dist` 里写了未定义变量 `VERSION`（CommonJS 里应为 `exports.VERSION`），把上面两条掩盖了两轮

2.0.0 的做法：随插件打包一个自编译 DEX（`resources/bulk-theme.dex`，源码在仓库 `java/bulk-theme/`），在应用进程内用真实反射绕过桥接的类型匹配：

- `ActivePrompt` 是 sealed interface，两个实现类 `ActivePrompt$CharacterCard` / `ActivePrompt$CharacterGroup` 的构造函数都只接受一个 String id
- 用它按 id 构造 prompt 对象，再调用 `commitThemeDraft(prompt, values)` 的同步包装（自建 Continuation + CountDownLatch）
- 不需要切换当前角色，也不依赖桥接暴露那些方法
- 每个角色单独写 `backup:` / `applied:` 记录，恢复互不影响

实测（Operit 1.12.2，5 张角色卡）：

```
[apply-all] done applied=5 failed=0
[restore-all] done restored=5 missing=0 failed=0
```

排错日志固定写到 `/sdcard/Download/Operit/dev_package/theme-all.log`。

### 已知问题

深色模式下聊天列表里的角色名是 `#000000`，背景 `#1C1B19`，几乎看不清。原因是预编译色表 DEX 覆盖了 `onSurfaceVariant` 等字段，但没有覆盖 `onSurface`，而列表项文字正好取它。修复需要改色表 DEX，尚未处理。
