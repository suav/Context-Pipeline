import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

const CHECKPOINTS_DIR = path.join(process.cwd(), 'storage', 'checkpoints');

export async function GET(request: NextRequest) {
  try {
    // Check if checkpoints directory exists
    try {
      await fs.access(CHECKPOINTS_DIR);
    } catch {
      return NextResponse.json({ 
        success: true, 
        checkpoints: [] 
      });
    }

    // Load checkpoints index
    const indexPath = path.join(CHECKPOINTS_DIR, 'index.json');
    try {
      const indexData = await fs.readFile(indexPath, 'utf8');
      const checkpoints = JSON.parse(indexData);
      
      // Sort by created_at descending (newest first)
      checkpoints.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      return NextResponse.json({
        success: true,
        checkpoints
      });
    } catch (error) {
      console.error('Error reading checkpoints index:', error);
      return NextResponse.json({ 
        success: true, 
        checkpoints: [] 
      });
    }
  } catch (error) {
    console.error('Error in checkpoints API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to load checkpoints' 
      },
      { status: 500 }
    );
  }
}