/**
 * Agent Management Modal Component
 *
 * Modal with 3 tabs: Commands, Permissions, Checkpoints
 */
'use client';
import { useState, useEffect } from 'react';
import { CommandEditor } from '@/features/agents/components/CommandEditor';
import CommandClientService from '@/features/agents/services/CommandClientService';
import { UserCommand } from '@/features/agents/services/CommandManager';

interface AgentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentManagementModal({ isOpen, onClose }: AgentManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'commands' | 'permissions' | 'checkpoints'>('commands');
  if (!isOpen) return null;
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
        className="relative w-full max-w-4xl h-3/4 rounded-lg shadow-xl flex flex-col"
        style={{
          backgroundColor: 'var(--color-surface-elevated)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            🤖 Manage Agents
          </h2>
          <button
            onClick={onClose}
            className="text-xl"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>
        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          {[
            { key: 'commands', label: '📜 Commands', desc: 'Manage agent commands' },
            { key: 'permissions', label: '🔒 Permissions', desc: 'Configure agent permissions' },
            { key: 'checkpoints', label: '💾 Checkpoints', desc: 'Manage agent checkpoints' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 px-6 py-4 text-left transition-colors ${
                activeTab === tab.key ? 'border-b-2' : ''
              }`}
              style={{
                color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                borderColor: activeTab === tab.key ? 'var(--color-primary)' : 'transparent',
                backgroundColor: activeTab === tab.key ? 'var(--color-surface)' : 'transparent',
              }}
            >
              <div className="font-medium">{tab.label}</div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {tab.desc}
              </div>
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {activeTab === 'commands' && <CommandsTab />}
          {activeTab === 'permissions' && <PermissionsTab />}
          {activeTab === 'checkpoints' && <CheckpointsTab />}
        </div>
      </div>
    </div>
  );
}
function CommandsTab() {
  const [commands, setCommands] = useState<UserCommand[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<UserCommand[]>([]);
  const [selectedCommand, setSelectedCommand] = useState<UserCommand | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'startup' | 'reply' | 'custom'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'developer' | 'reviewer' | 'tester' | 'planner'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [roleTemplates, setRoleTemplates] = useState<any>({});

  const commandService = CommandClientService.getInstance();

  useEffect(() => {
    loadCommands();
    loadRoleTemplates();
  }, []);

  useEffect(() => {
    filterCommands();
  }, [commands, filter, roleFilter, searchTerm]);

  const loadCommands = async () => {
    try {
      setLoading(true);
      const loadedCommands = await commandService.getAllCommands();
      setCommands(loadedCommands);
    } catch (error) {
      console.error('Failed to load commands:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoleTemplates = async () => {
    try {
      const templates = await commandService.getRoleTemplates();
      setRoleTemplates(templates);
    } catch (error) {
      console.error('Failed to load role templates:', error);
    }
  };

  const filterCommands = () => {
    let filtered = commands;

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(cmd => {
        // Check if command has roles array and includes the specified role
        return cmd.roles?.includes(roleFilter) || cmd.id.startsWith(roleFilter + '_');
      });
    }

    // Apply filter
    if (filter === 'startup') {
      filtered = filtered.filter(cmd => ['investigate', 'analyze', 'plan', 'setup'].includes(cmd.keyword));
    } else if (filter === 'reply') {
      filtered = filtered.filter(cmd => ['implement', 'debug', 'review', 'test', 'explain', 'continue'].includes(cmd.keyword));
    } else if (filter === 'custom') {
      filtered = filtered.filter(cmd => !cmd.is_default);
    }

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(cmd => 
        cmd.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cmd.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cmd.base_prompt.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredCommands(filtered);
  };

  const handleEditCommand = (command: UserCommand) => {
    setSelectedCommand(command);
    setIsEditing(true);
  };

  const handleSaveCommand = async (command: UserCommand) => {
    try {
      await commandService.saveCommand(command);
      await loadCommands();
      setIsEditing(false);
      setSelectedCommand(null);
    } catch (error) {
      console.error('Failed to save command:', error);
    }
  };

  const handleDeleteCommand = async (commandId: string) => {
    if (confirm('Are you sure you want to delete this command?')) {
      try {
        await commandService.deleteCommand(commandId);
        await loadCommands();
      } catch (error) {
        console.error('Failed to delete command:', error);
      }
    }
  };

  const handleCreateCommand = () => {
    const rolePrefix = roleFilter !== 'all' ? `${roleFilter}_` : 'custom_';
    const category = roleFilter !== 'all' ? roleFilter : 'development';
    const defaultRoles = roleFilter !== 'all' ? [roleFilter] : ['developer'];
    
    const newCommand: UserCommand = {
      id: `${rolePrefix}${Date.now()}`,
      name: 'New Command',
      keyword: 'new',
      category: category,
      base_prompt: '# New Command\n\n## Objective\nDescribe what this command should accomplish.\n\n## Step-by-Step Process\n\n### 1. First Step\n- Detail the first step\n\n### 2. Second Step\n- Detail the second step\n\n## Expected Deliverables\n- List what should be delivered',
      context_adaptations: {},
      requires_approval: false,
      estimated_duration: '5-10 minutes',
      follow_up_commands: [],
      usage_count: 0,
      success_rate: 0.0,
      average_completion_time_ms: 0,
      required_permissions: ['read_context', 'read_target'],
      user_modified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_default: false,
      roles: defaultRoles
    };
    
    setSelectedCommand(newCommand);
    setIsEditing(true);
  };

  if (isEditing && selectedCommand) {
    return (
      <CommandEditor
        command={selectedCommand}
        onSave={handleSaveCommand}
        onCancel={() => {
          setIsEditing(false);
          setSelectedCommand(null);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Agent Commands Library
        </h3>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                await commandService.migrateCommands();
                await loadCommands();
                alert('Commands migrated successfully!');
              } catch (error) {
                console.error('Migration failed:', error);
                alert('Migration failed. Check console for details.');
              }
            }}
            className="px-3 py-1 rounded text-sm border"
            style={{
              color: 'var(--color-primary)',
              borderColor: 'var(--color-primary)',
              backgroundColor: 'transparent'
            }}
          >
            🔄 Migrate Commands
          </button>
          <button
            onClick={handleCreateCommand}
            className="px-3 py-1 rounded text-sm"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              border: 'none'
            }}
          >
            + Create Command
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex gap-4 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search commands..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 border rounded"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)'
            }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="p-2 border rounded"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)'
          }}
        >
          <option value="all">All Roles</option>
          <option value="developer">Developer</option>
          <option value="reviewer">Reviewer</option>
          <option value="tester">Tester</option>
          <option value="planner">Planner</option>
        </select>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="p-2 border rounded"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)'
          }}
        >
          <option value="all">All Commands</option>
          <option value="startup">Startup Commands</option>
          <option value="reply">Reply Commands</option>
          <option value="custom">Custom Commands</option>
        </select>
      </div>

      {/* Commands List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2" style={{ borderColor: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-secondary)' }}>Loading commands...</p>
            </div>
          </div>
        ) : filteredCommands.length === 0 ? (
          <div className="text-center py-8">
            <p style={{ color: 'var(--color-text-secondary)' }}>No commands found matching your criteria</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {filteredCommands.map((command) => (
              <div
                key={command.id}
                className="border rounded-lg p-3 hover:bg-opacity-50 transition-colors"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface-elevated)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}>
                      {command.keyword}
                    </span>
                    <div>
                      <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {command.name}
                        {command.is_default && (
                          <span className="ml-2 text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}>
                            Default
                          </span>
                        )}
                      </h4>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {command.category} • {command.estimated_duration}
                        {command.requires_approval && <span className="ml-2 text-yellow-500">⚠️ Requires approval</span>}
                      </p>
                      {command.roles && command.roles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {command.roles.map(role => (
                            <span key={role} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                              {role}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                      Used {command.usage_count} times
                    </span>
                    <button
                      onClick={() => handleEditCommand(command)}
                      className="text-sm px-2 py-1 rounded border"
                      style={{
                        color: 'var(--color-primary)',
                        borderColor: 'var(--color-primary)',
                        backgroundColor: 'transparent'
                      }}
                    >
                      Edit
                    </button>
                    {!command.is_default && (
                      <button
                        onClick={() => handleDeleteCommand(command.id)}
                        className="text-sm px-2 py-1 rounded border"
                        style={{
                          color: '#ef4444',
                          borderColor: '#ef4444',
                          backgroundColor: 'transparent'
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {command.base_prompt.length > 150 
                    ? `${command.base_prompt.substring(0, 150)}...` 
                    : command.base_prompt}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function PermissionsTab() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('developer');
  const [customPermissions, setCustomPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Current generous permissions (the default set we're using)
  const currentPermissions = {
    fileSystem: {
      read: ['**'],
      write: ['target/**', 'feedback/**', 'src/**'],
      execute: ['target/**', 'scripts/**']
    },
    git: {
      allowedOperations: ['diff', 'status', 'log', 'show', 'blame', 'add', 'commit'],
      protectedBranches: ['main', 'master', 'production'],
      requiresApproval: ['push', 'branch', 'checkout']
    },
    external: {
      allowedHosts: ['api.github.com', 'api.openai.com', 'api.anthropic.com'],
      apiKeys: {}
    },
    commands: {
      allowed: ['ls', 'cat', 'head', 'tail', 'grep', 'find', 'git', 'npm', 'node', 'mkdir', 'touch', 'echo'],
      requiresApproval: ['rm', 'rmdir', 'mv', 'cp', 'chmod', 'chown'],
      forbidden: ['sudo', 'su', 'passwd', 'shutdown', 'reboot']
    },
    systemAccess: {
      canInstallPackages: true,
      canModifyEnvironment: true,
      canAccessNetwork: true,
      maxResourceUsage: {
        memory: 512, // MB
        cpu: 50,     // %
        disk: 100    // MB
      }
    }
  };

  const permissionTemplates = {
    developer: {
      name: 'Developer',
      description: 'Full development permissions with file system access',
      permissions: currentPermissions
    },
    reviewer: {
      name: 'Reviewer',
      description: 'Read-only access for code review and analysis',
      permissions: {
        ...currentPermissions,
        fileSystem: {
          read: ['**'],
          write: ['feedback/**'],
          execute: []
        },
        git: {
          allowedOperations: ['diff', 'status', 'log', 'show', 'blame'],
          protectedBranches: ['main', 'master', 'production'],
          requiresApproval: ['add', 'commit', 'push', 'branch', 'checkout']
        },
        systemAccess: {
          ...currentPermissions.systemAccess,
          canInstallPackages: false,
          canModifyEnvironment: false
        }
      }
    },
    analyst: {
      name: 'Analyst',
      description: 'Limited permissions for code analysis and documentation',
      permissions: {
        ...currentPermissions,
        fileSystem: {
          read: ['**'],
          write: ['feedback/**'],
          execute: []
        },
        commands: {
          allowed: ['ls', 'cat', 'head', 'tail', 'grep', 'find', 'git'],
          requiresApproval: ['npm', 'node'],
          forbidden: ['rm', 'rmdir', 'mv', 'cp', 'chmod', 'chown', 'sudo', 'su']
        },
        systemAccess: {
          ...currentPermissions.systemAccess,
          canInstallPackages: false,
          canModifyEnvironment: false
        }
      }
    }
  };

  const renderPermissionSection = (title: string, permissions: any, icon: string) => {
    return (
      <div className="mb-6 p-4 border rounded-lg" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
        <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <span>{icon}</span>
          {title}
        </h4>
        <div className="space-y-2">
          {Object.entries(permissions).map(([key, value]) => (
            <div key={key} className="flex items-start gap-3">
              <span className="font-mono text-sm px-2 py-1 rounded bg-opacity-50" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-primary)' }}>
                {key}
              </span>
              <div className="flex-1">
                {Array.isArray(value) ? (
                  <div className="flex flex-wrap gap-1">
                    {value.map((item, index) => (
                      <span key={index} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}>
                        {item}
                      </span>
                    ))}
                  </div>
                ) : typeof value === 'object' ? (
                  <div className="text-sm space-y-1">
                    {Object.entries(value).map(([subKey, subValue]) => (
                      <div key={subKey} className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{subKey}:</span>
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {Array.isArray(subValue) ? subValue.join(', ') : String(subValue)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {String(value)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const currentTemplate = permissionTemplates[selectedTemplate as keyof typeof permissionTemplates];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Agent Permissions
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Template:</span>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)'
            }}
          >
            {Object.entries(permissionTemplates).map(([key, template]) => (
              <option key={key} value={key}>{template.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Template Description */}
      <div className="flex-shrink-0 mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {currentTemplate.name} Template
          </span>
          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}>
            Active
          </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {currentTemplate.description}
        </p>
      </div>

      {/* Permissions Display */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-4">
          {renderPermissionSection(
            'File System Access',
            currentTemplate.permissions.fileSystem,
            '📁'
          )}
          
          {renderPermissionSection(
            'Git Operations',
            currentTemplate.permissions.git,
            '📋'
          )}
          
          {renderPermissionSection(
            'External Access',
            currentTemplate.permissions.external,
            '🌐'
          )}
          
          {renderPermissionSection(
            'Command Permissions',
            currentTemplate.permissions.commands,
            '⚡'
          )}
          
          {renderPermissionSection(
            'System Access',
            currentTemplate.permissions.systemAccess,
            '🔧'
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button
          className="flex-1 px-3 py-2 text-sm border rounded transition-colors"
          style={{
            color: 'var(--color-primary)',
            borderColor: 'var(--color-primary)',
            backgroundColor: 'transparent'
          }}
        >
          Export Permissions
        </button>
        <button
          className="flex-1 px-3 py-2 text-sm border rounded transition-colors"
          style={{
            color: 'var(--color-text-inverse)',
            backgroundColor: 'var(--color-primary)',
            borderColor: 'var(--color-primary)'
          }}
        >
          Apply Template
        </button>
      </div>
    </div>
  );
}
function CheckpointsTab() {
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<any>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Load checkpoints from global storage
  const loadCheckpoints = async () => {
    try {
      setLoading(true);
      // Get any workspace and agent ID for the API call (checkpoints are now global)
      const workspaceId = window.location.pathname.split('/')[2] || 'default';
      const agentId = 'global'; // Placeholder since checkpoints are now global
      
      // Load all global checkpoints
      const checkpointResponse = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/checkpoints`);
      if (checkpointResponse.ok) {
        const checkpointData = await checkpointResponse.json();
        if (checkpointData.success && checkpointData.checkpoints) {
          // Add any missing fields for backward compatibility
          const processedCheckpoints = checkpointData.checkpoints.map(cp => ({
            ...cp,
            workspaceId: cp.source_workspace_id || workspaceId,
            agentId: cp.source_agent_id || 'unknown',
            agentName: cp.agent_name || `Agent ${(cp.source_agent_id || 'unknown').slice(-6)}`
          }));
          
          // Sort by creation date (newest first)
          processedCheckpoints.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          setCheckpoints(processedCheckpoints);
        } else {
          setCheckpoints([]);
        }
      } else {
        setCheckpoints([]);
      }
    } catch (error) {
      console.error('Failed to load checkpoints:', error);
      setCheckpoints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCheckpoints();
  }, []);

  const handleRestoreCheckpoint = async (checkpoint: any) => {
    setIsRestoring(true);
    try {
      // Get current workspace ID from URL
      const currentWorkspaceId = window.location.pathname.split('/')[2];
      
      if (!currentWorkspaceId) {
        alert('Cannot restore checkpoint: No workspace context available');
        return;
      }
      
      // For now, we'll restore to a new agent in the current workspace
      // In the future, you might want to let the user choose which agent to restore to
      const newAgentId = `agent-restored-${Date.now()}`;
      
      // Navigate to the current workspace with a new agent and the checkpoint parameter
      window.location.href = `/workspace/${currentWorkspaceId}/agent/${newAgentId}?checkpoint=${checkpoint.id}`;
    } catch (error) {
      console.error('Error restoring checkpoint:', error);
      alert('Error restoring checkpoint. Please try again.');
    } finally {
      setIsRestoring(false);
      setShowRestoreModal(false);
    }
  };

  const handleDeleteCheckpoint = async (checkpoint: any) => {
    if (!confirm(`Are you sure you want to delete the checkpoint "${checkpoint.name}"?`)) {
      return;
    }
    
    try {
      // Use current workspace for the API call (checkpoints are global but we need the API route)
      const currentWorkspaceId = window.location.pathname.split('/')[2] || 'default';
      const agentId = 'global'; // Placeholder since checkpoints are now global
      
      const response = await fetch(`/api/workspaces/${currentWorkspaceId}/agents/${agentId}/checkpoints?id=${checkpoint.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log('Checkpoint deleted successfully');
        // Reload checkpoints
        loadCheckpoints();
      } else {
        alert('Failed to delete checkpoint.');
      }
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
      alert('Error deleting checkpoint. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Expert Agent Checkpoints
        </h3>
        <button
          onClick={loadCheckpoints}
          className="px-3 py-1 rounded text-sm border"
          style={{
            color: 'var(--color-primary)',
            borderColor: 'var(--color-primary)',
            backgroundColor: 'transparent'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Checkpoints List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2" style={{ borderColor: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-secondary)' }}>Loading checkpoints...</p>
            </div>
          </div>
        ) : checkpoints.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">💾</div>
            <p className="text-lg mb-2" style={{ color: 'var(--color-text-primary)' }}>No checkpoints saved yet</p>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Save checkpoints from agent terminals to preserve their expertise and conversation state.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {checkpoints.map((checkpoint) => (
              <div
                key={checkpoint.id}
                className="border rounded-lg p-4 hover:bg-opacity-50 transition-colors"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface-elevated)'
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-lg" style={{ color: 'var(--color-text-primary)' }}>
                        {checkpoint.name}
                      </h4>
                      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}>
                        {checkpoint.model}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      <span>🤖 {checkpoint.agentName}</span>
                      <span>💬 {checkpoint.message_count} messages</span>
                      <span>📅 {formatDate(checkpoint.created_at)}</span>
                      {checkpoint.source_workspace_id && (
                        <span>🏗️ {checkpoint.source_workspace_id.slice(-8)}</span>
                      )}
                    </div>
                    
                    {checkpoint.description && (
                      <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {checkpoint.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedCheckpoint(checkpoint);
                        setShowRestoreModal(true);
                      }}
                      className="text-sm px-3 py-1 rounded border"
                      style={{
                        color: 'var(--color-primary)',
                        borderColor: 'var(--color-primary)',
                        backgroundColor: 'transparent'
                      }}
                    >
                      🔄 Restore
                    </button>
                    <button
                      onClick={() => handleDeleteCheckpoint(checkpoint)}
                      className="text-sm px-3 py-1 rounded border"
                      style={{
                        color: '#ef4444',
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent'
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreModal && selectedCheckpoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowRestoreModal(false)}
          />
          <div className="relative bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">🔄 Restore Checkpoint</h3>
            
            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                Are you sure you want to restore the checkpoint "{selectedCheckpoint.name}"?
              </p>
              
              <div className="bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded-lg p-3">
                <p className="text-yellow-300 text-sm">
                  ⚠️ This will create a new agent in the current workspace with the saved conversation state and expertise.
                </p>
              </div>
              
              <div className="text-sm text-gray-400 space-y-1">
                <div>Agent: {selectedCheckpoint.agentName}</div>
                <div>Messages: {selectedCheckpoint.message_count}</div>
                <div>Created: {formatDate(selectedCheckpoint.created_at)}</div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestoreCheckpoint(selectedCheckpoint)}
                disabled={isRestoring}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded-md transition-colors"
              >
                {isRestoring ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}