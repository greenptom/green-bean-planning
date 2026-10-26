"use client";
import { useState } from "react";

export const CopyBlock = ({ text }: { text: string }) => {
  const [done, setDone] = useState(false);
  return (
    <div className="rounded border border-rule bg-paper-2 p-3">
      <pre className="whitespace-pre-wrap text-xs leading-relaxed font-mono">{text}</pre>
      <button
        type="button"
        onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
        className="mt-2 rounded border border-ink px-2 py-1 text-xs hover:bg-ink hover:text-paper"
      >
        {done ? "Copied" : "Copy post"}
      </button>
    </div>
  );
};
