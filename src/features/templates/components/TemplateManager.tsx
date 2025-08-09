import React, { useState, useEffect } from 'react';
import { WorkspaceTemplate, TemplateVariable, ContextRequirement, AgentTemplate } from '../types';
import { clientLogger } from '../services/ClientLogger';
import { TabbedTemplateEditor } from './TabbedTemplateEditor';

interface TemplateManagerProps {
  onClose: () => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ onClose }) => {
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkspaceTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/templates');
      const result = await response.json();
      
      if (response.ok && result.templates) {
        setTemplates(result.templates);
        clientLogger.systemInfo(`Loaded ${result.templates.length} templates for management`);
      } else {
        throw new Error(result.error || 'Failed to load templates');
      }
    } catch (error: any) {
      clientLogger.systemError('Failed to load templates', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (templateData: Partial<WorkspaceTemplate>) => {
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: templateData.id ? 'update' : 'create',
          template: templateData
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        clientLogger.systemInfo(`Template ${templateData.id ? 'updated' : 'created'}: ${templateData.name}`);
        setIsEditing(false);
        setSelectedTemplate(null);
        await loadTemplates(); // Reload templates
      } else {
        throw new Error(result.error || 'Failed to save template');
      }
    } catch (error: any) {
      clientLogger.systemError('Failed to save template', error);
      alert(`Failed to save template: ${error.message}`);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          template_id: templateId
        })
      });

      if (response.ok) {
        clientLogger.systemInfo(`Template deleted: ${templateId}`);
        await loadTemplates(); // Reload templates
      } else {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete template');
      }
    } catch (error: any) {
      clientLogger.systemError('Failed to delete template', error);
      alert(`Failed to delete template: ${error.message}`);
    }
  };

  const startCreating = () => {
    setSelectedTemplate(null);
    setIsEditing(true);
  };

  const startEditing = (template: WorkspaceTemplate) => {
    setSelectedTemplate(template);
    setIsEditing(true);
  };

  if (loading) {
    return (
      <div className="template-manager loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="template-manager">
      <div className="template-manager-content">
        {!isEditing ? (
          <>
            <div className="template-manager-header">
              <h2>Template Manager</h2>
              <div className="header-actions">
                <button onClick={startCreating} className="create-button">
                  ➕ New Template
                </button>
                <button onClick={onClose} className="close-button">×</button>
              </div>
            </div>

        <div className="template-list-view">
          <div className="templates-summary">
            <div className="summary-stats">
              <div className="stat">
                <div className="stat-number">{templates.length}</div>
                <div className="stat-label">Templates</div>
              </div>
              <div className="stat">
                <div className="stat-number">{templates.reduce((sum, t) => sum + t.usage_stats.total_uses, 0)}</div>
                <div className="stat-label">Total Uses</div>
              </div>
              <div className="stat">
                <div className="stat-number">{templates.filter(t => t.usage_stats.success_rate > 0.8).length}</div>
                <div className="stat-label">High Success</div>
              </div>
            </div>
            <div className="summary-info">
              <p>Create custom templates with wildcard context requirements, variables, and agent configurations.</p>
            </div>
          </div>

          <div className="template-grid">
            {templates.map(template => (
              <div key={template.id} className="template-card">
                <div className="template-card-header">
                  <h3>{template.name}</h3>
                  <div className="template-category">{template.category}</div>
                </div>
                
                <p className="template-description">{template.description}</p>
                
                <div className="template-details">
                  <div className="detail-section">
                    <h4>Context Requirements ({template.context_requirements.length})</h4>
                    <ul className="requirements-list">
                      {template.context_requirements.map(req => (
                        <li key={req.id} className={`requirement ${req.type}`}>
                          <span className="req-icon">
                            {req.type === 'wildcard' ? '🎯' : '📌'}
                          </span>
                          <span className="req-name">{req.display_name}</span>
                          {req.required && <span className="required-badge">Required</span>}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="detail-section">
                    <h4>Variables ({template.variables.length})</h4>
                    {template.variables.length > 0 ? (
                      <ul className="variables-list">
                        {template.variables.map(variable => (
                          <li key={variable.name} className="variable">
                            <span className="var-name">{variable.name}</span>
                            <span className="var-type">({variable.type})</span>
                            {variable.required && <span className="required-badge">Required</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="empty-note">No variables defined</p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h4>Agents ({template.agent_templates.length})</h4>
                    <ul className="agents-list">
                      {template.agent_templates.map((agent, index) => (
                        <li key={index} className="agent">
                          <span className="agent-name">{agent.name}</span>
                          <span className="agent-model">({agent.model})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="template-stats">
                  <div>📊 Used {template.usage_stats.total_uses} times</div>
                  <div>✅ {Math.round(template.usage_stats.success_rate * 100)}% success rate</div>
                  <div>⚡ Avg creation: {Math.round(template.usage_stats.average_creation_time)}ms</div>
                </div>

                <div className="template-actions">
                  <button 
                    onClick={() => startEditing(template)}
                    className="edit-button"
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    onClick={() => deleteTemplate(template.id)}
                    className="delete-button"
                    disabled={template.usage_stats.total_uses > 0}
                    title={template.usage_stats.total_uses > 0 ? 'Cannot delete template that has been used' : 'Delete this template'}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {templates.length === 0 && (
            <div className="no-templates">
              <div className="no-templates-content">
                <div className="no-templates-icon">📋</div>
                <h3>No templates found</h3>
                <p>The built-in templates should be automatically created when you first use the system.</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="reload-button"
                >
                  Reload Page
                </button>
              </div>
            </div>
          )}
        </div>
          </>
        ) : (
          <TabbedTemplateEditor
            template={selectedTemplate}
            onSave={handleSaveTemplate}
            onCancel={() => {
              setIsEditing(false);
              setSelectedTemplate(null);
            }}
          />
        )}
      </div>

      <style>{`
        .template-manager {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .template-manager-content {
          background: var(--color-modal-background);
          border-radius: 12px;
          max-width: 1200px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          width: 100%;
        }

        .template-manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-surface);
          border-radius: 12px 12px 0 0;
        }

        .template-manager-header h2 {
          margin: 0;
          color: var(--color-text-primary);
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--color-text-muted);
        }

        .template-list-view {
          padding: 24px;
        }

        .templates-summary {
          margin-bottom: 24px;
          padding: 20px;
          background: var(--color-surface);
          border-radius: 8px;
        }

        .summary-stats {
          display: flex;
          gap: 32px;
          margin-bottom: 16px;
        }

        .stat {
          text-align: center;
        }

        .stat-number {
          font-size: 32px;
          font-weight: bold;
          color: var(--color-primary);
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 14px;
          color: var(--color-text-secondary);
        }

        .summary-info {
          padding: 12px;
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-primary);
          border-radius: 6px;
        }

        .summary-info p {
          margin: 0;
          color: var(--color-text-primary);
          font-size: 14px;
        }

        .create-button {
          background: var(--color-primary);
          color: var(--color-text-inverse);
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .create-button:hover {
          background: var(--color-primary-hover);
        }

        .template-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 20px;
        }

        .template-card {
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 20px;
          background: var(--color-surface);
          transition: box-shadow 0.2s;
        }

        .template-card:hover {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .template-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .template-card-header h3 {
          margin: 0;
          color: var(--color-text-primary);
          font-size: 18px;
        }

        .template-category {
          background: var(--color-surface-elevated);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          color: var(--color-text-muted);
          text-transform: capitalize;
        }

        .template-description {
          color: var(--color-text-secondary);
          margin-bottom: 20px;
          font-size: 14px;
          line-height: 1.5;
        }

        .template-details {
          margin-bottom: 20px;
        }

        .detail-section {
          margin-bottom: 16px;
          padding: 12px;
          background: var(--color-surface-elevated);
          border-radius: 6px;
        }

        .detail-section h4 {
          margin: 0 0 8px 0;
          color: var(--color-text-primary);
          font-size: 14px;
        }

        .requirements-list, .variables-list, .agents-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .requirement, .variable, .agent {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .req-icon {
          font-size: 14px;
        }

        .req-name, .var-name, .agent-name {
          font-weight: 500;
          color: var(--color-text-primary);
        }

        .var-type, .agent-model {
          color: var(--color-text-muted);
          font-style: italic;
        }

        .required-badge {
          background: var(--color-error);
          color: var(--color-text-inverse);
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
        }

        .empty-note {
          font-size: 12px;
          color: var(--color-text-muted);
          font-style: italic;
          margin: 0;
        }

        .template-stats {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
          margin-bottom: 16px;
          font-size: 12px;
          color: var(--color-text-secondary);
          padding: 12px;
          background: var(--color-surface-elevated);
          border-radius: 6px;
        }

        .template-actions {
          display: flex;
          gap: 8px;
        }

        .edit-button {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          background: var(--color-surface);
          color: var(--color-text-primary);
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .edit-button:hover {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: var(--color-text-inverse);
        }

        .delete-button {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          background: var(--color-surface);
          color: var(--color-text-primary);
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .delete-button:enabled:hover {
          background: var(--color-error-hover);
          border-color: var(--color-error);
          color: var(--color-text-inverse);
        }

        .delete-button:disabled {
          background: var(--color-surface-elevated);
          color: var(--color-text-muted);
          cursor: not-allowed;
        }

        .no-templates {
          text-align: center;
          padding: 60px 20px;
        }

        .no-templates-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .no-templates h3 {
          color: var(--color-text-primary);
          margin-bottom: 8px;
        }

        .no-templates p {
          color: var(--color-text-secondary);
          margin-bottom: 20px;
        }

        .reload-button {
          background: var(--color-primary);
          color: var(--color-text-inverse);
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .loading {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .loading-content {
          background: var(--color-modal-background);
          color: var(--color-text-primary);
          padding: 40px;
          border-radius: 8px;
          text-align: center;
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
      `}</style>
    </div>
  );
};