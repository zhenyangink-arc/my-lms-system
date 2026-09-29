"""Shape only the owned synthetic A catalog for the existing formal Korean route."""
import json,pathlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'teaching-agent-r2'))
from staging import load,sql
d=pathlib.Path(sys.argv[1]);load(d);ids=json.loads((d/'fixture.json').read_text())
changes=[('course_categories','acategory','korean'),('course_categories','asubcategory','korean-basic'),
         ('courses','acourse','korean-beginner'),('lessons','alesson','basic-pronunciation'),
         ('digital_textbooks','atextbook','korean-level-one-smart')]
statements=['BEGIN;']
for table,key,slug in changes:
    statements.append(f"UPDATE public.{table} SET slug='{slug}' WHERE id='{ids[key]}';")
statements.append(f"UPDATE public.digital_textbook_chapters SET chapter_number=0,slug='korean-level-one-00' WHERE id='{ids['achapter']}';")
statements.append('COMMIT;')
sql(d,'\n'.join(statements))
route='/r2-a/apps/korean/courses/korean/korean-basic/korean-beginner/basic-pronunciation'
(d/'formal-fixture-result.json').write_text(json.dumps({'route':route,'syntheticOnly':True,'productionContentCopied':False,'policyModified':False}))
print(json.dumps({'formalRoute':route}))
