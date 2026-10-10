export class OperationTimeoutError extends Error {
  constructor(operation: string) {
    super(`${operation} timed out.`);
    this.name = "OperationTimeoutError";
  }
}

export async function withDeadline<Result>(
  operation: string,
  run: (signal: AbortSignal) => Promise<Result>,
  milliseconds = 20000
): Promise<Result> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new OperationTimeoutError(operation));
      controller.abort();
    }, milliseconds);
  });
  try {
    return await Promise.race([run(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}