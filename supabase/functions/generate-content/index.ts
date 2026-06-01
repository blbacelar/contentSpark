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
        const requestBody = await req.json()
        const {
            prompt,
            topic,
            count,
            tone,
            additionalContext,
            especialidade,
            pilares_conteudo,
            paciente_perfil,
        } = requestBody ?? {}

        const resolvedTopic = typeof topic === 'string' && topic.trim().length > 0
            ? topic.trim()
            : typeof prompt === 'string' && prompt.trim().length > 0
                ? prompt.trim()
                : undefined

        if (!resolvedTopic) {
            return new Response(JSON.stringify({ error: 'Missing or invalid topic' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const parsedCount = typeof count === 'number'
            ? Math.trunc(count)
            : typeof count === 'string' && count.trim().length > 0
                ? Math.trunc(Number(count))
                : 10
        const boundedCount = Number.isFinite(parsedCount)
            ? Math.max(1, Math.min(20, parsedCount))
            : 10

        const safeString = (value: unknown, fallback: string) => {
            if (typeof value !== 'string') return fallback
            const cleaned = value.trim()
            return cleaned.length > 0 ? cleaned : fallback
        }

        const normalizedPillars = Array.isArray(pilares_conteudo)
            ? pilares_conteudo
                .filter((pillar): pillar is string => typeof pillar === 'string')
                .map((pillar) => pillar.trim())
                .filter(Boolean)
            : []

        const userMessage = `Generate ${boundedCount} content ideas for an Instagram-based nutritionist with the following profile:

Specialty: ${safeString(especialidade, 'Nutrição geral')}
Target patient profile: ${safeString(paciente_perfil, 'not specified')}
Content pillars to focus on: ${normalizedPillars.length > 0 ? normalizedPillars.join(', ') : 'any'}
Topic or theme for this batch: ${resolvedTopic}
Tone of voice: ${safeString(tone, 'educativo e acessível')}
Additional context: ${safeString(additionalContext, 'none')}`

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
                        content: `You are a content planning assistant for Brazilian nutritionists who use Instagram to attract patients. You generate content ideas in Brazilian Portuguese only.

HARD RULES — CFN COMPLIANCE:
The Conselho Federal de Nutricionistas (CFN) prohibits the following in professional nutritionist advertising. Never generate ideas that involve:
- Before and after photos or comparisons (antes e depois)
- Guaranteed results or specific outcomes ("emagreça X kg em Y dias", "resultado garantido")
- Comparisons with other professionals
- Testimonials that promise specific results
- Any claim that a diet or supplement cures or treats diseases
- Promotion of unregulated supplements

If a user's input would lead to any of the above, reframe the idea into a compliant angle without mentioning the restriction.

OUTPUT FORMAT:
Return a JSON array. Each idea must have these fields:
- title: string — a specific, compelling post title in Portuguese (not generic)
- description: string — 2-3 sentences explaining the angle and what to include
- format: "carrossel" | "reels" | "stories" — the best Instagram format for this idea
- pillar: string — the content pillar this idea belongs to (e.g., "Educação nutricional", "Bastidores", "Captação de pacientes", "Engajamento")
- cfn_compliant: true — always true; if you can't make an idea compliant, skip it entirely

Generate exactly the number of ideas requested. Make each title specific to the user's specialty and audience — never generic like "5 dicas de alimentação saudável".`
                    },
                    {
                        role: 'user',
                        content: userMessage
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

        const cleanText = text
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```$/, '')
            .trim()

        const normalizeFormat = (value: unknown): 'carrossel' | 'reels' | 'stories' | undefined => {
            if (typeof value !== 'string') return undefined
            const cleaned = value.trim().toLowerCase()
            if (cleaned === 'carrossel' || cleaned === 'reels' || cleaned === 'stories') return cleaned
            if (cleaned === 'story') return 'stories'
            return undefined
        }

        const firstSentence = (value: unknown) => {
            if (typeof value !== 'string') return ''
            const cleaned = value.trim()
            if (!cleaned) return ''
            const sentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim()
            return sentence || cleaned
        }

        const safeIdeaString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

        let ideas: Array<Record<string, unknown>> | undefined
        let ideasParseError: string | undefined
        try {
            const parsed = JSON.parse(cleanText)
            const parsedIdeas = Array.isArray(parsed)
                ? parsed
                : Array.isArray(parsed?.ideas)
                    ? parsed.ideas
                    : undefined

            if (parsedIdeas) {
                ideas = parsedIdeas.map((idea: Record<string, unknown>) => ({
                    title: safeIdeaString(idea.title),
                    hook: safeIdeaString(idea.hook) || firstSentence(idea.description),
                    description: safeIdeaString(idea.description),
                    caption: safeIdeaString(idea.caption) || safeIdeaString(idea.description),
                    cta: safeIdeaString(idea.cta) || 'Comente sua principal duvida sobre esse tema.',
                    hashtags: safeIdeaString(idea.hashtags),
                    platforms: Array.isArray(idea.platforms)
                        ? idea.platforms.filter((platform): platform is string => typeof platform === 'string' && platform.trim().length > 0)
                        : ['Instagram'],
                    format: normalizeFormat(idea.format),
                    pillar: safeIdeaString(idea.pillar),
                    cfn_compliant: idea.cfn_compliant === true,
                })).filter((idea: {
                    title: string
                    description: string
                    format: 'carrossel' | 'reels' | 'stories' | undefined
                    cfn_compliant: boolean
                }) => (
                    idea.title.length > 0
                    && idea.description.length > 0
                    && idea.format !== undefined
                    && idea.cfn_compliant === true
                ))
            }
        } catch (error) {
            ideas = undefined
            ideasParseError = (error as Error).message
        }

        return new Response(JSON.stringify({ text, ideas, ideas_parse_error: ideas ? undefined : ideasParseError }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
