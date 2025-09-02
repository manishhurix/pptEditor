import { PPTXParser } from './PPTXParser';
import { PPTXExporter } from './PPTXExporter';
import { ChangeTracker } from './ChangeTracker';
import { PPTXDocument, PPTXSlide, SlideElement, EditorState, EditorOptions, ChangeRecord } from '../types';
import JSZip from 'jszip';

export class PPTXEditor {
    private parser: PPTXParser;
    private exporter: PPTXExporter | null = null;
    private changeTracker: ChangeTracker;
    private document: PPTXDocument | null = null;
    private originalZip: JSZip | null = null;
    private state: EditorState;
    private options: EditorOptions;

    constructor(options: EditorOptions = {}) {
        this.parser = new PPTXParser();
        this.changeTracker = new ChangeTracker(options.maxUndoSteps || 50);
        this.options = {
            enableUndoRedo: true,
            enableAutoSave: false,
            maxUndoSteps: 50,
            theme: 'light',
            showToolbar: true,
            showSlideNavigator: true,
            ...options
        };

        this.state = {
            currentSlide: 0,
            selectedElement: undefined,
            changes: [],
            canUndo: false,
            canRedo: false
        };
    }

    // Load and parse a PPTX file
    async loadPPTX(file: File | ArrayBuffer): Promise<PPTXDocument> {
        try {
            // Store the original ZIP for export
            if (file instanceof File) {
                const arrayBuffer = await file.arrayBuffer();
                this.originalZip = await JSZip.loadAsync(arrayBuffer);
            } else {
                this.originalZip = await JSZip.loadAsync(file);
            }

            // Parse the PPTX
            this.document = await this.parser.parsePPTX(file);

            // Initialize the exporter
            if (this.originalZip && this.document) {
                this.exporter = new PPTXExporter(this.originalZip, this.document);
            }

            // Reset change tracking
            this.changeTracker.clearHistory();
            this.updateState();

            return this.document;
        } catch (error) {
            console.error('Error loading PPTX:', error);
            throw new Error(`Failed to load PPTX: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Get the current document
    getDocument(): PPTXDocument | null {
        return this.document;
    }

    // Get the current state
    getState(): EditorState {
        return this.state;
    }

    // Navigate to a specific slide
    goToSlide(slideNumber: number): void {
        if (this.document && slideNumber >= 0 && slideNumber < this.document.slides.length) {
            this.state.currentSlide = slideNumber;
            this.state.selectedElement = undefined;
            this.updateState();
        }
    }

    // Get the current slide
    getCurrentSlide(): PPTXSlide | null {
        if (!this.document) return null;
        return this.document.slides[this.state.currentSlide] || null;
    }

    // Get all slides
    getSlides(): PPTXSlide[] {
        return this.document?.slides || [];
    }

    // Select an element
    selectElement(elementId: string): void {
        this.state.selectedElement = elementId;
        this.updateState();
    }

    // Deselect current element
    deselectElement(): void {
        this.state.selectedElement = undefined;
        this.updateState();
    }

    // Update text content
    updateText(elementId: string, newText: string): void {
        if (!this.document) return;

        const slide = this.getCurrentSlide();
        if (!slide) return;

        const element = slide.elements.find(e => e.id === elementId);
        if (!element || element.type !== 'text') return;

        const previousState = { ...element };
        element.content.text = newText;

        this.recordChange('update', elementId, slide.id, previousState, element, `Updated text: "${newText}"`);
    }

    // Update element position
    updateElementPosition(elementId: string, x: number, y: number): void {
        if (!this.document) return;

        const slide = this.getCurrentSlide();
        if (!slide) return;

        const element = slide.elements.find(e => e.id === elementId);
        if (!element) return;

        const previousState = { ...element };
        element.position.x = x;
        element.position.y = y;

        this.recordChange('update', elementId, slide.id, previousState, element, `Moved element to (${x}, ${y})`);
    }

    // Update element size
    updateElementSize(elementId: string, width: number, height: number): void {
        if (!this.document) return;

        const slide = this.getCurrentSlide();
        if (!slide) return;

        const element = slide.elements.find(e => e.id === elementId);
        if (!element) return;

        const previousState = { ...element };
        element.size.width = width;
        element.size.height = height;

        this.recordChange('update', elementId, slide.id, previousState, element, `Resized element to ${width}x${height}`);
    }

    // Update element style
    updateElementStyle(elementId: string, style: Partial<SlideElement['style']>): void {
        if (!this.document) return;

        const slide = this.getCurrentSlide();
        if (!slide) return;

        const element = slide.elements.find(e => e.id === elementId);
        if (!element) return;

        const previousState = { ...element };
        element.style = { ...element.style, ...style };

        this.recordChange('update', elementId, slide.id, previousState, element, 'Updated element style');
    }

    // Add a new text element
    addTextElement(text: string, x: number, y: number, width: number, height: number): string {
        if (!this.document) throw new Error('No document loaded');

        const slide = this.getCurrentSlide();
        if (!slide) throw new Error('No current slide');

        const elementId = `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newElement: SlideElement = {
            id: elementId,
            type: 'text',
            position: { x, y },
            size: { width, height },
            content: { text },
            style: {
                fontSize: 14,
                fontFamily: 'Arial',
                color: '#000000'
            }
        };

        slide.elements.push(newElement);
        this.recordChange('add', elementId, slide.id, null, newElement, `Added text: "${text}"`);

        return elementId;
    }

    // Add a new image element
    addImageElement(imageUrl: string, x: number, y: number, width: number, height: number): string {
        if (!this.document) throw new Error('No document loaded');

        const slide = this.getCurrentSlide();
        if (!slide) throw new Error('No current slide');

        const elementId = `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newElement: SlideElement = {
            id: elementId,
            type: 'image',
            position: { x, y },
            size: { width, height },
            content: {
                imageUrl,
                altText: 'Added image'
            },
            style: {}
        };

        slide.elements.push(newElement);
        this.recordChange('add', elementId, slide.id, null, newElement, 'Added image');

        return elementId;
    }

    // Delete an element
    deleteElement(elementId: string): void {
        if (!this.document) return;

        const slide = this.getCurrentSlide();
        if (!slide) return;

        const elementIndex = slide.elements.findIndex(e => e.id === elementId);
        if (elementIndex === -1) return;

        const deletedElement = slide.elements[elementIndex];
        slide.elements.splice(elementIndex, 1);

        this.recordChange('delete', elementId, slide.id, deletedElement, null, `Deleted ${deletedElement.type} element`);

        if (this.state.selectedElement === elementId) {
            this.deselectElement();
        }
    }

    // Undo last change
    undo(): boolean {
        if (!this.options.enableUndoRedo) return false;

        const change = this.changeTracker.undo();
        if (!change) return false;

        if (this.document) {
            this.changeTracker.revertChange(this.document, change);
        }

        this.updateState();
        return true;
    }

    // Redo last undone change
    redo(): boolean {
        if (!this.options.enableUndoRedo) return false;

        const change = this.changeTracker.redo();
        if (!change) return false;

        if (this.document) {
            this.changeTracker.applyChange(this.document, change);
        }

        this.updateState();
        return true;
    }

    // Revert all changes
    revertAllChanges(): void {
        if (!this.document) return;

        const changes = this.changeTracker.revertAllChanges();
        changes.forEach(change => {
            this.changeTracker.revertChange(this.document!, change);
        });

        this.updateState();
    }

    // Revert changes for a specific slide
    revertSlideChanges(slideId: string): void {
        if (!this.document) return;

        const slideChanges = this.changeTracker.getChangesForSlide(slideId);
        slideChanges.forEach(change => {
            this.changeTracker.revertChange(this.document!, change);
        });

        this.updateState();
    }

    // Export the edited presentation
    async exportPPTX(): Promise<Blob> {
        if (!this.exporter || !this.document) {
            throw new Error('No document loaded or exporter not initialized');
        }

        try {
            return await this.exporter.exportPPTX();
        } catch (error) {
            console.error('Error exporting PPTX:', error);
            throw new Error(`Failed to export PPTX: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Get change history
    getChangeHistory(): ChangeRecord[] {
        return this.changeTracker.getChangeHistory();
    }

    // Get change summary
    getChangeSummary() {
        return this.changeTracker.getChangeSummary();
    }

    // Update internal state
    private updateState(): void {
        this.state.changes = this.changeTracker.getChangeHistory();
        this.state.canUndo = this.changeTracker.canUndo();
        this.state.canRedo = this.changeTracker.canRedo();
    }

    // Record a change
    private recordChange(
        type: 'add' | 'update' | 'delete',
        elementId: string,
        slideId: string,
        previousState: any,
        newState: any,
        description: string
    ): void {
        if (!this.options.enableUndoRedo) return;

        this.changeTracker.recordChange(type, elementId, slideId, previousState, newState, description);
        this.updateState();
    }

    // Save current state (for auto-save functionality)
    saveState(): void {
        if (this.options.enableAutoSave && this.document) {
            // In a real implementation, you might save to localStorage or send to a server
            localStorage.setItem('pptx-editor-state', JSON.stringify({
                document: this.document,
                state: this.state,
                changes: this.getChangeHistory()
            }));
        }
    }

    // Load saved state
    loadSavedState(): boolean {
        try {
            const savedState = localStorage.getItem('pptx-editor-state');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                this.document = parsed.document;
                this.state = parsed.state;

                // Restore changes
                parsed.changes.forEach((change: ChangeRecord) => {
                    this.changeTracker.recordChange(
                        change.type,
                        change.elementId,
                        change.slideId,
                        change.previousState,
                        change.newState,
                        change.description
                    );
                });

                this.updateState();
                return true;
            }
        } catch (error) {
            console.warn('Could not load saved state:', error);
        }

        return false;
    }
}
