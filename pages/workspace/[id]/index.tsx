"use client"

import type React from "react"
import type { pageWithLayout } from "@/layoutTypes"
import { loginState, workspacestate, dashboardEditingState } from "@/state"
import Workspace from "@/layouts/workspace"
import Sessions from "@/components/home/sessions"
import Notices from "@/components/home/notices"
import Docs from "@/components/home/docs"
import randomText from "@/utils/randomText"
import wall from "@/components/home/wall"
import StickyWidget from "@/components/home/sticky"
import QuotaWidget from "@/components/home/quota"
import GamesWidget from "@/components/home/games"
import Birthdays from "@/components/birthdays"
import NewToTeam from "@/components/newmembers"
import { useRecoilState } from "recoil"
import { useMemo, useEffect, useState, useCallback } from "react"
import { useRouter } from "next/router"
import { detectUserTimezone } from "@/utils/timezoneUtils"
import axios from "axios"
import ReactGridLayout, { WidthProvider } from "react-grid-layout/legacy"
import {
  IconHome,
  IconWall,
  IconFileText,
  IconSpeakerphone,
  IconChevronRight,
  IconSettings,
  IconPlus,
  IconRefresh,
  IconArrowRight,
  IconGift,
  IconAlertTriangle,
  IconEdit,
  IconCheck,
  IconX,
  IconGripVertical,
  IconLayoutGrid,
  IconPin,
  IconTarget,
  IconWorld,
} from "@tabler/icons-react"
import clsx from "clsx"
import { withPermissionCheckSsr } from "@/utils/permissionsManager"
import { GetServerSideProps } from "next"

const GridLayout = WidthProvider(ReactGridLayout)

export const getServerSideProps: GetServerSideProps = withPermissionCheckSsr(
  async ({ query }) => {
    return {
      props: {},
    }
  }
)

interface WidgetConfig {
  component: React.FC
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  color: string
  beta?: boolean;
}

export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

const Home: pageWithLayout = () => {
  const [login, setLogin] = useRecoilState(loginState)
  const [workspace, setWorkspace] = useRecoilState(workspacestate)
  const router = useRouter()
  const text = useMemo(() => randomText(login.displayname), [login.displayname])
  const [isLoadingTitle, setIsLoadingTitle] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [titleVisible, setTitleVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [, setDashboardEditing] = useRecoilState(dashboardEditingState)
  const [editWidgets, setEditWidgets] = useState<string[]>([])
  const [editLayout, setEditLayout] = useState<WidgetLayout[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [droppingWidgetId, setDroppingWidgetId] = useState<string | null>(null)
  const [windowWidth, setWindowWidth] = useState<number | undefined>(() =>
    typeof window !== 'undefined' ? window.innerWidth : undefined
  )

  // Normalize layout so it always matches enabled widgets
  const layout = useMemo(() => {
    const wids = Array.isArray(workspace.settings?.widgets)
      ? workspace.settings.widgets
      : []
    const savedLayout = Array.isArray(workspace.settings?.layout)
      ? workspace.settings.layout
      : []

    const savedByWidget = new Map(savedLayout.map((item: WidgetLayout) => [item.i, item]))

    return wids.map((widget: string, index: number) => {
      const existing = savedByWidget.get(widget)
      return {
        i: widget,
        x: existing?.x ?? (index % 2) * 6,
        y: existing?.y ?? Math.floor(index / 2) * 4,
        w: existing?.w ?? 6,
        h: existing?.h ?? 4,
        minW: 4,
        minH: 1,
      }
    })
  }, [workspace.settings?.widgets, workspace.settings?.layout]);

  const widgets: Record<string, WidgetConfig> = {
    wall: {
      component: wall,
      icon: IconWall,
      title: "Wall",
      description: "Latest messages and announcements",
      color: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20",
    },
    sessions: {
      component: Sessions,
      icon: IconSpeakerphone,
      title: "Sessions",
      description: "Ongoing and upcoming sessions",
      color: "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20",
    },
    notices: {
      component: Notices,
      icon: IconAlertTriangle,
      title: "Notices",
      description: "Staff currently on notice",
      color: "bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20",
    },
    documents: {
      component: Docs,
      icon: IconFileText,
      title: "Documents",
      description: "Latest workspace documents",
      color: "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20",
    },
    new_members: {
      component: NewToTeam,
      icon: IconPlus,
      title: "New Members",
      description: "Recently joined team members",
      color: "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20",
    },
    birthdays: {
      component: Birthdays,
      icon: IconGift,
      title: "Birthdays",
      description: "Upcoming team birthdays",
      color: "bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20",
    },
    sticky_notes: {
      component: StickyWidget,
      icon: IconPin,
      title: "Announcement",
      description: "Pinned workspace announcement",
      color: "bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20",
    },
    quota: {
      component: QuotaWidget,
      icon: IconTarget,
      title: "My Quotas",
      description: "Your quota progress this period",
      color: "bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20",
    },
    games: {
      component: GamesWidget,
      icon: IconWorld,
      title: "Games",
      description: "Your workspace Roblox games",
      color: "bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/20 dark:to-sky-800/20",
    },
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLoadingTitle(document.title.includes("Loading"))
    }

    const timer = setTimeout(() => {
      setTitleVisible(true)
    }, 300)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const update = () => setWindowWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (
      workspace &&
      workspace.groupId &&
      workspace.settings &&
      Array.isArray(workspace.settings.widgets)
    ) {
      setLoading(false)
    }
  }, [workspace])

  useEffect(() => {
    if (workspace?.groupId && login?.userId) {
      const detectedTz = detectUserTimezone();
      fetch(`/api/workspace/${workspace.groupId}/timezone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: detectedTz.label }),
      }).catch(() => {
		// no errors its gonna work amazing trust - famous last words
      });
    }
  }, [workspace?.groupId, login?.userId])

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
    }, 1000)
  }

  const enterEditMode = useCallback(() => {
    setEditWidgets([...(workspace.settings?.widgets ?? [])])
    setEditLayout([...layout])
    setIsEditing(true)
    setDashboardEditing(true)
  }, [workspace.settings?.widgets, layout])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setDashboardEditing(false)
    setDroppingWidgetId(null)
  }, [])

  const saveEdit = useCallback(async () => {
    setIsSaving(true)
    try {
      const res = await axios.patch(
        `/api/workspace/${workspace.groupId}/settings/general/home`,
        { widgets: editWidgets, layout: editLayout }
      )
      if (res.status === 200) {
        setWorkspace((prev: typeof workspace) => ({
          ...prev,
          settings: { ...prev.settings, widgets: editWidgets, layout: editLayout },
        }))
        setIsEditing(false)
        setDashboardEditing(false)
      }
    } catch (_) {
      // silent — user can retry
    } finally {
      setIsSaving(false)
    }
  }, [workspace.groupId, editWidgets, editLayout, setWorkspace])

  const removeEditWidget = useCallback((widgetId: string) => {
    setEditWidgets((prev) => prev.filter((w) => w !== widgetId))
    setEditLayout((prev) => prev.filter((l) => l.i !== widgetId))
  }, [])

  const applyLayoutUpdate = useCallback((newLayout: readonly any[]) => {
    setEditLayout(
      newLayout.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h, minW: 4, minH: 1 }))
    )
  }, [])

  const droppingItem = droppingWidgetId
    ? { i: droppingWidgetId, x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 1 }
    : undefined

  const handleDrop = useCallback(
    (newLayout: readonly any[], item: any, _e: Event) => {
      if (!droppingWidgetId) return
      const widgetId = droppingWidgetId
      setDroppingWidgetId(null)
      setEditWidgets((prev) => [...prev, widgetId])
      setEditLayout(
        newLayout.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h, minW: 4, minH: 1 }))
      )
    },
    [droppingWidgetId]
  )

  const availableWidgets = Object.keys(widgets).filter((id) => !editWidgets.includes(id))

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {isEditing && (
        <div className="sticky top-0 z-50 bg-primary text-white px-4 py-2.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            <IconEdit className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium truncate">
              <span className="hidden sm:inline">Editing dashboard: drag to rearrange, resize from corners, or tap a widget below to add it.</span>
              <span className="sm:hidden">Editing dashboard: tap below to add widgets</span>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
            >
              <IconX className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              onClick={saveEdit}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-primary hover:bg-white/90 transition-colors text-sm font-semibold disabled:opacity-60"
            >
              <IconCheck className="w-3.5 h-3.5" />
              {isSaving ? "Saving…" : "Save Layout"}
            </button>
          </div>
        </div>
      )}

      <div className="pagePadding">
      <div>
        <div
          className={clsx(
            "relative rounded-2xl overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8",
            workspace.settings.bannerImage?.startsWith('data:') ? "p-8 min-h-[140px]" : ""
          )}
          style={workspace.settings.bannerImage?.startsWith('data:') ? {
            backgroundImage: `url(${workspace.settings.bannerImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : {}}
        >
          {workspace.settings.bannerImage?.startsWith('data:') && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
          )}
          <div className="relative max-w-2xl">
            <div className="absolute -left-3 -top-3 w-20 h-20 bg-primary/5 rounded-full blur-2xl"></div>
            <div className="relative">
              <div
                className={clsx(
                  "transition-all duration-700 transform",
                  titleVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                )}
              >
                <span className={clsx("text-sm font-medium mb-1 block", workspace.settings.bannerImage?.startsWith('data:') ? "text-white/80" : "text-primary/80")}>
                  Welcome back
                </span>
                <h1 className={clsx(
                  "text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold mb-2 pb-1 break-words",
                  workspace.settings.bannerImage?.startsWith('data:')
                    ? "text-white drop-shadow-md"
                    : "bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70"
                )}>
                  {text}
                </h1>
                <div
                  className={clsx(
                    "h-1 w-16 rounded-full mb-3 transition-all duration-1000 transform",
                    workspace.settings.bannerImage?.startsWith('data:') ? "bg-white/60" : "bg-gradient-to-r from-primary to-primary/30",
                    titleVisible ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
                  )}
                ></div>
                <p className={clsx("text-sm max-w-md", workspace.settings.bannerImage?.startsWith('data:') ? "text-white/70" : "text-zinc-500 dark:text-zinc-400")}>
                  Here's what's happening in your workspace today
                </p>
              </div>
            </div>
          </div>
          {!isEditing && !loading && workspace.settings.widgets.length > 0 && (
            <button
              onClick={enterEditMode}
              className={clsx(
                "relative self-start md:self-auto flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium shadow-sm transition-all",
                workspace.settings.bannerImage?.startsWith('data:') ? "bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary"
              )}
            >
              <IconEdit className="w-4 h-4" />
              Edit Dashboard
            </button>
          )}
        </div>
        {loading ? (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm p-6 sm:p-12 text-center border border-zinc-100 dark:border-zinc-700">
            <div className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center">
              <IconHome className="w-8 h-8 sm:w-12 sm:h-12 text-primary" />
            </div>
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-medium text-zinc-900 dark:text-white">
                Hold on... your workspace is still loading or we're pushing an update 😋
              </h3>
              <div className="flex justify-center">
                <div className="animate-pulse flex space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

        ) : isEditing && mounted ? (
          <div>
            <div
              className={clsx(
                "rounded-2xl border-2 border-dashed transition-colors",
                droppingWidgetId
                  ? "border-primary/50 bg-primary/5 dark:bg-primary/10"
                  : "border-zinc-200 dark:border-zinc-700",
                editWidgets.length === 0 && "min-h-[200px] flex items-center justify-center"
              )}
            >
              {editWidgets.length === 0 ? (
                <p className="text-sm text-zinc-400 dark:text-zinc-500 select-none">
                  Drag a widget below to place it, or tap one to add it
                </p>
              ) : (
                <GridLayout
                  layout={editLayout}
                  cols={12}
                  rowHeight={80}
                  isDraggable
                  isResizable
                  isDroppable
                  droppingItem={droppingItem}
                  onDrop={handleDrop}
                  onDragStop={(newLayout) => applyLayoutUpdate(newLayout)}
                  onResizeStop={(newLayout) => applyLayoutUpdate(newLayout)}
                  margin={[12, 12]}
                  containerPadding={[12, 12]}
                  resizeHandles={["se", "sw", "ne", "nw"]}
                >
                  {editWidgets.map((widgetId) => {
                    const wc = widgets[widgetId]
                    if (!wc) return null
                    const Icon = wc.icon
                    return (
                      <div
                        key={widgetId}
                        className="bg-white dark:bg-zinc-800 rounded-2xl border-2 border-dashed border-primary/25 shadow-sm overflow-hidden flex flex-col"
                      >
                        <div
                          className={clsx(
                            "px-3 py-2.5 flex items-center justify-between flex-shrink-0 border-b border-zinc-100 dark:border-zinc-700",
                            wc.color
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <IconGripVertical className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                            <div className="w-6 h-6 rounded-lg bg-white/70 dark:bg-zinc-800/70 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                              {wc.title}
                            </span>
                          </div>
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => removeEditWidget(widgetId)}
                            className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors flex-shrink-0 ml-2"
                            title="Remove widget"
                          >
                            <IconX className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-3 min-h-0">
                          <div className="text-center">
                            <IconLayoutGrid className="w-7 h-7 mx-auto mb-1.5 text-zinc-300 dark:text-zinc-600" />
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2">{wc.description}</p>
                            <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-1">Drag corners to resize</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </GridLayout>
              )}
            </div>

            {availableWidgets.length > 0 && (
              <div className="mt-6 p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
                  <IconPlus className="w-4 h-4 text-primary" />
                  Available Widgets
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                  <span className="hidden sm:inline">Drag onto the grid above, or tap to add</span>
                  <span className="sm:hidden">Tap a widget to add it to your dashboard</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {availableWidgets.map((widgetId) => {
                    const wc = widgets[widgetId]
                    if (!wc) return null
                    const Icon = wc.icon
                    return (
                      <div
                        key={widgetId}
                        draggable
                        // @ts-ignore
                        unselectable="on"
                        onClick={() => {
                          const maxY = editLayout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
                          const col = (editWidgets.length % 2) * 6
                          setEditWidgets((prev) => [...prev, widgetId])
                          setEditLayout((prev) => [...prev, { i: widgetId, x: col, y: maxY, w: 6, h: 4, minW: 4, minH: 1 }])
                        }}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", "")
                          setDroppingWidgetId(widgetId)
                        }}
                        onDragEnd={() => setDroppingWidgetId(null)}
                        className={clsx(
                          "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer active:cursor-grabbing transition-all select-none",
                          droppingWidgetId === widgetId
                            ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-md scale-[1.02]"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-primary/40 dark:hover:border-primary/40 hover:shadow-sm"
                        )}
                      >
                        <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", wc.color)}>
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">{wc.title}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">Tap to add</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

        ) : workspace.settings.widgets.length > 0 ? (
          <div className="relative">
            <div
              className={clsx(
                "grid gap-6",
                windowWidth !== undefined && windowWidth < 768 ? "grid-cols-1" : "grid-cols-12"
              )}
              style={windowWidth !== undefined && windowWidth >= 768 ? { gridAutoRows: '80px' } : undefined}
            >
              {[...layout].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x).map((item: WidgetLayout) => {
                const widgetConfig = widgets[item.i]
                if (!widgetConfig) return null
                const Widget = widgetConfig.component
                const Icon = widgetConfig.icon
                const isMobile = windowWidth !== undefined && windowWidth < 768

                return (
                  <div
                    key={item.i}
                    style={isMobile ? {} : {
                      gridColumnStart: item.x + 1,
                      gridColumnEnd: item.x + item.w + 1,
                      gridRowStart: item.y + 1,
                      gridRowEnd: item.y + item.h + 1,
                    }}
                    className={clsx(
                      "flex flex-col bg-white dark:bg-zinc-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-zinc-100 dark:border-zinc-700",
                      "transform hover:-translate-y-1",
                    )}
                  >
                    <div className="px-6 pt-5 pb-2 flex items-center gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{widgetConfig.title}</span>
                      {widgetConfig.beta && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full">
                          BETA
                        </span>
                      )}
                    </div>

                    <div className="px-6 pb-6 flex-1 min-h-0 overflow-hidden">
                      <Widget />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm p-6 sm:p-12 text-center border border-zinc-100 dark:border-zinc-700">
            <div className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center">
              <IconHome className="w-8 h-8 sm:w-12 sm:h-12 text-primary" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mb-3">
              Your dashboard is empty
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-base">
              Add widgets to your workspace to see important information at a glance
            </p>
            <button
              onClick={() => (window.location.href = `/workspace/${workspace.groupId}/settings`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all duration-300 shadow-sm hover:shadow group text-sm sm:text-base"
            >
              <IconPlus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span>Configure Dashboard</span>
              <IconChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </button>
          </div>
        )}

      </div>
      </div>
    </div>
  )
}


Home.layout = Workspace

export default Home
