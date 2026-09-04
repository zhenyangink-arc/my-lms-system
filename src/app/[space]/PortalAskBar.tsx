"use client";

import { useState, type FormEvent } from "react";
import { ArrowUp, Search } from "lucide-react";

import {
  GUIDE_AGENT_ASK_EVENT,
  type GuideAgentAskEventDetail,
} from "@/components/guide-agent/GuideAgentProvider";

export function PortalAskBar({
  greeting,
  userName,
}: {
  greeting: string;
  userName: string;
}) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = value.trim();
    if (!message) return;

    window.dispatchEvent(
      new CustomEvent<GuideAgentAskEventDetail>(GUIDE_AGENT_ASK_EVENT, {
        detail: { message },
      }),
    );
    setValue("");
  }

  return (
    <section
      aria-label="向学习助手提问"
      className="grid items-end gap-5 px-1 py-4 lg:grid-cols-[minmax(17rem,0.65fr)_minmax(0,1.35fr)] lg:gap-8 lg:py-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
          {greeting}，{userName}
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500 sm:text-base">
          这是属于你的 UPLY 学习空间
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex min-h-16 items-center gap-3 rounded-[1.35rem] border border-slate-200/80 bg-white/92 px-4 py-2.5 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.34)] transition focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/40 motion-reduce:transition-none sm:px-5"
      >
        <Search size={19} className="shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="问问学习助手，比如“今天该学哪一课？”"
          aria-label="向学习助手提问"
          className="min-w-0 flex-1 bg-transparent text-base font-medium text-slate-950 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="提交问题"
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-25 enabled:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
