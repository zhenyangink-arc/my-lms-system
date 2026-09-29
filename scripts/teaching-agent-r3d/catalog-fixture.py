"""Owned disposable fixture: target catalog only; never seed its teaching skeleton."""
import json,pathlib,sys,uuid
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'teaching-agent-r2'))
from staging import load,sql
d=pathlib.Path(sys.argv[1]);load(d)
ids=json.loads((d/'fixture.json').read_text());users=json.loads((d/'users.private.json').read_text())
if (d/'r3d-catalog.json').exists():raise ValueError('ONE_SHOT')
(d/'security-fixture.json').write_text(json.dumps(ids))
def lit(v):
 if v is None:return 'null'
 if isinstance(v,bool):return 'true' if v else 'false'
 if isinstance(v,(dict,list)):v=json.dumps(v,ensure_ascii=False)
 return "'"+str(v).replace("'","''")+"'"
statements=['BEGIN;']
def add(table,**row):statements.append('INSERT INTO public.'+table+'('+','.join(row)+') VALUES('+','.join(map(lit,row.values()))+');')
for label in ['PO2','MA','UT','TB']:
 role='platform_super_admin' if label=='PO2' else 'admin' if label=='TB' else 'teacher'
 statements.append('UPDATE public.profiles SET role='+lit(role)+',global_role='+lit('platform_owner' if label=='PO2' else 'member')+' WHERE id='+lit(users[label]['id'])+';')
 if label!='PO2':
  tenant=ids['B' if label=='TB' else 'A']
  add('tenant_memberships',tenant_id=tenant,user_id=users[label]['id'],role=role,status='active',is_default=True)
  add('staff_app_assignments',tenant_id=tenant,staff_id=users[label]['id'],app_id=ids['app'],status='active',can_manage_content=label!='UT')
ids['profile']=str(uuid.uuid4())
add('learning_agent_profiles',id=ids['profile'],agent_code='uply-korean-teacher',subject_code='korean',display_name={'zh-CN':'合成韩语教学配置'},access_feature='korean_course',status='published')
for key,slug in [('acategory','korean'),('asubcategory','korean-basic')]:
 statements.append('UPDATE public.course_categories SET slug='+lit(slug)+' WHERE id='+lit(ids[key])+';')
ids['acourse']=str(uuid.uuid4());ids['alesson']=str(uuid.uuid4())
add('courses',id=ids['acourse'],category_id=ids['asubcategory'],slug='korean-beginner',title='从零教学工作流测试',student_app_id=ids['app'],tenant_id=ids['A'],content_scope='tenant',unlock_mode='immediate')
for key,slug,unlock in [('alesson','hangul-introduction','immediate'),('clesson','basic-pronunciation','prerequisite_passed'),('dlesson','daily-greetings','prerequisite_passed'),('raceLesson','authoring-race','manual'),('partialLesson','authoring-partial','manual'),('failureLesson','authoring-failure','manual')]:
 if key!='alesson':ids[key]=str(uuid.uuid4())
 add('lessons',id=ids[key],course_id=ids['acourse'],slug=slug,title='合成 '+slug,tenant_id=ids['A'],content_scope='tenant',unlock_mode=unlock)
statements.append('COMMIT;');sql(d,'\n'.join(statements))
count=int(sql(d,'SELECT count(*) FROM public.digital_textbooks WHERE lesson_id='+lit(ids['alesson'])+';').stdout)
assert count==0
# No target parent exists, therefore all descendant counts are also zero by FK.
result={'targetCatalogOnly':True,'textbooks':0,'versions':0,'chapters':0,'modules':0,'teachingLessons':0,'scripts':0,'nodes':0,'syntheticOnly':True}
(d/'r3d-catalog.json').write_text(json.dumps(result,indent=2));(d/'fixture.json').write_text(json.dumps(ids,indent=2));print(json.dumps(result))
