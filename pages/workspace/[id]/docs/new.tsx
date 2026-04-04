import type { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import Button from "@/components/button";
import Input from "@/components/input";
import Workspace from "@/layouts/workspace";
import { useRecoilState } from "recoil";
import { useState } from "react";
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
  IconFileText,
  IconLink,
  IconLock,
  IconEdit,
  IconWorld,
  IconChevronDown,
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

export const getServerSideProps: GetServerSideProps = withPermissionCheckSsr(
  async (context) => {
    const { id } = context.query;

    const roles = await prisma.role.findMany({
      where: {
        workspaceGroupId: Number(id),
      },
      orderBy: {
        isOwnerRole: "desc",
      },
    });

    const departments = await prisma.department.findMany({
      where: {
        workspaceGroupId: Number(id),
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      props: {
        roles,
        departments,
      },
    };
  },
  "create_docs"
);

const Home: pageWithLayout<InferGetServerSidePropsType<GetServerSideProps>> = ({
  roles,
  departments,
}) => {
  const [login, setLogin] = useRecoilState(loginState);
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const router = useRouter();
  const form = useForm();

  const [mode, setMode] = useState<"internal" | "external">("internal");
  const [showTypeModal, setShowTypeModal] = useState<boolean>(true);
  const [externalUrl, setExternalUrl] = useState<string>("");
  const [showRoles, setShowRoles] = useState(false);
  const [showDepartments, setShowDepartments] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showListDropdown, setShowListDropdown] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageWidth, setImageWidth] = useState("");

  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), Underline, TextAlign.configure({ types: ['heading', 'paragraph'] }), RichCodeBlock, ResizableImage.configure({ inline: false, allowBase64: false })],
    editable: true,
    editorProps: {
      attributes: {
        class: "prose dark:prose-invert max-w-none focus:outline-none",
      },
    },
  });

  const goback = () => {
    window.history.back();
  };

  const chooseType = (t: "internal" | "external") => {
    setMode(t);
    setShowTypeModal(false);
  };

  const createDoc = async () => {
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
      .post(`/api/workspace/${workspace.groupId}/guides/create`, {
        name: form.getValues().name,
        content,
        roles: selectedRoles,
        departments: selectedDepartments,
      })
      .catch((err) => {
        form.setError("name", {
          type: "custom",
          message: err?.response?.data?.error || "Failed to create",
        });
      });
    if (!session) return;
    form.clearErrors();
    if (mode === "external") {
      toast.success("Document created!");
      router.push(`/workspace/${workspace.groupId}/docs`);
    } else {
      toast.success("Document created!");
      router.push(
        `/workspace/${workspace.groupId}/docs/${session.data.document.id}`
      );
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

  const toggleDepartment = async (departmentId: string) => {
    setSelectedDepartments((prevDepartments) => {
      if (prevDepartments.includes(departmentId)) {
        return prevDepartments.filter((d) => d !== departmentId);
      } else {
        return [...prevDepartments, departmentId];
      }
    });
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
              Create Document
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Create a new document for your workspace
            </p>
          </div>
        </div>
        <div
          className={`transition-opacity duration-150 ${
            showTypeModal ? "opacity-40 pointer-events-none select-none" : ""
          }`}
        >
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
                          {departments.map((department: any) => (
                            <label
                              key={department.id}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-all group"
                            >
                              <input
                                type="checkbox"
                                checked={selectedDepartments.includes(department.id)}
                                onChange={() => toggleDepartment(department.id)}
                                className="w-4 h-4 text-primary rounded border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                              />
                              <span className="text-sm text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                                {department.name}
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
                  />
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Enter a valid HTTPS URL that will redirect users to the external document
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => router.push(`/workspace/${workspace.groupId}/docs`)}
                className="px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={form.handleSubmit(createDoc)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/95 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all"
              >
                <IconCheck className="w-4 h-4" />
                Create Document
              </button>
            </div>
          </FormProvider>
        </div>
        {showTypeModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="doc-type-title"
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden"
            >
              <div className="px-6 py-5 sm:px-8">
                <div className="flex items-start gap-4 mb-5 relative">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="h-12 w-12 rounded-lg bg-firefli flex items-center justify-center text-white shadow-md">
                      <IconFileText className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 id="doc-type-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      Create a document
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      How would you like to create this document?
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/workspace/${workspace.groupId}/docs`)}
                    className="absolute top-0 right-0 p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    aria-label="Go back to documents"
                  >
                    <IconArrowLeft className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => chooseType("internal")}
                    className="flex items-center gap-3 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <IconFileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-white">Text Editor</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">Create a document with markdown</div>
                    </div>
                  </button>
                  <button
                    onClick={() => chooseType("external")}
                    className="flex items-center gap-3 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <IconLink className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-white">Off-site Link</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">Link to an external document</div>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
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
    </div>
  );
};

Home.layout = Workspace;

export default Home;
