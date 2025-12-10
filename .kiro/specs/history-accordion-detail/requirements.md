# Requirements Document

## Introduction

改进历史交易记录页面的交易详情展示方式，从侧滑面板改为手风琴式展开，提升用户体验和视觉连贯性。

## Glossary

- **Transaction Item**: 交易列表中的单个交易记录项
- **Detail Panel**: 交易详情面板
- **Accordion**: 手风琴式展开/收起效果
- **History Page**: 历史交易记录页面

## Requirements

### Requirement 1

**User Story:** 作为用户，我想点击交易项后在其下方直接展开详情，而不是打开侧边面板，这样可以保持视觉连贯性和上下文。

#### Acceptance Criteria

1. WHEN a user clicks on a transaction item THEN the system SHALL expand the detail section directly below that transaction item
2. WHEN a transaction detail is expanded THEN the system SHALL smoothly animate the expansion with a slide-down effect
3. WHEN a user clicks on an already expanded transaction item THEN the system SHALL collapse the detail section with a slide-up effect
4. WHEN a user expands a different transaction THEN the system SHALL collapse any previously expanded transaction detail
5. WHEN the detail section is expanded THEN the system SHALL display all transaction information (basic info, address info, blockchain info) in a well-organized layout

### Requirement 2

**User Story:** 作为用户，我想要流畅的动画效果，让展开和收起过程自然舒适。

#### Acceptance Criteria

1. WHEN the detail section expands THEN the system SHALL use a smooth CSS transition with appropriate timing (250-300ms)
2. WHEN the detail section collapses THEN the system SHALL use the same smooth transition
3. WHEN expanding THEN the system SHALL automatically scroll to keep the expanded content visible if needed
4. WHEN the animation is in progress THEN the system SHALL prevent multiple rapid clicks to avoid animation conflicts

### Requirement 3

**User Story:** 作为用户，我想要清晰的视觉反馈，知道哪个交易项是展开状态。

#### Acceptance Criteria

1. WHEN a transaction item is expanded THEN the system SHALL apply an "active" visual state to the transaction item
2. WHEN a transaction item is expanded THEN the system SHALL show a visual indicator (such as an arrow icon) that rotates to indicate the expanded state
3. WHEN hovering over a transaction item THEN the system SHALL show appropriate hover effects
4. WHEN the detail section is visible THEN the system SHALL use consistent styling with the rest of the page

### Requirement 4

**User Story:** 作为用户，我想要在移动设备上也能良好地使用展开详情功能。

#### Acceptance Criteria

1. WHEN viewing on mobile devices THEN the system SHALL display the expanded detail in a single column layout
2. WHEN viewing on tablet devices THEN the system SHALL adapt the detail layout appropriately
3. WHEN viewing on desktop THEN the system SHALL display the detail in a multi-column layout for better space utilization
4. WHEN the screen size changes THEN the system SHALL maintain the expanded/collapsed state

### Requirement 5

**User Story:** 作为用户，我想要移除侧滑面板，因为新的展开方式更直观。

#### Acceptance Criteria

1. WHEN the new accordion detail is implemented THEN the system SHALL remove the fixed side panel component
2. WHEN the new accordion detail is implemented THEN the system SHALL remove all related side panel CSS and JavaScript code
3. WHEN the new accordion detail is implemented THEN the system SHALL ensure no visual artifacts remain from the old side panel
4. WHEN the page loads THEN the system SHALL not show any side panel elements
