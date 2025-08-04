/**
 * Monaco Editor Area Component
 *
 * Tabbed Monaco editor interface (35-45% height)
 * Features: file tabs, Monaco editor integration, git diffs
 */
'use client';
import { useState, Suspense, lazy, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/lib/theme-context';
import { editorConfigManager } from '../services/EditorConfigManager';
import { editor } from 'monaco-editor';
// Lazy load Monaco editor when actually needed
const LazyMonacoEditor = lazy(() => import('@monaco-editor/react').then(m => ({ default: m.default })));
interface MonacoEditorAreaProps {
  openFiles: string[];
  activeFile: string | null;
  onFileSelect: (filePath: string) => void;
  onFileClose: (filePath: string) => void;
  workspaceId: string;
  onFileReadOnlyChange?: (fileReadOnly: Record<string, boolean>) => void;
  hideTerminal?: boolean;
  hideEditor?: boolean;
  onToggleTerminal?: () => void;
  onToggleEditor?: () => void;
  onShowBoth?: () => void;
}
export function MonacoEditorArea({
  openFiles,
  activeFile,
  onFileSelect,
  onFileClose,
  workspaceId,
  onFileReadOnlyChange,
  hideTerminal = false,
  hideEditor = false,
  onToggleTerminal,
  onToggleEditor,
  onShowBoth
}: MonacoEditorAreaProps) {
  const { currentTheme } = useTheme();
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [originalFileContents, setOriginalFileContents] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({});
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [fileLanguages, setFileLanguages] = useState<Record<string, string>>({});
  const [fileReadOnly, setFileReadOnly] = useState<Record<string, boolean>>({});
  const [showingDiff, setShowingDiff] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<Record<string, string>>({});
  const [isAutoSaving, setIsAutoSaving] = useState<Record<string, boolean>>({});
  const [minimapEnabled, setMinimapEnabled] = useState(
    () => editorConfigManager.getConfig().minimap
  );
  const [fileGitStatus, setFileGitStatus] = useState<Record<string, { hasChanges: boolean; status: string }>>({});
  const gitStatusTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof editor | null>(null);
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
    // Use the EditorConfigManager for language detection
    return editorConfigManager.getFileLanguage(filePath);
  };
  // Initialize Monaco and theme
  const handleMonacoMount = useCallback((editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Initialize the editor config manager
    editorConfigManager.setMonacoInstance(monaco);
    editorConfigManager.setTheme(currentTheme);
    // Register the editor for the active file
    if (activeFile) {
      editorConfigManager.registerEditor(activeFile, editor);
      
      // Set up proper dirty state tracking using Monaco's model change events
      const model = editor.getModel();
      if (model && !fileReadOnly[activeFile]) {
        // Track the original version ID to detect real changes
        let originalVersionId = model.getAlternativeVersionId();
        
        // Update original version when file loads
        const updateOriginalVersion = () => {
          originalVersionId = model.getAlternativeVersionId();
        };
        
        // Listen for content changes
        const disposable = model.onDidChangeContent(() => {
          const currentVersionId = model.getAlternativeVersionId();
          const isDirtyNow = currentVersionId !== originalVersionId;
          
          // Only update dirty state for non-read-only files
          if (!fileReadOnly[activeFile]) {
            setIsDirty(prev => ({ ...prev, [activeFile]: isDirtyNow }));
            editorConfigManager.updateFileCache(activeFile, model.getValue(), isDirtyNow);
          }
        });
        
        // Store disposable for cleanup
        editor._dirtyStateDisposable = disposable;
        editor._updateOriginalVersion = updateOriginalVersion;
      }
    }
  }, [currentTheme, activeFile, fileReadOnly]);
  // Update theme when it changes
  useEffect(() => {
    if (monacoRef.current) {
      editorConfigManager.setTheme(currentTheme);
    }
  }, [currentTheme]);
  // Handle editor cleanup
  useEffect(() => {
    return () => {
      if (activeFile) {
        editorConfigManager.unregisterEditor(activeFile);
      }
      // Clean up Monaco model change listeners
      if (editorRef.current && editorRef.current._dirtyStateDisposable) {
        editorRef.current._dirtyStateDisposable.dispose();
      }
      // Clear all git status timeouts on unmount
      Object.values(gitStatusTimeouts.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [activeFile]);
  // Handle auto-save events
  useEffect(() => {
    const handleAutoSave = async (event: CustomEvent) => {
      const { filePath, content } = event.detail;
      if (filePath && content) {
        setIsAutoSaving(prev => ({ ...prev, [filePath]: true }));
        try {
          await handleSaveFile(filePath, content, true);
        } finally {
          setIsAutoSaving(prev => ({ ...prev, [filePath]: false }));
        }
      }
    };
    window.addEventListener('editorAutoSave', handleAutoSave as EventListener);
    return () => {
      window.removeEventListener('editorAutoSave', handleAutoSave as EventListener);
    };
  }, []);
  // Load file content from API
  const loadFileContent = async (filePath: string) => {
    // CRITICAL: Multiple checks to prevent undefined errors
    if (filePath === null || filePath === undefined) {
      console.error('MonacoEditor: filePath is null or undefined:', filePath);
      return;
    }
    if (typeof filePath !== 'string') {
      console.error('MonacoEditor: filePath is not a string:', { filePath, type: typeof filePath });
      return;
    }
    if (filePath === '' || filePath === 'undefined') {
      console.error('MonacoEditor: filePath is empty or string "undefined":', filePath);
      return;
    }
    
    if (fileContents[filePath] || loadingFiles.has(filePath)) {
      console.log('MonacoEditor: File already loaded or loading, skipping:', filePath);
      return; // Already loaded or loading
    }
    setLoadingFiles(prev => new Set(prev).add(filePath));
    setFileErrors(prev => ({ ...prev, [filePath]: '' }));
    try {
      // Convert workspace path to actual file path
      // Remove /workspace/ prefix if present, otherwise use path as-is
      const relativePath = filePath.startsWith('/workspace/') 
        ? filePath.replace('/workspace/', '') 
        : filePath.startsWith('/') 
          ? filePath.substring(1)  // Remove leading slash
          : filePath;
      
      console.log('MonacoEditor: Loading file content:', { originalPath: filePath, relativePath });
      const response = await fetch(`/api/workspaces/${workspaceId}/files/content?path=${encodeURIComponent(relativePath)}`);
      console.log('MonacoEditor: API response:', { status: response.status, url: response.url });
      if (response.ok) {
        const data = await response.json();
        console.log('MonacoEditor: File data received:', { filePath, hasContent: !!data.content, readOnly: data.readOnly });
        setFileContents(prev => ({ ...prev, [filePath]: data.content }));
        setOriginalFileContents(prev => ({ ...prev, [filePath]: data.content }));
        setFileLanguages(prev => ({ ...prev, [filePath]: data.language }));
        setFileReadOnly(prev => {
          const updated = { ...prev, [filePath]: data.readOnly || false };
          // Notify parent component about read-only status change
          if (onFileReadOnlyChange) {
            onFileReadOnlyChange(updated);
          }
          return updated;
        });
        
        // Reset dirty state for this file (especially important for read-only files)
        setIsDirty(prev => ({ ...prev, [filePath]: false }));
        
        // Update original version in Monaco editor if it's the active file
        if (filePath === activeFile && editorRef.current && editorRef.current._updateOriginalVersion) {
          setTimeout(() => {
            if (editorRef.current && editorRef.current._updateOriginalVersion) {
              editorRef.current._updateOriginalVersion();
            }
          }, 100);
        }
        
        // Check git status for this file immediately (only for non-read-only files)
        if (!data.readOnly) {
          setTimeout(() => checkFileGitStatus(filePath), 100);
        }
      } else {
        const error = await response.json();
        console.error('MonacoEditor: API error loading file:', { filePath, status: response.status, error });
        const errorContent = `// Error loading file: ${error.error || 'Unknown error'}\n// File: ${filePath}`;
        setFileErrors(prev => ({ ...prev, [filePath]: error.error || 'Failed to load file' }));
        setFileContents(prev => ({ ...prev, [filePath]: errorContent }));
        setOriginalFileContents(prev => ({ ...prev, [filePath]: errorContent }));
      }
    } catch (error) {
      console.error('Error loading file content:', error);
      const errorContent = `// Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}\n// File: ${filePath}`;
      setFileErrors(prev => ({ ...prev, [filePath]: 'Network error' }));
      setFileContents(prev => ({ ...prev, [filePath]: errorContent }));
      setOriginalFileContents(prev => ({ ...prev, [filePath]: errorContent }));
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
    console.log('MonacoEditor: activeFile changed:', { activeFile, workspaceId });
    if (activeFile) {
      console.log('MonacoEditor: calling loadFileContent for:', activeFile);
      loadFileContent(activeFile);
    }
  }, [activeFile, workspaceId]);
  // Load content for all open files
  useEffect(() => {
    console.log('MonacoEditor: openFiles changed:', openFiles);
    openFiles.filter(Boolean).forEach(filePath => {
      if (filePath && !fileContents[filePath] && !loadingFiles.has(filePath)) {
        loadFileContent(filePath);
      }
    });
  }, [openFiles, workspaceId]);
  const handleEditorChange = (value: string | undefined, filePath: string) => {
    if (value !== undefined) {
      // Don't allow changes to read-only files
      if (fileReadOnly[filePath]) {
        return;
      }
      
      setFileContents(prev => ({ ...prev, [filePath]: value }));
      
      // Only mark as dirty if content actually changed from original AND file is not read-only
      const originalContent = originalFileContents[filePath] || '';
      const isDirtyNow = !fileReadOnly[filePath] && value !== originalContent;
      setIsDirty(prev => ({ ...prev, [filePath]: isDirtyNow }));
      
      // Update the editor config manager cache
      editorConfigManager.updateFileCache(filePath, value, isDirtyNow);
      
      // Check git status when content changes (only for non-read-only files)
      if (!fileReadOnly[filePath]) {
        checkFileGitStatus(filePath);
      }
    }
  };
  const handleSaveFile = async (filePath: string, content?: string, isAutoSave: boolean = false) => {
    const fileContent = content || fileContents[filePath];
    if (!fileContent) return;
    try {
      // Convert workspace path to actual file path
      // Use same logic as loadFileContent for consistency
      const relativePath = filePath.startsWith('/workspace/') 
        ? filePath.replace('/workspace/', '') 
        : filePath.startsWith('/') 
          ? filePath.substring(1)  // Remove leading slash
          : filePath;
      
      // For files in target/repo-clone structure, keep the full path
      // The save API will handle the proper resolution
      console.log('Saving file:', filePath, '-> relative path:', relativePath);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/files/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: relativePath,
          content: fileContent
        })
      });
      if (response.ok) {
        setIsDirty(prev => ({ ...prev, [filePath]: false }));
        // Update original content to saved content for future comparisons
        setOriginalFileContents(prev => ({ ...prev, [filePath]: fileContent }));
        // Mark file as clean in the editor config manager
        editorConfigManager.markFileClean(filePath);
        
        // Automatically stage the file after save
        try {
          console.log('🔄 Auto-staging file after save:', filePath);
          await autoStageFile(filePath);
          console.log('✅ Auto-staging completed for:', filePath);
        } catch (stageError) {
          console.error('❌ Failed to auto-stage file:', stageError);
          console.error('🔍 Stage error details:', stageError.message, stageError.stack);
          // Continue even if staging fails but log the error clearly
        }
        
        // Trigger file modification update
        window.dispatchEvent(new CustomEvent('fileModified', {
          detail: { filePath, modified: true, isAutoSave, staged: true }
        }));
        // Refresh git status after save and stage
        checkFileGitStatus(filePath);
      } else {
        const error = await response.json();
        console.error('Failed to save file:', error);
        if (!isAutoSave) {
          alert(`Failed to save file: ${error.error}`);
        }
      }
    } catch (error) {
      console.error('Error saving file:', error);
      if (!isAutoSave) {
        alert('Error saving file: Network error');
      }
    }
  };
  const autoStageFile = async (filePath: string) => {
    try {
      // Convert workspace file path to git repository relative path
      let relativePath = filePath;
      
      // Remove common workspace prefixes
      if (relativePath.startsWith('/workspace/')) {
        relativePath = relativePath.replace('/workspace/', '');
      }
      
      // For files in target/repo-clone structure, extract the actual file path within the repo
      if (relativePath.includes('/target/repo-clone/')) {
        const repoMatch = relativePath.match(/\/target\/repo-clone\/[^\/]+\/(.+)$/);
        if (repoMatch) {
          relativePath = repoMatch[1];
        }
      }
      
      // For files directly in target structure (for created repos)
      if (relativePath.includes('/target/') && !relativePath.includes('/target/repo-clone/')) {
        relativePath = relativePath.replace(/.*\/target\//, '');
      }
      
      console.log('🔄 Staging file:', filePath, '-> relative path:', relativePath);
      console.log('📡 Making staging API call to:', `/api/workspaces/${workspaceId}/git/stage`);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/git/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [relativePath]
        })
      });
      
      console.log('📊 Staging API response status:', response.status, response.statusText);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ File staged successfully:', relativePath);
        console.log('📋 Staging result:', result);
      } else {
        const error = await response.json();
        console.error('❌ Failed to stage file - API error:', error);
        throw new Error(`Staging API failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error staging file:', error);
    }
  };

  const handleManualSave = () => {
    if (activeFile) {
      handleSaveFile(activeFile);
    }
  };
  const handleFormatDocument = async () => {
    if (activeFile) {
      await editorConfigManager.formatDocument(activeFile);
    }
  };
  const handleShowGitDiff = async (filePath: string) => {
    try {
      // Convert workspace file path to git repository relative path
      let relativePath = filePath;
      
      // Remove common workspace prefixes
      if (relativePath.startsWith('/workspace/')) {
        relativePath = relativePath.replace('/workspace/', '');
      }
      
      // For files in target/repo-clone structure, extract the actual file path within the repo
      if (relativePath.includes('/target/repo-clone/')) {
        const repoMatch = relativePath.match(/\/target\/repo-clone\/[^\/]+\/(.+)$/);
        if (repoMatch) {
          relativePath = repoMatch[1];
        }
      }
      
      // For files directly in target structure (for created repos)
      if (relativePath.includes('/target/') && !relativePath.includes('/target/repo-clone/')) {
        relativePath = relativePath.replace(/.*\/target\//, '');
      }
      
      console.log('Git diff for file:', filePath, '-> relative path:', relativePath);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/git/diff?type=file&file=${encodeURIComponent(relativePath)}`);
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
        console.error('Git diff API error:', error);
        alert(`Failed to get git diff: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error getting git diff:', error);
      alert('Error getting git diff: Network error');
    }
  };
  const handleCloseDiff = () => {
    setShowingDiff(null);
  };

  const handleToggleMinimap = () => {
    if (!editorRef.current) return;
    const newMinimapEnabled = !minimapEnabled;
    setMinimapEnabled(newMinimapEnabled);
    
    // Update the editor options
    editorRef.current.updateOptions({
      minimap: { 
        enabled: newMinimapEnabled,
        side: 'right',
        showSlider: 'mouseover',
        renderCharacters: true,
        maxColumn: 120,
        scale: 1
      }
    });
    
    // Also update the global config
    editorConfigManager.updateConfig({ minimap: newMinimapEnabled });
  };

  // Check git status for a file (debounced)
  const checkFileGitStatus = (filePath: string) => {
    // Clear existing timeout for this file
    if (gitStatusTimeouts.current[filePath]) {
      clearTimeout(gitStatusTimeouts.current[filePath]);
    }
    
    // Set new timeout
    gitStatusTimeouts.current[filePath] = setTimeout(async () => {
      try {
        // Convert workspace file path to git repository relative path
        let relativePath = filePath;
        
        // Remove common workspace prefixes
        if (relativePath.startsWith('/workspace/')) {
          relativePath = relativePath.replace('/workspace/', '');
        }
        
        // For files in target/repo-clone structure, extract the actual file path within the repo
        if (relativePath.includes('/target/repo-clone/')) {
          const repoMatch = relativePath.match(/\/target\/repo-clone\/[^\/]+\/(.+)$/);
          if (repoMatch) {
            relativePath = repoMatch[1];
          }
        }
        
        // For files directly in target structure (for created repos)
        if (relativePath.includes('/target/') && !relativePath.includes('/target/repo-clone/')) {
          relativePath = relativePath.replace(/.*\/target\//, '');
        }
        
        const response = await fetch(`/api/workspaces/${workspaceId}/git/diff?file=${encodeURIComponent(relativePath)}&type=file`);
        if (response.ok) {
          const data = await response.json();
          setFileGitStatus(prev => ({
            ...prev,
            [filePath]: {
              hasChanges: data.hasChanges || false,
              status: data.status || 'unmodified'
            }
          }));
        }
      } catch (error) {
        console.error('Error checking git status for file:', error);
        // Set as no changes on error
        setFileGitStatus(prev => ({
          ...prev,
          [filePath]: { hasChanges: false, status: 'unmodified' }
        }));
      }
    }, 500); // 500ms debounce
  };
  const FileIcon = ({ extension }: { extension: string }) => {
    switch (extension) {
      case 'tsx':
      case 'jsx':
        return '⚛️';
      case 'ts':
        return '📘';
      case 'js':
        return '📙';
      case 'json':
        return '📋';
      case 'md':
        return '📝';
      case 'css':
        return '🎨';
      case 'scss':
        return '🎨';
      case 'html':
        return '🌐';
      case 'xml':
        return '📋';
      case 'py':
        return '🐍';
      case 'java':
        return '☕';
      case 'cpp':
      case 'c':
        return '⚙️';
      case 'go':
        return '🐹';
      case 'rs':
        return '🦀';
      case 'php':
        return '🐘';
      case 'rb':
        return '💎';
      case 'swift':
        return '🔶';
      case 'kt':
        return '🎯';
      case 'sql':
        return '🗃️';
      case 'sh':
      case 'bash':
        return '🐚';
      case 'dockerfile':
        return '🐳';
      case 'yaml':
      case 'yml':
        return '📄';
      case 'toml':
        return '📄';
      case 'ini':
        return '⚙️';
      case 'log':
        return '📜';
      case 'txt':
        return '📄';
      default:
        return '📄';
    }
  };
  if (openFiles.length === 0) {
    return (
      <div
        className="h-full w-full flex flex-col min-h-0"
        style={{
          backgroundColor: 'var(--color-surface)',
        }}
      >
        
        {/* Empty State Content */}
        <div className="flex-1 flex items-center justify-center">
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
      </div>
    );
  }
  return (
    <div
      className="h-full w-full flex flex-col min-h-0"
      style={{
        backgroundColor: 'var(--color-surface)',
      }}
    >
      {/* Editor Content - File tabs are now handled by FileTabs component */}
      {/* Editor Content */}
      <div className="flex-1 w-full min-h-0">
        {activeFile ? (
          <div className="h-full w-full flex flex-col min-h-0">
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
                {fileGitStatus[activeFile]?.hasChanges && (
                  <>
                    <span>•</span>
                    <span className="text-green-500">Git {fileGitStatus[activeFile]?.status}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleManualSave}
                  disabled={!isDirty[activeFile]}
                  className="px-3 py-1 text-sm rounded transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-inverse)',
                  }}
                  title="Save file (Ctrl+S)"
                >
                  💾 Save
                </button>
                <button
                  onClick={handleFormatDocument}
                  className="px-3 py-1 text-sm rounded transition-colors"
                  style={{
                    backgroundColor: 'var(--color-surface-elevated)',
                    color: 'var(--color-text-secondary)',
                  }}
                  title="Format document (Alt+Shift+F)"
                >
                  🎨 Format
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
                    backgroundColor: showingDiff === activeFile 
                      ? 'var(--color-accent)' 
                      : fileGitStatus[activeFile]?.hasChanges 
                        ? 'var(--color-primary)'
                        : 'var(--color-surface-elevated)',
                    color: showingDiff === activeFile || fileGitStatus[activeFile]?.hasChanges
                      ? 'var(--color-text-inverse)' 
                      : 'var(--color-text-secondary)',
                  }}
                  title={fileGitStatus[activeFile]?.hasChanges 
                    ? `Show/hide git diff (${fileGitStatus[activeFile]?.status})` 
                    : "Show/hide git diff"}
                >
                  🔄 {showingDiff === activeFile ? 'Hide Diff' : fileGitStatus[activeFile]?.hasChanges ? `Git Diff (${fileGitStatus[activeFile]?.status})` : 'Git Diff'}
                </button>
                <button
                  onClick={handleToggleMinimap}
                  className="px-3 py-1 text-sm rounded transition-colors"
                  style={{
                    backgroundColor: minimapEnabled ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                    color: minimapEnabled ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                  }}
                  title={minimapEnabled ? 'Hide minimap' : 'Show minimap'}
                >
                  🗺️ {minimapEnabled ? 'Hide Map' : 'Show Map'}
                </button>
              </div>
            </div>
            {/* Monaco Editor */}
            <div className="flex-1 w-full min-w-0 min-h-0">
              <Suspense fallback={
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary)' }} />
                    <p style={{ color: 'var(--color-text-secondary)' }}>Loading editor...</p>
                  </div>
                </div>
              }>
{showingDiff === activeFile && diffContent[activeFile] ? (
                  // Show enhanced diff with summary and improved visualization
                  <div className="h-full flex flex-col">
                    <div
                      className="px-4 py-3 border-b"
                      style={{ 
                        backgroundColor: 'var(--color-surface-elevated)',
                        color: 'var(--color-text-primary)',
                        borderColor: 'var(--color-border)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">Git Changes: {getFileName(activeFile)}</span>
                          <span 
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: fileGitStatus[activeFile]?.status === 'staged' ? '#10b981' : '#f59e0b',
                              color: 'white'
                            }}
                          >
                            {fileGitStatus[activeFile]?.status || 'modified'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-600">+{(diffContent[activeFile].match(/^\+(?!\+)/gm) || []).length}</span>
                          <span className="text-red-600">-{(diffContent[activeFile].match(/^-(?!-)/gm) || []).length}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <LazyMonacoEditor
                        height="100%"
                        width="100%"
                        language="diff"
                        value={diffContent[activeFile]}
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          lineNumbers: 'on',
                          glyphMargin: true,
                          folding: false,
                          lineDecorationsWidth: 10,
                          lineNumbersMinChars: 4,
                          renderLineHighlight: 'line',
                          fontSize: 13,
                          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                          // Enhanced diff rendering
                          renderWhitespace: 'boundary',
                          renderControlCharacters: true,
                          // Better diff colors
                          theme: currentTheme === 'dark' ? 'vs-dark' : 'vs-light'
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  // Show normal file editor
                  <LazyMonacoEditor
                    height="100%"
                    width="100%"
                    language={getLanguage(activeFile)}
                    value={
                      fileContents[activeFile] || (loadingFiles.has(activeFile) ? `// Loading ${getFileName(activeFile)}...\n// Please wait while the file content is being fetched...` : `// File not loaded yet\n// File: ${activeFile}`)
                    }
                    onChange={(value) => handleEditorChange(value, activeFile)}
                    onMount={handleMonacoMount}
                    options={{
                      ...editorConfigManager.getEditorOptions(activeFile, getLanguage(activeFile)),
                      readOnly: loadingFiles.has(activeFile) || !!fileErrors[activeFile] || !!fileReadOnly[activeFile],
                    }}
                  />
                )}
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