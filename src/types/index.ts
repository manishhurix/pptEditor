export interface PPTXSlide {
  id: string;
  slideNumber: number;
  elements: SlideElement[];
  background?: SlideBackground;
  layout?: string;
}

export interface SlideElement {
  id: string;
  type: 'text' | 'image' | 'shape' | 'chart' | 'table';
  position: Position;
  size: Size;
  content: any;
  style?: ElementStyle;
  originalData?: any; // Store original data for revert functionality
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ElementStyle {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  alignment?: 'left' | 'center' | 'right';
  opacity?: number;
}

export interface SlideBackground {
  type: 'color' | 'image' | 'gradient';
  value: string;
}

export interface PPTXDocument {
  slides: PPTXSlide[];
  metadata: DocumentMetadata;
  theme?: PresentationTheme;
}

export interface DocumentMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  created: Date;
  modified: Date;
}

export interface PresentationTheme {
  colors: ThemeColors;
  fonts: ThemeFonts;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;
  accent6: string;
}

export interface ThemeFonts {
  major: string;
  minor: string;
}

export interface ChangeRecord {
  id: string;
  timestamp: Date;
  type: 'add' | 'update' | 'delete';
  elementId: string;
  slideId: string;
  previousState?: any;
  newState?: any;
  description: string;
}

export interface EditorState {
  currentSlide: number;
  selectedElement?: string;
  changes: ChangeRecord[];
  canUndo: boolean;
  canRedo: boolean;
}

export interface EditorOptions {
  enableUndoRedo?: boolean;
  enableAutoSave?: boolean;
  maxUndoSteps?: number;
  theme?: 'light' | 'dark';
  showToolbar?: boolean;
  showSlideNavigator?: boolean;
}
