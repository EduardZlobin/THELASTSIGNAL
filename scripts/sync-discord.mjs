import fs from "fs/promises";

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!TOKEN) throw new Error("DISCORD_TOKEN missing");
if (!CHANNEL_ID) throw new Error("DISCORD_CHANNEL_ID missing");

const API = "https://discord.com/api/v10";

// ====== CONFIG ======
const PUBLIC_ID = 9; 
const PUBLIC_NAME = "🅲🅽🅽-breaking-bad-news📰";
const PUBLIC_AVATAR_URL = "https://adzxwgaoozuoamqqwkcd.supabase.co/storage/v1/object/public/avatars/signal_1770110946500_z2pme";

// Сколько тредов/сообщений тянуть
const THREADS_LIMIT = 50;
const MESSAGES_LIMIT = 100;

// ====== HELPERS ======
async function discordFetch(endpoint) {
  const url = `${API}${endpoint}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bot ${TOKEN}` }
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Discord API error ${res.status} on ${endpoint}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function pickImageFromMessage(msg) {
  return (
    msg?.attachments?.[0]?.url ||
    msg?.embeds?.find(e => e?.image?.url)?.image?.url ||
    msg?.embeds?.find(e => e?.thumbnail?.url)?.thumbnail?.url ||
    null
  );
}

function normalizeComment(m) {
  return {
    id: m.id,
    author_name: m.author?.username || "user",
    text: m.content || "",
    created_at: m.timestamp
  };
}

// ====== MODE A: Forum (threads/posts) ======
async function fetchForumPosts(forumId) {
  const posts = [];

  // 1) Активные треды
  let activeThreads = [];
  try {
    const active = await discordFetch(`/channels/${forumId}/threads/active`);
    activeThreads = active?.threads || [];
  } catch (e) {
    // Если тут 404 — странно, но лучше явно показать ошибку
    console.warn("Active threads fetch failed:", e.message);
    // не продолжаем, потому что форум без active threads обычно означает проблемы с endpoint/ID
    throw e;
  }

  // 2) Архивные треды (часто именно там лежит большинство)
  let archivedThreads = [];
  try {
    let before = null;
    for (let i = 0; i < 3; i++) {
      const url = before
        ? `/channels/${forumId}/threads/archived/public?limit=${THREADS_LIMIT}&before=${encodeURIComponent(before)}`
        : `/channels/${forumId}/threads/archived/public?limit=${THREADS_LIMIT}`;

      const arch = await discordFetch(url);
      const chunk = arch?.threads || [];
      archivedThreads.push(...chunk);

      if (!arch?.has_more || chunk.length === 0) break;
      before = chunk[chunk.length - 1].archive_timestamp;
    }
  } catch (e) {
    // ВАЖНО: тут мы НЕ валим sync, потому что на некоторых серверах/типах каналов
    // этот endpoint может вести себя странно.
    console.warn("Archived threads fetch skipped:", e.message);
    archivedThreads = [];
  }

  // 3) Уникальные треды (без дублей)
  const uniq = new Map();
  for (const t of [...activeThreads, ...archivedThreads]) uniq.set(t.id, t);
  const threads = [...uniq.values()];

  // 4) Для каждого треда берём starter + комментарии
  for (const thread of threads) {
    // 4.1) Пытаемся взять starter message напрямую (быстро и правильно),
    // но если 404 — используем fallback.
    let starter = null;

    try {
      starter = await discordFetch(`/channels/${thread.id}/messages/${thread.id}`);
    } catch (e) {
      // не продолжаем "continue" — сначала попробуем fallback из списка сообщений
      if (!String(e.message).includes("error 404")) {
        console.warn("Starter direct fetch failed (non-404):", thread.id, e.message);
      }
      starter = null;
    }

    // 4.2) Тянем сообщения треда
    let msgs = [];
    try {
      msgs = await discordFetch(`/channels/${thread.id}/messages?limit=${MESSAGES_LIMIT}`);
    } catch (e) {
      console.warn("Messages fetch failed for thread", thread.id, e.message);
      continue; // без сообщений тред не обработаем
    }

    // 4.3) FALLBACK: если starter не получили — берём самое старое сообщение из msgs
    // Discord обычно отдаёт от новых к старым, значит самое старое — последний элемент
    if (!starter) {
      starter = msgs[msgs.length - 1] || null;
    }
    if (!starter) continue;

    // 4.4) Комменты: всё кроме starter
    const comments = (msgs || [])
      .filter(m => m.id !== starter.id)
      .map(normalizeComment);

    posts.push({
      id: `discord:${thread.id}`,
      source: "discord",

      public_id: PUBLIC_ID,
      public_name: PUBLIC_NAME,
      public_avatar_url: PUBLIC_AVATAR_URL,

      title: thread.name,
      content: starter.content || "",
      image_url: pickImageFromMessage(starter),

      created_at: starter.timestamp,
      author_name: starter.author?.username || "user",

      comments
    });
  }

  return posts;
}

// ====== MODE B: Text channel (messages) ======
async function fetchTextChannelPosts(channelId) {
  const msgs = await discordFetch(`/channels/${channelId}/messages?limit=${MESSAGES_LIMIT}`);

  // Каждое сообщение = пост
  return (msgs || []).map(m => ({
    id: `discord:${m.id}`,
    source: "discord",

    public_id: PUBLIC_ID,
    public_name: PUBLIC_NAME,
    public_avatar_url: PUBLIC_AVATAR_URL,

    title: (m.content || "DISCORD MESSAGE").slice(0, 60),
    content: m.content || "",
    image_url: pickImageFromMessage(m),

    created_at: m.timestamp,
    author_name: m.author?.username || "user",

    comments: []
  }));
}

async function main() {
  console.log("Fetching Discord posts...");

  // 1) Проверяем что ID — это канал
  const ch = await discordFetch(`/channels/${CHANNEL_ID}`);
  console.log("Channel type:", ch?.type, "name:", ch?.name);

  // Channel types:
  // 0 = GUILD_TEXT
  // 5 = GUILD_NEWS
  // 15 = GUILD_FORUM
  // 16 = GUILD_MEDIA
  let posts = [];

  if (ch?.type === 15 || ch?.type === 16) {
    posts = await fetchForumPosts(CHANNEL_ID);
  } else if (ch?.type === 0 || ch?.type === 5) {
    posts = await fetchTextChannelPosts(CHANNEL_ID);
  } else {
    throw new Error(`Unsupported channel type: ${ch?.type}`);
  }

  // Сортируем по дате (на всякий)
  posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  await fs.writeFile("discord_posts.json", JSON.stringify(posts, null, 2));
  console.log(`Saved discord_posts.json (${posts.length} items)`);
}

main();
