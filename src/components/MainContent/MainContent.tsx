import * as Tabs from '@radix-ui/react-tabs';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { useAppStore } from '../../store/appStore';
import { DraggableTab } from '../Tabs/DraggableTab';
import { TAB_REGISTRY } from '../Tabs/TabRegistry';
import { useTranslation } from 'react-i18next';
import { useMemo, useRef } from 'react';
import { delay } from '../../utils/functionTools';
import './MainContent.css';

/**
 * 主内容区域 - 多标签页管理
 *
 * 使用 Radix UI Tabs + @dnd-kit 实现：
 * - 多标签打开/关闭/切换
 * - 拖拽排序
 * - 状态保持和自动恢复
 */
export function MainContent() {
  const { t, i18n } = useTranslation();
  const { tabs, activeTabId, closeTab, moveTab } = useAppStore();

  // 用于存储标签页容器的 ref
  const tabsContentRef = useRef<HTMLDivElement>(null);

  // 随机欢迎语 - 每次组件挂载或语言切换时选择一条
  const randomMessage = useMemo(() => {
    const messages = t('empty.messages', { returnObjects: true }) as string[];
    return messages[Math.floor(Math.random() * messages.length)];
  }, [i18n.language, t]); // 依赖语言变化

  // 拖拽处理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex((t) => t.id === active.id);
      const newIndex = tabs.findIndex((t) => t.id === over.id);
      moveTab(oldIndex, newIndex);
    }
  };

  // 标签切换处理
  const handleTabChange = async (tabId: string) => {
    useAppStore.getState().setActiveTab(tabId);

    // 延迟执行聚焦，确保 DOM 已更新
    await delay(50);

    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.key === 'ssh-terminal') {
      // 找到对应的 tab pane
      const tabPane = tabsContentRef.current?.querySelector(`[data-tab-id="${tabId}"]`);
      if (tabPane) {
        // 在 tab pane 中查找 terminal 并聚焦
        const terminalElement = tabPane.querySelector('.xterm .xterm-screen') as HTMLElement;
        if (terminalElement) {
          terminalElement.focus();
        }
      }
    }
  };

  // Radix UI 需要一个默认激活的 tab
  const defaultValue = activeTabId || tabs[0]?.id;

  return (
    <div className='main-container'>
      {tabs.length > 0 ? (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToHorizontalAxis]}
        >
          <Tabs.Root className="main-content" value={defaultValue} onValueChange={handleTabChange}>
            {/* 标签列表 */}
            <Tabs.List className="tabs-list">
              <SortableContext
                items={tabs.map((t) => t.id)}
                strategy={horizontalListSortingStrategy}
              >
                {tabs.map((tab) => (
                  <DraggableTab key={tab.id} tab={tab} onClose={() => closeTab(tab.id)} />
                ))}
              </SortableContext>
            </Tabs.List>

            {/* 标签内容区 - 使用 display:none 保持挂载，避免切换时重新渲染 */}
            <div className='tabs-content' ref={tabsContentRef}>
              {tabs.map((tab) => {
              // 从组件注册表获取对应的组件
              const Component = TAB_REGISTRY[tab.key];
              const isActive = tab.id === activeTabId;

              // 如果组件未注册，显示错误提示
              if (!Component) {
                console.error(`[MainContent] 未注册的标签 key: ${tab.key}`);
                return (
                  <div key={tab.id} className="tab-pane" style={{ display: isActive ? 'block' : 'none' }}>
                    <div style={{ width:'100%',height:'100%',backgroundColor:'red' }}>
                      <h2>错误</h2>
                      <p>未注册的视图类型: {tab.key}</p>
                      <p>请在 TabRegistry 中注册此视图类型</p>
                    </div>
                  </div>
                );
              }

              // 渲染对应的组件，传递 params 作为 props
              // 使用 display:none 而不是条件渲染，保持组件挂载状态
              return (
                <div key={tab.id} className="tab-pane" data-tab-id={tab.id} style={{ display: isActive ? 'block' : 'none' }}>
                  <Component {...tab.params} />
                </div>
              );
            })}
            </div>
          </Tabs.Root>
        </DndContext>
      ) : (
        <div className="empty-state">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: '24px', color: 'var(--accent-a11)', fontWeight: 500, lineHeight: 1.6 }}>
              {randomMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
