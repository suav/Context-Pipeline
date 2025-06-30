/**
 * Force Clear API - Aggressively clears all invalid library items
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const LIBRARY_DIR = path.join(process.cwd(), 'storage', 'context-library');

export async function GET(request: NextRequest) {
    try {
        // Return a page that force-clears localStorage
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Force Clear Invalid Items</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                .btn { background: #dc2626; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin: 5px; }
                .btn:hover { background: #b91c1c; }
                .btn-green { background: #059669; }
                .btn-green:hover { background: #047857; }
                .info { background: #fef3c7; padding: 16px; border-radius: 6px; margin: 16px 0; border: 1px solid #fbbf24; }
                #result { margin-top: 20px; padding: 16px; border-radius: 6px; }
                .success { background: #d1fae5; color: #065f46; border: 1px solid #10b981; }
                .error { background: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }
                pre { background: #f3f4f6; padding: 12px; border-radius: 4px; overflow-x: auto; }
                .item-preview { background: #fff; border: 1px solid #e5e7eb; padding: 8px; margin: 4px 0; border-radius: 4px; font-size: 12px; }
            </style>
        </head>
        <body>
            <h1>🧹 Force Clear Invalid Library Items</h1>
            
            <div class="info">
                <p><strong>⚠️ Warning:</strong> This will aggressively clean your library!</p>
                <ul>
                    <li>Removes ALL items without valid ID, title, or source</li>
                    <li>Clears items with "undefined" values</li>
                    <li>Deletes corrupted or malformed items</li>
                    <li>Cannot be undone!</li>
                </ul>
            </div>
            
            <button class="btn" onclick="forceClear()">🗑️ Force Clear All Invalid Items</button>
            <button class="btn btn-green" onclick="showCurrentItems()">👁️ Show Current Items</button>
            <button class="btn btn-green" onclick="window.location.reload()">🔄 Refresh Page</button>
            
            <div id="result"></div>
            
            <script>
            function showCurrentItems() {
                try {
                    const items = JSON.parse(localStorage.getItem('context-library') || '[]');
                    let html = '<h3>Current Items in localStorage:</h3>';
                    html += '<p>Total items: ' + items.length + '</p>';
                    
                    items.forEach((item, index) => {
                        const isValid = item && item.id && item.title && item.source && 
                                      item.id !== 'undefined' && item.title !== 'undefined';
                        
                        html += '<div class="item-preview" style="' + (isValid ? '' : 'background: #fee2e2;') + '">';
                        html += '<strong>#' + index + '</strong> ';
                        html += 'ID: ' + (item?.id || 'MISSING') + ' | ';
                        html += 'Title: ' + (item?.title || 'MISSING') + ' | ';
                        html += 'Source: ' + (item?.source || 'MISSING') + ' | ';
                        html += 'Valid: ' + (isValid ? '✅' : '❌');
                        html += '</div>';
                    });
                    
                    document.getElementById('result').innerHTML = html;
                } catch (error) {
                    document.getElementById('result').innerHTML = '<div class="error">Error: ' + error.message + '</div>';
                }
            }
            
            function forceClear() {
                try {
                    const items = JSON.parse(localStorage.getItem('context-library') || '[]');
                    console.log('🔍 Current items:', items);
                    
                    // AGGRESSIVE filtering - only keep items that are 100% valid
                    const validItems = items.filter((item, index) => {
                        // Log each item for debugging
                        console.log('Checking item ' + index + ':', item);
                        
                        // Must have item object
                        if (!item || typeof item !== 'object') {
                            console.log('❌ Item ' + index + ' is not an object');
                            return false;
                        }
                        
                        // Must have valid ID
                        if (!item.id || typeof item.id !== 'string' || item.id === 'undefined' || item.id.trim() === '') {
                            console.log('❌ Item ' + index + ' has invalid ID:', item.id);
                            return false;
                        }
                        
                        // Must have valid title
                        if (!item.title || typeof item.title !== 'string' || item.title === 'undefined' || item.title.trim() === '') {
                            console.log('❌ Item ' + index + ' has invalid title:', item.title);
                            return false;
                        }
                        
                        // Must have valid source
                        if (!item.source || typeof item.source !== 'string' || item.source === 'undefined' || item.source.trim() === '') {
                            console.log('❌ Item ' + index + ' has invalid source:', item.source);
                            return false;
                        }
                        
                        console.log('✅ Item ' + index + ' is valid');
                        return true;
                    });
                    
                    const removedCount = items.length - validItems.length;
                    
                    // FORCE SAVE the cleaned array
                    localStorage.setItem('context-library', JSON.stringify(validItems));
                    
                    // Also try to clear any corrupted data by removing and re-adding
                    localStorage.removeItem('context-library');
                    localStorage.setItem('context-library', JSON.stringify(validItems));
                    
                    document.getElementById('result').innerHTML = 
                        '<div class="success">' +
                        '<h3>✅ Force Clear Complete!</h3>' +
                        '<p><strong>Before:</strong> ' + items.length + ' items</p>' +
                        '<p><strong>After:</strong> ' + validItems.length + ' items</p>' +
                        '<p><strong>Removed:</strong> ' + removedCount + ' invalid items</p>' +
                        '<p><em>Refresh your application now to see the changes.</em></p>' +
                        '</div>';
                    
                    // Auto-refresh after 2 seconds
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                    
                } catch (error) {
                    console.error('Force clear error:', error);
                    document.getElementById('result').innerHTML = 
                        '<div class="error">' +
                        '<h3>❌ Error</h3>' +
                        '<p>' + error.message + '</p>' +
                        '</div>';
                }
            }
            
            // Auto-show current items on load
            showCurrentItems();
            </script>
        </body>
        </html>
        `;

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html',
            }
        });

    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to generate force clear page' },
            { status: 500 }
        );
    }
}