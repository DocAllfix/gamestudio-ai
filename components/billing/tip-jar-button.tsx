"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { TIP_AMOUNTS_USD, type TipAmount } from "@/lib/billing/tip-jar";
import { cn } from "@/lib/utils";

export function TipJarButton() {
  const [loading, setLoading] = useState<TipAmount | null>(null);

  async function handleTip(amount: TipAmount) {
    setLoading(amount);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "tip", tipAmount: amount }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="tip-jar">
      <p className="text-xs text-text-muted flex items-center gap-1">
        <Heart size={11} className="text-danger" />
        Tip Jar — supporta GameSmith
      </p>
      <div className="flex gap-2">
        {TIP_AMOUNTS_USD.map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => handleTip(amt)}
            disabled={loading === amt}
            data-testid={`tip-${amt}`}
            className={cn(
              "rounded-lg border border-surface-2 px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-forge hover:text-forge",
              loading === amt && "opacity-50",
            )}
          >
            ${amt}
          </button>
        ))}
      </div>
    </div>
  );
}
