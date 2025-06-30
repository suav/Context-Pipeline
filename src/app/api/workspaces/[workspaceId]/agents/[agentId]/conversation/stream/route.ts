/**
 * Agent Conversation Streaming API Route
 * Handles streaming responses from AI agents
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { agentService } from '../../../../../../../../features/agents/services/AgentService';

const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

interface ConversationMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    command_id?: string;
    file_changes?: string[];
    approval_required?: boolean;
    human_intervention?: boolean;
    backend?: string;
    success?: boolean;
  };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; agentId: string }> }
) {
    try {
        const { workspaceId, agentId } = await params;
        const body = await request.json();
        const { message, model } = body;
        
        if (!message || message.trim() === '') {
            return NextResponse.json(
                { error: 'Message content is required' },
                { status: 400 }
            );
        }
        
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        const conversationPath = path.join(workspacePath, 'agents', 'conversations', `${agentId}.json`);
        const agentStatePath = path.join(workspacePath, 'agents', 'states', `${agentId}.json`);
        
        // Check if workspace exists
        try {
            await fs.access(workspacePath);
        } catch {
            return NextResponse.json(
                { error: 'Workspace not found' },
                { status: 404 }
            );
        }
        
        // Load existing conversation
        let conversation;
        try {
            const conversationData = await fs.readFile(conversationPath, 'utf-8');
            conversation = JSON.parse(conversationData);
        } catch {
            // Create new conversation
            await fs.mkdir(path.dirname(conversationPath), { recursive: true });
            conversation = {
                agent_id: agentId,
                workspace_id: workspaceId,
                created_at: new Date().toISOString(),
                messages: []
            };
        }
        
        // Add user message to conversation
        const userMessage: ConversationMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            role: 'user',
            content: message.trim()
        };
        
        conversation.messages.push(userMessage);
        conversation.updated_at = new Date().toISOString();
        
        // Save conversation with user message immediately
        await fs.writeFile(conversationPath, JSON.stringify(conversation, null, 2));
        
        // Create a streaming response
        const encoder = new TextEncoder();
        
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Update agent state to active
                    try {
                        const agentStateData = await fs.readFile(agentStatePath, 'utf-8');
                        const agentState = JSON.parse(agentStateData);
                        
                        agentState.status = 'active';
                        agentState.last_activity = new Date().toISOString();
                        agentState.current_task = `Processing: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;
                        
                        await fs.writeFile(agentStatePath, JSON.stringify(agentState, null, 2));
                    } catch (error) {
                        console.warn('Could not update agent state:', error);
                    }
                    
                    // Send initial status
                    controller.enqueue(encoder.encode('data: {"type":"start","status":"processing"}\n\n'));
                    
                    // Generate agent response with streaming
                    const responseStream = await agentService.generateStreamingResponse(workspaceId, agentId, message, conversation.messages, model as 'claude' | 'gemini');
                    
                    let fullResponse = '';
                    const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    // Stream the response
                    for await (const chunk of responseStream) {
                        fullResponse += chunk;
                        
                        // Send chunk to client with proper escaping
                        const escapedChunk = chunk
                            .replace(/\\/g, '\\\\')  // Escape backslashes first
                            .replace(/"/g, '\\"')    // Escape quotes
                            .replace(/\n/g, '\\n')   // Escape newlines
                            .replace(/\r/g, '\\r')   // Escape carriage returns
                            .replace(/\t/g, '\\t');  // Escape tabs
                        controller.enqueue(encoder.encode(`data: {"type":"chunk","content":"${escapedChunk}"}\n\n`));
                        
                        // Add small delay to prevent overwhelming the client
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    
                    // Save the complete assistant response
                    const assistantMessage: ConversationMessage = {
                        id: assistantMessageId,
                        timestamp: new Date().toISOString(),
                        role: 'assistant',
                        content: fullResponse,
                        metadata: { backend: 'streaming', success: true }
                    };
                    
                    conversation.messages.push(assistantMessage);
                    conversation.updated_at = new Date().toISOString();
                    
                    // Save updated conversation
                    await fs.writeFile(conversationPath, JSON.stringify(conversation, null, 2));
                    
                    // Update agent state to idle
                    try {
                        const agentStateData = await fs.readFile(agentStatePath, 'utf-8');
                        const agentState = JSON.parse(agentStateData);
                        
                        agentState.status = 'idle';
                        agentState.last_activity = new Date().toISOString();
                        agentState.interaction_count = (agentState.interaction_count || 0) + 1;
                        agentState.current_task = null;
                        
                        await fs.writeFile(agentStatePath, JSON.stringify(agentState, null, 2));
                    } catch (error) {
                        console.warn('Could not update agent state:', error);
                    }
                    
                    // Send completion signal
                    controller.enqueue(encoder.encode(`data: {"type":"complete","message_id":"${assistantMessageId}"}\n\n`));
                    
                    // Add a small delay before closing to ensure all data is sent
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    console.error('Streaming error:', error);
                    const escapedError = (error as Error).message
                        .replace(/\\/g, '\\\\')
                        .replace(/"/g, '\\"')
                        .replace(/\n/g, '\\n')
                        .replace(/\r/g, '\\r')
                        .replace(/\t/g, '\\t');
                    controller.enqueue(encoder.encode(`data: {"type":"error","error":"${escapedError}"}\n\n`));
                    
                    // Add delay for error case too
                    await new Promise(resolve => setTimeout(resolve, 100));
                } finally {
                    // Close the stream gracefully
                    try {
                        controller.close();
                    } catch (closeError) {
                        // Stream might already be closed, ignore the error
                        console.warn('Stream close warning (expected):', closeError);
                    }
                }
            }
        });
        
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
        
    } catch (error) {
        console.error('Failed to process streaming message:', error);
        return NextResponse.json(
            { error: 'Failed to process message' },
            { status: 500 }
        );
    }
}