import type {
  AcquisitionPoint,
  DataAvailabilityResult,
  FindingsInputsResult,
  PaceSummary,
  ProgressResult,
  SummaryKpis,
  SummaryTrendPoint,
  TopCreatorsResult,
} from "@/types/overview"
import { formatIdr, formatPercent, formatRp, formatSignedPercent } from "@/lib/format"
import { classify } from "@/components/charts/acquisition-chart"

/**
 * Rule-based findings, per CLAUDE.md: transparent consideration prompts, not AI-generated and
 * not action items. Every threshold lives in T and every rule is described in RULE_CATALOG, so
 * the "?" in the feed shows exactly what the list was computed with.
 */

export type Severity = "alert" | "watch" | "info"

export interface Finding {
  id: string
  code: string
  /** Short rule name with the threshold. */
  rule: string
  severity: Severity
  text: string
  /** The measured value against the threshold, e.g. "aktual −8.2% (−Rp4.1B)". */
  detail: string
  /** Rupiah at stake, for ordering within a severity. */
  impact: number
}

/** Thresholds, agreed with Sendi as a starting point and meant to be tuned. */
export const T = {
  paceBehindPp: 0.1,
  projectionFloor: 0.9,
  projectionAlert: 0.7,
  overallPacePp: 0.05,
  overallPaceAlertPp: 0.1,
  gmvDown: -0.05,
  gmvDownAlert: -0.1,
  gmvUp: 0.1,
  commissionRatePp: 0.005,
  roiChange: 0.15,
  brandMove: 0.15,
  brandMinShare: 0.05,
  regimeShare: 0.5,
  regimeMinBuckets: 5,
  concentration: 0.5,
  concentrationRisePp: 0.05,
  lagDays: 2,
  pillarShiftPp: 0.03,
}

export const RULE_CATALOG: Array<{ code: string; name: string; rule: string }> = [
  {
    code: "R1",
    name: "Progress di bawah pace",
    rule: `Brand/marketplace dengan realisasi < pace berjalan − ${T.paceBehindPp * 100}pp dan proyeksi akhir bulan < ${T.projectionFloor * 100}% target. "Perlu dicek" bila proyeksi < ${T.projectionAlert * 100}%.`,
  },
  {
    code: "R2",
    name: "Pace bulan berjalan",
    rule: `Realisasi total vs pace berjalan, selisih ≥ ${T.overallPacePp * 100}pp (≥ ${T.overallPaceAlertPp * 100}pp di bawah = perlu dicek). Juga ditampilkan tanpa target brand yang belum punya actual.`,
  },
  {
    code: "R3",
    name: "Perubahan GMV",
    rule: `GMV turun ≤ ${T.gmvDown * 100}% (≤ ${T.gmvDownAlert * 100}% = perlu dicek) atau naik ≥ +${T.gmvUp * 100}% vs pembanding. Penurunan tidak dilaporkan bila data periode belum lengkap.`,
  },
  {
    code: "R5",
    name: "Efisiensi komisi",
    rule: `Commission rate berubah ≥ ${T.commissionRatePp * 100}pp, atau ROI berubah ≥ ±${T.roiChange * 100}%. Tidak dijalankan bila data komisi belum lengkap (R6).`,
  },
  {
    code: "R6",
    name: "Komisi belum lengkap",
    rule: "Ada periode tanpa data komisi (ETL komisi tertinggal dari GMV); metrik komisi belum final.",
  },
  {
    code: "R7",
    name: "Brand berlawanan arah",
    rule: `Brand dengan porsi ≥ ${T.brandMinShare * 100}% GMV yang berubah ≥ ±${T.brandMove * 100}% berlawanan arah dengan total.`,
  },
  {
    code: "R8",
    name: "Kualitas pertumbuhan",
    rule: `Lebih dari ${T.regimeShare * 100}% bucket berlabel dilusi atau produktivitas turun (chart GMV Growth vs Creator Acquisition, min. ${T.regimeMinBuckets} bucket).`,
  },
  {
    code: "R9",
    name: "Konsentrasi creator",
    rule: `10 creator teratas ≥ ${T.concentration * 100}% GMV creator, atau naik ≥ ${T.concentrationRisePp * 100}pp. Agency (agregat) tidak dihitung.`,
  },
  {
    code: "R10",
    name: "Data target",
    rule: "Brand yang punya target bulanan tapi belum punya actual sama sekali — biasanya brand belum berjalan di affiliate atau namanya tidak cocok.",
  },
  {
    code: "R11",
    name: "Data tertinggal",
    rule: `Brand yang datanya tertinggal > ${T.lagDays} hari dari brand terbaru di sumber yang sama (order, achievement, konten).`,
  },
  {
    code: "R12",
    name: "Pergeseran pillar",
    rule: `Porsi GMV sebuah pillar bergeser ≥ ${T.pillarShiftPp * 100}pp vs pembanding.`,
  },
]

export interface FindingsInput {
  pace?: PaceSummary
  kpis?: SummaryKpis
  trend?: SummaryTrendPoint[]
  progress?: ProgressResult | null
  /** Month the progress rows belong to, "YYYY-MM" or "YYYY-MM-DD". */
  progressMonth: string
  compareLabel: string
  periodTo: string
  inputs?: FindingsInputsResult | null
  concentration?: TopCreatorsResult | null
  availability?: DataAvailabilityResult | null
  acquisition?: AcquisitionPoint[]
}

const pp = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}pp`
const pct0 = (v: number) => `${(v * 100).toFixed(0)}%`
const SEVERITY_RANK: Record<Severity, number> = { alert: 0, watch: 1, info: 2 }

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
}

/**
 * Share of the month expected by now. For the running month it counts days up to the last day
 * that actually has achievement data, not today: loads lag a day or two, and judging against
 * today would put every brand "behind pace" by exactly the missing days.
 */
function expectedShare(month: string, dataDay: string | null): { share: number; asOf: string | null } | null {
  const now = new Date()
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const m = month.slice(0, 7)
  if (m > current) return null
  if (m < current) return { share: 1, asOf: null }
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const day = dataDay && dataDay.slice(0, 7) === m ? Number(dataDay.slice(8, 10)) : now.getDate()
  return { share: day / daysInMonth, asOf: dataDay && dataDay.slice(0, 7) === m ? dataDay : null }
}

/** Last day with achievement (actual GMV) data across brands, per the availability endpoint. */
function lastAchievementDay(a?: DataAvailabilityResult | null): string | null {
  let latest: string | null = null
  for (const r of a?.rows ?? []) {
    for (const d of [r.shopeeActual, r.tiktokActual]) if (d && (!latest || d > latest)) latest = d
  }
  return latest
}

export function computeFindings(i: FindingsInput): Finding[] {
  const out: Finding[] = []
  const { kpis, pace, progress } = i

  // R6 — commission lag gates R5, so it is read first.
  const missingCommission = i.trend?.filter((t) => t.roi === null).length ?? 0
  if (missingCommission > 0) {
    out.push({
      id: "r6",
      code: "R6",
      rule: "KOMISI BELUM LENGKAP",
      severity: "info",
      text: `${missingCommission} periode terakhir belum punya data komisi. ROI, Commission Rate, dan Commission untuk rentang ini belum final.`,
      detail: `${missingCommission} bucket tanpa komisi`,
      impact: 0,
    })
  }

  // R10 — targets with no actual at all: a data question, and they distort R1/R2.
  const pacing = expectedShare(i.progressMonth, lastAchievementDay(i.availability))
  const expected = pacing?.share ?? null
  const asOf = pacing?.asOf ? ` (s/d data ${shortDate(pacing.asOf)})` : ""
  const zeroActual = (progress?.brand ?? []).filter((r) => r.target > 0 && r.actual <= 0)
  const zeroTarget = zeroActual.reduce((a, r) => a + r.target, 0)
  if (zeroActual.length > 0) {
    out.push({
      id: "r10",
      code: "R10",
      rule: "DATA TARGET",
      severity: "watch",
      text: `${zeroActual.length} brand punya target bulanan tapi belum ada actual: ${zeroActual.map((r) => r.name || "(tanpa nama)").join(", ")}. Cek apakah brand ini memang belum berjalan di affiliate, atau namanya tidak cocok antara tabel target dan order.`,
      detail: `target ${formatRp(zeroTarget)} tanpa actual`,
      impact: zeroTarget,
    })
  }

  // R2 — overall pace of the running month, against the same data-day pace as R1.
  if (pace && pace.target > 0 && expected !== null) {
    const gap = pace.actualPct - expected
    const adjustedTarget = pace.target - zeroTarget
    const adjusted =
      zeroTarget > 0 && adjustedTarget > 0
        ? ` Tanpa target brand yang belum punya actual: ${pct0(pace.actual / adjustedTarget)}.`
        : ""
    if (gap <= -T.overallPacePp) {
      out.push({
        id: "r2-behind",
        code: "R2",
        rule: `PACE < EXPECTED − ${T.overallPacePp * 100}PP`,
        severity: gap <= -T.overallPaceAlertPp ? "alert" : "watch",
        text: `${pace.monthLabel}: realisasi GMV ${pct0(pace.actualPct)} dari target bulanan, di bawah pace berjalan ${pct0(expected)}${asOf}.${adjusted} Worth checking further.`,
        detail: `selisih ${pp(gap)}`,
        impact: Math.max(expected * pace.target - pace.actual, 0),
      })
    } else if (gap >= T.overallPacePp) {
      out.push({
        id: "r2-ahead",
        code: "R2",
        rule: `PACE > EXPECTED + ${T.overallPacePp * 100}PP`,
        severity: "info",
        text: `${pace.monthLabel}: realisasi GMV sudah ${pct0(pace.actualPct)} dari target bulanan, di atas pace berjalan ${pct0(expected)}${asOf}.${adjusted}`,
        detail: `selisih ${pp(gap)}`,
        impact: pace.actual - expected * pace.target,
      })
    }
  }

  // R1 — behind pace, judged against the data-day pace rather than a flat bar. Marketplaces get
  // a finding each; brands are grouped per severity so a slow month is one line, not twelve.
  if (progress && expected !== null && expected > 0) {
    const behind = (r: { target: number; actual: number; pct: number }) => {
      if (r.target <= 0 || r.actual <= 0) return null
      const projection = r.pct / expected
      if (r.pct >= expected - T.paceBehindPp || projection >= T.projectionFloor) return null
      return { projection, short: expected * r.target - r.actual }
    }
    for (const r of progress.marketplace) {
      const b = behind(r)
      if (!b) continue
      out.push({
        id: `r1-mp-${r.name}`,
        code: "R1",
        rule: "PROGRESS < PACE",
        severity: b.projection < T.projectionAlert ? "alert" : "watch",
        text: `${r.name} baru ${pct0(r.pct)} dari target bulanan, di bawah pace ${pct0(expected)}${asOf} — proyeksi akhir bulan ${pct0(b.projection)} target.`,
        detail: `${pp(r.pct - expected)} vs pace · kurang ${formatRp(b.short)}`,
        impact: b.short,
      })
    }
    const brands = progress.brand
      .map((r) => ({ r, b: behind(r) }))
      .filter((x): x is { r: (typeof progress.brand)[number]; b: { projection: number; short: number } } => x.b !== null)
      .sort((x, y) => y.b.short - x.b.short)
    for (const severity of ["alert", "watch"] as const) {
      const group = brands.filter((x) => (x.b.projection < T.projectionAlert ? "alert" : "watch") === severity)
      if (group.length === 0) continue
      const short = group.reduce((a, x) => a + x.b.short, 0)
      out.push({
        id: `r1-brands-${severity}`,
        code: "R1",
        rule: "PROGRESS < PACE",
        severity,
        text: `${group.length} brand di bawah pace ${pct0(expected)}${asOf}, proyeksi ${severity === "alert" ? `< ${T.projectionAlert * 100}%` : `${T.projectionAlert * 100}–${T.projectionFloor * 100}%`} target: ${group
          .map((x) => `${x.r.name} (${pct0(x.r.pct)}, proyeksi ${pct0(x.b.projection)})`)
          .join(", ")}.`,
        detail: `kurang ${formatRp(short)} dari pace`,
        impact: short,
      })
    }
  }

  if (kpis) {
    // R3 — GMV move; a drop is held back while the period's data is still arriving.
    const latest = i.availability?.latest ?? null
    const incomplete = latest !== null && i.periodTo > latest
    const g = kpis.gmv.deltaPct
    if (incomplete) {
      out.push({
        id: "r3-incomplete",
        code: "R3",
        rule: "PERIODE BELUM LENGKAP",
        severity: "info",
        text: `Data order baru sampai ${shortDate(latest)}, sedangkan periode sampai ${shortDate(i.periodTo)}. Perbandingan GMV bisa terlihat lebih rendah dari seharusnya, jadi penurunan GMV tidak dilaporkan.`,
        detail: `data s/d ${shortDate(latest)}`,
        impact: 0,
      })
    }
    if (g !== null && g <= T.gmvDown && !incomplete) {
      out.push({
        id: "r3-down",
        code: "R3",
        rule: `GMV Δ ≤ ${T.gmvDown * 100}%`,
        severity: g <= T.gmvDownAlert ? "alert" : "watch",
        text: `GMV Affiliate turun ${formatSignedPercent(g)} ${i.compareLabel}. Worth checking further.`,
        detail: `aktual ${formatSignedPercent(g)} (${formatRp(kpis.gmv.delta)})`,
        impact: Math.abs(kpis.gmv.delta),
      })
    } else if (g !== null && g >= T.gmvUp) {
      out.push({
        id: "r3-up",
        code: "R3",
        rule: `GMV Δ ≥ +${T.gmvUp * 100}%`,
        severity: "info",
        text: `GMV Affiliate naik ${formatSignedPercent(g)} ${i.compareLabel}.`,
        detail: `aktual ${formatSignedPercent(g)} (+${formatRp(kpis.gmv.delta)})`,
        impact: Math.abs(kpis.gmv.delta),
      })
    }

    // R5 — commission efficiency, only once commission data is complete.
    if (missingCommission === 0) {
      const ratePp = kpis.commissionRate.delta
      if (Math.abs(ratePp) >= T.commissionRatePp) {
        out.push({
          id: "r5-rate",
          code: "R5",
          rule: `COMMISSION RATE Δ ≥ ${T.commissionRatePp * 100}PP`,
          severity: ratePp > 0 ? "watch" : "info",
          text: `Commission rate ${ratePp > 0 ? "naik" : "turun"} ke ${formatPercent(kpis.commissionRate.value, 2)} ${i.compareLabel} — biaya komisi per rupiah GMV ${ratePp > 0 ? "lebih mahal" : "lebih murah"}.`,
          detail: `aktual ${pp(ratePp)}`,
          impact: Math.abs(ratePp) * kpis.gmv.value,
        })
      }
      const roi = kpis.roi.deltaPct
      if (roi !== null && Math.abs(roi) >= T.roiChange) {
        out.push({
          id: "r5-roi",
          code: "R5",
          rule: `ROI Δ ≥ ±${T.roiChange * 100}%`,
          severity: roi < 0 ? "watch" : "info",
          text: `ROI (GMV ÷ komisi) ${roi < 0 ? "turun" : "naik"} ${formatSignedPercent(roi)} ${i.compareLabel}, kini ${kpis.roi.value.toFixed(1)}x.`,
          detail: `aktual ${formatSignedPercent(roi)}`,
          impact: Math.abs(kpis.commission.delta),
        })
      }
    }

    // R7 — sizeable brands moving against the total.
    const total = kpis.gmv.deltaPct
    const brands = i.inputs?.brands ?? []
    const brandTotal = brands.reduce((a, b) => a + b.gmv, 0)
    if (total !== null && brandTotal > 0) {
      for (const b of brands) {
        if (b.gmvPrev <= 0) continue
        const bg = (b.gmv - b.gmvPrev) / b.gmvPrev
        const share = b.gmv / brandTotal
        if (share >= T.brandMinShare && Math.abs(bg) >= T.brandMove && Math.sign(bg) !== Math.sign(total)) {
          out.push({
            id: `r7-${b.name}`,
            code: "R7",
            rule: "BRAND BERLAWANAN ARAH",
            severity: bg < 0 ? "watch" : "info",
            text: `${b.name} ${bg < 0 ? "turun" : "naik"} ${formatSignedPercent(bg)} saat total GMV ${total < 0 ? "turun" : "naik"} ${formatSignedPercent(total)} ${i.compareLabel}.`,
            detail: `porsi ${formatPercent(share)} · ${formatRp(b.gmv - b.gmvPrev)}`,
            impact: Math.abs(b.gmv - b.gmvPrev),
          })
        }
      }
    }
  }

  // R8 — growth quality, from the quantity/quality labels.
  const labelled = (i.acquisition ?? []).map(classify).filter((r) => r !== null)
  if (labelled.length >= T.regimeMinBuckets) {
    const weak = labelled.filter((r) => r === "dilution" || r === "weaker").length
    if (weak / labelled.length > T.regimeShare) {
      out.push({
        id: "r8",
        code: "R8",
        rule: "PERTUMBUHAN KURANG PRODUKTIF",
        severity: "watch",
        text: `${weak} dari ${labelled.length} bucket berlabel dilusi atau produktivitas turun — GMV per creator lebih sering melemah daripada menguat. Lihat chart GMV Growth vs Creator Acquisition.`,
        detail: `${pct0(weak / labelled.length)} bucket`,
        impact: 0,
      })
    }
  }

  // R9 — creator concentration.
  const c = i.concentration
  if (c && c.topShare !== null) {
    const rise = c.topSharePrev !== null ? c.topShare - c.topSharePrev : null
    if (c.topShare >= T.concentration || (rise !== null && rise >= T.concentrationRisePp)) {
      out.push({
        id: "r9",
        code: "R9",
        rule: "KONSENTRASI CREATOR",
        severity: "watch",
        text: `10 creator teratas menguasai ${formatPercent(c.topShare)} GMV creator${c.topSharePrev !== null ? ` (sebelumnya ${formatPercent(c.topSharePrev)})` : ""} — ketergantungan pada segelintir creator.`,
        detail: rise !== null ? `aktual ${formatPercent(c.topShare)} · ${pp(rise)}` : `aktual ${formatPercent(c.topShare)}`,
        impact: c.topShare * (c.total - c.agencyGmv),
      })
    }
  }

  // R11 — brands whose data lags the rest of its source.
  const a = i.availability
  if (a) {
    const columns = [
      ["shopeeOrders", "order Shopee"],
      ["tiktokOrders", "order TikTok"],
      ["shopeeActual", "achievement Shopee"],
      ["tiktokActual", "achievement TikTok"],
      ["tiktokContent", "konten TikTok"],
    ] as const
    const lags: string[] = []
    for (const [key, label] of columns) {
      const freshest = a.rows.reduce<string | null>((acc, r) => (r[key] && (!acc || r[key]! > acc) ? r[key] : acc), null)
      if (!freshest) continue
      for (const r of a.rows) {
        const d = r[key]
        if (!d) continue
        const days = (new Date(`${freshest}T00:00:00`).getTime() - new Date(`${d}T00:00:00`).getTime()) / 86_400_000
        if (days > T.lagDays) lags.push(`${r.brand} (${label} s/d ${shortDate(d)})`)
      }
    }
    if (lags.length > 0) {
      out.push({
        id: "r11",
        code: "R11",
        rule: "DATA TERTINGGAL",
        severity: "info",
        text: `Data beberapa brand tertinggal dari brand lain di sumber yang sama, jadi hari-hari terakhirnya bisa terbaca rendah: ${lags.slice(0, 6).join(", ")}${lags.length > 6 ? `, dan ${lags.length - 6} lainnya` : ""}.`,
        detail: `${lags.length} sumber × brand`,
        impact: 0,
      })
    }
  }

  // R12 — pillar mix shift.
  const pillars = i.inputs?.pillars ?? []
  const pNow = pillars.reduce((s, p) => s + p.gmv, 0)
  const pPrev = pillars.reduce((s, p) => s + p.gmvPrev, 0)
  if (pNow > 0 && pPrev > 0) {
    for (const p of pillars) {
      const shift = p.gmv / pNow - p.gmvPrev / pPrev
      if (Math.abs(shift) >= T.pillarShiftPp) {
        out.push({
          id: `r12-${p.name}`,
          code: "R12",
          rule: "PERGESERAN PILLAR",
          severity: "info",
          text: `Porsi ${p.name} ${shift > 0 ? "naik" : "turun"} dari ${formatPercent(p.gmvPrev / pPrev)} ke ${formatPercent(p.gmv / pNow)} ${i.compareLabel}.`,
          detail: `${pp(shift)} · ${formatRp(p.gmv)}`,
          impact: Math.abs(p.gmv - p.gmvPrev),
        })
      }
    }
  }

  return out.sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity] || y.impact - x.impact)
}
