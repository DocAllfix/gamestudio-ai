"use client";

import { useState } from "react";
import { GitFork } from "lucide-react";
import { forkProject } from "@/lib/fork/fork-project";
import { cn } from "@/lib/utils";

interface Props {
  sourceProjectId: string;
  onForked?: (newProjectId: string) => void;
  className?: string;
}

export function ForkButton({ sourceProjectId, onForked, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFork() {
    setLoading(true);
    try {
      const result = await forkProject({ sourceProjectId });
      if (result.ok) {
        setDone(true);
        onForked?.(result.newProjectId);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleFork}
      disabled={loading || done}
      data-testid="fork-btn"
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-surface-2 px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:border-forge hover:text-forge disabled:opacity-50",
        done && "border-success text-success",
        className,
      )}
    >
      <GitFork size={14} />
      {done ? "Forked!" : loading ? "..." : "Fork"}
    </button>
  );
}
