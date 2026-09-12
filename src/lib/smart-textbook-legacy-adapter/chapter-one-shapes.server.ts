import 'server-only';
import { z } from 'zod';
// Frozen FIRST-CHAPTER reader shapes, inspected against live data 2026-09-08.
// Never infer a schema from input at runtime. Unknown fields fail closed.
// Empty strings are meaningful in legacy blackboard/translation fields.
const S = z.string().max(30000).refine(v => !/<script|javascript:|<iframe/i.test(v), 'Executable legacy text');
export const nodeContentSchemas = {
  orientation: z.strictObject({
    "coach": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "completion": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "dialogueGroups": z.array(z.strictObject({
      "id": S,
      "lines": z.array(z.strictObject({
        "ko": S,
        "speaker": S,
        "zh": S,
      })),
      "title": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
    })),
    "lead": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "nextNode": S,
    "targets": z.array(z.strictObject({
      "ko": S,
      "zh": S,
    })),
  }),
  vocabulary: z.strictObject({
    "coach": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "lead": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "nextNode": S,
    "vocabulary": z.array(z.strictObject({
      "collocation": S,
      "ko": S,
      "pos": S,
      "transcription": S,
      "zh": S,
    })),
  }),
  grammar: z.strictObject({
    "coach": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "grammarCards": z.array(z.strictObject({
      "caution": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
      "examples": z.array(z.strictObject({
        "audioId": S,
        "audioStatus": S,
        "ko": S,
        "zh": S,
      })),
      "form": S,
      "function": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
      "rules": z.array(S),
      "source": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
    })),
    "lead": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "nextNode": S,
  }),
  patterns: z.strictObject({
    "coach": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "lead": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "nextNode": S,
    "pattern": S,
    "patternCards": z.array(z.strictObject({
      "examples": z.array(S),
      "form": S,
      "function": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
    })),
    "personalOutput": z.array(S),
    "quickResponse": z.array(S),
    "substitutionGroups": z.array(z.array(S)),
    "substitutions": z.array(S),
  }),
  dialogue: z.strictObject({
    "coach": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "dialogueFlow": z.array(z.strictObject({
      "description": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
      "order": z.number().finite(),
      "title": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
      "words": z.array(S),
    })),
    "dialogueScenes": z.array(z.strictObject({
      "context": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
      "coverage": z.array(S),
      "id": S,
      "lines": z.array(z.strictObject({
        "ko": S,
        "speaker": S,
        "words": z.array(S),
        "zh": S,
      })),
      "title": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
    })),
    "lead": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "nextNode": S,
  }),
  listen_speak: z.strictObject({
    "coach": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "formalAudioStatus": S,
    "lead": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "listenFor": z.array(S),
    "listenSpeakPages": z.array(z.strictObject({
      "description": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
      "id": S,
      "title": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
    })),
    "listeningContext": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "listeningFocus": z.array(z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    })),
    "nextNode": S,
    "outputChecklist": z.array(S),
    "repeatLines": z.array(z.strictObject({
      "audioAssetKey": S,
      "ko": S,
      "zh": S,
    })),
    "repeatTracks": z.array(z.strictObject({
      "id": S,
      "keywords": z.array(S),
      "lines": z.array(z.strictObject({
        "ko": S,
        "zh": S,
      })),
      "title": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
    })),
    "speakingCriteria": z.array(S),
    "speakingFrame": S,
  }),
  read_write: z.strictObject({
    "coach": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "lead": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "nextNode": S,
    "originalExample": S,
    "questions": z.array(S),
    "reading": S,
    "rubric": z.array(S),
    "writingFrame": S,
  }),
  review: z.strictObject({
    "checklist": z.array(z.strictObject({
      "ko": S,
      "zh": S,
    })),
    "coach": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "lead": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "nextNode": S,
    "returnMap": z.array(z.strictObject({
      "node": S,
      "reason": S,
    })),
  }),
} as const;
export const activityConfigSchemas = {
  "orientation-check": z.strictObject({
    "showScore": z.boolean(),
    "shuffle": z.boolean(),
  }),
  "write-profile": z.strictObject({
    "informationChecklist": z.array(S),
    "maxSentences": z.number().finite(),
    "minSentences": z.number().finite(),
    "minimumHangulCharacters": z.number().finite(),
    "minimumInformationKinds": z.number().finite(),
    "minimumPhraseGroups": z.number().finite(),
    "requiredPhraseGroups": z.array(z.array(S)),
    "rubricConfirmation": S,
  }),
  "review-multiple": z.strictObject({
    "selection": S,
  }),
  "vocabulary-check": z.strictObject({
    "items": z.array(z.strictObject({
      "id": S,
      "options": z.array(S),
      "question": S,
    })),
    "presentation": S,
    "shuffle": z.boolean(),
    "shuffleOptions": z.boolean(),
  }),
  "pattern-order": z.strictObject({
    "pathLabels": z.array(z.strictObject({
      "id": S,
      "ko-KR": S,
      "zh-CN": S,
    })),
    "presentation": S,
    "resettable": z.boolean(),
  }),
  "dialogue-fact-check": z.strictObject({
    "shuffle": z.boolean(),
  }),
  "dialogue-response": z.strictObject({
    "shuffle": z.boolean(),
  }),
  "reading-profile": z.strictObject({
    "items": z.array(z.strictObject({
      "id": S,
      "options": z.array(S),
      "question": S,
    })),
    "reading": S,
    "shuffle": z.boolean(),
  }),
  "self-check": z.strictObject({
    "items": z.array(z.strictObject({
      "id": S,
      "label": S,
    })),
    "requiredChecks": z.number().finite(),
    "returnNodes": z.array(z.strictObject({
      "label": S,
      "value": S,
    })),
  }),
  "orientation-jimin-occupation": z.strictObject({
    "showScore": z.boolean(),
    "shuffle": z.boolean(),
  }),
  "orientation-wangming-occupation": z.strictObject({
    "showScore": z.boolean(),
    "shuffle": z.boolean(),
  }),
  "grammar-choice": z.strictObject({
    "items": z.array(z.strictObject({
      "group": S,
      "id": S,
      "options": z.array(S),
      "question": S,
    })),
    "practiceKind": S,
    "shuffle": z.boolean(),
    "shuffleOptions": z.boolean(),
  }),
  "grammar-judgment": z.strictObject({
    "items": z.array(z.strictObject({
      "group": S,
      "id": S,
      "options": z.array(S),
      "question": S,
    })),
    "practiceKind": S,
    "shuffle": z.boolean(),
    "shuffleOptions": z.boolean(),
  }),
  "grammar-fill": z.strictObject({
    "items": z.array(z.strictObject({
      "group": S,
      "groupKo": S,
      "id": S,
      "label": S,
      "placeholder": S,
    })),
    "normalize": S,
    "practiceKind": S,
  }),
  "listening-identity": z.strictObject({
    "audioEdition": S,
    "audioId": S,
    "audioStatus": S,
    "audioVoice": S,
    "expectedDurationSeconds": z.number().finite(),
    "items": z.array(z.strictObject({
      "group": S,
      "id": S,
      "options": z.array(S),
      "question": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
    })),
    "normalReplayLimit": z.number().finite(),
    "pageCount": z.number().finite(),
    "scriptRevision": S,
    "shuffleOptions": z.boolean(),
    "slowReplayLimit": z.number().finite(),
    "trackMode": S,
    "tracks": z.array(z.strictObject({
      "audioId": S,
      "id": S,
      "label": S,
      "status": S,
    })),
  }),
  "pattern-choice": z.strictObject({
    "conversation": z.strictObject({
      "instruction": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
      "steps": z.array(z.strictObject({
        "afterMs": z.number().finite(),
        "audioAssetKey": S,
        "choiceIndex": z.number().finite().optional(),
        "id": S,
        "kind": S,
        "line": S.optional(),
        "options": z.array(S).optional(),
        "prompt": z.strictObject({
          "ko-KR": S,
          "zh-CN": S,
        }).optional(),
        "side": S,
        "speaker": z.strictObject({
          "ko-KR": S,
          "zh-CN": S,
        }),
        "typingSpeedMs": z.number().finite(),
      })),
      "title": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
    }),
    "practiceKind": S,
  }),
  "pattern-compose": z.strictObject({
    "composition": z.strictObject({
      "instruction": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
      "steps": z.array(z.strictObject({
        "hint": z.strictObject({
          "ko-KR": S,
          "zh-CN": S,
        }),
        "id": S,
        "prompt": S,
        "speaker": z.strictObject({
          "ko-KR": S,
          "zh-CN": S,
        }),
        "task": z.strictObject({
          "ko-KR": S,
          "zh-CN": S,
        }),
        "tokens": z.array(S),
      })),
      "title": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
    }),
  }),
  "dialogue-roleplay": z.strictObject({
    "completionRequirement": S,
    "formative": z.boolean(),
    "practiceKind": S,
    "pronunciationScore": z.boolean(),
    "scoreLabel": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "scoreRequired": z.boolean(),
    "storage": S,
  }),
  "speaking-introduction": z.strictObject({
    "criteria": z.array(S),
    "enforceCompletionRequirements": z.boolean(),
    "maximumSeconds": z.number().finite(),
    "minimumOutlineItems": z.number().finite(),
    "minimumSeconds": z.number().finite(),
    "minimumTurns": z.number().finite(),
    "outlineItems": z.array(z.strictObject({
      "choices": z.array(S),
      "id": S,
      "label": z.strictObject({
        "ko-KR": S,
        "zh-CN": S,
      }),
    })),
    "presentation": S,
    "pronunciationScore": z.boolean(),
    "referenceText": S,
    "requiredCriteria": z.number().finite(),
  }),
} as const;
export const teacherConfigurationSchema = z.strictObject({
  "bufferLine": z.strictObject({
    "ko-KR": S,
    "zh-CN": S,
  }).optional(),
  "bufferPresetId": S.optional(),
  "continueLabel": z.strictObject({
    "ko-KR": S,
    "zh-CN": S,
  }).optional(),
  "display": z.strictObject({
    "items": z.strictObject({
      "ko-KR": z.array(S),
      "zh-CN": z.array(S),
    }).optional(),
    "kind": S.optional(),
    "korean": S.optional(),
    "mode": S.optional(),
    "placement": z.strictObject({
      "scale": z.number().finite(),
      "x": z.number().finite(),
      "y": z.number().finite(),
    }),
    "slides": z.array(z.strictObject({
      "background": S,
      "elements": z.array(z.strictObject({
        "align": S,
        "content": S,
        "fontSize": z.number().finite(),
        "fontWeight": z.number().finite(),
        "height": z.number().finite(),
        "id": S,
        "tone": S,
        "translation": S,
        "type": S,
        "width": z.number().finite(),
        "x": z.number().finite(),
        "y": z.number().finite(),
      })),
      "id": S,
      "name": S,
      "segmentIndex": z.number().finite(),
    })).optional(),
    "title": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }).optional(),
    "translation": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }).optional(),
  }),
  "example": z.strictObject({
    "zh-CN": S,
  }).optional(),
  "hint": z.strictObject({
    "zh-CN": S,
  }).optional(),
  "scriptPerformances": z.array(z.strictObject({
    "autoContinueToNext": z.boolean(),
    "characterScale": z.number().finite(),
    "characterX": z.number().finite(),
    "characterY": z.number().finite(),
    "dialogueX": z.number().finite(),
    "dialogueY": z.number().finite(),
    "learningLayout": S,
    "narrowCharacterScale": z.number().finite(),
    "narrowCharacterX": z.number().finite(),
    "narrowCharacterY": z.number().finite(),
    "pose": S,
    "splitCharacterScale": z.number().finite(),
    "splitCharacterX": z.number().finite(),
    "splitCharacterY": z.number().finite(),
    "splitDialogueX": z.number().finite(),
    "splitDialogueY": z.number().finite(),
    "voiceEnabled": z.boolean(),
    "voiceLanguage": S,
    "voiceRate": z.number().finite(),
  })),
  "studentTask": z.strictObject({
    "eventType": S,
    "instruction": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "kind": S,
    "required": z.boolean(),
    "targetKey": S,
    "targetLabel": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
  }).optional(),
  "terminal": z.boolean().optional(),
  "virtualCharacter": z.strictObject({
    "kind": S,
    "position": S,
  }),
  "visualCue": z.strictObject({
    "durationMs": z.number().finite(),
    "effect": S,
    "pulseCount": z.number().finite(),
    "targetKey": S,
  }).optional(),
});
export const mediaMetadataSchema = z.strictObject({
  "aspectRatio": S.optional(),
  "audioEdition": S.optional(),
  "audioId": S.optional(),
  "channels": z.number().finite().optional(),
  "conversationStepId": S.optional(),
  "density": S.optional(),
  "detailEnhanced": z.boolean().optional(),
  "durationSeconds": z.number().finite().optional(),
  "encoding": S.optional(),
  "format": S.optional(),
  "generatedBy": S.optional(),
  "goalKo": S.optional(),
  "goalZh": S.optional(),
  "height": z.number().finite().optional(),
  "id": S.optional(),
  "kind": S.optional(),
  "lineIndex": z.number().finite().optional(),
  "locale": S.optional(),
  "mimeType": S.optional(),
  "presentation": S.optional(),
  "proportionalScale": z.boolean().optional(),
  "replaceableByHumanRecording": z.boolean().optional(),
  "sampleRateHz": z.number().finite().optional(),
  "script": S.optional(),
  "scriptRevision": S.optional(),
  "scriptVisibility": S.optional(),
  "sourceHeight": z.number().finite().optional(),
  "sourceStatus": S.optional(),
  "sourceWidth": z.number().finite().optional(),
  "speaker": z.union([S, z.strictObject({
    "ko-KR": S,
    "zh-CN": S,
  })]).optional(),
  "speakingRate": z.number().finite().optional(),
  "storage": S.optional(),
  "targetDurationSeconds": z.number().finite().optional(),
  "transcriptKo": S.optional(),
  "version": z.number().finite().optional(),
  "vocabularyCoverage": z.array(S).optional(),
  "voice": S.optional(),
  "voiceProfile": S.optional(),
  "width": z.number().finite().optional(),
  "wordHotspots": z.strictObject({
    "만나다": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
    "반갑다": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
    "사람": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
    "선생님": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
    "소개하다": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
    "이름": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
    "인사하다": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
    "저": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
    "처음": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
    "친구": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
    "학생": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
    "한국어": z.strictObject({
      "left": z.number().finite(),
      "top": z.number().finite(),
    }),
  }).optional(),
});
export const sectionSchemas = {
  "lead": z.strictObject({
    "ko-KR": S,
    "zh-CN": S,
  }),
  "coach": z.strictObject({
    "ko-KR": S,
    "zh-CN": S,
  }),
  "pattern": S,
  "nextNode": S,
  "patternCards": z.array(z.strictObject({
    "examples": z.array(S),
    "form": S,
    "function": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
  })),
  "quickResponse": z.array(S),
  "substitutions": z.array(S),
  "personalOutput": z.array(S),
  "substitutionGroups": z.array(z.array(S)),
  "grammarCards": z.array(z.strictObject({
    "caution": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "examples": z.array(z.strictObject({
      "audioId": S,
      "audioStatus": S,
      "ko": S,
      "zh": S,
    })),
    "form": S,
    "function": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "rules": z.array(S),
    "source": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
  })),
  "vocabulary": z.array(z.strictObject({
    "collocation": S,
    "ko": S,
    "pos": S,
    "transcription": S,
    "zh": S,
  })),
  "dialogueFlow": z.array(z.strictObject({
    "description": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "order": z.number().finite(),
    "title": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "words": z.array(S),
  })),
  "dialogueScenes": z.array(z.strictObject({
    "context": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "coverage": z.array(S),
    "id": S,
    "lines": z.array(z.strictObject({
      "ko": S,
      "speaker": S,
      "words": z.array(S),
      "zh": S,
    })),
    "title": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
  })),
  "listenFor": z.array(S),
  "repeatLines": z.array(z.strictObject({
    "audioAssetKey": S,
    "ko": S,
    "zh": S,
  })),
  "repeatTracks": z.array(z.strictObject({
    "id": S,
    "keywords": z.array(S),
    "lines": z.array(z.strictObject({
      "ko": S,
      "zh": S,
    })),
    "title": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
  })),
  "speakingFrame": S,
  "listeningFocus": z.array(z.strictObject({
    "ko-KR": S,
    "zh-CN": S,
  })),
  "outputChecklist": z.array(S),
  "listenSpeakPages": z.array(z.strictObject({
    "description": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
    "id": S,
    "title": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
  })),
  "listeningContext": z.strictObject({
    "ko-KR": S,
    "zh-CN": S,
  }),
  "speakingCriteria": z.array(S),
  "formalAudioStatus": S,
  "rubric": z.array(S),
  "reading": S,
  "questions": z.array(S),
  "writingFrame": S,
  "originalExample": S,
  "checklist": z.array(z.strictObject({
    "ko": S,
    "zh": S,
  })),
  "returnMap": z.array(z.strictObject({
    "node": S,
    "reason": S,
  })),
  "targets": z.array(z.strictObject({
    "ko": S,
    "zh": S,
  })),
  "completion": z.strictObject({
    "ko-KR": S,
    "zh-CN": S,
  }),
  "dialogueGroups": z.array(z.strictObject({
    "id": S,
    "lines": z.array(z.strictObject({
      "ko": S,
      "speaker": S,
      "zh": S,
    })),
    "title": z.strictObject({
      "ko-KR": S,
      "zh-CN": S,
    }),
  })),
} as const;
