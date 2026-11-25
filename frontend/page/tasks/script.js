/**
 * ============================================================================
 * TAP EMPIRE — TASKS CATEGORY PAGE CONTROLLER
 * Powered by unified TapEngine. Zero demo tasks; real-time Firebase sync.
 * Supports: common, simple (coin), star (VIP), pro (3-in-1 group), ultra, quiz.
 * ============================================================================
 */
(function () {
  'use strict';

  const CATEGORY_HEADER_MAP = {
    common: { title: 'Common Tasks', icon: '📋' },
    simple: { title: 'Coin Tasks', icon: '🪙' },
    coin: { title: 'Coin Tasks', icon: '🪙' },
    star: { title: 'Star VIP Tasks', icon: '⭐' },
    premium: { title: 'Star VIP Tasks', icon: '⭐' },
    pro: { title: 'Pro Tasks (3-Pack)', icon: '💎' },
    ultra: { title: 'Ultra Tasks', icon: '⚡' },
    quiz: { title: 'Quiz Tasks', icon: '🧠' }
  };

  function resolveInitialCategory() {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('cat') || params.get('category') || 'common').toLowerCase().trim();
    if (window.TapEngine) return window.TapEngine.normalizeCategory(raw);
    if (raw === 'coin') return 'simple';
    if (raw === 'premium') return 'star';
    if (['common', 'simple', 'star', 'pro', 'ultra', 'quiz'].includes(raw)) return raw;
    return 'common';
  }

  let activeCategory = resolveInitialCategory();

  function updateHUD() {
    if (typeof window.updateAllDomBalances === 'function') {
      window.updateAllDomBalances();
    } else {
      const c = parseInt(localStorage.getItem('task_game_coins') || '0', 10) || 0;
      const s = parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0;
      const t = parseInt(localStorage.getItem('task_user_tickets') || '0', 10) || 0;
      const d = parseInt(localStorage.getItem('task_user_diamonds') || '0', 10) || 0;
      const elC = document.getElementById('hudCoins');
      const elS = document.getElementById('hudStars');
      const elT = document.getElementById('hudTickets');
      const elD = document.getElementById('hudDiamonds');
      if (elC) elC.textContent = c.toLocaleString();
      if (elS) elS.textContent = s.toLocaleString();
      if (elT) elT.textContent = t.toLocaleString();
      if (elD) elD.textContent = d.toLocaleString();
    }

    // Diamond balance pill shown ONLY on Quiz Tasks page
    const diamondPill = document.getElementById('diamondPill');
    if (diamondPill) {
      diamondPill.style.display = activeCategory === 'quiz' ? 'flex' : 'none';
    }

    const titleEl = document.getElementById('pageCategoryTitle');
    const rankEl = document.getElementById('userRankDisplay');
    const info = CATEGORY_HEADER_MAP[activeCategory] || CATEGORY_HEADER_MAP.common;
    if (titleEl) titleEl.textContent = `${info.icon} ${info.title}`;
    if (rankEl && window.TapEngine) {
      const lim = window.TapEngine.getCategoryLimitInfo(activeCategory);
      rankEl.textContent = `${lim.completedToday}/${lim.limit} TODAY`;
    }
  }

  function applyCategoryTheme(catKey) {
    const k = window.TapEngine ? window.TapEngine.normalizeCategory(catKey) : catKey;
    const shell = document.querySelector('.mobile-container');
    if (shell) {
      ['common', 'simple', 'star', 'pro', 'ultra', 'quiz'].forEach(c => shell.classList.remove(`theme-${c}`));
      shell.classList.add(`theme-${k}`);
    }

    const tabs = document.querySelectorAll('#categoryTabs .tg-tab-btn');
    tabs.forEach(btn => {
      const btnCat = btn.getAttribute('data-cat');
      ['active-common', 'active-simple', 'active-coin', 'active-star', 'active-pro', 'active-ultra', 'active-quiz'].forEach(cls => btn.classList.remove(cls));
      if (btnCat === k) btn.classList.add(`active-${k}`);
    });

    if (window.TapEngine) {
      const counts = { common: 0, simple: 0, star: 0, pro: 0, ultra: 0, quiz: 0 };
      window.TapEngine.getStoredTasks().forEach(t => {
        const tc = window.TapEngine.normalizeCategory(t.category, t);
        if (counts[tc] !== undefined) counts[tc]++;
      });
      const mapIds = {
        common: 'tabCountCommon',
        simple: 'tabCountSimple',
        star: 'tabCountStar',
        pro: 'tabCountPro',
        ultra: 'tabCountUltra',
        quiz: 'tabCountQuiz'
      };
      Object.entries(mapIds).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(counts[key]);
      });
    }
  }

  function renderCategoryTasks() {
    applyCategoryTheme(activeCategory);
    updateHUD();
    const listEl = document.getElementById('tasksList');
    const bannerEl = document.getElementById('catBannerContainer');
    if (bannerEl) bannerEl.innerHTML = '';
    if (!listEl || !window.TapEngine) return;
    window.TapEngine.renderCategoryIntoContainer(listEl, activeCategory);
  }

  function switchCategory(cat) {
    activeCategory = window.TapEngine ? window.TapEngine.normalizeCategory(cat) : cat;
    const url = new URL(window.location.href);
    url.searchParams.set('cat', activeCategory);
    window.history.replaceState({}, '', url.toString());
    renderCategoryTasks();
  }

  function syncVipModalFields() {
    if (!window.TapEngine) return;
    const vip = window.TapEngine.getVipPlanState();
    const plans = Array.isArray(vip.plans) && vip.plans.length > 0
      ? vip.plans
      : (typeof window.TapEngine.getVipPlans === 'function' ? window.TapEngine.getVipPlans() : []);
    const starsEl = document.getElementById('vipModalUserStars');
    const bal = (window.firebaseSync && window.firebaseSync.getStars()) || (parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0);
    if (starsEl) starsEl.textContent = bal.toLocaleString();

    const container = document.getElementById('vipDynamicPlanContainer');
    if (!container) return;

    const escapeH = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const enabledPlans = plans.filter((p) => p && p.enabled !== false);
    if (enabledPlans.length === 0) {
      container.innerHTML = `<div style="padding:1rem;text-align:center;color:#94a3b8;font-size:0.8rem;">All VIP Plans are currently disabled by Admin.</div>`;
      return;
    }

    container.innerHTML = enabledPlans.map((plan) => {
      const isPopular = plan.id === 'vip_1000' || Number(plan.costStars) === 1000;
      const isThisActive = vip.active && (vip.activePlanId === plan.id || Number(vip.costStars) === Number(plan.costStars));
      const canAfford = bal >= Number(plan.costStars || 0);
      const btnText = isThisActive
        ? `👑 Active (${vip.remainingToday}/${vip.dailyTasksLimit} left today)`
        : (vip.active
            ? `VIP Already Active`
            : `Select & Activate (${Number(plan.costStars).toLocaleString()} ⭐)`);
      const disabledAttr = (vip.active) ? 'disabled' : '';
      return `
        <div class="vip-plan-card ${isPopular ? 'popular-plan' : ''}" data-vip-plan-id="${escapeH(plan.id)}" style="margin:0;width:100%;border:1.5px solid ${isPopular ? 'rgba(250,204,21,0.6)' : 'rgba(168,85,247,0.4)'};border-radius:14px;padding:0.75rem 0.9rem;background:rgba(15,23,42,0.92);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:0.35rem;">
            <span style="font-weight:900;font-size:0.86rem;color:#fde047;">${escapeH(plan.title || 'VIP Pass')}</span>
            <span style="font-size:0.65rem;font-weight:900;padding:2px 8px;border-radius:999px;background:${isPopular ? 'rgba(250,204,21,0.18)' : 'rgba(168,85,247,0.18)'};color:${isPopular ? '#fde047' : '#d8b4fe'};">${escapeH(plan.badge || '👑 VIP')} • ${plan.durationDays} DAYS</span>
          </div>
          <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:0.25rem;">
            <span style="font-weight:900;font-size:1.35rem;color:#fff;">${Number(plan.costStars).toLocaleString()}</span>
            <span style="font-weight:800;font-size:0.85rem;color:#fbbf24;">⭐ Stars</span>
            <span style="margin-left:auto;font-size:0.74rem;font-weight:800;color:#7dd3fc;">⚡ ${plan.dailyTasksLimit} Tasks / Day</span>
          </div>
          ${plan.restrictions ? `<p style="font-size:0.7rem;color:#94a3b8;margin:0 0 0.55rem 0;">${escapeH(plan.restrictions)}</p>` : ''}
          <button type="button" class="btn-buy-vip-plan ${isPopular ? 'popular-btn' : ''}" data-vip-buy-btn="${escapeH(plan.id)}" onclick="purchaseVipPlan('${escapeH(plan.id)}')" ${disabledAttr} style="width:100%;opacity:${canAfford && !vip.active ? '1' : '0.82'};">
            ${btnText}
          </button>
        </div>`;
    }).join('');
  }

  function openVipSubscriptionModal() {
    syncVipModalFields();
    const m = document.getElementById('vipSubscriptionModal');
    if (m) m.style.display = 'flex';
  }

  function closeSubscriptionModal() {
    const m = document.getElementById('vipSubscriptionModal');
    if (m) m.style.display = 'none';
  }

  async function purchaseVipPlan(planId) {
    if (!window.TapEngine) return;
    const res = await window.TapEngine.purchaseConfiguredVipPlan(planId);
    if (!res.ok) {
      alert(`❌ ${res.error}`);
      return;
    }
    syncVipModalFields();
    renderCategoryTasks();
    const p = res.purchasedPlan || res.plan || {};
    alert(`🎉 ${p.title || 'VIP Star Plan'} Activated (${p.costStars ? p.costStars.toLocaleString() + ' ⭐' : ''})!`);
    closeSubscriptionModal();
  }

  function navigateBack() {
    window.location.href = '../home/index.html';
  }

  function showToast(msg) {
    const toast = document.getElementById('arcadeToast');
    const msgEl = document.getElementById('toastMsg');
    if (!toast || !msgEl) return;
    msgEl.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function setupCloudSync() {
    const listenTasks = (window.Firebase && window.Firebase.listenToCloudTasks) || window.listenToCloudTasks;
    if (typeof listenTasks === 'function') {
      listenTasks(() => renderCategoryTasks());
    }
    const listenSettings = window.Firebase && window.Firebase.listenToAppSettings;
    if (typeof listenSettings === 'function') {
      listenSettings(() => {
        renderCategoryTasks();
        syncVipModalFields();
      });
    }
  }

  window.switchCategory = switchCategory;
  window.renderCategoryTasks = renderCategoryTasks;
  window.renderTasks = renderCategoryTasks;
  window.updateHUD = updateHUD;
  window.openVipSubscriptionModal = openVipSubscriptionModal;
  window.openSubscriptionModal = openVipSubscriptionModal;
  window.closeSubscriptionModal = closeSubscriptionModal;
  window.purchaseVipPlan = purchaseVipPlan;
  window.navigateBack = navigateBack;
  window.showToast = showToast;

  window.addEventListener('firebase:ready', setupCloudSync);
  window.addEventListener('balance:changed', updateHUD);
  window.addEventListener('settings:changed', renderCategoryTasks);
  window.addEventListener('storage', () => renderCategoryTasks());
  try {
    const bc = new BroadcastChannel('nova_task_sync');
    bc.onmessage = () => renderCategoryTasks();
  } catch (e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      renderCategoryTasks();
      setupCloudSync();
    });
  } else {
    renderCategoryTasks();
    setupCloudSync();
  }
})();
