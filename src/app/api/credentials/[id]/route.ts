/**
 * Single Credential API
 * Get full credential details for editing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCredentialById } from '../route';

// GET - Get single credential with unmasked values for editing
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const credential = await getCredentialById(params.id);
    
    if (!credential) {
      return NextResponse.json({
        success: false,
        error: 'Credential not found'
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      credential
    });
  } catch (error) {
    console.error('Failed to get credential:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get credential'
    }, { status: 500 });
  }
}