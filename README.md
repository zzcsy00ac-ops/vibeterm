# Vibe Terminal

**A cross-platform AI-powered SSH client** — manage servers, transfer files, and let AI run commands with you, in one native app.

Built with [Tauri v2](https://tauri.app) (Rust) + React 19 + TypeScript.

## Features

### 🖥 SSH Terminal
- Full terminal emulation via [xterm.js](https://xtermjs.org), multi-tab workspace
- Connection profiles with grouping: password, private key (with passphrase), and sudo helpers
- Secure credential storage through the OS keychain/keyring

### 📁 SFTP File Manager
- Browse remote filesystem side-by-side with the terminal
- Upload / download with progress tracking; drag & drop files straight into the terminal to upload
- Remote current-directory awareness for quick transfers

### 🤖 AI Assistant
- Natural language → shell commands, executed on the connected server
- Every tool call requires explicit approval before execution
- Streaming Markdown rendering with code highlighting, LaTeX math (KaTeX), and Mermaid diagrams
- Multi-provider model management: OpenAI, Anthropic, Ollama, and other OpenAI-compatible endpoints, organized in groups
- **Skills system**: enable preset or custom skills (Markdown instructions + trigger keywords) that the AI activates contextually

### 📊 Server Monitor
- Live CPU / memory / network charts per connected session

### 🎨 UX
- Light / dark / system themes with macOS vibrancy
- i18n: English · 简体中文 · Deutsch
- Config backup & restore

## Tech Stack

| Layer | Tech |
|-------|------|
| Shell | Rust · Tauri v2 · russh |
| Frontend | React 19 · TypeScript · Zustand · Radix UI |
| Terminal | xterm.js |
| AI | Vercel AI SDK · @ai-sdk/openai · @ai-sdk/anthropic · ollama |
| Charts | ECharts |

> Note: the `ai` SDK is patched (see `patches/`) so that tool calls execute **sequentially** — you see each command's result before approving the next.

## Getting Started

Prerequisites: [Node.js](https://nodejs.org) ≥ 20, [pnpm](https://pnpm.io), [Rust](https://rustup.rs) toolchain.

```bash
pnpm install
pnpm tauri dev      # development with hot reload
pnpm tauri build    # production build (dmg / msi / AppImage)
```

## Project Structure

```
src/               React frontend
  pages/           SSH Manager · Monitor · Chats · Settings · Provider Manager
  components/      SSHTerminal · SFTPSheet · ChatInterface · SkillCard · ...
  store/           zustand stores (ssh / sftp / chat / monitor / provider / skill)
src-tauri/         Rust backend
  src/ssh.rs       SSH session & auth
  src/sftp.rs      SFTP operations
  src/commands/    Tauri IPC commands (tools / monitor / backup / store)
public/locales/    i18n resources (en / cn / de)
patches/           pnpm patches (sequential AI tool execution)
docs/              component docs
```

## License

[MIT](./LICENSE)
