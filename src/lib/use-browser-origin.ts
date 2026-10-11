import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** "https://host/" of the page in the browser; "" on the server and during hydration. */
export function useBrowserOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => `${window.location.origin}/`,
    () => "",
  );
}
