"""Only an owned disposable DB: content setup is not a product authoring workflow."""
import json,pathlib,sys,uuid
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'teaching-agent-r2'))
from staging import load,sql
stage=pathlib.Path(sys.argv[1]);load(stage);ids=json.loads((stage/'fixture.json').read_text())
if (stage/'hangul-fixture-result.json').exists():raise ValueError('ONE_SHOT_FIXTURE')
def lit(v):return "'"+str(v).replace("'","''")+"'"
statements=['BEGIN;']
for table,key,slug in [('course_categories','acategory','korean'),('course_categories','asubcategory','korean-basic'),('courses','acourse','korean-beginner'),('lessons','alesson','hangul-introduction'),('digital_textbooks','atextbook','synthetic-hangul')]:
 statements.append(f'UPDATE public.{table} SET slug={lit(slug)} WHERE id={lit(ids[key])};')
statements.append(f"UPDATE public.digital_textbook_chapters SET chapter_number=0,slug='meet-hangul' WHERE id={lit(ids['achapter'])};")
# Two sibling catalog lessons match production's unlock shape; the first also
# has published Agent content, so its Policy denial is not an empty-content test.
def clone(table,source,patch):
 statements.append(f'INSERT INTO public.{table} SELECT (jsonb_populate_record(NULL::public.{table}, to_jsonb(t)||{lit(json.dumps(patch))}::jsonb)).* FROM public.{table} t WHERE id={lit(source)};')
for prefix,slug in [('c','basic-pronunciation'),('d','daily-greetings')]:
 ids[prefix+'lesson']=str(uuid.uuid4());clone('lessons',ids['alesson'],{'id':ids[prefix+'lesson'],'slug':slug,'title':'Synthetic sibling '+slug,'unlock_mode':'prerequisite_passed'})
for name in ['textbook','textbookVersion','chapter','module','teachingLesson','scriptVersion','node']:ids['c'+name]=str(uuid.uuid4())
clone('digital_textbooks',ids['atextbook'],{'id':ids['ctextbook'],'lesson_id':ids['clesson'],'slug':'synthetic-locked-sibling'})
clone('digital_textbook_versions',ids['atextbookVersion'],{'id':ids['ctextbookVersion'],'textbook_id':ids['ctextbook']})
clone('digital_textbook_chapters',ids['achapter'],{'id':ids['cchapter'],'version_id':ids['ctextbookVersion']})
clone('digital_textbook_modules',ids['amodule'],{'id':ids['cmodule'],'chapter_id':ids['cchapter']})
clone('learning_agent_lessons',ids['ateachingLesson'],{'id':ids['cteachingLesson'],'module_id':ids['cmodule']})
clone('learning_agent_script_versions',ids['ascriptVersion'],{'id':ids['cscriptVersion'],'lesson_id':ids['cteachingLesson']})
clone('learning_agent_script_nodes',ids['anodes'][0],{'id':ids['cnode'],'script_version_id':ids['cscriptVersion']})
statements.append('COMMIT;');sql(stage,'\n'.join(statements))
(stage/'fixture.json').write_text(json.dumps(ids,indent=2))
result={'syntheticOnly':True,'productionContentCopied':False,'formalAuthoringClaim':False,'route':'/r2-a/apps/korean/courses/korean/korean-basic/korean-beginner/hangul-introduction','targetUnlock':'immediate','courseLessonCount':3,'siblingsUnlock':'prerequisite_passed','lockedSiblingHasPublishedAgentChain':True,'productionWrites':0}
(stage/'hangul-fixture-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
