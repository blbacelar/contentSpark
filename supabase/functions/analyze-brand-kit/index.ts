
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file')

        if (!file) {
            throw new Error('No file provided')
        }

        const apiKey = Deno.env.get('GOOGLE_API_KEY')
        if (!apiKey) {
            throw new Error('GOOGLE_API_KEY not set')
        }

        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" })

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))

        const prompt = `
    Analyze this Brand Kit PDF. 
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
  `

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64,
                    mimeType: file.type || 'application/pdf',
                },
            },
        ])

        const response = await result.response
        const text = response.text()

        // Clean markdown if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()
        const data = JSON.parse(jsonStr)

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
