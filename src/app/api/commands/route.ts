import { NextRequest, NextResponse } from 'next/server';
import CommandManager from '@/features/agents/services/CommandManager';

// GET /api/commands - Get all commands
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') as 'startup' | 'reply' | null;
    const category = searchParams.get('category');
    const role = searchParams.get('role');
    
    const commandManager = CommandManager.getInstance();
    await commandManager.initializeStorage();
    
    let commands;
    if (role) {
      commands = await commandManager.getCommandsByRole(role);
    } else if (mode) {
      commands = await commandManager.getCommandsByMode(mode);
    } else if (category) {
      commands = await commandManager.getCommandsByCategory(category);
    } else {
      commands = await commandManager.getAllCommands();
    }
    
    return NextResponse.json({ commands });
  } catch (error) {
    console.error('Failed to get commands:', error);
    return NextResponse.json(
      { error: 'Failed to load commands' },
      { status: 500 }
    );
  }
}

// POST /api/commands - Create or update a command
export async function POST(request: NextRequest) {
  try {
    const command = await request.json();
    
    const commandManager = CommandManager.getInstance();
    await commandManager.initializeStorage();
    await commandManager.saveCommand(command);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save command:', error);
    return NextResponse.json(
      { error: 'Failed to save command' },
      { status: 500 }
    );
  }
}

// DELETE /api/commands/[id] - Delete a command
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Command ID is required' },
        { status: 400 }
      );
    }
    
    const commandManager = CommandManager.getInstance();
    await commandManager.initializeStorage();
    await commandManager.deleteCommand(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete command:', error);
    return NextResponse.json(
      { error: 'Failed to delete command' },
      { status: 500 }
    );
  }
}

// PATCH /api/commands - Migrate existing commands to add roles
export async function PATCH(request: NextRequest) {
  try {
    const commandManager = CommandManager.getInstance();
    await commandManager.initializeStorage();
    await commandManager.migrateExistingCommands();
    
    return NextResponse.json({ success: true, message: 'Commands migrated successfully' });
  } catch (error) {
    console.error('Failed to migrate commands:', error);
    return NextResponse.json(
      { error: 'Failed to migrate commands' },
      { status: 500 }
    );
  }
}