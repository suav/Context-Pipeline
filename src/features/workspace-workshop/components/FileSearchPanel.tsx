/**
 * File Search Panel Component
 *
 * VSCode-style file explorer with live search filtering
 * Width: 280px, positioned next to workspace cards
 * Features: search, file tree, agent-modified indicators
 */
'use client';
import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useRef } from 'react';
// Lazy load heavy file tree component
const LazyFileTree = lazy(() => import('./FileTree').then(m => ({ default: m.FileTree })));
interface FileItem {
  path: string;
  name: string;
  extension: string;
  relativePath: string;
  isModified: boolean;
  agentModified: boolean;
  size?: number;
  lastModified?: Date;
}
interface FileSearchPanelProps {
  workspaceId: string;
  onFileSelect: (filePath: string) => void;
  onToggleWorkspaceView?: () => void;
}
export function FileSearchPanel({ workspaceId, onFileSelect, onToggleWorkspaceView }: FileSearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'modified'>('all');
  const panelRef = useRef<HTMLDivElement>(null);
  const [isInViewport, setIsInViewport] = useState(true); // Assume visible for now
  const [panelWidth, setPanelWidth] = useState(320); // Start wider for better filename visibility
  // Load files from workspace
  useEffect(() => {
    const loadFiles = async () => {
      if (!isInViewport) return; // Only load when in viewport
      try {
        setLoading(true);
        const response = await fetch(`/api/workspaces/${workspaceId}/files`);
        if (response.ok) {
          const data = await response.json();
          const allFiles: FileItem[] = [];
          // Convert nested file structure to flat list
          const processFiles = (items: any[], basePath: string = '') => {
            items.forEach(item => {
              if (item.type === 'file') {
                const extension = item.name.split('.').pop() || '';
                allFiles.push({
                  path: item.path, // Use the path as-is, without prefixing /workspace
                  name: item.name,
                  extension,
                  relativePath: item.path.substring(1), // Remove leading /
                  isModified: false,
                  agentModified: item.path.includes('/agents/') || item.path.includes('/feedback/'),
                  size: item.size,
                  lastModified: item.modified ? new Date(item.modified) : undefined
                });
              } else if (item.type === 'directory' && item.children) {
                processFiles(item.children, item.path);
              }
            });
          };
          // Process all main folders including workspace metadata
          if (data.files.workspace) processFiles([data.files.workspace]);
          if (data.files.context) processFiles([data.files.context]);
          if (data.files.target) processFiles([data.files.target]);
          if (data.files.feedback) processFiles([data.files.feedback]);
          if (data.files.agents) processFiles([data.files.agents]);
          if (data.files.other) processFiles(data.files.other);
          setFiles(allFiles);
        } else {
          // Fallback to workspace structure mock data
          setFiles(getWorkspaceFiles());
        }
      } catch (error) {
        console.error('Error loading files:', error);
        setFiles(getWorkspaceFiles());
      } finally {
        setLoading(false);
      }
    };
    loadFiles();
  }, [workspaceId, isInViewport]);
  // Listen for file modification and creation events
  useEffect(() => {
    const handleFileModified = (event: CustomEvent) => {
      const { filePath, modified } = event.detail;
      setFiles(prevFiles =>
        prevFiles.map(file =>
          file.path === filePath
            ? { ...file, isModified: modified }
            : file
        )
      );
    };

    const handleFileCreated = (event: CustomEvent) => {
      console.log('File created event received:', event.detail);
      // Force reload file list when new files are created
      handleRefresh();
    };

    const handleAgentFileOperation = (event: CustomEvent) => {
      console.log('Agent file operation detected:', event.detail);
      // Auto-refresh when agents modify files
      setTimeout(() => {
        handleRefresh();
      }, 1000); // Small delay to ensure file is written
    };

    window.addEventListener('fileModified', handleFileModified as EventListener);
    window.addEventListener('fileCreated', handleFileCreated as EventListener);
    window.addEventListener('agentFileOperation', handleAgentFileOperation as EventListener);
    
    return () => {
      window.removeEventListener('fileModified', handleFileModified as EventListener);
      window.removeEventListener('fileCreated', handleFileCreated as EventListener);
      window.removeEventListener('agentFileOperation', handleAgentFileOperation as EventListener);
    };
  }, []);
  // Filter files based on search term and active filter
  const filteredAndSearched = useMemo(() => {
    let filtered = files;
    // Apply filter
    switch (activeFilter) {
      case 'modified':
        filtered = files.filter(file => file.isModified);
        break;
      default:
        filtered = files;
    }
    // Apply search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(file =>
        file.name.toLowerCase().includes(term) ||
        file.relativePath.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [files, searchTerm, activeFilter]);
  // Convert filtered files to hierarchical structure for search results
  const buildSearchTree = (files: FileItem[]) => {
    const tree: any = {};
    files.forEach(file => {
      const pathParts = file.relativePath.split('/');
      let current = tree;
      pathParts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = {
            type: index === pathParts.length - 1 ? 'file' : 'directory',
            children: {},
            file: index === pathParts.length - 1 ? file : null
          };
        }
        current = current[part].children;
      });
    });
    return tree;
  };
  useEffect(() => {
    setFilteredFiles(filteredAndSearched);
  }, [filteredAndSearched]);
  const getWorkspaceFiles = (): FileItem[] => [
    // Context folder - imported context documents
    {
      path: '/context/requirements.md',
      name: 'requirements.md',
      extension: 'md',
      relativePath: 'context/requirements.md',
      isModified: false,
      agentModified: false,
    },
    {
      path: '/context/api-docs.json',
      name: 'api-docs.json',
      extension: 'json',
      relativePath: 'context/api-docs.json',
      isModified: false,
      agentModified: false,
    },
    {
      path: '/context/design-system.md',
      name: 'design-system.md',
      extension: 'md',
      relativePath: 'context/design-system.md',
      isModified: false,
      agentModified: false,
    },
    // Target folder - the actual project files/repository
    {
      path: '/target/src/components/Dashboard.tsx',
      name: 'Dashboard.tsx',
      extension: 'tsx',
      relativePath: 'target/src/components/Dashboard.tsx',
      isModified: true,
      agentModified: true,
    },
    {
      path: '/target/src/utils/api.ts',
      name: 'api.ts',
      extension: 'ts',
      relativePath: 'target/src/utils/api.ts',
      isModified: true,
      agentModified: true,
    },
    {
      path: '/target/package.json',
      name: 'package.json',
      extension: 'json',
      relativePath: 'target/package.json',
      isModified: false,
      agentModified: false,
    },
    {
      path: '/target/README.md',
      name: 'README.md',
      extension: 'md',
      relativePath: 'target/README.md',
      isModified: true,
      agentModified: false,
    },
    // Feedback folder - agent work and outputs
    {
      path: '/feedback/analysis-report.md',
      name: 'analysis-report.md',
      extension: 'md',
      relativePath: 'feedback/analysis-report.md',
      isModified: false,
      agentModified: true,
    },
    {
      path: '/feedback/code-review.md',
      name: 'code-review.md',
      extension: 'md',
      relativePath: 'feedback/code-review.md',
      isModified: false,
      agentModified: true,
    },
    // Agents folder - agent configurations and memories
    {
      path: '/agents/dev-assistant/config.json',
      name: 'config.json',
      extension: 'json',
      relativePath: 'agents/dev-assistant/config.json',
      isModified: false,
      agentModified: true,
    },
    {
      path: '/agents/dev-assistant/memory.md',
      name: 'memory.md',
      extension: 'md',
      relativePath: 'agents/dev-assistant/memory.md',
      isModified: false,
      agentModified: true,
    },
    {
      path: '/agents/code-reviewer/config.json',
      name: 'config.json',
      extension: 'json',
      relativePath: 'agents/code-reviewer/config.json',
      isModified: false,
      agentModified: false,
    },
  ];
  const getFilterCounts = () => ({
    modified: files.filter(f => f.isModified).length,
  });
  const handleFileClick = (file: FileItem | string) => {
    // Handle both FileItem objects (from search results) and string paths (from FileTree)
    const filePath = typeof file === 'string' ? file : file.path;
    onFileSelect(filePath);
  };
  const handleNewFile = () => {
    console.log('Create new file');
  };
  const handleNewFolder = () => {
    console.log('Create new folder');
  };
  const handleRefresh = async () => {
    console.log('🔄 Refreshing file list...');
    // Force reload files
    setLoading(true);
    setFiles([]);
    
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/files`);
      if (response.ok) {
        const data = await response.json();
        const allFiles: FileItem[] = [];
        // Convert nested file structure to flat list
        const processFiles = (items: any[], basePath: string = '') => {
          items.forEach(item => {
            if (item.type === 'file') {
              const extension = item.name.split('.').pop() || '';
              allFiles.push({
                path: item.path, // Use the path as-is, without prefixing /workspace
                name: item.name,
                extension,
                relativePath: item.path.substring(1), // Remove leading /
                isModified: false,
                agentModified: item.path.includes('/agents/') || item.path.includes('/feedback/'),
                size: item.size,
                lastModified: item.modified ? new Date(item.modified) : undefined
              });
            } else if (item.type === 'directory' && item.children) {
              processFiles(item.children, item.path);
            }
          });
        };
        // Process all main folders
        if (data.files.context) processFiles([data.files.context]);
        if (data.files.target) processFiles([data.files.target]);
        if (data.files.feedback) processFiles([data.files.feedback]);
        if (data.files.agents) processFiles([data.files.agents]);
        if (data.files.other) processFiles(data.files.other);
        setFiles(allFiles);
        console.log(`✅ File list refreshed: ${allFiles.length} files found`);
      } else {
        // Fallback to workspace structure mock data
        setFiles(getWorkspaceFiles());
      }
    } catch (error) {
      console.error('Error refreshing files:', error);
      setFiles(getWorkspaceFiles());
    } finally {
      setLoading(false);
    }
  };
  // Handle panel resizing
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(250, Math.min(600, startWidth + deltaX)); // Min 250px, max 600px
      setPanelWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const counts = getFilterCounts();
  return (
    <div className="flex">
      <div
        ref={panelRef}
        className="border-r flex flex-col"
        style={{
          width: `${panelWidth}px`,
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
      {/* Search Header */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {/* Header Controls */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
            📁 Files
          </h3>
          {onToggleWorkspaceView && (
            <button
              onClick={onToggleWorkspaceView}
              className="text-xs px-2 py-1 rounded hover:bg-opacity-10"
              style={{ color: 'var(--color-text-muted)' }}
              title="Switch to workspace view"
            >
              ← Workspaces
            </button>
          )}
        </div>
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="🔍 Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ✕
            </button>
          )}
        </div>
        {/* Filter Buttons */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`text-xs px-2 py-1 rounded ${activeFilter === 'all' ? 'font-medium' : ''}`}
            style={{
              backgroundColor: activeFilter === 'all' ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
              color: activeFilter === 'all' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            }}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('modified')}
            className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${activeFilter === 'modified' ? 'font-medium' : ''}`}
            style={{
              backgroundColor: activeFilter === 'modified' ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
              color: activeFilter === 'modified' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            }}
          >
            Modified {counts.modified > 0 && <span className="bg-red-500 text-white rounded-full px-1 text-xs">{counts.modified}</span>}
          </button>
        </div>
      </div>
      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="animate-pulse flex items-center gap-2"
              >
                <div className="w-4 h-4 bg-gray-200 rounded" style={{ backgroundColor: 'var(--color-surface-elevated)' }} />
                <div className="flex-1 h-4 bg-gray-200 rounded" style={{ backgroundColor: 'var(--color-surface-elevated)' }} />
              </div>
            ))}
          </div>
        ) : searchTerm ? (
          // Search Results - Hierarchical Tree
          <div className="p-2">
            {filteredFiles.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">🔍</div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  No files found for "{searchTerm}"
                </p>
              </div>
            ) : (
              <SearchTreeView
                tree={buildSearchTree(filteredFiles)}
                searchTerm={searchTerm}
                onFileSelect={handleFileClick}
                expandedFolders={new Set()}
              />
            )}
          </div>
        ) : (
          // File Tree
          <Suspense fallback={
            <div className="p-3 space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-4 bg-gray-200 rounded" style={{ backgroundColor: 'var(--color-surface-elevated)' }} />
              ))}
            </div>
          }>
            <LazyFileTree
              files={filteredFiles}
              onFileSelect={handleFileClick}
              searchTerm={searchTerm}
              workspaceId={workspaceId}
            />
          </Suspense>
        )}
      </div>
      {/* Quick Actions */}
      <div className="p-3 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex gap-2">
          <button
            onClick={handleNewFile}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded border"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span>📄</span>
            <span>New</span>
          </button>
          <button
            onClick={handleNewFolder}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded border"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span>📁</span>
            <span>Folder</span>
          </button>
          <button
            onClick={handleRefresh}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded border"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>
      </div>
      {/* Resize Handle */}
      <div
        className="w-1 hover:w-2 cursor-col-resize bg-transparent hover:bg-blue-400 transition-all opacity-0 hover:opacity-100"
        onMouseDown={handleResizeStart}
        title="Drag to resize file explorer"
        style={{
          borderRight: '1px solid var(--color-border)',
        }}
      />
    </div>
  );
}
// File Search Result Component
function FileSearchResult({
  file,
  searchTerm,
  onSelect
}: {
  file: FileItem;
  searchTerm: string;
  onSelect: (file: FileItem) => void;
}) {
  const highlightMatch = (text: string, term: string) => {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <mark key={i} style={{ backgroundColor: 'var(--color-accent-background, #fef3c7)', color: 'var(--color-accent, #d97706)' }}>
          {part}
        </mark>
      ) : part
    );
  };
  return (
    <div
      onClick={() => onSelect(file)}
      className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-opacity-80 transition-colors"
      style={{ backgroundColor: 'var(--color-surface-elevated)' }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FileIcon extension={file.extension} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
            {highlightMatch(file.name, searchTerm)}
          </div>
          <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
            {highlightMatch(file.relativePath, searchTerm)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {file.agentModified && <span className="text-xs">🤖</span>}
        {file.isModified && <span className="text-xs text-orange-500">●</span>}
      </div>
    </div>
  );
}
// Search Tree View Component
function SearchTreeView({
  tree,
  searchTerm,
  onFileSelect,
  expandedFolders,
  depth = 0
}: {
  tree: any;
  searchTerm: string;
  onFileSelect: (file: FileItem) => void;
  expandedFolders: Set<string>;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (path: string) => {
    setExpanded(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };
  const highlightMatch = (text: string, term: string) => {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <mark key={i} style={{ backgroundColor: 'var(--color-accent-background, #fef3c7)', color: 'var(--color-accent, #d97706)' }}>
          {part}
        </mark>
      ) : part
    );
  };
  return (
    <div className="space-y-1">
      {Object.entries(tree).map(([name, node]: [string, any]) => {
        const isFile = node.type === 'file';
        const hasChildren = Object.keys(node.children).length > 0;
        const itemPath = `${depth}-${name}`;
        const isExpanded = expanded.has(itemPath) || searchTerm.length > 0; // Auto-expand during search
        return (
          <div key={itemPath}>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-colors ${
                isFile ? 'hover:bg-opacity-80' : ''
              }`}
              style={{
                paddingLeft: `${8 + depth * 16}px`,
                backgroundColor: isFile ? 'transparent' : 'var(--color-surface-elevated)',
              }}
              onClick={() => {
                if (isFile) {
                  onFileSelect(node.file);
                } else if (hasChildren) {
                  toggleExpanded(itemPath);
                }
              }}
            >
              {/* Folder/File Icon */}
              {isFile ? (
                <FileIcon extension={node.file?.extension || ''} />
              ) : (
                <span className="text-sm">
                  {hasChildren ? (isExpanded ? '📂' : '📁') : '📁'}
                </span>
              )}
              {/* Expand/Collapse Arrow for folders */}
              {!isFile && hasChildren && (
                <span
                  className="text-xs cursor-pointer transition-transform"
                  style={{
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    color: 'var(--color-text-muted)'
                  }}
                >
                  ▶
                </span>
              )}
              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {highlightMatch(name, searchTerm)}
                </div>
                {isFile && node.file && (
                  <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {highlightMatch(node.file.relativePath, searchTerm)}
                  </div>
                )}
              </div>
              {/* File indicators */}
              {isFile && node.file && (
                <div className="flex items-center gap-1">
                  {node.file.agentModified && <span className="text-xs">🤖</span>}
                  {node.file.isModified && <span className="text-xs text-orange-500">●</span>}
                </div>
              )}
            </div>
            {/* Children */}
            {!isFile && hasChildren && isExpanded && (
              <SearchTreeView
                tree={node.children}
                searchTerm={searchTerm}
                onFileSelect={onFileSelect}
                expandedFolders={expandedFolders}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
// File Icon Component
function FileIcon({ extension }: { extension: string }) {
  const getIcon = (ext: string) => {
    switch (ext.toLowerCase()) {
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
  return <span className="text-sm">{getIcon(extension)}</span>;
}