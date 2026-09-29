"""Synthetic schema-native fixture, SQL only on the ownership-guarded local DB."""
import json,pathlib,sys,uuid
from staging import load,sql
d=pathlib.Path(sys.argv[1]);state=load(d);users=json.loads((d/'users.private.json').read_text())
global_only='--global-only' in sys.argv
ids={k:str(uuid.uuid4()) for k in ['A','B','profile','ownSession','a2Session','bSession','completedSession']}
ids['app']='10000000-0000-4000-8000-000000000001'
if global_only:ids=json.loads((d/'fixture.json').read_text())
for scope in (['g'] if global_only else ['a','b','g']):
 for name in ['category','subcategory','course','lesson','textbook','textbookVersion','chapter','module','teachingLesson','scriptVersion','draftVersion','draftNode']:
  ids[scope+name]=str(uuid.uuid4())
 ids[scope+'nodes']=[str(uuid.uuid4()) for _ in range(8)]
def lit(v):
 if v is None:return 'null'
 if isinstance(v,bool):return 'true' if v else 'false'
 if isinstance(v,(int,float)):return str(v)
 if isinstance(v,(dict,list)):v=json.dumps(v,ensure_ascii=False)
 return "'"+str(v).replace("'","''")+"'"
statements=['BEGIN;']
def add(table,**row):statements.append('INSERT INTO public.'+table+'('+','.join(row)+') VALUES('+','.join(map(lit,row.values()))+');')
if not global_only:
 add('student_apps',id=ids['app'],slug='korean',title='Synthetic Korean',short_title='Korean',app_kind='learning',default_status='active')
 for label in ['A','B']:add('tenants',id=ids[label],slug='r2-'+label.lower(),name='Synthetic Tenant '+label,status='active')
 for label,user in users.items():
  role={'TA':'teacher','AA':'admin','PO':'platform_super_admin'}.get(label,'student')
  statements.append("UPDATE public.profiles SET role="+lit(role)+",global_role="+lit('platform_owner' if label=='PO' else 'member')+",membership_tier='vip2' WHERE id="+lit(user['id'])+';')
  if label=='PO':continue
  tenant=ids['B' if label=='B1' else 'A']
  add('tenant_memberships',tenant_id=tenant,user_id=user['id'],role=role,status='active',membership_tier='vip2',is_default=True)
  if label in ['TA','AA']:
   add('staff_app_assignments',tenant_id=tenant,staff_id=user['id'],app_id=ids['app'],status='active')
  if label in ['A1','B1','EX','IN']:
   add('student_app_enrollments',tenant_id=tenant,student_id=user['id'],app_id=ids['app'],status='paused' if label=='IN' else 'active',access_tier='vip2',starts_at='2025-01-01T00:00:00Z',ends_at='2025-02-01T00:00:00Z' if label=='EX' else '2030-01-01T00:00:00Z')
 add('learning_agent_profiles',id=ids['profile'],agent_code='synthetic-r2-korean',subject_code='korean',display_name={'zh-CN':'Synthetic R2'},access_feature='korean_course',status='published')
title={'zh-CN':'合成测试课文','ko-KR':'합성 교재'}
for s in (['g'] if global_only else ['a','b','g']):
 if s=='g':statements.append("SELECT set_config('request.jwt.claim.sub',"+lit(users['PO']['id'])+",true);")
 x=lambda key:ids[s+key]
 tenant=None if s=='g' else ids[s.upper()]
 content_scope='platform' if s=='g' else 'tenant'
 for cat,parent in [('category',None),('subcategory',x('category'))]:
  add('course_categories',id=x(cat),slug='r2-'+s+'-'+cat,title='Synthetic '+cat,parent_id=parent,is_published=True,tenant_id=tenant,content_scope=content_scope,student_app_id=ids['app'])
 add('courses',id=x('course'),slug='r2-'+s+'-course',title='Synthetic Korean Course '+s,category_id=x('subcategory'),is_published=True,tenant_id=tenant,content_scope=content_scope,student_app_id=ids['app'],unlock_mode='immediate')
 add('lessons',id=x('lesson'),course_id=x('course'),slug='r2-'+s+'-lesson',title='Synthetic Korean Lesson '+s,is_published=True,tenant_id=tenant,content_scope=content_scope,unlock_mode='immediate')
 add('digital_textbooks',id=x('textbook'),lesson_id=x('lesson'),slug='r2-'+s+'-textbook',level_code='synthetic',title=title,status='published',student_app_id=ids['app'],agent_profile_id=ids['profile'])
 add('digital_textbook_versions',id=x('textbookVersion'),textbook_id=x('textbook'),version_number=1,status='published')
 add('digital_textbook_chapters',id=x('chapter'),version_id=x('textbookVersion'),slug='r2-chapter',chapter_number=1,title=title,status='published')
 add('digital_textbook_modules',id=x('module'),chapter_id=x('chapter'),module_code='grammar',sort_order=1,accent_role='jade',title=title)
 add('learning_agent_lessons',id=x('teachingLesson'),module_id=x('module'),agent_profile_id=ids['profile'],objectives={'zh-CN':['理解话题助词'],'ko-KR':['주제 조사 이해']},status='published')
 for v,n,status in [('scriptVersion',1,'published'),('draftVersion',2,'draft')]:
  add('learning_agent_script_versions',id=x(v),lesson_id=x('teachingLesson'),version_number=n,status=status,title=title)
 for index,node in enumerate(x('nodes')):
  add('learning_agent_script_nodes',id=node,script_version_id=x('scriptVersion'),node_key='r2-node-'+str(index),node_type='explanation',sort_order=index+1,title=title,teacher_script={'zh-CN':'저는 학생입니다.','ko-KR':'저는 학생입니다.','private':'SYNTHETIC-PRIVATE-R2'},configuration={'teacherVideo':{'mode':'legacy'},'scriptSegments':{'zh-CN':['저는 학생입니다.'],'ko-KR':['저는 학생입니다.']},'privateMetadata':{'sentinel':'SYNTHETIC-PRIVATE-R2'},'answerKey':'SYNTHETIC-ANSWER-R2','futureUnknown':{'nested':'SYNTHETIC-FUTURE-R2'}})
 add('learning_agent_script_nodes',id=x('draftNode'),script_version_id=x('draftVersion'),node_key='r2-draft',node_type='explanation',sort_order=1,teacher_script={'zh-CN':'SYNTHETIC-DRAFT-R2'},configuration={})
if not global_only:
 for name,user,s,status in [('ownSession','A1','a','active'),('a2Session','A2','a','active'),('bSession','B1','b','active'),('completedSession','A1','a','completed')]:
  add('learning_agent_sessions',id=ids[name],tenant_id=ids[s.upper()],student_id=users[user]['id'],lesson_id=ids[s+'teachingLesson'],agent_profile_id=ids['profile'],script_version_id=ids[s+'scriptVersion'],current_node_id=ids[s+'nodes'][0],status=status,teaching_state={'scriptSegmentNodeId':ids[s+'nodes'][0],'scriptSegmentIndex':0,'teachingTurnNodeId':ids[s+'nodes'][0],'teachingTurnPhase':'explanation'})
statements.append('COMMIT;');sql(d,'\n'.join(statements));(d/'fixture.json').write_text(json.dumps(ids,indent=2));print(json.dumps({'fixture':'PASS','tenants':2,'users':8,'publishedNodes':24,'draftNodes':3,'sessions':4,'platformGlobal':True}))
