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

async function translateTextToEnglish(text) {
  if (!genAI || !text) return text;
  const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const prompt = `Translate the following text into English. 
If it is already in English, return exactly the same text. 
Return ONLY the final translated string, with no quotation marks or commentary.

Text: "${text}"`;

  try {
    const result = await textModel.generateContent(prompt);
    return (await result.response).text().trim();
  } catch (error) {
    console.error("[Gemini AI Translation Error]", error.message);
    return text; // fallback to original
  }
}

async function generateEventDebrief(messages) {
  if (!genAI) {
    return 'AI Debrief unavailable (missing GEMINI_API_KEY).';
  }
  
  // Use a text-only generative model without the application/json constraint
  const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  
  // Sanitize down the messages to just what's needed to preserve tokens
  const simplifiedLogs = messages.map(m => ({
    time: m.time,
    urgencyLevel: m.urgencyLevel,
    section: m.section,
    triangulation: m.triangulation || 'unknown',
    message: m.message,
    translation: m.translation,
    resolved: m.resolved,
  }));

  const prompt = `You are a Chief Security Officer for a massive event. 
I am providing you with the logs of all emergencies that occurred today.
Write a highly professional, 1 to 2 paragraph "Event Post-Mortem Debrief" summarizing the incidents, the primary zones affected (using the Section and Triangulation data), and the overall threat level of the event.
Write it in a human, executive summary style. Use simple Markdown formatting.

Emergency Logs:
${JSON.stringify(simplifiedLogs, null, 2)}`;

  try {
    const result = await textModel.generateContent(prompt);
    return (await result.response).text();
  } catch (error) {
    console.error("[Gemini AI Error]", error.message);
    return 'Failed to generate AI debrief due to server error.';
  }
}

module.exports = { analyzeMessageWithGemini, generateEventDebrief, translateTextToEnglish };
