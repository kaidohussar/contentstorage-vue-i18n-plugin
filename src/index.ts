/**
 * @contentstorage/vue-i18n-plugin
 *
 * Vue-i18n plugin for ContentStorage live editor translation tracking
 *
 * @packageDocumentation
 */

// Main plugin exports
export {
  createContentstorageI18n,
  attachContentstorageTracker,
  type ContentstorageI18n,
} from './plugin';

// Tracker exports
export { ContentstorageTracker, createContentstorageTracker } from './tracker';

// Loader exports
export { ContentstorageLoader, createContentstorageLoader } from './loader';

// Utility exports
export {
  debugMemoryMap,
  loadLiveEditorScript,
  setCurrentLanguageCode,
  getCurrentLanguageCode,
  detectLiveEditorMode,
  initializeMemoryMap,
  getMemoryMap,
  trackTranslation,
  flattenTranslations,
  cleanupMemoryMap,
  getNestedValue,
} from './utils';

// Type exports
export type {
  ContentstorageVueI18nOptions,
  CreateContentstorageI18nOptions,
  MemoryMap,
  MemoryMapEntry,
  ContentstorageWindow,
  TranslationData,
} from './types';
