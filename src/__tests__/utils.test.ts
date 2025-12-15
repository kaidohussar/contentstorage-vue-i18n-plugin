import {
  isBrowser,
  getContentstorageWindow,
  detectLiveEditorMode,
  initializeMemoryMap,
  getMemoryMap,
  trackTranslation,
  cleanupMemoryMap,
  flattenTranslations,
  normalizeKey,
  setCurrentLanguageCode,
  getCurrentLanguageCode,
  getNestedValue,
  resetLiveEditorScript,
} from '../utils';

describe('utils', () => {
  beforeEach(() => {
    // Clear memory map before each test
    const win = window as any;
    delete win.memoryMap;
    delete win.currentLanguageCode;

    // Reset live editor script state
    resetLiveEditorScript();
  });

  describe('isBrowser', () => {
    it('should return true in browser environment', () => {
      expect(isBrowser()).toBe(true);
    });
  });

  describe('getContentstorageWindow', () => {
    it('should return window object', () => {
      const win = getContentstorageWindow();
      expect(win).toBe(window);
    });
  });

  describe('detectLiveEditorMode', () => {
    it('should return false when not in iframe', () => {
      expect(detectLiveEditorMode()).toBe(false);
    });

    it('should return true when forceLiveMode is true', () => {
      expect(detectLiveEditorMode('contentstorage_live_editor', true)).toBe(true);
    });

    it('should return false when only URL param is present but not in iframe', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?contentstorage_live_editor=true' },
        writable: true,
      });

      expect(detectLiveEditorMode()).toBe(false);
    });
  });

  describe('initializeMemoryMap', () => {
    it('should create a new Map on window', () => {
      const memoryMap = initializeMemoryMap();

      expect(memoryMap).toBeInstanceOf(Map);
      expect((window as any).memoryMap).toBe(memoryMap);
    });

    it('should return existing map if already initialized', () => {
      const first = initializeMemoryMap();
      const second = initializeMemoryMap();

      expect(first).toBe(second);
    });
  });

  describe('getMemoryMap', () => {
    it('should return null if not initialized', () => {
      expect(getMemoryMap()).toBeNull();
    });

    it('should return the memory map if initialized', () => {
      initializeMemoryMap();
      expect(getMemoryMap()).toBeInstanceOf(Map);
    });
  });

  describe('trackTranslation', () => {
    beforeEach(() => {
      initializeMemoryMap();
    });

    it('should track a translation', () => {
      trackTranslation('Hello', 'greeting', undefined, 'en');

      const memoryMap = getMemoryMap();
      expect(memoryMap?.has('Hello')).toBe(true);

      const entry = memoryMap?.get('Hello');
      expect(entry?.ids.has('greeting')).toBe(true);
      expect(entry?.type).toBe('text');
      expect(entry?.metadata?.language).toBe('en');
    });

    it('should add multiple keys to same value', () => {
      trackTranslation('Welcome', 'home.title', undefined, 'en');
      trackTranslation('Welcome', 'banner.heading', undefined, 'en');

      const memoryMap = getMemoryMap();
      const entry = memoryMap?.get('Welcome');

      expect(entry?.ids.has('home.title')).toBe(true);
      expect(entry?.ids.has('banner.heading')).toBe(true);
    });

    it('should track with variables', () => {
      trackTranslation('Hello {name}!', 'greeting', undefined, 'en', false, {
        name: 'John',
      });

      const memoryMap = getMemoryMap();
      const entry = memoryMap?.get('Hello {name}!');

      expect(entry?.variables).toEqual({ name: 'John' });
    });
  });

  describe('cleanupMemoryMap', () => {
    beforeEach(() => {
      initializeMemoryMap();
    });

    it('should remove oldest entries when exceeding max size', () => {
      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        trackTranslation(`Value ${i}`, `key${i}`, undefined, 'en');
      }

      // Cleanup to max 3
      cleanupMemoryMap(3);

      const memoryMap = getMemoryMap();
      expect(memoryMap?.size).toBe(3);
    });

    it('should not remove entries if under max size', () => {
      trackTranslation('Value 1', 'key1', undefined, 'en');
      trackTranslation('Value 2', 'key2', undefined, 'en');

      cleanupMemoryMap(10);

      const memoryMap = getMemoryMap();
      expect(memoryMap?.size).toBe(2);
    });
  });

  describe('flattenTranslations', () => {
    it('should flatten a simple object', () => {
      const obj = { greeting: 'Hello', farewell: 'Goodbye' };
      const result = flattenTranslations(obj);

      expect(result).toEqual([
        ['greeting', 'Hello'],
        ['farewell', 'Goodbye'],
      ]);
    });

    it('should flatten nested objects', () => {
      const obj = {
        home: {
          title: 'Home',
          subtitle: 'Welcome',
        },
        about: 'About Us',
      };
      const result = flattenTranslations(obj);

      expect(result).toContainEqual(['home.title', 'Home']);
      expect(result).toContainEqual(['home.subtitle', 'Welcome']);
      expect(result).toContainEqual(['about', 'About Us']);
    });

    it('should handle deeply nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: 'Deep value',
          },
        },
      };
      const result = flattenTranslations(obj);

      expect(result).toEqual([['level1.level2.level3', 'Deep value']]);
    });

    it('should handle empty objects', () => {
      expect(flattenTranslations({})).toEqual([]);
    });

    it('should handle null and undefined', () => {
      expect(flattenTranslations(null)).toEqual([]);
      expect(flattenTranslations(undefined)).toEqual([]);
    });
  });

  describe('normalizeKey', () => {
    it('should return the key as-is for vue-i18n', () => {
      expect(normalizeKey('greeting')).toBe('greeting');
      expect(normalizeKey('nested.key')).toBe('nested.key');
      expect(normalizeKey('deeply.nested.key')).toBe('deeply.nested.key');
    });
  });

  describe('setCurrentLanguageCode / getCurrentLanguageCode', () => {
    it('should set and get current language code', () => {
      setCurrentLanguageCode('en');
      expect(getCurrentLanguageCode()).toBe('en');

      setCurrentLanguageCode('es');
      expect(getCurrentLanguageCode()).toBe('es');
    });

    it('should return null if not set', () => {
      expect(getCurrentLanguageCode()).toBeNull();
    });
  });

  describe('getNestedValue', () => {
    it('should get a top-level value', () => {
      const obj = { greeting: 'Hello' };
      expect(getNestedValue(obj, 'greeting')).toBe('Hello');
    });

    it('should get a nested value', () => {
      const obj = { home: { title: 'Home Page' } };
      expect(getNestedValue(obj, 'home.title')).toBe('Home Page');
    });

    it('should get a deeply nested value', () => {
      const obj = { a: { b: { c: { d: 'deep' } } } };
      expect(getNestedValue(obj, 'a.b.c.d')).toBe('deep');
    });

    it('should return undefined for non-existent paths', () => {
      const obj = { greeting: 'Hello' };
      expect(getNestedValue(obj, 'farewell')).toBeUndefined();
      expect(getNestedValue(obj, 'greeting.nested')).toBeUndefined();
    });

    it('should handle null and undefined objects', () => {
      expect(getNestedValue(null, 'key')).toBeUndefined();
      expect(getNestedValue(undefined, 'key')).toBeUndefined();
    });
  });
});
