# Implementation Plan

## Phase 1: Delete Legacy Root Files

- [x] 1. Delete legacy root-level files

  - [x] 1.1 Delete `app.js` from root directory


    - Verify file is not loaded in index.html (should be commented out)
    - Delete the file (~8600 lines)
    - _Requirements: 1.1_

  - [x] 1.2 Delete `app.js.backup` from root directory

    - Delete the backup file (~8600 lines)
    - _Requirements: 1.2_

  - [x] 1.3 Delete `style.css` from root directory

    - Verify file is not loaded in index.html
    - Delete the file (~10600 lines)
    - _Requirements: 1.3_

  - [x] 1.4 Delete `fix_css_indent.py` from root directory

    - Delete the one-time use Python script
    - _Requirements: 1.4_

## Phase 2: Remove Unused HTML Sections

- [x] 2. Remove unused HTML page sections from index.html

  - [x] 2.1 Remove `#importNextCard` section


    - Locate section around line 2309
    - Remove the entire `<section class="card hidden" id="importNextCard">` block
    - _Requirements: 2.1_
  - [x] 2.2 Remove `#memberInfoCard` section


    - Locate section around line 1727
    - Remove the entire `<section class="card hidden" id="memberInfoCard">` block
    - _Requirements: 2.2_

## Phase 3: Clean Up Router References

- [x] 3. Clean up router.js references

  - [x] 3.1 Remove invalid card IDs from allCardIds array


    - Remove `'finalCard'` (does not exist in HTML)
    - Remove `'importNextCard'` (being deleted)
    - Remove `'memberInfoCard'` (being deleted)
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 3.2 Remove `/member-info` route case and handler


    - Remove `case '/member-info':` block
    - Remove `handleMemberInfoRoute()` function
    - _Requirements: 2.3, 3.3_

## Phase 4: Clean Up Constants

- [x] 4. Clean up constants.js references

  - [x] 4.1 Remove unused route constants


    - Remove `MEMBER_INFO: '/member-info'` from ROUTES
    - Remove `IMPORT_NEXT: '/import-next'` from ROUTES
    - _Requirements: 4.1_
  - [x] 4.2 Remove unused route-card mappings


    - Remove `'/member-info': 'memberInfoCard'` from ROUTE_CARD_MAP
    - Remove `'/import-next': 'importNextCard'` from ROUTE_CARD_MAP
    - _Requirements: 4.2_

## Phase 5: Verification

- [x] 5. Verify application functionality


  - [x] 5.1 Start development server and test all pages


    - Run `go run ./backend/cmd/webserver/main.go`
    - Visit all main routes and verify they work correctly
    - Check browser console for JavaScript errors
    - _Requirements: 5.1, 5.2_

  - [x] 5.2 Generate cleanup summary report

    - List all deleted files with line counts
    - List all removed HTML sections
    - Calculate total lines of code removed
    - _Requirements: 5.3_
