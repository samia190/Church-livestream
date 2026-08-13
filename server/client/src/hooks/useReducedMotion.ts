import { useEffect, useState } from "react";

/**
 * Returns true if the user has requested reduced motion at the OS/browser
 * level. Used by the 3D scenes to freeze rotation/animation instead of
 * fighting the user's accessibility preference.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  return reduced;
}
