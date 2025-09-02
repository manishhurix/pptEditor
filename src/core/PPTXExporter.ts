import JSZip from 'jszip';
import { PPTXDocument, PPTXSlide, SlideElement } from '../types';

export class PPTXExporter {
    private zip: JSZip;
    private originalZip: JSZip;
    private document: PPTXDocument;

    constructor(originalZip: JSZip, document: PPTXDocument) {
        this.zip = new JSZip();
        this.originalZip = originalZip;
        this.document = document;
    }

    async exportPPTX(): Promise<Blob> {
        try {
            // Copy the entire original structure
            await this.copyOriginalStructure();

            // Update slides with edited content
            await this.updateSlides();

            // Update presentation metadata
            await this.updateMetadata();

            // Generate the final PPTX file
            const blob = await this.zip.generateAsync({ type: 'blob' });
            return blob;
        } catch (error) {
            console.error('Error exporting PPTX:', error);
            throw new Error(`Failed to export PPTX: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async copyOriginalStructure(): Promise<void> {
        // Copy all files from the original ZIP
        const files = this.originalZip.files;

        for (const [path, file] of Object.entries(files)) {
            if (!file.dir) {
                const content = await file.async('uint8array');
                this.zip.file(path, content);
            }
        }
    }

    private async updateSlides(): Promise<void> {
        for (const slide of this.document.slides) {
            await this.updateSlide(slide);
        }
    }

    private async updateSlide(slide: PPTXSlide): Promise<void> {
        try {
            // Find the slide file path
            const slidePath = this.findSlidePath(slide.slideNumber);
            if (!slidePath) return;

            // Get the original slide XML
            const originalSlideXml = await this.originalZip.file(slidePath)?.async('string');
            if (!originalSlideXml) return;

            // Parse and update the slide XML
            const updatedSlideXml = this.updateSlideXML(originalSlideXml, slide);

            // Update the slide file
            this.zip.file(slidePath, updatedSlideXml);
        } catch (error) {
            console.warn(`Warning: Could not update slide ${slide.slideNumber}:`, error);
        }
    }

    private findSlidePath(slideNumber: number): string | null {
        // This is a simplified approach - in a real implementation, you'd need to
        // parse the presentation.xml.rels to find the exact slide paths
        return `ppt/slides/slide${slideNumber}.xml`;
    }

    private updateSlideXML(originalXml: string, slide: PPTXSlide): string {
        // This is a simplified XML update - in a real implementation, you'd use
        // a proper XML parser to maintain the exact structure

        let updatedXml = originalXml;

        // Update text elements
        for (const element of slide.elements) {
            if (element.type === 'text') {
                updatedXml = this.updateTextElement(updatedXml, element);
            } else if (element.type === 'image') {
                updatedXml = this.updateImageElement(updatedXml, element);
            } else if (element.type === 'shape') {
                updatedXml = this.updateShapeElement(updatedXml, element);
            }
        }

        return updatedXml;
    }

    private updateTextElement(xml: string, element: SlideElement): string {
        // Find and update text content
        // This is a simplified approach - in reality, you'd need proper XML parsing
        const textPattern = new RegExp(`<a:t[^>]*>.*?</a:t>`, 'g');
        const replacement = `<a:t>${element.content.text}</a:t>`;

        return xml.replace(textPattern, replacement);
    }

    private updateImageElement(xml: string, _element: SlideElement): string {
        // Update image properties if needed
        // This would involve updating the image dimensions, position, etc.
        return xml;
    }

    private updateShapeElement(xml: string, _element: SlideElement): string {
        // Update shape properties if needed
        // This would involve updating the shape dimensions, position, etc.
        return xml;
    }

    private async updateMetadata(): Promise<void> {
        try {
            // Update app.xml
            await this.updateAppXml();

            // Update core.xml
            await this.updateCoreXml();
        } catch (error) {
            console.warn('Warning: Could not update metadata:', error);
        }
    }

    private async updateAppXml(): Promise<void> {
        const appXmlPath = 'docProps/app.xml';
        const appXml = await this.zip.file(appXmlPath)?.async('string');

        if (appXml) {
            // Update the title and other properties
            let updatedXml = appXml;

            if (this.document.metadata.title) {
                updatedXml = updatedXml.replace(
                    /<Title>.*?<\/Title>/,
                    `<Title>${this.document.metadata.title}</Title>`
                );
            }

            if (this.document.metadata.subject) {
                updatedXml = updatedXml.replace(
                    /<Subject>.*?<\/Subject>/,
                    `<Subject>${this.document.metadata.subject}</Subject>`
                );
            }

            this.zip.file(appXmlPath, updatedXml);
        }
    }

    private async updateCoreXml(): Promise<void> {
        const coreXmlPath = 'docProps/core.xml';
        const coreXml = await this.zip.file(coreXmlPath)?.async('string');

        if (coreXml) {
            // Update the modified date
            const now = new Date().toISOString();
            const updatedXml = coreXml.replace(
                /<dcterms:modified>.*?<\/dcterms:modified>/,
                `<dcterms:modified>${now}</dcterms:modified>`
            );

            this.zip.file(coreXmlPath, updatedXml);
        }
    }

    // Alternative export method using PptxGenJS for better compatibility
    async exportWithPptxGenJS(): Promise<Blob> {
        try {
            // This method would use PptxGenJS to create a new presentation
            // based on the edited document structure

            // For now, return the basic export
            return await this.exportPPTX();
        } catch (error) {
            console.error('Error exporting with PptxGenJS:', error);
            throw new Error(`Failed to export with PptxGenJS: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Export to different formats
    async exportToPDF(): Promise<Blob> {
        // This would require additional libraries for PDF conversion
        throw new Error('PDF export not implemented yet');
    }

    async exportToImages(): Promise<string[]> {
        // This would convert slides to images
        throw new Error('Image export not implemented yet');
    }

    // Get export statistics
    getExportStats(): {
        totalSlides: number;
        totalElements: number;
        exportSize: number;
        exportTime: Date;
    } {
        const totalElements = this.document.slides.reduce(
            (sum, slide) => sum + slide.elements.length,
            0
        );

        return {
            totalSlides: this.document.slides.length,
            totalElements,
            exportSize: 0, // Would be calculated after export
            exportTime: new Date()
        };
    }
}
