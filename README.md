# Contentstorage vue-i18n Plugin

Official vue-i18n plugin for [Contentstorage](https://contentstorage.app) live editor translation tracking.

## Features

- **Live Editor Integration** - Automatically detects and enables tracking when running in Contentstorage live editor
- **Translation Tracking** - Maps translation values to their keys for click-to-edit functionality
- **Zero Production Overhead** - Tracking only activates in live editor mode
- **TypeScript Support** - Full type definitions included
- **Memory Management** - Automatic cleanup of old entries to prevent memory leaks
- **CDN Loading** - Optional support for loading translations from CDN
- **Flexible Integration** - Works with both new and existing vue-i18n instances

## Installation

```bash
npm install @contentstorage/vue-i18n-plugin
```

## Quick Start

### Basic Usage

```typescript
import { createApp } from 'vue';
import { createContentstorageI18n } from '@contentstorage/vue-i18n-plugin';
import App from './App.vue';

const i18n = createContentstorageI18n({
  // ContentStorage options
  contentKey: 'your-content-key-here', // Get this from Contentstorage dashboard
  debug: false,

  // vue-i18n options
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      welcome: 'Welcome to our site',
      greeting: 'Hello {name}!',
    },
    es: {
      welcome: 'Bienvenido a nuestro sitio',
      greeting: 'Hola {name}!',
    },
  },
});

const app = createApp(App);
app.use(i18n);
app.mount('#app');

// Use translations as normal with useI18n() or $t()
// Live editor tracking is automatically enabled when in live editor mode!
```

### With CDN Loading

Load translations dynamically from ContentStorage CDN:

```typescript
import { createContentstorageI18n } from '@contentstorage/vue-i18n-plugin';

const i18n = createContentstorageI18n({
  contentKey: 'your-content-key',
  enableCdnLoading: true,
  preloadLanguages: ['en', 'es'], // Preload these languages on init
  locale: 'en',
});

app.use(i18n);

// Load additional languages on demand
await i18n.contentStorage.loadLanguage('fr');
```

### Attaching to Existing Instance

If you already have a vue-i18n instance:

```typescript
import { createI18n } from 'vue-i18n';
import { attachContentstorageTracker } from '@contentstorage/vue-i18n-plugin';

const i18n = createI18n({
  legacy: false, // Required for tracking support
  locale: 'en',
  messages: {
    en: { welcome: 'Welcome' },
  },
});

// Attach ContentStorage tracking
const tracker = attachContentstorageTracker(i18n, {
  contentKey: 'your-key',
  debug: true,
});

// Check if in live mode
if (tracker.inLiveMode) {
  console.log('Live editor mode active');
}
```

## Configuration Options

```typescript
interface ContentstorageVueI18nOptions {
  /**
   * Your Contentstorage content key (required for CDN loading)
   */
  contentKey?: string;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Maximum number of entries in memoryMap
   * @default 10000
   */
  maxMemoryMapSize?: number;

  /**
   * Custom path for loading translations
   * @example '{{lng}}.json'
   * @example (lng) => `https://my-cdn.com/${lng}.json`
   */
  loadPath?: string | ((language: string) => string);

  /**
   * Custom fetch implementation
   */
  request?: (url: string, options: RequestInit) => Promise<any>;

  /**
   * Query parameter name for live editor detection
   * @default 'contentstorage_live_editor'
   */
  liveEditorParam?: string;

  /**
   * Force live mode (useful for testing)
   * @default false
   */
  forceLiveMode?: boolean;

  /**
   * Custom URL for the live editor script
   * @default 'https://cdn.contentstorage.app/live-editor.js?contentstorage-live-editor=true'
   */
  customLiveEditorScriptUrl?: string;

  /**
   * Languages to preload from CDN on initialization
   */
  preloadLanguages?: string[];

  /**
   * Enable automatic translation loading from CDN
   * @default false
   */
  enableCdnLoading?: boolean;
}
```

## Advanced Usage

### Custom CDN URL

```typescript
const i18n = createContentstorageI18n({
  contentKey: 'your-key',
  loadPath: (lng) => `https://your-custom-cdn.com/translations/${lng}.json`,
  enableCdnLoading: true,
  locale: 'en',
});
```

### Custom Fetch with Authentication

```typescript
const i18n = createContentstorageI18n({
  contentKey: 'your-key',
  enableCdnLoading: true,
  request: async (url, options) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: 'Bearer YOUR_TOKEN',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  },
  locale: 'en',
});
```

### Manual Translation Tracking

When loading translations from custom sources:

```typescript
const i18n = createContentstorageI18n({
  forceLiveMode: true,
  locale: 'en',
});

// Load translations from your own source
const customTranslations = await fetchMyTranslations('de');

// Set them in vue-i18n
i18n.global.setLocaleMessage('de', customTranslations);

// Track them for live editor
i18n.contentStorage.trackMessages(customTranslations, 'de');
```

### Enable Debug Mode

```typescript
const i18n = createContentstorageI18n({
  contentKey: 'your-key',
  debug: true,
  locale: 'en',
  messages: { en: { welcome: 'Welcome' } },
});

// Console output:
// [ContentStorage] Live editor mode enabled
// [ContentStorage] Tracker attached to vue-i18n instance
// [ContentStorage] Tracked 1 initial translations for en
```

## How It Works

### Live Editor Detection

The plugin automatically detects when your app is running in the Contentstorage live editor by checking:

1. The app is running in an iframe (`window.self !== window.top`)
2. The URL contains the query parameter `?contentstorage_live_editor=true`

Both conditions must be true for tracking to activate.

### Translation Tracking

When in live editor mode, the plugin:

1. Sets up a `postTranslation` handler in vue-i18n
2. Intercepts each translation call
3. Retrieves the template (with `{placeholders}`) from the message store
4. Tracks it in the global `window.memoryMap`

```typescript
window.memoryMap = new Map([
  ["Welcome to our site", {
    ids: Set(["welcome"]),
    type: "text",
    metadata: {
      language: "en",
      trackedAt: 1704067200000
    }
  }],
  ["Hello {name}!", {
    ids: Set(["greeting"]),
    type: "text",
    metadata: {
      language: "en",
      trackedAt: 1704067200001
    }
  }],
]);
```

This allows the Contentstorage live editor to:
1. Find which translation keys produced a given text
2. Enable click-to-edit functionality
3. Highlight translatable content on the page

### Memory Management

The plugin automatically limits the size of `window.memoryMap` to prevent memory leaks:

- Default limit: 10,000 entries
- Oldest entries are removed first (based on `trackedAt` timestamp)
- Configurable via `maxMemoryMapSize` option

## Usage with Vue 3 Composition API

```typescript
// main.ts
import { createApp } from 'vue';
import { createContentstorageI18n } from '@contentstorage/vue-i18n-plugin';
import App from './App.vue';

const i18n = createContentstorageI18n({
  contentKey: 'your-key',
  locale: 'en',
  messages: {
    en: { welcome: 'Welcome', greeting: 'Hello {name}!' },
  },
});

createApp(App).use(i18n).mount('#app');
```

```vue
<!-- Component.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <h1>{{ t('welcome') }}</h1>
  <p>{{ t('greeting', { name: 'John' }) }}</p>
</template>
```

## Testing

### Force Live Mode

For testing purposes, you can force live mode:

```typescript
const i18n = createContentstorageI18n({
  forceLiveMode: true, // Always enable tracking
  locale: 'en',
  messages: { en: { test: 'Test' } },
});
```

### Debug Memory Map

```typescript
import { debugMemoryMap } from '@contentstorage/vue-i18n-plugin';

// In browser console or your code
debugMemoryMap();

// Output:
// [ContentStorage] Memory map contents:
// Total entries: 42
// ┌─────────┬──────────────────────────────┬─────────────────────┐
// │ (index) │ value                        │ keys                │
// │ language                                                     │
// ├─────────┼──────────────────────────────┼─────────────────────┤
// │    0    │ 'Welcome to our site'        │ 'welcome'           │
// │ 'en'                                                         │
// └─────────┴──────────────────────────────┴─────────────────────┘
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Vue 3.0+
- vue-i18n 9.0+

## TypeScript

Full TypeScript support included:

```typescript
import type {
  ContentstorageVueI18nOptions,
  CreateContentstorageI18nOptions,
  MemoryMap,
  MemoryMapEntry,
  ContentstorageWindow,
} from '@contentstorage/vue-i18n-plugin';
```

## Performance

- **Zero overhead in production** - Tracking only happens in live editor mode
- **Minimal overhead in editor** - Simple Map operations, ~1ms per translation
- **Automatic cleanup** - Old entries removed to prevent memory leaks
- **Efficient template lookup** - Templates retrieved from vue-i18n's message store

## Troubleshooting

### memoryMap is empty

**Problem**: `window.memoryMap` exists but has no entries.

**Solutions**:
- Verify you're in an iframe: `window.self !== window.top`
- Check URL has `?contentstorage_live_editor=true`
- Enable debug mode to see what's being tracked
- Ensure vue-i18n is using composition mode (`legacy: false`)

### Live editor can't find translations

**Problem**: Clicking on translated text doesn't work in live editor.

**Solutions**:
- Verify translation values match rendered text
- Check that tracking happens before DOM renders
- Enable debug mode and check console logs

### TypeScript errors

**Problem**: TypeScript can't find type definitions.

**Solutions**:
- Ensure vue-i18n types are installed
- Check `tsconfig.json` has `"esModuleInterop": true`

### CORS errors

**Problem**: Cannot load translations from CDN.

**Solutions**:
- Verify your contentKey is correct
- Check CDN URL in network tab
- Use custom `request` function to debug

## API Reference

### createContentstorageI18n(options)

Creates a vue-i18n instance with ContentStorage integration.

**Returns**: `ContentstorageI18n` - Extended I18n instance with `contentStorage` utilities

### attachContentstorageTracker(i18n, options)

Attaches tracking to an existing vue-i18n instance.

**Returns**: `ContentstorageTracker` - The tracker instance

### ContentstorageI18n.contentStorage

- `loadLanguage(language: string): Promise<void>` - Load translations from CDN
- `trackMessages(messages: object, language: string): void` - Manually track translations
- `isLiveMode: boolean` - Whether live editor mode is active
- `tracker: ContentstorageTracker` - The underlying tracker
- `loader: ContentstorageLoader | null` - The CDN loader (if enabled)

### Utility Exports

- `debugMemoryMap()` - Log memory map contents
- `loadLiveEditorScript()` - Manually load the live editor script
- `setCurrentLanguageCode(code)` - Set active language
- `getCurrentLanguageCode()` - Get active language
- `detectLiveEditorMode()` - Check if in live editor
- `getMemoryMap()` - Get the memory map directly

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Documentation: https://docs.contentstorage.app
- Issues: https://github.com/contentstorage/vue-i18n-plugin/issues
- Email: support@contentstorage.app
