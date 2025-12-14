# Requirements Document

## Introduction

本功能将私钥加密从可选改为强制，并增加屏幕锁定保护机制。用户在创建账户或登录时必须设置/输入密码，密码直接集成在页面表单中而非弹窗。同时，当用户超过10分钟无操作时，系统自动进入锁定状态，需要输入密码才能继续使用钱包。

## Glossary

- **Encryption Password (加密密码)**: 用于加密私钥的用户密码，使用 PBKDF2 + AES-256-GCM 算法
- **Screen Lock (屏幕锁定)**: 用户无操作超时后的安全保护状态
- **Idle Timeout (空闲超时)**: 用户无交互的时间阈值，默认10分钟
- **Lock Screen (锁屏界面)**: 显示密码输入的全屏覆盖层
- **Activity Events (活动事件)**: 用于检测用户活动的事件（点击、键盘、滚动、触摸）

## Requirements

### Requirement 1

**User Story:** As a new user, I want to set a password when creating my account, so that my private key is securely encrypted from the start.

#### Acceptance Criteria

1. WHEN a user visits the new account page THEN the System SHALL display a password input field integrated in the form
2. WHEN a user visits the new account page THEN the System SHALL display a password confirmation input field
3. WHEN a user attempts to create an account without entering a password THEN the System SHALL prevent account creation and display a validation error
4. WHEN a user enters mismatched passwords THEN the System SHALL prevent account creation and display a mismatch error
5. WHEN a user enters a password shorter than 6 characters THEN the System SHALL prevent account creation and display a length error
6. WHEN a user successfully creates an account with valid password THEN the System SHALL encrypt the private key using the provided password
7. WHEN the password fields are displayed THEN the System SHALL provide a toggle button to show/hide password text