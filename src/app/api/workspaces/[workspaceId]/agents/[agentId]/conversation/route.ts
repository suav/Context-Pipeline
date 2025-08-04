/**
 * Agent Conversation API Route
 * Handles chat messages and agent responses
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { agentService } from '../../../../../../../features/agents/services/AgentService';

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
    [key: string]: any;
  };
}

// Handle individual message saving for chunked updates
async function handleMessageSave(workspaceId: string, agentId: string, messageToSave: ConversationMessage) {
    const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
    const conversationPath = path.join(workspacePath, 'agents', 'conversations', `${agentId}.json`);
    
    try {
        // Load existing conversation
        let conversation;
        try {
            const conversationData = await fs.readFile(conversationPath, 'utf-8');
            conversation = JSON.parse(conversationData);
        } catch {
            // Create new conversation if it doesn't exist
            await fs.mkdir(path.dirname(conversationPath), { recursive: true });
            conversation = {
                agent_id: agentId,
                workspace_id: workspaceId,
                created_at: new Date().toISOString(),
                messages: []
            };
        }
        
        // Find existing message with same ID or add new one
        const existingIndex = conversation.messages.findIndex((msg: ConversationMessage) => msg.id === messageToSave.id);
        
        if (existingIndex >= 0) {
            // Update existing message
            conversation.messages[existingIndex] = messageToSave;
            console.log(`📝 Updated existing message: ${messageToSave.id} (${messageToSave.content.length} chars)`);
        } else {
            // Add new message
            conversation.messages.push(messageToSave);
            console.log(`📝 Added new message: ${messageToSave.id} (${messageToSave.content.length} chars)`);
        }
        
        conversation.updated_at = new Date().toISOString();
        
        // Save updated conversation
        await fs.writeFile(conversationPath, JSON.stringify(conversation, null, 2));
        
        return NextResponse.json({ 
            success: true, 
            message: 'Message saved successfully',
            messageId: messageToSave.id
        });
        
    } catch (error) {
        console.error('Failed to save message:', error);
        return NextResponse.json(
            { error: 'Failed to save message' },
            { status: 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; agentId: string }> }
) {
    try {
        const { workspaceId, agentId } = await params;
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        const conversationPath = path.join(workspacePath, 'agents', 'conversations', `${agentId}.json`);
        
        // Check if workspace exists
        try {
            await fs.access(workspacePath);
        } catch {
            return NextResponse.json(
                { error: 'Workspace not found' },
                { status: 404 }
            );
        }
        
        // Load conversation history
        try {
            const conversationData = await fs.readFile(conversationPath, 'utf-8');
            const conversation = JSON.parse(conversationData);
            
            return NextResponse.json({
                success: true,
                messages: conversation.messages || [],
                agent_id: agentId,
                workspace_id: workspaceId
            });
            
        } catch (error) {
            // If no conversation file exists, return empty conversation
            return NextResponse.json({
                success: true,
                messages: [],
                agent_id: agentId,
                workspace_id: workspaceId
            });
        }
        
    } catch (error) {
        console.error('Failed to get conversation:', error);
        return NextResponse.json(
            { error: 'Failed to load conversation' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; agentId: string }> }
) {
    try {
        const { workspaceId, agentId } = await params;
        const body = await request.json();
        const { message, model, messageId, role, timestamp, metadata, saveOnly } = body;
        
        // Check if this is a save-only request (for chunked saving)
        if (saveOnly) {
            return await handleMessageSave(workspaceId, agentId, {
                id: messageId,
                timestamp: timestamp || new Date().toISOString(),
                role: role || 'assistant',
                content: message,
                metadata: metadata
            });
        }
        
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
        
        // Add user message to conversation (use provided messageId if available)
        const userMessage: ConversationMessage = {
            id: messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: timestamp || new Date().toISOString(),
            role: 'user',
            content: message.trim()
        };
        
        conversation.messages.push(userMessage);
        conversation.updated_at = new Date().toISOString();
        
        // Save conversation with user message immediately to prevent history loss
        await fs.writeFile(conversationPath, JSON.stringify(conversation, null, 2));
        
        // Generate agent response using AgentService
        const agentResponse = await agentService.generateResponse(workspaceId, agentId, message, conversation.messages, model as 'claude' | 'gemini');
        
        const assistantMessage: ConversationMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            role: 'assistant',
            content: agentResponse.content,
            metadata: agentResponse.metadata
        };
        
        conversation.messages.push(assistantMessage);
        conversation.updated_at = new Date().toISOString();
        
        // Save updated conversation with assistant response
        await fs.writeFile(conversationPath, JSON.stringify(conversation, null, 2));
        
        // Update agent state
        try {
            let agentState;
            try {
                const agentStateData = await fs.readFile(agentStatePath, 'utf-8');
                agentState = JSON.parse(agentStateData);
            } catch {
                // Create new agent state if file doesn't exist
                agentState = {
                    id: agentId,
                    status: 'idle',
                    created_at: new Date().toISOString(),
                    interaction_count: 0
                };
            }
            
            agentState.status = 'active';
            agentState.last_activity = new Date().toISOString();
            agentState.interaction_count = (agentState.interaction_count || 0) + 1;
            agentState.current_task = `Responding to: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;
            
            // Ensure states directory exists
            await fs.mkdir(path.dirname(agentStatePath), { recursive: true });
            await fs.writeFile(agentStatePath, JSON.stringify(agentState, null, 2));
        } catch (error) {
            console.warn('Could not update agent state:', error);
        }
        
        return NextResponse.json({
            success: true,
            response: assistantMessage.content,
            message_id: assistantMessage.id,
            metadata: assistantMessage.metadata
        });
        
    } catch (error) {
        console.error('Failed to process message:', error);
        return NextResponse.json(
            { error: 'Failed to process message' },
            { status: 500 }
        );
    }
}

