/**
 * ============================================================================
 * TAP EMPIRE — UNIFIED REAL-TIME TASK, PROGRESS, PRO GROUP & VIP ENGINE
 * Shared single source of truth across Home, Tasks, Pass, and Admin pages.
 * Zero demo tasks: all tasks, limits, costs, and VIP settings come from Firebase.
 * ============================================================================
 */
(function () {
  'use strict';

  const TASKS_STORAGE_KEY = 'task_game_tasks';
  const COMPLETED_TASKS_KEY = 'task_completed_tasks';
  const LEGACY_COMPLETED_KEY = 'task_game_completed_tasks';
  const UNLOCKED_TASKS_KEY = 'task_unlocked_tasks';
  const OPENED_TASKS_KEY = 'tap_empire_opened_tasks';
  const PRO_GROUP_STATE_KEY = 'tap_empire_pro_group_state';
  const QUIZ_TIMERS_KEY = 'tap_empire_quiz_timers';
  const CATEGORY_DAILY_COUNTS_KEY = 'tap_empire_category_daily_counts';
  const DAILY_PROGRESSION_KEY = 'tap_empire_daily_progression';
  const COMMON_COMPLETED_IDS_KEY = 'tap_empire_common_completed_ids';
  const GOOGLE_COMPLETED_IDS_KEY = 'tap_empire_google_completed_ids';
  const STAR_UNLOCKED_COSTS_KEY = 'tap_empire_star_unlocked_costs';
  const ULTRA_UNLOCK_STARS = 1000;
  const ULTRA_REWARD_STARS = 2000;
  const ULTRA_DURATION_MS = 24 * 3600 * 1000;
  const VIP_PLAN_KEY = 'tap_empire_vip_plan';
  const SYNC_CHANNEL_NAME = 'nova_task_sync';

  const CATEGORY_META = {
    common: { key: 'common', title: 'Common Tasks', icon: '🎟️', color: '#38bdf8', emptyHint: 'Ask Admin to add Common Tasks.' },
    simple: { key: 'simple', title: 'Coin Tasks', icon: '🪙', color: '#60a5fa', emptyHint: 'Ask Admin to add Coin Tasks.' },
    star: { key: 'star', title: 'Star Tasks', icon: '⭐', color: '#c084fc', emptyHint: 'Complete 2 Google Form Tasks per Star Task unlock!' },
    pro: { key: 'pro', title: 'Pro Tasks (3-Pack)', icon: '💎', color: '#34d399', emptyHint: 'Ask Admin to publish a Pro 3-Task Group.' },
    ultra: { key: 'ultra', title: 'Ultra Tasks', icon: '⚡', color: '#facc15', emptyHint: 'Ask Admin to add Ultra Tasks.' },
    quiz: { key: 'quiz', title: 'Quiz Tasks', icon: '🧠', color: '#10b981', emptyHint: 'Ask Admin to add Quiz Tasks.' },
    diamond: { key: 'diamond', title: 'Diamond Tasks', icon: '💎', color: '#22d3ee', emptyHint: 'Ask Admin to add Diamond Tasks.' },
    google: { key: 'google', title: 'Google Form Tasks', icon: '📝', color: '#818cf8', emptyHint: 'Ask Admin to add Google Form Tasks.' }
  };

  // Image 8 Tab-Wise Color Palette (single source of truth across Tasks, Cards, Progress Bars)
  const CATEGORY_THEMES = {
    common: {
      accent: '#7dd3fc',
      border: 'rgba(125, 211, 252, 0.65)',
      cardBg: 'linear-gradient(145deg, rgba(10, 42, 82, 0.94) 0%, rgba(5, 22, 50, 0.97) 100%)',
      btnBg: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
      barBg: 'linear-gradient(90deg, #7dd3fc 0%, #0ea5e9 100%)',
      pillBg: 'rgba(56, 189, 248, 0.2)',
      glow: '0 6px 20px rgba(0, 0, 0, 0.45), 0 0 20px rgba(56, 189, 248, 0.25)'
    },
    simple: {
      accent: '#60a5fa',
      border: 'rgba(37, 99, 235, 0.65)',
      cardBg: 'linear-gradient(135deg, rgba(17, 24, 80, 0.95) 0%, rgba(10, 15, 50, 0.98) 100%)',
      btnBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      barBg: 'linear-gradient(90deg, #3b82f6 0%, #facc15 100%)',
      pillBg: 'rgba(37, 99, 235, 0.22)',
      glow: '0 6px 20px rgba(0, 0, 0, 0.45), 0 0 18px rgba(37, 99, 235, 0.28)'
    },
    star: {
      accent: '#c084fc',
      border: 'rgba(168, 85, 247, 0.6)',
      cardBg: 'linear-gradient(135deg, rgba(35, 17, 68, 0.95) 0%, rgba(20, 10, 42, 0.98) 100%)',
      btnBg: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
      barBg: 'linear-gradient(90deg, #a855f7 0%, #facc15 100%)',
      pillBg: 'rgba(168, 85, 247, 0.22)',
      glow: '0 6px 20px rgba(0, 0, 0, 0.45), 0 0 18px rgba(168, 85, 247, 0.28)'
    },
    pro: {
      accent: '#34d399',
      border: 'rgba(203, 213, 225, 0.58)',
      cardBg: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(30, 41, 59, 0.88) 100%)',
      btnBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      barBg: 'linear-gradient(90deg, #cbd5e1 0%, #34d399 100%)',
      pillBg: 'rgba(203, 213, 225, 0.18)',
      glow: '0 6px 20px rgba(0, 0, 0, 0.45), 0 0 18px rgba(203, 213, 225, 0.25)'
    },
    ultra: {
      accent: '#facc15',
      border: 'rgba(250, 204, 21, 0.65)',
      cardBg: 'linear-gradient(135deg, rgba(66, 32, 6, 0.95) 0%, rgba(41, 20, 4, 0.98) 100%)',
      btnBg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      barBg: 'linear-gradient(90deg, #f59e0b 0%, #fde047 100%)',
      pillBg: 'rgba(250, 204, 21, 0.2)',
      glow: '0 6px 20px rgba(0, 0, 0, 0.45), 0 0 20px rgba(250, 204, 21, 0.3)'
    },
    quiz: {
      accent: '#10b981',
      border: 'rgba(16, 185, 129, 0.6)',
      cardBg: 'linear-gradient(135deg, rgba(6, 60, 46, 0.94) 0%, rgba(4, 24, 20, 0.98) 100%)',
      btnBg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      barBg: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
      pillBg: 'rgba(16, 185, 129, 0.2)',
      glow: '0 6px 20px rgba(0, 0, 0, 0.45), 0 0 18px rgba(16, 185, 129, 0.28)'
    },
    diamond: {
      accent: '#22d3ee',
      border: 'rgba(34, 211, 238, 0.62)',
      cardBg: 'linear-gradient(135deg, rgba(8, 51, 68, 0.95) 0%, rgba(6, 24, 48, 0.98) 100%)',
      btnBg: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
      barBg: 'linear-gradient(90deg, #22d3ee 0%, #38bdf8 100%)',
      pillBg: 'rgba(34, 211, 238, 0.2)',
      glow: '0 6px 20px rgba(0, 0, 0, 0.45), 0 0 20px rgba(34, 211, 238, 0.32)'
    },
    google: {
      accent: '#818cf8',
      border: 'rgba(129, 140, 248, 0.62)',
      cardBg: 'linear-gradient(135deg, rgba(49, 46, 129, 0.95) 0%, rgba(17, 24, 62, 0.98) 100%)',
      btnBg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      barBg: 'linear-gradient(90deg, #818cf8 0%, #6366f1 100%)',
      pillBg: 'rgba(129, 140, 248, 0.22)',
      glow: '0 6px 20px rgba(0, 0, 0, 0.45), 0 0 20px rgba(99, 102, 241, 0.34)'
    }
  };

  function getCategoryTheme(catKey) {
    const k = normalizeCategory(catKey);
    return CATEGORY_THEMES[k] || CATEGORY_THEMES.common;
  }

  let _activeVerifyTaskId = null;
  let _verifyBusy = false;

  function safeJsonParse(raw, fallback) {
    try {
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function getTodayKey(offsetDays = 0) {
    if (window.TapEmpireUtils && typeof window.TapEmpireUtils.getTodayLocalDateKey === 'function') {
      return window.TapEmpireUtils.getTodayLocalDateKey(offsetDays);
    }
    const d = new Date(Date.now() + offsetDays * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getSettings() {
    if (window.TapEmpireUtils && typeof window.TapEmpireUtils.getAppSettings === 'function') {
      return window.TapEmpireUtils.getAppSettings();
    }
    const raw = safeJsonParse(localStorage.getItem('tap_empire_app_settings'), {});
    return {
      categoryLimits: { common: 10, simple: 10, star: 10, pro: 3, ultra: 5, quiz: 30, diamond: 10, google: 10, ...(raw.categoryLimits || {}) },
      vipPlan: { costStars: 1000, dailyTasksLimit: 10, durationDays: 30, enabled: true, restrictions: '1,000 Stars for 10 tasks/day.', ...(raw.vipPlan || {}) },
      proGroup: { costAmount: 5000, costCurrency: 'coins', timerMinutes: 1440, dailyLimit: 3, active: true, ...(raw.proGroup || {}) },
      dailyProgression: { freeTasksPerDay: 10, dailyIncrement: 10, allowAdExtraTasks: true, adExtraTaskCount: 20, ...(raw.dailyProgression || {}) },
      eventLevels: Array.isArray(raw.eventLevels) ? raw.eventLevels : []
    };
  }

  function normalizeCategory(rawCat, task) {
    const c = String(rawCat || (task && task.category) || '').toLowerCase().trim();
    if (c === 'common' || c === 'task') return 'common';
    if (c === 'simple' || c === 'coin' || c === 'coins') return 'simple';
    if (c === 'star' || c === 'premium' || c === 'vip' || c === 'shop_task' || (task && task.isShopTask)) return 'star';
    if (c === 'pro' || c === 'elite' || c === 'event') return 'pro';
    if (c === 'ultra' || c === 'mega') return 'ultra';
    if (c === 'quiz') return 'quiz';
    if (c === 'diamond' || c === 'diamonds') return 'diamond';
    if (c === 'google' || c === 'google_form' || c === 'google-form' || c === 'googleform' || c === 'form') return 'google';
    return 'simple';
  }

  const LEGACY_DEMO_ID_RE = /^(comm_mission|coin_mission|star_mission|pro_mission|ultra_mission|quiz_task)_/;

  function getStoredTasks() {
    const parsed = safeJsonParse(localStorage.getItem(TASKS_STORAGE_KEY), []);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(t => t && typeof t === 'object' && !t.isDemo && !LEGACY_DEMO_ID_RE.test(String(t.id || '')) && t.active !== false);
  }

  function getCompletedMap() {
    const m1 = safeJsonParse(localStorage.getItem(COMPLETED_TASKS_KEY), {});
    const m2 = safeJsonParse(localStorage.getItem(LEGACY_COMPLETED_KEY), {});
    return { ...(typeof m2 === 'object' ? m2 : {}), ...(typeof m1 === 'object' ? m1 : {}) };
  }

  function saveCompletedMap(map) {
    localStorage.setItem(COMPLETED_TASKS_KEY, JSON.stringify(map));
    localStorage.setItem(LEGACY_COMPLETED_KEY, JSON.stringify(map));
  }

  function getUnlockedMap() {
    const m = safeJsonParse(localStorage.getItem(UNLOCKED_TASKS_KEY), {});
    return (m && typeof m === 'object') ? m : {};
  }

  function saveUnlockedMap(map) {
    localStorage.setItem(UNLOCKED_TASKS_KEY, JSON.stringify(map));
  }

  function getOpenedMap() {
    const m = safeJsonParse(localStorage.getItem(OPENED_TASKS_KEY), {});
    return (m && typeof m === 'object') ? m : {};
  }

  function saveOpenedMap(map) {
    localStorage.setItem(OPENED_TASKS_KEY, JSON.stringify(map));
  }

  function getCategoryDailyState() {
    const today = getTodayKey();
    const stored = safeJsonParse(localStorage.getItem(CATEGORY_DAILY_COUNTS_KEY), {});
    const emptyBuckets = () => ({ common: {}, simple: {}, star: {}, pro: {}, ultra: {}, quiz: {}, diamond: {}, google: {} });
    if (!stored || stored.dateKey !== today) {
      const fresh = {
        dateKey: today,
        counts: { common: 0, simple: 0, star: 0, pro: 0, ultra: 0, quiz: 0, diamond: 0, google: 0 },
        openedIds: emptyBuckets(),
        verifiedIds: emptyBuckets()
      };
      localStorage.setItem(CATEGORY_DAILY_COUNTS_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return {
      dateKey: today,
      counts: { common: 0, simple: 0, star: 0, pro: 0, ultra: 0, quiz: 0, diamond: 0, google: 0, ...(stored.counts || {}) },
      openedIds: { ...emptyBuckets(), ...(stored.openedIds || {}) },
      verifiedIds: { ...emptyBuckets(), ...(stored.verifiedIds || {}) }
    };
  }

  function recomputeDailyCategoryCount(state, catKey) {
    const k = normalizeCategory(catKey);
    const openedSet = (state.openedIds && state.openedIds[k]) || {};
    const verifiedSet = (state.verifiedIds && state.verifiedIds[k]) || {};
    const uniqueCount = new Set([...Object.keys(openedSet), ...Object.keys(verifiedSet)]).size;
    const prevCount = parseInt(state.counts[k] || '0', 10) || 0;
    state.counts[k] = Math.max(uniqueCount, prevCount);
    return state;
  }

  function recordCategoryTaskOpened(catKey, taskId) {
    const state = getCategoryDailyState();
    const k = normalizeCategory(catKey);
    if (!state.openedIds[k]) state.openedIds[k] = {};
    if (!state.openedIds[k][taskId]) {
      state.openedIds[k][taskId] = Date.now();
      const prevCount = parseInt(state.counts[k] || '0', 10) || 0;
      const hadVerified = !!(state.verifiedIds && state.verifiedIds[k] && state.verifiedIds[k][taskId]);
      if (!hadVerified) {
        state.counts[k] = prevCount + 1;
      }
      recomputeDailyCategoryCount(state, k);
      localStorage.setItem(CATEGORY_DAILY_COUNTS_KEY, JSON.stringify(state));
    }
    return state;
  }

  function incrementCategoryDailyCount(catKey, taskId) {
    const state = getCategoryDailyState();
    const k = normalizeCategory(catKey);
    if (!state.verifiedIds[k]) state.verifiedIds[k] = {};
    const alreadyCountedByOpen = !!(taskId && state.openedIds && state.openedIds[k] && state.openedIds[k][taskId]);
    if (taskId) {
      state.verifiedIds[k][taskId] = Date.now();
    }
    if (!alreadyCountedByOpen) {
      state.counts[k] = (parseInt(state.counts[k] || '0', 10) || 0) + 1;
    }
    recomputeDailyCategoryCount(state, k);
    localStorage.setItem(CATEGORY_DAILY_COUNTS_KEY, JSON.stringify(state));
    return state;
  }

  // Daily Streak + Progressive Non-Repeating Window
  function getDailyProgressionState() {
    const settings = getSettings();
    const progCfg = settings.dailyProgression || {};
    const baseFree = Math.max(1, parseInt(progCfg.freeTasksPerDay || '10', 10) || 10);
    const increment = Math.max(0, parseInt(progCfg.dailyIncrement !== undefined ? progCfg.dailyIncrement : 10, 10) || 0);
    const today = getTodayKey();
    const yesterday = getTodayKey(-1);

    let st = safeJsonParse(localStorage.getItem(DAILY_PROGRESSION_KEY), null);
    if (!st || typeof st !== 'object') {
      st = {
        streakDays: 1,
        dayNumber: 1,
        lastActiveDateKey: today,
        todayQuota: baseFree,
        adExtraUnlockedToday: 0
      };
      localStorage.setItem(DAILY_PROGRESSION_KEY, JSON.stringify(st));
    } else if (st.lastActiveDateKey !== today) {
      const wasYesterday = st.lastActiveDateKey === yesterday;
      const nextDayNum = (parseInt(st.dayNumber || '1', 10) || 1) + 1;
      const nextStreak = wasYesterday ? ((parseInt(st.streakDays || '1', 10) || 1) + 1) : 1;
      const nextQuota = baseFree + Math.max(0, nextDayNum - 1) * increment;
      st = {
        streakDays: nextStreak,
        dayNumber: nextDayNum,
        lastActiveDateKey: today,
        todayQuota: nextQuota,
        adExtraUnlockedToday: 0
      };
      localStorage.setItem(DAILY_PROGRESSION_KEY, JSON.stringify(st));
    }

    const claimedDailyRaw = localStorage.getItem('task_daily_streak_count');
    const claimedDaily = Math.max(0, parseInt(claimedDailyRaw || '0', 10) || 0);
    localStorage.setItem('user_streak_days', String(claimedDaily));
    localStorage.setItem('task_game_streak_days', String(claimedDaily));
    return st;
  }

  function grantAdExtraCommonTasks() {
    const settings = getSettings();
    const cfg = settings.dailyProgression || {};
    if (cfg.allowAdExtraTasks === false) return 0;
    const bonus = Math.max(1, parseInt(cfg.adExtraTaskCount || '20', 10) || 20);
    const st = getDailyProgressionState();
    st.adExtraUnlockedToday = (parseInt(st.adExtraUnlockedToday || '0', 10) || 0) + bonus;
    localStorage.setItem(DAILY_PROGRESSION_KEY, JSON.stringify(st));
    syncUserStateToCloud();
    return bonus;
  }

  // VIP Star Plan State (Midnight Local Reset & Configurable Cost/Daily Limit/Duration)
  function getVipPlans() {
    const settings = getSettings();
    const fallback = [
      { id: 'vip_500', title: 'VIP Silver Pass', badge: '⭐ STARTER PASS', costStars: 500, dailyTasksLimit: 5, durationDays: 7, enabled: true, restrictions: '500 Stars for 5 Star Tasks/day (7 Days).' },
      { id: 'vip_1000', title: 'VIP Gold Pass', badge: '👑 POPULAR PASS', costStars: 1000, dailyTasksLimit: 10, durationDays: 30, enabled: true, restrictions: '1,000 Stars for 10 Star Tasks/day (30 Days).' },
      { id: 'vip_5000', title: 'VIP Diamond Pass', badge: '💎 MAX PASS', costStars: 5000, dailyTasksLimit: 30, durationDays: 90, enabled: true, restrictions: '5,000 Stars for 30 Star Tasks/day (90 Days).' }
    ];
    const list = Array.isArray(settings.vipPlans) && settings.vipPlans.length > 0 ? settings.vipPlans : fallback;
    return list.map((p, idx) => ({
      id: p.id || (fallback[idx] ? fallback[idx].id : `vip_${idx + 1}`),
      title: String(p.title || (fallback[idx] ? fallback[idx].title : `VIP Plan ${idx + 1}`)),
      badge: String(p.badge || (fallback[idx] ? fallback[idx].badge : '👑 VIP PASS')),
      costStars: Math.max(1, parseInt(p.costStars !== undefined ? p.costStars : (fallback[idx] ? fallback[idx].costStars : 1000), 10) || 1000),
      dailyTasksLimit: Math.max(1, parseInt(p.dailyTasksLimit !== undefined ? p.dailyTasksLimit : (fallback[idx] ? fallback[idx].dailyTasksLimit : 10), 10) || 10),
      durationDays: Math.max(1, parseInt(p.durationDays !== undefined ? p.durationDays : (fallback[idx] ? fallback[idx].durationDays : 30), 10) || 30),
      enabled: p.enabled !== false,
      restrictions: String(p.restrictions || (fallback[idx] ? fallback[idx].restrictions : ''))
    }));
  }

  function getVipPlanState() {
    const cfg = getSettings().vipPlan || {};
    const plans = getVipPlans();
    const defaultPlan = plans.find((p) => p.id === 'vip_1000') || plans[0];
    const today = getTodayKey();
    const raw = safeJsonParse(localStorage.getItem(VIP_PLAN_KEY), null);
    const dailyLimit = Math.max(1, parseInt((raw && raw.dailyTasksLimit) || cfg.dailyTasksLimit || defaultPlan.dailyTasksLimit || '10', 10) || 10);

    if (!raw || !raw.active || !raw.expiresAt || Date.now() >= Number(raw.expiresAt)) {
      if (raw && raw.active) {
        const expiredState = { ...raw, active: false };
        localStorage.setItem(VIP_PLAN_KEY, JSON.stringify(expiredState));
      }
      localStorage.setItem('task_vip_pass_active', 'false');
      return {
        active: false,
        activePlanId: '',
        activePlanTitle: '',
        costStars: Math.max(1, parseInt(defaultPlan.costStars || cfg.costStars || '1000', 10) || 1000),
        dailyTasksLimit: Math.max(1, parseInt(defaultPlan.dailyTasksLimit || cfg.dailyTasksLimit || '10', 10) || 10),
        durationDays: Math.max(1, parseInt(defaultPlan.durationDays || cfg.durationDays || '30', 10) || 30),
        enabled: cfg.enabled !== false && plans.some((p) => p.enabled !== false),
        restrictions: defaultPlan.restrictions || cfg.restrictions || '',
        plans,
        usedToday: 0,
        remainingToday: 0,
        expiresAt: 0
      };
    }

    const dailyCounts = getCategoryDailyState().counts;
    const usedToday = parseInt(dailyCounts.star || '0', 10) || 0;
    const effectiveLimit = Math.max(1, parseInt(raw.dailyTasksLimit || dailyLimit, 10) || dailyLimit);
    localStorage.setItem('task_vip_pass_active', 'true');
    return {
      ...raw,
      active: true,
      activePlanId: raw.planId || '',
      activePlanTitle: raw.title || 'VIP Star Plan',
      todayKey: today,
      costStars: Math.max(1, parseInt(raw.costStars || cfg.costStars || '1000', 10) || 1000),
      dailyTasksLimit: effectiveLimit,
      durationDays: Math.max(1, parseInt(raw.durationDays || cfg.durationDays || '30', 10) || 30),
      enabled: cfg.enabled !== false && plans.some((p) => p.enabled !== false),
      restrictions: cfg.restrictions || '',
      plans,
      usedToday,
      remainingToday: Math.max(0, effectiveLimit - usedToday)
    };
  }

  async function purchaseConfiguredVipPlan(planIdOrCost) {
    const vip = getVipPlanState();
    const plans = getVipPlans();
    let chosenPlan = null;
    if (planIdOrCost && typeof planIdOrCost === 'object') {
      chosenPlan = planIdOrCost;
    } else if (typeof planIdOrCost === 'string') {
      chosenPlan = plans.find((p) => p.id === planIdOrCost);
    } else if (typeof planIdOrCost === 'number') {
      chosenPlan = plans.find((p) => Number(p.costStars) === Number(planIdOrCost));
    }
    if (!chosenPlan) {
      chosenPlan = plans.find((p) => p.enabled && p.id === 'vip_1000') || plans.find((p) => p.enabled) || plans[0];
    }

    if (!vip.enabled || !chosenPlan || !chosenPlan.enabled) {
      return { ok: false, error: 'Selected VIP Star Plan is currently disabled by Admin.' };
    }
    if (vip.active && vip.expiresAt > Date.now()) {
      return { ok: false, duplicate: true, error: `Your VIP Star Plan (${vip.activePlanTitle || 'VIP'}) is already active!` };
    }

    const costStars = Math.max(1, parseInt(chosenPlan.costStars || '1000', 10) || 1000);
    const dailyTasksLimit = Math.max(1, parseInt(chosenPlan.dailyTasksLimit || '10', 10) || 10);
    const durationDays = Math.max(1, parseInt(chosenPlan.durationDays || '30', 10) || 30);

    const currentStars = (window.firebaseSync && window.firebaseSync.getStars()) ||
      (parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0);

    if (currentStars < costStars) {
      return {
        ok: false,
        error: `Insufficient Stars! Need ${costStars.toLocaleString()} ⭐ for ${chosenPlan.title} (You have ${currentStars.toLocaleString()} ⭐).`
      };
    }

    const cycleKey = getTodayKey() + '_' + chosenPlan.id + '_' + costStars + '_' + durationDays;
    const txId = `vip_star_plan_${cycleKey}_${Date.now()}`;
    if (window.Firebase && typeof window.Firebase.atomicBalanceMutation === 'function') {
      const mut = await window.Firebase.atomicBalanceMutation({
        deltaStars: -costStars,
        reason: `${chosenPlan.title} (${dailyTasksLimit} tasks/day)`,
        txId
      });
      if (!mut.ok) {
        return { ok: false, error: mut.error || 'Could not deduct Stars.' };
      }
    } else if (window.firebaseSync) {
      const res = window.firebaseSync.subtractStars(costStars, chosenPlan.title);
      if (res === false) return { ok: false, error: 'Insufficient Stars.' };
    }

    const now = Date.now();
    const nextPlan = {
      active: true,
      planId: chosenPlan.id,
      title: chosenPlan.title,
      purchasedAt: now,
      expiresAt: now + (durationDays * 86400000),
      costStars,
      dailyTasksLimit,
      durationDays
    };
    localStorage.setItem(VIP_PLAN_KEY, JSON.stringify(nextPlan));
    localStorage.setItem('task_vip_pass_active', 'true');
    localStorage.setItem('task_vip_pass_expiry', String(nextPlan.expiresAt));
    syncUserStateToCloud();
    return { ok: true, plan: getVipPlanState(), purchasedPlan: chosenPlan };
  }

  function getCategoryLimitInfo(catKey) {
    const cat = normalizeCategory(catKey);
    const settings = getSettings();
    const daily = getCategoryDailyState();
    const completedMap = getCompletedMap();
    const allTasksInCat = getStoredTasks().filter(t => normalizeCategory(t.category, t) === cat);

    let limit = Math.max(1, parseInt((settings.categoryLimits && settings.categoryLimits[cat]) || '10', 10) || 10);
    if (cat === 'common') {
      const prog = getDailyProgressionState();
      limit = Math.max(limit, parseInt(prog.todayQuota || '10', 10) || 10) + (parseInt(prog.adExtraUnlockedToday || '0', 10) || 0);
    } else if (cat === 'pro') {
      limit = Math.max(1, parseInt((settings.proGroup && settings.proGroup.dailyLimit) || limit, 10) || 3);
    } else if (cat === 'quiz') {
      limit = Math.max(1, parseInt((settings.categoryLimits && settings.categoryLimits.quiz) || '30', 10) || 30);
    }

    const completedToday = parseInt(daily.counts[cat] || '0', 10) || 0;
    const totalCompletedInCat = allTasksInCat.filter(t => !!completedMap[t.id]).length;
    const remainingToday = Math.max(0, limit - completedToday);
    const pct = limit > 0 ? Math.min(100, Math.round((completedToday / limit) * 100)) : 0;

    return {
      cat,
      limit,
      completedToday,
      remainingToday,
      totalCompletedInCat,
      totalActiveInCat: allTasksInCat.length,
      pct
    };
  }

  function getCurrencyDisplay(currency, amount) {
    const val = Math.max(0, parseInt(amount || '0', 10) || 0);
    const c = String(currency || 'coins').toLowerCase();
    if (c === 'tickets' || c === 'ticket') return { currency: 'tickets', icon: '🎟️', label: 'Tickets', amount: val };
    if (c === 'stars' || c === 'star') return { currency: 'stars', icon: '⭐', label: 'Stars', amount: val };
    if (c === 'diamonds' || c === 'diamond') return { currency: 'diamonds', icon: '💎', label: 'Diamonds', amount: val };
    return { currency: 'coins', icon: '🪙', label: 'Coins', amount: val };
  }

  function getCommonCompletedCount() {
    const completedMap = getCompletedMap();
    const storedSet = safeJsonParse(localStorage.getItem(COMMON_COMPLETED_IDS_KEY), {});
    const commonIds = new Set(Object.keys(storedSet && typeof storedSet === 'object' ? storedSet : {}));
    const commonTasks = getStoredTasks().filter(t => normalizeCategory(t.category, t) === 'common');
    commonTasks.forEach(t => {
      if (completedMap[t.id]) commonIds.add(t.id);
    });
    // Also count legacy task_common_* keys in completedMap in case tasks were archived/rotated
    Object.keys(completedMap).forEach(id => {
      if (completedMap[id] && String(id).includes('_common_')) commonIds.add(id);
    });
    return commonIds.size;
  }

  function recordCommonCompletedId(taskId) {
    if (!taskId) return;
    const stored = safeJsonParse(localStorage.getItem(COMMON_COMPLETED_IDS_KEY), {});
    const map = (stored && typeof stored === 'object') ? stored : {};
    map[taskId] = Date.now();
    localStorage.setItem(COMMON_COMPLETED_IDS_KEY, JSON.stringify(map));
  }

  function getGoogleCompletedIds() {
    const completedMap = getCompletedMap();
    const rawList = safeJsonParse(localStorage.getItem(GOOGLE_COMPLETED_IDS_KEY), []);
    const idSet = new Set(Array.isArray(rawList) ? rawList.filter(Boolean).map(String) : []);
    getStoredTasks()
      .filter(t => normalizeCategory(t.category, t) === 'google')
      .forEach(t => {
        if (completedMap[t.id]) idSet.add(String(t.id));
      });
    Object.keys(completedMap).forEach(id => {
      if (completedMap[id] && String(id).includes('_google_')) idSet.add(String(id));
    });
    return Array.from(idSet);
  }

  function getGoogleCompletedCount() {
    return getGoogleCompletedIds().length;
  }

  function recordGoogleCompletedId(taskId) {
    if (!taskId) return;
    const rawList = safeJsonParse(localStorage.getItem(GOOGLE_COMPLETED_IDS_KEY), []);
    const idSet = new Set(Array.isArray(rawList) ? rawList.filter(Boolean).map(String) : []);
    idSet.add(String(taskId));
    localStorage.setItem(GOOGLE_COMPLETED_IDS_KEY, JSON.stringify(Array.from(idSet)));
  }

  function getStarUnlockedCostsMap() {
    const raw = safeJsonParse(localStorage.getItem(STAR_UNLOCKED_COSTS_KEY), {});
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  }

  function saveStarUnlockedCostsMap(map) {
    localStorage.setItem(STAR_UNLOCKED_COSTS_KEY, JSON.stringify(map || {}));
  }

  function getStarRequiredGoogleCount(task) {
    const settings = getSettings();
    const globalReq = Math.max(1, parseInt((settings.starUnlock && settings.starUnlock.googleTasksPerUnlock) || '2', 10) || 2);
    if (!task) return globalReq;
    if (task.customGoogleReq) {
      const raw = parseInt(task.googleFormRequired !== undefined ? task.googleFormRequired : task.requiredGoogleTasks, 10);
      if (!isNaN(raw) && raw >= 1) return raw;
    }
    return globalReq;
  }

  function getStarUnlockProgress() {
    const settings = getSettings();
    const globalReq = Math.max(1, parseInt((settings.starUnlock && settings.starUnlock.googleTasksPerUnlock) || '2', 10) || 2);
    const googleDone = getGoogleCompletedCount();
    const costsMap = getStarUnlockedCostsMap();
    const spentGoogleCredits = Object.values(costsMap).reduce((sum, v) => {
      const n = parseInt(v, 10);
      return sum + (isNaN(n) ? 0 : Math.max(0, n));
    }, 0);
    const availableGoogleCredits = Math.max(0, googleDone - spentGoogleCredits);
    const availableUnlocks = Math.floor(availableGoogleCredits / globalReq);
    return {
      googleDone,
      spentGoogleCredits,
      availableGoogleCredits,
      globalReq,
      availableUnlocks,
      unlockedCount: Object.keys(costsMap).length
    };
  }

  function getQuizTargetCommonCount(task) {
    if (!task) return 0;
    const raw = task.targetCommonTasks !== undefined ? task.targetCommonTasks
      : (task.commonTarget !== undefined ? task.commonTarget : (task.requiredCommonTasks !== undefined ? task.requiredCommonTasks : 5));
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : Math.max(0, n);
  }

  function getTaskCostInfo(task) {
    if (!task) return { currency: 'coins', icon: '🪙', label: 'Coins', amount: 0 };
    const cat = normalizeCategory(task.category, task);
    if (cat === 'common') return { currency: 'coins', icon: '🪙', label: 'Free', amount: 0 };
    if (cat === 'star') return { currency: 'google_tasks', icon: '📝', label: 'Google Form', amount: getStarRequiredGoogleCount(task) };
    if (cat === 'ultra') return { currency: 'stars', icon: '⭐', label: 'Stars', amount: ULTRA_UNLOCK_STARS };
    if (cat === 'quiz') {
      const qAmt = Math.max(0, parseInt(task.diamondCost !== undefined ? task.diamondCost : (task.unlockCost || '0'), 10) || 0);
      return qAmt > 0 ? getCurrencyDisplay('diamonds', qAmt) : { currency: 'diamonds', icon: '💎', label: 'Free', amount: 0 };
    }

    if (task.unlockCost !== undefined && task.unlockCost !== null && task.unlockCost !== '') {
      const amt = Math.max(0, parseInt(task.unlockCost, 10) || 0);
      if (amt > 0) return getCurrencyDisplay(task.unlockCurrency || 'coins', amt);
      return { currency: task.unlockCurrency || 'coins', icon: getCurrencyDisplay(task.unlockCurrency || 'coins', 0).icon, label: 'Free', amount: 0 };
    }
    if (parseInt(task.ticketCost || '0', 10) > 0) return getCurrencyDisplay('tickets', task.ticketCost);
    if (parseInt(task.starCost || '0', 10) > 0) return getCurrencyDisplay('stars', task.starCost);
    if (parseInt(task.diamondCost || '0', 10) > 0) return getCurrencyDisplay('diamonds', task.diamondCost);
    if (parseInt(task.coinCost || '0', 10) > 0) return getCurrencyDisplay('coins', task.coinCost);
    return { currency: 'coins', icon: '🪙', label: 'Free', amount: 0 };
  }

  function getTaskRewardInfo(task) {
    if (!task) return { coins: 0, tickets: 0, stars: 0, diamonds: 0, inr: 0 };
    const cat = normalizeCategory(task.category, task);
    const hasVal = (v) => v !== undefined && v !== null && v !== '';
    if (cat === 'quiz') return { coins: 0, tickets: 0, stars: 0, diamonds: 0, inr: 0 };
    if (cat === 'ultra') return { coins: 0, tickets: 0, stars: ULTRA_REWARD_STARS, diamonds: 0, inr: 0 };
    if (cat === 'diamond' || cat === 'google') {
      const dRaw = hasVal(task.rewardDiamonds) ? task.rewardDiamonds : (hasVal(task.diamondReward) ? task.diamondReward : 1);
      return { coins: 0, tickets: 0, stars: 0, diamonds: Math.max(1, parseInt(dRaw, 10) || 1), inr: 0 };
    }

    const rawStars = hasVal(task.rewardStars) ? task.rewardStars : (hasVal(task.stars) ? task.stars : 0);
    const stars = Math.max(0, parseInt(rawStars, 10) || 0);
    if (cat === 'star') {
      return { coins: 0, tickets: 0, stars, diamonds: 0, inr: 0 };
    }

    const rawCoins = hasVal(task.rewardCoins) ? task.rewardCoins
      : (hasVal(task.bonusCoins) ? task.bonusCoins
      : (hasVal(task.reward) ? task.reward
      : (hasVal(task.coins) ? task.coins : 0)));
    const coins = Math.max(0, parseInt(rawCoins, 10) || 0);

    const rawTickets = hasVal(task.rewardTickets) ? task.rewardTickets
      : (hasVal(task.ticketReward) ? task.ticketReward
      : (hasVal(task.tickets) ? task.tickets : (cat === 'common' && coins === 0 ? 50 : 0)));
    const tickets = Math.max(0, parseInt(rawTickets, 10) || 0);

    const diamonds = Math.max(0, parseInt(task.rewardDiamonds || '0', 10) || 0);
    const inr = Math.max(0, parseInt(task.inrReward || '0', 10) || 0);
    return { coins, tickets, stars, diamonds, inr };
  }

  function formatRewardParts(rew, task) {
    const cat = task ? normalizeCategory(task.category, task) : '';
    if (cat === 'quiz') return '🧠 Challenge (No Coin Reward)';
    const parts = [];
    if (rew.coins > 0) parts.push(`🪙 +${rew.coins.toLocaleString()}`);
    if (rew.tickets > 0) parts.push(`🎟️ +${rew.tickets.toLocaleString()}`);
    if (rew.stars > 0) parts.push(`⭐ +${rew.stars.toLocaleString()}`);
    if (rew.diamonds > 0) parts.push(`💎 +${rew.diamonds.toLocaleString()}`);
    return parts.length > 0 ? parts.join(' • ') : 'Free Mission';
  }

  function getTaskTimingStatus(task) {
    const now = Date.now();
    const cat = normalizeCategory(task.category, task);
    const startMs = task.startDateTime ? new Date(task.startDateTime).getTime() : (task.eventStartTime ? Number(task.eventStartTime) : 0);
    const endMs = task.endDateTime ? new Date(task.endDateTime).getTime() : (task.eventEndTime ? Number(task.eventEndTime) : 0);

    if (startMs && !isNaN(startMs) && now < startMs) {
      return { status: 'upcoming', startsInMs: startMs - now, startMs };
    }
    if (endMs && !isNaN(endMs) && now > endMs) {
      return { status: 'expired', expiredAgoMs: now - endMs, endMs };
    }

    // Ultra 24-hour expiry timer starts strictly upon Player Unlock
    if (cat === 'ultra') {
      const unlockedMap = getUnlockedMap();
      const u = unlockedMap[task.id];
      const completedMap = getCompletedMap();
      if (u && !completedMap[task.id]) {
        const exp = Number(u.expiresAt || (Number(u.unlockedAt || 0) + ULTRA_DURATION_MS));
        if (exp > 0 && now >= exp) {
          return { status: 'expired', expiredAgoMs: now - exp, endMs: exp };
        }
        return { status: 'active', endMs: exp, countdownSec: 86400 };
      }
      return { status: 'active', endMs: 0, countdownSec: 86400, startsOnUnlock: true };
    }

    // Quiz countdown timer check after Open
    const openedMap = getOpenedMap();
    const opened = openedMap[task.id];
    const countdownSec = parseInt(task.countdownSeconds || task.expirySeconds || (cat === 'quiz' ? (task.timerDurationSec || task.timer || 0) : 0), 10) || 0;
    if (cat === 'quiz' && opened && opened.expiresAt && now > Number(opened.expiresAt)) {
      return { status: 'expired', expiredAgoMs: now - Number(opened.expiresAt), endMs: Number(opened.expiresAt) };
    }

    return {
      status: 'active',
      endMs: endMs || (opened && opened.expiresAt ? Number(opened.expiresAt) : 0),
      countdownSec
    };
  }

  // Pro 3-in-1 Group Helpers (Supports 1 or multiple 3-task packages cleanly)
  function getProGroupStateMap() {
    const m = safeJsonParse(localStorage.getItem(PRO_GROUP_STATE_KEY), {});
    return (m && typeof m === 'object') ? m : {};
  }

  function saveProGroupStateMap(m) {
    localStorage.setItem(PRO_GROUP_STATE_KEY, JSON.stringify(m));
  }

  function buildProGroupBundles() {
    const settings = getSettings();
    const proCfg = settings.proGroup || {};
    const allPro = getStoredTasks().filter(t => normalizeCategory(t.category, t) === 'pro');
    if (allPro.length === 0) return [];

    const packMap = new Map();
    allPro.forEach(t => {
      const gid = t.eventPackId || t.groupId || 'pro_default_group';
      if (!packMap.has(gid)) packMap.set(gid, []);
      packMap.get(gid).push(t);
    });

    const stateMap = getProGroupStateMap();
    const bundles = [];
    packMap.forEach((packTasks, groupId) => {
      const groupTasks = packTasks.slice(0, 3);
      const refTask = groupTasks[0];
      const costAmount = (refTask.groupCostAmount !== undefined && refTask.groupCostAmount !== '')
        ? Math.max(0, parseInt(refTask.groupCostAmount, 10) || 0)
        : Math.max(0, parseInt(proCfg.costAmount || '0', 10) || 0);
      const costCurrency = refTask.groupCostCurrency || proCfg.costCurrency || 'coins';
      const costInfo = getCurrencyDisplay(costCurrency, costAmount);
      const grpState = stateMap[groupId] || null;

      let sharedEndMs = 0;
      if (refTask.eventEndTime && Number(refTask.eventEndTime) > 0) {
        sharedEndMs = Number(refTask.eventEndTime);
      } else if (refTask.endDateTime) {
        const parsedEnd = new Date(refTask.endDateTime).getTime();
        if (!isNaN(parsedEnd)) sharedEndMs = parsedEnd;
      } else if (grpState && grpState.expiresAt) {
        sharedEndMs = Number(grpState.expiresAt);
      }

      const durationMinutes = Math.max(1, parseInt(refTask.timerMinutes || proCfg.timerMinutes || '1440', 10) || 1440);
      const isUnlocked = costAmount <= 0 || !!(grpState && grpState.unlocked);
      const isExpired = sharedEndMs > 0 && Date.now() >= sharedEndMs;

      bundles.push({
        groupId,
        tasks: groupTasks,
        costInfo,
        durationMinutes,
        sharedEndMs,
        isUnlocked,
        isExpired,
        active: proCfg.active !== false
      });
    });

    return bundles;
  }

  function buildProGroupBundle() {
    const bundles = buildProGroupBundles();
    return bundles[0] || null;
  }

  async function unlockProGroup(groupId, costAmount, costCurrency, durationMinutes) {
    if (costAmount > 0) {
      const bal = (window.firebaseSync && window.firebaseSync.getCurrencyBalance(costCurrency)) || 0;
      const meta = getCurrencyDisplay(costCurrency, costAmount);
      if (bal < costAmount) {
        alert(`❌ Insufficient ${meta.label}! You need ${meta.icon} ${costAmount.toLocaleString()} ${meta.label} to unlock the Pro 3-Task Group (Balance: ${bal.toLocaleString()}).`);
        return false;
      }
      if (!confirm(`💎 Unlock Pro 3-Task Group for ${meta.icon} ${costAmount.toLocaleString()} ${meta.label}?`)) {
        return false;
      }

      const deltaKey = costCurrency === 'tickets' ? 'deltaTickets' : (costCurrency === 'stars' ? 'deltaStars' : (costCurrency === 'diamonds' ? 'deltaDiamonds' : 'deltaCoins'));
      const txId = `unlock_pro_group_${groupId}_${Date.now()}`;
      if (window.Firebase && typeof window.Firebase.atomicBalanceMutation === 'function') {
        const res = await window.Firebase.atomicBalanceMutation({
          [deltaKey]: -costAmount,
          reason: 'Unlock Pro 3-Task Group',
          txId
        });
        if (!res.ok) {
          alert(`❌ ${res.error || 'Unlock failed.'}`);
          return false;
        }
      } else if (window.firebaseSync) {
        const ok = window.firebaseSync.spendCurrency(costCurrency, costAmount, 'Unlock Pro Group');
        if (ok === false) return false;
      }
    }

    const stateMap = getProGroupStateMap();
    const now = Date.now();
    const durMs = Math.max(60000, (parseInt(durationMinutes || '1440', 10) || 1440) * 60000);
    stateMap[groupId] = {
      unlocked: true,
      unlockedAt: now,
      expiresAt: now + durMs
    };
    saveProGroupStateMap(stateMap);
    syncUserStateToCloud();
    refreshAllTaskViews();
    return true;
  }

  async function unlockSingleTask(taskId) {
    const task = getStoredTasks().find(t => t.id === taskId);
    if (!task) return false;
    const cat = normalizeCategory(task.category, task);
    if (cat === 'star') {
      const unlockedMap = getUnlockedMap();
      if (unlockedMap[taskId]) return true;
      const gReq = getStarRequiredGoogleCount(task);
      const starProg = getStarUnlockProgress();
      if (starProg.availableGoogleCredits < gReq) {
        const missing = gReq - starProg.availableGoogleCredits;
        alert(`🔒 Google Form Tasks Required!\nComplete ${missing} more Google Form Task(s) to unlock this Star Task (${starProg.availableGoogleCredits}/${gReq} credits ready).`);
        return false;
      }
      const costsMap = getStarUnlockedCostsMap();
      costsMap[taskId] = gReq;
      saveStarUnlockedCostsMap(costsMap);
      unlockedMap[taskId] = {
        unlockedAt: Date.now(),
        expiresAt: 0,
        currency: 'google_tasks',
        amount: gReq
      };
      saveUnlockedMap(unlockedMap);
      syncUserStateToCloud();
      refreshAllTaskViews();
      return true;
    }
    if (cat === 'quiz') {
      const targetCommon = getQuizTargetCommonCount(task);
      const commonDone = getCommonCompletedCount();
      if (commonDone < targetCommon) {
        alert(`🔒 Step 1 Required!\nComplete ${targetCommon} Common Tasks first before unlocking this Quiz Task (${commonDone}/${targetCommon} completed).`);
        return false;
      }
    }
    const cost = getTaskCostInfo(task);
    const unlockedMap = getUnlockedMap();
    if (unlockedMap[taskId] || cost.amount <= 0) return true;

    const bal = (window.firebaseSync && window.firebaseSync.getCurrencyBalance(cost.currency)) || 0;
    if (bal < cost.amount) {
      alert(`❌ Insufficient ${cost.label}! Need ${cost.icon} ${cost.amount.toLocaleString()} (Available: ${bal.toLocaleString()}).`);
      return false;
    }
    const extraWarn = cat === 'ultra' ? '\n\n⏱️ 24-Hour Timer starts immediately upon unlock! Unfinished tasks auto-remove after 24h.' : '';
    if (!confirm(`🔓 Unlock "${task.title || 'Mission'}" for ${cost.icon} ${cost.amount.toLocaleString()} ${cost.label}?${extraWarn}`)) {
      return false;
    }

    const deltaKey = cost.currency === 'tickets' ? 'deltaTickets' : (cost.currency === 'stars' ? 'deltaStars' : (cost.currency === 'diamonds' ? 'deltaDiamonds' : 'deltaCoins'));
    const txId = `unlock_task_${taskId}_${cost.currency}_${cost.amount}`;
    if (window.Firebase && typeof window.Firebase.atomicBalanceMutation === 'function') {
      const mut = await window.Firebase.atomicBalanceMutation({
        [deltaKey]: -cost.amount,
        reason: `Unlock Task: ${task.title || taskId}`,
        txId
      });
      if (!mut.ok) {
        if (!mut.duplicate) {
          alert(`❌ ${mut.error || 'Could not deduct balance.'}`);
          return false;
        }
      }
    } else if (window.firebaseSync) {
      const r = window.firebaseSync.spendCurrency(cost.currency, cost.amount, `Unlock Task: ${task.title || taskId}`);
      if (r === false) return false;
    }

    const now = Date.now();
    unlockedMap[taskId] = {
      unlockedAt: now,
      expiresAt: cat === 'ultra' ? (now + ULTRA_DURATION_MS) : 0,
      currency: cost.currency,
      amount: cost.amount
    };
    saveUnlockedMap(unlockedMap);
    syncUserStateToCloud();
    refreshAllTaskViews();
    return true;
  }

  function handleOpenTask(taskId) {
    const task = getStoredTasks().find(t => t.id === taskId);
    if (!task) return;

    const timing = getTaskTimingStatus(task);
    if (timing.status === 'upcoming') {
      alert(`⏳ This task has not started yet. Starts at: ${new Date(timing.startMs).toLocaleString()}`);
      return;
    }
    if (timing.status === 'expired') {
      alert('⌛ This task timer has expired.');
      refreshAllTaskViews();
      return;
    }

    const cat = normalizeCategory(task.category, task);
    if (cat === 'star') {
      const unlockedMap = getUnlockedMap();
      if (!unlockedMap[taskId]) {
        const gReq = getStarRequiredGoogleCount(task);
        const starProg = getStarUnlockProgress();
        alert(`🔒 Star Task Locked!\nComplete ${Math.max(0, gReq - starProg.availableGoogleCredits)} more Google Form Task(s) and click Unlock first.`);
        return;
      }
    }
    if (cat === 'quiz') {
      const targetCommon = getQuizTargetCommonCount(task);
      const commonDone = getCommonCompletedCount();
      if (commonDone < targetCommon) {
        alert(`🔒 Step 1 Required: Complete ${targetCommon} Common Tasks first (${commonDone}/${targetCommon}).`);
        return;
      }
      const cost = getTaskCostInfo(task);
      const unlockedMap = getUnlockedMap();
      if (cost.amount > 0 && !unlockedMap[taskId]) {
        alert(`🔒 Step 2 Required: Unlock with ${cost.icon} ${cost.amount.toLocaleString()} ${cost.label}.`);
        return;
      }
    }
    const dailyState = getCategoryDailyState();
    const alreadyCountedToday = !!(dailyState.openedIds && dailyState.openedIds[cat] && dailyState.openedIds[cat][taskId]);
    const limitInfo = getCategoryLimitInfo(cat);
    const openedMap = getOpenedMap();
    const existing = openedMap[taskId];

    if (!existing && !alreadyCountedToday && limitInfo.remainingToday <= 0) {
      if (cat === 'common') {
        alert(`📺 Daily limit reached (${limitInfo.limit}/${limitInfo.limit}). Tap "Watch Ad (+${Math.max(1, parseInt((getSettings().dailyProgression && getSettings().dailyProgression.adExtraTaskCount) || '20', 10) || 20)} Tasks)" to renew more tasks!`);
      } else {
        alert(`🔒 Daily limit reached for ${CATEGORY_META[cat].title} (${limitInfo.limit}/${limitInfo.limit}).`);
      }
      return;
    }

    // Open target URL in a new tab when clicking Open without showing any link text inside task tabs
    const taskUrl = String(task.url || task.link || '').trim();
    if (taskUrl && /^https?:\/\//i.test(taskUrl)) {
      try { window.open(taskUrl, '_blank', 'noopener,noreferrer'); } catch (e) {}
    }

    const now = Date.now();
    const rawTimer = task.timerDuration !== undefined ? task.timerDuration
      : (task.timerSeconds !== undefined ? task.timerSeconds : (task.timer !== undefined ? task.timer : 0));
    const waitSec = cat === 'star' ? 0 : Math.max(0, parseInt(rawTimer, 10) || 0);
    const quizExpirySec = cat === 'quiz'
      ? (parseInt(task.countdownSeconds || task.expirySeconds || rawTimer || 300, 10) || 300)
      : 0;

    if (!existing) {
      openedMap[taskId] = {
        openedAt: now,
        readyAt: now + (cat === 'quiz' || cat === 'star' ? 0 : waitSec * 1000),
        expiresAt: quizExpirySec > 0 ? (now + quizExpirySec * 1000) : 0
      };
      saveOpenedMap(openedMap);
    }

    // Add task open click toward today's Common/category progress count (without double counting)
    recordCategoryTaskOpened(cat, taskId);
    refreshAllTaskViews();
  }

  function ensureVerifyModalInDom() {
    let overlay = document.getElementById('taskVerifyModalOverlay');
    if (overlay && document.getElementById('verifyCodeInput')) return overlay;

    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'taskVerifyModalOverlay';
    overlay.className = 'modal-backdrop';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.82);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;z-index:99999;padding:16px;';
    overlay.onclick = (e) => { if (e.target === overlay) closeVerifyModal(); };
    overlay.innerHTML = `
      <form onsubmit="submitTaskVerification(event)" style="width:100%;max-width:360px;background:linear-gradient(160deg,#0f172a 0%,#060e24 100%);border:1.5px solid rgba(56,189,248,0.45);border-radius:18px;padding:1.25rem;box-shadow:0 18px 48px rgba(0,0,0,0.8);color:#fff;text-align:center;" onclick="event.stopPropagation()">
        <div style="font-size:2.4rem;margin-bottom:0.3rem;">🔐</div>
        <h3 id="verifyModalTitle" style="margin:0 0 0.35rem 0;font-size:1.05rem;font-weight:900;color:#fff;">Verify Mission</h3>
        <div id="verifyModalBountyPill" style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(56,189,248,0.16);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;font-size:0.76rem;font-weight:800;margin-bottom:0.6rem;">+0</div>
        <p id="verifyModalDesc" style="margin:0 0 0.75rem 0;font-size:0.78rem;color:#94a3b8;line-height:1.45;">Enter the verification code configured by Admin to claim your reward.</p>
        <input type="text" id="verifyCodeInput" maxlength="6" inputmode="numeric" placeholder="Enter 4-6 digit code" style="width:100%;box-sizing:border-box;padding:0.65rem 0.85rem;border-radius:10px;border:1.5px solid rgba(56,189,248,0.45);background:#020617;color:#facc15;font-family:monospace;font-size:1.15rem;font-weight:900;letter-spacing:4px;text-align:center;margin-bottom:0.5rem;" />
        <div id="verifyErrorMsg" style="display:none;color:#f87171;font-size:0.74rem;font-weight:800;margin-bottom:0.5rem;"></div>
        <div style="display:flex;gap:8px;margin-top:0.35rem;">
          <button type="button" onclick="closeVerifyModal()" style="flex:1;padding:0.6rem;border-radius:10px;border:1px solid rgba(148,163,184,0.35);background:rgba(30,41,59,0.8);color:#cbd5e1;font-weight:800;cursor:pointer;">Cancel</button>
          <button type="submit" id="btnVerifyConfirm" style="flex:1.4;padding:0.6rem;border-radius:10px;border:none;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;font-weight:900;cursor:pointer;">Verify &amp; Claim ✓</button>
        </div>
      </form>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function openVerifyModal(taskId) {
    const task = getStoredTasks().find(t => t.id === taskId);
    if (!task) return;

    const timing = getTaskTimingStatus(task);
    if (timing.status === 'expired') {
      alert('⌛ Timer expired! This task can no longer be verified or claimed.');
      refreshAllTaskViews();
      return;
    }

    const completedMap = getCompletedMap();
    if (completedMap[taskId]) {
      alert('✓ This task has already been completed and rewarded.');
      return;
    }

    const cat = normalizeCategory(task.category, task);
    if (cat === 'pro') {
      const bundles = buildProGroupBundles();
      const targetPackId = task.eventPackId || task.groupId || 'pro_default_group';
      const bundle = bundles.find(b => b.groupId === targetPackId) || bundles[0];
      if (bundle && (bundle.isExpired || !bundle.isUnlocked)) {
        alert(bundle.isExpired ? '⌛ Pro group timer expired.' : '🔒 Unlock the Pro Group first.');
        return;
      }
    }

    const overlay = ensureVerifyModalInDom();
    _activeVerifyTaskId = taskId;

    const titleEl = document.getElementById('verifyModalTitle');
    const pillEl = document.getElementById('verifyModalBountyPill');
    const codeInput = document.getElementById('verifyCodeInput');
    const errEl = document.getElementById('verifyErrorMsg');

    const rew = getTaskRewardInfo(task);
    if (titleEl) titleEl.textContent = task.title || 'Verify Mission';
    if (pillEl) pillEl.textContent = formatRewardParts(rew, task);
    if (codeInput) {
      codeInput.value = '';
      setTimeout(() => codeInput.focus(), 40);
    }
    if (errEl) {
      errEl.style.display = 'none';
      errEl.textContent = '';
    }

    overlay.style.display = 'flex';
    overlay.classList.add('active');
  }

  function closeVerifyModal() {
    _activeVerifyTaskId = null;
    const overlay = document.getElementById('taskVerifyModalOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
    }
  }

  async function submitTaskVerification(evt) {
    if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
    if (_verifyBusy || !_activeVerifyTaskId) return;

    const taskId = _activeVerifyTaskId;
    const task = getStoredTasks().find(t => t.id === taskId);
    const errEl = document.getElementById('verifyErrorMsg');
    const codeInput = document.getElementById('verifyCodeInput');
    const btn = document.getElementById('btnVerifyConfirm');

    if (!task) {
      closeVerifyModal();
      return;
    }

    const completedMap = getCompletedMap();
    if (completedMap[taskId]) {
      closeVerifyModal();
      return;
    }

    // Expiry check right before rewarding (Req #6 & #11)
    const timing = getTaskTimingStatus(task);
    if (timing.status === 'expired') {
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = '⌛ Timer expired before verification. No reward can be awarded.';
      }
      refreshAllTaskViews();
      return;
    }
    const cat = normalizeCategory(task.category, task);
    if (cat === 'pro') {
      const targetPackId = task.eventPackId || task.groupId || 'pro_default_group';
      const bundle = buildProGroupBundles().find(b => b.groupId === targetPackId) || buildProGroupBundle();
      if (bundle && (bundle.isExpired || !bundle.isUnlocked)) {
        if (errEl) {
          errEl.style.display = 'block';
          errEl.textContent = '⌛ Pro group countdown expired. No reward awarded.';
        }
        refreshAllTaskViews();
        return;
      }
    }

    const entered = (codeInput ? codeInput.value : '').trim();
    const expected = String(task.verificationCode || task.code || task.secretCode || '').trim();
    if (!expected || entered !== expected) {
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = '❌ Invalid verification code. Enter the exact code configured by Admin.';
      }
      if (codeInput) codeInput.focus();
      return;
    }

    const dailyStateForVerify = getCategoryDailyState();
    const wasOpenedInQuota = !!(dailyStateForVerify.openedIds && dailyStateForVerify.openedIds[cat] && dailyStateForVerify.openedIds[cat][taskId]);
    const limitInfo = getCategoryLimitInfo(cat);
    if (!wasOpenedInQuota && limitInfo.remainingToday <= 0) {
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = `🔒 Daily limit reached (${limitInfo.limit}/${limitInfo.limit}).`;
      }
      return;
    }

    _verifyBusy = true;
    if (btn) btn.disabled = true;
    try {
      const pendingMap = getPendingPrizesMap();
      pendingMap[taskId] = Date.now();
      savePendingPrizesMap(pendingMap);

      closeVerifyModal();
      refreshAllTaskViews();
      syncUserStateToCloud();
      openTaskPrizePopup(taskId);
    } finally {
      _verifyBusy = false;
      if (btn) btn.disabled = false;
    }
  }

  const PENDING_PRIZES_KEY = 'tap_empire_pending_prizes';
  const FALLBACK_SPONSOR_LINKS_20 = [
    'https://uplcm.com/4/12169313',
    'https://uplcm.com/4/12169338',
    'https://uplcm.com/4/12169321',
    'https://uplcm.com/4/12169324',
    'https://uplcm.com/4/12169336',
    'https://uplcm.com/4/11834220',
    'https://uplcm.com/4/12169323',
    'https://uplcm.com/4/11616083',
    'https://uplcm.com/4/12169326',
    'https://uplcm.com/4/12169318',
    'https://uplcm.com/4/12169312',
    'https://uplcm.com/4/12169337',
    'https://uplcm.com/4/12169328',
    'https://uplcm.com/4/12169335',
    'https://uplcm.com/4/12169339',
    'https://uplcm.com/4/12169319',
    'https://uplcm.com/4/10684653',
    'https://uplcm.com/4/12169325',
    'https://uplcm.com/4/12169330',
    'https://uplcm.com/4/11834221'
  ];

  const ENGINE_BASE_URL = (() => {
    try {
      const cs = document.currentScript && document.currentScript.src;
      if (cs) return new URL('.', cs).href;
    } catch (e) {}
    return '../../';
  })();

  let _activePrizeTaskId = null;
  let _prizeClaimBusy = false;

  function getPendingPrizesMap() {
    const m = safeJsonParse(localStorage.getItem(PENDING_PRIZES_KEY), {});
    return (m && typeof m === 'object') ? m : {};
  }

  function savePendingPrizesMap(map) {
    localStorage.setItem(PENDING_PRIZES_KEY, JSON.stringify(map || {}));
  }

  function openTenTaskSponsorLinks(seed) {
    if (typeof window.openTenSponsorAdLinks === 'function') {
      return window.openTenSponsorAdLinks(seed);
    }
    const list = (Array.isArray(window.PASS_SPONSOR_LINKS_20) && window.PASS_SPONSOR_LINKS_20.length > 0)
      ? window.PASS_SPONSOR_LINKS_20
      : FALLBACK_SPONSOR_LINKS_20;
    const total = Math.min(10, list.length);
    const start = Math.abs(parseInt(seed || Date.now(), 10)) % list.length;
    const openedUrls = [];
    for (let offset = 0; offset < total; offset++) {
      const url = list[(start + offset) % list.length];
      openedUrls.push(url);
      try {
        const adTab = window.open(url, '_blank');
        if (adTab) {
          try { adTab.blur(); } catch (e) {}
        }
      } catch (err) {}
    }
    try { window.focus(); } catch (e) {}
    return openedUrls;
  }

  function getPrizeStickerUrl(rew, cat) {
    if (rew.stars > 0) return `${ENGINE_BASE_URL}assets/stickers/sticker-star.png`;
    if (rew.coins > 0) return `${ENGINE_BASE_URL}assets/stickers/sticker-coin.png`;
    if (rew.diamonds > 0) return `${ENGINE_BASE_URL}assets/stickers/sticker-diamond.png`;
    if (rew.tickets > 0) return `${ENGINE_BASE_URL}assets/stickers/sticker-ticket.png`;
    if (cat === 'quiz') return `${ENGINE_BASE_URL}assets/stickers/sticker-crown.png`;
    return `${ENGINE_BASE_URL}assets/stickers/sticker-gift.png`;
  }

  function ensureTaskPrizePopupInDom() {
    let overlay = document.getElementById('taskPrizePopupOverlay');
    if (overlay && document.getElementById('btnPrizeModalClose')) return overlay;
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'taskPrizePopupOverlay';
    overlay.className = 'modal-backdrop';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.86);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;z-index:100001;padding:16px;';
    overlay.onclick = (e) => { if (e.target === overlay) closeTaskPrizePopup(); };
    overlay.innerHTML = `
      <div class="task-prize-popup-card" style="position:relative;width:100%;max-width:370px;background:linear-gradient(160deg,#0f1d40 0%,#060e24 100%);border:2px solid rgba(56,189,248,0.55);border-radius:22px;padding:1.35rem 1.2rem 1.2rem;box-shadow:0 20px 52px rgba(0,0,0,0.88),0 0 32px rgba(56,189,248,0.28);color:#fff;text-align:center;" onclick="event.stopPropagation()">
        <button type="button" id="btnClosePrizePopup" onclick="TapEngine.closeTaskPrizePopup()" aria-label="Close prize popup" title="Close" style="position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.22);color:#e2e8f0;font-size:0.95rem;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        <div id="prizePopupBadge" style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:rgba(16,185,129,0.18);border:1px solid rgba(52,211,153,0.45);color:#34d399;font-size:0.72rem;font-weight:900;letter-spacing:0.04em;margin-bottom:0.7rem;">✓ TASK COMPLETED</div>
        <div id="prizePopupIconWrap" style="width:76px;height:76px;margin:0 auto 0.65rem;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 8px 18px rgba(0,0,0,0.65));"></div>
        <h3 id="prizePopupTitle" style="margin:0 0 0.35rem 0;font-size:1.12rem;font-weight:900;color:#ffffff;">Task Prize Ready!</h3>
        <div id="prizePopupValueBox" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0.55rem 1.1rem;border-radius:14px;background:rgba(250,204,21,0.14);border:1.5px solid rgba(250,204,21,0.5);color:#fde047;font-size:1.18rem;font-weight:900;margin:0.25rem 0 0.65rem;box-shadow:0 0 18px rgba(250,204,21,0.2);">+0</div>
        <p id="prizePopupHint" style="margin:0 0 1rem 0;font-size:0.78rem;color:#cbd5e1;line-height:1.45;"></p>
        <div id="prizePopupActionsRow" style="display:flex;gap:8px;align-items:center;">
          <button type="button" id="btnPrizeModalClose" onclick="TapEngine.closeTaskPrizePopup()" style="flex:0.85;padding:0.72rem 0.75rem;border-radius:12px;border:1px solid rgba(148,163,184,0.38);background:rgba(30,41,59,0.85);color:#cbd5e1;font-size:0.84rem;font-weight:800;cursor:pointer;">Close</button>
          <button type="button" id="btnPrizeCollect" onclick="TapEngine.claimTaskPrizeFromPopup(false)" style="flex:1.55;padding:0.74rem 0.9rem;border-radius:12px;border:none;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;font-size:0.88rem;font-weight:900;cursor:pointer;box-shadow:0 6px 18px rgba(16,185,129,0.45);display:none;">🎁 Collect</button>
          <button type="button" id="btnPrizeWatchAds10" onclick="TapEngine.claimTaskPrizeFromPopup(true)" style="flex:1.55;padding:0.74rem 0.9rem;border-radius:12px;border:1px solid #fde047;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#0f172a;font-size:0.86rem;font-weight:900;cursor:pointer;box-shadow:0 6px 18px rgba(245,158,11,0.45);display:none;">📺 Watch Ads (10)</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function openTaskPrizePopup(taskId) {
    const task = getStoredTasks().find(t => t.id === taskId);
    if (!task) return;
    const completedMap = getCompletedMap();
    if (completedMap[taskId]) {
      const pending = getPendingPrizesMap();
      if (pending[taskId]) {
        delete pending[taskId];
        savePendingPrizesMap(pending);
      }
      return;
    }

    const overlay = ensureTaskPrizePopupInDom();
    _activePrizeTaskId = taskId;

    const cat = normalizeCategory(task.category, task);
    const rew = getTaskRewardInfo(task);
    const requiresWatchAds10 = (rew.coins > 0 || rew.stars > 0);
    const rewardSummary = cat === 'quiz' ? '🧠 +1 Pass Level (Challenge Done)' : formatRewardParts(rew, task);

    const iconWrap = document.getElementById('prizePopupIconWrap');
    const titleEl = document.getElementById('prizePopupTitle');
    const valEl = document.getElementById('prizePopupValueBox');
    const hintEl = document.getElementById('prizePopupHint');
    const btnCollect = document.getElementById('btnPrizeCollect');
    const btnWatch10 = document.getElementById('btnPrizeWatchAds10');

    const stickerUrl = getPrizeStickerUrl(rew, cat);
    if (iconWrap) {
      iconWrap.innerHTML = `<img src="${escapeHtml(stickerUrl)}" alt="Prize" style="width:68px;height:68px;object-fit:contain;display:block;" />`;
    }
    if (titleEl) titleEl.textContent = task.title || 'Task Completed!';
    if (valEl) valEl.textContent = rewardSummary;

    if (requiresWatchAds10) {
      if (hintEl) hintEl.textContent = 'Click Watch Ads to open 10 sponsor ad links and collect your Coin/Star prize!';
      if (btnCollect) btnCollect.style.display = 'none';
      if (btnWatch10) {
        btnWatch10.style.display = 'inline-flex';
        btnWatch10.style.alignItems = 'center';
        btnWatch10.style.justifyContent = 'center';
        btnWatch10.style.gap = '6px';
        btnWatch10.disabled = false;
        btnWatch10.textContent = '📺 Watch Ads (10 Links)';
      }
    } else {
      if (hintEl) hintEl.textContent = 'Verification successful! Tap Collect to claim your prize value now.';
      if (btnWatch10) btnWatch10.style.display = 'none';
      if (btnCollect) {
        btnCollect.style.display = 'inline-flex';
        btnCollect.style.alignItems = 'center';
        btnCollect.style.justifyContent = 'center';
        btnCollect.style.gap = '6px';
        btnCollect.disabled = false;
        btnCollect.textContent = cat === 'quiz' ? '✓ Collect Progress' : `🎁 Collect`;
      }
    }

    overlay.style.display = 'flex';
    overlay.classList.add('active');
  }

  function closeTaskPrizePopup() {
    _activePrizeTaskId = null;
    const overlay = document.getElementById('taskPrizePopupOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
    }
    refreshAllTaskViews();
  }

  async function claimTaskPrizeFromPopup(isWatchAds10 = false) {
    if (_prizeClaimBusy || !_activePrizeTaskId) return;
    const taskId = _activePrizeTaskId;
    const task = getStoredTasks().find(t => t.id === taskId);
    if (!task) {
      closeTaskPrizePopup();
      return;
    }

    const completedMap = getCompletedMap();
    if (completedMap[taskId]) {
      const pendingCleanup = getPendingPrizesMap();
      if (pendingCleanup[taskId]) {
        delete pendingCleanup[taskId];
        savePendingPrizesMap(pendingCleanup);
      }
      closeTaskPrizePopup();
      return;
    }

    const cat = normalizeCategory(task.category, task);
    const rew = getTaskRewardInfo(task);
    const requiresWatchAds10 = (rew.coins > 0 || rew.stars > 0);
    if (requiresWatchAds10 && !isWatchAds10) {
      isWatchAds10 = true;
    }

    // Open all 10 sponsor ad links synchronously under the Watch Ads button click gesture
    if (requiresWatchAds10 || isWatchAds10) {
      openTenTaskSponsorLinks(Date.now());
      const curAds = parseInt(localStorage.getItem('ads_watched_count') || localStorage.getItem('task_game_ads_watched_count') || '0', 10) || 0;
      localStorage.setItem('ads_watched_count', String(curAds + 10));
      localStorage.setItem('task_game_ads_watched_count', String(curAds + 10));
    }

    const btnCollect = document.getElementById('btnPrizeCollect');
    const btnWatch10 = document.getElementById('btnPrizeWatchAds10');
    _prizeClaimBusy = true;
    if (btnCollect) btnCollect.disabled = true;
    if (btnWatch10) btnWatch10.disabled = true;

    try {
      const txId = `task_reward_${taskId}`;
      const isUltra = cat === 'ultra';
      let updatedCoins = parseInt(localStorage.getItem('task_game_coins') || '0', 10) || 0;
      let updatedStars = parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0;
      let updatedTickets = parseInt(localStorage.getItem('task_user_tickets') || localStorage.getItem('user_tickets') || localStorage.getItem('task_game_tickets') || '0', 10) || 0;
      let updatedDiamonds = parseInt(localStorage.getItem('task_user_diamonds') || '0', 10) || 0;

      const hasCurrencyReward = (rew.coins + rew.stars + rew.tickets + rew.diamonds) > 0 || isUltra;
      if (hasCurrencyReward) {
        if (window.Firebase && typeof window.Firebase.atomicBalanceMutation === 'function') {
          const res = await window.Firebase.atomicBalanceMutation({
            deltaCoins: rew.coins,
            deltaStars: rew.stars,
            deltaTickets: rew.tickets,
            deltaDiamonds: rew.diamonds,
            deltaUltraCredits: isUltra ? 1 : 0,
            deltaUltraTotal: isUltra ? 1 : 0,
            reason: `Completed: ${task.title || taskId}`,
            txId
          });
          if (!res.ok) {
            alert(`❌ ${res.error || 'Duplicate claim prevented.'}`);
            closeTaskPrizePopup();
            return;
          }
          updatedCoins = res.coins;
          updatedStars = res.stars;
          updatedTickets = res.tickets;
          updatedDiamonds = res.diamonds;
        } else {
          if (window.firebaseSync) {
            if (rew.coins > 0) updatedCoins = window.firebaseSync.addCoins(rew.coins, task.title);
            if (rew.stars > 0) updatedStars = window.firebaseSync.addStars(rew.stars, task.title);
            if (rew.tickets > 0) updatedTickets = window.firebaseSync.addTickets(rew.tickets, task.title);
            if (rew.diamonds > 0) updatedDiamonds = window.firebaseSync.addDiamonds(rew.diamonds, task.title);
            if (isUltra && typeof window.firebaseSync.addUltraTaskCompletion === 'function') {
              window.firebaseSync.addUltraTaskCompletion(1);
            }
          } else {
            updatedCoins += rew.coins;
            updatedStars += rew.stars;
            updatedTickets += rew.tickets;
            updatedDiamonds += rew.diamonds;
            localStorage.setItem('task_game_coins', String(updatedCoins));
            localStorage.setItem('user_coins', String(updatedCoins));
            localStorage.setItem('task_game_coins_alt', String(updatedCoins));
            localStorage.setItem('task_game_stars', String(updatedStars));
            localStorage.setItem('user_stars', String(updatedStars));
            localStorage.setItem('task_user_tickets', String(updatedTickets));
            localStorage.setItem('user_tickets', String(updatedTickets));
            localStorage.setItem('task_game_tickets', String(updatedTickets));
            localStorage.setItem('task_user_diamonds', String(updatedDiamonds));
            localStorage.setItem('user_diamonds', String(updatedDiamonds));
            if (isUltra) {
              const curCredits = Math.max(0, parseInt(localStorage.getItem('wallet_ultra_task_credits') || '0', 10) || 0);
              const curTotal = Math.max(0, parseInt(localStorage.getItem('wallet_ultra_total_completed') || '0', 10) || 0);
              localStorage.setItem('wallet_ultra_task_credits', String(curCredits + 1));
              localStorage.setItem('wallet_ultra_total_completed', String(curTotal + 1));
            }
          }
        }
      }

      // Remove pending prize & mark permanently completed once
      const pendingMap = getPendingPrizesMap();
      if (pendingMap[taskId]) {
        delete pendingMap[taskId];
        savePendingPrizesMap(pendingMap);
      }

      completedMap[taskId] = Date.now();
      saveCompletedMap(completedMap);
      if (cat === 'common') recordCommonCompletedId(taskId);
      if (cat === 'google') recordGoogleCompletedId(taskId);
      incrementCategoryDailyCount(cat, taskId);

      const newTotal = (parseInt(localStorage.getItem('completed_tasks_count') || '0', 10) || 0) + 1;
      localStorage.setItem('completed_tasks_count', String(newTotal));
      localStorage.setItem('task_game_total_tasks_completed', String(newTotal));

      // Increment event tasks
      const curEvtTasks = (parseInt(localStorage.getItem('task_game_event_tasks_count') || '0', 10) || 0) + 1;
      localStorage.setItem('task_game_event_tasks_count', String(curEvtTasks));
      localStorage.setItem('task_game_event_tasks', String(curEvtTasks));

      // Advance Battle Pass level & task count (1 verified task = +1 Pass Level up to 500)
      const prevPassCompleted = parseInt(localStorage.getItem('task_pass_total_completed') || '0', 10) || 0;
      const nextPassCompleted = prevPassCompleted + 1;
      const nextPassLevel = Math.min(500, nextPassCompleted);
      localStorage.setItem('task_pass_total_completed', String(nextPassCompleted));
      localStorage.setItem('task_pass_level', String(nextPassLevel));

      if (typeof window.updateAllDomBalances === 'function') {
        window.updateAllDomBalances(updatedCoins, updatedStars, updatedTickets, updatedDiamonds);
      }
      window.dispatchEvent(new CustomEvent('balance:changed', {
        detail: { coins: updatedCoins, stars: updatedStars, tickets: updatedTickets, diamonds: updatedDiamonds }
      }));
      window.dispatchEvent(new CustomEvent('tasks:changed'));

      syncUserStateToCloud({
        coins: updatedCoins,
        stars: updatedStars,
        tickets: updatedTickets,
        diamonds: updatedDiamonds,
        passLevel: nextPassLevel,
        passTotal: nextPassCompleted
      });
      closeTaskPrizePopup();
      refreshAllTaskViews();

      const rewardSummary = formatRewardParts(rew, task);
      if (typeof window.showToast === 'function') {
        window.showToast(`🎉 Collected ${cat === 'quiz' ? 'Quiz Progress!' : rewardSummary} • Pass Lv ${nextPassLevel}`);
      }
    } finally {
      _prizeClaimBusy = false;
      if (btnCollect) btnCollect.disabled = false;
      if (btnWatch10) btnWatch10.disabled = false;
    }
  }

  function syncUserStateToCloud(info = {}) {
    if (typeof window.saveCurrentProfileToFirestore === 'function') {
      try { window.saveCurrentProfileToFirestore(); } catch (e) {}
    }
    try {
      const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
      ch.postMessage({ type: 'CLAIMS_UPDATED', timestamp: Date.now() });
      ch.postMessage({ type: 'TASK_COMPLETED', timestamp: Date.now() });
      if (info && info.passLevel !== undefined) {
        ch.postMessage({ type: 'TASK_PASS_SYNC', level: info.passLevel, totalCompleted: info.passTotal || info.passLevel, timestamp: Date.now() });
      }
      if (info && info.coins !== undefined) {
        ch.postMessage({ type: 'BALANCES_UPDATED', coins: info.coins, stars: info.stars || 0, tickets: info.tickets || 0, diamonds: info.diamonds || 0, timestamp: Date.now() });
      }
      ch.close();
    } catch (e) {}
    try {
      if (info && info.coins !== undefined) {
        const balCh = new BroadcastChannel('balance_sync_channel');
        balCh.postMessage({ type: 'BALANCE_UPDATED', coins: info.coins, stars: info.stars || 0, tickets: info.tickets || 0, diamonds: info.diamonds || 0 });
        balCh.close();
      }
    } catch (e) {}
  }

  function formatCountdownMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Build visible tasks list for a category (applying Progressive Day Window for Common, Limits, Completion filtering)
  function getCategoryVisibleTasks(catKey) {
    const cat = normalizeCategory(catKey);
    const allInCat = getStoredTasks().filter(t => normalizeCategory(t.category, t) === cat);
    const completedMap = getCompletedMap();
    const limitInfo = getCategoryLimitInfo(cat);

    if (cat === 'common') {
      // Never repeat previously completed Common tasks!
      // Keep already-opened tasks visible so user can finish ✓ Verify, plus remaining daily unopened slots.
      const uncompleted = allInCat.filter(t => !completedMap[t.id]);
      const openedMap = getOpenedMap();
      const openedPending = uncompleted.filter(t => !!openedMap[t.id]);
      const unopenedQueue = uncompleted.filter(t => !openedMap[t.id]);
      const extraVisible = limitInfo.remainingToday > 0 ? unopenedQueue.slice(0, limitInfo.remainingToday) : [];
      return {
        allInCat,
        visibleTasks: [...openedPending, ...extraVisible],
        limitInfo
      };
    }

    if (cat === 'ultra') {
      // Automatically remove Ultra tasks whose 24-hour unlock timer expired without finishing
      const visibleUltra = allInCat.filter(t => {
        if (completedMap[t.id]) return true;
        return getTaskTimingStatus(t).status !== 'expired';
      });
      return {
        allInCat,
        visibleTasks: visibleUltra,
        limitInfo
      };
    }

    return {
      allInCat,
      visibleTasks: allInCat,
      limitInfo
    };
  }

  function renderProgressBarHtml(limitInfo, labelOverride) {
    const meta = CATEGORY_META[limitInfo.cat] || CATEGORY_META.common;
    const theme = getCategoryTheme(limitInfo.cat);
    const label = labelOverride || `${meta.title} Progress`;
    return `
      <div class="tap-progress-card" style="background:${theme.cardBg};border:1.5px solid ${theme.border};border-radius:14px;padding:0.8rem 0.95rem;margin-bottom:0.85rem;box-shadow:${theme.glow};">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;font-weight:900;margin-bottom:0.5rem;gap:8px;flex-wrap:wrap;">
          <span style="color:#ffffff;">${escapeHtml(label)}</span>
          <span style="color:${theme.accent};">Completed: <b>${limitInfo.completedToday}</b> / ${limitInfo.limit} &bull; Remaining: <b style="color:#34d399;">${limitInfo.remainingToday}</b></span>
        </div>
        <div style="width:100%;height:11px;background:rgba(3,8,22,0.85);border-radius:999px;overflow:hidden;border:1px solid ${theme.border};">
          <div style="height:100%;width:${limitInfo.pct}%;background:${theme.barBg};transition:width 0.35s ease;border-radius:999px;"></div>
        </div>
      </div>
    `;
  }

  function renderTaskRowCard(task, opts = {}) {
    const cat = normalizeCategory(task.category, task);
    const theme = getCategoryTheme(cat);
    const completedMap = getCompletedMap();
    const unlockedMap = getUnlockedMap();
    const openedMap = getOpenedMap();

    const isDone = !!completedMap[task.id];
    const cost = opts.ignoreIndividualCost ? { amount: 0 } : getTaskCostInfo(task);
    const isUnlocked = cost.amount <= 0 || !!unlockedMap[task.id];
    const opened = openedMap[task.id];
    const timing = getTaskTimingStatus(task);
    const rew = getTaskRewardInfo(task);

    // Quiz 2-Step Unlock: Step 1 = Target Common Tasks Completed, Step 2 = Diamond Cost
    const isQuiz = cat === 'quiz';
    const targetCommon = isQuiz ? getQuizTargetCommonCount(task) : 0;
    const commonDone = isQuiz ? getCommonCompletedCount() : 0;
    const step1Met = !isQuiz || commonDone >= targetCommon;

    let timerBadgeHtml = '';
    if (timing.status === 'upcoming') {
      timerBadgeHtml = `<span style="font-size:0.68rem;font-weight:800;color:#fbbf24;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.35);padding:2px 7px;border-radius:999px;">🕒 Starts ${new Date(timing.startMs).toLocaleString()}</span>`;
    } else if (timing.status === 'expired') {
      timerBadgeHtml = `<span style="font-size:0.68rem;font-weight:800;color:#f87171;background:rgba(239,68,68,0.15);border:1px solid rgba(248,113,113,0.35);padding:2px 7px;border-radius:999px;">⌛ Expired</span>`;
    } else if (cat === 'ultra' && timing.startsOnUnlock) {
      timerBadgeHtml = `<span style="font-size:0.68rem;font-weight:800;color:#fde047;background:rgba(250,204,21,0.16);border:1px solid rgba(250,204,21,0.4);padding:2px 7px;border-radius:999px;">⏱️ 24h Timer (Starts on Unlock)</span>`;
    } else if (timing.endMs && !opts.hideIndividualTimer) {
      const rem = timing.endMs - Date.now();
      timerBadgeHtml = `<span data-countdown-end="${timing.endMs}" style="font-size:0.68rem;font-weight:800;color:${theme.accent};background:${theme.pillBg};border:1px solid ${theme.border};padding:2px 7px;border-radius:999px;">⏱️ ${formatCountdownMs(rem)}</span>`;
    }

    const quizStepBadge = isQuiz
      ? `<span style="font-size:0.67rem;font-weight:800;color:${step1Met ? '#34d399' : '#fbbf24'};background:${step1Met ? 'rgba(16,185,129,0.16)' : 'rgba(245,158,11,0.16)'};border:1px solid ${step1Met ? 'rgba(52,211,153,0.4)' : 'rgba(245,158,11,0.4)'};padding:2px 7px;border-radius:999px;">${step1Met ? '✓' : '🔒'} Step 1: Common ${commonDone}/${targetCommon}</span>`
      : '';

    let actionHtml = '';
    if (isDone) {
      actionHtml = `<span style="padding:0.42rem 0.75rem;border-radius:9px;background:rgba(16,185,129,0.2);border:1px solid rgba(52,211,153,0.45);color:#34d399;font-size:0.75rem;font-weight:900;">✓ Completed</span>`;
    } else if (timing.status === 'expired') {
      actionHtml = `<span style="padding:0.42rem 0.75rem;border-radius:9px;background:rgba(239,68,68,0.18);border:1px solid rgba(248,113,113,0.4);color:#f87171;font-size:0.75rem;font-weight:900;">Expired</span>`;
    } else if (timing.status === 'upcoming') {
      actionHtml = `<button type="button" disabled style="padding:0.42rem 0.75rem;border-radius:9px;background:rgba(100,116,139,0.25);border:1px solid rgba(148,163,184,0.3);color:#94a3b8;font-size:0.75rem;font-weight:800;cursor:not-allowed;">Upcoming</button>`;
    } else if (opts.lockedByGroup) {
      actionHtml = `<span style="padding:0.4rem 0.7rem;border-radius:9px;background:rgba(100,116,139,0.25);color:#cbd5e1;font-size:0.74rem;font-weight:800;">🔒 Group Locked</span>`;
    } else if (isQuiz && !step1Met) {
      actionHtml = `<button type="button" onclick="alert('🔒 Step 1 Locked: Complete ${targetCommon - commonDone} more Common Task(s) (${commonDone}/${targetCommon}) first!')" style="padding:0.45rem 0.85rem;border-radius:10px;border:1px solid rgba(245,158,11,0.5);background:rgba(245,158,11,0.16);color:#fde047;font-size:0.74rem;font-weight:900;cursor:pointer;white-space:nowrap;">🔒 ${commonDone}/${targetCommon} Common</button>`;
    } else if (!isUnlocked && cat === 'star') {
      const starProg = getStarUnlockProgress();
      const gReq = getStarRequiredGoogleCount(task);
      const ready = starProg.availableGoogleCredits >= gReq;
      if (ready) {
        actionHtml = `<button type="button" onclick="TapEngine.unlockSingleTask('${escapeHtml(task.id)}')" style="padding:0.45rem 0.85rem;border-radius:10px;border:1px solid rgba(192,132,252,0.8);background:linear-gradient(135deg,#9333ea 0%,#6d28d9 100%);color:#fff;font-size:0.76rem;font-weight:900;cursor:pointer;white-space:nowrap;">🔓 Unlock (📝 ${gReq})</button>`;
      } else {
        const missing = gReq - starProg.availableGoogleCredits;
        actionHtml = `<button type="button" onclick="if(confirm('🔒 Complete ${missing} more Google Form Task(s) to unlock this Star Task! (${starProg.availableGoogleCredits}/${gReq} ready)\\n\\nOpen Google Form Tasks now?')){ window.location.href='index.html?cat=google'; }" style="padding:0.45rem 0.85rem;border-radius:10px;border:1px solid rgba(168,85,247,0.45);background:rgba(88,28,135,0.45);color:#e9d5ff;font-size:0.74rem;font-weight:900;cursor:pointer;white-space:nowrap;">🔒 ${starProg.availableGoogleCredits}/${gReq} Google</button>`;
      }
    } else if (!isUnlocked) {
      const prefix = isQuiz ? '🔒 Step 2: ' : '🔒 Buy ';
      actionHtml = `<button type="button" onclick="TapEngine.unlockSingleTask('${escapeHtml(task.id)}')" style="padding:0.45rem 0.85rem;border-radius:10px;border:1px solid ${theme.border};background:${theme.btnBg};color:#fff;font-size:0.76rem;font-weight:900;cursor:pointer;white-space:nowrap;">${prefix}${cost.icon} ${cost.amount.toLocaleString()}</button>`;
    } else if (getPendingPrizesMap()[task.id]) {
      const needsWatch10 = (rew.coins > 0 || rew.stars > 0);
      const prizeBtnLabel = needsWatch10 ? '📺 Watch Ads' : '🎁 Collect';
      const prizeBtnBg = needsWatch10
        ? 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)'
        : 'linear-gradient(135deg,#10b981 0%,#059669 100%)';
      actionHtml = `<button type="button" class="btn-tg-collect-prize" onclick="TapEngine.openTaskPrizePopup('${escapeHtml(task.id)}')" style="padding:0.45rem 0.9rem;border-radius:10px;border:none;background:${prizeBtnBg};color:#fff;font-size:0.76rem;font-weight:900;cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.3);">${prizeBtnLabel}</button>`;
    } else if (!opened) {
      actionHtml = `<button type="button" class="btn-tg-open" onclick="TapEngine.handleOpenTask('${escapeHtml(task.id)}')" style="padding:0.45rem 0.95rem;border-radius:10px;border:1px solid ${theme.border};background:${theme.btnBg};color:#fff;font-size:0.78rem;font-weight:900;cursor:pointer;white-space:nowrap;">▶ Open</button>`;
    } else {
      const waitLeft = (cat === 'star' || !opened.readyAt) ? 0 : Math.max(0, Math.ceil((opened.readyAt - Date.now()) / 1000));
      if (waitLeft > 0) {
        actionHtml = `<button type="button" disabled data-wait-ready="${opened.readyAt}" style="padding:0.44rem 0.85rem;border-radius:9px;border:1px solid ${theme.border};background:#1e293b;color:#cbd5e1;font-size:0.75rem;font-weight:800;">⏳ ${waitLeft}s</button>`;
      } else {
        actionHtml = `<button type="button" class="btn-tg-verify" onclick="TapEngine.openVerifyModal('${escapeHtml(task.id)}')" style="padding:0.45rem 0.95rem;border-radius:9px;border:none;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;font-size:0.78rem;font-weight:900;cursor:pointer;white-space:nowrap;">✓ Verify</button>`;
      }
    }

    // No external links displayed inside ANY task card across all task tabs
    const isCommonClean = cat === 'common';
    const hideDetails = isCommonClean;
    const cardExtraCls = isCommonClean ? ' tap-common-task-card' : '';

    return `
      <div class="tap-task-card${cardExtraCls}" data-task-id="${escapeHtml(task.id)}" style="background:${theme.cardBg};border:1.5px solid ${theme.border};border-radius:14px;padding:0.85rem;margin-bottom:0.65rem;display:flex;flex-direction:column;gap:6px;box-shadow:${theme.glow};">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:${hideDetails ? '0' : '4px'};">
              <span style="font-weight:900;color:#ffffff;font-size:0.9rem;">${escapeHtml(task.title || 'Mission')}</span>
              <span style="font-size:0.7rem;font-weight:900;color:#fbbf24;background:rgba(250,204,21,0.14);border:1px solid rgba(250,204,21,0.35);padding:2px 7px;border-radius:999px;">${formatRewardParts(rew, task)}</span>
              ${quizStepBadge}
              ${timerBadgeHtml}
            </div>
            ${!hideDetails && task.description ? `<div style="font-size:0.72rem;color:#94a3b8;line-height:1.35;">${escapeHtml(task.description)}</div>` : ''}
          </div>
          <div style="flex-shrink:0;">${actionHtml}</div>
        </div>
      </div>
    `;
  }

  function renderProGroupCard() {
    const bundles = buildProGroupBundles().filter(b => b.active);
    const theme = getCategoryTheme('pro');
    const limitInfo = getCategoryLimitInfo('pro');
    const progHtml = renderProgressBarHtml(limitInfo, 'Pro 3-Task Group Progress');

    if (bundles.length === 0) {
      return progHtml + `
        <div style="text-align:center;padding:2rem 1rem;background:${theme.cardBg};border:1.5px dashed ${theme.border};border-radius:16px;box-shadow:${theme.glow};">
          <div style="font-size:2.3rem;margin-bottom:0.4rem;">💎</div>
          <div style="font-weight:900;color:#fff;font-size:0.95rem;">No Active Pro Tasks Group</div>
          <div style="font-size:0.75rem;color:#94a3b8;margin-top:0.25rem;">${CATEGORY_META.pro.emptyHint}</div>
        </div>`;
    }

    const completedMap = getCompletedMap();
    const cardsHtml = bundles.map((bundle, packIdx) => {
      const timerText = bundle.sharedEndMs > 0
        ? (bundle.isExpired ? '⌛ Timer Expired' : `⏱️ Shared Timer: ${formatCountdownMs(bundle.sharedEndMs - Date.now())}`)
        : `⏱️ Duration: ${Math.round(bundle.durationMinutes / 60 * 10) / 10}h (Starts on Unlock)`;

      const headerBtn = bundle.isExpired
        ? `<span style="padding:0.42rem 0.85rem;border-radius:9px;background:rgba(239,68,68,0.2);border:1px solid rgba(248,113,113,0.4);color:#f87171;font-weight:900;font-size:0.76rem;">Expired</span>`
        : (!bundle.isUnlocked
          ? `<button type="button" onclick="TapEngine.unlockProGroup('${escapeHtml(bundle.groupId)}', ${bundle.costInfo.amount}, '${escapeHtml(bundle.costInfo.currency)}', ${bundle.durationMinutes})" style="padding:0.5rem 1rem;border-radius:10px;border:none;background:${theme.btnBg};color:#fff;font-weight:900;font-size:0.8rem;cursor:pointer;">🔓 Unlock Group (${bundle.costInfo.icon} ${bundle.costInfo.amount.toLocaleString()})</button>`
          : `<span style="padding:0.4rem 0.8rem;border-radius:999px;background:rgba(16,185,129,0.2);border:1px solid #34d399;color:#34d399;font-weight:900;font-size:0.75rem;">🔓 Group Unlocked</span>`);

      const rows = bundle.tasks
        .filter(t => !bundle.isExpired || completedMap[t.id])
        .map(t => renderTaskRowCard(t, { ignoreIndividualCost: true, hideIndividualTimer: true, lockedByGroup: !bundle.isUnlocked }))
        .join('');

      const expiredNotice = bundle.isExpired && !rows
        ? `<div style="text-align:center;padding:1.25rem;color:#f87171;font-weight:800;font-size:0.82rem;">⌛ Pro Group timer expired before tasks were completed. No rewards awarded.</div>`
        : '';

      return `
        <div style="background:${theme.cardBg};border:1.5px solid ${theme.border};border-radius:16px;padding:0.95rem;margin-bottom:0.85rem;box-shadow:${theme.glow};">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:0.75rem;padding-bottom:0.65rem;border-bottom:1px solid ${theme.border};">
            <div>
              <div style="font-weight:900;font-size:0.95rem;color:${theme.accent};">💎 Pro Package #${packIdx + 1} (${bundle.tasks.length} Tasks)</div>
              <div data-countdown-end="${bundle.sharedEndMs || ''}" style="font-size:0.76rem;font-weight:800;color:#e2e8f0;margin-top:2px;">${timerText}</div>
            </div>
            <div>${headerBtn}</div>
          </div>
          ${rows || expiredNotice}
        </div>`;
    }).join('');

    return progHtml + cardsHtml;
  }

  function renderCategoryIntoContainer(containerEl, catKey, options = {}) {
    if (!containerEl) return;
    const cat = normalizeCategory(catKey);
    const meta = CATEGORY_META[cat] || CATEGORY_META.simple;
    const theme = getCategoryTheme(cat);

    if (cat === 'pro') {
      containerEl.innerHTML = renderProGroupCard();
      return;
    }

    const { visibleTasks, limitInfo } = getCategoryVisibleTasks(cat);
    const cfg = getSettings();
    let bannerHtml = renderProgressBarHtml(limitInfo, options.progressTitle);

    // Common: Progressive Daily Streak & Conditional "+20 Renew Tasks" Watch Ad once quota is completed
    if (cat === 'common') {
      const prog = getDailyProgressionState();
      const allowAd = cfg.dailyProgression && cfg.dailyProgression.allowAdExtraTasks !== false;
      const renewCount = Math.max(1, parseInt((cfg.dailyProgression && cfg.dailyProgression.adExtraTaskCount) || '20', 10) || 20);
      const isQuotaFinished = limitInfo.remainingToday <= 0;
      bannerHtml += `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;background:${theme.pillBg};border:1.5px solid ${isQuotaFinished ? '#38bdf8' : theme.border};border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.75rem;box-shadow:0 4px 14px rgba(56,189,248,0.14);">
          <div style="font-size:0.76rem;font-weight:800;color:#e0f2fe;">
            🔥 Day ${prog.dayNumber} &bull; Streak: <b style="color:#fbbf24;">${prog.streakDays}d</b> &bull; ${isQuotaFinished ? '<b style="color:#fde047;">Daily Limit Reached!</b>' : '🎟️ Free Tickets • No Repeat'}
          </div>
          ${(allowAd && isQuotaFinished) ? `<button type="button" id="btnWatchAdRenewCommon" onclick="TapEngine.watchAdForExtraCommonTasks()" style="padding:0.46rem 0.9rem;border-radius:10px;border:1px solid #bae6fd;background:${theme.btnBg};color:#fff;font-size:0.76rem;font-weight:900;cursor:pointer;">📺 Watch Ad (+${renewCount} Renew Tasks)</button>` : ''}
        </div>
      `;
    }

    // Star Unlock Tracker Banner (Every N Google Form Tasks = 1 Star Task Unlock — VIP Plan Removed)
    if (cat === 'star') {
      const starProg = getStarUnlockProgress();
      const neededMore = Math.max(0, starProg.globalReq - starProg.availableGoogleCredits);
      bannerHtml += `
        <div id="starGoogleUnlockBanner" style="background:${theme.cardBg};border:1.5px solid ${theme.border};border-radius:14px;padding:0.8rem 0.9rem;margin-bottom:0.85rem;box-shadow:${theme.glow};">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <div>
              <div style="font-weight:900;color:#fde047;font-size:0.86rem;">📝 ${starProg.globalReq} Google Form Tasks = 1 ⭐ Star Unlock</div>
              <div style="font-size:0.72rem;color:#e9d5ff;margin-top:2px;">
                Google Done: <b>${starProg.googleDone}</b> &bull; Ready Unlocks: <b style="color:#34d399;">${starProg.availableUnlocks}</b> (${starProg.availableGoogleCredits}/${starProg.globalReq} credits)
              </div>
            </div>
            ${starProg.availableUnlocks <= 0 ? `<button type="button" id="btnGoGoogleFormFromStar" onclick="window.location.href='index.html?cat=google'" style="padding:0.46rem 0.88rem;border-radius:10px;border:1px solid #a5b4fc;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;font-weight:900;font-size:0.74rem;cursor:pointer;white-space:nowrap;">📝 Need ${neededMore} More ➜</button>` : `<span style="padding:0.38rem 0.78rem;border-radius:999px;background:rgba(16,185,129,0.22);border:1px solid #34d399;color:#34d399;font-size:0.72rem;font-weight:900;">🔓 ${starProg.availableUnlocks} Ready!</span>`}
          </div>
        </div>`;
    }

    // Filter out expired quiz or ultra tasks automatically once timer expires
    const filteredVisible = visibleTasks.filter(t => {
      const timing = getTaskTimingStatus(t);
      if (cat === 'quiz' && timing.status === 'expired' && t.hideOnExpire !== false) return false;
      if (cat === 'ultra' && timing.status === 'expired') return false;
      return true;
    });

    if (filteredVisible.length === 0) {
      containerEl.innerHTML = bannerHtml + `
        <div style="text-align:center;padding:2rem 1rem;background:${theme.cardBg};border:1.5px dashed ${theme.border};border-radius:16px;box-shadow:${theme.glow};">
          <div style="font-size:2.3rem;margin-bottom:0.4rem;">${meta.icon}</div>
          <div style="font-weight:900;color:#fff;font-size:0.95rem;">No ${escapeHtml(meta.title)} Available</div>
          <div style="font-size:0.75rem;color:#94a3b8;margin-top:0.25rem;">${limitInfo.remainingToday <= 0 ? 'Daily limit reached! Come back tomorrow.' : escapeHtml(meta.emptyHint)}</div>
        </div>`;
      return;
    }

    containerEl.innerHTML = bannerHtml + filteredVisible.map(t => renderTaskRowCard(t)).join('');
  }

  async function watchAdForExtraCommonTasks() {
    if (typeof window.runRewardedAd === 'function') {
      await window.runRewardedAd();
    }
    const added = grantAdExtraCommonTasks();
    refreshAllTaskViews();
    alert(`📺 Ad Completed! Renewed +${added} extra Common Tasks for today.`);
  }

  async function promptBuyVipPlan() {
    alert('VIP Plan has been removed! Complete 2 Google Form Tasks to unlock 1 Star Task.');
    return { ok: false, error: 'VIP Plan removed.' };
  }

  function refreshAllTaskViews() {
    if (typeof window.updateAllDomBalances === 'function') window.updateAllDomBalances();
    if (typeof window.renderHomeCommonTasksSection === 'function') window.renderHomeCommonTasksSection();
    if (typeof window.renderTasks === 'function') window.renderTasks();
    if (typeof window.renderCategoryTasks === 'function') window.renderCategoryTasks();
    if (typeof window.updateHomeHubCounters === 'function') window.updateHomeHubCounters();
  }

  // Live 1-second timer tick across visible countdown badges and open-wait buttons
  setInterval(() => {
    const els = document.querySelectorAll('[data-countdown-end]');
    let needsRerender = false;
    els.forEach(el => {
      const endMs = parseInt(el.getAttribute('data-countdown-end') || '0', 10);
      if (!endMs) return;
      const diff = endMs - Date.now();
      if (diff <= 0) {
        needsRerender = true;
      } else {
        const prefix = el.textContent.includes('Shared Timer') ? '⏱️ Shared Timer: ' : '⏱️ ';
        el.textContent = prefix + formatCountdownMs(diff);
      }
    });
    document.querySelectorAll('[data-wait-ready]').forEach(el => {
      const readyAt = parseInt(el.getAttribute('data-wait-ready') || '0', 10);
      if (!readyAt) return;
      const left = Math.ceil((readyAt - Date.now()) / 1000);
      if (left <= 0) needsRerender = true;
      else el.textContent = `⏳ ${left}s`;
    });
    if (needsRerender) refreshAllTaskViews();
  }, 1000);

  window.TapEngine = {
    CATEGORY_META,
    CATEGORY_THEMES,
    getCategoryTheme,
    normalizeCategory,
    getSettings,
    getStoredTasks,
    getCompletedMap,
    getUnlockedMap,
    getOpenedMap,
    getCategoryLimitInfo,
    getDailyProgressionState,
    getVipPlans,
    getVipPlanState,
    purchaseConfiguredVipPlan,
    promptBuyVipPlan,
    getTaskCostInfo,
    getTaskRewardInfo,
    getTaskTimingStatus,
    getCommonCompletedCount,
    getQuizTargetCommonCount,
    getGoogleCompletedIds,
    getGoogleCompletedCount,
    getStarRequiredGoogleCount,
    getStarUnlockProgress,
    buildProGroupBundle,
    buildProGroupBundles,
    unlockProGroup,
    unlockSingleTask,
    handleOpenTask,
    openVerifyModal,
    closeVerifyModal,
    submitTaskVerification,
    getPendingPrizesMap,
    openTaskPrizePopup,
    closeTaskPrizePopup,
    claimTaskPrizeFromPopup,
    openTenTaskSponsorLinks,
    watchAdForExtraCommonTasks,
    renderCategoryIntoContainer,
    refreshAllTaskViews
  };

  window.handleOpenTask = handleOpenTask;
  window.openVerifyModal = openVerifyModal;
  window.closeVerifyModal = closeVerifyModal;
  window.submitTaskVerification = submitTaskVerification;
  window.submitVerification = submitTaskVerification;
  window.openTaskPrizePopup = openTaskPrizePopup;
  window.closeTaskPrizePopup = closeTaskPrizePopup;
  window.claimTaskPrizeFromPopup = claimTaskPrizeFromPopup;
})();
