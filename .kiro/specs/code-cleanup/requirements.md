# Requirements Document

## Introduction

本项目经历了两次重构，导致存在大量不再使用的遗留代码。经过详细分析，发现以下类型的冗余代码：

### 1. 遗留文件（可安全删除）
- `app.js` (根目录，约8600行) - 已被 `js/app.js` 和模块化代码替代，在 index.html 中已被注释掉
- `app.js.backup` - 备份文件，不再需要
- `style.css` (根目录，约10600行) - 已被 `css/` 目录下的模块化CSS替代，index.html 中未引用

### 2. HTML 中的遗留页面片段
- `#importNextCard` - 占位页面，内容为"此页面为导入钱包后的下一步占位，后续将专门更新"，从未实际使用
- `#memberInfoCard` - 旧版账户信息页面，router.js 中的注释表明"直接跳转到 main 页面，不显示 member-info 页面"
- `#finalCard` - 在 router.js 的 allCardIds 中引用，但 index.html 中不存在此元素

### 3. CSS 中的遗留样式
- `style.css` 中的 `#memberInfoCard .mi-*` 系列样式 - 对应已废弃的 memberInfoCard 页面
- `style.css` 中的 `#newUserCard .card-header` 等旧版样式 - 已被 `css/new-user.css` 中的新样式替代

### 4. 其他遗留文件
- `fix_css_indent.py` - 一次性使用的 Python 脚本，用于修复 style.css 缩进，现已无用

本次清理工作旨在识别并删除这些冗余代码，减少项目体积，提高可维护性。

## Glossary

- **Legacy Code**: 旧版代码，指在重构过程中被新代码替代但仍保留在项目中的代码
- **Modular Code**: 模块化代码，指重构后按功能分离到 `js/` 和 `css/` 目录下的代码
- **Dead Code**: 死代码，指项目中不再被任何地方引用或使用的代码
- **Placeholder Page**: 占位页面，指在开发过程中创建但从未实际使用的页面片段

## Requirements

### Requirement 1

**User Story:** As a developer, I want to remove legacy root-level files that have been replaced by modular code, so that the project codebase is cleaner and smaller.

#### Acceptance Criteria

1. WHEN the legacy `app.js` is confirmed not loaded in index.html THEN the system SHALL delete the file
2. WHEN the legacy `app.js.backup` exists THEN the system SHALL delete the backup file
3. WHEN the legacy `style.css` is confirmed not loaded in index.html THEN the system SHALL delete the file
4. WHEN the `fix_css_indent.py` script is no longer needed THEN the system SHALL delete the file

### Requirement 2

**User Story:** As a developer, I want to remove unused HTML page sections, so that the codebase is cleaner and easier to maintain.

#### Acceptance Criteria

1. WHEN the `#importNextCard` section is identified as a placeholder THEN the system SHALL remove it from index.html
2. WHEN the `#memberInfoCard` section is confirmed unused THEN the system SHALL remove it from index.html
3. WHEN removing HTML sections THEN the system SHALL also remove corresponding route handlers in router.js

### Requirement 3

**User Story:** As a developer, I want to clean up router.js references to non-existent pages, so that the routing logic is accurate.

#### Acceptance Criteria

1. WHEN `finalCard` is referenced in allCardIds but does not exist in HTML THEN the system SHALL remove the reference
2. WHEN `importNextCard` is removed from HTML THEN the system SHALL remove its route handler
3. WHEN `memberInfoCard` is removed from HTML THEN the system SHALL remove its route handler and related functions

### Requirement 4

**User Story:** As a developer, I want to clean up constants.js references to removed routes, so that the configuration is accurate.

#### Acceptance Criteria

1. WHEN a route is removed THEN the system SHALL remove its entry from ROUTES constant
2. WHEN a route is removed THEN the system SHALL remove its entry from ROUTE_CARD_MAP constant

### Requirement 5

**User Story:** As a developer, I want a summary report of all removed code, so that I can track what was cleaned up.

#### Acceptance Criteria

1. WHEN the cleanup is complete THEN the system SHALL provide a summary of files removed
2. WHEN the cleanup is complete THEN the system SHALL provide a summary of HTML sections removed
3. WHEN the cleanup is complete THEN the system SHALL estimate the storage space saved
