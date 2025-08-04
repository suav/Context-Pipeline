import { NextRequest, NextResponse } from 'next/server';
export async function GET(request: NextRequest) {
    try {
        // Get the base URL from the request
        const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
        // Forward the request to the main workspaces API
        const response = await fetch(`${baseUrl}/api/workspaces`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (response.ok) {
            const data = await response.json();
            return NextResponse.json(data);
        } else {
            const errorText = await response.text();
            return NextResponse.json(
                { error: 'Failed to fetch workspaces', details: errorText },
                { status: response.status }
            );
        }
    } catch (error) {
        console.error('Context workflow workspaces error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
        // Forward POST requests to the main workspaces API
        const response = await fetch(`${baseUrl}/api/workspaces`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (response.ok) {
            const data = await response.json();
            return NextResponse.json(data);
        } else {
            const errorText = await response.text();
            return NextResponse.json(
                { error: 'Failed to create workspace', details: errorText },
                { status: response.status }
            );
        }
    } catch (error) {
        console.error('Context workflow workspaces POST error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}