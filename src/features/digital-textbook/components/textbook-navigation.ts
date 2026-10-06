// Only this existing chapter has a content/publishing workbench. Do not infer
// support from chapter number: other textbooks can also have a first chapter.
export const WORKBENCH_CHAPTER_ID = 'cda24fb8-c93b-4a19-9577-4418350ff708';

export function chapterWorkbenchHref(chapterId: string, href?: string) {
  return chapterId === WORKBENCH_CHAPTER_ID ? href : undefined;
}

export function textbookModuleLabel(code: string) {
  const labels: { [key: string]: string } = {
    orientation: '课前导航', vocabulary: '词汇', grammar: '语法',
    patterns: '句型', dialogue: '对话', listen_speak: '听说',
    read_write: '读写', review: '复习',
  };
  return labels[code] ?? '未识别模块';
}
