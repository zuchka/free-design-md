import { useSyncExternalStore } from "react";

export type AgentActivityTone = "info" | "running" | "success" | "error";

export interface AgentActivityItem {
  id: string;
  title: string;
  detail?: string;
  tone: AgentActivityTone;
  createdAt: number;
}

interface AgentActivityInput {
  title: string;
  detail?: string;
  tone?: AgentActivityTone;
  openSidebar?: boolean;
}

const MAX_ITEMS = 6;
const ACTIVITY_EVENT = "fdmd:agent-activity";

let items: AgentActivityItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return items;
}

function getServerSnapshot() {
  return [];
}

function makeId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAgentActivity() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function announceAgentActivity(input: AgentActivityInput) {
  const item: AgentActivityItem = {
    id: makeId(),
    title: input.title,
    detail: input.detail,
    tone: input.tone ?? "info",
    createdAt: Date.now(),
  };
  items = [item, ...items].slice(0, MAX_ITEMS);
  emit();

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ACTIVITY_EVENT, {
        detail: item,
      }),
    );
    if (input.openSidebar !== false) {
      window.dispatchEvent(
        new CustomEvent("agent-panel:set-mode", { detail: { mode: "chat" } }),
      );
      window.dispatchEvent(new Event("agent-panel:open"));
    }
  }
}

export function clearAgentActivity() {
  items = [];
  emit();
}
