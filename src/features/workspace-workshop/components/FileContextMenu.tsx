/**
 * File Context Menu Component
 *
 * Right-click context menu for file operations in the file tree
 */
'use client';
import { useState, useRef, useEffect } from 'react';
import { FileIconService } from '../services/FileIconService';
interface ContextMenuPosition {
  x: number;
  y: number;
}
interface FileContextMenuProps {
  isVisible: boolean;
  position: ContextMenuPosition;
  targetPath: string;
  targetName: string;
  isFile: boolean;
  onClose: () => void;
  onRename: (path: string, newName: string) => void;
  onDelete: (path: string) => void;
  onCopy: (path: string) => void;
  onCut: (path: string) => void;
  onPaste: (targetPath: string) => void;
  onNewFile: (parentPath: string) => void;
  onNewFolder: (parentPath: string) => void;
  onDuplicate: (path: string) => void;
  onOpenInNewTab?: (path: string) => void;
  onRevealInExplorer?: (path: string) => void;
  workspaceId: string;
  hasClipboard?: boolean;
}
export function FileContextMenu({
  isVisible,
  position,
  targetPath,
  targetName,
  isFile,
  onClose,
  onRename,
  onDelete,
  onCopy,
  onCut,
  onPaste,
  onNewFile,
  onNewFolder,
  onDuplicate,
  onOpenInNewTab,
  onRevealInExplorer,
  workspaceId,
  hasClipboard = false,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newName, setNewName] = useState('');
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);
  // Position menu to stay within viewport
  useEffect(() => {
    if (isVisible && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let adjustedX = position.x;
      let adjustedY = position.y;
      // Adjust horizontal position if menu goes off screen
      if (position.x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }
      // Adjust vertical position if menu goes off screen
      if (position.y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }
      menu.style.left = `${Math.max(0, adjustedX)}px`;
      menu.style.top = `${Math.max(0, adjustedY)}px`;
    }
  }, [isVisible, position]);
  const handleRename = () => {
    setNewName(targetName);
    setShowRenameModal(true);
    onClose();
  };
  const handleNewFile = () => {
    setNewName('');
    setShowNewFileModal(true);
    onClose();
  };
  const handleNewFolder = () => {
    setNewName('');
    setShowNewFolderModal(true);
    onClose();
  };
  const confirmRename = () => {
    if (newName.trim() && newName !== targetName) {
      onRename(targetPath, newName.trim());
    }
    setShowRenameModal(false);
  };
  const confirmNewFile = () => {
    if (newName.trim()) {
      onNewFile(isFile ? targetPath.split('/').slice(0, -1).join('/') : targetPath);
    }
    setShowNewFileModal(false);
  };
  const confirmNewFolder = () => {
    if (newName.trim()) {
      onNewFolder(isFile ? targetPath.split('/').slice(0, -1).join('/') : targetPath);
    }
    setShowNewFolderModal(false);
  };
  const handleDelete = () => {
    const confirmMessage = isFile
      ? `Are you sure you want to delete the file "${targetName}"?`
      : `Are you sure you want to delete the folder "${targetName}" and all its contents?`;
    if (window.confirm(confirmMessage)) {
      onDelete(targetPath);
    }
    onClose();
  };
  const fileIcon = isFile ? FileIconService.getFileIcon(targetName) : FileIconService.getFolderIcon(targetName);
  if (!isVisible) {
    return null;
  }
  return (
    <>
      {/* Context Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 min-w-48 py-2 rounded-md shadow-lg border"
        style={{
          backgroundColor: 'var(--color-surface-elevated)',
          borderColor: 'var(--color-border)',
          left: position.x,
          top: position.y,
        }}
      >
        {/* Header with file info */}
        <div
          className="px-3 py-2 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span>{fileIcon.icon}</span>
          <span
            className="font-medium text-sm truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {targetName}
          </span>
        </div>
        {/* File-specific actions */}
        {isFile && (
          <>
            <MenuItem
              icon="📂"
              label="Open"
              onClick={() => { onOpenInNewTab?.(targetPath); onClose(); }}
            />
            <MenuItem
              icon="📑"
              label="Open in New Tab"
              onClick={() => { onOpenInNewTab?.(targetPath); onClose(); }}
              disabled={!onOpenInNewTab}
            />
            <MenuSeparator />
          </>
        )}
        {/* Common actions */}
        <MenuItem
          icon="✏️"
          label="Rename"
          onClick={handleRename}
          shortcut="F2"
        />
        <MenuItem
          icon="📋"
          label="Copy"
          onClick={() => { onCopy(targetPath); onClose(); }}
          shortcut="Ctrl+C"
        />
        <MenuItem
          icon="✂️"
          label="Cut"
          onClick={() => { onCut(targetPath); onClose(); }}
          shortcut="Ctrl+X"
        />
        {hasClipboard && (
          <MenuItem
            icon="📄"
            label="Paste"
            onClick={() => { onPaste(isFile ? targetPath.split('/').slice(0, -1).join('/') : targetPath); onClose(); }}
            shortcut="Ctrl+V"
          />
        )}
        <MenuItem
          icon="📑"
          label="Duplicate"
          onClick={() => { onDuplicate(targetPath); onClose(); }}
        />
        <MenuSeparator />
        {/* New items */}
        <MenuItem
          icon="📄"
          label="New File"
          onClick={handleNewFile}
        />
        <MenuItem
          icon="📁"
          label="New Folder"
          onClick={handleNewFolder}
        />
        <MenuSeparator />
        {/* Utilities */}
        <MenuItem
          icon="🔍"
          label="Reveal in Explorer"
          onClick={() => { onRevealInExplorer?.(targetPath); onClose(); }}
          disabled={!onRevealInExplorer}
        />
        <MenuItem
          icon="📊"
          label="Properties"
          onClick={() => { /* TODO: Show file properties */ onClose(); }}
          disabled
        />
        <MenuSeparator />
        {/* Delete */}
        <MenuItem
          icon="🗑️"
          label="Delete"
          onClick={handleDelete}
          shortcut="Delete"
          danger
        />
      </div>
      {/* Rename Modal */}
      {showRenameModal && (
        <FileModal
          title="Rename"
          value={newName}
          onChange={setNewName}
          onConfirm={confirmRename}
          onCancel={() => setShowRenameModal(false)}
          placeholder="Enter new name"
        />
      )}
      {/* New File Modal */}
      {showNewFileModal && (
        <FileModal
          title="New File"
          value={newName}
          onChange={setNewName}
          onConfirm={confirmNewFile}
          onCancel={() => setShowNewFileModal(false)}
          placeholder="Enter file name (e.g. component.tsx)"
        />
      )}
      {/* New Folder Modal */}
      {showNewFolderModal && (
        <FileModal
          title="New Folder"
          value={newName}
          onChange={setNewName}
          onConfirm={confirmNewFolder}
          onCancel={() => setShowNewFolderModal(false)}
          placeholder="Enter folder name"
        />
      )}
    </>
  );
}
// Menu item component
interface MenuItemProps {
  icon: string;
  label: string;
  onClick: () => void;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
}
function MenuItem({ icon, label, onClick, shortcut, disabled = false, danger = false }: MenuItemProps) {
  return (
    <button
      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-opacity-10 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{
        backgroundColor: disabled ? 'transparent' : 'var(--color-primary)',
        color: danger ? 'var(--color-error)' : disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
      }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      {shortcut && (
        <span
          className="text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}
// Menu separator
function MenuSeparator() {
  return (
    <div
      className="my-1 h-px"
      style={{ backgroundColor: 'var(--color-border)' }}
    />
  );
}
// File modal for input
interface FileModalProps {
  title: string;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  placeholder: string;
}
function FileModal({ title, value, onChange, onConfirm, onCancel, placeholder }: FileModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-overlay)' }}
    >
      <div
        className="w-96 p-6 rounded-lg shadow-xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <h3
          className="text-lg font-medium mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h3>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 border rounded-md text-sm"
          style={{
            backgroundColor: 'var(--color-background)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm rounded-md transition-colors"
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!value.trim()}
            className="px-3 py-2 text-sm rounded-md transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
            }}
          >
            {title}
          </button>
        </div>
      </div>
    </div>
  );
}