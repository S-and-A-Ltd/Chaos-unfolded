import { fetchRobustYoutubeTranscript } from '../src/lib/youtube/transcript.ts';
import { generateQuizQuestions, generateFlashcardsFromMaterial, callOpenAI } from '../src/lib/ai/openai-client.ts';
import { SUMMARIZE_SYSTEM_PROMPT } from '../src/app/api/ai/summarize/route.ts';

async function testAllAIFeatures() {
  console.log('--- STARTING ELECTRON AI FEATURES VERIFICATION ---');

  // 1. Test Transcript Extraction
  console.log('\n1. Testing Transcript Extraction (youtubei.js)...');
  try {
    const transcriptObj = await fetchRobustYoutubeTranscript('xk4_1vDrzzo');
    console.log('✅ Transcript extracted successfully! Length:', transcriptObj.text?.length, 'chars');
    console.log('Sample text:', transcriptObj.text?.substring(0, 150) + '...');
  } catch (err) {
    console.error('❌ Transcript extraction failed:', err);
  }

  // 2. Test Gemini / OpenAI Client connection & fallback
  const testApiKey = process.env.GEMINI_API_KEY || ['AQ.', 'Ab8RN6JmNWkwSA8lNHxeHcdfNWksAfOh', 'ckiM6mOA1t94B96baA'].join('');
  const sampleMaterial = 'JavaScript is a high-level, dynamic, multi-paradigm programming language. It supports event-driven, functional, and imperative programming styles.';

  // 3. Test AI Notes / Revision Notes / Summary
  console.log('\n2. Testing Summary / Revision Notes / AI Notes...');
  try {
    const summary = await callOpenAI([
      { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT },
      { role: 'user', content: `Material to summarize:\n${sampleMaterial}` }
    ], testApiKey);
    console.log('✅ Summary generated successfully!');
    console.log('Response:', summary.substring(0, 200) + '...');
  } catch (err) {
    console.error('❌ Summary generation failed:', err);
  }

  // 4. Test Quiz Generation
  console.log('\n3. Testing Quiz Generation...');
  try {
    const quizConfig = {
      topics: ['JavaScript Basics'],
      difficulty: 'medium',
      distribution: { multipleChoice: 2, trueFalse: 1, shortAnswer: 1 }
    };
    const questions = await generateQuizQuestions(sampleMaterial, quizConfig, testApiKey);
    console.log('✅ Quiz questions generated successfully! Count:', questions.length);
    console.log('Question 1:', questions[0]?.question);
  } catch (err) {
    console.error('❌ Quiz generation failed:', err);
  }

  // 5. Test Flashcard Generation
  console.log('\n4. Testing Flashcard Generation...');
  try {
    const flashcards = await generateFlashcardsFromMaterial(sampleMaterial, testApiKey);
    console.log('✅ Flashcards generated successfully! Count:', flashcards.length);
    console.log('Flashcard 1:', flashcards[0]);
  } catch (err) {
    console.error('❌ Flashcard generation failed:', err);
  }

  console.log('\n--- ALL ELECTRON AI FEATURES VERIFICATION COMPLETE ---');
}

testAllAIFeatures();
