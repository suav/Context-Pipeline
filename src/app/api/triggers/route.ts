import { NextRequest, NextResponse } from 'next/server';
import { TriggerService } from '@/features/templates/services/TriggerService';
import { templateLogger } from '@/features/templates/services/TemplateLogger';

const triggerService = TriggerService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('template_id');
    const triggerId = searchParams.get('id');
    const status = searchParams.get('status');

    templateLogger.systemInfo('GET /api/triggers', { 
      template_id: templateId,
      trigger_id: triggerId,
      status 
    });

    if (triggerId) {
      const trigger = await triggerService.getTrigger(triggerId);
      if (!trigger) {
        return NextResponse.json(
          { error: 'Trigger not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ trigger });
    }

    let triggers;
    
    if (templateId) {
      triggers = await triggerService.getTriggersForTemplate(templateId);
    } else if (status === 'active') {
      triggers = await triggerService.getActiveTriggers();
    } else {
      triggers = await triggerService.getAllTriggers();
    }

    return NextResponse.json({
      triggers,
      count: triggers.length
    });

  } catch (error) {
    templateLogger.systemError('GET /api/triggers failed', error);
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

    templateLogger.systemInfo('POST /api/triggers', { action });

    switch (action) {
      case 'create_trigger':
        return await handleCreateTrigger(body.trigger);
      
      case 'execute_trigger':
        return await handleExecuteTrigger(body);
      
      case 'test_trigger':
        return await handleTestTrigger(body);
      
      case 'create_sample_triggers':
        return await handleCreateSampleTriggers();
      
      case 'start_monitoring':
        return await handleStartMonitoring(body);
      
      case 'stop_monitoring':
        return await handleStopMonitoring(body);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    templateLogger.systemError('POST /api/triggers failed', error);
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
        { error: 'Trigger ID is required' },
        { status: 400 }
      );
    }

    templateLogger.systemInfo('PUT /api/triggers', { trigger_id: id });

    const updatedTrigger = await triggerService.updateTrigger(id, updates);
    
    if (!updatedTrigger) {
      return NextResponse.json(
        { error: 'Trigger not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ trigger: updatedTrigger });

  } catch (error) {
    templateLogger.systemError('PUT /api/triggers failed', error);
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
        { error: 'Trigger ID is required' },
        { status: 400 }
      );
    }

    templateLogger.systemInfo('DELETE /api/triggers', { trigger_id: id });

    const deleted = await triggerService.deleteTrigger(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Trigger not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    templateLogger.systemError('DELETE /api/triggers failed', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Action handlers
async function handleCreateTrigger(triggerData: any) {
  if (!triggerData.name || !triggerData.template_id) {
    return NextResponse.json(
      { error: 'Name and template_id are required' },
      { status: 400 }
    );
  }

  const trigger = await triggerService.createTrigger({
    ...triggerData,
    created_by: triggerData.created_by || 'user'
  });

  return NextResponse.json({ 
    trigger,
    message: 'Trigger created successfully'
  });
}

async function handleExecuteTrigger(data: any) {
  const { trigger_id, context } = data;

  if (!trigger_id) {
    return NextResponse.json(
      { error: 'Trigger ID is required' },
      { status: 400 }
    );
  }

  const result = await triggerService.executeTrigger(trigger_id, context);

  return NextResponse.json({
    result,
    message: result.success ? 'Trigger executed successfully' : 'Trigger execution failed'
  });
}

async function handleTestTrigger(data: any) {
  const { trigger_id, mock_context } = data;

  if (!trigger_id) {
    return NextResponse.json(
      { error: 'Trigger ID is required' },
      { status: 400 }
    );
  }

  const result = await triggerService.testTrigger(trigger_id, mock_context);

  return NextResponse.json({
    result,
    message: 'Trigger test completed'
  });
}

async function handleCreateSampleTriggers() {
  const triggers = await triggerService.createSampleTriggers();

  return NextResponse.json({
    triggers,
    count: triggers.length,
    message: `Created ${triggers.length} sample triggers`
  });
}

async function handleStartMonitoring(data: any) {
  const { trigger_id } = data;

  if (!trigger_id) {
    return NextResponse.json(
      { error: 'Trigger ID is required' },
      { status: 400 }
    );
  }

  await triggerService.startMonitoring(trigger_id);

  return NextResponse.json({
    message: `Started monitoring for trigger ${trigger_id}`
  });
}

async function handleStopMonitoring(data: any) {
  const { trigger_id } = data;

  if (!trigger_id) {
    return NextResponse.json(
      { error: 'Trigger ID is required' },
      { status: 400 }
    );
  }

  await triggerService.stopMonitoring(trigger_id);

  return NextResponse.json({
    message: `Stopped monitoring for trigger ${trigger_id}`
  });
}