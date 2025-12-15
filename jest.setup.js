// Mock fetch globally
global.fetch = jest.fn();

// Mock window.location
Object.defineProperty(window, 'location', {
  writable: true,
  value: {
    search: '',
    href: 'http://localhost',
  },
});
