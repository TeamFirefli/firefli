import { useState, useEffect } from "react";
import { IconPin, IconPencil, IconCheck, IconPlus, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/router";
import axios from "axios";
import toast from "react-hot-toast";

interface Section {
  title: string;
  content: string;
}

interface Announcement {
  title: string;
  subtitle?: string;
  sections: Section[];
  editorUsername?: string | null;
  editorPicture?: string | null;
  isDefault?: boolean;
}

const BG_COLORS = [
  "bg-amber-200", "bg-red-300", "bg-lime-200", "bg-emerald-300",
  "bg-rose-200", "bg-green-100", "bg-teal-200", "bg-yellow-200",
  "bg-red-100", "bg-green-300", "bg-lime-300", "bg-emerald-200",
  "bg-rose-300", "bg-amber-300", "bg-red-200", "bg-green-200",
];

function getRandomBg(username: string) {
  let hash = 5381;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash) ^ username.charCodeAt(i);
  }
  return BG_COLORS[(hash >>> 0) % BG_COLORS.length];
}

const defaultAnnouncement: Announcement = {
  title: "Firefli",
  subtitle: "Aloha and welcome to your Firefli workspace!",
  sections: [
    {
      title: "👋 Getting started",
      content: "We're excited to have you here! Your workspace is ready to use and fully customisable.",
    },
    {
      title: "❓ Need help?",
      content: "Click the Help icon in your sidebar for documentation and helpful resources.",
    },
  ],
  editorUsername: null,
  editorPicture: null,
  isDefault: true,
};

const StickyWidget: React.FC = () => {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement>(defaultAnnouncement);
  const [editData, setEditData] = useState<Announcement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!router.query.id) return;
    axios
      .get(`/api/workspace/${router.query.id}/announcement`)
      .then((res) => {
        if (res.data.success) {
          setAnnouncement(res.data.announcement);
          setCanEdit(res.data.canEdit);
        }
      })
      .catch(() => {});
  }, [router.query.id]);

  const handleSave = async () => {
    if (!editData) return;
    setIsSaving(true);
    try {
      const res = await axios.post(
        `/api/workspace/${router.query.id}/announcement/update`,
        { title: editData.title, subtitle: editData.subtitle, sections: editData.sections }
      );
      if (res.data.success) {
        setAnnouncement(res.data.announcement);
        setIsEditing(false);
        setEditData(null);
        toast.success("Announcement updated!");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSection = (i: number, field: "title" | "content", val: string) => {
    if (!editData) return;
    const s = [...editData.sections];
    s[i] = { ...s[i], [field]: val };
    setEditData({ ...editData, sections: s });
  };

  const display = isEditing ? editData : announcement;
  if (!display) return null;

  const isCustom = !announcement.isDefault && announcement.editorUsername;
  const avatarBg = isCustom && announcement.editorUsername
    ? getRandomBg(announcement.editorUsername)
    : "bg-primary";

  if (isEditing && editData) {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 block">Title</label>
          <input
            className="w-full text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={editData.title}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 block">Subtitle</label>
          <input
            className="w-full text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={editData.subtitle || ""}
            onChange={(e) => setEditData({ ...editData, subtitle: e.target.value })}
          />
        </div>
        {editData.sections.map((section, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Section {i + 1}</span>
              {editData.sections.length > 1 && (
                <button
                  onClick={() => {
                    const s = editData.sections.filter((_, idx) => idx !== i);
                    setEditData({ ...editData, sections: s });
                  }}
                  className="text-red-400 hover:text-red-600"
                >
                  <IconTrash className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <input
              className="w-full text-xs rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="Section title"
              value={section.title}
              onChange={(e) => updateSection(i, "title", e.target.value)}
            />
            <textarea
              className="w-full text-xs rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              placeholder="Section content"
              rows={3}
              value={section.content}
              onChange={(e) => updateSection(i, "content", e.target.value)}
            />
          </div>
        ))}
        <button
          onClick={() => setEditData({ ...editData, sections: [...editData.sections, { title: "", content: "" }] })}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <IconPlus className="w-3.5 h-3.5" /> Add section
        </button>
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            <IconCheck className="w-3 h-3" />
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => { setIsEditing(false); setEditData(null); }}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-600 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className={`w-9 h-9 rounded-full ${avatarBg} flex-shrink-0 flex items-center justify-center overflow-hidden`}>
        {isCustom && announcement.editorPicture ? (
          <img src={announcement.editorPicture} alt={announcement.editorUsername || ""} className="w-full h-full object-cover" />
        ) : (
          <img src="/stickylogo.png" alt="Firefli" className="w-5 h-5 object-contain" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <div className="flex items-center gap-1.5">
              <IconPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">{display.title}</span>
            </div>
            {display.subtitle && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{display.subtitle}</p>
            )}
          </div>
          {canEdit && (
            <button
              onClick={() => { setEditData({ ...announcement }); setIsEditing(true); }}
              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors flex-shrink-0"
              title="Edit announcement"
            >
              <IconPencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-2 mt-2">
          {display.sections.map((section, i) => (
            <div key={i}>
              {section.title && (
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-0.5">{section.title}</p>
              )}
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StickyWidget;
