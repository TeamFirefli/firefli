import axios from "axios";
import React, { useState } from "react";
import type toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import { workspacestate } from "@/state";
import Button from "@/components/button";
import type { document, user } from "@/utils/database";
import { useRouter } from "next/router";
import { IconChevronRight, IconFileText, IconAlertTriangle, IconExternalLink } from "@tabler/icons-react";
import { motion } from "framer-motion";

const BG_COLORS = [
  "bg-rose-300",
  "bg-lime-300",
  "bg-teal-200",
  "bg-amber-300",
  "bg-rose-200",
  "bg-lime-200",
  "bg-green-100",
  "bg-red-100",
  "bg-yellow-200",
  "bg-amber-200",
  "bg-emerald-300",
  "bg-green-300",
  "bg-red-300",
  "bg-emerald-200",
  "bg-green-200",
  "bg-red-200",
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

const Docs: React.FC = () => {
  const [docs, setDocs] = useState<
    (document & {
      owner: user;
    })[]
  >([]);
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const router = useRouter();
  React.useEffect(() => {
    axios.get(`/api/workspace/${router.query.id}/home/docs`).then((res) => {
      if (res.status === 200) {
        setDocs(res.data.docs);
      }
    });
  }, []);

  const goToDocs = () => {
    router.push(`/workspace/${router.query.id}/docs`);
  };

  const handleExternalLink = (url: string) => {
    setPendingUrl(url);
    setShowExternalLinkModal(true);
  };

  const proceedWithLink = () => {
    if (pendingUrl) {
      window.open(pendingUrl, "_blank");
    }
    setShowExternalLinkModal(false);
    setPendingUrl(null);
  };

  const cancelLink = () => {
    setShowExternalLinkModal(false);
    setPendingUrl(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <IconFileText className="w-8 h-8 text-primary" />
          </div>
          <p className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
            No documents yet
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Create your first document to get started
          </p>
          <button
            onClick={goToDocs}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            View Documents
            <IconChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {docs.slice(0, 3).map((document) => (
            <div
              key={document.id}
              className="bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                if (
                  document.content &&
                  typeof document.content === "object" &&
                  (document.content as any).external &&
                  (document.content as any).url
                ) {
                  handleExternalLink((document.content as any).url);
                  return;
                }
                router.push(
                  `/workspace/${router.query.id}/docs/${document.id}`
                );
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <IconFileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-white truncate">
                    {document.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center overflow-hidden ${getRandomBg(document.owner?.userid?.toString())}`}>
                      <img
                        src={document.owner?.picture || '/default-avatar.jpg'}
                        alt={`${document.owner?.username}'s avatar`}
                        className="h-6 w-6 object-cover rounded-full border-2 border-white"
                      />
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Created by {document.owner?.username}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={goToDocs}
            className="inline-flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            View all documents
            <IconChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* External Link Warning Modal */}
      {showExternalLinkModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="external-link-title"
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden"
          >
            <div className="px-6 py-5 sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md">
                    <IconAlertTriangle size={24} />
                  </div>
                </div>

                <div className="flex-1">
                  <h2 id="external-link-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    External Link Warning
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    This is a link submitted by a member in this workspace. Links are not verified by Firefli so please proceed at your own risk.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={proceedWithLink}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#ff0099] hover:bg-[#ff0099]/95 text-white font-medium shadow-md"
                >
                  <IconExternalLink size={18} />
                  Continue
                </button>

                <button
                  type="button"
                  onClick={cancelLink}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100/90"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Docs;
