/**
 * ============================================================================
 * TAP EMPIRE — HOME PAGE CONTROLLER
 * Strictly real Firebase tasks (zero demo data). Syncs Common Tasks directly
 * with TapEngine, displays real category counters, and manages Home HUD.
 * ============================================================================
 */
(function () {
  'use strict';

  function updateCoinDisplay() {
    if (typeof window.updateAllDomBalances === 'function') {
      window.updateAllDomBalances();
    } else {
      const c = parseInt(localStorage.getItem('task_game_coins') || '0', 10) || 0;
      const s = parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0;
      const elC = document.getElementById('userCoinsDisplay');
      const elS = document.getElementById('userStarsDisplay');
      if (elC) elC.textContent = c.toLocaleString();
      if (elS) elS.textContent = s.toLocaleString();
    }
    const streakEl = document.getElementById('userStreakDisplay');
    if (streakEl && window.TapEngine) {
      const prog = window.TapEngine.getDailyProgressionState();
      streakEl.textContent = `Day ${prog.streakDays || 1}`;
    }
  }

  function updateHomeHubCounters() {
    if (!window.TapEngine) return;
    const tasks = window.TapEngine.getStoredTasks();
    const counts = { common: 0, simple: 0, star: 0, pro: 0, ultra: 0, quiz: 0, diamond: 0, google: 0 };
    tasks.forEach(t => {
      const k = window.TapEngine.normalizeCategory(t.category, t);
      if (counts[k] !== undefined) counts[k]++;
    });

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };
    setTxt('commonTasksCount', counts.common);
    setTxt('simpleTasksCount', counts.simple);
    setTxt('premiumTasksCount', counts.star);
    setTxt('proTasksCount', counts.pro);
    setTxt('ultraTasksCount', counts.ultra);
    setTxt('quizTasksCount', counts.quiz);
    setTxt('diamondTasksCount', counts.diamond);
    setTxt('googleTasksCount', counts.google);

    const proBadgeEl = document.getElementById('hubProTimerBadge');
    if (proBadgeEl) {
      const bundle = window.TapEngine.buildProGroupBundle();
      if (!bundle || !bundle.active) {
        proBadgeEl.textContent = '💎 Group';
      } else if (bundle.isExpired) {
        proBadgeEl.textContent = '⌛ Expired';
      } else if (bundle.sharedEndMs > 0) {
        const ms = Math.max(0, bundle.sharedEndMs - Date.now());
        const hrs = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        proBadgeEl.textContent = `⏱️ ${hrs}h ${mins}m`;
      } else {
        proBadgeEl.textContent = bundle.isUnlocked ? '🔓 Open' : `${bundle.costInfo.icon} ${bundle.costInfo.amount}`;
      }
    }
  }

  function renderTasks() {
    updateCoinDisplay();
    updateHomeHubCounters();
  }

  function openTaskCategoryPage(category) {
    const c = String(category || 'common').toLowerCase();
    const mapped = (c === 'coin') ? 'simple' : (c === 'premium' ? 'star' : c);
    window.location.href = `../tasks/index.html?cat=${encodeURIComponent(mapped)}`;
  }

  function closeTaskCategoryPage() {
    const view = document.getElementById('taskCategoryPageView');
    const controls = document.getElementById('stickyTaskControls');
    if (view) view.style.display = 'none';
    if (controls) controls.style.display = '';
  }

  function syncVipModalFields() {
    if (!window.TapEngine) return;
    const vip = window.TapEngine.getVipPlanState();
    const plans = Array.isArray(vip.plans) && vip.plans.length > 0 ? vip.plans : [];
    const starsEl = document.getElementById('vipModalUserStars');
    const bal = (window.firebaseSync && window.firebaseSync.getStars()) || (parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0);
    if (starsEl) starsEl.textContent = bal.toLocaleString();

    const container = document.getElementById('vipDynamicPlanContainer');
    if (!container) return;
    const escapeH = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    container.innerHTML = plans.filter(p => p && p.enabled !== false).map((plan) => {
      const isPopular = plan.id === 'vip_1000' || Number(plan.costStars) === 1000;
      const isThisActive = vip.active && (vip.activePlanId === plan.id || Number(vip.costStars) === Number(plan.costStars));
      return `
        <div class="vip-plan-card ${isPopular ? 'popular-plan' : ''}" data-vip-plan-id="${escapeH(plan.id)}">
          <div style="font-weight:900;color:#fde047;">${escapeH(plan.title)} • ${plan.durationDays} DAYS</div>
          <div style="font-weight:900;color:#fff;">${Number(plan.costStars).toLocaleString()} ⭐ • ⚡ ${plan.dailyTasksLimit}/day</div>
          <button type="button" class="btn-buy-vip-plan" onclick="purchaseVipPlan('${escapeH(plan.id)}')" ${vip.active ? 'disabled' : ''}>
            ${isThisActive ? '👑 Active' : (vip.active ? 'VIP Active' : `Activate (${Number(plan.costStars).toLocaleString()} ⭐)`)}
          </button>
        </div>`;
    }).join('');
  }

  function openSubscriptionModal() {
    syncVipModalFields();
    const modal = document.getElementById('vipSubscriptionModal');
    if (modal) modal.style.display = 'flex';
  }

  function closeSubscriptionModal() {
    const modal = document.getElementById('vipSubscriptionModal');
    if (modal) modal.style.display = 'none';
  }

  function handleVipModalBackdropClick(e) {
    if (e && e.target && e.target.id === 'vipSubscriptionModal') closeSubscriptionModal();
  }

  async function purchaseVipPlan(planId) {
    if (!window.TapEngine) return;
    const res = await window.TapEngine.purchaseConfiguredVipPlan(planId);
    if (!res.ok) {
      alert(`❌ ${res.error}`);
      return;
    }
    syncVipModalFields();
    renderTasks();
    alert('🎉 VIP Star Plan Activated!');
    closeSubscriptionModal();
  }

  function setupCloudListeners() {
    const listenTasks = (window.Firebase && window.Firebase.listenToCloudTasks) || window.listenToCloudTasks;
    if (typeof listenTasks === 'function') {
      listenTasks(() => renderTasks());
    }
    const listenSettings = window.Firebase && window.Firebase.listenToAppSettings;
    if (typeof listenSettings === 'function') {
      listenSettings(() => {
        renderTasks();
        syncVipModalFields();
      });
    }
  }

  window.renderTasks = renderTasks;
  window.updateHomeHubCounters = updateHomeHubCounters;
  window.openTaskCategoryPage = openTaskCategoryPage;
  window.closeTaskCategoryPage = closeTaskCategoryPage;
  window.openSubscriptionModal = openSubscriptionModal;
  window.openVipSubscriptionModal = openSubscriptionModal;
  window.closeSubscriptionModal = closeSubscriptionModal;
  window.handleVipModalBackdropClick = handleVipModalBackdropClick;
  window.purchaseVipPlan = purchaseVipPlan;
  window.updateCoinDisplay = updateCoinDisplay;

  window.addEventListener('firebase:ready', setupCloudListeners);
  window.addEventListener('balance:changed', updateCoinDisplay);
  window.addEventListener('settings:changed', renderTasks);
  window.addEventListener('tasks:changed', renderTasks);
  window.addEventListener('storage', (e) => {
    if (!e || ['task_game_tasks', 'task_game_tasks_updated_at', 'tap_empire_app_settings', 'task_completed_tasks', 'task_unlocked_tasks', 'tap_empire_category_daily_counts', 'tap_empire_vip_plan'].includes(e.key)) {
      renderTasks();
    }
    updateCoinDisplay();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderTasks();
  });
  try {
    const ch = new BroadcastChannel('nova_task_sync');
    ch.onmessage = (ev) => {
      const tp = ev && ev.data && ev.data.type;
      if (!tp || tp === 'TASKS_UPDATED' || tp === 'TASKS_SYNCED' || tp === 'TASKS_RESTORED' || tp === 'SETTINGS_UPDATED') {
        renderTasks();
      } else {
        updateCoinDisplay();
      }
    };
  } catch (e) {}
  try {
    const bc = new BroadcastChannel('balance_sync_channel');
    bc.onmessage = () => updateCoinDisplay();
  } catch (e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      renderTasks();
      setupCloudListeners();
    });
  } else {
    renderTasks();
    setupCloudListeners();
  }
})();
