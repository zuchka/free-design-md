export type ExtractionStage =
  | "validation"
  | "browser"
  | "navigation"
  | "page_ready"
  | "consent"
  | "signals"
  | "screenshot"
  | "synthesis"
  | "response"
  | "cleanup";

// Fixed categories keep public metrics bounded and free of URLs/error text.
export const extractionFailures = {
  invalid_url: {
    message: "That URL is not valid.",
    hint: "Enter a public http or https website address.",
    status: 400,
    retryable: false,
  },
  invalid_request: {
    message: "The extraction request is incomplete.",
    hint: "Provide a URL and a supported output format.",
    status: 400,
    retryable: false,
  },
  private_url: {
    message: "This address is not a public website.",
    hint: "Use a publicly accessible website address.",
    status: 400,
    retryable: false,
  },
  dns: {
    message: "We could not find that website.",
    hint: "Check the spelling and make sure the domain is online.",
    status: 422,
    retryable: false,
  },
  tls: {
    message: "The website's secure connection failed.",
    hint: "Check that the address opens securely in your browser.",
    status: 422,
    retryable: false,
  },
  connection: {
    message: "The connection to the website was interrupted.",
    hint: "Try again in a moment.",
    status: 502,
    retryable: true,
  },
  timeout: {
    message: "The website took too long to respond.",
    hint: "Try again, or use a simpler page on the same website.",
    status: 504,
    retryable: true,
  },
  access_denied: {
    message: "The website refused access to this page.",
    hint: "Try a public page that does not require signing in.",
    status: 422,
    retryable: false,
  },
  bot_challenge: {
    message: "The website requires a human verification check.",
    hint: "Try another public page. We cannot complete verification challenges.",
    status: 422,
    retryable: false,
  },
  not_found: {
    message: "That page could not be found.",
    hint: "Check the address or try the website's homepage.",
    status: 422,
    retryable: false,
  },
  rate_limited: {
    message: "The website is limiting requests.",
    hint: "Wait a few minutes before trying again.",
    status: 429,
    retryable: true,
  },
  upstream_error: {
    message: "The website returned a server error.",
    hint: "Try again after the website has recovered.",
    status: 502,
    retryable: true,
  },
  unsupported_content: {
    message: "This address does not return a web page.",
    hint: "Use an HTML page instead of a file, image, or API endpoint.",
    status: 422,
    retryable: false,
  },
  empty_page: {
    message: "The page did not contain readable content.",
    hint: "Try a public page with visible content.",
    status: 422,
    retryable: false,
  },
  browser_unavailable: {
    message: "The extraction browser is temporarily unavailable.",
    hint: "Try again shortly. If this continues, report the issue below.",
    status: 503,
    retryable: true,
  },
  browser_crash: {
    message: "The extraction browser stopped unexpectedly.",
    hint: "Try again, or try a smaller page.",
    status: 503,
    retryable: true,
  },
  internal: {
    message: "We could not finish extracting this page.",
    hint: "Try again. If this continues, report the issue below.",
    status: 500,
    retryable: true,
  },
} as const;

export type ExtractionFailureCode = keyof typeof extractionFailures;
export type ExtractionWarning =
  | "page_still_loading"
  | "screenshot_viewport"
  | "screenshot_unavailable"
  | "cleanup_failed";
export const extractionWarningMessages: Record<ExtractionWarning, string> = {
  page_still_loading:
    "Some page resources were still loading when we captured the design.",
  screenshot_viewport: "The screenshot shows the first screen of the page.",
  screenshot_unavailable:
    "Your design spec is ready, but the screenshot could not be captured. Try extracting again to enable AI enrichment.",
  cleanup_failed: "",
};

export interface ExtractionErrorResponse {
  error: {
    code: ExtractionFailureCode;
    message: string;
    hint: string;
    retryable: boolean;
    stage: ExtractionStage;
    requestId: string;
  };
}

export interface ExtractionDiagnostics {
  requestId: string;
  warnings: ExtractionWarning[];
}
