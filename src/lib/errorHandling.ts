import { toast } from "sonner";

interface ReportErrorOptions {
  toastMessage?: string;
  devOnly?: boolean;
}

export function isLocalDev() {
  return typeof window !== "undefined" && window.location.hostname === "127.0.0.1";
}

export function toErrorMessage(error: unknown, fallback = "Algo deu errado.") {
  return error instanceof Error ? error.message : fallback;
}

export function reportError(context: string, error: unknown, options?: ReportErrorOptions) {
  if (!options?.devOnly || isLocalDev()) {
    console.error(context, error);
  }

  if (options?.toastMessage) {
    toast.error(options.toastMessage);
  }
}

export async function runWithErrorToast<T>(
  task: () => Promise<T>,
  context: string,
  toastMessage: string,
) {
  try {
    return await task();
  } catch (error) {
    reportError(context, error, { toastMessage });
    throw error;
  }
}
