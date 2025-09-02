import { ChangeRecord, PPTXDocument, SlideElement } from '../types';

export class ChangeTracker {
    private changes: ChangeRecord[] = [];
    private maxUndoSteps: number;
    private currentIndex: number = -1;

    constructor(maxUndoSteps: number = 50) {
        this.maxUndoSteps = maxUndoSteps;
    }

    recordChange(
        type: 'add' | 'update' | 'delete',
        elementId: string,
        slideId: string,
        previousState: any,
        newState: any,
        description: string
    ): void {
        // Remove any changes after the current index (for redo functionality)
        this.changes = this.changes.slice(0, this.currentIndex + 1);

        const change: ChangeRecord = {
            id: this.generateChangeId(),
            timestamp: new Date(),
            type,
            elementId,
            slideId,
            previousState,
            newState,
            description
        };

        this.changes.push(change);
        this.currentIndex++;

        // Limit the number of changes
        if (this.changes.length > this.maxUndoSteps) {
            this.changes.shift();
            this.currentIndex--;
        }
    }

    canUndo(): boolean {
        return this.currentIndex >= 0;
    }

    canRedo(): boolean {
        return this.currentIndex < this.changes.length - 1;
    }

    undo(): ChangeRecord | null {
        if (!this.canUndo()) {
            return null;
        }

        const change = this.changes[this.currentIndex];
        this.currentIndex--;
        return change;
    }

    redo(): ChangeRecord | null {
        if (!this.canRedo()) {
            return null;
        }

        this.currentIndex++;
        return this.changes[this.currentIndex];
    }

    getChangeHistory(): ChangeRecord[] {
        return [...this.changes];
    }

    getCurrentChangeIndex(): number {
        return this.currentIndex;
    }

    clearHistory(): void {
        this.changes = [];
        this.currentIndex = -1;
    }

    revertToChange(changeIndex: number): ChangeRecord[] {
        if (changeIndex < 0 || changeIndex >= this.changes.length) {
            throw new Error('Invalid change index');
        }

        const changesToRevert = this.changes.slice(changeIndex + 1).reverse();
        this.currentIndex = changeIndex;

        return changesToRevert;
    }

    revertAllChanges(): ChangeRecord[] {
        const allChanges = [...this.changes];
        this.clearHistory();
        return allChanges.reverse();
    }

    getChangesForElement(elementId: string): ChangeRecord[] {
        return this.changes.filter(change => change.elementId === elementId);
    }

    getChangesForSlide(slideId: string): ChangeRecord[] {
        return this.changes.filter(change => change.slideId === slideId);
    }

    private generateChangeId(): string {
        return `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Helper method to apply a change to a document
    applyChange(document: PPTXDocument, change: ChangeRecord): void {
        const slide = document.slides.find(s => s.id === change.slideId);
        if (!slide) return;

        switch (change.type) {
            case 'add':
                if (change.newState) {
                    slide.elements.push(change.newState as SlideElement);
                }
                break;

            case 'update':
                if (change.previousState && change.newState) {
                    const elementIndex = slide.elements.findIndex(e => e.id === change.elementId);
                    if (elementIndex !== -1) {
                        slide.elements[elementIndex] = change.newState as SlideElement;
                    }
                }
                break;

            case 'delete':
                if (change.previousState) {
                    const elementIndex = slide.elements.findIndex(e => e.id === change.elementId);
                    if (elementIndex !== -1) {
                        slide.elements.splice(elementIndex, 1);
                    }
                }
                break;
        }
    }

    // Helper method to revert a change in a document
    revertChange(document: PPTXDocument, change: ChangeRecord): void {
        const slide = document.slides.find(s => s.id === change.slideId);
        if (!slide) return;

        switch (change.type) {
            case 'add':
                // Remove the added element
                const addElementIndex = slide.elements.findIndex(e => e.id === change.elementId);
                if (addElementIndex !== -1) {
                    slide.elements.splice(addElementIndex, 1);
                }
                break;

            case 'update':
                // Restore the previous state
                if (change.previousState) {
                    const updateElementIndex = slide.elements.findIndex(e => e.id === change.elementId);
                    if (updateElementIndex !== -1) {
                        slide.elements[updateElementIndex] = change.previousState as SlideElement;
                    }
                }
                break;

            case 'delete':
                // Restore the deleted element
                if (change.previousState) {
                    slide.elements.push(change.previousState as SlideElement);
                }
                break;
        }
    }

    // Get a summary of changes
    getChangeSummary(): {
        totalChanges: number;
        additions: number;
        updates: number;
        deletions: number;
        lastChangeTime?: Date;
    } {
        const additions = this.changes.filter(c => c.type === 'add').length;
        const updates = this.changes.filter(c => c.type === 'update').length;
        const deletions = this.changes.filter(c => c.type === 'delete').length;

        return {
            totalChanges: this.changes.length,
            additions,
            updates,
            deletions,
            lastChangeTime: this.changes.length > 0 ? this.changes[this.changes.length - 1].timestamp : undefined
        };
    }
}
