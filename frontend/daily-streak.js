/**
 * ============================================================================
 * DAILY STREAK REWARDS SYSTEM (7-DAY CALENDAR)
 * Day 1: 5 Tickets
 * Day 2: 8 Tickets
 * Day 3: 10 Tickets
 * Day 4: 15 Tickets
 * Day 5: 20 Tickets
 * Day 6: 25 Tickets
 * Day 7: 100 Coins + 20 Tickets
 * ============================================================================
 */

(function() {
  const STREAK_BASE_URL = (() => {
    try {
      const cs = document.currentScript && document.currentScript.src;
      if (cs) return new URL('.', cs).href;
    } catch (e) {}
    return '../../';
  })();
  function streakAssetUrl(relPath) {
    return `${STREAK_BASE_URL}${relPath}`;
  }
  function streakSticker(file, cls = 'streak-3d-ico-sm', alt = '') {
    return `<img src="${streakAssetUrl('assets/stickers/' + file)}" alt="${alt}" class="${cls}" />`;
  }

  const STREAK_COUNT_KEY = 'task_daily_streak_count';
  const STREAK_LAST_DATE_KEY = 'task_daily_streak_last_date';
  const USER_TICKETS_KEY = 'task_user_tickets';
  const USER_COINS_KEY = 'task_game_coins';
  const USER_COINS_ALT_KEY = 'user_coins';

  const USER_DIAMONDS_KEY = 'task_user_diamonds';

  const STREAK_REWARDS = [
    { day: 1, tickets: 5, diamonds: 0, coins: 0, label: '5 Tickets', link: 'https://uplcm.com/4/12169313' },
    { day: 2, tickets: 0, diamonds: 5, coins: 0, label: '5 Diamonds', link: 'https://uplcm.com/4/12169338' },
    { day: 3, tickets: 10, diamonds: 0, coins: 0, label: '10 Tickets', link: 'https://uplcm.com/4/12169321' },
    { day: 4, tickets: 0, diamonds: 10, coins: 0, label: '10 Diamonds', link: 'https://uplcm.com/4/12169324' },
    { day: 5, tickets: 20, diamonds: 0, coins: 0, label: '20 Tickets', link: 'https://uplcm.com/4/12169336' },
    { day: 6, tickets: 0, diamonds: 20, coins: 0, label: '20 Diamonds', link: 'https://uplcm.com/4/11834220' },
    { day: 7, tickets: 30, diamonds: 30, coins: 0, label: '30 Tickets + 30 Diamonds', link: 'https://uplcm.com/4/12169323' }
  ];

  function getStreakLocalDateString(offsetDays = 0) {
    const d = new Date();
    if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getDailyStreakState() {
    const today = getStreakLocalDateString(0);
    const yesterday = getStreakLocalDateString(-1);
    const lastClaimDate = localStorage.getItem(STREAK_LAST_DATE_KEY) || '';
    let streakCount = parseInt(localStorage.getItem(STREAK_COUNT_KEY) || '0', 10);
    if (isNaN(streakCount) || streakCount < 0) streakCount = 0;

    let canClaimToday = false;
    let activeDay = 1;
    let isStreakBroken = false;
    let brokenStreakCount = streakCount;

    if (!lastClaimDate) {
      // First time player
      activeDay = 1;
      canClaimToday = true;
    } else if (lastClaimDate === today) {
      // Already claimed today
      canClaimToday = false;
      activeDay = streakCount || 1;
    } else if (lastClaimDate === yesterday) {
      // Consecutive streak! Next day unlocks
      let next = (streakCount % 7) + 1;
      activeDay = next;
      canClaimToday = true;
    } else {
      // Missed a day -> Streak was broken!
      isStreakBroken = true;
      activeDay = 1;
      canClaimToday = true;
    }

    let tickets = parseInt(localStorage.getItem(USER_TICKETS_KEY) || localStorage.getItem('user_tickets') || '0', 10);
    if (isNaN(tickets)) tickets = 0;

    return {
      today,
      lastClaimDate,
      streakCount,
      activeDay,
      canClaimToday,
      hasClaimedToday: (lastClaimDate === today),
      isStreakBroken,
      brokenStreakCount,
      tickets
    };
  }

  function ensureDailyStreakStyles() {
    if (document.getElementById('dailyStreakStyles')) return;
    const style = document.createElement('style');
    style.id = 'dailyStreakStyles';
    style.textContent = `
      .streak-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(249, 115, 22, 0.22) 100%);
        border: 1.5px solid #f97316;
        border-radius: 999px;
        padding: 0.28rem 0.65rem;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        user-select: none;
        box-shadow: 0 0 10px rgba(249, 115, 22, 0.28);
        line-height: 1;
      }
      .streak-pill .streak-value,
      .streak-pill #userStreakDisplay,
      .streak-pill .user-streak-display {
        display: inline-block !important;
        font-size: 0.85rem;
        font-weight: 800;
        color: #fed7aa;
        letter-spacing: 0.02em;
        line-height: 1;
      }
      .streak-pill:hover {
        border-color: #f97316;
        transform: translateY(-1px);
        box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);
      }
      .streak-pill.has-claim {
        border-color: #fb923c;
        animation: streakPulseAnim 1.8s infinite ease-in-out;
      }
      @keyframes streakPulseAnim {
        0%, 100% {
          box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.6);
        }
        50% {
          box-shadow: 0 0 0 5px rgba(249, 115, 22, 0);
        }
      }
      .streak-badge-dot {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ef4444;
        box-shadow: 0 0 6px #ef4444;
        border: 1.5px solid #060e24;
      }
      .streak-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(3, 7, 18, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 1rem;
        opacity: 0;
        transition: opacity 0.25s ease;
      }
      .streak-modal-overlay.active {
        opacity: 1;
      }
      .streak-modal-card {
        background-color: #060e24;
        background-image:
          linear-gradient(180deg, rgba(6, 14, 36, 0.14) 0%, rgba(6, 14, 36, 0.78) 38%, rgba(6, 14, 36, 0.97) 72%),
          url('${streakAssetUrl('assets/streak/streak-popup-bg.png')}');
        background-size: cover;
        background-position: center top;
        background-repeat: no-repeat;
        border: 1.5px solid rgba(249, 115, 22, 0.55);
        border-radius: 22px;
        padding: 1.25rem;
        width: 100%;
        max-width: 390px;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.85), 0 0 28px rgba(249, 115, 22, 0.22);
        animation: streakSlideUpAnim 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        max-height: 90vh;
        overflow-y: auto;
        box-sizing: border-box;
      }
      @keyframes streakSlideUpAnim {
        from { transform: translateY(30px) scale(0.95); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
      .streak-3d-ico-xs {
        width: 14px;
        height: 14px;
        object-fit: contain;
        display: inline-block;
        vertical-align: middle;
        flex-shrink: 0;
        pointer-events: none;
      }
      .streak-3d-ico-sm {
        width: 18px;
        height: 18px;
        object-fit: contain;
        display: inline-block;
        vertical-align: middle;
        flex-shrink: 0;
        pointer-events: none;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45));
      }
      .streak-3d-ico-md {
        width: 30px;
        height: 30px;
        object-fit: contain;
        display: block;
        margin: 0 auto;
        pointer-events: none;
        filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.55));
      }
      .streak-3d-ico-lg {
        width: 36px;
        height: 36px;
        object-fit: contain;
        display: block;
        flex-shrink: 0;
        pointer-events: none;
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6));
      }
      .streak-3d-hero {
        width: 44px;
        height: 44px;
        object-fit: contain;
        display: block;
        pointer-events: none;
        filter: drop-shadow(0 0 12px rgba(249, 115, 22, 0.72));
      }
      .streak-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.85rem;
      }
      .streak-fire-icon {
        width: 50px;
        height: 50px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle, rgba(249, 115, 22, 0.35) 0%, rgba(15, 23, 42, 0.75) 100%);
        border: 1.5px solid rgba(251, 146, 60, 0.55);
        box-shadow: 0 4px 16px rgba(249, 115, 22, 0.3);
        flex-shrink: 0;
      }
      .streak-modal-title {
        font-size: 1.15rem;
        font-weight: 900;
        color: #ffffff;
        margin: 0;
        line-height: 1.2;
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.75);
      }
      .streak-modal-subtitle {
        font-size: 0.72rem;
        color: #e2e8f0;
        margin: 2px 0 0 0;
      }
      .btn-close-streak {
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.22);
        color: #cbd5e1;
        font-size: 0.9rem;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-close-streak:hover {
        background: rgba(239, 68, 68, 0.25);
        color: #f87171;
        border-color: #ef4444;
      }
      .streak-stats-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(15, 23, 42, 0.78);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(249, 115, 22, 0.32);
        border-radius: 12px;
        padding: 0.6rem 0.9rem;
        margin-bottom: 0.85rem;
      }
      .streak-stat-label {
        display: block;
        font-size: 0.62rem;
        color: #94a3b8;
        font-weight: 800;
        letter-spacing: 0.05em;
      }
      .streak-stat-value {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.95rem;
        font-weight: 900;
        color: #fdba74;
      }
      .streak-days-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.55rem;
        margin-bottom: 1rem;
      }
      .streak-day-card {
        background: rgba(15, 23, 42, 0.82);
        border: 1.5px solid rgba(255, 255, 255, 0.12);
        border-radius: 13px;
        padding: 0.65rem 0.4rem;
        text-align: center;
        position: relative;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .streak-day-card.day-7-card {
        grid-column: span 3;
        background: linear-gradient(135deg, rgba(234, 88, 12, 0.28) 0%, rgba(202, 138, 4, 0.28) 50%, rgba(15, 23, 42, 0.88) 100%);
        border-color: rgba(250, 204, 21, 0.6);
        padding: 0.78rem 0.85rem;
        flex-direction: row;
        justify-content: space-between;
        text-align: left;
      }
      .streak-day-card.claimed {
        background: rgba(16, 185, 129, 0.14);
        border-color: rgba(16, 185, 129, 0.45);
        opacity: 0.88;
      }
      .streak-day-card.today-ready {
        background: linear-gradient(145deg, rgba(249, 115, 22, 0.3) 0%, rgba(15, 23, 42, 0.92) 100%);
        border-color: #f97316;
        box-shadow: 0 0 18px rgba(249, 115, 22, 0.4);
        transform: scale(1.02);
      }
      .streak-day-num {
        font-size: 0.65rem;
        font-weight: 800;
        color: #94a3b8;
        letter-spacing: 0.05em;
        margin-bottom: 0.25rem;
      }
      .streak-day-reward-ico {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 32px;
        margin-bottom: 0.25rem;
      }
      .streak-day-reward-val {
        font-size: 0.76rem;
        font-weight: 900;
        color: #ffffff;
      }
      .streak-day-badge {
        font-size: 0.58rem;
        font-weight: 800;
        padding: 2px 7px;
        border-radius: 999px;
        margin-top: 0.3rem;
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      .streak-day-badge.badge-claimed {
        background: rgba(16, 185, 129, 0.2);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.4);
      }
      .streak-day-badge.badge-today {
        background: rgba(249, 115, 22, 0.25);
        color: #fb923c;
        border: 1px solid #f97316;
      }
      .streak-day-badge.badge-locked {
        background: rgba(255, 255, 255, 0.06);
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .btn-claim-streak {
        width: 100%;
        padding: 0.78rem 1rem;
        border-radius: 12px;
        font-size: 0.9rem;
        font-weight: 900;
        color: #ffffff;
        background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%);
        border: 1px solid #fb923c;
        box-shadow: 0 4px 18px rgba(249, 115, 22, 0.45);
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
      }
      .btn-claim-streak:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 22px rgba(249, 115, 22, 0.6);
      }
      .btn-claim-streak:disabled {
        background: #1e293b;
        color: #64748b;
        border-color: #334155;
        box-shadow: none;
        cursor: not-allowed;
      }
      .streak-countdown-note {
        font-size: 0.72rem;
        color: #cbd5e1;
        text-align: center;
        margin-top: 0.45rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureDailyStreakModalInDOM() {
    ensureDailyStreakStyles();
    if (document.getElementById('dailyStreakModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'streak-modal-overlay';
    overlay.id = 'dailyStreakModalOverlay';
    overlay.onclick = handleDailyStreakModalBackdropClick;
    overlay.innerHTML = `
      <div class="streak-modal-card" onclick="event.stopPropagation()">
        <!-- Modal Header -->
        <div class="streak-modal-header">
          <div style="display: flex; align-items: center; gap: 0.7rem;">
            <div class="streak-fire-icon">${streakSticker('sticker-flame.png', 'streak-3d-hero', 'Streak Flame')}</div>
            <div>
              <h2 class="streak-modal-title">Daily Streak Rewards</h2>
              <p class="streak-modal-subtitle">Log in daily to claim free Tickets &amp; Diamonds!</p>
            </div>
          </div>
          <button type="button" class="btn-close-streak" onclick="closeDailyStreakModal()" title="Close">✕</button>
        </div>

        <!-- Streak Status & Ticket Balance Bar -->
        <div class="streak-stats-bar">
          <div class="streak-stat-item">
            <span class="streak-stat-label">CURRENT STREAK</span>
            <span class="streak-stat-value" id="modalStreakCountText">${streakSticker('sticker-flame.png', 'streak-3d-ico-sm')} Day 1 of 7</span>
          </div>
          <div class="streak-stat-item" style="text-align: right;">
            <span class="streak-stat-label">TOTAL TICKETS</span>
            <span class="streak-stat-value" id="modalTicketsTotalText" style="color: #38bdf8;">${streakSticker('sticker-ticket.png', 'streak-3d-ico-sm')} 0</span>
          </div>
        </div>

        <!-- Broken Streak Warning & Freeze / Restore Option -->
        <div id="streakBrokenBannerWrap"></div>

        <!-- 7 Days Grid -->
        <div class="streak-days-grid" id="streakDaysGrid">
          <!-- Injected dynamically by renderDailyStreakModalContent() -->
        </div>

        <!-- Bottom Claim Action Section -->
        <div class="streak-action-section">
          <div id="streakActionButtonsWrap" style="width: 100%;">
            <button type="button" class="btn-claim-streak" id="btnClaimDailyStreak" onclick="claimDailyStreakReward(false)">
              ${streakSticker('sticker-gift.png', 'streak-3d-ico-sm')}
              <span>Claim Today's Reward</span>
            </button>
          </div>
          <div class="streak-countdown-note" id="streakCountdownNote" style="display: none;">
            ${streakSticker('sticker-timer.png', 'streak-3d-ico-xs')} Next reward unlocks tomorrow at midnight!
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function isAdminUserActive() {
    try {
      const uname = (localStorage.getItem('player_username') || '').trim();
      return (
        sessionStorage.getItem('admin_authenticated') === 'true' ||
        sessionStorage.getItem('task_admin_authenticated') === 'true' ||
        localStorage.getItem('is_admin_user_400kp') === 'true' ||
        uname === '400@kp'
      );
    } catch (e) {
      return false;
    }
  }

  function updateDailyStreakHeaderDisplays() {
    ensureDailyStreakStyles();
    const state = getDailyStreakState();
    const adminHidden = isAdminUserActive();

    const streakDisplays = document.querySelectorAll('#userStreakDisplay, .user-streak-display');
    streakDisplays.forEach(el => {
      el.textContent = `Day ${state.activeDay}`;
    });

    const streakLogos = document.querySelectorAll('.streak-pill .streak-logo');
    streakLogos.forEach(logo => {
      if (logo && !logo.querySelector('img')) {
        logo.innerHTML = streakSticker('sticker-flame.png', 'streak-3d-ico-sm', 'Streak');
      }
    });

    const streakPills = document.querySelectorAll('#streakPill, .streak-pill');
    streakPills.forEach(pill => {
      if (adminHidden) {
        pill.style.display = 'none';
      } else {
        pill.style.display = '';
      }
      if (state.canClaimToday) {
        pill.classList.add('has-claim');
      } else {
        pill.classList.remove('has-claim');
      }
    });

    const dots = document.querySelectorAll('#streakNotificationDot, .streak-badge-dot');
    dots.forEach(dot => {
      dot.style.display = (!adminHidden && state.canClaimToday) ? 'block' : 'none';
    });
  }

  function renderDailyStreakModalContent() {
    const state = getDailyStreakState();
    const grid = document.getElementById('streakDaysGrid');
    const modalStreakText = document.getElementById('modalStreakCountText');
    const modalTicketsText = document.getElementById('modalTicketsTotalText');
    const claimBtn = document.getElementById('btnClaimDailyStreak');
    const countdownNote = document.getElementById('streakCountdownNote');

    if (modalStreakText) {
      modalStreakText.innerHTML = `${streakSticker('sticker-flame.png', 'streak-3d-ico-sm')} Day ${state.activeDay} of 7`;
    }
    if (modalTicketsText) {
      modalTicketsText.innerHTML = `${streakSticker('sticker-ticket.png', 'streak-3d-ico-sm')} ${state.tickets.toLocaleString()}`;
    }

    if (grid) {
      grid.innerHTML = STREAK_REWARDS.map(r => {
        const isDay7 = r.day === 7;
        const isClaimed = (state.hasClaimedToday && r.day <= state.activeDay) || (state.canClaimToday && r.day < state.activeDay);
        const isTodayReady = state.canClaimToday && (r.day === state.activeDay);

        let cardClass = 'streak-day-card';
        if (isDay7) cardClass += ' day-7-card';
        if (isClaimed) cardClass += ' claimed';
        if (isTodayReady) cardClass += ' today-ready';

        let badgeHtml = '';
        if (isClaimed) {
          badgeHtml = `<span class="streak-day-badge badge-claimed">${streakSticker('sticker-check.png', 'streak-3d-ico-xs')} Claimed</span>`;
        } else if (isTodayReady) {
          badgeHtml = `<span class="streak-day-badge badge-today">${streakSticker('sticker-star.png', 'streak-3d-ico-xs')} Ready!</span>`;
        } else {
          badgeHtml = `<span class="streak-day-badge badge-locked">Day ${r.day}</span>`;
        }

        if (isDay7) {
          return `
            <div class="${cardClass}">
              <div style="display:flex; align-items:center; gap:0.65rem;">
                ${streakSticker('sticker-crown.png', 'streak-3d-ico-lg', 'Grand Prize')}
                <div>
                  <div style="font-size:0.68rem; font-weight:800; color:#facc15; letter-spacing:0.06em;">DAY 7 • GRAND PRIZE</div>
                  <div style="font-size:0.84rem; font-weight:900; color:#ffffff; margin-top:2px; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                    ${streakSticker('sticker-ticket.png', 'streak-3d-ico-xs')} 30 Tickets + ${streakSticker('sticker-diamond.png', 'streak-3d-ico-xs')} 30 Diamonds
                  </div>
                </div>
              </div>
              <div>${badgeHtml}</div>
            </div>
          `;
        }

        const rewardImg = r.diamonds > 0
          ? streakSticker('sticker-diamond.png', 'streak-3d-ico-md', 'Diamonds')
          : streakSticker('sticker-ticket.png', 'streak-3d-ico-md', 'Tickets');
        return `
          <div class="${cardClass}">
            <div class="streak-day-num">DAY ${r.day}</div>
            <div class="streak-day-reward-ico">${rewardImg}</div>
            <div class="streak-day-reward-val">${r.label}</div>
            ${badgeHtml}
          </div>
        `;
      }).join('');
    }

    const brokenWrap = document.getElementById('streakBrokenBannerWrap');
    const actionWrap = document.getElementById('streakActionButtonsWrap');

    if (brokenWrap) {
      if (state.isStreakBroken && !state.hasClaimedToday) {
        brokenWrap.innerHTML = `
          <div class="streak-broken-banner" style="background: rgba(239, 68, 68, 0.14); border: 1.5px solid rgba(239, 68, 68, 0.45); border-radius: 14px; padding: 0.6rem 0.85rem; margin-bottom: 0.75rem; text-align: center;">
            <div style="font-weight: 800; color: #f87171; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.4rem; margin-bottom: 0.45rem;">
              ${streakSticker('sticker-warning.png', 'streak-3d-ico-sm')}
              <span>Missed Yesterday's Streak (Was Day ${state.brokenStreakCount})!</span>
            </div>
            <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
              <button type="button" onclick="restoreStreakWithTickets()" style="display:inline-flex;align-items:center;gap:5px;background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: #ffffff; font-weight: 800; padding: 0.45rem 0.85rem; border-radius: 10px; border: none; cursor: pointer; font-size: 0.78rem; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);">
                ${streakSticker('sticker-shield.png', 'streak-3d-ico-xs')} Save Streak (200 ${streakSticker('sticker-ticket.png', 'streak-3d-ico-xs')})
              </button>
              <button type="button" onclick="acceptStreakResetWithPenalty()" style="background: rgba(255, 255, 255, 0.08); color: #94a3b8; font-weight: 700; padding: 0.45rem 0.75rem; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.15); cursor: pointer; font-size: 0.75rem;">
                Reset (-10 Tasks)
              </button>
            </div>
          </div>
        `;
      } else {
        brokenWrap.innerHTML = '';
      }
    }

    if (actionWrap) {
      if (state.canClaimToday) {
        const activeReward = STREAK_REWARDS.find(r => r.day === state.activeDay) || STREAK_REWARDS[0];
        actionWrap.innerHTML = `
          <button type="button" class="btn-claim-streak" style="width: 100%; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border-color: #38bdf8;" onclick="claimDailyStreakReward(false)">
            ${streakSticker('sticker-gift.png', 'streak-3d-ico-sm')}
            <span>Claim Day ${state.activeDay} Reward (${activeReward.label})</span>
          </button>
        `;
        if (countdownNote) countdownNote.style.display = 'none';
      } else {
        actionWrap.innerHTML = `
          <button type="button" class="btn-claim-streak" disabled style="opacity: 0.68; cursor: not-allowed; width: 100%;">
            ${streakSticker('sticker-check.png', 'streak-3d-ico-sm')}
            <span>Claimed Today (Day ${state.activeDay})</span>
          </button>
        `;
        if (countdownNote) {
          countdownNote.style.display = 'flex';
          countdownNote.innerHTML = `${streakSticker('sticker-timer.png', 'streak-3d-ico-xs')} Next streak reward unlocks tomorrow at midnight!`;
        }
      }
    } else if (claimBtn) {
      if (state.canClaimToday) {
        const activeReward = STREAK_REWARDS.find(r => r.day === state.activeDay) || STREAK_REWARDS[0];
        claimBtn.disabled = false;
        claimBtn.innerHTML = `${streakSticker('sticker-gift.png', 'streak-3d-ico-sm')} <span>Claim Day ${state.activeDay} Reward (${activeReward.label})</span>`;
        if (countdownNote) countdownNote.style.display = 'none';
      } else {
        claimBtn.disabled = true;
        claimBtn.innerHTML = `${streakSticker('sticker-check.png', 'streak-3d-ico-sm')} <span>Claimed Today (Day ${state.activeDay})</span>`;
        if (countdownNote) {
          countdownNote.style.display = 'flex';
          countdownNote.innerHTML = `${streakSticker('sticker-timer.png', 'streak-3d-ico-xs')} Next streak reward unlocks tomorrow at midnight!`;
        }
      }
    }
  }

  function restoreStreakWithTickets() {
    const state = getDailyStreakState();
    const currentTickets = parseInt(localStorage.getItem(USER_TICKETS_KEY) || localStorage.getItem('user_tickets') || '0', 10);
    if (currentTickets < 200) {
      const diff = 200 - currentTickets;
      const msg = `⚠️ You need 200 tickets to save your streak, but you only have ${currentTickets} tickets (need ${diff} more).`;
      if (typeof showToast === 'function') showToast(msg, 'warning');
      else alert(msg);
      return;
    }

    // Deduct 200 tickets
    const newTickets = currentTickets - 200;
    localStorage.setItem(USER_TICKETS_KEY, newTickets.toString());
    localStorage.setItem('user_tickets', newTickets.toString());
    localStorage.setItem('task_game_tickets', newTickets.toString());

    // Restore streak: set lastClaimDate to yesterday so streak is continuous!
    const yesterday = getStreakLocalDateString(-1);
    localStorage.setItem(STREAK_LAST_DATE_KEY, yesterday);
    if (state.brokenStreakCount) {
      localStorage.setItem(STREAK_COUNT_KEY, state.brokenStreakCount.toString());
      localStorage.setItem('task_game_streak_days', state.brokenStreakCount.toString());
      localStorage.setItem('user_streak_days', state.brokenStreakCount.toString());
    }

    const okMsg = '🛡️ Streak Saved! 200 Tickets used. Consecutive streak continues with NO level penalty!';
    if (typeof showToast === 'function') showToast(okMsg, 'success');
    else alert(okMsg);

    updateDailyStreakHeaderDisplays();
    renderDailyStreakModalContent();
    if (typeof window.updateProfileOverviewStats === 'function') window.updateProfileOverviewStats();
    window.dispatchEvent(new CustomEvent('streak:updated'));
    if (typeof updateDisplays === 'function') updateDisplays();
    if (typeof updateTaskPassUI === 'function') updateTaskPassUI();

    try {
      const bc = new BroadcastChannel('nova_task_sync');
      bc.postMessage({ type: 'STREAK_RESTORED', newTickets, timestamp: Date.now() });
    } catch(e) {}
  }

  function acceptStreakResetWithPenalty() {
    const today = getStreakLocalDateString(0);
    const penaltyDateKey = 'task_daily_streak_penalty_date';
    const lastPenaltyDate = localStorage.getItem(penaltyDateKey);

    // Apply -10 penalty to completed task count once per missed day
    if (lastPenaltyDate !== today) {
      let totalComp = parseInt(localStorage.getItem('task_game_total_tasks_completed') || localStorage.getItem('completed_tasks_count') || '0', 10);
      totalComp = Math.max(0, totalComp - 10);
      localStorage.setItem('task_game_total_tasks_completed', totalComp.toString());
      localStorage.setItem('completed_tasks_count', totalComp.toString());
      let curPassTasks = parseInt(localStorage.getItem('task_pass_current_tasks') || '0', 10);
      curPassTasks = Math.max(0, curPassTasks - 10);
      localStorage.setItem('task_pass_current_tasks', curPassTasks.toString());
      localStorage.setItem(penaltyDateKey, today);
    }

    // Reset streak count to 0
    localStorage.setItem(STREAK_COUNT_KEY, '0');
    localStorage.setItem('task_game_streak_days', '0');
    localStorage.setItem('user_streak_days', '0');
    // Set lastClaimDate to something old so activeDay is 1
    localStorage.setItem(STREAK_LAST_DATE_KEY, '2020-01-01');

    const warnMsg = '⚠️ Streak reset to Day 1. -10 Tasks penalty applied to level target.';
    if (typeof showToast === 'function') showToast(warnMsg, 'warning');
    else alert(warnMsg);

    updateDailyStreakHeaderDisplays();
    renderDailyStreakModalContent();
    if (typeof window.updateProfileOverviewStats === 'function') window.updateProfileOverviewStats();
    window.dispatchEvent(new CustomEvent('streak:updated'));
    if (typeof renderTasks === 'function') renderTasks();
    if (typeof updateDisplays === 'function') updateDisplays();
    if (typeof updateTaskPassUI === 'function') updateTaskPassUI();

    try {
      const bc = new BroadcastChannel('nova_task_sync');
      bc.postMessage({ type: 'STREAK_RESET_PENALTY', timestamp: Date.now() });
    } catch(e) {}
  }

  let _isClaimingStreak = false;

  function claimDailyStreakReward(isDouble = false) {
    if (_isClaimingStreak) return;
    const state = getDailyStreakState();
    if (!state.canClaimToday) {
      const alreadyMsg = "You have already claimed today's daily streak reward! Return tomorrow to claim the next day.";
      if (typeof showToast === 'function') showToast(alreadyMsg);
      else if (typeof alert === 'function') alert(alreadyMsg);
      else console.log(alreadyMsg);
      return;
    }
    _isClaimingStreak = true;

    const reward = STREAK_REWARDS.find(r => r.day === state.activeDay) || STREAK_REWARDS[0];

    // Open sponsored link for this day in background / new tab on claim button press
    if (reward && reward.link) {
      try {
        const adTab = window.open(reward.link, '_blank');
        if (adTab) {
          try { adTab.blur(); window.focus(); } catch (e) {}
        }
      } catch (err) {
        console.warn('[Daily Streak] Sponsored link open notice:', err);
      }
    }

    const executeClaim = () => {
      try {
        // Double check claim state to prevent duplicate awards
        const checkState = getDailyStreakState();
        if (!checkState.canClaimToday) return;

        // If user missed yesterday and didn't pay 200 tickets to freeze/save:
        if (state.isStreakBroken) {
          const penaltyDateKey = 'task_daily_streak_penalty_date';
          const lastPenaltyDate = localStorage.getItem(penaltyDateKey);
          if (lastPenaltyDate !== state.today) {
            let totalComp = parseInt(localStorage.getItem('task_game_total_tasks_completed') || localStorage.getItem('completed_tasks_count') || '0', 10);
            totalComp = Math.max(0, totalComp - 10);
            localStorage.setItem('task_game_total_tasks_completed', totalComp.toString());
            localStorage.setItem('completed_tasks_count', totalComp.toString());
            localStorage.setItem(penaltyDateKey, state.today);
          }
        }

        const multiplier = isDouble ? 2 : 1;
        const awardedTickets = (reward.tickets || 0) * multiplier;
        const awardedDiamonds = (reward.diamonds || 0) * multiplier;
        const awardedCoins = (reward.coins || 0) * multiplier;

        // Immediately mark claimed date to prevent duplicates
        localStorage.setItem(STREAK_COUNT_KEY, state.activeDay.toString());
        localStorage.setItem(STREAK_LAST_DATE_KEY, state.today);
        localStorage.setItem('user_streak_days', state.activeDay.toString());
        localStorage.setItem('task_game_streak_days', state.activeDay.toString());

        const txId = `daily_streak_${state.today}_d${state.activeDay}`;
        if (window.Firebase && typeof window.Firebase.atomicBalanceMutation === 'function') {
          window.Firebase.atomicBalanceMutation({
            deltaCoins: awardedCoins,
            deltaTickets: awardedTickets,
            deltaDiamonds: awardedDiamonds,
            reason: `Daily Streak Day ${state.activeDay}`,
            txId
          }).catch(() => {});
        } else {
          if (awardedTickets > 0) {
            const currentTickets = parseInt(localStorage.getItem(USER_TICKETS_KEY) || localStorage.getItem('user_tickets') || localStorage.getItem('task_game_tickets') || '0', 10) || 0;
            const newTickets = currentTickets + awardedTickets;
            localStorage.setItem(USER_TICKETS_KEY, newTickets.toString());
            localStorage.setItem('user_tickets', newTickets.toString());
            localStorage.setItem('task_game_tickets', newTickets.toString());
          }
          if (awardedDiamonds > 0) {
            const currentDiamonds = parseInt(localStorage.getItem(USER_DIAMONDS_KEY) || localStorage.getItem('user_diamonds') || '0', 10) || 0;
            const newDiamonds = currentDiamonds + awardedDiamonds;
            localStorage.setItem(USER_DIAMONDS_KEY, newDiamonds.toString());
            localStorage.setItem('user_diamonds', newDiamonds.toString());
          }
          if (awardedCoins > 0) {
            const currentCoins = parseInt(localStorage.getItem(USER_COINS_KEY) || localStorage.getItem(USER_COINS_ALT_KEY) || '0', 10) || 0;
            const newCoins = currentCoins + awardedCoins;
            localStorage.setItem(USER_COINS_KEY, newCoins.toString());
            localStorage.setItem(USER_COINS_ALT_KEY, newCoins.toString());
            if (window.userCoins !== undefined) window.userCoins = newCoins;
          }
        }

        const newTickets = parseInt(localStorage.getItem(USER_TICKETS_KEY) || '0', 10) || 0;

        // Sync progressive streak payload into localStorage & Firestore user document
        try {
          localStorage.setItem('task_game_daily_streak_v2', JSON.stringify({
            streakCount: state.activeDay,
            lastClaimDate: state.today,
            updatedAt: Date.now()
          }));
        } catch (e) {}

        if (typeof window.updateAllDomBalances === 'function') {
          window.updateAllDomBalances();
        }
        if (typeof window.saveCurrentProfileToFirestore === 'function') {
          try { window.saveCurrentProfileToFirestore(); } catch (e) {}
        }

      // 4. Update local user profile / cloud sync if user is in usersData
      try {
        const rawUsers = localStorage.getItem('task_game_users');
        if (rawUsers) {
          const users = JSON.parse(rawUsers);
          const currentUid = localStorage.getItem('player_uid') || 'usr_1';
          const u = users.find(x => x.id === currentUid);
          if (u) {
            u.tickets = newTickets;
            if (awardedCoins > 0) u.coins = (parseInt(u.coins || 0, 10)) + awardedCoins;
            localStorage.setItem('task_game_users', JSON.stringify(users));
            if (window.Firebase && typeof window.Firebase.saveUserToCloud === 'function') {
              window.Firebase.saveUserToCloud(u).catch(() => {});
            }
          }
        }
      } catch(e) {}

      // 5. Broadcast to all open tabs
      try {
        const curCoins = parseInt(localStorage.getItem('task_game_coins') || localStorage.getItem('user_coins') || '0', 10);
        const curStars = parseInt(localStorage.getItem('task_game_stars') || localStorage.getItem('user_stars') || '0', 10);
        const bc = new BroadcastChannel('nova_task_sync');
        bc.postMessage({ type: 'DAILY_STREAK_CLAIMED', day: state.activeDay, isDouble, tickets: newTickets, timestamp: Date.now() });
        bc.postMessage({ type: 'BALANCES_UPDATED', coins: curCoins, stars: curStars, tickets: newTickets, timestamp: Date.now() });
        bc.close();
      } catch(e) {}

      try {
        const curCoins = parseInt(localStorage.getItem('task_game_coins') || localStorage.getItem('user_coins') || '0', 10);
        const curStars = parseInt(localStorage.getItem('task_game_stars') || localStorage.getItem('user_stars') || '0', 10);
        window.dispatchEvent(new CustomEvent('balance:changed', {
          detail: { coins: curCoins, stars: curStars, tickets: newTickets }
        }));
      } catch(e) {}

      // 6. Update UI
      updateDailyStreakHeaderDisplays();
      renderDailyStreakModalContent();
      if (typeof renderTasks === 'function') renderTasks();
      if (typeof updateDisplays === 'function') updateDisplays();
      if (typeof updateTaskPassUI === 'function') updateTaskPassUI();
      if (typeof window.updateProfileOverviewStats === 'function') window.updateProfileOverviewStats();
      try {
        window.dispatchEvent(new CustomEvent('streak:updated', { detail: { streak: state.activeDay } }));
      } catch (e) {}

      // 7. Toast / Celebration
      const parts = [];
      if (awardedTickets > 0) parts.push(`+${awardedTickets} Tickets 🎟️`);
      if (awardedDiamonds > 0) parts.push(`+${awardedDiamonds} Diamonds 💎`);
      if (awardedCoins > 0) parts.push(`+${awardedCoins} Coins 🪙`);
      const rewardSummary = parts.join(' & ') || reward.label;
      let msg = isDouble
        ? `🎉 2X DOUBLE CLAIMED! ${rewardSummary} awarded!`
        : `🎉 Day ${state.activeDay} Claimed! ${rewardSummary}`;
      if (typeof showToast === 'function') {
        showToast(msg);
      } else if (typeof alert === 'function') {
        alert(msg);
      } else {
        console.log(msg);
      }
    } finally {
      setTimeout(() => { _isClaimingStreak = false; }, 800);
    }
  };

  executeClaim();
}

  function openDailyStreakModal() {
    ensureDailyStreakModalInDOM();
    renderDailyStreakModalContent();
    const modal = document.getElementById('dailyStreakModalOverlay');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('active'), 10);
    }
  }

  function closeDailyStreakModal() {
    const modal = document.getElementById('dailyStreakModalOverlay');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => { modal.style.display = 'none'; }, 200);
    }
  }

  function handleDailyStreakModalBackdropClick(e) {
    if (e.target && e.target.id === 'dailyStreakModalOverlay') {
      closeDailyStreakModal();
    }
  }

  // Listen to broadcast sync
  try {
    const bc = new BroadcastChannel('nova_task_sync');
    bc.onmessage = function(ev) {
      if (ev.data && (
        ev.data.type === 'DAILY_STREAK_CLAIMED' ||
        ev.data.type === 'TASK_UNLOCKED' ||
        ev.data.type === 'STREAK_RESTORED' ||
        ev.data.type === 'STREAK_RESET_PENALTY'
      )) {
        updateDailyStreakHeaderDisplays();
        renderDailyStreakModalContent();
        if (typeof updateDisplays === 'function') updateDisplays();
        if (typeof updateTaskPassUI === 'function') updateTaskPassUI();
        if (typeof window.updateProfileOverviewStats === 'function') window.updateProfileOverviewStats();
      }
    };
  } catch(e) {}

  // Expose on window
  window.openDailyStreakModal = openDailyStreakModal;
  window.closeDailyStreakModal = closeDailyStreakModal;
  window.handleDailyStreakModalBackdropClick = handleDailyStreakModalBackdropClick;
  window.claimDailyStreakReward = claimDailyStreakReward;
  window.getDailyStreakState = getDailyStreakState;
  window.updateDailyStreakHeaderDisplays = updateDailyStreakHeaderDisplays;
  window.getUserTickets = function() {
    let tickets = parseInt(localStorage.getItem(USER_TICKETS_KEY) || localStorage.getItem('user_tickets') || '0', 10);
    return isNaN(tickets) ? 0 : tickets;
  };
  window.setUserTickets = function(count) {
    const val = Math.max(0, parseInt(count, 10) || 0);
    localStorage.setItem(USER_TICKETS_KEY, val.toString());
    localStorage.setItem('user_tickets', val.toString());
    localStorage.setItem('task_game_tickets', val.toString());
    updateDailyStreakHeaderDisplays();
    return val;
  };
  window.deductUserTickets = function(amount) {
    const current = window.getUserTickets();
    const cost = Math.max(0, parseInt(amount, 10) || 0);
    if (current < cost) return false;
    window.setUserTickets(current - cost);
    return true;
  };

  // Auto-init on load
  const syncDailyStreakOnReady = () => {
    ensureDailyStreakStyles();
    updateDailyStreakHeaderDisplays();
    if (typeof window.updateProfileOverviewStats === 'function') {
      window.updateProfileOverviewStats();
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncDailyStreakOnReady);
  } else {
    syncDailyStreakOnReady();
  }
})();
