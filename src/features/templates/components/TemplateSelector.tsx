import React, { useState, useEffect } from 'react';
import { WorkspaceTemplate, TemplateApplicationResult } from '../types';
import { clientLogger } from '../services/ClientLogger';

interface TemplateSelectorProps {
  selectedLibraryItems: string[];
  onTemplateApply: (result: TemplateApplicationResult) => void;
  onClose: () => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedLibraryItems,
  onTemplateApply,
  onClose
}) => {
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkspaceTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, any>>({});
  const [contextOverrides, setContextOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      
      // Load templates via API call
      const response = await fetch('/api/templates');
      const result = await response.json();
      
      if (response.ok && result.templates) {
        const allTemplates = result.templates;
        
        // Score templates based on selected library items compatibility
        const scoredTemplates = allTemplates.map((template: WorkspaceTemplate) => ({
          ...template,
          compatibility_score: calculateCompatibilityScore(template, selectedLibraryItems)
        })).sort((a: any, b: any) => b.compatibility_score - a.compatibility_score);

        setTemplates(scoredTemplates);
        clientLogger.systemInfo(`Loaded ${allTemplates.length} templates for selection`, {
          selected_items: selectedLibraryItems.length
        });
      } else {
        throw new Error(result.error || 'Failed to load templates');
      }
    } catch (error: any) {
      clientLogger.systemError('Failed to load templates', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCompatibilityScore = (template: WorkspaceTemplate, selectedItems: string[]): number => {
    // Simple scoring based on number of requirements that could be satisfied
    let score = 0;
    
    for (const requirement of template.context_requirements) {
      if (requirement.type === 'explicit') {
        // Check if the specific item is selected
        if (selectedItems.includes(requirement.context_item_id || '')) {
          score += 10;
        }
      } else if (requirement.type === 'wildcard') {
        // For wildcards, give partial credit since selected items might match
        score += 5;
      }
    }

    // Bonus for having exactly the right number of selected items
    if (selectedItems.length === template.context_requirements.length) {
      score += 5;
    }

    return score;
  };

  const handleTemplateSelect = (template: WorkspaceTemplate) => {
    setSelectedTemplate(template);
    
    // Initialize variable values with defaults
    const defaults: Record<string, any> = {};
    template.variables.forEach(variable => {
      if (variable.default_value !== undefined) {
        defaults[variable.name] = variable.default_value;
      }
    });
    setVariableValues(defaults);

    clientLogger.templateSelected(template.id, template.name, {
      variables: template.variables.length,
      requirements: template.context_requirements.length
    });
  };

  const handleVariableChange = (variableName: string, value: any) => {
    setVariableValues(prev => ({
      ...prev,
      [variableName]: value
    }));
  };

  const handleContextOverride = (wildcardType: string, itemId: string) => {
    setContextOverrides(prev => ({
      ...prev,
      [wildcardType]: itemId
    }));
  };

  const applyTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setApplying(true);
      clientLogger.templateApplicationStarted(selectedTemplate.id);

      // Apply template via API call
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_template',
          template_id: selectedTemplate.id,
          variable_values: variableValues,
          context_overrides: contextOverrides
        })
      });

      const apiResult = await response.json();
      const result = apiResult.result;

      clientLogger.systemInfo(`Template application result`, {
        template_id: selectedTemplate.id,
        success: result?.success,
        errors: result?.errors?.length || 0,
        warnings: result?.warnings?.length || 0
      });

      if (result) {
        onTemplateApply(result);
        
        if (result.success) {
          onClose();
        }
      } else {
        throw new Error(apiResult.error || 'No result from API');
      }
    } catch (error: any) {
      clientLogger.systemError('Template application failed', error);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="template-selector loading">
        <div className="loading-spinner">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="template-selector">
      <div className="template-selector-header">
        <h2>Select Template</h2>
        <button onClick={onClose} className="close-button">×</button>
      </div>

      {!selectedTemplate ? (
        <div className="template-list">
          <div className="template-list-header">
            <p>Choose a template that matches your workflow. Templates are scored based on compatibility with your selected library items.</p>
            <div className="selected-items-summary">
              Selected items: {selectedLibraryItems.length}
            </div>
          </div>

          {templates.map(template => (
            <div 
              key={template.id} 
              className={`template-card ${(template as any).compatibility_score > 0 ? 'compatible' : 'partial'}`}
              onClick={() => handleTemplateSelect(template)}
            >
              <div className="template-card-header">
                <h3>{template.name}</h3>
                <div className="template-category">{template.category}</div>
                <div className="compatibility-score">
                  Score: {(template as any).compatibility_score}
                </div>
              </div>
              
              <p className="template-description">{template.description}</p>
              
              <div className="template-requirements">
                <h4>Requirements ({template.context_requirements.length}):</h4>
                <ul>
                  {template.context_requirements.map(req => (
                    <li key={req.id} className={req.required ? 'required' : 'optional'}>
                      <span className="req-type">{req.type === 'wildcard' ? '🎯' : '📌'}</span>
                      {req.display_name}
                      {req.required && <span className="required-badge">Required</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="template-agents">
                <h4>Agents ({template.agent_templates.length}):</h4>
                <div className="agent-list">
                  {template.agent_templates.map((agent, index) => (
                    <span key={index} className="agent-badge">
                      {agent.name} ({agent.model})
                    </span>
                  ))}
                </div>
              </div>

              <div className="template-stats">
                <span>Used {template.usage_stats.total_uses} times</span>
                <span>Success rate: {Math.round(template.usage_stats.success_rate * 100)}%</span>
              </div>
            </div>
          ))}

          {templates.length === 0 && (
            <div className="no-templates">
              <p>No templates available. Create a template first to use this feature.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="template-configuration">
          <div className="config-header">
            <h3>Configure Template: {selectedTemplate.name}</h3>
            <button onClick={() => setSelectedTemplate(null)} className="back-button">
              ← Back to Templates
            </button>
          </div>

          {/* Context Requirements Configuration */}
          <div className="config-section">
            <h4>Context Requirements</h4>
            {selectedTemplate.context_requirements.map(req => (
              <div key={req.id} className="requirement-config">
                <div className="requirement-info">
                  <span className="req-name">{req.display_name}</span>
                  {req.required && <span className="required-badge">Required</span>}
                  <p className="req-description">{req.description}</p>
                </div>

                {req.type === 'wildcard' && req.wildcard_type && (
                  <div className="wildcard-override">
                    <label>Override {req.wildcard_type}:</label>
                    <select 
                      value={contextOverrides[req.wildcard_type] || ''}
                      onChange={(e) => handleContextOverride(req.wildcard_type!, e.target.value)}
                    >
                      <option value="">Auto-detect</option>
                      {selectedLibraryItems.map(itemId => (
                        <option key={itemId} value={itemId}>{itemId}</option>
                      ))}
                    </select>
                  </div>
                )}

                {req.type === 'explicit' && (
                  <div className="explicit-requirement">
                    <span className="explicit-item">Uses: {req.context_item_id}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Variables Configuration */}
          {selectedTemplate.variables.length > 0 && (
            <div className="config-section">
              <h4>Template Variables</h4>
              {selectedTemplate.variables.map(variable => (
                <div key={variable.name} className="variable-config">
                  <label>
                    {variable.name}
                    {variable.required && <span className="required">*</span>}
                  </label>
                  <p className="variable-description">{variable.description}</p>
                  
                  {variable.type === 'string' && (
                    <input
                      type="text"
                      value={variableValues[variable.name] || ''}
                      onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                      placeholder={variable.default_value}
                    />
                  )}

                  {variable.type === 'select' && variable.options && (
                    <select
                      value={variableValues[variable.name] || variable.default_value || ''}
                      onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                    >
                      {variable.options.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  )}

                  {variable.type === 'boolean' && (
                    <input
                      type="checkbox"
                      checked={variableValues[variable.name] || variable.default_value || false}
                      onChange={(e) => handleVariableChange(variable.name, e.target.checked)}
                    />
                  )}

                  {variable.type === 'number' && (
                    <input
                      type="number"
                      value={variableValues[variable.name] || variable.default_value || ''}
                      onChange={(e) => handleVariableChange(variable.name, Number(e.target.value))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Template Preview */}
          <div className="config-section">
            <h4>Workspace Preview</h4>
            <div className="workspace-preview">
              <div className="preview-name">
                Workspace Name: {resolvePreviewName(selectedTemplate.workspace_config.naming_pattern, variableValues)}
              </div>
              <div className="preview-agents">
                Agents: {selectedTemplate.agent_templates.map(a => a.name).join(', ')}
              </div>
            </div>
          </div>

          <div className="config-actions">
            <button 
              onClick={applyTemplate} 
              disabled={applying}
              className="apply-button"
            >
              {applying ? 'Creating Workspace...' : 'Create Workspace'}
            </button>
            <button onClick={() => setSelectedTemplate(null)} className="cancel-button">
              Cancel
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .template-selector {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .template-selector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e0e0e0;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
        }

        .template-list-header {
          margin-bottom: 20px;
        }

        .selected-items-summary {
          background: #f5f5f5;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
          margin-top: 10px;
        }

        .template-card {
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .template-card:hover {
          border-color: #007bff;
          box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
        }

        .template-card.compatible {
          border-left: 4px solid #28a745;
        }

        .template-card.partial {
          border-left: 4px solid #ffc107;
        }

        .template-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .template-category {
          background: #e9ecef;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        .compatibility-score {
          background: #007bff;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        .template-requirements ul, .template-agents .agent-list {
          list-style: none;
          padding: 0;
          margin: 5px 0;
        }

        .template-requirements li {
          display: flex;
          align-items: center;
          margin: 4px 0;
        }

        .req-type {
          margin-right: 8px;
        }

        .required-badge {
          background: #dc3545;
          color: white;
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 10px;
          margin-left: 8px;
        }

        .agent-badge {
          background: #6f42c1;
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
          margin-right: 6px;
          margin-bottom: 4px;
          display: inline-block;
        }

        .template-stats {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #6c757d;
          margin-top: 10px;
        }

        .config-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .back-button {
          background: #6c757d;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .config-section {
          margin-bottom: 24px;
          padding: 16px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
        }

        .config-section h4 {
          margin-top: 0;
          color: #343a40;
        }

        .requirement-config, .variable-config {
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f0f0f0;
        }

        .requirement-config:last-child, .variable-config:last-child {
          border-bottom: none;
        }

        .variable-config label {
          display: block;
          font-weight: bold;
          margin-bottom: 4px;
        }

        .variable-description {
          color: #6c757d;
          font-size: 14px;
          margin: 4px 0 8px 0;
        }

        .variable-config input, .variable-config select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ced4da;
          border-radius: 4px;
        }

        .wildcard-override {
          margin-top: 8px;
        }

        .wildcard-override label {
          display: block;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .wildcard-override select {
          width: 100%;
          padding: 6px;
          border: 1px solid #ced4da;
          border-radius: 4px;
        }

        .workspace-preview {
          background: #f8f9fa;
          padding: 12px;
          border-radius: 4px;
          font-family: monospace;
        }

        .preview-name {
          font-weight: bold;
          margin-bottom: 6px;
        }

        .config-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        .apply-button {
          background: #28a745;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
        }

        .apply-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .cancel-button {
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
        }

        .loading {
          text-align: center;
          padding: 40px;
        }

        .no-templates {
          text-align: center;
          padding: 40px;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
};

// Helper function to resolve template naming pattern with variables
function resolvePreviewName(pattern: string, variables: Record<string, any>): string {
  let resolved = pattern;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    resolved = resolved.replace(placeholder, String(value || `{${key}}`));
  }
  
  return resolved;
}