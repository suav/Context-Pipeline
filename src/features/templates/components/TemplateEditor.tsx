import React, { useState, useEffect } from 'react';
import { WorkspaceTemplate, TemplateVariable, ContextRequirement, AgentTemplate } from '../types';
import { clientLogger } from '../services/ClientLogger';
import { AgentSelector } from './AgentSelector';
import { LibraryItemSelector } from './LibraryItemSelector';

interface TemplateEditorProps {
  template?: WorkspaceTemplate | null;
  onSave: (template: Partial<WorkspaceTemplate>) => void;
  onCancel: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSave, onCancel }) => {
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showLibrarySelector, setShowLibrarySelector] = useState(false);
  const [editingReqIndex, setEditingReqIndex] = useState<number>(-1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'development',
    context_requirements: [] as ContextRequirement[],
    variables: [] as TemplateVariable[],
    agent_templates: [] as AgentTemplate[],
    workspace_config: {
      naming_pattern: '{{name}} - {{date}}',
      auto_archive_days: 30,
      allow_concurrent_sessions: true
    }
  });

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description,
        category: template.category,
        context_requirements: [...template.context_requirements],
        variables: [...template.variables],
        agent_templates: [...template.agent_templates],
        workspace_config: { ...template.workspace_config }
      });
    }
  }, [template]);

  const addContextRequirement = () => {
    const newReq: ContextRequirement = {
      id: `req_${Date.now()}`,
      type: 'wildcard',
      wildcard_type: 'generic_ticket',
      display_name: 'New Requirement',
      description: '',
      required: true,
      context_filters: {}
    };
    setFormData(prev => ({
      ...prev,
      context_requirements: [...prev.context_requirements, newReq]
    }));
  };

  const updateContextRequirement = (index: number, updates: Partial<ContextRequirement>) => {
    setFormData(prev => ({
      ...prev,
      context_requirements: prev.context_requirements.map((req, i) => 
        i === index ? { ...req, ...updates } : req
      )
    }));
  };

  const removeContextRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      context_requirements: prev.context_requirements.filter((_, i) => i !== index)
    }));
  };

  const addVariable = () => {
    const newVar: TemplateVariable = {
      name: 'new_variable',
      description: '',
      type: 'string',
      required: false,
      default_value: ''
    };
    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, newVar]
    }));
  };

  const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.map((variable, i) => 
        i === index ? { ...variable, ...updates } : variable
      )
    }));
  };

  const removeVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }));
  };

  const addAgentTemplate = () => {
    setShowAgentSelector(true);
  };

  const handleAgentsSelected = (agents: AgentTemplate[]) => {
    setFormData(prev => ({
      ...prev,
      agent_templates: [...prev.agent_templates, ...agents]
    }));
    setShowAgentSelector(false);
  };

  const updateAgentTemplate = (index: number, updates: Partial<AgentTemplate>) => {
    setFormData(prev => ({
      ...prev,
      agent_templates: prev.agent_templates.map((agent, i) => 
        i === index ? { ...agent, ...updates } : agent
      )
    }));
  };

  const removeAgentTemplate = (index: number) => {
    setFormData(prev => ({
      ...prev,
      agent_templates: prev.agent_templates.filter((_, i) => i !== index)
    }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Template name is required');
      return;
    }

    const templateData = {
      ...formData,
      id: template?.id,
    };

    onSave(templateData);
  };

  return (
    <div className="template-editor">
      <div className="editor-header">
        <h3>{template ? `Edit ${template.name}` : 'Create New Template'}</h3>
        <div className="editor-actions">
          <button onClick={handleSave} className="save-button">
            💾 Save Template
          </button>
          <button onClick={onCancel} className="cancel-button">
            Cancel
          </button>
        </div>
      </div>

      <div className="editor-form">
        {/* Basic Information */}
        <div className="form-section">
          <h4>Basic Information</h4>
          <div className="form-row">
            <label>
              Template Name
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Custom Template"
              />
            </label>
            <label>
              Category
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="development">Development</option>
                <option value="documentation">Documentation</option>
                <option value="testing">Testing</option>
                <option value="deployment">Deployment</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this template is used for..."
              rows={3}
            />
          </label>
        </div>

        {/* Context Requirements */}
        <div className="form-section">
          <div className="section-header">
            <h4>Context Requirements</h4>
            <button onClick={addContextRequirement} className="add-button">
              ➕ Add Requirement
            </button>
          </div>
          <div className="requirements-list">
            {formData.context_requirements.map((req, index) => (
              <div key={req.id} className="context-requirement-editor">
                <div className="req-header">
                  <input
                    type="text"
                    value={req.display_name}
                    onChange={(e) => updateContextRequirement(index, { display_name: e.target.value })}
                    placeholder="Requirement name"
                    className="req-name-input"
                  />
                  <button 
                    onClick={() => removeContextRequirement(index)}
                    className="remove-button"
                  >
                    ❌
                  </button>
                </div>
                
                <div className="req-config">
                  <label>
                    Type
                    <select
                      value={req.type}
                      onChange={(e) => {
                        const type = e.target.value as 'explicit' | 'wildcard';
                        const updates: Partial<ContextRequirement> = { type };
                        
                        // Reset fields based on type
                        if (type === 'wildcard') {
                          updates.wildcard_type = 'generic_ticket';
                          updates.context_item_id = undefined;
                        } else {
                          updates.wildcard_type = undefined;
                          updates.context_item_id = '';
                        }
                        
                        updateContextRequirement(index, updates);
                      }}
                    >
                      <option value="wildcard">Wildcard (Auto-detect)</option>
                      <option value="explicit">Explicit Item</option>
                    </select>
                  </label>

                  {req.type === 'wildcard' && (
                    <label>
                      Wildcard Type
                      <select
                        value={req.wildcard_type || 'generic_ticket'}
                        onChange={(e) => updateContextRequirement(index, { wildcard_type: e.target.value })}
                      >
                        <option value="generic_ticket">Generic Ticket (JIRA, GitHub Issue, etc.)</option>
                        <option value="generic_repository">Generic Repository (Git repo)</option>
                        <option value="generic_document">Generic Document (Any doc/file)</option>
                      </select>
                    </label>
                  )}

                  {req.type === 'explicit' && (
                    <div>
                      <label>
                        Context Item ID
                        <div className="explicit-item-config">
                          <input
                            type="text"
                            value={req.context_item_id || ''}
                            onChange={(e) => updateContextRequirement(index, { context_item_id: e.target.value })}
                            placeholder="e.g., lib_coding_standards_001"
                            readOnly
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReqIndex(index);
                              setShowLibrarySelector(true);
                            }}
                            className="browse-library-button"
                          >
                            📚 Browse Library
                          </button>
                        </div>
                        <span className="field-note">The exact ID of a library item to always include</span>
                      </label>
                    </div>
                  )}

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={req.required}
                      onChange={(e) => updateContextRequirement(index, { required: e.target.checked })}
                    />
                    Required
                  </label>
                </div>

                <label>
                  Description
                  <textarea
                    value={req.description}
                    onChange={(e) => updateContextRequirement(index, { description: e.target.value })}
                    placeholder="Describe this requirement..."
                    rows={2}
                  />
                </label>

                {req.type === 'wildcard' && (
                  <div className="context-filters">
                    <h5>Context Filters (Optional)</h5>
                    <div className="filter-grid">
                      <label>
                        Source Filter
                        <input
                          type="text"
                          value={req.context_filters?.source || ''}
                          onChange={(e) => updateContextRequirement(index, {
                            context_filters: { ...req.context_filters, source: e.target.value }
                          })}
                          placeholder="e.g., jira, git"
                        />
                      </label>
                      <label>
                        Tag Filter
                        <input
                          type="text"
                          value={req.context_filters?.tags?.join(', ') || ''}
                          onChange={(e) => updateContextRequirement(index, {
                            context_filters: { 
                              ...req.context_filters, 
                              tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) 
                            }
                          })}
                          placeholder="tag1, tag2"
                        />
                      </label>
                      <label>
                        Priority Filter
                        <input
                          type="text"
                          value={req.context_filters?.priority || ''}
                          onChange={(e) => updateContextRequirement(index, {
                            context_filters: { ...req.context_filters, priority: e.target.value }
                          })}
                          placeholder="high, medium, low"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {formData.context_requirements.length === 0 && (
              <div className="empty-state">
                <p>No context requirements yet. Add requirements to define what library items this template needs.</p>
              </div>
            )}
          </div>
        </div>

        {/* Template Variables */}
        <div className="form-section">
          <div className="section-header">
            <h4>Template Variables</h4>
            <button onClick={addVariable} className="add-button">
              ➕ Add Variable
            </button>
          </div>
          <div className="variables-list">
            {formData.variables.map((variable, index) => (
              <div key={index} className="variable-editor">
                <div className="var-header">
                  <input
                    type="text"
                    value={variable.name}
                    onChange={(e) => updateVariable(index, { name: e.target.value })}
                    placeholder="variable_name"
                    className="var-name-input"
                  />
                  <select
                    value={variable.type}
                    onChange={(e) => updateVariable(index, { type: e.target.value as any })}
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="select">Select</option>
                  </select>
                  <button 
                    onClick={() => removeVariable(index)}
                    className="remove-button"
                  >
                    ❌
                  </button>
                </div>
                
                <input
                  type="text"
                  value={variable.description}
                  onChange={(e) => updateVariable(index, { description: e.target.value })}
                  placeholder="Variable description..."
                />
                
                <div className="var-config">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={variable.required}
                      onChange={(e) => updateVariable(index, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  
                  <input
                    type="text"
                    value={String(variable.default_value || '')}
                    onChange={(e) => updateVariable(index, { default_value: e.target.value })}
                    placeholder="Default value..."
                  />

                  {variable.type === 'select' && (
                    <input
                      type="text"
                      value={variable.options?.join(', ') || ''}
                      onChange={(e) => updateVariable(index, {
                        options: e.target.value.split(',').map(o => o.trim()).filter(o => o)
                      })}
                      placeholder="option1, option2, option3"
                      className="options-input"
                    />
                  )}
                </div>
              </div>
            ))}

            {formData.variables.length === 0 && (
              <div className="empty-state">
                <p>No variables yet. Add variables to make your template customizable.</p>
              </div>
            )}
          </div>
        </div>

        {/* Agent Templates */}
        <div className="form-section">
          <div className="section-header">
            <h4>Agent Templates</h4>
            <button onClick={addAgentTemplate} className="add-button">
              ➕ Add Agent
            </button>
          </div>
          <div className="agents-list">
            {formData.agent_templates.map((agent, index) => (
              <div key={index} className="agent-editor">
                <div className="agent-header">
                  <input
                    type="text"
                    value={agent.name}
                    onChange={(e) => updateAgentTemplate(index, { name: e.target.value })}
                    placeholder="Agent name"
                    className="agent-name-input"
                  />
                  <select
                    value={agent.model}
                    onChange={(e) => updateAgentTemplate(index, { model: e.target.value })}
                  >
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </select>
                  <button 
                    onClick={() => removeAgentTemplate(index)}
                    className="remove-button"
                  >
                    ❌
                  </button>
                </div>
                
                <textarea
                  value={agent.base_prompt}
                  onChange={(e) => updateAgentTemplate(index, { base_prompt: e.target.value })}
                  placeholder="Base prompt for this agent. Use {{variable_name}} to reference template variables..."
                  rows={4}
                />

                <div className="agent-config">
                  <label>
                    Commands (comma-separated)
                    <input
                      type="text"
                      value={agent.commands.join(', ')}
                      onChange={(e) => updateAgentTemplate(index, {
                        commands: e.target.value.split(',').map(c => c.trim()).filter(c => c)
                      })}
                      placeholder="build, test, deploy"
                    />
                  </label>
                  <label>
                    Permissions (comma-separated)
                    <input
                      type="text"
                      value={agent.permissions.join(', ')}
                      onChange={(e) => updateAgentTemplate(index, {
                        permissions: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                      })}
                      placeholder="read_files, write_files, run_commands"
                    />
                  </label>
                </div>
              </div>
            ))}

            {formData.agent_templates.length === 0 && (
              <div className="empty-state">
                <p>No agents yet. Add agents that will be deployed to workspaces created from this template.</p>
              </div>
            )}
          </div>
        </div>

        {/* Workspace Configuration */}
        <div className="form-section">
          <h4>Workspace Configuration</h4>
          <div className="form-row">
            <label>
              Naming Pattern
              <input
                type="text"
                value={formData.workspace_config.naming_pattern}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  workspace_config: { ...prev.workspace_config, naming_pattern: e.target.value }
                }))}
                placeholder="&#123;&#123;name&#125;&#125; - &#123;&#123;date&#125;&#125;"
              />
              <span className="field-note">Use variables like {`{{name}}`}, {`{{date}}`}, {`{{ticket_id}}`}</span>
            </label>
            <label>
              Auto-archive Days
              <input
                type="number"
                value={formData.workspace_config.auto_archive_days}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  workspace_config: { ...prev.workspace_config, auto_archive_days: parseInt(e.target.value) || 30 }
                }))}
              />
            </label>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.workspace_config.allow_concurrent_sessions}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                workspace_config: { ...prev.workspace_config, allow_concurrent_sessions: e.target.checked }
              }))}
            />
            Allow concurrent agent sessions
          </label>
        </div>
      </div>

      {/* Agent Selector Modal */}
      {showAgentSelector && (
        <AgentSelector
          onAgentsSelected={handleAgentsSelected}
          onClose={() => setShowAgentSelector(false)}
          selectedAgents={formData.agent_templates}
        />
      )}

      {/* Library Item Selector Modal */}
      {showLibrarySelector && (
        <LibraryItemSelector
          onItemSelected={(itemId) => {
            if (editingReqIndex >= 0) {
              updateContextRequirement(editingReqIndex, { context_item_id: itemId });
              setEditingReqIndex(-1);
              setShowLibrarySelector(false);
            }
          }}
          onClose={() => {
            setShowLibrarySelector(false);
            setEditingReqIndex(-1);
          }}
        />
      )}

      <style>{`
        .template-editor {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .editor-header h3 {
          margin: 0;
          color: #111827;
          font-size: 20px;
        }

        .editor-actions {
          display: flex;
          gap: 12px;
        }

        .save-button {
          background: #10b981;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .save-button:hover {
          background: #059669;
        }

        .cancel-button {
          background: #6b7280;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .cancel-button:hover {
          background: #4b5563;
        }

        .editor-form {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }

        .form-section {
          margin-bottom: 32px;
          padding: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: white;
        }

        .form-section h4 {
          margin: 0 0 16px 0;
          color: #111827;
          font-size: 16px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .section-header h4 {
          margin: 0;
        }

        .add-button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .add-button:hover {
          background: #2563eb;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        label {
          display: flex;
          flex-direction: column;
          margin-bottom: 16px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        input, select, textarea {
          margin-top: 4px;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
        }

        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 1px #3b82f6;
        }

        textarea {
          resize: vertical;
          min-height: 60px;
        }

        .field-note {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }

        .checkbox-label {
          flex-direction: row !important;
          align-items: center;
          gap: 8px;
          margin: 8px 0;
        }

        .checkbox-label input {
          margin: 0;
          width: auto;
        }

        /* Context Requirements */
        .requirements-list, .variables-list, .agents-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .context-requirement-editor, .variable-editor, .agent-editor {
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 16px;
          background: #f9fafb;
        }

        .req-header, .var-header, .agent-header {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 12px;
        }

        .req-name-input, .var-name-input, .agent-name-input {
          flex: 1;
          margin: 0;
        }

        .req-config, .var-config, .agent-config {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin: 12px 0;
        }

        .context-filters {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }

        .context-filters h5 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #6b7280;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }

        .filter-grid label {
          margin-bottom: 0;
        }

        .remove-button {
          background: #ef4444;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .remove-button:hover {
          background: #dc2626;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #6b7280;
          font-style: italic;
        }

        .options-input {
          grid-column: span 2;
        }

        .explicit-item-config {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }

        .explicit-item-config input {
          flex: 1;
          margin: 0;
        }

        .browse-library-button {
          background: #8b5cf6;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }

        .browse-library-button:hover {
          background: #7c3aed;
        }
      `}</style>
    </div>
  );
};