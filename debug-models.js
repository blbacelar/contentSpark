import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const apiKey = process.env.VITE_GOOGLE_API_KEY;

if (!apiKey) {
    console.error("No API KEY found in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        fs.writeFileSync('models_output.json', JSON.stringify(data, null, 2));
        console.log("Wrote models to models_output.json");

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
