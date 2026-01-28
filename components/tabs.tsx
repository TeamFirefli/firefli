import { useRouter } from "next/router";
import Link from "next/link";
import clsx from "clsx";
import { IconPlus, IconX } from "@tabler/icons-react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { ComponentType, useState } from "react";

export interface SecondarySidebarItem {
  id?: string;
  label?: string;
  name?: string;
  href?: string;
  icon?: ComponentType<{ className?: string }> | React.ReactNode | IconSvgElement;
  color?: string;
  onClick?: () => void;
  active?: boolean;
  isActive?: boolean;
  badge?: number;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}

export interface SecondarySidebarSection {
  title?: string;
  items: SecondarySidebarItem[];
  onAdd?: () => void;
  canAdd?: boolean;
}

interface SecondarySidebarProps {
  title: string;
  sections: SecondarySidebarSection[];
  className?: string;
  hideHeader?: boolean;
}

const SecondarySidebar: React.FC<SecondarySidebarProps> = ({
  title,
  sections,
  className,
  hideHeader,
}) => {
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; onDelete: (id: string) => void } | null>(null);

  const handleItemClick = (item: SecondarySidebarItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <aside className={clsx(
      "w-56 hidden md:flex flex-col flex-shrink-0 h-full",
      "bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800",
      "rounded-tl-2xl",
      className
    )}>
      {!hideHeader && (
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {title}
          </h3>
        </div>
      )}

      <div className={clsx("flex-1 overflow-y-auto", hideHeader ? "pt-2 px-2 pb-2" : "p-2")}>
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-2 last:mb-0">
                {(section.title || section.canAdd) && (
                  <div className="flex items-center justify-between px-2 py-1.5">
                    {section.title && (
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {section.title}
                      </span>
                    )}
                    {section.canAdd && section.onAdd && (
                      <button
                        onClick={section.onAdd}
                        className="p-1 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                        title="Add new"
                      >
                        <IconPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-0.5">
                  {section.items.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                      No items
                    </p>
                  )}
                  {section.items.map((item, itemIndex) => {
                    const isActive = item.active === true || item.isActive === true || router.asPath === item.href;
                    const displayName = item.label || item.name || "";
                    const itemKey = item.id || `item-${itemIndex}`;
                    const renderIcon = (hasColorBg = false): React.ReactNode => {
                      if (!item.icon) return null;
                      const iconClass = hasColorBg 
                        ? "w-4 h-4 text-white dark:text-black" 
                        : "w-4 h-4 text-zinc-700 dark:text-zinc-200";
                      
                      if (Array.isArray(item.icon)) {
                        return <HugeiconsIcon icon={item.icon as IconSvgElement} className={iconClass} strokeWidth={1.5} />;
                      }
                      if (typeof item.icon === 'function') {
                        const IconComponent = item.icon as ComponentType<{ className?: string }>;
                        return <IconComponent className={iconClass} />;
                      }
                      if (typeof item.icon === 'object' && item.icon !== null && '$$typeof' in item.icon) {
                        const IconComponent = item.icon as unknown as ComponentType<{ className?: string }>;
                        return <IconComponent className={iconClass} />;
                      }
                      return null;
                    };

                    const itemContent = (
                      <>
                        {item.icon && item.color ? (
                          <span
                            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: item.color }}
                          >
                            {renderIcon(true)}
                          </span>
                        ) : item.icon ? (
                          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                            {renderIcon()}
                          </span>
                        ) : item.color ? (
                          <span
                            className="flex-shrink-0 w-7 h-7 rounded-lg"
                            style={{ background: item.color }}
                          />
                        ) : null}
                        <span className="flex-1 text-sm font-medium truncate">
                          {displayName}
                        </span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="flex-shrink-0 min-w-[1.25rem] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {item.badge}
                          </span>
                        )}
                        {item.canDelete && item.onDelete && item.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setDeleteConfirm({ id: item.id!, name: displayName, onDelete: item.onDelete! });
                            }}
                            className="flex-shrink-0 p-1 rounded-md text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition"
                            title="Delete"
                          >
                            <IconX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    );

                    const itemClassName = clsx(
                      "group flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-all",
                      isActive
                        ? "bg-[color:rgb(var(--group-theme)/0.1)] text-[color:rgb(var(--group-theme))]"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                    );

                    if (item.href && !item.onClick) {
                      return (
                        <Link
                          key={itemKey}
                          href={item.href}
                          className={itemClassName}
                        >
                          {itemContent}
                        </Link>
                      );
                    }

                    return (
                      <div
                        key={itemKey}
                        className={itemClassName}
                        onClick={() => handleItemClick(item)}
                      >
                        {itemContent}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div 
            className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-5 w-full max-w-xs mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
              Delete View
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Are you sure you want to delete "<span className="font-medium">{deleteConfirm.name}</span>"?</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-sm rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteConfirm.onDelete(deleteConfirm.id);
                  setDeleteConfirm(null);
                }}
                className="px-3 py-1.5 text-sm rounded-md bg-red-500 hover:bg-red-600 text-white transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default SecondarySidebar;