import type { ContentstorageVueI18nOptions, TranslationData } from './types';

/**
 * ContentStorage CDN Translation Loader
 *
 * Loads translations from the ContentStorage CDN or a custom source.
 * Supports caching to avoid redundant requests.
 *
 * @example
 * ```typescript
 * const loader = new ContentstorageLoader({ contentKey: 'your-key' });
 * const translations = await loader.loadTranslations('en');
 * ```
 */
export class ContentstorageLoader {
  private options: ContentstorageVueI18nOptions;
  private cache: Map<string, TranslationData> = new Map();

  constructor(options: ContentstorageVueI18nOptions) {
    this.options = options;
  }

  /**
   * Load translations for a specific language from CDN
   *
   * @param language - Language code (e.g., 'en', 'es', 'fr')
   * @returns Promise resolving to translation data
   * @throws Error if loading fails
   */
  async loadTranslations(language: string): Promise<TranslationData> {
    // Check cache first
    const cached = this.cache.get(language);
    if (cached) {
      if (this.options.debug) {
        console.log(`[ContentStorage] Using cached translations for ${language}`);
      }
      return cached;
    }

    const url = this.getLoadPath(language);

    if (this.options.debug) {
      console.log(`[ContentStorage] Loading translations from: ${url}`);
    }

    try {
      const fetchFn = this.options.request || this.defaultFetch.bind(this);
      const translations = (await fetchFn(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })) as TranslationData;

      // Cache the result
      this.cache.set(language, translations);

      if (this.options.debug) {
        console.log(`[ContentStorage] Loaded translations for ${language}`);
      }

      return translations;
    } catch (error) {
      if (this.options.debug) {
        console.error('[ContentStorage] Failed to load translations:', error);
      }
      throw error;
    }
  }

  /**
   * Get the URL to load translations from
   *
   * @param language - Language code
   * @returns URL string
   */
  private getLoadPath(language: string): string {
    const { loadPath, contentKey } = this.options;

    // Custom load path function
    if (typeof loadPath === 'function') {
      return loadPath(language);
    }

    // Custom load path string with interpolation
    if (typeof loadPath === 'string') {
      return loadPath.replace('{{lng}}', language);
    }

    // Default CDN path requires contentKey
    if (!contentKey) {
      throw new Error(
        '[ContentStorage] contentKey is required when using default CDN path. ' +
          'Either provide a contentKey or use a custom loadPath.'
      );
    }

    // Default: Always use uppercase language code
    const lng = language.toUpperCase();

    // Default CDN URL format
    return `https://cdn.contentstorage.app/${contentKey}/content/${lng}.json`;
  }

  /**
   * Default fetch implementation
   *
   * @param url - URL to fetch
   * @param options - Fetch options
   * @returns Promise resolving to parsed JSON
   */
  private async defaultFetch(url: string, options: RequestInit): Promise<unknown> {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(
        `Failed to load translations: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Clear the cache for a specific language or all languages
   *
   * @param language - Optional language code. If not provided, clears entire cache.
   */
  clearCache(language?: string): void {
    if (language) {
      this.cache.delete(language);
      if (this.options.debug) {
        console.log(`[ContentStorage] Cleared cache for ${language}`);
      }
    } else {
      this.cache.clear();
      if (this.options.debug) {
        console.log('[ContentStorage] Cleared entire translation cache');
      }
    }
  }

  /**
   * Check if translations are cached for a language
   *
   * @param language - Language code
   * @returns true if cached
   */
  isCached(language: string): boolean {
    return this.cache.has(language);
  }

  /**
   * Get all cached languages
   *
   * @returns Array of language codes
   */
  getCachedLanguages(): string[] {
    return Array.from(this.cache.keys());
  }
}

/**
 * Factory function to create a ContentStorage loader
 *
 * @param options - Loader configuration options
 * @returns ContentstorageLoader instance
 */
export function createContentstorageLoader(
  options: ContentstorageVueI18nOptions
): ContentstorageLoader {
  return new ContentstorageLoader(options);
}
