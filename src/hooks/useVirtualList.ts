import { useState, useMemo, useCallback } from "react";
export function useVirtualList<T>(items: T[], containerHeight: number, itemHeight: number) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + Math.ceil(containerHeight / itemHeight) + 2, items.length);
  const visibleItems = useMemo(() => items.slice(startIndex, endIndex).map((item, i) => ({
    item, index: startIndex + i, style: { position: 'absolute' as const, top: (startIndex + i) * itemHeight, height: itemHeight, width: '100%' }
  })), [items, startIndex, endIndex, itemHeight]);
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop), []);
  return { visibleItems, totalHeight, onScroll, containerProps: { style: { height: containerHeight, overflow: 'auto' as const, position: 'relative' as const }, onScroll } };
}
