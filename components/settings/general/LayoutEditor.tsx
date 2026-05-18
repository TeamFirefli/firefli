"use client";

import React, { useState, useEffect } from "react";
import ReactGridLayout, { WidthProvider } from "react-grid-layout/legacy";
import { IconGripVertical } from "@tabler/icons-react";
const GridLayout = WidthProvider(ReactGridLayout);

interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

interface LayoutEditorProps {
  layout: WidgetLayout[];
  onLayoutChange: (layout: WidgetLayout[]) => void;
  widgetTitles: { [key: string]: string };
}

export default function LayoutEditor({ layout, onLayoutChange, widgetTitles }: LayoutEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400 py-8">
        Initialising layout editor...
      </div>
    );
  }

  const handleLayoutChange = (newLayout: readonly any[]) => {
    onLayoutChange(
      newLayout.map((l) => ({
        i: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        minW: 4,
        minH: 1,
      }))
    );
  };

  return (
    <GridLayout
      layout={layout}
      cols={12}
      rowHeight={60}
      isDraggable
      isResizable
      onDragStop={handleLayoutChange}
      onResizeStop={handleLayoutChange}
      margin={[8, 8]}
      containerPadding={[0, 0]}
      resizeHandles={["se", "sw", "ne", "nw"]}
    >
      {layout.map((item) => {
        if (!widgetTitles[item.i]) return null;

        return (
          <div
            key={item.i}
            className="bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-700 dark:to-zinc-800 rounded-lg border-2 border-zinc-300 dark:border-zinc-600 shadow-sm flex flex-col overflow-hidden"
          >
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-300 dark:border-zinc-600 bg-white/50 dark:bg-zinc-800/50 flex-shrink-0">
              <IconGripVertical className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate">
                {widgetTitles[item.i]}
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center p-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {item.w === 12 ? "Full width" :
                 item.w >= 9  ? "¾ width" :
                 item.w >= 8  ? "⅔ width" :
                 item.w >= 6  ? "½ width" :
                 "⅓ width"}
              </span>
            </div>
          </div>
        );
      })}
    </GridLayout>
  );
}
