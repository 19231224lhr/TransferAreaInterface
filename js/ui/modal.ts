/**
 * Modal Dialog Module (Reactive Version)
 * 
 * 使用响应式绑定系统重构的模态对话框模块。
 * 提供统一的加载、成功、错误和确认状态管理。
 * 
 * @module ui/modal
 */

import { t } from '../i18n/index.js';
import {
  createReactiveState,
  type ReactiveState
} from '../utils/reactive';
import { html, nothing, renderInto, type TemplateResult } from '../utils/view';
import { DOM_IDS, idSelector } from '../config/domIds';

// ============================================================================
// Types
// ============================================================================

/**
 * 模态框状态类型
 */
type ModalMode = 'loading' | 'success' | 'error' | 'hidden';

/**
 * 统一模态框状态
 */
interface UnifiedModalState {
  mode: ModalMode;
  title: string;
  text: string;
  isVisible: boolean;
  showCancelBtn: boolean;
}

// ============================================================================
// State & Bindings
// ============================================================================

/**
 * 初始状态
 */
const initialState: UnifiedModalState = {
  mode: 'hidden',
  title: '',
  text: '',
  isVisible: false,
  showCancelBtn: false
};

/**
 * 状态到 DOM 的绑定配置
 */
const stateBindings = {
  isVisible: [
    { selector: idSelector(DOM_IDS.actionOverlay), type: 'visible' as const }
  ]
  // 注意：移除了 title 和 text 的绑定，因为这些元素由 showModalTip 等函数直接管理
  // 混用 reactive 的 textContent 和 showModalTip 的 renderInto 会导致 lit-html ChildPart 错误
};

// 模态框状态实例
let modalState: ReactiveState<UnifiedModalState> | null = null;

// 回调函数存储
let onOkCallback: (() => void) | null = null;
let onCancelCallback: (() => void) | null = null;

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * 确保模态框状态已初始化
 */
function ensureState(): ReactiveState<UnifiedModalState> {
  if (!modalState) {
    modalState = createReactiveState(initialState, stateBindings);
  }
  return modalState;
}

/**
 * 更新模态框 UI 元素
 */
function updateModalUI(mode: ModalMode, isError: boolean = false): void {
  const loading = document.getElementById(DOM_IDS.unifiedLoading);
  const success = document.getElementById(DOM_IDS.unifiedSuccess);
  const iconWrap = document.getElementById(DOM_IDS.unifiedIconWrap);
  const successIcon = document.getElementById(DOM_IDS.unifiedSuccessIcon);
  const errorIcon = document.getElementById(DOM_IDS.unifiedErrorIcon);

  if (mode === 'loading') {
    if (loading) loading.classList.remove('hidden');
    if (success) success.classList.add('hidden');
  } else if (mode === 'success' || mode === 'error') {
    if (loading) loading.classList.add('hidden');
    if (success) {
      success.classList.remove('hidden');
      // 重新触发动画
      success.style.animation = 'none';
      success.offsetHeight; // 触发 reflow
      success.style.animation = '';

      if (isError) {
        success.classList.add('error-mode');
      } else {
        success.classList.remove('error-mode');
      }
    }

    // 更新图标
    if (iconWrap) {
      if (isError) {
        iconWrap.classList.add('error-state');
      } else {
        iconWrap.classList.remove('error-state');
      }
    }
    if (successIcon) successIcon.classList.toggle('hidden', isError);
    if (errorIcon) errorIcon.classList.toggle('hidden', !isError);
  }
}

/**
 * 重置模态框状态
 */
function resetModalState(): void {
  const loading = document.getElementById(DOM_IDS.unifiedLoading);
  const success = document.getElementById(DOM_IDS.unifiedSuccess);
  const iconWrap = document.getElementById(DOM_IDS.unifiedIconWrap);
  const successIcon = document.getElementById(DOM_IDS.unifiedSuccessIcon);
  const errorIcon = document.getElementById(DOM_IDS.unifiedErrorIcon);
  const textEl = document.getElementById(DOM_IDS.unifiedText);
  const titleEl = document.getElementById(DOM_IDS.unifiedTitle);

  if (loading) loading.classList.remove('hidden');
  if (success) {
    success.classList.add('hidden');
    success.classList.remove('error-mode');
  }
  if (iconWrap) iconWrap.classList.remove('error-state');
  if (successIcon) successIcon.classList.remove('hidden');
  if (errorIcon) errorIcon.classList.add('hidden');
  if (textEl) {
    textEl.classList.remove('tip--error');
    // 清空文本内容，使用 renderInto 保持与其他函数一致
    renderInto(textEl, html``);
  }
  if (titleEl) {
    titleEl.textContent = '';
  }

  onOkCallback = null;
  onCancelCallback = null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 显示加载状态
 * @param text - 加载文本
 */
export function showUnifiedLoading(text?: string): void {
  const state = ensureState();

  state.set({
    mode: 'loading',
    title: '',
    text: text || t('common.processing') || '处理中...',
    isVisible: true,
    showCancelBtn: false
  });

  // 更新加载文本元素
  const textEl = document.getElementById(DOM_IDS.actionOverlayText);
  if (textEl) {
    textEl.textContent = text || t('common.processing') || '处理中...';
  }

  updateModalUI('loading');
}

/**
 * 切换到成功状态（从加载状态平滑过渡）
 * @param title - 成功标题
 * @param text - 成功描述
 * @param onOk - 确定按钮回调
 * @param onCancel - 取消按钮回调（可选，提供时显示取消按钮）
 * @param isError - 是否为错误状态
 */
export function showUnifiedSuccess(
  title?: string,
  text?: string,
  onOk?: () => void,
  onCancel?: () => void,
  isError: boolean = false
): void {
  const state = ensureState();

  const finalTitle = title || (isError ? (t('modal.operationFailed') || '操作失败') : (t('common.success') || '成功'));
  const finalText = text || '';

  state.set({
    mode: isError ? 'error' : 'success',
    title: finalTitle,
    text: finalText,
    isVisible: true,
    showCancelBtn: !!onCancel
  });

  // 存储回调
  onOkCallback = onOk || null;
  onCancelCallback = onCancel || null;

  // 更新 UI
  updateModalUI(isError ? 'error' : 'success', isError);

  // 手动更新标题和文本（因为绑定配置中移除了这些绑定）
  const titleEl = document.getElementById(DOM_IDS.unifiedTitle);
  const textEl = document.getElementById(DOM_IDS.unifiedText);

  if (titleEl) {
    titleEl.textContent = finalTitle;
  }
  if (textEl) {
    if (isError) {
      textEl.classList.add('tip--error');
    } else {
      textEl.classList.remove('tip--error');
    }
    // 使用 renderInto 与 showModalTip 保持一致，避免 lit-html 状态冲突
    renderInto(textEl, html`${finalText}`);
  }

  // 处理取消按钮
  const cancelBtn = document.getElementById(DOM_IDS.unifiedCancelBtn);
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

  // 处理确定按钮
  const okBtn = document.getElementById(DOM_IDS.unifiedOkBtn);
  if (okBtn) {
    okBtn.onclick = () => {
      hideUnifiedOverlay();
      if (onOk) onOk();
    };
    // 聚焦确定按钮以捕获键盘事件
    setTimeout(() => okBtn.focus(), 50);
  }
}

/**
 * 显示统一错误模态框
 * @param title - 错误标题
 * @param text - 错误描述
 * @param onOk - 确定按钮回调
 */
export function showUnifiedError(
  title?: string,
  text?: string,
  onOk?: () => void
): void {
  showUnifiedSuccess(title, text, onOk, undefined, true);
}

/**
 * 隐藏统一模态框
 */
export function hideUnifiedOverlay(): void {
  const state = ensureState();

  state.set({
    mode: 'hidden',
    isVisible: false
  });

  const overlay = document.getElementById(DOM_IDS.actionOverlay);
  if (overlay) overlay.classList.add('hidden');

  resetModalState();
}

/**
 * 获取操作模态框元素（向后兼容）
 * @returns 模态框元素对象
 */
export function getActionModalElements(): {
  modal: HTMLElement | null;
  titleEl: HTMLElement | null;
  textEl: HTMLElement | null;
  okEl: HTMLElement | null;
  cancelEl: HTMLElement | null;
} {
  const modal = document.getElementById(DOM_IDS.actionOverlay);
  const titleEl = document.getElementById(DOM_IDS.unifiedTitle);
  const textEl = document.getElementById(DOM_IDS.unifiedText);
  const okEl = document.getElementById(DOM_IDS.unifiedOkBtn);
  const cancelEl = document.getElementById(DOM_IDS.unifiedCancelBtn);

  // 准备显示成功状态
  const loading = document.getElementById(DOM_IDS.unifiedLoading);
  const success = document.getElementById(DOM_IDS.unifiedSuccess);
  if (loading) loading.classList.add('hidden');
  if (success) success.classList.remove('hidden');

  if (cancelEl) {
    cancelEl.classList.add('hidden');
    cancelEl.onclick = null;
  }

  return { modal, titleEl, textEl, okEl, cancelEl };
}

/**
 * 显示模态提示（成功或错误）
 * @param title - 模态框标题
 * @param html - 模态框内容（HTML）
 * @param isError - 是否为错误
 */
export function showModalTip(title: string, content?: string | TemplateResult, isError?: boolean): void {
  const loading = document.getElementById(DOM_IDS.unifiedLoading);
  const success = document.getElementById(DOM_IDS.unifiedSuccess);
  const iconWrap = document.getElementById(DOM_IDS.unifiedIconWrap);
  const successIcon = document.getElementById(DOM_IDS.unifiedSuccessIcon);
  const errorIcon = document.getElementById(DOM_IDS.unifiedErrorIcon);

  if (loading) loading.classList.add('hidden');
  if (success) {
    success.classList.remove('hidden');
    success.style.animation = 'none';
    success.offsetHeight;
    success.style.animation = '';

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
    if (isError) textEl.classList.add('tip--error');
    else textEl.classList.remove('tip--error');
    // 始终用 renderInto，让 lit-html 自己管理内容更新
    if (typeof content === 'string' || content === undefined) {
      renderInto(textEl, html`${typeof content === 'string' ? content.trim() : ''}`);
    } else {
      renderInto(textEl, content);
    }
  }
  if (modal) modal.classList.remove('hidden');

  const handler = () => {
    if (modal) modal.classList.add('hidden');
    resetModalState();
    if (okEl) okEl.removeEventListener('click', handler);
  };

  if (okEl) okEl.addEventListener('click', handler);
}

/**
 * 显示确认模态框
 * @param title - 模态框标题
 * @param html - 模态框内容（HTML）
 * @param okText - 确定按钮文本
 * @param cancelText - 取消按钮文本
 * @returns Promise，确认返回 true，取消返回 false
 */

// Store references to current event handlers for cleanup
let currentConfirmOkHandler: (() => void) | null = null;
let currentConfirmCancelHandler: (() => void) | null = null;

export function showConfirmModal(
  title?: string,
  content?: string | TemplateResult,
  okText?: string,
  cancelText?: string,
  isDanger: boolean = false
): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = document.getElementById(DOM_IDS.confirmGasModal);
    const titleEl = document.getElementById(DOM_IDS.confirmGasTitle);
    const textEl = document.getElementById(DOM_IDS.confirmGasText);
    const okEl = document.getElementById(DOM_IDS.confirmGasOk);
    const cancelEl = document.getElementById(DOM_IDS.confirmGasCancel);

    if (!modal || !okEl || !cancelEl) {
      resolve(true);
      return;
    }

    // Remove previous event handlers if they exist
    if (currentConfirmOkHandler) {
      okEl.removeEventListener('click', currentConfirmOkHandler);
      currentConfirmOkHandler = null;
    }
    if (currentConfirmCancelHandler) {
      cancelEl.removeEventListener('click', currentConfirmCancelHandler);
      currentConfirmCancelHandler = null;
    }

    // Apply danger styles if requested
    if (isDanger) {
      modal.classList.add('modal--danger');
      okEl.className = 'btn danger'; // Force danger class
    } else {
      modal.classList.remove('modal--danger');
      okEl.className = 'btn primary'; // Reset to primary
    }

    if (titleEl) {
      titleEl.textContent = title || t('modal.confirm') || '确认';
    }
    if (textEl) {
      textEl.classList.remove('tip--error');
      // 始终用 renderInto，让 lit-html 自己管理内容更新
      if (typeof content === 'string' || content === undefined) {
        renderInto(textEl, html`${typeof content === 'string' ? content.trim() : ''}`);
      } else {
        renderInto(textEl, content);
      }
    }
    if (okText) {
      okEl.textContent = okText;
    }
    if (cancelText) {
      cancelEl.textContent = cancelText;
    }

    modal.classList.remove('hidden');

    const cleanup = (result: boolean) => {
      modal.classList.add('hidden');
      // Clean up handlers
      if (currentConfirmOkHandler) {
        okEl.removeEventListener('click', currentConfirmOkHandler);
        currentConfirmOkHandler = null;
      }
      if (currentConfirmCancelHandler) {
        cancelEl.removeEventListener('click', currentConfirmCancelHandler);
        currentConfirmCancelHandler = null;
      }
      // Reset danger class after closing
      modal.classList.remove('modal--danger');
      resolve(result);
    };

    // Create and store new handlers
    currentConfirmOkHandler = () => cleanup(true);
    currentConfirmCancelHandler = () => cleanup(false);

    okEl.addEventListener('click', currentConfirmOkHandler);
    cancelEl.addEventListener('click', currentConfirmCancelHandler);
  });
}

/**
 * 销毁模态框状态
 */
export function destroyModalState(): void {
  modalState?.destroy();
  modalState = null;
  onOkCallback = null;
  onCancelCallback = null;
}
