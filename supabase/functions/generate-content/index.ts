/// <reference path="../deno-shim.d.ts" />

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { prompt } = await req.json()
        if (!prompt || typeof prompt !== 'string') {
            return new Response(JSON.stringify({ error: 'Missing or invalid prompt' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY')
        const openRouterModel = Deno.env.get('OPENROUTER_MODEL') ?? 'openai/gpt-4o-mini'
        if (!openRouterApiKey) {
            throw new Error('OPENROUTER_API_KEY must be set')
        }

        const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openRouterApiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://contentspark.local',
                'X-Title': 'ContentSpark'
            },
            body: JSON.stringify({
                model: openRouterModel,
                temperature: 0.8,
                messages: [
                    {
                        role: 'system',
                        content: `You are a senior social media strategist who generates content ideas for creators and brands.

Output rules:
- Return raw JSON only. No markdown fences, no commentary, no fields beyond the schema.
- Match the language specified in the user message exactly.
- Each of the 6 ideas must be distinct in angle, format, and emotional driver. Do not restate the same concept with different wording.

Quality bar:
- Specific over generic. Anchor ideas to concrete situations, numbers, objects, or sensory details, not abstractions.
- Hook lands in the first 7 words. Banned openers: "Você sabia que", "Hoje vou falar sobre", "Imagine se", "Sabe quando".
- Caption reads like a human wrote it. Avoid AI tells: jornada, desbloquear, mergulhar, transformador, no fundo, é mais do que, em um mundo onde.
- CTA asks for one specific action. No "siga para mais conteúdo".
- Hashtags mix high-volume, mid-volume, and niche tags. Skip irrelevant trend tags.

Variety requirements across the 6 ideas:
- Mix formats: at least one carrossel, one reels, one foto única, one texto/storytelling.
- Mix emotional drivers: curiosidade, identificação, conflito, ensino, opinião forte, vulnerabilidade.

JSON schema (return exactly this shape):
{
  "ideas": [
    {
      "title": string,
      "hook": string,
      "description": string,
      "caption": string,
      "cta": string,
      "hashtags": string,
      "platforms": string[],
      "format": "carrossel" | "reels" | "foto" | "texto" | "story"
    }
  ]
}`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        })

        const openRouterPayload = await openRouterResponse.json()
        if (!openRouterResponse.ok) {
            return new Response(JSON.stringify({
                error: openRouterPayload?.error?.message ?? 'OpenRouter request failed',
                provider_status: openRouterResponse.status,
            }), {
                status: openRouterResponse.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const text = openRouterPayload?.choices?.[0]?.message?.content
        if (!text) {
            throw new Error('OpenRouter returned an empty response')
        }

        return new Response(JSON.stringify({ text }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
