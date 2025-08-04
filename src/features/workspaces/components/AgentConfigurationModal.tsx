/**
 * Agent Configuration Modal for Workspace Drafts
 * 
 * Allows configuring up to 4 default agents for a workspace draft
 * with custom names, roles, commands, and permissions
 */
'use client';
import { useState, useEffect } from 'react';
import { AgentConfig, WorkspaceDraft } from '../types';
import CommandClientService from '@/features/agents/services/CommandClientService';
import { UserCommand } from '@/features/agents/services/CommandManager';
import { STARTUP_COMMANDS, REPLY_COMMANDS } from '@/features/agents/data/commandLibrary';

interface AgentConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: WorkspaceDraft;
  onUpdate: (draftId: string, updates: Partial<WorkspaceDraft>) => void;
}

const DEFAULT_ROLES = [
  { id: 'developer', name: 'Developer', description: 'Code implementation and debugging', color: '#3b82f6' },
  { id: 'reviewer', name: 'Code Reviewer', description: 'Code review and quality assurance', color: '#10b981' },
  { id: 'tester', name: 'Tester', description: 'Testing and quality validation', color: '#f59e0b' },
  { id: 'planner', name: 'Project Planner', description: 'Planning and architecture', color: '#8b5cf6' },
];

const DEFAULT_PERMISSIONS = [
  'read_files',
  'write_files',
  'execute_commands',
  'access_git',
  'modify_dependencies',
  'access_network',
];

export function AgentConfigurationModal({ isOpen, onClose, draft, onUpdate }: AgentConfigurationModalProps) {
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([]);
  const [availableCommands, setAvailableCommands] = useState<UserCommand[]>([]);
  const [availableCheckpoints, setAvailableCheckpoints] = useState<any[]>([]);
  const [selectedAgentIndex, setSelectedAgentIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Initialize agent configs from draft or create defaults
  useEffect(() => {
    if (isOpen) {
      loadCommands();
      loadCheckpoints();
      
      if (draft.agent_configs && draft.agent_configs.length > 0) {
        setAgentConfigs([...draft.agent_configs]);
      } else {
        // Create default agents - Dev Assistant and Code Reviewer
        const defaultConfigs: AgentConfig[] = [
          {
            id: `agent-${Date.now()}-1`,
            name: 'Dev Assistant',
            role: 'developer',
            permissions: DEFAULT_PERMISSIONS,
            commands: [],
            command_triggers: {},
            model: 'claude-3-5-sonnet',
            priority: 1,
          },
          {
            id: `agent-${Date.now()}-2`,
            name: 'Code Reviewer',
            role: 'reviewer',
            permissions: DEFAULT_PERMISSIONS,
            commands: [],
            command_triggers: {},
            model: 'claude-3-5-sonnet',
            priority: 2,
          }
        ];
        setAgentConfigs(defaultConfigs);
      }
    }
  }, [isOpen, draft]);

  const loadCommands = async () => {
    try {
      setLoading(true);
      const commandService = CommandClientService.getInstance();
      const commands = await commandService.getAllCommands();
      setAvailableCommands(commands);
    } catch (error) {
      console.error('Failed to load commands from API:', error);
      console.log('Using fallback commands from library...');
      
      // Fallback to commands from the library
      const fallbackCommands: UserCommand[] = [
        ...STARTUP_COMMANDS.map(cmd => ({
          id: cmd.id,
          name: cmd.name,
          category: cmd.category,
          trigger_type: 'startup' as const,
          template: cmd.base_prompt,
          fields: [],
          permissions: cmd.required_permissions,
          role: 'all',
          user_created: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        ...REPLY_COMMANDS.map(cmd => ({
          id: cmd.id,
          name: cmd.name,
          category: cmd.category,
          trigger_type: 'reply' as const,
          template: cmd.base_prompt,
          fields: [],
          permissions: cmd.required_permissions,
          role: 'all',
          user_created: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
      ];
      
      setAvailableCommands(fallbackCommands);
    } finally {
      setLoading(false);
    }
  };

  const loadCheckpoints = async () => {
    try {
      console.log('Loading checkpoints...');
      const response = await fetch('/api/checkpoints');
      console.log('Checkpoints response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Checkpoints data:', data);
        setAvailableCheckpoints(data.checkpoints || []);
        console.log('Available checkpoints set:', data.checkpoints?.length || 0);
      } else {
        console.error('Failed to load checkpoints - status:', response.status);
        setAvailableCheckpoints([]);
      }
    } catch (error) {
      console.error('Failed to load checkpoints:', error);
      setAvailableCheckpoints([]);
    }
  };

  const handleSave = () => {
    onUpdate(draft.id, { agent_configs: agentConfigs });
    onClose();
  };

  const addAgent = () => {
    if (agentConfigs.length >= 4) return;
    
    const newAgent: AgentConfig = {
      id: `agent-${Date.now()}-${agentConfigs.length + 1}`,
      name: `Agent ${agentConfigs.length + 1}`,
      role: 'developer',
      permissions: DEFAULT_PERMISSIONS,
      commands: [],
      command_triggers: {},
      model: 'claude-3-5-sonnet',
      priority: agentConfigs.length + 1,
    };
    
    setAgentConfigs([...agentConfigs, newAgent]);
    setSelectedAgentIndex(agentConfigs.length);
  };

  const removeAgent = (index: number) => {
    const newConfigs = agentConfigs.filter((_, i) => i !== index);
    setAgentConfigs(newConfigs);
    if (selectedAgentIndex >= newConfigs.length) {
      setSelectedAgentIndex(Math.max(0, newConfigs.length - 1));
    }
  };

  const updateAgent = (index: number, updates: Partial<AgentConfig>) => {
    const newConfigs = [...agentConfigs];
    newConfigs[index] = { ...newConfigs[index], ...updates };
    setAgentConfigs(newConfigs);
  };

  const toggleCommand = (commandId: string) => {
    const agent = agentConfigs[selectedAgentIndex];
    if (!agent) return;

    const commands = agent.commands.includes(commandId)
      ? agent.commands.filter(id => id !== commandId)
      : [...agent.commands, commandId];
    
    // If removing command, also remove its trigger setting
    if (!commands.includes(commandId)) {
      const newTriggers = { ...agent.command_triggers };
      delete newTriggers[commandId];
      updateAgent(selectedAgentIndex, { commands, command_triggers: newTriggers });
    } else {
      // If adding command, use its default trigger type
      const command = availableCommands.find(c => c.id === commandId);
      const defaultTrigger = command?.trigger_type || 'reply';
      const newTriggers = { 
        ...agent.command_triggers, 
        [commandId]: defaultTrigger 
      };
      updateAgent(selectedAgentIndex, { commands, command_triggers: newTriggers });
    }
  };

  const updateCommandTrigger = (commandId: string, triggerType: 'startup' | 'reply') => {
    const agent = agentConfigs[selectedAgentIndex];
    if (!agent) return;

    const newTriggers = { 
      ...agent.command_triggers, 
      [commandId]: triggerType 
    };
    updateAgent(selectedAgentIndex, { command_triggers: newTriggers });
  };

  const togglePermission = (permission: string) => {
    const agent = agentConfigs[selectedAgentIndex];
    if (!agent) return;

    const permissions = agent.permissions.includes(permission)
      ? agent.permissions.filter(p => p !== permission)
      : [...agent.permissions, permission];
    
    updateAgent(selectedAgentIndex, { permissions });
  };

  if (!isOpen) return null;

  const currentAgent = agentConfigs[selectedAgentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className="relative w-full max-w-6xl h-5/6 rounded-lg shadow-xl flex flex-col"
        style={{
          backgroundColor: 'var(--color-surface-elevated)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              🤖 Configure Agents for {draft.name}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Set up default agents that will be launched when this workspace is published
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xl"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Agents List */}
          <div className="w-1/3 border-r p-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Agents ({agentConfigs.length}/4)
              </h3>
              <button
                onClick={addAgent}
                disabled={agentConfigs.length >= 4}
                className="px-2 py-1 rounded text-sm transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)',
                }}
              >
                + Add
              </button>
            </div>

            <div className="space-y-2">
              {agentConfigs.map((agent, index) => {
                const role = DEFAULT_ROLES.find(r => r.id === agent.role);
                return (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgentIndex(index)}
                    className={`p-3 rounded border cursor-pointer transition-colors ${
                      selectedAgentIndex === index ? 'ring-2 ring-blue-500' : ''
                    }`}
                    style={{
                      backgroundColor: selectedAgentIndex === index 
                        ? 'var(--color-primary-background)' 
                        : 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {agent.name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {role?.name} • {agent.commands.length} commands
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAgent(index);
                        }}
                        className="text-red-500 hover:text-red-700 text-sm"
                        title="Remove agent"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent Configuration */}
          <div className="flex-1 p-6 overflow-y-auto">
            {currentAgent ? (
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Agent Name
                      </label>
                      <input
                        type="text"
                        value={currentAgent.name}
                        onChange={(e) => updateAgent(selectedAgentIndex, { name: e.target.value })}
                        className="w-full px-3 py-2 rounded border"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Role
                      </label>
                      <select
                        value={currentAgent.role}
                        onChange={(e) => updateAgent(selectedAgentIndex, { role: e.target.value })}
                        className="w-full px-3 py-2 rounded border"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {DEFAULT_ROLES.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.name} - {role.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Default Agent Type
                    </label>
                    <select
                      value={currentAgent.checkpoint_id || 'fresh'}
                      onChange={(e) => updateAgent(selectedAgentIndex, { 
                        checkpoint_id: e.target.value === 'fresh' ? undefined : e.target.value 
                      })}
                      className="w-full px-3 py-2 rounded border"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <option value="fresh">🆕 Fresh Agent (starts from scratch)</option>
                      {availableCheckpoints.length > 0 ? (
                        availableCheckpoints.map(checkpoint => (
                          <option key={checkpoint.id} value={checkpoint.id}>
                            💾 {checkpoint.name} - {checkpoint.description || 'Saved checkpoint'}
                          </option>
                        ))
                      ) : (
                        <option disabled>Loading checkpoints...</option>
                      )}
                    </select>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {currentAgent.checkpoint_id 
                        ? "This agent will start from a saved checkpoint with existing knowledge and context"
                        : "This agent will start fresh with no prior conversation history"
                      }
                      {loading && <span> (Loading checkpoints...)</span>}
                      {!loading && availableCheckpoints.length === 0 && <span> (No checkpoints available)</span>}
                    </div>
                  </div>
                </div>

                {/* Commands */}
                <div>
                  <h3 className="font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Commands ({currentAgent.commands.length} selected)
                  </h3>
                  <div className="border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="grid grid-cols-1 gap-2 p-3 max-h-48 overflow-y-auto">
                      {availableCommands.map(command => {
                        const isSelected = currentAgent.commands.includes(command.id);
                        const currentTrigger = currentAgent.command_triggers?.[command.id] || command.trigger_type;
                        
                        return (
                          <div
                            key={command.id}
                            className="flex items-center gap-3 p-2 rounded"
                            style={{ backgroundColor: 'var(--color-surface)' }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCommand(command.id)}
                              className="rounded"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                {command.name}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                {command.category}
                              </div>
                            </div>
                            {isSelected && (
                              <select
                                value={currentTrigger}
                                onChange={(e) => updateCommandTrigger(command.id, e.target.value as 'startup' | 'reply')}
                                className="text-xs px-2 py-1 rounded border"
                                style={{
                                  backgroundColor: 'var(--color-surface)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              >
                                <option value="startup">🚀 On Publish</option>
                                <option value="reply">💬 Manual</option>
                              </select>
                            )}
                            {!isSelected && (
                              <div className="text-xs px-2 py-1 rounded opacity-50" style={{
                                backgroundColor: command.trigger_type === 'startup' ? 'var(--color-accent-background)' : 'var(--color-surface-elevated)',
                                color: command.trigger_type === 'startup' ? 'var(--color-accent)' : 'var(--color-text-secondary)'
                              }}>
                                {command.trigger_type === 'startup' ? '🚀 On Publish' : '💬 Manual'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <h3 className="font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Permissions ({currentAgent.permissions.length} granted)
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {DEFAULT_PERMISSIONS.map(permission => (
                      <label
                        key={permission}
                        className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-opacity-50"
                        style={{ backgroundColor: 'var(--color-surface)' }}
                      >
                        <input
                          type="checkbox"
                          checked={currentAgent.permissions.includes(permission)}
                          onChange={() => togglePermission(permission)}
                          className="rounded"
                        />
                        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {permission.replace(/_/g, ' ')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-4xl mb-4">🤖</div>
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    Select an agent to configure
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Agents will be automatically launched when workspace is published
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded transition-colors"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded transition-colors"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
              }}
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}