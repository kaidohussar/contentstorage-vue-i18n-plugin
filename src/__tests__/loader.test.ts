import { ContentstorageLoader, createContentstorageLoader } from '../loader';

// Mock fetch globally
global.fetch = jest.fn();

describe('ContentstorageLoader', () => {
  let loader: ContentstorageLoader;

  beforeEach(() => {
    loader = new ContentstorageLoader({ contentKey: 'test-key' });
    (global.fetch as jest.Mock).mockReset();
  });

  describe('loadTranslations', () => {
    it('should load translations from CDN', async () => {
      const mockTranslations = { greeting: 'Hello', farewell: 'Goodbye' };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTranslations,
      });

      const result = await loader.loadTranslations('en');

      expect(result).toEqual(mockTranslations);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://cdn.contentstorage.app/test-key/content/EN.json',
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
      );
    });

    it('should use uppercase language code', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await loader.loadTranslations('fr');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://cdn.contentstorage.app/test-key/content/FR.json',
        expect.any(Object)
      );
    });

    it('should cache translations', async () => {
      const mockTranslations = { greeting: 'Hello' };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTranslations,
      });

      // First call
      await loader.loadTranslations('en');
      // Second call (should use cache)
      const result = await loader.loadTranslations('en');

      expect(result).toEqual(mockTranslations);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on fetch error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(loader.loadTranslations('en')).rejects.toThrow(
        'Failed to load translations: 404 Not Found'
      );
    });

    it('should throw if no contentKey and no loadPath', async () => {
      const loaderNoKey = new ContentstorageLoader({});

      await expect(loaderNoKey.loadTranslations('en')).rejects.toThrow(
        'contentKey is required'
      );
    });
  });

  describe('custom loadPath', () => {
    it('should use custom loadPath string', async () => {
      const customLoader = new ContentstorageLoader({
        loadPath: '/locales/{{lng}}.json',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await customLoader.loadTranslations('en');

      expect(global.fetch).toHaveBeenCalledWith('/locales/en.json', expect.any(Object));
    });

    it('should use custom loadPath function', async () => {
      const customLoader = new ContentstorageLoader({
        loadPath: (lng) => `https://api.example.com/translations/${lng}`,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await customLoader.loadTranslations('es');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/translations/es',
        expect.any(Object)
      );
    });
  });

  describe('custom request', () => {
    it('should use custom request function', async () => {
      const customRequest = jest.fn().mockResolvedValue({ custom: 'data' });

      const customLoader = new ContentstorageLoader({
        contentKey: 'test-key',
        request: customRequest,
      });

      const result = await customLoader.loadTranslations('en');

      expect(customRequest).toHaveBeenCalled();
      expect(result).toEqual({ custom: 'data' });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ greeting: 'Hello' }),
      });

      // Populate cache
      await loader.loadTranslations('en');
      await loader.loadTranslations('es');
    });

    it('should check if language is cached', () => {
      expect(loader.isCached('en')).toBe(true);
      expect(loader.isCached('fr')).toBe(false);
    });

    it('should get cached languages', () => {
      const cached = loader.getCachedLanguages();

      expect(cached).toContain('en');
      expect(cached).toContain('es');
      expect(cached.length).toBe(2);
    });

    it('should clear cache for specific language', () => {
      loader.clearCache('en');

      expect(loader.isCached('en')).toBe(false);
      expect(loader.isCached('es')).toBe(true);
    });

    it('should clear entire cache', () => {
      loader.clearCache();

      expect(loader.isCached('en')).toBe(false);
      expect(loader.isCached('es')).toBe(false);
    });
  });

  describe('createContentstorageLoader', () => {
    it('should create a loader instance', () => {
      const newLoader = createContentstorageLoader({ contentKey: 'my-key' });

      expect(newLoader).toBeInstanceOf(ContentstorageLoader);
    });
  });
});
