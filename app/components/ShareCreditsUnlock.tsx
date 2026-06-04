import { useEffect, useMemo, useState } from "react";
import { appBasePath } from "@agent-native/core/client";
import {
  IconBrandLinkedin,
  IconBrandX,
  IconCheck,
  IconGift,
  IconShare3,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useCredits, type Credits } from "@/lib/use-credits";

interface SharePromoStatus {
  campaign: string;
  credits: number;
  claimed: boolean;
}

interface ClaimSharePromoResponse {
  claimedNow: boolean;
  promo: SharePromoStatus;
  credits: Credits;
}

export default function ShareCreditsUnlock({
  onResolved,
}: {
  onResolved?: () => void;
}) {
  const { refresh } = useCredits();
  const [status, setStatus] = useState<SharePromoStatus | null>(null);
  const [openedShare, setOpenedShare] = useState(false);
  const [claimState, setClaimState] = useState<
    "idle" | "claiming" | "claimed" | "err"
  >("idle");

  useEffect(() => {
    let alive = true;
    fetch("/api/me/share-credit")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SharePromoStatus | null) => {
        if (alive && data) setStatus(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const share = useMemo(() => {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const url = `${origin}${appBasePath()}/`;
    const text =
      "I am using Free design.md to turn URLs into portable design system specs for agents.";
    return {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    };
  }, []);

  async function claim() {
    setClaimState("claiming");
    try {
      const res = await fetch("/api/me/share-credit", { method: "POST" });
      if (!res.ok) {
        setClaimState("err");
        return;
      }
      const data = (await res.json()) as ClaimSharePromoResponse;
      setStatus(data.promo);
      setClaimState("claimed");
      await refresh();
      if (data.credits.remaining > 0) onResolved?.();
    } catch {
      setClaimState("err");
    }
  }

  const credits = status?.credits ?? 3;
  const claimed = status?.claimed || claimState === "claimed";

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <IconGift size={14} />
        Share for {credits} more credits
      </div>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">
        Post the tool once, then claim a one-time refill for enrichment and
        iteration.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <a
            href={share.linkedin}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpenedShare(true)}
          >
            <IconBrandLinkedin size={14} />
            LinkedIn
          </a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a
            href={share.x}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpenedShare(true)}
          >
            <IconBrandX size={14} />X
          </a>
        </Button>
        <Button
          size="sm"
          type="button"
          onClick={claim}
          disabled={claimed || claimState === "claiming" || !openedShare}
        >
          {claimed ? (
            <IconCheck size={14} />
          ) : (
            <IconShare3 size={14} />
          )}
          {claimed
            ? "Credits added"
            : claimState === "claiming"
              ? "Adding..."
              : "I shared it"}
        </Button>
      </div>
      {!openedShare && !claimed && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Open a share link first to enable the refill.
        </p>
      )}
      {claimState === "err" && (
        <p className="mt-2 text-[11px] text-destructive">
          Could not add credits. Try again.
        </p>
      )}
    </div>
  );
}
