import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true in the browser afterwards. For values that only
 * exist client-side (the stored theme), so the first render matches the server without a
 * setState-in-an-effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
