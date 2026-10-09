import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import {
  KATEGORI, rupiah, uid, bulanKey, namaBulan,
  toCSV, download, seedData, seedAccounts, hitungSaldoAkun, JENIS_AKUN,
  rekomendasiAlokasi, targetDarurat, STATUS_DARURAT,
} from './lib/finance.js';
import { useCloudSync } from './lib/useCloudSync.js';
import { compressImageFile, rekapPetty, groupByTanggal, exportPettyDocx, periodeLabelPetty } from './lib/petty.js';

const LS_TX = 'duitku.transactions.v1';
const LS_BD = 'duitku.budgets.v1';
const LS_ACC = 'duitku.accounts.v1';
const LS_PLAN = 'duitku.plan.v1';
const LS_GOALS = 'duitku.goals.v1';
const LS_EMG = 'duitku.emergency.v1';
const LS_DEBT = 'duitku.debts.v1';
const LS_PETTY = 'duitku.petty.v1';
const LS_THEME = 'duitku.theme.v1';
const COLORS = ['#123C35', '#53D6A0', '#172B4D', '#0E7A3D', '#D97706', '#0EA5A0', '#7FB69E', '#3B5A8F', '#C81E1E'];

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [transactions, setTransactions] = useState(() => load(LS_TX, null));
  const [budgets, setBudgets] = useState(() => load(LS_BD, null));
  const [accounts, setAccounts] = useState(() => load(LS_ACC, null));
  const [plan, setPlan] = useState(() => load(LS_PLAN, { gaji: 12000000, status: 'single', wajib: 6000000, custom: null }));
  const [goals, setGoals] = useState(() => load(LS_GOALS, [
    { id: 'g1', nama: 'DP Rumah', target: 50000000, terkumpul: 12000000, deadline: '' },
    { id: 'g2', nama: 'Liburan Jepang', target: 20000000, terkumpul: 5000000, deadline: '' },
  ]));
  const [emg, setEmg] = useState(() => load(LS_EMG, { terkumpul: 8000000, targetManual: '' }));
  const [debts, setDebts] = useState(() => load(LS_DEBT, [
    { id: 'd1', tipe: 'piutang', nama: 'Andi', jumlah: 1500000, terbayar: 500000, tanggal: new Date().toISOString().slice(0, 10), jatuhTempo: '', catatan: 'Pinjam untuk servis motor' },
    { id: 'd2', tipe: 'utang', nama: 'Kartu Kredit', jumlah: 2000000, terbayar: 0, tanggal: new Date().toISOString().slice(0, 10), jatuhTempo: '', catatan: 'Cicilan HP' },
  ]));
  const [petty, setPetty] = useState(() => load(LS_PETTY, []));
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_THEME);
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
      return 'light';
    } catch { return 'light'; }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(LS_THEME, theme); } catch { /* abaikan */ }
  }, [theme]);
  const [bulan, setBulan] = useState(bulanKey());
  const [filterTipe, setFilterTipe] = useState('semua');
  const [cari, setCari] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (transactions === null || budgets === null) {
      const s = seedData();
      setTransactions(s.transactions);
      setBudgets(s.budgets);
      if (load(LS_ACC, null) === null) setAccounts(s.accounts);
    } else if (accounts === null) {
      setAccounts(seedAccounts());
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => { if (transactions !== null) localStorage.setItem(LS_TX, JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { if (budgets !== null) localStorage.setItem(LS_BD, JSON.stringify(budgets)); }, [budgets]);
  useEffect(() => { if (accounts !== null) localStorage.setItem(LS_ACC, JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem(LS_PLAN, JSON.stringify(plan)); }, [plan]);
  useEffect(() => { localStorage.setItem(LS_GOALS, JSON.stringify(goals)); }, [goals]);
  useEffect(() => { localStorage.setItem(LS_EMG, JSON.stringify(emg)); }, [emg]);
  useEffect(() => { localStorage.setItem(LS_DEBT, JSON.stringify(debts)); }, [debts]);
  useEffect(() => { if (petty !== null) localStorage.setItem(LS_PETTY, JSON.stringify(petty)); }, [petty]);

  // ---- cloud sync (laptop ↔ HP data sama) ----
  const sync = useCloudSync({
    transactions, budgets, accounts, plan, goals, emergency: emg, debts, petty,
    setTransactions, setBudgets, setAccounts, setPlan, setGoals, setEmg, setDebts, setPetty,
  });
  const NAV = [['dashboard', '📊', 'Home'], ['transaksi', '🧾', 'Catat'], ['akun', '💳', 'Kas'], ['petty', '🏢', 'Petty'], ['utang', '🤝', 'Utang'], ['budget', '🎯', 'Budget'], ['rencana', '🏦', 'Rencana'], ['laporan', '📁', 'File']];

  const tx = transactions ?? [];
  const bd = budgets ?? [];
  const acc = useMemo(() => (accounts ?? []).map((a) => ({ titipan: false, pemilik: '', ...a })), [accounts]);
  const akunMap = useMemo(() => Object.fromEntries(acc.map((a) => [a.id, a.nama])), [acc]);
  const akunLabel = (a) => (a?.pemilik ? `${a.nama} — ${a.pemilik}` : (a?.nama || 'Tanpa Akun'));
  const daftarPemilik = useMemo(() => [...new Set(acc.filter((a) => a.titipan && (a.pemilik || '').trim()).map((a) => a.pemilik.trim()))].sort(), [acc]);
  const saldoMap = useMemo(() => hitungSaldoAkun(acc, tx), [acc, tx]);
  const accPribadi = useMemo(() => acc.filter((a) => !a.titipan), [acc]);
  const accTitipan = useMemo(() => acc.filter((a) => a.titipan), [acc]);
  const totalSaldo = useMemo(() => accPribadi.reduce((s, a) => s + (saldoMap[a.id] || 0), 0), [accPribadi, saldoMap]);
  const totalTitipan = useMemo(() => accTitipan.reduce((s, a) => s + (saldoMap[a.id] || 0), 0), [accTitipan, saldoMap]);
  const debtList = debts ?? [];
  const sisaDebt = (d) => Math.max(0, Number(d.jumlah) - Number(d.terbayar || 0));
  const totalPiutang = debtList.filter((d) => d.tipe === 'piutang').reduce((s, d) => s + sisaDebt(d), 0);
  const totalUtang = debtList.filter((d) => d.tipe === 'utang').reduce((s, d) => s + sisaDebt(d), 0);
  const jatuhDekat = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return debtList.filter((d) => {
      if (sisaDebt(d) <= 0 || !d.jatuhTempo) return false;
      const diff = (new Date(d.jatuhTempo) - now) / 86400000;
      return diff <= 7;
    });
  }, [debts]);

  const [form, setForm] = useState({ tipe: 'pengeluaran', kategori: 'Makan & Minum', jumlah: '', tanggal: new Date().toISOString().slice(0, 10), catatan: '', akunId: '', akunTujuan: '' });
  const [budgetForm, setBudgetForm] = useState({ kategori: 'Makan & Minum', limit: '' });
  const [goalForm, setGoalForm] = useState({ nama: '', target: '', terkumpul: '', deadline: '' });
  const [akunForm, setAkunForm] = useState({ nama: '', jenis: 'bank', saldoAwal: '', titipan: false, pemilik: '' });
  const [editAkunId, setEditAkunId] = useState(null);
  const [akunSesuai, setAkunSesuai] = useState(null); // { id, nominal }
  const [debtForm, setDebtForm] = useState({ tipe: 'piutang', nama: '', jumlah: '', tanggal: new Date().toISOString().slice(0, 10), jatuhTempo: '', catatan: '', akunId: '' });
  const [editDebtId, setEditDebtId] = useState(null);
  const [detailDebtId, setDetailDebtId] = useState(null);
  const [debtAct, setDebtAct] = useState(null); // { id, mode: 'tambah' | 'bayar' }
  const [debtActForm, setDebtActForm] = useState({ jumlah: '', akunId: '', tanggal: new Date().toISOString().slice(0, 10), catatan: '' });
  const [filterAkun, setFilterAkun] = useState('semua');
  const [transferForm, setTransferForm] = useState({ dari: '', ke: '', jumlah: '', tanggal: new Date().toISOString().slice(0, 10), catatan: '' });

  // ---- petty cash (terintegrasi akun titipan) ----
  // p = { id, tanggal, keterangan, jumlah, tipe: 'expense'|'advance', akunId, tanpaNota, photos: [], txId }
  const pettyList = petty ?? [];
  const [pettyForm, setPettyForm] = useState({ tipe: 'expense', tanggal: new Date().toISOString().slice(0, 10), keterangan: '', jumlah: '', akunId: '', tanpaNota: false });
  const [pettyPhotos, setPettyPhotos] = useState([]); // dataURL preview sebelum simpan
  const [pettyBusy, setPettyBusy] = useState(false);
  const [editPettyId, setEditPettyId] = useState(null);
  const [pettyAkun, setPettyAkun] = useState(''); // filter akun rekap
  const [pettyPemilik, setPettyPemilik] = useState(''); // filter pemilik / orang
  const [pettyMode, setPettyMode] = useState('bulan'); // 'bulan' | 'rentang'
  const [pettyDari, setPettyDari] = useState(new Date().toISOString().slice(0, 10));
  const [pettySampai, setPettySampai] = useState(new Date().toISOString().slice(0, 10));
  const [pettyCari, setPettyCari] = useState('');
  const [pettyLightbox, setPettyLightbox] = useState(null); // dataURL foto diperbesar
  const [pettyTarik, setPettyTarik] = useState({ dari: '', ke: '', jumlah: '', tanggal: new Date().toISOString().slice(0, 10) });

  // Form petty default ke filter akun, kalau "semua" pakai titipan pertama.
  // Filter rekap: pemilik + akun. '' = semua.
  // Aturan: kalau pilih pemilik, akun otomatis dibatasi ke akun milik orang itu.
  const accTitipanFiltered = pettyPemilik ? accTitipan.filter((a) => (a.pemilik || '').trim() === pettyPemilik) : accTitipan;
  const pettyFormAkunDefault = pettyForm.akunId || pettyAkun || accTitipanFiltered[0]?.id || accTitipan[0]?.id || '';
  const pettyFiltered = useMemo(() => {
    let list = pettyList.filter((p) => accTitipan.some((a) => a.id === p.akunId) || !p.akunId);
    if (pettyPemilik) {
      const ids = new Set(accTitipan.filter((a) => (a.pemilik || '').trim() === pettyPemilik).map((a) => a.id));
      list = list.filter((p) => ids.has(p.akunId));
    }
    if (pettyAkun) list = list.filter((p) => p.akunId === pettyAkun);
    if (pettyMode === 'bulan') list = list.filter((p) => (p.tanggal || '').startsWith(bulan));
    else if (pettyDari && pettySampai) list = list.filter((p) => (p.tanggal || '') >= pettyDari && (p.tanggal || '') <= pettySampai);
    if (pettyCari) list = list.filter((p) => ((p.keterangan || '') + (p.tanggal || '')).toLowerCase().includes(pettyCari.toLowerCase()));
    return [...list].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  }, [pettyList, pettyPemilik, pettyAkun, accTitipan, pettyMode, bulan, pettyDari, pettySampai, pettyCari]);
  const pettyRekap = useMemo(() => rekapPetty(pettyFiltered), [pettyFiltered]);
  const pettyGroups = useMemo(() => groupByTanggal(pettyFiltered), [pettyFiltered]);
  const pettyPeriodeLabel = pettyMode === 'bulan' ? namaBulan(bulan) : `${pettyDari} s/d ${pettySampai}`;
  const pettyAkunScope = pettyAkun ? accTitipan.filter((a) => a.id === pettyAkun) : accTitipanFiltered;
  const pettySaldoTampil = pettyAkunScope.reduce((s, a) => s + (saldoMap[a.id] || 0), 0);
  const pettyAkunNamaTampil = `${pettyPemilik ? `Pemilik: ${pettyPemilik}` : 'Semua pemilik'} • ${pettyAkun ? akunLabel(acc.find((a) => a.id === pettyAkun)) : (pettyAkunScope.length > 1 ? `Semua titipan (${pettyAkunScope.length} akun)` : akunLabel(pettyAkunScope[0]))}`;

  // Tarik tunai / pindah kas antar akun titipan (misal BCA titipan → Tunai titipan).
  // Ini transfer biasa, TIDAK dihitung sebagai pengeluaran — uangnya cuma pindah tempat.
  const simpanTarikTunai = (e) => {
    e.preventDefault();
    const dari = pettyTarik.dari || accTitipan[0]?.id || '';
    const ke = pettyTarik.ke || '';
    const jumlah = Number(pettyTarik.jumlah);
    if (!dari || !ke || dari === ke) return alert('Pilih akun asal & tujuan yang berbeda');
    if (!jumlah || jumlah <= 0) return alert('Nominal tarik tunai harus > 0');
    const saldoDari = saldoMap[dari] || 0;
    if (jumlah > saldoDari && !confirm(`Saldo ${akunMap[dari]} tinggal ${rupiah(saldoDari)}, mau tarik ${rupiah(jumlah)} tetap?`)) return;
    setTransactions([{ id: uid(), tipe: 'transfer', kategori: 'Transfer', jumlah, tanggal: pettyTarik.tanggal, akunId: dari, akunTujuan: ke, catatan: `[Petty] Tarik tunai ${akunMap[dari]} → ${akunMap[ke]}` }, ...tx]);
    setPettyTarik({ dari: '', ke: '', jumlah: '', tanggal: new Date().toISOString().slice(0, 10) });
  };

  const onPettyFoto = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 3 - pettyPhotos.length);
    if (files.length === 0) return;
    setPettyBusy(true);
    try {
      const compressed = [];
      for (const f of files) compressed.push(await compressImageFile(f));
      setPettyPhotos((prev) => [...prev, ...compressed].slice(0, 3));
    } catch { alert('Gagal membaca foto. Coba foto lain.'); }
    finally { setPettyBusy(false); e.target.value = ''; }
  };

  const resetPettyForm = () => {
    setPettyForm({ tipe: 'expense', tanggal: new Date().toISOString().slice(0, 10), keterangan: '', jumlah: '', akunId: pettyAkun || accTitipan[0]?.id || '', tanpaNota: false });
    setPettyPhotos([]);
    setEditPettyId(null);
  };

  // Simpan petty + catat otomatis ke transaksi akun titipan (pengeluaran / pemasukan advance)
  const simpanPetty = (e) => {
    e.preventDefault();
    const akunId = pettyForm.akunId || pettyAkun || accTitipan[0]?.id || '';
    if (!akunId) return alert('Buat / pilih akun titipan dulu di tab Akun (centang 🏢 titipan)');
    if (!pettyForm.tanggal || !pettyForm.jumlah || Number(pettyForm.jumlah) <= 0) return alert('Tanggal & nominal (>0) wajib diisi');
    if (!pettyForm.keterangan.trim()) return alert('Keterangan wajib diisi (cth: beli ATK / amplop pak RT)');
    const isAdvance = pettyForm.tipe === 'advance';
    const jumlah = Number(pettyForm.jumlah);
    if (editPettyId) {
      const lama = pettyList.find((p) => p.id === editPettyId);
      setPetty(pettyList.map((p) => (p.id === editPettyId
        ? { ...p, tanggal: pettyForm.tanggal, keterangan: pettyForm.keterangan.trim(), jumlah, tipe: pettyForm.tipe, akunId, tanpaNota: !!pettyForm.tanpaNota && !isAdvance, photos: pettyPhotos }
        : p)));
      // sinkronkan transaksi titipan yang tertaut
      if (lama?.txId) {
        setTransactions(tx.map((t) => (t.id === lama.txId
          ? { ...t, tipe: isAdvance ? 'pemasukan' : 'pengeluaran', jumlah, tanggal: pettyForm.tanggal, akunId, kategori: 'Lainnya', catatan: `${isAdvance ? '[Petty] Cash advance' : '[Petty] ' + pettyForm.keterangan.trim()}${!isAdvance && pettyForm.tanpaNota ? ' (tanpa nota)' : ''}` }
          : t)));
      }
      resetPettyForm();
      return;
    }
    const id = uid();
    const txId = uid();
    const entry = { id, tanggal: pettyForm.tanggal, keterangan: pettyForm.keterangan.trim(), jumlah, tipe: pettyForm.tipe, akunId, tanpaNota: !!pettyForm.tanpaNota && !isAdvance, photos: pettyPhotos, txId };
    setPetty([entry, ...pettyList]);
    setTransactions([{
      id: txId, tipe: isAdvance ? 'pemasukan' : 'pengeluaran', kategori: 'Lainnya', jumlah,
      tanggal: pettyForm.tanggal, akunId, pettyId: id,
      catatan: `${isAdvance ? '[Petty] Cash advance — ' + pettyForm.keterangan.trim() : '[Petty] ' + pettyForm.keterangan.trim()}${!isAdvance && pettyForm.tanpaNota ? ' (tanpa nota)' : ''}`,
    }, ...tx]);
    resetPettyForm();
  };

  const mulaiEditPetty = (p) => {
    setEditPettyId(p.id);
    setPettyForm({ tipe: p.tipe || 'expense', tanggal: p.tanggal, keterangan: p.keterangan || '', jumlah: p.jumlah, akunId: p.akunId, tanpaNota: !!p.tanpaNota });
    setPettyPhotos(p.photos || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hapusPetty = (p) => {
    if (!confirm(`Hapus "${p.keterangan}" (${rupiah(p.jumlah)})? Transaksi titipan tertaut ikut terhapus.`)) return;
    setPetty(pettyList.filter((x) => x.id !== p.id));
    if (p.txId) setTransactions(tx.filter((t) => t.id !== p.txId));
  };

  const downloadPettyDocx = async () => {
    if (pettyFiltered.length === 0) return alert('Tidak ada data petty cash pada periode ini');
    try {
      await exportPettyDocx({
        items: pettyFiltered,
        akunNama: pettyAkunNamaTampil,
        periodeLabel: periodeLabelPetty(pettyMode, bulan, pettyDari, pettySampai),
        saldoAkun: pettySaldoTampil,
      });
    } catch { alert('Gagal membuat DOCX. Coba lagi (kemungkinan foto terlalu besar).'); }
  };

  useEffect(() => {
    setForm((f) => ({
      ...f,
      kategori: f.tipe === 'transfer' ? 'Transfer' : KATEGORI[f.tipe]?.[0] || 'Lainnya',
      ...(acc[0] && !f.akunId ? { akunId: acc[0].id } : {}),
    }));
    // eslint-disable-next-line
  }, [form.tipe, accounts]);

  useEffect(() => {
    if (acc.length > 0) {
      setDebtForm((f) => (f.akunId ? f : { ...f, akunId: acc[0].id }));
    }
    // eslint-disable-next-line
  }, [accounts]);

  // ---- agregasi ----
  const txBulan = useMemo(() => tx.filter((t) => (t.tanggal || '').startsWith(bulan)), [tx, bulan]);
  const totalMasuk = txBulan.filter((t) => t.tipe === 'pemasukan').reduce((s, t) => s + Number(t.jumlah), 0);
  const totalKeluar = txBulan.filter((t) => t.tipe === 'pengeluaran').reduce((s, t) => s + Number(t.jumlah), 0);
  const totalInvest = txBulan.filter((t) => t.tipe === 'investasi').reduce((s, t) => s + Number(t.jumlah), 0);
  const sisaKas = totalMasuk - totalKeluar - totalInvest;
  const savingsRate = totalMasuk > 0 ? Math.round(((totalMasuk - totalKeluar) / totalMasuk) * 100) : 0;

  const keluarPerKategori = useMemo(() => {
    const m = {};
    txBulan.filter((t) => t.tipe === 'pengeluaran').forEach((t) => { m[t.kategori] = (m[t.kategori] || 0) + Number(t.jumlah); });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txBulan]);

  const investPerKategori = useMemo(() => {
    const m = {};
    txBulan.filter((t) => t.tipe === 'investasi').forEach((t) => { m[t.kategori] = (m[t.kategori] || 0) + Number(t.jumlah); });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [txBulan]);

  const arus6 = useMemo(() => {
    const [y, m] = bulan.split('-').map(Number);
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const list = tx.filter((t) => (t.tanggal || '').startsWith(key));
      arr.push({
        bulan: d.toLocaleDateString('id-ID', { month: 'short' }),
        Pemasukan: list.filter((t) => t.tipe === 'pemasukan').reduce((s, t) => s + Number(t.jumlah), 0),
        Pengeluaran: list.filter((t) => t.tipe === 'pengeluaran').reduce((s, t) => s + Number(t.jumlah), 0),
        Investasi: list.filter((t) => t.tipe === 'investasi').reduce((s, t) => s + Number(t.jumlah), 0),
      });
    }
    return arr;
  }, [tx, bulan]);

  // rata-rata pengeluaran 3 bulan terakhir (fallback pengeluaran wajib)
  const avgKeluar3 = useMemo(() => {
    const [y, m] = bulan.split('-').map(Number);
    let sum = 0;
    for (let i = 0; i < 3; i++) {
      const d = new Date(y, m - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      sum += tx.filter((t) => (t.tanggal || '').startsWith(key) && t.tipe === 'pengeluaran').reduce((s, t) => s + Number(t.jumlah), 0);
    }
    return Math.round(sum / 3);
  }, [tx, bulan]);

  // ---- rekomendasi gaji ----
  const rek = useMemo(() => rekomendasiAlokasi(plan.gaji, plan.status), [plan.gaji, plan.status]);
  // alokasi efektif: custom (bisa disesuaikan) atau rekomendasi
  const alokasi = plan.custom || rek;
  const gaji = Number(plan.gaji) || 0;
  const nom = (p) => Math.round((gaji * (Number(p) || 0)) / 100);

  const wajibEfektif = Number(plan.wajib) > 0 ? Number(plan.wajib) : avgKeluar3;
  const daruratInfo = useMemo(() => targetDarurat(wajibEfektif, plan.status), [wajibEfektif, plan.status]);
  const daruratTarget = emg.targetManual ? Number(emg.targetManual) : daruratInfo.target;
  const daruratPersen = daruratTarget > 0 ? Math.min(100, (Number(emg.terkumpul) / daruratTarget) * 100) : 0;
  const cicilDarurat = alokasi ? nom(alokasi.pDarurat) : 0;
  const estimasiDarurat = cicilDarurat > 0 && daruratTarget > emg.terkumpul
    ? Math.ceil((daruratTarget - emg.terkumpul) / cicilDarurat) : 0;

  const totalGoalsTarget = goals.reduce((s, g) => s + Number(g.target), 0);
  const totalGoalsTerkumpul = goals.reduce((s, g) => s + Number(g.terkumpul), 0);

  const terapkanRekomendasiKeBudget = () => {
    if (!alokasi) return alert('Isi gaji dulu');
    const butuhNom = nom(alokasi.pButuh);
    const inginNom = nom(alokasi.pIngin);
    // bobot default -> kategori
    const mapping = [
      ['Makan & Minum', butuhNom * 0.30],
      ['Tagihan & Utilitas', butuhNom * 0.35],
      ['Transport', butuhNom * 0.15],
      ['Belanja', butuhNom * 0.20],
      ['Hiburan', inginNom * 0.50],
      ['Kesehatan', inginNom * 0.20],
      ['Lainnya', inginNom * 0.30],
    ];
    const baru = mapping.map(([kategori, limit]) => {
      const ada = bd.find((b) => b.bulan === bulan && b.kategori === kategori);
      return ada ? { ...ada, limit: Math.round(limit) } : { id: uid(), kategori, limit: Math.round(limit), bulan };
    });
    const lain = bd.filter((b) => !(b.bulan === bulan && mapping.some(([k]) => k === b.kategori)));
    setBudgets([...lain, ...baru]);
    alert('Budget bulan ' + namaBulan(bulan) + ' diisi otomatis dari rekomendasi gaji!');
    setTab('budget');
  };

  // ---- budget status + alert ----
  const budgetStatus = useMemo(() => {
    return bd
      .filter((b) => b.bulan === bulan)
      .map((b) => {
        const terpakai = txBulan
          .filter((t) => t.tipe === 'pengeluaran' && t.kategori === b.kategori)
          .reduce((s, t) => s + Number(t.jumlah), 0);
        const persen = b.limit > 0 ? (terpakai / Number(b.limit)) * 100 : 0;
        let status = 'aman';
        if (persen >= 100) status = 'over';
        else if (persen >= 80) status = 'menipis';
        else if (persen >= 60) status = 'waspada';
        return { ...b, terpakai, persen, status };
      })
      .sort((a, b) => b.persen - a.persen);
  }, [bd, txBulan, bulan]);

  const alerts = budgetStatus.filter((b) => b.status === 'over' || b.status === 'menipis');
  const boros = totalMasuk > 0 && totalKeluar > totalMasuk * 0.8;

  // ---- CRUD transaksi ----
  const simpanTransaksi = (e) => {
    e.preventDefault();
    if (!form.jumlah || Number(form.jumlah) <= 0) return alert('Nominal harus lebih dari 0');
    if (acc.length === 0) return alert('Buat akun kas dulu di tab Akun');
    const akunId = form.akunId || acc[0].id;
    if (form.tipe === 'transfer') {
      if (!form.akunTujuan || form.akunTujuan === akunId) return alert('Pilih akun tujuan yang berbeda');
      const data = { id: editId || uid(), tipe: 'transfer', kategori: 'Transfer', jumlah: Number(form.jumlah), tanggal: form.tanggal, catatan: form.catatan, akunId, akunTujuan: form.akunTujuan };
      if (editId) setTransactions(tx.map((t) => (t.id === editId ? data : t)));
      else setTransactions([data, ...tx]);
    } else {
      const data = { ...form, akunId, jumlah: Number(form.jumlah) };
      delete data.akunTujuan;
      if (editId) setTransactions(tx.map((t) => (t.id === editId ? { ...t, ...data } : t)));
      else setTransactions([{ id: uid(), ...data }, ...tx]);
    }
    setEditId(null);
    setShowForm(false);
    setForm({ tipe: 'pengeluaran', kategori: 'Makan & Minum', jumlah: '', tanggal: new Date().toISOString().slice(0, 10), catatan: '', akunId: acc[0]?.id || '', akunTujuan: '' });
  };

  const hapusTx = (id) => { if (confirm('Hapus transaksi ini?')) setTransactions(tx.filter((t) => t.id !== id)); };
  const mulaiEdit = (t) => {
    setEditId(t.id);
    setForm({ tipe: t.tipe, kategori: t.kategori, jumlah: t.jumlah, tanggal: t.tanggal, catatan: t.catatan || '', akunId: t.akunId || acc[0]?.id || '', akunTujuan: t.akunTujuan || '' });
    setShowForm(true);
  };

  // ---- CRUD akun ----
  const resetAkunForm = () => {
    setAkunForm({ nama: '', jenis: 'bank', saldoAwal: '', titipan: false, pemilik: '' });
    setEditAkunId(null);
  };
  const simpanAkun = (e) => {
    e.preventDefault();
    if (!akunForm.nama.trim()) return alert('Nama akun wajib diisi');
    if (akunForm.titipan && !akunForm.pemilik.trim()) return alert('Untuk akun titipan, isi pemiliknya (cth: Orang 1 / Pak A) supaya tidak kecampur antar orang');
    if (editAkunId) {
      setAccounts(acc.map((a) => (a.id === editAkunId
        ? { ...a, nama: akunForm.nama.trim(), jenis: akunForm.jenis, saldoAwal: Number(akunForm.saldoAwal) || 0, titipan: !!akunForm.titipan, pemilik: akunForm.pemilik.trim() }
        : a)));
      resetAkunForm();
      return;
    }
    setAccounts([...acc, { id: uid(), nama: akunForm.nama.trim(), jenis: akunForm.jenis, saldoAwal: Number(akunForm.saldoAwal) || 0, titipan: !!akunForm.titipan, pemilik: akunForm.pemilik.trim() }]);
    resetAkunForm();
  };
  const mulaiEditAkun = (a) => {
    setEditAkunId(a.id);
    setAkunForm({ nama: a.nama, jenis: a.jenis || 'bank', saldoAwal: a.saldoAwal ?? 0, titipan: !!a.titipan, pemilik: a.pemilik || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // sesuaikan saldo akhir ke nominal sebenarnya (misal cek m-banking beda) → buat transaksi koreksi otomatis
  const simpanSesuaiAkun = (e) => {
    e?.preventDefault();
    if (!akunSesuai) return;
    const a = acc.find((x) => x.id === akunSesuai.id);
    if (!a) return setAkunSesuai(null);
    const target = Number(akunSesuai.nominal);
    if (!Number.isFinite(target) || target < 0) return alert('Nominal harus angka ≥ 0');
    const sekarang = saldoMap[a.id] || 0;
    const selisih = Math.round(target - sekarang);
    if (selisih === 0) return setAkunSesuai(null);
    const tgl = new Date().toISOString().slice(0, 10);
    if (selisih > 0) {
      setTransactions((prev) => [{ id: uid(), tipe: 'pemasukan', kategori: 'Lainnya', jumlah: selisih, tanggal: tgl, catatan: `Koreksi saldo ${a.nama} (+${rupiah(selisih)})`, akunId: a.id }, ...prev]);
    } else {
      setTransactions((prev) => [{ id: uid(), tipe: 'pengeluaran', kategori: 'Lainnya', jumlah: Math.abs(selisih), tanggal: tgl, catatan: `Koreksi saldo ${a.nama} (${rupiah(selisih)})`, akunId: a.id }, ...prev]);
    }
    setAkunSesuai(null);
  };
  const hapusAkun = (id) => {
    const dipakai = tx.some((t) => t.akunId === id || t.akunTujuan === id);
    if (dipakai && !confirm('Akun ini dipakai transaksi. Hapus tetap? Transaksi lama jadi Tanpa Akun.')) return;
    if (!dipakai && !confirm('Hapus akun ini?')) return;
    setAccounts(acc.filter((a) => a.id !== id));
  };
  const toggleTitipan = (id) => setAccounts(acc.map((a) => (a.id === id ? { ...a, titipan: !a.titipan } : a)));
  const simpanTransfer = (e) => {
    e.preventDefault();
    if (!transferForm.dari || !transferForm.ke || transferForm.dari === transferForm.ke) return alert('Pilih akun asal & tujuan yang berbeda');
    if (!transferForm.jumlah || Number(transferForm.jumlah) <= 0) return alert('Nominal harus > 0');
    setTransactions([{ id: uid(), tipe: 'transfer', kategori: 'Transfer', jumlah: Number(transferForm.jumlah), tanggal: transferForm.tanggal, catatan: transferForm.catatan || `Transfer ${akunMap[transferForm.dari]} → ${akunMap[transferForm.ke]}`, akunId: transferForm.dari, akunTujuan: transferForm.ke }, ...tx]);
    setTransferForm({ dari: '', ke: '', jumlah: '', tanggal: new Date().toISOString().slice(0, 10), catatan: '' });
  };

  // ---- CRUD utang/piutang ----
  // riwayat: [{ id, tanggal, aksi: 'awal'|'tambah'|'bayar', jumlah, akunId, catatan }]
  const debtAkunNama = (id) => (id ? (akunMap[id] || 'Akun dihapus') : '—');
  const normalDebt = (d) => ({ riwayat: [], akunId: '', ...d });
  const resetDebtForm = () => {
    setDebtForm({ tipe: 'piutang', nama: '', jumlah: '', tanggal: new Date().toISOString().slice(0, 10), jatuhTempo: '', catatan: '', akunId: accPribadi[0]?.id || '' });
    setEditDebtId(null);
  };
  const catatTxUtang = (d, aksi, nominal, akunId, tanggal, catatan) => {
    if (!akunId) return;
    const namaAkun = akunMap[akunId] || '';
    if (d.tipe === 'piutang') {
      // piutang: awal/tambah = uang keluar (kasih pinjam); bayar = uang masuk (diterima)
      if (aksi === 'bayar') {
        setTransactions((prev) => [{ id: uid(), tipe: 'pemasukan', kategori: 'Lainnya', jumlah: nominal, tanggal, catatan: catatan || `Pelunasan piutang ${d.nama}`, akunId, debtId: d.id }, ...prev]);
      } else {
        setTransactions((prev) => [{ id: uid(), tipe: 'pengeluaran', kategori: 'Lainnya', jumlah: nominal, tanggal, catatan: catatan || `Kasih pinjam ke ${d.nama}`, akunId, debtId: d.id }, ...prev]);
      }
    } else {
      // utang: awal/tambah = uang masuk (terima pinjaman); bayar = uang keluar (bayar)
      if (aksi === 'bayar') {
        setTransactions((prev) => [{ id: uid(), tipe: 'pengeluaran', kategori: 'Lainnya', jumlah: nominal, tanggal, catatan: catatan || `Bayar utang ke ${d.nama}`, akunId, debtId: d.id }, ...prev]);
      } else {
        setTransactions((prev) => [{ id: uid(), tipe: 'pemasukan', kategori: 'Lainnya', jumlah: nominal, tanggal, catatan: catatan || `Pinjam dari ${d.nama}${namaAkun ? ` → ${namaAkun}` : ''}`, akunId, debtId: d.id }, ...prev]);
      }
    }
  };
  const simpanDebt = (e) => {
    e.preventDefault();
    if (!debtForm.nama.trim() || !debtForm.jumlah || Number(debtForm.jumlah) <= 0) return alert('Nama & nominal wajib diisi');
    const jumlahBaru = Number(debtForm.jumlah);
    if (editDebtId) {
      // mode edit: update data existing, jumlah boleh diubah (koreksi manual)
      setDebts(debtList.map((x) => {
        if (x.id !== editDebtId) return x;
        const nx = normalDebt(x);
        const terbayar = Math.min(Number(nx.terbayar || 0), jumlahBaru);
        return { ...nx, tipe: debtForm.tipe, nama: debtForm.nama.trim(), jumlah: jumlahBaru, terbayar, tanggal: debtForm.tanggal, jatuhTempo: debtForm.jatuhTempo, catatan: debtForm.catatan, akunId: debtForm.akunId || nx.akunId || '' };
      }));
      resetDebtForm();
      return;
    }
    const id = uid();
    const akunId = debtForm.akunId || '';
    const entry = { id: uid(), tanggal: debtForm.tanggal, aksi: 'awal', jumlah: jumlahBaru, akunId, catatan: debtForm.catatan || (debtForm.tipe === 'piutang' ? `Pinjaman awal ke ${debtForm.nama.trim()}` : `Pinjaman awal dari ${debtForm.nama.trim()}`) };
    const baru = { id, tipe: debtForm.tipe, nama: debtForm.nama.trim(), jumlah: jumlahBaru, terbayar: 0, tanggal: debtForm.tanggal, jatuhTempo: debtForm.jatuhTempo, catatan: debtForm.catatan, akunId, riwayat: [entry] };
    setDebts([baru, ...debtList]);
    if (akunId) catatTxUtang(baru, 'awal', jumlahBaru, akunId, debtForm.tanggal, debtForm.tipe === 'piutang' ? `Kasih pinjam ke ${baru.nama}${debtForm.catatan ? ` — ${debtForm.catatan}` : ''}` : `Pinjam dari ${baru.nama}${debtForm.catatan ? ` — ${debtForm.catatan}` : ''}`);
    resetDebtForm();
  };
  const mulaiEditDebt = (d) => {
    const nx = normalDebt(d);
    setEditDebtId(nx.id);
    setDebtForm({ tipe: nx.tipe, nama: nx.nama, jumlah: nx.jumlah, tanggal: nx.tanggal || new Date().toISOString().slice(0, 10), jatuhTempo: nx.jatuhTempo || '', catatan: nx.catatan || '', akunId: nx.akunId || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const bukaDebtAct = (d, mode) => {
    const nx = normalDebt(d);
    setDebtAct({ id: nx.id, mode });
    setDebtActForm({ jumlah: '', akunId: nx.akunId || accPribadi[0]?.id || acc[0]?.id || '', tanggal: new Date().toISOString().slice(0, 10), catatan: '' });
  };
  const simpanDebtAct = (e) => {
    e?.preventDefault();
    if (!debtAct) return;
    const d = normalDebt(debtList.find((x) => x.id === debtAct.id));
    if (!d.id) return setDebtAct(null);
    const nominal = Number(debtActForm.jumlah);
    if (!nominal || nominal <= 0) return alert('Nominal harus lebih dari 0');
    if (!debtActForm.akunId) return alert('Pilih akun kas dulu');
    if (debtAct.mode === 'tambah') {
      // orang yang sama ngutang lagi — tambah ke total yang sama
      const entry = { id: uid(), tanggal: debtActForm.tanggal, aksi: 'tambah', jumlah: nominal, akunId: debtActForm.akunId, catatan: debtActForm.catatan || 'Tambahan pinjaman' };
      setDebts(debtList.map((x) => {
        if (x.id !== d.id) return x;
        const nx = normalDebt(x);
        return { ...nx, jumlah: Number(nx.jumlah) + nominal, akunId: nx.akunId || debtActForm.akunId, riwayat: [...(nx.riwayat || []), entry] };
      }));
      catatTxUtang(d, 'tambah', nominal, debtActForm.akunId, debtActForm.tanggal, debtActForm.catatan ? `${debtAct.mode === 'tambah' && d.tipe === 'piutang' ? `Nambah pinjam ke ${d.nama} — ${debtActForm.catatan}` : `Nambah pinjam dari ${d.nama} — ${debtActForm.catatan}`}` : (d.tipe === 'piutang' ? `Nambah pinjam ke ${d.nama}` : `Nambah pinjam dari ${d.nama}`));
    } else {
      // bayar / terima cicilan
      const sisa = sisaDebt(d);
      if (nominal > sisa) return alert(`Nominal melebihi sisa (${rupiah(sisa)})`);
      const entry = { id: uid(), tanggal: debtActForm.tanggal, aksi: 'bayar', jumlah: nominal, akunId: debtActForm.akunId, catatan: debtActForm.catatan || (d.tipe === 'piutang' ? `Terima bayaran dari ${d.nama}` : `Bayar ke ${d.nama}`) };
      setDebts(debtList.map((x) => {
        if (x.id !== d.id) return x;
        const nx = normalDebt(x);
        return { ...nx, terbayar: Number(nx.terbayar || 0) + nominal, riwayat: [...(nx.riwayat || []), entry] };
      }));
      catatTxUtang(d, 'bayar', nominal, debtActForm.akunId, debtActForm.tanggal, debtActForm.catatan || (d.tipe === 'piutang' ? `Pelunasan piutang ${d.nama}` : `Bayar utang ke ${d.nama}`));
    }
    setDebtAct(null);
  };

  const simpanBudget = (e) => {
    e.preventDefault();
    if (!budgetForm.limit || Number(budgetForm.limit) <= 0) return alert('Limit budget harus > 0');
    const ada = bd.find((b) => b.bulan === bulan && b.kategori === budgetForm.kategori);
    if (ada) setBudgets(bd.map((b) => (b.id === ada.id ? { ...b, limit: Number(budgetForm.limit) } : b)));
    else setBudgets([...bd, { id: uid(), kategori: budgetForm.kategori, limit: Number(budgetForm.limit), bulan }]);
    setBudgetForm({ kategori: 'Makan & Minum', limit: '' });
  };

  const simpanGoal = (e) => {
    e.preventDefault();
    if (!goalForm.nama || !goalForm.target) return alert('Nama & target wajib diisi');
    setGoals([{ id: uid(), nama: goalForm.nama, target: Number(goalForm.target), terkumpul: Number(goalForm.terkumpul) || 0, deadline: goalForm.deadline }, ...goals]);
    setGoalForm({ nama: '', target: '', terkumpul: '', deadline: '' });
  };

  const txTampil = txBulan
    .filter((t) => (filterTipe === 'semua' ? true : t.tipe === filterTipe))
    .filter((t) => (filterAkun === 'semua' ? true : t.akunId === filterAkun || t.akunTujuan === filterAkun))
    .filter((t) => ((t.catatan || '') + (t.kategori || '') + (akunMap[t.akunId] || '')).toLowerCase().includes(cari.toLowerCase()))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const exportJSON = () => download(`keuangan-${bulan}.json`, JSON.stringify({ transactions: tx, budgets: bd, accounts: acc, debts: debtList, petty: petty ?? [], plan, goals, emergency: emg }, null, 2));
  const exportCSV = () => download(`keuangan-${bulan}.csv`, toCSV(tx, akunMap), 'text/csv');
  const importJSON = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d.transactions) setTransactions(d.transactions);
        if (d.budgets) setBudgets(d.budgets);
        if (d.accounts) setAccounts(d.accounts);
        if (d.plan) setPlan(d.plan);
        if (d.goals) setGoals(d.goals);
        if (d.emergency) setEmg(d.emergency);
        if (d.debts) setDebts(d.debts);
        if (d.petty) setPetty(d.petty);
        alert('Import berhasil!');
      } catch { alert('File tidak valid'); }
    };
    r.readAsText(f);
  };

  const bulanOptions = useMemo(() => {
    const set = new Set([bulanKey(), bulan, ...tx.map((t) => (t.tanggal || '').slice(0, 7)), ...bd.map((b) => b.bulan)]);
    return [...set].filter(Boolean).sort().reverse();
  }, [tx, bd, bulan]);

  const judul = { dashboard: 'Ringkasan Keuangan', transaksi: 'Catat Transaksi', budget: 'Budgeting Bulanan', akun: 'Akun & Kas', petty: 'Petty Cash & Laporan', utang: 'Utang, Piutang & Titipan', rencana: 'Rencana, Tabungan & Dana Darurat', laporan: 'Laporan & Export' }[tab];

  if (transactions === null || accounts === null) return <div className="loading">Memuat...</div>;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo-row">
          <img className="brand-logo" src="logo-sidebar.png" alt="Logo Flowra" />
          <div className="brand-text">
            <span className="brand-name">Flowra</span>
            <span className="brand-tagline">Every Flow, Accounted For</span>
          </div>
        </div>
        <div className={`sync-box ${sync.user ? 'on' : ''}`}>
          {sync.cloudEnabled ? (
            sync.user ? (
              <>
                <small>☁️ {sync.user.email}</small>
                <small className="dim">{sync.cloudStatus}{sync.lastSync ? ` • ${sync.lastSync.toLocaleTimeString('id-ID')}` : ''}</small>
                <div className="btnrow">
                  <button className="btn ghost sm" onClick={sync.pushNow}>↻ Sync</button>
                  <button className="btn ghost sm" onClick={() => sync.logoutGoogle()}>Keluar</button>
                </div>
              </>
            ) : (
              <>
                <small>📱 Mau data sama di HP?</small>
                <button className="btn primary sm" onClick={() => sync.loginGoogle().catch((e) => alert(e.code + '\n' + e.message))}>Login Google untuk Sync</button>
                <small className="dim">Login akun yg sama di laptop & HP → {sync.cloudStatus}</small>
                {sync.authError && <small className="warn-text">⚠️ {sync.authError}</small>}
              </>
            )
          ) : (
            <>
              <small>💾 Mode lokal (HP beda data)</small>
              <small className="dim">Isi Firebase .env + deploy untuk sync otomatis. Sementara pakai Export/Import JSON di tab File.</small>
            </>
          )}
        </div>
        <nav>
          {[['dashboard', '📊 Dashboard'], ['transaksi', '🧾 Transaksi'], ['akun', '💳 Akun & Kas'], ['petty', '🏢 Petty Cash'], ['utang', '🤝 Utang & Titipan'], ['budget', '🎯 Budgeting'], ['rencana', '🏦 Rencana & Tabungan'], ['laporan', '📁 Laporan & File']].map(([k, label]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </nav>
        <div className="side-foot">
          <label>Tampilan</label>
          <div className="theme-row">
            <button className="theme-pill" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}>
              {theme === 'dark' ? '☀️ Terang' : '🌙 Gelap'}
            </button>
          </div>
          <label>Periode</label>
          <select value={bulan} onChange={(e) => setBulan(e.target.value)}>
            {bulanOptions.map((b) => <option key={b} value={b}>{namaBulan(b)}</option>)}
          </select>
          <input type="month" value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
          <div className="mini-darurat">
            <small>💰 Kas pribadi: {rupiah(totalSaldo)}</small>
            {totalTitipan > 0 && <small className="warn-text">🏢 Titipan (bukan milikmu): {rupiah(totalTitipan)}</small>}
            {accPribadi.slice(0, 3).map((a) => (
              <small key={a.id} className="dim">{a.nama}: {rupiah(saldoMap[a.id] || 0)}</small>
            ))}
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>{judul}</h1>
            <p className="muted">{namaBulan(bulan)} • {txBulan.length} transaksi</p>
          </div>
          <div className="top-actions">
            <button className="btn ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}>{theme === 'dark' ? '☀️ Terang' : '🌙 Gelap'}</button>
            <button className="btn ghost" onClick={exportCSV}>⬇ CSV</button>
            <button className="btn ghost" onClick={exportJSON}>⬇ JSON</button>
            <button className="btn primary" onClick={() => { setShowForm(true); setEditId(null); }}>+ Tambah</button>
          </div>
        </header>

        {(alerts.length > 0 || boros || sisaKas < 0 || jatuhDekat.length > 0) && (
          <div className="alerts">
            {jatuhDekat.map((d) => (
              <div key={d.id} className="alert danger">⏰ <b>{d.tipe === 'piutang' ? 'Tagih' : 'Bayar'} {d.nama}!</b> Sisa {rupiah(sisaDebt(d))} • jatuh tempo {d.jatuhTempo || 'tidak ditentukan'} (≤7 hari). <button className="link" onClick={() => setTab('utang')}>Kelola →</button></div>
            ))}
            {alerts.filter((a) => a.status === 'over').map((a) => (
              <div key={a.id} className="alert danger">🚨 <b>Over budget {a.kategori}!</b> Terpakai {rupiah(a.terpakai)} dari {rupiah(a.limit)} ({Math.round(a.persen)}%).</div>
            ))}
            {alerts.filter((a) => a.status === 'menipis').map((a) => (
              <div key={a.id} className="alert warn">⚠️ <b>Budget {a.kategori} menipis.</b> {Math.round(a.persen)}% terpakai. Sisa {rupiah(a.limit - a.terpakai)}.</div>
            ))}
            {boros && <div className="alert warn">💸 Pengeluaran {Math.round((totalKeluar / Math.max(totalMasuk, 1)) * 100)}% dari pemasukan. Ideal ≤ 70%.</div>}
            {sisaKas < 0 && <div className="alert danger">🛑 <b>Arus kas minus {rupiah(sisaKas)}!</b> Tekan belanja non-esensial.</div>}
            {daruratTarget > 0 && daruratPersen < 100 && (
              <div className="alert info">🛟 Dana darurat baru {Math.round(daruratPersen)}% ({rupiah(emg.terkumpul)} / {rupiah(daruratTarget)}). {estimasiDarurat > 0 ? `Lunas ± ${estimasiDarurat} bulan dengan cicilan ${rupiah(cicilDarurat)}/bln.` : ''}</div>
            )}
          </div>
        )}

        {tab === 'dashboard' && (
          <>
            <div className="cards">
              <div className="card in"><span>Pemasukan</span><b>{rupiah(totalMasuk)}</b></div>
              <div className="card out"><span>Pengeluaran</span><b>{rupiah(totalKeluar)}</b></div>
              <div className="card inv"><span>Investasi</span><b>{rupiah(totalInvest)}</b></div>
              <div className={`card sisa ${sisaKas < 0 ? 'neg' : ''}`}><span>💰 Kas Pribadi (di luar titipan)</span><b>{rupiah(totalSaldo)}</b><small>Bulan ini {rupiah(sisaKas)} • Titipan {rupiah(totalTitipan)} terpisah</small></div>
            </div>
            <div className="cards two">
              <div className="card"><span>🤝 Piutang (orang hutang ke kamu)</span><b className="plus">{rupiah(totalPiutang)}</b><small>{debtList.filter((d) => d.tipe === 'piutang' && sisaDebt(d) > 0).length} aktif • <button className="link" onClick={() => setTab('utang')}>Tagih →</button></small></div>
              <div className="card"><span>💳 Utang (kamu hutang)</span><b className="minus">{rupiah(totalUtang)}</b><small>{debtList.filter((d) => d.tipe === 'utang' && sisaDebt(d) > 0).length} aktif • <button className="link" onClick={() => setTab('utang')}>Bayar →</button></small></div>
            </div>
            <div className="cards two">
              <div className="card"><span>🛟 Dana Darurat</span><b>{rupiah(Number(emg.terkumpul))} / {rupiah(daruratTarget)}</b><div className="bar"><div className="fill" style={{ width: `${daruratPersen}%` }} /></div><small>{Math.round(daruratPersen)}% • Target {daruratInfo.range} pengeluaran • <button className="link" onClick={() => setTab('rencana')}>Kelola →</button></small></div>
              <div className="card"><span>🏦 Total Tabungan Goals</span><b>{rupiah(totalGoalsTerkumpul)} / {rupiah(totalGoalsTarget)}</b><div className="bar"><div className="fill" style={{ width: `${totalGoalsTarget ? Math.min(100, (totalGoalsTerkumpul / totalGoalsTarget) * 100) : 0}%` }} /></div><small>{goals.length} target • <button className="link" onClick={() => setTab('rencana')}>Kelola →</button></small></div>
            </div>

            <div className="grid2">
              <div className="panel">
                <h3>Pengeluaran per Kategori</h3>
                {keluarPerKategori.length === 0 ? <p className="muted">Belum ada pengeluaran bulan ini.</p> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={keluarPerKategori} dataKey="value" nameKey="name" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {keluarPerKategori.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => rupiah(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="panel">
                <h3>Arus Kas 6 Bulan</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={arus6}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bulan" />
                    <YAxis tickFormatter={(v) => (v >= 1000000 ? `${v / 1000000}jt` : `${v / 1000}rb`)} />
                    <Tooltip formatter={(v) => rupiah(v)} />
                    <Legend />
                    <Bar dataKey="Pemasukan" fill="#0E7A3D" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Pengeluaran" fill="#C81E1E" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Investasi" fill="#172B4D" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {tab === 'transaksi' && (
          <div className="panel">
            <div className="toolbar">
              <div className="seg">
                {['semua', 'pemasukan', 'pengeluaran', 'investasi', 'transfer'].map((t) => (
                  <button key={t} className={filterTipe === t ? 'active' : ''} onClick={() => setFilterTipe(t)}>{t}</button>
                ))}
              </div>
              <select value={filterAkun} onChange={(e) => setFilterAkun(e.target.value)}>
                <option value="semua">Semua akun</option>
                {acc.map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
              </select>
              <input placeholder="🔍 Cari kategori / catatan / akun..." value={cari} onChange={(e) => setCari(e.target.value)} />
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Akun</th><th>Catatan</th><th style={{ textAlign: 'right' }}>Jumlah</th><th></th></tr></thead>
                <tbody>
                  {txTampil.map((t) => (
                    <tr key={t.id}>
                      <td>{t.tanggal}</td>
                      <td><span className={`badge ${t.tipe}`}>{t.tipe}</span></td>
                      <td>{t.kategori}</td>
                      <td className="muted">{t.tipe === 'transfer' ? `${akunMap[t.akunId] || '?'} → ${akunMap[t.akunTujuan] || '?'}` : (akunMap[t.akunId] || 'Tanpa Akun')}</td>
                      <td className="muted">{t.catatan}</td>
                      <td style={{ textAlign: 'right' }} className={t.tipe === 'pemasukan' ? 'plus' : t.tipe === 'transfer' ? '' : 'minus'}>{t.tipe === 'pemasukan' ? '+' : t.tipe === 'transfer' ? '⇄' : '−'}{rupiah(t.jumlah)}</td>
                      <td><button className="iconbtn" onClick={() => mulaiEdit(t)}>✏️</button><button className="iconbtn" onClick={() => hapusTx(t.id)}>🗑️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {txTampil.length === 0 && <p className="muted center">Tidak ada transaksi.</p>}
            </div>
          </div>
        )}

        {tab === 'akun' && (
          <>
            <div className="panel">
              <h3>{editAkunId ? '✏️ Edit Akun Kas' : '➕ Tambah Akun Kas — Bank / E-Wallet / Tunai / Titipan Kantor'}</h3>
              <form className="inline-form" onSubmit={simpanAkun}>
                <input placeholder="Nama akun (cth: BCA, Muamalat, GoPay, Kas Kantor)" value={akunForm.nama} onChange={(e) => setAkunForm({ ...akunForm, nama: e.target.value })} />
                <select value={akunForm.jenis} onChange={(e) => setAkunForm({ ...akunForm, jenis: e.target.value })}>
                  {Object.entries(JENIS_AKUN).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input type="number" placeholder="Saldo awal (Rp)" value={akunForm.saldoAwal} onChange={(e) => setAkunForm({ ...akunForm, saldoAwal: e.target.value })} title="Saldo awal — bisa diubah kapan aja via Edit" />
                <label className="check"><input type="checkbox" checked={!!akunForm.titipan} onChange={(e) => setAkunForm({ ...akunForm, titipan: e.target.checked })} /> 🏢 Uang titipan (petty cash kantor, bukan milikku)</label>
                {akunForm.titipan && (
                  <input placeholder="Pemilik (cth: Orang 1 / Pak A) — wajib" value={akunForm.pemilik} onChange={(e) => setAkunForm({ ...akunForm, pemilik: e.target.value })} list="pemilik-list" />
                )}
                <button className="btn primary" type="submit">{editAkunId ? 'Simpan Perubahan' : 'Simpan Akun'}</button>
                {editAkunId && <button className="btn ghost" type="button" onClick={resetAkunForm}>Batal</button>}
              </form>
              <datalist id="pemilik-list">{daftarPemilik.map((p) => <option key={p} value={p} />)}</datalist>
              <small className="muted">Centang <b>titipan</b> untuk petty cash kantor — saldonya TIDAK dihitung ke kas pribadimu, jadi tidak kecampur. Kalau 1 rekening dipakai 2 orang, buat 2 akun terpisah (cth: “Mandiri — Orang 2” + “Mandiri — Orang 3”). Saldo berjalan = saldo awal + semua transaksi. Mau benerin saldo akhir (misal beda sama m-banking)? Pakai tombol <b>🎯 Sesuaikan</b> di tiap kartu.</small>
            </div>
            <div className="panel total-kas">
              <h3>💰 Kas Pribadi: {rupiah(totalSaldo)} {totalTitipan > 0 && <span className="titipan-pill">🏢 Titipan: {rupiah(totalTitipan)} (terpisah)</span>}</h3>
              <p className="muted">{accPribadi.length} akun pribadi • {accTitipan.length} akun titipan • transfer antar akun tidak mengubah total.</p>
            </div>
            <h3 className="section-h">Akun Pribadi</h3>
            <div className="budget-grid">
              {accPribadi.map((a) => {
                const saldo = saldoMap[a.id] || 0;
                const masuk = tx.filter((t) => t.tipe === 'pemasukan' && t.akunId === a.id).reduce((s, t) => s + Number(t.jumlah), 0);
                const keluar = tx.filter((t) => (t.tipe === 'pengeluaran' || t.tipe === 'investasi') && t.akunId === a.id).reduce((s, t) => s + Number(t.jumlah), 0);
                return (
                  <div key={a.id} className="bcard">
                    <div className="bcard-top"><b>{JENIS_AKUN[a.jenis]?.emoji || '💰'} {a.nama}</b><span className="badge aman">{JENIS_AKUN[a.jenis]?.label || a.jenis}</span></div>
                    <div className="akun-saldo">{rupiah(saldo)}</div>
                    <small className="muted">Masuk {rupiah(masuk)} • Keluar {rupiah(keluar)} • Awal {rupiah(a.saldoAwal)}</small>
                    <div className="btnrow">
                      <button className="btn ghost sm" onClick={() => { setForm({ tipe: 'pemasukan', kategori: 'Gaji', jumlah: '', tanggal: new Date().toISOString().slice(0, 10), catatan: '', akunId: a.id, akunTujuan: '' }); setEditId(null); setShowForm(true); }}>+ Catat ke sini</button>
                      <button className="btn ghost sm" onClick={() => mulaiEditAkun(a)} title="Ubah nama / jenis / saldo awal">✏️ Edit</button>
                      <button className="btn ghost sm" onClick={() => setAkunSesuai({ id: a.id, nominal: saldo })} title="Set saldo akhir ke angka sebenarnya — selisihnya otomatis jadi transaksi koreksi">🎯 Sesuaikan</button>
                      <button className="btn ghost sm" onClick={() => toggleTitipan(a.id)}>→ Titipan</button>
                      <button className="btn ghost sm" onClick={() => hapusAkun(a.id)}>Hapus</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {accPribadi.length === 0 && <p className="muted">Belum ada akun pribadi.</p>}
            {accTitipan.length > 0 && (
              <>
                <h3 className="section-h">🏢 Akun Titipan / Petty Cash (bukan uangmu — tidak masuk total pribadi)</h3>
                <div className="budget-grid">
                  {accTitipan.map((a) => {
                    const saldo = saldoMap[a.id] || 0;
                    return (
                      <div key={a.id} className="bcard titipan">
                        <div className="bcard-top"><b>🏢 {a.nama}</b><span className="badge menipis">TITIPAN</span></div>
                        {a.pemilik && <div><span className="badge transfer">👤 {a.pemilik}</span></div>}
                        <div className="akun-saldo">{rupiah(saldo)}</div>
                        <small className="muted">Awal {rupiah(a.saldoAwal)} • pisahkan struk & catat tiap pemakaian di Petty Cash</small>
                        <div className="btnrow">
                          <button className="btn ghost sm" onClick={() => mulaiEditAkun(a)} title="Ubah nama / jenis / saldo awal">✏️ Edit</button>
                          <button className="btn ghost sm" onClick={() => setAkunSesuai({ id: a.id, nominal: saldo })} title="Set saldo akhir ke angka sebenarnya">🎯 Sesuaikan</button>
                          <button className="btn ghost sm" onClick={() => toggleTitipan(a.id)}>→ Pribadi</button>
                          <button className="btn ghost sm" onClick={() => hapusAkun(a.id)}>Hapus</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="panel">
              <h3>🔄 Transfer Antar Akun (misal BCA → GoPay)</h3>
              <form className="inline-form" onSubmit={simpanTransfer}>
                <select value={transferForm.dari} onChange={(e) => setTransferForm({ ...transferForm, dari: e.target.value })} required>
                  <option value="">Dari...</option>
                  {acc.map((a) => <option key={a.id} value={a.id}>{a.nama} ({rupiah(saldoMap[a.id] || 0)})</option>)}
                </select>
                <span className="muted">→</span>
                <select value={transferForm.ke} onChange={(e) => setTransferForm({ ...transferForm, ke: e.target.value })} required>
                  <option value="">Ke...</option>
                  {acc.map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
                </select>
                <input type="number" placeholder="Jumlah Rp" value={transferForm.jumlah} onChange={(e) => setTransferForm({ ...transferForm, jumlah: e.target.value })} required />
                <input type="date" value={transferForm.tanggal} onChange={(e) => setTransferForm({ ...transferForm, tanggal: e.target.value })} />
                <input placeholder="Catatan (opsional)" value={transferForm.catatan} onChange={(e) => setTransferForm({ ...transferForm, catatan: e.target.value })} />
                <button className="btn primary" type="submit">Transfer</button>
              </form>
            </div>
          </>
        )}

        {tab === 'petty' && (
          <>
            <div className="cards two">
              <div className="card out"><span>Total Pengeluaran ({pettyPeriodeLabel})</span><b className="minus">{rupiah(pettyRekap.expense)}</b><small>{pettyFiltered.filter((p) => p.tipe !== 'advance').length} pemakaian • {pettyAkunNamaTampil}</small></div>
              <div className="card in"><span>Cash Advance • Sisa</span><b>{rupiah(pettyRekap.advance)} • <span className={pettyRekap.sisa < 0 ? 'minus' : 'plus'}>{rupiah(pettyRekap.sisa)}</span></b><small>Saldo {pettyAkunNamaTampil}: {rupiah(pettySaldoTampil)}{pettyAkunScope.length > 1 ? ` (${pettyAkunScope.map((a) => `${akunLabel(a)} ${rupiah(saldoMap[a.id] || 0)}`).join(' • ')})` : ''}</small></div>
            </div>

            <div className="panel">
              <h3>{editPettyId ? '✏️ Edit Petty Cash' : '➕ Catat Petty Cash — langsung ke akun titipan'}</h3>
              {accTitipan.length === 0 ? (
                <p className="muted">Belum ada akun titipan. <button className="link" onClick={() => setTab('akun')}>Buat dulu di tab Akun (centang 🏢 titipan) →</button></p>
              ) : (
                <form className="petty-form" onSubmit={simpanPetty}>
                  <div className="row2">
                    <label>Akun titipan
                      <select value={pettyForm.akunId || pettyAkun || accTitipanFiltered[0]?.id || accTitipan[0]?.id || ''} onChange={(e) => setPettyForm({ ...pettyForm, akunId: e.target.value })}>
                        {(pettyPemilik ? accTitipanFiltered : accTitipan).map((a) => <option key={a.id} value={a.id}>{akunLabel(a)} ({rupiah(saldoMap[a.id] || 0)})</option>)}
                      </select>
                    </label>
                    <label>Jenis
                      <select value={pettyForm.tipe} onChange={(e) => setPettyForm({ ...pettyForm, tipe: e.target.value })}>
                        <option value="expense">💸 Pengeluaran (belanja / amplop / bayar)</option>
                        <option value="advance">💰 Cash advance (terima uang dari kantor)</option>
                      </select>
                    </label>
                  </div>
                  <div className="row2">
                    <label>Tanggal<input type="date" value={pettyForm.tanggal} onChange={(e) => setPettyForm({ ...pettyForm, tanggal: e.target.value })} required /></label>
                    <label>Jumlah (Rp)<input type="number" value={pettyForm.jumlah} onChange={(e) => setPettyForm({ ...pettyForm, jumlah: e.target.value })} placeholder="cth: 150000" required /></label>
                  </div>
                  <label>Keterangan / keperluan<input value={pettyForm.keterangan} onChange={(e) => setPettyForm({ ...pettyForm, keterangan: e.target.value })} placeholder="cth: beli ATK / amplop pak RT / bensin operasional" required /></label>
                  {pettyForm.tipe === 'expense' && (
                    <>
                      <label className="check"><input type="checkbox" checked={!!pettyForm.tanpaNota} onChange={(e) => setPettyForm({ ...pettyForm, tanpaNota: e.target.checked })} /> ✉️ Tanpa nota (misal amplop ke orang — tetap tercatat, tanpa foto pun bisa)</label>
                      <label>Bukti foto / nota (max 3, opsional kalau tanpa nota)
                        <input type="file" accept="image/*" multiple onChange={onPettyFoto} />
                      </label>
                      {pettyBusy && <small className="muted">Mengompres foto...</small>}
                      {pettyPhotos.length > 0 && (
                        <div className="foto-grid">
                          {pettyPhotos.map((ph, i) => (
                            <div key={i} className="foto-thumb">
                              <img src={ph} alt={`bukti ${i + 1}`} onClick={() => setPettyLightbox(ph)} />
                              <button type="button" className="iconbtn" onClick={() => setPettyPhotos(pettyPhotos.filter((_, x) => x !== i))}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div className="btnrow">
                    <button className="btn primary" type="submit" disabled={pettyBusy}>{editPettyId ? 'Simpan Perubahan' : (pettyForm.tipe === 'advance' ? 'Catat Advance' : 'Catat Pengeluaran')}</button>
                    {editPettyId && <button className="btn ghost" type="button" onClick={resetPettyForm}>Batal</button>}
                  </div>
                </form>
              )}
              <small className="muted">Otomatis tercatat sebagai {pettyForm.tipe === 'advance' ? 'pemasukan' : 'pengeluaran'} di akun titipan → saldo titipan selalu sinkron, tidak kecampur uang pribadi.</small>
            </div>

            <div className="panel">
              <h3>💵 Tarik Tunai / Pindah Kas — kalau ambil sebagian dari BCA</h3>
              <p className="muted" style={{ marginTop: 0 }}>Contoh casemu: petty ada di <b>BCA Titipan</b>, kamu tarik Rp500rb ke tunai, kepakai Rp350rb. Sisanya tetap ketahuan: tunai sisa Rp150rb + sisa di BCA. Caranya: (1) tarik tunai di bawah, (2) catat pemakaian pakai akun <b>Tunai</b>.</p>
              {accTitipan.length < 2 ? (
                <p className="muted">Biar rapi, buat 2 akun titipan di tab Akun: <b>“BCA Petty”</b> + <b>“Tunai Petty”</b> (keduanya centang 🏢 titipan). <button className="link" onClick={() => setTab('akun')}>Buat sekarang →</button></p>
              ) : (
                <form className="inline-form" onSubmit={simpanTarikTunai}>
                  <select value={pettyTarik.dari} onChange={(e) => setPettyTarik({ ...pettyTarik, dari: e.target.value })} required>
                    <option value="">Dari...</option>
                    {accTitipan.map((a) => <option key={a.id} value={a.id}>{akunLabel(a)} ({rupiah(saldoMap[a.id] || 0)})</option>)}
                  </select>
                  <span className="muted">→</span>
                  <select value={pettyTarik.ke} onChange={(e) => setPettyTarik({ ...pettyTarik, ke: e.target.value })} required>
                    <option value="">Ke...</option>
                    {accTitipan.map((a) => <option key={a.id} value={a.id}>{akunLabel(a)}</option>)}
                  </select>
                  <input type="number" placeholder="Jumlah Rp" value={pettyTarik.jumlah} onChange={(e) => setPettyTarik({ ...pettyTarik, jumlah: e.target.value })} required />
                  <input type="date" value={pettyTarik.tanggal} onChange={(e) => setPettyTarik({ ...pettyTarik, tanggal: e.target.value })} />
                  <button className="btn primary" type="submit">Tarik / Pindah</button>
                </form>
              )}
              <small className="muted">Tarik tunai = transfer antar titipan, <b>bukan pengeluaran</b> — jadi tidak mengurangi Sisa rekap. Pengeluaran baru berkurang saat kamu catat pemakaian dari akun Tunai. Sisa tunai = saldo akun Tunai saat ini.</small>
              {accTitipan.length > 0 && (
                <ul className="list" style={{ marginTop: 8 }}>
                  {accTitipan.map((a) => <li key={a.id}><span>🏢 {akunLabel(a)}</span><b>{rupiah(saldoMap[a.id] || 0)}</b></li>)}
                </ul>
              )}
            </div>

            <div className="panel">
              <h3>📑 Rekap & Download DOCX</h3>
              <div className="inline-form">
                <select value={pettyPemilik} onChange={(e) => { setPettyPemilik(e.target.value); setPettyAkun(''); }} title="Filter pemilik uang">
                  <option value="">Semua pemilik</option>
                  {daftarPemilik.map((p) => <option key={p} value={p}>👤 {p}</option>)}
                </select>
                <select value={pettyAkun} onChange={(e) => { setPettyAkun(e.target.value); setPettyForm((f) => ({ ...f, akunId: e.target.value || f.akunId })); }}>
                  <option value="">Semua akun{pettyPemilik ? ` ${pettyPemilik}` : ' titipan'}</option>
                  {accTitipanFiltered.map((a) => <option key={a.id} value={a.id}>{akunLabel(a)}</option>)}
                </select>
                <select value={pettyMode} onChange={(e) => setPettyMode(e.target.value)}>
                  <option value="bulan">Periode bulan ({namaBulan(bulan)})</option>
                  <option value="rentang">Rentang tanggal</option>
                </select>
                {pettyMode === 'rentang' && (
                  <>
                    <input type="date" value={pettyDari} onChange={(e) => setPettyDari(e.target.value)} />
                    <span className="muted">s/d</span>
                    <input type="date" value={pettySampai} onChange={(e) => setPettySampai(e.target.value)} />
                  </>
                )}
                <input placeholder="🔍 Cari keterangan..." value={pettyCari} onChange={(e) => setPettyCari(e.target.value)} />
                <button className="btn primary" onClick={downloadPettyDocx}>⬇ Download DOCX</button>
              </div>
              <ul className="list">
                <li><span>Total Pengeluaran</span><b className="minus">{rupiah(pettyRekap.expense)}</b></li>
                <li><span>Cash Advance</span><b className="plus">{rupiah(pettyRekap.advance)}</b></li>
                <li><span>Sisa (Advance − Pengeluaran)</span><b>{rupiah(pettyRekap.sisa)}</b></li>
              </ul>
              <small className="muted">DOCX berisi: tabel rekap + total + lampiran foto yang dikelompokkan per tanggal + kolom tanda tangan.</small>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Akun</th><th>Bukti</th><th style={{ textAlign: 'right' }}>Jumlah</th><th></th></tr></thead>
                  <tbody>
                    {pettyFiltered.map((p) => (
                      <tr key={p.id}>
                        <td>{p.tanggal}</td>
                        <td>{p.tipe === 'advance' ? <span className="badge aman">ADVANCE</span> : p.tanpaNota ? <span className="badge menipis">TANPA NOTA</span> : <span className="badge transfer">NOTA</span>} {p.keterangan}</td>
                        <td className="muted">{akunLabel(acc.find((a) => a.id === p.akunId))}</td>
                        <td>{(p.photos?.length || 0) > 0 ? (
                          <span className="foto-mini-row">{p.photos.map((ph, i) => <img key={i} src={ph} alt="" onClick={() => setPettyLightbox(ph)} />)}</span>
                        ) : <span className="muted">—</span>}</td>
                        <td style={{ textAlign: 'right' }} className={p.tipe === 'advance' ? 'plus' : 'minus'}>{p.tipe === 'advance' ? '+' : '−'}{rupiah(p.jumlah)}</td>
                        <td><button className="iconbtn" onClick={() => mulaiEditPetty(p)}>✏️</button><button className="iconbtn" onClick={() => hapusPetty(p)}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pettyFiltered.length === 0 && <p className="muted center">Belum ada petty cash di periode ini.</p>}
              </div>
              {pettyGroups.length > 0 && (
                <>
                  <h4>📎 Lampiran per tanggal</h4>
                  {pettyGroups.map(([tgl, arr]) => (
                    <div key={tgl} className="lampiran-grup">
                      <b>{tgl} — {arr.length} transaksi • {rupiah(arr.filter((x) => x.tipe !== 'advance').reduce((s, x) => s + Number(x.jumlah), 0))}</b>
                      <div className="foto-grid">
                        {arr.flatMap((p) => (p.photos || []).map((ph, i) => ({ ph, ket: p.keterangan, id: `${p.id}-${i}` }))).map(({ ph, ket, id }) => (
                          <figure key={id} className="foto-lampiran">
                            <img src={ph} alt={ket} onClick={() => setPettyLightbox(ph)} />
                            <figcaption>{ket}</figcaption>
                          </figure>
                        ))}
                      </div>
                      {arr.every((p) => !(p.photos?.length) && p.tipe !== 'advance') && <small className="muted">Tidak ada foto — semua tanpa nota/amplop pada tanggal ini.</small>}
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}

        {tab === 'utang' && (
          <>
            <div className="cards two">
              <div className="card"><span>🤝 Total Piutang aktif (hakmu)</span><b className="plus">{rupiah(totalPiutang)}</b><small>Orang hutang ke kamu — jangan lupa ditagih</small></div>
              <div className="card"><span>💳 Total Utang aktif (kewajibanmu)</span><b className="minus">{rupiah(totalUtang)}</b><small>Kamu hutang — lunasi sebelum jatuh tempo</small></div>
            </div>
            <div className="panel">
              <h3>{editDebtId ? '✏️ Edit Utang / Piutang' : '➕ Catat Utang / Piutang Baru'}</h3>
              <form className="inline-form" onSubmit={simpanDebt}>
                <select value={debtForm.tipe} onChange={(e) => setDebtForm({ ...debtForm, tipe: e.target.value })}>
                  <option value="piutang">🤝 Piutang — orang hutang ke aku</option>
                  <option value="utang">💳 Utang — aku hutang ke orang</option>
                </select>
                <input placeholder="Nama (cth: Andi / Kas Kantor)" value={debtForm.nama} onChange={(e) => setDebtForm({ ...debtForm, nama: e.target.value })} />
                <input type="number" placeholder="Nominal Rp" value={debtForm.jumlah} onChange={(e) => setDebtForm({ ...debtForm, jumlah: e.target.value })} />
                <select value={debtForm.akunId} onChange={(e) => setDebtForm({ ...debtForm, akunId: e.target.value })} title={debtForm.tipe === 'piutang' ? 'Uang keluar dari kas mana?' : 'Uang masuk ke kas mana?'}>
                  <option value="">{debtForm.tipe === 'piutang' ? '💸 Keluar dari kas... (opsional)' : '💰 Masuk ke kas... (opsional)'}</option>
                  {acc.map((a) => <option key={a.id} value={a.id}>{a.nama} ({rupiah(saldoMap[a.id] || 0)})</option>)}
                </select>
                <input type="date" value={debtForm.tanggal} onChange={(e) => setDebtForm({ ...debtForm, tanggal: e.target.value })} title="Tanggal pinjam" />
                <input type="date" value={debtForm.jatuhTempo} onChange={(e) => setDebtForm({ ...debtForm, jatuhTempo: e.target.value })} title="Jatuh tempo (opsional)" />
                <input placeholder="Catatan (opsional)" value={debtForm.catatan} onChange={(e) => setDebtForm({ ...debtForm, catatan: e.target.value })} />
                <button className="btn primary" type="submit">{editDebtId ? 'Simpan Perubahan' : 'Simpan'}</button>
                {editDebtId && <button className="btn ghost" type="button" onClick={resetDebtForm}>Batal</button>}
              </form>
              <small className="muted">{debtForm.tipe === 'piutang' ? 'Piutang: uang keluar dari kasmu (kasih pinjam) → otomatis tercatat sebagai pengeluaran.' : 'Utang: uang masuk ke kasmu (terima pinjaman) → otomatis tercatat sebagai pemasukan.'} Pilih kas supaya saldo kepotong/nambah beneran. Klik <b>Rincian</b> di kartu untuk lihat aliran uangnya.</small>
              <br /><small className="muted">Tips petty cash: kalau kamu dipegangi kas kantor, JANGAN catat sebagai piutang — buat akun titipan di tab Akun (centang 🏢 titipan) supaya tidak kecampur uang pribadi.</small>
            </div>
            <div className="budget-grid">
              {debtList.map((dRaw) => {
                const d = normalDebt(dRaw);
                const sisa = sisaDebt(d);
                const persen = d.jumlah > 0 ? Math.min(100, ((d.terbayar || 0) / d.jumlah) * 100) : 0;
                const lunas = sisa <= 0;
                const terbuka = detailDebtId === d.id;
                const riwayat = [...(d.riwayat || [])].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
                return (
                  <div key={d.id} className={`bcard ${lunas ? '' : d.tipe === 'piutang' ? 'menipis' : 'over'}`}>
                    <div className="bcard-top"><b>{d.tipe === 'piutang' ? '🤝' : '💳'} {d.nama}</b><span className={`badge ${lunas ? 'aman' : d.tipe === 'piutang' ? 'menipis' : 'over'}`}>{lunas ? 'LUNAS' : d.tipe === 'piutang' ? 'PIUTANG' : 'UTANG'}</span></div>
                    <div className="bar"><div className="fill" style={{ width: `${persen}%` }} /></div>
                    <small>Sisa {rupiah(sisa)} dari {rupiah(d.jumlah)} • terbayar {rupiah(d.terbayar || 0)} ({Math.round(persen)}%)</small>
                    <small className="muted">📅 {d.tanggal || '-'} {d.jatuhTempo ? `• ⏰ tempo ${d.jatuhTempo}` : '• tanpa tempo'}</small>
                    <small className="muted">💳 Kas: <b>{d.akunId ? debtAkunNama(d.akunId) : 'tidak dicatat ke kas'}</b>{d.catatan ? ` • ${d.catatan}` : ''}</small>
                    <small className="muted">🧾 {d.riwayat?.length || 0} kejadian • klik Rincian untuk buka</small>
                    <div className="btnrow">
                      <button className="btn ghost sm" onClick={() => setDetailDebtId(terbuka ? null : d.id)}>{terbuka ? '🔼 Tutup' : '🧾 Rincian'}</button>
                      {!lunas && <button className="btn primary sm" onClick={() => bukaDebtAct(d, 'bayar')}>{d.tipe === 'piutang' ? '💰 Terima bayaran' : '💸 Bayar cicilan'}</button>}
                      {!lunas && <button className="btn ghost sm" onClick={() => bukaDebtAct(d, 'tambah')} title="Orang yang sama ngutang lagi — tambahkan ke total ini">➕ Tambah</button>}
                      <button className="btn ghost sm" onClick={() => mulaiEditDebt(d)}>✏️</button>
                      <button className="btn ghost sm" onClick={() => { if (confirm('Hapus catatan ini? Transaksi kas yang sudah tercatat TIDAK ikut terhapus.')) setDebts(debtList.filter((x) => x.id !== d.id)); }}>🗑️</button>
                    </div>
                    {terbuka && (
                      <div className="riwayat">
                        <b className="riwayat-h">Rincian {d.nama}</b>
                        {riwayat.length === 0 ? (
                          <small className="muted">Belum ada rincian (data lama sebelum fitur ini). Pembayaran baru akan tercatat di sini otomatis.</small>
                        ) : (
                          <ul className="riwayat-list">
                            {riwayat.map((r) => (
                              <li key={r.id} className={`riwayat-row ${r.aksi}`}>
                                <span className={`badge ${r.aksi === 'bayar' ? 'aman' : r.aksi === 'tambah' ? 'menipis' : 'transfer'}`}>
                                  {r.aksi === 'bayar' ? (d.tipe === 'piutang' ? '💰 diterima' : '💸 dibayar') : r.aksi === 'tambah' ? '➕ nambah' : '📌 awal'}
                                </span>
                                <span className="riwayat-main">
                                  <b className={r.aksi === 'bayar' ? 'plus' : 'minus'}>{r.aksi === 'bayar' ? '+' : '+'}{rupiah(r.jumlah)}</b>
                                  <small className="muted">{r.tanggal || '-'} • 💳 {debtAkunNama(r.akunId)}</small>
                                  {r.catatan && <small>{r.catatan}</small>}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <small className="muted">Total dipinjam: {rupiah(d.jumlah)} • sudah kembali/terbayar: {rupiah(d.terbayar || 0)} • sisa: {rupiah(sisa)}</small>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {debtList.length === 0 && <p className="muted">Belum ada utang/piutang. Kabar baik!</p>}
          </>
        )}

        {tab === 'budget' && (
          <>
            <div className="panel">
              <h3>Buat / Update Budget — {namaBulan(bulan)}</h3>
              <form className="inline-form" onSubmit={simpanBudget}>
                <select value={budgetForm.kategori} onChange={(e) => setBudgetForm({ ...budgetForm, kategori: e.target.value })}>
                  {KATEGORI.pengeluaran.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <input type="number" placeholder="Limit (Rp)" value={budgetForm.limit} onChange={(e) => setBudgetForm({ ...budgetForm, limit: e.target.value })} />
                <button className="btn primary" type="submit">Simpan Budget</button>
              </form>
              <small className="muted">Atau <button className="link" onClick={() => setTab('rencana')}>hitung otomatis dari gaji →</button></small>
            </div>
            <div className="budget-grid">
              {budgetStatus.map((b) => (
                <div key={b.id} className={`bcard ${b.status}`}>
                  <div className="bcard-top"><b>{b.kategori}</b><span className={`badge ${b.status}`}>{b.status === 'over' ? '🚨 OVER' : b.status === 'menipis' ? '⚠️ MENIPIS' : b.status}</span></div>
                  <div className="bar big"><div className={`fill ${b.status}`} style={{ width: `${Math.min(b.persen, 100)}%` }} /></div>
                  <div className="bnum"><span>Terpakai<br /><b>{rupiah(b.terpakai)}</b></span><span>Sisa<br /><b className={b.limit - b.terpakai < 0 ? 'minus' : ''}>{rupiah(b.limit - b.terpakai)}</b></span><span>Limit<br /><b>{rupiah(b.limit)}</b></span></div>
                  <button className="btn ghost sm" onClick={() => { if (confirm('Hapus budget ini?')) setBudgets(bd.filter((x) => x.id !== b.id)); }}>Hapus</button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'rencana' && (
          <>
            <div className="panel highlight">
              <h3>💼 Cukup masukkan gaji — biar ilmu keuangan yang hitung</h3>
              <div className="plan-inputs">
                <label>Gaji / pemasukan per bulan (Rp)
                  <input type="number" value={plan.gaji} onChange={(e) => setPlan({ ...plan, gaji: e.target.value, custom: null })} placeholder="cth: 12000000" />
                </label>
                <label>Status tanggungan
                  <select value={plan.status} onChange={(e) => setPlan({ ...plan, status: e.target.value })}>
                    {Object.entries(STATUS_DARURAT).map(([k, v]) => <option key={k} value={k}>{v.label} — ideal {v.range}</option>)}
                  </select>
                </label>
                <label>Pengeluaran wajib / bulan (Rp) <small className="muted">kosongkan = pakai rata2 {rupiah(avgKeluar3)}</small>
                  <input type="number" value={plan.wajib} onChange={(e) => setPlan({ ...plan, wajib: e.target.value })} placeholder={`cth: ${avgKeluar3 || 6000000}`} />
                </label>
              </div>
              {rek && (
                <>
                  <div className="rek-metode">Metode: <b>{rek.metode}</b> • prioritas pay-yourself-first</div>
                  <div className="rek-grid">
                    <div className="rek kebutuhan"><span>🏠 Kebutuhan {alokasi.pButuh}%</span><b>{rupiah(nom(alokasi.pButuh))}</b><small>Makan, kost, transport, tagihan</small></div>
                    <div className="rek keinginan"><span>🎮 Keinginan {alokasi.pIngin}%</span><b>{rupiah(nom(alokasi.pIngin))}</b><small>Hiburan, jajan, belanja non-esensial</small></div>
                    <div className="rek darurat"><span>🛟 Dana darurat {alokasi.pDarurat}%</span><b>{rupiah(nom(alokasi.pDarurat))}</b><small>Sampai target {rupiah(daruratTarget)} penuh</small></div>
                    <div className="rek tabungan"><span>🏦 Tabungan goals {alokasi.pTabungan}%</span><b>{rupiah(nom(alokasi.pTabungan))}</b><small>DP, nikah, liburan, dll</small></div>
                    <div className="rek investasi"><span>📈 Investasi {alokasi.pInvest}%</span><b>{rupiah(nom(alokasi.pInvest))}</b><small>Reksadana, saham, emas</small></div>
                  </div>
                  <details className="custom">
                    <summary>⚙️ Sesuaikan % sendiri (tetap dibimbing)</summary>
                    <div className="custom-row">
                      {[['pButuh', 'Kebutuhan'], ['pIngin', 'Keinginan'], ['pDarurat', 'Darurat'], ['pTabungan', 'Tabungan'], ['pInvest', 'Investasi']].map(([k, label]) => (
                        <label key={k}>{label} %
                          <input type="number" value={alokasi[k]} onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value) || 0);
                            setPlan({ ...plan, custom: { ...(plan.custom || rek), [k]: v } });
                          }} />
                        </label>
                      ))}
                    </div>
                    <small className={Object.values(alokasi).filter((v) => typeof v === 'number').slice(0, 5).reduce((a, b) => a + b, 0) !== 100 ? 'minus' : 'plus'}>
                      Total: {(alokasi.pButuh + alokasi.pIngin + alokasi.pDarurat + alokasi.pTabungan + alokasi.pInvest)}% (ideal = 100%)
                    </small>
                    <div className="btnrow">
                      <button className="btn ghost sm" onClick={() => setPlan({ ...plan, custom: null })}>↩ Kembalikan ke rekomendasi ahli</button>
                      <button className="btn primary sm" onClick={terapkanRekomendasiKeBudget}>✨ Terapkan ke Budget {namaBulan(bulan)}</button>
                    </div>
                  </details>
                  <div className="tips">
                    <b>🤖 Saran untukmu:</b>
                    <ul>{rek.saran.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                </>
              )}
            </div>

            <div className="grid2">
              <div className="panel">
                <h3>🛟 Dana Darurat — {Math.round(daruratPersen)}%</h3>
                <p className="muted">{daruratInfo.label} • ideal {daruratInfo.range} × pengeluaran wajib. {daruratInfo.ket}</p>
                <div className="bar big"><div className="fill" style={{ width: `${daruratPersen}%` }} /></div>
                <ul className="list">
                  <li><span>Target otomatis</span><b>{rupiah(daruratInfo.target)}</b></li>
                  <li><span>Terkumpul</span><b>{rupiah(emg.terkumpul)}</b></li>
                  <li><span>Kurang</span><b className="minus">{rupiah(Math.max(0, daruratTarget - emg.terkumpul))}</b></li>
                  <li><span>Estimasi lunas</span><b>{estimasiDarurat > 0 ? `± ${estimasiDarurat} bulan (${rupiah(cicilDarurat)}/bln)` : daruratPersen >= 100 ? '🎉 Sudah penuh!' : '—'}</b></li>
                </ul>
                <div className="inline-form">
                  <input type="number" id="emg-nom" placeholder="Nominal (Rp)" />
                  <button className="btn primary" onClick={() => {
                    const v = Number(document.getElementById('emg-nom').value);
                    if (v > 0) setEmg({ ...emg, terkumpul: Number(emg.terkumpul) + v });
                  }}>+ Tambah</button>
                  <button className="btn ghost" onClick={() => {
                    const v = Number(document.getElementById('emg-nom').value);
                    if (v > 0) setEmg({ ...emg, terkumpul: Math.max(0, Number(emg.terkumpul) - v) });
                  }}>− Pakai</button>
                </div>
                <label className="muted">Target manual (opsional, kosongkan = otomatis)<input type="number" value={emg.targetManual} onChange={(e) => setEmg({ ...emg, targetManual: e.target.value })} placeholder={String(daruratInfo.target)} /></label>
                <small className="muted">💡 Simpan darurat di tempat likuid: tabungan terpisah / RDPU, BUKAN saham/crypto.</small>
              </div>

              <div className="panel">
                <h3>🏦 Target Tabungan ({goals.length})</h3>
                <form className="inline-form" onSubmit={simpanGoal}>
                  <input placeholder="Nama target (cth: DP Motor)" value={goalForm.nama} onChange={(e) => setGoalForm({ ...goalForm, nama: e.target.value })} />
                  <input type="number" placeholder="Target Rp" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} />
                  <input type="number" placeholder="Terkumpul Rp" value={goalForm.terkumpul} onChange={(e) => setGoalForm({ ...goalForm, terkumpul: e.target.value })} />
                  <button className="btn primary" type="submit">+ Target</button>
                </form>
                <div className="goals">
                  {goals.map((g) => {
                    const p = g.target > 0 ? Math.min(100, (g.terkumpul / g.target) * 100) : 0;
                    const cicil = alokasi && goals.length ? Math.round(nom(alokasi.pTabungan) / goals.length) : 0;
                    const sisaBulan = cicil > 0 && g.target > g.terkumpul ? Math.ceil((g.target - g.terkumpul) / cicil) : 0;
                    return (
                      <div key={g.id} className="goal">
                        <div className="goal-top"><b>{g.nama}</b><button className="iconbtn" onClick={() => { if (confirm('Hapus target ini?')) setGoals(goals.filter((x) => x.id !== g.id)); }}>🗑️</button></div>
                        <div className="bar"><div className="fill" style={{ width: `${p}%` }} /></div>
                        <small>{rupiah(g.terkumpul)} / {rupiah(g.target)} • {Math.round(p)}% {sisaBulan > 0 && `• ± ${sisaBulan} bln (${rupiah(cicil)}/bln)`}</small>
                        <div className="inline-form">
                          <input type="number" placeholder="Setor Rp" id={`setor-${g.id}`} />
                          <button className="btn ghost sm" onClick={() => {
                            const v = Number(document.getElementById(`setor-${g.id}`).value);
                            if (v > 0) setGoals(goals.map((x) => (x.id === g.id ? { ...x, terkumpul: Number(x.terkumpul) + v } : x)));
                          }}>Setor</button>
                        </div>
                      </div>
                    );
                  })}
                  {goals.length === 0 && <p className="muted">Belum ada target. Bikin satu dulu, misal “Dana Darurat Mini 3jt”.</p>}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'laporan' && (
          <div className="grid2">
            <div className="panel">
              <h3>📁 Export / Import</h3>
              <p className="muted">Semua data (transaksi, budget, rencana, tabungan, darurat, petty cash) ikut ter-backup di JSON.</p>
              <div className="btnrow">
                <button className="btn primary" onClick={exportCSV}>⬇ Export CSV (Excel)</button>
                <button className="btn ghost" onClick={exportJSON}>⬇ Export JSON (backup)</button>
                <button className="btn ghost" onClick={() => fileRef.current?.click()}>⬆ Import JSON</button>
                <input ref={fileRef} type="file" accept=".json" hidden onChange={importJSON} />
              </div>
              <hr />
              <h4>Ringkasan {namaBulan(bulan)}</h4>
              <ul className="list">
                <li><span>Total Pemasukan</span><b className="plus">{rupiah(totalMasuk)}</b></li>
                <li><span>Total Pengeluaran</span><b className="minus">{rupiah(totalKeluar)}</b></li>
                <li><span>Total Investasi</span><b>{rupiah(totalInvest)}</b></li>
                <li><span>Sisa Kas</span><b>{rupiah(sisaKas)}</b></li>
                <li><span>Dana Darurat</span><b>{rupiah(Number(emg.terkumpul))} / {rupiah(daruratTarget)}</b></li>
                <li><span>Tabungan Goals</span><b>{rupiah(totalGoalsTerkumpul)} / {rupiah(totalGoalsTarget)}</b></li>
              </ul>
            </div>
            <div className="panel">
              <h3>🧭 Kemana uangmu pergi?</h3>
              <ul className="list">
                {keluarPerKategori.map((r, i) => (
                  <li key={r.name}><span>{i + 1}. {r.name}</span><b>{rupiah(r.value)} ({totalKeluar ? Math.round((r.value / totalKeluar) * 100) : 0}%)</b></li>
                ))}
              </ul>
              {keluarPerKategori.length === 0 && <p className="muted">Belum ada data.</p>}
            </div>
          </div>
        )}
      </main>

      {showForm && (
        <div className="modal-bg" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={simpanTransaksi}>
            <h3>{editId ? 'Edit Transaksi' : 'Tambah Transaksi'}</h3>
            <div className="seg">
              {['pemasukan', 'pengeluaran', 'investasi', 'transfer'].map((t) => (
                <button type="button" key={t} className={form.tipe === t ? 'active' : ''} onClick={() => setForm({ ...form, tipe: t })}>{t}</button>
              ))}
            </div>
            <label>Jumlah (Rp)<input type="number" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} placeholder="cth: 500000" required /></label>
            {form.tipe === 'transfer' ? (
              <div className="row2">
                <label>Dari akun<select value={form.akunId} onChange={(e) => setForm({ ...form, akunId: e.target.value })}>{acc.map((a) => <option key={a.id} value={a.id}>{a.nama} ({rupiah(saldoMap[a.id] || 0)})</option>)}</select></label>
                <label>Ke akun<select value={form.akunTujuan} onChange={(e) => setForm({ ...form, akunTujuan: e.target.value })}><option value="">Pilih...</option>{acc.filter((a) => a.id !== form.akunId).map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></label>
              </div>
            ) : (
              <div className="row2">
                <label>Akun / Kas<select value={form.akunId} onChange={(e) => setForm({ ...form, akunId: e.target.value })}>{acc.map((a) => <option key={a.id} value={a.id}>{a.nama} ({rupiah(saldoMap[a.id] || 0)})</option>)}</select></label>
                <label>Tanggal<input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} required /></label>
              </div>
            )}
            {form.tipe === 'transfer' && (
              <label>Tanggal<input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} required /></label>
            )}
            {form.tipe !== 'transfer' && (
              <label>Kategori<select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>{(KATEGORI[form.tipe] || ['Lainnya']).map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
            )}
            <label>Catatan<input value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="cth: makan siang, gaji, topup gopay" /></label>
            <div className="btnrow">
              <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>Batal</button>
              <button type="submit" className="btn primary">{editId ? 'Simpan Perubahan' : 'Simpan'}</button>
            </div>
          </form>
        </div>
      )}

      {debtAct && (() => {
        const d = normalDebt(debtList.find((x) => x.id === debtAct.id) || {});
        const sisa = sisaDebt({ jumlah: d.jumlah || 0, terbayar: d.terbayar || 0 });
        const isTambah = debtAct.mode === 'tambah';
        return (
          <div className="modal-bg" onClick={() => setDebtAct(null)}>
            <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={simpanDebtAct}>
              <h3>{isTambah ? `➕ Nambah pinjaman — ${d.nama}` : d.tipe === 'piutang' ? `💰 Terima bayaran — ${d.nama}` : `💸 Bayar ke — ${d.nama}`}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {isTambah
                  ? `Total sekarang ${rupiah(d.jumlah || 0)} • sisa ${rupiah(sisa)}. Nominal baru akan ditambahkan + otomatis tercatat di kas.`
                  : `Sisa ${rupiah(sisa)} dari total ${rupiah(d.jumlah || 0)}. Uang ${d.tipe === 'piutang' ? 'masuk ke' : 'keluar dari'} kas yang kamu pilih.`}
              </p>
              <label>Nominal (Rp)<input type="number" value={debtActForm.jumlah} onChange={(e) => setDebtActForm({ ...debtActForm, jumlah: e.target.value })} placeholder={isTambah ? 'cth: 500000' : String(sisa)} max={isTambah ? undefined : sisa} required /></label>
              <div className="row2">
                <label>{d.tipe === 'piutang' ? (isTambah ? 'Keluar dari kas' : 'Masuk ke kas') : (isTambah ? 'Masuk ke kas' : 'Keluar dari kas')}
                  <select value={debtActForm.akunId} onChange={(e) => setDebtActForm({ ...debtActForm, akunId: e.target.value })} required>
                    <option value="">Pilih kas...</option>
                    {accPribadi.map((a) => <option key={a.id} value={a.id}>{a.nama} ({rupiah(saldoMap[a.id] || 0)})</option>)}
                  </select>
                </label>
                <label>Tanggal<input type="date" value={debtActForm.tanggal} onChange={(e) => setDebtActForm({ ...debtActForm, tanggal: e.target.value })} required /></label>
              </div>
              <label>Catatan (cth: nambah beli bensin / cicilan ke-2)<input value={debtActForm.catatan} onChange={(e) => setDebtActForm({ ...debtActForm, catatan: e.target.value })} placeholder="opsional" /></label>
              <div className="btnrow">
                <button type="button" className="btn ghost" onClick={() => setDebtAct(null)}>Batal</button>
                <button type="submit" className="btn primary">{isTambah ? 'Tambah ke total' : 'Simpan pembayaran'}</button>
              </div>
            </form>
          </div>
        );
      })()}

      {akunSesuai && (() => {
        const a = acc.find((x) => x.id === akunSesuai.id);
        if (!a) return null;
        const sekarang = saldoMap[a.id] || 0;
        const target = Number(akunSesuai.nominal) || 0;
        const selisih = Math.round(target - sekarang);
        return (
          <div className="modal-bg" onClick={() => setAkunSesuai(null)}>
            <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={simpanSesuaiAkun}>
              <h3>🎯 Sesuaikan saldo — {a.nama}</h3>
              <p className="muted" style={{ margin: 0 }}>
                Saldo tercatat sekarang {rupiah(sekarang)} (awal {rupiah(a.saldoAwal)} + mutasi).
                Isi saldo sebenarnya sesuai m-banking/dompet, selisih {selisih === 0 ? 'nol' : `${selisih > 0 ? '+' : ''}${rupiah(selisih)}`} akan dibuatkan transaksi koreksi otomatis.
              </p>
              <label>Saldo sebenarnya (Rp)<input type="number" min="0" value={akunSesuai.nominal} onChange={(e) => setAkunSesuai({ ...akunSesuai, nominal: e.target.value })} placeholder={String(sekarang)} required /></label>
              <div className="btnrow">
                <button type="button" className="btn ghost" onClick={() => setAkunSesuai(null)}>Batal</button>
                <button type="submit" className="btn primary" disabled={selisih === 0}>Simpan koreksi</button>
              </div>
            </form>
          </div>
        );
      })()}

      {pettyLightbox && (
        <div className="modal-bg" onClick={() => setPettyLightbox(null)}>
          <div className="lightbox" onClick={(e) => e.stopPropagation()}>
            <img src={pettyLightbox} alt="bukti petty cash" />
            <button className="btn ghost" onClick={() => setPettyLightbox(null)}>Tutup</button>
          </div>
        </div>
      )}

      {/* bottom nav khusus HP */}
      <nav className="bottomnav">
        {NAV.map(([k, emoji, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => { setTab(k); window.scrollTo({ top: 0 }); }}>
            <span>{emoji}</span><small>{label}</small>
          </button>
        ))}
      </nav>
      {/* tombol + besar di HP */}
      <button className="fab" onClick={() => { setShowForm(true); setEditId(null); }}>+</button>
    </div>
  );
}
