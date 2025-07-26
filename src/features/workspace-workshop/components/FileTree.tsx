/**
 * File Tree Component
 *
 * VSCode-style expandable file tree
 */
'use client';
import { useState, useRef, useCallback } from 'react';
import { FileIconService } from '../services/FileIconService';
import { FileContextMenu } from './FileContextMenu';
interface FileItem {
  path: string;
  name: string;
  extension: string;
  relativePath: string;
  isModified: boolean;
  agentModified: boolean;
}
interface FileTreeProps {
  files: FileItem[];
  onFileSelect: (filePath: string | FileItem) => void;
  onFileRename?: (oldPath: string, newName: string) => void;
  onFileDelete?: (path: string) => void;
  onFileCreate?: (parentPath: string, fileName: string, isFolder: boolean) => void;
  onFileCopy?: (sourcePath: string, targetPath: string) => void;
  workspaceId: string;
  searchTerm?: string; // Pass search term from parent
}
export function FileTree({
  files,
  onFileSelect,
  onFileRename,
  onFileDelete,
  onFileCreate,
  onFileCopy,
  workspaceId,
  searchTerm = ''
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    position: { x: number; y: number };
    targetPath: string;
    targetName: string;
    isFile: boolean;
  }>({ isVisible: false, position: { x: 0, y: 0 }, targetPath: '', targetName: '', isFile: false });
  const [clipboard, setClipboard] = useState<{ path: string; isCut: boolean } | null>(null);
  // Filter files by search term
  const filteredFiles = searchTerm
    ? files.filter(file =>
        file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.relativePath.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : files;
  // Group files by directory
  const fileTree = buildFileTree(filteredFiles);
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };
  const handleContextMenu = useCallback((e: React.MouseEvent, path: string, name: string, isFile: boolean) => {
    e.preventDefault();
    setContextMenu({
      isVisible: true,
      position: { x: e.clientX, y: e.clientY },
      targetPath: path,
      targetName: name,
      isFile,
    });
  }, []);
  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isVisible: false }));
  }, []);
  const handleFileRename = useCallback((path: string, newName: string) => {
    onFileRename?.(path, newName);
  }, [onFileRename]);
  const handleFileDelete = useCallback((path: string) => {
    onFileDelete?.(path);
  }, [onFileDelete]);
  const handleFileCopy = useCallback((path: string) => {
    setClipboard({ path, isCut: false });
  }, []);
  const handleFileCut = useCallback((path: string) => {
    setClipboard({ path, isCut: true });
  }, []);
  const handleFilePaste = useCallback((targetPath: string) => {
    if (clipboard && onFileCopy) {
      onFileCopy(clipboard.path, targetPath);
      if (clipboard.isCut) {
        setClipboard(null);
      }
    }
  }, [clipboard, onFileCopy]);
  const handleNewFile = useCallback((parentPath: string) => {
    // This will be handled by the modal in FileContextMenu
    // The actual creation happens via onFileCreate
  }, []);
  const handleNewFolder = useCallback((parentPath: string) => {
    // This will be handled by the modal in FileContextMenu
    // The actual creation happens via onFileCreate
  }, []);
  const handleDuplicate = useCallback((path: string) => {
    if (onFileCopy) {
      const pathParts = path.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const parentPath = pathParts.slice(0, -1).join('/');
      const [name, ext] = fileName.split('.');
      const newName = ext ? `${name}_copy.${ext}` : `${name}_copy`;
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      onFileCopy(path, newPath);
    }
  }, [onFileCopy]);
  // Keyboard shortcuts for context menu, etc.
  const renderTreeNode = (node: TreeNode, depth = 0) => {
    if (node.type === 'file') {
      const fileIcon = FileIconService.getFileIcon(node.name);
      const isHighlighted = searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase());
      return (
        <div
          key={node.path}
          className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-opacity-10 transition-colors group ${
            isHighlighted ? 'bg-opacity-5' : ''
          }`}
          style={{
            paddingLeft: `${depth * 16 + 8}px`,
            backgroundColor: isHighlighted ? 'var(--color-primary)' : 'transparent',
          }}
          onClick={() => {
            const filePath = node.file ? node.file.path : `/${node.path}`;
            console.log('FileTree: onClick for file node:', { 
              nodeName: node.name, 
              nodePath: node.path, 
              nodeFile: node.file, 
              finalPath: filePath 
            });
            if (filePath && filePath !== '/') {
              onFileSelect(filePath);
            } else {
              console.error('FileTree: Invalid filePath generated:', filePath);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node.path, node.name, true)}
          title={`${fileIcon.description} - ${node.path}`}
        >
          <span className="text-sm" style={{ color: fileIcon.color }}>{fileIcon.icon}</span>
          <span
            className={`text-sm flex-1 min-w-0 ${isHighlighted ? 'font-medium' : ''}`}
            style={{ color: 'var(--color-text-primary)' }}
            title={node.name} // Show full name on hover
          >
            <span className="block truncate">
              {searchTerm ? (
                <HighlightedText text={node.name} highlight={searchTerm} />
              ) : (
                node.name
              )}
            </span>
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.file!.agentModified && (
              <span className="text-xs" title="Modified by agent">🤖</span>
            )}
            {node.file!.isModified && (
              <span className="text-xs" style={{ color: 'var(--color-warning)' }} title="Modified">●</span>
            )}
            <span className="text-xs" style={{ color: fileIcon.color }}>{fileIcon.category}</span>
          </div>
        </div>
      );
    }
    const isExpanded = expandedFolders.has(node.path);
    const folderIcon = FileIconService.getFolderIcon(node.name);
    const isHighlighted = searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase());
    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-opacity-10 transition-colors group ${
            isHighlighted ? 'bg-opacity-5' : ''
          }`}
          style={{
            paddingLeft: `${depth * 16 + 8}px`,
            backgroundColor: isHighlighted ? 'var(--color-primary)' : 'transparent',
          }}
          onClick={() => toggleFolder(node.path)}
          onContextMenu={(e) => handleContextMenu(e, node.path, node.name, false)}
          title={`${folderIcon.description} - ${node.path}`}
        >
          <span className="text-sm" style={{ color: folderIcon.color }}>
            {isExpanded ? '📂' : folderIcon.icon}
          </span>
          <span
            className={`text-sm flex-1 min-w-0 ${isHighlighted ? 'font-medium' : ''}`}
            style={{ color: 'var(--color-text-primary)' }}
            title={node.name} // Show full name on hover
          >
            <span className="block truncate">
              {searchTerm ? (
                <HighlightedText text={node.name} highlight={searchTerm} />
              ) : (
                node.name
              )}
            </span>
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs" style={{ color: folderIcon.color }}>{folderIcon.category}</span>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {node.children.length}
            </span>
          </div>
        </div>
        {isExpanded && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="h-full flex flex-col" tabIndex={0}>
      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {fileTree.children.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">📁</div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {searchTerm ? 'No files match your search' : 'No files in workspace'}
            </p>
          </div>
        ) : (
          fileTree.children.map(node => renderTreeNode(node))
        )}
      </div>
      {/* Context Menu */}
      <FileContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        targetPath={contextMenu.targetPath}
        targetName={contextMenu.targetName}
        isFile={contextMenu.isFile}
        onClose={closeContextMenu}
        onRename={handleFileRename}
        onDelete={handleFileDelete}
        onCopy={handleFileCopy}
        onCut={handleFileCut}
        onPaste={handleFilePaste}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onDuplicate={handleDuplicate}
        workspaceId={workspaceId}
        hasClipboard={!!clipboard}
      />
    </div>
  );
}
// Highlighted text component for search results
function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <span>
      {parts.map((part, index) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark
            key={index}
            className="bg-opacity-30 px-0"
            style={{ backgroundColor: 'var(--color-warning)' }}
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}
// Tree building logic
interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: TreeNode[];
  file?: FileItem;
}
function buildFileTree(files: FileItem[]): TreeNode {
  const root: TreeNode = {
    name: 'root',
    path: '',
    type: 'folder',
    children: [],
  };
  files.forEach(file => {
    const parts = file.relativePath.split('/');
    let currentNode = root;
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join('/');
      let child = currentNode.children.find(c => c.name === part);
      if (!child) {
        child = {
          name: part,
          path,
          type: isFile ? 'file' : 'folder',
          children: [],
          file: isFile ? file : undefined,
        };
        currentNode.children.push(child);
      }
      currentNode = child;
    });
  });
  // Sort: folders first, then files
  const sortNode = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNode);
  };
  sortNode(root);
  return root;
}