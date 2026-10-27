import { useEffect, useRef, useState } from 'react';
import {
  auth, cloudEnabled, loginGoogle, logoutGoogle,
  onAuthStateChanged, getRedirectResult, userDoc, onSnapshot, setDoc, serverTimestamp,
} from './cloud.js';

const CLOUD_HISTORY_KEY = 'duitku.cloud.v1';
const cacheKey = (uid) => `duitku.cache.${uid}`;

const emptyState = () => ({
  transactions: [],
  budgets: [],
  accounts: [],
  plan: { gaji: 0, status: 'single', wajib: 0, custom: null },
  goals: [],
  emergency: { terkumpul: 0, targetManual: '' },
  debts: [],
  petty: [],
  profile: null,
});

const pickData = (d) => ({
  transactions: d.transactions ?? [],
  budgets: d.budgets ?? [],
  accounts: d.accounts ?? [],
  plan: d.plan ?? emptyState().plan,
  goals: d.goals ?? [],
  emergency: d.emergency ?? emptyState().emergency,
  debts: d.debts ?? [],
  petty: d.petty ?? [],
  profile: d.profile ?? null,
});

function readCache(uid) {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? pickData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function hasCloudHistory() {
  try {
    return Boolean(localStorage.getItem(CLOUD_HISTORY_KEY));
  } catch {
    return false;
  }
}

function markCloudHistory() {
  try {
    localStorage.setItem(CLOUD_HISTORY_KEY, '1');
  } catch { /* abaikan */ }
}

export function useCloudSync(slices) {
  const [user, setUser] = useState(null);
  const [cloudStatus, setCloudStatus] = useState(
    cloudEnabled ? 'siap — silakan login' : 'mode-lokal'
  );
  const [lastSync, setLastSync] = useState(null);
  const [authError, setAuthError] = useState('');

  const slicesRef = useRef(slices);
  slicesRef.current = slices;
  const pushing = useRef(false);
  const hydratedUid = useRef(null);
  const prevUid = useRef(null);
  const lastCloudJson = useRef('');

  const dataNow = () => {
    const s = slicesRef.current;
    return {
      transactions: s.transactions ?? [],
      budgets: s.budgets ?? [],
      accounts: s.accounts ?? [],
      plan: s.plan ?? emptyState().plan,
      goals: s.goals ?? [],
      emergency: s.emergency ?? emptyState().emergency,
      debts: s.debts ?? [],
      petty: s.petty ?? [],
      profile: s.profile ?? null,
    };
  };

  const apply = (data) => {
    const s = slicesRef.current;
    if (s.setTransactions) s.setTransactions(data.transactions);
    if (s.setBudgets) s.setBudgets(data.budgets);
    if (s.setAccounts) s.setAccounts(data.accounts);
    if (s.setPlan) s.setPlan(data.plan);
    if (s.setGoals) s.setGoals(data.goals);
    if (s.setEmg) s.setEmg(data.emergency);
    if (s.setDebts) s.setDebts(data.debts);
    if (s.setPetty) s.setPetty(data.petty);
    if (data.profile && s.setProfile) s.setProfile(data.profile);
  };

  const saveCache = (uid, data) => {
    try {
      localStorage.setItem(cacheKey(uid), JSON.stringify(data));
    } catch { /* abaikan */ }
  };

  const writeCloud = async (uid, data, email) => {
    pushing.current = true;
    setCloudStatus('menyimpan…');
    try {
      await setDoc(
        userDoc(uid),
        {
          ...data,
          updatedAt: serverTimestamp(),
          updatedBy: email || uid,
        },
        { merge: true }
      );
      lastCloudJson.current = JSON.stringify(data);
      saveCache(uid, data);
      markCloudHistory();
      setLastSync(new Date());
      setCloudStatus('tersambung ✓ sinkron');
    } finally {
      setTimeout(() => { pushing.current = false; }, 500);
    }
  };

  useEffect(() => {
    if (!cloudEnabled || !auth) return;
    setCloudStatus('mengecek login…');

    const handleUser = (u) => {
      const uid = u?.uid || null;
      const prev = prevUid.current;

      if (prev && prev !== uid) {
        saveCache(prev, dataNow());
        if (uid) {
          const cached = readCache(uid);
          if (cached) apply(cached);
          else apply(emptyState());
        } else {
          apply(emptyState());
        }
      }

      if (prev !== uid) hydratedUid.current = null;
      prevUid.current = uid;
      setUser(u || null);

      if (u) {
        setAuthError('');
        setCloudStatus('tersambung ✓ sinkron');
      } else {
        setCloudStatus('siap — silakan login');
      }
    };

    getRedirectResult(auth).catch((e) => {
      console.error('[auth redirect]', e);
      setAuthError(e?.code ? `${e.code}: ${e.message}` : String(e?.message || e));
      setCloudStatus('login gagal — lihat pesan merah');
    });

    const unsub = onAuthStateChanged(auth, handleUser, (e) => {
      console.error('[auth state]', e);
      setAuthError(String(e?.message || e));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!cloudEnabled || !user) return;
    const uid = user.uid;
    hydratedUid.current = null;
    setCloudStatus('menghubungkan…');
    let cancelled = false;

    const unsub = onSnapshot(
      userDoc(uid),
      async (snap) => {
        if (cancelled || pushing.current) return;

        if (snap.exists()) {
          const data = pickData(snap.data());
          apply(data);
          saveCache(uid, data);
          lastCloudJson.current = JSON.stringify(data);
          hydratedUid.current = uid;
          markCloudHistory();
          setLastSync(new Date());
          setCloudStatus('tersambung ✓ sinkron');
          return;
        }

        if (snap.metadata.fromCache) return;

        const existedBefore = hasCloudHistory();
        const data = existedBefore ? emptyState() : dataNow();
        try {
          await writeCloud(uid, data, user.email);
          if (cancelled) return;
          if (existedBefore) apply(data);
          hydratedUid.current = uid;
          setLastSync(new Date());
        } catch {
          setCloudStatus('gagal memulai cloud — cek koneksi/rules');
        }
      },
      () => setCloudStatus('gagal membaca cloud')
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  const pushNow = async () => {
    if (!cloudEnabled || !user) return;
    if (hydratedUid.current !== user.uid) return;
    try {
      await writeCloud(user.uid, dataNow(), user.email);
    } catch {
      setCloudStatus('gagal menyimpan — cek koneksi/rules');
    }
  };

  useEffect(() => {
    if (!cloudEnabled || !user) return;
    if (hydratedUid.current !== user.uid) return;
    if (pushing.current) return;

    const data = dataNow();
    if (JSON.stringify(data) === lastCloudJson.current) return;

    const t = setTimeout(async () => {
      if (hydratedUid.current !== user.uid) return;
      try {
        await writeCloud(user.uid, dataNow(), user.email);
      } catch {
        setCloudStatus('gagal menyimpan — cek koneksi/rules');
      }
    }, 1200);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slices.transactions, slices.budgets, slices.accounts, slices.plan, slices.goals, slices.emergency, slices.debts, slices.petty, slices.profile, user]);

  return { user, cloudStatus, lastSync, authError, loginGoogle, logoutGoogle, cloudEnabled, pushNow };
}
