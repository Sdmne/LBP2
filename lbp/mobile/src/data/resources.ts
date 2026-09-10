import { colors } from "../theme";

// Ported directly from lbp/frontend/src/ui.tsx (RESOURCES_CATEGORIES,
// QUIZ_SECTIONS, QUIZ_QUESTIONS, QUIZ_STRENGTH_COPY, QUIZ_DISCUSS_COPY,
// QUIZ_PROMPTS, computeQuizResults - traced directly from the real file,
// not re-authored) as of Sept 2026. This is real, already-reviewed product
// copy (see the master brief's note that the 26 quiz questions were written
// specifically for this feature and are meant to go live as-is), so it is
// copied verbatim rather than paraphrased.
//
// Deliberately English-only, matching the website's own current state: the
// master brief explicitly notes "Content is English-only for now... this
// section isn't translated to ru/es yet" and the same for the quiz. So,
// unlike every other screen in this app, nothing here goes through
// src/i18n/t() - that would be translating content the real site itself
// doesn't yet translate, which could drift out of sync with it. If/when the
// website adds ru/es copy for this section, port that here the same way.

export type ResourceTool = {
  slug: string;
  title: string;
  description: string;
  tag?: string;
  format?: string;
  downloadUrl?: string;
  downloadName?: string;
  sections?: string[];
  sampleQuestions?: string[];
  disclaimer?: string;
};

export type ResourceCategoryData = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: "coparenting" | "fertility" | "planning";
  disclaimer?: string;
  tools: ResourceTool[];
};

// Per-category tint, shared by ResourcesScreen (category list row icons)
// and ResourceCategoryScreen (per-category header/tool-card accent) - the
// prototype's blue/pink/green icon-wrap colors for these three categories,
// moved here from ResourcesScreen.tsx so both screens read the exact same
// mapping instead of two copies that could drift.
export const CATEGORY_ICON: Record<string, { emoji: string; bg: string; accent: string }> = {
  coparenting: { emoji: "🤝", bg: colors.tint, accent: colors.blue },
  fertility: { emoji: "🧬", bg: colors.tintPink, accent: colors.pink },
  planning: { emoji: "📄", bg: "#e6f7ef", accent: colors.success },
};

export const RESOURCES_CATEGORIES: ResourceCategoryData[] = [
  {
    slug: "co-parenting",
    eyebrow: "Co-parenting",
    title: "Tools for building a family with a co-parent",
    description: "Questions, checklists and templates for finding and getting to know a co-parent.",
    icon: "coparenting",
    tools: [
      {
        slug: "planning-template",
        title: "Co-Parenting Planning Template",
        description: "Talk through parenting, finances, living arrangements and boundaries before you move forward.",
        tag: "Available now",
        format: ".docx · 10 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Co-Parenting-Planning-Template.docx",
        downloadName: "LetsBeParents-Co-Parenting-Planning-Template.docx",
        sections: [
          "Our intentions",
          "The child's home and everyday life",
          "Parenting values and decisions",
          "Pregnancy, conception and medical care",
          "Finances",
          "Communication and boundaries",
          "New partners and changing families",
          "The child's relationship with both parents",
          "Conflict and outside support",
          "If circumstances change",
        ],
        sampleQuestions: [
          "Why are we considering co-parenting?",
          "What would make us decide not to move forward?",
          "What do we each expect from the other person as a parent?",
        ],
        disclaimer:
          "This template is a conversation tool, not a legal document. Completing it does not create or guarantee legal parenthood, parental responsibility, custody or financial rights. Check the law that applies to your family before you rely on anything you agree here.",
      },
      {
        slug: "questions-to-ask",
        title: "Questions to Ask a Potential Co-Parent",
        description: "A practical list of questions covering parenting, money, communication and everyday life.",
        tag: "Available now",
        format: ".docx · 7 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Questions-to-Ask-a-Potential-Co-Parent.docx",
        downloadName: "LetsBeParents-Questions-to-Ask-a-Potential-Co-Parent.docx",
        sections: ["Why parenthood?", "Everyday life", "Parenting values", "Money", "Relationships and boundaries", "Difficult situations", "Before moving forward"],
        sampleQuestions: ["Why do you want to become a parent?", "Why are you considering co-parenting?", "What does being an involved parent mean to you?"],
        disclaimer:
          "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "first-meeting",
        title: "First Meeting With a Potential Co-Parent",
        description: "What to cover and look out for the first time you meet in person.",
        tag: "Available now",
        format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-First-Meeting-With-a-Potential-Co-Parent.docx",
        downloadName: "LetsBeParents-First-Meeting-With-a-Potential-Co-Parent.docx",
        sections: ["Before you meet", "Start with the big picture", "Notice how it feels", "You do not need to decide everything", "After the meeting"],
        sampleQuestions: ["Why are you both considering co-parenting?", "What does parenthood mean to each of you?", "What kind of family are you hoping to build?"],
        disclaimer:
          "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "red-flags-checklist",
        title: "Co-Parenting Red Flags Checklist",
        description: "Signs worth paying attention to before you commit to co-parenting with someone.",
        tag: "Available now",
        format: ".docx · 7 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Co-Parenting-Red-Flags-Checklist.docx",
        downloadName: "LetsBeParents-Co-Parenting-Red-Flags-Checklist.docx",
        sections: ["Pressure", "Boundaries", "Communication", "Money", "Responsibility", "Safety", "If something feels wrong"],
        sampleQuestions: [
          "They push you to make major decisions quickly.",
          "They use age, fertility timing or fear of missing out to pressure you.",
          "They ignore a clear no.",
        ],
        disclaimer:
          "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "compatibility-scorecard",
        title: "Co-Parent Compatibility Scorecard",
        description: "A simple way to note where you align and where you don't, after your first meeting.",
        tag: "Available now",
        format: ".docx · 3 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Co-Parent-Compatibility-Scorecard.docx",
        downloadName: "LetsBeParents-Co-Parent-Compatibility-Scorecard.docx",
        sections: ["Rate 1-5", "Questions to ask yourself", "Before another step"],
        sampleQuestions: ["Communication", "Respect for boundaries", "Parenting values"],
        disclaimer:
          "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "parenting-values-worksheet",
        title: "Parenting Values Worksheet",
        description: "Clarify your own parenting values before comparing them with someone else's.",
        tag: "Available now",
        format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Parenting-Values-Worksheet.docx",
        downloadName: "LetsBeParents-Parenting-Values-Worksheet.docx",
        sections: ["What matters most", "Everyday parenting", "Education and identity", "Money and family", "When we disagree"],
        sampleQuestions: [
          "The three things I most want my child to experience are:",
          "The values I want to model are:",
          "The kind of parent I hope to be is:",
        ],
        disclaimer:
          "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
    ],
  },
  {
    slug: "fertility-donor",
    eyebrow: "Fertility & donor conception",
    title: "Prepare for clinic and donor conversations",
    description: "Practical questions and checklists for talking to clinics and professionals.",
    icon: "fertility",
    disclaimer:
      "These resources are designed to help you prepare for conversations with qualified professionals. They are not medical or legal advice.",
    tools: [
      {
        slug: "fertility-consultation-questions",
        title: "Fertility Consultation Questions",
        description: "Questions worth bringing to your first consultation with a fertility clinic.",
        tag: "Available now",
        format: ".docx · 7 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Fertility-Consultation-Questions.docx",
        downloadName: "LetsBeParents-Fertility-Consultation-Questions.docx",
        sections: ["Understanding your options", "Success and expectations", "Risks and medication", "Cost", "If treatment does not work", "Support", "Donor conception"],
        sampleQuestions: ["Why are you recommending this treatment?", "What alternatives are available?", "What factors in my history affect the recommendation?"],
        disclaimer:
          "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "donor-conception-questions",
        title: "Donor Conception Questions Checklist",
        description: "What to ask and think through before choosing donor conception.",
        tag: "Available now",
        format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Donor-Conception-Questions-Checklist.docx",
        downloadName: "LetsBeParents-Donor-Conception-Questions-Checklist.docx",
        sections: ["About the donor", "Clinic and treatment", "Known donor", "Talking to your child", "Legal and future questions"],
        sampleQuestions: ["What information is available?", "What medical and genetic screening has been completed?", "What information can the future child access?"],
        disclaimer:
          "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "fertility-clinic-checklist",
        title: "Choosing a Fertility Clinic Checklist",
        description: "What to compare when you're deciding between fertility clinics.",
        tag: "Available now",
        format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Choosing-a-Fertility-Clinic-Checklist.docx",
        downloadName: "LetsBeParents-Choosing-a-Fertility-Clinic-Checklist.docx",
        sections: ["Regulation and safety", "Treatment and evidence", "Costs", "Support", "Treatment abroad"],
        sampleQuestions: ["Is the clinic properly regulated?", "What quality and safety standards apply?", "How are laboratories and storage managed?"],
        disclaimer:
          "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
    ],
  },
  {
    slug: "parenthood-planning",
    eyebrow: "Parenthood planning",
    title: "Get ready for the practical side",
    description: "For the practical side of preparing for a child.",
    icon: "planning",
    tools: [
      {
        slug: "financial-planning",
        title: "Financial Planning for Future Parents",
        description: "A worksheet for thinking through the cost of building and raising a family.",
        tag: "Available now",
        format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Financial-Planning-for-Future-Parents.docx",
        downloadName: "LetsBeParents-Financial-Planning-for-Future-Parents.docx",
        sections: ["Before pregnancy or treatment", "Pregnancy and birth", "First year", "Shared expenses", "Financial changes"],
        sampleQuestions: ["Which costs should be shared equally?", "Which costs should be divided by income?", "What happens if income changes?"],
        disclaimer:
          "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "parenting-values-worksheet",
        title: "Parenting Values Worksheet",
        description: "Clarify your own parenting values before comparing them with someone else's.",
        tag: "Available now",
        format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Parenting-Values-Worksheet.docx",
        downloadName: "LetsBeParents-Parenting-Values-Worksheet.docx",
        sections: ["What matters most", "Everyday parenting", "Education and identity", "Money and family", "When we disagree"],
        sampleQuestions: [
          "The three things I most want my child to experience are:",
          "The values I want to model are:",
          "The kind of parent I hope to be is:",
        ],
        disclaimer:
          "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
    ],
  },
];

// --- Co-Parenting Compatibility Quiz -----------------------------------
// Ported from ui.tsx's QUIZ_SECTIONS / QUIZ_QUESTIONS / QUIZ_STRENGTH_COPY /
// QUIZ_DISCUSS_COPY / QUIZ_PROMPTS / computeQuizResults, verbatim for the
// English content. Same MVP scope as the website: 26 questions / 8
// sections, a reflection tool (no score, no pass/fail), single-person only
// - no backend call anywhere in this feature, matching the site exactly.
//
// UPDATE (Sept 2026): the website itself has no ru/es copy for this quiz
// yet (checked frontend/src/ui.tsx directly - QUIZ_QUESTIONS etc. there are
// English-only, same as here), so there was nothing to port for those two
// locales. Alena asked for the quiz itself to be translated regardless of
// what the site currently has, so QUIZ_CONTENT_RU/ES below are original
// translations of the same 26 questions/copy, not ported from anywhere -
// if the website later adds its own ru/es quiz copy, reconcile against
// that rather than assuming this translation is the canonical one.

export type QuizLocale = "en" | "ru" | "es";

export type QuizContent = {
  sections: string[];
  questions: QuizQuestion[];
  strengthCopy: Record<number, { title: string; copy: string }>;
  discussCopy: Record<number, { title: string; copy: string }>;
  prompts: Record<number, string[]>;
};

export const QUIZ_SECTIONS = ["Why parent?", "Parenting", "Everyday life", "Money", "Communication", "Boundaries", "Future", "Important questions"];

export type QuizQuestion = { section: number; type: "select" | "text"; prompt: string; options?: string[] };

// For "select" questions, the LAST option is always the "still deciding" one
// - used only to gauge how settled someone's thinking is in that area for
// the reflection results, never shown as "wrong".
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { section: 1, type: "select", prompt: "Why do you want to become a parent?", options: ["I've always wanted to raise a child", "I want to build a family before it's too late for me", "I want to give a child a loving home, however that looks", "I'm honestly still exploring why"] },
  { section: 1, type: "select", prompt: "How would you describe the kind of parent you hope to be?", options: ["Hands-on and involved in the daily details", "Present, but giving my child independence", "Guided by structure and routine", "Still figuring this out"] },
  { section: 1, type: "select", prompt: "What matters most to you about becoming a parent right now?", options: ["Timing - I don't want to wait much longer", "Finding the right situation, whenever that happens", "Doing it in a way that feels stable and prepared", "I'm not sure yet, I'm exploring my options"] },
  { section: 2, type: "select", prompt: "How would you ideally share parenting responsibilities?", options: ["As equally as possible", "Based on schedules", "Based on income", "Decide together", "I'm not sure yet"] },
  { section: 2, type: "select", prompt: "What's your view on discipline?", options: ["Clear rules and consistent consequences", "Gentle guidance, talking things through", "Depends on the situation", "Something we'd need to agree on together"] },
  { section: 2, type: "select", prompt: "How involved do you want the other parent to be in day-to-day decisions?", options: ["Involved in everything, always", "Involved in the big decisions, independent on the small ones", "Mostly independent, checking in occasionally", "I'm still working this out"] },
  { section: 2, type: "select", prompt: "How do you feel about extended family being involved in parenting?", options: ["Very involved - grandparents and family close by", "Involved sometimes, but we set the boundaries", "Minimal involvement, we'd raise the child mostly ourselves", "Depends entirely on the family, I'd need to think it through"] },
  { section: 3, type: "select", prompt: "Where would you ideally want your child to grow up?", options: ["Close to where I live now", "Open to moving somewhere new", "Close to family, wherever they are", "Haven't thought about it yet"] },
  { section: 3, type: "select", prompt: "How would you divide everyday routines like school runs, meals and bedtime?", options: ["Split evenly by default", "Whoever's schedule allows it that day", "One of us takes the lead, the other supports", "We'd figure it out as we go"] },
  { section: 3, type: "select", prompt: "How much flexibility do you want in your day-to-day parenting schedule?", options: ["A clear, consistent routine works best for me", "I like flexibility and adapting as needed", "A mix of both", "Not sure yet"] },
  { section: 4, type: "select", prompt: "How do you feel about splitting child-related costs?", options: ["Equally, no matter what we each earn", "Proportional to what we each earn", "One of us takes on more financially", "We'd need to talk this through"] },
  { section: 4, type: "select", prompt: "How would you handle a large, unexpected expense for your child?", options: ["Split it immediately, no discussion needed", "Talk it through and decide together first", "Whoever has the means covers it, for now", "Honestly not sure yet"] },
  { section: 4, type: "select", prompt: "How comfortable are you discussing money with a co-parent before you commit to anything?", options: ["Very comfortable - I'd want this settled early", "Comfortable, but I'd ease into it", "A bit uneasy, but I know it's necessary", "I tend to avoid money conversations"] },
  { section: 5, type: "select", prompt: "How often do you expect to communicate with a co-parent about your child?", options: ["Daily updates, even for small things", "Regularly, for anything that matters", "Only when a decision needs to be made", "I'm not sure what's realistic yet"] },
  { section: 5, type: "select", prompt: "What's your preferred way to handle a disagreement?", options: ["Talk it out immediately, in person if possible", "Take some time to think, then talk", "Write it out first so I can be clear", "I tend to avoid conflict when I can"] },
  { section: 5, type: "select", prompt: "How do you feel about being asked hard questions early on?", options: ["I'd rather know everything upfront", "I'm fine with it once there's some trust", "I'd prefer to ease into deeper topics", "It makes me a little uncomfortable"] },
  { section: 6, type: "select", prompt: "How do you feel about a co-parent dating other people?", options: ["Completely fine, as long as it's respectful", "Fine, but I'd want some boundaries in place", "I'd want to discuss this before it happens", "I haven't thought this through yet"] },
  { section: 6, type: "select", prompt: "What personal information are you comfortable sharing early in a co-parenting conversation?", options: ["Pretty much everything relevant", "The basics, more as trust builds", "Only what's directly related to parenting", "I'm naturally private about most things"] },
  { section: 6, type: "select", prompt: "How do you feel about a co-parent setting limits on how involved you are?", options: ["Completely fair, we should each be able to set limits", "Depends on what the limit is", "I'd want to be as involved as possible, always", "Haven't considered this yet"] },
  { section: 7, type: "select", prompt: "How do you picture your family five years from now?", options: ["A clear, stable routine we've settled into", "Still adapting as things change", "Depends a lot on where life takes us", "Honestly, I haven't pictured it yet"] },
  { section: 7, type: "select", prompt: "What happens if one of you wants to relocate someday?", options: ["We'd need to agree on this before starting", "We'd figure it out together when it comes up", "I'd want the flexibility to move if needed", "Not sure how I'd handle this"] },
  { section: 7, type: "select", prompt: "How do you feel about the arrangement changing as your child gets older?", options: ["I expect it to evolve, and I'm comfortable with that", "I'd want to keep things as consistent as possible", "A bit of both, depending on what's needed", "Haven't thought that far ahead"] },
  { section: 8, type: "select", prompt: "What would make you decide not to move forward with a potential co-parent?", options: ["A mismatch in core values around parenting", "Feeling pressured or rushed into decisions", "Concerns about reliability or follow-through", "I'd know it when I felt it"] },
  { section: 8, type: "text", prompt: "What do you most want a potential co-parent to understand about you before you move forward together?" },
  { section: 8, type: "text", prompt: "What's one question you're afraid to ask, but know you should?" },
  { section: 8, type: "text", prompt: "Is there anything else about your situation or expectations you'd want to share?" },
];

export const QUIZ_STRENGTH_COPY: Record<number, { title: string; copy: string }> = {
  1: { title: "Why parent?", copy: "You seem clear on why you want to become a parent - that clarity is worth naming out loud early in a conversation." },
  2: { title: "Parenting", copy: "You appear to have a settled sense of how you'd want to co-parent day to day." },
  3: { title: "Everyday life", copy: "You have a fairly clear picture of what daily life and routines could look like." },
  4: { title: "Money", copy: "You seem comfortable and decisive about how money and costs would be handled." },
  5: { title: "Communication", copy: "You appear comfortable discussing difficult subjects and looking for solutions together." },
  6: { title: "Boundaries", copy: "You have a clear sense of the boundaries that matter to you." },
  7: { title: "Future", copy: "You seem to have thought through how things might change as your family grows." },
  8: { title: "Important questions", copy: "You have a clear sense of what would - and wouldn't - work for you." },
};

export const QUIZ_DISCUSS_COPY: Record<number, { title: string; copy: string }> = {
  1: { title: "Why parent?", copy: "Your answers suggest your reasons for parenthood are still taking shape - worth putting into words before you go much further." },
  2: { title: "Parenting", copy: "How day-to-day parenting responsibilities would actually be split looks like an area worth a deeper conversation." },
  3: { title: "Everyday life", copy: "Living arrangements and daily routines - your answers show an area where you may want a deeper conversation." },
  4: { title: "Money", copy: "How costs would be shared seems less settled for you - a good one to raise early, not after the fact." },
  5: { title: "Communication", copy: "How you'd communicate day to day, especially during disagreements, is worth talking through explicitly." },
  6: { title: "Boundaries", copy: "Where your boundaries sit isn't fully settled yet - worth clarifying for yourself, then with a potential co-parent." },
  7: { title: "Future", copy: "How things might change over the years is still uncertain for you - worth revisiting as the relationship develops." },
  8: { title: "Important questions", copy: "Some of the harder questions are still open for you - they're worth sitting with before you commit to anything." },
};

export const QUIZ_PROMPTS: Record<number, string[]> = {
  1: ["Why are you both considering this now, specifically?", "What would make this feel like the wrong decision in hindsight?"],
  2: ["How would you split decisions on schooling, healthcare and discipline?", "What happens if you disagree on a parenting decision?"],
  3: ["Where would you each ideally want to live, and how close to each other?", "How would a typical week actually be divided?"],
  4: ["How would you divide costs if one of you earns significantly more?", "Who would cover an unplanned, larger expense?"],
  5: ["How often do you expect to check in with each other?", "What does a fair way to disagree look like to each of you?"],
  6: ["What would you want to know about each other's other relationships?", "What information do you each consider private?"],
  7: ["What would you do if one of you wanted to move away?", "How do you imagine this arrangement evolving over 10+ years?"],
  8: ["What would be a dealbreaker for each of you?", "Is there anything you're hesitant to bring up right now?"],
};

const QUIZ_CONTENT_EN: QuizContent = {
  sections: QUIZ_SECTIONS,
  questions: QUIZ_QUESTIONS,
  strengthCopy: QUIZ_STRENGTH_COPY,
  discussCopy: QUIZ_DISCUSS_COPY,
  prompts: QUIZ_PROMPTS,
};

const QUIZ_CONTENT_RU: QuizContent = {
  sections: ["Зачем становиться родителем?", "Воспитание", "Повседневная жизнь", "Деньги", "Общение", "Границы", "Будущее", "Важные вопросы"],
  questions: [
    { section: 1, type: "select", prompt: "Почему вы хотите стать родителем?", options: ["Я всегда хотел(а) воспитывать ребёнка", "Я хочу создать семью, пока не стало слишком поздно", "Я хочу дать ребёнку любящий дом, каким бы он ни был", "Честно говоря, я всё ещё разбираюсь, почему"] },
    { section: 1, type: "select", prompt: "Как бы вы описали родителя, которым надеетесь стать?", options: ["Активно вовлечённый(ая) во все повседневные детали", "Присутствующий(ая), но дающий(ая) ребёнку самостоятельность", "Ориентированный(ая) на структуру и режим", "Пока ещё не определился(лась)"] },
    { section: 1, type: "select", prompt: "Что для вас сейчас важнее всего в том, чтобы стать родителем?", options: ["Время — я не хочу ждать намного дольше", "Найти подходящую ситуацию, когда бы это ни случилось", "Сделать это так, чтобы чувствовать стабильность и готовность", "Пока не уверен(а), я изучаю свои варианты"] },
    { section: 2, type: "select", prompt: "Как бы вы в идеале хотели делить обязанности по воспитанию?", options: ["Максимально поровну", "В зависимости от графика", "В зависимости от дохода", "Решать вместе, по ситуации", "Пока не уверен(а)"] },
    { section: 2, type: "select", prompt: "Как вы относитесь к дисциплине?", options: ["Чёткие правила и последовательные последствия", "Мягкое руководство, обсуждение ситуаций", "Зависит от ситуации", "Это то, о чём нам нужно договориться вместе"] },
    { section: 2, type: "select", prompt: "Насколько вовлечённым вы хотите видеть второго родителя в повседневных решениях?", options: ["Вовлечён(а) во всё, всегда", "Вовлечён(а) в важные решения, независимость в мелочах", "В основном независимо, с редкими сверками", "Я пока ещё не разобрался(лась) с этим"] },
    { section: 2, type: "select", prompt: "Как вы относитесь к участию расширенной семьи в воспитании?", options: ["Активное участие — бабушки, дедушки и родные рядом", "Иногда участвуют, но границы определяем мы", "Минимальное участие, мы бы растили ребёнка в основном сами", "Полностью зависит от семьи, мне нужно это обдумать"] },
    { section: 3, type: "select", prompt: "Где бы вы хотели, чтобы рос ваш ребёнок?", options: ["Там, где я живу сейчас", "Открыт(а) к переезду куда-то ещё", "Рядом с семьёй, где бы она ни была", "Ещё не думал(а) об этом"] },
    { section: 3, type: "select", prompt: "Как бы вы делили повседневные дела — отвозить в школу, готовить еду, укладывать спать?", options: ["По умолчанию поровну", "В зависимости от того, у кого какой график в этот день", "Один(а) берёт на себя основное, другой(ая) поддерживает", "Разберёмся по ходу дела"] },
    { section: 3, type: "select", prompt: "Насколько гибким вы хотите видеть ваш повседневный родительский график?", options: ["Чёткий, последовательный режим — то, что мне подходит лучше всего", "Мне нравится гибкость и адаптация по необходимости", "Немного того и другого", "Пока не уверен(а)"] },
    { section: 4, type: "select", prompt: "Как вы относитесь к разделению расходов на ребёнка?", options: ["Поровну, независимо от того, кто сколько зарабатывает", "Пропорционально доходу каждого", "Один(а) из нас берёт на себя больше финансово", "Нам нужно было бы это обсудить"] },
    { section: 4, type: "select", prompt: "Как бы вы справились с крупным непредвиденным расходом на ребёнка?", options: ["Разделили бы сразу, без лишних обсуждений", "Сначала обсудили бы и решили вместе", "Пока покрывает тот, у кого есть возможность", "Честно говоря, пока не уверен(а)"] },
    { section: 4, type: "select", prompt: "Насколько вам комфортно обсуждать деньги с со-родителем до того, как вы возьмёте на себя обязательства?", options: ["Очень комфортно — я бы хотел(а) прояснить это заранее", "Комфортно, но я бы подходил(а) к этому постепенно", "Немного неловко, но понимаю, что это необходимо", "Обычно я избегаю разговоров о деньгах"] },
    { section: 5, type: "select", prompt: "Как часто вы ожидаете общаться с со-родителем по поводу ребёнка?", options: ["Ежедневные новости, даже по мелочам", "Регулярно, по всему, что имеет значение", "Только когда нужно принять решение", "Пока не уверен(а), что реалистично"] },
    { section: 5, type: "select", prompt: "Как вы предпочитаете разрешать разногласия?", options: ["Обсудить сразу же, лично, если возможно", "Взять время подумать, а потом поговорить", "Сначала записать мысли, чтобы выразиться яснее", "Обычно я избегаю конфликтов, когда это возможно"] },
    { section: 5, type: "select", prompt: "Как вы относитесь к тому, что вам могут задавать сложные вопросы на раннем этапе?", options: ["Я предпочитаю знать всё сразу", "Мне это нормально, как только появится немного доверия", "Я бы предпочёл(ла) постепенно переходить к более глубоким темам", "Это вызывает у меня лёгкий дискомфорт"] },
    { section: 6, type: "select", prompt: "Как вы относитесь к тому, что со-родитель встречается с другими людьми?", options: ["Совершенно нормально, если это делается с уважением", "Нормально, но я бы хотел(а) установить некоторые границы", "Я бы хотел(а) обсудить это заранее", "Я пока не продумал(а) это"] },
    { section: 6, type: "select", prompt: "Какой личной информацией вам комфортно делиться на раннем этапе разговора о со-родительстве?", options: ["Практически всем, что имеет значение", "Основным, а дальше — по мере роста доверия", "Только тем, что напрямую связано с воспитанием", "По природе я довольно закрытый(ая) человек"] },
    { section: 6, type: "select", prompt: "Как вы относитесь к тому, что со-родитель устанавливает ограничения на степень вашего участия?", options: ["Совершенно справедливо, каждый должен иметь право устанавливать границы", "Зависит от того, что это за ограничение", "Я бы всегда хотел(а) быть максимально вовлечён(а)", "Пока не задумывался(лась) об этом"] },
    { section: 7, type: "select", prompt: "Как вы представляете свою семью через пять лет?", options: ["Чёткий, стабильный уклад, к которому мы пришли", "Всё ещё адаптируемся по мере изменений", "Во многом зависит от того, куда нас приведёт жизнь", "Честно говоря, я пока это не представлял(а)"] },
    { section: 7, type: "select", prompt: "Что произойдёт, если однажды один из вас захочет переехать?", options: ["Нам нужно было бы договориться об этом заранее", "Мы бы разобрались с этим вместе, когда возникнет такая необходимость", "Я бы хотел(а) сохранить гибкость на случай переезда", "Не уверен(а), как бы я с этим справился(лась)"] },
    { section: 7, type: "select", prompt: "Как вы относитесь к тому, что договорённости будут меняться по мере взросления ребёнка?", options: ["Я ожидаю, что всё будет меняться, и мне это комфортно", "Я бы хотел(а) сохранять максимальную стабильность", "Немного и того, и другого, в зависимости от ситуации", "Пока не заглядывал(а) так далеко вперёд"] },
    { section: 8, type: "select", prompt: "Что заставило бы вас отказаться от продолжения отношений с потенциальным со-родителем?", options: ["Несовпадение базовых ценностей в вопросах воспитания", "Ощущение давления или спешки в принятии решений", "Сомнения в надёжности или готовности довести дело до конца", "Я бы просто это почувствовал(а)"] },
    { section: 8, type: "text", prompt: "Что вы больше всего хотели бы, чтобы потенциальный со-родитель понял о вас, прежде чем вы продолжите вместе?" },
    { section: 8, type: "text", prompt: "Какой вопрос вы боитесь задать, но знаете, что должны?" },
    { section: 8, type: "text", prompt: "Есть ли что-то ещё о вашей ситуации или ожиданиях, чем вы хотели бы поделиться?" },
  ],
  strengthCopy: {
    1: { title: "Зачем становиться родителем?", copy: "Похоже, вы чётко понимаете, почему хотите стать родителем — эту ясность стоит озвучить вслух в самом начале разговора." },
    2: { title: "Воспитание", copy: "Похоже, у вас уже сложилось чёткое представление о том, как вы хотели бы совместно воспитывать ребёнка изо дня в день." },
    3: { title: "Повседневная жизнь", copy: "У вас довольно чёткое представление о том, как могла бы выглядеть повседневная жизнь и режим." },
    4: { title: "Деньги", copy: "Похоже, вам комфортно и вы уверенно представляете, как будут решаться финансовые вопросы." },
    5: { title: "Общение", copy: "Похоже, вам комфортно обсуждать сложные темы и искать решения вместе." },
    6: { title: "Границы", copy: "У вас есть чёткое понимание того, какие границы для вас важны." },
    7: { title: "Будущее", copy: "Похоже, вы уже продумали, как всё может измениться по мере роста вашей семьи." },
    8: { title: "Важные вопросы", copy: "У вас есть чёткое понимание того, что вам подходит, а что нет." },
  },
  discussCopy: {
    1: { title: "Зачем становиться родителем?", copy: "Ваши ответы говорят о том, что причины стать родителем у вас пока формируются — стоит облечь их в слова, прежде чем двигаться дальше." },
    2: { title: "Воспитание", copy: "То, как на самом деле будут распределяться повседневные обязанности по воспитанию, — тема, которую стоит обсудить глубже." },
    3: { title: "Повседневная жизнь", copy: "Условия проживания и повседневный распорядок — судя по вашим ответам, это область, которую стоит обсудить подробнее." },
    4: { title: "Деньги", copy: "Вопрос о том, как будут делиться расходы, выглядит менее определённым для вас — его стоит поднять заранее, а не постфактум." },
    5: { title: "Общение", copy: "То, как вы будете общаться изо дня в день, особенно во время разногласий, стоит обсудить явно и открыто." },
    6: { title: "Границы", copy: "Ваши границы пока не до конца определены — стоит прояснить их сначала для себя, а затем с потенциальным со-родителем." },
    7: { title: "Будущее", copy: "То, как всё может измениться с годами, пока остаётся для вас неопределённым — стоит возвращаться к этому по мере развития отношений." },
    8: { title: "Важные вопросы", copy: "Некоторые из более сложных вопросов пока остаются для вас открытыми — стоит подумать над ними, прежде чем брать на себя обязательства." },
  },
  prompts: {
    1: ["Почему вы оба рассматриваете это именно сейчас?", "Что заставило бы вас оглянуться назад и почувствовать, что решение было неверным?"],
    2: ["Как вы будете делить решения по образованию, здравоохранению и дисциплине?", "Что произойдёт, если вы не согласитесь друг с другом по поводу решения о воспитании?"],
    3: ["Где бы каждый из вас в идеале хотел жить и насколько близко друг к другу?", "Как на самом деле будет делиться обычная неделя?"],
    4: ["Как вы будете делить расходы, если один из вас зарабатывает значительно больше?", "Кто покроет крупный незапланированный расход?"],
    5: ["Как часто вы ожидаете быть на связи друг с другом?", "Как, по мнению каждого из вас, выглядит справедливый способ не соглашаться?"],
    6: ["Что бы вы хотели знать об отношениях друг друга с другими людьми?", "Какую информацию каждый из вас считает личной?"],
    7: ["Что бы вы сделали, если бы один из вас захотел переехать?", "Как вы представляете развитие этой договорённости через 10+ лет?"],
    8: ["Что стало бы для каждого из вас решающим фактором отказа?", "Есть ли что-то, что вам сейчас неловко поднять?"],
  },
};

const QUIZ_CONTENT_ES: QuizContent = {
  sections: ["¿Por qué ser padre/madre?", "Crianza", "Vida cotidiana", "Dinero", "Comunicación", "Límites", "Futuro", "Preguntas importantes"],
  questions: [
    { section: 1, type: "select", prompt: "¿Por qué quieres ser padre/madre?", options: ["Siempre he querido criar a un hijo/a", "Quiero formar una familia antes de que sea demasiado tarde para mí", "Quiero darle a un niño/a un hogar lleno de amor, sea como sea", "Sinceramente, todavía estoy explorando por qué"] },
    { section: 1, type: "select", prompt: "¿Cómo describirías al padre o madre que esperas ser?", options: ["Muy involucrado/a en los detalles del día a día", "Presente, pero dando independencia a mi hijo/a", "Guiado/a por la estructura y la rutina", "Todavía lo estoy descubriendo"] },
    { section: 1, type: "select", prompt: "¿Qué es lo más importante para ti ahora mismo respecto a ser padre/madre?", options: ["El momento: no quiero esperar mucho más", "Encontrar la situación adecuada, cuando sea que llegue", "Hacerlo de una manera que se sienta estable y preparada", "Aún no estoy seguro/a, estoy explorando mis opciones"] },
    { section: 2, type: "select", prompt: "¿Cómo te gustaría idealmente repartir las responsabilidades de crianza?", options: ["Lo más equitativamente posible", "Según los horarios", "Según los ingresos", "Decidirlo juntos", "Aún no estoy seguro/a"] },
    { section: 2, type: "select", prompt: "¿Cuál es tu opinión sobre la disciplina?", options: ["Reglas claras y consecuencias consistentes", "Orientación suave, hablando las cosas", "Depende de la situación", "Es algo que tendríamos que acordar juntos"] },
    { section: 2, type: "select", prompt: "¿Qué tan involucrado/a quieres que esté el otro padre o madre en las decisiones del día a día?", options: ["Involucrado/a en todo, siempre", "Involucrado/a en las decisiones grandes, independiente en las pequeñas", "Mayormente independiente, consultando de vez en cuando", "Todavía lo estoy pensando"] },
    { section: 2, type: "select", prompt: "¿Qué opinas sobre la participación de la familia extendida en la crianza?", options: ["Muy involucrada: abuelos y familia cerca", "Involucrada a veces, pero nosotros ponemos los límites", "Participación mínima, criaríamos al niño/a mayormente nosotros", "Depende totalmente de la familia, tendría que pensarlo"] },
    { section: 3, type: "select", prompt: "¿Dónde te gustaría idealmente que creciera tu hijo/a?", options: ["Cerca de donde vivo ahora", "Abierto/a a mudarme a un lugar nuevo", "Cerca de la familia, esté donde esté", "Todavía no lo he pensado"] },
    { section: 3, type: "select", prompt: "¿Cómo dividirían las rutinas diarias, como llevar al colegio, las comidas y la hora de dormir?", options: ["Repartido de forma equitativa por defecto", "Quien tenga el horario disponible ese día", "Uno/a de nosotros lidera, el otro/a apoya", "Lo iríamos resolviendo sobre la marcha"] },
    { section: 3, type: "select", prompt: "¿Cuánta flexibilidad quieres en tu rutina diaria de crianza?", options: ["Una rutina clara y constante es lo que mejor me funciona", "Me gusta la flexibilidad y adaptarme según haga falta", "Una mezcla de ambas", "Aún no estoy seguro/a"] },
    { section: 4, type: "select", prompt: "¿Cómo te sientes respecto a dividir los gastos relacionados con el niño/a?", options: ["Por igual, sin importar cuánto gane cada uno", "Proporcional a lo que gane cada uno", "Uno/a de nosotros asume más responsabilidad económica", "Tendríamos que hablarlo"] },
    { section: 4, type: "select", prompt: "¿Cómo manejarías un gasto grande e inesperado para tu hijo/a?", options: ["Lo dividiríamos de inmediato, sin necesidad de discutirlo", "Lo hablaríamos y decidiríamos juntos primero", "Quien tenga los medios lo cubre, por ahora", "Sinceramente, aún no lo sé"] },
    { section: 4, type: "select", prompt: "¿Qué tan cómodo/a te sientes hablando de dinero con un co-padre o co-madre antes de comprometerte a algo?", options: ["Muy cómodo/a: querría dejarlo claro desde el principio", "Cómodo/a, pero iría poco a poco", "Un poco incómodo/a, pero sé que es necesario", "Tiendo a evitar las conversaciones sobre dinero"] },
    { section: 5, type: "select", prompt: "¿Con qué frecuencia esperas comunicarte con un co-padre o co-madre sobre tu hijo/a?", options: ["Actualizaciones diarias, incluso por cosas pequeñas", "Con regularidad, para todo lo que importa", "Solo cuando haya que tomar una decisión", "Aún no sé qué es realista"] },
    { section: 5, type: "select", prompt: "¿Cuál es tu forma preferida de manejar un desacuerdo?", options: ["Hablarlo de inmediato, en persona si es posible", "Tomarme un tiempo para pensar y después hablarlo", "Escribirlo primero para poder expresarme con claridad", "Tiendo a evitar el conflicto cuando puedo"] },
    { section: 5, type: "select", prompt: "¿Cómo te sientes si te hacen preguntas difíciles desde el principio?", options: ["Prefiero saberlo todo desde el inicio", "Me parece bien una vez que hay algo de confianza", "Prefiero ir entrando poco a poco en temas más profundos", "Me incomoda un poco"] },
    { section: 6, type: "select", prompt: "¿Qué opinas de que un co-padre o co-madre salga con otras personas?", options: ["Totalmente bien, siempre que sea con respeto", "Bien, pero querría establecer algunos límites", "Querría hablarlo antes de que suceda", "Todavía no lo he pensado bien"] },
    { section: 6, type: "select", prompt: "¿Qué información personal te sientes cómodo/a compartiendo al principio de una conversación sobre co-crianza?", options: ["Prácticamente todo lo relevante", "Lo básico, y más a medida que se genera confianza", "Solo lo directamente relacionado con la crianza", "Por naturaleza soy bastante reservado/a"] },
    { section: 6, type: "select", prompt: "¿Cómo te sientes si un co-padre o co-madre pone límites a tu nivel de participación?", options: ["Totalmente justo, cada uno debería poder poner límites", "Depende de cuál sea el límite", "Siempre querría estar lo más involucrado/a posible", "Aún no lo he considerado"] },
    { section: 7, type: "select", prompt: "¿Cómo imaginas a tu familia dentro de cinco años?", options: ["Una rutina clara y estable en la que ya nos hemos asentado", "Todavía adaptándonos a medida que cambian las cosas", "Depende mucho de hacia dónde nos lleve la vida", "Sinceramente, todavía no lo he imaginado"] },
    { section: 7, type: "select", prompt: "¿Qué pasaría si uno/a de ustedes quisiera mudarse algún día?", options: ["Tendríamos que acordar esto antes de empezar", "Lo resolveríamos juntos cuando surja", "Querría tener la flexibilidad de mudarme si fuera necesario", "No estoy seguro/a de cómo lo manejaría"] },
    { section: 7, type: "select", prompt: "¿Cómo te sientes respecto a que el acuerdo cambie a medida que tu hijo/a crece?", options: ["Espero que evolucione, y me siento cómodo/a con eso", "Querría mantener las cosas lo más estables posible", "Un poco de ambas, según lo que se necesite", "Todavía no lo he pensado tan a futuro"] },
    { section: 8, type: "select", prompt: "¿Qué te haría decidir no seguir adelante con un posible co-padre o co-madre?", options: ["Una discrepancia en los valores fundamentales sobre la crianza", "Sentirme presionado/a o apresurado/a a tomar decisiones", "Dudas sobre su fiabilidad o compromiso", "Simplemente lo sabría al sentirlo"] },
    { section: 8, type: "text", prompt: "¿Qué es lo que más te gustaría que un posible co-padre o co-madre entendiera de ti antes de seguir adelante juntos?" },
    { section: 8, type: "text", prompt: "¿Cuál es una pregunta que temes hacer, pero sabes que deberías?" },
    { section: 8, type: "text", prompt: "¿Hay algo más sobre tu situación o tus expectativas que te gustaría compartir?" },
  ],
  strengthCopy: {
    1: { title: "¿Por qué ser padre/madre?", copy: "Pareces tener claro por qué quieres ser padre o madre; vale la pena expresar esa claridad en voz alta al principio de la conversación." },
    2: { title: "Crianza", copy: "Pareces tener una idea clara de cómo te gustaría co-criar día a día." },
    3: { title: "Vida cotidiana", copy: "Tienes una idea bastante clara de cómo podría ser la vida diaria y las rutinas." },
    4: { title: "Dinero", copy: "Pareces sentirte cómodo/a y decidido/a sobre cómo se manejarían el dinero y los gastos." },
    5: { title: "Comunicación", copy: "Pareces sentirte cómodo/a hablando de temas difíciles y buscando soluciones juntos." },
    6: { title: "Límites", copy: "Tienes una idea clara de los límites que son importantes para ti." },
    7: { title: "Futuro", copy: "Pareces haber pensado en cómo podrían cambiar las cosas a medida que tu familia crece." },
    8: { title: "Preguntas importantes", copy: "Tienes una idea clara de lo que te funcionaría y lo que no." },
  },
  discussCopy: {
    1: { title: "¿Por qué ser padre/madre?", copy: "Tus respuestas sugieren que tus razones para ser padre o madre todavía están tomando forma; vale la pena ponerlas en palabras antes de avanzar mucho más." },
    2: { title: "Crianza", copy: "Cómo se repartirían realmente las responsabilidades diarias de crianza parece un tema que merece una conversación más profunda." },
    3: { title: "Vida cotidiana", copy: "Las condiciones de vida y las rutinas diarias: tus respuestas muestran un área donde podría valer la pena una conversación más profunda." },
    4: { title: "Dinero", copy: "Cómo se compartirían los gastos parece un tema menos resuelto para ti; es bueno plantearlo pronto, no después de los hechos." },
    5: { title: "Comunicación", copy: "Cómo te comunicarías día a día, especialmente durante los desacuerdos, vale la pena hablarlo de forma explícita." },
    6: { title: "Límites", copy: "Dónde están tus límites no está del todo definido; vale la pena aclararlo primero contigo mismo/a, y luego con un posible co-padre o co-madre." },
    7: { title: "Futuro", copy: "Cómo podrían cambiar las cosas con los años sigue siendo incierto para ti; vale la pena revisarlo a medida que la relación avanza." },
    8: { title: "Preguntas importantes", copy: "Algunas de las preguntas más difíciles siguen abiertas para ti; vale la pena reflexionar sobre ellas antes de comprometerte a algo." },
  },
  prompts: {
    1: ["¿Por qué están considerando esto específicamente ahora?", "¿Qué haría que esto se sintiera como una decisión equivocada en retrospectiva?"],
    2: ["¿Cómo dividirían las decisiones sobre educación, salud y disciplina?", "¿Qué pasa si no están de acuerdo en una decisión de crianza?"],
    3: ["¿Dónde le gustaría idealmente vivir a cada uno, y qué tan cerca uno del otro?", "¿Cómo se dividiría realmente una semana típica?"],
    4: ["¿Cómo dividirían los gastos si uno/a de ustedes gana significativamente más?", "¿Quién cubriría un gasto grande e imprevisto?"],
    5: ["¿Con qué frecuencia esperan comunicarse entre ustedes?", "¿Cómo se ve, para cada uno de ustedes, una forma justa de estar en desacuerdo?"],
    6: ["¿Qué querrían saber sobre las otras relaciones de cada uno?", "¿Qué información considera privada cada uno?"],
    7: ["¿Qué harían si uno/a de ustedes quisiera mudarse lejos?", "¿Cómo imaginan que evolucionará este acuerdo en más de 10 años?"],
    8: ["¿Qué sería decisivo para romper el trato para cada uno de ustedes?", "¿Hay algo que dudan en mencionar ahora mismo?"],
  },
};

export const QUIZ_CONTENT: Record<QuizLocale, QuizContent> = {
  en: QUIZ_CONTENT_EN,
  ru: QUIZ_CONTENT_RU,
  es: QUIZ_CONTENT_ES,
};

export function getQuizContent(locale: string): QuizContent {
  return QUIZ_CONTENT[locale as QuizLocale] || QUIZ_CONTENT_EN;
}

export type QuizResults = { strongest: number[]; discuss: number[]; prompts: string[] };

export function computeQuizResults(answers: (string | null)[], content: QuizContent = QUIZ_CONTENT_EN): QuizResults {
  const bySection = new Map<number, { decisive: number; total: number }>();
  content.questions.forEach((q, i) => {
    if (q.type !== "select" || !q.options) return;
    const entry = bySection.get(q.section) ?? { decisive: 0, total: 0 };
    entry.total += 1;
    const answer = answers[i];
    if (answer && answer !== q.options[q.options.length - 1]) entry.decisive += 1;
    bySection.set(q.section, entry);
  });
  const ranked = [...bySection.entries()].map(([section, { decisive, total }]) => ({ section, ratio: total ? decisive / total : 0 }));
  const byStrength = [...ranked].sort((a, b) => b.ratio - a.ratio);
  const strongest = byStrength.filter((r) => r.ratio >= 0.66).slice(0, 2).map((r) => r.section);
  const discuss = [...ranked].sort((a, b) => a.ratio - b.ratio).filter((r) => r.ratio < 0.66 && !strongest.includes(r.section)).slice(0, 2).map((r) => r.section);
  const prompts = discuss.flatMap((section) => content.prompts[section] ?? []).slice(0, 3);
  return { strongest, discuss, prompts };
}

export function quizResultsAsText(answers: (string | null)[], results: QuizResults, content: QuizContent = QUIZ_CONTENT_EN): string {
  const lines: string[] = ["LetsBeParents - Co-Parenting Compatibility Quiz", "A reflection of your priorities, not a verdict.", ""];
  content.questions.forEach((q, i) => {
    lines.push(`${content.sections[q.section - 1]} - ${q.prompt}`);
    lines.push(`> ${answers[i] || "(not answered)"}`);
    lines.push("");
  });
  lines.push("Your strongest areas:");
  results.strongest.forEach((s) => lines.push(`- ${content.strengthCopy[s].title}: ${content.strengthCopy[s].copy}`));
  lines.push("");
  lines.push("Worth discussing:");
  results.discuss.forEach((s) => lines.push(`- ${content.discussCopy[s].title}: ${content.discussCopy[s].copy}`));
  return lines.join("\n");
}
