/**
 * Monaco Editor Area Component
 * 
 * Tabbed Monaco editor interface (35-45% height)
 * Features: file tabs, Monaco editor integration, git diffs
 */

'use client';

import { useState, Suspense, lazy, useEffect } from 'react';

// Lazy load Monaco editor when actually needed
const LazyMonacoEditor = lazy(() => import('@monaco-editor/react').then(m => ({ default: m.default })));

interface MonacoEditorAreaProps {
  openFiles: string[];
  activeFile: string | null;
  onFileSelect: (filePath: string) => void;
  onFileClose: (filePath: string) => void;
  workspaceId: string;
}

export function MonacoEditorArea({ 
  openFiles, 
  activeFile, 
  onFileSelect, 
  onFileClose, 
  workspaceId 
}: MonacoEditorAreaProps) {
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({});
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [fileLanguages, setFileLanguages] = useState<Record<string, string>>({});
  const [showingDiff, setShowingDiff] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<Record<string, string>>({});

  const getFileName = (filePath: string) => {
    return filePath.split('/').pop() || filePath;
  };

  const getFileExtension = (filePath: string) => {
    return filePath.split('.').pop() || '';
  };

  const getLanguage = (filePath: string) => {
    // Use cached language from API if available
    if (fileLanguages[filePath]) {
      return fileLanguages[filePath];
    }
    
    const ext = getFileExtension(filePath);
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return 'typescript';
      case 'ts':
        return 'typescript';
      case 'js':
        return 'javascript';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'css':
        return 'css';
      case 'scss':
        return 'scss';
      default:
        return 'plaintext';
    }
  };

  // Load file content from API
  const loadFileContent = async (filePath: string) => {
    if (fileContents[filePath] || loadingFiles.has(filePath)) {
      return; // Already loaded or loading
    }

    setLoadingFiles(prev => new Set(prev).add(filePath));
    setFileErrors(prev => ({ ...prev, [filePath]: '' }));

    try {
      // Convert workspace path to actual file path
      const relativePath = filePath.replace('/workspace/', '');
      const response = await fetch(`/api/workspaces/${workspaceId}/files/content?path=${encodeURIComponent(relativePath)}`);
      
      if (response.ok) {
        const data = await response.json();
        setFileContents(prev => ({ ...prev, [filePath]: data.content }));
        setFileLanguages(prev => ({ ...prev, [filePath]: data.language }));
      } else {
        const error = await response.json();
        setFileErrors(prev => ({ ...prev, [filePath]: error.error || 'Failed to load file' }));
        setFileContents(prev => ({ ...prev, [filePath]: `// Error loading file: ${error.error || 'Unknown error'}\n// File: ${filePath}` }));
      }
    } catch (error) {
      console.error('Error loading file content:', error);
      setFileErrors(prev => ({ ...prev, [filePath]: 'Network error' }));
      setFileContents(prev => ({ ...prev, [filePath]: `// Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}\n// File: ${filePath}` }));
    } finally {
      setLoadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    }
  };

  // Load file content when active file changes
  useEffect(() => {
    if (activeFile) {
      loadFileContent(activeFile);
    }
  }, [activeFile, workspaceId]);

  // Load content for all open files
  useEffect(() => {
    openFiles.forEach(filePath => {
      if (!fileContents[filePath] && !loadingFiles.has(filePath)) {
        loadFileContent(filePath);
      }
    });
  }, [openFiles, workspaceId]);

  const handleEditorChange = (value: string | undefined, filePath: string) => {
    if (value !== undefined) {
      setFileContents(prev => ({ ...prev, [filePath]: value }));
      setIsDirty(prev => ({ ...prev, [filePath]: true }));
    }
  };

  const handleSaveFile = async (filePath: string) => {
    const content = fileContents[filePath];
    if (!content) return;

    try {
      // Convert workspace path to actual file path
      const relativePath = filePath.replace('/workspace/', '');
      const response = await fetch(`/api/workspaces/${workspaceId}/files/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: relativePath,
          content: content
        })
      });

      if (response.ok) {
        setIsDirty(prev => ({ ...prev, [filePath]: false }));
        // Trigger file modification update
        window.dispatchEvent(new CustomEvent('fileModified', { 
          detail: { filePath, modified: true } 
        }));
      } else {
        const error = await response.json();
        console.error('Failed to save file:', error);
        alert(`Failed to save file: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      alert('Error saving file: Network error');
    }
  };

  const handleShowGitDiff = async (filePath: string) => {
    try {
      const relativePath = filePath.replace('/workspace/', '');
      const response = await fetch(`/api/workspaces/${workspaceId}/git/diff?file=${encodeURIComponent(relativePath)}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.hasChanges) {
          setDiffContent(prev => ({ ...prev, [filePath]: data.diff }));
          setShowingDiff(filePath);
        } else {
          alert('No git changes found for this file');
        }
      } else {
        const error = await response.json();
        alert(`Failed to get git diff: ${error.error}`);
      }
    } catch (error) {
      console.error('Error getting git diff:', error);
      alert('Error getting git diff: Network error');
    }
  };

  const handleCloseDiff = () => {
    setShowingDiff(null);
  };

  const FileIcon = ({ extension }: { extension: string }) => {
    switch (extension) {
      case 'tsx':
      case 'jsx':
        return '⚛️';
      case 'ts':
      case 'js':
        return '📄';
      case 'json':
        return '📋';
      case 'md':
        return '📝';
      case 'css':
      case 'scss':
        return '🎨';
      default:
        return '📄';
    }
  };

  if (openFiles.length === 0) {
    return (
      <div 
        className="h-full flex items-center justify-center border-b"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="text-center">
          <div className="text-4xl mb-4">📝</div>
          <h3 
            className="text-lg font-medium mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            No files open
          </h3>
          <p 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Select a file from the explorer to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-full flex flex-col"
      style={{
        backgroundColor: 'var(--color-surface)',
      }}
    >

      {/* Editor Content */}
      <div className="flex-1">
        {activeFile ? (
          <div className="h-full flex flex-col">
            {/* Editor Toolbar */}
            <div 
              className="flex items-center justify-between px-4 py-2 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <span>{getFileName(activeFile)}</span>
                <span>•</span>
                <span>{getLanguage(activeFile)}</span>
                {loadingFiles.has(activeFile) && (
                  <>
                    <span>•</span>
                    <span className="text-blue-500">Loading...</span>
                  </>
                )}
                {fileErrors[activeFile] && (
                  <>
                    <span>•</span>
                    <span className="text-red-500">Error</span>
                  </>
                )}
                {isDirty[activeFile] && (
                  <>
                    <span>•</span>
                    <span className="text-orange-500">Modified</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveFile(activeFile)}
                  disabled={!isDirty[activeFile]}
                  className="px-3 py-1 text-sm rounded transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-inverse)',
                  }}
                >
                  💾 Save
                </button>
                <button
                  onClick={() => {
                    if (showingDiff === activeFile) {
                      handleCloseDiff();
                    } else {
                      handleShowGitDiff(activeFile);
                    }
                  }}
                  className="px-3 py-1 text-sm rounded transition-colors"
                  style={{
                    backgroundColor: showingDiff === activeFile ? 'var(--color-accent)' : 'var(--color-surface-elevated)',
                    color: showingDiff === activeFile ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                  }}
                >
                  🔄 {showingDiff === activeFile ? 'Hide Diff' : 'Git Diff'}
                </button>
              </div>
            </div>
            
            {/* Monaco Editor */}
            <div className="flex-1">
              <Suspense fallback={
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary)' }} />
                    <p style={{ color: 'var(--color-text-secondary)' }}>Loading editor...</p>
                  </div>
                </div>
              }>
                <LazyMonacoEditor
                  height="100%"
                  language={showingDiff === activeFile ? 'diff' : getLanguage(activeFile)}
                  value={
                    showingDiff === activeFile && diffContent[activeFile]
                      ? diffContent[activeFile]
                      : fileContents[activeFile] || (loadingFiles.has(activeFile) ? `// Loading ${getFileName(activeFile)}...\n// Please wait while the file content is being fetched...` : `// File not loaded yet\n// File: ${activeFile}`)
                  }
                  onChange={(value) => {
                    if (showingDiff !== activeFile) {
                      handleEditorChange(value, activeFile);
                    }
                  }}
                  theme="vs-dark" // TODO: Make theme-aware
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                    tabSize: 2,
                    readOnly: loadingFiles.has(activeFile) || !!fileErrors[activeFile] || showingDiff === activeFile,
                  }}
                />
              </Suspense>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p style={{ color: 'var(--color-text-muted)' }}>
              Select a file tab to edit
            </p>
          </div>
        )}
      </div>
    </div>
  );
}