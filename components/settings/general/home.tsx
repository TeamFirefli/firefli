"use client";

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import type toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import { workspacestate } from "@/state";
import { FC } from "@/types/settingsComponent";
import {
  IconEdit,
  IconLayoutGrid,
  IconWorld,
  IconPlus,
  IconX,
  IconPhoto,
  IconTrash,
  IconCheck,
} from "@tabler/icons-react";

type props = {
  triggerToast: typeof toast;
  isSidebarExpanded?: boolean;
  hasResetActivityOnly?: boolean;
};

const home: FC<props> = ({ triggerToast }) => {
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [placeIds, setPlaceIds] = useState<string[]>([]);
  const [newId, setNewId] = useState("");
  const [gamesSaving, setGamesSaving] = useState(false);
  const [gamesLoaded, setGamesLoaded] = useState(false);

  useEffect(() => {
    if (!workspace.groupId) return;
    axios
      .get(`/api/workspace/${workspace.groupId}/settings/general/games`)
      .then((r) => {
        if (r.data.success) setPlaceIds((r.data.placeIds ?? []).map(String));
      })
      .catch(() => {})
      .finally(() => setGamesLoaded(true));
  }, [workspace.groupId]);

  const addPlaceId = () => {
    const id = newId.trim();
    if (!id || isNaN(Number(id)) || Number(id) <= 0) return;
    if (placeIds.includes(id)) return;
    if (placeIds.length >= 10) {
      triggerToast.error("Maximum 10 games allowed");
      return;
    }
    setPlaceIds((prev) => [...prev, id]);
    setNewId("");
  };

  const removePlaceId = (id: string) =>
    setPlaceIds((prev) => prev.filter((x) => x !== id));

  const saveGames = async () => {
    setGamesSaving(true);
    try {
      await axios.patch(
        `/api/workspace/${workspace.groupId}/settings/general/games`,
        {
          placeIds: placeIds.map(Number),
        },
      );
      triggerToast.success("Games saved!");
    } catch {
      triggerToast.error("Failed to save games");
    } finally {
      setGamesSaving(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerSaving, setBannerSaving] = useState(false);

  useEffect(() => {
    if (!workspace.groupId) return;
    axios
      .get(`/api/workspace/${workspace.groupId}/home/banner`)
      .then((res) => {
        if (typeof res.data.bannerImage === 'string') setBannerPreview(res.data.bannerImage);
      })
      .catch(() => {});
  }, [workspace.groupId]);

  const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      triggerToast.error("Image must be under 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const saveBanner = async (data: string | null) => {
    setBannerSaving(true);
    try {
      const res = await axios.patch(
        `/api/workspace/${workspace.groupId}/settings/general/banner`,
        { bannerImage: data },
      );
      if (res.data.success) {
        const path = res.data.bannerImage ?? null;
        setBannerPreview(path);
        setWorkspace((prev: any) => ({
          ...prev,
          settings: { ...prev.settings, bannerImage: path },
        }));
        triggerToast.success(data ? "Banner saved!" : "Banner removed!");
      }
    } catch {
      triggerToast.error("Failed to save banner.");
    } finally {
      setBannerSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
          <IconPhoto size={16} className="text-primary" />
          Home banner image
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          Displayed as a background behind the greeting on your home page. PNG,
          JPEG, WebP or GIF, under 5 MB.
        </p>

        {bannerPreview && (
          <div className={`relative overflow-hidden mb-3 h-32 bg-zinc-100 dark:bg-zinc-800 group${bannerPreview?.startsWith('data:') ? ' rounded-xl' : ''}`}>
            <img
              src={bannerPreview}
              alt="Banner preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-zinc-800 rounded-lg text-xs font-medium"
              >
                <IconPhoto size={13} /> Change
              </button>
              <button
                onClick={() => saveBanner(null)}
                disabled={bannerSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium disabled:opacity-60"
              >
                <IconTrash size={13} /> Remove
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleBannerFile}
        />

        <div className="flex gap-2 flex-wrap">
          {!bannerPreview && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-primary hover:text-primary transition-all text-sm font-medium"
            >
              <IconPhoto size={15} /> Upload Image
            </button>
          )}
          {bannerPreview?.startsWith("data:") && (
            <button
              onClick={() => saveBanner(bannerPreview)}
              disabled={bannerSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              <IconCheck size={15} />
              {bannerSaving ? "Saving…" : "Save Banner"}
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
          <IconWorld size={16} className="text-primary" />
          Games Widget: Place IDs
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          Add Roblox place IDs (from the game URL, e.g. roblox.com/games/
          <strong>1818</strong>) to show in the Games widget. Up to 10 games.
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Place ID (e.g. 1818)"
            value={newId}
            onChange={(e) => setNewId(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && addPlaceId()}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
          />
          <button
            onClick={addPlaceId}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <IconPlus size={15} /> Add
          </button>
        </div>

        {placeIds.length > 0 && (
          <div className="space-y-2 mb-3">
            {placeIds.map((id) => (
              <div
                key={id}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700"
              >
                <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
                  {id}
                </span>
                <button
                  onClick={() => removePlaceId(id)}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <IconX size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {gamesLoaded && (
          <button
            onClick={saveGames}
            disabled={gamesSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            <IconCheck size={15} />
            {gamesSaving ? "Saving…" : "Save Games"}
          </button>
        )}
      </div>
    </div>
  );
};

home.title = "Home";
export default home;
