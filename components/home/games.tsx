import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { IconWorld, IconUsers, IconPlayerPlay } from "@tabler/icons-react";

interface GameInfo {
  universeId: number;
  placeId: number;
  name: string;
  playing: number;
  visits: number;
  thumbnail: string | null;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const GamesWidget: React.FC = () => {
  const router = useRouter();
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!router.query.id) return;
    axios
      .get(`/api/workspace/${router.query.id}/home/games`)
      .then((res) => {
        if (res.data.success) setGames(res.data.games);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [router.query.id]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 @[400px]:grid-cols-3 @[650px]:grid-cols-4 @[900px]:grid-cols-6 gap-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-700 aspect-[3/2] @[650px]:aspect-[16/9] @[900px]:aspect-[16/7]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-4">
        Failed to load games
      </p>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <IconWorld className="w-8 h-8 text-primary" />
        </div>
        <p className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
          No games added
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Add Roblox place IDs in workspace settings
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto @[400px]:overflow-x-visible pb-1 @[400px]:pb-0">
    <div className="flex gap-2 @[400px]:grid @[400px]:grid-cols-3 @[650px]:grid-cols-4 @[900px]:grid-cols-6">
      {games.map((game) => (
        <div
          key={game.universeId}
          className="relative flex-none w-32 @[400px]:w-auto rounded-lg overflow-hidden aspect-[3/2] @[650px]:aspect-[16/9] @[900px]:aspect-[16/7] bg-zinc-800 shadow-sm group"
        >
          {game.thumbnail ? (
            <img
              src={game.thumbnail}
              alt={game.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-700">
              <IconWorld className="w-8 h-8 text-zinc-500" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-between p-2.5">
            <div className="self-end flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
              <IconUsers className="w-3 h-3 text-white/80" />
              <span className="text-xs text-white/80 font-medium">
                {formatNumber(game.playing)}
              </span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <p className="text-sm font-semibold text-white leading-tight line-clamp-2 drop-shadow">
                {game.name}
              </p>
              <a
                href={`roblox://experiences/start?placeId=${game.placeId}`}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <IconPlayerPlay className="w-3 h-3" fill="currentColor" />
                Play
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
    </div>
  );
};

export default GamesWidget;
