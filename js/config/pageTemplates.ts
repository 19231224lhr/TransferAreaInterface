/**
 * Page Templates Configuration
 * 
 * Centralized configuration for all pages in the application.
 * This file defines the template paths and container IDs for each page.
 * 
 * All pages are now dynamically loaded from template files.
 */

export interface PageTemplateConfig {
    /** Unique identifier for the page (matches route path without leading /) */
    id: string;
    /** DOM element ID for this page's container */
    containerId: string;
    /** Template file path (relative to /templates/ - Vite serves assets/ as root) */
    templatePath: string;
    /** Whether this page should be loaded dynamically */
    isDynamic: boolean;
    /** Whether to preload this template */
    preload?: boolean;
    /** Human-readable page name for debugging */
    displayName: string;
}

/**
 * All page template configurations
 * All pages are dynamically loaded from /templates/pages/
 * (Source files are in assets/templates/pages/, served at /templates/pages/ by Vite)
 */
export const PAGE_TEMPLATES: PageTemplateConfig[] = [
    {
        id: 'welcome',
        containerId: 'welcomeCard',
        displayName: 'Welcome Page',
        isDynamic: true,
        templatePath: 'pages/welcome.html',
        preload: true
    },
    {
        id: 'entry',
        containerId: 'entryCard',
        displayName: 'Wallet Management Entry',
        isDynamic: true,
        templatePath: 'pages/entry.html',
        preload: true
    },
    {
        id: 'new',
        containerId: 'newUserCard',
        displayName: 'Create New Account',
        isDynamic: true,
        templatePath: 'pages/new-user.html',
    },
    {
        id: 'set-password',
        containerId: 'setPasswordCard',
        displayName: 'Set Password',
        isDynamic: true,
        templatePath: 'pages/set-password.html',
    },
    {
        id: 'login',
        containerId: 'loginCard',
        displayName: 'Login Page',
        isDynamic: true,
        templatePath: 'pages/login.html',
        preload: true
    },
    {
        id: 'import',
        containerId: 'importCard',
        displayName: 'Import Wallet',
        isDynamic: true,
        templatePath: 'pages/import.html',
    },
    {
        id: 'wallet-import',
        containerId: 'importCard', // Shares container with import
        displayName: 'Wallet Import (sub-address)',
        isDynamic: false, // Uses same template as import
        templatePath: 'pages/import.html',
    },
    {
        id: 'main',
        containerId: 'walletCard',
        displayName: 'Main Wallet Page',
        isDynamic: true,
        templatePath: 'pages/wallet.html',
    },
    {
        id: 'join-group',
        containerId: 'nextCard',
        displayName: 'Join Guarantor Organization',
        isDynamic: true,
        templatePath: 'pages/join-group.html',
    },
    {
        id: 'inquiry',
        containerId: 'inquiryCard',
        displayName: 'Network Inquiry',
        isDynamic: true,
        templatePath: 'pages/inquiry.html',
    },
    {
        id: 'inquiry-main',
        containerId: 'inquiryCard', // Shares container with inquiry
        displayName: 'Network Inquiry (from main)',
        isDynamic: false, // Uses same template as inquiry
        templatePath: 'pages/inquiry.html',
    },
    {
        id: 'group-detail',
        containerId: 'groupDetailCard',
        displayName: 'Guarantor Organization Detail',
        isDynamic: true,
        templatePath: 'pages/group-detail.html',
    },
    {
        id: 'profile',
        containerId: 'profileCard',
        displayName: 'User Profile',
        isDynamic: true,
        templatePath: 'pages/profile.html',
    },
    {
        id: 'history',
        containerId: 'historyCard',
        displayName: 'Transaction History',
        isDynamic: true,
        templatePath: 'pages/history.html',
    },
    {
        id: 'docs',
        containerId: 'docsCard',
        displayName: 'User Documentation',
        isDynamic: true,
        templatePath: 'pages/docs.html',
    }
];

/**
 * Get page config by ID
 */
export function getPageConfig(pageId: string): PageTemplateConfig | undefined {
    // Normalize page ID (remove leading /)
    const normalizedId = pageId.replace(/^\//, '');
    return PAGE_TEMPLATES.find(p => p.id === normalizedId);
}

/**
 * Get page config by container ID
 */
export function getPageConfigByContainerId(containerId: string): PageTemplateConfig | undefined {
    return PAGE_TEMPLATES.find(p => p.containerId === containerId);
}

/**
 * Get all container IDs for showCard function
 */
export function getAllContainerIds(): string[] {
    // Use Set to avoid duplicates (some pages share containers)
    const ids = new Set<string>();
    PAGE_TEMPLATES.forEach(p => ids.add(p.containerId));
    return Array.from(ids);
}

/**
 * Get pages that should be preloaded
 */
export function getPreloadPages(): PageTemplateConfig[] {
    return PAGE_TEMPLATES.filter(p => p.isDynamic && p.preload);
}

/**
 * Get dynamic pages
 */
export function getDynamicPages(): PageTemplateConfig[] {
    return PAGE_TEMPLATES.filter(p => p.isDynamic);
}

/**
 * Get all unique template paths that need to be loaded
 */
export function getUniqueTemplatePaths(): string[] {
    const paths = new Set<string>();
    PAGE_TEMPLATES.forEach(p => {
        if (p.isDynamic && p.templatePath) {
            paths.add(p.templatePath);
        }
    });
    return Array.from(paths);
}
