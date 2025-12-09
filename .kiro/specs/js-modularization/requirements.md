# Requirements Document

## Introduction

This document defines the requirements for modularizing the monolithic `app.js` file (8591 lines) into a well-structured ES6 module system. The goal is to improve code maintainability, enable better team collaboration, and enhance development efficiency while preserving all existing functionality. This is a pure refactoring effort - no functional changes will be made.

## Glossary

- **ES6 Modules**: JavaScript module system using `import`/`export` syntax
- **SPA**: Single Page Application - the current architecture using hash-based routing
- **i18n**: Internationalization system for multi-language support
- **WebCrypto API**: Browser API for cryptographic operations
- **UTXO**: Unspent Transaction Output - the wallet's transaction model
- **Module**: A self-contained JavaScript file with explicit imports and exports

## Requirements

### Requirement 1: Module Directory Structure

**User Story:** As a developer, I want a clear and organized directory structure for JavaScript modules, so that I can easily locate and maintain code.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the system SHALL have a `js/` directory containing all JavaScript modules organized by function
2. WHEN organizing modules THEN the system SHALL follow the structure: `js/config/`, `js/i18n/`, `js/utils/`, `js/services/`, `js/ui/`, `js/pages/`
3. WHEN creating the entry point THEN the system SHALL have a main `js/app.js` file that initializes all modules

### Requirement 2: Configuration and Constants Module

**User Story:** As a developer, I want all configuration constants centralized in one place, so that I can easily modify application settings.

#### Acceptance Criteria

1. WHEN extracting constants THEN the system SHALL create `js/config/constants.js` containing all storage keys, default values, and configuration objects
2. WHEN other modules need constants THEN the system SHALL import them from the constants module using ES6 import syntax
3. WHEN constants are modified THEN the system SHALL require changes only in the constants module

### Requirement 3: Internationalization (i18n) Module System

**User Story:** As a developer, I want the i18n system separated into dedicated modules, so that translations can be managed independently.

#### Acceptance Criteria

1. WHEN extracting i18n THEN the system SHALL create `js/i18n/zh-CN.js` containing all Chinese translations as a default export object
2. WHEN extracting i18n THEN the system SHALL create `js/i18n/en.js` containing all English translations as a default export object
3. WHEN extracting i18n THEN the system SHALL create `js/i18n/index.js` containing the core i18n logic including `t()`, `setLanguage()`, `getCurrentLanguage()`, and `updatePageTranslations()` functions
4. WHEN the i18n module is used THEN the system SHALL maintain identical translation behavior to the original implementation

### Requirement 4: Utility Modules

**User Story:** As a developer, I want utility functions organized by purpose, so that I can reuse them across the application.

#### Acceptance Criteria

1. WHEN extracting crypto utilities THEN the system SHALL create `js/utils/crypto.js` containing Base64, Hex conversion, CRC32, ECDSA signing, and SHA-256 functions
2. WHEN extracting storage utilities THEN the system SHALL create `js/utils/storage.js` containing localStorage operations for accounts, profiles, and organization data
3. WHEN extracting toast utilities THEN the system SHALL create `js/utils/toast.js` containing all toast notification functions
4. WHEN extracting helper utilities THEN the system SHALL create `js/utils/helpers.js` containing general-purpose helper functions
5. WHEN utility functions are called THEN the system SHALL produce identical results to the original implementation

### Requirement 5: Service Layer Modules

**User Story:** As a developer, I want business logic separated into service modules, so that I can maintain and test them independently.

#### Acceptance Criteria

1. WHEN extracting account services THEN the system SHALL create `js/services/account.js` containing key generation, account import, and address generation functions
2. WHEN extracting wallet services THEN the system SHALL create `js/services/wallet.js` containing balance calculation, address management, and wallet display functions
3. WHEN extracting transaction services THEN the system SHALL create `js/services/transaction.js` containing transaction building, validation, and UTXO selection functions
4. WHEN service functions are called THEN the system SHALL produce identical results to the original implementation

### Requirement 6: UI Component Modules

**User Story:** As a developer, I want UI components separated into dedicated modules, so that I can modify UI behavior without affecting other parts.

#### Acceptance Criteria

1. WHEN extracting header UI THEN the system SHALL create `js/ui/header.js` containing user menu, address popup, and balance display functions
2. WHEN extracting modal UI THEN the system SHALL create `js/ui/modal.js` containing all modal dialog functions including loading, success, confirm, and detail modals
3. WHEN extracting profile UI THEN the system SHALL create `js/ui/profile.js` containing profile page initialization, avatar handling, and settings functions
4. WHEN extracting chart UI THEN the system SHALL create `js/ui/charts.js` containing balance chart, network chart, and wallet structure visualization functions
5. WHEN UI components are rendered THEN the system SHALL display identically to the original implementation

### Requirement 7: Page Modules

**User Story:** As a developer, I want each page's logic in its own module, so that I can work on pages independently.

#### Acceptance Criteria

1. WHEN extracting page modules THEN the system SHALL create separate files for: `welcome.js`, `entry.js`, `login.js`, `newUser.js`, `import.js`, `main.js`, `joinGroup.js`, `groupDetail.js` in `js/pages/`
2. WHEN a page module is loaded THEN the system SHALL export an initialization function that sets up the page
3. WHEN page modules handle events THEN the system SHALL bind events programmatically instead of using inline onclick attributes
4. WHEN pages are displayed THEN the system SHALL render identically to the original implementation

### Requirement 8: Router Module

**User Story:** As a developer, I want the routing logic in a dedicated module, so that I can manage navigation separately.

#### Acceptance Criteria

1. WHEN extracting router THEN the system SHALL create `js/router.js` containing hash-based routing logic
2. WHEN the router handles navigation THEN the system SHALL call appropriate page initialization functions
3. WHEN routes change THEN the system SHALL update page translations via the i18n module
4. WHEN the router is initialized THEN the system SHALL support all existing routes: `/welcome`, `/entry`, `/new`, `/login`, `/import`, `/main`, `/join-group`, `/group-detail`, `/profile`, `/inquiry`

### Requirement 9: Global Function Compatibility

**User Story:** As a developer, I want existing inline event handlers to continue working, so that the refactoring doesn't break the HTML.

#### Acceptance Criteria

1. WHEN functions are called from HTML onclick attributes THEN the system SHALL expose those functions on the `window` object
2. WHEN global functions are invoked THEN the system SHALL execute the correct module function
3. IF a global function reference is missing THEN the system SHALL log a clear error message

### Requirement 10: ES6 Module Loading

**User Story:** As a developer, I want the application to use native ES6 modules, so that I can leverage modern JavaScript features.

#### Acceptance Criteria

1. WHEN loading the application THEN the system SHALL use `<script type="module">` in index.html
2. WHEN modules import dependencies THEN the system SHALL use ES6 `import`/`export` syntax
3. WHEN the application initializes THEN the system SHALL load modules in the correct dependency order
4. IF a module fails to load THEN the system SHALL display an appropriate error message

### Requirement 11: Functional Equivalence

**User Story:** As a user, I want the application to work exactly as before after the refactoring, so that my workflow is not disrupted.

#### Acceptance Criteria

1. WHEN the refactored application loads THEN the system SHALL display the same initial page as before
2. WHEN users perform any action THEN the system SHALL produce identical results to the original implementation
3. WHEN data is stored or retrieved THEN the system SHALL use the same localStorage keys and formats
4. WHEN errors occur THEN the system SHALL display the same error messages and behaviors
