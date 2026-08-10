// 实时课堂事件协议：通过 Supabase Realtime Broadcast 频道 live-class:{sessionId} 传递。
// 画笔/批注仅在课堂会话内实时展示，不落库。
//
// 安全：所有事件必须携带 senderId（当前登录用户 id），接收端按事件类型核对
// senderId 与 live_class_sessions 的 teacher_id / student_id，只信任课堂参与者的
// 消息；老师专属事件（画线/批注/翻页/语音发起/结束）仅接受 senderId = teacher_id。
// 注意：Broadcast payload 理论上可被登录用户伪造，本层是纵深防御；
// 最终落库操作（如结束课堂）由 server action 服务端强制校验。

export type LivePoint = { x: number; y: number };

export type LiveStroke = {
  id: string;
  points: LivePoint[];
  color: string;
  width: number;
};

export type LiveNote = {
  id: string;
  x: number;
  y: number;
  text: string;
};

export type LivePageEvent = {
  kind: "page";
  senderId: string;
  chapterSlug: string;
  page: number;
};

export type LiveChapterEvent = {
  kind: "chapter";
  senderId: string;
  chapterSlug: string;
};

export type LiveStrokeEvent = {
  kind: "stroke";
  senderId: string;
  chapterSlug: string;
  page: number;
  stroke: LiveStroke;
};

export type LiveClearEvent = {
  kind: "clear";
  senderId: string;
  chapterSlug: string;
  page: number;
};

export type LiveNoteEvent = {
  kind: "note";
  senderId: string;
  chapterSlug: string;
  page: number;
  note: LiveNote;
};

export type LiveEndEvent = {
  kind: "end";
  senderId: string;
};

// —— WebRTC 双人实时语音信令（SDP / ICE 走同一课堂频道，音频走 P2P）——
export type LiveRtcOfferEvent = {
  kind: "rtc-offer";
  senderId: string;
  sdp: string;
};

export type LiveRtcAnswerEvent = {
  kind: "rtc-answer";
  senderId: string;
  sdp: string;
};

export type LiveRtcIceEvent = {
  kind: "rtc-ice";
  senderId: string;
  candidate: string;
};

export type LiveRtcHangupEvent = {
  kind: "rtc-hangup";
  senderId: string;
};

export type LiveEvent =
  | LivePageEvent
  | LiveChapterEvent
  | LiveStrokeEvent
  | LiveClearEvent
  | LiveNoteEvent
  | LiveEndEvent
  | LiveRtcOfferEvent
  | LiveRtcAnswerEvent
  | LiveRtcIceEvent
  | LiveRtcHangupEvent;

/** 构造事件时省略 senderId，由发送端统一注入（分布式 Omit 保持联合类型）。 */
export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
export type LiveEventInput = DistributiveOmit<LiveEvent, "senderId">;

/** live_class_events 表的行（Postgres Changes 分发，sender_id 由 RLS 强制不可伪造）。 */
export type LiveClassEventRow = {
  id: number;
  sender_id: string;
  kind: string;
  chapter_slug: string | null;
  page: number | null;
  payload: unknown;
  created_at: string;
};

export function liveChannelName(sessionId: string) {
  return `live-class:${sessionId}`;
}

export const LIVE_EVENT_NAME = "live-event";
