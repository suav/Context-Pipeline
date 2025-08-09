import { TemplateService } from './TemplateService';
import { templateLogger } from './TemplateLogger';
import builtInTemplates from '../data/builtInTemplates';

export class TemplateInitService {
  private templateService: TemplateService;

  constructor() {
    this.templateService = TemplateService.getInstance();
  }

  async initializeBuiltInTemplates(): Promise<void> {
    templateLogger.systemInfo('Initializing built-in templates');

    try {
      const existingTemplates = await this.templateService.getAllTemplates();
      const existingNames = new Set(existingTemplates.map(t => t.name));

      let createdCount = 0;
      let skippedCount = 0;

      for (const templateData of builtInTemplates) {
        if (existingNames.has(templateData.name)) {
          templateLogger.systemInfo(`Skipping existing built-in template: ${templateData.name}`);
          skippedCount++;
          continue;
        }

        try {
          const created = await this.templateService.createTemplate(templateData);
          templateLogger.systemInfo(`Created built-in template: ${created.name}`, {
            template_id: created.id,
            category: created.category
          });
          createdCount++;
        } catch (error) {
          templateLogger.systemError(`Failed to create built-in template: ${templateData.name}`, error);
        }
      }

      templateLogger.systemInfo(`Built-in template initialization complete`, {
        created: createdCount,
        skipped: skippedCount,
        total: builtInTemplates.length
      });

    } catch (error) {
      templateLogger.systemError('Failed to initialize built-in templates', error);
      throw error;
    }
  }

  async resetBuiltInTemplates(): Promise<void> {
    templateLogger.systemInfo('Resetting built-in templates (removing existing)');

    try {
      const existingTemplates = await this.templateService.getAllTemplates();
      
      // Remove existing built-in templates
      for (const template of existingTemplates) {
        if (template.created_by === 'system') {
          await this.templateService.deleteTemplate(template.id);
          templateLogger.systemInfo(`Removed existing built-in template: ${template.name}`);
        }
      }

      // Recreate them
      await this.initializeBuiltInTemplates();

    } catch (error) {
      templateLogger.systemError('Failed to reset built-in templates', error);
      throw error;
    }
  }

  async validateBuiltInTemplates(): Promise<{ valid: boolean; errors: string[] }> {
    templateLogger.systemInfo('Validating built-in templates');
    
    const errors: string[] = [];

    for (const template of builtInTemplates) {
      // Validate template structure
      if (!template.name || !template.description) {
        errors.push(`Template missing required fields: ${template.name || 'unnamed'}`);
      }

      // Validate context requirements
      for (const req of template.context_requirements) {
        if (req.type === 'explicit' && !req.context_item_id) {
          errors.push(`Template ${template.name}: Explicit context requirement missing context_item_id`);
        }
        if (req.type === 'wildcard' && !req.wildcard_type) {
          errors.push(`Template ${template.name}: Wildcard context requirement missing wildcard_type`);
        }
      }

      // Validate variables
      for (const variable of template.variables) {
        if (!variable.name || !variable.type) {
          errors.push(`Template ${template.name}: Variable missing name or type`);
        }
        if (variable.required && variable.default_value === undefined) {
          // This is actually OK - required variables can be provided at runtime
        }
      }

      // Validate agent templates
      for (const agent of template.agent_templates) {
        if (!agent.name || !agent.model) {
          errors.push(`Template ${template.name}: Agent template missing name or model`);
        }
        if (!agent.commands || agent.commands.length === 0) {
          errors.push(`Template ${template.name}: Agent template has no commands`);
        }
      }
    }

    const valid = errors.length === 0;
    if (valid) {
      templateLogger.systemInfo('All built-in templates are valid');
    } else {
      templateLogger.systemError(`Built-in template validation failed with ${errors.length} errors`, { errors });
    }

    return { valid, errors };
  }
}

export const templateInitService = new TemplateInitService();