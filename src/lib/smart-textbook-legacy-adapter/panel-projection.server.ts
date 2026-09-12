import 'server-only';
import type {PrivateBindings} from './capsules.server.ts';
import type {LearningPanel} from '../../features/smart-textbook-runtime/core/services.ts';
// Closed legacy panel semantics (profile.pages + old module panels), not title
// matching. Each panel owns actual content or a selected existing activity.
const mapping:Readonly<Record<string,{slot?:string;activities?:readonly string[];native?:true;navigation?:true}>>={
  scene:{slot:'dialogueGroups'},diagnosis:{native:true},scene_and_words:{slot:'vocabulary'},vocabulary_practice:{activities:['vocabulary-check']},
  grammar_explanation:{slot:'grammarCards'},grammar_practice:{activities:['grammar-choice','grammar-judgment','grammar-fill']},
  pattern_library:{slot:'patternCards'},guided_substitution:{activities:['pattern-choice','pattern-order']},combined_output:{activities:['pattern-compose']},
  dialogue_guide:{slot:'dialogueFlow'},scene_dialogue:{slot:'dialogueScenes'},comprehension:{activities:['dialogue-fact-check','dialogue-response']},roleplay:{activities:['dialogue-roleplay']},
  listening_preparation:{slot:'listeningContext'},listening_comprehension:{activities:['listening-identity']},shadowing:{slot:'repeatTracks'},independent_speaking:{activities:['speaking-introduction']},
  reading_source:{slot:'reading'},reading_comprehension:{activities:['reading-profile']},writing_scaffold:{slot:'writingFrame'},independent_writing:{activities:['write-profile']},
  comprehensive_check:{activities:['review-multiple']},can_do_check:{activities:['self-check']},review_result:{navigation:true},
};
export function learningPanels(c:Extract<PrivateBindings['capsules'][number],{kind:'learning'}>,locale:'zh-CN'|'ko-KR'):LearningPanel[]{
  return c.panels.map(p=>{const rule=mapping[p.legacyPageKey];if(!rule)throw Error('UNKNOWN_LEARNING_PANEL');
    const contentPartId=rule.slot?c.sections.find(s=>s.slot===rule.slot)?.partId:null;
    const activityRefs=rule.activities?.map(key=>{const a=c.activities.find(a=>a.activityKey===key);if(!a)throw Error(`PANEL_ACTIVITY_UNBOUND:${key}`);return a.activityId;})??[];
    if(rule.slot&&!contentPartId)throw Error(`PANEL_CONTENT_UNBOUND:${rule.slot}`);
    return {partId:p.id,title:p.title[locale],contentPartId:contentPartId??null,activityRefs,nativeChoices:!!rule.native,navigation:!!rule.navigation};
  });
}
