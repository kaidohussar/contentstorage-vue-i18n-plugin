import { createI18n, I18n } from 'vue-i18n';
import type {
  CreateContentstorageI18nOptions,
  ContentstorageVueI18nOptions,
  TranslationData,
} from './types';
import { ContentstorageTracker, createContentstorageTracker } from './tracker';
import { ContentstorageLoader, createContentstorageLoader } from './loader';
import { isBrowser } from './utils';

/**
 * Extended I18n instance with ContentStorage utilities
 */
export interface ContentstorageI18n extends I18n {
  /**
   * ContentStorage utilities and state
   */
  contentStorage: {
    /**
     * Load translations for a language from CDN and set them in vue-i18n
     * @param language - Language code to load (e.g., 'en', 'es', 'fr')
     */
    loadLanguage: (language: string) => Promise<void>;

    /**
     * Whether the plugin is running in live editor mode
     */
    isLiveMode: boolean;

    /**
     * Manually track messages (useful when loading translations from other sources)
     * @param messages - Translation messages object
     * @param language - Language code for these messages
     */
    trackMessages: (messages: Record<string, unknown>, language: string) => void;

    /**
     * The underlying tracker instance
     */
    tracker: ContentstorageTracker;

    /**
     * The underlying loader instance (null if CDN loading not enabled)
     */
    loader: ContentstorageLoader | null;
  };
}

/**
 * Create a vue-i18n instance with ContentStorage integration
 *
 * This factory function wraps vue-i18n's createI18n and adds:
 * - Live editor mode detection and translation tracking
 * - Optional CDN-based translation loading
 * - Utilities for managing translations
 *
 * @example Basic usage with inline messages
 * ```typescript
 * import { createContentstorageI18n } from '@contentstorage/vue-i18n-plugin';
 *
 * const i18n = createContentstorageI18n({
 *   contentKey: 'your-content-key',
 *   locale: 'en',
 *   fallbackLocale: 'en',
 *   messages: {
 *     en: { welcome: 'Welcome', greeting: 'Hello {name}!' },
 *     es: { welcome: 'Bienvenido', greeting: 'Hola {name}!' },
 *   },
 * });
 *
 * app.use(i18n);
 * ```
 *
 * @example With CDN loading
 * ```typescript
 * const i18n = createContentstorageI18n({
 *   contentKey: 'your-content-key',
 *   enableCdnLoading: true,
 *   preloadLanguages: ['en', 'es'],
 *   locale: 'en',
 * });
 *
 * // Load additional languages on demand
 * await i18n.contentStorage.loadLanguage('fr');
 * ```
 *
 * @param options - Combined ContentStorage and vue-i18n options
 * @returns Extended I18n instance with ContentStorage utilities
 */
export function createContentstorageI18n(
  options: CreateContentstorageI18nOptions = {}
): ContentstorageI18n {
  // Separate ContentStorage options from vue-i18n options
  const {
    contentKey,
    debug,
    maxMemoryMapSize,
    loadPath,
    request,
    liveEditorParam,
    forceLiveMode,
    customLiveEditorScriptUrl,
    preloadLanguages,
    enableCdnLoading,
    ...vueI18nOptions
  } = options;

  // ContentStorage-specific options
  const contentStorageOptions: ContentstorageVueI18nOptions = {
    contentKey,
    debug,
    maxMemoryMapSize,
    loadPath,
    request,
    liveEditorParam,
    forceLiveMode,
    customLiveEditorScriptUrl,
    preloadLanguages,
    enableCdnLoading,
  };

  // Create the vue-i18n instance
  // Default to composition API mode (legacy: false) for better tracking support
  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    ...vueI18nOptions,
  }) as ContentstorageI18n;

  // Create the tracker
  const tracker = createContentstorageTracker(contentStorageOptions);

  // Create the loader if CDN loading is enabled or contentKey is provided
  const loader =
    enableCdnLoading || contentKey
      ? createContentstorageLoader(contentStorageOptions)
      : null;

  // Attach the tracker to the i18n instance
  tracker.attach(i18n);

  // Add ContentStorage utilities to the i18n instance
  i18n.contentStorage = {
    isLiveMode: tracker.inLiveMode,
    tracker,
    loader,

    async loadLanguage(language: string): Promise<void> {
      if (!loader) {
        throw new Error(
          '[ContentStorage] CDN loading not enabled. ' +
            'Set contentKey or enableCdnLoading option to enable.'
        );
      }

      // Load translations from CDN
      const translations = await loader.loadTranslations(language);

      // Set messages in vue-i18n
      const global = (i18n as I18n).global;
      if (global && 'setLocaleMessage' in global) {
        (
          global as {
            setLocaleMessage: (locale: string, messages: TranslationData) => void;
          }
        ).setLocaleMessage(language, translations);

        // Track the loaded messages
        tracker.trackMessages(translations, language);

        if (debug) {
          console.log(`[ContentStorage] Loaded and set messages for ${language}`);
        }
      } else {
        throw new Error('[ContentStorage] Could not access vue-i18n global instance');
      }
    },

    trackMessages(messages: Record<string, unknown>, language: string): void {
      tracker.trackMessages(messages, language);
    },
  };

  // Preload languages if specified
  if (preloadLanguages && preloadLanguages.length > 0 && isBrowser() && loader) {
    // Load preloadLanguages asynchronously (don't block initialization)
    Promise.all(
      preloadLanguages.map((lang) =>
        i18n.contentStorage.loadLanguage(lang).catch((err) => {
          if (debug) {
            console.error(`[ContentStorage] Failed to preload ${lang}:`, err);
          }
        })
      )
    ).then(() => {
      if (debug) {
        console.log('[ContentStorage] Finished preloading languages:', preloadLanguages);
      }
    });
  }

  return i18n;
}

/**
 * Attach ContentStorage tracking to an existing vue-i18n instance
 *
 * Use this when you already have a vue-i18n instance and want to add
 * ContentStorage live editor tracking to it.
 *
 * @example
 * ```typescript
 * import { createI18n } from 'vue-i18n';
 * import { attachContentstorageTracker } from '@contentstorage/vue-i18n-plugin';
 *
 * const i18n = createI18n({
 *   legacy: false,
 *   locale: 'en',
 *   messages: { en: { welcome: 'Welcome' } },
 * });
 *
 * const tracker = attachContentstorageTracker(i18n, {
 *   contentKey: 'your-key',
 *   debug: true,
 * });
 *
 * // Check if in live mode
 * if (tracker.inLiveMode) {
 *   console.log('Live editor mode active');
 * }
 * ```
 *
 * @param i18n - Existing vue-i18n instance
 * @param options - ContentStorage configuration options
 * @returns ContentstorageTracker instance
 */
export function attachContentstorageTracker(
  i18n: I18n,
  options: ContentstorageVueI18nOptions = {}
): ContentstorageTracker {
  const tracker = createContentstorageTracker(options);
  tracker.attach(i18n);
  return tracker;
}
