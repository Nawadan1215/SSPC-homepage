let sendInterval = null;

async function setToken() {
  const token = document.getElementById("token").value.trim();
  const response = await fetch("/set-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const result = await response.json();
  document.getElementById("status").textContent = result.message || result.error;
}

async function getChannels() {
  const guildId = document.getElementById("guildId").value.trim();
  if (!guildId) {
    document.getElementById("status").textContent = "サーバーIDを入力してください";
    return;
  }
  const response = await fetch("/get-channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId }),
  });
  const result = await response.json();
  if (result.error) {
    document.getElementById("status").textContent = result.error;
    return;
  }
  const channelIdText = result.channels.map((ch) => ch.id).join("\n");
  document.getElementById("channelId").value = channelIdText;
  document.getElementById("status").textContent = "チャンネル一覧を取得しました";
}

async function getUsers() {
  const guildId = document.getElementById("guildId").value.trim();
  if (!guildId) {
    document.getElementById("status").textContent = "サーバーIDを入力してください";
    return;
  }
  const response = await fetch("/get-users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId }),
  });
  const result = await response.json();
  if (result.error) {
    document.getElementById("status").textContent = result.error;
    return;
  }
  const userIdText = result.users.map((user) => user.id).join("\n");
  document.getElementById("mentionUserId").value = userIdText;
  document.getElementById("status").textContent = "ユーザー一覧を取得しました";
}

async function sendMessage() {
  const channelIds = document.getElementById("channelId").value;
  const message = document.getElementById("message").value;
  const mentionUserIds = document.getElementById("mentionUserId").value;
  const repeatCount = document.getElementById("repeatCount").value;
  const interval = document.getElementById("interval").value;
  const createThread = document.getElementById("createThread").checked;
  const threadName = document.getElementById("threadName").value;
  if (!channelIds || !message) {
    document.getElementById("status").textContent = "チャンネルIDとメッセージを入力してください";
    return;
  }
  document.getElementById("status").textContent = "送信中...";
  const response = await fetch("/send-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channelIds,
      message,
      mentionUserIds,
      repeatCount,
      interval: interval * 1000,
      createThread,
      threadName,
    }),
  });
  const result = await response.json();
  document.getElementById("status").textContent = result.message || result.error;
}

async function stopSending() {
  const response = await fetch("/stop-sending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const result = await response.json();
  document.getElementById("status").textContent = result.message;
}

document.querySelectorAll("button, input, textarea").forEach(el => el.setAttribute("tabindex", "0"));
