import type { AIMessage } from '@/types';

function isGoogleGeminiKey(apiKey: string): boolean {
  if (!apiKey) return false;
  const k = apiKey.trim();
  if (k.startsWith('AIza') || k.startsWith('AQ.')) return true;
  if (!k.startsWith('sk-')) return true;
  return false;
}

async function callGoogleGeminiAPI(
  messages: AIMessage[],
  apiKey: string,
  temperature: number = 0.7,
  responseFormat?: 'json_object'
): Promise<string> {
  const fullText = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;

  const generationConfig: any = {
    temperature,
    maxOutputTokens: 8192,
  };
  if (responseFormat === 'json_object') {
    generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: fullText }],
        },
      ],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[Nemotron:Gemini] API Error:', errorText);
    throw new Error(`Google Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) {
    throw new Error('Google Gemini API returned empty response');
  }
  return content;
}

// Using OpenRouter since the provided key is an OpenRouter key (sk-or-...)
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'nvidia/llama-3.1-nemotron-70b-instruct'; // Default Nemotron on OpenRouter

export async function callNemotron(
  messages: AIMessage[],
  apiKey: string,
  options: {
    temperature?: number;
    responseFormat?: 'json_object';
    model?: string;
  } = {}
): Promise<string> {
  const { temperature = 0.7, responseFormat, model = DEFAULT_MODEL } = options;

  if (isGoogleGeminiKey(apiKey)) {
    console.log('[AI:Nemotron] Detected Google Gemini API key — calling Google AI Studio API directly');
    return callGoogleGeminiAPI(messages, apiKey, temperature, responseFormat);
  }

  const body: any = {
    model,
    messages,
    temperature,
  };

  if (responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000', // Required by OpenRouter
      'X-Title': 'Dazai Study Companion', // Required by OpenRouter
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Nemotron API Error:', errorData);
    throw new Error(`Nemotron API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
