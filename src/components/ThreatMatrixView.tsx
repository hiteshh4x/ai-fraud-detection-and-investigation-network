import React, { useState } from 'react';
import { ShieldAlert, Lock, CheckSquare, Square, Activity, ArrowUpRight } from 'lucide-react';
import type { LedgerEntryItem } from '../utils/ledgerLogic';

interface DefensePolicy {
  id: string;
  name: string;
  corridor: string;
  thresholdLabel: string;
  enabled: boolean;
  severity: 'CRITICAL' | 'WARNING' | 'NOMINAL';
}

interface ThreatMatrixViewProps {
  entries: LedgerEntryItem[];
  onQuarantineAllCritical: () => Promise<void>;
  onSelectEntryForForensics: (entry: LedgerEntryItem) => void;
}

const INITIAL_POLICIES: DefensePolicy[] = [
  {
    id: 'pol_01',
    name: 'Zero-Knowledge Mixer & Sanctioned Relay Blockade',
    corridor: 'Ethereum Mainnet ↔ Cross-Chain Bridges',
    thresholdLabel: 'Auto-Quarantine Risk >= 75',
    enabled: true,
    severity: 'CRITICAL',
  },
  {
    id: 'pol_02',
    name: 'Whale Treasury Outflow Multi-Sig Gate',
    corridor: 'Institutional Custody Vaults (#01–#12)',
    thresholdLabel: 'Hold Settlement > $10,000,000 USD',
    enabled: true,
    severity: 'WARNING',
  },
  {
    id: 'pol_03',
    name: 'Flash-Loan Reentrancy Gas Entropy Circuit Breaker',
    corridor: 'Arbitrum / Optimism L2 Liquidity Pools',
    thresholdLabel: 'Block Delta <= 2 Blocks',
    enabled: true,
    severity: 'CRITICAL',
  },
  {
    id: 'pol_04',
    name: 'Tokenized Sovereign T-Bill Settlement Whitelist',
    corridor: 'Prime CustodyKYB Counterparties',
    thresholdLabel: 'Fast-Track Risk < 25',
    enabled: false,
    severity: 'NOMINAL',
  },
];

export function ThreatMatrixView({
  entries,
  onQuarantineAllCritical,
  onSelectEntryForForensics,
}: ThreatMatrixViewProps) {
  const [policies, setPolicies] = useState<DefensePolicy[]>(INITIAL_POLICIES);
  const [statusBanner, setStatusBanner] = useState('');

  const togglePolicy = (id: string) => {
    setPolicies((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = !p.enabled;
        setStatusBanner(
          `Defense policy "${p.name}" ${next ? 'ENABLED' : 'SUSPENDED'} for active block validation.`
        );
        return { ...p, enabled: next };
      })
    );
  };

  const criticalEntries = entries.filter((e) => e.riskLevel === 'CRITICAL');
  const warningEntries = entries.filter((e) => e.riskLevel === 'WARNING');

  return (
    <div className="space-y-6">
      {statusBanner && (
        <div className="rounded border border-[#3b82f6]/40 bg-[#131b2e] px-4 py-2.5 text-xs text-[#dae2fd] flex items-center justify-between">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner('')}
            className="text-xs text-[#8c909f] hover:text-[#dae2fd]"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 columns: Active Threat Corridors & Anomaly Velocity */}
        <section className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222a3d] pb-4">
            <div>
              <h2 className="text-base font-semibold text-[#dae2fd]">
                Active Threat Vectors &amp; High-Risk Corridors
              </h2>
              <p className="mt-0.5 text-xs text-[#8c909f]">
                Real-time cryptographic anomaly feed across monitored institutional bridges
              </p>
            </div>
            <button
              type="button"
              onClick={onQuarantineAllCritical}
              className="inline-flex items-center gap-1.5 rounded bg-[#ef4444] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#dc2626] whitespace-nowrap shrink-0"
            >
              <Lock className="h-3.5 w-3.5" />
              Quarantine All Critical ({criticalEntries.length})
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {[...criticalEntries, ...warningEntries].map((item) => (
              <div
                key={item.id}
                className="rounded border border-[#222a3d] bg-[#0b0f19] p-4 transition-colors hover:border-[#424754]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                        item.riskLevel === 'CRITICAL'
                          ? 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/40'
                          : 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/40'
                      }`}
                    >
                      {item.riskLevel} · {item.riskScore}/100
                    </span>
                    <span className="font-mono text-xs text-[#60a5fa]">{item.txHash}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#dae2fd] tabular-nums">
                    ${item.amountUsd.toLocaleString('en-US')} {item.assetSymbol}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-[#dae2fd]">
                      {item.sourceEntity} → {item.destinationEntity}
                    </div>
                    <div className="mt-0.5 text-xs text-[#8c909f]">{item.threatVector}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#8c909f]">
                      State: <strong className="text-[#dae2fd]">{item.status}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectEntryForForensics(item)}
                      className="inline-flex items-center gap-1 rounded border border-[#3b82f6]/50 bg-[#131b2e] px-2.5 py-1 text-xs font-medium text-[#60a5fa] hover:border-[#3b82f6] hover:text-[#dae2fd] whitespace-nowrap shrink-0"
                    >
                      Inspect in Forensic AI
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right 5 columns: Automated Guardrail Policies */}
        <section className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#222a3d] pb-4">
            <div>
              <h2 className="text-base font-semibold text-[#dae2fd]">
                Automated Protocol Defense Guardrails
              </h2>
              <p className="mt-0.5 text-xs text-[#8c909f]">
                Square high-contrast policy gates enforced at block ingestion
              </p>
            </div>
            <Activity className="h-5 w-5 text-[#60a5fa]" />
          </div>

          <div className="mt-4 space-y-3">
            {policies.map((pol) => (
              <div
                key={pol.id}
                className="flex items-start justify-between gap-3 rounded border border-[#222a3d] bg-[#0b0f19] p-3.5"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#dae2fd]">{pol.name}</div>
                  <div className="mt-0.5 text-xs text-[#8c909f]">{pol.corridor}</div>
                  <div className="mt-1.5 font-mono text-[11px] text-[#60a5fa]">
                    {pol.thresholdLabel}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pol.enabled}
                  aria-label={`Toggle ${pol.name}`}
                  onClick={() => togglePolicy(pol.id)}
                  className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    pol.enabled
                      ? 'border-[#3b82f6] bg-[#3b82f6]/15 text-[#dae2fd]'
                      : 'border-[#222a3d] bg-[#131b2e] text-[#8c909f]'
                  }`}
                >
                  {pol.enabled ? (
                    <CheckSquare className="h-3.5 w-3.5 text-[#3b82f6]" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-[#8c909f]" />
                  )}
                  {pol.enabled ? 'Active' : 'Bypassed'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
