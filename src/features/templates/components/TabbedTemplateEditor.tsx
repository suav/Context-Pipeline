import React, { useState, useEffect } from 'react';
import { WorkspaceTemplate, TemplateVariable, ContextRequirement, AgentTemplate, TemplateTrigger } from '../types';
import { AgentSelector } from './AgentSelector';
import { LibraryItemSelector } from './LibraryItemSelector';

interface PrebuiltTriggerTemplatesProps {
  onTemplateSelected: (template: any) => void;
}

const PrebuiltTriggerTemplates: React.FC<PrebuiltTriggerTemplatesProps> = ({ onTemplateSelected }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    loadTriggerSources();
  }, []);

  const loadTriggerSources = async () => {
    try {
      const response = await fetch('/api/triggers/sources');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSummary(data.summary);
          setTemplates(data.sources?.prebuilt_templates || []);
        }
      }
    } catch (error) {
      console.error('Failed to load trigger sources:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="prebuilt-templates-loading">
        <div className="loading-spinner"></div>
        <p>Loading trigger templates...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="no-prebuilt-templates">
        <div className="no-templates-icon">🎯</div>
        <h4>No Trigger Templates Available</h4>
        <p>Set up JIRA credentials or Git repositories to see pre-built trigger templates.</p>
        <small>Configure credentials in the settings to unlock automated workspace triggers.</small>
      </div>
    );
  }

  return (
    <div className="prebuilt-trigger-templates">
      <div className="section-header">
        <h4>🚀 Quick Start Templates</h4>
        <div className="templates-summary">
          <span>{templates.length} templates available</span>
          {summary && (
            <span>• {summary.jira_instances} JIRA • {summary.git_repositories} Git</span>
          )}
        </div>
      </div>
      
      <div className="templates-grid">
        {templates.map((template) => (
          <div key={template.id} className="template-card">
            <div className="template-icon">{template.icon}</div>
            <div className="template-info">
              <h5>{template.name}</h5>
              <p>{template.description}</p>
              <div className="template-meta">
                <span className="template-type">{template.type.replace('_', ' ')}</span>
                <span className="compatible-sources">{template.compatible_sources} sources</span>
              </div>
            </div>
            <button
              onClick={() => onTemplateSelected(template)}
              className="use-template-button"
            >
              ➕ Use Template
            </button>
          </div>
        ))}
      </div>
      
      <div className="templates-note">
        <small>💡 These templates are automatically configured based on your JIRA and Git credentials.</small>
      </div>
    </div>
  );
};

interface TabbedTemplateEditorProps {
  template?: WorkspaceTemplate | null;
  onSave: (template: Partial<WorkspaceTemplate>) => void;
  onCancel: () => void;
}

type TabType = 'basic' | 'context' | 'agents' | 'variables' | 'triggers' | 'config';

export const TabbedTemplateEditor: React.FC<TabbedTemplateEditorProps> = ({ template, onSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showLibrarySelector, setShowLibrarySelector] = useState(false);
  const [editingReqIndex, setEditingReqIndex] = useState<number>(-1);
  const [editingTriggerIndex, setEditingTriggerIndex] = useState<number>(-1);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'development',
    context_requirements: [] as ContextRequirement[],
    variables: [] as TemplateVariable[],
    agent_templates: [] as AgentTemplate[],
    triggers: [] as TemplateTrigger[],
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
        triggers: [...(template.triggers || [])],
        workspace_config: { 
          ...template.workspace_config,
          auto_archive_days: template.workspace_config.auto_archive_days || 30,
          allow_concurrent_sessions: template.workspace_config.allow_concurrent_sessions ?? true
        }
      });
    }
  }, [template]);

  // Context Requirements functions
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

  // Variables functions
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

  // Agent functions
  const handleAgentsSelected = (agents: AgentTemplate[]) => {
    setFormData(prev => ({
      ...prev,
      agent_templates: [...prev.agent_templates, ...agents]
    }));
    setShowAgentSelector(false);
  };

  const removeAgentTemplate = (index: number) => {
    setFormData(prev => ({
      ...prev,
      agent_templates: prev.agent_templates.filter((_, i) => i !== index)
    }));
  };

  // Trigger functions
  const addTrigger = () => {
    const newTrigger: TemplateTrigger = {
      id: `trig_${Date.now()}`,
      name: 'New Trigger',
      description: '',
      enabled: true,
      trigger_type: 'jira_status',
      trigger_config: {
        polling_interval_ms: 300000 // 5 minutes
      },
      variable_overrides: {},
      conditions: [],
      actions: [{
        id: `act_${Date.now()}`,
        type: 'create_workspace',
        config: {
          auto_deploy: true,
          context_refresh: true
        }
      }]
    };
    setFormData(prev => ({
      ...prev,
      triggers: [...prev.triggers, newTrigger]
    }));
  };

  const updateTrigger = (index: number, updates: Partial<TemplateTrigger>) => {
    setFormData(prev => ({
      ...prev,
      triggers: prev.triggers.map((trigger, i) => 
        i === index ? { ...trigger, ...updates } : trigger
      )
    }));
  };

  const removeTrigger = (index: number) => {
    setFormData(prev => ({
      ...prev,
      triggers: prev.triggers.filter((_, i) => i !== index)
    }));
  };

  const addTriggerCondition = (triggerIndex: number) => {
    const condition = {
      id: `cond_${Date.now()}`,
      type: 'status_change' as const,
      config: {}
    };
    
    const triggers = [...formData.triggers];
    triggers[triggerIndex] = {
      ...triggers[triggerIndex],
      conditions: [...triggers[triggerIndex].conditions, condition]
    };
    
    setFormData(prev => ({ ...prev, triggers }));
  };

  const updateTriggerCondition = (triggerIndex: number, conditionIndex: number, updates: any) => {
    const triggers = [...formData.triggers];
    triggers[triggerIndex] = {
      ...triggers[triggerIndex],
      conditions: triggers[triggerIndex].conditions.map((cond, i) =>
        i === conditionIndex ? { ...cond, ...updates } : cond
      )
    };
    
    setFormData(prev => ({ ...prev, triggers }));
  };

  const removeTriggerCondition = (triggerIndex: number, conditionIndex: number) => {
    const triggers = [...formData.triggers];
    triggers[triggerIndex] = {
      ...triggers[triggerIndex],
      conditions: triggers[triggerIndex].conditions.filter((_, i) => i !== conditionIndex)
    };
    
    setFormData(prev => ({ ...prev, triggers }));
  };

  const handlePrebuiltTriggerSelected = (templateTrigger: any) => {
    const newTrigger: TemplateTrigger = {
      id: `trig_${Date.now()}`,
      name: templateTrigger.name,
      description: templateTrigger.description,
      enabled: true,
      trigger_type: templateTrigger.type,
      trigger_config: templateTrigger.trigger_config,
      variable_overrides: {},
      conditions: templateTrigger.conditions,
      actions: templateTrigger.actions
    };
    
    setFormData(prev => ({
      ...prev,
      triggers: [...prev.triggers, newTrigger]
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

  const tabs = [
    { id: 'basic' as TabType, name: 'Basic Info', icon: '📝' },
    { id: 'context' as TabType, name: 'Context', icon: '🔗' },
    { id: 'agents' as TabType, name: 'Agents', icon: '🤖' },
    { id: 'variables' as TabType, name: 'Variables', icon: '⚙️' },
    { id: 'triggers' as TabType, name: 'Triggers', icon: '🎯' },
    { id: 'config' as TabType, name: 'Config', icon: '🔧' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return (
          <div className="tab-content">
            <div className="form-group">
              <label>
                Template Name <span className="required">*</span>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Custom Template"
                  required
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
                rows={4}
              />
            </label>
          </div>
        );

      case 'context':
        return (
          <div className="tab-content">
            <div className="section-header">
              <h4>Context Requirements</h4>
              <button onClick={addContextRequirement} className="add-button">
                ➕ Add Requirement
              </button>
            </div>
            
            <div className="requirements-list">
              {formData.context_requirements.map((req, index) => (
                <div key={req.id} className="requirement-card">
                  <div className="card-header">
                    <input
                      type="text"
                      value={req.display_name}
                      onChange={(e) => updateContextRequirement(index, { display_name: e.target.value })}
                      placeholder="Requirement name"
                      className="name-input"
                    />
                    <button 
                      onClick={() => removeContextRequirement(index)}
                      className="remove-button"
                    >
                      ❌
                    </button>
                  </div>
                  
                  <div className="form-row">
                    <label>
                      Type
                      <select
                        value={req.type}
                        onChange={(e) => {
                          const type = e.target.value as 'explicit' | 'wildcard';
                          const updates: Partial<ContextRequirement> = { type };
                          
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

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={req.required}
                        onChange={(e) => updateContextRequirement(index, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>

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
                        <div className="input-with-button">
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
                            className="browse-button"
                          >
                            📚 Browse
                          </button>
                        </div>
                      </label>
                    </div>
                  )}

                  <label>
                    Description
                    <textarea
                      value={req.description}
                      onChange={(e) => updateContextRequirement(index, { description: e.target.value })}
                      placeholder="Describe this requirement..."
                      rows={2}
                    />
                  </label>
                </div>
              ))}

              {formData.context_requirements.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">🔗</div>
                  <p>No context requirements yet</p>
                  <span>Add requirements to define what this template needs</span>
                </div>
              )}
            </div>
          </div>
        );

      case 'agents':
        return (
          <div className="tab-content">
            <div className="section-header">
              <h4>Agent Templates</h4>
              <button onClick={() => setShowAgentSelector(true)} className="add-button">
                ➕ Add Agent
              </button>
            </div>
            
            <div className="agents-list">
              {formData.agent_templates.map((agent, index) => (
                <div key={index} className="agent-card">
                  <div className="card-header">
                    <div className="agent-info">
                      <h5>{agent.name}</h5>
                      <span className="model-badge">{agent.model}</span>
                    </div>
                    <button 
                      onClick={() => removeAgentTemplate(index)}
                      className="remove-button"
                    >
                      ❌
                    </button>
                  </div>
                  
                  <div className="agent-details">
                    <div className="commands-section">
                      <label>Commands:</label>
                      <div className="tags">
                        {agent.commands.slice(0, 4).map(cmd => (
                          <span key={cmd} className="tag">{cmd}</span>
                        ))}
                        {agent.commands.length > 4 && (
                          <span className="tag more">+{agent.commands.length - 4}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="permissions-section">
                      <label>Permissions:</label>
                      <div className="tags">
                        {agent.permissions.slice(0, 3).map(perm => (
                          <span key={perm} className="tag permission">{perm}</span>
                        ))}
                        {agent.permissions.length > 3 && (
                          <span className="tag more">+{agent.permissions.length - 3}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {formData.agent_templates.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">🤖</div>
                  <p>No agents configured yet</p>
                  <span>Add agents that will be deployed to workspaces</span>
                </div>
              )}
            </div>
          </div>
        );

      case 'variables':
        return (
          <div className="tab-content">
            <div className="section-header">
              <h4>Template Variables</h4>
              <button onClick={addVariable} className="add-button">
                ➕ Add Variable
              </button>
            </div>
            
            <div className="variables-list">
              {formData.variables.map((variable, index) => (
                <div key={index} className="variable-card">
                  <div className="card-header">
                    <div className="variable-info">
                      <input
                        type="text"
                        value={variable.name}
                        onChange={(e) => updateVariable(index, { name: e.target.value })}
                        placeholder="variable_name"
                        className="name-input"
                      />
                      <select
                        value={variable.type}
                        onChange={(e) => updateVariable(index, { type: e.target.value as any })}
                        className="type-select"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="select">Select</option>
                      </select>
                    </div>
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
                    className="description-input"
                  />
                  
                  <div className="form-row">
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
                      className="default-input"
                    />
                  </div>

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
              ))}

              {formData.variables.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">⚙️</div>
                  <p>No variables defined yet</p>
                  <span>Add variables to make templates customizable</span>
                </div>
              )}
            </div>
          </div>
        );

      case 'triggers':
        return (
          <div className="tab-content">
            <PrebuiltTriggerTemplates onTemplateSelected={handlePrebuiltTriggerSelected} />
            
            <div className="section-header">
              <h4>Custom Triggers</h4>
              <button onClick={addTrigger} className="add-button">
                ➕ Add Custom Trigger
              </button>
            </div>
            
            <div className="triggers-list">
              {formData.triggers.map((trigger, triggerIndex) => (
                <div key={trigger.id} className="trigger-card">
                  <div className="card-header">
                    <div className="trigger-info">
                      <input
                        type="text"
                        value={trigger.name}
                        onChange={(e) => updateTrigger(triggerIndex, { name: e.target.value })}
                        placeholder="Trigger name"
                        className="name-input"
                      />
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={trigger.enabled}
                          onChange={(e) => updateTrigger(triggerIndex, { enabled: e.target.checked })}
                        />
                        Enabled
                      </label>
                    </div>
                    <button 
                      onClick={() => removeTrigger(triggerIndex)}
                      className="remove-button"
                    >
                      ❌
                    </button>
                  </div>

                  <textarea
                    value={trigger.description}
                    onChange={(e) => updateTrigger(triggerIndex, { description: e.target.value })}
                    placeholder="Describe what this trigger does..."
                    className="description-input"
                    rows={2}
                  />

                  <div className="form-row">
                    <label>
                      Trigger Type
                      <select
                        value={trigger.trigger_type}
                        onChange={(e) => updateTrigger(triggerIndex, { trigger_type: e.target.value as any })}
                      >
                        <option value="jira_status">JIRA Status Change</option>
                        <option value="git_push">Git Push</option>
                        <option value="email_received">Email Received</option>
                        <option value="schedule">Scheduled</option>
                      </select>
                    </label>

                    <label>
                      Context Item
                      <div className="input-with-button">
                        <input
                          type="text"
                          value={trigger.context_item_id || ''}
                          onChange={(e) => updateTrigger(triggerIndex, { context_item_id: e.target.value })}
                          placeholder="Select context item to monitor..."
                          readOnly
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTriggerIndex(triggerIndex);
                            setEditingReqIndex(-1); // This is for context requirements, not triggers
                            setShowLibrarySelector(true);
                          }}
                          className="browse-button"
                        >
                          📚 Browse
                        </button>
                      </div>
                    </label>
                  </div>

                  {/* Trigger Configuration */}
                  <div className="trigger-config-section">
                    <h6>Configuration</h6>
                    {trigger.trigger_type === 'jira_status' && (
                      <div className="form-row">
                        <label>
                          JIRA Project
                          <input
                            type="text"
                            value={trigger.trigger_config.jira_project || ''}
                            onChange={(e) => updateTrigger(triggerIndex, {
                              trigger_config: { ...trigger.trigger_config, jira_project: e.target.value }
                            })}
                            placeholder="PROJECT-KEY"
                          />
                        </label>
                        <label>
                          Status Transition
                          <input
                            type="text"
                            value={trigger.trigger_config.status_transition || ''}
                            onChange={(e) => updateTrigger(triggerIndex, {
                              trigger_config: { ...trigger.trigger_config, status_transition: e.target.value }
                            })}
                            placeholder="To Do → In Progress"
                          />
                        </label>
                      </div>
                    )}

                    {trigger.trigger_type === 'git_push' && (
                      <div className="form-row">
                        <label>
                          Repository
                          <input
                            type="text"
                            value={trigger.trigger_config.repository || ''}
                            onChange={(e) => updateTrigger(triggerIndex, {
                              trigger_config: { ...trigger.trigger_config, repository: e.target.value }
                            })}
                            placeholder="owner/repo-name"
                          />
                        </label>
                        <label>
                          Branch Pattern
                          <input
                            type="text"
                            value={trigger.trigger_config.branch_pattern || ''}
                            onChange={(e) => updateTrigger(triggerIndex, {
                              trigger_config: { ...trigger.trigger_config, branch_pattern: e.target.value }
                            })}
                            placeholder="feature/* or main"
                          />
                        </label>
                      </div>
                    )}

                    {trigger.trigger_type === 'email_received' && (
                      <div className="form-row">
                        <label>
                          Sender Pattern
                          <input
                            type="text"
                            value={trigger.trigger_config.sender_pattern || ''}
                            onChange={(e) => updateTrigger(triggerIndex, {
                              trigger_config: { ...trigger.trigger_config, sender_pattern: e.target.value }
                            })}
                            placeholder="@company.com"
                          />
                        </label>
                        <label>
                          Subject Pattern
                          <input
                            type="text"
                            value={trigger.trigger_config.subject_pattern || ''}
                            onChange={(e) => updateTrigger(triggerIndex, {
                              trigger_config: { ...trigger.trigger_config, subject_pattern: e.target.value }
                            })}
                            placeholder="URGENT:"
                          />
                        </label>
                      </div>
                    )}

                    {trigger.trigger_type === 'schedule' && (
                      <label>
                        Cron Expression
                        <input
                          type="text"
                          value={trigger.trigger_config.cron_expression || ''}
                          onChange={(e) => updateTrigger(triggerIndex, {
                            trigger_config: { ...trigger.trigger_config, cron_expression: e.target.value }
                          })}
                          placeholder="0 9 * * MON (Every Monday at 9 AM)"
                        />
                        <span className="field-note">Use standard cron format</span>
                      </label>
                    )}

                    <label>
                      Polling Interval (ms)
                      <input
                        type="number"
                        value={trigger.trigger_config.polling_interval_ms || 300000}
                        onChange={(e) => updateTrigger(triggerIndex, {
                          trigger_config: { ...trigger.trigger_config, polling_interval_ms: parseInt(e.target.value) || 300000 }
                        })}
                        min="30000"
                        max="3600000"
                      />
                      <span className="field-note">How often to check for changes (30s - 1hr)</span>
                    </label>
                  </div>

                  {/* Conditions */}
                  <div className="conditions-section">
                    <div className="subsection-header">
                      <h6>Conditions</h6>
                      <button 
                        onClick={() => addTriggerCondition(triggerIndex)}
                        className="add-condition-button"
                        type="button"
                      >
                        ➕ Add Condition
                      </button>
                    </div>

                    {trigger.conditions.map((condition, conditionIndex) => (
                      <div key={condition.id} className="condition-card">
                        <div className="condition-header">
                          <select
                            value={condition.type}
                            onChange={(e) => updateTriggerCondition(triggerIndex, conditionIndex, { type: e.target.value })}
                          >
                            <option value="status_change">Status Change</option>
                            <option value="new_comment">New Comment</option>
                            <option value="string_match">String Match</option>
                            <option value="assignee_change">Assignee Change</option>
                            <option value="priority_change">Priority Change</option>
                          </select>
                          <button 
                            onClick={() => removeTriggerCondition(triggerIndex, conditionIndex)}
                            className="remove-condition-button"
                          >
                            ❌
                          </button>
                        </div>

                        {condition.type === 'status_change' && (
                          <div className="condition-config">
                            <input
                              type="text"
                              value={condition.config.from_status || ''}
                              onChange={(e) => updateTriggerCondition(triggerIndex, conditionIndex, {
                                config: { ...condition.config, from_status: e.target.value }
                              })}
                              placeholder="From status (optional)"
                            />
                            <input
                              type="text"
                              value={condition.config.to_status || ''}
                              onChange={(e) => updateTriggerCondition(triggerIndex, conditionIndex, {
                                config: { ...condition.config, to_status: e.target.value }
                              })}
                              placeholder="To status"
                            />
                          </div>
                        )}

                        {condition.type === 'string_match' && (
                          <div className="condition-config">
                            <input
                              type="text"
                              value={condition.config.search_string || ''}
                              onChange={(e) => updateTriggerCondition(triggerIndex, conditionIndex, {
                                config: { ...condition.config, search_string: e.target.value }
                              })}
                              placeholder="Search text"
                            />
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={condition.config.case_sensitive || false}
                                onChange={(e) => updateTriggerCondition(triggerIndex, conditionIndex, {
                                  config: { ...condition.config, case_sensitive: e.target.checked }
                                })}
                              />
                              Case sensitive
                            </label>
                          </div>
                        )}

                        {condition.type === 'assignee_change' && (
                          <div className="condition-config">
                            <input
                              type="text"
                              value={condition.config.new_assignee || ''}
                              onChange={(e) => updateTriggerCondition(triggerIndex, conditionIndex, {
                                config: { ...condition.config, new_assignee: e.target.value }
                              })}
                              placeholder="New assignee name (optional)"
                            />
                          </div>
                        )}

                        {condition.type === 'priority_change' && (
                          <div className="condition-config">
                            <input
                              type="text"
                              value={condition.config.from_priority || ''}
                              onChange={(e) => updateTriggerCondition(triggerIndex, conditionIndex, {
                                config: { ...condition.config, from_priority: e.target.value }
                              })}
                              placeholder="From priority (optional)"
                            />
                            <input
                              type="text"
                              value={condition.config.to_priority || ''}
                              onChange={(e) => updateTriggerCondition(triggerIndex, conditionIndex, {
                                config: { ...condition.config, to_priority: e.target.value }
                              })}
                              placeholder="To priority"
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    {trigger.conditions.length === 0 && (
                      <div className="empty-condition">
                        <span>No conditions defined. Add conditions to specify when this trigger activates.</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {formData.triggers.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">🎯</div>
                  <p>No triggers configured yet</p>
                  <span>Add triggers to automate workspace creation based on events</span>
                </div>
              )}
            </div>
          </div>
        );

      case 'config':
        return (
          <div className="tab-content">
            <h4>Workspace Configuration</h4>
            
            <div className="form-group">
              <label>
                Naming Pattern
                <input
                  type="text"
                  value={formData.workspace_config.naming_pattern}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    workspace_config: { ...prev.workspace_config, naming_pattern: e.target.value }
                  }))}
                  placeholder="{{name}} - {{date}}"
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
                  min="1"
                  max="365"
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
        );

      default:
        return null;
    }
  };

  return (
    <div className="tabbed-template-editor">
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

      <div className="editor-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-name">{tab.name}</span>
          </button>
        ))}
      </div>

      <div className="editor-content">
        {renderTabContent()}
      </div>

      {/* Modals */}
      {showAgentSelector && (
        <AgentSelector
          onAgentsSelected={handleAgentsSelected}
          onClose={() => setShowAgentSelector(false)}
          selectedAgents={formData.agent_templates}
        />
      )}

      {showLibrarySelector && (
        <LibraryItemSelector
          onItemSelected={(itemId) => {
            if (editingReqIndex >= 0) {
              // Handle context requirement selection
              updateContextRequirement(editingReqIndex, { context_item_id: itemId });
              setEditingReqIndex(-1);
            } else if (editingTriggerIndex >= 0) {
              // Handle trigger context selection
              updateTrigger(editingTriggerIndex, { context_item_id: itemId });
              setEditingTriggerIndex(-1);
            }
            setShowLibrarySelector(false);
          }}
          onClose={() => {
            setShowLibrarySelector(false);
            setEditingReqIndex(-1);
            setEditingTriggerIndex(-1);
          }}
          filterTypes={editingTriggerIndex >= 0 ? ['jira_ticket', 'jira_project', 'git_repository', 'email_thread'] : undefined}
        />
      )}

      <style>{`
        .tabbed-template-editor {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .editor-header h3 {
          margin: 0;
          color: #111827;
          font-size: 18px;
        }

        .editor-actions {
          display: flex;
          gap: 12px;
        }

        .save-button {
          background: #10b981;
          color: white;
          border: none;
          padding: 8px 16px;
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
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .cancel-button:hover {
          background: #4b5563;
        }

        .editor-tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          background: white;
          overflow-x: auto;
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: #6b7280;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
          transition: all 0.2s;
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

        .tab-icon {
          font-size: 16px;
        }

        .tab-name {
          font-weight: 500;
        }

        .editor-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .tab-content {
          max-width: 800px;
          margin: 0 auto;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-header h4 {
          margin: 0;
          color: #111827;
          font-size: 16px;
        }

        .add-button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .add-button:hover {
          background: #2563eb;
        }

        .form-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: end;
        }

        label {
          display: flex;
          flex-direction: column;
          margin-bottom: 16px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .checkbox-label {
          flex-direction: row !important;
          align-items: center;
          gap: 8px;
          margin: 0;
        }

        .checkbox-label input {
          margin: 0;
          width: auto;
        }

        input, select, textarea {
          margin-top: 6px;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 1px #3b82f6;
        }

        textarea {
          resize: vertical;
          min-height: 80px;
        }

        .required {
          color: #ef4444;
        }

        .field-note {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }

        /* Card Components */
        .requirement-card, .agent-card, .variable-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          background: #f9fafb;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .name-input {
          flex: 1;
          margin: 0;
          font-weight: 600;
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

        .input-with-button {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }

        .input-with-button input {
          flex: 1;
          margin: 0;
        }

        .browse-button {
          background: #8b5cf6;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }

        .browse-button:hover {
          background: #7c3aed;
        }

        /* Agent Card Specific */
        .agent-info h5 {
          margin: 0;
          color: #111827;
          font-size: 16px;
        }

        .model-badge {
          background: #e5e7eb;
          color: #374151;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          margin-left: 8px;
        }

        .agent-details {
          display: grid;
          gap: 12px;
        }

        .commands-section label, .permissions-section label {
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 4px;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .tag {
          background: #e5e7eb;
          color: #374151;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
        }

        .tag.permission {
          background: #ddd6fe;
          color: #7c3aed;
        }

        .tag.more {
          background: #3b82f6;
          color: white;
        }

        /* Variable Card Specific */
        .variable-info {
          display: flex;
          gap: 12px;
          align-items: center;
          flex: 1;
        }

        .type-select {
          margin: 0;
          min-width: 120px;
        }

        .description-input {
          margin: 8px 0;
        }

        .default-input {
          margin: 0;
        }

        .options-input {
          margin-top: 8px;
        }

        /* Empty States */
        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #6b7280;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-state p {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 500;
          color: #374151;
        }

        .empty-state span {
          font-size: 14px;
          color: #6b7280;
        }

        /* Lists */
        .requirements-list, .agents-list, .variables-list, .triggers-list {
          max-height: 500px;
          overflow-y: auto;
        }

        /* Trigger Components */
        .trigger-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          background: #f9fafb;
        }

        .trigger-info {
          display: flex;
          gap: 16px;
          align-items: center;
          flex: 1;
        }

        .trigger-config-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }

        .trigger-config-section h6 {
          margin: 0 0 12px 0;
          color: #374151;
          font-size: 14px;
          font-weight: 600;
        }

        .conditions-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }

        .subsection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .subsection-header h6 {
          margin: 0;
          color: #374151;
          font-size: 14px;
          font-weight: 600;
        }

        .add-condition-button {
          background: #8b5cf6;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .add-condition-button:hover {
          background: #7c3aed;
        }

        .condition-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 8px;
        }

        .condition-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .condition-header select {
          margin: 0;
          flex: 1;
          max-width: 200px;
        }

        .remove-condition-button {
          background: #ef4444;
          color: white;
          border: none;
          padding: 2px 6px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 10px;
        }

        .remove-condition-button:hover {
          background: #dc2626;
        }

        .condition-config {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .condition-config input {
          margin: 0;
          flex: 1;
          min-width: 120px;
        }

        .empty-condition {
          text-align: center;
          padding: 20px;
          color: #6b7280;
          font-style: italic;
          background: #f3f4f6;
          border-radius: 6px;
        }

        /* Prebuilt Trigger Templates */
        .prebuilt-trigger-templates {
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 2px solid #e5e7eb;
        }

        .prebuilt-templates-loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .no-prebuilt-templates {
          text-align: center;
          padding: 40px 20px;
          background: #f9fafb;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .no-templates-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .no-prebuilt-templates h4 {
          margin: 0 0 8px 0;
          color: #374151;
        }

        .no-prebuilt-templates p {
          margin: 0 0 8px 0;
          color: #6b7280;
        }

        .no-prebuilt-templates small {
          color: #9ca3af;
          font-style: italic;
        }

        .templates-summary {
          font-size: 12px;
          color: #6b7280;
        }

        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
          margin: 16px 0;
        }

        .template-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          transition: all 0.2s;
        }

        .template-card:hover {
          background: #f1f5f9;
          border-color: #3b82f6;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
        }

        .template-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .template-info h5 {
          margin: 0 0 4px 0;
          color: #1e293b;
          font-size: 14px;
          font-weight: 600;
        }

        .template-info p {
          margin: 0 0 8px 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.4;
        }

        .template-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .template-type {
          background: #ddd6fe;
          color: #7c3aed;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          text-transform: capitalize;
        }

        .compatible-sources {
          font-size: 10px;
          color: #9ca3af;
        }

        .use-template-button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          width: 100%;
          transition: background 0.2s;
        }

        .use-template-button:hover {
          background: #2563eb;
        }

        .templates-note {
          text-align: center;
          padding: 12px;
          background: #fefce8;
          border: 1px solid #fde047;
          border-radius: 6px;
          color: #a16207;
        }
      `}</style>
    </div>
  );
};