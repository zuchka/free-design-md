import { useEffect, useMemo, useState } from "react";
import { useActionMutation } from "@agent-native/core/client";
import {
  IconAlertTriangle,
  IconBug,
  IconCheck,
  IconMessageReport,
  IconSend2,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  FEEDBACK_REQUEST_EVENT,
  type FeedbackCategory,
  type FeedbackRequestDetail,
} from "@/lib/feedback-events";

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "something_broke", label: "Something broke" },
  { value: "wrong_output", label: "Wrong output" },
  { value: "feature_request", label: "Feature request" },
  { value: "other", label: "Other" },
];

function getBrowserContext() {
  if (typeof window === "undefined") {
    return {
      pageUrl: undefined,
      userAgent: undefined,
      viewport: undefined,
      timezone: undefined,
    };
  }

  return {
    pageUrl: window.location.href,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export default function FeedbackReporter() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<FeedbackRequestDetail>({});
  const [category, setCategory] =
    useState<FeedbackCategory>("something_broke");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitFeedback = useActionMutation("submit-feedback", {
    onSuccess: () => {
      setSent(true);
      setSubmitError(null);
      setMessage("");
      setEmail("");
      window.setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 1400);
    },
    onError: (error) => {
      setSubmitError(error.message);
    },
  });

  useEffect(() => {
    function handleFeedbackRequest(event: CustomEvent<FeedbackRequestDetail>) {
      const detail = event.detail ?? {};
      setContext(detail);
      setCategory(detail.category ?? "something_broke");
      setMessage(detail.message ?? "");
      setSubmitError(null);
      setSent(false);
      setOpen(true);
    }

    window.addEventListener(FEEDBACK_REQUEST_EVENT, handleFeedbackRequest);
    return () => {
      window.removeEventListener(FEEDBACK_REQUEST_EVENT, handleFeedbackRequest);
    };
  }, []);

  const hasErrorContext = Boolean(context.errorMessage || context.errorSource);
  const canSubmit = message.trim().length >= 3 && !submitFeedback.isPending;

  const contextSummary = useMemo(() => {
    if (!hasErrorContext) return null;
    return [context.workflowStep, context.errorSource, context.errorMessage]
      .filter(Boolean)
      .join(" - ");
  }, [
    context.errorMessage,
    context.errorSource,
    context.workflowStep,
    hasErrorContext,
  ]);

  function openManualFeedback() {
    setContext({});
    setCategory("something_broke");
    setMessage("");
    setSubmitError(null);
    setSent(false);
    setOpen(true);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSent(false);
      setSubmitError(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    submitFeedback.mutate({
      category,
      message: message.trim(),
      email: email.trim() || undefined,
      sourceUrl: context.sourceUrl,
      errorSource: context.errorSource,
      errorMessage: context.errorMessage,
      workflowStep: context.workflowStep,
      ...getBrowserContext(),
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={openManualFeedback}
        className="fixed bottom-20 right-4 z-40 h-10 gap-2 border-primary/30 bg-background/95 px-3 shadow-lg backdrop-blur sm:bottom-5 sm:right-5"
      >
        <IconMessageReport size={16} />
        <span>Feedback</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {hasErrorContext ? (
                  <IconAlertTriangle className="text-destructive" />
                ) : (
                  <IconBug className="text-primary" />
                )}
                Send feedback
              </DialogTitle>
              <DialogDescription>
                Tell us what broke or what looked wrong. Email is optional.
              </DialogDescription>
            </DialogHeader>

            {contextSummary && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
                {contextSummary}
              </div>
            )}

            <div className="grid gap-2">
              <label
                htmlFor="feedback-category"
                className="text-sm font-medium"
              >
                Type
              </label>
              <select
                id="feedback-category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as FeedbackCategory)
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label htmlFor="feedback-message" className="text-sm font-medium">
                What happened?
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                required
                minLength={3}
                maxLength={4000}
                placeholder="What were you trying to do, and what happened instead?"
                className="min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="feedback-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={320}
                placeholder="Optional"
              />
            </div>

            {submitError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
                {submitError}
              </div>
            )}

            {sent && (
              <div className="flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-foreground">
                <IconCheck size={16} className="text-primary" />
                Sent.
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitFeedback.isPending ? (
                  "Sending..."
                ) : (
                  <>
                    <IconSend2 size={16} />
                    Send
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
