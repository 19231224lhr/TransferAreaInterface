// 前端实现 NewUser 逻辑：
// - 生成 ECDSA P-256 密钥对（WebCrypto）
// - 使用私钥 d 作为输入生成 8 位用户 ID（CRC32 结果映射）
// - 使用未压缩公钥(0x04 || X || Y)的 SHA-256 前 20 字节生成地址

try { window.addEventListener('error', function (e) { var m = String((e && e.message) || ''); var f = String((e && e.filename) || ''); if (m.indexOf('Cannot redefine property: ethereum') !== -1 || f.indexOf('evmAsk.js') !== -1) { if (e.preventDefault) e.preventDefault(); return true; } }, true); } catch (_) { }
try { window.addEventListener('unhandledrejection', function () { }, true); } catch (_) { }

const base64urlToBytes = (b64url) => {
  // 转换 base64url -> base64
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
  const str = atob(b64 + pad);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
};

const bytesToHex = (bytes) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
const hexToBytes = (hex) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
};
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let currentSelectedGroup = null;
const DEFAULT_GROUP = { groupID: '10000000', aggreNode: '39012088', assignNode: '17770032', pledgeAddress: '5bd548d76dcb3f9db1d213db01464406bef5dd09' };
const GROUP_LIST = [DEFAULT_GROUP];

const BASE_LIFT = 20;

const toFiniteNumber = (val) => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

function readAddressInterest(meta) {
  if (!meta) return 0;
  const props = ['gas', 'estInterest', 'interest', 'EstInterest'];
  for (const key of props) {
    if (meta[key] === undefined || meta[key] === null) continue;
    const num = toFiniteNumber(meta[key]);
    if (num !== null) return num;
  }
  return 0;
}

// CRC32（IEEE）
const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = crc32Table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

const generate8DigitFromInputHex = (hex) => {
  const enc = new TextEncoder();
  const s = String(hex).replace(/^0x/i, '').toLowerCase().replace(/^0+/, '');
  const bytes = enc.encode(s);
  const crc = crc32(bytes);
  const num = (crc % 90000000) + 10000000;
  return String(num).padStart(8, '0');
};

// 本地存储与头部用户栏渲染
const STORAGE_KEY = 'walletAccount';
function toAccount(basic, prev) {
  const isSame = prev && prev.accountId && basic && basic.accountId && prev.accountId === basic.accountId;
  const acc = isSame ? (prev ? JSON.parse(JSON.stringify(prev)) : {}) : {};
  acc.accountId = basic.accountId || acc.accountId || '';
  acc.orgNumber = acc.orgNumber || '';
  acc.flowOrigin = basic.flowOrigin || acc.flowOrigin || '';
  acc.keys = acc.keys || { privHex: '', pubXHex: '', pubYHex: '' };
  acc.keys.privHex = basic.privHex || acc.keys.privHex || '';
  acc.keys.pubXHex = basic.pubXHex || acc.keys.pubXHex || '';
  acc.keys.pubYHex = basic.pubYHex || acc.keys.pubYHex || '';
  acc.wallet = acc.wallet || { addressMsg: {}, totalTXCers: {}, totalValue: 0, valueDivision: { 0: 0, 1: 0, 2: 0 }, updateTime: Date.now(), updateBlock: 0 };
  acc.wallet.addressMsg = acc.wallet.addressMsg || {};
  const mainAddr = basic.address || acc.address || '';
  if (mainAddr) {
    acc.address = mainAddr;
    delete acc.wallet.addressMsg[mainAddr];
  }
  if (basic.wallet) {
    acc.wallet.addressMsg = { ...acc.wallet.addressMsg, ...(basic.wallet.addressMsg || {}) };
    if (basic.wallet.valueDivision) acc.wallet.valueDivision = { ...basic.wallet.valueDivision };
    if (basic.wallet.totalValue !== undefined) acc.wallet.totalValue = basic.wallet.totalValue;
    if (basic.wallet.TotalValue !== undefined) acc.wallet.TotalValue = basic.wallet.TotalValue;
    if (basic.wallet.history) acc.wallet.history = [...basic.wallet.history];
  }
  return acc;
}
function loadUser() {
  try {
    const rawAcc = localStorage.getItem(STORAGE_KEY);
    if (rawAcc) return JSON.parse(rawAcc);
    const legacy = localStorage.getItem('walletUser');
    if (legacy) {
      const basic = JSON.parse(legacy);
      const acc = toAccount(basic, null);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(acc)); } catch { }
      return acc;
    }
    return null;
  } catch (e) {
    console.warn('加载本地用户信息失败', e);
    return null;
  }
}
function updateHeaderUser(user) {
  const labelEl = document.getElementById('userLabel');
  const avatarEl = document.getElementById('userAvatar');
  const menuAccountEl = document.getElementById('menuAccountId');
  const menuAddrEl = document.getElementById('menuAddress');
  const menuAccountItem = document.getElementById('menuAccountItem');
  const menuAddressItem = document.getElementById('menuAddressItem');
  const menuOrgItem = document.getElementById('menuOrgItem');
  const menuBalanceItem = document.getElementById('menuBalanceItem');
  const menuOrgEl = document.getElementById('menuOrg');
  const menuBalanceEl = document.getElementById('menuBalance');
  const menuAddrPopup = document.getElementById('menuAddressPopup');
  const menuAddrList = document.getElementById('menuAddressList');
  const menuEmpty = document.getElementById('menuEmpty');
  const logoutEl = document.getElementById('logoutBtn');
  if (!labelEl || !avatarEl) return; // header 不存在时忽略
  if (user && user.accountId) {
    labelEl.textContent = user.accountId;
    // 头像保持固定，不再随ID变化
    avatarEl.textContent = '👤';
    avatarEl.classList.add('avatar--active');
    if (menuAccountItem) menuAccountItem.classList.remove('hidden');
    if (menuAddressItem) menuAddressItem.classList.remove('hidden');
    const mainAddr = user.address || (user.wallet && Object.keys(user.wallet.addressMsg || {})[0]) || '';
    if (menuAccountEl) menuAccountEl.textContent = user.accountId || '';
    const subMap = (user.wallet && user.wallet.addressMsg) || {};
    const addrCount = Object.keys(subMap).length;
    if (menuAddrEl) menuAddrEl.textContent = addrCount + ' 个地址';
    if (menuAddrPopup) menuAddrPopup.classList.add('hidden');
    if (menuOrgItem) menuOrgItem.classList.remove('hidden');
    if (menuBalanceItem) menuBalanceItem.classList.remove('hidden');
    if (menuOrgEl) menuOrgEl.textContent = computeCurrentOrgId() || '暂未加入担保组织';
    if (menuBalanceEl) menuBalanceEl.textContent = (typeof user.balance === 'number' ? user.balance : 0) + ' BTC';
    if (menuOrgEl) menuOrgEl.classList.remove('code-waiting');
    if (menuEmpty) menuEmpty.classList.add('hidden');
    if (logoutEl) {
      logoutEl.disabled = false;
      logoutEl.classList.remove('menu-action--disabled');
      logoutEl.textContent = '退出登录';
    }
  } else {
    labelEl.textContent = '未登录';
    avatarEl.textContent = '👤';
    avatarEl.classList.remove('avatar--active');
    if (menuAccountItem) menuAccountItem.classList.add('hidden');
    if (menuAddressItem) menuAddressItem.classList.add('hidden');
    if (menuAccountEl) menuAccountEl.textContent = '';
    if (menuAddrEl) menuAddrEl.textContent = '';
    if (menuOrgItem) menuOrgItem.classList.add('hidden');
    if (menuBalanceItem) menuBalanceItem.classList.add('hidden');
    if (menuOrgEl) menuOrgEl.textContent = '';
    if (menuBalanceEl) menuBalanceEl.textContent = '';
    if (menuOrgEl) menuOrgEl.classList.add('code-waiting');
    if (menuEmpty) menuEmpty.classList.remove('hidden');
    if (logoutEl) {
      logoutEl.disabled = true;
      logoutEl.classList.add('menu-action--disabled');
      logoutEl.textContent = '等待登录';
    }
    if (menuAddrList) menuAddrList.innerHTML = '';
    if (menuAddrPopup) menuAddrPopup.classList.add('hidden');
  }
  if (menuAddressItem && !menuAddressItem.dataset._bind) {
    menuAddressItem.addEventListener('click', (e) => {
      e.stopPropagation();
      const u = loadUser();
      const popup = document.getElementById('menuAddressPopup');
      const list = document.getElementById('menuAddressList');
      if (!popup || !list) return;
      const map = (u && u.wallet && u.wallet.addressMsg) || {};
      let html = '<div class="tip" style="margin:2px 0 6px;color:#667085;">提示：登录账号的地址不计入列表</div>';
      Object.keys(map).forEach((k) => {
        if (u && u.address && String(k).toLowerCase() === String(u.address).toLowerCase()) return;
        const m = map[k];
        const type = Number(m.type || 0);
        const val = Number(m.value && (m.value.totalValue || m.value.TotalValue) || 0);
        const rate = type === 1 ? 100 : (type === 2 ? 10 : 1);
        const v = Math.round(val * rate);
        html += `<div class="addr-row" style="display:flex;justify-content:space-between;gap:6px;align-items:center;margin:4px 0;">
          <code class="break" style="max-width:150px;background:#f6f8fe;padding:4px 6px;border-radius:8px;">${k}</code>
          <span style="color:#667085;font-weight:600;min-width:64px;text-align:right;white-space:nowrap;">${v} USDT</span>
        </div>`;
      });
      if (Object.keys(map).length === 0) html += '<div class="tip">暂无地址</div>';
      list.innerHTML = html;
      popup.classList.toggle('hidden');
    });
    const popup = document.getElementById('menuAddressPopup');
    if (popup) popup.addEventListener('click', (e) => e.stopPropagation());
    menuAddressItem.dataset._bind = '1';
  }
}
function saveUser(user) {
  try {
    const prev = loadUser();
    const acc = toAccount(user, prev);

    // 历史余额记录逻辑
    if (!acc.wallet) acc.wallet = {};
    if (!acc.wallet.history) acc.wallet.history = [];

    // 计算当前总资产 (USDT)
    const vd = acc.wallet.valueDivision || { 0: 0, 1: 0, 2: 0 };
    const pgc = Number(vd[0] || 0);
    const btc = Number(vd[1] || 0);
    const eth = Number(vd[2] || 0);
    const totalUsdt = Math.round(pgc * 1 + btc * 100 + eth * 10);

    const now = Date.now();
    const last = acc.wallet.history[acc.wallet.history.length - 1];

    // 如果是新的记录（值变化或时间超过1分钟），则添加
    // 或者如果是第一条记录
    if (!last || last.v !== totalUsdt || (now - last.t > 60000)) {
      acc.wallet.history.push({ t: now, v: totalUsdt });
      // 限制历史记录长度，保留最近100条
      if (acc.wallet.history.length > 100) {
        acc.wallet.history = acc.wallet.history.slice(-100);
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(acc));
    updateHeaderUser(acc);
    updateOrgDisplay();

    // 触发图表更新
    if (typeof updateWalletChart === 'function') {
      updateWalletChart(acc);
    }
  } catch (e) {
    console.warn('保存本地用户信息失败', e);
  }
}
function getActionModalElements() {
  const modal = document.getElementById('actionModal');
  const titleEl = document.getElementById('actionTitle');
  const textEl = document.getElementById('actionText');
  const okEl = document.getElementById('actionOkBtn');
  const cancelEl = document.getElementById('actionCancelBtn');
  if (cancelEl) {
    cancelEl.classList.add('hidden');
    cancelEl.onclick = null;
  }
  return { modal, titleEl, textEl, okEl, cancelEl };
}
function showModalTip(title, html, isError) {
  const { modal, titleEl, textEl, okEl } = getActionModalElements();
  if (titleEl) titleEl.textContent = title || '';
  if (textEl) {
    if (isError) textEl.classList.add('tip--error'); else textEl.classList.remove('tip--error');
    textEl.innerHTML = html || '';
  }
  if (modal) modal.classList.remove('hidden');
  const handler = () => { modal.classList.add('hidden'); okEl && okEl.removeEventListener('click', handler); };
  okEl && okEl.addEventListener('click', handler);
}
function showConfirmModal(title, html, okText, cancelText) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmGasModal');
    const titleEl = document.getElementById('confirmGasTitle');
    const textEl = document.getElementById('confirmGasText');
    const okEl = document.getElementById('confirmGasOk');
    const cancelEl = document.getElementById('confirmGasCancel');
    if (!modal || !okEl || !cancelEl) {
      resolve(true);
      return;
    }
    if (titleEl) titleEl.textContent = title || '确认操作';
    if (textEl) {
      textEl.innerHTML = html || '';
      textEl.classList.remove('tip--error');
    }
    if (okText) okEl.textContent = okText;
    if (cancelText) cancelEl.textContent = cancelText;
    modal.classList.remove('hidden');
    const cleanup = (result) => {
      modal.classList.add('hidden');
      okEl.removeEventListener('click', onOk);
      cancelEl.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okEl.addEventListener('click', onOk);
    cancelEl.addEventListener('click', onCancel);
  });
}
function clearAccountStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { }
  try { localStorage.removeItem('walletUser'); } catch { }
}

function resetOrgSelectionForNewUser() {
  let changed = false;
  try {
    if (localStorage.getItem('guarChoice')) {
      localStorage.removeItem('guarChoice');
      changed = true;
    }
  } catch (_) { }
  const current = loadUser();
  if (current && (current.orgNumber || current.guarGroup)) {
    current.orgNumber = '';
    current.guarGroup = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch (_) { }
    updateHeaderUser(current);
    changed = true;
  }
  if (changed) {
    updateOrgDisplay();
    if (typeof refreshOrgPanel === 'function') {
      try { refreshOrgPanel(); } catch (_) { }
    }
  }
}

function clearUIState() {
  const newResult = document.getElementById('result');
  if (newResult) {
    newResult.classList.add('hidden');
  }
  const ids1 = ['accountId', 'address', 'privHex', 'pubX', 'pubY'];
  ids1.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  const newLoader = document.getElementById('newLoader');
  if (newLoader) newLoader.classList.add('hidden');
  const importInput = document.getElementById('importPrivHex');
  if (importInput) importInput.value = '';
  const importResult = document.getElementById('importResult');
  if (importResult) importResult.classList.add('hidden');
  const ids2 = ['importAccountId', 'importAddress', 'importPrivHexOut', 'importPubX', 'importPubY'];
  ids2.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  const importLoader = document.getElementById('importLoader');
  if (importLoader) importLoader.classList.add('hidden');
  const importNextBtn2 = document.getElementById('importNextBtn');
  if (importNextBtn2) importNextBtn2.classList.add('hidden');
  const createBtnEl = document.getElementById('createBtn');
  const newNextBtnEl = document.getElementById('newNextBtn');
  if (createBtnEl) createBtnEl.classList.add('hidden');
  if (newNextBtnEl) newNextBtnEl.classList.add('hidden');
  const loginInput = document.getElementById('loginPrivHex');
  if (loginInput) loginInput.value = '';
  const loginResult = document.getElementById('loginResult');
  if (loginResult) loginResult.classList.add('hidden');
  const ids3 = ['loginAccountId', 'loginAddress', 'loginPrivOut', 'loginPubX', 'loginPubY'];
  ids3.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  const loginLoader = document.getElementById('loginLoader');
  if (loginLoader) loginLoader.classList.add('hidden');
  const loginNextBtn2 = document.getElementById('loginNextBtn');
  if (loginNextBtn2) loginNextBtn2.classList.add('hidden');
}

async function newUser() {
  // 生成密钥对
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  // 导出 JWK，获取私钥 d、公钥 x/y
  const jwkPub = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const jwkPriv = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  const dBytes = base64urlToBytes(jwkPriv.d);
  const xBytes = base64urlToBytes(jwkPub.x);
  const yBytes = base64urlToBytes(jwkPub.y);

  const privHex = bytesToHex(dBytes);
  const pubXHex = bytesToHex(xBytes);
  const pubYHex = bytesToHex(yBytes);

  // 未压缩公钥: 0x04 || X || Y
  const uncompressed = new Uint8Array(1 + xBytes.length + yBytes.length);
  uncompressed[0] = 0x04;
  uncompressed.set(xBytes, 1);
  uncompressed.set(yBytes, 1 + xBytes.length);

  // 地址 = SHA-256(uncompressed)[0..20]
  const sha = await crypto.subtle.digest('SHA-256', uncompressed);
  const address = bytesToHex(new Uint8Array(sha).slice(0, 20));

  // 用户ID = 8位数（与 Go 中 Generate8DigitNumberBasedOnInput 对齐）
  const accountId = generate8DigitFromInputHex(privHex);

  return { accountId, address, privHex, pubXHex, pubYHex };
}

async function handleCreate() {
  const btn = document.getElementById('createBtn');
  btn.disabled = true;
  try {
    const loader = document.getElementById('newLoader');
    const resultEl = document.getElementById('result');
    const nextBtn = document.getElementById('newNextBtn');
    if (btn) btn.classList.add('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');
    if (resultEl) resultEl.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');
    const t0 = Date.now();
    let data;
    try {
      const res = await fetch('/api/account/new', { method: 'POST' });
      if (res.ok) {
        data = await res.json();
      } else {
        data = await newUser();
      }
    } catch (_) {
      data = await newUser();
    }
    const elapsed = Date.now() - t0;
    if (elapsed < 1000) await wait(1000 - elapsed);
    if (loader) loader.classList.add('hidden');
    resultEl.classList.remove('hidden');
    resultEl.classList.remove('fade-in');
    resultEl.classList.remove('reveal');
    requestAnimationFrame(() => resultEl.classList.add('reveal'));
    document.getElementById('accountId').textContent = data.accountId;
    document.getElementById('address').textContent = data.address;
    document.getElementById('privHex').textContent = data.privHex;
    document.getElementById('pubX').textContent = data.pubXHex;
    document.getElementById('pubY').textContent = data.pubYHex;
    saveUser({ accountId: data.accountId, address: data.address, privHex: data.privHex, pubXHex: data.pubXHex, pubYHex: data.pubYHex, flowOrigin: 'new' });
    if (btn) btn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
  } catch (err) {
    alert('创建用户失败：' + err);
    console.error(err);
    const nextBtn = document.getElementById('newNextBtn');
    if (btn) btn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    const loader = document.getElementById('newLoader');
    if (loader) loader.classList.add('hidden');
  }
}

const createBtn = document.getElementById('createBtn');
createBtn.addEventListener('click', (evt) => {
  const btn = evt.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  const x = evt.clientX - rect.left - size / 2;
  const y = evt.clientY - rect.top - size / 2;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});
createBtn.addEventListener('click', handleCreate);

const welcomeCard = document.getElementById('welcomeCard');
const entryCard = document.getElementById('entryCard');
const newUserCard = document.getElementById('newUserCard');
const loginCard = document.getElementById('loginCard');
const importCard = document.getElementById('importCard');
const createWalletBtn = document.getElementById('createWalletBtn');
const importWalletBtn = document.getElementById('importWalletBtn');
const importBtn = document.getElementById('importBtn');
const loginBtn = document.getElementById('loginBtn');
const loginNextBtn = document.getElementById('loginNextBtn');
const loginAccountBtn = document.getElementById('loginAccountBtn');
const registerAccountBtn = document.getElementById('registerAccountBtn');
const entryNextBtn = document.getElementById('entryNextBtn');

function showCard(card) {
  // 隐藏其他卡片
  if (welcomeCard) welcomeCard.classList.add('hidden');
  if (entryCard) entryCard.classList.add('hidden');
  if (newUserCard) newUserCard.classList.add('hidden');
  if (loginCard) loginCard.classList.add('hidden');
  if (importCard) importCard.classList.add('hidden');
  const nextCard = document.getElementById('nextCard');
  if (nextCard) nextCard.classList.add('hidden');
  const finalCard = document.getElementById('finalCard');
  if (finalCard) finalCard.classList.add('hidden');
  const walletCard = document.getElementById('walletCard');
  if (walletCard) walletCard.classList.add('hidden');
  const importNextCard = document.getElementById('importNextCard');
  if (importNextCard) importNextCard.classList.add('hidden');
  const inquiryCard = document.getElementById('inquiryCard');
  if (inquiryCard) inquiryCard.classList.add('hidden');
  const memberInfoCard = document.getElementById('memberInfoCard');
  if (memberInfoCard) memberInfoCard.classList.add('hidden');
  const newLoader = document.getElementById('newLoader');
  if (newLoader) newLoader.classList.add('hidden');
  const importLoader = document.getElementById('importLoader');
  if (importLoader) importLoader.classList.add('hidden');
  const suggest = document.getElementById('groupSuggest');
  if (suggest) suggest.classList.add('hidden');
  const joinOverlay = document.getElementById('joinOverlay');
  if (joinOverlay) joinOverlay.classList.add('hidden');
  const confirmSkipModal = document.getElementById('confirmSkipModal');
  if (confirmSkipModal) confirmSkipModal.classList.add('hidden');
  const actionOverlay = document.getElementById('actionOverlay');
  if (actionOverlay) actionOverlay.classList.add('hidden');
  const actionModal = document.getElementById('actionModal');
  if (actionModal) actionModal.classList.add('hidden');
  const joinSearchBtn2 = document.getElementById('joinSearchBtn');
  if (joinSearchBtn2) joinSearchBtn2.disabled = true;
  const sr2 = document.getElementById('searchResult');
  if (sr2) sr2.classList.add('hidden');
  const recPane2 = document.getElementById('recPane');
  if (recPane2) recPane2.classList.remove('collapsed');
  const gs2 = document.getElementById('groupSearch');
  if (gs2) gs2.value = '';
  const allCards = document.querySelectorAll('.card');
  allCards.forEach(el => { if (el !== card) el.classList.add('hidden'); });
  // 显示指定卡片
  card.classList.remove('hidden');
  // 轻微过渡动画
  card.classList.remove('fade-in');
  requestAnimationFrame(() => card.classList.add('fade-in'));
}

// 简易哈希路由
function routeTo(hash) {
  if (location.hash !== hash) {
    location.hash = hash;
  }
  // 立即执行一次路由作为兜底，避免某些环境下 hashchange 未触发
  router();
}

function getJoinedGroup() {
  try {
    const raw = localStorage.getItem('guarChoice');
    if (raw) {
      const c = JSON.parse(raw);
      if (c && c.groupID) {
        const g = (typeof GROUP_LIST !== 'undefined' && Array.isArray(GROUP_LIST)) ? GROUP_LIST.find(x => x.groupID === c.groupID) : null;
        return g || (typeof DEFAULT_GROUP !== 'undefined' ? DEFAULT_GROUP : null);
      }
    }
  } catch { }
  const u = loadUser();
  const gid = u && (u.orgNumber || (u.guarGroup && u.guarGroup.groupID));
  if (gid) {
    const g = (typeof GROUP_LIST !== 'undefined' && Array.isArray(GROUP_LIST)) ? GROUP_LIST.find(x => x.groupID === gid) : null;
    return g || (typeof DEFAULT_GROUP !== 'undefined' ? DEFAULT_GROUP : null);
  }
  return null;
}

function router() {
  const h = (location.hash || '#/welcome').replace(/^#/, '');
  const u = loadUser();
  const allowNoUser = ['/welcome', '/login', '/new'];
  if (!u && allowNoUser.indexOf(h) === -1) {
    routeTo('#/welcome');
    return;
  }
  switch (h) {
    case '/welcome':
      showCard(welcomeCard);
      break;
    case '/main':
      showCard(document.getElementById('walletCard'));
      try {
        const raw = localStorage.getItem('guarChoice');
        const choice = raw ? JSON.parse(raw) : null;
        if (choice && choice.type === 'join') {
          const u2 = loadUser();
          if (u2) {
            u2.orgNumber = choice.groupID;
            const g = (typeof GROUP_LIST !== 'undefined' && Array.isArray(GROUP_LIST)) ? GROUP_LIST.find(x => x.groupID === choice.groupID) : null;
            u2.guarGroup = g || (typeof DEFAULT_GROUP !== 'undefined' ? DEFAULT_GROUP : null);
            saveUser(u2);
          }
        }
      } catch (_) { }
      renderWallet();
      refreshOrgPanel();
      break;
    case '/entry':
      showCard(entryCard);
      updateWalletBrief();
      break;
    case '/login':
      showCard(loginCard);
      const lnb = document.getElementById('loginNextBtn');
      if (lnb) lnb.classList.add('hidden');
      {
        const inputEl = document.getElementById('loginPrivHex');
        if (inputEl) inputEl.value = '';
        const resEl = document.getElementById('loginResult');
        if (resEl) resEl.classList.add('hidden');
        const ids = ['loginAccountId', 'loginAddress', 'loginPrivOut', 'loginPubX', 'loginPubY'];
        ids.forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = ''; });
        const loaderEl = document.getElementById('loginLoader');
        if (loaderEl) loaderEl.classList.add('hidden');
      }
      break;
    case '/new':
      resetOrgSelectionForNewUser();
      showCard(newUserCard);
      // 如果尚未生成，则自动生成一次
      const resultEl = document.getElementById('result');
      if (resultEl && resultEl.classList.contains('hidden')) {
        handleCreate().catch(() => { });
      }
      break;
    case '/wallet-import':
      showCard(importCard);
      const importNextBtn = document.getElementById('importNextBtn');
      if (importNextBtn) importNextBtn.classList.add('hidden');
      if (importBtn) importBtn.dataset.mode = 'wallet';
      {
        const inputEl = document.getElementById('importPrivHex');
        if (inputEl) inputEl.value = '';
        const { modal: modalE, textEl: textE } = getActionModalElements();
        if (textE) textE.classList.remove('tip--error');
        if (modalE) modalE.classList.add('hidden');
        const brief = document.getElementById('walletBriefList');
        const toggleBtn = document.getElementById('briefToggleBtn');
        if (brief) { brief.classList.add('hidden'); brief.innerHTML = ''; }
        if (toggleBtn) toggleBtn.classList.add('hidden');
        const addrError2 = document.getElementById('addrError');
        if (addrError2) { addrError2.textContent = ''; addrError2.classList.add('hidden'); }
        const addrPrivHex2 = document.getElementById('addrPrivHex');
        if (addrPrivHex2) addrPrivHex2.value = '';
      }
      break;
    case '/join-group':
      {
        const g0 = getJoinedGroup();
        const joined = !!(g0 && g0.groupID);
        if (joined) { routeTo('#/inquiry-main'); break; }
      }
      showCard(document.getElementById('nextCard'));
      currentSelectedGroup = DEFAULT_GROUP;
      const recGroupID = document.getElementById('recGroupID');
      const recAggre = document.getElementById('recAggre');
      const recAssign = document.getElementById('recAssign');
      const recPledge = document.getElementById('recPledge');
      if (recGroupID) recGroupID.textContent = DEFAULT_GROUP.groupID;
      if (recAggre) recAggre.textContent = DEFAULT_GROUP.aggreNode;
      if (recAssign) recAssign.textContent = DEFAULT_GROUP.assignNode;
      if (recPledge) recPledge.textContent = DEFAULT_GROUP.pledgeAddress;
      break;
    case '/inquiry':
      showCard(document.getElementById('inquiryCard'));
      setTimeout(() => {
        const u3 = loadUser();
        if (u3) {
          u3.orgNumber = '10000000';
          saveUser(u3);
        }
        routeTo('#/member-info');
      }, 2000);
      break;
    case '/inquiry-main':
      showCard(document.getElementById('inquiryCard'));
      setTimeout(() => {
        routeTo('#/main');
      }, 2000);
      break;
    case '/member-info':
      showCard(document.getElementById('memberInfoCard'));
      {
        const u4 = loadUser();
        const aEl = document.getElementById('miAccountId');
        const addrEl = document.getElementById('miAddress');
        const gEl = document.getElementById('miGroupId');
        const pgcEl = document.getElementById('miPGC');
        const btcEl = document.getElementById('miBTC');
        const ethEl = document.getElementById('miETH');
        if (aEl) aEl.textContent = (u4 && u4.accountId) || '';
        if (addrEl) addrEl.textContent = (u4 && u4.address) || '';
        if (gEl) gEl.textContent = (u4 && u4.orgNumber) || '10000000';
        if (pgcEl) pgcEl.textContent = 'PGC: 0';
        if (btcEl) btcEl.textContent = 'BTC: 0';
        if (ethEl) ethEl.textContent = 'ETH: 0';
      }
      break;
    case '/next':
      routeTo('#/join-group');
      break;
    case '/main':
      showCard(document.getElementById('walletCard'));
      try {
        const raw = localStorage.getItem('guarChoice');
        const choice = raw ? JSON.parse(raw) : null;
        if (choice && choice.type === 'join') {
          const u = loadUser();
          if (u) {
            u.orgNumber = choice.groupID;
            const g = (typeof GROUP_LIST !== 'undefined' && Array.isArray(GROUP_LIST)) ? GROUP_LIST.find(x => x.groupID === choice.groupID) : null;
            u.guarGroup = g || (typeof DEFAULT_GROUP !== 'undefined' ? DEFAULT_GROUP : null);
            saveUser(u);
          }
        }
      } catch (_) { }
      renderWallet();
      refreshOrgPanel();
      break;
    case '/import-next':
      showCard(document.getElementById('importNextCard'));
      break;
    default:
      routeTo('#/welcome');
      break;
  }
}
window.__lastHash = location.hash || '#/welcome';
window.__skipExitConfirm = false;
window.addEventListener('hashchange', () => {
  const newHash = location.hash || '#/entry';
  const oldHash = window.__lastHash || '#/entry';
  const u = loadUser();
  const goingBackToEntry = (oldHash === '#/new' || oldHash === '#/import') && newHash === '#/entry';
  if (window.__skipExitConfirm) {
    window.__skipExitConfirm = false;
    window.__lastHash = newHash;
    router();
    return;
  }
  if (u && goingBackToEntry) {
    if (window.__confirmingBack) return;
    window.__confirmingBack = true;
    // 恢复旧页面，避免浏览器先跳走
    location.replace(oldHash);
    const modal = document.getElementById('confirmExitModal');
    const okBtn = document.getElementById('confirmExitOk');
    const cancelBtn = document.getElementById('confirmExitCancel');
    if (modal && okBtn && cancelBtn) {
      modal.classList.remove('hidden');
      const okHandler = () => {
        clearAccountStorage();
        updateHeaderUser(null);
        clearUIState();
        modal.classList.add('hidden');
        window.__lastHash = '#/entry';
        location.replace('#/entry');
        router();
        okBtn.removeEventListener('click', okHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        window.__confirmingBack = false;
      };
      const cancelHandler = () => {
        modal.classList.add('hidden');
        window.__lastHash = oldHash;
        router();
        okBtn.removeEventListener('click', okHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        window.__confirmingBack = false;
      };
      okBtn.addEventListener('click', okHandler);
      cancelBtn.addEventListener('click', cancelHandler);
    } else {
      window.__confirmingBack = false;
    }
    return;
  }
  window.__lastHash = newHash;
  router();
});
// 初始路由：无 hash 时设为入口
const initialUser = loadUser();
if (!location.hash) {
  location.replace('#/welcome');
}
// 执行一次路由以同步初始视图
router();

// 使用 popstate 拦截浏览器返回，先确认再跳转
window.addEventListener('popstate', (e) => {
  const state = e.state || {};
  if (state.guard && (state.from === '/new' || state.from === '/import')) {
    try { history.pushState(state, '', location.href); } catch { }
    const modal = document.getElementById('confirmExitModal');
    const okBtn = document.getElementById('confirmExitOk');
    const cancelBtn = document.getElementById('confirmExitCancel');
    if (modal && okBtn && cancelBtn) {
      modal.classList.remove('hidden');
      const okHandler = () => {
        try { localStorage.removeItem(STORAGE_KEY); } catch { }
        updateHeaderUser(null);
        clearUIState();
        modal.classList.add('hidden');
        routeTo('#/entry');
        okBtn.removeEventListener('click', okHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
      };
      const cancelHandler = () => {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', okHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
      };
      okBtn.addEventListener('click', okHandler);
      cancelBtn.addEventListener('click', cancelHandler);
    }
  }
});

// 点击“新建钱包”：切换到路由并自动生成
async function addNewSubWallet() {
  const u = loadUser();
  if (!u || !u.accountId) { alert('请先登录或注册账户'); return; }
  const ov = document.getElementById('actionOverlay');
  const ovt = document.getElementById('actionOverlayText');
  if (ovt) ovt.textContent = '正在新增钱包地址...';
  if (ov) ov.classList.remove('hidden');
  try {
    const t0 = Date.now();
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    const jwkPub = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const jwkPriv = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const dBytes = base64urlToBytes(jwkPriv.d);
    const xBytes = base64urlToBytes(jwkPub.x);
    const yBytes = base64urlToBytes(jwkPub.y);
    const privHex = bytesToHex(dBytes);
    const pubXHex = bytesToHex(xBytes);
    const pubYHex = bytesToHex(yBytes);
    const uncompressed = new Uint8Array(1 + xBytes.length + yBytes.length);
    uncompressed[0] = 0x04;
    uncompressed.set(xBytes, 1);
    uncompressed.set(yBytes, 1 + xBytes.length);
    const sha = await crypto.subtle.digest('SHA-256', uncompressed);
    const addr = bytesToHex(new Uint8Array(sha).slice(0, 20));
    const elapsed = Date.now() - t0;
    if (elapsed < 800) { await new Promise(r => setTimeout(r, 800 - elapsed)); }
    const acc = toAccount({ accountId: u.accountId, address: u.address }, u);
    acc.wallet.addressMsg[addr] = acc.wallet.addressMsg[addr] || { type: 0, utxos: {}, txCers: {}, value: { totalValue: 0, utxoValue: 0, txCerValue: 0 }, estInterest: 0, origin: 'created' };
    acc.wallet.addressMsg[addr].privHex = privHex;
    acc.wallet.addressMsg[addr].pubXHex = pubXHex;
    acc.wallet.addressMsg[addr].pubYHex = pubYHex;
    saveUser(acc);
    if (window.__refreshSrcAddrList) { try { window.__refreshSrcAddrList(); } catch (_) { } }
    try { renderWallet(); } catch { }
    try {
      updateWalletBrief();
      requestAnimationFrame(() => updateWalletBrief());
      setTimeout(() => updateWalletBrief(), 0);
    } catch { }
    const { modal, titleEl: title, textEl: text, okEl: ok } = getActionModalElements();
    if (title) title.textContent = '新增钱包成功';
    if (text) text.textContent = '已新增一个钱包地址';
    if (modal) modal.classList.remove('hidden');
    const handler = () => { modal.classList.add('hidden'); try { renderWallet(); updateWalletBrief(); } catch { } ok && ok.removeEventListener('click', handler); };
    ok && ok.addEventListener('click', handler);
  } catch (e) {
    alert('新增地址失败：' + (e && e.message ? e.message : e));
    console.error(e);
  } finally {
    if (ov) ov.classList.add('hidden');
  }
}
if (createWalletBtn && !createWalletBtn.dataset._bind) {
  createWalletBtn.addEventListener('click', addNewSubWallet);
  createWalletBtn.dataset._bind = '1';
}
if (importWalletBtn && !importWalletBtn.dataset._bind) {
  importWalletBtn.addEventListener('click', () => routeTo('#/wallet-import'));
  importWalletBtn.dataset._bind = '1';
}

const miConfirmBtn = document.getElementById('miConfirmBtn');
if (miConfirmBtn && !miConfirmBtn.dataset._bind) {
  miConfirmBtn.addEventListener('click', () => routeTo('#/main'));
  miConfirmBtn.dataset._bind = '1';
}

function updateWalletBrief() {
  const u = loadUser();
  const countEl = document.getElementById('walletCount');
  const brief = document.getElementById('walletBriefList');
  const tip = document.getElementById('walletEmptyTip');
  const addrs = u && u.wallet ? Object.keys(u.wallet.addressMsg || {}) : [];
  if (countEl) countEl.textContent = String(addrs.length);
  if (brief) {
    if (addrs.length) {
      brief.classList.remove('hidden');
      const originOf = (addr) => {
        const u2 = loadUser();
        const ori = u2 && u2.wallet && u2.wallet.addressMsg && u2.wallet.addressMsg[addr] && u2.wallet.addressMsg[addr].origin ? u2.wallet.addressMsg[addr].origin : '';
        return ori === 'created' ? { label: '新建', cls: 'origin--created' } : (ori === 'imported' ? { label: '导入', cls: 'origin--imported' } : { label: '未知', cls: 'origin--unknown' });
      };
      brief.classList.add('list');
      const items = addrs.map(a => {
        const o = originOf(a);
        return `<li class=\"brief-item\" data-addr=\"${a}\"><div class=\"brief-content\"><span class=\"addr-text\">${a}</span><span class=\"origin-badge ${o.cls}\">${o.label}</span><button class=\"brief-del\" title=\"删除\">×</button></div></li>`;
      }).join('');
      brief.innerHTML = items;
      // 折叠超过3项
      const toggleBtn = document.getElementById('briefToggleBtn');
      if (addrs.length > 3) {
        brief.classList.add('collapsed');
        if (toggleBtn) { toggleBtn.classList.remove('hidden'); toggleBtn.textContent = '展开更多'; }
      } else {
        brief.classList.remove('collapsed');
        if (toggleBtn) toggleBtn.classList.add('hidden');
      }
    } else {
      brief.classList.add('hidden');
      brief.innerHTML = '';
    }
  }
  if (entryNextBtn) entryNextBtn.disabled = (addrs.length === 0) && !(u && u.orgNumber);
  if (tip) {
    if (addrs.length === 0 && !(u && u.orgNumber)) tip.classList.remove('hidden'); else tip.classList.add('hidden');
  }
}

function showDetailModal(title, htmlContent) {
  const modal = document.getElementById('detailModal');
  const modalTitle = document.getElementById('detailModalTitle');
  const modalContent = document.getElementById('detailModalContent');
  const closeBtn = document.getElementById('detailModalClose');
  if (!modal || !modalTitle || !modalContent) return;
  modalTitle.textContent = title;
  modalContent.innerHTML = htmlContent;
  modal.classList.remove('hidden');
  const closeHandler = () => {
    modal.classList.add('hidden');
  };
  if (closeBtn) closeBtn.onclick = closeHandler;
}

window.showUtxoDetail = (addrKey, utxoKey) => {
  const u = loadUser();
  if (!u || !u.wallet || !u.wallet.addressMsg) return;
  const addrMsg = u.wallet.addressMsg[addrKey];
  if (!addrMsg || !addrMsg.utxos) return;
  const utxo = addrMsg.utxos[utxoKey];
  if (!utxo) return;

  const getLabel = (type) => {
    const labels = { 0: 'PGC', 1: 'BTC', 2: 'ETH' };
    return labels[type] || 'UNKNOWN';
  };

  let html = '';
  html += `<div class="detail-row"><div class="detail-label">UTXO Key</div><div class="detail-val">${utxoKey}</div></div>`;
  html += `<div class="detail-row"><div class="detail-label">Value</div><div class="detail-val">${utxo.Value || 0}</div></div>`;
  html += `<div class="detail-row"><div class="detail-label">Type</div><div class="detail-val">${getLabel(utxo.Type || 0)}</div></div>`;
  html += `<div class="detail-row"><div class="detail-label">Time</div><div class="detail-val">${utxo.Time || 0}</div></div>`;
  
  if (utxo.Position) {
    html += `<div class="detail-row"><div class="detail-label">Position</div><div class="detail-val">
      Block: ${utxo.Position.Blocknum}, IdxX: ${utxo.Position.IndexX}, IdxY: ${utxo.Position.IndexY}, IdxZ: ${utxo.Position.IndexZ}
    </div></div>`;
  }
  
  html += `<div class="detail-row"><div class="detail-label">Is TXCer</div><div class="detail-val">${utxo.IsTXCerUTXO ? 'Yes' : 'No'}</div></div>`;
  
  if (utxo.UTXO) {
    html += `<div class="detail-row"><div class="detail-label">Source TX</div><div class="detail-val">
      <div class="detail-sub">
        <div style="margin-bottom:4px">TXID: ${utxo.UTXO.TXID || 'N/A'}</div>
        <div>VOut: ${utxo.UTXO.VOut}</div>
      </div>
    </div></div>`;
  }

  showDetailModal('UTXO 详情', html);
};

function updateWalletStruct() {
  const box = document.getElementById('walletStructBox');
  const u = loadUser();
  if (!box || !u || !u.wallet) return;
  const w = u.wallet || {};
  const addr = w.addressMsg || {};
  const sums = { 0: 0, 1: 0, 2: 0 };
  Object.keys(addr).forEach((k) => {
    const m = addr[k] || {};
    const type = Number(m.type || 0);
    const val = Number(m.value && (m.value.totalValue || m.value.TotalValue) || 0);
    if (sums[type] !== undefined) sums[type] += val;
  });
  const totalPGC = Number(sums[0] || 0) + Number(sums[1] || 0) * 1000000 + Number(sums[2] || 0) * 1000;

  // Helper functions for rendering
  const getCoinLabel = (type) => {
    const labels = { 0: 'PGC', 1: 'BTC', 2: 'ETH' };
    const colors = { 0: '#10b981', 1: '#f59e0b', 2: '#3b82f6' };
    return `<span class="coin-tag" style="background:${colors[type] || '#6b7280'}20;color:${colors[type] || '#6b7280'};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">${labels[type] || 'UNKNOWN'}</span>`;
  };

  const renderValue = (val) => {
    if (typeof val === 'object' && val !== null) {
      if (Array.isArray(val)) return `<span style="color:#94a3b8;">[${val.length} items]</span>`;
      const keys = Object.keys(val);
      if (keys.length === 0) return `<span style="color:#94a3b8;">{}</span>`;
      return `<span style="color:#94a3b8;">{${keys.length} keys}</span>`;
    }
    if (typeof val === 'string') return `<span style="color:#0ea5e9;">"${val}"</span>`;
    if (typeof val === 'number') return `<span style="color:#8b5cf6;">${val}</span>`;
    if (typeof val === 'boolean') return `<span style="color:#ec4899;">${val}</span>`;
    return `<span style="color:#64748b;">${val}</span>`;
  };

  const createField = (label, value, isHighlight = false) => {
    return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
      <span style="color:#475569;font-size:12px;min-width:100px;">${label}:</span>
      ${isHighlight ? `<strong>${value}</strong>` : value}
    </div>`;
  };

  // Build HTML
  let html = '<div style="font-family:\'Inter\', sans-serif;font-size:13px;line-height:1.6;">';

  // Wallet Summary Section
  html += '<div style="background:linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);padding:16px;border-radius:12px;margin-bottom:16px;border-left:4px solid #0ea5e9;">';
  html += '<h4 style="margin:0 0 12px 0;color:#0c4a6e;font-size:14px;font-weight:600;">📊 钱包总览</h4>';
  html += createField('总价值', `<span style="color:#0ea5e9;font-weight:600;font-size:16px;">${totalPGC.toLocaleString()} PGC</span>`, true);
  html += createField('PGC余额', `<span style="color:#10b981;font-weight:600;">${sums[0]}</span>`);
  html += createField('BTC余额', `<span style="color:#f59e0b;font-weight:600;">${sums[1]}</span>`);
  html += createField('ETH余额', `<span style="color:#3b82f6;font-weight:600;">${sums[2]}</span>`);
  if (w.updateTime) {
    const ts = Number(w.updateTime);
    // If timestamp is > 100 billion, assume it's milliseconds; otherwise seconds
    const date = new Date(ts > 100000000000 ? ts : ts * 1000);
    html += createField('更新时间', date.toLocaleString());
  }
  if (w.updateBlock) html += createField('更新区块', w.updateBlock);
  html += '</div>';

  // Addresses Section
  const addresses = Object.keys(addr);
  if (addresses.length > 0) {
    html += `<h4 class="wb-title">🏦 子地址 (${addresses.length})</h4>`;

    addresses.forEach((addrKey, idx) => {
      const m = addr[addrKey] || {};
      const typeId = Number(m.type || 0);
      const valObj = m.value || {};
      const utxos = m.utxos || {};
      const txCers = m.txCers || {};
      const utxoCount = Object.keys(utxos).length;
      const txCerCount = Object.keys(txCers).length;

      html += `<details class="wb-detail-card">`;
      html += `<summary class="wb-summary">
        <div class="wb-summary-content">
          <span class="wb-addr-short">${addrKey.slice(0, 8)}...${addrKey.slice(-8)}</span>
          <div class="wb-coin-tag-wrapper">${getCoinLabel(typeId)}</div>
          <span class="wb-balance-tag">${valObj.totalValue || 0} ${typeId === 0 ? 'PGC' : typeId === 1 ? 'BTC' : 'ETH'}</span>
        </div>
      </summary>`;

      html += '<div class="wb-content">';
      html += '<div style="margin-bottom:12px">';
      html += '<div class="wb-label wb-mb-sm">完整地址</div>';
      html += `<div class="wb-code-box">${addrKey}</div>`;
      html += '</div>';
      
      html += `<div class="wb-row"><span class="wb-label">币种类型</span><span class="wb-value">${getCoinLabel(typeId)}</span></div>`;
      html += `<div class="wb-row"><span class="wb-label">UTXO 价值</span><span class="wb-value wb-text-success">${valObj.utxoValue || 0}</span></div>`;
      html += `<div class="wb-row"><span class="wb-label">TXCer 价值</span><span class="wb-value wb-text-purple">${valObj.txCerValue || 0}</span></div>`;
      html += `<div class="wb-row"><span class="wb-label">总价值</span><span class="wb-value wb-text-blue-bold">${valObj.totalValue || 0}</span></div>`;
      html += `<div class="wb-row"><span class="wb-label">预估利息</span><span class="wb-value wb-text-warning">${m.estInterest || 0} GAS</span></div>`;

      // UTXOs subsection
      if (utxoCount > 0) {
        html += '<div class="wb-sub-section">';
        html += `<div class="wb-sub-title wb-sub-title-success">💰 UTXOs (${utxoCount})</div>`;
        html += '<div class="wb-utxo-list">';
        Object.keys(utxos).forEach((utxoKey) => {
          const utxo = utxos[utxoKey];
          html += `<div class="wb-utxo-item">`;
          html += `<div class="wb-utxo-info">`;
          html += `<div class="wb-utxo-hash" title="${utxoKey}">${utxoKey}</div>`;
          html += `<div class="wb-utxo-val">${utxo.Value} ${getCoinLabel(utxo.Type || 0)}</div>`;
          html += `</div>`;
          html += `<button class="btn secondary wb-btn-xs" onclick="window.showUtxoDetail('${addrKey}', '${utxoKey}')">详情</button>`;
          html += `</div>`;
        });
        html += '</div></div>';
      }

      // TXCers subsection
      if (txCerCount > 0) {
        html += '<div class="wb-sub-section">';
        html += `<div class="wb-sub-title wb-sub-title-purple">📜 TXCers (${txCerCount})</div>`;
        Object.keys(txCers).forEach((txCerKey) => {
          const txCerVal = txCers[txCerKey];
          html += `<div class="wb-txcer-box">${txCerKey}: ${txCerVal}</div>`;
        });
        html += '</div>';
      }

      html += '</div></details>';
    });
  }

  // TotalTXCers Section
  const totalTXCersKeys = Object.keys(w.totalTXCers || {});
  if (totalTXCersKeys.length > 0) {
    html += '<div class="wb-total-box">';
    html += `<h4 class="wb-total-title">📜 总TXCers (${totalTXCersKeys.length})</h4>`;
    html += '<div>';
    totalTXCersKeys.forEach(key => {
      html += `<div class="wb-total-item">${key}: ${w.totalTXCers[key]}</div>`;
    });
    html += '</div></div>';
  }

  html += '</div>';
  box.innerHTML = html;
}

function updateTotalGasBadge(u) {
  const gasBadge = document.getElementById('walletGAS');
  const user = u || loadUser();
  if (!gasBadge || !user || !user.wallet) return;
  const sumGas = Object.keys(user.wallet.addressMsg || {}).reduce((s, k) => {
    const m = user.wallet.addressMsg[k];
    return s + readAddressInterest(m);
  }, 0);
  gasBadge.innerHTML = `<span class="amt">${sumGas.toLocaleString()}</span><span class="unit">GAS</span>`;
}

function renderEntryBriefDetail(addr) {
  const box = document.getElementById('walletBriefDetail');
  const addrEl = document.getElementById('entryDetailAddr');
  const originEl = document.getElementById('entryDetailOrigin');
  const pxEl = document.getElementById('entryDetailPubX');
  const pyEl = document.getElementById('entryDetailPubY');
  if (!box || !addrEl || !originEl || !pxEl || !pyEl) return;
  const u = loadUser();
  const origin = u && u.wallet && u.wallet.addressMsg && u.wallet.addressMsg[addr] && u.wallet.addressMsg[addr].origin ? u.wallet.addressMsg[addr].origin : '';
  addrEl.textContent = addr || '';
  originEl.textContent = origin === 'created' ? '新建' : (origin === 'imported' ? '导入' : '未知');
  pxEl.textContent = (u && u.keys && u.keys.pubXHex) ? u.keys.pubXHex : '';
  pyEl.textContent = (u && u.keys && u.keys.pubYHex) ? u.keys.pubYHex : '';
  box.classList.remove('hidden');
}

const briefListEl = document.getElementById('walletBriefList');
if (briefListEl && !briefListEl.dataset._bind) {
  briefListEl.addEventListener('click', (e) => {
    const item = e.target.closest('.brief-item');
    if (!item) return;
    const addr = item.getAttribute('data-addr');
    const ok = e.target.closest('.brief-confirm-ok');
    const cancel = e.target.closest('.brief-confirm-cancel');
    const del = e.target.closest('.brief-del');
    if (del) {
      const existed = item.querySelector('.brief-confirm');
      if (existed) { existed.remove(); }
      const box = document.createElement('span');
      box.className = 'brief-confirm';
      box.innerHTML = '<button class="btn danger btn--sm brief-confirm-ok">确认</button><button class="btn secondary btn--sm brief-confirm-cancel">取消</button>';
      del.insertAdjacentElement('afterend', box);
      requestAnimationFrame(() => box.classList.add('show'));
      return;
    }
    if (ok) {
      const u = loadUser();
      if (addr && u && u.wallet && u.wallet.addressMsg) {
        item.remove();
        delete u.wallet.addressMsg[addr];
        saveUser(u);
        updateWalletBrief();
      }
      return;
    }
    if (cancel) {
      const existed = item.querySelector('.brief-confirm');
      if (existed) existed.remove();
      return;
    }
  });
  briefListEl.dataset._bind = '1';
}

const briefToggleBtn = document.getElementById('briefToggleBtn');
if (briefToggleBtn && !briefToggleBtn.dataset._bind) {
  briefToggleBtn.addEventListener('click', () => {
    const list = document.getElementById('walletBriefList');
    if (!list) return;
    const collapsed = list.classList.contains('collapsed');
    if (collapsed) { list.classList.remove('collapsed'); briefToggleBtn.textContent = '收起'; }
    else { list.classList.add('collapsed'); briefToggleBtn.textContent = '展开更多'; }
  });
  briefToggleBtn.dataset._bind = '1';
}

// 结果页“下一步”按钮：跳转到占位页
const newNextBtn = document.getElementById('newNextBtn');
if (newNextBtn) {
  newNextBtn.addEventListener('click', () => {
    const ov = document.getElementById('actionOverlay');
    const ovt = document.getElementById('actionOverlayText');
    if (ovt) ovt.textContent = '正在进入生成或导入钱包页面...';
    if (ov) ov.classList.remove('hidden');
    window.__skipExitConfirm = true;
    setTimeout(() => {
      if (ov) ov.classList.add('hidden');
      routeTo('#/entry');
    }, 600);
  });
}
const importNextBtn = document.getElementById('importNextBtn');
if (importNextBtn) {
  importNextBtn.addEventListener('click', () => {
    window.__skipExitConfirm = true;
    routeTo('#/join-group');
  });
}

if (entryNextBtn) {
  const proceedModal = document.getElementById('confirmProceedModal');
  const proceedText = document.getElementById('confirmProceedText');
  const proceedOk = document.getElementById('confirmProceedOk');
  const proceedCancel = document.getElementById('confirmProceedCancel');
  entryNextBtn.addEventListener('click', () => {
    const u = loadUser();
    const addrs = u && u.wallet ? Object.keys(u.wallet.addressMsg || {}) : [];
    if (proceedText) proceedText.textContent = `当前子地址数：${addrs.length}，是否确认继续下一步？`;
    if (proceedModal) proceedModal.classList.remove('hidden');
  });
  if (proceedOk) {
    proceedOk.addEventListener('click', () => {
      const proceedModal2 = document.getElementById('confirmProceedModal');
      if (proceedModal2) proceedModal2.classList.add('hidden');
      const gid = computeCurrentOrgId();
      if (gid) routeTo('#/inquiry-main'); else routeTo('#/join-group');
    });
  }
  if (proceedCancel) {
    proceedCancel.addEventListener('click', () => {
      const proceedModal2 = document.getElementById('confirmProceedModal');
      if (proceedModal2) proceedModal2.classList.add('hidden');
    });
  }
}

const groupSearch = document.getElementById('groupSearch');
const groupSuggest = document.getElementById('groupSuggest');
const recPane = document.getElementById('recPane');
const joinSearchBtn = document.getElementById('joinSearchBtn');
const joinRecBtn = document.getElementById('joinRecBtn');

function showGroupInfo(g) {
  currentSelectedGroup = g;
  const recGroupID = document.getElementById('recGroupID');
  const recAggre = document.getElementById('recAggre');
  const recAssign = document.getElementById('recAssign');
  const recPledge = document.getElementById('recPledge');
  if (recGroupID) recGroupID.textContent = g.groupID;
  if (recAggre) recAggre.textContent = g.aggreNode;
  if (recAssign) recAssign.textContent = g.assignNode;
  if (recPledge) recPledge.textContent = g.pledgeAddress;
  if (groupSuggest) groupSuggest.classList.add('hidden');
  // 展示搜索详细信息并启用“加入搜索结果”
  const sr = document.getElementById('searchResult');
  if (sr) {
    const sg = document.getElementById('srGroupID');
    const sa = document.getElementById('srAggre');
    const ss = document.getElementById('srAssign');
    const sp = document.getElementById('srPledge');
    if (sg) sg.textContent = g.groupID;
    if (sa) sa.textContent = g.aggreNode;
    if (ss) ss.textContent = g.assignNode;
    if (sp) sp.textContent = g.pledgeAddress;
    sr.classList.remove('hidden');
    sr.classList.remove('reveal');
    requestAnimationFrame(() => sr.classList.add('reveal'));
  }
  if (joinSearchBtn) joinSearchBtn.disabled = false;
  if (recPane) recPane.classList.add('collapsed');
}

function doSearchById() {
  const q = groupSearch ? groupSearch.value.trim() : '';
  if (!q) { return; }
  const g = GROUP_LIST.find(x => x.groupID === q);
  if (g) {
    showGroupInfo(g);
  } else {
    const list = GROUP_LIST.filter(x => x.groupID.includes(q)).slice(0, 6);
    if (list.length) {
      groupSuggest.innerHTML = list.map(x => `<div class="item" data-id="${x.groupID}"><span>${x.groupID}</span><span>${x.aggreNode} / ${x.assignNode}</span></div>`).join('');
      groupSuggest.classList.remove('hidden');
    }
  }
}
if (groupSearch) {
  groupSearch.addEventListener('input', () => {
    const q = groupSearch.value.trim();
    if (!q) {
      groupSuggest.classList.add('hidden');
      const sr = document.getElementById('searchResult');
      if (sr) sr.classList.add('hidden');
      if (joinSearchBtn) joinSearchBtn.disabled = true;
      if (recPane) recPane.classList.remove('collapsed');
      return;
    }
    const list = GROUP_LIST.filter(g => g.groupID.includes(q)).slice(0, 6);
    if (list.length === 0) { groupSuggest.classList.add('hidden'); return; }
    groupSuggest.innerHTML = list.map(g => `<div class="item" data-id="${g.groupID}"><span>${g.groupID}</span><span>${g.aggreNode} / ${g.assignNode}</span></div>`).join('');
    groupSuggest.classList.remove('hidden');
  });
  groupSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      doSearchById();
    }
  });
  groupSuggest.addEventListener('click', (e) => {
    const t = e.target.closest('.item');
    if (!t) return;
    const id = t.getAttribute('data-id');
    const g = GROUP_LIST.find(x => x.groupID === id);
    if (g) showGroupInfo(g);
  });
}

// 移除“搜索”按钮，改为回车搜索或点击建议

const skipJoinBtn = document.getElementById('skipJoinBtn');
if (skipJoinBtn) {
  skipJoinBtn.addEventListener('click', () => {
    const modal = document.getElementById('confirmSkipModal');
    if (modal) modal.classList.remove('hidden');
  });
}
if (joinRecBtn) {
  joinRecBtn.addEventListener('click', async () => {
    const g = DEFAULT_GROUP;
    const overlay = document.getElementById('joinOverlay');
    try {
      if (overlay) overlay.classList.remove('hidden');
      joinRecBtn.disabled = true;
      if (joinSearchBtn) joinSearchBtn.disabled = true;
      await wait(2000);
    } finally {
      if (overlay) overlay.classList.add('hidden');
      joinRecBtn.disabled = false;
      if (joinSearchBtn) joinSearchBtn.disabled = false;
    }
    try { localStorage.setItem('guarChoice', JSON.stringify({ type: 'join', groupID: g.groupID, aggreNode: g.aggreNode, assignNode: g.assignNode, pledgeAddress: g.pledgeAddress })); } catch { }
    updateOrgDisplay();
    routeTo('#/inquiry-main');
  });
}
if (joinSearchBtn) {
  joinSearchBtn.addEventListener('click', async () => {
    if (joinSearchBtn.disabled) return;
    const g = currentSelectedGroup || DEFAULT_GROUP;
    const overlay = document.getElementById('joinOverlay');
    try {
      if (overlay) overlay.classList.remove('hidden');
      joinRecBtn.disabled = true;
      joinSearchBtn.disabled = true;
      await wait(2000);
    } finally {
      if (overlay) overlay.classList.add('hidden');
      joinRecBtn.disabled = false;
      joinSearchBtn.disabled = false;
    }
    try { localStorage.setItem('guarChoice', JSON.stringify({ type: 'join', groupID: g.groupID, aggreNode: g.aggreNode, assignNode: g.assignNode, pledgeAddress: g.pledgeAddress })); } catch { }
    updateOrgDisplay();
    routeTo('#/inquiry-main');
  });
}

async function importLocallyFromPrivHex(privHex) {
  const normalized = privHex.replace(/^0x/i, '');
  if (!window.elliptic || !window.elliptic.ec) {
    throw new Error('本地导入失败：缺少 elliptic 库');
  }
  const ec = new window.elliptic.ec('p256');
  let key;
  try {
    key = ec.keyFromPrivate(normalized, 'hex');
  } catch (e) {
    throw new Error('私钥格式不正确或无法解析');
  }
  const pub = key.getPublic();
  const xHex = pub.getX().toString(16).padStart(64, '0');
  const yHex = pub.getY().toString(16).padStart(64, '0');
  const uncompressedHex = '04' + xHex + yHex;
  const uncompressed = hexToBytes(uncompressedHex);
  const sha = await crypto.subtle.digest('SHA-256', uncompressed);
  const address = bytesToHex(new Uint8Array(sha).slice(0, 20));
  const accountId = generate8DigitFromInputHex(normalized);
  return { accountId, address, privHex: normalized, pubXHex: xHex, pubYHex: yHex };
}

async function importFromPrivHex(privHex) {
  // 先尝试后端 API；若不可用则回退到前端本地计算
  try {
    const res = await fetch('/api/keys/from-priv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privHex })
    });
    if (res.ok) {
      const data = await res.json();
      const normalized = (data.privHex || privHex).replace(/^0x/i, '').toLowerCase().replace(/^0+/, '');
      const accountId = generate8DigitFromInputHex(normalized);
      return { ...data, accountId };
    }
  } catch (_) {
    // 网络或跨域问题时直接回退
  }
  return await importLocallyFromPrivHex(privHex);
}

// 导入钱包：根据私钥恢复账户信息并显示
if (importBtn) {
  importBtn.addEventListener('click', async () => {
    const mode = importBtn.dataset.mode || 'account';
    const inputEl = document.getElementById('importPrivHex');
    const priv = inputEl.value.trim();
    if (!priv) {
      alert('请输入私钥 Hex');
      inputEl.focus();
      return;
    }
    // 简单校验：允许带 0x 前缀；去前缀后必须是 64 位十六进制
    const normalized = priv.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
      alert('私钥格式不正确：需为 64 位十六进制字符串');
      inputEl.focus();
      return;
    }
    importBtn.disabled = true;
    try {
      const loader = document.getElementById('importLoader');
      const resultEl = document.getElementById('importResult');
      const importNextBtn = document.getElementById('importNextBtn');
      if (importNextBtn) importNextBtn.classList.add('hidden');
      if (resultEl) resultEl.classList.add('hidden');
      if (loader && mode === 'account') loader.classList.remove('hidden');
      const ov = document.getElementById('actionOverlay');
      const ovt = document.getElementById('actionOverlayText');
      if (mode === 'wallet') { if (ovt) ovt.textContent = '正在导入钱包地址...'; if (ov) ov.classList.remove('hidden'); }
      const t0 = Date.now();
      const data = await importFromPrivHex(priv);
      const elapsed = Date.now() - t0;
      if (elapsed < 1000) await wait(1000 - elapsed);
      if (loader) loader.classList.add('hidden');
      if (mode === 'account') {
        resultEl.classList.remove('hidden');
        resultEl.classList.remove('fade-in');
        resultEl.classList.remove('reveal');
        requestAnimationFrame(() => resultEl.classList.add('reveal'));
        document.getElementById('importAccountId').textContent = data.accountId || '';
        document.getElementById('importAddress').textContent = data.address || '';
        document.getElementById('importPrivHexOut').textContent = data.privHex || normalized;
        document.getElementById('importPubX').textContent = data.pubXHex || '';
        document.getElementById('importPubY').textContent = data.pubYHex || '';
        saveUser({ accountId: data.accountId, address: data.address, privHex: data.privHex, pubXHex: data.pubXHex, pubYHex: data.pubYHex });
        if (importNextBtn) importNextBtn.classList.remove('hidden');
      } else {
        const u2 = loadUser();
        if (!u2 || !u2.accountId) { alert('请先登录或注册账户'); return; }
        if (ov) ov.classList.add('hidden');
        const acc = toAccount({ accountId: u2.accountId, address: u2.address }, u2);
        const addr = (data.address || '').toLowerCase();
        if (!addr) {
          const { modal: modalE, titleEl: titleE, textEl: textE, okEl: okE } = getActionModalElements();
          if (titleE) titleE.textContent = '导入失败';
          if (textE) { textE.textContent = '无法解析地址'; textE.classList.add('tip--error'); }
          if (modalE) modalE.classList.remove('hidden');
          const handlerE = () => { modalE.classList.add('hidden'); okE && okE.removeEventListener('click', handlerE); };
          if (okE) okE.addEventListener('click', handlerE);
          return;
        }
        const exists = (acc.wallet && acc.wallet.addressMsg && acc.wallet.addressMsg[addr]) || (u2.address && String(u2.address).toLowerCase() === addr);
        if (exists) {
          const { modal: modalE, titleEl: titleE, textEl: textE, okEl: okE } = getActionModalElements();
          if (titleE) titleE.textContent = '导入失败';
          if (textE) { textE.textContent = '该公钥地址已存在，不能重复导入'; textE.classList.add('tip--error'); }
          if (modalE) modalE.classList.remove('hidden');
          const handlerE = () => { modalE.classList.add('hidden'); okE && okE.removeEventListener('click', handlerE); };
          if (okE) okE.addEventListener('click', handlerE);
          return;
        }
        if (addr) acc.wallet.addressMsg[addr] = acc.wallet.addressMsg[addr] || { type: 0, utxos: {}, txCers: {}, value: { totalValue: 0, utxoValue: 0, txCerValue: 0 }, estInterest: 0, origin: 'imported', privHex: (data.privHex || normalized) };
        saveUser(acc);
        updateWalletBrief();
        const { modal, titleEl: title, textEl: text, okEl: ok } = getActionModalElements();
        if (title) title.textContent = '导入钱包成功';
        if (text) text.textContent = '已导入一个钱包地址';
        if (text) text.classList.remove('tip--error');
        if (modal) modal.classList.remove('hidden');
        const handler = () => { modal.classList.add('hidden'); ok.removeEventListener('click', handler); routeTo('#/entry'); };
        if (ok) ok.addEventListener('click', handler);
      }
    } catch (err) {
      alert('导入失败：' + err.message);
      console.error(err);
    } finally {
      importBtn.disabled = false;
      const loader = document.getElementById('importLoader');
      if (loader) loader.classList.add('hidden');
    }
  });
}

if (loginAccountBtn) {
  loginAccountBtn.addEventListener('click', () => routeTo('#/login'));
}
if (registerAccountBtn) {
  registerAccountBtn.addEventListener('click', () => {
    resetOrgSelectionForNewUser();
    routeTo('#/new');
  });
}
if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    const inputEl = document.getElementById('loginPrivHex');
    const priv = inputEl.value.trim();
    if (!priv) { alert('请输入私钥 Hex'); inputEl.focus(); return; }
    const normalized = priv.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(normalized)) { alert('私钥格式不正确：需为 64 位十六进制字符串'); inputEl.focus(); return; }
    loginBtn.disabled = true;
    try {
      const loader = document.getElementById('loginLoader');
      const resultEl = document.getElementById('loginResult');
      const nextBtn = document.getElementById('loginNextBtn');
      if (resultEl) resultEl.classList.add('hidden');
      if (nextBtn) nextBtn.classList.add('hidden');
      if (loader) loader.classList.remove('hidden');
      const t0 = Date.now();
      const data = await importFromPrivHex(priv);
      const elapsed = Date.now() - t0;
      if (elapsed < 1000) await wait(1000 - elapsed);
      if (loader) loader.classList.add('hidden');
      const resultEl2 = document.getElementById('loginResult');
      if (resultEl2) {
        resultEl2.classList.remove('hidden');
        resultEl2.classList.remove('fade-in');
        resultEl2.classList.remove('reveal');
        requestAnimationFrame(() => resultEl2.classList.add('reveal'));
      }
      document.getElementById('loginAccountId').textContent = data.accountId || '';
      document.getElementById('loginAddress').textContent = data.address || '';
      document.getElementById('loginPrivOut').textContent = data.privHex || normalized;
      document.getElementById('loginPubX').textContent = data.pubXHex || '';
      document.getElementById('loginPubY').textContent = data.pubYHex || '';
      saveUser({ accountId: data.accountId, address: data.address, privHex: data.privHex, pubXHex: data.pubXHex, pubYHex: data.pubYHex, flowOrigin: 'login' });
      if (nextBtn) nextBtn.classList.remove('hidden');
    } catch (e) {
      alert('登录失败：' + e.message);
      console.error(e);
    } finally {
      loginBtn.disabled = false;
    }
  });
}
if (loginNextBtn) {
  loginNextBtn.addEventListener('click', () => {
    window.__skipExitConfirm = true;
    const u = loadUser();
    if (u) {
      u.wallet = u.wallet || { addressMsg: {}, totalTXCers: {}, totalValue: 0, valueDivision: { 0: 0, 1: 0, 2: 0 }, updateTime: Date.now(), updateBlock: 0 };
      u.wallet.addressMsg = {};
      u.orgNumber = (typeof DEFAULT_GROUP !== 'undefined' ? DEFAULT_GROUP.groupID : '10000000');
      u.guarGroup = (typeof DEFAULT_GROUP !== 'undefined' ? DEFAULT_GROUP : null);
      saveUser(u);
      try {
        const g = u.guarGroup || DEFAULT_GROUP || { groupID: u.orgNumber, aggreNode: '', assignNode: '', pledgeAddress: '' };
        localStorage.setItem('guarChoice', JSON.stringify({ type: 'join', groupID: String(u.orgNumber || ''), aggreNode: String(g.aggreNode || ''), assignNode: String(g.assignNode || ''), pledgeAddress: String(g.pledgeAddress || '') }));
      } catch { }
    }
    const brief = document.getElementById('walletBriefList');
    const toggleBtn = document.getElementById('briefToggleBtn');
    if (brief) { brief.classList.add('hidden'); brief.innerHTML = ''; }
    if (toggleBtn) toggleBtn.classList.add('hidden');
    routeTo('#/entry');
  });
}

// 用户菜单展开/收起与初始化渲染
const userButton = document.getElementById('userButton');
if (userButton) {
  userButton.addEventListener('click', (e) => {
    e.stopPropagation();
    updateHeaderUser(loadUser());
    updateOrgDisplay();
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.add('hidden');
  });
  // 初始渲染用户栏
  updateHeaderUser(loadUser());
  updateOrgDisplay();
}

// 登出：清除本地账户信息并返回入口页
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (logoutBtn.disabled) return;
    clearAccountStorage();
    updateHeaderUser(null);
    clearUIState();
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.add('hidden');
    routeTo('#/welcome');
  });
}
// 点击推荐区标题，切换收叠/展开
const recPaneHeader = document.querySelector('#recPane h3');
if (recPaneHeader && recPane) {
  recPaneHeader.addEventListener('click', () => {
    recPane.classList.toggle('collapsed');
  });
}

function renderWallet() {
  const u = loadUser();
  const aid = document.getElementById('walletAccountId');
  const org = document.getElementById('walletOrg');
  const addr = document.getElementById('walletMainAddr');
  const priv = document.getElementById('walletPrivHex');
  const px = document.getElementById('walletPubX');
  const py = document.getElementById('walletPubY');
  if (!u) return;
  if (aid) aid.textContent = u.accountId || '';
  if (org) org.textContent = u.orgNumber || '暂未加入担保组织';
  if (addr) addr.textContent = u.address || '';
  if (priv) priv.textContent = u.privHex || '';
  if (px) px.textContent = u.pubXHex || '';
  if (py) py.textContent = u.pubYHex || '';
  const formatTime = (idx, len) => {
    const d = new Date();
    d.setHours(d.getHours() - (len - 1 - idx));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  };
  const list = document.getElementById('walletAddrList');
  if (list) {
    const addresses = Object.keys((u.wallet && u.wallet.addressMsg) || {});
    const pointsBase = Array.from({ length: 40 }, (_, i) => Math.round(50 + 30 * Math.sin(i / 4) + Math.random() * 10));
    list.innerHTML = '';
    addresses.forEach((a, idx) => {
      const item = document.createElement('div');
      item.className = 'addr-card';
      const meta = (u.wallet && u.wallet.addressMsg && u.wallet.addressMsg[a]) || null;
      const isZero = !!(meta && meta.origin === 'created');
      const zeroArr = Array.from({ length: 40 }, () => 0);
      // Chart points generation removed as requested

      const typeId0 = Number(meta && meta.type !== undefined ? meta.type : 0);
      const amtCash0 = Number((meta && meta.value && meta.value.utxoValue) || 0);
      const gas0 = readAddressInterest(meta);
      const coinType = typeId0 === 1 ? 'BTC' : (typeId0 === 2 ? 'ETH' : 'PGC');
      const coinClass = typeId0 === 1 ? 'btc' : (typeId0 === 2 ? 'eth' : 'pgc');

      item.innerHTML = `
        <div class="addr-card-header">
          <div class="addr-type-badge type--${coinClass}">${coinType}</div>
          <div class="addr-ops-container"></div>
        </div>
        <div class="addr-card-address">
          <code class="addr-hash" title="${a}">${a}</code>
        </div>
        <div class="addr-card-body">
          <div class="addr-balance-container">
            <span class="addr-balance-val ${amtCash0 > 0 ? 'active' : ''}">${amtCash0}</span>
            <span class="addr-balance-unit">${coinType}</span>
          </div>
          <div class="addr-gas-info">
            <span class="gas-icon">⛽</span>
            <span class="gas-val">${gas0} GAS</span>
          </div>
        </div>
        <div class="addr-card-actions">
          <button class="action-btn btn-add test-add-any" title="增加余额">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>增加</span>
          </button>
          <button class="action-btn btn-zero test-zero-any" title="清空余额">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>清空</span>
          </button>
        </div>
      `;
      list.appendChild(item);
      const metaEl = item.querySelector('.addr-ops-container');
      if (metaEl) {
        const ops = document.createElement('div');
        ops.className = 'addr-ops';
        const toggle = document.createElement('button');
        toggle.className = 'ops-toggle';
        toggle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>';
        const menu = document.createElement('div');
        menu.className = 'ops-menu hidden';
        const delBtn = document.createElement('button');
        delBtn.className = 'ops-item danger';
        delBtn.textContent = '删除地址';
        const expBtn = document.createElement('button');
        expBtn.className = 'ops-item';
        expBtn.textContent = '导出私钥';
        menu.appendChild(expBtn);
        menu.appendChild(delBtn);
        ops.appendChild(toggle);
        ops.appendChild(menu);
        metaEl.appendChild(ops);
        toggle.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); });
        document.addEventListener('click', () => { menu.classList.add('hidden'); });
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const modal = document.getElementById('confirmDelModal');
          const okBtn = document.getElementById('confirmDelOk');
          const cancelBtn = document.getElementById('confirmDelCancel');
          const textEl = document.getElementById('confirmDelText');
          if (textEl) textEl.textContent = `是否删除地址 ${a} 及其本地数据？`;
          if (modal) modal.classList.remove('hidden');
          const doDel = () => {
            if (modal) modal.classList.add('hidden');
            const u3 = loadUser();
            if (!u3) return;
            const key = String(a).toLowerCase();
            const isMain = (u3.address && u3.address.toLowerCase() === key);
            if (u3.wallet && u3.wallet.addressMsg) {
              u3.wallet.addressMsg = Object.fromEntries(
                Object.entries(u3.wallet.addressMsg).filter(([k]) => String(k).toLowerCase() !== key)
              );
            }
            if (isMain) {
              u3.address = '';
            }
            saveUser(u3);
            try {
              if (window.__refreshSrcAddrList) window.__refreshSrcAddrList();
            } catch (_) { }
            const menuList = document.getElementById('menuAddressList');
            if (menuList) {
              const rows = Array.from(menuList.querySelectorAll('.addr-row'));
              rows.forEach(r => {
                const codeEl = r.querySelector('code.break');
                if (codeEl && String(codeEl.textContent).toLowerCase() === key) {
                  r.remove();
                }
              });
            }
            renderWallet();
            updateWalletBrief();
            const { modal: am, titleEl: at, textEl: ax, okEl: ok1 } = getActionModalElements();
            if (at) at.textContent = '删除成功';
            if (ax) { ax.classList.remove('tip--error'); ax.textContent = '已删除该地址及其相关本地数据'; }
            if (am) am.classList.remove('hidden');
            const h2 = () => { am.classList.add('hidden'); ok1 && ok1.removeEventListener('click', h2); };
            ok1 && ok1.addEventListener('click', h2);
            menu.classList.add('hidden');
          };
          const cancel = () => { if (modal) modal.classList.add('hidden'); okBtn && okBtn.removeEventListener('click', doDel); cancelBtn && cancelBtn.removeEventListener('click', cancel); };
          okBtn && okBtn.addEventListener('click', doDel, { once: true });
          cancelBtn && cancelBtn.addEventListener('click', cancel, { once: true });
        });
        expBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const u3 = loadUser();
          const key = String(a).toLowerCase();
          let priv = '';
          if (u3) {
            const map = (u3.wallet && u3.wallet.addressMsg) || {};
            let found = map[a] || map[key] || null;
            if (!found) {
              for (const k in map) {
                if (String(k).toLowerCase() === key) { found = map[k]; break; }
              }
            }
            if (found && found.privHex) {
              priv = found.privHex || '';
            } else if (u3.address && String(u3.address).toLowerCase() === key) {
              priv = (u3.keys && u3.keys.privHex) || u3.privHex || '';
            }
          }
          const { modal, titleEl: title, textEl: text, okEl: ok } = getActionModalElements();
          if (priv) {
            if (title) title.textContent = '导出私钥';
            if (text) { text.classList.remove('tip--error'); text.innerHTML = `<code class="break">${priv}</code>`; }
          } else {
            if (title) title.textContent = '导出失败';
            if (text) { text.classList.add('tip--error'); text.textContent = '该地址无可导出私钥'; }
          }
          if (modal) modal.classList.remove('hidden');
          const handler = () => { modal.classList.add('hidden'); ok && ok.removeEventListener('click', handler); };
          ok && ok.addEventListener('click', handler);
          menu.classList.add('hidden');
        });
      }
      const addBtn = item.querySelector('.test-add-any');
      const zeroBtn = item.querySelector('.test-zero-any');
      if (addBtn) {
        addBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const u4 = loadUser();
          if (!u4 || !u4.wallet || !u4.wallet.addressMsg) return;
          const key = String(a).toLowerCase();
          const found = u4.wallet.addressMsg[a] || u4.wallet.addressMsg[key];
          if (!found) return;
          const typeId = Number(found && found.type !== undefined ? found.type : 0);
          const inc = typeId === 1 ? 1 : (typeId === 2 ? 5 : 10);

          // Ensure structures exist
          found.value = found.value || { totalValue: 0, utxoValue: 0, txCerValue: 0 };
          found.utxos = found.utxos || {};

          // Construct SubATX
          const subTx = {
            TXID: '', // Calculated below
            TXType: 0,
            TXInputsNormal: [{ IsCommitteeMake: true }],
            TXOutputs: [{
              ToAddress: key,
              ToValue: inc,
              ToGuarGroupID: u4.guarGroup || u4.orgNumber || '',
              ToInterest: 10,
              Type: typeId,
              ToPeerID: "QmXov7TjwVKoNqK9wQxnpTXsngphe1iCWSm57ikgHnJD9D",
              IsPayForGas: false,
              IsCrossChain: false,
              IsGuarMake: false
            }],
            Data: [] // Keep empty as requested
          };

          // Calculate TXID
          // Since Data is empty and content is constant, we must generate a random TXID 
          // to ensure uniqueness for multiple "Add" operations.
          const randomBytes = new Uint8Array(8);
          crypto.getRandomValues(randomBytes);
          subTx.TXID = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

          // Construct UTXOData
          const utxoKey = `${subTx.TXID}_0`; // TXID_IndexZ
          const utxoData = {
            UTXO: subTx,
            Value: inc,
            Type: typeId,
            Time: Date.now(),
            Position: {
              Blocknum: 0,
              IndexX: 0,
              IndexY: 0,
              IndexZ: 0 // Output index
            },
            IsTXCerUTXO: false
          };

          // Add to UTXOs
          found.utxos[utxoKey] = utxoData;

          // Update Balance Logic
          // Recalculate UTXO value from map
          const newUtxoVal = Object.values(found.utxos).reduce((s, u) => s + (Number(u.Value) || 0), 0);
          found.value.utxoValue = newUtxoVal;
          found.value.totalValue = newUtxoVal + Number(found.value.txCerValue || 0);

          found.estInterest = Number(found.estInterest || 0) + 10;
          found.gas = Number(found.estInterest || 0);

          // Recalculate Wallet ValueDivision
          const sumVD = { 0: 0, 1: 0, 2: 0 };
          Object.keys(u4.wallet.addressMsg || {}).forEach((addrK) => {
            const m = u4.wallet.addressMsg[addrK] || {};
            const t = Number(m.type || 0);
            const val = Number(m.value && (m.value.totalValue || m.value.TotalValue) || 0);
            if (sumVD[t] !== undefined) {
              sumVD[t] += val;
            }
          });
          u4.wallet.valueDivision = sumVD;
          u4.wallet.ValueDivision = sumVD; // Keep both for safety

          const pgcTotal = Number(sumVD[0] || 0);
          const btcTotal = Number(sumVD[1] || 0);
          const ethTotal = Number(sumVD[2] || 0);
          const valueTotalPGC = pgcTotal + btcTotal * 1000000 + ethTotal * 1000;
          u4.wallet.totalValue = valueTotalPGC;
          u4.wallet.TotalValue = valueTotalPGC;

          saveUser(u4);
          updateTotalGasBadge(u4);

          const valEl = item.querySelector('.addr-balance-val');
          if (valEl) {
            valEl.textContent = String(Number(found.value.utxoValue || 0));
            valEl.classList.add('active');
          }
          const gasEl = item.querySelector('.gas-val');
          if (gasEl) gasEl.textContent = `${Number(found.estInterest || 0)} GAS`;

          // Update other UI elements...
          const addrList = document.getElementById('srcAddrList');
          if (addrList) {
            const label = Array.from(addrList.querySelectorAll('label')).find(l => { const inp = l.querySelector('input[type="checkbox"]'); return inp && String(inp.value).toLowerCase() === key; });
            if (label) {
              const amtVal = label.querySelector('.amount-val');
              if (amtVal) {
                const vCash = Number((found && found.value && found.value.utxoValue) || 0);
                amtVal.textContent = String(vCash);
              }
            }
          }

          // Update USDT and Breakdown
          const usdtEl = document.getElementById('walletUSDT');
          if (usdtEl && u4 && u4.wallet) {
            // Re-read sumVD from wallet
            const vdAll = u4.wallet.valueDivision || { 0: 0, 1: 0, 2: 0 };
            const pgcA = Number(vdAll[0] || 0);
            const btcA = Number(vdAll[1] || 0);
            const ethA = Number(vdAll[2] || 0);
            const usdt = Math.round(pgcA * 1 + btcA * 100 + ethA * 10);
            usdtEl.innerHTML = `<span class="amt">${usdt.toLocaleString()}</span><span class="unit">USDT</span>`;

            const bd = document.querySelector('.currency-breakdown');
            if (bd) {
              const pgcV = bd.querySelector('.tag--pgc');
              const btcV = bd.querySelector('.tag--btc');
              const ethV = bd.querySelector('.tag--eth');
              if (pgcV) pgcV.textContent = pgcA;
              if (btcV) btcV.textContent = btcA;
              if (ethV) ethV.textContent = ethA;
            }
          }

          // Update Menu List
          const menuList = document.getElementById('menuAddressList');
          if (menuList) {
            const rows = Array.from(menuList.querySelectorAll('.addr-row'));
            rows.forEach(r => {
              const codeEl = r.querySelector('code.break');
              const valEl = r.querySelector('span');
              if (codeEl && valEl && String(codeEl.textContent).toLowerCase() === key) {
                const m = u4.wallet.addressMsg[key] || {};
                const type = Number(m.type || 0);
                const val = Number(m.value && (m.value.totalValue || m.value.TotalValue) || 0);
                const rate = type === 1 ? 100 : (type === 2 ? 10 : 1);
                const vUSDT = Math.round(val * rate);
                valEl.textContent = `${vUSDT} USDT`;
              }
            });
          }

          try { updateWalletStruct(); } catch { }
          updateWalletBrief();
        });
      }
      if (zeroBtn) {
        zeroBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const u4 = loadUser();
          if (!u4 || !u4.wallet || !u4.wallet.addressMsg) return;
          const key = String(a).toLowerCase();
          const found = u4.wallet.addressMsg[a] || u4.wallet.addressMsg[key];
          if (!found) return;

          // Clear UTXOs
          found.utxos = {};

          found.value = found.value || { totalValue: 0, utxoValue: 0, txCerValue: 0 };
          found.value.utxoValue = 0;
          found.value.totalValue = Number(found.value.txCerValue || 0);
          found.estInterest = 0;
          found.gas = 0;

          const sumVD = { 0: 0, 1: 0, 2: 0 };
          Object.keys(u4.wallet.addressMsg || {}).forEach((addrK) => {
            const m = u4.wallet.addressMsg[addrK] || {};
            const t = Number(m.type || 0);
            const val = Number(m.value && (m.value.totalValue || m.value.TotalValue) || 0);
            if (sumVD[t] !== undefined) {
              sumVD[t] += val;
            }
          });
          u4.wallet.valueDivision = sumVD;
          const pgcTotalZ = Number(sumVD[0] || 0);
          const btcTotalZ = Number(sumVD[1] || 0);
          const ethTotalZ = Number(sumVD[2] || 0);
          const valueTotalPGCZ = pgcTotalZ + btcTotalZ * 1000000 + ethTotalZ * 1000;
          u4.wallet.totalValue = valueTotalPGCZ;
          u4.wallet.TotalValue = valueTotalPGCZ;
          saveUser(u4);
          updateTotalGasBadge(u4);
          updateTotalGasBadge(u4);
          const valEl = item.querySelector('.addr-balance-val');
          if (valEl) {
            valEl.textContent = '0';
            valEl.classList.remove('active');
          }
          const gasEl = item.querySelector('.gas-val');
          if (gasEl) gasEl.textContent = '0 GAS';
          const addrList = document.getElementById('srcAddrList');
          if (addrList) {
            const label = Array.from(addrList.querySelectorAll('label')).find(l => { const inp = l.querySelector('input[type="checkbox"]'); return inp && String(inp.value).toLowerCase() === key; });
            if (label) {
              const amtVal = label.querySelector('.amount-val');
              if (amtVal) {
                amtVal.textContent = '0';
              }
            }
          }
          const usdtEl = document.getElementById('walletUSDT');
          if (usdtEl && u4 && u4.wallet) {
            const vdAll = (u4.wallet.valueDivision) || { 0: 0, 1: 0, 2: 0 };
            const pgcA = Number(vdAll[0] || 0);
            const btcA = Number(vdAll[1] || 0);
            const ethA = Number(vdAll[2] || 0);
            const usdt = Math.round(pgcA * 1 + btcA * 100 + ethA * 10);
            usdtEl.innerHTML = `< span class=\"amt\">${usdt.toLocaleString()}</span><span class=\"unit\">USDT</span>`;
            usdtEl.innerHTML = `<span class=\"amt\">${usdt.toLocaleString()}</span><span class=\"unit\">USDT</span>`;
            const bd = document.querySelector('.currency-breakdown');
            if (bd) {
              const pgcV = bd.querySelector('.tag--pgc');
              const btcV = bd.querySelector('.tag--btc');
              const ethV = bd.querySelector('.tag--eth');
              if (pgcV) pgcV.textContent = pgcA;
              if (btcV) btcV.textContent = btcA;
              if (ethV) ethV.textContent = ethA;
            }
            const gasBadge = document.getElementById('walletGAS');
            if (gasBadge && u4 && u4.wallet) {
              const sumGas = Object.keys(u4.wallet.addressMsg || {}).reduce((s, k) => {
                const m = u4.wallet.addressMsg[k];
                return s + readAddressInterest(m);
              }, 0);
              gasBadge.innerHTML = `<span class="amt">${sumGas.toLocaleString()}</span><span class="unit">GAS</span>`;
            }
            try { updateWalletStruct(); } catch { }
          }
          // Chart update logic removed

          const totalEl = document.getElementById('walletTotalChart');
          if (totalEl) {
            const curPts = totalEl.__pts || [];
            const curLab = totalEl.__label || 'PGC';
            const vdAll = (u4.wallet.valueDivision) || { 0: 0, 1: 0, 2: 0 };
            const useAmt = curLab === 'PGC' ? Number(vdAll[0] || 0) : (curLab === 'BTC' ? Number(vdAll[1] || 0) : Number(vdAll[2] || 0));
            if (curPts.length) {
              curPts[curPts.length - 1] = toPt(useAmt);
              const toYt = (v) => Math.max(0, 160 - v - BASE_LIFT);
              const d = curPts.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * 8} ${toYt(y)}`).join(' ');
              const pT = totalEl.querySelector('path.line');
              if (pT) pT.setAttribute('d', d);
              const tipT = totalEl.querySelector('.tooltip');
              if (tipT) tipT.textContent = `${curLab} ${useAmt} · ${new Date().toLocaleString().slice(0, 16)}`;
            }
          }
          const menuList = document.getElementById('menuAddressList');
          if (menuList) {
            const rows = Array.from(menuList.querySelectorAll('.addr-row'));
            rows.forEach(r => {
              const codeEl = r.querySelector('code.break');
              const valEl = r.querySelector('span');
              if (codeEl && valEl && String(codeEl.textContent).toLowerCase() === key) {
                valEl.textContent = `0 USDT`;
              }
            });
          }
          try { updateWalletStruct(); } catch { }
          updateWalletBrief();
        });
      }
      // Chart initialization and logic removed

      // Removed duplicate click listener on item since we defined it above with better logic
      // item.addEventListener('click', ...) is already handled
    });
  }

  const woCard = document.getElementById('woCard');
  const woEmpty = document.getElementById('woEmpty');
  const woExit = document.getElementById('woExitBtn');
  const joinBtn = document.getElementById('woJoinBtn');
  const g = getJoinedGroup();
  const joined = !!(g && g.groupID);
  if (woCard) woCard.classList.toggle('hidden', !joined);
  if (woExit) woExit.classList.toggle('hidden', !joined);
  if (woEmpty) woEmpty.classList.toggle('hidden', joined);
  if (joinBtn) joinBtn.classList.toggle('hidden', joined);
  [['woGroupID', joined ? g.groupID : ''],
  ['woAggre', joined ? (g.aggreNode || '') : ''],
  ['woAssign', joined ? (g.assignNode || '') : ''],
  ['woPledge', joined ? (g.pledgeAddress || '') : '']]
    .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
  if (woExit && !woExit.dataset._bind) {
    woExit.addEventListener('click', async () => {
      const u3 = loadUser();
      if (!u3 || !u3.accountId) { showModalTip('未登录', '请先登录或注册账户', true); return; }

      const confirmed = await showConfirmModal('退出担保组织', '退出后将清空本地担保组织信息，账户将视为未加入状态。确定要继续吗？', '确认', '取消');
      if (!confirmed) return;

      const ov = document.getElementById('actionOverlay');
      const ovt = document.getElementById('actionOverlayText');
      if (ovt) ovt.textContent = '正在退出担保组织...';
      if (ov) ov.classList.remove('hidden');
      await wait(2000);
      if (ov) ov.classList.add('hidden');

      const latest = loadUser();
      if (latest) {
        try { localStorage.removeItem('guarChoice'); } catch { }
        latest.guarGroup = null;
        latest.orgNumber = '';
        saveUser(latest);
      }
      updateWalletBrief();
      refreshOrgPanel();
      updateOrgDisplay();
      showModalTip('已退出担保组织', '当前账户已退出担保组织，可稍后重新加入。', false);
    });
    woExit.dataset._bind = '1';
  }
  if (joinBtn && !joinBtn.dataset._bind) {
    joinBtn.addEventListener('click', () => {
      routeTo('#/join-group');
    });
    joinBtn.dataset._bind = '1';
  }
  // 动画循环控制
  let chartAnimationId = null;

  window.startChartAnimation = () => {
    if (chartAnimationId) cancelAnimationFrame(chartAnimationId);

    const animate = () => {
      const u = loadUser();
      if (u && u.wallet) {
        // 传入当前时间戳作为"实时"标记，updateWalletChart 内部会处理
        updateWalletChart(u, true);
      }
      chartAnimationId = requestAnimationFrame(animate);
    };
    chartAnimationId = requestAnimationFrame(animate);
  };

  // 修改 updateWalletChart 支持实时模式
  window.updateWalletChart = (u, isLive = false) => {
    const totalEl = document.getElementById('walletTotalChart');
    if (!totalEl) return;

    // 获取历史数据
    let history = (u && u.wallet && u.wallet.history) || [];
    if (history.length === 0) {
      const now = Date.now();
      history = [{ t: now - 3600000, v: 0 }, { t: now, v: 0 }];
    } else if (history.length === 1) {
      history = [{ t: history[0].t - 3600000, v: history[0].v }, history[0]];
    }

    // 如果是实时模式，添加当前时间点作为最新的数据点（视觉上）
    // 注意：这不会修改 u.wallet.history，只是用于渲染
    if (isLive) {
      const lastPoint = history[history.length - 1];
      const now = Date.now();
      // 只有当当前时间大于最后一个点的时间时才添加，避免回退
      if (now > lastPoint.t) {
        // 构造一个新的历史数组用于显示，包含当前时间的点
        // 这个点的值等于最后一个点的值（假设余额未变）
        history = [...history, { t: now, v: lastPoint.v }];
      }
    }

    // ========== 滚动时间窗口设计 ==========
    // 始终显示最近1小时的数据，形成实时监控效果
    const timeWindowSize = 60 * 60 * 1000; // 1小时窗口
    const latestTime = history[history.length - 1].t;
    const windowStartTime = latestTime - timeWindowSize;

    // 过滤出窗口内的数据点
    const visibleHistory = history.filter(h => h.t >= windowStartTime);

    // 如果窗口内没有数据点，使用所有历史数据
    const displayHistory = visibleHistory.length > 0 ? visibleHistory : history;

    // ========== 动态Y轴缩放 ==========
    // 根据可见数据的实际范围动态调整Y轴
    const visibleValues = displayHistory.map(h => h.v);
    const dataMax = Math.max(...visibleValues);
    const dataMin = Math.min(...visibleValues);

    // 计算数据范围
    const dataRange = dataMax - dataMin;

    // 设置最小显示范围（避免曲线过于平坦）
    const minDisplayRange = 20;
    const effectiveRange = Math.max(dataRange, minDisplayRange);

    // 添加上下缓冲区（15%），让曲线不会顶格或贴底
    const bufferRatio = 0.15;
    const buffer = effectiveRange * bufferRatio;

    // 计算最终的显示范围
    let displayMin = dataMin - buffer;
    let displayMax = dataMax + buffer;

    // 如果数据范围使用了最小显示范围，居中显示数据
    if (dataRange < minDisplayRange) {
      const center = (dataMax + dataMin) / 2;
      displayMin = center - (minDisplayRange + buffer * 2) / 2;
      displayMax = center + (minDisplayRange + buffer * 2) / 2;
    }

    // 确保显示范围包含0（如果数据接近0）
    if (displayMin > 0 && displayMin < 5) {
      displayMin = 0;
    }

    const valSpan = displayMax - displayMin;

    // ========== 坐标系统 ==========
    const width = totalEl.clientWidth || 320;
    const height = 160;
    const paddingX = 20;
    const paddingY = 30;

    // 时间轴：始终显示完整的1小时窗口
    const toX = (t) => paddingX + ((t - windowStartTime) / timeWindowSize) * (width - paddingX * 2);
    const toY = (v) => height - paddingY - ((v - displayMin) / valSpan) * (height - paddingY * 2);

    // ========== 阶梯化数据处理 ==========
    // 为了实现"水平保持 -> 垂直突变"的效果，我们需要在数值变化点插入一个中间点
    // 即：在 t2 时刻值变为 v2，我们在 t2 时刻先插入一个 v1 的点
    const steppedHistory = [];
    if (displayHistory.length > 0) {
      steppedHistory.push(displayHistory[0]);
      for (let i = 1; i < displayHistory.length; i++) {
        const prev = displayHistory[i - 1];
        const curr = displayHistory[i];

        // 如果数值发生变化，插入阶梯点
        if (curr.v !== prev.v) {
          // 插入点：时间 = 当前时间，值 = 上一个值
          // 注意：为了避免完全垂直导致的计算问题（虽然我们的算法能处理），
          // 或者为了逻辑清晰，这里直接插入即可。
          // 我们的圆角算法可以处理垂直线段。
          steppedHistory.push({ t: curr.t, v: prev.v });
        }
        steppedHistory.push(curr);
      }
    }

    // 生成路径点（使用阶梯化后的数据）
    const points = steppedHistory.map(h => [toX(h.t), toY(h.v)]);

    // 圆角折线生成算法
    const cornerRadius = 10; // 圆角半径

    // 重新实现构建逻辑
    let pathD = '';
    if (points.length > 0) {
      pathD = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;

      for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];

        const v1Len = Math.sqrt(Math.pow(curr[0] - prev[0], 2) + Math.pow(curr[1] - prev[1], 2));
        const v2Len = Math.sqrt(Math.pow(next[0] - curr[0], 2) + Math.pow(next[1] - curr[1], 2));

        const r = Math.min(cornerRadius, v1Len / 2, v2Len / 2);

        // 起始点
        const startX = curr[0] - (curr[0] - prev[0]) * r / v1Len;
        const startY = curr[1] - (curr[1] - prev[1]) * r / v1Len;

        // 结束点
        const endX = curr[0] + (next[0] - curr[0]) * r / v2Len;
        const endY = curr[1] + (next[1] - curr[1]) * r / v2Len;

        // 直线连到圆角起始点
        pathD += ` L ${startX.toFixed(1)},${startY.toFixed(1)}`;
        // 二次贝塞尔曲线画圆角
        pathD += ` Q ${curr[0].toFixed(1)},${curr[1].toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`;
      }

      // 连接最后一个点
      if (points.length > 1) {
        const last = points[points.length - 1];
        pathD += ` L ${last[0].toFixed(1)},${last[1].toFixed(1)}`;
      }
    }

    // 闭合区域路径 (注意底部闭合点也要考虑 paddingX)
    const areaD = `${pathD} L ${width - paddingX} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`;

    // 检查并初始化 SVG
    let svg = totalEl.querySelector('svg');
    if (!svg) {
      totalEl.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible;">
          <defs>
            <linearGradient id="totalChartGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.15"/>
              <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path class="area" d="" fill="url(#totalChartGradient)" style="transition: none;"/>
          <path class="line" d="" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transition: none;"/>
          <line class="cursor" x1="0" y1="0" x2="0" y2="${height}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4" style="opacity:0; pointer-events:none;"/>
          <circle class="dot" cx="0" cy="0" r="5" fill="#fff" stroke="#3b82f6" stroke-width="2.5" style="opacity:0; pointer-events:none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"/>
        </svg>
        <div class="tooltip" style="opacity:0; position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.95); padding:6px 10px; border-radius:8px; font-size:12px; color:#475569; box-shadow:0 4px 12px rgba(0,0,0,0.08); border:1px solid #e2e8f0; pointer-events:none; transition:opacity 0.2s; font-family: 'Inter', sans-serif; font-weight:500;"></div>
      `;
      svg = totalEl.querySelector('svg');
    } else {
      // 更新 viewBox 以适应可能的容器大小变化
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    const pathLine = totalEl.querySelector('path.line');
    const pathArea = totalEl.querySelector('path.area');

    if (pathLine) pathLine.setAttribute('d', pathD);
    if (pathArea) pathArea.setAttribute('d', areaD);

    // 存储数据供事件处理使用
    totalEl.__history = displayHistory; // 注意这里存储的是 displayHistory
    totalEl.__toX = toX;
    totalEl.__toY = toY;
    totalEl.__width = width;

    // 绑定事件 (只绑定一次)
    if (!svg.dataset._boundV3) {
      const mouseMoveHandler = (e) => {
        const h = totalEl.__history;
        const w = totalEl.__width;
        if (!h || !w) return;

        const rect = svg.getBoundingClientRect();
        const x = Math.max(0, Math.min(w, (e.clientX - rect.left) * (w / rect.width)));

        // 查找最近点
        let closest = h[0];
        let minDist = Infinity;
        h.forEach(pt => {
          const px = totalEl.__toX(pt.t);
          const dist = Math.abs(px - x);
          if (dist < minDist) { minDist = dist; closest = pt; }
        });

        const cx = totalEl.__toX(closest.t);
        const cy = totalEl.__toY(closest.v);

        const c = totalEl.querySelector('.cursor');
        const d = totalEl.querySelector('.dot');
        const t = totalEl.querySelector('.tooltip');

        if (c) { c.setAttribute('x1', cx); c.setAttribute('x2', cx); c.style.opacity = 1; }
        if (d) { d.setAttribute('cx', cx); d.setAttribute('cy', cy); d.style.opacity = 1; }

        const date = new Date(closest.t);
        const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
        if (t) {
          t.innerHTML = `<span style="color:#64748b">Total:</span> <span style="color:#0f172a;font-weight:700">${closest.v.toLocaleString()} USDT</span> <span style="color:#cbd5e1;margin:0 4px">|</span> <span style="color:#94a3b8">${timeStr}</span>`;
          t.style.opacity = 1;
        }
      };

      const mouseLeaveHandler = () => {
        const c = totalEl.querySelector('.cursor');
        const d = totalEl.querySelector('.dot');
        const t = totalEl.querySelector('.tooltip');
        if (c) c.style.opacity = 0;
        if (d) d.style.opacity = 0;
        if (t) t.style.opacity = 0;
      };

      svg.addEventListener('mousemove', mouseMoveHandler);
      svg.addEventListener('mouseleave', mouseLeaveHandler);
      svg.dataset._boundV3 = 'true';
    }
  };

  // 初始化调用并启动动画
  const uChart = loadUser();
  if (uChart) {
    updateWalletChart(uChart);
    startChartAnimation();
  }

  const usdtEl = document.getElementById('walletUSDT');
  if (usdtEl && u && u.wallet) {
    const vd = (u.wallet.valueDivision) || { 0: 0, 1: 0, 2: 0 };
    const pgc = Number(vd[0] || 0);
    const btc = Number(vd[1] || 0);
    const eth = Number(vd[2] || 0);
    const usdt = Math.round(pgc * 1 + btc * 100 + eth * 10);
    usdtEl.innerHTML = `<span class="amt">${usdt.toLocaleString()}</span><span class="unit">USDT</span>`;
    const totalTags2 = document.querySelector('.currency-breakdown');
    if (totalTags2) {
      const pgcV = totalTags2.querySelector('.tag--pgc');
      const btcV = totalTags2.querySelector('.tag--btc');
      const ethV = totalTags2.querySelector('.tag--eth');
      if (pgcV) pgcV.textContent = pgc;
      if (btcV) btcV.textContent = btc;
      if (ethV) ethV.textContent = eth;
    }
    const gasBadge2 = document.getElementById('walletGAS');
    if (gasBadge2 && u && u.wallet) {
      const sumGas2 = Object.keys(u.wallet.addressMsg || {}).reduce((s, k) => {
        const m = u.wallet.addressMsg[k];
        return s + readAddressInterest(m);
      }, 0);
      gasBadge2.innerHTML = `<span class="amt">${sumGas2.toLocaleString()}</span><span class="unit">GAS</span>`;
    }
  }
  const wsToggle = document.getElementById('walletStructToggle');
  const wsBox = document.getElementById('walletStructBox');
  if (wsToggle && wsBox && !wsToggle.dataset._bind) {
    wsToggle.addEventListener('click', () => {
      const isExpanded = wsBox.classList.contains('expanded');
      
      if (!isExpanded) {
        // Expanding
        // Render content first so we can calculate height if needed, though 'auto' height animation is tricky in CSS alone
        // A common trick is to set max-height, or use grid template rows. 
        // But here we used height: auto in CSS which doesn't animate. 
        // Let's update content before expanding.
        updateWalletStruct();
        
        // To animate from 0 to auto height, we can use a grid trick or JS calculation.
        // For simplicity with the current CSS 'height: auto' approach (which snaps), let's use a JS helper for smooth height.
        
        wsBox.classList.remove('hidden'); // ensure it's display:block if it was hidden
        
        // Get natural height
        wsBox.style.height = 'auto';
        wsBox.style.padding = '12px';
        wsBox.style.marginTop = '12px';
        wsBox.style.borderWidth = '1px';
        const fullHeight = wsBox.scrollHeight + 'px';
        
        // Reset to start animation
        wsBox.style.height = '0px';
        wsBox.style.padding = '0px';
        wsBox.style.marginTop = '0px';
        wsBox.style.borderWidth = '0px';
        wsBox.offsetHeight; // Force reflow
        
        wsBox.classList.add('expanded');
        wsBox.style.height = fullHeight;
        // Clear manual styles after transition to allow auto resize
        setTimeout(() => {
           wsBox.style.height = '';
           wsBox.style.padding = '';
           wsBox.style.marginTop = '';
           wsBox.style.borderWidth = '';
        }, 350);
        
        wsToggle.textContent = '收起账户结构体';
      } else {
        // Collapsing
        // Lock current height
        wsBox.style.height = wsBox.scrollHeight + 'px';
        wsBox.style.padding = '12px';
        wsBox.style.marginTop = '12px';
        wsBox.style.borderWidth = '1px';
        wsBox.offsetHeight; // Force reflow
        
        wsBox.classList.remove('expanded');
        // Trigger close styles via class removal, but we need inline styles to animate to 0 properly if class removal isn't enough or overrides
        // Actually the class removal handles the target state (height: 0), but we need to ensure it transitions.
        // The CSS defines the target state for non-expanded.
        
        // We need to clear inline styles that locked it open, so CSS takes over? 
        // No, CSS 'height:0' is the target. If we set inline height to scrollHeight, removing class 'expanded' 
        // will try to go to 0, but inline style wins. So we must set inline to 0.
        
        requestAnimationFrame(() => {
          wsBox.style.height = '0px';
          wsBox.style.padding = '0px';
          wsBox.style.marginTop = '0px';
          wsBox.style.borderWidth = '0px';
        });
        
        setTimeout(() => {
          wsBox.style.height = '';
          wsBox.style.padding = '';
          wsBox.style.marginTop = '';
          wsBox.style.borderWidth = '';
          wsBox.classList.add('hidden'); // optional, but keeps accessible state
        }, 350);

        wsToggle.textContent = '展开账户结构体';
      }
    });
    wsToggle.dataset._bind = '1';
  }
  const qtBtn = document.getElementById('qtSendBtn');
  if (qtBtn && !qtBtn.dataset._bind) {
    qtBtn.addEventListener('click', () => {
      alert('已提交快速转账请求（占位）');
    });
    qtBtn.dataset._bind = '1';
  }
  const ctBtn = document.getElementById('ctSendBtn');
  if (ctBtn && !ctBtn.dataset._bind) {
    ctBtn.addEventListener('click', () => {
      alert('已提交跨链转账请求（占位）');
    });
    ctBtn.dataset._bind = '1';
  }
  const refreshBtn = document.getElementById('refreshWalletBtn');
  if (refreshBtn && !refreshBtn.dataset._bind) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('is-loading');
      setTimeout(() => {
        refreshBtn.classList.remove('is-loading');
      }, 1500);
    });
    refreshBtn.dataset._bind = '1';
  }

  const tfMode = document.getElementById('tfMode');
  const tfModeQuick = document.getElementById('tfModeQuick');
  const tfModeCross = document.getElementById('tfModeCross');
  const tfModePledge = document.getElementById('tfModePledge');
  const tfBtn = document.getElementById('tfSendBtn');
  if (tfMode && tfBtn && !tfBtn.dataset._bind) {
    const addrList = document.getElementById('srcAddrList');
    const billList = document.getElementById('billList');
    const addBillBtn = document.getElementById('addBillBtn');
    const chPGC = document.getElementById('chAddrPGC');
    const chBTC = document.getElementById('chAddrBTC');
    const chETH = document.getElementById('chAddrETH');
    const csPGC = document.getElementById('csChPGC');
    const csBTC = document.getElementById('csChBTC');
    const csETH = document.getElementById('csChETH');
    const gasInput = document.getElementById('extraGasPGC');
    const txGasInput = document.getElementById('txGasInput');
    const useTXCer = document.getElementById('useTXCer');
    const isPledge = document.getElementById('isPledge');
    const useTXCerChk = document.getElementById('useTXCerChk');
    const txErr = document.getElementById('txError');
    const txPreview = document.getElementById('txPreview');
    const currentOrgId = (typeof computeCurrentOrgId === 'function' ? computeCurrentOrgId() : '');
    const hasOrg = !!String(currentOrgId || '').trim();
    if (tfModeQuick && tfModeQuick.parentNode) {
      const quickLabel = tfModeQuick.parentNode;
      const last = quickLabel.lastChild;
      if (last && last.nodeType === 3) {
        last.textContent = hasOrg ? ' 快速转账' : ' 普通交易';
      }
    }
    if (!hasOrg) {
      if (tfModeCross) {
        tfModeCross.checked = false;
        tfModeCross.disabled = true;
        const l = tfModeCross.parentNode;
        if (l && l.style) l.style.display = 'none';
      }
      if (tfModePledge) {
        tfModePledge.checked = false;
        tfModePledge.disabled = true;
        const l2 = tfModePledge.parentNode;
        if (l2 && l2.style) l2.style.display = 'none';
      }
      tfMode.value = 'quick';
      if (tfModeQuick) tfModeQuick.checked = true;
      if (isPledge) isPledge.value = 'false';
    }
    const u0 = loadUser();
    let walletMap = (u0 && u0.wallet && u0.wallet.addressMsg) || {};
    const getWalletGasSum = (map) => Object.keys(map).reduce((sum, addr) => {
      const meta = map[addr];
      return sum + readAddressInterest(meta);
    }, 0);
    var walletGasTotal = getWalletGasSum(walletMap);
    const refreshWalletSnapshot = () => {
      const latest = loadUser();
      walletMap = (latest && latest.wallet && latest.wallet.addressMsg) || {};
      walletGasTotal = getWalletGasSum(walletMap);
      return walletMap;
    };
    let srcAddrs = Object.keys(walletMap);
    const currencyLabels = { 0: 'PGC', 1: 'BTC', 2: 'ETH' };
    const showTxValidationError = (msg, focusEl) => {
      if (txErr) {
        txErr.textContent = msg;
        txErr.classList.remove('hidden');
      }
      showModalTip('参数校验失败', msg, true);
      if (focusEl && typeof focusEl.focus === 'function') focusEl.focus();
    };
    const normalizeAddrInput = (addr) => (addr ? String(addr).trim().toLowerCase() : '');
    const isValidAddressFormat = (addr) => /^[0-9a-f]{40}$/.test(addr);
    const MOCK_ADDR_INFO = {
      '299954ff8bbd78eda3a686abcf86732cd18533af': {
        groupId: '10000000',
        pubKey: '2b9edf25237d23a753ea8774ffbfb1b6d6bbbc2c96209d41ee59089528eb1566&c295d31bfd805e18b212fbbb726fc29a1bfc0762523789be70a2a1b737e63a80'
      },
      'd76ec4020140d58c35e999a730bea07bf74a7763': {
        groupId: '',
        pubKey: '11970dd5a7c3f6a131e24e8f066416941d79a177579c63d889ef9ce90ffd9ca8&037d81e8fb19883cc9e5ed8ebcc2b75e1696880c75a864099bec10a5821f69e0'
      }
    };
    const fetchAddrInfo = async (addr) => {
      const norm = normalizeAddrInput(addr);
      if (!norm || !isValidAddressFormat(norm)) return null;
      const info = MOCK_ADDR_INFO[norm];
      if (info) {
        return { groupId: info.groupId || '', pubKey: info.pubKey || '' };
      }
      return null;
    };
    const getAddrMeta = (addr) => walletMap[addr];
    const getAddrBalance = (meta) => {
      if (!meta) return 0;
      if (meta.value) {
        if (typeof meta.value.totalValue === 'number') return Number(meta.value.totalValue);
        if (typeof meta.value.TotalValue === 'number') return Number(meta.value.TotalValue);
      }
      if (typeof meta.totalValue === 'number') return Number(meta.totalValue);
      if (typeof meta.balance === 'number') return Number(meta.balance);
      return 0;
    };
    const getAddrGasBalance = (meta) => readAddressInterest(meta);
    const rebuildAddrList = () => {
      srcAddrs = Object.keys(walletMap);
      addrList.innerHTML = srcAddrs.map(a => {
        const meta = walletMap[a] || {};
        const tId = Number(meta && meta.type !== undefined ? meta.type : 0);
        const amt = Number((meta && meta.value && meta.value.utxoValue) || 0);
        // 币种图标和颜色
        const coinIcons = { 0: '₱', 1: '₿', 2: 'Ξ' };
        const coinColors = { 0: 'pgc', 1: 'btc', 2: 'eth' };
        const icon = coinIcons[tId] || '₱';
        const color = coinColors[tId] || 'pgc';
        // 地址缩略显示
        const shortAddr = a.slice(0, 6) + '...' + a.slice(-4);
        return `<label class="src-addr-item" data-addr="${a}">
          <input type="checkbox" value="${a}">
          <span class="addr-check"></span>
          <span class="addr-short" title="${a}">${shortAddr}</span>
          <span class="addr-amount coin--${color}">
            <span class="coin-symbol">${icon}</span>
            <span class="amount-val">${amt}</span>
          </span>
        </label>`;
      }).join('');
    };
    rebuildAddrList();
    const fillChange = () => {
      const sel = Array.from(addrList.querySelectorAll('input[type="checkbox"]')).filter(x => x.checked).map(x => x.value);
      Array.from(addrList.querySelectorAll('label')).forEach(l => { const inp = l.querySelector('input[type="checkbox"]'); if (inp) l.classList.toggle('selected', inp.checked); });

      // Filter addresses by type
      const getAddrsByType = (typeId) => {
        const pool = sel.length ? sel : srcAddrs;
        return pool.filter(addr => {
          const meta = walletMap[addr];
          return meta && Number(meta.type) === typeId;
        });
      };

      const optsPGC = getAddrsByType(0);
      const optsBTC = getAddrsByType(1);
      const optsETH = getAddrsByType(2);

      const buildOptions = (opts) => opts.map(a => `<option value="${a}">${a}</option>`).join('');

      chPGC.innerHTML = buildOptions(optsPGC);
      chBTC.innerHTML = buildOptions(optsBTC);
      chETH.innerHTML = buildOptions(optsETH);

      const buildMenu = (box, optsArr, hidden) => {
        if (!box) return;
        const menu = box.querySelector('.custom-select__menu');
        const valEl = box.querySelector('.addr-val');

        if (optsArr.length === 0) {
          if (menu) menu.innerHTML = '<div class="custom-select__item disabled">无可用地址</div>';
          if (valEl) valEl.textContent = '无可用地址';
          if (hidden) hidden.value = '';
          return;
        }

        if (menu) menu.innerHTML = optsArr.map(a => `<div class="custom-select__item" data-val="${a}"><span class="coin-icon ${box.dataset.coin === 'BTC' ? 'coin--btc' : (box.dataset.coin === 'ETH' ? 'coin--eth' : 'coin--pgc')}"></span><code class="break" style="font-weight:700">${a}</code></div>`).join('');

        // Preserve existing selection if valid, otherwise select first
        const currentVal = hidden.value;
        const isValid = optsArr.includes(currentVal);
        const first = isValid ? currentVal : (optsArr[0] || '');

        if (valEl) valEl.textContent = first;
        if (hidden) hidden.value = first;
      };

      buildMenu(csPGC, optsPGC, chPGC);
      buildMenu(csBTC, optsBTC, chBTC);
      buildMenu(csETH, optsETH, chETH);
      updateSummaryAddr();
    };
    fillChange();
    addrList.addEventListener('change', fillChange);
    const bindCs = (box, hidden) => {
      if (!box || box.dataset._bind) return;
      box.addEventListener('click', (e) => { e.stopPropagation(); const sec = box.closest('.tx-section'); const opening = !box.classList.contains('open'); box.classList.toggle('open'); if (sec) sec.classList.toggle('has-open', opening); });
      const menu = box.querySelector('.custom-select__menu');
      if (menu) {
        menu.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const item = ev.target.closest('.custom-select__item');
          if (!item) return;
          const v = item.getAttribute('data-val');
          const valEl = box.querySelector('.addr-val');
          if (valEl) valEl.textContent = v;
          if (hidden) hidden.value = v;
          box.classList.remove('open'); const sec = box.closest('.tx-section'); if (sec) sec.classList.remove('has-open'); updateSummaryAddr();
        });
      }
      document.addEventListener('click', () => { box.classList.remove('open'); const sec = box.closest('.tx-section'); if (sec) sec.classList.remove('has-open'); });
      box.dataset._bind = '1';
    };
    bindCs(csPGC, chPGC);
    bindCs(csBTC, chBTC);
    bindCs(csETH, chETH);
    const changeSec = document.querySelector('.tx-section.tx-change');
    const changeSummary = document.getElementById('changeSummary');
    const changeHeadBtn = document.getElementById('changeHead');
    const changeAddrText = document.getElementById('changeAddrText');
    function shortAddr(s) {
      const t = String(s || ''); if (t.length <= 22) return t; return t.slice(0, 14) + '...' + t.slice(-6);
    }
    function updateSummaryAddr() {
      let v = chPGC && chPGC.value ? chPGC.value : (csPGC && csPGC.querySelector('.addr-val') ? csPGC.querySelector('.addr-val').textContent : '');
      if (!v) {
        const u = loadUser();
        const first = u && u.wallet ? Object.keys(u.wallet.addressMsg || {})[0] : '';
        v = (u && u.address) || first || '';
      }
      const el = document.getElementById('changeAddrText');
      if (el) el.textContent = shortAddr(v);
    }
    updateSummaryAddr();
    if (changeSec) { changeSec.classList.add('collapsed'); }
    const toggleChangeCollapsed = () => {
      if (!changeSec) return;
      const isCollapsed = changeSec.classList.contains('collapsed');
      if (isCollapsed) { changeSec.classList.remove('collapsed'); }
      else { changeSec.classList.add('collapsed'); updateSummaryAddr(); }
    };
    const bindToggle = (el) => { if (!el) return; el.onclick = toggleChangeCollapsed; };
    bindToggle(changeSummary);
    bindToggle(changeHeadBtn);
    let billSeq = 0;
    const updateRemoveState = () => {
      const rows = Array.from(billList.querySelectorAll('.bill-item'));
      const onlyOne = rows.length <= 1;
      rows.forEach(r => {
        const btn = r.querySelector('.bill-remove');
        if (btn) {
          btn.disabled = onlyOne;
          if (onlyOne) {
            btn.setAttribute('title', '仅剩一笔转账账单不允许删除');
            btn.setAttribute('aria-disabled', 'true');
          } else {
            btn.removeAttribute('title');
            btn.removeAttribute('aria-disabled');
          }
        }
      });
    };
    const addBill = () => {
      const g = computeCurrentOrgId() || '';
      const row = document.createElement('div');
      row.className = 'bill-item';
      const idBase = `bill_${Date.now()}_${billSeq++}`;
      row.innerHTML = `
        <div class="bill-grid">
          <div class="bill-row bill-row--full bill-row--addr"><label class="bill-label" for="${idBase}_to">地址</label><div class="bill-addr-input-wrap"><input id="${idBase}_to" class="input" type="text" placeholder="To Address" aria-label="目标地址" data-name="to"><button type="button" class="bill-addr-lookup" aria-label="自动补全担保组织与公钥" title="查询担保组织与公钥" data-role="addr-lookup"><svg class="icon-search" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="4.2" stroke="currentColor" stroke-width="1.6" fill="none"></circle><line x1="10.2" y1="10.2" x2="13" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></line></svg></button></div></div>
          <div class="bill-row"><label class="bill-label" for="${idBase}_val">金额</label><input id="${idBase}_val" class="input" type="number" placeholder="金额" aria-label="金额" data-name="val"></div>
          <div class="bill-row"><label class="bill-label" for="${idBase}_mt">币种</label><div id="${idBase}_mt" class="input custom-select" role="button" aria-label="币种" data-name="mt" data-val="0"><span class="custom-select__value"><span class="coin-icon coin--pgc"></span><span class="coin-label">PGC</span></span><span class="custom-select__arrow">▾</span><div class="custom-select__menu"><div class="custom-select__item" data-val="0"><span class="coin-icon coin--pgc"></span><span class="coin-label">PGC</span></div><div class="custom-select__item" data-val="1"><span class="coin-icon coin--btc"></span><span class="coin-label">BTC</span></div><div class="custom-select__item" data-val="2"><span class="coin-icon coin--eth"></span><span class="coin-label">ETH</span></div></div></div></div>
          <div class="bill-row bill-row--full"><label class="bill-label" for="${idBase}_pub">公钥</label><input id="${idBase}_pub" class="input" type="text" placeholder="04 + X + Y 或 X,Y" aria-label="公钥" data-name="pub"></div>
          <div class="bill-row"><label class="bill-label" for="${idBase}_gid">担保组织ID</label><input id="${idBase}_gid" class="input" type="text" placeholder="担保组织ID" value="" aria-label="担保组织ID" data-name="gid"></div>
          <div class="bill-row"><label class="bill-label" for="${idBase}_gas">转移Gas</label><input id="${idBase}_gas" class="input" type="number" placeholder="转移Gas" aria-label="转移Gas" data-name="gas"></div>
          <div class="bill-actions bill-actions--full"><button class="btn danger btn--sm bill-remove">删除</button></div>
        </div>
      `;
      const addrInputEl = row.querySelector('[data-name="to"]');
      const gidInputEl = row.querySelector('[data-name="gid"]');
      const pubInputEl = row.querySelector('[data-name="pub"]');
      const lookupBtn = row.querySelector('[data-role="addr-lookup"]');
      if (lookupBtn && addrInputEl) {
        lookupBtn.addEventListener('click', async () => {
          if (lookupBtn.dataset.loading === '1') return;
          const raw = addrInputEl.value || '';
          const normalized = normalizeAddrInput(raw);
          if (!normalized) {
            showTxValidationError('请先填写要查询的地址', addrInputEl);
            return;
          }
          if (!isValidAddressFormat(normalized)) {
            showTxValidationError('目标地址格式错误，应为40位十六进制字符串', addrInputEl);
            return;
          }
          lookupBtn.dataset.loading = '1';
          lookupBtn.classList.add('is-loading');
          lookupBtn.disabled = true;
          try {
            const started = Date.now();
            const info = await fetchAddrInfo(normalized);
            const elapsed = Date.now() - started;
            if (elapsed < 2000) {
              await new Promise((resolve) => setTimeout(resolve, 2000 - elapsed));
            }
            if (!info) {
              showModalTip('地址查询失败', '未找到该地址对应的信息，请检查输入是否正确。', true);
              return;
            }
            if (pubInputEl && info.pubKey) {
              pubInputEl.value = info.pubKey;
            }
            if (gidInputEl) {
              gidInputEl.value = info.groupId || '';
            }
          } catch (e) {
            showModalTip('地址查询失败', '查询地址信息时发生错误，请稍后重试。', true);
          } finally {
            lookupBtn.disabled = false;
            lookupBtn.classList.remove('is-loading');
            delete lookupBtn.dataset.loading;
          }
        });
      }
      billList.appendChild(row);
      updateRemoveState();
      const del = row.querySelector('.bill-remove');
      del.addEventListener('click', () => {
        const rows = Array.from(billList.querySelectorAll('.bill-item'));
        if (rows.length <= 1) return;
        row.remove();
        updateRemoveState();
      });
      const gasInputEl = row.querySelector('[data-name="gas"]');
      const cs = row.querySelector('#' + idBase + '_mt');
      if (cs) {
        cs.addEventListener('click', (e) => { e.stopPropagation(); cs.classList.toggle('open'); });
        const menu = cs.querySelector('.custom-select__menu');
        if (menu) {
          menu.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const item = ev.target.closest('.custom-select__item');
            if (!item) return;
            const v = item.getAttribute('data-val');
            cs.dataset.val = v;
            const valEl = cs.querySelector('.custom-select__value');
            if (valEl) {
              const labels = { '0': { t: 'PGC', c: 'coin--pgc' }, '1': { t: 'BTC', c: 'coin--btc' }, '2': { t: 'ETH', c: 'coin--eth' } };
              const m = labels[v] || labels['0'];
              valEl.innerHTML = `<span class="coin-icon ${m.c}"></span><span class="coin-label">${m.t}</span>`;
            }
            cs.classList.remove('open');
          });
        }
        document.addEventListener('click', () => { cs.classList.remove('open'); });
      }
      if (gasInputEl) { gasInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addBill(); } }); }
    };
    addBillBtn.addEventListener('click', () => { addBill(); });
    addBill();
    updateRemoveState();
    const updateBtn = () => {
      tfBtn.textContent = '生成交易结构体';
      tfBtn.classList.remove('secondary');
      tfBtn.classList.add('primary');
    };
    const syncModeState = () => {
      const current = tfMode.value || 'quick';
      if (tfModeQuick) tfModeQuick.checked = current === 'quick';
      if (tfModeCross) tfModeCross.checked = current === 'cross';
      if (tfModePledge) tfModePledge.checked = current === 'pledge';
      if (isPledge) isPledge.value = current === 'pledge' ? 'true' : 'false';
    };
    const applyRadio = () => {
      if (tfModeQuick && tfModeQuick.checked) tfMode.value = 'quick';
      else if (tfModeCross && tfModeCross.checked) tfMode.value = 'cross';
      else if (tfModePledge && tfModePledge.checked) tfMode.value = 'pledge';
      else tfMode.value = 'quick';
      if (isPledge) isPledge.value = tfMode.value === 'pledge' ? 'true' : 'false';
      updateBtn();
    };
    updateBtn();
    syncModeState();
    if (tfMode) tfMode.addEventListener('change', () => { syncModeState(); updateBtn(); });
    [tfModeQuick, tfModeCross, tfModePledge].forEach((radio) => {
      if (radio) radio.addEventListener('change', applyRadio);
    });
    if (useTXCerChk) {
      useTXCerChk.checked = (String(useTXCer.value) === 'true');
      useTXCerChk.addEventListener('change', () => { useTXCer.value = useTXCerChk.checked ? 'true' : 'false'; });
    }
    if (gasInput) { if (!gasInput.value) gasInput.value = '0'; }
    const rates = { 0: 1, 1: 1000000, 2: 1000 };
    tfBtn.addEventListener('click', async () => {
      refreshWalletSnapshot();
      if (txErr) { txErr.textContent = ''; txErr.classList.add('hidden'); }
      if (txPreview) { txPreview.classList.add('hidden'); txPreview.textContent = ''; }
      const sel = Array.from(addrList.querySelectorAll('input[type="checkbox"]')).filter(x => x.checked).map(x => x.value);
      if (sel.length === 0) { showTxValidationError('请选择至少一个来源地址'); return; }
      for (const addr of sel) {
        if (!getAddrMeta(addr)) {
          showTxValidationError('部分来源地址不存在，请刷新后重试');
          return;
        }
      }
      const rows = Array.from(billList.querySelectorAll('.bill-item'));
      if (rows.length === 0) { showTxValidationError('请至少添加一笔转账账单'); return; }
      const isCross = tfMode.value === 'cross';
      if (isCross && rows.length !== 1) { showTxValidationError('跨链交易只能包含一笔账单'); return; }
      const changeMap = {};
      if (chPGC.value) changeMap[0] = chPGC.value;
      if (chBTC.value) changeMap[1] = chBTC.value;
      if (chETH.value) changeMap[2] = chETH.value;
      const bills = {};
      const vd = { 0: 0, 1: 0, 2: 0 };
      let outInterest = 0;
      const parsePub = (raw) => {
        const res = { x: '', y: '', ok: false };
        const rawStr = String(raw || '').trim();
        if (!rawStr) return res;
        const normalized = rawStr.replace(/^0x/i, '').toLowerCase();
        if (/^04[0-9a-f]{128}$/.test(normalized)) {
          res.x = normalized.slice(2, 66);
          res.y = normalized.slice(66);
          res.ok = true;
          return res;
        }
        const parts = normalized.split(/[,&\s]+/).filter(Boolean);
        if (parts.length === 2 && /^[0-9a-f]{64}$/.test(parts[0]) && /^[0-9a-f]{64}$/.test(parts[1])) {
          res.x = parts[0];
          res.y = parts[1];
          res.ok = true;
        }
        return res;
      };
      for (const r of rows) {
        const toEl = r.querySelector('[data-name="to"]');
        const mtEl = r.querySelector('[data-name="mt"]');
        const valEl = r.querySelector('[data-name="val"]');
        const gidEl = r.querySelector('[data-name="gid"]');
        const pubEl = r.querySelector('[data-name="pub"]');
        const gasEl = r.querySelector('[data-name="gas"]');
        const to = String((toEl && toEl.value) || '').trim();
        const normalizedTo = normalizeAddrInput(to);
        const mtRaw = (mtEl && mtEl.dataset && mtEl.dataset.val) || '0';
        const mt = Number(mtRaw);
        const val = Number((valEl && valEl.value) || 0);
        const gid = String((gidEl && gidEl.value) || '').trim();
        const comb = String((pubEl && pubEl.value) || '').trim();
        const parsedPub = parsePub(comb);
        const { x: px, y: py, ok: pubOk } = parsedPub;
        const tInt = Number((gasEl && gasEl.value) || 0);
        if (!to || val <= 0) { showTxValidationError('请填写有效的账单信息', toEl); return; }
        if (!isValidAddressFormat(normalizedTo)) { showTxValidationError('目标地址格式错误，应为40位十六进制字符串', toEl); return; }
        if (![0, 1, 2].includes(mt)) { showTxValidationError('请选择合法的币种'); return; }
        if (gid && !/^\d{8}$/.test(gid)) { showTxValidationError('担保组织ID 必须为 8 位数字', gidEl); return; }
        if (!pubOk) { showTxValidationError('公钥格式不正确，请输入 04+XY 或 X&Y', pubEl); return; }
        if (!Number.isFinite(val) || val <= 0) { showTxValidationError('金额必须为正数', valEl); return; }
        if (!Number.isFinite(tInt) || tInt < 0) { showTxValidationError('Gas 需为不小于 0 的数字', gasEl); return; }
        if (isCross && mt !== 0) { showTxValidationError('跨链交易只能使用主货币'); return; }
        if (bills[normalizedTo]) { showTxValidationError('同一地址仅允许一笔账单'); return; }
        bills[normalizedTo] = { MoneyType: mt, Value: val, GuarGroupID: gid, PublicKey: { Curve: 'P256', XHex: px, YHex: py }, ToInterest: tInt };
        vd[mt] += val;
        outInterest += Math.max(0, tInt || 0);
      }
      const extraPGC = Number(gasInput.value || 0);
      if (!Number.isFinite(extraPGC) || extraPGC < 0) { showTxValidationError('额外支付的 PGC 必须是非负数字', gasInput); return; }
      const interestGas = extraPGC > 0 ? extraPGC : 0;
      vd[0] += extraPGC;
      const baseTxGas = Number((txGasInput && txGasInput.value) ? txGasInput.value : 1);
      if (!Number.isFinite(baseTxGas) || baseTxGas < 0) { showTxValidationError('交易Gas 需为不小于 0 的数字', txGasInput); return; }
      const typeBalances = { 0: 0, 1: 0, 2: 0 };
      const availableGas = walletGasTotal;
      sel.forEach((addr) => {
        const meta = getAddrMeta(addr) || {};
        const type = Number(meta.type || 0);
        const val = Number(meta.value && (meta.value.totalValue || meta.value.TotalValue) || 0);
        if (typeBalances[type] !== undefined) {
          typeBalances[type] += val;
        }
      });
      const ensureChangeAddrValid = (typeId) => {
        const need = vd[typeId] || 0;
        if (need <= 0) return true;
        const addr = changeMap[typeId];
        if (!addr) { showTxValidationError(`请为 ${currencyLabels[typeId]} 选择找零地址`); return false; }
        const meta = getAddrMeta(addr);
        if (!meta) { showTxValidationError('找零地址不存在，请重新选择'); return false; }
        if (Number(meta.type || 0) !== Number(typeId)) { showTxValidationError(`${currencyLabels[typeId]} 找零地址的币种不匹配`); return false; }
        return true;
      };
      if (![0, 1, 2].every((t) => (typeBalances[t] || 0) + 1e-8 >= (vd[t] || 0))) {
        const lackType = [0, 1, 2].find((t) => (typeBalances[t] || 0) + 1e-8 < (vd[t] || 0)) ?? 0;
        showTxValidationError(`${currencyLabels[lackType]} 余额不足，无法覆盖转出与兑换需求`);
        return;
      }
      if (![0, 1, 2].every((t) => ensureChangeAddrValid(t))) return;
      const mintedGas = interestGas;
      const totalGasNeed = baseTxGas + outInterest;
      const totalGasBudget = availableGas + mintedGas;
      if (totalGasNeed > totalGasBudget + 1e-8) {
        const msg = mintedGas > 0
          ? 'Gas 不足：即使兑换额外 Gas，交易Gas 与转移Gas 仍超出钱包可用 Gas'
          : 'Gas 不足：交易Gas 与转移Gas 超出钱包可用 Gas';
        showTxValidationError(msg);
        return;
      }
      const usedTypes = [0, 1, 2].filter((t) => (vd[t] || 0) > 0);
      let finalSel = sel.slice();
      let removedAddrs = [];
      if (usedTypes.length) {
        const infos = sel.map((addr) => {
          const meta = getAddrMeta(addr) || {};
          const type = Number(meta.type || 0);
          const val = Number(meta.value && (meta.value.totalValue || meta.value.TotalValue) || 0);
          const bal = { 0: 0, 1: 0, 2: 0 };
          if (bal[type] !== undefined) bal[type] = val;

          const totalRel = usedTypes.reduce((s, t) => s + bal[t] * rates[t], 0);
          return { addr, bal, totalRel };
        });
        const candidates = infos.filter((info) => usedTypes.some((t) => info.bal[t] > 0));
        if (candidates.length) {
          candidates.sort((a, b) => b.totalRel - a.totalRel);
          const remain = {};
          usedTypes.forEach((t) => { remain[t] = vd[t] || 0; });
          const chosen = [];
          for (const info of candidates) {
            if (usedTypes.every((t) => (remain[t] || 0) <= 0)) break;
            const helps = usedTypes.some((t) => (remain[t] || 0) > 0 && info.bal[t] > 0);
            if (!helps) continue;
            chosen.push(info.addr);
            usedTypes.forEach((t) => {
              if ((remain[t] || 0) > 0 && info.bal[t] > 0) {
                remain[t] = Math.max(0, (remain[t] || 0) - info.bal[t]);
              }
            });
          }
          if (usedTypes.every((t) => (remain[t] || 0) <= 0)) {
            const chosenSet = new Set(chosen);
            const optimizedSel = sel.filter((a) => chosenSet.has(a));
            const extra = sel.filter((a) => !chosenSet.has(a));
            if (optimizedSel.length && extra.length) {
              finalSel = optimizedSel;
              removedAddrs = extra;
              Array.from(addrList.querySelectorAll('input[type="checkbox"]')).forEach((inp) => {
                const checked = finalSel.indexOf(inp.value) !== -1;
                inp.checked = checked;
                const label = inp.closest('label');
                if (label) label.classList.toggle('selected', checked);
              });
            }
          }
        }
      }
      if (removedAddrs.length) {
        const tipHtml = `检测到本次转账中有 <strong>${removedAddrs.length}</strong> 个来源地址在本次转账中未被实际使用，已自动为你保留余额更高且能够覆盖本次转账的地址集合。`;
        showModalTip('已优化来源地址', tipHtml, false);
      }
      if (extraPGC > 0) {
        const confirmed = await showConfirmModal('确认兑换 Gas', `将使用 <strong>${extraPGC}</strong> PGC 兑换 <strong>${extraPGC}</strong> Gas，用于本次交易。确认继续？`, '确认兑换', '取消');
        if (!confirmed) return;
      }
      const backAssign = {}; finalSel.forEach((a, i) => { backAssign[a] = i === 0 ? 1 : 0; });
      const valueTotal = Object.keys(vd).reduce((s, k) => s + vd[k] * rates[k], 0);
      const build = {
        Value: valueTotal,
        ValueDivision: vd,
        Bill: bills,
        UserAddress: finalSel,
        PriUseTXCer: String(useTXCer.value) === 'true',
        ChangeAddress: changeMap,
        IsPledgeTX: String(isPledge.value) === 'true',
        HowMuchPayForGas: extraPGC,
        IsCrossChainTX: isCross,
        Data: '',
        InterestAssign: { Gas: baseTxGas, Output: outInterest, BackAssign: backAssign }
      };
      if (isCross && finalSel.length !== 1) { showTxValidationError('跨链交易只能有一个来源地址'); return; }
      if (isCross && !changeMap[0]) { showTxValidationError('请为跨链交易选择主货币找零地址'); return; }
      if (txPreview) { txPreview.textContent = JSON.stringify(build, null, 2); txPreview.classList.remove('hidden'); }

      // 显示"构造交易"按钮并保存 BuildTXInfo
      const buildTxBtn = document.getElementById('buildTxBtn');
      if (buildTxBtn) {
        buildTxBtn.classList.remove('hidden');
        buildTxBtn.dataset.buildInfo = JSON.stringify(build);
      }
    });

    // 绑定"构造交易"按钮事件
    const buildTxBtn = document.getElementById('buildTxBtn');
    const txFinalPreview = document.getElementById('txFinalPreview');
    if (buildTxBtn && !buildTxBtn.dataset._buildBind) {
      buildTxBtn.addEventListener('click', async () => {
        try {
          if (txFinalPreview) {
            txFinalPreview.textContent = '正在构造交易...';
            txFinalPreview.classList.remove('hidden');
          }

          const buildInfoStr = buildTxBtn.dataset.buildInfo || '{}';
          const buildInfo = JSON.parse(buildInfoStr);
          const user = loadUser();

          if (!user || !user.accountId) {
            showModalTip('未登录', '请先登录账户', true);
            if (txFinalPreview) txFinalPreview.classList.add('hidden');
            return;
          }

          // 调用 buildNewTX 构造交易
          const transaction = await buildNewTX(buildInfo, user);

          // 显示交易结构体
          if (txFinalPreview) {
            const formatted = JSON.stringify(transaction, null, 2);
            txFinalPreview.textContent = '✓ Transaction 结构体\n\n' + formatted;
          }

          showModalTip('交易构造成功', '已成功构造 Transaction 结构体，请查看下方预览', false);
        } catch (err) {
          const errMsg = err.message || String(err);
          if (txFinalPreview) {
            txFinalPreview.textContent = '✗ 构造失败\n\n' + errMsg;
          }
          showModalTip('构造失败', errMsg, true);
        }
      });
      buildTxBtn.dataset._buildBind = '1';
    }

    window.__refreshSrcAddrList = () => {
      try {
        refreshWalletSnapshot();
        rebuildAddrList();
        fillChange();
      } catch (_) { }
    };
    tfBtn.dataset._bind = '1';
  }

  const openCreateAddrBtn = document.getElementById('openCreateAddrBtn');
  const openImportAddrBtn = document.getElementById('openImportAddrBtn');
  const addrModal = document.getElementById('addrModal');
  const addrTitle = document.getElementById('addrModalTitle');
  const addrCreateBox = document.getElementById('addrCreateBox');
  const addrImportBox = document.getElementById('addrImportBox');
  const addrCancelBtn = document.getElementById('addrCancelBtn');
  const addrOkBtn = document.getElementById('addrOkBtn');
  const setAddrError = (msg) => {
    const box = document.getElementById('addrError');
    if (!box) return;
    if (msg) {
      box.textContent = msg;
      box.classList.remove('hidden');
    } else {
      box.textContent = '';
      box.classList.add('hidden');
    }
  };
  let __addrMode = 'create';
  const showAddrModal = (mode) => {
    __addrMode = mode;
    if (addrTitle) addrTitle.textContent = mode === 'import' ? '导入地址' : '新建地址';
    if (addrCreateBox) addrCreateBox.classList.toggle('hidden', mode !== 'create');
    if (addrImportBox) addrImportBox.classList.toggle('hidden', mode !== 'import');
    if (mode === 'import') {
      const input = document.getElementById('addrPrivHex');
      if (input) input.value = '';
    }
    if (addrModal) addrModal.classList.remove('hidden');
    setAddrError('');
  };
  const hideAddrModal = () => {
    if (addrModal) addrModal.classList.add('hidden');
    setAddrError('');
  };
  if (openCreateAddrBtn) {
    openCreateAddrBtn.onclick = () => showAddrModal('create');
  }
  if (openImportAddrBtn) {
    openImportAddrBtn.onclick = () => showAddrModal('import');
  }
  if (addrCancelBtn) {
    addrCancelBtn.onclick = hideAddrModal;
  }
  const importAddressInPlace = async (priv) => {
    const u2 = loadUser();
    if (!u2 || !u2.accountId) { showModalTip('未登录', '请先登录或注册账户', true); return; }
    const ov = document.getElementById('actionOverlay');
    const ovt = document.getElementById('actionOverlayText');
    if (ovt) ovt.textContent = '正在导入钱包地址...';
    if (ov) ov.classList.remove('hidden');
    try {
      const data = await importFromPrivHex(priv);
      const acc = toAccount({ accountId: u2.accountId, address: u2.address }, u2);
      const addr = (data.address || '').toLowerCase();
      if (!addr) { showModalTip('导入失败', '无法解析地址', true); return; }
      const map = (acc.wallet && acc.wallet.addressMsg) || {};
      let dup = false;
      const lowerMain = (u2.address || '').toLowerCase();
      if (lowerMain && lowerMain === addr) dup = true;
      if (!dup) {
        for (const k in map) { if (Object.prototype.hasOwnProperty.call(map, k)) { if (String(k).toLowerCase() === addr) { dup = true; break; } } }
      }
      if (dup) { showModalTip('导入失败', '该地址已存在，不能重复导入', true); return; }
      acc.wallet.addressMsg[addr] = acc.wallet.addressMsg[addr] || { type: 0, utxos: {}, txCers: {}, value: { totalValue: 0, utxoValue: 0, txCerValue: 0 }, estInterest: 0, origin: 'imported' };
      const normPriv = (data.privHex || priv).replace(/^0x/i, '');
      acc.wallet.addressMsg[addr].privHex = normPriv;
      acc.wallet.addressMsg[addr].pubXHex = data.pubXHex || acc.wallet.addressMsg[addr].pubXHex || '';
      acc.wallet.addressMsg[addr].pubYHex = data.pubYHex || acc.wallet.addressMsg[addr].pubYHex || '';
      saveUser(acc);
      if (window.__refreshSrcAddrList) { try { window.__refreshSrcAddrList(); } catch (_) { } }
      renderWallet();
      try { updateWalletBrief(); } catch { }
      const { modal, titleEl: title, textEl: text, okEl: ok } = getActionModalElements();
      if (title) title.textContent = '导入钱包成功';
      if (text) { text.textContent = '已导入一个钱包地址'; text.classList.remove('tip--error'); }
      if (modal) modal.classList.remove('hidden');
      if (ok) {
        const handler = () => {
          modal && modal.classList.add('hidden');
          ok.removeEventListener('click', handler);
        };
        ok.addEventListener('click', handler);
      }
    } catch (err) {
      showModalTip('导入失败', '导入失败：' + (err && err.message ? err.message : err), true);
    } finally {
      if (ov) ov.classList.add('hidden');
    }
  };
  if (addrOkBtn) {
    addrOkBtn.onclick = async () => {
      if (__addrMode === 'create') { hideAddrModal(); addNewSubWallet(); }
      else {
        const input = document.getElementById('addrPrivHex');
        const v = input ? input.value.trim() : '';
        if (!v) {
          setAddrError('请输入私钥 Hex');
          if (input) input.focus();
          return;
        }
        const normalized = v.replace(/^0x/i, '');
        if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
          setAddrError('私钥格式不正确：需为 64 位十六进制字符串');
          if (input) input.focus();
          return;
        }
        setAddrError('');
        hideAddrModal();
        await importAddressInPlace(v);
      }
    };
  }
}
// 不加入担保组织确认模态框
const confirmSkipModal = document.getElementById('confirmSkipModal');
const confirmSkipOk = document.getElementById('confirmSkipOk');
const confirmSkipCancel = document.getElementById('confirmSkipCancel');
if (confirmSkipOk) {
  confirmSkipOk.addEventListener('click', () => {
    try { localStorage.setItem('guarChoice', JSON.stringify({ type: 'none' })); } catch { }
    if (confirmSkipModal) confirmSkipModal.classList.add('hidden');
    routeTo('#/main');
  });
}
if (confirmSkipCancel) {
  confirmSkipCancel.addEventListener('click', () => {
    if (confirmSkipModal) confirmSkipModal.classList.add('hidden');
  });
}

// 以上模态框事件已绑定

// （已移除）左侧加长逻辑

// 移除左侧高度同步逻辑
function computeCurrentOrgId() {
  try {
    const raw = localStorage.getItem('guarChoice');
    if (raw) {
      const c = JSON.parse(raw);
      if (c && c.groupID) return String(c.groupID);
    }
  } catch { }
  const u = loadUser();
  if (u && u.guarGroup && u.guarGroup.groupID) return String(u.guarGroup.groupID);
  if (u && u.orgNumber) return String(u.orgNumber);
  return '';
}

async function updateOrgDisplay() {
  const el = document.getElementById('menuOrg');
  if (!el) return;
  el.classList.add('code-loading');
  el.textContent = '同步中...';
  await wait(150);
  const gid = computeCurrentOrgId();
  el.textContent = gid || '暂未加入担保组织';
  el.classList.remove('code-loading');
}

window.addEventListener('storage', (e) => {
  if (e.key === 'guarChoice' || e.key === STORAGE_KEY) updateOrgDisplay();
});

function refreshOrgPanel() {
  const woCard = document.getElementById('woCard');
  const woEmpty = document.getElementById('woEmpty');
  const woExit = document.getElementById('woExitBtn');
  const joinBtn = document.getElementById('woJoinBtn');
  const g = getJoinedGroup();
  const joined = !!(g && g.groupID);
  if (woCard) woCard.classList.toggle('hidden', !joined);
  if (woExit) woExit.classList.toggle('hidden', !joined);
  if (woEmpty) woEmpty.classList.toggle('hidden', joined);
  if (joinBtn) joinBtn.classList.toggle('hidden', joined);
  const tfMode = document.getElementById('tfMode');
  const tfModeQuick = document.getElementById('tfModeQuick');
  const tfModeCross = document.getElementById('tfModeCross');
  const tfModePledge = document.getElementById('tfModePledge');
  const isPledgeSel = document.getElementById('isPledge');
  const hasOrg = joined;
  if (tfModeQuick && tfModeQuick.parentNode) {
    const quickLabel = tfModeQuick.parentNode;
    const last = quickLabel.lastChild;
    if (last && last.nodeType === 3) {
      last.textContent = hasOrg ? ' 快速转账' : ' 普通交易';
    }
  }
  if (tfMode && tfModeQuick) {
    if (!hasOrg) {
      if (tfModeCross) {
        tfModeCross.checked = false;
        tfModeCross.disabled = true;
        const l = tfModeCross.parentNode;
        if (l && l.style) l.style.display = 'none';
      }
      if (tfModePledge) {
        tfModePledge.checked = false;
        tfModePledge.disabled = true;
        const l2 = tfModePledge.parentNode;
        if (l2 && l2.style) l2.style.display = 'none';
      }
      tfMode.value = 'quick';
      tfModeQuick.checked = true;
      if (isPledgeSel) isPledgeSel.value = 'false';
    } else {
      if (tfModeCross) {
        tfModeCross.disabled = false;
        const l = tfModeCross.parentNode;
        if (l && l.style) l.style.display = '';
      }
      if (tfModePledge) {
        tfModePledge.disabled = false;
        const l2 = tfModePledge.parentNode;
        if (l2 && l2.style) l2.style.display = '';
      }
      if (!tfMode.value) tfMode.value = 'quick';
      if (tfMode.value === 'cross' && (!tfModeCross || tfModeCross.disabled)) tfMode.value = 'quick';
      if (tfMode.value === 'pledge' && (!tfModePledge || tfModePledge.disabled)) tfMode.value = 'quick';
      if (tfMode.value === 'quick') tfModeQuick.checked = true;
      if (isPledgeSel) isPledgeSel.value = tfMode.value === 'pledge' ? 'true' : 'false';
    }
    [['woGroupID', joined ? g.groupID : ''],
    ['woAggre', joined ? (g.aggreNode || '') : ''],
    ['woAssign', joined ? (g.assignNode || '') : ''],
    ['woPledge', joined ? (g.pledgeAddress || '') : '']]
      .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
  }
}

// ==================== BuildNewTX 相关函数 ====================


// 汇率转换函数
function exchangeRate(moneyType) {
  const rates = { 0: 1, 1: 1000000, 2: 1000 };
  return rates[moneyType] || 1;
}

// ECDSA 签名函数：使用私钥签名哈希值
async function ecdsaSignHash(privateKeyHex, hashBytes) {
  try {
    // 1. 从 Hex 导入私钥
    const privBytes = hexToBytes(privateKeyHex);

    // 2. 构造 JWK 格式的私钥 (需要公钥坐标，这里简化处理)
    // 实际应该从私钥推导公钥，这里暂时使用简化方案
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      d: bytesToBase64url(privBytes),
      ext: true
    };

    // 3. 导入私钥
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    // 4. 签名
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      hashBytes
    );

    // 5. 解析签名为 r, s
    const { r, s } = parseECDSASignature(new Uint8Array(signature));

    return { R: r, S: s };
  } catch (err) {
    console.error('ECDSA 签名失败:', err);
    throw new Error('ECDSA signature failed: ' + err.message);
  }
}

// 解析 ECDSA 签名
function parseECDSASignature(signature) {
  // WebCrypto 返回的是 IEEE P1363 格式 (r || s)，每个32字节
  if (signature.length === 64) {
    const r = signature.slice(0, 32);
    const s = signature.slice(32, 64);
    return {
      r: bytesToHex(r),
      s: bytesToHex(s)
    };
  }

  // 降级：假设是 raw format
  const half = Math.floor(signature.length / 2);
  return {
    r: bytesToHex(signature.slice(0, half)),
    s: bytesToHex(signature.slice(half))
  };
}

// 计算 TXOutput 的哈希
async function getTXOutputHash(output) {
  try {
    const serialized = JSON.stringify(output);
    const encoder = new TextEncoder();
    const data = encoder.encode(serialized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  } catch (err) {
    console.error('TXOutput 哈希计算失败:', err);
    throw new Error('Failed to calculate TXOutput hash: ' + err.message);
  }
}

// 计算交易 TXID
async function getTXID(tx) {
  try {
    const txCopy = JSON.parse(JSON.stringify(tx));
    delete txCopy.UserSignature;
    delete txCopy.TXID;

    const serialized = JSON.stringify(txCopy);
    const encoder = new TextEncoder();
    const data = encoder.encode(serialized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    return bytesToHex(new Uint8Array(hashBuffer));
  } catch (err) {
    console.error('TXID 计算失败:', err);
    throw new Error('Failed to calculate TXID: ' + err.message);
  }
}

// 计算交易 Size
function getTXSize(tx) {
  try {
    const serialized = JSON.stringify(tx);
    return new TextEncoder().encode(serialized).length;
  } catch (err) {
    console.error('交易 Size 计算失败:', err);
    return 0;
  }
}

// 计算交易的用户签名
async function getTXUserSignature(tx, privateKeyHex) {
  try {
    const txCopy = JSON.parse(JSON.stringify(tx));
    delete txCopy.UserSignature;

    const serialized = JSON.stringify(txCopy);
    const encoder = new TextEncoder();
    const data = encoder.encode(serialized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashBytes = new Uint8Array(hashBuffer);

    const signature = await ecdsaSignHash(privateKeyHex, hashBytes);

    return signature;
  } catch (err) {
    console.error('用户签名失败:', err);
    throw new Error('Failed to generate user signature: ' + err.message);
  }
}

// ==================== BuildNewTX 核心函数 ====================

async function buildNewTX(buildTXInfo, userAccount) {
  try {
    const wallet = userAccount.wallet || {};
    const addressMsg = wallet.addressMsg || {};
    const guarGroup = userAccount.guarGroup || userAccount.orgNumber || '';

    // 计算选中地址的各币种总金额
    const totalMoney = { 0: 0, 1: 0, 2: 0 };
    for (const address of buildTXInfo.UserAddress) {
      const addrData = addressMsg[address];
      if (!addrData) {
        throw new Error(`Address ${address} not found in wallet`);
      }
      const type = Number(addrData.type || 0);
      const balance = Number(addrData.value?.totalValue || addrData.value?.TotalValue || 0);
      totalMoney[type] += balance;
    }

    // 参数验证
    if (buildTXInfo.IsCrossChainTX || buildTXInfo.IsPledgeTX) {
      if (Object.keys(buildTXInfo.Bill).length !== 1) {
        throw new Error('cross-chain transactions can only transfer to one address');
      }

      for (const bill of Object.values(buildTXInfo.Bill)) {
        if (bill.MoneyType !== 0) {
          throw new Error('cross-chain transactions can only use the main currency');
        }
      }

      for (const address of buildTXInfo.UserAddress) {
        const addrData = addressMsg[address];
        if (Number(addrData.type || 0) !== 0) {
          throw new Error('cross-chain transactions can only use the main currency');
        }
      }

      if (Object.keys(buildTXInfo.ChangeAddress).length !== 1 || !buildTXInfo.ChangeAddress[0]) {
        throw new Error('cross-chain transactions can only have one change address');
      }
    }

    if (buildTXInfo.IsCrossChainTX) {
      if (!guarGroup) {
        throw new Error('cross-chain transactions must join the guarantor group');
      }
      if (buildTXInfo.UserAddress.length !== 1) {
        throw new Error('cross-chain transactions can only have one input address');
      }
    }

    // 检查找零地址
    for (const [typeIdStr, changeAddr] of Object.entries(buildTXInfo.ChangeAddress)) {
      const typeId = Number(typeIdStr);
      const addrData = addressMsg[changeAddr];
      if (!addrData || Number(addrData.type || 0) !== typeId) {
        throw new Error('the change address is incorrect');
      }
    }

    // 检查余额
    for (const [typeIdStr, needed] of Object.entries(buildTXInfo.ValueDivision)) {
      const typeId = Number(typeIdStr);
      if (needed > totalMoney[typeId]) {
        throw new Error('insufficient account balance');
      }
    }

    // 检查账单金额
    const usedMoney = { 0: 0, 1: 0, 2: 0 };
    for (const bill of Object.values(buildTXInfo.Bill)) {
      usedMoney[bill.MoneyType] += bill.Value;
    }
    if (buildTXInfo.HowMuchPayForGas > 0) {
      usedMoney[0] += buildTXInfo.HowMuchPayForGas;
    }

    for (const [typeIdStr, used] of Object.entries(usedMoney)) {
      const typeId = Number(typeIdStr);
      const needed = buildTXInfo.ValueDivision[typeId] || 0;
      if (Math.abs(used - needed) > 1e-8) {
        throw new Error('the bill is incorrect');
      }
    }

    // 构造 Transaction
    const tx = {
      Version: 0.1,
      TXID: '',
      Size: 0,
      TXType: 0,
      Value: 0.0,
      ValueDivision: buildTXInfo.ValueDivision,
      GuarantorGroup: guarGroup,
      TXInputsNormal: [],
      TXInputsCertificate: [],
      TXOutputs: [],
      InterestAssign: buildTXInfo.InterestAssign,
      UserSignature: { R: null, S: null },
      Data: buildTXInfo.Data || ''
    };

    // 构造 Outputs - 转账输出
    for (const [address, bill] of Object.entries(buildTXInfo.Bill)) {
      const output = {
        ToAddress: address,
        ToValue: bill.Value,
        Type: bill.MoneyType,
        ToGuarGroupID: bill.GuarGroupID || '',
        ToPublicKey: bill.PublicKey || { Curve: 'P256', XHex: '', YHex: '' },
        ToInterest: bill.ToInterest || 0,
        IsGuarMake: false,
        IsCrossChain: buildTXInfo.IsCrossChainTX || false,
        IsPayForGas: false
      };
      tx.TXOutputs.push(output);
    }

    // Gas 支付输出
    if (buildTXInfo.HowMuchPayForGas > 0) {
      tx.TXOutputs.push({
        ToAddress: '',
        ToValue: buildTXInfo.HowMuchPayForGas,
        Type: 0,
        ToGuarGroupID: '',
        ToPublicKey: { Curve: '', XHex: '', YHex: '' },
        ToInterest: 0,
        IsGuarMake: false,
        IsCrossChain: false,
        IsPayForGas: true
      });
    }

    // 构造 Inputs (选择 UTXO)
    const usedWallet = {};

    for (const [typeIdStr, targetValue] of Object.entries(buildTXInfo.ValueDivision)) {
      const typeId = Number(typeIdStr);
      if (targetValue <= 0) continue;

      let typeValueCount = 0;
      let isUTXOEnough = false;

      for (const address of buildTXInfo.UserAddress) {
        const addrData = addressMsg[address];
        if (!addrData || Number(addrData.type || 0) !== typeId) continue;

        if (!usedWallet[address]) {
          usedWallet[address] = {
            type: addrData.type,
            UTXO: {},
            TXCers: {}
          };
        }

        // 遍历 UTXO
        const utxos = addrData.utxo || addrData.UTXO || {};
        for (const [utxoId, utxoData] of Object.entries(utxos)) {
          const input = {
            FromTXID: utxoData.utxo?.TXID || utxoData.TXID || '',
            FromTxPosition: utxoData.position || { IndexZ: 0 },
            FromAddress: address,
            IsGuarMake: false,
            TXOutputHash: [],
            InputSignature: { R: '', S: '' }
          };

          // 计算并签名 UTXO output hash
          try {
            const utxoTx = utxoData.utxo || utxoData.UTXO || {};
            const outputs = utxoTx.TXOutputs || [];
            const posIdx = input.FromTxPosition.IndexZ || 0;

            if (outputs[posIdx]) {
              const hashBytes = await getTXOutputHash(outputs[posIdx]);
              input.TXOutputHash = Array.from(hashBytes);

              const privKeyHex = addrData.privHex || addrData.wPrivateKey || '';
              if (privKeyHex) {
                const sig = await ecdsaSignHash(privKeyHex, hashBytes);
                input.InputSignature = { R: sig.R, S: sig.S };
              }
            }
          } catch (err) {
            console.warn(`Failed to sign UTXO ${utxoId}:`, err);
          }

          tx.TXInputsNormal.push(input);

          const utxoValue = Number(utxoData.value || 0);
          typeValueCount += utxoValue;
          usedWallet[address].UTXO[utxoId] = utxoData;

          if (typeValueCount >= targetValue) {
            isUTXOEnough = true;

            // 生成找零输出
            if (typeValueCount > targetValue) {
              const changeAddr = buildTXInfo.ChangeAddress[typeId];
              const changeAddrData = addressMsg[changeAddr];

              const changeOutput = {
                ToAddress: changeAddr,
                ToValue: typeValueCount - targetValue,
                Type: typeId,
                ToGuarGroupID: guarGroup,
                ToPublicKey: {
                  Curve: 'P256',
                  XHex: changeAddrData?.pubXHex || '',
                  YHex: changeAddrData?.pubYHex || ''
                },
                ToInterest: 0,
                IsGuarMake: false,
                IsCrossChain: false,
                IsPayForGas: false
              };
              tx.TXOutputs.push(changeOutput);
            }
            break;
          }
        }

        if (isUTXOEnough) break;
      }

      if (!isUTXOEnough) {
        throw new Error('insufficient account balance for type ' + typeId);
      }
    }

    // 设置交易类型
    if (buildTXInfo.IsPledgeTX) {
      tx.TXType = -1;
    } else if (buildTXInfo.IsCrossChainTX) {
      tx.TXType = 6;
    } else if (!guarGroup) {
      tx.TXType = 8;
    } else {
      tx.TXType = 0;
    }

    // 计算交易总金额
    let totalValue = 0;
    for (const [typeStr, val] of Object.entries(buildTXInfo.ValueDivision)) {
      totalValue += val * exchangeRate(Number(typeStr));
    }
    tx.Value = totalValue;

    // 计算 TXID 和 Size
    tx.TXID = await getTXID(tx);
    tx.Size = getTXSize(tx);

    // 交易签名
    if (tx.TXInputsNormal.length > 0) {
      const firstInputAddr = tx.TXInputsNormal[0].FromAddress;
      const addrData = addressMsg[firstInputAddr];
      const privKeyHex = addrData?.privHex || addrData?.wPrivateKey || '';

      if (privKeyHex) {
        tx.UserSignature = await getTXUserSignature(tx, privKeyHex);
      }
    }

    return tx;
  } catch (err) {
    console.error('BuildNewTX failed:', err);
    throw err;
  }
}
