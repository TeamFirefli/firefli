import React, { useEffect, useState, useRef } from "react";
import Confetti from "react-confetti";
import { useRouter } from "next/router";
import { IconGift } from "@tabler/icons-react";
import axios from "axios";

type BirthdayUser = {
  userid: string;
  username: string;
  picture: string;
  birthdayDay: number;
  birthdayMonth: number;
};

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

function getDaysUntilBirthday(day: number, month: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let nextBirthday = new Date(today.getFullYear(), month - 1, day);

  if (nextBirthday < today) {
    nextBirthday = new Date(today.getFullYear() + 1, month - 1, day);
  }

  const diffTime = nextBirthday.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

const monthNames = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Birthdays() {
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const router = useRouter();
  const { id: workspaceId } = router.query;
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!workspaceId) return;
    axios.get(`/api/workspace/${workspaceId}/home/upcoming?days=7`).then(res => {
      if (res.status === 200) {
        setBirthdays(res.data.birthdays);
      }
    });
  }, [workspaceId]);

  useEffect(() => {
    function updateSize() {
      if (cardRef.current) {
        setCardSize({
          width: cardRef.current.offsetWidth,
          height: cardRef.current.offsetHeight,
        });
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const usersWithDays = birthdays
    .map(user => ({
      ...user,
      daysAway: getDaysUntilBirthday(user.birthdayDay, user.birthdayMonth),
    }))
    .filter(user => user.daysAway >= 0 && user.daysAway <= 7);

  if (usersWithDays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <IconGift className="w-8 h-8 text-primary" />
        </div>
        <p className="text-lg font-medium text-zinc-900 dark:text-white mb-1">No upcoming birthdays</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No upcoming birthdays in the next 7 days</p>
      </div>
    );
  }

  return (
    <div ref={cardRef} className="relative flex flex-col gap-4">
      {showConfetti && cardSize.width > 0 && cardSize.height > 0 && (
        <Confetti width={cardSize.width} height={cardSize.height} numberOfPieces={300} recycle={true} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
      )}
      <div className="flex flex-col gap-3">
        {usersWithDays.map(user => (
          <div
            key={user.userid}
            className="flex items-center gap-3 bg-white dark:bg-zinc-800 p-3 rounded-lg shadow-sm"
            onMouseEnter={() => {
              if (user.daysAway === 0) {
                if (cardRef.current) {
                  setCardSize({
                    width: cardRef.current.offsetWidth,
                    height: cardRef.current.offsetHeight,
                  });
                }
                setShowConfetti(true);
              }
            }}
            onMouseLeave={() => {
              if (user.daysAway === 0) setShowConfetti(false);
            }}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${getRandomBg(user.userid)}`}>
              <img
                src={user.picture}
                alt={user.username}
                className="w-12 h-12 rounded-full object-cover border-2 border-white"
                style={{ background: "transparent" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-zinc-900 dark:text-white">{user.username}</div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {user.daysAway === 0
                  ? "🎉 Birthday Today!"
                  : user.daysAway === 1
                  ? "Tomorrow"
                  : `In ${user.daysAway} days (${monthNames[user.birthdayMonth]} ${user.birthdayDay})`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
