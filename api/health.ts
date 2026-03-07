import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { createRequire } from "node:module";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

type NodeApiRequest = IncomingMessage & {
  method?: string;
  url?: string;
  headers: IncomingHttpHeaders;
};

const require = createRequire(import.meta.url);

export default async function handler(
  req: NodeApiRequest,
  res: ServerResponse,
): Promise<void> {
  const request = toWebRequest(req);
  const response = await handleRequest(request);
  await sendWebResponse(response, res);
}

async function handleRequest(request: Request): Promise<Response> {
  console.log("health endpoint hit", {
    method: request.method,
    path: "/api/health",
    time: new Date().toISOString(),
  });

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const checks: Record<string, unknown> = {
    openaiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_QUIZ_MODEL ?? "gpt-4.1-mini",
  };

  try {
    await import("../lib/buildPrompt.js");
    checks.buildPromptImport = "ok";
  } catch (error) {
    checks.buildPromptImport = "failed";
    checks.error = `buildPrompt import failed: ${toErrorMessage(error)}`;
    return jsonResponse({ ok: false, checks }, 500);
  }

  try {
    require.resolve("pdf-parse/lib/pdf-parse.js");
    checks.pdfParseResolve = "ok";
  } catch (error) {
    checks.pdfParseResolve = "failed";
    checks.error = `pdf-parse resolve failed: ${toErrorMessage(error)}`;
    return jsonResponse({ ok: false, checks }, 500);
  }

  return jsonResponse(
    {
      ok: true,
      checks,
      timestamp: new Date().toISOString(),
    },
    200,
  );
}

function toWebRequest(req: NodeApiRequest): Request {
  const method = (req.method ?? "GET").toUpperCase();
  const headers = toWebHeaders(req.headers);
  const host =
    headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost";
  const protocol = headers.get("x-forwarded-proto") ?? "https";
  const requestUrl = `${protocol}://${host}${req.url ?? "/"}`;

  return new Request(requestUrl, { method, headers });
}

function toWebHeaders(headers: IncomingHttpHeaders): Headers {
  const webHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        webHeaders.append(key, item);
      }
      continue;
    }

    if (typeof value === "string") {
      webHeaders.set(key, value);
    }
  }

  return webHeaders;
}

async function sendWebResponse(
  response: Response,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  try {
    const body = Buffer.from(await response.arrayBuffer());
    res.end(body);
  } catch (error) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        ok: false,
        error: `Failed to serialize response: ${toErrorMessage(error)}`,
      }),
    );
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function jsonResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
