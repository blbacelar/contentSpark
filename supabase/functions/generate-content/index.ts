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
                        content: 'You generate content ideas as valid JSON only. Return only raw JSON with no markdown fences or commentary.'
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
