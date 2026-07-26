import type { StudyDocument, QuizQuestion, Flashcard, QuizConfig } from '@/types';

/**
 * ContentPoolManager
 * 
 * Manages cached pools of quiz questions and flashcards for study materials.
 * Implements a 5-generation history filter so users don't encounter repeated
 * questions or flashcards across consecutive study sessions.
 */
export class ContentPoolManager {
  private static readonly MAX_HISTORY_GENERATIONS = 5;

  /**
   * Helper to initialize pool structures if missing on a document
   */
  private static initPools(doc: StudyDocument): StudyDocument {
    const updatedDoc: StudyDocument = JSON.parse(JSON.stringify(doc));
    if (!updatedDoc.aiData) {
      updatedDoc.aiData = {
        summary: doc.summary || '',
        aiNotes: { chapterSummary: '', keyConcepts: [], importantFacts: [], frequentlyAskedQuestions: [] },
        revisionNotes: { oneLineSummaries: [], importantPoints: [], commonExamQuestions: [] },
        definitions: [],
        formulas: [],
        examples: [],
        flashcards: [],
        quiz: { mcq: [], short_answer: [], concept_explanation: [], recall: [] }
      };
    }

    if (!updatedDoc.aiData.quizPool) {
      // Initialize pool with any existing quiz questions from the document
      const existingQuiz: QuizQuestion[] = [];
      if (updatedDoc.aiData.quiz) {
        Object.values(updatedDoc.aiData.quiz).forEach((arr) => {
          if (Array.isArray(arr)) existingQuiz.push(...arr);
        });
      }
      updatedDoc.aiData.quizPool = existingQuiz;
    }

    if (!updatedDoc.aiData.flashcardPool) {
      updatedDoc.aiData.flashcardPool = [...(updatedDoc.aiData.flashcards || [])];
    }

    if (!updatedDoc.aiData.generationHistory) {
      updatedDoc.aiData.generationHistory = {
        recentQuizQuestionIds: [],
        recentFlashcardIds: [],
      };
    }

    return updatedDoc;
  }

  /**
   * Deduplicate and merge new quiz questions into the document's quiz pool
   */
  static mergeQuizQuestionsIntoPool(doc: StudyDocument, newQuestions: QuizQuestion[]): StudyDocument {
    const updated = this.initPools(doc);
    const pool = updated.aiData!.quizPool!;
    const existingTexts = new Set(pool.map((q) => q.question.trim().toLowerCase()));

    for (const q of newQuestions) {
      const normalizedText = q.question.trim().toLowerCase();
      if (!existingTexts.has(normalizedText)) {
        pool.push(q);
        existingTexts.add(normalizedText);
      }
    }

    updated.aiData!.quizPool = pool;
    return updated;
  }

  /**
   * Deduplicate and merge new flashcards into the document's flashcard pool
   */
  static mergeFlashcardsIntoPool(doc: StudyDocument, newCards: Flashcard[]): StudyDocument {
    const updated = this.initPools(doc);
    const pool = updated.aiData!.flashcardPool!;
    const existingFronts = new Set(pool.map((c) => c.front.trim().toLowerCase()));

    for (const c of newCards) {
      const normalizedFront = c.front.trim().toLowerCase();
      if (!existingFronts.has(normalizedFront)) {
        pool.push(c);
        existingFronts.add(normalizedFront);
      }
    }

    updated.aiData!.flashcardPool = pool;
    return updated;
  }

  /**
   * Randomly shuffle an array (Fisher-Yates)
   */
  private static shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Sample fresh quiz questions from the pool, avoiding questions used in the last 5 generations.
   * If insufficient unused questions remain, calls generateMoreIfNeeded() to replenish the pool.
   */
  static async sampleQuizQuestions(
    doc: StudyDocument,
    config: QuizConfig,
    generateMoreIfNeeded: () => Promise<QuizQuestion[]>
  ): Promise<{ questions: QuizQuestion[]; updatedDoc: StudyDocument }> {
    let updatedDoc = this.initPools(doc);
    const targetCount = config.count || 5;

    // Filter pool by requested question type (if not mixed)
    const filterByType = (pool: QuizQuestion[]) => {
      if (config.type === 'mixed') return pool;
      return pool.filter((q) => q.type === config.type);
    };

    let candidatePool = filterByType(updatedDoc.aiData!.quizPool!);
    const history = updatedDoc.aiData!.generationHistory!.recentQuizQuestionIds || [];
    const recentlyUsedIds = new Set(history.flat());

    // Find unused items in candidate pool
    let unusedItems = candidatePool.filter((q) => !recentlyUsedIds.has(q.id));

    // If we don't have enough unused items, attempt to generate more from the AI
    if (unusedItems.length < targetCount) {
      console.log(`[ContentPool] Insufficient unused questions (${unusedItems.length}/${targetCount}). Generating fresh batch...`);
      try {
        const newQuestions = await generateMoreIfNeeded();
        if (newQuestions && newQuestions.length > 0) {
          updatedDoc = this.mergeQuizQuestionsIntoPool(updatedDoc, newQuestions);
          candidatePool = filterByType(updatedDoc.aiData!.quizPool!);
          unusedItems = candidatePool.filter((q) => !recentlyUsedIds.has(q.id));
        }
      } catch (err) {
        console.error('[ContentPool] Failed to generate more quiz questions:', err);
      }
    }

    let selected: QuizQuestion[] = [];
    if (unusedItems.length >= targetCount) {
      // Sufficient unused questions available — sample cleanly
      selected = this.shuffle(unusedItems).slice(0, targetCount);
    } else {
      // Exceeded pool or pool exhausted: take all unused, then fill from oldest generations
      selected = [...unusedItems];
      const remainingCount = targetCount - selected.length;
      const alreadySelectedIds = new Set(selected.map((q) => q.id));

      // Items that were previously used, ordered from oldest used to newest
      const usedCandidates = candidatePool.filter((q) => !alreadySelectedIds.has(q.id));
      const fallbackSample = this.shuffle(usedCandidates).slice(0, remainingCount);
      selected = [...selected, ...fallbackSample];

      // If still fewer than requested (very small document), duplicate or return what we have
      if (selected.length === 0 && candidatePool.length > 0) {
        selected = this.shuffle(candidatePool).slice(0, targetCount);
      }
    }

    // Update 5-generation history
    const selectedIds = selected.map((q) => q.id);
    const updatedHistory = [...history, selectedIds].slice(-this.MAX_HISTORY_GENERATIONS);
    updatedDoc.aiData!.generationHistory!.recentQuizQuestionIds = updatedHistory;

    return {
      questions: selected,
      updatedDoc,
    };
  }

  /**
   * Sample fresh flashcards from the pool, avoiding cards used in the last 5 generations.
   * If insufficient unused cards remain, calls generateMoreIfNeeded() to replenish the pool.
   */
  static async sampleFlashcards(
    doc: StudyDocument,
    targetCount: number,
    generateMoreIfNeeded: () => Promise<Flashcard[]>
  ): Promise<{ flashcards: Flashcard[]; updatedDoc: StudyDocument }> {
    let updatedDoc = this.initPools(doc);
    let candidatePool = updatedDoc.aiData!.flashcardPool!;
    const history = updatedDoc.aiData!.generationHistory!.recentFlashcardIds || [];
    const recentlyUsedIds = new Set(history.flat());

    let unusedCards = candidatePool.filter((c) => !recentlyUsedIds.has(c.id));

    // If we don't have enough unused flashcards, attempt to generate more from the AI
    if (unusedCards.length < targetCount) {
      console.log(`[ContentPool] Insufficient unused flashcards (${unusedCards.length}/${targetCount}). Generating fresh batch...`);
      try {
        const newCards = await generateMoreIfNeeded();
        if (newCards && newCards.length > 0) {
          updatedDoc = this.mergeFlashcardsIntoPool(updatedDoc, newCards);
          candidatePool = updatedDoc.aiData!.flashcardPool!;
          unusedCards = candidatePool.filter((c) => !recentlyUsedIds.has(c.id));
        }
      } catch (err) {
        console.error('[ContentPool] Failed to generate more flashcards:', err);
      }
    }

    let selected: Flashcard[] = [];
    if (unusedCards.length >= targetCount) {
      selected = this.shuffle(unusedCards).slice(0, targetCount);
    } else {
      selected = [...unusedCards];
      const remainingCount = targetCount - selected.length;
      const alreadySelectedIds = new Set(selected.map((c) => c.id));
      const usedCandidates = candidatePool.filter((c) => !alreadySelectedIds.has(c.id));
      const fallbackSample = this.shuffle(usedCandidates).slice(0, remainingCount);
      selected = [...selected, ...fallbackSample];

      if (selected.length === 0 && candidatePool.length > 0) {
        selected = this.shuffle(candidatePool).slice(0, targetCount);
      }
    }

    // Update 5-generation history
    const selectedIds = selected.map((c) => c.id);
    const updatedHistory = [...history, selectedIds].slice(-this.MAX_HISTORY_GENERATIONS);
    updatedDoc.aiData!.generationHistory!.recentFlashcardIds = updatedHistory;

    return {
      flashcards: selected,
      updatedDoc,
    };
  }
}
