import React, { useRef, useEffect, useState } from 'react';
import { PPTXSlide, SlideElement, Position } from '../types';

interface SlideRendererProps {
    slide: PPTXSlide;
    selectedElement?: string;
    onElementSelect: (elementId: string) => void;
    onElementUpdate: (elementId: string, updates: Partial<SlideElement>) => void;
    onElementDelete: (elementId: string) => void;
    scale?: number;
}

export const SlideRenderer: React.FC<SlideRendererProps> = ({
    slide,
    selectedElement,
    onElementSelect,
    onElementUpdate,
    onElementDelete,
    scale = 1
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<Position | null>(null);
    const [editingElement, setEditingElement] = useState<string | null>(null);
    const [fitScale, setFitScale] = useState(1);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);
    const [hoveredElement, setHoveredElement] = useState<string | null>(null);

    // Use standard PowerPoint slide dimensions (16:9 aspect ratio)
    // PowerPoint default: 13.33" x 7.5" = 800 x 450 pixels (scaled down for better fit)
    const slideWidth = 800 * scale;
    const slideHeight = 450 * scale;

    useEffect(() => {
        console.log('SlideRenderer: useEffect triggered, slide:', slide);
        console.log('SlideRenderer: slide.elements:', slide.elements);
        renderSlide();
    }, [slide, scale, selectedElement, hoveredElement]);

    // Additional effect to re-render when fitScale changes
    useEffect(() => {
        if (fitScale !== 1) {
            console.log('SlideRenderer: fitScale changed, re-rendering slide');
            renderSlide();
        }
    }, [fitScale]);

    const renderSlide = () => {
        console.log('SlideRenderer: renderSlide called');
        const canvas = canvasRef.current;
        if (!canvas) {
            console.log('SlideRenderer: No canvas found');
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.log('SlideRenderer: No canvas context found');
            return;
        }

        console.log('SlideRenderer: Canvas size:', slideWidth, 'x', slideHeight);

        // Clear canvas
        ctx.clearRect(0, 0, slideWidth, slideHeight);

        // Set background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slideWidth, slideHeight);

        // Add a border to make the canvas visible
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, slideWidth, slideHeight);

        // Calculate content bounds to center the slide content
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (slide.elements && slide.elements.length > 0) {
            slide.elements.forEach(element => {
                if (element.position && element.size) {
                    const POINTS_TO_PIXELS = 96 / 72;
                    const x = (element.position.x || 0) * POINTS_TO_PIXELS;
                    const y = (element.position.y || 0) * POINTS_TO_PIXELS;
                    const width = (element.size.width || 0) * POINTS_TO_PIXELS;
                    const height = (element.size.height || 0) * POINTS_TO_PIXELS;

                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x + width);
                    maxY = Math.max(maxY, y + height);
                }
            });
        }

        // Calculate offset to center content, but ensure it fits within canvas bounds
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        // Add some padding to ensure content doesn't touch the edges
        const padding = 20;
        const targetWidth = slideWidth - (padding * 2);
        const targetHeight = slideHeight - (padding * 2);

        // Calculate scale to fit content within canvas bounds
        let scaleX = 1, scaleY = 1;
        if (contentWidth > targetWidth) {
            scaleX = targetWidth / contentWidth;
        }
        if (contentHeight > targetHeight) {
            scaleY = targetHeight / contentHeight;
        }

        // Use the smaller scale to maintain aspect ratio
        const fitScale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down if needed

        // Calculate offset to center the scaled content
        const scaledContentWidth = contentWidth * fitScale;
        const scaledContentHeight = contentHeight * fitScale;
        const calculatedOffsetX = (slideWidth - scaledContentWidth) / 2 - (minX * fitScale);
        const calculatedOffsetY = (slideHeight - scaledContentHeight) / 2 - (minY * fitScale);

        // Update the state variables for future renders
        setFitScale(fitScale);
        setOffsetX(calculatedOffsetX);
        setOffsetY(calculatedOffsetY);

        console.log('SlideRenderer: Content bounds:', { minX, minY, maxX, maxY, contentWidth, contentHeight });
        console.log('SlideRenderer: Fit scale:', fitScale);
        console.log('SlideRenderer: Centering offset:', { offsetX, offsetY });

        // Render slide elements in their z-index order
        if (slide.elements) {
            console.log('SlideRenderer: Rendering', slide.elements.length, 'elements in z-index order');

            // Sort elements by z-index to ensure proper layering
            const sortedElements = [...slide.elements].sort((a, b) => {
                const zIndexA = (a as any).zIndex || 0;
                const zIndexB = (b as any).zIndex || 0;
                return zIndexA - zIndexB;
            });

            // Render elements in z-index order (lowest z-index first = background, highest last = foreground)
            sortedElements.forEach((element, index) => {
                if (element) {
                    // Only log elements with [object Object] text
                    if (element.content?.text && element.content.text.includes('[object Object]')) {
                        console.log(`SlideRenderer: Element ${index} has [object Object] text:`, element.content.text);
                    }
                    renderElement(ctx, element, calculatedOffsetX, calculatedOffsetY, fitScale);
                }
            });
        } else {
            console.log('SlideRenderer: No elements to render');
        }
    };

    const renderElement = (ctx: CanvasRenderingContext2D, element: SlideElement, offsetX: number = 0, offsetY: number = 0, fitScale: number = 1) => {
        console.log('SlideRenderer: renderElement called for:', element);
        if (!element || !element.position || !element.size) {
            console.log('SlideRenderer: Element missing position or size:', element);
            return;
        }

        const isSelected = selectedElement === element.id;

        // Apply scale and convert from PPTX points to pixels
        // 1 point = 1/72 inch, 1 inch = 96 pixels (web standard)
        const POINTS_TO_PIXELS = 96 / 72; // Convert points to pixels

        const x = (element.position.x || 0) * POINTS_TO_PIXELS * scale * fitScale + offsetX;
        const y = (element.position.y || 0) * POINTS_TO_PIXELS * scale * fitScale + offsetY;
        const width = (element.size.width || 0) * POINTS_TO_PIXELS * scale * fitScale;
        const height = (element.size.height || 0) * POINTS_TO_PIXELS * scale * fitScale;

        console.log(`SlideRenderer: Element ${element.type} at (${x}, ${y}) size ${width}x${height}`);
        console.log(`SlideRenderer: Original coords: (${element.position.x}, ${element.position.y}) size ${element.size.width}x${element.size.height}`);
        console.log(`SlideRenderer: Scale: ${scale}, POINTS_TO_PIXELS: ${96 / 72}`);

        // Set styles for selection and hover (only when needed)
        if (isSelected) {
            ctx.strokeStyle = '#007bff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
        } else if (hoveredElement === element.id) {
            // Show hover effect
            ctx.strokeStyle = 'rgba(0, 123, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
        }
        // No default borders on all elements - let the actual PPTX styling show through

        switch (element.type) {
            case 'text':
                renderTextElement(ctx, element, x, y, width, height);
                break;
            case 'image':
                renderImageElement(ctx, element, x, y, width, height);
                break;
            case 'shape':
                renderShapeElement(ctx, element, x, y, width, height);
                break;
        }

        // Draw selection border
        if (isSelected) {
            ctx.strokeRect(x, y, width, height);
        }
    };

    const renderTextElement = (
        ctx: CanvasRenderingContext2D,
        element: SlideElement,
        x: number,
        y: number,
        width: number,
        height: number
    ) => {
        const text = element.content.text || '';
        const style = element.style || {};

        // Use actual text color from PPTX, fallback to black only if absolutely necessary
        const textColor = style.color || '#000000';
        ctx.fillStyle = textColor;

        // Debug: Log the color being used
        console.log(`SlideRenderer: Text color for "${text}":`, {
            originalColor: style.color,
            appliedColor: textColor,
            fallbackUsed: !style.color
        });

        // Use actual font properties from PPTX
        const fontSize = style.fontSize || 14;
        const fontFamily = style.fontFamily || 'Arial';
        const fontWeight = style.fontWeight || 'normal';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

        // Use actual text alignment from PPTX instead of hardcoded center
        const alignment = style.alignment || 'left';
        ctx.textAlign = alignment;
        ctx.textBaseline = 'top'; // Use top baseline for more accurate positioning

        console.log(`SlideRenderer: Rendering text "${text}" with color ${textColor}, alignment ${alignment}, font ${fontWeight} ${fontSize}px ${fontFamily} at (${x}, ${y})`);

        // Calculate text position based on alignment
        let textX: number;
        let textY: number;

        switch (alignment) {
            case 'left':
                textX = x + 5; // Small left margin
                break;
            case 'center':
                textX = x + width / 2;
                break;
            case 'right':
                textX = x + width - 5; // Small right margin
                break;
            default:
                textX = x + 5;
        }

        // Start text from top with small top margin
        textY = y + 5;

        // Handle text wrapping for multi-line text
        const lines = text.split('\n');
        const lineHeight = fontSize * 1.2;

        // Calculate total text height and center vertically if there's space
        const totalTextHeight = lines.length * lineHeight;
        if (totalTextHeight < height - 10) { // If text is shorter than container
            textY = y + (height - totalTextHeight) / 2; // Center vertically
        }

        lines.forEach((line: string, index: number) => {
            const lineY = textY + index * lineHeight;

            // Handle long lines by wrapping
            if (ctx.measureText(line).width > width * 0.9) {
                // Simple word wrapping
                const words = line.split(' ');
                let currentLine = '';
                let currentY = lineY;

                words.forEach((word: string) => {
                    const testLine = currentLine + word + ' ';
                    if (ctx.measureText(testLine).width > width * 0.9 && currentLine) {
                        ctx.fillText(currentLine.trim(), textX, currentY);
                        currentLine = word + ' ';
                        currentY += lineHeight;
                    } else {
                        currentLine = testLine;
                    }
                });

                if (currentLine.trim()) {
                    ctx.fillText(currentLine.trim(), textX, currentY);
                }
            } else {
                ctx.fillText(line, textX, lineY);
            }
        });
    };

    const renderImageElement = (
        ctx: CanvasRenderingContext2D,
        element: SlideElement,
        x: number,
        y: number,
        width: number,
        height: number
    ) => {
        console.log('SlideRenderer: renderImageElement called for:', element.content);

        // Try to get image data URL first (actual image content)
        const imageDataUrl = (element.content as any).imageDataUrl;
        const imagePath = (element.content as any).imagePath;
        const imageId = (element.content as any).imageId;

        if (imageDataUrl) {
            // We have actual image data! Load and render it
            console.log('SlideRenderer: Loading actual image from data URL');
            const img = new Image();
            img.onload = () => {
                // Clear the area first
                ctx.clearRect(x, y, width, height);
                // Draw the actual image
                ctx.drawImage(img, x, y, width, height);
            };
            img.onerror = () => {
                console.warn('SlideRenderer: Failed to load image from data URL');
                drawImagePlaceholder(ctx, x, y, width, height, imageId || 'Unknown');
            };
            img.src = imageDataUrl;
            return;
        }

        if (!imagePath && !imageId) {
            console.warn('SlideRenderer: No image data found for image element');
            drawImagePlaceholder(ctx, x, y, width, height, 'No Data');
            return;
        }

        // If we have a path but no data, show a loading placeholder
        console.log('SlideRenderer: Image data not yet loaded, showing placeholder');
        drawImagePlaceholder(ctx, x, y, width, height, `Loading: ${imageId || 'Unknown'}`);
    };

    const drawImagePlaceholder = (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        label: string
    ) => {
        // Draw placeholder rectangle with minimal styling
        ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        // Add placeholder text with neutral color
        ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + width / 2, y + height / 2);
    };

    const renderShapeElement = (
        ctx: CanvasRenderingContext2D,
        element: SlideElement,
        x: number,
        y: number,
        width: number,
        height: number
    ) => {
        console.log(`SlideRenderer: renderShapeElement called for ${element.type}`);
        const style = element.style || {};
        console.log('SlideRenderer: Shape style:', style);
        console.log('SlideRenderer: Shape content:', element.content);

        // Only render background if it has a color from PPTX
        if (style.backgroundColor) {
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(x, y, width, height);
        }
        // No hardcoded fallback colors - let it be transparent if no color specified

        // Only render border if it has properties from PPTX
        if (style.borderColor && style.borderWidth) {
            ctx.strokeStyle = style.borderColor;
            ctx.lineWidth = style.borderWidth;
            ctx.strokeRect(x, y, width, height);
        }
        // No hardcoded fallback borders

        // Text content - render text INSIDE the shape
        if (element.content.text && element.content.text.trim()) {
            console.log('SlideRenderer: Rendering text inside shape:', element.content.text);
            renderTextElement(ctx, element, x, y, width, height);
        }
    };



    const handleMouseDown = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Convert mouse coordinates to canvas coordinates
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert canvas coordinates back to PPTX coordinates
        const POINTS_TO_PIXELS = 96 / 72;
        const pptxX = (mouseX - offsetX) / (POINTS_TO_PIXELS * fitScale);
        const pptxY = (mouseY - offsetY) / (POINTS_TO_PIXELS * fitScale);

        // Find clicked element using PPTX coordinates
        const clickedElement = slide.elements.find(element => {
            const elementX = element.position.x || 0;
            const elementY = element.position.y || 0;
            const elementWidth = element.size.width || 0;
            const elementHeight = element.size.height || 0;

            return (
                pptxX >= elementX &&
                pptxX <= elementX + elementWidth &&
                pptxY >= elementY &&
                pptxY <= elementY + elementHeight
            );
        });

        if (clickedElement) {
            console.log('SlideRenderer: Element clicked:', clickedElement.id, 'at PPTX coords:', { pptxX, pptxY });
            onElementSelect(clickedElement.id);
            setIsDragging(true);
            setDragStart({ x: pptxX - clickedElement.position.x, y: pptxY - clickedElement.position.y });
        } else {
            console.log('SlideRenderer: No element clicked at PPTX coords:', { pptxX, pptxY });
            onElementSelect('');
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Handle dragging if we're in drag mode
        if (isDragging && dragStart && selectedElement) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const x = (e.clientX - rect.left) / scale - dragStart.x;
            const y = (e.clientY - rect.top) / scale - dragStart.y;

            onElementUpdate(selectedElement, {
                position: { x, y }
            });
            return;
        }

        // Handle hover detection
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Convert mouse coordinates to canvas coordinates
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert canvas coordinates back to PPTX coordinates
        const POINTS_TO_PIXELS = 96 / 72;
        const pptxX = (mouseX - offsetX) / (POINTS_TO_PIXELS * fitScale);
        const pptxY = (mouseY - offsetY) / (POINTS_TO_PIXELS * fitScale);

        // Find hovered element using PPTX coordinates
        const hoveredElement = slide.elements.find(element => {
            const elementX = element.position.x || 0;
            const elementY = element.position.y || 0;
            const elementWidth = element.size.width || 0;
            const elementHeight = element.size.height || 0;

            return (
                pptxX >= elementX &&
                pptxX <= elementX + elementWidth &&
                pptxY >= elementY &&
                pptxY <= elementY + elementHeight
            );
        });

        if (hoveredElement) {
            setHoveredElement(hoveredElement.id);
        } else {
            setHoveredElement(null);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragStart(null);
    };

    const handleDoubleClick = (_e: React.MouseEvent) => {
        if (!selectedElement) return;

        const element = slide.elements.find(e => e.id === selectedElement);
        if (element?.type === 'text') {
            setEditingElement(selectedElement);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Delete' && selectedElement) {
            onElementDelete(selectedElement);
        }
    };

    return (
        <div className="slide-renderer">
            <canvas
                ref={canvasRef}
                width={slideWidth}
                height={slideHeight}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setHoveredElement(null)}
                onDoubleClick={handleDoubleClick}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                style={{
                    border: '1px solid #ccc',
                    cursor: isDragging ? 'grabbing' : (hoveredElement ? 'pointer' : 'default')
                }}
            />

            {editingElement && (() => {
                const element = slide.elements.find(e => e.id === editingElement);
                if (!element) return null;

                return (
                    <TextEditor
                        element={element}
                        onSave={(text) => {
                            onElementUpdate(editingElement, { content: { text } });
                            setEditingElement(null);
                        }}
                        onCancel={() => setEditingElement(null)}
                    />
                );
            })()}
        </div>
    );
};

interface TextEditorProps {
    element: SlideElement;
    onSave: (text: string) => void;
    onCancel: () => void;
}

const TextEditor: React.FC<TextEditorProps> = ({ element, onSave, onCancel }) => {
    const [text, setText] = useState(element?.content?.text || '');

    const handleSave = () => {
        onSave(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSave();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div
            className="text-editor"
            style={{
                position: 'absolute',
                left: element.position.x,
                top: element.position.y,
                zIndex: 1000
            }}
        >
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                    width: element.size.width,
                    height: element.size.height,
                    border: '2px solid #007bff',
                    padding: '4px',
                    fontSize: element.style?.fontSize || 14,
                    fontFamily: element.style?.fontFamily || 'Arial',
                    color: element.style?.color || '#000000',
                    resize: 'none'
                }}
                autoFocus
            />
            <div className="text-editor-controls">
                <button onClick={handleSave}>Save</button>
                <button onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
};
