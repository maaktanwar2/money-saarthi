import createCache from '@emotion/cache';

// Create Emotion cache with prepend: true so MUI styles load BEFORE Tailwind.
// This means Tailwind utility classes can override MUI defaults when needed.
const emotionCache = createCache({
  key: 'mui',
  prepend: true,
});

export default emotionCache;
