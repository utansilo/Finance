# DuitKu — bisa dibuka di HP + data sama laptop ↔ HP

## Kenapa sebelumnya nggak bisa?

Data tersimpan di `localStorage` browser laptop. Walaupun di-hosting,
browser HP punya `localStorage` sendiri yang kosong. Solusi: simpan data di cloud
(Firestore) + login Google yang sama di kedua perangkat.

## Yang sudah disiapkan di kode

- PWA (`vite-plugin-pwa`): bisa **Add to Home Screen** di HP Android/iPhone, fullscreen kayak aplikasi.
- Bottom nav + tombol + besar khusus HP, layout responsif.
- `src/lib/cloud.js` + `src/lib/useCloudSync.js`: kalau `.env` Firebase diisi + login Google,
  semua state (transaksi, budget, akun, plan, goals, darurat, utang) auto sinkron realtime.
  Kalau `.env` kosong: tetap jalan mode lokal seperti sekarang.
- Migrasi otomatis: login pertama di laptop mengunggah data lokal saat ini ke cloud.
  Lalu login akun yang sama di HP → data langsung sama.
- `firestore.rules`: user hanya bisa akses `users/{uid}` miliknya sendiri.

## Langkah setup (sekali saja, ±15 menit)

### 1. Buat project Firebase (gratis)

1. Buka https://console.firebase.google.com → Add project → nama misal `duitku`.
2. Build → Authentication → Sign-in method → enable **Google** → simpan.
3. Build → Firestore Database → Create database → **Start in production mode** → lokasi `asia-southeast2 (Jakarta)` → Enable.
4. Tab **Rules** → copy isi `firestore.rules` di repo ini → Publish.
5. Project Settings (ikon gear) → General → Your apps → **Web app (`</>`)** → Register → copy config:
   `apiKey, authDomain, projectId, appId`.

### 2. Isi env lokal (untuk tes di laptop)

```bash
cp .env.example .env
# isi 4 value dari langkah 1
npm run dev -- --host
```

Buka di HP satu WiFi via `http://<IP-laptop>:5173` (cek IP via `ipconfig getifaddr en0` di Mac).
Login Google → data laptop terunggah.

### 3. Deploy biar bisa dibuka dari mana aja (pilih salah satu)

**Opsi A — Vercel (termudah):**
1. Push repo ke GitHub.
2. https://vercel.com → Add New Project → import repo → Framework: Vite.
3. Tambah Environment Variables: `VITE_FB_API_KEY`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_PROJECT_ID`, `VITE_FB_APP_ID`.
4. Deploy → dapat URL `https://duitku-xxx.vercel.app`.
5. Firebase Console → Authentication → Settings → **Authorized domains** → tambah domain vercel itu.
6. Buka URL di laptop → Login Google. Buka URL yang sama di HP → Login Google yang sama → data sama ✓.
7. Di HP: Share → Add to Home Screen → jadi ikon aplikasi.

**Opsi B — Netlify:** sama, drag `dist/` atau connect GitHub + isi env yang sama.
Jangan lupa Authorized domains juga.

### 4. Pindah data lama (kalau login HP masih kosong)

- Pastikan laptop sudah login + status `tersambung ✓ sinkron`.
- Di HP login akun Google yang **sama persis**.
- Kalau masih kosong (misal beda akun): di laptop tab **File → Export JSON**, kirim file ke HP, di HP **Import JSON** → otomatis naik ke cloud.

## Perintah

```bash
npm run dev -- --host   # tes lokal + buka dari HP satu WiFi
npm run build           # hasil di dist/
npm run preview -- --host
```
