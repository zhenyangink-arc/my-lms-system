"""Late-failure and partial-legacy fixtures only on the owned local test lessons."""
import json,pathlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'teaching-agent-r2'))
from staging import load,sql
d=pathlib.Path(sys.argv[1]);load(d);ids=json.loads((d/'fixture.json').read_text())
sql(d,f"""
CREATE FUNCTION public.r3d_test_late_failure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.digital_textbook_modules m
 JOIN public.digital_textbook_chapters ch ON ch.id=m.chapter_id
 JOIN public.digital_textbook_versions v ON v.id=ch.version_id
 JOIN public.digital_textbooks t ON t.id=v.textbook_id
 WHERE m.id=NEW.module_id AND t.lesson_id='{ids['failureLesson']}') THEN
 RAISE EXCEPTION 'SYNTHETIC_LATE_FAILURE'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER r3d_test_late_failure BEFORE INSERT ON public.learning_agent_lessons
FOR EACH ROW EXECUTE FUNCTION public.r3d_test_late_failure();
INSERT INTO public.digital_textbooks(lesson_id,slug,level_code,title,student_app_id)
VALUES ('{ids['partialLesson']}','synthetic-partial','beginner','{{}}','{ids['app']}');
""")
print(json.dumps({'syntheticTestFixtureOnly':True,'targetSkeletonSeeded':False}))
