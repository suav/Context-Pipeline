import React, { useState, useEffect } from 'react';
import { AgentTemplate } from '../types';

interface CustomAgentBuilderProps {
  onAgentCreated: (agent: AgentOption) => void;
}

const CustomAgentBuilder: React.FC<CustomAgentBuilderProps> = ({ onAgentCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    model: 'claude-3-5-sonnet-20241022',
    commands: [] as string[],
    permissions: [] as string[],
    commandInput: '',
    permissionInput: ''
  });

  const [isCreating, setIsCreating] = useState(false);

  const availableCommands = [
    'analyze', 'investigate', 'debug', 'plan', 'implement', 'setup', 
    'test', 'review', 'optimize', 'document', 'deploy', 'monitor'
  ];

  const availablePermissions = [
    'read_context', 'read_target', 'write_target', 'git_operations', 
    'security_scan', 'run_tests', 'deploy_code', 'manage_files'
  ];

  const handleAddCommand = (command: string) => {
    if (command && !formData.commands.includes(command)) {
      setFormData(prev => ({
        ...prev,
        commands: [...prev.commands, command],
        commandInput: ''
      }));
    }
  };

  const handleAddPermission = (permission: string) => {
    if (permission && !formData.permissions.includes(permission)) {
      setFormData(prev => ({
        ...prev,
        permissions: [...prev.permissions, permission],
        permissionInput: ''
      }));
    }
  };

  const removeCommand = (command: string) => {
    setFormData(prev => ({
      ...prev,
      commands: prev.commands.filter(c => c !== command)
    }));
  };

  const removePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.filter(p => p !== permission)
    }));
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      alert('Agent name is required');
      return;
    }

    setIsCreating(true);

    const customAgent: AgentOption = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: formData.name.trim(),
      model: formData.model,
      type: 'template',
      description: formData.description || `Custom agent: ${formData.name}`,
      commands: formData.commands,
      permissions: formData.permissions,
      usage_count: 0,
      success_rate: 1.0,
      source: 'custom'
    };

    onAgentCreated(customAgent);

    // Reset form
    setFormData({
      name: '',
      description: '',
      model: 'claude-3-5-sonnet-20241022',
      commands: [],
      permissions: [],
      commandInput: '',
      permissionInput: ''
    });
    
    setIsCreating(false);
  };

  return (
    <div className="custom-agent-builder">
      <h4>Build Your Own Agent</h4>
      
      <div className="builder-form">
        <div className="form-row">
          <label>
            Agent Name *
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My Custom Agent"
            />
          </label>
          
          <label>
            Model
            <select
              value={formData.model}
              onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
            >
              <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
              <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            </select>
          </label>
        </div>

        <label>
          Description
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this agent does..."
            rows={2}
          />
        </label>

        <div className="commands-section">
          <label>Commands</label>
          <div className="input-with-suggestions">
            <input
              type="text"
              value={formData.commandInput}
              onChange={(e) => setFormData(prev => ({ ...prev, commandInput: e.target.value }))}
              placeholder="Type command or select from suggestions..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddCommand(formData.commandInput);
                }
              }}
            />
            <div className="suggestions">
              {availableCommands.map(cmd => (
                <button
                  key={cmd}
                  type="button"
                  className={`suggestion-btn ${formData.commands.includes(cmd) ? 'selected' : ''}`}
                  onClick={() => handleAddCommand(cmd)}
                  disabled={formData.commands.includes(cmd)}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
          <div className="selected-items">
            {formData.commands.map(cmd => (
              <span key={cmd} className="selected-item">
                {cmd}
                <button onClick={() => removeCommand(cmd)}>×</button>
              </span>
            ))}
          </div>
        </div>

        <div className="permissions-section">
          <label>Permissions</label>
          <div className="input-with-suggestions">
            <input
              type="text"
              value={formData.permissionInput}
              onChange={(e) => setFormData(prev => ({ ...prev, permissionInput: e.target.value }))}
              placeholder="Type permission or select from suggestions..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddPermission(formData.permissionInput);
                }
              }}
            />
            <div className="suggestions">
              {availablePermissions.map(perm => (
                <button
                  key={perm}
                  type="button"
                  className={`suggestion-btn ${formData.permissions.includes(perm) ? 'selected' : ''}`}
                  onClick={() => handleAddPermission(perm)}
                  disabled={formData.permissions.includes(perm)}
                >
                  {perm}
                </button>
              ))}
            </div>
          </div>
          <div className="selected-items">
            {formData.permissions.map(perm => (
              <span key={perm} className="selected-item">
                {perm}
                <button onClick={() => removePermission(perm)}>×</button>
              </span>
            ))}
          </div>
        </div>

        <button 
          onClick={handleCreate} 
          className="create-agent-button"
          disabled={!formData.name.trim() || isCreating}
        >
          {isCreating ? 'Creating...' : '➕ Create Agent'}
        </button>
      </div>
    </div>
  );
};

interface AgentSelectorProps {
  onAgentsSelected: (agents: AgentTemplate[]) => void;
  onClose: () => void;
  selectedAgents?: AgentTemplate[];
}

interface AgentOption {
  id: string;
  name: string;
  model: string;
  type: 'prebuild' | 'checkpoint' | 'template' | 'workspace';
  description?: string;
  base_prompt?: string;
  commands?: string[];
  permissions?: string[];
  checkpoint_id?: string;
  usage_count?: number;
  success_rate?: number;
  workspace_id?: string;
  agent_id?: string;
  source?: string;
  created_at?: string;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({ 
  onAgentsSelected, 
  onClose, 
  selectedAgents = [] 
}) => {
  const [availableAgents, setAvailableAgents] = useState<AgentOption[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'prebuilt' | 'checkpoints' | 'workspace' | 'custom'>('prebuilt');

  useEffect(() => {
    loadAvailableAgents();
    // Pre-select currently selected agents
    const selectedIds = new Set(selectedAgents.map(agent => `custom_${agent.name}`));
    setSelectedAgentIds(selectedIds);
  }, [selectedAgents]);

  const loadAvailableAgents = async () => {
    try {
      setLoading(true);
      
      // Use the new unified agent API that gets all available agents
      const response = await fetch('/api/agents/available');
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          const agents: AgentOption[] = data.agents.map((agent: any) => ({
            id: agent.id,
            name: agent.name,
            model: agent.model,
            type: agent.type === 'prebuilt' ? 'prebuild' : agent.type,
            description: agent.description,
            base_prompt: agent.base_prompt,
            commands: agent.commands || [],
            permissions: agent.permissions || [],
            checkpoint_id: agent.checkpoint_id,
            usage_count: agent.usage_count || 0,
            success_rate: agent.success_rate || 0.9,
            workspace_id: agent.workspace_id,
            agent_id: agent.agent_id,
            source: agent.source,
            created_at: agent.created_at
          }));
          
          setAvailableAgents(agents);
        } else {
          console.error('Failed to get agents from API:', data.error);
        }
      } else {
        console.error('Agent API request failed:', response.status);
      }
      
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentToggle = (agentId: string) => {
    const newSelected = new Set(selectedAgentIds);
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId);
    } else {
      newSelected.add(agentId);
    }
    setSelectedAgentIds(newSelected);
  };

  const handleCustomAgentCreated = (customAgent: AgentOption) => {
    // Add the custom agent to available agents
    setAvailableAgents(prev => [...prev, customAgent]);
    
    // Auto-select the new custom agent
    setSelectedAgentIds(prev => new Set([...prev, customAgent.id]));
  };

  const handleSave = () => {
    const selectedAgentOptions = availableAgents.filter(agent => 
      selectedAgentIds.has(agent.id)
    );

    const agentTemplates: AgentTemplate[] = selectedAgentOptions.map(agent => ({
      name: agent.name,
      model: agent.model as 'claude' | 'gemini',
      commands: agent.commands || [],
      permissions: agent.permissions || [],
      auto_deploy: true,
      description: agent.description
    }));

    onAgentsSelected(agentTemplates);
    onClose();
  };

  const getFilteredAgents = () => {
    return availableAgents.filter(agent => {
      switch (activeTab) {
        case 'prebuilt':
          return agent.type === 'prebuild';
        case 'checkpoints':
          return agent.type === 'checkpoint';
        case 'workspace':
          return agent.type === 'workspace';
        case 'custom':
          return agent.type === 'template';
        default:
          return true;
      }
    });
  };

  if (loading) {
    return (
      <div className="agent-selector loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-selector">
      <div className="agent-selector-modal">
        <div className="selector-header">
        <h3>Select Agents for Template</h3>
        <button onClick={onClose} className="close-button">×</button>
      </div>

      <div className="selector-tabs">
        <button 
          className={`tab ${activeTab === 'prebuilt' ? 'active' : ''}`}
          onClick={() => setActiveTab('prebuilt')}
        >
          🤖 Pre-built Agents ({availableAgents.filter(a => a.type === 'prebuild').length})
        </button>
        <button 
          className={`tab ${activeTab === 'checkpoints' ? 'active' : ''}`}
          onClick={() => setActiveTab('checkpoints')}
        >
          💾 Expert Checkpoints ({availableAgents.filter(a => a.type === 'checkpoint').length})
        </button>
        <button 
          className={`tab ${activeTab === 'workspace' ? 'active' : ''}`}
          onClick={() => setActiveTab('workspace')}
        >
          🏢 Workspace Agents ({availableAgents.filter(a => a.type === 'workspace').length})
        </button>
        <button 
          className={`tab ${activeTab === 'custom' ? 'active' : ''}`}
          onClick={() => setActiveTab('custom')}
        >
          ⚙️ Custom
        </button>
      </div>

      <div className="selector-content">
        <div className="agents-grid">
          {getFilteredAgents().map(agent => (
            <div 
              key={agent.id}
              className={`agent-card ${selectedAgentIds.has(agent.id) ? 'selected' : ''}`}
              onClick={() => handleAgentToggle(agent.id)}
            >
              <div className="agent-header">
                <div className="agent-info">
                  <h4>{agent.name}</h4>
                  <span className="agent-model">{agent.model}</span>
                </div>
                <div className="agent-type">
                  {agent.type === 'prebuild' && '🤖'}
                  {agent.type === 'checkpoint' && '💾'}
                  {agent.type === 'workspace' && '🏢'}
                  {agent.type === 'template' && '⚙️'}
                </div>
              </div>

              <p className="agent-description">{agent.description}</p>

              <div className="agent-capabilities">
                {agent.commands && (
                  <div className="capability-section">
                    <h5>Commands</h5>
                    <div className="capability-tags">
                      {agent.commands.slice(0, 4).map(cmd => (
                        <span key={cmd} className="tag">{cmd}</span>
                      ))}
                      {agent.commands.length > 4 && (
                        <span className="tag more">+{agent.commands.length - 4}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {agent.usage_count && (
                <div className="agent-stats">
                  <span>Used {agent.usage_count} times</span>
                  <span>✅ {Math.round(agent.success_rate! * 100)}% success</span>
                </div>
              )}

              <div className="selection-indicator">
                {selectedAgentIds.has(agent.id) && <span className="checkmark">✓</span>}
              </div>
            </div>
          ))}
        </div>

        {activeTab === 'custom' && (
          <div className="custom-agent-section">
            <CustomAgentBuilder onAgentCreated={handleCustomAgentCreated} />
          </div>
        )}
      </div>

      <div className="selector-footer">
        <div className="selected-count">
          {selectedAgentIds.size} agent{selectedAgentIds.size !== 1 ? 's' : ''} selected
        </div>
        <div className="footer-actions">
          <button onClick={onClose} className="cancel-button">Cancel</button>
          <button onClick={handleSave} className="save-button">
            Add Selected Agents
          </button>
        </div>
      </div>
      </div>

      <style>{`
        .agent-selector {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          padding: 20px;
        }

        .agent-selector-modal {
          background: white;
          border-radius: 12px;
          max-width: 1000px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          width: 100%;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .selector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .selector-header h3 {
          margin: 0;
          color: #111827;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
        }

        .selector-tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          background: white;
        }

        .tab {
          flex: 1;
          padding: 12px 16px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: #6b7280;
          border-bottom: 2px solid transparent;
        }

        .tab:hover {
          color: #374151;
          background: #f9fafb;
        }

        .tab.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
          background: #f8fafc;
        }

        .selector-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .agents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .agent-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .agent-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
        }

        .agent-card.selected {
          border-color: #3b82f6;
          background: #f8fafc;
          box-shadow: 0 0 0 1px #3b82f6;
        }

        .agent-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .agent-info h4 {
          margin: 0 0 4px 0;
          color: #111827;
          font-size: 16px;
        }

        .agent-model {
          font-size: 12px;
          color: #6b7280;
        }

        .agent-type {
          font-size: 20px;
        }

        .agent-description {
          color: #6b7280;
          font-size: 14px;
          margin-bottom: 12px;
          line-height: 1.4;
        }

        .agent-capabilities {
          margin-bottom: 12px;
        }

        .capability-section h5 {
          margin: 0 0 6px 0;
          font-size: 12px;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .capability-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .tag {
          background: #e5e7eb;
          color: #374151;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
        }

        .tag.more {
          background: #3b82f6;
          color: white;
        }

        .agent-stats {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .selection-indicator {
          position: absolute;
          top: 12px;
          right: 12px;
        }

        .checkmark {
          background: #10b981;
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }

        .custom-agent-section {
          text-align: center;
          padding: 40px 20px;
        }

        .create-custom-button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          margin-bottom: 12px;
        }

        .custom-note {
          color: #6b7280;
          font-size: 14px;
        }

        .selector-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .selected-count {
          font-size: 14px;
          color: #374151;
        }

        .footer-actions {
          display: flex;
          gap: 12px;
        }

        .cancel-button {
          background: #6b7280;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .save-button {
          background: #10b981;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-content {
          text-align: center;
          background: white;
          padding: 40px;
          border-radius: 8px;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #f3f4f6;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Custom Agent Builder */
        .custom-agent-builder {
          background: white;
          border-radius: 8px;
          padding: 24px;
        }

        .custom-agent-builder h4 {
          margin: 0 0 20px 0;
          color: #111827;
          font-size: 16px;
        }

        .builder-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-with-suggestions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .suggestion-btn {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .suggestion-btn:hover {
          background: #e5e7eb;
          border-color: #9ca3af;
        }

        .suggestion-btn.selected {
          background: #10b981;
          color: white;
          border-color: #10b981;
          cursor: not-allowed;
        }

        .suggestion-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .selected-items {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 8px;
          min-height: 24px;
        }

        .selected-item {
          background: #ddd6fe;
          color: #7c3aed;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .selected-item button {
          background: none;
          border: none;
          color: #7c3aed;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          line-height: 1;
        }

        .selected-item button:hover {
          color: #5b21b6;
        }

        .commands-section, .permissions-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .commands-section label, .permissions-section label {
          font-weight: 600;
          color: #374151;
          font-size: 14px;
          margin-bottom: 0;
        }

        .create-agent-button {
          background: #10b981;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          margin-top: 8px;
          transition: background 0.2s;
        }

        .create-agent-button:hover:not(:disabled) {
          background: #059669;
        }

        .create-agent-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};