'use client';
import { useState, useEffect } from 'react';
import { SOURCE_CONFIG } from '@/features/context-import/types';
import { CredentialSelector } from './CredentialSelector';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete?: () => void;
}

export function ImportModal({ isOpen, onClose, onImportComplete }: ImportModalProps) {
    const [selectedSource, setSelectedSource] = useState('file');
    const [queries, setQueries] = useState<{templates: {popular: Array<{id: string, name: string, description: string, query: string}>, all: any[]}} | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedQuery, setSelectedQuery] = useState<{id: string, name: string, description: string, query: string} | null>(null);
    const [customQuery, setCustomQuery] = useState('');
    const [showCustomForm, setShowCustomForm] = useState(false);
    const [importResults, setImportResults] = useState<{success: boolean, source: string, error?: string, items: any[], total: number} | null>(null);
    const [importing, setImporting] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [addingToLibrary, setAddingToLibrary] = useState<Set<string>>(new Set());
    const [libraryItems, setLibraryItems] = useState<Set<string>>(new Set());
    const [selectedImportItems, setSelectedImportItems] = useState<Set<string>>(new Set());
    // File and text import states
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [textContent, setTextContent] = useState('');
    const [textTitle, setTextTitle] = useState('');
    const [textFormat, setTextFormat] = useState('auto');
    const [showTextImport, setShowTextImport] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    // Credential selection state
    const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
    const [credentialRequired, setCredentialRequired] = useState(false);

    const loadQueries = async (source: string) => {
        setLoading(true);
        try {
            console.log(`Loading queries for source: ${source}`);
            const response = await fetch(`/api/context-workflow/queries/${source}`);
            const data = await response.json();
            console.log(`Query data received:`, data);
            setQueries(data.queries);
        } catch (error) {
            console.error('Failed to load queries:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            if (selectedSource !== 'file') {
                loadQueries(selectedSource);
            }
            setSelectedQuery(null);
            setShowCustomForm(false);
            setImportResults(null);
            setImporting(false);
            setExpandedItems(new Set());
            setSelectedImportItems(new Set());
            // Reset file/text states
            setSelectedFiles([]);
            setTextContent('');
            setTextTitle('');
            setShowTextImport(false);
            // Reset credential state
            setSelectedCredentialId(null);
            // Check if credentials are required for this source
            setCredentialRequired(['jira', 'git', 'email'].includes(selectedSource));
        }
    }, [isOpen, selectedSource]);

    const executeQuery = async () => {
        if (!customQuery.trim()) return;
        
        // Check if credential is required and selected
        if (credentialRequired && !selectedCredentialId) {
            alert('Please select a credential for this import source.');
            return;
        }
        
        setImporting(true);
        setImportResults(null);
        try {
            console.log('Executing query:', customQuery);
            const response = await fetch('/api/context-workflow/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    source: selectedSource,
                    searchParams: customQuery,
                    credentialId: selectedCredentialId
                })
            });
            const result = await response.json();
            console.log('Import result:', result);
            setImportResults(result);
        } catch (error) {
            console.error('Import failed:', error);
            setImportResults({
                success: false,
                source: selectedSource,
                error: `Failed to execute query: ${(error as Error).message}`,
                items: [],
                total: 0
            });
        }
        setImporting(false);
    };

    const executeFileTextImport = async () => {
        setImporting(true);
        setImportResults(null);
        try {
            let result;
            if (selectedFiles.length > 0) {
                // File import
                const formData = new FormData();
                selectedFiles.forEach(file => formData.append('files', file));
                formData.append('source', 'file');
                
                const response = await fetch('/api/context-workflow/import/file', {
                    method: 'POST',
                    body: formData
                });
                result = await response.json();
            } else {
                // Text import
                const response = await fetch('/api/context-workflow/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        source: 'text',
                        content: textContent,
                        title: textTitle || 'Imported Text',
                        format: textFormat
                    })
                });
                result = await response.json();
            }
            console.log('File/Text import result:', result);
            
            // For files and text, check if we should offer to split structured data
            if (result.success && result.items && result.items.length > 0) {
                const structuredItems = result.items.filter((item: any) => 
                    item.metadata?.file_type === 'text' && 
                    (item.metadata?.mime_type === 'application/json' || 
                     item.metadata?.mime_type === 'text/csv' ||
                     item.metadata?.filename?.toLowerCase().endsWith('.csv') ||
                     item.metadata?.filename?.toLowerCase().endsWith('.json'))
                );
                
                if (structuredItems.length > 0 && shouldOfferSplitting(structuredItems[0])) {
                    // Show option to split structured data
                    const shouldSplit = window.confirm(
                        `This appears to be structured data (JSON/CSV). Would you like to:\n\n` +
                        `"OK" - Create separate library items for each row/entry\n` +
                        `"Cancel" - Keep as single file\n\n` +
                        `Choose OK to split into individual items.`
                    );
                    
                    if (shouldSplit) {
                        const expandedItems = await expandStructuredItems(structuredItems[0]);
                        if (expandedItems.length > 0) {
                            await addItemsDirectlyToLibrary(expandedItems);
                            onClose();
                            return;
                        }
                    }
                }
                
                await addItemsDirectlyToLibrary(result.items);
                onClose(); // Close modal after successful import
            } else {
                setImportResults(result);
            }
        } catch (error) {
            console.error('File/Text import failed:', error);
            setImportResults({
                success: false,
                source: 'file',
                error: `Failed to import: ${(error as Error).message}`,
                items: [],
                total: 0
            });
        }
        setImporting(false);
    };

    // File handling functions
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            setSelectedFiles(Array.from(files));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const files = e.dataTransfer.files;
        if (files) {
            setSelectedFiles(Array.from(files));
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(files => files.filter((_, i) => i !== index));
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const shouldOfferSplitting = (item: any): boolean => {
        try {
            const content = item.content;
            if (typeof content === 'string') {
                // Try to parse as JSON array
                if (content.trim().startsWith('[')) {
                    const parsed = JSON.parse(content);
                    return Array.isArray(parsed) && parsed.length > 1;
                }
                // Check for CSV with multiple lines
                if (content.includes('\n')) {
                    const lines = content.split('\n').filter(line => line.trim());
                    return lines.length > 2; // Header + at least 2 data rows
                }
            }
            return false;
        } catch {
            return false;
        }
    };

    const expandStructuredItems = async (item: any): Promise<any[]> => {
        try {
            const content = item.content;
            const expandedItems: any[] = [];
            
            if (typeof content === 'string') {
                if (content.trim().startsWith('[')) {
                    // JSON array
                    const parsed = JSON.parse(content);
                    if (Array.isArray(parsed)) {
                        parsed.forEach((entry, index) => {
                            expandedItems.push({
                                ...item,
                                id: `${item.id}-${index + 1}`,
                                title: `${item.title} - Entry ${index + 1}`,
                                content: typeof entry === 'object' ? JSON.stringify(entry, null, 2) : String(entry),
                                preview: typeof entry === 'object' ? 
                                    Object.keys(entry).slice(0, 3).map(k => `${k}: ${entry[k]}`).join(', ') :
                                    String(entry).substring(0, 100),
                                metadata: {
                                    ...item.metadata,
                                    original_file: item.metadata?.filename,
                                    entry_index: index + 1,
                                    total_entries: parsed.length
                                }
                            });
                        });
                    }
                } else if (content.includes('\n')) {
                    // CSV
                    const lines = content.split('\n').filter(line => line.trim());
                    if (lines.length > 1) {
                        const headers = lines[0].split(',').map(h => h.trim());
                        for (let i = 1; i < lines.length; i++) {
                            const values = lines[i].split(',').map(v => v.trim());
                            const rowObj: any = {};
                            headers.forEach((header, idx) => {
                                rowObj[header] = values[idx] || '';
                            });
                            
                            expandedItems.push({
                                ...item,
                                id: `${item.id}-row-${i}`,
                                title: `${item.title} - Row ${i}`,
                                content: JSON.stringify(rowObj, null, 2),
                                preview: values.slice(0, 3).join(', '),
                                metadata: {
                                    ...item.metadata,
                                    original_file: item.metadata?.filename,
                                    row_number: i,
                                    total_rows: lines.length - 1
                                }
                            });
                        }
                    }
                }
            }
            
            return expandedItems;
        } catch (error) {
            console.error('Failed to expand structured items:', error);
            return [];
        }
    };

    const addItemsDirectlyToLibrary = async (items: any[]) => {
        try {
            let successCount = 0;
            let errorCount = 0;
            
            for (const item of items) {
                console.log('Adding to library:', item);
                
                // Handle Git repositories - prompt for clone mode if not specified
                let finalItem = { ...item };
                if (item.source === 'git' && !item.clone_mode) {
                    const cloneMode = window.prompt(
                        `How would you like to use "${item.title}"?\n\n` +
                        `"read-only" - View files and documentation\n` +
                        `"writeable" - Clone for development and changes\n\n` +
                        `Enter "read-only" or "writeable":`,
                        'read-only'
                    );
                    
                    if (cloneMode && ['read-only', 'writeable'].includes(cloneMode)) {
                        finalItem.clone_mode = cloneMode;
                        finalItem.library_metadata = {
                            ...finalItem.library_metadata,
                            clone_mode: cloneMode,
                            added_via: 'import_modal',
                            added_at: new Date().toISOString()
                        };
                    } else {
                        console.log('Invalid clone mode, skipping item');
                        errorCount++;
                        continue;
                    }
                }

                // Add to library via API
                const response = await fetch('/api/context-workflow/library', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'add',
                        item: finalItem
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    const action = result.action || 'added';
                    console.log(`Successfully ${action} in library:`, finalItem.title);
                    successCount++;
                } else {
                    console.error('Failed to add to library:', result.error);
                    errorCount++;
                }
            }
            
            // Show summary message
            if (successCount > 0) {
                alert(`✅ Successfully added ${successCount} item(s) to library!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
            } else if (errorCount > 0) {
                alert(`❌ Failed to add items to library.`);
            }
            
        } catch (error) {
            console.error('Failed to add items to library:', error);
            alert('❌ Failed to add items to library.');
        }
    };

    const addSelectedToLibrary = async () => {
        if (!importResults || selectedImportItems.size === 0) return;
        
        const itemsToAdd = importResults.items.filter((item: any) => selectedImportItems.has(item.id));
        
        try {
            for (const item of itemsToAdd) {
                console.log('Adding to library:', item);
                setAddingToLibrary(prev => new Set([...prev, item.id]));
                
                // Handle Git repositories - prompt for clone mode if not specified
                let finalItem = { ...item };
                if (item.source === 'git' && !item.clone_mode) {
                    const cloneMode = window.prompt(
                        `How would you like to use "${item.title}"?\n\n` +
                        `"read-only" - View files and documentation\n` +
                        `"writeable" - Clone for development and changes\n\n` +
                        `Enter "read-only" or "writeable":`,
                        'read-only'
                    );
                    
                    if (cloneMode && ['read-only', 'writeable'].includes(cloneMode)) {
                        finalItem.clone_mode = cloneMode;
                        finalItem.library_metadata = {
                            ...finalItem.library_metadata,
                            clone_mode: cloneMode,
                            added_via: 'import_modal',
                            added_at: new Date().toISOString()
                        };
                    } else {
                        console.log('Invalid clone mode, skipping item');
                        setAddingToLibrary(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(item.id);
                            return newSet;
                        });
                        continue;
                    }
                }

                // Add to library via API
                const response = await fetch('/api/context-workflow/library', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'add',
                        item: finalItem
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    const action = result.action || 'added';
                    console.log(`Successfully ${action} in library:`, finalItem.title);
                    setLibraryItems(prev => new Set([...prev, item.id]));
                } else {
                    console.error('Failed to add to library:', result.error);
                    alert(`Failed to add "${item.title}" to library: ${result.error}`);
                }
                
                setAddingToLibrary(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(item.id);
                    return newSet;
                });
            }
            
            // Sync to filesystem
            try {
                console.log('Syncing library to file system...');
                const syncResponse = await fetch('/api/context-workflow/library', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'sync'
                    })
                });
                
                const syncResult = await syncResponse.json();
                if (syncResult.success) {
                    console.log('Library synced to file system:', syncResult.itemCount, 'items');
                } else {
                    console.error('Failed to sync library:', syncResult.error);
                }
            } catch (error) {
                console.error('Sync failed:', error);
            }
            
            // Call completion callback
            if (onImportComplete) {
                onImportComplete();
            }
            
            // Count how many were added vs updated
            const addedCount = itemsToAdd.filter(item => !libraryItems.has(item.id)).length;
            const updatedCount = itemsToAdd.length - addedCount;
            
            let message = '';
            if (addedCount > 0 && updatedCount > 0) {
                message = `Successfully added ${addedCount} new item(s) and updated ${updatedCount} existing item(s) in library!`;
            } else if (addedCount > 0) {
                message = `Successfully added ${addedCount} item(s) to library!`;
            } else {
                message = `Successfully updated ${updatedCount} item(s) in library!`;
            }
            alert(message);
            
        } catch (error) {
            console.error('Library add failed:', error);
            alert('Failed to add items to library');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-2xl w-[95vw] h-[90vh] max-w-7xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Import from Source</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel - Configuration */}
                    <div className="w-80 border-r border-gray-200 p-4 overflow-y-auto">
                        {/* Source Selection */}
                        <div className="mb-4">
                            <h3 className="text-sm font-medium text-gray-900 mb-3">Import Source</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {SOURCE_CONFIG.map(source => (
                                    <button
                                        key={source.type}
                                        onClick={() => {
                                            setSelectedSource(source.type);
                                            setImportResults(null);
                                            setSelectedQuery(null);
                                            setShowCustomForm(false);
                                        }}
                                        className={`p-3 rounded-lg border transition-all text-left ${
                                            selectedSource === source.type
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{source.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900 text-sm truncate">{source.name}</div>
                                                <div className="text-xs text-gray-600 truncate">{source.description}</div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Credential Selection */}
                        {credentialRequired && (
                            <div className="mb-4">
                                <h3 className="text-sm font-medium text-gray-900 mb-3">
                                    {selectedSource.toUpperCase()} Credentials
                                </h3>
                                <CredentialSelector
                                    service={selectedSource === 'git' ? 'github' : selectedSource}
                                    selectedCredentialId={selectedCredentialId}
                                    onCredentialSelect={setSelectedCredentialId}
                                    required={true}
                                    placeholder={`Select ${selectedSource.toUpperCase()} credentials`}
                                    onAddCredential={() => {
                                        // Open credentials manager
                                        const event = new CustomEvent('open-credentials-manager');
                                        window.dispatchEvent(event);
                                    }}
                                />
                                {!selectedCredentialId && (
                                    <p className="text-xs text-red-600 mt-1">
                                        ⚠️ Credentials required for {selectedSource.toUpperCase()} import
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Panel - Import Configuration and Results */}
                    <div className="flex-1 p-4 overflow-y-auto">
                        {/* File/Text Import */}
                        {selectedSource === 'file' && (
                            <div className="mb-4">
                                <div className="flex gap-2 mb-3">
                                <button
                                    onClick={() => setShowTextImport(false)}
                                    className={`text-xs px-2 py-1 rounded transition-colors ${
                                        !showTextImport
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    Upload Files
                                </button>
                                <button
                                    onClick={() => setShowTextImport(true)}
                                    className={`text-xs px-2 py-1 rounded transition-colors ${
                                        showTextImport
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    Paste Text
                                </button>
                            </div>

                            {!showTextImport ? (
                                <div className="space-y-3">
                                    <div
                                        className={`border-2 border-dashed rounded p-4 text-center transition-colors ${
                                            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                                        }`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <div className="text-2xl mb-2">□</div>
                                        <p className="text-sm font-medium text-gray-900 mb-1">
                                            Drop files here or click to browse
                                        </p>
                                        <p className="text-xs text-gray-600 mb-3">
                                            Supports documents, images, and text files
                                        </p>
                                        <input
                                            type="file"
                                            multiple
                                            onChange={handleFileSelect}
                                            className="hidden"
                                            id="file-upload"
                                        />
                                        <label
                                            htmlFor="file-upload"
                                            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs cursor-pointer transition-colors"
                                        >
                                            Choose Files
                                        </label>
                                    </div>

                                    {selectedFiles.length > 0 && (
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {selectedFiles.map((file, index) => (
                                                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm">
                                                            {file.type.startsWith('image/') ? '📷' :
                                                             file.type.includes('pdf') ? '📄' :
                                                             file.type.includes('word') ? '📝' : '📄'}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium text-gray-900 truncate">{file.name}</div>
                                                            <div className="text-gray-600">{formatFileSize(file.size)}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFile(index)}
                                                        className="text-gray-400 hover:text-red-600 ml-2"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Title (optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={textTitle}
                                            onChange={(e) => setTextTitle(e.target.value)}
                                            placeholder="Enter a title for this content"
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Content
                                        </label>
                                        <textarea
                                            value={textContent}
                                            onChange={(e) => setTextContent(e.target.value)}
                                            placeholder="Paste or type your content here..."
                                            rows={4}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={executeFileTextImport}
                                    disabled={(!showTextImport && selectedFiles.length === 0) || (showTextImport && !textContent.trim()) || importing}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-1 rounded transition-colors text-xs font-medium"
                                >
                                    {importing ? 'Importing...' :
                                     !showTextImport ? 'Upload Files' : 'Import Text'}
                                </button>
                            </div>
                            </div>
                        )}

                        {/* Query-based Import */}
                        {selectedSource !== 'file' && (
                            <div className="mb-6">
                                {loading ? (
                                    <div className="text-center py-6">
                                        <div className="text-gray-500 text-sm">Loading templates...</div>
                                    </div>
                                ) : queries ? (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-medium text-gray-900">Query Templates</h3>
                                            <button
                                                onClick={() => setShowCustomForm(true)}
                                                className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 transition-colors"
                                            >
                                                Custom Query
                                            </button>
                                        </div>
                                        <div className="space-y-2 max-h-32 overflow-y-auto">
                                            {queries.templates.popular.map((template: any) => (
                                                <button
                                                    key={template.id}
                                                    onClick={() => {
                                                        setSelectedQuery(template);
                                                        setCustomQuery(template.query);
                                                        setShowCustomForm(true);
                                                    }}
                                                    className="w-full text-left p-2 border border-gray-200 rounded text-xs hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="font-medium text-gray-900 truncate">{template.name}</div>
                                                    <div className="text-gray-600 mt-1 truncate">{template.description}</div>
                                                </button>
                                            ))}
                                        </div>

                                        {showCustomForm && (
                                            <div className="mt-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
                                                <h4 className="font-medium text-gray-900 mb-2 text-sm">
                                                    {selectedQuery ? selectedQuery.name : 'Custom Query'}
                                                </h4>
                                                <textarea
                                                    value={customQuery}
                                                    onChange={(e) => setCustomQuery(e.target.value)}
                                                    placeholder="Enter your search query..."
                                                    rows={2}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={executeQuery}
                                                        disabled={!customQuery.trim() || importing}
                                                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                                                    >
                                                        {importing ? 'Importing...' : 'Execute Query'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedQuery(null);
                                                            setCustomQuery('');
                                                            setShowCustomForm(false);
                                                        }}
                                                        className="px-3 py-1 text-gray-600 hover:text-gray-800 text-xs"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        <div className="text-2xl mb-1">◉</div>
                                        <p className="text-sm">Select a pre-made query or create a custom one to get started</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Import Results */}
                        {importResults && (
                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-sm font-medium text-gray-900 mb-3">Import Results</h3>
                                {importResults.success ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-green-600 font-medium text-sm">
                                                Success - {importResults.total} items found
                                            </span>
                                            {importResults.items.length > 0 && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            // Select all items
                                                            const allIds = importResults.items.map((item: any) => item.id);
                                                            setSelectedImportItems(new Set(allIds));
                                                        }}
                                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs transition-colors"
                                                    >
                                                        Select All
                                                    </button>
                                                    <button
                                                        onClick={addSelectedToLibrary}
                                                        disabled={selectedImportItems.size === 0}
                                                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-2 py-1 rounded text-xs transition-colors"
                                                    >
                                                        Add Selected to Library ({selectedImportItems.size})
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {importResults.items.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                                                {importResults.items.map((item: any) => (
                                                    <div 
                                                        key={item.id} 
                                                        className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                                                            libraryItems.has(item.id) ? 'border-green-300 bg-green-50 cursor-not-allowed' : 
                                                            addingToLibrary.has(item.id) ? 'border-blue-300 bg-blue-50 cursor-wait' : 
                                                            selectedImportItems.has(item.id) ? 'border-blue-500 bg-blue-50 shadow-sm' :
                                                            'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                        onClick={() => {
                                                            if (!libraryItems.has(item.id) && !addingToLibrary.has(item.id)) {
                                                                const newSelected = new Set(selectedImportItems);
                                                                if (selectedImportItems.has(item.id)) {
                                                                    newSelected.delete(item.id);
                                                                } else {
                                                                    newSelected.add(item.id);
                                                                }
                                                                setSelectedImportItems(newSelected);
                                                            }
                                                        }}
                                                    >
                                                        <div className="space-y-2">
                                                            <div className="flex items-start justify-between">
                                                                <h4 className="font-medium text-gray-900 text-sm line-clamp-2 flex-1">{item.title}</h4>
                                                                {selectedImportItems.has(item.id) && !libraryItems.has(item.id) && !addingToLibrary.has(item.id) && (
                                                                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 ml-2">
                                                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-600 line-clamp-3">{item.preview}</p>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                {item.source === 'git' && (
                                                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                                        📁 {item.content?.owner}/{item.content?.repo}
                                                                    </span>
                                                                )}
                                                                {item.source === 'jira' && (
                                                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                                        🎫 {item.content?.key}
                                                                    </span>
                                                                )}
                                                                {libraryItems.has(item.id) && (
                                                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded ml-auto">
                                                                        ✓ In Library
                                                                    </span>
                                                                )}
                                                                {addingToLibrary.has(item.id) && (
                                                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded ml-auto">
                                                                        Adding...
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 text-gray-500">
                                                <div className="text-sm">No items returned from query</div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-red-50 border border-red-200 rounded p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">
                                                Error
                                            </span>
                                        </div>
                                        <p className="text-red-700 text-xs">{importResults.error}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}