import { ContentstorageTracker, createContentstorageTracker } from '../tracker';
import { resetLiveEditorScript, getMemoryMap, initializeMemoryMap } from '../utils';

// Mock vue-i18n
const createMockI18n = (messages: Record<string, Record<string, unknown>> = {}) => {
  let postTranslationHandler: ((translated: string, key: string) => string) | null = null;
  const localeRef = { value: 'en' };

  return {
    global: {
      locale: localeRef,
      getLocaleMessage: (locale: string) => messages[locale] || {},
      setLocaleMessage: jest.fn(),
      getPostTranslationHandler: () => postTranslationHandler,
      setPostTranslationHandler: (
        handler: (translated: string, key: string) => string
      ) => {
        postTranslationHandler = handler;
      },
      // Expose for testing
      _callPostTranslation: (translated: string, key: string) => {
        if (postTranslationHandler) {
          return postTranslationHandler(translated, key);
        }
        return translated;
      },
    },
  };
};

describe('ContentstorageTracker', () => {
  beforeEach(() => {
    // Clear state
    const win = window as any;
    delete win.memoryMap;
    delete win.currentLanguageCode;
    delete win.__contentstorageRefresh;

    // Reset live editor script
    resetLiveEditorScript();
  });

  describe('initialization', () => {
    it('should create tracker with default options', () => {
      const tracker = new ContentstorageTracker();

      expect(tracker.inLiveMode).toBe(false);
      expect(tracker.isAttached).toBe(false);
    });

    it('should enable live mode when forceLiveMode is true', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: true });

      expect(tracker.inLiveMode).toBe(true);
    });

    it('should initialize memory map in live mode', () => {
      new ContentstorageTracker({ forceLiveMode: true });

      expect(getMemoryMap()).toBeInstanceOf(Map);
    });

    it('should not initialize memory map when not in live mode', () => {
      new ContentstorageTracker({ forceLiveMode: false });

      expect(getMemoryMap()).toBeNull();
    });
  });

  describe('attach', () => {
    it('should attach to vue-i18n instance in live mode', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: true });
      const mockI18n = createMockI18n({ en: { greeting: 'Hello' } });

      tracker.attach(mockI18n as any);

      expect(tracker.isAttached).toBe(true);
    });

    it('should not attach when not in live mode', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: false });
      const mockI18n = createMockI18n();

      tracker.attach(mockI18n as any);

      expect(tracker.isAttached).toBe(false);
    });

    it('should warn if already attached', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const tracker = new ContentstorageTracker({ forceLiveMode: true, debug: true });
      const mockI18n = createMockI18n();

      tracker.attach(mockI18n as any);
      tracker.attach(mockI18n as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already attached')
      );

      consoleSpy.mockRestore();
    });

    it('should NOT preload messages when attaching (gradual population)', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: true });
      const mockI18n = createMockI18n({
        en: {
          greeting: 'Hello',
          nested: { title: 'Welcome' },
        },
      });

      tracker.attach(mockI18n as any);

      const memoryMap = getMemoryMap();
      // memoryMap should be empty - translations are only added via $t() calls
      expect(memoryMap?.size).toBe(0);
    });
  });

  describe('preloadMessages', () => {
    it('should preload all messages when called explicitly', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: true });
      const mockI18n = createMockI18n({
        en: {
          greeting: 'Hello',
          nested: { title: 'Welcome' },
        },
      });

      tracker.attach(mockI18n as any);
      tracker.preloadMessages(mockI18n.global as any);

      const memoryMap = getMemoryMap();
      expect(memoryMap?.has('Hello')).toBe(true);
      expect(memoryMap?.has('Welcome')).toBe(true);
    });

    it('should not preload when not in live mode', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: false });
      const mockI18n = createMockI18n({
        en: { greeting: 'Hello' },
      });

      tracker.preloadMessages(mockI18n.global as any);

      expect(getMemoryMap()).toBeNull();
    });
  });

  describe('postTranslation tracking', () => {
    it('should track translations via postTranslation handler', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: true });
      const mockI18n = createMockI18n({
        en: { greeting: 'Hello {name}!' },
      });

      tracker.attach(mockI18n as any);

      // Simulate a translation
      mockI18n.global._callPostTranslation('Hello John!', 'greeting');

      const memoryMap = getMemoryMap();
      // Should track the template, not the interpolated value
      expect(memoryMap?.has('Hello {name}!')).toBe(true);
    });

    it('should fall back to translated value if template not found', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: true });
      const mockI18n = createMockI18n({ en: {} });

      tracker.attach(mockI18n as any);

      // Simulate a translation for a key that doesn't exist in messages
      mockI18n.global._callPostTranslation('Dynamic value', 'unknown.key');

      const memoryMap = getMemoryMap();
      expect(memoryMap?.has('Dynamic value')).toBe(true);
    });
  });

  describe('trackMessages', () => {
    it('should manually track messages', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: true });

      tracker.trackMessages(
        {
          welcome: 'Welcome',
          goodbye: 'Goodbye',
        },
        'en'
      );

      const memoryMap = getMemoryMap();
      expect(memoryMap?.has('Welcome')).toBe(true);
      expect(memoryMap?.has('Goodbye')).toBe(true);
    });

    it('should track nested messages', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: true });

      tracker.trackMessages(
        {
          home: {
            title: 'Home Page',
            subtitle: 'Welcome Home',
          },
        },
        'en'
      );

      const memoryMap = getMemoryMap();
      expect(memoryMap?.has('Home Page')).toBe(true);
      expect(memoryMap?.has('Welcome Home')).toBe(true);

      const homeEntry = memoryMap?.get('Home Page');
      expect(homeEntry?.ids.has('home.title')).toBe(true);
    });

    it('should not track when not in live mode', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: false });

      tracker.trackMessages({ welcome: 'Welcome' }, 'en');

      expect(getMemoryMap()).toBeNull();
    });

    it('should cleanup when exceeding maxMemoryMapSize', () => {
      const tracker = new ContentstorageTracker({
        forceLiveMode: true,
        maxMemoryMapSize: 2,
      });

      tracker.trackMessages(
        {
          a: 'Value A',
          b: 'Value B',
          c: 'Value C',
        },
        'en'
      );

      const memoryMap = getMemoryMap();
      expect(memoryMap?.size).toBeLessThanOrEqual(2);
    });
  });

  describe('createContentstorageTracker', () => {
    it('should create a tracker instance', () => {
      const tracker = createContentstorageTracker({ debug: true });

      expect(tracker).toBeInstanceOf(ContentstorageTracker);
    });
  });

  describe('refresh function', () => {
    it('should expose __contentstorageRefresh on window in live mode', () => {
      new ContentstorageTracker({ forceLiveMode: true });

      const win = window as any;
      expect(typeof win.__contentstorageRefresh).toBe('function');
    });

    it('should not expose __contentstorageRefresh when not in live mode', () => {
      new ContentstorageTracker({ forceLiveMode: false });

      const win = window as any;
      expect(win.__contentstorageRefresh).toBeUndefined();
    });

    it('should clear memoryMap when refresh is called', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: true });

      // Add some translations to memoryMap
      tracker.trackMessages(
        {
          greeting: 'Hello',
          farewell: 'Goodbye',
        },
        'en'
      );

      const memoryMap = getMemoryMap();
      expect(memoryMap?.size).toBe(2);

      // Call refresh
      const win = window as any;
      win.__contentstorageRefresh();

      // memoryMap should be cleared
      expect(memoryMap?.size).toBe(0);
    });

    it('should allow translations to be re-tracked after refresh', () => {
      const tracker = new ContentstorageTracker({ forceLiveMode: true });
      const mockI18n = createMockI18n({
        en: { greeting: 'Hello World' },
      });

      tracker.attach(mockI18n as any);

      // Simulate a translation
      mockI18n.global._callPostTranslation('Hello World', 'greeting');

      const memoryMap = getMemoryMap();
      expect(memoryMap?.has('Hello World')).toBe(true);

      // Call refresh - clears memoryMap
      const win = window as any;
      win.__contentstorageRefresh();

      expect(memoryMap?.size).toBe(0);

      // Simulate another translation - should be tracked again
      mockI18n.global._callPostTranslation('Hello World', 'greeting');

      expect(memoryMap?.has('Hello World')).toBe(true);
    });
  });
});
