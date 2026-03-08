import { useRouter } from "next/router";
import Link from "next/link";
import clsx from "clsx";
import { IconPlus, IconX } from "@tabler/icons-react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { ComponentType, useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface SecondarySidebarItem {
  id?: string;
  label?: string;
  name?: string;
  href?: string;
  icon?:
    | ComponentType<{ className?: string }>
    | React.ReactNode
    | IconSvgElement;
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
  icon?: IconSvgElement;
  items: SecondarySidebarItem[];
  onAdd?: () => void;
  canAdd?: boolean;
  draggable?: boolean;
  onReorder?: (items: SecondarySidebarItem[]) => void;
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
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
    onDelete: (id: string) => void;
  } | null>(null);

  const scrollToTop = () => {
    const mainContent = document.getElementById('main-content-scroll');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleItemClick = (item: SecondarySidebarItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      router.push(item.href, undefined, { scroll: false }).then(() => {
        scrollToTop();
      });
    }
  };

  useEffect(() => {
    const handleRouteChange = () => {
      scrollToTop();
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  interface SortableItemProps {
    item: SecondarySidebarItem;
    itemIndex: number;
    isActive: boolean;
    displayName: string;
    renderIcon: (hasColorBg?: boolean) => React.ReactNode;
    handleItemClick: (item: SecondarySidebarItem) => void;
    setDeleteConfirm: (
      confirm: {
        id: string;
        name: string;
        onDelete: (id: string) => void;
      } | null,
    ) => void;
    draggable?: boolean;
    scrollToTop: () => void;
  }

  const SortableItem: React.FC<SortableItemProps> = ({
    item,
    itemIndex,
    isActive,
    displayName,
    renderIcon,
    handleItemClick,
    setDeleteConfirm,
    draggable,
    scrollToTop,
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: item.id || `item-${itemIndex}`,
      disabled: !draggable,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
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
              setDeleteConfirm({
                id: item.id!,
                name: displayName,
                onDelete: item.onDelete!,
              });
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
      draggable && "cursor-grab active:cursor-grabbing",
      isActive
        ? "bg-[color:rgb(var(--group-theme)/0.1)] text-[color:rgb(var(--group-theme))]"
        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50",
    );

    if (item.href && !item.onClick) {
      return (
        <Link
          ref={setNodeRef}
          style={style}
          href={item.href}
          className={itemClassName}
          scroll={false}
          onClick={() => {
            setTimeout(() => {
              scrollToTop();
            }, 0);
          }}
          {...(draggable ? { ...attributes, ...listeners } : {})}
        >
          {itemContent}
        </Link>
      );
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={itemClassName}
        onClick={() => handleItemClick(item)}
        {...(draggable ? { ...attributes, ...listeners } : {})}
      >
        {itemContent}
      </div>
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (
    event: DragEndEvent,
    section: SecondarySidebarSection,
  ) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = section.items.findIndex(
        (item) => (item.id || "") === active.id,
      );
      const newIndex = section.items.findIndex(
        (item) => (item.id || "") === over.id,
      );

      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(section.items, oldIndex, newIndex);
        if (section.onReorder) {
          section.onReorder(newItems);
        }
      }
    }
  };

  return (
    <aside
      className={clsx(
        "w-56 hidden md:flex flex-col flex-shrink-0 h-full",
        "bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800",
        "rounded-tl-2xl",
        className,
      )}
    >
      {!hideHeader && (
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {title}
          </h3>
        </div>
      )}

      <div
        className={clsx(
          "flex-1 overflow-y-auto",
          hideHeader ? "pt-2 px-2 pb-2" : "p-2",
        )}
      >
        {sections.map((section, sectionIndex) => {
          const renderIcon = (
            hasColorBg = false,
          ): ((item: SecondarySidebarItem) => React.ReactNode) => {
            return (item: SecondarySidebarItem) => {
              if (!item.icon) return null;
              const iconClass = hasColorBg
                ? "w-4 h-4 text-white dark:text-black"
                : "w-4 h-4 text-zinc-700 dark:text-zinc-200";

              if (Array.isArray(item.icon)) {
                return (
                  <HugeiconsIcon
                    icon={item.icon as IconSvgElement}
                    className={iconClass}
                    strokeWidth={1.5}
                  />
                );
              }
              if (typeof item.icon === "function") {
                const IconComponent = item.icon as ComponentType<{
                  className?: string;
                }>;
                return <IconComponent className={iconClass} />;
              }
              if (
                typeof item.icon === "object" &&
                item.icon !== null &&
                "$$typeof" in item.icon
              ) {
                const IconComponent = item.icon as unknown as ComponentType<{
                  className?: string;
                }>;
                return <IconComponent className={iconClass} />;
              }
              return null;
            };
          };

          return (
            <div key={sectionIndex} className="mb-2 last:mb-0">
              {(section.title || section.canAdd) && (
                <div className="flex items-center justify-between px-2 py-1.5">
                  {section.title && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      {section.icon && (
                        <HugeiconsIcon
                          icon={section.icon}
                          className="w-3.5 h-3.5"
                        />
                      )}
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
                {section.draggable ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, section)}
                  >
                    <SortableContext
                      items={section.items.map(
                        (item, idx) => item.id || `item-${idx}`,
                      )}
                      strategy={verticalListSortingStrategy}
                    >
                      {section.items.map((item, itemIndex) => {
                        const isActive =
                          item.active === true ||
                          item.isActive === true ||
                          router.asPath === item.href;
                        const displayName = item.label || item.name || "";
                        const iconRenderer = renderIcon();

                        return (
                          <SortableItem
                            key={item.id || `item-${itemIndex}`}
                            item={item}
                            itemIndex={itemIndex}
                            isActive={isActive}
                            displayName={displayName}
                            renderIcon={(hasColorBg) => iconRenderer(item)}
                            handleItemClick={handleItemClick}
                            setDeleteConfirm={setDeleteConfirm}
                            draggable={section.draggable}
                            scrollToTop={scrollToTop}
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                ) : (
                  section.items.map((item, itemIndex) => {
                    const isActive =
                      item.active === true ||
                      item.isActive === true ||
                      router.asPath === item.href;
                    const displayName = item.label || item.name || "";
                    const itemKey = item.id || `item-${itemIndex}`;
                    const iconRenderer = renderIcon();

                    const itemContent = (
                      <>
                        {item.icon && item.color ? (
                          <span
                            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: item.color }}
                          >
                            {iconRenderer(item)}
                          </span>
                        ) : item.icon ? (
                          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                            {iconRenderer(item)}
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
                              setDeleteConfirm({
                                id: item.id!,
                                name: displayName,
                                onDelete: item.onDelete!,
                              });
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
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50",
                    );

                    if (item.href && !item.onClick) {
                      return (
                        <Link
                          key={itemKey}
                          href={item.href}
                          className={itemClassName}
                          scroll={false}
                          onClick={() => {
                            setTimeout(() => {
                            scrollToTop();
                           }, 0);
                          }}
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
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-5 w-full max-w-xs mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
              Delete View
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Are you sure you want to delete "
              <span className="font-medium">{deleteConfirm.name}</span>"?
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
              This action cannot be undone.
            </p>
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
