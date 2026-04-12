// Streaming proxy for /api/upload.
//
// We can't rely on the next.config.ts `rewrites()` proxy here because it caps
// request bodies at 10 MB and our client allows uploads up to 100 MB. App
// Router Route Handlers don't have that cap, so we forward the request body
// directly to the FastAPI backend without buffering it in memory.

export const runtime = 'nodejs';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:9100';

export async function POST(request: Request): Promise<Response> {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const contentLength = request.headers.get('content-length');
  if (contentLength) headers.set('content-length', contentLength);

  const backendResponse = await fetch(`${BACKEND_URL}/api/upload`, {
    method: 'POST',
    headers,
    body: request.body,
    // `duplex: 'half'` is required by undici when streaming a request body.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  const responseHeaders = new Headers();
  const responseContentType = backendResponse.headers.get('content-type');
  if (responseContentType) responseHeaders.set('content-type', responseContentType);

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}
