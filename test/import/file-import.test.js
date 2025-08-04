const { FileImporter } = require('../../src/features/context-import/importers/FileImporter');
const { TextImporter } = require('../../src/features/context-import/importers/TextImporter');
// Mock File class for testing
class MockFile {
    constructor(content, name, type) {
        this.content = content;
        this.name = name;
        this.type = type;
        this.size = content.length;
        this.lastModified = Date.now();
    }
    async text() {
        return this.content;
    }
    async arrayBuffer() {
        return new ArrayBuffer(this.content.length);
    }
}
// Test suite for FileImporter
async function testFileImporter() {
    console.log('🧪 Testing FileImporter...');
    try {
        const fileImporter = new FileImporter();
        // Test 1: Text file import
        console.log('  ✅ Test 1: Text file import');
        const textFile = new MockFile('Hello, World!\\nThis is a test file.', 'test.txt', 'text/plain');
        const textResult = await fileImporter.processFile(textFile);
        if (textResult.title === 'File: test' &&
            textResult.content.raw_text === 'Hello, World!\\nThis is a test file.' &&
            textResult.source === 'file') {
            console.log('    ✅ Text file processed correctly');
        } else {
            console.log('    ❌ Text file processing failed', textResult);
        }
        // Test 2: JSON file import
        console.log('  ✅ Test 2: JSON file import');
        const jsonContent = JSON.stringify({name: 'Test', value: 123});
        const jsonFile = new MockFile(jsonContent, 'test.json', 'application/json');
        const jsonResult = await fileImporter.processFile(jsonFile);
        if (jsonResult.content.content_type === 'json' &&
            jsonResult.content.parsed_json.name === 'Test') {
            console.log('    ✅ JSON file processed correctly');
        } else {
            console.log('    ❌ JSON file processing failed', jsonResult);
        }
        // Test 3: Markdown file import
        console.log('  ✅ Test 3: Markdown file import');
        const markdownContent = '# Test Header\\n\\nThis is a **bold** text.';
        const markdownFile = new MockFile(markdownContent, 'test.md', 'text/markdown');
        const markdownResult = await fileImporter.processFile(markdownFile);
        if (markdownResult.content.content_type === 'markdown' &&
            markdownResult.content.headers.length > 0) {
            console.log('    ✅ Markdown file processed correctly');
        } else {
            console.log('    ❌ Markdown file processing failed', markdownResult);
        }
        // Test 4: Multiple file import
        console.log('  ✅ Test 4: Multiple file import');
        const files = [textFile, jsonFile];
        const multiResult = await fileImporter.import(files);
        if (multiResult.success && multiResult.items.length === 2) {
            console.log('    ✅ Multiple files processed correctly');
        } else {
            console.log('    ❌ Multiple file processing failed', multiResult);
        }
        // Test 5: File validation
        console.log('  ✅ Test 5: File validation');
        const oversizedFile = new MockFile('x'.repeat(20 * 1024 * 1024), 'large.txt', 'text/plain'); // 20MB
        try {
            await fileImporter.processFile(oversizedFile);
            console.log('    ❌ Should have failed for oversized file');
        } catch (error) {
            if (error.message.includes('size exceeds limit')) {
                console.log('    ✅ File size validation works correctly');
            } else {
                console.log('    ❌ Unexpected error:', error.message);
            }
        }
        console.log('✅ FileImporter tests completed');
    } catch (error) {
        console.error('❌ FileImporter test error:', error);
    }
}
// Test suite for TextImporter
async function testTextImporter() {
    console.log('🧪 Testing TextImporter...');
    try {
        const textImporter = new TextImporter();
        // Test 1: Plain text import
        console.log('  ✅ Test 1: Plain text import');
        const plainTextResult = await textImporter.import({
            content: 'This is a simple plain text content.',
            title: 'Test Plain Text'
        });
        if (plainTextResult.success &&
            plainTextResult.items.length === 1 &&
            plainTextResult.items[0].content.content_type === 'text') {
            console.log('    ✅ Plain text imported correctly');
        } else {
            console.log('    ❌ Plain text import failed', plainTextResult);
        }
        // Test 2: JSON text import
        console.log('  ✅ Test 2: JSON text import');
        const jsonText = JSON.stringify({test: 'data', numbers: [1, 2, 3]});
        const jsonTextResult = await textImporter.import({
            content: jsonText,
            format: 'json'
        });
        if (jsonTextResult.success &&
            jsonTextResult.items[0].content.content_type === 'json' &&
            jsonTextResult.items[0].content.parsed_json.test === 'data') {
            console.log('    ✅ JSON text imported correctly');
        } else {
            console.log('    ❌ JSON text import failed', jsonTextResult);
        }
        // Test 3: Markdown text import
        console.log('  ✅ Test 3: Markdown text import');
        const markdownText = `# Main Title
## Subtitle
This is **bold** and *italic* text.
### Code Block
\`\`\`javascript
function test() {
    console.log('Hello');
}
\`\`\`
[Link](https://example.com)`;
        const markdownTextResult = await textImporter.import({
            content: markdownText,
            format: 'markdown'
        });
        if (markdownTextResult.success &&
            markdownTextResult.items[0].content.content_type === 'markdown' &&
            markdownTextResult.items[0].content.headers.length > 0 &&
            markdownTextResult.items[0].content.links.length > 0) {
            console.log('    ✅ Markdown text imported correctly');
        } else {
            console.log('    ❌ Markdown text import failed', markdownTextResult);
        }
        // Test 4: Code text import
        console.log('  ✅ Test 4: Code text import');
        const codeText = `function calculateSum(a, b) {
    return a + b;
}
const result = calculateSum(5, 3);
console.log(result);`;
        const codeTextResult = await textImporter.import({
            content: codeText,
            format: 'code'
        });
        if (codeTextResult.success &&
            codeTextResult.items[0].content.content_type === 'code' &&
            codeTextResult.items[0].content.detected_language === 'javascript') {
            console.log('    ✅ Code text imported correctly');
        } else {
            console.log('    ❌ Code text import failed', codeTextResult);
        }
        // Test 5: Auto-detection
        console.log('  ✅ Test 5: Format auto-detection');
        const autoDetectResult = await textImporter.import({
            content: '{"autoDetect": true, "format": "json"}',
            format: 'auto'
        });
        if (autoDetectResult.success &&
            autoDetectResult.items[0].content.content_type === 'json') {
            console.log('    ✅ Auto-detection works correctly');
        } else {
            console.log('    ❌ Auto-detection failed', autoDetectResult);
        }
        // Test 6: Long text chunking
        console.log('  ✅ Test 6: Long text chunking');
        const longText = 'Lorem ipsum '.repeat(10000); // Create long text
        const chunkResult = await textImporter.import({
            content: longText,
            title: 'Long Text Test'
        });
        if (chunkResult.success && chunkResult.items.length > 1) {
            console.log(`    ✅ Long text split into ${chunkResult.items.length} chunks`);
        } else {
            console.log('    ❌ Long text chunking failed', chunkResult);
        }
        // Test 7: Empty content validation
        console.log('  ✅ Test 7: Empty content validation');
        const emptyResult = await textImporter.import({
            content: '',
            title: 'Empty Test'
        });
        if (!emptyResult.success && emptyResult.error.includes('cannot be empty')) {
            console.log('    ✅ Empty content validation works correctly');
        } else {
            console.log('    ❌ Empty content validation failed', emptyResult);
        }
        console.log('✅ TextImporter tests completed');
    } catch (error) {
        console.error('❌ TextImporter test error:', error);
    }
}
// Test API endpoints
async function testApiEndpoints() {
    console.log('🧪 Testing API endpoints...');
    try {
        // Test file upload endpoint info
        console.log('  ✅ Test 1: API info endpoint');
        const response = await fetch('http://localhost:3000/api/context-workflow/import/file');
        if (response.ok) {
            const data = await response.json();
            if (data.message && data.supportedFileTypes) {
                console.log('    ✅ API info endpoint working');
            } else {
                console.log('    ❌ API info endpoint returned unexpected data');
            }
        } else {
            console.log('    ⚠️  API endpoint not available (server might not be running)');
        }
        console.log('✅ API tests completed');
    } catch (error) {
        console.log('    ⚠️  API tests skipped (server not running):', error.message);
    }
}
// Integration tests
async function testIntegration() {
    console.log('🧪 Testing integration scenarios...');
    try {
        // Test file import to library workflow
        console.log('  ✅ Test 1: File import integration');
        const fileImporter = new FileImporter();
        const testFile = new MockFile('# Integration Test\\n\\nThis tests the full workflow.', 'integration.md', 'text/markdown');
        const result = await fileImporter.processFile(testFile);
        // Verify the context item structure
        if (result.id && result.title && result.content && result.metadata && result.tags) {
            console.log('    ✅ Context item structure is valid');
        } else {
            console.log('    ❌ Context item structure is invalid');
        }
        // Test text import integration
        console.log('  ✅ Test 2: Text import integration');
        const textImporter = new TextImporter();
        const textResult = await textImporter.import({
            content: 'Integration test for text import functionality.',
            title: 'Integration Test',
            tags: ['test', 'integration']
        });
        if (textResult.success && textResult.items[0].metadata.title === 'Integration Test') {
            console.log('    ✅ Text import integration works correctly');
        } else {
            console.log('    ❌ Text import integration failed');
        }
        console.log('✅ Integration tests completed');
    } catch (error) {
        console.error('❌ Integration test error:', error);
    }
}
// Main test runner
async function runTests() {
    console.log('🚀 Starting File Import Test Suite');
    console.log('=====================================');
    await testFileImporter();
    console.log('');
    await testTextImporter();
    console.log('');
    await testApiEndpoints();
    console.log('');
    await testIntegration();
    console.log('');
    console.log('=====================================');
    console.log('✅ File Import Test Suite Completed');
}
// Export for use as module or run directly
if (require.main === module) {
    runTests().catch(console.error);
}
module.exports = {
    testFileImporter,
    testTextImporter,
    testApiEndpoints,
    testIntegration,
    runTests
};