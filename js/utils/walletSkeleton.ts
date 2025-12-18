/**
 * Wallet Skeleton Loading Utilities
 * 
 * 钱包页面专用骨架屏工具函数。
 * 提供地址列表、转账来源地址、组织面板等区域的骨架屏显示。
 * 
 * @module utils/walletSkeleton
 */

// ============================================================================
// Types
// ============================================================================

/** 骨架屏配置选项 */
export interface SkeletonOptions {
  /** 骨架屏项目数量 */
  count?: number;
  /** 是否显示动画 */
  animated?: boolean;
}

// ============================================================================
// Address List Skeleton
// ============================================================================

/**
 * 创建地址列表骨架屏 HTML
 * @param count - 骨架屏卡片数量
 */
export function createAddressListSkeleton(count: number = 3): HTMLElement {
  const container = document.createElement('div');
  container.className = 'address-skeleton-container';
  container.setAttribute('aria-label', '加载中...');
  container.setAttribute('role', 'status');
  
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'address-skeleton-card';
    card.innerHTML = `
      <div class="skeleton-avatar"></div>
      <div class="skeleton-content">
        <div class="skeleton-text skeleton-text--addr"></div>
        <div class="skeleton-text skeleton-text--balance"></div>
      </div>
      <div class="skeleton-arrow"></div>
    `;
    container.appendChild(card);
  }
  
  return container;
}

/**
 * 显示地址列表骨架屏
 * @param element - 目标容器元素
 * @param options - 配置选项
 */
export function showAddressListSkeleton(
  element: HTMLElement | null,
  options: SkeletonOptions = {}
): void {
  if (!element) return;
  
  const { count = 3 } = options;
  const skeleton = createAddressListSkeleton(count);
  
  // 保存原始内容标记
  element.dataset.skeletonActive = 'true';
  element.replaceChildren(skeleton);
}

/**
 * 隐藏地址列表骨架屏（由实际内容替换时自动完成）
 * @param element - 目标容器元素
 */
export function hideAddressListSkeleton(element: HTMLElement | null): void {
  if (!element) return;
  delete element.dataset.skeletonActive;
}

// ============================================================================
// Source Address List Skeleton (Transfer Panel)
// ============================================================================

/**
 * 创建转账来源地址骨架屏 HTML
 * @param count - 骨架屏项目数量
 */
export function createSrcAddrSkeleton(count: number = 2): HTMLElement {
  const container = document.createElement('div');
  container.className = 'src-addr-skeleton-container';
  container.setAttribute('aria-label', '加载中...');
  container.setAttribute('role', 'status');
  
  for (let i = 0; i < count; i++) {
    const item = document.createElement('div');
    item.className = 'src-addr-skeleton-item';
    item.innerHTML = `
      <div class="skeleton-coin"></div>
      <div class="skeleton-info">
        <div class="skeleton-line skeleton-line--long"></div>
        <div class="skeleton-line skeleton-line--short"></div>
      </div>
      <div class="skeleton-amount"></div>
    `;
    container.appendChild(item);
  }
  
  return container;
}

/**
 * 显示转账来源地址骨架屏
 * @param element - 目标容器元素
 * @param options - 配置选项
 */
export function showSrcAddrSkeleton(
  element: HTMLElement | null,
  options: SkeletonOptions = {}
): void {
  if (!element) return;
  
  const { count = 2 } = options;
  const skeleton = createSrcAddrSkeleton(count);
  
  element.dataset.skeletonActive = 'true';
  element.replaceChildren(skeleton);
}

/**
 * 隐藏转账来源地址骨架屏
 * @param element - 目标容器元素
 */
export function hideSrcAddrSkeleton(element: HTMLElement | null): void {
  if (!element) return;
  delete element.dataset.skeletonActive;
}

// ============================================================================
// Organization Panel Skeleton
// ============================================================================

/**
 * 创建组织面板骨架屏 HTML
 */
export function createOrgPanelSkeleton(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'org-skeleton-container';
  container.setAttribute('aria-label', '加载中...');
  container.setAttribute('role', 'status');
  
  container.innerHTML = `
    <div class="org-skeleton-grid">
      <div class="org-skeleton-item">
        <div class="skeleton-label"></div>
        <div class="skeleton-value"></div>
      </div>
      <div class="org-skeleton-item">
        <div class="skeleton-label"></div>
        <div class="skeleton-value"></div>
      </div>
      <div class="org-skeleton-item">
        <div class="skeleton-label"></div>
        <div class="skeleton-value"></div>
      </div>
      <div class="org-skeleton-item">
        <div class="skeleton-label"></div>
        <div class="skeleton-value"></div>
      </div>
    </div>
  `;
  
  return container;
}

/**
 * 显示组织面板骨架屏
 * @param element - 目标容器元素
 */
export function showOrgPanelSkeleton(element: HTMLElement | null): void {
  if (!element) return;
  
  const skeleton = createOrgPanelSkeleton();
  element.dataset.skeletonActive = 'true';
  element.replaceChildren(skeleton);
}

/**
 * 隐藏组织面板骨架屏
 * @param element - 目标容器元素
 */
export function hideOrgPanelSkeleton(element: HTMLElement | null): void {
  if (!element) return;
  delete element.dataset.skeletonActive;
}

// ============================================================================
// Balance Display Skeleton
// ============================================================================

/**
 * 创建余额显示骨架屏 HTML
 */
export function createBalanceSkeleton(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'balance-skeleton';
  container.setAttribute('aria-label', '加载中...');
  container.setAttribute('role', 'status');
  
  container.innerHTML = `
    <div class="skeleton-amount"></div>
    <div class="skeleton-unit"></div>
  `;
  
  return container;
}

/**
 * 显示余额骨架屏
 * @param element - 目标容器元素
 */
export function showBalanceSkeleton(element: HTMLElement | null): void {
  if (!element) return;
  
  const skeleton = createBalanceSkeleton();
  element.dataset.skeletonActive = 'true';
  element.replaceChildren(skeleton);
}

// ============================================================================
// Coin Distribution Skeleton
// ============================================================================

/**
 * 创建币种分布骨架屏 HTML
 */
export function createCoinDistributionSkeleton(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'coin-distribution';
  container.setAttribute('aria-label', '加载中...');
  container.setAttribute('role', 'status');
  
  for (let i = 0; i < 3; i++) {
    const card = document.createElement('div');
    card.className = 'coin-skeleton-card';
    card.innerHTML = `
      <div class="skeleton-icon"></div>
      <div class="skeleton-name"></div>
      <div class="skeleton-value"></div>
    `;
    container.appendChild(card);
  }
  
  return container;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 检查元素是否正在显示骨架屏
 * @param element - 目标元素
 */
export function isShowingSkeleton(element: HTMLElement | null): boolean {
  if (!element) return false;
  return element.dataset.skeletonActive === 'true';
}

/**
 * 清除骨架屏状态标记
 * @param element - 目标元素
 */
export function clearSkeletonState(element: HTMLElement | null): void {
  if (!element) return;
  delete element.dataset.skeletonActive;
}
