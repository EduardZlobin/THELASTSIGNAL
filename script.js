//script.js
const SB_URL = 'https://adzxwgaoozuoamqqwkcd.supabase.co';
const SB_KEY = 'sb_publishable_MxwhklaWPh4uOnvl_WI4eg_ceEre8pi';
const sb = supabase.createClient(SB_URL, SB_KEY);
let onlineUsers = {}; // Хранилище для активных юзеров
let postsPage = 0;
const POSTS_PER_PAGE = 5;
let isLoadingPosts = false;
let hasMorePosts = true;

let channelsPage = 0;
const CHANNELS_PER_PAGE = 18;
let isLoadingChannels = false;
let hasMoreChannels = true;

let currentUser = null;
let userProfile = null;
let isSignUp = false;
let currentPublicId = null;
let selectedPostFile = null;
let selectedPubFile = null;
let selectedUserFile = null;
let currentLang = localStorage.getItem('lang') || 'en';
let scrollPosition = 0;

// Профиль
let currentProfileUser = null;
let profileCommentsPage = 1;
let profileCommentsFilter = 'new';
let profileComments = [];
let hasMoreComments = true;
let userReviews = [];
let userVote = null;
let isViewingSubscriptions = false;
let isViewingDiscovery = false;

// Словарь
const i18n = {
    en: {
        global_feed: "GLOBAL FEED",
        public_channels: "PUBLIC CHANNELS",
        my_channels: "MY CHANNELS",
        find_channels: "FIND CHANNELS",
        subscribers: "Subscribers",
        last_transmission: "LAST TRANSMISSION",
        no_recent_posts: "No recent signals",
        admin_console: "ADMIN CONSOLE",
        terminal_access: "TERMINAL ACCESS",
        close: "CLOSE",
        register_channel: "REGISTER CHANNEL",
        channel_name_placeholder: "Channel Name",
        upload_avatar: "UPLOAD AVATAR",
        upload_image: "UPLOAD IMAGE",
        verified: "Verified",
        execute: "EXECUTE",
        broadcast_signal: "BROADCAST SIGNAL",
        subject_placeholder: "Transmission Subject",
        data_payload_placeholder: "Data payload...",
        callsign_placeholder: "CALLSIGN",
        encryption_placeholder: "ENCRYPTION KEY",
        establish: "ESTABLISH",
        switch_auth: "Switch to Register",
        switch_login: "Switch to Login",
        abort: "ABORT",
        disconnect: "DISCONNECT",
        responses: "RESPONSES",
        boost: "BOOST",
        terminate: "DELETE POST",
        delete: "DELETE",
        reply: "REPLY",
        send: "SEND",
        no_signals: "NO SIGNALS DETECTED",
        no_responses: "NO RESPONSES YET",
        reg_success: "REGISTRATION SUCCESSFUL",
        signal_sent: "TRANSMISSION SENT",
        no_subject: "NO SUBJECT",
        auth_req: "CONNECTION REQUIRED",
        connection: "CONNECTION",
        register: "REGISTER",
        login: "LOGIN",
        subscribe: "SUBSCRIBE",
        subscribed: "SUBSCRIBED",
        unsubscribe: "UNSUBSCRIBE",
        subscriptions: "SUBSCRIPTIONS",
        followers: "FOLLOWERS",
        following: "FOLLOWING",
        posts: "Posts",
        reviews: "REVIEWS",
        write_review: "Write a review",
        submit_review: "Submit Review",
        terminal_menu: "TERMINAL MENU",
        active_nodes: "ACTIVE NODES",
        online: "Online",
        offline: "Offline",
        search_channels: "Search frequencies..."
    },
    ru: {
        global_feed: "ОБЩАЯ ЛЕНТА",
        public_channels: "КАНАЛЫ СВЯЗИ",
        my_channels: "МОИ КАНАЛЫ",
        find_channels: "ОБЗОР КАНАЛОВ",
        subscribers: "Подписчиков",
        last_transmission: "ПОСЛЕДНЯЯ ПЕРЕДАЧА",
        no_recent_posts: "Сигналов не было",
        admin_console: "КОНСОЛЬ АДМИНА",
        terminal_access: "ДОСТУП К ТЕРМИНАЛУ",
        close: "ЗАКРЫТЬ",
        register_channel: "РЕГИСТРАЦИЯ КАНАЛА",
        channel_name_placeholder: "Название канала",
        upload_avatar: "ЗАГРУЗИТЬ АВАТАР",
        upload_image: "ЗАГРУЗИТЬ ИЗОБРАЖЕНИЕ",
        verified: "Проверенный",
        execute: "ВЫПОЛНИТЬ",
        broadcast_signal: "ТРАНСЛЯЦИЯ СИГНАЛА",
        subject_placeholder: "Тема сообщения",
        data_payload_placeholder: "Текст сообщения...",
        callsign_placeholder: "ПОЗЫВНОЙ",
        encryption_placeholder: "КЛЮЧ ШИФРОВАНИЯ",
        establish: "ПОДКЛЮЧИТЬСЯ",
        switch_auth: "Перейти к регистрации",
        switch_login: "Перейти к входу",
        abort: "ОТМЕНА",
        disconnect: "ОТКЛЮЧИТЬСЯ",
        responses: "ОТВЕТЫ",
        boost: "УСИЛИТЬ",
        terminate: "УДАЛИТЬ ПОСТ",
        delete: "УДАЛИТЬ",
        reply: "ОТВЕТИТЬ",
        send: "ОТПРАВИТЬ",
        no_signals: "СИГНАЛОВ НЕ ОБНАРУЖЕНО",
        no_responses: "ОТВЕТОВ ПОКА НЕТ",
        reg_success: "РЕГИСТРАЦИЯ УСПЕШНА",
        signal_sent: "СИГНАЛ ОТПРАВЛЕН",
        no_subject: "БЕЗ ТЕМЫ",
        auth_req: "ТРЕБУЕТСЯ ПОДКЛЮЧЕНИЕ",
        connection: "ПОДКЛЮЧЕНИЕ",
        register: "РЕГИСТРАЦИЯ",
        login: "ВХОД",
        subscribe: "ПОДПИСАТЬСЯ",
        subscribed: "ПОДПИСАН",
        unsubscribe: "ОТПИСАТЬСЯ",
        subscriptions: "ПОДПИСКИ",
        followers: "FOLLOWERS",
        following: "FOLLOWING",
        posts: "Посты",
        reviews: "ОТЗЫВЫ",
        write_review: "Написать отзыв",
        submit_review: "Отправить отзыв",
        terminal_menu: "МЕНЮ ТЕРМИНАЛА",
        active_nodes: "АКТИВНЫЕ УЗЛЫ",
        online: "В сети",
        offline: "Вне сети",
        search_channels: "Поиск по частотам..."
    }
};

// --- ИНТЕГРАЦИЯ С ТЕЛЕГРАМ ---
async function sendToTelegram(title, content, imageUrl, publicName, authorName = null) {
    const BOT_TOKEN = '8491539149:AAFnARmGIwhPx5aj9m25tFQIx_uy98yVO7Y';
    const CHAT_ID = '@THELASTSIGNALCHANNEL';
    const SITE_URL = 'https://eduardzlobin.github.io/THELASTSIGNAL/';
    const shortContent = content.length > 35 ? content.substring(0, 35) + "..." : content;
    const authorLine = authorName ? `\n👤 <b>Отправитель:</b> @${authorName.toUpperCase()}` : '';
    const message = `📡 <b>КАНАЛ: ${publicName.toUpperCase()}</b>\n` +
                    `📝 <b>ТЕМА: ${title.toUpperCase()}</b>\n` +
                    `${authorLine}\n\n` +
                    `${shortContent}\n\n` +
                    `<a href="${SITE_URL}">📡 Подключиться к сигналу...</a>`;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/${imageUrl ? 'sendPhoto' : 'sendMessage'}`;
    const body = imageUrl ? { chat_id: CHAT_ID, photo: imageUrl, caption: message, parse_mode: 'HTML' }
                          : { chat_id: CHAT_ID, text: message, parse_mode: 'HTML' };
    try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) {}
}

// --- СИСТЕМА ПАБЛИКОВ (Твоя новая идея) ---

// 1. Загрузка только ПОДПИСАННЫХ каналов в боковую панель
async function checkUser() {
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            currentUser = session.user;
            const { data: profile, error } = await sb.from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .single();
            
            if (profile) {
                userProfile = profile;
                await initPresence(); // Запуск онлайна
            }
        } else {
            currentUser = null;
            userProfile = null;
        }
        await loadPublics(); 

    } catch (e) {
        console.error("Auth check error:", e);
    } finally {
        updateUI(); // Обновляем шапку и сайдбар
    }
}

// 2. ОБЗОР КАНАЛОВ (Микро-профили вместо ленты)
async function loadDiscoveryView(append = false) {
    if (isLoadingChannels) return;
    if (append && !hasMoreChannels) return;

    if (!append) {
        channelsPage = 0;
        hasMoreChannels = true;
        saveScrollPosition();
        const container = document.getElementById('posts-container');
        container.innerHTML = `<div class="loading">SCANNING AIRWAVES...</div>`;
    }

    isLoadingChannels = true;
    isViewingDiscovery = true;
    isViewingSubscriptions = false;
    currentPublicId = null;

    try {
        const from = channelsPage * CHANNELS_PER_PAGE;
        const to = from + CHANNELS_PER_PAGE - 1;

        const { data: publics } = await sb.from('publics')
            .select('*')
            .order('is_verified', {ascending: false})
            .range(from, to);

        if (!publics || publics.length < CHANNELS_PER_PAGE) hasMoreChannels = false;

        const container = document.getElementById('posts-container');
        
        if (!append) {
            container.innerHTML = `
                <div class="discovery-header-row">
                    <button class="back-btn" style="margin-bottom:0" onclick="loadPosts(null)">
                        <i class="fas fa-arrow-left"></i> ${i18n[currentLang].global_feed}
                    </button>
                    <div class="search-container">
                        <i class="fas fa-search"></i>
                        <input type="text" class="discovery-search-input" placeholder="${i18n[currentLang].search_channels}" oninput="filterPublics(this.value)">
                    </div>
                </div>
                <div class="public-grid" id="public-grid"></div>
            `;
        }

        const grid = document.getElementById('public-grid');
        let html = '';
        
        for (const pub of publics) {
            const isSubscribed = currentUser ? await checkSubscription(pub.id) : false;
            html += `
                <div class="public-card" data-name="${pub.name.toLowerCase()}">
                    <div class="public-card-header">
                        <img src="${pub.avatar_url || 'https://via.placeholder.com/60'}" class="public-card-avatar" onclick="loadPosts(${pub.id})">
                        <div class="public-card-info">
                            <div class="public-card-name" onclick="loadPosts(${pub.id})">${pub.name}</div>
                            <div class="public-card-subs">${i18n[currentLang].subscribers}</div>
                        </div>
                    </div>
                    <button class="subscribe-btn ${isSubscribed ? 'subscribed' : ''}" style="width:100%" onclick="toggleDiscoverySub(${pub.id})">
                        ${isSubscribed ? i18n[currentLang].unsubscribe : i18n[currentLang].subscribe}
                    </button>
                </div>`;
        }
        
        grid.insertAdjacentHTML('beforeend', html);
        channelsPage++;
    } catch (e) { console.error(e); }
    finally { isLoadingChannels = false; }
}

// НОВАЯ ФУНКЦИЯ ДЛЯ ФИЛЬТРАЦИИ КАРТОЧЕК
function filterPublics(query) {
    const searchTerm = query.toLowerCase().trim();
    const cards = document.querySelectorAll('.public-card');
    
    cards.forEach(card => {
        const name = card.getAttribute('data-name');
        if (name.includes(searchTerm)) {
            card.classList.remove('search-hidden');
        } else {
            card.classList.add('search-hidden');
        }
    });
}

async function toggleDiscoverySub(id) {
    await toggleSubscription(id);
    loadDiscoveryView();
}

// --- ВСЁ ОСТАЛЬНОЕ БЕЗ ИЗМЕНЕНИЙ (Твой оригинальный JS) ---

function saveScrollPosition() { scrollPosition = window.scrollY; }
function restoreScrollPosition() { window.scrollTo(0, scrollPosition); }

function setLanguage(lang) {
    currentLang = lang; localStorage.setItem('lang', lang);
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`lang-${lang}`).classList.add('active');
    translateUI(); loadPublics(); 
    if (isViewingDiscovery) loadDiscoveryView(); else loadPosts(currentPublicId);
}

function translateUI() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        const text = i18n[currentLang][key];
        if (text) {
            const icon = el.querySelector('i');
            if (icon) el.innerHTML = icon.outerHTML + ' ' + text;
            else el.textContent = text;
        }
    });
    document.querySelectorAll('[data-t-placeholder]').forEach(el => {
        const key = el.getAttribute('data-t-placeholder');
        if (i18n[currentLang][key]) el.placeholder = i18n[currentLang][key];
    });
}

async function initPresence() {
    if (!currentUser || !userProfile) return;

    const channel = sb.channel('online-nodes', {
        config: {
            presence: {
                key: userProfile.id,
            },
        },
    });

    channel
        .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            updateOnlineUsersList(state);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({
                    id: userProfile.id,
                    username: userProfile.username,
                    avatar: userProfile.users_avatar_url,
                    online_at: new Date().toISOString(),
                });
            }
        });
}

function updateOnlineUsersList(presenceState) {
    const listContainer = document.getElementById('online-users-list');
    if (!listContainer) return;

    const uniqueUsers = {};
    for (const id in presenceState) {
        const userDetails = presenceState[id][0];
        uniqueUsers[userDetails.id] = userDetails;
    }

    onlineUsers = uniqueUsers;

    const userArray = Object.values(uniqueUsers).slice(0, 10);

    listContainer.innerHTML = userArray.map(user => `
        <div class="online-user-item" onclick="openProfile('${user.username}')">
            <img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + user.username}" class="online-avatar">
            <span class="online-name">@${user.username.toUpperCase()}</span>
            <div class="status-dot"></div>
        </div>
    `).join('');
}

function updateUI() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;

    if (currentUser) {
        // Если пользователь вошел
        authSection.innerHTML = `
            <div class="user-info">
                <span class="user-name" onclick="openProfile('${userProfile?.username}')">
                    <i class="fas fa-user-astronaut"></i> @${userProfile?.username?.toUpperCase()}
                </span>
                <button class="disconnect-btn" onclick="logout()">
                    <i class="fas fa-power-off"></i>
                </button>
            </div>
        `;
        
        // Показываем кнопку админа, если юзер — админ
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            if (userProfile?.is_admin) adminBtn.classList.remove('hidden');
            else adminBtn.classList.add('hidden');
        }
    } else {
        // Если пользователь не авторизован
        authSection.innerHTML = `
            <button class="btn-auth" onclick="showAuthModal()">
                <i class="fas fa-plug"></i>
                <span data-t="establish">${i18n[currentLang].establish}</span>
            </button>
        `;
        
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) adminBtn.classList.add('hidden');
    }
}

function updateUI() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;

    if (currentUser) {
        authSection.innerHTML = `
            <div class="user-info">
                <span class="user-name" onclick="openProfile('${userProfile?.username}')">
                    <i class="fas fa-user-astronaut"></i> @${userProfile?.username?.toUpperCase()}
                </span>
                <button class="disconnect-btn" onclick="logout()">
                    <i class="fas fa-power-off"></i>
                </button>
            </div>
        `;
        
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn && userProfile?.is_admin) adminBtn.classList.remove('hidden');
    } else {
        authSection.innerHTML = `
            <button class="btn-auth" onclick="showAuthModal()">
                <i class="fas fa-plug"></i>
                <span>${i18n[currentLang].establish}</span>
            </button>
        `;
    }
}

async function checkUser() {
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            currentUser = session.user;
            const { data: profile, error } = await sb.from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .single();
            
            if (profile) {
                userProfile = profile;
                await initPresence();
                
                // --- ВОТ ЭТО ИСПРАВИТ ПРОБЛЕМУ ---
                await loadPublics(); // <--- ДОБАВИТЬ ЭТУ СТРОКУ
                // ---------------------------------
            }
        } else {
            currentUser = null;
            userProfile = null;
            // Также вызываем, чтобы очистить список, если пользователь вышел
            loadPublics(); 
        }
    } catch (e) {
        console.error("Auth check error:", e);
    } finally {
        updateUI(); 
    }
}

// Файлы
function handlePostFileSelect(e) { selectedPostFile = e.target.files[0]; document.getElementById('post-file-name').textContent = selectedPostFile.name; }
function handlePubFileSelect(e) { selectedPubFile = e.target.files[0]; document.getElementById('pub-file-name').textContent = selectedPubFile.name; }
function handleUserFileSelect(e) { selectedUserFile = e.target.files[0]; document.getElementById('user-file-info').textContent = selectedUserFile.name; }

async function uploadToStorage(file, bucket) {
    if (!file) return null;
    const name = `signal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const { data, error } = await sb.storage.from(bucket).upload(name, file);
    if (error) return null;
    return sb.storage.from(bucket).getPublicUrl(name).data.publicUrl;
}

// УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ЗАГРУЗКИ ПОСТОВ
async function loadPosts(pubId = null, append = false, onlySubs = false) {
    if (isLoadingPosts) return;
    
    // Якщо ми намагаємося довантажити (append), але постів більше немає — виходимо
    if (append && !hasMorePosts) return;

    if (!append) {
        postsPage = 0;
        hasMorePosts = true; // Скидаємо прапорець при новому запиті
        isViewingSubscriptions = onlySubs;
        saveScrollPosition();
        const container = document.getElementById('posts-container');
        if (container) container.innerHTML = `<div class="loading">LOADING...</div>`;
    }

    isLoadingPosts = true;
    currentPublicId = pubId;

    try {
        let query = sb.from('posts').select('*, publics(*)').order('created_at', { ascending: false });

        if (pubId) {
            query = query.eq('public_id', pubId);
        } else if (onlySubs) {
            const { data: subs } = await sb.from('user_subscriptions').select('public_id').eq('user_id', userProfile.id);
            if (!subs || subs.length === 0) {
                document.getElementById('posts-container').innerHTML = `<div class="empty-state">NO SUBSCRIPTIONS</div>`;
                isLoadingPosts = false; return;
            }
            query = query.in('public_id', subs.map(s => s.public_id));
        }

        const from = postsPage * POSTS_PER_PAGE;
        const to = from + POSTS_PER_PAGE - 1;
        
        const { data: posts, error } = await query.range(from, to);

        if (error) throw error;
        
        // Если пришло меньше, чем просили — значит посты закончились
        if (!posts || posts.length < POSTS_PER_PAGE) {
            hasMorePosts = false;
        }

        let html = '';
        if ((pubId || onlySubs) && !append) {
            html += `<button class="back-btn" onclick="loadPosts(null)">
                <i class="fas fa-arrow-left"></i> ${i18n[currentLang].global_feed}</button>`;
        }

        for (let post of posts) {
            html += await renderSinglePost(post); 
        }

        const container = document.getElementById('posts-container');
        if (append) {
            container.insertAdjacentHTML('beforeend', html);
        } else {
            container.innerHTML = html;
            restoreScrollPosition();
        }

        postsPage++;
    } catch (e) {
        console.error("General load error:", e);
    } finally {
        isLoadingPosts = false;
    }
}

// ОТДЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ОТРИСОВКИ ОДНОГО ПОСТА (чтобы код был чистым)
async function renderSinglePost(post) {
    const { data: comments } = await sb.from('comments').select('*').eq('post_id', post.id);
    const topComment = comments && comments.length > 0 ? 
        comments.reduce((prev, current) => (prev.likes_count > current.likes_count) ? prev : current) : null;
    const commentsCount = comments ? comments.length : 0;
    const isSubscribed = currentUser ? await checkSubscription(post.public_id) : false;
    
    const safeTitle = (post.title || i18n[currentLang].no_subject).toUpperCase();
    const authorDisplay = post.is_user_post ? `<span class="post-author-tag" onclick="openProfile('${post.author_name}')">@${post.author_name}</span>` : '';
    
    const formattedDate = new Date(post.created_at).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    return `
    <div class="post-card" id="post-${post.id}">
        <h3 class="post-title">${safeTitle}</h3>
        <div class="post-header">
            <img src="${post.publics?.avatar_url || 'https://via.placeholder.com/48/0b1324/7896ff?text=LS'}" 
                 class="post-avatar" alt="avatar" onclick="loadPosts(${post.publics?.id})">
            <div class="post-meta">
                <div class="post-channel" onclick="loadPosts(${post.publics?.id})">
                    ${post.publics?.name || 'Unknown'} 
                    ${post.publics?.is_verified ? '<i class="fas fa-check-circle" style="color:var(--success)"></i>' : ''}
                    ${authorDisplay}
                </div>
                <div class="post-date"><i class="far fa-clock"></i> ${formattedDate}</div>
            </div>
            ${currentUser ? `
                <button class="subscribe-btn ${isSubscribed ? 'subscribed' : ''}" onclick="toggleSubscription(${post.public_id})">
                    <i class="fas ${isSubscribed ? 'fa-bell-slash' : 'fa-bell'}"></i>
                    ${isSubscribed ? i18n[currentLang].unsubscribe : i18n[currentLang].subscribe}
                </button>
            ` : ''}
        </div>
        <div class="post-content">${post.content.replace(/\n/g, '<br>')}</div>
        ${post.image_url ? `<div class="post-image-container"><img src="${post.image_url}" class="post-image" onclick="toggleImageSize(this)"></div>` : ''}
        <div class="post-actions">
            <button class="action-btn" onclick="likePost(${post.id}, ${post.likes_count})">
                <i class="fas fa-heart"></i> ${post.likes_count || 0}
            </button>
            <button class="action-btn" onclick="toggleComments(${post.id})">
                <i class="fas fa-comments"></i> ${i18n[currentLang].responses} (${commentsCount})
            </button>
            ${userProfile?.is_admin ? `
                <button class="action-btn delete-btn" onclick="deletePost(${post.id})">
                    <i class="fas fa-trash"></i>
                </button>
            ` : ''}
        </div>
        <div id="comments-${post.id}" class="comments-section hidden">
            ${topComment ? `
                <div class="top-comment">
                    <i class="fas fa-crown"></i>
                    <span class="top-comment-author" onclick="openProfile('${topComment.author_name}')">@${topComment.author_name}</span>: ${topComment.text}
                </div>
            ` : ''}
            <div id="comments-list-${post.id}" class="comments-list"></div>
            <div class="comment-input">
                <input type="text" id="comment-input-${post.id}" placeholder="${i18n[currentLang].send}...">
                <button onclick="sendComment(${post.id})">${i18n[currentLang].send}</button>
            </div>
        </div>
    </div>`;
}

async function createUserPost() {
    saveScrollPosition();
    const title = document.getElementById('user-post-title').value.trim();
    const content = document.getElementById('user-post-content').value.trim();
    if (!title || !content) { alert("Title and content are required"); return; }
    try {
        const imageUrl = await uploadToStorage(selectedUserFile, 'post-images');
        const { error } = await sb.from('posts').insert([{
            title, content, public_id: currentPublicId, image_url: imageUrl,
            author_name: userProfile.username, likes_count: 0, is_user_post: true
        }]);
        if (error) throw error;

        // --- Telegram Integration (User) ---
        const publicName = document.querySelector('.channel-item.active .channel-name')?.textContent || "Сигнал пользователя";
        await sendToTelegram(title, content, imageUrl, publicName, userProfile.username);
        // ------------------------------------

        document.getElementById('user-post-title').value = '';
        document.getElementById('user-post-content').value = '';
        document.getElementById('user-file-info').textContent = '';
        selectedUserFile = null;
        alert(i18n[currentLang].signal_sent);
        await loadPosts(currentPublicId);
        restoreScrollPosition();
    } catch (error) { alert("Error: " + error.message); }
}

// Подписки
async function toggleSubscription(publicId) {
    if (!currentUser) { alert(i18n[currentLang].auth_req); showAuthModal(); return; }
    
    // Сохраняем позицию, чтобы экран не прыгал
    saveScrollPosition();
    
    try {
        const { data: existingSubscription } = await sb.from('user_subscriptions')
            .select('*').eq('user_id', userProfile.id).eq('public_id', publicId).single();
        
        if (existingSubscription) {
            // Удаляем подписку
            await sb.from('user_subscriptions').delete().eq('id', existingSubscription.id);
        } else {
            // Создаем подписку
            await sb.from('user_subscriptions').insert({ user_id: userProfile.id, public_id: publicId });
        }
        
        // ОБНОВЛЯЕМ СПИСОК СЛЕВА
        await loadPublics();
        
        // Обновляем текущий вид (если мы в обзоре каналов или в ленте)
        if (isViewingDiscovery) {
            await loadDiscoveryView(); // Перезагружаем карточки обзора без сброса скролла (частично)
        } else {
            await loadPosts(currentPublicId);
        }
        
        restoreScrollPosition();
    } catch (error) { 
        console.error('Toggle subscription error:', error); 
        restoreScrollPosition(); 
    }
}

async function checkSubscription(publicId) {
    if (!currentUser || !userProfile) return false;
    try {
        const { data, error } = await sb.from('user_subscriptions')
            .select('id') // Запрашиваем только ID для легкости
            .eq('user_id', userProfile.id)
            .eq('public_id', publicId)
            .maybeSingle(); // Используем maybeSingle вместо single, чтобы не было ошибки если нет записи

        if (error) return false;
        return !!data;
    } catch (error) { 
        return false; 
    }
}

function toggleImageSize(imgElement) {
    imgElement.classList.toggle('expanded');
    const expandBtn = imgElement.nextElementSibling?.querySelector('.image-btn:first-child');
    if (expandBtn) {
        const icon = expandBtn.querySelector('i');
        if (imgElement.classList.contains('expanded')) icon.className = 'fas fa-compress-alt';
        else icon.className = 'fas fa-expand-alt';
    }
}

function openImageInNewTab(imageUrl) { window.open(imageUrl, '_blank'); }

// Комментарии
async function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (!commentsSection) return;
    commentsSection.classList.toggle('hidden');
    if (!commentsSection.classList.contains('hidden')) {
        try {
            const { data: comments } = await sb.from('comments')
                .select('*').eq('post_id', postId).order('created_at', { ascending: true });
            const list = document.getElementById(`comments-list-${postId}`);
            if (!list) return;
            list.innerHTML = comments && comments.length > 0 ? 
                comments.map(comment => `<div class="comment-item">
                    <div class="comment-meta">
                        <span class="comment-author" onclick="openProfile('${comment.author_name}')">
                            <i class="fas fa-user"></i> @${comment.author_name}
                        </span>
                        ${userProfile?.is_admin ? `<span class="comment-action delete-action" onclick="deleteComm(${comment.id}, ${postId})">
                            <i class="fas fa-times"></i> ${i18n[currentLang].delete}
                        </span>` : ''}
                    </div>
                    <div>${comment.text}</div>
                    <div class="comment-actions">
                        <span class="comment-action" onclick="likeComm(${comment.id}, ${comment.likes_count}, ${postId})">
                            <i class="fas fa-bolt"></i> ${i18n[currentLang].boost} 
                            <i class="fas fa-heart"></i> ${comment.likes_count || 0}
                        </span>
                        <span class="comment-action" onclick="replyTo('${comment.author_name}', ${postId})">
                            <i class="fas fa-reply"></i> ${i18n[currentLang].reply}
                        </span>
                    </div>
                </div>`).join('') : 
                `<div style="text-align:center;color:var(--text-muted);padding:20px">${i18n[currentLang].no_responses}</div>`;
        } catch (error) { console.error('Load comments error:', error); }
    }
}

function replyTo(name, postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (input) { input.value = `@${name}, `; input.focus(); }
}

async function sendComment(postId) {
    if (!currentUser) { alert(i18n[currentLang].auth_req); showAuthModal(); return; }
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;
    saveScrollPosition();
    try {
        await sb.from('comments').insert([{ post_id: postId, text: text, author_name: userProfile.username, likes_count: 0 }]);
        input.value = '';
        await loadPosts(currentPublicId);
        toggleComments(postId);
        restoreScrollPosition();
    } catch (error) { alert("Error sending comment: " + error.message); }
}

// Лайки и удаление
async function likePost(id, count) {
    if (!currentUser) { alert(i18n[currentLang].auth_req); showAuthModal(); return; }
    saveScrollPosition();
    try {
        const increment = userProfile?.is_admin ? 10 : 1;
        await sb.from('posts').update({ likes_count: (count || 0) + increment }).eq('id', id);
        const postElement = document.getElementById(`post-${id}`);
        if (postElement) {
            const likeBtn = postElement.querySelector('.action-btn');
            if (likeBtn) likeBtn.innerHTML = `<i class="fas fa-heart"></i> ${(count || 0) + increment}`;
        }
        restoreScrollPosition();
    } catch (error) { console.error('Like post error:', error); restoreScrollPosition(); }
}

async function likeComm(id, count, postId) {
    if (!currentUser) { alert(i18n[currentLang].auth_req); showAuthModal(); return; }
    saveScrollPosition();
    try {
        await sb.from('comments').update({ likes_count: (count || 0) + 1 }).eq('id', id);
        toggleComments(postId);
        restoreScrollPosition();
    } catch (error) { console.error('Like comment error:', error); restoreScrollPosition(); }
}

async function deletePost(id) {
    if (!confirm("Are you sure you want to delete this post?")) return;
    saveScrollPosition();
    try {
        await sb.from('posts').delete().eq('id', id);
        await loadPosts(currentPublicId);
        restoreScrollPosition();
    } catch (error) { alert("Error deleting post: " + error.message); restoreScrollPosition(); }
}

async function deleteComm(id, postId) {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    saveScrollPosition();
    try {
        await sb.from('comments').delete().eq('id', id);
        toggleComments(postId);
        restoreScrollPosition();
    } catch (error) { alert("Error deleting comment: " + error.message); restoreScrollPosition(); }
}

// Аутентификация
async function handleAuth() {
    const callsign = document.getElementById('auth-username-input').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!callsign || !password) { alert("Please enter both username and password"); return; }
    const email = `${callsign.toLowerCase()}@thelastsignal.com`;
    try {
        if (isSignUp) {
            const { data: signUpData, error: signUpError } = await sb.auth.signUp({ email: email, password: password });
            if (signUpError) throw signUpError;
            await sb.from('profiles').insert([{ id: signUpData.user.id, username: callsign, is_admin: false, total_rating: 0 }]);
            alert(i18n[currentLang].reg_success);
            toggleAuthMode();
        } else {
            const { error } = await sb.auth.signInWithPassword({ email: email, password: password });
            if (error) throw error;
            closeModal();
            await checkUser();
        }
    } catch (error) { alert(isSignUp ? "Registration failed: " + error.message : "Login failed: " + error.message); }
}

// Паблики
// --- ОБНОВЛЕННАЯ ФУНКЦИЯ (ВСТАВИТЬ ВМЕСТО УДАЛЕННОГО) ---
async function loadPublics() {
    try {
        // Загружаем ВСЕ каналы (нужно для выпадающего списка админа и фильтрации)
        const { data: publics, error } = await sb.from('publics').select('*').order('name');
        if (error) throw error;

        const list = document.getElementById('publics-list');
        const select = document.getElementById('post-public-id');

        // 1. Для админки (выпадающий список при создании поста)
        if (select) {
            select.innerHTML = '<option value="">' + (currentLang === 'ru' ? 'Выберите канал...' : 'Select channel...') + '</option>';
            publics.forEach(pub => {
                select.innerHTML += `<option value="${pub.id}">${pub.name} ${pub.is_verified ? '✓' : ''}</option>`;
            });
        }

        // 2. Для боковой панели (МОИ КАНАЛЫ)
        if (list) {
            // Если не вошли в систему
            if (!currentUser || !userProfile) {
                list.innerHTML = `<div style="padding:15px; font-size:12px; color:var(--text-muted); text-align:center;">
                    ${currentLang === 'ru' ? 'Войдите для просмотра подписок' : 'Login to see subscriptions'}
                </div>`;
                return;
            }

            // Загружаем подписки текущего юзера
            const { data: subs, error: subError } = await sb.from('user_subscriptions')
                .select('public_id')
                .eq('user_id', userProfile.id);
            
            if (subError) throw subError;

            // Создаем массив ID подписанных каналов
            const subIds = (subs || []).map(s => s.public_id);
            
            // Фильтруем: оставляем только те каналы, на которые есть подписка
            const myPublics = publics.filter(p => subIds.includes(p.id));

            if (myPublics.length === 0) {
                list.innerHTML = `<div style="padding:15px; font-size:12px; color:var(--text-muted); text-align:center;">
                    ${currentLang === 'ru' ? 'Нет подписок' : 'No subscriptions yet'}
                </div>`;
            } else {
                list.innerHTML = myPublics.map(pub => `
                    <div class="channel-item" onclick="loadPosts(${pub.id})">
                        <img src="${pub.avatar_url || 'https://via.placeholder.com/32/0b1324/7896ff?text=C'}" 
                             class="channel-avatar" alt="${pub.name}">
                        <span class="channel-name">${pub.name}</span>
                        ${pub.is_verified ? '<i class="fas fa-check-circle channel-verified"></i>' : ''}
                    </div>
                `).join('');
            }
        }
    } catch (error) { 
        console.error('Load publics error:', error); 
    }
}

async function createNewPublic() {
    saveScrollPosition();
    const name = document.getElementById('new-pub-name').value.trim();
    const isVerified = document.getElementById('new-pub-verify').checked;
    if (!name) { alert("Channel name is required"); return; }
    try {
        const avatarUrl = await uploadToStorage(selectedPubFile, 'avatars');
        await sb.from('publics').insert([{ name, avatar_url: avatarUrl, is_verified: isVerified }]);
        alert("Channel created successfully!");
        document.getElementById('new-pub-name').value = '';
        document.getElementById('new-pub-verify').checked = false;
        document.getElementById('pub-file-name').textContent = i18n[currentLang].upload_avatar;
        selectedPubFile = null;
        loadPublics();
        restoreScrollPosition();
    } catch (error) { alert("Error creating channel: " + error.message); restoreScrollPosition(); }
}

// Профиль пользователя
function openProfile(username) {
    saveScrollPosition();
    if (!username && currentUser && userProfile) username = userProfile.username;
    if (!username) { alert("Username is required"); return; }
    loadUserProfile(username);
    restoreScrollPosition();
}

async function loadUserProfile(username) {
    try {
        const { data: profiles } = await sb.from('profiles').select('*').eq('username', username);
        if (!profiles || profiles.length === 0) { alert(`User @${username} not found`); return; }
        const profile = profiles[0];
        currentProfileUser = profile;

        // --- ПРОВЕРКА СТАТУСА ОНЛАЙН ---
        const statusDot = document.getElementById('profile-status-dot');
        if (statusDot) {
            const isOnline = Object.values(onlineUsers).some(u => u.username === username);
            if (isOnline) {
                statusDot.innerHTML = `<span class="status-online">● ${i18n[currentLang].online}</span>`;
            } else {
                statusDot.innerHTML = `<span class="status-offline">○ ${i18n[currentLang].offline}</span>`;
            }
        }
        // -------------------------------

        document.getElementById('profile-username').textContent = `@${profile.username}`;
        
        const avatarImg = document.getElementById('profile-avatar-img');
        if (profile.users_avatar_url) avatarImg.src = profile.users_avatar_url;
        else avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=7896ff&color=fff&size=120`;
        
        const roleBadge = document.getElementById('profile-role');
        let roleText = 'USER';
        let roleClass = 'role-user';
        if (profile.is_admin) { roleText = 'ADMIN'; roleClass = 'role-admin'; }
        roleBadge.textContent = roleText;
        roleBadge.className = `role-badge ${roleClass}`;
        
        await loadProfileStats(profile.id);
        
        const bioDisplay = document.getElementById('profile-bio-display');
        if (profile.bio && profile.bio.trim()) bioDisplay.textContent = profile.bio;
        else bioDisplay.textContent = currentLang === 'ru' ? 'Пользователь еще не добавил информацию о себе.' : 'No bio yet.';
        
        const editBioBtn = document.getElementById('edit-bio-btn');
        const avatarUpload = document.getElementById('profile-avatar-upload');
        
        if (currentUser && userProfile && userProfile.id === profile.id) {
            editBioBtn.classList.remove('hidden');
            avatarUpload.classList.remove('hidden');
            document.getElementById('profile-bio-textarea').value = profile.bio || '';
        } else {
            editBioBtn.classList.add('hidden');
            avatarUpload.classList.add('hidden');
        }
        
        profileCommentsPage = 1;
        profileComments = [];
        hasMoreComments = true;
        
        await loadProfileComments();
        await loadProfileReviews();
        await loadUserVote();
        
        document.getElementById('profile-modal').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading profile:', error);
        alert("Error loading profile: " + error.message);
    }
}

async function loadProfileStats(userId) {
    try {
        const { count: postsCount } = await sb.from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('author_name', currentProfileUser.username);
        document.getElementById('profile-posts-count').textContent = postsCount || 0;
        const { count: commentsCount } = await sb.from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('author_name', currentProfileUser.username);
        document.getElementById('profile-comments-count').textContent = commentsCount || 0;
        const { count: followersCount } = await sb.from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
        document.getElementById('profile-followers-count').textContent = followersCount || 0;
        const { count: subscriptionsCount } = await sb.from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('public_id', userId);
        document.getElementById('profile-subscriptions-count').textContent = subscriptionsCount || 0;
        document.getElementById('profile-rating-score').textContent = currentProfileUser.total_rating || 0;
    } catch (error) { console.error('Error loading profile stats:', error); }
}

async function loadProfileComments() {
    try {
        const container = document.getElementById('profile-comments-container');
        if (profileCommentsPage === 1) {
            container.innerHTML = `<div class="loading">${currentLang === 'ru' ? 'ЗАГРУЗКА...' : 'LOADING...'}</div>`;
        }
        let orderBy = 'created_at';
        let ascending = false;
        if (profileCommentsFilter === 'popular') orderBy = 'likes_count';
        const { data: comments } = await sb.from('comments')
            .select('*, posts!inner(title, publics(name))')
            .eq('author_name', currentProfileUser.username)
            .order(orderBy, { ascending: ascending })
            .range((profileCommentsPage - 1) * 10, profileCommentsPage * 10 - 1);
        hasMoreComments = comments.length === 10;
        profileComments = profileCommentsPage === 1 ? comments : [...profileComments, ...comments];
        displayProfileComments();
        const loadMoreBtn = document.getElementById('load-more-comments');
        if (hasMoreComments) loadMoreBtn.classList.remove('hidden');
        else loadMoreBtn.classList.add('hidden');
    } catch (error) {
        console.error('Error loading profile comments:', error);
        document.getElementById('profile-comments-container').innerHTML = `<div class="no-comments">Error loading comments</div>`;
    }
}

function displayProfileComments() {
    const container = document.getElementById('profile-comments-container');
    if (!profileComments || profileComments.length === 0) {
        container.innerHTML = `<div class="no-comments" style="font-size:11px;">No activity logged.</div>`;
        return;
    }
    let html = '';
    profileComments.forEach(comment => {
        html += `<div class="profile-comment-item">
            <span class="profile-comment-post" onclick="loadPosts(${comment.posts?.public_id})">
                > ${comment.posts?.title || 'Unknown Signal'}
            </span>
            <div class="profile-comment-text">${comment.text}</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:5px;">
                <i class="fas fa-heart"></i> ${comment.likes_count}
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

async function loadMoreComments() {
    profileCommentsPage++;
    await loadProfileComments();
}

async function changeCommentsFilter(filter) {
    if (profileCommentsFilter === filter) return;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`filter-${filter}`).classList.add('active');
    profileCommentsFilter = filter;
    profileCommentsPage = 1;
    profileComments = [];
    await loadProfileComments();
}

function toggleBioEdit() {
    document.getElementById('profile-bio-display').classList.toggle('hidden');
    document.getElementById('profile-bio-edit').classList.toggle('hidden');
}

async function saveProfileBio() {
    if (!currentUser || !userProfile) { alert("You need to be logged in to edit profile"); return; }
    if (!currentProfileUser || userProfile.id !== currentProfileUser.id) { alert("You can only edit your own profile"); return; }
    const bioText = document.getElementById('profile-bio-textarea').value.trim();
    try {
        await sb.from('profiles').update({ bio: bioText }).eq('id', userProfile.id);
        currentProfileUser.bio = bioText;
        userProfile.bio = bioText;
        const bioDisplay = document.getElementById('profile-bio-display');
        if (bioText) bioDisplay.textContent = bioText;
        else bioDisplay.textContent = currentLang === 'ru' ? 'Пользователь еще не добавил информацию о себе.' : 'No bio yet.';
        toggleBioEdit();
    } catch (error) { alert("Error saving bio: " + error.message); }
}

async function uploadProfileAvatar(event) {
    if (!currentUser || !userProfile) { alert("You need to be logged in to upload avatar"); return; }
    if (!currentProfileUser || userProfile.id !== currentProfileUser.id) { alert("You can only change your own avatar"); return; }
    const file = event.target.files[0];
    if (!file) return;
    try {
        const avatarUrl = await uploadToStorage(file, 'avatars');
        if (!avatarUrl) return;
        await sb.from('profiles').update({ users_avatar_url: avatarUrl }).eq('id', userProfile.id);
        document.getElementById('profile-avatar-img').src = avatarUrl;
        userProfile.users_avatar_url = avatarUrl;
        if (currentProfileUser) currentProfileUser.users_avatar_url = avatarUrl;
    } catch (error) { alert("Error uploading avatar: " + error.message); }
}

async function deleteProfileComment(commentId) {
    if (!currentUser) { alert("You need to be logged in to delete comments"); return; }
    const canDelete = (currentProfileUser && userProfile.id === currentProfileUser.id) || userProfile.is_admin;
    if (!canDelete) { alert("You don't have permission to delete this comment"); return; }
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
        await sb.from('comments').delete().eq('id', commentId);
        profileCommentsPage = 1;
        profileComments = [];
        await loadProfileComments();
        if (currentProfileUser) await loadProfileStats(currentProfileUser.id);
    } catch (error) { alert("Error deleting comment: " + error.message); }
}

// Отзывы
async function loadProfileReviews() {
    try {
        const { data: reviews } = await sb.from('user_reviews')
            .select('*, profiles!user_reviews_author_id_fkey(username)')
            .eq('user_id', currentProfileUser.id)
            .order('created_at', { ascending: false });
        userReviews = reviews || [];
        displayProfileReviews();
    } catch (error) { console.error('Error loading reviews:', error); }
}

function displayProfileReviews() {
    const container = document.getElementById('profile-reviews-container');
    if (!userReviews || userReviews.length === 0) {
        container.innerHTML = `<div class="no-reviews" style="font-size:11px;">No reviews detected.</div>`;
        return;
    }
    let html = '';
    userReviews.forEach(review => {
        html += `<div class="review-item">
            <div style="color:var(--accent-blue); font-weight:600; margin-bottom:2px;">@${review.profiles?.username}</div>
            <div class="review-text">${review.text}</div>
        </div>`;
    });
    container.innerHTML = html;
}

async function submitReview() {
    if (!currentUser) { alert(i18n[currentLang].auth_req); showAuthModal(); return; }
    const text = document.getElementById('review-text').value.trim();
    if (!text) { alert("Please write a review"); return; }
    if (currentProfileUser.id === userProfile.id) { alert("You cannot review yourself"); return; }
    try {
        await sb.from('user_reviews').insert([{
            user_id: currentProfileUser.id,
            author_id: userProfile.id,
            text: text
        }]);
        document.getElementById('review-text').value = '';
        await loadProfileReviews();
    } catch (error) { alert("Error submitting review: " + error.message); }
}

// Рейтинг
async function loadUserVote() {
    if (!currentUser || !currentProfileUser || currentProfileUser.id === userProfile.id) return;
    try {
        const { data: vote } = await sb.from('user_ratings')
            .select('vote')
            .eq('user_id', currentProfileUser.id)
            .eq('rater_id', userProfile.id)
            .single();
        userVote = vote ? vote.vote : null;
        updateRatingButtons();
    } catch (error) { userVote = null; }
}

async function rateUser(direction) {
    if (!currentUser) { alert(i18n[currentLang].auth_req); showAuthModal(); return; }
    if (!currentProfileUser) return;
    if (currentProfileUser.id === userProfile.id) { alert("You cannot rate yourself"); return; }
    const voteValue = direction === 'up' ? 1 : -1;
    saveScrollPosition();
    try {
        if (userVote === voteValue) {
            // Удалить голос
            await sb.from('user_ratings')
                .delete()
                .eq('user_id', currentProfileUser.id)
                .eq('rater_id', userProfile.id);
            userVote = null;
        } else {
            // Обновить/добавить голос
            const { error } = await sb.from('user_ratings')
                .upsert({
                    user_id: currentProfileUser.id,
                    rater_id: userProfile.id,
                    vote: voteValue
                }, { onConflict: 'user_id,rater_id' });
            if (error) throw error;
            userVote = voteValue;
        }
        // Обновить общий рейтинг
        const { data: ratings } = await sb.from('user_ratings')
            .select('vote')
            .eq('user_id', currentProfileUser.id);
        const totalRating = ratings.reduce((sum, r) => sum + r.vote, 0);
        await sb.from('profiles')
            .update({ total_rating: totalRating })
            .eq('id', currentProfileUser.id);
        currentProfileUser.total_rating = totalRating;
        document.getElementById('profile-rating-score').textContent = totalRating;
        updateRatingButtons();
        restoreScrollPosition();
    } catch (error) {
        console.error('Rate user error:', error);
        alert("Error rating user: " + error.message);
        restoreScrollPosition();
    }
}

function updateRatingButtons() {
    const upBtn = document.querySelector('.rating-up');
    const downBtn = document.querySelector('.rating-down');
    if (userVote === 1) {
        upBtn.style.background = 'rgba(78, 205, 196, 0.4)';
        downBtn.style.background = 'rgba(255, 107, 139, 0.2)';
    } else if (userVote === -1) {
        upBtn.style.background = 'rgba(78, 205, 196, 0.2)';
        downBtn.style.background = 'rgba(255, 107, 139, 0.4)';
    } else {
        upBtn.style.background = 'rgba(78, 205, 196, 0.2)';
        downBtn.style.background = 'rgba(255, 107, 139, 0.2)';
    }
}

function closeProfileModal() {
    document.getElementById('profile-modal').classList.add('hidden');
    currentProfileUser = null;
    profileCommentsPage = 1;
    profileComments = [];
    userReviews = [];
    userVote = null;
}

// Вспомогательные функции
async function logout() {
    saveScrollPosition();
    try {
        await sb.auth.signOut();
        location.reload();
    } catch (error) { console.error('Logout error:', error); }
}

function showAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
    document.getElementById('auth-username-input').focus();
}

function closeModal() {
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('auth-username-input').value = '';
    document.getElementById('auth-password').value = '';
}

function toggleAuthMode() {
    isSignUp = !isSignUp;
    const toggleText = document.getElementById('toggle-text');
    const authButtonText = document.getElementById('auth-button-text');
    const authTitle = document.getElementById('auth-title');
    if (isSignUp) {
        authTitle.textContent = i18n[currentLang].register;
        authButtonText.textContent = i18n[currentLang].register;
        if (toggleText) toggleText.textContent = i18n[currentLang].switch_login;
    } else {
        authTitle.textContent = i18n[currentLang].connection;
        authButtonText.textContent = i18n[currentLang].establish;
        if (toggleText) toggleText.textContent = i18n[currentLang].switch_auth;
    }
}

function toggleAdminPanel() {
    const adminPanel = document.getElementById('admin-panel');
    const userPanel = document.getElementById('user-post-area');
    adminPanel.classList.toggle('hidden');
    if (!adminPanel.classList.contains('hidden')) {
        if (userPanel) userPanel.classList.add('hidden');
    } else if (currentPublicId && currentUser) {
        if (userPanel) userPanel.classList.remove('hidden');
    }
}

// Чистая инициализация (вставить в самый конец script.js)
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Установка языка
    const browserLang = navigator.language.startsWith('ru') ? 'ru' : 'en';
    currentLang = localStorage.getItem('lang') || browserLang;
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    const langBtn = document.getElementById(`lang-${currentLang}`);
    if (langBtn) langBtn.classList.add('active');
    
    // 2. Перевод интерфейса
    translateUI();

    // 3. Проверка пользователя и запуск системы
    await checkUser(); 

    // 4. Загрузка контента (если не открыт поиск или подписки)
    if (!isViewingDiscovery && !isViewingSubscriptions) {
        await loadPosts(null); 
    }

    // 5. Обработка вставки картинок
    document.addEventListener('paste', (e) => {
        const item = e.clipboardData.items[0];
        if (item?.type.includes('image')) {
            const file = item.getAsFile();
            const userArea = document.getElementById('user-post-area');
            if (userArea && !userArea.classList.contains('hidden')) {
                selectedUserFile = file; 
                document.getElementById('user-file-info').textContent = "Pasted from clipboard";
            }
        }
    });
});

let scrollThrottle = false;

window.onscroll = () => {
    if (scrollThrottle || isLoadingPosts || !hasMorePosts) return;
    if (!document.getElementById('profile-modal').classList.contains('hidden')) return;

    // Робимо перевірку: висота вікна + скільки прокрутили
    const scrollBottom = window.innerHeight + window.pageYOffset;
    const docHeight = document.documentElement.offsetHeight;

    // Спрацьовує тільки якщо залишилося менше 5 пікселів до самого низу
    if (scrollBottom >= docHeight - 5) {
        scrollThrottle = true;
        
        console.log("Loading next chunk...");
        
        if (isViewingDiscovery) {
            loadDiscoveryView(true);
        } else {
            loadPosts(currentPublicId, true, isViewingSubscriptions);
        }

        // Тайм-аут, щоб не було повторного спам-виклику протягом секунди
        setTimeout(() => { scrollThrottle = false; }, 1000);
    }
};
