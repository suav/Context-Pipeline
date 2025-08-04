/**
 * Command Palette for quick command injection
 */
'use client';
import { useState } from 'react';
import { useCommandInjection } from '../hooks/useCommandInjection';
interface Command {
  id: string;
  label: string;
  command: string;
  description?: string;
  category: string;
}
const PREDEFINED_COMMANDS: Command[] = [
  // Help & Info
  { id: 'help', label: 'Help', command: 'help', description: 'Show available commands', category: 'Help' },
  { id: 'version', label: 'Version', command: 'version', description: 'Show agent version', category: 'Help' },
  { id: 'status', label: 'Status', command: 'status', description: 'Show workspace status', category: 'Help' },
  // Workspace
  { id: 'ls', label: 'List Files', command: 'ls -la', description: 'List all files in current directory', category: 'Workspace' },
  { id: 'tree', label: 'Show Tree', command: 'tree -L 2', description: 'Show directory tree', category: 'Workspace' },
  { id: 'pwd', label: 'Current Directory', command: 'pwd', description: 'Print working directory', category: 'Workspace' },
  // Git
  { id: 'git-status', label: 'Git Status', command: 'git status', description: 'Show git status', category: 'Git' },
  { id: 'git-log', label: 'Git Log', command: 'git log --oneline -10', description: 'Show recent commits', category: 'Git' },
  { id: 'git-diff', label: 'Git Diff', command: 'git diff', description: 'Show uncommitted changes', category: 'Git' },
  // Development
  { id: 'analyze', label: 'Analyze Code', command: 'analyze', description: 'Analyze current codebase', category: 'Development' },
  { id: 'test', label: 'Run Tests', command: 'npm test', description: 'Run test suite', category: 'Development' },
  { id: 'build', label: 'Build Project', command: 'npm run build', description: 'Build the project', category: 'Development' },
];
// Duplicate type removed: CommandPaletteProps (see ./src/features/context-library/components/ArchiveManager.tsx)
export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { injectCommand } = useCommandInjection();
  if (!isOpen) return null;
  const categories = Array.from(new Set(PREDEFINED_COMMANDS.map(cmd => cmd.category)));
  const filteredCommands = PREDEFINED_COMMANDS.filter(cmd => {
    const matchesSearch = searchTerm === '' ||
      cmd.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cmd.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cmd.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !selectedCategory || cmd.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const handleCommandClick = (command: string) => {
    injectCommand(command, false);
    onClose();
  };
  const handleCustomCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      injectCommand(searchTerm, false);
      onClose();
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-[600px] max-h-[500px] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="text-green-400 font-mono text-sm mb-2">COMMAND PALETTE</h3>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleCustomCommand}
            placeholder="Search commands or type custom command..."
            className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-green-400 font-mono text-sm focus:outline-none focus:border-green-400"
            autoFocus
          />
        </div>
        {/* Categories */}
        <div className="px-4 py-2 border-b border-gray-700 flex gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
              !selectedCategory ? 'bg-green-600 text-black' : 'bg-gray-800 text-gray-400 hover:text-green-400'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
                selectedCategory === cat ? 'bg-green-600 text-black' : 'bg-gray-800 text-gray-400 hover:text-green-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {/* Commands */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredCommands.length === 0 ? (
            <div className="text-gray-500 text-center py-8 font-mono text-sm">
              {searchTerm ? 'No matching commands. Press Enter to run as custom command.' : 'No commands found.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCommands.map(cmd => (
                <button
                  key={cmd.id}
                  onClick={() => handleCommandClick(cmd.command)}
                  className="w-full text-left px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-green-400 font-mono text-sm">{cmd.label}</span>
                      {cmd.description && (
                        <span className="text-gray-500 text-xs ml-2">{cmd.description}</span>
                      )}
                    </div>
                    <span className="text-gray-600 font-mono text-xs group-hover:text-green-400">
                      {cmd.command}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500 font-mono">
          <span>↑↓ Navigate</span>
          <span className="mx-2">•</span>
          <span>Enter: Run Command</span>
          <span className="mx-2">•</span>
          <span>ESC: Close</span>
        </div>
      </div>
    </div>
  );
}