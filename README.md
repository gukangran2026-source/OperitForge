# Operit Agent Plugins

Operit（Agent 应用）的插件发布仓库。每个插件一个目录，安装包见 Releases。

## 插件

| 插件 | 包 ID | 目录 |
|------|-------|------|
| Claude Code 主题 | `local.operit.claude_code_theme` | [`packages/claude-code-theme`](packages/claude-code-theme) |
| operit-connect-workbuddy | `com.operit.connect.workbuddy` | Releases |

## 目录结构

```
packages/
  claude-code-theme/
    manifest.json      ToolPkg 清单（包 ID、版本、API 版本）
    src/                TypeScript 源码
    tools/              资源生成脚本
    resources/          运行时图片资源
    build.py            构建并打包为 .toolpkg
```

## 构建

```bash
cd packages/claude-code-theme
npm install
python3 build.py        # 输出 .toolpkg 到 ../../out/
```

## 发布

安装包以 Release 资产形式分发，命名规则 `package-<包ID横线化>-v<版本>`，
资产名为 `<包ID横线化>-v<版本>.toolpkg`。
