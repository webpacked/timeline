# @timeline/ui

Installable UI components for timeline infrastructure.

## Installation

```bash
npm install @timeline/ui
```

## Components

- `Timeline` - Root timeline container
- `Track` - Single track row
- `Clip` - Individual clip block
- `TimeRuler` - Timeline ruler with frame markers

## Usage

```tsx
import { Timeline } from "@timeline/ui";
import { TimelineProvider } from "@timeline/react";

function App() {
  return (
    <TimelineProvider engine={engine}>
      <Timeline />
    </TimelineProvider>
  );
}
```

## Styling

Components use Tailwind CSS classes. You can override styles via the `className` prop.

## License

MIT
