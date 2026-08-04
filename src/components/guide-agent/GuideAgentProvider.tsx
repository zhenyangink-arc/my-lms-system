"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from "react";

export type GuideAgentMessageRole = "user" | "assistant";

export type GuideAgentMessage = {
  id: string;
  role: GuideAgentMessageRole;
  content: string;
  isError?: boolean;
};

type GuideAgentContextValue = {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  messages: GuideAgentMessage[];
  setMessages: Dispatch<SetStateAction<GuideAgentMessage[]>>;
  conversationId: string;
  setConversationId: Dispatch<SetStateAction<string>>;
};

const INITIAL_MESSAGES: GuideAgentMessage[] = [
  {
    id: "guide-agent-welcome",
    role: "assistant",
    content:
      "你好，我是你的智能学习助手。课程安排、学习进度或下一步该做什么，都可以来问我。",
  },
];

const GuideAgentContext = createContext<GuideAgentContextValue | null>(null);

export function GuideAgentProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] =
    useState<GuideAgentMessage[]>(INITIAL_MESSAGES);
  const [conversationId, setConversationId] = useState("");

  return (
    <GuideAgentContext.Provider
      value={{
        isOpen,
        setIsOpen,
        messages,
        setMessages,
        conversationId,
        setConversationId,
      }}
    >
      {children}
    </GuideAgentContext.Provider>
  );
}

export function useGuideAgent() {
  const context = useContext(GuideAgentContext);

  if (!context) {
    throw new Error("useGuideAgent must be used within GuideAgentProvider");
  }

  return context;
}
