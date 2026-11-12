/**
 * 格式化工具集合
 *
 * 提供文件大小、权限模式等格式化功能
 */

/**
 * 格式化文件大小
 *
 * 将字节数转换为易读的格式（B、KB、MB、GB、TB）
 *
 * @param bytes - 文件大小（字节）
 * @param decimals - 小数位数，默认为 2
 * @returns 格式化后的文件大小字符串
 *
 * @example
 * ```typescript
 * formatBytes(0);              // "0 B"
 * formatBytes(1024);           // "1 KB"
 * formatBytes(1048576);        // "1 MB"
 * formatBytes(1536);           // "1.5 KB"
 * formatBytes(1073741824, 3);  // "1.000 GB"
 * ```
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * 格式化权限模式
 *
 * 将数字模式转换为 Unix 风格的权限字符串（如 -rwxr-xr-x）
 *
 * @param mode - 权限模式（数字）
 * @returns Unix 风格的权限字符串
 *
 * @example
 * ```typescript
 * getModeString(0o755);       // "drwxr-xr-x" (如果设置了目录位)
 * getModeString(0o644);       // "-rw-r--r--"
 * getModeString(0o100755);    // "drwxr-xr-x"
 * ```
 */
export function getModeString(mode: number): string {
  // Unix 文件类型常量
  const S_IFMT = 0o170000;   // 文件类型掩码
  const S_IFSOCK = 0o0140000; // socket
  const S_IFLNK = 0o0120000;  // 符号链接
  const S_IFREG = 0o0100000;  // 普通文件
  const S_IFBLK = 0o0060000;  // 块设备
  const S_IFDIR = 0o0040000;  // 目录
  const S_IFCHR = 0o0020000;  // 字符设备
  const S_IFIFO = 0o0010000;  // FIFO

  // 特殊权限位
  const S_ISUID = 0o4000;  // setuid
  const S_ISGID = 0o2000;  // setgid
  const S_ISVTX = 0o1000;  // sticky

  // 确保模式是有效数字
  if (typeof mode !== 'number' || isNaN(mode)) {
    return '?---------';
  }

  // 获取文件类型字符
  const fileType = mode & S_IFMT;
  let typeChar = '?';
  switch (fileType) {
    case S_IFSOCK:
      typeChar = 's';
      break;
    case S_IFLNK:
      typeChar = 'l';
      break;
    case S_IFREG:
      typeChar = '-';
      break;
    case S_IFBLK:
      typeChar = 'b';
      break;
    case S_IFDIR:
      typeChar = 'd';
      break;
    case S_IFCHR:
      typeChar = 'c';
      break;
    case S_IFIFO:
      typeChar = 'p';
      break;
  }

  // Owner 权限 (rwx)
  const ownerRead = mode & 0o400 ? 'r' : '-';
  const ownerWrite = mode & 0o200 ? 'w' : '-';
  let ownerExec = '-';
  if (mode & 0o100) {
    if (mode & S_ISUID) {
      ownerExec = 's';  // setuid + execute
    } else {
      ownerExec = 'x';
    }
  } else if (mode & S_ISUID) {
    ownerExec = 'S';  // setuid without execute
  }

  // Group 权限 (rwx)
  const groupRead = mode & 0o40 ? 'r' : '-';
  const groupWrite = mode & 0o20 ? 'w' : '-';
  let groupExec = '-';
  if (mode & 0o10) {
    if (mode & S_ISGID) {
      groupExec = 's';  // setgid + execute
    } else {
      groupExec = 'x';
    }
  } else if (mode & S_ISGID) {
    groupExec = 'S';  // setgid without execute
  }

  // Other 权限 (rwx)
  const otherRead = mode & 0o4 ? 'r' : '-';
  const otherWrite = mode & 0o2 ? 'w' : '-';
  let otherExec = '-';
  if (mode & 0o1) {
    if (mode & S_ISVTX) {
      otherExec = 't';  // sticky + execute
    } else {
      otherExec = 'x';
    }
  } else if (mode & S_ISVTX) {
    otherExec = 'T';  // sticky without execute
  }

  return typeChar + ownerRead + ownerWrite + ownerExec +
         groupRead + groupWrite + groupExec +
         otherRead + otherWrite + otherExec;
}

/**
 * 格式化 Unix 时间戳为相对时间
 *
 * 将 Unix 时间戳转换为相对时间描述（如 "5分钟前"）
 *
 * @param timestamp - Unix 时间戳（秒）
 * @returns 相对时间字符串
 *
 * @example
 * ```typescript
 * formatRelativeTime(Date.now() / 1000 - 60);  // "1分钟前"
 * formatRelativeTime(Date.now() / 1000 - 3600); // "1小时前"
 * ```
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;
  const month = day * 30;
  const year = day * 365;

  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`;
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`;
  } else if (diff < month) {
    return `${Math.floor(diff / day)}天前`;
  } else if (diff < year) {
    return `${Math.floor(diff / month)}个月前`;
  } else {
    return `${Math.floor(diff / year)}年前`;
  }
}

/**
 * 格式化日期为本地字符串
 *
 * @param timestamp - Unix 时间戳（秒）
 * @returns 格式化的日期字符串
 *
 * @example
 * ```typescript
 * formatLocalDate(Date.now() / 1000);  // "2026-01-11 23:59:59"
 * ```
 */
export function formatLocalDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
