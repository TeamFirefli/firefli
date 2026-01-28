"use client";

import { useState, useEffect } from "react";
import {
  IconKey,
  IconTrash,
  IconCopy,
  IconPlus,
  IconCalendar,
  IconClock,
} from "@tabler/icons-react";
import axios from "axios";
import { useRouter } from "next/router";
import { Dialog } from "@headlessui/react";
import { motion } from "framer-motion";
import clsx from "clsx";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  createdBy: {
    userid: number;
    username: string;
    picture: string;
  } | null;
}

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

export const ApiKeys = ({ triggerToast }: { triggerToast: any }) => {
  const router = useRouter();
  const { id: workspaceId } = router.query;
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKeyData, setNewKeyData] = useState({
    name: "",
    expiresIn: "90days",
  });
  const [createdKey, setCreatedKey] = useState<{ key: string } | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, [workspaceId]);

  const fetchApiKeys = async () => {
    try {
      const { data } = await axios.get(
        `/api/workspace/${workspaceId}/settings/api-keys`
      );
      if (data.success) {
        setApiKeys(data.apiKeys);
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
      triggerToast.error("Failed to fetch API keys");
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    try {
      const { data } = await axios.post(
        `/api/workspace/${workspaceId}/settings/api-keys/create`,
        newKeyData
      );
      if (data.success) {
        setCreatedKey(data.apiKey);
        fetchApiKeys();
        triggerToast.success("API key created successfully");
      }
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const message = error.response.data?.error || "An error occurred";
        if (status === 400 || status === 500) {
          triggerToast.error(message);
          return;
        }
      }
      console.error("Error creating API key:", error);
      triggerToast.error("Failed to create API key");
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      const { data } = await axios.delete(
        `/api/workspace/${workspaceId}/settings/api-keys/${keyId}/delete`
      );
      if (data.success) {
        fetchApiKeys();
        triggerToast.success("API key deleted successfully");
        setIsDeleteModalOpen(false);
      }
    } catch (error) {
      console.error("Error deleting API key:", error);
      triggerToast.error("Failed to delete API key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    triggerToast.success("Copied to clipboard");
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
            API Keys
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage API keys for accessing workspace data programmatically
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={18} />
          Create API Key
        </button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          <IconKey size={48} className="mx-auto text-zinc-400 mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">
            No API keys created yet
          </p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2">
            Create an API key to start using the public API
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-medium text-zinc-900 dark:text-white">
                    {key.name}
                  </h4>
                  <code className="text-sm bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 px-2 py-1 rounded">
                    {key.key}
                  </code>
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400 flex-wrap">
                  <span className="flex items-center gap-1">
                    <IconCalendar size={14} />
                    Created {formatDate(key.createdAt)}
                  </span>
                  {key.expiresAt && (
                    <span className="flex items-center gap-1">
                      <IconClock size={14} />
                      Expires {formatDate(key.expiresAt)}
                    </span>
                  )}
                  {key.createdBy && (
                    <span className="flex items-center gap-1.5">
                      <div
                        className={`h-4 w-4 rounded-full flex items-center justify-center overflow-hidden ${getRandomBg(
                          key.createdBy.userid.toString()
                        )}`}
                      >
                        <img
                          src={key.createdBy.picture || "/default-avatar.jpg"}
                          alt={key.createdBy.username}
                          className="h-4 w-4 object-cover rounded-full border border-white"
                        />
                      </div>
                      Created by {key.createdBy.username}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedKey(key);
                  setIsDeleteModalOpen(true);
                }}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <IconTrash size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create API Key Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-key-title"
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden"
          >
            <div className="px-6 py-5 sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="h-12 w-12 rounded-lg bg-firefli flex items-center justify-center text-white shadow-md">
                    <IconKey size={24} />
                  </div>
                </div>

                <div className="flex-1">
                  <h2
                    id="api-key-title"
                    className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
                  >
                    {createdKey ? "API Key Created" : "Create API Key"}
                  </h2>
                  {!createdKey && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Create a new API key to access workspace data
                      programmatically.
                    </p>
                  )}
                </div>
              </div>

              {createdKey ? (
                <div className="mt-5">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                    <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                      Make sure to copy your API key now. You won't be able to
                      see it again!
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white dark:bg-zinc-900 dark:text-white p-2 rounded text-sm break-all">
                        {createdKey.key}
                      </code>
                      <button
                        onClick={() => copyToClipboard(createdKey.key)}
                        className="p-2 bg-firefli text-white rounded hover:bg-firefli/90 transition-colors"
                      >
                        <IconCopy size={18} />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setCreatedKey(null);
                      setNewKeyData({ name: "", expiresIn: "90days" });
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-firefli hover:bg-firefli/90 text-white font-medium shadow-md"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newKeyData.name) {
                      createApiKey();
                    }
                  }}
                  className="mt-5"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="sr-only" htmlFor="api-key-name">
                        Key Name
                      </label>
                      <input
                        id="api-key-name"
                        type="text"
                        value={newKeyData.name}
                        onChange={(e) =>
                          setNewKeyData({ ...newKeyData, name: e.target.value })
                        }
                        placeholder="e.g., Production API Key"
                        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-firefli/40"
                      />
                    </div>
                    <div>
                      <label className="sr-only" htmlFor="api-key-expiration">
                        Expiration
                      </label>
                      <select
                        id="api-key-expiration"
                        value={newKeyData.expiresIn}
                        onChange={(e) =>
                          setNewKeyData({
                            ...newKeyData,
                            expiresIn: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-firefli/40"
                      >
                        <option value="30days">30 days</option>
                        <option value="90days">90 days</option>
                        <option value="1year">1 year</option>
                        <option value="never">Never</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={!newKeyData.name}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-firefli hover:bg-firefli/90 text-white font-medium shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Create
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        setNewKeyData({ name: "", expiresIn: "90days" });
                      }}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100/90"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-sm rounded-lg bg-white dark:bg-zinc-800 p-6 shadow-xl">
            <Dialog.Title className="text-lg font-medium text-zinc-900 dark:text-white mb-4">
              Delete API Key
            </Dialog.Title>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Are you sure you want to delete "{selectedKey?.name}"?</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedKey && deleteApiKey(selectedKey.id)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};

ApiKeys.title = "API Keys";
