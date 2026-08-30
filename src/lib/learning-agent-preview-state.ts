import "server-only";

export type PreviewState = {
  scriptVersionId: string;
  currentNodeKey: string | null;
  teachingState: Record<string, unknown>;
  completedTaskEvents: string[];
};

function freshState(scriptVersionId: string): PreviewState {
  return { scriptVersionId, currentNodeKey: null, teachingState: {}, completedTaskEvents: [] };
}

/**
 * Preview sessions never touch the database — the entire "session" is this
 * opaque token round-tripped by the client, mirroring the shape of the real
 * respond endpoint's `X-Learning-Agent-Session` id so the shared student
 * runner needs no protocol changes to support both modes.
 */
export function encodePreviewState(state: PreviewState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodePreviewState(token: string | undefined, scriptVersionId: string): PreviewState {
  if (token) {
    try {
      const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as Partial<PreviewState>;
      if (parsed && parsed.scriptVersionId === scriptVersionId) {
        return {
          scriptVersionId,
          currentNodeKey: typeof parsed.currentNodeKey === "string" ? parsed.currentNodeKey : null,
          teachingState: parsed.teachingState && typeof parsed.teachingState === "object" && !Array.isArray(parsed.teachingState)
            ? parsed.teachingState as Record<string, unknown>
            : {},
          completedTaskEvents: Array.isArray(parsed.completedTaskEvents)
            ? parsed.completedTaskEvents.filter((item): item is string => typeof item === "string")
            : [],
        };
      }
    } catch {
      // Malformed or stale token: fall through to a fresh state.
    }
  }
  return freshState(scriptVersionId);
}
