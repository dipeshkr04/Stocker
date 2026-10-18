export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

export const errorResponse = (error: unknown) => {
  if (error instanceof AppError) return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  if (error instanceof Error) return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error.message } } };
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } } };
};
