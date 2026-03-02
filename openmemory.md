# Open Memory

## Architecture and Patterns

### Theming

- **Dark Mode Colors**: the dark theme uses dynamically generated colors via mappings in `packages/design-system/src/stitches.config.ts`. If new colors or variant colors (like `backgroundInfoNotification`) are introduced, they often need an explicit override rule added to that file to display correctly in dark mode.
