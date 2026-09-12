import 'server-only';
// Private read-only capture: no activity secrets, user attempts, recordings or transcript table columns.
// Never export this fixture through a route/client barrel. Object locations remain server-side.
const source = {
  "textbook": {
    "id": "7100ab2b-72b0-478e-8847-4df9b4485109",
    "slug": "korean-level-one-smart",
    "title": {
      "ko-KR": "한국어 1급",
      "zh-CN": "韩国语 1 级"
    },
    "status": "published",
    "student_app_id": "10000000-0000-4000-8000-000000000001"
  },
  "version": {
    "id": "939ad4f7-3238-425e-91e9-d456c130ca68",
    "textbook_id": "7100ab2b-72b0-478e-8847-4df9b4485109",
    "version_number": 1,
    "status": "published"
  },
  "chapter": {
    "id": "cda24fb8-c93b-4a19-9577-4418350ff708",
    "version_id": "939ad4f7-3238-425e-91e9-d456c130ca68",
    "slug": "hello",
    "chapter_number": 1,
    "title": {
      "ko-KR": "안녕하세요?",
      "zh-CN": "你好？"
    },
    "scenario": {
      "ko-KR": "왕밍은 캠퍼스 언어 교환 모임에 처음 참가합니다. 국제교류센터에서 또래 학생 지민을 만나 서로 인사하고 이름과 신분을 소개한 뒤 상대의 신분을 확인하고 자연스럽게 대화를 마칩니다.",
      "zh-CN": "王明第一次参加校园语言交换活动，在国际交流中心遇见同龄学生智敏。两人互相问候、介绍姓名与身份、确认对方身份并自然结束对话。"
    },
    "goal": {
      "ko-KR": "인사, 이름, 신분, 확인 표현을 사용하여 약 30초 동안 8턴 이상의 두 역할 첫 만남 대화를 완성합니다.",
      "zh-CN": "使用问候、姓名、身份和确认表达，完成约 30 秒、至少 8 轮的双角色初次见面对话。"
    },
    "status": "published"
  },
  "modules": [
    {
      "id": "42665398-c41e-4db8-9f0e-9626e126cba8",
      "chapter_id": "cda24fb8-c93b-4a19-9577-4418350ff708",
      "module_code": "orientation",
      "sort_order": 1,
      "title": {
        "ko-KR": "학습 안내",
        "zh-CN": "课前导航"
      },
      "description": {
        "ko-KR": "인물, 장소와 단원 과제를 먼저 확인하고 학습을 시작합니다.",
        "zh-CN": "先看清人物、地点和课末任务，再开始学习。"
      },
      "accent_role": "sky"
    },
    {
      "id": "65646324-f988-4268-bc9b-4704921e57d0",
      "chapter_id": "cda24fb8-c93b-4a19-9577-4418350ff708",
      "module_code": "vocabulary",
      "sort_order": 2,
      "title": {
        "ko-KR": "핵심 어휘",
        "zh-CN": "核心词汇"
      },
      "description": {
        "ko-KR": "이름, 신분, 만남과 인사에 필요한 핵심 어휘 12개를 익힙니다.",
        "zh-CN": "认出姓名、人物身份、见面与问候所需的 12 个核心词。"
      },
      "accent_role": "jade"
    },
    {
      "id": "ddb8b68c-5eca-478c-aa97-26ef7f7a24ab",
      "chapter_id": "cda24fb8-c93b-4a19-9577-4418350ff708",
      "module_code": "grammar",
      "sort_order": 3,
      "title": {
        "ko-KR": "문법 이해",
        "zh-CN": "语法讲解"
      },
      "description": {
        "ko-KR": "세 장의 문법 카드로 신분 서술, 화제와 확인 질문을 익힙니다.",
        "zh-CN": "用三张语法卡掌握身份判断、话题和确认疑问。"
      },
      "accent_role": "iris"
    },
    {
      "id": "016124f4-00b8-4ca5-9426-b92a0417a2a6",
      "chapter_id": "cda24fb8-c93b-4a19-9577-4418350ff708",
      "module_code": "patterns",
      "sort_order": 4,
      "title": {
        "ko-KR": "문형 연습",
        "zh-CN": "句型操练"
      },
      "description": {
        "ko-KR": "대치, 배열, 빠른 응답과 개인화 표현으로 바로 쓸 수 있는 말덩이를 만듭니다.",
        "zh-CN": "通过替换、排序、快答和个人化输出形成可调用语块。"
      },
      "accent_role": "coral"
    },
    {
      "id": "acc3107f-7255-4d65-860b-0968491f293a",
      "chapter_id": "cda24fb8-c93b-4a19-9577-4418350ff708",
      "module_code": "dialogue",
      "sort_order": 5,
      "title": {
        "ko-KR": "실전 대화",
        "zh-CN": "实战对话"
      },
      "description": {
        "ko-KR": "두 개의 완전한 장면에서 정보를 듣고 자연스럽게 반응하며 차례를 주고받습니다.",
        "zh-CN": "在两个完整场景中听取信息、自然回应并交还话轮。"
      },
      "accent_role": "sky"
    },
    {
      "id": "04226145-7dd7-4a27-a4f2-03ec766f0f1a",
      "chapter_id": "cda24fb8-c93b-4a19-9577-4418350ff708",
      "module_code": "listen_speak",
      "sort_order": 6,
      "title": {
        "ko-KR": "듣기·말하기",
        "zh-CN": "听说任务"
      },
      "description": {
        "ko-KR": "먼저 신분을 듣고 약 30초, 8턴 이상의 두 역할 대화를 제출합니다.",
        "zh-CN": "先听出身份，再提交约 30 秒、至少 8 轮的双角色对话。"
      },
      "accent_role": "jade"
    },
    {
      "id": "01e528a1-9c86-4dd3-baa6-ee87851ac521",
      "chapter_id": "cda24fb8-c93b-4a19-9577-4418350ff708",
      "module_code": "read_write",
      "sort_order": 7,
      "title": {
        "ko-KR": "읽기·쓰기",
        "zh-CN": "读写拓展"
      },
      "description": {
        "ko-KR": "새 회원 카드의 이름, 국적과 신분을 읽고 독창적인 소개 글을 씁니다.",
        "zh-CN": "读懂新成员卡中的姓名、国籍和身份，再写原创介绍。"
      },
      "accent_role": "iris"
    },
    {
      "id": "546b7ae4-142c-47c0-b4f9-04b3d5c02c3d",
      "chapter_id": "cda24fb8-c93b-4a19-9577-4418350ff708",
      "module_code": "review",
      "sort_order": 8,
      "title": {
        "ko-KR": "자기 점검",
        "zh-CN": "自测与复盘"
      },
      "description": {
        "ko-KR": "종합 문항과 다섯 가지 Can-do를 점검하고 돌아갈 학습 위치를 기록합니다.",
        "zh-CN": "完成综合检测、五项 Can-do 自查并记录返回节点。"
      },
      "accent_role": "coral"
    }
  ],
  "nodes": [
    {
      "id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "module_id": "016124f4-00b8-4ca5-9426-b92a0417a2a6",
      "node_code": "introduce-yourself",
      "node_type": "practice",
      "sort_order": 1,
      "estimated_minutes": 10,
      "title": {
        "ko-KR": "바꾸어 말하기에서 스스로 말하기까지",
        "zh-CN": "从照着换到自己说"
      },
      "content": {
        "lead": {
          "ko-KR": "낱글자가 아니라 의사소통 의미를 가진 말덩이로 연습합니다.",
          "zh-CN": "按交际意义处理完整语块，不拆成单字。"
        },
        "coach": {
          "ko-KR": "배열 문항을 맞히면 완료되며 대치, 빠른 응답과 세 문장 말하기는 자율 연습입니다.",
          "zh-CN": "排序题答对即完成；替换、快答与 3 句个人表达为自主练习。"
        },
        "pattern": "안녕하세요? → 저는 [이름]이에요/예요. → 저는 [신분]이에요/예요. → 만나서 반가워요.",
        "nextNode": "club-first-meeting",
        "patternCards": [
          {
            "form": "저는 [이름]이에요/예요.",
            "examples": [
              "저는 왕밍이에요.",
              "저는 리나예요."
            ],
            "function": {
              "ko-KR": "자신의 이름을 소개합니다.",
              "zh-CN": "介绍自己的姓名。"
            }
          },
          {
            "form": "저는 [신분]이에요/예요.",
            "examples": [
              "저는 학생이에요.",
              "저는 중국 사람이에요."
            ],
            "function": {
              "ko-KR": "자신의 신분이나 국적을 말합니다.",
              "zh-CN": "说明自己的身份或国籍。"
            }
          },
          {
            "form": "[이름] 씨는 [신분]이에요/예요?",
            "examples": [
              "지민 씨는 학생이에요?",
              "리나 씨는 선생님이에요?"
            ],
            "function": {
              "ko-KR": "상대의 신분을 공손하게 확인합니다.",
              "zh-CN": "礼貌确认对方的身份。"
            }
          },
          {
            "form": "네, [신분]이에요. / 아니요, [신분]이에요.",
            "examples": [
              "네, 학생이에요.",
              "아니요, 선생님이에요."
            ],
            "function": {
              "ko-KR": "신분을 확인하거나 공손하게 바로잡습니다.",
              "zh-CN": "肯定身份，或者礼貌更正身份。"
            }
          }
        ],
        "quickResponse": [
          "네, 학생이에요.",
          "아니요, 선생님이에요."
        ],
        "substitutions": [
          "왕밍이에요",
          "지민이에요",
          "리나예요",
          "학생이에요",
          "선생님이에요",
          "중국 사람이에요"
        ],
        "personalOutput": [
          "真实姓名",
          "真实或安全虚构国籍／地区",
          "真实或安全虚构身份"
        ],
        "substitutionGroups": [
          [
            "저는 왕밍이에요.",
            "저는 지민이에요.",
            "저는 리나예요."
          ],
          [
            "저는 학생이에요.",
            "저는 선생님이에요.",
            "저는 중국 사람이에요."
          ],
          [
            "지민 씨는 학생이에요?",
            "왕밍 씨는 선생님이에요?",
            "리나 씨는 중국 사람이에요?"
          ]
        ]
      }
    },
    {
      "id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "module_id": "ddb8b68c-5eca-478c-aa97-26ef7f7a24ab",
      "node_code": "topic-and-copula",
      "node_type": "learn",
      "sort_order": 1,
      "estimated_minutes": 14,
      "title": {
        "ko-KR": "이름과 신분을 완전하게 말하기",
        "zh-CN": "把姓名和身份说完整"
      },
      "content": {
        "lead": {
          "ko-KR": "명사의 마지막 음절에 받침이 있는지 확인해 형태를 고르고, 질문에는 별도의 의문 요소를 더하지 않습니다.",
          "zh-CN": "先看名词末音节是否有收音，再选择形态；问句不增加相当于汉语“吗”的成分。"
        },
        "coach": {
          "ko-KR": "두 차례의 여섯 빈칸을 모두 맞혀야 하며 세 문법 항목을 서로 다른 받침 조건에서 두 번씩 연습합니다.",
          "zh-CN": "两轮六项填空必须全部正确；三个语法点均在不同收音条件下练习两遍。"
        },
        "nextNode": "introduce-yourself",
        "grammarCards": [
          {
            "form": "N이에요/예요",
            "rules": [
              "有收音：N + 이에요",
              "无收音：N + 예요",
              "与前面名词连写；예요 不能写成 에요"
            ],
            "source": {
              "ko-KR": "원고 §5.1; 기존 전자책의 정확한 쪽수는 수동 확인이 필요합니다.",
              "zh-CN": "母本 §5.1；旧版电子书精确页码待人工核对。"
            },
            "caution": {
              "ko-KR": "잘못: 저는 리나에요. 바른 표현: 저는 리나예요.",
              "zh-CN": "错误：저는 리나에요. 正确：저는 리나예요."
            },
            "examples": [
              {
                "ko": "저는 학생이에요.",
                "zh": "我是学生。",
                "audioId": "chapter-01-grammar-01-example-01",
                "audioStatus": "pending"
              },
              {
                "ko": "저는 왕밍이에요. 네, 학생이에요.",
                "zh": "我叫王明。是的，我是学生。",
                "audioId": "chapter-01-grammar-01-example-02",
                "audioStatus": "pending"
              },
              {
                "ko": "저는 리나예요. 학생이에요.",
                "zh": "我叫丽娜。我是学生。",
                "audioId": "chapter-01-grammar-01-example-03",
                "audioStatus": "pending"
              }
            ],
            "function": {
              "ko-KR": "이름, 국적이나 신분을 설명합니다.",
              "zh-CN": "说明姓名、国籍或身份。"
            }
          },
          {
            "form": "N은/는",
            "rules": [
              "有收音：N + 은",
              "无收音：N + 는",
              "은/는 不是“是”，句末仍需要谓语"
            ],
            "source": {
              "ko-KR": "원고 §5.2; 기존 전자책의 정확한 쪽수는 수동 확인이 필요합니다.",
              "zh-CN": "母本 §5.2；旧版电子书精确页码待人工核对。"
            },
            "caution": {
              "ko-KR": "잘못: 저 학생이에요는. 는은 화제 바로 뒤에 옵니다.",
              "zh-CN": "错误：저 학생이에요는. 는 必须紧跟话题。"
            },
            "examples": [
              {
                "ko": "저는 왕밍이에요.",
                "zh": "我叫王明。",
                "audioId": "chapter-01-grammar-02-example-01",
                "audioStatus": "pending"
              },
              {
                "ko": "지민 씨는 학생이에요?",
                "zh": "智敏，你是学生吗？",
                "audioId": "chapter-01-grammar-02-example-02",
                "audioStatus": "pending"
              },
              {
                "ko": "리나 씨는 중국 사람이에요?",
                "zh": "丽娜，你是中国人吗？",
                "audioId": "chapter-01-grammar-02-example-03",
                "audioStatus": "pending"
              }
            ],
            "function": {
              "ko-KR": "나 또는 상대를 현재 대화의 화제로 제시합니다.",
              "zh-CN": "把“我”或对方设为当前谈话主题。"
            }
          },
          {
            "form": "N이에요/예요?",
            "rules": [
              "书写形态与陈述句相同",
              "口语句末自然上扬",
              "回答应补全身份信息"
            ],
            "source": {
              "ko-KR": "원고 §5.3; 기존 전자책의 정확한 쪽수는 수동 확인이 필요합니다.",
              "zh-CN": "母本 §5.3；旧版电子书精确页码待人工核对。"
            },
            "caution": {
              "ko-KR": "잘못: 학생이에요 까? 바른 표현: 학생이에요?",
              "zh-CN": "错误：학생이에요 까? 正确：학생이에요?"
            },
            "examples": [
              {
                "ko": "지민 씨는 학생이에요?",
                "zh": "智敏，你是学生吗？",
                "audioId": "chapter-01-grammar-03-example-01",
                "audioStatus": "pending"
              },
              {
                "ko": "왕밍 씨는 중국 사람이에요?",
                "zh": "王明，你是中国人吗？",
                "audioId": "chapter-01-grammar-03-example-02",
                "audioStatus": "pending"
              },
              {
                "ko": "리나 씨는 선생님이에요? 아니요, 학생이에요.",
                "zh": "丽娜，你是老师吗？不，我是学生。",
                "audioId": "chapter-01-grammar-03-example-03",
                "audioStatus": "pending"
              }
            ],
            "function": {
              "ko-KR": "상대의 이름, 국적이나 신분을 공손하게 확인합니다.",
              "zh-CN": "礼貌确认对方的姓名、国籍或身份。"
            }
          }
        ]
      }
    },
    {
      "id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "module_id": "65646324-f988-4268-bc9b-4704921e57d0",
      "node_code": "people-and-greetings",
      "node_type": "learn",
      "sort_order": 1,
      "estimated_minutes": 9,
      "title": {
        "ko-KR": "누구인지, 무엇을 하는지 먼저 이해하기",
        "zh-CN": "先听懂“谁”和“做什么”"
      },
      "content": {
        "lead": {
          "ko-KR": "상황으로 뜻을 짐작하고, 음원을 따라 읽고, 결합 표현으로 말한 뒤 대화에서 다시 확인합니다. 정식 음원은 제작 대기 중입니다.",
          "zh-CN": "按“看场景猜词—点读母稿跟读—用搭配说短句—回到对话再认”的顺序学习；正式点读音频均待制作。"
        },
        "coach": {
          "ko-KR": "12개 어휘 따라 읽기와 문장 완성은 자율 연습이며, 뜻 문항 정답과 문장 낭독 확인이 필수 증거입니다.",
          "zh-CN": "12 词跟读与补句是自主练习；强制证据是词义题答对并确认已朗读整句。"
        },
        "nextNode": "topic-and-copula",
        "vocabulary": [
          {
            "ko": "저",
            "zh": "我（谦称）",
            "pos": "代词",
            "collocation": "저는 학생이에요.",
            "transcription": "저"
          },
          {
            "ko": "이름",
            "zh": "名字",
            "pos": "名词",
            "collocation": "이름이 뭐예요?",
            "transcription": "이름"
          },
          {
            "ko": "학생",
            "zh": "学生",
            "pos": "名词",
            "collocation": "학생이에요.",
            "transcription": "학쌩"
          },
          {
            "ko": "선생님",
            "zh": "老师",
            "pos": "名词",
            "collocation": "선생님이에요.",
            "transcription": "선생님"
          },
          {
            "ko": "친구",
            "zh": "朋友",
            "pos": "名词",
            "collocation": "친구를 만나요.",
            "transcription": "친구"
          },
          {
            "ko": "사람",
            "zh": "人",
            "pos": "名词",
            "collocation": "중국 사람이에요.",
            "transcription": "사람"
          },
          {
            "ko": "만나다",
            "zh": "见面",
            "pos": "动词",
            "collocation": "처음 만나요.",
            "transcription": "만나다"
          },
          {
            "ko": "인사하다",
            "zh": "问候",
            "pos": "动词",
            "collocation": "친구에게 인사해요.",
            "transcription": "인사하다"
          },
          {
            "ko": "소개하다",
            "zh": "介绍",
            "pos": "动词",
            "collocation": "자신을 소개해요.",
            "transcription": "소개하다"
          },
          {
            "ko": "한국어",
            "zh": "韩语",
            "pos": "名词",
            "collocation": "한국어를 배워요.",
            "transcription": "한구거"
          },
          {
            "ko": "처음",
            "zh": "第一次",
            "pos": "名词·副词",
            "collocation": "처음 만나요.",
            "transcription": "처음"
          },
          {
            "ko": "반갑다",
            "zh": "高兴、荣幸",
            "pos": "形容词",
            "collocation": "만나서 반가워요.",
            "transcription": "반갑따"
          }
        ]
      }
    },
    {
      "id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "module_id": "acc3107f-7255-4d65-860b-0968491f293a",
      "node_code": "club-first-meeting",
      "node_type": "mission",
      "sort_order": 1,
      "estimated_minutes": 11,
      "title": {
        "ko-KR": "두 사람이 실제로 번갈아 말하기",
        "zh-CN": "两个人真正轮流说"
      },
      "content": {
        "lead": {
          "ko-KR": "장면 1은 8턴의 주 대화이고 장면 2는 신분을 잘못 짐작한 뒤 자연스럽게 고치는 대화입니다. 전체와 문장별 정식 음원은 제작 대기 중입니다.",
          "zh-CN": "场景 1 为 8 轮主对话；场景 2 展示身份猜错后的自然更正。整段与逐句正式音频均待制作。"
        },
        "coach": {
          "ko-KR": "두 장면의 신분 사실 문항과 장면 1의 마무리 응답 문항을 완료합니다. 정보 바꾸기와 시험 녹음은 자율 연습입니다.",
          "zh-CN": "完成两场景身份事实组合题和场景 1 结束语回应题；替换与试录为自主练习。"
        },
        "nextNode": "listen-and-respond",
        "dialogueFlow": [
          {
            "order": 1,
            "title": {
              "ko-KR": "처음 만남",
              "zh-CN": "初次见面"
            },
            "words": [
              "처음",
              "만나다",
              "인사하다"
            ],
            "description": {
              "ko-KR": "처음 만난 상황을 확인하고 인사로 자연스럽게 대화를 시작합니다.",
              "zh-CN": "先确认是第一次见面，用问候自然开启交流。"
            }
          },
          {
            "order": 2,
            "title": {
              "ko-KR": "자기소개",
              "zh-CN": "介绍自己"
            },
            "words": [
              "저",
              "이름",
              "소개하다",
              "한국어"
            ],
            "description": {
              "ko-KR": "자신과 이름, 배우는 언어를 소개합니다.",
              "zh-CN": "说明自己、姓名以及正在学习的语言。"
            }
          },
          {
            "order": 3,
            "title": {
              "ko-KR": "사람과 신분 확인",
              "zh-CN": "确认人物与身份"
            },
            "words": [
              "학생",
              "선생님",
              "친구",
              "사람"
            ],
            "description": {
              "ko-KR": "친구를 소개하고 학생인지 선생님인지 확인합니다.",
              "zh-CN": "介绍朋友，并确认对方是学生还是老师。"
            }
          },
          {
            "order": 4,
            "title": {
              "ko-KR": "공손하게 마무리",
              "zh-CN": "礼貌结束"
            },
            "words": [
              "반갑다"
            ],
            "description": {
              "ko-KR": "만나서 기쁘다는 표현으로 서로 응답하며 대화를 마칩니다.",
              "zh-CN": "用见面高兴的表达回应对方并结束交流。"
            }
          }
        ],
        "dialogueScenes": [
          {
            "id": "first-meeting",
            "lines": [
              {
                "ko": "안녕하세요? 우리 처음 만나요. 저는 김지민이에요.",
                "zh": "你好！我们是第一次见面吧？我叫金智敏。",
                "words": [
                  "처음",
                  "만나다",
                  "저"
                ],
                "speaker": "지민"
              },
              {
                "ko": "안녕하세요? 제 이름은 왕밍이에요.",
                "zh": "你好！我的名字叫王明。",
                "words": [
                  "이름"
                ],
                "speaker": "왕밍"
              },
              {
                "ko": "왕밍 씨는 학생이에요?",
                "zh": "王明，你是学生吗？",
                "words": [
                  "학생"
                ],
                "speaker": "지민"
              },
              {
                "ko": "네, 학생이에요. 한국어를 배워요.",
                "zh": "是的，我是学生。我学习韩语。",
                "words": [
                  "학생",
                  "한국어"
                ],
                "speaker": "왕밍"
              },
              {
                "ko": "지민 씨도 학생이에요?",
                "zh": "智敏，你也是学生吗？",
                "words": [
                  "학생"
                ],
                "speaker": "왕밍"
              },
              {
                "ko": "네, 저도 학생이에요.",
                "zh": "是的，我也是学生。",
                "words": [
                  "저",
                  "학생"
                ],
                "speaker": "지민"
              },
              {
                "ko": "만나서 반가워요.",
                "zh": "很高兴认识你。",
                "words": [
                  "만나다",
                  "반갑다"
                ],
                "speaker": "왕밍"
              },
              {
                "ko": "저도 만나서 반가워요.",
                "zh": "我也很高兴认识你。",
                "words": [
                  "저",
                  "만나다",
                  "반갑다"
                ],
                "speaker": "지민"
              }
            ],
            "title": {
              "ko-KR": "장면 1｜처음 만남",
              "zh-CN": "场景 1｜第一次见面"
            },
            "context": {
              "ko-KR": "왕밍과 지민이 교내 언어 교환 접수대에서 처음 만나 이름을 나누고 학생 신분을 확인한 뒤 인사를 마칩니다.",
              "zh-CN": "王明与智敏在校园语言交换签到区第一次见面，交换姓名、确认学生身份并礼貌结束。"
            },
            "coverage": [
              "처음",
              "만나다",
              "저",
              "이름",
              "학생",
              "한국어",
              "반갑다"
            ]
          },
          {
            "id": "introduce-and-correct",
            "lines": [
              {
                "ko": "두 사람은 처음 만나지요? 제 친구 리나 씨를 소개할게요.",
                "zh": "你们两位是第一次见面吧？我来介绍我的朋友丽娜。",
                "words": [
                  "사람",
                  "처음",
                  "만나다",
                  "친구",
                  "소개하다"
                ],
                "speaker": "민지"
              },
              {
                "ko": "안녕하세요? 리나 씨는 선생님이에요?",
                "zh": "你好！丽娜，你是老师吗？",
                "words": [
                  "인사하다",
                  "선생님"
                ],
                "speaker": "왕밍"
              },
              {
                "ko": "아니요, 저는 학생이에요. 중국 사람이에요.",
                "zh": "不是，我是学生，是中国人。",
                "words": [
                  "저",
                  "학생",
                  "사람"
                ],
                "speaker": "리나"
              },
              {
                "ko": "왕밍 씨도 한국어를 배워요. 서로 인사하세요.",
                "zh": "王明也学习韩语。你们互相问候吧。",
                "words": [
                  "한국어",
                  "인사하다"
                ],
                "speaker": "민지"
              },
              {
                "ko": "만나서 반가워요.",
                "zh": "很高兴认识你。",
                "words": [
                  "만나다",
                  "반갑다"
                ],
                "speaker": "왕밍"
              },
              {
                "ko": "저도 반가워요.",
                "zh": "我也很高兴认识你。",
                "words": [
                  "저",
                  "반갑다"
                ],
                "speaker": "리나"
              }
            ],
            "title": {
              "ko-KR": "장면 2｜친구 소개와 신분 정정",
              "zh-CN": "场景 2｜介绍朋友与身份更正"
            },
            "context": {
              "ko-KR": "민지가 처음 만나는 두 친구를 소개합니다. 왕밍이 리나를 선생님으로 생각하지만 리나가 공손히 바로잡고 서로 인사합니다.",
              "zh-CN": "敏智介绍两位第一次见面的朋友；王明误以为丽娜是老师，丽娜礼貌更正后互相问候。"
            },
            "coverage": [
              "사람",
              "처음",
              "만나다",
              "친구",
              "소개하다",
              "선생님",
              "저",
              "학생",
              "한국어",
              "인사하다",
              "반갑다"
            ]
          }
        ]
      }
    },
    {
      "id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "module_id": "04226145-7dd7-4a27-a4f2-03ec766f0f1a",
      "node_code": "listen-and-respond",
      "node_type": "practice",
      "sort_order": 1,
      "estimated_minutes": 10,
      "title": {
        "ko-KR": "신분을 듣고 30초 대화 완성하기",
        "zh-CN": "听出身份，再完成 30 秒交流"
      },
      "content": {
        "lead": {
          "ko-KR": "그림이 아니라 음성의 실제 표현을 근거로 답해야 합니다. 정식 듣기는 원어민 검수, 녹음과 파일 확인 대기 중입니다.",
          "zh-CN": "听力依据必须来自音频原话，不能根据人物形象猜答案。正式听力仍待母语审校、录制与文件核验。"
        },
        "coach": {
          "ko-KR": "현재 발음 점수는 제공하지 않으며 녹음 시간, 대화 차례 수와 학습자가 확인한 다섯 정보만 기록합니다.",
          "zh-CN": "当前不提供发音评分；系统只核对录音时长、话轮数和学习者确认的五项信息。"
        },
        "nextNode": "profile-note",
        "listenFor": [
          "姓名",
          "国籍／地区",
          "身份词",
          "结束语"
        ],
        "repeatLines": [
          {
            "ko": "안녕하세요?",
            "zh": "你好。",
            "audioAssetKey": "chapter-01-listening-repeat-01"
          },
          {
            "ko": "저는 수진이에요.",
            "zh": "我叫秀珍。",
            "audioAssetKey": "chapter-01-listening-repeat-02"
          },
          {
            "ko": "한국 사람이에요.",
            "zh": "我是韩国人。",
            "audioAssetKey": "chapter-01-listening-repeat-03"
          },
          {
            "ko": "저는 학생이에요.",
            "zh": "我是学生。",
            "audioAssetKey": "chapter-01-listening-repeat-04"
          },
          {
            "ko": "한국어를 배워요.",
            "zh": "我学习韩语。",
            "audioAssetKey": "chapter-01-listening-repeat-05"
          },
          {
            "ko": "만나서 반가워요.",
            "zh": "很高兴认识你。",
            "audioAssetKey": "chapter-01-listening-repeat-06"
          }
        ],
        "repeatTracks": [
          {
            "id": "listening-a",
            "lines": [
              {
                "ko": "안녕하세요?",
                "zh": "你好。"
              },
              {
                "ko": "저는 수진이에요.",
                "zh": "我叫秀珍。"
              },
              {
                "ko": "한국 사람이에요.",
                "zh": "我是韩国人。"
              },
              {
                "ko": "저는 학생이에요.",
                "zh": "我是学生。"
              },
              {
                "ko": "요즘 한국어를 배워요.",
                "zh": "最近我在学习韩语。"
              },
              {
                "ko": "처음 만나서 반가워요.",
                "zh": "初次见面，很高兴认识你。"
              }
            ],
            "title": {
              "ko-KR": "듣기 A · 수진의 자기소개",
              "zh-CN": "听力 A · 秀珍自我介绍"
            },
            "keywords": [
              "수진",
              "한국 사람",
              "학생",
              "한국어"
            ]
          },
          {
            "id": "listening-b",
            "lines": [
              {
                "ko": "안녕하세요?",
                "zh": "你好。"
              },
              {
                "ko": "저는 왕밍이에요.",
                "zh": "我叫王明。"
              },
              {
                "ko": "중국 사람이에요.",
                "zh": "我是中国人。"
              },
              {
                "ko": "저는 회사원이에요.",
                "zh": "我是公司职员。"
              },
              {
                "ko": "요즘 한국어를 배워요.",
                "zh": "最近我在学习韩语。"
              },
              {
                "ko": "지민 씨는 학생이에요?",
                "zh": "智敏是学生吗？"
              },
              {
                "ko": "네, 학생이에요.",
                "zh": "是的，我是学生。"
              },
              {
                "ko": "만나서 반가워요.",
                "zh": "很高兴认识你。"
              }
            ],
            "title": {
              "ko-KR": "듣기 B · 왕밍과 지민의 첫 만남",
              "zh-CN": "听力 B · 王明与智敏初次见面"
            },
            "keywords": [
              "왕밍",
              "중국 사람",
              "회사원",
              "지민·학생"
            ]
          }
        ],
        "speakingFrame": "A/B：问候 → 双方姓名 → 身份确认问答 → 双方礼貌结束",
        "listeningFocus": [
          {
            "ko-KR": "말하는 사람의 이름",
            "zh-CN": "说话人的姓名"
          },
          {
            "ko-KR": "국적 또는 지역 정보",
            "zh-CN": "国籍或地区信息"
          },
          {
            "ko-KR": "학생, 선생님 등의 신분 표현",
            "zh-CN": "学生、老师等身份词"
          },
          {
            "ko-KR": "첫 만남을 마치는 표현",
            "zh-CN": "结束初次见面的表达"
          }
        ],
        "outputChecklist": [
          "问候",
          "姓名",
          "身份",
          "正在学习韩语",
          "礼貌结束"
        ],
        "listenSpeakPages": [
          {
            "id": "prepare",
            "title": {
              "ko-KR": "듣기 준비",
              "zh-CN": "听前准备"
            },
            "description": {
              "ko-KR": "전체 원고를 보기 전에 상황과 들어야 할 정보를 확인하세요.",
              "zh-CN": "先明确场景与需要捕捉的信息，不提前展示完整原文。"
            }
          },
          {
            "id": "identify",
            "title": {
              "ko-KR": "정보 듣기",
              "zh-CN": "听辨信息"
            },
            "description": {
              "ko-KR": "음성의 실제 표현으로 이름, 신분과 마무리 말을 판단하세요.",
              "zh-CN": "依据音频原话判断姓名、身份和结束表达。"
            }
          },
          {
            "id": "repeat",
            "title": {
              "ko-KR": "듣고 따라 말하기",
              "zh-CN": "跟读复现"
            },
            "description": {
              "ko-KR": "문장별로 듣고 자연스러운 리듬으로 따라 말하세요. 정식 음원은 제작 대기 중입니다.",
              "zh-CN": "逐句听示范并按自然节奏复现。正式点读音频待制作。"
            }
          },
          {
            "id": "output",
            "title": {
              "ko-KR": "독립 말하기",
              "zh-CN": "独立表达"
            },
            "description": {
              "ko-KR": "문장별 원고 없이 약 30초의 완전한 표현을 녹음하세요.",
              "zh-CN": "脱离逐句原文，完成约 30 秒的完整表达。"
            }
          }
        ],
        "listeningContext": {
          "ko-KR": "캠퍼스 언어 교환 모임에서 새 회원이 자기소개를 합니다.",
          "zh-CN": "校园语言交换活动中新成员进行自我介绍。"
        },
        "speakingCriteria": [
          "双方问候",
          "双方姓名",
          "至少一次身份确认问句",
          "肯定或否定回答",
          "双方礼貌结束"
        ],
        "formalAudioStatus": "pending"
      }
    },
    {
      "id": "a834273c-7858-4ad1-8587-97007acd90fb",
      "module_id": "01e528a1-9c86-4dd3-baa6-ee87851ac521",
      "node_code": "profile-note",
      "node_type": "practice",
      "sort_order": 1,
      "estimated_minutes": 10,
      "title": {
        "ko-KR": "새 회원 카드를 읽고 자기소개 쓰기",
        "zh-CN": "读一张新成员卡，写自己的介绍"
      },
      "content": {
        "lead": {
          "ko-KR": "인사—이름—국적·지역—신분·학습 내용—마무리 순서로 정보를 찾습니다.",
          "zh-CN": "按“问候—姓名—国籍／地区—身份／学习内容—结束语”找信息。"
        },
        "coach": {
          "ko-KR": "읽기 세 문항을 모두 맞히고 네 가지 이상 정보를 담은 4~5문장의 독창적인 글과 평가표 점검을 제출합니다.",
          "zh-CN": "阅读三题全部答对，并提交 4—5 句、至少四类信息且完成量规自查的原创介绍。"
        },
        "rubric": [
          "信息完整",
          "核心语法",
          "可理解度",
          "格式与语气"
        ],
        "reading": "안녕하세요? 저는 리나예요. 중국 사람이에요. 학생이에요. 한국어를 배워요. 만나서 반가워요.",
        "nextNode": "can-do-check",
        "questions": [
          "이 사람의 이름은 뭐예요?",
          "어느 나라 사람이에요?",
          "학생이에요, 선생님이에요?"
        ],
        "writingFrame": "안녕하세요? → 저는 ___이에요/예요. → ___ 사람이에요.／___를 배워요. → 저는 ___이에요/예요. → 만나서 반가워요.",
        "originalExample": "안녕하세요? 저는 다니엘이에요. 캐나다 사람이에요. 저는 학생이에요. 만나서 반가워요."
      }
    },
    {
      "id": "f0e8db18-ad29-46b3-b9c1-6a0b0717fd51",
      "module_id": "546b7ae4-142c-47c0-b4f9-04b3d5c02c3d",
      "node_code": "can-do-check",
      "node_type": "review",
      "sort_order": 1,
      "estimated_minutes": 8,
      "title": {
        "ko-KR": "첫 만남을 혼자 완성할 수 있나요?",
        "zh-CN": "我能独立完成第一次见面吗？"
      },
      "content": {
        "lead": {
          "ko-KR": "오류를 어휘, 문법, 이해 또는 표현으로 나누고 해당 학습 위치로 돌아가 연습합니다.",
          "zh-CN": "把错误分到词汇、语法、理解或表达，再回到对应节点补练。"
        },
        "coach": {
          "ko-KR": "종합 복수 선택과 다섯 항목 자기 점검을 모두 제출하고 여덟 노드를 완료해야 단원 평가가 열립니다.",
          "zh-CN": "综合多选与五项自查都提交后完成；八节点全部完成才解锁章节测试。"
        },
        "nextNode": "chapter-test:korean-level-one-01",
        "checklist": [
          {
            "ko": "안녕하세요?로 먼저 인사할 수 있어요.",
            "zh": "我能主动问候"
          },
          {
            "ko": "이름과 신분을 소개할 수 있어요.",
            "zh": "我能介绍姓名与身份"
          },
          {
            "ko": "상대의 신분을 묻고 대답할 수 있어요.",
            "zh": "我能询问并回答身份"
          },
          {
            "ko": "만나서 반가워요로 자연스럽게 마칠 수 있어요.",
            "zh": "我能自然结束交流"
          },
          {
            "ko": "두 역할로 30초 동안 대화할 수 있어요.",
            "zh": "我能完成 30 秒、8 轮以上双角色对话"
          }
        ],
        "returnMap": [
          {
            "node": "people-and-greetings",
            "reason": "词汇"
          },
          {
            "node": "topic-and-copula",
            "reason": "语法"
          },
          {
            "node": "club-first-meeting",
            "reason": "理解"
          },
          {
            "node": "listen-and-respond",
            "reason": "表达"
          }
        ]
      }
    },
    {
      "id": "9fe730cd-a102-496e-adc5-9973b697af68",
      "module_id": "42665398-c41e-4db8-9f0e-9626e126cba8",
      "node_code": "mission-map",
      "node_type": "mission",
      "sort_order": 1,
      "estimated_minutes": 5,
      "title": {
        "ko-KR": "첫 만남에서 어떻게 말을 시작할까요?",
        "zh-CN": "第一次见面，怎样开口？"
      },
      "content": {
        "lead": {
          "ko-KR": "왕밍은 국제교류센터에서 지민을 처음 만나 인사하고 서로의 이름과 학생 신분을 확인합니다.",
          "zh-CN": "王明在校园国际交流中心第一次见到智敏，需要先问候，再交换双方姓名与学生身份。"
        },
        "coach": {
          "ko-KR": "단원 마지막에는 한 사람의 독백이 아니라 두 역할이 8턴 이상 번갈아 말해야 합니다.",
          "zh-CN": "课末输出是两个角色交替至少 8 轮的对话，不以单人自我介绍代替。"
        },
        "targets": [
          {
            "ko": "안녕하세요?",
            "zh": "主动问候"
          },
          {
            "ko": "저는 왕밍이에요.",
            "zh": "介绍姓名"
          },
          {
            "ko": "지민 씨는 학생이에요?",
            "zh": "确认身份"
          },
          {
            "ko": "네, 학생이에요. 만나서 반가워요.",
            "zh": "礼貌结束"
          }
        ],
        "nextNode": "people-and-greetings",
        "completion": {
          "ko-KR": "점수에 포함되지 않는 진단 문항을 맞히면 완료됩니다.",
          "zh-CN": "答对不计分诊断后完成本节点。"
        },
        "dialogueGroups": [
          {
            "id": "greeting",
            "lines": [
              {
                "ko": "안녕하세요?",
                "zh": "你好？",
                "speaker": "王明"
              },
              {
                "ko": "네, 안녕하세요?",
                "zh": "嗯，你好？",
                "speaker": "智敏"
              }
            ],
            "title": {
              "ko-KR": "인사",
              "zh-CN": "问候"
            }
          },
          {
            "id": "introductions",
            "lines": [
              {
                "ko": "저는 왕밍이에요.",
                "zh": "我是王明。",
                "speaker": "王明"
              },
              {
                "ko": "저는 지민이에요.",
                "zh": "我是智敏。",
                "speaker": "智敏"
              }
            ],
            "title": {
              "ko-KR": "자기소개",
              "zh-CN": "自我介绍"
            }
          },
          {
            "id": "student-status",
            "lines": [
              {
                "ko": "지민 씨는 학생이에요?",
                "zh": "智敏是学生吗？",
                "speaker": "王明"
              },
              {
                "ko": "네, 학생이에요.",
                "zh": "是的，是学生。",
                "speaker": "智敏"
              }
            ],
            "title": {
              "ko-KR": "신분 확인",
              "zh-CN": "确认身份"
            }
          },
          {
            "id": "complete-first-meeting",
            "lines": [
              {
                "ko": "안녕하세요?",
                "zh": "你好？",
                "speaker": "王明"
              },
              {
                "ko": "네, 안녕하세요?",
                "zh": "嗯，你好？",
                "speaker": "智敏"
              },
              {
                "ko": "저는 왕밍이에요.",
                "zh": "我是王明。",
                "speaker": "王明"
              },
              {
                "ko": "저는 지민이에요.",
                "zh": "我是智敏。",
                "speaker": "智敏"
              },
              {
                "ko": "지민 씨는 학생이에요?",
                "zh": "智敏是学生吗？",
                "speaker": "王明"
              },
              {
                "ko": "네, 학생이에요.",
                "zh": "是的，是学生。",
                "speaker": "智敏"
              },
              {
                "ko": "만나서 반가워요.",
                "zh": "很高兴认识你。",
                "speaker": "王明"
              },
              {
                "ko": "네, 저도 만나서 반가워요.",
                "zh": "嗯，我也很高兴认识你。",
                "speaker": "智敏"
              }
            ],
            "title": {
              "ko-KR": "전체 대화",
              "zh-CN": "完整对话"
            }
          }
        ]
      }
    }
  ],
  "activities": [
    {
      "id": "aafa6ccc-4d4a-4dba-9315-2f30381e8a13",
      "node_id": "9fe730cd-a102-496e-adc5-9973b697af68",
      "activity_key": "orientation-check",
      "activity_type": "single_choice",
      "sort_order": 1,
      "prompt": {
        "ko-KR": "왕밍과 지민이 처음 만났을 때 먼저 무슨 말을 했어요?",
        "zh-CN": "王明和智敏初次见面时先说了什么？"
      },
      "instruction": {
        "ko-KR": "1쪽 대화에서 두 사람이 처음 만났을 때 한 인사를 고르세요. 점수에는 포함되지 않습니다.",
        "zh-CN": "根据第 1 页的对话选择两人初次见面时的问候；本题不计分。"
      },
      "options": [
        "안녕하세요?",
        "얼마예요?",
        "어디에 있어요?",
        "감기에 걸렸어요."
      ],
      "public_config": {
        "shuffle": false,
        "showScore": false
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "ed75866c-2a53-4538-90ad-e71c2737dfef",
      "node_id": "a834273c-7858-4ad1-8587-97007acd90fb",
      "activity_key": "write-profile",
      "activity_type": "writing",
      "sort_order": 2,
      "prompt": {
        "ko-KR": "언어 교환 모임의 새 회원 소개를 4~5문장으로 쓰세요.",
        "zh-CN": "为语言交换社团写一张 4—5 句的新成员介绍卡。"
      },
      "instruction": {
        "ko-KR": "예시를 베끼지 말고 안전한 자기 정보를 쓴 뒤 네 가지 평가 기준을 점검하세요.",
        "zh-CN": "写安全的原创信息，不复制示范；完成四维量规自查。"
      },
      "options": [],
      "public_config": {
        "maxSentences": 5,
        "minSentences": 4,
        "rubricConfirmation": "我已按信息完整、核心语法、可理解度、格式与语气完成自查",
        "minimumPhraseGroups": 4,
        "informationChecklist": [
          "问候",
          "姓名",
          "国籍／地区或语言背景",
          "身份",
          "结束语"
        ],
        "requiredPhraseGroups": [
          [
            "안녕하세요"
          ],
          [
            "저는",
            "제 이름"
          ],
          [
            "학생이에요",
            "선생님이에요",
            "회사원이에요",
            "사람이에요"
          ],
          [
            "만나서 반가워요"
          ]
        ],
        "minimumHangulCharacters": 20,
        "minimumInformationKinds": 4
      },
      "max_attempts": 3,
      "counts_toward_completion": false
    },
    {
      "id": "30f7ecfa-3ad6-45d1-8373-9bfeb12c220e",
      "node_id": "f0e8db18-ad29-46b3-b9c1-6a0b0717fd51",
      "activity_key": "review-multiple",
      "activity_type": "multiple_choice",
      "sort_order": 1,
      "prompt": {
        "ko-KR": "‘첫 만남 대화’를 직접 완성하는 데 도움이 되는 표현을 모두 고르세요.",
        "zh-CN": "选择所有能直接帮助完成“初次见面对话”的表达。"
      },
      "instruction": {
        "ko-KR": "맞는 표현을 모두 고르고 틀린 표현은 고르지 않아야 합니다.",
        "zh-CN": "全部选对且不多选才算正确。"
      },
      "options": [
        "안녕하세요?",
        "저는 학생이에요.",
        "만나서 반가워요.",
        "감기에 걸렸어요."
      ],
      "public_config": {
        "selection": "multiple"
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "8a7f51e8-e982-47da-ae40-ea7698986ec4",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "activity_key": "vocabulary-check",
      "activity_type": "single_choice",
      "sort_order": 1,
      "prompt": {
        "ko-KR": "핵심 어휘 12개의 뜻을 모두 확인하세요.",
        "zh-CN": "完成 12 个核心词的词义练习。"
      },
      "instruction": {
        "ko-KR": "각 단어에 맞는 뜻을 하나씩 고르고 12문항을 모두 푼 뒤 제출하세요.",
        "zh-CN": "每个单词选择一个正确释义，12 题全部作答后统一提交。"
      },
      "options": [],
      "public_config": {
        "items": [
          {
            "id": "word-jeo",
            "options": [
              "我（谦称）",
              "名字",
              "朋友",
              "老师"
            ],
            "question": "저"
          },
          {
            "id": "word-ireum",
            "options": [
              "名字",
              "学生",
              "问候",
              "韩语"
            ],
            "question": "이름"
          },
          {
            "id": "word-haksaeng",
            "options": [
              "老师",
              "学生",
              "朋友",
              "人"
            ],
            "question": "학생"
          },
          {
            "id": "word-seonsaengnim",
            "options": [
              "朋友",
              "老师",
              "学生",
              "名字"
            ],
            "question": "선생님"
          },
          {
            "id": "word-chingu",
            "options": [
              "人",
              "老师",
              "朋友",
              "我（谦称）"
            ],
            "question": "친구"
          },
          {
            "id": "word-saram",
            "options": [
              "学生",
              "人",
              "第一次",
              "见面"
            ],
            "question": "사람"
          },
          {
            "id": "word-mannada",
            "options": [
              "问候",
              "介绍",
              "见面",
              "学习"
            ],
            "question": "만나다"
          },
          {
            "id": "word-insahada",
            "options": [
              "学习",
              "介绍",
              "问候",
              "见面"
            ],
            "question": "인사하다"
          },
          {
            "id": "word-sogaehada",
            "options": [
              "介绍",
              "问候",
              "高兴、荣幸",
              "韩语"
            ],
            "question": "소개하다"
          },
          {
            "id": "word-hangugeo",
            "options": [
              "中国人",
              "名字",
              "韩语",
              "老师"
            ],
            "question": "한국어"
          },
          {
            "id": "word-cheoeum",
            "options": [
              "一起",
              "第一次",
              "朋友",
              "高兴、荣幸"
            ],
            "question": "처음"
          },
          {
            "id": "word-bangapda",
            "options": [
              "询问",
              "学习",
              "高兴、荣幸",
              "介绍"
            ],
            "question": "반갑다"
          }
        ],
        "shuffle": true,
        "presentation": "flip_cards",
        "shuffleOptions": true
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "08056544-a7d0-41c0-998c-1a2a39978125",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "activity_key": "pattern-order",
      "activity_type": "ordering",
      "sort_order": 2,
      "prompt": {
        "ko-KR": "네 개의 말덩이로 자연스러운 자기소개 만들기",
        "zh-CN": "四个语块排成自然的自我介绍"
      },
      "instruction": {
        "ko-KR": "문장을 차례로 골라 ‘인사—이름—신분—마무리’ 표현 흐름을 완성하세요.",
        "zh-CN": "依次选择句子，完成“问候—姓名—身份—结束语”的表达路径。"
      },
      "options": [
        "만나서 반가워요.",
        "저는 학생이에요.",
        "안녕하세요?",
        "저는 리나예요."
      ],
      "public_config": {
        "pathLabels": [
          {
            "id": "greeting",
            "ko-KR": "인사",
            "zh-CN": "问候"
          },
          {
            "id": "name",
            "ko-KR": "이름",
            "zh-CN": "姓名"
          },
          {
            "id": "identity",
            "ko-KR": "신분",
            "zh-CN": "身份"
          },
          {
            "id": "closing",
            "ko-KR": "마무리",
            "zh-CN": "结束语"
          }
        ],
        "resettable": true,
        "presentation": "expression_path"
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "f4944f6f-cfcc-403c-a1d8-acea7ef2151f",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "activity_key": "dialogue-fact-check",
      "activity_type": "single_choice",
      "sort_order": 1,
      "prompt": {
        "ko-KR": "두 장면의 신분 정보를 모두 바르게 정리한 것은 무엇이에요?",
        "zh-CN": "哪一组选项同时正确概括两个场景的身份信息？"
      },
      "instruction": {
        "ko-KR": "‘장면 1의 공통 신분／장면 2에서 처음 짐작한 신분’의 맞는 조합을 고르세요.",
        "zh-CN": "选择“场景 1 共同身份／场景 2 最初误认身份”的正确组合。"
      },
      "options": [
        "학생／선생님",
        "학생／회사원",
        "선생님／학생",
        "친구／의사"
      ],
      "public_config": {
        "shuffle": false
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "a4e7825b-3e22-41f6-9417-8f035f0b7fe5",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "activity_key": "dialogue-response",
      "activity_type": "single_choice",
      "sort_order": 2,
      "prompt": {
        "ko-KR": "새 친구가 만나서 반가워요.라고 말했습니다. 가장 자연스러운 대답은 무엇이에요?",
        "zh-CN": "新同学说 만나서 반가워요.，哪一句回应最自然？"
      },
      "instruction": {
        "ko-KR": "상대의 말에 답하면서 첫 만남의 높임말에 맞는 문장을 고르세요.",
        "zh-CN": "选择既回应对方、又符合初次见面礼貌体的一句。"
      },
      "options": [
        "저도 반가워요.",
        "학생이에요?",
        "얼마예요?",
        "안녕."
      ],
      "public_config": {
        "shuffle": false
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "7ae06811-48ed-49a0-83ad-03d613a16e6b",
      "node_id": "a834273c-7858-4ad1-8587-97007acd90fb",
      "activity_key": "reading-profile",
      "activity_type": "single_choice",
      "sort_order": 1,
      "prompt": {
        "ko-KR": "새 회원 소개 카드를 읽고 이름, 국적, 신분에 관한 세 문제에 답하세요.",
        "zh-CN": "阅读新成员卡，完成姓名、国籍和身份三道事实理解题。"
      },
      "instruction": {
        "ko-KR": "문제마다 답을 하나만 고르고 소개 카드의 문장에서 근거를 찾으세요.",
        "zh-CN": "每题只选一个答案，依据必须来自卡片原句。"
      },
      "options": [],
      "public_config": {
        "items": [
          {
            "id": "name",
            "options": [
              "리나",
              "다니엘",
              "수진",
              "지민"
            ],
            "question": "이 사람의 이름은 뭐예요?"
          },
          {
            "id": "country",
            "options": [
              "중국 사람",
              "한국 사람",
              "캐나다 사람",
              "회사원"
            ],
            "question": "어느 나라 사람이에요?"
          },
          {
            "id": "identity",
            "options": [
              "학생",
              "선생님",
              "회사원",
              "의사"
            ],
            "question": "학생이에요, 선생님이에요?"
          }
        ],
        "reading": "안녕하세요? 저는 리나예요. 중국 사람이에요. 학생이에요. 한국어를 배워요. 만나서 반가워요.",
        "shuffle": false
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "d954746a-9f45-40ce-9c09-f639a7fe03bc",
      "node_id": "f0e8db18-ad29-46b3-b9c1-6a0b0717fd51",
      "activity_key": "self-check",
      "activity_type": "self_check",
      "sort_order": 2,
      "prompt": {
        "ko-KR": "실제 수행을 바탕으로 다섯 가지 Can-do를 점검하고 다음 복습 위치를 정하세요.",
        "zh-CN": "根据实际表现完成五项 Can-do 自查，并确定下一步复习位置。"
      },
      "instruction": {
        "ko-KR": "다섯 항목에 모두 응답하고 복습이 필요하면 돌아갈 위치를 하나 이상, 모두 가능하면 ‘오류 없음／계속 연습’을 고르세요.",
        "zh-CN": "五项都要回应；需要复习时至少选一个返回节点，全部能完成时选择“无错／保持练习”。"
      },
      "options": [],
      "public_config": {
        "items": [
          {
            "id": "greeting",
            "label": "我能主动问候／먼저 인사할 수 있어요"
          },
          {
            "id": "introduction",
            "label": "我能介绍姓名与身份／이름과 신분을 소개할 수 있어요"
          },
          {
            "id": "identity",
            "label": "我能询问并回答身份／신분을 묻고 대답할 수 있어요"
          },
          {
            "id": "closing",
            "label": "我能自然结束交流／자연스럽게 마칠 수 있어요"
          },
          {
            "id": "dialogue",
            "label": "我能完成 30 秒双角色对话／30초 두 역할 대화를 할 수 있어요"
          }
        ],
        "returnNodes": [
          {
            "label": "词汇",
            "value": "people-and-greetings"
          },
          {
            "label": "语法",
            "value": "topic-and-copula"
          },
          {
            "label": "对话理解",
            "value": "club-first-meeting"
          },
          {
            "label": "听说输出",
            "value": "listen-and-respond"
          },
          {
            "label": "读写",
            "value": "profile-note"
          },
          {
            "label": "无错／保持练习",
            "value": "none"
          }
        ],
        "requiredChecks": 5
      },
      "max_attempts": 3,
      "counts_toward_completion": false
    },
    {
      "id": "6c8f70d4-a9be-4d58-b431-fa966b60f463",
      "node_id": "9fe730cd-a102-496e-adc5-9973b697af68",
      "activity_key": "orientation-jimin-occupation",
      "activity_type": "single_choice",
      "sort_order": 2,
      "prompt": {
        "ko-KR": "지민의 신분이나 직업은 무엇이에요?",
        "zh-CN": "智敏的身份／职业是什么？"
      },
      "instruction": {
        "ko-KR": "대화에 직접 나온 정보만 보고, 나오지 않으면 없음을 고르세요. 점수에는 포함되지 않습니다.",
        "zh-CN": "只依据对话中明确出现的信息作答；没有提及时选择“없음”。本题不计分。"
      },
      "options": [
        "학생",
        "선생님",
        "회사원",
        "없음"
      ],
      "public_config": {
        "shuffle": false,
        "showScore": false
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "cb3f6d75-4a6a-4610-84dc-7d19db6ef3a5",
      "node_id": "9fe730cd-a102-496e-adc5-9973b697af68",
      "activity_key": "orientation-wangming-occupation",
      "activity_type": "single_choice",
      "sort_order": 3,
      "prompt": {
        "ko-KR": "왕밍의 신분이나 직업은 무엇이에요?",
        "zh-CN": "王明的身份／职业是什么？"
      },
      "instruction": {
        "ko-KR": "대화에 직접 나온 정보만 보고, 나오지 않으면 없음을 고르세요. 점수에는 포함되지 않습니다.",
        "zh-CN": "只依据对话中明确出现的信息作答；没有提及时选择“없음”。本题不计分。"
      },
      "options": [
        "학생",
        "선생님",
        "회사원",
        "없음"
      ],
      "public_config": {
        "shuffle": false,
        "showScore": false
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "3ad2226d-6490-4f6d-8743-2d1d9989d3e9",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "activity_key": "grammar-choice",
      "activity_type": "single_choice",
      "sort_order": 1,
      "prompt": {
        "ko-KR": "알맞은 어미나 조사를 골라 여섯 문장을 완성하세요.",
        "zh-CN": "选择合适的词尾或助词，完成六个句子。"
      },
      "instruction": {
        "ko-KR": "앞말의 받침을 확인한 뒤 신분 설명, 화제 표시와 확인 질문을 구별하세요.",
        "zh-CN": "先判断前一个词有没有收音，再区分身份说明、话题标记和确认提问。"
      },
      "options": [],
      "public_config": {
        "items": [
          {
            "id": "choice-1",
            "group": "page-1",
            "options": [
              "이에요",
              "예요",
              "은",
              "는"
            ],
            "question": "저는 학생___."
          },
          {
            "id": "choice-2",
            "group": "page-1",
            "options": [
              "이에요",
              "예요",
              "은",
              "는"
            ],
            "question": "저는 리나___."
          },
          {
            "id": "choice-3",
            "group": "page-1",
            "options": [
              "은",
              "는",
              "이에요",
              "예요"
            ],
            "question": "민준___ 학생이에요."
          },
          {
            "id": "choice-4",
            "group": "page-2",
            "options": [
              "은",
              "는",
              "이에요",
              "예요"
            ],
            "question": "지민 씨___ 학생이에요?"
          },
          {
            "id": "choice-5",
            "group": "page-2",
            "options": [
              "이에요",
              "예요",
              "은",
              "는"
            ],
            "question": "왕밍 씨는 학생___?"
          },
          {
            "id": "choice-6",
            "group": "page-2",
            "options": [
              "이에요",
              "예요",
              "은",
              "는"
            ],
            "question": "리나 씨는 의사___?"
          }
        ],
        "shuffle": false,
        "practiceKind": "choice",
        "shuffleOptions": false
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "70ac0f5d-917d-48e1-a00d-b0ed3bfa8509",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "activity_key": "grammar-judgment",
      "activity_type": "single_choice",
      "sort_order": 2,
      "prompt": {
        "ko-KR": "여섯 문장의 문법 형태가 맞는지 판단하세요.",
        "zh-CN": "判断六个句子的语法形式是否正确。"
      },
      "instruction": {
        "ko-KR": "이 과의 이에요/예요, 은/는와 확인 질문 형태만 판단하세요.",
        "zh-CN": "只判断本课的이에요/예요、은/는和确认疑问句形式。"
      },
      "options": [],
      "public_config": {
        "items": [
          {
            "id": "judgment-1",
            "group": "page-1",
            "options": [
              "正确",
              "错误"
            ],
            "question": "저는 학생이에요."
          },
          {
            "id": "judgment-2",
            "group": "page-1",
            "options": [
              "正确",
              "错误"
            ],
            "question": "저는 리나에요."
          },
          {
            "id": "judgment-3",
            "group": "page-1",
            "options": [
              "正确",
              "错误"
            ],
            "question": "민준은 학생이에요."
          },
          {
            "id": "judgment-4",
            "group": "page-2",
            "options": [
              "正确",
              "错误"
            ],
            "question": "지민 씨은 학생이에요?"
          },
          {
            "id": "judgment-5",
            "group": "page-2",
            "options": [
              "正确",
              "错误"
            ],
            "question": "학생이에요 까?"
          },
          {
            "id": "judgment-6",
            "group": "page-2",
            "options": [
              "正确",
              "错误"
            ],
            "question": "아니요, 선생님이에요."
          }
        ],
        "shuffle": false,
        "practiceKind": "judgment",
        "shuffleOptions": false
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "d2329ff4-72c2-4feb-bf62-3301ce769567",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "activity_key": "grammar-fill",
      "activity_type": "fill_blank",
      "sort_order": 3,
      "prompt": {
        "ko-KR": "두 번의 연습, 여섯 문항으로 서술격 어미, 주제 조사와 확인 의문문을 연습하세요.",
        "zh-CN": "连续完成两轮六小题，练习判断词尾、话题助词和确认疑问句。"
      },
      "instruction": {
        "ko-KR": "각 문법 항목을 두 번씩 연습하며 문장 부호는 이미 표시되어 있으므로 빈칸의 문법 형태만 쓰세요.",
        "zh-CN": "每个语法点练习两遍；句末标点已经显示，只填写空缺的语法形式。"
      },
      "options": [],
      "public_config": {
        "items": [
          {
            "id": "copula",
            "group": "第一轮",
            "label": "저는 리나___.",
            "groupKo": "첫 번째 연습",
            "placeholder": "이에요/예요"
          },
          {
            "id": "topic",
            "group": "第一轮",
            "label": "민준___ 학생이에요.",
            "groupKo": "첫 번째 연습",
            "placeholder": "은/는"
          },
          {
            "id": "confirmation",
            "group": "第一轮",
            "label": "지민 씨는 학생___?",
            "groupKo": "첫 번째 연습",
            "placeholder": "이에요/예요"
          },
          {
            "id": "copula-transfer",
            "group": "第二轮",
            "label": "저는 왕밍___.",
            "groupKo": "두 번째 연습",
            "placeholder": "이에요/예요"
          },
          {
            "id": "topic-transfer",
            "group": "第二轮",
            "label": "민지___ 친구예요.",
            "groupKo": "두 번째 연습",
            "placeholder": "은/는"
          },
          {
            "id": "confirmation-transfer",
            "group": "第二轮",
            "label": "리나 씨는 의사___?",
            "groupKo": "두 번째 연습",
            "placeholder": "이에요/예요"
          }
        ],
        "normalize": "NFC",
        "practiceKind": "fill"
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "6876a867-ae78-4336-9d3a-1745a351b6ee",
      "node_id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "activity_key": "listening-identity",
      "activity_type": "listening",
      "sort_order": 1,
      "prompt": {
        "ko-KR": "두 개의 첫 만남 듣기를 듣고 페이지마다 네 문제에 답하세요.",
        "zh-CN": "完成两套初次见面听力，每页依据当前音频回答四题。"
      },
      "instruction": {
        "ko-KR": "페이지마다 다른 음성을 듣고 네 문제를 푼 뒤 해당 원고를 확인하세요.",
        "zh-CN": "每页对应一段不同音频；完成本页四题后可查看本页母稿。"
      },
      "options": [],
      "public_config": {
        "items": [
          {
            "id": "a-name",
            "group": "listening-a",
            "options": [
              "지민",
              "수진",
              "리나",
              "왕밍"
            ],
            "question": {
              "ko-KR": "말하는 사람의 이름은 무엇이에요?",
              "zh-CN": "说话人叫什么名字？"
            }
          },
          {
            "id": "a-origin",
            "group": "listening-a",
            "options": [
              "중국 사람",
              "일본 사람",
              "한국 사람",
              "没有提到／언급하지 않음"
            ],
            "question": {
              "ko-KR": "말하는 사람은 어느 나라 사람이에요?",
              "zh-CN": "说话人是哪国人？"
            }
          },
          {
            "id": "a-identity",
            "group": "listening-a",
            "options": [
              "선생님",
              "학생",
              "회사원",
              "의사"
            ],
            "question": {
              "ko-KR": "말하는 사람의 신분은 무엇이에요?",
              "zh-CN": "说话人的身份是什么？"
            }
          },
          {
            "id": "a-learning",
            "group": "listening-a",
            "options": [
              "영어",
              "수학",
              "没有提到／언급하지 않음",
              "한국어"
            ],
            "question": {
              "ko-KR": "말하는 사람은 요즘 무엇을 배워요?",
              "zh-CN": "说话人最近在学习什么？"
            }
          },
          {
            "id": "b-name",
            "group": "listening-b",
            "options": [
              "수진",
              "왕밍",
              "지민",
              "리나"
            ],
            "question": {
              "ko-KR": "자기소개한 사람의 이름은 무엇이에요?",
              "zh-CN": "自我介绍的人叫什么名字？"
            }
          },
          {
            "id": "b-origin",
            "group": "listening-b",
            "options": [
              "한국 사람",
              "중국 사람",
              "일본 사람",
              "没有提到／언급하지 않음"
            ],
            "question": {
              "ko-KR": "왕밍 씨는 어느 나라 사람이에요?",
              "zh-CN": "王明是哪国人？"
            }
          },
          {
            "id": "b-identity",
            "group": "listening-b",
            "options": [
              "학생",
              "선생님",
              "회사원",
              "의사"
            ],
            "question": {
              "ko-KR": "왕밍 씨의 신분은 무엇이에요?",
              "zh-CN": "王明的身份是什么？"
            }
          },
          {
            "id": "b-jimin",
            "group": "listening-b",
            "options": [
              "회사원",
              "선생님",
              "没有提到／언급하지 않음",
              "학생"
            ],
            "question": {
              "ko-KR": "지민 씨의 신분은 무엇이에요?",
              "zh-CN": "智敏的身份是什么？"
            }
          }
        ],
        "tracks": [
          {
            "id": "track-01",
            "label": "自我介绍",
            "status": "ready",
            "audioId": "chapter-01-listening-identity-normal"
          },
          {
            "id": "track-02",
            "label": "双人对话",
            "status": "ready",
            "audioId": "chapter-01-listening-dialogue-normal"
          }
        ],
        "audioId": "chapter-01-listening-identity",
        "pageCount": 2,
        "trackMode": "per_page",
        "audioVoice": "ko-KR-SunHiNeural",
        "audioStatus": "ready",
        "audioEdition": "temporary_tts",
        "scriptRevision": "chapter-01-listening-v1",
        "shuffleOptions": false,
        "slowReplayLimit": 1,
        "normalReplayLimit": 2,
        "expectedDurationSeconds": 18
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "5b9bf18c-bd37-4df2-9f06-2599fc695e1c",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "activity_key": "pattern-choice",
      "activity_type": "single_choice",
      "sort_order": 1,
      "prompt": {
        "ko-KR": "이어지는 대화에서 알맞은 말을 골라 왕밍과 지민의 첫 만남 대화를 완성하세요.",
        "zh-CN": "在连续对话中选择合适的回答，让王明和智敏完成初次见面交流。"
      },
      "instruction": {
        "ko-KR": "현재 한 문장씩 답하며 맞히면 대답이 글자별로 말풍선에 나타난 뒤 다음 말이 이어집니다.",
        "zh-CN": "每次只处理当前一句；答对后回答会逐字进入气泡，并自动出现下一句。"
      },
      "options": [],
      "public_config": {
        "conversation": {
          "steps": [
            {
              "id": "jimin-intro",
              "kind": "line",
              "line": "안녕하세요? 저는 김지민이에요.",
              "side": "left",
              "afterMs": 420,
              "speaker": {
                "ko-KR": "지민",
                "zh-CN": "智敏"
              },
              "audioAssetKey": "guided-dialogue-jimin-intro",
              "typingSpeedMs": 52
            },
            {
              "id": "wangming-intro",
              "kind": "choice",
              "side": "right",
              "prompt": {
                "ko-KR": "왕밍은 어떻게 인사하고 이름을 소개할까요?",
                "zh-CN": "王明怎样回应并介绍姓名？"
              },
              "afterMs": 420,
              "options": [
                "안녕하세요? 저는 왕밍이에요.",
                "저는 학생이에요.",
                "지민 씨는 학생이에요?",
                "만나서 반가워요."
              ],
              "speaker": {
                "ko-KR": "왕밍",
                "zh-CN": "王明"
              },
              "choiceIndex": 0,
              "audioAssetKey": "guided-dialogue-wangming-intro",
              "typingSpeedMs": 52
            },
            {
              "id": "jimin-asks-identity",
              "kind": "line",
              "line": "왕밍 씨는 학생이에요?",
              "side": "left",
              "afterMs": 420,
              "speaker": {
                "ko-KR": "지민",
                "zh-CN": "智敏"
              },
              "audioAssetKey": "guided-dialogue-jimin-asks-identity",
              "typingSpeedMs": 52
            },
            {
              "id": "wangming-identity",
              "kind": "choice",
              "side": "right",
              "prompt": {
                "ko-KR": "왕밍은 자신의 신분을 어떻게 대답할까요?",
                "zh-CN": "王明怎样回答自己的身份？"
              },
              "afterMs": 420,
              "options": [
                "아니요, 선생님이에요.",
                "네, 학생이에요. 한국어를 배워요.",
                "저는 왕밍이에요.",
                "지민 씨는 학생이에요?"
              ],
              "speaker": {
                "ko-KR": "왕밍",
                "zh-CN": "王明"
              },
              "choiceIndex": 1,
              "audioAssetKey": "guided-dialogue-wangming-identity",
              "typingSpeedMs": 52
            },
            {
              "id": "wangming-asks-identity",
              "kind": "choice",
              "side": "right",
              "prompt": {
                "ko-KR": "왕밍은 이어서 지민에게 어떻게 물을까요?",
                "zh-CN": "王明接着怎样询问智敏？"
              },
              "afterMs": 420,
              "options": [
                "저는 학생이에요.",
                "만나서 반가워요.",
                "지민 씨는 학생이에요?",
                "왕밍 씨는 학생이에요?"
              ],
              "speaker": {
                "ko-KR": "왕밍",
                "zh-CN": "王明"
              },
              "choiceIndex": 2,
              "audioAssetKey": "guided-dialogue-wangming-asks-identity",
              "typingSpeedMs": 52
            },
            {
              "id": "jimin-identity",
              "kind": "line",
              "line": "네, 저도 학생이에요.",
              "side": "left",
              "afterMs": 420,
              "speaker": {
                "ko-KR": "지민",
                "zh-CN": "智敏"
              },
              "audioAssetKey": "guided-dialogue-jimin-identity",
              "typingSpeedMs": 52
            },
            {
              "id": "wangming-closing",
              "kind": "choice",
              "side": "right",
              "prompt": {
                "ko-KR": "왕밍은 첫 만남 대화를 어떻게 공손히 마칠까요?",
                "zh-CN": "王明怎样礼貌结束初次见面对话？"
              },
              "afterMs": 420,
              "options": [
                "안녕하세요?",
                "저는 왕밍이에요.",
                "네, 학생이에요.",
                "만나서 반가워요."
              ],
              "speaker": {
                "ko-KR": "왕밍",
                "zh-CN": "王明"
              },
              "choiceIndex": 3,
              "audioAssetKey": "guided-dialogue-wangming-closing",
              "typingSpeedMs": 52
            },
            {
              "id": "jimin-closing",
              "kind": "line",
              "line": "저도 만나서 반가워요.",
              "side": "left",
              "afterMs": 420,
              "speaker": {
                "ko-KR": "지민",
                "zh-CN": "智敏"
              },
              "audioAssetKey": "guided-dialogue-jimin-closing",
              "typingSpeedMs": 52
            }
          ],
          "title": {
            "ko-KR": "첫 만남 대화 완성",
            "zh-CN": "完成初次见面对话"
          },
          "instruction": {
            "ko-KR": "알맞은 대답을 골라 대화를 한 문장씩 이어 가세요.",
            "zh-CN": "选择合适的回答，让对话逐句继续。"
          }
        },
        "practiceKind": "guided_conversation"
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "897f6b9a-e955-401d-8127-46a5adfc708a",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "activity_key": "pattern-compose",
      "activity_type": "fill_blank",
      "sort_order": 3,
      "prompt": {
        "ko-KR": "상대에게 직접 묻고 대답하며 쌍방향 첫 만남 대화를 완성하세요.",
        "zh-CN": "主动提问并回答对方，完成一段双向的初次见面对话。"
      },
      "instruction": {
        "ko-KR": "학습자가 인사, 소개, 세 번의 질문, 신분 대답과 마무리를 직접 완성합니다.",
        "zh-CN": "学生要完成问候、介绍、三次主动提问、身份回答和礼貌结束。"
      },
      "options": [],
      "public_config": {
        "composition": {
          "steps": [
            {
              "id": "greeting-name",
              "hint": {
                "ko-KR": "먼저 인사하고 저는으로 이름을 소개하세요.",
                "zh-CN": "先问候，再使用저는介绍姓名。"
              },
              "task": {
                "ko-KR": "인사하고 이름을 소개하세요",
                "zh-CN": "回应问候并介绍姓名"
              },
              "prompt": "안녕하세요?",
              "tokens": [
                "저는",
                "안녕하세요?",
                "왕밍이에요."
              ],
              "speaker": {
                "ko-KR": "지민",
                "zh-CN": "智敏"
              }
            },
            {
              "id": "ask-name",
              "hint": {
                "ko-KR": "이름은 뭐예요?로 공손하게 이름을 물어보세요.",
                "zh-CN": "使用이름은 뭐예요?礼貌询问姓名。"
              },
              "task": {
                "ko-KR": "상대방의 이름을 직접 물어보세요",
                "zh-CN": "主动询问对方姓名"
              },
              "prompt": "만나서 반가워요.",
              "tokens": [
                "뭐예요?",
                "지민 씨의",
                "이름은"
              ],
              "speaker": {
                "ko-KR": "지민",
                "zh-CN": "智敏"
              }
            },
            {
              "id": "ask-identity",
              "hint": {
                "ko-KR": "이름 뒤에 씨는을 붙여 학생인지 물어보세요.",
                "zh-CN": "用姓名加씨는询问是不是学生。"
              },
              "task": {
                "ko-KR": "상대방의 신분을 직접 물어보세요",
                "zh-CN": "主动询问对方身份"
              },
              "prompt": "제 이름은 김지민이에요.",
              "tokens": [
                "학생이에요?",
                "지민 씨는"
              ],
              "speaker": {
                "ko-KR": "지민",
                "zh-CN": "智敏"
              }
            },
            {
              "id": "answer-identity",
              "hint": {
                "ko-KR": "먼저 신분을 긍정하고 한국어 학습을 말하세요.",
                "zh-CN": "先肯定身份，再说明学习韩语。"
              },
              "task": {
                "ko-KR": "자신의 신분을 답하고 배우는 내용을 덧붙이세요",
                "zh-CN": "回答自己的身份并补充学习内容"
              },
              "prompt": "네, 학생이에요. 왕밍 씨는 학생이에요?",
              "tokens": [
                "한국어를 배워요.",
                "네,",
                "저도 학생이에요."
              ],
              "speaker": {
                "ko-KR": "지민",
                "zh-CN": "智敏"
              }
            },
            {
              "id": "ask-nationality",
              "hint": {
                "ko-KR": "한국 사람이에요?로 확인 질문을 하세요.",
                "zh-CN": "用한국 사람이에요?进行确认提问。"
              },
              "task": {
                "ko-KR": "상대방의 국적이나 지역을 직접 물어보세요",
                "zh-CN": "主动询问对方国籍或地区"
              },
              "prompt": "네, 저도 한국어를 배워요.",
              "tokens": [
                "한국 사람이에요?",
                "지민 씨는"
              ],
              "speaker": {
                "ko-KR": "지민",
                "zh-CN": "智敏"
              }
            },
            {
              "id": "closing",
              "hint": {
                "ko-KR": "상대방을 부르고 만나서 반갑다고 말하세요.",
                "zh-CN": "称呼对方并表达见面很高兴。"
              },
              "task": {
                "ko-KR": "공손한 마무리 인사로 대화를 끝내세요",
                "zh-CN": "用礼貌结束语完成对话"
              },
              "prompt": "네, 한국 사람이에요.",
              "tokens": [
                "반가워요.",
                "만나서",
                "지민 씨,"
              ],
              "speaker": {
                "ko-KR": "지민",
                "zh-CN": "智敏"
              }
            }
          ],
          "title": {
            "ko-KR": "질문부터 대답까지 완전한 대화 조합하기",
            "zh-CN": "从提问到回答，组合完整对话"
          },
          "instruction": {
            "ko-KR": "대답만 하지 않고 이름, 신분과 국적·지역도 직접 물어보세요.",
            "zh-CN": "不仅回答对方，也要主动询问姓名、身份和国籍／地区。"
          }
        }
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    },
    {
      "id": "0b1e3713-dfa7-4c89-8504-ae1992e2d340",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "activity_key": "dialogue-roleplay",
      "activity_type": "speaking",
      "sort_order": 3,
      "prompt": {
        "ko-KR": "한 역할을 골라 첫 만남 대화를 차례대로 완성하세요.",
        "zh-CN": "选择一个角色，逐轮完成初次见面对话。"
      },
      "instruction": {
        "ko-KR": "상대의 말을 들은 뒤 내 차례에 녹음하고 다시 들어 확인하세요. 내용 일치도는 발음 점수가 아닙니다.",
        "zh-CN": "系统播放对方台词；轮到你时录音、回听并确认。内容匹配度不代表发音分数。"
      },
      "options": [],
      "public_config": {
        "storage": "cloudflare_r2",
        "formative": true,
        "scoreLabel": {
          "ko-KR": "대화 내용 일치도",
          "zh-CN": "对话内容匹配度"
        },
        "practiceKind": "dialogue_roleplay",
        "scoreRequired": false,
        "pronunciationScore": false,
        "completionRequirement": "all_role_turns_recorded"
      },
      "max_attempts": 20,
      "counts_toward_completion": true
    },
    {
      "id": "d52694a4-5337-4971-ab48-32a7c6821ea0",
      "node_id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "activity_key": "speaking-introduction",
      "activity_type": "speaking",
      "sort_order": 2,
      "prompt": {
        "ko-KR": "전체 원고 없이 한국어로 자신의 첫 만남 자기소개를 완성하세요.",
        "zh-CN": "脱离完整原稿，用韩语完成一段自己的初次见面自我介绍。"
      },
      "instruction": {
        "ko-KR": "먼저 표현 핵심어를 고르고 15초 이상 녹음하세요. 녹음 후 참고 표현을 볼 수 있습니다.",
        "zh-CN": "先选择表达关键词，再录制至少 15 秒；录音完成后可以查看参考表达。"
      },
      "options": [],
      "public_config": {
        "criteria": [
          "问候",
          "姓名",
          "国籍",
          "身份",
          "礼貌结束"
        ],
        "minimumTurns": 0,
        "outlineItems": [
          {
            "id": "greeting",
            "label": {
              "ko-KR": "인사",
              "zh-CN": "问候"
            },
            "choices": [
              "안녕하세요?",
              "안녕하세요."
            ]
          },
          {
            "id": "name",
            "label": {
              "ko-KR": "이름",
              "zh-CN": "姓名"
            },
            "choices": [
              "저는 왕밍이에요.",
              "저는 리나예요.",
              "저는 김지민이에요."
            ]
          },
          {
            "id": "country",
            "label": {
              "ko-KR": "국적",
              "zh-CN": "国籍"
            },
            "choices": [
              "중국 사람이에요.",
              "한국 사람이에요."
            ]
          },
          {
            "id": "identity",
            "label": {
              "ko-KR": "신분",
              "zh-CN": "身份"
            },
            "choices": [
              "학생이에요.",
              "회사원이에요.",
              "선생님이에요."
            ]
          },
          {
            "id": "closing",
            "label": {
              "ko-KR": "마무리",
              "zh-CN": "结束语"
            },
            "choices": [
              "만나서 반가워요.",
              "네, 반가워요."
            ]
          }
        ],
        "presentation": "independent_output",
        "referenceText": "안녕하세요? 저는 왕밍이에요. 중국 사람이에요. 저는 학생이에요. 요즘 한국어를 배워요. 만나서 반가워요.",
        "maximumSeconds": 60,
        "minimumSeconds": 15,
        "requiredCriteria": 4,
        "pronunciationScore": false,
        "minimumOutlineItems": 4,
        "enforceCompletionRequirements": true
      },
      "max_attempts": 3,
      "counts_toward_completion": true
    }
  ],
  "media": [
    {
      "id": "0d17ea9e-bff3-4c74-b254-84578fa6714f",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "asset_key": "chapter-01-image-03",
      "media_type": "image",
      "purpose": "语法形态判断情景图",
      "object_key": "images/smart-textbook/korean-level-one/chapter-01/step-03-scene-2x.webp",
      "production_status": "ready",
      "alt_text": {
        "ko-KR": "两名学生观察身份卡，在教师引导下比较名词词尾。",
        "zh-CN": "两名学生观察身份卡，在教师引导下比较名词词尾。"
      },
      "metadata": {
        "width": 3600,
        "goalKo": "명사의 끝소리를 보고 이에요/예요와 은/는을 바르게 고르세요.",
        "goalZh": "先看名词词尾，再正确选择 이에요/예요 和 은/는。",
        "height": 1440,
        "density": "2x",
        "encoding": "lossless-webp",
        "aspectRatio": "5:2",
        "sourceWidth": 1983,
        "presentation": "task-scene",
        "sourceHeight": 793,
        "proportionalScale": true
      }
    },
    {
      "id": "afed490e-ff92-4739-a736-29ced35c1ecd",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-01",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-01.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "저",
        "audioId": "chapter-01-vocabulary-01"
      }
    },
    {
      "id": "b3781861-a913-4967-afd6-5af804ac8a71",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-02",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-02.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "이름",
        "audioId": "chapter-01-vocabulary-02"
      }
    },
    {
      "id": "64191dca-9ece-499c-b3ac-f05b28390a4e",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-03",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-03.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "학생",
        "audioId": "chapter-01-vocabulary-03"
      }
    },
    {
      "id": "d49c2d6f-795b-406c-bac6-330d4d0fe07c",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-04",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-04.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "선생님",
        "audioId": "chapter-01-vocabulary-04"
      }
    },
    {
      "id": "23dd2fb7-7555-4123-982b-05fd17341a18",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-05",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-05.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "친구",
        "audioId": "chapter-01-vocabulary-05"
      }
    },
    {
      "id": "88434ee6-7143-4074-96de-37eadf37a54d",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-06",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-06.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "사람",
        "audioId": "chapter-01-vocabulary-06"
      }
    },
    {
      "id": "bffac671-f2ff-4d67-8b23-9a4b71a8c971",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-07",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-07.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "만나다",
        "audioId": "chapter-01-vocabulary-07"
      }
    },
    {
      "id": "de9feb44-b1ec-4203-a969-b47c527c816d",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-08",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-08.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "인사하다",
        "audioId": "chapter-01-vocabulary-08"
      }
    },
    {
      "id": "2192535e-2630-4d98-90d2-ace07679d191",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-09",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-09.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "소개하다",
        "audioId": "chapter-01-vocabulary-09"
      }
    },
    {
      "id": "9acccf9f-67eb-48c8-89f7-2bdbca75ac5c",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-10",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-10.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "한국어",
        "audioId": "chapter-01-vocabulary-10"
      }
    },
    {
      "id": "87950a80-600a-4bb3-bd17-c7773fad30cb",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-11",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-11.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "처음",
        "audioId": "chapter-01-vocabulary-11"
      }
    },
    {
      "id": "80e4b9d9-58f3-4d55-9504-bd852eed725b",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-12",
      "media_type": "audio",
      "purpose": "词汇原形点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-12.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 기본형 음원 제작 대기",
        "zh-CN": "词汇原形音频待制作"
      },
      "metadata": {
        "script": "반갑다",
        "audioId": "chapter-01-vocabulary-12"
      }
    },
    {
      "id": "46de9d63-07f2-4981-9d7b-36c39ed608ba",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-01",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-01.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "저는 학생이에요.",
        "audioId": "chapter-01-vocabulary-collocation-01"
      }
    },
    {
      "id": "0216da78-b332-44b5-bd38-37252671c06e",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-02",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-02.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "이름이 뭐예요?",
        "audioId": "chapter-01-vocabulary-collocation-02"
      }
    },
    {
      "id": "fd41020a-bc40-4fbc-912e-6eb9246053b4",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-03",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-03.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "학생이에요.",
        "audioId": "chapter-01-vocabulary-collocation-03"
      }
    },
    {
      "id": "18dc2ea7-1c25-477e-a91c-c72eb75dbfae",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-04",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-04.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "선생님이에요.",
        "audioId": "chapter-01-vocabulary-collocation-04"
      }
    },
    {
      "id": "b667690b-8e18-4d7a-ac4a-322e182f439d",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-05",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-05.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "친구를 만나요.",
        "audioId": "chapter-01-vocabulary-collocation-05"
      }
    },
    {
      "id": "a841b7f7-fdfc-4f37-bcd4-527814f12266",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-06",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-06.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "중국 사람이에요.",
        "audioId": "chapter-01-vocabulary-collocation-06"
      }
    },
    {
      "id": "e255996c-e6a7-456d-9a6e-34716c3ccdcc",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-07",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-07.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "처음 만나요.",
        "audioId": "chapter-01-vocabulary-collocation-07"
      }
    },
    {
      "id": "282ec490-e4ec-4127-b32b-a7efc4b41446",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-08",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-08.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "친구에게 인사해요.",
        "audioId": "chapter-01-vocabulary-collocation-08"
      }
    },
    {
      "id": "5568a604-6d3e-44ad-8a3b-621393764939",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-09",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-09.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "자신을 소개해요.",
        "audioId": "chapter-01-vocabulary-collocation-09"
      }
    },
    {
      "id": "1a687a15-b598-463a-ab0c-04018f6f0179",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-10",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-10.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "한국어를 배워요.",
        "audioId": "chapter-01-vocabulary-collocation-10"
      }
    },
    {
      "id": "4bdf8cf5-a341-4dff-b46b-5b1ee0a035c9",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-11",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-11.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "처음 만나요.",
        "audioId": "chapter-01-vocabulary-collocation-11"
      }
    },
    {
      "id": "add94f11-ee09-4213-84e2-ca59d404901e",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-vocabulary-collocation-12",
      "media_type": "audio",
      "purpose": "词汇搭配例句点读",
      "object_key": "korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-12.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "어휘 결합 예문 음원 제작 대기",
        "zh-CN": "词汇搭配例句音频待制作"
      },
      "metadata": {
        "script": "만나서 반가워요.",
        "audioId": "chapter-01-vocabulary-collocation-12"
      }
    },
    {
      "id": "be2226aa-139c-4987-8d40-e22465a6c1d2",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "asset_key": "chapter-01-grammar-01-example-01",
      "media_type": "audio",
      "purpose": "语法卡母版与语境复现例句",
      "object_key": "korean-level-one/chapter-01/audio/grammar/chapter-01-grammar-01-example-01.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "문법 예문 음원 제작 대기",
        "zh-CN": "语法例句音频待制作"
      },
      "metadata": {
        "script": "저는 학생이에요.",
        "audioId": "chapter-01-grammar-01-example-01"
      }
    },
    {
      "id": "14ada629-d0a8-4050-b802-add8b482f9a9",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "asset_key": "chapter-01-grammar-01-example-02",
      "media_type": "audio",
      "purpose": "语法卡母版与语境复现例句",
      "object_key": "korean-level-one/chapter-01/audio/grammar/chapter-01-grammar-01-example-02.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "문법 예문 음원 제작 대기",
        "zh-CN": "语法例句音频待制作"
      },
      "metadata": {
        "script": "저는 왕밍이에요. 네, 학생이에요.",
        "audioId": "chapter-01-grammar-01-example-02"
      }
    },
    {
      "id": "57c73e5f-8676-4fb0-baf3-27e681a11598",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "asset_key": "chapter-01-grammar-01-example-03",
      "media_type": "audio",
      "purpose": "语法卡母版与语境复现例句",
      "object_key": "korean-level-one/chapter-01/audio/grammar/chapter-01-grammar-01-example-03.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "문법 예문 음원 제작 대기",
        "zh-CN": "语法例句音频待制作"
      },
      "metadata": {
        "script": "저는 리나예요. 학생이에요.",
        "audioId": "chapter-01-grammar-01-example-03"
      }
    },
    {
      "id": "5322751c-7522-4715-be47-fd06a486b64f",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "asset_key": "chapter-01-grammar-02-example-01",
      "media_type": "audio",
      "purpose": "语法卡母版与语境复现例句",
      "object_key": "korean-level-one/chapter-01/audio/grammar/chapter-01-grammar-02-example-01.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "문법 예문 음원 제작 대기",
        "zh-CN": "语法例句音频待制作"
      },
      "metadata": {
        "script": "저는 왕밍이에요.",
        "audioId": "chapter-01-grammar-02-example-01"
      }
    },
    {
      "id": "017695b0-28d2-48d1-9226-7e24a1c21177",
      "node_id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "asset_key": "chapter-01-listening-repeat-01",
      "media_type": "audio",
      "purpose": "听说任务逐句正式示范音",
      "object_key": "korean-level-one/chapter-01/listen-speak/repeat-01.mp3",
      "production_status": "pending",
      "alt_text": {},
      "metadata": {
        "kind": "listen_speak_repeat",
        "lineIndex": 1
      }
    },
    {
      "id": "2c85e07d-ed4e-483e-9b37-8e06fd4e6492",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "asset_key": "chapter-01-grammar-02-example-02",
      "media_type": "audio",
      "purpose": "语法卡母版与语境复现例句",
      "object_key": "korean-level-one/chapter-01/audio/grammar/chapter-01-grammar-02-example-02.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "문법 예문 음원 제작 대기",
        "zh-CN": "语法例句音频待制作"
      },
      "metadata": {
        "script": "지민 씨는 학생이에요?",
        "audioId": "chapter-01-grammar-02-example-02"
      }
    },
    {
      "id": "72186052-b62c-4c42-b211-2ae3da679d0a",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "asset_key": "chapter-01-grammar-02-example-03",
      "media_type": "audio",
      "purpose": "语法卡母版与语境复现例句",
      "object_key": "korean-level-one/chapter-01/audio/grammar/chapter-01-grammar-02-example-03.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "문법 예문 음원 제작 대기",
        "zh-CN": "语法例句音频待制作"
      },
      "metadata": {
        "script": "리나 씨는 중국 사람이에요?",
        "audioId": "chapter-01-grammar-02-example-03"
      }
    },
    {
      "id": "7f02e85d-b14d-4fc9-a814-a429df1358e7",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "asset_key": "chapter-01-grammar-03-example-01",
      "media_type": "audio",
      "purpose": "语法卡母版与语境复现例句",
      "object_key": "korean-level-one/chapter-01/audio/grammar/chapter-01-grammar-03-example-01.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "문법 예문 음원 제작 대기",
        "zh-CN": "语法例句音频待制作"
      },
      "metadata": {
        "script": "지민 씨는 학생이에요?",
        "audioId": "chapter-01-grammar-03-example-01"
      }
    },
    {
      "id": "8bd5ccdf-a54c-4233-a136-f8870d9505f1",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "asset_key": "chapter-01-grammar-03-example-02",
      "media_type": "audio",
      "purpose": "语法卡母版与语境复现例句",
      "object_key": "korean-level-one/chapter-01/audio/grammar/chapter-01-grammar-03-example-02.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "문법 예문 음원 제작 대기",
        "zh-CN": "语法例句音频待制作"
      },
      "metadata": {
        "script": "왕밍 씨는 중국 사람이에요?",
        "audioId": "chapter-01-grammar-03-example-02"
      }
    },
    {
      "id": "1e8af992-2eec-4ed3-a6f5-200e85194d38",
      "node_id": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
      "asset_key": "chapter-01-grammar-03-example-03",
      "media_type": "audio",
      "purpose": "语法卡母版与语境复现例句",
      "object_key": "korean-level-one/chapter-01/audio/grammar/chapter-01-grammar-03-example-03.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "문법 예문 음원 제작 대기",
        "zh-CN": "语法例句音频待制作"
      },
      "metadata": {
        "script": "리나 씨는 선생님이에요? 아니요, 학생이에요.",
        "audioId": "chapter-01-grammar-03-example-03"
      }
    },
    {
      "id": "7e0bdc46-f117-4495-bc2f-da2025324cfa",
      "node_id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "asset_key": "chapter-01-listening-repeat-02",
      "media_type": "audio",
      "purpose": "听说任务逐句正式示范音",
      "object_key": "korean-level-one/chapter-01/listen-speak/repeat-02.mp3",
      "production_status": "pending",
      "alt_text": {},
      "metadata": {
        "kind": "listen_speak_repeat",
        "lineIndex": 2
      }
    },
    {
      "id": "7a75f933-b357-4fcb-a697-296cefee618c",
      "node_id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "asset_key": "chapter-01-listening-repeat-03",
      "media_type": "audio",
      "purpose": "听说任务逐句正式示范音",
      "object_key": "korean-level-one/chapter-01/listen-speak/repeat-03.mp3",
      "production_status": "pending",
      "alt_text": {},
      "metadata": {
        "kind": "listen_speak_repeat",
        "lineIndex": 3
      }
    },
    {
      "id": "2acbaaa7-f2db-4f37-bfd2-f36e70b9a6c6",
      "node_id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "asset_key": "chapter-01-listening-repeat-04",
      "media_type": "audio",
      "purpose": "听说任务逐句正式示范音",
      "object_key": "korean-level-one/chapter-01/listen-speak/repeat-04.mp3",
      "production_status": "pending",
      "alt_text": {},
      "metadata": {
        "kind": "listen_speak_repeat",
        "lineIndex": 4
      }
    },
    {
      "id": "4474a908-751c-4567-bd0f-c2b4125ff53b",
      "node_id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "asset_key": "chapter-01-listening-repeat-05",
      "media_type": "audio",
      "purpose": "听说任务逐句正式示范音",
      "object_key": "korean-level-one/chapter-01/listen-speak/repeat-05.mp3",
      "production_status": "pending",
      "alt_text": {},
      "metadata": {
        "kind": "listen_speak_repeat",
        "lineIndex": 5
      }
    },
    {
      "id": "49113a34-5f93-4fbb-944c-29a52fae2e6f",
      "node_id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "asset_key": "chapter-01-listening-repeat-06",
      "media_type": "audio",
      "purpose": "听说任务逐句正式示范音",
      "object_key": "korean-level-one/chapter-01/listen-speak/repeat-06.mp3",
      "production_status": "pending",
      "alt_text": {},
      "metadata": {
        "kind": "listen_speak_repeat",
        "lineIndex": 6
      }
    },
    {
      "id": "ec4f3931-fc5a-4ae4-a130-5a26c6951ce3",
      "node_id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "asset_key": "chapter-01-listening-identity-slow",
      "media_type": "audio",
      "purpose": "私有听力慢速",
      "object_key": "korean-level-one/chapter-01/listening/chapter-01-listening-identity-slow.mp3",
      "production_status": "ready",
      "alt_text": {
        "ko-KR": "느린 속도 듣기 음원 제작 대기",
        "zh-CN": "慢速听力待制作"
      },
      "metadata": {
        "voice": "ko-KR-SunHiNeural",
        "format": "mp3",
        "locale": "ko-KR",
        "speaker": "F04／수진",
        "channels": 1,
        "generatedBy": "edge-tts",
        "audioEdition": "temporary_tts",
        "sampleRateHz": 24000,
        "speakingRate": 0.78,
        "voiceProfile": "F04/sujin",
        "scriptRevision": "chapter-01-listening-v1",
        "durationSeconds": 17.328,
        "scriptVisibility": "private",
        "targetDurationSeconds": 22,
        "replaceableByHumanRecording": true
      }
    },
    {
      "id": "9ffa8c89-ec26-4e71-b67d-56dc556d6aec",
      "node_id": "9fe730cd-a102-496e-adc5-9973b697af68",
      "asset_key": "chapter-01-image-01",
      "media_type": "image",
      "purpose": "章节情境主图",
      "object_key": "images/smart-textbook/korean-level-one/chapter-01/mission-map-scene-v1.webp",
      "production_status": "ready",
      "alt_text": {
        "ko-KR": "밝은 캠퍼스 언어 교환 행사 공간에서 대학생 두 명이 마주 보고 웃으며 한 학생이 손을 들어 먼저 인사합니다.",
        "zh-CN": "明亮的校园语言交换活动空间里，两名大学生面对面微笑，一名学生抬手主动问候。"
      },
      "metadata": {
        "width": 1600,
        "height": 640,
        "version": 1,
        "mimeType": "image/webp",
        "sourceStatus": "已制作"
      }
    },
    {
      "id": "239bee7f-f982-473f-8b13-e91812e31dc4",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-main-line-01",
      "media_type": "audio",
      "purpose": "主对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-main-line-01.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-main-line-01",
        "script": "안녕하세요? 우리 처음 만나요. 저는 김지민이에요.",
        "speaker": "F01／지민"
      }
    },
    {
      "id": "572340e6-9b73-4d2d-9fc0-421f39d8ef35",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-main-line-02",
      "media_type": "audio",
      "purpose": "主对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-main-line-02.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-main-line-02",
        "script": "안녕하세요? 제 이름은 왕밍이에요.",
        "speaker": "M01／왕밍"
      }
    },
    {
      "id": "6d59e694-ab9b-4aca-8e70-cf4b94d679b7",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-main-line-03",
      "media_type": "audio",
      "purpose": "主对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-main-line-03.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-main-line-03",
        "script": "왕밍 씨는 학생이에요?",
        "speaker": "F01／지민"
      }
    },
    {
      "id": "c1528f6a-fe87-4bef-af2d-568c53beec4b",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-main-line-04",
      "media_type": "audio",
      "purpose": "主对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-main-line-04.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-main-line-04",
        "script": "네, 학생이에요. 한국어를 배워요.",
        "speaker": "M01／왕밍"
      }
    },
    {
      "id": "0162a324-f9c7-4034-b6c7-8c10ee1619de",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-main-line-05",
      "media_type": "audio",
      "purpose": "主对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-main-line-05.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-main-line-05",
        "script": "지민 씨도 학생이에요?",
        "speaker": "M01／왕밍"
      }
    },
    {
      "id": "24c46d7c-f573-4a4b-8666-78d6e035ca0f",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-main-line-06",
      "media_type": "audio",
      "purpose": "主对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-main-line-06.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-main-line-06",
        "script": "네, 저도 학생이에요.",
        "speaker": "F01／지민"
      }
    },
    {
      "id": "87fbc14f-b947-4786-b5f7-edb387d43b59",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-main-line-07",
      "media_type": "audio",
      "purpose": "主对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-main-line-07.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-main-line-07",
        "script": "만나서 반가워요.",
        "speaker": "M01／왕밍"
      }
    },
    {
      "id": "c99cc611-be89-4111-afdf-aea0fc6ff13e",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-main-line-08",
      "media_type": "audio",
      "purpose": "主对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-main-line-08.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-main-line-08",
        "script": "저도 만나서 반가워요.",
        "speaker": "F01／지민"
      }
    },
    {
      "id": "c6033364-29d2-4528-b00e-932ac304aa74",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-main",
      "media_type": "audio",
      "purpose": "主对话整段",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-main.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-main",
        "script": "안녕하세요? 우리 처음 만나요. 저는 김지민이에요. 안녕하세요? 제 이름은 왕밍이에요. 왕밍 씨는 학생이에요? 네, 학생이에요. 한국어를 배워요. 지민 씨도 학생이에요? 네, 저도 학생이에요. 만나서 반가워요. 저도 만나서 반가워요.",
        "speaker": "F01／M01"
      }
    },
    {
      "id": "3fac4972-49bb-4138-99eb-15a58edd83ba",
      "node_id": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
      "asset_key": "chapter-01-image-02",
      "media_type": "image",
      "purpose": "核心词汇人物与动作情景图",
      "object_key": "images/smart-textbook/korean-level-one/chapter-01/vocabulary-scene-v5-2x.webp",
      "production_status": "ready",
      "alt_text": {
        "ko-KR": "캠퍼스 언어 교환 센터의 네 장면으로 학습자의 자기소개와 이름, 선생님·학생·친구의 만남, 처음 만난 두 사람의 인사와 한국어 공부를 보여 줍니다.",
        "zh-CN": "校园语言交换中心的四个连续场景：学习者介绍自己和姓名，老师、学生与朋友一起交流，两位新朋友初次见面问候，以及伙伴共同学习韩语。"
      },
      "metadata": {
        "width": 3600,
        "format": "webp",
        "height": 1800,
        "density": "2x",
        "encoding": "lossless-webp",
        "aspectRatio": "2:1",
        "sourceStatus": "AI 横向扩展后人工核对",
        "wordHotspots": {
          "저": {
            "top": 49,
            "left": 31
          },
          "사람": {
            "top": 54,
            "left": 80
          },
          "이름": {
            "top": 58,
            "left": 33
          },
          "처음": {
            "top": 82,
            "left": 39
          },
          "친구": {
            "top": 48,
            "left": 73
          },
          "학생": {
            "top": 47,
            "left": 53
          },
          "만나다": {
            "top": 84,
            "left": 43
          },
          "반갑다": {
            "top": 82,
            "left": 48
          },
          "선생님": {
            "top": 44,
            "left": 62
          },
          "한국어": {
            "top": 84,
            "left": 69
          },
          "소개하다": {
            "top": 48,
            "left": 38
          },
          "인사하다": {
            "top": 82,
            "left": 31
          }
        },
        "detailEnhanced": true,
        "vocabularyCoverage": [
          "저",
          "이름",
          "학생",
          "선생님",
          "친구",
          "사람",
          "만나다",
          "인사하다",
          "소개하다",
          "한국어",
          "처음",
          "반갑다"
        ]
      }
    },
    {
      "id": "fc37dc38-984e-472a-b310-7930b0bac01b",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "asset_key": "chapter-01-image-04",
      "media_type": "image",
      "purpose": "句型排序与替换情景图",
      "object_key": "images/smart-textbook/korean-level-one/chapter-01/step-04-scene-2x.webp",
      "production_status": "ready",
      "alt_text": {
        "ko-KR": "两名学生把四张表达卡排成自然的自我介绍顺序。",
        "zh-CN": "两名学生把四张表达卡排成自然的自我介绍顺序。"
      },
      "metadata": {
        "width": 3600,
        "goalKo": "인사, 이름, 신분과 마무리를 자연스러운 자기소개로 이어 보세요.",
        "goalZh": "把问候、姓名、身份和结束语连成自然的自我介绍。",
        "height": 1440,
        "density": "2x",
        "encoding": "lossless-webp",
        "aspectRatio": "5:2",
        "sourceWidth": 1983,
        "presentation": "task-scene",
        "sourceHeight": 793,
        "proportionalScale": true
      }
    },
    {
      "id": "fd6611fd-fd2f-4161-9ef4-b78237c49a11",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-image-05",
      "media_type": "image",
      "purpose": "初次见面实战对话情景图",
      "object_key": "images/smart-textbook/korean-level-one/chapter-01/step-05-scene-2x.webp",
      "production_status": "ready",
      "alt_text": {
        "ko-KR": "国际交流中心里，两名学生第一次见面并轮流交谈。",
        "zh-CN": "国际交流中心里，两名学生第一次见面并轮流交谈。"
      },
      "metadata": {
        "width": 3600,
        "goalKo": "두 개의 완전한 장면을 이해하고 첫 만남 대화를 번갈아 완성하세요.",
        "goalZh": "听懂两个完整场景，轮流完成初次见面对话。",
        "height": 1440,
        "density": "2x",
        "encoding": "lossless-webp",
        "aspectRatio": "5:2",
        "sourceWidth": 1983,
        "presentation": "task-scene",
        "sourceHeight": 793,
        "proportionalScale": true
      }
    },
    {
      "id": "39ed3058-af6e-4ae0-86f8-1fb0ba78007d",
      "node_id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "asset_key": "chapter-01-image-06",
      "media_type": "image",
      "purpose": "听辨与双角色口语任务情景图",
      "object_key": "images/smart-textbook/korean-level-one/chapter-01/step-06-scene-2x.webp",
      "production_status": "ready",
      "alt_text": {
        "ko-KR": "语言实验室里，一名学生戴耳机听辨，另一名学生对着麦克风表达。",
        "zh-CN": "语言实验室里，一名学生戴耳机听辨，另一名学生对着麦克风表达。"
      },
      "metadata": {
        "width": 3600,
        "goalKo": "실제 음성에서 신분을 듣고 30초, 8턴 이상의 두 역할 대화를 완성하세요.",
        "goalZh": "先从原话听出身份，再完成 30 秒、至少 8 轮的双角色交流。",
        "height": 1440,
        "density": "2x",
        "encoding": "lossless-webp",
        "aspectRatio": "5:2",
        "sourceWidth": 1983,
        "presentation": "task-scene",
        "sourceHeight": 793,
        "proportionalScale": true
      }
    },
    {
      "id": "9d418ac8-b30c-4c19-8346-f544d5c793c6",
      "node_id": "a834273c-7858-4ad1-8587-97007acd90fb",
      "asset_key": "chapter-01-image-07",
      "media_type": "image",
      "purpose": "新成员卡读写情景图",
      "object_key": "images/smart-textbook/korean-level-one/chapter-01/step-07-scene-2x.webp",
      "production_status": "ready",
      "alt_text": {
        "ko-KR": "校园学习区里，两名学生阅读新成员卡并书写个人介绍。",
        "zh-CN": "校园学习区里，两名学生阅读新成员卡并书写个人介绍。"
      },
      "metadata": {
        "width": 3600,
        "goalKo": "이름, 국적과 신분을 읽고 4~5문장의 새 회원 소개 카드를 쓰세요.",
        "goalZh": "读出姓名、国籍和身份，再写一张 4—5 句的新成员介绍卡。",
        "height": 1440,
        "density": "2x",
        "encoding": "lossless-webp",
        "aspectRatio": "5:2",
        "sourceWidth": 1983,
        "presentation": "task-scene",
        "sourceHeight": 793,
        "proportionalScale": true
      }
    },
    {
      "id": "769edffe-7a9b-4f04-ba13-599c95c9e5a7",
      "node_id": "f0e8db18-ad29-46b3-b9c1-6a0b0717fd51",
      "asset_key": "chapter-01-image-08",
      "media_type": "image",
      "purpose": "章节综合交流与复盘情景图",
      "object_key": "images/smart-textbook/korean-level-one/chapter-01/step-08-scene-2x.webp",
      "production_status": "ready",
      "alt_text": {
        "ko-KR": "语言交换活动中，两名学生完成交流，旁边展示五项空白自查标记。",
        "zh-CN": "语言交换活动中，两名学生完成交流，旁边展示五项空白自查标记。"
      },
      "metadata": {
        "width": 3600,
        "goalKo": "종합 확인과 다섯 가지 자기 점검으로 첫 만남을 독립적으로 완성할 수 있는지 확인하세요.",
        "goalZh": "完成综合检测和五项自查，确认自己能独立完成第一次见面。",
        "height": 1440,
        "density": "2x",
        "encoding": "lossless-webp",
        "aspectRatio": "5:2",
        "sourceWidth": 1983,
        "presentation": "task-scene",
        "sourceHeight": 793,
        "proportionalScale": true
      }
    },
    {
      "id": "bb6be758-2b0a-49b6-be41-20e0c5e9ab28",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "asset_key": "guided-dialogue-jimin-intro",
      "media_type": "audio",
      "purpose": "guided-conversation-line",
      "object_key": "korean-level-one/chapter-01/patterns/guided-dialogue/jimin-intro.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "지민의 한국어 대화 음성",
        "zh-CN": "智敏的韩语对话音频"
      },
      "metadata": {
        "format": "audio/mpeg",
        "speaker": {
          "ko-KR": "지민",
          "zh-CN": "智敏"
        },
        "storage": "cloudflare-r2",
        "transcriptKo": "안녕하세요? 저는 김지민이에요.",
        "conversationStepId": "jimin-intro"
      }
    },
    {
      "id": "50b1d4f0-3506-4a56-9e56-940f49e0f645",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "asset_key": "guided-dialogue-wangming-intro",
      "media_type": "audio",
      "purpose": "guided-conversation-line",
      "object_key": "korean-level-one/chapter-01/patterns/guided-dialogue/wangming-intro.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "왕밍의 한국어 대화 음성",
        "zh-CN": "王明的韩语对话音频"
      },
      "metadata": {
        "format": "audio/mpeg",
        "speaker": {
          "ko-KR": "왕밍",
          "zh-CN": "王明"
        },
        "storage": "cloudflare-r2",
        "transcriptKo": "안녕하세요? 저는 왕밍이에요.",
        "conversationStepId": "wangming-intro"
      }
    },
    {
      "id": "3746c584-c2e8-46c3-82a6-e03125c3fe16",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "asset_key": "guided-dialogue-jimin-asks-identity",
      "media_type": "audio",
      "purpose": "guided-conversation-line",
      "object_key": "korean-level-one/chapter-01/patterns/guided-dialogue/jimin-asks-identity.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "지민의 한국어 대화 음성",
        "zh-CN": "智敏的韩语对话音频"
      },
      "metadata": {
        "format": "audio/mpeg",
        "speaker": {
          "ko-KR": "지민",
          "zh-CN": "智敏"
        },
        "storage": "cloudflare-r2",
        "transcriptKo": "왕밍 씨는 학생이에요?",
        "conversationStepId": "jimin-asks-identity"
      }
    },
    {
      "id": "45483f2f-9f68-43b7-8b5c-6281c2d39db7",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "asset_key": "guided-dialogue-wangming-identity",
      "media_type": "audio",
      "purpose": "guided-conversation-line",
      "object_key": "korean-level-one/chapter-01/patterns/guided-dialogue/wangming-identity.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "왕밍의 한국어 대화 음성",
        "zh-CN": "王明的韩语对话音频"
      },
      "metadata": {
        "format": "audio/mpeg",
        "speaker": {
          "ko-KR": "왕밍",
          "zh-CN": "王明"
        },
        "storage": "cloudflare-r2",
        "transcriptKo": "네, 학생이에요. 한국어를 배워요.",
        "conversationStepId": "wangming-identity"
      }
    },
    {
      "id": "6d596e59-191b-4f42-b61a-2961aa7e335a",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "asset_key": "guided-dialogue-wangming-asks-identity",
      "media_type": "audio",
      "purpose": "guided-conversation-line",
      "object_key": "korean-level-one/chapter-01/patterns/guided-dialogue/wangming-asks-identity.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "왕밍의 한국어 대화 음성",
        "zh-CN": "王明的韩语对话音频"
      },
      "metadata": {
        "format": "audio/mpeg",
        "speaker": {
          "ko-KR": "왕밍",
          "zh-CN": "王明"
        },
        "storage": "cloudflare-r2",
        "transcriptKo": "지민 씨는 학생이에요?",
        "conversationStepId": "wangming-asks-identity"
      }
    },
    {
      "id": "a69d366d-c5d8-4661-9f8e-833606505711",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "asset_key": "guided-dialogue-jimin-identity",
      "media_type": "audio",
      "purpose": "guided-conversation-line",
      "object_key": "korean-level-one/chapter-01/patterns/guided-dialogue/jimin-identity.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "지민의 한국어 대화 음성",
        "zh-CN": "智敏的韩语对话音频"
      },
      "metadata": {
        "format": "audio/mpeg",
        "speaker": {
          "ko-KR": "지민",
          "zh-CN": "智敏"
        },
        "storage": "cloudflare-r2",
        "transcriptKo": "네, 저도 학생이에요.",
        "conversationStepId": "jimin-identity"
      }
    },
    {
      "id": "a2b8e50b-082d-42d7-9b03-a7c07b55f500",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "asset_key": "guided-dialogue-wangming-closing",
      "media_type": "audio",
      "purpose": "guided-conversation-line",
      "object_key": "korean-level-one/chapter-01/patterns/guided-dialogue/wangming-closing.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "왕밍의 한국어 대화 음성",
        "zh-CN": "王明的韩语对话音频"
      },
      "metadata": {
        "format": "audio/mpeg",
        "speaker": {
          "ko-KR": "왕밍",
          "zh-CN": "王明"
        },
        "storage": "cloudflare-r2",
        "transcriptKo": "만나서 반가워요.",
        "conversationStepId": "wangming-closing"
      }
    },
    {
      "id": "8491d6a6-86e7-4c53-8944-6dc7dafdc5f9",
      "node_id": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
      "asset_key": "guided-dialogue-jimin-closing",
      "media_type": "audio",
      "purpose": "guided-conversation-line",
      "object_key": "korean-level-one/chapter-01/patterns/guided-dialogue/jimin-closing.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "지민의 한국어 대화 음성",
        "zh-CN": "智敏的韩语对话音频"
      },
      "metadata": {
        "format": "audio/mpeg",
        "speaker": {
          "ko-KR": "지민",
          "zh-CN": "智敏"
        },
        "storage": "cloudflare-r2",
        "transcriptKo": "저도 만나서 반가워요.",
        "conversationStepId": "jimin-closing"
      }
    },
    {
      "id": "d14b0ef6-d8c6-4fbf-ae6e-70bb83164c0a",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-alt-line-01",
      "media_type": "audio",
      "purpose": "第二对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-alt-line-01.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-alt-line-01",
        "script": "두 사람은 처음 만나지요? 제 친구 리나 씨를 소개할게요.",
        "speaker": "F02／민지"
      }
    },
    {
      "id": "eede3d55-eb4d-4fb6-9291-a9d770669187",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-alt-line-02",
      "media_type": "audio",
      "purpose": "第二对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-alt-line-02.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-alt-line-02",
        "script": "안녕하세요? 리나 씨는 선생님이에요?",
        "speaker": "M01／왕밍"
      }
    },
    {
      "id": "0fb9fe48-ef4f-4037-aaa4-6edcc104e668",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-alt-line-03",
      "media_type": "audio",
      "purpose": "第二对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-alt-line-03.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-alt-line-03",
        "script": "아니요, 저는 학생이에요. 중국 사람이에요.",
        "speaker": "F03／리나"
      }
    },
    {
      "id": "2e9f9817-a20d-449e-826c-387afbb9d885",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-alt-line-04",
      "media_type": "audio",
      "purpose": "第二对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-alt-line-04.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-alt-line-04",
        "script": "왕밍 씨도 한국어를 배워요. 서로 인사하세요.",
        "speaker": "F02／민지"
      }
    },
    {
      "id": "ce3f45c5-3aaf-4c35-87d5-ae74a4bdfa4f",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-alt-line-05",
      "media_type": "audio",
      "purpose": "第二对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-alt-line-05.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-alt-line-05",
        "script": "만나서 반가워요.",
        "speaker": "M01／왕밍"
      }
    },
    {
      "id": "15bbfc06-bbf1-4fb7-a804-fcefb4576769",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-alt-line-06",
      "media_type": "audio",
      "purpose": "第二对话逐句",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-alt-line-06.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-alt-line-06",
        "script": "저도 반가워요.",
        "speaker": "F03／리나"
      }
    },
    {
      "id": "c28af830-9658-4e43-97f5-4ba991c4c51d",
      "node_id": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
      "asset_key": "chapter-01-dialogue-alt",
      "media_type": "audio",
      "purpose": "第二对话整段",
      "object_key": "korean-level-one/chapter-01/audio/dialogue/chapter-01-dialogue-alt.mp3",
      "production_status": "pending",
      "alt_text": {
        "ko-KR": "대화 음원 제작 대기",
        "zh-CN": "对话音频待制作"
      },
      "metadata": {
        "id": "chapter-01-dialogue-alt",
        "script": "두 사람은 처음 만나지요? 제 친구 리나 씨를 소개할게요. 안녕하세요? 리나 씨는 선생님이에요? 아니요, 저는 학생이에요. 중국 사람이에요. 왕밍 씨도 한국어를 배워요. 서로 인사하세요. 만나서 반가워요. 저도 반가워요.",
        "speaker": "F02／M01／F03"
      }
    },
    {
      "id": "c6950062-9ab0-4a02-8f67-5f6c88e18a10",
      "node_id": "67ce4cfc-573b-4071-a2a5-0122274864f1",
      "asset_key": "chapter-01-listening-identity-normal",
      "media_type": "audio",
      "purpose": "私有听力正常语速",
      "object_key": "korean-level-one/chapter-01/listening/chapter-01-listening-identity-normal.mp3",
      "production_status": "ready",
      "alt_text": {
        "ko-KR": "보통 속도 듣기 음원 제작 대기",
        "zh-CN": "正常语速听力待制作"
      },
      "metadata": {
        "voice": "ko-KR-SunHiNeural",
        "format": "mp3",
        "locale": "ko-KR",
        "speaker": "F04／수진",
        "channels": 1,
        "generatedBy": "edge-tts",
        "audioEdition": "temporary_tts",
        "sampleRateHz": 24000,
        "speakingRate": 0.92,
        "voiceProfile": "F04/sujin",
        "scriptRevision": "chapter-01-listening-v1",
        "durationSeconds": 14.136,
        "scriptVisibility": "private",
        "targetDurationSeconds": 18,
        "replaceableByHumanRecording": true
      }
    }
  ],
  "tracks": [
    {
      "activity_id": "6876a867-ae78-4336-9d3a-1745a351b6ee",
      "page_index": 0,
      "audio_object_key": "korean-level-one/chapter-01/listening/chapter-01-listening-identity-normal.mp3",
      "audio_status": "ready"
    },
    {
      "activity_id": "6876a867-ae78-4336-9d3a-1745a351b6ee",
      "page_index": 1,
      "audio_object_key": "korean-level-one/chapter-01/listening/chapter-01-listening-dialogue-normal.mp3",
      "audio_status": "ready"
    }
  ],
  "lessons": [
    {
      "id": "6846a261-51ee-41b9-93fe-b751e65222af",
      "module_id": "016124f4-00b8-4ca5-9426-b92a0417a2a6"
    },
    {
      "id": "a207330d-178a-4091-8d8e-08c5c6b6dbd2",
      "module_id": "01e528a1-9c86-4dd3-baa6-ee87851ac521"
    },
    {
      "id": "125f20ac-b792-4353-8d86-c4d3d25262c2",
      "module_id": "04226145-7dd7-4a27-a4f2-03ec766f0f1a"
    },
    {
      "id": "0a1ebf2d-d987-4476-8f23-2269799e45df",
      "module_id": "42665398-c41e-4db8-9f0e-9626e126cba8"
    },
    {
      "id": "e0fd22d8-6941-4253-83a9-a43ba01ecdc7",
      "module_id": "546b7ae4-142c-47c0-b4f9-04b3d5c02c3d"
    },
    {
      "id": "e20e4d6f-c119-42d0-a256-61402d322e36",
      "module_id": "65646324-f988-4268-bc9b-4704921e57d0"
    },
    {
      "id": "9156af7a-7d74-41ed-a72f-b2a0c214a8c0",
      "module_id": "acc3107f-7255-4d65-860b-0968491f293a"
    },
    {
      "id": "7ba65b8d-2f5b-4c6e-87f7-2cffc9eec367",
      "module_id": "ddb8b68c-5eca-478c-aa97-26ef7f7a24ab"
    }
  ],
  "teachingVersions": [
    {
      "id": "feb30ba7-0a5e-4e9f-83e6-8970f715ddd5",
      "lesson_id": "0a1ebf2d-d987-4476-8f23-2269799e45df",
      "version_number": 23,
      "status": "published"
    }
  ],
  "teachingNodes": [
    {
      "id": "ca2957d6-b148-4416-a946-1a8e75b130e4",
      "script_version_id": "feb30ba7-0a5e-4e9f-83e6-8970f715ddd5",
      "node_key": "step-8-bbfc46",
      "node_type": "explanation",
      "sort_order": 1,
      "title": {
        "ko-KR": "새 수업 단계",
        "zh-CN": "开始前问候"
      },
      "teacher_script": {
        "ko-KR": "한국어 1급 학습 여정에 오신 것을 환영해요! 이번 장에서는 학습 안내, 핵심 어휘, 문법 이해, 문형 연습, 실전 대화, 듣기·말하기, 읽기·쓰기, 자기 점검까지 모두 여덟 부분을 함께 거쳐 갈 거예요. 내용이 많아 보여도 걱정하지 마세요. 각 부분은 독립된 작은 과제라서 하나를 끝내면 자연스럽게 다음으로 이어지고, 미리 예습할 필요 없이 제 속도에 맞춰 하나씩 따라오면 돼요.",
        "zh-CN": "欢迎来到韩国语 1 级的学习旅程！这一章我们会一起走过课前导航、核心词汇、语法讲解、句型操练、实战对话、听说任务、读写拓展和自测复盘，一共八个部分。 \n\n别担心内容太多，每个部分都是独立的小任务，做完一个自然接上下一个，不需要提前预习，跟着我的节奏一步步来就好。"
      },
      "configuration": {
        "display": {
          "mode": "slides",
          "slides": [
            {
              "id": "legacy-slide",
              "name": "画面 1",
              "elements": [
                {
                  "x": 7,
                  "y": 8,
                  "id": "legacy-title",
                  "tone": "default",
                  "type": "text",
                  "align": "left",
                  "width": 86,
                  "height": 16,
                  "content": "本章学习路线",
                  "fontSize": 30,
                  "fontWeight": 700,
                  "translation": ""
                },
                {
                  "x": 7,
                  "y": 28,
                  "id": "legacy-items",
                  "tone": "primary",
                  "type": "bullets",
                  "align": "left",
                  "width": 86,
                  "height": 42,
                  "content": "课前导航 → 核心词汇 → 语法讲解\n句型操练 → 实战对话\n听说任务 → 读写拓展 → 自测与复盘",
                  "fontSize": 20,
                  "fontWeight": 600,
                  "translation": ""
                }
              ],
              "background": "plain",
              "segmentIndex": 0
            }
          ],
          "placement": {
            "x": 37,
            "y": 19,
            "scale": 1.4
          }
        },
        "terminal": false,
        "bufferLine": {
          "ko-KR": "안녕하세요, 여러분의 한국어 선생님 김 선생님이에요. 앞으로 여러분의 한국어 학습을 함께할게요.",
          "zh-CN": "你好，我是你们的韩语老师，金老师。接下来由我陪伴你们学习韩语。"
        },
        "bufferPresetId": "teacher-introduction",
        "virtualCharacter": {
          "kind": "uply-teacher",
          "position": "right"
        },
        "scriptPerformances": [
          {
            "pose": "greeting",
            "dialogueX": 90,
            "dialogueY": 70,
            "voiceRate": 1,
            "characterX": 76.19047934964577,
            "characterY": 15.551043265568737,
            "voiceEnabled": true,
            "voiceLanguage": "auto",
            "characterScale": 1.2,
            "learningLayout": "teaching",
            "splitDialogueX": 71.19252476616774,
            "splitDialogueY": 35.499699296264154,
            "splitCharacterX": 25.468172015149413,
            "splitCharacterY": 8.518435737137025,
            "narrowCharacterX": 90,
            "narrowCharacterY": 6,
            "autoContinueToNext": true,
            "splitCharacterScale": 0.82,
            "narrowCharacterScale": 0.6
          },
          {
            "pose": "explaining",
            "dialogueX": 90,
            "dialogueY": 37,
            "voiceRate": 1,
            "characterX": 80,
            "characterY": 15,
            "voiceEnabled": true,
            "voiceLanguage": "auto",
            "characterScale": 1.2,
            "learningLayout": "teaching",
            "splitDialogueX": 78,
            "splitDialogueY": 45,
            "splitCharacterX": 68,
            "splitCharacterY": 15,
            "narrowCharacterX": 90,
            "narrowCharacterY": 6,
            "autoContinueToNext": false,
            "splitCharacterScale": 0.82,
            "narrowCharacterScale": 0.6
          }
        ]
      },
      "reference_activity_id": null,
      "action_type": "none",
      "next_node_key": null,
      "remediation_node_key": null,
      "is_required": true
    },
    {
      "id": "d654205c-e969-48b9-98b4-a658f1c8366e",
      "script_version_id": "feb30ba7-0a5e-4e9f-83e6-8970f715ddd5",
      "node_key": "welcome",
      "node_type": "opening",
      "sort_order": 2,
      "title": {
        "ko-KR": "수업 시작",
        "zh-CN": "开始上课"
      },
      "teacher_script": {
        "ko-KR": "안녕하세요. 김 선생님입니다. 오늘은 처음 만났을 때 자연스럽게 대화를 시작하는 방법을 배워요.",
        "zh-CN": "今天我们学习第一次见面时怎样自然地用韩语开口。\n\n学完这一章节，你会知道怎么用韩语打招呼、怎样介绍自己，以及怎样礼貌结束对话。"
      },
      "configuration": {
        "hint": {
          "zh-CN": "先记住今天的顺序：问候、介绍、确认、结束。"
        },
        "display": {
          "mode": "slides",
          "slides": [
            {
              "id": "legacy-slide",
              "name": "画面 1",
              "elements": [
                {
                  "x": 7,
                  "y": 8,
                  "id": "legacy-title",
                  "tone": "default",
                  "type": "text",
                  "align": "left",
                  "width": 86,
                  "height": 16,
                  "content": "初次见面，你会说什么啊？",
                  "fontSize": 30,
                  "fontWeight": 700,
                  "translation": ""
                },
                {
                  "x": 7,
                  "y": 28,
                  "id": "legacy-items",
                  "tone": "primary",
                  "type": "bullets",
                  "align": "left",
                  "width": 86,
                  "height": 42,
                  "content": "先问候\n介绍姓名与身份\n确认对方信息\n礼貌结束",
                  "fontSize": 20,
                  "fontWeight": 600,
                  "translation": ""
                },
                {
                  "x": 7,
                  "y": 72,
                  "id": "legacy-expression",
                  "tone": "highlight",
                  "type": "expression",
                  "align": "left",
                  "width": 86,
                  "height": 20,
                  "content": "안녕하세요? → 저는 왕밍이에요. → 만나서 반가워요.",
                  "fontSize": 27,
                  "fontWeight": 700,
                  "translation": "你好 → 我是王明 → 很高兴见到你"
                }
              ],
              "background": "plain",
              "segmentIndex": 0
            }
          ],
          "placement": {
            "x": 36.77169464169274,
            "y": 19.395052133231697,
            "scale": 1.4
          }
        },
        "example": {
          "zh-CN": "比如先学会你好， 안녕하세요."
        },
        "terminal": false,
        "bufferLine": {
          "ko-KR": "",
          "zh-CN": ""
        },
        "bufferPresetId": "none",
        "virtualCharacter": {
          "kind": "uply-teacher",
          "position": "right"
        },
        "scriptPerformances": [
          {
            "pose": "greeting",
            "dialogueX": 84.62577425553953,
            "dialogueY": 66.923513179487,
            "voiceRate": 1,
            "characterX": 71.81502455694653,
            "characterY": 12.054062358817674,
            "voiceEnabled": true,
            "voiceLanguage": "auto",
            "characterScale": 1.2,
            "learningLayout": "teaching",
            "splitDialogueX": 78,
            "splitDialogueY": 45,
            "splitCharacterX": 68,
            "splitCharacterY": 15,
            "narrowCharacterX": 90,
            "narrowCharacterY": 6,
            "autoContinueToNext": true,
            "splitCharacterScale": 0.82,
            "narrowCharacterScale": 0.6
          },
          {
            "pose": "greeting",
            "dialogueX": 90,
            "dialogueY": 69.99537106449588,
            "voiceRate": 1,
            "characterX": 80,
            "characterY": 15,
            "voiceEnabled": true,
            "voiceLanguage": "auto",
            "characterScale": 1.2,
            "learningLayout": "teaching",
            "splitDialogueX": 78,
            "splitDialogueY": 45,
            "splitCharacterX": 68,
            "splitCharacterY": 15,
            "narrowCharacterX": 90,
            "narrowCharacterY": 6,
            "autoContinueToNext": false,
            "splitCharacterScale": 0.82,
            "narrowCharacterScale": 0.6
          }
        ]
      },
      "reference_activity_id": null,
      "action_type": "none",
      "next_node_key": "observe-scene",
      "remediation_node_key": null,
      "is_required": true
    },
    {
      "id": "358d3abf-8224-47f3-8c18-29ad3bf81fc0",
      "script_version_id": "feb30ba7-0a5e-4e9f-83e6-8970f715ddd5",
      "node_key": "observe-scene",
      "node_type": "instruction",
      "sort_order": 3,
      "title": {
        "ko-KR": "장면 관찰",
        "zh-CN": "观察情景"
      },
      "teacher_script": {
        "ko-KR": "오른쪽 그림을 먼저 보세요. 왕밍과 지민은 교내 국제교류센터에서 처음 만났습니다. 먼저 공손하게 인사하며 대화를 시작합니다.",
        "zh-CN": "先看右侧图片。王明和智敏在校园国际交流中心第一次见面。第一次见面不能直接进入复杂话题，通常要先用一句礼貌的问候建立交流。"
      },
      "configuration": {
        "hint": {
          "zh-CN": "注意两个人物的关系：他们是第一次见面。"
        },
        "display": {
          "mode": "slides",
          "slides": [
            {
              "id": "legacy-slide",
              "name": "画面 1",
              "elements": [
                {
                  "x": 7,
                  "y": 8,
                  "id": "legacy-title",
                  "tone": "default",
                  "type": "text",
                  "align": "left",
                  "width": 86,
                  "height": 16,
                  "content": "先看人物、地点和关系",
                  "fontSize": 30,
                  "fontWeight": 700,
                  "translation": ""
                },
                {
                  "x": 7.210178274530737,
                  "y": 19.90425868160675,
                  "id": "legacy-items",
                  "tone": "primary",
                  "type": "bullets",
                  "align": "left",
                  "width": 86,
                  "height": 23.691151590905413,
                  "content": "人物：王明、智敏\n地点：校园语言交换活动\n关系：第一次见面",
                  "fontSize": 20,
                  "fontWeight": 600,
                  "translation": ""
                },
                {
                  "x": 6.929947844428277,
                  "y": 49.470062180021706,
                  "id": "legacy-expression",
                  "tone": "highlight",
                  "type": "expression",
                  "align": "left",
                  "width": 86,
                  "height": 20,
                  "content": "그 사람들은 뭐 하고 있어요?",
                  "fontSize": 27,
                  "fontWeight": 700,
                  "translation": "他们正在做什么？"
                }
              ],
              "background": "plain",
              "segmentIndex": 0
            }
          ],
          "placement": {
            "x": 36.77169464169274,
            "y": 19.395052133231697,
            "scale": 1.4
          }
        },
        "example": {
          "zh-CN": "你跟不认识的同学见面的时候会说什么？"
        },
        "terminal": false,
        "visualCue": {
          "effect": "pulse",
          "targetKey": "orientation:page:scene",
          "durationMs": 1000,
          "pulseCount": 2
        },
        "bufferLine": {
          "ko-KR": "이제 학습 영역에 집중해 주세요.",
          "zh-CN": "接下来，请把注意力放到学习区。"
        },
        "bufferPresetId": "focus-learning",
        "virtualCharacter": {
          "kind": "uply-teacher",
          "position": "right"
        },
        "scriptPerformances": [
          {
            "pose": "greeting",
            "dialogueX": 87.7076073254856,
            "dialogueY": 48.44475251469399,
            "voiceRate": 1,
            "characterX": 73.86956739689971,
            "characterY": 24.524394496834915,
            "voiceEnabled": true,
            "voiceLanguage": "auto",
            "characterScale": 1,
            "learningLayout": "split",
            "splitDialogueX": 68.77538347519747,
            "splitDialogueY": 31.678889344995184,
            "splitCharacterX": 28.691047969992095,
            "splitCharacterY": 0.9565307761032358,
            "narrowCharacterX": 90,
            "narrowCharacterY": 6,
            "autoContinueToNext": false,
            "splitCharacterScale": 0.82,
            "narrowCharacterScale": 0.6
          }
        ]
      },
      "reference_activity_id": null,
      "action_type": "none",
      "next_node_key": "explain-order",
      "remediation_node_key": null,
      "is_required": true
    },
    {
      "id": "a14eefb2-c1af-4ddf-a87f-159e1c64648c",
      "script_version_id": "feb30ba7-0a5e-4e9f-83e6-8970f715ddd5",
      "node_key": "explain-order",
      "node_type": "explanation",
      "sort_order": 4,
      "title": {
        "ko-KR": "대화 순서",
        "zh-CN": "交流顺序"
      },
      "teacher_script": {
        "ko-KR": "대화 순서는 인사, 자기소개, 상대 정보 확인, 마무리 인사입니다.",
        "zh-CN": "这次见面的交流顺序很清楚：先说 안녕하세요? 进行问候，再用 저는 …이에요/예요 介绍姓名或身份，接着确认对方信息，最后说 만나서 반가워요 表达见面的礼貌。"
      },
      "configuration": {
        "hint": {
          "zh-CN": "把它记成四步：问候 → 自我介绍 → 确认身份 → 礼貌结束。"
        },
        "display": {
          "kind": "sequence",
          "items": {
            "ko-KR": [
              "인사",
              "자기소개",
              "신분 확인",
              "마무리 인사"
            ],
            "zh-CN": [
              "问候",
              "自我介绍",
              "确认身份",
              "礼貌结束"
            ]
          },
          "title": {
            "ko-KR": "첫 만남의 대화 순서",
            "zh-CN": "初次见面的交流顺序"
          },
          "korean": "안녕하세요? → 저는 왕밍이에요. → 학생이에요? → 만나서 반가워요.",
          "placement": {
            "x": 36.77169464169274,
            "y": 19.395052133231697,
            "scale": 1.4
          },
          "translation": {
            "ko-KR": "",
            "zh-CN": "你好 → 我是王明 → 是学生吗？→ 很高兴见到你"
          }
        },
        "example": {
          "zh-CN": "例如：안녕하세요? 저는 왕밍이에요. 만나서 반가워요."
        },
        "virtualCharacter": {
          "kind": "uply-teacher",
          "position": "right"
        },
        "scriptPerformances": []
      },
      "reference_activity_id": null,
      "action_type": "none",
      "next_node_key": "model-dialogue",
      "remediation_node_key": null,
      "is_required": true
    },
    {
      "id": "21586656-413b-406c-b9cc-452bc63ee09d",
      "script_version_id": "feb30ba7-0a5e-4e9f-83e6-8970f715ddd5",
      "node_key": "model-dialogue",
      "node_type": "example",
      "sort_order": 5,
      "title": {
        "ko-KR": "대화 예시",
        "zh-CN": "听懂示范"
      },
      "teacher_script": {
        "ko-KR": "왕밍이 먼저 “안녕하세요?”라고 말하고 지민이 “네, 안녕하세요?”라고 대답합니다.",
        "zh-CN": "看一组最短示范。王明先说“안녕하세요?”，智敏回答“네, 안녕하세요?”。这里的 네 表示对问候作出自然回应，不需要逐字翻译成一句完整中文。"
      },
      "configuration": {
        "hint": {
          "zh-CN": "先听谁主动开口，再听对方怎样回应。"
        },
        "display": {
          "kind": "expression",
          "items": {
            "ko-KR": [
              "왕밍이 먼저 인사",
              "지민이 응답"
            ],
            "zh-CN": [
              "王明先开口",
              "智敏回应"
            ]
          },
          "title": {
            "ko-KR": "가장 짧은 인사 예시",
            "zh-CN": "最短问候示范"
          },
          "korean": "왕밍: 안녕하세요?\\n지민: 네, 안녕하세요?",
          "placement": {
            "x": 36.77169464169274,
            "y": 19.395052133231697,
            "scale": 1.4
          },
          "translation": {
            "ko-KR": "",
            "zh-CN": "王明：你好？\\n智敏：嗯，你好？"
          }
        },
        "example": {
          "zh-CN": "王明：안녕하세요?\n智敏：네, 안녕하세요?"
        },
        "studentTask": {
          "kind": "play_expression_audio",
          "required": true,
          "eventType": "audio_completed",
          "targetKey": "dialogue:greeting:0",
          "instruction": {
            "ko-KR": "오른쪽 상황과 표현의 인사에서 첫 문장 안녕하세요?를 눌러 끝까지 들어 보세요.",
            "zh-CN": "请到右侧“情景与表达”的“问候”中，点击第一句 안녕하세요? 并完整听完。"
          },
          "targetLabel": {
            "ko-KR": "인사 · 안녕하세요?",
            "zh-CN": "问候 · 안녕하세요?"
          }
        },
        "virtualCharacter": {
          "kind": "uply-teacher",
          "position": "right"
        },
        "scriptPerformances": []
      },
      "reference_activity_id": null,
      "action_type": "play_expression",
      "next_node_key": "check-understanding",
      "remediation_node_key": null,
      "is_required": true
    },
    {
      "id": "7be0124c-0a16-472e-a0ab-0bc55e437807",
      "script_version_id": "feb30ba7-0a5e-4e9f-83e6-8970f715ddd5",
      "node_key": "check-understanding",
      "node_type": "question",
      "sort_order": 6,
      "title": {
        "ko-KR": "이해 확인",
        "zh-CN": "理解检查"
      },
      "teacher_script": {
        "ko-KR": "왕밍과 지민이 처음 만났을 때 가장 먼저 한 말은 무엇인가요?",
        "zh-CN": "现在检查一下：王明和智敏第一次见面时，最先说了哪一句？"
      },
      "configuration": {
        "hint": {
          "zh-CN": "回想刚才示范对话的第一句。"
        },
        "display": {
          "kind": "question",
          "items": {
            "ko-KR": [],
            "zh-CN": []
          },
          "title": {
            "ko-KR": "처음 만났을 때 먼저 무엇을 말할까요?",
            "zh-CN": "第一次见面，先说哪一句？"
          },
          "korean": "",
          "placement": {
            "x": 36.77169464169274,
            "y": 19.395052133231697,
            "scale": 1.4
          },
          "translation": {
            "ko-KR": "",
            "zh-CN": ""
          }
        },
        "virtualCharacter": {
          "kind": "uply-teacher",
          "position": "right"
        },
        "scriptPerformances": []
      },
      "reference_activity_id": "aafa6ccc-4d4a-4dba-9315-2f30381e8a13",
      "action_type": "none",
      "next_node_key": "lesson-mission",
      "remediation_node_key": "model-dialogue",
      "is_required": true
    },
    {
      "id": "58e88ad7-1413-487d-b75e-c4dc3cc6e9e4",
      "script_version_id": "feb30ba7-0a5e-4e9f-83e6-8970f715ddd5",
      "node_key": "lesson-mission",
      "node_type": "explanation",
      "sort_order": 7,
      "title": {
        "ko-KR": "이번 과제",
        "zh-CN": "本课任务"
      },
      "teacher_script": {
        "ko-KR": "이번 단원의 마지막 과제는 혼자 자기소개하는 것이 아니라 두 역할이 여덟 턴 이상 번갈아 대화하는 것입니다.",
        "zh-CN": "很好。还要注意，本课最后不是完成一段单人自我介绍，而是让两个角色交替完成至少八轮对话。所以从现在开始，要把每个表达看成一次真实交流中的一句话。"
      },
      "configuration": {
        "hint": {
          "zh-CN": "课末目标是双向对话，不是一个人连续说完。"
        },
        "display": {
          "kind": "task",
          "items": {
            "ko-KR": [
              "두 역할이 번갈아 말하기",
              "최소 8턴 대화 완성하기",
              "혼자 하는 자기소개로 대신하지 않기"
            ],
            "zh-CN": [
              "两个角色交替说话",
              "至少完成 8 轮对话",
              "不能用单人自我介绍代替"
            ]
          },
          "title": {
            "ko-KR": "수업 끝에 무엇을 완성하나요?",
            "zh-CN": "课末要完成什么？"
          },
          "korean": "",
          "placement": {
            "x": 36.77169464169274,
            "y": 19.395052133231697,
            "scale": 1.4
          },
          "translation": {
            "ko-KR": "",
            "zh-CN": ""
          }
        },
        "virtualCharacter": {
          "kind": "uply-teacher",
          "position": "right"
        },
        "scriptPerformances": []
      },
      "reference_activity_id": null,
      "action_type": "none",
      "next_node_key": "ready-for-practice",
      "remediation_node_key": null,
      "is_required": true
    },
    {
      "id": "b2a3d319-94d7-41b1-be6c-b6029d6da16a",
      "script_version_id": "feb30ba7-0a5e-4e9f-83e6-8970f715ddd5",
      "node_key": "ready-for-practice",
      "node_type": "summary",
      "sort_order": 8,
      "title": {
        "ko-KR": "연습 시작",
        "zh-CN": "开始练习"
      },
      "teacher_script": {
        "ko-KR": "이제 첫 만남의 기본 순서를 알았습니다. 오른쪽의 상황 진단을 완성해 보세요.",
        "zh-CN": "现在你已经知道初次见面的基本顺序：先问候，再介绍和确认信息，最后礼貌结束。接下来请完成右侧的情景诊断，我会根据你的真实作答继续帮助你。"
      },
      "configuration": {
        "display": {
          "kind": "summary",
          "items": {
            "ko-KR": [
              "장면 이해",
              "순서 익히기",
              "예시 듣기",
              "수업 과제 확인"
            ],
            "zh-CN": [
              "认识场景",
              "掌握顺序",
              "听过示范",
              "明确课末任务"
            ]
          },
          "title": {
            "ko-KR": "수업 전 안내 완료",
            "zh-CN": "课前导航完成"
          },
          "korean": "안녕하세요? 만나서 반가워요.",
          "placement": {
            "x": 36.77169464169274,
            "y": 19.395052133231697,
            "scale": 1.4
          },
          "translation": {
            "ko-KR": "",
            "zh-CN": "你好，很高兴见到你。"
          }
        },
        "terminal": true,
        "continueLabel": {
          "ko-KR": "상황 진단 시작",
          "zh-CN": "开始情景诊断"
        },
        "virtualCharacter": {
          "kind": "uply-teacher",
          "position": "right"
        },
        "scriptPerformances": []
      },
      "reference_activity_id": "aafa6ccc-4d4a-4dba-9315-2f30381e8a13",
      "action_type": "focus_activity",
      "next_node_key": null,
      "remediation_node_key": null,
      "is_required": true
    }
  ],
  "speech": [
    {
      "id": "6dacb05c-8913-4546-b484-51d216e2b72e",
      "script_node_id": "7be0124c-0a16-472e-a0ab-0bc55e437807",
      "locale": "ko-KR",
      "segment_index": 0,
      "content_hash": "73dbe8641e411bf738a9c850e078c5b2954f5b9d0e9ad1dca96c1c585f7e1baf",
      "duration_ms": 5280,
      "production_status": "ready"
    },
    {
      "id": "b4334fd7-1c63-45ff-b75e-6f2b9dec216c",
      "script_node_id": "7be0124c-0a16-472e-a0ab-0bc55e437807",
      "locale": "ko-KR",
      "segment_index": 199,
      "content_hash": "cba8a4d2cae6d8854968524ad67f6d2012439c01f6c82ee44e35500253e3508b",
      "duration_ms": 3672,
      "production_status": "ready"
    },
    {
      "id": "f999103b-62ac-4b05-9cd8-2a4a4363f631",
      "script_node_id": "7be0124c-0a16-472e-a0ab-0bc55e437807",
      "locale": "zh-CN",
      "segment_index": 0,
      "content_hash": "240ab46bc6df970d401dcaa3b1869b65075677fcb999b71e7fc3f80976115fc2",
      "duration_ms": 5808,
      "production_status": "ready"
    },
    {
      "id": "650f6975-5255-4d90-835d-98c0266172aa",
      "script_node_id": "7be0124c-0a16-472e-a0ab-0bc55e437807",
      "locale": "zh-CN",
      "segment_index": 197,
      "content_hash": "6d2a9fcd85a74e40cca53f3c617f4ac72799d3bfb350cb5674ce4b3d5f400285",
      "duration_ms": 3072,
      "production_status": "ready"
    },
    {
      "id": "975156c1-c730-41f3-a063-63857bca064a",
      "script_node_id": "7be0124c-0a16-472e-a0ab-0bc55e437807",
      "locale": "zh-CN",
      "segment_index": 199,
      "content_hash": "b3566acda86a742067f76fa18c3221793e51c3e67d55d9d1942472d3dbde0786",
      "duration_ms": 3384,
      "production_status": "ready"
    },
    {
      "id": "8ecf50aa-d1b7-4c3a-a9d7-39be14a237a6",
      "script_node_id": "a14eefb2-c1af-4ddf-a87f-159e1c64648c",
      "locale": "ko-KR",
      "segment_index": 0,
      "content_hash": "296066f68282a55bd4f18826326d21b01267615975304c07a6e1d4b257b4edfc",
      "duration_ms": 6288,
      "production_status": "ready"
    },
    {
      "id": "a0a554c4-42da-4ef0-ba72-3894888fd18f",
      "script_node_id": "a14eefb2-c1af-4ddf-a87f-159e1c64648c",
      "locale": "ko-KR",
      "segment_index": 199,
      "content_hash": "cba8a4d2cae6d8854968524ad67f6d2012439c01f6c82ee44e35500253e3508b",
      "duration_ms": 3672,
      "production_status": "ready"
    },
    {
      "id": "b1400095-624c-4601-bef7-6baf50dc0e0a",
      "script_node_id": "a14eefb2-c1af-4ddf-a87f-159e1c64648c",
      "locale": "zh-CN",
      "segment_index": 0,
      "content_hash": "d0139f2fd8fc3e39522de3ba5d68b415a80c5ca8cfa8ff1a2f2f9e06323fd2fb",
      "duration_ms": 20064,
      "production_status": "ready"
    },
    {
      "id": "4ec3bfd6-29f7-45f0-9b98-d61ddb754503",
      "script_node_id": "a14eefb2-c1af-4ddf-a87f-159e1c64648c",
      "locale": "zh-CN",
      "segment_index": 197,
      "content_hash": "af13cbc2ddb23b4903f9e7c98f0c2c689def8e4cf9b2c14bc83039ef83ffc4b1",
      "duration_ms": 5568,
      "production_status": "ready"
    },
    {
      "id": "9d781363-ca1c-4e9f-acdd-e424cd7a5fcf",
      "script_node_id": "a14eefb2-c1af-4ddf-a87f-159e1c64648c",
      "locale": "zh-CN",
      "segment_index": 198,
      "content_hash": "9f38f9370416f88faa5763ce9024abef5099a40b2b4ca99d61936fbcc2abe68f",
      "duration_ms": 7944,
      "production_status": "ready"
    },
    {
      "id": "9e27f5e3-3f17-4b05-9879-61e9c76f8b8b",
      "script_node_id": "a14eefb2-c1af-4ddf-a87f-159e1c64648c",
      "locale": "zh-CN",
      "segment_index": 199,
      "content_hash": "b3566acda86a742067f76fa18c3221793e51c3e67d55d9d1942472d3dbde0786",
      "duration_ms": 3384,
      "production_status": "ready"
    },
    {
      "id": "be43b86c-de26-49b3-ba14-8a1e37ab0f84",
      "script_node_id": "58e88ad7-1413-487d-b75e-c4dc3cc6e9e4",
      "locale": "ko-KR",
      "segment_index": 0,
      "content_hash": "466926f7ed4136c900d7f4241eef2d91ea3b4aa32fc4efcfab63356b5c0668b8",
      "duration_ms": 7992,
      "production_status": "ready"
    },
    {
      "id": "0269cfba-ecd4-43bf-bd50-29e9523bd658",
      "script_node_id": "58e88ad7-1413-487d-b75e-c4dc3cc6e9e4",
      "locale": "ko-KR",
      "segment_index": 199,
      "content_hash": "cba8a4d2cae6d8854968524ad67f6d2012439c01f6c82ee44e35500253e3508b",
      "duration_ms": 3672,
      "production_status": "ready"
    },
    {
      "id": "ce3c8614-5233-4742-9c33-6c35db5f6acf",
      "script_node_id": "58e88ad7-1413-487d-b75e-c4dc3cc6e9e4",
      "locale": "zh-CN",
      "segment_index": 0,
      "content_hash": "39fa2084da4378c796163ba55ff08f9cb1e19938365f2e16873a1f3ef1c24980",
      "duration_ms": 15456,
      "production_status": "ready"
    },
    {
      "id": "b3498abc-89ff-4a3e-aed3-4db38d237a6c",
      "script_node_id": "58e88ad7-1413-487d-b75e-c4dc3cc6e9e4",
      "locale": "zh-CN",
      "segment_index": 197,
      "content_hash": "5ebbae124f96aac6197079ea47f5a5e827ede14640c7ac90f3e1fbfe80c4b295",
      "duration_ms": 4488,
      "production_status": "ready"
    },
    {
      "id": "764d1a44-a97f-47a6-9dad-ba7ca1f7c9ae",
      "script_node_id": "58e88ad7-1413-487d-b75e-c4dc3cc6e9e4",
      "locale": "zh-CN",
      "segment_index": 199,
      "content_hash": "b3566acda86a742067f76fa18c3221793e51c3e67d55d9d1942472d3dbde0786",
      "duration_ms": 3384,
      "production_status": "ready"
    },
    {
      "id": "4c85abd4-8174-4594-95e0-8aece9683f60",
      "script_node_id": "21586656-413b-406c-b9cc-452bc63ee09d",
      "locale": "ko-KR",
      "segment_index": 0,
      "content_hash": "43b850792317dcb29d2998e9aba592ab0c75317e69cd48f9c18d75e2301ca970",
      "duration_ms": 7344,
      "production_status": "ready"
    },
    {
      "id": "d4444750-9c2d-4ce4-af88-4e9011b1c893",
      "script_node_id": "21586656-413b-406c-b9cc-452bc63ee09d",
      "locale": "ko-KR",
      "segment_index": 199,
      "content_hash": "cba8a4d2cae6d8854968524ad67f6d2012439c01f6c82ee44e35500253e3508b",
      "duration_ms": 3672,
      "production_status": "ready"
    },
    {
      "id": "fbadcfdc-8e69-41ed-9782-086e12d93d05",
      "script_node_id": "21586656-413b-406c-b9cc-452bc63ee09d",
      "locale": "zh-CN",
      "segment_index": 0,
      "content_hash": "658905d2fb8d809d39f800d8478973cb02c9568d2964fd050c1b2d5561f0bc16",
      "duration_ms": 19032,
      "production_status": "ready"
    },
    {
      "id": "a56bac09-7fd3-4a93-83b3-eccacf5cf820",
      "script_node_id": "21586656-413b-406c-b9cc-452bc63ee09d",
      "locale": "zh-CN",
      "segment_index": 197,
      "content_hash": "f0da85bdb1406271dfbec6292f580e9b37cf410f306224d48092256e0d0d68c1",
      "duration_ms": 4056,
      "production_status": "ready"
    },
    {
      "id": "95a5173c-5674-4da6-ad86-8c3a4b114ab8",
      "script_node_id": "21586656-413b-406c-b9cc-452bc63ee09d",
      "locale": "zh-CN",
      "segment_index": 198,
      "content_hash": "c2ceeea7071545b13eb5b7b177d48fa552edcba176a9e921f37b832daa06fa31",
      "duration_ms": 7896,
      "production_status": "ready"
    },
    {
      "id": "d47641f8-2e64-4103-8fc2-2adbccd428df",
      "script_node_id": "21586656-413b-406c-b9cc-452bc63ee09d",
      "locale": "zh-CN",
      "segment_index": 199,
      "content_hash": "b3566acda86a742067f76fa18c3221793e51c3e67d55d9d1942472d3dbde0786",
      "duration_ms": 3384,
      "production_status": "ready"
    },
    {
      "id": "7ce679fe-8504-4865-a3cb-9203c8bd6df5",
      "script_node_id": "358d3abf-8224-47f3-8c18-29ad3bf81fc0",
      "locale": "ko-KR",
      "segment_index": 0,
      "content_hash": "315f8e63dfff8a0096a05e48d2d3408eb11caaa1f685b118d6c639be2dd95a46",
      "duration_ms": 11736,
      "production_status": "ready"
    },
    {
      "id": "4c231d36-abe7-43be-b683-beaf25c532c0",
      "script_node_id": "358d3abf-8224-47f3-8c18-29ad3bf81fc0",
      "locale": "ko-KR",
      "segment_index": 199,
      "content_hash": "cba8a4d2cae6d8854968524ad67f6d2012439c01f6c82ee44e35500253e3508b",
      "duration_ms": 3672,
      "production_status": "ready"
    },
    {
      "id": "db43b806-68a3-41ab-9941-b9952601b1fe",
      "script_node_id": "358d3abf-8224-47f3-8c18-29ad3bf81fc0",
      "locale": "zh-CN",
      "segment_index": 0,
      "content_hash": "5977fc07d37a4fcd88e2edb0b671124190261419d1c5f678f5ddade5222aef67",
      "duration_ms": 13872,
      "production_status": "ready"
    },
    {
      "id": "38193d74-e0b7-429f-90ce-03d5747ee512",
      "script_node_id": "358d3abf-8224-47f3-8c18-29ad3bf81fc0",
      "locale": "zh-CN",
      "segment_index": 197,
      "content_hash": "652d96814b99d0d73e4dfc043de84e8a9f2d120c2bcc896af3535be44736f113",
      "duration_ms": 3840,
      "production_status": "ready"
    },
    {
      "id": "5a4498e3-ba29-408b-b5ed-e670f077d6fc",
      "script_node_id": "358d3abf-8224-47f3-8c18-29ad3bf81fc0",
      "locale": "zh-CN",
      "segment_index": 198,
      "content_hash": "d17558a7ff69a21ee3a30108f191e7b6bea1ee92676cfd95e3ab2cf4ec537a7f",
      "duration_ms": 3816,
      "production_status": "ready"
    },
    {
      "id": "6873c663-fb5f-4779-9384-8fee0b65641b",
      "script_node_id": "358d3abf-8224-47f3-8c18-29ad3bf81fc0",
      "locale": "zh-CN",
      "segment_index": 199,
      "content_hash": "b3566acda86a742067f76fa18c3221793e51c3e67d55d9d1942472d3dbde0786",
      "duration_ms": 3384,
      "production_status": "ready"
    },
    {
      "id": "f88eff77-9d79-4502-9fa0-d066a0a1db69",
      "script_node_id": "b2a3d319-94d7-41b1-be6c-b6029d6da16a",
      "locale": "ko-KR",
      "segment_index": 0,
      "content_hash": "72fe6a81da8e4e0ea1d7949dd30dea43b1fed40df3d206218b315353e66a98dd",
      "duration_ms": 7104,
      "production_status": "ready"
    },
    {
      "id": "b7e3ef6d-5332-4001-8ecd-7e800e34ed28",
      "script_node_id": "b2a3d319-94d7-41b1-be6c-b6029d6da16a",
      "locale": "ko-KR",
      "segment_index": 199,
      "content_hash": "cba8a4d2cae6d8854968524ad67f6d2012439c01f6c82ee44e35500253e3508b",
      "duration_ms": 3672,
      "production_status": "ready"
    },
    {
      "id": "beaf9d09-f10d-491b-abf2-5c2201fe4edc",
      "script_node_id": "b2a3d319-94d7-41b1-be6c-b6029d6da16a",
      "locale": "zh-CN",
      "segment_index": 0,
      "content_hash": "e33bf88d78a89d927c8232c6e0997eb0ddf6188f773570ffbb7ed36e8276e530",
      "duration_ms": 14376,
      "production_status": "ready"
    },
    {
      "id": "ba1280a3-3e32-4ed3-b2dc-cd57dfbb63a3",
      "script_node_id": "b2a3d319-94d7-41b1-be6c-b6029d6da16a",
      "locale": "zh-CN",
      "segment_index": 199,
      "content_hash": "b3566acda86a742067f76fa18c3221793e51c3e67d55d9d1942472d3dbde0786",
      "duration_ms": 3384,
      "production_status": "ready"
    },
    {
      "id": "3da840df-cc4d-488f-b777-5ffd9bb3c9bb",
      "script_node_id": "ca2957d6-b148-4416-a946-1a8e75b130e4",
      "locale": "ko-KR",
      "segment_index": 0,
      "content_hash": "2b2fdf1b79e6ca5ece7524893e5705b1cd668eee6dcc445459a6e08a4527eaa6",
      "duration_ms": 33384,
      "production_status": "ready"
    },
    {
      "id": "87da82fe-5cbe-4e47-9246-96cddab8bd3f",
      "script_node_id": "ca2957d6-b148-4416-a946-1a8e75b130e4",
      "locale": "ko-KR",
      "segment_index": 199,
      "content_hash": "cba8a4d2cae6d8854968524ad67f6d2012439c01f6c82ee44e35500253e3508b",
      "duration_ms": 3672,
      "production_status": "ready"
    },
    {
      "id": "e5120646-051f-4b0b-bb1f-3f56f175022b",
      "script_node_id": "ca2957d6-b148-4416-a946-1a8e75b130e4",
      "locale": "zh-CN",
      "segment_index": 0,
      "content_hash": "256a6b0982c59a06e63eded9b82dca8cb709241579f1312bac19bd11d62ada24",
      "duration_ms": 15936,
      "production_status": "ready"
    },
    {
      "id": "5010a2fa-dbb2-4700-bc5f-f47d1b665222",
      "script_node_id": "ca2957d6-b148-4416-a946-1a8e75b130e4",
      "locale": "zh-CN",
      "segment_index": 1,
      "content_hash": "2c3de763b4e9987cb93c5b6f1f41d899b59dbb29e9a032f12f03fce519109306",
      "duration_ms": 10920,
      "production_status": "ready"
    },
    {
      "id": "03e9c447-ac05-4f21-a1ee-aed5bc407503",
      "script_node_id": "ca2957d6-b148-4416-a946-1a8e75b130e4",
      "locale": "zh-CN",
      "segment_index": 199,
      "content_hash": "2cbebc832083c828049f9d8b6d1ecec176efdb93dbac50853e9b45f06daee87a",
      "duration_ms": 6984,
      "production_status": "ready"
    },
    {
      "id": "68001d3e-f9a3-441c-8642-321d747ee0ca",
      "script_node_id": "d654205c-e969-48b9-98b4-a658f1c8366e",
      "locale": "ko-KR",
      "segment_index": 0,
      "content_hash": "dc1275443bb5ec9b712d63611e6c7bec43280fd85f0bac4dc8149f792048a4c5",
      "duration_ms": 9648,
      "production_status": "ready"
    },
    {
      "id": "7b805fee-2608-440c-85ee-a460d49bd32b",
      "script_node_id": "d654205c-e969-48b9-98b4-a658f1c8366e",
      "locale": "ko-KR",
      "segment_index": 199,
      "content_hash": "cba8a4d2cae6d8854968524ad67f6d2012439c01f6c82ee44e35500253e3508b",
      "duration_ms": 3672,
      "production_status": "ready"
    },
    {
      "id": "9d0b264c-bbfc-41d8-a782-e7124bbb8c18",
      "script_node_id": "d654205c-e969-48b9-98b4-a658f1c8366e",
      "locale": "zh-CN",
      "segment_index": 0,
      "content_hash": "4e96ee7d97f596fc0f90f752554c4255df6ebff0d8ad6bcd359c78b04dc3e4d8",
      "duration_ms": 4920,
      "production_status": "ready"
    },
    {
      "id": "12ca2db1-edcc-4f0a-8f6a-0246ddc40508",
      "script_node_id": "d654205c-e969-48b9-98b4-a658f1c8366e",
      "locale": "zh-CN",
      "segment_index": 1,
      "content_hash": "2a8b4a4135cc3970475d3b283abd0825cf4d8016a3c9bd9a5c20ed9b34d917e0",
      "duration_ms": 7992,
      "production_status": "ready"
    },
    {
      "id": "27e16d21-1d6a-4ba3-8208-044093d7faa0",
      "script_node_id": "d654205c-e969-48b9-98b4-a658f1c8366e",
      "locale": "zh-CN",
      "segment_index": 197,
      "content_hash": "6ce342687ecf87c630526d3ab93578821047ae4f98c953ed47dfe65d938b982a",
      "duration_ms": 5352,
      "production_status": "ready"
    },
    {
      "id": "c08acc48-65cb-4f14-b1e1-f9c8147ec55a",
      "script_node_id": "d654205c-e969-48b9-98b4-a658f1c8366e",
      "locale": "zh-CN",
      "segment_index": 198,
      "content_hash": "d9da79afda1f43051032e32f61a3f14b30c257a5b4c3450a931f46a339902d25",
      "duration_ms": 3936,
      "production_status": "ready"
    },
    {
      "id": "0aaa0b27-740a-4fc7-8eee-5e5747804a35",
      "script_node_id": "d654205c-e969-48b9-98b4-a658f1c8366e",
      "locale": "zh-CN",
      "segment_index": 199,
      "content_hash": "b3566acda86a742067f76fa18c3221793e51c3e67d55d9d1942472d3dbde0786",
      "duration_ms": 3384,
      "production_status": "ready"
    }
  ]
};
export default source;
