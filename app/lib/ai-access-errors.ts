export type AiAccessRecoveryReason =
  | "no_api_key_available"
  | "out_of_credits"
  | "sign_in_required";

export interface AiAccessErrorDetails {
  message: string;
  recoveryReason: AiAccessRecoveryReason | null;
}

interface ApiErrorPayload {
  error?: string;
  reason?: string;
}

const RECOVERY_ERRORS = new Set<AiAccessRecoveryReason>([
  "no_api_key_available",
  "out_of_credits",
  "sign_in_required",
]);

export function classifyAiAccessErrorPayload(
  payload: ApiErrorPayload | null,
): AiAccessRecoveryReason | null {
  const error = payload?.error;
  if (
    typeof error === "string" &&
    RECOVERY_ERRORS.has(error as AiAccessRecoveryReason)
  ) {
    return error as AiAccessRecoveryReason;
  }
  return null;
}

export function classifyAiAccessErrorMessage(
  message: string,
): AiAccessRecoveryReason | null {
  if (!message) return null;

  try {
    const parsed = JSON.parse(message) as ApiErrorPayload;
    const classified = classifyAiAccessErrorPayload(parsed);
    if (classified) return classified;
  } catch {
    // Not JSON; fall through to the compact route error formats.
  }

  if (message.startsWith("out_of_credits")) return "out_of_credits";
  if (message.startsWith("no_api_key_available")) return "no_api_key_available";
  if (message.startsWith("sign_in_required")) return "sign_in_required";
  return null;
}

export function formatAiAccessError(payload: ApiErrorPayload): string {
  if (payload.error === "out_of_credits") {
    return "You've used all available AI credits.";
  }
  if (payload.error === "no_api_key_available") {
    return "Add an Anthropic key to use AI enrichment.";
  }
  if (payload.error === "sign_in_required") {
    return "Connect Builder.io or add an Anthropic key to use AI enrichment.";
  }
  return payload.reason
    ? `${payload.error ?? "request_failed"}: ${payload.reason}`
    : (payload.error ?? "request_failed");
}

export async function readAiAccessErrorResponse(
  res: Response,
  fallback: string,
): Promise<AiAccessErrorDetails> {
  const text = await res.text().catch(() => "");
  if (!text) return { message: fallback, recoveryReason: null };

  try {
    const payload = JSON.parse(text) as ApiErrorPayload;
    return {
      message: formatAiAccessError(payload),
      recoveryReason: classifyAiAccessErrorPayload(payload),
    };
  } catch {
    return {
      message: text,
      recoveryReason: classifyAiAccessErrorMessage(text),
    };
  }
}
