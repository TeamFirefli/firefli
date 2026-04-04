import { useEffect, useState } from "react";

export default function IOSbanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isInStandaloneMode =
      ("standalone" in window.navigator && (window.navigator as any).standalone === true) ||
      window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem("pwa-install-dismissed") === "1";
    if (isIOS && !isInStandaloneMode && !dismissed) {
      setShow(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem("pwa-install-dismissed", "1");
    setShow(false);
  }

  if (!show) return null;
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] flex items-end justify-center p-4"
      role="dialog"
      aria-label="Install PWA"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-800 shadow-2xl border border-zinc-200 dark:border-zinc-700 p-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/favicon.png"
            alt="Firefli"
            width={44}
            height={44}
            className="rounded-xl shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-tight">
              Install Firefli
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Add to your home screen for the best experience.
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors -mt-0.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Step number={1}>
            Tap the{" "}
            <ShareIcon className="inline-block w-4 h-4 align-text-bottom mx-0.5" />{" "}
            <span className="font-medium">Share </span> button in Safari&apos;s toolbar.
          </Step>
          <Step number={2}>
            Scroll down and tap{" "}
            <span className="font-medium">&ldquo;Add to Home Screen&rdquo;</span>.
          </Step>
          <Step number={3}>
            Tap <span className="font-medium">Add</span>, and done!
          </Step>
        </div>
      </div>
    </div>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
      <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold text-[10px]">
        {number}
      </span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
