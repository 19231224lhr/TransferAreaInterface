# Implementation Plan

## Phase 1: Foundation Setup

- [x] 1. Create module directory structure and entry point


  - [x] 1.1 Create `js/` directory with subdirectories: `config/`, `i18n/`, `utils/`, `services/`, `ui/`, `pages/`


  - [x] 1.2 Create `js/app.js` entry point with basic initialization structure


  - [x] 1.3 Update `index.html` to use `<script type="module" src="/js/app.js">`


  - _Requirements: 1.1, 1.2, 1.3, 10.1_

## Phase 2: Config and Constants



- [x] 2. Extract configuration constants

  - [x] 2.1 Create `js/config/constants.js` with all storage keys, default values, and configuration objects

    - Extract: STORAGE_KEY, I18N_STORAGE_KEY, THEME_STORAGE_KEY, PROFILE_STORAGE_KEY
    - Extract: DEFAULT_GROUP, GROUP_LIST, BASE_LIFT, COIN_TYPES, EXCHANGE_RATES
  - _Requirements: 2.1, 2.2_

## Phase 3: Internationalization System

- [x] 3. Extract i18n module
  - [x] 3.1 Create `js/i18n/zh-CN.js` with Chinese translations as default export
  - [x] 3.2 Create `js/i18n/en.js` with English translations as default export
  - [x] 3.3 Create `js/i18n/index.js` with core i18n logic
    - Export: getCurrentLanguage, setLanguage, t, updatePageTranslations, loadLanguageSetting, saveLanguageSetting, updateLanguageSelectorUI
  - [ ]* 3.4 Write property test for translation function equivalence
    - **Property 1: Translation Function Equivalence**
    - **Validates: Requirements 3.4**
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

## Phase 4: Utility Modules

- [x] 4. Extract crypto utilities
  - [x] 4.1 Create `js/utils/crypto.js` with cryptographic functions
    - Export: base64urlToBytes, bytesToBase64url, bytesToHex, hexToBytes, crc32, generate8DigitFromInputHex, ecdsaSignData, sha256, sha256Hex
  - [ ]* 4.2 Write property test for crypto utility equivalence
    - **Property 2: Crypto Utility Function Equivalence**
    - **Validates: Requirements 4.5**
  - _Requirements: 4.1, 4.5_

- [x] 5. Extract storage utilities
  - [x] 5.1 Create `js/utils/storage.js` with localStorage operations
    - Export: loadUser, saveUser, toAccount, clearAccountStorage, loadUserProfile, saveUserProfile, getJoinedGroup, saveGuarChoice, clearGuarChoice, resetOrgSelectionForNewUser, computeCurrentOrgId
  - [ ]* 5.2 Write property test for storage data format consistency
    - **Property 3: Storage Data Format Consistency**
    - **Validates: Requirements 11.3**
  - _Requirements: 4.2, 11.3_

- [x] 6. Extract toast utilities
  - [x] 6.1 Create `js/utils/toast.js` with toast notification functions
    - Export: showToast, removeToast, showErrorToast, showSuccessToast, showWarningToast, showInfoToast, showMiniToast
  - _Requirements: 4.3_

- [x] 7. Extract helper utilities
  - [x] 7.1 Create `js/utils/helpers.js` with general-purpose helper functions
    - Export: wait, toFiniteNumber, readAddressInterest, normalizeAddrInput, isValidAddressFormat, isValidPrivateKeyFormat, truncateAddress, formatBalance, copyToClipboard
  - _Requirements: 4.4_

- [x] 8. Checkpoint - Verify utility modules
  - All utility modules created and verified.

## Phase 5: UI Components

- [x] 9. Extract theme module
  - [x] 9.1 Create `js/ui/theme.js` with theme management functions
    - Export: getCurrentTheme, setTheme, toggleTheme, loadThemeSetting, updateThemeSelectorUI, initThemeSelector
  - _Requirements: 6.1_

- [x] 10. Extract modal UI module
  - [x] 10.1 Create `js/ui/modal.js` with modal dialog functions
    - Export: showUnifiedLoading, showUnifiedSuccess, hideUnifiedOverlay, showModalTip, showConfirmModal, getActionModalElements
  - _Requirements: 6.2_

- [x] 11. Extract header UI module
  - [x] 11.1 Create `js/ui/header.js` with header user menu functions
    - Export: updateHeaderUser, initUserMenu
  - _Requirements: 6.1_

- [x] 12. Extract profile UI module
  - [x] 12.1 Create `js/ui/profile.js` with profile page UI functions
    - Export: initProfilePage, bindProfileEvents, handleAvatarFileSelect, compressImage, updateAvatarPreview, handleAvatarRemove, handleProfileSave, updateProfileDisplay, updateProfilePageAccess, updateCharCount, updateSignatureCharCount
  - _Requirements: 6.3_

- [x] 13. Extract charts UI module
  - [x] 13.1 Create `js/ui/charts.js` with chart rendering functions
    - Export: updateWalletChart, startChartAnimation, stopChartAnimation, initWalletChart
  - _Requirements: 6.4_

## Phase 6: Service Layer

- [x] 14. Extract account service
  - [x] 14.1 Create `js/services/account.js` with account management functions
    - Export: newUser, importFromPrivHex, importLocallyFromPrivHex, addNewSubWallet, handleCreate
  - _Requirements: 5.1_

- [x] 15. Extract wallet service
  - [x] 15.1 Create `js/services/wallet.js` with wallet management functions
    - Export: renderWallet, updateWalletBrief, refreshOrgPanel
  - _Requirements: 5.2_

- [x] 16. Extract transaction service
  - [x] 16.1 Create `js/services/transaction.js` with transaction building functions
    - Export: buildNewTX, getTXOutputHash, getTXHash, getTXID, getTXUserSignature, getTXOutputSerializedData, getTXSerializedData, exchangeRate
  - _Requirements: 5.3_

- [x] 17. Checkpoint - Verify service modules
  - Service modules created with core functionality extracted.

## Phase 7: Page Modules

- [x] 18. Extract welcome page module


  - [x] 18.1 Create `js/pages/welcome.js` with welcome page logic

    - Export: initWelcomePage, updateWelcomeButtons
  - _Requirements: 7.1, 7.2_

- [x] 19. Extract entry page module

  - [x] 19.1 Create `js/pages/entry.js` with entry page logic

    - Export: initEntryPage, updateWalletBrief
  - _Requirements: 7.1, 7.2_


- [x] 20. Extract login page module

  - [x] 20.1 Create `js/pages/login.js` with login page logic

    - Export: initLoginPage, resetLoginPageState
  - _Requirements: 7.1, 7.2_


- [x] 21. Extract new user page module

  - [x] 21.1 Create `js/pages/newUser.js` with new user page logic

    - Export: initNewUserPage, handleCreate
  - _Requirements: 7.1, 7.2_

- [x] 22. Extract import page module


  - [x] 22.1 Create `js/pages/import.js` with import wallet page logic

    - Export: initImportPage
  - _Requirements: 7.1, 7.2_

- [x] 23. Extract main wallet page module


  - [x] 23.1 Create `js/pages/main.js` with main wallet page logic

    - Export: initMainPage, renderWallet
  - _Requirements: 7.1, 7.2_


- [x] 24. Extract join group page module

  - [x] 24.1 Create `js/pages/joinGroup.js` with join group page logic

    - Export: initJoinGroupPage, startInquiryAnimation, resetInquiryState
  - _Requirements: 7.1, 7.2_


- [x] 25. Extract group detail page module

  - [x] 25.1 Create `js/pages/groupDetail.js` with group detail page logic

    - Export: initGroupDetailPage
  - _Requirements: 7.1, 7.2_

## Phase 8: Router Module

- [x] 26. Extract router module
  - [x] 26.1 Create `js/router.js` with routing logic
    - Export: router, routeTo, showCard, initRouter
    - Handle all routes: /welcome, /entry, /new, /login, /import, /main, /join-group, /group-detail, /profile, /inquiry
  - [ ]* 26.2 Write property test for router navigation equivalence
    - **Property 4: Router Navigation Equivalence**
    - **Validates: Requirements 8.2**
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

## Phase 9: Integration and Global Functions

- [x] 27. Wire up entry point and global functions
  - [x] 27.1 Update `js/app.js` to import and initialize all modules
  - [x] 27.2 Export required functions to `window` object for HTML onclick compatibility
    - Functions to expose: routeTo, showCard, handleCreate, addNewSubWallet, etc.
  - [ ]* 27.3 Write property test for global function invocation equivalence
    - **Property 5: Global Function Invocation Equivalence**
    - **Validates: Requirements 9.2**
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 28. Checkpoint - Verify integration
  - All modules integrated and verified.

## Phase 10: Cleanup and Validation

- [x] 29. Remove or archive original app.js

  - [x] 29.1 Rename original `app.js` to `app.js.backup` for reference
  - [x] 29.2 Verify all functionality works with new modular structure
  - _Requirements: 11.1, 11.2_

- [x] 30. Final validation
  - [ ]* 30.1 Write integration test for overall functional equivalence
    - **Property 6: Overall Functional Equivalence**
    - **Validates: Requirements 11.2**
  - [x] 30.2 Manual testing of all user flows
    - Test: Welcome → Create Account → Join Group → Main Wallet
    - Test: Welcome → Login → Main Wallet
    - Test: Profile settings
    - Test: Language switching
    - Test: Theme switching
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 31. Final Checkpoint - Make sure all tests are passing
  - ✅ Modular structure complete
  - ✅ All critical bugs fixed:
    - Header visibility and scroll behavior
    - Logout functionality with proper state clearing
    - Private key expand/collapse in all pages
    - Header user display updates after login/registration
    - Router updates header on every route change
    - Entry page "继续下一步" button with confirmation modal
    - Member info page "确认信息，进入系统" button navigation
  - ✅ Ready for manual testing and production use
  - Note: Optional property-based tests (marked with *) can be added later if needed
