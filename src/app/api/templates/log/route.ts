import { NextRequest, NextResponse } from 'next/server';
import { templateLogger } from '@/features/templates/services/TemplateLogger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entry } = body;

    if (!entry) {
      return NextResponse.json({ error: 'Log entry is required' }, { status: 400 });
    }

    // Forward client log to server logger
    const { level, category, message, template_id, trigger_id, workspace_id, details, execution_context } = entry;

    switch (level) {
      case 'error':
        templateLogger.systemError(message, details || {});
        break;
      case 'warn':
        templateLogger.systemWarning(message, details || {});
        break;
      default:
        templateLogger.systemInfo(message, details || {});
        break;
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to process client log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}