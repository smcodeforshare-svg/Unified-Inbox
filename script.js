const filters = ["All", "Unread", "WhatsApp", "Instagram", "Telegram", "Messenger", "Signal", "SMS"];

const appMeta = {
  WhatsApp: { label: "WhatsApp", icon: "💬", color: "#25D366" },
  Instagram: { label: "Instagram", icon: "📸", color: "#E1306C" },
  Telegram: { label: "Telegram", icon: "✈️", color: "#0088CC" },
  Messenger: { label: "Messenger", icon: "💬", color: "#00B2FF" },
  Signal: { label: "Signal", icon: "🔒", color: "#3A76F0" },
  SMS: { label: "SMS", icon: "📱", color: "#64748b" }
};

/**
 * ─────────────────────────────────────────────
 *  WEB NOTIFICATION API
 *  Shows system-level browser notifications
 *  when real notification data is received
 * ─────────────────────────────────────────────
 */

// Request permission for browser notifications on init
function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("Web Notification API not supported");
    return;
  }
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// Show a system browser notification
function showBrowserNotification(title, options) {
  if (!("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, options);
      notif.onclick = function () {
        window.focus();
        this.close();
      };
      return true;
    } catch (e) {
      console.warn("Browser notification failed:", e);
      return false;
    }
  }
  return false;
}

/**
 * ─────────────────────────────────────────────
 *  REAL NOTIFICATION BRIDGE
 *  Android wrapper app injects notifications
 *  via JavaScriptInterface (AndroidBridge)
 *  or window.postMessage
 * ─────────────────────────────────────────────
 */

// Called by Android WebView's JavaScriptInterface
window.AndroidBridge = {
  onNotification: function (jsonData) {
    try {
      const notification = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
      handleRealNotification(notification);
    } catch (e) {
      console.error("AndroidBridge.onNotification parse error:", e);
    }
  },
  onNotificationsBatch: function (jsonArray) {
    try {
      const notifications = typeof jsonArray === "string" ? JSON.parse(jsonArray) : jsonArray;
      if (Array.isArray(notifications)) {
        notifications.forEach((n) => handleRealNotification(n));
      }
    } catch (e) {
      console.error("AndroidBridge.onNotificationsBatch parse error:", e);
    }
  }
};

// Listen for postMessage from Android WebView or parent frame
window.addEventListener("message", function (event) {
  if (!event.data) return;

  const data = event.data;

  if (data.type === "notification" && data.payload) {
    handleRealNotification(data.payload);
  } else if (data.type === "notificationsBatch" && Array.isArray(data.payload)) {
    data.payload.forEach((n) => handleRealNotification(n));
  } else {
    if (data.app && data.message) {
      handleRealNotification(data);
    }
  }
});

/**
 * ─────────────────────────────────────────────
 *  NOTIFICATION FORMAT EXPECTED FROM ANDROID:
 *  {
 *    id: "unique-string-id",       // optional
 *    app: "WhatsApp",               // required
 *    sender: "Contact Name",        // required
 *    message: "Message text",       // required
 *    time: "10:30 AM" | null,       // optional
 *    unreadCount: 1,                // optional
 *    packageName: "com.whatsapp"    // optional
 *  }
 * ─────────────────────────────────────────────
 */

const chats = [];

const state = {
  activeFilter: "All",
  searchTerm: "",
  activeChatId: null,
  activeNotification: null,
  theme: localStorage.getItem("unified-inbox-theme") || "dark"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function init() {
  document.documentElement.setAttribute("data-theme", state.theme);
  renderFilters();
  renderChatList();
  bindEvents();
  updateEmptyState();
  requestNotificationPermission();
  showToast("Listening for real notifications…");

  // Check for test URL parameter: ?test=1
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("test") === "1") {
    injectTestNotifications();
  }

  notifyAndroidReady();
}

function injectTestNotifications() {
  const testNotifications = [
    { app: "WhatsApp", sender: "Priya Sharma", message: "Hey! Are you coming to the meeting?", time: "10:30 AM" },
    { app: "Instagram", sender: "Rahul Verma", message: "Liked your photo! ❤️", time: "10:15 AM" },
    { app: "Telegram", sender: "Ananya Gupta", message: "The project files are updated.", time: "9:45 AM" },
    { app: "SMS", sender: "+91 98765 43210", message: "Your OTP is 48291", time: "9:30 AM" }
  ];

  let delay = 500;
  testNotifications.forEach((n) => {
    setTimeout(() => handleRealNotification(n), delay);
    delay += 2000;
  });
  showToast("Injecting test notifications…");
}

function notifyAndroidReady() {
  if (window.AndroidBridge && typeof window.AndroidBridge.onWebAppReady === "function") {
    window.AndroidBridge.onWebAppReady();
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "webAppReady", payload: { version: "1.0" } }, "*");
  }
}

function handleRealNotification(notification) {
  if (!notification || !notification.sender || !notification.message) {
    console.warn("Invalid notification received:", notification);
    return;
  }

  const appName = normalizeAppName(notification.app || "WhatsApp");
  const senderName = notification.sender.trim();
  const messageText = notification.message.trim();
  const now = new Date();
  const timeStr = notification.time || formatTime(now);
  const notificationId = notification.id || `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Find existing chat by sender + app combination
  let chat = chats.find((c) => c.name.toLowerCase() === senderName.toLowerCase() && c.app === appName);

  if (!chat) {
    chat = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: senderName,
      app: appName,
      appIcon: appMeta[appName]?.icon || "💬",
      profile: createAvatarDataUri(senderName, chats.length + 1),
      message: messageText,
      time: timeStr,
      unreadCount: notification.unreadCount || 1,
      favorite: false,
      pinned: false,
      online: true,
      readStatus: "delivered",
      archived: false,
      messages: [],
      packageName: notification.packageName || null,
      notificationId: notificationId
    };
    chat.messages.push({ type: "received", text: messageText, time: timeStr });
    chats.unshift(chat);
  } else {
    chat.message = messageText;
    chat.time = timeStr;
    chat.unreadCount = (chat.unreadCount || 0) + (notification.unreadCount || 1);
    chat.readStatus = "delivered";
    chat.online = true;
    chat.messages.push({ type: "received", text: messageText, time: timeStr });
    if (notification.packageName) {
      chat.packageName = notification.packageName;
    }
    const idx = chats.indexOf(chat);
    if (idx > 0) {
      chats.splice(idx, 1);
      chats.unshift(chat);
    }
  }

  renderChatList();
  updateEmptyState();
  showToast(`New message from ${senderName}`);

  if (state.activeChatId === chat.id) {
    openConversation(chat.id);
  }

  // Show in-app notification popup
  showNotificationPopup(chat);

  // Show system-level browser notification (Web Notification API)
  const appLabel = appMeta[appName]?.label || appName;
  showBrowserNotification(`${senderName} via ${appLabel}`, {
    body: messageText,
    icon: chat.profile,
    tag: notificationId,
    vibrate: [200, 100, 200]
  });
}

function showNotificationPopup(chat) {
  state.activeNotification = {
    chatId: chat.id,
    notificationId: chat.notificationId || `N-${chat.id}`,
    sender: chat.name,
    profile: chat.profile,
    app: chat.app,
    appIcon: chat.appIcon,
    message: chat.message,
    time: chat.time,
    readStatus: chat.readStatus,
    unreadCount: chat.unreadCount,
    packageName: chat.packageName,
    pendingIntent: `chat://${chat.name.toLowerCase()}`
  };

  $("#notificationSender").textContent = state.activeNotification.sender;
  $("#notificationMeta").textContent = `${state.activeNotification.app} • ${state.activeNotification.time}`;
  $("#notificationMessage").textContent = state.activeNotification.message;
  $("#notificationId").textContent = `ID: ${state.activeNotification.notificationId}`;
  $("#notificationStatus").textContent = `Status: ${state.activeNotification.readStatus}`;
  $("#notificationProfile").innerHTML = `<img src="${state.activeNotification.profile}" alt="${state.activeNotification.sender}" />`;
  $("#notificationOverlay").classList.remove("hidden");
}

function createAvatarDataUri(name, seed) {
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const palette = ["#4f46e5", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"];
  const colorA = palette[seed % palette.length];
  const colorB = palette[(seed + 2) % palette.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" rx="64" fill="url(#g)" />
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colorA}" />
          <stop offset="100%" stop-color="${colorB}" />
        </linearGradient>
      </defs>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="96" fill="white">${initials}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function formatTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function bindEvents() {
  $("#searchInput").addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    renderChatList();
  });

  $("#filterRow").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.activeFilter = button.dataset.filter;
    renderFilters();
    renderChatList();
  });

  $("#chatList").addEventListener("click", handleChatListClick);
  $("#chatList").addEventListener("pointerdown", handleCardPointerDown);
  $("#chatList").addEventListener("pointermove", handleCardPointerMove);
  $("#chatList").addEventListener("pointerup", handleCardPointerUp);
  $("#chatList").addEventListener("touchstart", handlePullStart, { passive: true });
  $("#chatList").addEventListener("touchmove", handlePullMove, { passive: true });
  $("#chatList").addEventListener("touchend", handlePullEnd);
  $("#homeButton").addEventListener("click", () => showScreen("home"));
  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#refreshButton").addEventListener("click", refreshInbox);
  $("#fabButton").addEventListener("click", () => showToast("Listening for incoming notifications…"));
  $("#scrollTopButton").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  $("#backButton").addEventListener("click", () => showScreen("home"));
  $("#sendButton").addEventListener("click", sendMessage);
  $("#messageInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendMessage();
  });
  $("#favoriteButton").addEventListener("click", toggleFavorite);
  $("#archiveButton").addEventListener("click", archiveConversation);
  $("#deleteButton").addEventListener("click", deleteConversation);
  $("#closeAppOverlay").addEventListener("click", closeOverlay);
  $("#closeNotificationBtn").addEventListener("click", closeNotification);
  $("#dismissNotificationBtn").addEventListener("click", dismissNotification);
  $("#launchRealAppBtn").addEventListener("click", launchActiveNotificationApp);
  $("#openConversationBtn").addEventListener("click", openNotificationConversation);
  $("#appOverlay").addEventListener("click", (event) => {
    if (event.target.id === "appOverlay") closeOverlay();
  });
  $("#notificationOverlay").addEventListener("click", (event) => {
    if (event.target.id === "notificationOverlay") closeNotification();
  });
  window.addEventListener("scroll", handleScroll);
  document.addEventListener("keydown", handleKeyboardShortcuts);
}

function renderFilters() {
  $("#filterRow").innerHTML = filters.map((filter) => {
    const active = state.activeFilter === filter;
    return `<button class="filter-chip ${active ? "active" : ""}" data-filter="${filter}">${filter}</button>`;
  }).join("");
}

function renderChatList() {
  const filteredChats = getFilteredChats();
  const chatList = $("#chatList");
  const emptyState = $("#emptyState");
  const resultsCount = $("#resultsCount");
  resultsCount.textContent = `${filteredChats.length} ${filteredChats.length === 1 ? "chat" : "chats"}`;

  if (filteredChats.length === 0) {
    chatList.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  chatList.innerHTML = filteredChats.map((chat) => {
    const statusIcon = renderStatusIcon(chat.readStatus);
    const appMetaInfo = appMeta[chat.app];
    return `
      <article class="chat-card ${chat.unreadCount > 0 ? "unread" : ""}" data-chat-id="${chat.id}">
        <div class="profile-wrap">
          <img class="avatar" src="${chat.profile}" alt="${chat.name}" />
          <div class="app-icon-badge" title="${chat.app}">${chat.appIcon}</div>
        </div>
        <div class="chat-meta">
          <div class="chat-title-row">
            <span class="chat-title">${chat.name}</span>
            ${chat.favorite ? '<span class="star">★</span>' : ""}
            ${chat.pinned ? '<span class="pin-icon">📌</span>' : ""}
            ${chat.online ? '<span class="badge-dot"></span>' : ""}
          </div>
          <p class="chat-preview">${chat.message}</p>
          <div class="chat-footer">
            <div class="status-row">
              <span class="status-icon">${statusIcon}</span>
              <span>${chat.time}</span>
            </div>
            <span class="chat-app">${appMetaInfo.label}</span>
          </div>
        </div>
        <div class="chat-actions">
          ${chat.unreadCount > 0 ? `<span class="unread-badge">${chat.unreadCount}</span>` : ""}
          <button class="view-btn" data-view-message="${chat.id}">View Message</button>
        </div>
      </article>
    `;
  }).join("");
}

function getFilteredChats() {
  return chats.filter((chat) => {
    const matchesFilter = state.activeFilter === "All"
      ? true
      : state.activeFilter === "Unread"
        ? chat.unreadCount > 0
        : chat.app === state.activeFilter;

    const query = state.searchTerm;
    const matchesSearch = !query || [chat.name, chat.app, chat.message].some((value) => value.toLowerCase().includes(query));

    return !chat.archived && matchesFilter && matchesSearch;
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned));
}

function updateEmptyState() {
  const emptyState = $("#emptyState");
  if (chats.length === 0) {
    emptyState.classList.remove("hidden");
    emptyState.innerHTML = `
      <div class="empty-icon">🔔</div>
      <h3>No notifications yet</h3>
      <p>Waiting for real notifications from your Android device.</p>
      <p style="font-size:0.85rem;margin-top:8px;opacity:0.7">Add <code>?test=1</code> to URL to test with sample notifications</p>
    `;
  } else {
    emptyState.classList.add("hidden");
  }
}

function handleChatListClick(event) {
  const chatCard = event.target.closest(".chat-card");
  if (!chatCard) return;

  const appBadge = event.target.closest(".app-icon-badge");
  if (appBadge) {
    event.stopPropagation();
    const chatId = Number(chatCard.dataset.chatId);
    const chat = chats.find((item) => item.id === chatId);
    if (chat) {
      launchExternalApp(chat);
      showAppOverlay(chat);
    }
    return;
  }

  const viewButton = event.target.closest("[data-view-message]");
  if (viewButton) {
    const chatId = Number(viewButton.dataset.viewMessage);
    const chat = chats.find((item) => item.id === chatId);
    if (chat) showNotificationPopup(chat);
    return;
  }

  const chatId = Number(chatCard.dataset.chatId);
  openConversation(chatId);
}

function openConversation(chatId) {
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) return;

  state.activeChatId = chatId;
  $("#conversationMessages").innerHTML = chat.messages.map((message) => `
    <div class="message-bubble ${message.type === "sent" ? "sent" : ""}">
      <div>${message.text}</div>
      <div class="message-meta">
        <span>${message.time}</span>
        ${message.readStatus ? `<span>${renderStatusIcon(message.readStatus)}</span>` : ""}
      </div>
    </div>
  `).join("");

  $("#conversationProfile").innerHTML = `
    <img src="${chat.profile}" alt="${chat.name}" />
    <div>
      <strong>${chat.name}</strong>
      <div class="eyebrow">${chat.app} • ${chat.online ? "Online" : "Away"}</div>
    </div>
  `;
  updateConversationActions();
  $("#messageInput").value = "";
  showScreen("conversation");
}

function sendMessage() {
  const input = $("#messageInput");
  const text = input.value.trim();
  if (!text || state.activeChatId === null) return;
  const chat = chats.find((item) => item.id === state.activeChatId);
  if (!chat) return;

  chat.messages.push({ type: "sent", text, time: "Now", readStatus: "read" });
  chat.message = text;
  chat.time = "Now";
  chat.readStatus = "read";
  renderChatList();
  openConversation(state.activeChatId);
  showToast("Message sent");
  input.value = "";
  toggleTypingIndicator(true);
  setTimeout(() => toggleTypingIndicator(false), 1000);
}

function closeNotification() {
  $("#notificationOverlay").classList.add("hidden");
  state.activeNotification = null;
}

function dismissNotification() {
  if (!state.activeNotification) return;
  closeNotification();
  showToast("Notification dismissed");
}

function openNotificationConversation() {
  if (!state.activeNotification) return;
  const chat = chats.find((item) => item.name === state.activeNotification.sender);
  closeNotification();
  if (chat) openConversation(chat.id);
}

function showAppOverlay(chat) {
  const packageName = chat.packageName || "";
  $("#appOverlayTitle").textContent = `Open ${chat.app}`;
  $("#appOverlayContent").innerHTML = `
    <div>
      <div class="hero-badge">${chat.appIcon}</div>
      <h4>${appMeta[chat.app]?.label || chat.app}</h4>
      <p>This will try to open the real app on your device.</p>
      ${packageName ? `<p class="package-info">Package: ${packageName}</p>` : ""}
    </div>
  `;
  $("#appOverlay").classList.remove("hidden");
}

function launchActiveNotificationApp() {
  if (!state.activeNotification) return;
  const chat = chats.find((item) => item.id === state.activeNotification.chatId);
  if (!chat) return;
  launchExternalApp(chat);
}

function normalizeAppName(appName) {
  const normalized = String(appName || "").toLowerCase();
  const mapping = {
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    telegram: "Telegram",
    messenger: "Messenger",
    signal: "Signal",
    sms: "SMS"
  };
  return mapping[normalized] || appName || "WhatsApp";
}

function launchExternalApp(chat) {
  const selectedApp = normalizeAppName(chat.app);

  if (window.AndroidBridge && typeof window.AndroidBridge.launchApp === "function") {
    try {
      window.AndroidBridge.launchApp(chat.packageName || selectedApp, chat.name);
      showToast(`Opening ${selectedApp} via Android`);
      return true;
    } catch (e) {
      console.warn("AndroidBridge.launchApp failed:", e);
    }
  }

  const deeplink = getDeepLink(selectedApp, chat.name);
  if (!deeplink) {
    showToast("Cannot open app from browser. Android wrapper will handle this.");
    return false;
  }

  try {
    window.location.href = deeplink;
    showToast(`Opening ${selectedApp}`);
    return true;
  } catch (error) {
    showToast(`Cannot open ${selectedApp} directly`);
    return false;
  }
}

function getDeepLink(app, contactName) {
  const links = {
    WhatsApp: "whatsapp://",
    Instagram: "instagram://",
    Telegram: "tg://",
    Messenger: "fb-messenger://",
    Signal: "signal://",
    SMS: "sms:"
  };
  return links[app] || null;
}

function getFallbackUrl(app, target, name, message) {
  const encodedName = encodeURIComponent(name || "Contact");
  const encodedMessage = encodeURIComponent(message || `Hi ${name || "there"}`);
  const fallbacks = {
    WhatsApp: `https://wa.me/${encodeURIComponent(target)}?text=${encodedMessage}`,
    Instagram: `https://www.instagram.com/${encodeURIComponent(target)}/`,
    Telegram: `https://t.me/${encodeURIComponent(target)}`,
    Messenger: `https://m.me/${encodeURIComponent(target)}`,
    Signal: `https://signal.me/#p/${encodeURIComponent(target)}`,
    SMS: `sms:${encodeURIComponent(target)}?body=${encodedMessage}`
  };
  return fallbacks[app] || "";
}

function showScreen(screen) {
  $$('.screen').forEach((item) => item.classList.remove("active"));
  if (screen === "home") {
    $("#homeScreen").classList.add("active");
    $("#conversationScreen").classList.remove("active");
  } else {
    $("#conversationScreen").classList.add("active");
    $("#homeScreen").classList.remove("active");
  }
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", state.theme);
  localStorage.setItem("unified-inbox-theme", state.theme);
  $("#themeIcon").textContent = state.theme === "dark" ? "🌙" : "☀️";
  showToast(state.theme === "dark" ? "Dark mode enabled" : "Light mode enabled");
}

function refreshInbox() {
  const indicator = $("#refreshIndicator");
  indicator.textContent = "Refreshing…";
  indicator.classList.add("refreshing");
  setTimeout(() => {
    indicator.textContent = "Pull to refresh";
    indicator.classList.remove("refreshing");
    renderChatList();
    updateEmptyState();
    showToast("Inbox refreshed");
  }, 900);
}

function updateConversationActions() {
  const chat = chats.find((item) => item.id === state.activeChatId);
  if (!chat) return;
  $("#favoriteButton").classList.toggle("active", chat.favorite);
  $("#archiveButton").classList.toggle("active", chat.archived);
}

function toggleFavorite() {
  const chat = chats.find((item) => item.id === state.activeChatId);
  if (!chat) return;
  chat.favorite = !chat.favorite;
  renderChatList();
  updateConversationActions();
  showToast(chat.favorite ? "Added to favourites" : "Removed from favourites");
}

function archiveConversation() {
  const chat = chats.find((item) => item.id === state.activeChatId);
  if (!chat) return;
  const card = document.querySelector(`[data-chat-id="${chat.id}"]`);
  if (card) card.classList.add("is-archiving");
  setTimeout(() => {
    chat.archived = true;
    renderChatList();
    updateConversationActions();
    showToast("Conversation archived");
    showScreen("home");
  }, 260);
}

function deleteConversation() {
  const chat = chats.find((item) => item.id === state.activeChatId);
  if (!chat) return;
  const card = document.querySelector(`[data-chat-id="${chat.id}"]`);
  if (card) card.classList.add("is-deleting");
  setTimeout(() => {
    const index = chats.findIndex((item) => item.id === chat.id);
    if (index >= 0) chats.splice(index, 1);
    renderChatList();
    updateEmptyState();
    showToast("Conversation deleted");
    showScreen("home");
  }, 260);
}

function renderStatusIcon(status) {
  if (status === "read") return "✓✓";
  if (status === "delivered") return "✓✓";
  if (status === "sent") return "✓";
  return "•";
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 1800);
}

function handleScroll() {
  $("#scrollTopButton").style.display = window.scrollY > 260 ? "grid" : "none";
}

function handleKeyboardShortcuts(event) {
  if (event.ctrlKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    $("#searchInput").focus();
  }
  if (event.key === "Escape") {
    closeNotification();
    closeOverlay();
    showScreen("home");
  }
  if (event.ctrlKey && event.key.toLowerCase() === "d") {
    event.preventDefault();
    toggleTheme();
  }
}

function closeOverlay() {
  $("#appOverlay").classList.add("hidden");
}

function toggleTypingIndicator(show) {
  const indicator = $("#typingIndicator");
  indicator.classList.toggle("hidden", !show);
}

let pullStartY = 0;
let swipeState = null;

function handlePullStart(event) {
  if (window.scrollY > 0) return;
  pullStartY = event.touches[0].clientY;
}

function handlePullMove(event) {
  if (window.scrollY > 0) return;
  const delta = event.touches[0].clientY - pullStartY;
  if (delta > 0) {
    const indicator = $("#refreshIndicator");
    indicator.textContent = delta > 80 ? "Release to refresh" : "Pull to refresh";
    indicator.classList.toggle("refreshing", delta > 70);
  }
}

function handlePullEnd(event) {
  if (window.scrollY > 0) return;
  const delta = event.changedTouches[0].clientY - pullStartY;
  if (delta > 90) refreshInbox();
}

function handleCardPointerDown(event) {
  const card = event.target.closest(".chat-card");
  if (!card) return;
  swipeState = { card, startX: event.clientX };
}

function handleCardPointerMove(event) {
  if (!swipeState) return;
  const deltaX = event.clientX - swipeState.startX;
  if (Math.abs(deltaX) > 6) {
    swipeState.card.classList.add("is-swiping");
    swipeState.card.style.transform = `translateX(${Math.max(-90, Math.min(90, deltaX))}px)`;
  }
}

function handleCardPointerUp(event) {
  if (!swipeState) return;
  const deltaX = event.clientX - swipeState.startX;
  swipeState.card.classList.remove("is-swiping");
  swipeState.card.style.transform = "";
  if (Math.abs(deltaX) > 70) {
    showToast(deltaX < 0 ? "Archiving…" : "Mark as read…");
  }
  swipeState = null;
}

window.addEventListener("DOMContentLoaded", init);