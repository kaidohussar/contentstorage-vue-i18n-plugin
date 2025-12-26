import { resetLiveEditorScript, getMemoryMap } from '../utils';

// Mock vue-i18n
const mockSetLocaleMessage = jest.fn();
const mockGetLocaleMessage = jest.fn((locale: string) => ({}));
const mockGetPostTranslationHandler = jest.fn(() => null);
const mockSetPostTranslationHandler = jest.fn();

const createMockI18nGlobal = (messages: Record<string, Record<string, unknown>> = {}) => {
  const localeRef = { value: 'en' };
  return {
    locale: localeRef,
    getLocaleMessage: (locale: string) => messages[locale] || {},
    setLocaleMessage: mockSetLocaleMessage,
    getPostTranslationHandler: mockGetPostTranslationHandler,
    setPostTranslationHandler: mockSetPostTranslationHandler,
  };
};

jest.mock('vue-i18n', () => ({
  createI18n: jest.fn((options: any) => {
    const messages = options?.messages || {};
    return {
      global: createMockI18nGlobal(messages),
      install: jest.fn(),
    };
  }),
}));

// Import after mock
import { createContentstorageI18n, attachContentstorageTracker } from '../plugin';
import { createI18n } from 'vue-i18n';

// Mock fetch globally
global.fetch = jest.fn();

describe('plugin', () => {
  beforeEach(() => {
    // Clear state
    const win = window as any;
    delete win.memoryMap;
    delete win.currentLanguageCode;

    // Reset mocks
    resetLiveEditorScript();
    (global.fetch as jest.Mock).mockReset();
    jest.clearAllMocks();
  });

  describe('createContentstorageI18n', () => {
    it('should create a vue-i18n instance', () => {
      const i18n = createContentstorageI18n({
        locale: 'en',
        messages: { en: { greeting: 'Hello' } },
      });

      expect(i18n).toBeDefined();
      expect(i18n.global).toBeDefined();
      expect(createI18n).toHaveBeenCalled();
    });

    it('should add contentStorage utilities to i18n', () => {
      const i18n = createContentstorageI18n({
        locale: 'en',
        messages: { en: { greeting: 'Hello' } },
      });

      expect(i18n.contentStorage).toBeDefined();
      expect(i18n.contentStorage.tracker).toBeDefined();
      expect(typeof i18n.contentStorage.loadLanguage).toBe('function');
      expect(typeof i18n.contentStorage.trackMessages).toBe('function');
      expect(typeof i18n.contentStorage.isLiveMode).toBe('boolean');
    });

    it('should have isLiveMode false when not in live editor', () => {
      const i18n = createContentstorageI18n({
        locale: 'en',
        messages: { en: {} },
      });

      expect(i18n.contentStorage.isLiveMode).toBe(false);
    });

    it('should have isLiveMode true when forceLiveMode is set', () => {
      const i18n = createContentstorageI18n({
        forceLiveMode: true,
        locale: 'en',
        messages: { en: {} },
      });

      expect(i18n.contentStorage.isLiveMode).toBe(true);
    });

    it('should create loader when contentKey is provided', () => {
      const i18n = createContentstorageI18n({
        contentKey: 'test-key',
        locale: 'en',
        messages: { en: {} },
      });

      expect(i18n.contentStorage.loader).not.toBeNull();
    });

    it('should create loader when enableCdnLoading is true', () => {
      const i18n = createContentstorageI18n({
        enableCdnLoading: true,
        loadPath: '/locales/{{lng}}.json',
        locale: 'en',
        messages: { en: {} },
      });

      expect(i18n.contentStorage.loader).not.toBeNull();
    });

    it('should not create loader without contentKey or enableCdnLoading', () => {
      const i18n = createContentstorageI18n({
        locale: 'en',
        messages: { en: {} },
      });

      expect(i18n.contentStorage.loader).toBeNull();
    });

    it('should NOT preload messages in live mode (gradual population)', () => {
      // Reset mock to return actual messages
      jest.mocked(createI18n).mockImplementationOnce((options: any) => {
        const messages = options?.messages || {};
        return {
          global: {
            locale: { value: 'en' },
            getLocaleMessage: (locale: string) => messages[locale] || {},
            setLocaleMessage: mockSetLocaleMessage,
            getPostTranslationHandler: mockGetPostTranslationHandler,
            setPostTranslationHandler: mockSetPostTranslationHandler,
          },
          install: jest.fn(),
        } as any;
      });

      const i18n = createContentstorageI18n({
        forceLiveMode: true,
        locale: 'en',
        messages: {
          en: {
            greeting: 'Hello',
            farewell: 'Goodbye',
          },
        },
      });

      const memoryMap = getMemoryMap();
      // memoryMap should be empty - translations are only added via $t() calls
      expect(memoryMap?.size).toBe(0);
    });
  });

  describe('loadLanguage', () => {
    it('should load and set translations from CDN', async () => {
      const mockTranslations = { greeting: 'Hola', farewell: 'Adios' };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTranslations,
      });

      const i18n = createContentstorageI18n({
        contentKey: 'test-key',
        forceLiveMode: true,
        locale: 'en',
        messages: { en: {} },
      });

      await i18n.contentStorage.loadLanguage('es');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://cdn.contentstorage.app/test-key/content/ES.json',
        expect.any(Object)
      );

      expect(mockSetLocaleMessage).toHaveBeenCalledWith('es', mockTranslations);

      // Check that messages were tracked
      const memoryMap = getMemoryMap();
      expect(memoryMap?.has('Hola')).toBe(true);
      expect(memoryMap?.has('Adios')).toBe(true);
    });

    it('should throw if loader not available', async () => {
      const i18n = createContentstorageI18n({
        locale: 'en',
        messages: { en: {} },
      });

      await expect(i18n.contentStorage.loadLanguage('es')).rejects.toThrow(
        'CDN loading not enabled'
      );
    });
  });

  describe('trackMessages', () => {
    it('should manually track messages', () => {
      const i18n = createContentstorageI18n({
        forceLiveMode: true,
        locale: 'en',
        messages: { en: {} },
      });

      i18n.contentStorage.trackMessages(
        {
          custom: 'Custom Value',
          nested: { key: 'Nested Value' },
        },
        'en'
      );

      const memoryMap = getMemoryMap();
      expect(memoryMap?.has('Custom Value')).toBe(true);
      expect(memoryMap?.has('Nested Value')).toBe(true);
    });
  });

  describe('attachContentstorageTracker', () => {
    it('should attach tracker to existing i18n instance', () => {
      const mockI18n = {
        global: createMockI18nGlobal({ en: { greeting: 'Hello' } }),
      };

      const tracker = attachContentstorageTracker(mockI18n as any, {
        forceLiveMode: true,
      });

      expect(tracker.inLiveMode).toBe(true);
      expect(tracker.isAttached).toBe(true);
    });

    it('should NOT preload messages when attaching (gradual population)', () => {
      const mockI18n = {
        global: {
          ...createMockI18nGlobal(),
          getLocaleMessage: (locale: string) =>
            locale === 'en' ? { greeting: 'Hello', farewell: 'Goodbye' } : {},
        },
      };

      attachContentstorageTracker(mockI18n as any, { forceLiveMode: true });

      const memoryMap = getMemoryMap();
      // memoryMap should be empty - translations are only added via $t() calls
      expect(memoryMap?.size).toBe(0);
    });

    it('should not attach when not in live mode', () => {
      const mockI18n = {
        global: createMockI18nGlobal(),
      };

      const tracker = attachContentstorageTracker(mockI18n as any, {
        forceLiveMode: false,
      });

      expect(tracker.inLiveMode).toBe(false);
      expect(tracker.isAttached).toBe(false);
    });
  });
});
