import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
    // This endpoint returns JavaScript to clear localStorage
    const clearScript = `
    // Clear invalid items from localStorage
    try {
        console.log('🧹 Clearing invalid library items from localStorage...');
        const currentItems = JSON.parse(localStorage.getItem('context-library') || '[]');
        console.log('Current items before cleaning:', currentItems.length);
        const validItems = currentItems.filter(item =>
            item &&
            item.id &&
            item.source &&
            item.title &&
            typeof item.id === 'string' &&
            typeof item.title === 'string' &&
            item.title !== 'undefined' &&
            item.id !== 'undefined' &&
            item.source !== 'undefined' &&
            item.title.trim() !== '' &&
            item.id.trim() !== ''
        );
        console.log('Valid items after filtering:', validItems.length);
        console.log('Removed items:', currentItems.length - validItems.length);
        localStorage.setItem('context-library', JSON.stringify(validItems));
        alert('✅ Cleared localStorage! Removed ' + (currentItems.length - validItems.length) + ' invalid items. Refresh the page.');
    } catch (error) {
        console.error('Failed to clear localStorage:', error);
        alert('❌ Failed to clear localStorage: ' + error.message);
    }
    `;
    return new NextResponse(clearScript, {
        headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'no-cache'
        }
    });
}
export async function GET(request: NextRequest) {
    // Return HTML page with clear button
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Clear Invalid Library Items</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .btn { background: #ef4444; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
            .btn:hover { background: #dc2626; }
            .info { background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0; }
            #result { margin-top: 20px; padding: 16px; border-radius: 6px; }
            .success { background: #d1fae5; color: #065f46; }
            .error { background: #fee2e2; color: #991b1b; }
        </style>
    </head>
    <body>
        <h1>🧹 Clear Invalid Library Items</h1>
        <div class="info">
            <p><strong>What this does:</strong></p>
            <ul>
                <li>Scans your localStorage for invalid/undefined library items</li>
                <li>Removes items with missing ID, title, or source</li>
                <li>Removes items with "undefined" as their values</li>
                <li>Keeps only valid, properly formatted items</li>
            </ul>
        </div>
        <button class="btn" onclick="clearInvalidItems()">🗑️ Clear Invalid Items</button>
        <div id="result"></div>
        <script>
        function clearInvalidItems() {
            try {
                console.log('🧹 Clearing invalid library items from localStorage...');
                const currentItems = JSON.parse(localStorage.getItem('context-library') || '[]');
                console.log('Current items before cleaning:', currentItems.length);
                const validItems = currentItems.filter(item =>
                    item &&
                    item.id &&
                    item.source &&
                    item.title &&
                    typeof item.id === 'string' &&
                    typeof item.title === 'string' &&
                    item.title !== 'undefined' &&
                    item.id !== 'undefined' &&
                    item.source !== 'undefined' &&
                    item.title.trim() !== '' &&
                    item.id.trim() !== ''
                );
                console.log('Valid items after filtering:', validItems.length);
                const removedCount = currentItems.length - validItems.length;
                localStorage.setItem('context-library', JSON.stringify(validItems));
                document.getElementById('result').innerHTML = \`
                    <div class="success">
                        <h3>✅ Successfully Cleared!</h3>
                        <p><strong>Before:</strong> \${currentItems.length} items</p>
                        <p><strong>After:</strong> \${validItems.length} items</p>
                        <p><strong>Removed:</strong> \${removedCount} invalid items</p>
                        <p><em>Please refresh your application to see the changes.</em></p>
                    </div>
                \`;
            } catch (error) {
                console.error('Failed to clear localStorage:', error);
                document.getElementById('result').innerHTML = \`
                    <div class="error">
                        <h3>❌ Error</h3>
                        <p>Failed to clear localStorage: \${error.message}</p>
                    </div>
                \`;
            }
        }
        </script>
    </body>
    </html>
    `;
    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html',
        }
    });
}