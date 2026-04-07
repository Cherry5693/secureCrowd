const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize the Gemini API client
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Use the recommended model setup
const model = genAI ? genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  generationConfig: {
    responseMimeType: "application/json",
  }
}) : null;

// Simple cache to prevent duplicate backend calls (especially between draft and send)
const mlCache = new Map();
const MAX_CACHE_SIZE = 1000;

/**
 * Calls Gemini to analyze the message urgency and returns the structured payload.
 * Expected to be used as a drop-in replacement for the local Python AI service.
 * @param {string} message - The text message sent by the user.
 * @param {string} section - The section of the event (e.g., 'A', 'B').
 * @returns {Promise<Object>} The parsed urgency classification.
 */
async function analyzeMessageWithGemini(message, section) {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const normalizedMessage = message.trim().toLowerCase();
  
  if (mlCache.has(normalizedMessage)) {
    return mlCache.get(normalizedMessage);
  }

  const prompt = `
You are an AI trained to detect emergencies in crowd scenarios. Analyze the following message sent by an event attendee. 
Determine if it is an emergency and classify it.
Crucially, ALWAYS provide an accurate English translation of the original message. If the message is already in English, just return the exact same message.
Categories allowed: "missing_child", "missing_person", "medical_emergency", "security_threat", "normal".
Severity allowed: "high", "medium", "low". (Use "low" for normal).

Respond strictly with JSON using the following structure:
{
  "emergency": boolean,
  "category": string,
  "confidence": number,
  "severity": string,
  "requires_security": boolean,
  "english_translation": string
}

Message to analyze: "${message}"`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse the JSON response
    const parsed = JSON.parse(text);
    
    // Supplement with timestamp and section
    const payload = {
      timestamp: new Date().toISOString(),
      section: section || "unknown",
      emergency: typeof parsed.emergency === 'boolean' ? parsed.emergency : false,
      category: parsed.category || "normal",
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      severity: parsed.severity || "low",
      requires_security: typeof parsed.requires_security === 'boolean' ? parsed.requires_security : false,
      english_translation: parsed.english_translation || message
    };

    if (mlCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = mlCache.keys().next().value;
      mlCache.delete(oldestKey);
    }
    mlCache.set(normalizedMessage, payload);

    return payload;

  } catch (error) {
    console.error("[Gemini AI Error]", error.message);
    throw new Error('Failed to analyze message with Gemini');
  }
}

module.exports = { analyzeMessageWithGemini };
