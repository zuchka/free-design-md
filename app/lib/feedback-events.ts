export const FEEDBACK_REQUEST_EVENT = "fdmd:feedback-request";

export type FeedbackCategory =
  | "something_broke"
  | "wrong_output"
  | "feature_request"
  | "other";

export interface FeedbackRequestDetail {
  category?: FeedbackCategory;
  message?: string;
  sourceUrl?: string;
  errorSource?: string;
  errorMessage?: string;
  workflowStep?: string;
}

declare global {
  interface WindowEventMap {
    [FEEDBACK_REQUEST_EVENT]: CustomEvent<FeedbackRequestDetail>;
  }
}

export function requestFeedback(detail: FeedbackRequestDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FEEDBACK_REQUEST_EVENT, {
      detail,
    }),
  );
}
