export type KoreanBookReviewQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

export type KoreanBookReviewQuiz = {
  testSlug: string;
  questions: KoreanBookReviewQuestion[];
};

export type KoreanBookReviewQuizzes = Partial<
  Record<number, KoreanBookReviewQuiz>
>;
