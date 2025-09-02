import { PPTXEditor } from '../core/PPTXEditor';
import { PPTXParser } from '../core/PPTXParser';
import { ChangeTracker } from '../core/ChangeTracker';

describe('PPTXEditor', () => {
    let editor: PPTXEditor;

    beforeEach(() => {
        editor = new PPTXEditor({
            enableUndoRedo: true,
            enableAutoSave: false,
            maxUndoSteps: 10
        });
    });

    describe('initialization', () => {
        it('should create editor with default options', () => {
            expect(editor).toBeDefined();
            const state = editor.getState();
            expect(state.currentSlide).toBe(0);
            expect(state.changes).toEqual([]);
            expect(state.canUndo).toBe(false);
            expect(state.canRedo).toBe(false);
        });

        it('should create editor with custom options', () => {
            const customEditor = new PPTXEditor({
                enableUndoRedo: false,
                maxUndoSteps: 100
            });

            expect(customEditor).toBeDefined();
        });
    });

    describe('state management', () => {
        it('should return null document when no file loaded', () => {
            expect(editor.getDocument()).toBeNull();
        });

        it('should return empty slides array when no file loaded', () => {
            expect(editor.getSlides()).toEqual([]);
        });

        it('should return null current slide when no file loaded', () => {
            expect(editor.getCurrentSlide()).toBeNull();
        });
    });

    describe('change tracking', () => {
        it('should track changes correctly', () => {
            const summary = editor.getChangeSummary();
            expect(summary.totalChanges).toBe(0);
            expect(summary.additions).toBe(0);
            expect(summary.updates).toBe(0);
            expect(summary.deletions).toBe(0);
        });

        it('should maintain change history', () => {
            const changes = editor.getChangeHistory();
            expect(changes).toEqual([]);
        });
    });

    describe('undo/redo', () => {
        it('should not allow undo when no changes', () => {
            expect(editor.undo()).toBe(false);
        });

        it('should not allow redo when no changes', () => {
            expect(editor.redo()).toBe(false);
        });
    });
});

describe('ChangeTracker', () => {
    let tracker: ChangeTracker;

    beforeEach(() => {
        tracker = new ChangeTracker(5);
    });

    describe('change recording', () => {
        it('should record changes', () => {
            tracker.recordChange('add', 'element-1', 'slide-1', null, { id: 'element-1' }, 'Added element');

            expect(tracker.getChangeHistory()).toHaveLength(1);
            expect(tracker.canUndo()).toBe(true);
            expect(tracker.canRedo()).toBe(false);
        });

        it('should respect max undo steps', () => {
            // Add more changes than maxUndoSteps
            for (let i = 0; i < 10; i++) {
                tracker.recordChange('add', `element-${i}`, 'slide-1', null, { id: `element-${i}` }, `Added element ${i}`);
            }

            expect(tracker.getChangeHistory()).toHaveLength(5);
        });
    });

    describe('undo/redo operations', () => {
        it('should undo changes correctly', () => {
            tracker.recordChange('add', 'element-1', 'slide-1', null, { id: 'element-1' }, 'Added element');

            const change = tracker.undo();
            expect(change).toBeDefined();
            expect(change?.type).toBe('add');
            expect(tracker.canUndo()).toBe(false);
            expect(tracker.canRedo()).toBe(true);
        });

        it('should redo changes correctly', () => {
            tracker.recordChange('add', 'element-1', 'slide-1', null, { id: 'element-1' }, 'Added element');
            tracker.undo();

            const change = tracker.redo();
            expect(change).toBeDefined();
            expect(tracker.canUndo()).toBe(true);
            expect(tracker.canRedo()).toBe(false);
        });
    });

    describe('change filtering', () => {
        it('should filter changes by element', () => {
            tracker.recordChange('add', 'element-1', 'slide-1', null, { id: 'element-1' }, 'Added element 1');
            tracker.recordChange('update', 'element-2', 'slide-1', {}, { id: 'element-2' }, 'Updated element 2');

            const elementChanges = tracker.getChangesForElement('element-1');
            expect(elementChanges).toHaveLength(1);
            expect(elementChanges[0].type).toBe('add');
        });

        it('should filter changes by slide', () => {
            tracker.recordChange('add', 'element-1', 'slide-1', null, { id: 'element-1' }, 'Added element 1');
            tracker.recordChange('add', 'element-2', 'slide-2', null, { id: 'element-2' }, 'Added element 2');

            const slideChanges = tracker.getChangesForSlide('slide-1');
            expect(slideChanges).toHaveLength(1);
            expect(slideChanges[0].slideId).toBe('slide-1');
        });
    });
});

describe('PPTXParser', () => {
    let parser: PPTXParser;

    beforeEach(() => {
        parser = new PPTXParser();
    });

    it('should create parser instance', () => {
        expect(parser).toBeDefined();
    });

    // Note: Actual PPTX parsing tests would require mock PPTX files
    // This is a basic structure test
});
