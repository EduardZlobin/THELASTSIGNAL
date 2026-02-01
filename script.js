const SB_URL = 'https://adzxwgaoozuoamqqwkcd.supabase.co'.trim();
const SB_KEY = 'sb_publishable_MxwhklaWPh4uOnvl_WI4eg_ceEre8pi'.trim();
const sb = supabase.createClient(SB_URL, SB_KEY);

let currentUser = null;
let userProfile = null;
let isSignUp = false;
let currentPublicId = null;
let selectedPostFile = null;
let selectedPubFile = null;
let currentLang = localStorage.getItem('lang') || 'en';

// --- СЛОВАРЬ ПЕРЕВОДОВ ---
const i18n = {
    en: {
        global_feed: "📡 GLOBAL FEED", public_channels: "PUBLIC CHANNELS", admin_console: "🛠 ADMIN CONSOLE",
        terminal_access: "TERMINAL ACCESS", close: "CLOSE [X]", register_channel: "REGISTER CHANNEL",
        channel_name_placeholder: "Channel Name", upload_avatar: "📁 Upload Avatar", upload_image: "📁 Upload Image",
        verified: "Verified", execute: "EXECUTE", broadcast_signal: "BROADCAST SIGNAL",
        subject_placeholder: "Transmission Subject (Title)", data_payload_placeholder: "Data payload... Paste image (Ctrl+V) here.",
        callsign_placeholder: "CALLSIGN (Login)", encryption_placeholder: "ENCRYPTION (Password)", establish: "ESTABLISH",
        switch_auth: "Switch: Login / Register", abort: "ABORT", disconnect: "DISCONNECT", responses: "RESPONSES",
        boost: "BOOST", terminate: "TERMINATE", delete: "DELETE", reply: "REPLY", send: "SEND",
        no_signals: "NO SIGNALS DETECTED", no_responses: "NO RESPONSES YET", top_response: "TOP RESPONSE",
        reg_success: "FREQUENCY RESERVED. Please login.", signal_sent: "TRANSMISSION DISPATCHED.",
        no_subject: "NO SUBJECT", auth_req: "CONNECTION REQUIRED"
    },
    ru: {
        global_feed: "📡 ОБЩАЯ ЛЕНТА", public_channels: "КАНАЛЫ СВЯЗИ", admin_console: "🛠 КОНСОЛЬ АДМИНА",
        terminal_access: "ДОСТУП К ТЕРМИНАЛУ", close: "ЗАКРЫТЬ [X]", register_channel: "РЕГИСТРАЦИЯ КАНАЛА",
        channel_name_placeholder: "Название канала", upload_avatar: "📁 Загрузить аватар", upload_image: "📁 Загрузить картинку",
        verified: "Галочка", execute: "ВЫПОЛНИТЬ", broadcast_signal: "ТРАНСЛЯЦИЯ СИГНАЛА",
        subject_placeholder: "Тема сообщения (Заголовок)", data_payload_placeholder: "Данные сообщения... Можно вставить фото (Ctrl+V).",
        callsign_placeholder: "ПОЗЫВНОЙ (Логин)", encryption_placeholder: "КЛЮЧ (Пароль)", establish: "СОЕДИНЕНИЕ",
        switch_auth: "Переключить: Вход / Регистрация", abort: "ОТМЕНА", disconnect: "ОТКЛЮЧИТЬСЯ", responses: "ОТВЕТЫ",
        boost: "УСИЛИТЬ", terminate: "УДАЛИТЬ ПОСТ", delete: "УДАЛИТЬ", reply: "ОТВЕТИТЬ", send: "ОТПРАВИТЬ",
        no_signals: "СИГНАЛЫ НЕ ОБНАРУЖЕНЫ", no_responses: "ОТВЕТОВ ПОКА НЕТ", top_response: "ПОПУЛЯРНЫЙ ОТВЕТ",
        reg_success: "ЧАСТОТА ЗАРЕЗЕРВИРОВАНА. Войдите.", signal_sent: "СИГНАЛ ОТПРАВЛЕН.",
        no_subject: "БЕЗ ТЕМЫ", auth_req: "ТРЕБУЕТСЯ ПОДКЛЮЧЕНИЕ"
    }
};

// --- ЯЗЫКОВАЯ ЛОГИКА ---
function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    translateUI();
    loadPublics();
    loadPosts(currentPublicId);
}

function translateUI() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        if (i18n[currentLang][key]) el.innerText = i18n[currentLang][key];
    });
    document.querySelectorAll('[data-t-placeholder]').forEach(el => {
        const key = el.getAttribute('data-t-placeholder');
        if (i18n[currentLang][key]) el.placeholder = i18n[currentLang][key];
    });
    document.getElementById('lang-en').className = currentLang === 'en' ? 'active-lang' : '';
    document.getElementById('lang-ru').className = currentLang === 'ru' ? 'active-lang' : '';
}

// --- АВТОРИЗАЦИЯ ---
async function checkUser() {
    const { data: { user } } = await sb.auth.getUser();
    currentUser = user;
    if (user) {
        const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
        userProfile = profile;
    }
    translateUI();
    updateUI();
}

function updateUI() {
    const authSect = document.getElementById('auth-section');
    const adminBtn = document.getElementById('admin-btn');
    if (currentUser && userProfile) {
        authSect.innerHTML = `<div style="text-align:right"><span style="color:var(--accent);font-size:11px;font-family:'Orbitron'">@${userProfile.username.toUpperCase()}</span><br><button onclick="logout()" style="background:none;border:none;color:#555;cursor:pointer;font-size:9px">${i18n[currentLang].disconnect}</button></div>`;
        if (userProfile.is_admin) adminBtn.classList.remove('hidden');
    } else {
        authSect.innerHTML = `<button class="btn-auth" onclick="showAuthModal()">${i18n[currentLang].establish}</button>`;
        adminBtn.classList.add('hidden');
    }
    loadPublics();
    loadPosts(currentPublicId);
}

// --- РАБОТА С ФАЙЛАМИ ---
function handlePostFileSelect(e) {
    selectedPostFile = e.target.files[0];
    document.getElementById('post-file-name').innerText = selectedPostFile ? selectedPostFile.name : "...";
}

function handlePubFileSelect(e) {
    selectedPubFile = e.target.files[0];
    document.getElementById('pub-file-name').innerText = selectedPubFile ? selectedPubFile.name : "...";
}

document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.type.indexOf("image") !== -1) {
            selectedPostFile = item.getAsFile();
            const el = document.getElementById('post-file-name');
            if (el) el.innerText = "CLIPBOARD IMAGE READY";
        }
    }
});

async function uploadToStorage(file, bucket) {
    if (!file) return null;
    const fileExt = file.name ? file.name.split('.').pop() : 'png';
    const randomId = Math.random().toString(36).substring(2, 8);
    const safeName = `signal_${Date.now()}_${randomId}.${fileExt}`;

    const { data, error } = await sb.storage.from(bucket).upload(safeName, file);
    if (error) { 
        alert(`Storage Error: ${error.message}`); 
        return null; 
    }
    const { data: { publicUrl } } = sb.storage.from(bucket).getPublicUrl(safeName);
    return publicUrl;
}

// --- ПОСТЫ ---
async function createNewPost() {
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const pubId = document.getElementById('post-public-id').value;
    if (!title || !content) return alert("Fields required");

    const imageUrl = await uploadToStorage(selectedPostFile, 'post-images');
    const { error } = await sb.from('posts').insert([{
        title, content, public_id: pubId, image_url: imageUrl,
        author_name: userProfile.username, likes_count: 0
    }]);

    if (!error) { alert(i18n[currentLang].signal_sent); location.reload(); }
    else alert("Post Error: " + error.message);
}

async function loadPosts(pubId = null) {
    currentPublicId = pubId;
    const container = document.getElementById('posts-container');
    container.innerHTML = `<div class="loading">SCANNING...</div>`;

    let query = sb.from('posts').select('*, publics(*)').order('created_at', {ascending: false});
    if (pubId) query = query.eq('public_id', pubId);
    
    const { data: posts, error } = await query;
    if (error) return;

    container.innerHTML = pubId ? `<button class="btn-action" onclick="loadPosts(null)" style="margin-bottom:20px">← ${i18n[currentLang].global_feed}</button>` : '';

    if (!posts || posts.length === 0) {
        container.innerHTML += `<p style="text-align:center;color:#444">${i18n[currentLang].no_signals}</p>`;
        return;
    }

    for (let post of posts) {
        const { data: top } = await sb.from('comments').select('*').eq('post_id', post.id).order('likes_count', {ascending: false}).limit(1);
        const safeTitle = (post.title || i18n[currentLang].no_subject).toUpperCase();

        container.innerHTML += `
            <div class="post">
                <h2 class="post-title">${safeTitle}</h2>
                <div class="post-header">
                    <img src="${post.publics?.avatar_url || 'https://via.placeholder.com/40'}" class="pub-avatar">
                    <div class="pub-meta">
                        <div class="pub-name" onclick="loadPosts(${post.publics?.id})">${post.publics?.name || "???"} ${post.publics?.is_verified ? '✔️' : ''}</div>
                        <div class="post-date">${new Date(post.created_at).toLocaleString()}</div>
                    </div>
                </div>
                <div class="post-content">${post.content}</div>
                ${post.image_url ? `<img src="${post.image_url}" class="post-img">` : ''}
                
                <div class="post-actions">
                    <button class="btn-action" onclick="likePost(${post.id}, ${post.likes_count})">❤️ ${post.likes_count || 0}</button>
                    <button class="btn-action" onclick="toggleComments(${post.id})">${i18n[currentLang].responses}</button>
                    ${userProfile?.is_admin ? `<button class="btn-del" onclick="deletePost(${post.id})">${i18n[currentLang].terminate}</button>` : ''}
                </div>

                <div class="comment-section">
                    ${top && top[0] ? `<div class="top-response">🏆 <b>${i18n[currentLang].top_response}:</b> ${top[0].text}</div>` : ''}
                    <div id="list-${post.id}" class="comment-list hidden"></div>
                    <div class="inline-input">
                        <input type="text" id="in-${post.id}" placeholder="${i18n[currentLang].send}...">
                        <button onclick="sendComment(${post.id})">${i18n[currentLang].send}</button>
                    </div>
                </div>
            </div>`;
    }
}

// --- КОММЕНТАРИИ ---
async function sendComment(postId) {
    if (!currentUser) return alert(i18n[currentLang].auth_req);
    const input = document.getElementById(`in-${postId}`);
    const txt = input.value.trim();
    if (!txt) return;

    const { error } = await sb.from('comments').insert([{ 
        post_id: postId, 
        text: txt, 
        author_name: userProfile.username, 
        likes_count: 0 
    }]);

    if (error) {
        console.error("Comment Error:", error);
        alert("Database Error: " + error.message);
    } else {
        input.value = '';
        loadPosts(currentPublicId);
    }
}

async function toggleComments(postId) {
    const list = document.getElementById(`list-${postId}`);
    list.classList.toggle('hidden');
    if (!list.classList.contains('hidden')) {
        const { data } = await sb.from('comments').select('*').eq('post_id', postId).order('created_at', {ascending: true});
        list.innerHTML = data && data.length > 0 ? data.map(c => `
            <div class="comment-item">
                <div class="comm-meta">
                    <span>@${c.author_name}</span>
                    ${userProfile?.is_admin ? `<span style="color:red;cursor:pointer" onclick="deleteComm(${c.id})">${i18n[currentLang].delete}</span>` : ''}
                </div>
                <div>${c.text}</div>
                <div class="comm-actions" style="display:flex; gap:15px; margin-top:5px; font-size:10px; opacity:0.6">
                    <span style="cursor:pointer" onclick="likeComm(${c.id}, ${c.likes_count})">${i18n[currentLang].boost} ❤️ ${c.likes_count}</span>
                    <span style="cursor:pointer" onclick="replyTo('${c.author_name}', ${postId})">${i18n[currentLang].reply}</span>
                </div>
            </div>
        `).join('') : `<div style="font-size:11px;color:#555">${i18n[currentLang].no_responses}</div>`;
    }
}

function replyTo(name, postId) {
    const input = document.getElementById(`in-${postId}`);
    if (input) { input.value = `@${name}, `; input.focus(); }
}

// --- ВСПОМОГАТЕЛЬНЫЕ ДЕЙСТВИЯ ---
async function likePost(id, count) {
    await sb.from('posts').update({ likes_count: (count || 0) + (userProfile?.is_admin ? 10 : 1) }).eq('id', id);
    loadPosts(currentPublicId);
}
async function likeComm(id, count) {
    await sb.from('comments').update({ likes_count: (count || 0) + 1 }).eq('id', id);
    loadPosts(currentPublicId);
}
async function deletePost(id) { if (confirm("Erase?")) { await sb.from('posts').delete().eq('id', id); loadPosts(currentPublicId); } }
async function deleteComm(id) { if (confirm("Erase?")) { await sb.from('comments').delete().eq('id', id); loadPosts(currentPublicId); } }

async function handleAuth() {
    const callsign = document.getElementById('auth-username-input').value.trim();
    const pass = document.getElementById('auth-password').value;
    const techEmail = `${callsign.toLowerCase()}@thelastsignal.com`;
    if (isSignUp) {
        const { data, error } = await sb.auth.signUp({ email: techEmail, password: pass });
        if (error) return alert(error.message);
        await sb.from('profiles').insert([{ id: data.user.id, username: callsign, is_admin: false }]);
        alert(i18n[currentLang].reg_success);
        toggleAuthMode();
    } else {
        const { error } = await sb.auth.signInWithPassword({ email: techEmail, password: pass });
        if (error) alert("Access Denied"); else { closeModal(); checkUser(); }
    }
}

async function loadPublics() {
    const { data } = await sb.from('publics').select('*').order('is_verified', {ascending: false});
    const list = document.getElementById('publics-list');
    const select = document.getElementById('post-public-id');
    if (!list || !select) return;
    list.innerHTML = ''; select.innerHTML = '';
    data.forEach(pub => {
        list.innerHTML += `<div class="menu-item" onclick="loadPosts(${pub.id})"><img src="${pub.avatar_url || 'https://via.placeholder.com/40'}" class="mini-avatar"> ${pub.name} ${pub.is_verified ? '✔️' : ''}</div>`;
        select.innerHTML += `<option value="${pub.id}">${pub.name}</option>`;
    });
}

async function createNewPublic() {
    const name = document.getElementById('new-pub-name').value.trim();
    const isVerified = document.getElementById('new-pub-verify').checked;
    if (!name) return alert("Name required");

    const avatarUrl = await uploadToStorage(selectedPubFile, 'avatars');
    const { error } = await sb.from('publics').insert([{
        name, avatar_url: avatarUrl, is_verified: isVerified
    }]);

    if (!error) { alert("Channel Created"); loadPublics(); }
}

function logout() { sb.auth.signOut(); location.reload(); }
function showAuthModal() { document.getElementById('auth-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('auth-modal').classList.add('hidden'); }
function toggleAuthMode() { 
    isSignUp = !isSignUp; 
    document.getElementById('auth-title').innerText = isSignUp ? i18n[currentLang].establish.toUpperCase() : "CONNECTION";
    translateUI(); 
}
function toggleAdminPanel() { document.getElementById('admin-panel').classList.toggle('hidden'); }

// ПУСК
checkUser();