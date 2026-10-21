import { useState, useCallback } from "react";
import { invokeCommand } from "../services/tauriUtils";
import { useAppState } from "../contexts/AppStateContext";
import { useNotification } from "../contexts/NotificationContext";
import { ApiResponse } from "../types";

/**
 * Custom hook to simplify Tauri command invocation with loading/error states
 *
 * @param operationName Name of the operation for tracking loading state
 * @param showErrorNotification Whether to show an error notification on failure
 * @returns An object with execute function, loading state, and error state
 */
export function useTauriCommand<T, P = Record<string, unknown>>(
  operationName: string,
  showErrorNotification: boolean = true,
) {
  const [error, setError] = useState<string | null>(null);
  const { addLoadingState, removeLoadingState, updateLoadingProgress } =
    useAppState();
  const { showError } = useNotification();

  /**
   * Execute a Tauri command with proper loading state management
   *
   * @param command The Tauri command to invoke
   * @param params Parameters to pass to the command
   * @returns A promise resolving to the command's result
   */
  const execute = useCallback(
    async (command: string, params?: P): Promise<ApiResponse<T>> => {
      try {
        setError(null);
        addLoadingState(operationName);

        const response = await invokeCommand<T>(
          command,
          params as Record<string, unknown>,
        );

        if (!response.success) {
          throw new Error(response.error || "Unknown error occurred");
        }

        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);

        if (showErrorNotification) {
          showError(`Error during ${operationName}: ${errorMessage}`);
        }

        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        removeLoadingState(operationName);
      }
    },
    [
      operationName,
      addLoadingState,
      removeLoadingState,
      showError,
      showErrorNotification,
    ],
  );

  /**
   * Update the progress of the current operation
   *
   * @param progress Progress percentage (0-100)
   */
  const updateProgress = useCallback(
    (progress: number) => {
      updateLoadingProgress(operationName, progress);
    },
    [operationName, updateLoadingProgress],
  );

  return {
    execute,
    updateProgress,
    error,
  };
}

export default useTauriCommand;
