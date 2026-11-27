// Profile & Admin Portal Script
// Credentials: Username: 400 @123 | Password: 0911 (Masked, not shown on UI)

// Sunflower removed
const TASKS_STORAGE_KEY = 'task_game_tasks';
const CLAIMS_STORAGE_KEY = 'task_game_claims';
const WITHDRAW_STORAGE_KEY = 'task_game_withdrawals';
const USERS_STORAGE_KEY = 'task_game_users';
const SYNC_FLAG_KEY = 'task_game_sync_flag';
const SYNC_CHANNEL_NAME = 'nova_task_sync';
const TOTAL_TASKS_KEY = 'task_game_total_tasks';
const EVENT_TASKS_KEY = 'task_game_event_tasks';

// Real players synced dynamically from Firebase (all demo users removed)
const CANONICAL_TASK_USERS = [];

const DEMO_USER_IDS = new Set(['usr_2', 'usr_3', 'usr_4', 'usr_5', 'usr_6']);
const DEMO_USER_NAMES = new Set(['User 2', 'CyberHunter', 'NeonBlaze', 'ShadowNova', 'PixelMaster']);

function isDemoUser(u) {
  if (!u) return true;
  if (DEMO_USER_IDS.has(u.id)) return true;
  if (DEMO_USER_NAMES.has(u.name)) return true;
  if (typeof u.id === 'string' && u.id.startsWith('mock_')) return true;
  return false;
}

const DEFAULT_USERS = [];
const DEFAULT_WITHDRAWALS = [];

// Storage initialization: seed missing keys at 0 without overwriting earned player data
try {
  if (!localStorage.getItem('task_game_zero_start_clean_v7')) {
    const defaults = {
      task_game_coins: '0', task_game_stars: '0', user_coins: '0', user_stars: '0',
      task_game_total_tasks: '0', task_game_total_tasks_completed: '0', completed_tasks_count: '0',
      task_game_ads_watched_count: '0', ads_watched_count: '0',
      task_game_event_tasks: '0', task_game_event_tasks_count: '0',
      task_coins_won_today: '0', task_games_played_today: '0', task_win_streak: '0',
      task_game_users: '[]', task_game_withdrawals: '[]', task_game_referrals_list: '[]',
      task_game_stars_transactions: '[]', task_game_claims: '{}'
    };
    Object.entries(defaults).forEach(([k, v]) => {
      if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
    });
    const existingName = localStorage.getItem('player_username');
    if (!existingName || existingName.toLowerCase().includes('nova')) {
      localStorage.setItem('player_username', 'Player');
    }
    if (!localStorage.getItem('player_avatar')) localStorage.setItem('player_avatar', '⚡');
    localStorage.setItem('task_game_zero_start_clean_v7', 'true');
  }
} catch (e) {}

// Ensure users storage is valid array
try {
  const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
  if (rawUsers) {
    const parsed = JSON.parse(rawUsers);
    if (!Array.isArray(parsed)) localStorage.setItem(USERS_STORAGE_KEY, '[]');
  }
  const rawWd = localStorage.getItem(WITHDRAW_STORAGE_KEY);
  if (rawWd && (rawWd.includes('WD-8491') || rawWd.includes('WD-8490') || rawWd.includes('AMZN-7492'))) {
    localStorage.setItem(WITHDRAW_STORAGE_KEY, '[]');
  }
} catch (e) {}

// Global active tab state ('profile' | 'admin')
let activeProfileTab = 'admin';
let currentAdminSubView = 'tasks';
let tasksData = [];
let withdrawalsData = [];
let usersData = [];
let currentWdFilter = 'pending';
let adminEventInterval = null;
let syncChannel = null;
let _lastAdminUsersSig = '';
let _lastAdminWdsSig = '';

/**
 * Normalize any legacy or alias category string into one of Admin's 8 tabs:
 * 'common' | 'simple' | 'premium' | 'pro' | 'ultra' | 'quiz' | 'diamond' | 'google'
 */
function normalizeAdminTaskCategory(rawCat, task) {
  const c = String(rawCat || (task && task.category) || '').toLowerCase().trim();
  if (c === 'common' || c === 'task') return 'common';
  if (c === 'diamond' || c === 'diamonds') return 'diamond';
  if (c === 'google' || c === 'google_form' || c === 'google-form' || c === 'googleform' || c === 'form') return 'google';
  if (c === 'quiz') return 'quiz';
  if (c === 'ultra' || c === 'mega') return 'ultra';
  if (c === 'pro' || c === 'elite') return 'pro';
  if (c === 'premium' || c === 'star' || c === 'shop_task' || (task && task.isShopTask)) return 'premium';
  if (c === 'simple' || c === 'coin') return 'simple';
  return 'common';
}

function filterTasksForAdminCat(cat) {
  const target = normalizeAdminTaskCategory(cat);
  return (Array.isArray(tasksData) ? tasksData : []).filter(t => t && normalizeAdminTaskCategory(t.category, t) === target);
}

/** Preserve valid 4-6 digit verification codes; generate a random 6-digit fallback otherwise. */
function normalizeTaskSecretCode(raw) {
  const s = String(raw || '').trim();
  return /^\d{4,6}$/.test(s) ? s : Math.floor(100000 + Math.random() * 900000).toString();
}

// Initialize BroadcastChannel & cross-tab storage real-time sync
try {
  syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  syncChannel.onmessage = (event) => {
    const t = event && event.data && event.data.type;
    if (t === 'TASKS_UPDATED' || t === 'TASKS_SYNCED' || t === 'TASKS_RESTORED' || t === 'USERS_UPDATED' || t === 'WITHDRAWALS_UPDATED') {
      loadAllAdminData();
      if (t === 'TASKS_UPDATED' || t === 'TASKS_SYNCED' || t === 'TASKS_RESTORED') {
        refreshOpenAdminTaskViewsLive();
      } else {
        renderCurrentAdminSubView();
      }
    } else if (t === 'BALANCES_UPDATED' || t === 'PROFILE_UPDATED') {
      updateAdminLiveDisplays();
    }
  };
} catch (e) {
  console.warn('BroadcastChannel not supported');
}

window.addEventListener('storage', (e) => {
  if (!e || !e.key) return;
  if (e.key === TASKS_STORAGE_KEY || e.key === 'task_game_tasks_updated_at' || e.key === SYNC_FLAG_KEY) {
    loadAllAdminData();
    refreshOpenAdminTaskViewsLive();
  } else if (e.key === USERS_STORAGE_KEY) {
    loadAllAdminData();
    renderAdminUsersList();
  }
});

// =============================================================================
// SINGLE-PERSON EXCLUSIVE ADMIN SESSION LOCK (MAX 1 ACTIVE PERSON AT A TIME)
// =============================================================================
const ADMIN_DEVICE_ID_KEY = 'tap_empire_admin_device_id';
const ADMIN_SESSION_TOKEN_KEY = 'tap_empire_admin_session_token';
const ADMIN_LOCAL_LOCK_KEY = 'tap_empire_admin_active_lock';
const ADMIN_LOCK_TTL_MS = 120000;
let _adminHeartbeatTimer = null;
let _adminLockUnsub = null;

function getAdminDeviceId() {
  try {
    let dev = localStorage.getItem(ADMIN_DEVICE_ID_KEY);
    if (!dev) {
      dev = 'adm_dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
      localStorage.setItem(ADMIN_DEVICE_ID_KEY, dev);
    }
    return dev;
  } catch (e) {
    return 'adm_dev_fallback';
  }
}

function getOrCreateAdminSessionToken() {
  try {
    let tok = sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
    if (!tok) {
      tok = 'adm_tok_' + Math.random().toString(36).slice(2, 12) + '_' + Date.now();
      sessionStorage.setItem(ADMIN_SESSION_TOKEN_KEY, tok);
    }
    return tok;
  } catch (e) {
    return 'adm_tok_' + Date.now();
  }
}

function stopAdminSingleSessionMonitor() {
  if (_adminHeartbeatTimer) {
    clearInterval(_adminHeartbeatTimer);
    _adminHeartbeatTimer = null;
  }
  if (typeof _adminLockUnsub === 'function') {
    try { _adminLockUnsub(); } catch (e) {}
    _adminLockUnsub = null;
  }
}

function forceLockOutDisplacedAdmin(reasonMsg) {
  stopAdminSingleSessionMonitor();
  try {
    sessionStorage.removeItem('admin_authenticated');
    sessionStorage.removeItem('task_admin_authenticated');
    sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('is_admin_user_400kp');
  } catch (e) {}
  const errBox = document.getElementById('adminLoginError');
  if (errBox) {
    errBox.textContent = reasonMsg || '🔒 Single-Admin Session Locked: Access limited to 1 person.';
    errBox.style.display = 'flex';
  }
  switchProfileTab('admin');
}

function startAdminSingleSessionMonitor() {
  stopAdminSingleSessionMonitor();
  const devId = getAdminDeviceId();
  const sessTok = getOrCreateAdminSessionToken();

  _adminHeartbeatTimer = setInterval(() => {
    if (!isAdminLoggedIn()) return;
    if (window.Firebase && typeof window.Firebase.heartbeatSingleAdminLock === 'function') {
      window.Firebase.heartbeatSingleAdminLock(devId, sessTok);
    } else {
      try {
        localStorage.setItem(ADMIN_LOCAL_LOCK_KEY, JSON.stringify({
          active: true,
          adminUser: '400@kp',
          holderDeviceId: devId,
          sessionToken: sessTok,
          updatedAt: Date.now()
        }));
      } catch (e) {}
    }
  }, 25000);

  if (window.Firebase && typeof window.Firebase.listenToAdminLock === 'function') {
    _adminLockUnsub = window.Firebase.listenToAdminLock((lockData) => {
      if (!isAdminLoggedIn() || !lockData) return;
      if (lockData.active === true && lockData.holderDeviceId && lockData.holderDeviceId !== devId && (Date.now() - Number(lockData.updatedAt || 0)) < ADMIN_LOCK_TTL_MS) {
        forceLockOutDisplacedAdmin('🔒 Admin session ended: Another authorized session took single-person access.');
      }
    });
  }
}

function releaseCurrentAdminSessionLock() {
  stopAdminSingleSessionMonitor();
  let tok = '';
  try { tok = sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY) || ''; } catch (e) {}
  if (window.Firebase && typeof window.Firebase.releaseSingleAdminLock === 'function') {
    window.Firebase.releaseSingleAdminLock(tok);
  }
  try {
    const raw = localStorage.getItem(ADMIN_LOCAL_LOCK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!tok || !parsed.sessionToken || parsed.sessionToken === tok) {
        localStorage.setItem(ADMIN_LOCAL_LOCK_KEY, JSON.stringify({ active: false, releasedAt: Date.now(), updatedAt: Date.now() }));
      }
    }
  } catch (e) {}
}

window.addEventListener('pagehide', () => {
  if (isAdminLoggedIn()) releaseCurrentAdminSessionLock();
});

// Compulsory Admin Lock: Always locked by default upon opening
try {
  localStorage.removeItem('admin_authenticated');
} catch(e) {}

function isAdminLoggedIn() {
  try {
    return sessionStorage.getItem('admin_authenticated') === 'true';
  } catch (e) {
    return false;
  }
}
window.isAdminLoggedIn = isAdminLoggedIn;

/**
 * Open Admin with Compulsory Lock:
 * Invalidates active admin session and requires 400@kp / 0911 authentication.
 */
function openAdminCompulsoryLock() {
  releaseCurrentAdminSessionLock();
  try {
    sessionStorage.removeItem('admin_authenticated');
    sessionStorage.removeItem('task_admin_authenticated');
    sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
    localStorage.removeItem('admin_authenticated');
  } catch(e) {}

  const passField = document.getElementById('adminPassword');
  const errBox = document.getElementById('adminLoginError');
  if (passField) passField.value = '';
  if (errBox) errBox.style.display = 'none';

  switchProfileTab('admin');
}
window.openAdminCompulsoryLock = openAdminCompulsoryLock;

/**
 * Toggle standalone Admin portal screens ('admin' -> login or dashboard, 'profile' -> back to Profile)
 * @param {'profile'|'admin'} tabKey
 */
function switchProfileTab(tabKey) {
  if (tabKey === 'profile') {
    exitAdminToProfile();
    return;
  }

  activeProfileTab = 'admin';
  const panelAdminLogin = document.getElementById('panelAdminLogin');
  const panelAdminDashboard = document.getElementById('panelAdminDashboard') || document.getElementById('panelAdminView');
  const adminMenu = document.getElementById('adminMenuBar');
  const authenticated = isAdminLoggedIn();

  if (authenticated) {
    closeCategoryTaskPopup();
    if (panelAdminLogin) panelAdminLogin.style.display = 'none';
    if (panelAdminDashboard) panelAdminDashboard.style.display = 'block';
    if (adminMenu) adminMenu.style.display = 'flex';
    startAdminSingleSessionMonitor();
    loadAllAdminData();
    switchAdminSubView(currentAdminSubView || 'tasks');
  } else {
    if (panelAdminLogin) panelAdminLogin.style.display = 'block';
    if (panelAdminDashboard) panelAdminDashboard.style.display = 'none';
    if (adminMenu) adminMenu.style.display = 'none';
    const userField = document.getElementById('adminUsername');
    if (userField) setTimeout(() => userField.focus(), 80);
  }
}
window.switchProfileTab = switchProfileTab;

/**
 * Handle submission of the Admin Login form (strict single-person access: 400@kp / 0911 + 1 active lock)
 */
async function handleAdminLogin(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  const userField = document.getElementById('adminUsername');
  const passField = document.getElementById('adminPassword');
  const errBox = document.getElementById('adminLoginError');
  const submitBtn = document.getElementById('btnAdminLogin');

  const rawUser = userField ? userField.value.trim() : '';
  const rawPass = passField ? passField.value.trim() : '';

  const isUserValid = rawUser === '400@kp';
  const isPassValid = rawPass === '0911';

  if (!isUserValid || !isPassValid) {
    if (errBox) {
      errBox.textContent = '⚠️ Invalid administrator credentials. Access denied!';
      errBox.style.display = 'flex';
    }
    if (passField) {
      passField.value = '';
      passField.focus();
    }
    showToast('⚠️ Invalid administrator credentials. Only 400@kp allowed!');
    return false;
  }

  const devId = getAdminDeviceId();
  const sessTok = getOrCreateAdminSessionToken();

  // Check local single-person lock first (works offline & in tests)
  try {
    const rawLock = localStorage.getItem(ADMIN_LOCAL_LOCK_KEY);
    if (rawLock) {
      const existing = JSON.parse(rawLock);
      const isFresh = existing && existing.active === true && (Date.now() - Number(existing.updatedAt || 0)) < ADMIN_LOCK_TTL_MS;
      if (isFresh && existing.holderDeviceId && existing.holderDeviceId !== devId) {
        const msg = '🚫 Admin Access is locked to 1 person! Another device is already logged in.';
        if (errBox) {
          errBox.textContent = msg;
          errBox.style.display = 'flex';
        }
        showToast(msg);
        return false;
      }
    }
  } catch (e) {}

  // Set local session immediately for responsive UI; await cloud lock when Firebase is connected
  if (window.Firebase && typeof window.Firebase.acquireSingleAdminLock === 'function') {
    if (submitBtn) submitBtn.disabled = true;
    try {
      const lockRes = await window.Firebase.acquireSingleAdminLock(devId, sessTok);
      if (!lockRes || !lockRes.ok) {
        const msg = (lockRes && lockRes.error) || '🚫 Admin Access Restricted to 1 Person at a time!';
        if (errBox) {
          errBox.textContent = msg;
          errBox.style.display = 'flex';
        }
        showToast(msg);
        return false;
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  } else {
    try {
      localStorage.setItem(ADMIN_LOCAL_LOCK_KEY, JSON.stringify({
        active: true,
        adminUser: '400@kp',
        holderDeviceId: devId,
        sessionToken: sessTok,
        updatedAt: Date.now()
      }));
    } catch (e) {}
  }

  if (errBox) errBox.style.display = 'none';
  try {
    sessionStorage.setItem('admin_authenticated', 'true');
    sessionStorage.setItem('task_admin_authenticated', 'true');
    localStorage.setItem('admin_authenticated', 'true');
    localStorage.setItem('is_admin_user_400kp', 'true');
  } catch (e) {}

  if (typeof initAdminCloudListeners === 'function') {
    initAdminCloudListeners();
  }
  showToast('🎉 Welcome Administrator (400@kp)! Single-Admin Lock Active 🛡️');
  switchProfileTab('admin');
  return true;
}
window.handleAdminLogin = handleAdminLogin;

/**
 * Navigate back to the Player Profile page cleanly
 */
function exitAdminToProfile() {
  releaseCurrentAdminSessionLock();
  try {
    sessionStorage.removeItem('admin_authenticated');
    sessionStorage.removeItem('task_admin_authenticated');
    sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
    localStorage.removeItem('admin_authenticated');
  } catch (e) {}
  window.location.href = '../frontend/page/profile/index.html';
}
window.exitAdminToProfile = exitAdminToProfile;

/**
 * Sign out of Admin session cleanly and lock the Admin Control Portal
 */
function adminLogout() {
  releaseCurrentAdminSessionLock();
  try {
    sessionStorage.removeItem('admin_authenticated');
    sessionStorage.removeItem('task_admin_authenticated');
    sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('is_admin_user_400kp');
  } catch (e) {}

  const userField = document.getElementById('adminUsername');
  const passField = document.getElementById('adminPassword');
  const errBox = document.getElementById('adminLoginError');
  if (userField) userField.value = '';
  if (passField) passField.value = '';
  if (errBox) errBox.style.display = 'none';

  showToast('🔒 Signed out! Returning to Profile...');
  window.location.href = '../frontend/page/profile/index.html';
}
window.adminLogout = adminLogout;

/**
 * Switch Admin subviews menu-bar-wise
 * @param {'tasks'|'users'|'withdraw'|'event'} viewKey
 */
function switchAdminSubView(viewKey) {
  currentAdminSubView = viewKey;

  const views = {
    tasks: document.getElementById('adminSubTasks'),
    users: document.getElementById('adminSubUsers'),
    withdraw: document.getElementById('adminSubWithdraw'),
    event: document.getElementById('adminSubEvent')
  };

  const settingsPage = document.getElementById('adminSettingsPageView');
  if (settingsPage) settingsPage.style.display = 'none';

  const menuBtns = {
    tasks: document.getElementById('adminMenuTasks'),
    users: document.getElementById('adminMenuUsers'),
    withdraw: document.getElementById('adminMenuWithdraw'),
    event: document.getElementById('adminMenuEvent')
  };

  const titles = {
    tasks: '🛡️ Admin Panel',
    users: '👥 Registered Players',
    withdraw: '💸 Reward Requests',
    event: '⚙️ Event & App Settings'
  };

  // Update clean title
  const titleEl = document.getElementById('adminActivePageTitle');
  if (titleEl) titleEl.textContent = titles[viewKey] || '🛡️ Admin Panel';

  // Toggle view visibility
  Object.keys(views).forEach(key => {
    if (views[key]) {
      views[key].style.display = (key === viewKey) ? 'block' : 'none';
    }
  });

  // Toggle active button style on admin menu bar
  Object.keys(menuBtns).forEach(key => {
    if (menuBtns[key]) {
      if (key === viewKey) menuBtns[key].classList.add('active');
      else menuBtns[key].classList.remove('active');
    }
  });

  // Hide top header & bottom menu bar if viewing dedicated category or editor page
  const pageView = document.getElementById('adminTaskCategoryPageView');
  const allEditorView = document.getElementById('adminAllTasksEditorPageView');
  const adminMenu = document.getElementById('adminMenuBar');
  const adminTopHeaderBar = document.getElementById('adminTopHeaderBar');
  const isShown = (el) => el && el.style.display !== 'none' && !el.classList.contains('admin-subview-hidden');
  const isSubPageOpen = viewKey === 'tasks' && (isShown(pageView) || isShown(allEditorView));
  if (isSubPageOpen) {
    if (adminMenu) adminMenu.style.display = 'none';
    if (adminTopHeaderBar) adminTopHeaderBar.style.display = 'none';
  } else {
    if (adminMenu) adminMenu.style.display = 'flex';
    if (adminTopHeaderBar) adminTopHeaderBar.style.display = 'flex';
  }

  // Refresh withdrawals from localStorage when opening Requests subview
  if (viewKey === 'withdraw') {
    try {
      const raw = localStorage.getItem(WITHDRAW_STORAGE_KEY);
      let parsedWd = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsedWd)) parsedWd = [];
      withdrawalsData = parsedWd.filter(w => w && !['WD-8491', 'WD-8490', 'WD-8489', 'WD-8488'].includes(w.id));
    } catch (e) {}
  }

  renderCurrentAdminSubView();
}

/**
 * Render the currently selected admin subview
 */
function renderCurrentAdminSubView() {
  if (currentAdminSubView === 'tasks') renderAdminTasksList();
  else if (currentAdminSubView === 'users') renderAdminUsersList();
  else if (currentAdminSubView === 'withdraw') renderAdminWithdrawalsList();
  else if (currentAdminSubView === 'event') renderAdminEventSection();
}

/**
 * Load all stored data from localStorage
 */
function loadAllAdminData() {
  // 1. Tasks (Strictly real Admin/Firebase tasks — zero demo injection)
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    tasksData = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(tasksData)) tasksData = [];
    const legacyDemoRe = /^(comm_mission|coin_mission|star_mission|pro_mission|ultra_mission|quiz_task)_/;
    tasksData = tasksData.filter(t => t && t.id && !t.isDemo && !legacyDemoRe.test(String(t.id || '')) && !String(t.id || '').toLowerCase().includes('demo'));
    tasksData.forEach(t => {
      if (!t.verificationCode && !t.code && !t.secretCode) {
        const gen = Math.floor(100000 + Math.random() * 900000).toString();
        t.verificationCode = gen;
        t.code = gen;
        t.secretCode = gen;
      }
    });
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasksData));
    localStorage.setItem('admin_tasks', JSON.stringify(tasksData));
  } catch (e) {
    tasksData = [];
  }

  // 2. Users (Strictly real Firebase users; remove mock/demo users)
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    let parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) parsed = [];
    parsed = parsed.filter(u => u && typeof u === 'object' && !isDemoUser(u));

    const uid = (window.Firebase && typeof window.Firebase.getEffectivePlayerUid === 'function')
      ? window.Firebase.getEffectivePlayerUid()
      : localStorage.getItem('player_uid');
    if (uid) {
      const pCoins = parseInt(localStorage.getItem('task_game_coins') || '0', 10) || 0;
      const pStars = parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0;
      const pName = localStorage.getItem('player_username') || 'Player';
      const pAvatar = localStorage.getItem('player_avatar') || '⚡';
      const pTotalTasks = parseInt(localStorage.getItem('completed_tasks_count') || localStorage.getItem(TOTAL_TASKS_KEY) || '0', 10) || 0;
      const pEventTasks = parseInt(localStorage.getItem(EVENT_TASKS_KEY) || '0', 10) || 0;
      let me = parsed.find(u => u.id === uid || u.uid === uid);
      if (!me) {
        parsed.unshift({
          id: uid,
          name: pName,
          avatar: pAvatar,
          level: 'LVL 1 • PLAYER',
          coins: pCoins,
          stars: pStars,
          totalTasks: pTotalTasks,
          eventTasks: pEventTasks,
          status: 'active',
          joined: 'Today'
        });
      } else {
        if (pName && pName !== 'Player') me.name = pName;
        me.coins = pCoins;
        me.stars = pStars;
        me.totalTasks = pTotalTasks;
        me.eventTasks = pEventTasks;
      }
    }
    usersData = parsed;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersData));
  } catch (e) {
    usersData = [];
  }

  // 3. Withdrawals (Real requests only — remove any demo entries)
  try {
    const raw = localStorage.getItem(WITHDRAW_STORAGE_KEY);
    let parsedWd = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsedWd)) parsedWd = [];
    withdrawalsData = parsedWd.filter(w => w && !w.isDemo && !String(w.id || '').toLowerCase().includes('demo') && !['WD-8491', 'WD-8490', 'WD-8489', 'WD-8488'].includes(w.id));
    localStorage.setItem(WITHDRAW_STORAGE_KEY, JSON.stringify(withdrawalsData));
  } catch (e) {
    withdrawalsData = [];
  }

  updateAdminCounters();
  if (typeof loadAdminAppSettingsUI === 'function') loadAdminAppSettingsUI();
}

/**
 * Update badge counts on Admin Menu Bar & Home-matched Hub Summary
 */
function updateAdminCounters() {
  const taskCount = document.getElementById('adminMenuTaskCount');
  if (taskCount) taskCount.textContent = tasksData.length.toString();

  const userCount = document.getElementById('adminMenuUserCount');
  if (userCount) userCount.textContent = usersData.length.toString();

  const pendingWd = withdrawalsData.filter(w => w.status === 'pending');
  const wdCount = document.getElementById('adminMenuPendingCount');
  if (wdCount) {
    wdCount.textContent = pendingWd.length.toString();
    wdCount.style.display = pendingWd.length > 0 ? 'inline-block' : 'none';
  }

  const statTasks = document.getElementById('adminHubStatTotalTasks');
  const statPlayers = document.getElementById('adminHubStatPlayers');
  const statPending = document.getElementById('adminHubStatPending');
  if (statTasks) statTasks.textContent = tasksData.length.toString();
  if (statPlayers) statPlayers.textContent = usersData.length.toString();
  if (statPending) statPending.textContent = pendingWd.length.toString();

  // 8 Category Slices via unified normalizer
  const commonList = filterTasksForAdminCat('common');
  const simpleList = filterTasksForAdminCat('simple');
  const premiumList = filterTasksForAdminCat('premium');
  const proList = filterTasksForAdminCat('pro');
  const ultraList = filterTasksForAdminCat('ultra');
  const quizList = filterTasksForAdminCat('quiz');
  const diamondList = filterTasksForAdminCat('diamond');
  const googleList = filterTasksForAdminCat('google');

  // Hub Cards Available Counts (Exact real Firebase counts — 0 when empty)
  const hubCommon = document.getElementById('adminHubCountCommon');
  const hubSimple = document.getElementById('adminHubCountSimple');
  const hubPremium = document.getElementById('adminHubCountPremium');
  const hubPro = document.getElementById('adminHubCountPro');
  const hubUltra = document.getElementById('adminHubCountUltra');
  const hubQuiz = document.getElementById('adminHubCountQuiz');
  const hubDiamond = document.getElementById('adminHubCountDiamond');
  const hubGoogle = document.getElementById('adminHubCountGoogle');
  if (hubCommon) hubCommon.textContent = commonList.length.toString();
  if (hubSimple) hubSimple.textContent = simpleList.length.toString();
  if (hubPremium) hubPremium.textContent = premiumList.length.toString();
  if (hubPro) hubPro.textContent = proList.length.toString();
  if (hubUltra) hubUltra.textContent = ultraList.length.toString();
  if (hubQuiz) hubQuiz.textContent = quizList.length.toString();
  if (hubDiamond) hubDiamond.textContent = diamondList.length.toString();
  if (hubGoogle) hubGoogle.textContent = googleList.length.toString();

  // Legacy Counts
  const cntAll = document.getElementById('countAdminFilterAll');
  const cntSimple = document.getElementById('countAdminFilterSimple');
  const cntPremium = document.getElementById('countAdminFilterPremium');
  const cntPro = document.getElementById('countAdminFilterPro');
  if (cntAll) cntAll.textContent = tasksData.length.toString();
  if (cntSimple) cntSimple.textContent = simpleList.length.toString();
  if (cntPremium) cntPremium.textContent = premiumList.length.toString();
  if (cntPro) cntPro.textContent = proList.length.toString();

  // Active Category List for Header Count & Level Breakdown
  let currentList = commonList;
  if (currentAdminCategoryTab === 'simple') currentList = simpleList;
  else if (currentAdminCategoryTab === 'premium') currentList = premiumList;
  else if (currentAdminCategoryTab === 'pro') currentList = proList;
  else if (currentAdminCategoryTab === 'ultra') currentList = ultraList;
  else if (currentAdminCategoryTab === 'quiz') currentList = quizList;
  else if (currentAdminCategoryTab === 'diamond') currentList = diamondList;
  else if (currentAdminCategoryTab === 'google') currentList = googleList;

  // Category Header Count Pill
  const catHeaderCount = document.getElementById('adminCatPageHeaderCount');
  if (catHeaderCount) {
    catHeaderCount.textContent = `${currentList.length} Tasks`;
  }

  // Level-Wise Breakdown Counts
  const cntLvlAll = document.getElementById('countLvlAll');
  const cntLvl1 = document.getElementById('countLvl1');
  const cntLvl2 = document.getElementById('countLvl2');
  const cntLvl3 = document.getElementById('countLvl3');
  const cntLvl4 = document.getElementById('countLvl4');
  const cntLvl5 = document.getElementById('countLvl5');
  if (cntLvlAll) cntLvlAll.textContent = currentList.length.toString();
  if (cntLvl1) cntLvl1.textContent = currentList.filter(t => Number(t.level || 1) === 1).length.toString();
  if (cntLvl2) cntLvl2.textContent = currentList.filter(t => Number(t.level || 1) === 2).length.toString();
  if (cntLvl3) cntLvl3.textContent = currentList.filter(t => Number(t.level || 1) === 3).length.toString();
  if (cntLvl4) cntLvl4.textContent = currentList.filter(t => Number(t.level || 1) === 4).length.toString();
  if (cntLvl5) cntLvl5.textContent = currentList.filter(t => Number(t.level || 1) === 5).length.toString();
}

// -----------------------------------------------------------------------------
// 1. ADMIN TASK CATEGORY CONTROLLER (COMMON, COIN, STAR, PRO, ULTRA)
// -----------------------------------------------------------------------------

let currentAdminTaskCategoryFilter = 'common';
let currentAdminCategoryTab = 'common';
let currentAdminLevelFilter = 'all';
let isCategoryQuickEditActive = false;

const ADMIN_CATEGORY_META = {
  common: { icon: '📋', shortName: 'Common', name: 'Common Tasks', editorTitle: 'Common Task Editor', color: '#38bdf8', border: 'rgba(125, 211, 252, 0.72)', bgImg: 'bg-common.png', scrim: 'linear-gradient(95deg, rgba(6, 22, 52, 0.92) 0%, rgba(8, 38, 82, 0.74) 55%, rgba(14, 116, 144, 0.25) 100%)' },
  simple: { icon: '🪙', shortName: 'Coin', name: 'Coin Tasks', editorTitle: 'Coin Task Editor', color: '#60a5fa', border: 'rgba(96, 165, 250, 0.65)', bgImg: 'bg-coin.png', scrim: 'linear-gradient(95deg, rgba(8, 16, 48, 0.92) 0%, rgba(15, 28, 80, 0.74) 55%, rgba(29, 78, 216, 0.25) 100%)' },
  premium: { icon: '⭐', shortName: 'Star', name: 'Star Tasks', editorTitle: 'Star Task Editor', color: '#c084fc', border: 'rgba(192, 132, 252, 0.72)', bgImg: 'bg-star.png', scrim: 'linear-gradient(95deg, rgba(20, 10, 44, 0.92) 0%, rgba(44, 18, 82, 0.74) 55%, rgba(126, 34, 206, 0.25) 100%)' },
  pro: { icon: '💎', shortName: 'Pro', name: 'Pro Tasks', editorTitle: 'Pro Task Editor', color: '#cbd5e1', border: 'rgba(226, 232, 240, 0.65)', bgImg: 'bg-pro.png', scrim: 'linear-gradient(95deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.74) 55%, rgba(100, 116, 139, 0.25) 100%)' },
  ultra: { icon: '⚡', shortName: 'Ultra', name: 'Ultra Tasks', editorTitle: 'Ultra Task Editor', color: '#facc15', border: 'rgba(250, 204, 21, 0.72)', bgImg: 'bg-ultra.png', scrim: 'linear-gradient(95deg, rgba(41, 18, 4, 0.92) 0%, rgba(66, 32, 6, 0.74) 55%, rgba(202, 138, 4, 0.25) 100%)' },
  quiz: { icon: '🧠', shortName: 'Quiz', name: 'Quiz Tasks', editorTitle: 'Quiz Task Editor', color: '#34d399', border: 'rgba(52, 211, 153, 0.68)', bgImg: 'bg-quiz.png', scrim: 'linear-gradient(95deg, rgba(4, 34, 28, 0.92) 0%, rgba(6, 78, 59, 0.74) 55%, rgba(16, 185, 129, 0.25) 100%)' },
  diamond: { icon: '💎', shortName: 'Diamond', name: 'Diamond Tasks', editorTitle: 'Diamond Task Editor', color: '#22d3ee', border: 'rgba(103, 232, 249, 0.72)', bgImg: 'bg-diamond.png', scrim: 'linear-gradient(95deg, rgba(6, 24, 48, 0.92) 0%, rgba(8, 51, 68, 0.74) 55%, rgba(34, 211, 238, 0.25) 100%)' },
  google: { icon: '📝', shortName: 'Google', name: 'Google Form Tasks', editorTitle: 'Google Form Editor', color: '#818cf8', border: 'rgba(244, 114, 182, 0.68)', bgImg: 'bg-google.png', scrim: 'linear-gradient(95deg, rgba(24, 16, 56, 0.92) 0%, rgba(49, 46, 129, 0.74) 55%, rgba(236, 72, 153, 0.25) 100%)' }
};

function renderAdminCategorySwitchTabs(containerId, activeCat, clickFnName) {
  const host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = '';
  host.style.display = 'none';
}

function setAdminTaskSubPageMode(mode, themeCat) {
  const mainHeader = document.getElementById('adminDashHeader');
  const topHeaderBar = document.getElementById('adminTopHeaderBar');
  const globalToolbar = document.getElementById('adminGlobalToolbar');
  const summaryCard = document.getElementById('adminHubSummaryCard');
  const adminMenu = document.getElementById('adminMenuBar');
  const belowMenu = document.getElementById('belowMenuBar');
  const hub = document.getElementById('adminTaskCategoryHub');
  const pageView = document.getElementById('adminTaskCategoryPageView');
  const editorView = document.getElementById('adminAllTasksEditorPageView');

  const showEl = (el, disp) => {
    if (!el) return;
    el.classList.remove('admin-subview-hidden');
    el.style.display = disp;
  };
  const hideEl = (el) => {
    if (!el) return;
    el.classList.add('admin-subview-hidden');
    el.style.display = 'none';
  };
  const applyTheme = (el) => {
    if (!el || !themeCat) return;
    ['theme-common', 'theme-simple', 'theme-premium', 'theme-pro', 'theme-ultra', 'theme-quiz', 'theme-diamond', 'theme-google'].forEach(c => el.classList.remove(c));
    el.classList.add(`theme-${themeCat}`);
  };

  if (mainHeader) mainHeader.style.display = 'none';
  if (globalToolbar) globalToolbar.style.display = 'none';

  if (mode === 'hub') {
    if (topHeaderBar) topHeaderBar.style.display = 'flex';
    if (summaryCard) summaryCard.style.display = 'flex';
    if (adminMenu) adminMenu.style.display = 'flex';
    hideEl(pageView);
    hideEl(editorView);
    showEl(hub, 'flex');
    return;
  }

  if (topHeaderBar) topHeaderBar.style.display = 'none';
  if (summaryCard) summaryCard.style.display = 'none';
  if (adminMenu) adminMenu.style.display = 'none';
  if (belowMenu) belowMenu.style.display = 'none';
  hideEl(hub);

  if (mode === 'category') {
    hideEl(editorView);
    applyTheme(pageView);
    applyTheme(document.getElementById('adminCategoryTaskModalOverlay'));
    showEl(pageView, 'block');
  } else if (mode === 'editor') {
    hideEl(pageView);
    applyTheme(editorView);
    applyTheme(document.getElementById('adminCategoryTaskModalOverlay'));
    showEl(editorView, 'block');
  }

  try { if (typeof window.scrollTo === 'function') window.scrollTo(0, 0); } catch (e) {}
}

/**
 * Open Dedicated Category Full Page View
 * Hides Hub cleanly (never below Quiz card) and shows full-page category manager
 * @param {'common'|'simple'|'premium'|'pro'|'ultra'|'coin'|'star'|'quiz'} cat
 */
function openAdminTaskCategoryPage(cat) {
  cat = normalizeAdminTaskCategory(cat);

  currentAdminCategoryTab = cat;
  currentAdminTaskCategoryFilter = cat;
  currentAdminLevelFilter = 'all';

  setAdminTaskSubPageMode('category', cat);

  const meta = ADMIN_CATEGORY_META[cat] || ADMIN_CATEGORY_META.common;
  const iconEl = document.getElementById('adminCatPageHeaderIcon');
  const titleEl = document.getElementById('adminCatPageHeaderTitle');
  if (iconEl) iconEl.textContent = meta.icon;
  if (titleEl) {
    titleEl.textContent = meta.name;
    titleEl.style.color = meta.color;
  }
  const topBar = document.getElementById('adminCatPageTopBar');
  if (topBar) topBar.style.borderColor = meta.border;

  renderAdminCategorySwitchTabs('adminPageCategoryTabs', cat, 'openAdminTaskCategoryPage');

  // Hide level breakdown dropdown button on categories without level selection
  const lvlBtn = document.getElementById('btnToggleLevelBreakdown');
  if (lvlBtn) {
    lvlBtn.style.display = ['common', 'pro', 'ultra', 'quiz', 'diamond', 'google'].includes(cat) ? 'none' : '';
  }

  toggleLevelBreakdown(false);
  closeCategoryTaskPopup();
  renderAdminTasksList();
}
window.openAdminTaskCategoryPage = openAdminTaskCategoryPage;

function renderAdminCatProgressBanner(cat, list, targetId = 'adminCatProgressBanner') {
  const banner = document.getElementById(targetId);
  if (!banner) return;
  banner.innerHTML = '';
  banner.style.display = 'none';
}

/**
 * Close Dedicated Category Page View and return to Hub (Restores main heading and bottom admin menu bar)
 */
function closeAdminTaskCategoryPage() {
  setAdminTaskSubPageMode('hub');
  toggleLevelBreakdown(false);
  closeCategoryTaskPopup();
  updateAdminCounters();
}
window.closeAdminTaskCategoryPage = closeAdminTaskCategoryPage;

// -----------------------------------------------------------------------------
// 1B. EVENT TAB SETTINGS NAVIGATION (All App Settings shown directly inside Event)
// -----------------------------------------------------------------------------
function filterAdminEventSettings(sectionKey = 'all', btnEl) {
  document.querySelectorAll('#adminEventSettingsFilterTabs .filter-pill').forEach((b) => b.classList.remove('active'));
  if (btnEl) {
    btnEl.classList.add('active');
  } else {
    const match = document.querySelector(`#adminEventSettingsFilterTabs [data-sec-tab="${sectionKey}"]`);
    if (match) match.classList.add('active');
  }
  document.querySelectorAll('#adminEventAllSettingsWrap .admin-settings-sec').forEach((sec) => {
    const k = sec.getAttribute('data-sec') || '';
    sec.style.display = (sectionKey === 'all' || k === sectionKey) ? 'block' : 'none';
  });
}

function openAdminSettingsPage() {
  switchAdminSubView('event');
  if (typeof switchAdminEventTab === 'function') switchAdminEventTab('settings');
  if (typeof loadAdminAppSettingsUI === 'function') loadAdminAppSettingsUI();
  filterAdminEventSettings('all');
  setTimeout(() => {
    const el = document.getElementById('adminEventAllSettingsWrap');
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 60);
}

function openAdminSettingsDetailPage(sectionKey = 'all') {
  switchAdminSubView('event');
  if (typeof switchAdminEventTab === 'function') switchAdminEventTab('settings');
  if (typeof loadAdminAppSettingsUI === 'function') loadAdminAppSettingsUI();
  filterAdminEventSettings(sectionKey || 'all');
}

function backToAdminSettingsHub() {
  filterAdminEventSettings('all');
}

function closeAdminSettingsPage() {
  switchAdminSubView('tasks');
}

window.filterAdminEventSettings = filterAdminEventSettings;
window.openAdminSettingsPage = openAdminSettingsPage;
window.openAdminSettingsDetailPage = openAdminSettingsDetailPage;
window.backToAdminSettingsHub = backToAdminSettingsHub;
window.closeAdminSettingsPage = closeAdminSettingsPage;

function filterAdminTasksCategory(cat) {
  openAdminTaskCategoryPage(cat);
}
window.filterAdminTasksCategory = filterAdminTasksCategory;

// -----------------------------------------------------------------------------
// 2. LEVEL-WISE TASK COUNT DROPDOWN & FILTER
// -----------------------------------------------------------------------------

function toggleLevelBreakdown(forceState) {
  const card = document.getElementById('adminLevelBreakdownCard');
  const btn = document.getElementById('btnToggleLevelBreakdown');
  if (!card) return;

  const isVisible = (card.style.display === 'block');
  const nextState = (typeof forceState === 'boolean') ? forceState : !isVisible;

  card.style.display = nextState ? 'block' : 'none';
  if (btn) {
    if (nextState) btn.classList.add('active');
    else btn.classList.remove('active');
  }
}
window.toggleLevelBreakdown = toggleLevelBreakdown;

function filterByLevel(lvl) {
  currentAdminLevelFilter = (lvl === 'all') ? 'all' : parseInt(lvl, 10);

  // Update active class in dropdown items
  ['filterLvlAll', 'filterLvl1', 'filterLvl2', 'filterLvl3', 'filterLvl4', 'filterLvl5'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });

  if (currentAdminLevelFilter === 'all') {
    document.getElementById('filterLvlAll')?.classList.add('active');
  } else {
    document.getElementById(`filterLvl${currentAdminLevelFilter}`)?.classList.add('active');
  }

  toggleLevelBreakdown(false);
  renderAdminTasksList();
}
window.filterByLevel = filterByLevel;

// -----------------------------------------------------------------------------
// 3. ACTION MENU HANDLERS (ADD, QUICK EDIT, RESTART, DELETE ALL)
// -----------------------------------------------------------------------------

function toggleCategoryQuickEditMode() {
  isCategoryQuickEditActive = !isCategoryQuickEditActive;
  const btn = document.getElementById('btnCategoryQuickEdit');
  if (btn) {
    if (isCategoryQuickEditActive) {
      btn.classList.add('active');
      btn.innerHTML = '<span>✕ Done Editing</span>';
      showToast('✏️ Edit mode active: click "✏️ Edit" on any task below to modify it.');
    } else {
      btn.classList.remove('active');
      btn.innerHTML = '<span>✏️ Edit Tasks</span>';
    }
  }
  renderAdminTasksList();
}
window.toggleCategoryQuickEditMode = toggleCategoryQuickEditMode;

function restartCategoryTasks() {
  const catNames = {
    common: 'Common Tasks',
    simple: 'Coin Tasks',
    premium: 'Star Tasks',
    pro: 'Pro Tasks',
    ultra: 'Ultra Tasks',
    quiz: 'Quiz Tasks',
    diamond: 'Diamond Tasks',
    google: 'Google Form Tasks'
  };
  const name = catNames[currentAdminCategoryTab] || 'Category Tasks';

  if (!confirm(`🔄 Restart all missions in ${name}?\n\nThis will reset completion records and cooldowns for this category so all players can play and complete them again!`)) {
    return;
  }

  // Clear claims & cooldowns for tasks in this category
  try {
    const claimsRaw = localStorage.getItem(CLAIMS_STORAGE_KEY);
    let claims = claimsRaw ? JSON.parse(claimsRaw) : {};
    tasksData.forEach(t => {
      if (normalizeAdminTaskCategory(t.category, t) === currentAdminCategoryTab) {
        delete claims[t.id];
        localStorage.removeItem(`task_opened_${t.id}`);
        localStorage.removeItem(`task_claimed_${t.id}`);
      }
    });
    localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(claims));
    localStorage.setItem(SYNC_FLAG_KEY, Date.now().toString());
    if (syncChannel) {
      syncChannel.postMessage({ type: 'CLAIMS_UPDATED', timestamp: Date.now() });
    }
  } catch(e) {}

  showToast(`🔄 All ${name} restarted! Cooldowns cleared for all players. ✓`);
}
window.restartCategoryTasks = restartCategoryTasks;

function deleteAllCategoryTasks() {
  const catNames = {
    common: 'Common Tasks',
    simple: 'Coin Tasks',
    premium: 'Star Tasks',
    pro: 'Pro Tasks',
    ultra: 'Ultra Tasks',
    quiz: 'Quiz Tasks',
    diamond: 'Diamond Tasks',
    google: 'Google Form Tasks'
  };
  const name = catNames[currentAdminCategoryTab] || 'Category Tasks';

  if (!confirm(`⚠️ Are you sure you want to DELETE ALL tasks in ${name}?\n\nThis will permanently remove all tasks in this category.`)) {
    return;
  }

  tasksData = tasksData.filter(t => {
    const cat = String(t && t.category || '').toLowerCase();
    if (currentAdminCategoryTab === 'common') return cat !== 'common';
    if (currentAdminCategoryTab === 'simple') return (cat !== 'simple' && cat !== 'coin') || t.isShopTask;
    if (currentAdminCategoryTab === 'premium') return (cat !== 'premium' && cat !== 'star' && !t.isShopTask && cat !== 'shop_task');
    if (currentAdminCategoryTab === 'pro') return (cat !== 'pro' && cat !== 'elite');
    if (currentAdminCategoryTab === 'ultra') return cat !== 'ultra';
    if (currentAdminCategoryTab === 'quiz') return cat !== 'quiz';
    if (currentAdminCategoryTab === 'diamond') return (cat !== 'diamond' && cat !== 'diamonds');
    if (currentAdminCategoryTab === 'google') return !['google', 'google_form', 'google-form', 'googleform', 'form'].includes(cat);
    return true;
  });

  saveTasksAndSync();
  showToast(`🗑️ All tasks in ${name} have been removed.`);
}
window.deleteAllCategoryTasks = deleteAllCategoryTasks;

// -----------------------------------------------------------------------------
// 4. SLIDE-UP POPUP MODAL CONTROLLER (ADD NEW MISSION & EDIT INDIVIDUAL MISSION)
// -----------------------------------------------------------------------------

/**
 * Open Slide-up modal to ADD a new mission in the active category
 */
let _slideUpCloseTimer = null;

function openAddCategoryTaskPopup() {
  if (_slideUpCloseTimer) { clearTimeout(_slideUpCloseTimer); _slideUpCloseTimer = null; }
  const overlay = document.getElementById('adminCategoryTaskModalOverlay');
  if (!overlay) return;

  const cat = currentAdminCategoryTab || 'common';
  const heading = document.getElementById('slideUpModalHeading');
  const icon = document.getElementById('slideUpModalIcon');

  const metaAdd = {
    common: { icon: '📋', name: 'Add Common Task' },
    simple: { icon: '🪙', name: 'Add Coin Task' },
    premium: { icon: '⭐', name: 'Add Star Task' },
    pro: { icon: '💎', name: 'Add Pro 3-Task Package' },
    ultra: { icon: '⚡', name: 'Add Ultra Task' },
    quiz: { icon: '🧠', name: 'Add Quiz Task' },
    diamond: { icon: '💎', name: 'Add Diamond Task' },
    google: { icon: '📝', name: 'Add Google Form Task' }
  };

  if (heading) heading.textContent = metaAdd[cat]?.name || 'Add Task';
  if (icon) icon.textContent = metaAdd[cat]?.icon || '📋';

  // Hide edit selector row when adding a new task
  const selectorRow = document.getElementById('slideUpEditTaskSelectorRow');
  if (selectorRow) selectorRow.style.display = 'none';

  // Unlock editable cost price inputs in add mode (keep Ultra fixed 1000 Star cost readOnly)
  const costInputs = ['popupCoinTicketCost', 'popupProPackageCoinCost', 'popupQuizDiamondCost', 'popupDiamondUnlockCost', 'popupGoogleUnlockCost', 'taskInputTicketCost'];
  costInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.readOnly = false;
      el.style.opacity = '1';
      el.style.cursor = 'text';
      el.title = '';
    }
  });

  // Display only matching form inside slide-up modal
  ['popupFormCommon', 'popupFormCoin', 'popupFormStar', 'popupFormPro', 'popupFormUltra', 'popupFormQuiz', 'popupFormDiamond', 'popupFormGoogle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const formMap = {
    common: 'popupFormCommon',
    simple: 'popupFormCoin',
    premium: 'popupFormStar',
    pro: 'popupFormPro',
    ultra: 'popupFormUltra',
    quiz: 'popupFormQuiz',
    diamond: 'popupFormDiamond',
    google: 'popupFormGoogle'
  };

  const activeForm = document.getElementById(formMap[cat]);
  if (activeForm) activeForm.style.display = 'block';

  // Reset Form to Clean Default Values for Adding
  const formatLocalDtInput = (ms) => {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (cat === 'common') {
    const f = document.getElementById('popupFormCommon');
    if (f) {
      f.reset();
      document.getElementById('popupCommonEditId').value = '';
      document.getElementById('popupCommonTitle').value = 'Webtask';
      document.getElementById('popupCommonRewardTickets').value = '50';
      document.getElementById('popupCommonCode').value = Math.floor(100000 + Math.random() * 900000).toString();
      document.getElementById('btnSavePopupCommon').textContent = 'Save Common Task ✓';
      switchPopupCommonMode('single');
    }
  } else if (cat === 'simple') {
    const f = document.getElementById('popupFormCoin');
    if (f) {
      f.reset();
      document.getElementById('popupCoinEditId').value = '';
      document.getElementById('popupCoinTitle').value = 'Webtask';
      if (document.getElementById('popupCoinUnlockCurrency')) document.getElementById('popupCoinUnlockCurrency').value = 'tickets';
      document.getElementById('popupCoinTicketCost').value = '100';
      document.getElementById('popupCoinRewardCoins').value = '150';
      if (document.getElementById('popupCoinLevel')) document.getElementById('popupCoinLevel').value = '1';
      document.getElementById('popupCoinCode').value = Math.floor(100000 + Math.random() * 900000).toString();
      document.getElementById('btnSavePopupCoin').textContent = 'Save Coin Task ✓';
    }
  } else if (cat === 'premium') {
    const f = document.getElementById('popupFormStar');
    if (f) {
      f.reset();
      document.getElementById('popupStarEditId').value = '';
      document.getElementById('popupStarTitle').value = 'Webtask';
      document.getElementById('popupStarRewardStars').value = '20';
      document.getElementById('popupStarLevel').value = '1';
      const s = (window.TapEmpireUtils && window.TapEmpireUtils.getAppSettings && window.TapEmpireUtils.getAppSettings()) || {};
      const defG = Math.max(1, parseInt((s.starUnlock && s.starUnlock.googleTasksPerUnlock) || '2', 10) || 2);
      const gReqEl = document.getElementById('popupStarGoogleReq');
      if (gReqEl) gReqEl.value = String(defG);
      document.getElementById('popupStarCode').value = Math.floor(100000 + Math.random() * 900000).toString();
      document.getElementById('btnSavePopupStar').textContent = 'Save Star Task ✓';
    }
  } else if (cat === 'pro') {
    const f = document.getElementById('popupFormPro');
    if (f) {
      f.reset();
      document.getElementById('popupProEditId').value = '';
      if (document.getElementById('popupProCostCurrency')) document.getElementById('popupProCostCurrency').value = 'coins';
      document.getElementById('popupProPackageCoinCost').value = '5000';
      document.getElementById('popupProRewardStars').value = '1000';
      document.getElementById('popupProTask1Title').value = 'Webtask 1';
      document.getElementById('popupProTask2Title').value = 'Webtask 2';
      document.getElementById('popupProTask3Title').value = 'Webtask 3';
      document.getElementById('popupProTask1Code').value = Math.floor(100000 + Math.random() * 900000).toString();
      document.getElementById('popupProTask2Code').value = Math.floor(100000 + Math.random() * 900000).toString();
      document.getElementById('popupProTask3Code').value = Math.floor(100000 + Math.random() * 900000).toString();
      setProEventDurationHours(24);
      document.getElementById('btnSavePopupPro').textContent = 'Save Pro Package ✓';
    }
  } else if (cat === 'ultra') {
    const f = document.getElementById('popupFormUltra');
    if (f) {
      f.reset();
      document.getElementById('popupUltraEditId').value = '';
      document.getElementById('popupUltraTitle').value = 'Webtask';
      const starCostEl = document.getElementById('popupUltraStarCost');
      const rewardStarsEl = document.getElementById('popupUltraRewardStars');
      if (starCostEl) { starCostEl.value = '1000'; starCostEl.readOnly = true; }
      if (rewardStarsEl) { rewardStarsEl.value = '2000'; rewardStarsEl.readOnly = true; }
      document.getElementById('popupUltraCode').value = Math.floor(100000 + Math.random() * 900000).toString();
      document.getElementById('btnSavePopupUltra').textContent = 'Save Ultra Task ✓';
    }
  } else if (cat === 'quiz') {
    const f = document.getElementById('popupFormQuiz');
    if (f) {
      f.reset();
      document.getElementById('popupQuizEditId').value = '';
      document.getElementById('popupQuizTitle').value = 'Quiz Mission';
      document.getElementById('popupQuizUrl').value = 'https://google.com/';
      document.getElementById('popupQuizCode').value = Math.floor(100000 + Math.random() * 900000).toString();
      const startEl = document.getElementById('popupQuizStartTime');
      if (startEl) startEl.value = formatLocalDtInput(Date.now());
      if (document.getElementById('popupQuizTargetCommon')) document.getElementById('popupQuizTargetCommon').value = '5';
      if (document.getElementById('popupQuizDiamondCost')) document.getElementById('popupQuizDiamondCost').value = '1';
      if (document.getElementById('popupQuizTimer')) document.getElementById('popupQuizTimer').value = '300';
      document.getElementById('btnSavePopupQuiz').textContent = 'Save Quiz Task ✓';
    }
  } else if (cat === 'diamond') {
    const f = document.getElementById('popupFormDiamond');
    if (f) {
      f.reset();
      if (document.getElementById('popupDiamondEditId')) document.getElementById('popupDiamondEditId').value = '';
      if (document.getElementById('popupDiamondTitle')) document.getElementById('popupDiamondTitle').value = 'Webtask';
      if (document.getElementById('popupDiamondUrl')) document.getElementById('popupDiamondUrl').value = 'https://google.com/';
      if (document.getElementById('popupDiamondReward')) document.getElementById('popupDiamondReward').value = '1';
      if (document.getElementById('popupDiamondUnlockCurrency')) document.getElementById('popupDiamondUnlockCurrency').value = 'coins';
      if (document.getElementById('popupDiamondUnlockCost')) document.getElementById('popupDiamondUnlockCost').value = '0';
      if (document.getElementById('popupDiamondCode')) document.getElementById('popupDiamondCode').value = Math.floor(100000 + Math.random() * 900000).toString();
      if (document.getElementById('popupDiamondActive')) document.getElementById('popupDiamondActive').checked = true;
      if (document.getElementById('btnSavePopupDiamond')) document.getElementById('btnSavePopupDiamond').textContent = 'Save Diamond Task ✓';
    }
  } else if (cat === 'google') {
    const f = document.getElementById('popupFormGoogle');
    if (f) {
      f.reset();
      if (document.getElementById('popupGoogleEditId')) document.getElementById('popupGoogleEditId').value = '';
      if (document.getElementById('popupGoogleTitle')) document.getElementById('popupGoogleTitle').value = 'Google Form Survey';
      if (document.getElementById('popupGoogleUrl')) document.getElementById('popupGoogleUrl').value = 'https://docs.google.com/forms/';
      if (document.getElementById('popupGoogleReward')) document.getElementById('popupGoogleReward').value = '1';
      if (document.getElementById('popupGoogleUnlockCurrency')) document.getElementById('popupGoogleUnlockCurrency').value = 'coins';
      if (document.getElementById('popupGoogleUnlockCost')) document.getElementById('popupGoogleUnlockCost').value = '0';
      if (document.getElementById('popupGoogleCode')) document.getElementById('popupGoogleCode').value = Math.floor(100000 + Math.random() * 900000).toString();
      if (document.getElementById('popupGoogleActive')) document.getElementById('popupGoogleActive').checked = true;
      if (document.getElementById('btnSavePopupGoogle')) document.getElementById('btnSavePopupGoogle').textContent = 'Save Google Task ✓';
    }
  }

  const card = overlay.querySelector('.admin-slideup-modal-card');
  if (card) card.classList.remove('closing');
  overlay.classList.add('open');
  overlay.style.display = 'flex';
}
window.openAddCategoryTaskPopup = openAddCategoryTaskPopup;

/**
 * Open Slide-up modal to EDIT an individual task in the active category
 * @param {string} taskId
 */
function openEditCategoryTaskPopup(taskId) {
  const overlay = document.getElementById('adminCategoryTaskModalOverlay');
  if (!overlay) return;

  const task = tasksData.find(t => t.id === taskId);
  if (!task) return;

  let cat = normalizeAdminTaskCategory(task.category || currentAdminCategoryTab, task);
  currentAdminCategoryTab = cat;

  const heading = document.getElementById('slideUpModalHeading');
  const icon = document.getElementById('slideUpModalIcon');

  const metaEdit = {
    common: { icon: '📋', name: `Edit Common Task: ${task.title || 'Webtask'}` },
    simple: { icon: '🪙', name: `Edit Coin Task: ${task.title || 'Webtask'}` },
    premium: { icon: '⭐', name: `Edit Star Task: ${task.title || 'Webtask'}` },
    pro: { icon: '💎', name: `Edit Pro Package: ${task.title || 'Webtask'}` },
    ultra: { icon: '⚡', name: `Edit Ultra Task: ${task.title || 'Webtask'}` },
    quiz: { icon: '🧠', name: `Edit Quiz Task: ${task.title || 'Trivia'}` },
    diamond: { icon: '💎', name: `Edit Diamond Task: ${task.title || 'Webtask'}` },
    google: { icon: '📝', name: `Edit Google Form Task: ${task.title || 'Google Form'}` }
  };

  if (heading) heading.textContent = metaEdit[cat]?.name || `Edit: ${task.title || 'Task'}`;
  if (icon) icon.textContent = metaEdit[cat]?.icon || '✏️';

  // Display only matching form inside slide-up modal
  ['popupFormCommon', 'popupFormCoin', 'popupFormStar', 'popupFormPro', 'popupFormUltra', 'popupFormQuiz', 'popupFormDiamond', 'popupFormGoogle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const formMap = {
    common: 'popupFormCommon',
    simple: 'popupFormCoin',
    premium: 'popupFormStar',
    pro: 'popupFormPro',
    ultra: 'popupFormUltra',
    quiz: 'popupFormQuiz',
    diamond: 'popupFormDiamond',
    google: 'popupFormGoogle'
  };

  const activeForm = document.getElementById(formMap[cat]);
  if (activeForm) activeForm.style.display = 'block';

  // Populate task selector dropdown for easy switching between tasks in this category
  const selectorRow = document.getElementById('slideUpEditTaskSelectorRow');
  const selectorDropdown = document.getElementById('slideUpTaskSelectDropdown');
  if (selectorRow && selectorDropdown) {
    const catTasks = filterTasksForAdminCat(cat);

    if (catTasks.length > 1) {
      selectorRow.style.display = 'block';
      selectorDropdown.innerHTML = catTasks.map(t => 
        `<option value="${t.id}" ${t.id === taskId ? 'selected' : ''}>${escapeHtml(t.title || 'Webtask')}${!['common','pro','ultra','quiz','diamond','google'].includes(cat) ? ` (Level ${t.level || 1})` : ''}</option>`
      ).join('');
    } else {
      selectorRow.style.display = 'none';
    }
  }

  // Load task data into the active category form
  loadTaskIntoSlideUpForm(taskId);

  if (_slideUpCloseTimer) { clearTimeout(_slideUpCloseTimer); _slideUpCloseTimer = null; }
  const card = overlay.querySelector('.admin-slideup-modal-card');
  if (card) card.classList.remove('closing');
  overlay.classList.add('open');
  overlay.style.display = 'flex';
}
window.openEditCategoryTaskPopup = openEditCategoryTaskPopup;

function formatEditorDatetimeLocal(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts) || ts);
  if (isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Open Full-Page Multi-Task Editor showing ALL category tabs and ALL task fields
 */
function openAdminAllTasksEditorPage(catArg) {
  const cat = normalizeAdminTaskCategory(catArg || currentAdminCategoryTab || 'common');
  currentAdminCategoryTab = cat;
  currentAdminTaskCategoryFilter = cat;

  setAdminTaskSubPageMode('editor', cat);

  const meta = ADMIN_CATEGORY_META[cat] || ADMIN_CATEGORY_META.common;
  const iconEl = document.getElementById('allTasksEditorHeaderIcon');
  const titleEl = document.getElementById('allTasksEditorHeaderTitle');
  const topBar = document.getElementById('adminAllEditorTopBar');
  if (iconEl) iconEl.textContent = meta.icon;
  if (titleEl) {
    titleEl.textContent = meta.editorTitle || 'Task Editor';
    titleEl.style.color = meta.color;
  }
  if (topBar) topBar.style.borderColor = meta.border;

  renderAdminCategorySwitchTabs('adminEditorCategoryTabs', cat, 'openAdminAllTasksEditorPage');

  const listEl = document.getElementById('adminAllTasksEditorList');
  const catTasks = filterTasksForAdminCat(cat);
  renderAdminCatProgressBanner(cat, catTasks, 'adminEditorProgressBanner');
  if (!listEl) return;

  if (catTasks.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem;background:#0a1738;border-radius:14px;border:1px dashed rgba(56,189,248,0.35);color:#94a3b8;">
        <div style="font-size:2rem;margin-bottom:0.4rem;">${meta.icon}</div>
        <div style="font-weight:800;color:#ffffff;margin-bottom:0.25rem;">No ${meta.shortName} Tasks Found</div>
        <div style="font-size:0.75rem;color:#94a3b8;margin-bottom:0.75rem;">Click "＋ Add Task" above to publish a new ${meta.shortName} task right from this editor.</div>
        <button type="button" class="btn-card-action" onclick="openAddCategoryTaskPopup()">＋ Add ${meta.shortName} Task</button>
      </div>`;
    return;
  }

  if (cat === 'pro') {
    const proPackMap = new Map();
    catTasks.forEach((t) => {
      const key = t.eventPackId || t.groupId || t.id;
      if (!proPackMap.has(key)) proPackMap.set(key, []);
      proPackMap.get(key).push(t);
    });
    const proPacks = Array.from(proPackMap.entries());
    listEl.innerHTML = proPacks.map(([packKey, packTasks], packIdx) => {
      const lead = packTasks[0] || {};
      const allPaused = packTasks.every(t => t.active === false);
      const isActive = !allPaused;
      const totalStars = packTasks.length >= 3
        ? packTasks.reduce((s, t) => s + Number(t.rewardStars || 0), 0)
        : Number(lead.rewardStars || 1000);
      const costVal = Number(lead.groupCostAmount !== undefined ? lead.groupCostAmount : (lead.unlockCost !== undefined ? lead.unlockCost : (lead.coinCost || 5000)));
      const costCurr = lead.groupCostCurrency || lead.unlockCurrency || 'coins';
      const slotsHtml = [0, 1, 2].map((slotIdx) => {
        const st = packTasks[slotIdx] || {};
        const stTitle = st.title || `Webtask ${slotIdx + 1}`;
        const stUrl = st.url || st.link || (slotIdx === 0 ? 'https://youtube.com/' : slotIdx === 1 ? 'https://telegram.org/' : 'https://google.com/');
        const stCode = normalizeTaskSecretCode(st.verificationCode || st.code || st.secretCode);
        return `
          <div class="admin-pro-pack-slot" data-pack-slot="${slotIdx}" data-slot-task-id="${escapeHtml(st.id || '')}" style="background:rgba(15,23,42,0.7);border:1px solid rgba(203,213,225,0.2);border-radius:10px;padding:0.5rem;margin-bottom:0.4rem;">
            <div style="font-size:0.68rem;font-weight:900;color:#e2e8f0;margin-bottom:0.35rem;">Task ${slotIdx + 1} of 3</div>
            <div style="display:grid;grid-template-columns:1fr 1.25fr 0.95fr;gap:6px;">
              <div>
                <label style="font-size:0.6rem;color:#94a3b8;">Title *</label>
                <input type="text" data-slot-field="title" class="admin-form-input font-bold" value="${escapeHtml(stTitle)}" style="font-size:0.72rem;padding:4px 6px;">
              </div>
              <div>
                <label style="font-size:0.6rem;color:#94a3b8;">Target URL *</label>
                <input type="url" data-slot-field="url" class="admin-form-input font-mono" value="${escapeHtml(stUrl)}" style="font-size:0.7rem;padding:4px 6px;color:#7dd3fc;">
              </div>
              <div>
                <label style="font-size:0.6rem;color:#94a3b8;">🔑 6-Digit Code</label>
                <div style="display:flex;gap:4px;">
                  <input type="text" maxlength="6" data-slot-field="code" class="admin-form-input font-mono font-bold" value="${escapeHtml(stCode)}" style="font-size:0.72rem;padding:4px 6px;color:#fde047;flex:1;min-width:0;">
                  <button type="button" onclick="generatePackSlotCode(this)" title="Randomize Code" class="btn-ctrl-code" style="padding:2px 6px;">🎲</button>
                </div>
              </div>
            </div>
          </div>`;
      }).join('');

      return `
        <div class="admin-pro-pack-editor-row admin-task-card" data-editor-pack-id="${escapeHtml(packKey)}" style="border-left: 4px solid ${isActive ? meta.color : '#64748b'} !important;">
          <div class="admin-task-view-top" style="margin-bottom:0.45rem;align-items:center;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;">
              <span style="font-size:0.74rem;font-weight:900;color:${meta.color};background:rgba(203,213,225,0.14);border:1px solid ${meta.border};padding:2px 7px;border-radius:999px;">Package #${packIdx + 1}</span>
              <span style="font-size:0.86rem;font-weight:800;color:#ffffff;">3-Task Pro Bundle</span>
              <span class="count-badge" style="background:rgba(250,204,21,0.16);color:#fde047;border:1px solid rgba(250,204,21,0.4);padding:2px 7px;font-size:0.68rem;">⭐ +${totalStars}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <label style="font-size:0.7rem;font-weight:800;color:${isActive ? '#34d399' : '#94a3b8'};display:flex;align-items:center;gap:4px;cursor:pointer;">
                <input type="checkbox" data-pack-field="active" ${isActive ? 'checked' : ''}> Active 🟢
              </label>
              <button type="button" class="btn-card-action danger" onclick="deleteProPackageFromEditor('${escapeHtml(packKey)}')" style="padding:3px 8px;font-size:0.68rem;min-height:26px;">🗑️</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:0.4rem;">
            <div>
              <label style="font-size:0.64rem;color:#94a3b8;">Unlock Currency</label>
              <select data-pack-field="unlockCurrency" class="admin-form-input" style="font-size:0.72rem;padding:4px 6px;">
                <option value="coins" ${costCurr === 'coins' ? 'selected' : ''}>🪙 Coins</option>
                <option value="tickets" ${costCurr === 'tickets' ? 'selected' : ''}>🎟️ Tickets</option>
                <option value="stars" ${costCurr === 'stars' ? 'selected' : ''}>⭐ Stars</option>
                <option value="diamonds" ${costCurr === 'diamonds' ? 'selected' : ''}>💎 Diamonds</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.64rem;color:#94a3b8;">Package Cost</label>
              <input type="number" min="0" data-pack-field="unlockCost" class="admin-form-input font-bold" value="${costVal}" style="font-size:0.75rem;padding:4px 6px;">
            </div>
            <div>
              <label style="font-size:0.64rem;color:#94a3b8;">Total Bounty (⭐)</label>
              <input type="number" min="0" data-pack-field="rewardStars" class="admin-form-input font-bold" value="${totalStars}" style="font-size:0.75rem;padding:4px 6px;color:#fbbf24;">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:0.5rem;">
            <div>
              <label style="font-size:0.64rem;color:#94a3b8;">Event Start</label>
              <input type="datetime-local" data-pack-field="eventStartTime" class="admin-form-input font-mono" value="${formatEditorDatetimeLocal(lead.eventStartTime || lead.createdAt)}" style="font-size:0.68rem;padding:4px 6px;">
            </div>
            <div>
              <label style="font-size:0.64rem;color:#94a3b8;">Event End</label>
              <input type="datetime-local" data-pack-field="eventEndTime" class="admin-form-input font-mono" value="${formatEditorDatetimeLocal(lead.eventEndTime || (Date.now() + 86400000))}" style="font-size:0.68rem;padding:4px 6px;">
            </div>
          </div>
          ${slotsHtml}
          <div class="admin-task-actions-bar" style="margin-top:0.35rem;">
            <button type="button" class="btn-card-action btn-task-edit-action" onclick="saveProPackageFromEditor('${escapeHtml(packKey)}')" style="font-size:0.74rem;">💾 Save 3-Task Package ✓</button>
          </div>
        </div>`;
    }).join('');
    return;
  }

  const rewardLabel = cat === 'common' ? 'Tickets 🎟️'
    : (cat === 'simple') ? 'Coins 🪙'
    : (cat === 'diamond' || cat === 'google') ? 'Diamonds 💎'
    : 'Stars ⭐';
  const showLevelSel = ['simple', 'premium'].includes(cat);

  listEl.innerHTML = catTasks.map((t, idx) => {
    const isActive = t.active !== false;
    const rewardVal = cat === 'common' ? (t.rewardTickets ?? t.ticketReward ?? 50)
      : (cat === 'simple') ? (t.rewardCoins ?? t.reward ?? t.coins ?? 150)
      : (cat === 'ultra') ? 2000
      : (cat === 'diamond' || cat === 'google') ? Math.max(1, parseInt(t.rewardDiamonds ?? t.diamondReward ?? '1', 10) || 1)
      : (cat === 'quiz') ? 0
      : (t.rewardStars ?? 20);
    const codeVal = String(t.verificationCode || t.code || t.secretCode || '').trim() || '123456';
    const timerVal = Number(t.timerDuration ?? t.timerSeconds ?? t.timer ?? (cat === 'quiz' ? (t.countdownSeconds ?? 300) : (cat === 'google' ? 15 : 10)));
    const costVal = Number(t.unlockCost !== undefined ? t.unlockCost : (t.ticketCost !== undefined ? t.ticketCost : (t.diamondCost || 0)));
    const costCurr = t.unlockCurrency || (cat === 'simple' ? 'tickets' : 'coins');
    const curLvl = Number(t.level || 1);
    const quizTargetCommon = Math.max(0, parseInt(t.targetCommonTasks ?? t.commonTarget ?? 5, 10) || 0);
    const quizDiamondCost = Math.max(0, parseInt(t.diamondCost ?? t.unlockCost ?? 1, 10) || 0);
    const _cfg = (window.TapEmpireUtils && window.TapEmpireUtils.getAppSettings && window.TapEmpireUtils.getAppSettings()) || {};
    const _gGlobalReq = Math.max(1, parseInt((_cfg.starUnlock && _cfg.starUnlock.googleTasksPerUnlock) || '2', 10) || 2);
    const starGoogleReq = (t.customGoogleReq && Number(t.googleFormRequired) >= 1) ? Number(t.googleFormRequired) : _gGlobalReq;

    const rewardBadge = cat === 'common' ? `🎟️ +${rewardVal}`
      : (cat === 'simple') ? `🪙 +${rewardVal}`
      : (cat === 'ultra') ? `⚡ 1,000 ⭐ → +2,000 ⭐ • ⏱️ 24h`
      : (cat === 'diamond') ? `💎 +${rewardVal} Diamond${rewardVal > 1 ? 's' : ''} • ${costVal > 0 ? `Cost ${costVal}` : 'Free'}`
      : (cat === 'google') ? `📝 Form • 💎 +${rewardVal} • ${costVal > 0 ? `Cost ${costVal}` : 'Free'}`
      : (cat === 'quiz') ? `🧠 Pass +1 • Step 1: ${quizTargetCommon} Common • Step 2: 💎 ${quizDiamondCost}`
      : `⭐ +${rewardVal} • 📝 ${starGoogleReq} Google`;

    let middleGridHtml = '';
    if (cat === 'ultra') {
      middleGridHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:0.4rem;">
          <div style="background:rgba(15,23,42,0.65);border:1px solid rgba(250,204,21,0.3);border-radius:8px;padding:4px 8px;display:flex;align-items:center;justify-content:space-between;font-size:0.68rem;">
            <span style="color:#94a3b8;">Fixed Rule:</span>
            <span style="color:#fde047;font-weight:800;">1,000 ⭐ → 2,000 ⭐ • ⏱️ 24h</span>
          </div>
          <div>
            <label style="font-size:0.64rem;color:#94a3b8;">🔑 6-Digit Code</label>
            <div style="display:flex;gap:4px;">
              <input type="text" maxlength="6" data-ed-field="code" class="admin-form-input font-mono font-bold" value="${escapeHtml(codeVal)}" style="font-size:0.75rem;padding:4px 6px;color:#fde047;flex:1;min-width:0;">
              <button type="button" onclick="generateEditorRowCode(this)" title="Randomize Code" class="btn-ctrl-code" style="padding:2px 6px;">🎲</button>
            </div>
          </div>
        </div>`;
    } else if (cat === 'premium') {
      middleGridHtml = `
        <div style="display:grid;grid-template-columns:0.85fr 0.85fr 1.15fr;gap:6px;margin-bottom:0.4rem;">
          <div>
            <label style="font-size:0.64rem;color:#94a3b8;">${rewardLabel}</label>
            <input type="number" min="0" data-ed-field="reward" class="admin-form-input font-bold" value="${Number(rewardVal)}" style="font-size:0.75rem;padding:4px 6px;color:#fbbf24;">
          </div>
          <div>
            <label style="font-size:0.64rem;color:#c084fc;">📝 Google Req</label>
            <input type="number" min="1" data-ed-field="googleFormRequired" class="admin-form-input font-bold" value="${starGoogleReq}" style="font-size:0.75rem;padding:4px 6px;color:#e9d5ff;">
          </div>
          <div>
            <label style="font-size:0.64rem;color:#94a3b8;">🔑 6-Digit Code</label>
            <div style="display:flex;gap:4px;">
              <input type="text" maxlength="6" data-ed-field="code" class="admin-form-input font-mono font-bold" value="${escapeHtml(codeVal)}" style="font-size:0.75rem;padding:4px 6px;color:#fde047;flex:1;min-width:0;">
              <button type="button" onclick="generateEditorRowCode(this)" title="Randomize Code" class="btn-ctrl-code" style="padding:2px 6px;">🎲</button>
            </div>
          </div>
        </div>`;
    } else if (cat === 'quiz') {
      middleGridHtml = `
        <div style="display:grid;grid-template-columns:0.85fr 1.15fr;gap:6px;margin-bottom:0.4rem;">
          <div>
            <label style="font-size:0.64rem;color:#94a3b8;">Countdown Timer (s)</label>
            <input type="number" min="10" data-ed-field="timer" class="admin-form-input font-mono" value="${timerVal}" style="font-size:0.75rem;padding:4px 6px;">
          </div>
          <div>
            <label style="font-size:0.64rem;color:#94a3b8;">🔑 6-Digit Code</label>
            <div style="display:flex;gap:4px;">
              <input type="text" maxlength="6" data-ed-field="code" class="admin-form-input font-mono font-bold" value="${escapeHtml(codeVal)}" style="font-size:0.75rem;padding:4px 6px;color:#fde047;flex:1;min-width:0;">
              <button type="button" onclick="generateEditorRowCode(this)" title="Randomize Code" class="btn-ctrl-code" style="padding:2px 6px;">🎲</button>
            </div>
          </div>
        </div>`;
    } else {
      middleGridHtml = `
        <div style="display:grid;grid-template-columns:1fr 1.15fr;gap:6px;margin-bottom:0.4rem;">
          <div>
            <label style="font-size:0.64rem;color:#94a3b8;">${rewardLabel}</label>
            <input type="number" min="${(cat === 'diamond' || cat === 'google') ? 1 : 0}" data-ed-field="reward" class="admin-form-input font-bold" value="${Number(rewardVal)}" style="font-size:0.75rem;padding:4px 6px;color:${cat === 'diamond' ? '#22d3ee' : (cat === 'google' ? '#818cf8' : '#fbbf24')};">
          </div>
          <div>
            <label style="font-size:0.64rem;color:#94a3b8;">🔑 6-Digit Code</label>
            <div style="display:flex;gap:4px;">
              <input type="text" maxlength="6" data-ed-field="code" class="admin-form-input font-mono font-bold" value="${escapeHtml(codeVal)}" style="font-size:0.75rem;padding:4px 6px;color:#fde047;flex:1;min-width:0;">
              <button type="button" onclick="generateEditorRowCode(this)" title="Randomize Code" class="btn-ctrl-code" style="padding:2px 6px;">🎲</button>
            </div>
          </div>
        </div>`;
    }

    return `
      <div class="admin-task-editor-row admin-task-card" data-editor-task-id="${escapeHtml(t.id)}" style="border-left: 4px solid ${isActive ? meta.color : '#64748b'} !important;">
        <div class="admin-task-view-top" style="margin-bottom:0.45rem;align-items:center;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;">
            <span style="font-size:0.74rem;font-weight:900;color:${meta.color};background:rgba(56,189,248,0.14);border:1px solid ${meta.border};padding:2px 7px;border-radius:999px;">#${idx + 1}</span>
            <span style="font-size:0.86rem;font-weight:800;color:#ffffff;">${escapeHtml(t.title || 'Webtask')}</span>
            <span class="count-badge" style="background:rgba(250,204,21,0.16);color:#fde047;border:1px solid rgba(250,204,21,0.4);padding:2px 7px;font-size:0.68rem;">${rewardBadge}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <label style="font-size:0.7rem;font-weight:800;color:${isActive ? '#34d399' : '#94a3b8'};display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="checkbox" data-ed-field="active" ${isActive ? 'checked' : ''}> Active 🟢
            </label>
            <button type="button" class="btn-card-action danger" onclick="deleteTaskFromEditor('${escapeHtml(t.id)}')" style="padding:3px 8px;font-size:0.68rem;min-height:26px;">🗑️</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1.25fr;gap:6px;margin-bottom:0.4rem;">
          <div>
            <label style="font-size:0.64rem;color:#94a3b8;">Task Title *</label>
            <input type="text" data-ed-field="title" class="admin-form-input font-bold" value="${escapeHtml(t.title || 'Webtask')}" style="font-size:0.76rem;padding:5px 8px;">
          </div>
          <div>
            <label style="font-size:0.64rem;color:#94a3b8;">Target URL / Link *</label>
            <input type="url" data-ed-field="url" class="admin-form-input font-mono" value="${escapeHtml(t.url || t.link || '')}" style="font-size:0.72rem;padding:5px 8px;color:#7dd3fc;">
          </div>
        </div>
        ${middleGridHtml}
        ${showLevelSel ? `
          <div style="margin-bottom:0.4rem;">
            <label style="font-size:0.64rem;color:#94a3b8;">Level (1-5)</label>
            <select data-ed-field="level" class="admin-form-input" style="font-size:0.72rem;padding:4px 6px;">
              ${[1,2,3,4,5].map(l => `<option value="${l}" ${curLvl === l ? 'selected' : ''}>Level ${l}</option>`).join('')}
            </select>
          </div>
        ` : ''}
        ${cat === 'quiz' ? `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:0.4rem;">
            <div>
              <label style="font-size:0.64rem;color:#94a3b8;">Step 1: Common Target</label>
              <input type="number" min="0" data-ed-field="targetCommonTasks" class="admin-form-input font-bold" value="${quizTargetCommon}" style="font-size:0.74rem;padding:4px 6px;color:#34d399;">
            </div>
            <div>
              <label style="font-size:0.64rem;color:#94a3b8;">Step 2: 💎 Cost</label>
              <input type="number" min="0" data-ed-field="diamondCost" class="admin-form-input font-bold" value="${quizDiamondCost}" style="font-size:0.74rem;padding:4px 6px;color:#22d3ee;">
            </div>
            <div>
              <label style="font-size:0.64rem;color:#94a3b8;">Quiz Start Date &amp; Time</label>
              <input type="datetime-local" data-ed-field="startDateTime" class="admin-form-input font-mono" value="${formatEditorDatetimeLocal(t.startDateTime || t.createdAt)}" style="font-size:0.68rem;padding:4px 6px;">
            </div>
          </div>
        ` : ''}
        ${['simple', 'diamond', 'google'].includes(cat) ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:0.45rem;">
            <div>
              <label style="font-size:0.64rem;color:#94a3b8;">Unlock Currency</label>
              <select data-ed-field="unlockCurrency" class="admin-form-input" style="font-size:0.72rem;padding:4px 6px;">
                <option value="coins" ${costCurr === 'coins' ? 'selected' : ''}>🪙 Coins</option>
                <option value="tickets" ${costCurr === 'tickets' ? 'selected' : ''}>🎟️ Tickets</option>
                <option value="stars" ${costCurr === 'stars' ? 'selected' : ''}>⭐ Stars</option>
                <option value="diamonds" ${costCurr === 'diamonds' ? 'selected' : ''}>💎 Diamonds</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.64rem;color:#94a3b8;">Unlock Cost (0=Free)</label>
              <input type="number" min="0" data-ed-field="unlockCost" class="admin-form-input font-bold" value="${costVal}" style="font-size:0.75rem;padding:4px 6px;">
            </div>
          </div>
        ` : ''}
        <div class="admin-task-actions-bar" style="margin-top:0.35rem;">
          <button type="button" class="btn-card-action btn-task-edit-action" onclick="saveSingleTaskFromEditor('${escapeHtml(t.id)}')" style="font-size:0.74rem;">💾 Save Task ✓</button>
        </div>
      </div>
    `;
  }).join('');
}

function generateEditorRowCode(btnEl) {
  const row = btnEl && btnEl.closest ? btnEl.closest('.admin-task-editor-row') : null;
  const inp = row ? row.querySelector('[data-ed-field="code"]') : null;
  if (inp) inp.value = Math.floor(100000 + Math.random() * 900000).toString();
}

function generatePackSlotCode(btnEl) {
  const slot = btnEl && btnEl.closest ? btnEl.closest('.admin-pro-pack-slot') : null;
  const inp = slot ? slot.querySelector('[data-slot-field="code"]') : null;
  if (inp) inp.value = Math.floor(100000 + Math.random() * 900000).toString();
}

function autoFillEditorRandomCodes() {
  const inputs = document.querySelectorAll('#adminAllTasksEditorList [data-ed-field="code"], #adminAllTasksEditorList [data-slot-field="code"]');
  inputs.forEach((inp) => {
    inp.value = Math.floor(100000 + Math.random() * 900000).toString();
  });
  showToast(`🎲 Generated fresh 6-digit codes for ${inputs.length} task(s)! Click Save All ✓ to apply.`);
}

function toggleAllEditorTasksActive(nextActive) {
  const checks = document.querySelectorAll('#adminAllTasksEditorList [data-ed-field="active"], #adminAllTasksEditorList [data-pack-field="active"]');
  checks.forEach((c) => { c.checked = !!nextActive; });
  showToast(nextActive ? '▶️ All tasks marked Active — click Save All ✓ to apply.' : '⏸️ All tasks marked Paused — click Save All ✓ to apply.');
}

function applyProPackEditorRow(packEl, packKey) {
  if (!packEl) return 0;
  const q = (f) => packEl.querySelector(`[data-pack-field="${f}"]`);
  const groupCostCurrency = q('unlockCurrency')?.value || 'coins';
  const groupCostAmount = Math.max(0, parseInt(q('unlockCost')?.value || '5000', 10) || 0);
  const rewardStars = Math.max(0, parseInt(q('rewardStars')?.value || '1000', 10) || 0);
  const active = q('active') ? !!q('active').checked : true;
  const evStartVal = q('eventStartTime')?.value;
  const evEndVal = q('eventEndTime')?.value;
  const eventStartTime = evStartVal ? new Date(evStartVal).getTime() : Date.now();
  const eventEndTime = evEndVal ? new Date(evEndVal).getTime() : Date.now() + 86400000;
  const timerMinutes = Math.max(1, Math.round((eventEndTime - eventStartTime) / 60000) || 1440);
  const canonicalPackId = String(packKey).startsWith('pack_') ? packKey : `pack_${packKey}`;

  const shared = {
    category: 'pro',
    isEventTask: true,
    eventPackId: canonicalPackId,
    groupId: canonicalPackId,
    groupCostCurrency,
    groupCostAmount,
    unlockCurrency: groupCostCurrency,
    unlockCost: groupCostAmount,
    coinCost: groupCostCurrency === 'coins' ? groupCostAmount : 0,
    ticketCost: groupCostCurrency === 'tickets' ? groupCostAmount : 0,
    starCost: groupCostCurrency === 'stars' ? groupCostAmount : 0,
    diamondCost: groupCostCurrency === 'diamonds' ? groupCostAmount : 0,
    eventStartTime,
    eventEndTime,
    timerMinutes,
    active,
    updatedAt: Date.now()
  };

  const starSplits = [Math.round(rewardStars * 0.25), Math.round(rewardStars * 0.25), Math.max(0, rewardStars - 2 * Math.round(rewardStars * 0.25))];
  const slotEls = packEl.querySelectorAll('.admin-pro-pack-slot');
  let touched = 0;

  slotEls.forEach((slotEl, idx) => {
    const slotId = slotEl.getAttribute('data-slot-task-id');
    const title = (slotEl.querySelector('[data-slot-field="title"]')?.value || '').trim() || `Webtask ${idx + 1}`;
    const url = (slotEl.querySelector('[data-slot-field="url"]')?.value || '').trim() || 'https://google.com/';
    const code = normalizeTaskSecretCode(slotEl.querySelector('[data-slot-field="code"]')?.value);
    const slotRewardStars = starSplits[idx] ?? Math.round(rewardStars / 3);

    const existingIdx = slotId ? tasksData.findIndex(t => String(t.id) === String(slotId)) : -1;
    if (existingIdx !== -1) {
      tasksData[existingIdx] = {
        ...tasksData[existingIdx],
        ...shared,
        title,
        url,
        link: url,
        rewardStars: slotRewardStars,
        secretCode: code,
        verificationCode: code,
        code
      };
    } else {
      tasksData.push({
        ...shared,
        id: `task_pro_${Date.now()}_${idx + 1}`,
        title,
        url,
        link: url,
        rewardStars: slotRewardStars,
        rewardCoins: idx === 2 ? 1000 : 500,
        secretCode: code,
        verificationCode: code,
        code,
        createdAt: Date.now() + idx
      });
    }
    touched++;
  });
  return touched;
}

function saveProPackageFromEditor(packKey) {
  const packEl = document.querySelector(`#adminAllTasksEditorList .admin-pro-pack-editor-row[data-editor-pack-id="${packKey}"]`);
  if (!packEl) return;
  applyProPackEditorRow(packEl, packKey);
  saveTasksAndSync();
  openAdminAllTasksEditorPage('pro');
  showToast('✓ Pro 3-Task Package updated!');
}

function deleteProPackageFromEditor(packKey) {
  if (!confirm('Delete this entire Pro 3-Task Package permanently?')) return;
  tasksData = tasksData.filter(t => String(t.eventPackId || t.groupId || t.id) !== String(packKey));
  saveTasksAndSync();
  openAdminAllTasksEditorPage('pro');
  showToast('🗑️ Pro Package deleted.');
}

function applyEditorRowToTask(rowEl, taskObj, cat) {
  if (!rowEl || !taskObj) return;
  const q = (f) => rowEl.querySelector(`[data-ed-field="${f}"]`);
  const nextTitle = (q('title')?.value || '').trim() || taskObj.title || 'Webtask';
  const nextUrl = (q('url')?.value || '').trim();
  const nextCode = (q('code')?.value || '').trim();
  const rawRew = parseInt(q('reward')?.value ?? '', 10);
  const nextReward = isNaN(rawRew) ? 0 : Math.max(0, rawRew);
  const rawTimer = parseInt(q('timer')?.value ?? '', 10);
  const nextTimer = isNaN(rawTimer) ? 0 : Math.max(0, rawTimer);
  const nextActive = q('active') ? !!q('active').checked : true;

  taskObj.title = nextTitle;
  if (nextUrl) {
    taskObj.url = nextUrl;
    taskObj.link = nextUrl;
  }
  if (/^\d{4,6}$/.test(nextCode)) {
    taskObj.verificationCode = nextCode;
    taskObj.code = nextCode;
    taskObj.secretCode = nextCode;
  }
  taskObj.active = nextActive;
  taskObj.updatedAt = Date.now();

  if (cat === 'common') {
    taskObj.timer = 0;
    taskObj.timerSeconds = 0;
    taskObj.timerDuration = 0;
    taskObj.rewardTickets = nextReward;
    taskObj.ticketReward = nextReward;
  } else if (cat === 'simple') {
    taskObj.timer = 0;
    taskObj.timerSeconds = 0;
    taskObj.timerDuration = 0;
    taskObj.rewardCoins = nextReward;
    taskObj.reward = nextReward;
    taskObj.coins = nextReward;
  } else if (cat === 'premium') {
    const _cfg = (window.TapEmpireUtils && window.TapEmpireUtils.getAppSettings && window.TapEmpireUtils.getAppSettings()) || {};
    const globalGReq = Math.max(1, parseInt((_cfg.starUnlock && _cfg.starUnlock.googleTasksPerUnlock) || '2', 10) || 2);
    const rawGReq = parseInt(q('googleFormRequired')?.value ?? String(globalGReq), 10);
    const nextGReq = isNaN(rawGReq) ? globalGReq : Math.max(1, rawGReq);
    taskObj.rewardStars = nextReward;
    taskObj.googleFormRequired = nextGReq;
    taskObj.requiredGoogleTasks = nextGReq;
    taskObj.customGoogleReq = nextGReq !== globalGReq;
    taskObj.ticketCost = 0;
    taskObj.bonusCoins = 0;
    taskObj.rewardCoins = 0;
    taskObj.reward = 0;
    taskObj.coins = 0;
    taskObj.timer = 0;
    taskObj.timerSeconds = 0;
    taskObj.timerDuration = 0;
  } else if (cat === 'ultra') {
    taskObj.unlockCurrency = 'stars';
    taskObj.unlockCost = 1000;
    taskObj.starCost = 1000;
    taskObj.coinCost = 0;
    taskObj.ticketCost = 0;
    taskObj.diamondCost = 0;
    taskObj.rewardStars = 2000;
    taskObj.rewardCoins = 0;
    taskObj.inrReward = 0;
    taskObj.giftCardType = '';
    taskObj.timer = 0;
    taskObj.timerSeconds = 0;
    taskObj.timerDuration = 0;
    taskObj.ultraDurationSeconds = 86400;
  } else if (cat === 'quiz') {
    const qTimer = Math.max(10, nextTimer || 300);
    const tCommon = Math.max(0, parseInt(q('targetCommonTasks')?.value ?? '5', 10) || 0);
    const dCost = Math.max(0, parseInt(q('diamondCost')?.value ?? '1', 10) || 0);
    taskObj.timer = qTimer;
    taskObj.timerSeconds = qTimer;
    taskObj.timerDuration = qTimer;
    taskObj.countdownSeconds = qTimer;
    taskObj.rewardCoins = 0;
    taskObj.reward = 0;
    taskObj.coins = 0;
    taskObj.targetCommonTasks = tCommon;
    taskObj.commonTarget = tCommon;
    taskObj.unlockCurrency = 'diamonds';
    taskObj.unlockCost = dCost;
    taskObj.diamondCost = dCost;
    taskObj.coinCost = 0;
    taskObj.ticketCost = 0;
    taskObj.starCost = 0;
    const qStart = q('startDateTime')?.value;
    if (qStart) { const ts = new Date(qStart).getTime(); if (!isNaN(ts)) taskObj.startDateTime = ts; }
  } else if (cat === 'diamond' || cat === 'google') {
    const dRew = Math.max(1, nextReward || 1);
    taskObj.timer = 0;
    taskObj.timerSeconds = 0;
    taskObj.timerDuration = 0;
    taskObj.rewardDiamonds = dRew;
    taskObj.diamondReward = dRew;
    taskObj.rewardCoins = 0;
    taskObj.rewardStars = 0;
    taskObj.rewardTickets = 0;
  }

  const lvlEl = q('level');
  if (lvlEl) {
    taskObj.level = Math.max(1, Math.min(5, parseInt(lvlEl.value || '1', 10) || 1));
  }

  if (['simple', 'diamond', 'google'].includes(cat)) {
    const costEl = q('unlockCost');
    const currEl = q('unlockCurrency');
    if (costEl && currEl) {
      const cVal = Math.max(0, parseInt(costEl.value || '0', 10) || 0);
      const cCurr = currEl.value || (cat === 'simple' ? 'tickets' : 'coins');
      taskObj.unlockCost = cVal;
      taskObj.unlockCurrency = cCurr;
      taskObj.ticketCost = cCurr === 'tickets' ? cVal : 0;
      taskObj.coinCost = cCurr === 'coins' ? cVal : 0;
      taskObj.starCost = cCurr === 'stars' ? cVal : 0;
      taskObj.diamondCost = cCurr === 'diamonds' ? cVal : 0;
    }
  }
}

function saveSingleTaskFromEditor(taskId) {
  const cat = currentAdminCategoryTab || 'common';
  const rowEl = document.querySelector(`#adminAllTasksEditorList [data-editor-task-id="${taskId}"]`);
  const taskObj = tasksData.find(t => String(t.id) === String(taskId));
  if (!rowEl || !taskObj) return;
  applyEditorRowToTask(rowEl, taskObj, cat);
  saveTasksAndSync();
  showToast(`✓ Updated "${taskObj.title}"!`);
}

function saveAllTasksFromEditor() {
  const cat = currentAdminCategoryTab || 'common';
  let count = 0;
  if (cat === 'pro') {
    const packs = document.querySelectorAll('#adminAllTasksEditorList .admin-pro-pack-editor-row[data-editor-pack-id]');
    packs.forEach((packEl) => {
      const packKey = packEl.getAttribute('data-editor-pack-id');
      if (packKey) count += applyProPackEditorRow(packEl, packKey);
    });
  } else {
    const rows = document.querySelectorAll('#adminAllTasksEditorList [data-editor-task-id]');
    rows.forEach((rowEl) => {
      const id = rowEl.getAttribute('data-editor-task-id');
      const taskObj = tasksData.find(t => String(t.id) === String(id));
      if (taskObj) {
        applyEditorRowToTask(rowEl, taskObj, cat);
        count++;
      }
    });
  }
  saveTasksAndSync();
  showToast(`💾 Saved ${count} task(s) & synced to Firebase!`);
  closeAdminAllTasksEditorPage();
}

function deleteTaskFromEditor(taskId) {
  if (!confirm('Delete this task permanently?')) return;
  tasksData = tasksData.filter(t => String(t.id) !== String(taskId));
  saveTasksAndSync();
  openAdminAllTasksEditorPage(currentAdminCategoryTab || 'common');
  showToast('🗑️ Task deleted.');
}

function closeAdminAllTasksEditorPage() {
  openAdminTaskCategoryPage(currentAdminCategoryTab || 'common');
}

function handleAllEditTaskClick() {
  openAdminAllTasksEditorPage(currentAdminCategoryTab || 'common');
}
window.openAdminAllTasksEditorPage = openAdminAllTasksEditorPage;
window.closeAdminAllTasksEditorPage = closeAdminAllTasksEditorPage;
window.saveSingleTaskFromEditor = saveSingleTaskFromEditor;
window.saveAllTasksFromEditor = saveAllTasksFromEditor;
window.deleteTaskFromEditor = deleteTaskFromEditor;
window.saveProPackageFromEditor = saveProPackageFromEditor;
window.deleteProPackageFromEditor = deleteProPackageFromEditor;
window.generatePackSlotCode = generatePackSlotCode;
window.handleAllEditTaskClick = handleAllEditTaskClick;
window.generateEditorRowCode = generateEditorRowCode;
window.autoFillEditorRandomCodes = autoFillEditorRandomCodes;
window.toggleAllEditorTasksActive = toggleAllEditorTasksActive;

/**
 * Load an existing task's data into the matching category form for editing
 * @param {string} taskId
 */
function loadTaskIntoSlideUpForm(taskId) {
  const task = tasksData.find(t => t.id === taskId);
  if (!task) return;

  const cat = normalizeAdminTaskCategory(currentAdminCategoryTab || task.category, task);
  const currentCode = normalizeTaskSecretCode(task.verificationCode || task.code || task.secretCode);
  const currentTimer = task.timerDuration ?? task.timerSeconds ?? task.timer;

  const formatLocalDtVal = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  if (cat === 'common') {
    switchPopupCommonMode('single');
    document.getElementById('popupCommonEditId').value = task.id;
    document.getElementById('popupCommonTitle').value = task.title || 'Webtask';
    document.getElementById('popupCommonUrl').value = task.url || task.link || '';
    document.getElementById('popupCommonRewardTickets').value = String(task.rewardTickets ?? task.ticketReward ?? 50);
    document.getElementById('popupCommonCode').value = currentCode;
    document.getElementById('popupCommonActive').checked = (task.active !== false);
    document.getElementById('btnSavePopupCommon').textContent = 'Update Common Task ✓';
  } else if (cat === 'simple') {
    document.getElementById('popupCoinEditId').value = task.id;
    if (document.getElementById('popupCoinLevel')) document.getElementById('popupCoinLevel').value = (task.level || 1).toString();
    document.getElementById('popupCoinTitle').value = task.title || 'Webtask';
    document.getElementById('popupCoinUrl').value = task.url || task.link || '';
    const coinCurr = task.unlockCurrency || (Number(task.coinCost || 0) > 0 ? 'coins' : (Number(task.starCost || 0) > 0 ? 'stars' : 'tickets'));
    const coinAmt = task.unlockCost !== undefined ? task.unlockCost : (coinCurr === 'coins' ? task.coinCost : (coinCurr === 'stars' ? task.starCost : (task.ticketCost !== undefined ? task.ticketCost : 100)));
    if (document.getElementById('popupCoinUnlockCurrency')) document.getElementById('popupCoinUnlockCurrency').value = coinCurr;
    document.getElementById('popupCoinTicketCost').value = String(coinAmt ?? 0);
    document.getElementById('popupCoinRewardCoins').value = String(task.rewardCoins ?? task.reward ?? task.coins ?? 150);
    document.getElementById('popupCoinCode').value = currentCode;
    document.getElementById('popupCoinActive').checked = (task.active !== false);
    document.getElementById('btnSavePopupCoin').textContent = 'Update Coin Task ✓';
  } else if (cat === 'premium') {
    document.getElementById('popupStarEditId').value = task.id;
    document.getElementById('popupStarLevel').value = (task.level || 1).toString();
    document.getElementById('popupStarTitle').value = task.title || 'Webtask';
    document.getElementById('popupStarUrl').value = task.url || task.link || '';
    document.getElementById('popupStarRewardStars').value = String(task.rewardStars ?? 20);
    const s = (window.TapEmpireUtils && window.TapEmpireUtils.getAppSettings && window.TapEmpireUtils.getAppSettings()) || {};
    const defG = Math.max(1, parseInt((s.starUnlock && s.starUnlock.googleTasksPerUnlock) || '2', 10) || 2);
    const gReqVal = (task.customGoogleReq && Number(task.googleFormRequired) >= 1) ? Number(task.googleFormRequired) : defG;
    if (document.getElementById('popupStarGoogleReq')) document.getElementById('popupStarGoogleReq').value = String(gReqVal);
    document.getElementById('popupStarCode').value = currentCode;
    document.getElementById('popupStarActive').checked = (task.active !== false);
    document.getElementById('btnSavePopupStar').textContent = 'Update Star Task ✓';
  } else if (cat === 'pro') {
    document.getElementById('popupProEditId').value = task.id;
    if (document.getElementById('popupProCostCurrency')) document.getElementById('popupProCostCurrency').value = task.groupCostCurrency || task.unlockCurrency || 'coins';
    document.getElementById('popupProPackageCoinCost').value = String(task.groupCostAmount !== undefined ? task.groupCostAmount : (task.coinCost || 5000));
    const packKey = task.eventPackId || task.groupId;
    const packTasks = packKey ? tasksData.filter(t => t.eventPackId === packKey || t.groupId === packKey) : [task];
    const totalPackStars = packTasks.length >= 3
      ? packTasks.reduce((s, pt) => s + Number(pt.rewardStars || 0), 0)
      : Number(task.rewardStars ?? 1000);
    document.getElementById('popupProRewardStars').value = String(totalPackStars || 1000);
    if (document.getElementById('popupProStartTime') && task.eventStartTime) document.getElementById('popupProStartTime').value = formatLocalDtVal(task.eventStartTime);
    if (document.getElementById('popupProEndTime') && task.eventEndTime) document.getElementById('popupProEndTime').value = formatLocalDtVal(task.eventEndTime);

    const t1 = packTasks[0] || task;
    const t2 = packTasks[1] || {};
    const t3 = packTasks[2] || {};

    document.getElementById('popupProTask1Title').value = t1.title || 'Webtask 1';
    document.getElementById('popupProTask1Url').value = t1.url || t1.link || 'https://youtube.com/';
    document.getElementById('popupProTask1Code').value = normalizeTaskSecretCode(t1.verificationCode || t1.code || '583921');

    document.getElementById('popupProTask2Title').value = t2.title || 'Webtask 2';
    document.getElementById('popupProTask2Url').value = t2.url || t2.link || 'https://telegram.org/';
    document.getElementById('popupProTask2Code').value = normalizeTaskSecretCode(t2.verificationCode || t2.code || '749201');

    document.getElementById('popupProTask3Title').value = t3.title || 'Webtask 3';
    document.getElementById('popupProTask3Url').value = t3.url || t3.link || 'https://google.com/';
    document.getElementById('popupProTask3Code').value = normalizeTaskSecretCode(t3.verificationCode || t3.code || '382910');

    document.getElementById('popupProActive').checked = (task.active !== false);
    document.getElementById('btnSavePopupPro').textContent = 'Update Pro Package ✓';
  } else if (cat === 'ultra') {
    document.getElementById('popupUltraEditId').value = task.id;
    document.getElementById('popupUltraTitle').value = task.title || 'Webtask';
    document.getElementById('popupUltraUrl').value = task.url || task.link || '';
    const uCostEl = document.getElementById('popupUltraStarCost');
    const uRewEl = document.getElementById('popupUltraRewardStars');
    if (uCostEl) { uCostEl.value = '1000'; uCostEl.readOnly = true; }
    if (uRewEl) { uRewEl.value = '2000'; uRewEl.readOnly = true; }
    document.getElementById('popupUltraCode').value = currentCode;
    document.getElementById('popupUltraActive').checked = (task.active !== false);
    document.getElementById('btnSavePopupUltra').textContent = 'Update Ultra Task ✓';
  } else if (cat === 'quiz') {
    document.getElementById('popupQuizEditId').value = task.id;
    document.getElementById('popupQuizTitle').value = task.title || 'Quiz Mission';
    document.getElementById('popupQuizUrl').value = task.url || task.link || 'https://google.com/';
    document.getElementById('popupQuizCode').value = currentCode;
    if (document.getElementById('popupQuizStartTime')) {
      document.getElementById('popupQuizStartTime').value = formatLocalDtVal(task.startDateTime || task.createdAt || Date.now());
    }
    if (document.getElementById('popupQuizTargetCommon')) {
      document.getElementById('popupQuizTargetCommon').value = String(task.targetCommonTasks ?? task.commonTarget ?? 5);
    }
    if (document.getElementById('popupQuizDiamondCost')) {
      document.getElementById('popupQuizDiamondCost').value = String(task.diamondCost ?? task.unlockCost ?? 1);
    }
    if (document.getElementById('popupQuizTimer')) {
      document.getElementById('popupQuizTimer').value = String(task.countdownSeconds ?? currentTimer ?? 300);
    }
    document.getElementById('popupQuizActive').checked = (task.active !== false);
    document.getElementById('btnSavePopupQuiz').textContent = 'Update Quiz Task ✓';
  } else if (cat === 'diamond') {
    if (document.getElementById('popupDiamondEditId')) document.getElementById('popupDiamondEditId').value = task.id;
    if (document.getElementById('popupDiamondTitle')) document.getElementById('popupDiamondTitle').value = task.title || 'Webtask';
    if (document.getElementById('popupDiamondUrl')) document.getElementById('popupDiamondUrl').value = task.url || task.link || '';
    if (document.getElementById('popupDiamondReward')) document.getElementById('popupDiamondReward').value = String(Math.max(1, parseInt(task.rewardDiamonds ?? task.diamondReward ?? 1, 10) || 1));
    if (document.getElementById('popupDiamondUnlockCurrency')) document.getElementById('popupDiamondUnlockCurrency').value = task.unlockCurrency || 'coins';
    if (document.getElementById('popupDiamondUnlockCost')) document.getElementById('popupDiamondUnlockCost').value = String(Math.max(0, parseInt(task.unlockCost ?? 0, 10) || 0));
    if (document.getElementById('popupDiamondCode')) document.getElementById('popupDiamondCode').value = currentCode;
    if (document.getElementById('popupDiamondActive')) document.getElementById('popupDiamondActive').checked = (task.active !== false);
    if (document.getElementById('btnSavePopupDiamond')) document.getElementById('btnSavePopupDiamond').textContent = 'Update Diamond Task ✓';
  } else if (cat === 'google') {
    if (document.getElementById('popupGoogleEditId')) document.getElementById('popupGoogleEditId').value = task.id;
    if (document.getElementById('popupGoogleTitle')) document.getElementById('popupGoogleTitle').value = task.title || 'Google Form Survey';
    if (document.getElementById('popupGoogleUrl')) document.getElementById('popupGoogleUrl').value = task.url || task.link || '';
    if (document.getElementById('popupGoogleReward')) document.getElementById('popupGoogleReward').value = String(Math.max(1, parseInt(task.rewardDiamonds ?? task.diamondReward ?? 1, 10) || 1));
    if (document.getElementById('popupGoogleUnlockCurrency')) document.getElementById('popupGoogleUnlockCurrency').value = task.unlockCurrency || 'coins';
    if (document.getElementById('popupGoogleUnlockCost')) document.getElementById('popupGoogleUnlockCost').value = String(Math.max(0, parseInt(task.unlockCost ?? 0, 10) || 0));
    if (document.getElementById('popupGoogleCode')) document.getElementById('popupGoogleCode').value = currentCode;
    if (document.getElementById('popupGoogleActive')) document.getElementById('popupGoogleActive').checked = (task.active !== false);
    if (document.getElementById('btnSavePopupGoogle')) document.getElementById('btnSavePopupGoogle').textContent = 'Update Google Task ✓';
  }

  // Ensure editable cost fields remain editable in Edit Mode (keep Ultra fixed 1000 Star cost readOnly)
  const costInputs = ['popupCoinTicketCost', 'popupProPackageCoinCost', 'popupQuizDiamondCost', 'popupDiamondUnlockCost', 'popupGoogleUnlockCost', 'taskInputTicketCost'];
  costInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.readOnly = false;
      el.style.opacity = '1';
      el.style.cursor = 'text';
      el.title = '';
    }
  });

  // Ensure Target Link and 6-Digit Code are explicitly editable per user instruction
  const linkAndCodeInputs = [
    'popupCommonUrl', 'popupCommonCode',
    'popupCoinUrl', 'popupCoinCode',
    'popupStarUrl', 'popupStarCode',
    'popupProTask1Url', 'popupProTask1Code',
    'popupProTask2Url', 'popupProTask2Code',
    'popupProTask3Url', 'popupProTask3Code',
    'popupUltraUrl', 'popupUltraCode',
    'popupQuizUrl', 'popupQuizCode',
    'popupDiamondUrl', 'popupDiamondCode',
    'popupGoogleUrl', 'popupGoogleCode',
    'taskInputUrl', 'taskInputSecret'
  ];
  linkAndCodeInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.readOnly = false;
      el.style.opacity = '1';
      el.style.cursor = 'text';
    }
  });
}
window.loadTaskIntoSlideUpForm = loadTaskIntoSlideUpForm;

function closeCategoryTaskPopup() {
  if (_slideUpCloseTimer) { clearTimeout(_slideUpCloseTimer); _slideUpCloseTimer = null; }
  const overlay = document.getElementById('adminCategoryTaskModalOverlay');
  if (!overlay) return;
  const card = overlay.querySelector('.admin-slideup-modal-card');
  if (card) {
    card.classList.add('closing');
    _slideUpCloseTimer = setTimeout(() => {
      _slideUpCloseTimer = null;
      if (!card.classList.contains('closing')) return;
      overlay.classList.remove('open');
      overlay.style.display = 'none';
      card.classList.remove('closing');
    }, 200);
  } else {
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  }
}
window.closeCategoryTaskPopup = closeCategoryTaskPopup;

function handleSlideUpModalBackdropClick(e) {
  if (e && e.target && e.target.id === 'adminCategoryTaskModalOverlay') {
    closeCategoryTaskPopup();
  }
}
window.handleSlideUpModalBackdropClick = handleSlideUpModalBackdropClick;

function generatePopupSingleCode(targetInputId) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const input = document.getElementById(targetInputId);
  if (input) input.value = code;
  return code;
}
window.generatePopupSingleCode = generatePopupSingleCode;

// -----------------------------------------------------------------------------
// 5. COMMON TASK POPUP LOGIC (MULTIPLE LINKS BULK ADD ONLY IN COMMON)
// -----------------------------------------------------------------------------

function switchPopupCommonMode(mode) {
  const modeInput = document.getElementById('popupCommonCreationMode');
  if (modeInput) modeInput.value = mode;

  const btnSingle = document.getElementById('btnCommonModeSingle');
  const btnBulk = document.getElementById('btnCommonModeBulk');
  const singleUrl = document.getElementById('groupCommonSingleUrl');
  const bulkUrls = document.getElementById('groupCommonBulkUrls');
  const singleCode = document.getElementById('groupCommonSingleCode');
  const bulkCodes = document.getElementById('groupCommonBulkCodes');
  const bulkSummary = document.getElementById('boxCommonBulkSummary');
  const titleLabel = document.getElementById('lblPopupCommonTitle');
  const inputUrl = document.getElementById('popupCommonUrl');
  const inputCode = document.getElementById('popupCommonCode');

  if (mode === 'bulk') {
    btnSingle?.classList.remove('active');
    btnBulk?.classList.add('active');
    if (singleUrl) singleUrl.style.display = 'none';
    if (bulkUrls) bulkUrls.style.display = 'block';
    if (singleCode) singleCode.style.display = 'none';
    if (bulkCodes) bulkCodes.style.display = 'block';
    if (bulkSummary) bulkSummary.style.display = 'block';
    if (titleLabel) titleLabel.textContent = 'Base Task Title for All Tasks *';
    if (inputUrl) inputUrl.required = false;
    if (inputCode) inputCode.required = false;
    updatePopupCommonBulkCounter();
  } else {
    btnSingle?.classList.add('active');
    btnBulk?.classList.remove('active');
    if (singleUrl) singleUrl.style.display = 'block';
    if (bulkUrls) bulkUrls.style.display = 'none';
    if (singleCode) singleCode.style.display = 'block';
    if (bulkCodes) bulkCodes.style.display = 'none';
    if (bulkSummary) bulkSummary.style.display = 'none';
    if (titleLabel) titleLabel.textContent = 'Task Title *';
    if (inputUrl) inputUrl.required = true;
    const saveBtn = document.getElementById('btnSavePopupCommon');
    if (saveBtn) saveBtn.textContent = 'Save Common Task ✓';
  }
}
window.switchPopupCommonMode = switchPopupCommonMode;

function updatePopupCommonBulkCounter() {
  const rawUrls = document.getElementById('popupCommonBulkUrls')?.value || '';
  const urls = rawUrls.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const rawCodes = document.getElementById('popupCommonBulkCodes')?.value || '';
  const codes = rawCodes.split(/\r?\n/).map(c => c.trim()).filter(c => c.length > 0);

  const badgeUrls = document.getElementById('badgeCommonBulkUrls');
  if (badgeUrls) badgeUrls.textContent = `${urls.length} Link${urls.length === 1 ? '' : 's'}`;

  const badgeCodes = document.getElementById('badgeCommonBulkCodes');
  if (badgeCodes) badgeCodes.textContent = `${codes.length} Code${codes.length === 1 ? '' : 's'}`;

  const summary = document.getElementById('textCommonBulkSummary');
  if (summary) {
    summary.textContent = urls.length > 0
      ? `Ready to create ${urls.length} Common missions with ${codes.length} verification codes (Win: 50 Tickets).`
      : 'Paste links above (one per line) to batch create Common Tasks.';
  }

  const saveBtn = document.getElementById('btnSavePopupCommon');
  if (saveBtn && document.getElementById('popupCommonCreationMode')?.value === 'bulk') {
    saveBtn.textContent = urls.length > 1 ? `Save ${urls.length} Common Tasks ✓` : 'Save Common Task ✓';
  }
}
window.updatePopupCommonBulkCounter = updatePopupCommonBulkCounter;

function autoGeneratePopupCommonBulkCodes() {
  const rawUrls = document.getElementById('popupCommonBulkUrls')?.value || '';
  const urls = rawUrls.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (urls.length === 0) {
    showToast('Please paste target URLs first so codes match each link!');
    return;
  }
  const codes = urls.map(() => Math.floor(100000 + Math.random() * 900000).toString());
  const box = document.getElementById('popupCommonBulkCodes');
  if (box) box.value = codes.join('\n');
  updatePopupCommonBulkCounter();
  showToast(`🎲 Generated ${codes.length} matching 6-digit codes!`);
}
window.autoGeneratePopupCommonBulkCodes = autoGeneratePopupCommonBulkCodes;

function handleSavePopupCommonTask(e) {
  e.preventDefault();
  const editId = document.getElementById('popupCommonEditId')?.value;
  const mode = document.getElementById('popupCommonCreationMode')?.value || 'single';
  const title = document.getElementById('popupCommonTitle')?.value.trim() || 'Webtask';
  const rawRewTk = parseInt(document.getElementById('popupCommonRewardTickets')?.value ?? '50', 10);
  const rewardTickets = isNaN(rawRewTk) ? 50 : Math.max(0, rawRewTk);
  const timer = 0;
  const active = document.getElementById('popupCommonActive')?.checked !== false;

  // 1. Edit existing
  if (editId) {
    const url = (document.getElementById('popupCommonUrl')?.value || '').trim() || 'https://google.com/';
    const secretCode = normalizeTaskSecretCode(document.getElementById('popupCommonCode')?.value);
    const idx = tasksData.findIndex(t => t.id === editId);
    if (idx !== -1) {
      tasksData[idx] = {
        ...tasksData[idx],
        title,
        url,
        link: url,
        category: 'common',
        rewardTickets,
        ticketReward: rewardTickets,
        rewardCoins: 0,
        unlockCost: 0,
        unlockCurrency: 'coins',
        ticketCost: 0,
        timer,
        timerSeconds: timer,
        timerDuration: timer,
        secretCode,
        verificationCode: secretCode,
        code: secretCode,
        active,
        updatedAt: Date.now()
      };
    }
    saveTasksAndSync();
    closeCategoryTaskPopup();
    showToast(`Common Task updated! Verification Code: ${secretCode} ✓`);
    return;
  }

  // 2. Bulk creation
  if (mode === 'bulk') {
    const rawUrls = document.getElementById('popupCommonBulkUrls')?.value || '';
    const urls = rawUrls.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (urls.length === 0) {
      showToast('Please paste at least one target link.');
      return;
    }
    const rawCodes = document.getElementById('popupCommonBulkCodes')?.value || '';
    const codes = rawCodes.split(/\r?\n/).map(c => c.trim()).filter(c => c.length > 0);
    const now = Date.now();

    for (let i = 0; i < urls.length; i++) {
      let url = urls[i];
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      const code = normalizeTaskSecretCode(codes[i]);
      tasksData.push({
        id: `task_common_${now}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        title,
        url,
        link: url,
        category: 'common',
        rewardTickets,
        ticketReward: rewardTickets,
        rewardCoins: 0,
        unlockCost: 0,
        unlockCurrency: 'coins',
        ticketCost: 0,
        timer,
        timerSeconds: timer,
        timerDuration: timer,
        secretCode: code,
        verificationCode: code,
        code,
        active,
        createdAt: now + i,
        updatedAt: now
      });
    }
    saveTasksAndSync();
    closeCategoryTaskPopup();
    showToast(`🎉 ${urls.length} Common Tasks created in bulk! ✓`);
    return;
  }

  // 3. Single creation
  const url = (document.getElementById('popupCommonUrl')?.value || '').trim() || 'https://google.com/';
  const secretCode = normalizeTaskSecretCode(document.getElementById('popupCommonCode')?.value);

  tasksData.push({
    id: `task_common_${Date.now()}`,
    title,
    url,
    link: url,
    category: 'common',
    rewardTickets,
    ticketReward: rewardTickets,
    rewardCoins: 0,
    unlockCost: 0,
    unlockCurrency: 'coins',
    ticketCost: 0,
    timer,
    timerSeconds: timer,
    timerDuration: timer,
    secretCode,
    verificationCode: secretCode,
    code: secretCode,
    active,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  saveTasksAndSync();
  closeCategoryTaskPopup();
  showToast(`New Common Task published! Code: ${secretCode} 📋`);
}
window.handleSavePopupCommonTask = handleSavePopupCommonTask;

// -----------------------------------------------------------------------------
// 6. COIN TASK POPUP LOGIC (OPEN COST: 100 TICKETS, WINNING: 150 COINS)
// -----------------------------------------------------------------------------

function handleSavePopupCoinTask(e) {
  e.preventDefault();
  const editId = document.getElementById('popupCoinEditId')?.value;
  const taskLevel = parseInt(document.getElementById('popupCoinLevel')?.value || '1', 10) || 1;
  const title = document.getElementById('popupCoinTitle')?.value.trim() || 'Webtask';
  const url = (document.getElementById('popupCoinUrl')?.value || '').trim() || 'https://google.com/';
  const unlockCurrency = document.getElementById('popupCoinUnlockCurrency')?.value || 'tickets';
  const unlockCost = Math.max(0, parseInt(document.getElementById('popupCoinTicketCost')?.value || '0', 10) || 0);
  const ticketCost = unlockCurrency === 'tickets' ? unlockCost : 0;
  const coinCost = unlockCurrency === 'coins' ? unlockCost : 0;
  const starCost = unlockCurrency === 'stars' ? unlockCost : 0;
  const diamondCost = unlockCurrency === 'diamonds' ? unlockCost : 0;
  const rawRewCoins = parseInt(document.getElementById('popupCoinRewardCoins')?.value ?? '150', 10);
  const rewardCoins = isNaN(rawRewCoins) ? 150 : Math.max(0, rawRewCoins);
  const timer = 0;
  const secretCode = normalizeTaskSecretCode(document.getElementById('popupCoinCode')?.value);
  const active = document.getElementById('popupCoinActive')?.checked !== false;

  const basePayload = {
    title,
    url,
    link: url,
    category: 'simple',
    level: taskLevel,
    unlockCurrency,
    unlockCost,
    ticketCost,
    coinCost,
    starCost,
    diamondCost,
    rewardCoins,
    reward: rewardCoins,
    coins: rewardCoins,
    timer,
    timerSeconds: timer,
    timerDuration: timer,
    secretCode,
    verificationCode: secretCode,
    code: secretCode,
    active,
    updatedAt: Date.now()
  };

  if (editId) {
    const idx = tasksData.findIndex(t => t.id === editId);
    if (idx !== -1) {
      tasksData[idx] = { ...tasksData[idx], ...basePayload };
    }
    saveTasksAndSync();
    closeCategoryTaskPopup();
    showToast(`Coin Task updated! Cost: ${unlockCost} ${unlockCurrency}, Code: ${secretCode} 🪙`);
    return;
  }

  tasksData.push({
    id: `task_coin_${Date.now()}`,
    ...basePayload,
    createdAt: Date.now()
  });

  saveTasksAndSync();
  closeCategoryTaskPopup();
  showToast(`New Coin Task published! (Cost: ${unlockCost} ${unlockCurrency}, Win: ${rewardCoins} 🪙, Code: ${secretCode}) ✓`);
}
window.handleSavePopupCoinTask = handleSavePopupCoinTask;

// -----------------------------------------------------------------------------
// 7. STAR TASK POPUP LOGIC (GOOGLE FORM UNLOCK RULE, WINNING: 20 STARS DEFAULT)
// -----------------------------------------------------------------------------

function handleSavePopupStarTask(e) {
  e.preventDefault();
  const editId = document.getElementById('popupStarEditId')?.value;
  const taskLevel = parseInt(document.getElementById('popupStarLevel')?.value || '1', 10) || 1;
  const title = document.getElementById('popupStarTitle')?.value.trim() || 'Webtask';
  const url = (document.getElementById('popupStarUrl')?.value || '').trim() || 'https://google.com/';
  const rawRewStars = parseInt(document.getElementById('popupStarRewardStars')?.value ?? '20', 10);
  const rewardStars = isNaN(rawRewStars) ? 20 : Math.max(0, rawRewStars);
  const s = (window.TapEmpireUtils && window.TapEmpireUtils.getAppSettings && window.TapEmpireUtils.getAppSettings()) || {};
  const globalGReq = Math.max(1, parseInt((s.starUnlock && s.starUnlock.googleTasksPerUnlock) || '2', 10) || 2);
  const rawGReq = parseInt(document.getElementById('popupStarGoogleReq')?.value ?? String(globalGReq), 10);
  const googleFormRequired = isNaN(rawGReq) ? globalGReq : Math.max(1, rawGReq);
  const customGoogleReq = googleFormRequired !== globalGReq;
  const secretCode = normalizeTaskSecretCode(document.getElementById('popupStarCode')?.value);
  const active = document.getElementById('popupStarActive')?.checked !== false;

  const starPayload = {
    title,
    url,
    link: url,
    category: 'premium',
    isShopTask: true,
    level: taskLevel,
    ticketCost: 0,
    googleFormRequired,
    requiredGoogleTasks: googleFormRequired,
    customGoogleReq,
    rewardStars,
    rewardCoins: 0,
    bonusCoins: 0,
    reward: 0,
    coins: 0,
    timer: 0,
    timerSeconds: 0,
    timerDuration: 0,
    secretCode,
    verificationCode: secretCode,
    code: secretCode,
    active,
    updatedAt: Date.now()
  };

  if (editId) {
    const idx = tasksData.findIndex(t => t.id === editId);
    if (idx !== -1) {
      tasksData[idx] = { ...tasksData[idx], ...starPayload };
    }
    saveTasksAndSync();
    closeCategoryTaskPopup();
    showToast(`Star Task updated! Code: ${secretCode} ⭐`);
    return;
  }

  tasksData.push({
    id: `task_star_${Date.now()}`,
    ...starPayload,
    createdAt: Date.now()
  });

  saveTasksAndSync();
  closeCategoryTaskPopup();
  showToast(`New Star Task published! (Win: ${rewardStars} ⭐, Unlock: ${googleFormRequired} 📝) ✓`);
}
window.handleSavePopupStarTask = handleSavePopupStarTask;

// -----------------------------------------------------------------------------
// 8. PRO TASK POPUP LOGIC (3-TASK PACKAGE: COST 5000 COINS, WINNING 1000 STARS)
// -----------------------------------------------------------------------------

function setProEventDurationHours(hours) {
  const now = new Date();
  const end = new Date(Date.now() + hours * 3600 * 1000);

  const startInput = document.getElementById('popupProStartTime');
  const endInput = document.getElementById('popupProEndTime');
  if (startInput) startInput.value = now.toISOString().slice(0, 16);
  if (endInput) endInput.value = end.toISOString().slice(0, 16);

  updateProEventStatusPreview();
}
window.setProEventDurationHours = setProEventDurationHours;

function updateProEventStatusPreview() {
  const startVal = document.getElementById('popupProStartTime')?.value;
  const endVal = document.getElementById('popupProEndTime')?.value;
  const badge = document.getElementById('popupProTimerPreviewBadge');
  const hubTimer = document.getElementById('hubProEventTimerPreview');
  if (!badge) return;

  const now = Date.now();
  const startTime = startVal ? new Date(startVal).getTime() : now;
  const endTime = endVal ? new Date(endVal).getTime() : now + (24 * 3600 * 1000);

  if (startTime > now) {
    const diffHours = Math.ceil((startTime - now) / 3600000);
    badge.textContent = `⏱️ Upcoming in ${diffHours}h`;
    badge.style.color = '#fbbf24';
    if (hubTimer) hubTimer.textContent = `⏱️ Upcoming (${diffHours}h)`;
  } else if (endTime > now) {
    const diffHours = Math.ceil((endTime - now) / 3600000);
    badge.textContent = `⏱️ Active: Ends in ${diffHours}h`;
    badge.style.color = '#34d399';
    if (hubTimer) hubTimer.textContent = `⏱️ Ends in ${diffHours}h`;
  } else {
    badge.textContent = '⏱️ Event Ended';
    badge.style.color = '#ef4444';
    if (hubTimer) hubTimer.textContent = '⏱️ Ended';
  }
}
window.updateProEventStatusPreview = updateProEventStatusPreview;

function handleSavePopupProPackage(e) {
  e.preventDefault();
  const groupCostCurrency = document.getElementById('popupProCostCurrency')?.value || 'coins';
  const groupCostAmount = Math.max(0, parseInt(document.getElementById('popupProPackageCoinCost')?.value || '5000', 10) || 0);
  const rewardStars = Math.max(0, parseInt(document.getElementById('popupProRewardStars')?.value || '1000', 10) || 0);
  const active = document.getElementById('popupProActive')?.checked !== false;

  const startVal = document.getElementById('popupProStartTime')?.value;
  const endVal = document.getElementById('popupProEndTime')?.value;
  const eventStartTime = startVal ? new Date(startVal).getTime() : Date.now();
  const eventEndTime = endVal ? new Date(endVal).getTime() : Date.now() + (24 * 3600 * 1000);
  const timerMinutes = Math.max(1, Math.round((eventEndTime - eventStartTime) / 60000) || 1440);

  const t1Title = document.getElementById('popupProTask1Title')?.value.trim() || 'Webtask 1';
  const t1Url = document.getElementById('popupProTask1Url')?.value.trim() || 'https://youtube.com/';
  const t1Code = document.getElementById('popupProTask1Code')?.value.trim() || '583921';

  const t2Title = document.getElementById('popupProTask2Title')?.value.trim() || 'Webtask 2';
  const t2Url = document.getElementById('popupProTask2Url')?.value.trim() || 'https://telegram.org/';
  const t2Code = document.getElementById('popupProTask2Code')?.value.trim() || '749201';

  const t3Title = document.getElementById('popupProTask3Title')?.value.trim() || 'Webtask 3';
  const t3Url = document.getElementById('popupProTask3Url')?.value.trim() || 'https://google.com/';
  const t3Code = document.getElementById('popupProTask3Code')?.value.trim() || '382910';

  const sharedFields = {
    category: 'pro',
    groupCostCurrency,
    groupCostAmount,
    unlockCurrency: groupCostCurrency,
    unlockCost: groupCostAmount,
    coinCost: groupCostCurrency === 'coins' ? groupCostAmount : 0,
    ticketCost: groupCostCurrency === 'tickets' ? groupCostAmount : 0,
    starCost: groupCostCurrency === 'stars' ? groupCostAmount : 0,
    diamondCost: groupCostCurrency === 'diamonds' ? groupCostAmount : 0,
    eventStartTime,
    eventEndTime,
    timerMinutes,
    active,
    updatedAt: Date.now()
  };

  const editId = document.getElementById('popupProEditId')?.value;
  if (editId) {
    const existing = tasksData.find(t => t.id === editId);
    const existingPackId = existing?.eventPackId || existing?.groupId || (`pack_${Date.now()}`);
    const packIndices = (existing?.eventPackId || existing?.groupId)
      ? tasksData.map((t, i) => ((t.eventPackId === existingPackId || t.groupId === existingPackId) ? i : -1)).filter(i => i !== -1)
      : [tasksData.findIndex(t => t.id === editId)].filter(i => i !== -1);

    const star1 = Math.round(rewardStars * 0.25);
    const star2 = Math.round(rewardStars * 0.25);
    const star3 = Math.max(0, rewardStars - star1 - star2);
    const defs = [
      { title: t1Title, url: t1Url, code: t1Code, rewardStars: star1, rewardCoins: 500 },
      { title: t2Title, url: t2Url, code: t2Code, rewardStars: star2, rewardCoins: 500 },
      { title: t3Title, url: t3Url, code: t3Code, rewardStars: star3, rewardCoins: 1000 }
    ];
    defs.forEach((d, idx) => {
      if (idx < packIndices.length) {
        const i = packIndices[idx];
        tasksData[i] = { ...tasksData[i], ...sharedFields, isEventTask: true, eventPackId: existingPackId, groupId: existingPackId, title: d.title, url: d.url, link: d.url, rewardStars: d.rewardStars, secretCode: d.code, verificationCode: d.code, code: d.code };
      } else {
        tasksData.push({ ...sharedFields, id: `task_pro_${Date.now()}_${idx + 1}`, title: d.title, url: d.url, link: d.url, isEventTask: true, eventPackId: existingPackId, groupId: existingPackId, rewardStars: d.rewardStars, rewardCoins: d.rewardCoins, secretCode: d.code, verificationCode: d.code, code: d.code, createdAt: Date.now() + idx });
      }
    });
    saveTasksAndSync();
    if (window.TapEmpireUtils && typeof window.TapEmpireUtils.saveAppSettingsToCloud === 'function') {
      window.TapEmpireUtils.saveAppSettingsToCloud({ proGroup: { costAmount: groupCostAmount, costCurrency: groupCostCurrency, timerMinutes, active } }).catch(() => {});
    }
    closeCategoryTaskPopup();
    showToast(`🏆 Pro 3-Task Package updated! Cost: ${groupCostAmount.toLocaleString()} ${groupCostCurrency} ✓`);
    return;
  }

  const packId = 'pack_' + Date.now();
  const sub1 = { ...sharedFields, id: `task_pro_${Date.now()}_1`, title: t1Title, url: t1Url, link: t1Url, isEventTask: true, eventPackId: packId, groupId: packId, rewardStars: Math.round(rewardStars * 0.25), rewardCoins: 500, secretCode: t1Code, verificationCode: t1Code, code: t1Code, createdAt: Date.now() };
  const sub2 = { ...sharedFields, id: `task_pro_${Date.now()}_2`, title: t2Title, url: t2Url, link: t2Url, isEventTask: true, eventPackId: packId, groupId: packId, rewardStars: Math.round(rewardStars * 0.25), rewardCoins: 500, secretCode: t2Code, verificationCode: t2Code, code: t2Code, createdAt: Date.now() + 1 };
  const sub3 = { ...sharedFields, id: `task_pro_${Date.now()}_3`, title: t3Title, url: t3Url, link: t3Url, isEventTask: true, eventPackId: packId, groupId: packId, rewardStars: Math.round(rewardStars * 0.5), rewardCoins: 1000, secretCode: t3Code, verificationCode: t3Code, code: t3Code, createdAt: Date.now() + 2 };

  tasksData.unshift(sub1, sub2, sub3);
  saveTasksAndSync();
  if (window.TapEmpireUtils && typeof window.TapEmpireUtils.saveAppSettingsToCloud === 'function') {
    window.TapEmpireUtils.saveAppSettingsToCloud({ proGroup: { costAmount: groupCostAmount, costCurrency: groupCostCurrency, timerMinutes, active } }).catch(() => {});
  }
  closeCategoryTaskPopup();
  showToast(`🏆 Pro 3-Task Group published! Cost: ${groupCostAmount.toLocaleString()} ${groupCostCurrency} ✓`);
}
window.handleSavePopupProPackage = handleSavePopupProPackage;

// -----------------------------------------------------------------------------
// 9. ULTRA TASK POPUP LOGIC (FIXED 1,000 STAR UNLOCK • 2,000 STAR REWARD • 24H)
// -----------------------------------------------------------------------------

function handleUltraPriceCalc() {}
window.handleUltraPriceCalc = handleUltraPriceCalc;

function handleSavePopupUltraTask(e) {
  e.preventDefault();
  const editId = document.getElementById('popupUltraEditId')?.value;
  const title = document.getElementById('popupUltraTitle')?.value.trim() || 'Webtask';
  const url = (document.getElementById('popupUltraUrl')?.value || '').trim() || 'https://google.com/';
  const secretCode = normalizeTaskSecretCode(document.getElementById('popupUltraCode')?.value);
  const active = document.getElementById('popupUltraActive')?.checked !== false;

  const ultraPayload = {
    title,
    url,
    link: url,
    category: 'ultra',
    unlockCurrency: 'stars',
    unlockCost: 1000,
    starCost: 1000,
    coinCost: 0,
    ticketCost: 0,
    diamondCost: 0,
    inrReward: 0,
    giftCardType: '',
    rewardCoins: 0,
    rewardStars: 2000,
    timer: 0,
    timerSeconds: 0,
    timerDuration: 0,
    ultraDurationSeconds: 86400,
    secretCode,
    verificationCode: secretCode,
    code: secretCode,
    active,
    updatedAt: Date.now()
  };

  if (editId) {
    const idx = tasksData.findIndex(t => t.id === editId);
    if (idx !== -1) {
      tasksData[idx] = { ...tasksData[idx], ...ultraPayload };
    }
    saveTasksAndSync();
    closeCategoryTaskPopup();
    showToast(`Ultra Task updated! Unlock: 1,000 ⭐ → +2,000 ⭐ (24h), Code: ${secretCode} ⚡`);
    return;
  }

  tasksData.push({
    id: `task_ultra_${Date.now()}`,
    ...ultraPayload,
    createdAt: Date.now()
  });

  saveTasksAndSync();
  closeCategoryTaskPopup();
  showToast(`New Ultra Task published! (1,000 ⭐ → +2,000 ⭐, 24h on unlock, Code: ${secretCode}) ⚡`);
}
window.handleSavePopupUltraTask = handleSavePopupUltraTask;

// -----------------------------------------------------------------------------
// 9b. QUIZ TASK POPUP LOGIC (NO REWARD • STEP 1 COMMON TARGET • STEP 2 DIAMOND)
// -----------------------------------------------------------------------------

function handleSavePopupQuizTask(e) {
  e.preventDefault();
  const editId = document.getElementById('popupQuizEditId')?.value;
  const title = document.getElementById('popupQuizTitle')?.value.trim() || 'Quiz Mission';
  const url = (document.getElementById('popupQuizUrl')?.value || '').trim() || 'https://google.com/';
  const secretCode = normalizeTaskSecretCode(document.getElementById('popupQuizCode')?.value);
  const startRaw = document.getElementById('popupQuizStartTime')?.value || '';
  const startMs = startRaw ? new Date(startRaw).getTime() : Date.now();
  const targetCommonTasks = Math.max(0, parseInt(document.getElementById('popupQuizTargetCommon')?.value ?? '5', 10) || 0);
  const diamondCost = Math.max(0, parseInt(document.getElementById('popupQuizDiamondCost')?.value ?? '1', 10) || 0);
  const timerSec = Math.max(10, parseInt(document.getElementById('popupQuizTimer')?.value || '300', 10) || 300);
  const active = document.getElementById('popupQuizActive')?.checked !== false;

  const quizPayload = {
    title,
    url,
    link: url,
    category: 'quiz',
    startDateTime: startMs,
    rewardCoins: 0,
    reward: 0,
    coins: 0,
    rewardStars: 0,
    rewardTickets: 0,
    targetCommonTasks,
    commonTarget: targetCommonTasks,
    unlockCurrency: 'diamonds',
    unlockCost: diamondCost,
    diamondCost,
    coinCost: 0,
    ticketCost: 0,
    starCost: 0,
    timer: timerSec,
    timerSeconds: timerSec,
    timerDuration: timerSec,
    countdownSeconds: timerSec,
    secretCode,
    verificationCode: secretCode,
    code: secretCode,
    active,
    updatedAt: Date.now()
  };

  if (editId) {
    const idx = tasksData.findIndex(t => t.id === editId);
    if (idx !== -1) {
      tasksData[idx] = { ...tasksData[idx], ...quizPayload };
    }
    saveTasksAndSync();
    closeCategoryTaskPopup();
    showToast(`🧠 Quiz Task updated! Target: ${targetCommonTasks} Common • Cost: 💎 ${diamondCost}`);
    return;
  }

  tasksData.push({
    id: `task_quiz_${Date.now()}`,
    ...quizPayload,
    createdAt: Date.now()
  });

  saveTasksAndSync();
  closeCategoryTaskPopup();
  showToast(`🎉 New Quiz Task published! (No Reward • Target: ${targetCommonTasks} Common • 💎 ${diamondCost}) 🧠`);
}
window.handleSavePopupQuizTask = handleSavePopupQuizTask;

// -----------------------------------------------------------------------------
// 9c. DIAMOND TASK POPUP LOGIC (EDITABLE 💎 REWARD, COST, TIMER & CODE)
// -----------------------------------------------------------------------------

function handleSavePopupDiamondTask(e) {
  e.preventDefault();
  const editId = document.getElementById('popupDiamondEditId')?.value;
  const title = document.getElementById('popupDiamondTitle')?.value.trim() || 'Webtask';
  const url = (document.getElementById('popupDiamondUrl')?.value || '').trim() || 'https://google.com/';
  const rewardDiamonds = Math.max(1, parseInt(document.getElementById('popupDiamondReward')?.value || '1', 10) || 1);
  const unlockCurrency = document.getElementById('popupDiamondUnlockCurrency')?.value || 'coins';
  const unlockCost = Math.max(0, parseInt(document.getElementById('popupDiamondUnlockCost')?.value || '0', 10) || 0);
  const timer = 0;
  const secretCode = normalizeTaskSecretCode(document.getElementById('popupDiamondCode')?.value);
  const active = document.getElementById('popupDiamondActive')?.checked !== false;

  const diamondPayload = {
    title,
    url,
    link: url,
    category: 'diamond',
    unlockCost,
    unlockCurrency,
    coinCost: unlockCurrency === 'coins' ? unlockCost : 0,
    ticketCost: unlockCurrency === 'tickets' ? unlockCost : 0,
    starCost: unlockCurrency === 'stars' ? unlockCost : 0,
    diamondCost: unlockCurrency === 'diamonds' ? unlockCost : 0,
    rewardDiamonds,
    diamondReward: rewardDiamonds,
    rewardCoins: 0,
    rewardStars: 0,
    rewardTickets: 0,
    timer,
    timerSeconds: timer,
    timerDuration: timer,
    secretCode,
    verificationCode: secretCode,
    code: secretCode,
    active,
    updatedAt: Date.now()
  };

  if (editId) {
    const idx = tasksData.findIndex(t => t.id === editId);
    if (idx !== -1) {
      tasksData[idx] = { ...tasksData[idx], ...diamondPayload };
    }
    saveTasksAndSync();
    closeCategoryTaskPopup();
    showToast(`💎 Diamond Task updated! +${rewardDiamonds} 💎 • Cost: ${unlockCost} • Code: ${secretCode}`);
    return;
  }

  tasksData.push({
    id: `task_diamond_${Date.now()}`,
    ...diamondPayload,
    createdAt: Date.now()
  });

  saveTasksAndSync();
  closeCategoryTaskPopup();
  showToast(`💎 New Diamond Task published! (+${rewardDiamonds} 💎 • ${unlockCost > 0 ? `Cost: ${unlockCost}` : 'Free'} • Code: ${secretCode})`);
}
window.handleSavePopupDiamondTask = handleSavePopupDiamondTask;

// -----------------------------------------------------------------------------
// 9d. GOOGLE FORM TASK POPUP LOGIC (FORM URL, TIMER, END CODE, 💎 REWARD)
// -----------------------------------------------------------------------------

function handleSavePopupGoogleTask(e) {
  e.preventDefault();
  const editId = document.getElementById('popupGoogleEditId')?.value;
  const title = document.getElementById('popupGoogleTitle')?.value.trim() || 'Google Form Survey';
  const url = (document.getElementById('popupGoogleUrl')?.value || '').trim() || 'https://docs.google.com/forms/';
  const rewardDiamonds = Math.max(1, parseInt(document.getElementById('popupGoogleReward')?.value || '1', 10) || 1);
  const unlockCurrency = document.getElementById('popupGoogleUnlockCurrency')?.value || 'coins';
  const unlockCost = Math.max(0, parseInt(document.getElementById('popupGoogleUnlockCost')?.value || '0', 10) || 0);
  const timer = 0;
  const secretCode = normalizeTaskSecretCode(document.getElementById('popupGoogleCode')?.value);
  const active = document.getElementById('popupGoogleActive')?.checked !== false;

  const googlePayload = {
    title,
    url,
    link: url,
    category: 'google',
    unlockCost,
    unlockCurrency,
    coinCost: unlockCurrency === 'coins' ? unlockCost : 0,
    ticketCost: unlockCurrency === 'tickets' ? unlockCost : 0,
    starCost: unlockCurrency === 'stars' ? unlockCost : 0,
    diamondCost: unlockCurrency === 'diamonds' ? unlockCost : 0,
    rewardDiamonds,
    diamondReward: rewardDiamonds,
    rewardCoins: 0,
    rewardStars: 0,
    rewardTickets: 0,
    timer,
    timerSeconds: timer,
    timerDuration: timer,
    secretCode,
    verificationCode: secretCode,
    code: secretCode,
    active,
    updatedAt: Date.now()
  };

  if (editId) {
    const idx = tasksData.findIndex(t => t.id === editId);
    if (idx !== -1) {
      tasksData[idx] = { ...tasksData[idx], ...googlePayload };
    }
    saveTasksAndSync();
    closeCategoryTaskPopup();
    showToast(`📝 Google Form Task updated! +${rewardDiamonds} 💎 • Code: ${secretCode}`);
    return;
  }

  tasksData.push({
    id: `task_google_${Date.now()}`,
    ...googlePayload,
    createdAt: Date.now()
  });

  saveTasksAndSync();
  closeCategoryTaskPopup();
  showToast(`📝 New Google Form Task published! (+${rewardDiamonds} 💎 • ${unlockCost > 0 ? `Cost: ${unlockCost}` : 'Free'} • Code: ${secretCode})`);
}
window.handleSavePopupGoogleTask = handleSavePopupGoogleTask;

// -----------------------------------------------------------------------------
// 10. EDITING & RENDERING TASKS LIST
// -----------------------------------------------------------------------------

function openEditTaskModal(taskId) {
  const task = tasksData.find(t => t.id === taskId);
  if (!task) return;

  const cat = normalizeAdminTaskCategory(task.category, task);
  currentAdminCategoryTab = cat;
  openAdminTaskCategoryPage(cat);
  openEditCategoryTaskPopup(taskId);
}
window.openEditTaskModal = openEditTaskModal;

function openCreateTaskModal() {
  openAddCategoryTaskPopup();
}
window.openCreateTaskModal = openCreateTaskModal;

function renderAdminTasksList() {
  const container = document.getElementById('adminTasksList');
  if (!container) return;

  const searchVal = (document.getElementById('adminTaskSearch')?.value || '').toLowerCase().trim();
  let list = filterTasksForAdminCat(currentAdminCategoryTab);

  // Filter by level if selected (Star/Coin only)
  if (currentAdminLevelFilter !== 'all' && !['common', 'pro', 'ultra', 'quiz', 'diamond', 'google'].includes(currentAdminCategoryTab)) {
    list = list.filter(t => Number(t.level || 1) === currentAdminLevelFilter);
  }

  // Search filter
  if (searchVal) {
    list = list.filter(t => t.title && t.title.toLowerCase().includes(searchVal));
  }

  updateAdminCounters();
  renderAdminCatProgressBanner(currentAdminCategoryTab || 'common', list);

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: #94a3b8; font-size: 0.85rem; background: #0a1738; border-radius: 14px; border: 1px dashed rgba(56, 189, 248, 0.25);">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📋</div>
        <div style="font-weight: 800; color: #ffffff; margin-bottom: 0.25rem;">${searchVal ? 'No tasks match search' : 'No Tasks in this Category Yet'}</div>
        <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.75rem;">Click "＋ Add Task" above to publish tasks immediately.</div>
        <button class="btn-card-action" onclick="openAddCategoryTaskPopup()">＋ Add Task Now</button>
      </div>
    `;
    return;
  }

  const currIconMap = { coins: '🪙', tickets: '🎟️', stars: '⭐', diamonds: '💎' };

  if (currentAdminCategoryTab === 'pro') {
    const packMap = new Map();
    list.forEach(t => {
      const k = t.eventPackId || t.groupId || t.id;
      if (!packMap.has(k)) packMap.set(k, []);
      packMap.get(k).push(t);
    });
    container.innerHTML = Array.from(packMap.entries()).map(([packKey, packTasks], packIdx) => {
      const lead = packTasks[0] || {};
      const isActive = packTasks.some(t => t.active !== false);
      const totalStars = packTasks.length >= 3
        ? packTasks.reduce((s, t) => s + Number(t.rewardStars || 0), 0)
        : Number(lead.rewardStars || 1000);
      const pCost = lead.groupCostAmount !== undefined ? Number(lead.groupCostAmount) : Number(lead.unlockCost !== undefined ? lead.unlockCost : (lead.coinCost || 5000));
      const pCurr = lead.groupCostCurrency || lead.unlockCurrency || 'coins';
      const costLabel = `${pCost.toLocaleString()} ${currIconMap[pCurr] || '🪙'}`;
      const subRows = packTasks.map((st, idx) => {
        const stCode = normalizeTaskSecretCode(st.verificationCode || st.code || st.secretCode);
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 8px;background:rgba(15,23,42,0.55);border:1px solid rgba(52,211,153,0.18);border-radius:8px;margin-top:4px;font-size:0.72rem;">
            <span style="color:#ffffff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${idx + 1}. ${escapeHtml(st.title || `Webtask ${idx + 1}`)}</span>
            <span class="font-mono" style="color:#7dd3fc;font-size:0.65rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${escapeHtml(st.url || st.link || '')}</span>
            <span class="font-mono" style="color:#facc15;font-weight:800;white-space:nowrap;">🔑 ${escapeHtml(stCode)}</span>
          </div>`;
      }).join('');
      return `
        <div class="admin-task-card ${isCategoryQuickEditActive ? 'quick-edit-highlight' : ''}" style="border-left: 4px solid ${isActive ? '#34d399' : '#64748b'} !important;">
          <div class="admin-task-view-top" style="align-items: center;">
            <div style="display: flex; align-items: center; gap: 7px; flex-wrap: wrap; min-width: 0; flex: 1;">
              <h4 class="admin-task-view-title" style="margin: 0;">💎 Pro Package #${packIdx + 1} (${packTasks.length} Tasks)</h4>
              <span style="color: #fbbf24; font-weight: 900; font-size: 0.72rem; background: rgba(250, 204, 21, 0.14); border: 1px solid rgba(250, 204, 21, 0.35); padding: 2px 8px; border-radius: 999px; white-space: nowrap;">+${totalStars.toLocaleString()} ⭐</span>
              <span class="count-badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; font-size: 0.66rem; padding: 2px 7px;">Cost: ${costLabel}</span>
            </div>
            <span style="font-size: 0.65rem; font-weight: 800; padding: 3px 8px; border-radius: 999px; white-space: nowrap; background: ${isActive ? 'rgba(52, 211, 153, 0.16)' : 'rgba(148, 163, 184, 0.15)'}; border: 1px solid ${isActive ? 'rgba(52, 211, 153, 0.4)' : 'rgba(148, 163, 184, 0.3)'}; color: ${isActive ? '#34d399' : '#94a3b8'};">
              ${isActive ? 'Active 🟢' : 'Paused ⚪'}
            </span>
          </div>
          ${subRows}
          <div class="admin-task-actions-bar" style="margin-top:0.5rem;">
            <button type="button" class="btn-card-action btn-task-edit-action" onclick="openEditTaskModal('${lead.id}')" title="Edit this 3-task package">✏️ Edit Package</button>
            <button type="button" class="btn-card-action" onclick="toggleProPackageActive('${escapeHtml(packKey)}')" title="Toggle package status">${isActive ? '⏸️ Pause' : '▶️ Play'}</button>
            <button type="button" class="btn-card-action danger" onclick="deleteProPackage('${escapeHtml(packKey)}')" title="Delete package">🗑️ Delete</button>
          </div>
        </div>`;
    }).join('');
    return;
  }

  container.innerHTML = list.map(task => {
    const isActive = task.active !== false;
    const taskCode = task.verificationCode || task.code || task.secretCode || '';

    let catBadge = '📋 Common Task';
    let borderColor = '#38bdf8';
    let rewardLabel = `+${task.rewardTickets || 50} 🎟️`;
    let costLabel = '';
    const showLevel = !['common', 'pro', 'elite', 'ultra', 'quiz', 'diamond', 'google'].includes(task.category);

    if (task.category === 'quiz') {
      catBadge = '🧠 Quiz Task';
      borderColor = '#10b981';
      rewardLabel = '🧠 No Reward • Pass +1';
      const tCom = Math.max(0, parseInt(task.targetCommonTasks ?? task.commonTarget ?? 5, 10) || 0);
      const dCst = Math.max(0, parseInt(task.diamondCost ?? task.unlockCost ?? 1, 10) || 0);
      costLabel = `Step 1: ${tCom} Common • Step 2: 💎 ${dCst}`;
    } else if (task.category === 'ultra') {
      catBadge = '⚡ Ultra Task';
      borderColor = '#d946ef';
      rewardLabel = '⚡ +2,000 ⭐ • ⏱️ 24h';
      costLabel = 'Unlock: 1,000 ⭐';
    } else if (task.category === 'diamond') {
      catBadge = '💎 Diamond Task';
      borderColor = '#22d3ee';
      const dRew = Math.max(1, parseInt(task.rewardDiamonds ?? task.diamondReward ?? '1', 10) || 1);
      const dCost = Math.max(0, parseInt(task.unlockCost ?? '0', 10) || 0);
      rewardLabel = `💎 +${dRew} Diamond${dRew > 1 ? 's' : ''}`;
      costLabel = dCost > 0 ? `Cost: ${dCost} ${currIconMap[task.unlockCurrency || 'coins'] || '🪙'}` : 'Free Entry';
    } else if (['google', 'google_form', 'google-form', 'googleform', 'form'].includes(String(task.category || '').toLowerCase())) {
      catBadge = '📝 Google Form';
      borderColor = '#818cf8';
      const gRew = Math.max(1, parseInt(task.rewardDiamonds ?? task.diamondReward ?? '1', 10) || 1);
      const gCost = Math.max(0, parseInt(task.unlockCost ?? '0', 10) || 0);
      rewardLabel = `💎 +${gRew} Diamond${gRew > 1 ? 's' : ''}`;
      costLabel = gCost > 0 ? `Cost: ${gCost} ${currIconMap[task.unlockCurrency || 'coins'] || '🪙'}` : 'Free Entry';
    } else if (task.category === 'pro' || task.category === 'elite') {
      catBadge = '💎 Pro Task';
      borderColor = '#34d399';
      rewardLabel = `+${task.rewardStars || 1000} ⭐`;
      const pCost = task.groupCostAmount !== undefined ? Number(task.groupCostAmount) : Number(task.coinCost || 5000);
      costLabel = `Group: ${pCost} ${currIconMap[task.groupCostCurrency || task.unlockCurrency || 'coins'] || '🪙'}`;
    } else if (task.category === 'premium' || task.category === 'star' || task.isShopTask || task.category === 'shop_task') {
      catBadge = '⭐ Star Task';
      borderColor = '#a855f7';
      rewardLabel = `+${task.rewardStars || 20} ⭐`;
      const _cfgS = (window.TapEmpireUtils && window.TapEmpireUtils.getAppSettings && window.TapEmpireUtils.getAppSettings()) || {};
      const _gDef = Math.max(1, parseInt((_cfgS.starUnlock && _cfgS.starUnlock.googleTasksPerUnlock) || '2', 10) || 2);
      const sReq = (task.customGoogleReq && Number(task.googleFormRequired) >= 1) ? Number(task.googleFormRequired) : _gDef;
      costLabel = `Unlock: 📝 ${sReq} Google`;
    } else if (task.category === 'simple' || task.category === 'coin') {
      catBadge = '🪙 Coin Task';
      borderColor = '#fbbf24';
      rewardLabel = `+${task.rewardCoins || 150} 🪙`;
      const cCost = task.unlockCost !== undefined ? Number(task.unlockCost) : Number(task.ticketCost !== undefined ? task.ticketCost : 100);
      costLabel = `Cost: ${cCost} ${currIconMap[task.unlockCurrency || 'tickets'] || '🎟️'}`;
    }

    return `
      <div class="admin-task-card ${isCategoryQuickEditActive ? 'quick-edit-highlight' : ''}" style="border-left: 4px solid ${isActive ? borderColor : '#64748b'} !important;">
        <div class="admin-task-view-top" style="align-items: center;">
          <div style="display: flex; align-items: center; gap: 7px; flex-wrap: wrap; min-width: 0; flex: 1;">
            <h4 class="admin-task-view-title" style="margin: 0;">${escapeHtml(task.title || 'Webtask')}</h4>
            <span style="color: #fbbf24; font-weight: 900; font-size: 0.72rem; background: rgba(250, 204, 21, 0.14); border: 1px solid rgba(250, 204, 21, 0.35); padding: 2px 8px; border-radius: 999px; white-space: nowrap;">${rewardLabel}</span>
          </div>
          <span style="font-size: 0.65rem; font-weight: 800; padding: 3px 8px; border-radius: 999px; white-space: nowrap; background: ${isActive ? 'rgba(52, 211, 153, 0.16)' : 'rgba(148, 163, 184, 0.15)'}; border: 1px solid ${isActive ? 'rgba(52, 211, 153, 0.4)' : 'rgba(148, 163, 184, 0.3)'}; color: ${isActive ? '#34d399' : '#94a3b8'};">
            ${isActive ? 'Active 🟢' : 'Paused ⚪'}
          </span>
        </div>

        <div class="admin-task-view-footer" style="margin-top: 0.45rem; padding-top: 0.45rem; gap: 0.45rem;">
          <div class="admin-task-meta-pills">
            <span class="admin-task-view-url font-mono">${escapeHtml(task.url || task.link || 'No URL')}</span>
            <span class="font-mono" style="color: #38bdf8; font-size: 0.72rem; font-weight: 800; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); padding: 2px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
              <span>🔑</span> <b style="color: #facc15; letter-spacing: 0.06em;">${escapeHtml(taskCode || '000000')}</b>
            </span>
            ${costLabel ? `<span class="count-badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; font-size: 0.66rem; padding: 2px 7px;">${costLabel}</span>` : ''}
            ${showLevel ? `<span class="count-badge" style="background: rgba(250, 204, 21, 0.15); color: #facc15; font-size: 0.66rem; padding: 2px 7px;">⭐ Lvl ${task.level || 1}</span>` : ''}
          </div>

          <div class="admin-task-actions-bar">
            <button type="button" class="btn-card-action btn-task-edit-action" onclick="openEditTaskModal('${task.id}')" title="Edit this task">✏️ Edit</button>
            <button type="button" class="btn-card-action" onclick="toggleTaskActive('${task.id}')" title="Toggle active status">${isActive ? '⏸️ Pause' : '▶️ Play'}</button>
            <button type="button" class="btn-card-action danger" onclick="deleteAdminTask('${task.id}')" title="Delete Mission">🗑️ Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
window.renderAdminTasksList = renderAdminTasksList;

function handleAdminTaskSearch(val) {
  renderAdminTasksList();
}
window.handleAdminTaskSearch = handleAdminTaskSearch;

// Legacy modal helpers maintained for test backward compatibility
function closeAdminTaskModal() {
  closeCategoryTaskPopup();
}
window.closeAdminTaskModal = closeAdminTaskModal;

function handleTaskModalBackdropClick(e) {
  closeCategoryTaskPopup();
}
window.handleTaskModalBackdropClick = handleTaskModalBackdropClick;

function generateRandomTaskCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
window.generateRandomTaskCode = generateRandomTaskCode;

function switchAdminTaskMode(mode) {
  switchPopupCommonMode(mode);
}
window.switchAdminTaskMode = switchAdminTaskMode;

function updateBulkTaskCounter() {
  updatePopupCommonBulkCounter();
}
window.updateBulkTaskCounter = updateBulkTaskCounter;

function generateRandomSingleCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
window.generateRandomSingleCode = generateRandomSingleCode;

function autoGenerateAllBulkCodes() {
  autoGeneratePopupCommonBulkCodes();
}
window.autoGenerateAllBulkCodes = autoGenerateAllBulkCodes;

function handleAdminTaskCategoryChange(val) {
  openAdminTaskCategoryPage(val);
}
window.handleAdminTaskCategoryChange = handleAdminTaskCategoryChange;

function handleSaveAdminTaskForm(e) {
  e.preventDefault();
  handleSavePopupCommonTask(e);
}
window.handleSaveAdminTaskForm = handleSaveAdminTaskForm;

function toggleTaskActive(taskId) {
  const task = tasksData.find(t => t.id === taskId);
  if (!task) return;
  task.active = (task.active === false);
  saveTasksAndSync();
  showToast(`Mission ${task.active ? 'activated' : 'paused'}.`);
}

function toggleProPackageActive(packKey) {
  const packTasks = tasksData.filter(t => String(t.eventPackId || t.groupId || t.id) === String(packKey));
  if (packTasks.length === 0) return;
  const anyActive = packTasks.some(t => t.active !== false);
  const nextActive = !anyActive;
  packTasks.forEach(t => { t.active = nextActive; t.updatedAt = Date.now(); });
  saveTasksAndSync();
  showToast(`Pro 3-Task Package ${nextActive ? 'activated' : 'paused'}.`);
}
window.toggleProPackageActive = toggleProPackageActive;

function deleteProPackage(packKey) {
  if (!confirm('Are you sure you want to delete this entire Pro 3-Task Package?')) return;
  tasksData = tasksData.filter(t => String(t.eventPackId || t.groupId || t.id) !== String(packKey));
  saveTasksAndSync();
  showToast('Pro Package deleted.');
}
window.deleteProPackage = deleteProPackage;

function deleteAdminTask(taskId) {
  if (!confirm('Are you sure you want to delete this mission?')) return;
  tasksData = tasksData.filter(t => t.id !== taskId);
  saveTasksAndSync();
  showToast('Mission deleted.');
}

function resetPlayerCooldowns() {
  localStorage.removeItem(CLAIMS_STORAGE_KEY);
  localStorage.setItem(SYNC_FLAG_KEY, Date.now().toString());
  if (syncChannel) {
    syncChannel.postMessage({ type: 'CLAIMS_UPDATED', timestamp: Date.now() });
  }
  showToast('🔄 All player mission cooldowns reset! ✓');
}

// Zero demo tasks: always empty until Admin creates real tasks
const CANONICAL_BASIC_DEFAULT_TASKS = [];

function restoreAndRenewAllTasks() {
  if (!confirm("Are you sure you want to restore all basic missions and renew all tasks for all players?\n\nThis will reset all completion records so that both completed and non-completed tasks are refreshed back to active and visible in the app!")) {
    return;
  }

  // 1. Reset all completed task tracking across all storage keys
  localStorage.setItem('task_game_completed_tasks', '{}');
  localStorage.setItem('task_completed_tasks', '{}');
  localStorage.removeItem(CLAIMS_STORAGE_KEY);
  localStorage.removeItem('task_game_claims');
  localStorage.setItem('completed_tasks_count', '0');
  localStorage.setItem('task_game_total_tasks_completed', '0');
  localStorage.setItem('task_pass_total_completed', '0');

  // Reset all balances (coins, stars, tickets) to 0
  localStorage.setItem('task_game_coins', '0');
  localStorage.setItem('user_coins', '0');
  localStorage.setItem('task_game_stars', '0');
  localStorage.setItem('user_stars', '0');
  localStorage.setItem('task_user_tickets', '0');
  localStorage.setItem('user_tickets', '0');
  localStorage.setItem('task_game_tickets', '0');
  if (typeof updateAllDomBalances === 'function') {
    updateAllDomBalances(0, 0, 0);
  }

  // Clear any temporary task open/claim state
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('task_opened_') || k.startsWith('task_claimed_'))) {
      localStorage.removeItem(k);
    }
  }

  // 2. Renew player claims without injecting any demo tasks
  tasksData = [];
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasksData));
  localStorage.setItem('admin_tasks', JSON.stringify(tasksData));

  // 3. Set sync flags
  localStorage.setItem(SYNC_FLAG_KEY, Date.now().toString());
  localStorage.setItem('task_restore_flag', Date.now().toString());

  // 4. Broadcast to other open windows / tabs
  if (syncChannel) {
    syncChannel.postMessage({ type: 'TASKS_RESTORED', timestamp: Date.now() });
    syncChannel.postMessage({ type: 'TASKS_UPDATED', timestamp: Date.now() });
    syncChannel.postMessage({ type: 'CLAIMS_UPDATED', timestamp: Date.now() });
    syncChannel.postMessage({ type: 'BALANCES_UPDATED', coins: 0, stars: 0, tickets: 0, timestamp: Date.now() });
  }
  try {
    const bc = new BroadcastChannel('nova_task_sync');
    bc.postMessage({ type: 'TASKS_RESTORED', timestamp: Date.now() });
    bc.postMessage({ type: 'TASKS_UPDATED', timestamp: Date.now() });
    bc.postMessage({ type: 'BALANCES_UPDATED', coins: 0, stars: 0, tickets: 0, timestamp: Date.now() });
    bc.close();
  } catch(e) {}

  // 5. Cloud sync if Firebase is present
  if (window.Firebase && typeof window.Firebase.saveTasksToCloud === 'function') {
    window.Firebase.saveTasksToCloud(tasksData);
  }

  // 6. Refresh admin UI
  renderAdminTasksList();
  showToast('🔄 All missions restored to basic state and renewed for all players! ✓');
}
window.restoreAndRenewAllTasks = restoreAndRenewAllTasks;

function refreshOpenAdminTaskViewsLive() {
  updateAdminCounters();
  renderAdminTasksList();

  const editorView = document.getElementById('adminAllTasksEditorPageView');
  const isEditorOpen = editorView && editorView.style.display !== 'none' && !editorView.classList.contains('admin-subview-hidden');
  if (isEditorOpen) {
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const isTypingInEditor = !!(activeEl && typeof activeEl.closest === 'function' && activeEl.closest('#adminAllTasksEditorList'));
    if (!isTypingInEditor) {
      openAdminAllTasksEditorPage(currentAdminCategoryTab || 'common');
    }
  }

  // If slide-up popup is currently editing a task that was deleted in Firebase, close popup cleanly
  const modalOverlay = document.getElementById('adminCategoryTaskModalOverlay');
  if (modalOverlay && modalOverlay.style.display !== 'none') {
    const editIds = ['popupCommonEditId', 'popupCoinEditId', 'popupStarEditId', 'popupProEditId', 'popupUltraEditId', 'popupQuizEditId', 'popupDiamondEditId', 'popupGoogleEditId'];
    for (const eid of editIds) {
      const inp = document.getElementById(eid);
      const val = inp ? String(inp.value || '').trim() : '';
      if (val && !tasksData.some(t => t && String(t.id) === val)) {
        closeCategoryTaskPopup();
        showToast('🗑️ Task was deleted in Firebase — popup closed.');
        break;
      }
    }
  }
}
window.refreshOpenAdminTaskViewsLive = refreshOpenAdminTaskViewsLive;
window.renderAdminTasks = () => {
  loadAllAdminData();
  refreshOpenAdminTaskViewsLive();
};

function saveTasksAndSync() {
  const json = JSON.stringify(tasksData);
  const now = Date.now();
  localStorage.setItem(TASKS_STORAGE_KEY, json);
  localStorage.setItem('admin_tasks', json);
  localStorage.setItem('task_game_tasks_updated_at', String(now));
  localStorage.setItem(SYNC_FLAG_KEY, String(now));
  if (syncChannel) {
    try { syncChannel.postMessage({ type: 'TASKS_UPDATED', tasks: tasksData, timestamp: now }); } catch (e) {}
  }
  try {
    window.dispatchEvent(new CustomEvent('tasks:changed', { detail: tasksData }));
  } catch (e) {}
  if (window.Firebase && typeof window.Firebase.saveTasksToCloud === 'function') {
    window.Firebase.saveTasksToCloud(tasksData);
  }
  renderAdminTasksList();
  const editorView = document.getElementById('adminAllTasksEditorPageView');
  if (editorView && editorView.style.display !== 'none' && !editorView.classList.contains('admin-subview-hidden')) {
    openAdminAllTasksEditorPage(currentAdminCategoryTab || 'common');
  }
}

// -----------------------------------------------------------------------------
// 2. ALL USERS SUBVIEW LOGIC (OPTIMIZED & PAGINATED FOR 10,000+ PLAYERS)
// -----------------------------------------------------------------------------
const ADMIN_USERS_PAGE_SIZE = 50;
let adminUsersCurrentPage = 1;
let adminUsersStatusFilter = 'all';
let _adminUserSearchDebounce = null;

function setAdminUsersPage(pageNum) {
  adminUsersCurrentPage = Math.max(1, parseInt(pageNum || '1', 10) || 1);
  renderAdminUsersList();
  const listEl = document.getElementById('adminUsersList');
  if (listEl && typeof listEl.scrollIntoView === 'function') {
    try { listEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
  }
}
window.setAdminUsersPage = setAdminUsersPage;

function setAdminUsersFilter(filterKey, btnEl) {
  adminUsersStatusFilter = filterKey || 'all';
  adminUsersCurrentPage = 1;
  document.querySelectorAll('#adminUsersFilterPills .filter-pill').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderAdminUsersList();
}
window.setAdminUsersFilter = setAdminUsersFilter;

function renderAdminUsersList() {
  const container = document.getElementById('adminUsersList');
  const pagBar = document.getElementById('adminUsersPaginationBar');
  if (!container) return;

  const searchVal = (document.getElementById('adminUserSearch')?.value || '').toLowerCase().trim();
  let activeCount = 0;
  let coinsSum = 0;
  const filtered = [];

  for (let i = 0; i < usersData.length; i++) {
    const u = usersData[i];
    if (!u) continue;
    const isSusp = u.status === 'suspended';
    if (!isSusp && u.status !== 'inactive') activeCount++;
    coinsSum += Number(u.coins || 0) || 0;

    if (adminUsersStatusFilter === 'active' && (isSusp || u.status === 'inactive')) continue;
    if (adminUsersStatusFilter === 'suspended' && !isSusp) continue;

    if (searchVal) {
      const hit = (u.name && u.name.toLowerCase().includes(searchVal)) ||
        (u.id && String(u.id).toLowerCase().includes(searchVal)) ||
        (u.username && u.username.toLowerCase().includes(searchVal)) ||
        (u.email && u.email.toLowerCase().includes(searchVal));
      if (!hit) continue;
    }
    filtered.push(u);
  }

  if (adminUsersStatusFilter === 'top_coins') {
    filtered.sort((a, b) => (Number(b.coins || 0) - Number(a.coins || 0)));
  }

  const totUsers = document.getElementById('adminTotalUsers');
  const actUsers = document.getElementById('adminActiveUsers');
  const totCoins = document.getElementById('adminTotalCoins');

  if (totUsers) totUsers.textContent = usersData.length.toLocaleString();
  if (actUsers) actUsers.textContent = activeCount.toLocaleString();
  if (totCoins) totCoins.textContent = `${coinsSum.toLocaleString()} 🪙`;

  updateAdminCounters();

  const totalMatches = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / ADMIN_USERS_PAGE_SIZE));
  if (adminUsersCurrentPage > totalPages) adminUsersCurrentPage = totalPages;
  if (adminUsersCurrentPage < 1) adminUsersCurrentPage = 1;

  if (totalMatches === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 2rem; color: #94a3b8; font-size: 0.85rem;">No players found${searchVal ? ` matching "${escapeHtml(searchVal)}"` : ''}.</div>`;
    if (pagBar) pagBar.innerHTML = '';
    return;
  }

  const startIdx = (adminUsersCurrentPage - 1) * ADMIN_USERS_PAGE_SIZE;
  const pageSlice = filtered.slice(startIdx, startIdx + ADMIN_USERS_PAGE_SIZE);

  container.innerHTML = pageSlice.map(user => {
    const isSusp = user.status === 'suspended';
    return `
      <div class="admin-user-card" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; flex-wrap: wrap; background: #0a1738; border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 0.5rem; gap: 0.55rem; width: 100%; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 0.55rem; min-width: 170px; flex: 1;">
          <span style="display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${getAdminUserAvatarImgHtml(user.avatar, 36)}</span>
          <div style="display: flex; flex-direction: column; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
              <span style="font-size: 0.9rem; font-weight: 800; color: #ffffff;">${escapeHtml(user.name || 'Player')}</span>
              ${user.id === 'usr_1' ? '<span style="font-size: 0.62rem; background: #0284c7; color: #fff; font-weight: 800; padding: 1px 4px; border-radius: 4px;">YOU</span>' : ''}
              ${isSusp ? '<span style="font-size: 0.62rem; background: #ef4444; color: #fff; font-weight: 800; padding: 1px 4px; border-radius: 4px;">SUSPENDED</span>' : ''}
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 0.72rem; margin-top: 2px;">
              <span style="color: #38bdf8; font-weight: 800;">🎯 ${Number(user.eventTasks || 0)} Tasks</span>
              <span style="color: #64748b;">•</span>
              <span style="color: #fbbf24; font-weight: 800;">🪙 ${Number(user.coins || 0).toLocaleString()}</span>
              <span style="color: #64748b;">•</span>
              <span style="color: #facc15; font-weight: 800;">⭐ ${Number(user.stars || 0).toLocaleString()}</span>
              <span style="color: #64748b;">•</span>
              <span style="color: #c084fc; font-weight: 800;">🎟️ ${Number(user.tickets || 0).toLocaleString()}</span>
              ${user.diamonds ? `<span style="color: #64748b;">•</span><span style="color: #38bdf8; font-weight: 800;">💎 ${Number(user.diamonds).toLocaleString()}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="admin-user-actions" style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn-card-action" onclick="openEditUserModal('${escapeHtml(user.id)}')" title="Edit player name, tasks, balances" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.74rem; font-weight: 800; background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.5); color: #38bdf8; border-radius: 8px; cursor: pointer;">
            <span>✏️ Edit</span>
          </button>
          <button type="button" class="btn-card-action" onclick="directResetUser('${escapeHtml(user.id)}')" title="Reset all account data to zero" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.74rem; font-weight: 800; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; border-radius: 8px; cursor: pointer;">
            <span>🔄 Reset</span>
          </button>
          <button type="button" class="btn-card-action" onclick="directDeleteUser('${escapeHtml(user.id)}')" title="Permanently delete player" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.74rem; font-weight: 800; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 8px; cursor: pointer;">
            <span>🗑️ Delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (pagBar) {
    const endIdx = Math.min(totalMatches, startIdx + pageSlice.length);
    pagBar.innerHTML = `
      <div class="admin-users-pagination">
        <span>Showing ${startIdx + 1}–${endIdx} of ${totalMatches.toLocaleString()}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <button type="button" class="admin-page-btn" onclick="setAdminUsersPage(${adminUsersCurrentPage - 1})" ${adminUsersCurrentPage <= 1 ? 'disabled' : ''}>◀ Prev</button>
          <span style="color:#ffffff;">Page ${adminUsersCurrentPage} / ${totalPages}</span>
          <button type="button" class="admin-page-btn" onclick="setAdminUsersPage(${adminUsersCurrentPage + 1})" ${adminUsersCurrentPage >= totalPages ? 'disabled' : ''}>Next ▶</button>
        </div>
      </div>
    `;
  }
}

function toggleUserActiveStatus(userId) {
  const user = usersData.find(u => u.id === userId);
  if (!user) return;
  const isCurrentlyActive = user.status === 'active' || (!user.status || (user.status !== 'inactive' && user.status !== 'suspended'));
  user.status = isCurrentlyActive ? 'inactive' : 'active';

  // Save status to Firebase Cloud
  const cloudSaver = (window.Firebase && window.Firebase.saveUserToCloud) || window.saveUserToCloud;
  if (typeof cloudSaver === 'function') {
    cloudSaver({
      id: user.id,
      uid: user.id,
      displayName: user.name,
      status: user.status
    }).catch(() => {});
  }

  // Save and broadcast
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersData));
  if (syncChannel) {
    syncChannel.postMessage({ type: 'USERS_UPDATED', timestamp: Date.now() });
  }
  renderAdminUsersList();
  showToast(`Player ${user.name || 'User'} marked ${user.status === 'active' ? '🟢 Active' : '🔴 Inactive'}`);
}


function handleAdminUserSearch(val) {
  if (_adminUserSearchDebounce) clearTimeout(_adminUserSearchDebounce);
  _adminUserSearchDebounce = setTimeout(() => {
    adminUsersCurrentPage = 1;
    _lastAdminUsersSig = '';
    renderAdminUsersList();
  }, 90);
}

function resolveAdminAvatarFile(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/avatar-([1-8])\.png/i);
  if (m) return `avatar-${m[1]}.png`;
  const map = { '⚡':'avatar-1.png','👤':'avatar-7.png','👑':'avatar-2.png','💎':'avatar-6.png','🚀':'avatar-7.png','🦊':'avatar-3.png','🦁':'avatar-4.png','🎯':'avatar-8.png','🤖':'avatar-5.png','💻':'avatar-5.png','🐯':'avatar-8.png','🔥':'avatar-8.png','⭐':'avatar-2.png','🎮':'avatar-5.png' };
  return map[s] || 'avatar-1.png';
}

function getAdminUserAvatarImgHtml(raw, sizePx = 36) {
  const file = resolveAdminAvatarFile(raw);
  const px = Number(sizePx) || 36;
  return `<img src="../frontend/assets/avatars/${file}" alt="Avatar" class="sticker-3d-avatar-img" style="width:${px}px;height:${px}px;object-fit:contain;display:block;background:transparent;border:none;border-radius:0;box-shadow:none;" />`;
}

function setEditUserAvatar(avVal) {
  const file = resolveAdminAvatarFile(avVal);
  const input = document.getElementById('userEditAvatarInput');
  const preview = document.getElementById('userEditAvatar');
  if (input) input.value = file;
  if (preview) preview.innerHTML = getAdminUserAvatarImgHtml(file, 46);
  document.querySelectorAll('#userEditAvatarPickerRow .avatar-3d-option').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-avatar') === file);
  });
}

function isCurrentSessionUser(userId, userObj) {
  const currentUid = localStorage.getItem('player_uid');
  const currentName = (localStorage.getItem('player_username') || '').trim();
  const targetName = (userObj && (userObj.name || userObj.displayName) || '').trim();
  return userId === 'usr_1' || (currentUid && userId === currentUid) || (currentName && targetName && currentName.toLowerCase() === targetName.toLowerCase());
}

function openEditUserModal(userId) {
  const user = usersData.find(u => u.id === userId);
  if (!user) return;

  // Merge real-time active balances if editing the active local/cloud session user
  let liveCoins = Number(user.coins || 0);
  let liveStars = Number(user.stars || 0);
  let liveTickets = Number(user.tickets || 0);
  let liveDiamonds = Number(user.diamonds || 0);
  let livePassLevel = Number(user.passLevel || 0);
  let liveEventTasks = Number(user.eventTasks || 0);
  let liveTotalTasks = Number(user.totalTasks || 0);

  if (isCurrentSessionUser(user.id, user)) {
    liveCoins = parseInt(localStorage.getItem('task_game_coins') || String(liveCoins), 10) || liveCoins;
    liveStars = parseInt(localStorage.getItem('task_game_stars') || String(liveStars), 10) || liveStars;
    liveTickets = parseInt(localStorage.getItem('task_user_tickets') || localStorage.getItem('user_tickets') || String(liveTickets), 10) || liveTickets;
    liveDiamonds = parseInt(localStorage.getItem('task_user_diamonds') || localStorage.getItem('user_diamonds') || String(liveDiamonds), 10) || liveDiamonds;
    livePassLevel = parseInt(localStorage.getItem('task_pass_level') || String(livePassLevel), 10) || livePassLevel;
    liveEventTasks = parseInt(localStorage.getItem('task_game_event_tasks_count') || String(liveEventTasks), 10) || liveEventTasks;
    liveTotalTasks = parseInt(localStorage.getItem('completed_tasks_count') || localStorage.getItem('task_game_total_tasks_completed') || String(liveTotalTasks), 10) || liveTotalTasks;
  }

  const modal = document.getElementById('adminUserModalOverlay');
  if (document.getElementById('userEditId')) document.getElementById('userEditId').value = user.id;
  setEditUserAvatar(user.avatar || 'avatar-1.png');
  if (document.getElementById('userEditNameDisplay')) document.getElementById('userEditNameDisplay').textContent = user.name || 'Player';
  if (document.getElementById('userEditNameInput')) document.getElementById('userEditNameInput').value = user.name || 'Player';
  if (document.getElementById('userEditHandleInput')) document.getElementById('userEditHandleInput').value = user.username || ('@' + (user.name || 'player').toLowerCase().replace(/\s+/g, ''));
  if (document.getElementById('userEditEmailInput')) document.getElementById('userEditEmailInput').value = user.email || (user.id + '@novatasks.io');
  if (document.getElementById('userEditRoleSelect')) document.getElementById('userEditRoleSelect').value = user.role || 'player';
  if (document.getElementById('userEditLevelSelect')) document.getElementById('userEditLevelSelect').value = user.level || 'LVL 1 • NOVICE';
  if (document.getElementById('userEditCoins')) document.getElementById('userEditCoins').value = liveCoins;
  if (document.getElementById('userEditStars')) document.getElementById('userEditStars').value = liveStars;
  if (document.getElementById('userEditTickets')) document.getElementById('userEditTickets').value = liveTickets;
  if (document.getElementById('userEditDiamonds')) document.getElementById('userEditDiamonds').value = liveDiamonds;
  if (document.getElementById('userEditPassLevel')) document.getElementById('userEditPassLevel').value = livePassLevel;
  if (document.getElementById('userEditEventTasks')) document.getElementById('userEditEventTasks').value = liveEventTasks;
  if (document.getElementById('userEditTotalTasks')) document.getElementById('userEditTotalTasks').value = liveTotalTasks;
  if (document.getElementById('userEditStatus')) document.getElementById('userEditStatus').value = user.status || 'active';
  if (document.getElementById('userEditIdDisplay')) document.getElementById('userEditIdDisplay').textContent = 'UID: ' + user.id;

  if (modal) modal.style.display = 'flex';
}

function clearUserDetailsInModal() {
  setEditUserAvatar('avatar-7.png');
  if (document.getElementById('userEditHandleInput')) document.getElementById('userEditHandleInput').value = '';
  if (document.getElementById('userEditEmailInput')) document.getElementById('userEditEmailInput').value = '';
  if (document.getElementById('userEditCoins')) document.getElementById('userEditCoins').value = '0';
  if (document.getElementById('userEditStars')) document.getElementById('userEditStars').value = '0';
  if (document.getElementById('userEditTickets')) document.getElementById('userEditTickets').value = '0';
  if (document.getElementById('userEditDiamonds')) document.getElementById('userEditDiamonds').value = '0';
  if (document.getElementById('userEditPassLevel')) document.getElementById('userEditPassLevel').value = '0';
  if (document.getElementById('userEditEventTasks')) document.getElementById('userEditEventTasks').value = '0';
  if (document.getElementById('userEditTotalTasks')) document.getElementById('userEditTotalTasks').value = '0';
  showToast('🧹 Details cleared — click Save & Sync to apply.');
}
window.clearUserDetailsInModal = clearUserDetailsInModal;

function closeAdminUserModal() {
  const modal = document.getElementById('adminUserModalOverlay');
  if (modal) modal.style.display = 'none';
}

function handleUserModalBackdropClick(e) {
  if (e.target && e.target.id === 'adminUserModalOverlay') {
    closeAdminUserModal();
  }
}

function openCreateUserModal() {
  const modal = document.getElementById('adminAddUserModalOverlay');
  if (document.getElementById('userAddNameInput')) document.getElementById('userAddNameInput').value = '';
  if (document.getElementById('userAddAvatarInput')) document.getElementById('userAddAvatarInput').value = '🚀';
  if (document.getElementById('userAddEventTasks')) document.getElementById('userAddEventTasks').value = '10';
  if (document.getElementById('userAddTotalTasks')) document.getElementById('userAddTotalTasks').value = '20';
  if (document.getElementById('userAddCoins')) document.getElementById('userAddCoins').value = '1000';
  if (document.getElementById('userAddStars')) document.getElementById('userAddStars').value = '20';
  if (document.getElementById('userAddTickets')) document.getElementById('userAddTickets').value = '50';
  if (modal) modal.style.display = 'flex';
}

function closeCreateUserModal() {
  const modal = document.getElementById('adminAddUserModalOverlay');
  if (modal) modal.style.display = 'none';
}

function handleSaveCreateUser(e) {
  if (e && e.preventDefault) e.preventDefault();
  const name = document.getElementById('userAddNameInput')?.value?.trim() || 'New Player';
  const avatar = document.getElementById('userAddAvatarInput')?.value?.trim() || '🚀';
  const eventTasks = parseInt(document.getElementById('userAddEventTasks')?.value || '0', 10);
  const totalTasks = parseInt(document.getElementById('userAddTotalTasks')?.value || '0', 10);
  const coins = parseInt(document.getElementById('userAddCoins')?.value || '0', 10);
  const stars = parseInt(document.getElementById('userAddStars')?.value || '0', 10);
  const tickets = parseInt(document.getElementById('userAddTickets')?.value || '0', 10);
  const level = document.getElementById('userAddLevelSelect')?.value || 'LVL 1 • NOVICE';
  const role = document.getElementById('userAddRoleSelect')?.value || 'player';

  const newId = 'usr_' + Date.now();
  const newUser = {
    id: newId,
    name,
    avatar,
    username: '@' + name.toLowerCase().replace(/\s+/g, ''),
    email: newId + '@novatasks.io',
    level,
    role,
    coins,
    stars,
    tickets,
    eventTasks,
    totalTasks,
    status: 'active',
    joined: 'Today'
  };

  usersData.push(newUser);
  const cloudSaver = (window.Firebase && window.Firebase.saveUserToCloud) || window.saveUserToCloud;
  if (typeof cloudSaver === 'function') {
    Promise.resolve(cloudSaver({ ...newUser, displayName: newUser.name })).catch(() => {});
  }
  saveUsersAndSync();
  closeCreateUserModal();
  showToast(`🚀 New contender "${name}" added to Leaderboard & Admin!`);
}

async function handleSaveAdminUserForm(e) {
  if (e && e.preventDefault) e.preventDefault();
  const userId = document.getElementById('userEditId')?.value;
  const name = (document.getElementById('userEditNameInput')?.value || '').trim() || 'Player';
  const handle = (document.getElementById('userEditHandleInput')?.value || '').trim();
  const email = (document.getElementById('userEditEmailInput')?.value || '').trim();
  const rawRole = (document.getElementById('userEditRoleSelect')?.value || 'player').toLowerCase();
  const role = rawRole === 'vip' ? 'vip' : 'player';
  const level = document.getElementById('userEditLevelSelect')?.value || 'LVL 1 • NOVICE';
  const coins = Math.max(0, parseInt(document.getElementById('userEditCoins')?.value || '0', 10) || 0);
  const stars = Math.max(0, parseInt(document.getElementById('userEditStars')?.value || '0', 10) || 0);
  const tickets = Math.max(0, parseInt(document.getElementById('userEditTickets')?.value || '0', 10) || 0);
  const diamonds = Math.max(0, parseInt(document.getElementById('userEditDiamonds')?.value || '0', 10) || 0);
  const passLevel = Math.max(0, Math.min(500, parseInt(document.getElementById('userEditPassLevel')?.value || '0', 10) || 0));
  const eventTasks = Math.max(0, parseInt(document.getElementById('userEditEventTasks')?.value || '0', 10) || 0);
  const totalTasks = Math.max(0, parseInt(document.getElementById('userEditTotalTasks')?.value || '0', 10) || 0);
  const avatar = resolveAdminAvatarFile(document.getElementById('userEditAvatarInput')?.value || 'avatar-1.png');
  const status = document.getElementById('userEditStatus')?.value || 'active';

  // Unique username check across local user pool and cloud pool
  const duplicateLocal = usersData.some(u => u && String(u.id) !== String(userId) && String(u.name || '').trim().toLowerCase() === name.toLowerCase());
  if (duplicateLocal) {
    showToast(`⚠️ Username "${name}" is already taken by another player!`);
    return;
  }
  if (window.Firebase && typeof window.Firebase.isPlayerNameTaken === 'function') {
    try {
      const taken = await window.Firebase.isPlayerNameTaken(name, userId);
      if (taken) {
        showToast(`⚠️ Username "${name}" is already registered in Firebase!`);
        return;
      }
    } catch (err) {}
  }

  const user = usersData.find(u => u.id === userId);
  if (user) {
    const wasCurrent = isCurrentSessionUser(user.id, user);
    user.name = name;
    user.displayName = name;
    user.username = handle;
    user.email = email;
    user.role = role;
    user.level = level;
    user.coins = coins;
    user.stars = stars;
    user.tickets = tickets;
    user.diamonds = diamonds;
    user.passLevel = passLevel;
    user.eventTasks = eventTasks;
    user.totalTasks = totalTasks;
    user.avatar = avatar;
    user.status = status;

    // Save directly to Firebase Cloud Firestore
    const cloudSaver = (window.Firebase && window.Firebase.saveUserToCloud) || window.saveUserToCloud;
    if (typeof cloudSaver === 'function') {
      cloudSaver({
        id: user.id,
        uid: user.id,
        displayName: user.name,
        name: user.name,
        avatar: user.avatar,
        username: user.username,
        email: user.email,
        role: user.role,
        level: user.level,
        coins: user.coins,
        stars: user.stars,
        tickets: user.tickets,
        diamonds: user.diamonds,
        passLevel: user.passLevel,
        eventTasks: user.eventTasks,
        totalTasks: user.totalTasks,
        status: user.status
      }).catch(err => {
        console.warn('Firebase sync warning:', err);
      });
    }

    if (wasCurrent) {
      localStorage.setItem('player_username', name);
      localStorage.setItem('player_username_confirmed', 'true');
      localStorage.setItem('player_avatar', avatar);
      localStorage.setItem('task_game_coins', String(coins));
      localStorage.setItem('user_coins', String(coins));
      localStorage.setItem('task_game_stars', String(stars));
      localStorage.setItem('user_stars', String(stars));
      localStorage.setItem('task_game_tickets', String(tickets));
      localStorage.setItem('user_tickets', String(tickets));
      localStorage.setItem('task_user_tickets', String(tickets));
      localStorage.setItem('task_user_diamonds', String(diamonds));
      localStorage.setItem('user_diamonds', String(diamonds));
      localStorage.setItem('task_pass_level', String(passLevel));
      localStorage.setItem('task_pass_total_completed', String(passLevel));
      localStorage.setItem('task_game_event_tasks', String(eventTasks));
      localStorage.setItem('task_game_event_tasks_count', String(eventTasks));
      localStorage.setItem('task_game_total_tasks', String(totalTasks));
      localStorage.setItem('task_game_total_tasks_completed', String(totalTasks));
      localStorage.setItem('completed_tasks_count', String(totalTasks));
      if (typeof window.updateAllDomBalances === 'function') {
        window.updateAllDomBalances(coins, stars, tickets, diamonds);
      }
      updateAdminLiveDisplays();
      if (typeof updateProfileDisplays === 'function') updateProfileDisplays();
      try {
        if (syncChannel) {
          syncChannel.postMessage({ type: 'PROFILE_UPDATED', name, avatar, timestamp: Date.now() });
          syncChannel.postMessage({ type: 'BALANCES_UPDATED', coins, stars, tickets, diamonds, timestamp: Date.now() });
        }
      } catch (e) {}
    }

    saveUsersAndSync();
    closeAdminUserModal();
    showToast(`Player "${user.name}" updated & synced with Firebase! ✓`, 3500);
  }
}

async function resetUserLocalAndCloudState(userId, user) {
  const wasCurrent = isCurrentSessionUser(userId, user);
  if (user) {
    user.coins = 0;
    user.stars = 0;
    user.tickets = 0;
    user.diamonds = 0;
    user.passLevel = 0;
    user.passXp = 0;
    user.vipPass = false;
    user.eventTasks = 0;
    user.totalTasks = 0;
    user.streak = 0;
    user.level = 'LVL 1 • NOVICE';
    user.xp = 0;
    user.energy = 100;
  }

  if (wasCurrent) {
    const zeroKeys = [
      'task_game_coins', 'user_coins', 'task_game_coins_alt',
      'task_game_stars', 'user_stars',
      'task_game_tickets', 'user_tickets', 'task_user_tickets',
      'task_user_diamonds', 'user_diamonds',
      'wallet_ultra_task_credits', 'wallet_ultra_total_completed',
      'task_pass_level', 'task_pass_total_completed', 'task_pass_current_tasks',
      'task_game_event_tasks', 'task_game_event_tasks_count',
      'task_game_total_tasks', 'task_game_total_tasks_completed', 'completed_tasks_count',
      'ads_watched_count', 'task_game_ads_watched_count', 'task_win_streak', 'user_streak_days'
    ];
    zeroKeys.forEach(k => localStorage.setItem(k, '0'));
    localStorage.setItem('season_6_pass_activated', 'false');
    localStorage.setItem('task_vip_pass_active', 'false');
    localStorage.removeItem('tap_empire_vip_plan');
    localStorage.removeItem('wallet_one_time_offer_claimed');
    localStorage.setItem('wallet_claimed_offers', '{}');
    localStorage.setItem('task_completed_tasks', '{}');
    localStorage.setItem('task_game_completed_tasks', '{}');
    localStorage.setItem('task_unlocked_tasks', '{}');
    localStorage.setItem('tap_empire_opened_tasks', '{}');
    localStorage.setItem('season_battle_pass_claimed', '{}');

    if (typeof window.updateAllDomBalances === 'function') {
      window.updateAllDomBalances(0, 0, 0, 0);
    }
    updateAdminLiveDisplays();
    if (typeof updateProfileDisplays === 'function') updateProfileDisplays();
  }

  const resetFn = (window.Firebase && window.Firebase.resetUserAccountInCloud) || window.resetUserAccountInCloud;
  if (typeof resetFn === 'function') {
    try {
      await resetFn(userId, user);
    } catch (err) {
      console.warn('[Admin] Cloud reset error:', err);
    }
  }
}

async function purgeDeletedUserLocalState(userId, deletedCopy) {
  const wasCurrent = isCurrentSessionUser(userId, deletedCopy);
  const cloudDeleter = (window.Firebase && window.Firebase.deleteUserFromCloud) || window.deleteUserFromCloud;
  if (typeof cloudDeleter === 'function') {
    try {
      await cloudDeleter(userId, deletedCopy);
    } catch (err) {
      console.warn('[Admin] Cloud delete error:', err);
    }
  }

  if (wasCurrent) {
    [
      'player_uid', 'player_email', 'player_username', 'player_username_confirmed', 'player_avatar',
      'tap_empire_vip_plan', 'wallet_one_time_offer_claimed', 'tap_empire_daily_progression'
    ].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('player_logged_in', 'false');
    [
      'task_game_coins', 'user_coins', 'task_game_coins_alt',
      'task_game_stars', 'user_stars',
      'task_game_tickets', 'user_tickets', 'task_user_tickets',
      'task_user_diamonds', 'user_diamonds',
      'wallet_ultra_task_credits', 'wallet_ultra_total_completed',
      'task_pass_level', 'task_pass_total_completed', 'completed_tasks_count', 'ads_watched_count'
    ].forEach(k => localStorage.setItem(k, '0'));
    localStorage.setItem('season_6_pass_activated', 'false');
    localStorage.setItem('task_vip_pass_active', 'false');
    if (typeof window.updateAllDomBalances === 'function') {
      window.updateAllDomBalances(0, 0, 0, 0);
    }
  }
}

async function handleResetUserFromModal() {
  const userId = document.getElementById('userEditId')?.value;
  if (!userId) return;
  const user = usersData.find(u => u.id === userId);
  const userName = user ? (user.name || user.username || userId) : userId;

  const msg = `⚠️ RESET ALL USER DATA FOR: "${userName}" (${userId})?\n\nThis will permanently reset:\n• Coins, Stars, Tickets, Diamonds: 0\n• Pass Level, VIP Pass, Streaks & Claims: 0\n• Tasks & Event missions: 0\n\nThis cannot be undone. Proceed?`;
  if (!confirm(msg)) return;

  await resetUserLocalAndCloudState(userId, user);
  saveUsersAndSync();
  closeAdminUserModal();
  renderAdminUsersList();
  showToast(`🔄 All data for player "${userName}" has been reset to zero! ✓`, 3500);
}

async function handleDeleteUserFromModal() {
  const userId = document.getElementById('userEditId')?.value;
  if (!userId) return;
  const user = usersData.find(u => u.id === userId);
  const userName = user ? (user.name || user.username || userId) : userId;

  const msg = `🗑️ PERMANENTLY DELETE PLAYER: "${userName}" (${userId})?\n\nThis removes the player record and all data across Firebase collections.\nNext open starts fresh.`;
  if (!confirm(msg)) return;

  const deletedCopy = user ? { ...user } : { id: userId, name: userName };
  usersData = usersData.filter(u => u.id !== userId);
  await purgeDeletedUserLocalState(userId, deletedCopy);

  saveUsersAndSync();
  closeAdminUserModal();
  renderAdminUsersList();
  showToast(`🗑️ Player "${userName}" and all Firebase data deleted.`, 3500);
}

function quickAddUserCoins(userId, delta) {
  const user = usersData.find(u => u.id === userId);
  if (!user) return;
  user.coins = Math.max(0, (user.coins || 0) + delta);

  const currentName = localStorage.getItem('player_username') || 'NovaEarner';
  if (user.id === 'usr_1' || user.name === currentName) {
    localStorage.setItem('task_game_coins', user.coins.toString());
    localStorage.setItem('user_coins', user.coins.toString());
    localStorage.setItem('task_game_coins_alt', user.coins.toString());
    updateAdminLiveDisplays();
    try {
      const bc = new BroadcastChannel('balance_sync_channel');
      bc.postMessage({ type: 'BALANCE_UPDATED', coins: user.coins });
      bc.close();
    } catch(e) {}
    if (syncChannel) {
      try {
        syncChannel.postMessage({ type: 'BALANCES_UPDATED', timestamp: Date.now() });
      } catch(e) {}
    }
    window.dispatchEvent(new Event('balance:changed'));
  }

  saveUsersAndSync();
  showToast(`${delta > 0 ? '+' : ''}${delta} coins given to ${user.name}`);
}

function quickAwardAllPlayers(amount) {
  usersData.forEach(u => {
    u.coins = (u.coins || 0) + amount;
  });
  let myCoins = parseInt(localStorage.getItem('task_game_coins') || '0', 10);
  myCoins += amount;
  localStorage.setItem('task_game_coins', myCoins.toString());
  localStorage.setItem('user_coins', myCoins.toString());
  localStorage.setItem('task_game_coins_alt', myCoins.toString());
  try {
    const bc = new BroadcastChannel('balance_sync_channel');
    bc.postMessage({ type: 'BALANCE_UPDATED', coins: myCoins });
    bc.close();
  } catch(e) {}
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type: 'BALANCES_UPDATED', timestamp: Date.now() });
    } catch(e) {}
  }
  window.dispatchEvent(new Event('balance:changed'));
  updateAdminLiveDisplays();

  saveUsersAndSync();
  showToast(`🎁 Granted +${amount.toLocaleString()} Coins to all players!`);
}

function saveUsersAndSync() {
  _lastAdminUsersSig = '';
  try {
    if (window.Firebase && typeof window.Firebase.cacheCompactUsersSummary === 'function') {
      window.Firebase.cacheCompactUsersSummary(usersData);
    } else {
      const compact = (Array.isArray(usersData) ? usersData : []).slice(0, 150).map(u => {
        if (!u || typeof u !== 'object') return null;
        return {
          id: u.id,
          name: u.name,
          displayName: u.displayName || u.name,
          username: u.username,
          avatar: u.avatar,
          role: u.role || 'player',
          level: u.level,
          coins: u.coins || 0,
          stars: u.stars || 0,
          tickets: u.tickets || 0,
          diamonds: u.diamonds || 0,
          passLevel: u.passLevel || 0,
          eventTasks: u.eventTasks || 0,
          totalTasks: u.totalTasks || 0,
          status: u.status || 'active',
          joined: u.joined || ''
        };
      }).filter(Boolean);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(compact));
    }
    localStorage.setItem(SYNC_FLAG_KEY, Date.now().toString());
  } catch (e) { }
  try {
    if (syncChannel) {
      syncChannel.postMessage({ type: 'USERS_UPDATED', usersCount: Array.isArray(usersData) ? usersData.length : 0, timestamp: Date.now() });
      syncChannel.postMessage({ type: 'BALANCES_UPDATED', timestamp: Date.now() });
    }
  } catch (e) { }
  window.dispatchEvent(new CustomEvent('task_game_users:updated', { detail: usersData }));
  window.dispatchEvent(new Event('balance:changed'));
  renderAdminUsersList();
}

// -----------------------------------------------------------------------------
// 3. WITHDRAWAL REQUESTS SUBVIEW LOGIC
// -----------------------------------------------------------------------------

function filterAdminWithdrawals(filter, btn) {
  currentWdFilter = filter;
  document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAdminWithdrawalsList();
}

function renderAdminWithdrawalsList() {
  const container = document.getElementById('adminWithdrawalsList');
  if (!container) return;

  const isAdminAuth = sessionStorage.getItem('admin_authenticated') === 'true' || sessionStorage.getItem('task_admin_authenticated') === 'true';
  if (!isAdminAuth) {
    container.innerHTML = `
      <div style="text-align: center; padding: 1.5rem 1rem; color: #f87171; font-size: 0.85rem; background: #0a1738; border-radius: 14px; border: 1px solid rgba(248, 113, 113, 0.35);">
        🔒 Admin authentication required to view reward requests and user contact details.
      </div>
    `;
    return;
  }

  const pending = withdrawalsData.filter(w => w.status === 'pending');
  const approved = withdrawalsData.filter(w => w.status === 'approved');
  const rejected = withdrawalsData.filter(w => w.status === 'rejected');

  const cntAll = document.getElementById('cntWdAll');
  const cntPend = document.getElementById('cntWdPending');
  const cntApp = document.getElementById('cntWdApproved');
  const cntRej = document.getElementById('cntWdRejected');

  if (cntAll) cntAll.textContent = withdrawalsData.length.toString();
  if (cntPend) cntPend.textContent = pending.length.toString();
  if (cntApp) cntApp.textContent = approved.length.toString();
  if (cntRej) cntRej.textContent = rejected.length.toString();

  updateAdminCounters();

  let list = [...withdrawalsData];
  if (currentWdFilter !== 'all') {
    list = list.filter(w => w.status === currentWdFilter);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: #94a3b8; font-size: 0.85rem; background: #0a1738; border-radius: 14px;">
        <div style="font-size: 2rem; margin-bottom: 0.4rem;">💸</div>
        No ${currentWdFilter === 'all' ? '' : currentWdFilter} requests found.
      </div>
    `;
    return;
  }

  const deliveryOptions = ['Pending Review', 'Processing (Up to 10 Days)', 'Dispatched', 'Delivered ✅'];

  container.innerHTML = list.map(wd => {
    const isPending = wd.status === 'pending';
    const isApproved = wd.status === 'approved';
    const isRejected = wd.status === 'rejected';
    const statusColor = isPending ? '#fbbf24' : isApproved ? '#34d399' : '#f87171';
    const statusBg = isPending ? 'rgba(251, 191, 36, 0.15)' : isApproved ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)';
    const contactVal = wd.contactInfo || wd.userEmail || wd.userWhatsapp || wd.whatsapp || '';
    const isEmailContact = wd.contactType === 'email' || String(contactVal).includes('@');
    const curDeliveryStatus = wd.deliveryStatus || (isRejected ? 'Rejected' : (isApproved && (wd.deliveryLink || wd.link) ? 'Dispatched' : 'Processing (Up to 10 Days)'));

    return `
      <div class="admin-withdraw-card" data-wd-id="${escapeHtml(wd.id)}" style="background: #0a1738; border: 1px solid rgba(56, 189, 248, 0.18); border-radius: 12px; padding: 0.85rem; margin-bottom: 0.65rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
              <span style="font-size: 1.1rem;">${wd.playerAvatar || '⚡'}</span>
              <span style="font-size: 0.88rem; font-weight: 800; color: #ffffff;">${escapeHtml(wd.playerName || 'Player')}</span>
              <span style="font-size: 0.62rem; color: #64748b; font-family: monospace;">(${escapeHtml(wd.id)})</span>
            </div>
            <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.25rem;">
              <b>🎁 ${escapeHtml(wd.method || 'Amazon Gift Card')}</b>${(wd.voucherCode || wd.details) ? ` • Code/Info: <span style="color:#fde047;font-family:monospace;">${escapeHtml(wd.voucherCode || wd.details)}</span>` : ''}
            </div>
            ${(wd.userEmail || (isEmailContact ? contactVal : '')) ? `
              <div class="admin-wd-contact" style="font-size: 0.74rem; color: #38bdf8; font-weight: 800; margin-top: 0.2rem;">
                📧 Email: <span style="color:#fff;">${escapeHtml(wd.userEmail || contactVal)}</span>
              </div>
            ` : ''}
            ${(wd.userWhatsapp || wd.whatsapp || wd.mobile || (!isEmailContact && contactVal ? contactVal : '')) ? `
              <div class="admin-wd-contact" style="font-size: 0.74rem; color: #34d399; font-weight: 800; margin-top: 0.15rem;">
                📱 Mobile: <span style="color:#fff;">${escapeHtml(wd.userWhatsapp || wd.whatsapp || wd.mobile || contactVal)}</span>
              </div>
            ` : ''}
            <div style="font-size: 0.68rem; color: #fde68a; font-weight: 700; margin-top: 0.2rem;">
              🚚 Delivery Status: <span class="admin-wd-delivery-text">${escapeHtml(curDeliveryStatus)}</span>
            </div>
            ${(wd.deliveryLink || wd.link) ? `<div style="margin-top: 3px;"><a href="${escapeHtml(wd.deliveryLink || wd.link)}" target="_blank" rel="noopener noreferrer" style="color: #34d399; font-size: 0.72rem; font-weight: 800; text-decoration: underline;">🔗 View Link</a></div>` : ''}
            <div style="font-size: 0.65rem; color: #64748b; margin-top: 0.15rem;">${escapeHtml(wd.time || 'Recent')}</div>
          </div>

          <div style="text-align: right;">
            <div style="font-size: 1.05rem; font-weight: 900; color: #38bdf8;">₹${Number(wd.amount || 0).toLocaleString()}</div>
            <span style="font-size: 0.65rem; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${statusBg}; color: ${statusColor}; text-transform: uppercase;">
              ${escapeHtml(wd.status)}
            </span>
          </div>
        </div>

        ${isPending ? `
          <div style="display: flex; gap: 0.5rem; margin-top: 0.6rem; padding-top: 0.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05);">
            <button class="btn-card-action success" style="flex: 1; padding: 6px;" onclick="approveWithdrawal('${escapeHtml(wd.id)}')">Approve &amp; Send Link ✓</button>
            <button class="btn-card-action danger" style="padding: 6px 12px;" onclick="rejectWithdrawal('${escapeHtml(wd.id)}')">Reject ✕</button>
          </div>
        ` : ''}

        ${!isRejected ? `
          <div style="display: flex; gap: 0.45rem; align-items: center; margin-top: 0.55rem; padding-top: 0.45rem; border-top: 1px solid rgba(255, 255, 255, 0.05);">
            <select id="wdDeliverySel_${escapeHtml(wd.id)}" class="admin-form-input" style="flex:1; font-size: 0.72rem; padding: 4px 6px;">
              ${deliveryOptions.map(opt => `<option value="${escapeHtml(opt)}" ${curDeliveryStatus === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
            </select>
            <button type="button" class="btn-ctrl-code" style="font-size: 0.7rem; padding: 5px 10px;" onclick="updateWithdrawalDeliveryStatus('${escapeHtml(wd.id)}')">Update Delivery</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function approveWithdrawal(wdId) {
  const wd = withdrawalsData.find(w => w.id === wdId);
  if (!wd) return;
  if (wd.status && wd.status !== 'pending') {
    showToast(`Request ${wd.id} is already ${wd.status}.`, 'error');
    return;
  }

  const link = prompt(`🔗 Enter Voucher / Delivery Link for #${wd.id} (optional):\n(e.g. https://example.com/voucher/claim...)`, wd.deliveryLink || wd.link || '');
  if (link === null) return;

  const enteredCode = prompt(`🔐 Enter Admin Approval Security Code (1109) to confirm approval:`);
  if (enteredCode === null) return;

  if (enteredCode.trim() !== '1109') {
    alert('❌ Invalid Approval Code! Must enter code 1109.');
    showToast('Invalid security code! Approval cancelled.', 'error');
    return;
  }

  let cleanLink = link.trim();
  if (cleanLink && !cleanLink.startsWith('http://') && !cleanLink.startsWith('https://')) {
    cleanLink = 'https://' + cleanLink;
  }
  const nextDeliveryStatus = cleanLink ? 'Dispatched' : 'Processing (Up to 10 Days)';

  if (window.Firebase && typeof window.Firebase.processWithdrawalDecisionInCloud === 'function') {
    const res = await window.Firebase.processWithdrawalDecisionInCloud({
      wdId: wd.id,
      decision: 'approved',
      deliveryLink: cleanLink,
      deliveryStatus: nextDeliveryStatus,
      adminUser: localStorage.getItem('player_username') || 'admin'
    });
    if (!res.ok) {
      showToast(res.error || 'Could not approve request.', 'error');
      return;
    }
  } else {
    const cloudWdSaver = (window.Firebase && window.Firebase.saveWithdrawalToCloud) || window.saveWithdrawalToCloud;
    if (typeof cloudWdSaver === 'function') {
      cloudWdSaver({ ...wd, status: 'approved', deliveryStatus: nextDeliveryStatus, approvedAt: Date.now(), deliveryLink: cleanLink, link: cleanLink }).catch(() => {});
    }
  }

  wd.status = 'approved';
  wd.deliveryStatus = nextDeliveryStatus;
  wd.approvedAt = Date.now();
  if (cleanLink) {
    wd.deliveryLink = cleanLink;
    wd.link = cleanLink;
  }

  saveWithdrawalsAndSync();
  showToast(`✅ Request ${wd.id} Approved!`);
}

async function rejectWithdrawal(wdId) {
  const wd = withdrawalsData.find(w => w.id === wdId);
  if (!wd) return;
  if (wd.status && wd.status !== 'pending') {
    showToast(`Request ${wd.id} is already ${wd.status}.`, 'error');
    return;
  }
  if (!confirm(`Reject withdrawal request ${wd.id} for ₹${Number(wd.amount || 0).toLocaleString()}?`)) return;

  if (window.Firebase && typeof window.Firebase.processWithdrawalDecisionInCloud === 'function') {
    const res = await window.Firebase.processWithdrawalDecisionInCloud({
      wdId: wd.id,
      decision: 'rejected',
      deliveryStatus: 'Rejected',
      adminUser: localStorage.getItem('player_username') || 'admin'
    });
    if (!res.ok) {
      showToast(res.error || 'Could not reject request.', 'error');
      return;
    }
  } else {
    const cloudWdSaver = (window.Firebase && window.Firebase.saveWithdrawalToCloud) || window.saveWithdrawalToCloud;
    if (typeof cloudWdSaver === 'function') {
      cloudWdSaver({ ...wd, status: 'rejected', deliveryStatus: 'Rejected' }).catch(() => {});
    }
  }

  wd.status = 'rejected';
  wd.deliveryStatus = 'Rejected';
  saveWithdrawalsAndSync();
  showToast(`Request ${wd.id} Rejected.`);
}

async function updateWithdrawalDeliveryStatus(wdId) {
  const isAdminAuth = sessionStorage.getItem('admin_authenticated') === 'true' || sessionStorage.getItem('task_admin_authenticated') === 'true';
  if (!isAdminAuth) {
    showToast('Admin authentication required.', 'error');
    return;
  }
  const wd = withdrawalsData.find(w => w.id === wdId);
  if (!wd) return;
  const sel = document.getElementById(`wdDeliverySel_${wdId}`);
  const nextStatus = (sel && sel.value) || 'Processing (Up to 10 Days)';
  wd.deliveryStatus = nextStatus;
  wd.deliveryUpdatedAt = Date.now();
  wd.updatedAt = Date.now();
  saveWithdrawalsAndSync();
  showToast(`🚚 Delivery status updated to "${nextStatus}"`);
  if (window.Firebase && typeof window.Firebase.updateWithdrawalDeliveryInCloud === 'function') {
    await window.Firebase.updateWithdrawalDeliveryInCloud({
      wdId: wd.id,
      deliveryStatus: nextStatus,
      adminUser: localStorage.getItem('player_username') || 'admin'
    });
  }
}
window.updateWithdrawalDeliveryStatus = updateWithdrawalDeliveryStatus;

function saveWithdrawalsAndSync() {
  localStorage.setItem(WITHDRAW_STORAGE_KEY, JSON.stringify(withdrawalsData));
  localStorage.setItem(SYNC_FLAG_KEY, Date.now().toString());
  if (syncChannel) {
    syncChannel.postMessage({ type: 'WITHDRAWALS_UPDATED', timestamp: Date.now() });
  }
  renderAdminWithdrawalsList();
}

// -----------------------------------------------------------------------------
// 4. LEADERBOARD EVENT SUBVIEW LOGIC
// -----------------------------------------------------------------------------

function renderAdminEventSection() {
  if (typeof loadAdminAppSettingsUI === 'function') loadAdminAppSettingsUI();
  if (typeof renderAdminPassPanel === 'function') renderAdminPassPanel();
  if (typeof renderAdminFeedbackList === 'function') renderAdminFeedbackList();
  startAdminEventTimer();
  renderAdminEventContenders();
  renderProfileSessionHistory();
  if (typeof syncAdminEventTabVisibility === 'function') {
    syncAdminEventTabVisibility(currentAdminEventTab || 'pass');
  }
}
window.renderAdminFeedbacks = renderAdminFeedbackList;

const SESSIONS_STORAGE_KEY = 'task_game_leaderboard_sessions';
const UNIFIED_EVENT_KEY = 'task_game_leaderboard_event';

function getLeaderboardEventState() {
  const now = Date.now();

  // Purge legacy key
  try {
    if (localStorage.getItem('task_leaderboard_event_v1')) {
      localStorage.removeItem('task_leaderboard_event_v1');
    }
  } catch (e) {}

  let data = null;
  try {
    const raw = localStorage.getItem(UNIFIED_EVENT_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (e) {}

  // If an event has finished, respect it
  if (data && data.status === 'finished') {
    return data;
  }

  // If active manual override is still running
  if (data && data.isManualOverride && now < data.endTime && data.status === 'active') {
    return data;
  }

  // Deterministic Universal Global 3-Month Season (Identical to Rank and Admin Event pages)
  const GLOBAL_EPOCH_ANCHOR = Date.UTC(2026, 9, 1, 0, 0, 0); // Oct 1, 2026 UTC
  const THREE_MONTHS_HOURS = 2160;
  const THREE_MONTHS_DAYS = 90;
  const THREE_MONTHS_MS = THREE_MONTHS_HOURS * 60 * 60 * 1000;

  const elapsed = Math.max(0, now - GLOBAL_EPOCH_ANCHOR);
  const seasonIndex = Math.floor(elapsed / THREE_MONTHS_MS);
  const seasonNumber = seasonIndex + 1;
  const startTime = GLOBAL_EPOCH_ANCHOR + (seasonIndex * THREE_MONTHS_MS);
  const endTime = startTime + THREE_MONTHS_MS;

  data = {
    id: `global_season_${seasonNumber}`,
    seasonNumber: seasonNumber,
    name: `Season ${seasonNumber}: 3-Month Championship`,
    startTime: startTime,
    endTime: endTime,
    durationHours: THREE_MONTHS_HOURS,
    durationDays: THREE_MONTHS_DAYS,
    status: 'active',
    isGlobal: true
  };

  try {
    localStorage.setItem(UNIFIED_EVENT_KEY, JSON.stringify(data));
  } catch(e) {}

  return data;
}

function startAdminEventTimer() {
  if (adminEventInterval) clearInterval(adminEventInterval);

  function tick() {
    const evt = getLeaderboardEventState();
    const now = Date.now();
    const diff = Math.max(0, (evt.endTime || 0) - now);

    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const elDays = document.getElementById('adminTimerDays');
    const elHours = document.getElementById('adminTimerHours');
    const elMins = document.getElementById('adminTimerMins');
    const elSecs = document.getElementById('adminTimerSecs');

    if (elDays) elDays.textContent = String(days).padStart(2, '0');
    if (elHours) elHours.textContent = String(hours).padStart(2, '0');
    if (elMins) elMins.textContent = String(mins).padStart(2, '0');
    if (elSecs) elSecs.textContent = String(secs).padStart(2, '0');

    const elBadge = document.getElementById('profileEventSeasonBadge');
    if (elBadge && evt.name) {
      elBadge.textContent = `🏆 ${evt.name.toUpperCase()}`;
    }
    const elDates = document.getElementById('adminEventDatesInfo');
    if (elDates && evt.startTime && evt.endTime) {
      const startStr = new Date(evt.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const endStr = new Date(evt.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      elDates.textContent = `Active Season: ${startStr} – ${endStr} (90 Days Global Championship)`;
    }
  }

  tick();
  adminEventInterval = setInterval(tick, 1000);
}

function renderAdminEventContenders() {
  const container = document.getElementById('adminEventPlayersList');
  const badgeEl = document.getElementById('profileLiveContendersBadge');
  if (!container) return;

  const allContenders = [...usersData].sort((a, b) => {
    const evDiff = (Number(b.eventTasks || 0)) - (Number(a.eventTasks || 0));
    if (evDiff !== 0) return evDiff;
    return (Number(b.totalTasks || 0)) - (Number(a.totalTasks || 0));
  });

  if (badgeEl) {
    if (allContenders.length === 0) badgeEl.textContent = '0 Contenders';
    else if (allContenders.length > 50) badgeEl.textContent = `Top 50 of ${allContenders.length.toLocaleString()}`;
    else badgeEl.textContent = `${allContenders.length} Contenders`;
  }

  if (allContenders.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 1.5rem; color: #94a3b8; font-size: 0.8rem;">No contenders registered yet.</div>`;
    return;
  }

  const topContenders = allContenders.slice(0, 50);
  container.innerHTML = topContenders.map((u, i) => {
    const avatarHtml = typeof getAdminUserAvatarImgHtml === 'function'
      ? getAdminUserAvatarImgHtml(u.avatar || 'avatar-1.png', 28)
      : `<span>${escapeHtml(u.avatar || '⚡')}</span>`;
    return `
      <div class="admin-event-player-row" style="display: flex; align-items: center; justify-content: space-between; background: #060e24; border: 1px solid rgba(250, 204, 21, 0.2); border-radius: 10px; padding: 0.5rem 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.55rem; min-width: 0;">
          <span style="font-weight: 900; color: ${i === 0 ? '#facc15' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : '#64748b'}; min-width: 28px;">#${i + 1}</span>
          <span style="display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${avatarHtml}</span>
          <span style="font-size: 0.82rem; font-weight: 800; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(u.name || 'User ' + (i + 1))}</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0;">
          <span style="font-size: 0.75rem; font-weight: 800; color: #facc15;">${Number(u.eventTasks || 0).toLocaleString()} Event Tasks</span>
          <span style="font-size: 0.68rem; color: #94a3b8;">${Number(u.totalTasks || 0).toLocaleString()} Total Tasks</span>
        </div>
      </div>
    `;
  }).join('');
}

function adminResetLeaderboardSeason() {
  if (!confirm('Restart the 3-Month Global Championship Event Season?')) return;
  const THREE_MONTHS_HOURS = 2160;
  const THREE_MONTHS_DAYS = 90;
  const THREE_MONTHS_MS = THREE_MONTHS_HOURS * 60 * 60 * 1000;
  const current = getLeaderboardEventState();
  // Season restart: season number does NOT change
  const nextSeasonNum = current.seasonNumber || 1;
  const now = Date.now();
  const nextSeason = {
    id: `global_season_${nextSeasonNum}`,
    seasonNumber: nextSeasonNum,
    name: `Season ${nextSeasonNum}: 3-Month Championship`,
    startTime: now,
    endTime: now + THREE_MONTHS_MS,
    durationHours: THREE_MONTHS_HOURS,
    durationDays: THREE_MONTHS_DAYS,
    status: 'active',
    isGlobal: true,
    isManualOverride: true
  };

  localStorage.setItem(UNIFIED_EVENT_KEY, JSON.stringify(nextSeason));
  localStorage.removeItem('task_leaderboard_event_v1');
  localStorage.setItem(SYNC_FLAG_KEY, now.toString());

  try {
    if (window.Firebase && typeof window.Firebase.saveGlobalLeaderboardEventToCloud === 'function') {
      window.Firebase.saveGlobalLeaderboardEventToCloud(nextSeason);
    }
    const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
    bc.postMessage({ type: 'EVENT_RESTART', event: nextSeason, timestamp: now });
    bc.close();
  } catch(e) {}

  // Reset event tasks for users
  usersData.forEach(u => {
    u.eventTasks = 0;
  });
  saveUsersAndSync();

  startAdminEventTimer();
  renderAdminEventContenders();
  showToast(`🏆 Season ${nextSeason.seasonNumber} started! Fresh 90 days countdown.`);
}


// ============================================================================
// HELP & SUPPORT PAGE NAVIGATION
// ============================================================================
function openHelpModal() {
  if (typeof ProfileAudio !== 'undefined' && ProfileAudio && typeof ProfileAudio.playTabSwitch === 'function') {
    try { ProfileAudio.playTabSwitch(); } catch (e) {}
  }
  window.location.href = '../help/index.html';
}

function closeHelpModal() {
  // Maintained for backward compatibility
}

function handleHelpModalBackdropClick(event) {
  // Maintained for backward compatibility
}

function submitHelpSupportTicket() {
  const input = document.getElementById('helpTicketMessage');
  const statusMsg = document.getElementById('helpTicketStatusMsg');
  if (!input || !input.value.trim()) {
    showToast('⚠️ Please write your question or issue description.');
    if (input) input.focus();
    return;
  }

  const ticketId = 'NV-' + Math.floor(1000 + Math.random() * 9000);
  const userMsg = input.value.trim();
  
  // Store ticket locally
  let storedTickets = [];
  try {
    const raw = localStorage.getItem('user_support_tickets');
    if (raw) storedTickets = JSON.parse(raw);
    if (!Array.isArray(storedTickets)) storedTickets = [];
  } catch(e) {
    storedTickets = [];
  }
  storedTickets.unshift({
    id: ticketId,
    message: userMsg,
    date: new Date().toISOString(),
    status: 'In Review'
  });
  try {
    localStorage.setItem('user_support_tickets', JSON.stringify(storedTickets));
  } catch(e) {}

  input.value = '';
  if (statusMsg) {
    statusMsg.innerHTML = '✅ Ticket <b>#' + ticketId + '</b> created! Our team replies within 24 hours.';
    statusMsg.style.display = 'block';
  }
  showToast('Ticket #' + ticketId + ' submitted successfully! 🚀');
  if (typeof ProfileAudio !== 'undefined' && ProfileAudio && typeof ProfileAudio.playSuccess === 'function') {
    ProfileAudio.playSuccess();
  }
}

// ============================================================================
// COMMUNITY & COMMITS MODAL CONTROLLER
// ============================================================================
function openCommunityModal() {
  const modal = document.getElementById('communityModalOverlay');
  if (!modal) return;
  modal.classList.add('active');
  modal.style.display = 'flex';
  if (typeof ProfileAudio !== 'undefined' && ProfileAudio && typeof ProfileAudio.playTabSwitch === 'function') {
    ProfileAudio.playTabSwitch();
  }
}

function closeCommunityModal() {
  const modal = document.getElementById('communityModalOverlay');
  if (!modal) return;
  modal.classList.remove('active');
  modal.style.display = 'none';
}

function handleCommunityModalBackdropClick(event) {
  if (event && (event.target.id === 'communityModalOverlay' || event.target.classList.contains('profile-modal-overlay'))) {
    closeCommunityModal();
  }
}

function handleJoinCommunityPlatform(platform) {
  const key = 'community_joined_' + platform;
  const alreadyJoined = localStorage.getItem(key);

  if (platform === 'channel') {
    window.open('https://t.me/TaskCommunityOfficial', '_blank');
  } else if (platform === 'group') {
    window.open('https://t.me/NovaChatGlobal', '_blank');
  } else if (platform === 'discord') {
    window.open('https://discord.gg/novatasks', '_blank');
  }

  if (!alreadyJoined && (platform === 'channel' || platform === 'group')) {
    localStorage.setItem(key, 'true');
    const bonusCoins = 25;
    const currentCoins = parseInt(localStorage.getItem('task_game_coins') || '0', 10);
    const updatedCoins = currentCoins + bonusCoins;
    localStorage.setItem('task_game_coins', updatedCoins.toString());
    localStorage.setItem('user_coins', updatedCoins.toString());
    if (typeof updateProfileDisplays === 'function') {
      updateProfileDisplays();
    }

    const btn = platform === 'channel' ? document.getElementById('btnJoinTgChannel') : document.getElementById('btnJoinTgGroup');
    if (btn) {
      btn.textContent = 'Joined ✓';
      btn.style.background = 'rgba(16, 185, 129, 0.25)';
      btn.style.color = '#34d399';
      btn.style.border = '1px solid #10b981';
    }

    showToast('🎉 Joined ' + (platform === 'channel' ? 'Announcement Channel' : 'Chat Group') + '! +' + bonusCoins + ' 🪙 Awarded! 🚀');
    if (typeof ProfileAudio !== 'undefined' && ProfileAudio && typeof ProfileAudio.playSuccess === 'function') {
      ProfileAudio.playSuccess();
    }
  } else {
    showToast('Opening ' + platform + ' portal...');
  }
}

window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
window.handleHelpModalBackdropClick = handleHelpModalBackdropClick;
window.submitHelpSupportTicket = submitHelpSupportTicket;

window.openCommunityModal = openCommunityModal;
window.closeCommunityModal = closeCommunityModal;
window.handleCommunityModalBackdropClick = handleCommunityModalBackdropClick;
window.handleJoinCommunityPlatform = handleJoinCommunityPlatform;


// ============================================================================
// PLAYER FEEDBACK SYSTEM (Storage & Event Page Viewer)
// ============================================================================
const FEEDBACK_STORAGE_KEY = 'task_feedbacks';

function initFeedbackSystem() {
  if (!localStorage.getItem(FEEDBACK_STORAGE_KEY)) {
    localStorage.setItem(FEEDBACK_STORAGE_KEY, '[]');
  }
}
initFeedbackSystem();

function normalizeAdminFeedbackItem(item) {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id || ('fb_' + (item.createdAt || item.timestamp || Date.now())));
  let dateIso = item.date || '';
  if (!dateIso && (item.createdAt || item.timestamp)) {
    dateIso = new Date(Number(item.createdAt || item.timestamp)).toISOString();
  }
  if (!dateIso) dateIso = new Date().toISOString();
  return {
    ...item,
    id,
    name: item.name || item.userName || 'Anonymous',
    avatar: item.avatar || 'avatar-7.png',
    rating: Number(item.rating || 5) || 5,
    category: item.category || 'General',
    message: item.message || '',
    date: dateIso,
    createdAt: Number(item.createdAt || item.timestamp || Date.parse(dateIso) || Date.now()) || Date.now()
  };
}

function getStoredFeedbacks() {
  initFeedbackSystem();
  try {
    const primary = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
    const supportMirrors = JSON.parse(localStorage.getItem('task_game_feedbacks') || '[]');
    const byId = new Map();
    [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(supportMirrors) ? supportMirrors : [])]
      .map(normalizeAdminFeedbackItem)
      .filter(Boolean)
      .forEach((item) => {
        if (!byId.has(item.id)) byId.set(item.id, item);
      });
    return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (e) {
    return [];
  }
}

function saveStoredFeedbacks(list) {
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(list));
  localStorage.setItem('task_game_feedbacks', JSON.stringify(list));
  renderAdminFeedbackList();
}

function openFeedbackModal() {
  const modal = document.getElementById('feedbackModalOverlay');
  if (!modal) return;
  modal.classList.add('active');
  modal.style.display = 'flex';
  setFeedbackRating(5);
  const msgInput = document.getElementById('feedbackMessage');
  if (msgInput) msgInput.value = '';
  const successBox = document.getElementById('feedbackSuccessMsg');
  if (successBox) successBox.style.display = 'none';

  if (typeof ProfileAudio !== 'undefined' && ProfileAudio && typeof ProfileAudio.playTabSwitch === 'function') {
    ProfileAudio.playTabSwitch();
  }
}

function closeFeedbackModal() {
  const modal = document.getElementById('feedbackModalOverlay');
  if (!modal) return;
  modal.classList.remove('active');
  modal.style.display = 'none';
}

function handleFeedbackModalBackdropClick(event) {
  if (event && (event.target.id === 'feedbackModalOverlay' || event.target.classList.contains('profile-modal-overlay'))) {
    closeFeedbackModal();
  }
}

function setFeedbackRating(stars) {
  const hiddenInput = document.getElementById('feedbackRatingValue');
  const label = document.getElementById('feedbackRatingLabel');
  if (hiddenInput) hiddenInput.value = stars.toString();

  const labels = {
    1: '1 / 5 — Poor',
    2: '2 / 5 — Needs Improvement',
    3: '3 / 5 — Average',
    4: '4 / 5 — Very Good!',
    5: '5 / 5 — Excellent!'
  };
  if (label) label.textContent = labels[stars] || (stars + ' / 5');

  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('starRating' + i);
    if (el) {
      el.style.opacity = i <= stars ? '1' : '0.28';
      el.style.transform = i === stars ? 'scale(1.2)' : 'scale(1)';
    }
  }
}

function submitPlayerFeedback(e) {
  if (e && e.preventDefault) e.preventDefault();
  const msgInput = document.getElementById('feedbackMessage');
  const catInput = document.getElementById('feedbackCategory');
  const ratingInput = document.getElementById('feedbackRatingValue');
  const successBox = document.getElementById('feedbackSuccessMsg');

  if (!msgInput || !msgInput.value.trim()) {
    showToast('⚠️ Please write your feedback message.');
    if (msgInput) msgInput.focus();
    return;
  }

  const playerName = localStorage.getItem('player_username') || 'Player';
  const playerAvatar = localStorage.getItem('player_avatar') || '⚡';
  const newFeedback = {
    id: 'fb_' + Date.now(),
    name: playerName,
    avatar: playerAvatar,
    rating: parseInt(ratingInput?.value || '5', 10),
    category: catInput?.value || 'General',
    message: msgInput.value.trim(),
    date: new Date().toISOString()
  };

  const list = getStoredFeedbacks();
  list.unshift(newFeedback);
  saveStoredFeedbacks(list);

  if (successBox) successBox.style.display = 'block';
  msgInput.value = '';
  showToast('🎉 Feedback sent to Admin successfully! Thank you. ✓');
  if (typeof ProfileAudio !== 'undefined' && ProfileAudio && typeof ProfileAudio.playSuccess === 'function') {
    ProfileAudio.playSuccess();
  }

  setTimeout(() => {
    closeFeedbackModal();
  }, 1400);
}

function renderAdminFeedbackList() {
  const container = document.getElementById('adminFeedbackListContainer');
  const countEl = document.getElementById('adminFeedbackCount');
  const tabBadgeEl = document.getElementById('adminEventFeedbackTabBadge');

  const list = getStoredFeedbacks();
  if (countEl) countEl.textContent = list.length.toString();
  if (tabBadgeEl) tabBadgeEl.textContent = list.length.toString();
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 1.5rem; color: #94a3b8; font-size: 0.78rem; background: rgba(15, 23, 42, 0.5); border-radius: 8px;">No player feedback messages yet.</div>';
    return;
  }

  container.innerHTML = list.map(item => {
    const starString = '⭐'.repeat(item.rating || 5);
    const dateFormatted = new Date(item.date).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const avatarHtml = typeof getAdminUserAvatarImgHtml === 'function'
      ? getAdminUserAvatarImgHtml(item.avatar || 'avatar-7.png', 32)
      : `<span style="font-size: 1.3rem;">${escapeHtml(item.avatar || '👤')}</span>`;

    return `
      <div class="admin-feedback-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${avatarHtml}</span>
            <div>
              <div style="font-size: 0.82rem; font-weight: 800; color: #ffffff;">${escapeHtml(item.name || 'Anonymous')}</div>
              <div style="font-size: 0.68rem; color: #94a3b8; display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <span style="color: #fbbf24; font-weight: 700;">${starString}</span>
                <span>&bull;</span>
                <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 1px 6px; border-radius: 4px; font-weight: 700;">${escapeHtml(item.category || 'General')}</span>
                <span>&bull;</span>
                <span>${dateFormatted}</span>
              </div>
            </div>
          </div>
          <button type="button" onclick="deleteFeedbackMessage('${escapeHtml(item.id)}')" title="Delete message" style="background: rgba(239, 68, 68, 0.18); border: 1px solid rgba(239, 68, 68, 0.45); color: #f87171; border-radius: 6px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer; display: flex; align-items: center; gap: 3px;">
            <span>🗑️ Delete</span>
          </button>
        </div>
        <div style="font-size: 0.76rem; color: #cbd5e1; margin-top: 6px; line-height: 1.45; background: rgba(6, 15, 42, 0.6); padding: 7px 9px; border-radius: 6px; border-left: 2px solid #fbbf24;">
          ${escapeHtml(item.message || '')}
        </div>
      </div>
    `;
  }).join('');
}

function deleteFeedbackMessage(id) {
  if (!confirm('Are you sure you want to delete this feedback message?')) return;
  let list = getStoredFeedbacks();
  list = list.filter(f => String(f.id) !== String(id));
  saveStoredFeedbacks(list);
  const delFb = (window.Firebase && window.Firebase.deleteFeedbackFromCloud) || window.deleteFeedbackFromCloud;
  if (typeof delFb === 'function') {
    delFb(String(id)).catch(() => {});
  }
  showToast('Feedback message deleted 🗑️');
}

function clearAllAdminFeedbacks() {
  if (!confirm('Are you sure you want to delete ALL feedback messages?')) return;
  saveStoredFeedbacks([]);
  const clearFb = (window.Firebase && window.Firebase.clearAllFeedbacksInCloud) || window.clearAllFeedbacksInCloud;
  if (typeof clearFb === 'function') {
    clearFb().catch(() => {});
  }
  showToast('All feedback messages cleared 🗑️');
}

window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.handleFeedbackModalBackdropClick = handleFeedbackModalBackdropClick;
window.setFeedbackRating = setFeedbackRating;
window.submitPlayerFeedback = submitPlayerFeedback;
window.renderAdminFeedbackList = renderAdminFeedbackList;
window.deleteFeedbackMessage = deleteFeedbackMessage;
window.clearAllAdminFeedbacks = clearAllAdminFeedbacks;

const HTML_ESC_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
};
const HTML_ESC_REGEX = /[&<>"']/g;

function escapeHtml(str) {
  if (typeof str !== 'string') return str ? String(str) : '';
  return str.replace(HTML_ESC_REGEX, ch => HTML_ESC_MAP[ch]);
}

// Expose functions to global window scope for inline onclicks
window.openRoadmapModal = function() {
  window.location.href = '../frontend/page/leaderboard/index.html?action=roadmap';
};
window.switchProfileTab = switchProfileTab;
window.handleAdminLogin = handleAdminLogin;
window.exitAdminToProfile = exitAdminToProfile;
window.adminLogout = adminLogout;
window.switchAdminSubView = switchAdminSubView;
window.openCreateTaskModal = openCreateTaskModal;
window.openEditTaskModal = openEditTaskModal;
window.closeAdminTaskModal = closeAdminTaskModal;
window.handleTaskModalBackdropClick = handleTaskModalBackdropClick;
window.generateRandomTaskCode = generateRandomTaskCode;
window.handleSaveAdminTaskForm = handleSaveAdminTaskForm;
window.toggleTaskActive = toggleTaskActive;
window.deleteAdminTask = deleteAdminTask;
window.resetPlayerCooldowns = resetPlayerCooldowns;
window.handleAdminTaskSearch = handleAdminTaskSearch;
window.setEditUserAvatar = setEditUserAvatar;
window.openCreateUserModal = openCreateUserModal;
window.closeCreateUserModal = closeCreateUserModal;
window.handleSaveCreateUser = handleSaveCreateUser;
window.openEditUserModal = openEditUserModal;
window.closeAdminUserModal = closeAdminUserModal;
window.handleUserModalBackdropClick = handleUserModalBackdropClick;
window.handleSaveAdminUserForm = handleSaveAdminUserForm;
window.handleResetUserFromModal = handleResetUserFromModal;
window.handleDeleteUserFromModal = handleDeleteUserFromModal;
window.toggleUserActiveStatus = toggleUserActiveStatus;
window.quickAddUserCoins = quickAddUserCoins;
window.quickAwardAllPlayers = quickAwardAllPlayers;
window.handleAdminUserSearch = handleAdminUserSearch;
window.filterAdminWithdrawals = filterAdminWithdrawals;
window.approveWithdrawal = approveWithdrawal;
window.rejectWithdrawal = rejectWithdrawal;
window.adminResetLeaderboardSeason = adminResetLeaderboardSeason;


/**
 * Log action with timestamp into the Admin Log Console
 */
function logAdminAction(message) {
  const logBox = document.getElementById('adminLogBox');
  if (!logBox) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  logBox.innerHTML = `<div>[${timeStr}] ${message}</div>` + logBox.innerHTML;
}

/**
 * Refresh all live currency and game indicators on the profile & admin dashboard
 */
function updateAdminLiveDisplays() {
  const currentCoins = parseInt(localStorage.getItem('task_game_coins') || '0', 10);
  const currentStars = parseInt(localStorage.getItem('task_game_stars') || '0', 10);

  // Update top header and admin coins & stars
  const headerCoins = document.getElementById('profileCoinsDisplay');
  if (headerCoins) headerCoins.textContent = currentCoins.toLocaleString();

  const headerStars = document.getElementById('profileStarsDisplay');
  if (headerStars) headerStars.textContent = currentStars.toLocaleString();

  // Telegram Stars Rating - Suppressed per user request
  const ratingLevelEl = document.getElementById('tgProfileRatingLevel');
  const ratingSubEl = document.getElementById('tgProfileRatingSub');
  if (ratingLevelEl) ratingLevelEl.style.display = 'none';
  if (ratingSubEl) ratingSubEl.style.display = 'none';

  const userAvatar = document.querySelector('.user-avatar');
  if (userAvatar && !userAvatar.closest('#adminTopHeaderBar')) {
    userAvatar.innerHTML = getAdminUserAvatarImgHtml(localStorage.getItem('player_avatar') || 'avatar-1.png', 36);
  }

  const currentProfileUsername = localStorage.getItem('player_username') || localStorage.getItem('user_profile_name') || 'Player';
  const userName = document.querySelector('.user-name');
  if (userName && !userName.closest('#adminTopHeaderBar')) userName.textContent = currentProfileUsername;
  const headerUserName = document.getElementById('headerUserName');
  if (headerUserName) headerUserName.textContent = currentProfileUsername;
  const headerUserAvatar = document.getElementById('headerUserAvatar');
  if (headerUserAvatar) headerUserAvatar.innerHTML = getAdminUserAvatarImgHtml(localStorage.getItem('player_avatar') || 'avatar-1.png', 36);

  const adminCoins = document.getElementById('adminLiveCoins');
  if (adminCoins) adminCoins.textContent = `${currentCoins.toLocaleString()} 🪙`;

  const adminStars = document.getElementById('adminLiveStars');
  if (adminStars) adminStars.textContent = `${currentStars.toLocaleString()} ⭐`;


}

// -----------------------------------------------------------------------------
// Admin Currency Manipulation Functions
// -----------------------------------------------------------------------------

/**
 * Add specified amount of coins from input field
 */
function adminAddCoins() {
  const input = document.getElementById('inputCoinsAdjust');
  const amount = parseInt(input ? input.value : '0', 10);

  if (isNaN(amount) || amount === 0) {
    alert('Please enter a valid coin amount to add.');
    return;
  }

  let coins = parseInt(localStorage.getItem('task_game_coins') || localStorage.getItem('user_coins') || '0', 10);
  coins = Math.max(0, coins + amount);
  localStorage.setItem('task_game_coins', coins.toString());
  localStorage.setItem('user_coins', coins.toString());
  localStorage.setItem('task_game_coins_alt', coins.toString());
  try {
    const bc = new BroadcastChannel('balance_sync_channel');
    bc.postMessage({ type: 'BALANCE_UPDATED', coins });
    bc.close();
  } catch(e) {}
  window.dispatchEvent(new Event('balance:changed'));

  if (input) input.value = '';
  updateAdminLiveDisplays();
  logAdminAction(`Added ${amount.toLocaleString()} coins. New balance: ${coins.toLocaleString()} 🪙`);
}

/**
 * Set player coins directly to a specific value
 */
function adminSetCoins() {
  const input = document.getElementById('inputCoinsAdjust');
  const amount = parseInt(input ? input.value : '0', 10);

  if (isNaN(amount) || amount < 0) {
    alert('Please enter a valid non-negative coin amount.');
    return;
  }

  localStorage.setItem('task_game_coins', amount.toString());
  localStorage.setItem('user_coins', amount.toString());
  localStorage.setItem('task_game_coins_alt', amount.toString());
  try {
    const bc = new BroadcastChannel('balance_sync_channel');
    bc.postMessage({ type: 'BALANCE_UPDATED', coins: amount });
    bc.close();
  } catch(e) {}
  window.dispatchEvent(new Event('balance:changed'));
  if (input) input.value = '';
  updateAdminLiveDisplays();
  logAdminAction(`Coins set directly to: ${amount.toLocaleString()} 🪙`);
}

/**
 * Quick preset coin adjustments (+500, +2000, +10000, -500)
 */
function adminQuickCoins(amount) {
  let coins = parseInt(localStorage.getItem('task_game_coins') || localStorage.getItem('user_coins') || '0', 10);
  coins = Math.max(0, coins + amount);
  localStorage.setItem('task_game_coins', coins.toString());
  localStorage.setItem('user_coins', coins.toString());
  localStorage.setItem('task_game_coins_alt', coins.toString());
  try {
    const bc = new BroadcastChannel('balance_sync_channel');
    bc.postMessage({ type: 'BALANCE_UPDATED', coins });
    bc.close();
  } catch(e) {}
  window.dispatchEvent(new Event('balance:changed'));

  updateAdminLiveDisplays();
  const sign = amount > 0 ? `+${amount.toLocaleString()}` : `${amount.toLocaleString()}`;
  logAdminAction(`Quick adjustment: ${sign} coins. New balance: ${coins.toLocaleString()} 🪙`);
}

/**
 * Add stars to player profile
 */
function adminAddStars() {
  const input = document.getElementById('inputStarsAdjust');
  const amount = parseInt(input ? input.value : '0', 10);

  if (isNaN(amount) || amount === 0) {
    alert('Please enter a valid star amount.');
    return;
  }

  let stars = parseInt(localStorage.getItem('task_game_stars') || localStorage.getItem('user_stars') || '0', 10);
  stars = Math.max(0, stars + amount);
  localStorage.setItem('task_game_stars', stars.toString());
  localStorage.setItem('user_stars', stars.toString());
  try {
    const bc = new BroadcastChannel('balance_sync_channel');
    bc.postMessage({ type: 'BALANCE_UPDATED', stars });
    bc.close();
  } catch(e) {}
  window.dispatchEvent(new Event('balance:changed'));

  if (input) input.value = '';
  updateAdminLiveDisplays();
  logAdminAction(`Added ${amount} Stars. Total stars: ${stars} ⭐`);
}

// -----------------------------------------------------------------------------
// Real-time Cloud Data Synchronization for Admin Dashboard
// -----------------------------------------------------------------------------

let _lastAdminTasksSig = '';

function initAdminCloudListeners() {
  // 0. Real-time Tasks Listener from Firestore + RTDB (syncs edits/deletes live across Admin, Editor & Home)
  const listenTasks = (window.Firebase && window.Firebase.listenToCloudTasks) || window.listenToCloudTasks;
  if (typeof listenTasks === 'function') {
    listenTasks((cloudTasks) => {
      if (!Array.isArray(cloudTasks)) return;
      const cleanList = cloudTasks.filter(t => t && t.id && !t.isDemo && !String(t.id || '').toLowerCase().includes('demo'));
      const sig = JSON.stringify(cleanList);
      if (sig === _lastAdminTasksSig && JSON.stringify(tasksData) === sig) return;
      _lastAdminTasksSig = sig;
      tasksData = cleanList;
      try {
        localStorage.setItem(TASKS_STORAGE_KEY, sig);
        localStorage.setItem('admin_tasks', sig);
      } catch (e) {}
      refreshOpenAdminTaskViewsLive();
    });
  }

  // 1. Real-time Scalable Users Listener (Handles 10,000+ players with lightweight O(N) signature & cache cap)
  const listenUsers = (window.Firebase && window.Firebase.listenToCloudUsers) || window.listenToCloudUsers;
  if (typeof listenUsers === 'function') {
    listenUsers((cloudUsers) => {
      if (Array.isArray(cloudUsers)) {
        const mapped = [];
        let cSum = 0;
        let sSum = 0;
        let tSum = 0;
        let uMax = 0;
        for (let i = 0; i < cloudUsers.length; i++) {
          const u = cloudUsers[i];
          if (!u || typeof u !== 'object' || isDemoUser(u)) continue;
          const uid = String(u.id || u.uid || '');
          if (!uid) continue;
          const coins = typeof u.coins === 'number' ? u.coins : (parseInt(u.coins || '0', 10) || 0);
          const stars = typeof u.stars === 'number' ? u.stars : (parseInt(u.stars || '0', 10) || 0);
          const tickets = typeof u.tickets === 'number' ? u.tickets : (parseInt(u.tickets || '0', 10) || 0);
          const upd = Number(u.updatedAt || u.lastActive || 0) || 0;
          cSum += coins;
          sSum += stars;
          tSum += tickets;
          if (upd > uMax) uMax = upd;
          mapped.push({
            id: uid,
            name: u.displayName || u.name || 'Player',
            displayName: u.displayName || u.name || 'Player',
            username: u.username || '',
            email: u.email || '',
            avatar: u.avatar || 'avatar-1.png',
            role: u.role === 'vip' ? 'vip' : 'player',
            level: u.level || 'LVL 1 • NOVICE',
            coins,
            stars,
            tickets,
            diamonds: typeof u.diamonds === 'number' ? u.diamonds : (parseInt(u.diamonds || '0', 10) || 0),
            passLevel: typeof u.passLevel === 'number' ? u.passLevel : (parseInt(u.passLevel || '0', 10) || 0),
            eventTasks: parseInt(u.eventTasks || '0', 10) || 0,
            totalTasks: parseInt(u.tasksCompleted ?? u.totalTasks ?? '0', 10) || 0,
            adsWatched: parseInt(u.adsWatched || '0', 10) || 0,
            status: u.status || 'active',
            updatedAt: upd,
            joined: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active',
            lastActive: u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'Recently'
          });
        }
        const firstId = mapped[0] ? mapped[0].id : '';
        const lastId = mapped[mapped.length - 1] ? mapped[mapped.length - 1].id : '';
        const nextSig = `${mapped.length}:${cSum}:${sSum}:${tSum}:${uMax}:${firstId}:${lastId}`;
        if (nextSig !== _lastAdminUsersSig && mapped.length > 0) {
          _lastAdminUsersSig = nextSig;
          usersData = mapped;
          if (window.Firebase && typeof window.Firebase.cacheCompactUsersSummary === 'function') {
            window.Firebase.cacheCompactUsersSummary(usersData);
          } else {
            try { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersData.slice(0, 150))); } catch (e) {}
          }
          renderAdminUsersList();
        }
      }
    });
  }

  // 2. Real-time Withdrawals / Requests Listener from Firestore (withdrawals collection)
  const listenWds = (window.Firebase && window.Firebase.listenToCloudWithdrawals) || window.listenToCloudWithdrawals;
  if (typeof listenWds === 'function') {
    listenWds((cloudWds) => {
      if (Array.isArray(cloudWds)) {
        const mappedWds = cloudWds
          .filter(w => w && !w.isDemo && !String(w.id || '').toLowerCase().includes('demo'))
          .map(w => ({
            ...w,
            id: w.id,
            userId: w.userId,
            playerName: w.playerName || w.userName || 'Player',
            playerAvatar: w.playerAvatar || '⚡',
            amount: w.amount !== undefined ? w.amount : (w.rsAmount !== undefined ? w.rsAmount : 100),
            starCost: w.starCost !== undefined ? w.starCost : (w.stars || 0),
            method: w.method || w.title || 'Amazon Gift Card',
            contactInfo: w.contactInfo || w.userEmail || w.userWhatsapp || w.whatsapp || '',
            contactType: w.contactType || (String(w.contactInfo || w.userEmail || '').includes('@') ? 'email' : 'mobile'),
            details: w.details || w.voucherCode || 'Voucher Claim',
            deliveryLink: w.deliveryLink || w.link || '',
            deliveryStatus: w.deliveryStatus || (w.status === 'rejected' ? 'Rejected' : 'Processing (Up to 10 Days)'),
            status: w.status || 'pending',
            createdAt: w.createdAt || w.timestamp || Date.now(),
            time: w.time || (w.createdAt ? new Date(w.createdAt).toLocaleString() : 'Recently')
          }));
        const nextWdSig = JSON.stringify(mappedWds.map(w => [w.id, w.status, w.deliveryStatus, w.deliveryLink]));
        if (nextWdSig !== _lastAdminWdsSig) {
          _lastAdminWdsSig = nextWdSig;
          withdrawalsData = mappedWds;
          localStorage.setItem(WITHDRAW_STORAGE_KEY, JSON.stringify(withdrawalsData));
          renderAdminWithdrawalsList();
        }
      }
    });
  }

  // 3. Real-time Player Feedback & Support Ticket Listener from Firestore + RTDB (feedbacks)
  const listenFbs = (window.Firebase && window.Firebase.listenToCloudFeedbacks) || window.listenToCloudFeedbacks;
  if (typeof listenFbs === 'function') {
    if (typeof window._adminFeedbackCloudUnsub === 'function') {
      try { window._adminFeedbackCloudUnsub(); } catch (e) {}
    }
    window._adminFeedbackCloudUnsub = listenFbs((cloudFeedbacks) => {
      if (Array.isArray(cloudFeedbacks)) {
        renderAdminFeedbackList();
      }
    });
  }
}
window.initAdminCloudListeners = initAdminCloudListeners;

// -----------------------------------------------------------------------------
// DOM Ready Lifecycle Initialization (Standalone Admin Portal)
// -----------------------------------------------------------------------------
window.addEventListener('firebase:ready', () => { initAdminCloudListeners(); });
document.addEventListener('DOMContentLoaded', () => {
  initAdminCloudListeners();
  updateAdminLiveDisplays();
  switchProfileTab('admin');
});

function showToast(msg, duration = 2500) {
  const toast = document.getElementById('profileToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}


// -----------------------------------------------------------------------------
// SESSION-WISE LEADERBOARD DATA STORE & ARCHIVE (PROFILE ADMIN)
// -----------------------------------------------------------------------------

function getProfileRankStars(rank) {
  if (rank === 1) return 10000;
  if (rank === 2) return 5000;
  if (rank >= 3 && rank <= 5) return 1000;
  if (rank >= 6 && rank <= 10) return 500;
  if (rank >= 11 && rank <= 20) return 100;
  return 0;
}

function getStoredProfileSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch(e) {
    return [];
  }
}

function renderProfileSessionHistory(filterId = 'all') {
  const container = document.getElementById('profileSessionHistoryContainer');
  if (!container) return;

  const sessions = getStoredProfileSessions();

  // Populate filter dropdown
  const filterSelect = document.getElementById('profileSessionFilterSelect');
  if (filterSelect) {
    const cur = filterSelect.value || 'all';
    filterSelect.innerHTML = '<option value="all">All Sessions (' + sessions.length + ')</option>' +
      sessions.map(s => `<option value="${escapeHtml(s.id)}" ${cur === s.id ? 'selected' : ''}>${escapeHtml(s.name || ('Session ' + s.sessionNumber))}</option>`).join('');
  }

  let list = [...sessions];
  if (filterId !== 'all') {
    list = list.filter(s => s.id === filterId);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 1.25rem 0.5rem; background: rgba(6, 14, 36, 0.6); border: 1px dashed rgba(56, 189, 248, 0.25); border-radius: 10px; color: #94a3b8; font-size: 0.75rem;">
        No historical sessions archived yet. Click "Archive Current Session" above to store session rankings.
      </div>`;
    return;
  }

  container.innerHTML = list.map(session => {
    const standings = session.standings || [];
    const topWinner = session.topWinner || standings[0];
    const sDate = session.startTime ? new Date(session.startTime).toLocaleDateString() : 'N/A';
    const eDate = session.endTime ? new Date(session.endTime).toLocaleDateString() : 'N/A';

    return `
      <div style="background: rgba(6, 14, 36, 0.85); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 10px; margin-bottom: 0.75rem; padding: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
          <div style="font-size: 0.82rem; font-weight: 800; color: #ffffff;">${escapeHtml(session.name || ('Session ' + session.sessionNumber))}</div>
          <span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 8px; background: rgba(52, 211, 153, 0.15); color: #34d399; font-weight: 800;">Archived</span>
        </div>
        <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 0.5rem;">
          ${sDate} - ${eDate} • ${session.totalContenders || standings.length} Contenders • ${Number(session.totalTasksCompleted || 0).toLocaleString()} Tasks
        </div>
        ${topWinner ? `
        <div style="background: rgba(250, 204, 21, 0.1); border-radius: 6px; padding: 4px 8px; font-size: 0.72rem; color: #fef08a; font-weight: 800; margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
          <span>🥇 Winner: ${escapeHtml(topWinner.name)} (${topWinner.eventTasks || 0} Tasks)</span>
          <span style="color: #facc15;">+${Number(topWinner.starReward || 10000).toLocaleString()} ⭐</span>
        </div>` : ''}
        <div style="max-height: 140px; overflow-y: auto;">
          ${standings.map(st => `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <span style="color: #ffffff;"><b style="color: #38bdf8;">#${st.rank}</b> ${escapeHtml(st.name)}</span>
              <span style="color: #facc15; font-weight: 700;">${st.eventTasks || 0} Tasks (+ ${Number(st.starReward || 0).toLocaleString()} ⭐)</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }).join('');
}

function filterProfileSessionHistory(sessionId) {
  renderProfileSessionHistory(sessionId);
}

function adminArchiveProfileSession() {
  const evt = getLeaderboardEventState();
  const qualified = usersData
    .filter(u => Number(u.totalTasks || 0) >= 100)
    .sort((a, b) => (Number(b.eventTasks || 0)) - (Number(a.eventTasks || 0)));

  const sessionNum = evt.seasonNumber || 1;
  const sessionName = evt.name || `Season ${sessionNum}: 3-Month Championship`;

  if (!confirm(`Conclude & Archive "${sessionName}"?\n\n• Captures all ${qualified.length} qualified contenders and saves full rankings to the session-wise store.\n• Event tasks counter will reset to 0 for Season ${sessionNum + 1}.\n• Ready to proceed?`)) {
    return;
  }

  const now = Date.now();
  const standings = qualified.map((u, idx) => {
    const rank = idx + 1;
    const starReward = getProfileRankStars(rank);
    return {
      rank,
      id: u.id || `usr_${idx}`,
      name: u.name || 'Anonymous',
      avatar: u.avatar || '⚡',
      eventTasks: Number(u.eventTasks || 0),
      totalTasks: Number(u.totalTasks || 0),
      starReward
    };
  });

  const totalTasks = standings.reduce((sum, s) => sum + s.eventTasks, 0);
  const totalStars = standings.reduce((sum, s) => sum + s.starReward, 0);

  const archivedSession = {
    id: `session_${sessionNum}_${now}`,
    sessionNumber: sessionNum,
    name: sessionName,
    startTime: evt.startTime || (now - (90 * 24 * 60 * 60 * 1000)),
    endTime: now,
    archivedAt: now,
    status: 'concluded',
    totalContenders: standings.length,
    totalTasksCompleted: totalTasks,
    totalStarsAwarded: totalStars,
    topWinner: standings[0] || null,
    standings
  };

  const sessions = getStoredProfileSessions();
  sessions.unshift(archivedSession);

  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    if (window.Firebase && typeof window.Firebase.saveLeaderboardSessionsToCloud === 'function') {
      window.Firebase.saveLeaderboardSessionsToCloud(sessions);
    }
    const bc = new BroadcastChannel('nova_task_sync');
    bc.postMessage({ type: 'SESSIONS_UPDATED', timestamp: now });
    bc.close();
  } catch(e) {}

  // Reset users' eventTasks
  usersData.forEach(u => { u.eventTasks = 0; });
  saveUsersAndSync();

  // Advance season
  const THREE_MONTHS_HOURS = 2160;
  const THREE_MONTHS_DAYS = 90;
  const THREE_MONTHS_MS = THREE_MONTHS_HOURS * 60 * 60 * 1000;
  const nextSeasonNum = sessionNum + 1;
  const nextEvt = {
    id: `global_season_${nextSeasonNum}`,
    seasonNumber: nextSeasonNum,
    name: `Season ${nextSeasonNum}: 3-Month Championship`,
    startTime: now,
    endTime: now + THREE_MONTHS_MS,
    durationHours: THREE_MONTHS_HOURS,
    durationDays: THREE_MONTHS_DAYS,
    status: 'active',
    isGlobal: true,
    isManualOverride: true
  };
  localStorage.setItem(UNIFIED_EVENT_KEY, JSON.stringify(nextEvt));
  localStorage.removeItem('task_leaderboard_event_v1');
  localStorage.setItem(SYNC_FLAG_KEY, now.toString());

  try {
    if (window.Firebase && typeof window.Firebase.saveGlobalLeaderboardEventToCloud === 'function') {
      window.Firebase.saveGlobalLeaderboardEventToCloud(nextEvt);
    }
    const bc = new BroadcastChannel('nova_task_sync');
    bc.postMessage({ type: 'EVENT_RESTART', event: nextEvt, timestamp: now });
    bc.close();
  } catch(e) {}

  renderAdminEventSection();
  showToast(`🏆 ${sessionName} archived! Season ${nextSeasonNum} is now live.`);
}

window.adminArchiveProfileSession = adminArchiveProfileSession;
window.filterProfileSessionHistory = filterProfileSessionHistory;
window.renderProfileSessionHistory = renderProfileSessionHistory;


async function directResetUser(userId) {
  const user = usersData.find(u => u.id === userId);
  if (!user) return;

  const userName = user.name || user.username || userId;
  const msg = `⚠️ RESET ALL USER DATA FOR: "${userName}" (${userId})?\n\nThis will permanently reset:\n• Coins, Stars, Tickets, Diamonds: 0\n• Pass Level, VIP Pass, Streaks & Claims: 0\n• Tasks & Event missions: 0\n\nThis cannot be undone. Proceed?`;
  if (!confirm(msg)) return;

  await resetUserLocalAndCloudState(userId, user);
  saveUsersAndSync();
  renderAdminUsersList();
  showToast(`🔄 All data for player "${userName}" has been reset to zero! ✓`, 3500);
}

async function directDeleteUser(userId) {
  const user = usersData.find(u => u.id === userId);
  if (!user) return;

  const userName = user.name || user.username || userId;
  if (!confirm(`Are you sure you want to permanently delete player "${userName}"?\n\nThis will remove the player record and all data from Firebase.`)) {
    return;
  }

  const deletedCopy = { ...user };
  usersData = usersData.filter(u => u.id !== userId);
  await purgeDeletedUserLocalState(userId, deletedCopy);

  saveUsersAndSync();
  renderAdminUsersList();
  showToast(`🗑️ Player "${userName}" deleted successfully.`);
}

window.directResetUser = directResetUser;
window.directDeleteUser = directDeleteUser;
if (typeof startAdminEventTimer === 'function') {
  startAdminEventTimer();
}


window.updateProfilePackageTotalPrice = function() {
  const p1 = parseInt(document.getElementById('profileEventTask1Price')?.value || '500', 10) || 0;
  const p2 = parseInt(document.getElementById('profileEventTask2Price')?.value || '250', 10) || 0;
  const p3 = parseInt(document.getElementById('profileEventTask3Price')?.value || '250', 10) || 0;
  const total = p1 + p2 + p3;
  const label = document.getElementById('profilePackageTotalBountyLabel');
  if (label) label.textContent = total.toLocaleString() + ' Coins';
};

window.handleAdminTaskCategoryChange = function(val) {
  const builder = document.getElementById('profileEventPackBuilder');
  const levelGroup = document.getElementById('profileTaskLevelGroup');
  const singleUrlGroup = document.getElementById('taskSingleUrlGroup');
  const singleCodeGroup = document.getElementById('taskSingleSecretGroup');

  if (val === 'event') {
    if (builder) builder.style.display = 'block';
    if (levelGroup) levelGroup.style.display = 'none';
  } else {
    if (builder) builder.style.display = 'none';
    if (levelGroup) levelGroup.style.display = 'block';
  }
};



// ============================================================================
// ADMIN EVENT PAGE: PRO TASKS & PASS MULTI-TAB CONTROLLER (DETAIL & EDIT)
// ============================================================================

let currentAdminEventTab = 'pass';

const PRO_EVENT_SETTINGS_KEY = 'task_game_pro_event_settings';
const PASS_CONFIG_STORAGE_KEY = 'task_pass_config';

function getStoredProEventSettings() {
  try {
    const raw = localStorage.getItem(PRO_EVENT_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return {
    active: true,
    durationHours: 48,
    packageCoinCost: 50,
    packageTicketCost: 2,
    startTime: Date.now() - 3600000,
    endTime: Date.now() + 48 * 3600000,
    tasks: [
      {
        id: "task_pro_1",
        title: "Mission 1: Promo Signup",
        category: "pro",
        rewardCoins: 500,
        reward: 500,
        coins: 500,
        url: "https://youtube.com",
        link: "https://youtube.com",
        verificationCode: "583921",
        code: "583921",
        secretCode: "583921",
        description: "First mission of 3-task package (Half price awarded here!)",
        isPackagePart: true,
        packagePartIndex: 1,
        active: true
      },
      {
        id: "task_pro_2",
        title: "Mission 2: Community Join",
        category: "pro",
        rewardCoins: 250,
        reward: 250,
        coins: 250,
        url: "https://telegram.org",
        link: "https://telegram.org",
        verificationCode: "749201",
        code: "749201",
        secretCode: "749201",
        description: "Second mission of 3-task package",
        isPackagePart: true,
        packagePartIndex: 2,
        active: true
      },
      {
        id: "task_pro_3",
        title: "Mission 3: Survey Bonus",
        category: "pro",
        rewardCoins: 250,
        reward: 250,
        coins: 250,
        url: "https://google.com",
        link: "https://google.com",
        verificationCode: "382910",
        code: "382910",
        secretCode: "382910",
        description: "Third mission of 3-task package (Full package completion bounty!)",
        isPackagePart: true,
        packagePartIndex: 3,
        active: true
      }
    ]
  };
}

function saveProEventSettings(settings) {
  try {
    localStorage.setItem(PRO_EVENT_SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(SYNC_FLAG_KEY, Date.now().toString());

    if (settings.tasks && Array.isArray(settings.tasks)) {
      settings.tasks.forEach(pt => {
        const idx = tasksData.findIndex(t => t.id === pt.id);
        if (idx !== -1) {
          tasksData[idx] = { ...tasksData[idx], ...pt };
        } else {
          tasksData.push(pt);
        }
      });
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasksData));
      localStorage.setItem('admin_tasks', JSON.stringify(tasksData));
    }

    try {
      const bc = new BroadcastChannel('nova_task_sync');
      bc.postMessage({ type: 'PRO_EVENT_UPDATED', settings, timestamp: Date.now() });
      bc.postMessage({ type: 'TASKS_UPDATED', timestamp: Date.now() });
      bc.close();
    } catch(e) {}
  } catch(e) {
    console.error('Error saving pro event settings:', e);
  }
}

function getStoredPassConfig() {
  try {
    const raw = localStorage.getItem(PASS_CONFIG_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return {
    seasonName: "Season 6: Light the Fuse",
    durationDays: 21,
    totalLevels: 500,
    tasksPerLevel: 1,
    milestoneLevel: 10,
    milestoneRewardType: "stars",
    milestoneRewardAmount: 100,
    passActivated: localStorage.getItem("season_6_pass_activated") === "true"
  };
}

function savePassConfig(config) {
  try {
    localStorage.setItem(PASS_CONFIG_STORAGE_KEY, JSON.stringify(config));
    if (config.passActivated !== undefined) {
      localStorage.setItem("season_6_pass_activated", config.passActivated ? "true" : "false");
    }
    localStorage.setItem(SYNC_FLAG_KEY, Date.now().toString());
    try {
      const bc = new BroadcastChannel('nova_task_sync');
      bc.postMessage({ type: 'PASS_CONFIG_UPDATED', config, timestamp: Date.now() });
      bc.close();
    } catch(e) {}
  } catch(e) {
    console.error('Error saving pass config:', e);
  }
}

function normalizeAdminEventTab(tabKey) {
  const key = String(tabKey || '').trim().toLowerCase();
  if (key === 'pro' || key === 'settings') return 'settings';
  if (key === 'season') return 'season';
  if (key === 'support' || key === 'feedback') return 'support';
  return 'pass';
}

function syncAdminEventTabVisibility(tabKey) {
  const activeTab = normalizeAdminEventTab(tabKey || currentAdminEventTab);
  currentAdminEventTab = activeTab;

  const tabs = [
    { key: 'pass', btnId: 'btnEventTabPass' },
    { key: 'settings', btnId: 'btnEventTabSettings' },
    { key: 'season', btnId: 'btnEventTabSeason' },
    { key: 'support', btnId: 'btnEventTabSupport' }
  ];

  tabs.forEach(({ key, btnId }) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const isActive = activeTab === key;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  const panelPass = document.getElementById('adminEventPanelPass');
  const panelPassMilestones = document.getElementById('adminEventPanelPassMilestones');
  const panelSettings = document.getElementById('adminEventPanelSettings');
  const panelSeason = document.getElementById('adminEventPanelSeason');
  const panelSupport = document.getElementById('adminEventPanelSupport');

  if (panelPass) panelPass.style.display = activeTab === 'pass' ? 'block' : 'none';
  if (panelPassMilestones) panelPassMilestones.style.display = activeTab === 'pass' ? 'block' : 'none';
  if (panelSettings) panelSettings.style.display = activeTab === 'settings' ? 'block' : 'none';
  if (panelSeason) panelSeason.style.display = activeTab === 'season' ? 'block' : 'none';
  if (panelSupport) panelSupport.style.display = activeTab === 'support' ? 'block' : 'none';

  return activeTab;
}

function switchAdminEventTab(tabKey) {
  const rawKey = String(tabKey || '').trim().toLowerCase();
  const activeTab = syncAdminEventTabVisibility(rawKey);

  if (activeTab === 'pass') {
    if (typeof renderAdminPassPanel === 'function') renderAdminPassPanel();
  } else if (activeTab === 'settings') {
    if (typeof loadAdminAppSettingsUI === 'function') loadAdminAppSettingsUI();
    if (rawKey === 'pro' && typeof filterAdminEventSettings === 'function') {
      filterAdminEventSettings('pro');
    }
  } else if (activeTab === 'season') {
    if (typeof startAdminEventTimer === 'function') startAdminEventTimer();
    renderAdminEventContenders();
    renderProfileSessionHistory();
  } else if (activeTab === 'support') {
    if (typeof renderAdminFeedbackList === 'function') renderAdminFeedbackList();
  }
}
window.syncAdminEventTabVisibility = syncAdminEventTabVisibility;
window.switchAdminEventTab = switchAdminEventTab;

function renderAdminProTasksPanel() {
  const settings = getStoredProEventSettings();
  
  const badge = document.getElementById('proEventStatusBadge');
  const toggleBtn = document.getElementById('labelToggleProEvent');
  if (badge) {
    if (settings.active) {
      badge.textContent = '● EVENT ACTIVE';
      badge.style.background = 'rgba(16, 185, 129, 0.2)';
      badge.style.color = '#34d399';
      badge.style.borderColor = 'rgba(52, 211, 153, 0.5)';
      if (toggleBtn) toggleBtn.textContent = 'Turn Off ⏸️';
    } else {
      badge.textContent = '○ EVENT OFF';
      badge.style.background = 'rgba(239, 68, 68, 0.2)';
      badge.style.color = '#f87171';
      badge.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      if (toggleBtn) toggleBtn.textContent = 'Turn On ▶️';
    }
  }

  const timerEl = document.getElementById('proDetailTimerText');
  if (timerEl) timerEl.textContent = `⏱️ ${settings.durationHours || 48}H 00M`;

  const costEl = document.getElementById('proDetailCostText');
  if (costEl) costEl.textContent = `🪙 ${settings.packageCoinCost || 50} + 🎟️ ${settings.packageTicketCost || 2}`;

  const tasks = settings.tasks || [];
  const t1 = tasks[0] || { title: 'Mission 1: Promo Signup', rewardCoins: 500, url: 'https://youtube.com', verificationCode: '583921' };
  const t2 = tasks[1] || { title: 'Mission 2: Community Join', rewardCoins: 250, url: 'https://telegram.org', verificationCode: '749201' };
  const t3 = tasks[2] || { title: 'Mission 3: Survey Bonus', rewardCoins: 250, url: 'https://google.com', verificationCode: '382910' };

  const totalBounty = (Number(t1.rewardCoins || t1.reward || 500)) + 
                      (Number(t2.rewardCoins || t2.reward || 250)) + 
                      (Number(t3.rewardCoins || t3.reward || 250));

  const bountyEl = document.getElementById('proDetailBountyText');
  if (bountyEl) bountyEl.textContent = `🪙 ${totalBounty.toLocaleString()}`;

  const listContainer = document.getElementById('proTasksDetailList');
  if (listContainer) {
    listContainer.innerHTML = `
      <!-- Sub-Task 1 Card -->
      <div class="pro-subtask-card" style="border-left: 4px solid #facc15;">
        <div class="pro-subtask-info">
          <div class="pro-subtask-title-row">
            <span class="pro-subtask-badge half-bounty">🎁 1 of 3 • Half Price Award (50%)</span>
            <span style="font-weight: 800; color: #ffffff; font-size: 0.88rem;">${escapeHtml(t1.title)}</span>
          </div>
          <div style="font-size: 0.72rem; color: #94a3b8; display: flex; gap: 8px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
            <span>Reward: <b style="color: #fbbf24; font-size: 0.82rem;">🪙 ${t1.rewardCoins || t1.reward || 500} Coins</b> (Wins 50% = 500 Coins on this task!)</span>
            <span>&bull;</span>
            <span>Secret Code: <b style="color: #facc15; font-family: monospace;">${t1.verificationCode || t1.code || '583921'}</b></span>
          </div>
          <div style="font-size: 0.7rem; color: #38bdf8; margin-top: 3px; word-break: break-all;">
            Target URL: <a href="${t1.url || t1.link || '#'}" target="_blank" style="color: #38bdf8; text-decoration: underline;">${t1.url || t1.link || 'https://youtube.com'}</a>
          </div>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.7rem; color: #7dd3fc; font-weight: 800;">
            Task #1
          </span>
        </div>
      </div>

      <!-- Sub-Task 2 Card -->
      <div class="pro-subtask-card" style="border-left: 4px solid #34d399;">
        <div class="pro-subtask-info">
          <div class="pro-subtask-title-row">
            <span class="pro-subtask-badge">⚡ 2 of 3 • Mid Mission</span>
            <span style="font-weight: 800; color: #ffffff; font-size: 0.88rem;">${escapeHtml(t2.title)}</span>
          </div>
          <div style="font-size: 0.72rem; color: #94a3b8; display: flex; gap: 8px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
            <span>Reward: <b style="color: #fbbf24; font-size: 0.82rem;">🪙 ${t2.rewardCoins || t2.reward || 250} Coins</b></span>
            <span>&bull;</span>
            <span>Secret Code: <b style="color: #facc15; font-family: monospace;">${t2.verificationCode || t2.code || '749201'}</b></span>
          </div>
          <div style="font-size: 0.7rem; color: #38bdf8; margin-top: 3px; word-break: break-all;">
            Target URL: <a href="${t2.url || t2.link || '#'}" target="_blank" style="color: #38bdf8; text-decoration: underline;">${t2.url || t2.link || 'https://telegram.org'}</a>
          </div>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.7rem; color: #7dd3fc; font-weight: 800;">
            Task #2
          </span>
        </div>
      </div>

      <!-- Sub-Task 3 Card -->
      <div class="pro-subtask-card" style="border-left: 4px solid #a855f7;">
        <div class="pro-subtask-info">
          <div class="pro-subtask-title-row">
            <span class="pro-subtask-badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc;">🏆 3 of 3 • Full Package Completion Bounty</span>
            <span style="font-weight: 800; color: #ffffff; font-size: 0.88rem;">${escapeHtml(t3.title)}</span>
          </div>
          <div style="font-size: 0.72rem; color: #94a3b8; display: flex; gap: 8px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
            <span>Reward: <b style="color: #fbbf24; font-size: 0.82rem;">🪙 ${t3.rewardCoins || t3.reward || 250} Coins</b> (Wins Full Total Package Bounty!)</span>
            <span>&bull;</span>
            <span>Secret Code: <b style="color: #facc15; font-family: monospace;">${t3.verificationCode || t3.code || '382910'}</b></span>
          </div>
          <div style="font-size: 0.7rem; color: #38bdf8; margin-top: 3px; word-break: break-all;">
            Target URL: <a href="${t3.url || t3.link || '#'}" target="_blank" style="color: #38bdf8; text-decoration: underline;">${t3.url || t3.link || 'https://google.com'}</a>
          </div>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.4); font-size: 0.7rem; color: #c084fc; font-weight: 800;">
            Task #3
          </span>
        </div>
      </div>
    `;
  }
}

function toggleProEventActive() {
  const settings = getStoredProEventSettings();
  settings.active = !settings.active;
  saveProEventSettings(settings);
  renderAdminProTasksPanel();
  showToast(settings.active ? '● Pro Event Activated!' : '○ Pro Event Turned Off!');
}

function openEditProTasksModal() {
  const settings = getStoredProEventSettings();
  const tasks = settings.tasks || [];
  const t1 = tasks[0] || {};
  const t2 = tasks[1] || {};
  const t3 = tasks[2] || {};

  const durEl = document.getElementById('editProEventDuration');
  if (durEl) durEl.value = settings.durationHours || 48;
  const coinCostEl = document.getElementById('editProPackageCoinCost');
  if (coinCostEl) coinCostEl.value = settings.packageCoinCost || 50;
  const ticketCostEl = document.getElementById('editProPackageTicketCost');
  if (ticketCostEl) ticketCostEl.value = settings.packageTicketCost || 2;
  const activeToggle = document.getElementById('editProEventActiveToggle');
  if (activeToggle) activeToggle.checked = (settings.active !== false);

  const t1Title = document.getElementById('editProTask1Title');
  if (t1Title) t1Title.value = t1.title || 'Mission 1: Promo Signup';
  const t1Price = document.getElementById('editProTask1Price');
  if (t1Price) t1Price.value = t1.rewardCoins || t1.reward || 500;
  const t1Url = document.getElementById('editProTask1Url');
  if (t1Url) t1Url.value = t1.url || t1.link || 'https://youtube.com';
  const t1Code = document.getElementById('editProTask1Code');
  if (t1Code) t1Code.value = t1.verificationCode || t1.code || '583921';

  const t2Title = document.getElementById('editProTask2Title');
  if (t2Title) t2Title.value = t2.title || 'Mission 2: Community Join';
  const t2Price = document.getElementById('editProTask2Price');
  if (t2Price) t2Price.value = t2.rewardCoins || t2.reward || 250;
  const t2Url = document.getElementById('editProTask2Url');
  if (t2Url) t2Url.value = t2.url || t2.link || 'https://telegram.org';
  const t2Code = document.getElementById('editProTask2Code');
  if (t2Code) t2Code.value = t2.verificationCode || t2.code || '749201';

  const t3Title = document.getElementById('editProTask3Title');
  if (t3Title) t3Title.value = t3.title || 'Mission 3: Survey Bonus';
  const t3Price = document.getElementById('editProTask3Price');
  if (t3Price) t3Price.value = t3.rewardCoins || t3.reward || 250;
  const t3Url = document.getElementById('editProTask3Url');
  if (t3Url) t3Url.value = t3.url || t3.link || 'https://google.com';
  const t3Code = document.getElementById('editProTask3Code');
  if (t3Code) t3Code.value = t3.verificationCode || t3.code || '382910';

  updateEditProBountyPreview();
  const modal = document.getElementById('adminProTaskEditModalOverlay');
  if (modal) modal.style.display = 'flex';
}

function closeEditProTasksModal() {
  const modal = document.getElementById('adminProTaskEditModalOverlay');
  if (modal) modal.style.display = 'none';
}

function updateEditProBountyPreview() {
  const p1 = parseInt(document.getElementById('editProTask1Price')?.value || '500', 10) || 0;
  const p2 = parseInt(document.getElementById('editProTask2Price')?.value || '250', 10) || 0;
  const p3 = parseInt(document.getElementById('editProTask3Price')?.value || '250', 10) || 0;
  const total = p1 + p2 + p3;
  const label = document.getElementById('editProTotalBountyPreview');
  if (label) label.textContent = `Total: ${total.toLocaleString()} Coins`;
}

function handleSaveProTasksForm(e) {
  if (e && e.preventDefault) e.preventDefault();

  const durationHours = parseInt(document.getElementById('editProEventDuration')?.value || '48', 10);
  const packageCoinCost = parseInt(document.getElementById('editProPackageCoinCost')?.value || '50', 10);
  const packageTicketCost = parseInt(document.getElementById('editProPackageTicketCost')?.value || '2', 10);
  const isActive = document.getElementById('editProEventActiveToggle')?.checked ?? true;

  const t1 = {
    id: "task_pro_1",
    title: document.getElementById('editProTask1Title')?.value.trim() || 'Mission 1: Promo Signup',
    category: "pro",
    rewardCoins: parseInt(document.getElementById('editProTask1Price')?.value || '500', 10),
    reward: parseInt(document.getElementById('editProTask1Price')?.value || '500', 10),
    coins: parseInt(document.getElementById('editProTask1Price')?.value || '500', 10),
    url: document.getElementById('editProTask1Url')?.value.trim() || 'https://youtube.com',
    link: document.getElementById('editProTask1Url')?.value.trim() || 'https://youtube.com',
    verificationCode: document.getElementById('editProTask1Code')?.value.trim() || '583921',
    code: document.getElementById('editProTask1Code')?.value.trim() || '583921',
    secretCode: document.getElementById('editProTask1Code')?.value.trim() || '583921',
    description: "First mission of 3-task package (Half price awarded here!)",
    isPackagePart: true,
    packagePartIndex: 1,
    active: isActive
  };

  const t2 = {
    id: "task_pro_2",
    title: document.getElementById('editProTask2Title')?.value.trim() || 'Mission 2: Community Join',
    category: "pro",
    rewardCoins: parseInt(document.getElementById('editProTask2Price')?.value || '250', 10),
    reward: parseInt(document.getElementById('editProTask2Price')?.value || '250', 10),
    coins: parseInt(document.getElementById('editProTask2Price')?.value || '250', 10),
    url: document.getElementById('editProTask2Url')?.value.trim() || 'https://telegram.org',
    link: document.getElementById('editProTask2Url')?.value.trim() || 'https://telegram.org',
    verificationCode: document.getElementById('editProTask2Code')?.value.trim() || '749201',
    code: document.getElementById('editProTask2Code')?.value.trim() || '749201',
    secretCode: document.getElementById('editProTask2Code')?.value.trim() || '749201',
    description: "Second mission of 3-task package",
    isPackagePart: true,
    packagePartIndex: 2,
    active: isActive
  };

  const t3 = {
    id: "task_pro_3",
    title: document.getElementById('editProTask3Title')?.value.trim() || 'Mission 3: Survey Bonus',
    category: "pro",
    rewardCoins: parseInt(document.getElementById('editProTask3Price')?.value || '250', 10),
    reward: parseInt(document.getElementById('editProTask3Price')?.value || '250', 10),
    coins: parseInt(document.getElementById('editProTask3Price')?.value || '250', 10),
    url: document.getElementById('editProTask3Url')?.value.trim() || 'https://google.com',
    link: document.getElementById('editProTask3Url')?.value.trim() || 'https://google.com',
    verificationCode: document.getElementById('editProTask3Code')?.value.trim() || '382910',
    code: document.getElementById('editProTask3Code')?.value.trim() || '382910',
    secretCode: document.getElementById('editProTask3Code')?.value.trim() || '382910',
    description: "Third mission of 3-task package (Full package completion bounty!)",
    isPackagePart: true,
    packagePartIndex: 3,
    active: isActive
  };

  const settings = {
    active: isActive,
    durationHours,
    packageCoinCost,
    packageTicketCost,
    startTime: Date.now(),
    endTime: Date.now() + durationHours * 3600000,
    tasks: [t1, t2, t3]
  };

  saveProEventSettings(settings);
  closeEditProTasksModal();
  renderAdminProTasksPanel();
  showToast('💎 Pro Tasks & 3-Task Pack updated successfully! ✓');
}

function renderAdminPassPanel() {
  const titleEl = document.getElementById('passDetailSeasonTitle');
  if (titleEl) titleEl.textContent = 'Season 6: Light the Fuse (Fixed)';

  const tiersEl = document.getElementById('passDetailTotalLevels');
  if (tiersEl) tiersEl.textContent = '500 Levels';

  const rewardEl = document.getElementById('passDetailMilestoneReward');
  if (rewardEl) rewardEl.textContent = '⭐ 3,000 Stars';

  const appCfg = (window.TapEmpireUtils && typeof window.TapEmpireUtils.getAppSettings === 'function')
    ? window.TapEmpireUtils.getAppSettings()
    : null;

  let startTime = parseInt(localStorage.getItem('season_pass_start_timestamp') || '0', 10) || 0;
  if (!startTime && appCfg && appCfg.seasonPass && appCfg.seasonPass.startTime > 0) {
    startTime = Number(appCfg.seasonPass.startTime) || 0;
  }
  const startInput = document.getElementById('adminSeasonStartTimeInput');
  if (startInput) {
    if (startTime > 0) {
      const d = new Date(startTime);
      const pad = n => n.toString().padStart(2, '0');
      startInput.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else {
      startInput.value = '';
    }
  }

  const endTime = getStoredSeasonPassEndTime();
  const endInput = document.getElementById('adminSeasonEndTimeInput');
  if (endInput) {
    const d = new Date(endTime);
    const pad = n => n.toString().padStart(2, '0');
    endInput.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  updateAdminSeasonCountdownDisplay();

  const milestonesContainer = document.getElementById('passMilestonesPreviewGrid');
  if (milestonesContainer) {
    const currentLvl = parseInt(localStorage.getItem('task_pass_level') || '0', 10);
    const milestones = [
      { lvl: 2, reward: '🎟️ 5 Tickets' },
      { lvl: 3, reward: '🪙 1,000 Coins' },
      { lvl: 4, reward: '🎟️ 5 Tickets' },
      { lvl: 5, reward: '🪙 1,000 Coins' },
      { lvl: 6, reward: '🎟️ 5 Tickets' },
      { lvl: 10, reward: '⭐ 100 Stars (Fixed)' },
      { lvl: 50, reward: '⭐ 200 Stars (Fixed)' },
      { lvl: 100, reward: '⭐ 325 Stars (Fixed)' },
      { lvl: 500, reward: '⭐ 1,325 Stars (Fixed)' }
    ];

    milestonesContainer.innerHTML = milestones.map(m => {
      let statusHtml = '';
      let borderStyle = 'border: 1px solid rgba(56, 189, 248, 0.25);';
      if (m.lvl < currentLvl) {
        statusHtml = '<span style="font-size: 0.65rem; color: #34d399; font-weight: 800;">✓ Won</span>';
        borderStyle = 'border: 1.5px solid rgba(52, 211, 153, 0.5); background: rgba(16, 185, 129, 0.1);';
      } else if (m.lvl === currentLvl) {
        statusHtml = '<span style="font-size: 0.65rem; color: #38bdf8; font-weight: 800;">🎯 Active Target</span>';
        borderStyle = 'border: 2px solid #38bdf8; background: rgba(14, 165, 233, 0.15); box-shadow: 0 0 12px rgba(56, 189, 248, 0.35);';
      } else {
        statusHtml = '<span style="font-size: 0.65rem; color: #94a3b8; font-weight: 700;">🔒 Fixed Tier</span>';
      }
      return `
        <div class="pass-milestone-card" style="${borderStyle}">
          <div style="font-weight: 900; color: #ffffff; font-size: 0.85rem; margin-bottom: 2px;">Level ${m.lvl}</div>
          <div style="font-size: 0.75rem; color: #fde047; font-weight: 800; margin-bottom: 4px;">${m.reward}</div>
          ${statusHtml}
        </div>
      `;
    }).join('');
  }
}

function getStoredSeasonPassEndTime() {
  const stored = localStorage.getItem('season_pass_end_timestamp');
  if (stored) {
    const val = parseInt(stored, 10);
    if (!isNaN(val) && val > Date.now()) return val;
  }
  const appCfg = (window.TapEmpireUtils && typeof window.TapEmpireUtils.getAppSettings === 'function')
    ? window.TapEmpireUtils.getAppSettings()
    : null;
  if (appCfg && appCfg.seasonPass && appCfg.seasonPass.endTime > Date.now()) {
    return Number(appCfg.seasonPass.endTime);
  }
  const defaultEnd = Date.now() + 21 * 86400000;
  localStorage.setItem('season_pass_end_timestamp', defaultEnd.toString());
  return defaultEnd;
}

function formatSeasonCountdown(ms) {
  if (ms <= 0) return 'Season Ended';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

function updateAdminSeasonCountdownDisplay() {
  const startTime = parseInt(localStorage.getItem('season_pass_start_timestamp') || '0', 10) || 0;
  const endTime = getStoredSeasonPassEndTime();
  const now = Date.now();
  const liveEl = document.getElementById('passDetailLiveCountdown');
  const badgeEl = document.getElementById('adminLiveSeasonCountdownBadge');
  const statusPill = document.getElementById('passStatusBadge');

  if (startTime > now) {
    const text = `🚀 Coming Soon: ${formatSeasonCountdown(startTime - now)}`;
    if (liveEl) { liveEl.textContent = text; liveEl.style.color = '#fde047'; }
    if (badgeEl) { badgeEl.textContent = text; badgeEl.style.color = '#fde047'; }
    if (statusPill) { statusPill.textContent = '🚀 COMING SOON'; }
    return;
  }

  const diff = endTime - now;
  const formatted = formatSeasonCountdown(diff);
  if (liveEl) { liveEl.textContent = `⏱️ ${formatted}`; liveEl.style.color = '#38bdf8'; }
  if (badgeEl) { badgeEl.textContent = `⏱️ Ends: ${formatted}`; badgeEl.style.color = '#38bdf8'; }
  if (statusPill) { statusPill.textContent = diff > 0 ? '⚡ PASS ACTIVE' : '⏱️ ENDED'; }
}

setInterval(updateAdminSeasonCountdownDisplay, 1000);

function applyAdminQuickDays(days) {
  const d = parseInt(days, 10);
  if (!d || d < 1) return;
  const targetDate = new Date(Date.now() + d * 86400000);
  const input = document.getElementById('adminSeasonEndTimeInput');
  if (input) {
    const pad = n => n.toString().padStart(2, '0');
    input.value = `${targetDate.getFullYear()}-${pad(targetDate.getMonth()+1)}-${pad(targetDate.getDate())}T${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;
  }
}
window.applyAdminQuickDays = applyAdminQuickDays;

function clearAdminComingSoonTimer() {
  const startInput = document.getElementById('adminSeasonStartTimeInput');
  if (startInput) startInput.value = '';
  saveAdminSeasonTimer();
}
window.clearAdminComingSoonTimer = clearAdminComingSoonTimer;

async function saveAdminSeasonTimer() {
  const startInput = document.getElementById('adminSeasonStartTimeInput');
  let startTimestamp = 0;
  if (startInput && startInput.value) {
    const parsedStart = new Date(startInput.value).getTime();
    if (!isNaN(parsedStart) && parsedStart > 0) startTimestamp = parsedStart;
  }
  localStorage.setItem('season_pass_start_timestamp', startTimestamp.toString());

  const input = document.getElementById('adminSeasonEndTimeInput');
  let targetTimestamp = 0;
  if (input && input.value) {
    targetTimestamp = new Date(input.value).getTime();
  }
  if (!targetTimestamp || isNaN(targetTimestamp) || targetTimestamp <= Date.now()) {
    const quickDays = parseInt(document.getElementById('adminSeasonQuickDays')?.value || '21', 10);
    targetTimestamp = Date.now() + Math.max(1, quickDays) * 86400000;
  }

  localStorage.setItem('season_pass_end_timestamp', targetTimestamp.toString());

  if (window.TapEmpireUtils && typeof window.TapEmpireUtils.saveAppSettingsToCloud === 'function') {
    await window.TapEmpireUtils.saveAppSettingsToCloud({
      seasonPass: { startTime: startTimestamp, endTime: targetTimestamp }
    }).catch(() => {});
  }

  try {
    const syncChannel = new BroadcastChannel('nova_task_sync');
    syncChannel.postMessage({ type: 'SEASON_TIMER_UPDATED', startTime: startTimestamp, endTime: targetTimestamp, timestamp: Date.now() });
    syncChannel.close();
  } catch (e) {}

  if (window.firebaseSync && typeof window.firebaseSync.database === 'object') {
    try {
      window.firebaseSync.database.ref('season_pass_settings').set({
        seasonStartTime: startTimestamp,
        seasonEndTime: targetTimestamp,
        updatedAt: Date.now()
      });
    } catch (e) {}
  }

  updateAdminSeasonCountdownDisplay();
  const statusEl = document.getElementById('adminSeasonTimerStatusMsg');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = startTimestamp > Date.now()
      ? `✓ Coming Soon (${formatSeasonCountdown(startTimestamp - Date.now())}) & End Date saved!`
      : `✓ Live Season End Date set! Ends in ${formatSeasonCountdown(targetTimestamp - Date.now())}`;
    setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 4500);
  }
  showToast('⏱️ Pass Coming Soon & End Date Timers saved & synced! ✓');
}
window.saveAdminSeasonTimer = saveAdminSeasonTimer;
window.getStoredSeasonPassEndTime = getStoredSeasonPassEndTime;

function adminTogglePassActivation() {
  showToast('🔒 Pass configuration is fixed and cannot be changed.');
}

function openEditPassSettingsModal() {
  showToast('🔒 Pass levels & rewards are fixed. Only Coming Soon & End Date timers can be edited.');
}

function closeEditPassSettingsModal() {
  const modal = document.getElementById('adminPassEditModalOverlay');
  if (modal) modal.style.display = 'none';
}

function handleSavePassSettingsForm(e) {
  if (e && e.preventDefault) e.preventDefault();
  closeEditPassSettingsModal();
  showToast('🔒 Pass structure is fixed and cannot be changed.');
}

window.switchAdminEventTab = switchAdminEventTab;
window.renderAdminProTasksPanel = renderAdminProTasksPanel;
window.renderAdminPassPanel = renderAdminPassPanel;
window.toggleProEventActive = toggleProEventActive;
window.openEditProTasksModal = openEditProTasksModal;
window.closeEditProTasksModal = closeEditProTasksModal;
window.updateEditProBountyPreview = updateEditProBountyPreview;
window.handleSaveProTasksForm = handleSaveProTasksForm;
window.adminTogglePassActivation = adminTogglePassActivation;
window.openEditPassSettingsModal = openEditPassSettingsModal;
window.closeEditPassSettingsModal = closeEditPassSettingsModal;
window.handleSavePassSettingsForm = handleSavePassSettingsForm;

// =============================================================================
// ADMIN GLOBAL LIMITS, VIP STAR PLAN, PROGRESSIVE DAILY & EVENT LEVELS EDITOR
// =============================================================================

let _adminVipPlansDraft = null;
let _adminUltraMilestonesDraft = null;

function renderAdminVipPlansEditor() {
  const container = document.getElementById('adminVipPlansList');
  if (!container) return;

  if (!_adminVipPlansDraft) {
    const s = (window.TapEmpireUtils && window.TapEmpireUtils.getAppSettings()) || {};
    const plans = Array.isArray(s.vipPlans) && s.vipPlans.length > 0 ? s.vipPlans : [
      { id: 'vip_500', title: 'VIP Silver Pass', costStars: 500, dailyTasksLimit: 5, durationDays: 7, enabled: true, restrictions: '500 Stars for 5 Star Tasks/day (7 Days).' },
      { id: 'vip_1000', title: 'VIP Gold Pass', costStars: 1000, dailyTasksLimit: 10, durationDays: 30, enabled: true, restrictions: '1,000 Stars for 10 Star Tasks/day (30 Days).' },
      { id: 'vip_5000', title: 'VIP Diamond Pass', costStars: 5000, dailyTasksLimit: 30, durationDays: 90, enabled: true, restrictions: '5,000 Stars for 30 Star Tasks/day (90 Days).' }
    ];
    _adminVipPlansDraft = plans.map(p => ({ ...p }));
  }

  container.innerHTML = _adminVipPlansDraft.map((p, idx) => `
    <div style="background:rgba(2,6,23,0.72);border:1px solid rgba(168,85,247,0.35);border-radius:10px;padding:0.55rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:6px;">
        <span style="font-size:0.74rem;font-weight:900;color:#fde047;">Plan ${idx + 1}: ${escapeHtml(p.title || 'VIP Pass')}</span>
        <label style="font-size:0.68rem;color:#cbd5e1;display:flex;align-items:center;gap:4px;">
          <input type="checkbox" ${p.enabled !== false ? 'checked' : ''} onchange="updateVipPlanField(${idx}, 'enabled', this.checked)"> Active
        </label>
      </div>
      <div style="display:grid;grid-template-columns:1.2fr 0.9fr 0.8fr 0.8fr;gap:5px;margin-bottom:4px;">
        <div><label style="font-size:0.62rem;color:#94a3b8;">Plan Title</label><input type="text" class="admin-form-input" value="${escapeHtml(p.title || '')}" onchange="updateVipPlanField(${idx}, 'title', this.value)" style="font-size:0.72rem;padding:4px 6px;"></div>
        <div><label style="font-size:0.62rem;color:#94a3b8;">Stars ⭐</label><input type="number" min="1" data-vip-plan-cost="${escapeHtml(p.id)}" class="admin-form-input" value="${Number(p.costStars || 500)}" onchange="updateVipPlanField(${idx}, 'costStars', Number(this.value))" style="font-size:0.72rem;padding:4px 6px;color:#fbbf24;"></div>
        <div><label style="font-size:0.62rem;color:#94a3b8;">Tasks/Day</label><input type="number" min="1" class="admin-form-input" value="${Number(p.dailyTasksLimit || 5)}" onchange="updateVipPlanField(${idx}, 'dailyTasksLimit', Number(this.value))" style="font-size:0.72rem;padding:4px 6px;"></div>
        <div><label style="font-size:0.62rem;color:#94a3b8;">Days</label><input type="number" min="1" class="admin-form-input" value="${Number(p.durationDays || 7)}" onchange="updateVipPlanField(${idx}, 'durationDays', Number(this.value))" style="font-size:0.72rem;padding:4px 6px;"></div>
      </div>
      <input type="text" class="admin-form-input" value="${escapeHtml(p.restrictions || '')}" placeholder="Restrictions / Details note" onchange="updateVipPlanField(${idx}, 'restrictions', this.value)" style="font-size:0.7rem;padding:4px 6px;">
    </div>
  `).join('');
}

function updateVipPlanField(idx, field, val) {
  if (!_adminVipPlansDraft || !_adminVipPlansDraft[idx]) return;
  _adminVipPlansDraft[idx][field] = val;
}
window.renderAdminVipPlansEditor = renderAdminVipPlansEditor;
window.updateVipPlanField = updateVipPlanField;

function renderAdminUltraMilestonesEditor() {
  const container = document.getElementById('adminUltraMilestonesList');
  if (!container) return;

  if (!_adminUltraMilestonesDraft) {
    const s = (window.TapEmpireUtils && window.TapEmpireUtils.getAppSettings()) || {};
    const ms = s.walletOffers && Array.isArray(s.walletOffers.ultraMilestones) ? s.walletOffers.ultraMilestones : [];
    _adminUltraMilestonesDraft = ms.map(m => ({ ...m }));
  }

  if (_adminUltraMilestonesDraft.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:0.75rem;color:#94a3b8;font-size:0.74rem;">No Ultra milestones configured. Click "＋ Add Milestone" above.</div>`;
    return;
  }

  container.innerHTML = _adminUltraMilestonesDraft.map((m, idx) => `
    <div style="background:rgba(2,6,23,0.72);border:1px solid rgba(250,204,21,0.3);border-radius:10px;padding:0.55rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;gap:6px;">
        <span style="font-size:0.74rem;font-weight:900;color:#fde047;">Milestone ${idx + 1}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:0.68rem;color:#cbd5e1;display:flex;align-items:center;gap:4px;">
            <input type="checkbox" ${m.enabled !== false ? 'checked' : ''} onchange="updateUltraMilestoneField(${idx}, 'enabled', this.checked)"> Active
          </label>
          <button type="button" onclick="deleteAdminUltraMilestone(${idx})" style="padding:2px 6px;border-radius:6px;border:1px solid rgba(239,68,68,0.45);background:rgba(239,68,68,0.15);color:#f87171;font-size:0.66rem;font-weight:800;cursor:pointer;">Delete</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1.5fr 0.8fr;gap:5px;margin-bottom:5px;">
        <div><label style="font-size:0.62rem;color:#94a3b8;">Gift Card Title</label><input type="text" class="admin-form-input" value="${escapeHtml(m.title || '')}" onchange="updateUltraMilestoneField(${idx}, 'title', this.value)" style="font-size:0.72rem;padding:4px 6px;"></div>
        <div><label style="font-size:0.62rem;color:#94a3b8;">Gift Value ₹</label><input type="number" min="1" class="admin-form-input" value="${Number(m.giftAmountInr || 1000)}" onchange="updateUltraMilestoneField(${idx}, 'giftAmountInr', Number(this.value))" style="font-size:0.72rem;padding:4px 6px;color:#34d399;"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;">
        <div><label style="font-size:0.62rem;color:#94a3b8;">Req Ultra</label><input type="number" min="1" class="admin-form-input" value="${Number(m.requiredUltraTasks || 100)}" onchange="updateUltraMilestoneField(${idx}, 'requiredUltraTasks', Number(this.value))" style="font-size:0.72rem;padding:4px 6px;"></div>
        <div><label style="font-size:0.62rem;color:#94a3b8;">Deduct Credits</label><input type="number" min="0" class="admin-form-input" value="${Number(m.deductUltraTasks !== undefined ? m.deductUltraTasks : (m.requiredUltraTasks || 100))}" onchange="updateUltraMilestoneField(${idx}, 'deductUltraTasks', Number(this.value))" style="font-size:0.72rem;padding:4px 6px;"></div>
        <div><label style="font-size:0.62rem;color:#94a3b8;">Star Cost ⭐</label><input type="number" min="0" class="admin-form-input" value="${Number(m.starCost || 0)}" onchange="updateUltraMilestoneField(${idx}, 'starCost', Number(this.value))" style="font-size:0.72rem;padding:4px 6px;color:#fbbf24;"></div>
      </div>
    </div>
  `).join('');
}

function updateUltraMilestoneField(idx, field, val) {
  if (!_adminUltraMilestonesDraft || !_adminUltraMilestonesDraft[idx]) return;
  _adminUltraMilestonesDraft[idx][field] = val;
}

function addAdminUltraMilestone() {
  if (!_adminUltraMilestonesDraft) _adminUltraMilestonesDraft = [];
  const nextReq = (_adminUltraMilestonesDraft.length + 1) * 100;
  _adminUltraMilestonesDraft.push({
    id: `ultra_ms_${Date.now()}_${_adminUltraMilestonesDraft.length + 1}`,
    title: `₹${(nextReq * 10).toLocaleString()} Amazon Shopping Voucher`,
    requiredUltraTasks: nextReq,
    deductUltraTasks: nextReq,
    giftAmountInr: nextReq * 10,
    starCost: 0,
    enabled: true
  });
  renderAdminUltraMilestonesEditor();
}

function deleteAdminUltraMilestone(idx) {
  if (!_adminUltraMilestonesDraft) return;
  _adminUltraMilestonesDraft.splice(idx, 1);
  renderAdminUltraMilestonesEditor();
}

window.renderAdminUltraMilestonesEditor = renderAdminUltraMilestonesEditor;
window.updateUltraMilestoneField = updateUltraMilestoneField;
window.addAdminUltraMilestone = addAdminUltraMilestone;
window.deleteAdminUltraMilestone = deleteAdminUltraMilestone;

function loadAdminAppSettingsUI() {
  const s = (window.TapEmpireUtils && typeof window.TapEmpireUtils.getAppSettings === 'function')
    ? window.TapEmpireUtils.getAppSettings()
    : null;
  if (!s) return;

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = String(val); };
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

  setVal('cfgLimitCommon', s.categoryLimits.common ?? 10);
  setVal('cfgLimitCoin', s.categoryLimits.simple ?? 10);
  setVal('cfgLimitStar', s.categoryLimits.star ?? 10);
  setVal('cfgLimitPro', s.categoryLimits.pro ?? 3);
  setVal('cfgLimitUltra', s.categoryLimits.ultra ?? 5);
  setVal('cfgLimitQuiz', s.categoryLimits.quiz ?? 30);
  setVal('cfgLimitDiamond', s.categoryLimits.diamond ?? 10);
  setVal('cfgLimitGoogle', s.categoryLimits.google ?? 10);

  setVal('cfgStarGoogleReq', (s.starUnlock && s.starUnlock.googleTasksPerUnlock) ?? 2);

  _adminVipPlansDraft = null;
  renderAdminVipPlansEditor();

  setVal('cfgProgFreeDay', s.dailyProgression.freeTasksPerDay ?? 10);
  setVal('cfgProgInc', s.dailyProgression.dailyIncrement ?? 10);
  setVal('cfgProgAdExtra', s.dailyProgression.adExtraTaskCount ?? 20);
  setChk('cfgProgAllowAd', s.dailyProgression.allowAdExtraTasks !== false);

  setVal('cfgProGroupCost', s.proGroup.costAmount ?? 5000);
  setVal('cfgProGroupCurrency', s.proGroup.costCurrency || 'coins');
  setVal('cfgProTimerMin', s.proGroup.timerMinutes ?? 1440);

  const oto = (s.walletOffers && s.walletOffers.oneTimeOffer) || {};
  setVal('cfgOtoTitle', oto.title || '₹50 Amazon Shopping Voucher');
  setVal('cfgOtoInr', oto.giftAmountInr ?? 50);
  setVal('cfgOtoStars', oto.starCost ?? 1500);
  setVal('cfgOtoReqUltra', oto.requiredUltraTasks ?? 3);
  setVal('cfgOtoDeductUltra', oto.deductUltraTasks ?? 3);
  setVal('cfgOtoHours', oto.timerHours ?? 48);
  setChk('cfgOtoEnabled', oto.enabled !== false);
  const endInput = document.getElementById('cfgOtoEndDateTime');
  if (endInput && oto.countdownEndMs && Number(oto.countdownEndMs) > 0) {
    const dt = new Date(Number(oto.countdownEndMs));
    const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    endInput.value = localIso;
  }

  _adminUltraMilestonesDraft = null;
  renderAdminUltraMilestonesEditor();
}

async function handleSaveAdminAppSettings(e) {
  if (e && e.preventDefault) e.preventDefault();
  const btn = document.getElementById('btnSaveAdminAppSettings');
  const msgEl = document.getElementById('adminAppSettingsMsg');
  const getNum = (id, def) => {
    const v = parseInt(document.getElementById(id)?.value || '', 10);
    return isNaN(v) ? def : v;
  };

  const otoEndRaw = document.getElementById('cfgOtoEndDateTime')?.value || '';
  const otoEndMs = otoEndRaw ? new Date(otoEndRaw).getTime() : 0;

  const payload = {
    categoryLimits: {
      common: Math.max(1, getNum('cfgLimitCommon', 10)),
      simple: Math.max(1, getNum('cfgLimitCoin', 10)),
      star: Math.max(1, getNum('cfgLimitStar', 10)),
      pro: Math.max(1, getNum('cfgLimitPro', 3)),
      ultra: Math.max(1, getNum('cfgLimitUltra', 5)),
      quiz: Math.max(1, getNum('cfgLimitQuiz', 30)),
      diamond: Math.max(1, getNum('cfgLimitDiamond', 10)),
      google: Math.max(1, getNum('cfgLimitGoogle', 10))
    },
    starUnlock: {
      googleTasksPerUnlock: Math.max(1, getNum('cfgStarGoogleReq', 2))
    },
    dailyProgression: {
      freeTasksPerDay: Math.max(1, getNum('cfgProgFreeDay', 10)),
      dailyIncrement: Math.max(0, getNum('cfgProgInc', 10)),
      adExtraTaskCount: Math.max(0, getNum('cfgProgAdExtra', 20)),
      allowAdExtraTasks: document.getElementById('cfgProgAllowAd')?.checked !== false,
      customAdExtra: true
    },
    proGroup: {
      costAmount: Math.max(0, getNum('cfgProGroupCost', 5000)),
      costCurrency: document.getElementById('cfgProGroupCurrency')?.value || 'coins',
      timerMinutes: Math.max(1, getNum('cfgProTimerMin', 1440)),
      dailyLimit: Math.max(1, getNum('cfgLimitPro', 3)),
      active: true
    },
    walletOffers: {
      oneTimeOffer: {
        title: document.getElementById('cfgOtoTitle')?.value.trim() || '₹50 Amazon Shopping Voucher',
        giftAmountInr: Math.max(1, getNum('cfgOtoInr', 50)),
        starCost: Math.max(0, getNum('cfgOtoStars', 1500)),
        requiredUltraTasks: Math.max(0, getNum('cfgOtoReqUltra', 3)),
        deductUltraTasks: Math.max(0, getNum('cfgOtoDeductUltra', 3)),
        timerHours: Math.max(1, getNum('cfgOtoHours', 48)),
        countdownEndMs: (otoEndMs && !isNaN(otoEndMs)) ? otoEndMs : 0,
        enabled: document.getElementById('cfgOtoEnabled')?.checked !== false
      },
      ultraMilestones: Array.isArray(_adminUltraMilestonesDraft) ? _adminUltraMilestonesDraft.map(m => ({ ...m })) : undefined
    }
  };

  if (btn) btn.disabled = true;
  try {
    if (window.TapEmpireUtils && typeof window.TapEmpireUtils.saveAppSettingsToCloud === 'function') {
      await window.TapEmpireUtils.saveAppSettingsToCloud(payload);
    }
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = '#34d399';
      msgEl.textContent = '✓ Limits, Star Unlock Rule & Pro settings saved to Firebase!';
    }
    showToast('✓ All App Settings saved & synced to Firebase!');
  } catch (err) {
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = '#f87171';
      msgEl.textContent = '❌ Failed to save settings.';
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

let _adminEventLevelsDraft = null;

function renderAdminEventLevelsEditor() {
  const container = document.getElementById('adminEventLevelsList');
  if (!container) return;

  if (!_adminEventLevelsDraft) {
    const s = (window.TapEmpireUtils && window.TapEmpireUtils.getAppSettings()) || { eventLevels: [] };
    _adminEventLevelsDraft = Array.isArray(s.eventLevels) ? s.eventLevels.map(l => ({ ...l })) : [];
  }

  if (_adminEventLevelsDraft.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:1rem;color:#94a3b8;font-size:0.78rem;">No event levels configured. Click "＋ Add Level" to create one.</div>`;
    return;
  }

  container.innerHTML = _adminEventLevelsDraft.map((lvl, idx) => `
    <div style="background:rgba(2,6,23,0.75);border:1px solid rgba(56,189,248,0.28);border-radius:10px;padding:0.65rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:6px;">
        <span style="font-weight:900;font-size:0.8rem;color:#38bdf8;">Level ${idx + 1}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:0.7rem;color:#cbd5e1;display:flex;align-items:center;gap:4px;">
            <input type="checkbox" ${lvl.active !== false ? 'checked' : ''} onchange="updateEventLevelField(${idx}, 'active', this.checked)"> Active
          </label>
          <button type="button" onclick="deleteAdminEventLevel(${idx})" style="padding:2px 7px;border-radius:6px;border:1px solid rgba(239,68,68,0.45);background:rgba(239,68,68,0.15);color:#f87171;font-size:0.68rem;font-weight:800;cursor:pointer;">Delete</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1.2fr 0.9fr 0.9fr;gap:6px;margin-bottom:6px;">
        <div><label style="font-size:0.64rem;color:#94a3b8;">Name</label><input type="text" class="admin-form-input" value="${escapeHtml(lvl.title || ('Level ' + (idx + 1)))}" onchange="updateEventLevelField(${idx}, 'title', this.value)" style="font-size:0.75rem;padding:4px 6px;"></div>
        <div><label style="font-size:0.64rem;color:#94a3b8;">Req Tasks</label><input type="number" min="0" class="admin-form-input" value="${Number(lvl.requirementTasks || 0)}" onchange="updateEventLevelField(${idx}, 'requirementTasks', Number(this.value))" style="font-size:0.75rem;padding:4px 6px;"></div>
        <div><label style="font-size:0.64rem;color:#94a3b8;">Cost Curr</label>
          <select class="admin-form-input" onchange="updateEventLevelField(${idx}, 'unlockCurrency', this.value)" style="font-size:0.72rem;padding:4px;">
            <option value="coins" ${(lvl.unlockCurrency || 'coins') === 'coins' ? 'selected' : ''}>🪙 Coins</option>
            <option value="tickets" ${lvl.unlockCurrency === 'tickets' ? 'selected' : ''}>🎟️ Tickets</option>
            <option value="stars" ${lvl.unlockCurrency === 'stars' ? 'selected' : ''}>⭐ Stars</option>
            <option value="diamonds" ${lvl.unlockCurrency === 'diamonds' ? 'selected' : ''}>💎 Diamonds</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
        <div><label style="font-size:0.64rem;color:#94a3b8;">Unlock Cost</label><input type="number" min="0" class="admin-form-input" value="${Number(lvl.unlockCost || 0)}" onchange="updateEventLevelField(${idx}, 'unlockCost', Number(this.value))" style="font-size:0.75rem;padding:4px 6px;"></div>
        <div><label style="font-size:0.64rem;color:#94a3b8;">Reward 🪙</label><input type="number" min="0" class="admin-form-input" value="${Number(lvl.rewardCoins || 0)}" onchange="updateEventLevelField(${idx}, 'rewardCoins', Number(this.value))" style="font-size:0.75rem;padding:4px 6px;color:#fbbf24;"></div>
        <div><label style="font-size:0.64rem;color:#94a3b8;">Reward ⭐</label><input type="number" min="0" class="admin-form-input" value="${Number(lvl.rewardStars || 0)}" onchange="updateEventLevelField(${idx}, 'rewardStars', Number(this.value))" style="font-size:0.75rem;padding:4px 6px;color:#fde047;"></div>
      </div>
    </div>
  `).join('');
}

function updateEventLevelField(idx, field, val) {
  if (!_adminEventLevelsDraft || !_adminEventLevelsDraft[idx]) return;
  _adminEventLevelsDraft[idx][field] = val;
}

function addAdminEventLevel() {
  if (!_adminEventLevelsDraft) _adminEventLevelsDraft = [];
  const nextNum = _adminEventLevelsDraft.length + 1;
  _adminEventLevelsDraft.push({
    level: nextNum,
    title: `Level ${nextNum}`,
    requirementTasks: nextNum * 10,
    rewardCoins: nextNum * 100,
    rewardStars: nextNum * 20,
    unlockCost: 0,
    unlockCurrency: 'coins',
    active: true
  });
  renderAdminEventLevelsEditor();
}

function deleteAdminEventLevel(idx) {
  if (!_adminEventLevelsDraft) return;
  _adminEventLevelsDraft.splice(idx, 1);
  _adminEventLevelsDraft.forEach((l, i) => { l.level = i + 1; });
  renderAdminEventLevelsEditor();
}

async function saveAdminEventLevels() {
  showToast('🔒 Pass track levels are fixed and cannot be modified.');
}

window.addEventLevel = () => {};

window.loadAdminAppSettingsUI = loadAdminAppSettingsUI;
window.handleSaveAdminAppSettings = handleSaveAdminAppSettings;
window.renderAdminEventLevelsEditor = renderAdminEventLevelsEditor;
window.updateEventLevelField = updateEventLevelField;
window.addAdminEventLevel = addAdminEventLevel;
window.deleteAdminEventLevel = deleteAdminEventLevel;
window.saveAdminEventLevels = saveAdminEventLevels;

// Hide level-selection field on Common, Pro, Ultra, Quiz, Diamond, and Google Form in legacy modal
document.addEventListener('DOMContentLoaded', () => {
  loadAdminAppSettingsUI();
  renderAdminEventLevelsEditor();
  const catSel = document.getElementById('taskInputCategory');
  const lvlGrp = document.getElementById('profileTaskLevelGroup');
  if (catSel && lvlGrp) {
    const syncLvlVisibility = () => {
      const v = String(catSel.value || '').toLowerCase();
      lvlGrp.style.display = ['common', 'pro', 'ultra', 'quiz', 'diamond', 'google'].includes(v) ? 'none' : '';
    };
    catSel.addEventListener('change', syncLvlVisibility);
    syncLvlVisibility();
  }
});
window.addEventListener('settings:changed', () => {
  _adminEventLevelsDraft = null;
  _adminUltraMilestonesDraft = null;
  loadAdminAppSettingsUI();
  renderAdminEventLevelsEditor();
});
