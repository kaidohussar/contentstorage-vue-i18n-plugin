import type { I18nOptions } from 'vue-i18n';

/**
 * Entry in the memory map that tracks translation metadata
 */
export interface MemoryMapEntry {
  /** Set of translation keys (content IDs) that map to this value */
  ids: Set<string>;
  /** Type of content - always 'text' for translations */
  type: 'text';
  /** Variables used in translation interpolation */
  variables?: Record<string, unknown>;
  /** Optional metadata for debugging */
  metadata?: {
    /** Namespace where this translation was found */
    namespace?: string;
    /** Language code */
    language?: string;
    /** Timestamp when tracked */
    trackedAt?: number;
  };
}

/**
 * Global memory map for translation tracking
 * Maps translation values to their content IDs
 */
export type MemoryMap = Map<string, MemoryMapEntry>;

/**
 * Window interface extended with Contentstorage properties
 */
export interface ContentstorageWindow extends Window {
  memoryMap?: MemoryMap;
  __contentStorageDebug?: boolean;
  currentLanguageCode?: string;
}

/**
 * ContentStorage plugin configuration options
 */
export interface ContentstorageVueI18nOptions {
  /**
   * Your ContentStorage content key
   * Used to construct CDN URLs for fetching translations
   * Default URL format: https://cdn.contentstorage.app/{contentKey}/content/{LNG}.json
   */
  contentKey?: string;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Maximum number of entries in memoryMap
   * When exceeded, oldest entries are removed
   * @default 10000
   */
  maxMemoryMapSize?: number;

  /**
   * Custom path for loading translations
   * Can be a string with {{lng}} placeholder or a function
   * @example '{{lng}}.json'
   * @example (lng) => `https://api.example.com/translations/${lng}`
   */
  loadPath?: string | ((language: string) => string);

  /**
   * Custom fetch implementation
   * Useful for adding auth headers or custom logic
   */
  request?: (url: string, options: RequestInit) => Promise<unknown>;

  /**
   * Query parameter name for live editor detection
   * @default 'contentstorage_live_editor'
   */
  liveEditorParam?: string;

  /**
   * Allow manual override of live editor mode
   * Useful for testing
   * @default false
   */
  forceLiveMode?: boolean;

  /**
   * Custom URL for the live editor script
   * If not provided, uses default CDN URL
   * @default 'https://cdn.contentstorage.app/live-editor.js?contentstorage-live-editor=true'
   */
  customLiveEditorScriptUrl?: string;

  /**
   * Languages to preload from CDN on initialization
   */
  preloadLanguages?: string[];

  /**
   * Enable automatic translation loading from CDN
   * When true, translations will be loaded from the CDN
   * @default false (only tracking by default)
   */
  enableCdnLoading?: boolean;
}

/**
 * Options for createContentstorageI18n factory
 * Combines ContentStorage options with vue-i18n options
 */
export interface CreateContentstorageI18nOptions
  extends ContentstorageVueI18nOptions, Omit<I18nOptions, 'legacy'> {
  /**
   * Whether to use legacy mode (VueI18n) or composition mode (Composer)
   * @default false (composition mode)
   */
  legacy?: boolean;
}

/**
 * Translation data structure
 * Can be a nested object with string values
 */
export type TranslationData = {
  [key: string]: string | TranslationData;
};
