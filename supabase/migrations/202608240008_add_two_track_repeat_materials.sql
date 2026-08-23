with target_node as (
  select node.id
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and node.node_code = 'listen-and-respond'
)
update public.digital_textbook_nodes node
set content = node.content || $content${
  "repeatTracks":[
    {
      "id":"listening-a",
      "title":{"zh-CN":"听力 A · 秀珍自我介绍","ko-KR":"듣기 A · 수진의 자기소개"},
      "keywords":["수진","한국 사람","학생","한국어"],
      "lines":[
        {"ko":"안녕하세요?","zh":"你好。"},
        {"ko":"저는 수진이에요.","zh":"我叫秀珍。"},
        {"ko":"한국 사람이에요.","zh":"我是韩国人。"},
        {"ko":"저는 학생이에요.","zh":"我是学生。"},
        {"ko":"요즘 한국어를 배워요.","zh":"最近我在学习韩语。"},
        {"ko":"처음 만나서 반가워요.","zh":"初次见面，很高兴认识你。"}
      ]
    },
    {
      "id":"listening-b",
      "title":{"zh-CN":"听力 B · 王明与智敏初次见面","ko-KR":"듣기 B · 왕밍과 지민의 첫 만남"},
      "keywords":["왕밍","중국 사람","회사원","지민·학생"],
      "lines":[
        {"ko":"안녕하세요?","zh":"你好。"},
        {"ko":"저는 왕밍이에요.","zh":"我叫王明。"},
        {"ko":"중국 사람이에요.","zh":"我是中国人。"},
        {"ko":"저는 회사원이에요.","zh":"我是公司职员。"},
        {"ko":"요즘 한국어를 배워요.","zh":"最近我在学习韩语。"},
        {"ko":"지민 씨는 학생이에요?","zh":"智敏是学生吗？"},
        {"ko":"네, 학생이에요.","zh":"是的，我是学生。"},
        {"ko":"만나서 반가워요.","zh":"很高兴认识你。"}
      ]
    }
  ]
}$content$::jsonb,
    updated_at = now()
where node.id in (select id from target_node);
