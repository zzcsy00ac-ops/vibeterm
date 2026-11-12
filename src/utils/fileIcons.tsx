/**
 * 文件图标工具
 *
 * 根据文件类型和扩展名返回对应的图标组件
 */

import { createElement } from 'react';
import type { SFTPFile } from '../store/sftpStore';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileImage,
  FileText,
  Archive,
  FileVideo,
  FileMusic,
  Link2,
  FileJson,
  FileSpreadsheet,
  FileBox,
} from 'lucide-react';

// ==================== 文件扩展名常量 ====================

/**
 * 代码文件扩展名
 */
const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx',
  'py', 'pyw',
  'java', 'jar',
  'cpp', 'c', 'cc', 'cxx', 'h', 'hpp', 'hxx',
  'cs',
  'go',
  'rs',
  'php',
  'rb',
  'swift',
  'kt', 'kts',
  'scala',
  'sh', 'bash', 'zsh', 'fish',
  'ps1', 'psm1', 'psd1',
  'bat', 'cmd',
  'pl', 'pm',
  'lua',
  'r', 'rmd',
  'dart',
  'ex', 'exs',
  'elm',
  'cljs', 'cljc', 'clj',
  'hs', 'lhs',
]);

/**
 * HTML/CSS/前端相关
 */
const WEB_EXTENSIONS = new Set([
  'html', 'htm', 'xhtml',
  'css', 'scss', 'sass', 'less',
  'vue', 'svelte',
]);

/**
 * 配置文件扩展名
 */
const CONFIG_EXTENSIONS = new Set([
  'json', 'jsonc',
  'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
  'env',
  'dockerfile', 'containerfile',
  'gitignore', 'gitattributes',
  'editorconfig',
  'eslintrc', 'prettierrc',
]);

/**
 * 图片文件扩展名
 */
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp',
  'svg', 'svgz',
  'webp', 'avif',
  'ico', 'icns',
  'tiff', 'tif',
  'psd', 'ai',
  'heic', 'heif',
]);

/**
 * 视频文件扩展名
 */
const VIDEO_EXTENSIONS = new Set([
  'mp4', 'm4v', 'mov', 'avi',
  'mkv', 'webm', 'flv', 'wmv',
  '3gp', '3g2',
  'mpeg', 'mpg', 'mts',
  'ts', 'm2ts',
  'rm', 'rmvb',
]);

/**
 * 音频文件扩展名
 */
const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'flac', 'aac',
  'ogg', 'oga', 'm4a', 'wma',
  'opus', 'aiff', 'aif',
  'ape', 'wv',
]);

/**
 * 压缩文件扩展名
 */
const ARCHIVE_EXTENSIONS = new Set([
  'zip', 'zipx',
  'rar',
  '7z', '7zip',
  'tar', 'gz', 'tgz', 'bz2', 'tbz2', 'xz', 'txz',
  'lzma', 'tlz',
  'cab', 'iso',
  'dmg', 'pkg',
  'deb', 'rpm',
  'apk', 'ipa',
  'jar', 'war', 'ear',
]);

/**
 * 文档文件扩展名
 */
const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc', 'docx', 'dot', 'dotx',
  'xls', 'xlsx', 'xlsb', 'xlsm', 'csv',
  'ppt', 'pptx', 'pps', 'ppsx',
  'odt', 'ods', 'odp', 'odg',
  'rtf', 'tex',
  'epub', 'mobi',
  'key', 'pages', 'numbers',
]);

/**
 * 文本文件扩展名
 */
const TEXT_EXTENSIONS = new Set([
  'txt', 'text', 'log', 'md', 'markdown',
  'readme', 'changelog', 'license',
  'rst', 'adoc',
]);

/**
 * 数据库文件扩展名
 */
const DATABASE_EXTENSIONS = new Set([
  'sql', 'db', 'sqlite', 'sqlite3', 'mdb',
]);

/**
 * 证书/密钥文件扩展名
 */
const CERT_EXTENSIONS = new Set([
  'crt', 'cer', 'key', 'pem', 'der',
  'p12', 'pfx',
  'csr',
]);

// ==================== 图标颜色类 ====================

const IconColors = {
  blue: 'text-blue-400',
  blueDark: 'text-blue-600',
  blueLight: 'text-blue-300',
  purple: 'text-purple-400',
  orange: 'text-orange-400',
  pink: 'text-pink-400',
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  gray: 'text-gray-400',
  grayDark: 'text-gray-500',
  red: 'text-red-400',
  cyan: 'text-cyan-400',
  indigo: 'text-indigo-400',
} as const;

// ==================== 主函数 ====================

/**
 * 获取文件图标
 *
 * 根据文件类型和扩展名返回对应的图标组件
 *
 * @param file - SFTP 文件信息
 * @param isOpen - 目录是否打开（可选）
 * @param size - 图标大小（默认 18）
 * @returns React 元素（图标组件）
 *
 * @example
 * ```typescript
 * getFileIcon({ name: 'index.js', isDirectory: false, ... });  // FileCode 图标
 * getFileIcon({ name: 'photo.png', isDirectory: false, ... });  // FileImage 图标
 * getFileIcon({ name: 'docs', isDirectory: true, ... });       // Folder 图标
 * ```
 */
export function getFileIcon(
  file: SFTPFile,
  isOpen?: boolean,
  size: number = 18
): React.ReactNode {
  // 目录
  if (file.isDirectory) {
    return createElement(
      isOpen ? FolderOpen : Folder,
      { className: IconColors.blue, size }
    );
  }

  // 符号链接
  if (file.isSymlink) {
    return createElement(
      Link2,
      { className: IconColors.yellow, size }
    );
  }

  // 获取文件扩展名
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // 代码文件
  if (CODE_EXTENSIONS.has(ext)) {
    return createElement(
      FileCode,
      { className: IconColors.blueLight, size }
    );
  }

  // Web 文件
  if (WEB_EXTENSIONS.has(ext)) {
    return createElement(
      FileCode,
      { className: IconColors.cyan, size }
    );
  }

  // 配置文件
  if (CONFIG_EXTENSIONS.has(ext)) {
    return createElement(
      FileJson,
      { className: IconColors.yellow, size }
    );
  }

  // 图片文件
  if (IMAGE_EXTENSIONS.has(ext)) {
    return createElement(
      FileImage,
      { className: IconColors.purple, size }
    );
  }

  // 压缩文件
  if (ARCHIVE_EXTENSIONS.has(ext)) {
    return createElement(
      Archive,
      { className: IconColors.orange, size }
    );
  }

  // 视频文件
  if (VIDEO_EXTENSIONS.has(ext)) {
    return createElement(
      FileVideo,
      { className: IconColors.pink, size }
    );
  }

  // 音频文件
  if (AUDIO_EXTENSIONS.has(ext)) {
    return createElement(
      FileMusic,
      { className: IconColors.green, size }
    );
  }

  // 文档文件
  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return createElement(
      FileText,
      { className: IconColors.blueDark, size }
    );
  }

  // 文本文件
  if (TEXT_EXTENSIONS.has(ext)) {
    return createElement(
      FileText,
      { className: IconColors.gray, size }
    );
  }

  // 数据库文件
  if (DATABASE_EXTENSIONS.has(ext)) {
    return createElement(
      FileSpreadsheet,
      { className: IconColors.indigo, size }
    );
  }

  // 证书/密钥文件
  if (CERT_EXTENSIONS.has(ext)) {
    return createElement(
      FileBox,
      { className: IconColors.red, size }
    );
  }

  // 默认文件图标
  return createElement(
    File,
    { className: IconColors.grayDark, size }
  );
}

/**
 * 获取文件扩展名
 *
 * @param filename - 文件名
 * @returns 小写的扩展名（不含点）
 *
 * @example
 * ```typescript
 * getFileExtension('archive.tar.gz');  // "gz"
 * getFileExtension('no-extension');    // ""
 * ```
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * 判断是否为可执行文件
 *
 * @param filename - 文件名
 * @returns 是否为可执行文件
 */
export function isExecutableFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  const executableExts = ['exe', 'app', 'appimage', 'elf', 'bin', 'run', 'sh', 'bat', 'cmd'];
  return executableExts.includes(ext);
}

/**
 * 判断是否为代码文件
 *
 * @param filename - 文件名
 * @returns 是否为代码文件
 */
export function isCodeFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return CODE_EXTENSIONS.has(ext) || WEB_EXTENSIONS.has(ext);
}

/**
 * 判断是否为图片文件
 *
 * @param filename - 文件名
 * @returns 是否为图片文件
 */
export function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(filename));
}

/**
 * 判断是否为压缩文件
 *
 * @param filename - 文件名
 * @returns 是否为压缩文件
 */
export function isArchiveFile(filename: string): boolean {
  return ARCHIVE_EXTENSIONS.has(getFileExtension(filename));
}

/**
 * 获取文件类型描述
 *
 * @param file - SFTP 文件信息
 * @returns 文件类型描述字符串
 */
export function getFileTypeDescription(file: SFTPFile): string {
  if (file.isDirectory) {
    return '文件夹';
  }

  if (file.isSymlink) {
    return '符号链接';
  }

  const ext = getFileExtension(file.name);

  if (CODE_EXTENSIONS.has(ext) || WEB_EXTENSIONS.has(ext)) {
    return '代码文件';
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    return '图片';
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    return '视频';
  }

  if (AUDIO_EXTENSIONS.has(ext)) {
    return '音频';
  }

  if (ARCHIVE_EXTENSIONS.has(ext)) {
    return '压缩文件';
  }

  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return '文档';
  }

  return '文件';
}
