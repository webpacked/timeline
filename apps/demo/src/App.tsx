/**
 * Demo — imports the full DaVinci editor from @timeline/ui.
 *
 * The entire 1600+ line single-file implementation is now a clean
 * library component. This file exists only to provide the engine
 * singleton and mount the editor.
 */
import { DaVinciEditor } from '@timeline/ui';
import '@timeline/ui/styles/davinci';
import { engine, setEnginePixelsPerFrame, setOnZoomChange } from './engine';

export function App() {
  return (
    <DaVinciEditor
      engine={engine}
      onPpfChange={setEnginePixelsPerFrame}
      registerZoomHandler={setOnZoomChange}
      style={{ height: '100vh' }}
    />
  );
}
