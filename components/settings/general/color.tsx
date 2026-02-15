"use client";

import axios from "axios";
import type toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import { workspacestate } from "@/state";
import type { FC } from "@/types/settingsComponent";
import { IconCheck, IconPalette } from "@tabler/icons-react";
import clsx from "clsx";
import { useEffect, useState } from "react";

type SessionColors = {
  recurring: string;
  shift: string;
  training: string;
  event: string;
  other: string;
};

type props = {
  triggerToast: typeof toast;
  isSidebarExpanded: boolean;
};

const Color: FC<props> = ({ triggerToast, isSidebarExpanded }) => {
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [selectedColor, setSelectedColor] = useState<string>(
    workspace?.groupTheme || ""
  );
  const [customColor, setCustomColor] = useState<string>("#3498db");
  const [colorPickerTimeout, setColorPickerTimeout] = useState<NodeJS.Timeout | null>(null);
  const isFirefliApp = process.env.NEXT_PUBLIC_NEXTAUTH_URL === "https://app.firefli.net" || process.env.NEXT_PUBLIC_NEXTAUTH_URL === "https://ant.firefli.net";

  useEffect(() => {
    if (workspace?.groupTheme) {
      setSelectedColor(workspace.groupTheme);
      if (workspace.groupTheme.startsWith("custom-")) {
        const hexValue = workspace.groupTheme.replace("custom-", "");
        setCustomColor(`#${hexValue}`);
      }
    }
  }, [workspace?.groupTheme]);

  const updateColor = async (color: string) => {
    try {
      setSelectedColor(color);
      setWorkspace((prev) => ({
        ...prev,
        groupTheme: color,
      }));

      const rgbValue = getRGBFromTailwindColor(color);
      document.documentElement.style.setProperty("--group-theme", rgbValue);

      const res = await axios.patch(
        `/api/workspace/${workspace.groupId}/settings/general/color`,
        { color }
      );

      if (res.status === 200) {
        triggerToast.success("Workspace color updated successfully!");
      } else {
        triggerToast.error("Failed to update color.");
        handleRevert();
      }
    } catch (error) {
      triggerToast.error("Something went wrong.");
      handleRevert();
    }
  };

  const handleCustomColorChange = (hexColor: string) => {
    setCustomColor(hexColor);
    if (colorPickerTimeout) {
      clearTimeout(colorPickerTimeout);
    }
    const colorKey = `custom-${hexColor.replace("#", "")}`;
    setSelectedColor(colorKey);
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const rgbValue = `${r} ${g} ${b}`;
    document.documentElement.style.setProperty("--group-theme", rgbValue)
    const timeout = setTimeout(() => {
      updateCustomColor(hexColor);
    }, 500);
    setColorPickerTimeout(timeout);
  };

  const updateCustomColor = async (hexColor: string) => {
    try {
      const colorKey = `custom-${hexColor.replace("#", "")}`;
      setWorkspace((prev) => ({
        ...prev,
        groupTheme: colorKey,
      }));

      const res = await axios.patch(
        `/api/workspace/${workspace.groupId}/settings/general/color`,
        { color: colorKey }
      );

      if (res.status === 200) {
        triggerToast.success("Custom color saved!");
      } else {
        triggerToast.error("Failed to save custom color.");
        handleRevert();
      }
    } catch (error) {
      triggerToast.error("Something went wrong.");
      handleRevert();
    }
  };


  const handleRevert = () => {
    const previousColor = workspace?.groupTheme || "bg-pink-500";
    setSelectedColor(previousColor);
    setWorkspace((prev) => ({
      ...prev,
      groupTheme: previousColor,
    }));
    const rgbValue = getRGBFromTailwindColor(previousColor);
    document.documentElement.style.setProperty("--group-theme", rgbValue);
  };

  const colors = [
    "bg-pink-100",
    "bg-rose-100",
    "bg-orange-100",
    "bg-amber-100",
    "bg-lime-100",
    "bg-emerald-100",
    "bg-cyan-100",
    "bg-sky-100",
    "bg-indigo-100",
    "bg-purple-100",
    "bg-pink-400",
    "bg-rose-400",
    "bg-orange-400",
    "bg-amber-400",
    "bg-lime-400",
    "bg-emerald-400",
    "bg-cyan-400",
    "bg-sky-400",
    "bg-indigo-400",
    "bg-violet-400",
    "bg-pink-600",
    "bg-rose-600",
    "bg-orange-600",
    "bg-amber-600",
    "bg-lime-600",
    "bg-emerald-600",
    "bg-cyan-600",
    "bg-sky-600",
    "bg-indigo-600",
    "bg-violet-600",
  ];


  return (
    <div className="ml-0 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <IconPalette size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Workspace Theme
          </h3>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 text-left">
          Choose a color theme for your workspace
        </p>
        <div className="grid grid-cols-10 gap-3">
          {isFirefliApp ? (
            <>
              <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-dashed border-zinc-300 dark:border-zinc-600 hover:border-primary dark:hover:border-primary transition-all group">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                />
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{ backgroundColor: customColor }}
                />
                {selectedColor.startsWith("custom-") && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 rounded-lg pointer-events-none">
                    <IconCheck size={16} className="text-white" />
                  </div>
                )}
              </div>
              {colors.slice(1).map((color, i) => (
                <button
                  key={i}
                  onClick={() => updateColor(color)}
                  className={clsx(
                    "relative aspect-square rounded-lg transition-transform hover:scale-105 z-0",
                    color
                  )}
                >
                  {selectedColor === color && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 rounded-lg">
                      <IconCheck size={16} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </>
          ) : (
            colors.map((color, i) => (
              <button
                key={i}
                onClick={() => updateColor(color)}
                className={clsx(
                  "relative aspect-square rounded-lg transition-transform hover:scale-105 z-0",
                  color
                )}
              >
                {selectedColor === color && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 rounded-lg">
                    <IconCheck size={16} className="text-white" />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function getRGBFromTailwindColor(tw: any): string {
  const fallback = "236, 72, 153";
  if (!tw || typeof tw !== "string") {
    if (tw !== null && tw !== undefined) {
      console.warn("Invalid color value:", tw);
    }
    return fallback;
  }
  const colorName = tw.replace("bg-", "");

  if (colorName === "firefli") {
    return "0, 112, 240";
  }

  if (colorName.startsWith("custom-")) {
    const hex = colorName.replace("custom-", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `${r} ${g} ${b}`;
  }

  const colorMap: Record<string, string> = {
    "firefli": "52, 152, 219",
    "blue-500": "59, 130, 246",
    "red-500": "239, 68, 68",
    "red-700": "185, 28, 28",
    "green-500": "34, 197, 94",
    "green-600": "22, 163, 74",
    "yellow-500": "234, 179, 8",
    "orange-500": "249, 115, 22",
    "purple-500": "168, 85, 247",
    "pink-500": "236, 72, 153",
    "gray-500": "107, 114, 128",
  };

  return colorMap[colorName] || fallback;
}

Color.title = "Customise";

export default Color;
