"use client";

import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
  Megaphone,
  MessageSquareText,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export type PortalNotificationItem = {
  id: string;
  kind: "platform" | "task" | "deadline" | "feedback";
  title: string;
  description: string;
  meta: string;
  href: string;
};

const notificationPresentation = {
  platform: {
    icon: Megaphone,
    iconClassName: "bg-violet-50 text-violet-700 ring-violet-600/15",
  },
  task: {
    icon: ClipboardCheck,
    iconClassName: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  },
  deadline: {
    icon: CalendarClock,
    iconClassName: "bg-amber-50 text-amber-700 ring-amber-600/15",
  },
  feedback: {
    icon: MessageSquareText,
    iconClassName: "bg-sky-50 text-sky-700 ring-sky-600/15",
  },
} as const;

type NotificationTabKey = "platform" | "feedback" | "learning";

type NotificationTabConfig = {
  key: NotificationTabKey;
  title: string;
  description: string;
  emptyMessage: string;
  items: PortalNotificationItem[];
  icon: typeof Bell;
  iconClassName: string;
  loadFailed: boolean;
};

function tabElementId(key: NotificationTabKey) {
  return `notification-tab-${key}`;
}

function panelElementId(key: NotificationTabKey) {
  return `notification-panel-${key}`;
}

function NotificationTabBar({
  tabs,
  activeKey,
  onSelect,
}: {
  tabs: NotificationTabConfig[];
  activeKey: NotificationTabKey;
  onSelect: (key: NotificationTabKey) => void;
}) {
  const buttonRefs = useRef<Partial<Record<NotificationTabKey, HTMLButtonElement | null>>>({});

  function focusAndSelect(key: NotificationTabKey) {
    onSelect(key);
    buttonRefs.current[key]?.focus();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const currentIndex = tabs.findIndex((tab) => tab.key === activeKey);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
    focusAndSelect(tabs[nextIndex].key);
  }

  return (
    <div
      role="tablist"
      aria-label="消息分类"
      onKeyDown={handleKeyDown}
      className="flex gap-1 border-b border-slate-100 px-3 pt-3 sm:px-4"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        const TabIcon = tab.icon;
        return (
          <button
            key={tab.key}
            ref={(node) => {
              buttonRefs.current[tab.key] = node;
            }}
            type="button"
            role="tab"
            id={tabElementId(tab.key)}
            aria-controls={panelElementId(tab.key)}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(tab.key)}
            className={`flex flex-1 min-w-0 items-center justify-center gap-1.5 rounded-t-xl px-2 py-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
              isActive
                ? "bg-slate-100 text-slate-950"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <TabIcon size={15} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{tab.title}</span>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                isActive ? "bg-white text-slate-600" : "bg-slate-200/70 text-slate-500"
              }`}
            >
              {tab.loadFailed ? "—" : tab.items.length}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NotificationPanel({
  tab,
  onNavigate,
}: {
  tab: NotificationTabConfig;
  onNavigate: () => void;
}) {
  const { key, title, description, emptyMessage, items, loadFailed } = tab;

  return (
    <section
      role="tabpanel"
      id={panelElementId(key)}
      aria-labelledby={tabElementId(key)}
      tabIndex={0}
      aria-label={title}
      className="min-w-0 p-4 sm:p-5 focus-visible:outline-none"
    >
      <p className="text-xs text-slate-500">{description}</p>

      {loadFailed ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-4 text-sm font-bold text-amber-800" role="alert">
          该栏目暂时无法加载，请稍后重试。
        </p>
      ) : items.length > 0 ? (
        <div className="mt-3 space-y-1">
          {items.map((notification) => {
            const presentation = notificationPresentation[notification.kind];
            const Icon = presentation.icon;

            return (
              <Link
                key={notification.id}
                href={notification.href}
                onClick={onNavigate}
                className="group flex min-h-24 items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${presentation.iconClassName}`}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 text-sm font-black text-slate-900">
                      {notification.title}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                      {notification.meta}
                    </span>
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600">
                    {notification.description}
                  </span>
                </span>
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="mt-7 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600"
                />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center">
          <p className="text-sm font-bold text-slate-500">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}

export function PortalNotificationMenu({
  notifications,
  learningLoadFailed,
  platformLoadFailed,
  reloadHref,
}: {
  notifications: PortalNotificationItem[];
  learningLoadFailed: boolean;
  platformLoadFailed: boolean;
  reloadHref: string;
}) {
  const [open, setOpen] = useState(false);
  const platformNotifications = notifications.filter(
    (notification) => notification.kind === "platform",
  );
  const teacherNotifications = notifications.filter(
    (notification) => notification.kind === "feedback",
  );
  const learningNotifications = notifications.filter(
    (notification) =>
      notification.kind === "task" || notification.kind === "deadline",
  );
  const count = notifications.length;
  const anyLoadFailed = learningLoadFailed || platformLoadFailed;
  const triggerLabel = anyLoadFailed
    ? "消息中心有栏目暂时无法加载"
    : count > 0
      ? `消息中心，共 ${count} 条提示`
      : "消息中心，没有新的提示";

  const tabs: NotificationTabConfig[] = [
    {
      key: "platform",
      title: "平台提示",
      description: "平台与机构发布的公告",
      emptyMessage: "暂无平台提示",
      items: platformNotifications,
      icon: Megaphone,
      iconClassName: "bg-violet-50 text-violet-700",
      loadFailed: platformLoadFailed,
    },
    {
      key: "feedback",
      title: "老师提示",
      description: "老师发布的学习反馈",
      emptyMessage: "暂无老师提示",
      items: teacherNotifications,
      icon: GraduationCap,
      iconClassName: "bg-sky-50 text-sky-700",
      loadFailed: learningLoadFailed,
    },
    {
      key: "learning",
      title: "学习消息",
      description: "任务安排与截止提醒",
      emptyMessage: "暂无学习消息",
      items: learningNotifications,
      icon: BookOpenCheck,
      iconClassName: "bg-emerald-50 text-emerald-700",
      loadFailed: learningLoadFailed,
    },
  ];
  // 默认打开顺序：先看有没有真实内容的分类；都没有内容时，优先展示加载失败的分类
  // （否则失败的栏目会被挤到没人点开的 tab 里，看起来像是"没有新提示"而不是"加载失败"）；
  // 都不满足才退回"平台提示"。
  const defaultTabKey =
    tabs.find((tab) => !tab.loadFailed && tab.items.length > 0)?.key
    ?? tabs.find((tab) => tab.loadFailed)?.key
    ?? "platform";
  const [activeTabKey, setActiveTabKey] = useState<NotificationTabKey>(defaultTabKey);
  const activeTab = tabs.find((tab) => tab.key === activeTabKey) ?? tabs[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={triggerLabel}
        title="消息中心"
        className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <Bell size={19} aria-hidden="true" />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-rose-500 ring-2 ring-white"
          />
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        positionerClassName="max-w-[calc(100vw-2rem)]"
        className="max-h-[min(34rem,calc(100dvh-7rem))] w-[min(26rem,calc(100vw-2rem))] max-w-none overflow-y-auto rounded-2xl border-slate-200 bg-white p-0 text-slate-950 shadow-[0_28px_80px_-24px_rgba(15,23,42,0.52)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <PopoverTitle className="text-base font-black text-slate-950">
              消息中心
            </PopoverTitle>
            <PopoverDescription className="mt-1 text-xs font-semibold text-slate-500">
              平台通知、老师反馈和学习提醒，切换分类查看。
            </PopoverDescription>
          </div>
          {anyLoadFailed ? (
            <a
              href={reloadHref}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              重新加载
              <ArrowRight size={14} aria-hidden="true" />
            </a>
          ) : null}
        </div>

        <NotificationTabBar tabs={tabs} activeKey={activeTabKey} onSelect={setActiveTabKey} />
        <NotificationPanel tab={activeTab} onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
