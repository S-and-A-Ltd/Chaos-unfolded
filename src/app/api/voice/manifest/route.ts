import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const dirPath = path.join(process.cwd(), 'public', 'audio', 'voice', 'dazai');
  const manifest: Record<string, string[]> = {
    happy: [],
    proud: [],
    excited: [],
    neutral: [],
    concerned: [],
    annoyed: [],
    disappointed: [],
    motivated: [],
    greeting: [],
    distraction: [],
  };

  try {
    if (fs.existsSync(dirPath)) {
      const emotions = fs.readdirSync(dirPath);
      for (const emotion of emotions) {
        const emotionPath = path.join(dirPath, emotion);
        const stat = fs.statSync(emotionPath);
        if (stat.isDirectory()) {
          const files = fs.readdirSync(emotionPath);
          // Filter only audio files (mp3, wav, ogg, m4a)
          const audioFiles = files.filter(file => 
            ['.mp3', '.wav', '.ogg', '.m4a'].includes(path.extname(file).toLowerCase())
          );
          manifest[emotion] = audioFiles;
        }
      }
    } else {
      // Ensure the folders exist so the user knows they are supported
      const emotionsList = Object.keys(manifest);
      for (const emotion of emotionsList) {
        const p = path.join(dirPath, emotion);
        fs.mkdirSync(p, { recursive: true });
      }
    }
  } catch (err) {
    console.error('Error reading voice manifest:', err);
  }

  return NextResponse.json(manifest);
}
