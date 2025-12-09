# UI修复需求文档

## Introduction

本文档定义了 UTXO 钱包应用的三个UI修复需求。这些修复旨在改善用户体验，解决用户反馈的显示问题，包括用户信息栏更新延迟、账户结构体视觉优化和UTXO详情弹窗可读性问题。

## Glossary

- **Header User Display**: 头部用户信息显示，位于页面右上角的用户头像和昵称区域
- **Wallet Structure Modal**: 钱包结构体弹窗，展示账户详细信息的模态框
- **UTXO Detail Modal**: UTXO详情弹窗，显示UTXO和TXCer详细信息的模态框
- **Dark Mode**: 深色模式，应用的夜间主题
- **CSS Variables**: CSS变量，用于定义和管理主题颜色值的技术

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望在登录后立即看到正确的用户信息显示在右上角，而不需要等待进入下一个页面才更新。

#### Acceptance Criteria

1. WHEN a user completes login or registration, THE System SHALL immediately update the header user display to show the logged-in state
2. WHEN a user completes account import, THE System SHALL immediately update the header user display to show the logged-in state
3. WHEN the application loads with an existing logged-in user, THE System SHALL display the correct user information in the header before any route navigation
4. THE header user display SHALL show the user's nickname and avatar within 100 milliseconds of login completion
5. THE header user display SHALL not show "未登录" (Not Logged In) when a valid user session exists

### Requirement 2

**User Story:** 作为用户，我希望账户结构体展示信息时的分隔线在深色模式下更加柔和美观，不会显得过于突兀。

#### Acceptance Criteria

1. WHEN viewing wallet structure details in Dark Mode, THE System SHALL use semi-transparent divider lines instead of solid white lines
2. WHEN viewing sub-address detail cards in Dark Mode, THE System SHALL use subtle border colors that blend with the dark background
3. THE divider lines in wallet structure SHALL have an opacity of no more than 0.2 in Dark Mode
4. THE divider lines SHALL use CSS variables for consistent theming across all wallet structure components
5. THE visual hierarchy SHALL remain clear while reducing the harshness of white lines in Dark Mode

### Requirement 3

**User Story:** 作为用户，我希望UTXO详情弹窗中的文字在深色模式下清晰可读，不会出现黑色文字或白色背景框。

#### Acceptance Criteria

1. WHEN viewing UTXO details in Dark Mode, THE System SHALL use light-colored text on dark backgrounds
2. WHEN viewing UTXO details in Dark Mode, THE System SHALL ensure all text elements have a contrast ratio of at least 4.5:1 against their backgrounds
3. THE detail-val elements SHALL use CSS variables for text color instead of hardcoded dark colors
4. THE detail-sub elements (Source TX info box) SHALL use dark backgrounds in Dark Mode instead of white backgrounds
5. THE detail-row elements SHALL have proper spacing and borders that work in both Light and Dark modes
6. THE modal content SHALL use theme-appropriate colors defined by CSS variables

### Requirement 4

**User Story:** 作为开发者，我希望所有UI修复使用CSS变量实现，以便保持代码的可维护性和一致性。

#### Acceptance Criteria

1. THE System SHALL use CSS variables (--text-primary, --text-secondary, --bg-card-solid, etc.) for all color definitions
2. THE System SHALL define Dark Mode overrides in `[data-theme="dark"]` selectors
3. THE System SHALL avoid hardcoded color values (#334155, #fff, etc.) in favor of CSS variables
4. THE System SHALL ensure all new styles follow the existing CSS variable naming conventions
5. THE System SHALL maintain backward compatibility with existing Light Mode styles

### Requirement 5

**User Story:** 作为用户，我希望这些UI修复在所有支持的浏览器中正常工作，以便获得一致的体验。

#### Acceptance Criteria

1. THE UI fixes SHALL function correctly in Chrome version 90 and above
2. THE UI fixes SHALL function correctly in Firefox version 88 and above
3. THE UI fixes SHALL function correctly in Safari version 14 and above
4. THE UI fixes SHALL function correctly in Edge version 90 and above
5. THE UI fixes SHALL not cause any visual regressions in Light Mode

### Requirement 6

**User Story:** 作为用户，我希望这些UI修复不会影响应用性能，以便获得流畅的使用体验。

#### Acceptance Criteria

1. THE header user display update SHALL complete within 100 milliseconds
2. THE wallet structure modal SHALL render without noticeable delay
3. THE UTXO detail modal SHALL open and display content within 200 milliseconds
4. THE UI fixes SHALL not cause any JavaScript errors or console warnings
5. THE UI fixes SHALL not increase page load time by more than 10 milliseconds
