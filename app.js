// 前端实现 NewUser 逻辑：
// - 生成 ECDSA P-256 密钥对（WebCrypto）
// - 使用私钥 d 作为输入生成 8 位用户 ID（CRC32 结果映射）
// - 使用未压缩公钥(0x04 || X || Y)的 SHA-256 前 20 字节生成地址

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
const STORAGE_KEY = 'walletUser';
function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
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
    if (menuAccountEl) menuAccountEl.textContent = user.accountId || '';
    if (menuAddrEl) menuAddrEl.textContent = user.address || '';
    if (menuOrgItem) menuOrgItem.classList.remove('hidden');
    if (menuBalanceItem) menuBalanceItem.classList.remove('hidden');
    if (menuOrgEl) menuOrgEl.textContent = user.orgNumber || '暂未加入担保组织';
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
  }
}
function saveUser(user) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('保存本地用户信息失败', e);
  }
  updateHeaderUser(user);
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
    if (resultEl) resultEl.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');
    const t0 = Date.now();
    const data = await newUser();
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
    saveUser({ accountId: data.accountId, address: data.address, privHex: data.privHex, pubXHex: data.pubXHex, pubYHex: data.pubYHex });
  } catch (err) {
    alert('创建用户失败：' + err);
    console.error(err);
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

// 页面入口交互：在首次进入展示“新建钱包 / 导入钱包”两按钮
const entryCard = document.getElementById('entryCard');
const newUserCard = document.getElementById('newUserCard');
const importCard = document.getElementById('importCard');
const createWalletBtn = document.getElementById('createWalletBtn');
const importWalletBtn = document.getElementById('importWalletBtn');
const importBtn = document.getElementById('importBtn');

function showCard(card) {
  // 隐藏其他卡片
  if (entryCard) entryCard.classList.add('hidden');
  if (newUserCard) newUserCard.classList.add('hidden');
  if (importCard) importCard.classList.add('hidden');
  const nextCard = document.getElementById('nextCard');
  if (nextCard) nextCard.classList.add('hidden');
  const finalCard = document.getElementById('finalCard');
  if (finalCard) finalCard.classList.add('hidden');
  const importNextCard = document.getElementById('importNextCard');
  if (importNextCard) importNextCard.classList.add('hidden');
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

function router() {
  const h = (location.hash || '#/entry').replace(/^#/, '');
  const u = loadUser();
  const allowNoUser = ['/entry', '/new', '/import'];
  if (!u && allowNoUser.indexOf(h) === -1) {
    routeTo('#/entry');
    return;
  }
  switch (h) {
    case '/entry':
      showCard(entryCard);
      break;
    case '/new':
      showCard(newUserCard);
      // 如果尚未生成，则自动生成一次
      const resultEl = document.getElementById('result');
      if (resultEl && resultEl.classList.contains('hidden')) {
        handleCreate().catch(() => {});
      }
      break;
    case '/import':
      showCard(importCard);
      {
        const importNextBtn = document.getElementById('importNextBtn');
        if (importNextBtn) importNextBtn.classList.add('hidden');
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
    case '/next':
      routeTo('#/join-group');
      break;
    case '/final':
      showCard(document.getElementById('finalCard'));
      const finalText = document.getElementById('finalText');
      try {
        const raw = localStorage.getItem('guarChoice');
        const choice = raw ? JSON.parse(raw) : null;
        if (choice && choice.type === 'join') {
          finalText.textContent = `已选择加入担保组织：${choice.groupID}`;
          const u = loadUser();
          if (u) {
            u.orgNumber = choice.groupID;
            saveUser(u);
          }
        } else {
          finalText.textContent = '已选择不加入担保组织';
        }
      } catch (_) {
        if (finalText) finalText.textContent = '';
      }
      break;
    case '/import-next':
      showCard(document.getElementById('importNextCard'));
      break;
    default:
      // 未知路由回到入口
      routeTo('#/entry');
      break;
  }
}
window.__lastHash = location.hash || '#/entry';
window.addEventListener('hashchange', () => {
  const newHash = location.hash || '#/entry';
  const oldHash = window.__lastHash || '#/entry';
  const u = loadUser();
  const goingBackToEntry = (oldHash === '#/new' || oldHash === '#/import') && newHash === '#/entry';
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
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
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
  // 使用 replace 避免多一个历史记录层级
  location.replace('#/entry');
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
if (createWalletBtn && !createWalletBtn.dataset._bind) {
  createWalletBtn.addEventListener('click', () => routeTo('#/new'));
  createWalletBtn.dataset._bind = '1';
}

// 点击“导入钱包”：切换到路由显示导入界面
if (importWalletBtn && !importWalletBtn.dataset._bind) {
  importWalletBtn.addEventListener('click', () => routeTo('#/import'));
  importWalletBtn.dataset._bind = '1';
}

// 结果页“下一步”按钮：跳转到占位页
const newNextBtn = document.getElementById('newNextBtn');
if (newNextBtn) {
  newNextBtn.addEventListener('click', () => routeTo('#/join-group'));
}
const importNextBtn = document.getElementById('importNextBtn');
if (importNextBtn) {
  importNextBtn.addEventListener('click', () => routeTo('#/import-next'));
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
    try { localStorage.setItem('guarChoice', JSON.stringify({ type: 'join', groupID: g.groupID })); } catch {}
    routeTo('#/final');
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
    try { localStorage.setItem('guarChoice', JSON.stringify({ type: 'join', groupID: g.groupID })); } catch {}
    routeTo('#/final');
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
      if (loader) loader.classList.remove('hidden');
      const t0 = Date.now();
      const data = await importFromPrivHex(priv);
      const elapsed = Date.now() - t0;
      if (elapsed < 1000) await wait(1000 - elapsed);
      if (loader) loader.classList.add('hidden');
      // 显示导入结果并淡入
      resultEl.classList.remove('hidden');
      resultEl.classList.remove('fade-in');
      resultEl.classList.remove('reveal');
      requestAnimationFrame(() => resultEl.classList.add('reveal'));
      document.getElementById('importAccountId').textContent = data.accountId || '';
      document.getElementById('importAddress').textContent = data.address || '';
      document.getElementById('importPrivHexOut').textContent = data.privHex || normalized;
      document.getElementById('importPubX').textContent = data.pubXHex || '';
      document.getElementById('importPubY').textContent = data.pubYHex || '';
      // 保存并刷新右上角用户栏
      saveUser({
        accountId: data.accountId,
        address: data.address,
        privHex: data.privHex,
        pubXHex: data.pubXHex,
        pubYHex: data.pubYHex,
      });
      if (importNextBtn) importNextBtn.classList.remove('hidden');
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

// 用户菜单展开/收起与初始化渲染
const userButton = document.getElementById('userButton');
if (userButton) {
  userButton.addEventListener('click', (e) => {
    e.stopPropagation();
    updateHeaderUser(loadUser());
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.add('hidden');
  });
  // 初始渲染用户栏
  updateHeaderUser(loadUser());
}

// 登出：清除本地账户信息并返回入口页
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (logoutBtn.disabled) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    updateHeaderUser(null);
    clearUIState();
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.add('hidden');
    routeTo('#/entry');
  });
}
// 点击推荐区标题，切换收叠/展开
const recPaneHeader = document.querySelector('#recPane h3');
if (recPaneHeader && recPane) {
  recPaneHeader.addEventListener('click', () => {
    recPane.classList.toggle('collapsed');
  });
}

// 不加入担保组织确认模态框
const confirmSkipModal = document.getElementById('confirmSkipModal');
const confirmSkipOk = document.getElementById('confirmSkipOk');
const confirmSkipCancel = document.getElementById('confirmSkipCancel');
if (confirmSkipOk) {
  confirmSkipOk.addEventListener('click', () => {
    try { localStorage.setItem('guarChoice', JSON.stringify({ type: 'none' })); } catch {}
    if (confirmSkipModal) confirmSkipModal.classList.add('hidden');
    routeTo('#/final');
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
