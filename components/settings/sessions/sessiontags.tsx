import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { IconTag, IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import toast from "react-hot-toast";

const SessionTags = () => {
  const router = useRouter();
  const [tags, setTags] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("bg-blue-500");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);

  const colorOptions = [
    { value: "bg-blue-500", label: "Blue" },
    { value: "bg-green-500", label: "Green" },
    { value: "bg-yellow-500", label: "Yellow" },
    { value: "bg-red-500", label: "Red" },
    { value: "bg-purple-500", label: "Purple" },
    { value: "bg-pink-500", label: "Pink" },
    { value: "bg-indigo-500", label: "Indigo" },
    { value: "bg-orange-500", label: "Orange" },
    { value: "bg-teal-500", label: "Teal" },
    { value: "bg-cyan-500", label: "Cyan" },
    { value: "bg-zinc-500", label: "Gray" },
  ];

  useEffect(() => {
    fetchTags();
  }, [router.query.id]);

  const fetchTags = async () => {
    if (!router.query.id) return;
    try {
      setIsLoading(true);
      const res = await axios.get(
        `/api/workspace/${router.query.id}/settings/activity/session-tags`,
      );
      if (res.data.success) {
        setTags(res.data.tags || []);
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
      toast.error("Failed to load session tags");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error("Tag name is required");
      return;
    }
    try {
      const res = await axios.post(
        `/api/workspace/${router.query.id}/settings/activity/session-tags`,
        {
          name: newTagName.trim(),
          color: newTagColor,
        },
      );
      if (res.data.success) {
        toast.success("Session tag created");
        setNewTagName("");
        setNewTagColor("bg-blue-500");
        setIsEditing(false);
        fetchTags();
      }
    } catch (error) {
      console.error("Failed to create tag:", error);
      toast.error("Failed to create session tag");
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !newTagName.trim()) {
      toast.error("Tag name is required");
      return;
    }
    try {
      const res = await axios.patch(
        `/api/workspace/${router.query.id}/settings/activity/session-tags`,
        {
          id: editingTag.id,
          name: newTagName.trim(),
          color: newTagColor,
        },
      );
      if (res.data.success) {
        toast.success("Session tag updated");
        setEditingTag(null);
        setNewTagName("");
        setNewTagColor("bg-blue-500");
        setIsEditing(false);
        fetchTags();
      }
    } catch (error) {
      console.error("Failed to update tag:", error);
      toast.error("Failed to update session tag");
    }
  };

  const handleDeleteTag = (tagId: string) => {
    setTagToDelete(tagId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!tagToDelete) return;

    try {
      const res = await axios.delete(
        `/api/workspace/${router.query.id}/settings/activity/session-tags`,
        {
          data: { id: tagToDelete },
        },
      );
      if (res.data.success) {
        toast.success("Session tag deleted");
        fetchTags();
      }
    } catch (error) {
      console.error("Failed to delete tag:", error);
      toast.error("Failed to delete session tag");
    } finally {
      setShowDeleteModal(false);
      setTagToDelete(null);
    }
  };

  const startEdit = (tag: any) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setNewTagName("");
    setNewTagColor("bg-blue-500");
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <IconTag size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Session Tags
          </h3>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create custom tags for sessions to categorise training types (e.g.,
          Store Colleague, Security, Management)
        </p>
      </div>

      {isEditing && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">
            {editingTag ? "Edit Tag" : "Create New Tag"}
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Tag Name
              </label>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="e.g., Store Colleague"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Color
              </label>
              <div className="grid grid-cols-6 gap-2">
                {colorOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setNewTagColor(option.value)}
                    className={`h-10 rounded-lg ${option.value} ${
                      newTagColor === option.value
                        ? "ring-2 ring-offset-2 ring-primary"
                        : ""
                    }`}
                    title={option.label}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={editingTag ? handleUpdateTag : handleCreateTag}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                {editingTag ? "Update" : "Create"}
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!isEditing && (
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <IconPlus size={18} />
          Add Tag
        </button>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
          Loading tags...
        </div>
      ) : tags.length === 0 ? (
        <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <IconTag size={48} className="mx-auto mb-3 text-zinc-400" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No session tags created yet. Add your first tag above!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`${tag.color} px-3 py-1 rounded text-sm font-medium text-white`}
                >
                  {tag.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(tag)}
                  className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors"
                  title="Edit tag"
                >
                  <IconPencil size={18} />
                </button>
                <button
                  onClick={() => handleDeleteTag(tag.id)}
                  className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors"
                  title="Delete tag"
                >
                  <IconTrash size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Confirm Deletion
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Are you sure you want to delete this tag?
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
              This will remove it from all sessions using it.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

SessionTags.title = "Session Tags";

export default SessionTags;
