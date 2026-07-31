const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const lessons = [
  {
    number: 1,
    title: "안녕하세요?",
    chinese: "你好？",
    goal: "问候、自我介绍、身份说明与初次见面回应",
    grammar: [
      ["提出话题", "N은/는", "저는 학생이에요."],
      ["说明身份", "N이에요/예요", "저는 민수예요."],
      ["确认信息", "문장 끝 올림 억양 ↗", "학생이에요?"],
      ["肯定与否定回应", "네/아니요", "네, 학생이에요."],
    ],
    vocab: [["학생", "学生"], ["회사원", "公司职员"], ["만나서 반가워요", "很高兴见到你"]],
    situations: [
      ["初次见面时，最自然的开场是？", ["안녕하세요?", "얼마예요?", "어디에 있어요?", "여보세요."], 0, "初次见面先用 안녕하세요? 礼貌问候。"],
      ["“我是秀珍”应怎样表达？", ["저는 수진이에요.", "수진이 있어요.", "수진을 주세요.", "수진에 가요."], 0, "姓名以辅音结尾时使用 이에요。"],
      ["对方问“학생이에요?”，肯定回答是？", ["네, 학생이에요.", "아니요, 학생이에요.", "학생을 만나요.", "학생이 없어요."], 0, "肯定确认用 네，再重复身份信息。"],
    ],
  },
  {
    number: 2,
    title: "이거는 뭐예요?",
    chinese: "这是什么？",
    goal: "询问物品、表达有无、礼貌请求与连接名词",
    grammar: [
      ["表达有无", "N이/가 있어요·없어요", "연필이 있어요."],
      ["近中远指物", "이거/그거/저거", "이거는 공책이에요."],
      ["礼貌请求物品", "N 주세요", "물 주세요."],
      ["连接两个名词", "N하고 N·N과/와 N", "연필하고 공책"],
    ],
    vocab: [["공책", "笔记本"], ["연필", "铅笔"], ["우산", "雨伞"]],
    situations: [
      ["指着自己手边的物品问“这是什么？”应说？", ["이거는 뭐예요?", "그거는 어디예요?", "저거를 만나요?", "뭐가 없어요?"], 0, "离说话人近的物品使用 이거。"],
      ["“有雨伞吗？”的正确表达是？", ["우산이 있어요?", "우산을 주세요?", "우산에 가요?", "우산하고 있어요?"], 0, "存在表达使用主格助词 이/가 与 있어요。"],
      ["在商店里说“请给我水”应选择？", ["물 주세요.", "물이 없어요.", "물은 학생이에요.", "물에 가요."], 0, "名词后直接接 주세요 可以礼貌索取物品。"],
    ],
  },
  {
    number: 3,
    title: "한국어를 공부해요.",
    chinese: "我学习韩语。",
    goal: "日常动作、动作对象、动作场所与简短否定",
    grammar: [
      ["日常敬语词尾", "V/A-아/어요", "공부해요."],
      ["标记动作对象", "N을/를", "한국어를 공부해요."],
      ["标记动作场所", "N에서", "도서관에서 공부해요."],
      ["简短否定", "안 + V/A", "오늘은 운동 안 해요."],
    ],
    vocab: [["공부하다", "学习"], ["도서관", "图书馆"], ["책을 읽다", "读书"]],
    situations: [
      ["“在学校学习韩语”中，学校后应使用哪个助词？", ["에서", "를", "하고", "까지"], 0, "动作发生的场所使用 에서。"],
      ["“今天不喝咖啡”最自然的表达是？", ["오늘은 커피를 안 마셔요.", "오늘은 커피가 있어요.", "오늘은 커피에 가요.", "오늘은 커피예요."], 0, "简短否定把 안 放在动词前。"],
      ["选择正确的宾语表达。", ["책을 읽어요.", "책에서 읽어요.", "책이 가요.", "책하고 없어요."], 0, "읽다 的动作对象用 을/를 标记。"],
    ],
  },
  {
    number: 4,
    title: "어디에 있어요?",
    chinese: "在哪里？",
    goal: "场所介绍、存在位置、移动目的地与方位关系",
    grammar: [
      ["介绍当前场所", "여기가 N이에요/예요", "여기가 교실이에요."],
      ["说明存在位置", "N에 있어요/없어요", "책이 책상 위에 있어요."],
      ["表达移动目的地", "N에 가요/와요", "학교에 가요."],
      ["精确表达方位", "N + 위치 명사 + 에", "은행 옆에 있어요."],
    ],
    vocab: [["교실", "教室"], ["책상 위", "桌子上面"], ["은행 옆", "银行旁边"]],
    situations: [
      ["询问“卫生间在哪里？”应说？", ["화장실이 어디에 있어요?", "화장실을 뭐예요?", "화장실에서 주세요.", "화장실하고 가요?"], 0, "询问位置使用 어디에 있어요?。"],
      ["“书在桌子下面”正确表达是？", ["책이 책상 아래에 있어요.", "책을 책상 아래에 가요.", "책은 아래를 만나요.", "책하고 책상이 없어요."], 0, "存在主体用 이/가，位置后用 에。"],
      ["“去学校”应选择？", ["학교에 가요.", "학교에서 있어요.", "학교를 없어요.", "학교하고 주세요."], 0, "移动目的地使用 에，动作使用 가요。"],
    ],
  },
  {
    number: 5,
    title: "주말에 친구를 만났어요.",
    chinese: "周末见了朋友。",
    goal: "日期星期、时间助词、过去时与动作连接",
    grammar: [
      ["表达日期和星期", "날짜와 요일", "오월 삼 일 금요일"],
      ["标记动作时间", "시간 N에", "주말에 친구를 만나요."],
      ["讲述过去", "V-았/었-", "친구를 만났어요."],
      ["连接先后动作", "V-고", "영화를 보고 밥을 먹었어요."],
    ],
    vocab: [["주말", "周末"], ["어제", "昨天"], ["친구를 만나다", "见朋友"]],
    situations: [
      ["“昨天看了电影”正确表达是？", ["어제 영화를 봤어요.", "어제 영화를 봐요.", "어제 영화가 있어요.", "어제 영화에 가요."], 0, "已经发生的动作使用过去时。"],
      ["“周末见朋友”中，주말 后使用？", ["에", "를", "에서", "하고"], 0, "动作发生的时间后使用 에。"],
      ["“看电影后吃了饭”最合适的是？", ["영화를 보고 밥을 먹었어요.", "영화를 보지만 밥이에요.", "영화에 밥을 먹어요.", "영화가 밥도 있어요."], 0, "-고 可以顺序连接两个动作。"],
    ],
  },
  {
    number: 6,
    title: "얼마예요?",
    chinese: "多少钱？",
    goal: "询问价格、数量量词、商品评价与追加项目",
    grammar: [
      ["礼貌请求动作", "V-(으)세요", "천천히 말씀하세요."],
      ["计算物品数量", "고유어 수 + 단위 명사", "사과 세 개"],
      ["描述商品特征", "N이/가 + A-아/어요", "가방이 예뻐요."],
      ["表示也和追加", "N도", "물도 주세요."],
    ],
    vocab: [["얼마예요?", "多少钱？"], ["한 개", "一个"], ["비싸요", "贵"]],
    situations: [
      ["购买三个苹果应说？", ["사과 세 개 주세요.", "사과 삼 원 주세요.", "사과가 세 시예요.", "사과를 셋 사람 주세요."], 0, "物品数量使用固有词数字加量词 개。"],
      ["“这个包多少钱？”正确表达是？", ["이 가방은 얼마예요?", "이 가방이 어디에 가요?", "이 가방을 누구세요?", "이 가방에서 공부해요?"], 0, "询问价格使用 얼마예요?。"],
      ["已经买了面包，还要水，应说？", ["물도 주세요.", "물만 없어요.", "물에 가세요.", "물이 회사원이에요."], 0, "追加同类项目使用助词 도。"],
    ],
  },
  {
    number: 7,
    title: "날씨가 어때요?",
    chinese: "天气怎么样？",
    goal: "天气季节、ㅂ不规则、转折、正式播报与信息并列",
    grammar: [
      ["ㅂ不规则变化", "ㅂ 불규칙", "춥다 → 추워요"],
      ["表达转折反差", "A/V-지만", "춥지만 맑아요."],
      ["正式陈述词尾", "A/V-습니다/ㅂ니다", "날씨가 좋습니다."],
      ["并列两个信息", "A/V-고", "따뜻하고 맑아요."],
    ],
    vocab: [["맑아요", "晴朗"], ["흐려요", "阴天"], ["추워요", "冷"]],
    situations: [
      ["춥다 的日常敬语正确变化是？", ["추워요", "춥어요", "춥아요", "추우세요요"], 0, "ㅂ不规则中 ㅂ 脱落并与 워요 结合。"],
      ["天气预报中“今天很冷”更适合？", ["오늘은 매우 춥습니다.", "오늘은 매우 추워?", "오늘은 추운 주세요.", "오늘을 춥고 있어요."], 0, "正式播报使用 -습니다/ㅂ니다。"],
      ["“虽然下雨，但是暖和”应选择？", ["비가 오지만 따뜻해요.", "비가 오고 싶어요.", "비가 와 주세요.", "비를 따뜻합니다."], 0, "-지만 表示前后反差。"],
    ],
  },
  {
    number: 8,
    title: "영화 볼까요?",
    chinese: "去看电影好吗？",
    goal: "提出建议、ㄷ不规则、指示冠词与现场感叹",
    grammar: [
      ["提出共同建议", "V-(으)ㄹ까요?", "영화 볼까요?"],
      ["ㄷ不规则变化", "ㄷ 불규칙", "듣다 → 들어요"],
      ["指示具体名词", "이/그/저 + N", "이 영화"],
      ["表达现场感叹", "A/V-네요", "날씨가 좋네요!"],
    ],
    vocab: [["영화를 보다", "看电影"], ["음악을 듣다", "听音乐"], ["사진을 찍다", "拍照"]],
    situations: [
      ["邀请朋友一起喝咖啡，应说？", ["커피 마실까요?", "커피를 마시지 마세요.", "커피가 얼마예요?", "커피에 있어요?"], 0, "-(으)ㄹ까요? 用于提出共同建议。"],
      ["듣다 接 -어요 时正确形式是？", ["들어요", "듣어요", "듣아요", "들으세요요"], 0, "ㄷ在元音词尾前变为ㄹ：듣다→들어요。"],
      ["看到漂亮景色时自然感叹？", ["정말 아름답네요!", "아름다울까요?", "아름답지 마세요.", "아름다움을 주세요."], 0, "-네요 表达现场发现或感叹。"],
    ],
  },
  {
    number: 9,
    title: "이분은 누구세요?",
    chinese: "这位是谁？",
    goal: "家庭所属、能力评价、身份敬语与主体敬语",
    grammar: [
      ["说明所属关系", "N(의) N", "민수의 가족"],
      ["评价擅长能力", "N을/를 잘하다", "노래를 잘해요."],
      ["敬语说明身份", "N(이)세요", "선생님이세요."],
      ["主体敬语", "A/V-(으)시-", "할머니가 주무세요."],
    ],
    vocab: [["할머니", "奶奶"], ["부모님", "父母"], ["노래를 잘하다", "擅长唱歌"]],
    situations: [
      ["礼貌询问“这位是谁？”应说？", ["이분은 누구세요?", "이 사람은 얼마예요?", "이분을 주세요?", "누구에 가세요?"], 0, "분 和 누구세요 都体现对人物的敬意。"],
      ["“（长辈）是老师”正确表达是？", ["선생님이세요.", "선생님이에요만.", "선생님을 잘해요.", "선생님에 있어요."], 0, "名词身份敬语使用 -(이)세요。"],
      ["描述奶奶睡觉，最恰当的是？", ["할머니가 주무세요.", "할머니가 자요.", "할머니를 자세요.", "할머니는 잠을 주세요."], 0, "对长辈使用敬语动词 주무시다。"],
    ],
  },
  {
    number: 10,
    title: "지금 몇 시예요?",
    chinese: "现在几点？",
    goal: "准确时刻、日程范围、动作连接与未来计划",
    grammar: [
      ["表达准确时刻", "시간 표현", "오후 세 시 반"],
      ["说明起止范围", "N부터 N까지", "아홉 시부터 다섯 시까지"],
      ["连接前后动作", "V-아서/어서", "집에 가서 쉬어요."],
      ["表达未来计划", "V-(으)ㄹ 거예요", "내일 공부할 거예요."],
    ],
    vocab: [["몇 시", "几点"], ["세 시 반", "三点半"], ["내일", "明天"]],
    situations: [
      ["“从九点到五点”正确表达是？", ["아홉 시부터 다섯 시까지", "아홉 시에서 다섯 시를", "아홉 시하고 다섯 시에", "아홉 시만 다섯 시도"], 0, "时间范围使用 부터…까지。"],
      ["“回家后休息”应选择？", ["집에 가서 쉬어요.", "집에 가지만 쉬어요.", "집을 갈까요 쉬어요.", "집이 쉬고 있어요."], 0, "-아서/어서 可连接有先后关系的动作。"],
      ["“明天要见朋友”正确表达是？", ["내일 친구를 만날 거예요.", "내일 친구를 만났어요.", "내일 친구가 없었어요.", "내일 친구를 만나지 마세요."], 0, "未来计划使用 -(으)ㄹ 거예요。"],
    ],
  },
  {
    number: 11,
    title: "감기에 걸렸어요.",
    chinese: "感冒了。",
    goal: "身体症状、ㅡ脱落、禁止、限定与义务",
    grammar: [
      ["ㅡ脱落变化", "ㅡ 탈락", "아프다 → 아파요"],
      ["表达禁止", "V-지 마세요", "찬물을 마시지 마세요."],
      ["限定范围", "N만", "물만 마셔요."],
      ["说明义务", "V-아야/어야 돼요", "약을 먹어야 돼요."],
    ],
    vocab: [["감기에 걸리다", "感冒"], ["머리가 아프다", "头疼"], ["약을 먹다", "吃药"]],
    situations: [
      ["아프다 的正确变化是？", ["아파요", "아프어요", "아프아요", "압아요"], 0, "词干末ㅡ在元音词尾前脱落：아프다→아파요。"],
      ["医生说“不要喝冷水”应选择？", ["찬물을 마시지 마세요.", "찬물만 마셔요.", "찬물을 마실까요?", "찬물이 있어요."], 0, "-지 마세요 表达礼貌禁止。"],
      ["“必须去医院”正确表达是？", ["병원에 가야 돼요.", "병원에 가지 마세요.", "병원만 없어요.", "병원을 갈까요?"], 0, "-아야/어야 돼요 表达必须或义务。"],
    ],
  },
  {
    number: 12,
    title: "여보세요.",
    chinese: "喂。",
    goal: "电话确认、进行状态、客观不能与原因说明",
    grammar: [
      ["确认动词形容词", "A/V-지요?", "지금 바쁘지요?"],
      ["确认名词身份", "N-(이)지요?", "지훈 씨지요?"],
      ["说明正在进行", "V-고 있어요", "운전하고 있어요."],
      ["表达客观不能", "못 + V", "전화를 못 받아요."],
    ],
    vocab: [["여보세요", "喂"], ["전화를 받다", "接电话"], ["부재중 전화", "未接来电"]],
    situations: [
      ["电话接通时首先说？", ["여보세요.", "만나서 반가워요.", "얼마예요?", "잘 먹겠습니다."], 0, "韩语电话开场使用 여보세요。"],
      ["“现在正在开会”正确表达是？", ["지금 회의하고 있어요.", "지금 회의할까요?", "지금 회의지 마세요.", "지금 회의만 주세요."], 0, "-고 있어요 表达动作正在进行。"],
      ["“因为在开车，不能接电话”应选择？", ["운전하고 있어서 전화를 못 받아요.", "운전하지만 전화를 주세요.", "운전할까요 전화를 받아요.", "운전은 전화지요."], 0, "-아서/어서说明原因，못表示客观不能。"],
    ],
  },
  {
    number: 13,
    title: "서울역으로 가 주세요.",
    chinese: "请带我去首尔站。",
    goal: "出行计划、起点终点、礼貌请求与交通方向",
    grammar: [
      ["表达行动计划", "V-(으)려고 하다", "부산에 가려고 해요."],
      ["说明地点区间", "N에서 N까지", "집에서 역까지"],
      ["请求对方帮助", "V-아/어 주다", "천천히 가 주세요."],
      ["表达方向工具", "N-(으)로", "지하철로 가요."],
    ],
    vocab: [["서울역", "首尔站"], ["지하철", "地铁"], ["갈아타다", "换乘"]],
    situations: [
      ["“坐地铁去”正确表达是？", ["지하철로 가요.", "지하철을 있어요.", "지하철에서 주세요.", "지하철이 누구세요?"], 0, "交通工具后使用 -(으)로。"],
      ["对司机说“请去首尔站”应选择？", ["서울역으로 가 주세요.", "서울역을 잘해요.", "서울역에 있지 마세요.", "서울역이 얼마예요?"], 0, "方向用 -(으)로，请求用 -아/어 주세요。"],
      ["“打算去釜山”应说？", ["부산에 가려고 해요.", "부산에 갔어요만.", "부산을 가고 있어요지요.", "부산이 가 주세요."], 0, "-(으)려고 하다 表达计划或意图。"],
    ],
  },
  {
    number: 14,
    title: "이 옷을 입어 보세요.",
    chinese: "请试穿这件衣服。",
    goal: "服饰特征、形容词定语、ㄹ脱落、试穿建议与敬语对象",
    grammar: [
      ["形容词修饰名词", "A-(으)ㄴ N", "예쁜 옷"],
      ["ㄹ脱落变化", "ㄹ 탈락", "길다 → 긴 치마"],
      ["建议尝试动作", "V-아/어 보세요", "입어 보세요."],
      ["表示动作对象", "N한테/께", "할머니께 선물을 드려요."],
    ],
    vocab: [["옷", "衣服"], ["치마", "裙子"], ["입어 보다", "试穿"]],
    situations: [
      ["“漂亮的衣服”正确表达是？", ["예쁜 옷", "예뻐 옷", "예쁘는 옷", "예쁠까요 옷"], 0, "形容词修饰名词使用 -(으)ㄴ。"],
      ["建议顾客“请试穿一下”应说？", ["입어 보세요.", "입지 마세요.", "입을까요?", "입고 싶어 해요."], 0, "-아/어 보세요 用于建议对方尝试。"],
      ["给奶奶礼物时，最尊敬的对象助词是？", ["께", "한테", "를", "에서"], 0, "对长辈或需要尊敬的对象使用 께。"],
    ],
  },
  {
    number: 15,
    title: "여행을 가고 싶어요.",
    chinese: "我想去旅行。",
    goal: "旅行条件、动词定语、本人愿望与第三人愿望",
    grammar: [
      ["表达条件假设", "A/V-(으)면", "시간이 있으면 여행해요."],
      ["动词修饰名词", "V-는 N", "제가 가는 곳"],
      ["表达本人愿望", "V-고 싶다", "여행을 가고 싶어요."],
      ["表达他人愿望", "V-고 싶어 하다", "민수는 여행하고 싶어 해요."],
    ],
    vocab: [["여행", "旅行"], ["바다", "大海"], ["호텔", "酒店"]],
    situations: [
      ["“如果有时间，就去旅行”应选择？", ["시간이 있으면 여행을 가요.", "시간이 있지만 여행이에요.", "시간을 여행해 주세요.", "시간이 여행하고 있어요."], 0, "-(으)면 表达条件。"],
      ["自己说“想看大海”应使用？", ["바다를 보고 싶어요.", "바다를 보고 싶어 해요.", "바다를 보지 마세요.", "바다가 볼까요?"], 0, "说话人自己的愿望使用 -고 싶어요。"],
      ["描述敏洙“想住酒店”应选择？", ["민수는 호텔에 묵고 싶어 해요.", "민수는 호텔에 묵고 싶어요.", "민수는 호텔을 묵지요.", "민수는 호텔이 있어요."], 0, "第三人的愿望通常使用 -고 싶어 하다。"],
    ],
  },
  {
    number: 16,
    title: "우리 집에 올 수 있어요?",
    chinese: "你能来我家吗？",
    goal: "邀请能力、主动承诺、移动目的与同时动作",
    grammar: [
      ["表达能力条件", "V-(으)ㄹ 수 있다/없다", "올 수 있어요?"],
      ["主动承诺决定", "V-(으)ㄹ게요", "제가 준비할게요."],
      ["说明移动目的", "V-(으)러 가다/오다", "친구를 만나러 가요."],
      ["表达同时动作", "V-(으)면서", "음악을 들으면서 요리해요."],
    ],
    vocab: [["초대하다", "邀请"], ["준비하다", "准备"], ["같이", "一起"]],
    situations: [
      ["“你能来我家吗？”正确表达是？", ["우리 집에 올 수 있어요?", "우리 집을 오지 마세요?", "우리 집이 얼마예요?", "우리 집에서 누구세요?"], 0, "-(으)ㄹ 수 있어요? 询问能力或可能性。"],
      ["主动说“我来准备食物”应选择？", ["제가 음식을 준비할게요.", "제가 음식을 준비했어요?", "제가 음식만 없어요.", "제가 음식을 준비지 마세요."], 0, "-(으)ㄹ게요 表达说话人的承诺或决定。"],
      ["“边听音乐边做饭”应说？", ["음악을 들으면서 요리해요.", "음악을 들으러 요리해요.", "음악을 듣지만 요리예요.", "음악이 요리할까요?"], 0, "-(으)면서 表达两个动作同时进行。"],
    ],
  },
];

const difficultyProfiles = [
  {
    key: "foundation",
    code: "f",
    label: "基础",
    koreanLabel: "기초",
    prompt: "直接判断电子书中的形式与含义",
  },
  {
    key: "medium",
    code: "m",
    label: "中等",
    koreanLabel: "중급",
    prompt: "结合例句判断语法功能和词汇",
  },
  {
    key: "hard",
    code: "h",
    label: "困难",
    koreanLabel: "고급",
    prompt: "比较相近表达并分析使用条件",
  },
  {
    key: "expert",
    code: "x",
    label: "极难",
    koreanLabel: "최상급",
    prompt: "在综合情境中选择最准确、最自然的表达",
  },
];

const activeQuestionNumbers = new Set([1, 3, 5, 8, 10, 12, 14, 16, 18, 20]);

function rotatedChoices(correct, distractors, rotation) {
  const choices = [...new Set([correct, ...distractors])].slice(0, 4);
  while (choices.length < 4) choices.push(`干扰项 ${choices.length + 1}`);
  const shift = rotation % choices.length;
  const options = [...choices.slice(shift), ...choices.slice(0, shift)];
  return { options, correct_option: options.indexOf(correct) };
}

function koreanSpellingDistractors(value) {
  return [
    `${value}요`,
    `${value}를`,
    `${value}에`,
    `${value}만`,
  ].filter((item) => item !== value);
}

function buildDifficultyQuestions(lesson, profile, difficultyIndex) {
  const rows = [];
  const grammarForms = lesson.grammar.map((item) => item[1]);
  const grammarFunctions = lesson.grammar.map((item) => item[0]);
  const vocabKorean = lesson.vocab.map((item) => item[0]);
  const vocabChinese = lesson.vocab.map((item) => item[1]);
  const lessonNumber = String(lesson.number).padStart(2, "0");

  for (let index = 0; index < 20; index += 1) {
    const number = index + 1;
    const rotation = number + difficultyIndex;
    let prompt;
    let choice;
    let explanation;
    let skill;
    const koreanOnly = profile.key !== "foundation";

    if (index < 4) {
      const grammar = lesson.grammar[index];
      prompt = koreanOnly
        ? `[${profile.koreanLabel}] 다음 교재 예문에 사용된 핵심 문법을 고르세요. “${grammar[2]}”`
        : `${profile.label}｜${profile.prompt}：第${lessonNumber}课中，“${grammar[0]}”应使用哪项语法？`;
      choice = rotatedChoices(
        grammar[1],
        grammarForms.filter((item) => item !== grammar[1]),
        rotation
      );
      explanation = `${grammar[1]}用于${grammar[0]}。电子书例句：${grammar[2]}`;
      skill = "grammar";
    } else if (index < 8) {
      const grammar = lesson.grammar[index - 4];
      prompt = koreanOnly
        ? `[${profile.koreanLabel}] 제${lesson.number}과의 문장 “${grammar[2]}”를 설명하는 문법 표현은 무엇입니까?`
        : `${profile.label}｜分析电子书例句“${grammar[2]}”，其中重点使用了哪项本课语法？`;
      choice = rotatedChoices(
        grammar[1],
        grammarForms.filter((item) => item !== grammar[1]),
        rotation
      );
      explanation = `例句“${grammar[2]}”对应${grammar[1]}，功能是${grammar[0]}。`;
      skill = "grammar";
    } else if (index < 11) {
      const grammar = lesson.grammar[index - 8];
      prompt = koreanOnly
        ? `[${profile.koreanLabel}] 다음 예문을 같은 의미로 만들 때 필요한 문법 규칙을 고르세요. “${grammar[2]}”`
        : `${profile.label}｜如果学习者需要“${grammar[0]}”，下面哪项规则最准确？`;
      choice = rotatedChoices(
        grammar[1],
        grammarForms.filter((item) => item !== grammar[1]),
        rotation
      );
      explanation = `本课把“${grammar[0]}”归纳为${grammar[1]}。`;
      skill = "grammar";
    } else if (index < 14) {
      const vocab = lesson.vocab[index - 11];
      if (koreanOnly) {
        const next = lesson.vocab[(index - 10) % lesson.vocab.length][0];
        const correct = `${vocab[0]} · ${next}`;
        prompt = `[${profile.koreanLabel}] 제${lesson.number}과 핵심 어휘 묶음 ${index - 10}으로 알맞은 것은 무엇입니까?`;
        choice = rotatedChoices(
          correct,
          [
            `${vocab[0]} · ${grammarForms[0]}`,
            `${lesson.title} · ${grammarForms[1]}`,
            `${grammarForms[2]} · ${next}`,
          ],
          rotation
        );
      } else {
        prompt = `${profile.label}｜本课核心词汇“${vocab[0]}”在当前语境中的意思是什么？`;
        choice = rotatedChoices(
          vocab[1],
          [
            ...vocabChinese.filter((item) => item !== vocab[1]),
            lesson.chinese,
          ],
          rotation
        );
      }
      explanation = `${vocab[0]}：${vocab[1]}。这是电子书第${lessonNumber}课的核心词汇。`;
      skill = "vocabulary";
    } else if (index < 17) {
      const vocab = lesson.vocab[index - 14];
      prompt = koreanOnly
        ? `[${profile.koreanLabel}] 제${lesson.number}과 핵심 어휘 ${index - 13}의 표기로 정확한 것을 고르세요.`
        : `${profile.label}｜要表达“${vocab[1]}”，应选择哪个本课韩语词汇或短语？`;
      choice = koreanOnly
        ? rotatedChoices(
            vocab[0],
            koreanSpellingDistractors(vocab[0]),
            rotation
          )
        : rotatedChoices(
            vocab[0],
            [...vocabKorean.filter((item) => item !== vocab[0]), lesson.title],
            rotation
          );
      explanation = `“${vocab[1]}”对应“${vocab[0]}”。`;
      skill = "vocabulary";
    } else {
      const situation = lesson.situations[index - 17];
      prompt = koreanOnly
        ? `[${profile.koreanLabel}] 제${lesson.number}과 “${lesson.title}”의 대화 상황 ${index - 16}에서 가장 자연스러운 표현을 고르세요.`
        : `${profile.label}｜${situation[0]}`;
      const correct = situation[1][situation[2]];
      choice = rotatedChoices(
        correct,
        situation[1].filter((_, optionIndex) => optionIndex !== situation[2]),
        rotation
      );
      explanation = situation[3];
      skill = "communication";
    }

    rows.push({
      question_key: `${profile.code}${String(number).padStart(2, "0")}`,
      prompt,
      ...choice,
      explanation,
      skill,
      difficulty: profile.key,
      sort_order: difficultyIndex * 20 + number,
      is_chapter_test_item:
        profile.key === "foundation" && activeQuestionNumbers.has(number),
    });
  }

  return rows;
}

function buildQuestions(lesson) {
  return difficultyProfiles.flatMap((profile, difficultyIndex) =>
    buildDifficultyQuestions(lesson, profile, difficultyIndex)
  );
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("缺少 Supabase 环境变量。");
  }

  const db = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: courseLesson, error: lessonError } = await db
    .from("lessons")
    .select("id")
    .eq("slug", "basic-pronunciation")
    .single();
  if (lessonError) throw lessonError;

  for (const lesson of lessons) {
    const slug = `korean-level-one-${String(lesson.number).padStart(2, "0")}`;
    const { data: test, error: testError } = await db
      .from("course_tests")
      .upsert(
        {
          slug,
          lesson_id: courseLesson.id,
          course_key: "korean-level-one",
          chapter_number: lesson.number,
          title: `第${String(lesson.number).padStart(2, "0")}课`,
          korean_title: lesson.title,
          description: `依据电子书第${String(lesson.number).padStart(2, "0")}课检查${lesson.goal}。`,
          duration_minutes: 12,
          passing_score: 60,
          skills: {
            grammar: "本课语法",
            vocabulary: "核心词汇",
            communication: "情境运用",
          },
          version: 2,
          status: "published",
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (testError) throw testError;

    const { error: deleteError } = await db
      .from("course_test_questions")
      .delete()
      .eq("test_id", test.id);
    if (deleteError) throw deleteError;

    const rows = buildQuestions(lesson).map((question) => ({
      test_id: test.id,
      ...question,
      question_type: "single_choice",
      status: "published",
      tags: [
        "韩国语1级",
        `第${String(lesson.number).padStart(2, "0")}课`,
        question.difficulty,
        question.skill,
      ],
    }));
    const { error: questionError } = await db
      .from("course_test_questions")
      .insert(rows);
    if (questionError) throw questionError;
  }

  console.log(
    JSON.stringify({
      tests: lessons.length,
      questions: lessons.length * 80,
      questionsPerLesson: 80,
      questionsPerDifficulty: 20,
      activeQuestionsPerTest: activeQuestionNumbers.size,
      courseKey: "korean-level-one",
    })
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
