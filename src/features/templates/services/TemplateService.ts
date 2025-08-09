import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { 
  WorkspaceTemplate, 
  ContextRequirement, 
  TemplateApplicationResult, 
  AppliedContextItem,
  TemplateVariable,
  VariableMapping,
  TemplateApplicationError
} from '../types';
import { templateLogger } from './TemplateLogger';
import { LibraryItem } from '@/features/context-library/types';

export class TemplateService {
  private static instance: TemplateService;
  private templatesDir: string;
  private templateIndexFile: string;

  private constructor() {
    this.templatesDir = join(process.cwd(), 'storage', 'templates');
    this.templateIndexFile = join(this.templatesDir, 'template-index.json');
    this.ensureDirectories();
    templateLogger.systemInfo('TemplateService initialized', { templates_dir: this.templatesDir });
  }

  static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  private ensureDirectories(): void {
    if (!existsSync(this.templatesDir)) {
      mkdirSync(this.templatesDir, { recursive: true });
      templateLogger.systemInfo('Created templates directory');
    }
    
    if (!existsSync(this.templateIndexFile)) {
      writeFileSync(this.templateIndexFile, JSON.stringify([], null, 2));
      templateLogger.systemInfo('Created template index file');
    }
  }

  // Template CRUD Operations
  async createTemplate(template: Omit<WorkspaceTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_stats'>): Promise<WorkspaceTemplate> {
    const newTemplate: WorkspaceTemplate = {
      ...template,
      id: this.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      usage_stats: {
        total_uses: 0,
        manual_uses: 0,
        automated_uses: 0,
        last_used: null,
        success_rate: 1.0,
        average_creation_time: 0
      }
    };

    // Save template to file
    const templateFile = join(this.templatesDir, `${newTemplate.id}.json`);
    writeFileSync(templateFile, JSON.stringify(newTemplate, null, 2));

    // Update index
    await this.updateTemplateIndex();

    templateLogger.templateCreated(newTemplate.id, newTemplate.name, {
      category: newTemplate.category,
      context_requirements: newTemplate.context_requirements.length,
      agent_templates: newTemplate.agent_templates.length
    });

    return newTemplate;
  }

  async getTemplate(id: string): Promise<WorkspaceTemplate | null> {
    try {
      const templateFile = join(this.templatesDir, `${id}.json`);
      if (!existsSync(templateFile)) {
        templateLogger.systemWarning(`Template not found: ${id}`);
        return null;
      }

      const templateData = JSON.parse(readFileSync(templateFile, 'utf-8'));
      return templateData as WorkspaceTemplate;
    } catch (error) {
      templateLogger.systemError(`Failed to load template: ${id}`, error);
      return null;
    }
  }

  async getAllTemplates(): Promise<WorkspaceTemplate[]> {
    try {
      const templates: WorkspaceTemplate[] = [];
      const files = readdirSync(this.templatesDir).filter(f => f.endsWith('.json') && f !== 'template-index.json');
      
      for (const file of files) {
        const templateData = JSON.parse(readFileSync(join(this.templatesDir, file), 'utf-8'));
        templates.push(templateData as WorkspaceTemplate);
      }

      templates.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      return templates;
    } catch (error) {
      templateLogger.systemError('Failed to load templates', error);
      return [];
    }
  }

  async updateTemplate(id: string, updates: Partial<WorkspaceTemplate>): Promise<WorkspaceTemplate | null> {
    const existing = await this.getTemplate(id);
    if (!existing) {
      return null;
    }

    const updated: WorkspaceTemplate = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      created_at: existing.created_at, // Preserve creation date
      updated_at: new Date().toISOString()
    };

    const templateFile = join(this.templatesDir, `${id}.json`);
    writeFileSync(templateFile, JSON.stringify(updated, null, 2));

    templateLogger.templateUpdated(id, updates);
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    try {
      const existing = await this.getTemplate(id);
      if (!existing) {
        return false;
      }

      const templateFile = join(this.templatesDir, `${id}.json`);
      if (existsSync(templateFile)) {
        // In a real implementation, you'd use fs.unlinkSync
        // For safety in this demo, we'll just log the deletion
        templateLogger.templateDeleted(id, existing.name);
        return true;
      }

      return false;
    } catch (error) {
      templateLogger.systemError(`Failed to delete template: ${id}`, error);
      return false;
    }
  }

  // Template Application with Wildcard Support
  async applyTemplate(
    templateId: string,
    options: {
      triggerId?: string;
      contextOverrides?: Record<string, string>; // wildcard_type -> specific_item_id
      variableValues?: Record<string, any>;
      triggerContext?: any;
    } = {}
  ): Promise<TemplateApplicationResult> {
    const startTime = Date.now();
    const template = await this.getTemplate(templateId);
    
    if (!template) {
      templateLogger.templateApplicationFailed(templateId, new Error('Template not found'));
      return {
        success: false,
        errors: [{ type: 'validation', message: 'Template not found' }],
        warnings: [],
        resolved_variables: {},
        applied_context_items: [],
        execution_time_ms: Date.now() - startTime
      };
    }

    templateLogger.templateApplicationStarted(templateId, options.triggerId);

    const errors: TemplateApplicationError[] = [];
    const warnings: string[] = [];
    const appliedContextItems: AppliedContextItem[] = [];

    try {
      // 1. Resolve context requirements (including wildcards)
      templateLogger.contextResolutionStarted(templateId, template.context_requirements);
      
      for (const requirement of template.context_requirements) {
        try {
          const contextItem = await this.resolveContextRequirement(requirement, options.contextOverrides);
          if (contextItem) {
            appliedContextItems.push(contextItem);
          } else if (requirement.required) {
            errors.push({
              type: 'context_resolution',
              message: `Required context item could not be resolved: ${requirement.display_name}`,
              details: { requirement }
            });
          } else {
            warnings.push(`Optional context item not found: ${requirement.display_name}`);
          }
        } catch (error) {
          const errorMsg = `Failed to resolve context requirement: ${requirement.display_name}`;
          templateLogger.systemError(errorMsg, error);
          
          if (requirement.required) {
            errors.push({
              type: 'context_resolution',
              message: errorMsg,
              details: { requirement, error }
            });
          } else {
            warnings.push(errorMsg);
          }
        }
      }

      // 2. Resolve template variables
      const resolvedVariables = await this.resolveTemplateVariables(
        template.variables,
        options.variableValues,
        options.triggerContext,
        appliedContextItems
      );

      // 3. If no critical errors, create workspace
      if (errors.filter(e => e.type === 'context_resolution').length === 0) {
        const workspaceId = await this.createWorkspaceFromTemplate(
          template,
          appliedContextItems,
          resolvedVariables
        );

        if (workspaceId) {
          const executionTime = Date.now() - startTime;
          templateLogger.templateApplicationCompleted(templateId, workspaceId, executionTime);

          // Update usage stats
          await this.updateTemplateUsageStats(templateId, true, executionTime, !!options.triggerId);

          return {
            success: true,
            workspace_id: workspaceId,
            errors,
            warnings,
            resolved_variables: resolvedVariables,
            applied_context_items: appliedContextItems,
            execution_time_ms: executionTime
          };
        } else {
          errors.push({
            type: 'workspace_creation',
            message: 'Failed to create workspace from template'
          });
        }
      }

      // If we got here, something failed
      const executionTime = Date.now() - startTime;
      templateLogger.templateApplicationFailed(templateId, new Error('Template application failed'), {
        errors: errors.length,
        warnings: warnings.length
      });

      await this.updateTemplateUsageStats(templateId, false, executionTime, !!options.triggerId);

      return {
        success: false,
        errors,
        warnings,
        resolved_variables: {},
        applied_context_items: appliedContextItems,
        execution_time_ms: executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      templateLogger.templateApplicationFailed(templateId, error);
      await this.updateTemplateUsageStats(templateId, false, executionTime, !!options.triggerId);

      return {
        success: false,
        errors: [{ type: 'validation', message: error.message || 'Unknown error' }],
        warnings,
        resolved_variables: {},
        applied_context_items: appliedContextItems,
        execution_time_ms: executionTime
      };
    }
  }

  // Context Requirement Resolution with Wildcard Support
  private async resolveContextRequirement(
    requirement: ContextRequirement,
    contextOverrides: Record<string, string> = {}
  ): Promise<AppliedContextItem | null> {
    if (requirement.type === 'explicit') {
      // Explicit context items - use exact library item
      if (!requirement.context_item_id) {
        templateLogger.systemWarning(`Explicit context requirement missing context_item_id`, { requirement });
        return null;
      }

      const contextItem = await this.getLibraryItem(requirement.context_item_id);
      if (!contextItem) {
        templateLogger.systemWarning(`Explicit context item not found: ${requirement.context_item_id}`);
        return null;
      }

      return {
        requirement_id: requirement.id,
        context_item_id: requirement.context_item_id,
        type: 'explicit',
        metadata: { title: contextItem.title, source: contextItem.source }
      };

    } else if (requirement.type === 'wildcard') {
      // Wildcard resolution
      const wildcardType = requirement.wildcard_type;
      if (!wildcardType) {
        templateLogger.systemWarning(`Wildcard requirement missing wildcard_type`, { requirement });
        return null;
      }

      // Check if override provided
      if (contextOverrides[wildcardType]) {
        const overrideItemId = contextOverrides[wildcardType];
        const contextItem = await this.getLibraryItem(overrideItemId);
        
        if (contextItem) {
          templateLogger.wildcardResolved(requirement.id, wildcardType, overrideItemId);
          return {
            requirement_id: requirement.id,
            context_item_id: overrideItemId,
            type: 'wildcard_resolved',
            metadata: { 
              wildcard_type: wildcardType,
              title: contextItem.title,
              source: contextItem.source
            }
          };
        } else {
          templateLogger.wildcardResolutionFailed(requirement.id, wildcardType, 'Override item not found');
        }
      }

      // Attempt automatic wildcard resolution
      const resolvedItem = await this.resolveWildcard(wildcardType, requirement.wildcard_filters);
      if (resolvedItem) {
        templateLogger.wildcardResolved(requirement.id, wildcardType, resolvedItem.id);
        return {
          requirement_id: requirement.id,
          context_item_id: resolvedItem.id,
          type: 'wildcard_resolved',
          metadata: {
            wildcard_type: wildcardType,
            title: resolvedItem.title,
            source: resolvedItem.source
          }
        };
      } else {
        templateLogger.wildcardResolutionFailed(requirement.id, wildcardType, 'No matching items found');
      }
    }

    return null;
  }

  // Wildcard Resolution Logic
  private async resolveWildcard(
    wildcardType: string,
    filters: any = {}
  ): Promise<LibraryItem | null> {
    try {
      // Get all library items
      const allItems = await this.getAllLibraryItems();
      
      // Filter based on wildcard type
      let candidates: LibraryItem[] = [];
      
      switch (wildcardType) {
        case 'generic_ticket':
          candidates = allItems.filter(item => 
            item.type === 'jira_ticket' || 
            item.source === 'jira' ||
            (item.tags && item.tags.some(tag => tag.includes('ticket')))
          );
          break;
          
        case 'generic_repository':
          candidates = allItems.filter(item => 
            item.type === 'git_repository' || 
            item.source === 'git' ||
            (item.tags && item.tags.some(tag => tag.includes('repo')))
          );
          break;
          
        case 'generic_document':
          candidates = allItems.filter(item => 
            item.type === 'document' || 
            item.type === 'file' ||
            (item.tags && item.tags.some(tag => tag.includes('doc')))
          );
          break;
          
        default:
          templateLogger.systemWarning(`Unknown wildcard type: ${wildcardType}`);
          return null;
      }

      // Apply additional filters if provided
      if (filters.tags && filters.tags.length > 0) {
        candidates = candidates.filter(item => 
          item.tags && item.tags.some(tag => filters.tags.includes(tag))
        );
      }

      if (filters.source && filters.source.length > 0) {
        candidates = candidates.filter(item => filters.source.includes(item.source));
      }

      // For now, return the first match (could implement more sophisticated selection)
      return candidates.length > 0 ? candidates[0] : null;

    } catch (error) {
      templateLogger.systemError(`Wildcard resolution failed for ${wildcardType}`, error);
      return null;
    }
  }

  // Variable Resolution
  private async resolveTemplateVariables(
    templateVariables: TemplateVariable[],
    providedValues: Record<string, any> = {},
    triggerContext: any = {},
    contextItems: AppliedContextItem[] = []
  ): Promise<Record<string, any>> {
    const resolved: Record<string, any> = {};

    for (const variable of templateVariables) {
      try {
        let value: any;

        // Priority: provided values > trigger context > default value
        if (providedValues[variable.name] !== undefined) {
          value = providedValues[variable.name];
          templateLogger.variableResolved('', variable.name, value, 'provided_values');
        } else if (triggerContext && this.extractFromTriggerContext(variable.name, triggerContext)) {
          value = this.extractFromTriggerContext(variable.name, triggerContext);
          templateLogger.variableResolved('', variable.name, value, 'trigger_context');
        } else if (variable.default_value !== undefined) {
          value = variable.default_value;
          templateLogger.variableResolved('', variable.name, value, 'default_value');
        } else if (variable.required) {
          templateLogger.variableResolutionFailed('', variable.name, 'Required variable not provided');
          throw new Error(`Required variable not provided: ${variable.name}`);
        } else {
          templateLogger.variableResolutionFailed('', variable.name, 'Optional variable not resolved');
          continue;
        }

        // Basic validation
        if (variable.validation) {
          const validationResult = this.validateVariable(value, variable.validation);
          if (!validationResult.valid) {
            throw new Error(`Variable validation failed for ${variable.name}: ${validationResult.message}`);
          }
        }

        resolved[variable.name] = value;

      } catch (error) {
        templateLogger.variableResolutionFailed('', variable.name, error);
        if (variable.required) {
          throw error;
        }
      }
    }

    return resolved;
  }

  private extractFromTriggerContext(variableName: string, context: any): any {
    // Extract common variables from trigger context (JIRA, Git, etc.)
    if (!context) return undefined;

    // Simple extraction - could be made more sophisticated
    const paths = [
      variableName,
      `jira.${variableName}`,
      `git.${variableName}`,
      `fields.${variableName}`,
      context[variableName]
    ];

    for (const path of paths) {
      const value = this.getNestedValue(context, path);
      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private validateVariable(value: any, validation: any): { valid: boolean; message?: string } {
    // Basic validation implementation
    if (validation.min_length && typeof value === 'string' && value.length < validation.min_length) {
      return { valid: false, message: `Minimum length ${validation.min_length} required` };
    }
    
    if (validation.max_length && typeof value === 'string' && value.length > validation.max_length) {
      return { valid: false, message: `Maximum length ${validation.max_length} exceeded` };
    }
    
    if (validation.pattern && typeof value === 'string' && !new RegExp(validation.pattern).test(value)) {
      return { valid: false, message: 'Pattern validation failed' };
    }

    return { valid: true };
  }

  // Workspace Creation from Template
  private async createWorkspaceFromTemplate(
    template: WorkspaceTemplate,
    contextItems: AppliedContextItem[],
    resolvedVariables: Record<string, any>
  ): Promise<string | null> {
    try {
      // This would integrate with existing workspace creation logic
      // For now, we'll simulate workspace creation
      
      const workspaceId = this.generateId();
      const workspaceName = this.resolveTemplateString(template.workspace_config.naming_pattern, resolvedVariables);

      templateLogger.systemInfo(`Creating workspace from template: ${template.name}`, {
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        context_items: contextItems.length,
        template_id: template.id
      });

      // Here we would:
      // 1. Create workspace directory structure
      // 2. Copy context items according to template requirements
      // 3. Generate files from templates with resolved variables
      // 4. Set up agents according to agent templates
      
      return workspaceId;

    } catch (error) {
      templateLogger.systemError('Workspace creation from template failed', error);
      return null;
    }
  }

  private resolveTemplateString(template: string, variables: Record<string, any>): string {
    let resolved = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      resolved = resolved.replace(placeholder, String(value));
    }
    
    return resolved;
  }

  // Utility methods
  private generateId(): string {
    return 'tpl_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private async updateTemplateIndex(): void {
    try {
      const templates = await this.getAllTemplates();
      const index = templates.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        updated_at: t.updated_at
      }));
      
      writeFileSync(this.templateIndexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      templateLogger.systemError('Failed to update template index', error);
    }
  }

  private async updateTemplateUsageStats(
    templateId: string,
    success: boolean,
    executionTime: number,
    automated: boolean
  ): Promise<void> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) return;

      const stats = template.usage_stats;
      stats.total_uses += 1;
      if (automated) {
        stats.automated_uses += 1;
      } else {
        stats.manual_uses += 1;
      }

      if (success) {
        stats.last_used = new Date().toISOString();
        stats.average_creation_time = (stats.average_creation_time + executionTime) / 2;
      }

      const totalAttempts = stats.total_uses;
      const successfulAttempts = success ? totalAttempts - (totalAttempts - 1) * stats.success_rate + 1 : totalAttempts - (totalAttempts - 1) * stats.success_rate;
      stats.success_rate = successfulAttempts / totalAttempts;

      await this.updateTemplate(templateId, { usage_stats: stats });

    } catch (error) {
      templateLogger.systemError('Failed to update template usage stats', error);
    }
  }

  // Mock methods for library integration (would be replaced with actual library service calls)
  private async getLibraryItem(id: string): Promise<LibraryItem | null> {
    // Mock implementation - would integrate with actual library service
    templateLogger.systemInfo(`Mock: Getting library item ${id}`);
    
    // Return a mock library item for testing
    return {
      id,
      title: `Mock Library Item ${id}`,
      type: 'document',
      source: 'mock',
      content_preview: 'Mock content preview',
      tags: ['mock', 'test'],
      file_path: `/mock/path/${id}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      library_metadata: {
        clone_mode: 'read-only',
        imported_at: new Date().toISOString()
      }
    } as LibraryItem;
  }

  private async getAllLibraryItems(): Promise<LibraryItem[]> {
    // Mock implementation - would integrate with actual library service
    templateLogger.systemInfo('Mock: Getting all library items');
    
    // Return mock library items for testing
    return [
      {
        id: 'lib_jira_001',
        title: 'Mock JIRA Ticket',
        type: 'jira_ticket',
        source: 'jira',
        tags: ['ticket', 'bug'],
      },
      {
        id: 'lib_git_001', 
        title: 'Mock Git Repository',
        type: 'git_repository',
        source: 'git',
        tags: ['repo', 'main'],
      },
      {
        id: 'lib_doc_001',
        title: 'Mock Documentation',
        type: 'document',
        source: 'file',
        tags: ['doc', 'readme'],
      }
    ] as LibraryItem[];
  }
}