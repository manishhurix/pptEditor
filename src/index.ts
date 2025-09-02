// Core classes
export { PPTXEditor as PPTXEditorCore } from './core/PPTXEditor';
export { PPTXParser } from './core/PPTXParser';
export { PPTXExporter } from './core/PPTXExporter';
export { ChangeTracker } from './core/ChangeTracker';

// React components
export { PPTXEditor } from './components/PPTXEditor';
export { SlideRenderer } from './components/SlideRenderer';

// Types
export * from './types';

// Default export for the main editor
export { PPTXEditor as default } from './components/PPTXEditor';
