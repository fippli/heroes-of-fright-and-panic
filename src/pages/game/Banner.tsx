import { useEffect, useState } from "react";
import type { Notice } from "../../core/ui-state";

const SHOW_FOR_MS = 4500;

/** One non-blocking line over the board; each new notice replaces the last */
export const Banner = ({ notice }: { readonly notice: Notice | null }) => {
  const [visible, setVisible] = useState<Notice | null>(null);

  useEffect(() => {
    if (notice === null) return;
    setVisible(notice);
    const timer = window.setTimeout(() => setVisible((current) => (current?.id === notice.id ? null : current)), SHOW_FOR_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (visible === null) return null;
  return (
    <div className={`banner banner--${visible.tone}`} role="status" aria-live="polite">
      {visible.text}
    </div>
  );
};
