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
  const VIP_PLAN_KEY = 'tap_empire_vip_plan';
  const SYNC_CHANNEL_NAME = 'nova_task_sync';

  const CATEGORY_META = {
    common: { key: 'common', title: 'Common Tasks', icon: '📋', color: '#38bdf8', emptyHint: 'Ask Admin to add Common Tasks.' },
    simple: { key: 'simple', title: 'Coin Tasks', icon: '🪙', color: '#60a5fa', emptyHint: 'Ask Admin to add Coin Tasks.' },
    star: { key: 'star', title: 'Star VIP Tasks', icon: '⭐', color: '#c084fc', emptyHint: 'Ask Admin to add VIP Star Tasks.' },
    pro: { key: 'pro', title: 'Pro Tasks (3-Pack)', icon: '💎', color: '#34d399', emptyHint: 'Ask Admin to publish a Pro 3-Task Group.' },
    ultra: { key: 'ultra', title: 'Ultra Tasks', icon: '⚡', color: '#facc15', emptyHint: 'Ask Admin to add Ultra Tasks.' },
    quiz: { key: 'quiz', title: 'Quiz Tasks', icon: '🧠', color: '#10b981', emptyHint: 'Ask Admin to add Quiz Tasks.' }
  };

  // Image 8 Tab-Wise Color Palette (single source of truth across Tasks, Cards, Progress Bars)
  const CATEGORY_THEMES = {
    common: {
      accent: '#38bdf8',
      border: 'rgba(56, 189, 248, 0.55)',
      cardBg: 'linear-gradient(135deg, rgba(8, 47, 73, 0.92) 0%, rgba(3, 25, 45, 0.96) 100%)',
      btnBg: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
      barBg: 'linear-gradient(90deg, #38bdf8 0%, #0ea5e9 100%)',
      pillBg: 'rgba(56, 189, 248, 0.18)',
      glow: '0 6px 20px rgba(0, 0, 0, 0.45), 0 0 18px rgba(56, 189, 248, 0.22)'
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
      categoryLimits: { common: 10, simple: 10, star: 10, pro: 3, ultra: 5, quiz: 30, ...(raw.categoryLimits || {}) },
      vipPlan: { costStars: 1000, dailyTasksLimit: 10, durationDays: 30, enabled: true, restrictions: '1,000 Stars for 10 tasks/day.', ...(raw.vipPlan || {}) },
      proGroup: { costAmount: 5000, costCurrency: 'coins', timerMinutes: 1440, dailyLimit: 3, active: true, ...(raw.proGroup || {}) },
      dailyProgression: { freeTasksPerDay: 10, dailyIncrement: 10, allowAdExtraTasks: true, adExtraTaskCount: 5, ...(raw.dailyProgression || {}) },
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
    if (!stored || stored.dateKey !== today) {
      const fresh = {
        dateKey: today,
        counts: { common: 0, simple: 0, star: 0, pro: 0, ultra: 0, quiz: 0 }
      };
      localStorage.setItem(CATEGORY_DAILY_COUNTS_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return {
      dateKey: today,
      counts: { common: 0, simple: 0, star: 0, pro: 0, ultra: 0, quiz: 0, ...(stored.counts || {}) }
    };
  }

  function incrementCategoryDailyCount(catKey) {
    const state = getCategoryDailyState();
    const k = normalizeCategory(catKey);
    state.counts[k] = (parseInt(state.counts[k] || '0', 10) || 0) + 1;
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

    localStorage.setItem('user_streak_days', String(st.streakDays || 1));
    return st;
  }

  function grantAdExtraCommonTasks() {
    const settings = getSettings();
    const cfg = settings.dailyProgression || {};
    if (cfg.allowAdExtraTasks === false) return 0;
    const bonus = Math.max(1, parseInt(cfg.adExtraTaskCount || '5', 10) || 5);
    const st = getDailyProgressionState();
    st.adExtraUnlockedToday = (parseInt(st.adExtraUnlockedToday || '0', 10) || 0) + bonus;
    localStorage.setItem(DAILY_PROGRESSION_KEY, JSON.stringify(st));
    syncUserStateToCloud();
    return st.adExtraUnlockedToday;
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
    } else if (cat === 'star') {
      limit = Math.max(1, parseInt((settings.vipPlan && settings.vipPlan.dailyTasksLimit) || limit, 10) || 10);
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

  function getTaskCostInfo(task) {
    if (!task) return { currency: 'coins', icon: '🪙', label: 'Coins', amount: 0 };
    const cat = normalizeCategory(task.category, task);
    if (cat === 'common') return { currency: 'coins', icon: '🪙', label: 'Coins', amount: 0 };

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
    const coins = parseInt(task.rewardCoins !== undefined ? task.rewardCoins : (task.reward !== undefined ? task.reward : (task.coins || 0)), 10) || 0;
    const tickets = parseInt(task.rewardTickets !== undefined ? task.rewardTickets : (task.tickets || (cat === 'common' && coins === 0 ? 50 : 0)), 10) || 0;
    const stars = parseInt(task.rewardStars !== undefined ? task.rewardStars : (task.stars || 0), 10) || 0;
    const diamonds = parseInt(task.rewardDiamonds || '0', 10) || 0;
    const inr = parseInt(task.inrReward || '0', 10) || 0;
    return { coins, tickets, stars, diamonds, inr };
  }

  function formatRewardParts(rew) {
    const parts = [];
    if (rew.coins > 0) parts.push(`🪙 +${rew.coins.toLocaleString()}`);
    if (rew.tickets > 0) parts.push(`🎟️ +${rew.tickets.toLocaleString()}`);
    if (rew.stars > 0) parts.push(`⭐ +${rew.stars.toLocaleString()}`);
    if (rew.diamonds > 0) parts.push(`💎 +${rew.diamonds.toLocaleString()}`);
    if (rew.inr > 0) parts.push(`₹${rew.inr.toLocaleString()} Gift Card`);
    return parts.length > 0 ? parts.join(' • ') : 'Free Mission';
  }

  function getTaskTimingStatus(task) {
    const now = Date.now();
    const startMs = task.startDateTime ? new Date(task.startDateTime).getTime() : (task.eventStartTime ? Number(task.eventStartTime) : 0);
    const endMs = task.endDateTime ? new Date(task.endDateTime).getTime() : (task.eventEndTime ? Number(task.eventEndTime) : 0);

    if (startMs && !isNaN(startMs) && now < startMs) {
      return { status: 'upcoming', startsInMs: startMs - now, startMs };
    }
    if (endMs && !isNaN(endMs) && now > endMs) {
      return { status: 'expired', expiredAgoMs: now - endMs, endMs };
    }

    // Quiz / Opened-task countdown timer check
    const openedMap = getOpenedMap();
    const opened = openedMap[task.id];
    const cat = normalizeCategory(task.category, task);
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

  // Pro 3-in-1 Group Helpers
  function getProGroupStateMap() {
    const m = safeJsonParse(localStorage.getItem(PRO_GROUP_STATE_KEY), {});
    return (m && typeof m === 'object') ? m : {};
  }

  function saveProGroupStateMap(m) {
    localStorage.setItem(PRO_GROUP_STATE_KEY, JSON.stringify(m));
  }

  function buildProGroupBundle() {
    const settings = getSettings();
    const proCfg = settings.proGroup || {};
    const allPro = getStoredTasks().filter(t => normalizeCategory(t.category, t) === 'pro');
    const groupTasks = allPro.slice(0, 3);
    if (groupTasks.length === 0) return null;

    const refTask = groupTasks[0];
    const groupId = refTask.groupId || refTask.packId || 'pro_default_group';
    const costAmount = (refTask.groupCostAmount !== undefined && refTask.groupCostAmount !== '')
      ? Math.max(0, parseInt(refTask.groupCostAmount, 10) || 0)
      : Math.max(0, parseInt(proCfg.costAmount || '0', 10) || 0);
    const costCurrency = refTask.groupCostCurrency || proCfg.costCurrency || 'coins';
    const costInfo = getCurrencyDisplay(costCurrency, costAmount);

    const stateMap = getProGroupStateMap();
    const grpState = stateMap[groupId] || null;

    // Resolve shared countdown expiry (only ONE active timer for the entire group!)
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

    return {
      groupId,
      tasks: groupTasks,
      costInfo,
      durationMinutes,
      sharedEndMs,
      isUnlocked,
      isExpired,
      active: proCfg.active !== false
    };
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
    const cost = getTaskCostInfo(task);
    const unlockedMap = getUnlockedMap();
    if (unlockedMap[taskId] || cost.amount <= 0) return true;

    const bal = (window.firebaseSync && window.firebaseSync.getCurrencyBalance(cost.currency)) || 0;
    if (bal < cost.amount) {
      alert(`❌ Insufficient ${cost.label}! Need ${cost.icon} ${cost.amount.toLocaleString()} (Available: ${bal.toLocaleString()}).`);
      return false;
    }
    if (!confirm(`🔓 Unlock "${task.title || 'Mission'}" for ${cost.icon} ${cost.amount.toLocaleString()} ${cost.label}?`)) {
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

    unlockedMap[taskId] = { unlockedAt: Date.now(), currency: cost.currency, amount: cost.amount };
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
    const limitInfo = getCategoryLimitInfo(cat);
    if (limitInfo.remainingToday <= 0) {
      alert(`🔒 Daily limit reached for ${CATEGORY_META[cat].title} (${limitInfo.limit}/${limitInfo.limit}).`);
      return;
    }

    const openedMap = getOpenedMap();
    const now = Date.now();
    const existing = openedMap[taskId];
    const waitSec = Math.max(0, parseInt(task.timerSeconds !== undefined ? task.timerSeconds : (task.timer || 0), 10) || 0);
    const quizExpirySec = cat === 'quiz' ? (parseInt(task.countdownSeconds || task.expirySeconds || task.timerSeconds || task.timer || 300, 10) || 300) : 0;

    if (!existing) {
      openedMap[taskId] = {
        openedAt: now,
        readyAt: now + (cat === 'quiz' ? 0 : waitSec * 1000),
        expiresAt: quizExpirySec > 0 ? (now + quizExpirySec * 1000) : 0
      };
      saveOpenedMap(openedMap);
    }

    const url = task.url || task.link;
    if (url && url !== '#') {
      try {
        window.open(url, '_blank', 'noopener');
      } catch (e) {}
    }

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
      <div style="width:100%;max-width:360px;background:linear-gradient(160deg,#0f172a 0%,#060e24 100%);border:1.5px solid rgba(56,189,248,0.45);border-radius:18px;padding:1.25rem;box-shadow:0 18px 48px rgba(0,0,0,0.8);color:#fff;text-align:center;" onclick="event.stopPropagation()">
        <div style="font-size:2.4rem;margin-bottom:0.3rem;">🔐</div>
        <h3 id="verifyModalTitle" style="margin:0 0 0.35rem 0;font-size:1.05rem;font-weight:900;color:#fff;">Verify Mission</h3>
        <div id="verifyModalBountyPill" style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(56,189,248,0.16);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;font-size:0.76rem;font-weight:800;margin-bottom:0.6rem;">+0</div>
        <p id="verifyModalDesc" style="margin:0 0 0.75rem 0;font-size:0.78rem;color:#94a3b8;line-height:1.45;">Enter the 6-digit verification code from the completed mission.</p>
        <input type="text" id="verifyCodeInput" maxlength="6" inputmode="numeric" placeholder="Enter 6-digit code" style="width:100%;box-sizing:border-box;padding:0.65rem 0.85rem;border-radius:10px;border:1.5px solid rgba(56,189,248,0.45);background:#020617;color:#facc15;font-family:monospace;font-size:1.15rem;font-weight:900;letter-spacing:4px;text-align:center;margin-bottom:0.5rem;" />
        <div id="verifyErrorMsg" style="display:none;color:#f87171;font-size:0.74rem;font-weight:800;margin-bottom:0.5rem;"></div>
        <div style="display:flex;gap:8px;margin-top:0.35rem;">
          <button type="button" onclick="closeVerifyModal()" style="flex:1;padding:0.6rem;border-radius:10px;border:1px solid rgba(148,163,184,0.35);background:rgba(30,41,59,0.8);color:#cbd5e1;font-weight:800;cursor:pointer;">Cancel</button>
          <button type="button" id="btnVerifyConfirm" onclick="submitTaskVerification()" style="flex:1.4;padding:0.6rem;border-radius:10px;border:none;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;font-weight:900;cursor:pointer;">Verify &amp; Claim ✓</button>
        </div>
      </div>
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
      const bundle = buildProGroupBundle();
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
    if (pillEl) pillEl.textContent = formatRewardParts(rew);
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
      const bundle = buildProGroupBundle();
      if (bundle && bundle.isExpired) {
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

    const limitInfo = getCategoryLimitInfo(cat);
    if (limitInfo.remainingToday <= 0) {
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = `🔒 Daily limit reached (${limitInfo.limit}/${limitInfo.limit}).`;
      }
      return;
    }

    _verifyBusy = true;
    if (btn) btn.disabled = true;
    try {
      const rew = getTaskRewardInfo(task);
      const txId = `task_reward_${taskId}`;
      const isUltra = cat === 'ultra';
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
          closeVerifyModal();
          return;
        }
      } else if (window.firebaseSync) {
        if (rew.coins > 0) window.firebaseSync.addCoins(rew.coins, task.title);
        if (rew.stars > 0) window.firebaseSync.addStars(rew.stars, task.title);
        if (rew.tickets > 0) window.firebaseSync.addTickets(rew.tickets, task.title);
        if (rew.diamonds > 0) window.firebaseSync.addDiamonds(rew.diamonds, task.title);
        if (isUltra && typeof window.firebaseSync.addUltraTaskCompletion === 'function') {
          window.firebaseSync.addUltraTaskCompletion(1);
        }
      }

      // Mark permanently completed once
      completedMap[taskId] = Date.now();
      saveCompletedMap(completedMap);
      incrementCategoryDailyCount(cat);

      const newTotal = (parseInt(localStorage.getItem('completed_tasks_count') || '0', 10) || 0) + 1;
      localStorage.setItem('completed_tasks_count', String(newTotal));
      localStorage.setItem('task_game_total_tasks_completed', String(newTotal));

      // Increment event tasks if leaderboard event running
      const curEvtTasks = (parseInt(localStorage.getItem('task_game_event_tasks_count') || '0', 10) || 0) + 1;
      localStorage.setItem('task_game_event_tasks_count', String(curEvtTasks));
      localStorage.setItem('task_game_event_tasks', String(curEvtTasks));

      // NOTE: Pass progress stays completely independent of Common & Ultra task completion counts (Req 9 & A3)
      syncUserStateToCloud();
      closeVerifyModal();
      refreshAllTaskViews();

      alert(`✅ Verified & Rewarded!\n\n${task.title || 'Mission'}\nReward: ${formatRewardParts(rew)}`);
    } finally {
      _verifyBusy = false;
      if (btn) btn.disabled = false;
    }
  }

  function syncUserStateToCloud() {
    if (typeof window.saveCurrentProfileToFirestore === 'function') {
      try { window.saveCurrentProfileToFirestore(); } catch (e) {}
    }
    try {
      const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
      ch.postMessage({ type: 'CLAIMS_UPDATED', timestamp: Date.now() });
      ch.close();
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
      // Example: completed 7 of 10 on Day 1 -> Day 2 starts right from task 8 onwards!
      const uncompleted = allInCat.filter(t => !completedMap[t.id]);
      const windowSize = Math.max(1, limitInfo.remainingToday);
      return {
        allInCat,
        visibleTasks: limitInfo.remainingToday > 0 ? uncompleted.slice(0, windowSize) : [],
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
    const taskUrl = task.url || task.link || '';

    let timerBadgeHtml = '';
    if (timing.status === 'upcoming') {
      timerBadgeHtml = `<span style="font-size:0.68rem;font-weight:800;color:#fbbf24;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.35);padding:2px 7px;border-radius:999px;">🕒 Starts ${new Date(timing.startMs).toLocaleString()}</span>`;
    } else if (timing.status === 'expired') {
      timerBadgeHtml = `<span style="font-size:0.68rem;font-weight:800;color:#f87171;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);padding:2px 7px;border-radius:999px;">⌛ Expired</span>`;
    } else if (timing.endMs && !opts.hideIndividualTimer) {
      const rem = timing.endMs - Date.now();
      timerBadgeHtml = `<span data-countdown-end="${timing.endMs}" style="font-size:0.68rem;font-weight:800;color:${theme.accent};background:${theme.pillBg};border:1px solid ${theme.border};padding:2px 7px;border-radius:999px;">⏱️ ${formatCountdownMs(rem)}</span>`;
    }

    let actionHtml = '';
    if (isDone) {
      actionHtml = `<span style="padding:0.42rem 0.75rem;border-radius:9px;background:rgba(16,185,129,0.2);border:1px solid rgba(52,211,153,0.45);color:#34d399;font-size:0.75rem;font-weight:900;">✓ Completed</span>`;
    } else if (timing.status === 'expired') {
      actionHtml = `<span style="padding:0.42rem 0.75rem;border-radius:9px;background:rgba(239,68,68,0.18);border:1px solid rgba(248,113,113,0.4);color:#f87171;font-size:0.75rem;font-weight:900;">Expired</span>`;
    } else if (timing.status === 'upcoming') {
      actionHtml = `<button type="button" disabled style="padding:0.42rem 0.75rem;border-radius:9px;background:rgba(100,116,139,0.25);border:1px solid rgba(148,163,184,0.3);color:#94a3b8;font-size:0.75rem;font-weight:800;cursor:not-allowed;">Upcoming</button>`;
    } else if (opts.lockedByGroup) {
      actionHtml = `<span style="padding:0.4rem 0.7rem;border-radius:9px;background:rgba(100,116,139,0.25);color:#cbd5e1;font-size:0.74rem;font-weight:800;">🔒 Group Locked</span>`;
    } else if (!isUnlocked) {
      actionHtml = `<button type="button" onclick="TapEngine.unlockSingleTask('${task.id}')" style="padding:0.45rem 0.85rem;border-radius:10px;border:1px solid ${theme.border};background:${theme.btnBg};color:#fff;font-size:0.76rem;font-weight:900;cursor:pointer;white-space:nowrap;">🔒 Buy ${cost.icon} ${cost.amount.toLocaleString()}</button>`;
    } else if (!opened) {
      actionHtml = `<button type="button" onclick="TapEngine.handleOpenTask('${task.id}')" style="padding:0.45rem 0.95rem;border-radius:10px;border:1px solid ${theme.border};background:${theme.btnBg};color:#fff;font-size:0.78rem;font-weight:900;cursor:pointer;white-space:nowrap;">↗ Open</button>`;
    } else {
      const waitLeft = opened.readyAt ? Math.max(0, Math.ceil((opened.readyAt - Date.now()) / 1000)) : 0;
      if (waitLeft > 0) {
        actionHtml = `
          <div style="display:flex;gap:5px;align-items:center;">
            <button type="button" onclick="TapEngine.handleOpenTask('${task.id}')" style="padding:0.42rem 0.65rem;border-radius:9px;border:1px solid ${theme.border};background:${theme.pillBg};color:${theme.accent};font-size:0.72rem;font-weight:800;cursor:pointer;">↗ Open</button>
            <button type="button" disabled data-wait-ready="${opened.readyAt}" style="padding:0.42rem 0.75rem;border-radius:9px;border:none;background:#334155;color:#cbd5e1;font-size:0.74rem;font-weight:800;">⏳ ${waitLeft}s</button>
          </div>`;
      } else {
        actionHtml = `
          <div style="display:flex;gap:5px;align-items:center;">
            <button type="button" onclick="TapEngine.handleOpenTask('${task.id}')" style="padding:0.42rem 0.65rem;border-radius:9px;border:1px solid ${theme.border};background:${theme.pillBg};color:${theme.accent};font-size:0.72rem;font-weight:800;cursor:pointer;">↗ Reopen</button>
            <button type="button" onclick="TapEngine.openVerifyModal('${task.id}')" style="padding:0.45rem 0.85rem;border-radius:9px;border:none;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;font-size:0.78rem;font-weight:900;cursor:pointer;">✓ Verify</button>
          </div>`;
      }
    }

    // Req 3 / Image 7 Common Tasks interaction: clean minimal card; when opened, show configured task link & hide card details cleanly
    const isCommonClean = cat === 'common';
    const showLinkChip = isCommonClean && opened && !isDone && taskUrl;
    const hideDetails = isCommonClean;

    return `
      <div class="tap-task-card" data-task-id="${escapeHtml(task.id)}" style="background:${theme.cardBg};border:1.5px solid ${theme.border};border-radius:14px;padding:0.85rem;margin-bottom:0.65rem;display:flex;flex-direction:column;gap:8px;box-shadow:${theme.glow};">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:${hideDetails ? '0' : '4px'};">
              <span style="font-weight:900;color:#ffffff;font-size:0.9rem;">${escapeHtml(task.title || 'Mission')}</span>
              <span style="font-size:0.7rem;font-weight:900;color:#fbbf24;background:rgba(250,204,21,0.14);border:1px solid rgba(250,204,21,0.35);padding:2px 7px;border-radius:999px;">${formatRewardParts(rew)}</span>
              ${timerBadgeHtml}
            </div>
            ${!hideDetails && task.description ? `<div style="font-size:0.72rem;color:#94a3b8;line-height:1.35;">${escapeHtml(task.description)}</div>` : ''}
          </div>
          <div style="flex-shrink:0;">${actionHtml}</div>
        </div>
        ${showLinkChip ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(3,8,22,0.72);border:1px solid ${theme.border};border-radius:9px;padding:0.42rem 0.65rem;font-size:0.72rem;"><a href="${escapeHtml(taskUrl)}" target="_blank" rel="noopener" style="color:${theme.accent};font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:underline;">🔗 ${escapeHtml(taskUrl)}</a><span style="color:#34d399;font-weight:800;white-space:nowrap;">Ready to Verify</span></div>` : ''}
      </div>
    `;
  }

  function renderProGroupCard() {
    const bundle = buildProGroupBundle();
    const theme = getCategoryTheme('pro');
    const limitInfo = getCategoryLimitInfo('pro');
    const progHtml = renderProgressBarHtml(limitInfo, 'Pro 3-Task Group Progress');

    if (!bundle || !bundle.active) {
      return progHtml + `
        <div style="text-align:center;padding:2rem 1rem;background:${theme.cardBg};border:1.5px dashed ${theme.border};border-radius:16px;box-shadow:${theme.glow};">
          <div style="font-size:2.3rem;margin-bottom:0.4rem;">💎</div>
          <div style="font-weight:900;color:#fff;font-size:0.95rem;">No Active Pro Tasks Group</div>
          <div style="font-size:0.75rem;color:#94a3b8;margin-top:0.25rem;">${CATEGORY_META.pro.emptyHint}</div>
        </div>`;
    }

    const timerText = bundle.sharedEndMs > 0
      ? (bundle.isExpired ? '⌛ Timer Expired' : `⏱️ Shared Timer: ${formatCountdownMs(bundle.sharedEndMs - Date.now())}`)
      : `⏱️ Duration: ${Math.round(bundle.durationMinutes / 60 * 10) / 10}h (Starts on Unlock)`;

    const headerBtn = bundle.isExpired
      ? `<span style="padding:0.42rem 0.85rem;border-radius:9px;background:rgba(239,68,68,0.2);border:1px solid rgba(248,113,113,0.4);color:#f87171;font-weight:900;font-size:0.76rem;">Expired</span>`
      : (!bundle.isUnlocked
        ? `<button type="button" onclick="TapEngine.unlockProGroup('${bundle.groupId}', ${bundle.costInfo.amount}, '${bundle.costInfo.currency}', ${bundle.durationMinutes})" style="padding:0.5rem 1rem;border-radius:10px;border:none;background:${theme.btnBg};color:#fff;font-weight:900;font-size:0.8rem;cursor:pointer;">🔓 Unlock Group (${bundle.costInfo.icon} ${bundle.costInfo.amount.toLocaleString()})</button>`
        : `<span style="padding:0.4rem 0.8rem;border-radius:999px;background:rgba(16,185,129,0.2);border:1px solid #34d399;color:#34d399;font-weight:900;font-size:0.75rem;">🔓 Group Unlocked</span>`);

    // Filter out expired incomplete tasks when timer expires (Req #6)
    const completedMap = getCompletedMap();
    const rows = bundle.tasks
      .filter(t => !bundle.isExpired || completedMap[t.id])
      .map(t => renderTaskRowCard(t, { ignoreIndividualCost: true, hideIndividualTimer: true, lockedByGroup: !bundle.isUnlocked }))
      .join('');

    const expiredNotice = bundle.isExpired && !rows
      ? `<div style="text-align:center;padding:1.25rem;color:#f87171;font-weight:800;font-size:0.82rem;">⌛ Pro Group timer expired before tasks were completed. No rewards awarded.</div>`
      : '';

    return progHtml + `
      <div style="background:${theme.cardBg};border:1.5px solid ${theme.border};border-radius:16px;padding:0.95rem;box-shadow:${theme.glow};">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:0.75rem;padding-bottom:0.65rem;border-bottom:1px solid ${theme.border};">
          <div>
            <div style="font-weight:900;font-size:0.95rem;color:${theme.accent};">💎 Pro Elite 3-Task Group</div>
            <div data-countdown-end="${bundle.sharedEndMs || ''}" style="font-size:0.76rem;font-weight:800;color:#e2e8f0;margin-top:2px;">${timerText}</div>
          </div>
          <div>${headerBtn}</div>
        </div>
        ${rows || expiredNotice}
      </div>
    `;
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

    // Common: Progressive Daily Streak & Optional Ad Extra Unlock
    if (cat === 'common') {
      const prog = getDailyProgressionState();
      const allowAd = cfg.dailyProgression && cfg.dailyProgression.allowAdExtraTasks !== false;
      bannerHtml += `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;background:${theme.pillBg};border:1px solid ${theme.border};border-radius:12px;padding:0.6rem 0.8rem;margin-bottom:0.75rem;">
          <div style="font-size:0.76rem;font-weight:800;color:#bae6fd;">
            🔥 Day ${prog.dayNumber} &bull; Streak: <b style="color:#fbbf24;">${prog.streakDays}d</b> &bull; Uncompleted Queue (No Repeats)
          </div>
          ${allowAd ? `<button type="button" onclick="TapEngine.watchAdForExtraCommonTasks()" style="padding:0.4rem 0.75rem;border-radius:8px;border:1px solid ${theme.border};background:${theme.btnBg};color:#fff;font-size:0.74rem;font-weight:900;cursor:pointer;">📺 Watch Ad (+${(cfg.dailyProgression && cfg.dailyProgression.adExtraTaskCount) || 5} Tasks)</button>` : ''}
        </div>
      `;
    }

    // Star VIP Plan Gate Banner
    if (cat === 'star') {
      const vip = getVipPlanState();
      if (!vip.active) {
        const minPlanCost = (vip.plans || []).filter(p => p.enabled !== false).reduce((m, p) => Math.min(m, p.costStars), Infinity);
        const startText = Number.isFinite(minPlanCost) ? `Plans starting at ⭐ ${minPlanCost.toLocaleString()}` : '500 / 1,000 / 5,000 Stars';
        bannerHtml += `
          <div style="background:${theme.cardBg};border:1.5px solid ${theme.border};border-radius:14px;padding:0.9rem;margin-bottom:0.85rem;box-shadow:${theme.glow};">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <div>
                <div style="font-weight:900;color:#fde047;font-size:0.92rem;">👑 VIP Star Plan Required</div>
                <div style="font-size:0.74rem;color:#cbd5e1;margin-top:2px;">${startText} • Choose 500, 1,000, or 5,000 ⭐ VIP Pass</div>
              </div>
              <button type="button" id="btnOpenVipPlansGate" onclick="TapEngine.promptBuyVipPlan()" style="padding:0.5rem 0.95rem;border-radius:10px;border:none;background:${theme.btnBg};color:#fff;font-weight:900;font-size:0.78rem;cursor:pointer;">👑 Unlock VIP Plans</button>
            </div>
          </div>`;
        containerEl.innerHTML = bannerHtml;
        return;
      } else {
        const daysLeft = Math.max(1, Math.ceil((vip.expiresAt - Date.now()) / 86400000));
        bannerHtml += `
          <div style="background:${theme.pillBg};border:1px solid ${theme.border};border-radius:12px;padding:0.6rem 0.85rem;margin-bottom:0.75rem;display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;font-weight:800;color:#fde047;">
            <span>👑 ${escapeHtml(vip.activePlanTitle || 'VIP Star Plan')} Active &bull; ${daysLeft}d left</span>
            <span>Daily Allowance: ${vip.usedToday}/${vip.dailyTasksLimit}</span>
          </div>`;
      }
    }

    // Filter out expired quiz tasks if timer expired
    const filteredVisible = visibleTasks.filter(t => {
      const timing = getTaskTimingStatus(t);
      if (cat === 'quiz' && timing.status === 'expired' && t.hideOnExpire !== false) return false;
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
    const totalBonus = grantAdExtraCommonTasks();
    refreshAllTaskViews();
    alert(`📺 Ad Completed! Additional daily free Common Tasks unlocked (+${totalBonus} bonus limit today).`);
  }

  async function promptBuyVipPlan() {
    if (typeof window.openVipSubscriptionModal === 'function') {
      window.openVipSubscriptionModal();
      return;
    }
    const vip = getVipPlanState();
    if (vip.active) {
      alert(`👑 VIP Star Plan is already active (${vip.remainingToday}/${vip.dailyTasksLimit} tasks left today).`);
      return;
    }
    const res = await purchaseConfiguredVipPlan();
    if (!res.ok) {
      alert(`❌ ${res.error}`);
      return;
    }
    refreshAllTaskViews();
    alert(`🎉 VIP Star Plan Activated!`);
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
    buildProGroupBundle,
    unlockProGroup,
    unlockSingleTask,
    handleOpenTask,
    openVerifyModal,
    closeVerifyModal,
    submitTaskVerification,
    watchAdForExtraCommonTasks,
    renderCategoryIntoContainer,
    refreshAllTaskViews
  };

  window.handleOpenTask = handleOpenTask;
  window.openVerifyModal = openVerifyModal;
  window.closeVerifyModal = closeVerifyModal;
  window.submitTaskVerification = submitTaskVerification;
  window.submitVerification = submitTaskVerification;
})();
