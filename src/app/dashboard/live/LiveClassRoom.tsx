"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eraser,
  GraduationCap,
  GripVertical,
  Loader2,
  LogOut,
  MessageSquareText,
  Mic,
  MicOff,
  PenLine,
  PhoneOff,
  UserPlus,
  Users,
} from "lucide-react";

import { HangulInteractiveBook } from "@/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/HangulInteractiveBook";
import { createClient } from "@/lib/supabase/client";

import {
  addLiveClassMemberAction,
  endLiveClassAction,
  getAddableLiveClassStudentsAction,
  getLiveClassParticipantsAction,
  setLiveClassVoicePermissionAction,
  updateLiveClassChapterAction,
  type AddableLiveClassStudent,
  type LiveClassParticipant,
  type LiveClassSessionRow,
} from "./actions";
import { LiveCanvas } from "./LiveCanvas";
import {
  liveChannelName,
  type LiveClassEventRow,
  type LiveEvent,
  type LiveEventInput,
  type LiveNote,
  type LiveStroke,
} from "./live-realtime";
import { useLiveVoiceChat } from "./useLiveVoiceChat";
import { useGroupVoiceChat } from "./useGroupVoiceChat";

const PEN_COLORS = ["#e8590c", "#1c7ed6", "#2f9e44", "#f03e3e", "#6741d9", "#000000"];
const PEN_WIDTHS = [3, 6, 10];

type PresenceEntry = { role: string; name: string };

export function LiveClassRoom({
  session,
  isTeacher,
  currentUserId,
  participants,
  courseTitle,
  lessonTitle,
  backHref,
}: {
  session: LiveClassSessionRow;
  isTeacher: boolean;
  currentUserId: string;
  participants: LiveClassParticipant[];
  courseTitle: string;
  lessonTitle: string;
  backHref: string;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<Record<string, PresenceEntry>>({});
  const [ended, setEnded] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [isClassDrawerOpen, setIsClassDrawerOpen] = useState(true);
  const [participantList, setParticipantList] = useState(participants);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteAdding, setInviteAdding] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [addableStudents, setAddableStudents] = useState<AddableLiveClassStudent[]>([]);
  const [inviteChecked, setInviteChecked] = useState<Set<string>>(new Set());
  const [voicePermissionUpdating, setVoicePermissionUpdating] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(0);
  const [remotePage, setRemotePage] = useState<number | null>(null);
  const [chapterSlug, setChapterSlug] = useState(session.chapter_slug);
  const [strokesByPage, setStrokesByPage] = useState<Record<number, LiveStroke[]>>({});
  const [notesByPage, setNotesByPage] = useState<Record<number, LiveNote[]>>({});
  const [tool, setTool] = useState<"pen" | "note">("pen");
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [width, setWidth] = useState(PEN_WIDTHS[1]);
  // 浮动工具栏位置（可拖动，位置记忆到 localStorage）。
  const TOOLBAR_STORAGE_KEY = `live-toolbar-pos:${session.id}`;
  const [toolbarPos, setToolbarPos] = useState({ x: 16, y: 200 });
  const toolbarDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    let restored = false;
    try {
      const stored = window.localStorage.getItem(TOOLBAR_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { x: number; y: number };
        if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
          // Browser storage is an external source restored once after hydration.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setToolbarPos(parsed);
          restored = true;
        }
      }
    } catch {
      // 忽略损坏的缓存
    }
    if (!restored) {
      setToolbarPos({ x: 16, y: Math.max(96, (window.innerHeight - 360) / 2) });
    }
  }, [TOOLBAR_STORAGE_KEY]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastRemotePageRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(currentUserId);

  // 当前登录用户 id：发送事件时写入 sender_id（RLS 强制其等于 auth.uid()，伪造会被拒）。
  useEffect(() => {
    let cancelled = false;
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) userIdRef.current = data.user?.id ?? null;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 发送事件：INSERT live_class_events，sender_id 由 RLS 服务端强制等于 auth.uid()
  // 并校验 kind 权限（学生无法发送老师专属事件）。
  const sendEvent = useCallback(
    async (event: LiveEventInput) => {
      const senderId = userIdRef.current;
      if (!senderId) return false;
      const base = event as unknown as Record<string, unknown>;
      const { error } = await createClient()
        .from("live_class_events")
        .insert({
          tenant_id: session.tenant_id,
          session_id: session.id,
          sender_id: senderId,
          kind: event.kind,
          chapter_slug:
            "chapterSlug" in event && typeof event.chapterSlug === "string"
              ? event.chapterSlug
              : null,
          page: "page" in event && typeof event.page === "number" ? event.page : null,
          payload: base,
        });
      return !error;
    },
    [session.id, session.tenant_id]
  );

  const peerVoiceChat = useLiveVoiceChat({ sendEvent });
  const groupVoiceChat = useGroupVoiceChat({
    sessionId: session.id,
    currentUserId,
    enabled: session.mode === "group",
  });

  // —— 接收端身份校验：只信任课堂参与者的消息；老师专属事件仅接受 teacher 发出 ——
  const handleEvent = useCallback(
    (event: LiveEvent) => {
      const senderId = event.senderId ?? "";
      // 忽略 Postgres Changes 回声：自己 INSERT 的事件会推回给自己，本地已处理。
      if (senderId && senderId === userIdRef.current) return;
      const isTeacherSender = senderId === session.teacher_id;
      const isStudentSender = senderId === session.student_id;
      // 非参与者（含伪造 senderId）的事件一律忽略。
      if (!isTeacherSender && !isStudentSender) return;

      if (event.kind === "page") {
        // 老师主导翻页：仅接受老师发出的翻页，防止学生伪造翻页干扰老师视图。
        if (!isTeacherSender || event.chapterSlug !== chapterSlug) return;
        lastRemotePageRef.current = event.page;
        setRemotePage(event.page);
      } else if (event.kind === "chapter") {
        // 老师切换章节：双方跟随换书（服务端已校验仅老师可切换）。
        if (!isTeacherSender) return;
        setChapterSlug(event.chapterSlug);
        setCurrentPage(0);
      } else if (event.kind === "stroke") {
        if (!isTeacherSender || event.chapterSlug !== chapterSlug) return;
        setStrokesByPage((current) => ({
          ...current,
          [event.page]: [...(current[event.page] ?? []), event.stroke],
        }));
      } else if (event.kind === "clear") {
        if (!isTeacherSender || event.chapterSlug !== chapterSlug) return;
        setStrokesByPage((current) => ({ ...current, [event.page]: [] }));
        setNotesByPage((current) => ({ ...current, [event.page]: [] }));
      } else if (event.kind === "note") {
        if (!isTeacherSender || event.chapterSlug !== chapterSlug) return;
        setNotesByPage((current) => ({
          ...current,
          [event.page]: [...(current[event.page] ?? []), event.note],
        }));
      } else if (event.kind === "end") {
        // 结束课堂仅老师可广播。
        if (!isTeacherSender) return;
        setEnded(true);
      } else if (event.kind === "rtc-offer") {
        if (session.mode !== "one_on_one") return;
        // 语音发起是老师专属。
        if (!isTeacherSender) return;
        peerVoiceChat.handleSignal(event);
      } else if (event.kind === "rtc-answer") {
        if (session.mode !== "one_on_one") return;
        // answer 应来自学生（回应老师的 offer）。
        if (!isStudentSender) return;
        peerVoiceChat.handleSignal(event);
      } else if (event.kind === "rtc-ice") {
        if (session.mode !== "one_on_one") return;
        // ICE 候选只接受对端发来（老师端收学生的、学生端收老师的），
        // 防止注入任意 candidate 诱导对端浏览器探测地址（senderId 由 DB 强制，不可伪造）。
        if (isTeacherSender === isTeacher) return;
        peerVoiceChat.handleSignal(event);
      } else if (event.kind === "rtc-hangup") {
        if (session.mode !== "one_on_one") return;
        // 语音挂断任一方可发起（不影响课堂会话本身）。
        peerVoiceChat.handleSignal(event);
      }
    },
    [chapterSlug, isTeacher, session.mode, session.teacher_id, session.student_id, peerVoiceChat]
  );

  // —— 事件接收：订阅 live_class_events 的 INSERT（sender_id 由 DB 强制）——
  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    // private: true —— 频道访问受 realtime.messages RLS 约束（仅课堂参与者）。
    const channel = supabase.channel(liveChannelName(session.id), {
      config: { private: true, presence: { key: currentUserId } },
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_class_events",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const row = payload.new as LiveClassEventRow;
          const event = {
            ...(row.payload as LiveEventInput),
            senderId: row.sender_id,
          } as LiveEvent;
          handleEvent(event);
        }
      )
      .on("presence", { event: "sync" }, () => {
        const raw = channel.presenceState() as unknown as Record<
          string,
          PresenceEntry[]
        >;
        const flat: Record<string, PresenceEntry> = {};
        for (const key of Object.keys(raw)) {
          const entry = raw[key]?.[0];
          if (entry) flat[key] = entry;
        }
        setPresence(flat);
      });

    void (async () => {
      const { data: authData } = await supabase.auth.getSession();
      const accessToken = authData.session?.access_token;
      if (accessToken) await supabase.realtime.setAuth(accessToken);
      if (disposed) return;
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          await channel.track({
            role: isTeacher ? "teacher" : "student",
            name:
              participantList.find((participant) => participant.id === currentUserId)?.name ??
              (isTeacher ? "老师" : "学生"),
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });
    })();
    channelRef.current = channel;
    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, isTeacher, currentUserId, participantList]);

  // —— 本地翻页上报（与远端翻页做防循环）——
  const handleLocalPageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      if (page !== lastRemotePageRef.current) {
        sendEvent({ kind: "page", chapterSlug, page });
      }
    },
    [sendEvent, chapterSlug]
  );

  // —— 老师切换章节：服务端更新会话 + 广播，双方同步换书 ——
  const handleRequestChapter = useCallback(
    async (nextSlug: string) => {
      if (!isTeacher || nextSlug === chapterSlug) return;
      const result = await updateLiveClassChapterAction(session.id, nextSlug);
      if (result.ok) {
        setChapterSlug(nextSlug);
        setCurrentPage(0);
        sendEvent({ kind: "chapter", chapterSlug: nextSlug });
      }
    },
    [isTeacher, chapterSlug, session.id, sendEvent]
  );

  const handleStrokeComplete = useCallback(
    (stroke: LiveStroke) => {
      setStrokesByPage((current) => ({
        ...current,
        [currentPage]: [...(current[currentPage] ?? []), stroke],
      }));
      sendEvent({
        kind: "stroke",
        chapterSlug,
        page: currentPage,
        stroke,
      });
    },
    [currentPage, sendEvent, chapterSlug]
  );

  const handleClearPage = useCallback(() => {
    setStrokesByPage((current) => ({ ...current, [currentPage]: [] }));
    setNotesByPage((current) => ({ ...current, [currentPage]: [] }));
    sendEvent({ kind: "clear", chapterSlug, page: currentPage });
  }, [currentPage, sendEvent, chapterSlug]);

  const handleNoteAdd = useCallback(
    (note: LiveNote) => {
      setNotesByPage((current) => ({
        ...current,
        [currentPage]: [...(current[currentPage] ?? []), note],
      }));
      sendEvent({
        kind: "note",
        chapterSlug,
        page: currentPage,
        note,
      });
    },
    [currentPage, sendEvent, chapterSlug]
  );

  const handleEnd = useCallback(async () => {
    if (!isTeacher || ending) return;
    if (!window.confirm("确定结束这节课堂？结束后所有学生将立即退出，且不能恢复。")) {
      return;
    }
    setEnding(true);
    setEndError(null);
    const result = await endLiveClassAction(session.id);
    setEnding(false);
    if (result.ok) {
      sendEvent({ kind: "end" });
      router.push(backHref);
    } else {
      setEndError(result.error);
    }
  }, [isTeacher, ending, session.id, sendEvent, backHref, router]);

  const handleLeave = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    router.push(backHref);
  }, [leaving, backHref, router]);

  const openInvite = useCallback(async () => {
    setInviteOpen(true);
    setInviteLoading(true);
    setInviteError(null);
    setInviteChecked(new Set());
    const result = await getAddableLiveClassStudentsAction(session.id);
    setInviteLoading(false);
    if (result.ok) setAddableStudents(result.students);
    else setInviteError(result.error);
  }, [session.id]);

  const confirmInvite = useCallback(async () => {
    const ids = [...inviteChecked];
    if (ids.length === 0 || inviteAdding) return;
    setInviteAdding(true);
    setInviteError(null);
    const result = await addLiveClassMemberAction(session.id, ids);
    if (!result.ok) {
      setInviteAdding(false);
      setInviteError(result.error);
      return;
    }
    const refreshed = await getLiveClassParticipantsAction(session.id);
    setInviteAdding(false);
    if (!refreshed.ok) {
      setInviteError(refreshed.error);
      return;
    }
    setParticipantList(refreshed.participants);
    setInviteOpen(false);
    setInviteChecked(new Set());
  }, [inviteAdding, inviteChecked, session.id]);

  const changeVoicePermission = useCallback(
    async (studentId: string, allowed: boolean) => {
      if (!isTeacher || session.mode !== "group" || voicePermissionUpdating) return;
      setVoicePermissionUpdating(studentId);
      setEndError(null);
      const result = await setLiveClassVoicePermissionAction(session.id, studentId, allowed);
      setVoicePermissionUpdating(null);
      if (!result.ok) {
        setEndError(result.error);
        return;
      }
      await groupVoiceChat.refreshRoom();
    },
    [groupVoiceChat, isTeacher, session.id, session.mode, voicePermissionUpdating]
  );

  const participantRows = participantList.map((participant) => ({
    ...participant,
    label: participant.role === "teacher" ? "老师" : "学生",
    online: Boolean(presence[participant.id]),
    status:
      participant.id === currentUserId && !connected
        ? "连接中"
        : presence[participant.id]
          ? "在线"
          : "未进入",
  }));

  if (ended) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#F4F7F6] p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fdecea] text-[#c92a2a]">
          <PhoneOff size={22} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">课堂已结束</h2>
        <p className="app-muted-text text-sm">
          {isTeacher ? "你已结束这节伴学课堂。" : "老师已结束这节伴学课堂，下次上课见。"}
        </p>
        <button
          type="button"
          onClick={handleLeave}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
        >
          返回
          <LogOut size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-row">

      {/* 主区：电子书 + 画笔层 */}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#101613]/[0.02]">
        <HangulInteractiveBook
          courseId={session.course_id}
          lessonId={session.lesson_id}
          initialProgress={0}
          initialStatus="not_started"
          trackingDisabled
          backHref={backHref}
          unlockedChapterCount={4}
          initialEbookProgress={{}}
          initialChapterSlug={chapterSlug}
          liveMode={{
            role: isTeacher ? "teacher" : "student",
            sidePanelOpen: isClassDrawerOpen,
            participantBar: (
              <div
                aria-label="课堂参与者"
                className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:thin]"
              >
                <span className="mr-1 shrink-0 text-[10px] font-bold tracking-wide text-slate-500">
                  参与者 {participantRows.length}
                </span>
                {participantRows.map((participant) => (
                  <span
                    key={participant.id}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
                      participant.online
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        participant.online ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {participant.label} {participant.name}
                  </span>
                ))}
              </div>
            ),
            remotePage,
            onLocalPageChange: handleLocalPageChange,
            onRequestChapter: handleRequestChapter,
            overlay: (
              <LiveCanvas
                editable={isTeacher}
                tool={tool}
                color={color}
                width={width}
                strokes={strokesByPage[currentPage] ?? []}
                notes={notesByPage[currentPage] ?? []}
                onStrokeComplete={handleStrokeComplete}
                onNoteAdd={handleNoteAdd}
              />
            ),
          }}
        />

        {/* 老师工具栏（可拖动） */}
        {isTeacher && (
          <div
            className="fixed z-50 flex flex-col gap-1 rounded-2xl border bg-white/95 p-2 shadow-xl backdrop-blur"
            style={{ borderColor: "var(--border)", left: toolbarPos.x, top: toolbarPos.y }}
            onPointerMove={(event) => {
              const drag = toolbarDragRef.current;
              if (!drag) return;
              const dx = event.clientX - drag.startX;
              const dy = event.clientY - drag.startY;
              const next = {
                x: Math.min(Math.max(0, drag.origX + dx), Math.max(0, window.innerWidth - 64)),
                y: Math.min(Math.max(0, drag.origY + dy), Math.max(0, window.innerHeight - 56)),
              };
              setToolbarPos(next);
              try {
                window.localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify(next));
              } catch {
                // 隐私模式等场景忽略
              }
            }}
          >
            <div
              className="flex h-7 cursor-move select-none items-center justify-center rounded-lg text-slate-400 transition hover:bg-black/[0.04]"
              title="按住拖动移动工具栏"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                toolbarDragRef.current = {
                  startX: event.clientX,
                  startY: event.clientY,
                  origX: toolbarPos.x,
                  origY: toolbarPos.y,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerUp={() => {
                toolbarDragRef.current = null;
              }}
              onPointerCancel={() => {
                toolbarDragRef.current = null;
              }}
            >
              <GripVertical size={15} />
            </div>
            <button
              type="button"
              title="画笔"
              onClick={() => setTool("pen")}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${tool === "pen" ? "bg-[#238777] text-white" : "text-slate-500 hover:bg-black/[0.05]"}`}
            >
              <PenLine size={17} />
            </button>
            <button
              type="button"
              title="文字批注"
              onClick={() => setTool("note")}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${tool === "note" ? "bg-[#238777] text-white" : "text-slate-500 hover:bg-black/[0.05]"}`}
            >
              <MessageSquareText size={17} />
            </button>
            <button
              type="button"
              title="清除本页笔迹"
              onClick={handleClearPage}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-black/[0.05]"
            >
              <Eraser size={17} />
            </button>

            <div className="my-1 h-px bg-black/[0.08]" />

            {PEN_COLORS.map((penColor) => (
              <button
                key={penColor}
                type="button"
                title={`颜色 ${penColor}`}
                onClick={() => setColor(penColor)}
                className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full transition ${color === penColor ? "ring-2 ring-black/25 ring-offset-1" : "hover:opacity-80"}`}
                style={{ backgroundColor: penColor }}
              >
                {color === penColor && <span className="h-1.5 w-1.5 rounded-full bg-white/90" />}
              </button>
            ))}

            <div className="my-1 h-px bg-black/[0.08]" />

            {PEN_WIDTHS.map((penWidth) => (
              <button
                key={penWidth}
                type="button"
                title={`粗细 ${penWidth}px`}
                onClick={() => setWidth(penWidth)}
                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg transition ${width === penWidth ? "bg-black/[0.06]" : "hover:bg-black/[0.04]"}`}
              >
                <span className="rounded-full bg-slate-700" style={{ width: penWidth, height: penWidth }} />
              </button>
            ))}

            <div className="my-1 h-px bg-black/[0.08]" />

            <button
              type="button"
              title="结束课堂"
              onClick={handleEnd}
              disabled={ending}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fdecea] text-[#c92a2a] transition hover:bg-[#fbdcd9]"
            >
              {ending ? <Loader2 size={17} className="animate-spin" /> : <PhoneOff size={17} />}
            </button>
          </div>
        )}

        {!connected && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-sm">
              <Loader2 className="animate-spin" size={22} style={{ color: "var(--foreground-muted)" }} />
              <p className="app-muted-text text-xs">正在连接课堂…</p>
            </div>
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={() => setIsClassDrawerOpen((open) => !open)}
        aria-controls="live-class-drawer"
        aria-expanded={isClassDrawerOpen}
        aria-label={isClassDrawerOpen ? "收起伴学课堂" : "展开伴学课堂"}
        title={isClassDrawerOpen ? "收起伴学课堂" : "展开伴学课堂"}
        className={`fixed top-1/2 z-[70] flex -translate-y-1/2 items-center gap-1 rounded-l-xl border border-r-0 border-[#cfe2d9] bg-[#238777] px-2 py-3 text-xs font-bold text-white shadow-lg transition-[right] duration-300 hover:bg-[#1d6d60] ${
          isClassDrawerOpen ? "right-72" : "right-0"
        }`}
      >
        {isClassDrawerOpen ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        {!isClassDrawerOpen && <span className="[writing-mode:vertical-rl]">伴学课堂</span>}
      </button>

      {/* 右侧：伴学课堂抽屉（课堂信息/参与者/语音/退出 集中在此） */}
      <aside
        id="live-class-drawer"
        className={`fixed inset-y-0 right-0 z-[60] flex w-72 shrink-0 flex-col overflow-hidden border-l bg-[#f0f7f4] shadow-[-8px_0_24px_rgba(23,63,74,0.08)] transition-transform duration-300 ease-out ${
          isClassDrawerOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#238777] text-white shadow-sm">
              <GraduationCap size={19} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">伴学课堂</p>
            </div>
          </div>
          <p className="app-muted-text mt-2.5 text-[11px] font-semibold leading-5">
            {courseTitle} · {lessonTitle}
          </p>
          <a
            href={backHref}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border bg-white px-3 py-2 text-xs font-bold text-[#315f52] transition hover:bg-[#e9f6f1]"
            style={{ borderColor: "var(--border)" }}
          >
            <ArrowLeft size={14} />
            返回
          </a>
          </div>

          <div className="h-px bg-black/[0.07]" />

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold tracking-wide text-slate-600">参与者</p>
              {isTeacher && session.mode === "group" && (
                <button
                  type="button"
                  onClick={() => void openInvite()}
                  className="inline-flex items-center gap-1 rounded-full bg-[#e2f2ed] px-2.5 py-1 text-[11px] font-bold text-[#1d6d60] transition hover:bg-[#d4ebe4]"
                >
                  <UserPlus size={12} />
                  添加学生
                </button>
              )}
            </div>
            <div className="mt-2 space-y-1.5">
              {participantRows.map((participant) => (
                <div
                  key={participant.id}
                  className="rounded-xl bg-white/65 px-2.5 py-2 text-xs font-semibold text-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${participant.online ? "bg-emerald-500" : "bg-slate-300"}`}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {participant.label} {participant.name}
                    </span>
                    {session.mode === "group" && groupVoiceChat.speakerIds.has(participant.id) && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e2f2ed] px-2 py-0.5 text-[10px] font-bold text-[#1d6d60]">
                        <Mic size={10} /> 发言中
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        participant.online
                          ? "bg-emerald-100 text-emerald-700"
                          : participant.status === "连接中"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {participant.status}
                    </span>
                  </div>
                  {isTeacher && session.mode === "group" && participant.role === "student" && (
                    <button
                      type="button"
                      disabled={voicePermissionUpdating === participant.id}
                      onClick={() =>
                        void changeVoicePermission(
                          participant.id,
                          !groupVoiceChat.grantedStudentIds.has(participant.id)
                        )
                      }
                      className={`mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold transition disabled:opacity-50 ${
                        groupVoiceChat.grantedStudentIds.has(participant.id)
                          ? "bg-[#fdecea] text-[#c92a2a] hover:bg-[#fbdcd9]"
                          : "bg-[#e2f2ed] text-[#1d6d60] hover:bg-[#d4ebe4]"
                      }`}
                    >
                      {voicePermissionUpdating === participant.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : groupVoiceChat.grantedStudentIds.has(participant.id) ? (
                        <MicOff size={10} />
                      ) : (
                        <Mic size={10} />
                      )}
                      {groupVoiceChat.grantedStudentIds.has(participant.id)
                        ? "收回发言权"
                        : "授权开麦"}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {inviteOpen && (
              <div className="mt-3 rounded-xl border border-[#cfe2d9] bg-white p-2.5 shadow-sm">
                <p className="text-[11px] font-bold text-[#315f52]">选择允许中途加入的学生</p>
                {inviteLoading ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Loader2 size={12} className="animate-spin" /> 正在读取学生…
                  </p>
                ) : addableStudents.length === 0 && !inviteError ? (
                  <p className="mt-2 text-[11px] text-slate-500">所有负责学生都已在课堂中。</p>
                ) : (
                  <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                    {addableStudents.map((student) => (
                      <label
                        key={student.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-[#eef6f2]"
                      >
                        <input
                          type="checkbox"
                          checked={inviteChecked.has(student.id)}
                          onChange={() =>
                            setInviteChecked((current) => {
                              const next = new Set(current);
                              if (next.has(student.id)) next.delete(student.id);
                              else next.add(student.id);
                              return next;
                            })
                          }
                          className="accent-[#238777]"
                        />
                        <span className="min-w-0 truncate">{student.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                {inviteError && (
                  <p className="mt-2 text-[11px] font-semibold leading-4 text-[#c92a2a]">{inviteError}</p>
                )}
                <div className="mt-2 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInviteOpen(false)}
                    className="rounded-full border border-[#dce8e1] px-3 py-1.5 text-[11px] font-bold text-slate-600"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmInvite()}
                    disabled={inviteChecked.size === 0 || inviteAdding || inviteLoading}
                    className="inline-flex items-center gap-1 rounded-full bg-[#238777] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    {inviteAdding && <Loader2 size={11} className="animate-spin" />}
                    确认加入{inviteChecked.size > 0 ? ` (${inviteChecked.size})` : ""}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-black/[0.07]" />

          <div>
            <p className="text-[11px] font-bold tracking-wide text-slate-600">语音</p>
            <div className="mt-2 space-y-2">
              {session.mode === "group" ? (
                <>
                  <p className="text-xs font-bold text-[#1d6d60]">
                    {groupVoiceChat.configured === false ? (
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <MicOff size={13} /> 多人语音未配置
                      </span>
                    ) : groupVoiceChat.voiceState === "publishing" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Mic size={13} /> {isTeacher ? "正在向全班讲解" : "正在向全班发言"}
                      </span>
                    ) : groupVoiceChat.voiceState === "listening" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={13} /> 已接入全班语音
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 size={13} className="animate-spin" /> 正在连接语音…
                      </span>
                    )}
                  </p>
                  {groupVoiceChat.voiceState === "publishing" ? (
                    <button
                      type="button"
                      onClick={() => void groupVoiceChat.stopPublishing()}
                      className="w-full rounded-full border bg-white px-3 py-2 text-xs font-bold text-[#c92a2a] transition hover:bg-[#fdecea]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <MicOff size={13} /> 关闭自己的麦克风
                      </span>
                    </button>
                  ) : groupVoiceChat.canPublish ? (
                    <button
                      type="button"
                      onClick={() => void groupVoiceChat.startPublishing()}
                      disabled={groupVoiceChat.configured === false}
                      className="w-full rounded-full bg-[#238777] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1d6d60] disabled:opacity-50"
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <Mic size={14} />
                        {isTeacher ? "开启全班语音讲解" : "老师已授权，点击开麦"}
                      </span>
                    </button>
                  ) : (
                    <p className="app-muted-text text-[11px]">
                      {isTeacher ? "正在准备全班语音" : "默认静音，等待老师授权开麦"}
                    </p>
                  )}
                  {groupVoiceChat.audioBlocked && (
                    <button
                      type="button"
                      onClick={() => void groupVoiceChat.enablePlayback()}
                      className="w-full rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700"
                    >
                      点击启用课堂声音
                    </button>
                  )}
                </>
              ) : (
                <>
                  {peerVoiceChat.voiceState !== "idle" ? (
                    <>
                      <p className="text-xs font-bold text-[#1d6d60]">
                        {peerVoiceChat.voiceState === "connected" ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Mic size={13} /> 语音讲解中
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <Loader2 size={13} className="animate-spin" /> 正在连接语音…
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={peerVoiceChat.stopVoice}
                        className="w-full rounded-full border bg-white px-3 py-2 text-xs font-bold text-[#c92a2a] transition hover:bg-[#fdecea]"
                        style={{ borderColor: "var(--border)" }}
                      >
                        挂断语音
                      </button>
                    </>
                  ) : isTeacher ? (
                    <button
                      type="button"
                      onClick={() => void peerVoiceChat.startVoice()}
                      className="w-full rounded-full bg-[#238777] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1d6d60]"
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <Mic size={14} /> 开启语音讲解
                      </span>
                    </button>
                  ) : (
                    <p className="app-muted-text text-[11px]">老师发起语音后会自动接入</p>
                  )}
                </>
              )}
              {(session.mode === "group" ? groupVoiceChat.voiceError : peerVoiceChat.voiceError) && (
                <p className="text-[11px] font-semibold leading-4 text-[#c92a2a]">
                  {session.mode === "group" ? groupVoiceChat.voiceError : peerVoiceChat.voiceError}
                </p>
              )}
            </div>
          </div>
        </div>

        <div
          className="shrink-0 space-y-2 border-t bg-[#f0f7f4] p-4 shadow-[0_-8px_20px_rgba(27,67,57,0.06)]"
          style={{ borderColor: "var(--border)" }}
        >
          {endError && (
            <p className="rounded-lg bg-[#fdecea] px-3 py-2 text-[11px] font-semibold leading-4 text-[#c92a2a]">
              {endError}
            </p>
          )}

          {isTeacher ? (
            <button
              type="button"
              onClick={handleEnd}
              disabled={ending}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#fdecea] px-3 py-2.5 text-xs font-bold text-[#c92a2a] transition hover:bg-[#fbdcd9] disabled:opacity-60"
            >
              {ending ? <Loader2 size={14} className="animate-spin" /> : <PhoneOff size={14} />}
              结束课堂
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLeave}
              disabled={leaving}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border bg-white px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-black/[0.035]"
              style={{ borderColor: "var(--border)" }}
            >
              {leaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              退出课堂
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
