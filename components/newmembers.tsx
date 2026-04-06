import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import axios from "axios";
import {
  IconUserPlus,
  IconPlayerPlay,
  IconPlayerPause,
  IconPencil,
} from "@tabler/icons-react";
import MemberIntroEditor from "./introductions";

interface NewMember {
  userid: string;
  username: string;
  picture?: string | null;
  joinDate: string;
  introMessage?: string | null;
  trackId?: string | null;
  trackName?: string | null;
  artistName?: string | null;
  artwork?: string | null;
  previewUrl?: string | null;
}

const BG_COLORS = [
  "bg-amber-200",
  "bg-red-300",
  "bg-lime-200",
  "bg-emerald-300",
  "bg-rose-200",
  "bg-green-100",
  "bg-teal-200",
  "bg-yellow-200",
  "bg-red-100",
  "bg-green-300",
  "bg-lime-300",
  "bg-emerald-200",
  "bg-rose-300",
  "bg-amber-300",
  "bg-red-200",
  "bg-green-200",
];


function getRandomBg(userid: string, username?: string) {
  const key = `${userid ?? ""}:${username ?? ""}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) ^ key.charCodeAt(i);
  }
  const index = (hash >>> 0) % BG_COLORS.length;
  return BG_COLORS[index];
}

export default function NewToTeam() {
  const router = useRouter();
  const { id: workspaceId } = router.query;
  const [members, setMembers] = useState<NewMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    axios
      .get("/api/@me")
      .then((r) => {
        if (r.data.user?.userId) {
          setCurrentUserId(String(r.data.user.userId));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    axios
      .get(`/api/workspace/${workspaceId}/home/new-members?days=7`)
      .then((r) => {
        if (r.status === 200 && r.data.success) {
          let membersList = r.data.members || [];
          if (currentUserId) {
            const idx = membersList.findIndex(
              (m: NewMember) => m.userid === currentUserId,
            );
            if (idx > 0) {
              const cu = membersList[idx];
              membersList = [
                cu,
                ...membersList.filter((_: any, i: number) => i !== idx),
              ];
            }
          }
          setMembers(membersList);
        }
      })
      .finally(() => setLoading(false));
  }, [workspaceId, currentUserId]);

  const refreshMembers = () => {
    if (!workspaceId) return;
    axios
      .get(`/api/workspace/${workspaceId}/home/new-members?days=7`)
      .then((r) => {
        if (r.status === 200 && r.data.success) {
          let membersList = r.data.members || [];
          if (currentUserId) {
            const idx = membersList.findIndex(
              (m: NewMember) => m.userid === currentUserId,
            );
            if (idx > 0) {
              const cu = membersList[idx];
              membersList = [
                cu,
                ...membersList.filter((_: any, i: number) => i !== idx),
              ];
            }
          }
          setMembers(membersList);
        }
      });
  };

  const playScratch = (reverse = false) => {
    try {
      const audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const duration = 0.35;
      const bufferSize = audioContext.sampleRate * duration;
      const buffer = audioContext.createBuffer(
        1,
        bufferSize,
        audioContext.sampleRate,
      );
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize;
        const freq = 350 * (1 - t * 0.6);
        const noise = (Math.random() * 2 - 1) * 0.4;
        const tone =
          Math.sin(2 * Math.PI * freq * (i / audioContext.sampleRate)) * 0.4;
        const envelope = Math.exp(-t * 4);
        data[i] = (noise + tone) * envelope;
      }

      if (reverse) {
        const reversedData = new Float32Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
          reversedData[i] = data[bufferSize - 1 - i];
        }
        data.set(reversedData);
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      const filter = audioContext.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1200;
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.5;
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start();
    } catch (e) {
      // not av
    }
  };

  const playPreview = (member: NewMember) => {
    if (playingId === member.userid) {
      playScratch();
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current && playingId !== null) {
      playScratch();
      audioRef.current.pause();
    }

    if (member.previewUrl) {
      const previewUrl = member.previewUrl;
      playScratch(true);
      setTimeout(() => {
        const audio = new Audio(previewUrl);
        audio.volume = 0.5;
        audio.play().catch(() => {
          console.log("Preview playback failed");
        });
        audio.onended = () => {
          playScratch();
          setPlayingId(null);
        };
        audioRef.current = audio;
        setPlayingId(member.userid);
      }, 200);
    }
  };

  const handleCardClick = (member: NewMember) => {
    const isCurrentUser = currentUserId && member.userid === currentUserId;
    if (isCurrentUser) {
      setShowEditor(true);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  if (loading) return null;

  if (!members.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <IconUserPlus className="w-8 h-8 text-primary" />
        </div>
        <p className="text-lg font-medium text-zinc-900 dark:text-white mb-1">No new members</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No new members in the last 7 days</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-visible">
        <div className="flex gap-6 overflow-x-auto overflow-y-visible pb-4 px-1 -mx-1 sm:mx-0 sm:overflow-visible touch-pan-x">
          {members.map((m) => {
            const isCurrentUser = currentUserId && m.userid === currentUserId;
            const isPlaying = playingId === m.userid;

            return (
              <div
                key={m.userid}
                className={`relative flex flex-col items-center shrink-0 group ${isCurrentUser ? "cursor-pointer" : ""}`}
                onClick={() => isCurrentUser && handleCardClick(m)}
              >
                <div className="relative p-1">
                  <img
                    src={m.picture || `/api/workspace/[id]/avatar/${m.userid}`}
                    alt={m.username}
                    className={`w-20 h-20 ${getRandomBg(m.userid)} rounded-full object-cover border-2 shadow transition-all hover:border-blue-500 ring-2 hover:ring-blue-300`}
                    onError={(e) => { (e.target as HTMLImageElement).src = "/default-avatar.jpg"; }}
                  />

                  {isCurrentUser && (
                    <div className="absolute top-0 right-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center z-10 border-2 border-white dark:border-zinc-800">
                      <IconPencil className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}

                  {(m.trackId || m.introMessage) && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20">
                      <div className="relative flex items-center">
                        {m.trackId && m.previewUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playPreview(m);
                            }}
                            className="absolute -left-2 z-10 shrink-0"
                            title={`${m.trackName} - ${m.artistName}`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full overflow-hidden shadow-md border-2 border-white dark:border-zinc-800 ${isPlaying ? "animate-spin-slow" : ""}`}
                            >
                              {m.artwork ? (
                                <img
                                  src={m.artwork}
                                  alt={m.trackName || "Song"}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
                              )}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                            </div>
                            <div
                              className={`absolute inset-0 rounded-full bg-black/40 flex items-center justify-center transition-opacity ${isPlaying ? "opacity-100" : "opacity-0 hover:opacity-100"}`}
                            >
                              {isPlaying ? (
                                <IconPlayerPause className="w-3 h-3 text-white" />
                              ) : (
                                <IconPlayerPlay className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </button>
                        )}
                        <div
                          className={`px-2 py-1 rounded-full shadow-md text-[10px] ${m.trackId ? "pl-5" : ""} ${
                            isPlaying
                              ? "bg-zinc-100 dark:bg-zinc-700 dark:text-white text-zinc-700 ring-2 ring-primary"
                              : "bg-zinc-100 dark:bg-zinc-600 dark:text-white text-zinc-700"
                          }`}
                        >
                          {m.introMessage ? (
                            <span className="italic truncate max-w-[80px] text-zinc-700 dark:text-white block">
                              "{m.introMessage}"
                            </span>
                          ) : m.trackName ? (
                            <span className="truncate max-w-[70px] text-zinc-700 dark:text-white block">
                              ♪ {m.trackName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <span className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 text-center max-w-[90px] truncate">
                  {m.username}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {showEditor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
            style={{ zIndex: 999999 }}
            onClick={() => {
              setShowEditor(false);
              refreshMembers();
            }}
          >
            <div
              className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 p-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                  Edit - Your introduction
                </h2>
                <button
                  onClick={() => {
                    setShowEditor(false);
                    refreshMembers();
                  }}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <MemberIntroEditor />
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fade-in 0.25s ease-out forwards;
        }
      `}</style>
    </>
  );
}
