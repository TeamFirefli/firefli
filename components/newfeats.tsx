import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { IconSparkles, IconX } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

interface ChangelogEntry {
  title: string;
  pubDate: string;
  content: string;
}

const PREFIX = "_";

const newFeatures = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [latestEntry, setLatestEntry] = useState<ChangelogEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndCheckChangelog = async () => {
      try {
        const res = await fetch("/api/changelog");
        const data: ChangelogEntry[] = await res.json();
        
        if (data && data.length > 0) {
          const latest = data[0];
          const entryKey = `${PREFIX}${latest.title}`;
          const hasSeen = localStorage.getItem(entryKey);
          
          if (!hasSeen) {
            setLatestEntry(latest);
            setIsOpen(true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch changelog:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndCheckChangelog();
  }, []);

  const handleClose = () => {
    if (latestEntry) {
      const entryKey = `${PREFIX}${latestEntry.title}`;
      localStorage.setItem(entryKey, "true");
    }
    setIsOpen(false);
  };

  if (loading || !latestEntry) return null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[10000]" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-zinc-900 dark:text-white flex items-center gap-2"
                  >
                    <IconSparkles className="w-5 h-5 text-primary" />
                    What&apos;s New
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <IconX className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold text-zinc-900 dark:text-white">
                    {latestEntry.title}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {new Date(latestEntry.pubDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  <div className="text-sm text-zinc-600 dark:text-zinc-300 prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:my-2">
                    <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                      {latestEntry.content}
                    </ReactMarkdown>
                  </div>
                </div>

                <div className="mt-6 flex justify-between items-center">
                  <a
                    href="https://feedback.firefli.net/changelog"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-600 dark:text-zinc-300 hover:underline"
                  >
                    View full changelog
                  </a>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
                    onClick={handleClose}
                  >
                    Got it!
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default newFeatures;
