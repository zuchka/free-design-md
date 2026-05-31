import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function BYOKeyForm() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");

  async function save() {
    setStatus("saving");
    try {
      const r = await fetch("/api/me/anthropic-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value }),
      });
      setStatus(r.ok ? "ok" : "err");
      if (r.ok) setValue("");
    } catch {
      setStatus("err");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="sk-ant-…"
        className="flex-1 rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={save}
        disabled={!value.startsWith("sk-") || status === "saving"}
      >
        {status === "saving" ? "Saving…" : status === "ok" ? "Saved ✓" : "Save"}
      </Button>
      {status === "err" && (
        <span className="text-xs text-destructive">Failed. Try again.</span>
      )}
    </div>
  );
}
