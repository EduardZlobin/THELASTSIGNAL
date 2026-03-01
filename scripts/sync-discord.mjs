import fs from "fs/promises";

const TOKEN = process.env.DISCORD_TOKEN;
const FORUM_ID = process.env.DISCORD_CHANNEL_ID;

if (!TOKEN) throw new Error("DISCORD_TOKEN missing");
if (!FORUM_ID) throw new Error("DISCORD_CHANNEL_ID missing");

const API = "https://discord.com/api/v10";

// ====== CONFIG ======
const PUBLIC_ID = 9; // твой publics.id из Supabase
const PUBLIC_NAME = "🅲🅽🅽-breaking-bad-news📰";
const PUBLIC_AVATAR_URL =
  "https://adzxwgaoozuoamqqwkcd.supabase.co/storage/v1/object/public/avatars/signal_1770110946500_z2pme";

// Discord limits (реальные)
const THREADS_PAGE_LIMIT = 50; // archived threads endpoints обычно max 50
const MESSAGES_LIMIT = 100;    // messages endpoint max 100

// Сколько страниц архива листать: 30 страниц * 50 = до ~1500 старых тредов
const ARCHIVE_PAGES_PUBLIC = 40;
const ARCHIVE_PAGES_JOINED = 40;

// Предохранитель на количество тредов, чтобы workflow не умирал
const MAX_THREADS_TO_PROCESS = 1200;

// Если true — обрезаем ?ex=... у cdn.discordapp.com (иногда спасает от протухания)
const STRIP_CDN_QUERY = true;

async function discordFetch(endpoint) {
  const url = `${API}${endpoint}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bot ${TOKEN}` }
  });

  const text = await res.text();
  if (!res.ok) {
    // Discord часто маскирует доступ под 404
    throw new Error(`Discord API error ${res.status} on ${endpoint}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function stripQuery(url) {
  if (!url) return null;
  if (!STRIP_CDN_QUERY) return url;
  try {
    const u = new URL(url);
    // обычно протухают именно cdn.discordapp.com ссылки с query
    if (u.hostname.includes("cdn.discordapp.com")) {
      u.search = "";
      u.hash = "";
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

function pickImageFromMessage(msg) {
  const u =
    msg?.attachments?.[0]?.url ||
    msg?.embeds?.find(e => e?.image?.url)?.image?.url ||
    msg?.embeds?.find(e => e?.thumbnail?.url)?.thumbnail?.url ||
    null;

  return stripQuery(u);
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
  // Guild-level endpoint: часто доступен и даёт активные треды
  const data = await safeFetch(`/guilds/${guildId}/threads/active`, "guild active threads");
  const threads = data?.threads || [];
  return threads.filter(t => String(t.parent_id) === String(forumId));
}

async function fetchArchivedThreadsGeneric(forumId, mode, maxPages) {
  // mode: "public" | "joined"
  const all = [];
  let before = null;

  for (let page = 0; page < maxPages; page++) {
    const endpoint = before
      ? `/channels/${forumId}/threads/archived/${mode}?limit=${THREADS_PAGE_LIMIT}&before=${encodeURIComponent(before)}`
      : `/channels/${forumId}/threads/archived/${mode}?limit=${THREADS_PAGE_LIMIT}`;

    const arch = await safeFetch(endpoint, `archived ${mode} threads page ${page + 1}`);
    if (!arch) break;

    const chunk = arch?.threads || [];
    if (chunk.length === 0) break;

    all.push(...chunk);

    if (!arch?.has_more) break;

    // ВАЖНО: для archived threads "before" — timestamp (archive_timestamp)
    before = chunk[chunk.length - 1].archive_timestamp;

    // Предохранитель по количеству, чтобы не собирать “всё на свете”
    if (all.length >= MAX_THREADS_TO_PROCESS) break;
  }

  return all;
}

async function fetchArchivedPublicThreadsFromForum(forumId) {
  return await fetchArchivedThreadsGeneric(forumId, "public", ARCHIVE_PAGES_PUBLIC);
}

async function fetchArchivedJoinedThreadsFromForum(forumId) {
  // Может возвращать мало или 404 — safeFetch уже обработает
  return await fetchArchivedThreadsGeneric(forumId, "joined", ARCHIVE_PAGES_JOINED);
}

async function fetchThreadAsPost(thread) {
  const threadId = thread.id;

  // Тянем сообщения треда
  const msgs = await safeFetch(
    `/channels/${threadId}/messages?limit=${MESSAGES_LIMIT}`,
    `thread messages ${threadId}`
  );
  if (!msgs || msgs.length === 0) return null;

  // Стартер — самое старое сообщение (обычно последний элемент массива)
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

    title: thread.name || (starter.content ? starter.content.slice(0, 80) : `POST ${threadId}`),
    content: starter.content || "",
    image_url: pickImageFromMessage(starter),

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
  if (!guildId) throw new Error("No guild_id on channel (weird for forum)");

  // 2) Активные треды через guild endpoint
  const activeForumThreads = await fetchActiveThreadsFromGuild(guildId, FORUM_ID);
  console.log("Active forum threads (guild-level) =", activeForumThreads.length);

  // 3) Архив: public + joined (joined иногда вытягивает “старьё”, которое public не отдаёт)
  const archivedPublic = await fetchArchivedPublicThreadsFromForum(FORUM_ID);
  console.log("Archived PUBLIC threads =", archivedPublic.length);

  const archivedJoined = await fetchArchivedJoinedThreadsFromForum(FORUM_ID);
  console.log("Archived JOINED threads =", archivedJoined.length);

  // 4) Объединяем и unique по id
  const uniq = new Map();
  for (const t of [...activeForumThreads, ...archivedPublic, ...archivedJoined]) uniq.set(t.id, t);

  let threads = [...uniq.values()];
  console.log("Total unique threads found =", threads.length);

  // Предохранитель на обработку
  if (threads.length > MAX_THREADS_TO_PROCESS) {
    console.log(`Clamping threads from ${threads.length} to ${MAX_THREADS_TO_PROCESS}`);
    threads = threads.slice(0, MAX_THREADS_TO_PROCESS);
  }

  // 5) Тянем посты
  const posts = [];
  for (const thread of threads) {
    const post = await fetchThreadAsPost(thread);
    if (post) posts.push(post);
  }

  posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  await fs.writeFile("discord_posts.json", JSON.stringify(posts, null, 2));
  console.log(`Saved discord_posts.json (${posts.length} items)`);
}

main();
