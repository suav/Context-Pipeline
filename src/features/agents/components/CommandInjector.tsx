/**
 * Command Injector Component
 * Dropdown for selecting predefined commands with custom additions
 */

'use client';

import { useState, useEffect } from 'react';
import { Command, STARTUP_COMMANDS, REPLY_COMMANDS, COMMAND_CATEGORIES } from '../data/commandLibrary';
import { useCommandInjection } from '../hooks/useCommandInjection';

interface CommandInjectorProps {
  mode: 'startup' | 'reply';
  workspaceContext?: {
    has_jira: boolean;
    has_git: boolean;
    has_files: boolean;
    has_email: boolean;
  };
  onCommandSelect?: (command: string) => void;
  className?: string;
}

export function CommandInjector({ 
  mode, 
  workspaceContext = { has_jira: false, has_git: false, has_files: false, has_email: false },
  onCommandSelect,
  className = ''
}: CommandInjectorProps) {
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
  const [customAddition, setCustomAddition] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const { injectCommand } = useCommandInjection();

  const availableCommands = mode === 'startup' ? STARTUP_COMMANDS : REPLY_COMMANDS;
  
  // Filter commands based on workspace context
  const contextualCommands = availableCommands.filter(cmd => {
    // If no specific context, show all commands
    if (!workspaceContext.has_jira && !workspaceContext.has_git && !workspaceContext.has_files && !workspaceContext.has_email) {
      return true;
    }
    
    // Show commands that are relevant to the current context
    const adaptations = Object.keys(cmd.context_adaptations);
    return adaptations.some(adaptation => {
      switch (adaptation) {
        case 'jira': return workspaceContext.has_jira;
        case 'git': return workspaceContext.has_git;
        case 'files': return workspaceContext.has_files;
        case 'email': return workspaceContext.has_email;
        default: return true;
      }
    });
  });

  // Group commands by category
  const commandsByCategory = COMMAND_CATEGORIES.map(category => ({
    ...category,
    commands: contextualCommands.filter(cmd => cmd.category === category.id)
  })).filter(category => category.commands.length > 0);

  const buildFullCommand = (command: Command): string => {
    let fullPrompt = command.base_prompt;
    
    // Add context adaptations
    const contextTypes = [];
    if (workspaceContext.has_jira && command.context_adaptations.jira) {
      contextTypes.push(command.context_adaptations.jira);
    }
    if (workspaceContext.has_git && command.context_adaptations.git) {
      contextTypes.push(command.context_adaptations.git);
    }
    if (workspaceContext.has_files && command.context_adaptations.files) {
      contextTypes.push(command.context_adaptations.files);
    }
    if (workspaceContext.has_email && command.context_adaptations.email) {
      contextTypes.push(command.context_adaptations.email);
    }
    
    if (contextTypes.length > 0) {
      fullPrompt += '\n\nContext-specific instructions:\n' + contextTypes.map(ctx => `• ${ctx}`).join('\n');
    }
    
    // Add custom user addition
    if (customAddition.trim()) {
      fullPrompt += '\n\nAdditional instructions: ' + customAddition.trim();
    }
    
    return fullPrompt;
  };

  const handleCommandSelect = (command: Command) => {
    setSelectedCommand(command);
    setShowDropdown(false);
  };

  const handleSendCommand = () => {
    if (!selectedCommand) return;
    
    const fullCommand = buildFullCommand(selectedCommand);
    
    if (onCommandSelect) {
      onCommandSelect(fullCommand);
    } else {
      injectCommand(fullCommand, true); // Auto-send
    }
    
    // Reset form
    setSelectedCommand(null);
    setCustomAddition('');
  };

  const handleInjectOnly = () => {
    if (!selectedCommand) return;
    
    const fullCommand = buildFullCommand(selectedCommand);
    injectCommand(fullCommand, false); // Just inject, don't send
    
    // Reset form
    setSelectedCommand(null);
    setCustomAddition('');
  };

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-green-400 font-mono text-sm">
          {mode === 'startup' ? '🚀 STARTUP COMMAND' : '💬 REPLY COMMAND'}
        </span>
        <span className="text-gray-500 text-xs">
          Select from library and customize
        </span>
      </div>

      {/* Command Dropdown */}
      <div className="relative mb-3">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full flex items-center justify-between px-3 py-2 bg-black border border-gray-700 rounded text-left text-green-400 font-mono text-sm hover:border-green-400 transition-colors"
        >
          <span>
            {selectedCommand ? `${selectedCommand.keyword} - ${selectedCommand.name}` : 'Select a command...'}
          </span>
          <span className="text-gray-500">{showDropdown ? '▲' : '▼'}</span>
        </button>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-black border border-gray-700 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
            {commandsByCategory.map(category => (
              <div key={category.id}>
                <div className="px-3 py-2 bg-gray-800 text-gray-400 font-mono text-xs border-b border-gray-700">
                  {category.icon} {category.name}
                  <span className="text-gray-600 ml-2">({category.commands.length})</span>
                </div>
                {category.commands.map(command => (
                  <button
                    key={command.id}
                    onClick={() => handleCommandSelect(command)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-green-400 font-mono text-sm">{command.keyword}</span>
                        <span className="text-gray-300 text-sm ml-2">{command.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 text-xs">{command.estimated_duration}</span>
                        {command.requires_approval && (
                          <span className="text-yellow-400 text-xs ml-2">⚠️</span>
                        )}
                      </div>
                    </div>
                    <div className="text-gray-500 text-xs mt-1 truncate">
                      {command.base_prompt.substring(0, 100)}...
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Command Preview */}
      {selectedCommand && (
        <div className="mb-3 p-3 bg-black border border-gray-700 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-400 font-mono text-sm">{selectedCommand.name}</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">{selectedCommand.estimated_duration}</span>
              {selectedCommand.requires_approval && (
                <span className="text-yellow-400" title="Requires approval">⚠️ Approval needed</span>
              )}
            </div>
          </div>
          <div className="text-gray-300 text-sm mb-2">
            {selectedCommand.base_prompt}
          </div>
          
          {/* Context adaptations preview */}
          {Object.keys(selectedCommand.context_adaptations).some(key => workspaceContext[`has_${key}` as keyof typeof workspaceContext]) && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <span className="text-blue-400 text-xs">Context adaptations:</span>
              <ul className="text-gray-400 text-xs mt-1">
                {workspaceContext.has_jira && selectedCommand.context_adaptations.jira && (
                  <li>• JIRA: {selectedCommand.context_adaptations.jira}</li>
                )}
                {workspaceContext.has_git && selectedCommand.context_adaptations.git && (
                  <li>• Git: {selectedCommand.context_adaptations.git}</li>
                )}
                {workspaceContext.has_files && selectedCommand.context_adaptations.files && (
                  <li>• Files: {selectedCommand.context_adaptations.files}</li>
                )}
                {workspaceContext.has_email && selectedCommand.context_adaptations.email && (
                  <li>• Email: {selectedCommand.context_adaptations.email}</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Custom Addition */}
      {selectedCommand && (
        <div className="mb-3">
          <label className="block text-gray-400 text-sm mb-1">
            Additional instructions (optional):
          </label>
          <textarea
            value={customAddition}
            onChange={(e) => setCustomAddition(e.target.value)}
            placeholder="Add specific details, focus areas, or constraints..."
            className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-green-400 font-mono text-sm resize-none focus:outline-none focus:border-green-400"
            rows={3}
          />
        </div>
      )}

      {/* Action Buttons */}
      {selectedCommand && (
        <div className="flex gap-2">
          <button
            onClick={handleInjectOnly}
            className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-green-400 border border-gray-600 rounded font-mono text-sm transition-colors"
          >
            Inject to Terminal
          </button>
          <button
            onClick={handleSendCommand}
            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-black border border-green-500 rounded font-mono text-sm transition-colors"
          >
            {mode === 'startup' ? 'Start Agent' : 'Send Command'}
          </button>
        </div>
      )}

      {/* Follow-up Commands */}
      {selectedCommand && selectedCommand.follow_up_commands.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <span className="text-gray-400 text-xs">Suggested follow-up commands:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {selectedCommand.follow_up_commands.map(cmdId => (
              <span key={cmdId} className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded">
                {cmdId}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}