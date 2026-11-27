// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInAnonymously,
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { 
  getFirestore, 
  disableNetwork,
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc,
  onSnapshot, 
  collection, 
  getDocs,
  query,
  where,
  limit,
  orderBy,
  startAfter,
  runTransaction 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  push,
  child,
  query as rtdbQuery,
  orderByChild,
  equalTo,
  limitToLast,
  runTransaction as rtdbRunTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCmtznxs_VO7hJFtBFABF4IXskhWb25yyo",
  authDomain: "taskads-f894a.firebaseapp.com",
  databaseURL: "https://taskads-f894a-default-rtdb.firebaseio.com",
  projectId: "taskads-f894a",
  storageBucket: "taskads-f894a.firebasestorage.app",
  messagingSenderId: "365573359165",
  appId: "1:365573359165:web:5733197eae26d52fe00c54",
  measurementId: "G-P95N2RG5NN"
};

// Initialize Firebase App
let app = null;
let analytics = null;
let db = null;
let auth = null;
let rtdb = null;

const FIRESTORE_QUOTA_COOLDOWN_KEY = 'tap_empire_fs_quota_until';
function isFirestoreQuotaBlocked() {
  try {
    const until = parseInt(sessionStorage.getItem(FIRESTORE_QUOTA_COOLDOWN_KEY) || '0', 10);
    return until > Date.now();
  } catch (e) {
    return false;
  }
}
function markFirestoreQuotaBlocked(err) {
  const code = String((err && err.code) || '').toLowerCase();
  const msg = String((err && err.message) || err || '');
  if (code === 'resource-exhausted' || /quota exceeded/i.test(msg)) {
    try {
      sessionStorage.setItem(FIRESTORE_QUOTA_COOLDOWN_KEY, String(Date.now() + 5 * 60 * 1000));
    } catch (e) {}
    if (db && typeof disableNetwork === 'function') {
      disableNetwork(db).catch(() => {});
    }
    return true;
  }
  return false;
}

try {
  app = initializeApp(firebaseConfig);
  console.log("%c[Firebase] Initialized with project: taskads-f894a", "color: #38bdf8; font-weight: bold;");

  // Analytics
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      window.firebaseAnalytics = analytics;
      if (window.Firebase) window.Firebase.analytics = analytics;
      console.log("%c[Firebase Analytics] Active", "color: #10b981; font-weight: bold;");
    }
  }).catch(() => {});

  // Cloud Firestore Database
  try {
    db = getFirestore(app);
    console.log("%c[Firebase Firestore] Connected", "color: #10b981; font-weight: bold;");
  } catch (err) {
    console.warn("[Firebase Firestore] Database init error:", err);
  }

  // Firebase Realtime Database
  try {
    rtdb = getDatabase(app);
    console.log("%c[Firebase RTDB] Connected to: " + firebaseConfig.databaseURL, "color: #10b981; font-weight: bold;");
  } catch (err) {
    console.warn("[Firebase RTDB] Database init error:", err);
  }

  // Firebase Authentication
  try {
    auth = getAuth(app);
    console.log("%c[Firebase Auth] Email/Password Ready", "color: #10b981; font-weight: bold;");
  } catch (err) {
    console.warn("[Firebase Auth] Auth init error:", err);
  }
} catch (e) {
  console.error("[Firebase] Initialization error:", e);
}

/**
 * Ensure Firebase Auth has an active user (existing or anonymous) before rule-protected writes.
 */
async function ensureFirebaseAuthReady(timeoutMs = 3000) {
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  try {
    const res = await Promise.race([
      signInAnonymously(auth),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AUTH_TIMEOUT')), timeoutMs))
    ]);
    return (res && res.user) || auth.currentUser || null;
  } catch (e) {
    return auth.currentUser || null;
  }
}

// Storage Keys
const TASKS_STORAGE_KEY = 'task_game_tasks';
const USERS_STORAGE_KEY = 'task_game_users';
const SYNC_FLAG_KEY = 'task_game_sync_flag';
const SYNC_CHANNEL_NAME = 'nova_task_sync';

// Initialize local defaults, resetting all balances (coins, stars, tickets) to 0
try {
  // Ensure all balances are reset to 0
  if (!localStorage.getItem('balance_zero_reset_v4')) {
    localStorage.setItem('task_game_coins', '0');
    localStorage.setItem('user_coins', '0');
    localStorage.setItem('task_game_coins_alt', '0');
    localStorage.setItem('task_game_stars', '0');
    localStorage.setItem('user_stars', '0');
    localStorage.setItem('task_user_tickets', '0');
    localStorage.setItem('user_tickets', '0');
    localStorage.setItem('task_game_tickets', '0');
    localStorage.setItem('balance_zero_reset_v4', 'true');
  }

  if (localStorage.getItem('task_game_coins') === null) localStorage.setItem('task_game_coins', '0');
  if (localStorage.getItem('task_game_stars') === null) localStorage.setItem('task_game_stars', '0');
  if (localStorage.getItem('user_coins') === null) localStorage.setItem('user_coins', '0');
  if (localStorage.getItem('user_stars') === null) localStorage.setItem('user_stars', '0');
  if (localStorage.getItem('task_user_tickets') === null) localStorage.setItem('task_user_tickets', '0');
  if (localStorage.getItem('user_tickets') === null) localStorage.setItem('user_tickets', '0');
  if (localStorage.getItem('task_game_tickets') === null) localStorage.setItem('task_game_tickets', '0');
  if (localStorage.getItem('completed_tasks_count') === null) localStorage.setItem('completed_tasks_count', '0');
  if (localStorage.getItem('ads_watched_count') === null) localStorage.setItem('ads_watched_count', '0');

  // Purge legacy mock data keys only once
  if (!localStorage.getItem('task_game_legacy_mock_cleared')) {
    localStorage.removeItem('task_game_stars_rating');
    const existingName = localStorage.getItem('player_username');
    if (!existingName || existingName.toLowerCase().includes('nova') || existingName === 'Demo User') {
      localStorage.setItem('player_username', 'Player');
    }
    if (!localStorage.getItem('player_avatar')) {
      localStorage.setItem('player_avatar', '⚡');
    }
    localStorage.setItem('task_game_legacy_mock_cleared', 'true');
  }
} catch (e) {}

// =============================================================================
// FIREBASE AUTHENTICATION (EMAIL & PASSWORD) & FIRESTORE USER SYNC
// =============================================================================

/**
 * Sign up a new user with Email and Password
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 */
async function signUpWithEmail(email, password, displayName = 'Player') {
  if (!auth) {
    return { success: false, error: 'Firebase Auth is not initialized.' };
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const user = userCredential.user;

    // Update Firebase Auth Display Name if provided
    if (displayName) {
      try {
        await updateProfile(user, { displayName: displayName.trim() });
      } catch (profileErr) {
        console.warn("[Firebase Auth] DisplayName update notice:", profileErr.message);
      }
    }

    // Initialize user record in Cloud Firestore: users/{uid}
    const initialCoins = parseInt(localStorage.getItem('user_coins') || '0', 10);
    const initialStars = parseInt(localStorage.getItem('user_stars') || '0', 10);
    const initialTasks = parseInt(localStorage.getItem('completed_tasks_count') || '0', 10);
    const initialAds = parseInt(localStorage.getItem('ads_watched_count') || '0', 10);
    const initialAvatar = localStorage.getItem('player_avatar') || '⚡';

    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: displayName || user.displayName || 'Player',
      avatar: initialAvatar,
      coins: initialCoins,
      stars: initialStars,
      tasksCompleted: initialTasks,
      adsWatched: initialAds,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (db) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, userData, { merge: true });
        console.log("%c[Firebase Firestore] Created user profile:", "color: #10b981; font-weight: bold;", user.uid);
      } catch (dbErr) {
        console.warn("[Firebase Firestore] Notice creating user document:", dbErr.message);
      }
    }

    // Cache locally
    localStorage.setItem('player_logged_in', 'true');
    localStorage.setItem('player_username', userData.displayName);
    localStorage.setItem('player_email', userData.email);
    localStorage.setItem('player_uid', userData.uid);
    localStorage.setItem('player_avatar', userData.avatar);

    notifyAuthChanged(user, userData);

    return { success: true, user, profile: userData };
  } catch (error) {
    console.error("[Firebase Auth] Sign up error:", error);
    return { success: false, code: error.code, error: formatAuthErrorMessage(error) };
  }
}

/**
 * Sign in an existing user with Email and Password
 * @param {string} email
 * @param {string} password
 */
async function signInWithEmail(email, password) {
  if (!auth) {
    return { success: false, error: 'Firebase Auth is not initialized.' };
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const user = userCredential.user;

    // Fetch user profile from Cloud Firestore
    let cloudData = null;
    if (db) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          cloudData = docSnap.data();
          console.log("%c[Firebase Firestore] Loaded user profile from cloud:", "color: #10b981; font-weight: bold;", cloudData);
        }
      } catch (dbErr) {
        console.warn("[Firebase Firestore] Notice fetching user document:", dbErr.message);
      }
    }

    // Apply cloud data to localStorage balances cleanly if available
    if (cloudData) {
      if (typeof cloudData.coins === 'number') {
        localStorage.setItem('user_coins', cloudData.coins.toString());
        localStorage.setItem('task_game_coins', cloudData.coins.toString());
      }
      if (typeof cloudData.stars === 'number') {
        localStorage.setItem('user_stars', cloudData.stars.toString());
        localStorage.setItem('task_game_stars', cloudData.stars.toString());
      }
      if (typeof cloudData.tickets === 'number') {
        localStorage.setItem('task_user_tickets', cloudData.tickets.toString());
        localStorage.setItem('user_tickets', cloudData.tickets.toString());
        localStorage.setItem('task_game_tickets', cloudData.tickets.toString());
      }
      if (typeof cloudData.diamonds === 'number') {
        localStorage.setItem('task_user_diamonds', cloudData.diamonds.toString());
        localStorage.setItem('user_diamonds', cloudData.diamonds.toString());
      }
      if (typeof cloudData.tasksCompleted === 'number') {
        localStorage.setItem('completed_tasks_count', cloudData.tasksCompleted.toString());
        localStorage.setItem('task_game_total_tasks_completed', cloudData.tasksCompleted.toString());
      }
      if (typeof cloudData.adsWatched === 'number') {
        localStorage.setItem('ads_watched_count', cloudData.adsWatched.toString());
        localStorage.setItem('task_game_ads_watched_count', cloudData.adsWatched.toString());
      }
      if (cloudData.displayName) localStorage.setItem('player_username', cloudData.displayName);
      if (cloudData.avatar) localStorage.setItem('player_avatar', cloudData.avatar);
    }

    localStorage.setItem('player_logged_in', 'true');
    localStorage.setItem('player_email', user.email);
    localStorage.setItem('player_uid', user.uid);
    if (!localStorage.getItem('player_username')) {
      localStorage.setItem('player_username', user.displayName || user.email.split('@')[0]);
    }

    startRealtimeUserSync(user.uid);
    initCloudBalances(user.uid);
    notifyAuthChanged(user, cloudData);

    return { success: true, user, profile: cloudData };
  } catch (error) {
    console.error("[Firebase Auth] Sign in error:", error);
    return { success: false, code: error.code, error: formatAuthErrorMessage(error) };
  }
}

/**
 * Sign out current authenticated user
 */
async function signOutUser() {
  if (!auth) {
    localStorage.setItem('player_logged_in', 'false');
    notifyAuthChanged(null, null);
    return { success: true };
  }
  try {
    await signOut(auth);
    localStorage.setItem('player_logged_in', 'false');
    notifyAuthChanged(null, null);
    return { success: true };
  } catch (error) {
    console.error("[Firebase Auth] Sign out error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset email
 */
async function sendPasswordReset(email) {
  if (!auth) return { success: false, error: 'Firebase Auth is not initialized.' };
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true };
  } catch (error) {
    return { success: false, error: formatAuthErrorMessage(error) };
  }
}

/**
 * Real-time listener for Auth State changes
 */
function subscribeToAuth(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const storedUid = localStorage.getItem('player_uid');
      let effectiveUid = user.uid;

      // Preserve existing persistent player ID so anonymous session refresh does not create a new blank user
      if (user.isAnonymous && storedUid && storedUid !== 'null' && storedUid !== 'undefined') {
        effectiveUid = storedUid;
      } else {
        localStorage.setItem('player_uid', user.uid);
      }

      localStorage.setItem('player_logged_in', 'true');
      if (user.email) localStorage.setItem('player_email', user.email);

      startRealtimeUserSync(effectiveUid);
      await initCloudBalances(effectiveUid);

      let profile = null;
      if (db) {
        try {
          const userDocRef = doc(db, 'users', effectiveUid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            profile = snap.data();
          }
        } catch (e) {}
      }

      if (typeof callback === 'function') callback(user, profile);
    } else {
      localStorage.setItem('player_logged_in', 'false');
      // If user logs out or session is pending, still sync using existing persistent player_uid
      const storedUid = localStorage.getItem('player_uid');
      if (storedUid && storedUid !== 'null' && storedUid !== 'undefined') {
        startRealtimeUserSync(storedUid);
        initCloudBalances(storedUid);
      }
      if (typeof callback === 'function') callback(null, null);
    }
  });
}

/**
 * Get or create persistent Unique ID for current player (supports Auth UID or device UID)
 * Ensures returning users always keep their existing user ID across visits
 */
function getEffectivePlayerUid() {
  // If authenticated with real account (e.g. Email/Password)
  if (auth && auth.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.uid) {
    localStorage.setItem('player_uid', auth.currentUser.uid);
    return auth.currentUser.uid;
  }
  // Otherwise check persistent localStorage
  let uid = localStorage.getItem('player_uid');
  if (uid && uid !== 'null' && uid !== 'undefined' && uid.trim() !== '') {
    return uid;
  }
  // If auth has anonymous user uid, use that
  if (auth && auth.currentUser && auth.currentUser.uid) {
    uid = auth.currentUser.uid;
    localStorage.setItem('player_uid', uid);
    return uid;
  }
  // Generate stable ID once
  uid = 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  localStorage.setItem('player_uid', uid);
  return uid;
}

let _prevDomCoins = null;
let _prevDomStars = null;
let _prevDomTickets = null;

function triggerPillGainEffect(type, diff) {
  try {
    const isCoins = type === 'coins' || type === 'coin' || type === 'coinPill';
    const isTickets = type === 'tickets' || type === 'ticket' || type === 'ticketPill';
    const isStars = type === 'stars' || type === 'star' || type === 'starPill';
    const pill = isCoins 
      ? (document.getElementById('coinPill') || document.querySelector('.coin-pill') || document.querySelector('.pill-gold') || document.getElementById('headerCoinDisplay') || document.getElementById('walletBalanceTop') || document.getElementById('userCoinsDisplay'))
      : isTickets
      ? (document.getElementById('ticketPill') || document.querySelector('.ticket-pill') || document.querySelector('.diamond-pill'))
      : (document.getElementById('starPill') || document.querySelector('.star-pill') || document.querySelector('.pill-star') || document.getElementById('headerStarDisplay') || document.getElementById('userStarsDisplay'));
    
    if (pill) {
      pill.style.transition = 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease';
      pill.style.transform = 'scale(1.2)';
      pill.style.boxShadow = isCoins 
        ? '0 0 20px rgba(250, 204, 21, 0.8), 0 0 35px rgba(56, 189, 248, 0.6)' 
        : isTickets
        ? '0 0 20px rgba(192, 132, 252, 0.8), 0 0 35px rgba(168, 85, 247, 0.6)'
        : '0 0 20px rgba(250, 204, 21, 0.9), 0 0 35px rgba(234, 179, 8, 0.7)';
      setTimeout(() => {
        pill.style.transform = 'scale(1)';
        pill.style.boxShadow = '';
      }, 260);

      if (diff && diff > 0) {
        const rect = pill.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const floatEl = document.createElement('div');
          floatEl.className = 'currency-gain-float';
          const icon = isCoins ? '🪙' : isTickets ? '🎟️' : '⭐';
          floatEl.textContent = `+${Number(diff || 0).toLocaleString()} ${icon}`;
          floatEl.style.position = 'fixed';
          floatEl.style.left = `${rect.left + rect.width / 4}px`;
          floatEl.style.top = `${rect.top - 6}px`;
          floatEl.style.zIndex = '999999';
          floatEl.style.fontSize = '13px';
          floatEl.style.fontWeight = '900';
          floatEl.style.color = '#34d399';
          floatEl.style.textShadow = '0 2px 8px rgba(0,0,0,0.9), 0 0 12px rgba(52,211,153,0.8)';
          floatEl.style.pointerEvents = 'none';
          floatEl.style.transition = 'all 0.95s cubic-bezier(0.16, 1, 0.3, 1)';
          floatEl.style.transform = 'translateY(0) scale(1)';
          floatEl.style.opacity = '1';
          document.body.appendChild(floatEl);

          requestAnimationFrame(() => {
            floatEl.style.transform = 'translateY(-28px) scale(1.1)';
            floatEl.style.opacity = '0';
          });
          setTimeout(() => floatEl.remove(), 1000);
        }
      }
    }
  } catch (e) {}
}

function triggerPillDeductionEffect(type, diff) {
  try {
    const isCoins = type === 'coins';
    const pill = isCoins 
      ? (document.getElementById('coinPill') || document.querySelector('.coin-pill') || document.querySelector('.pill-gold') || document.getElementById('headerCoinDisplay'))
      : (document.getElementById('starPill') || document.querySelector('.star-pill') || document.querySelector('.pill-star') || document.getElementById('headerStarDisplay'));
    
    if (pill) {
      pill.style.transition = 'transform 0.18s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
      pill.style.transform = 'scale(1.15)';
      setTimeout(() => {
        pill.style.transform = 'scale(1)';
      }, 200);

      const rect = pill.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const floatEl = document.createElement('div');
        floatEl.className = 'currency-deduct-float';
        floatEl.textContent = `-${Number(diff || 0).toLocaleString()} ${isCoins ? '🪙' : '⭐'}`;
        floatEl.style.position = 'fixed';
        floatEl.style.left = `${rect.left + rect.width / 4}px`;
        floatEl.style.top = `${rect.top + rect.height}px`;
        floatEl.style.zIndex = '999999';
        floatEl.style.fontSize = '12px';
        floatEl.style.fontWeight = '900';
        floatEl.style.color = isCoins ? '#f59e0b' : '#eab308';
        floatEl.style.textShadow = '0 2px 8px rgba(0,0,0,0.8), 0 0 10px rgba(245,158,11,0.5)';
        floatEl.style.pointerEvents = 'none';
        floatEl.style.transition = 'all 0.85s cubic-bezier(0.16, 1, 0.3, 1)';
        floatEl.style.transform = 'translateY(0) scale(1)';
        floatEl.style.opacity = '1';
        document.body.appendChild(floatEl);

        requestAnimationFrame(() => {
          floatEl.style.transform = 'translateY(24px) scale(0.9)';
          floatEl.style.opacity = '0';
        });
        setTimeout(() => floatEl.remove(), 900);
      }
    }
  } catch (e) {}
}

function triggerInsufficientFundsNotice(type, required, available) {
  try {
    const isCoins = type === 'coins';
    const pill = isCoins 
      ? (document.getElementById('coinPill') || document.querySelector('.coin-pill') || document.querySelector('.pill-gold'))
      : (document.getElementById('starPill') || document.querySelector('.star-pill') || document.querySelector('.pill-star'));
    
    if (pill) {
      pill.style.transition = 'all 0.15s ease';
      pill.style.filter = 'drop-shadow(0 0 10px rgba(239,68,68,0.9))';
      pill.style.transform = 'translateX(-5px)';
      setTimeout(() => { pill.style.transform = 'translateX(5px)'; }, 50);
      setTimeout(() => { pill.style.transform = 'translateX(-4px)'; }, 100);
      setTimeout(() => { pill.style.transform = 'translateX(0)'; pill.style.filter = ''; }, 250);
    }

    const toast = document.createElement('div');
    toast.className = 'insufficient-funds-toast';
    toast.innerHTML = `<span>❌ Need <b>${Number(required || 0).toLocaleString()}</b> ${isCoins ? '🪙 Coins' : '⭐ Stars'}! (You have <b>${Number(available || 0).toLocaleString()}</b>)</span>`;
    toast.style.position = 'fixed';
    toast.style.top = '65px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
    toast.style.zIndex = '999999';
    toast.style.background = 'rgba(15, 23, 42, 0.96)';
    toast.style.border = '1.5px solid #ef4444';
    toast.style.borderRadius = '9999px';
    toast.style.padding = '8px 18px';
    toast.style.color = '#fecaca';
    toast.style.fontSize = '12px';
    toast.style.fontWeight = '800';
    toast.style.boxShadow = '0 10px 25px -5px rgba(239, 68, 68, 0.5)';
    toast.style.pointerEvents = 'none';
    toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    toast.style.opacity = '0';
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-10px)';
      setTimeout(() => toast.remove(), 350);
    }, 2400);
  } catch (e) {}
}

/**
 * Update all DOM balance indicators across any active page and tab in real time
 */
function updateAllDomBalances(coins, stars, tickets, diamonds) {
  const c = typeof coins === 'number' ? coins : parseInt(localStorage.getItem('task_game_coins') || localStorage.getItem('user_coins') || '0', 10);
  const s = typeof stars === 'number' ? stars : parseInt(localStorage.getItem('task_game_stars') || localStorage.getItem('user_stars') || '0', 10);
  const t = typeof tickets === 'number' ? tickets : parseInt(localStorage.getItem('task_user_tickets') || localStorage.getItem('user_tickets') || localStorage.getItem('task_game_tickets') || '0', 10);
  const d = typeof diamonds === 'number' ? diamonds : parseInt(localStorage.getItem('task_user_diamonds') || localStorage.getItem('user_diamonds') || '0', 10);
  const coinsFmt = Number(c || 0).toLocaleString();
  const starsFmt = Number(s || 0).toLocaleString();
  const ticketsFmt = Number(t || 0).toLocaleString();
  const diamondsFmt = Number(d || 0).toLocaleString();

  if (_prevDomCoins !== null) {
    if (c < _prevDomCoins) triggerPillDeductionEffect('coins', _prevDomCoins - c);
    else if (c > _prevDomCoins) triggerPillGainEffect('coins', c - _prevDomCoins);
  }
  if (_prevDomStars !== null) {
    if (s < _prevDomStars) triggerPillDeductionEffect('stars', _prevDomStars - s);
    else if (s > _prevDomStars) triggerPillGainEffect('stars', s - _prevDomStars);
  }
  if (_prevDomTickets !== null) {
    if (t < _prevDomTickets) triggerPillDeductionEffect('tickets', _prevDomTickets - t);
    else if (t > _prevDomTickets) triggerPillGainEffect('tickets', t - _prevDomTickets);
  }
  _prevDomCoins = c;
  _prevDomStars = s;
  _prevDomTickets = t;

  // All known coin DOM IDs across all games, hub, shop, wallet, leaderboard, profile, admin
  const coinElements = [
    'userCoinsDisplay', 'headerCoinDisplay', 'gameCoinsDisplay', 'shopCoinsDisplayTop', 
    'shopCoinsDisplay', 'walletBalanceTop', 'walletCoinsTop', 'leaderboardCoinsTop', 
    'profileCoinsDisplay', 'userCoinsTop', 'headerCoins', 'statCoinsVal', 
    'playerCoinsDisplay', 'heroCoinsDisplay', 'lobbyCoinsDisplay', 'coinBalance',
    'manageModalCoinsDisplay', 'manageModalCoinsVal', 'editUserCoinsInput', 'adminLiveCoins', 'hudCoins',
    'helpBalanceTop'
  ];
  coinElements.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'INPUT') el.value = c;
      else if (id === 'adminLiveCoins') el.textContent = `${coinsFmt} 🪙`;
      else el.textContent = coinsFmt;
    }
  });

  // Query elements with class or data attributes for coin values
  try {
    document.querySelectorAll('.header-coin-val, .coin-value, [data-balance="coins"]').forEach(el => {
      if (el.tagName === 'INPUT') el.value = c;
      else el.textContent = coinsFmt;
    });
  } catch (e) {}

  // All known star DOM IDs across all games, hub, shop, wallet, leaderboard, profile, admin
  const starElements = [
    'userStarsDisplay', 'headerStarDisplay', 'gameStarsDisplay', 'shopStarsDisplayTop', 
    'shopStarsDisplay', 'walletStarsTop', 'leaderboardStarsTop', 'profileStarsDisplay', 
    'userStarsTop', 'statStarsVal', 'headerStars', 
    'playerStarsDisplay', 'lobbyStarsDisplay', 'starBalance',
    'manageModalStarsDisplay', 'manageModalStarsVal', 'editUserStarsInput', 'adminLiveStars', 'hudStars',
    'helpStarsTop'
  ];
  starElements.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'INPUT') el.value = s;
      else if (id === 'adminLiveStars') el.textContent = `${starsFmt} ⭐`;
      else el.textContent = starsFmt;
    }
  });

  // Query elements with class or data attributes for star values
  try {
    document.querySelectorAll('.header-star-val, .star-value, [data-balance="stars"]').forEach(el => {
      if (el.tagName === 'INPUT') el.value = s;
      else el.textContent = starsFmt;
    });
  } catch (e) {}

  // All known ticket DOM IDs across all games, hub, shop, wallet, leaderboard, profile, admin
  const ticketElements = [
    'hudTickets', 'shopTicketsDisplay', 'unlockModalUserTicketsText', 'userTicketsDisplay',
    'headerTickets', 'statTicketsVal', 'streakTicketsVal', 'playerTicketsDisplay', 
    'lobbyTicketsDisplay', 'ticketBalance', 'manageModalTicketsDisplay', 'modalTicketsTotalText'
  ];
  ticketElements.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'INPUT') el.value = t;
      else if (id === 'adminLiveTickets') el.textContent = `${ticketsFmt} 🎟️`;
      else el.textContent = ticketsFmt;
    }
  });

  try {
    document.querySelectorAll('.header-ticket-val, .ticket-value, [data-balance="tickets"]').forEach(el => {
      if (el.tagName === 'INPUT') el.value = t;
      else el.textContent = ticketsFmt;
    });
  } catch (e) {}

  // All known diamond DOM IDs across Quiz / Header / Home / Profile
  const diamondElements = [
    'hudDiamonds', 'userDiamondsDisplay', 'headerDiamondsDisplay', 'shopDiamondsDisplay',
    'streakDiamondsVal', 'playerDiamondsDisplay', 'diamondBalance'
  ];
  diamondElements.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'INPUT') el.value = d;
      else el.textContent = diamondsFmt;
    }
  });

  try {
    document.querySelectorAll('.header-diamond-val, .diamond-value, [data-balance="diamonds"]').forEach(el => {
      if (el.tagName === 'INPUT') el.value = d;
      else el.textContent = diamondsFmt;
    });
  } catch (e) {}

  try {
    if (typeof window.syncAllHeaderPlayerAvatars === 'function') {
      window.syncAllHeaderPlayerAvatars();
    }
  } catch (e) {}
}
window.updateAllDomBalances = updateAllDomBalances;

// =============================================================================
// SHARED 3D BORDERLESS STICKER AVATAR SYSTEM
// =============================================================================
window.TAP_AVATARS = [
  { id: 'avatar-1.png', label: 'Ninja', fallbackEmoji: '⚡' },
  { id: 'avatar-2.png', label: 'Prince', fallbackEmoji: '👑' },
  { id: 'avatar-3.png', label: 'Fox', fallbackEmoji: '🦊' },
  { id: 'avatar-4.png', label: 'Lion', fallbackEmoji: '🦁' },
  { id: 'avatar-5.png', label: 'Robot', fallbackEmoji: '🤖' },
  { id: 'avatar-6.png', label: 'Gem', fallbackEmoji: '💎' },
  { id: 'avatar-7.png', label: 'Astronaut', fallbackEmoji: '🚀' },
  { id: 'avatar-8.png', label: 'Tiger', fallbackEmoji: '🐯' }
];

const AVATAR_LEGACY_MAP = {
  '⚡': 'avatar-1.png',
  '🥷': 'avatar-1.png',
  '🛡️': 'avatar-1.png',
  '👑': 'avatar-2.png',
  '💰': 'avatar-2.png',
  '🎁': 'avatar-2.png',
  '⭐': 'avatar-2.png',
  '🦊': 'avatar-3.png',
  '🦁': 'avatar-4.png',
  '🤖': 'avatar-5.png',
  '💻': 'avatar-5.png',
  '🎮': 'avatar-5.png',
  '💎': 'avatar-6.png',
  '🛍️': 'avatar-6.png',
  '🚀': 'avatar-7.png',
  '👤': 'avatar-7.png',
  '🐯': 'avatar-8.png',
  '🎯': 'avatar-8.png',
  '🔥': 'avatar-8.png'
};

window.resolvePlayerAvatarFile = function resolvePlayerAvatarFile(raw) {
  const s = String(raw || '').trim();
  const match = s.match(/avatar-([1-8])\.png/i);
  if (match) return `avatar-${match[1]}.png`;
  if (AVATAR_LEGACY_MAP[s]) return AVATAR_LEGACY_MAP[s];
  return 'avatar-1.png';
};

window.getPlayerAvatarSrc = function getPlayerAvatarSrc(raw, basePrefix) {
  const file = window.resolvePlayerAvatarFile(raw);
  let prefix = basePrefix;
  if (!prefix) {
    const isAdmin = typeof window !== 'undefined' && window.location && /\/admin(\/|$)/i.test(window.location.pathname || '');
    prefix = isAdmin ? '../frontend/assets/avatars/' : '../../assets/avatars/';
  }
  return `${prefix}${file}`;
};

window.getPlayerAvatarImgHtml = function getPlayerAvatarImgHtml(raw, sizePx = 36, basePrefix = '') {
  const src = window.getPlayerAvatarSrc(raw, basePrefix);
  const px = Number(sizePx) || 36;
  return `<img src="${src}" alt="Avatar" class="sticker-3d-avatar-img" style="width:${px}px;height:${px}px;object-fit:contain;display:block;background:transparent;border:none;border-radius:0;box-shadow:none;pointer-events:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));" />`;
};

window.renderPlayerAvatarEl = function renderPlayerAvatarEl(el, raw, sizePx = 36, basePrefix = '') {
  if (!el) return;
  el.style.background = 'transparent';
  el.style.border = 'none';
  el.style.boxShadow = 'none';
  el.style.borderRadius = '0';
  el.innerHTML = window.getPlayerAvatarImgHtml(raw, sizePx, basePrefix);
};

window.syncAllHeaderPlayerAvatars = function syncAllHeaderPlayerAvatars() {
  if (typeof document === 'undefined') return;
  const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem('player_avatar') : '') || 'avatar-1.png';
  document.querySelectorAll('.user-avatar, #headerUserAvatar').forEach((el) => {
    if (!el || el.tagName === 'BUTTON' || (el.getAttribute('onclick') || '').includes('navigateBack')) return;
    if (el.closest && el.closest('#adminTopHeaderBar')) return;
    window.renderPlayerAvatarEl(el, saved, 36);
  });
};

// Global Escape Key Listener for Dialog / Modal Dismissals
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      const modalSelectors = [
        '#globalBalanceManagerModal',
        '#rewardedAdModalOverlay',
        '#taskPrizePopupOverlay',
        '#taskVerifyModalOverlay',
        '#taskUnlockModalOverlay',
        '#vipSubscriptionModal',
        '#buyModalOverlay',
        '#voucherModalOverlay',
        '#shopAdModal',
        '#taskPassRoadmapModalOverlay',
        '#activatePassModalOverlay',
        '#leaderboardUserEditModalOverlay',
        '#rollShopSheet',
        '#dailyStreakModalOverlay',
        '#dailyStreakModal',
        '#taskModalOverlay',
        '#userEditModalOverlay',
        '#withdrawCreateModalOverlay',
        '#withdrawApproveModalOverlay'
      ];
      modalSelectors.forEach(sel => {
        try {
          const el = document.querySelector(sel);
          if (el && (el.style.display !== 'none' || el.classList.contains('active'))) {
            el.style.display = 'none';
            el.classList.remove('active');
          }
        } catch(err) {}
      });

      try { if (typeof window.closeVerifyModal === 'function') window.closeVerifyModal(); } catch(err) {}
      try { if (typeof window.closeTaskPrizePopup === 'function') window.closeTaskPrizePopup(); } catch(err) {}
      try { if (typeof window.closeTaskUnlockModal === 'function') window.closeTaskUnlockModal(); } catch(err) {}
      try { if (typeof window.closeSubscriptionModal === 'function') window.closeSubscriptionModal(); } catch(err) {}
      try { if (typeof window.closeBuyModal === 'function') window.closeBuyModal(); } catch(err) {}
      try { if (typeof window.closeVoucherModal === 'function') window.closeVoucherModal(); } catch(err) {}
      try { if (typeof window.closeLeaderboardUserEditModal === 'function') window.closeLeaderboardUserEditModal(); } catch(err) {}
      try { if (typeof window.closeTaskPassRoadmapModal === 'function') window.closeTaskPassRoadmapModal(); } catch(err) {}
      try { if (typeof window.closeActivatePassModal === 'function') window.closeActivatePassModal(); } catch(err) {}
      try { if (typeof window.closeDailyStreakModal === 'function') window.closeDailyStreakModal(); } catch(err) {}
      try { if (typeof window.closeTaskModal === 'function') window.closeTaskModal(); } catch(err) {}
      try { if (typeof window.closeUserEditModal === 'function') window.closeUserEditModal(); } catch(err) {}
      try { if (typeof window.closeWithdrawCreateModal === 'function') window.closeWithdrawCreateModal(); } catch(err) {}
      try { if (typeof window.closeWithdrawApproveModal === 'function') window.closeWithdrawApproveModal(); } catch(err) {}
      try { if (typeof window.closeBalanceManageModal === 'function') window.closeBalanceManageModal(); } catch(err) {}
    }
  });
}

// Flag to prevent recursive cloud sync loops when updating from Firestore
let isInternalSync = false;
const rawSetItem = localStorage.setItem.bind(localStorage);

const CLOUD_STATE_SYNC_KEYS = new Set([
  'task_game_shop_unlocks',
  'task_daily_streak_count',
  'task_daily_streak_last_date',
  'task_daily_streak_penalty_date',
  'task_game_daily_streak_v2',
  'season_6_pass_activated',
  'season_battle_pass_claimed',
  'task_pass_level',
  'task_pass_total_completed',
  'referral_star_milestones_claimed',
  'user_referral_code',
  'task_game_user_referral_code',
  'task_game_referrals_list',
  'task_referral_count',
  'user_support_tickets',
  'task_vip_pass_active',
  'tap_empire_vip_plan',
  'tap_empire_daily_progression',
  'tap_empire_category_daily_counts',
  'tap_empire_common_completed_ids',
  'tap_empire_google_completed_ids',
  'tap_empire_star_unlocked_costs',
  'tap_empire_pro_group_state',
  'tap_empire_pending_prizes',
  'task_completed_tasks',
  'task_unlocked_tasks',
  'wallet_claimed_offers',
  'wallet_ultra_task_credits',
  'wallet_ultra_total_completed'
]);

// Auto-intercept localStorage.setItem for currency & progression keys to keep keys in sync and trigger cloud save
localStorage.setItem = function(key, val) {
  rawSetItem(key, val);
  if (isInternalSync) return;

  if (key === 'task_game_coins' || key === 'user_coins' || key === 'task_game_stars' || key === 'user_stars' || key === 'task_user_tickets' || key === 'user_tickets' || key === 'task_game_tickets' || key === 'task_user_diamonds' || key === 'user_diamonds') {
    isInternalSync = true;
    try {
      if (key === 'task_game_coins') rawSetItem('user_coins', val);
      else if (key === 'user_coins') rawSetItem('task_game_coins', val);
      else if (key === 'task_game_stars') rawSetItem('user_stars', val);
      else if (key === 'user_stars') rawSetItem('task_game_stars', val);
      else if (key === 'task_user_tickets') {
        rawSetItem('user_tickets', val);
        rawSetItem('task_game_tickets', val);
      } else if (key === 'user_tickets') {
        rawSetItem('task_user_tickets', val);
        rawSetItem('task_game_tickets', val);
      } else if (key === 'task_game_tickets') {
        rawSetItem('task_user_tickets', val);
        rawSetItem('user_tickets', val);
      } else if (key === 'task_user_diamonds') {
        rawSetItem('user_diamonds', val);
      } else if (key === 'user_diamonds') {
        rawSetItem('task_user_diamonds', val);
      }
    } catch (e) {}
    isInternalSync = false;

    updateAllDomBalances();
    // Debounced cloud profile save on currency mutation (prevents write storms)
    scheduleCloudBalanceSync(1200);

    try {
      const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
      ch.postMessage({ type: 'BALANCES_UPDATED', key, val, timestamp: Date.now() });
      ch.close();
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('balance:changed', {
      detail: {
        coins: parseInt(localStorage.getItem('task_game_coins') || '0', 10),
        stars: parseInt(localStorage.getItem('task_game_stars') || '0', 10),
        tickets: parseInt(localStorage.getItem('task_user_tickets') || localStorage.getItem('user_tickets') || localStorage.getItem('task_game_tickets') || '0', 10),
        diamonds: parseInt(localStorage.getItem('task_user_diamonds') || localStorage.getItem('user_diamonds') || '0', 10),
        key,
        val
      }
    }));
  } else if (CLOUD_STATE_SYNC_KEYS.has(key)) {
    scheduleCloudBalanceSync(1200);
  }
};

/**
 * Save current user profile & balances to Firestore & RTDB (users/{uid})
 */
async function saveCurrentProfileToFirestore(userInstance = null) {
  if (!db && !rtdb) return false;
  if (auth && !auth.currentUser) {
    await ensureFirebaseAuthReady(2500);
  }
  const currentUser = userInstance || (auth ? auth.currentUser : null);
  const uid = currentUser ? currentUser.uid : getEffectivePlayerUid();
  if (!uid) return false;

  try {
    const coinsRaw = localStorage.getItem('task_game_coins') || localStorage.getItem('user_coins') || '0';
    const starsRaw = localStorage.getItem('task_game_stars') || localStorage.getItem('user_stars') || '0';
    const ticketsRaw = localStorage.getItem('task_user_tickets') || localStorage.getItem('user_tickets') || localStorage.getItem('task_game_tickets') || '0';
    const diamondsRaw = localStorage.getItem('task_user_diamonds') || localStorage.getItem('user_diamonds') || '0';
    const tasksRaw = localStorage.getItem('completed_tasks_count') || localStorage.getItem('task_game_total_tasks_completed') || '0';
    const eventTasksRaw = localStorage.getItem('task_game_event_tasks_count') || localStorage.getItem('task_game_event_tasks') || '0';
    const adsRaw = localStorage.getItem('ads_watched_count') || localStorage.getItem('task_game_ads_watched_count') || '0';
    const passLevelRaw = localStorage.getItem('task_pass_level') || '1';
    const passTotalRaw = localStorage.getItem('task_pass_total_completed') || '0';

    const coins = parseInt(coinsRaw, 10);
    const stars = parseInt(starsRaw, 10);
    const tickets = parseInt(ticketsRaw, 10);
    const diamonds = parseInt(diamondsRaw, 10);
    const tasksCompleted = parseInt(tasksRaw, 10);
    const eventTasks = parseInt(eventTasksRaw, 10);
    const adsWatched = parseInt(adsRaw, 10);
    const passLevel = parseInt(passLevelRaw, 10);
    const passTotalCompleted = parseInt(passTotalRaw, 10);
    const displayName = localStorage.getItem('player_username') || (currentUser ? currentUser.displayName : 'Player');
    const avatar = localStorage.getItem('player_avatar') || '⚡';
    const authUid = (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : '';
    let email = currentUser && currentUser.email ? currentUser.email : (localStorage.getItem('player_email') || '');
    if (!email || !email.includes('@')) {
      email = `${String(uid).replace(/[^a-zA-Z0-9]/g, '')}@player.app`;
    }

    const safeJson = (k) => {
      try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; }
    };

    const userPayload = {
      uid: String(uid),
      id: String(uid),
      ownerAuthUid: authUid || String(uid),
      email: email,
      displayName: displayName,
      name: displayName,
      displayNameLower: String(displayName || '').trim().toLowerCase(),
      avatar: avatar,
      coins: isNaN(coins) ? 0 : Math.max(0, coins),
      stars: isNaN(stars) ? 0 : Math.max(0, stars),
      tickets: isNaN(tickets) ? 0 : Math.max(0, tickets),
      diamonds: isNaN(diamonds) ? 0 : Math.max(0, diamonds),
      ultraCredits: Math.max(0, parseInt(localStorage.getItem('wallet_ultra_task_credits') || '0', 10) || 0),
      ultraTotalCompleted: Math.max(0, parseInt(localStorage.getItem('wallet_ultra_total_completed') || '0', 10) || 0),
      claimedWalletOffers: safeJson('wallet_claimed_offers') || {},
      tasksCompleted: isNaN(tasksCompleted) ? 0 : Math.max(0, tasksCompleted),
      totalTasks: isNaN(tasksCompleted) ? 0 : Math.max(0, tasksCompleted),
      eventTasks: isNaN(eventTasks) ? 0 : Math.max(0, eventTasks),
      passLevel: isNaN(passLevel) ? 1 : Math.max(1, Math.min(500, passLevel)),
      passTotalCompleted: isNaN(passTotalCompleted) ? 0 : Math.max(0, passTotalCompleted),
      adsWatched: isNaN(adsWatched) ? 0 : Math.max(0, adsWatched),
      completedTasks: safeJson('task_completed_tasks') || {},
      unlockedTasks: safeJson('task_unlocked_tasks') || {},
      commonCompletedIds: safeJson('tap_empire_common_completed_ids') || {},
      googleCompletedIds: safeJson('tap_empire_google_completed_ids') || [],
      starUnlockedCosts: safeJson('tap_empire_star_unlocked_costs') || {},
      proGroupState: safeJson('tap_empire_pro_group_state') || {},
      pendingPrizes: safeJson('tap_empire_pending_prizes') || {},
      dailyStreak: safeJson('task_game_daily_streak_v2') || {},
      dailyStreakCount: Math.max(0, parseInt(localStorage.getItem('task_daily_streak_count') || '0', 10) || 0),
      dailyStreakLastDate: String(localStorage.getItem('task_daily_streak_last_date') || ''),
      dailyStreakPenaltyDate: String(localStorage.getItem('task_daily_streak_penalty_date') || ''),
      dailyProgression: safeJson('tap_empire_daily_progression') || {},
      vipPlan: safeJson('tap_empire_vip_plan') || null,
      vipPassActive: localStorage.getItem('task_vip_pass_active') === 'true',
      categoryDailyCounts: safeJson('tap_empire_category_daily_counts') || {},
      shopUnlocks: safeJson('task_game_shop_unlocks') || {},
      passActivated: localStorage.getItem('season_6_pass_activated') === 'true',
      passClaimed: safeJson('season_battle_pass_claimed') || {},
      referralMilestonesClaimed: safeJson('referral_star_milestones_claimed') || {},
      userReferralCode: String(localStorage.getItem('user_referral_code') || localStorage.getItem('task_game_user_referral_code') || ''),
      referralsList: safeJson('task_game_referrals_list') || [],
      referralCount: Math.max(0, parseInt(localStorage.getItem('task_referral_count') || '0', 10) || 0),
      supportTickets: safeJson('user_support_tickets') || [],
      sunflowerState: localStorage.getItem('sunflower_game_state') || null,
      honeyBeeState: localStorage.getItem('honeybee_game_state') || null,
      gameStats: {
        gamesPlayed: parseInt(localStorage.getItem('task_games_played') || '0', 10),
        coinsWonToday: parseInt(localStorage.getItem('task_coins_won_today') || '0', 10),
        winStreak: parseInt(localStorage.getItem('task_win_streak') || '0', 10)
      },
      updatedAt: Date.now()
    };

    if (db && !isFirestoreQuotaBlocked()) {
      const userRef = doc(db, 'users', String(uid));
      await setDoc(userRef, userPayload, { merge: true });
    }

    if (rtdb) {
      try {
        await update(ref(rtdb, 'users/' + String(uid)), userPayload);
      } catch(rtdbErr) {
        console.warn("[Firebase RTDB] RTDB update user notice:", rtdbErr.message);
      }
    }

    return true;
  } catch (err) {
    markFirestoreQuotaBlocked(err);
    console.warn("[Firebase] Could not save profile to cloud:", err.message);
    return false;
  }
}

let _lastUserCloudAppliedAt = 0;

function applyIncomingUserCloudData(data, { forceBalanceEvents = false } = {}) {
  if (!data || typeof data !== 'object') return false;
  const incomingUpdatedAt = Number(data.updatedAt || data.lastActive || 0) || 0;
  if (_lastUserCloudAppliedAt > 0 && incomingUpdatedAt > 0 && incomingUpdatedAt + 1000 < _lastUserCloudAppliedAt) {
    return false;
  }
  if (incomingUpdatedAt > _lastUserCloudAppliedAt) {
    _lastUserCloudAppliedAt = incomingUpdatedAt;
  }

  const localLastReset = parseInt(localStorage.getItem('task_game_last_reset_at') || '0', 10) || 0;
  if (data.resetAt && Number(data.resetAt) > localLastReset) {
    resetLocalPlayerSessionKeys();
    rawSetItem('task_game_last_reset_at', String(data.resetAt));
  }

  let changed = forceBalanceEvents;
  const currentCoins = parseInt(localStorage.getItem('task_game_coins') || '0', 10) || 0;
  const currentStars = parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0;
  const currentTickets = parseInt(localStorage.getItem('task_user_tickets') || '0', 10) || 0;
  const currentDiamonds = parseInt(localStorage.getItem('task_user_diamonds') || '0', 10) || 0;

  isInternalSync = true;
  try {
    if (typeof data.coins === 'number') {
      if (data.coins !== currentCoins) changed = true;
      rawSetItem('task_game_coins', data.coins.toString());
      rawSetItem('user_coins', data.coins.toString());
      rawSetItem('task_game_coins_alt', data.coins.toString());
    }
    if (typeof data.stars === 'number') {
      if (data.stars !== currentStars) changed = true;
      rawSetItem('task_game_stars', data.stars.toString());
      rawSetItem('user_stars', data.stars.toString());
    }
    if (typeof data.tickets === 'number') {
      if (data.tickets !== currentTickets) changed = true;
      rawSetItem('task_user_tickets', data.tickets.toString());
      rawSetItem('user_tickets', data.tickets.toString());
      rawSetItem('task_game_tickets', data.tickets.toString());
    }
    if (typeof data.diamonds === 'number') {
      if (data.diamonds !== currentDiamonds) changed = true;
      rawSetItem('task_user_diamonds', data.diamonds.toString());
      rawSetItem('user_diamonds', data.diamonds.toString());
    }
    if (data.completedTasks && typeof data.completedTasks === 'object') {
      rawSetItem('task_completed_tasks', JSON.stringify(data.completedTasks));
      rawSetItem('task_game_completed_tasks', JSON.stringify(data.completedTasks));
    }
    if (data.unlockedTasks && typeof data.unlockedTasks === 'object') {
      rawSetItem('task_unlocked_tasks', JSON.stringify(data.unlockedTasks));
    }
    if (data.commonCompletedIds && typeof data.commonCompletedIds === 'object') {
      rawSetItem('tap_empire_common_completed_ids', JSON.stringify(data.commonCompletedIds));
    }
    if (Array.isArray(data.googleCompletedIds)) {
      rawSetItem('tap_empire_google_completed_ids', JSON.stringify(data.googleCompletedIds));
    }
    if (data.starUnlockedCosts && typeof data.starUnlockedCosts === 'object') {
      rawSetItem('tap_empire_star_unlocked_costs', JSON.stringify(data.starUnlockedCosts));
    }
    if (data.proGroupState && typeof data.proGroupState === 'object') {
      rawSetItem('tap_empire_pro_group_state', JSON.stringify(data.proGroupState));
    }
    if (data.dailyStreak && typeof data.dailyStreak === 'object' && Object.keys(data.dailyStreak).length > 0) {
      rawSetItem('task_game_daily_streak_v2', JSON.stringify(data.dailyStreak));
    }
    if (data.dailyProgression && typeof data.dailyProgression === 'object') {
      rawSetItem('tap_empire_daily_progression', JSON.stringify(data.dailyProgression));
    }
    if (data.vipPlan && typeof data.vipPlan === 'object') {
      rawSetItem('tap_empire_vip_plan', JSON.stringify(data.vipPlan));
    }
    if (data.categoryDailyCounts && typeof data.categoryDailyCounts === 'object') {
      rawSetItem('tap_empire_category_daily_counts', JSON.stringify(data.categoryDailyCounts));
    }
    if (typeof data.ultraCredits === 'number') {
      rawSetItem('wallet_ultra_task_credits', String(Math.max(0, data.ultraCredits)));
      changed = true;
    }
    if (typeof data.ultraTotalCompleted === 'number') {
      rawSetItem('wallet_ultra_total_completed', String(Math.max(0, data.ultraTotalCompleted)));
    }
    if (data.claimedWalletOffers && typeof data.claimedWalletOffers === 'object') {
      rawSetItem('wallet_claimed_offers', JSON.stringify(data.claimedWalletOffers));
      if (data.claimedWalletOffers.one_time_offer) {
        rawSetItem('wallet_one_time_offer_claimed', 'true');
      }
      changed = true;
    }
    const resolvedTasksComp = typeof data.tasksCompleted === 'number' ? data.tasksCompleted : data.totalTasks;
    if (typeof resolvedTasksComp === 'number') {
      rawSetItem('completed_tasks_count', resolvedTasksComp.toString());
      rawSetItem('task_game_total_tasks_completed', resolvedTasksComp.toString());
    }
    if (typeof data.eventTasks === 'number') {
      rawSetItem('task_game_event_tasks_count', data.eventTasks.toString());
      rawSetItem('task_game_event_tasks', data.eventTasks.toString());
    }
    if (typeof data.passLevel === 'number') {
      rawSetItem('task_pass_level', String(Math.max(1, Math.min(500, data.passLevel))));
    }
    if (typeof data.passTotalCompleted === 'number') {
      rawSetItem('task_pass_total_completed', String(Math.max(0, data.passTotalCompleted)));
    }
    if (typeof data.adsWatched === 'number') {
      rawSetItem('ads_watched_count', data.adsWatched.toString());
      rawSetItem('task_game_ads_watched_count', data.adsWatched.toString());
    }
    if (data.displayName && data.displayName !== 'Player') {
      rawSetItem('player_username', data.displayName);
    }
    if (data.avatar) {
      rawSetItem('player_avatar', data.avatar);
    }
    if (typeof data.vipPassActive === 'boolean') {
      rawSetItem('task_vip_pass_active', data.vipPassActive ? 'true' : 'false');
    }
    if (data.shopUnlocks && typeof data.shopUnlocks === 'object') {
      rawSetItem('task_game_shop_unlocks', JSON.stringify(data.shopUnlocks));
      changed = true;
    }
    if (typeof data.passActivated === 'boolean') {
      rawSetItem('season_6_pass_activated', data.passActivated ? 'true' : 'false');
      changed = true;
    }
    if (data.passClaimed && typeof data.passClaimed === 'object') {
      rawSetItem('season_battle_pass_claimed', JSON.stringify(data.passClaimed));
      changed = true;
    }
    if (data.pendingPrizes && typeof data.pendingPrizes === 'object') {
      rawSetItem('tap_empire_pending_prizes', JSON.stringify(data.pendingPrizes));
      changed = true;
    }
    if (typeof data.dailyStreakCount === 'number') {
      const syncedStreakStr = String(Math.max(0, data.dailyStreakCount));
      rawSetItem('task_daily_streak_count', syncedStreakStr);
      rawSetItem('task_game_streak_days', syncedStreakStr);
      rawSetItem('user_streak_days', syncedStreakStr);
    }
    if (typeof data.dailyStreakLastDate === 'string' && data.dailyStreakLastDate) {
      rawSetItem('task_daily_streak_last_date', data.dailyStreakLastDate);
    }
    if (typeof data.dailyStreakPenaltyDate === 'string' && data.dailyStreakPenaltyDate) {
      rawSetItem('task_daily_streak_penalty_date', data.dailyStreakPenaltyDate);
    }
    if (data.referralMilestonesClaimed && typeof data.referralMilestonesClaimed === 'object') {
      rawSetItem('referral_star_milestones_claimed', JSON.stringify(data.referralMilestonesClaimed));
    }
    if (typeof data.userReferralCode === 'string' && data.userReferralCode) {
      rawSetItem('user_referral_code', data.userReferralCode);
      rawSetItem('task_game_user_referral_code', data.userReferralCode);
    }
    if (Array.isArray(data.referralsList) && data.referralsList.length > 0) {
      rawSetItem('task_game_referrals_list', JSON.stringify(data.referralsList));
    }
    if (typeof data.referralCount === 'number') {
      rawSetItem('task_referral_count', String(Math.max(0, data.referralCount)));
    }
    if (Array.isArray(data.supportTickets) && data.supportTickets.length > 0) {
      rawSetItem('user_support_tickets', JSON.stringify(data.supportTickets));
    }
    if (data.sunflowerState) {
      rawSetItem('sunflower_game_state', typeof data.sunflowerState === 'string' ? data.sunflowerState : JSON.stringify(data.sunflowerState));
    }
    if (data.honeyBeeState) {
      rawSetItem('honeybee_game_state', typeof data.honeyBeeState === 'string' ? data.honeyBeeState : JSON.stringify(data.honeyBeeState));
    }
    if (data.gameStats) {
      if (typeof data.gameStats.gamesPlayed === 'number') rawSetItem('task_games_played', data.gameStats.gamesPlayed.toString());
      if (typeof data.gameStats.coinsWonToday === 'number') rawSetItem('task_coins_won_today', data.gameStats.coinsWonToday.toString());
      if (typeof data.gameStats.winStreak === 'number') rawSetItem('task_win_streak', data.gameStats.winStreak.toString());
    }
  } finally {
    isInternalSync = false;
  }

  updateAllDomBalances();

  window.dispatchEvent(new CustomEvent('streak:updated', { detail: { streak: parseInt(localStorage.getItem('task_daily_streak_count') || '0', 10) || 0 } }));
  window.dispatchEvent(new CustomEvent('profile:cloudSynced', { detail: data }));

  if (changed) {
    try {
      const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
      ch.postMessage({ type: 'COINS_SYNCED', timestamp: Date.now() });
      ch.close();
    } catch (e) {}

    const nextCoins = typeof data.coins === 'number' ? data.coins : currentCoins;
    const nextStars = typeof data.stars === 'number' ? data.stars : currentStars;
    const nextTickets = typeof data.tickets === 'number' ? data.tickets : currentTickets;
    const nextDiamonds = typeof data.diamonds === 'number' ? data.diamonds : currentDiamonds;

    if (forceBalanceEvents) {
      window.dispatchEvent(new CustomEvent('balance:synced', {
        detail: { coins: nextCoins, stars: nextStars, tickets: nextTickets, diamonds: nextDiamonds }
      }));
    }
    window.dispatchEvent(new CustomEvent('balance:changed', {
      detail: { coins: nextCoins, stars: nextStars, tickets: nextTickets, diamonds: nextDiamonds }
    }));
  }
  return true;
}

/**
 * Fetch latest balances and stats from Firestore + RTDB fallback on page open
 */
async function initCloudBalances(targetUid = null) {
  if (!db && !rtdb) return;
  if (auth && !auth.currentUser) {
    await ensureFirebaseAuthReady(2500);
  }
  const uid = targetUid || getEffectivePlayerUid();
  if (!uid) return;

  try {
    let fsData = null;
    let rtData = null;

    if (db && !isFirestoreQuotaBlocked()) {
      try {
        const snap = await getDoc(doc(db, 'users', String(uid)));
        if (snap.exists()) fsData = snap.data() || null;
      } catch (fsErr) {
        markFirestoreQuotaBlocked(fsErr);
      }
    }

    if (rtdb) {
      try {
        const rSnap = await get(ref(rtdb, 'users/' + String(uid)));
        if (rSnap.exists()) rtData = rSnap.val() || null;
      } catch (rtErr) {}
    }

    let bestData = fsData;
    if (!bestData && rtData) {
      bestData = rtData;
    } else if (fsData && rtData && Number(rtData.updatedAt || 0) > Number(fsData.updatedAt || 0)) {
      bestData = { ...fsData, ...rtData };
    }

    if (bestData) {
      applyIncomingUserCloudData(bestData, { forceBalanceEvents: true });
      if (db && !isFirestoreQuotaBlocked()) {
        try {
          setDoc(doc(db, 'users', String(uid)), { lastActive: Date.now() }, { merge: true }).catch(() => {});
        } catch (e) {}
      }
    } else {
      await saveCurrentProfileToFirestore();
    }
  } catch (err) {
    console.warn("[Firebase Cloud] Balance fetch note:", err.message);
  }
}

let userDocUnsubscribe = null;
let userRtdbUnsubscribe = null;
/**
 * Dual Real-time listener for current user's profile in BOTH Firestore AND RTDB
 */
const _cloudProfileCreatedUids = new Set();
function startRealtimeUserSync(targetUid = null) {
  if (!db && !rtdb) return null;
  const uid = targetUid || getEffectivePlayerUid();
  if (!uid) return null;

  if (userDocUnsubscribe) {
    try { userDocUnsubscribe(); } catch (e) {}
    userDocUnsubscribe = null;
  }
  if (userRtdbUnsubscribe) {
    try { userRtdbUnsubscribe(); } catch (e) {}
    userRtdbUnsubscribe = null;
  }

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      const userRef = doc(db, 'users', String(uid));
      userDocUnsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          applyIncomingUserCloudData(docSnap.data() || {});
        } else if (!_cloudProfileCreatedUids.has(String(uid))) {
          _cloudProfileCreatedUids.add(String(uid));
          saveCurrentProfileToFirestore();
        }
      }, (err) => {
        markFirestoreQuotaBlocked(err);
        console.log("[Firebase] User Firestore sync running in fallback mode.");
      });
    } catch (e) {}
  }

  if (rtdb) {
    try {
      userRtdbUnsubscribe = onValue(ref(rtdb, 'users/' + String(uid)), (snap) => {
        if (snap.exists()) {
          applyIncomingUserCloudData(snap.val() || {});
        }
      }, () => {});
    } catch (e) {}
  }

  return () => {
    if (typeof userDocUnsubscribe === 'function') { try { userDocUnsubscribe(); } catch (e) {} }
    if (typeof userRtdbUnsubscribe === 'function') { try { userRtdbUnsubscribe(); } catch (e) {} }
  };
}

// Debounced auto-sync when local balances change
let cloudBalanceTimer = null;
function scheduleCloudBalanceSync(delay = 350) {
  if (cloudBalanceTimer) clearTimeout(cloudBalanceTimer);
  cloudBalanceTimer = setTimeout(() => {
    saveCurrentProfileToFirestore();
  }, delay);
}

// Global FirebaseSync currency management engine for all games & pages
const firebaseSync = {
  get db() { return db; },
  get rtdb() { return rtdb; },
  get auth() { return auth; },
  get userId() { return getEffectivePlayerUid(); },
  get database() {
    return {
      ref: (path) => ({
        set: async (data) => {
          const uid = getEffectivePlayerUid();
          const authUid = (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : uid;
          const cleanSub = String(path || 'state').replace(/^\/+|\/+$/g, '');
          const cleanFsId = `${uid}_${cleanSub.replace(/\//g, '_')}`;
          let wrote = false;
          if (db && !isFirestoreQuotaBlocked()) {
            try {
              await setDoc(doc(db, 'players_data', cleanFsId), {
                data,
                userId: uid,
                ownerAuthUid: authUid,
                updatedAt: Date.now()
              }, { merge: true });
              wrote = true;
            } catch (e) { markFirestoreQuotaBlocked(e); }
          }
          if (rtdb) {
            try {
              await set(ref(rtdb, `players_data/${uid}/${cleanSub}`), {
                data,
                ownerAuthUid: authUid,
                updatedAt: Date.now()
              });
              wrote = true;
            } catch (e) {}
          }
          return wrote;
        }
      })
    };
  },
  getCoins() {
    return parseInt(localStorage.getItem('task_game_coins') || localStorage.getItem('user_coins') || '0', 10);
  },
  getStars() {
    return parseInt(localStorage.getItem('task_game_stars') || localStorage.getItem('user_stars') || '0', 10);
  },
  setCoins(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    localStorage.setItem('task_game_coins', num.toString());
    localStorage.setItem('user_coins', num.toString());
    updateAllDomBalances();
    saveCurrentProfileToFirestore();
    return num;
  },
  setStars(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    localStorage.setItem('task_game_stars', num.toString());
    localStorage.setItem('user_stars', num.toString());
    updateAllDomBalances();
    saveCurrentProfileToFirestore();
    return num;
  },
  addCoins(amount, reason = 'win') {
    const amt = Math.max(0, parseInt(amount, 10) || 0);
    const current = this.getCoins();
    const next = current + amt;
    this.setCoins(next);
    console.log(`%c[Firebase Sync] +${amt} Coins added (${reason}). Total: ${next}`, "color: #10b981; font-weight: bold;");
    return next;
  },
  subtractCoins(amount, reason = 'spend') {
    const amt = Math.max(0, parseInt(amount, 10) || 0);
    const current = this.getCoins();
    if (current < amt) {
      if (typeof triggerInsufficientFundsNotice === 'function') {
        triggerInsufficientFundsNotice('coins', amt, current);
      }
      return false;
    }
    const next = Math.max(0, current - amt);
    this.setCoins(next);
    console.log(`%c[Firebase Sync] -${amt} Coins deducted (${reason}). Remaining: ${next}`, "color: #f59e0b; font-weight: bold;");
    return next;
  },
  addStars(amount, reason = 'win') {
    const amt = Math.max(0, parseInt(amount, 10) || 0);
    const current = this.getStars();
    const next = current + amt;
    this.setStars(next);
    console.log(`%c[Firebase Sync] +${amt} Stars added (${reason}). Total: ${next}`, "color: #10b981; font-weight: bold;");
    return next;
  },
  subtractStars(amount, reason = 'spend') {
    const amt = Math.max(0, parseInt(amount, 10) || 0);
    const current = this.getStars();
    if (current < amt) {
      if (typeof triggerInsufficientFundsNotice === 'function') {
        triggerInsufficientFundsNotice('stars', amt, current);
      }
      return false;
    }
    const next = Math.max(0, current - amt);
    this.setStars(next);
    console.log(`%c[Firebase Sync] -${amt} Stars deducted (${reason}). Remaining: ${next}`, "color: #f59e0b; font-weight: bold;");
    return next;
  },
  getTickets() {
    return parseInt(localStorage.getItem('task_user_tickets') || localStorage.getItem('user_tickets') || localStorage.getItem('task_game_tickets') || '0', 10);
  },
  setTickets(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    localStorage.setItem('task_user_tickets', num.toString());
    localStorage.setItem('user_tickets', num.toString());
    localStorage.setItem('task_game_tickets', num.toString());
    updateAllDomBalances();
    saveCurrentProfileToFirestore();
    return num;
  },
  addTickets(amount, reason = 'win') {
    const amt = Math.max(0, parseInt(amount, 10) || 0);
    const current = this.getTickets();
    const next = current + amt;
    this.setTickets(next);
    console.log(`%c[Firebase Sync] +${amt} Tickets added (${reason}). Total: ${next}`, "color: #10b981; font-weight: bold;");
    return next;
  },
  subtractTickets(amount, reason = 'spend') {
    const amt = Math.max(0, parseInt(amount, 10) || 0);
    const current = this.getTickets();
    if (current < amt) {
      if (typeof triggerInsufficientFundsNotice === 'function') {
        triggerInsufficientFundsNotice('tickets', amt, current);
      }
      return false;
    }
    const next = Math.max(0, current - amt);
    this.setTickets(next);
    console.log(`%c[Firebase Sync] -${amt} Tickets deducted (${reason}). Remaining: ${next}`, "color: #f59e0b; font-weight: bold;");
    return next;
  },
  syncPlayerCurrenciesImmediate() {
    return saveCurrentProfileToFirestore();
  },
  saveUserData() {
    return saveCurrentProfileToFirestore();
  },
  fetchLatestBalances() {
    return initCloudBalances();
  },
  ticketStarRates: [
    { tickets: 100, stars: 150 },
    { tickets: 500, stars: 750 },
    { tickets: 1000, stars: 1500 }
  ],
  getStarCostForTickets(tickets) {
    const pkg = this.ticketStarRates.find(p => p.tickets === Number(tickets));
    if (pkg) return pkg.stars;
    return Math.round(Number(tickets) * 1.5);
  },
  getTicketsForStars(stars) {
    const pkg = this.ticketStarRates.find(p => p.stars === Number(stars));
    if (pkg) return pkg.tickets;
    return Math.floor(Number(stars) / 1.5);
  },
  buyTicketsWithStars(ticketAmount, explicitStarCost) {
    const starCost = explicitStarCost !== undefined ? explicitStarCost : this.getStarCostForTickets(ticketAmount);
    const currentStars = this.getStars();
    if (currentStars < starCost) {
      return { success: false, error: 'insufficient_stars', needed: starCost, current: currentStars };
    }
    this.subtractStars(starCost, `Exchanged for ${ticketAmount} Tickets`);
    const newTickets = this.addTickets(ticketAmount, `Purchased with ${starCost} Stars`);
    return { success: true, tickets: newTickets, stars: this.getStars() };
  },
  getDiamonds() {
    return parseInt(localStorage.getItem('task_user_diamonds') || localStorage.getItem('user_diamonds') || '0', 10) || 0;
  },
  setDiamonds(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    localStorage.setItem('task_user_diamonds', num.toString());
    localStorage.setItem('user_diamonds', num.toString());
    updateAllDomBalances();
    saveCurrentProfileToFirestore();
    return num;
  },
  addDiamonds(amount, reason = 'win') {
    const amt = Math.max(0, parseInt(amount, 10) || 0);
    const next = this.getDiamonds() + amt;
    this.setDiamonds(next);
    return next;
  },
  subtractDiamonds(amount, reason = 'spend') {
    const amt = Math.max(0, parseInt(amount, 10) || 0);
    const current = this.getDiamonds();
    if (current < amt) {
      if (typeof triggerInsufficientFundsNotice === 'function') {
        triggerInsufficientFundsNotice('diamonds', amt, current);
      }
      return false;
    }
    const next = Math.max(0, current - amt);
    this.setDiamonds(next);
    return next;
  },
  getCurrencyBalance(currency = 'coins') {
    const c = String(currency || 'coins').toLowerCase();
    if (c === 'tickets' || c === 'ticket') return this.getTickets();
    if (c === 'stars' || c === 'star') return this.getStars();
    if (c === 'diamonds' || c === 'diamond') return this.getDiamonds();
    return this.getCoins();
  },
  spendCurrency(currency = 'coins', amount = 0, reason = 'spend') {
    const c = String(currency || 'coins').toLowerCase();
    if (c === 'tickets' || c === 'ticket') return this.subtractTickets(amount, reason);
    if (c === 'stars' || c === 'star') return this.subtractStars(amount, reason);
    if (c === 'diamonds' || c === 'diamond') return this.subtractDiamonds(amount, reason);
    return this.subtractCoins(amount, reason);
  },
  creditCurrency(currency = 'coins', amount = 0, reason = 'win') {
    const c = String(currency || 'coins').toLowerCase();
    if (c === 'tickets' || c === 'ticket') return this.addTickets(amount, reason);
    if (c === 'stars' || c === 'star') return this.addStars(amount, reason);
    if (c === 'diamonds' || c === 'diamond') return this.addDiamonds(amount, reason);
    return this.addCoins(amount, reason);
  },
  getUltraCredits() {
    return Math.max(0, parseInt(localStorage.getItem('wallet_ultra_task_credits') || '0', 10) || 0);
  },
  setUltraCredits(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    localStorage.setItem('wallet_ultra_task_credits', String(num));
    saveCurrentProfileToFirestore();
    return num;
  },
  getUltraTotalCompleted() {
    return Math.max(0, parseInt(localStorage.getItem('wallet_ultra_total_completed') || '0', 10) || 0);
  },
  addUltraTaskCompletion(count = 1) {
    const inc = Math.max(0, parseInt(count, 10) || 0);
    const nextCredits = this.getUltraCredits() + inc;
    const nextTotal = this.getUltraTotalCompleted() + inc;
    localStorage.setItem('wallet_ultra_task_credits', String(nextCredits));
    localStorage.setItem('wallet_ultra_total_completed', String(nextTotal));
    saveCurrentProfileToFirestore();
    return { credits: nextCredits, total: nextTotal };
  },
  getClaimedWalletOffers() {
    try {
      const parsed = JSON.parse(localStorage.getItem('wallet_claimed_offers') || '{}');
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) {
      return {};
    }
  }
};

const TICKET_TO_STAR_PACKAGES = [
  { tickets: 100, stars: 150 },
  { tickets: 500, stars: 750 },
  { tickets: 1000, stars: 1500 }
];

function getStarCostForTickets(tickets) {
  const pkg = TICKET_TO_STAR_PACKAGES.find(p => p.tickets === Number(tickets));
  if (pkg) return pkg.stars;
  return Math.round(Number(tickets) * 1.5);
}

function getTicketsForStars(stars) {
  const pkg = TICKET_TO_STAR_PACKAGES.find(p => p.stars === Number(stars));
  if (pkg) return pkg.tickets;
  return Math.floor(Number(stars) / 1.5);
}

window.TICKET_TO_STAR_PACKAGES = TICKET_TO_STAR_PACKAGES;
window.getStarCostForTickets = getStarCostForTickets;
window.getTicketsForStars = getTicketsForStars;

window.firebaseSync = firebaseSync;
window.FirebaseCurrency = firebaseSync;
window.playerWallet = firebaseSync;

// Global currency helpers for any purchase, unlock, or gameplay across the entire app
window.useCoins = function(amount, reason = 'spend') {
  return firebaseSync.subtractCoins(amount, reason);
};
window.useStars = function(amount, reason = 'spend') {
  return firebaseSync.subtractStars(amount, reason);
};
window.useTickets = function(amount, reason = 'spend') {
  return firebaseSync.subtractTickets(amount, reason);
};
window.deductCoins = window.useCoins;
window.deductStars = window.useStars;
window.deductTickets = window.useTickets;
window.deductPlayerGoldCoins = function(amount, reason = 'spend') {
  return firebaseSync.subtractCoins(amount, reason);
};
window.winCoins = function(amount, reason = 'win') {
  return firebaseSync.addCoins(amount, reason);
};
window.winStars = function(amount, reason = 'win') {
  return firebaseSync.addStars(amount, reason);
};
window.winTickets = function(amount, reason = 'win') {
  return firebaseSync.addTickets(amount, reason);
};
window.getPlayerCoins = function() {
  return firebaseSync.getCoins();
};
window.getPlayerStars = function() {
  return firebaseSync.getStars();
};
window.getPlayerTickets = function() {
  return firebaseSync.getTickets();
};
window.triggerInsufficientFundsNotice = triggerInsufficientFundsNotice;
window.triggerPillDeductionEffect = triggerPillDeductionEffect;
window.triggerPillGainEffect = triggerPillGainEffect;
window.triggerHeaderPillBounce = triggerPillGainEffect;


// =============================================================================
// GLOBAL BALANCE MANAGER (USE OR WIN COINS & STARS - LIVE FIREBASE SYNCHRONIZER)
// =============================================================================

function injectBalanceManagerUI() {
  if (document.getElementById('globalBalanceManagerModal')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'gbm-styles';
  styleEl.textContent = `
    .gbm-overlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: rgba(3, 8, 22, 0.85);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: gbmFadeIn 0.2s ease-out;
    }
    @keyframes gbmFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .gbm-card {
      width: 100%;
      max-width: 420px;
      background: #09132c;
      border: 1.5px solid #1e3a6a;
      border-radius: 20px;
      padding: 1.25rem;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.15);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      position: relative;
      animation: gbmScaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    }
    @keyframes gbmScaleUp {
      from { transform: scale(0.92) translateY(10px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }
    .gbm-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(56, 189, 248, 0.15);
    }
    .gbm-title-wrap {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .gbm-title-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 1.5px solid #38bdf8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.3);
    }
    .gbm-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.2;
    }
    .gbm-subtitle {
      margin: 0;
      font-size: 0.72rem;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      margin-top: 2px;
    }
    .gbm-live-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
      display: inline-block;
    }
    .gbm-close-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .gbm-close-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      color: #f87171;
    }
    .gbm-balances-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.65rem;
      margin-bottom: 1rem;
    }
    .gbm-bal-card {
      background: #04091a;
      border: 1.5px solid rgba(56, 189, 248, 0.2);
      border-radius: 14px;
      padding: 0.65rem 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
    .gbm-bal-card.coins {
      border-color: rgba(251, 191, 36, 0.4);
      background: linear-gradient(135deg, #1c1503 0%, #04091a 100%);
    }
    .gbm-bal-card.stars {
      border-color: rgba(250, 204, 21, 0.4);
      background: linear-gradient(135deg, #1a1600 0%, #04091a 100%);
    }
    .gbm-bal-lbl {
      font-size: 0.65rem;
      font-weight: 800;
      color: #94a3b8;
      letter-spacing: 0.04em;
    }
    .gbm-bal-val {
      font-size: 1.15rem;
      font-weight: 900;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: #ffffff;
      font-variant-numeric: tabular-nums;
    }
    .gbm-bal-card.coins .gbm-bal-val { color: #fbbf24; }
    .gbm-bal-card.stars .gbm-bal-val { color: #facc15; }
    .gbm-tabs {
      display: flex;
      gap: 0.35rem;
      background: rgba(4, 9, 26, 0.6);
      padding: 3px;
      border-radius: 12px;
      border: 1px solid rgba(56, 189, 248, 0.15);
      margin-bottom: 1rem;
    }
    .gbm-tab-btn {
      flex: 1;
      padding: 0.5rem 0.3rem;
      border: none;
      background: transparent;
      border-radius: 9px;
      color: #94a3b8;
      font-size: 0.76rem;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: center;
    }
    .gbm-tab-btn.active {
      background: #1e3a6a;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    .gbm-tab-btn.btn-win-tab.active { background: linear-gradient(135deg, #059669 0%, #047857 100%); }
    .gbm-tab-btn.btn-use-tab.active { background: linear-gradient(135deg, #d97706 0%, #b45309 100%); }
    .gbm-tab-btn.btn-edit-tab.active { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); }
    .gbm-tab-pane {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .gbm-form-group {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .gbm-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: #cbd5e1;
    }
    .gbm-curr-selector {
      display: flex;
      gap: 0.5rem;
    }
    .gbm-radio-lbl {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.45rem;
      border-radius: 10px;
      background: #04091a;
      border: 1.5px solid #1e293b;
      cursor: pointer;
      font-size: 0.825rem;
      font-weight: 800;
      color: #e2e8f0;
      transition: all 0.15s ease;
    }
    .gbm-radio-lbl:has(input:checked) {
      border-color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      color: #ffffff;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
    }
    .gbm-radio-lbl input { margin: 0; }
    .gbm-pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .gbm-quick-pill {
      flex: 1;
      min-width: 54px;
      padding: 0.35rem 0.5rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      font-size: 0.76rem;
      font-weight: 800;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s ease;
    }
    .gbm-quick-pill:hover {
      background: rgba(56, 189, 248, 0.15);
      border-color: #38bdf8;
      color: #ffffff;
    }
    .gbm-input {
      width: 100%;
      background: #04091a;
      border: 1.5px solid #1e3a6a;
      border-radius: 10px;
      padding: 0.6rem 0.8rem;
      color: #ffffff;
      font-size: 0.95rem;
      font-family: inherit;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .gbm-input:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
    }
    .gbm-action-btn {
      width: 100%;
      padding: 0.75rem;
      border-radius: 12px;
      border: none;
      font-size: 0.88rem;
      font-weight: 800;
      cursor: pointer;
      color: #ffffff;
      margin-top: 0.3rem;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
    }
    .gbm-action-btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.1);
    }
    .gbm-action-btn:active {
      transform: scale(0.98);
    }
    .gbm-action-btn.btn-win {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);
    }
    .gbm-action-btn.btn-use {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35);
    }
    .gbm-action-btn.btn-edit {
      background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
      box-shadow: 0 4px 15px rgba(56, 189, 248, 0.35);
    }
    .gbm-toast {
      margin-top: 0.75rem;
      padding: 0.55rem 0.8rem;
      border-radius: 10px;
      font-size: 0.78rem;
      font-weight: 700;
      text-align: center;
      animation: gbmFadeIn 0.2s ease-out;
    }
    .gbm-toast.success {
      background: rgba(16, 185, 129, 0.18);
      border: 1px solid #10b981;
      color: #34d399;
    }
    .gbm-toast.error {
      background: rgba(239, 68, 68, 0.18);
      border: 1px solid #ef4444;
      color: #f87171;
    }
  `;
  document.head.appendChild(styleEl);

  const modalEl = document.createElement('div');
  modalEl.id = 'globalBalanceManagerModal';
  modalEl.className = 'gbm-overlay';
  modalEl.style.display = 'none';
  modalEl.onclick = function(e) {
    if (e.target === modalEl) closeBalanceManageModal();
  };

  modalEl.innerHTML = `
    <div class="gbm-card" onclick="event.stopPropagation()">
      <div class="gbm-header">
        <div class="gbm-title-wrap">
          <div class="gbm-title-icon">⚡</div>
          <div>
            <h3 class="gbm-title">Balance Manager</h3>
            <p class="gbm-subtitle"><span class="gbm-live-dot"></span> Firebase Cloud Connected • Real-Time</p>
          </div>
        </div>
        <button type="button" class="gbm-close-btn" onclick="closeBalanceManageModal()" title="Close">✕</button>
      </div>

      <!-- Live Current Balances Card -->
      <div class="gbm-balances-row">
        <div class="gbm-bal-card coins" title="Total Coin Balance">
          <div class="gbm-bal-lbl">TOTAL COINS</div>
          <div class="gbm-bal-val"><span>🪙</span><span id="manageModalCoinsVal">0</span></div>
        </div>
        <div class="gbm-bal-card stars" title="Total Star Balance">
          <div class="gbm-bal-lbl">TOTAL STARS</div>
          <div class="gbm-bal-val"><span>⭐</span><span id="manageModalStarsVal">0</span></div>
        </div>
      </div>

      <!-- Tabs (Win, Use, Edit) -->
      <div class="gbm-tabs">
        <button type="button" class="gbm-tab-btn btn-win-tab active" id="gbmTabBtnWin" onclick="switchGbmTab('win')">🏆 Win / Earn (+)</button>
        <button type="button" class="gbm-tab-btn btn-use-tab" id="gbmTabBtnUse" onclick="switchGbmTab('use')">🛍️ Use / Spend (-)</button>
        <button type="button" class="gbm-tab-btn btn-edit-tab" id="gbmTabBtnEdit" onclick="switchGbmTab('edit')">✏️ Edit Balance</button>
      </div>

      <!-- Tab 1: WIN / EARN (+) -->
      <div class="gbm-tab-pane" id="gbmPaneWin">
        <div class="gbm-form-group">
          <label class="gbm-label">Choose Currency to Win / Add:</label>
          <div class="gbm-curr-selector">
            <label class="gbm-radio-lbl">
              <input type="radio" name="gbmWinCurr" value="coins" checked onchange="updateGbmQuickPills('win')">
              <span>🪙 Coins</span>
            </label>
            <label class="gbm-radio-lbl">
              <input type="radio" name="gbmWinCurr" value="stars" onchange="updateGbmQuickPills('win')">
              <span>⭐ Stars</span>
            </label>
          </div>
        </div>
        <div class="gbm-form-group">
          <label class="gbm-label">Quick Amount:</label>
          <div class="gbm-pills-row" id="gbmWinQuickPills"></div>
        </div>
        <div class="gbm-form-group">
          <label class="gbm-label" for="gbmWinAmount">Amount:</label>
          <input type="number" id="gbmWinAmount" class="gbm-input" min="1" placeholder="Enter amount to win" value="50">
        </div>
        <div class="gbm-form-group">
          <label class="gbm-label" for="gbmWinReason">Reason / Tag:</label>
          <input type="text" id="gbmWinReason" class="gbm-input" placeholder="e.g. Game Win, Task Completed, Community Reward" value="Game Win">
        </div>
        <button type="button" class="gbm-action-btn btn-win" onclick="submitBalanceWin()">Claim Win &amp; Save to Firebase 🚀</button>
      </div>

      <!-- Tab 2: USE / SPEND (-) -->
      <div class="gbm-tab-pane" id="gbmPaneUse" style="display:none;">
        <div class="gbm-form-group">
          <label class="gbm-label">Choose Currency to Use / Spend:</label>
          <div class="gbm-curr-selector">
            <label class="gbm-radio-lbl">
              <input type="radio" name="gbmUseCurr" value="coins" checked onchange="updateGbmQuickPills('use')">
              <span>🪙 Coins</span>
            </label>
            <label class="gbm-radio-lbl">
              <input type="radio" name="gbmUseCurr" value="stars" onchange="updateGbmQuickPills('use')">
              <span>⭐ Stars</span>
            </label>
          </div>
        </div>
        <div class="gbm-form-group">
          <label class="gbm-label">Quick Amount:</label>
          <div class="gbm-pills-row" id="gbmUseQuickPills"></div>
        </div>
        <div class="gbm-form-group">
          <label class="gbm-label" for="gbmUseAmount">Amount:</label>
          <input type="number" id="gbmUseAmount" class="gbm-input" min="1" placeholder="Enter amount to use" value="25">
        </div>
        <div class="gbm-form-group">
          <label class="gbm-label" for="gbmUseReason">Reason / Tag:</label>
          <input type="text" id="gbmUseReason" class="gbm-input" placeholder="e.g. Game Stake, Item Shop, Entry Fee" value="Game Stake">
        </div>
        <button type="button" class="gbm-action-btn btn-use" onclick="submitBalanceUse()">Confirm Use &amp; Deduct 💳</button>
      </div>

      <!-- Tab 3: EDIT BALANCE (DIRECT SET) -->
      <div class="gbm-tab-pane" id="gbmPaneEdit" style="display:none;">
        <div class="gbm-form-group">
          <label class="gbm-label" for="gbmEditCoins">Total Coins Balance (🪙):</label>
          <input type="number" id="gbmEditCoins" class="gbm-input" min="0" placeholder="0">
        </div>
        <div class="gbm-form-group">
          <label class="gbm-label" for="gbmEditStars">Total Stars Balance (⭐):</label>
          <input type="number" id="gbmEditStars" class="gbm-input" min="0" placeholder="0">
        </div>
        <button type="button" class="gbm-action-btn btn-edit" onclick="submitBalanceSet()">Save Fixed Balances to Firebase 💾</button>
      </div>

      <div id="gbmToastMsg" class="gbm-toast" style="display:none;"></div>
    </div>
  `;
  document.body.appendChild(modalEl);
  updateGbmQuickPills('win');
  updateGbmQuickPills('use');
}

function updateGbmQuickPills(mode = 'win') {
  const containerId = mode === 'win' ? 'gbmWinQuickPills' : 'gbmUseQuickPills';
  const container = document.getElementById(containerId);
  if (!container) return;

  const radName = mode === 'win' ? 'gbmWinCurr' : 'gbmUseCurr';
  const selected = document.querySelector(`input[name="${radName}"]:checked`);
  const isCoin = !selected || selected.value === 'coins';

  const amounts = isCoin ? [10, 50, 100, 500, 1000] : [1, 5, 10, 50, 100];
  const unit = isCoin ? '🪙' : '⭐';

  container.innerHTML = amounts.map(amt => `
    <button type="button" class="gbm-quick-pill" onclick="selectGbmQuickAmount('${mode}', ${amt})">
      ${mode === 'win' ? '+' : '-'}${amt.toLocaleString()} ${unit}
    </button>
  `).join('');
}

function selectGbmQuickAmount(mode, amount) {
  const inputId = mode === 'win' ? 'gbmWinAmount' : 'gbmUseAmount';
  const input = document.getElementById(inputId);
  if (input) input.value = amount;
}

function switchGbmTab(tabName) {
  const tabs = ['win', 'use', 'edit'];
  tabs.forEach(t => {
    const btn = document.getElementById(`gbmTabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const pane = document.getElementById(`gbmPane${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.toggle('active', t === tabName);
    if (pane) pane.style.display = (t === tabName) ? 'flex' : 'none';
  });

  if (tabName === 'edit') {
    const cInput = document.getElementById('gbmEditCoins');
    const sInput = document.getElementById('gbmEditStars');
    if (cInput) cInput.value = firebaseSync.getCoins();
    if (sInput) sInput.value = firebaseSync.getStars();
  }
}

function isAuthorizedAdminSession() {
  try {
    return sessionStorage.getItem('admin_authenticated') === 'true' || sessionStorage.getItem('task_admin_authenticated') === 'true';
  } catch (e) {
    return false;
  }
}

function openBalanceManageModal(preferredType = 'coins', defaultTab = 'win') {
  injectBalanceManagerUI();
  const modal = document.getElementById('globalBalanceManagerModal');
  if (!modal) return;

  updateAllDomBalances();

  // Security guard: Only authorized Admin sessions may open manual mint/deduct controls.
  // Players tapping header balance pills see a read-only balance breakdown instead.
  if (!isAuthorizedAdminSession()) {
    const winTab = document.getElementById('gbmTabWin');
    const useTab = document.getElementById('gbmTabUse');
    const setTab = document.getElementById('gbmTabSet');
    const winBtn = document.getElementById('gbmBtnTabWin');
    const useBtn = document.getElementById('gbmBtnTabUse');
    const setBtn = document.getElementById('gbmBtnTabSet');
    if (winBtn) winBtn.style.display = 'none';
    if (useBtn) useBtn.style.display = 'none';
    if (setBtn) setBtn.style.display = 'none';
    if (winTab) winTab.style.display = 'none';
    if (useTab) useTab.style.display = 'none';
    if (setTab) setTab.style.display = 'none';

    let readonlyBox = document.getElementById('gbmReadonlySummaryBox');
    if (!readonlyBox) {
      readonlyBox = document.createElement('div');
      readonlyBox.id = 'gbmReadonlySummaryBox';
      readonlyBox.style.cssText = 'padding: 12px; border-radius: 12px; background: rgba(15,23,42,0.75); border: 1px solid rgba(56,189,248,0.3); color: #e2e8f0; font-size: 0.82rem; line-height: 1.55; margin-top: 8px;';
      const card = modal.querySelector('.gbm-card') || modal.firstElementChild;
      if (card) card.appendChild(readonlyBox);
    }
    const c = parseInt(localStorage.getItem('task_game_coins') || '0', 10) || 0;
    const s = parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0;
    const t = parseInt(localStorage.getItem('task_user_tickets') || '0', 10) || 0;
    const d = parseInt(localStorage.getItem('task_user_diamonds') || '0', 10) || 0;
    let txHtml = '';
    try {
      const logs = JSON.parse(localStorage.getItem('tap_empire_tx_log') || '[]').slice(0, 5);
      if (logs.length > 0) {
        txHtml = '<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;"><div style="font-weight:800;color:#38bdf8;margin-bottom:4px;">Recent Activity</div>' +
          logs.map(l => `<div style="display:flex;justify-content:space-between;font-size:0.74rem;padding:2px 0;"><span>${String(l.reason || 'Transaction').replace(/</g,'&lt;')}</span><span style="color:#fbbf24;font-weight:800;">${String(l.summary || '')}</span></div>`).join('') +
          '</div>';
      }
    } catch (e) {}
    readonlyBox.innerHTML = `<div style="font-weight:900;color:#38bdf8;margin-bottom:6px;">🔐 Verified Account Balances</div>
      <div>🪙 Coins: <b>${c.toLocaleString()}</b> &nbsp;|&nbsp; ⭐ Stars: <b>${s.toLocaleString()}</b></div>
      <div>🎟️ Tickets: <b>${t.toLocaleString()}</b> &nbsp;|&nbsp; 💎 Diamonds: <b>${d.toLocaleString()}</b></div>
      <div style="font-size:0.72rem;color:#94a3b8;margin-top:6px;">Complete verified tasks, Shop exchanges, or Daily Streak rewards to earn currency.</div>${txHtml}`;
    readonlyBox.style.display = 'block';
    modal.style.display = 'flex';
    return;
  }

  const ro = document.getElementById('gbmReadonlySummaryBox');
  if (ro) ro.style.display = 'none';
  ['gbmBtnTabWin', 'gbmBtnTabUse', 'gbmBtnTabSet'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });

  // Pre-select currency radio
  if (preferredType === 'stars') {
    const winRadio = document.querySelector('input[name="gbmWinCurr"][value="stars"]');
    const useRadio = document.querySelector('input[name="gbmUseCurr"][value="stars"]');
    if (winRadio) winRadio.checked = true;
    if (useRadio) useRadio.checked = true;
  } else {
    const winRadio = document.querySelector('input[name="gbmWinCurr"][value="coins"]');
    const useRadio = document.querySelector('input[name="gbmUseCurr"][value="coins"]');
    if (winRadio) winRadio.checked = true;
    if (useRadio) useRadio.checked = true;
  }

  updateGbmQuickPills('win');
  updateGbmQuickPills('use');
  switchGbmTab(defaultTab);

  modal.style.display = 'flex';
}

function closeBalanceManageModal() {
  const modal = document.getElementById('globalBalanceManagerModal');
  if (modal) modal.style.display = 'none';
  const toast = document.getElementById('gbmToastMsg');
  if (toast) toast.style.display = 'none';
}

function showGbmToast(msg, type = 'success') {
  const toast = document.getElementById('gbmToastMsg');
  if (!toast) return;
  toast.className = `gbm-toast ${type}`;
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    if (toast) toast.style.display = 'none';
  }, 3200);
}

function submitBalanceWin() {
  if (!isAuthorizedAdminSession()) {
    showGbmToast('Admin authentication required for manual balance adjustment.', 'error');
    return;
  }
  const selected = document.querySelector('input[name="gbmWinCurr"]:checked');
  const isCoin = !selected || selected.value === 'coins';
  const amtInput = document.getElementById('gbmWinAmount');
  const reasonInput = document.getElementById('gbmWinReason');

  const amt = parseInt(amtInput ? amtInput.value : '0', 10);
  if (isNaN(amt) || amt <= 0) {
    showGbmToast('Please enter a valid positive amount.', 'error');
    return;
  }
  const reason = (reasonInput && reasonInput.value.trim()) ? reasonInput.value.trim() : 'Admin Grant';

  if (isCoin) {
    const next = firebaseSync.addCoins(amt, reason);
    showGbmToast(`✓ Added +${amt.toLocaleString()} 🪙 Coins! Total: ${next.toLocaleString()} 🪙`, 'success');
  } else {
    const next = firebaseSync.addStars(amt, reason);
    showGbmToast(`✓ Added +${amt.toLocaleString()} ⭐ Stars! Total: ${next.toLocaleString()} ⭐`, 'success');
  }
}

function submitBalanceUse() {
  if (!isAuthorizedAdminSession()) {
    showGbmToast('Admin authentication required.', 'error');
    return;
  }
  const selected = document.querySelector('input[name="gbmUseCurr"]:checked');
  const isCoin = !selected || selected.value === 'coins';
  const amtInput = document.getElementById('gbmUseAmount');
  const reasonInput = document.getElementById('gbmUseReason');

  const amt = parseInt(amtInput ? amtInput.value : '0', 10);
  if (isNaN(amt) || amt <= 0) {
    showGbmToast('Please enter a valid positive amount.', 'error');
    return;
  }
  const reason = (reasonInput && reasonInput.value.trim()) ? reasonInput.value.trim() : 'Admin Deduction';

  if (isCoin) {
    const res = firebaseSync.subtractCoins(amt, reason);
    if (res === false) {
      showGbmToast(`Insufficient coins! Available: ${firebaseSync.getCoins().toLocaleString()} 🪙.`, 'error');
      return;
    }
    showGbmToast(`✓ Deducted -${amt.toLocaleString()} 🪙 Coins! Remaining: ${res.toLocaleString()} 🪙`, 'success');
  } else {
    const res = firebaseSync.subtractStars(amt, reason);
    if (res === false) {
      showGbmToast(`Insufficient stars! Available: ${firebaseSync.getStars().toLocaleString()} ⭐.`, 'error');
      return;
    }
    showGbmToast(`✓ Deducted -${amt.toLocaleString()} ⭐ Stars! Remaining: ${res.toLocaleString()} ⭐`, 'success');
  }
}

function submitBalanceSet() {
  if (!isAuthorizedAdminSession()) {
    showGbmToast('Admin authentication required.', 'error');
    return;
  }
  const cInput = document.getElementById('gbmEditCoins');
  const sInput = document.getElementById('gbmEditStars');

  const c = parseInt(cInput ? cInput.value : '0', 10);
  const s = parseInt(sInput ? sInput.value : '0', 10);

  if (isNaN(c) || c < 0 || isNaN(s) || s < 0) {
    showGbmToast('Please enter valid non-negative values.', 'error');
    return;
  }

  firebaseSync.setCoins(c);
  firebaseSync.setStars(s);
  showGbmToast(`✓ Saved balances to Firebase: ${c.toLocaleString()} 🪙, ${s.toLocaleString()} ⭐!`, 'success');
}

window.openBalanceManageModal = openBalanceManageModal;
window.closeBalanceManageModal = closeBalanceManageModal;
window.switchGbmTab = switchGbmTab;
window.updateGbmQuickPills = updateGbmQuickPills;
window.selectGbmQuickAmount = selectGbmQuickAmount;
window.submitBalanceWin = submitBalanceWin;
window.submitBalanceUse = submitBalanceUse;
window.submitBalanceSet = submitBalanceSet;

// Automatically bind click handlers on any pill with .coin-pill, .star-pill on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  injectBalanceManagerUI();

  // Attach click listener to any unhandled pill
  document.querySelectorAll('.coin-pill, .header-coin-pill').forEach(el => {
    if (!el.getAttribute('onclick')) {
      el.addEventListener('click', () => openBalanceManageModal('coins'));
      el.style.cursor = 'pointer';
    }
  });
  document.querySelectorAll('.star-pill, .header-star-pill').forEach(el => {
    if (!el.getAttribute('onclick')) {
      el.addEventListener('click', () => openBalanceManageModal('stars'));
      el.style.cursor = 'pointer';
    }
  });
});



/**
 * Format Firebase Auth error codes into helpful user messages
 */
function formatAuthErrorMessage(error) {
  if (!error) return 'An unknown error occurred.';
  const code = error.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'The email address format is invalid.';
    case 'auth/operation-not-allowed':
      return 'Email/password accounts are not enabled. Please enable in Firebase Console.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled by an administrator.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    default:
      return error.message || 'Authentication error. Please check your credentials.';
  }
}

/**
 * Dispatch auth notification across open tabs and app windows
 */
function notifyAuthChanged(user, profile) {
  try {
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    ch.postMessage({
      type: 'AUTH_CHANGED',
      user: user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null,
      timestamp: Date.now()
    });
  } catch (e) {}

  window.dispatchEvent(new CustomEvent('firebase:auth-changed', {
    detail: { user, profile }
  }));
}

// Automatically subscribe to auth state changes on start
try {
  subscribeToAuth((user, profile) => {
    // Notify any active profile UI
    if (typeof window.updatePlayerSessionUI === 'function') {
      window.updatePlayerSessionUI();
    }
  });
} catch (e) {}

// =============================================================================
// FIRESTORE TASKS, REFERRALS & LEADERBOARD CLOUD METHODS
// =============================================================================

let _lastLocalTaskSaveAt = parseInt(localStorage.getItem('task_game_tasks_updated_at') || '0', 10) || 0;
let _lastSyncedTasksHash = '';
const ADMIN_LOCK_CHANNEL_NAME = 'admin_lock_channel';
const ADMIN_LOCAL_LOCK_KEY = 'tap_empire_admin_active_lock';
const ADMIN_LOCK_TTL_MS = 120000;

function extractTasksArrayFromCloudPayload(data) {
  if (!data) return null;
  if (Array.isArray(data)) return data.filter(t => t && typeof t === 'object' && !t.isDemo && !/^(comm_mission|coin_mission|star_mission|pro_mission|ultra_mission|quiz_task)_/.test(String(t.id || '')));
  let list = null;
  // Prefer live structured `data.tasks` (array or RTDB sparse map after manual console edits/deletes) FIRST
  if (data.tasks !== undefined && data.tasks !== null) {
    if (Array.isArray(data.tasks)) {
      list = data.tasks;
    } else if (typeof data.tasks === 'object') {
      const keys = Object.keys(data.tasks).sort((a, b) => {
        const na = Number(a), nb = Number(b);
        return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b);
      });
      list = keys.map(k => data.tasks[k]);
    }
  }
  // Fallback to legacy `tasksJson` string only if structured `tasks` field is absent
  if (!list && typeof data.tasksJson === 'string' && data.tasksJson.trim()) {
    try {
      const parsed = JSON.parse(data.tasksJson);
      if (Array.isArray(parsed)) list = parsed;
      else if (parsed && typeof parsed === 'object') list = Object.values(parsed);
    } catch (e) {}
  }
  if (!list && typeof data === 'object' && !('updatedAt' in data) && !('code' in data) && !('tasksJson' in data) && !('tasks' in data)) {
    const vals = Object.values(data).filter(v => v && typeof v === 'object' && (v.id || v.title || v.category));
    if (vals.length > 0) list = vals;
  }
  if (!Array.isArray(list)) return null;
  const legacyDemoRe = /^(comm_mission|coin_mission|star_mission|pro_mission|ultra_mission|quiz_task)_/;
  return list.filter(t => t && typeof t === 'object' && !t.isDemo && !legacyDemoRe.test(String(t.id || '')));
}

function projectCompactAdminUser(uid, raw) {
  const u = (raw && typeof raw === 'object') ? raw : {};
  return {
    id: u.id || u.uid || uid,
    uid: u.uid || u.id || uid,
    displayName: u.displayName || u.name || 'Player',
    name: u.displayName || u.name || 'Player',
    email: u.email || '',
    username: u.username || '',
    avatar: u.avatar || 'avatar-1.png',
    role: u.role === 'vip' ? 'vip' : 'player',
    level: u.level || 'LVL 1 • NOVICE',
    coins: typeof u.coins === 'number' ? u.coins : (parseInt(u.coins || '0', 10) || 0),
    stars: typeof u.stars === 'number' ? u.stars : (parseInt(u.stars || '0', 10) || 0),
    tickets: typeof u.tickets === 'number' ? u.tickets : (parseInt(u.tickets || '0', 10) || 0),
    diamonds: typeof u.diamonds === 'number' ? u.diamonds : (parseInt(u.diamonds || '0', 10) || 0),
    passLevel: typeof u.passLevel === 'number' ? u.passLevel : (parseInt(u.passLevel || '0', 10) || 0),
    eventTasks: parseInt(u.eventTasks || '0', 10) || 0,
    tasksCompleted: parseInt(u.tasksCompleted ?? u.totalTasks ?? '0', 10) || 0,
    totalTasks: parseInt(u.tasksCompleted ?? u.totalTasks ?? '0', 10) || 0,
    adsWatched: parseInt(u.adsWatched || '0', 10) || 0,
    status: u.status || 'active',
    createdAt: u.createdAt || 0,
    updatedAt: u.updatedAt || u.lastActive || 0,
    lastActive: u.lastActive || u.updatedAt || 0
  };
}

function cacheCompactUsersSummary(usersList) {
  try {
    const compact = (Array.isArray(usersList) ? usersList : []).slice(0, 150).map(u => projectCompactAdminUser(u.id, u));
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(compact));
  } catch (e) {
    try { localStorage.removeItem(USERS_STORAGE_KEY); } catch (_) {}
  }
}

/**
 * Save tasks to Firestore cloud & RTDB cleanly (Real-Time Sync to Home, Tasks & Admin)
 */
async function saveTasksToCloud(tasks) {
  const now = Date.now();
  const cleanTasks = Array.isArray(tasks) ? tasks : [];
  const tasksJson = JSON.stringify(cleanTasks);
  _lastLocalTaskSaveAt = now;
  _lastSyncedTasksHash = tasksJson;
  let saved = false;

  // Persist locally & broadcast immediately so Home/Tasks reflect edits with 0ms latency
  localStorage.setItem(TASKS_STORAGE_KEY, tasksJson);
  localStorage.setItem('admin_tasks', tasksJson);
  localStorage.setItem('task_game_tasks_updated_at', String(now));
  localStorage.setItem(SYNC_FLAG_KEY, String(now));
  try {
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    ch.postMessage({ type: 'TASKS_UPDATED', tasks: cleanTasks, timestamp: now });
    ch.close();
  } catch (e) {}
  try {
    window.dispatchEvent(new CustomEvent('tasks:changed', { detail: cleanTasks }));
  } catch (e) {}

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      const globalTasksRef = doc(db, 'referral_codes', 'GLOBAL_TASKS');
      const uid = (auth && auth.currentUser) ? auth.currentUser.uid : 'admin_mission_control';
      await setDoc(globalTasksRef, {
        code: 'GLOBAL_TASKS',
        userId: uid,
        rewardCoins: 0,
        tasks: cleanTasks,
        tasksJson,
        updatedAt: now
      });
      saved = true;
    } catch (err) {
      markFirestoreQuotaBlocked(err);
      console.warn("[Firebase] GLOBAL_TASKS save note:", err.message);
    }

    if (!isFirestoreQuotaBlocked()) {
      try {
        const tasksRef = doc(db, 'system', 'tasks_config');
        await setDoc(tasksRef, {
          tasks: cleanTasks,
          tasksJson,
          updatedAt: now
        });
        saved = true;
      } catch (err) {
        markFirestoreQuotaBlocked(err);
      }
    }
  }

  if (rtdb) {
    try {
      await set(ref(rtdb, 'system/tasks_config'), {
        tasks: cleanTasks,
        tasksJson,
        updatedAt: now
      });
      saved = true;
    } catch (e) {}
  }

  return saved;
}

/**
 * Real-time listener for tasks in Firestore & RTDB (syncs edits/deletes live to Home, Tasks & Admin Editor)
 */
function listenToCloudTasks(onUpdateCallback) {
  let unsubGlobal = null;
  let unsubSys = null;
  let unsubRtdb = null;

  const handleIncomingTasks = (data) => {
    const list = extractTasksArrayFromCloudPayload(data);
    if (!Array.isArray(list)) return;

    const incomingTs = Number((data && data.updatedAt) || 0) || 0;
    if (incomingTs > 0 && _lastLocalTaskSaveAt > incomingTs + 1000) {
      return; // Ignore older cached echo from slower Firebase channel
    }

    const hash = JSON.stringify(list);
    const localExisting = localStorage.getItem(TASKS_STORAGE_KEY) || '';
    if (hash === _lastSyncedTasksHash && hash === localExisting) {
      return;
    }

    _lastSyncedTasksHash = hash;
    const tsNow = Math.max(Date.now(), incomingTs);
    localStorage.setItem(TASKS_STORAGE_KEY, hash);
    localStorage.setItem('admin_tasks', hash);
    localStorage.setItem('task_game_tasks_updated_at', String(tsNow));
    localStorage.setItem(SYNC_FLAG_KEY, String(tsNow));
    try {
      const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
      ch.postMessage({ type: 'TASKS_SYNCED', timestamp: tsNow });
      ch.close();
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('tasks:changed', { detail: list }));
    } catch (e) {}

    if (typeof onUpdateCallback === 'function') {
      try { onUpdateCallback(list); } catch (e) {}
    }
    if (typeof window.onCloudTasksUpdated === 'function') {
      try { window.onCloudTasksUpdated(list); } catch (e) {}
    }
    if (typeof window.renderTasks === 'function') {
      try { window.renderTasks(); } catch (e) {}
    }
    if (window.TapEngine && typeof window.TapEngine.refreshAllTaskViews === 'function') {
      try { window.TapEngine.refreshAllTaskViews(); } catch (e) {}
    }
    if (typeof window.renderAllHomeTasks === 'function') {
      try { window.renderAllHomeTasks(); } catch (e) {}
    }
    if (typeof window.renderAdminTasks === 'function') {
      try { window.renderAdminTasks(); } catch (e) {}
    }
    if (typeof window.renderTasksTable === 'function') {
      try { window.renderTasksTable(); } catch (e) {}
    }
  };

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      const globalRef = doc(db, 'referral_codes', 'GLOBAL_TASKS');
      unsubGlobal = onSnapshot(globalRef, (snapshot) => {
        if (snapshot.exists()) {
          handleIncomingTasks(snapshot.data());
        }
      }, (err) => {
        markFirestoreQuotaBlocked(err);
      });
    } catch (e) {}

    try {
      const sysRef = doc(db, 'system', 'tasks_config');
      unsubSys = onSnapshot(sysRef, (snapshot) => {
        if (snapshot.exists()) {
          handleIncomingTasks(snapshot.data());
        }
      }, (err) => { markFirestoreQuotaBlocked(err); });
    } catch (e) {}
  }

  if (rtdb) {
    try {
      unsubRtdb = onValue(ref(rtdb, 'system/tasks_config'), (snap) => {
        if (snap.exists()) handleIncomingTasks(snap.val());
      }, () => {});
    } catch (e) {}
  }

  return () => {
    if (typeof unsubGlobal === 'function') unsubGlobal();
    if (typeof unsubSys === 'function') unsubSys();
    if (typeof unsubRtdb === 'function') unsubRtdb();
  };
}

/**
 * Scalable Real-Time + Cursor-Paginated Users Loader (Handles 10,000+ players cleanly)
 */
function listenToCloudUsers(onUpdateCallback) {
  let unsubFs = null;
  let cancelled = false;
  const usersMap = new Map();
  let flushTimer = null;

  const scheduleEmit = () => {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      if (cancelled) return;
      const merged = Array.from(usersMap.values());
      cacheCompactUsersSummary(merged);
      if (typeof onUpdateCallback === 'function') {
        try { onUpdateCallback(merged); } catch (e) {}
      }
    }, 80);
  };

  const ingestDocs = (docs) => {
    docs.forEach((docSnap) => {
      const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap;
      const uid = docSnap.id || (data && (data.uid || data.id));
      if (uid) usersMap.set(String(uid), projectCompactAdminUser(String(uid), data));
    });
  };

  if (db && !isFirestoreQuotaBlocked()) {
    // 1. Live stream of most recently active 500 players (fast real-time updates)
    try {
      const recentQ = query(collection(db, 'users'), orderBy('updatedAt', 'desc'), limit(500));
      unsubFs = onSnapshot(recentQ, (snapshot) => {
        ingestDocs(snapshot.docs);
        scheduleEmit();
      }, (err) => {
        // Fallback if some records lack updatedAt or index is warming
        if (!isFirestoreQuotaBlocked()) {
          try {
            unsubFs = onSnapshot(query(collection(db, 'users'), limit(500)), (snap) => {
              ingestDocs(snap.docs);
              scheduleEmit();
            }, (e2) => markFirestoreQuotaBlocked(e2));
          } catch (e3) {}
        }
      });
    } catch (e) {}

    // 2. Non-blocking cursor pagination to load 10,000+ players in chunks of 2,000
    (async () => {
      try {
        let lastDoc = null;
        let fetchedPages = 0;
        while (!cancelled && !isFirestoreQuotaBlocked() && fetchedPages < 25) {
          const pageQ = lastDoc
            ? query(collection(db, 'users'), startAfter(lastDoc), limit(2000))
            : query(collection(db, 'users'), limit(2000));
          const snap = await getDocs(pageQ);
          if (cancelled || snap.empty) break;
          ingestDocs(snap.docs);
          scheduleEmit();
          lastDoc = snap.docs[snap.docs.length - 1];
          fetchedPages++;
          if (snap.docs.length < 2000) break;
          await new Promise(r => setTimeout(r, 30));
        }
      } catch (err) {
        markFirestoreQuotaBlocked(err);
      }
    })();
  }

  // Fallback / initial RTDB snapshot load once without attaching 10k-node real-time flood
  if (rtdb) {
    get(ref(rtdb, 'users')).then((snap) => {
      if (!cancelled && snap.exists()) {
        const obj = snap.val() || {};
        Object.entries(obj).forEach(([k, v]) => {
          if (!usersMap.has(String(k))) {
            usersMap.set(String(k), projectCompactAdminUser(String(k), v));
          }
        });
        scheduleEmit();
      }
    }).catch(() => {});
  }

  return () => {
    cancelled = true;
    clearTimeout(flushTimer);
    if (typeof unsubFs === 'function') unsubFs();
  };
}

/**
 * Single-Person Admin Exclusive Access Lock (Firestore + RTDB + Local)
 * Stores `holderAuthUid` so Firestore & RTDB security rules enforce 1-person Admin access server-side.
 */
async function acquireSingleAdminLock(deviceId, sessionToken) {
  const now = Date.now();
  const dev = String(deviceId || '').trim();
  const tok = String(sessionToken || '').trim();
  if (!dev || !tok) return { ok: false, error: 'Missing admin session identifiers.' };

  await ensureFirebaseAuthReady(2500);
  const authUid = (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : '';

  const validateLock = (existing) => {
    if (!existing || !existing.active) return true;
    const age = now - Number(existing.updatedAt || 0);
    if (age > ADMIN_LOCK_TTL_MS) return true;
    return String(existing.holderDeviceId || '') === dev
      || String(existing.sessionToken || '') === tok
      || (authUid && String(existing.holderAuthUid || '') === authUid);
  };

  // Local lock check first
  try {
    const rawLocal = localStorage.getItem(ADMIN_LOCAL_LOCK_KEY);
    if (rawLocal) {
      const localLock = JSON.parse(rawLocal);
      if (!validateLock(localLock)) {
        return { ok: false, blockedByOther: true, error: '🚫 Admin Access Restricted to 1 Person! Another device holds the active Admin lock.' };
      }
    }
  } catch (e) {}

  const lockPayload = {
    active: true,
    adminUser: '400@kp',
    holderDeviceId: dev,
    holderAuthUid: authUid,
    sessionToken: tok,
    updatedAt: now
  };

  // Cloud Firestore lock check & acquire
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      const lockRef = doc(db, 'system', 'admin_lock');
      const snap = await getDoc(lockRef);
      if (snap.exists() && !validateLock(snap.data())) {
        return { ok: false, blockedByOther: true, error: '🚫 Admin Access Restricted to 1 Person! Another administrator session is currently active.' };
      }
      await setDoc(lockRef, lockPayload);
    } catch (err) {
      markFirestoreQuotaBlocked(err);
    }
  }

  if (rtdb) {
    try {
      const rtSnap = await get(ref(rtdb, 'system/admin_lock'));
      if (rtSnap.exists() && !validateLock(rtSnap.val())) {
        return { ok: false, blockedByOther: true, error: '🚫 Admin Access Restricted to 1 Person! Another administrator session is currently active.' };
      }
      await set(ref(rtdb, 'system/admin_lock'), lockPayload);
    } catch (e) {}
  }

  try { localStorage.setItem(ADMIN_LOCAL_LOCK_KEY, JSON.stringify(lockPayload)); } catch (e) {}
  try {
    const ch = new BroadcastChannel(ADMIN_LOCK_CHANNEL_NAME);
    ch.postMessage({ type: 'ADMIN_LOCK_UPDATED', lock: lockPayload });
    ch.close();
  } catch (e) {}
  return { ok: true, lock: lockPayload };
}

async function heartbeatSingleAdminLock(deviceId, sessionToken) {
  const now = Date.now();
  const authUid = (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : '';
  const payload = {
    active: true,
    adminUser: '400@kp',
    holderDeviceId: String(deviceId || ''),
    holderAuthUid: authUid,
    sessionToken: String(sessionToken || ''),
    updatedAt: now
  };
  try { localStorage.setItem(ADMIN_LOCAL_LOCK_KEY, JSON.stringify(payload)); } catch (e) {}
  if (db && !isFirestoreQuotaBlocked()) {
    setDoc(doc(db, 'system', 'admin_lock'), payload, { merge: true }).catch(() => {});
  }
  if (rtdb) {
    set(ref(rtdb, 'system/admin_lock'), payload).catch(() => {});
  }
}

async function releaseSingleAdminLock(sessionToken) {
  const tok = String(sessionToken || '');
  const authUid = (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : '';
  const cleared = { active: false, adminUser: '400@kp', holderDeviceId: '', holderAuthUid: '', sessionToken: '', releasedAt: Date.now(), updatedAt: Date.now() };
  try {
    const cur = JSON.parse(localStorage.getItem(ADMIN_LOCAL_LOCK_KEY) || '{}');
    if (!tok || !cur.sessionToken || cur.sessionToken === tok) {
      localStorage.setItem(ADMIN_LOCAL_LOCK_KEY, JSON.stringify(cleared));
    }
  } catch (e) {}
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      const snap = await getDoc(doc(db, 'system', 'admin_lock'));
      const d = snap.exists() ? snap.data() : {};
      if (!tok || !d.sessionToken || d.sessionToken === tok || (authUid && d.holderAuthUid === authUid)) {
        await setDoc(doc(db, 'system', 'admin_lock'), cleared);
      }
    } catch (e) {}
  }
  if (rtdb) {
    try {
      const snap = await get(ref(rtdb, 'system/admin_lock'));
      const d = snap.exists() ? snap.val() : {};
      if (!tok || !d.sessionToken || d.sessionToken === tok || (authUid && d.holderAuthUid === authUid)) {
        await set(ref(rtdb, 'system/admin_lock'), cleared);
      }
    } catch (e) {}
  }
}

function listenToAdminLock(callback) {
  let unsubFs = null;
  let unsubRt = null;
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      unsubFs = onSnapshot(doc(db, 'system', 'admin_lock'), (snap) => {
        if (snap.exists() && typeof callback === 'function') callback(snap.data());
      }, () => {});
    } catch (e) {}
  }
  if (rtdb) {
    try {
      unsubRt = onValue(ref(rtdb, 'system/admin_lock'), (snap) => {
        if (snap.exists() && typeof callback === 'function') callback(snap.val());
      }, () => {});
    } catch (e) {}
  }
  return () => {
    if (typeof unsubFs === 'function') unsubFs();
    if (typeof unsubRt === 'function') unsubRt();
  };
}

/**
 * Save user balances to Firestore & RTDB (compatibility wrapper)
 */
async function saveUserToCloud(user) {
  if (!user || !user.id) return false;
  let ok = false;
  const resolvedName = String(user.displayName || user.name || '').trim();
  const payload = { ...user, updatedAt: Date.now() };
  if (resolvedName) {
    payload.displayName = resolvedName;
    payload.name = resolvedName;
    payload.displayNameLower = resolvedName.toLowerCase();
  }
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      await setDoc(doc(db, 'users', String(user.id)), payload, { merge: true });
      ok = true;
    } catch (err) {
      markFirestoreQuotaBlocked(err);
    }
  }
  if (rtdb) {
    try {
      await update(ref(rtdb, 'users/' + String(user.id)), payload);
      ok = true;
    } catch (e) {}
  }
  return ok;
}

/**
 * Reset all local storage keys, session data, balances, levels, and progress to clean initial defaults.
 * Called when an admin resets or deletes the current active player session, or upon receiving a reset broadcast.
 */
function resetLocalPlayerSessionKeys() {
  console.log("%c[Firebase Cloud] Resetting local player session to clean zero/default state...", "color: #f59e0b; font-weight: bold;");
  isInternalSync = true;
  try {
    // 1. Balances to 0
    rawSetItem('task_game_coins', '0');
    rawSetItem('task_game_coins_alt', '0');
    rawSetItem('user_coins', '0');
    rawSetItem('task_game_stars', '0');
    rawSetItem('user_stars', '0');
    rawSetItem('task_user_tickets', '0');
    rawSetItem('user_tickets', '0');
    rawSetItem('task_game_tickets', '0');
    rawSetItem('task_user_diamonds', '0');
    rawSetItem('user_diamonds', '0');

    // 2. Levels, XP & Energy to initial defaults
    rawSetItem('player_level', 'LVL 1 • NOVICE');
    rawSetItem('player_xp', '0');
    rawSetItem('player_energy', '100');
    rawSetItem('task_pass_level', '1');
    rawSetItem('task_pass_current_tasks', '0');
    rawSetItem('task_pass_total_completed', '0');
    rawSetItem('task_level_2_unlocked', 'false');
    rawSetItem('task_selected_level_tab', '1');

    // 3. Tasks, Completion Records & Counters
    rawSetItem('completed_tasks_count', '0');
    rawSetItem('task_game_total_tasks_completed', '0');
    rawSetItem('task_game_total_tasks', '0');
    rawSetItem('task_game_completed_tasks', '{}');
    rawSetItem('task_completed_tasks', '{}');
    rawSetItem('task_unlocked_tasks', '{}');
    rawSetItem('tap_empire_common_completed_ids', '{}');
    rawSetItem('tap_empire_google_completed_ids', '[]');
    rawSetItem('tap_empire_star_unlocked_costs', '{}');
    rawSetItem('task_last_diamond_completed_count', '0');

    // 4. Events, Passes, Milestones & Offers
    rawSetItem('task_game_event_tasks', '0');
    rawSetItem('task_game_event_tasks_count', '0');
    rawSetItem('event_pack_completed_count', '0');
    rawSetItem('task_vip_pass_active', 'false');
    rawSetItem('season_6_pass_activated', 'false');
    rawSetItem('season_battle_pass_claimed', '{}');
    rawSetItem('wallet_one_time_offer_claimed', 'false');
    localStorage.removeItem('premium_vip_activated_at');
    localStorage.removeItem('season_pass_start_date');

    // 5. Streaks, Claims, Daily Rewards & Ad Limits
    rawSetItem('task_daily_streak_count', '0');
    rawSetItem('task_daily_streak_last_date', '');
    rawSetItem('task_daily_streak_penalty_date', '');
    rawSetItem('task_game_login_streak', '0');
    rawSetItem('task_game_streak_days', '0');
    rawSetItem('task_win_streak', '0');
    rawSetItem('task_game_claims', '{}');
    rawSetItem('task_coins_won_today', '0');
    rawSetItem('ads_watched_count', '0');
    rawSetItem('task_game_ads_watched_count', '0');
    rawSetItem('task_game_shop_bonus_limit', '0');

    // 6. Mini games & Spins/Chests activities
    rawSetItem('pandemic_rolls', '33');
    rawSetItem('pandemic_dna', '0');
    rawSetItem('pandemic_barriers', '0');
    rawSetItem('pandemic_turkey_pct', '0');
    rawSetItem('pandemic_gov_tier', '1');
    rawSetItem('task_games_played', '0');
    rawSetItem('task_games_played_today', '0');
    localStorage.removeItem('sunflower_game_state');
    localStorage.removeItem('honeybee_game_state');
    localStorage.removeItem('pandemic_state');

    // 7. Transactions, Cashout history, Shop unlocks, Feedback/Tickets & Referrals
    rawSetItem('task_game_withdrawals', '[]');
    rawSetItem('task_game_stars_transactions', '[]');
    rawSetItem('task_game_shop_unlocks', '{}');
    rawSetItem('tap_empire_pending_prizes', '{}');
    rawSetItem('task_game_daily_streak_v2', '{}');
    rawSetItem('task_game_streak_days', '0');
    rawSetItem('referral_star_milestones_claimed', '{}');
    rawSetItem('user_support_tickets', '[]');
    rawSetItem('task_game_referrals_list', '[]');
    rawSetItem('task_referral_count', '0');
    localStorage.removeItem('task_game_stars_rating');
    localStorage.removeItem('user_referral_code');
    localStorage.removeItem('task_game_user_referral_code');

    // 8. Achievements, Goals & Missions
    rawSetItem('achievements_progress', '{}');
    rawSetItem('missions_progress', '{}');

    // 9. Purge dynamic per-task and VIP verification storage keys
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (
        k.startsWith('task_opened_') ||
        k.startsWith('task_claimed_') ||
        k.startsWith('task_unlocked_') ||
        k.startsWith('extra_vip_tasks_') ||
        k.startsWith('vip_task_verified_')
      )) {
        localStorage.removeItem(k);
      }
    }

    rawSetItem('task_game_last_reset_at', Date.now().toString());
  } finally {
    isInternalSync = false;
  }

  updateAllDomBalances(0, 0, 0);

  window.dispatchEvent(new CustomEvent('balance:synced', {
    detail: { coins: 0, stars: 0, tickets: 0 }
  }));
  window.dispatchEvent(new CustomEvent('balance:changed', {
    detail: { coins: 0, stars: 0, tickets: 0 }
  }));
  window.dispatchEvent(new CustomEvent('task_game_users:updated', { detail: [] }));
}

/**
 * Reset an entire user account in Firebase Firestore to zero / initial default state.
 * Purges user data across 'users', 'players_data', 'referral_redemptions', and 'withdrawals'.
 */
async function resetUserAccountInCloud(userId, userObj = null) {
  if (!userId) return false;
  console.log(`%c[Firebase Cloud] Resetting ALL data to initial zero/default for user "${userId}"...`, "color: #f59e0b; font-weight: bold;");

  const altUid = (userObj && userObj.uid && userObj.uid !== userId) ? userObj.uid : null;
  const now = Date.now();
  const userName = (userObj && (userObj.name || userObj.displayName)) || 'Player';
  const userEmail = (userObj && userObj.email) || `${userId}@novatasks.io`;
  const userAvatar = (userObj && userObj.avatar) || '⚡';
  const userRole = (userObj && userObj.role === 'vip') ? 'vip' : 'player';

  const cleanInitialData = {
    uid: String(userId),
    id: String(userId),
    displayName: userName,
    name: userName,
    displayNameLower: String(userName).trim().toLowerCase(),
    email: userEmail,
    avatar: userAvatar,
    role: userRole,
    coins: 0,
    stars: 0,
    tickets: 0,
    diamonds: 0,
    ultraCredits: 0,
    ultraTotalCompleted: 0,
    claimedWalletOffers: {},
    xp: 0,
    energy: 100,
    level: 'LVL 1 • NOVICE',
    passLevel: 1,
    passTotalCompleted: 0,
    tasksCompleted: 0,
    totalTasks: 0,
    eventTasks: 0,
    adsWatched: 0,
    streakCount: 0,
    lastStreakDate: '',
    vipActive: false,
    passActivated: false,
    completedTasks: {},
    unlockedTasks: {},
    commonCompletedIds: {},
    googleCompletedIds: [],
    starUnlockedCosts: {},
    proGroupState: {},
    claims: {},
    claimedMilestones: {},
    sunflowerState: null,
    honeyBeeState: null,
    gameStats: {
      gamesPlayed: 0,
      coinsWonToday: 0,
      winStreak: 0
    },
    status: (userObj && userObj.status) || 'active',
    resetAt: now,
    updatedAt: now
  };

  if (rtdb) {
    try { await set(ref(rtdb, 'users/' + String(userId)), cleanInitialData); } catch (e) {}
    if (altUid) {
      try { await set(ref(rtdb, 'users/' + String(altUid)), { ...cleanInitialData, uid: String(altUid), id: String(altUid) }); } catch (e) {}
    }
    try { await set(ref(rtdb, 'players_data/' + String(userId)), null); } catch (e) {}
  }

  // 1. Reset 'users' document to clean initial state (indexed queries — safe at 10,000+ players)
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      await setDoc(doc(db, 'users', String(userId)), cleanInitialData);
      console.log(`[Firebase Cloud] Reset users/${userId} to initial default document.`);
    } catch (e) {
      markFirestoreQuotaBlocked(e);
      console.warn(`[Firebase Cloud] Error resetting users/${userId}:`, e.message);
    }

    if (altUid && !isFirestoreQuotaBlocked()) {
      try {
        await setDoc(doc(db, 'users', String(altUid)), { ...cleanInitialData, uid: String(altUid), id: String(altUid) });
      } catch (e) {}
    }

    // 2. Purge user records from 'players_data' via indexed userId query
    try {
      const pSnap = await getDocs(query(collection(db, 'players_data'), where('userId', '==', String(userId)), limit(100)));
      for (const d of pSnap.docs) {
        try { await deleteDoc(doc(db, 'players_data', d.id)); } catch (e) {}
      }
    } catch (e) {}

    // 3. Purge user redemptions from 'referral_redemptions' via indexed query
    try {
      const redSnap = await getDocs(query(collection(db, 'referral_redemptions'), where('redeemedByUserId', '==', String(userId)), limit(50)));
      for (const d of redSnap.docs) {
        try { await deleteDoc(doc(db, 'referral_redemptions', d.id)); } catch (e) {}
      }
    } catch (e) {}

    // 4. Purge user withdrawals from 'withdrawals' via indexed query
    try {
      const wdSnap = await getDocs(query(collection(db, 'withdrawals'), where('userId', '==', String(userId)), limit(100)));
      for (const d of wdSnap.docs) {
        try { await deleteDoc(doc(db, 'withdrawals', d.id)); } catch (e) {}
        if (rtdb) { try { await set(ref(rtdb, 'withdrawals/' + d.id), null); } catch (_) {} }
      }
    } catch (e) {}
  }

  // 5. If this is current local player session, reset local player storage
  const currentUid = (typeof getEffectivePlayerUid === 'function') ? getEffectivePlayerUid() : localStorage.getItem('player_uid');
  const currentName = localStorage.getItem('player_username');
  if (userId === currentUid || (altUid && altUid === currentUid) || (userObj && userObj.name && currentName === userObj.name)) {
    resetLocalPlayerSessionKeys();
  }

  // 6. Broadcast reset across all open tabs
  try {
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    ch.postMessage({
      type: 'USER_DATA_RESET',
      userId: userId,
      altUid: altUid,
      userName: userName,
      timestamp: now
    });
    ch.postMessage({
      type: 'BALANCES_UPDATED',
      coins: 0,
      stars: 0,
      tickets: 0,
      diamonds: 0,
      timestamp: now
    });
    ch.close();
  } catch (e) {}

  try {
    const bc = new BroadcastChannel('nova_task_sync');
    bc.postMessage({
      type: 'USER_DATA_RESET',
      userId: userId,
      altUid: altUid,
      userName: userName,
      timestamp: now
    });
    bc.postMessage({
      type: 'BALANCES_UPDATED',
      coins: 0,
      stars: 0,
      tickets: 0,
      diamonds: 0,
      timestamp: now
    });
    bc.close();
  } catch (e) {}

  console.log(`%c[Firebase Cloud] User "${userId}" all data successfully reset to zero/default.`, "color: #10b981; font-weight: bold;");
  return true;
}

/**
 * Completely remove all data for a deleted user from Firebase Firestore & RTDB
 * Uses indexed queries — safe at 10,000+ players.
 */
async function deleteUserFromCloud(userId, userObj = null) {
  if (!userId) return false;
  console.log(`%c[Firebase Cloud] Deleting all data for user "${userId}"...`, "color: #ef4444; font-weight: bold;");

  const altUid = (userObj && userObj.uid && userObj.uid !== userId) ? userObj.uid : null;

  if (rtdb) {
    try { await set(ref(rtdb, 'users/' + String(userId)), null); } catch (e) {}
    if (altUid) { try { await set(ref(rtdb, 'users/' + String(altUid)), null); } catch (e) {} }
    try { await set(ref(rtdb, 'players_data/' + String(userId)), null); } catch (e) {}
  }

  if (db && !isFirestoreQuotaBlocked()) {
    try { await deleteDoc(doc(db, 'users', String(userId))); } catch (e) { markFirestoreQuotaBlocked(e); }
    if (altUid && !isFirestoreQuotaBlocked()) {
      try { await deleteDoc(doc(db, 'users', String(altUid))); } catch (e) { markFirestoreQuotaBlocked(e); }
    }

    // Indexed cleanup for players_data
    try {
      const pSnap = await getDocs(query(collection(db, 'players_data'), where('userId', '==', String(userId)), limit(100)));
      for (const d of pSnap.docs) {
        try { await deleteDoc(doc(db, 'players_data', d.id)); } catch (e) {}
      }
    } catch (e) {}

    // Indexed cleanup for player referral codes (never touch reserved GLOBAL_* system docs)
    try {
      const codesSnap = await getDocs(query(collection(db, 'referral_codes'), where('userId', '==', String(userId)), limit(25)));
      for (const d of codesSnap.docs) {
        if (!['GLOBAL_TASKS', 'GLOBAL_APP_SETTINGS', 'LEADERBOARD_SESSIONS'].includes(d.id)) {
          try { await deleteDoc(doc(db, 'referral_codes', d.id)); } catch (err) {}
          if (rtdb) { try { await set(ref(rtdb, 'referral_codes/' + d.id), null); } catch (_) {} }
        }
      }
    } catch (e) {}

    // Indexed cleanup for referral_redemptions
    try {
      const redSnap = await getDocs(query(collection(db, 'referral_redemptions'), where('redeemedByUserId', '==', String(userId)), limit(50)));
      for (const d of redSnap.docs) {
        try { await deleteDoc(doc(db, 'referral_redemptions', d.id)); } catch (err) {}
        if (rtdb) { try { await set(ref(rtdb, 'referral_redemptions/' + d.id), null); } catch (_) {} }
      }
    } catch (e) {}

    // Indexed cleanup for withdrawals
    try {
      const wdSnap = await getDocs(query(collection(db, 'withdrawals'), where('userId', '==', String(userId)), limit(100)));
      for (const d of wdSnap.docs) {
        try { await deleteDoc(doc(db, 'withdrawals', d.id)); } catch (err) {}
        if (rtdb) { try { await set(ref(rtdb, 'withdrawals/' + d.id), null); } catch (_) {} }
      }
    } catch (e) {}
  }

  // 6. Clean local referral codes cache
  try {
    const rawLocal = localStorage.getItem('task_game_cloud_referral_codes');
    if (rawLocal) {
      const codes = JSON.parse(rawLocal);
      let changed = false;
      for (const k of Object.keys(codes)) {
        if (codes[k].userId === userId || (userObj && codes[k].userName === userObj.name)) {
          delete codes[k];
          changed = true;
        }
      }
      if (changed) localStorage.setItem('task_game_cloud_referral_codes', JSON.stringify(codes));
    }
  } catch (e) {}

  // 6.5 If this deleted user is current local player session, reset credentials and all local player data
  const currentUid = (typeof getEffectivePlayerUid === 'function') ? getEffectivePlayerUid() : localStorage.getItem('player_uid');
  const currentName = localStorage.getItem('player_username');
  if (userId === currentUid || (altUid && altUid === currentUid) || (userObj && userObj.name && currentName === userObj.name)) {
    localStorage.removeItem('player_uid');
    localStorage.removeItem('player_email');
    localStorage.removeItem('player_username');
    localStorage.removeItem('player_username_confirmed');
    localStorage.removeItem('player_avatar');
    localStorage.setItem('player_logged_in', 'false');
    resetLocalPlayerSessionKeys();
  }

  // 7. Broadcast deletion across all tabs
  try {
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    ch.postMessage({
      type: 'USER_DELETED_FROM_CLOUD',
      userId: userId,
      altUid: altUid,
      userName: userObj ? userObj.name : null,
      timestamp: Date.now()
    });
    ch.close();
  } catch (e) {}

  try {
    const bc = new BroadcastChannel('nova_task_sync');
    bc.postMessage({
      type: 'USER_DELETED_FROM_CLOUD',
      userId: userId,
      altUid: altUid,
      userName: userObj ? userObj.name : null,
      timestamp: Date.now()
    });
    bc.close();
  } catch (e) {}

  console.log(`%c[Firebase Cloud] User "${userId}" all data successfully deleted from Firebase.`, "color: #10b981; font-weight: bold;");
  return true;
}

const RESERVED_SYSTEM_REF_IDS = new Set(['GLOBAL_TASKS', 'GLOBAL_APP_SETTINGS', 'LEADERBOARD_SESSIONS']);

// Register user's unique referral code in Firebase Firestore & RTDB
async function registerReferralCodeInCloud(code, userId, userName) {
  if (!code) return false;
  const cleanCode = String(code).trim().toUpperCase();
  if (!cleanCode || RESERVED_SYSTEM_REF_IDS.has(cleanCode)) return false;
  await ensureFirebaseAuthReady(2000);
  const currentUid = auth && auth.currentUser ? auth.currentUser.uid : (userId || getEffectivePlayerUid());
  const referralData = {
    code: cleanCode,
    userId: String(currentUid),
    userName: userName || 'Player',
    rewardCoins: 100,
    updatedAt: Date.now()
  };

  try {
    const rawLocal = localStorage.getItem('task_game_cloud_referral_codes');
    const localCodes = rawLocal ? JSON.parse(rawLocal) : {};
    localCodes[cleanCode] = referralData;
    localStorage.setItem('task_game_cloud_referral_codes', JSON.stringify(localCodes));
  } catch (e) {}

  try {
    const rawAll = localStorage.getItem('task_game_all_registered_codes');
    const allCodes = rawAll ? JSON.parse(rawAll) : {};
    allCodes[cleanCode] = referralData;
    localStorage.setItem('task_game_all_registered_codes', JSON.stringify(allCodes));
  } catch (e) {}

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      await setDoc(doc(db, 'referral_codes', cleanCode), referralData, { merge: true });
    } catch (err) {
      markFirestoreQuotaBlocked(err);
    }
  }
  if (rtdb) {
    try { await set(ref(rtdb, 'referral_codes/' + cleanCode), referralData); } catch (e) {}
  }
  return true;
}

/**
 * Verify a referral code with Firebase Firestore & RTDB fallback
 */
async function verifyReferralCodeInCloud(code, currentUserId) {
  if (!code) {
    return { valid: false, error: 'Please enter a referral code to verify.' };
  }
  const cleanCode = String(code).trim().toUpperCase();
  if (RESERVED_SYSTEM_REF_IDS.has(cleanCode)) {
    return { valid: false, error: 'Invalid referral code.' };
  }

  // Self-referral check: Compare against current user's active referral code
  const myActiveCode = (localStorage.getItem('task_game_user_referral_code') || localStorage.getItem('user_referral_code') || '').toUpperCase();
  if (myActiveCode && cleanCode === myActiveCode) {
    return {
      valid: false,
      error: 'You cannot redeem your own profile referral code!'
    };
  }

  let cloudData = null;

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      const snap = await getDoc(doc(db, 'referral_codes', cleanCode));
      if (snap.exists()) cloudData = snap.data();
    } catch (err) {
      markFirestoreQuotaBlocked(err);
    }
  }

  if (!cloudData && rtdb) {
    try {
      const rSnap = await get(ref(rtdb, 'referral_codes/' + cleanCode));
      if (rSnap.exists()) cloudData = rSnap.val();
    } catch (e) {}
  }

  if (!cloudData) {
    try {
      const rawLocal = localStorage.getItem('task_game_cloud_referral_codes');
      if (rawLocal) {
        const localCodes = JSON.parse(rawLocal);
        if (localCodes[cleanCode]) {
          cloudData = localCodes[cleanCode];
        }
      }
    } catch (e) {}
  }

  if (!cloudData) {
    try {
      const rawAll = localStorage.getItem('task_game_all_registered_codes');
      if (rawAll) {
        const allCodes = JSON.parse(rawAll);
        if (allCodes[cleanCode]) {
          cloudData = allCodes[cleanCode];
        }
      }
    } catch (e) {}
  }

  if (!cloudData) {
    try {
      const rawUsers = localStorage.getItem('task_game_users');
      if (rawUsers) {
        const users = JSON.parse(rawUsers);
        const uMatch = users.find(u => (u.referralCode && u.referralCode.toUpperCase() === cleanCode) || (u.inviteCode && u.inviteCode.toUpperCase() === cleanCode));
        if (uMatch) {
          cloudData = {
            code: cleanCode,
            userId: uMatch.id,
            userName: uMatch.name || 'Friend',
            rewardCoins: 100
          };
        }
      }
    } catch (e) {}
  }

  if (!cloudData) {
    return {
      valid: false,
      error: `Code "${cleanCode}" not found. Enter a valid registered friend code.`
    };
  }

  if (auth && auth.currentUser && cloudData.userId && String(cloudData.userId) === String(auth.currentUser.uid)) {
    return {
      valid: false,
      error: 'You cannot redeem your own profile referral code!'
    };
  }

  const currentUserName = (localStorage.getItem('player_username') || '').trim().toLowerCase();
  const ownerName = (cloudData.userName || '').trim().toLowerCase();
  if (ownerName && currentUserName && ownerName === currentUserName && myActiveCode && myActiveCode === cleanCode) {
    return {
      valid: false,
      error: 'You cannot redeem your own profile referral code!'
    };
  }

  return {
    valid: true,
    code: cleanCode,
    ownerName: cloudData.userName || 'Friend',
    ownerUserId: cloudData.userId,
    rewardCoins: 100,
    source: db ? 'Firebase Firestore' : 'Firebase RTDB'
  };
}

/**
 * Record referral redemption in Firebase Firestore & RTDB
 */
async function redeemReferralCodeInCloud(code, currentUserId, currentUserName) {
  const cleanCode = String(code).trim().toUpperCase();
  if (!cleanCode || RESERVED_SYSTEM_REF_IDS.has(cleanCode)) return false;
  await ensureFirebaseAuthReady(2000);
  const effectiveUserId = (auth && auth.currentUser) ? auth.currentUser.uid : (currentUserId || getEffectivePlayerUid());
  const redKey = `${cleanCode}_${effectiveUserId}`;
  const record = {
    code: cleanCode,
    redeemedByUserId: String(effectiveUserId),
    redeemedByUserName: currentUserName || 'Player',
    rewardCoins: 100,
    redeemedAt: Date.now()
  };

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      await setDoc(doc(db, 'referral_redemptions', redKey), record, { merge: true });
    } catch (e) { markFirestoreQuotaBlocked(e); }
  }
  if (rtdb) {
    try { await set(ref(rtdb, 'referral_redemptions/' + redKey), record); } catch (e) {}
  }
  return true;
}

/**
 * Save Global Leaderboard Event to Firestore & RTDB (system/leaderboard_event)
 */
async function saveGlobalLeaderboardEventToCloud(eventData) {
  if (!eventData) return false;
  const payload = {
    ...eventData,
    updatedAt: Date.now()
  };
  let saved = false;
  try {
    localStorage.setItem('task_game_leaderboard_event', JSON.stringify(payload));
  } catch (e) {}
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      await setDoc(doc(db, 'system', 'leaderboard_event'), payload, { merge: true });
      saved = true;
    } catch (e) {
      markFirestoreQuotaBlocked(e);
      console.warn('[Firebase] Could not save global event to Firestore:', e.message);
    }
  }
  if (rtdb) {
    try {
      await set(ref(rtdb, 'system/leaderboard_event'), payload);
      saved = true;
    } catch (e) {}
  }
  return saved;
}

/**
 * Dual Real-time listener for Global Leaderboard Event (Firestore + RTDB)
 */
function listenToCloudLeaderboardEvent(callback) {
  let unsubFs = null;
  let unsubRt = null;
  let lastEventTs = 0;

  const applyEventData = (data) => {
    if (!data || !data.endTime) return;
    const ts = Number(data.updatedAt || 0) || 0;
    if (lastEventTs > 0 && ts > 0 && ts + 500 < lastEventTs) return;
    if (ts > lastEventTs) lastEventTs = ts;
    try {
      localStorage.setItem('task_game_leaderboard_event', JSON.stringify(data));
      const ch = new BroadcastChannel('nova_task_sync');
      ch.postMessage({ type: 'EVENT_SYNCED', event: data, timestamp: Date.now() });
      ch.close();
    } catch (e) {}
    if (typeof callback === 'function') {
      try { callback(data); } catch (e) {}
    }
  };

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      unsubFs = onSnapshot(doc(db, 'system', 'leaderboard_event'), (snapshot) => {
        if (snapshot.exists()) applyEventData(snapshot.data());
      }, (err) => { markFirestoreQuotaBlocked(err); });
    } catch (e) {}
  }
  if (rtdb) {
    try {
      unsubRt = onValue(ref(rtdb, 'system/leaderboard_event'), (snap) => {
        if (snap.exists()) applyEventData(snap.val());
      }, () => {});
    } catch (e) {}
  }
  return () => {
    if (typeof unsubFs === 'function') unsubFs();
    if (typeof unsubRt === 'function') unsubRt();
  };
}

/**
 * Save withdrawal to Firestore & RTDB (withdrawals/{id})
 */
async function saveWithdrawalToCloud(withdrawalData) {
  if (!withdrawalData) return false;
  try {
    await ensureFirebaseAuthReady(2000);
    const id = withdrawalData.id || ('wd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
    const contactValue = String(withdrawalData.contactInfo || withdrawalData.whatsapp || withdrawalData.email || '').trim();
    const inferredType = withdrawalData.contactType || (contactValue.includes('@') ? 'email' : 'mobile');
    const effUid = withdrawalData.userId || getEffectivePlayerUid();
    const authUid = (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : effUid;
    const payload = {
      ...withdrawalData,
      id: String(id),
      userId: String(effUid),
      ownerAuthUid: String(withdrawalData.ownerAuthUid || authUid),
      playerName: withdrawalData.playerName || withdrawalData.userName || localStorage.getItem('player_username') || 'Player',
      contactInfo: contactValue,
      contactType: inferredType,
      whatsapp: contactValue,
      email: inferredType === 'email' ? contactValue : (withdrawalData.email || ''),
      deliveryStatus: withdrawalData.deliveryStatus || 'Pending Review',
      expectedDeliveryDays: Number(withdrawalData.expectedDeliveryDays || 10),
      createdAt: withdrawalData.createdAt || Date.now(),
      status: withdrawalData.status || 'pending',
      updatedAt: Date.now()
    };
    let ok = false;
    if (db && !isFirestoreQuotaBlocked()) {
      try {
        await setDoc(doc(db, 'withdrawals', String(id)), payload, { merge: true });
        ok = true;
      } catch (fsErr) {
        markFirestoreQuotaBlocked(fsErr);
      }
    }
    if (rtdb) {
      try {
        await update(ref(rtdb, 'withdrawals/' + String(id)), payload);
        ok = true;
      } catch (rtdbWdErr) {
        console.warn('[Firebase RTDB] RTDB withdrawal save notice:', rtdbWdErr.message);
      }
    }
    return ok;
  } catch (err) {
    console.warn('[Firebase] Could not save withdrawal to cloud:', err.message);
    return false;
  }
}

function maskWithdrawalContactForNonAdmin(row) {
  if (!row || typeof row !== 'object') return row;
  if (isAuthorizedAdminSession()) return row;
  const uid = getEffectivePlayerUid();
  const authUid = (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : '';
  if ((uid && String(row.userId || '') === String(uid)) || (authUid && String(row.ownerAuthUid || '') === String(authUid))) return row;
  return {
    ...row,
    whatsapp: '***',
    email: '***',
    contactInfo: '***',
    contact: '***'
  };
}

/**
 * Real-time listener for withdrawals in Firestore & RTDB
 * Admin streams full withdrawals queue; players query strictly own records matching security rules.
 */
function listenToCloudWithdrawals(callback) {
  const merged = new Map();
  let unsubFs = null;
  let unsubRtdb = null;
  let cancelled = false;

  const stripUndef = (obj) => {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach((k) => {
      if (obj[k] !== undefined && obj[k] !== '') out[k] = obj[k];
    });
    return out;
  };

  const mergeEntry = (id, incoming, preferIncoming = true) => {
    const key = String(id);
    const existing = merged.get(key) || {};
    const inc = stripUndef(incoming);
    const combined = preferIncoming ? { ...existing, ...inc } : { ...inc, ...existing };
    if (existing.contactInfo && existing.contactInfo !== '***' && inc.contactInfo === '***') {
      combined.contactInfo = existing.contactInfo;
    }
    combined.id = key;
    merged.set(key, combined);
  };

  const emit = () => {
    if (cancelled || typeof callback !== 'function') return;
    try {
      const localRaw = JSON.parse(localStorage.getItem('task_game_withdrawals') || '[]');
      if (Array.isArray(localRaw)) {
        localRaw.forEach((lw) => {
          if (lw && lw.id) {
            const key = String(lw.id);
            const existing = merged.get(key);
            if (!existing) {
              merged.set(key, lw);
            } else {
              const pickLocal = Number(lw.updatedAt || lw.deliveryUpdatedAt || 0) > Number(existing.updatedAt || existing.deliveryUpdatedAt || 0);
              mergeEntry(key, lw, pickLocal);
            }
          }
        });
      }
    } catch (e) {}
    const sorted = Array.from(merged.values())
      .map(maskWithdrawalContactForNonAdmin)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    callback(sorted);
  };

  const startListeners = async () => {
    const isAdmin = isAuthorizedAdminSession();
    let authUid = (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : '';
    if (!isAdmin && !authUid) {
      const u = await ensureFirebaseAuthReady(2500);
      if (cancelled) return;
      authUid = (u && u.uid) ? u.uid : getEffectivePlayerUid();
    }

    if (db && !isFirestoreQuotaBlocked()) {
      try {
        const wdSource = isAdmin
          ? collection(db, 'withdrawals')
          : query(collection(db, 'withdrawals'), where('ownerAuthUid', '==', String(authUid)), limit(100));
        unsubFs = onSnapshot(wdSource, (snapshot) => {
          snapshot.forEach((d) => mergeEntry(d.id, d.data()));
          emit();
        }, (err) => { markFirestoreQuotaBlocked(err); });
      } catch (e) {}
    }

    if (rtdb) {
      try {
        const wdRtdbRef = isAdmin
          ? ref(rtdb, 'withdrawals')
          : rtdbQuery(ref(rtdb, 'withdrawals'), orderByChild('ownerAuthUid'), equalTo(String(authUid)));
        unsubRtdb = onValue(wdRtdbRef, (snap) => {
          if (snap.exists()) {
            const obj = snap.val() || {};
            Object.entries(obj).forEach(([k, v]) => {
              if (v && typeof v === 'object') {
                const existing = merged.get(String(k));
                if (!existing || Number(v.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
                  mergeEntry(k, v);
                }
              }
            });
            emit();
          }
        }, () => {});
      } catch (e) {}
    }
  };

  startListeners();

  return () => {
    cancelled = true;
    if (typeof unsubFs === 'function') unsubFs();
    if (typeof unsubRtdb === 'function') unsubRtdb();
  };
}

/**
 * Save Admin Ad configuration to Firestore & RTDB (system/ad_config)
 */
async function saveAdConfigToCloud(config) {
  if (!config) return false;
  const payload = {
    ...config,
    updatedAt: Date.now()
  };
  try { localStorage.setItem('task_game_ad_config', JSON.stringify(payload)); } catch (e) {}
  let ok = false;
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      await setDoc(doc(db, 'system', 'ad_config'), payload, { merge: true });
      ok = true;
    } catch (err) { markFirestoreQuotaBlocked(err); }
  }
  if (rtdb) {
    try {
      await set(ref(rtdb, 'system/ad_config'), payload);
      ok = true;
    } catch (e) {}
  }
  return ok;
}

/**
 * Dual Real-time listener for Ad config in Firestore & RTDB
 */
function listenToCloudAdConfig(callback) {
  let unsubFs = null;
  let unsubRt = null;
  const applyAdConfig = (data) => {
    if (!data) return;
    try { localStorage.setItem('task_game_ad_config', JSON.stringify(data)); } catch (e) {}
    if (typeof callback === 'function') callback(data);
  };
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      unsubFs = onSnapshot(doc(db, 'system', 'ad_config'), (snapshot) => {
        if (snapshot.exists()) applyAdConfig(snapshot.data());
      }, (err) => { markFirestoreQuotaBlocked(err); });
    } catch (e) {}
  }
  if (rtdb) {
    try {
      unsubRt = onValue(ref(rtdb, 'system/ad_config'), (snap) => {
        if (snap.exists()) applyAdConfig(snap.val());
      }, () => {});
    } catch (e) {}
  }
  return () => {
    if (typeof unsubFs === 'function') unsubFs();
    if (typeof unsubRt === 'function') unsubRt();
  };
}

/**
 * Bounded Real-time listener for Leaderboard Top 100 Contenders (Firestore + RTDB fallback)
 * Safe at 10,000+ players (uses indexed limit(100) query & compact caching).
 */
function listenToLeaderboardFromCloud(callback) {
  let unsubFs = null;
  let cancelled = false;

  const normalizeLbRows = (rawRows) => {
    const users = rawRows
      .filter(u => u && typeof u === 'object')
      .map(u => projectCompactAdminUser(u.id || u.uid, u))
      .filter(u => u.status !== 'suspended');
    users.sort((a, b) => (b.eventTasks - a.eventTasks) || (b.stars - a.stars) || (b.totalTasks - a.totalTasks) || (b.coins - a.coins));
    cacheCompactUsersSummary(users);
    if (typeof callback === 'function') {
      try { callback(users); } catch (e) {}
    }
  };

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      const topQ = query(collection(db, 'users'), orderBy('stars', 'desc'), limit(100));
      unsubFs = onSnapshot(topQ, (snapshot) => {
        const rows = [];
        snapshot.forEach((d) => rows.push({ id: d.id, ...(d.data() || {}) }));
        normalizeLbRows(rows);
      }, (err) => {
        if (!isFirestoreQuotaBlocked()) {
          try {
            unsubFs = onSnapshot(query(collection(db, 'users'), limit(100)), (snap) => {
              const rows = [];
              snap.forEach((d) => rows.push({ id: d.id, ...(d.data() || {}) }));
              normalizeLbRows(rows);
            }, (e2) => markFirestoreQuotaBlocked(e2));
          } catch (e3) {}
        }
      });
    } catch (e) {}
  } else if (rtdb) {
    try {
      const topRtdbQ = rtdbQuery(ref(rtdb, 'users'), orderByChild('stars'), limitToLast(100));
      get(topRtdbQ).then((snap) => {
        if (!cancelled && snap.exists()) {
          const rows = Object.entries(snap.val() || {}).map(([k, v]) => ({ id: k, ...(v || {}) }));
          normalizeLbRows(rows);
        }
      }).catch(() => {});
    } catch (e) {}
  }

  return () => {
    cancelled = true;
    if (typeof unsubFs === 'function') unsubFs();
  };
}

/**
 * Save Leaderboard Sessions history to Firestore & RTDB
 */
async function saveLeaderboardSessionsToCloud(sessions) {
  if (!Array.isArray(sessions)) return false;
  let saved = false;
  const payload = {
    sessions: sessions,
    count: sessions.length,
    updatedAt: Date.now()
  };
  try { localStorage.setItem('task_game_leaderboard_sessions', JSON.stringify(sessions)); } catch (e) {}

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      await setDoc(doc(db, 'system', 'leaderboard_sessions'), payload, { merge: true });
      saved = true;
    } catch (err) { markFirestoreQuotaBlocked(err); }
    if (!isFirestoreQuotaBlocked()) {
      try {
        await setDoc(doc(db, 'referral_codes', 'LEADERBOARD_SESSIONS'), payload, { merge: true });
        saved = true;
      } catch (e) {}
    }
  }
  if (rtdb) {
    try {
      await set(ref(rtdb, 'system/leaderboard_sessions'), payload);
      saved = true;
    } catch (e) {}
  }
  return saved;
}

/**
 * Dual Real-time listener for Leaderboard Sessions (Firestore + RTDB)
 */
function listenToCloudLeaderboardSessions(callback) {
  let unsubSys = null;
  let unsubLegacy = null;
  let unsubRt = null;

  const applySessions = (data) => {
    if (data && Array.isArray(data.sessions)) {
      try { localStorage.setItem('task_game_leaderboard_sessions', JSON.stringify(data.sessions)); } catch (e) {}
      if (typeof callback === 'function') callback(data.sessions);
    }
  };

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      unsubSys = onSnapshot(doc(db, 'system', 'leaderboard_sessions'), (snap) => {
        if (snap.exists()) applySessions(snap.data());
      }, (err) => { markFirestoreQuotaBlocked(err); });
    } catch (e) {}
    try {
      unsubLegacy = onSnapshot(doc(db, 'referral_codes', 'LEADERBOARD_SESSIONS'), (snap) => {
        if (snap.exists()) applySessions(snap.data());
      }, () => {});
    } catch (e) {}
  }
  if (rtdb) {
    try {
      unsubRt = onValue(ref(rtdb, 'system/leaderboard_sessions'), (snap) => {
        if (snap.exists()) applySessions(snap.val());
      }, () => {});
    } catch (e) {}
  }

  return () => {
    if (typeof unsubSys === 'function') unsubSys();
    if (typeof unsubLegacy === 'function') unsubLegacy();
    if (typeof unsubRt === 'function') unsubRt();
  };
}

const APP_SETTINGS_STORAGE_KEY = 'tap_empire_app_settings';
const PROCESSED_TXS_KEY = 'tap_empire_processed_txs';
const TX_LOG_STORAGE_KEY = 'tap_empire_tx_log';
const _pendingTxLocks = new Set();

const DEFAULT_APP_SETTINGS = {
  categoryLimits: {
    common: 10,
    simple: 10,
    star: 10,
    pro: 3,
    ultra: 5,
    quiz: 30,
    diamond: 10,
    google: 10
  },
  starUnlock: {
    googleTasksPerUnlock: 2
  },
  vipPlan: {
    costStars: 1000,
    dailyTasksLimit: 10,
    durationDays: 30,
    enabled: true,
    restrictions: '1,000 Stars for 10 Star Tasks/day. Resets daily at midnight local time.'
  },
  vipPlans: [
    {
      id: 'vip_500',
      title: 'VIP Silver Pass',
      badge: '⭐ STARTER PASS',
      costStars: 500,
      dailyTasksLimit: 5,
      durationDays: 7,
      enabled: true,
      restrictions: '500 Stars for 5 Star Tasks/day (7 Days). Resets daily at midnight.'
    },
    {
      id: 'vip_1000',
      title: 'VIP Gold Pass',
      badge: '👑 POPULAR PASS',
      costStars: 1000,
      dailyTasksLimit: 10,
      durationDays: 30,
      enabled: true,
      restrictions: '1,000 Stars for 10 Star Tasks/day (30 Days). Resets daily at midnight.'
    },
    {
      id: 'vip_5000',
      title: 'VIP Diamond Pass',
      badge: '💎 MAX PASS',
      costStars: 5000,
      dailyTasksLimit: 30,
      durationDays: 90,
      enabled: true,
      restrictions: '5,000 Stars for 30 Star Tasks/day (90 Days). Resets daily at midnight.'
    }
  ],
  proGroup: {
    costAmount: 5000,
    costCurrency: 'coins',
    timerMinutes: 1440,
    dailyLimit: 3,
    active: true
  },
  dailyProgression: {
    freeTasksPerDay: 10,
    dailyIncrement: 10,
    allowAdExtraTasks: true,
    adExtraTaskCount: 20
  },
  walletOffers: {
    oneTimeOffer: {
      enabled: true,
      title: '₹50 Amazon Shopping Voucher',
      giftAmountInr: 50,
      starCost: 1500,
      requiredUltraTasks: 3,
      deductUltraTasks: 3,
      timerHours: 48,
      countdownEndMs: 0
    },
    ultraMilestones: [
      { id: 'ultra_ms_100', title: '₹1,000 Amazon Shopping Voucher', requiredUltraTasks: 20, deductUltraTasks: 20, giftAmountInr: 1000, starCost: 10000, enabled: true },
      { id: 'ultra_ms_500', title: '₹5,000 Amazon Shopping Voucher', requiredUltraTasks: 80, deductUltraTasks: 80, giftAmountInr: 5000, starCost: 50000, enabled: true },
      { id: 'ultra_ms_1000', title: '₹10,000 Amazon Shopping Voucher', requiredUltraTasks: 140, deductUltraTasks: 140, giftAmountInr: 10000, starCost: 100000, enabled: true }
    ]
  },
  eventLevels: [
    { level: 1, title: 'Level 1', requirementTasks: 1, rewardCoins: 50, rewardStars: 10, unlockCost: 0, unlockCurrency: 'coins', active: true },
    { level: 2, title: 'Level 2', requirementTasks: 5, rewardCoins: 100, rewardStars: 20, unlockCost: 0, unlockCurrency: 'coins', active: true },
    { level: 3, title: 'Level 3', requirementTasks: 15, rewardCoins: 200, rewardStars: 40, unlockCost: 0, unlockCurrency: 'coins', active: true },
    { level: 4, title: 'Level 4', requirementTasks: 30, rewardCoins: 350, rewardStars: 75, unlockCost: 0, unlockCurrency: 'coins', active: true },
    { level: 5, title: 'Level 5', requirementTasks: 50, rewardCoins: 500, rewardStars: 120, unlockCost: 0, unlockCurrency: 'coins', active: true }
  ],
  seasonPass: {
    startTime: 0,
    endTime: 0
  },
  updatedAt: 0
};

function mergeVipPlans(basePlans, incomingPlans) {
  const def = DEFAULT_APP_SETTINGS.vipPlans;
  const fallback = Array.isArray(basePlans) && basePlans.length > 0 ? basePlans : def;
  const srcList = Array.isArray(incomingPlans) && incomingPlans.length > 0 ? incomingPlans : fallback;
  return def.map((defPlan, idx) => {
    const match = srcList.find((p) => p && (p.id === defPlan.id || Number(p.costStars) === Number(defPlan.costStars))) || srcList[idx] || {};
    return {
      id: match.id || defPlan.id,
      title: String(match.title || defPlan.title),
      badge: String(match.badge || defPlan.badge),
      costStars: Math.max(1, parseInt(match.costStars !== undefined ? match.costStars : defPlan.costStars, 10) || defPlan.costStars),
      dailyTasksLimit: Math.max(1, parseInt(match.dailyTasksLimit !== undefined ? match.dailyTasksLimit : defPlan.dailyTasksLimit, 10) || defPlan.dailyTasksLimit),
      durationDays: Math.max(1, parseInt(match.durationDays !== undefined ? match.durationDays : defPlan.durationDays, 10) || defPlan.durationDays),
      enabled: match.enabled !== false,
      restrictions: String(match.restrictions || defPlan.restrictions)
    };
  });
}

function mergeWalletOffers(baseOffers, incomingOffers) {
  const def = DEFAULT_APP_SETTINGS.walletOffers;
  const inc = incomingOffers && typeof incomingOffers === 'object' ? incomingOffers : {};
  const base = baseOffers && typeof baseOffers === 'object' ? baseOffers : def;
  const milestones = Array.isArray(inc.ultraMilestones)
    ? inc.ultraMilestones.map((m, idx) => {
        const defMs = def.ultraMilestones[idx] || def.ultraMilestones[0];
        const reqVal = Math.max(1, parseInt(m.requiredUltraTasks !== undefined ? m.requiredUltraTasks : defMs.requiredUltraTasks, 10) || defMs.requiredUltraTasks);
        const rawStar = m.starCost !== undefined ? parseInt(m.starCost, 10) : defMs.starCost;
        return {
          id: m.id || defMs.id || `ultra_ms_${idx + 1}`,
          title: m.title || `₹${Number(m.giftAmountInr || defMs.giftAmountInr).toLocaleString()} Amazon Shopping Voucher`,
          requiredUltraTasks: reqVal,
          deductUltraTasks: Math.max(0, parseInt(m.deductUltraTasks !== undefined ? m.deductUltraTasks : reqVal, 10) || 0),
          giftAmountInr: Math.max(1, parseInt(m.giftAmountInr || defMs.giftAmountInr, 10) || defMs.giftAmountInr),
          starCost: Math.max(0, Number.isFinite(rawStar) ? rawStar : defMs.starCost),
          enabled: m.enabled !== false
        };
      })
    : (Array.isArray(base.ultraMilestones) ? base.ultraMilestones : def.ultraMilestones).map(m => ({ ...m }));
  return {
    oneTimeOffer: { ...def.oneTimeOffer, ...(base.oneTimeOffer || {}), ...(inc.oneTimeOffer || {}) },
    ultraMilestones: milestones
  };
}

function mergeAppSettings(incoming) {
  const src = incoming && typeof incoming === 'object' ? incoming : {};
  const mergedVipPlans = mergeVipPlans(DEFAULT_APP_SETTINGS.vipPlans, src.vipPlans);
  const primaryVip = mergedVipPlans.find((p) => p.id === 'vip_1000') || mergedVipPlans[1] || mergedVipPlans[0];
  return {
    categoryLimits: { ...DEFAULT_APP_SETTINGS.categoryLimits, ...(src.categoryLimits || {}) },
    starUnlock: {
      googleTasksPerUnlock: 2,
      ...(DEFAULT_APP_SETTINGS.starUnlock || {}),
      ...(src.starUnlock || {})
    },
    vipPlan: { ...DEFAULT_APP_SETTINGS.vipPlan, ...(primaryVip ? { costStars: primaryVip.costStars, dailyTasksLimit: primaryVip.dailyTasksLimit, durationDays: primaryVip.durationDays, enabled: primaryVip.enabled, restrictions: primaryVip.restrictions } : {}), ...(src.vipPlan || {}) },
    vipPlans: mergedVipPlans,
    proGroup: { ...DEFAULT_APP_SETTINGS.proGroup, ...(src.proGroup || {}) },
    dailyProgression: (() => {
      const mergedProg = { ...DEFAULT_APP_SETTINGS.dailyProgression, ...(src.dailyProgression || {}) };
      if (!mergedProg.customAdExtra && Number(mergedProg.adExtraTaskCount) === 5) {
        mergedProg.adExtraTaskCount = 20;
      }
      return mergedProg;
    })(),
    walletOffers: mergeWalletOffers(DEFAULT_APP_SETTINGS.walletOffers, src.walletOffers),
    eventLevels: Array.isArray(src.eventLevels) && src.eventLevels.length > 0 ? src.eventLevels : DEFAULT_APP_SETTINGS.eventLevels.map(l => ({ ...l })),
    seasonPass: {
      startTime: Math.max(0, Number((src.seasonPass && src.seasonPass.startTime) ?? DEFAULT_APP_SETTINGS.seasonPass.startTime ?? 0) || 0),
      endTime: Math.max(0, Number((src.seasonPass && src.seasonPass.endTime) ?? DEFAULT_APP_SETTINGS.seasonPass.endTime ?? 0) || 0)
    },
    updatedAt: Number(src.updatedAt || Date.now())
  };
}

function syncSeasonPassTimersToStorage(seasonPass) {
  if (!seasonPass || typeof seasonPass !== 'object') return;
  try {
    if (typeof seasonPass.startTime === 'number') {
      if (seasonPass.startTime > 0) {
        localStorage.setItem('season_pass_start_timestamp', String(seasonPass.startTime));
      } else {
        localStorage.setItem('season_pass_start_timestamp', '0');
      }
    }
    if (typeof seasonPass.endTime === 'number' && seasonPass.endTime > 0) {
      localStorage.setItem('season_pass_end_timestamp', String(seasonPass.endTime));
    }
  } catch (e) {}
}

function getAppSettings() {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (raw) return mergeAppSettings(JSON.parse(raw));
  } catch (e) {}
  return mergeAppSettings({});
}

async function saveAppSettingsToCloud(partialSettings) {
  const current = getAppSettings();
  const merged = mergeAppSettings({
    ...current,
    ...(partialSettings || {}),
    categoryLimits: { ...current.categoryLimits, ...((partialSettings && partialSettings.categoryLimits) || {}) },
    starUnlock: { ...(current.starUnlock || { googleTasksPerUnlock: 2 }), ...((partialSettings && partialSettings.starUnlock) || {}) },
    vipPlan: { ...current.vipPlan, ...((partialSettings && partialSettings.vipPlan) || {}) },
    vipPlans: mergeVipPlans(current.vipPlans, partialSettings && partialSettings.vipPlans),
    proGroup: { ...current.proGroup, ...((partialSettings && partialSettings.proGroup) || {}) },
    dailyProgression: { ...current.dailyProgression, ...((partialSettings && partialSettings.dailyProgression) || {}) },
    walletOffers: mergeWalletOffers(current.walletOffers, partialSettings && partialSettings.walletOffers),
    eventLevels: (partialSettings && Array.isArray(partialSettings.eventLevels)) ? partialSettings.eventLevels : current.eventLevels,
    seasonPass: {
      ...(current.seasonPass || DEFAULT_APP_SETTINGS.seasonPass),
      ...((partialSettings && partialSettings.seasonPass) || {})
    },
    updatedAt: Date.now()
  });

  localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  syncSeasonPassTimersToStorage(merged.seasonPass);
  window.dispatchEvent(new CustomEvent('settings:changed', { detail: merged }));
  try {
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    ch.postMessage({ type: 'SETTINGS_UPDATED', settings: merged, timestamp: Date.now() });
    if (partialSettings && partialSettings.seasonPass) {
      ch.postMessage({
        type: 'SEASON_TIMER_UPDATED',
        startTime: merged.seasonPass.startTime,
        endTime: merged.seasonPass.endTime,
        timestamp: Date.now()
      });
    }
    ch.close();
  } catch (e) {}

  let ok = false;
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      await setDoc(doc(db, 'referral_codes', 'GLOBAL_APP_SETTINGS'), {
        code: 'GLOBAL_APP_SETTINGS',
        settingsJson: JSON.stringify(merged),
        updatedAt: merged.updatedAt
      }, { merge: true });
      ok = true;
    } catch (e) { markFirestoreQuotaBlocked(e); }
    if (!isFirestoreQuotaBlocked()) {
      try {
        await setDoc(doc(db, 'system', 'app_settings'), {
          ...merged,
          settingsJson: JSON.stringify(merged)
        }, { merge: true });
        ok = true;
      } catch (e) { markFirestoreQuotaBlocked(e); }
    }
  }
  if (rtdb) {
    try {
      await set(ref(rtdb, 'system/app_settings'), merged);
      ok = true;
    } catch (e) {}
  }
  return ok;
}

function listenToAppSettings(callback) {
  let lastSettingsTs = 0;
  const applySettings = (rawObj) => {
    if (!rawObj || typeof rawObj !== 'object') return;
    let parsedFromJson = {};
    if (typeof rawObj.settingsJson === 'string' && rawObj.settingsJson.trim()) {
      try { parsedFromJson = JSON.parse(rawObj.settingsJson) || {}; } catch (e) {}
    }
    const structuredKeys = ['categoryLimits', 'starUnlock', 'vipPlan', 'vipPlans', 'proGroup', 'dailyProgression', 'walletOffers', 'eventLevels', 'seasonPass'];
    const structuredOverrides = {};
    structuredKeys.forEach((k) => {
      if (rawObj[k] !== undefined) structuredOverrides[k] = rawObj[k];
    });
    const combinedRaw = {
      ...parsedFromJson,
      ...structuredOverrides,
      updatedAt: Number(rawObj.updatedAt || parsedFromJson.updatedAt || Date.now())
    };
    const merged = mergeAppSettings(combinedRaw);
    if (lastSettingsTs > 0 && merged.updatedAt > 0 && merged.updatedAt + 500 < lastSettingsTs) {
      return;
    }
    lastSettingsTs = Math.max(lastSettingsTs, merged.updatedAt || Date.now());
    const localCur = getAppSettings();
    if (!localCur.updatedAt || merged.updatedAt >= localCur.updatedAt) {
      localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      syncSeasonPassTimersToStorage(merged.seasonPass);
      window.dispatchEvent(new CustomEvent('settings:changed', { detail: merged }));
      if (typeof callback === 'function') callback(merged);
    }
  };

  let unsubGlobal = null;
  let unsubSys = null;
  let unsubRtdb = null;

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      unsubGlobal = onSnapshot(doc(db, 'referral_codes', 'GLOBAL_APP_SETTINGS'), (snap) => {
        if (snap.exists()) applySettings(snap.data());
      }, (err) => { markFirestoreQuotaBlocked(err); });
    } catch (e) {}
    try {
      unsubSys = onSnapshot(doc(db, 'system', 'app_settings'), (snap) => {
        if (snap.exists()) applySettings(snap.data());
      }, (err) => { markFirestoreQuotaBlocked(err); });
    } catch (e) {}
  }
  if (rtdb) {
    try {
      unsubRtdb = onValue(ref(rtdb, 'system/app_settings'), (snap) => {
        if (snap.exists()) applySettings(snap.val());
      }, () => {});
    } catch (e) {}
  }

  return () => {
    if (typeof unsubGlobal === 'function') unsubGlobal();
    if (typeof unsubSys === 'function') unsubSys();
    if (typeof unsubRtdb === 'function') unsubRtdb();
  };
}

function getCurrencyMeta(currency = 'coins') {
  const c = String(currency || 'coins').toLowerCase();
  if (c === 'tickets' || c === 'ticket') return { key: 'tickets', icon: '🎟️', label: 'Tickets' };
  if (c === 'stars' || c === 'star') return { key: 'stars', icon: '⭐', label: 'Stars' };
  if (c === 'diamonds' || c === 'diamond') return { key: 'diamonds', icon: '💎', label: 'Diamonds' };
  return { key: 'coins', icon: '🪙', label: 'Coins' };
}

function getTodayLocalDateKey(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function atomicBalanceMutation({ deltaCoins = 0, deltaStars = 0, deltaTickets = 0, deltaDiamonds = 0, deltaUltraCredits = 0, deltaUltraTotal = 0, claimOfferKey = null, reason = 'Transaction', txId = null, meta = {} } = {}) {
  const id = txId || (`tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  if (_pendingTxLocks.has(id)) {
    return { ok: false, duplicate: true, error: 'Transaction already in progress' };
  }

  let processed = {};
  try { processed = JSON.parse(localStorage.getItem(PROCESSED_TXS_KEY) || '{}'); } catch (e) { processed = {}; }
  if (processed[id]) {
    return { ok: false, duplicate: true, error: 'Duplicate transaction blocked' };
  }

  let claimedOffers = {};
  try { claimedOffers = JSON.parse(localStorage.getItem('wallet_claimed_offers') || '{}') || {}; } catch (e) { claimedOffers = {}; }
  if (claimOfferKey && claimedOffers[claimOfferKey]) {
    return { ok: false, duplicate: true, error: 'This offer or milestone has already been claimed!' };
  }

  const curC = firebaseSync.getCoins();
  const curS = firebaseSync.getStars();
  const curT = firebaseSync.getTickets();
  const curD = firebaseSync.getDiamonds();
  const curU = firebaseSync.getUltraCredits();
  const curUT = firebaseSync.getUltraTotalCompleted();

  const dC = parseInt(deltaCoins, 10) || 0;
  const dS = parseInt(deltaStars, 10) || 0;
  const dT = parseInt(deltaTickets, 10) || 0;
  const dD = parseInt(deltaDiamonds, 10) || 0;
  const dU = parseInt(deltaUltraCredits, 10) || 0;
  const dUT = parseInt(deltaUltraTotal, 10) || 0;

  const nextC = curC + dC;
  const nextS = curS + dS;
  const nextT = curT + dT;
  const nextD = curD + dD;
  const nextU = curU + dU;
  const nextUT = Math.max(0, curUT + dUT);

  if (nextC < 0 || nextS < 0 || nextT < 0 || nextD < 0 || nextU < 0) {
    return { ok: false, error: nextU < 0 ? 'Insufficient Ultra Task credits' : 'Insufficient balance' };
  }

  _pendingTxLocks.add(id);
  try {
    processed[id] = Date.now();
    const keys = Object.keys(processed);
    if (keys.length > 500) {
      keys.sort((a, b) => processed[a] - processed[b]).slice(0, keys.length - 400).forEach(k => delete processed[k]);
    }
    rawSetItem(PROCESSED_TXS_KEY, JSON.stringify(processed));

    const prevOffersSnapshot = { ...claimedOffers };
    const nextOffers = claimOfferKey ? { ...claimedOffers, [claimOfferKey]: Date.now() } : claimedOffers;

    isInternalSync = true;
    try {
      rawSetItem('task_game_coins', String(nextC));
      rawSetItem('user_coins', String(nextC));
      rawSetItem('task_game_coins_alt', String(nextC));
      rawSetItem('task_game_stars', String(nextS));
      rawSetItem('user_stars', String(nextS));
      rawSetItem('task_user_tickets', String(nextT));
      rawSetItem('user_tickets', String(nextT));
      rawSetItem('task_game_tickets', String(nextT));
      rawSetItem('task_user_diamonds', String(nextD));
      rawSetItem('user_diamonds', String(nextD));
      rawSetItem('wallet_ultra_task_credits', String(nextU));
      rawSetItem('wallet_ultra_total_completed', String(nextUT));
      if (claimOfferKey) {
        rawSetItem('wallet_claimed_offers', JSON.stringify(nextOffers));
        if (claimOfferKey === 'one_time_offer') rawSetItem('wallet_one_time_offer_claimed', 'true');
      }
    } finally {
      isInternalSync = false;
    }

    const parts = [];
    if (dC) parts.push(`${dC > 0 ? '+' : ''}${dC} 🪙`);
    if (dS) parts.push(`${dS > 0 ? '+' : ''}${dS} ⭐`);
    if (dT) parts.push(`${dT > 0 ? '+' : ''}${dT} 🎟️`);
    if (dD) parts.push(`${dD > 0 ? '+' : ''}${dD} 💎`);
    if (dU) parts.push(`${dU > 0 ? '+' : ''}${dU} ⚡Ultra`);
    const summary = parts.join(' ') || '0';
    try {
      const logArr = JSON.parse(localStorage.getItem(TX_LOG_STORAGE_KEY) || '[]');
      logArr.unshift({ txId: id, reason, summary, createdAt: Date.now(), ...meta });
      rawSetItem(TX_LOG_STORAGE_KEY, JSON.stringify(logArr.slice(0, 100)));
    } catch (e) {}

    updateAllDomBalances(nextC, nextS, nextT, nextD);
    window.dispatchEvent(new CustomEvent('balance:changed', { detail: { coins: nextC, stars: nextS, tickets: nextT, diamonds: nextD, ultraCredits: nextU } }));

    if (db && !isFirestoreQuotaBlocked()) {
      try {
        const uid = getEffectivePlayerUid();
        const userRef = doc(db, 'users', String(uid));
        await runTransactionWithTimeout(db, async (tx) => {
          const snap = await tx.get(userRef);
          const base = snap.exists() ? snap.data() : {};
          const prevTxMap = (base.processedTxIds && typeof base.processedTxIds === 'object') ? base.processedTxIds : {};
          const cloudOffers = (base.claimedWalletOffers && typeof base.claimedWalletOffers === 'object') ? base.claimedWalletOffers : {};
          if (prevTxMap[id] || (claimOfferKey && cloudOffers[claimOfferKey])) {
            throw new Error('DUPLICATE_TX');
          }
          const c0 = typeof base.coins === 'number' ? base.coins : curC;
          const s0 = typeof base.stars === 'number' ? base.stars : curS;
          const t0 = typeof base.tickets === 'number' ? base.tickets : curT;
          const d0 = typeof base.diamonds === 'number' ? base.diamonds : curD;
          const u0 = typeof base.ultraCredits === 'number' ? base.ultraCredits : curU;
          const ut0 = typeof base.ultraTotalCompleted === 'number' ? base.ultraTotalCompleted : curUT;
          const c1 = c0 + dC;
          const s1 = s0 + dS;
          const t1 = t0 + dT;
          const d1 = d0 + dD;
          const u1 = u0 + dU;
          const ut1 = Math.max(0, ut0 + dUT);
          if (c1 < 0 || s1 < 0 || t1 < 0 || d1 < 0 || u1 < 0) {
            throw new Error('INSUFFICIENT_CLOUD_BALANCE');
          }
          const mergedOffers = claimOfferKey ? { ...cloudOffers, [claimOfferKey]: Date.now() } : cloudOffers;
          tx.set(userRef, {
            coins: c1,
            stars: s1,
            tickets: t1,
            diamonds: d1,
            ultraCredits: u1,
            ultraTotalCompleted: ut1,
            claimedWalletOffers: mergedOffers,
            processedTxIds: { ...prevTxMap, [id]: Date.now() },
            updatedAt: Date.now()
          }, { merge: true });
        });
      } catch (cloudErr) {
        markFirestoreQuotaBlocked(cloudErr);
        if (cloudErr && (cloudErr.message === 'INSUFFICIENT_CLOUD_BALANCE' || cloudErr.message === 'DUPLICATE_TX')) {
          isInternalSync = true;
          try {
            rawSetItem('task_game_coins', String(curC));
            rawSetItem('user_coins', String(curC));
            rawSetItem('task_game_stars', String(curS));
            rawSetItem('user_stars', String(curS));
            rawSetItem('task_user_tickets', String(curT));
            rawSetItem('user_tickets', String(curT));
            rawSetItem('task_user_diamonds', String(curD));
            rawSetItem('user_diamonds', String(curD));
            rawSetItem('wallet_ultra_task_credits', String(curU));
            rawSetItem('wallet_ultra_total_completed', String(curUT));
            rawSetItem('wallet_claimed_offers', JSON.stringify(prevOffersSnapshot));
            if (claimOfferKey === 'one_time_offer' && !prevOffersSnapshot.one_time_offer) {
              localStorage.removeItem('wallet_one_time_offer_claimed');
            }
          } finally {
            isInternalSync = false;
          }
          updateAllDomBalances(curC, curS, curT, curD);
          return { ok: false, duplicate: cloudErr.message === 'DUPLICATE_TX', error: cloudErr.message === 'DUPLICATE_TX' ? 'Duplicate transaction or already claimed' : 'Insufficient balance verified in Firebase' };
        }
        saveCurrentProfileToFirestore();
      }
    }

    if (rtdb) {
      try {
        const uid = getEffectivePlayerUid();
        const authUid = (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : uid;
        update(ref(rtdb, 'users/' + String(uid)), {
          coins: nextC,
          stars: nextS,
          tickets: nextT,
          diamonds: nextD,
          ultraCredits: nextU,
          ultraTotalCompleted: nextUT,
          claimedWalletOffers: nextOffers,
          ownerAuthUid: authUid,
          updatedAt: Date.now()
        }).catch(() => {});
      } catch (e) {}
    }

    return { ok: true, txId: id, coins: nextC, stars: nextS, tickets: nextT, diamonds: nextD, ultraCredits: nextU, ultraTotalCompleted: nextUT };
  } finally {
    _pendingTxLocks.delete(id);
  }
}

function runTransactionWithTimeout(database, updateFn, timeoutMs = 1000) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject(new Error('TX_OFFLINE'));
  }
  let timerId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error('TX_TIMEOUT')), timeoutMs);
  });
  return Promise.race([
    runTransaction(database, updateFn).finally(() => {
      if (timerId !== null) clearTimeout(timerId);
    }),
    timeoutPromise
  ]);
}

async function processWithdrawalDecisionInCloud({ wdId, decision, deliveryLink = '', deliveryStatus = '', adminUser = 'admin' } = {}) {
  if (!isAuthorizedAdminSession()) {
    return { ok: false, error: 'Unauthorized: Admin session required' };
  }
  if (!wdId || (decision !== 'approved' && decision !== 'rejected')) {
    return { ok: false, error: 'Invalid request decision' };
  }
  const computedDeliveryStatus = deliveryStatus
    || (decision === 'approved'
      ? (deliveryLink ? 'Dispatched' : 'Processing (Up to 10 Days)')
      : 'Rejected');
  if (!db) return { ok: true, localOnly: true };

  try {
    const wdRef = doc(db, 'withdrawals', String(wdId));
    const result = await runTransactionWithTimeout(db, async (tx) => {
      const snap = await tx.get(wdRef);
      if (!snap.exists()) {
        throw new Error('NOT_FOUND');
      }
      const data = snap.data() || {};
      if (data.status && data.status !== 'pending') {
        throw new Error('ALREADY_PROCESSED:' + data.status);
      }
      const nextPayload = {
        ...data,
        status: decision,
        deliveryStatus: computedDeliveryStatus,
        deliveryLink: decision === 'approved' ? String(deliveryLink || '') : '',
        processedAt: Date.now(),
        processedBy: adminUser,
        updatedAt: Date.now()
      };
      tx.set(wdRef, nextPayload, { merge: true });

      // Refund stars & ultra credits atomically if rejected and not previously refunded
      if (decision === 'rejected' && !data.refunded && data.userId) {
        const refundStars = Number(data.starCost || data.stars || 0);
        const refundUltra = Number(data.deductUltraTasks || 0);
        if (refundStars > 0 || refundUltra > 0) {
          const userRef = doc(db, 'users', String(data.userId));
          const userSnap = await tx.get(userRef);
          if (userSnap.exists()) {
            const uData = userSnap.data() || {};
            tx.set(userRef, {
              stars: Number(uData.stars || 0) + refundStars,
              ultraCredits: Number(uData.ultraCredits || 0) + refundUltra,
              updatedAt: Date.now()
            }, { merge: true });
            tx.set(wdRef, { refunded: true, refundedStars: refundStars, refundedUltraCredits: refundUltra }, { merge: true });
          }
        }
      }
      return nextPayload;
    });

    if (rtdb) {
      try {
        await update(ref(rtdb, 'withdrawals/' + String(wdId)), {
          status: decision,
          deliveryStatus: computedDeliveryStatus,
          deliveryLink: result.deliveryLink || '',
          processedAt: result.processedAt,
          updatedAt: result.updatedAt
        });
      } catch (e) {}
    }

    return { ok: true, data: result };
  } catch (err) {
    const msg = String(err && err.message || '');
    if (msg.startsWith('ALREADY_PROCESSED:')) {
      return { ok: false, duplicate: true, error: `Request was already ${msg.split(':')[1]}` };
    }
    const code = String(err && err.code || '').toLowerCase();
    markFirestoreQuotaBlocked(err);
    const isTransientOrMissing =
      msg === 'TX_TIMEOUT' ||
      msg === 'TX_OFFLINE' ||
      msg.includes('NOT_FOUND') ||
      code === 'unavailable' ||
      code === 'not-found' ||
      code === 'deadline-exceeded' ||
      code === 'resource-exhausted' ||
      /offline|network|timeout|unavailable|quota/i.test(msg);
    if (isTransientOrMissing) {
      let existingLocal = {};
      try {
        const localList = JSON.parse(localStorage.getItem('task_game_withdrawals') || '[]');
        if (Array.isArray(localList)) {
          existingLocal = localList.find(item => item && String(item.id) === String(wdId)) || {};
        }
      } catch (e) {}
      const localPatch = {
        ...existingLocal,
        id: String(wdId),
        status: decision,
        deliveryStatus: computedDeliveryStatus,
        processedBy: String(adminUser || 'admin'),
        updatedAt: Date.now()
      };
      if (decision === 'approved') {
        localPatch.approvedAt = Date.now();
        if (deliveryLink) {
          localPatch.deliveryLink = deliveryLink;
          localPatch.link = deliveryLink;
        }
      } else {
        localPatch.rejectedAt = Date.now();
      }
      saveWithdrawalToCloud(localPatch).catch(() => {});
      return { ok: true, localFallback: true, data: localPatch };
    }
    return { ok: false, error: msg || 'Failed to update withdrawal in Firebase' };
  }
}

async function updateWithdrawalDeliveryInCloud({ wdId, deliveryStatus = 'Processing (Up to 10 Days)', deliveryLink = '', adminUser = 'admin' } = {}) {
  if (!isAuthorizedAdminSession()) {
    return { ok: false, error: 'Unauthorized: Admin session required' };
  }
  if (!wdId) return { ok: false, error: 'Missing withdrawal ID' };
  const patch = {
    deliveryStatus: String(deliveryStatus || 'Processing (Up to 10 Days)'),
    deliveryUpdatedAt: Date.now(),
    deliveryUpdatedBy: String(adminUser || 'admin'),
    updatedAt: Date.now()
  };
  if (deliveryLink) {
    patch.deliveryLink = String(deliveryLink);
    patch.link = String(deliveryLink);
  }
  const raceWrite = (p) => Promise.race([
    p.then(() => true).catch(() => false),
    new Promise((resolve) => setTimeout(() => resolve(false), 900))
  ]);
  let ok = false;
  if (db) {
    if (await raceWrite(setDoc(doc(db, 'withdrawals', String(wdId)), patch, { merge: true }))) {
      ok = true;
    }
  }
  if (rtdb) {
    if (await raceWrite(update(ref(rtdb, 'withdrawals/' + String(wdId)), patch))) {
      ok = true;
    }
  }
  return { ok: true, cloudSynced: ok, data: patch };
}

// ============================================================================
// PLAYER FEEDBACK & SUPPORT TICKETS (Firestore feedbacks + RTDB feedbacks)
// ============================================================================
function normalizeFeedbackPayload(feedbackData = {}) {
  const effUid = String(feedbackData.userId || getEffectivePlayerUid() || 'anon');
  const authUid = (auth && auth.currentUser && auth.currentUser.uid) ? String(auth.currentUser.uid) : effUid;
  const createdAt = Number(feedbackData.createdAt || feedbackData.timestamp || Date.now()) || Date.now();
  const id = String(feedbackData.id || ('fb_' + createdAt + '_' + Math.random().toString(36).slice(2, 7)));
  const authorName = String(feedbackData.name || feedbackData.userName || localStorage.getItem('player_username') || 'Player').slice(0, 80);
  const message = String(feedbackData.message || '').trim().slice(0, 4000);
  return {
    id,
    userId: effUid,
    ownerAuthUid: String(feedbackData.ownerAuthUid || authUid),
    name: authorName,
    userName: authorName,
    avatar: String(feedbackData.avatar || localStorage.getItem('player_avatar') || 'avatar-7.png'),
    rating: Math.max(1, Math.min(5, parseInt(feedbackData.rating || '5', 10) || 5)),
    category: String(feedbackData.category || 'General').slice(0, 80),
    message,
    date: String(feedbackData.date || new Date(createdAt).toISOString()),
    dateStr: String(feedbackData.dateStr || ''),
    createdAt,
    timestamp: createdAt,
    status: String(feedbackData.status || 'new')
  };
}

async function saveFeedbackToCloud(feedbackData) {
  if (!feedbackData) return false;
  try {
    await ensureFirebaseAuthReady(2500);
    const payload = normalizeFeedbackPayload(feedbackData);
    if (!payload.message) return false;

    let ok = false;
    if (db && !isFirestoreQuotaBlocked()) {
      try {
        await setDoc(doc(db, 'feedbacks', payload.id), payload, { merge: true });
        ok = true;
      } catch (fsErr) {
        markFirestoreQuotaBlocked(fsErr);
        console.warn('[Firebase] Feedback Firestore save notice:', fsErr.message);
      }
    }
    if (rtdb) {
      try {
        await update(ref(rtdb, 'feedbacks/' + payload.id), payload);
        ok = true;
      } catch (rtdbErr) {
        console.warn('[Firebase RTDB] Feedback RTDB save notice:', rtdbErr.message);
      }
    }
    return ok;
  } catch (err) {
    console.warn('[Firebase] Could not save feedback to cloud:', err.message);
    return false;
  }
}

function listenToCloudFeedbacks(callback) {
  if (!isAuthorizedAdminSession()) {
    return () => {};
  }
  const fsMap = new Map();
  const rtdbMap = new Map();
  let unsubFs = null;
  let unsubRtdb = null;
  let cancelled = false;

  const emit = () => {
    if (cancelled) return;
    const combined = new Map();
    rtdbMap.forEach((v, k) => combined.set(k, v));
    fsMap.forEach((v, k) => combined.set(k, { ...(combined.get(k) || {}), ...v }));
    const sorted = Array.from(combined.values())
      .map(normalizeFeedbackPayload)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    isInternalSync = true;
    try {
      const json = JSON.stringify(sorted);
      rawSetItem('task_feedbacks', json);
      rawSetItem('task_game_feedbacks', json);
    } catch (e) {}
    isInternalSync = false;

    try {
      window.dispatchEvent(new CustomEvent('feedbacks:updated', { detail: sorted }));
    } catch (e) {}
    if (typeof callback === 'function') {
      try { callback(sorted); } catch (e) {}
    }
  };

  if (db && !isFirestoreQuotaBlocked()) {
    try {
      const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'), limit(200));
      unsubFs = onSnapshot(q, (snapshot) => {
        fsMap.clear();
        snapshot.forEach((docSnap) => {
          fsMap.set(String(docSnap.id), { ...docSnap.data(), id: String(docSnap.id) });
        });
        emit();
      }, (err) => {
        markFirestoreQuotaBlocked(err);
      });
    } catch (e) {}
  }

  if (rtdb) {
    try {
      const fbRef = rtdbQuery(ref(rtdb, 'feedbacks'), limitToLast(200));
      unsubRtdb = onValue(fbRef, (snap) => {
        rtdbMap.clear();
        if (snap.exists()) {
          const val = snap.val() || {};
          Object.keys(val).forEach((k) => {
            if (val[k] && typeof val[k] === 'object') {
              rtdbMap.set(String(k), { ...val[k], id: String(k) });
            }
          });
        }
        emit();
      }, () => {});
    } catch (e) {}
  }

  return () => {
    cancelled = true;
    if (typeof unsubFs === 'function') { try { unsubFs(); } catch (e) {} }
    if (typeof unsubRtdb === 'function') { try { unsubRtdb(); } catch (e) {} }
  };
}

async function deleteFeedbackFromCloud(fbId) {
  if (!fbId || !isAuthorizedAdminSession()) return false;
  const id = String(fbId);
  let ok = false;
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      await deleteDoc(doc(db, 'feedbacks', id));
      ok = true;
    } catch (err) {
      markFirestoreQuotaBlocked(err);
    }
  }
  if (rtdb) {
    try {
      await remove(ref(rtdb, 'feedbacks/' + id));
      ok = true;
    } catch (e) {}
  }
  return ok;
}

async function clearAllFeedbacksInCloud() {
  if (!isAuthorizedAdminSession()) return false;
  let ok = false;
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      const snap = await getDocs(query(collection(db, 'feedbacks'), limit(500)));
      const jobs = [];
      snap.forEach((docSnap) => jobs.push(deleteDoc(docSnap.ref).catch(() => {})));
      await Promise.all(jobs);
      ok = true;
    } catch (err) {
      markFirestoreQuotaBlocked(err);
    }
  }
  if (rtdb) {
    try {
      await remove(ref(rtdb, 'feedbacks'));
      ok = true;
    } catch (e) {}
  }
  return ok;
}

window.TapEmpireUtils = {
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  saveAppSettingsToCloud,
  listenToAppSettings,
  getCurrencyMeta,
  getTodayLocalDateKey,
  atomicBalanceMutation,
  processWithdrawalDecisionInCloud,
  updateWithdrawalDeliveryInCloud
};

window.FirebaseAuth = {
  get auth() { return auth; },
  signUp: signUpWithEmail,
  signIn: signInWithEmail,
  signOut: signOutUser,
  resetPassword: sendPasswordReset,
  onAuthStateChanged: subscribeToAuth,
  syncProfile: saveCurrentProfileToFirestore,
  getCurrentUser: () => (auth ? auth.currentUser : null)
};

window.firebaseApp = app;
window.firebaseDb = db;
window.firebaseAuth = auth;
window.firebaseAnalytics = analytics;

// Automatically initialize real-time cloud sync across the current page/tab
try {
  // 1. Fetch latest balances from Firestore immediately on page open
  initCloudBalances();

  // 2. Start user document real-time listener
  startRealtimeUserSync();

  // 3. Start cloud tasks real-time listener
  listenToCloudTasks((tasks) => {
    if (typeof window.renderTasks === 'function') {
      window.renderTasks();
    }
  });

  // 4. Start global app settings real-time listener (limits, VIP, Pro, Event levels)
  listenToAppSettings(() => {
    if (typeof window.renderTasks === 'function') {
      window.renderTasks();
    }
    if (typeof window.renderAdminEventSection === 'function') {
      window.renderAdminEventSection();
    }
  });

    // 5. Update DOM with initial balances
  updateAllDomBalances();

  // 6. Cross-tab and real-time balance cloud sync listener
  try {
    const syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    syncChannel.onmessage = (event) => {
      const msg = event.data;
      if (msg && msg.type === 'USER_DATA_RESET') {
        const myUid = getEffectivePlayerUid();
        const myName = localStorage.getItem('player_username');
        if (msg.userId === myUid || (msg.altUid && msg.altUid === myUid) || (msg.userName && msg.userName === myName)) {
          resetLocalPlayerSessionKeys();
          return;
        }
      }
      if (msg && msg.type === 'USER_DELETED_FROM_CLOUD') {
        const myUid = getEffectivePlayerUid();
        const myName = localStorage.getItem('player_username');
        if (msg.userId === myUid || (msg.altUid && msg.altUid === myUid) || (msg.userName && msg.userName === myName)) {
          localStorage.removeItem('player_uid');
          localStorage.removeItem('player_email');
          localStorage.setItem('player_logged_in', 'false');
          resetLocalPlayerSessionKeys();
          return;
        }
      }
      updateAllDomBalances();
    };
  } catch (e) {}

  try {
    const bcNova = new BroadcastChannel('nova_task_sync');
    bcNova.onmessage = (event) => {
      const msg = event.data;
      if (msg && msg.type === 'USER_DATA_RESET') {
        const myUid = getEffectivePlayerUid();
        const myName = localStorage.getItem('player_username');
        if (msg.userId === myUid || (msg.altUid && msg.altUid === myUid) || (msg.userName && msg.userName === myName)) {
          resetLocalPlayerSessionKeys();
        }
      }
    };
  } catch (e) {}

  // 7. Flush balances immediately when page closes or is navigated away from
  const handlePageCloseOrHide = () => {
    try {
      saveCurrentProfileToFirestore();
    } catch (e) {}
  };
  window.addEventListener('beforeunload', handlePageCloseOrHide);
  window.addEventListener('pagehide', handlePageCloseOrHide);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      handlePageCloseOrHide();
    } else {
      initCloudBalances();
    }
  });

  // 8. Try anonymous sign-in if not signed in yet
  if (auth && !auth.currentUser) {
    try {
      signInAnonymously(auth).catch(() => {});
    } catch (e) {}
  }
} catch (e) {
  console.warn('[Firebase] Auto-sync notice:', e.message);
}

window.syncBalancesWithCloud = saveCurrentProfileToFirestore;
window.saveCurrentProfileToFirestore = saveCurrentProfileToFirestore;
window.initCloudBalances = initCloudBalances;
window.saveTasksToCloud = saveTasksToCloud;
window.listenToCloudTasks = listenToCloudTasks;
window.listenToCloudUsers = listenToCloudUsers;
window.saveUserToCloud = saveUserToCloud;
window.deleteUserFromCloud = deleteUserFromCloud;
window.resetUserAccountInCloud = resetUserAccountInCloud;
window.resetLocalPlayerSessionKeys = resetLocalPlayerSessionKeys;
window.listenToCloudWithdrawals = listenToCloudWithdrawals;
window.saveWithdrawalToCloud = saveWithdrawalToCloud;
window.saveFeedbackToCloud = saveFeedbackToCloud;
window.listenToCloudFeedbacks = listenToCloudFeedbacks;
window.deleteFeedbackFromCloud = deleteFeedbackFromCloud;
window.clearAllFeedbacksInCloud = clearAllFeedbacksInCloud;

window.saveLeaderboardSessionsToCloud = saveLeaderboardSessionsToCloud;
window.listenToCloudLeaderboardSessions = listenToCloudLeaderboardSessions;

window.Firebase = {
  app,
  get analytics() { return analytics; },
  db,
  rtdb,
  auth,
  config: firebaseConfig,
  firebaseConfig,
  firebaseSync,
  initCloudBalances,
  getEffectivePlayerUid,
  updateAllDomBalances,
  startRealtimeUserSync,
  saveCurrentProfileToFirestore,
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  sendPasswordReset,
  subscribeToAuth,
  saveTasksToCloud,
  listenToCloudTasks,
  listenToCloudUsers,
  listenToLeaderboardFromCloud,
  saveUserToCloud,
  deleteUserFromCloud,
  resetUserAccountInCloud,
  resetLocalPlayerSessionKeys,
  saveWithdrawalToCloud,
  listenToCloudWithdrawals,
  saveFeedbackToCloud,
  listenToCloudFeedbacks,
  deleteFeedbackFromCloud,
  clearAllFeedbacksInCloud,
  saveAdConfigToCloud,
  listenToCloudAdConfig,
  registerReferralCodeInCloud,
  verifyReferralCodeInCloud,
  redeemReferralCodeInCloud,
  saveGlobalLeaderboardEventToCloud,
  listenToCloudLeaderboardEvent,
  saveLeaderboardSessionsToCloud,
  listenToCloudLeaderboardSessions,
  saveAppSettingsToCloud,
  listenToAppSettings,
  getAppSettings,
  atomicBalanceMutation,
  processWithdrawalDecisionInCloud,
  updateWithdrawalDeliveryInCloud,
  acquireSingleAdminLock,
  heartbeatSingleAdminLock,
  releaseSingleAdminLock,
  listenToAdminLock,
  cacheCompactUsersSummary,
  openBalanceManageModal,
  closeBalanceManageModal,
  TICKET_TO_STAR_PACKAGES,
  getStarCostForTickets,
  getTicketsForStars,
  isPlayerNameTaken,
  openFirstTimeUsernamePopup
};

async function isPlayerNameTaken(candidateName, excludeUid = '') {
  const clean = String(candidateName || '').trim().toLowerCase();
  if (!clean || clean === 'player' || clean === 'task earner') return true;
  const ex = String(excludeUid || localStorage.getItem('player_uid') || '').trim();
  try {
    const rawUsers = localStorage.getItem('task_game_users');
    const localList = rawUsers ? JSON.parse(rawUsers) : [];
    if (Array.isArray(localList)) {
      const hit = localList.some(u => u && String(u.id || u.uid || '') !== ex && String(u.name || u.displayName || '').trim().toLowerCase() === clean);
      if (hit) return true;
    }
  } catch (e) {}
  if (db && !isFirestoreQuotaBlocked()) {
    try {
      // Indexed 1-2 doc lookup scales cleanly past 10,000+ users without full collection download
      const q = query(collection(db, 'users'), where('displayNameLower', '==', clean), limit(3));
      const snap = await getDocs(q);
      let taken = false;
      snap.forEach((docSnap) => {
        const d = docSnap.data() || {};
        const docUid = String(docSnap.id || d.uid || d.id || '');
        if (docUid !== ex) taken = true;
      });
      if (taken) return true;
    } catch (e) {
      markFirestoreQuotaBlocked(e);
    }
  }
  return false;
}

function openFirstTimeUsernamePopup() {
  if (document.getElementById('firstTimePlayerNameModal')) return;
  const overlay = document.createElement('div');
  overlay.id = 'firstTimePlayerNameModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(3,8,22,0.88);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:1rem;';
  const curName = localStorage.getItem('player_username') || '';
  const prefill = (curName && curName.toLowerCase() !== 'player' && curName.toLowerCase() !== 'task earner') ? curName : '';
  overlay.innerHTML = `
    <div style="width:100%;max-width:380px;background:linear-gradient(175deg,#0e1e47 0%,#060e24 100%);border:1.5px solid rgba(56,189,248,0.5);border-radius:18px;padding:1.25rem;box-shadow:0 16px 40px rgba(0,0,0,0.8);color:#fff;font-family:inherit;">
      <div style="font-size:1.05rem;font-weight:900;color:#38bdf8;margin-bottom:0.35rem;">👋 Welcome! Set Your Player Name</div>
      <div style="font-size:0.76rem;color:#94a3b8;margin-bottom:0.85rem;">Enter a unique player name. Duplicate names already used in the game are not allowed.</div>
      <form id="firstTimePlayerNameForm">
        <input type="text" id="firstTimePlayerNameInput" value="${prefill.replace(/"/g, '&quot;')}" placeholder="Enter unique player name..." maxlength="24" required style="width:100%;box-sizing:border-box;padding:0.65rem 0.85rem;border-radius:10px;border:1.5px solid rgba(56,189,248,0.4);background:#040b1d;color:#fff;font-weight:800;font-size:0.9rem;outline:none;margin-bottom:0.5rem;" />
        <div id="firstTimePlayerNameErr" style="display:none;font-size:0.74rem;color:#f87171;font-weight:700;margin-bottom:0.5rem;"></div>
        <button type="submit" id="btnFirstTimePlayerNameSave" style="width:100%;padding:0.7rem;border-radius:10px;border:none;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;font-weight:900;font-size:0.88rem;cursor:pointer;">Verify &amp; Start Playing ✓</button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  const form = document.getElementById('firstTimePlayerNameForm');
  const input = document.getElementById('firstTimePlayerNameInput');
  const errEl = document.getElementById('firstTimePlayerNameErr');
  const btn = document.getElementById('btnFirstTimePlayerNameSave');
  if (input) setTimeout(() => input.focus(), 50);
  if (form) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const val = (input?.value || '').trim();
      if (!val || val.length < 2 || val.toLowerCase() === 'player' || val.toLowerCase() === 'task earner') {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = '❌ Please enter a valid unique name (at least 2 characters).'; }
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = 'Verifying...'; }
      const uid = getEffectivePlayerUid();
      const taken = await isPlayerNameTaken(val, uid);
      if (taken) {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = `❌ "${val}" is already used by another player. Choose a different name.`; }
        if (btn) { btn.disabled = false; btn.textContent = 'Verify & Start Playing ✓'; }
        return;
      }
      localStorage.setItem('player_username', val);
      localStorage.setItem('player_username_confirmed', 'true');
      if (!localStorage.getItem('player_avatar')) localStorage.setItem('player_avatar', '⚡');
      try {
        const rawU = localStorage.getItem('task_game_users');
        const list = rawU ? JSON.parse(rawU) : [];
        if (Array.isArray(list)) {
          const idx = list.findIndex(u => u && String(u.id) === String(uid));
          if (idx !== -1) list[idx].name = val;
          else list.push({ id: uid, name: val, avatar: localStorage.getItem('player_avatar') || '⚡', username: '@' + val.toLowerCase().replace(/\s+/g, ''), coins: 0, stars: 0, tickets: 0, diamonds: 0, passLevel: 0, eventTasks: 0, totalTasks: 0, status: 'active' });
          localStorage.setItem('task_game_users', JSON.stringify(list));
        }
      } catch (e) {}
      saveCurrentProfileToFirestore();
      updateAllDomBalances();
      overlay.remove();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Never show player-name popup on standalone Admin portal
  if (typeof window !== 'undefined' && /\/admin(\/|$)/i.test(window.location.pathname)) return;
  const confirmed = localStorage.getItem('player_username_confirmed') === 'true';
  const curName = (localStorage.getItem('player_username') || '').trim();
  if (confirmed) return;
  if (curName && curName.toLowerCase() !== 'player' && curName.toLowerCase() !== 'task earner') {
    localStorage.setItem('player_username_confirmed', 'true');
    return;
  }
  openFirstTimeUsernamePopup();
});

// Dispatch global ready event
window.dispatchEvent(new CustomEvent('firebase:ready', {
  detail: { app, analytics, db, auth, firebaseSync }
}));

export { 
  app, 
  analytics, 
  db, 
  rtdb,
  auth,
  firebaseConfig, 
  firebaseSync,
  ensureFirebaseAuthReady,
  initCloudBalances,
  getEffectivePlayerUid,
  updateAllDomBalances,
  startRealtimeUserSync,
  saveCurrentProfileToFirestore,
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  sendPasswordReset,
  subscribeToAuth,
  saveTasksToCloud, 
  listenToCloudTasks,
  listenToCloudUsers,
  listenToLeaderboardFromCloud,
  saveUserToCloud,
  deleteUserFromCloud,
  resetUserAccountInCloud,
  resetLocalPlayerSessionKeys,
  saveWithdrawalToCloud,
  listenToCloudWithdrawals,
  saveFeedbackToCloud,
  listenToCloudFeedbacks,
  deleteFeedbackFromCloud,
  clearAllFeedbacksInCloud,
  saveAdConfigToCloud,
  listenToCloudAdConfig,
  registerReferralCodeInCloud,
  verifyReferralCodeInCloud,
  redeemReferralCodeInCloud,
  saveGlobalLeaderboardEventToCloud,
  listenToCloudLeaderboardEvent,
  saveLeaderboardSessionsToCloud,
  listenToCloudLeaderboardSessions,
  saveAppSettingsToCloud,
  listenToAppSettings,
  getAppSettings,
  atomicBalanceMutation,
  processWithdrawalDecisionInCloud,
  updateWithdrawalDeliveryInCloud,
  acquireSingleAdminLock,
  heartbeatSingleAdminLock,
  releaseSingleAdminLock,
  listenToAdminLock,
  cacheCompactUsersSummary,
  openBalanceManageModal,
  closeBalanceManageModal,
  TICKET_TO_STAR_PACKAGES,
  getStarCostForTickets,
  getTicketsForStars,
  isPlayerNameTaken,
  openFirstTimeUsernamePopup
};


