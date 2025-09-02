import JSZip from 'jszip';
import { PPTXDocument, PPTXSlide, SlideElement, Position, Size, ElementStyle } from '../types';

// Browser-compatible XML parser using DOMParser
const parseXML = (xmlString: string): Document => {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'text/xml');
};

// Convert XML to a more usable object structure
const xmlToObject = (xml: Document): any => {
    const processNode = (node: Element | ChildNode): any => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent?.trim() || '';
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return null;
        }

        const element = node as Element;
        const obj: any = {};

        // Add attributes
        if (element.attributes.length > 0) {
            obj.$ = {};
            for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                obj.$[attr.name] = attr.value;
            }
        }

        // Process child nodes
        const children = Array.from(element.childNodes);
        const textNodes = children.filter(child => child.nodeType === Node.TEXT_NODE);
        const elementNodes = children.filter(child => child.nodeType === Node.ELEMENT_NODE);

        if (textNodes.length > 0 && elementNodes.length === 0) {
            // Only text content
            return textNodes.map(textNode => textNode.textContent?.trim() || '').join('');
        }

        // Group elements by tag name
        const groupedElements: { [key: string]: any[] } = {};
        elementNodes.forEach(child => {
            const childObj = processNode(child);
            if (childObj !== null) {
                const tagName = (child as Element).tagName;
                if (!groupedElements[tagName]) {
                    groupedElements[tagName] = [];
                }
                groupedElements[tagName].push(childObj);
            }
        });

        // Merge grouped elements into obj
        Object.keys(groupedElements).forEach(tagName => {
            obj[tagName] = groupedElements[tagName];
        });

        return obj;
    };

    return processNode(xml.documentElement);
};

export class PPTXParser {
    private zip: JSZip;
    private document: PPTXDocument;

    constructor() {
        this.zip = new JSZip();
        this.document = {
            slides: [],
            metadata: {
                title: '',
                author: '',
                subject: '',
                keywords: [],
                created: new Date(),
                modified: new Date()
            }
        };
    }

    async parsePPTX(file: File | ArrayBuffer): Promise<PPTXDocument> {
        try {
            // Load the PPTX file
            if (file instanceof File) {
                const arrayBuffer = await file.arrayBuffer();
                this.zip = await JSZip.loadAsync(arrayBuffer);
            } else {
                this.zip = await JSZip.loadAsync(file);
            }

            // Parse presentation properties
            await this.parsePresentationProperties();

            // Parse slides
            await this.parseSlides();

            // Parse theme and styles
            await this.parseTheme();

            return this.document;
        } catch (error) {
            console.error('Error parsing PPTX:', error);
            throw new Error(`Failed to parse PPTX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async parsePresentationProperties(): Promise<void> {
        try {
            const appXml = await this.zip.file('docProps/app.xml')?.async('string');
            const coreXml = await this.zip.file('docProps/core.xml')?.async('string');

            if (appXml) {
                try {
                    const xmlDoc = parseXML(appXml);
                    const result = xmlToObject(xmlDoc);
                    if (result.Properties) {
                        const props = result.Properties;
                        this.document.metadata.title = props.Title?.[0] || '';
                        this.document.metadata.subject = props.Subject?.[0] || '';
                        this.document.metadata.keywords = props.Keywords?.[0]?.split(',') || [];
                    }
                } catch (err) {
                    console.warn('Error parsing app.xml:', err);
                }
            }

            if (coreXml) {
                try {
                    const xmlDoc = parseXML(coreXml);
                    const result = xmlToObject(xmlDoc);
                    if (result['cp:coreProperties']) {
                        const core = result['cp:coreProperties'];
                        this.document.metadata.author = core['dc:creator']?.[0] || '';
                        this.document.metadata.created = core['dcterms:created']?.[0] ? new Date(core['dcterms:created'][0]) : new Date();
                        this.document.metadata.modified = core['dcterms:modified']?.[0] ? new Date(core['dcterms:modified'][0]) : new Date();
                    }
                } catch (err) {
                    console.warn('Error parsing core.xml:', err);
                }
            }
        } catch (error) {
            console.warn('Warning: Could not parse presentation properties:', error);
        }
    }

    private async parseSlides(): Promise<void> {
        try {
            // Get slide relationships
            const relsXml = await this.zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
            console.log('PPTXParser: relsXml found:', !!relsXml);
            if (!relsXml) {
                console.log('PPTXParser: No relationships file found');
                return;
            }
            console.log('PPTXParser: Raw relsXml content (first 500 chars):', relsXml.substring(0, 500));

            try {
                const xmlDoc = parseXML(relsXml);
                console.log('PPTXParser: Raw XML document:', xmlDoc);
                console.log('PPTXParser: XML document element:', xmlDoc.documentElement);
                console.log('PPTXParser: XML document element tagName:', xmlDoc.documentElement?.tagName);

                const result = xmlToObject(xmlDoc);
                console.log('PPTXParser: Parsed relationships result:', result);
                console.log('PPTXParser: Result keys:', Object.keys(result));
                console.log('PPTXParser: Result.Relationships:', result.Relationships);
                console.log('PPTXParser: Result.Relationships?.Relationship:', result.Relationships?.Relationship);

                const relationships = result.Relationship || [];
                console.log('PPTXParser: All relationships:', relationships);

                const slideRels = relationships.filter((rel: any) =>
                    rel.$.Target?.includes('slide') &&
                    !rel.$.Target?.includes('slideMaster') &&
                    !rel.$.Target?.includes('slideLayout')
                );
                console.log('PPTXParser: Slide relationships found:', slideRels.length);
                console.log('PPTXParser: Slide relationship details:', slideRels);

                for (let i = 0; i < slideRels.length; i++) {
                    const slideRel = slideRels[i];
                    const slidePath = `ppt/${slideRel.$.Target}`;
                    console.log(`PPTXParser: Processing slide ${i + 1} at path:`, slidePath);

                    try {
                        const slide = await this.parseSlide(slidePath, i + 1);
                        if (slide) {
                            console.log(`PPTXParser: Successfully parsed slide ${i + 1}:`, slide);
                            this.document.slides.push(slide);
                        } else {
                            console.log(`PPTXParser: Failed to parse slide ${i + 1}`);
                        }
                    } catch (error) {
                        console.warn(`Warning: Could not parse slide ${i + 1}:`, error);
                    }
                }

                console.log('PPTXParser: Final slides array:', this.document.slides);
            } catch (err) {
                console.warn('Error parsing presentation relationships:', err);
            }
        } catch (error) {
            console.error('Error parsing slides:', error);
        }
    }

    private async parseSlide(slidePath: string, slideNumber: number): Promise<PPTXSlide | null> {
        try {
            console.log(`PPTXParser: Attempting to parse slide at path: ${slidePath}`);
            const slideXml = await this.zip.file(slidePath)?.async('string');
            if (!slideXml) {
                console.log(`PPTXParser: No XML content found for ${slidePath}`);
                return null;
            }

            console.log(`PPTXParser: XML content found for ${slidePath}, length: ${slideXml.length}`);
            console.log(`PPTXParser: First 200 chars of XML:`, slideXml.substring(0, 200));

            const slide: PPTXSlide = {
                id: `slide-${slideNumber}`,
                slideNumber,
                elements: [],
                layout: 'default'
            };

            try {
                const xmlDoc = parseXML(slideXml);
                const result = xmlToObject(xmlDoc);
                console.log(`PPTXParser: Parsed slide XML result:`, result);
                console.log(`PPTXParser: Result keys:`, Object.keys(result));

                const slideData = result['p:cSld']?.[0];
                console.log(`PPTXParser: Slide data found:`, !!slideData);
                if (!slideData) {
                    console.log(`PPTXParser: No slide data found in result, available keys:`, Object.keys(result));
                    return null;
                }

                // Parse slide layout
                const layout = slideData['p:sldLayoutId']?.[0]?.$?.id;
                if (layout) {
                    slide.layout = layout;
                }

                // Parse slide elements in their EXACT original order from the XML
                const spTree = slideData['p:spTree']?.[0];
                if (spTree) {
                    console.log('PPTXParser: spTree keys:', Object.keys(spTree));

                    // PowerPoint stores elements in spTree in the correct z-index order
                    // We need to preserve this order by processing them in sequence
                    const allElements: Array<{ element: SlideElement, originalIndex: number }> = [];
                    let globalIndex = 0;

                    // Get ALL child nodes from spTree in their original XML order
                    // This preserves PowerPoint's intended z-index layering
                    const allChildNodes = Object.keys(spTree).filter(key =>
                        key.startsWith('p:') &&
                        Array.isArray(spTree[key]) &&
                        spTree[key].length > 0
                    );

                    console.log('PPTXParser: All child node types found:', allChildNodes);

                    // Process each node type in the order they appear in the XML
                    allChildNodes.forEach(nodeType => {
                        const nodes = spTree[nodeType] || [];
                        console.log(`PPTXParser: Processing ${nodeType} nodes:`, nodes.length);

                        nodes.forEach((node: any) => {
                            let element: SlideElement | null = null;

                            switch (nodeType) {
                                case 'p:sp':
                                    element = this.parseShapeElement(node, globalIndex);
                                    break;
                                case 'p:pic':
                                    element = this.parsePictureElement(node, globalIndex);
                                    break;
                                case 'p:txBox':
                                    element = this.parseTextBoxElement(node, globalIndex);
                                    break;
                                default:
                                    console.log(`PPTXParser: Unknown node type: ${nodeType}, skipping`);
                                    return;
                            }

                            if (element) {
                                // Store the original processing order as z-index
                                (element as any).zIndex = globalIndex;
                                allElements.push({ element, originalIndex: globalIndex });
                                globalIndex++;
                            }
                        });
                    });

                    console.log('PPTXParser: Found total elements:', allElements.length);

                    // Sort elements by their original index to maintain z-index order
                    allElements.sort((a, b) => a.originalIndex - b.originalIndex);

                    // Extract just the elements in the correct order
                    slide.elements = allElements.map(item => item.element);

                    console.log('PPTXParser: Final elements array with z-index order:', slide.elements.map((el) => ({ id: el.id, type: el.type, zIndex: (el as any).zIndex })));

                    // Now resolve image relationships and load actual image data
                    // Each slide has its own relationship file in the _rels folder
                    const slideRelPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/').replace('.xml', '.xml.rels');
                    console.log('PPTXParser: About to resolve image data for slide:', slide.id, 'using rels path:', slideRelPath);

                    // Check if the relationship file exists
                    const relsFileExists = await this.zip.file(slideRelPath)?.async('string');
                    if (relsFileExists) {
                        console.log('PPTXParser: Relationship file exists, resolving image data...');
                        await this.resolveImageData(slide, slideRelPath);
                    } else {
                        console.warn('PPTXParser: Relationship file does not exist:', slideRelPath);
                        // Try alternative path
                        const altPath = slidePath.replace('.xml', '.xml.rels');
                        console.log('PPTXParser: Trying alternative path:', altPath);
                        const altRelsFile = await this.zip.file(altPath)?.async('string');
                        if (altRelsFile) {
                            console.log('PPTXParser: Alternative relationship file exists, resolving image data...');
                            await this.resolveImageData(slide, altPath);
                        } else {
                            console.warn('PPTXParser: Alternative relationship file also does not exist:', altPath);

                            // List all files in the zip to debug
                            console.log('PPTXParser: Available files in zip:');
                            Object.keys(this.zip.files).forEach((path: string) => {
                                if (path.includes('slide') || path.includes('rels') || path.includes('media')) {
                                    console.log('PPTXParser: -', path);
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                console.warn('Error parsing slide XML:', err);
                return null;
            }

            return slide;
        } catch (error) {
            console.error(`Error parsing slide ${slideNumber}:`, error);
            return null;
        }
    }

    private parseShapeElement(shape: any, index: number): SlideElement | null {
        try {
            const spPr = shape['p:spPr']?.[0];
            const txBody = shape['p:txBody']?.[0];

            if (!spPr) return null;

            const position = this.parsePosition(spPr);
            const size = this.parseSize(spPr);

            let textContent = '';
            if (txBody) {
                textContent = this.parseTextContent(txBody);
                // Only log if we get [object Object] or empty text
                if (textContent === '[object Object]' || textContent === '') {
                    console.log(`PPTXParser: Element ${index} - PROBLEM: textContent="${textContent}", txBody:`, txBody);
                }
            }

            const element: SlideElement = {
                id: `shape-${index}`,
                type: 'shape',
                position,
                size,
                content: {
                    shapeType: spPr['a:prstGeom']?.[0]?.$.prst || 'rect',
                    text: textContent
                },
                style: this.parseElementStyle(spPr, txBody),
                originalData: shape
            };

            return element;
        } catch (error) {
            console.warn('Warning: Could not parse shape element:', error);
            return null;
        }
    }

    private parsePictureElement(picture: any, index: number): SlideElement | null {
        try {
            const spPr = picture['p:spPr']?.[0];
            const blipFill = picture['p:blipFill']?.[0];

            if (!spPr || !blipFill) return null;

            const position = this.parsePosition(spPr);
            const size = this.parseSize(spPr);

            const blip = blipFill['a:blip']?.[0];
            const imageId = blip?.$?.['r:embed'] || blip?.$?.['r:link'];

            console.log('PPTXParser: Processing image with rId:', imageId);

            const element: SlideElement = {
                id: `picture-${index}`,
                type: 'image',
                position,
                size,
                content: {
                    imageId,
                    imagePath: '', // Will be resolved by resolveImageData
                    altText: picture['p:nvPicPr']?.[0]?.['p:cNvPr']?.[0]?.$.descr || ''
                },
                style: this.parseElementStyle(spPr),
                originalData: picture
            };

            return element;
        } catch (error) {
            console.warn('Warning: Could not parse picture element:', error);
            return null;
        }
    }

    private parseTextBoxElement(textBox: any, index: number): SlideElement | null {
        try {
            const spPr = textBox['p:spPr']?.[0];
            const txBody = textBox['p:txBody']?.[0];

            if (!spPr || !txBody) return null;

            const position = this.parsePosition(spPr);
            const size = this.parseSize(spPr);

            const element: SlideElement = {
                id: `textbox-${index}`,
                type: 'text',
                position,
                size,
                content: {
                    text: this.parseTextContent(txBody)
                },
                style: this.parseElementStyle(spPr, txBody),
                originalData: textBox
            };

            return element;
        } catch (error) {
            console.warn('Warning: Could not parse text box element:', error);
            return null;
        }
    }

    private parsePosition(spPr: any): Position {
        const xfrm = spPr['a:xfrm']?.[0];
        const off = xfrm?.['a:off']?.[0]?.$;

        // Debug: Log the raw EMU values
        console.log('PPTXParser: Raw EMU values - x:', off?.x, 'y:', off?.y);

        // Convert EMUs to points: 1 inch = 914400 EMUs, 1 inch = 72 points
        // So 1 EMU = 72/914400 = 1/12700 points
        const EMU_TO_POINTS = 72 / 914400;

        const x = parseInt(off?.x || '0') * EMU_TO_POINTS;
        const y = parseInt(off?.y || '0') * EMU_TO_POINTS;

        console.log('PPTXParser: Converted to points - x:', x, 'y:', y);

        return { x, y };
    }

    private parseSize(spPr: any): Size {
        const xfrm = spPr['a:xfrm']?.[0];
        const ext = xfrm?.['a:ext']?.[0]?.$;

        // Debug: Log the raw EMU values
        console.log('PPTXParser: Raw EMU size values - cx:', ext?.cx, 'cy:', ext?.cy);

        // Convert EMUs to points: 1 inch = 914400 EMUs, 1 inch = 72 points
        // So 1 EMU = 72/914400 = 1/12700 points
        const EMU_TO_POINTS = 72 / 914400;

        const width = parseInt(ext?.cx || '0') * EMU_TO_POINTS;
        const height = parseInt(ext?.cy || '0') * EMU_TO_POINTS;

        console.log('PPTXParser: Converted size to points - width:', width, 'height:', height);

        return { width, height };
    }

    private parseTextContent(txBody: any): string {
        try {
            const paragraphs = txBody['a:p'] || [];

            const result = paragraphs.map((p: any) => {
                const runs = p['a:r'] || [];

                const paragraphText = runs.map((r: any) => {
                    const textNode = r['a:t']?.[0];
                    let text = '';

                    if (typeof textNode === 'string') {
                        text = textNode;
                    } else if (typeof textNode === 'object' && textNode !== null) {
                        // If it's an object, try to extract the text content
                        if (textNode._) {
                            text = textNode._;
                        } else if (textNode.$ && textNode.$.val) {
                            text = textNode.$.val;
                        } else {
                            // If it's an empty object, it might be an empty text node
                            text = '';
                        }
                    }

                    return text;
                }).join('');

                return paragraphText;
            }).join('\n');

            return result;
        } catch (error) {
            console.warn('PPTXParser: Error parsing text content:', error);
            return '';
        }
    }

    private parseElementStyle(spPr: any, txBody?: any): ElementStyle {
        const style: ElementStyle = {};

        // Parse shape properties
        if (spPr['a:prstGeom']) {
            const solidFill = spPr['a:solidFill']?.[0];
            if (solidFill) {
                const srgbClr = solidFill['a:srgbClr']?.[0]?.$.val;
                if (srgbClr) {
                    style.backgroundColor = `#${srgbClr}`;
                }
            }
        }

        // Parse text properties
        if (txBody) {
            const paragraphs = txBody['a:p'] || [];
            if (paragraphs.length > 0) {
                const firstP = paragraphs[0];
                const runs = firstP['a:r'] || [];
                if (runs.length > 0) {
                    const firstRun = runs[0];
                    const rPr = firstRun['a:rPr']?.[0];

                    if (rPr) {
                        const sz = rPr['a:sz']?.[0]?.$?.val;
                        if (sz) {
                            style.fontSize = parseInt(sz) / 100; // Convert to points
                        }

                        const solidFill = rPr['a:solidFill']?.[0];
                        if (solidFill) {
                            const srgbClr = solidFill['a:srgbClr']?.[0]?.$.val;
                            if (srgbClr) {
                                style.color = `#${srgbClr}`;
                            }
                        }
                    }
                }
            }
        }

        return style;
    }

    private async parseTheme(): Promise<void> {
        try {
            const themeXml = await this.zip.file('ppt/theme/theme1.xml')?.async('string');
            if (!themeXml) return;

            try {
                const xmlDoc = parseXML(themeXml);
                const result = xmlToObject(xmlDoc);
                const theme = result['a:theme'];
                if (theme) {
                    this.document.theme = {
                        colors: {
                            primary: '#000000',
                            secondary: '#000000',
                            accent1: '#000000',
                            accent2: '#000000',
                            accent3: '#000000',
                            accent4: '#000000',
                            accent5: '#000000',
                            accent6: '#000000'
                        },
                        fonts: {
                            major: 'Calibri',
                            minor: 'Calibri'
                        }
                    };

                    // Parse theme colors
                    const clrScheme = theme['a:themeElements']?.[0]?.['a:clrScheme']?.[0];
                    if (clrScheme) {
                        const colors = clrScheme['a:clrScheme'] || [];
                        colors.forEach((color: any, index: number) => {
                            const srgbClr = color['a:srgbClr']?.[0]?.$.val;
                            if (srgbClr && index < 6) {
                                const colorKeys = ['primary', 'secondary', 'accent1', 'accent2', 'accent3', 'accent4'];
                                (this.document.theme!.colors as any)[colorKeys[index]] = `#${srgbClr}`;
                            }
                        });
                    }
                }
            } catch (err) {
                console.warn('Error parsing theme XML:', err);
            }
        } catch (error) {
            console.warn('Warning: Could not parse theme:', error);
        }
    }

    private async resolveImageData(slide: PPTXSlide, slideRelPath: string): Promise<void> {
        try {
            console.log('PPTXParser: Resolving image data for slide:', slide.id, 'using rels file:', slideRelPath);
            console.log('PPTXParser: Slide has', slide.elements.length, 'elements');
            console.log('PPTXParser: Image elements:', slide.elements.filter(el => el.type === 'image').map(el => ({ id: el.id, content: el.content })));

            // Check if this slide has already been processed
            if ((slide as any)._imageDataResolved) {
                console.log('PPTXParser: Slide already processed for image data, skipping:', slide.id);
                return;
            }
            (slide as any)._imageDataResolved = true;

            // Read the slide's relationship file
            console.log('PPTXParser: Attempting to read relationship file:', slideRelPath);
            const relsXml = await this.zip.file(slideRelPath)?.async('string');
            if (!relsXml) {
                console.warn('PPTXParser: Could not read slide relationships file:', slideRelPath);
                return;
            }

            console.log('PPTXParser: Successfully read rels file, length:', relsXml.length);
            console.log('PPTXParser: First 200 chars of rels XML:', relsXml.substring(0, 200));

            // Parse the relationships XML
            const relsDoc = parseXML(relsXml);
            const relsResult = xmlToObject(relsDoc);

            console.log('PPTXParser: Parsed slide relationships result:', relsResult);
            console.log('PPTXParser: Available keys in relsResult:', Object.keys(relsResult));

            // Try different ways to access the relationships
            let relationships: any[] = [];
            if (relsResult.Relationships?.[0]?.Relationship) {
                relationships = relsResult.Relationships[0].Relationship;
            } else if (relsResult.Relationship) {
                relationships = Array.isArray(relsResult.Relationship) ? relsResult.Relationship : [relsResult.Relationship];
            }

            console.log('PPTXParser: Parsed slide relationships:', relationships.length);
            console.log('PPTXParser: First relationship example:', relationships[0]);

            // Find image elements in this slide
            const imageElements = slide.elements.filter(el => el.type === 'image');
            console.log('PPTXParser: Found image elements:', imageElements.length);

            for (const imageElement of imageElements) {
                const imageId = (imageElement.content as any).imageId;
                if (!imageId) continue;

                // Skip if already resolved
                if ((imageElement.content as any).resolved) {
                    console.log('PPTXParser: Image already resolved, skipping:', imageId);
                    continue;
                }

                console.log('PPTXParser: Resolving image with rId:', imageId);

                // Find the relationship for this image
                const relationship = relationships.find((rel: any) => rel.$.Id === imageId);
                if (!relationship) {
                    console.warn('PPTXParser: No relationship found for image rId:', imageId);
                    continue;
                }

                const targetPath = relationship.$.Target;
                console.log('PPTXParser: Image target path:', targetPath);

                // Resolve the relative path to absolute path within the PPTX
                let absoluteImagePath = targetPath;
                if (targetPath.startsWith('../')) {
                    // If it's ../media/image1.png, resolve from ppt/slides/ to ppt/media/image1.png
                    absoluteImagePath = targetPath.replace('../', 'ppt/');
                } else if (targetPath.startsWith('./')) {
                    // If it's ./media/image1.png, resolve from ppt/slides/ to ppt/slides/media/image1.png
                    absoluteImagePath = targetPath.replace('./', 'ppt/slides/');
                } else if (!targetPath.startsWith('ppt/')) {
                    // If it's just media/image1.png, assume it's relative to ppt/
                    absoluteImagePath = `ppt/${targetPath}`;
                }

                console.log('PPTXParser: Resolved absolute image path:', absoluteImagePath);

                // Read the actual image file from the PPTX
                try {
                    const imageFile = await this.zip.file(absoluteImagePath)?.async('uint8array');
                    if (!imageFile) {
                        console.warn('PPTXParser: Could not read image file:', absoluteImagePath, '(resolved from:', targetPath, ')');
                        continue;
                    }

                    // Convert to base64 data URL - use a more efficient method for large files
                    let base64: string;
                    try {
                        // For smaller files, use the spread method
                        if (imageFile.length < 100000) { // 100KB threshold
                            base64 = btoa(String.fromCharCode(...imageFile));
                        } else {
                            // For larger files, use a chunked approach to avoid stack overflow
                            const chunks: string[] = [];
                            const chunkSize = 10000; // Process 10KB at a time
                            for (let i = 0; i < imageFile.length; i += chunkSize) {
                                const chunk = imageFile.slice(i, i + chunkSize);
                                chunks.push(String.fromCharCode(...chunk));
                            }
                            base64 = btoa(chunks.join(''));
                        }
                    } catch (error) {
                        console.warn('PPTXParser: Error converting image to base64, using fallback method:', error);
                        // Fallback: convert to string manually
                        let binaryString = '';
                        for (let i = 0; i < imageFile.length; i++) {
                            binaryString += String.fromCharCode(imageFile[i]);
                        }
                        base64 = btoa(binaryString);
                    }

                    const mimeType = this.getMimeType(targetPath);
                    const dataUrl = `data:${mimeType};base64,${base64}`;

                    console.log('PPTXParser: Successfully loaded image:', absoluteImagePath, 'size:', imageFile.length, 'bytes');

                    // Update the element content with the actual image data
                    (imageElement.content as any).imageDataUrl = dataUrl;
                    (imageElement.content as any).imagePath = absoluteImagePath; // Store the resolved absolute path
                    (imageElement.content as any).resolved = true; // Mark as resolved to prevent re-processing

                    console.log('PPTXParser: Updated element content:', {
                        imageId: (imageElement.content as any).imageId,
                        imagePath: (imageElement.content as any).imagePath,
                        imageDataUrl: (imageElement.content as any).imageDataUrl ? 'DATA_URL_LOADED' : 'NO_DATA_URL',
                        resolved: (imageElement.content as any).resolved
                    });

                } catch (error) {
                    console.warn('PPTXParser: Error reading image file:', absoluteImagePath, '(resolved from:', targetPath, ')', error);
                }
            }
        } catch (error) {
            console.warn('PPTXParser: Error resolving image data:', error);
        }
    }

    private getMimeType(filePath: string): string {
        const extension = filePath.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'png': return 'image/png';
            case 'jpg':
            case 'jpeg': return 'image/jpeg';
            case 'gif': return 'image/gif';
            case 'bmp': return 'image/bmp';
            case 'svg': return 'image/svg+xml';
            default: return 'image/png'; // Default fallback
        }
    }
}
