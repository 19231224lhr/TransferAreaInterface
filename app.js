// 前端实现 NewUser 逻辑：
// - 生成 ECDSA P-256 密钥对（WebCrypto）
// - 使用私钥 d 作为输入生成 8 位用户 ID（CRC32 结果映射）
// - 使用未压缩公钥(0x04 || X || Y)的 SHA-256 前 20 字节生成地址

try { window.addEventListener('error', function(e){ var m = String((e&&e.message)||''); var f = String((e&&e.filename)||''); if (m.indexOf('Cannot redefine property: ethereum')!==-1 || f.indexOf('evmAsk.js')!==-1) { if (e.preventDefault) e.preventDefault(); return true; } }, true); } catch(_){}
try { window.addEventListener('unhandledrejection', function(){}, true); } catch(_){}

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
const GROUP_LIST = [ DEFAULT_GROUP ];

const BASE_LIFT = 20;

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
  if (basic.wallet && basic.wallet.addressMsg) {
    acc.wallet.addressMsg = { ...basic.wallet.addressMsg };
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
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(acc)); } catch {}
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
        const v = (m && m.value && typeof m.value.totalValue === 'number') ? m.value.totalValue : 0;
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(acc));
    updateHeaderUser(acc);
    updateOrgDisplay();
  } catch (e) {
    console.warn('保存本地用户信息失败', e);
  }
}
function showModalTip(title, html, isError) {
  const modal = document.getElementById('actionModal');
  const titleEl = document.getElementById('actionTitle');
  const textEl = document.getElementById('actionText');
  const okEl = document.getElementById('actionOkBtn');
  if (titleEl) titleEl.textContent = title || '';
  if (textEl) {
    if (isError) textEl.classList.add('tip--error'); else textEl.classList.remove('tip--error');
    textEl.innerHTML = html || '';
  }
  if (modal) modal.classList.remove('hidden');
  const handler = () => { modal.classList.add('hidden'); okEl && okEl.removeEventListener('click', handler); };
  okEl && okEl.addEventListener('click', handler);
}
function clearAccountStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  try { localStorage.removeItem('walletUser'); } catch {}
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
  } catch {}
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
      } catch (_) {}
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
      break;
    case '/new':
      showCard(newUserCard);
      // 如果尚未生成，则自动生成一次
      const resultEl = document.getElementById('result');
      if (resultEl && resultEl.classList.contains('hidden')) {
        handleCreate().catch(() => {});
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
        const modalE = document.getElementById('actionModal');
        const textE = document.getElementById('actionText');
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
      } catch (_) {}
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
    try { history.pushState(state, '', location.href); } catch {}
    const modal = document.getElementById('confirmExitModal');
    const okBtn = document.getElementById('confirmExitOk');
    const cancelBtn = document.getElementById('confirmExitCancel');
    if (modal && okBtn && cancelBtn) {
      modal.classList.remove('hidden');
      const okHandler = () => {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
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
    try { renderWallet(); } catch {}
    try {
      updateWalletBrief();
      requestAnimationFrame(() => updateWalletBrief());
      setTimeout(() => updateWalletBrief(), 0);
    } catch {}
    const modal = document.getElementById('actionModal');
    const title = document.getElementById('actionTitle');
    const text = document.getElementById('actionText');
    const ok = document.getElementById('actionOkBtn');
    if (title) title.textContent = '新增钱包成功';
    if (text) text.textContent = '已新增一个钱包地址';
    if (modal) modal.classList.remove('hidden');
    const handler = () => { modal.classList.add('hidden'); try { renderWallet(); updateWalletBrief(); } catch {} ok && ok.removeEventListener('click', handler); };
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
      routeTo('#/join-group');
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
    try { localStorage.setItem('guarChoice', JSON.stringify({ type: 'join', groupID: g.groupID, aggreNode: g.aggreNode, assignNode: g.assignNode, pledgeAddress: g.pledgeAddress })); } catch {}
    updateOrgDisplay();
    routeTo('#/main');
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
    try { localStorage.setItem('guarChoice', JSON.stringify({ type: 'join', groupID: g.groupID, aggreNode: g.aggreNode, assignNode: g.assignNode, pledgeAddress: g.pledgeAddress })); } catch {}
    updateOrgDisplay();
    routeTo('#/main');
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
          const modalE = document.getElementById('actionModal');
          const titleE = document.getElementById('actionTitle');
          const textE = document.getElementById('actionText');
          const okE = document.getElementById('actionOkBtn');
          if (titleE) titleE.textContent = '导入失败';
          if (textE) textE.textContent = '无法解析地址';
          if (textE) textE.classList.add('tip--error');
          if (modalE) modalE.classList.remove('hidden');
          const handlerE = () => { modalE.classList.add('hidden'); okE.removeEventListener('click', handlerE); };
          if (okE) okE.addEventListener('click', handlerE);
          return;
        }
        const exists = (acc.wallet && acc.wallet.addressMsg && acc.wallet.addressMsg[addr]) || (u2.address && String(u2.address).toLowerCase() === addr);
        if (exists) {
          const modalE = document.getElementById('actionModal');
          const titleE = document.getElementById('actionTitle');
          const textE = document.getElementById('actionText');
          const okE = document.getElementById('actionOkBtn');
          if (titleE) titleE.textContent = '导入失败';
          if (textE) textE.textContent = '该公钥地址已存在，不能重复导入';
          if (textE) textE.classList.add('tip--error');
          if (modalE) modalE.classList.remove('hidden');
          const handlerE = () => { modalE.classList.add('hidden'); okE.removeEventListener('click', handlerE); };
          if (okE) okE.addEventListener('click', handlerE);
          return;
        }
        if (addr) acc.wallet.addressMsg[addr] = acc.wallet.addressMsg[addr] || { type: 0, utxos: {}, txCers: {}, value: { totalValue: 0, utxoValue: 0, txCerValue: 0 }, estInterest: 0, origin: 'imported', privHex: (data.privHex || normalized) };
        saveUser(acc);
        updateWalletBrief();
        const modal = document.getElementById('actionModal');
        const title = document.getElementById('actionTitle');
        const text = document.getElementById('actionText');
        const ok = document.getElementById('actionOkBtn');
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
  registerAccountBtn.addEventListener('click', () => routeTo('#/new'));
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
      resultEl.classList.remove('hidden');
      resultEl.classList.remove('fade-in');
      resultEl.classList.remove('reveal');
      requestAnimationFrame(() => resultEl.classList.add('reveal'));
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
      saveUser(u);
    }
    const brief = document.getElementById('walletBriefList');
    const toggleBtn = document.getElementById('briefToggleBtn');
  if (brief) { brief.classList.add('hidden'); brief.innerHTML = ''; }
  if (toggleBtn) toggleBtn.classList.add('hidden');
    routeTo('#/join-group');
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
      item.className = 'addr-item';
      const meta = (u.wallet && u.wallet.addressMsg && u.wallet.addressMsg[a]) || null;
      const isZero = !!(meta && meta.origin === 'created');
      const zeroArr = Array.from({ length: 40 }, () => 0);
      const ptsPGC = isZero ? zeroArr : pointsBase.map(v => v + Math.round((Math.random() - 0.5) * 6));
      const ptsBTC = isZero ? zeroArr : Array.from({ length: 40 }, (_, i) => Math.round(55 + 22 * Math.cos(i / 3.2) + Math.random() * 7));
      const ptsETH = isZero ? zeroArr : Array.from({ length: 40 }, (_, i) => Math.round(50 + 18 * Math.sin(i / 3.8 + 0.6) + Math.random() * 6));
      item.innerHTML = `
        <div class=\"addr-meta\">
          <code class=\"break\">${a}</code>
          <div class=\"tags\">
            <span class=\"tag\">PGC: 0</span>
            <span class=\"tag\">BTC: 0</span>
            <span class=\"tag\">ETH: 0</span>
          </div>
        </div>
        <div class=\"addr-chart\"></div>
      `;
      item.addEventListener('click', () => {
        const opening = !item.classList.contains('open');
        item.classList.toggle('open');
        const svg = item.querySelector('svg');
        const p = item.querySelector('path.line');
        if (!svg || !p) return;
        const L2 = p.getTotalLength();
        if (opening) { p.style.strokeDasharray = L2; p.style.strokeDashoffset = L2; requestAnimationFrame(() => { p.style.strokeDashoffset = 0; }); } else { p.style.strokeDasharray = L2; p.style.strokeDashoffset = L2; }
      });
      list.appendChild(item);
      const metaEl = item.querySelector('.addr-meta');
      if (metaEl) {
        const ops = document.createElement('div');
        ops.className = 'addr-ops';
        const toggle = document.createElement('button');
        toggle.className = 'ops-toggle';
        toggle.textContent = '▾';
        const menu = document.createElement('div');
        menu.className = 'ops-menu hidden';
        const delBtn = document.createElement('button');
        delBtn.className = 'btn danger btn--sm';
        delBtn.textContent = '删除地址';
        const expBtn = document.createElement('button');
        expBtn.className = 'btn secondary btn--sm';
        expBtn.textContent = '导出私钥';
        menu.appendChild(delBtn);
        menu.appendChild(expBtn);
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
            renderWallet();
            updateWalletBrief();
            const ok1 = document.getElementById('actionOkBtn');
            const am = document.getElementById('actionModal');
            const at = document.getElementById('actionTitle');
            const ax = document.getElementById('actionText');
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
          const modal = document.getElementById('actionModal');
          const title = document.getElementById('actionTitle');
          const text = document.getElementById('actionText');
          const ok = document.getElementById('actionOkBtn');
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
      const tagSpans = item.querySelectorAll('.tags .tag');
      if (tagSpans[0]) tagSpans[0].classList.add('tag--pgc');
      if (tagSpans[1]) tagSpans[1].classList.add('tag--btc');
      if (tagSpans[2]) tagSpans[2].classList.add('tag--eth');
      const chartEl = item.querySelector('.addr-chart');
      chartEl.__pts = ptsPGC;
      chartEl.__label = 'PGC';
      const toY = (v) => Math.max(0, 160 - v - BASE_LIFT);
      const path = ptsPGC.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * 8} ${toY(y)}`).join(' ');
      chartEl.innerHTML = `
        <svg viewBox=\"0 0 320 160\">
          <line class=\"axis\" x1=\"160\" y1=\"0\" x2=\"160\" y2=\"160\" />
          <path class=\"line\" d=\"${path}\" />
          <line class=\"cursor\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"160\" style=\"opacity:.0\" />
          <circle class=\"dot\" cx=\"0\" cy=\"0\" style=\"opacity:.0\" />
        </svg>
        <div class=\"tooltip\">PGC 0 · 00:00</div>
      `;
      const svg = chartEl.querySelector('svg');
      const p = chartEl.querySelector('path.line');
      const cursor = chartEl.querySelector('line.cursor');
      const dot = chartEl.querySelector('circle.dot');
      const tipEl = chartEl.querySelector('.tooltip');
      const L = p.getTotalLength();
      p.style.strokeDasharray = L;
      p.style.strokeDashoffset = L;
      requestAnimationFrame(() => { p.style.strokeDashoffset = 0; });
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
      const updateTipInstant = (ptsArr, label) => {
        const lastIdx = ptsArr.length - 1;
        const yv = ptsArr[lastIdx];
        const tip = chartEl.querySelector('.tooltip');
        if (tip) tip.textContent = `${label} ${yv} · ${formatTime(lastIdx, ptsArr.length)}`;
      };
      updateTipInstant(chartEl.__pts || ptsPGC, 'PGC');
      svg.addEventListener('mousemove', (e) => {
        const rect = svg.getBoundingClientRect();
        const x = Math.max(0, Math.min(320, e.clientX - rect.left));
        const curPts = chartEl.__pts || ptsPGC;
        const idx2 = Math.max(0, Math.min(curPts.length - 1, Math.round(x / 8)));
        const yv = curPts[idx2];
        cursor.setAttribute('x1', String(x));
        cursor.setAttribute('x2', String(x));
        cursor.style.opacity = .9;
        const cy = Math.max(0, 160 - yv - BASE_LIFT);
        dot.setAttribute('cx', String(x));
        dot.setAttribute('cy', String(cy));
        dot.style.opacity = 1;
        const label = chartEl.__label || 'PGC';
        if (tipEl) tipEl.textContent = `${label} ${yv} · ${formatTime(idx2, curPts.length)}`;
      });
      svg.addEventListener('mouseleave', () => { cursor.style.opacity = 0; dot.style.opacity = 0; });

      const tagEls = item.querySelectorAll('.tags .tag');
      const colorBy = (k) => k === 'BTC' ? '#f59e0b' : (k === 'ETH' ? '#6366f1' : '#22d3ee');
      const setActive = (k) => {
        tagEls.forEach(el => el.classList.remove('tag--active'));
        if (k === 'PGC' && tagEls[0]) tagEls[0].classList.add('tag--active');
        if (k === 'BTC' && tagEls[1]) tagEls[1].classList.add('tag--active');
        if (k === 'ETH' && tagEls[2]) tagEls[2].classList.add('tag--active');
      };
      const applyPts = (ptsArr, label) => {
        chartEl.__pts = ptsArr;
        chartEl.__label = label;
        const d = ptsArr.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * 8} ${toY(y)}`).join(' ');
        p.setAttribute('d', d);
        const L3 = p.getTotalLength();
        p.style.strokeDasharray = L3;
        p.style.strokeDashoffset = L3;
        requestAnimationFrame(() => { p.style.strokeDashoffset = 0; });
        setActive(label);
        p.style.stroke = colorBy(label);
        updateTipInstant(ptsArr, label);
        cursor.style.opacity = 0; dot.style.opacity = 0;
      };
      setActive('PGC');
      const ensureOpen = () => {
        if (!item.classList.contains('open')) {
          item.classList.add('open');
          const L2 = p.getTotalLength();
          p.style.strokeDasharray = L2;
          p.style.strokeDashoffset = L2;
          requestAnimationFrame(() => { p.style.strokeDashoffset = 0; });
        }
      };
      if (tagEls[0]) tagEls[0].addEventListener('click', (e) => { e.stopPropagation(); ensureOpen(); applyPts(ptsPGC, 'PGC'); });
      if (tagEls[1]) tagEls[1].addEventListener('click', (e) => { e.stopPropagation(); ensureOpen(); applyPts(ptsBTC, 'BTC'); });
      if (tagEls[2]) tagEls[2].addEventListener('click', (e) => { e.stopPropagation(); ensureOpen(); applyPts(ptsETH, 'ETH'); });
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
    woExit.addEventListener('click', () => {
      const u3 = loadUser();
      if (!u3 || !u3.accountId) { showModalTip('未登录', '请先登录或注册账户', true); return; }
      const modal = document.getElementById('actionModal');
      const titleEl = document.getElementById('actionTitle');
      const textEl = document.getElementById('actionText');
      const okEl = document.getElementById('actionOkBtn');
      const doExit = () => {
        const latest = loadUser();
        if (!latest) return;
        try { localStorage.removeItem('guarChoice'); } catch {}
        latest.guarGroup = null;
        latest.orgNumber = '';
        saveUser(latest);
        updateWalletBrief();
        showModalTip('已退出担保组织', '当前账户已退出担保组织，可稍后重新加入。', false);
      };
      const confirmExit = async () => {
        okEl && okEl.removeEventListener('click', confirmExit);
        if (modal) modal.classList.add('hidden');
        const ov = document.getElementById('actionOverlay');
        const ovt = document.getElementById('actionOverlayText');
        if (ovt) ovt.textContent = '正在退出担保组织...';
        if (ov) ov.classList.remove('hidden');
        await wait(2000);
        if (ov) ov.classList.add('hidden');
        doExit();
        refreshOrgPanel();
        updateOrgDisplay();
      };
      if (titleEl) titleEl.textContent = '退出担保组织';
      if (textEl) {
        textEl.innerHTML = '退出后将清空本地担保组织信息，账户将视为未加入状态。确定要继续吗？';
        textEl.classList.add('tip--error');
      }
      if (modal) modal.classList.remove('hidden');
      if (okEl) {
        okEl.addEventListener('click', confirmExit);
      }
    });
    woExit.dataset._bind = '1';
  }
  if (joinBtn && !joinBtn.dataset._bind) {
    joinBtn.addEventListener('click', () => {
      routeTo('#/join-group');
    });
    joinBtn.dataset._bind = '1';
  }
  const totalEl = document.getElementById('walletTotalChart');
  if (totalEl) {
    const ptsTpgc = Array.from({ length: 40 }, (_, i) => Math.round(70 + 20 * Math.sin(i / 3.8) + Math.random() * 6));
    const ptsTbtc = Array.from({ length: 40 }, (_, i) => Math.round(65 + 18 * Math.cos(i / 3.2) + Math.random() * 6));
    const ptsTeth = Array.from({ length: 40 }, (_, i) => Math.round(68 + 16 * Math.sin(i / 3.5 + 0.5) + Math.random() * 5));
    const toYt = (v) => Math.max(0, 160 - v - BASE_LIFT);
    const pathT = ptsTpgc.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * 8} ${toYt(y)}`).join(' ');
    totalEl.innerHTML = `
      <svg viewBox=\"0 0 320 160\">
        <line class=\"axis\" x1=\"160\" y1=\"0\" x2=\"160\" y2=\"160\" />
        <path class=\"line\" d=\"${pathT}\" />
        <line class=\"cursor\" x1=\"160\" y1=\"0\" x2=\"160\" y2=\"160\" style=\"opacity:.35\" />
        <circle class=\"dot\" cx=\"160\" cy=\"${toYt(ptsTpgc[Math.max(0, Math.min(ptsTpgc.length - 1, Math.round(160/8)))])}\" style=\"opacity:.0\" />
      </svg>
      <div class=\"tooltip\">PGC 0 · 00:00</div>
    `;
    const svgT = totalEl.querySelector('svg');
    const pT = totalEl.querySelector('path.line');
    const cursorT = totalEl.querySelector('line.cursor');
    const dotT = totalEl.querySelector('circle.dot');
    totalEl.__pts = ptsTpgc;
    totalEl.__label = 'PGC';
    const tipT = totalEl.querySelector('.tooltip');
    const LT = pT.getTotalLength();
    pT.style.strokeDasharray = LT;
    pT.style.strokeDashoffset = LT;
    requestAnimationFrame(() => { pT.style.strokeDashoffset = 0; });
    const updateTotalTip = (ptsArr, label) => {
      const lastIdx = ptsArr.length - 1;
      const yv = ptsArr[lastIdx];
      if (tipT) tipT.textContent = `${label} ${yv} · ${formatTime(lastIdx, ptsArr.length)}`;
    };
    updateTotalTip(ptsTpgc, 'PGC');
    svgT.addEventListener('mousemove', (e) => {
      const rect = svgT.getBoundingClientRect();
      const x = Math.max(0, Math.min(320, e.clientX - rect.left));
      const curPts = totalEl.__pts || ptsTpgc;
      const idx2 = Math.max(0, Math.min(curPts.length - 1, Math.round(x / 8)));
      const yv = curPts[idx2];
      cursorT.setAttribute('x1', String(x));
      cursorT.setAttribute('x2', String(x));
      cursorT.style.opacity = .9;
      const cy = Math.max(0, 160 - yv - BASE_LIFT);
      dotT.setAttribute('cx', String(x));
      dotT.setAttribute('cy', String(cy));
      dotT.style.opacity = 1;
      const label = totalEl.__label || 'PGC';
      if (tipT) tipT.textContent = `${label} ${yv} · ${formatTime(idx2, curPts.length)}`;
    });
    svgT.addEventListener('mouseleave', () => { cursorT.style.opacity = 0; dotT.style.opacity = 0; });
    const totalTags = document.querySelector('.total-box .tags');
    if (totalTags) {
      const els = totalTags.querySelectorAll('.tag');
      const colorBy = (k) => k === 'BTC' ? '#f59e0b' : (k === 'ETH' ? '#6366f1' : '#22d3ee');
      const setActiveTotal = (k) => {
        els.forEach(el => el.classList.remove('tag--active'));
        if (k === 'PGC' && els[0]) els[0].classList.add('tag--active');
        if (k === 'BTC' && els[1]) els[1].classList.add('tag--active');
        if (k === 'ETH' && els[2]) els[2].classList.add('tag--active');
      };
      const applyTotal = (ptsArr, label) => {
        totalEl.__pts = ptsArr;
        totalEl.__label = label;
      const d = ptsArr.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * 8} ${toYt(y)}`).join(' ');
        pT.setAttribute('d', d);
        const L4 = pT.getTotalLength();
        pT.style.strokeDasharray = L4;
        pT.style.strokeDashoffset = L4;
        requestAnimationFrame(() => { pT.style.strokeDashoffset = 0; });
        setActiveTotal(label);
        pT.style.stroke = colorBy(label);
        updateTotalTip(ptsArr, label);
        cursorT.style.opacity = 0; dotT.style.opacity = 0;
      };
      setActiveTotal(totalEl.__label || 'PGC');
      if (els[0]) els[0].onclick = () => applyTotal(ptsTpgc, 'PGC');
      if (els[1]) els[1].onclick = () => applyTotal(ptsTbtc, 'BTC');
      if (els[2]) els[2].onclick = () => applyTotal(ptsTeth, 'ETH');
    }
  }
  const usdtEl = document.getElementById('walletUSDT');
  if (usdtEl && u && u.wallet) {
    const vd = (u.wallet.valueDivision) || { 0: 0, 1: 0, 2: 0 };
    const pgc = Number(vd[0] || 0);
    const btc = Number(vd[1] || 0);
    const eth = Number(vd[2] || 0);
    const usdt = Math.round(pgc * 1 + btc * 100000 + eth * 4000);
    usdtEl.innerHTML = `<span class="amt">${usdt.toLocaleString()}</span><span class="unit">USDT</span>`;
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

    const tfMode = document.getElementById('tfMode');
    const tfCrossChk = document.getElementById('tfCross');
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
    const useTXCer = document.getElementById('useTXCer');
    const isPledge = document.getElementById('isPledge');
    const useTXCerChk = document.getElementById('useTXCerChk');
    const isPledgeChk = document.getElementById('isPledgeChk');
    const txErr = document.getElementById('txError');
    const txPreview = document.getElementById('txPreview');
    const u0 = loadUser();
    const srcAddrs = Object.keys((u0 && u0.wallet && u0.wallet.addressMsg) || {});
    addrList.innerHTML = srcAddrs.map(a => {
      const meta = (u0 && u0.wallet && u0.wallet.addressMsg && u0.wallet.addressMsg[a]) || {};
      const mt = Number(meta.type || 0);
      const val = Number((meta.value && meta.value.totalValue) || 0);
      const pgc = mt === 0 ? val : 0;
      const btc = mt === 1 ? val : 0;
      const eth = mt === 2 ? val : 0;
      const tagP = `<span class="tag tag--pgc${pgc ? ' tag--active' : ''}">PGC: ${pgc}</span>`;
      const tagB = `<span class="tag tag--btc${btc ? ' tag--active' : ''}">BTC: ${btc}</span>`;
      const tagE = `<span class="tag tag--eth${eth ? ' tag--active' : ''}">ETH: ${eth}</span>`;
      return `<label><input type="checkbox" value="${a}"><code class="break">${a}</code><span class="addr-bal">${tagP}${tagB}${tagE}</span></label>`;
    }).join('');
    const fillChange = () => {
      const sel = Array.from(addrList.querySelectorAll('input[type="checkbox"]')).filter(x => x.checked).map(x => x.value);
      Array.from(addrList.querySelectorAll('label')).forEach(l => { const inp = l.querySelector('input[type="checkbox"]'); if (inp) l.classList.toggle('selected', inp.checked); });
      const opts = sel.length ? sel : srcAddrs;
      const html = opts.map(a => `<option value="${a}">${a}</option>`).join('');
      chPGC.innerHTML = html;
      chBTC.innerHTML = html;
      chETH.innerHTML = html;
      const buildMenu = (box, optsArr, hidden) => {
        if (!box) return;
        const menu = box.querySelector('.custom-select__menu');
        const valEl = box.querySelector('.addr-val');
        if (menu) menu.innerHTML = optsArr.map(a => `<div class="custom-select__item" data-val="${a}"><span class="coin-icon ${box.dataset.coin==='BTC'?'coin--btc':(box.dataset.coin==='ETH'?'coin--eth':'coin--pgc')}"></span><code class="break" style="font-weight:700">${a}</code></div>`).join('');
        const first = optsArr[0] || '';
        if (valEl) valEl.textContent = first;
        if (hidden) hidden.value = first;
      };
      buildMenu(csPGC, opts, chPGC);
      buildMenu(csBTC, opts, chBTC);
      buildMenu(csETH, opts, chETH);
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
      const t = String(s||''); if (t.length <= 22) return t; return t.slice(0, 14) + '...' + t.slice(-6);
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
          <div class="bill-row bill-row--full"><label class="bill-label" for="${idBase}_to">地址</label><input id="${idBase}_to" class="input" type="text" placeholder="To Address" aria-label="目标地址" data-name="to"></div>
          <div class="bill-row"><label class="bill-label" for="${idBase}_val">金额</label><input id="${idBase}_val" class="input" type="number" placeholder="金额" aria-label="金额" data-name="val"></div>
          <div class="bill-row"><label class="bill-label" for="${idBase}_mt">币种</label><div id="${idBase}_mt" class="input custom-select" role="button" aria-label="币种" data-name="mt" data-val="0"><span class="custom-select__value"><span class="coin-icon coin--pgc"></span><span class="coin-label">PGC</span></span><span class="custom-select__arrow">▾</span><div class="custom-select__menu"><div class="custom-select__item" data-val="0"><span class="coin-icon coin--pgc"></span><span class="coin-label">PGC</span></div><div class="custom-select__item" data-val="1"><span class="coin-icon coin--btc"></span><span class="coin-label">BTC</span></div><div class="custom-select__item" data-val="2"><span class="coin-icon coin--eth"></span><span class="coin-label">ETH</span></div></div></div></div>
          <div class="bill-row bill-row--full"><label class="bill-label" for="${idBase}_pub">公钥</label><input id="${idBase}_pub" class="input" type="text" placeholder="04 + X + Y 或 X,Y" aria-label="公钥" data-name="pub"></div>
          <div class="bill-row"><label class="bill-label" for="${idBase}_gid">担保组织ID</label><input id="${idBase}_gid" class="input" type="text" placeholder="担保组织ID" value="" aria-label="担保组织ID" data-name="gid"></div>
          <div class="bill-row"><label class="bill-label" for="${idBase}_gas">转移Gas</label><input id="${idBase}_gas" class="input" type="number" placeholder="转移Gas" aria-label="转移Gas" data-name="gas"></div>
          <div class="bill-actions bill-actions--full"><button class="btn danger btn--sm bill-remove">删除</button></div>
        </div>
      `;
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
      const cs = row.querySelector('#'+idBase+'_mt');
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
      const v = tfMode.value;
      tfBtn.textContent = '生成交易结构体';
      tfBtn.classList.remove('secondary');
      tfBtn.classList.add('primary');
    };
    updateBtn();
    tfMode.addEventListener('change', updateBtn);
    if (tfCrossChk) {
      tfCrossChk.checked = (tfMode.value === 'cross');
      tfCrossChk.addEventListener('change', () => { tfMode.value = tfCrossChk.checked ? 'cross' : 'quick'; updateBtn(); });
    }
    if (useTXCerChk) {
      useTXCerChk.checked = (String(useTXCer.value) === 'true');
      useTXCerChk.addEventListener('change', () => { useTXCer.value = useTXCerChk.checked ? 'true' : 'false'; });
    }
    if (isPledgeChk) {
      isPledgeChk.checked = (String(isPledge.value) === 'true');
      isPledgeChk.addEventListener('change', () => { isPledge.value = isPledgeChk.checked ? 'true' : 'false'; });
    }
    const rates = { 0: 1, 1: 100000, 2: 4000 };
    tfBtn.addEventListener('click', () => {
      if (txErr) { txErr.textContent = ''; txErr.classList.add('hidden'); }
      const sel = Array.from(addrList.querySelectorAll('input[type="checkbox"]')).filter(x => x.checked).map(x => x.value);
      if (sel.length === 0) { if (txErr) { txErr.textContent = '请选择至少一个来源地址'; txErr.classList.remove('hidden'); } return; }
      const rows = Array.from(billList.querySelectorAll('.bill-item'));
      if (rows.length === 0) { if (txErr) { txErr.textContent = '请至少添加一笔转账账单'; txErr.classList.remove('hidden'); } return; }
      const isCross = tfMode.value === 'cross';
      if (isCross && rows.length !== 1) { if (txErr) { txErr.textContent = '跨链交易只能包含一笔账单'; txErr.classList.remove('hidden'); } return; }
      const changeMap = {};
      if (chPGC.value) changeMap[0] = chPGC.value;
      if (chBTC.value) changeMap[1] = chBTC.value;
      if (chETH.value) changeMap[2] = chETH.value;
      const bills = {};
      const vd = { 0: 0, 1: 0, 2: 0 };
      let outInterest = 0;
      const parsePub = (raw) => {
        const s = String(raw || '').trim().replace(/^0x/i, '').toLowerCase();
        if (!s) return { x: '', y: '' };
        if (s.length === 130 && s.startsWith('04')) { return { x: s.slice(2, 66), y: s.slice(66, 130) }; }
        const parts = s.split(/[\s,]+/).filter(Boolean);
        if (parts.length === 2 && parts[0].length === 64 && parts[1].length === 64) { return { x: parts[0], y: parts[1] }; }
        return { x: '', y: '' };
      };
      for (const r of rows) {
        const toEl = r.querySelector('[data-name="to"]');
        const mtEl = r.querySelector('[data-name="mt"]');
        const valEl = r.querySelector('[data-name="val"]');
        const gidEl = r.querySelector('[data-name="gid"]');
        const pubEl = r.querySelector('[data-name="pub"]');
        const gasEl = r.querySelector('[data-name="gas"]');
        const to = String((toEl && toEl.value) || '').trim();
        const mt = Number((mtEl && (mtEl.dataset && mtEl.dataset.val)) || 0);
        const val = Number((valEl && valEl.value) || 0);
        const gid = String((gidEl && gidEl.value) || '').trim();
        const comb = String((pubEl && pubEl.value) || '').trim();
        const { x: px, y: py } = parsePub(comb);
        const tInt = Number((gasEl && gasEl.value) || 0);
        if (!to || val <= 0) { if (txErr) { txErr.textContent = '请填写有效的账单信息'; txErr.classList.remove('hidden'); } return; }
        if (isCross && mt !== 0) { if (txErr) { txErr.textContent = '跨链交易只能使用主货币'; txErr.classList.remove('hidden'); } return; }
        if (bills[to]) { if (txErr) { txErr.textContent = '同一地址仅允许一笔账单'; txErr.classList.remove('hidden'); } return; }
        bills[to] = { MoneyType: mt, Value: val, GuarGroupID: gid, PublicKey: { Curve: 'P256', XHex: px, YHex: py }, ToInterest: tInt };
        vd[mt] += val;
        outInterest += Math.max(0, tInt || 0);
      }
      const extraPGC = Number(gasInput.value || 0);
      const interestGas = extraPGC > 0 ? extraPGC * 10 : 0;
      const firstAddr = sel[0];
      const backAssign = {}; sel.forEach((a, i) => { backAssign[a] = i === 0 ? 1 : 0; });
      const valueTotal = Object.keys(vd).reduce((s, k) => s + vd[k] * rates[k], 0);
      const build = {
        Value: valueTotal,
        ValueDivision: vd,
        Bill: bills,
        UserAddress: sel,
        PriUseTXCer: String(useTXCer.value) === 'true',
        ChangeAddress: changeMap,
        IsPledgeTX: String(isPledge.value) === 'true',
        HowMuchPayForGas: extraPGC,
        IsCrossChainTX: isCross,
        Data: '',
        InterestAssign: { Gas: interestGas, Output: outInterest, BackAssign: backAssign }
      };
      if (isCross && sel.length !== 1) { if (txErr) { txErr.textContent = '跨链交易只能有一个来源地址'; txErr.classList.remove('hidden'); } return; }
      if (isCross && (!changeMap[0] || Object.keys(changeMap).length !== 1)) { if (txErr) { txErr.textContent = '跨链交易找零地址必须仅包含主货币地址'; txErr.classList.remove('hidden'); } return; }
      if (txPreview) { txPreview.textContent = JSON.stringify(build, null, 2); txPreview.classList.remove('hidden'); }
    });
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
      renderWallet();
      try { updateWalletBrief(); } catch {}
      const modal = document.getElementById('actionModal');
      const title = document.getElementById('actionTitle');
      const text = document.getElementById('actionText');
      const ok = document.getElementById('actionOkBtn');
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
    try { localStorage.setItem('guarChoice', JSON.stringify({ type: 'none' })); } catch {}
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
  } catch {}
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
  [['woGroupID', joined ? g.groupID : ''],
   ['woAggre', joined ? (g.aggreNode || '') : ''],
   ['woAssign', joined ? (g.assignNode || '') : ''],
   ['woPledge', joined ? (g.pledgeAddress || '') : '']]
  .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
}
