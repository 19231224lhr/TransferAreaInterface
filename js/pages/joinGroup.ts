/**
 * Join Group Page Module (Reactive Version)
 * 
 * 使用响应式绑定系统重构的加入担保组织页面。
 * 特性：
 * - 声明式 UI 绑定，状态变化自动同步 DOM
 * - 询问动画序列
 * - 组织搜索和选择
 * 
 * @module pages/joinGroup
 */

import { loadUser, saveUser, getJoinedGroup, saveGuarChoice } from '../utils/storage';
import { t } from '../i18n/index.js';
import { DEFAULT_GROUP, GROUP_LIST } from '../config/constants';
import { escapeHtml } from '../utils/security';
import { addInlineValidation, quickValidate } from '../utils/formValidator';
import {
  createReactiveState,
  type ReactiveState
} from '../utils/reactive';

// ============================================================================
// Types
// ============================================================================

/**
 * 组织信息
 */
interface GroupInfo {
  groupID: string;
  aggreNode: string;
  assignNode: string;
  pledgeAddress: string;
}

/**
 * 询问动画阶段
 */
type InquiryStage = 0 | 1 | 2 | 3;

/**
 * 加入组织页面状态
 */
interface JoinGroupPageState {
  // 当前选中的组织
  selectedGroup: GroupInfo;
  
  // 搜索结果显示
  showSearchResult: boolean;
  showSearchEmpty: boolean;
  showSuggest: boolean;
  
  // 搜索按钮状态
  searchBtnDisabled: boolean;
  
  // 询问动画状态
  inquiryStage: InquiryStage;
  inquirySuccess: boolean;
  
  // 推荐组织信息
  recGroupID: string;
  recAggre: string;
  recAssign: string;
  recPledge: string;
  
  // 搜索结果组织信息
  srGroupID: string;
  srAggre: string;
  srAssign: string;
  srPledge: string;
}

// ============================================================================
// State & Bindings
// ============================================================================

/**
 * 初始状态
 */
const initialState: JoinGroupPageState = {
  selectedGroup: DEFAULT_GROUP as GroupInfo,
  showSearchResult: false,
  showSearchEmpty: true,
  showSuggest: false,
  searchBtnDisabled: true,
  inquiryStage: 0,
  inquirySuccess: false,
  recGroupID: DEFAULT_GROUP.groupID,
  recAggre: DEFAULT_GROUP.aggreNode,
  recAssign: DEFAULT_GROUP.assignNode,
  recPledge: DEFAULT_GROUP.pledgeAddress,
  srGroupID: '',
  srAggre: '',
  srAssign: '',
  srPledge: ''
};

/**
 * 状态到 DOM 的绑定配置
 */
const stateBindings = {
  showSearchResult: [
    { selector: '#searchResult', type: 'visible' as const }
  ],
  showSearchEmpty: [
    { selector: '#searchEmpty', type: 'visible' as const }
  ],
  showSuggest: [
    { selector: '#groupSuggest', type: 'visible' as const }
  ],
  searchBtnDisabled: [
    { selector: '#joinSearchBtn', type: 'prop' as const, name: 'disabled' }
  ],
  recGroupID: [
    { selector: '#recGroupID', type: 'text' as const }
  ],
  recAggre: [
    { selector: '#recAggre', type: 'text' as const }
  ],
  recAssign: [
    { selector: '#recAssign', type: 'text' as const }
  ],
  recPledge: [
    { selector: '#recPledge', type: 'text' as const }
  ],
  srGroupID: [
    { selector: '#srGroupID', type: 'text' as const }
  ],
  srAggre: [
    { selector: '#srAggre', type: 'text' as const }
  ],
  srAssign: [
    { selector: '#srAssign', type: 'text' as const }
  ],
  srPledge: [
    { selector: '#srPledge', type: 'text' as const }
  ]
};

// 页面状态实例
let pageState: ReactiveState<JoinGroupPageState> | null = null;

// 事件清理函数数组
let eventCleanups: (() => void)[] = [];

// 当前选中的组织 (兼容旧 API)
let currentSelectedGroup: GroupInfo = DEFAULT_GROUP as GroupInfo;

// ============================================================================
// Inquiry Animation
// ============================================================================

/**
 * 重置询问页面状态
 */
export function resetInquiryState(): void {
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
    if (iconPulse) (iconPulse as HTMLElement).style.display = 'block';
    if (iconCheck) (iconCheck as HTMLElement).style.display = 'none';
  }
  
  // 重置文本
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
  
  // 重置轨道系统
  const orbitSystem = document.getElementById('inquiryOrbitSystem');
  if (orbitSystem) {
    orbitSystem.classList.remove('success');
  }
}

/**
 * 阶段文本配置
 */
function getStageTexts(): Array<{ title: string; desc: string }> {
  return [
    { title: t('loading.initializing'), desc: t('loading.initializingDesc') },
    { title: t('loading.connecting'), desc: t('loading.connectingDesc') },
    { title: t('loading.verifying'), desc: t('loading.verifyingDesc') },
    { title: t('loading.success'), desc: t('loading.successDesc') }
  ];
}

/**
 * 更新询问阶段 UI
 */
function updateInquiryStage(stageIndex: InquiryStage): void {
  const steps = document.querySelectorAll('#inquirySteps .inquiry-step');
  const lines = document.querySelectorAll('#inquirySteps .inquiry-step-divider');
  const progressFill = document.getElementById('inquiryProgressFill');
  const title = document.getElementById('inquiryTitle');
  const desc = document.getElementById('inquiryDesc');
  const stageTexts = getStageTexts();
  
  // 更新进度条
  const progress = ((stageIndex + 1) / 3) * 100;
  if (progressFill) {
    progressFill.style.width = Math.min(progress, 95) + '%';
  }
  
  // 更新文本
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

/**
 * 显示成功状态
 */
function showInquirySuccess(): void {
  const steps = document.querySelectorAll('#inquirySteps .inquiry-step');
  const lines = document.querySelectorAll('#inquirySteps .inquiry-step-divider');
  const progressFill = document.getElementById('inquiryProgressFill');
  const icon = document.getElementById('inquiryIcon');
  const title = document.getElementById('inquiryTitle');
  const desc = document.getElementById('inquiryDesc');
  const tip = document.getElementById('inquiryTip');
  const tipText = document.getElementById('inquiryTipText');
  const page = document.getElementById('inquiryPage');
  const orbitSystem = document.getElementById('inquiryOrbitSystem');
  const stageTexts = getStageTexts();
  
  // 轨道系统成功状态
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
  
  // 图标变为勾选
  if (icon) {
    icon.classList.add('success');
    const iconPulse = icon.querySelector('.icon-pulse');
    const iconCheck = icon.querySelector('.icon-check');
    if (iconPulse) (iconPulse as HTMLElement).style.display = 'none';
    if (iconCheck) (iconCheck as HTMLElement).style.display = 'block';
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

/**
 * 开始询问动画
 */
export function startInquiryAnimation(onComplete?: () => void): void {
  // 重置状态
  resetInquiryState();
  
  const page = document.getElementById('inquiryPage');
  
  // 阶段 1: 初始化 (0-600ms)
  updateInquiryStage(0);
  
  setTimeout(() => {
    // 阶段 2: 连接网络 (600-1600ms)
    updateInquiryStage(1);
  }, 600);
  
  setTimeout(() => {
    // 阶段 3: 验证账户 (1600-2600ms)
    updateInquiryStage(2);
  }, 1600);
  
  setTimeout(() => {
    // 成功状态 (2600ms)
    showInquirySuccess();
  }, 2600);
  
  setTimeout(() => {
    // 淡出并导航 (3200ms)
    if (page) {
      page.classList.add('fade-out');
    }
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 500);
  }, 3200);
}

// ============================================================================
// Group Selection
// ============================================================================

/**
 * 获取当前选中的组织
 */
export function getCurrentSelectedGroup(): GroupInfo {
  return currentSelectedGroup;
}

/**
 * 设置当前选中的组织
 */
export function setCurrentSelectedGroup(group: GroupInfo): void {
  currentSelectedGroup = group;
  pageState?.set({ selectedGroup: group });
}

/**
 * 显示组织信息到搜索结果
 */
function showGroupInfo(group: GroupInfo): void {
  currentSelectedGroup = group;
  
  if (pageState) {
    pageState.set({
      selectedGroup: group,
      showSuggest: false,
      showSearchEmpty: false,
      showSearchResult: true,
      searchBtnDisabled: false,
      srGroupID: group.groupID,
      srAggre: group.aggreNode,
      srAssign: group.assignNode,
      srPledge: group.pledgeAddress
    });
  }
  
  // 添加 reveal 动画
  const sr = document.getElementById('searchResult');
  if (sr) {
    sr.classList.remove('reveal');
    requestAnimationFrame(() => sr.classList.add('reveal'));
  }
}

/**
 * 按 ID 搜索组织
 */
function doSearchById(): void {
  const groupSearch = document.getElementById('groupSearch') as HTMLInputElement | null;
  const q = groupSearch?.value.trim();
  if (!q) return;
  
  const g = (GROUP_LIST as GroupInfo[]).find(x => x.groupID === q);
  if (g) {
    showGroupInfo(g);
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * 处理组织搜索输入
 */
function handleGroupSearchInput(): void {
  const groupSearch = document.getElementById('groupSearch') as HTMLInputElement | null;
  const groupSuggest = document.getElementById('groupSuggest');
  const q = groupSearch?.value.trim() || '';
  
  const err = quickValidate(q, ['required', 'orgId']);
  
  if (pageState) {
    pageState.set({ searchBtnDisabled: !!err });
  }
  
  if (err) {
    if (pageState) {
      pageState.set({
        showSuggest: false,
        showSearchResult: false,
        showSearchEmpty: true
      });
    }
    return;
  }
  
  if (!q) {
    if (pageState) {
      pageState.set({
        showSuggest: false,
        showSearchResult: false,
        showSearchEmpty: true,
        searchBtnDisabled: true
      });
    }
    return;
  }
  
  const list = (GROUP_LIST as GroupInfo[]).filter(g => g.groupID.includes(q)).slice(0, 6);
  
  if (list.length === 0) {
    if (pageState) {
      pageState.set({ showSuggest: false });
    }
    return;
  }
  
  if (groupSuggest) {
    const html = list.map(g => 
      `<div class="item" data-id="${escapeHtml(g.groupID)}">
        <span class="suggest-id">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span class="suggest-id-text">${escapeHtml(g.groupID)}</span>
        </span>
        <span class="suggest-nodes">
          <span class="node-badge aggre">${escapeHtml(g.aggreNode)}</span>
          <span class="node-badge assign">${escapeHtml(g.assignNode)}</span>
        </span>
        <span class="suggest-arrow">→</span>
      </div>`
    ).join('');

    const doc = new DOMParser().parseFromString(html, 'text/html');
    groupSuggest.replaceChildren(...Array.from(doc.body.childNodes));
    
    if (pageState) {
      pageState.set({ showSuggest: true });
    }
  }
}

/**
 * 处理搜索输入回车
 */
function handleGroupSearchKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    doSearchById();
  }
}

/**
 * 处理建议列表点击
 */
function handleSuggestClick(e: MouseEvent): void {
  const target = (e.target as HTMLElement).closest('.item');
  if (!target) return;
  
  const id = target.getAttribute('data-id');
  const g = (GROUP_LIST as GroupInfo[]).find(x => x.groupID === id);
  if (g) {
    showGroupInfo(g);
  }
}

/**
 * 处理加入推荐组织
 */
function handleJoinRecClick(): void {
  handleJoinGroup(currentSelectedGroup);
}

/**
 * 处理加入搜索结果组织
 */
async function handleJoinSearchClick(): Promise<void> {
  const joinSearchBtn = document.getElementById('joinSearchBtn') as HTMLButtonElement | null;
  const joinRecBtn = document.getElementById('joinRecBtn') as HTMLButtonElement | null;
  
  if (joinSearchBtn?.disabled) return;
  
  const g = currentSelectedGroup || DEFAULT_GROUP as GroupInfo;
  
  try {
    // 显示加载状态
    const { showUnifiedLoading, hideUnifiedOverlay } = await import('../ui/modal.js');
    const { wait } = await import('../utils/helpers.js');
    
    showUnifiedLoading(t('join.joiningOrg'));
    if (joinRecBtn) joinRecBtn.disabled = true;
    if (joinSearchBtn) joinSearchBtn.disabled = true;
    
    await wait(2000);
  } finally {
    const { hideUnifiedOverlay } = await import('../ui/modal.js');
    hideUnifiedOverlay();
    if (joinRecBtn) joinRecBtn.disabled = false;
    if (joinSearchBtn) joinSearchBtn.disabled = false;
  }
  
  // 保存到 localStorage
  try {
    localStorage.setItem('guarChoice', JSON.stringify({
      type: 'join',
      groupID: g.groupID,
      aggreNode: g.aggreNode,
      assignNode: g.assignNode,
      pledgeAddress: g.pledgeAddress
    }));
  } catch { /* ignore */ }
  
  // 保存到用户账户
  const u = loadUser();
  if (u?.accountId) {
    saveUser({
      accountId: u.accountId,
      orgNumber: g.groupID,
      guarGroup: {
        groupID: g.groupID,
        aggreNode: g.aggreNode,
        assignNode: g.assignNode,
        pledgeAddress: g.pledgeAddress
      }
    });
  }
  
  // 导航到询问页面
  if (typeof window.PanguPay?.router?.routeTo === 'function') {
    window.PanguPay.router.routeTo('#/inquiry-main');
  }
}

/**
 * 处理跳过加入
 */
function handleSkipClick(): void {
  const modal = document.getElementById('confirmSkipModal');
  if (modal) modal.classList.remove('hidden');
}

/**
 * 处理标签切换
 */
function handleTabClick(e: MouseEvent): void {
  const tab = e.currentTarget as HTMLElement;
  const target = tab.getAttribute('data-tab');
  const joinTabs = document.querySelectorAll('.join-tab');
  const tabsContainer = document.querySelector('.join-tabs');
  const recPane = document.getElementById('recPane');
  const searchPane = document.getElementById('searchPane');
  
  // 更新标签状态
  joinTabs.forEach(t => t.classList.remove('join-tab--active'));
  tab.classList.add('join-tab--active');
  
  // 更新滑块位置
  if (tabsContainer) {
    tabsContainer.setAttribute('data-active', target || 'recommend');
  }
  
  // 切换面板
  if (target === 'recommend') {
    if (recPane) recPane.classList.remove('hidden');
    if (searchPane) searchPane.classList.add('hidden');
  } else {
    if (recPane) recPane.classList.add('hidden');
    if (searchPane) searchPane.classList.remove('hidden');
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 重置标签和面板状态
 */
function resetTabsAndPanes(): void {
  const joinTabs = document.querySelectorAll('.join-tab');
  const tabsContainer = document.querySelector('.join-tabs');
  const recPane = document.getElementById('recPane');
  const searchPane = document.getElementById('searchPane');
  const groupSearch = document.getElementById('groupSearch') as HTMLInputElement | null;
  const groupSuggest = document.getElementById('groupSuggest');
  const searchResult = document.getElementById('searchResult');
  const searchEmpty = document.getElementById('searchEmpty');
  
  // 重置标签状态 - 选中推荐标签
  joinTabs.forEach((tab, index) => {
    if (index === 0) {
      tab.classList.add('join-tab--active');
    } else {
      tab.classList.remove('join-tab--active');
    }
  });
  
  // 重置滑块位置
  if (tabsContainer) {
    tabsContainer.setAttribute('data-active', 'recommend');
  }
  
  // 重置面板显示 - 显示推荐面板，隐藏搜索面板
  if (recPane) recPane.classList.remove('hidden');
  if (searchPane) searchPane.classList.add('hidden');
  
  // 重置搜索输入
  if (groupSearch) groupSearch.value = '';
  
  // 重置搜索结果
  if (groupSuggest) groupSuggest.classList.add('hidden');
  if (searchResult) searchResult.classList.add('hidden');
  if (searchEmpty) searchEmpty.classList.remove('hidden');
}

/**
 * 处理加入组织
 */
export function handleJoinGroup(group: GroupInfo): void {
  if (!group || !group.groupID) return;
  
  // 保存选择
  saveGuarChoice({ groupID: group.groupID });
  
  // 更新用户
  const u = loadUser();
  if (u?.accountId) {
    saveUser({ accountId: u.accountId, orgNumber: group.groupID, guarGroup: group });
  }
  
  // 导航到询问页面
  if (typeof window.PanguPay?.router?.routeTo === 'function') {
    window.PanguPay.router.routeTo('#/inquiry');
  }
}

/**
 * 清理所有事件绑定
 */
function cleanupEvents(): void {
  eventCleanups.forEach(cleanup => cleanup());
  eventCleanups = [];
}

/**
 * 安全地添加事件监听器
 */
function addEvent<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | null,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void
): void {
  if (!element) return;
  
  element.addEventListener(event, handler as EventListener);
  
  eventCleanups.push(() => {
    element.removeEventListener(event, handler as EventListener);
  });
}

/**
 * 初始化标签切换
 */
function initJoinTabs(): void {
  const joinTabs = document.querySelectorAll('.join-tab');
  const tabsContainer = document.querySelector('.join-tabs');
  
  // 设置初始滑块位置
  if (tabsContainer) {
    tabsContainer.setAttribute('data-active', 'recommend');
  }
  
  joinTabs.forEach(tab => {
    addEvent(tab as HTMLElement, 'click', handleTabClick);
  });
}

/**
 * 初始化组织搜索
 */
function initGroupSearch(): void {
  const groupSearch = document.getElementById('groupSearch') as HTMLInputElement | null;
  const groupSuggest = document.getElementById('groupSuggest');
  
  // 添加表单验证
  addInlineValidation('#groupSearch', [
    { validator: 'required', message: t('validation.orgIdRequired') || '请输入组织ID' },
    { validator: 'orgId', message: t('validation.orgIdFormat') || '需8位数字' }
  ], { showOnInput: true, debounceMs: 150 });
  
  if (groupSearch) {
    addEvent(groupSearch, 'input', handleGroupSearchInput);
    addEvent(groupSearch, 'keydown', handleGroupSearchKeydown);
  }
  
  if (groupSuggest) {
    addEvent(groupSuggest, 'click', handleSuggestClick);
  }
}

/**
 * 绑定页面事件
 */
function bindEvents(): void {
  // 先清理旧的事件绑定
  cleanupEvents();
  
  // 初始化标签切换
  initJoinTabs();
  
  // 初始化组织搜索
  initGroupSearch();
  
  // 加入推荐组织按钮
  const joinRecBtn = document.getElementById('joinRecBtn');
  addEvent(joinRecBtn, 'click', handleJoinRecClick);
  
  // 加入搜索结果组织按钮
  const joinSearchBtn = document.getElementById('joinSearchBtn');
  addEvent(joinSearchBtn, 'click', handleJoinSearchClick);
  
  // 跳过按钮
  const skipJoinBtn = document.getElementById('skipJoinBtn');
  addEvent(skipJoinBtn, 'click', handleSkipClick);
}

/**
 * 初始化加入组织页面
 */
export function initJoinGroupPage(): void {
  const g0 = getJoinedGroup();
  const joined = !!(g0 && g0.groupID);
  
  if (joined) {
    // 已加入，重定向到 inquiry-main
    if (typeof window.PanguPay?.router?.routeTo === 'function') {
      window.PanguPay.router.routeTo('#/inquiry-main');
    }
    return;
  }
  
  // 清理旧的事件绑定
  cleanupEvents();
  
  // 销毁旧实例
  pageState?.destroy();
  
  // 创建新的响应式状态
  pageState = createReactiveState(initialState, stateBindings);
  
  // 设置当前选中组织为默认组织
  currentSelectedGroup = DEFAULT_GROUP as GroupInfo;
  
  // 设置默认组织信息
  pageState.set({
    selectedGroup: DEFAULT_GROUP as GroupInfo,
    recGroupID: DEFAULT_GROUP.groupID,
    recAggre: DEFAULT_GROUP.aggreNode,
    recAssign: DEFAULT_GROUP.assignNode,
    recPledge: DEFAULT_GROUP.pledgeAddress,
    showSearchResult: false,
    showSearchEmpty: true,
    showSuggest: false,
    searchBtnDisabled: true
  });
  
  // 重置标签和面板状态
  resetTabsAndPanes();
  
  // 绑定事件
  bindEvents();
}
