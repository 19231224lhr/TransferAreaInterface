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
  const crc = crc32(hexToBytes(hex));
  const num = (crc % 90000000) + 10000000; // 映射到 10000000..99999999
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
  const logoutEl = document.getElementById('logoutBtn');
  if (!labelEl || !avatarEl) return; // header 不存在时忽略
  if (user && user.accountId) {
    labelEl.textContent = user.accountId;
    // 头像保持固定，不再随ID变化
    avatarEl.textContent = '👤';
    avatarEl.classList.add('avatar--active');
    if (menuAccountEl) menuAccountEl.textContent = user.accountId || '';
    if (menuAddrEl) menuAddrEl.textContent = user.address || '';
    if (logoutEl) {
      logoutEl.disabled = false;
      logoutEl.classList.remove('menu-action--disabled');
      logoutEl.textContent = '退出登录';
    }
  } else {
    labelEl.textContent = '未登录';
    avatarEl.textContent = '👤';
    avatarEl.classList.remove('avatar--active');
    if (menuAccountEl) menuAccountEl.textContent = '暂未登录';
    if (menuAddrEl) menuAddrEl.textContent = '暂未登录';
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
    const { accountId, address, privHex, pubXHex, pubYHex } = await newUser();
    const resultEl = document.getElementById('result');
    resultEl.classList.remove('hidden');
    // retrigger subtle entrance animation
    resultEl.classList.remove('fade-in');
    requestAnimationFrame(() => resultEl.classList.add('fade-in'));
    document.getElementById('accountId').textContent = accountId;
    document.getElementById('address').textContent = address;
    document.getElementById('privHex').textContent = privHex;
    document.getElementById('pubX').textContent = pubXHex;
    document.getElementById('pubY').textContent = pubYHex;
    // 保存并刷新右上角用户栏
    saveUser({ accountId, address, privHex, pubXHex, pubYHex });
  } catch (err) {
    alert('创建用户失败：' + err);
    console.error(err);
  } finally {
    btn.disabled = false;
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
  } else {
    // 若 hash 未变化，也触发一次路由逻辑
    router();
  }
}

function router() {
  const h = (location.hash || '#/entry').replace(/^#/, '');
  const u = loadUser();
  // 已登录时，进入入口页视图则隐藏所有卡片，仅保留顶部用户信息
  if (u && h === '/entry') {
    if (entryCard) entryCard.classList.add('hidden');
    if (newUserCard) newUserCard.classList.add('hidden');
    if (importCard) importCard.classList.add('hidden');
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
      break;
    default:
      // 未知路由回到入口
      routeTo('#/entry');
      break;
  }
}
// 返回时退出确认：从新建/导入返回入口页时进行确认
window.addEventListener('hashchange', (e) => {
  const newHash = location.hash || '#/entry';
  let oldHash = '#/entry';
  try { oldHash = new URL(e.oldURL).hash || '#/entry'; } catch {}
  const u = loadUser();
  const goingBackToEntry = (oldHash === '#/new' || oldHash === '#/import') && newHash === '#/entry';
  if (u && goingBackToEntry) {
    const ok = confirm('是否退出钱包并返回首页？');
    if (ok) {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      updateHeaderUser(null);
      // 强制回到首页
      location.replace('#/entry');
      router();
    } else {
      // 取消返回，恢复原页面
      location.replace(oldHash);
      router();
    }
  } else {
    router();
  }
});
// 初始路由：无 hash 时设为入口
const initialUser = loadUser();
if (!location.hash) {
  if (initialUser) {
    // 跳过欢迎页，仅显示顶部用户信息
    if (entryCard) entryCard.classList.add('hidden');
    if (newUserCard) newUserCard.classList.add('hidden');
    if (importCard) importCard.classList.add('hidden');
  } else {
    // 使用 replace 避免多一个历史记录层级
    location.replace('#/entry');
  }
}
// 执行一次路由以同步初始视图
router();

// 点击“新建钱包”：切换到路由并自动生成
if (createWalletBtn) {
  createWalletBtn.addEventListener('click', () => routeTo('#/new'));
}

// 点击“导入钱包”：切换到路由显示导入界面
if (importWalletBtn) {
  importWalletBtn.addEventListener('click', () => routeTo('#/import'));
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
      return data;
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
      const data = await importFromPrivHex(priv);
      const resultEl = document.getElementById('importResult');
      resultEl.classList.remove('hidden');
      resultEl.classList.remove('fade-in');
      requestAnimationFrame(() => resultEl.classList.add('fade-in'));
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
    } catch (err) {
      alert('导入失败：' + err.message);
      console.error(err);
    } finally {
      importBtn.disabled = false;
    }
  });
}

// 用户菜单展开/收起与初始化渲染
const userButton = document.getElementById('userButton');
if (userButton) {
  userButton.addEventListener('click', (e) => {
    e.stopPropagation();
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
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.add('hidden');
    routeTo('#/entry');
  });
}