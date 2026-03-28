"use client";

import axios from "axios";
import React, { useState, useMemo, useEffect } from "react";
import type toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import { workspacestate } from "@/state";
import { FC } from "@/types/settingsComponent";
import { IconCheck, IconLayoutGrid, IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import clsx from "clsx";
import dynamic from "next/dynamic";

// Dynamically import the layout editor to avoid SSR issues
const LayoutEditor = dynamic(() => import("./LayoutEditor"), { ssr: false });

type props = {
  triggerToast: typeof toast;
  isSidebarExpanded?: boolean;
  hasResetActivityOnly?: boolean;
};

export interface WidgetLayout {
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

const normaliseLayoutItem = (item: WidgetLayout): WidgetLayout => ({
  i: item.i,
  x: item.x,
  y: item.y,
  w: item.w,
  h: item.h,
  minW: item.minW,
  minH: item.minH,
  maxW: item.maxW,
  maxH: item.maxH,
});

const normaliseLayoutForWidgets = (layoutItems: WidgetLayout[], widgets: string[]) => {
  const layoutById = new Map(layoutItems.map((item) => [item.i, normaliseLayoutItem(item)]));
  return widgets
    .filter((widgetId) => layoutById.has(widgetId))
    .sort()
    .map((widgetId) => layoutById.get(widgetId)!);
};

const areStringArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

const areLayoutsEqual = (a: WidgetLayout[], b: WidgetLayout[]) => {
  if (a.length !== b.length) return false;
  return a.every((item, index) => JSON.stringify(item) === JSON.stringify(b[index]));
};

const Color: FC<props> = (props) => {
  const triggerToast = props.triggerToast;
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [showLayoutEditor, setShowLayoutEditor] = useState(false);
  const [initialWidgets, setInitialWidgets] = useState<string[]>(() =>
    Array.isArray(workspace.settings?.widgets) ? [...workspace.settings.widgets] : []
  );
  const [initialSavedLayout, setInitialSavedLayout] = useState<WidgetLayout[]>(() => {
    const widgets = Array.isArray(workspace.settings?.widgets)
      ? workspace.settings.widgets
      : [];
    const savedLayout = Array.isArray(workspace.settings?.layout)
      ? workspace.settings.layout
      : [];
    return normaliseLayoutForWidgets(savedLayout, widgets);
  });

  useEffect(() => {
    const widgets = Array.isArray(workspace.settings?.widgets)
      ? workspace.settings.widgets
      : [];
    const savedLayout = Array.isArray(workspace.settings?.layout)
      ? workspace.settings.layout
      : [];

    setInitialWidgets([...widgets]);
    setInitialSavedLayout(normaliseLayoutForWidgets(savedLayout, widgets));
  }, [workspace.groupId]);

  const initialLayout = useMemo(() => {
    const widgets = Array.isArray(workspace.settings?.widgets)
      ? workspace.settings.widgets
      : [];
    const savedLayout = Array.isArray(workspace.settings?.layout)
      ? workspace.settings.layout
      : [];

    const savedByWidget = new Map(savedLayout.map((item: WidgetLayout) => [item.i, item]));

    return widgets.map((widget: string, index: number) => {
      const existing = savedByWidget.get(widget);
      return {
        i: widget,
        x: (index % 2) * 6,
        y: Math.floor(index / 2) * 4,
        w: existing?.w || 6,
        h: existing?.h || 4,
        minW: existing?.minW || 4,
        minH: existing?.minH || 3,
        maxW: existing?.maxW,
        maxH: existing?.maxH,
      };
    });
  }, [workspace.settings?.layout, workspace.settings?.widgets]);

  const [layout, setLayout] = useState<WidgetLayout[]>(initialLayout);
  useEffect(() => {
    setLayout(initialLayout);
  }, [initialLayout]);

  const hasUnsavedChanges = useMemo(() => {
    const currentWidgets = Array.isArray(workspace.settings?.widgets)
      ? workspace.settings.widgets
      : [];

    if (!areStringArraysEqual(currentWidgets, initialWidgets)) {
      return true;
    }

    const normalisedCurrentLayout = normaliseLayoutForWidgets(layout, currentWidgets);
    return !areLayoutsEqual(normalisedCurrentLayout, initialSavedLayout);
  }, [workspace.settings?.widgets, layout, initialWidgets, initialSavedLayout]);

  const updateHome = async () => {
    if (!hasUnsavedChanges) {
      return;
    }

    try {
      const res = await axios.patch(
        `/api/workspace/${workspace.groupId}/settings/general/home`,
        {
          widgets: workspace.settings.widgets,
          layout: layout,
        }
      );
      if (res.status === 200) {
        const normalisedSavedLayout = normaliseLayoutForWidgets(layout, workspace.settings.widgets);
        // Update workspace state with new layout
        setWorkspace({
          ...workspace,
          settings: {
            ...workspace.settings,
            layout: layout,
          },
        });
        setInitialWidgets([...workspace.settings.widgets]);
        setInitialSavedLayout(normalisedSavedLayout);
        triggerToast.success("Updated home!");
      } else {
        triggerToast.error("Failed to update home.");
      }
    } catch (error) {
      triggerToast.error("Failed to update home.");
    }
  };

  const toggleAble: {
    [key: string]: string;
  } = {
    "Ongoing sessions": "sessions",
    "Latest wall messages": "wall",
    "Latest documents": "documents",
    "Inactivity Notices": "notices",
    "Upcoming Birthdays": "birthdays",
    "New Team Members": "new_members",
  };

  const toggle = (name: string) => {
    const widgetId = toggleAble[name];
    if (workspace.settings.widgets.includes(widgetId)) {
      const newLayout = layout.filter((item) => item.i !== widgetId);
      setLayout(newLayout);
      setWorkspace({
        ...workspace,
        settings: {
          ...workspace.settings,
          widgets: workspace.settings.widgets.filter(
            (widget) => widget !== widgetId
          ),
        },
      });
    } else {
      const newWidget: WidgetLayout = {
        i: widgetId,
        x: (layout.length % 2) * 6,
        y: Math.floor(layout.length / 2) * 4,
        w: 6,
        h: 4,
        minW: 4,
        minH: 3,
      };
      const newLayout = [...layout, newWidget];
      setLayout(newLayout);
      setWorkspace({
        ...workspace,
        settings: {
          ...workspace.settings,
          widgets: [...workspace.settings.widgets, widgetId],
        },
      });
    }
  };

  const moveWidget = (widgetId: string, direction: "up" | "down") => {
    const currentIndex = workspace.settings.widgets.indexOf(widgetId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= workspace.settings.widgets.length) return;

    const newWidgets = [...workspace.settings.widgets];
    [newWidgets[currentIndex], newWidgets[newIndex]] = [newWidgets[newIndex], newWidgets[currentIndex]];
    const layoutById = new Map(layout.map((item) => [item.i, item]));
    const newLayout = [...layout];
    const reorderedLayout = newWidgets
      .map((id) => layoutById.get(id))
      .filter((item): item is WidgetLayout => Boolean(item));

    setWorkspace({
      ...workspace,
      settings: {
        ...workspace.settings,
        widgets: newWidgets,
      },
    });
    setLayout(reorderedLayout.length > 0 ? reorderedLayout : newLayout);
  };

  const changeWidgetSize = (widgetId: string, width: number) => {
    const newLayout = layout.map(item => {
      if (item.i === widgetId) {
        return { ...item, w: width };
      }
      return item;
    });
    setLayout(newLayout);
  };

  const widgetSizes = [
    { label: 'Small', value: 4, cols: '4 cols' },
    { label: 'Medium', value: 6, cols: '6 cols' },
    { label: 'Large', value: 8, cols: '8 cols' },
    { label: 'Full', value: 12, cols: '12 cols' },
  ];

  const handleLayoutChange = (newLayout: any[]) => {
    setLayout(newLayout.map((item: any) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
      maxW: item.maxW,
      maxH: item.maxH,
    })));
  };

  const widgetTitles: { [key: string]: string } = {
    sessions: "Ongoing Sessions",
    wall: "Wall Messages",
    documents: "Documents",
    notices: "Inactivity Notices",
    birthdays: "Birthdays",
    new_members: "New Members",
  };

  return (
    <div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        Customise what appears on your workspace home page. Tiles will only be
        shown to users with the corresponding permissions.
      </p>

      {/* Widget Selection */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
          Home Widgets
        </h3>

        {workspace.settings.widgets.length > 1 && (
          <details className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-white flex items-center justify-between">
              <span>Order & Size Widgets</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Expand</span>
            </summary>
            <div className="px-3 pb-3 space-y-2">
              {workspace.settings.widgets.map((widgetId, index) => {
                const widgetName = Object.keys(toggleAble).find(
                  (key) => toggleAble[key] === widgetId
                );
                if (!widgetName) return null;
                const currentWidth = layout.find((l) => l.i === widgetId)?.w || 6;

                return (
                  <div
                    key={`order-${widgetId}`}
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-700 dark:text-zinc-200">
                        {index + 1}. {widgetName}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveWidget(widgetId, "up")}
                          disabled={index === 0}
                          className={clsx(
                            "p-1 rounded transition-colors",
                            index === 0
                              ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          )}
                          title="Move up"
                        >
                          <IconChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => moveWidget(widgetId, "down")}
                          disabled={index === workspace.settings.widgets.length - 1}
                          className={clsx(
                            "p-1 rounded transition-colors",
                            index === workspace.settings.widgets.length - 1
                              ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          )}
                          title="Move down"
                        >
                          <IconChevronDown size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">Size</span>
                      <div className="flex flex-wrap gap-1">
                        {widgetSizes.map((size) => (
                          <button
                            key={`${widgetId}-${size.value}`}
                            onClick={() => changeWidgetSize(widgetId, size.value)}
                            className={clsx(
                              "px-2 py-1 text-xs rounded transition-colors",
                              currentWidth === size.value
                                ? "bg-primary text-white"
                                : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                            )}
                            title={size.cols}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}
        
        <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 p-3">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
            Select Widgets
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.keys(toggleAble).map((key, i) => {
              const widgetId = toggleAble[key];
              const isSelected = workspace.settings.widgets.includes(widgetId);

              return (
                <button
                  key={i}
                  onClick={() => toggle(key)}
                  className={clsx(
                    "flex items-center justify-between p-2 rounded-lg border transition-colors",
                    isSelected
                      ? "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:border-red-300 dark:hover:border-red-700"
                      : "border-gray-200 dark:border-zinc-700 dark:text-white hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                >
                  <span className="text-sm">{key}</span>
                  <span className={clsx("text-xs", isSelected ? "text-red-600 dark:text-red-400" : "text-zinc-500")}>
                    {isSelected ? "Remove" : "+ Add"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Layout Editor Toggle */}
      {workspace.settings.widgets.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowLayoutEditor(!showLayoutEditor)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
              showLayoutEditor
                ? "border-primary bg-primary/5 text-primary dark:text-white"
                : "border-gray-200 dark:border-zinc-700 dark:text-white hover:border-gray-300 dark:hover:border-gray-600"
            )}
          >
            <IconLayoutGrid size={18} />
            <span className="text-sm font-medium">
              {showLayoutEditor ? "Hide" : "Show"} Layout Preview
            </span>
          </button>
        </div>
      )}

      {/* Layout Editor */}
      {showLayoutEditor && workspace.settings.widgets.length > 0 && (
        <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
              Layout Preview
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              This shows how your selected widgets will appear on the home page
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
              ⚠️ Early testing - please report any bugs you encounter
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 min-h-[400px] border border-zinc-200 dark:border-zinc-700">
            <LayoutEditor
              layout={layout}
              onLayoutChange={handleLayoutChange}
              widgetTitles={widgetTitles}
            />
          </div>
        </div>
      )}

      <div className="mt-4">
        <button
          onClick={updateHome}
          disabled={!hasUnsavedChanges}
          className={clsx(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            !hasUnsavedChanges
              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
              : workspace.groupTheme === "bg-firefli"
              ? "bg-firefli text-white hover:bg-firefli/90"
              : workspace.groupTheme === "bg-blue-500"
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : workspace.groupTheme === "bg-red-500"
              ? "bg-red-500 text-white hover:bg-red-600"
              : workspace.groupTheme === "bg-red-700"
              ? "bg-red-700 text-white hover:bg-red-800"
              : workspace.groupTheme === "bg-green-500"
              ? "bg-green-500 text-white hover:bg-green-600"
              : workspace.groupTheme === "bg-green-600"
              ? "bg-green-600 text-white hover:bg-green-700"
              : workspace.groupTheme === "bg-yellow-500"
              ? "bg-yellow-500 text-white hover:bg-yellow-600"
              : workspace.groupTheme === "bg-orange-500"
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : workspace.groupTheme === "bg-purple-500"
              ? "bg-purple-500 text-white hover:bg-purple-600"
              : workspace.groupTheme === "bg-pink-500"
              ? "bg-pink-500 text-white hover:bg-pink-600"
              : workspace.groupTheme === "bg-black"
              ? "bg-black text-white hover:bg-zinc-900"
              : "bg-zinc-500 text-white hover:bg-zinc-600"
          )}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

Color.title = "Home";

export default Color;