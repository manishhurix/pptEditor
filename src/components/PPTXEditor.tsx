import React, { useState, useEffect } from 'react';
import { PPTXEditor as PPTXEditorCore } from '../core/PPTXEditor';
import { PPTXDocument, SlideElement, EditorOptions } from '../types';
import { SlideRenderer } from './SlideRenderer';

interface PPTXEditorProps {
    file?: File;
    onExport?: (blob: Blob) => void;
    options?: EditorOptions;
}

export const PPTXEditor: React.FC<PPTXEditorProps> = ({
    file,
    onExport,
    options = {}
}) => {
    const [editor, setEditor] = useState<PPTXEditorCore | null>(null);
    const [document, setDocument] = useState<PPTXDocument | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [selectedElement, setSelectedElement] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (file) {
            loadPPTX(file);
        }
    }, [file]);

    const loadPPTX = async (file: File) => {
        try {
            setLoading(true);
            setError(null);

            console.log('Starting PPTX load for file:', file.name);
            const pptxEditor = new PPTXEditorCore(options);
            const doc = await pptxEditor.loadPPTX(file);
            console.log('PPTX loaded successfully - slides:', doc.slides?.length || 0);

            setEditor(pptxEditor);
            setDocument(doc);
            setCurrentSlide(0);
            setSelectedElement('');

            console.log('State updated - document:', doc, 'currentSlide:', 0);
        } catch (err) {
            console.error('Error loading PPTX:', err);
            setError(err instanceof Error ? err.message : 'Failed to load PPTX file');
        } finally {
            setLoading(false);
        }
    };

    const handleSlideChange = (slideNumber: number) => {
        if (editor) {
            editor.goToSlide(slideNumber);
            setCurrentSlide(slideNumber);
            setSelectedElement('');
        }
    };

    const handleElementSelect = (elementId: string) => {
        setSelectedElement(elementId);
        if (editor) {
            editor.selectElement(elementId);
        }
    };

    const handleElementUpdate = (elementId: string, updates: Partial<SlideElement>) => {
        if (!editor || !document) return;

        const slide = document.slides[currentSlide];
        if (!slide) return;

        const element = slide.elements.find(e => e.id === elementId);
        if (!element) return;

        // Apply updates
        Object.assign(element, updates);

        // Update specific properties through the editor
        if (updates.position) {
            editor.updateElementPosition(elementId, updates.position.x, updates.position.y);
        }
        if (updates.size) {
            editor.updateElementSize(elementId, updates.size.width, updates.size.height);
        }
        if (updates.content && 'text' in updates.content) {
            editor.updateText(elementId, updates.content.text);
        }
        if (updates.style) {
            editor.updateElementStyle(elementId, updates.style);
        }
    };

    const handleElementDelete = (elementId: string) => {
        if (editor) {
            editor.deleteElement(elementId);
            setSelectedElement('');
        }
    };

    const handleUndo = () => {
        if (editor && editor.undo()) {
            // Refresh the document state
            setDocument({ ...editor.getDocument()! });
        }
    };

    const handleRedo = () => {
        if (editor && editor.redo()) {
            // Refresh the document state
            setDocument({ ...editor.getDocument()! });
        }
    };

    const handleRevertAll = () => {
        if (editor) {
            editor.revertAllChanges();
            setDocument({ ...editor.getDocument()! });
            setSelectedElement('');
        }
    };

    const handleExport = async () => {
        if (!editor) return;

        try {
            setLoading(true);
            const blob = await editor.exportPPTX();
            onExport?.(blob);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to export PPTX');
        } finally {
            setLoading(false);
        }
    };

    const addTextElement = () => {
        if (!editor || !document) return;

        try {
            const elementId = editor.addTextElement('New Text', 100, 100, 200, 50);
            setDocument({ ...editor.getDocument()! });
            setSelectedElement(elementId);
        } catch (err) {
            setError('Failed to add text element');
        }
    };

    const addImageElement = () => {
        if (!editor || !document) return;

        // Create a file input for image selection
        const input = window.document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files[0]) {
                const file = target.files[0];
                const imageUrl = URL.createObjectURL(file);

                try {
                    const elementId = editor.addImageElement(imageUrl, 100, 100, 200, 150);
                    setDocument({ ...editor.getDocument()! });
                    setSelectedElement(elementId);
                } catch (err) {
                    setError('Failed to add image element');
                }
            }
        };
        input.click();
    };

    if (loading) {
        return (
            <div className="pptx-editor-loading">
                <div className="loading-spinner"></div>
                <p>Loading presentation...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="pptx-editor-error">
                <h3>Error</h3>
                <p>{error}</p>
                <button onClick={() => setError(null)}>Dismiss</button>
            </div>
        );
    }

    if (!document || !editor) {
        return (
            <div className="pptx-editor-empty">
                <h3>PPTX Editor</h3>
                <p>Please select a PPTX file to begin editing</p>
            </div>
        );
    }

    const currentSlideData = document.slides[currentSlide];
    console.log('Current slide data:', currentSlideData);
    console.log('Current slide index:', currentSlide);
    console.log('Document slides:', document.slides);
    const state = editor.getState();

    return (
        <div className="pptx-editor">
            {/* Toolbar */}
            <div className="editor-toolbar">
                <div className="toolbar-left">
                    <button onClick={handleUndo} disabled={!state.canUndo}>
                        Undo
                    </button>
                    <button onClick={handleRedo} disabled={!state.canRedo}>
                        Redo
                    </button>
                    <button onClick={handleRevertAll}>
                        Revert All
                    </button>
                </div>

                <div className="toolbar-center">
                    <button onClick={addTextElement}>Add Text</button>
                    <button onClick={addImageElement}>Add Image</button>
                </div>

                <div className="toolbar-right">
                    <button onClick={handleExport} className="export-btn">
                        Export PPTX
                    </button>
                </div>
            </div>

            <div className="editor-main">
                {/* Slide Navigator */}
                <div className="slide-navigator">
                    <h4>Slides</h4>
                    <div className="slide-thumbnails">
                        {document.slides.map((slide, index) => (
                            <div
                                key={slide.id}
                                className={`slide-thumbnail ${index === currentSlide ? 'active' : ''}`}
                                onClick={() => handleSlideChange(index)}
                            >
                                <span>{index + 1}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Slide Editor */}
                <div className="slide-editor">
                    {currentSlideData ? (
                        <SlideRenderer
                            slide={currentSlideData}
                            selectedElement={selectedElement}
                            onElementSelect={handleElementSelect}
                            onElementUpdate={handleElementUpdate}
                            onElementDelete={handleElementDelete}
                            scale={1}
                        />
                    ) : (
                        <div style={{
                            width: '800px',
                            height: '450px',
                            backgroundColor: '#f0f0f0',
                            border: '1px solid #ccc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <p>No slide data available</p>
                        </div>
                    )}
                </div>

                {/* Properties Panel */}
                <div className="properties-panel">
                    <h4>Properties</h4>
                    {selectedElement && currentSlideData && (() => {
                        const element = currentSlideData.elements.find(e => e.id === selectedElement);
                        return element ? (
                            <ElementProperties
                                element={element}
                                onUpdate={(updates) => handleElementUpdate(selectedElement, updates)}
                            />
                        ) : null;
                    })()}
                </div>
            </div>

            {/* Status Bar */}
            <div className="editor-status">
                <span>Slide {currentSlide + 1} of {document.slides.length}</span>
                <span>Changes: {state.changes.length}</span>
            </div>
        </div>
    );
};

interface ElementPropertiesProps {
    element: SlideElement;
    onUpdate: (updates: Partial<SlideElement>) => void;
}

const ElementProperties: React.FC<ElementPropertiesProps> = ({ element, onUpdate }) => {
    const updateStyle = (styleUpdates: Partial<SlideElement['style']>) => {
        onUpdate({ style: { ...element.style, ...styleUpdates } });
    };

    return (
        <div className="element-properties">
            <div className="property-group">
                <label>Position</label>
                <div className="property-inputs">
                    <input
                        type="number"
                        value={element.position.x}
                        onChange={(e) => onUpdate({ position: { ...element.position, x: parseFloat(e.target.value) } })}
                        placeholder="X"
                    />
                    <input
                        type="number"
                        value={element.position.y}
                        onChange={(e) => onUpdate({ position: { ...element.position, y: parseFloat(e.target.value) } })}
                        placeholder="Y"
                    />
                </div>
            </div>

            <div className="property-group">
                <label>Size</label>
                <div className="property-inputs">
                    <input
                        type="number"
                        value={element.size.width}
                        onChange={(e) => onUpdate({ size: { ...element.size, width: parseFloat(e.target.value) } })}
                        placeholder="Width"
                    />
                    <input
                        type="number"
                        value={element.size.height}
                        onChange={(e) => onUpdate({ size: { ...element.size, height: parseFloat(e.target.value) } })}
                        placeholder="Height"
                    />
                </div>
            </div>

            {element.type === 'text' && (
                <>
                    <div className="property-group">
                        <label>Font Size</label>
                        <input
                            type="number"
                            value={element.style?.fontSize || 14}
                            onChange={(e) => updateStyle({ fontSize: parseFloat(e.target.value) })}
                        />
                    </div>

                    <div className="property-group">
                        <label>Font Family</label>
                        <select
                            value={element.style?.fontFamily || 'Arial'}
                            onChange={(e) => updateStyle({ fontFamily: e.target.value })}
                        >
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Courier New">Courier New</option>
                            <option value="Verdana">Verdana</option>
                        </select>
                    </div>

                    <div className="property-group">
                        <label>Color</label>
                        <input
                            type="color"
                            value={element.style?.color || '#000000'}
                            onChange={(e) => updateStyle({ color: e.target.value })}
                        />
                    </div>
                </>
            )}

            {element.type === 'shape' && (
                <div className="property-group">
                    <label>Background Color</label>
                    <input
                        type="color"
                        value={element.style?.backgroundColor || '#ffffff'}
                        onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                    />
                </div>
            )}

            <div className="property-group">
                <label>Element Info</label>
                <div className="element-info">
                    <div><strong>ID:</strong> {element.id}</div>
                    <div><strong>Type:</strong> {element.type}</div>
                    <div><strong>Position:</strong> ({element.position.x}, {element.position.y})</div>
                    <div><strong>Size:</strong> {element.size.width} × {element.size.height}</div>
                </div>
            </div>

            <div className="property-group">
                <label>Z-Index Control</label>
                <div className="z-index-controls">
                    <button
                        className="z-index-btn"
                        onClick={() => {
                            // Bring element to front (increase z-index)
                            const currentZIndex = (element as any).zIndex || 0;
                            const newZIndex = currentZIndex + 1000;
                            (element as any).zIndex = newZIndex;
                            console.log(`Bringing element ${element.id} to front, new z-index: ${newZIndex}`);
                            onUpdate({ ...element });
                        }}
                        title="Bring to Front"
                    >
                        ↑ Front
                    </button>
                    <button
                        className="z-index-btn"
                        onClick={() => {
                            // Send element to back (decrease z-index)
                            const currentZIndex = (element as any).zIndex || 0;
                            const newZIndex = Math.max(0, currentZIndex - 1000);
                            (element as any).zIndex = newZIndex;
                            console.log(`Sending element ${element.id} to back, new z-index: ${newZIndex}`);
                            onUpdate({ ...element });
                        }}
                        title="Send to Back"
                    >
                        ↓ Back
                    </button>
                </div>
                <div className="z-index-info">
                    Current Z-Index: {(element as any).zIndex || 0}
                </div>
            </div>
        </div>
    );
};
