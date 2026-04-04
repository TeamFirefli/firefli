import type { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import Button from "@/components/button";
import Input from "@/components/input";
import Workspace from "@/layouts/workspace";
import { useRecoilState } from "recoil";
import { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import CodeBlock from "@tiptap/extension-code-block";
import Image from "@tiptap/extension-image";

const RichCodeBlock = CodeBlock.extend({ marks: 'bold italic underline' });
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: (attrs) => attrs.width ? { width: attrs.width } : {},
      },
    };
  },
});
import {
  IconCheck,
  IconChevronDown,
  IconH1,
  IconH2,
  IconH3,
  IconBold,
  IconItalic,
  IconUnderline,
  IconListDetails,
  IconListNumbers,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconAlignJustified,
  IconArrowLeft,
  IconLock,
  IconTrash,
  IconEdit,
  IconWorld,
  IconLink,
  IconCode,
  IconPhoto,
  IconMinus,
} from "@tabler/icons-react";
import { useRouter } from "next/router";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import axios from "axios";
import prisma from "@/utils/database";
import { useForm, FormProvider } from "react-hook-form";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import clsx from "clsx";
import { Toaster, toast } from "react-hot-toast";
import { motion } from "framer-motion";

function markdownToHtml(md: string): string {
  if (!md) return '<p></p>';
  let s = md;
  s = s.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  s = s.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/((?:^- .+$\n?)+)/gm, (match) => {
    const items = match.trim().split('\n')
      .map(l => `<li><p>${l.replace(/^- /, '')}</p></li>`)
      .join('');
    return `<ul>${items}</ul>`;
  });
  const parts = s.split(/\n{2,}/);
  return parts.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^<(h[1-6]|ul|ol|pre|blockquote)/.test(trimmed)) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
  }).filter(Boolean).join('');
}

export const getServerSideProps: GetServerSideProps = withPermissionCheckSsr(
  async (context) => {
    const { id, gid } = context.query;
    if (!gid) return { notFound: true };

    const user = await prisma.user.findFirst({
      where: { userid: BigInt(context.req.session.userid) },
      include: {
        roles: { where: { workspaceGroupId: Number(id) } },
        workspaceMemberships: {
          where: { workspaceGroupId: Number(id) },
          include: {
            departmentMembers: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    });

    const membership = user?.workspaceMemberships?.[0];
    const isAdmin = membership?.isAdmin || false;
    const canEdit = isAdmin || (user?.roles || []).some((r: any) => r.permissions?.includes("edit_docs"));
    const canDelete = isAdmin || (user?.roles || []).some((r: any) => r.permissions?.includes("delete_docs"));

    const [roles, departments, document] = await Promise.all([
      prisma.role.findMany({
        where: {
          workspaceGroupId: Number(id),
        },
        orderBy: {
          isOwnerRole: "desc",
        },
      }),
      prisma.department.findMany({
        where: {
          workspaceGroupId: Number(id),
        },
        select: {
          id: true,
          name: true,
          color: true,
        },
      }),
      prisma.document.findUnique({
        where: {
          id: gid as string,
        },
        include: {
          roles: true,
          departments: true,
        },
      }),
    ]);

    if (!document) return { notFound: true };

    return {
      props: {
        roles,
        departments: JSON.parse(
          JSON.stringify(departments, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ),
        document: JSON.parse(
          JSON.stringify(document, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ),
        canEdit,
        canDelete,
      },
    };
  },
  ["edit_docs", "delete_docs"]
);

const EditDoc: pageWithLayout<any> = ({ roles, departments, document, canEdit, canDelete }) => {
  const [login, setLogin] = useRecoilState(loginState);
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    document.roles.map((role: any) => role.id)
  );
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(
    document.departments ? document.departments.map((dept: any) => dept.id) : []
  );
  const [mode, setMode] = useState<"internal" | "external">(() => {
    if (document.content && (document.content as any).external)
      return "external";
    return "internal";
  });
  const convertNodeToMarkdown = (node: any): string => {
    if (!node) return "";
    switch (node.type) {
      case "doc":
        return (node.content || []).map(convertNodeToMarkdown).join("\n\n");
      case "paragraph":
        return (node.content || []).map(convertNodeToMarkdown).join("");
      case "heading": {
        const level = node.attrs?.level || 1;
        const text = (node.content || []).map(convertNodeToMarkdown).join("");
        return `${"#".repeat(level)} ${text}`;
      }
      case "text": {
        let txt = node.text || "";
        if (node.marks) {
          for (const mark of node.marks) {
            if (mark.type === "bold") txt = `**${txt}**`;
            if (mark.type === "italic") txt = `*${txt}*`;
            if (mark.type === "code") txt = `\`${txt}\``;
          }
        }
        return txt;
      }
      case "bulletList":
        return (node.content || [])
          .map((li: any) => {
            const inner = (li.content || [])
              .map(convertNodeToMarkdown)
              .join("");
            return `- ${inner}`;
          })
          .join("\n");
      case "orderedList":
        return (node.content || [])
          .map((li: any, idx: number) => {
            const inner = (li.content || [])
              .map(convertNodeToMarkdown)
              .join("");
            return `${idx + 1}. ${inner}`;
          })
          .join("\n");
      case "codeBlock":
        return (
          "\n\n```" +
          (node.content && node.content[0] ? node.content[0].text || "" : "") +
          "```\n\n"
        );
      case "blockquote":
        return (node.content || [])
          .map(convertNodeToMarkdown)
          .map((l: string) => `> ${l}`)
          .join("\n");
      case "hardBreak":
        return "\n";
      default:
        return (node.content || []).map(convertNodeToMarkdown).join("");
    }
  };

  const convertOldToMarkdown = (html: string): string => {
    if (!html) return "";
    let s = html;
    for (let i = 6; i >= 1; i--) {
      s = s.replace(
        new RegExp(`<h${i}[^>]*>([\s\S]*?)<\/h${i}>`, "gi"),
        (_m, p1) => `${"#".repeat(i)} ${p1.trim()}`
      );
    }
    s = s.replace(
      /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi,
      (_m, p1) => `**${p1.trim()}**`
    );
    s = s.replace(
      /<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi,
      (_m, p1) => `*${p1.trim()}*`
    );
    s = s.replace(
      /<a[^>]*href=["']?([^"' >]+)["']?[^>]*>([\s\S]*?)<\/a>/gi,
      (_m, href, text) => {
        return `[${text.trim()}](${href.trim()})`;
      }
    );
    s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner) => {
      return inner
        .replace(
          /<li[^>]*>([\s\S]*?)<\/li>/gi,
          (_mi: any, li: any) => `- ${li.trim()}`
        )
        .trim();
    });
    s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner) => {
      let idx = 1;
      return inner
        .replace(
          /<li[^>]*>([\s\S]*?)<\/li>/gi,
          (_mi: any, li: any) => `${idx++}. ${li.trim()}`
        )
        .trim();
    });
    s = s.replace(
      /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
      (_m, code) => `\n\n\`\`\`\n${code.replace(/<[^>]+>/g, "")}\n\`\`\`\n\n`
    );
    s = s.replace(
      /<code[^>]*>([\s\S]*?)<\/code>/gi,
      (_m, code) => "`" + code.replace(/<[^>]+>/g, "") + "`"
    );
    s = s.replace(/<br\s*\/?>(\s*)/gi, "\n");
    s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, p1) => `${p1.trim()}\n\n`);
    s = s.replace(/<[^>]+>/g, "");
    s = s.replace(/&nbsp;/g, " ");
    s = s.replace(/&amp;/g, "&");
    s = s.replace(/&lt;/g, "<");
    s = s.replace(/&gt;/g, ">");
    s = s.replace(/\n{3,}/g, "\n\n");
    return s.trim();
  };

  const initialMarkdown = (() => {
    if (typeof document.content === "string") {
      const s = String(document.content);
      const looksLikeHtml = /<[^>]+>/.test(s);
      if (looksLikeHtml) return convertOldToMarkdown(s);
      return s;
    }
    try {
      return convertNodeToMarkdown(document.content as any) || "";
    } catch (e) {
      return "";
    }
  })();

  const [externalUrl, setExternalUrl] = useState<string>(() =>
    document.content && (document.content as any).external
      ? (document.content as any).url || ""
      : ""
  );
  const [showRoles, setShowRoles] = useState(false);
  const [showDepartments, setShowDepartments] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showListDropdown, setShowListDropdown] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageWidth, setImageWidth] = useState("");
  const router = useRouter();
  const form = useForm({
    defaultValues: {
      name: document.name,
    },
  });

  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), Underline, TextAlign.configure({ types: ['heading', 'paragraph'] }), RichCodeBlock, ResizableImage.configure({ inline: false, allowBase64: false })],
    editable: canEdit,
    editorProps: {
      attributes: {
        class: "prose dark:prose-invert max-w-none focus:outline-none",
      },
    },
    content: (() => {
      if (document.content && typeof document.content === 'object' && !(document.content as any).external) {
        return document.content;
      }
      return markdownToHtml(initialMarkdown);
    })(),
  });

  const goback = () => {
    router.push(`/workspace/${workspace.groupId}/docs`);
  };

  const updateDoc = async () => {
    let content: any = null;
    if (mode === "external") {
      if (!externalUrl.trim()) {
        form.setError("name", {
          type: "custom",
          message: "External URL required",
        });
        return;
      }
      content = {
        external: true,
        url: externalUrl.trim(),
        title: form.getValues().name,
      };
    } else {
      content = editor?.getJSON() ?? null;
    }

    const session = await axios
      .post(
        `/api/workspace/${workspace.groupId}/guides/${document.id}/update`,
        {
          name: form.getValues().name,
          content,
          roles: selectedRoles,
          departments: selectedDepartments,
        }
      )
      .catch((err) => {
        form.setError("name", {
          type: "custom",
          message: err?.response?.data?.error || "Failed to update",
        });
      });
    if (!session) return;
    form.clearErrors();
    if (mode === "external") {
      toast.success("Saved");
      router.push(`/workspace/${workspace.groupId}/docs`);
    } else {
      toast.success("Saved");
      router.push(`/workspace/${workspace.groupId}/docs/${document.id}`);
    }
  };

  const toggleRole = async (role: string) => {
    setSelectedRoles((prevRoles) => {
      if (prevRoles.includes(role)) {
        return prevRoles.filter((r) => r !== role);
      } else {
        return [...prevRoles, role];
      }
    });
  };

  const toggleDepartment = async (deptId: string) => {
    setSelectedDepartments((prevDepts) => {
      if (prevDepts.includes(deptId)) {
        return prevDepts.filter((d) => d !== deptId);
      } else {
        return [...prevDepts, deptId];
      }
    });
  };

  const confirmDelete = async () => {
  if (!document.id) return;

  try {
    await axios.post(`/api/workspace/${workspace.groupId}/guides/${document.id}/delete`);
	toast.success("Deleted document!");
  } catch (e: any) {
    console.error(e);
    toast.error("Failed to delete document.");
  } finally {
    setShowDeleteModal(false);
    router.push(`/workspace/${workspace.groupId}/docs`);
  }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Toaster position="bottom-center" />
      <div className="pagePadding">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push(`/workspace/${workspace.groupId}/docs`)}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Go back"
          >
            <IconArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-1">
              Edit Document
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Update your workspace documentation
            </p>
          </div>
        </div>
        <FormProvider {...form}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <IconEdit className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      Document Information
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Basic details about your document
                    </p>
                  </div>
                </div>
                <Input
                  {...form.register("name", {
                    required: {
                      value: true,
                      message: "Document name is required",
                    },
                  })}
                  label="Document Name"
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 sticky top-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <IconLock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      Access Control
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Who can view this document
                    </p>
                  </div>
                </div>
                <div className="mb-2 relative">
                  <button
                    onClick={() => setShowRoles(!showRoles)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                    disabled={!canEdit}
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Roles
                      </h3>
                      {selectedRoles.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {selectedRoles.length}
                        </span>
                      )}
                    </div>
                    <IconChevronDown
                      className={`w-4 h-4 text-zinc-500 transition-transform ${showRoles ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {showRoles && (
                    <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto space-y-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 shadow-lg z-50">
                      {roles.map((role: any) => (
                        <label
                          key={role.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-all group"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRoles.includes(role.id)}
                            onChange={() => toggleRole(role.id)}
                            className="w-4 h-4 text-primary rounded border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                            disabled={!canEdit}
                          />
                          <span className="text-sm text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                            {role.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {departments && departments.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowDepartments(!showDepartments)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                      disabled={!canEdit}
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Departments
                        </h3>
                        {selectedDepartments.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {selectedDepartments.length}
                          </span>
                        )}
                      </div>
                      <IconChevronDown
                        className={`w-4 h-4 text-zinc-500 transition-transform ${showDepartments ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {showDepartments && (
                      <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto space-y-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 shadow-lg z-50">
                        {departments.map((dept: any) => (
                          <label
                            key={dept.id}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-all group"
                          >
                            <input
                              type="checkbox"
                              checked={selectedDepartments.includes(dept.id)}
                              onChange={() => toggleDepartment(dept.id)}
                              className="w-4 h-4 text-primary rounded border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                              disabled={!canEdit}
                            />
                            <span className="text-sm text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                              {dept.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {mode === "internal" && (
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                {canEdit && (
                  <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <button
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      className={`p-2 rounded-md transition-colors ${editor?.isActive('bold') ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                      aria-label="Bold"
                      title="Bold"
                    >
                      <IconBold className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                      className={`p-2 rounded-md transition-colors ${editor?.isActive('italic') ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                      aria-label="Italic"
                      title="Italic"
                    >
                      <IconItalic className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleUnderline().run()}
                      className={`p-2 rounded-md transition-colors ${editor?.isActive('underline') ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                      aria-label="Underline"
                      title="Underline"
                    >
                      <IconUnderline className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-600" />
                    <button
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                      className={`p-2 rounded-md transition-colors ${editor?.isActive('heading', { level: 1 }) ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                      aria-label="Heading 1"
                      title="Heading 1"
                    >
                      <IconH1 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                      className={`p-2 rounded-md transition-colors ${editor?.isActive('heading', { level: 2 }) ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                      aria-label="Heading 2"
                      title="Heading 2"
                    >
                      <IconH2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                      className={`p-2 rounded-md transition-colors ${editor?.isActive('heading', { level: 3 }) ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                      aria-label="Heading 3"
                      title="Heading 3"
                    >
                      <IconH3 className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-600" />
                    <div className="relative">
                      <button
                        onClick={() => setShowListDropdown(!showListDropdown)}
                        className={`p-2 rounded-md transition-colors flex items-center gap-0.5 ${editor?.isActive('bulletList') || editor?.isActive('orderedList') ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                        aria-label="List"
                        title="List"
                      >
                        {editor?.isActive('orderedList') ? <IconListNumbers className="w-4 h-4" /> : <IconListDetails className="w-4 h-4" />}
                        <IconChevronDown className={`w-3 h-3 transition-transform ${showListDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showListDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg shadow-lg z-50 overflow-hidden">
                          <button
                            onClick={() => { editor?.chain().focus().toggleBulletList().run(); setShowListDropdown(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${editor?.isActive('bulletList') ? 'bg-primary/10 text-primary' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}
                          >
                            <IconListDetails className="w-4 h-4 shrink-0" />
                            Bullet List
                          </button>
                          <button
                            onClick={() => { editor?.chain().focus().toggleOrderedList().run(); setShowListDropdown(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${editor?.isActive('orderedList') ? 'bg-primary/10 text-primary' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}
                          >
                            <IconListNumbers className="w-4 h-4 shrink-0" />
                            Numbered List
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-600" />
                    <button
                      onClick={() => { setLinkUrl(editor?.getAttributes('link').href ?? ''); setShowLinkModal(true); }}
                      className={`p-2 rounded-md transition-colors ${editor?.isActive('link') ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                      aria-label="Link"
                      title="Link"
                    >
                      <IconLink className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-600" />
                    <button
                      onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                      className={`p-2 rounded-md transition-colors ${editor?.isActive({ textAlign: 'left' }) ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                      aria-label="Align Left"
                      title="Align Left"
                    >
                      <IconAlignLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                      className={`p-2 rounded-md transition-colors ${editor?.isActive({ textAlign: 'center' }) ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                      aria-label="Align Center"
                      title="Align Center"
                    >
                      <IconAlignCenter className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                      className={`p-2 rounded-md transition-colors ${editor?.isActive({ textAlign: 'right' }) ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                      aria-label="Align Right"
                      title="Align Right"
                    >
                      <IconAlignRight className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-600" />
                    <button
                      onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                      className={`p-2 rounded-md transition-colors ${editor?.isActive('codeBlock') ? 'bg-primary/20 text-primary' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                      aria-label="Code Block"
                      title="Code Block"
                    >
                      <IconCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setImageUrl(''); setShowImageModal(true); }}
                      className={`p-2 rounded-md transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100`}
                      aria-label="Insert Image"
                      title="Insert Image"
                    >
                      <IconPhoto className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                      className="p-2 rounded-md transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100"
                      aria-label="Divider"
                      title="Divider"
                    >
                      <IconMinus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="w-full min-h-80 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 overflow-y-auto cursor-text" onClick={() => editor?.chain().focus().run()}>
                <EditorContent editor={editor} />
              </div>
            </div>
          )}
          {mode === "external" && (
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <IconWorld className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    External Document
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Link to an external document or resource
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  placeholder="https://docs.example.com"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  readOnly={!canEdit}
                  disabled={!canEdit}
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Enter a valid HTTPS URL that will redirect users to the external document
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-700">
            {canDelete && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <IconTrash className="w-4 h-4" />
                Delete
              </button>
            )}
            {canEdit && (
              <button
                onClick={form.handleSubmit(updateDoc)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/95 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all"
              >
                <IconCheck className="w-4 h-4" />
                Save Changes
              </button>
            )}
          </div>
        </FormProvider>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Confirm Deletion
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Are you sure you want to delete this Document?</p> 
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">This action cannot be undone.</p>
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
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImageModal(false)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-6 w-80 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Insert Image</h3>
            <input
              type="url"
              placeholder="https://cdn.firefli.net/brand/logo.png"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (imageUrl.trim()) editor?.chain().focus().setImage({ src: imageUrl.trim(), ...(imageWidth.trim() ? { width: imageWidth.trim() } : {}) } as any).run();
                  setShowImageModal(false); setImageUrl(''); setImageWidth('');
                }
                if (e.key === 'Escape') { setShowImageModal(false); setImageUrl(''); setImageWidth(''); }
              }}
            />
            <input
              type="text"
              placeholder="Width (e.g. 400px or 50%)"
              value={imageWidth}
              onChange={e => setImageWidth(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowImageModal(false); setImageUrl(''); setImageWidth(''); }} className="px-3 py-1.5 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700">Cancel</button>
              <button
                onClick={() => {
                  if (imageUrl.trim()) editor?.chain().focus().setImage({ src: imageUrl.trim(), ...(imageWidth.trim() ? { width: imageWidth.trim() } : {}) } as any).run();
                  setShowImageModal(false); setImageUrl(''); setImageWidth('');
                }}
                className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90"
              >Insert</button>
            </div>
          </div>
        </div>
      )}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowLinkModal(false)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-6 w-80 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Insert Link</h3>
            <input
              type="url"
              placeholder="https://app.firefli.net/"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (linkUrl.trim()) editor?.chain().focus().setLink({ href: linkUrl.trim() }).run();
                  else editor?.chain().focus().unsetLink().run();
                  setShowLinkModal(false); setLinkUrl('');
                }
                if (e.key === 'Escape') { setShowLinkModal(false); setLinkUrl(''); }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowLinkModal(false); setLinkUrl(''); }} className="px-3 py-1.5 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700">Cancel</button>
              <button
                onClick={() => {
                  if (linkUrl.trim()) editor?.chain().focus().setLink({ href: linkUrl.trim() }).run();
                  else editor?.chain().focus().unsetLink().run();
                  setShowLinkModal(false); setLinkUrl('');
                }}
                className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90"
              >Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

EditDoc.layout = Workspace;

export default EditDoc;
