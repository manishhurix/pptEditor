import React, { useState } from 'react';
import { PPTXEditor } from '../src/components/PPTXEditor';
import { PPTXEditorCore } from '../src/core/PPTXEditor';



const App: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [exportedFile, setExportedFile] = useState<Blob | null>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            setSelectedFile(file);
        } else {
            alert('Please select a valid PPTX file');
        }
    };

    const handleExport = (blob: Blob) => {
        setExportedFile(blob);

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited-presentation-${Date.now()}.pptx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDragOver = (event: React.DragEvent) => {
        event.preventDefault();
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
                setSelectedFile(file);
            } else {
                alert('Please drop a valid PPTX file');
            }
        }
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>PPTX Editor SDK Demo</h1>
                <p>A comprehensive PowerPoint editor for web applications</p>
            </header>

            {!selectedFile ? (
                <div className="file-upload">
                    <div
                        className="drop-zone"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <div className="upload-content">
                            <div className="upload-icon">📄</div>
                            <h3>Upload PPTX File</h3>
                            <p>Drag and drop a PPTX file here, or click to browse</p>
                            <input
                                type="file"
                                accept=".pptx"
                                onChange={handleFileSelect}
                                id="file-input"
                                style={{ display: 'none' }}
                            />
                            <label htmlFor="file-input" className="upload-button">
                                Choose File
                            </label>
                        </div>
                    </div>

                    <div className="features">
                        <h3>Features</h3>
                        <ul>
                            <li>✅ Parse and read PPTX files</li>
                            <li>✅ Edit text content</li>
                            <li>✅ Add/remove images</li>
                            <li>✅ Modify element positions and sizes</li>
                            <li>✅ Undo/Redo functionality</li>
                            <li>✅ Revert changes</li>
                            <li>✅ Export edited presentations</li>
                            <li>✅ Maintains original PPTX structure</li>
                        </ul>
                    </div>
                </div>
            ) : (
                <div className="editor-container">
                    <div className="file-info">
                        <span>Editing: {selectedFile.name}</span>
                        <button
                            onClick={() => setSelectedFile(null)}
                            className="close-button"
                        >
                            Close
                        </button>
                    </div>

                    {selectedFile && (
                        <PPTXEditor
                            file={selectedFile}
                            onExport={handleExport}
                            options={{
                                enableUndoRedo: true,
                                enableAutoSave: true,
                                maxUndoSteps: 50,
                                theme: 'light',
                                showToolbar: true,
                                showSlideNavigator: true
                            }}
                        />
                    )}
                </div>
            )}

            {exportedFile && (
                <div className="export-notification">
                    <p>✅ Presentation exported successfully!</p>
                    <button onClick={() => setExportedFile(null)}>Dismiss</button>
                </div>
            )}
        </div>
    );
};

export default App;
