import fs from "fs/promises";

const TOKEN = process.env.DISCORD_TOKEN;
const FORUM_ID = process.env.DISCORD_CHANNEL_ID;

if (!TOKEN) throw new Error("DISCORD_TOKEN missing");
if (!FORUM_ID) throw new Error("DISCORD_CHANNEL_ID missing");

const API = "https://discord.com/api/v10";

// ====== CONFIG ======
const PUBLIC_ID = 9;
const PUBLIC_NAME = "🅲🅽🅽-breaking-bad-news📰";
const PUBLIC_AVATAR_URL =
  "https://adzxwgaoozuoamqqwkcd.supabase.co/storage/v1/object/public/avatars/signal_1770110946500_z2pme";

// Discord limits
const THREADS_PAGE_LIMIT = 50;   // archived threads endpoint обычно max 50
const MESSAGES_LIMIT = 100;      // messages endpoint max 100
const ARCHIVE_PAGES_PUBLIC = 60; // 60*50 = до 3000 тредов
const ARCHIVE_PAGES_JOINED = 60; // иногда вытягивает больше старых
const MAX_THREADS_TO_PROCESS = 2500; // предохранитель для Actions

async function discordFetch(endpoint) {
  const url = `${API}${endpoint}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bot ${TOKEN}` }
  });

  const text = await res.text();
  if (!res.ok) {
    // Discord часто маскирует отсутствие доступа под 404
    throw new Error(`Discord API error ${res.status} on ${endpoint}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function safeFetch(endpoint, label) {
  try {
    return await discordFetch(endpoint);
  } catch (e) {
    console.warn(`[skip] ${label}: ${e.message}`);
    return null;
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

async function fetchActiveThreadsFromGuild(guildId, forumId) {
  const data = await safeFetch(`/guilds/${guildId}/threads/active`, "guild active threads");
  const threads = data?.threads || [];
  return threads.filter(t => String(t.parent_id) === String(forumId));
}

async function fetchArchivedThreadsGeneric(forumId, mode, maxPages) {
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

    // Для archived threads "before" — timestamp
    before = chunk[chunk.length - 1].archive_timestamp;

    if (all.length >= MAX_THREADS_TO_PROCESS) break;
  }

  return all;
}

async function fetchArchivedPublicThreadsFromForum(forumId) {
  return await fetchArchivedThreadsGeneric(forumId, "public", ARCHIVE_PAGES_PUBLIC);
}

async function fetchArchivedJoinedThreadsFromForum(forumId) {
  return await fetchArchivedThreadsGeneric(forumId, "joined", ARCHIVE_PAGES_JOINED);
}

async function fetchThreadAsPost(thread) {
  const threadId = thread.id;

  // ✅ STARTER MESSAGE — надёжно (для forum post: threadId == starter message id)
  const starter = await safeFetch(
    `/channels/${threadId}/messages/${threadId}`,
    `starter message ${threadId}`
  );

  // Если вдруг не получилось (редко), пробуем взять из ленты сообщений
  const msgs = await safeFetch(
    `/channels/${threadId}/messages?limit=${MESSAGES_LIMIT}`,
    `thread messages ${threadId}`
  ) || [];

  let starterMsg = starter;
  if (!starterMsg) {
    // Discord возвращает newest-first, поэтому "самое старое из полученных" — последний
    starterMsg = msgs.length ? msgs[msgs.length - 1] : null;
  }
  if (!starterMsg) return null;

  const comments = (msgs || [])
    .filter(m => m && m.id && m.id !== starterMsg.id)
    .map(normalizeComment);

  return {
    id: `discord:${threadId}`,
    source: "discord",

    public_id: PUBLIC_ID,
    public_name: PUBLIC_NAME,
    public_avatar_url: PUBLIC_AVATAR_URL,

    title: thread.name || (starterMsg.content ? starterMsg.content.slice(0, 80) : `POST ${threadId}`),
    content: starterMsg.content || "",
    image_url: pickImageFromMessage(starterMsg),

    created_at: starterMsg.timestamp,
    author_name: starterMsg.author?.username || "user",

    comments
  };
}

async function main() {
  console.log("Fetching Discord posts...");

  const ch = await discordFetch(`/channels/${FORUM_ID}`);
  console.log("Channel type:", ch?.type, "name:", ch?.name);

  if (ch?.type !== 15 && ch?.type !== 16) {
    throw new Error(`DISCORD_CHANNEL_ID is not a forum/media channel. type=${ch?.type}`);
  }

  const guildId = ch?.guild_id;
  if (!guildId) throw new Error("No guild_id on channel");

  const activeForumThreads = await fetchActiveThreadsFromGuild(guildId, FORUM_ID);
  console.log("Active forum threads =", activeForumThreads.length);

  const archivedPublic = await fetchArchivedPublicThreadsFromForum(FORUM_ID);
  console.log("Archived PUBLIC threads =", archivedPublic.length);

  const archivedJoined = await fetchArchivedJoinedThreadsFromForum(FORUM_ID);
  console.log("Archived JOINED threads =", archivedJoined.length);

  const uniq = new Map();
  for (const t of [...activeForumThreads, ...archivedPublic, ...archivedJoined]) uniq.set(t.id, t);

  let threads = [...uniq.values()];
  console.log("Total unique threads found =", threads.length);

  if (threads.length > MAX_THREADS_TO_PROCESS) {
    console.log(`Clamping threads from ${threads.length} to ${MAX_THREADS_TO_PROCESS}`);
    threads = threads.slice(0, MAX_THREADS_TO_PROCESS);
  }

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
