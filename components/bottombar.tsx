import { useState, useEffect } from "react"
import type { NextPage } from "next"
import { loginState, workspacestate } from "@/state"
import { useRecoilState } from "recoil"
import { useRouter } from "next/router"
import {
  Home,
  HomeOutlined,
  Assignment,
  AssignmentOutlined,
  Person,
  PersonOutlined,
  Settings,
  SettingsOutlined,
  MoreHoriz,
  Chat,
  ChatOutlined,
  Notifications,
  NotificationsOutlined,
  Schedule,
  ScheduleOutlined,
  Handshake,
  HandshakeOutlined,
  Description,
  DescriptionOutlined,
  Shield,
  ShieldOutlined,
  TrackChanges,
  Close,
} from "@mui/icons-material"
import { Dialog, Transition } from "@headlessui/react"
import { Fragment } from "react"
import axios from "axios"
import { useSetRecoilState } from "recoil";

const BottomBar: NextPage = () => {
  const [login] = useRecoilState(loginState)
  const [workspace] = useRecoilState(workspacestate)
  const [showMore, setShowMore] = useState(false)
  const [docsEnabled, setDocsEnabled] = useState(false)
  const [alliesEnabled, setAlliesEnabled] = useState(false)
  const [sessionsEnabled, setSessionsEnabled] = useState(false)
  const [noticesEnabled, setNoticesEnabled] = useState(false)
  const [policiesEnabled, setPoliciesEnabled] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!workspace.groupId) return
    
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`/api/workspace/${workspace.groupId}/settings/general/configuration`)
        const data = res.data
        setDocsEnabled(data.value?.guides?.enabled ?? false)
        setAlliesEnabled(data.value?.allies?.enabled ?? false)
        setSessionsEnabled(data.value?.sessions?.enabled ?? false)
        setNoticesEnabled(data.value?.notices?.enabled ?? false)
        setPoliciesEnabled(data.value?.policies?.enabled ?? false)
      } catch (e) {
        // dont break
      }
    }
    fetchSettings()
  }, [workspace.groupId])

  const mainPages = [
    { name: "Home", href: `/workspace/${workspace.groupId}`, icon: HomeOutlined, filledIcon: Home },
    { name: "Activity", href: `/workspace/${workspace.groupId}/activity`, icon: AssignmentOutlined, filledIcon: Assignment },
    { name: "Quotas", href: `/workspace/${workspace.groupId}/quotas`, icon: TrackChanges, filledIcon: TrackChanges, accessible: true },
    ...(sessionsEnabled ? [{ name: "Sessions", href: `/workspace/${workspace.groupId}/sessions`, icon: NotificationsOutlined, filledIcon: Notifications, accessible: true }] : []),
  ]

  const morePages = [
    { name: "Wall", href: `/workspace/${workspace.groupId}/wall`, icon: ChatOutlined, filledIcon: Chat, accessible: workspace.yourPermission.includes("view_wall") },
    { name: "Staff", href: `/workspace/${workspace.groupId}/views`, icon: PersonOutlined, filledIcon: Person, accessible: workspace.yourPermission.includes("view_members") },
    ...(noticesEnabled ? [{ name: "Notices", href: `/workspace/${workspace.groupId}/notices`, icon: ScheduleOutlined, filledIcon: Schedule, accessible: true }] : []),
    ...(alliesEnabled ? [{ name: "Alliances", href: `/workspace/${workspace.groupId}/alliances`, icon: HandshakeOutlined, filledIcon: Handshake, accessible: true }] : []),
    ...(docsEnabled ? [{ name: "Docs", href: `/workspace/${workspace.groupId}/docs`, icon: DescriptionOutlined, filledIcon: Description, accessible: true }] : []),
    ...(policiesEnabled ? [{ name: "Policies", href: `/workspace/${workspace.groupId}/policies`, icon: ShieldOutlined, filledIcon: Shield, accessible: true }] : []),
    { name: "Settings", href: `/workspace/${workspace.groupId}/settings`, icon: SettingsOutlined, filledIcon: Settings, accessible: ["admin", "workspace_customisation", "reset_activity", "manage_features", "manage_apikeys", "view_audit_logs"].some(perm => workspace.yourPermission.includes(perm)) },
  ].filter(page => page.accessible !== false)

  const isActive = (href: string) => {
    if (href === `/workspace/${workspace.groupId}`) {
      return router.asPath === href
    }
    return router.asPath.startsWith(href)
  }

  const isMoreActive = morePages.some(page => isActive(page.href))

  const gotoPage = (href: string) => {
    router.push(href)
    setShowMore(false)
  }

  // Filter main pages by accessibility
  const visibleMainPages = mainPages.filter(page => page.accessible !== false)

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-700 md:hidden safe-area-bottom">
        <div className="flex justify-around items-center h-16 px-2">
          {visibleMainPages.map((page) => {
            const active = isActive(page.href)
            const Icon = active && page.filledIcon ? page.filledIcon : page.icon
            return (
              <button
                key={page.name}
                onClick={() => gotoPage(page.href)}
                className="flex flex-col items-center justify-center flex-1 py-2 group"
              >
                <Icon
                  className={`w-6 h-6 transition-colors ${
                    active
                      ? "text-primary"
                      : "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"
                  }`}
                />
                <span
                  className={`text-xs mt-1 transition-colors ${
                    active
                      ? "text-primary font-medium"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {page.name}
                </span>
              </button>
            )
          })}

          {morePages.length > 0 && (
            <button
              onClick={() => { setShowMore(true); }}
              className="flex flex-col items-center justify-center flex-1 py-2 group"
            >
              <MoreHoriz
                className={`w-6 h-6 transition-colors ${
                  isMoreActive
                    ? "text-primary"
                    : "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"
                }`}
              />
              <span
                className={`text-xs mt-1 transition-colors ${
                  isMoreActive
                    ? "text-primary font-medium"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                More
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* More Menu Modal */}
      <Transition appear show={showMore} as={Fragment}>
        <Dialog as="div" className="relative z-[100]" onClose={() => { setShowMore(false); }}>
          <div className="fixed inset-0 bg-black/25" onClick={() => setShowMore(false)} />

          <div className="fixed inset-0 flex items-end justify-center pointer-events-none">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="translate-y-full"
              enterTo="translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="translate-y-0"
              leaveTo="translate-y-full"
            >
                <Dialog.Panel className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white dark:bg-zinc-800 shadow-xl pointer-events-auto safe-area-bottom">
                  <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
                    <Dialog.Title className="text-lg font-medium text-zinc-900 dark:text-white">
                      More
                    </Dialog.Title>
                    <button
                      onClick={() => setShowMore(false)}
                      className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <Close className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                    </button>
                  </div>

                  <div className="p-4 grid grid-cols-3 gap-4">
                    {morePages.map((page) => {
                      const active = isActive(page.href)
                      const Icon = active && page.filledIcon ? page.filledIcon : page.icon
                      return (
                        <button
                          key={page.name}
                          onClick={() => gotoPage(page.href)}
                          className={`flex flex-col items-center justify-center p-4 rounded-xl transition-colors ${
                            active
                              ? "bg-primary/10"
                              : "hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          }`}
                        >
                          <Icon
                            className={`w-7 h-7 ${
                              active ? "text-primary" : "text-zinc-600 dark:text-zinc-300"
                            }`}
                          />
                          <span
                            className={`text-xs mt-2 ${
                              active
                                ? "text-primary font-medium"
                                : "text-zinc-600 dark:text-zinc-300"
                            }`}
                          >
                            {page.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}

export default BottomBar
