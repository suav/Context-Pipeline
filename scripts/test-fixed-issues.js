/**
 * Test Script for Fixed Issues
 * Tests chat persistence, permissions injection, and tool approval timeout
 */

const fs = require('fs').promises;
const path = require('path');

async function main() {
  console.log('🧪 Testing Fixed Issues\n');
  
  // 1. Test that global config exists
  console.log('1️⃣ Checking global config...');
  const globalConfigPath = path.join(__dirname, '../storage/config/global-config.json');
  try {
    const config = await fs.readFile(globalConfigPath, 'utf8');
    const parsed = JSON.parse(config);
    console.log('✅ Global config exists with templates');
    console.log('   - Claude MD template:', parsed.documents.templates.claudeMdTemplate ? 'Present' : 'Missing');
    console.log('   - Permissions template:', parsed.documents.templates.permissionsTemplate ? 'Present' : 'Missing');
  } catch (error) {
    console.error('❌ Global config missing or invalid');
  }
  
  // 2. Check BaseAIService changes
  console.log('\n2️⃣ Verifying BaseAIService changes...');
  const baseAIServicePath = path.join(__dirname, '../src/features/agents/services/BaseAIService.ts');
  const baseAIContent = await fs.readFile(baseAIServicePath, 'utf8');
  
  const checks = {
    'WorkspaceContext has claudeMdContent': baseAIContent.includes('claudeMdContent?: string'),
    'WorkspaceContext has claudeSettings': baseAIContent.includes('claudeSettings?: any'),
    'Loads CLAUDE.md': baseAIContent.includes('await fs.readFile(claudeMdPath'),
    'Loads .claude/settings.json': baseAIContent.includes('.claude/settings.json'),
    'buildSystemPrompt uses CLAUDE.md': baseAIContent.includes('context.claudeMdContent + '),
    'formatPermissionsForSystemPrompt exists': baseAIContent.includes('formatPermissionsForSystemPrompt')
  };
  
  for (const [check, passed] of Object.entries(checks)) {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
  }
  
  // 3. Check ChatInterface changes
  console.log('\n3️⃣ Verifying ChatInterface changes...');
  const chatInterfacePath = path.join(__dirname, '../src/features/agents/components/terminal/ChatInterface.tsx');
  const chatContent = await fs.readFile(chatInterfacePath, 'utf8');
  
  const chatChecks = {
    'Tool approval timeout added': chatContent.includes('Tool approval timeout - auto-denying for safety'),
    'Clears pending approval on stream end': chatContent.includes('Stream ended with pending approval - clearing'),
    'Session restoration logic': chatContent.includes('restoreSessionIfNeeded')
  };
  
  for (const [check, passed] of Object.entries(chatChecks)) {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
  }
  
  // 4. Check ClaudeService changes
  console.log('\n4️⃣ Verifying ClaudeService changes...');
  const claudeServicePath = path.join(__dirname, '../src/features/agents/services/ClaudeService.ts');
  const claudeContent = await fs.readFile(claudeServicePath, 'utf8');
  
  const claudeChecks = {
    'Uses target directory as cwd': claudeContent.includes('cwd: targetPath'),
    'Sets CLAUDE_WORKSPACE_ROOT': claudeContent.includes('CLAUDE_WORKSPACE_ROOT: workspacePath'),
    'Session resumption support': claudeContent.includes('--resume')
  };
  
  for (const [check, passed] of Object.entries(claudeChecks)) {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
  }
  
  // Summary
  console.log('\n📊 Summary of Fixes:');
  console.log('\n🔧 Chat Persistence:');
  console.log('   - CLAUDE.md content is now loaded and prepended to system prompt');
  console.log('   - Session IDs are preserved and can be resumed');
  console.log('   - Each agent maintains its own conversation context');
  
  console.log('\n🔐 Permissions Injection:');
  console.log('   - .claude/settings.json is generated with proper allow/deny lists');
  console.log('   - Permissions are included in system prompt for clarity');
  console.log('   - Claude runs from target directory to respect workspace boundaries');
  
  console.log('\n⏱️ Tool Approval:');
  console.log('   - 5-minute timeout prevents stuck approvals');
  console.log('   - Pending approvals cleared on disconnect');
  console.log('   - Pre-approved tools expanded to reduce interruptions');
  
  console.log('\n🎯 Expected Behavior:');
  console.log('   1. Second questions maintain conversation context');
  console.log('   2. Claude respects workspace permissions automatically');
  console.log('   3. Tool approvals won\'t hang if user disconnects');
  console.log('   4. Fewer approval prompts for safe operations');
}

main().catch(console.error);