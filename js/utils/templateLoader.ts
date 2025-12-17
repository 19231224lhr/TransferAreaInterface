/**
 * Template Loader Module
 * 
 * Responsible for dynamically loading and caching HTML template files.
 * This module provides a clean API for loading page templates on demand,
 * reducing initial page load size.
 */

interface TemplateCache {
    [path: string]: string;
}

interface LoadingPromises {
    [path: string]: Promise<string> | null;
}

interface TemplateLoaderOptions {
    basePath?: string;
    cacheEnabled?: boolean;
}

/**
 * Template Loader Class
 * Manages loading, caching, and inserting HTML templates
 */
class TemplateLoader {
    private cache: TemplateCache = {};
    private loadingPromises: LoadingPromises = {};
    private basePath: string;
    private cacheEnabled: boolean;
    private initialized: boolean = false;

    constructor(options: TemplateLoaderOptions = {}) {
        // Note: assets/ is Vite's publicDir, so /assets/templates/ becomes /templates/ at runtime
        this.basePath = options.basePath ?? '/templates';
        this.cacheEnabled = options.cacheEnabled ?? true;
    }

    /**
     * Initialize the template loader
     * Should be called once on app startup
     */
    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        console.log('[TemplateLoader] Initialized with basePath:', this.basePath);
    }

    /**
     * Get the full path for a template
     */
    private getFullPath(templatePath: string): string {
        // If already absolute path, use as is
        if (templatePath.startsWith('/')) {
            return templatePath;
        }
        // Otherwise prepend basePath
        return `${this.basePath}/${templatePath}`;
    }

    /**
     * Load a template file
     * @param templatePath - Path to the template file (relative to basePath or absolute)
     * @returns Promise resolving to the template HTML content
     */
    async load(templatePath: string): Promise<string> {
        const fullPath = this.getFullPath(templatePath);

        // Check cache first
        if (this.cacheEnabled && this.cache[fullPath]) {
            return this.cache[fullPath];
        }

        // Check if already loading
        if (this.loadingPromises[fullPath]) {
            return this.loadingPromises[fullPath]!;
        }

        // Start loading
        this.loadingPromises[fullPath] = this.fetchTemplate(fullPath);

        try {
            const content = await this.loadingPromises[fullPath]!;
            if (this.cacheEnabled) {
                this.cache[fullPath] = content;
            }
            return content;
        } finally {
            this.loadingPromises[fullPath] = null;
        }
    }

    /**
     * Fetch template from server
     */
    private async fetchTemplate(path: string): Promise<string> {
        try {
            const response = await fetch(path, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html',
                    'Cache-Control': 'no-cache'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`Failed to load template: ${path} (HTTP ${response.status})`);
            }

            const content = await response.text();
            return content;
        } catch (error) {
            console.error(`[TemplateLoader] Error loading template: ${path}`, error);
            throw error;
        }
    }

    /**
     * Load template and insert into a container element
     * @param templatePath - Path to the template file
     * @param container - Target container element or selector
     * @param options - Insert options
     */
    async loadInto(
        templatePath: string,
        container: HTMLElement | string,
        options: { replace?: boolean; prepend?: boolean } = {}
    ): Promise<HTMLElement | null> {
        const containerEl = typeof container === 'string'
            ? document.querySelector<HTMLElement>(container)
            : container;

        if (!containerEl) {
            console.error(`[TemplateLoader] Container not found:`, container);
            return null;
        }

        try {
            const content = await this.load(templatePath);

            // Parse HTML without using innerHTML
            const doc = new DOMParser().parseFromString(content, 'text/html');

            if (options.replace) {
                const nodes = Array.from(doc.body.childNodes);
                containerEl.replaceChildren(...nodes);
                return containerEl.firstElementChild as HTMLElement;
            }

            const templateEl = doc.body.firstElementChild as HTMLElement | null;
            if (!templateEl) {
                console.error(`[TemplateLoader] Template is empty:`, templatePath);
                return null;
            }

            if (options.prepend) {
                containerEl.insertBefore(templateEl, containerEl.firstChild);
                return templateEl;
            }

            containerEl.appendChild(templateEl);
            return templateEl;
        } catch (error) {
            console.error(`[TemplateLoader] Failed to load template into container:`, error);
            return null;
        }
    }

    /**
     * Load template and append to a container, returning the appended element
     * @param templatePath - Path to the template file
     * @param container - Target container element
     */
    async appendTo(templatePath: string, container: HTMLElement): Promise<HTMLElement | null> {
        return this.loadInto(templatePath, container, { replace: false, prepend: false });
    }

    /**
     * Preload multiple templates into cache
     * @param templatePaths - Array of template paths to preload
     */
    async preload(templatePaths: string[]): Promise<void> {
        await Promise.all(
            templatePaths.map(path =>
                this.load(path).catch(err => {
                    console.warn(`[TemplateLoader] Failed to preload:`, path, err);
                })
            )
        );
    }

    /**
     * Check if a template is cached
     */
    isCached(templatePath: string): boolean {
        const fullPath = this.getFullPath(templatePath);
        return !!this.cache[fullPath];
    }

    /**
     * Clear the template cache
     */
    clearCache(): void {
        this.cache = {};
    }

    /**
     * Remove a specific template from cache
     */
    invalidate(templatePath: string): void {
        const fullPath = this.getFullPath(templatePath);
        delete this.cache[fullPath];
    }

    /**
     * Update i18n translations for a container
     * This is called after inserting template content
     */
    updateTranslations(container?: HTMLElement): void {
        // Call global i18n update function if available
        if (typeof (window as any).updatePageTranslations === 'function') {
            (window as any).updatePageTranslations();
        }
    }
}

// Create singleton instance
export const templateLoader = new TemplateLoader();

// Export class for custom instances
export default TemplateLoader;
