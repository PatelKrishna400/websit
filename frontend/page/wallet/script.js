// Zero-start sanitizer: Initialize missing player keys at 0 without wiping earned balances
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

let userCoins = parseInt(localStorage.getItem('task_game_coins') || '0', 10);
let userStars = parseInt(localStorage.getItem('task_game_stars') || '0', 10);

const REQUIRED_TASKS = 100;
function getWalletStats() {
  const tasksCount = Math.max(
    parseInt(localStorage.getItem('task_game_total_tasks_completed') || '0', 10),
    parseInt(localStorage.getItem('task_game_total_tasks') || '0', 10)
  );
  return { tasksCount };
}

function getWalletSettings() {
  try {
    if (window.TapEmpireUtils && typeof window.TapEmpireUtils.getAppSettings === 'function') {
      return window.TapEmpireUtils.getAppSettings().walletOffers || {};
    }
    const raw = JSON.parse(localStorage.getItem('tap_empire_app_settings') || '{}');
    if (raw && raw.walletOffers) return raw.walletOffers;
  } catch (e) {}
  return {
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
      { id: 'ultra_ms_20', title: '₹1,000 Amazon Shopping Voucher', requiredUltraTasks: 20, deductUltraTasks: 20, giftAmountInr: 1000, starCost: 10000, enabled: true },
      { id: 'ultra_ms_80', title: '₹5,000 Amazon Shopping Voucher', requiredUltraTasks: 80, deductUltraTasks: 80, giftAmountInr: 5000, starCost: 50000, enabled: true },
      { id: 'ultra_ms_140', title: '₹10,000 Amazon Shopping Voucher', requiredUltraTasks: 140, deductUltraTasks: 140, giftAmountInr: 10000, starCost: 100000, enabled: true }
    ]
  };
}

function getUltraCredits() {
  if (window.firebaseSync && typeof window.firebaseSync.getUltraCredits === 'function') {
    return window.firebaseSync.getUltraCredits();
  }
  return Math.max(0, parseInt(localStorage.getItem('wallet_ultra_task_credits') || '0', 10) || 0);
}

function getUltraTotalCompleted() {
  if (window.firebaseSync && typeof window.firebaseSync.getUltraTotalCompleted === 'function') {
    return window.firebaseSync.getUltraTotalCompleted();
  }
  return Math.max(0, parseInt(localStorage.getItem('wallet_ultra_total_completed') || '0', 10) || 0);
}

function getClaimedWalletOffersMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem('wallet_claimed_offers') || '{}');
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    return {};
  }
}

function getOneTimeOfferConfig() {
  const w = getWalletSettings();
  const def = {
    enabled: true,
    title: '₹50 Amazon Shopping Voucher',
    giftAmountInr: 50,
    starCost: 1500,
    requiredUltraTasks: 3,
    deductUltraTasks: 3,
    timerHours: 48,
    countdownEndMs: 0
  };
  return { ...def, ...(w.oneTimeOffer || {}) };
}

function getOneTimeOfferDeadlineMs(cfg) {
  const adminEnd = Number(cfg.countdownEndMs || 0);
  if (adminEnd > 0) return adminEnd;
  const hrs = Math.max(1, parseInt(cfg.timerHours || 48, 10) || 48);
  const key = 'wallet_time_offer_deadline_ms';
  const stored = parseInt(localStorage.getItem(key) || '0', 10) || 0;
  const storedHrs = parseInt(localStorage.getItem('wallet_time_offer_hrs') || '0', 10) || 0;
  if (!stored || storedHrs !== hrs) {
    const nextEnd = Date.now() + hrs * 3600000;
    localStorage.setItem(key, String(nextEnd));
    localStorage.setItem('wallet_time_offer_hrs', String(hrs));
    return nextEnd;
  }
  return stored;
}

function formatOfferTimer(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function updateWalletDisplays() {
  const newCoins = parseInt(localStorage.getItem('task_game_coins') || localStorage.getItem('user_coins') || localStorage.getItem('task_game_coins_alt') || '0', 10);
  const newStars = parseInt(localStorage.getItem('task_game_stars') || localStorage.getItem('user_stars') || '0', 10);

  const topCoins = document.getElementById('walletBalanceTop');
  const topStars = document.getElementById('walletStarsTop');

  const coinsFmt = newCoins.toLocaleString();
  const starsFmt = newStars.toLocaleString();

  if (topCoins && topCoins.textContent !== coinsFmt) {
    userCoins = newCoins;
    topCoins.textContent = coinsFmt;
  }
  if (topStars && topStars.textContent !== starsFmt) {
    userStars = newStars;
    topStars.textContent = starsFmt;
  }

  const uCreditsEl = document.getElementById('walletUltraCreditsVal');
  const uTotalEl = document.getElementById('walletUltraTotalVal');
  if (uCreditsEl) uCreditsEl.textContent = getUltraCredits().toLocaleString();
  if (uTotalEl) uTotalEl.textContent = getUltraTotalCompleted().toLocaleString();

  const userAvatar = document.querySelector('.user-avatar');
  if (userAvatar) {
    const rawAv = localStorage.getItem('player_avatar') || 'avatar-1.png';
    if (typeof window.renderPlayerAvatarEl === 'function') {
      window.renderPlayerAvatarEl(userAvatar, rawAv, 36);
    } else {
      const m = String(rawAv).match(/avatar-([1-8])\.png/i);
      userAvatar.style.background = 'transparent';
      userAvatar.style.border = 'none';
      userAvatar.innerHTML = `<img src="../../assets/avatars/${m ? 'avatar-' + m[1] + '.png' : 'avatar-1.png'}" alt="Avatar" class="sticker-3d-avatar-img" style="width:36px;height:36px;object-fit:contain;display:block;" />`;
    }
  }

  const userName = document.querySelector('.user-name');
  const currentName = localStorage.getItem('player_username') || 'Player';
  if (userName && userName.textContent !== currentName) userName.textContent = currentName;

  checkOneTimeOfferClaimed();
  renderWalletUltraMilestones();
}

window.getWalletStats = getWalletStats;
window.updateWalletDisplays = updateWalletDisplays;
window.openEligibilityModal = openEligibilityModal;
window.closeEligibilityModal = closeEligibilityModal;
window.buyGiftCard = buyGiftCard;

function switchWalletTab(tab) {
  const stdTab = document.getElementById('tabWalletStandard');
  const otoTab = document.getElementById('tabWalletOneTime');
  const stdView = document.getElementById('walletViewStandard');
  const otoView = document.getElementById('walletViewOneTime');

  if (tab === 'onetime') {
    if (stdTab) {
      stdTab.classList.remove('active');
      stdTab.style.background = 'rgba(15, 23, 42, 0.7)';
      stdTab.style.borderColor = 'rgba(56, 189, 248, 0.2)';
      stdTab.style.color = '#94a3b8';
    }
    if (otoTab) {
      otoTab.classList.add('active');
      otoTab.style.background = 'linear-gradient(135deg, #2a0b16 0%, #060e24 100%)';
      otoTab.style.borderColor = '#f43f5e';
      otoTab.style.color = '#ffffff';
    }
    if (stdView) stdView.style.display = 'none';
    if (otoView) otoView.style.display = 'flex';
  } else {
    if (stdTab) {
      stdTab.classList.add('active');
      stdTab.style.background = 'linear-gradient(135deg, #0b1536 0%, #060e24 100%)';
      stdTab.style.borderColor = 'rgba(56, 189, 248, 0.35)';
      stdTab.style.color = '#ffffff';
    }
    if (otoTab) {
      otoTab.classList.remove('active');
      otoTab.style.background = 'rgba(15, 23, 42, 0.7)';
      otoTab.style.borderColor = 'rgba(244, 63, 94, 0.35)';
      otoTab.style.color = '#f43f5e';
    }
    if (stdView) stdView.style.display = 'flex';
    if (otoView) otoView.style.display = 'none';
  }
}
window.switchWalletTab = switchWalletTab;

function checkOneTimeOfferClaimed() {
  const cfg = getOneTimeOfferConfig();
  const claimedMap = getClaimedWalletOffersMap();
  const isClaimed = !!claimedMap.one_time_offer || localStorage.getItem('wallet_one_time_offer_claimed') === 'true';
  const credits = getUltraCredits();
  const stars = parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0;
  const reqUltra = Math.max(0, parseInt(cfg.requiredUltraTasks ?? 3, 10) || 0);
  const deductUltra = Math.max(0, parseInt(cfg.deductUltraTasks ?? reqUltra, 10) || 0);
  const starCost = Math.max(0, parseInt(cfg.starCost ?? 1500, 10) || 0);
  const giftInr = Math.max(1, parseInt(cfg.giftAmountInr ?? 50, 10) || 50);

  const tabOneTime = document.getElementById('tabWalletOneTime');
  const viewOneTime = document.getElementById('walletViewOneTime');
  if (isClaimed) {
    if (tabOneTime) tabOneTime.style.display = 'none';
    if (viewOneTime) {
      const wasOpen = viewOneTime.style.display !== 'none';
      viewOneTime.style.display = 'none';
      if (wasOpen && typeof switchWalletTab === 'function') switchWalletTab('standard');
    }
    return;
  } else {
    if (tabOneTime) tabOneTime.style.display = '';
  }

  const endMs = getOneTimeOfferDeadlineMs(cfg);
  const remMs = endMs - Date.now();
  const isExpired = cfg.enabled === false || remMs <= 0;

  const tabBadge = document.getElementById('tabTimeOfferBadge');
  const titleEl = document.getElementById('oneTimeOfferTitle');
  const starsEl = document.getElementById('oneTimeOfferStarsVal');
  const reqStrip = document.getElementById('oneTimeOfferReqStrip');
  const cdBadge = document.getElementById('oneTimeCountdownBadge');
  const btn = document.getElementById('btnBuyOneTimeOffer');

  if (tabBadge) tabBadge.textContent = `₹${giftInr}`;
  if (titleEl) titleEl.textContent = cfg.title || `₹${giftInr} Amazon Shopping Voucher`;
  if (starsEl) starsEl.textContent = starCost.toLocaleString();
  if (reqStrip) {
    const pct = reqUltra > 0 ? Math.min(100, Math.round((credits / reqUltra) * 100)) : 100;
    reqStrip.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;">${walletStickerHtml('sticker-bolt.png', 'Ultra')} Ultra Tasks: <b style="color:${credits >= reqUltra ? '#34d399' : '#fbbf24'};">${Math.min(credits, reqUltra)}/${reqUltra}</b> (${pct}%) &bull; Uses ${deductUltra} Credits</span>`;
  }
  if (cdBadge) {
    cdBadge.innerHTML = cfg.enabled === false
      ? `${walletStickerHtml('sticker-hourglass.png')} Disabled`
      : (remMs <= 0 ? `${walletStickerHtml('sticker-hourglass.png')} Expired` : `${walletStickerHtml('sticker-timer.png')} Ends in ${formatOfferTimer(remMs)}`);
    cdBadge.style.color = isExpired ? '#f87171' : '#fbbf24';
  }

  if (btn) {
    if (isExpired) {
      btn.disabled = true;
      btn.innerHTML = cfg.enabled === false
        ? `${walletStickerHtml('sticker-hourglass.png')}<span>Offer Paused</span>`
        : `${walletStickerHtml('sticker-hourglass.png')}<span>Offer Expired</span>`;
      btn.style.background = '#334155';
      btn.style.borderColor = '#475569';
      btn.style.color = '#f87171';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.disabled = false;
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
      btn.style.cursor = 'pointer';
      btn.innerHTML = (credits >= reqUltra && stars >= starCost)
        ? `${walletStickerHtml('sticker-unlock.png')}<span>Unlock Request</span>`
        : `${walletStickerHtml('sticker-unlock.png')}<span>Unlock Request (${Math.min(credits, reqUltra)}/${reqUltra})</span>`;
    }
  }
}
window.checkOneTimeOfferClaimed = checkOneTimeOfferClaimed;

function walletStickerHtml(file, alt = '', cls = 'ui-3d-sticker-xs') {
  return `<img src="../../assets/stickers/${file}" alt="${escapeHtml(alt)}" class="${cls}" />`;
}

function getVoucherImageForInr(inr) {
  const n = parseInt(inr, 10) || 1000;
  if (n === 50) return 'assets/amazon_50.jpg';
  if (n >= 10000) return 'assets/amazon_10000.jpg';
  if (n >= 5000) return 'assets/amazon_5000.jpg';
  return 'assets/amazon_1000.jpg';
}

function renderWalletUltraMilestones() {
  const container = document.getElementById('walletUltraMilestonesContainer');
  if (!container) return;

  const w = getWalletSettings();
  const list = Array.isArray(w.ultraMilestones) ? w.ultraMilestones.filter(m => m && m.enabled !== false) : [];
  if (list.length === 0) {
    container.innerHTML = `<div style="padding:1rem;text-align:center;color:#94a3b8;font-size:0.8rem;">No offers configured in Admin Panel yet.</div>`;
    return;
  }

  const credits = getUltraCredits();
  const currentStars = parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0;

  container.innerHTML = list.map(m => {
    const id = String(m.id || `ultra_ms_${m.requiredUltraTasks}`);
    const req = Math.max(1, parseInt(m.requiredUltraTasks || 20, 10) || 20);
    const deduct = Math.max(0, parseInt(m.deductUltraTasks !== undefined ? m.deductUltraTasks : req, 10) || 0);
    const gift = Math.max(1, parseInt(m.giftAmountInr || 1000, 10) || 1000);
    const starCost = Math.max(0, parseInt(m.starCost || 0, 10) || 0);
    const shownProg = Math.min(credits, req);
    const pct = Math.min(100, Math.round((shownProg / req) * 100));
    const hasCredits = credits >= req && credits >= deduct;
    const hasStars = currentStars >= starCost;
    const canUnlock = hasCredits && hasStars;
    const imgPath = getVoucherImageForInr(gift);
    const safeTitle = escapeHtml(m.title || `₹${gift.toLocaleString()} Amazon Shopping Voucher`);

    return `
      <div class="giftcard-card" data-milestone-id="${escapeHtml(id)}" style="border-color: ${canUnlock ? 'rgba(52, 211, 153, 0.55)' : 'rgba(250, 204, 21, 0.45)'}; box-shadow: 0 4px 16px rgba(250, 204, 21, 0.12);">
        <div class="giftcard-media">
          <img src="${imgPath}" alt="${safeTitle}" class="giftcard-img" loading="lazy" decoding="async" />
        </div>
        <div class="giftcard-content">
          <div class="giftcard-meta">
            <span class="giftcard-brand wallet-brand-row" style="color: #fde047;">
              ${walletStickerHtml('sticker-bolt.png')}
              <span>ULTRA OFFER • ${req.toLocaleString()} CREDITS${starCost > 0 ? ` + ${starCost.toLocaleString()}` : ''}</span>
              ${starCost > 0 ? walletStickerHtml('sticker-star.png') : ''}
            </span>
            <h3 class="giftcard-name">${safeTitle}</h3>
            <div style="margin-top:5px;">
              <div style="display:flex;justify-content:space-between;font-size:0.68rem;font-weight:800;color:#cbd5e1;margin-bottom:3px;">
                <span>Credits: ${shownProg.toLocaleString()} / ${req.toLocaleString()}</span>
                <span style="color:#38bdf8;">Uses ${deduct.toLocaleString()} Credits</span>
              </div>
              <div style="height:7px;background:rgba(15,23,42,0.9);border-radius:999px;overflow:hidden;border:1px solid rgba(250,204,21,0.3);">
                <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#f59e0b,#10b981);border-radius:999px;"></div>
              </div>
            </div>
          </div>
          <div class="giftcard-actions-bar">
            <div class="giftcard-price">
              <span class="price-star">${walletStickerHtml(starCost > 0 ? 'sticker-star.png' : 'sticker-bolt.png', '', 'ui-3d-sticker-sm')}</span>
              <span class="price-val">${starCost > 0 ? starCost.toLocaleString() : deduct.toLocaleString()}</span>
              <span class="price-unit">${starCost > 0 ? `Stars + ${deduct} Credits` : 'Credits'}</span>
            </div>
            <button class="btn-buy-giftcard" data-claim-milestone="${escapeHtml(id)}" onclick='openConfiguredMilestoneOffer(${JSON.stringify(id)})' style="${canUnlock ? 'background:linear-gradient(135deg,#f59e0b,#d97706);color:#1e1b4b;' : ''}">${walletStickerHtml('sticker-unlock.png')}<span>Unlock Request</span></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openConfiguredOneTimeOffer() {
  const cfg = getOneTimeOfferConfig();
  const gift = Math.max(1, parseInt(cfg.giftAmountInr ?? 50, 10) || 50);
  const starCost = Math.max(0, parseInt(cfg.starCost ?? 1500, 10) || 0);
  const reqUltra = Math.max(0, parseInt(cfg.requiredUltraTasks ?? 30, 10) || 0);
  const deductUltra = Math.max(0, parseInt(cfg.deductUltraTasks ?? reqUltra, 10) || 0);
  openBuyModal(gift, starCost, cfg.title || `₹${gift} Amazon Shopping Voucher`, 'assets/amazon_50.jpg', {
    offerKey: 'one_time_offer',
    reqUltra,
    deductUltra
  });
}
window.openConfiguredOneTimeOffer = openConfiguredOneTimeOffer;

function openConfiguredMilestoneOffer(milestoneId) {
  const w = getWalletSettings();
  const m = (w.ultraMilestones || []).find(x => String(x.id) === String(milestoneId));
  if (!m) return;
  const gift = Math.max(1, parseInt(m.giftAmountInr || 1000, 10) || 1000);
  const starCost = Math.max(0, parseInt(m.starCost || 0, 10) || 0);
  const reqUltra = Math.max(1, parseInt(m.requiredUltraTasks || 100, 10) || 100);
  const deductUltra = Math.max(0, parseInt(m.deductUltraTasks !== undefined ? m.deductUltraTasks : reqUltra, 10) || 0);
  openBuyModal(gift, starCost, m.title || `₹${gift.toLocaleString()} Amazon Shopping Voucher`, getVoucherImageForInr(gift), {
    offerKey: String(m.id),
    reqUltra,
    deductUltra
  });
}
window.openConfiguredMilestoneOffer = openConfiguredMilestoneOffer;


function openEligibilityModal(tasksCount, adsCount) {
  const modal = document.getElementById('eligibilityModalOverlay');
  updateWalletDisplays();
  if (modal) modal.classList.add('active');
}

function closeEligibilityModal() {
  const modal = document.getElementById('eligibilityModalOverlay');
  if (modal) modal.classList.remove('active');
}

// Helper to escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 1. Trigger Buy: Open Buy Form Modal directly
function buyGiftCard(rsAmount, starCost, title, imgPath, offerOpts) {
  openBuyModal(rsAmount, starCost, title, imgPath, offerOpts);
}

function openBuyModal(rsAmount, starCost, title, imgPath, offerOpts) {
  let opts = (offerOpts && typeof offerOpts === 'object') ? { ...offerOpts } : {};
  const rsNum = parseInt(rsAmount, 10);
  if (offerOpts === true || (!offerOpts && rsNum === 50)) {
    const cfg = getOneTimeOfferConfig();
    opts = {
      offerKey: 'one_time_offer',
      reqUltra: Math.max(0, parseInt(cfg.requiredUltraTasks ?? 30, 10) || 0),
      deductUltra: Math.max(0, parseInt(cfg.deductUltraTasks ?? cfg.requiredUltraTasks ?? 30, 10) || 0)
    };
  }

  const offerKey = opts.offerKey || '';
  const reqUltra = Math.max(0, parseInt(opts.reqUltra || 0, 10) || 0);
  const deductUltra = Math.max(0, parseInt(opts.deductUltra !== undefined ? opts.deductUltra : reqUltra, 10) || 0);
  const claimedMap = getClaimedWalletOffersMap();

  if (offerKey === 'one_time_offer' && (claimedMap.one_time_offer || localStorage.getItem('wallet_one_time_offer_claimed') === 'true')) {
    alert('This offer has already been claimed by your account (1-Time Only)!');
    return;
  }
  if (offerKey === 'one_time_offer') {
    const cfg = getOneTimeOfferConfig();
    if (cfg.enabled === false || Date.now() >= getOneTimeOfferDeadlineMs(cfg)) {
      alert('⌛ This Time Offer has expired or is currently disabled.');
      return;
    }
  }

  const modal = document.getElementById('buyModalOverlay');
  const imgEl = document.getElementById('buyModalImg');
  const titleEl = document.getElementById('buyModalTitle');
  const costEl = document.getElementById('buyModalCost');

  const rsInput = document.getElementById('buyParamRs');
  const starsInput = document.getElementById('buyParamStars');
  const titleInput = document.getElementById('buyParamTitle');
  const imgInput = document.getElementById('buyParamImg');
  const offerKeyInput = document.getElementById('buyParamOfferKey');
  const reqUltraInput = document.getElementById('buyParamReqUltra');
  const deductUltraInput = document.getElementById('buyParamDeductUltra');

  if (imgEl) imgEl.src = imgPath;
  if (titleEl) titleEl.textContent = title;
  if (costEl) {
    costEl.textContent = deductUltra > 0
      ? `${starCost > 0 ? starCost.toLocaleString() + ' Stars + ' : ''}${deductUltra.toLocaleString()} Ultra Credits`
      : `${starCost.toLocaleString()} Stars`;
  }

  if (rsInput) rsInput.value = rsAmount;
  if (starsInput) starsInput.value = starCost;
  if (titleInput) titleInput.value = title;
  if (imgInput) imgInput.value = imgPath;
  if (offerKeyInput) offerKeyInput.value = offerKey;
  if (reqUltraInput) reqUltraInput.value = String(reqUltra);
  if (deductUltraInput) deductUltraInput.value = String(deductUltra);

  // Reset to Step 1
  const step1 = document.getElementById('buyModalStep1');
  const step2 = document.getElementById('buyModalStep2');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';

  // 1. Loading Bar 1: Ultra Tasks Required (for Ultra/Time Offers) OR Web Tasks Completed (Standard Store)
  const useUltraGate = !!offerKey || reqUltra > 0;
  const completedCount = useUltraGate
    ? getUltraCredits()
    : parseInt(localStorage.getItem('completed_tasks_count') || localStorage.getItem('task_game_total_tasks') || '0', 10);
  const requiredTasks = useUltraGate ? Math.max(1, reqUltra) : 100;
  const tasksPct = Math.min(100, Math.round((completedCount / requiredTasks) * 100));

  const tasksLabelEl = document.getElementById('buyReqTasksLabel');
  const tasksValEl = document.getElementById('buyReqTasksVal');
  const tasksBarEl = document.getElementById('buyReqTasksBar');
  const tasksSubEl = document.getElementById('buyReqTasksSub');
  if (tasksLabelEl) {
    tasksLabelEl.innerHTML = useUltraGate
      ? `${walletStickerHtml('sticker-bolt.png')} <span>Ultra Tasks Required (Deducts ${deductUltra} Credits)</span>`
      : `${walletStickerHtml('sticker-web.png')} <span>Web Tasks Completed</span>`;
  }
  if (tasksValEl) tasksValEl.textContent = `${completedCount} / ${requiredTasks} (${tasksPct}%)`;
  if (tasksBarEl) tasksBarEl.style.width = `${tasksPct}%`;
  if (tasksSubEl) tasksSubEl.remove();

  // 2. Loading Bar 2: Stars Balance
  userStars = parseInt(localStorage.getItem('task_game_stars') || '0', 10);
  const starsPct = starCost > 0 ? Math.min(100, Math.round((userStars / starCost) * 100)) : 100;

  const starsValEl = document.getElementById('buyReqStarsVal');
  const starsBarEl = document.getElementById('buyReqStarsBar');
  const starsSubEl = document.getElementById('buyReqStarsSub');
  if (starsValEl) {
    starsValEl.textContent = starCost > 0
      ? `${userStars.toLocaleString()} / ${starCost.toLocaleString()} (${starsPct}%)`
      : '0 Stars Needed (100% Free)';
  }
  if (starsBarEl) starsBarEl.style.width = `${starsPct}%`;
  if (starsSubEl) starsSubEl.remove();

  // Check qualifications to enable "Proceed to Buy" button
  const canBuy = (completedCount >= requiredTasks) && (completedCount >= deductUltra) && (userStars >= starCost);
  const btnProceed = document.getElementById('btnProceedToStep2');
  if (btnProceed) {
    if (canBuy) {
      btnProceed.disabled = false;
      btnProceed.innerHTML = `${walletStickerHtml('sticker-unlock.png')}<span>Unlock Request ➔</span>`;
      btnProceed.style.opacity = '1';
      btnProceed.style.cursor = 'pointer';
      btnProceed.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    } else if (completedCount < requiredTasks || completedCount < deductUltra) {
      btnProceed.disabled = true;
      btnProceed.innerHTML = `${walletStickerHtml('sticker-hourglass.png')}<span>Need ${Math.max(requiredTasks, deductUltra)} ${useUltraGate ? 'Ultra Credits' : 'Tasks'}</span>`;
      btnProceed.style.opacity = '0.5';
      btnProceed.style.cursor = 'not-allowed';
      btnProceed.style.background = '#334155';
    } else {
      btnProceed.disabled = true;
      btnProceed.innerHTML = `${walletStickerHtml('sticker-star.png')}<span>Need ${starCost.toLocaleString()} Stars</span>`;
      btnProceed.style.opacity = '0.5';
      btnProceed.style.cursor = 'not-allowed';
      btnProceed.style.background = '#334155';
    }
  }

  // Pre-fill saved Email or Mobile in step 2 (ensuring no "null")
  const savedContact = localStorage.getItem('player_contact_info') || localStorage.getItem('player_email') || localStorage.getItem('player_whatsapp') || '';
  const waInput = document.getElementById('buyUserWhatsapp');
  if (waInput && savedContact && savedContact !== 'null') {
    waInput.value = savedContact;
  }

  if (modal) modal.classList.add('active');
}

function goToBuyStep2() {
  const step1 = document.getElementById('buyModalStep1');
  const step2 = document.getElementById('buyModalStep2');
  if (step1) step1.style.display = 'none';
  if (step2) step2.style.display = 'block';

  const waInput = document.getElementById('buyUserWhatsapp');
  if (waInput) {
    const savedContact = localStorage.getItem('player_contact_info') || localStorage.getItem('player_email') || localStorage.getItem('player_whatsapp') || '';
    if (savedContact && savedContact !== 'null') waInput.value = savedContact;
    setTimeout(() => waInput.focus(), 80);
  }
}

function goToBuyStep1() {
  const step1 = document.getElementById('buyModalStep1');
  const step2 = document.getElementById('buyModalStep2');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';
}

function closeBuyModal() {
  const modal = document.getElementById('buyModalOverlay');
  if (modal) modal.classList.remove('active');
}

// 2. Handle Form Submit: Validate, Deduct Stars & Register Order
async function handleConfirmBuy(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('btnSubmitBuy');
  if (submitBtn && submitBtn.disabled) return;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }, 2000);
  }

  const rsAmount = parseInt(document.getElementById('buyParamRs').value, 10) || 1000;
  const starCost = parseInt(document.getElementById('buyParamStars').value || '0', 10) || 0;
  const title = document.getElementById('buyParamTitle').value || '₹1,000 Amazon Shopping Voucher';
  const imgPath = document.getElementById('buyParamImg').value || 'assets/amazon_1000.jpg';
  const offerKey = (document.getElementById('buyParamOfferKey')?.value || '').trim();
  const reqUltra = Math.max(0, parseInt(document.getElementById('buyParamReqUltra')?.value || '0', 10) || 0);
  const deductUltra = Math.max(0, parseInt(document.getElementById('buyParamDeductUltra')?.value || '0', 10) || 0);

  const contactVal = (document.getElementById('buyUserWhatsapp')?.value || '').trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactVal);
  const digitsOnly = contactVal.replace(/\D/g, '');
  const isMobile = !isEmail && /^\+?[\d\s\-()]{7,18}$/.test(contactVal) && digitsOnly.length >= 7 && digitsOnly.length <= 15;

  if (!contactVal || (!isEmail && !isMobile)) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
    alert('Please enter a valid Email address (e.g. name@example.com) or Mobile number (7-15 digits).');
    return;
  }

  // Only one_time_offer is 1-time locked; ultra_ms_* voucher requests are unlimited whenever user has credits
  const claimedMap = getClaimedWalletOffersMap();
  const isOneTimeOnly = offerKey === 'one_time_offer';
  if (isOneTimeOnly && (claimedMap.one_time_offer || localStorage.getItem('wallet_one_time_offer_claimed') === 'true')) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('loading'); }
    alert('❌ This offer has already been claimed (1-Time Only).');
    return;
  }

  const curCredits = getUltraCredits();
  if (reqUltra > 0 && (curCredits < reqUltra || curCredits < deductUltra)) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('loading'); }
    alert(`❌ Need ${Math.max(reqUltra, deductUltra)} Ultra Task Credits (Available: ${curCredits}).`);
    return;
  }

  userStars = parseInt(localStorage.getItem('task_game_stars') || '0', 10);
  if (userStars < starCost) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
    const diff = starCost - userStars;
    const goToShop = confirm(
      `Insufficient Stars!\n\nYou have ${userStars.toLocaleString()} ⭐ but need ${starCost.toLocaleString()} ⭐ (${diff.toLocaleString()} more).\n\nWould you like to open the Shop to get more Stars?`
    );
    if (goToShop) {
      window.location.href = '../shop/index.html';
    }
    return;
  }

  // Save validated contact for user convenience
  localStorage.setItem('player_contact_info', contactVal);
  if (isEmail) localStorage.setItem('player_email', contactVal);
  if (isMobile) localStorage.setItem('player_whatsapp', contactVal);

  const rawSavedEmail = localStorage.getItem('player_email');
  const resolvedEmail = isEmail ? contactVal : ((rawSavedEmail && rawSavedEmail !== 'null') ? rawSavedEmail : '');
  const resolvedWhatsapp = isMobile ? contactVal : '';

  if (window.__walletBuyBusy) return;
  window.__walletBuyBusy = true;

  const txId = isOneTimeOnly
    ? 'offer_unlock_one_time_offer'
    : `wd_req_${Date.now()}_${rsAmount}_${Math.random().toString(36).slice(2, 6)}`;

  // Deduct stars + Ultra Task credits atomically in Firebase
  if (window.Firebase && typeof window.Firebase.atomicBalanceMutation === 'function') {
    const res = await window.Firebase.atomicBalanceMutation({
      deltaStars: -starCost,
      deltaUltraCredits: -deductUltra,
      claimOfferKey: isOneTimeOnly ? 'one_time_offer' : null,
      reason: `Voucher Order ₹${rsAmount}`,
      txId
    });
    if (!res.ok) {
      window.__walletBuyBusy = false;
      alert(`❌ ${res.error || 'Could not process offer unlock.'}`);
      return;
    }
    userStars = res.stars;
  } else {
    if (starCost > 0) {
      if (window.firebaseSync && typeof window.firebaseSync.subtractStars === 'function') {
        const res = window.firebaseSync.subtractStars(starCost, `Amazon Shopping Voucher ₹${rsAmount}`);
        if (res === false) { window.__walletBuyBusy = false; return; }
        userStars = res;
      } else {
        userStars -= starCost;
        localStorage.setItem('task_game_stars', userStars.toString());
        localStorage.setItem('user_stars', userStars.toString());
      }
    }
    if (deductUltra > 0) {
      const rem = Math.max(0, curCredits - deductUltra);
      localStorage.setItem('wallet_ultra_task_credits', String(rem));
    }
    if (isOneTimeOnly) {
      const nextMap = { ...claimedMap, one_time_offer: Date.now() };
      localStorage.setItem('wallet_claimed_offers', JSON.stringify(nextMap));
      localStorage.setItem('wallet_one_time_offer_claimed', 'true');
    }
  }

  if (typeof window.updateAllDomBalances === 'function') {
    window.updateAllDomBalances(userCoins, userStars);
  }
  if (typeof window.saveCurrentProfileToFirestore === 'function') {
    window.saveCurrentProfileToFirestore();
  }
  updateWalletDisplays();

  // Generate unique voucher claim code
  const randomChars = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const claimCode = `AMZN-${randomChars()}-${randomChars()}-${rsAmount}R`;

  // Push into withdrawals so Admin Mission Control can review and approve it!
  try {
    const WITHDRAW_STORAGE_KEY = 'task_game_withdrawals';
    const rawWd = localStorage.getItem(WITHDRAW_STORAGE_KEY);
    const withdrawals = rawWd ? JSON.parse(rawWd) : [];
    const uid = (window.Firebase && typeof window.Firebase.getEffectivePlayerUid === 'function')
      ? window.Firebase.getEffectivePlayerUid()
      : (localStorage.getItem('player_uid') || 'usr_player');
    const newOrder = {
      id: `WD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      userId: uid,
      playerName: localStorage.getItem('player_username') || 'Player',
      playerAvatar: localStorage.getItem('player_avatar') || '🎁',
      amount: rsAmount,
      starCost: starCost,
      deductUltraTasks: deductUltra,
      offerKey: offerKey || '',
      method: `Amazon Voucher (₹${rsAmount})`,
      contactInfo: contactVal,
      contactType: isEmail ? 'email' : 'mobile',
      whatsapp: contactVal,
      details: `${isEmail ? 'Email' : 'Mobile'}: ${contactVal} • Ref: ${claimCode}`,
      time: new Date().toLocaleString(),
      createdAt: Date.now(),
      timestamp: Date.now(),
      status: 'pending',
      deliveryStatus: 'Processing (Up to 10 Days)',
      expectedDeliveryDays: 10,
      userEmail: resolvedEmail,
      userWhatsapp: resolvedWhatsapp,
      voucherCode: claimCode
    };
    withdrawals.unshift(newOrder);
    localStorage.setItem(WITHDRAW_STORAGE_KEY, JSON.stringify(withdrawals));

    if (window.Firebase && typeof window.Firebase.saveWithdrawalToCloud === 'function') {
      window.Firebase.saveWithdrawalToCloud(newOrder);
    }
    if (window.Firebase && typeof window.Firebase.saveCurrentProfileToFirestore === 'function') {
      window.Firebase.saveCurrentProfileToFirestore();
    }

    // Real-time broadcast to Admin panel & all connected tabs
    try {
      const syncChannel = new BroadcastChannel('nova_task_sync');
      syncChannel.postMessage({ type: 'WITHDRAWALS_UPDATED', timestamp: Date.now() });
      syncChannel.postMessage({
        type: 'BALANCES_UPDATED',
        coins: userCoins,
        stars: userStars,
        tickets: parseInt(localStorage.getItem('task_user_tickets') || localStorage.getItem('user_tickets') || '0', 10),
        timestamp: Date.now()
      });
      syncChannel.close();
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent('balance:changed', {
        detail: {
          coins: userCoins,
          stars: userStars,
          tickets: parseInt(localStorage.getItem('task_user_tickets') || localStorage.getItem('user_tickets') || '0', 10)
        }
      }));
    } catch (e) {}
  } catch (e) {
    console.error('Error recording wallet order:', e);
  }

  if (offerKey === 'one_time_offer' || rsAmount === 50) {
    localStorage.setItem('wallet_one_time_offer_claimed', 'true');
  }
  updateWalletDisplays();
  renderWalletOrders();

  // Close Buy Form Modal
  window.__walletBuyBusy = false;
  closeBuyModal();

  // Show Voucher Success Modal
  const modal = document.getElementById('voucherModalOverlay');
  const modalImg = document.getElementById('modalVoucherImg');
  const modalTitle = document.getElementById('modalVoucherTitle');
  const modalCode = document.getElementById('modalVoucherCode');
  const modalSub = document.querySelector('.modal-voucher-sub');
  const btnCopy = document.getElementById('btnCopyCode');

  if (modalImg) modalImg.src = imgPath;
  if (modalTitle) modalTitle.textContent = title;
  if (modalCode) modalCode.textContent = claimCode;
  if (modalSub) {
    modalSub.innerHTML = `Unlock request submitted for ${isEmail ? 'email' : 'mobile'}: <strong style="color: #34d399;">${escapeHtml(contactVal)}</strong>`;
  }
  if (btnCopy) {
    btnCopy.textContent = 'Copy';
    btnCopy.disabled = false;
  }

  if (modal) modal.classList.add('active');

  // Add to transaction history
  if (typeof window.addTransaction === 'function') {
    window.addTransaction(`Redeemed ${title}`, `-${starCost.toLocaleString()} ⭐`, 'Just now');
  }

  if (window.TelegramStars && typeof window.TelegramStars.addTransaction === 'function') {
    window.TelegramStars.addTransaction({
      id: `XTR-SPEND-${Math.floor(100000 + Math.random() * 900000)}`,
      amount: -starCost,
      currency: 'XTR',
      date: Math.floor(Date.now() / 1000),
      formattedDate: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      peer: 'starsTransactionPeer',
      title: `Redeemed ${title}`,
      description: `Amazon Voucher ${claimCode}`,
      status: 'completed',
      paymentMethod: 'voucher_redemption'
    });
    if (typeof window.renderTgTransactionsLedger === 'function') {
      window.renderTgTransactionsLedger();
    }
  }
}

function closeVoucherModal() {
  const modal = document.getElementById('voucherModalOverlay');
  if (modal) modal.classList.remove('active');
}

function copyVoucherCode() {
  const codeEl = document.getElementById('modalVoucherCode');
  const btnCopy = document.getElementById('btnCopyCode');
  if (!codeEl) return;

  const code = codeEl.textContent.trim();
  navigator.clipboard.writeText(code).then(() => {
    if (btnCopy) {
      btnCopy.textContent = 'Copied! ✓';
      setTimeout(() => {
        if (btnCopy) btnCopy.textContent = 'Copy';
      }, 2500);
    }
  }).catch(() => {
    // Fallback for clipboard
    const tempInput = document.createElement('input');
    tempInput.value = code;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    if (btnCopy) {
      btnCopy.textContent = 'Copied! ✓';
      setTimeout(() => {
        if (btnCopy) btnCopy.textContent = 'Copy';
      }, 2500);
    }
  });
}

function maskContactPreview(raw) {
  const s = String(raw || '').trim();
  if (!s || s === '***') return '';
  if (s.includes('@')) {
    const parts = s.split('@');
    const local = parts[0];
    return `${local.slice(0, 2)}***@${parts[1] || '***'}`;
  }
  if (s.length >= 6) return `${s.slice(0, 2)}****${s.slice(-2)}`;
  return '***';
}

function renderWalletOrders() {
  const historyList = document.getElementById('walletHistoryList');
  if (!historyList) return;

  const WITHDRAW_STORAGE_KEY = 'task_game_withdrawals';
  const myUid = (window.Firebase && typeof window.Firebase.getEffectivePlayerUid === 'function')
    ? window.Firebase.getEffectivePlayerUid()
    : (localStorage.getItem('player_uid') || '');

  let withdrawals = [];
  try {
    const rawWd = localStorage.getItem(WITHDRAW_STORAGE_KEY);
    const parsed = rawWd ? JSON.parse(rawWd) : [];
    const cleaned = Array.isArray(parsed)
      ? parsed.filter((w) => w && !w.isDemo && !String(w.id || '').toLowerCase().includes('demo') && !['WD-8491', 'WD-8490', 'WD-8489', 'WD-8488'].includes(w.id))
      : [];
    if (Array.isArray(parsed) && cleaned.length !== parsed.length) {
      localStorage.setItem(WITHDRAW_STORAGE_KEY, JSON.stringify(cleaned));
    }
    withdrawals = cleaned.filter((w) => !w.userId || !myUid || String(w.userId) === String(myUid));
  } catch (e) {
    withdrawals = [];
  }

  if (withdrawals.length === 0) {
    historyList.innerHTML = `
      <div style="padding: 1.5rem 1rem; text-align: center; color: #64748b; font-size: 0.82rem; display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap;">
        ${walletStickerHtml('sticker-bag.png', 'Orders', 'ui-3d-sticker-sm')}
        <span>No recent transactions or unlock requests yet. Claim an Amazon voucher above once eligible!</span>
      </div>
    `;
    return;
  }

  historyList.innerHTML = withdrawals.map(w => {
    const isApproved = w.status === 'approved';
    const isRejected = w.status === 'rejected';
    const statusText = isApproved
      ? `Approved ${walletStickerHtml('sticker-check.png')}`
      : (isRejected ? `Rejected ${walletStickerHtml('sticker-cross.png')}` : `Pending ${walletStickerHtml('sticker-hourglass.png')}`);
    const statusColor = isApproved ? '#34d399' : '#f87171';
    const statusBg = isApproved ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.16)';
    const statusBorder = isApproved ? 'rgba(52, 211, 153, 0.55)' : 'rgba(248, 113, 113, 0.45)';
    const rawMethod = String(w.method || 'Amazon Gift Card').trim();
    const amt = Number(w.amount || 0);
    const cleanTitle = (amt > 0 && !rawMethod.includes(String(amt))) ? `${rawMethod} (₹${amt.toLocaleString()})` : rawMethod;

    return `
      <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 0.85rem 0.65rem; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
        <div class="history-name" style="font-weight: 800; color: #ffffff; font-size: 0.9rem;">${escapeHtml(cleanTitle)}</div>
        <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.74rem; font-weight: 900; padding: 4px 12px; border-radius: 999px; background: ${statusBg}; color: ${statusColor}; border: 1.5px solid ${statusBorder}; white-space: nowrap;">
          ${statusText}
        </span>
      </div>
    `;
  }).join('');
}

const HTML_ESC_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
const HTML_ESC_REGEX = /[&<>"']/g;

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(HTML_ESC_REGEX, ch => HTML_ESC_MAP[ch]);
}

window.renderTgTransactionsLedger = function() {};

document.addEventListener('DOMContentLoaded', () => {
  updateWalletDisplays();
  renderWalletOrders();
  window.renderTgTransactionsLedger();
  setInterval(updateWalletDisplays, 1000);

  const attachWdCloudListener = () => {
    const listenWds = (window.Firebase && window.Firebase.listenToCloudWithdrawals) || window.listenToCloudWithdrawals;
    if (typeof listenWds === 'function') {
      const myUid = (window.Firebase && typeof window.Firebase.getEffectivePlayerUid === 'function')
        ? window.Firebase.getEffectivePlayerUid()
        : (localStorage.getItem('player_uid') || '');
      listenWds((cloudWds) => {
        if (!Array.isArray(cloudWds)) return;
        const mine = cloudWds.filter(w => !myUid || !w.userId || w.userId === myUid);
        localStorage.setItem('task_game_withdrawals', JSON.stringify(mine));
        renderWalletOrders();
      });
    }
  };
  window.addEventListener('firebase:ready', () => {
    attachWdCloudListener();
    const listenSettings = window.Firebase && window.Firebase.listenToAppSettings;
    if (typeof listenSettings === 'function') {
      listenSettings(() => updateWalletDisplays());
    }
  });
  attachWdCloudListener();
});

window.addEventListener('settings:changed', () => updateWalletDisplays());

// Real-Time Cross-Tab / Cross-Window Sync
window.addEventListener('storage', (e) => {
  if (
    e.key === 'task_game_coins' ||
    e.key === 'task_game_stars' ||
    e.key === 'task_game_total_tasks_completed' ||
            e.key === 'task_game_withdrawals' ||
    e.key === 'player_username' ||
    e.key === 'player_avatar'
  ) {
    updateWalletDisplays();
    renderWalletOrders();
  }
});

try {
  const syncChannel = new BroadcastChannel('nova_task_sync');
  syncChannel.onmessage = () => {
    updateWalletDisplays();
    renderWalletOrders();
  };
} catch (e) {}

try {
  const bSync = new BroadcastChannel('balance_sync_channel');
  bSync.onmessage = () => {
    updateWalletDisplays();
    renderWalletOrders();
  };
} catch (e) {}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateWalletDisplays();
    renderWalletOrders();
  }
});

window.addEventListener('balance:changed', () => {
  updateWalletDisplays();
});

window.addEventListener('balance:synced', () => {
  updateWalletDisplays();
});
