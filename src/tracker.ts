import type { I18n, Composer, VueI18n } from 'vue-i18n';
import type { ContentstorageVueI18nOptions } from './types';
import {
  detectLiveEditorMode,
  initializeMemoryMap,
  loadLiveEditorScript,
  trackTranslation,
  cleanupMemoryMap,
  clearMemoryMap,
  flattenTranslations,
  setCurrentLanguageCode,
  getNestedValue,
  getContentstorageWindow,
  isBrowser,
} from './utils';

/**
 * ContentStorage Translation Tracker for vue-i18n
 *
 * Handles live editor mode detection, memory map management,
 * and translation tracking via the postTranslation hook.
 *
 * @example
 * ```typescript
 * import { createI18n } from 'vue-i18n';
 * import { ContentstorageTracker } from '@contentstorage/vue-i18n-plugin';
 *
 * const i18n = createI18n({ ... });
 * const tracker = new ContentstorageTracker({ debug: true });
 * tracker.attach(i18n);
 * ```
 */
export class ContentstorageTracker {
  private options: ContentstorageVueI18nOptions;
  private isLiveMode: boolean = false;
  private attached: boolean = false;

  constructor(options: ContentstorageVueI18nOptions = {}) {
    this.options = {
      debug: false,
      maxMemoryMapSize: 10000,
      liveEditorParam: 'contentstorage_live_editor',
      forceLiveMode: false,
      ...options,
    };

    // Detect live editor mode
    this.isLiveMode = detectLiveEditorMode(
      this.options.liveEditorParam,
      this.options.forceLiveMode
    );

    if (this.isLiveMode) {
      this.initializeLiveMode();
    } else if (this.options.debug) {
      console.log('[ContentStorage] Running in normal mode (not live editor)');
    }
  }

  /**
   * Initialize live editor mode
   */
  private initializeLiveMode(): void {
    // Initialize memory map
    initializeMemoryMap();

    // Expose refresh function for live editor
    this.exposeRefreshFunction();

    // Load the live editor script
    loadLiveEditorScript(
      2,
      3000,
      this.options.debug,
      this.options.customLiveEditorScriptUrl
    ).then((loaded) => {
      if (loaded && this.options.debug) {
        console.log('[ContentStorage] Live editor script loaded');
      }
    });

    if (this.options.debug) {
      console.log('[ContentStorage] Live editor mode enabled');
    }
  }

  /**
   * Expose refresh function on window for live-editor.js to call
   * Clears the memoryMap so only currently-rendered translations are tracked
   */
  private exposeRefreshFunction(): void {
    const win = getContentstorageWindow();
    if (!win) return;

    win.__contentstorageRefresh = () => {
      clearMemoryMap();

      if (this.options.debug) {
        console.log('[ContentStorage] Refresh triggered: memoryMap cleared');
      }
    };

    if (this.options.debug) {
      console.log('[ContentStorage] Refresh function exposed on window.__contentstorageRefresh');
    }
  }

  /**
   * Attach the tracker to a vue-i18n instance
   *
   * @param i18n - The vue-i18n instance to attach to
   */
  attach(i18n: I18n): void {
    if (this.attached) {
      if (this.options.debug) {
        console.warn('[ContentStorage] Tracker already attached to an i18n instance');
      }
      return;
    }

    if (!this.isLiveMode) {
      if (this.options.debug) {
        console.log('[ContentStorage] Not in live mode, skipping attachment');
      }
      return;
    }

    // Get the global composer/vueI18n instance
    const globalInstance = this.getGlobalInstance(i18n);
    if (!globalInstance) {
      console.warn('[ContentStorage] Could not get vue-i18n global instance');
      return;
    }

    // Set initial language
    const locale = this.getLocale(globalInstance);
    if (locale) {
      setCurrentLanguageCode(locale);
    }

    // Set up the postTranslation handler
    this.setupPostTranslationHandler(i18n, globalInstance);

    // Note: We don't pre-load all translations anymore.
    // memoryMap is populated gradually as $t() is called.
    // Use preloadMessages() if you need to pre-populate.

    this.attached = true;

    if (this.options.debug) {
      console.log('[ContentStorage] Tracker attached to vue-i18n instance');
    }
  }

  /**
   * Get the global Composer or VueI18n instance from I18n
   */
  private getGlobalInstance(i18n: I18n): Composer | VueI18n | null {
    // vue-i18n stores the global instance in i18n.global
    if ('global' in i18n && i18n.global) {
      return i18n.global as Composer | VueI18n;
    }
    return null;
  }

  /**
   * Get the current locale from the instance
   */
  private getLocale(instance: Composer | VueI18n): string | null {
    // Handle both Composer (composition API) and VueI18n (legacy API)
    if ('locale' in instance) {
      const locale = instance.locale;
      // Composition API: locale is a Ref
      if (typeof locale === 'object' && 'value' in locale) {
        return locale.value as string;
      }
      // Legacy API: locale is a string
      if (typeof locale === 'string') {
        return locale;
      }
    }
    return null;
  }

  /**
   * Get messages for a locale from the instance
   */
  private getLocaleMessages(
    instance: Composer | VueI18n,
    locale: string
  ): Record<string, unknown> | null {
    try {
      // Try Composer API first (composition mode)
      if (
        'getLocaleMessage' in instance &&
        typeof instance.getLocaleMessage === 'function'
      ) {
        return instance.getLocaleMessage(locale) as Record<string, unknown>;
      }
      // Try VueI18n API (legacy mode)
      if ('messages' in instance) {
        const messages = instance.messages;
        // Composition API: messages is a Ref
        if (typeof messages === 'object' && 'value' in messages) {
          return (
            (messages.value as Record<string, Record<string, unknown>>)[locale] || null
          );
        }
        // Legacy API: messages is an object
        return (messages as Record<string, Record<string, unknown>>)[locale] || null;
      }
    } catch (e) {
      if (this.options.debug) {
        console.warn('[ContentStorage] Could not get locale messages:', e);
      }
    }
    return null;
  }

  /**
   * Set up the postTranslation handler to intercept translations
   */
  private setupPostTranslationHandler(_i18n: I18n, instance: Composer | VueI18n): void {
    // Get existing handler if any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existingHandler: ((translated: any, key: string) => any) | null = null;

    if (
      'getPostTranslationHandler' in instance &&
      typeof instance.getPostTranslationHandler === 'function'
    ) {
      existingHandler = instance.getPostTranslationHandler() as typeof existingHandler;
    }

    // Create our handler
    // vue-i18n's PostTranslationHandler can receive string or array types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (translated: any, key: string): any => {
      // Only track string translations (skip arrays/plurals)
      if (typeof translated === 'string') {
        this.handleTranslation(translated, key, instance);
      }

      // Call existing handler if present
      if (existingHandler && typeof existingHandler === 'function') {
        return (existingHandler as Function)(translated, key);
      }

      return translated;
    };

    // Set the handler
    if (
      'setPostTranslationHandler' in instance &&
      typeof instance.setPostTranslationHandler === 'function'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (instance.setPostTranslationHandler as (handler: any) => void)(handler);
    } else {
      // Fallback: try setting postTranslation property directly
      // This works for some vue-i18n configurations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (instance as any).postTranslation = handler;
    }

    if (this.options.debug) {
      console.log('[ContentStorage] postTranslation handler set up');
    }
  }

  /**
   * Handle a translation event from postTranslation
   */
  private handleTranslation(
    translated: string,
    key: string,
    instance: Composer | VueI18n
  ): void {
    const language = this.getLocale(instance);

    // Update current language code
    if (language) {
      setCurrentLanguageCode(language);
    }

    // Try to get the template (with placeholders) instead of the interpolated value
    // This is the key approach to work around postTranslation's limitation
    let template = translated;

    if (language) {
      const messages = this.getLocaleMessages(instance, language);
      if (messages) {
        const templateValue = getNestedValue(messages, key);
        if (templateValue && typeof templateValue === 'string') {
          template = templateValue;
        }
      }
    }

    // Track the translation
    // Note: We don't have access to interpolation variables in postTranslation
    // So we track the template which contains {placeholder} syntax
    trackTranslation(
      template,
      key,
      undefined, // vue-i18n doesn't use namespaces like i18next
      language || undefined,
      this.options.debug
    );

    // Cleanup if memory map is too large
    if (this.options.maxMemoryMapSize) {
      cleanupMemoryMap(this.options.maxMemoryMapSize);
    }
  }

  /**
   * Preload all messages from the current locale into memoryMap.
   *
   * By default, memoryMap is populated gradually as $t() is called.
   * Use this method if you want to pre-populate all translations upfront.
   *
   * @param instance - Optional Composer or VueI18n instance. If not provided,
   *                   uses the attached instance.
   */
  preloadMessages(instance?: Composer | VueI18n): void {
    if (!isBrowser()) return;
    if (!this.isLiveMode) return;

    // Use provided instance or get from attached i18n
    const targetInstance = instance;
    if (!targetInstance) {
      if (this.options.debug) {
        console.warn('[ContentStorage] No instance provided to preloadMessages()');
      }
      return;
    }

    const locale = this.getLocale(targetInstance);
    if (!locale) return;

    const messages = this.getLocaleMessages(targetInstance, locale);
    if (!messages || typeof messages !== 'object') return;

    const flatTranslations = flattenTranslations(messages);

    for (const [key, value] of flatTranslations) {
      if (!value) continue;
      trackTranslation(value, key, undefined, locale, this.options.debug);
    }

    if (this.options.debug) {
      console.log(
        `[ContentStorage] Preloaded ${flatTranslations.length} translations for ${locale}`
      );
    }
  }

  /**
   * Manually track translations when new messages are loaded
   * Call this after loading translations via setLocaleMessage
   *
   * @param messages - Translation messages to track
   * @param language - Language code for these messages
   */
  trackMessages(messages: Record<string, unknown>, language: string): void {
    if (!this.isLiveMode) return;

    const flatTranslations = flattenTranslations(messages);

    for (const [key, value] of flatTranslations) {
      if (!value) continue;
      trackTranslation(value, key, undefined, language, this.options.debug);
    }

    // Cleanup if needed
    if (this.options.maxMemoryMapSize) {
      cleanupMemoryMap(this.options.maxMemoryMapSize);
    }

    if (this.options.debug) {
      console.log(
        `[ContentStorage] Tracked ${flatTranslations.length} translations for ${language}`
      );
    }
  }

  /**
   * Check if the tracker is in live editor mode
   */
  get inLiveMode(): boolean {
    return this.isLiveMode;
  }

  /**
   * Check if the tracker is attached to an i18n instance
   */
  get isAttached(): boolean {
    return this.attached;
  }
}

/**
 * Factory function to create a ContentStorage tracker
 *
 * @param options - Tracker configuration options
 * @returns ContentstorageTracker instance
 */
export function createContentstorageTracker(
  options: ContentstorageVueI18nOptions = {}
): ContentstorageTracker {
  return new ContentstorageTracker(options);
}
