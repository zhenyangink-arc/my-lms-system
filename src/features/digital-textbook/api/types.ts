export type DigitalTextbookVocabularyWord = {
  ko: string;
  zh: string;
  pos: string;
  collocation: string;
  transcription: string;
};

export type DigitalTextbookGrammarExample = {
  ko: string;
  zh: string;
  audio: string;
};

export type DigitalTextbookGrammarCase = {
  batchim: string;
  conjugation: string;
};

export type DigitalTextbookGrammarForm = {
  form: string;
  combination: string;
  audio: string;
};

export type DigitalTextbookGrammarItem = {
  title: string;
  meaning: string;
  cases: DigitalTextbookGrammarCase[];
  rows: DigitalTextbookGrammarForm[];
  examples: DigitalTextbookGrammarExample[];
  caution: string;
};

export type DigitalTextbookVocabularyNode = {
  id: string;
  vocabulary: DigitalTextbookVocabularyWord[];
};

export type DigitalTextbookGrammarNode = {
  id: string;
  items: DigitalTextbookGrammarItem[];
};

export type DigitalTextbookModule = {
  id: string;
  code: string;
  nodeCount: number;
  vocabularyCount: number;
  grammarCount: number;
};

export type DigitalTextbookChapter = {
  id: string;
  number: number;
  slug: string;
  status: string;
  versionId: string;
  versionNumber: number;
  versionStatus: string;
  textbookSlug: string;
  modules: DigitalTextbookModule[];
  nodes: DigitalTextbookVocabularyNode[];
  grammarNodes: DigitalTextbookGrammarNode[];
};

export type DigitalTextbook = {
  id: string;
  slug: string;
  title: string;
  status: string;
  chapters: DigitalTextbookChapter[];
};

export type DigitalTextbookLesson = {
  id: string;
  title: string;
  textbooks: DigitalTextbook[];
};

export type DigitalTextbookCourse = {
  id: string;
  title: string;
  lessons: DigitalTextbookLesson[];
};

export type DigitalTextbookVocabularyLibraryItem =
  DigitalTextbookVocabularyWord & {
    id: string;
    source: "textbook" | "custom";
    sortOrder: number;
  };

export type DigitalTextbookGrammarLibraryItem =
  DigitalTextbookGrammarItem & {
    id: string;
    source: "textbook" | "custom";
    sortOrder: number;
  };

export type DigitalTextbookManagementResult = {
  canManage: boolean;
  courses: DigitalTextbookCourse[];
  vocabularyLibrary: DigitalTextbookVocabularyLibraryItem[];
  grammarLibrary: DigitalTextbookGrammarLibraryItem[];
  totalVocabulary: number;
  hasError: boolean;
};
