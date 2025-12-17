/**
 * Wallet Structure Toggle Module
 * 
 * Handles wallet structure expansion/collapse (copied from backup)
 */

import { t } from '../i18n/index.js';

/**
 * Initialize wallet structure toggle
 */
export function initWalletStructToggle() {
  const wsToggle = document.getElementById('walletStructToggle');
  const wsBox = document.getElementById('walletStructBox');
  const wsSection = document.getElementById('walletStructPane');
  const wsContent = wsToggle?.closest('.struct-section')?.querySelector('.struct-content');
  
  if (!wsToggle || !wsBox || wsToggle.dataset._bind) return;
  
  wsToggle.addEventListener('click', () => {
    const isExpanded = wsSection?.classList.contains('expanded') || wsToggle.classList.contains('expanded');

    if (!isExpanded) {
      // Update wallet struct content
      const pp = window.PanguPay;
      const updateFn =
        (typeof window.updateWalletStruct === 'function' ? window.updateWalletStruct : null) ||
        (pp?.charts && typeof pp.charts.updateWalletStruct === 'function' ? pp.charts.updateWalletStruct : null);

      if (typeof updateFn === 'function') {
        try {
          updateFn();
        } catch {
          // ignore
        }
      }
      
      wsBox.classList.remove('hidden');
      
      // Add expanded class to parent container
      if (wsSection) {
        wsSection.classList.add('expanded');
      }
      // V2 version collapse animation
      if (wsContent) {
        wsContent.classList.add('expanded');
      }
      wsBox.classList.add('expanded');
      wsToggle.classList.add('expanded');
      
      // Update button text
      const textSpan = wsToggle.querySelector('span');
      if (textSpan) textSpan.textContent = t('transfer.collapseStruct');
      else wsToggle.textContent = t('transfer.collapseStruct');
    } else {
      // Remove expanded class from parent container
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

/**
 * Initialize transaction detail modal
 */
export function initTxDetailModal() {
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
      // Syntax highlight JSON
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
  
  // View transaction structure button
  if (viewBuildInfoBtn) {
    viewBuildInfoBtn.addEventListener('click', () => {
      const data = viewBuildInfoBtn.dataset.txData || '{}';
      showTxDetail('BuildTXInfo 交易结构体', data);
    });
  }
  
  // View transaction info button
  if (viewTxInfoBtn) {
    viewTxInfoBtn.addEventListener('click', () => {
      const data = viewTxInfoBtn.dataset.txData || '{}';
      showTxDetail('Transaction 交易信息', data);
    });
  }
  
  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', hideTxDetail);
  }
  
  // OK button
  if (okBtn) {
    okBtn.addEventListener('click', hideTxDetail);
  }
  
  // Copy button
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
  
  // Click mask to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideTxDetail();
    }
  });
}
