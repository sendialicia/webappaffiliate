import { money, pct, plain, type PresetSpec } from "@/components/charts/product-quadrant"
import type { SkuRow, SkuQuadrantPreset } from "@/types/sku"

/** The shared quadrant keys rows by `pid`; here that identity is the barcode. */
export type SkuQuadrantRow = SkuRow & { pid: string }

export const SKU_QUADRANT_PRESETS: Record<SkuQuadrantPreset, PresetSpec<SkuQuadrantRow>> = {
  "shopee-tiktok": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Lintas marketplace · GMV Shopee × GMV TikTok",
    purpose: "Lihat SKU mana yang jalan di dua marketplace, dan mana yang praktis cuma hidup di satu.",
    why: "Sumbu X GMV dari Shopee, sumbu Y GMV dari TikTok, untuk barcode yang sama. Titik yang jauh dari garis diagonal berarti timpang.",
    x: { label: "GMV Shopee", value: (r) => r.shopee.gmv, format: money },
    y: { label: "GMV TikTok", value: (r) => r.tiktok.gmv, format: money },
    quadrants: [
      { pos: "Kanan atas", label: "Kuat di dua-duanya — SKU andalan" },
      { pos: "Kiri atas", label: "Hanya jalan di TikTok — peluang dibuka di Shopee" },
      { pos: "Kanan bawah", label: "Hanya jalan di Shopee — peluang dibuka di TikTok" },
      { pos: "Kiri bawah", label: "Kecil di dua-duanya" },
    ],
  },
  "gmv-growth": {
    size: { label: "jumlah creator", value: (r) => r.creators },
    name: "Skala × Momentum",
    purpose: "Cari tahu SKU mana yang menopang GMV sekarang, dan mana yang sedang naik cepat.",
    why: "Sumbu X GMV gabungan dua marketplace, sumbu Y pertumbuhannya vs periode pembanding.",
    x: { label: "GMV", value: (r) => r.gmv, format: money },
    y: { label: "GMV Growth", value: (r) => (r.growth === null ? null : r.growth * 100), format: pct },
    quadrants: [
      { pos: "Kanan atas", label: "Besar dan tumbuh — penopang utama" },
      { pos: "Kiri atas", label: "Kecil tapi tumbuh — kandidat untuk didorong" },
      { pos: "Kanan bawah", label: "Besar tapi melambat — perlu diperiksa" },
      { pos: "Kiri bawah", label: "Kecil dan melambat — prioritas rendah" },
    ],
  },
  "sold-aov": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Volume × Nilai · Items Sold × AOV",
    purpose: "Bedakan SKU yang bertahan lewat jumlah terjual dari yang bertahan lewat nilai transaksi.",
    why: "Sumbu X unit terjual, sumbu Y nilai rata-rata per order.",
    x: { label: "Items Sold", value: (r) => r.itemsSold, format: plain },
    y: { label: "AOV", value: (r) => r.aov, format: money },
    quadrants: [
      { pos: "Kanan atas", label: "Laku banyak dan nilainya besar" },
      { pos: "Kiri atas", label: "Volume kecil tapi tiap order bernilai tinggi" },
      { pos: "Kanan bawah", label: "Laku banyak tapi nilainya tipis" },
      { pos: "Kiri bawah", label: "Volume kecil dan nilai kecil" },
    ],
  },
  "creators-gmv": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Sebaran creator · Creators × GMV per creator",
    purpose: "Lihat SKU yang bergantung pada sedikit creator besar versus yang tersebar merata.",
    why: "Sumbu X jumlah creator unik lintas marketplace, sumbu Y GMV rata-rata per creator.",
    x: { label: "Creators", value: (r) => r.creators, format: plain },
    y: {
      label: "GMV per creator",
      value: (r) => (r.creators > 0 ? r.gmv / r.creators : null),
      format: money,
    },
    quadrants: [
      { pos: "Kanan atas", label: "Banyak creator dan tiap creator produktif" },
      { pos: "Kiri atas", label: "Bergantung pada sedikit creator besar — rapuh" },
      { pos: "Kanan bawah", label: "Banyak creator tapi kontribusi masing-masing kecil" },
      { pos: "Kiri bawah", label: "Sedikit creator, kontribusi kecil" },
    ],
  },
}
