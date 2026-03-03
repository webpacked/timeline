# @timeline/ui

Installable UI components for timeline infrastructure.

## Installation

```bash
npm install @timeline/ui @timeline/core @timeline/react
```

### Requirements

This package requires Tailwind CSS to be installed and configured in your project:

```bash
npm install -D tailwindcss
```

## Tailwind CSS Setup

The timeline UI components use Tailwind CSS utility classes. You need to configure Tailwind in your project:

### 1. Use the provided preset (Recommended)

Create or update your `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [
    require('@timeline/ui/tailwind.config.js')
  ],
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@timeline/ui/dist/**/*.{js,ts,jsx,tsx}',
  ],
  // ... your custom theme extensions
}
```

### 2. Manual setup

Alternatively, ensure your Tailwind config includes the timeline UI package in the content array:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@timeline/ui/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // The UI components primarily use the zinc color palette
    },
  },
}
```

### 3. Import Tailwind styles

Make sure to import Tailwind's base styles in your main CSS file:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Components

- `Timeline` - Root timeline container with built-in UI state management
- `Track` - Single track row
- `Clip` - Individual clip block
- `TimeRuler` - Timeline ruler with frame markers

## Usage

```tsx
import { Timeline } from "@timeline/ui";
import { TimelineProvider } from "@timeline/react";
import { TimelineEngine } from "@timeline/core";

// Create your timeline engine
const engine = new TimelineEngine(initialState);

function App() {
  return (
    <TimelineProvider engine={engine}>
      <Timeline 
        initialZoom={2}
        initialSnappingEnabled={true}
      />
    </TimelineProvider>
  );
}
```

## UI State Management

The `Timeline` component includes built-in UI state management via `TimelineUIContext`. You can access and control the UI state from external components:

```tsx
import { useTimelineUI } from "@timeline/ui";

function CustomTransportBar() {
  const { state, actions } = useTimelineUI();
  
  return (
    <div>
      <button onClick={() => actions.setPlayhead(frame(0))}>
        Go to Start
      </button>
      <span>Playhead: {state.playhead}</span>
      <span>Zoom: {state.zoom}x</span>
    </div>
  );
}
```

## Styling

Components use Tailwind CSS classes. You can override styles via the `className` prop:

```tsx
<Timeline className="border-2 border-blue-500" />
```

## License

MIT
