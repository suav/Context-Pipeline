/**
 * Context Import Pipeline - Main Page
 * 
 * Universal context import system built on Next.js
 */

'use client';

import { useState, useEffect } from 'react';
import { STAGE_CONFIG, SOURCE_CONFIG } from '@/features/context-import/types';
import { LibraryStage as NewLibraryStage } from '@/features/context-library/components/LibraryStage';
import { WorkspaceStage as NewWorkspaceStage } from '@/features/workspaces/components/WorkspaceStage';
import { LazyWrapper } from '@/components/LazyWrapper';

export default function ContextPipeline() {
    const [currentStage, setCurrentStage] = useState('import');
    const [apiHealth, setApiHealth] = useState<string>('checking...');
    const [showLazyTest, setShowLazyTest] = useState(false);

    // Test API connection
    useEffect(() => {
        const testAPI = async () => {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                setApiHealth(`✅ ${data.pipeline}`);
            } catch {
                setApiHealth('❌ API not available');
            }
        };
        
        testAPI();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-6xl mx-auto">
                {/* Compact Header with Inline Stages */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">
                            🗃️ Context Import Pipeline v2
                        </h1>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-600">Universal context import system - UPDATED</span>
                            <span className="text-gray-500">API: {apiHealth}</span>
                            <button 
                                onClick={() => setShowLazyTest(!showLazyTest)}
                                className="text-blue-600 hover:text-blue-800 text-xs border border-blue-200 px-2 py-1 rounded"
                            >
                                {showLazyTest ? 'Hide' : 'Test Lazy'} 
                            </button>
                        </div>
                    </div>
                    
                    {/* Inline Stage Navigation */}
                    <div className="flex gap-2 overflow-x-auto">
                        {STAGE_CONFIG.map(stage => (
                            <button
                                key={stage.key}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors text-sm ${
                                    currentStage === stage.key
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                }`}
                                onClick={() => setCurrentStage(stage.key)}
                            >
                                <span>{stage.icon}</span>
                                <span>{stage.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lazy Loading Test */}
                {showLazyTest && (
                    <div className="mb-4">
                        <LazyWrapper show={showLazyTest} />
                    </div>
                )}

                {/* Stage Content */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 min-h-96">
                    {currentStage === 'import' && <ImportStage />}
                    {currentStage === 'library' && <NewLibraryStage />}
                    {currentStage === 'workspace' && <NewWorkspaceStage />}
                </div>
            </div>
        </div>
    );
}

function ImportStage() {
    const [selectedSource, setSelectedSource] = useState('jira');
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

    const loadQueries = async (source: string) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/context-workflow/queries/${source}`);
            const data = await response.json();
            setQueries(data.queries);
        } catch (error) {
            console.error('Failed to load queries:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadQueries(selectedSource);
        setSelectedQuery(null);
        setShowCustomForm(false);
    }, [selectedSource]);

    // Load existing library items on mount
    useEffect(() => {
        try {
            const existingLibrary = JSON.parse(localStorage.getItem('context-library') || '[]');
            const existingIds = new Set<string>(existingLibrary.map((item: any) => item.id as string));
            setLibraryItems(existingIds);
        } catch (error) {
            console.error('Failed to load library items:', error);
        }
    }, []);

    const handleQuerySelect = (template: any) => {
        setSelectedQuery(template);
        setCustomQuery(template.query);
        setShowCustomForm(false);
    };

    const handleCustomQuery = () => {
        setShowCustomForm(true);
        setSelectedQuery(null);
        setCustomQuery('');
    };

    const executeQuery = async () => {
        if (!customQuery.trim()) return;
        
        setImporting(true);
        setImportResults(null);
        
        try {
            console.log('🚀 Executing query:', customQuery);
            
            const response = await fetch('/api/context-workflow/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    source: selectedSource,
                    searchParams: customQuery
                })
            });
            
            const result = await response.json();
            console.log('✅ Import result:', result);
            
            setImportResults(result);
            
        } catch (error) {
            console.error('❌ Import failed:', error);
            setImportResults({
                success: false,
                source: selectedSource,
                error: `Failed to execute query: ${(error as Error).message}`,
                items: [],
                total: 0
            });
        } finally {
            setImporting(false);
        }
    };

    const toggleItemExpansion = (itemId: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(itemId)) {
            newExpanded.delete(itemId);
        } else {
            newExpanded.add(itemId);
        }
        setExpandedItems(newExpanded);
    };

    const addToLibrary = async (item: any) => {
        const itemId = item.id;
        setAddingToLibrary(prev => new Set([...prev, itemId]));
        
        try {
            console.log('🚀 Adding to Library:', item);
            
            // For now, use localStorage as a simple library
            const existingLibrary = JSON.parse(localStorage.getItem('context-library') || '[]');
            
            // Check if item already exists with same clone mode
            const duplicateKey = `${item.id}-${item.clone_mode || 'context-only'}`;
            const exists = existingLibrary.some((libItem: any) => 
                `${libItem.id}-${libItem.library_metadata?.clone_mode || 'context-only'}` === duplicateKey
            );
            if (exists) {
                const modeText = item.clone_mode ? ` (${item.clone_mode})` : '';
                console.log('⚠️ Item already in library with same mode:', duplicateKey);
                alert(`Item already in library${modeText}!`);
                return;
            }
            
            console.log('✅ Adding new item with key:', duplicateKey);
            
            // Add to library with metadata
            const libraryItem = {
                ...item,
                library_metadata: {
                    added_at: new Date().toISOString(),
                    status: 'active',
                    clone_mode: item.clone_mode || 'context-only' // Track clone mode
                }
            };
            
            existingLibrary.push(libraryItem);
            localStorage.setItem('context-library', JSON.stringify(existingLibrary));
            
            // Update UI state to remove from import list
            setLibraryItems(prev => new Set([...prev, item.id]));
            
            // Sync to file system periodically
            syncToFileSystem(existingLibrary);
            
            console.log('✅ Added to Library:', libraryItem.id);
            const modeText = item.clone_mode === 'writeable' ? ' (Write Access)' : 
                            item.clone_mode === 'read-only' ? ' (Read-Only)' : '';
            alert(`✅ Added "${item.title}" to library${modeText}!`);
            
        } catch (error) {
            console.error('❌ Library add failed:', error);
            alert('❌ Failed to add to library');
        } finally {
            setAddingToLibrary(prev => {
                const newSet = new Set(prev);
                newSet.delete(itemId);
                return newSet;
            });
        }
    };

    const syncToFileSystem = async (libraryData: any[]) => {
        try {
            console.log('🔄 Syncing library to file system...');
            
            const response = await fetch('/api/context-workflow/library', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'sync',
                    libraryData: libraryData
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Library synced to file system:', result.itemCount, 'items');
            } else {
                console.error('❌ Failed to sync library:', result.error);
            }
            
        } catch (error) {
            console.error('❌ Sync failed:', error);
        }
    };

    const extractJiraDescription = (item: any) => {
        const desc = item.content?.description;
        if (!desc || typeof desc !== 'object') return null;
        
        // Extract text from JIRA document structure
        const extractText = (content: any): string => {
            if (!content) return '';
            if (typeof content === 'string') return content;
            if (content.text) return content.text;
            if (content.content && Array.isArray(content.content)) {
                return content.content.map(extractText).join(' ');
            }
            return '';
        };
        
        return extractText(desc);
    };

    return (
        <div>
            <h3 className="text-xl font-semibold mb-4">📥 Import from Source</h3>
            
            {/* Source Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {SOURCE_CONFIG.map(source => (
                    <button
                        key={source.type}
                        className={`p-3 rounded-lg border-2 transition-colors text-left ${
                            selectedSource === source.type
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedSource(source.type)}
                    >
                        <div className="text-xl mb-1">{source.icon}</div>
                        <div className="font-medium text-gray-900 text-sm">{source.name}</div>
                        <div className="text-xs text-gray-600">{source.description}</div>
                    </button>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Query Templates */}
                <div>
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading queries...</div>
                    ) : queries ? (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-gray-900">
                                    Popular Queries for {selectedSource.toUpperCase()}
                                </h4>
                                <button
                                    onClick={handleCustomQuery}
                                    className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg transition-colors"
                                >
                                    ✏️ Custom Query
                                </button>
                            </div>
                            
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {queries.templates.popular.map((template: any) => (
                                    <button
                                        key={template.id}
                                        onClick={() => handleQuerySelect(template)}
                                        className={`w-full p-3 border rounded-lg text-left transition-colors ${
                                            selectedQuery?.id === template.id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="font-medium text-gray-900 text-sm">{template.name}</div>
                                        <div className="text-xs text-gray-600 mb-2">{template.description}</div>
                                        <div className="text-xs font-mono text-gray-500 bg-gray-100 p-1 rounded">
                                            {template.query.substring(0, 60)}...
                                        </div>
                                    </button>
                                ))}
                            </div>
                            
                            <div className="mt-3 text-xs text-gray-500">
                                {queries.templates.all.length} templates available
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">No queries available</div>
                    )}
                </div>

                {/* Query Editor & Execution */}
                <div>
                    <h4 className="font-medium text-gray-900 mb-3">
                        {selectedQuery ? `Selected: ${selectedQuery.name}` : showCustomForm ? 'Custom Query' : 'Select or Create Query'}
                    </h4>
                    
                    {(selectedQuery || showCustomForm) ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Query ({selectedSource.toUpperCase()} syntax)
                                </label>
                                <textarea
                                    value={customQuery}
                                    onChange={(e) => setCustomQuery(e.target.value)}
                                    className="w-full h-32 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={SOURCE_CONFIG.find(s => s.type === selectedSource)?.placeholder}
                                />
                            </div>
                            
                            {selectedQuery && (
                                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                    <strong>About:</strong> {selectedQuery.description}
                                </div>
                            )}
                            
                            <div className="flex gap-2">
                                <button
                                    onClick={executeQuery}
                                    disabled={!customQuery.trim() || importing}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                                >
                                    {importing ? '⏳ Importing...' : '🔍 Execute Query'}
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedQuery(null);
                                        setShowCustomForm(false);
                                        setCustomQuery('');
                                    }}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <div className="text-4xl mb-2">🎯</div>
                            <p>Select a pre-made query or create a custom one to get started</p>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Import Results */}
            {importResults && (
                <div className="mt-6 border-t pt-6">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-900">Import Results</h4>
                        {selectedImportItems.size > 0 && (
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600">
                                    {selectedImportItems.size} selected
                                </span>
                                <button
                                    onClick={async () => {
                                        const itemsToAdd = importResults.items.filter((item: any) => 
                                            selectedImportItems.has(item.id) && !libraryItems.has(item.id)
                                        );
                                        
                                        // Check if any are Git repos
                                        const gitItems = itemsToAdd.filter((item: any) => item.source === 'git');
                                        const nonGitItems = itemsToAdd.filter((item: any) => item.source !== 'git');
                                        
                                        // Add non-git items directly
                                        for (const item of nonGitItems) {
                                            await addToLibrary(item);
                                        }
                                        
                                        // Handle Git items with clone mode selection
                                        if (gitItems.length > 0) {
                                            const cloneMode = window.prompt(
                                                `You have ${gitItems.length} Git repository(ies) selected.\n\n` +
                                                'How would you like to add them?\n\n' +
                                                '1 = Read-Only (for reference)\n' +
                                                '2 = Write Access (for development)\n' +
                                                '3 = Both (add twice)',
                                                '1'
                                            );
                                            
                                            if (cloneMode === '1' || cloneMode === '3') {
                                                for (const item of gitItems) {
                                                    await addToLibrary({...item, clone_mode: 'read-only'});
                                                }
                                            }
                                            if (cloneMode === '2' || cloneMode === '3') {
                                                for (const item of gitItems) {
                                                    await addToLibrary({...item, clone_mode: 'writeable'});
                                                }
                                            }
                                        }
                                        
                                        setSelectedImportItems(new Set());
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                >
                                    📚 Add Selected to Library
                                </button>
                                <button
                                    onClick={() => setSelectedImportItems(new Set())}
                                    className="text-gray-600 hover:text-gray-800 text-sm"
                                >
                                    Clear Selection
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {importResults.success ? (
                        <div>
                            <div className="flex items-center gap-2 mb-4 text-sm">
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                    ✅ Success
                                </span>
                                <span className="text-gray-600">
                                    Found {importResults.total} items from {importResults.source.toUpperCase()}
                                </span>
                            </div>
                            
                            {importResults.items.length > 0 ? (
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {importResults.items.filter((item: any) => !libraryItems.has(item.id)).map((item: any, index: number) => {
                                        const isExpanded = expandedItems.has(item.id);
                                        const jiraDesc = extractJiraDescription(item);
                                        
                                        return (
                                            <div 
                                                key={item.id || index} 
                                                onClick={(e) => {
                                                    if (!(e.target as HTMLElement).closest('button')) {
                                                        const newSelected = new Set(selectedImportItems);
                                                        if (newSelected.has(item.id)) {
                                                            newSelected.delete(item.id);
                                                        } else {
                                                            newSelected.add(item.id);
                                                        }
                                                        setSelectedImportItems(newSelected);
                                                    }
                                                }}
                                                className={`border rounded-lg p-4 bg-white cursor-pointer transition-all ${
                                                    selectedImportItems.has(item.id) 
                                                        ? 'border-blue-500 ring-2 ring-blue-200' 
                                                        : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <h5 className="font-medium text-gray-900 text-sm">{item.title}</h5>
                                                    <div className="flex gap-1">
                                                        {item.tags?.slice(0, 3).map((tag: string) => (
                                                            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-600 mb-2">{item.preview}</p>
                                                
                                                {/* JIRA Description Expansion */}
                                                {item.source === 'jira' && jiraDesc && (
                                                    <div className="mb-3">
                                                        <button
                                                            onClick={() => toggleItemExpansion(item.id)}
                                                            className="text-xs text-blue-600 hover:text-blue-800 mb-2"
                                                        >
                                                            {isExpanded ? '▼ Hide Details' : '▶ Show Details'}
                                                        </button>
                                                        {isExpanded && (
                                                            <div className="text-xs text-gray-700 bg-gray-50 p-3 rounded border-l-4 border-blue-200">
                                                                <div className="font-medium mb-2">Description:</div>
                                                                <div className="whitespace-pre-wrap">{jiraDesc}</div>
                                                                {item.metadata && (
                                                                    <div className="mt-3 pt-2 border-t border-gray-200">
                                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                                            <div><strong>Status:</strong> {item.metadata.status}</div>
                                                                            <div><strong>Priority:</strong> {item.metadata.priority}</div>
                                                                            <div><strong>Assignee:</strong> {item.metadata.assignee}</div>
                                                                            <div><strong>Updated:</strong> {new Date(item.metadata.updated).toLocaleDateString()}</div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {/* Context Options */}
                                                <div className="flex gap-2 mt-3">
                                                    {item.source === 'git' && (
                                                        <>
                                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                                🔍 Read-Only Available
                                                            </span>
                                                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                                                                ✏️ Write Access Available
                                                            </span>
                                                        </>
                                                    )}
                                                    
                                                    <button 
                                                        onClick={() => {
                                                            const url = item.metadata?.jira_url || 
                                                                        item.metadata?.html_url || 
                                                                        (item.source === 'git' ? `https://github.com/${item.content?.owner}/${item.content?.repo}/tree/${item.content?.branch || 'main'}` : '');
                                                            if (url) window.open(url, '_blank');
                                                        }}
                                                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded transition-colors"
                                                    >
                                                        🔗 Open Source
                                                    </button>
                                                </div>
                                                
                                                <div className="text-xs text-gray-500 mt-2">
                                                    Source: {item.source} • Size: {Math.round(item.size_bytes / 1024)}KB
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    {importResults.items.length > 0 && importResults.items.every((item: any) => libraryItems.has(item.id))
                                        ? "All items have been added to library!"
                                        : "No items returned from query"
                                    }
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                                    ❌ Error
                                </span>
                            </div>
                            <p className="text-red-700 text-sm">{importResults.error}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}