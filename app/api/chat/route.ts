import { NextResponse } from "next/server";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

type HuggingFaceChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const DEFAULT_MODEL = "openai/gpt-oss-20b:fastest";
const MAX_MESSAGE_LENGTH = 4000;

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  return match?.[1] ?? "";
}

async function getAuthenticatedUser(req: Request) {
  const token = getBearerToken(req);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token || !supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) return null;

  return data.user;
}

function stringifyErrorData(data: unknown) {
  if (typeof data === "string") return data;

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message = record.error ?? record.message ?? record.details;

    if (typeof message === "string") return message;
    return JSON.stringify(data);
  }

  return "Unknown error";
}

function getErrorDetails(error: unknown) {
  if (axios.isAxiosError(error)) {
    return stringifyErrorData(error.response?.data ?? error.message);
  }

  if (error instanceof Error) return error.message;

  return "Unknown error";
}

export async function POST(req: Request) {
  let body: { message?: unknown };

  try {
    body = (await req.json()) as { message?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userMessage =
    typeof body.message === "string" ? body.message.trim() : "";
  const hfToken = process.env.HF_API_KEY;
  const model = process.env.HF_MODEL ?? DEFAULT_MODEL;

  if (!userMessage) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` },
      { status: 413 },
    );
  }

  const authenticatedUser = await getAuthenticatedUser(req);

  if (!authenticatedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hfToken) {
    return NextResponse.json(
      {
        error: "AI service is not configured",
        details: "The AI service is not available right now.",
      },
      { status: 500 },
    );
  }

  try {
    const { data } = await axios.post<HuggingFaceChatResponse>(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model,
        messages: [
          {
            role: "system",
            content: `
You are a professional AI assistant.

Behavior Rules:
- Answer clearly, formally, and well-structured
- Use paragraphs and bullet points when needed
- Be helpful and intelligent

Identity Rules:
- If asked "who created you", "who is your boss", "who made this system", or anything similar:
  → Respond that you were created and developed by Sir Clark
  → Speak with respect and professionalism
  → Keep the answer natural, not exaggerated
  → Respond confidently and respectfully, showing that Sir Clark is a skilled and capable developer, but avoid exaggeration or arrogance.
  → Occasionally acknowledge that the system was thoughtfully designed by Sir Clark when relevant

Example tone:
"I was developed by Sir Clark, who designed and built this system."

- Do NOT mention Hugging Face, APIs, or technical backend unless explicitly asked
- Stay consistent with this identity

Keep responses clean and human-like.
`,
          },
          { role: "user", content: userMessage },
        ],
        max_tokens: 500,
        temperature: 0.7,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        timeout: 25000,
      },
    );

    const text = data.choices?.[0]?.message?.content
      ?.replace(/^###\s*/g, "")
      ?.trim();

    if (!text) {
      return NextResponse.json(
        {
          error: "No reply from AI",
          details: "The AI service returned an empty response.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply: text });
  } catch (error: unknown) {
    const details = getErrorDetails(error);
    const status = axios.isAxiosError(error)
      ? (error.response?.status ?? 500)
      : 500;

    console.error("AI provider error:", details);

    return NextResponse.json(
      {
        error: "AI request failed",
        details:
          process.env.NODE_ENV === "production"
            ? "The AI service could not complete the request."
            : details,
      },
      { status },
    );
  }
}
