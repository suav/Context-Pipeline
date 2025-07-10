/**
 * File Tabs Component
 * 
 * Displays file tabs that are always visible, even when editor is hidden
 * Allows quick switching between open files
 */
'use client';
import React from 'react';
import { editorConfigManager } from '../services/EditorConfigManager';

interface FileTabsProps {
  openFiles: string[];
  activeFile: string | null;
  onFileSelect: (filePath: string) => void;
  onFileClose: (filePath: string) => void;
  isDirty: Record<string, boolean>;
  isAutoSaving: Record<string, boolean>;
  hideEditor?: boolean;
  hideTerminal?: boolean;
  onToggleTerminal?: () => void;
  onToggleEditor?: () => void;
  onShowBoth?: () => void;
}

export function FileTabs({
  openFiles,
  activeFile,
  onFileSelect,
  onFileClose,
  isDirty,
  isAutoSaving,
  hideEditor = false,
  hideTerminal = false,
  onToggleTerminal,
  onToggleEditor,
  onShowBoth
}: FileTabsProps) {
  const getFileName = (filePath: string) => {
    return filePath.split('/').pop() || filePath;
  };

  const getFileExtension = (filePath: string) => {
    return filePath.split('.').pop() || '';
  };

  const FileIcon = ({ extension }: { extension: string }) => {
    switch (extension) {
      case 'tsx':
      case 'jsx':
        return '⚛️';
      case 'ts':
        return '📘';
      case 'js':
        return '📄';
      case 'json':
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
      case 'css':
        return '🎨';
      case 'html':
        return '🌐';
      case 'md':
        return '📝';
      case 'yml':
      case 'yaml':
        return '📄';
      case 'xml':
        return '📄';
      case 'sql':
        return '🗃️';
      case 'sh':
        return '🔧';
      case 'dockerfile':
        return '🐳';
      case 'log':
        return '📜';
      case 'txt':
        return '📄';
      default:
        return '📄';
    }
  };

  return (
    <div
      className="flex items-center border-b overflow-x-auto"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface-elevated)',
        minHeight: '40px'
      }}
    >
      {openFiles.map((filePath) => {
        const isActive = filePath === activeFile;
        const fileName = getFileName(filePath);
        const extension = getFileExtension(filePath);
        const isDirtyFile = isDirty[filePath] || editorConfigManager.isFileDirty(filePath);
        const isAutoSavingFile = isAutoSaving[filePath];
        return (
          <div
            key={filePath}
            className={`flex items-center gap-2 px-3 py-2 border-r cursor-pointer transition-colors min-w-0 ${isActive ? 'bg-opacity-100' : 'hover:bg-opacity-50'}`}
            style={{
              backgroundColor: isActive ? 'var(--color-surface)' : 'transparent',
              borderColor: 'var(--color-border)',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
            onClick={() => onFileSelect(filePath)}
          >
            <div className="flex items-center gap-1 min-w-0">
              <FileIcon extension={extension} />
              <span className="text-sm truncate">{fileName}</span>
              {isDirtyFile && (
                <span className="text-xs" style={{ color: 'var(--color-warning)' }}>
                  {isAutoSavingFile ? '💾' : '●'}
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileClose(filePath);
              }}
              className="flex-shrink-0 w-4 h-4 rounded-full hover:bg-opacity-20 flex items-center justify-center text-xs transition-colors"
              style={{
                backgroundColor: 'var(--color-text-muted)',
                color: 'var(--color-background)',
              }}
              title="Close file"
            >
              ×
            </button>
          </div>
        );
      })}
      
      {/* Empty state message when no files are open */}
      {openFiles.length === 0 && (
        <div className="flex items-center px-3 py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No files open
        </div>
      )}

      {/* Toggle Buttons */}
      <div className="ml-auto flex items-center gap-2 px-3">
        {onToggleEditor && (
          <button
            onClick={onToggleEditor}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors"
            style={{
              backgroundColor: hideEditor ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
              color: hideEditor ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            }}
            title={hideEditor ? 'Show Editor Full Height' : 'Editor Full Height (Hide Terminal)'}
          >
            📝
          </button>
        )}
        {onToggleTerminal && (
          <button
            onClick={onToggleTerminal}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors"
            style={{
              backgroundColor: hideTerminal ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
              color: hideTerminal ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            }}
            title={hideTerminal ? 'Show Terminal Full Height' : 'Terminal Full Height (Hide Editor)'}
          >
            🤖
          </button>
        )}
        {onShowBoth && (hideTerminal || hideEditor) && (
          <button
            onClick={onShowBoth}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text-inverse)',
            }}
            title="Show Both Editor and Terminal"
          >
            ⚡
          </button>
        )}
      </div>
    </div>
  );
}