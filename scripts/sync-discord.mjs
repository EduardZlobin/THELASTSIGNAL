import fs from "fs/promises";

const TOKEN = process.env.DISCORD_TOKEN;
const FORUM_ID = process.env.DISCORD_CHANNEL_ID;

if (!TOKEN) throw new Error("DISCORD_TOKEN missing");
if (!FORUM_ID) throw new Error("DISCORD_CHANNEL_ID missing");

const API = "https://discord.com/api/v10";

// ====== CONFIG ======
const PUBLIC_ID = 9; // <-- твой publics.id из Supabase
const PUBLIC_NAME = "🅲🅽🅽-breaking-bad-news📰";
const PUBLIC_AVATAR_URL = "https://adzxwgaoozuoamqqwkcd.supabase.co/storage/v1/object/public/avatars/signal_1770110946500_z2pme";

const THREADS_PAGE_LIMIT = 50;

// Сколько страниц архива листать (50 тредов на страницу).
// 20 страниц = до ~1000 старых постов.
const ARCHIVE_PAGES = 20;

// Максимум сколько постов сохранять в json (чтобы файл не раздувался)
const MAX_POSTS = 500;
const MESSAGES_LIMIT = 100;
// сколько страниц архивных тредов пробовать (на всякий)


async function discordFetch(endpoint) {
  const url = `${API}${endpoint}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bot ${TOKEN}` }
  });

  const text = await res.text();
  if (!res.ok) {
    // Discord любит маскировать отсутствие доступа под 404
    throw new Error(`Discord API error ${res.status} on ${endpoint}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function stripQuery(url) {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
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

async function safeFetch(endpoint, label) {
  try {
    return await discordFetch(endpoint);
  } catch (e) {
    console.warn(`[skip] ${label}: ${e.message}`);
    return null;
  }
}

async function fetchActiveThreadsFromGuild(guildId, forumId) {
  // Guild-level endpoint: чаще доступен, даже когда channel threads endpoints чудят
  const data = await discordFetch(`/guilds/${guildId}/threads/active`);
  const threads = data?.threads || [];
  // parent_id у тредов = id форума (для forum posts)
  const forumThreads = threads.filter(t => String(t.parent_id) === String(forumId));
  return forumThreads;
}

async function fetchArchivedThreadsFromForum(forumId) {
  const all = [];
  let before = null;

  for (let i = 0; i < ARCHIVE_PAGES; i++) {
    const endpoint = before
      ? `/channels/${forumId}/threads/archived/public?limit=${THREADS_PAGE_LIMIT}&before=${encodeURIComponent(before)}`
      : `/channels/${forumId}/threads/archived/public?limit=${THREADS_PAGE_LIMIT}`;

    const arch = await safeFetch(endpoint, `archived threads page ${i + 1}`);
    if (!arch) break;

    const chunk = arch?.threads || [];
    all.push(...chunk);

    if (!arch?.has_more || chunk.length === 0) break;

    // двигаемся дальше в прошлое
    before = chunk[chunk.length - 1].archive_timestamp;

    // если уже набрали много — можно стопать рано
    if (all.length >= MAX_POSTS) break;
  }

  return all;
}


async function fetchThreadAsPost(thread, forumId) {
  const threadId = thread.id;

  // тянем сообщения треда
  const msgs = await safeFetch(`/channels/${threadId}/messages?limit=${MESSAGES_LIMIT}`, `thread messages ${threadId}`);
  if (!msgs || msgs.length === 0) return null;

  // starter — самое старое сообщение (обычно последний элемент массива)
  const starter = msgs[msgs.length - 1];
  const comments = msgs
    .filter(m => m.id !== starter.id)
    .map(normalizeComment);

  return {
    id: `discord:${threadId}`,
    source: "discord",

    public_id: PUBLIC_ID,
    public_name: PUBLIC_NAME,
    public_avatar_url: PUBLIC_AVATAR_URL,

    // для форума лучше брать имя треда как заголовок
    title: thread.name || (starter.content ? starter.content.slice(0, 80) : `POST ${threadId}`),
    content: starter.content || "",
    image_url: (() => {
  const u = pickImageFromMessage(starter);
  return u ? stripQuery(u) : null;
})(),

    created_at: starter.timestamp,
    author_name: starter.author?.username || "user",

    comments
  };
}

async function main() {
  console.log("Fetching Discord posts...");

  // 1) Считываем канал форума
  const ch = await discordFetch(`/channels/${FORUM_ID}`);
  console.log("Channel type:", ch?.type, "name:", ch?.name);

  if (ch?.type !== 15 && ch?.type !== 16) {
    throw new Error(`DISCORD_CHANNEL_ID is not a forum/media channel. type=${ch?.type}`);
  }

  const guildId = ch?.guild_id;
  if (!guildId) throw new Error("No guild_id on channel (is it a DM? weird for forum)");

  // 2) Активные треды через guild endpoint
  const activeForumThreads = await fetchActiveThreadsFromGuild(guildId, FORUM_ID);
  console.log("Active forum threads (guild-level) =", activeForumThreads.length);

  // 3) Архивные треды форума (если доступно)
  const archivedForumThreads = await fetchArchivedThreadsFromForum(FORUM_ID);
  console.log("Archived forum threads =", archivedForumThreads.length);

  // 4) Объединяем и делаем unique по id
  const uniq = new Map();
  for (const t of [...activeForumThreads, ...archivedForumThreads]) uniq.set(t.id, t);
  let threads = [...uniq.values()];
  threads.sort((a, b) => new Date(b.archive_timestamp || b.last_message_id || 0) - new Date(a.archive_timestamp || a.last_message_id || 0));
  threads = threads.slice(0, MAX_POSTS);

  console.log("Total unique threads to process =", threads.length);

  // 5) Тянем посты
  const posts = [];
  for (const thread of threads) {
    const post = await fetchThreadAsPost(thread, FORUM_ID);
    if (post) posts.push(post);
  }

  posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  await fs.writeFile("discord_posts.json", JSON.stringify(posts, null, 2));
  console.log(`Saved discord_posts.json (${posts.length} items)`);
}

main();
