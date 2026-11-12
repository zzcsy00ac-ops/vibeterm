/**
 * 通用多选组件
 *
 * 功能：
 * - Popover 弹出式选择
 * - 搜索过滤
 * - 分组显示
 * - 全选/清空
 * - 可配置样式
 */

import { Popover, Button, Flex, Text, Checkbox, TextField, Separator } from '@radix-ui/themes';
import { useState, useMemo, useRef, useEffect } from 'react';
import { PencilRuler, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import type { MultiSelectProps } from './types';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import './MultiSelect.css';

export function MultiSelect({
  items,
  groups = [],
  value,
  onChange,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  selectAllLabel = 'Select All',
  title = 'Select Items',
  noResultsText = 'No results found',
  selectedCountText = (current, total) => `${current} / ${total} selected`,
  disabled = false,
  triggerSize = '2',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // 临时状态：弹窗打开时的选择值
  const [tempValue, setTempValue] = useState<string[]>(value);
  // 记录打开时的初始值，用于检测是否有变化
  const initialValueRef = useRef<string[]>(value);

  // 用于防止重复触发 onChange
  const isClosingRef = useRef(false);

  // 弹窗打开时，同步当前值到临时状态
  useEffect(() => {
    if (open) {
      setTempValue(value);
      initialValueRef.current = value;
      isClosingRef.current = false;
    }
  }, [open, value]);

  // 弹窗关闭时，如果有变化才调用 onChange
  useEffect(() => {
    if (!open && initialValueRef.current !== undefined && !isClosingRef.current) {
      const hasChanged = tempValue.length !== initialValueRef.current.length ||
        tempValue.some(v => !initialValueRef.current.includes(v)) ||
        initialValueRef.current.some(v => !tempValue.includes(v));

      if (hasChanged) {
        isClosingRef.current = true;
        onChange(tempValue);
      }
    }
    // 关闭后重置 flag，为下次打开做准备
    if (!open) {
      isClosingRef.current = false;
    }
  }, [open]);

  // 根据搜索过滤选项
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(item => {
      const label = item.label.toLowerCase();
      const desc = item.description?.toLowerCase() || '';
      return label.includes(query) || desc.includes(query);
    });
  }, [searchQuery, items]);

  // 计算选中状态（基于临时值）
  const allSelected = filteredItems.length > 0 &&
    filteredItems.every(item => tempValue.includes(item.value));
  const someSelected = filteredItems.some(item => tempValue.includes(item.value));

  // 切换全选（仅针对过滤结果）
  const handleToggleAll = () => {
    if (allSelected) {
      // 取消选中所有过滤结果
      const newValue = tempValue.filter(v => !filteredItems.some(item => item.value === v));
      setTempValue(newValue);
    } else {
      // 选中所有过滤结果（去重）
      const newValue = [...new Set([...tempValue, ...filteredItems.map(item => item.value)])];
      setTempValue(newValue);
    }
  };

  // 切换单个选项
  const handleToggleItem = (itemValue: string) => {
    if (tempValue.includes(itemValue)) {
      setTempValue(tempValue.filter(v => v !== itemValue));
    } else {
      setTempValue([...tempValue, itemValue]);
    }
  };


  // 按分组组织选项
  const groupedItems = useMemo(() => {
    if (groups.length === 0) {
      return { '': filteredItems };
    }

    const result: Record<string, typeof filteredItems> = { '': [] };

    filteredItems.forEach(item => {
      const groupId = item.group || '';
      if (!result[groupId]) {
        result[groupId] = [];
      }
      result[groupId]!.push(item);
    });

    return result;
  }, [filteredItems, groups]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <Button
          variant="ghost"
          size={triggerSize}
          disabled={disabled}
          className="tool-selector-trigger"
        >
          <Flex align="center" gap="2">
            <PencilRuler size={14} />
            <Text>{placeholder} ({value.length})</Text>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Flex>
        </Button>
      </Popover.Trigger>

      <Popover.Content width="50vw">
        <Flex direction="column" gap="3">
          {/* 标题和关闭 */}
          <Flex justify="between" align="center">
            <Text size="3" weight="bold">{title}</Text>
            <Popover.Close>
              <Button variant="ghost" size="1">
                <X size={14} />
              </Button>
            </Popover.Close>
          </Flex>

          {/* 搜索框 */}
          <TextField.Root
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          >
            <TextField.Slot side="left">
              <Search size={14} />
            </TextField.Slot>
            {searchQuery && (
              <TextField.Slot side="right">
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                >
                  <X size={14} />
                </button>
              </TextField.Slot>
            )}
          </TextField.Root>

          <Separator size="2" />

          {/* 全选 */}
          <Flex
            align="center"
            gap="2"
            px="2"
            py="2"
            style={{ cursor: 'pointer' }}
            onClick={handleToggleAll}
          >
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              style={{ pointerEvents: 'none' }}
            />
            <Text size="2" weight="medium">
              {selectAllLabel} ({filteredItems.length})
            </Text>
          </Flex>

          <Separator size="2" />

          {/* 选项列表（可滚动） */}
          <ScrollAreaPrimitive.Root type="auto" style={{ maxHeight: '50vh' }}>
            <ScrollAreaPrimitive.Viewport>
              <Flex direction="column" gap="3" px="2">
            {Object.entries(groupedItems).map(([groupId, groupItems]) => {
              // 跳过空分组
              if (!groupItems || groupItems.length === 0) return null;

              const group = groups.find(g => g.id === groupId);

              return (
                <Flex key={groupId} direction="column" gap="2">
                  {/* 分组标题 */}
                  {group && (
                    <>
                      <Text size="1" weight="bold" color="gray">
                        {group.label}
                      </Text>
                      {group.description && (
                        <Text size="1" color="gray">
                          {group.description}
                        </Text>
                      )}
                    </>
                  )}

                  {/* 分组内的选项 */}
                  <Flex direction="column" gap="1">
                    {groupItems.map((item) => {
                      const isSelected = tempValue.includes(item.value);

                      return (
                        <Flex
                          key={item.value}
                          align="start"
                          gap="3"
                          py="2"
                          style={{
                            borderRadius: 'var(--radius-2)',
                            cursor: item.disabled ? 'not-allowed' : 'pointer',
                            backgroundColor: isSelected ? 'var(--gray-a4)' : 'transparent',
                            opacity: item.disabled ? 0.5 : 1,
                            transition: 'background-color 150ms',
                          }}
                          onClick={() => !item.disabled && handleToggleItem(item.value)}
                        >
                          <Checkbox checked={isSelected} disabled={item.disabled} style={{ marginTop: '2px' }} />
                          <Flex direction="column" gap="0">
                            <Flex align="center" gap="2">
                              {item.icon}
                              <Text size="2" weight="medium">
                                {item.label}
                              </Text>
                            </Flex>
                            {item.description && (
                              <Text size="1" color="gray">
                                {item.description}
                              </Text>
                            )}
                          </Flex>
                        </Flex>
                      );
                    })}
                  </Flex>
                </Flex>
              );
            })}

            {/* 无结果提示 */}
            {filteredItems.length === 0 && (
              <Flex justify="center" align="center" py="6">
                <Text size="2" color="gray">
                  {noResultsText}
                </Text>
              </Flex>
            )}
              </Flex>
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.Scrollbar orientation="horizontal" style={{ height: '8px' }}>
              <ScrollAreaPrimitive.Thumb style={{ backgroundColor: 'var(--gray-a7)', borderRadius: '4px' }} />
            </ScrollAreaPrimitive.Scrollbar>
            <ScrollAreaPrimitive.Scrollbar orientation="vertical" style={{ width: '8px' }}>
              <ScrollAreaPrimitive.Thumb style={{ backgroundColor: 'var(--gray-a7)', borderRadius: '4px' }} />
            </ScrollAreaPrimitive.Scrollbar>
            <ScrollAreaPrimitive.Corner />
          </ScrollAreaPrimitive.Root>

          {/* 底部统计 */}
          <Separator size="2" />
          <Flex justify="center" align="center" py="2">
            <Text size="1" color="gray">
              {selectedCountText(tempValue.length, items.length)}
            </Text>
          </Flex>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
}
