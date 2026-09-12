import 'server-only';
// Frozen reader profile from smart-textbook-skeleton.ts and chapterOneKnowledgeMap.
// Not a new authoring schema; other chapters are explicitly out of scope.
export const CHAPTER_ID = "cda24fb8-c93b-4a19-9577-4418350ff708";
export const ADAPTER_REVISION = 'chapter-one-adapter.1';
export const profile = {
  "orientation": {
    "moduleId": "42665398-c41e-4db8-9f0e-9626e126cba8",
    "nodeId": "9fe730cd-a102-496e-adc5-9973b697af68",
    "title": {
      "zh-CN": "初次见面交流目标",
      "ko-KR": "첫 만남의 대화 목표"
    },
    "pages": [
      "scene",
      "diagnosis"
    ],
    "pageLabels": [
      {
        "zh-CN": "情景与表达",
        "ko-KR": "장면과 표현"
      },
      {
        "zh-CN": "情景诊断",
        "ko-KR": "장면 진단"
      }
    ],
    "contentSlots": [
      "lead",
      "targets",
      "dialogueGroups"
    ],
    "activitySlots": [
      "diagnostic"
    ],
    "activities": [
      {
        "id": "aafa6ccc-4d4a-4dba-9315-2f30381e8a13",
        "key": "orientation-check",
        "type": "single_choice"
      },
      {
        "id": "6c8f70d4-a9be-4d58-b431-fa966b60f463",
        "key": "orientation-jimin-occupation",
        "type": "single_choice"
      },
      {
        "id": "cb3f6d75-4a6a-4610-84dc-7d19db6ef3a5",
        "key": "orientation-wangming-occupation",
        "type": "single_choice"
      }
    ]
  },
  "vocabulary": {
    "moduleId": "65646324-f988-4268-bc9b-4704921e57d0",
    "nodeId": "3d2218c7-33ed-46fb-9a25-dc4bfbbd2b3c",
    "title": {
      "zh-CN": "问候与人物身份",
      "ko-KR": "인사와 인물의 신분"
    },
    "pages": [
      "scene_and_words",
      "vocabulary_practice"
    ],
    "pageLabels": [
      {
        "zh-CN": "情景词汇",
        "ko-KR": "장면 어휘"
      },
      {
        "zh-CN": "词汇练习",
        "ko-KR": "어휘 연습"
      }
    ],
    "contentSlots": [
      "lead",
      "vocabulary",
      "dialogueGroups"
    ],
    "activitySlots": [
      "vocabulary_check"
    ],
    "activities": [
      {
        "id": "8a7f51e8-e982-47da-ae40-ea7698986ec4",
        "key": "vocabulary-check",
        "type": "single_choice"
      }
    ]
  },
  "grammar": {
    "moduleId": "ddb8b68c-5eca-478c-aa97-26ef7f7a24ab",
    "nodeId": "e5078937-9a9d-4fb7-b92f-a6fe54fa7633",
    "title": {
      "zh-CN": "主题助词与判断句",
      "ko-KR": "주제 조사와 서술격 표현"
    },
    "pages": [
      "grammar_explanation",
      "grammar_practice"
    ],
    "pageLabels": [
      {
        "zh-CN": "语法理解",
        "ko-KR": "문법 이해"
      },
      {
        "zh-CN": "语法练习",
        "ko-KR": "문법 연습"
      }
    ],
    "contentSlots": [
      "lead",
      "rules",
      "grammarCards",
      "contrast"
    ],
    "activitySlots": [
      "grammar_practice"
    ],
    "activities": [
      {
        "id": "3ad2226d-6490-4f6d-8743-2d1d9989d3e9",
        "key": "grammar-choice",
        "type": "single_choice"
      },
      {
        "id": "70ac0f5d-917d-48e1-a00d-b0ed3bfa8509",
        "key": "grammar-judgment",
        "type": "single_choice"
      },
      {
        "id": "d2329ff4-72c2-4feb-bf62-3301ce769567",
        "key": "grammar-fill",
        "type": "fill_blank"
      }
    ]
  },
  "patterns": {
    "moduleId": "016124f4-00b8-4ca5-9426-b92a0417a2a6",
    "nodeId": "a751eb5a-69a9-474b-a7eb-1e9b4e5ca17e",
    "title": {
      "zh-CN": "姓名与身份介绍",
      "ko-KR": "이름과 신분 소개"
    },
    "pages": [
      "pattern_library",
      "guided_substitution",
      "combined_output"
    ],
    "pageLabels": [
      {
        "zh-CN": "句型库",
        "ko-KR": "문형 모음"
      },
      {
        "zh-CN": "替换操练",
        "ko-KR": "대치 연습"
      },
      {
        "zh-CN": "组合输出",
        "ko-KR": "조합과 출력"
      }
    ],
    "contentSlots": [
      "pattern",
      "patternCards",
      "substitutionGroups",
      "quickResponse",
      "personalOutput"
    ],
    "activitySlots": [
      "guided_choice",
      "ordering",
      "composition"
    ],
    "activities": [
      {
        "id": "08056544-a7d0-41c0-998c-1a2a39978125",
        "key": "pattern-order",
        "type": "ordering"
      },
      {
        "id": "5b9bf18c-bd37-4df2-9f06-2599fc695e1c",
        "key": "pattern-choice",
        "type": "single_choice"
      },
      {
        "id": "897f6b9a-e955-401d-8127-46a5adfc708a",
        "key": "pattern-compose",
        "type": "fill_blank"
      }
    ]
  },
  "dialogue": {
    "moduleId": "acc3107f-7255-4d65-860b-0968491f293a",
    "nodeId": "0b1f94b2-8979-43bb-95bb-bf129bbb542b",
    "title": {
      "zh-CN": "初次见面对话结构",
      "ko-KR": "첫 만남의 대화 구조"
    },
    "pages": [
      "dialogue_guide",
      "scene_dialogue",
      "comprehension",
      "roleplay"
    ],
    "pageLabels": [
      {
        "zh-CN": "对话说明",
        "ko-KR": "대화 안내"
      },
      {
        "zh-CN": "场景切换",
        "ko-KR": "장면 대화"
      },
      {
        "zh-CN": "理解与回应",
        "ko-KR": "이해와 응답"
      },
      {
        "zh-CN": "角色实战",
        "ko-KR": "역할 실전"
      }
    ],
    "contentSlots": [
      "lead",
      "dialogueScenes",
      "dialogueFlow"
    ],
    "activitySlots": [
      "fact_check",
      "response",
      "roleplay"
    ],
    "activities": [
      {
        "id": "f4944f6f-cfcc-403c-a1d8-acea7ef2151f",
        "key": "dialogue-fact-check",
        "type": "single_choice"
      },
      {
        "id": "a4e7825b-3e22-41f6-9417-8f035f0b7fe5",
        "key": "dialogue-response",
        "type": "single_choice"
      },
      {
        "id": "0b1e3713-dfa7-4c89-8504-ae1992e2d340",
        "key": "dialogue-roleplay",
        "type": "speaking"
      }
    ]
  },
  "listen_speak": {
    "moduleId": "04226145-7dd7-4a27-a4f2-03ec766f0f1a",
    "nodeId": "67ce4cfc-573b-4071-a2a5-0122274864f1",
    "title": {
      "zh-CN": "听辨与口头表达",
      "ko-KR": "듣기 구별과 말하기"
    },
    "pages": [
      "listening_preparation",
      "listening_comprehension",
      "shadowing",
      "independent_speaking"
    ],
    "pageLabels": [
      {
        "zh-CN": "听前准备",
        "ko-KR": "듣기 준비"
      },
      {
        "zh-CN": "听辨信息",
        "ko-KR": "정보 듣기"
      },
      {
        "zh-CN": "跟读复现",
        "ko-KR": "따라 말하기"
      },
      {
        "zh-CN": "独立表达",
        "ko-KR": "독립 말하기"
      }
    ],
    "contentSlots": [
      "listeningContext",
      "listeningFocus",
      "repeatTracks",
      "repeatLines",
      "outputChecklist"
    ],
    "activitySlots": [
      "listening",
      "speaking"
    ],
    "activities": [
      {
        "id": "6876a867-ae78-4336-9d3a-1745a351b6ee",
        "key": "listening-identity",
        "type": "listening"
      },
      {
        "id": "d52694a4-5337-4971-ab48-32a7c6821ea0",
        "key": "speaking-introduction",
        "type": "speaking"
      }
    ]
  },
  "read_write": {
    "moduleId": "01e528a1-9c86-4dd3-baa6-ee87851ac521",
    "nodeId": "a834273c-7858-4ad1-8587-97007acd90fb",
    "title": {
      "zh-CN": "个人介绍读写",
      "ko-KR": "자기소개 읽기와 쓰기"
    },
    "pages": [
      "reading_source",
      "reading_comprehension",
      "writing_scaffold",
      "independent_writing"
    ],
    "pageLabels": [
      {
        "zh-CN": "阅读资料",
        "ko-KR": "읽기 자료"
      },
      {
        "zh-CN": "信息理解",
        "ko-KR": "정보 이해"
      },
      {
        "zh-CN": "写作搭建",
        "ko-KR": "쓰기 구성"
      },
      {
        "zh-CN": "独立写作",
        "ko-KR": "독립 쓰기"
      }
    ],
    "contentSlots": [
      "lead",
      "reading",
      "questions",
      "writingFrame",
      "rubric",
      "originalExample"
    ],
    "activitySlots": [
      "reading",
      "writing"
    ],
    "completionWeights": [
      50,
      50
    ],
    "activities": [
      {
        "id": "ed75866c-2a53-4538-90ad-e71c2737dfef",
        "key": "write-profile",
        "type": "writing"
      },
      {
        "id": "7ae06811-48ed-49a0-83ad-03d613a16e6b",
        "key": "reading-profile",
        "type": "single_choice"
      }
    ]
  },
  "review": {
    "moduleId": "546b7ae4-142c-47c0-b4f9-04b3d5c02c3d",
    "nodeId": "f0e8db18-ad29-46b3-b9c1-6a0b0717fd51",
    "title": {
      "zh-CN": "独立交流能力",
      "ko-KR": "독립적인 의사소통 능력"
    },
    "pages": [
      "comprehensive_check",
      "can_do_check",
      "review_result"
    ],
    "pageLabels": [
      {
        "zh-CN": "综合自测",
        "ko-KR": "종합 점검"
      },
      {
        "zh-CN": "能力自查",
        "ko-KR": "능력 점검"
      },
      {
        "zh-CN": "复盘结果",
        "ko-KR": "복습 결과"
      }
    ],
    "contentSlots": [
      "lead",
      "checklist",
      "returnMap",
      "coach"
    ],
    "activitySlots": [
      "multiple_choice",
      "self_check"
    ],
    "completionWeights": [
      50,
      50
    ],
    "activities": [
      {
        "id": "30f7ecfa-3ad6-45d1-8373-9bfeb12c220e",
        "key": "review-multiple",
        "type": "multiple_choice"
      },
      {
        "id": "d954746a-9f45-40ce-9c09-f639a7fe03bc",
        "key": "self-check",
        "type": "self_check"
      }
    ]
  }
} as const;
