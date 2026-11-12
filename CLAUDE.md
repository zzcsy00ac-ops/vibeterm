# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a cross-platform desktop application built with **Tauri v2** (Rust backend) and **React 19** (TypeScript frontend). The app uses pnpm as the package manager and Vite as the build tool.

### Key Versions

- **Tauri**: v2.x
- **@tauri-apps/cli**: ^2
- **@tauri-apps/api**: ^2
- **React**: 19.1.0
- **window-vibrancy**: 0.7.1
- **react-resizable-panels**: 4.3.0

## Common Commands

```bash
# Development (runs Tauri dev with hot reload)
pnpm tauri dev

# Frontend dev server only (for UI work without Rust backend)
pnpm dev

# Build for production
pnpm tauri build

# Type check and build frontend
pnpm build

# Preview production build
pnpm preview

# Extract translation keys (i18n)
pnpm i18next
```

## Architecture

### Frontend Structure

- **Entry point**: `src/main.tsx` - Initializes React with Radix UI Theme provider and i18n
- **Main app**: `src/App.tsx` - Root application component
- **Components**: `src/components/` - React components with co-located CSS files
- **Hooks**: `src/hooks/` - Custom React hooks (e.g., `useTauriWindow` for window management)

### Backend Structure (Rust)

- **Entry point**: `src-tauri/src/main.rs`
- **Tauri commands**: `src-tauri/src/lib.rs` - Rust functions exposed to frontend via IPC
- **Capabilities**: `src-tauri/capabilities/default.json` - Defines which commands and permissions are available to the frontend
- **Config**: `src-tauri/tauri.conf.json` - Main Tauri configuration

### Frontend-Backend Communication

1. Define Rust functions with `#[tauri::command]` in `src-tauri/src/lib.rs`
2. Register commands in `src-tauri/src/lib.rs` with `invoke_handler()`
3. Grant permissions in `src-tauri/capabilities/default.json`
4. Call from frontend using `invoke()` from `@tauri-apps/api/core`

### Window Management

The app uses a **custom title bar** (`src/components/TitleBar.tsx`) that provides window controls (minimize, maximize, close). Key implementation details:

- Uses `-webkit-app-region: drag` CSS for drag-to-move functionality
- The `useTauriWindow` hook provides browser-compatible mock for development
- Window decorations are enabled in Tauri config but overridden by custom UI

### Internationalization (i18n)

- **Framework**: i18next with react-i18next
- **Languages**: English (en), German (de), Chinese (cn)
- **Translation files**: `public/locales/{lang}/translation.json`
- **Configuration**: `src/i18n.ts` and `i18next.config.ts`
- Supported namespaces and languages are configured in `i18next.config.ts`

## Development Workflow

**优先使用自定义指令**：

| 指令 | 用途 | 输出 |
|------|------|------|
| `/research <主题>` | 执行技术调研 | `.research/<topic>_research.md` |
| `/tasks <功能描述>` | 创建任务拆解 | `.tasks/<feature>_tasks.md` |

### 核心规则（备用）

如果不使用指令，请遵循以下规则：

1. **任务创建**：在 `.tasks/` 创建任务文件，等待用户确认后再执行
2. **顺序执行**：逐个完成任务，完成后更新 `- [ ]` → `- [x]`
3. **验证编译**：修改 Rust/Tauri 代码后必须运行 `cargo check`
4. **不要自动归档**：等待用户明确说"归档"或"archive"

## Git Workflow Rules

**重要**：除非用户明确要求（如 "commit" 或 "push"），否则**永远不要自动执行以下操作**：

- ❌ `git add`
- ❌ `git commit`
- ❌ `git push`
- ❌ 任何组合的 git 命令（如 `commit && push`）

**原因**：
- 用户可能希望在提交前检查代码变更
- 用户可能想要修改提交信息
- 用户可能想要先测试代码再提交
- 自动提交可能会推送未完成或未经测试的代码

**正确做法**：
- ✅ 完成代码修改后，等待用户明确要求提交
- ✅ 如需告知用户有未提交的更改，可使用 `git status` 展示状态
- ✅ 用户明确要求 "commit" 或 "push" 时才执行相应操作

## Development Notes

- Dev server runs on **port 1420** (strict port - will fail if unavailable)
- The app uses **Radix UI Themes** with dark appearance by default
- TypeScript strict mode is enabled
- Recent development focus: fixing scrollbar issues in Tauri mode
- The project includes **xterm** dependency, suggesting terminal emulation features may be planned

## IDE Setup

Recommended: VS Code with [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Version Issues & Solutions

This section documents version-specific issues encountered and their solutions to avoid repeating the same problems.

### react-resizable-panels v4.3.0

**Issue**: API changed from earlier versions
- `PanelGroup` → `Group` (property: `direction` → `orientation`)
- `PanelResizeHandle` → `Separator`

**Solution**:
```tsx
import { Group, Panel, Separator } from "react-resizable-panels";

<Group orientation="horizontal">
  <Panel>...</Panel>
  <Separator />
  <Panel>...</Panel>
</Group>
```

### Tauri v2 Window Effects

**Issue**: `effects` property is not supported in `tauri.conf.json`

**Solution**: Use `window-vibrancy` crate with Rust code:
```rust
#[cfg(target_os = "macos")]
use window_vibrancy::apply_vibrancy;

#[cfg(target_os = "macos")]
apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None);
```

### Tauri Manager Trait

**Issue**: `get_webview_window` method not found

**Solution**: Import the `Manager` trait:
```rust
use tauri::Manager;
```

### Tauri v2 macOS Private API for Transparency

**Issue**: `macOSPrivateApi: true` requires matching Cargo.toml feature

**Solution**: Add `macos-private-api` feature to both tauri dependencies:
```toml
# In src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }

[build-dependencies]
tauri-build = { version = "2", features = ["macos-private-api"] }
```

And in `tauri.conf.json`:
```json
{
  "app": {
    "macOSPrivateApi": true
  }
}
```

**Warning**: This prevents App Store distribution on macOS.

## Patches (pnpm patch)

This project uses pnpm's built-in patching mechanism to modify third-party dependencies.

### Current Patches

| Package | Version | Purpose |
|---------|---------|---------|
| `ai` | 6.0.47 | Sequential tool execution instead of parallel |

### ai@6.0.47 Patch Details

**Purpose**: Modify Vercel AI SDK's `executeTools` function to execute tools sequentially instead of in parallel.

**Problem**: When multiple tool calls require user approval, the SDK collects all approvals and then executes all tools in parallel using `Promise.all`. This prevents users from seeing the result of one command before deciding on the next.

**Solution**: Changed `executeTools` in `node_modules/ai/dist/index.mjs` from:
```javascript
const toolOutputs = await Promise.all(toolCalls.map(async (toolCall) => executeToolCall({...})));
```
to:
```javascript
const toolOutputs = [];
for (const toolCall of toolCalls) {
  const output = await executeToolCall({...});
  if (output != null) toolOutputs.push(output);
}
```

### How to Update Patches

1. **Create a new patch**:
   ```bash
   pnpm patch <package>@<version>
   # Edit files in the temporary directory
   pnpm patch-commit /path/to/temp/dir
   ```

2. **Modify existing patch**:
   ```bash
   pnpm patch <package>@<version>
   # The patch will be applied to temp dir for editing
   pnpm patch-commit /path/to/temp/dir
   ```

3. **Remove a patch**:
   - Delete the patch file from `patches/` directory
   - Remove the entry from `pnpm-lock.yaml`'s `patchedDependencies` section
   - Run `pnpm install`

### SDK Upgrade Notes

When upgrading the `ai` package:
1. Check if the `executeTools` function still exists and has the same signature
2. If the implementation changed, update the patch accordingly
3. Test that sequential execution still works as expected

## UI/UX Standards

### Z-Index Scale

All z-index values must use CSS variables defined in `src/App.css`:

```css
:root {
  --z-dropdown: 1000;      /* Dropdown menus */
  --z-sticky: 1020;         /* Sticky positioned elements */
  --z-fixed: 1030;          /* Fixed positioned elements */
  --z-modal-backdrop: 1040; /* Modal/Dialog overlay */
  --z-modal: 1050;          /* Modal/Dialog content */
  --z-popover: 1060;        /* Popover/dropdown content */
  --z-tooltip: 1070;        /* Tooltips */
  --z-context-menu: 1080;   /* Context menus (highest priority) */
}
```

**Usage**: `z-index: var(--z-modal);` instead of hardcoded values.

### Accessibility

- **Reduced Motion**: All animation CSS files include `@media (prefers-reduced-motion: reduce)` to respect user preferences
- **Icons**: Use lucide-react SVG icons (never emojis as UI icons)
- **Cursor Feedback**: Interactive elements have `cursor: pointer`
- **Focus States**: All interactive elements have visible `:focus-visible` states
- **ARIA Labels**: Icon-only buttons and interactive elements include `aria-label` attributes

### Animation Timing

- Micro-interactions: 150-200ms
- Dialog animations: 150-200ms
- Avoid layout-shifting transforms on hover (use color/opacity instead)

### Color Contrast

- Light mode text must meet WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text
- Dark mode generally has sufficient contrast with Radix UI themes

## File Organization Conventions

### Folder Structure

```
.research/     # Research documents (使用 /research 指令生成)
.tasks/        # Task breakdown files (使用 /tasks 指令生成)
docs/          # User-facing documentation and guides
.claude/       # Custom commands and settings
```

### File Placement Rules

| File Type | Location | Examples |
|-----------|----------|----------|
| Research documents | `.research/` | `*_research.md` |
| Task breakdown | `.tasks/` | `*_tasks.md` |
| User documentation | `docs/` | `ComponentName.md` |
| Project docs | Root | `CLAUDE.md`, `README.md` |

## macOS App Store Distribution

### Prerequisites

1. **Apple Developer Account** - Required for App Store distribution
2. **Certificates** - Two certificates needed:
   - `3rd Party Mac Developer Application: <YOUR_CERT_NAME>` - For signing .app
   - `3rd Party Mac Developer Installer: <YOUR_CERT_NAME>` - For signing .pkg
3. **Provisioning Profile** - Required for TestFlight (optional for direct App Store release)
4. **App Store Connect** - App must be created with matching Bundle ID

### Configuration Files

**src-tauri/tauri.conf.json**:
```json
{
  "identifier": "com.liumeng.vibeterm",
  "bundle": {
    "macOS": {
      "entitlements": "./Entitlements.plist",
      "hardenedRuntime": true,
      "infoPlist": "./Info.plist",
      "minimumSystemVersion": "12.0"
    }
  }
}
```

**src-tauri/Entitlements.plist**:
```xml
<key>com.apple.security.app-sandbox</key>
<true/>
<key>com.apple.security.network.client</key>
<true/>
<key>com.apple.security.network.server</key>
<true/>
```

### Build and Sign Commands

```bash
# 1. Build the app
pnpm tauri build --bundles app

# 2. Sign the .app with Application certificate
codesign --sign "3rd Party Mac Developer Application: <YOUR_CERT_NAME>" \
  --entitlements src-tauri/Entitlements.plist \
  --force \
  src-tauri/target/release/bundle/macos/Vibe\ Terminal.app

# 3. Verify signature
codesign -v src-tauri/target/release/bundle/macos/Vibe\ Terminal.app

# 4. Create PKG (signed with Installer certificate)
xcrun productbuild --sign "3rd Party Mac Developer Installer: <YOUR_CERT_NAME>" \
  --component "src-tauri/target/release/bundle/macos/Vibe Terminal.app" \
  /Applications \
  VibeTerminal.pkg

# 5. Verify PKG signature
pkgutil --check-signature VibeTerminal.pkg
```

### Quick Reference

| Step | Command | Certificate |
|------|---------|-------------|
| Build | `pnpm tauri build --bundles app` | - |
| Sign .app | `codesign --sign "..." --entitlements ...` | Application |
| Verify | `codesign -v ...` | - |
| Create PKG | `xcrun productbuild --sign "..."` | Installer |
| Verify PKG | `pkgutil --check-signature ...` | - |

### Common Issues

| Error | Cause | Solution |
|-------|--------|----------|
| `App sandbox not enabled` | Missing entitlement | Add `com.apple.security.app-sandbox: true` |
| `Certificate Revoked` | Certificate revoked | Recreate in Apple Developer portal |
| `Unsupported architecture` | arm64-only on macOS < 12 | Set `minimumSystemVersion: "12.0"` |
| `Missing provisioning profile` | TestFlight requirement | Add provisioning profile to config |

### Upload to App Store

**Using Transporter (Recommended)**:
1. Download Transporter from Mac App Store
2. Sign in with Apple Developer account
3. Drag `VibeTerminal.pkg` to Transporter
4. Deliver

**Using Command Line**:
```bash
xcrun altool --upload-app --type macos --file "VibeTerminal.pkg" \
  --apiKey $APPLE_API_KEY_ID \
  --apiIssuer $APPLE_API_ISSUER
```
