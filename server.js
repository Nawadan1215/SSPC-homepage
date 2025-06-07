require("dotenv").config();
const Eris = require("eris");
const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.json());
app.use(express.static("."));

let client = null;
let cancelToken = null;
let discordToken = null;

// ルートでindex.htmlを返す
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

// トークン設定API
app.post("/set-token", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "トークンが必要です" });

  try {
    discordToken = token;
    client = new Eris(token, { 
      intents: ["all"], // 全てのインテントを有効化
      restMode: true 
    });
    client.on("ready", () => console.log("ユーザートークンで接続"));
    client.on("error", (err) => console.error("エラー:", err.message));
    client.connect();
    res.json({ message: "トークン設定完了" });
  } catch (err) {
    res.status(500).json({ error: `トークン設定エラー: ${err.message}` });
  }
});

// チャンネル一覧取得API
app.post("/get-channels", async (req, res) => {
  const { guildId } = req.body;
  if (!client || !guildId) {
    return res.status(400).json({ error: "クライアントまたはサーバーIDが必要です" });
  }
  try {
    const channels = await client.getRESTGuildChannels(guildId);
    const textChannels = channels
      .filter((channel) => channel.type === 0) // テキストチャンネルのみ
      .map((channel) => ({ id: channel.id, name: channel.name }));
    if (textChannels.length === 0) throw new Error("テキストチャンネルが見つかりません");
    res.json({ channels: textChannels });
  } catch (err) {
    res.status(500).json({
      error: `チャンネル取得エラー: ${err.message}. サーバーIDが正しいか、トークンに権限があるか確認してください。`,
    });
  }
});

// ユーザー一覧取得API
app.post("/get-users", async (req, res) => {
  const { guildId } = req.body;
  if (!client || !guildId) {
    return res.status(400).json({ error: "クライアントまたはサーバーIDが必要です" });
  }
  try {
    const members = await client.getRESTGuildMembers(guildId, { limit: 1000 });
    if (!members || members.length === 0) throw new Error("メンバーが取得できませんでした");
    const users = members.map((member) => ({
      id: member.user.id,
      username: member.user.username,
    }));
    res.json({ users });
  } catch (err) {
    res.status(500).json({
      error: `ユーザー取得エラー: ${err.message}. トークンにGUILD_MEMBERSインテントと閲覧権限があるか、Botがサーバーに参加しているか確認してください。`,
    });
  }
});

// メッセージ送信API（効率化：並列送信、スレッド作成）
app.post("/send-message", async (req, res) => {
  const {
    channelIds,
    message,
    mentionUserIds,
    repeatCount,
    interval,
    createThread,
    threadName,
  } = req.body;
  if (!client || !discordToken || !channelIds || !message) {
    return res.status(400).json({
      error: "クライアント、トークン、チャンネルID、メッセージが必要です",
    });
  }
  try {
    cancelToken = { cancelled: false };
    const mentionPrefix = mentionUserIds
      ? mentionUserIds
          .split(/[\n,]+/)
          .map((id) => id.trim())
          .filter((id) => id)
          .map((id) => `<@${id}>`)
          .join(" ") + " "
      : "";
    const finalMessage = mentionPrefix + message;
    const channelIdArray = channelIds
      .split(/[\n,]+/)
      .map((id) => id.trim())
      .filter((id) => id);
    const count = Math.max(1, Math.min(parseInt(repeatCount) || 1, 100));
    const delay = Math.max(500, Math.min(parseInt(interval) || 1000, 10000));
    const results = [];

    for (let i = 0; i < count && !cancelToken.cancelled; i++) {
      const sendPromises = channelIdArray.map(async (channelId) => {
        if (cancelToken.cancelled) return;
        try {
          const channel = await client.getRESTChannel(channelId);
          if (!channel || channel.type !== 0) {
            throw new Error(`チャンネル ${channelId} はテキストチャンネルではありません`);
          }
          if (createThread) {
            const threadResponse = await client.createGuildChannel(channel.guild_id, {
              name: threadName || `スレッド ${new Date().toISOString().split("T")[0]}`,
              type: 11, // 公開スレッド
              parent_id: channelId,
              auto_archive_duration: 1440,
            });
            await client.createMessage(threadResponse.id, finalMessage);
            return `スレッド ${threadResponse.id} に送信（${i + 1}回目）`;
          } else {
            await client.createMessage(channelId, finalMessage);
            return `チャンネル ${channelId} に送信（${i + 1}回目）`;
          }
        } catch (err) {
          return `チャンネル ${channelId} でエラー: ${err.message}. トークンにスレッド作成権限があるか確認してください。`;
        }
      });
      const batchResults = await Promise.all(sendPromises);
      results.push(...batchResults.filter((result) => result));
      if (i < count - 1 && !cancelToken.cancelled) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    if (cancelToken.cancelled) {
      results.push("送信が停止されました");
    }
    res.json({ message: results.join(", ") });
  } catch (err) {
    res.status(500).json({
      error: `送信エラー: ${err.message}. チャンネルIDやスレッド作成権限を確認してください。`,
    });
  }
});

// 送信停止API
app.post("/stop-sending", (req, res) => {
  if (cancelToken) {
    cancelToken.cancelled = true;
    res.json({ message: "送信を停止しました" });
  } else {
    res.json({ message: "送信中のタスクはありません" });
  }
});

app.listen(3000, () => console.log("サーバー起動: http://localhost:3000"));
