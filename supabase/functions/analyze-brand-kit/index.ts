/// <reference path="../deno-shim.d.ts" />

// @ts-ignore -- Resolved by Supabase Edge Function Deno import map in supabase/functions/deno.json
import { getDocument } from "pdfjs-dist"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            throw new Error('No file provided')
        }

        const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY')
        const openRouterModel = Deno.env.get('OPENROUTER_MODEL') ?? 'openai/gpt-4o-mini'
        if (!openRouterApiKey) {
            throw new Error('OPENROUTER_API_KEY must be set')
        }

        const arrayBuffer = await file.arrayBuffer()
        const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise

        const pages: string[] = []
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber)
            const textContent = await page.getTextContent()
            const pageText = textContent.items
                .map((item: any) => item.str ?? '')
                .join(' ')
                .trim()

            if (pageText) {
                pages.push(pageText)
            }
        }

        const extractedText = pages.join('\n\n').trim()
        if (!extractedText) {
            throw new Error('Could not extract text from the PDF')
        }

        const prompt = `
    Analyze the following extracted Brand Kit PDF text.
    Extract the following information into a strictly valid JSON format:
    1. "colors": An array of hex color codes (e.g., ["#FFFFFF", "#000000"]). Extract at least the primary and secondary colors.
    2. "fonts": An object mapping roles to font family names. CRITICAL: Identify at least one font.
       - Roles: "title", "subtitle", "heading", "body", "quote".
       - If only one font is found, assign it to "title" AND "body".
    3. "style": A short descriptive string summarising the visual style (e.g., "Minimalist and clean", "Bold and energetic").

    Return ONLY the JSON. No markdown formatting.
    Example structure:
    {
      "colors": ["#FF0000", "#00FF00"],
      "fonts": { "title": "Roboto", "heading": "Roboto", "body": "Open Sans" },
      "style": "Modern"
    }

    PDF text:
    ${extractedText}
  `

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
                temperature: 0.2,
                messages: [
                    {
                        role: 'system',
                        content: 'You extract structured brand-kit information and return strictly valid raw JSON only.'
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
            throw new Error(openRouterPayload?.error?.message ?? 'OpenRouter request failed')
        }

        const text = openRouterPayload?.choices?.[0]?.message?.content
        if (!text) {
            throw new Error('OpenRouter returned an empty response')
        }

        // Clean markdown if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()
        const data = JSON.parse(jsonStr)

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
