/**
 * AI 工具：获取当前时间
 *
 * 使用 JavaScript Date API 和 Intl API 实现
 * 支持时区转换和多种返回格式
 */

import { tool } from 'ai';
import { z } from 'zod';

/**
 * 获取指定时区的当前时间
 */
function getTimeInTimezone(timezone: string): Date {
  // Intl API 用于时区转换
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const now = new Date();
  const parts = formatter.formatToParts(now);

  // 提取各部分构造日期对象
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');

  return new Date(year, month, day, hour, minute, second);
}

/**
 * 工具：获取当前时间
 *
 * 支持的功能：
 * - 获取当前日期时间
 * - 支持时区转换（如 "Asia/Shanghai", "UTC", "America/New_York"）
 * - 多种返回格式（ISO、可读、时间戳）
 * - 返回结构化的日期时间信息
 *
 * @example
 * "现在几点了？" → 返回当前时间
 * "UTC 时间是多少？" → 返回 UTC 时间
 * "今天是什么日期？" → 返回年月日和星期
 */
export const getCurrentTime = tool({
  description: `获取当前的日期和时间。
返回信息包括：
- ISO 格式时间戳（标准格式，适合机器解析）
- Unix 时间戳（毫秒级精度）
- 人类可读的日期时间字符串
- 结构化的年月日时分秒和星期几
- 时区信息

使用场景：
- 回答"现在几点了"、"今天是什么日期"
- 计算"距离某天还有多少天"
- 生成带时间戳的日志
- 判断某个日期是星期几
- 时区相关的查询和转换`,

  inputSchema: z.object({
    timezone: z.string().optional()
      .describe('可选的时区标识符（如 "Asia/Shanghai"、"UTC"、"America/New_York"、"Europe/Berlin"），不指定则使用系统本地时区'),
    format: z.enum(['iso', 'readable', 'timestamp', 'full']).optional()
      .describe('返回格式：iso=仅ISO格式，readable=人类可读格式，timestamp=仅Unix时间戳，full=完整信息（默认）'),
  }),

  execute: async ({ timezone, format = 'full' }) => {
    const now = new Date();

    // 获取系统时区
    const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // 处理时区
    const targetTimezone = timezone || systemTimezone;
    const targetTime = timezone ? getTimeInTimezone(timezone) : now;

    // 获取星期几（中文）
    const weekdayCN = ['日', '一', '二', '三', '四', '五', '六'][targetTime.getDay()];
    const weekdayEN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][targetTime.getDay()];
    const weekdayDE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][targetTime.getDay()];

    // 计算时区偏移（分钟）
    const offsetMinutes = targetTime.getTimezoneOffset();
    const offsetSign = offsetMinutes <= 0 ? '+' : '-';
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
    const offsetMins = Math.abs(offsetMinutes % 60);
    const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    // 根据格式返回结果
    switch (format) {
      case 'iso':
        return {
          currentTime: targetTime.toISOString(),
          timezone: targetTimezone,
          systemTimezone,
        };

      case 'timestamp':
        return {
          currentTime: now.getTime(),
          timezone: targetTimezone,
          systemTimezone,
          unixTimestamp: now.getTime(),
        };

      case 'readable':
        return {
          currentTime: targetTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }),
          timezone: targetTimezone,
          systemTimezone,
        };

      case 'full':
      default:
        return {
          // ISO 格式
          iso: targetTime.toISOString(),

          // Unix 时间戳（毫秒）
          unixTimestamp: now.getTime(),

          // 人类可读格式
          readable: targetTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }),

          // 英文可读格式
          readableEN: targetTime.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }),

          // 德文可读格式
          readableDE: targetTime.toLocaleString('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }),

          // 时区信息
          timezone: targetTimezone,
          systemTimezone,
          timezoneOffset: offsetString,

          // 结构化数据
          date: {
            year: targetTime.getFullYear(),
            month: targetTime.getMonth() + 1,
            day: targetTime.getDate(),
            hour: targetTime.getHours(),
            minute: targetTime.getMinutes(),
            second: targetTime.getSeconds(),
            weekday: {
              cn: weekdayCN,
              en: weekdayEN,
              de: weekdayDE,
              index: targetTime.getDay(), // 0=周日, 1=周一, ..., 6=周六
            },
          },

          // 额外信息
          extra: {
            currentYear: targetTime.getFullYear(),
            isLeapYear: (targetTime.getFullYear() % 4 === 0 && targetTime.getFullYear() % 100 !== 0) || targetTime.getFullYear() % 400 === 0,
            dayOfYear: Math.floor((targetTime.getTime() - new Date(targetTime.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)),
            weekOfYear: Math.ceil((((targetTime.getTime() - new Date(targetTime.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(targetTime.getFullYear(), 0, 1).getDay() + 1) / 7),
          },
        };
    }
  },
});
