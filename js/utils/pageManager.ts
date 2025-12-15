/**
 * Page Container Manager Module
 * 
 * Manages dynamic loading and display of page templates.
 * Works with the template loader to handle page lifecycle.
 */

import { templateLoader } from './templateLoader';

/**
 * Page configuration interface
 */
interface PageConfig {
    /** Template file path (relative to templates directory) */
    templatePath: string;
    /** Container element ID in the DOM */
    containerId: string;
    /** Whether to preload this page template */
    preload?: boolean;
    /** Callback when page is loaded for the first time */
    onLoad?: (container: HTMLElement) => void;
    /** Callback when page is shown */
    onShow?: (container: HTMLElement) => void;
    /** Callback when page is hidden */
    onHide?: (container: HTMLElement) => void;
}

/**
 * Registry of all page configurations
 */
interface PageRegistry {
    [pageId: string]: PageConfig;
}

/**
 * Page loading state
 */
type PageLoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface PageState {
    loadState: PageLoadState;
    element: HTMLElement | null;
    error?: Error;
}

/**
 * Page Container Manager Class
 * Handles the lifecycle of dynamically loaded page templates
 */
class PageContainerManager {
    private registry: PageRegistry = {};
    private pageStates: Map<string, PageState> = new Map();
    private mainContainer: HTMLElement | null = null;
    private initialized: boolean = false;
    private loadingPromises: Map<string, Promise<HTMLElement | null>> = new Map();

    /**
     * Initialize the page manager with the main container
     * @param mainContainerSelector - CSS selector or element ID for the main container
     */
    init(mainContainerSelector: string = '#main'): void {
        if (this.initialized) {
            return;
        }

        // Find main container
        this.mainContainer = mainContainerSelector.startsWith('#')
            ? document.getElementById(mainContainerSelector.slice(1))
            : document.querySelector(mainContainerSelector);

        if (!this.mainContainer) {
            console.error(`[PageManager] Main container not found: ${mainContainerSelector}`);
            return;
        }

        this.initialized = true;
    }

    /**
     * Register a page configuration
     * @param pageId - Unique identifier for the page
     * @param config - Page configuration
     */
    register(pageId: string, config: PageConfig): void {
        this.registry[pageId] = config;
        this.pageStates.set(pageId, {
            loadState: 'idle',
            element: null
        });
    }

    /**
     * Register multiple pages at once
     * @param pages - Object mapping page IDs to configurations
     */
    registerAll(pages: PageRegistry): void {
        Object.keys(pages).forEach(pageId => {
            this.register(pageId, pages[pageId]);
        });
    }

    /**
     * Get page configuration
     */
    getConfig(pageId: string): PageConfig | undefined {
        return this.registry[pageId];
    }

    /**
     * Get page state
     */
    getState(pageId: string): PageState | undefined {
        return this.pageStates.get(pageId);
    }

    /**
     * Check if a page exists in DOM (either from index.html or dynamically loaded)
     */
    private getExistingElement(pageId: string): HTMLElement | null {
        const config = this.registry[pageId];
        if (!config) return null;
        return document.getElementById(config.containerId);
    }

    /**
     * Check if a page is loaded (either statically or dynamically)
     */
    isLoaded(pageId: string): boolean {
        const state = this.pageStates.get(pageId);

        // Check if dynamically loaded
        if (state?.loadState === 'loaded') {
            return true;
        }

        // Check if exists in DOM
        const existing = this.getExistingElement(pageId);
        return existing !== null;
    }

    /**
     * Ensure a page is loaded (load if necessary)
     * @param pageId - Page identifier
     * @returns The page container element
     */
    async ensureLoaded(pageId: string): Promise<HTMLElement | null> {
        const config = this.registry[pageId];
        if (!config) {
            console.error(`[PageManager] Page not registered: ${pageId}`);
            return null;
        }

        const state = this.pageStates.get(pageId)!;

        // Check if already in DOM
        let element = this.getExistingElement(pageId);
        if (element) {
            // Update state
            if (state.loadState !== 'loaded') {
                state.loadState = 'loaded';
                state.element = element;
            }
            return element;
        }

        // Check if already loading
        const existingPromise = this.loadingPromises.get(pageId);
        if (existingPromise) {
            return existingPromise;
        }

        // If template path is empty, can't load
        if (!config.templatePath) {
            console.error(`[PageManager] No template path for: ${pageId}`);
            return null;
        }

        // Start loading
        state.loadState = 'loading';

        const loadPromise = this.loadTemplate(pageId, config);
        this.loadingPromises.set(pageId, loadPromise);

        try {
            element = await loadPromise;
            return element;
        } finally {
            this.loadingPromises.delete(pageId);
        }
    }

    /**
     * Load a template and insert into DOM
     */
    private async loadTemplate(pageId: string, config: PageConfig): Promise<HTMLElement | null> {
        const state = this.pageStates.get(pageId)!;

        try {
            if (!this.mainContainer) {
                throw new Error('Main container not initialized');
            }

            // Load template content
            const content = await templateLoader.load(config.templatePath);

            // Create temp container to parse HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content.trim();

            // Find the section element
            const templateEl = tempDiv.querySelector(`#${config.containerId}`) as HTMLElement;

            if (!templateEl) {
                // If container ID not found, use first element
                const firstEl = tempDiv.firstElementChild as HTMLElement;
                if (firstEl) {
                    this.mainContainer.appendChild(firstEl);
                    state.loadState = 'loaded';
                    state.element = firstEl;

                    // Update translations
                    templateLoader.updateTranslations(firstEl);

                    // Call onLoad callback
                    if (config.onLoad) {
                        try {
                            config.onLoad(firstEl);
                        } catch (err) {
                            console.error(`[PageManager] onLoad error for ${pageId}:`, err);
                        }
                    }

                    return firstEl;
                }
                throw new Error(`Template element not found for: ${pageId}`);
            }

            // Append to main container
            this.mainContainer.appendChild(templateEl);

            state.loadState = 'loaded';
            state.element = templateEl;

            // Update translations
            templateLoader.updateTranslations(templateEl);

            // Call onLoad callback
            if (config.onLoad) {
                try {
                    config.onLoad(templateEl);
                } catch (err) {
                    console.error(`[PageManager] onLoad error for ${pageId}:`, err);
                }
            }

            return templateEl;
        } catch (error) {
            state.loadState = 'error';
            state.error = error as Error;
            console.error(`[PageManager] Failed to load page ${pageId}:`, error);
            return null;
        }
    }

    /**
     * Show a page (hide all others first)
     * @param pageId - Page identifier to show
     */
    async showPage(pageId: string): Promise<HTMLElement | null> {
        // Hide all pages first
        this.hideAllPages();

        // Ensure page is loaded
        const element = await this.ensureLoaded(pageId);
        if (!element) {
            console.error(`[PageManager] Cannot show page ${pageId}: not loaded`);
            return null;
        }

        // Show the page
        element.classList.remove('hidden');

        // Call onShow callback
        const config = this.registry[pageId];
        if (config?.onShow) {
            try {
                config.onShow(element);
            } catch (err) {
                console.error(`[PageManager] onShow error for ${pageId}:`, err);
            }
        }

        return element;
    }

    /**
     * Hide a specific page
     * @param pageId - Page identifier to hide
     */
    hidePage(pageId: string): void {
        const element = this.getExistingElement(pageId);
        if (!element) return;

        element.classList.add('hidden');

        // Call onHide callback
        const config = this.registry[pageId];
        if (config?.onHide) {
            try {
                config.onHide(element);
            } catch (err) {
                console.error(`[PageManager] onHide error for ${pageId}:`, err);
            }
        }
    }

    /**
     * Hide all registered pages
     */
    hideAllPages(): void {
        Object.keys(this.registry).forEach(pageId => {
            this.hidePage(pageId);
        });
    }

    /**
     * Preload specified pages into cache
     * @param pageIds - Array of page IDs to preload
     */
    async preloadPages(pageIds: string[]): Promise<void> {
        const templatePaths = pageIds
            .map(id => this.registry[id]?.templatePath)
            .filter((path): path is string => !!path);

        await templateLoader.preload(templatePaths);
    }

    /**
     * Get all registered page IDs
     */
    getRegisteredPages(): string[] {
        return Object.keys(this.registry);
    }

    /**
     * Check if manager is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Get main container element
     */
    getMainContainer(): HTMLElement | null {
        return this.mainContainer;
    }
}

// Create singleton instance
export const pageManager = new PageContainerManager();

// Export class for custom instances
export default PageContainerManager;
