import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description } = await req.json();
    if (!description || typeof description !== "string" || description.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Please provide a play description (at least 5 characters)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a basketball play interpreter. Given a play description, you MUST output ONLY valid JSON with no markdown, no backticks, no explanation.

The court is 50 units wide (x: -25 to 25) and 94 units long (z: -47 to 47). The offensive basket is at z=47 (near baseline). Center court is z=0.

Output format - a JSON object with these fields:
{
  "name": "Short play name",
  "description": "One-line summary",
  "steps": [
    {
      "step": 1,
      "description": "What happens in this step",
      "players": {
        "O1": { "x": 0, "z": 30, "label": "PG" },
        "O2": { "x": -12, "z": 25, "label": "SG" },
        "O3": { "x": 12, "z": 25, "label": "SF" },
        "O4": { "x": -8, "z": 38, "label": "PF" },
        "O5": { "x": 8, "z": 38, "label": "C" }
      }
    }
  ]
}

Rules:
- Always output exactly 5 steps
- Each step has all 5 offensive players (O1-O5) with x, z coordinates and a label
- O1=PG, O2=SG, O3=SF, O4=PF, O5=C
- Step 1 is the initial formation
- Steps 2-5 show player movement progression
- Keep coordinates within bounds: x in [-25, 25], z in [20, 47] for half-court plays
- Output ONLY the JSON object, nothing else`,
          },
          {
            role: "user",
            content: description.trim().slice(0, 2000),
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    // Strip markdown fences if present
    let jsonStr = rawContent.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI output:", rawContent);
      return new Response(JSON.stringify({ error: "AI returned invalid format. Please try again." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate structure
    if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length < 1) {
      return new Response(JSON.stringify({ error: "AI returned invalid play structure." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-play error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
