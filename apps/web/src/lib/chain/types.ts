import { CONTRACT_ERRORS } from "@patched/shared";

export type ChainTxStatus = "idle" | "signing" | "confirming" | "done" | "error";

export interface ChainHookResult<TArgs = unknown, TReturn = void> {
  status: ChainTxStatus;
  error: string | null;
  execute: (args: TArgs) => Promise<TReturn>;
  reset: () => void;
  isLoading: boolean;
  isSuccess: boolean;
}

export function parseContractError(error: unknown): string {
  if (!error) return "An unknown error occurred.";
  if (typeof error === "string") {
    return CONTRACT_ERRORS[error] || error;
  }
  if (error instanceof Error) {
    // Check if error message matches any known custom error key
    for (const [key, msg] of Object.entries(CONTRACT_ERRORS)) {
      if (error.message.includes(key)) {
        return msg;
      }
    }
    return error.message;
  }
  return "Transaction failed. Please try again.";
}
