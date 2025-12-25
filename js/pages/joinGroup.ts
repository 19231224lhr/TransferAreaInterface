/**
 * Join Group Page Module (Reactive Version)
 * 
 * 使用响应式绑定系统重构的加入担保组织页面。
 * 特性：
 * - 声明式 UI 绑定，状态变化自动同步 DOM
 * - 询问动画序列
 * - 组织搜索和选择（调用真实后端 API）
 * 
 * @module pages/joinGroup
 */

import { loadUser, saveUser, getJoinedGroup, saveGuarChoice } from '../utils/storage';
import { t } from '../i18n/index.js';
import { DEFAULT_GROUP } from '../config/constants';
import { addInlineValidation, quickValidate } from '../utils/formValidator';
import { DOM_IDS, idSelector } from '../config/domIds';
import { 
  queryGroupInfoSafe, 
  joinGuarGroup,
  buildAssignNodeUrl,
  buildAggrNodeUrl,
  type GroupInfo 
} from '../services/group';
import {
  createReactiveState,
  type ReactiveState
} from '../utils/reactive';

// ============================================================================
// Types
// ============================================================================

/**
 * 询问动画阶段
 */
type InquiryStage = 0 | 1 | 2 | 3;

/**
 * 搜索状态
 */
type SearchState = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

/**
 * 加入组织页面状态
 */
interface JoinGroupPageState {
  // 当前选中的组织
  selectedGroup: GroupInfo | null;
  
  // 搜索状态
  searchState: SearchState;
  
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
  recAssignPort: string;   // AssignNode 端口号
  recAggrPort: string;     // AggrNode 端口号
  
  // 搜索结果组织信息
  srGroupID: string;
  srAggre: string;
  srAssign: string;
  srPledge: string;
  srAssignPort: string;    // AssignNode 端口号
  srAggrPort: string;      // AggrNode 端口号
}

// ============================================================================
// State & Bindings
// ============================================================================

/**
 * 初始状态
 */
const initialState: JoinGroupPageState = {
  selectedGroup: null,
  searchState: 'idle',
  searchBtnDisabled: true,
  inquiryStage: 0,
  inquirySuccess: false,
  recGroupID: DEFAULT_GROUP.groupID,
  recAggre: DEFAULT_GROUP.aggreNode,
  recAssign: DEFAULT_GROUP.assignNode,
  recPledge: DEFAULT_GROUP.pledgeAddress,
  recAssignPort: DEFAULT_GROUP.assignAPIEndpoint || ':8081',
  recAggrPort: DEFAULT_GROUP.aggrAPIEndpoint || ':8082',
  srGroupID: '',
  srAggre: '',
  srAssign: '',
  srPledge: '',
  srAssignPort: '',
  srAggrPort: ''
};

/**
 * 状态到 DOM 的绑定配置
 */
const stateBindings = {
  searchBtnDisabled: [
    { selector: '#groupSearchBtn', type: 'prop' as const, name: 'disabled' }
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
  recAssignPort: [
    { selector: '#recAssignPort', type: 'text' as const }
  ],
  recAggrPort: [
    { selector: '#recAggrPort', type: 'text' as const }
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
  ],
  srAssignPort: [
    { selector: '#srAssignPort', type: 'text' as const }
  ],
  srAggrPort: [
    { selector: '#srAggrPort', type: 'text' as const }
  ]
};

// 页面状态实例
let pageState: ReactiveState<JoinGroupPageState> | null = null;

// 事件清理函数数组
let eventCleanups: (() => void)[] = [];

// 当前选中的组织 (兼容旧 API)
let currentSelectedGroup: GroupInfo | null = null;

// 正在搜索的请求标记
let searchAbortController: AbortController | null = null;

// ============================================================================
// Inquiry Animation
// ============================================================================

/**
 * 重置询问页面状态
 */
export function resetInquiryState(): void {
  const steps = document.querySelectorAll(`${idSelector(DOM_IDS.inquirySteps)} .inquiry-step`);
  const lines = document.querySelectorAll(`${idSelector(DOM_IDS.inquirySteps)} .inquiry-step-divider`);
  const progressFill = document.getElementById(DOM_IDS.inquiryProgressFill);
  const icon = document.getElementById(DOM_IDS.inquiryIcon);
  const title = document.getElementById(DOM_IDS.inquiryTitle);
  const desc = document.getElementById(DOM_IDS.inquiryDesc);
  const tip = document.getElementById(DOM_IDS.inquiryTip);
  const tipText = document.getElementById(DOM_IDS.inquiryTipText);
  const page = document.getElementById(DOM_IDS.inquiryPage);
  
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
  const orbitSystem = document.getElementById(DOM_IDS.inquiryOrbitSystem);
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
  const steps = document.querySelectorAll(`${idSelector(DOM_IDS.inquirySteps)} .inquiry-step`);
  const lines = document.querySelectorAll(`${idSelector(DOM_IDS.inquirySteps)} .inquiry-step-divider`);
  const progressFill = document.getElementById(DOM_IDS.inquiryProgressFill);
  const title = document.getElementById(DOM_IDS.inquiryTitle);
  const desc = document.getElementById(DOM_IDS.inquiryDesc);
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
  const steps = document.querySelectorAll(`${idSelector(DOM_IDS.inquirySteps)} .inquiry-step`);
  const lines = document.querySelectorAll(`${idSelector(DOM_IDS.inquirySteps)} .inquiry-step-divider`);
  const progressFill = document.getElementById(DOM_IDS.inquiryProgressFill);
  const icon = document.getElementById(DOM_IDS.inquiryIcon);
  const title = document.getElementById(DOM_IDS.inquiryTitle);
  const desc = document.getElementById(DOM_IDS.inquiryDesc);
  const tip = document.getElementById(DOM_IDS.inquiryTip);
  const tipText = document.getElementById(DOM_IDS.inquiryTipText);
  const page = document.getElementById(DOM_IDS.inquiryPage);
  const orbitSystem = document.getElementById(DOM_IDS.inquiryOrbitSystem);
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
  
  const page = document.getElementById(DOM_IDS.inquiryPage);
  
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
export function getCurrentSelectedGroup(): GroupInfo | null {
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
 * 更新搜索 UI 状态
 */
function updateSearchUI(state: SearchState): void {
  const searchEmpty = document.getElementById(DOM_IDS.searchEmpty);
  const searchLoading = document.getElementById(DOM_IDS.searchLoading);
  const searchNotFound = document.getElementById(DOM_IDS.searchNotFound);
  const searchResult = document.getElementById(DOM_IDS.searchResult);
  const joinSearchBtn = document.getElementById(DOM_IDS.joinSearchBtn) as HTMLButtonElement | null;
  
  // 隐藏所有状态
  searchEmpty?.classList.add('hidden');
  searchLoading?.classList.add('hidden');
  searchNotFound?.classList.add('hidden');
  searchResult?.classList.add('hidden');
  
  // 显示对应状态
  switch (state) {
    case 'idle':
      searchEmpty?.classList.remove('hidden');
      // 禁用加入按钮
      if (joinSearchBtn) joinSearchBtn.disabled = true;
      break;
    case 'loading':
      searchLoading?.classList.remove('hidden');
      // 加载中禁用加入按钮
      if (joinSearchBtn) joinSearchBtn.disabled = true;
      break;
    case 'not-found':
    case 'error':
      searchNotFound?.classList.remove('hidden');
      // 未找到或错误时禁用加入按钮
      if (joinSearchBtn) joinSearchBtn.disabled = true;
      break;
    case 'found':
      searchResult?.classList.remove('hidden');
      // 找到组织时启用加入按钮（在 showGroupInfo 中也会设置）
      if (joinSearchBtn) joinSearchBtn.disabled = false;
      break;
  }
  
  if (pageState) {
    pageState.set({ searchState: state });
  }
}

/**
 * 显示组织信息到搜索结果
 */
function showGroupInfo(group: GroupInfo): void {
  currentSelectedGroup = group;
  
  if (pageState) {
    pageState.set({
      selectedGroup: group,
      searchState: 'found',
      srGroupID: group.groupID,
      srAggre: group.aggreNode,
      srAssign: group.assignNode,
      srPledge: group.pledgeAddress,
      srAssignPort: group.assignAPIEndpoint || '-',
      srAggrPort: group.aggrAPIEndpoint || '-'
    });
  }
  
  updateSearchUI('found');
  
  // 启用加入按钮（搜索成功后允许用户点击加入）
  const joinSearchBtn = document.getElementById(DOM_IDS.joinSearchBtn) as HTMLButtonElement | null;
  if (joinSearchBtn) {
    joinSearchBtn.disabled = false;
  }
  
  // 添加 reveal 动画
  const sr = document.getElementById(DOM_IDS.searchResult);
  if (sr) {
    sr.classList.remove('reveal');
    requestAnimationFrame(() => sr.classList.add('reveal'));
  }
}

/**
 * 执行真实 API 搜索
 */
async function doRealSearch(): Promise<void> {
  const groupSearch = document.getElementById(DOM_IDS.groupSearch) as HTMLInputElement | null;
  const groupSearchBtn = document.getElementById(DOM_IDS.groupSearchBtn) as HTMLButtonElement | null;
  const q = groupSearch?.value.trim();
  
  if (!q) return;
  
  // 验证格式
  const err = quickValidate(q, ['required', 'orgId']);
  if (err) return;
  
  console.info(`[JoinGroup] 🔍 开始搜索组织: ${q}`);
  
  // 取消之前的请求
  if (searchAbortController) {
    searchAbortController.abort();
  }
  searchAbortController = new AbortController();
  
  // 显示加载状态
  updateSearchUI('loading');
  if (groupSearchBtn) groupSearchBtn.disabled = true;
  
  // 记录搜索开始时间，确保最小加载时长
  const searchStartTime = Date.now();
  const MIN_LOADING_TIME = 600; // 最小加载时间 600ms，避免闪烁
  
  try {
    const result = await queryGroupInfoSafe(q);
    
    // 确保加载动画至少显示 MIN_LOADING_TIME 毫秒
    const elapsed = Date.now() - searchStartTime;
    if (elapsed < MIN_LOADING_TIME) {
      await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
    }
    
    if (result.success) {
      console.info(`[JoinGroup] ✓ 找到组织: ${result.data.groupID} (Aggre: ${result.data.aggreNode}, Assign: ${result.data.assignNode})`);
      showGroupInfo(result.data);
    } else {
      // result.success === false, so notFound and error are available
      if (result.notFound) {
        console.warn(`[JoinGroup] ✗ 组织不存在: ${q}`);
      } else {
        console.error(`[JoinGroup] ✗ 搜索失败: ${result.error}`);
      }
      updateSearchUI('not-found');
      currentSelectedGroup = null;
      if (pageState) {
        pageState.set({ selectedGroup: null, searchState: 'not-found' });
      }
    }
  } catch (error) {
    // 如果是取消请求，不显示错误
    if (error instanceof Error && error.name === 'AbortError') {
      console.debug(`[JoinGroup] 搜索已取消: ${q}`);
      return;
    }
    console.error(`[JoinGroup] ✗ 搜索异常:`, error);
    updateSearchUI('error');
    currentSelectedGroup = null;
    if (pageState) {
      pageState.set({ selectedGroup: null, searchState: 'error' });
    }
  } finally {
    if (groupSearchBtn) groupSearchBtn.disabled = false;
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * 处理组织搜索输入 - 只做验证，不显示下拉建议
 */
function handleGroupSearchInput(): void {
  const groupSearch = document.getElementById(DOM_IDS.groupSearch) as HTMLInputElement | null;
  const groupSearchBtn = document.getElementById(DOM_IDS.groupSearchBtn) as HTMLButtonElement | null;
  const q = groupSearch?.value.trim() || '';
  
  const err = quickValidate(q, ['required', 'orgId']);
  
  // 更新搜索按钮状态
  const isValid = !err && q.length > 0;
  if (groupSearchBtn) {
    groupSearchBtn.disabled = !isValid;
  }
  if (pageState) {
    pageState.set({ searchBtnDisabled: !isValid });
  }
  
  // 如果输入为空，显示空状态
  if (!q) {
    updateSearchUI('idle');
  }
}

/**
 * 处理搜索输入回车
 */
function handleGroupSearchKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    const groupSearchBtn = document.getElementById(DOM_IDS.groupSearchBtn) as HTMLButtonElement | null;
    if (groupSearchBtn && !groupSearchBtn.disabled) {
      doRealSearch();
    }
  }
}

/**
 * 处理搜索按钮点击
 */
function handleSearchBtnClick(): void {
  doRealSearch();
}

/**
 * 处理加入推荐组织
 * 
 * ⚠️ 重要：必须先从后端查询组织信息，获取动态的 assignAPIEndpoint
 * 不能使用静态的 DEFAULT_GROUP，因为端口号会变化
 */
async function handleJoinRecClick(): Promise<void> {
  const joinRecBtn = document.getElementById(DOM_IDS.joinRecBtn) as HTMLButtonElement | null;
  
  try {
    // 显示加载状态
    if (joinRecBtn) joinRecBtn.disabled = true;
    
    const { showUnifiedLoading, hideUnifiedOverlay, showUnifiedError } = await import('../ui/modal.js');
    showUnifiedLoading(t('join.queryingOrg') || '正在查询组织信息...');
    
    // 从后端动态查询推荐组织的信息（获取最新的端口号）
    console.info(`[JoinGroup] 🔍 Querying recommended organization: ${DEFAULT_GROUP.groupID}`);
    const result = await queryGroupInfoSafe(DEFAULT_GROUP.groupID);
    
    hideUnifiedOverlay();
    
    if (!result.success) {
      console.error(`[JoinGroup] ✗ Failed to query recommended organization:`, result.error);
      showUnifiedError(
        t('join.queryFailed') || '查询失败',
        result.error || t('join.queryFailedDesc') || '无法获取组织信息，请稍后重试'
      );
      return;
    }
    
    console.info(`[JoinGroup] ✓ Got dynamic group info:`, {
      groupID: result.data.groupID,
      assignAPIEndpoint: result.data.assignAPIEndpoint,
      aggrAPIEndpoint: result.data.aggrAPIEndpoint
    });
    
    // 使用从后端获取的动态组织信息
    await handleJoinGroupWithAPI(result.data);
    
  } catch (error) {
    console.error(`[JoinGroup] ✗ Error querying recommended organization:`, error);
    const { hideUnifiedOverlay, showUnifiedError } = await import('../ui/modal.js');
    hideUnifiedOverlay();
    showUnifiedError(
      t('join.queryFailed') || '查询失败',
      error instanceof Error ? error.message : '未知错误'
    );
  } finally {
    if (joinRecBtn) joinRecBtn.disabled = false;
  }
}

/**
 * 处理加入搜索结果组织
 */
async function handleJoinSearchClick(): Promise<void> {
  const joinSearchBtn = document.getElementById(DOM_IDS.joinSearchBtn) as HTMLButtonElement | null;
  
  if (joinSearchBtn?.disabled) return;
  if (!currentSelectedGroup) return;
  
  await handleJoinGroupWithAPI(currentSelectedGroup);
}

/**
 * 处理加入组织（调用真实 API）
 */
async function handleJoinGroupWithAPI(group: GroupInfo): Promise<void> {
  if (!group || !group.groupID) return;
  
  const joinRecBtn = document.getElementById(DOM_IDS.joinRecBtn) as HTMLButtonElement | null;
  const joinSearchBtn = document.getElementById(DOM_IDS.joinSearchBtn) as HTMLButtonElement | null;
  
  try {
    // 显示加载动画
    const { showUnifiedLoading, hideUnifiedOverlay, showUnifiedError } = await import('../ui/modal.js');
    
    showUnifiedLoading(t('join.joiningOrg'));
    if (joinRecBtn) joinRecBtn.disabled = true;
    if (joinSearchBtn) joinSearchBtn.disabled = true;
    
    console.info(`[JoinGroup] 🚀 Attempting to join organization ${group.groupID}...`);
    
    // 调用真实 API 加入组织
    const result = await joinGuarGroup(group.groupID, group);
    
    // 隐藏加载动画
    hideUnifiedOverlay();
    
    if (!result.success) {
      console.error(`[JoinGroup] ✗ Failed to join organization:`, result.error);
      showUnifiedError(
        t('join.joinFailed') || '加入失败',
        result.error || t('join.joinFailedDesc') || '加入担保组织失败，请稍后重试'
      );
      return;
    }
    
    console.info(`[JoinGroup] ✓ Successfully joined organization ${group.groupID}`);
    
    // 构建完整的节点 URL
    let assignNodeUrl: string | undefined;
    let aggrNodeUrl: string | undefined;
    
    if (group.assignAPIEndpoint) {
      assignNodeUrl = buildAssignNodeUrl(group.assignAPIEndpoint);
    }
    if (group.aggrAPIEndpoint) {
      aggrNodeUrl = buildAggrNodeUrl(group.aggrAPIEndpoint);
    }
    
    // 保存到 localStorage
    try {
      localStorage.setItem('guarChoice', JSON.stringify({
        type: 'join',
        groupID: group.groupID,
        aggreNode: group.aggreNode,
        assignNode: group.assignNode,
        pledgeAddress: group.pledgeAddress,
        assignAPIEndpoint: group.assignAPIEndpoint,
        aggrAPIEndpoint: group.aggrAPIEndpoint,
        assignNodeUrl: assignNodeUrl,
        aggrNodeUrl: aggrNodeUrl
      }));
    } catch { /* ignore */ }
    
    // 保存到用户账户
    const u = loadUser();
    if (u?.accountId) {
      saveUser({
        accountId: u.accountId,
        orgNumber: group.groupID,
        guarGroup: {
          groupID: group.groupID,
          aggreNode: group.aggreNode,
          assignNode: group.assignNode,
          pledgeAddress: group.pledgeAddress,
          assignAPIEndpoint: group.assignAPIEndpoint,
          aggrAPIEndpoint: group.aggrAPIEndpoint
        }
      });
    }
    
    // 导航到询问页面（显示成功动画后跳转到 main）
    if (typeof window.PanguPay?.router?.routeTo === 'function') {
      window.PanguPay.router.routeTo('#/inquiry-main');
    }
    
  } catch (error) {
    console.error(`[JoinGroup] ✗ Unexpected error:`, error);
    const { hideUnifiedOverlay, showUnifiedError } = await import('../ui/modal.js');
    hideUnifiedOverlay();
    showUnifiedError(
      t('join.joinFailed') || '加入失败',
      error instanceof Error ? error.message : '未知错误'
    );
  } finally {
    if (joinRecBtn) joinRecBtn.disabled = false;
    if (joinSearchBtn) joinSearchBtn.disabled = false;
  }
}

/**
 * 处理跳过加入
 */
function handleSkipClick(): void {
  const modal = document.getElementById(DOM_IDS.confirmSkipModal);
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
  const recPane = document.getElementById(DOM_IDS.recPane);
  const searchPane = document.getElementById(DOM_IDS.searchPane);
  
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
  const recPane = document.getElementById(DOM_IDS.recPane);
  const searchPane = document.getElementById(DOM_IDS.searchPane);
  const groupSearch = document.getElementById(DOM_IDS.groupSearch) as HTMLInputElement | null;
  const groupSearchBtn = document.getElementById(DOM_IDS.groupSearchBtn) as HTMLButtonElement | null;
  
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
  
  // 重置搜索按钮
  if (groupSearchBtn) groupSearchBtn.disabled = true;
  
  // 重置搜索 UI 状态
  updateSearchUI('idle');
}

/**
 * 处理加入组织（兼容旧 API，直接导航）
 * @deprecated Use handleJoinGroupWithAPI instead for real API calls
 */
export function handleJoinGroup(group: GroupInfo): void {
  if (!group || !group.groupID) return;
  
  // 保存选择
  saveGuarChoice({ groupID: group.groupID });
  
  // 更新用户
  const u = loadUser();
  if (u?.accountId) {
    saveUser({ 
      accountId: u.accountId, 
      orgNumber: group.groupID, 
      guarGroup: {
        groupID: group.groupID,
        aggreNode: group.aggreNode,
        assignNode: group.assignNode,
        pledgeAddress: group.pledgeAddress,
        assignAPIEndpoint: group.assignAPIEndpoint,
        aggrAPIEndpoint: group.aggrAPIEndpoint
      }
    });
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
  handler: (e: HTMLElementEventMap[K]) => void | Promise<void>
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
  const groupSearch = document.getElementById(DOM_IDS.groupSearch) as HTMLInputElement | null;
  const groupSearchBtn = document.getElementById(DOM_IDS.groupSearchBtn) as HTMLButtonElement | null;
  
  // 添加表单验证
  addInlineValidation(idSelector(DOM_IDS.groupSearch), [
    { validator: 'required', message: t('validation.orgIdRequired') || '请输入组织ID' },
    { validator: 'orgId', message: t('validation.orgIdFormat') || '需8位数字' }
  ], { showOnInput: true, debounceMs: 150 });
  
  if (groupSearch) {
    addEvent(groupSearch, 'input', handleGroupSearchInput);
    addEvent(groupSearch, 'keydown', handleGroupSearchKeydown);
  }
  
  // 搜索按钮点击
  if (groupSearchBtn) {
    addEvent(groupSearchBtn, 'click', handleSearchBtnClick);
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
  const joinRecBtn = document.getElementById(DOM_IDS.joinRecBtn);
  addEvent(joinRecBtn, 'click', handleJoinRecClick);
  
  // 加入搜索结果组织按钮
  const joinSearchBtn = document.getElementById(DOM_IDS.joinSearchBtn);
  addEvent(joinSearchBtn, 'click', handleJoinSearchClick);
  
  // 跳过按钮
  const skipJoinBtn = document.getElementById(DOM_IDS.skipJoinBtn);
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
  
  // 清除当前选中组织
  currentSelectedGroup = null;
  
  // 先设置默认值（静态），然后异步从后端获取动态信息
  pageState.set({
    selectedGroup: null,
    searchState: 'idle',
    recGroupID: DEFAULT_GROUP.groupID,
    recAggre: DEFAULT_GROUP.aggreNode,
    recAssign: DEFAULT_GROUP.assignNode,
    recPledge: DEFAULT_GROUP.pledgeAddress,
    recAssignPort: '加载中...',
    recAggrPort: '加载中...',
    searchBtnDisabled: true
  });
  
  // 异步从后端获取推荐组织的动态信息
  loadRecommendedGroupInfo();
  
  // 重置标签和面板状态
  resetTabsAndPanes();
  
  // 绑定事件
  bindEvents();
}

/**
 * 从后端加载推荐组织的动态信息
 * 用于显示最新的端口号等信息
 */
async function loadRecommendedGroupInfo(): Promise<void> {
  try {
    console.debug('[JoinGroup] Loading recommended group info from backend...');
    const result = await queryGroupInfoSafe(DEFAULT_GROUP.groupID);
    
    if (result.success && pageState) {
      console.debug('[JoinGroup] Got dynamic recommended group info:', {
        groupID: result.data.groupID,
        assignAPIEndpoint: result.data.assignAPIEndpoint,
        aggrAPIEndpoint: result.data.aggrAPIEndpoint
      });
      
      pageState.set({
        recGroupID: result.data.groupID,
        recAggre: result.data.aggreNode,
        recAssign: result.data.assignNode,
        recPledge: result.data.pledgeAddress,
        recAssignPort: result.data.assignAPIEndpoint || '-',
        recAggrPort: result.data.aggrAPIEndpoint || '-'
      });
    } else {
      console.warn('[JoinGroup] Failed to load recommended group info:', result.success ? 'unknown' : result.error);
      // 显示错误状态
      if (pageState) {
        pageState.set({
          recAssignPort: '获取失败',
          recAggrPort: '获取失败'
        });
      }
    }
  } catch (error) {
    console.error('[JoinGroup] Error loading recommended group info:', error);
    if (pageState) {
      pageState.set({
        recAssignPort: '获取失败',
        recAggrPort: '获取失败'
      });
    }
  }
}
