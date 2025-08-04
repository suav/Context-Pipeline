import { NextRequest, NextResponse } from 'next/server';
import CommandManager from '@/features/agents/services/CommandManager';

// GET /api/commands/[id] - Get a specific command
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    const commandManager = CommandManager.getInstance();
    await commandManager.initializeStorage();
    const command = await commandManager.getCommand(id);
    
    if (!command) {
      return NextResponse.json(
        { error: 'Command not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ command });
  } catch (error) {
    console.error('Failed to get command:', error);
    return NextResponse.json(
      { error: 'Failed to load command' },
      { status: 500 }
    );
  }
}

// DELETE /api/commands/[id] - Delete a specific command
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
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