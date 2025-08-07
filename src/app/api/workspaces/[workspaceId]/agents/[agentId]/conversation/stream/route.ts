import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import * as path from 'path';
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
        const { message, model, userMessageId, timestamp } = body;
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
        // Check if user message already exists (from frontend save)
        const existingUserMessage = conversation.messages.find((msg: ConversationMessage) => msg.id === userMessageId);
        
        if (!existingUserMessage && userMessageId) {
            // Add user message only if it doesn't exist yet
            const userMessage: ConversationMessage = {
                id: userMessageId,
                timestamp: timestamp || new Date().toISOString(),
                role: 'user',
                content: message.trim()
            };
            
            conversation.messages.push(userMessage);
            conversation.updated_at = new Date().toISOString();
            
            // Save conversation with user message
            await fs.writeFile(conversationPath, JSON.stringify(conversation, null, 2));
        }
        // Create a streaming response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Update agent state to active
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
                        agentState.current_task = `Processing: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;
                        // Ensure states directory exists
                        await fs.mkdir(path.dirname(agentStatePath), { recursive: true });
                        await fs.writeFile(agentStatePath, JSON.stringify(agentState, null, 2));
                    } catch (error) {
                        console.warn('Could not update agent state:', error);
                    }
                    // Send initial status
                    controller.enqueue(encoder.encode('data: {"type":"start","status":"processing"}\n\n'));
                    // Generate agent response with streaming
                    const responseStream = await agentService.generateStreamingResponse(workspaceId, agentId, message, conversation.messages, model as 'claude' | 'gemini');
                    let fullResponse = '';
                    let sessionData: any = null;
                    let toolUses: any[] = [];
                    let toolResults: any[] = [];
                    let usageData: any = null;
                    let resultData: any = null;
                    const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    // Stream the response
                    for await (const chunk of responseStream) {
                        // Check if this is a metadata chunk
                        if (chunk.includes('<<<CLAUDE_METADATA:') && chunk.includes('>>>')) {
                            // Parse and store metadata
                            const metadataMatch = chunk.match(/<<<CLAUDE_METADATA:(\w+):(.*?)>>>/);
                            if (metadataMatch) {
                                const [, metadataType, metadataContent] = metadataMatch;
                                try {
                                    const parsedMetadata = JSON.parse(metadataContent);
                                    switch (metadataType) {
                                        case 'SYSTEM':
                                            sessionData = parsedMetadata;
                                            break;
                                        case 'USAGE':
                                            usageData = parsedMetadata;
                                            break;
                                        case 'TOOL_USE':
                                            toolUses.push(parsedMetadata);
                                            break;
                                        case 'TOOL_RESULT':
                                            toolResults.push(parsedMetadata);
                                            break;
                                        case 'RESULT':
                                            resultData = parsedMetadata;
                                            break;
                                    }
                                } catch (e) {
                                    console.warn('Failed to parse metadata:', e);
                                }
                            }
                            // Send metadata to client but don't add to fullResponse
                            const escapedChunk = chunk
                                .replace(/\\/g, '\\\\')  // Escape backslashes first
                                .replace(/"/g, '\\"')    // Escape quotes
                                .replace(/\n/g, '\\n')   // Escape newlines
                                .replace(/\r/g, '\\r')   // Escape carriage returns
                                .replace(/\t/g, '\\t');  // Escape tabs
                            controller.enqueue(encoder.encode(`data: {"type":"chunk","content":"${escapedChunk}"}\n\n`));
                        } else {
                            // This is actual content - add to fullResponse AND send to client
                            fullResponse += chunk;
                            // Send chunk to client with proper escaping
                            const escapedChunk = chunk
                                .replace(/\\/g, '\\\\')  // Escape backslashes first
                                .replace(/"/g, '\\"')    // Escape quotes
                                .replace(/\n/g, '\\n')   // Escape newlines
                                .replace(/\r/g, '\\r')   // Escape carriage returns
                                .replace(/\t/g, '\\t');  // Escape tabs
                            controller.enqueue(encoder.encode(`data: {"type":"chunk","content":"${escapedChunk}"}\n\n`));
                        }
                        // Add small delay to prevent overwhelming the client
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    // Save the complete assistant response with comprehensive metadata
                    const assistantMessage: ConversationMessage = {
                        id: assistantMessageId,
                        timestamp: new Date().toISOString(),
                        role: 'assistant',
                        content: fullResponse,
                        metadata: {
                            backend: 'streaming',
                            success: true,
                            session_id: sessionData?.session_id,
                            tools: sessionData?.tools,
                            usage: usageData,
                            tool_uses: toolUses,
                            tool_results: toolResults,
                            result: resultData
                        }
                    };
                    console.log(`[Streaming] Saving assistant response - Length: ${fullResponse.length} chars`);
                    console.log(`[Streaming] First 100 chars: ${fullResponse.substring(0, 100)}`);
                    conversation.messages.push(assistantMessage);
                    conversation.updated_at = new Date().toISOString();
                    // Save updated conversation
                    console.log(`[Streaming] Writing conversation to: ${conversationPath}`);
                    await fs.writeFile(conversationPath, JSON.stringify(conversation, null, 2));
                    console.log(`[Streaming] Conversation saved successfully with ${conversation.messages.length} messages`);
                    // Update agent state to idle and save session ID
                    try {
                        const agentStateData = await fs.readFile(agentStatePath, 'utf-8');
                        const agentState = JSON.parse(agentStateData);
                        agentState.status = 'idle';
                        agentState.last_activity = new Date().toISOString();
                        agentState.interaction_count = (agentState.interaction_count || 0) + 1;
                        agentState.current_task = null;
                        // Save session ID for potential restoration
                        if (sessionData?.session_id) {
                            agentState.last_session_id = sessionData.session_id;
                            agentState.last_session_time = new Date().toISOString();
                            console.log(`💾 Saved session ID ${sessionData.session_id} for agent ${agentId}`);
                        }
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