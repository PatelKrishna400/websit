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
    common: { title: 'Common Tasks', icon: '🎟️' },
    simple: { title: 'Coin Tasks', icon: '🪙' },
    coin: { title: 'Coin Tasks', icon: '🪙' },
    star: { title: 'Star Tasks', icon: '⭐' },
    premium: { title: 'Star Tasks', icon: '⭐' },
    pro: { title: 'Pro Tasks (3-Pack)', icon: '💎' },
    ultra: { title: 'Ultra Tasks', icon: '⚡' },
    quiz: { title: 'Quiz Tasks', icon: '🧠' },
    diamond: { title: 'Diamond Tasks', icon: '💎' },
    google: { title: 'Google Form Tasks', icon: '📝' }
  };

  function resolveInitialCategory() {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('cat') || params.get('category') || 'common').toLowerCase().trim();
    if (window.TapEngine) return window.TapEngine.normalizeCategory(raw);
    if (raw === 'coin') return 'simple';
    if (raw === 'premium') return 'star';
    if (['google_form', 'google-form', 'googleform', 'form'].includes(raw)) return 'google';
    if (['common', 'simple', 'star', 'pro', 'ultra', 'quiz', 'diamond', 'google'].includes(raw)) return raw;
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

    // Diamond balance pill shown on Quiz, Diamond & Google Form Tasks pages
    const diamondPill = document.getElementById('diamondPill');
    if (diamondPill) {
      diamondPill.style.display = (activeCategory === 'quiz' || activeCategory === 'diamond' || activeCategory === 'google') ? 'flex' : 'none';
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
      ['common', 'simple', 'star', 'pro', 'ultra', 'quiz', 'diamond', 'google'].forEach(c => shell.classList.remove(`theme-${c}`));
      shell.classList.add(`theme-${k}`);
    }
  }

  function renderCategoryTasks() {
    applyCategoryTheme(activeCategory);
    updateHUD();
    const listEl = document.getElementById('tasksList');
    const bannerEl = document.getElementById('catBannerContainer');
    if (bannerEl && window.TapEngine) {
      const cat = window.TapEngine.normalizeCategory(activeCategory);
      const meta = window.TapEngine.CATEGORY_META[cat] || window.TapEngine.CATEGORY_META.common;
      const bannerClassMap = {
        common: 'banner-common',
        simple: 'banner-coin',
        star: 'banner-star',
        pro: 'banner-pro',
        ultra: 'banner-ultra',
        quiz: 'banner-quiz',
        diamond: 'banner-diamond',
        google: 'banner-google'
      };
      const bCls = bannerClassMap[cat] || 'banner-common';
      let rightPillHtml = '';
      if (cat === 'common') {
        const prog = window.TapEngine.getDailyProgressionState ? window.TapEngine.getDailyProgressionState() : { dayNumber: 1, streakDays: 0 };
        const tix = parseInt(localStorage.getItem('task_user_tickets') || localStorage.getItem('user_tickets') || '0', 10) || 0;
        rightPillHtml = `<span class="cat-banner-stat-pill">🔥 Day ${prog.dayNumber} &bull; 🎟️ ${tix.toLocaleString()}</span>`;
      } else if (cat === 'star') {
        const sProg = window.TapEngine.getStarUnlockProgress
          ? window.TapEngine.getStarUnlockProgress()
          : { googleDone: 0, availableUnlocks: 0, globalReq: 2 };
        rightPillHtml = `<span class="cat-banner-stat-pill">📝 ${sProg.googleDone} Google &bull; 🔓 ${sProg.availableUnlocks} Ready</span>`;
      } else if (cat === 'diamond' || cat === 'google') {
        const dm = parseInt(localStorage.getItem('task_user_diamonds') || localStorage.getItem('user_diamonds') || '0', 10) || 0;
        rightPillHtml = `<span class="cat-banner-stat-pill">💎 ${dm.toLocaleString()} Diamonds</span>`;
      } else {
        const limitInfo = window.TapEngine.getCategoryLimitInfo ? window.TapEngine.getCategoryLimitInfo(cat) : { completedToday: 0, limit: 10 };
        const maxLim = limitInfo.limit !== undefined ? limitInfo.limit : (limitInfo.dailyLimit !== undefined ? limitInfo.dailyLimit : 10);
        rightPillHtml = `<span class="cat-banner-stat-pill">${meta.icon} ${limitInfo.completedToday}/${maxLim}</span>`;
      }

      bannerEl.innerHTML = `
        <div class="cat-visual-banner ${bCls}" id="catVisualHeroBanner">
          <div class="cat-banner-left">
            <div class="cat-banner-icon">${meta.icon}</div>
            <div class="cat-banner-title game-outline-sm">${meta.title}</div>
          </div>
          <div class="cat-banner-right">${rightPillHtml}</div>
        </div>`;
    }
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
    const showPlans = plans.slice(0, 3);
    if (showPlans.length === 0) {
      container.innerHTML = `<div style="padding:1rem;text-align:center;color:#94a3b8;font-size:0.8rem;">No VIP Plans available right now.</div>`;
      return;
    }

    container.innerHTML = showPlans.map((plan) => {
      const isPopular = plan.id === 'vip_1000' || Number(plan.costStars) === 1000;
      const isPlanEnabled = plan.enabled !== false;
      const isThisActive = vip.active && (vip.activePlanId === plan.id || Number(vip.costStars) === Number(plan.costStars));
      const canAfford = bal >= Number(plan.costStars || 0);
      const btnText = !isPlanEnabled
        ? `Unavailable (Paused by Admin)`
        : isThisActive
        ? `👑 Active (${vip.remainingToday}/${vip.dailyTasksLimit} left today)`
        : (vip.active
            ? `VIP Already Active`
            : `Select & Activate (${Number(plan.costStars).toLocaleString()} ⭐)`);
      const disabledAttr = (vip.active || !isPlanEnabled) ? 'disabled' : '';
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
  window.addEventListener('tasks:changed', renderCategoryTasks);
  window.addEventListener('storage', () => renderCategoryTasks());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderCategoryTasks();
  });
  try {
    const bc = new BroadcastChannel('nova_task_sync');
    bc.onmessage = () => renderCategoryTasks();
  } catch (e) {}
  try {
    const balBc = new BroadcastChannel('balance_sync_channel');
    balBc.onmessage = () => updateHUD();
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
