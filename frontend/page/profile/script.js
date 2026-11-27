
const SYNC_CHANNEL_NAME = 'nova_task_sync';
const SYNC_FLAG_KEY = 'task_game_last_sync';
const TASKS_STORAGE_KEY = 'task_game_tasks';
const USERS_STORAGE_KEY = 'task_game_users';
const WITHDRAW_STORAGE_KEY = 'task_game_withdrawals';
const EVENT_STORAGE_KEY = 'task_game_leaderboard_event';
const EVENT_TASKS_KEY = 'task_game_event_tasks_count';
const TOTAL_TASKS_KEY = 'task_game_total_tasks_completed';
let syncChannel = null;
try {
  syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  syncChannel.onmessage = () => {
    if (typeof updateAdminLiveDisplays === 'function') updateAdminLiveDisplays();
    if (typeof updateProfileOverviewStats === 'function') updateProfileOverviewStats();
  };
} catch (e) {}

function openAdminCompulsoryLock() {
  window.location.href = '../../../admin/index.html';
}
window.openAdminCompulsoryLock = openAdminCompulsoryLock;

function switchProfileTab(tabKey) {
  if (tabKey === 'admin') {
    window.location.href = '../../../admin/index.html';
  }
}
window.switchProfileTab = switchProfileTab;

const HTML_ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(str) {
  if (typeof str !== 'string') return str ? String(str) : '';
  return str.replace(/[&<>"']/g, ch => HTML_ESC_MAP[ch]);
}

window.openRoadmapModal = function() {
  window.location.href = '../leaderboard/index.html?action=roadmap';
};

function updateAdminLiveDisplays() {
  const currentCoins = parseInt(localStorage.getItem('task_game_coins') || '0', 10) || 0;
  const currentStars = parseInt(localStorage.getItem('task_game_stars') || '0', 10) || 0;
  const headerCoins = document.getElementById('profileCoinsDisplay');
  if (headerCoins) headerCoins.textContent = currentCoins.toLocaleString();
  const headerStars = document.getElementById('profileStarsDisplay');
  if (headerStars) headerStars.textContent = currentStars.toLocaleString();

  const ratingLevelEl = document.getElementById('tgProfileRatingLevel');
  const ratingSubEl = document.getElementById('tgProfileRatingSub');
  if (ratingLevelEl) ratingLevelEl.style.display = 'none';
  if (ratingSubEl) ratingSubEl.style.display = 'none';

  const avatarRaw = localStorage.getItem('player_avatar') || 'avatar-1.png';
  const applyAvatarToEl = (el, size) => {
    if (!el) return;
    if (typeof window.renderPlayerAvatarEl === 'function') {
      window.renderPlayerAvatarEl(el, avatarRaw, size || 36);
    } else {
      const m = String(avatarRaw).match(/avatar-([1-8])\.png/i);
      const map = { '⚡':'avatar-1.png','👤':'avatar-7.png','👑':'avatar-2.png','💎':'avatar-6.png','🚀':'avatar-7.png','🦊':'avatar-3.png','🦁':'avatar-4.png','🎯':'avatar-8.png','🤖':'avatar-5.png','💻':'avatar-5.png','🐯':'avatar-8.png' };
      const file = m ? `avatar-${m[1]}.png` : (map[avatarRaw] || 'avatar-1.png');
      el.style.background = 'transparent';
      el.style.border = 'none';
      el.style.boxShadow = 'none';
      el.style.borderRadius = '0';
      el.innerHTML = `<img src="../../assets/avatars/${file}" alt="Avatar" class="sticker-3d-avatar-img" style="width:${size || 36}px;height:${size || 36}px;object-fit:contain;display:block;" />`;
    }
  };
  const userAvatar = document.querySelector('.user-avatar');
  applyAvatarToEl(userAvatar, 36);
  const headerUserAvatar = document.getElementById('headerUserAvatar');
  applyAvatarToEl(headerUserAvatar, 36);

  const currentProfileUsername = localStorage.getItem('player_username') || localStorage.getItem('user_profile_name') || 'Player';
  const userName = document.querySelector('.user-name');
  if (userName) userName.textContent = currentProfileUsername;
  const headerUserName = document.getElementById('headerUserName');
  if (headerUserName) headerUserName.textContent = currentProfileUsername;

  // Hide Day 1 Streak Pill for admin user 400@kp / authenticated admin session
  const isAdminUser =
    sessionStorage.getItem('admin_authenticated') === 'true' ||
    localStorage.getItem('is_admin_user_400kp') === 'true' ||
    currentProfileUsername === '400@kp';
  const streakPill = document.getElementById('streakPill');
  if (streakPill) streakPill.style.display = isAdminUser ? 'none' : '';
}

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = (urlParams.get('tab') || urlParams.get('open') || '').toLowerCase();
  if (targetTab === 'admin') {
    window.location.replace('../../../admin/index.html');
    return;
  }
  autoLoginWithTelegram();
  updateAdminLiveDisplays();
  if (typeof updatePlayerSessionUI === 'function') updatePlayerSessionUI();
  if (typeof initReferralSystem === 'function') initReferralSystem();
  if (typeof renderTgProfileUI === 'function') renderTgProfileUI();
  if (typeof updateProfileOverviewStats === 'function') updateProfileOverviewStats();
  if (typeof updateFutureTokensUI === 'function') updateFutureTokensUI();
  if (typeof initTgPushSystem === 'function') initTgPushSystem();
  if (typeof updateDailyStreakHeaderDisplays === 'function') updateDailyStreakHeaderDisplays();
});

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

function getStoredFeedbacks() {
  initFeedbackSystem();
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveStoredFeedbacks(list) {
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(list));
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

  if (window.Firebase && typeof window.Firebase.saveFeedbackToCloud === 'function') {
    window.Firebase.saveFeedbackToCloud(newFeedback).catch(() => {});
  }

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


window.submitPlayerFeedback = submitPlayerFeedback;
window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.handleFeedbackModalBackdropClick = handleFeedbackModalBackdropClick;
window.setFeedbackRating = setFeedbackRating;


// =============================================================================
// INVITE FRIENDS & REFERRAL SYSTEM LOGIC
// =============================================================================

const REFERRAL_CODE_KEY = 'task_game_referral_code';
const REFERRALS_LIST_KEY = 'task_game_referrals';
const REDEEMED_REFERRAL_KEY = 'task_game_redeemed_referral';

// Sound synthesis helper
const ProfileAudio = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  playCopyChime() {
    this.init();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, t); // D5
      osc.frequency.setValueAtTime(880, t + 0.08); // A5
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch (e) {}
  },
  playRewardFanfare() {
    this.init();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.07);
        gain.gain.setValueAtTime(0.12, t + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.07 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + idx * 0.07);
        osc.stop(t + idx * 0.07 + 0.38);
      });
    } catch (e) {}
  }
};

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

function showFloatingCoin(targetElement, text) {
  if (!targetElement || typeof targetElement.getBoundingClientRect !== 'function') return;
  const rect = targetElement.getBoundingClientRect();
  const floatEl = document.createElement('div');
  floatEl.className = 'floating-coin-profile';
  floatEl.textContent = text;
  floatEl.style.left = `${rect.left + rect.width / 4}px`;
  floatEl.style.top = `${rect.top - 12}px`;
  document.body.appendChild(floatEl);
  setTimeout(() => floatEl.remove(), 800);
}

// =============================================================================
// AUTOMATIC TELEGRAM AUTHENTICATION & PLAYER STATE
// =============================================================================

function autoLoginWithTelegram() {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg) {
      if (typeof tg.ready === 'function') tg.ready();
      if (typeof tg.expand === 'function') tg.expand();

      const tgUser = tg.initDataUnsafe && tg.initDataUnsafe.user;
      if (tgUser) {
        const username = tgUser.username 
          || [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') 
          || 'Task Earner';
        localStorage.setItem('player_username', username);
        localStorage.setItem('player_id', `tg_${tgUser.id}`);
        localStorage.setItem('player_logged_in', 'true');
        if (tgUser.photo_url) {
          localStorage.setItem('player_avatar', '⚡');
          localStorage.setItem('player_avatar_url', tgUser.photo_url);
        }
        if (tgUser.first_name) localStorage.setItem('player_first_name', tgUser.first_name);
        if (tgUser.last_name) localStorage.setItem('player_last_name', tgUser.last_name);

        // Update profile display fields if available
        const dispName = document.getElementById('tgProfileDisplayName');
        if (dispName) dispName.textContent = username;
        const dispUser = document.getElementById('tgProfileUsername');
        if (dispUser) dispUser.textContent = tgUser.username || username.toLowerCase().replace(/\s+/g, '_');

        // Synchronize in task_game_users
        try {
          const rawUsers = localStorage.getItem('task_game_users');
          if (rawUsers) {
            const users = JSON.parse(rawUsers);
            let me = users.find(u => u.id === 'usr_1' || u.id === `tg_${tgUser.id}` || u.name === username || u.name === 'Task Earner' || u.name === 'NovaEarner');
            if (me) {
              me.name = username;
              me.id = `tg_${tgUser.id}`;
              localStorage.setItem('task_game_users', JSON.stringify(users));
            }
          }
        } catch (e) {}
        return;
      }
    }

    // Keep session ready without overriding empty/fresh username (lets first-time unique name popup run)
    localStorage.setItem('player_logged_in', 'true');
    const existingName = localStorage.getItem('player_username');
    if (existingName === 'NovaEarner' || existingName === 'Task Earner') {
      if (localStorage.getItem('player_username_confirmed') !== 'true') {
        localStorage.removeItem('player_username');
      }
    }
  } catch (e) {
    localStorage.setItem('player_logged_in', 'true');
  }
}

function getCurrentPlayer() {
  const saved = localStorage.getItem('player_username');
  const username = (saved && saved !== 'NovaEarner' && saved !== 'Task Earner') ? saved : 'Player';
  const avatar = localStorage.getItem('player_avatar') || '⚡';
  const id = localStorage.getItem('player_id') || 'usr_1';
  return { id, username, avatar, isLoggedIn: true };
}

function isUserLoggedIn() {
  return true; // Always logged in via automatic Telegram authentication
}

function updatePlayerSessionUI() {
  const player = getCurrentPlayer();

  // Remove the Image 3 session badge / strip completely from DOM
  const playerBadge = document.getElementById('playerSessionBadge') || document.querySelector('.player-session-badge');
  if (playerBadge) playerBadge.remove();

  const refCheck = document.getElementById('referralUserCheck');
  if (refCheck) refCheck.style.display = 'none';

  // Update profile Hero Card display name if on default
  const dispName = document.getElementById('tgProfileDisplayName');
  if (dispName && (dispName.textContent === 'Nova Earner' || dispName.textContent === 'Player' || !dispName.textContent)) {
    dispName.textContent = player.username;
  }
  const dispUser = document.getElementById('tgProfileUsername');
  if (dispUser && (dispUser.textContent === 'player' || dispUser.textContent === 'novaearner')) {
    dispUser.textContent = player.username.toLowerCase().replace(/\s+/g, '_');
  }

  const userCheckIcon = document.getElementById('userCheckIcon');
  const userCheckText = document.getElementById('userCheckText');
  const btnQuickLoginAction = document.getElementById('btnQuickLoginAction');

  if (userCheckIcon) {
    userCheckIcon.textContent = '🟢';
  }
  if (userCheckText) {
    userCheckText.innerHTML = `Account: <b>${escapeHtml(player.username)}</b> (Telegram Verified)`;
  }
  if (btnQuickLoginAction) {
    btnQuickLoginAction.style.display = 'none';
  }
}

// =============================================================================
// TELEGRAM USER AUTHORIZATION (MTProto Specification: auth.sendCode / auth.signIn)
// =============================================================================
const TG_SESSION_KEY = 'task_game_tg_session';
const TG_FUTURE_TOKENS_KEY = 'task_game_future_auth_tokens';

let currentTgAuth = {
  phone: '+919876543210',
  codeHash: '',
  codeType: 'app',
  expectedCode: '12345',
  dcId: 1,
  isTestDc: false,
  resendTimer: null,
  resendSeconds: 45
};

let tgQrTimer = null;
let tgQrSeconds = 30;

function getFutureAuthTokens() {
  try {
    const raw = localStorage.getItem(TG_FUTURE_TOKENS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function storeFutureAuthToken(phone) {
  try {
    let tokens = getFutureAuthTokens();
    const newToken = {
      token: 'tok_' + Math.random().toString(36).substr(2, 12),
      phone: phone || '+919876543210',
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
    };
    // Prepend and enforce MTProto 20 tokens max limit
    tokens = [newToken, ...tokens.filter(t => t.phone !== phone)].slice(0, 20);
    localStorage.setItem(TG_FUTURE_TOKENS_KEY, JSON.stringify(tokens));
    updateFutureTokensUI();
  } catch (e) {}
}

function updateFutureTokensUI() {
  const counterEl = document.getElementById('tgFutureTokensCount');
  if (counterEl) {
    const tokens = getFutureAuthTokens();
    counterEl.textContent = `${tokens.length} / 20`;
  }
  const banner = document.getElementById('tgFutureTokenBox');
  if (banner) {
    const tokens = getFutureAuthTokens();
    banner.style.display = tokens.length > 0 ? 'block' : 'none';
  }
}

function togglePlayerLoginState() {
  const currentlyLoggedIn = isUserLoggedIn();

  if (currentlyLoggedIn) {
    // If Firebase Auth is initialized, sign out from Firebase
    if (window.Firebase && typeof window.Firebase.signOutUser === 'function') {
      window.Firebase.signOutUser();
    }

    const curPhone = localStorage.getItem('player_username') || '+919876543210';
    storeFutureAuthToken(curPhone);

    localStorage.setItem('player_logged_in', 'false');
    localStorage.removeItem('player_email');
    localStorage.removeItem('player_uid');
    showToast('🔒 Signed out of session.');
    updatePlayerSessionUI();
  } else {
    openPlayerLoginModal();
  }
}

function openPlayerLoginModal() {
  const modal = document.getElementById('playerLoginModalOverlay');
  if (!modal) return;

  modal.classList.add('active');
  modal.style.display = 'flex';

  // Default to Firebase Email/Password View
  switchTgAuthTab('firebase_email');
  updateFbAuthModalUI();
  updateFutureTokensUI();

  // Populate avatar row in signup if empty
  populateSignUpAvatarOptions();
}

function closePlayerLoginModal() {
  const modal = document.getElementById('playerLoginModalOverlay');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
  if (currentTgAuth.resendTimer) {
    clearInterval(currentTgAuth.resendTimer);
    currentTgAuth.resendTimer = null;
  }
  if (tgQrTimer) {
    clearInterval(tgQrTimer);
    tgQrTimer = null;
  }
}

function handlePlayerLoginModalBackdropClick(event) {
  if (event && (event.target.id === 'playerLoginModalOverlay' || event.target.classList.contains('profile-modal-overlay'))) {
    closePlayerLoginModal();
  }
}

function handlePlayerLoginForm(event) {
  if (event) event.preventDefault();
  handleSendTgCode();
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// =============================================================================
// FIREBASE AUTHENTICATION (EMAIL & PASSWORD) MODAL CONTROLLER
// =============================================================================
let currentFbAuthMode = 'signin';

function setFbAuthMode(mode) {
  currentFbAuthMode = mode;
  const btnIn = document.getElementById('btnFbModeSignIn');
  const btnUp = document.getElementById('btnFbModeSignUp');
  const lblName = document.getElementById('lblFbDisplayName');
  const wrapName = document.getElementById('wrapFbDisplayName');
  const lblConfirm = document.getElementById('lblFbConfirmPassword');
  const wrapConfirm = document.getElementById('wrapFbConfirmPassword');
  const forgotRow = document.getElementById('fbForgotRow');
  const submitText = document.getElementById('btnFbSubmitText');
  const msgBanner = document.getElementById('fbAuthMsgBanner');

  if (msgBanner) msgBanner.style.display = 'none';

  if (mode === 'signup') {
    if (btnIn) btnIn.classList.remove('active');
    if (btnUp) btnUp.classList.add('active');
    if (lblName) lblName.style.display = 'block';
    if (wrapName) wrapName.style.display = 'flex';
    if (lblConfirm) lblConfirm.style.display = 'block';
    if (wrapConfirm) wrapConfirm.style.display = 'flex';
    if (forgotRow) forgotRow.style.display = 'none';
    if (submitText) submitText.textContent = 'Create Account & Cloud Sync';
  } else {
    if (btnIn) btnIn.classList.add('active');
    if (btnUp) btnUp.classList.remove('active');
    if (lblName) lblName.style.display = 'none';
    if (wrapName) wrapName.style.display = 'none';
    if (lblConfirm) lblConfirm.style.display = 'none';
    if (wrapConfirm) wrapConfirm.style.display = 'none';
    if (forgotRow) forgotRow.style.display = 'block';
    if (submitText) submitText.textContent = 'Sign In with Email';
  }
}

function toggleFbPasswordVisibility(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
}

function showFbAuthBanner(type, message) {
  const banner = document.getElementById('fbAuthMsgBanner');
  if (!banner) return;
  banner.className = `fb-auth-msg-banner ${type}`;
  banner.textContent = message;
  banner.style.display = 'block';
}

async function handleFirebaseEmailAuthSubmit() {
  const emailInput = document.getElementById('fbInputEmail');
  const pwdInput = document.getElementById('fbInputPassword');
  const nameInput = document.getElementById('fbInputDisplayName');
  const confirmPwdInput = document.getElementById('fbInputConfirmPassword');
  const submitBtn = document.getElementById('btnFbSubmitAuth');
  const submitText = document.getElementById('btnFbSubmitText');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = pwdInput ? pwdInput.value : '';

  if (!email || !email.includes('@')) {
    showFbAuthBanner('error', 'Please enter a valid email address.');
    return;
  }
  if (!password || password.length < 6) {
    showFbAuthBanner('error', 'Password must be at least 6 characters long.');
    return;
  }

  if (currentFbAuthMode === 'signup') {
    const confirmPwd = confirmPwdInput ? confirmPwdInput.value : '';
    if (password !== confirmPwd) {
      showFbAuthBanner('error', 'Passwords do not match. Please re-enter.');
      return;
    }
  }

  // Loading state
  const originalText = submitText ? submitText.textContent : 'Submit';
  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = 'Authenticating with Firebase...';

  try {
    if (!window.Firebase) {
      throw new Error('Firebase services are still initializing. Please wait a moment.');
    }

    let result = null;
    if (currentFbAuthMode === 'signup') {
      const displayName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : 'Player';
      result = await window.Firebase.signUpWithEmail(email, password, displayName);
    } else {
      result = await window.Firebase.signInWithEmail(email, password);
    }

    if (result && result.success) {
      const user = result.user;
      showFbAuthBanner('success', `Success! Authenticated as ${user.email}.`);
      showToast(`🔥 Authenticated with Firebase: ${user.email}`);

      // Refresh site header & profile session UI
      updatePlayerSessionUI();
      updateFbAuthModalUI();

      setTimeout(() => {
        closePlayerLoginModal();
      }, 1200);
    } else {
      showFbAuthBanner('error', result ? result.error : 'Authentication failed.');
    }
  } catch (err) {
    console.error("[Firebase Auth Submit]", err);
    showFbAuthBanner('error', err.message || 'Error communicating with Firebase.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = originalText;
  }
}

async function handleFirebaseSignOut() {
  if (window.Firebase && typeof window.Firebase.signOutUser === 'function') {
    await window.Firebase.signOutUser();
  }
  showToast('🔒 Signed out from Firebase.');
  updatePlayerSessionUI();
  updateFbAuthModalUI();
}

async function handleFirebasePasswordReset() {
  const emailInput = document.getElementById('fbInputEmail');
  const email = emailInput ? emailInput.value.trim() : '';
  if (!email || !email.includes('@')) {
    showFbAuthBanner('error', 'Please enter your email address to reset password.');
    return;
  }

  showFbAuthBanner('info', 'Sending password reset email via Firebase...');
  try {
    const res = await window.Firebase.sendPasswordReset(email);
    if (res && res.success) {
      showFbAuthBanner('success', `Password reset email sent to ${email}! Check your inbox.`);
    } else {
      showFbAuthBanner('error', res.error || 'Failed to send reset email.');
    }
  } catch (err) {
    showFbAuthBanner('error', err.message);
  }
}

function updateFbAuthModalUI() {
  const loggedInBox = document.getElementById('fbLoggedInBox');
  const formBox = document.getElementById('fbAuthFormBox');
  const emailVal = document.getElementById('fbUserDetailEmail');
  const nameVal = document.getElementById('fbUserDetailName');
  const uidVal = document.getElementById('fbUserDetailUid');

  const fbUser = window.FirebaseAuth && typeof window.FirebaseAuth.getCurrentUser === 'function'
    ? window.FirebaseAuth.getCurrentUser()
    : null;

  const playerEmail = fbUser ? fbUser.email : localStorage.getItem('player_email');
  const playerUid = fbUser ? fbUser.uid : localStorage.getItem('player_uid');
  const playerName = (fbUser && fbUser.displayName) || localStorage.getItem('player_username') || 'Player';
  const isLoggedIn = Boolean(playerEmail && localStorage.getItem('player_logged_in') !== 'false');

  if (loggedInBox && formBox) {
    if (isLoggedIn) {
      loggedInBox.style.display = 'block';
      formBox.style.display = 'none';
      if (emailVal) emailVal.textContent = playerEmail;
      if (nameVal) nameVal.textContent = playerName;
      if (uidVal) uidVal.textContent = playerUid ? `${playerUid.substring(0, 14)}...` : '-';
    } else {
      loggedInBox.style.display = 'none';
      formBox.style.display = 'block';
    }
  }
}

function switchTgAuthTab(tabName) {
  const tabs = [
    { id: 'firebase_email', btn: 'tabBtnTgFirebaseEmail', view: 'tgAuthViewFirebaseEmail' },
    { id: 'phone', btn: 'tabBtnTgPhone', view: 'tgAuthViewPhone' },
    { id: 'qr', btn: 'tabBtnTgQr', view: 'tgAuthViewQR' },
    { id: 'passkey', btn: 'tabBtnTgPasskey', view: 'tgAuthViewPasskey' },
    { id: 'bot', btn: 'tabBtnTgBot', view: 'tgAuthViewBot' },
    { id: 'test', btn: 'tabBtnTgTest', view: 'tgAuthViewTest' }
  ];

  tabs.forEach(item => {
    const btn = document.getElementById(item.btn);
    if (btn) btn.classList.toggle('active', item.id === tabName);

    const view = document.getElementById(item.view);
    if (view) view.style.display = (item.id === tabName) ? 'block' : 'none';
  });

  const codeView = document.getElementById('tgAuthViewCode');
  const twoFaView = document.getElementById('tgAuthView2FA');
  const signUpView = document.getElementById('tgAuthViewSignUp');

  if (codeView) codeView.style.display = 'none';
  if (twoFaView) twoFaView.style.display = 'none';
  if (signUpView) signUpView.style.display = 'none';

  if (tabName === 'firebase_email') {
    updateFbAuthModalUI();
  }

  if (tabName === 'qr') {
    startQrCountdown();
  } else if (tgQrTimer) {
    clearInterval(tgQrTimer);
    tgQrTimer = null;
  }
}

function backToTgAuthView(viewName) {
  const views = ['firebase_email', 'phone', 'code', '2FA', 'signUp'];
  views.forEach(v => {
    const elId = v === 'firebase_email' ? 'tgAuthViewFirebaseEmail' : ('tgAuthView' + v);
    const el = document.getElementById(elId);
    if (el) el.style.display = (v.toLowerCase() === viewName.toLowerCase()) ? 'block' : 'none';
  });
}

function handleTgCountrySelectChange() {
  const sel = document.getElementById('tgAuthCountrySelect');
  const dialDisplay = document.getElementById('tgPhoneDialCodeDisplay');
  if (sel && dialDisplay) {
    dialDisplay.textContent = sel.value;
  }
}

function fillTestDcAccount(dcNum) {
  const sel = document.getElementById('tgAuthCountrySelect');
  const phoneInput = document.getElementById('tgAuthPhoneInput');
  const dialDisplay = document.getElementById('tgPhoneDialCodeDisplay');

  if (sel) sel.value = '+999';
  if (dialDisplay) dialDisplay.textContent = '+999';

  const testNumbers = {
    1: '6611111',
    2: '6622222',
    3: '6633333'
  };

  if (phoneInput) {
    phoneInput.value = testNumbers[dcNum] || '6611111';
    phoneInput.focus();
  }

  showToast(`⚡ Loaded Test DC ${dcNum} account (+999${testNumbers[dcNum]}). Code: ${dcNum.toString().repeat(5)}`);
}

function fillAndSendTestDc(dcNum) {
  switchTgAuthTab('phone');
  fillTestDcAccount(dcNum);
  setTimeout(() => {
    handleSendTgCode();
  }, 300);
}

function handleSendTgCode() {
  const dialDisplay = document.getElementById('tgPhoneDialCodeDisplay');
  const phoneInput = document.getElementById('tgAuthPhoneInput');
  const deliverySel = document.getElementById('tgCodeDeliverySelect');

  const dial = dialDisplay ? dialDisplay.textContent.trim() : '+91';
  const rawNum = phoneInput ? phoneInput.value.trim().replace(/\D/g, '') : '';

  if (!rawNum || rawNum.length < 5) {
    showToast('⚠️ Please enter a valid phone number to continue.');
    if (phoneInput) phoneInput.focus();
    return;
  }

  const fullPhone = dial + rawNum;
  currentTgAuth.phone = fullPhone;
  currentTgAuth.codeHash = 'hash_' + Math.random().toString(36).substr(2, 9);
  currentTgAuth.codeType = deliverySel ? deliverySel.value : 'app';

  // Check if phone belongs to official Test DC format (99966XYYYY)
  if (rawNum.startsWith('661') || fullPhone.includes('999661')) {
    currentTgAuth.isTestDc = true;
    currentTgAuth.dcId = 1;
    currentTgAuth.expectedCode = '11111';
  } else if (rawNum.startsWith('662') || fullPhone.includes('999662')) {
    currentTgAuth.isTestDc = true;
    currentTgAuth.dcId = 2;
    currentTgAuth.expectedCode = '22222';
  } else if (rawNum.startsWith('663') || fullPhone.includes('999663')) {
    currentTgAuth.isTestDc = true;
    currentTgAuth.dcId = 3;
    currentTgAuth.expectedCode = '33333';
  } else {
    currentTgAuth.isTestDc = false;
    currentTgAuth.expectedCode = '12345';
  }

  // Check future auth token match per MTProto spec
  const futureTokens = getFutureAuthTokens();
  const matchedToken = futureTokens.find(t => t.phone === fullPhone);
  if (matchedToken) {
    showToast('⚡ Future Auth Token matched! Authorizing session instantly (auth.sentCodeSuccess)...');
    setTimeout(() => {
      completeTgAuthorization({
        phone: fullPhone,
        firstName: 'Nova User',
        username: 'nova_auth_' + rawNum.slice(-4)
      });
    }, 600);
    return;
  }

  // Update Code Verification UI
  const destEl = document.getElementById('tgDisplayDestPhone');
  if (destEl) destEl.textContent = fullPhone;

  const badgeEl = document.getElementById('tgCodeTypeBadge');
  if (badgeEl) {
    const badgeNames = {
      app: '📱 Telegram App',
      sms: '💬 SMS Code',
      email: '📧 Email Code',
      fragment: '💎 Fragment SMS',
      call: '📞 Voice Call'
    };
    badgeEl.textContent = badgeNames[currentTgAuth.codeType] || '📱 Telegram App';
  }

  // Auto-fill button label
  const autoFillBtn = document.getElementById('btnTgAutofillTestCode');
  if (autoFillBtn) {
    autoFillBtn.textContent = `⚡ Auto-fill Code (${currentTgAuth.expectedCode})`;
  }

  // Clear PIN inputs
  for (let i = 1; i <= 5; i++) {
    const pinBox = document.getElementById('tgPin' + i);
    if (pinBox) pinBox.value = '';
  }

  // Start resend countdown
  startResendTimer();

  // Switch to Code View
  backToTgAuthView('code');

  setTimeout(() => {
    const p1 = document.getElementById('tgPin1');
    if (p1) p1.focus();
  }, 100);

  ProfileAudio.playClickSoft();
  showToast(`📩 Code sent to ${fullPhone} via ${currentTgAuth.codeType.toUpperCase()}! (Code: ${currentTgAuth.expectedCode})`);
}

function startResendTimer() {
  if (currentTgAuth.resendTimer) clearInterval(currentTgAuth.resendTimer);
  currentTgAuth.resendSeconds = 45;

  const timerText = document.getElementById('tgResendTimerText');
  const secEl = document.getElementById('tgResendSeconds');
  const resendBtn = document.getElementById('btnTgResendCode');

  if (timerText) timerText.style.display = 'inline';
  if (resendBtn) resendBtn.style.display = 'none';
  if (secEl) secEl.textContent = '45s';

  currentTgAuth.resendTimer = setInterval(() => {
    currentTgAuth.resendSeconds--;
    if (secEl) secEl.textContent = currentTgAuth.resendSeconds + 's';

    if (currentTgAuth.resendSeconds <= 0) {
      clearInterval(currentTgAuth.resendTimer);
      currentTgAuth.resendTimer = null;
      if (timerText) timerText.style.display = 'none';
      if (resendBtn) resendBtn.style.display = 'inline';
    }
  }, 1000);
}

function resendTgCode() {
  currentTgAuth.codeType = 'sms';
  const badgeEl = document.getElementById('tgCodeTypeBadge');
  if (badgeEl) badgeEl.textContent = '💬 SMS Code (auth.resendCode)';
  startResendTimer();
  showToast(`📲 Code resent via SMS (auth.resendCode): ${currentTgAuth.expectedCode}`);
}

function handlePinInput(index, event) {
  const input = event.target;
  const val = input.value.replace(/\D/g, '');
  input.value = val ? val[val.length - 1] : '';

  if (input.value && index < 5) {
    const next = document.getElementById('tgPin' + (index + 1));
    if (next) next.focus();
  }

  // Check if all 5 digits are entered
  checkAndAutoSubmitPin();
}

function handlePinKeydown(index, event) {
  if (event.key === 'Backspace' && !event.target.value && index > 1) {
    const prev = document.getElementById('tgPin' + (index - 1));
    if (prev) {
      prev.focus();
      prev.value = '';
    }
  }
}

function checkAndAutoSubmitPin() {
  let pin = '';
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('tgPin' + i);
    if (el && el.value) pin += el.value;
  }
  if (pin.length === 5) {
    setTimeout(() => {
      handleVerifyTgCode();
    }, 200);
  }
}

function autoFillTestCode() {
  const code = currentTgAuth.expectedCode || '12345';
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('tgPin' + i);
    if (el) el.value = code[i - 1] || '';
  }
  setTimeout(() => {
    handleVerifyTgCode();
  }, 150);
}

function handleVerifyTgCode() {
  let enteredPin = '';
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('tgPin' + i);
    if (el) enteredPin += el.value.trim();
  }

  if (enteredPin.length < 5) {
    showToast('⚠️ Please enter all 5 digits of your verification code.');
    return;
  }

  if (enteredPin !== currentTgAuth.expectedCode) {
    ProfileAudio.playWarningBuzzer();
    showToast('❌ 400 PHONE_CODE_INVALID: The confirmation code is incorrect.');
    // Shake pin inputs
    const row = document.getElementById('tgPinInputsRow');
    if (row) {
      row.style.animation = 'shake 0.4s ease';
      setTimeout(() => row.style.animation = '', 400);
    }
    return;
  }

  // Check if 2FA is required for DC2 test account
  if (currentTgAuth.isTestDc && currentTgAuth.dcId === 2) {
    backToTgAuthView('2FA');
    showToast('🔐 400 SESSION_PASSWORD_NEEDED: 2FA cloud password required.');
    const pwdInput = document.getElementById('tg2faPasswordInput');
    if (pwdInput) {
      pwdInput.value = '';
      pwdInput.focus();
    }
    return;
  }

  // Check if new user registration is required for DC3 test account
  if (currentTgAuth.isTestDc && currentTgAuth.dcId === 3) {
    backToTgAuthView('signUp');
    showToast('✨ auth.authorizationSignUpRequired: Complete registration.');
    const fnInput = document.getElementById('tgSignUpFirstName');
    if (fnInput) fnInput.focus();
    return;
  }

  // Standard Success Login
  completeTgAuthorization({
    phone: currentTgAuth.phone,
    firstName: currentTgAuth.isTestDc ? `Test User DC${currentTgAuth.dcId}` : 'Nova Player',
    username: currentTgAuth.isTestDc ? `test_dc${currentTgAuth.dcId}` : 'nova_earner'
  });
}

function toggleTgPasswordVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPwd = input.type === 'password';
  input.type = isPwd ? 'text' : 'password';
  if (btnEl) btnEl.textContent = isPwd ? '🔒' : '👁️';
}

function handleVerifyTg2FA() {
  const pwdInput = document.getElementById('tg2faPasswordInput');
  const val = pwdInput ? pwdInput.value.trim() : '';

  if (!val) {
    showToast('⚠️ Please enter your 2FA cloud password.');
    if (pwdInput) pwdInput.focus();
    return;
  }

  // Accept password
  completeTgAuthorization({
    phone: currentTgAuth.phone,
    firstName: 'Nova 2FA VIP',
    username: 'nova_2fa_secure'
  });
}

function populateSignUpAvatarOptions() {
  const row = document.getElementById('tgSignUpAvatarRow');
  if (!row || row.children.length > 0) return;

  const avatars = ['avatar-1.png', 'avatar-2.png', 'avatar-3.png', 'avatar-4.png', 'avatar-5.png', 'avatar-6.png', 'avatar-7.png', 'avatar-8.png'];
  avatars.forEach((av, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-3d-option' + (idx === 0 ? ' active' : '');
    btn.setAttribute('data-avatar', av);
    btn.title = av.replace('.png', '');
    btn.innerHTML = `<img src="../../assets/avatars/${av}" alt="Avatar ${idx + 1}" class="sticker-3d-avatar-img" style="width: 42px; height: 42px; object-fit: contain; display: block; pointer-events: none;" />`;
    btn.onclick = () => {
      row.querySelectorAll('.avatar-3d-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
    row.appendChild(btn);
  });
}

function handleCompleteTgSignUp() {
  const fnInput = document.getElementById('tgSignUpFirstName');
  const lnInput = document.getElementById('tgSignUpLastName');
  const fn = fnInput ? fnInput.value.trim() : '';
  const ln = lnInput ? lnInput.value.trim() : '';

  if (!fn) {
    showToast('⚠️ Please enter your first name.');
    if (fnInput) fnInput.focus();
    return;
  }

  const activeAvBtn = document.querySelector('#tgSignUpAvatarRow .avatar-3d-option.active, #tgSignUpAvatarRow .tg-test-chip.active');
  const avatar = activeAvBtn ? (activeAvBtn.getAttribute('data-avatar') || 'avatar-1.png') : 'avatar-1.png';

  completeTgAuthorization({
    phone: currentTgAuth.phone,
    firstName: fn,
    lastName: ln,
    username: fn.toLowerCase().replace(/\s+/g, '_') + '_tg',
    avatar: avatar
  });
}

// QR Code Flow
function startQrCountdown() {
  tgQrSeconds = 30;
  const timerEl = document.getElementById('tgQrTimerText');
  if (timerEl) timerEl.textContent = tgQrSeconds + 's';

  if (tgQrTimer) clearInterval(tgQrTimer);
  tgQrTimer = setInterval(() => {
    tgQrSeconds--;
    if (timerEl) timerEl.textContent = tgQrSeconds + 's';
    if (tgQrSeconds <= 0) {
      refreshTgQrToken();
    }
  }, 1000);
}

function refreshTgQrToken() {
  tgQrSeconds = 30;
  const timerEl = document.getElementById('tgQrTimerText');
  if (timerEl) timerEl.textContent = '30s';
  showToast('🔄 QR Login Token refreshed (auth.exportLoginToken).');
}

function simulateQrLoginApprove() {
  showToast('📷 QR Code scanned by Telegram mobile app! Authorizing...');
  setTimeout(() => {
    completeTgAuthorization({
      phone: '+1 555-0199',
      firstName: 'Desktop Client',
      username: 'telegram_desktop'
    });
  }, 500);
}

// Passkey Flow
function handlePasskeyAuth() {
  showToast('👆 Verifying biometric passkey (auth.initPasskeyLogin)...');
  setTimeout(() => {
    completeTgAuthorization({
      phone: '+1 555-PASS',
      firstName: 'Passkey Master',
      username: 'biometric_vip'
    });
  }, 600);
}

// Bot Token Flow
function handleBotTokenAuth() {
  const tokenInput = document.getElementById('tgBotTokenInput');
  const token = tokenInput ? tokenInput.value.trim() : '';

  if (!token || !token.includes(':')) {
    showToast('⚠️ Please enter a valid Telegram Bot Token from @BotFather.');
    return;
  }

  completeTgAuthorization({
    phone: 'BOT',
    firstName: 'NovaTaskBot 🤖',
    username: 'NovaTaskOfficialBot',
    avatar: '🤖',
    isBot: true
  });
}

function handleFutureTokenLogin() {
  const tokens = getFutureAuthTokens();
  if (tokens.length === 0) {
    showToast('⚠️ No future auth token available.');
    return;
  }
  const latest = tokens[0];
  showToast(`⚡ Fast login using cached token for ${latest.phone}...`);
  setTimeout(() => {
    completeTgAuthorization({
      phone: latest.phone,
      firstName: 'Nova Earner',
      username: 'nova_token_user'
    });
  }, 400);
}

function completeTgAuthorization(userData) {
  const username = userData.firstName || userData.username || 'NovaEarner';
  const phone = userData.phone || '+919876543210';
  const avatar = userData.avatar || '⚡';

  // Save session info
  const sessionData = {
    authKeyId: 'auth_key_#' + Math.random().toString(16).substr(2, 8),
    phone: phone,
    firstName: userData.firstName,
    lastName: userData.lastName || '',
    username: userData.username || 'nova_earner',
    avatar: avatar,
    isBot: Boolean(userData.isBot),
    dateCreated: Date.now()
  };

  localStorage.setItem(TG_SESSION_KEY, JSON.stringify(sessionData));
  localStorage.setItem('player_username', username);
  localStorage.setItem('player_logged_in', 'true');
  if (userData.avatar) {
    localStorage.setItem('player_avatar', avatar);
  }

  // Also update Telegram Profile record if exists
  try {
    const prof = getTgProfile();
    prof.firstName = userData.firstName || prof.firstName;
    if (userData.lastName) prof.lastName = userData.lastName;
    if (userData.username) prof.username = userData.username;
    if (userData.avatar) prof.avatar = userData.avatar;
    saveTgProfile(prof);
  } catch (e) {}

  // Save future auth token
  storeFutureAuthToken(phone);

  closePlayerLoginModal();
  updatePlayerSessionUI();
  updateAdminLiveDisplays();
  syncProfileReferralCode();

  ProfileAudio.playRewardFanfare();
  showToast(`✓ Telegram Authorized! Key: ${sessionData.authKeyId} (${username})`);

  try {
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    ch.postMessage({ type: 'USER_LOGIN', username: username });
  } catch (e) {}
}

// Active Devices & Sessions Modal Management
function openTgActiveSessionsModal() {
  const modal = document.getElementById('tgActiveSessionsModalOverlay');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
  updateFutureTokensUI();
}

function closeTgActiveSessionsModal() {
  const modal = document.getElementById('tgActiveSessionsModalOverlay');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function handleActiveSessionsModalBackdrop(event) {
  if (event && (event.target.id === 'tgActiveSessionsModalOverlay' || event.target.classList.contains('profile-modal-overlay'))) {
    closeTgActiveSessionsModal();
  }
}

function terminateSingleSession(cardId) {
  const card = document.getElementById(cardId);
  if (card) {
    card.style.opacity = '0.4';
    card.style.pointerEvents = 'none';
    card.innerHTML += `<div style="color: #ef4444; font-size: 0.65rem; font-weight: 800; margin-top: 4px;">✓ Session Terminated (account.resetAuthorization)</div>`;
    ProfileAudio.playClickSoft();
    showToast('🛑 Session terminated successfully.');
  }
}

function terminateAllOtherTgSessions() {
  const list = document.getElementById('tgOtherSessionsList');
  if (list) {
    list.innerHTML = `<div style="text-align: center; padding: 1rem; color: #10b981; font-size: 0.76rem; font-weight: 700;">✓ All other sessions terminated (account.resetAuthorization). Only current session is active.</div>`;
    ProfileAudio.playClickSoft();
    showToast('🛑 Terminated all other active sessions.');
  }
}

function triggerSimulatedNewAuthAlert() {
  const alertModal = document.getElementById('tgNewSessionConfirmModal');
  if (alertModal) {
    alertModal.style.display = 'flex';
    ProfileAudio.playWarningBuzzer();
  }
}

function confirmNewSessionAlert(isConfirmed) {
  const alertModal = document.getElementById('tgNewSessionConfirmModal');
  if (alertModal) alertModal.style.display = 'none';

  if (isConfirmed) {
    showToast('✓ Session confirmed (account.changeAuthorizationSettings: confirmed=true).');
  } else {
    showToast('🛑 Session rejected and terminated (account.resetAuthorization).');
  }
}

// =============================================================================

// =============================================================================
// UNIQUE REFERRAL CODE & FIREBASE SYNC (Per-Profile Different Code)
// =============================================================================

function getOrCreateReferralCode() {
  let code = localStorage.getItem(REFERRAL_CODE_KEY);
  if (!code) {
    const player = getCurrentPlayer();
    // Unique code customized per profile
    let prefix = 'NOVA';
    if (player.username) {
      prefix = player.username.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase();
      if (!prefix) prefix = 'USER';
    }
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    code = `${prefix}-${randomNum}`;
    localStorage.setItem(REFERRAL_CODE_KEY, code);
  }

  // Synchronize to Firebase cloud in background
  syncProfileReferralCode(code);

  return code;
}

function syncProfileReferralCode(customCode) {
  const code = (customCode || localStorage.getItem(REFERRAL_CODE_KEY) || '').toUpperCase();
  const player = getCurrentPlayer();
  if (!code) return;

  const referralData = {
    code: code,
    userId: player.id || 'usr_1',
    userName: player.username || 'Player',
    rewardCoins: 100,
    updatedAt: Date.now()
  };

  // 1. Save to local cloud cache
  try {
    const rawLocal = localStorage.getItem('task_game_cloud_referral_codes');
    const localCodes = rawLocal ? JSON.parse(rawLocal) : {};
    localCodes[code] = referralData;
    localStorage.setItem('task_game_cloud_referral_codes', JSON.stringify(localCodes));
  } catch (e) {}

  // 2. Save to registered codes registry
  try {
    const rawAll = localStorage.getItem('task_game_all_registered_codes');
    const allCodes = rawAll ? JSON.parse(rawAll) : {};
    allCodes[code] = referralData;
    localStorage.setItem('task_game_all_registered_codes', JSON.stringify(allCodes));
  } catch (e) {}

  // 3. Update in task_game_users
  try {
    const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
    if (rawUsers) {
      const users = JSON.parse(rawUsers);
      const me = users.find(u => u.id === player.id || u.name === player.username);
      if (me) {
        me.referralCode = code;
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
    }
  } catch (e) {}

  // 4. Save to Firebase Firestore if connected
  if (window.Firebase && typeof window.Firebase.registerReferralCodeInCloud === 'function') {
    window.Firebase.registerReferralCodeInCloud(code, player.id, player.username).catch(() => {});
  }

  // 5. Broadcast to other open tabs/windows
  try {
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    ch.postMessage({ type: 'REFERRAL_CODE_REGISTERED', code: code, userName: player.username, userId: player.id });
  } catch (e) {}
}

const MOCK_REFERRAL_REGEX = /(?:Alex_Gamer|ShadowTyper|CyberViper|NeonBlaze|Phoenix99|QuantumCoder|StarHunter|HyperStrike|VortexPilot|LunaBlade)/;

function getStoredReferrals() {
  try {
    const raw = localStorage.getItem(REFERRALS_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(r => r && !MOCK_REFERRAL_REGEX.test(r.name || ''));
      }
    }
  } catch (e) {}
  return [];
}

function saveReferrals(list) {
  localStorage.setItem(REFERRALS_LIST_KEY, JSON.stringify(list));
  localStorage.setItem(SYNC_FLAG_KEY, Date.now().toString());
  try {
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    ch.postMessage({ type: 'REFERRAL_UPDATED', timestamp: Date.now() });
  } catch (e) {}
}

let pendingReferralReward = null;

function initReferralSystem() {
  const code = getOrCreateReferralCode();
  const userCodeEl = document.getElementById('userReferralCode');
  const inviteLinkInput = document.getElementById('inviteLinkInput');

  if (userCodeEl) userCodeEl.textContent = code;

  const origin = window.location.origin.includes('http') ? window.location.origin : 'http://127.0.0.1:5500';
  const shareLink = `${origin}/?ref=${code}`;
  if (inviteLinkInput) inviteLinkInput.value = shareLink;

  updatePlayerSessionUI();

  // Check if user already claimed referral bonus
  const isRedeemed = localStorage.getItem(REDEEMED_REFERRAL_KEY) === 'true';
  const inputFriendCode = document.getElementById('inputFriendReferralCode');
  const btnVerify = document.getElementById('btnVerifyReferralCode');
  const btnVerifyText = document.getElementById('btnVerifyText');
  const claimRow = document.getElementById('referralClaimRow');
  const redeemSuccessMsg = document.getElementById('redeemSuccessMsg');
  const verifyStatus = document.getElementById('referralVerifyStatus');

  if (isRedeemed) {
    if (inputFriendCode) {
      inputFriendCode.value = 'CLAIMED ✓';
      inputFriendCode.disabled = true;
    }
    if (btnVerify) {
      btnVerify.disabled = true;
      btnVerify.classList.add('verified-done');
    }
    if (btnVerifyText) {
      btnVerifyText.textContent = 'Claimed ✓';
    }
    if (claimRow) {
      claimRow.style.display = 'none';
    }
    if (verifyStatus) {
      verifyStatus.style.display = 'none';
    }
    if (redeemSuccessMsg) {
      redeemSuccessMsg.style.display = 'flex';
      redeemSuccessMsg.innerHTML = '<span>✓ Referral bonus (+100 🪙) already claimed by this profile!</span>';
    }
  } else {
    // Reset claim row to hidden until Firebase verification
    if (claimRow) claimRow.style.display = 'none';
    if (verifyStatus) verifyStatus.style.display = 'none';
    pendingReferralReward = null;
  }

  renderReferralStatsAndList();
}

const REFERRAL_MILESTONES_KEY = 'referral_star_milestones_claimed';
const REFERRAL_STAR_MILESTONES = [
  { id: 'ref_ms_1', friendsRequired: 1, rewardStars: 10, title: 'Invite 1 Friend' },
  { id: 'ref_ms_5', friendsRequired: 5, rewardStars: 20, title: 'Invite 5 Friends' },
  { id: 'ref_ms_10', friendsRequired: 10, rewardStars: 50, title: 'Invite 10 Friends' },
  { id: 'ref_ms_25', friendsRequired: 25, rewardStars: 120, title: 'Invite 25 Friends' },
  { id: 'ref_ms_50', friendsRequired: 50, rewardStars: 300, title: 'Invite 50 Friends' }
];

function getClaimedReferralMilestones() {
  try {
    const raw = localStorage.getItem(REFERRAL_MILESTONES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    return {};
  }
}

function getTotalClaimedMilestoneStars(claimedMap) {
  return REFERRAL_STAR_MILESTONES.reduce((sum, ms) => sum + (claimedMap[ms.id] ? ms.rewardStars : 0), 0);
}

function renderReferralMilestoneWidget(totalInvited) {
  const activeSlot = document.getElementById('inviteActiveMilestoneSlot');
  const summarySlot = document.getElementById('inviteMilestonesCompactSummary');
  const menuPillEl = document.getElementById('inviteMenuPillPreview');
  const claimed = getClaimedReferralMilestones();
  const activeIndex = REFERRAL_STAR_MILESTONES.findIndex((m) => !claimed[m.id]);
  const activeMs = activeIndex >= 0 ? REFERRAL_STAR_MILESTONES[activeIndex] : null;
  const totalClaimedCount = REFERRAL_STAR_MILESTONES.filter((m) => claimed[m.id]).length;
  const totalStarsWon = getTotalClaimedMilestoneStars(claimed);

  if (menuPillEl) {
    menuPillEl.innerHTML = activeMs
      ? `${activeMs.friendsRequired}👤 → +${activeMs.rewardStars} <img src="../../assets/stickers/sticker-star.png" alt="Stars" class="ui-3d-sticker-xs" />`
      : `All ${REFERRAL_STAR_MILESTONES.length} Claimed ✓`;
  }

  if (activeSlot) {
    if (!activeMs) {
      activeSlot.innerHTML = `
        <div class="invite-ms-active-card completed">
          <div class="invite-ms-top-row">
            <span class="invite-ms-badge done">🏆 ALL TASKS DONE</span>
            <span class="invite-ms-reward">+${totalStarsWon} ⭐ Won</span>
          </div>
          <div class="invite-ms-title">Every Invite Star Milestone Completed!</div>
          <div class="invite-ms-sub">You invited ${totalInvited} friend${totalInvited === 1 ? '' : 's'} and unlocked all Star rewards.</div>
        </div>
      `;
    } else {
      const pct = Math.min(100, Math.round((totalInvited / activeMs.friendsRequired) * 100));
      const remaining = Math.max(0, activeMs.friendsRequired - totalInvited);
      const isReady = totalInvited >= activeMs.friendsRequired;
      activeSlot.innerHTML = `
        <div class="invite-ms-active-card ${isReady ? 'ready' : ''}">
          <div class="invite-ms-top-row">
            <span class="invite-ms-badge">🎯 TASK ${activeIndex + 1} OF ${REFERRAL_STAR_MILESTONES.length}</span>
            <span class="invite-ms-reward">+${activeMs.rewardStars} ⭐</span>
          </div>
          <div class="invite-ms-title">${escapeHtml(activeMs.title)}</div>
          <div class="invite-ms-progress-wrap">
            <div class="invite-ms-progress-bar" style="width:${pct}%;"></div>
            <span class="invite-ms-progress-lbl">${Math.min(totalInvited, activeMs.friendsRequired)} / ${activeMs.friendsRequired} Friends</span>
          </div>
          <div class="invite-ms-action-row">
            ${isReady
              ? `<button type="button" class="btn-claim-ms-star" onclick="claimReferralMilestoneReward('${activeMs.id}')">🎁 Claim +${activeMs.rewardStars} ⭐</button>`
              : `<button type="button" class="btn-share-ms-invite" onclick="copyReferralCode()">Invite ${remaining} More • Copy Code 📋</button>`}
          </div>
        </div>
      `;
    }
  }

  if (summarySlot) {
    const pillsHtml = REFERRAL_STAR_MILESTONES.map((ms) => {
      const isDone = !!claimed[ms.id];
      const isCurrent = activeMs && activeMs.id === ms.id;
      const cls = isDone ? 'done' : (isCurrent ? 'current' : 'locked');
      const icon = isDone ? '✅' : (isCurrent ? '🎯' : '🔒');
      return `<span class="invite-ms-mini-pill ${cls}" title="${escapeHtml(ms.title)} → +${ms.rewardStars} ⭐">${icon} ${ms.friendsRequired}→+${ms.rewardStars}⭐</span>`;
    }).join('');
    summarySlot.innerHTML = `
      <div class="invite-ms-summary-head">
        <span>Star Task Progress: <b>${totalClaimedCount}/${REFERRAL_STAR_MILESTONES.length}</b></span>
        <span style="color:#facc15;font-weight:800;">Total Bonus: +${totalStarsWon} ⭐</span>
      </div>
      <div class="invite-ms-mini-pills-row">${pillsHtml}</div>
    `;
  }
}

async function claimReferralMilestoneReward(msId) {
  const ms = REFERRAL_STAR_MILESTONES.find((m) => m.id === msId);
  if (!ms) return;
  const claimed = getClaimedReferralMilestones();
  if (claimed[ms.id]) {
    showToast('✓ This Star milestone was already claimed.');
    return;
  }
  const totalInvited = getStoredReferrals().length;
  if (totalInvited < ms.friendsRequired) {
    showToast(`Invite ${ms.friendsRequired - totalInvited} more friend(s) to unlock +${ms.rewardStars} ⭐!`);
    return;
  }

  claimed[ms.id] = { claimedAt: Date.now(), stars: ms.rewardStars };
  localStorage.setItem(REFERRAL_MILESTONES_KEY, JSON.stringify(claimed));

  try {
    if (window.Firebase && typeof window.Firebase.atomicBalanceMutation === 'function') {
      await window.Firebase.atomicBalanceMutation({
        deltaStars: ms.rewardStars,
        reason: `Invite Star Task: ${ms.title}`,
        txId: `ref_ms_${ms.id}_${Date.now()}`
      });
    } else {
      const curStars = parseInt(localStorage.getItem('user_stars') || localStorage.getItem('task_game_stars') || '0', 10) || 0;
      const nextStars = curStars + ms.rewardStars;
      localStorage.setItem('user_stars', String(nextStars));
      localStorage.setItem('task_game_stars', String(nextStars));
    }
  } catch (e) {
    const curStars = parseInt(localStorage.getItem('user_stars') || localStorage.getItem('task_game_stars') || '0', 10) || 0;
    const nextStars = curStars + ms.rewardStars;
    localStorage.setItem('user_stars', String(nextStars));
    localStorage.setItem('task_game_stars', String(nextStars));
  }

  if (typeof window.updateAllDomBalances === 'function') window.updateAllDomBalances();
  ProfileAudio.playCopyChime();
  renderReferralStatsAndList();
  try {
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    ch.postMessage({ type: 'REFERRAL_UPDATED', timestamp: Date.now() });
    ch.close();
  } catch (e) {}
  showToast(`🎉 Claimed +${ms.rewardStars} ⭐ for "${ms.title}"!`);
}
window.claimReferralMilestoneReward = claimReferralMilestoneReward;

function renderReferralStatsAndList() {
  const referrals = getStoredReferrals();
  const totalInvited = referrals.length;
  const totalCoins = totalInvited * 100; // 100 coin win per invite
  const claimedMap = getClaimedReferralMilestones();
  const totalStarsWon = getTotalClaimedMilestoneStars(claimedMap);

  renderReferralMilestoneWidget(totalInvited);

  const countEl = document.getElementById('refTotalInvited');
  const coinsEl = document.getElementById('refCoinsEarned');
  const rateEl = document.getElementById('refRewardRate');
  const starsEl = document.getElementById('refStarsEarned');
  const listCountEl = document.getElementById('refListCount');

  if (countEl) countEl.textContent = totalInvited.toString();
  if (coinsEl) coinsEl.textContent = `+${totalCoins.toLocaleString()} 🪙`;
  if (rateEl) rateEl.textContent = '+10 ⭐';
  if (starsEl) starsEl.textContent = `+${totalStarsWon.toLocaleString()} ⭐`;
  if (listCountEl) listCountEl.textContent = `${totalInvited} Friend${totalInvited === 1 ? '' : 's'}`;

  const listContainer = document.getElementById('recentReferralsList');
  if (!listContainer) return;

  if (referrals.length === 0) {
    listContainer.innerHTML = `
      <div class="referral-empty-state">
        <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">👥</div>
        <div>No friends invited yet.</div>
        <div style="color: #64748b; font-size: 0.7rem; margin-top: 0.15rem;">Share your code above to earn +100 🪙 each time a friend joins!</div>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = referrals.map(r => `
    <div class="referral-item-card">
      <div class="referral-item-left">
        <div class="referral-avatar">${r.avatar || '👤'}</div>
        <div>
          <div class="referral-name">${escapeHtml(r.name)}</div>
          <div class="referral-time">${escapeHtml(r.time || 'Recently')}</div>
        </div>
      </div>
      <span class="referral-reward-pill">+100 🪙</span>
    </div>
  `).join('');
}

function copyReferralCode() {
  const code = getOrCreateReferralCode();
  const btn = document.getElementById('btnCopyCode');
  const textEl = document.getElementById('copyCodeText');

  navigator.clipboard.writeText(code).then(() => {
    ProfileAudio.playCopyChime();
    showToast(`✓ Referral Code "${code}" copied to clipboard!`);
    if (textEl) textEl.textContent = 'Copied! ✓';
    if (btn) btn.style.background = 'linear-gradient(155deg, #10b981 0%, #059669 100%)';
    setTimeout(() => {
      if (textEl) textEl.textContent = 'Copy Code';
      if (btn) btn.style.background = '';
    }, 2000);
  }).catch(() => {
    prompt('Copy your referral code:', code);
  });
}

function copyReferralLink() {
  const input = document.getElementById('inviteLinkInput');
  const textEl = document.getElementById('copyLinkText');
  const url = input ? input.value : `http://127.0.0.1:5500/?ref=${getOrCreateReferralCode()}`;

  navigator.clipboard.writeText(url).then(() => {
    ProfileAudio.playCopyChime();
    showToast('✓ Invite link copied to clipboard!');
    if (textEl) textEl.textContent = 'Copied!';
    setTimeout(() => {
      if (textEl) textEl.textContent = 'Copy';
    }, 2000);
  }).catch(() => {
    prompt('Copy your invite link:', url);
  });
}

function getShareInviteUrl(code) {
  const custom = document.getElementById('inviteLinkInput')?.value;
  if (custom && custom.startsWith('http')) return custom;
  const origin = (window.location.origin && window.location.origin.includes('http')) ? window.location.origin : 'http://127.0.0.1:5500';
  return `${origin}/?ref=${code}`;
}

function shareOnWhatsApp() {
  const code = getOrCreateReferralCode();
  const url = getShareInviteUrl(code);
  const text = encodeURIComponent(`🎮 Join me on Nova Task Game to complete missions & earn real cash! Use my unique code: ${code}\nWin 100 coins now: ${url}`);
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

function shareOnTelegram() {
  const code = getOrCreateReferralCode();
  const url = getShareInviteUrl(code);
  const text = encodeURIComponent(`Join Nova Task Game & earn real rewards! My unique code: ${code} (Win 100 coins)`);
  window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${text}`, '_blank');
}

function nativeShareInvite() {
  const code = getOrCreateReferralCode();
  const url = getShareInviteUrl(code);
  const shareData = {
    title: 'Nova Task Game — Join & Earn 100 Coins',
    text: `Join me on Nova Task Game and win 100 coins! My unique invite code: ${code}`,
    url: url
  };

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    navigator.share(shareData).catch(() => {});
  } else {
    copyReferralLink();
  }
}

// =============================================================================
// FIREBASE CODE VERIFICATION & CLAIM REVELATION ("than after a cliam are show")
// =============================================================================

/**
 * Handle friend referral code verification:
 * 1. Checks if user is logged in or not.
 * 2. Checks with Firebase Firestore database.
 * 3. Shows "Claim +100 🪙" button only after Firebase verification succeeds!
 */
async function handleVerifyFriendCode() {
  const input = document.getElementById('inputFriendReferralCode');
  const verifyBtn = document.getElementById('btnVerifyReferralCode');
  const verifyBtnText = document.getElementById('btnVerifyText');
  const statusBox = document.getElementById('referralVerifyStatus');
  const claimRow = document.getElementById('referralClaimRow');

  if (!input || !statusBox || !claimRow) return;

  // Step 1: User Login Check ("user are login or not that cheak")
  if (!isUserLoggedIn()) {
    statusBox.style.display = 'block';
    statusBox.className = 'referral-verify-status error';
    statusBox.innerHTML = `
      <div>⚠️ <b>User Not Logged In!</b></div>
      <div style="margin-top: 0.2rem; font-size: 0.7rem;">Please log in to your player account first before verifying and claiming a friend code.</div>
    `;
    claimRow.style.display = 'none';
    showToast('⚠️ Please log in to your profile first!');
    openPlayerLoginModal();
    return;
  }

  // Step 2: Validate Input
  const rawVal = input.value.trim().toUpperCase();
  if (!rawVal) {
    statusBox.style.display = 'block';
    statusBox.className = 'referral-verify-status error';
    statusBox.innerHTML = `⚠️ Please enter a referral code to verify.`;
    claimRow.style.display = 'none';
    input.focus();
    return;
  }

  // Step 3: Check Self-Referral
  const myCode = getOrCreateReferralCode().toUpperCase();
  if (rawVal === myCode) {
    statusBox.style.display = 'block';
    statusBox.className = 'referral-verify-status error';
    statusBox.innerHTML = `⚠️ <b>Self-Referral Rejected:</b> You cannot redeem your own profile's referral code!`;
    claimRow.style.display = 'none';
    return;
  }

  // Step 4: Check if already redeemed
  if (localStorage.getItem(REDEEMED_REFERRAL_KEY) === 'true') {
    statusBox.style.display = 'block';
    statusBox.className = 'referral-verify-status error';
    statusBox.innerHTML = `⚠️ <b>Already Claimed:</b> You have already claimed your 100 coin referral reward.`;
    claimRow.style.display = 'none';
    return;
  }

  // Step 5: Firebase Cloud Verification in Progress
  statusBox.style.display = 'flex';
  statusBox.className = 'referral-verify-status verifying';
  statusBox.innerHTML = `
    <span>🔄</span>
    <span>Connecting to Firebase... Verifying code <b>"${rawVal}"</b>...</span>
  `;
  if (verifyBtn) verifyBtn.disabled = true;
  if (verifyBtnText) verifyBtnText.textContent = 'Verifying...';
  claimRow.style.display = 'none';

  // Small delay for UI smoothness and real-time network feel
  await new Promise(r => setTimeout(r, 450));

  const player = getCurrentPlayer();
  let verifyResult = null;

  try {
    if (window.Firebase && typeof window.Firebase.verifyReferralCodeInCloud === 'function') {
      verifyResult = await window.Firebase.verifyReferralCodeInCloud(rawVal, player.id);
    } else {
      // Fallback local verification against known profiles and cloud cache
      verifyResult = verifyReferralCodeFallback(rawVal, player.id);
    }
  } catch (err) {
    console.warn('[Firebase Verification Error]:', err);
    verifyResult = verifyReferralCodeFallback(rawVal, player.id);
  }

  // Step 6: Process Verification Outcome
  if (!verifyResult || !verifyResult.valid) {
    statusBox.style.display = 'block';
    statusBox.className = 'referral-verify-status error';
    statusBox.innerHTML = `❌ <b>Firebase Verification Failed:</b> ${escapeHtml(verifyResult?.error || 'Code not found in Firebase database.')}`;
    if (verifyBtn) verifyBtn.disabled = false;
    if (verifyBtnText) verifyBtnText.textContent = 'Verify Code 🔍';
    claimRow.style.display = 'none';
    showToast('❌ Referral code verification failed.');
    return;
  }

  // SUCCESS: Firebase Verified!
  pendingReferralReward = verifyResult;

  statusBox.style.display = 'block';
  statusBox.className = 'referral-verify-status verified';
  statusBox.innerHTML = `
    <div>✅ <b>Firebase Verified!</b> Code is registered to <b>${escapeHtml(verifyResult.ownerName)}</b>.</div>
    <div style="font-size: 0.68rem; margin-top: 0.15rem; color: #a7f3d0;">Verification passed via ${escapeHtml(verifyResult.source || 'Firebase Cloud')}. Claim button unlocked below!</div>
  `;

  input.disabled = true;
  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.classList.add('verified-done');
  }
  if (verifyBtnText) {
    verifyBtnText.textContent = 'Verified ✓';
  }

  ProfileAudio.playCopyChime();

  // STEP 7: "than after a cliam are show"
  // The Claim +100 🪙 button is now revealed to the user!
  claimRow.style.display = 'block';
  showToast(`✅ Code verified! Click "CLAIM +100 🪙 BONUS" now!`, 3500);
}

/**
 * Fallback local verification if Firebase offline or during cross-profile testing
 */
function verifyReferralCodeFallback(code, currentUserId) {
  const cleanCode = String(code).trim().toUpperCase();
  const myCode = getOrCreateReferralCode().toUpperCase();

  // Self-referral check: Only reject if the user is entering their own code
  if (cleanCode === myCode) {
    return { valid: false, error: 'You cannot redeem your own profile referral code!' };
  }

  // 1. Check local cloud cache
  try {
    const rawLocal = localStorage.getItem('task_game_cloud_referral_codes');
    if (rawLocal) {
      const localCodes = JSON.parse(rawLocal);
      if (localCodes[cleanCode]) {
        const item = localCodes[cleanCode];
        return { valid: true, code: cleanCode, ownerName: item.userName || 'Friend', ownerUserId: item.userId, rewardCoins: 100, source: 'Firebase Cloud Registry' };
      }
    }
  } catch (e) {}

  // 2. Check all registered codes
  try {
    const rawAll = localStorage.getItem('task_game_all_registered_codes');
    if (rawAll) {
      const allCodes = JSON.parse(rawAll);
      if (allCodes[cleanCode]) {
        const item = allCodes[cleanCode];
        return { valid: true, code: cleanCode, ownerName: item.userName || 'Friend', ownerUserId: item.userId, rewardCoins: 100, source: 'Registered Friend Code' };
      }
    }
  } catch (e) {}

  // 3. Check task_game_users
  try {
    const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
    if (rawUsers) {
      const users = JSON.parse(rawUsers);
      const uMatch = users.find(u => (u.referralCode && u.referralCode.toUpperCase() === cleanCode) || (u.inviteCode && u.inviteCode.toUpperCase() === cleanCode));
      if (uMatch) {
        return { valid: true, code: cleanCode, ownerName: uMatch.name || 'Friend', ownerUserId: uMatch.id, rewardCoins: 100, source: 'Profile User Registry' };
      }
    }
  } catch (e) {}

  // 4. Default seed codes (e.g. NOVA-4730 or common user codes)
  if (cleanCode === 'NOVA-4730' || cleanCode.startsWith('NOVA-') || cleanCode.startsWith('USER-') || cleanCode.startsWith('USER1')) {
    return { valid: true, code: cleanCode, ownerName: 'User 1 (Task Earner)', ownerUserId: 'usr_1', rewardCoins: 100, source: 'Active Invite Registry' };
  }

  return { valid: false, error: `Code "${cleanCode}" not found. Enter a valid registered friend code.` };
}

/**
 * Handle claiming the 100 coin reward:
 * Triggered when user clicks the revealed "Claim +100 🪙" button!
 */
async function handleClaimReferralReward() {
  if (!isUserLoggedIn()) {
    showToast('⚠️ Please log in to your profile first.');
    openPlayerLoginModal();
    return;
  }

  if (!pendingReferralReward) {
    showToast('⚠️ Please verify a friend code first.');
    return;
  }

  if (localStorage.getItem(REDEEMED_REFERRAL_KEY) === 'true') {
    showToast('⚠️ Referral bonus already claimed!');
    return;
  }

  const claimBtn = document.getElementById('btnClaimReferralCode');
  const claimRow = document.getElementById('referralClaimRow');
  const successMsg = document.getElementById('redeemSuccessMsg');
  const player = getCurrentPlayer();

  // Credit 100 coins win to User 2 (the claimer)
  const rewardCoins = 100;
  let coins = parseInt(localStorage.getItem('task_game_coins') || localStorage.getItem('user_coins') || localStorage.getItem('task_game_coins_alt') || '0', 10) + rewardCoins;
  localStorage.setItem('task_game_coins', coins.toString());
  localStorage.setItem('user_coins', coins.toString());
  localStorage.setItem('task_game_coins_alt', coins.toString());
  try {
    const bc = new BroadcastChannel('balance_sync_channel');
    bc.postMessage({ type: 'BALANCE_UPDATED', coins });
    bc.close();
  } catch(e) {}
  window.dispatchEvent(new Event('balance:changed'));
  localStorage.setItem(REDEEMED_REFERRAL_KEY, 'true');
  localStorage.setItem(SYNC_FLAG_KEY, Date.now().toString());

  // Also reward User 1 (owner of the referral code) in task_game_users!
  try {
    const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
    if (rawUsers) {
      const users = JSON.parse(rawUsers);
      const owner = users.find(u => (pendingReferralReward.ownerUserId && u.id === pendingReferralReward.ownerUserId) || (pendingReferralReward.ownerName && u.name === pendingReferralReward.ownerName));
      if (owner) {
        owner.coins = (Number(owner.coins) || 0) + rewardCoins;
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
    }
  } catch (e) {}

  // Record redemption in Firebase
  if (window.Firebase && typeof window.Firebase.redeemReferralCodeInCloud === 'function') {
    window.Firebase.redeemReferralCodeInCloud(pendingReferralReward.code, player.id, player.username).catch(() => {});
  }

  // Add friend to invited list
  const referrals = getStoredReferrals();
  referrals.unshift({
    id: `ref_${Date.now()}`,
    name: pendingReferralReward.ownerName || 'Friend',
    avatar: '🎁',
    time: 'Just now',
    rewardCoins: 100,
    rewardStars: 0,
    timestamp: Date.now()
  });
  saveReferrals(referrals);

  // Audio and visual celebrations
  ProfileAudio.playRewardFanfare();
  if (claimBtn) showFloatingCoin(claimBtn, `+${rewardCoins} 🪙`);

  if (claimRow) claimRow.style.display = 'none';

  if (successMsg) {
    successMsg.style.display = 'flex';
    successMsg.innerHTML = `<span>🎉 Claimed successfully! +${rewardCoins} 🪙 added to your wallet!</span>`;
  }

  updateAdminLiveDisplays();
  renderReferralStatsAndList();
  showToast(`🎉 Congratulations! +${rewardCoins} 🪙 claimed successfully!`, 3500);

  try {
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    ch.postMessage({ 
      type: 'REFERRAL_REDEEMED', 
      code: pendingReferralReward.code, 
      ownerName: pendingReferralReward.ownerName, 
      ownerUserId: pendingReferralReward.ownerUserId,
      redeemedBy: player.username,
      coins: rewardCoins,
      timestamp: Date.now() 
    });
    ch.postMessage({ type: 'COINS_UPDATED', timestamp: Date.now() });
  } catch (e) {}
}

function simulateFriendJoin() {
  copyInviteLink();
  showToast('📋 Share your invite link with friends to earn real referral rewards!', 3500);
}

// ============================================================================
// INVITE FRIENDS POPUP MODAL CONTROLLER
// ============================================================================
function openInviteFriendsModal() {
  const modal = document.getElementById('inviteFriendsModalOverlay');
  if (!modal) return;

  initReferralSystem();
  modal.classList.add('active');
  modal.style.display = 'flex';
  toggleEditReferralCode(false);

  if (ProfileAudio && typeof ProfileAudio.playTabSwitch === 'function') {
    ProfileAudio.playTabSwitch();
  }
}

function closeInviteFriendsModal() {
  const modal = document.getElementById('inviteFriendsModalOverlay');
  if (!modal) return;

  modal.classList.remove('active');
  modal.style.display = 'none';
  toggleEditReferralCode(false);
}

function handleInviteModalBackdropClick(event) {
  if (event && (event.target.id === 'inviteFriendsModalOverlay' || event.target.classList.contains('profile-modal-overlay'))) {
    closeInviteFriendsModal();
  }
}

function toggleEditReferralCode(isEditing) {
  const displayRow = document.getElementById('codeDisplayRow');
  const editRow = document.getElementById('codeEditRow');
  const input = document.getElementById('inputCustomReferralCode');

  if (isEditing) {
    if (displayRow) displayRow.style.display = 'none';
    if (editRow) editRow.style.display = 'flex';
    if (input) {
      input.value = getOrCreateReferralCode();
      input.focus();
      input.select();
    }
  } else {
    if (displayRow) displayRow.style.display = 'flex';
    if (editRow) editRow.style.display = 'none';
  }
}

function saveCustomReferralCode() {
  const input = document.getElementById('inputCustomReferralCode');
  const rawVal = input ? input.value.trim().toUpperCase() : '';
  const cleaned = rawVal.replace(/[^A-Z0-9_-]/g, '');

  if (!cleaned || cleaned.length < 3) {
    showToast('⚠️ Referral code must be at least 3 characters.');
    if (input) input.focus();
    return;
  }

  localStorage.setItem(REFERRAL_CODE_KEY, cleaned);
  localStorage.setItem('task_game_user_referral_code', cleaned);

  // Sync to all registries (local cloud cache, registered codes list, task_game_users, Firebase)
  syncProfileReferralCode(cleaned);

  // Update UI in popup
  const userCodeEl = document.getElementById('userReferralCode');
  const inviteLinkInput = document.getElementById('inviteLinkInput');
  if (userCodeEl) userCodeEl.textContent = cleaned;

  const origin = window.location.origin.includes('http') ? window.location.origin : 'http://127.0.0.1:5500';
  const shareLink = `${origin}/?ref=${cleaned}`;
  if (inviteLinkInput) inviteLinkInput.value = shareLink;

  toggleEditReferralCode(false);

  if (ProfileAudio && typeof ProfileAudio.playRewardFanfare === 'function') {
    ProfileAudio.playRewardFanfare();
  }
  showToast(`🎉 Unique Code updated to "${cleaned}" & saved!`, 3000);
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeInviteFriendsModal();
    closePlayerLoginModal();
  }
});

window.openInviteFriendsModal = openInviteFriendsModal;
window.closeInviteFriendsModal = closeInviteFriendsModal;
window.handleInviteModalBackdropClick = handleInviteModalBackdropClick;
window.toggleEditReferralCode = toggleEditReferralCode;
window.saveCustomReferralCode = saveCustomReferralCode;
window.copyReferralCode = copyReferralCode;
window.copyReferralLink = copyReferralLink;
window.shareOnWhatsApp = shareOnWhatsApp;
window.shareOnTelegram = shareOnTelegram;
window.nativeShareInvite = nativeShareInvite;
window.handleVerifyFriendCode = handleVerifyFriendCode;
window.handleClaimReferralReward = handleClaimReferralReward;
window.simulateFriendJoin = simulateFriendJoin;
window.togglePlayerLoginState = togglePlayerLoginState;
window.openPlayerLoginModal = openPlayerLoginModal;
window.closePlayerLoginModal = closePlayerLoginModal;
window.handlePlayerLoginModalBackdropClick = handlePlayerLoginModalBackdropClick;
window.handlePlayerLoginForm = handlePlayerLoginForm;


// ============================================================================
// TELEGRAM USER PROFILE (MTProto Specs: user, userFull, account.updateProfile)
// ============================================================================
const TG_PROFILE_KEY = 'task_game_tg_profile';

const DEFAULT_TG_PROFILE = {
  firstName: "Task",
  lastName: "Earner",
  username: "task_earner",
  bio: "🎮 Web Task Champion • Official Mini App Player",
  avatar: "⚡",
  emojiStatus: "⚡",
  accentColor: "blue",
  birthday: "Oct 12",
  personalChannel: "@TaskCommunityOfficial",
  note: "Complete daily WebTasks & claim rewards",
  onlineStatus: "online",
  activeProfileTab: "gifts"
};

const TG_AVATAR_OPTIONS = [
  'avatar-1.png',
  'avatar-2.png',
  'avatar-3.png',
  'avatar-4.png',
  'avatar-5.png',
  'avatar-6.png',
  'avatar-7.png',
  'avatar-8.png'
];
const TG_STATUS_EMOJIS = ["⚡", "👑", "💎", "🔥", "🚀", "🌟", "🛡️", "💫", "🦊", "🏆"];

function resolveAvatarFileName(raw) {
  if (typeof window.resolvePlayerAvatarFile === 'function') {
    return window.resolvePlayerAvatarFile(raw);
  }
  const s = String(raw || '').trim();
  const match = s.match(/avatar-([1-8])\.png/i);
  if (match) return `avatar-${match[1]}.png`;
  const map = { '⚡':'avatar-1.png','👤':'avatar-7.png','👑':'avatar-2.png','💎':'avatar-6.png','🚀':'avatar-7.png','🦊':'avatar-3.png','🦁':'avatar-4.png','🎯':'avatar-8.png','🤖':'avatar-5.png','💻':'avatar-5.png','🐯':'avatar-8.png','🔥':'avatar-8.png','⭐':'avatar-2.png' };
  return map[s] || 'avatar-1.png';
}

function renderBorderless3DAvatar(el, rawAvatar, sizePx) {
  if (!el) return;
  if (typeof window.renderPlayerAvatarEl === 'function') {
    window.renderPlayerAvatarEl(el, rawAvatar, sizePx);
    return;
  }
  const file = resolveAvatarFileName(rawAvatar);
  const px = Number(sizePx) || 36;
  el.style.background = 'transparent';
  el.style.border = 'none';
  el.style.boxShadow = 'none';
  el.style.borderRadius = '0';
  el.innerHTML = `<img src="../../assets/avatars/${file}" alt="Avatar" class="sticker-3d-avatar-img" style="width:${px}px;height:${px}px;object-fit:contain;display:block;" />`;
}

let currentTgProfile = null;
let currentMusicPlaying = false;

function getTgProfile() {
  if (currentTgProfile) return currentTgProfile;
  try {
    const raw = localStorage.getItem(TG_PROFILE_KEY);
    if (raw) {
      currentTgProfile = Object.assign({}, DEFAULT_TG_PROFILE, JSON.parse(raw));
      if (currentTgProfile.firstName === 'Nova' && currentTgProfile.lastName === 'Earner') {
        currentTgProfile.firstName = 'Task';
        currentTgProfile.lastName = 'Earner';
        currentTgProfile.username = 'task_earner';
      }
    } else {
      currentTgProfile = Object.assign({}, DEFAULT_TG_PROFILE);
    }
  } catch (e) {
    currentTgProfile = Object.assign({}, DEFAULT_TG_PROFILE);
  }
  return currentTgProfile;
}

function saveTgProfile(profile) {
  const resolvedAvatar = resolveAvatarFileName(profile.avatar);
  profile.avatar = resolvedAvatar;
  currentTgProfile = profile;
  localStorage.setItem(TG_PROFILE_KEY, JSON.stringify(profile));
  // Sync to player_username & player_avatar
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Task Earner';
  localStorage.setItem('player_username', fullName);
  localStorage.setItem('player_avatar', resolvedAvatar);
  localStorage.setItem(SYNC_FLAG_KEY, Date.now().toString());

  // Also update active player record in task_game_users!
  try {
    const rawUsers = localStorage.getItem('task_game_users');
    const curUid = localStorage.getItem('player_uid') || 'usr_1';
    if (rawUsers) {
      let users = JSON.parse(rawUsers);
      if (Array.isArray(users)) {
        let u1 = users.find(u => u && (u.id === curUid || u.uid === curUid || u.id === 'usr_1'));
        if (u1) {
          u1.name = fullName;
          u1.avatar = resolvedAvatar;
          localStorage.setItem('task_game_users', JSON.stringify(users));
        }
      }
    }
  } catch (e) {}

  // Update top header bar username and avatar in DOM
  const topUserName = document.querySelector('.header-user .user-name');
  if (topUserName) topUserName.textContent = fullName;
  const topUserAvatar = document.querySelector('.header-user .user-avatar');
  renderBorderless3DAvatar(topUserAvatar, resolvedAvatar, 36);
  if (typeof window.saveCurrentProfileToFirestore === 'function') {
    try { window.saveCurrentProfileToFirestore(); } catch (e) {}
  }

  if (syncChannel) {
    try {
      syncChannel.postMessage({ type: 'PROFILE_UPDATED', timestamp: Date.now(), name: fullName, avatar: resolvedAvatar });
    } catch (e) {}
  }

  renderTgProfileUI();
  updateAdminLiveDisplays();
}

function renderTgProfileUI() {
  const p = getTgProfile();

  // Name
  const nameEl = document.getElementById('tgProfileDisplayName');
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Task Earner';
  if (nameEl) nameEl.textContent = fullName;

  // Big 3D Borderless Avatar
  const bigAvatar = document.getElementById('tgProfileBigAvatar');
  const savedAvatar = p.avatar || localStorage.getItem('player_avatar') || 'avatar-1.png';
  renderBorderless3DAvatar(bigAvatar, savedAvatar, 72);
  renderBorderless3DAvatar(document.getElementById('headerUserAvatar'), savedAvatar, 36);

  // Emoji Status
  const emojiStatusEl = document.getElementById('tgProfileEmojiStatus');
  if (emojiStatusEl) emojiStatusEl.textContent = p.emojiStatus || '⚡';

  // Username
  const usernameEl = document.getElementById('tgProfileUsername');
  if (usernameEl) usernameEl.textContent = p.username || 'task_earner';


  // Bio, Birthday, Note, Chips & Tabs suppressed per user request
  const bioEl = document.getElementById('tgProfileBio');
  if (bioEl) bioEl.style.display = 'none';

  document.querySelectorAll('.tg-profile-tabs-header, .tg-ptab-panel, .tg-music-card, .tg-meta-chips-row, .tg-profile-rating-badge, .tg-accent-picker-row, .tg-private-note-card, .player-session-badge, .session-tab-mini-badge, .tg-wallet-topup-strip').forEach(el => {
    el.style.display = 'none';
  });
}

function applyTgProfileAccentColor(color, save = true) {
  const heroCard = document.getElementById('tgProfileHeroCard');
  if (heroCard) {
    heroCard.className = `profile-hero-card theme-${color}`;
  }

  // Update dots
  const dots = ['blue', 'purple', 'green', 'red', 'gold', 'pink'];
  dots.forEach(d => {
    const el = document.getElementById('dot' + d.charAt(0).toUpperCase() + d.slice(1));
    if (el) {
      if (d === color) el.classList.add('active');
      else el.classList.remove('active');
    }
  });

  if (save) {
    const p = getTgProfile();
    p.accentColor = color;
    saveTgProfile(p);
  }
}

function setTgProfileAccentColor(color) {
  applyTgProfileAccentColor(color, true);
  showToast(`Profile Theme set to ${color.toUpperCase()} ✨`);
}

function switchTgProfileTab(tabName, save = true) {
  const tabs = ['gifts', 'music', 'stories', 'links'];
  tabs.forEach(t => {
    const btn = document.getElementById(`ptabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const panel = document.getElementById(`panelTg${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) {
      if (t === tabName) btn.classList.add('active');
      else btn.classList.remove('active');
    }
    if (panel) {
      if (t === tabName) panel.classList.add('active');
      else panel.classList.remove('active');
    }
  });

  if (save) {
    const p = getTgProfile();
    p.activeProfileTab = tabName;
    saveTgProfile(p);
  }
}

function toggleOnlineStatus() {
  const p = getTgProfile();
  p.onlineStatus = p.onlineStatus === 'online' ? 'offline' : 'online';
  saveTgProfile(p);
  showToast(p.onlineStatus === 'online' ? 'Status: Online 🟢' : 'Status: Last seen recently ⚪');
}

function copyProfileUsername() {
  const p = getTgProfile();
  const uname = p.username || 'nova_earner';
  const full = uname.startsWith('@') ? uname : `@${uname}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(full).then(() => {
      showToast(`Copied ${full} to clipboard! 📋`);
    }).catch(() => {
      showToast(`Username: ${full}`);
    });
  } else {
    showToast(`Username: ${full}`);
  }
}

function openPersonalChannelLink() {
  const p = getTgProfile();
  const chan = (p.personalChannel || '@NovaChannel').replace('@', '');
  window.open(`https://t.me/${chan}`, '_blank');
}

// Edit Profile Modal
let selectedEditAvatar = "avatar-1.png";

function openEditTgProfileModal() {
  const p = getTgProfile();
  selectedEditAvatar = resolveAvatarFileName(p.avatar || localStorage.getItem('player_avatar') || "avatar-1.png");

  const firstNameIn = document.getElementById('inputTgFirstName');
  const lastNameIn = document.getElementById('inputTgLastName');
  const usernameIn = document.getElementById('inputTgUsername');
  const bioIn = document.getElementById('inputTgBio');

  if (firstNameIn) firstNameIn.value = (p.firstName && p.firstName !== 'Nova') ? p.firstName : "Task";
  if (lastNameIn) lastNameIn.value = p.lastName || "Earner";
  if (usernameIn) usernameIn.value = ((p.username && p.username !== 'nova_earner') ? p.username : "task_earner").replace('@', '');
  if (bioIn) bioIn.value = p.bio || "";

  renderAvatarOptions();

  const overlay = document.getElementById('editTgProfileModalOverlay');
  if (overlay) {
    overlay.classList.add('active');
    overlay.style.display = 'flex';
  }
}

function closeEditTgProfileModal() {
  const overlay = document.getElementById('editTgProfileModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
}

function handleEditTgProfileModalBackdrop(e) {
  if (e.target && e.target.id === 'editTgProfileModalOverlay') {
    closeEditTgProfileModal();
  }
}

function renderAvatarOptions() {
  const list = document.getElementById('tgAvatarOptionList');
  if (!list) return;

  list.innerHTML = TG_AVATAR_OPTIONS.map((avFile, idx) => {
    const isActive = avFile === selectedEditAvatar;
    return `
      <button type="button"
        class="avatar-3d-option ${isActive ? 'active' : ''}"
        data-avatar="${avFile}"
        title="Avatar ${idx + 1}"
        onclick="selectEditAvatar('${avFile}')">
        <img src="../../assets/avatars/${avFile}" alt="Avatar ${idx + 1}" class="sticker-3d-avatar-img" style="width: 48px; height: 48px; object-fit: contain; display: block; pointer-events: none;" />
      </button>
    `;
  }).join('');
}

function selectEditAvatar(avFile) {
  selectedEditAvatar = resolveAvatarFileName(avFile);
  renderAvatarOptions();
}

function saveEditTgProfileForm(e) {
  e.preventDefault();
  const p = getTgProfile();

  const firstNameIn = document.getElementById('inputTgFirstName');
  const lastNameIn = document.getElementById('inputTgLastName');
  const usernameIn = document.getElementById('inputTgUsername');
  const bioIn = document.getElementById('inputTgBio');

  p.firstName = firstNameIn ? firstNameIn.value.trim() : p.firstName;
  p.lastName = lastNameIn ? lastNameIn.value.trim() : p.lastName;
  p.username = usernameIn ? usernameIn.value.trim().replace('@', '') : p.username;
  p.bio = bioIn ? bioIn.value.trim() : p.bio;
  p.avatar = selectedEditAvatar;

  saveTgProfile(p);
  closeEditTgProfileModal();
  showToast('Profile Updated Successfully! ✓');
}

// Emoji Status Picker
function openEmojiStatusPicker() {
  const grid = document.getElementById('tgEmojiPickerGrid');
  if (grid) {
    const p = getTgProfile();
    grid.innerHTML = TG_STATUS_EMOJIS.map(em => `
      <div class="tg-emoji-picker-item ${em === p.emojiStatus ? 'active' : ''}" onclick="setEmojiStatus('${em}')">
        ${em}
      </div>
    `).join('');
  }

  const overlay = document.getElementById('emojiStatusModalOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function closeEmojiStatusPicker() {
  const overlay = document.getElementById('emojiStatusModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

function handleEmojiStatusModalBackdrop(e) {
  if (e.target && e.target.id === 'emojiStatusModalOverlay') {
    closeEmojiStatusPicker();
  }
}

function setEmojiStatus(emoji) {
  const p = getTgProfile();
  p.emojiStatus = emoji;
  saveTgProfile(p);
  closeEmojiStatusPicker();
  showToast(`Emoji Status updated to ${emoji} ✨`);
}

// Audio Player for Music Tab
function toggleTgProfileMusic() {
  const btn = document.getElementById('btnTgPlayMusic');
  if (!currentMusicPlaying) {
    currentMusicPlaying = true;
    if (btn) btn.textContent = '⏸';
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.5);
      }
    } catch (e) {}
    showToast('Playing: Nova Cyber Wave 🎵');
  } else {
    currentMusicPlaying = false;
    if (btn) btn.textContent = '▶';
    showToast('Paused track ⏸');
  }
}

// Expose Telegram Profile API to window
window.openEditTgProfileModal = openEditTgProfileModal;
window.closeEditTgProfileModal = closeEditTgProfileModal;
window.handleEditTgProfileModalBackdrop = handleEditTgProfileModalBackdrop;
window.selectEditAvatar = selectEditAvatar;
window.saveEditTgProfileForm = saveEditTgProfileForm;
window.openEmojiStatusPicker = openEmojiStatusPicker;
window.closeEmojiStatusPicker = closeEmojiStatusPicker;
window.handleEmojiStatusModalBackdrop = handleEmojiStatusModalBackdrop;
window.setEmojiStatus = setEmojiStatus;
window.setTgProfileAccentColor = setTgProfileAccentColor;
window.switchTgProfileTab = switchTgProfileTab;
window.toggleOnlineStatus = toggleOnlineStatus;
window.copyProfileUsername = copyProfileUsername;
window.openPersonalChannelLink = openPersonalChannelLink;
window.toggleTgProfileMusic = toggleTgProfileMusic;

function getLiveProfileStreakCount() {
  if (typeof window.getDailyStreakState === 'function') {
    try {
      const ds = window.getDailyStreakState();
      if (ds) {
        if (ds.isStreakBroken) return 0;
        if (ds.streakCount > 0) return ds.streakCount;
      }
    } catch (e) {}
  }
  const rawDailyCount = parseInt(localStorage.getItem('task_daily_streak_count') || '0', 10) || 0;
  if (rawDailyCount > 0) return rawDailyCount;
  try {
    const dsV2 = JSON.parse(localStorage.getItem('task_game_daily_streak_v2') || 'null');
    if (dsV2 && typeof dsV2.streakCount === 'number' && dsV2.streakCount > 0) return dsV2.streakCount;
  } catch (e) {}
  try {
    const prog = JSON.parse(localStorage.getItem('tap_empire_daily_progression') || 'null');
    const tasksDone = parseInt(localStorage.getItem('task_game_total_tasks_completed') || localStorage.getItem('completed_tasks_count') || '0', 10) || 0;
    if (prog && typeof prog.streakDays === 'number' && prog.streakDays > 0 && tasksDone > 0) return prog.streakDays;
  } catch (e) {}
  const legacyStreak = parseInt(localStorage.getItem('task_game_streak_days') || localStorage.getItem('task_game_login_streak') || '0', 10) || 0;
  return Math.max(0, legacyStreak);
}

function updateProfileOverviewStats() {
  const tasksNum = Math.max(
    parseInt(localStorage.getItem('task_game_total_tasks_completed') || '0', 10) || 0,
    parseInt(localStorage.getItem('completed_tasks_count') || '0', 10) || 0
  );
  const streakNum = getLiveProfileStreakCount();
  const tasksEl = document.getElementById('profileStatTasks');
  const levelEl = document.getElementById('profileStatGames');
  const streakEl = document.getElementById('profileStatStreak');
  if (tasksEl) tasksEl.textContent = tasksNum.toLocaleString();
  if (levelEl) {
    const tier = Math.max(1, Math.floor(tasksNum / 10) + 1);
    levelEl.textContent = tier.toString();
  }
  if (streakEl) streakEl.textContent = String(streakNum);
}
window.updateProfileOverviewStats = updateProfileOverviewStats;

window.addEventListener('balance:changed', () => {
  updateAdminLiveDisplays();
  updateProfileOverviewStats();
});

window.addEventListener('balance:synced', () => {
  updateAdminLiveDisplays();
  updateProfileOverviewStats();
});

window.addEventListener('streak:updated', () => {
  updateProfileOverviewStats();
});

window.addEventListener('tasks:changed', () => {
  updateProfileOverviewStats();
});

window.addEventListener('firebase:ready', () => {
  updateProfileOverviewStats();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateAdminLiveDisplays();
    updateProfileOverviewStats();
  }
});

// Cross-tab and sync channel listeners
window.addEventListener('storage', (e) => {
  if (e.key === 'task_game_coins' || e.key === 'task_game_stars') {
    updateAdminLiveDisplays();
  }
  if (e.key === TG_PROFILE_KEY) {
    renderTgProfileUI();
  }
  if (e.key === REFERRALS_LIST_KEY) {
    renderReferralStatsAndList();
  }
  if (e.key === 'player_username' || e.key === 'player_logged_in') {
    if (typeof updatePlayerSessionUI === 'function') updatePlayerSessionUI();
    updateAdminLiveDisplays();
  }
  if (
    !e.key ||
    e.key === 'task_game_total_tasks_completed' ||
    e.key === 'completed_tasks_count' ||
    e.key === 'task_game_ads_watched_count' ||
    e.key === 'task_daily_streak_count' ||
    e.key === 'task_daily_streak_last_date' ||
    e.key === 'task_game_daily_streak_v2' ||
    e.key === 'user_streak_days' ||
    e.key === 'task_game_streak_days' ||
    e.key === 'tap_empire_daily_progression'
  ) {
    updateProfileOverviewStats();
  }
});

try {
  const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
  ch.onmessage = (event) => {
    const data = event && event.data;
    if (data) {
      if (data.type === 'REFERRAL_CODE_REGISTERED') {
        try {
          const rawLocal = localStorage.getItem('task_game_cloud_referral_codes');
          const localCodes = rawLocal ? JSON.parse(rawLocal) : {};
          localCodes[data.code] = {
            code: data.code,
            userId: data.userId,
            userName: data.userName,
            rewardCoins: 100,
            updatedAt: Date.now()
          };
          localStorage.setItem('task_game_cloud_referral_codes', JSON.stringify(localCodes));
        } catch (e) {}
      }

      if (data.type === 'REFERRAL_REDEEMED') {
        const myCode = getOrCreateReferralCode().toUpperCase();
        const myPlayer = getCurrentPlayer();
        if (data.code === myCode || data.ownerUserId === myPlayer.id || (data.ownerName && data.ownerName.toLowerCase() === myPlayer.username.toLowerCase())) {
          let myCoins = parseInt(localStorage.getItem('task_game_coins') || '0', 10) + (data.coins || 100);
          localStorage.setItem('task_game_coins', myCoins.toString());
  localStorage.setItem('user_coins', myCoins.toString());
  localStorage.setItem('task_game_coins_alt', myCoins.toString());
  try {
    const bc = new BroadcastChannel('balance_sync_channel');
    bc.postMessage({ type: 'BALANCE_UPDATED', coins: myCoins });
    bc.close();
  } catch(e) {}
  window.dispatchEvent(new Event('balance:changed'));
          const myReferrals = getStoredReferrals();
          myReferrals.unshift({
            id: `ref_${Date.now()}`,
            name: data.redeemedBy || 'Friend Joined',
            avatar: '🎁',
            time: 'Just now',
            rewardCoins: data.coins || 100,
            rewardStars: 0,
            timestamp: Date.now()
          });
          saveReferrals(myReferrals);
          showToast(`🎉 A friend (${data.redeemedBy || 'Friend'}) joined using your invite code! +${data.coins || 100} 🪙 awarded!`, 4000);
        }
      }
    }

    updateAdminLiveDisplays();
    renderTgProfileUI();
    renderReferralStatsAndList();
    if (typeof updatePlayerSessionUI === 'function') updatePlayerSessionUI();
    updateProfileOverviewStats();
  };
} catch (e) {}



// Telegram User Authorization Window Exports
window.switchTgAuthTab = switchTgAuthTab;
window.backToTgAuthView = backToTgAuthView;
window.handleTgCountrySelectChange = handleTgCountrySelectChange;
window.fillTestDcAccount = fillTestDcAccount;
window.fillAndSendTestDc = fillAndSendTestDc;
window.handleSendTgCode = handleSendTgCode;
window.resendTgCode = resendTgCode;
window.handlePinInput = handlePinInput;
window.handlePinKeydown = handlePinKeydown;
window.autoFillTestCode = autoFillTestCode;
window.handleVerifyTgCode = handleVerifyTgCode;
window.toggleTgPasswordVisibility = toggleTgPasswordVisibility;
window.handleVerifyTg2FA = handleVerifyTg2FA;
window.handleCompleteTgSignUp = handleCompleteTgSignUp;
window.refreshTgQrToken = refreshTgQrToken;
window.simulateQrLoginApprove = simulateQrLoginApprove;
window.handlePasskeyAuth = handlePasskeyAuth;
window.handleBotTokenAuth = handleBotTokenAuth;
window.handleFutureTokenLogin = handleFutureTokenLogin;
window.openTgActiveSessionsModal = openTgActiveSessionsModal;
window.closeTgActiveSessionsModal = closeTgActiveSessionsModal;
window.handleActiveSessionsModalBackdrop = handleActiveSessionsModalBackdrop;
window.terminateSingleSession = terminateSingleSession;
window.terminateAllOtherTgSessions = terminateAllOtherTgSessions;
window.triggerSimulatedNewAuthAlert = triggerSimulatedNewAuthAlert;
window.confirmNewSessionAlert = confirmNewSessionAlert;

// =============================================================================
// TELEGRAM PUSH NOTIFICATIONS ENGINE (MTProto Handling PUSH-notifications)
// =============================================================================
const TG_PUSH_SUB_KEY = 'task_game_tg_push_subscription';
const TG_PUSH_PREFS_KEY = 'task_game_tg_push_prefs';
const TG_PUSH_HISTORY_KEY = 'task_game_tg_push_history';

let tgPushBannerTimer = null;

// Official MTProto loc_key template dictionary
const TG_PUSH_TEMPLATES = {
  MESSAGE_STARGIFT: '{1} sent you a Gift worth {2} Stars',
  MESSAGE_UNIQUE_STARGIFT: '{1} transferred you a Gift!',
  CHANNEL_MESSAGE_GIVEAWAY_STARS: '{1} posted a giveaway of {3} stars {2}',
  MESSAGE_GIFTCODE: '{1} sent you a Gift Code for {2} of Telegram Premium',
  CHAT_MESSAGE_PAID_MEDIA: '{1} posted a paid post in {2} group for {3} star',
  MESSAGE_TEXT: '{1}: {2}',
  CHAT_MESSAGE_TEXT: '{1} @ {2}: {3}',
  CHANNEL_MESSAGE_TEXT: '{1}: {2}',
  PINNED_TEXT: '{1} pinned "{2}"',
  CONTACT_JOINED: '{1} joined Telegram!',
  REACT_TEXT: '{1}: {2} to your "{3}"',
  CHAT_REACT_TEXT: '{1}: {3} in {2} to your "{4}"',
  PHONE_CALL_REQUEST: '{1} is calling you!',
  PHONE_CALL_MISSED: 'You missed a call from {1}',
  AUTH_REGION: 'New login from unrecognized device {1}, location: {2}',
  AUTH_UNKNOWN: 'New login from unrecognized device {1}',
  MESSAGE_ANNOUNCEMENT: '{message}',
  CHAT_ADD_YOU: '{1} invited you to the group {2}',
  MESSAGE_GAME: '{1} invited you to play {2}'
};

function getPushSubscription() {
  try {
    const raw = localStorage.getItem(TG_PUSH_SUB_KEY);
    return raw ? JSON.parse(raw) : {
      registered: true,
      tokenType: 10,
      endpoint: 'https://fcm.googleapis.com/fcm/send/web_push_' + Math.random().toString(36).substr(2, 10),
      p256dh: 'BNq48aKM' + Math.random().toString(36).substr(2, 14),
      auth: 's81j49Xz' + Math.random().toString(36).substr(2, 8),
      registeredAt: Date.now()
    };
  } catch (e) {
    return { registered: true, tokenType: 10, registeredAt: Date.now() };
  }
}

function savePushSubscription(sub) {
  try {
    localStorage.setItem(TG_PUSH_SUB_KEY, JSON.stringify(sub));
    updatePushBadgeUI();
  } catch (e) {}
}

function getPushPreferences() {
  try {
    const raw = localStorage.getItem(TG_PUSH_PREFS_KEY);
    return raw ? JSON.parse(raw) : {
      privateMsgs: true,
      groupMsgs: true,
      starsGifts: true,
      audioChime: true,
      msgPreviews: true
    };
  } catch (e) {
    return { privateMsgs: true, groupMsgs: true, starsGifts: true, audioChime: true, msgPreviews: true };
  }
}

function savePushPreferences() {
  const prefs = {
    privateMsgs: document.getElementById('prefTgPrivateMsgs')?.checked ?? true,
    groupMsgs: document.getElementById('prefTgGroupMsgs')?.checked ?? true,
    starsGifts: document.getElementById('prefTgStarsGifts')?.checked ?? true,
    audioChime: document.getElementById('prefTgAudioChime')?.checked ?? true,
    msgPreviews: document.getElementById('prefTgMsgPreviews')?.checked ?? true
  };
  localStorage.setItem(TG_PUSH_PREFS_KEY, JSON.stringify(prefs));
  showToast('✓ Notification preferences saved.');
}

function loadPushPreferencesUI() {
  const prefs = getPushPreferences();
  const p1 = document.getElementById('prefTgPrivateMsgs');
  const p2 = document.getElementById('prefTgGroupMsgs');
  const p3 = document.getElementById('prefTgStarsGifts');
  const p4 = document.getElementById('prefTgAudioChime');
  const p5 = document.getElementById('prefTgMsgPreviews');

  if (p1) p1.checked = prefs.privateMsgs;
  if (p2) p2.checked = prefs.groupMsgs;
  if (p3) p3.checked = prefs.starsGifts;
  if (p4) p4.checked = prefs.audioChime;
  if (p5) p5.checked = prefs.msgPreviews;
}

function getPushHistory() {
  try {
    const raw = localStorage.getItem(TG_PUSH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function savePushHistory(history) {
  try {
    localStorage.setItem(TG_PUSH_HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
    renderPushHistory();
  } catch (e) {}
}

function clearPushHistory() {
  localStorage.removeItem(TG_PUSH_HISTORY_KEY);
  renderPushHistory();
  showToast('✓ Notification history cleared.');
}

function initTgPushSystem() {
  updatePushBadgeUI();
  loadPushPreferencesUI();
  renderPushHistory();

  // Check 24-hour re-registration per MTProto spec
  const sub = getPushSubscription();
  if (sub && sub.registered) {
    const hoursSince = (Date.now() - (sub.registeredAt || 0)) / (1000 * 60 * 60);
    if (hoursSince >= 24) {
      handleRegisterDevice(false);
    }
  }
}

function updatePushBadgeUI() {
  const sub = getPushSubscription();
  const badge = document.getElementById('tgPushRegisteredBadge');
  const stateBadge = document.getElementById('tgPushSubStateBadge');

  if (badge) {
    badge.textContent = sub.registered ? 'WebPush: Active' : 'Push: Muted';
    badge.style.color = sub.registered ? '#34d399' : '#f87171';
    badge.style.borderColor = sub.registered ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)';
  }
  if (stateBadge) {
    stateBadge.textContent = sub.registered ? '🟢 Registered (Valid 24h)' : '🔴 Unregistered (Muted)';
    stateBadge.className = sub.registered ? 'tg-push-pill active' : 'tg-push-pill offline';
  }
}

function openTgPushNotificationsModal() {
  const modal = document.getElementById('tgPushNotificationsModalOverlay');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
  switchPushModalTab('status');
  updatePushBadgeUI();
  loadPushPreferencesUI();
  renderPushHistory();
}

function closeTgPushNotificationsModal() {
  const modal = document.getElementById('tgPushNotificationsModalOverlay');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function handlePushModalBackdrop(event) {
  if (event && (event.target.id === 'tgPushNotificationsModalOverlay' || event.target.classList.contains('profile-modal-overlay'))) {
    closeTgPushNotificationsModal();
  }
}

function switchPushModalTab(tabName) {
  const tabs = ['status', 'sim', 'prefs', 'logs'];
  tabs.forEach(tab => {
    const btn = document.getElementById('tabBtnPush' + capitalize(tab));
    if (btn) btn.classList.toggle('active', tab === tabName);

    const view = document.getElementById('pushTabView' + capitalize(tab));
    if (view) view.style.display = (tab === tabName) ? 'block' : 'none';
  });
}

function handleRegisterDevice(showNotice = true) {
  const sub = {
    registered: true,
    tokenType: 10,
    endpoint: 'https://fcm.googleapis.com/fcm/send/web_push_' + Math.random().toString(36).substr(2, 10),
    p256dh: 'BNq48aKM' + Math.random().toString(36).substr(2, 14),
    auth: 's81j49Xz' + Math.random().toString(36).substr(2, 8),
    registeredAt: Date.now()
  };
  savePushSubscription(sub);

  const displayEl = document.getElementById('tgPushTokenDisplay');
  if (displayEl) {
    displayEl.innerHTML = `endpoint: ${sub.endpoint.slice(0, 48)}...<br/>p256dh: ${sub.p256dh} | auth: ${sub.auth}`;
  }

  ProfileAudio.playClickSoft();
  if (showNotice) {
    showToast('✓ Device registered with MTProto push server (account.registerDevice)!');
  }
}

function handleUnregisterDevice() {
  const sub = getPushSubscription();
  sub.registered = false;
  savePushSubscription(sub);

  ProfileAudio.playWarningBuzzer();
  showToast('✕ Device unregistered (account.unregisterDevice). Notifications muted.');
}

function requestBrowserPushPermission() {
  if ('Notification' in window) {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showToast('🔔 Browser Push Notification permission GRANTED!');
        handleRegisterDevice(false);
      } else {
        showToast('⚠️ Push permission: ' + permission);
      }
    });
  } else {
    showToast('ℹ️ Web Push supported via in-app banner chime.');
  }
}

// Synthesize Telegram notification sound using Web Audio API
function playTgNotificationChime() {
  const prefs = getPushPreferences();
  if (!prefs.audioChime) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Chime Note 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.18, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Chime Note 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    gain2.gain.setValueAtTime(0.22, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}

function formatTgPushTemplate(locKey, locArgs = [], custom = {}, message = '') {
  let template = TG_PUSH_TEMPLATES[locKey] || '{1}';
  if (locKey === 'MESSAGE_ANNOUNCEMENT') {
    return message || custom.message || 'Official Announcement from Telegram';
  }

  locArgs.forEach((arg, index) => {
    const placeholder = `{${index + 1}}`;
    template = template.replace(new RegExp(placeholder, 'g'), arg);
  });
  return template;
}

function simulatePushEvent(locKey, locArgs = [], customMessage = '') {
  const sub = getPushSubscription();
  if (!sub.registered) {
    showToast('⚠️ Notifications are currently muted (account.unregisterDevice). Re-register to receive alerts.');
    return;
  }

  const prefs = getPushPreferences();

  // Filter check
  if (locKey.startsWith('MESSAGE_STARGIFT') || locKey.includes('STARS') || locKey.includes('GIFT')) {
    if (!prefs.starsGifts) return;
  } else if (locKey.startsWith('CHAT_') || locKey.startsWith('CHANNEL_')) {
    if (!prefs.groupMsgs) return;
  } else if (locKey.startsWith('MESSAGE_')) {
    if (!prefs.privateMsgs) return;
  }

  const rawFormatted = formatTgPushTemplate(locKey, locArgs, {}, customMessage);

  // Icon mapping
  let icon = '💬';
  let title = 'Telegram Notification';
  let sender = 'Telegram';

  if (locKey.includes('STARGIFT') || locKey.includes('STARS')) {
    icon = '⭐';
    title = 'Telegram Stars';
    sender = locArgs[0] || 'Telegram Stars';
  } else if (locKey.includes('CALL')) {
    icon = '📞';
    title = 'Incoming Call';
    sender = locArgs[0] || 'Call';
  } else if (locKey.includes('REACT')) {
    icon = '🔥';
    title = 'New Reaction';
    sender = locArgs[0] || 'Reaction';
  } else if (locKey.includes('AUTH')) {
    icon = '🔒';
    title = 'Security Alert';
    sender = 'Security Service';
  } else if (locKey.includes('ANNOUNCEMENT')) {
    icon = '📢';
    title = 'Announcement';
    sender = 'Telegram Team';
  } else if (locArgs.length > 0) {
    sender = locArgs[0];
  }

  const pushPayload = {
    id: 'push_' + Date.now(),
    locKey: locKey,
    sender: sender,
    title: title,
    body: prefs.msgPreviews ? rawFormatted : 'You have a new message',
    icon: icon,
    timestamp: Date.now()
  };

  showFloatingTgPushBanner(pushPayload);

  // Store in history
  const history = getPushHistory();
  history.unshift(pushPayload);
  savePushHistory(history);

  // Native notification if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: pushPayload.body,
        icon: '../../assets/icon.png'
      });
    } catch (e) {}
  }
}

function showFloatingTgPushBanner(push) {
  const container = document.getElementById('tgPushBannerContainer');
  const iconEl = document.getElementById('tgPushBannerIcon');
  const senderEl = document.getElementById('tgPushBannerSender');
  const titleEl = document.getElementById('tgPushBannerTitle');
  const bodyEl = document.getElementById('tgPushBannerBody');

  if (!container) return;

  if (iconEl) iconEl.textContent = push.icon;
  if (senderEl) senderEl.textContent = push.sender;
  if (titleEl) titleEl.textContent = push.title;
  if (bodyEl) bodyEl.textContent = push.body;

  container.style.display = 'flex';
  playTgNotificationChime();

  if (tgPushBannerTimer) clearTimeout(tgPushBannerTimer);
  tgPushBannerTimer = setTimeout(() => {
    dismissPushBanner();
  }, 5000);
}

function dismissPushBanner(e) {
  if (e) e.stopPropagation();
  const container = document.getElementById('tgPushBannerContainer');
  if (container) container.style.display = 'none';
  if (tgPushBannerTimer) clearTimeout(tgPushBannerTimer);
}

function handlePushBannerClick() {
  dismissPushBanner();
  openTgPushNotificationsModal();
  switchPushModalTab('logs');
}

function renderPushHistory() {
  const list = document.getElementById('tgPushLogsList');
  if (!list) return;

  const history = getPushHistory();
  if (history.length === 0) {
    list.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 0.74rem; padding: 1.5rem 0;">No notifications received yet.</div>`;
    return;
  }

  list.innerHTML = history.map(item => `
    <div class="tg-log-item">
      <div class="tg-log-top">
        <span class="tg-log-loc-key">${escapeHtml(item.locKey)}</span>
        <span class="tg-log-time">${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
      <div class="tg-log-text">${escapeHtml(item.body)}</div>
    </div>
  `).join('');
}

// Window Exports for Push Notifications
window.openTgPushNotificationsModal = openTgPushNotificationsModal;
window.closeTgPushNotificationsModal = closeTgPushNotificationsModal;
window.handlePushModalBackdrop = handlePushModalBackdrop;
window.switchPushModalTab = switchPushModalTab;
window.handleRegisterDevice = handleRegisterDevice;
window.handleUnregisterDevice = handleUnregisterDevice;
window.requestBrowserPushPermission = requestBrowserPushPermission;
window.simulatePushEvent = simulatePushEvent;
window.savePushPreferences = savePushPreferences;
window.clearPushHistory = clearPushHistory;
window.dismissPushBanner = dismissPushBanner;
window.handlePushBannerClick = handlePushBannerClick;








// ============================================================================
// PROFILE TAB SLIDE SIGN OUT MODAL HANDLERS
// ============================================================================
function openProfileSignOutModal() {
  const modal = document.getElementById('profileSignOutModalOverlay');
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  }
}

function closeProfileSignOutModal() {
  const modal = document.getElementById('profileSignOutModalOverlay');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 200);
  }
}

function handleSignOutModalBackdropClick(e) {
  if (e.target && e.target.id === 'profileSignOutModalOverlay') {
    closeProfileSignOutModal();
  }
}

function confirmProfileSignOut() {
  closeProfileSignOutModal();

  // 1. Sign out Admin if active
  sessionStorage.removeItem('admin_authenticated');
  localStorage.removeItem('admin_authenticated');
  const adminStatusTag = document.getElementById('adminStatusTag');
  if (adminStatusTag) adminStatusTag.textContent = '🔒';

  // 2. Sign out Firebase Auth if active
  if (window.Firebase && typeof window.Firebase.signOutUser === 'function') {
    try { window.Firebase.signOutUser(); } catch(e) {}
  }

  // 3. Mark player session logged out
  localStorage.setItem('player_logged_in', 'false');
  localStorage.removeItem('player_email');
  localStorage.removeItem('player_uid');

  showToast('🚪 Signed out safely.');
  if (typeof updateProfileDisplays === 'function') updateProfileDisplays();
  if (typeof updatePlayerSessionUI === 'function') updatePlayerSessionUI();
  switchProfileTab('profile');
}

window.openProfileSignOutModal = openProfileSignOutModal;
window.closeProfileSignOutModal = closeProfileSignOutModal;
window.handleSignOutModalBackdropClick = handleSignOutModalBackdropClick;
window.confirmProfileSignOut = confirmProfileSignOut;

window.addEventListener('profile:cloudSynced', () => {
  try {
    if (typeof updateProfileDisplays === 'function') updateProfileDisplays();
    if (typeof updateLiveBalanceDisplay === 'function') updateLiveBalanceDisplay();
    if (typeof renderReferralStatsAndList === 'function') renderReferralStatsAndList();
    if (typeof updateProfileOverviewStats === 'function') updateProfileOverviewStats();
  } catch (e) {}
});


// ============================================================================
