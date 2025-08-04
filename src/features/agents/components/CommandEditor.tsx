/**
 * Command Editor Component
 * Provides UI for editing individual commands with step-by-step structure
 */
'use client';
import { useState } from 'react';
import { UserCommand } from '../services/CommandManager';

interface CommandEditorProps {
  command: UserCommand;
  onSave: (command: UserCommand) => void;
  onCancel: () => void;
}

export function CommandEditor({ command, onSave, onCancel }: CommandEditorProps) {
  const [editedCommand, setEditedCommand] = useState<UserCommand>({ ...command });
  const [activeTab, setActiveTab] = useState<'basic' | 'prompt' | 'context' | 'advanced'>('basic');

  const handleSave = () => {
    onSave(editedCommand);
  };

  const addContextAdaptation = () => {
    const newKey = prompt('Enter context type (e.g., jira, git, files):');
    if (newKey && !editedCommand.context_adaptations[newKey]) {
      setEditedCommand({
        ...editedCommand,
        context_adaptations: {
          ...editedCommand.context_adaptations,
          [newKey]: ''
        }
      });
    }
  };

  const removeContextAdaptation = (key: string) => {
    const newAdaptations = { ...editedCommand.context_adaptations };
    delete newAdaptations[key];
    setEditedCommand({
      ...editedCommand,
      context_adaptations: newAdaptations
    });
  };

  const addFollowUpCommand = () => {
    const newCommand = prompt('Enter follow-up command ID:');
    if (newCommand && !editedCommand.follow_up_commands.includes(newCommand)) {
      setEditedCommand({
        ...editedCommand,
        follow_up_commands: [...editedCommand.follow_up_commands, newCommand]
      });
    }
  };

  const removeFollowUpCommand = (commandId: string) => {
    setEditedCommand({
      ...editedCommand,
      follow_up_commands: editedCommand.follow_up_commands.filter(id => id !== commandId)
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {editedCommand.is_default ? '✏️ Edit Default Command' : '🔧 Edit Custom Command'}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 rounded border text-sm"
            style={{
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
              backgroundColor: 'transparent'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 rounded text-sm"
            style={{
              color: 'var(--color-text-inverse)',
              backgroundColor: 'var(--color-primary)',
              border: 'none'
            }}
          >
            Save Command
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
        {[
          { key: 'basic', label: '📝 Basic Info' },
          { key: 'prompt', label: '💬 Prompt' },
          { key: 'context', label: '🔗 Context' },
          { key: 'advanced', label: '⚙️ Advanced' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === tab.key ? 'border-b-2' : ''
            }`}
            style={{
              color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderColor: activeTab === tab.key ? 'var(--color-primary)' : 'transparent',
              backgroundColor: activeTab === tab.key ? 'var(--color-surface)' : 'transparent'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Command ID
              </label>
              <input
                type="text"
                value={editedCommand.id}
                onChange={(e) => setEditedCommand({ ...editedCommand, id: e.target.value })}
                className="w-full p-2 border rounded"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)'
                }}
                disabled={editedCommand.is_default}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Display Name
              </label>
              <input
                type="text"
                value={editedCommand.name}
                onChange={(e) => setEditedCommand({ ...editedCommand, name: e.target.value })}
                className="w-full p-2 border rounded"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)'
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Keyword
              </label>
              <input
                type="text"
                value={editedCommand.keyword}
                onChange={(e) => setEditedCommand({ ...editedCommand, keyword: e.target.value })}
                className="w-full p-2 border rounded"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)'
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Category
              </label>
              <select
                value={editedCommand.category}
                onChange={(e) => setEditedCommand({ ...editedCommand, category: e.target.value })}
                className="w-full p-2 border rounded"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)'
                }}
              >
                <option value="analysis">Analysis</option>
                <option value="development">Development</option>
                <option value="testing">Testing</option>
                <option value="documentation">Documentation</option>
                <option value="startup">Startup</option>
                <option value="reply">Reply</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Applicable Roles
              </label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {['developer', 'reviewer', 'tester', 'planner'].map(role => (
                    <label key={role} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-opacity-50" style={{ borderColor: 'var(--color-border)', backgroundColor: editedCommand.roles?.includes(role) ? 'var(--color-primary-faded)' : 'var(--color-surface)' }}>
                      <input
                        type="checkbox"
                        checked={editedCommand.roles?.includes(role) || false}
                        onChange={(e) => {
                          const currentRoles = editedCommand.roles || [];
                          const newRoles = e.target.checked
                            ? [...currentRoles, role]
                            : currentRoles.filter(r => r !== role);
                          setEditedCommand({ ...editedCommand, roles: newRoles });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm capitalize" style={{ color: 'var(--color-text-primary)' }}>
                        {role}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Select which agent roles can use this command. Commands can be shared across multiple roles.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Estimated Duration
              </label>
              <input
                type="text"
                value={editedCommand.estimated_duration}
                onChange={(e) => setEditedCommand({ ...editedCommand, estimated_duration: e.target.value })}
                className="w-full p-2 border rounded"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)'
                }}
                placeholder="e.g., 5-10 minutes"
              />
            </div>
          </div>
        )}

        {activeTab === 'prompt' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Base Prompt
              </label>
              <textarea
                value={editedCommand.base_prompt}
                onChange={(e) => setEditedCommand({ ...editedCommand, base_prompt: e.target.value })}
                className="w-full p-3 border rounded font-mono text-sm"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                  minHeight: '400px'
                }}
                placeholder="Enter the step-by-step command prompt for Claude Code..."
              />
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                This should be formatted as a clear, step-by-step procedure that Claude Code can follow.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Custom Additions
              </label>
              {editedCommand.custom_additions?.map((addition, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={addition}
                    onChange={(e) => {
                      const newAdditions = [...(editedCommand.custom_additions || [])];
                      newAdditions[index] = e.target.value;
                      setEditedCommand({ ...editedCommand, custom_additions: newAdditions });
                    }}
                    className="flex-1 p-2 border rounded"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <button
                    onClick={() => {
                      const newAdditions = editedCommand.custom_additions?.filter((_, i) => i !== index);
                      setEditedCommand({ ...editedCommand, custom_additions: newAdditions });
                    }}
                    className="px-2 py-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    ❌
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newAdditions = [...(editedCommand.custom_additions || []), ''];
                  setEditedCommand({ ...editedCommand, custom_additions: newAdditions });
                }}
                className="text-sm px-3 py-1 border rounded"
                style={{
                  color: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                  backgroundColor: 'transparent'
                }}
              >
                + Add Custom Addition
              </button>
            </div>
          </div>
        )}

        {activeTab === 'context' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Context Adaptations
                </label>
                <button
                  onClick={addContextAdaptation}
                  className="text-sm px-3 py-1 border rounded"
                  style={{
                    color: 'var(--color-primary)',
                    borderColor: 'var(--color-primary)',
                    backgroundColor: 'transparent'
                  }}
                >
                  + Add Context Type
                </button>
              </div>
              
              <div className="space-y-3">
                {Object.entries(editedCommand.context_adaptations).map(([key, value]) => (
                  <div key={key} className="border rounded p-3" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {key.charAt(0).toUpperCase() + key.slice(1)} Context
                      </span>
                      <button
                        onClick={() => removeContextAdaptation(key)}
                        className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      value={value}
                      onChange={(e) => setEditedCommand({
                        ...editedCommand,
                        context_adaptations: {
                          ...editedCommand.context_adaptations,
                          [key]: e.target.value
                        }
                      })}
                      className="w-full p-2 border rounded text-sm"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)'
                      }}
                      rows={2}
                      placeholder={`Additional instructions when ${key} context is available...`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Follow-up Commands
                </label>
                <button
                  onClick={addFollowUpCommand}
                  className="text-sm px-3 py-1 border rounded"
                  style={{
                    color: 'var(--color-primary)',
                    borderColor: 'var(--color-primary)',
                    backgroundColor: 'transparent'
                  }}
                >
                  + Add Follow-up
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {editedCommand.follow_up_commands.map((cmdId) => (
                  <div
                    key={cmdId}
                    className="flex items-center gap-2 px-2 py-1 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--color-surface-elevated)',
                      color: 'var(--color-text-secondary)'
                    }}
                  >
                    <span>{cmdId}</span>
                    <button
                      onClick={() => removeFollowUpCommand(cmdId)}
                      className="text-red-500 hover:bg-red-50 px-1 rounded"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requires_approval"
                checked={editedCommand.requires_approval}
                onChange={(e) => setEditedCommand({ ...editedCommand, requires_approval: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="requires_approval" className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Requires Approval
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Required Permissions
              </label>
              {editedCommand.required_permissions.map((permission, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={permission}
                    onChange={(e) => {
                      const newPermissions = [...editedCommand.required_permissions];
                      newPermissions[index] = e.target.value;
                      setEditedCommand({ ...editedCommand, required_permissions: newPermissions });
                    }}
                    className="flex-1 p-2 border rounded"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <button
                    onClick={() => {
                      const newPermissions = editedCommand.required_permissions.filter((_, i) => i !== index);
                      setEditedCommand({ ...editedCommand, required_permissions: newPermissions });
                    }}
                    className="px-2 py-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    ❌
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newPermissions = [...editedCommand.required_permissions, ''];
                  setEditedCommand({ ...editedCommand, required_permissions: newPermissions });
                }}
                className="text-sm px-3 py-1 border rounded"
                style={{
                  color: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                  backgroundColor: 'transparent'
                }}
              >
                + Add Permission
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Success Rate
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={editedCommand.success_rate}
                  onChange={(e) => setEditedCommand({ ...editedCommand, success_rate: parseFloat(e.target.value) })}
                  className="w-full p-2 border rounded"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Usage Count
                </label>
                <input
                  type="number"
                  min="0"
                  value={editedCommand.usage_count}
                  onChange={(e) => setEditedCommand({ ...editedCommand, usage_count: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}