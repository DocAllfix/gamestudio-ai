"use client";

import { useState } from "react";
import { X, Zap } from "lucide-react";
import { TIER_DEFINITIONS } from "@/lib/contracts/billing.contract";
import type { UserTier } from "@/lib/contracts/billing.contract";
import { cn } from "@/lib/utils";

interface Props {
  reason: string | null;
  onClose: () => void;
}

const PAID_TIERS = (["creator", "pro", "studio"] as const) satisfies Exclude<UserTier, "free">[];

const REASON_LABELS: Record<string, string> = {
  monthly_games_exhausted: "Hai raggiunto il limite mensile di giochi.",
  per_game_cost_exceeded: "Questo gioco supera il budget per la tua fascia.",
  tier_disallows_commercial: "L'uso commerciale richiede Creator o superiore.",
  tier_disallows_tool: "Questo strumento richiede un piano superiore.",
  payment_method_failed: "Metodo di pagamento non valido.",
  account_suspended: "Account sospeso.",
};

export function UpgradeModal({ reason, onClose }: Props) {
  const [loading, setLoading] = useState<UserTier | null>(null);

  async function handleUpgrade(tier: Exclude<UserTier, "free">) {
    setLoading(tier);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "upgrade", tier }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  const reasonLabel = reason ? REASON_LABELS[reason] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-surface-2 bg-surface p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-text">
              Sblocca la tua forgia
            </h2>
            {reasonLabel && (
              <p className="mt-1 text-sm text-text-muted">{reasonLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tier cards */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PAID_TIERS.map((tier) => {
            const def = TIER_DEFINITIONS[tier];
            const isPopular = tier === "pro";
            return (
              <div
                key={tier}
                className={cn(
                  "relative flex flex-col gap-2 rounded-xl border p-4",
                  isPopular ? "border-forge bg-forge/5" : "border-surface-2 bg-ink",
                )}
              >
                {isPopular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-forge px-2.5 py-0.5 text-[10px] font-bold text-ink">
                    Più popolare
                  </span>
                )}
                <div className="font-display font-bold text-text">{def.display_name}</div>
                <div className="font-display text-2xl font-bold text-forge">
                  ${def.monthly_price_usd}
                  <span className="font-sans text-xs font-normal text-text-muted">/mese</span>
                </div>
                <ul className="mt-1 space-y-1 text-xs text-text-muted">
                  <li>
                    {def.games_per_month === "unlimited"
                      ? "∞ giochi/mese"
                      : `${def.games_per_month} giochi/mese`}
                  </li>
                  <li>Budget ${def.max_cost_usd_per_game}/gioco</li>
                  {def.commercial_use && <li>Uso commerciale ✓</li>}
                  {def.priority_queue && <li>Coda prioritaria ✓</li>}
                </ul>
                <button
                  type="button"
                  onClick={() => handleUpgrade(tier)}
                  disabled={loading === tier}
                  className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-forge px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60 hover:bg-spark transition-colors"
                >
                  {loading === tier ? (
                    "..."
                  ) : (
                    <>
                      <Zap size={12} />
                      Scegli {def.display_name}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
