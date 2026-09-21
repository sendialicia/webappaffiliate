import { money, pct, plain, type PresetSpec } from "@/components/charts/product-quadrant"
import type { TtProductRow, TtQuadrantPreset } from "@/types/tiktok-pid"

/**
 * The first four mirror Shopee's so the two pages read the same way. The last four exist only
 * here: impressions, add-to-cart, content counts and creator counts have no SP_ counterpart,
 * and together they replace Shopee's "Buyers × New Buyer Share", which TikTok cannot support.
 */
export const TT_QUADRANT_PRESETS: Record<TtQuadrantPreset, PresetSpec<TtProductRow>> = {
  "gmv-growth": {
    size: { label: "jumlah creator", value: (r) => r.creators },
    name: "Skala × Momentum",
    purpose: "Cari tahu produk mana yang menopang GMV sekarang, dan mana yang sedang naik cepat.",
    why: "Sumbu X GMV periode ini, sumbu Y pertumbuhannya vs periode pembanding.",
    x: { label: "GMV", value: (r) => r.gmv, format: money },
    y: { label: "GMV Growth", value: (r) => (r.growth === null ? null : r.growth * 100), format: pct },
    quadrants: [
      { pos: "Kanan atas", label: "Besar dan tumbuh — penopang utama" },
      { pos: "Kiri atas", label: "Kecil tapi tumbuh — kandidat untuk didorong" },
      { pos: "Kanan bawah", label: "Besar tapi melambat — perlu diperiksa" },
      { pos: "Kiri bawah", label: "Kecil dan melambat — prioritas rendah" },
    ],
  },
  "impressions-ctr": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Jangkauan × Daya tarik · Impressions × CTR",
    purpose: "Pisahkan produk yang tayang luas tapi tidak menarik, dari yang jarang tayang tapi sekali tayang diklik.",
    why: "Sumbu X jumlah tayangan produk, sumbu Y porsi tayangan yang berujung klik.",
    x: { label: "Impressions", value: (r) => r.ttImpressions, format: plain },
    y: { label: "CTR", value: (r) => (r.ttCtr === null ? null : r.ttCtr * 100), format: pct },
    quadrants: [
      { pos: "Kanan atas", label: "Tayang luas dan menarik — sudah bekerja" },
      { pos: "Kiri atas", label: "Menarik tapi kurang tayang — layak didorong" },
      { pos: "Kanan bawah", label: "Tayangan terbuang — materinya kurang menarik" },
      { pos: "Kiri bawah", label: "Sepi tayangan dan sepi klik" },
    ],
  },
  "clicks-corate": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Efisiensi trafik · Clicks × CO Rate",
    purpose: "Cari produk yang ramai diklik tapi jarang dibeli, atau sebaliknya.",
    why: "Sumbu X jumlah klik produk, sumbu Y rasio klik yang berujung order.",
    x: { label: "Clicks", value: (r) => r.ttClicks, format: plain },
    y: { label: "CO Rate (centre)", value: (r) => (r.ttCoRate === null ? null : r.ttCoRate * 100), format: pct },
    quadrants: [
      { pos: "Kanan atas", label: "Trafik tinggi dan konversi bagus" },
      { pos: "Kiri atas", label: "Konversi bagus tapi trafik kurang" },
      { pos: "Kanan bawah", label: "Trafik terbuang — konversi rendah" },
      { pos: "Kiri bawah", label: "Sepi di kedua sisi" },
    ],
  },
  "atc-rate": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Kebocoran keranjang · Add to Cart × ATC→Order",
    purpose: "Temukan produk yang sering masuk keranjang tapi jarang sampai checkout.",
    why: "Sumbu X jumlah add to cart, sumbu Y porsi keranjang yang berujung order.",
    x: { label: "Add to Cart", value: (r) => r.ttAddToCart, format: plain },
    y: { label: "ATC → Order (centre)", value: (r) => (r.ttAtcRate === null ? null : r.ttAtcRate * 100), format: pct },
    quadrants: [
      { pos: "Kanan atas", label: "Banyak masuk keranjang dan banyak jadi order" },
      { pos: "Kiri atas", label: "Sekali masuk keranjang hampir pasti dibeli" },
      { pos: "Kanan bawah", label: "Keranjang bocor — paling banyak ditinggalkan" },
      { pos: "Kiri bawah", label: "Jarang masuk keranjang" },
    ],
  },
  "content-gmv": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "New content · New content × GMV",
    purpose: "Lihat produk yang GMV-nya ikut naik bersama konten baru dan yang belum tersentuh konten baru.",
    // No GMV-per-content ratio: TT_VIDEOS/TT_LIVE_STREAMS count NEW content only, while GMV comes
    // from every piece of content, old and new — dividing one by the other overstates the yield.
    why: "Sumbu X jumlah new content (video + live baru dari affiliate centre), sumbu Y GMV affiliate. Tidak dibagi per konten, karena GMV juga datang dari konten lama.",
    x: { label: "New content (video + live)", value: (r) => r.ttContentCount, format: plain },
    y: { label: "GMV", value: (r) => r.gmv, format: money },
    quadrants: [
      { pos: "Kanan atas", label: "Banyak new content dan GMV besar" },
      { pos: "Kiri atas", label: "GMV besar dengan sedikit new content" },
      { pos: "Kanan bawah", label: "Banyak new content tapi GMV masih kecil" },
      { pos: "Kiri bawah", label: "Sedikit new content dan GMV kecil" },
    ],
  },
  "creators-gmv": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Sebaran creator · Creators × GMV per creator",
    purpose: "Lihat produk yang bergantung pada sedikit creator besar versus yang tersebar merata.",
    why: "Sumbu X jumlah creator yang menjual, sumbu Y GMV rata-rata per creator.",
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
  "asp-units": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Harga × Volume · ASP × Units",
    purpose: "Lihat apakah produk bertahan lewat harga tinggi atau lewat jumlah terjual.",
    why: "Sumbu X harga jual rata-rata, sumbu Y unit terjual.",
    x: {
      label: "ASP",
      value: (r) => (r.itemsSold > 0 ? r.gmv / r.itemsSold : null),
      format: money,
    },
    y: { label: "Items Sold", value: (r) => r.itemsSold, format: plain },
    quadrants: [
      { pos: "Kanan atas", label: "Harga tinggi dan laku banyak" },
      { pos: "Kiri atas", label: "Harga rendah, volume besar" },
      { pos: "Kanan bawah", label: "Harga tinggi, volume tipis" },
      { pos: "Kiri bawah", label: "Harga rendah, volume tipis" },
    ],
  },
  "commrate-growth": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Imbal hasil komisi · Rate × Growth",
    purpose: "Cek apakah komisi yang lebih besar benar-benar berbuah pertumbuhan.",
    why: "Sumbu X porsi komisi terhadap GMV (angka internal), sumbu Y pertumbuhan GMV.",
    x: {
      label: "Commission Rate",
      value: (r) => (r.commissionRate === null ? null : r.commissionRate * 100),
      format: pct,
    },
    y: { label: "GMV Growth", value: (r) => (r.growth === null ? null : r.growth * 100), format: pct },
    quadrants: [
      { pos: "Kanan atas", label: "Komisi besar, tumbuh — mahal tapi berhasil" },
      { pos: "Kiri atas", label: "Komisi kecil, tumbuh — paling efisien" },
      { pos: "Kanan bawah", label: "Komisi besar, melambat — perlu diperiksa" },
      { pos: "Kiri bawah", label: "Komisi kecil, melambat" },
    ],
  },
}
