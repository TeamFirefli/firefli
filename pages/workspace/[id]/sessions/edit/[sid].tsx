import type React from "react";
import type { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import Button from "@/components/button";
import Input from "@/components/input";
import Workspace from "@/layouts/workspace";
import { useRecoilState } from "recoil";
import { useEffect, useState } from "react";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconTrash,
  IconPlus,
  IconAlertCircle,
  IconUserPlus,
  IconInfoCircle,
  IconCalendarEvent,
  IconClipboardList,
} from "@tabler/icons-react";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import { useRouter } from "next/router";
import axios from "axios";
import prisma from "@/utils/database";
import { useForm, FormProvider } from "react-hook-form";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import toast, { Toaster } from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

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


export const getServerSideProps: GetServerSideProps = withPermissionCheckSsr(
  async (context) => {
    const { id, sid } = context.query;

    try {
      const session = await prisma.session.findUnique({
        where: {
          id: sid as string,
        },
        include: {
          sessionType: {
            include: {
              hostingRoles: true,
            },
          },
          owner: true,
          users: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!session) {
        return {
          notFound: true,
        };
      }

      if (session.sessionType.workspaceGroupId !== Number(id)) {
        return {
          notFound: true,
        };
      }

      const roles = await prisma.role.findMany({
        where: {
          workspaceGroupId: Number(id),
        },
        orderBy: {
          isOwnerRole: "desc",
        },
      });

      return {
        props: {
          session: JSON.parse(
            JSON.stringify(session, (key, value) =>
              typeof value === "bigint" ? value.toString() : value
            )
          ),
          roles: JSON.parse(
            JSON.stringify(roles, (key, value) =>
              typeof value === "bigint" ? value.toString() : value
            )
          ),
        },
      };
    } catch (error) {
      console.error("Error fetching session:", error);
      return {
        notFound: true,
      };
    }
  },
  [
    "sessions_shift_manage",
    "sessions_training_manage",
    "sessions_event_manage",
    "sessions_other_manage"
  ]
);

const EditSession: pageWithLayout<
  InferGetServerSidePropsType<GetServerSideProps>
> = ({ session, roles }) => {
  const [login, setLogin] = useRecoilState(loginState);
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAll, setDeleteAll] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateAll, setUpdateAll] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [roleTemplates, setRoleTemplates] = useState<any[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const tabs = [
    { id: "basic", label: "Basic", icon: <IconInfoCircle size={18} /> },
    { id: "scheduling", label: "Scheduling", icon: <IconCalendarEvent size={18} /> },
    { id: "statuses", label: "Statuses", icon: <IconClipboardList size={18} /> },
  ];

  const goToSection = (id: string) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const form = useForm({
    mode: "onChange",
    defaultValues: (() => {
      const sessionDate = new Date(session.date);
      const year = sessionDate.getFullYear();
      const month = String(sessionDate.getMonth() + 1).padStart(2, "0");
      const day = String(sessionDate.getDate()).padStart(2, "0");
      const hours = String(sessionDate.getHours()).padStart(2, "0");
      const minutes = String(sessionDate.getMinutes()).padStart(2, "0");
      const dateOnly = `${year}-${month}-${day}`;
      const timeOnly = `${hours}:${minutes}`;

      return {
        name: session.name || session.sessionType?.name || "",
        description: session.sessionType?.description || "",
        date: dateOnly,
        time: timeOnly,
        duration: session.duration || 30,
        gameId: (session as any).gameId || session.sessionType?.gameId || "",
      };
    })(),
  });

  const [statues, setStatues] = useState<{
    name: string;
    timeAfter: number;
    color: string;
    id: string;
  }[]>(() => (session.sessionType?.statues ? session.sessionType.statues : []));

  const newStatus = () => {
    setStatues((prev) => [
      ...prev,
      {
        name: "New status",
        timeAfter: 0,
        color: "green",
        id: `${Date.now()}-${Math.random()}`,
      },
    ]);
  };

  const deleteStatus = (id: string) => {
    setStatues((prev) => prev.filter((status) => status.id !== id));
  };

  const updateStatus = (id: string, name: string, color: string, timeafter: number) => {
    setStatues((prev) => prev.map((status) => (status.id === id ? { ...status, name, color, timeAfter: timeafter } : status)));
  };

  const router = useRouter();
  const { scope } = router.query; // Get the scope from query params (single, future, all)

  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const sessionTypeLabel = (() => {
    if (typeof session.type === "string" && !/^[0-9]+$/.test(session.type)) return capitalize(session.type);
  })();

  useEffect(() => {
    const loadWorkspaceUsers = async () => {
      try {
        const response = await axios.get(
          `/api/workspace/${router.query.id}/users`
        );
        setAvailableUsers(response.data);
      } catch (error) {
        console.error("Failed to load workspace users:", error);
      }
    };
    loadWorkspaceUsers();
  }, [router.query.id]);

  useEffect(() => {
    if (!workspace.groupId) return;
    setIsLoadingTemplates(true);
    axios
      .get(`/api/workspace/${workspace.groupId}/settings/sessions/rtemplates`)
      .then((res) => {
        if (res.data.success) {
          const templates = res.data.templates || [];
          setRoleTemplates(templates);
          const existingSlotIds = new Set(
            (session.sessionType.slots || [])
              .filter((s: any) => typeof s === "object" && s !== null && s.id)
              .map((s: any) => s.id)
          );
          setSelectedTemplateIds(
            new Set(templates.filter((t: any) => existingSlotIds.has(t.id)).map((t: any) => t.id))
          );
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingTemplates(false));
  }, [workspace.groupId]);

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (ids: string[]) => {
    setSelectedTemplateIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const updateSession = async (applyToAll = false) => {
    setIsSubmitting(true);
    setFormError("");
    if (roleTemplates.length > 0) {
      const selSlots = roleTemplates.filter((t) => selectedTemplateIds.has(t.id));
      if (!selSlots.some((t) => t.hostRole === "primary")) {
        setFormError("At least one primary host role must be included in the session.");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const formData = form.getValues();
      const datePart = formData.date;
      const timePart = formData.time || "00:00";
      const localDateTime = `${datePart}T${timePart}`;
      const newDate = new Date(localDateTime);

      // Prevent updating a session to a past date/time
      if (newDate.getTime() <= Date.now()) {
        setFormError("Cannot set session date/time in the past. Choose a future date/time.");
        setIsSubmitting(false);
        setShowUpdateModal(false);
        setUpdateAll(false);
        return;
      }

      const [dateStr, timeStr] = localDateTime.split("T");

      // If we have a scope from the pattern dialog, use the pattern update API
      if (scope && session.scheduleId) {
        await axios.post(
          `/api/workspace/${workspace.groupId}/sessions/${session.id}/update-pattern`,
          {
            updateScope: scope, // "single", "future", or "all"
            newDate: dateStr,
            newTime: timeStr,
            newDuration: formData.duration,
            newName: formData.name,
          }
        );
        
        toast.success(
          scope === "single" 
            ? "Session updated successfully"
            : scope === "future"
            ? "This and future sessions updated successfully"
            : "All sessions in pattern updated successfully"
        );
      } else {
        // Use the original update API for non-pattern sessions
        await axios.put(
          `/api/workspace/${workspace.groupId}/sessions/manage/${session.id}/manage`,
          {
            name: formData.name,
            gameId: formData.gameId,
            date: dateStr,
            time: timeStr,
            description: formData.description,
            duration: formData.duration,
            statues: statues,
            updateAll: applyToAll,
            timezoneOffset: new Date().getTimezoneOffset(),
          }
        );

        toast.success("Session updated successfully");
      }

      if (roleTemplates.length > 0) {
        const selectedSlots = roleTemplates
          .filter((t) => selectedTemplateIds.has(t.id))
          .map((t) => ({ id: t.id, name: t.name, slots: t.slots, categoryId: t.categoryId || null, categoryName: t.category?.name || null, hostRole: t.hostRole || null, groupRoles: t.groupRoles || [] }));
        await axios.post(
          `/api/workspace/${workspace.groupId}/sessions/manage/${session.sessionTypeId}/edit`,
          {
            name: session.sessionType.name,
            permissions: (session.sessionType.hostingRoles || []).map((r: any) => r.id),
            statues: session.sessionType.statues || [],
            slots: selectedSlots,
          }
        );
      }

      router.push(`/workspace/${workspace.groupId}/sessions`);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to update session. Please try again."
      );
    } finally {
      setIsSubmitting(false);
      setShowUpdateModal(false);
      setUpdateAll(false);
    }
  };

  const handleSaveClick = () => {
    // If scope is already provided from the pattern dialog, just save directly
    if (scope) {
      updateSession(false);
    } else {
      // Check if this is a series session and show the modal
      const isSeriesSession = session.scheduleId !== null;
      if (isSeriesSession) {
        setShowUpdateModal(true);
      } else {
        updateSession(false);
      }
    }
  };

  const deleteSession = async () => {
    setIsSubmitting(true);
    try {
      // If we have a scope from the pattern dialog, use it instead of asking again
      const deleteScope = scope || (deleteAll ? "all" : "single");
      
      await axios.delete(
        `/api/workspace/${workspace.groupId}/sessions/${session.id}/delete`,
        {
          data: { 
            deleteAll: deleteScope === "all",
            deleteScope: deleteScope, // Pass the scope for future/single distinction
          },
        }
      );
      
      const successMessage = deleteScope === "single" 
        ? "Session deleted successfully"
        : deleteScope === "future"
        ? "This and future sessions deleted successfully"
        : "All sessions in series deleted successfully";
      
      toast.success(successMessage);
      router.push(`/workspace/${workspace.groupId}/sessions`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to delete session");
    } finally {
      setIsSubmitting(false);
      setShowDeleteModal(false);
      setDeleteAll(false);
    }
  };

  return (
    <div className="pagePadding">
      <Toaster position="bottom-center" />
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 text-zinc-500 dark:text-zinc-300 hover:text-zinc-700 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Go back"
          >
            <IconArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold dark:text-white">
              Edit Session
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              Modify session details and participant assignments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onPress={() => {
              // If scope is already set from pattern dialog, delete directly without asking
              if (scope) {
                deleteSession();
              } else {
                setShowDeleteModal(true);
              }
            }}
            disabled={isSubmitting}
            classoverride="bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 flex items-center gap-1"
          >
            <IconTrash size={16} /> Delete
          </Button>

          <Button
            onPress={form.handleSubmit(handleSaveClick)}
            disabled={isSubmitting}
            classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90 flex items-center gap-1"
          >
            <IconDeviceFloppy size={16} />{" "}
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {formError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 dark:bg-red-900/20 dark:border-red-800">
          <IconAlertCircle
            className="text-red-500 mt-0.5 flex-shrink-0"
            size={18}
          />
          <div>
            <h3 className="font-medium text-red-800 dark:text-red-400">
              Error
            </h3>
            <p className="text-red-600 dark:text-red-300 text-sm">
              {formError}
            </p>
          </div>
        </div>
      )}

      {scope && session.scheduleId && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3 dark:bg-blue-900/20 dark:border-blue-800">
          <IconInfoCircle
            className="text-blue-500 mt-0.5 flex-shrink-0"
            size={18}
          />
          <div>
            <h3 className="font-medium text-blue-800 dark:text-blue-400">
              Pattern Edit Mode
            </h3>
            <p className="text-blue-600 dark:text-blue-300 text-sm">
              {scope === "single" && "Changes will only affect this session."}
              {scope === "future" && "Changes will affect this and all future sessions on the same day of the week."}
              {scope === "all" && "Changes will affect all sessions in this recurring pattern."}
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 overflow-x-auto">
        <div className="flex space-x-1 min-w-max border-b border-gray-200 dark:border-zinc-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => goToSection(tab.id)}
              className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary dark:border-primary dark:text-primary"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <FormProvider {...form}>
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden">
          {activeTab === "basic" && (
            <div className="p-6" id="basic">
              <div className="flex gap-8 items-start">
                <div className="flex-1 min-w-0 space-y-6">
                  <div>
                    <Input
                      {...form.register("name", {
                        required: { value: true, message: "Session name is required" },
                      })}
                      label="Session Name"
                      placeholder="Weekly Training Session"
                    />
                    {form.formState.errors.name && (
                      <p className="mt-1 text-sm text-red-500">{form.formState.errors.name.message as string}</p>
                    )}
                  </div>
                  <div>
                    <Input {...form.register("description")} label="Description" textarea placeholder="Describe what this session is about..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Session Type</label>
                    <div className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm bg-white dark:bg-zinc-700 text-zinc-700 dark:text-white">
                      {sessionTypeLabel}
                    </div>
                  </div>
                  <div>
                    <Input {...form.register("gameId")} label="Game ID" placeholder="Optional game ID" />
                  </div>
                  <div className="mt-8 flex justify-end">
                    <Button onPress={() => setActiveTab("scheduling")} classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90">Continue to Scheduling</Button>
                  </div>
                </div>
                <div className="w-64 flex-shrink-0">
                  <div className="sticky top-4 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-700/50 border-b border-gray-200 dark:border-zinc-700 flex items-center gap-2">
                      <IconUserPlus size={14} className="text-primary" />
                      <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Session Roles</h4>
                    </div>
                    <div className="p-3 max-h-[480px] overflow-y-auto">
                      {isLoadingTemplates ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 py-2 text-center">Loading…</p>
                      ) : roleTemplates.length === 0 ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-4 leading-relaxed">
                          No roles defined yet.<br />
                          <span className="opacity-70">Configure in Settings → Sessions.</span>
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {(() => {
                            const UNCATEGORISED = "__uncategorised__";
                            const map = new Map<string, typeof roleTemplates>();
                            for (const t of roleTemplates) {
                              const key = t.categoryId || UNCATEGORISED;
                              if (!map.has(key)) map.set(key, []);
                              map.get(key)!.push(t);
                            }
                            type FlatItem =
                              | { type: "category"; catKey: string; catName: string; roles: typeof roleTemplates }
                              | { type: "role"; template: (typeof roleTemplates)[0] };
                            const flat: FlatItem[] = [];
                            for (const [catKey, roles] of map.entries()) {
                              if (catKey === UNCATEGORISED) {
                                for (const t of roles) flat.push({ type: "role", template: t });
                              } else {
                                flat.push({ type: "category", catKey, catName: roles[0]?.category?.name ?? catKey, roles });
                              }
                            }
                            flat.sort((a, b) => {
                              if (a.type === "category" && b.type === "category") return a.catName.localeCompare(b.catName);
                              if (a.type === "category") return -1;
                              if (b.type === "category") return 1;
                              return 0;
                            });
                            return flat.map((item) => {
                              if (item.type === "category") {
                                const catIds = item.roles.map((t) => t.id);
                                const allOn = catIds.every((id) => selectedTemplateIds.has(id));
                                const someOn = !allOn && catIds.some((id) => selectedTemplateIds.has(id));
                                const hasHost = item.roles.some((t) => t.hostRole === "primary");
                                return (
                                  <div key={item.catKey} className="flex items-center justify-between gap-2 py-1">
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate block">{item.catName}</span>
                                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                        {item.roles.length} role{item.roles.length !== 1 ? "s" : ""}
                                        {hasHost && <span className="ml-1 text-amber-500">· Host</span>}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleCategory(catIds)}
                                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${allOn ? "bg-primary" : someOn ? "bg-primary/40" : "bg-zinc-300 dark:bg-zinc-600"}`}
                                      role="switch"
                                      aria-checked={allOn}
                                    >
                                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${allOn ? "translate-x-4" : someOn ? "translate-x-2" : "translate-x-0"}`} />
                                    </button>
                                  </div>
                                );
                              } else {
                                const template = item.template;
                                return (
                                  <div key={template.id} className="flex items-center justify-between gap-2 py-1">
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate block">{template.name}</span>
                                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                        {template.slots} slot{template.slots !== 1 ? "s" : ""}
                                        {template.hostRole === "primary" && <span className="ml-1 text-amber-500">· Primary</span>}
                                        {template.hostRole === "secondary" && <span className="ml-1 text-blue-500">· Secondary</span>}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleTemplate(template.id)}
                                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${selectedTemplateIds.has(template.id) ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-600"}`}
                                      role="switch"
                                      aria-checked={selectedTemplateIds.has(template.id)}
                                    >
                                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${selectedTemplateIds.has(template.id) ? "translate-x-4" : "translate-x-0"}`} />
                                    </button>
                                  </div>
                                );
                              }
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "scheduling" && (
            <div className="p-6" id="scheduling">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Session Date</label>
                  <input
                    type="date"
                    {...form.register("date", { required: { value: true, message: "Session date is required" } })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary dark:bg-zinc-700 dark:text-white"
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Enter date in your local timezone.</p>
                  {form.formState.errors.date && <p className="mt-1 text-sm text-red-500">{form.formState.errors.date.message as string}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Session Time</label>
                  <input
                    type="time"
                    {...form.register("time", { required: { value: true, message: "Session time is required" } })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary dark:bg-zinc-700 dark:text-white"
                  />
                  {form.formState.errors.time && <p className="mt-1 text-sm text-red-500">{form.formState.errors.time.message as string}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Session Length</label>
                  <select {...form.register("duration", { required: { value: true, message: "Duration is required" }, valueAsNumber: true })} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary dark:bg-zinc-700 dark:text-white">
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={50}>50 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Length of session</p>
                  {form.formState.errors.duration && <p className="mt-1 text-sm text-red-500">{form.formState.errors.duration.message as string}</p>}
                </div>
              </div>

              <div className="mt-8 flex justify-between w-full">
                <Button onPress={() => setActiveTab("basic")} classoverride="bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600">Back</Button>
                <Button onPress={() => setActiveTab("statuses")} classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90">Continue to Statuses</Button>
              </div>
            </div>
          )}

          {activeTab === "statuses" && (
            <div className="p-6" id="statuses">
              <div className="flex items-start mb-6">
                <div className="bg-primary/10 p-2 rounded-lg mr-4">
                  <IconClipboardList className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold dark:text-white">Session Statuses</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">Define status updates that occur during a session</p>
                </div>
              </div>

              <div className="max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Statuses automatically update after the specified time has passed</p>
                  <Button onPress={newStatus} compact classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90 flex items-center gap-1"><IconPlus size={16} /> Add Status</Button>
                </div>

                {statues.length === 0 ? (
                  <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg border border-dashed border-gray-300 dark:border-zinc-600">
                    <IconClipboardList className="mx-auto text-zinc-400 dark:text-zinc-500" size={32} />
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2">No statuses added yet</p>
                    <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs mx-auto">Add statuses to track session progress (e.g., "Starting Soon", "In Progress", "Completed")</p>
                    <Button onPress={newStatus} classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90 mt-4 flex items-center gap-1 mx-auto"><IconPlus size={16} /> Add Your First Status</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {statues.map((status, index) => (
                      <div key={status.id} className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-800 shadow-sm">
                        <Status updateStatus={(value, mins, color) => updateStatus(status.id, value, color, mins)} deleteStatus={() => deleteStatus(status.id)} data={status} index={index + 1} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-between w-full">
                <Button onPress={() => setActiveTab("scheduling")} classoverride="bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600">Back</Button>
                <Button onPress={form.handleSubmit(handleSaveClick)} classoverride="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90">{isSubmitting ? "Saving..." : "Save Changes"}</Button>
              </div>
            </div>
          )}

        </div>
      </FormProvider>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 text-center">
              Confirm Deletion
            </h2>

            {session.scheduleId ? (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-300 text-center">
                  This is part of a recurring session series. What would you
                  like to delete?
                </p>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/30 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteOption"
                      checked={!deleteAll}
                      onChange={() => setDeleteAll(false)}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-white">
                        Delete only this session
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        Remove just this single occurrence on{" "}
                        {new Date(session.date).toLocaleDateString()}
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/30 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteOption"
                      checked={deleteAll}
                      onChange={() => setDeleteAll(true)}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-white">
                        Delete entire series
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        Remove all sessions in this recurring series
                      </div>
                    </div>
                  </label>
                </div>

                <div className="flex justify-center gap-4 pt-4">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteAll(false);
                    }}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteSession}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 min-w-[100px]"
                  >
                    {isSubmitting
                      ? "Deleting..."
                      : deleteAll
                      ? "Delete Series"
                      : "Delete Session"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Are you sure you want to delete this session?
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">This action cannot be undone.</p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteSession}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                  >
                    {isSubmitting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 text-center">
              Update Session Series
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6 text-center">
              This session is part of a recurring series. How would you like to
              apply these changes?
            </p>

            <div className="space-y-4 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="updateScope"
                  checked={!updateAll}
                  onChange={() => setUpdateAll(false)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    This session only
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Apply changes to this specific session instance
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="updateScope"
                  checked={updateAll}
                  onChange={() => setUpdateAll(true)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    All sessions in series
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Apply changes to all sessions in this recurring series
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowUpdateModal(false);
                  setUpdateAll(false);
                }}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => updateSession(updateAll)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 min-w-[100px]"
              >
                {isSubmitting ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

EditSession.layout = Workspace;

export default EditSession;

const Status: React.FC<{
  data: any;
  updateStatus: (value: string, minutes: number, color: string) => void;
  deleteStatus: () => void;
  index?: number;
}> = ({ updateStatus, deleteStatus, data, index }) => {
  const methods = useForm<{
    minutes: number;
    value: string;
  }>({
    defaultValues: {
      value: data.name,
      minutes: data.timeAfter,
    },
  });
  const { register, watch } = methods;

  useEffect(() => {
    const subscription = methods.watch((value) => {
      updateStatus(methods.getValues().value, Number(methods.getValues().minutes), "green");
    });
    return () => subscription.unsubscribe();
  }, [methods, updateStatus]);

  return (
    <FormProvider {...methods}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          {index !== undefined && (
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium mr-2">{index}</span>
          )}
          <h3 className="font-medium dark:text-white">{watch("value") || "New Status"}</h3>
        </div>
        <Button onPress={deleteStatus} compact classoverride="bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 flex items-center gap-1"><IconTrash size={16} /> Delete</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input {...register("value")} label="Status Name" placeholder="In Progress" />
        <Input {...register("minutes")} label="Time After (minutes)" type="number" placeholder="15" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400 md:col-span-2">Status will activate {watch("minutes") || 0} minutes after session starts</p>
      </div>
    </FormProvider>
  );
};
