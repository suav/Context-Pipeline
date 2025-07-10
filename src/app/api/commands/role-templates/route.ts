import { NextRequest, NextResponse } from 'next/server';
import CommandManager from '@/features/agents/services/CommandManager';

// GET /api/commands/role-templates - Get all role templates
export async function GET(request: NextRequest) {
  try {
    const commandManager = CommandManager.getInstance();
    await commandManager.initializeStorage();
    const templates = commandManager.getRoleTemplates();
    
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Failed to get role templates:', error);
    return NextResponse.json(
      { error: 'Failed to load role templates' },
      { status: 500 }
    );
  }
}