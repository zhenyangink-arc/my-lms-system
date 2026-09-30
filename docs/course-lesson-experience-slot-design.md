# 课程与课时界面插槽设计

> 状态：设计稿，未实施（2026-09-30，分支 `feat/subject-slots`）
> 关联：[共享平台 + 学科模块架构](./shared-platform-subject-modules-architecture.md) 第 6 节遗留项“2D 课程页判断”与“课时页韩语分支”。

## 1. 要解决的问题

学科清单（contractVersion 1）已经解决了“按哪个应用查数据、显示哪些入口”。但课程目录、分类页、课程页和课时页里，还有一类判断在决定“用哪套界面”：

| 页面 | 现在的判断 | 实际作用 |
|---|---|---|
| 课程目录 `courses/page-content.tsx` | `studentAppSlug === "korean"` | 韩语走 `KoreanDirectCourseCatalog`，并额外读取章节、章节测试、电子书进度 |
| 分类页 `[categorySlug]/page-content.tsx` | `parentCategory.slug === "korean" \|\| "service"` | 韩语和留学服务走 `KoreanLearningCenter`（留学用 `variant="service"`），韩语默认选中“韩语初级” |
| 二级分类页、课程页 | 同上 | 韩语和留学服务直接跳回学习中心；“韩语初级”有专门判断 |
| 课时页 `[lessonSlug]/page-content.tsx` | `isHangulIntroduction`、`isKoreanLevelOne`（按分类 / 二级分类 / 课程 / 课时 slug 组合识别） | 字母入门走 `HangulInteractiveBook`，韩语一级走 `SmartTextbookShell`；两者都加载金老师插槽 |

这些判断把**韩语的界面组件和韩语的识别规则**留在了平台页面里。只把 `=== "korean"` 换成清单开关，组件和规则仍然在共享页面中，属于表面修改。

## 2. 现状结构（课时页）

课时页可以清楚地分成三层：

1. **平台通用**：读取分类、课程、课时；按 `course-unlocks` 判断解锁；判断准入（`hasLessonAccess`）；签发 R2 视频地址；记录学习进度；显示直播入口。
2. **学科界面分支**：字母入门 → `HangulInteractiveBook`（加载 `loadStudentTeachingLessonSlot`）；韩语一级 → `SmartTextbookShell` → `KoreanLevelOneSmartTextbook`（加载 `loadStudentTeachingSlots`，并引用金老师课堂组件：教师视频、黑板、课堂导演）。
3. **通用课时界面**：文字 / 视频内容、提问、资料、进度卡、辅助面板。

混在第 1 层里的韩语细节：`korean_course` 完整访问判断、字母入门章节解锁数量（`HANGUL_TEST_SEQUENCE`）、电子书进度。

留学服务不是学科，但它和韩语共用 `KoreanLearningCenter`（`variant="service"`）。这个组件名义上是韩语的，实际上承担了“学习中心”布局。

新版智能教材运行时（`smart-textbook-runtime`）目前只挂在管理端的 `runtime-v1-preview` 页面，不在学生课时页中。

## 3. 设计原则

1. **平台管数据、规则和准入；学科管界面。**读取课程数据、解锁判断、准入判断、进度记录、视频签名都留在平台，学科渲染器只接收平台准备好的上下文。
2. **应用由路由决定，不由分类 slug 猜。**页面已经知道自己在哪个应用下（第 2 步起由路由传入），不再用 `parentCategory.slug === "korean"` 推断。
3. **学科只通过注册表接入。**平台页面不直接引用任何学科的组件，只问注册表“这个学科有没有自己的界面”。
4. **没有注册就用通用界面。**英语、数学起步时不需要写任何渲染器，自动使用现有的通用目录和通用课时界面。
5. **学科 AI 由学科负责加载。**金老师插槽属于韩语学科能力，由韩语的课时渲染器加载；平台课时页不再直接引用 `teaching-agent`。
6. **先搬接口，不改组件。**第一步只让现有韩语组件“挂到插槽上”，组件本身和文件位置不动，行为必须逐项一致。

## 4. 契约设计（contractVersion 2 草案）

### 4.1 为什么不放进现有清单

现有清单是纯数据，客户端侧边栏也在读取它。界面渲染器是 React 服务端组件，还会引用服务端数据和学科 AI，不能进入客户端包。因此新增一个**只在服务端使用**的注册表，与纯数据清单分开。

### 4.2 文件布局

```
src/features/subjects/
├── contracts.ts                  清单类型（现有，纯数据）
├── experience-contracts.ts       界面插槽类型（新增，纯类型）
├── experience-registry.server.ts 服务端注册表（新增，import "server-only"）
└── korean/
    └── experience.server.tsx     韩语界面插槽实现（新增，适配现有组件）
```

注册表按 Next.js 要求为每个学科写出字面量路径的按需加载，不能用变量拼接路径：

```ts
// experience-registry.server.ts（示意）
import "server-only";
import type { SubjectExperience } from "./experience-contracts.ts";
import type { SubjectSlug } from "./contracts.ts";

const loaders: Partial<Record<SubjectSlug, () => Promise<SubjectExperience>>> = {
  korean: () => import("./korean/experience.server").then((m) => m.koreanExperience),
  // english、math 暂不注册：使用平台通用界面
};

export async function getSubjectExperience(slug: string) {
  const load = loaders[slug as SubjectSlug];
  return load ? await load() : null;
}
```

### 4.3 插槽类型

```ts
// experience-contracts.ts（示意）
export type LessonExperienceContext = {
  appSlug: SubjectSlug;
  space: string;
  courseBasePath: string;
  category: { slug: string; title: string };
  subcategory: { slug: string; title: string };
  course: { id: string; slug: string; title: string };
  lesson: { id: string; slug: string; title: string; lessonType: string; isFreePreview: boolean };
  selectedChapterSlug: string | null;
  viewer: { userId: string; tenantId: string | null; role: string; isPlatformAudit: boolean };
  access: { hasLessonAccess: boolean; unlocked: boolean };
  progress: { status: string; percent: number } | null;
  // 平台已准备好的共享 UI 片段，学科界面可以复用
  shared: { liveClassBanner: ReactNode };
};

export type SubjectExperience = {
  /** 应用课程首页；未提供时使用平台通用目录 */
  CourseCatalog?: (props: { space: string; appSlug: SubjectSlug }) => Promise<ReactNode>;
  /** 一级分类页；未提供时使用平台通用分类页 */
  CategoryHome?: (props: CategoryExperienceContext) => Promise<ReactNode>;
  /** 由学科判断某节课是否使用专属界面；返回 null 表示使用平台通用课时界面 */
  resolveLessonExperience?: (ctx: LessonExperienceContext) => string | null;
  /** 专属课时界面，键与 resolveLessonExperience 的返回值对应 */
  lessonExperiences?: Record<string, (ctx: LessonExperienceContext) => Promise<ReactNode>>;
};
```

说明：

- `resolveLessonExperience` 是纯函数，便于单元测试逐项对照现有识别规则。
- 渲染器是异步服务端组件，可以在内部加载学科自己的数据（例如韩语电子书进度、金老师插槽）。
- 传给客户端组件的数据仍须可序列化，与现有写法一致。
- `CategoryExperienceContext` 与课时上下文同理，包含分类、课程列表、进度等平台已读取的数据。

### 4.4 平台页面的新流程

```
课时页（平台）
  1. 读取分类 / 课程 / 课时（现有逻辑）
  2. 判断解锁与准入（现有逻辑；准入改造见第 6 节）
  3. 签发视频、记录进度（现有逻辑）
  4. experience = await getSubjectExperience(appSlug)
  5. key = experience?.resolveLessonExperience?.(ctx)
  6. key 存在 → 渲染学科界面 experience.lessonExperiences[key](ctx)
     否则   → 渲染平台通用课时界面 StandardLessonView
```

课程目录和分类页同理：学科提供了 `CourseCatalog` / `CategoryHome` 就用学科的，否则用通用界面。

## 5. 韩语如何接入（行为等价）

| 现有逻辑 | 接入后 |
|---|---|
| `isHangulIntroduction`（korean / korean-basic / korean-beginner / hangul-introduction） | 韩语 `resolveLessonExperience` 返回 `"hangul-book"` |
| `isKoreanLevelOne`（韩语一级课程识别） | 返回 `"smart-textbook"` |
| 其他韩语课时 | 返回 `null`，走平台通用界面 |
| `HangulInteractiveBook` + `loadStudentTeachingLessonSlot` | `lessonExperiences["hangul-book"]` 中原样调用 |
| `SmartTextbookShell` + `loadStudentTeachingSlots` | `lessonExperiences["smart-textbook"]` 中原样调用 |
| `KoreanDirectCourseCatalog` | 韩语 `CourseCatalog` |
| `KoreanLearningCenter`（韩语） | 韩语 `CategoryHome` |
| 字母入门章节解锁数量、电子书进度 | 移入韩语渲染器内部计算 |

识别规则暂时仍按 slug 组合，只是从平台页面搬进韩语模块；是否改为数据字段（例如课时上的界面类型字段）属于数据库改动，另行决定。

## 6. 与准入改造的关系

`hasLessonAccess` 目前是：平台巡检 / 非学生 / `korean_course`（仅韩语分类） / 免费试看。插槽本身不改变准入，但平台层应把“完整课程访问”改为按应用判断，否则英语学生只能看试看课时。建议的平台接口：

```ts
canAccessFullAppCourse({ appSlug, role, tier }): boolean
```

其实现取决于会员决定（沿用 vip2/vip3，或使用 `student_app_enrollments.access_tier`），并需要同步修改数据库中 4 个调用 `student_feature_allowed('korean_course')` 的函数。这部分放在数据库改动批次，与插槽实施分开。

## 7. 留学服务的学习中心（已决定：方案 A，2026-09-30）

留学服务不是学科，却复用 `KoreanLearningCenter`（`variant="service"`）。决定把学习中心布局抽成平台组件，留学服务直接使用平台布局，韩语在其上叠加专属内容。

`KoreanLearningCenter.tsx`（1,375 行）核对结果：主体是通用的学习中心布局——课程与课时列表、章节进度、推荐下一节课、解锁状态（依赖 `course-unlocks`、`course-labels`）。韩语专属只有三处：

| 韩语专属部分 | 抽出后的做法 |
|---|---|
| `getKoreanBeginnerLesson` 替换“韩语初级”课时显示名 | 平台布局接收可选的 `lessonTitle(lesson)`，韩语传入该映射 |
| 字母入门课时的专用入口 `HangulLessonLaunchLink` | 平台布局接收可选的 `renderLessonLaunch(lesson, href)`，韩语传入 |
| `isService` 切换的配色与文案 | 改为 `accent` 与文案参数，由调用方（韩语 `CategoryHome` / 留学服务路由）提供 |

实施后：

- 平台组件 `LearningCenterLayout`（放在平台课程功能目录，不属于任何学科）；
- 韩语 `CategoryHome` = `LearningCenterLayout` + 韩语三项定制；
- 留学服务分类页直接使用 `LearningCenterLayout`，不再引用韩语组件；
- 验证：韩语分类页、留学服务分类页改造前后浏览器截图对照，逐项核对推荐课时、进度与解锁状态。

该文件不在解释功能链路上，属于阶段 2。

## 8. 与 Codex 线的约束

- 课时页是金老师“解释”功能的宿主页面；`KoreanLevelOneSmartTextbook.tsx` 引用金老师课堂组件；课时页、`KoreanLevelOneSmartTextbook.tsx`、`HangulInteractiveBook.tsx` 都是 Codex 线近期修改过的文件。
- 课时插槽实施后，解释功能的引用链会从“课时页 → teaching-agent”变为“课时页 → 学科注册表 → 韩语界面插槽 → teaching-agent”。这会改变解释功能的源码闭包，影响其“无未审查漂移”的资格核对。
- 因此：**课时页部分必须等 Codex 线到达稳定点，并与其发布负责人确认后再实施。**
- 课程目录与分类页不在解释功能的链路上，可以更早实施（见第 9 节阶段 2）。

## 9. 实施阶段

| 阶段 | 内容 | 前置条件 | 验证 |
|---|---|---|---|
| 1 | 新增 `experience-contracts.ts`、`experience-registry.server.ts`、韩语 `experience.server.tsx`（只含识别函数，暂不渲染）；为识别函数写逐项对照测试 | 无，可在 Codex 暂停期间做 | 单元测试：现有识别规则的每种组合与新函数结果一致 |
| 2 | 课程目录、分类页接入插槽；抽出平台 `LearningCenterLayout`（第 7 节） | 本机库同步（需浏览器对照） | 相关测试 + 韩语、留学服务目录与分类页浏览器对照 |
| 3 | 课时页接入插槽：抽出 `StandardLessonView`，韩语两个专属界面挂到插槽；平台课时页不再引用 `teaching-agent` | Codex 线稳定并确认 | 行为等价测试 + 字母入门、韩语一级、普通课时三类浏览器对照 + 解释功能冒烟 |
| 4 | 准入按应用判断（第 6 节） | 会员决定 + 数据库批次 | 权限正反例测试 |
| 5 | 韩语组件文件实际迁入 `subjects/korean`（第 5 步） | 阶段 3 完成 | 每批回归 |

阶段 1 只新增文件、不改现有页面，可以在当前暂停期间安全进行；阶段 2 修改课程目录和分类页，不涉及解释链路，但需要浏览器验证，因此实际上也要等本机库同步。

## 10. 对英语、数学的影响

- **英语**：起步不注册任何界面，自动使用通用目录、通用分类页和通用课时界面（第 3 步骨架已接好路由）。以后需要“阅读课 / 听力课”等专属界面时，再注册 `lessonExperiences`。
- **数学**：计划注册一个“仿真课时”界面，内部使用平台层的外部互动内容接入（EduMath iframe 宿主、Launch Token、事件入库）；数学判题不在界面插槽内，属于题型与判题器插槽，另行设计。

## 11. 测试策略

- **契约测试**：注册表只能在服务端引用；每个注册的学科都实现了 `resolveLessonExperience` 返回值对应的渲染器；未注册学科返回 `null`。
- **行为等价测试**：韩语识别函数对现有所有 slug 组合给出与原判断相同的结果。
- **边界测试**（阶段 3 起）：平台课时页不再直接引用 `teaching-agent`、`HangulInteractiveBook`、`SmartTextbookShell`；平台课程页不再出现 `slug === "korean"`。
- **浏览器对照**：韩语字母入门、韩语一级、普通韩语课时、留学课程、英语课程各一例，改造前后截图对比。

## 12. 待决定事项

1. ~~留学服务学习中心按 A 还是 B 处理~~：已决定 A（第 7 节）。
2. 课时专属界面的识别，长期是否改为数据字段（需要数据库改动）。
3. 阶段 1 是否现在就做（只新增文件和测试，不改页面）。
4. 课时页阶段的时间点，需要与 Codex 线发布负责人协调。
