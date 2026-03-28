"use client";

import React, { useState, useEffect } from "react";
import { IconGripVertical } from "@tabler/icons-react";

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

  // Show actual preview using 12-column grid system
  return (
    <div className="grid grid-cols-12 gap-4">
      {layout.map((item) => {
        if (!widgetTitles[item.i]) return null;

        const colSpanClass = 
          item.w === 12 ? 'col-span-12' :
          item.w === 8 ? 'col-span-8' :
          item.w === 6 ? 'col-span-6' :
          'col-span-4';
        
        return (
          <div
            key={item.i}
            className={`${colSpanClass} bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-700 dark:to-zinc-800 rounded-lg border-2 border-zinc-300 dark:border-zinc-600 shadow-sm p-4 min-h-[150px] flex items-center justify-center`}
          >
            <div className="text-center">
              <IconGripVertical className="w-6 h-6 mx-auto mb-2 text-zinc-400 dark:text-zinc-500" />
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {widgetTitles[item.i] || item.i}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {item.w === 12 ? 'Full Width' :
                 item.w === 8 ? 'Large (8 cols)' :
                 item.w === 6 ? 'Medium (6 cols)' :
                 'Small (4 cols)'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
