import { useEffect, useRef, useState } from 'react';
import {
  auth, cloudEnabled, loginGoogle, logoutGoogle,
  onAuthStateChanged, getRedirectResult, userDoc, onSnapshot, setDoc, serverTimestamp,
} from './cloud.js';

// Menghubungkan 7 slice state lokal ke Firestore.
// - Kalau belum login / belum setup Firebase: murni localStorage (mode sekarang).
// - Kalau sudah login Google dengan akun yang SAMA di laptop & HP: data auto sinkron realtime.
export function useCloudSync(slices) {
  const [user, setUser] = useState(null);
  const [cloudStatus, setCloudStatus] = useState(
    cloudEnabled ? 'siap — silakan login' : 'mode-lokal'
  );
  const [lastSync, setLastSync] = useState(null);
  const [authError, setAuthError] = useState('');
  const pushing = useRef(false);
  const firstLoad = useRef(true);

  const { transactions, budgets, accounts, plan, goals, emergency, debts } = slices;

  // 1. dengarkan auth + selesaikan hasil redirect (khusus HP)
  useEffect(() => {
    if (!cloudEnabled || !auth) return;
    setCloudStatus('mengecek login…');
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          setUser(res.user);
          setCloudStatus('tersambung ✓ sinkron');
        }
      })
      .catch((e) => {
        console.error('[auth redirect]', e);
        setAuthError(e?.code ? `${e.code}: ${e.message}` : String(e?.message || e));
        setCloudStatus('login gagal — lihat pesan merah');
      });
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setAuthError('');
        setCloudStatus('tersambung ✓ sinkron');
      } else {
        setCloudStatus('siap — silakan login');
      }
    }, (e) => {
      console.error('[auth state]', e);
      setAuthError(String(e?.message || e));
    });
    return unsub;
  }, []);

  // 2. subscribe dokumen cloud -> timpa state lokal (laptop ↔ HP sama)
  useEffect(() => {
    if (!cloudEnabled || !user) return;
    setCloudStatus('menghubungkan…');
    const unsub = onSnapshot(
      userDoc(user.uid),
      (snap) => {
        if (!snap.exists()) {
          // Dokumen belum ada: push data lokal laptop saat ini sebagai awal (migrasi otomatis)
          setCloudStatus('data lokal diunggah sebagai awal…');
          pushNow();
          return;
        }
        const d = snap.data();
        // Hindari loop: jangan timpa tepat setelah kita push
        if (pushing.current) return;
        try {
          pushing.current = true;
          if (d.transactions) slices.setTransactions(d.transactions);
          if (d.budgets) slices.setBudgets(d.budgets);
          if (d.accounts) slices.setAccounts(d.accounts);
          if (d.plan) slices.setPlan(d.plan);
          if (d.goals) slices.setGoals(d.goals);
          if (d.emergency) slices.setEmg(d.emergency);
          if (d.debts) slices.setDebts(d.debts);
          setLastSync(new Date());
          setCloudStatus('tersambung ✓ sinkron');
        } finally {
          setTimeout(() => { pushing.current = false; }, 300);
        }
      },
      () => setCloudStatus('gagal membaca cloud')
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 3. tiap ada perubahan lokal -> debounce push ke cloud
  const pushNow = async () => {
    if (!cloudEnabled || !user) return;
    try {
      pushing.current = true;
      setCloudStatus('menyimpan…');
      await setDoc(
        userDoc(user.uid),
        {
          transactions, budgets, accounts, plan, goals,
          emergency, debts,
          updatedAt: serverTimestamp(),
          updatedBy: user.email || user.uid,
        },
        { merge: true }
      );
      setLastSync(new Date());
      setCloudStatus('tersambung ✓ sinkron');
      if (firstLoad.current) firstLoad.current = false;
    } catch {
      setCloudStatus('gagal menyimpan — cek koneksi/rules');
    } finally {
      setTimeout(() => { pushing.current = false; }, 500);
    }
  };

  useEffect(() => {
    if (!cloudEnabled || !user) return;
    if (firstLoad.current && !lastSync) {
      // biarkan snapshot pertama yang menentukan (hindari overwrite saat buka HP kosong)
      return;
    }
    const t = setTimeout(pushNow, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, budgets, accounts, plan, goals, emergency, debts, user]);

  return { user, cloudStatus, lastSync, authError, loginGoogle, logoutGoogle, cloudEnabled, pushNow };
}
