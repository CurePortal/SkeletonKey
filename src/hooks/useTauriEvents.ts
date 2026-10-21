import { useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

type EventCallback<T> = (payload: T) => void;

/**
 * Custom hook to subscribe to Tauri events
 *
 * @param eventName Name of the event to listen for
 * @param callback Function to call when the event is received
 */
export function useTauriEvent<T = unknown>(
  eventName: string,
  callback: EventCallback<T>,
): void {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen<T>(eventName, (event) => {
          callback(event.payload);
        });
      } catch (error) {
        console.error(`Error setting up listener for ${eventName}:`, error);
      }
    };

    setupListener();

    // Clean up the listener when the component unmounts or the event name changes
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventName, callback]);
}

/**
 * Custom hook to subscribe to a Tauri event and store its latest payload in state
 *
 * @param eventName Name of the event to listen for
 * @param initialValue Initial value for the state
 * @returns The latest event payload
 */
export function useTauriEventState<T>(eventName: string, initialValue: T): T {
  const [state, setState] = useState<T>(initialValue);

  useTauriEvent<T>(eventName, (payload) => {
    setState(payload);
  });

  return state;
}

export default useTauriEvent;
