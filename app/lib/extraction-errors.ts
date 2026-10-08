import {
  extractionFailures,
  type ExtractionErrorResponse,
} from "../../shared/extraction-diagnostics";

export class ExtractionRequestError extends Error {
  constructor(readonly detail: ExtractionErrorResponse["error"]) {
    super(detail.message);
  }
}

export async function readExtractionError(
  response: Response,
): Promise<ExtractionRequestError> {
  let payload: ExtractionErrorResponse | undefined;
  try {
    payload = await response.json();
  } catch {
    /* Proxy or older server response. */
  }
  const error = payload?.error;
  if (
    error &&
    Object.prototype.hasOwnProperty.call(extractionFailures, error.code)
  ) {
    // UI copy comes from our catalogue, never arbitrary proxy HTML/error text.
    return new ExtractionRequestError({
      ...error,
      ...extractionFailures[error.code],
    });
  }
  return new ExtractionRequestError({
    code: "internal",
    ...extractionFailures.internal,
    stage: "response",
    requestId: response.headers.get("X-Request-Id") ?? "",
  });
}
