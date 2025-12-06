// 前端实现 NewUser 逻辑：
// - 生成 ECDSA P-256 密钥对（WebCrypto）
// - 使用私钥 d 作为输入生成 8 位用户 ID（CRC32 结果映射）
// - 使用未压缩公钥(0x04 || X || Y)的 SHA-256 前 20 字节生成地址

try { window.addEventListener('error', function (e) { var m = String((e && e.message) || ''); var f = String((e && e.filename) || ''); if (m.indexOf('Cannot redefine property: ethereum') !== -1 || f.indexOf('evmAsk.js') !== -1) { if (e.preventDefault) e.preventDefault(); return true; } }, true); } catch (_) { }
try { window.addEventListener('unhandledrejection', function () { }, true); } catch (_) { }

// ========================================
// 国际化 (i18n) 系统
// ========================================

const I18N_STORAGE_KEY = 'appLanguage';

// 翻译字典
const translations = {
  'zh-CN': {
    // 通用
    'common.cancel': '取消',
    'common.save': '保存',
    'common.back': '返回',
    'common.confirm': '确认',
    'common.loading': '加载中...',
    'common.processing': '正在处理...',
    'common.success': '成功',
    'common.error': '错误',
    'common.warning': '警告',
    'common.info': '提示',
    'common.notLoggedIn': '未登录',
    'common.logout': '退出登录',
    'common.next': '继续下一步',
    'common.regenerate': '重新生成',
    'common.expandMore': '展开更多',
    'common.collapseMore': '收起',
    
    // 页面标题
    'page.title': 'UTXO 钱包 - 钱包操作',
    
    // 头部菜单
    'header.userInfo': '用户信息',
    'header.editProfile': '点击编辑个人信息',
    'header.accountId': '账户 ID',
    'header.addressInfo': '地址信息',
    'header.guarantorOrg': '担保组织',
    'header.balance': '余额',
    'header.exchangeRate': '汇率: 1 PGC = 1 USDT, 1 BTC = 100 USDT, 1 ETH = 10 USDT',
    'header.notLoggedIn': '尚未登录',
    'header.loginHint': '请先创建或导入账户',
    'header.addresses': '{count} 个地址',
    'header.noOrg': '暂未加入担保组织',
    
    // 欢迎页面
    'welcome.badge': '安全 · 快速 · 去中心化',
    'welcome.titleLine1': '开启您的',
    'welcome.titleLine2': '数字资产之旅',
    'welcome.subtitle': '基于 UTXO 模型的新一代区块链钱包，为您提供安全可靠的资产管理体验',
    'welcome.feature1.title': '安全保障',
    'welcome.feature1.desc': '本地加密存储，私钥永不上传',
    'welcome.feature2.title': '极速转账',
    'welcome.feature2.desc': '优化的 UTXO 算法，秒级确认',
    'welcome.feature3.title': '跨链互通',
    'welcome.feature3.desc': '支持多链资产，一站式管理',
    'welcome.getStarted': '立即开始',
    'welcome.hasAccount': '已有账户？登录',
    'welcome.activeUsers': '活跃用户',
    'welcome.totalVolume': '交易总额',
    'welcome.security': '安全保障',
    'welcome.cardHolder': '持卡人',
    'welcome.expiry': '有效期',
    
    // 钱包管理页面
    'entry.title': '钱包管理',
    'entry.description': '安全管理您的数字资产，支持多地址统一管理',
    'entry.benefit1.title': '安全加密存储',
    'entry.benefit1.desc': '采用高强度加密算法，确保私钥安全',
    'entry.benefit2.title': '多地址管理',
    'entry.benefit2.desc': '同时管理多个钱包地址，便捷切换',
    'entry.benefit3.title': '一键导入',
    'entry.benefit3.desc': '支持通过私钥快速导入现有钱包',
    'entry.walletsAdded': '已添加钱包',
    'entry.encryptionAlgo': '加密算法',
    'entry.selectAction': '选择操作方式',
    'entry.selectActionDesc': '生成新钱包或导入已有钱包，开启您的数字资产之旅',
    'entry.createWallet': '新建钱包',
    'entry.createWalletDesc': '生成全新的密钥对',
    'entry.importWallet': '导入钱包',
    'entry.importWalletDesc': '使用已有私钥导入',
    'entry.addWalletFirst': '请先添加至少一个钱包地址',
    'entry.enterPrivateKeyHex': '请输入私钥 Hex',
    
    // 新建账户页面
    'new.title': '创建新账户',
    'new.description': '安全生成 P-256 ECDSA 密钥对，开启您的区块链之旅',
    'new.benefit1.title': '安全密钥生成',
    'new.benefit1.desc': '采用 P-256 椭圆曲线算法生成密钥对',
    'new.benefit2.title': '本地加密存储',
    'new.benefit2.desc': '私钥仅存储在本地浏览器中',
    'new.benefit3.title': '一键添加钱包',
    'new.benefit3.desc': '生成后可直接添加到钱包列表',
    'new.ellipticCurve': '椭圆曲线',
    'new.signatureAlgo': '签名算法',
    'new.generateKeys': '生成密钥对',
    'new.generateKeysDesc': '系统将自动生成安全的密钥对，请妥善保管您的私钥',
    'new.generating': '正在生成密钥',
    'new.accountCreated': '账户创建成功',
    'new.mainAddress': '主地址',
    'new.privateKey': '私钥（Hex）',
    'new.publicKey': '公钥（X / Y Hex）',
    'new.doNotShare': '请勿泄露',
    'new.addWalletAddress': '添加钱包地址',
    
    // 登录页面
    'login.title': '登录账户',
    'login.description': '使用私钥安全登录，恢复您的账户信息',
    'login.benefit1.title': '安全验证',
    'login.benefit1.desc': '私钥不会上传，仅在本地验证',
    'login.benefit2.title': '账户恢复',
    'login.benefit2.desc': '通过私钥恢复完整账户信息',
    'login.benefit3.title': '钱包管理',
    'login.benefit3.desc': '登录后可管理所有钱包地址',
    'login.dataStorage': '数据存储',
    'login.local': '本地',
    'login.accountLogin': '账户登录',
    'login.accountLoginDesc': '输入您的私钥以恢复账户并访问钱包管理功能',
    'login.privateKeyHex': '私钥（Hex）',
    'login.enterPrivateKey': '请输入您的私钥 Hex...',
    'login.secureLogin': '安全登录',
    'login.securityTip': '请确保在安全的环境中输入私钥，切勿泄露给他人',
    'login.verifying': '正在验证身份',
    'login.success': '登录成功',
    'login.sensitiveInfo': '敏感信息',
    'login.reLogin': '重新登录',
    'login.enterWallet': '进入钱包管理',
    'login.verifyingAndRedirecting': '验证通过，正在为您跳转...',
    'login.connectingNetwork': '正在连接到网络',
    'login.establishingConnection': '正在建立安全连接，验证账户信息',
    'login.inquiringNetwork': '正在发起网络问询以确定账户所属关系，请稍候',
    'login.stepInitialize': '初始化',
    'login.stepConnecting': '连接网络',
    'login.stepVerifying': '验证账户',
    
    // 导入钱包页面
    'import.title': '导入钱包',
    'import.description': '通过私钥恢复您的钱包地址，安全快捷',
    'import.benefit1.title': '本地安全',
    'import.benefit1.desc': '私钥仅在本地存储，不会上传服务器',
    'import.benefit2.title': '钱包恢复',
    'import.benefit2.desc': '使用私钥快速恢复您的钱包',
    'import.benefit3.title': '密钥兼容',
    'import.benefit3.desc': '支持多种格式的私钥导入',
    'import.keyLength': '密钥长度',
    'import.importWallet': '导入钱包',
    'import.importWalletDesc': '输入您的私钥以恢复钱包地址并管理资产',
    'import.enterPrivateKey': '请输入 64 位十六进制私钥',
    'import.formatHint': '支持带 0x 前缀或纯 64 位十六进制格式',
    'import.securityTip': '请确保在安全的环境中输入私钥，私钥将仅存储在本地浏览器中',
    'import.verifying': '正在验证并导入',
    'import.success': '钱包导入成功',
    'import.reImport': '重新导入',
    
    // 页脚
    'footer.text': '区块链与你同频，信息予你无限。 Blockchain resonates with you. Infinity within your reach.',
    
    // 主钱包页面
    'wallet.myWallet': '我的钱包',
    'wallet.secureManagement': '安全管理数字资产',
    'wallet.refresh': '刷新',
    'wallet.create': '新建',
    'wallet.import': '导入',
    'wallet.totalAssets': '总资产估值',
    'wallet.addressManagement': '地址管理',
    'wallet.addressCount': '{count} 个地址',
    'wallet.transfer': '转账交易',
    'wallet.fastTransfer': '快速安全的转账体验',
    'wallet.download': '下载',
    'wallet.upload': '上传',
    'wallet.latency': '延迟',
    'wallet.quickTransfer': '快速转账',
    'wallet.crossChain': '跨链转账',
    'wallet.pledge': '质押交易',
    'wallet.normalTransfer': '普通转账',
    'wallet.from': '从 · FROM',
    'wallet.to': '转至 · TO',
    'wallet.advancedOptions': '高级选项',
    'wallet.extraGas': '额外Gas',
    'wallet.txGas': '交易Gas',
    'wallet.addRecipient': '添加收款方',
    'wallet.send': '发送交易',
    'wallet.addressListTip': '提示：登录账号的地址不计入列表',
    'wallet.noAddress': '暂无地址',
    'wallet.deleteAddress': '删除地址',
    'wallet.exportPrivateKey': '导出私钥',
    'wallet.deleteSuccess': '删除成功',
    'wallet.deleteSuccessDesc': '已删除该地址及其相关本地数据',
    'wallet.exportPrivateKey': '导出私钥',
    'wallet.exportFailed': '导出失败',
    'wallet.noPrivateKey': '该地址无可导出私钥',
    'wallet.copied': '已复制！',
    'wallet.syncing': '同步中...',
    
    // 加入担保组织页面
    'join.title': '加入担保组织',
    'join.description': '获得更稳定的交易服务与全方位账户保障',
    'join.benefit1.title': '加速交易确认',
    'join.benefit1.desc': '享受优先确认通道，交易更快完成',
    'join.benefit2.title': '跨区保障权益',
    'join.benefit2.desc': '多区域联保机制，资产更加安全',
    'join.benefit3.title': '个性化地址',
    'join.benefit3.desc': '支持自定义地址标签与管理',
    'join.benefit4.title': '收益统计',
    'join.benefit4.desc': '清晰的利息收益与交易分析',
    'join.availability': '服务可用性',
    'join.support247': '全天候保障',
    'join.systemRecommend': '系统推荐',
    'join.searchOrg': '搜索组织',
    'join.recommended': '推荐',
    'join.bestMatch': '为您匹配的最优组织',
    'join.bestMatchDesc': '系统已根据网络状况为您选择最佳担保组织',
    'join.guarantorOrg': '担保组织',
    'join.joinThisOrg': '加入此组织',
    'join.searchGuarantorOrg': '搜索担保组织',
    'join.searchOrgDesc': '输入组织编号查找特定担保组织',
    'join.enterOrgNumber': '输入担保组织编号...',
    'join.startSearch': '输入组织编号开始搜索',
    'join.skipJoin': '暂不加入担保组织',
    'join.joiningOrg': '正在加入担保组织...',
    'join.notJoined': '未加入担保组织',
    'join.notJoinedDesc': '加入担保组织可享受更安全的交易保障和专属福利服务',
    'join.notJoinedLongDesc': '加入担保组织可享受更安全的交易保障和专属福利服务，让您的数字资产交易更加安心无忧。',
    'join.confirmSkip': '确认不加入担保组织',
    'join.confirmSkipDesc': '这是一个警告操作，确认后将不加入担保组织并进入下一步。',
    'join.joined': '已加入',
    'join.leavingOrg': '正在退出担保组织...',
    
    // 转账表单
    'transfer.recipientAddress': '收款地址',
    'transfer.enterRecipientAddress': '输入收款方地址',
    'transfer.amount': '转账金额',
    'transfer.currency': '币种',
    'transfer.publicKey': '公钥',
    'transfer.guarantorOrgId': '担保组织ID',
    'transfer.optional': '可选',
    'transfer.transferGas': '转移Gas',
    'transfer.delete': '删除',
    'transfer.addRecipient': '添加',
    'transfer.pgcReceiveAddress': 'PGC 找零',
    'transfer.btcReceiveAddress': 'BTC 找零',
    'transfer.ethReceiveAddress': 'ETH 找零',
    'transfer.noAddressAvailable': '无可用地址',
    'transfer.generateTxStruct': '生成交易结构体',
    'transfer.collapseInfo': '收起完整信息',
    'transfer.showFullInfo': '展示完整信息',
    'transfer.collapseStruct': '收起账户结构体',
    'transfer.expandStruct': '展开账户结构体',
    'transfer.cannotDeleteLast': '仅剩一笔转账不允许删除',
    'transfer.collapseOptions': '收起选项',
    
    // 模态框和提示
    'modal.confirmSubAddress': '确认导入子地址',
    'modal.currentSubAddressCount': '当前子地址数：{count}，是否确认继续下一步？',
    'modal.cancel': '取消',
    'modal.confirm': '确认',
    'modal.addingWalletAddress': '正在新增钱包地址...',
    'modal.walletAddSuccess': '新增钱包成功',
    'modal.walletAddSuccessDesc': '已新增一个钱包地址',
    'modal.ok': '好的',
    'modal.inputError': '输入错误',
    'modal.pleaseEnterPrivateKey': '请输入私钥 Hex',
    'modal.formatError': '格式错误',
    'modal.privateKeyFormatError': '私钥格式不正确：需为 64 位十六进制字符串',
    'modal.operationFailed': '操作失败',
    'modal.pleaseLoginFirst': '请先登录或注册账户',
    'modal.systemError': '系统错误',
    'modal.importFailed': '导入失败：{error}',
    'modal.inputIncomplete': '输入不完整',
    'modal.pleaseEnterPrivateKeyHex': '请输入您的私钥 Hex 字符串',
    'modal.privateKeyFormat64': '私钥需为 64 位十六进制字符串（可带 0x 前缀）',
    'modal.loginFailed': '登录失败',
    'modal.cannotRecognizeKey': '无法识别该私钥，请检查输入是否正确',
    'modal.enteringWalletPage': '正在进入生成或导入钱包页面...',
    'modal.newAddress': '新建',
    'modal.leaveOrgTitle': '退出担保组织',
    'modal.leaveOrgDesc': '退出后将清空本地担保组织信息，账户将视为未加入状态。确定要继续吗？',
    
    // 个人信息页面
    'profile.title': '个人信息',
    'profile.description': '管理您的账户头像与昵称，打造专属个人形象',
    'profile.settings.title': '个人信息设置',
    'profile.settings.description': '自定义您的头像、昵称和个性签名，让您的账户更具个性',
    'profile.avatar.title': '头像设置',
    'profile.avatar.hint': '支持 JPG、PNG、GIF、WebP 格式，建议尺寸 200x200 像素',
    'profile.avatar.upload': '选择图片',
    'profile.avatar.remove': '移除头像',
    'profile.avatar.preview': '头像预览',
    'profile.nickname.title': '昵称设置',
    'profile.nickname.placeholder': '请输入昵称',
    'profile.nickname.hint': '昵称将显示在界面各处，支持中英文字符，最多20个字符',
    'profile.signature.title': '个性签名',
    'profile.signature.placeholder': '这个人很懒，还没有修改这里。',
    'profile.signature.hint': '个性签名将显示在个人信息栏下方，最多50个字符',
    'profile.language.title': '语言设置',
    'profile.language.hint': '选择您偏好的界面语言',
    'profile.action.cancel': '取消',
    'profile.action.save': '保存设置',
    'profile.action.saved': '已保存',
    'profile.tip.localStorage': '头像仅存储在本地浏览器',
    'profile.tip.squareImage': '建议使用正方形图片',
    
    // Toast 消息
    'toast.profile.saved': '个人信息保存成功',
    'toast.profile.saveTitle': '保存成功',
    'toast.avatar.formatError': '请选择 JPG、PNG、GIF 或 WebP 格式的图片',
    'toast.avatar.sizeError': '图片大小不能超过 5MB，当前大小: {size}MB',
    'toast.language.changed': '语言已切换',
    'toast.account.created': '账户创建成功！密钥已安全生成',
    'toast.account.createTitle': '创建成功',
    'toast.login.success': '登录成功',
    'toast.login.successDesc': '账户信息已成功恢复',
    'toast.login.failed': '登录失败',
    'toast.copied': '已复制到剪贴板',
    'toast.copyFailed': '复制失败',
    'toast.leftOrg': '已退出担保组织',
    'toast.leftOrgDesc': '当前账户已退出担保组织，可稍后重新加入。',
    'toast.addressOptimized': '已优化来源地址',
    'toast.buildingTx': '正在构造交易...',
    'toast.buildTxSuccess': '交易构造成功',
    'toast.buildTxSuccessDesc': '已成功构造 Transaction 结构体，点击下方按钮查看详情',
    'toast.buildTxFailed': '构造失败',
    'toast.importFailed': '导入失败',
    'toast.cannotParseAddress': '无法解析地址',
    'toast.addressExists': '该地址已存在，不能重复导入',
    
    // 验证消息
    'validation.nickname.empty': '昵称不能为空',
    'validation.nickname.tooLong': '昵称不能超过20个字符',
    'validation.signature.tooLong': '签名不能超过50个字符',
    
    // 地址详情
    'address.fullAddress': '完整地址',
    'address.balance': '余额',
    'address.add': '增加',
    'address.clear': '清空',
    'address.confirmDelete': '是否删除地址',
    'address.confirmDeleteDesc': '及其本地数据？',
    'address.deleteConfirm': '确认',
    'address.deleteCancel': '取消',
    
    // 加载阶段
    'loading.initializing': '正在初始化',
    'loading.initializingDesc': '准备连接组件...',
    'loading.connecting': '正在连接网络',
    'loading.connectingDesc': '正在建立安全连接，验证账户信息',
    'loading.verifying': '正在验证账户',
    'loading.verifyingDesc': '校验账户信息与组织关系...',
    'loading.success': '连接成功',
    'loading.successDesc': '账户验证通过，即将进入系统',
    
    // 交易验证错误
    'tx.addressEmpty': '地址为空',
    'tx.insufficientBalance': '余额不足',
    'tx.addressNotSelected': '地址未选择',
    'tx.addressError': '地址错误',
    'tx.missingTransferInfo': '转账信息缺失',
    'tx.crossChainLimit': '跨链交易限制',
    'tx.changeAddressMissing': '找零地址缺失',
    'tx.changeAddressError': '找零地址错误',
    'tx.incompleteInfo': '账单信息不完整',
    'tx.addressFormatError': '地址格式错误',
    'tx.addressFormatErrorDesc': '目标地址格式错误，应为40位十六进制字符串',
    'tx.currencyError': '币种错误',
    'tx.orgIdFormatError': '组织ID格式错误',
    'tx.publicKeyFormatError': '公钥格式错误',
    'tx.amountError': '金额错误',
    'tx.gasParamError': 'Gas参数错误',
    'tx.duplicateAddress': '地址重复',
    'tx.addressNotFound': '未找到该地址信息',
    'tx.queryFailed': '查询失败，请稍后重试',
    
    // 钱包地址模态框
    'walletModal.createAddress': '新建地址',
    'walletModal.importAddress': '导入地址',
    'walletModal.createConfirm': '确认新建一个子地址并加入当前账户。',
    'walletModal.privateKeyLabel': '私钥（Hex）',
    'walletModal.privateKeyDoNotShare': '私钥 (请勿泄露)',
    'walletModal.privateKeyFormatError': '私钥格式不正确：需为 64 位十六进制字符串',
    'walletModal.pleaseEnterPrivateKey': '请输入私钥 Hex',
    
    // 担保组织详情页
    'groupDetail.title': '担保组织',
    'groupDetail.description': '查看您当前加入的担保组织详细信息',
    'groupDetail.orgDetails': '组织详情',
    'groupDetail.orgDetailsDesc': '您当前加入的担保组织信息',
    'groupDetail.joined': '已加入',
    'groupDetail.guarantorOrg': '担保组织',
    'groupDetail.leaveOrg': '退出担保组织',
    'groupDetail.backToMain': '返回主页',
    'groupDetail.notJoinedTitle': '您尚未加入担保组织',
    'groupDetail.notJoinedDesc': '加入担保组织可享受更安全的交易保障和专属福利服务，让您的数字资产交易更加安心无忧。',
    'groupDetail.joinNow': '立即加入',
  },
  'en': {
    // Common
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.back': 'Back',
    'common.confirm': 'Confirm',
    'common.loading': 'Loading...',
    'common.processing': 'Processing...',
    'common.success': 'Success',
    'common.error': 'Error',
    'common.warning': 'Warning',
    'common.info': 'Info',
    'common.notLoggedIn': 'Not Logged In',
    'common.logout': 'Log Out',
    'common.next': 'Continue',
    'common.regenerate': 'Regenerate',
    'common.expandMore': 'Show More',
    'common.collapseMore': 'Show Less',
    
    // Page Title
    'page.title': 'UTXO Wallet - Wallet Operations',
    
    // Header Menu
    'header.userInfo': 'User Info',
    'header.editProfile': 'Click to edit profile',
    'header.accountId': 'Account ID',
    'header.addressInfo': 'Addresses',
    'header.guarantorOrg': 'Guarantor Org',
    'header.balance': 'Balance',
    'header.exchangeRate': 'Rate: 1 PGC = 1 USDT, 1 BTC = 100 USDT, 1 ETH = 10 USDT',
    'header.notLoggedIn': 'Not Logged In',
    'header.loginHint': 'Please create or import an account',
    'header.addresses': '{count} addresses',
    'header.noOrg': 'Not joined any organization',
    
    // Welcome Page
    'welcome.badge': 'Secure · Fast · Decentralized',
    'welcome.titleLine1': 'Start Your',
    'welcome.titleLine2': 'Digital Asset Journey',
    'welcome.subtitle': 'Next-generation blockchain wallet based on UTXO model, providing secure and reliable asset management',
    'welcome.feature1.title': 'Security',
    'welcome.feature1.desc': 'Local encrypted storage, private keys never uploaded',
    'welcome.feature2.title': 'Fast Transfer',
    'welcome.feature2.desc': 'Optimized UTXO algorithm, instant confirmation',
    'welcome.feature3.title': 'Cross-Chain',
    'welcome.feature3.desc': 'Multi-chain asset support, all-in-one management',
    'welcome.getStarted': 'Get Started',
    'welcome.hasAccount': 'Have an account? Log in',
    'welcome.activeUsers': 'Active Users',
    'welcome.totalVolume': 'Total Volume',
    'welcome.security': 'Security',
    'welcome.cardHolder': 'Card Holder',
    'welcome.expiry': 'Expiry',
    
    // Wallet Management Page
    'entry.title': 'Wallet Management',
    'entry.description': 'Securely manage your digital assets with multi-address support',
    'entry.benefit1.title': 'Secure Encryption',
    'entry.benefit1.desc': 'High-strength encryption to protect your private keys',
    'entry.benefit2.title': 'Multi-Address',
    'entry.benefit2.desc': 'Manage multiple wallet addresses with easy switching',
    'entry.benefit3.title': 'Quick Import',
    'entry.benefit3.desc': 'Import existing wallets via private key',
    'entry.walletsAdded': 'Wallets Added',
    'entry.encryptionAlgo': 'Encryption',
    'entry.selectAction': 'Select Action',
    'entry.selectActionDesc': 'Create a new wallet or import an existing one to start your digital asset journey',
    'entry.createWallet': 'Create Wallet',
    'entry.createWalletDesc': 'Generate a new key pair',
    'entry.importWallet': 'Import Wallet',
    'entry.importWalletDesc': 'Import using existing private key',
    'entry.addWalletFirst': 'Please add at least one wallet address first',
    'entry.enterPrivateKeyHex': 'Please enter private key Hex',
    
    // Create Account Page
    'new.title': 'Create Account',
    'new.description': 'Securely generate P-256 ECDSA key pair to start your blockchain journey',
    'new.benefit1.title': 'Secure Key Generation',
    'new.benefit1.desc': 'Using P-256 elliptic curve algorithm',
    'new.benefit2.title': 'Local Storage',
    'new.benefit2.desc': 'Private keys stored only in your browser',
    'new.benefit3.title': 'Quick Add',
    'new.benefit3.desc': 'Add to wallet list immediately after generation',
    'new.ellipticCurve': 'Elliptic Curve',
    'new.signatureAlgo': 'Signature',
    'new.generateKeys': 'Generate Keys',
    'new.generateKeysDesc': 'The system will generate secure key pairs. Please keep your private key safe.',
    'new.generating': 'Generating Keys',
    'new.accountCreated': 'Account Created',
    'new.mainAddress': 'Main Address',
    'new.privateKey': 'Private Key (Hex)',
    'new.publicKey': 'Public Key (X / Y Hex)',
    'new.doNotShare': 'Do Not Share',
    'new.addWalletAddress': 'Add Wallet Address',
    
    // Login Page
    'login.title': 'Log In',
    'login.description': 'Securely log in with your private key to restore your account',
    'login.benefit1.title': 'Secure Verification',
    'login.benefit1.desc': 'Private key is verified locally only',
    'login.benefit2.title': 'Account Recovery',
    'login.benefit2.desc': 'Restore full account info via private key',
    'login.benefit3.title': 'Wallet Management',
    'login.benefit3.desc': 'Manage all wallet addresses after login',
    'login.dataStorage': 'Data Storage',
    'login.local': 'Local',
    'login.accountLogin': 'Account Login',
    'login.accountLoginDesc': 'Enter your private key to restore your account and access wallet management',
    'login.privateKeyHex': 'Private Key (Hex)',
    'login.enterPrivateKey': 'Enter your private key hex...',
    'login.secureLogin': 'Secure Login',
    'login.securityTip': 'Please enter your private key in a secure environment. Never share it with others.',
    'login.verifying': 'Verifying Identity',
    'login.success': 'Login Successful',
    'login.sensitiveInfo': 'Sensitive',
    'login.reLogin': 'Log In Again',
    'login.enterWallet': 'Enter Wallet',
    'login.verifyingAndRedirecting': 'Verification successful, redirecting...',
    'login.connectingNetwork': 'Connecting to Network',
    'login.establishingConnection': 'Establishing secure connection, verifying account information',
    'login.inquiringNetwork': 'Initiating network inquiry to determine account relationship, please wait',
    'login.stepInitialize': 'Initialize',
    'login.stepConnecting': 'Connecting',
    'login.stepVerifying': 'Verifying',
    
    // Import Wallet Page
    'import.title': 'Import Wallet',
    'import.description': 'Restore your wallet address via private key, securely and quickly',
    'import.benefit1.title': 'Local Security',
    'import.benefit1.desc': 'Private key stored locally, never uploaded',
    'import.benefit2.title': 'Wallet Recovery',
    'import.benefit2.desc': 'Quickly restore your wallet with private key',
    'import.benefit3.title': 'Key Compatible',
    'import.benefit3.desc': 'Supports multiple private key formats',
    'import.keyLength': 'Key Length',
    'import.importWallet': 'Import Wallet',
    'import.importWalletDesc': 'Enter your private key to restore wallet address and manage assets',
    'import.enterPrivateKey': 'Enter 64-character hex private key',
    'import.formatHint': 'Supports 0x prefix or plain 64-character hex format',
    'import.securityTip': 'Please enter your private key in a secure environment. It will only be stored locally.',
    'import.verifying': 'Verifying and importing',
    'import.success': 'Wallet Imported Successfully',
    'import.reImport': 'Re-import',
    
    // Footer
    'footer.text': 'Blockchain resonates with you. Infinity within your reach.',
    
    // Main Wallet Page
    'wallet.myWallet': 'My Wallet',
    'wallet.secureManagement': 'Secure digital asset management',
    'wallet.refresh': 'Refresh',
    'wallet.create': 'Create',
    'wallet.import': 'Import',
    'wallet.totalAssets': 'Total Assets',
    'wallet.addressManagement': 'Address Management',
    'wallet.addressCount': '{count} addresses',
    'wallet.transfer': 'Transfer',
    'wallet.fastTransfer': 'Fast and secure transfer experience',
    'wallet.download': 'Download',
    'wallet.upload': 'Upload',
    'wallet.latency': 'Latency',
    'wallet.quickTransfer': 'Quick Transfer',
    'wallet.crossChain': 'Cross-Chain',
    'wallet.pledge': 'Pledge',
    'wallet.normalTransfer': 'Normal Transfer',
    'wallet.from': 'From · FROM',
    'wallet.to': 'To · TO',
    'wallet.advancedOptions': 'Advanced Options',
    'wallet.extraGas': 'Extra Gas',
    'wallet.txGas': 'TX Gas',
    'wallet.addRecipient': 'Add Recipient',
    'wallet.send': 'Send Transaction',
    'wallet.addressListTip': 'Tip: Login account address is not included in the list',
    'wallet.noAddress': 'No addresses',
    'wallet.deleteAddress': 'Delete Address',
    'wallet.exportPrivateKey': 'Export Private Key',
    'wallet.deleteSuccess': 'Deleted Successfully',
    'wallet.deleteSuccessDesc': 'Address and related local data have been deleted',
    'wallet.exportFailed': 'Export Failed',
    'wallet.noPrivateKey': 'No private key available for this address',
    'wallet.copied': 'Copied!',
    'wallet.syncing': 'Syncing...',
    
    // Join Guarantee Organization Page
    'join.title': 'Join Guarantor Organization',
    'join.description': 'Get more stable transaction services and comprehensive account protection',
    'join.benefit1.title': 'Faster Confirmation',
    'join.benefit1.desc': 'Priority confirmation channel for faster transactions',
    'join.benefit2.title': 'Cross-Region Protection',
    'join.benefit2.desc': 'Multi-region protection mechanism for safer assets',
    'join.benefit3.title': 'Custom Addresses',
    'join.benefit3.desc': 'Support for custom address labels and management',
    'join.benefit4.title': 'Revenue Statistics',
    'join.benefit4.desc': 'Clear interest income and transaction analysis',
    'join.availability': 'Service Availability',
    'join.support247': '24/7 Support',
    'join.systemRecommend': 'Recommended',
    'join.searchOrg': 'Search',
    'join.recommended': 'Recommended',
    'join.bestMatch': 'Best Match for You',
    'join.bestMatchDesc': 'System has selected the best guarantor organization based on network conditions',
    'join.guarantorOrg': 'Guarantor Org',
    'join.joinThisOrg': 'Join This Organization',
    'join.searchGuarantorOrg': 'Search Guarantor Organization',
    'join.searchOrgDesc': 'Enter organization number to find specific guarantor',
    'join.enterOrgNumber': 'Enter organization number...',
    'join.startSearch': 'Enter organization number to start search',
    'join.skipJoin': 'Skip for Now',
    'join.joiningOrg': 'Joining organization...',
    'join.notJoined': 'Not Joined Organization',
    'join.notJoinedDesc': 'Join a guarantor organization for safer transaction protection and exclusive benefits',
    'join.notJoinedLongDesc': 'Join a guarantor organization for safer transaction protection and exclusive benefits, making your digital asset transactions more secure.',
    'join.confirmSkip': 'Confirm Skip Organization',
    'join.confirmSkipDesc': 'This is a warning action. Confirming will skip joining an organization and proceed to the next step.',
    'join.joined': 'Joined',
    'join.leavingOrg': 'Leaving organization...',
    
    // Transfer Form
    'transfer.recipientAddress': 'Recipient Address',
    'transfer.enterRecipientAddress': 'Enter recipient address',
    'transfer.amount': 'Amount',
    'transfer.currency': 'Currency',
    'transfer.publicKey': 'Public Key',
    'transfer.guarantorOrgId': 'Guarantor Org ID',
    'transfer.optional': 'Optional',
    'transfer.transferGas': 'Transfer Gas',
    'transfer.delete': 'Delete',
    'transfer.addRecipient': 'Add',
    'transfer.pgcReceiveAddress': 'PGC Change',
    'transfer.btcReceiveAddress': 'BTC Change',
    'transfer.ethReceiveAddress': 'ETH Change',
    'transfer.noAddressAvailable': 'No address available',
    'transfer.generateTxStruct': 'Generate Transaction Struct',
    'transfer.collapseInfo': 'Collapse Full Info',
    'transfer.showFullInfo': 'Show Full Info',
    'transfer.collapseStruct': 'Collapse Account Struct',
    'transfer.expandStruct': 'Expand Account Struct',
    'transfer.cannotDeleteLast': 'Cannot delete the last transfer',
    'transfer.collapseOptions': 'Collapse Options',
    
    // Modals and Alerts
    'modal.confirmSubAddress': 'Confirm Import Sub-Address',
    'modal.currentSubAddressCount': 'Current sub-addresses: {count}. Continue to next step?',
    'modal.cancel': 'Cancel',
    'modal.confirm': 'Confirm',
    'modal.addingWalletAddress': 'Adding wallet address...',
    'modal.walletAddSuccess': 'Wallet Added Successfully',
    'modal.walletAddSuccessDesc': 'A new wallet address has been added',
    'modal.ok': 'OK',
    'modal.inputError': 'Input Error',
    'modal.pleaseEnterPrivateKey': 'Please enter private key Hex',
    'modal.formatError': 'Format Error',
    'modal.privateKeyFormatError': 'Private key format incorrect: must be 64-character hex string',
    'modal.operationFailed': 'Operation Failed',
    'modal.pleaseLoginFirst': 'Please log in or register first',
    'modal.systemError': 'System Error',
    'modal.importFailed': 'Import failed: {error}',
    'modal.inputIncomplete': 'Input Incomplete',
    'modal.pleaseEnterPrivateKeyHex': 'Please enter your private key Hex string',
    'modal.privateKeyFormat64': 'Private key must be 64-character hex string (0x prefix optional)',
    'modal.loginFailed': 'Login Failed',
    'modal.cannotRecognizeKey': 'Cannot recognize this private key, please check your input',
    'modal.enteringWalletPage': 'Entering wallet creation or import page...',
    'modal.newAddress': 'New',
    'modal.leaveOrgTitle': 'Leave Organization',
    'modal.leaveOrgDesc': 'Leaving will clear local organization info and set account as not joined. Continue?',
    
    // Profile Page
    'profile.title': 'Profile',
    'profile.description': 'Manage your avatar and nickname to create your unique identity',
    'profile.settings.title': 'Profile Settings',
    'profile.settings.description': 'Customize your avatar, nickname, and bio to personalize your account',
    'profile.avatar.title': 'Avatar',
    'profile.avatar.hint': 'Supports JPG, PNG, GIF, WebP formats. Recommended size: 200x200 pixels',
    'profile.avatar.upload': 'Upload Image',
    'profile.avatar.remove': 'Remove Avatar',
    'profile.avatar.preview': 'Avatar Preview',
    'profile.nickname.title': 'Nickname',
    'profile.nickname.placeholder': 'Enter your nickname',
    'profile.nickname.hint': 'Your nickname will be displayed throughout the interface. Max 20 characters.',
    'profile.signature.title': 'Bio',
    'profile.signature.placeholder': 'Tell us about yourself...',
    'profile.signature.hint': 'Your bio will be displayed below your profile info. Max 50 characters.',
    'profile.language.title': 'Language',
    'profile.language.hint': 'Select your preferred interface language',
    'profile.action.cancel': 'Cancel',
    'profile.action.save': 'Save Changes',
    'profile.action.saved': 'Saved',
    'profile.tip.localStorage': 'Avatar is stored locally in your browser',
    'profile.tip.squareImage': 'Square images are recommended',
    
    // Toast Messages
    'toast.profile.saved': 'Profile saved successfully',
    'toast.profile.saveTitle': 'Saved',
    'toast.avatar.formatError': 'Please select a JPG, PNG, GIF, or WebP image',
    'toast.avatar.sizeError': 'Image size cannot exceed 5MB. Current size: {size}MB',
    'toast.language.changed': 'Language changed',
    'toast.account.created': 'Account created successfully! Keys generated securely.',
    'toast.account.createTitle': 'Created',
    'toast.login.success': 'Login successful',
    'toast.login.successDesc': 'Account information restored successfully',
    'toast.login.failed': 'Login failed',
    'toast.copied': 'Copied to clipboard',
    'toast.copyFailed': 'Copy failed',
    'toast.leftOrg': 'Left Organization',
    'toast.leftOrgDesc': 'Account has left the guarantor organization. You can rejoin later.',
    'toast.addressOptimized': 'Source Addresses Optimized',
    'toast.buildingTx': 'Building transaction...',
    'toast.buildTxSuccess': 'Transaction Built Successfully',
    'toast.buildTxSuccessDesc': 'Transaction structure created successfully. Click below to view details.',
    'toast.buildTxFailed': 'Build Failed',
    'toast.importFailed': 'Import Failed',
    'toast.cannotParseAddress': 'Cannot parse address',
    'toast.addressExists': 'Address already exists, cannot import duplicate',
    
    // Validation Messages
    'validation.nickname.empty': 'Nickname cannot be empty',
    'validation.nickname.tooLong': 'Nickname cannot exceed 20 characters',
    'validation.signature.tooLong': 'Bio cannot exceed 50 characters',
    
    // Address Details
    'address.fullAddress': 'Full Address',
    'address.balance': 'Balance',
    'address.add': 'Add',
    'address.clear': 'Clear',
    'address.confirmDelete': 'Confirm delete address',
    'address.confirmDeleteDesc': 'and its local data?',
    'address.deleteConfirm': 'Confirm',
    'address.deleteCancel': 'Cancel',
    
    // Loading Stages
    'loading.initializing': 'Initializing',
    'loading.initializingDesc': 'Preparing connection components...',
    'loading.connecting': 'Connecting to Network',
    'loading.connectingDesc': 'Establishing secure connection, verifying account information',
    'loading.verifying': 'Verifying Account',
    'loading.verifyingDesc': 'Validating account information and organization relationship...',
    'loading.success': 'Connection Successful',
    'loading.successDesc': 'Account verified, entering system',
    
    // Transaction Validation Errors
    'tx.addressEmpty': 'Address is empty',
    'tx.insufficientBalance': 'Insufficient balance',
    'tx.addressNotSelected': 'Address not selected',
    'tx.addressError': 'Address error',
    'tx.missingTransferInfo': 'Transfer information missing',
    'tx.crossChainLimit': 'Cross-chain transaction limit',
    'tx.changeAddressMissing': 'Change address missing',
    'tx.changeAddressError': 'Change address error',
    'tx.incompleteInfo': 'Incomplete transaction info',
    'tx.addressFormatError': 'Address format error',
    'tx.addressFormatErrorDesc': 'Target address format error: must be 40-character hex string',
    'tx.currencyError': 'Currency error',
    'tx.orgIdFormatError': 'Organization ID format error',
    'tx.publicKeyFormatError': 'Public key format error',
    'tx.amountError': 'Amount error',
    'tx.gasParamError': 'Gas parameter error',
    'tx.duplicateAddress': 'Duplicate address',
    'tx.addressNotFound': 'Address information not found',
    'tx.queryFailed': 'Query failed, please try again later',
    
    // Wallet Address Modal
    'walletModal.createAddress': 'Create Address',
    'walletModal.importAddress': 'Import Address',
    'walletModal.createConfirm': 'Confirm to create a new sub-address and add it to the current account.',
    'walletModal.privateKeyLabel': 'Private Key (Hex)',
    'walletModal.privateKeyDoNotShare': 'Private Key (Do Not Share)',
    'walletModal.privateKeyFormatError': 'Private key format incorrect: must be 64-character hex string',
    'walletModal.pleaseEnterPrivateKey': 'Please enter private key Hex',
    
    // Guarantor Organization Detail Page
    'groupDetail.title': 'Guarantor Organization',
    'groupDetail.description': 'View detailed information about your current guarantor organization',
    'groupDetail.orgDetails': 'Organization Details',
    'groupDetail.orgDetailsDesc': 'Information about your current guarantor organization',
    'groupDetail.joined': 'Joined',
    'groupDetail.guarantorOrg': 'Guarantor Org',
    'groupDetail.leaveOrg': 'Leave Organization',
    'groupDetail.backToMain': 'Back to Main',
    'groupDetail.notJoinedTitle': 'You Have Not Joined Any Organization',
    'groupDetail.notJoinedDesc': 'Join a guarantor organization for safer transaction protection and exclusive benefits, making your digital asset transactions more secure.',
    'groupDetail.joinNow': 'Join Now',
  }
};

// 当前语言
let currentLanguage = 'zh-CN';

/**
 * 获取当前语言
 */
function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * 加载保存的语言设置
 */
function loadLanguageSetting() {
  try {
    const saved = localStorage.getItem(I18N_STORAGE_KEY);
    if (saved && translations[saved]) {
      currentLanguage = saved;
    }
  } catch (e) {
    console.warn('加载语言设置失败', e);
  }
  return currentLanguage;
}

/**
 * 保存语言设置
 */
function saveLanguageSetting(lang) {
  try {
    localStorage.setItem(I18N_STORAGE_KEY, lang);
  } catch (e) {
    console.warn('保存语言设置失败', e);
  }
}

/**
 * 设置当前语言
 */
function setLanguage(lang) {
  if (!translations[lang]) {
    console.warn('不支持的语言:', lang);
    return false;
  }
  currentLanguage = lang;
  saveLanguageSetting(lang);
  updatePageTranslations();
  return true;
}

/**
 * 获取翻译文本
 * @param {string} key - 翻译键
 * @param {object} params - 替换参数 (可选)
 */
function t(key, params = {}) {
  const dict = translations[currentLanguage] || translations['zh-CN'];
  let text = dict[key] || translations['zh-CN'][key] || key;
  
  // 替换参数 {param}
  Object.keys(params).forEach(param => {
    text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
  });
  
  return text;
}

/**
 * 更新页面上所有带有 data-i18n 属性的元素
 */
function updatePageTranslations() {
  // 更新所有带 data-i18n 属性的元素
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });
  
  // 更新所有带 data-i18n-placeholder 属性的输入框
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = t(key);
    }
  });
  
  // 更新所有带 data-i18n-title 属性的元素
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.title = t(key);
      // Also update data-tooltip if it exists (for tooltip display)
      if (el.hasAttribute('data-tooltip')) {
        el.setAttribute('data-tooltip', t(key));
      }
    }
  });
  
  // 更新动态生成的收款人卡片中的文本
  document.querySelectorAll('.recipient-card').forEach(card => {
    // 更新字段标签
    const labels = card.querySelectorAll('.recipient-field-label');
    if (labels.length >= 5) {
      labels[0].textContent = t('transfer.recipientAddress');
      labels[1].textContent = t('transfer.amount');
      labels[2].textContent = t('transfer.currency');
      labels[3].textContent = t('transfer.publicKey');
      labels[4].textContent = t('transfer.guarantorOrgId');
      if (labels[5]) labels[5].textContent = t('transfer.transferGas');
    }
    
    // 更新按钮文本
    const expandBtn = card.querySelector('[data-role="expand"] span');
    if (expandBtn) {
      const isExpanded = card.querySelector('.recipient-details')?.classList.contains('expanded');
      expandBtn.textContent = isExpanded ? t('transfer.collapseOptions') : t('wallet.advancedOptions');
    }
    
    const removeBtn = card.querySelector('[data-role="remove"] span');
    if (removeBtn) removeBtn.textContent = t('transfer.delete');
    
    const addBtn = card.querySelector('[data-role="add"] span');
    if (addBtn) addBtn.textContent = t('transfer.addRecipient');
    
    // 更新placeholder
    const addrInput = card.querySelector('[data-name="to"]');
    if (addrInput) addrInput.placeholder = t('transfer.enterRecipientAddress');
    
    const gidInput = card.querySelector('[data-name="gid"]');
    if (gidInput) gidInput.placeholder = t('transfer.optional');
  });
  
  // 更新地址选择下拉框中的"无可用地址"文本
  document.querySelectorAll('.custom-select__item.disabled').forEach(item => {
    if (item.textContent.includes('无可用地址') || item.textContent.includes('No address available')) {
      item.textContent = t('transfer.noAddressAvailable');
    }
  });
  
  // 更新语言选择器的显示状态
  updateLanguageSelectorUI();
}

/**
 * 更新语言选择器UI
 */
function updateLanguageSelectorUI() {
  const selector = document.getElementById('languageSelector');
  if (!selector) return;
  
  const options = selector.querySelectorAll('.language-option');
  options.forEach(opt => {
    const lang = opt.getAttribute('data-lang');
    if (lang === currentLanguage) {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });
}

// 初始化语言设置
loadLanguageSetting();

// ========================================
// 自定义 Toast 提示组件
// ========================================
function showToast(message, type = 'info', title = '', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  // 根据类型设置默认标题
  const defaultTitles = {
    error: t('common.error'),
    success: t('common.success'),
    warning: t('common.warning'),
    info: t('common.info')
  };

  // 根据类型设置图标
  const icons = {
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <p class="toast-title">${title || defaultTitles[type] || t('common.info')}</p>
      <p class="toast-message">${message}</p>
    </div>
    <button class="toast-close" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  // 关闭按钮事件
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);

  // 自动移除
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }

  return toast;
}

function removeToast(toast) {
  if (!toast || toast.classList.contains('toast--exiting')) return;
  toast.classList.add('toast--exiting');
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}

// 便捷方法
const showErrorToast = (message, title = '') => showToast(message, 'error', title);
const showSuccessToast = (message, title = '') => showToast(message, 'success', title);
const showWarningToast = (message, title = '') => showToast(message, 'warning', title);
const showInfoToast = (message, title = '') => showToast(message, 'info', title);

const base64urlToBytes = (b64url) => {
  // 转换 base64url -> base64
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
  const str = atob(b64 + pad);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
};

const bytesToBase64url = (bytes) => {
  // 转换 bytes -> base64url
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  // 转换 base64 -> base64url (移除填充并替换字符)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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
    // 如果 basic.wallet.addressMsg 是显式提供的对象，直接使用它（支持删除操作）
    if (basic.wallet.addressMsg !== undefined) {
      acc.wallet.addressMsg = { ...basic.wallet.addressMsg };
    }
    if (basic.wallet.valueDivision) acc.wallet.valueDivision = { ...basic.wallet.valueDivision };
    if (basic.wallet.totalValue !== undefined) acc.wallet.totalValue = basic.wallet.totalValue;
    if (basic.wallet.TotalValue !== undefined) acc.wallet.TotalValue = basic.wallet.TotalValue;
    if (basic.wallet.history) acc.wallet.history = [...basic.wallet.history];
  }
  return acc;
}

// Mini Toast 提示函数
function showMiniToast(message, type = 'info') {
  // 移除已存在的toast
  const existing = document.querySelector('.mini-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `mini-toast mini-toast--${type}`;
  toast.innerHTML = `
    <span class="mini-toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="mini-toast-text">${message}</span>
  `;
  document.body.appendChild(toast);
  
  // 触发动画
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // 1.5秒后消失
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 1500);
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
  const menuAddrEl = document.getElementById('menuAddress');
  const menuAddressItem = document.getElementById('menuAddressItem');
  const menuAccountItem = document.getElementById('menuAccountItem');
  const menuAccountIdEl = document.getElementById('menuAccountId');
  const menuOrgItem = document.getElementById('menuOrgItem');
  const menuBalanceItem = document.getElementById('menuBalanceItem');
  const menuOrgEl = document.getElementById('menuOrg');
  const menuBalanceEl = document.getElementById('menuBalance');
  const menuAddrPopup = document.getElementById('menuAddressPopup');
  const menuAddrList = document.getElementById('menuAddressList');
  const menuBalancePopup = document.getElementById('menuBalancePopup');
  const menuBalancePGC = document.getElementById('menuBalancePGC');
  const menuBalanceBTC = document.getElementById('menuBalanceBTC');
  const menuBalanceETH = document.getElementById('menuBalanceETH');
  const menuEmpty = document.getElementById('menuEmpty');
  const logoutEl = document.getElementById('logoutBtn');
  const menuHeader = document.querySelector('.menu-header');
  const menuCards = document.querySelector('.menu-cards');
  const menuHeaderAvatar = document.getElementById('menuHeaderAvatar');
  if (!labelEl || !avatarEl) return; // header 不存在时忽略
  if (user && user.accountId) {
    // 显示用户昵称
    const profile = loadUserProfile();
    labelEl.textContent = profile.nickname || 'Amiya';
    // 更新菜单头部标题
    const menuHeaderTitleEl = document.getElementById('menuHeaderTitle');
    if (menuHeaderTitleEl) {
      menuHeaderTitleEl.textContent = profile.nickname || 'Amiya';
    }
    // 登录后显示自定义头像
    avatarEl.classList.add('avatar--active');
    if (menuHeaderAvatar) menuHeaderAvatar.classList.add('avatar--active');
    
    // 更新头像显示
    const avatarImg = avatarEl.querySelector('.avatar-img');
    const menuAvatarImg = menuHeaderAvatar?.querySelector('.avatar-img');
    if (profile.avatar) {
      if (avatarImg) {
        avatarImg.src = profile.avatar;
        avatarImg.classList.remove('hidden');
      }
      if (menuAvatarImg) {
        menuAvatarImg.src = profile.avatar;
        menuAvatarImg.classList.remove('hidden');
      }
    } else {
      // 使用默认头像
      if (avatarImg) {
        avatarImg.src = '/assets/avatar.png';
        avatarImg.classList.remove('hidden');
      }
      if (menuAvatarImg) {
        menuAvatarImg.src = '/assets/avatar.png';
        menuAvatarImg.classList.remove('hidden');
      }
    }
    
    // 显示头部和卡片区
    if (menuHeader) menuHeader.classList.remove('hidden');
    if (menuCards) menuCards.classList.remove('hidden');
    // 显示 Account ID 卡片
    if (menuAccountItem) menuAccountItem.classList.remove('hidden');
    if (menuAccountIdEl) menuAccountIdEl.textContent = user.accountId;
    if (menuAddressItem) menuAddressItem.classList.remove('hidden');
    const mainAddr = user.address || (user.wallet && Object.keys(user.wallet.addressMsg || {})[0]) || '';
    const subMap = (user.wallet && user.wallet.addressMsg) || {};
    const addrCount = Object.keys(subMap).length;
    if (menuAddrEl) menuAddrEl.textContent = t('header.addresses', { count: addrCount });
    if (menuAddrPopup) menuAddrPopup.classList.add('hidden');
    if (menuOrgItem) menuOrgItem.classList.remove('hidden');
    if (menuBalanceItem) menuBalanceItem.classList.remove('hidden');
    if (menuOrgEl) menuOrgEl.textContent = computeCurrentOrgId() || t('header.noOrg');
    
    // 计算各币种余额
    const vd = (user.wallet && user.wallet.valueDivision) || { 0: 0, 1: 0, 2: 0 };
    const pgc = Number(vd[0] || 0);
    const btc = Number(vd[1] || 0);
    const eth = Number(vd[2] || 0);
    const totalUsdt = Math.round(pgc * 1 + btc * 100 + eth * 10);
    
    if (menuBalanceEl) menuBalanceEl.textContent = totalUsdt + ' USDT';
    if (menuBalancePGC) menuBalancePGC.textContent = pgc;
    if (menuBalanceBTC) menuBalanceBTC.textContent = btc;
    if (menuBalanceETH) menuBalanceETH.textContent = eth;
    if (menuBalancePopup) menuBalancePopup.classList.add('hidden');
    
    if (menuOrgEl) menuOrgEl.classList.remove('code-waiting');
    if (menuEmpty) menuEmpty.classList.add('hidden');
    if (logoutEl) {
      logoutEl.disabled = false;
      logoutEl.classList.remove('hidden');
    }
  } else {
    labelEl.textContent = t('common.notLoggedIn');
    // 未登录时移除头像激活状态，确保显示默认人形图标
    avatarEl.classList.remove('avatar--active');
    if (menuHeaderAvatar) menuHeaderAvatar.classList.remove('avatar--active');
    
    // 确保头像图片隐藏，显示默认人形图标
    const avatarImg = avatarEl.querySelector('.avatar-img');
    const menuAvatarImg = menuHeaderAvatar?.querySelector('.avatar-img');
    if (avatarImg) avatarImg.classList.add('hidden');
    if (menuAvatarImg) menuAvatarImg.classList.add('hidden');
    
    // 隐藏头部和卡片区
    if (menuHeader) menuHeader.classList.add('hidden');
    if (menuCards) menuCards.classList.add('hidden');
    if (menuAccountItem) menuAccountItem.classList.add('hidden');
    if (menuAccountIdEl) menuAccountIdEl.textContent = '';
    if (menuAddressItem) menuAddressItem.classList.add('hidden');
    if (menuAddrEl) menuAddrEl.textContent = '';
    if (menuOrgItem) menuOrgItem.classList.add('hidden');
    if (menuBalanceItem) menuBalanceItem.classList.add('hidden');
    if (menuOrgEl) menuOrgEl.textContent = '';
    if (menuBalanceEl) menuBalanceEl.textContent = '';
    if (menuBalancePGC) menuBalancePGC.textContent = '0';
    if (menuBalanceBTC) menuBalanceBTC.textContent = '0';
    if (menuBalanceETH) menuBalanceETH.textContent = '0';
    if (menuBalancePopup) menuBalancePopup.classList.add('hidden');
    if (menuOrgEl) menuOrgEl.classList.add('code-waiting');
    if (menuEmpty) menuEmpty.classList.remove('hidden');
    if (logoutEl) {
      logoutEl.disabled = true;
      logoutEl.classList.add('hidden');
    }
    if (menuAddrList) menuAddrList.innerHTML = '';
    if (menuAddrPopup) menuAddrPopup.classList.add('hidden');
  }
  // 地址点击事件绑定
  if (menuAddressItem && !menuAddressItem.dataset._bind) {
    menuAddressItem.addEventListener('click', (e) => {
      e.stopPropagation();
      // 关闭余额弹窗
      const balancePopup = document.getElementById('menuBalancePopup');
      if (balancePopup) balancePopup.classList.add('hidden');
      
      const u = loadUser();
      const popup = document.getElementById('menuAddressPopup');
      const list = document.getElementById('menuAddressList');
      if (!popup || !list) return;
      const map = (u && u.wallet && u.wallet.addressMsg) || {};
      let html = `<div class="tip" style="margin:2px 0 6px;color:#667085;">${t('wallet.addressListTip')}</div>`;
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
      if (Object.keys(map).length === 0) html += `<div class="tip">${t('wallet.noAddress')}</div>`;
      list.innerHTML = html;
      popup.classList.toggle('hidden');
    });
    const popup = document.getElementById('menuAddressPopup');
    if (popup) popup.addEventListener('click', (e) => e.stopPropagation());
    menuAddressItem.dataset._bind = '1';
  }
  // 余额点击事件绑定
  if (menuBalanceItem && !menuBalanceItem.dataset._bind) {
    menuBalanceItem.addEventListener('click', (e) => {
      e.stopPropagation();
      // 关闭地址弹窗
      const addrPopup = document.getElementById('menuAddressPopup');
      if (addrPopup) addrPopup.classList.add('hidden');
      
      const popup = document.getElementById('menuBalancePopup');
      if (popup) popup.classList.toggle('hidden');
    });
    const popup = document.getElementById('menuBalancePopup');
    if (popup) popup.addEventListener('click', (e) => e.stopPropagation());
    menuBalanceItem.dataset._bind = '1';
  }
  // 担保组织点击事件绑定 - 跳转到组织详情页
  if (menuOrgItem && !menuOrgItem.dataset._bind) {
    menuOrgItem.addEventListener('click', (e) => {
      e.stopPropagation();
      // 关闭用户菜单
      const userMenu = document.getElementById('userMenu');
      if (userMenu) userMenu.classList.add('hidden');
      // 跳转到组织详情页
      routeTo('#/group-detail');
    });
    menuOrgItem.dataset._bind = '1';
  }
  // 菜单头部点击事件绑定 - 跳转到个人信息页
  if (menuHeader && !menuHeader.dataset._bind) {
    menuHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      // 关闭用户菜单
      const userMenu = document.getElementById('userMenu');
      if (userMenu) userMenu.classList.add('hidden');
      // 跳转到个人信息页
      routeTo('#/profile');
    });
    menuHeader.style.cursor = 'pointer';
    menuHeader.dataset._bind = '1';
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

// ============================================
// 个人信息页面功能
// ============================================

const PROFILE_STORAGE_KEY = 'userProfile';

/**
 * 加载用户个人信息（头像、昵称和个性签名）
 */
function loadUserProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('加载用户个人信息失败', e);
  }
  return { nickname: 'Amiya', avatar: null, signature: '这个人很懒，还没有修改这里。' };
}

/**
 * 保存用户个人信息
 */
function saveUserProfile(profile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    // 更新界面显示
    updateProfileDisplay();
  } catch (e) {
    console.warn('保存用户个人信息失败', e);
  }
}

/**
 * 更新所有界面上的用户信息显示
 */
function updateProfileDisplay() {
  const profile = loadUserProfile();
  const nickname = profile.nickname || 'Amiya';
  const avatar = profile.avatar;
  const signature = profile.signature || '这个人很懒，还没有修改这里。';
  
  // 更新顶部导航栏
  const userLabel = document.getElementById('userLabel');
  if (userLabel) {
    const u = loadUser();
    if (u && u.accountId) {
      userLabel.textContent = nickname;
    }
  }
  
  // 更新菜单头部标题
  const menuHeaderTitle = document.getElementById('menuHeaderTitle');
  if (menuHeaderTitle) {
    menuHeaderTitle.textContent = nickname;
  }
  
  // 更新菜单头部签名
  const menuHeaderSub = document.getElementById('menuHeaderSub');
  if (menuHeaderSub) {
    menuHeaderSub.textContent = signature;
  }
  
  // 更新所有头像
  const avatarTargets = [
    { container: document.getElementById('userAvatar'), img: document.querySelector('#userAvatar .avatar-img') },
    { container: document.getElementById('menuHeaderAvatar'), img: document.querySelector('#menuHeaderAvatar .avatar-img') }
  ];
  
  // 首先检查用户是否已登录
  const u = loadUser();
  const isLoggedIn = u && u.accountId;
  
  avatarTargets.forEach(({ container, img }) => {
    if (!container || !img) return;
    
    if (!isLoggedIn) {
      // 未登录状态：隐藏头像图片，移除激活状态
      img.classList.add('hidden');
      container.classList.remove('avatar--active');
    } else if (avatar) {
      // 已登录且有自定义头像
      img.src = avatar;
      img.classList.remove('hidden');
      container.classList.add('avatar--active');
    } else {
      // 已登录但无自定义头像，显示默认头像
      container.classList.add('avatar--active');
      img.src = '/assets/avatar.png';
      img.classList.remove('hidden');
    }
  });
}

/**
 * 初始化个人信息页面
 */
function initProfilePage() {
  const profile = loadUserProfile();
  const user = loadUser();
  
  // 填充当前数据
  const nicknameInput = document.getElementById('nicknameInput');
  const nicknameCharCount = document.getElementById('nicknameCharCount');
  const profileDisplayName = document.getElementById('profileDisplayName');
  const profileAccountId = document.getElementById('profileAccountId');
  const avatarPreviewImg = document.getElementById('avatarPreviewImg');
  const avatarUploadPreview = document.getElementById('avatarUploadPreview');
  const profileAvatarPreview = document.getElementById('profileAvatarPreview');
  const profileAvatarLarge = document.getElementById('profileAvatarLarge');
  
  // 设置昵称
  if (nicknameInput) {
    nicknameInput.value = profile.nickname || 'Amiya';
    updateCharCount();
  }
  
  // 设置签名
  const signatureInput = document.getElementById('signatureInput');
  const signatureCharCount = document.getElementById('signatureCharCount');
  if (signatureInput) {
    signatureInput.value = profile.signature || '这个人很懒，还没有修改这里。';
    updateSignatureCharCount();
  }
  
  // 设置显示名称
  if (profileDisplayName) {
    profileDisplayName.textContent = profile.nickname || 'Amiya';
  }
  
  // 设置Account ID
  if (profileAccountId && user) {
    profileAccountId.textContent = user.accountId || 'Account ID';
  }
  
  // 设置头像预览 - 优先使用自定义头像，其次使用默认头像
  const avatarSrc = profile.avatar || '/assets/avatar.png';
  const hasCustomAvatar = !!profile.avatar;
  
  // 检查默认头像是否存在（通过检测用户是否已登录）
  const hasDefaultAvatar = user && user.accountId;
  
  if (hasCustomAvatar || hasDefaultAvatar) {
    if (avatarPreviewImg) {
      avatarPreviewImg.src = avatarSrc;
      avatarPreviewImg.classList.remove('hidden');
      const placeholder = avatarUploadPreview?.querySelector('.preview-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
    }
    if (profileAvatarPreview) {
      profileAvatarPreview.src = avatarSrc;
      profileAvatarPreview.classList.remove('hidden');
      const placeholder = profileAvatarLarge?.querySelector('.avatar-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
    }
  } else {
    if (avatarPreviewImg) {
      avatarPreviewImg.classList.add('hidden');
      const placeholder = avatarUploadPreview?.querySelector('.preview-placeholder');
      if (placeholder) placeholder.classList.remove('hidden');
    }
    if (profileAvatarPreview) {
      profileAvatarPreview.classList.add('hidden');
      const placeholder = profileAvatarLarge?.querySelector('.avatar-placeholder');
      if (placeholder) placeholder.classList.remove('hidden');
    }
  }
  
  // 绑定事件（只绑定一次）
  bindProfileEvents();
  
  // 初始化语言选择器状态
  updateLanguageSelectorUI();
}

/**
 * 更新昵称字符计数
 */
function updateCharCount() {
  const nicknameInput = document.getElementById('nicknameInput');
  const nicknameCharCount = document.getElementById('nicknameCharCount');
  if (nicknameInput && nicknameCharCount) {
    const len = nicknameInput.value.length;
    nicknameCharCount.textContent = `${len}/20`;
  }
}

/**
 * 更新签名字符计数
 */
function updateSignatureCharCount() {
  const signatureInput = document.getElementById('signatureInput');
  const signatureCharCount = document.getElementById('signatureCharCount');
  if (signatureInput && signatureCharCount) {
    const len = signatureInput.value.length;
    signatureCharCount.textContent = `${len}/50`;
  }
}

/**
 * 绑定个人信息页面事件
 */
function bindProfileEvents() {
  // 返回按钮
  const profileBackBtn = document.getElementById('profileBackBtn');
  if (profileBackBtn && !profileBackBtn.dataset._bind) {
    profileBackBtn.addEventListener('click', () => {
      routeTo('#/main');
    });
    profileBackBtn.dataset._bind = '1';
  }
  
  // 取消按钮
  const profileCancelBtn = document.getElementById('profileCancelBtn');
  if (profileCancelBtn && !profileCancelBtn.dataset._bind) {
    profileCancelBtn.addEventListener('click', () => {
      routeTo('#/main');
    });
    profileCancelBtn.dataset._bind = '1';
  }
  
  // 昵称输入框
  const nicknameInput = document.getElementById('nicknameInput');
  if (nicknameInput && !nicknameInput.dataset._bind) {
    nicknameInput.addEventListener('input', () => {
      updateCharCount();
      // 实时更新左侧预览
      const profileDisplayName = document.getElementById('profileDisplayName');
      if (profileDisplayName) {
        profileDisplayName.textContent = nicknameInput.value || 'Amiya';
      }
    });
    nicknameInput.dataset._bind = '1';
  }
  
  // 签名输入框
  const signatureInput = document.getElementById('signatureInput');
  if (signatureInput && !signatureInput.dataset._bind) {
    signatureInput.addEventListener('input', () => {
      updateSignatureCharCount();
    });
    signatureInput.dataset._bind = '1';
  }
  
  // 头像上传按钮
  const avatarUploadBtn = document.getElementById('avatarUploadBtn');
  const avatarFileInput = document.getElementById('avatarFileInput');
  if (avatarUploadBtn && avatarFileInput && !avatarUploadBtn.dataset._bind) {
    avatarUploadBtn.addEventListener('click', () => {
      avatarFileInput.click();
    });
    avatarUploadBtn.dataset._bind = '1';
  }
  
  // 头像文件选择
  if (avatarFileInput && !avatarFileInput.dataset._bind) {
    avatarFileInput.addEventListener('change', handleAvatarFileSelect);
    avatarFileInput.dataset._bind = '1';
  }
  
  // 移除头像按钮
  const avatarRemoveBtn = document.getElementById('avatarRemoveBtn');
  if (avatarRemoveBtn && !avatarRemoveBtn.dataset._bind) {
    avatarRemoveBtn.addEventListener('click', handleAvatarRemove);
    avatarRemoveBtn.dataset._bind = '1';
  }
  
  // 保存按钮
  const profileSaveBtn = document.getElementById('profileSaveBtn');
  if (profileSaveBtn && !profileSaveBtn.dataset._bind) {
    profileSaveBtn.addEventListener('click', handleProfileSave);
    profileSaveBtn.dataset._bind = '1';
  }
  
  // 语言选择器
  const languageSelector = document.getElementById('languageSelector');
  if (languageSelector && !languageSelector.dataset._bind) {
    const options = languageSelector.querySelectorAll('.language-option');
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        const lang = opt.getAttribute('data-lang');
        if (lang && lang !== getCurrentLanguage()) {
          setLanguage(lang);
          showSuccessToast(t('toast.language.changed'), t('common.success'));
        }
      });
    });
    languageSelector.dataset._bind = '1';
  }
  
  // 更新语言选择器UI状态
  updateLanguageSelectorUI();
  
  // 更新页面翻译
  updatePageTranslations();
}

/**
 * 处理头像文件选择
 */
function handleAvatarFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // 验证文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showErrorToast(t('toast.avatar.formatError'));
    return;
  }
  
  // 验证文件大小（最大 5MB，因为会压缩）
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    showErrorToast(t('toast.avatar.sizeError', { size: (file.size / 1024 / 1024).toFixed(2) }));
    return;
  }
  
  // 读取并预览
  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target.result;
    
    // 压缩图片
    compressImage(dataUrl, 200, 200, 0.8, (compressedUrl) => {
      // 更新预览
      updateAvatarPreview(compressedUrl);
      
      // 临时存储到页面数据
      const avatarFileInput = document.getElementById('avatarFileInput');
      if (avatarFileInput) {
        avatarFileInput.dataset.pendingAvatar = compressedUrl;
      }
    });
  };
  reader.readAsDataURL(file);
}

/**
 * 压缩图片
 */
function compressImage(dataUrl, maxWidth, maxHeight, quality, callback) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    
    // 计算缩放比例
    if (width > height) {
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.src = dataUrl;
}

/**
 * 更新头像预览
 */
function updateAvatarPreview(avatarUrl) {
  // 更新右侧小预览
  const avatarPreviewImg = document.getElementById('avatarPreviewImg');
  const avatarUploadPreview = document.getElementById('avatarUploadPreview');
  if (avatarPreviewImg && avatarUploadPreview) {
    avatarPreviewImg.src = avatarUrl;
    avatarPreviewImg.classList.remove('hidden');
    const placeholder = avatarUploadPreview.querySelector('.preview-placeholder');
    if (placeholder) placeholder.classList.add('hidden');
  }
  
  // 更新左侧大预览
  const profileAvatarPreview = document.getElementById('profileAvatarPreview');
  const profileAvatarLarge = document.getElementById('profileAvatarLarge');
  if (profileAvatarPreview && profileAvatarLarge) {
    profileAvatarPreview.src = avatarUrl;
    profileAvatarPreview.classList.remove('hidden');
    const placeholder = profileAvatarLarge.querySelector('.avatar-placeholder');
    if (placeholder) placeholder.classList.add('hidden');
  }
}

/**
 * 处理移除头像
 */
function handleAvatarRemove() {
  // 清除预览
  const avatarPreviewImg = document.getElementById('avatarPreviewImg');
  const avatarUploadPreview = document.getElementById('avatarUploadPreview');
  if (avatarPreviewImg && avatarUploadPreview) {
    avatarPreviewImg.src = '';
    avatarPreviewImg.classList.add('hidden');
    const placeholder = avatarUploadPreview.querySelector('.preview-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');
  }
  
  // 清除左侧预览
  const profileAvatarPreview = document.getElementById('profileAvatarPreview');
  const profileAvatarLarge = document.getElementById('profileAvatarLarge');
  if (profileAvatarPreview && profileAvatarLarge) {
    profileAvatarPreview.src = '';
    profileAvatarPreview.classList.add('hidden');
    const placeholder = profileAvatarLarge.querySelector('.avatar-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');
  }
  
  // 清除待保存的头像
  const avatarFileInput = document.getElementById('avatarFileInput');
  if (avatarFileInput) {
    avatarFileInput.value = '';
    avatarFileInput.dataset.pendingAvatar = '';
    avatarFileInput.dataset.removeAvatar = '1';
  }
}

/**
 * 处理保存个人信息
 */
function handleProfileSave() {
  const nicknameInput = document.getElementById('nicknameInput');
  const signatureInput = document.getElementById('signatureInput');
  const avatarFileInput = document.getElementById('avatarFileInput');
  const profileSaveBtn = document.getElementById('profileSaveBtn');
  
  const nickname = nicknameInput?.value?.trim() || 'Amiya';
  const signature = signatureInput?.value?.trim() || t('profile.signature.placeholder');
  const pendingAvatar = avatarFileInput?.dataset.pendingAvatar || null;
  const removeAvatar = avatarFileInput?.dataset.removeAvatar === '1';
  
  // 验证昵称
  if (nickname.length === 0) {
    showErrorToast(t('validation.nickname.empty'));
    return;
  }
  if (nickname.length > 20) {
    showErrorToast(t('validation.nickname.tooLong'));
    return;
  }
  
  // 验证签名
  if (signature.length > 50) {
    showErrorToast(t('validation.signature.tooLong'));
    return;
  }
  
  // 获取当前配置
  const profile = loadUserProfile();
  
  // 更新昵称
  profile.nickname = nickname;
  
  // 更新签名
  profile.signature = signature;
  
  // 更新头像
  if (removeAvatar) {
    profile.avatar = null;
  } else if (pendingAvatar) {
    profile.avatar = pendingAvatar;
  }
  
  // 保存
  saveUserProfile(profile);
  
  // 清除临时数据
  if (avatarFileInput) {
    avatarFileInput.dataset.pendingAvatar = '';
    avatarFileInput.dataset.removeAvatar = '';
  }
  
  // 显示保存成功动画
  if (profileSaveBtn) {
    const originalHtml = profileSaveBtn.innerHTML;
    profileSaveBtn.classList.add('profile-action-btn--success');
    profileSaveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      ${t('profile.action.saved')}
    `;
    
    setTimeout(() => {
      profileSaveBtn.classList.remove('profile-action-btn--success');
      profileSaveBtn.innerHTML = originalHtml;
    }, 1500);
  }
  
  showSuccessToast(t('toast.profile.saved'), t('toast.profile.saveTitle'));
}

// 页面加载后更新显示
window.addEventListener('load', () => {
  updateProfileDisplay();
});

// ============================================
// 统一操作反馈组件 API
// ============================================

/**
 * 显示加载状态
 * @param {string} text - 加载提示文本
 */
function showUnifiedLoading(text) {
  const overlay = document.getElementById('actionOverlay');
  const loading = document.getElementById('unifiedLoading');
  const success = document.getElementById('unifiedSuccess');
  const textEl = document.getElementById('actionOverlayText');
  
  if (textEl) textEl.textContent = text || '正在处理...';
  if (loading) loading.classList.remove('hidden');
  if (success) success.classList.add('hidden');
  if (overlay) overlay.classList.remove('hidden');
}

/**
 * 切换到成功状态（从加载状态平滑过渡）
 * @param {string} title - 成功标题
 * @param {string} text - 成功描述
 * @param {Function} onOk - 确认按钮回调
 * @param {Function} onCancel - 取消按钮回调（可选，传入则显示取消按钮）
 * @param {boolean} isError - 是否为错误状态
 */
function showUnifiedSuccess(title, text, onOk, onCancel, isError = false) {
  const loading = document.getElementById('unifiedLoading');
  const success = document.getElementById('unifiedSuccess');
  const titleEl = document.getElementById('unifiedTitle');
  const textEl = document.getElementById('unifiedText');
  const okBtn = document.getElementById('unifiedOkBtn');
  const cancelBtn = document.getElementById('unifiedCancelBtn');
  const iconWrap = document.getElementById('unifiedIconWrap');
  const successIcon = document.getElementById('unifiedSuccessIcon');
  const errorIcon = document.getElementById('unifiedErrorIcon');
  
  if (titleEl) titleEl.textContent = title || (isError ? t('modal.operationFailed') : t('common.success'));
  if (textEl) textEl.textContent = text || '';
  
  // 处理错误/成功状态的图标和样式
  if (iconWrap) {
    if (isError) {
      iconWrap.classList.add('error-state');
      if (successIcon) successIcon.classList.add('hidden');
      if (errorIcon) errorIcon.classList.remove('hidden');
    } else {
      iconWrap.classList.remove('error-state');
      if (successIcon) successIcon.classList.remove('hidden');
      if (errorIcon) errorIcon.classList.add('hidden');
    }
  }
  
  // 添加/移除错误模式类
  if (success) {
    if (isError) {
      success.classList.add('error-mode');
    } else {
      success.classList.remove('error-mode');
    }
  }
  
  // 隐藏加载，显示成功
  if (loading) loading.classList.add('hidden');
  if (success) {
    success.classList.remove('hidden');
    // 重新触发动画
    success.style.animation = 'none';
    success.offsetHeight; // 触发 reflow
    success.style.animation = '';
  }
  
  // 处理取消按钮
  if (cancelBtn) {
    if (onCancel) {
      cancelBtn.classList.remove('hidden');
      cancelBtn.onclick = () => {
        hideUnifiedOverlay();
        onCancel();
      };
    } else {
      cancelBtn.classList.add('hidden');
      cancelBtn.onclick = null;
    }
  }
  
  // 处理确认按钮
  if (okBtn) {
    okBtn.onclick = () => {
      hideUnifiedOverlay();
      if (onOk) onOk();
    };
  }
}

/**
 * 隐藏统一反馈组件
 */
function hideUnifiedOverlay() {
  const overlay = document.getElementById('actionOverlay');
  const loading = document.getElementById('unifiedLoading');
  const success = document.getElementById('unifiedSuccess');
  const successIcon = document.getElementById('successIconWrap');
  const errorIcon = document.getElementById('errorIconWrap');
  const titleEl = document.getElementById('unifiedTitle');
  
  if (overlay) overlay.classList.add('hidden');
  // 重置状态
  if (loading) loading.classList.remove('hidden');
  if (success) {
    success.classList.add('hidden');
    success.classList.remove('is-error');
  }
  // 重置图标状态
  if (successIcon) successIcon.classList.remove('hidden');
  if (errorIcon) errorIcon.classList.add('hidden');
  if (titleEl) titleEl.style.color = '';
}

// 保留旧API兼容性，但重定向到统一组件
function getActionModalElements() {
  const modal = document.getElementById('actionOverlay');
  const titleEl = document.getElementById('unifiedTitle');
  const textEl = document.getElementById('unifiedText');
  const okEl = document.getElementById('unifiedOkBtn');
  const cancelEl = document.getElementById('unifiedCancelBtn');
  
  // 准备显示成功状态
  const loading = document.getElementById('unifiedLoading');
  const success = document.getElementById('unifiedSuccess');
  if (loading) loading.classList.add('hidden');
  if (success) success.classList.remove('hidden');
  
  if (cancelEl) {
    cancelEl.classList.add('hidden');
    cancelEl.onclick = null;
  }
  return { modal, titleEl, textEl, okEl, cancelEl };
}
function showModalTip(title, html, isError) {
  const loading = document.getElementById('unifiedLoading');
  const success = document.getElementById('unifiedSuccess');
  const iconWrap = document.getElementById('unifiedIconWrap');
  const successIcon = document.getElementById('unifiedSuccessIcon');
  const errorIcon = document.getElementById('unifiedErrorIcon');
  if (loading) loading.classList.add('hidden');
  if (success) {
    success.classList.remove('hidden');
    success.style.animation = 'none';
    success.offsetHeight;
    success.style.animation = '';
    // 根据是否错误显示不同图标
    if (isError) {
      success.classList.add('error-mode');
      if (iconWrap) iconWrap.classList.add('error-state');
      if (successIcon) successIcon.classList.add('hidden');
      if (errorIcon) errorIcon.classList.remove('hidden');
    } else {
      success.classList.remove('error-mode');
      if (iconWrap) iconWrap.classList.remove('error-state');
      if (successIcon) successIcon.classList.remove('hidden');
      if (errorIcon) errorIcon.classList.add('hidden');
    }
  }
  
  const { modal, titleEl, textEl, okEl } = getActionModalElements();
  if (titleEl) {
    titleEl.textContent = title || '';
  }
  if (textEl) {
    if (isError) textEl.classList.add('tip--error'); else textEl.classList.remove('tip--error');
    textEl.innerHTML = html || '';
  }
  if (modal) modal.classList.remove('hidden');
  const handler = () => { 
    modal.classList.add('hidden'); 
    // 重置状态
    if (loading) loading.classList.remove('hidden');
    if (success) success.classList.add('hidden');
    // 重置图标状态
    if (iconWrap) iconWrap.classList.remove('error-state');
    if (successIcon) successIcon.classList.remove('hidden');
    if (errorIcon) errorIcon.classList.add('hidden');
    if (success) success.classList.remove('error-mode');
    okEl && okEl.removeEventListener('click', handler); 
  };
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

let isCreatingAccount = false;

async function handleCreate(showToast = true) {
  // 防止重复调用
  if (isCreatingAccount) return;
  isCreatingAccount = true;
  
  const btn = document.getElementById('createBtn');
  if (btn) btn.disabled = true;
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
    
    // 隐藏成功横幅，改用顶部Toast通知
    const successBanner = resultEl.querySelector('.new-result-success');
    if (successBanner) {
      successBanner.style.display = 'none';
    }
    
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
    
    // 只在需要时显示顶部成功通知
    if (showToast) {
      showSuccessToast(t('toast.account.created'), t('toast.account.createTitle'));
    }
  } catch (err) {
    alert('创建用户失败：' + err);
    console.error(err);
    const nextBtn = document.getElementById('newNextBtn');
    if (btn) btn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
  } finally {
    if (btn) btn.disabled = false;
    isCreatingAccount = false;
    const loader = document.getElementById('newLoader');
    if (loader) loader.classList.add('hidden');
  }
}

const createBtn = document.getElementById('createBtn');
if (createBtn && !createBtn.dataset._bound) {
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
  createBtn.dataset._bound = '1';
}

// 私钥折叠/展开交互
const privateKeyToggle = document.getElementById('privateKeyToggle');
const privateKeyItem = document.getElementById('privateKeyItem');
if (privateKeyToggle && privateKeyItem) {
  privateKeyToggle.addEventListener('click', () => {
    privateKeyItem.classList.toggle('new-key-card--collapsed');
  });
}

// 导入钱包页面 - 私钥折叠/展开交互
const importPrivateKeyToggle = document.getElementById('importPrivateKeyToggle');
const importPrivateKeyItem = document.getElementById('importPrivateKeyItem');
if (importPrivateKeyToggle && importPrivateKeyItem) {
  importPrivateKeyToggle.addEventListener('click', () => {
    importPrivateKeyItem.classList.toggle('import-key-card--collapsed');
  });
}

// 导入钱包页面 - 返回按钮
const importBackBtn = document.getElementById('importBackBtn');
if (importBackBtn) {
  importBackBtn.addEventListener('click', () => {
    const importCard = document.getElementById('importCard');
    const entryCard = document.getElementById('entryCard');
    if (importCard && entryCard) {
      importCard.classList.add('hidden');
      entryCard.classList.remove('hidden');
      updateWalletBrief(); // 更新钱包列表
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    }
  });
}

// Entry 页面 - 返回按钮
const entryBackBtn = document.getElementById('entryBackBtn');
if (entryBackBtn) {
  entryBackBtn.addEventListener('click', () => {
    const entryCard = document.getElementById('entryCard');
    const newUserCard = document.getElementById('newUserCard');
    if (entryCard && newUserCard) {
      entryCard.classList.add('hidden');
      newUserCard.classList.remove('hidden');
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    }
  });
}

// 新建钱包页面 - 返回按钮
const newBackBtn = document.getElementById('newBackBtn');
if (newBackBtn) {
  newBackBtn.addEventListener('click', () => {
    const newUserCard = document.getElementById('newUserCard');
    const welcomeCard = document.getElementById('welcomeCard');
    if (newUserCard && welcomeCard) {
      newUserCard.classList.add('hidden');
      welcomeCard.classList.remove('hidden');
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    }
  });
}

// 导入钱包页面 - 密码可见性切换
const importToggleVisibility = document.getElementById('importToggleVisibility');
const importPrivHexInput = document.getElementById('importPrivHex');
if (importToggleVisibility && importPrivHexInput) {
  importToggleVisibility.addEventListener('click', () => {
    const eyeOpen = importToggleVisibility.querySelector('.eye-open');
    const eyeClosed = importToggleVisibility.querySelector('.eye-closed');
    if (importPrivHexInput.type === 'password') {
      importPrivHexInput.type = 'text';
      if (eyeOpen) eyeOpen.classList.add('hidden');
      if (eyeClosed) eyeClosed.classList.remove('hidden');
    } else {
      importPrivHexInput.type = 'password';
      if (eyeOpen) eyeOpen.classList.remove('hidden');
      if (eyeClosed) eyeClosed.classList.add('hidden');
    }
  });
}

// 重置登录页面到初始状态的辅助函数
function resetLoginPageState() {
  const formCard = document.querySelector('.login-form-card');
  const tipBlock = document.querySelector('.login-tip-block');
  const resultEl = document.getElementById('loginResult');
  const loader = document.getElementById('loginLoader');
  const nextBtn = document.getElementById('loginNextBtn');
  const cancelBtn = document.getElementById('loginCancelBtn');
  const inputEl = document.getElementById('loginPrivHex');
  
  // 重置所有动效类
  if (formCard) {
    formCard.classList.remove('collapsed', 'collapsing', 'expanding');
  }
  if (tipBlock) {
    tipBlock.classList.remove('collapsed', 'collapsing', 'expanding');
  }
  if (resultEl) {
    resultEl.classList.add('hidden');
    resultEl.classList.remove('collapsing', 'expanding', 'reveal');
  }
  if (loader) {
    loader.classList.add('hidden');
    loader.classList.remove('collapsed', 'collapsing');
  }
  if (nextBtn) nextBtn.classList.add('hidden');
  if (cancelBtn) cancelBtn.classList.add('hidden');
  
  // 清空输入
  if (inputEl) {
    inputEl.value = '';
    inputEl.type = 'password';
  }
  
  // 重置眼睛图标状态 - 初始状态是闭眼显示（密码隐藏）
  const eyeOpen = document.querySelector('#loginToggleVisibility .eye-open');
  const eyeClosed = document.querySelector('#loginToggleVisibility .eye-closed');
  if (eyeOpen) eyeOpen.classList.add('hidden');
  if (eyeClosed) eyeClosed.classList.remove('hidden');
  
  // 重置私钥折叠状态
  const privContainer = document.getElementById('loginPrivContainer');
  if (privContainer) {
    privContainer.classList.add('collapsed');
  }
}

// 登录页面 - 返回按钮
const loginBackBtn = document.getElementById('loginBackBtn');
if (loginBackBtn) {
  loginBackBtn.addEventListener('click', () => {
    const loginCard = document.getElementById('loginCard');
    const welcomeCard = document.getElementById('welcomeCard');
    
    // 重置登录页面状态
    resetLoginPageState();
    
    if (loginCard && welcomeCard) {
      loginCard.classList.add('hidden');
      welcomeCard.classList.remove('hidden');
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    }
  });
}

// 登录页面 - 私钥可见性切换
const loginToggleVisibility = document.getElementById('loginToggleVisibility');
const loginPrivHexInput = document.getElementById('loginPrivHex');
if (loginToggleVisibility && loginPrivHexInput) {
  loginToggleVisibility.addEventListener('click', () => {
    const eyeOpen = loginToggleVisibility.querySelector('.eye-open');
    const eyeClosed = loginToggleVisibility.querySelector('.eye-closed');
    if (loginPrivHexInput.type === 'password') {
      // 当前隐藏 -> 显示明文
      loginPrivHexInput.type = 'text';
      if (eyeOpen) eyeOpen.classList.remove('hidden');
      if (eyeClosed) eyeClosed.classList.add('hidden');
    } else {
      // 当前显示 -> 隐藏
      loginPrivHexInput.type = 'password';
      if (eyeOpen) eyeOpen.classList.add('hidden');
      if (eyeClosed) eyeClosed.classList.remove('hidden');
    }
  });
}

// 登录页面 - 私钥折叠切换
const loginPrivContainer = document.getElementById('loginPrivContainer');
if (loginPrivContainer) {
  const labelClickable = loginPrivContainer.querySelector('.login-result-label--clickable');
  if (labelClickable) {
    labelClickable.addEventListener('click', () => {
      loginPrivContainer.classList.toggle('collapsed');
    });
  }
}

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
  const profileCard = document.getElementById('profileCard');
  if (profileCard) profileCard.classList.add('hidden');
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
  const allCards = document.querySelectorAll('.card, .welcome-hero, #entryCard, #loginCard, #importCard, #newUserCard, #profileCard');
  allCards.forEach(el => { if (el !== card) el.classList.add('hidden'); });
  // 显示指定卡片
  card.classList.remove('hidden');
  // 确保内部页面容器也显示
  const innerPage = card.querySelector('.entry-page, .login-page, .import-page, .new-page, .profile-page');
  if (innerPage) innerPage.classList.remove('hidden');
  // 滚动到页面顶部 - 使用 requestAnimationFrame 确保 DOM 更新后再滚动
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
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

/**
 * 连接页面动画控制
 * 流畅的三阶段进度动画 + 成功状态过渡
 */
function startInquiryAnimation(onComplete) {
  // 重置状态
  resetInquiryState();
  
  const steps = document.querySelectorAll('#inquirySteps .inquiry-step');
  const lines = document.querySelectorAll('#inquirySteps .inquiry-step-divider');
  const progressFill = document.getElementById('inquiryProgressFill');
  const icon = document.getElementById('inquiryIcon');
  const title = document.getElementById('inquiryTitle');
  const desc = document.getElementById('inquiryDesc');
  const tip = document.getElementById('inquiryTip');
  const tipText = document.getElementById('inquiryTipText');
  const page = document.getElementById('inquiryPage');
  
  // 阶段文案
  const stageTexts = [
    { title: t('loading.initializing'), desc: t('loading.initializingDesc') },
    { title: t('loading.connecting'), desc: t('loading.connectingDesc') },
    { title: t('loading.verifying'), desc: t('loading.verifyingDesc') },
    { title: t('loading.success'), desc: t('loading.successDesc') }
  ];
  
  // 更新进度和阶段状态
  function updateStage(stageIndex) {
    // 更新进度条
    const progress = ((stageIndex + 1) / 3) * 100;
    if (progressFill) {
      progressFill.style.width = Math.min(progress, 95) + '%';
    }
    
    // 更新文案
    if (title && stageTexts[stageIndex]) {
      title.textContent = stageTexts[stageIndex].title;
    }
    if (desc && stageTexts[stageIndex]) {
      desc.textContent = stageTexts[stageIndex].desc;
    }
    
    // 更新步骤状态
    steps.forEach((step, i) => {
      step.classList.remove('active', 'completed', 'waiting');
      if (i < stageIndex) {
        step.classList.add('completed');
      } else if (i === stageIndex) {
        step.classList.add('active');
      } else {
        step.classList.add('waiting');
      }
    });
    
    // 更新连接线
    lines.forEach((line, i) => {
      line.classList.remove('flowing', 'complete');
      if (i < stageIndex) {
        line.classList.add('complete');
      } else if (i === stageIndex - 1) {
        line.classList.add('flowing');
      }
    });
  }
  
  // 显示成功状态
  function showSuccess() {
    // 行星系统成功状态
    const orbitSystem = document.getElementById('inquiryOrbitSystem');
    if (orbitSystem) {
      orbitSystem.classList.add('success');
    }
    
    // 进度条完成
    if (progressFill) {
      progressFill.style.width = '100%';
      progressFill.classList.add('complete');
    }
    
    // 所有步骤完成
    steps.forEach(step => {
      step.classList.remove('active', 'waiting');
      step.classList.add('completed');
    });
    
    // 所有连接线完成
    lines.forEach(line => {
      line.classList.remove('flowing');
      line.classList.add('complete');
    });
    
    // 图标变成勾选
    if (icon) {
      icon.classList.add('success');
      const iconPulse = icon.querySelector('.icon-pulse');
      const iconCheck = icon.querySelector('.icon-check');
      if (iconPulse) iconPulse.style.display = 'none';
      if (iconCheck) iconCheck.style.display = 'block';
    }
    
    // 标题变绿
    if (title) {
      title.textContent = stageTexts[3].title;
      title.classList.add('success');
    }
    if (desc) {
      desc.textContent = stageTexts[3].desc;
    }
    
    // 提示变绿
    if (tip) tip.classList.add('success');
    if (tipText) tipText.textContent = t('login.verifyingAndRedirecting');
    
    // 页面脉冲效果
    if (page) page.classList.add('success');
  }
  
  // 淡出并跳转
  function fadeOutAndNavigate() {
    if (page) {
      page.classList.add('fade-out');
    }
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 500);
  }
  
  // 开始动画序列
  // 阶段1: 初始化 (0-600ms)
  updateStage(0);
  
  setTimeout(() => {
    // 阶段2: 连接网络 (600-1600ms)
    updateStage(1);
  }, 600);
  
  setTimeout(() => {
    // 阶段3: 验证账户 (1600-2600ms)
    updateStage(2);
  }, 1600);
  
  setTimeout(() => {
    // 成功状态 (2600ms)
    showSuccess();
  }, 2600);
  
  setTimeout(() => {
    // 淡出并跳转 (3200ms)
    fadeOutAndNavigate();
  }, 3200);
}

/**
 * 重置 inquiry 页面状态
 */
function resetInquiryState() {
  const steps = document.querySelectorAll('#inquirySteps .inquiry-step');
  const lines = document.querySelectorAll('#inquirySteps .inquiry-step-divider');
  const progressFill = document.getElementById('inquiryProgressFill');
  const icon = document.getElementById('inquiryIcon');
  const title = document.getElementById('inquiryTitle');
  const desc = document.getElementById('inquiryDesc');
  const tip = document.getElementById('inquiryTip');
  const tipText = document.getElementById('inquiryTipText');
  const page = document.getElementById('inquiryPage');
  
  // 重置进度条
  if (progressFill) {
    progressFill.style.width = '0%';
    progressFill.classList.remove('complete');
  }
  
  // 重置步骤
  steps.forEach((step, i) => {
    step.classList.remove('active', 'completed', 'waiting');
    if (i === 0) {
      step.classList.add('active');
    } else {
      step.classList.add('waiting');
    }
  });
  
  // 重置连接线
  lines.forEach(line => {
    line.classList.remove('flowing', 'complete');
  });
  
  // 重置图标
  if (icon) {
    icon.classList.remove('success');
    const iconPulse = icon.querySelector('.icon-pulse');
    const iconCheck = icon.querySelector('.icon-check');
    if (iconPulse) iconPulse.style.display = 'block';
    if (iconCheck) iconCheck.style.display = 'none';
  }
  
  // 重置文字
  if (title) {
    title.textContent = t('login.connectingNetwork');
    title.classList.remove('success');
  }
  if (desc) desc.textContent = t('login.establishingConnection');
  
  // 重置提示
  if (tip) tip.classList.remove('success');
  if (tipText) tipText.textContent = t('login.inquiringNetwork');
  
  // 重置页面
  if (page) {
    page.classList.remove('success', 'fade-out');
  }
  
  // 重置行星系统
  const orbitSystem = document.getElementById('inquiryOrbitSystem');
  if (orbitSystem) {
    orbitSystem.classList.remove('success');
  }
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
      // 重置创建标志，允许重新创建
      isCreatingAccount = false;
      
      const resultEl = document.getElementById('result');
      const createBtnReset = document.getElementById('createBtn');
      const newNextBtnReset = document.getElementById('newNextBtn');
      const newLoader = document.getElementById('newLoader');
      
      // 隐藏加载器
      if (newLoader) newLoader.classList.add('hidden');
      
      // 检查是否已有数据
      const accountIdEl = document.getElementById('accountId');
      const hasData = accountIdEl && accountIdEl.textContent.trim() !== '';
      
      if (hasData) {
        // 如果已有数据，保持显示
        if (resultEl) resultEl.classList.remove('hidden');
        if (createBtnReset) createBtnReset.classList.remove('hidden');
        if (newNextBtnReset) newNextBtnReset.classList.remove('hidden');
      } else {
        // 如果没有数据，自动创建一次（不显示Toast）
        if (resultEl) resultEl.classList.add('hidden');
        handleCreate(false).catch(() => { });
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
    case '/group-detail':
      {
        const g1 = getJoinedGroup();
        const joined1 = !!(g1 && g1.groupID);
        showCard(document.getElementById('groupDetailCard'));
        // 更新组织详情页面内容
        const groupJoinedPane = document.getElementById('groupJoinedPane');
        const groupEmptyPane = document.getElementById('groupEmptyPane');
        if (joined1) {
          if (groupJoinedPane) groupJoinedPane.classList.remove('hidden');
          if (groupEmptyPane) groupEmptyPane.classList.add('hidden');
          const groupDetailID = document.getElementById('groupDetailID');
          const groupDetailAggre = document.getElementById('groupDetailAggre');
          const groupDetailAssign = document.getElementById('groupDetailAssign');
          const groupDetailPledge = document.getElementById('groupDetailPledge');
          if (groupDetailID) groupDetailID.textContent = g1.groupID || '-';
          if (groupDetailAggre) groupDetailAggre.textContent = g1.aggreNode || '-';
          if (groupDetailAssign) groupDetailAssign.textContent = g1.assignNode || '-';
          if (groupDetailPledge) groupDetailPledge.textContent = g1.pledgeAddress || '-';
        } else {
          if (groupJoinedPane) groupJoinedPane.classList.add('hidden');
          if (groupEmptyPane) groupEmptyPane.classList.remove('hidden');
        }
      }
      break;
    case '/inquiry':
      showCard(document.getElementById('inquiryCard'));
      startInquiryAnimation(() => {
        const u3 = loadUser();
        if (u3) {
          u3.orgNumber = '10000000';
          saveUser(u3);
        }
        routeTo('#/member-info');
      });
      break;
    case '/inquiry-main':
      showCard(document.getElementById('inquiryCard'));
      startInquiryAnimation(() => {
        routeTo('#/main');
      });
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
    case '/profile':
      showCard(document.getElementById('profileCard'));
      initProfilePage();
      break;
    default:
      routeTo('#/welcome');
      break;
  }
  // 更新页面翻译
  updatePageTranslations();
  // 更新用户标签显示
  updateHeaderUser(loadUser());
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

// 初始化页面翻译
updatePageTranslations();

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
  
  // 使用统一加载组件
  showUnifiedLoading(t('modal.addingWalletAddress'));
  
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
    
    // 使用统一成功组件（从加载状态平滑过渡）
    showUnifiedSuccess(t('modal.walletAddSuccess'), t('modal.walletAddSuccessDesc'), () => {
      try { renderWallet(); updateWalletBrief(); } catch { }
    });
  } catch (e) {
    hideUnifiedOverlay();
    alert('新增地址失败：' + (e && e.message ? e.message : e));
    console.error(e);
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
        return ori === 'created' ? { label: t('modal.newAddress'), cls: 'origin--created' } : (ori === 'imported' ? { label: t('wallet.import'), cls: 'origin--imported' } : { label: t('common.info'), cls: 'origin--unknown' });
      };
      const items = addrs.map(a => {
        const o = originOf(a);
        return `<li data-addr="${a}"><span class="wallet-addr">${a}</span><span class="origin-badge ${o.cls}">${o.label}</span></li>`;
      }).join('');
      brief.innerHTML = items;
      // 折叠超过3项
      const toggleBtn = document.getElementById('briefToggleBtn');
      if (addrs.length > 3) {
        brief.classList.add('collapsed');
        if (toggleBtn) { 
          toggleBtn.classList.remove('hidden'); 
          toggleBtn.querySelector('span').textContent = t('common.expandMore');
          toggleBtn.classList.remove('expanded');
        }
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
  let html = '<div class="wb-inner-wrapper">';

  // Account Overview Section - 账户总览 (New Design)
  html += '<div class="wb-account-card">';
  html += '<h4 class="wb-account-header">账户总览</h4>';

  // Account ID Card
  html += '<div class="wb-account-id-box">';
  html += '<div class="wb-account-id-label">Account ID</div>';
  html += `<div class="wb-account-id-val">${u.accountId || '未设置'}</div>`;
  html += '</div>';

  // Main Address Row
  html += '<div class="wb-info-row">';
  html += '<div class="wb-info-label">主地址</div>';
  html += `<div class="wb-info-val">${u.address || '未设置'}</div>`;
  html += '</div>';

  // 获取担保组织信息 - 优先从 localStorage 读取
  let guarantorInfo = null;
  try {
    const guarChoice = localStorage.getItem('guarChoice');
    if (guarChoice) {
      const choice = JSON.parse(guarChoice);
      if (choice && choice.type === 'join' && choice.groupID) {
        guarantorInfo = choice;
      }
    }
  } catch (e) { }

  // 如果 localStorage 没有，尝试从用户对象获取
  if (!guarantorInfo) {
    const guarantorId = u.orgNumber || u.guarGroup?.groupID || u.GuarantorGroupID || '';
    if (guarantorId) {
      guarantorInfo = { groupID: guarantorId };
      if (u.guarGroup) {
        guarantorInfo.aggreNode = u.guarGroup.aggreNode || u.guarGroup.AggrID || '';
        guarantorInfo.assignNode = u.guarGroup.assignNode || u.guarGroup.AssiID || '';
        guarantorInfo.pledgeAddress = u.guarGroup.pledgeAddress || u.guarGroup.PledgeAddress || '';
      }
    }
  }

  if (guarantorInfo && guarantorInfo.groupID) {
    html += '<div class="wb-guar-box">';
    html += '<div class="wb-guar-header">担保组织信息</div>';
    
    // Grid for Group Info
    html += '<div class="wb-guar-grid">';
    html += `<div class="wb-guar-item"><div class="wb-guar-label">GroupID</div><div class="wb-guar-val">${guarantorInfo.groupID}</div></div>`;
    if (guarantorInfo.aggreNode) {
      html += `<div class="wb-guar-item"><div class="wb-guar-label">AggreNode</div><div class="wb-guar-val">${guarantorInfo.aggreNode}</div></div>`;
    }
    html += '</div>'; // End Grid 1

    if (guarantorInfo.assignNode) {
      html += `<div class="wb-guar-item" style="margin-top:8px;"><div class="wb-guar-label">AssignNode</div><div class="wb-guar-val">${guarantorInfo.assignNode}</div></div>`;
    }
    if (guarantorInfo.pledgeAddress) {
      html += `<div class="wb-guar-item" style="margin-top:8px;"><div class="wb-guar-label">Pledge Address</div><div class="wb-guar-val" style="font-size:10px;word-break:break-all;">${guarantorInfo.pledgeAddress}</div></div>`;
    }
    html += '</div>';
  } else {
    html += '<div class="wb-info-row" style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<span style="color:#78350f;font-size:12px;font-weight:600;">担保组织</span>';
    html += '<span style="color:#6b7280;font-size:12px;">未加入</span>';
    html += '</div>';
  }

  // 显示账户密钥信息（可折叠）
  const privHex = u.keys?.privHex || '';
  const pubXHex = u.keys?.pubXHex || '';
  const pubYHex = u.keys?.pubYHex || '';
  if (privHex || pubXHex || pubYHex) {
    html += '<details class="wb-key-box">';
    html += '<summary class="wb-key-summary">查看账户密钥</summary>';
    html += '<div class="wb-key-content">';
    if (privHex) {
      html += '<div style="margin-bottom:8px;padding:10px 12px;background:#fef2f2;border-radius:8px;max-width:100%;overflow:hidden;">';
      html += `<div style="color:#991b1b;font-size:11px;font-weight:600;margin-bottom:6px;">${t('walletModal.privateKeyDoNotShare')}</div>`;
      html += `<code style="font-size:10px;word-break:break-all;overflow-wrap:break-word;color:#7f1d1d;display:block;font-family:\'SF Mono\',ui-monospace,monospace;">${privHex}</code>`;
      html += '</div>';
    }
    if (pubXHex && pubYHex) {
      html += '<div style="display:flex;flex-direction:column;gap:8px;">';
      html += `<div style="max-width:100%;overflow:hidden;"><div style="color:#64748b;font-size:10px;margin-bottom:4px;font-weight:500;">公钥 X</div><code style="font-size:10px;word-break:break-all;overflow-wrap:break-word;color:#334155;display:block;background:#f8fafc;padding:8px 10px;border-radius:6px;border:1px solid #e2e8f0;font-family:\'SF Mono\',ui-monospace,monospace;">${pubXHex}</code></div>`;
      html += `<div style="max-width:100%;overflow:hidden;"><div style="color:#64748b;font-size:10px;margin-bottom:4px;font-weight:500;">公钥 Y</div><code style="font-size:10px;word-break:break-all;overflow-wrap:break-word;color:#334155;display:block;background:#f8fafc;padding:8px 10px;border-radius:6px;border:1px solid #e2e8f0;font-family:\'SF Mono\',ui-monospace,monospace;">${pubYHex}</code></div>`;
      html += '</div>';
    }
    html += '</div>';
    html += '</details>';
  }
  html += '</div>';

  // Wallet Summary Section - 钱包总览 (New Design)
  html += '<div class="wb-wallet-card">';
  html += '<h4 class="wb-wallet-header">钱包总览</h4>';

  // Total Value Card
  html += '<div class="wb-total-val-box">';
  html += '<div class="wb-total-label">总价值估算</div>';
  html += `<div class="wb-total-num">${totalPGC.toLocaleString()} <span style="font-size:14px;font-weight:600;">PGC</span></div>`;
  html += '</div>';

  // Asset Grid
  html += '<div class="wb-asset-grid">';

  // PGC
  html += '<div class="wb-asset-item wb-asset-pgc">';
  html += '<div class="wb-asset-label">PGC</div>';
  html += `<div class="wb-asset-val">${sums[0]}</div>`;
  html += '</div>';

  // BTC
  html += '<div class="wb-asset-item wb-asset-btc">';
  html += '<div class="wb-asset-label">BTC</div>';
  html += `<div class="wb-asset-val">${sums[1]}</div>`;
  html += '</div>';

  // ETH
  html += '<div class="wb-asset-item wb-asset-eth">';
  html += '<div class="wb-asset-label">ETH</div>';
  html += `<div class="wb-asset-val">${sums[2]}</div>`;
  html += '</div>';

  html += '</div>'; // End Grid

  // Footer Info
  html += '<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;padding-top:12px;border-top:1px solid #f1f5f9;margin-top:8px;">';
  if (w.updateTime) {
    const ts = Number(w.updateTime);
    const date = new Date(ts > 100000000000 ? ts : ts * 1000);
    html += `<div>更新时间: ${date.toLocaleString()}</div>`;
  }
  if (w.updateBlock) {
    html += `<div>区块: ${w.updateBlock}</div>`;
  }
  html += '</div>';

  html += '</div>';

  // Addresses Section
  const addresses = Object.keys(addr);
  if (addresses.length > 0) {
    html += `<h4 class="wb-title">子地址 (${addresses.length})</h4>`;

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
        html += `<div class="wb-sub-title wb-sub-title-success">UTXOs (${utxoCount})</div>`;
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
        html += `<div class="wb-sub-title wb-sub-title-purple">TXCers (${txCerCount})</div>`;
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
    html += `<h4 class="wb-total-title">总TXCers (${totalTXCersKeys.length})</h4>`;
    html += '<div>';
    totalTXCersKeys.forEach(key => {
      html += `<div style="font-size:11px;color:#7f1d1d;font-family:monospace;padding:4px 0;">${key}: ${w.totalTXCers[key]}</div>`;
    });
    html += '</div></div>';
  }

  // Raw JSON Toggle Section
  html += '<div style="margin-top:16px;">';
  html += '<button id="rawStructBtn" class="btn secondary full-width" onclick="window.toggleRawStruct()" style="justify-content:center;border-style:dashed;color:#64748b;">展示完整信息</button>';
  html += '<pre id="rawStructContent" class="wb-json-box"></pre>';
  html += '</div>';

  html += '</div>';
  box.innerHTML = html;
}

window.toggleRawStruct = () => {
  const btn = document.getElementById('rawStructBtn');
  const content = document.getElementById('rawStructContent');
  if (!btn || !content) return;

  const isExpanded = content.classList.contains('expanded');

  if (!isExpanded) {
    // Populate content first
    const u = loadUser();
    if (u && u.wallet) {
      // 移除 history 字段
      const walletCopy = JSON.parse(JSON.stringify(u.wallet));
      delete walletCopy.history;
      content.textContent = JSON.stringify(walletCopy, null, 2);
    } else {
      content.textContent = '{}';
    }

    // Expand Animation Logic
    content.style.height = 'auto';
    content.style.padding = '12px';
    content.style.marginTop = '12px';
    content.style.borderWidth = '1px';
    const fullHeight = content.scrollHeight + 'px';

    content.style.height = '0px';
    content.style.padding = '0px';
    content.style.marginTop = '0px';
    content.style.borderWidth = '0px';
    content.offsetHeight; // Force reflow

    content.classList.add('expanded');
    content.style.height = fullHeight;

    setTimeout(() => {
      content.style.height = '';
      content.style.padding = '';
      content.style.marginTop = '';
      content.style.borderWidth = '';
    }, 350);

    btn.textContent = t('transfer.collapseInfo');
  } else {
    // Collapse Animation Logic
    content.style.height = content.scrollHeight + 'px';
    content.style.padding = '12px';
    content.style.marginTop = '12px';
    content.style.borderWidth = '1px';
    content.offsetHeight; // Force reflow

    content.classList.remove('expanded');

    requestAnimationFrame(() => {
      content.style.height = '0px';
      content.style.padding = '0px';
      content.style.marginTop = '0px';
      content.style.borderWidth = '0px';
    });

    setTimeout(() => {
      content.style.height = '';
      content.style.padding = '';
      content.style.marginTop = '';
      content.style.borderWidth = '';
    }, 350);

    btn.textContent = t('transfer.showFullInfo');
  }
};

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
  originEl.textContent = origin === 'created' ? t('modal.newAddress') : (origin === 'imported' ? t('wallet.import') : t('common.info'));
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
      box.innerHTML = `<button class="btn danger btn--sm brief-confirm-ok">${t('address.deleteConfirm')}</button><button class="btn secondary btn--sm brief-confirm-cancel">${t('address.deleteCancel')}</button>`;
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
    const spanEl = briefToggleBtn.querySelector('span');
    if (collapsed) { 
      list.classList.remove('collapsed'); 
      if (spanEl) spanEl.textContent = t('common.collapseMore');
      briefToggleBtn.classList.add('expanded');
    } else { 
      list.classList.add('collapsed'); 
      if (spanEl) spanEl.textContent = t('common.expandMore');
      briefToggleBtn.classList.remove('expanded');
    }
  });
  briefToggleBtn.dataset._bind = '1';
}

// 结果页“下一步”按钮：跳转到占位页
const newNextBtn = document.getElementById('newNextBtn');
if (newNextBtn) {
  newNextBtn.addEventListener('click', () => {
    const ov = document.getElementById('actionOverlay');
    const ovt = document.getElementById('actionOverlayText');
    if (ovt) ovt.textContent = t('modal.enteringWalletPage');
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
    if (proceedText) proceedText.textContent = t('modal.currentSubAddressCount', { count: addrs.length });
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
const searchPane = document.getElementById('searchPane');
const joinSearchBtn = document.getElementById('joinSearchBtn');
const joinRecBtn = document.getElementById('joinRecBtn');

// 标签页切换逻辑
const joinTabs = document.querySelectorAll('.join-tab');
joinTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.getAttribute('data-tab');
    // 更新标签状态
    joinTabs.forEach(t => t.classList.remove('join-tab--active'));
    tab.classList.add('join-tab--active');
    // 切换面板
    if (target === 'recommend') {
      if (recPane) recPane.classList.remove('hidden');
      if (searchPane) searchPane.classList.add('hidden');
    } else {
      if (recPane) recPane.classList.add('hidden');
      if (searchPane) searchPane.classList.remove('hidden');
    }
  });
});

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
    const searchEmpty = document.getElementById('searchEmpty');
    if (searchEmpty) searchEmpty.classList.add('hidden');
  }
  if (joinSearchBtn) joinSearchBtn.disabled = false;
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
      groupSuggest.innerHTML = list.map(x => `<div class="item" data-id="${x.groupID}"><span class="suggest-id"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="suggest-id-text">${x.groupID}</span></span><span class="suggest-nodes"><span class="node-badge aggre">${x.aggreNode}</span><span class="node-badge assign">${x.assignNode}</span></span><span class="suggest-arrow">→</span></div>`).join('');
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
      const searchEmpty = document.getElementById('searchEmpty');
      if (sr) sr.classList.add('hidden');
      if (searchEmpty) searchEmpty.classList.remove('hidden');
      if (joinSearchBtn) joinSearchBtn.disabled = true;
      return;
    }
    const list = GROUP_LIST.filter(g => g.groupID.includes(q)).slice(0, 6);
    if (list.length === 0) { groupSuggest.classList.add('hidden'); return; }
    groupSuggest.innerHTML = list.map(g => `<div class="item" data-id="${g.groupID}"><span class="suggest-id"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="suggest-id-text">${g.groupID}</span></span><span class="suggest-nodes"><span class="node-badge aggre">${g.aggreNode}</span><span class="node-badge assign">${g.assignNode}</span></span><span class="suggest-arrow">→</span></div>`).join('');
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
    try {
      showUnifiedLoading(t('join.joiningOrg'));
      joinRecBtn.disabled = true;
      if (joinSearchBtn) joinSearchBtn.disabled = true;
      await wait(2000);
    } finally {
      hideUnifiedOverlay();
      joinRecBtn.disabled = false;
      if (joinSearchBtn) joinSearchBtn.disabled = false;
    }

    // 保存到 localStorage 和 Account 对象
    try {
      localStorage.setItem('guarChoice', JSON.stringify({
        type: 'join',
        groupID: g.groupID,
        aggreNode: g.aggreNode,
        assignNode: g.assignNode,
        pledgeAddress: g.pledgeAddress
      }));
    } catch { }

    // 保存到 Account.guarGroup
    const u = loadUser();
    if (u) {
      u.guarGroup = {
        groupID: g.groupID,
        aggreNode: g.aggreNode,
        assignNode: g.assignNode,
        pledgeAddress: g.pledgeAddress
      };
      u.orgNumber = g.groupID;
      saveUser(u);
    }

    updateOrgDisplay();
    routeTo('#/inquiry-main');
  });
}
if (joinSearchBtn) {
  joinSearchBtn.addEventListener('click', async () => {
    if (joinSearchBtn.disabled) return;
    const g = currentSelectedGroup || DEFAULT_GROUP;
    try {
      showUnifiedLoading(t('join.joiningOrg'));
      joinRecBtn.disabled = true;
      joinSearchBtn.disabled = true;
      await wait(2000);
    } finally{
      hideUnifiedOverlay();
      joinRecBtn.disabled = false;
      joinSearchBtn.disabled = false;
    }

    // 保存到 localStorage 和 Account 对象
    try {
      localStorage.setItem('guarChoice', JSON.stringify({
        type: 'join',
        groupID: g.groupID,
        aggreNode: g.aggreNode,
        assignNode: g.assignNode,
        pledgeAddress: g.pledgeAddress
      }));
    } catch { }

    // 保存到 Account.guarGroup
    const u = loadUser();
    if (u) {
      u.guarGroup = {
        groupID: g.groupID,
        aggreNode: g.aggreNode,
        assignNode: g.assignNode,
        pledgeAddress: g.pledgeAddress
      };
      u.orgNumber = g.groupID;
      saveUser(u);
    }

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
      showErrorToast(t('modal.pleaseEnterPrivateKey'), t('modal.inputError'));
      inputEl.focus();
      return;
    }
    // 简单校验：允许带 0x 前缀；去前缀后必须是 64 位十六进制
    const normalized = priv.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
      showErrorToast(t('modal.privateKeyFormatError'), t('modal.formatError'));
      inputEl.focus();
      return;
    }
    importBtn.disabled = true;
    try {
      const loader = document.getElementById('importLoader');
      const resultEl = document.getElementById('importResult');
      const importNextBtn = document.getElementById('importNextBtn');
      const inputSection = document.querySelector('.import-input-section');
      if (importNextBtn) importNextBtn.classList.add('hidden');
      if (resultEl) resultEl.classList.add('hidden');
      
      // 显示加载状态
      if (mode === 'account') {
        if (inputSection) inputSection.classList.add('hidden');
        if (loader) loader.classList.remove('hidden');
      } else {
        showUnifiedLoading(t('modal.addingWalletAddress'));
      }
      
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
        // 确保私钥默认折叠
        const importPrivateKeyItem = document.getElementById('importPrivateKeyItem');
        if (importPrivateKeyItem) importPrivateKeyItem.classList.add('import-result-item--collapsed');
      } else {
        const u2 = loadUser();
        if (!u2 || !u2.accountId) { 
          hideUnifiedOverlay();
          showErrorToast(t('modal.pleaseLoginFirst'), t('modal.operationFailed')); 
          return; 
        }
        const acc = toAccount({ accountId: u2.accountId, address: u2.address }, u2);
        const addr = (data.address || '').toLowerCase();
        if (!addr) {
          showUnifiedSuccess('导入失败', '无法解析地址', () => {}, null, true);
          return;
        }
        const exists = (acc.wallet && acc.wallet.addressMsg && acc.wallet.addressMsg[addr]) || (u2.address && String(u2.address).toLowerCase() === addr);
        if (exists) {
          showUnifiedSuccess('导入失败', '该公钥地址已存在，不能重复导入', () => {}, null, true);
          return;
        }
        if (addr) acc.wallet.addressMsg[addr] = acc.wallet.addressMsg[addr] || { type: 0, utxos: {}, txCers: {}, value: { totalValue: 0, utxoValue: 0, txCerValue: 0 }, estInterest: 0, origin: 'imported', privHex: (data.privHex || normalized) };
        saveUser(acc);
        updateWalletBrief();
        showUnifiedSuccess('导入钱包成功', '已导入一个钱包地址', () => {
          routeTo('#/entry');
        });
      }
    } catch (err) {
      hideUnifiedOverlay();
      showErrorToast(t('modal.importFailed', { error: err.message }), t('modal.systemError'));
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
    
    // 验证：使用 toast 替代 alert
    if (!priv) { 
      showErrorToast(t('modal.pleaseEnterPrivateKeyHex'), t('modal.inputIncomplete')); 
      inputEl.focus(); 
      return; 
    }
    const normalized = priv.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(normalized)) { 
      showErrorToast(t('modal.privateKeyFormat64'), t('modal.formatError')); 
      inputEl.focus(); 
      return; 
    }
    
    loginBtn.disabled = true;
    
    try {
      const formCard = document.querySelector('.login-form-card');
      const tipBlock = document.querySelector('.login-tip-block');
      const loader = document.getElementById('loginLoader');
      const resultEl = document.getElementById('loginResult');
      const nextBtn = document.getElementById('loginNextBtn');
      const cancelBtn = document.getElementById('loginCancelBtn');
      
      // 隐藏之前的结果
      if (resultEl) resultEl.classList.add('hidden');
      if (nextBtn) nextBtn.classList.add('hidden');
      if (cancelBtn) cancelBtn.classList.add('hidden');
      
      // 表单和提示收起动效
      if (formCard) {
        formCard.classList.add('collapsing');
      }
      if (tipBlock) {
        tipBlock.classList.add('collapsing');
      }
      
      // 等待收起动效完成后显示加载器
      await wait(400);
      
      if (formCard) {
        formCard.classList.remove('collapsing');
        formCard.classList.add('collapsed');
      }
      if (tipBlock) {
        tipBlock.classList.remove('collapsing');
        tipBlock.classList.add('collapsed');
      }
      
      // 显示加载器
      if (loader) loader.classList.remove('hidden');
      
      const t0 = Date.now();
      const data = await importFromPrivHex(priv);
      const elapsed = Date.now() - t0;
      if (elapsed < 800) await wait(800 - elapsed);
      
      // 加载器收起
      if (loader) {
        loader.classList.add('collapsing');
        await wait(300);
        loader.classList.remove('collapsing');
        loader.classList.add('hidden', 'collapsed');
      }
      
      // 显示结果 - 展开动效
      const resultEl2 = document.getElementById('loginResult');
      if (resultEl2) {
        resultEl2.classList.remove('hidden', 'collapsed');
        resultEl2.classList.add('expanding');
        // 动效完成后移除 class
        setTimeout(() => resultEl2.classList.remove('expanding'), 600);
      }
      
      document.getElementById('loginAccountId').textContent = data.accountId || '';
      document.getElementById('loginAddress').textContent = data.address || '';
      document.getElementById('loginPrivOut').textContent = data.privHex || normalized;
      document.getElementById('loginPubX').textContent = data.pubXHex || '';
      document.getElementById('loginPubY').textContent = data.pubYHex || '';
      
      // 确保私钥区域默认折叠
      const privContainer = document.getElementById('loginPrivContainer');
      if (privContainer) {
        privContainer.classList.add('collapsed');
      }
      
      saveUser({ accountId: data.accountId, address: data.address, privHex: data.privHex, pubXHex: data.pubXHex, pubYHex: data.pubYHex, flowOrigin: 'login' });
      
      // 显示操作按钮
      if (cancelBtn) {
        cancelBtn.classList.remove('hidden');
      }
      if (nextBtn) {
        nextBtn.classList.remove('hidden');
      }
      
      showSuccessToast(t('toast.login.successDesc'), t('toast.login.success'));
      
    } catch (e) {
      // 错误处理：恢复表单状态
      const formCard = document.querySelector('.login-form-card');
      const tipBlock = document.querySelector('.login-tip-block');
      const loader = document.getElementById('loginLoader');
      
      if (loader) {
        loader.classList.add('hidden');
        loader.classList.remove('collapsing', 'collapsed');
      }
      
      // 恢复表单显示
      if (formCard) {
        formCard.classList.remove('collapsing', 'collapsed');
        formCard.classList.add('expanding');
        setTimeout(() => formCard.classList.remove('expanding'), 500);
      }
      if (tipBlock) {
        tipBlock.classList.remove('collapsing', 'collapsed');
        tipBlock.classList.add('expanding');
        setTimeout(() => tipBlock.classList.remove('expanding'), 400);
      }
      
      showErrorToast(e.message || t('modal.cannotRecognizeKey'), t('modal.loginFailed'));
      console.error(e);
    } finally {
      loginBtn.disabled = false;
    }
  });
}

// 登录页面取消按钮 - 重置到初始状态
const loginCancelBtn = document.getElementById('loginCancelBtn');
if (loginCancelBtn) {
  loginCancelBtn.addEventListener('click', async () => {
    const formCard = document.querySelector('.login-form-card');
    const tipBlock = document.querySelector('.login-tip-block');
    const resultEl = document.getElementById('loginResult');
    const loader = document.getElementById('loginLoader');
    const nextBtn = document.getElementById('loginNextBtn');
    const cancelBtn = document.getElementById('loginCancelBtn');
    const inputEl = document.getElementById('loginPrivHex');
    
    // 结果区域收起
    if (resultEl && !resultEl.classList.contains('hidden')) {
      resultEl.classList.add('collapsing');
      await wait(400);
      resultEl.classList.remove('collapsing');
      resultEl.classList.add('hidden');
    }
    
    // 隐藏按钮
    if (nextBtn) nextBtn.classList.add('hidden');
    if (cancelBtn) cancelBtn.classList.add('hidden');
    
    // 恢复加载器状态
    if (loader) {
      loader.classList.add('hidden');
      loader.classList.remove('collapsed', 'collapsing');
    }
    
    // 表单展开
    if (formCard) {
      formCard.classList.remove('collapsed', 'collapsing');
      formCard.classList.add('expanding');
      setTimeout(() => formCard.classList.remove('expanding'), 500);
    }
    
    // 提示展开
    if (tipBlock) {
      tipBlock.classList.remove('collapsed', 'collapsing');
      tipBlock.classList.add('expanding');
      setTimeout(() => tipBlock.classList.remove('expanding'), 400);
    }
    
    // 清空输入
    if (inputEl) {
      inputEl.value = '';
      inputEl.type = 'password';
    }
    
    // 重置眼睛图标状态 - 初始状态是闭眼显示（密码隐藏）
    const eyeOpen = document.querySelector('#loginToggleVisibility .eye-open');
    const eyeClosed = document.querySelector('#loginToggleVisibility .eye-closed');
    if (eyeOpen) eyeOpen.classList.add('hidden');
    if (eyeClosed) eyeClosed.classList.remove('hidden');
    
    // 清除保存的用户数据
    localStorage.removeItem('utxo_user');
    
    showInfoToast('请重新输入私钥进行登录', '已重置');
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
  // 点击菜单外部时关闭菜单
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('userMenu');
    const userBar = document.getElementById('userBar');
    // 如果点击在菜单或用户栏内部，不关闭
    if (menu && userBar && !userBar.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
  // 阻止菜单内部点击冒泡（防止关闭）
  const userMenu = document.getElementById('userMenu');
  if (userMenu) {
    userMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
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
  if (org) org.textContent = u.orgNumber || t('header.noOrg');
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
      // 截断地址显示
      const shortAddr = a.length > 18 ? a.slice(0, 10) + '...' + a.slice(-6) : a;

      item.innerHTML = `
        <div class="addr-card-summary">
          <div class="addr-card-avatar coin--${coinClass}">${coinType}</div>
          <div class="addr-card-main">
            <span class="addr-card-hash" title="${a}">${shortAddr}</span>
            <span class="addr-card-balance">${amtCash0} ${coinType}</span>
          </div>
          <div class="addr-card-arrow">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </div>
        <div class="addr-card-detail">
          <div class="addr-card-detail-inner">
            <div class="addr-detail-row">
              <span class="addr-detail-label">${t('address.fullAddress')}</span>
              <span class="addr-detail-value">${a}</span>
            </div>
            <div class="addr-detail-row">
              <span class="addr-detail-label">${t('address.balance')}</span>
              <span class="addr-detail-value">${amtCash0} ${coinType}</span>
            </div>
            <div class="addr-detail-row">
              <span class="addr-detail-label">GAS</span>
              <span class="addr-detail-value gas">${gas0}</span>
            </div>
            <div class="addr-card-actions">
              <button class="addr-action-btn addr-action-btn--primary btn-add test-add-any" title="${t('address.add')}">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                ${t('address.add')}
              </button>
              <button class="addr-action-btn addr-action-btn--secondary btn-zero test-zero-any" title="${t('address.clear')}">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                ${t('address.clear')}
              </button>
              <div class="addr-ops-container"></div>
            </div>
          </div>
        </div>
      `;
      // 添加点击展开/收起功能
      const summaryEl = item.querySelector('.addr-card-summary');
      if (summaryEl) {
        summaryEl.addEventListener('click', (e) => {
          e.stopPropagation();
          item.classList.toggle('expanded');
        });
      }
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
        delBtn.textContent = t('wallet.deleteAddress');
        const expBtn = document.createElement('button');
        expBtn.className = 'ops-item';
        expBtn.textContent = t('wallet.exportPrivateKey');
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
          if (textEl) textEl.textContent = `${t('address.confirmDelete')} ${a} ${t('address.confirmDeleteDesc')}`;
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
            if (at) at.textContent = t('wallet.deleteSuccess');
            if (ax) { ax.classList.remove('tip--error'); ax.textContent = t('wallet.deleteSuccessDesc'); }
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
            if (title) title.textContent = t('wallet.exportPrivateKey');
            if (text) { text.classList.remove('tip--error'); text.innerHTML = `<code class="break">${priv}</code>`; }
          } else {
            if (title) title.textContent = t('wallet.exportFailed');
            if (text) { text.classList.add('tip--error'); text.textContent = t('wallet.noPrivateKey'); }
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

          // Construct SubATX - 必须包含完整的 ToPublicKey 以便后续计算 TXOutputHash
          const subTx = {
            TXID: '', // Calculated below
            TXType: 0,
            TXInputsNormal: [{ IsCommitteeMake: true }],
            TXOutputs: [{
              ToAddress: key,
              ToValue: inc,
              ToGuarGroupID: u4.guarGroup || u4.orgNumber || '',
              ToPublicKey: {
                Curve: 'P256',
                XHex: found.pubXHex || '',
                YHex: found.pubYHex || ''
              },
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

          // 更新地址卡片上显示的余额
          const coinType = typeId === 1 ? 'BTC' : (typeId === 2 ? 'ETH' : 'PGC');
          const balanceEl = item.querySelector('.addr-card-balance');
          if (balanceEl) {
            balanceEl.textContent = `${Number(found.value.utxoValue || 0)} ${coinType}`;
          }
          // 更新详情中的余额
          const detailRows = item.querySelectorAll('.addr-detail-row');
          detailRows.forEach(row => {
            const label = row.querySelector('.addr-detail-label');
            const value = row.querySelector('.addr-detail-value');
            if (label && value) {
              if (label.textContent === t('address.balance') || label.textContent === '余额') {
                value.textContent = `${Number(found.value.utxoValue || 0)} ${coinType}`;
              } else if (label.textContent === 'GAS') {
                value.textContent = Number(found.estInterest || 0);
              }
            }
          });
          
          // 显示Toast提示
          showMiniToast(`+${inc} ${coinType}`, 'success');
          
          // 更新分类货币余额显示
          const walletPGCEl = document.getElementById('walletPGC');
          const walletBTCEl = document.getElementById('walletBTC');
          const walletETHEl = document.getElementById('walletETH');
          const vdUpdated = u4.wallet.valueDivision || { 0: 0, 1: 0, 2: 0 };
          if (walletPGCEl) walletPGCEl.textContent = Number(vdUpdated[0] || 0).toLocaleString();
          if (walletBTCEl) walletBTCEl.textContent = Number(vdUpdated[1] || 0).toLocaleString();
          if (walletETHEl) walletETHEl.textContent = Number(vdUpdated[2] || 0).toLocaleString();

          // Update other UI elements...
          const addrList = document.getElementById('srcAddrList');
          if (addrList) {
            const label = Array.from(addrList.querySelectorAll('label')).find(l => { const inp = l.querySelector('input[type="checkbox"]'); return inp && String(inp.value).toLowerCase() === key; });
            if (label) {
              const amtVal = label.querySelector('.amount-num');
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
            usdtEl.textContent = usdt.toLocaleString();

            usdtEl.textContent = usdt.toLocaleString();
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
          
          // 更新地址卡片上显示的余额
          const typeIdZ = Number(found && found.type !== undefined ? found.type : 0);
          const coinTypeZ = typeIdZ === 1 ? 'BTC' : (typeIdZ === 2 ? 'ETH' : 'PGC');
          const balanceElZ = item.querySelector('.addr-card-balance');
          if (balanceElZ) {
            balanceElZ.textContent = `0 ${coinTypeZ}`;
          }
          // 更新详情中的余额
          const detailRowsZ = item.querySelectorAll('.addr-detail-row');
          detailRowsZ.forEach(row => {
            const label = row.querySelector('.addr-detail-label');
            const value = row.querySelector('.addr-detail-value');
            if (label && value) {
              if (label.textContent === t('address.balance') || label.textContent === '余额') {
                value.textContent = `0 ${coinTypeZ}`;
              } else if (label.textContent === 'GAS') {
                value.textContent = '0';
              }
            }
          });
          
          // 显示Toast提示
          showMiniToast(t('address.clear'), 'info');
          
          // 更新分类货币余额显示
          const walletPGCElZ = document.getElementById('walletPGC');
          const walletBTCElZ = document.getElementById('walletBTC');
          const walletETHElZ = document.getElementById('walletETH');
          const vdUpdatedZ = u4.wallet.valueDivision || { 0: 0, 1: 0, 2: 0 };
          if (walletPGCElZ) walletPGCElZ.textContent = Number(vdUpdatedZ[0] || 0).toLocaleString();
          if (walletBTCElZ) walletBTCElZ.textContent = Number(vdUpdatedZ[1] || 0).toLocaleString();
          if (walletETHElZ) walletETHElZ.textContent = Number(vdUpdatedZ[2] || 0).toLocaleString();
          
          const addrList = document.getElementById('srcAddrList');
          if (addrList) {
            const label = Array.from(addrList.querySelectorAll('label')).find(l => { const inp = l.querySelector('input[type="checkbox"]'); return inp && String(inp.value).toLowerCase() === key; });
            if (label) {
              const amtVal = label.querySelector('.amount-num');
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
  const woActions = document.getElementById('woActions');
  const joinBtn = document.getElementById('woJoinBtn');
  const orgStatusBadge = document.getElementById('orgStatusBadge');
  const g = getJoinedGroup();
  const joined = !!(g && g.groupID);
  if (woCard) woCard.classList.toggle('hidden', !joined);
  if (woExit) woExit.classList.toggle('hidden', !joined);
  if (woActions) woActions.classList.toggle('hidden', !joined);
  if (woEmpty) woEmpty.classList.toggle('hidden', joined);
  if (joinBtn) joinBtn.classList.toggle('hidden', joined);
  // V2版本 - 更新状态徽章
  if (orgStatusBadge) {
    if (joined) {
      orgStatusBadge.textContent = t('join.joined');
      orgStatusBadge.className = 'org-status-badge org-status-badge--active';
    } else {
      orgStatusBadge.textContent = t('join.notJoined');
      orgStatusBadge.className = 'org-status-badge org-status-badge--inactive';
    }
  }
  [['woGroupID', joined ? g.groupID : ''],
  ['woAggre', joined ? (g.aggreNode || '') : ''],
  ['woAssign', joined ? (g.assignNode || '') : ''],
  ['woPledge', joined ? (g.pledgeAddress || '') : '']]
    .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
  if (woExit && !woExit.dataset._bind) {
    woExit.addEventListener('click', async () => {
      const u3 = loadUser();
      if (!u3 || !u3.accountId) { showModalTip(t('common.notLoggedIn'), t('modal.pleaseLoginFirst'), true); return; }

      const confirmed = await showConfirmModal(t('modal.leaveOrgTitle'), t('modal.leaveOrgDesc'), t('common.confirm'), t('common.cancel'));
      if (!confirmed) return;

      const ov = document.getElementById('actionOverlay');
      const ovt = document.getElementById('actionOverlayText');
      if (ovt) ovt.textContent = t('join.leavingOrg');
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
      showModalTip(t('toast.leftOrg'), t('toast.leftOrgDesc'), false);
    });
    woExit.dataset._bind = '1';
  }
  if (joinBtn && !joinBtn.dataset._bind) {
    joinBtn.addEventListener('click', () => {
      routeTo('#/join-group');
    });
    joinBtn.dataset._bind = '1';
  }
  // 查看详情按钮 - 跳转到组织详情页
  const woDetailBtn = document.getElementById('woDetailBtn');
  if (woDetailBtn && !woDetailBtn.dataset._bind) {
    woDetailBtn.addEventListener('click', () => {
      routeTo('#/group-detail');
    });
    woDetailBtn.dataset._bind = '1';
  }
  // 组织详情页面按钮事件绑定
  const groupExitBtn = document.getElementById('groupExitBtn');
  const groupBackBtn = document.getElementById('groupBackBtn');
  const groupJoinBtn = document.getElementById('groupJoinBtn');
  const groupEmptyBackBtn = document.getElementById('groupEmptyBackBtn');
  if (groupExitBtn && !groupExitBtn.dataset._bind) {
    groupExitBtn.addEventListener('click', async () => {
      const u3 = loadUser();
      if (!u3 || !u3.accountId) { showModalTip(t('common.notLoggedIn'), t('modal.pleaseLoginFirst'), true); return; }
      const confirmed = await showConfirmModal(t('modal.leaveOrgTitle'), t('modal.leaveOrgDesc'), t('common.confirm'), t('common.cancel'));
      if (!confirmed) return;
      const ov = document.getElementById('actionOverlay');
      const ovt = document.getElementById('actionOverlayText');
      if (ovt) ovt.textContent = t('join.leavingOrg');
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
      showModalTip(t('toast.leftOrg'), t('toast.leftOrgDesc'), false);
      // 刷新当前页面状态
      routeTo('#/group-detail');
    });
    groupExitBtn.dataset._bind = '1';
  }
  if (groupBackBtn && !groupBackBtn.dataset._bind) {
    groupBackBtn.addEventListener('click', () => {
      routeTo('#/main');
    });
    groupBackBtn.dataset._bind = '1';
  }
  if (groupJoinBtn && !groupJoinBtn.dataset._bind) {
    groupJoinBtn.addEventListener('click', () => {
      routeTo('#/join-group');
    });
    groupJoinBtn.dataset._bind = '1';
  }
  if (groupEmptyBackBtn && !groupEmptyBackBtn.dataset._bind) {
    groupEmptyBackBtn.addEventListener('click', () => {
      routeTo('#/main');
    });
    groupEmptyBackBtn.dataset._bind = '1';
  }
  // GROUP 页面复制按钮
  const groupCopyBtns = document.querySelectorAll('#groupDetailCard .info-copy-btn');
  groupCopyBtns.forEach(btn => {
    if (!btn.dataset._bind) {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.copy;
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          const text = targetEl.textContent;
          navigator.clipboard.writeText(text).then(() => {
            showToast && showToast(t('toast.copied'), 'success');
          }).catch(() => {
            showToast && showToast(t('toast.copyFailed'), 'error');
          });
        }
      });
      btn.dataset._bind = '1';
    }
  });
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

  // ========================================
  // V8 余额曲线图 - 完全修复版
  // 修复问题：时间标签、圆点变形、余额为0凹陷、乱跳动画
  // ========================================
  
  // 使用持久化存储历史数据
  const CHART_HISTORY_KEY = 'wallet_balance_chart_history_v2';
  
  const loadChartHistory = () => {
    try {
      const data = localStorage.getItem(CHART_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  };
  
  const saveChartHistory = (history) => {
    try {
      const trimmed = history.slice(-10);
      localStorage.setItem(CHART_HISTORY_KEY, JSON.stringify(trimmed));
    } catch (e) {}
  };
  
  window.updateBalanceChart = (user) => {
    const chartEl = document.getElementById('balanceChart');
    if (!chartEl) return;

    const chartInner = chartEl.querySelector('.balance-chart-inner');
    const svg = chartEl.querySelector('.balance-chart-svg');
    const lineEl = document.getElementById('chartLine');
    const fillEl = document.getElementById('chartFill');
    const dotsEl = document.getElementById('chartDots');
    const tooltip = document.getElementById('chartTooltip');
    const timeLabelsEl = document.getElementById('chartTimeLabels');

    if (!svg || !lineEl || !fillEl || !dotsEl) return;

    // 获取当前余额
    const vd = (user && user.wallet && user.wallet.valueDivision) || { 0: 0, 1: 0, 2: 0 };
    const currentVal = Math.round(Number(vd[0] || 0) * 1 + Number(vd[1] || 0) * 100 + Number(vd[2] || 0) * 10);
    const now = Date.now();
    const minuteMs = 60 * 1000;
    
    // 加载持久化的历史数据
    let history = loadChartHistory();
    
    // 初始化或更新历史数据
    if (history.length === 0) {
      // 创建初始历史数据：过去10分钟
      for (let i = 9; i >= 0; i--) {
        const t = now - i * minuteMs;
        history.push({ t, v: currentVal });
      }
      saveChartHistory(history);
    } else {
      const lastPoint = history[history.length - 1];
      if (now - lastPoint.t >= minuteMs) {
        history.push({ t: now, v: currentVal });
        saveChartHistory(history);
      } else {
        history[history.length - 1].v = currentVal;
      }
    }

    // 取最近10个点用于显示
    const displayHistory = history.slice(-10);
    
    // 计算值范围 - 关键修复：当所有值相同时（包括全0），使用固定高度显示为水平线
    const values = displayHistory.map(h => h.v);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;
    
    // SVG 尺寸（自适应容器比例，拉满宽度）
    const innerRect = chartInner?.getBoundingClientRect();
    const containerW = innerRect?.width || chartEl.clientWidth || 320;
    const containerH = innerRect?.height || chartEl.clientHeight || 56;
    const viewBoxHeight = Math.round(containerH || 70);
    const width = Math.max(320, Math.round(viewBoxHeight * (containerW / Math.max(1, containerH))));
    const height = viewBoxHeight;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const padX = 2;  // 进一步减小左右边距，拉满宽度
    const padY = 6;
    const chartHeight = height - padY * 2;

    const bottomGapPx = 10;
    const topGapPx = 8;
    const chartTop = padY + topGapPx;
    const chartBottom = height - padY - bottomGapPx;
    const chartRange = chartBottom - chartTop;
    
    const toY = (v) => {
      if (range === 0) {
        // 所有值相同（包括全0），在曲线区域中间显示水平线
        return chartTop + chartRange * 0.5;
      }
      // 有变化时，映射到曲线区域
      const normalized = (v - minVal) / range; // 0 到 1
      return chartBottom - normalized * chartRange;
    };

    // X坐标计算
    const toX = (i) => {
      if (displayHistory.length <= 1) return width / 2;
      return padX + (i / (displayHistory.length - 1)) * (width - padX * 2);
    };

    // 生成点坐标
    const points = displayHistory.map((h, i) => ({ 
      x: toX(i), 
      y: toY(h.v), 
      v: h.v, 
      t: h.t 
    }));
    
    if (points.length < 2) return;
    
    // 生成平滑曲线路径 (Catmull-Rom 样条)
    let pathD = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    
    // 使用 Monotone Cubic Spline 算法以消除"回勾"现象并保证单调性
    // 计算斜率
    const slopes = [];
    const dxs = [];
    const dys = [];
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      dxs.push(dx);
      dys.push(dy);
      slopes.push(dy / dx);
    }
    // 补齐最后一个斜率，防止数组越界
    if (slopes.length > 0) {
        slopes.push(slopes[slopes.length - 1]);
        dxs.push(dxs[dxs.length - 1]);
        dys.push(dys[dys.length - 1]);
    } else {
        // 只有一个点的情况
        slopes.push(0); dxs.push(0); dys.push(0);
    }

    // 计算切线斜率 m
    const ms = [];
    ms.push(slopes[0]); // 起点切线
    for (let i = 0; i < slopes.length - 1; i++) {
      // 如果斜率符号相反，说明是极值点，切线设为0以防过冲
      if (slopes[i] * slopes[i+1] <= 0) {
          ms.push(0);
      } else {
          ms.push((slopes[i] + slopes[i + 1]) / 2);
      }
    }
    ms.push(slopes[slopes.length - 1]); // 终点切线

    // 生成贝塞尔控制点并绘制
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = points[i + 1].x - points[i].x;
      
      // 两个控制点 X 坐标设为区间 1/3 和 2/3 处
      // Y 坐标根据切线斜率推算
      const cp1x = p1.x + dx / 3;
      const cp1y = p1.y + ms[i] * dx / 3;
      const cp2x = p2.x - dx / 3;
      const cp2y = p2.y - ms[i + 1] * dx / 3;

      pathD += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    // 填充区域路径
    const fillD = `${pathD} L ${points[points.length - 1].x.toFixed(1)},${height} L ${points[0].x.toFixed(1)},${height} Z`;

    // 更新路径
    lineEl.setAttribute('d', pathD);
    fillEl.setAttribute('d', fillD);

    // 生成数据点 - 使用固定尺寸的圆（不会随SVG拉伸变形）
    // 通过计算当前SVG的缩放比例来补偿
    dotsEl.innerHTML = points.map((p, i) => {
      const isLast = i === points.length - 1;
      // 基础半径
      const baseR = isLast ? 4 : 3;
      return `<circle 
        cx="${p.x.toFixed(1)}" 
        cy="${p.y.toFixed(1)}" 
        r="${baseR}" 
        class="${isLast ? 'chart-dot-current' : 'chart-dot'}"
        data-value="${p.v}"
        data-time="${p.t}"
      />`;
    }).join('');

    // 更新时间标签
    if (timeLabelsEl && displayHistory.length > 0) {
      const firstTime = new Date(displayHistory[0].t);
      const lastTime = new Date(displayHistory[displayHistory.length - 1].t);
      const midIdx = Math.floor(displayHistory.length / 2);
      const midTime = new Date(displayHistory[midIdx].t);
      
      const formatTime = (d) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      
      timeLabelsEl.innerHTML = `
        <span class="chart-time-label">${formatTime(firstTime)}</span>
        <span class="chart-time-label">${formatTime(midTime)}</span>
        <span class="chart-time-label">${formatTime(lastTime)}</span>
      `;
    }

    // 保存points到全局用于tooltip
    svg._chartPoints = points;
    svg._chartWidth = width;
    svg._chartViewBoxWidth = width;
    
    // 绑定悬浮提示事件（只绑定一次）
      if (!svg.dataset._bindChart) {
        let lastMoveTime = 0;
        let rafId = null;
        
        const handleMouseMove = (e) => {
          const now = Date.now();
          if (now - lastMoveTime < 16) return; // 限制到约60fps
          lastMoveTime = now;
          
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
        const pts = svg._chartPoints || [];
        const svgWidth = svg._chartWidth || 320;
        if (pts.length === 0) return;
        
        const rect = svg.getBoundingClientRect();
        // 修复：使用viewBox宽度而不是svgWidth来计算鼠标位置
        const viewBoxWidth = svg._chartViewBoxWidth || 320;
        const x = (e.clientX - rect.left) * (viewBoxWidth / rect.width);
        
        let closest = pts[0];
        let minDist = Infinity;
        pts.forEach(p => {
          const dist = Math.abs(p.x - x);
          if (dist < minDist) {
            minDist = dist;
            closest = p;
          }
        });

        if (tooltip && minDist < 40) {
          const date = new Date(closest.t);
          const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          tooltip.textContent = `${closest.v.toLocaleString()} USDT · ${timeStr}`;
          tooltip.classList.add('visible');
          
          // 计算tooltip位置（基于容器内相对位置）
          const chartInner = chartEl.querySelector('.balance-chart-inner');
          if (chartInner) {
            const innerRect = chartInner.getBoundingClientRect();
            // 修复：使用viewBox宽度而不是svgWidth来计算比例
            const viewBoxWidth = svg._chartViewBoxWidth || 320;
            const tooltipX = (closest.x / viewBoxWidth) * innerRect.width;
            const tooltipY = (closest.y / 70) * innerRect.height;
            tooltip.style.left = `${tooltipX}px`;
            tooltip.style.top = `${Math.max(0, tooltipY - 28)}px`;
          }
          }
        });
      };

      const handleMouseLeave = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (tooltip) tooltip.classList.remove('visible');
      };

      svg.addEventListener('mousemove', handleMouseMove, { passive: true });
      svg.addEventListener('mouseleave', handleMouseLeave);

      svg.dataset._bindChart = 'true';
    }
  };
  
  // 每分钟自动更新图表
  setInterval(() => {
    const u = loadUser();
    if (u) {
      window.updateBalanceChart(u);
    }
  }, 60 * 1000);

  // 初始化 V6 曲线图
  const uBalanceChart = loadUser();
  if (uBalanceChart) {
    updateBalanceChart(uBalanceChart);
  }

  const usdtEl = document.getElementById('walletUSDT');
  if (usdtEl && u && u.wallet) {
    const vd = (u.wallet.valueDivision) || { 0: 0, 1: 0, 2: 0 };
    const pgc = Number(vd[0] || 0);
    const btc = Number(vd[1] || 0);
    const eth = Number(vd[2] || 0);
    const usdt = Math.round(pgc * 1 + btc * 100 + eth * 10);
    
    // 统一仅显示数字，不在内部追加单位
    usdtEl.textContent = usdt.toLocaleString();
    
    // V2版本 - 通过ID更新币种余额
    const walletPGC = document.getElementById('walletPGC');
    const walletBTC = document.getElementById('walletBTC');
    const walletETH = document.getElementById('walletETH');
    if (walletPGC) walletPGC.textContent = pgc.toLocaleString();
    if (walletBTC) walletBTC.textContent = btc.toLocaleString();
    if (walletETH) walletETH.textContent = eth.toLocaleString();
    
    // 旧版本兼容 - 通过类选择器更新
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
      // V2版本 - 直接更新数字
      if (gasBadge2.classList.contains('animate-number')) {
        gasBadge2.textContent = sumGas2.toLocaleString();
      } else {
        gasBadge2.innerHTML = `<span class="amt">${sumGas2.toLocaleString()}</span><span class="unit">GAS</span>`;
      }
    }
  }
  const wsToggle = document.getElementById('walletStructToggle');
  const wsBox = document.getElementById('walletStructBox');
  const wsSection = document.getElementById('walletStructPane');
  const wsContent = wsToggle?.closest('.struct-section')?.querySelector('.struct-content');
  if (wsToggle && wsBox && !wsToggle.dataset._bind) {
    wsToggle.addEventListener('click', () => {
      const isExpanded = wsSection?.classList.contains('expanded') || wsToggle.classList.contains('expanded');

      if (!isExpanded) {
        updateWalletStruct();
        wsBox.classList.remove('hidden');
        
        // 给父容器添加expanded类
        if (wsSection) {
          wsSection.classList.add('expanded');
        }
        // V2版本的折叠动画
        if (wsContent) {
          wsContent.classList.add('expanded');
        }
        wsBox.classList.add('expanded');
        wsToggle.classList.add('expanded');
        
        // 更新按钮文字
        const textSpan = wsToggle.querySelector('span');
        if (textSpan) textSpan.textContent = t('transfer.collapseStruct');
        else wsToggle.textContent = t('transfer.collapseStruct');
      } else {
        // 移除父容器的expanded类
        if (wsSection) {
          wsSection.classList.remove('expanded');
        }
        if (wsContent) {
          wsContent.classList.remove('expanded');
        }
        wsBox.classList.remove('expanded');
        wsToggle.classList.remove('expanded');

        setTimeout(() => {
          if (!wsBox.classList.contains('expanded')) {
            wsBox.classList.add('hidden');
          }
        }, 300);

        const textSpan = wsToggle.querySelector('span');
        if (textSpan) textSpan.textContent = t('transfer.expandStruct');
        else wsToggle.textContent = t('transfer.expandStruct');
      }
    });
    wsToggle.dataset._bind = '1';
  }
  
  // V2 Main Page - 高级选项折叠
  const optionsToggle = document.getElementById('optionsToggle');
  const optionsContent = document.getElementById('optionsContent');
  if (optionsToggle && optionsContent && !optionsToggle.dataset._bind) {
    optionsToggle.addEventListener('click', () => {
      const isActive = optionsToggle.classList.contains('active');
      if (isActive) {
        optionsToggle.classList.remove('active');
        optionsContent.classList.remove('show');
      } else {
        optionsToggle.classList.add('active');
        optionsContent.classList.add('show');
      }
    });
    optionsToggle.dataset._bind = '1';
  }
  
  // V2 Main Page - 地址管理卡片折叠
  const addressHeader = document.getElementById('addressHeader');
  if (addressHeader && !addressHeader.dataset._bind) {
    addressHeader.addEventListener('click', (e) => {
      // 避免点击按钮时触发折叠
      if (e.target.closest('.address-action-btn')) return;
      addressHeader.classList.toggle('collapsed');
    });
    addressHeader.dataset._bind = '1';
  }
  
  // V2 Main Page - 交易模式切换
  const modeTabsContainer = document.querySelector('.transfer-mode-tabs');
  if (modeTabsContainer && !modeTabsContainer.dataset._bind) {
    // 竖屏或窄屏时使用紧凑的单选下拉模式
    const isCompactMode = () => window.matchMedia('(max-width: 860px)').matches;
    const ensureDropdown = () => {
      let dd = modeTabsContainer.querySelector('.mode-dropdown');
      if (!dd) {
        dd = document.createElement('div');
        dd.className = 'mode-dropdown';
        modeTabsContainer.appendChild(dd);
      }
      return dd;
    };
    const rebuildDropdown = () => {
      const dd = ensureDropdown();
      const items = [];
      modeTabsContainer.querySelectorAll('.transfer-mode-tab').forEach(b => {
        if (!b.classList.contains('active')) {
          items.push(`<button class="mode-item" data-mode="${b.dataset.mode}">${b.textContent}</button>`);
        }
      });
      dd.innerHTML = items.join('');
    };
    const applyMode = (mode) => {
      modeTabsContainer.querySelectorAll('.transfer-mode-tab, .mode-tab').forEach(t => t.classList.remove('active'));
      const btn = modeTabsContainer.querySelector(`.transfer-mode-tab[data-mode="${mode}"]`);
      if (btn) btn.classList.add('active');
      const tfModeSelect = document.getElementById('tfMode');
      const isPledgeSelect = document.getElementById('isPledge');
      if (tfModeSelect) tfModeSelect.value = mode;
      if (isPledgeSelect) isPledgeSelect.value = mode === 'pledge' ? 'true' : 'false';
      const radios = document.querySelectorAll('input[name="tfModeChoice"]');
      radios.forEach(r => { r.checked = r.value === mode; });
    };
    const updateModeTabsLayout = () => {
      if (isCompactMode()) {
        modeTabsContainer.classList.add('compact');
        rebuildDropdown();
      } else {
        modeTabsContainer.classList.remove('compact');
        modeTabsContainer.classList.remove('open');
        const dd = modeTabsContainer.querySelector('.mode-dropdown');
        if (dd) dd.remove();
      }
    };
    modeTabsContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.transfer-mode-tab') || e.target.closest('.mode-tab');
      if (tab) {
        if (modeTabsContainer.classList.contains('compact') && tab.classList.contains('active')) {
          rebuildDropdown();
          modeTabsContainer.classList.toggle('open');
          return;
        }
        applyMode(tab.dataset.mode);
        return;
      }
      const item = e.target.closest('.mode-item');
      if (item) {
        applyMode(item.dataset.mode);
        modeTabsContainer.classList.remove('open');
      }
    });
    let layoutTimer;
    const onResize = () => { clearTimeout(layoutTimer); layoutTimer = setTimeout(updateModeTabsLayout, 50); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    updateModeTabsLayout();
    modeTabsContainer.dataset._bind = '1';
  }
  
  // V2 Main Page - 未加入担保组织警告弹窗事件处理
  const noOrgWarnBtn = document.getElementById('noOrgWarnBtn');
  const noOrgModal = document.getElementById('noOrgModal');
  const noOrgModalCancel = document.getElementById('noOrgModalCancel');
  const noOrgModalOk = document.getElementById('noOrgModalOk');
  
  if (noOrgWarnBtn && noOrgModal && !noOrgWarnBtn.dataset._bind) {
    // 显示弹窗
    const showNoOrgModal = () => {
      noOrgModal.classList.remove('hidden');
    };
    
    // 隐藏弹窗
    const hideNoOrgModal = () => {
      noOrgModal.classList.add('hidden');
    };
    
    // 警告按钮点击事件
    noOrgWarnBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showNoOrgModal();
    });
    
    // 点击遮罩层关闭
    noOrgModal.addEventListener('click', (e) => {
      if (e.target === noOrgModal) {
        hideNoOrgModal();
      }
    });
    
    // 取消按钮
    if (noOrgModalCancel) {
      noOrgModalCancel.addEventListener('click', hideNoOrgModal);
    }
    
    // 确认按钮 - 前往加入担保组织
    if (noOrgModalOk) {
      noOrgModalOk.addEventListener('click', () => {
        hideNoOrgModal();
        if (typeof routeTo === 'function') {
          routeTo('#/join-group');
        } else {
          window.location.hash = '#/join-group';
        }
      });
    }
    
    // ESC 键关闭弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !noOrgModal.classList.contains('hidden')) {
        hideNoOrgModal();
      }
    });
    
    noOrgWarnBtn.dataset._bind = '1';
  }
  
  // V2 Main Page - openCreateAddrBtn2 同步功能
  const openCreateAddrBtn2 = document.getElementById('openCreateAddrBtn2');
  const openCreateAddrBtn = document.getElementById('openCreateAddrBtn');
  if (openCreateAddrBtn2 && openCreateAddrBtn && !openCreateAddrBtn2.dataset._bind) {
    openCreateAddrBtn2.addEventListener('click', () => {
      openCreateAddrBtn.click();
    });
    openCreateAddrBtn2.dataset._bind = '1';
  }
  
  // V2 Main Page - 数字动画效果
  window.animateNumber = (element, targetValue, duration = 500) => {
    if (!element) return;
    
    const startValue = parseFloat(element.textContent) || 0;
    const startTime = performance.now();
    
    element.classList.add('updating');
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const currentValue = startValue + (targetValue - startValue) * easeProgress;
      
      element.textContent = currentValue.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.classList.remove('updating');
      }
    };
    
    requestAnimationFrame(animate);
  };
  
  // V2 Main Page - 更新地址数量显示
  const updateAddrCount = () => {
    const addrCount = document.getElementById('addrCount');
    const u = loadUser();
    if (addrCount && u && u.wallet && u.wallet.addressMsg) {
      const count = Object.keys(u.wallet.addressMsg).length;
      addrCount.textContent = t('wallet.addressCount', { count: count });
    }
  };
  updateAddrCount();
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
    const txResultActions = document.getElementById('txResultActions');
    const currentOrgId = (typeof computeCurrentOrgId === 'function' ? computeCurrentOrgId() : '');
    const hasOrg = !!String(currentOrgId || '').trim();
    if (tfModeQuick && tfModeQuick.parentNode) {
      const quickLabel = tfModeQuick.parentNode;
      const span = quickLabel.querySelector('.segment-content');
      if (span) {
        span.textContent = hasOrg ? '快速转账' : '普通交易';
      } else {
        const last = quickLabel.lastChild;
        if (last && last.nodeType === 3) {
          last.textContent = hasOrg ? ' 快速转账' : ' 普通交易';
        }
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
    const showTxValidationError = (msg, focusEl, title = '参数校验失败') => {
      if (txErr) {
        txErr.textContent = msg;
        txErr.classList.remove('hidden');
      }
      showModalTip(title, msg, true);
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
        const coinNames = { 0: 'PGC', 1: 'BTC', 2: 'ETH' };
        
        const icon = coinIcons[tId] || '₱';
        const color = coinColors[tId] || 'pgc';
        const coinName = coinNames[tId] || 'PGC';
        const coinLetter = coinName.charAt(0);
        
        // 地址缩略显示 (Compact View) - User requested full address
        const shortAddr = a;
        
        return `<label class="src-addr-item item-type-${color}" data-addr="${a}">
          <input type="checkbox" value="${a}">
          <div class="item-backdrop"></div>
          
          <div class="item-content">
              <div class="item-left">
                  <div class="coin-icon coin-icon--${color}">${coinLetter}</div>
                  <div class="addr-info">
                      <span class="addr-text" title="${a}">${shortAddr}</span>
                      <span class="coin-name-tiny">${coinName}</span>
                  </div>
              </div>
              
              <div class="item-right">
                  <span class="amount-num" title="${amt}">${amt}</span>
                  <div class="check-mark">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
              </div>
          </div>
          
          <div class="selection-outline"></div>
        </label>`;
      }).join('');
      
      // 自动选择逻辑：如果只有一个地址，或只有一个地址有余额，自动选中
      autoSelectFromAddress();
    };
    
    // 自动选择From地址的逻辑
    const autoSelectFromAddress = () => {
      const checkboxes = addrList.querySelectorAll('input[type="checkbox"]');
      const labels = addrList.querySelectorAll('label.src-addr-item');
      
      // 如果已经有选中的地址，不自动选择
      const alreadySelected = Array.from(checkboxes).some(cb => cb.checked);
      if (alreadySelected) return;
      
      // 情况1：只有一个地址，自动选中
      if (srcAddrs.length === 1) {
        const cb = checkboxes[0];
        const label = labels[0];
        if (cb && label) {
          cb.checked = true;
          label.classList.add('selected');
        }
        return;
      }
      
      // 情况2：有多个地址，但只有一个有余额，自动选中有余额的那个
      const addrsWithBalance = srcAddrs.filter(addr => {
        const meta = walletMap[addr];
        const amt = Number((meta && meta.value && meta.value.utxoValue) || 0);
        return amt > 0;
      });
      
      if (addrsWithBalance.length === 1) {
        const targetAddr = addrsWithBalance[0];
        labels.forEach((label, idx) => {
          if (label.dataset.addr === targetAddr) {
            const cb = checkboxes[idx];
            if (cb) {
              cb.checked = true;
              label.classList.add('selected');
            }
          }
        });
      }
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
          if (menu) menu.innerHTML = `<div class="custom-select__item disabled">${t('transfer.noAddressAvailable')}</div>`;
          if (valEl) valEl.textContent = t('transfer.noAddressAvailable');
          if (hidden) hidden.value = '';
          const ico0 = box.querySelector('.coin-icon');
          if (ico0) ico0.remove();
          return;
        }

        if (menu) menu.innerHTML = optsArr.map(a => `<div class="custom-select__item" data-val="${a}"><code class="break">${a}</code></div>`).join('');

        // Preserve existing selection if valid, otherwise select first
        const currentVal = hidden.value;
        const isValid = optsArr.includes(currentVal);
        const first = isValid ? currentVal : (optsArr[0] || '');

        if (valEl) valEl.textContent = first;
        if (hidden) hidden.value = first;
        const ico = box.querySelector('.coin-icon');
        if (ico) ico.remove();
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
      const cards = Array.from(billList.querySelectorAll('.recipient-card'));
      const onlyOne = cards.length <= 1;
      cards.forEach(card => {
        const btn = card.querySelector('[data-role="remove"]');
        if (btn) {
          btn.disabled = onlyOne;
          if (onlyOne) {
            btn.setAttribute('title', t('transfer.cannotDeleteLast'));
            btn.setAttribute('aria-disabled', 'true');
          } else {
            btn.removeAttribute('title');
            btn.removeAttribute('aria-disabled');
          }
        }
      });
    };
    
    // 更新卡片索引
    const updateCardIndices = () => {
      const cards = billList.querySelectorAll('.recipient-card');
      cards.forEach((card, idx) => {
        card.setAttribute('data-index', idx + 1);
      });
    };
    
    const addBill = () => {
      const g = computeCurrentOrgId() || '';
      const card = document.createElement('div');
      card.className = 'recipient-card';
      const idBase = `bill_${Date.now()}_${billSeq++}`;
      const cardIndex = billList.querySelectorAll('.recipient-card').length + 1;
      card.setAttribute('data-index', cardIndex);
      
      card.innerHTML = `
        <div class="recipient-content">
          <!-- 主要区域：地址 -->
          <div class="recipient-main">
            <div class="recipient-addr-field">
              <span class="recipient-field-label">${t('transfer.recipientAddress')}</span>
              <div class="recipient-addr-input-wrap">
                <input id="${idBase}_to" class="input" type="text" placeholder="${t('transfer.enterRecipientAddress')}" aria-label="目标地址" data-name="to">
                <button type="button" class="recipient-lookup-btn" aria-label="查询地址信息" title="自动补全担保组织与公钥" data-role="addr-lookup">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <span class="lookup-spinner"></span>
                </button>
              </div>
            </div>
          </div>
          
          <!-- 金额和币种 -->
          <div class="recipient-amount-row">
            <div class="recipient-field">
              <span class="recipient-field-label">${t('transfer.amount')}</span>
              <input id="${idBase}_val" class="input" type="number" placeholder="0.00" aria-label="金额" data-name="val">
            </div>
            <div class="recipient-field">
              <span class="recipient-field-label">${t('transfer.currency')}</span>
              <div id="${idBase}_mt" class="recipient-coin-select" role="button" aria-label="币种" data-name="mt" data-val="0">
                <div class="recipient-coin-value">
                  <span class="coin-label">PGC</span>
                  <span class="recipient-coin-arrow">▾</span>
                </div>
                <div class="recipient-coin-menu">
                  <div class="recipient-coin-item" data-val="0"><span class="coin-label">PGC</span></div>
                  <div class="recipient-coin-item" data-val="1"><span class="coin-label">BTC</span></div>
                  <div class="recipient-coin-item" data-val="2"><span class="coin-label">ETH</span></div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 可折叠的详情区 -->
          <div class="recipient-details">
            <div class="recipient-details-inner">
              <div class="recipient-details-content">
                <div class="recipient-field">
                  <span class="recipient-field-label">${t('transfer.publicKey')}</span>
                  <input id="${idBase}_pub" class="input" type="text" placeholder="04 + X + Y or X,Y" aria-label="公钥" data-name="pub">
                </div>
                <div class="recipient-details-row">
                  <div class="recipient-field">
                    <span class="recipient-field-label">${t('transfer.guarantorOrgId')}</span>
                    <input id="${idBase}_gid" class="input" type="text" placeholder="${t('transfer.optional')}" value="" aria-label="担保组织ID" data-name="gid">
                  </div>
                  <div class="recipient-field">
                    <span class="recipient-field-label">${t('transfer.transferGas')}</span>
                    <input id="${idBase}_gas" class="input" type="number" placeholder="0" aria-label="转移Gas" data-name="gas">
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 底部操作栏 -->
          <div class="recipient-actions">
            <button type="button" class="recipient-expand-btn" data-role="expand">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              <span>${t('wallet.advancedOptions')}</span>
            </button>
            <button type="button" class="recipient-remove-btn" data-role="remove">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <span>${t('transfer.delete')}</span>
            </button>
            <button type="button" class="recipient-add-btn" data-role="add">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>${t('transfer.addRecipient')}</span>
            </button>
          </div>
        </div>
      `;
      
      const addrInputEl = card.querySelector('[data-name="to"]');
      const gidInputEl = card.querySelector('[data-name="gid"]');
      const pubInputEl = card.querySelector('[data-name="pub"]');
      const lookupBtn = card.querySelector('[data-role="addr-lookup"]');
      const expandBtn = card.querySelector('[data-role="expand"]');
      const removeBtn = card.querySelector('[data-role="remove"]');
      const addBtn = card.querySelector('[data-role="add"]');
      
      // 地址查询按钮
      if (lookupBtn && addrInputEl) {
        lookupBtn.addEventListener('click', async () => {
          if (lookupBtn.dataset.loading === '1') return;
          const raw = addrInputEl.value || '';
          const normalized = normalizeAddrInput(raw);
          if (!normalized) {
            showTxValidationError(t('modal.pleaseEnterPrivateKeyHex'), addrInputEl, t('tx.addressEmpty'));
            return;
          }
          if (!isValidAddressFormat(normalized)) {
            showTxValidationError(t('tx.addressFormatErrorDesc'), addrInputEl, t('tx.addressFormatError'));
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
              showMiniToast(t('tx.addressNotFound'), 'error');
              return;
            }
            if (pubInputEl && info.pubKey) {
              pubInputEl.value = info.pubKey;
            }
            if (gidInputEl) {
              gidInputEl.value = info.groupId || '';
            }
            // 查询成功后自动展开详情区显示结果
            if (info.pubKey || info.groupId) {
              card.classList.add('expanded');
              const hasKey = info.pubKey ? '公钥' : '';
              const hasOrg = info.groupId ? '担保组织' : '';
              const found = [hasKey, hasOrg].filter(Boolean).join('、');
              showMiniToast(`已获取${found}信息`, 'success');
            }
          } catch (e) {
            showMiniToast(t('tx.queryFailed'), 'error');
          } finally {
            lookupBtn.disabled = false;
            lookupBtn.classList.remove('is-loading');
            delete lookupBtn.dataset.loading;
          }
        });
      }
      
      // 展开/折叠按钮
      if (expandBtn) {
        expandBtn.addEventListener('click', () => {
          card.classList.toggle('expanded');
          const label = expandBtn.querySelector('span');
          if (label) {
            label.textContent = card.classList.contains('expanded') ? t('transfer.collapseOptions') : t('wallet.advancedOptions');
          }
        });
      }
      
      // 删除按钮
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          const cards = billList.querySelectorAll('.recipient-card');
          if (cards.length <= 1) return;
          card.style.animation = 'recipientCardExit 0.25s ease forwards';
          setTimeout(() => {
            card.remove();
            updateCardIndices();
            updateRemoveState();
          }, 250);
        });
      }

      // 添加按钮（移动至删除按钮右侧）
      if (addBtn) {
        addBtn.addEventListener('click', () => { addBill(); });
      }
      
      billList.appendChild(card);
      updateCardIndices();
      updateRemoveState();
      
      // 币种选择器
      const cs = card.querySelector('#' + idBase + '_mt');
      if (cs) {
        cs.addEventListener('click', (e) => { e.stopPropagation(); cs.classList.toggle('open'); });
        const menu = cs.querySelector('.recipient-coin-menu');
        if (menu) {
          menu.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const item = ev.target.closest('.recipient-coin-item');
            if (!item) return;
            const v = item.getAttribute('data-val');
            cs.dataset.val = v;
            const valEl = cs.querySelector('.recipient-coin-value');
            if (valEl) {
              const labels = { '0': { t: 'PGC' }, '1': { t: 'BTC' }, '2': { t: 'ETH' } };
              const m = labels[v] || labels['0'];
              valEl.innerHTML = `<span class="coin-label">${m.t}</span><span class="recipient-coin-arrow">▾</span>`;
            }
            cs.classList.remove('open');
          });
        }
        document.addEventListener('click', () => { cs.classList.remove('open'); });
      }
      
      // 回车添加新收款方
      const gasInputEl = card.querySelector('[data-name="gas"]');
      if (gasInputEl) { 
        gasInputEl.addEventListener('keydown', (e) => { 
          if (e.key === 'Enter') { e.preventDefault(); addBill(); } 
        }); 
      }
    };
    if (addBillBtn) { addBillBtn.addEventListener('click', () => { addBill(); }); }
    addBill();
    updateRemoveState();
    const updateBtn = () => {
      tfBtn.textContent = t('transfer.generateTxStruct');
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
      // 隐藏之前的交易结果按钮
      const txResultActions = document.getElementById('txResultActions');
      const viewTxInfoBtn = document.getElementById('viewTxInfoBtn');
      if (txResultActions) txResultActions.classList.add('hidden');
      if (viewTxInfoBtn) viewTxInfoBtn.classList.add('hidden');
      
      const sel = Array.from(addrList.querySelectorAll('input[type="checkbox"]')).filter(x => x.checked).map(x => x.value);
      if (sel.length === 0) { showTxValidationError(t('modal.pleaseLoginFirst'), null, t('tx.addressNotSelected')); return; }
      for (const addr of sel) {
        if (!getAddrMeta(addr)) {
          showTxValidationError(t('toast.cannotParseAddress'), null, t('tx.addressError'));
          return;
        }
      }
      const rows = Array.from(billList.querySelectorAll('.recipient-card'));
      if (rows.length === 0) { showTxValidationError(t('wallet.addRecipient'), null, t('tx.missingTransferInfo')); return; }
      const isCross = tfMode.value === 'cross';
      if (isCross && rows.length !== 1) { showTxValidationError(t('wallet.crossChain'), null, t('tx.crossChainLimit')); return; }
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
        if (!to || val <= 0) { showTxValidationError(t('modal.inputIncomplete'), toEl, t('tx.incompleteInfo')); return; }
        if (!isValidAddressFormat(normalizedTo)) { showTxValidationError(t('toast.cannotParseAddress'), toEl, t('tx.addressFormatError')); return; }
        if (![0, 1, 2].includes(mt)) { showTxValidationError(t('transfer.currency'), null, t('tx.currencyError')); return; }
        if (gid && !/^\d{8}$/.test(gid)) { showTxValidationError(t('transfer.guarantorOrgId'), gidEl, t('tx.orgIdFormatError')); return; }
        if (!pubOk) { showTxValidationError(t('transfer.publicKey'), pubEl, t('tx.publicKeyFormatError')); return; }
        if (!Number.isFinite(val) || val <= 0) { showTxValidationError(t('transfer.amount'), valEl, t('tx.amountError')); return; }
        if (!Number.isFinite(tInt) || tInt < 0) { showTxValidationError('Gas', gasEl, t('tx.gasParamError')); return; }
        if (isCross && mt !== 0) { showTxValidationError(t('wallet.crossChain'), null, t('tx.crossChainLimit')); return; }
        if (bills[normalizedTo]) { showTxValidationError(t('toast.addressExists'), null, t('tx.duplicateAddress')); return; }
        bills[normalizedTo] = { MoneyType: mt, Value: val, GuarGroupID: gid, PublicKey: { Curve: 'P256', XHex: px, YHex: py }, ToInterest: tInt };
        vd[mt] += val;
        outInterest += Math.max(0, tInt || 0);
      }
      const extraPGC = Number(gasInput.value || 0);
      if (!Number.isFinite(extraPGC) || extraPGC < 0) { showTxValidationError(t('wallet.extraGas'), gasInput, t('tx.gasParamError')); return; }
      const interestGas = extraPGC > 0 ? extraPGC : 0;
      vd[0] += extraPGC;
      const baseTxGas = Number((txGasInput && txGasInput.value) ? txGasInput.value : 1);
      if (!Number.isFinite(baseTxGas) || baseTxGas < 0) { showTxValidationError(t('wallet.txGas'), txGasInput, t('tx.gasParamError')); return; }
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
        if (!addr) { showTxValidationError(`${currencyLabels[typeId]} ${t('transfer.pgcReceiveAddress')}`, null, t('tx.changeAddressMissing')); return false; }
        const meta = getAddrMeta(addr);
        if (!meta) { showTxValidationError(t('transfer.noAddressAvailable'), null, t('tx.changeAddressError')); return false; }
        if (Number(meta.type || 0) !== Number(typeId)) { showTxValidationError(`${currencyLabels[typeId]} ${t('transfer.currency')}`, null, t('tx.changeAddressError')); return false; }
        return true;
      };
      if (![0, 1, 2].every((t) => (typeBalances[t] || 0) + 1e-8 >= (vd[t] || 0))) {
        const lackType = [0, 1, 2].find((t) => (typeBalances[t] || 0) + 1e-8 < (vd[t] || 0)) ?? 0;
        showTxValidationError(`${currencyLabels[lackType]} ${t('tx.insufficientBalance')}`, null, t('tx.insufficientBalance'));
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
        showModalTip(t('toast.addressOptimized'), tipHtml, false);
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
      if (isCross && finalSel.length !== 1) { showTxValidationError('跨链交易只能有一个来源地址', null, '跨链交易限制'); return; }
      if (isCross && !changeMap[0]) { showTxValidationError('请为跨链交易选择主货币找零地址', null, '找零地址缺失'); return; }
      
      // 保存交易结构体数据并显示查看按钮
      if (txResultActions) {
        txResultActions.classList.remove('hidden');
        const viewBuildInfoBtn = document.getElementById('viewBuildInfoBtn');
        if (viewBuildInfoBtn) {
          viewBuildInfoBtn.dataset.txData = JSON.stringify(build, null, 2);
        }
      }

      // 显示"构造交易"按钮并保存 BuildTXInfo
      const buildTxBtn = document.getElementById('buildTxBtn');
      if (buildTxBtn) {
        buildTxBtn.classList.remove('hidden');
        buildTxBtn.dataset.buildInfo = JSON.stringify(build);
      }
    });

    // 绑定"构造交易"按钮事件
    const buildTxBtn = document.getElementById('buildTxBtn');
    if (buildTxBtn && !buildTxBtn.dataset._buildBind) {
      buildTxBtn.addEventListener('click', async () => {
        try {
          showModalTip(t('transfer.generateTxStruct'), t('toast.buildingTx'), false);

          const buildInfoStr = buildTxBtn.dataset.buildInfo || '{}';
          const buildInfo = JSON.parse(buildInfoStr);
          const user = loadUser();

          if (!user || !user.accountId) {
            showModalTip(t('common.notLoggedIn'), t('modal.pleaseLoginFirst'), true);
            return;
          }

          // 调用 buildNewTX 构造交易
          const transaction = await buildNewTX(buildInfo, user);

          // 保存交易数据并显示查看按钮
          const viewTxInfoBtn = document.getElementById('viewTxInfoBtn');
          if (viewTxInfoBtn) {
            viewTxInfoBtn.dataset.txData = JSON.stringify(transaction, null, 2);
            viewTxInfoBtn.classList.remove('hidden');
          }

          showModalTip(t('toast.buildTxSuccess'), t('toast.buildTxSuccessDesc'), false);
        } catch (err) {
          const errMsg = err.message || String(err);
          showModalTip(t('toast.buildTxFailed'), errMsg, true);
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

  // 交易详情弹窗逻辑
  const setupTxDetailModal = () => {
    const modal = document.getElementById('txDetailModal');
    const titleEl = document.getElementById('txDetailTitle');
    const contentEl = document.getElementById('txDetailContent');
    const closeBtn = document.getElementById('txDetailClose');
    const copyBtn = document.getElementById('txDetailCopy');
    const okBtn = document.getElementById('txDetailOk');
    const viewBuildInfoBtn = document.getElementById('viewBuildInfoBtn');
    const viewTxInfoBtn = document.getElementById('viewTxInfoBtn');
    
    if (!modal) return;
    
    const showTxDetail = (title, data) => {
      if (titleEl) titleEl.textContent = title;
      if (contentEl) {
        // 语法高亮 JSON
        const highlighted = data
          .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
          .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
          .replace(/: (\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
          .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>');
        contentEl.innerHTML = highlighted;
      }
      modal.classList.remove('hidden');
    };
    
    const hideTxDetail = () => {
      modal.classList.add('hidden');
    };
    
    // 查看交易结构体按钮
    if (viewBuildInfoBtn) {
      viewBuildInfoBtn.addEventListener('click', () => {
        const data = viewBuildInfoBtn.dataset.txData || '{}';
        showTxDetail('BuildTXInfo 交易结构体', data);
      });
    }
    
    // 查看交易信息按钮
    if (viewTxInfoBtn) {
      viewTxInfoBtn.addEventListener('click', () => {
        const data = viewTxInfoBtn.dataset.txData || '{}';
        showTxDetail('Transaction 交易信息', data);
      });
    }
    
    // 关闭按钮
    if (closeBtn) {
      closeBtn.addEventListener('click', hideTxDetail);
    }
    
    // 确定按钮
    if (okBtn) {
      okBtn.addEventListener('click', hideTxDetail);
    }
    
    // 复制按钮
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const text = contentEl ? contentEl.textContent : '';
        try {
          await navigator.clipboard.writeText(text);
          const originalText = copyBtn.querySelector('span');
          if (originalText) {
            const oldText = originalText.textContent;
            originalText.textContent = t('wallet.copied');
            setTimeout(() => {
              originalText.textContent = oldText;
            }, 1500);
          }
        } catch (err) {
          console.error('复制失败:', err);
        }
      });
    }
    
    // 点击遮罩关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideTxDetail();
      }
    });
  };
  setupTxDetailModal();

  // Fallback: 委托事件，确保地址选择器可打开并选择
  document.addEventListener('click', (ev) => {
    const box = ev.target.closest('.custom-select.cs-addr');
    if (!box) return;
    ev.stopPropagation();
    const opening = !box.classList.contains('open');
    box.classList.toggle('open', opening);
  });
  document.addEventListener('click', (ev) => {
    const item = ev.target.closest('.custom-select.cs-addr .custom-select__item');
    if (!item) return;
    ev.stopPropagation();
    const box = item.closest('.custom-select.cs-addr');
    const v = item.getAttribute('data-val') || '';
    const valEl = box ? box.querySelector('.addr-val') : null;
    if (valEl) valEl.textContent = v;
    const coin = box ? (box.dataset.coin || '') : '';
    const hidden = document.getElementById('chAddr' + coin);
    if (hidden) hidden.value = v;
    if (box) box.classList.remove('open');
  });

  const openCreateAddrBtnModal = document.getElementById('openCreateAddrBtn');
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
    if (addrTitle) addrTitle.textContent = mode === 'import' ? t('walletModal.importAddress') : t('walletModal.createAddress');
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
  if (openCreateAddrBtnModal) {
    openCreateAddrBtnModal.onclick = () => showAddrModal('create');
  }
  if (openImportAddrBtn) {
    openImportAddrBtn.onclick = () => showAddrModal('import');
  }
  if (addrCancelBtn) {
    addrCancelBtn.onclick = hideAddrModal;
  }
  const importAddressInPlace = async (priv) => {
    const u2 = loadUser();
    if (!u2 || !u2.accountId) { showModalTip(t('common.notLoggedIn'), t('modal.pleaseLoginFirst'), true); return; }
    const ov = document.getElementById('actionOverlay');
    const ovt = document.getElementById('actionOverlayText');
    if (ovt) ovt.textContent = t('modal.addingWalletAddress');
    if (ov) ov.classList.remove('hidden');
    try {
      const data = await importFromPrivHex(priv);
      const acc = toAccount({ accountId: u2.accountId, address: u2.address }, u2);
      const addr = (data.address || '').toLowerCase();
      if (!addr) { showModalTip(t('toast.importFailed'), t('toast.cannotParseAddress'), true); return; }
      const map = (acc.wallet && acc.wallet.addressMsg) || {};
      let dup = false;
      const lowerMain = (u2.address || '').toLowerCase();
      if (lowerMain && lowerMain === addr) dup = true;
      if (!dup) {
        for (const k in map) { if (Object.prototype.hasOwnProperty.call(map, k)) { if (String(k).toLowerCase() === addr) { dup = true; break; } } }
      }
      if (dup) { showModalTip(t('toast.importFailed'), t('toast.addressExists'), true); return; }
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
      if (title) title.textContent = t('modal.walletAddSuccess');
      if (text) { text.textContent = t('modal.walletAddSuccessDesc'); text.classList.remove('tip--error'); }
      if (modal) modal.classList.remove('hidden');
      if (ok) {
        const handler = () => {
          modal && modal.classList.add('hidden');
          ok.removeEventListener('click', handler);
        };
        ok.addEventListener('click', handler);
      }
    } catch (err) {
      showModalTip(t('toast.importFailed'), t('toast.importFailed') + '：' + (err && err.message ? err.message : err), true);
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
          setAddrError(t('walletModal.pleaseEnterPrivateKey'));
          if (input) input.focus();
          return;
        }
        const normalized = v.replace(/^0x/i, '');
        if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
          setAddrError(t('walletModal.privateKeyFormatError'));
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
  el.textContent = t('wallet.syncing');
  await wait(150);
  const gid = computeCurrentOrgId();
  el.textContent = gid || t('header.noOrg');
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
  
  // 更新新的交易模式切换UI
  const modeTabsContainer = document.getElementById('transferModeTabs');
  const noOrgWarning = document.getElementById('noOrgWarning');
  
  if (modeTabsContainer) {
    if (hasOrg) {
      // 已加入担保组织 - 显示完整模式切换
      modeTabsContainer.classList.remove('no-org-mode');
    } else {
      // 未加入担保组织 - 显示简化模式 + 警告
      modeTabsContainer.classList.add('no-org-mode');
    }
  }
  
  if (tfModeQuick && tfModeQuick.parentNode) {
    const quickLabel = tfModeQuick.parentNode;
    const span = quickLabel.querySelector('.segment-content');
    if (span) {
      span.textContent = hasOrg ? '快速转账' : '普通交易';
    } else {
      const last = quickLabel.lastChild;
      if (last && last.nodeType === 3) {
        last.textContent = hasOrg ? ' 快速转账' : ' 普通交易';
      }
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
// ECDSA 签名原始数据（WebCrypto 会自动计算 SHA-256 然后签名）
// 这与 Go 的 ecdsa.Sign(rand, key, sha256(data)) 等效
async function ecdsaSignData(privateKeyHex, data, pubXHex = null, pubYHex = null) {
  try {
    // 1. 从 Hex 导入私钥
    const privBytes = hexToBytes(privateKeyHex);

    // 2. 构造 JWK 格式的私钥
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      d: bytesToBase64url(privBytes),
      ext: true
    };

    // 如果提供了公钥坐标，添加到 JWK 中
    if (pubXHex && pubYHex) {
      const pubXBytes = hexToBytes(pubXHex);
      const pubYBytes = hexToBytes(pubYHex);
      jwk.x = bytesToBase64url(pubXBytes);
      jwk.y = bytesToBase64url(pubYBytes);
    }

    // 3. 导入私钥
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    // 4. 签名 - WebCrypto 会自动计算 SHA-256(data) 然后签名
    // 这与 Go 的 ecdsa.Sign(rand, key, sha256(data)) 等效
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      data
    );

    // 5. 解析签名为 r, s
    const { r, s } = parseECDSASignature(new Uint8Array(signature));

    return { R: r, S: s };
  } catch (err) {
    console.error('ECDSA 签名失败:', err);
    throw new Error('ECDSA signature failed: ' + err.message);
  }
}

// ECDSA 签名已计算的哈希值（用于 UTXO Output 签名等场景）
// 注意：WebCrypto 不支持直接签名预计算的哈希，它会再次哈希
// 所以这个函数实际上会导致双重哈希，仅用于需要签名哈希值的特殊场景
async function ecdsaSignHash(privateKeyHex, hashBytes, pubXHex = null, pubYHex = null) {
  try {
    // 1. 从 Hex 导入私钥
    const privBytes = hexToBytes(privateKeyHex);

    // 2. 构造 JWK 格式的私钥（需要公钥坐标 x, y）
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      d: bytesToBase64url(privBytes),
      ext: true
    };

    // 如果提供了公钥坐标，添加到 JWK 中
    if (pubXHex && pubYHex) {
      const pubXBytes = hexToBytes(pubXHex);
      const pubYBytes = hexToBytes(pubYHex);
      jwk.x = bytesToBase64url(pubXBytes);
      jwk.y = bytesToBase64url(pubYHex);
    }

    // 3. 导入私钥
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    // 4. 签名
    // ⚠️ 注意：WebCrypto 会对 hashBytes 再做一次 SHA-256！
    // 如果 hashBytes 已经是哈希值，结果将是 sign(SHA256(hash))，不是 sign(hash)
    // 这是 WebCrypto 的限制，无法绕过
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

// ==================== Backend Compatibility Helpers ====================

function hexToDecimal(hex) {
  if (!hex) return null;
  try {
    return BigInt('0x' + hex).toString(10);
  } catch (e) {
    return null;
  }
}

function toBase64(uint8Arr) {
  if (!uint8Arr || uint8Arr.length === 0) return null;
  let binary = '';
  const len = uint8Arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Arr[i]);
  }
  return btoa(binary);
}

// Sort object keys alphabetically (to match Go's json.Marshal map ordering)
function sortObjectKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = obj[key];
  });
  return sorted;
}

// Map frontend objects to backend struct structure (Ordered Keys & Type Conversion)
function mapToBackend(data, type) {
  if (!data) return null;

  if (type === 'Transaction') {
    // Filter inputs/outputs like backend GetTXHash
    const txInputs = (data.TXInputsNormal || []).filter(i => !i.IsGuarMake).map(i => mapToBackend(i, 'TXInputNormal'));
    const txOutputs = (data.TXOutputs || []).filter(o => !o.IsGuarMake).map(o => mapToBackend(o, 'TXOutput'));

    // Handle nulls for empty slices
    const inputsCert = (!data.TXInputsCertificate || data.TXInputsCertificate.length === 0) ? null : data.TXInputsCertificate.map(i => mapToBackend(i, 'TXInputNormal'));
    const dataField = (!data.Data || data.Data.length === 0) ? null : toBase64(new Uint8Array(data.Data));

    return {
      TXID: data.TXID || "",
      Size: data.Size || 0,
      Version: data.Version || 0,
      GuarantorGroup: data.GuarantorGroup || "",
      TXType: data.TXType || 0,
      Value: data.Value || 0,
      ValueDivision: sortObjectKeys(data.ValueDivision) || null,
      NewValue: data.NewValue || 0,
      NewValueDiv: sortObjectKeys(data.NewValueDiv) || null,
      InterestAssign: mapToBackend(data.InterestAssign, 'InterestAssign'),
      UserSignature: mapToBackend(data.UserSignature, 'EcdsaSignature'),
      TXInputsNormal: txInputs.length > 0 ? txInputs : null,
      TXInputsCertificate: inputsCert,
      TXOutputs: txOutputs.length > 0 ? txOutputs : null,
      Data: dataField
    };
  }

  if (type === 'TXInputNormal') {
    return {
      FromTXID: data.FromTXID || "",
      FromTxPosition: mapToBackend(data.FromTxPosition, 'TxPosition'),
      FromAddress: data.FromAddress || "",
      IsGuarMake: !!data.IsGuarMake,
      IsCommitteeMake: !!data.IsCommitteeMake,
      IsCrossChain: !!data.IsCrossChain,
      InputSignature: mapToBackend(data.InputSignature, 'EcdsaSignature'),
      TXOutputHash: (data.TXOutputHash && data.TXOutputHash.length > 0) ? toBase64(new Uint8Array(data.TXOutputHash)) : null
    };
  }

  if (type === 'TXOutput') {
    return {
      ToAddress: data.ToAddress || "",
      ToValue: data.ToValue || 0,
      ToGuarGroupID: data.ToGuarGroupID || "",
      ToPublicKey: mapToBackend(data.ToPublicKey, 'PublicKeyNew'),
      ToInterest: data.ToInterest || 0,
      Type: data.Type || 0,
      ToPeerID: data.ToPeerID || "",
      IsPayForGas: !!data.IsPayForGas,
      IsCrossChain: !!data.IsCrossChain,
      IsGuarMake: !!data.IsGuarMake
    };
  }

  if (type === 'PublicKeyNew') {
    if (!data) return { CurveName: "", X: null, Y: null }; // Zero value
    const xHex = data.XHex || data.X;
    const yHex = data.YHex || data.Y;
    const xDecimal = hexToDecimal(xHex);
    const yDecimal = hexToDecimal(yHex);
    return {
      CurveName: data.CurveName || data.Curve || "",
      X: xDecimal ? "@@BIGINT@@" + xDecimal : null,
      Y: yDecimal ? "@@BIGINT@@" + yDecimal : null
    };
  }

  if (type === 'EcdsaSignature') {
    if (!data) return { R: null, S: null };
    return {
      R: data.R ? "@@BIGINT@@" + hexToDecimal(data.R) : null,
      S: data.S ? "@@BIGINT@@" + hexToDecimal(data.S) : null
    };
  }

  if (type === 'TxPosition') {
    return {
      Blocknum: data.Blocknum || 0,
      IndexX: data.IndexX || 0,
      IndexY: data.IndexY || 0,
      IndexZ: data.IndexZ || 0
    };
  }

  if (type === 'InterestAssign') {
    return {
      Gas: data.Gas || 0,
      Output: data.Output || 0,
      BackAssign: sortObjectKeys(data.BackAssign) || null
    };
  }

  return data;
}

function serializeStruct(data, type, excludeFields = []) {
  const mapped = mapToBackend(data, type);

  // Handle excluded fields by setting to zero values
  excludeFields.forEach(field => {
    if (field === 'Size') mapped.Size = 0;
    if (field === 'NewValue') mapped.NewValue = 0;
    if (field === 'UserSignature') mapped.UserSignature = { R: null, S: null };
    if (field === 'TXType') mapped.TXType = 0;
  });

  let json = JSON.stringify(mapped);

  // Replace BigInt placeholders with unquoted numbers
  json = json.replace(/"@@BIGINT@@(\d+)"/g, '$1');

  return new TextEncoder().encode(json);
}

// 获取 TXOutput 的序列化数据（用于签名）
function getTXOutputSerializedData(output) {
  return serializeStruct(output, 'TXOutput');
}

// 计算 TXOutput 的哈希
async function getTXOutputHash(output) {
  try {
    const data = getTXOutputSerializedData(output);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  } catch (err) {
    console.error('TXOutput 哈希计算失败:', err);
    throw new Error('Failed to calculate TXOutput hash: ' + err.message);
  }
}

// 计算交易哈希 (Internal) - 返回序列化数据用于签名
function getTXSerializedData(tx) {
  // Exclude fields: Size, NewValue, UserSignature, TXType
  return serializeStruct(tx, 'Transaction', ['Size', 'NewValue', 'UserSignature', 'TXType']);
}

// 计算交易哈希 (Internal)
async function getTXHash(tx) {
  const data = getTXSerializedData(tx);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

// 计算交易 TXID
async function getTXID(tx) {
  try {
    const hashBytes = await getTXHash(tx);
    return bytesToHex(hashBytes);
  } catch (err) {
    console.error('TXID 计算失败:', err);
    throw new Error('Failed to calculate TXID: ' + err.message);
  }
}

// 计算交易 Size
function getTXSize(tx) {
  try {
    const data = serializeStruct(tx, 'Transaction', ['Size']);
    return data.length;
  } catch (err) {
    console.error('交易 Size 计算失败:', err);
    return 0;
  }
}

// 计算交易的用户签名
async function getTXUserSignature(tx, privateKeyHex, pubXHex = null, pubYHex = null) {
  try {
    // Save TXID and clear it for hash calculation to match backend logic
    // Backend calculates signature BEFORE setting TXID, so TXID is empty string during signing
    const originalTXID = tx.TXID;
    tx.TXID = "";

    // 获取序列化数据（WebCrypto 会自动计算 SHA-256）
    const serializedData = getTXSerializedData(tx);

    // Restore TXID
    tx.TXID = originalTXID;

    // 传入原始序列化数据，ecdsaSignData 内部会进行 SHA-256 哈希然后签名
    const signature = await ecdsaSignData(privateKeyHex, serializedData, pubXHex, pubYHex);
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
        const utxos = addrData.utxos || addrData.utxo || addrData.UTXO || {};
        for (const [utxoId, utxoData] of Object.entries(utxos)) {
          const input = {
            FromTXID: utxoData.utxo?.TXID || utxoData.UTXO?.TXID || utxoData.TXID || '',
            FromTxPosition: utxoData.position || utxoData.Position || { IndexZ: 0 },
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
              // 补充 UTXO output 中可能缺失的 ToPublicKey
              const outputForHash = { ...outputs[posIdx] };
              if (!outputForHash.ToPublicKey || (!outputForHash.ToPublicKey.XHex && !outputForHash.ToPublicKey.X)) {
                // 如果 output 的目标地址是当前地址，从账户信息补充公钥
                if (outputForHash.ToAddress === address && addrData.pubXHex && addrData.pubYHex) {
                  outputForHash.ToPublicKey = {
                    Curve: 'P256',
                    XHex: addrData.pubXHex,
                    YHex: addrData.pubYHex
                  };
                }
              }
              // 获取序列化数据和哈希
              const serializedData = getTXOutputSerializedData(outputForHash);
              const hashBytes = await getTXOutputHash(outputForHash);
              input.TXOutputHash = Array.from(hashBytes);

              const privKeyHex = addrData.privHex || addrData.wPrivateKey || '';
              if (privKeyHex) {
                const pubXHex = addrData.pubXHex || '';
                const pubYHex = addrData.pubYHex || '';
                // 传入原始序列化数据，让 WebCrypto 自动计算 SHA-256 后签名
                // 这与 Go 的 ecdsa.Sign(key, SHA256(data)) 等效
                const sig = await ecdsaSignData(privKeyHex, serializedData, pubXHex, pubYHex);
                input.InputSignature = { R: sig.R, S: sig.S };
              }
            }
          } catch (err) {
            console.warn(`Failed to sign UTXO ${utxoId}:`, err);
          }

          tx.TXInputsNormal.push(input);

          const utxoValue = Number(utxoData.value || utxoData.Value || 0);
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


    // 交易签名 - 使用 Account 的主公私钥，而不是子地址的密钥
    if (tx.TXInputsNormal.length > 0) {
      // ✓ 使用 Account 的主密钥，不是子地址的密钥
      const accountPrivHex = userAccount.keys?.privHex || '';
      const accountPubXHex = userAccount.keys?.pubXHex || '';
      const accountPubYHex = userAccount.keys?.pubYHex || '';

      if (accountPrivHex) {
        tx.UserSignature = await getTXUserSignature(tx, accountPrivHex, accountPubXHex, accountPubYHex);
      } else {
        console.warn('Account 主密钥未找到，无法签名交易');
      }
    }


    return tx;
  } catch (err) {
    console.error('BuildNewTX failed:', err);
    throw err;
  }
}

// UTXO Detail Modal Logic
window.showUtxoDetail = (addrKey, utxoKey) => {
  const u = loadUser();
  if (!u || !u.wallet || !u.wallet.addressMsg) return;

  const addrData = u.wallet.addressMsg[addrKey];
  if (!addrData || !addrData.utxos) return;

  const utxoData = addrData.utxos[utxoKey];
  if (!utxoData) return;

  // Create modal if not exists
  let modal = document.getElementById('utxoDetailModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'utxoDetailModal';
    modal.className = 'utxo-modal';
    modal.innerHTML = `
      <div class="utxo-modal-content">
        <div class="utxo-modal-header">
          <h3 class="utxo-modal-title"><span>💎</span> UTXO 详情</h3>
          <button class="utxo-modal-close" onclick="window.closeUtxoModal()">×</button>
        </div>
        <div class="utxo-modal-body" id="utxoModalBody"></div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close on click outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) window.closeUtxoModal();
    });
  }

  const body = document.getElementById('utxoModalBody');
  body.innerHTML = `<pre style="font-family:monospace;font-size:12px;color:#334155;white-space:pre-wrap;word-break:break-all;">${JSON.stringify(utxoData, null, 2)}</pre>`;

  // Force reflow
  void modal.offsetWidth;
  modal.classList.add('active');
};

window.closeUtxoModal = () => {
  const modal = document.getElementById('utxoDetailModal');
  if (modal) modal.classList.remove('active');
};

// ========== 智能导航栏 - 滚动方向检测 ==========
(function() {
  const header = document.querySelector('.header');
  if (!header) return;
  
  let lastScrollY = window.scrollY;
  let ticking = false;
  const scrollDelta = 8; // 滚动变化超过8px才判断方向
  
  function isHomePage() {
    const welcomeHero = document.querySelector('.welcome-hero');
    return welcomeHero && !welcomeHero.classList.contains('hidden');
  }
  
  function updateHeader() {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;
    
    // 首页始终显示导航栏
    if (isHomePage()) {
      header.classList.add('header--visible');
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }
    
    // 其他页面的逻辑：
    // 1. 页面顶部 - 显示导航栏
    // 2. 向下滚动 - 隐藏导航栏
    // 3. 向上滚动 - 显示导航栏
    
    if (currentScrollY <= 10) {
      // 页面顶部，显示导航栏
      header.classList.add('header--visible');
    } else if (delta > scrollDelta) {
      // 向下滚动，隐藏导航栏
      header.classList.remove('header--visible');
    } else if (delta < -scrollDelta) {
      // 向上滚动，显示导航栏
      header.classList.add('header--visible');
    }
    // delta 很小时保持当前状态
    
    lastScrollY = currentScrollY;
    ticking = false;
  }
  
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive: true });
  
  // 监听页面变化（hash变化时重新检测）
  window.addEventListener('hashchange', function() {
    setTimeout(function() {
      lastScrollY = window.scrollY;
      if (isHomePage() || window.scrollY <= 10) {
        header.classList.add('header--visible');
      }
    }, 100);
  });
  
  // 初始状态：首页和顶部都显示
  setTimeout(function() {
    if (isHomePage() || window.scrollY <= 10) {
      header.classList.add('header--visible');
    }
    lastScrollY = window.scrollY;
  }, 100);
})();

// ========================================
// 转账面板 - 网络状态曲线图
// ========================================
(function initNetworkChart() {
  const DATA_POINTS = 30; // 数据点数量
  const UPDATE_INTERVAL = 2000; // 2秒更新一次
  
  let speedData = [];
  let intervalId = null;
  let isVisible = false;

  for (let i = 0; i < DATA_POINTS; i++) {
    const base = 600 + Math.random() * 200;
    speedData.push(base);
  }

  // 观察转账面板可见性
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      isVisible = entry.isIntersecting;
      if (isVisible) {
        startMonitoring();
      } else {
        stopMonitoring();
      }
    });
  }, { threshold: 0.1 });

  // 初始化
  function init() {
    const transferPanel = document.querySelector('.transfer-panel');
    if (transferPanel) {
      observer.observe(transferPanel);
    }
    // 初始渲染
    updateNetworkStats();
    renderChart();
  }

  // 开始监控
  function startMonitoring() {
    if (intervalId) return;
    
    intervalId = setInterval(() => {
      updateNetworkStats();
      renderChart();
    }, UPDATE_INTERVAL);
  }

  // 停止监控
  function stopMonitoring() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // 格式化速度
  function formatSpeed(kbps) {
    if (kbps >= 1024) {
      return `${(kbps / 1024).toFixed(1)} MB/s`;
    }
    return `${Math.round(kbps)} KB/s`;
  }

  // 更新网络统计数据
  function updateNetworkStats() {
    let baseline = 0;
    let latency = 0;
    if (navigator.connection) {
      if (navigator.connection.downlink) {
        baseline = navigator.connection.downlink * 125;
      }
      if (navigator.connection.rtt) {
        latency = navigator.connection.rtt;
      }
    }
    const prev = speedData.length ? speedData[speedData.length - 1] : (baseline || 600);
    const drift = (Math.random() - 0.5) * 140;
    const spike = Math.random() < 0.12 ? (Math.random() - 0.5) * 700 : 0;
    let downloadSpeed = prev + drift + spike;
    downloadSpeed = Math.max(80, Math.min(1600, baseline ? (downloadSpeed * 0.7 + baseline * 0.3) : downloadSpeed));
    const uploadSpeed = downloadSpeed * (0.3 + Math.random() * 0.25);
    if (latency === 0) {
      latency = Math.max(8, Math.round(20 + (Math.random() - 0.5) * 30 + (spike ? Math.random() * 80 : 0)));
    }
    speedData.push(downloadSpeed);
    if (speedData.length > DATA_POINTS) speedData.shift();
    const downloadEl = document.getElementById('downloadSpeed');
    const uploadEl = document.getElementById('uploadSpeed');
    const latencyEl = document.getElementById('latencyValue');
    if (downloadEl) downloadEl.textContent = formatSpeed(downloadSpeed);
    if (uploadEl) uploadEl.textContent = formatSpeed(uploadSpeed);
    if (latencyEl) latencyEl.textContent = `${latency} ms`;
  }

  // Catmull-Rom 样条插值（与钱包图表相同）
  function catmullRomSpline(points, tension = 0.5) {
    if (points.length < 2) return '';
    if (points.length === 2) {
      return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;
    }
    
    let path = `M${points[0].x},${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      const cp1x = p1.x + (p2.x - p0.x) * tension / 6;
      const cp1y = p1.y + (p2.y - p0.y) * tension / 6;
      const cp2x = p2.x - (p3.x - p1.x) * tension / 6;
      const cp2y = p2.y - (p3.y - p1.y) * tension / 6;
      
      path += `C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`;
    }
    
    return path;
  }

  // 渲染图表
  function renderChart() {
    const svg = document.getElementById('networkChartSvg');
    const line = document.getElementById('networkChartLine');
    const fill = document.getElementById('networkChartFill');
    const dot = document.getElementById('networkChartDot');
    
    if (!svg || !line || !fill || !dot) return;
    
    const rect = svg.getBoundingClientRect();
    const width = rect.width || 300;
    const height = rect.height || 55;
    
    if (width === 0 || height === 0) return;
    
    // 计算最大值用于归一化
    const minSpeed = Math.min(...speedData);
    const maxSpeed = Math.max(...speedData);
    const range = Math.max(maxSpeed - minSpeed, 1);
    const padding = { top: 5, bottom: 5, left: 0, right: 0 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const points = speedData.map((speed, i) => ({
      x: padding.left + (i / (DATA_POINTS - 1)) * chartWidth,
      y: padding.top + chartHeight - ((speed - minSpeed) / range) * chartHeight
    }));
    
    // 生成平滑曲线
    const linePath = catmullRomSpline(points, 0.5);
    line.setAttribute('d', linePath);
    
    // 生成填充区域
    if (points.length > 0) {
      const fillPath = linePath + 
        `L${points[points.length - 1].x},${height}` +
        `L${points[0].x},${height}Z`;
      fill.setAttribute('d', fillPath);
    }
    
    // 更新当前点位置
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];
      dot.setAttribute('cx', lastPoint.x);
      dot.setAttribute('cy', lastPoint.y);
    }
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // 监听窗口大小变化
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(renderChart, 100);
  });
})();
