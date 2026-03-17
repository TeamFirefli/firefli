import workspace from "@/layouts/workspace";
import { pageWithLayout } from "@/layoutTypes";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import prisma from "@/utils/database";
import axios from "axios";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  IconBeach,
  IconBuilding,
  IconChevronLeft,
  IconChevronRight,
  IconUsers,
} from "@tabler/icons-react";

type Department = {
  id: string;
  name: string;
  color: string | null;
};

type StaffUser = {
  info: {
    userId: number;
    username: string | null;
    displayName?: string | null;
    picture: string | null;
  };
  rankName: string | null;
  departments?: string[];
  inactivityNotices?: Array<{
    approved?: boolean;
    reviewed?: boolean;
    revoked?: boolean;
    reason?: string | null;
    startTime?: string | Date;
    endTime?: string | Date | null;
  }>;
};

type PageProps = {
  departments: Department[];
};

export const getServerSideProps = withPermissionCheckSsr(async ({ params }) => {
  const workspaceGroupId = parseInt(params?.id as string);

  const departments = await prisma.department.findMany({
    where: { workspaceGroupId },
    select: {
      id: true,
      name: true,
      color: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return {
    props: {
      departments: JSON.parse(JSON.stringify(departments)),
    },
  };
}, "view_directory");

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

const StaffDirectoryPage: pageWithLayout<PageProps> = ({ departments }) => {
  const router = useRouter();
  const { id } = router.query;

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(50);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    const fetchDirectory = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        const res = await axios.get(`/api/workspace/${id}/views/staff`, {
          params: {
            page: pageIndex,
            pageSize,
            columns: JSON.stringify([
              "info",
              "rankName",
              "departments",
              "inactivityNotices",
            ]),
            filters: JSON.stringify([]),
          },
        });

        setUsers((res.data?.users || []) as StaffUser[]);
        setTotalUsers(res.data?.pagination?.totalUsers || 0);
      } catch (error) {
        setUsers([]);
        setTotalUsers(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDirectory();
  }, [id, pageIndex, pageSize]);

  const departmentColorMap = useMemo(() => {
    return new Map(
      departments.map((department) => [department.name, department.color]),
    );
  }, [departments]);

  const groupedUsers = useMemo(() => {
    const groups = new Map<string, StaffUser[]>();

    for (const user of users) {
      const userDepartments = Array.isArray(user.departments)
        ? user.departments
        : [];
      if (userDepartments.length === 0) {
        continue;
      }

      for (const department of userDepartments) {
        const existing = groups.get(department) || [];
        existing.push(user);
        groups.set(department, existing);
      }
    }

    return Array.from(groups.entries()).sort((a, b) => {
      return a[0].localeCompare(b[0]);
    });
  }, [users]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="pagePadding">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium text-zinc-900 dark:text-white">
              Staff Directory
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Grouped by department
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2">
            <IconUsers className="w-4 h-4" />
            <span>{totalUsers} total staff</span>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white dark:bg-zinc-800/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700/50 rounded-lg p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Loading directory...
              </p>
            </div>
          </div>
        ) : groupedUsers.length === 0 ? (
          <div className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-10 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <IconUsers className="w-8 h-8 text-primary" />
              </div>
              <p className="text-zinc-700 dark:text-zinc-300">
                No staff members found.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedUsers.map(([departmentName, members]) => (
              <section
                key={departmentName}
                className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
              >
                <header className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          departmentName === "Unassigned"
                            ? "#9ca3af"
                            : departmentColorMap.get(departmentName) ||
                              "#60a5fa",
                      }}
                    />
                    <h2 className="font-semibold text-zinc-900 dark:text-white truncate">
                      {departmentName}
                    </h2>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200">
                    {members.length} on this page
                  </span>
                </header>

                <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {members.map((user) => (
                    <button
                      key={`${departmentName}-${user.info.userId}`}
                      onClick={() =>
                        router.push(
                          `/workspace/${id}/profile/${user.info.userId}`,
                        )
                      }
                      className="text-left flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-white dark:hover:bg-zinc-700/70 transition-colors"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getRandomBg(
                          String(user.info.userId),
                          user.info.username || undefined,
                        )}`}
                      >
                        <img
                          src={user.info.picture || "/default-avatar.jpg"}
                          alt={user.info.username || String(user.info.userId)}
                          className="w-10 h-10 rounded-full border-2 border-white object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-white truncate">
                            {user.info.displayName && user.info.username
                              ? `${user.info.displayName} (@${user.info.username})`
                              : user.info.displayName
                                ? user.info.displayName
                                : user.info.username
                                  ? `@${user.info.username}`
                                  : user.info.userId}
                          </p>
                          {(() => {
                            const notices = user.inactivityNotices || [];
                            const now = new Date();
                            const approved = notices.filter(
                              (n) =>
                                n.approved === true &&
                                n.reviewed === true &&
                                n.revoked === false,
                            );
                            const active = approved.find(
                              (n) =>
                                n.endTime &&
                                new Date(n.startTime as string) <= now &&
                                new Date(n.endTime) >= now,
                            );
                            if (active) {
                              return (
                                <span
                                  className="flex-shrink-0"
                                  title={`On notice: ${active.reason || "N/A"}`}
                                >
                                  <IconBeach className="w-4 h-4 text-amber-500" />
                                </span>
                              );
                            }
                            const upcoming = approved.find(
                              (n) => new Date(n.startTime as string) > now,
                            );
                            if (upcoming) {
                              return (
                                <span
                                  className="flex-shrink-0"
                                  title={`Upcoming notice (starts ${new Date(upcoming.startTime as string).toLocaleDateString()})`}
                                >
                                  <IconBeach className="w-4 h-4 text-emerald-500" />
                                </span>
                              );
                            }
                            const past = approved.find(
                              (n) => n.endTime && new Date(n.endTime) < now,
                            );
                            if (past) {
                              return (
                                <span
                                  className="flex-shrink-0"
                                  title={`Previous notice (ended ${new Date(past.endTime as string).toLocaleDateString()})`}
                                >
                                  <IconBeach className="w-4 h-4 text-zinc-400" />
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {user.rankName || "Guest"}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                          <IconBuilding className="w-3.5 h-3.5" />
                          <span className="truncate">
                            {Array.isArray(user.departments) &&
                            user.departments.length > 0
                              ? user.departments.join(", ")
                              : ""}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <div className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 md:p-4 flex items-center justify-center gap-2 md:gap-3">
              <button
                onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                disabled={pageIndex === 0}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-700/30 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <span className="px-3 py-2 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200">
                Page {pageIndex + 1} of {totalPages}
              </span>

              <button
                onClick={() =>
                  setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))
                }
                disabled={pageIndex + 1 >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-700/30 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <IconChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

StaffDirectoryPage.layout = workspace;
export default StaffDirectoryPage;
