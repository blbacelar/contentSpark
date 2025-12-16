
// const fetch = require('node-fetch'); // REMOVED: Use builtin fetch

async function testWebhook() {
    const url = "https://n8n.bacelardigital.tech/webhook/generate-ideas";
    const payload = {
        "topic": "Digital Marketing Trends 2025",
        "audience": "Marketing Managers",
        "tone": "Professional",
        "user_id": "99c676fd-3c66-4b26-a9e3-a0c41c271ca4",
        "team_id": "a6863edc-5020-4763-ba00-58e2ce1ddf8f",
        "persona": {
            "occupation": "Marketing Strategist",
            "age_range": "30-45",
            "social_networks": "LinkedIn",
            "pains_list": ["Low ROI", "Ad Fatigue"],
            "goals_list": ["Increase Leads", "Brand Awareness"],
            "questions_list": ["How to scale?"]
        },
        "language": "en"
    };

    console.log("Sending payload to:", url);
    console.log(JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImZJZzltbGVNSi9wV0plUXAiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3RjaXF3eGtkdWtmYmZsaGl6aXFsLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI5OWM2NzZmZC0zYzY2LTRiMjYtYTllMy1hMGM0MWMyNzFjYTQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY1OTIyNjk2LCJpYXQiOjE3NjU5MTkwOTYsImVtYWlsIjoiYmxiYWNlbGFyQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJibGJhY2VsYXJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiOTljNjc2ZmQtM2M2Ni00YjI2LWE5ZTMtYTBjNDFjMjcxY2E0In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NjU5MTkwOTZ9XSwic2Vzc2lvbl9pZCI6ImUzOWQzMmYxLTJhMGItNDkzNS1iZTExLWQ1M2VlNTJmODFhMCIsImlzX2Fub255bW91cyI6ZmFsc2V9.pZvf_xtXwKtY5NGQ3fPucEEKUpONjcbi_6ZFgK0HhJM'
            },
            body: JSON.stringify(payload)
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log("Raw Response Body:");
        console.log("---------------------------------------------------");
        console.log(text);
        console.log("---------------------------------------------------");

        try {
            const json = JSON.parse(text);
            console.log("Parsed JSON:", JSON.stringify(json, null, 2));

            // Check validation logic from genai.ts
            if (Array.isArray(json)) {
                console.log("Format Match: Root Array detected.");
            } else if (json && json.ideas && Array.isArray(json.ideas)) {
                console.log("Format Match: { ideas: [...] } detected.");
            } else {
                console.error("Format Mismatch: Expected Array or { ideas: Array }, got something else.");
            }
        } catch (e) {
            console.error("Response is not valid JSON.");
        }

    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

testWebhook();
