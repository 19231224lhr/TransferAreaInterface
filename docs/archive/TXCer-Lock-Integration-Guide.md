# TXCer 锁定管理器使用指南

## 📖 问题背景

当用户使用 TXCer 构造交易时，可能会出现以下 Race Condition：

1. 用户点击"发送"按钮，开始构造交易
2. 在交易构造和发送的过程中，TXCer 的前置交易上链了
3. AssignNode 推送 `Status=0`的变更通知（表示TXCer应该转换为UTXO）
4. 前端自动删除了 TXCer，添加了 UTXO
5. 但此时用户的交易还在构造中，仍然使用已删除的 TXCer

结果：交易构造失败或使用了错误的资产。

## ✅ 解决方案

使用 **TXCer 锁定管理器** (`txCerLockManager.ts`)：

### 核心机制

1. **构造交易时加锁**：锁定将要使用的 TXCer
2. **阻止自动替换**：轮询服务检测到锁定，缓存更新
3. **交易发送后解锁**：解锁的同时处理缓存的更新
4. **超时自动解锁**：防止用户取消导致永久锁定（30秒）

## 🔧 在 transfer.ts 中集成

### Step 1: 导入锁定管理器

```typescript
import {
  lockTXCers,
  unlockTXCers,
  lockTXCersFromWallet
} from './txCerLockManager';
```

### Step 2: 在交易构造前锁定 TXCer

```typescript
// 在 `assembleTransaction` 函数开始处
export async function assembleTransaction(params: AssembleParams): Promise<TransactionResult> {
  const { fromAddresses, recipients, changeAddresses, gas, user } = params;
  
  // 🔒 提取并锁定将要使用的 TXCer
  const lockedTXCerIds: string[] = [];
  
  try {
    // 收集所有发送地址的 TXCer
    for (const address of fromAddresses) {
      const addrData = user.wallet.addressMsg[address];
      if (addrData?.txCers) {
        const txCerIds = lockTXCersFromWallet(
          addrData.txCers,
          `用户${user.accountId}构造交易`
        );
        lockedTXCerIds.push(...txCerIds);
      }
    }
    
    console.log(`[Transfer] 已锁定 ${lockedTXCerIds.length} 个 TXCer`);
    
    // ... 构造交易的其余逻辑
    
  } catch (error) {
    // ⚠️ 构造失败时解锁
    if (lockedTXCerIds.length > 0) {
      unlockTXCers(lockedTXCerIds, false); // false = 不处理缓存的更新
      console.warn(`[Transfer] 交易构造失败，已解锁 ${lockedTXCerIds.length} 个 TXCer`);
    }
    throw error;
  }
}
```

### Step 3: 交易发送成功后解锁

```typescript
// 在 `sendTransaction` 函数成功发送后

async function sendTransaction(userNewTX: UserNewTX, lockedTXCerIds: string[]): Promise<void> {
  try {
    const response = await submitTransaction(userNewTX, user);
    
    if (response.success) {
      // ✅ 交易发送成功，解锁 TXCer
      if (lockedTXCerIds.length > 0) {
        unlockTXCers(lockedTXCerIds, true); // true = 处理缓存的更新
        console.log(`[Transfer] 交易发送成功，已解锁 ${lockedTXCerIds.length} 个 TXCer`);
      }
      
      showSuccessToast('交易已发送');
    } else {
      throw new Error(response.message || '交易发送失败');
    }
  } catch (error) {
    // ⚠️ 发送失败时也要解锁
    if (lockedTXCerIds.length > 0) {
      unlockTXCers(lockedTXCerIds, false);
      console.warn(`[Transfer] 交易发送失败，已解锁 ${lockedTXCerIds.length} 个 TXCer`);
    }
    throw error;
  }
}
```

### Step 4: 用户取消交易时解锁

```typescript
// 在用户取消发送的事件处理中

function onCancelTransfer(lockedTXCerIds: string[]): void {
  if (lockedTXCerIds.length > 0) {
    unlockTXCers(lockedTXCerIds, false); // 取消不处理缓存的更新
    console.log('[Transfer] 用户取消发送，已解锁 TXCer');
  }
}
```

## 📊 完整流程示例

```typescript
export async function handleTransferSubmit(event: Event): Promise<void> {
  event.preventDefault();
  
  const lockedTXCerIds: string[] = [];
  
  try {
    // 1️⃣ 锁定 TXCer
    for (const address of selectedAddresses) {
      const addrData = user.wallet.addressMsg[address];
      if (addrData?.txCers) {
        const ids = lockTXCersFromWallet(addrData.txCers, '发送转账');
        lockedTXCerIds.push(...ids);
      }
    }
    
    // 2️⃣ 构造交易
    const userNewTX = await buildTransaction({
      fromAddresses: selectedAddresses,
      recipients,
      changeAddresses,
      gas
    }, user);
    
    // 3️⃣ 显示确认对话框
    const confirmed = await showTransferConfirmation(userNewTX);
    if (!confirmed) {
      // 用户取消
      unlockTXCers(lockedTXCerIds, false);
      return;
    }
    
    // 4️⃣ 发送交易
    const response = await submitTransaction(userNewTX, user);
    
    if (response.success) {
      // ✅ 成功：解锁并处理缓存的更新
      unlockTXCers(lockedTXCerIds, true);
      showSuccessToast('交易已发送');
      
      // 等待确认...
      await waitForTXConfirmation(userNewTX.TX.TXID);
    } else {
      throw new Error('交易发送失败');
    }
    
  } catch (error) {
    // ⚠️ 任何错误都解锁
    if (lockedTXCerIds.length > 0) {
      unlockTXCers(lockedTXCerIds, false);
    }
    showErrorToast(error.message);
  }
}
```

## 🔍 调试工具

```typescript
import { getLockStatus } from './txCerLockManager';

// 检查锁定状态
const status = getLockStatus();
console.log('锁定的 TXCer:', status.lockedCount);
console.log('缓存的更新:', status.pendingCount);
console.log('详情:', status);
```

## ⚠️ 重要注意事项

1. **总是在 try-catch 中使用**：确保无论成功失败都能解锁
2. **记录锁定的 ID**：需要在整个流程中传递 `lockedTXCerIds`
3. **分清 processPending 参数**：
   - `true`：交易成功发送，处理缓存（可能自动替换为UTXO）
   - `false`：交易失败/取消，保留原状态
4. **超时机制**：30秒后自动解锁，所以整个流程应在30秒内完成

## 🎯 预期行为

### 场景1：正常发送
```
用户点击发送 
→ 锁定TXCer 
→ 构造交易 
→ 发送成功 
→ 解锁(processPending=true)
→ 如果有缓存的Status=0更新，现在执行(删除TXCer,添加UTXO)
```

### 场景2：发送前上链
```
用户点击发送 
→ 锁定TXCer 
→ 收到Status=0通知(被阻止,缓存)
→ 构造交易(仍使用TXCer,因为未删除)
→ 发送成功 
→ 解锁(processPending=true)
→ 立即处理缓存的更新(删除TXCer,添加UTXO)
```

### 场景3：用户取消
```
用户点击发送 
→ 锁定TXCer 
→ 用户点击取消 
→ 解锁(processPending=false)
→ 缓存的更新被丢弃,等下次轮询再处理
```

## 🚀 性能影响

- **内存开销**：每个锁定的 TXCer 约 100 bytes
- **CPU开销**：可忽略不计（只是 Map 操作）
- **超时检查**：每 5 秒一次，锁定数为0时自动停止

## 📝 总结

TXCer 锁定管理器通过**时间窗口保护**机制，优雅地解决了并发竞态问题，确保：
1. 用户体验无感（不会看到错误）
2. 数据一致性（不会丢失更新）
3. 安全的回退（超时自动解锁）

记住：**锁定 → 使用 → 解锁**，任何错误都要解锁！
