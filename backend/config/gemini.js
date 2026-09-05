const { GoogleGenAI } = require("@google/genai");
require("dotenv").config({ path: __dirname + "/../.env" });

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

module.exports = ai;
