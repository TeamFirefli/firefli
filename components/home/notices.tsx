import axios from "axios";
import React from "react";
import { useRouter } from "next/router";
import moment from "moment";
import Tooltip from "@/components/tooltip";
import { IconAlertTriangle, IconChevronRight } from "@tabler/icons-react";

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

function getRandomBg(userid: string) {
  const key = String(userid ?? "");
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) ^ key.charCodeAt(i);
  }
  return BG_COLORS[(hash >>> 0) % BG_COLORS.length];
}

interface InactiveUser {
  userId: number;
  username: string;
  reason: string;
  from: string | Date;
  to: string | Date;
  picture: string;
}

const NoticesWidget: React.FC = () => {
  const router = useRouter();
  const [inactiveUsers, setInactiveUsers] = React.useState<InactiveUser[]>([]);

  React.useEffect(() => {
    if (!router.query.id) return;
    axios
      .get(`/api/workspace/${router.query.id}/activity/users`)
      .then((res) => {
        const data = res.data?.message || {};
        setInactiveUsers(data.inactiveUsers || []);
      })
      .catch((err) => {
        if (!axios.isAxiosError(err) || err.response?.status !== 403) {
          console.error("Error fetching inactive users:", err);
        }
      });
  }, [router.query.id]);

  if (!inactiveUsers.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-[clamp(2rem,15cqh,4rem)] h-[clamp(2rem,15cqh,4rem)] rounded-full bg-primary/10 flex items-center justify-center mb-[clamp(0.5rem,4cqh,1rem)]">
          <IconAlertTriangle className="w-[clamp(1rem,8cqh,2rem)] h-[clamp(1rem,8cqh,2rem)] text-primary" />
        </div>
        <p className="text-[clamp(0.875rem,5cqh,1.125rem)] font-medium text-zinc-900 dark:text-white mb-1">No active notices</p>
        <p className="text-[clamp(0.75rem,3.5cqh,0.875rem)] text-zinc-500 dark:text-zinc-400 mb-4">No staff currently on notice</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {inactiveUsers.map((u) => (
          <Tooltip
            key={u.userId}
            tooltipText={`${u.username} | ${moment(u.from).format("DD MMM")} - ${moment(u.to).format("DD MMM")}`}
            orientation="top"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center ${getRandomBg(
                String(u.userId)
              )} ring-2 ring-primary/10 hover:ring-primary/30 transition-all`}
            >
              <img
                src={u.picture || "/default-avatar.jpg"}
                alt={u.username}
                className="w-14 h-14 rounded-full object-cover border-2 border-white"
                onError={(e) => { e.currentTarget.src = "/default-avatar.jpg"; }}
              />
            </div>
          </Tooltip>
        ))}
      </div>
      <button
        onClick={() => router.push(`/workspace/${router.query.id}/notices`)}
        className="inline-flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        View all notices
        <IconChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default NoticesWidget;
