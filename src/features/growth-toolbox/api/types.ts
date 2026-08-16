export type GrowthToolboxItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  href: string;
  iconName: string;
  accent: string;
  soft: string;
  sortOrder: number;
  isEnabled: boolean;
  relatedCourseId: string | null;
};

export type GrowthToolboxVocabularyWord = {
  ko: string;
  zh: string;
  pos: string;
  collocation: string;
  transcription: string;
};

export type GrowthToolboxVocabularyItem =
  GrowthToolboxVocabularyWord & {
    id: string;
    source: "textbook" | "custom";
    sortOrder: number;
  };

export type GrowthToolboxGrammarCase = {
  batchim: string;
  conjugation: string;
};

export type GrowthToolboxGrammarForm = {
  form: string;
  combination: string;
  audio: string;
};

export type GrowthToolboxGrammarExample = {
  ko: string;
  zh: string;
  audio: string;
};

export type GrowthToolboxGrammarItem = {
  id: string;
  title: string;
  meaning: string;
  cases: GrowthToolboxGrammarCase[];
  rows: GrowthToolboxGrammarForm[];
  examples: GrowthToolboxGrammarExample[];
  caution: string;
  source: "textbook" | "custom";
  sortOrder: number;
};

export type GrowthToolboxCourseTree = {
  id: string;
  title: string;
  slug: string;
  lessons: {
    id: string;
    title: string;
    textbooks: {
      id: string;
      title: string;
      slug: string;
      status: string;
      chapters: {
        id: string;
        number: number;
        slug: string;
        vocabularyCount: number;
        vocabularyNodes: {
          id: string;
          vocabulary: GrowthToolboxVocabularyWord[];
        }[];
      }[];
    }[];
  }[];
};

export type GrowthToolboxManagementResult = {
  canManage: boolean;
  toolboxItems: GrowthToolboxItem[];
  courseTree: GrowthToolboxCourseTree[];
  vocabularyLibrary: GrowthToolboxVocabularyItem[];
  grammarLibrary: GrowthToolboxGrammarItem[];
  hasError: boolean;
};
