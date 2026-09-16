import type { PaceSummary, ProgressResult, SummaryKpis, SummaryTrendPoint } from "@/types/overview"
import { formatIdr, formatSignedPercent } from "@/lib/format"

export interface Finding {
  id: string
  rule: string
  text: string
}

/**
 * Rule-based findings, per CLAUDE.md's design principle: transparent
 * consideration prompts, not AI-generated, not action items. Thresholds
 * here are a starter draft (agreed with Sendi) and are meant to be tuned.
 */
export function computeFindings(
  pace: PaceSummary | undefined,
  kpis: SummaryKpis | undefined,
  progress: ProgressResult | null | undefined,
  compareLabel: string,
  trend?: SummaryTrendPoint[],
): Finding[] {
  const findings: Finding[] = []

  const missingCommission = trend?.filter((t) => t.roi === null).length ?? 0
  if (missingCommission > 0) {
    findings.push({
      id: "commission-lag",
      rule: "COMMISSION BELUM LENGKAP",
      text: `${missingCommission} periode terakhir belum punya data komisi (ETL komisi tertinggal dari GMV). Metrik ROI, Commission Rate, dan Commission untuk rentang ini belum final.`,
    })
  }

  if (pace && pace.target > 0) {
    const gap = pace.actualPct - pace.expectedPct
    if (gap < -0.05) {
      findings.push({
        id: "pace-behind",
        rule: "PACE < EXPECTED - 5PP",
        text: `${pace.monthLabel}: realisasi GMV baru ${(pace.actualPct * 100).toFixed(0)}% dari target bulanan, di bawah pace berjalan (${(pace.expectedPct * 100).toFixed(0)}%). Worth checking further.`,
      })
    } else if (gap > 0.05) {
      findings.push({
        id: "pace-ahead",
        rule: "PACE > EXPECTED + 5PP",
        text: `${pace.monthLabel}: realisasi GMV sudah ${(pace.actualPct * 100).toFixed(0)}% dari target bulanan, melampaui pace berjalan (${(pace.expectedPct * 100).toFixed(0)}%).`,
      })
    }
  }

  if (kpis) {
    if (kpis.gmv.deltaPct !== null && kpis.gmv.deltaPct <= -0.05) {
      findings.push({
        id: "gmv-down",
        rule: "GMV DELTA <= -5%",
        text: `GMV Affiliate turun ${formatSignedPercent(kpis.gmv.deltaPct)} ${compareLabel} (${formatIdr(kpis.gmv.delta)}). Worth checking further.`,
      })
    } else if (kpis.gmv.deltaPct !== null && kpis.gmv.deltaPct >= 0.1) {
      findings.push({
        id: "gmv-up",
        rule: "GMV DELTA >= +10%",
        text: `GMV Affiliate naik ${formatSignedPercent(kpis.gmv.deltaPct)} ${compareLabel} (${formatIdr(kpis.gmv.delta)}).`,
      })
    }

    if (kpis.affiliateShare.deltaPct !== null && Math.abs(kpis.affiliateShare.deltaPct) >= 0.05) {
      findings.push({
        id: "share-shift",
        rule: "AFFILIATE SHARE DELTA >= 5%",
        text: `Kontribusi affiliate terhadap total GMV bergeser ${formatSignedPercent(kpis.affiliateShare.deltaPct)} ${compareLabel}, kini ${(kpis.affiliateShare.value * 100).toFixed(1)}%.`,
      })
    }

    if (kpis.commission.deltaPct !== null && kpis.commission.deltaPct <= -0.15) {
      findings.push({
        id: "commission-down",
        rule: "COMMISSION DELTA <= -15%",
        text: `Commission turun ${formatSignedPercent(kpis.commission.deltaPct)} ${compareLabel} meski GMV ${kpis.gmv.deltaPct !== null && kpis.gmv.deltaPct >= 0 ? "naik" : "turun"} — worth checking further.`,
      })
    }
  }

  if (progress) {
    for (const row of progress.marketplace) {
      if (row.target > 0 && row.pct < 0.3) {
        findings.push({
          id: `progress-marketplace-${row.name}`,
          rule: "MONTHLY PROGRESS < 30%",
          text: `${row.name} baru mencapai ${(row.pct * 100).toFixed(0)}% dari target bulanan.`,
        })
      }
    }
    for (const row of progress.brand) {
      if (row.target > 0 && row.pct < 0.2) {
        findings.push({
          id: `progress-brand-${row.name}`,
          rule: "MONTHLY PROGRESS < 20%",
          text: `Brand ${row.name} baru mencapai ${(row.pct * 100).toFixed(0)}% dari target bulanan.`,
        })
      }
    }
  }

  return findings
}
