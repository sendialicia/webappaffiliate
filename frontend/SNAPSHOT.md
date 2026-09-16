# Mode Snapshot

Membekukan respons backend jadi file JSON statis, supaya halaman bisa dibuka tanpa
backend, tanpa ClickHouse, dan tanpa VPN. Dipakai untuk mengirim hasil kerja ke
reviewer yang tidak punya akses ke jaringan internal.

## Untuk yang menerima snapshot

Tidak perlu Node berjalan sebagai server, tidak perlu backend:

```bash
npx serve out
```

Lalu buka alamat yang muncul (biasanya `http://localhost:3000`) dan klik
`/overview` atau `/shopee-pid`.

Filter, drill-down, sorting, dan pemilihan produk tetap berfungsi selama
kombinasinya termasuk yang direkam. Kombinasi di luar itu memunculkan pesan
"Kombinasi filter ini tidak ada di snapshot" — itu batas snapshot, bukan error.

## Untuk yang membuat snapshot

Butuh VPN aktif dan backend berjalan di `localhost:4000`.

```bash
# 1. Rekam respons backend ke public/snapshot/
npm run snapshot:capture

# 2. Build statis ke folder out/
npm run snapshot:build

# 3. Cek hasilnya sebelum dikirim
npm run snapshot:serve
```

Kirimkan folder `out/` (boleh di-zip).

## Yang direkam

`scripts/capture-snapshot.mjs` memakai daftar skenario eksplisit, bukan seluruh
kombinasi. Cross product penuh mencapai ribuan permintaan dan tiap permintaan
memakan 1-5 detik di tabel 41 juta baris, jadi rekamannya dibatasi ke:

- Periode: MTD, QTD, YTD (plus pembanding vs periode sebelumnya dan vs tahun lalu)
- Brand: semua, Wardah, OMG · Marketplace: semua, Tiktok, Shopee
- Semua dimensi composition (pillar/category/format) dan driver (brand/marketplace × format/category)
- Drill bulanan Januari-Desember pada grafik tahunan
- Shopee PID: tiga level (category/sub category/format), scope teratas tiap level,
  dan deep dive 20 produk dengan GMV terbesar

Menambah kombinasi cukup dengan menambah entri di `SCENARIOS` atau `PID_SCENARIOS`,
lalu jalankan ulang capture.

## Cara kerjanya

`apiFetch` membaca `NEXT_PUBLIC_SNAPSHOT`. Kalau bernilai `1`, permintaan dialihkan
dari backend ke `/snapshot/<key>.json`. Key dihitung dari path + query yang sudah
diurutkan, memakai fungsi yang sama persis di `src/lib/snapshot-key.ts` dan di
script capture — jadi urutan parameter yang berbeda tetap menunjuk ke file yang
sama.

`next.config.ts` hanya mengaktifkan `output: "export"` ketika flag itu menyala, jadi
`npm run dev` dan `npm run build` biasa tidak terpengaruh.

`public/snapshot/manifest.json` mencatat key mana berasal dari URL mana, berguna saat
menelusuri kombinasi yang hilang.
