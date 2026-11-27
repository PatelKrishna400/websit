/**
 * help/script.js — Live Data-Driven Help & Support Controller
 * Pulls live category limits, VIP Star plans, Wallet milestones, Pass status,
 * player balances, and syncs support tickets with local history + Admin feedback desk.
 */

(function () {
  const INVITE_MILESTONES = [
    { friends: 1, stars: 10 },
    { friends: 5, stars: 20 },
    { friends: 10, stars: 50 },
    { friends: 25, stars: 120 },
    { friends: 50, stars: 300 }
  ];

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getAppSettingsSafe() {
    if (window.TapEmpireUtils && typeof window.TapEmpireUtils.getAppSettings === 'function') {
      return window.TapEmpireUtils.getAppSettings();
    }
    try {
      const raw = localStorage.getItem('task_game_app_settings_v1');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      categoryLimits: { common: 10, simple: 10, star: 10, pro: 3, ultra: 5, quiz: 30, diamond: 10, google: 10 },
      vipPlans: [
        { id: 'vip_500', title: 'VIP Starter', costStars: 500, dailyTasksLimit: 10, durationDays: 15, enabled: true },
        { id: 'vip_1000', title: 'VIP Popular', costStars: 1000, dailyTasksLimit: 15, durationDays: 30, enabled: true },
        { id: 'vip_5000', title: 'VIP Max Pass', costStars: 5000, dailyTasksLimit: 30, durationDays: 90, enabled: true }
      ],
      proGroup: { costAmount: 5000, costCurrency: 'coins', timerMinutes: 1440, dailyLimit: 3 },
      walletOffers: {
        oneTimeOffer: { enabled: true, title: '₹50 Amazon Shopping Voucher', giftAmountInr: 50, starCost: 1500, requiredUltraTasks: 3 },
        ultraMilestones: [
          { title: '₹1,000 Amazon Shopping Voucher', requiredUltraTasks: 20, starCost: 10000, enabled: true },
          { title: '₹5,000 Amazon Shopping Voucher', requiredUltraTasks: 80, starCost: 50000, enabled: true },
          { title: '₹10,000 Amazon Shopping Voucher', requiredUltraTasks: 140, starCost: 100000, enabled: true }
        ]
      }
    };
  }

  function updateHeaderBalances() {
    const coins = parseInt(localStorage.getItem('user_coins') || localStorage.getItem('task_game_coins') || '0', 10) || 0;
    const stars = parseInt(localStorage.getItem('user_stars') || localStorage.getItem('task_game_stars') || '0', 10) || 0;
    const tickets = parseInt(localStorage.getItem('user_tickets') || '0', 10) || 0;
    const passLvl = parseInt(localStorage.getItem('task_pass_level') || '0', 10) || 0;

    const topCoinEl = document.getElementById('helpBalanceTop');
    const topStarEl = document.getElementById('helpStarsTop');
    if (topCoinEl) topCoinEl.textContent = coins.toLocaleString();
    if (topStarEl) topStarEl.textContent = stars.toLocaleString();

    const snapCoins = document.getElementById('snapCoinsVal');
    const snapStars = document.getElementById('snapStarsVal');
    const snapTickets = document.getElementById('snapTicketsVal');
    const snapPass = document.getElementById('snapPassVal');
    if (snapCoins) snapCoins.textContent = `${coins.toLocaleString()} 🪙`;
    if (snapStars) snapStars.textContent = `${stars.toLocaleString()} ⭐`;
    if (snapTickets) snapTickets.textContent = `${tickets.toLocaleString()} 🎟️`;
    if (snapPass) snapPass.textContent = `${passLvl} / 500`;
  }

  function renderLiveHelpData() {
    const settings = getAppSettingsSafe();
    const limits = settings.categoryLimits || {};

    // 1. Task Categories Grid
    const catEl = document.getElementById('helpTaskCategoriesData');
    if (catEl) {
      const cats = [
        { icon: '🎟️', name: 'Common Tasks', reward: 'Earn Tickets', limit: limits.common || 10, color: '#38bdf8' },
        { icon: '🪙', name: 'Coin Tasks', reward: 'Unlock & Win Coins', limit: limits.simple || 10, color: '#fbbf24' },
        { icon: '⭐', name: 'Star VIP Tasks', reward: 'VIP Plan Rewards', limit: limits.star || 10, color: '#facc15' },
        { icon: '💎', name: 'Pro Pack', reward: `${Number((settings.proGroup || {}).costAmount || 5000).toLocaleString()} ${(settings.proGroup || {}).costCurrency || 'coins'}`, limit: limits.pro || 3, color: '#c084fc' },
        { icon: '🚀', name: 'Ultra Tasks', reward: 'INR + Ultra Credits', limit: limits.ultra || 5, color: '#f43f5e' },
        { icon: '⚡', name: 'Quiz Tasks', reward: 'Fast Timed Quiz', limit: limits.quiz || 30, color: '#34d399' },
        { icon: '💎', name: 'Diamond Tasks', reward: 'Earn 💎 Diamonds', limit: limits.diamond || 10, color: '#22d3ee' },
        { icon: '📝', name: 'Google Form Tasks', reward: 'Form + Code → 💎 Diamonds', limit: limits.google || 10, color: '#818cf8' }
      ];
      catEl.innerHTML = cats.map((c) => `
        <div class="help-data-chip" style="border-color:${c.color}40;">
          <div class="help-chip-top"><span>${c.icon} ${escapeHtml(c.name)}</span><b style="color:${c.color};">${c.limit}/day</b></div>
          <div class="help-chip-sub">${escapeHtml(c.reward)}</div>
        </div>
      `).join('');
    }

    // 2. VIP Plans (3 Tiers)
    const vipEl = document.getElementById('helpVipPlansData');
    if (vipEl) {
      const plans = Array.isArray(settings.vipPlans) ? settings.vipPlans : [];
      vipEl.innerHTML = plans.map((p) => `
        <div class="help-data-row">
          <div>
            <b style="color:#fde047;">👑 ${escapeHtml(p.title || 'VIP Plan')}</b>
            <span class="help-row-meta">${Number(p.dailyTasksLimit || 10)} Star Tasks/day • ${Number(p.durationDays || 15)} Days</span>
          </div>
          <span class="help-row-pill">${Number(p.costStars || 500).toLocaleString()} ⭐</span>
        </div>
      `).join('');
    }

    // 3. Invite Friends Star Milestones
    const invEl = document.getElementById('helpInviteMilestonesData');
    if (invEl) {
      let claimed = {};
      try {
        claimed = JSON.parse(localStorage.getItem('referral_star_milestones_claimed') || '{}') || {};
      } catch (e) {}
      invEl.innerHTML = INVITE_MILESTONES.map((m) => {
        const key = `ref_ms_${m.friends}`;
        const done = !!claimed[key];
        return `
          <div class="help-ms-pill ${done ? 'done' : ''}">
            <span>${done ? '✅' : '👥'} ${m.friends} Friend${m.friends === 1 ? '' : 's'}</span>
            <b>+${m.stars} ⭐</b>
          </div>
        `;
      }).join('');
    }

    // 4. Pass & Wallet Rules
    const pwEl = document.getElementById('helpPassWalletData');
    if (pwEl) {
      const wOffers = settings.walletOffers || {};
      const oto = wOffers.oneTimeOffer || {};
      const milestones = Array.isArray(wOffers.ultraMilestones) ? wOffers.ultraMilestones.filter(m => m.enabled !== false) : [];
      const rows = [
        `<div class="help-data-row"><div><b style="color:#38bdf8;">🎫 Battle Pass (Fixed Track)</b><span class="help-row-meta">500 Levels • 1 Task Completed = 1 Level Up</span></div><span class="help-row-pill">3,000 ⭐</span></div>`
      ];
      if (oto.enabled !== false) {
        rows.push(`<div class="help-data-row"><div><b style="color:#fb7185;">⏱️ ${escapeHtml(oto.title || '₹50 Amazon Voucher')}</b><span class="help-row-meta">Needs ${Number(oto.requiredUltraTasks || 3)} Ultra Credits + ${Number(oto.starCost || 1500).toLocaleString()} ⭐</span></div><span class="help-row-pill">₹${Number(oto.giftAmountInr || 50)}</span></div>`);
      }
      milestones.forEach((m) => {
        rows.push(`<div class="help-data-row"><div><b style="color:#34d399;">🎁 ${escapeHtml(m.title || 'Amazon Gift Card')}</b><span class="help-row-meta">${Number(m.requiredUltraTasks || 20)} Ultra Credits + ${Number(m.starCost || 0).toLocaleString()} ⭐</span></div><span class="help-row-pill">₹${Number(m.giftAmountInr || 500).toLocaleString()}</span></div>`);
      });
      rows.push(`<div class="help-data-row"><div><b style="color:#4ade80;">✅ Approved Payout Voucher</b><span class="help-row-meta">Instant status &amp; Amazon Gift Card (₹500) approval tracking</span></div><span class="help-row-pill">Wallet</span></div>`);
      pwEl.innerHTML = rows.join('');
    }
  }

  function renderUserTickets() {
    const listEl = document.getElementById('userTicketsList');
    const wrapEl = document.getElementById('userTicketsWrap');
    if (!listEl || !wrapEl) return;

    try {
      const raw = localStorage.getItem('user_support_tickets');
      const tickets = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(tickets) || tickets.length === 0) {
        wrapEl.style.display = 'none';
        return;
      }

      wrapEl.style.display = 'block';
      listEl.innerHTML = tickets.slice(-5).reverse().map((ticket) => `
        <div class="ticket-item-card" style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 10px; padding: 0.65rem 0.8rem; margin-bottom: 0.45rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
            <span style="font-weight: 800; color: #38bdf8; font-size: 0.8rem; letter-spacing: 0.5px;">Ticket #${escapeHtml(ticket.id || 'NV-0000')}</span>
            <span style="background: rgba(234, 179, 8, 0.15); color: #facc15; font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 999px;">${escapeHtml(ticket.status || 'Pending Review')}</span>
          </div>
          <div style="font-size: 0.76rem; color: #cbd5e1; word-break: break-word; line-height: 1.35;">${escapeHtml(ticket.message || '')}</div>
          <div style="font-size: 0.65rem; color: #64748b; margin-top: 0.25rem;">Submitted on: ${escapeHtml(ticket.date || new Date().toLocaleDateString())}</div>
        </div>
      `).join('');
    } catch (err) {
      console.warn('Error rendering user tickets:', err);
    }
  }

  window.handleTicketSubmit = function (event) {
    event.preventDefault();
    const textarea = document.getElementById('helpTicketMessage');
    const statusMsg = document.getElementById('helpTicketStatusMsg');
    const submitBtn = document.getElementById('btnSubmitTicket');

    if (!textarea || !statusMsg) return;
    const msg = textarea.value.trim();

    if (!msg) {
      statusMsg.style.display = 'block';
      statusMsg.className = 'ticket-status-msg error';
      statusMsg.textContent = 'Please enter a valid message before submitting.';
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>⏳ Sending Ticket...</span>';
    }

    const ticketId = 'NV-' + Math.floor(1000 + Math.random() * 9000);
    const playerName = localStorage.getItem('user_name') || localStorage.getItem('player_name') || 'Player';
    const newTicket = {
      id: ticketId,
      message: msg,
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Open / Sent to Admin'
    };

    try {
      const raw = localStorage.getItem('user_support_tickets');
      const tickets = raw ? JSON.parse(raw) : [];
      tickets.push(newTicket);
      localStorage.setItem('user_support_tickets', JSON.stringify(tickets));

      // Mirror to Admin Feedback inbox so Admin sees user support tickets
      const rawFb = localStorage.getItem('task_game_feedbacks');
      const fbs = rawFb ? JSON.parse(rawFb) : [];
      fbs.unshift({
        id: 'fb_' + ticketId,
        userName: playerName,
        category: 'Support Ticket #' + ticketId,
        message: msg,
        timestamp: Date.now(),
        dateStr: newTicket.date,
        status: 'new'
      });
      localStorage.setItem('task_game_feedbacks', JSON.stringify(fbs));

      if (window.Firebase && typeof window.Firebase.saveFeedbackToCloud === 'function') {
        window.Firebase.saveFeedbackToCloud({
          id: 'fb_' + ticketId,
          name: playerName,
          userName: playerName,
          avatar: localStorage.getItem('player_avatar') || 'avatar-7.png',
          rating: 5,
          category: 'Support Ticket #' + ticketId,
          message: msg,
          date: new Date().toISOString()
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Failed saving ticket:', err);
    }

    setTimeout(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🚀 Send Support Ticket</span>';
      }
      textarea.value = '';
      statusMsg.style.display = 'block';
      statusMsg.className = 'ticket-status-msg success';
      statusMsg.textContent = `Ticket #${ticketId} sent to Admin Support! We will review it shortly.`;

      renderUserTickets();

      setTimeout(() => {
        statusMsg.style.display = 'none';
      }, 5000);
    }, 350);
  };

  document.addEventListener('DOMContentLoaded', function () {
    updateHeaderBalances();
    renderLiveHelpData();
    renderUserTickets();

    window.addEventListener('settings:changed', renderLiveHelpData);
    window.addEventListener('profile:cloudSynced', renderUserTickets);

    try {
      const channel = new BroadcastChannel('nova_task_sync');
      channel.onmessage = function () {
        updateHeaderBalances();
        renderLiveHelpData();
      };
    } catch (e) {}

    window.addEventListener('storage', function () {
      updateHeaderBalances();
      renderLiveHelpData();
    });
  });
})();
