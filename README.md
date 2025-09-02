# PPTX Editor SDK

A powerful web-based SDK for editing PowerPoint (PPTX) files with real-time preview and editing capabilities.

## 🚀 Features

- **PPTX Parsing**: Parse and load PowerPoint files using Open XML structure
- **Real-time Rendering**: View slides with accurate MS Office-like rendering
- **Interactive Editing**: Edit text, shapes, and images directly on slides
- **Z-Index Control**: Manual control over element layering and positioning
- **Smart Centering**: Automatic content scaling and centering for optimal viewing
- **Image Support**: Full support for PNG, JPG, GIF images with proper resolution
- **Change Tracking**: Built-in undo/redo system for all modifications
- **Export Functionality**: Export edited presentations back to PPTX format

## 🏗️ Architecture

The SDK is built with a modular architecture:

- **Core Parser** (`PPTXParser.ts`): Handles PPTX file parsing and element extraction
- **Editor Engine** (`PPTXEditor.ts`): Main editing logic and state management
- **Change Tracker** (`ChangeTracker.ts`): Manages edit history and undo/redo
- **Slide Renderer** (`SlideRenderer.tsx`): Canvas-based slide rendering with interaction
- **Properties Panel** (`PPTXEditor.tsx`): UI for editing element properties

## 🛠️ Technology Stack

- **TypeScript**: Full type safety and modern JavaScript features
- **React**: Component-based UI architecture
- **Canvas API**: High-performance slide rendering
- **JSZip**: PPTX file handling and manipulation
- **Rollup**: Modern module bundling for the SDK
- **Vite**: Fast development server for the demo app

## 📦 Installation

```bash
npm install
```

## 🔧 Development

### Build the SDK
```bash
npm run build
```

### Start Demo App
```bash
cd demo
npm run dev
```

### Run Tests
```bash
npm test
```

## 🎯 Usage

### Basic Integration

```typescript
import { PPTXEditor } from 'pptx-editor-sdk';

const editor = new PPTXEditor();

// Load a PPTX file
const file = await fetch('presentation.pptx');
const pptxData = await file.arrayBuffer();
await editor.loadPPTX(pptxData);

// Get slide data
const slides = editor.getSlides();
console.log(`Loaded ${slides.length} slides`);
```

### Advanced Features

```typescript
// Edit element properties
editor.updateElement('element-id', {
  position: { x: 100, y: 200 },
  size: { width: 300, height: 150 }
});

// Control z-index layering
editor.bringElementToFront('element-id');
editor.sendElementToBack('element-id');

// Export modified presentation
const modifiedPPTX = await editor.exportPPTX();
```

## 🎨 Demo Application

The repository includes a full-featured demo application showcasing all SDK capabilities:

- **File Upload**: Drag & drop PPTX files
- **Slide Navigation**: Browse through all slides
- **Interactive Editing**: Click elements to edit properties
- **Z-Index Controls**: Front/Back buttons for layering
- **Real-time Preview**: See changes immediately
- **Export Functionality**: Download modified presentations

## 🔍 Key Components

### PPTX Parser
- Parses Open XML structure
- Extracts slides, elements, and metadata
- Handles image relationships and data
- Preserves original z-index ordering

### Slide Renderer
- Canvas-based rendering for performance
- Accurate coordinate conversion (EMU → Points → Pixels)
- Interactive element selection
- Hover effects and visual feedback

### Properties Panel
- Element information display
- Position and size editing
- Z-index controls
- Style customization

## 📐 Coordinate System

The SDK uses PowerPoint's native coordinate system:
- **EMU (English Metric Units)**: Internal PPTX format
- **Points**: 1/72 inch (PowerPoint standard)
- **Pixels**: 96 DPI (web standard)

Automatic conversion ensures accurate rendering across different screen densities.

## 🎯 Z-Index Management

PowerPoint's layering system is preserved:
- **Automatic**: Elements maintain original z-index order
- **Manual**: Front/Back buttons for immediate adjustments
- **Visual**: Clear indication of element hierarchy

## 🖼️ Image Support

Full image format support:
- **PNG**: Lossless compression
- **JPEG**: Photographic content
- **GIF**: Animated graphics
- **Base64**: Inline data URLs for web compatibility

## 🔄 Change Tracking

Built-in version control:
- **Undo/Redo**: Step-by-step change reversal
- **Change History**: Complete modification log
- **State Management**: Consistent application state

## 📱 Browser Compatibility

- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+
- **ES6+ Support**: Arrow functions, async/await, destructuring
- **Canvas API**: Full HTML5 Canvas support
- **File API**: Modern file handling capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Check the demo application for examples
- Review the TypeScript interfaces for API details

## 🚀 Roadmap

- [ ] Advanced shape editing
- [ ] Text formatting controls
- [ ] Animation support
- [ ] Collaboration features
- [ ] Mobile optimization
- [ ] Plugin system

---

Built with ❤️ for the PowerPoint editing community
