/**
 * File Tree Component
 * 
 * VSCode-style expandable file tree
 */

'use client';

import { useState } from 'react';

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
  onFileSelect: (file: FileItem) => void;
}

export function FileTree({ files, onFileSelect }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));

  // Group files by directory
  const fileTree = buildFileTree(files);

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

  const renderTreeNode = (node: TreeNode, depth = 0) => {
    if (node.type === 'file') {
      return (
        <div
          key={node.path}
          className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-opacity-80 transition-colors"
          style={{ 
            paddingLeft: `${depth * 16 + 8}px`,
            backgroundColor: 'transparent',
          }}
          onClick={() => onFileSelect(node.file!)}
        >
          <FileIcon extension={node.file!.extension} />
          <span className="text-sm flex-1" style={{ color: 'var(--color-text-primary)' }}>
            {node.name}
          </span>
          <div className="flex items-center gap-1">
            {node.file!.agentModified && <span className="text-xs">🤖</span>}
            {node.file!.isModified && <span className="text-xs text-orange-500">●</span>}
          </div>
        </div>
      );
    }

    const isExpanded = expandedFolders.has(node.path);
    
    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-opacity-80 transition-colors"
          style={{ 
            paddingLeft: `${depth * 16 + 8}px`,
            backgroundColor: 'transparent',
          }}
          onClick={() => toggleFolder(node.path)}
        >
          <span className="text-xs">{isExpanded ? '📂' : '📁'}</span>
          <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {node.name}
          </span>
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
    <div className="p-2">
      {fileTree.children.map(node => renderTreeNode(node))}
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