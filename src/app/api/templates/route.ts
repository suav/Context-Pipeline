import { NextRequest, NextResponse } from 'next/server';
import { TemplateService } from '@/features/templates/services/TemplateService';
import { templateInitService } from '@/features/templates/services/TemplateInitService';
import { templateLogger } from '@/features/templates/services/TemplateLogger';

const templateService = TemplateService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const templateId = searchParams.get('id');

    templateLogger.systemInfo('GET /api/templates', { 
      category, 
      template_id: templateId 
    });

    if (templateId) {
      const template = await templateService.getTemplate(templateId);
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ template });
    }

    let templates = await templateService.getAllTemplates();

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    return NextResponse.json({
      templates,
      count: templates.length
    });

  } catch (error) {
    templateLogger.systemError('GET /api/templates failed', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    templateLogger.systemInfo('POST /api/templates', { action });

    switch (action) {
      case 'create':
      case 'create_template':
        return await handleCreateTemplate(body.template);
      
      case 'update':
        return await handleUpdateTemplate(body.template);
      
      case 'delete':
        return await handleDeleteTemplate(body.template_id);
      
      case 'apply_template':
        return await handleApplyTemplate(body);
      
      case 'init_builtin_templates':
        return await handleInitBuiltinTemplates();
      
      case 'validate_builtin_templates':
        return await handleValidateBuiltinTemplates();
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    templateLogger.systemError('POST /api/templates failed', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    templateLogger.systemInfo('PUT /api/templates', { template_id: id });

    const updatedTemplate = await templateService.updateTemplate(id, updates);
    
    if (!updatedTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ template: updatedTemplate });

  } catch (error) {
    templateLogger.systemError('PUT /api/templates failed', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    templateLogger.systemInfo('DELETE /api/templates', { template_id: id });

    const deleted = await templateService.deleteTemplate(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    templateLogger.systemError('DELETE /api/templates failed', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Action handlers
async function handleCreateTemplate(templateData: any) {
  if (!templateData.name || !templateData.description) {
    return NextResponse.json(
      { error: 'Name and description are required' },
      { status: 400 }
    );
  }

  const template = await templateService.createTemplate({
    ...templateData,
    created_by: templateData.created_by || 'user'
  });

  return NextResponse.json({ 
    template,
    message: 'Template created successfully'
  });
}

async function handleUpdateTemplate(templateData: any) {
  if (!templateData.id) {
    return NextResponse.json(
      { error: 'Template ID is required' },
      { status: 400 }
    );
  }

  const updatedTemplate = await templateService.updateTemplate(templateData.id, templateData);
  
  if (!updatedTemplate) {
    return NextResponse.json(
      { error: 'Template not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ 
    template: updatedTemplate,
    message: 'Template updated successfully'
  });
}

async function handleDeleteTemplate(templateId: string) {
  if (!templateId) {
    return NextResponse.json(
      { error: 'Template ID is required' },
      { status: 400 }
    );
  }

  const deleted = await templateService.deleteTemplate(templateId);
  
  if (!deleted) {
    return NextResponse.json(
      { error: 'Template not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ 
    success: true,
    message: 'Template deleted successfully'
  });
}

async function handleApplyTemplate(data: any) {
  const { 
    template_id, 
    variable_values, 
    context_overrides, 
    trigger_id 
  } = data;

  if (!template_id) {
    return NextResponse.json(
      { error: 'Template ID is required' },
      { status: 400 }
    );
  }

  const result = await templateService.applyTemplate(template_id, {
    triggerId: trigger_id,
    contextOverrides: context_overrides,
    variableValues: variable_values
  });

  return NextResponse.json({
    result,
    message: result.success ? 'Template applied successfully' : 'Template application failed'
  });
}

async function handleInitBuiltinTemplates() {
  await templateInitService.initializeBuiltInTemplates();
  
  return NextResponse.json({
    message: 'Built-in templates initialized successfully'
  });
}

async function handleValidateBuiltinTemplates() {
  const validation = await templateInitService.validateBuiltInTemplates();
  
  return NextResponse.json({
    validation,
    message: validation.valid ? 
      'All built-in templates are valid' : 
      `Found ${validation.errors.length} validation errors`
  });
}