export const KATEGORI = {
  pemasukan: ['Gaji', 'Bonus', 'Bisnis / Freelance', 'Dividen', 'Lainnya'],
  pengeluaran: ['Makan & Minum', 'Transport', 'Belanja', 'Tagihan & Utilitas', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Keluarga', 'Lainnya'],
  investasi: ['Saham', 'Reksadana', 'Crypto', 'Emas', 'Deposito', 'Lainnya'],
};

export const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const bulanKey = (d = new Date()) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};

export const namaBulan = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });
};

export function toCSV(rows, akunMap = {}) {
  const header = ['id', 'tanggal', 'tipe', 'kategori', 'jumlah', 'akun', 'akun_tujuan', 'catatan'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.join(',')];
  for (const r of rows) {
    const row = {
      ...r,
      akun: akunMap[r.akunId] || r.akunId || '',
      akun_tujuan: akunMap[r.akunTujuan] || r.akunTujuan || '',
    };
    lines.push(header.map((h) => esc(row[h])).join(','));
  }
  return lines.join('\n');
}

export function download(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const JENIS_AKUN = {
  bank: { label: '🏦 Bank', emoji: '🏦' },
  ewallet: { label: '📱 E-Wallet', emoji: '📱' },
  emoney: { label: '💳 E-Money', emoji: '💳' },
  tunai: { label: '💵 Tunai', emoji: '💵' },
  investasi: { label: '📈 Sekuritas/Investasi', emoji: '📈' },
  lainnya: { label: '📦 Lainnya', emoji: '📦' },
};

export function seedAccounts() {
  return [
    { id: 'akun-bca', nama: 'BCA', jenis: 'bank', saldoAwal: 5000000 },
    { id: 'akun-mandiri', nama: 'Bank Mandiri', jenis: 'bank', saldoAwal: 3000000 },
    { id: 'akun-muamalat', nama: 'Muamalat', jenis: 'bank', saldoAwal: 2000000 },
    { id: 'akun-gopay', nama: 'GoPay', jenis: 'ewallet', saldoAwal: 500000 },
    { id: 'akun-tapcash', nama: 'TapCash BNI', jenis: 'emoney', saldoAwal: 300000 },
    { id: 'akun-tunai', nama: 'Tunai', jenis: 'tunai', saldoAwal: 1000000 },
  ];
}

// saldo per akun = saldoAwal + masuk - keluar - investasi keluar + transfer masuk - transfer keluar
export function hitungSaldoAkun(accounts, transactions) {
  const map = {};
  for (const a of accounts) map[a.id] = Number(a.saldoAwal) || 0;
  for (const t of transactions || []) {
    const j = Number(t.jumlah) || 0;
    if (t.tipe === 'pemasukan' && t.akunId && map[t.akunId] !== undefined) map[t.akunId] += j;
    else if ((t.tipe === 'pengeluaran' || t.tipe === 'investasi') && t.akunId && map[t.akunId] !== undefined) map[t.akunId] -= j;
    else if (t.tipe === 'transfer') {
      if (t.akunId && map[t.akunId] !== undefined) map[t.akunId] -= j;
      if (t.akunTujuan && map[t.akunTujuan] !== undefined) map[t.akunTujuan] += j;
    }
  }
  return map;
}

export function seedData() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const t = (day, tipe, kategori, jumlah, catatan, akunId = 'akun-bca', akunTujuan = undefined) => ({
    id: uid() + day + kategori,
    tanggal: `${y}-${m}-${String(day).padStart(2, '0')}`,
    tipe,
    kategori,
    jumlah,
    catatan,
    akunId,
    ...(akunTujuan ? { akunTujuan } : {}),
  });
  return {
    accounts: seedAccounts(),
    transactions: [
      t(1, 'pemasukan', 'Gaji', 12000000, 'Gaji bulanan', 'akun-bca'),
      t(2, 'pengeluaran', 'Makan & Minum', 350000, 'Groceries + jajan', 'akun-gopay'),
      t(3, 'pengeluaran', 'Transport', 250000, 'Bensin + parkir', 'akun-tapcash'),
      t(4, 'pengeluaran', 'Tagihan & Utilitas', 850000, 'Kost + listrik + internet', 'akun-mandiri'),
      t(5, 'investasi', 'Reksadana', 2000000, 'Auto-debet bibit', 'akun-bca'),
      t(6, 'investasi', 'Emas', 1000000, 'Tabung emas', 'akun-muamalat'),
      t(7, 'pengeluaran', 'Hiburan', 400000, 'Nonton + kopi', 'akun-gopay'),
      t(10, 'pengeluaran', 'Belanja', 1200000, 'Belanja bulanan', 'akun-mandiri'),
      t(12, 'pemasukan', 'Bisnis / Freelance', 2500000, 'Proyek sampingan', 'akun-bca'),
    ],
    budgets: [
      { id: uid() + 'b1', kategori: 'Makan & Minum', limit: 2000000, bulan: `${y}-${m}` },
      { id: uid() + 'b2', kategori: 'Transport', limit: 800000, bulan: `${y}-${m}` },
      { id: uid() + 'b3', kategori: 'Belanja', limit: 1500000, bulan: `${y}-${m}` },
      { id: uid() + 'b4', kategori: 'Hiburan', limit: 500000, bulan: `${y}-${m}` },
      { id: uid() + 'b5', kategori: 'Tagihan & Utilitas', limit: 1000000, bulan: `${y}-${m}` },
    ],
  };
}

// ---------- Perencanaan: tabungan & dana darurat ----------
// Ilmu yang dipakai:
// - 50/30/20 (Elizabeth Warren): 50% kebutuhan, 30% keinginan, 20% masa depan.
//   Untuk gaji kecil (< 7jt) dilonggarkan jadi 60/25/15 agar realistis.
// - Dana darurat = pengeluaran wajib/bulan x pengali status:
//   single 4x (ideal 3–6x), menikah 6x (6–9x), menikah+anak 9x (9–12x).
// - Prioritas: darurat dulu, lalu tabungan goals, lalu investasi bertumbuh.
// - Pay-yourself-first: sisihkan di awal bulan via auto-debet.

export const STATUS_DARURAT = {
  single: { label: 'Single / belum menikah', pengali: 4, range: '3–6x', ket: 'Minimal 3x, ideal 4–6x pengeluaran.' },
  menikah: { label: 'Menikah (belum ada anak)', pengali: 6, range: '6–9x', ket: 'Dua kepala, risiko double. Ideal 6–9x.' },
  anak: { label: 'Menikah + anak / sandwich', pengali: 9, range: '9–12x', ket: 'Tanggungan besar. Ideal 9–12x.' },
};

export function rekomendasiAlokasi(gaji, status = 'single') {
  const g = Number(gaji) || 0;
  if (g <= 0) return null;
  // basis persentase adaptif terhadap besaran gaji
  let pButuh = 50, pIngin = 30, pMasaDepan = 20;
  let metode = '50/30/20 klasik';
  if (g < 5000000) { pButuh = 65; pIngin = 25; pMasaDepan = 10; metode = '65/25/10 (gaji < 5jt, mode bertahan)'; }
  else if (g < 8000000) { pButuh = 60; pIngin = 25; pMasaDepan = 15; metode = '60/25/15 (gaji 5–8jt, mode transisi)'; }
  else if (g >= 20000000) { pButuh = 40; pIngin = 30; pMasaDepan = 30; metode = '40/30/30 (gaji ≥ 20jt, mode akselerasi)'; }

  // pecah masa depan: darurat vs tabungan vs investasi
  // kalau darurat belum penuh: darurat porsi lebih besar
  let pDarurat = Math.round(pMasaDepan * 0.3);
  let pTabungan = Math.round(pMasaDepan * 0.3);
  let pInvest = pMasaDepan - pDarurat - pTabungan;

  const rupiahPersen = (p) => Math.round((g * p) / 100);
  return {
    metode, pButuh, pIngin, pMasaDepan, pDarurat, pTabungan, pInvest,
    nominal: {
      kebutuhan: rupiahPersen(pButuh),
      keinginan: rupiahPersen(pIngin),
      darurat: rupiahPersen(pDarurat),
      tabungan: rupiahPersen(pTabungan),
      investasi: rupiahPersen(pInvest),
    },
    saran: saranKeuangan(g, status),
  };
}

export function saranKeuangan(gaji, status) {
  const s = [];
  if (gaji < 5000000) s.push('Gaji di bawah 5jt: fokus ke dana darurat kecil dulu (target 3x), jangan paksakan 20% bila kebutuhan pokok > 65%.');
  if (gaji >= 5000000 && gaji < 10000000) s.push('Sweet spot menabung: auto-debet 15% di tanggal gajian sebelum belanja apa pun.');
  if (gaji >= 10000000) s.push('Gaji ≥ 10jt: naikkan porsi masa depan ke 20–30%. Gaya hidup jangan naik setara kenaikan gaji.');
  if (status === 'single') s.push('Status single: kejar dana darurat 4x pengeluaran wajib, simpan di e-wallet + RDPU (likuid).');
  if (status === 'menikah') s.push('Status menikah: pisahkan rekening darurat dengan rekening belanja agar tidak terpakai.');
  if (status === 'anak') s.push('Ada anak/tanggungan: wajibkan asuransi kesehatan + darurat 9–12x. Jangan taruh darurat di saham/crypto.');
  s.push('Urutan pay-yourself-first: gajian → darurat → tabungan goals → investasi → baru belanja keinginan.');
  return s;
}

export function targetDarurat(pengeluaranWajib, status = 'single') {
  const info = STATUS_DARURAT[status] || STATUS_DARURAT.single;
  const w = Number(pengeluaranWajib) || 0;
  return { ...info, target: w * info.pengali, min: w * Number(info.range.split('–')[0]) };
}
