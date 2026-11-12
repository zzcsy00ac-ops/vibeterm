/**
 * 路由导出文件
 *
 * 核心页面（高频使用）- 直接导出
 * 懒加载页面 - 使用 React.lazy() 按需加载
 */

import { lazy } from 'react';

// 核心页面（高频使用）- 直接导出
export { default as SshManager } from '../pages/SshManager/SshManager';
export { default as ProviderManager } from '../pages/ProviderManager/ProviderManager';

// 懒加载页面
export const Chats = lazy(() => import('../pages/Chats/Chats').then(m => ({ default: m.default })));
export const Monitor = lazy(() => import('../pages/Monitor/Monitor').then(m => ({ default: m.default })));

// Settings 子页面懒加载
export const GeneralSettings = lazy(() => import('../pages/Settings/General').then(m => ({ default: m.default })));
export const AppearanceSettings = lazy(() => import('../pages/Settings/Appearance').then(m => ({ default: m.default })));
export const SkillsSettings = lazy(() => import('../pages/Settings/Skills').then(m => ({ default: m.default })));
export const AdvancedSettings = lazy(() => import('../pages/Settings/Advanced').then(m => ({ default: m.default })));
export const DataSettings = lazy(() => import('../pages/Settings/Data').then(m => ({ default: m.default })));
