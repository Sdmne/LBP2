import { colors } from "../theme";
import type { Locale } from "../i18n/translations";

// Ported directly from lbp/frontend/src/ui.tsx (RESOURCES_CATEGORIES,
// QUIZ_SECTIONS, QUIZ_QUESTIONS, QUIZ_STRENGTH_COPY, QUIZ_DISCUSS_COPY,
// QUIZ_PROMPTS, computeQuizResults - traced directly from the real file,
// not re-authored) as of Sept 2026. This is real, already-reviewed product
// copy (see the master brief's note that the 26 quiz questions were written
// specifically for this feature and are meant to go live as-is), so it is
// copied verbatim rather than paraphrased.
//
// UPDATE (Sept 2026): Alena - "документы скачивается на англ, а мы же
// переводили все 10 документов" (downloads and the in-app text were still
// English even though the actual .docx templates were already translated
// elsewhere). RESOURCES_CATEGORIES right below stays the English base data
// (unchanged, still what every screen reads by default) - what's new is
// RESOURCES_CATEGORIES_I18N/RESOURCES_TOOLS_I18N plus localizedCategory()/
// localizedTool()/resourceFormatLabel() further down, ported byte-for-byte
// from the website's own already-shipped ru/es/pt/fr/de/it/pl copy
// (frontend/src/ui.tsx) rather than re-translated here - this is the exact
// copy real users already see on the website, so there is no drift risk
// like the old version of this comment once warned about for the quiz.
// localizedDownloadUrl() was also confirmed against the actual files on
// disk: every one of the 10 .docx templates already exists under
// web-static/resources/<locale>/ for all 7 non-English locales (checked
// filename-for-filename against the English originals - all match). So
// this really is "point mobile at what already exists," not a new
// translation job. ResourcesScreen/ResourceCategoryScreen/ResourceToolScreen
// now call localizedCategory()/localizedTool() with the current locale
// before rendering - see those files for the call sites.

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


// --- Localized resource copy (Sept 2026) ---------------------------------
type ResourceCategoryI18nEntry = { eyebrow: string; title: string; description: string; disclaimer?: string };
type ResourceToolI18nEntry = { title: string; description: string; sections?: string[]; sampleQuestions?: string[]; disclaimer?: string; downloadUrl?: string };

export const RESOURCES_CATEGORIES_I18N: Partial<Record<string, Partial<Record<Locale, ResourceCategoryI18nEntry>>>> = {
  "co-parenting": {
    ru: {"eyebrow": "Совместное родительство", "title": "Инструменты для создания семьи с со-родителем", "description": "Вопросы, чек-листы и шаблоны, которые помогут найти со-родителя и лучше его узнать."},
    es: {"eyebrow": "Co-crianza", "title": "Herramientas para formar una familia con un co-padre o co-madre", "description": "Preguntas, listas de verificación y plantillas para encontrar y conocer a un co-padre o co-madre."},
    pt: {"eyebrow": "Coparentalidade", "title": "Ferramentas para construíres uma família com um coparente", "description": "Perguntas, checklists e modelos para encontrares e conheceres um coparente."},
    fr: {"eyebrow": "Coparentalité", "title": "Des outils pour construire une famille avec un coparent", "description": "Des questions, des listes de contrôle et des modèles pour trouver un coparent et apprendre à le connaître."},
    de: {"eyebrow": "Co-Elternschaft", "title": "Tools, um mit einer Co-Eltern-Person eine Familie zu gründen", "description": "Fragen, Checklisten und Vorlagen, die dir helfen, eine Co-Eltern-Person zu finden und kennenzulernen."},
    it: {"eyebrow": "Co-genitorialità", "title": "Strumenti per costruire una famiglia con un co-genitore", "description": "Domande, checklist e modelli per trovare un co-genitore e conoscerlo meglio."},
    pl: {"eyebrow": "Współrodzicielstwo", "title": "Narzędzia do budowania rodziny ze współrodzicem", "description": "Pytania, listy kontrolne i szablony, które pomogą Ci znaleźć współrodzica i lepiej go poznać."},
  },
  "fertility-donor": {
    ru: {"eyebrow": "Фертильность и донорское зачатие", "title": "Подготовьтесь к разговорам с клиникой и донором", "description": "Практические вопросы и чек-листы для разговоров с клиниками и специалистами.", "disclaimer": "Эти ресурсы созданы, чтобы помочь вам подготовиться к разговору с квалифицированными специалистами. Это не медицинская и не юридическая консультация."},
    es: {"eyebrow": "Fertilidad y concepción con donante", "title": "Prepárate para las conversaciones con la clínica y el donante", "description": "Preguntas prácticas y listas de verificación para hablar con clínicas y profesionales.", "disclaimer": "Estos recursos están diseñados para ayudarte a prepararte para las conversaciones con profesionales cualificados. No constituyen asesoramiento médico ni legal."},
    pt: {"eyebrow": "Fertilidade e conceção com dador", "title": "Prepara-te para as conversas com a clínica e o dador", "description": "Perguntas práticas e checklists para falar com clínicas e profissionais.", "disclaimer": "Estes recursos foram concebidos para te ajudar a preparares-te para as conversas com profissionais qualificados. Não constituem aconselhamento médico ou legal."},
    fr: {"eyebrow": "Fertilité et conception avec don de gamètes", "title": "Préparez-vous aux échanges avec la clinique et le donneur", "description": "Des questions pratiques et des listes de contrôle pour échanger avec les cliniques et les professionnels.", "disclaimer": "Ces ressources sont conçues pour vous aider à préparer vos échanges avec des professionnels qualifiés. Elles ne constituent pas un conseil médical ou juridique."},
    de: {"eyebrow": "Fruchtbarkeit & Samen-/Eizellspende", "title": "Bereite dich auf Gespräche mit Klinik und Spender vor", "description": "Praktische Fragen und Checklisten für Gespräche mit Kliniken und Fachpersonen.", "disclaimer": "Diese Ressourcen sollen dir helfen, dich auf Gespräche mit qualifizierten Fachpersonen vorzubereiten. Sie stellen keine medizinische oder rechtliche Beratung dar."},
    it: {"eyebrow": "Fertilità e fecondazione da donatore", "title": "Si prepari per i colloqui con la clinica e il donatore", "description": "Domande pratiche e checklist per parlare con cliniche e professionisti.", "disclaimer": "Queste risorse sono pensate per aiutarLa a prepararsi ai colloqui con professionisti qualificati. Non costituiscono una consulenza medica o legale."},
    pl: {"eyebrow": "Płodność i poczęcie z dawstwa", "title": "Przygotuj się do rozmów z kliniką i dawcą", "description": "Praktyczne pytania i listy kontrolne do rozmów z klinikami i specjalistami.", "disclaimer": "Te zasoby mają pomóc Ci przygotować się do rozmów z wykwalifikowanymi specjalistami. Nie stanowią porady medycznej ani prawnej."},
  },
  "parenthood-planning": {
    ru: {"eyebrow": "Планирование родительства", "title": "Подготовьтесь к практической стороне вопроса", "description": "О практической стороне подготовки к появлению ребёнка."},
    es: {"eyebrow": "Planificación de la parentalidad", "title": "Prepárate para el lado práctico", "description": "Para el lado práctico de prepararte para tener un hijo o hija."},
    pt: {"eyebrow": "Planeamento da parentalidade", "title": "Prepara-te para o lado prático", "description": "Para o lado prático de te preparares para teres um filho ou filha."},
    fr: {"eyebrow": "Planification de la parentalité", "title": "Préparez-vous au côté pratique", "description": "Pour le côté pratique de la préparation à l'arrivée d'un enfant."},
    de: {"eyebrow": "Elternschaftsplanung", "title": "Bereite dich auf die praktische Seite vor", "description": "Für die praktische Seite der Vorbereitung auf ein Kind."},
    it: {"eyebrow": "Pianificazione della genitorialità", "title": "Si prepari per il lato pratico", "description": "Per il lato pratico della preparazione all'arrivo di un figlio."},
    pl: {"eyebrow": "Planowanie rodzicielstwa", "title": "Przygotuj się na praktyczną stronę", "description": "Praktyczna strona przygotowań do posiadania dziecka."},
  },
};

export const RESOURCES_TOOLS_I18N: Partial<Record<string, Partial<Record<Locale, ResourceToolI18nEntry>>>> = {
  "co-parenting/planning-template": {
    ru: {"title": "Шаблон планирования совместного родительства", "description": "Обсудите воспитание, финансы, условия проживания и границы, прежде чем двигаться дальше.", "sections": ["Наши намерения", "Дом ребёнка и повседневная жизнь", "Ценности и решения в воспитании", "Беременность, зачатие и медицинское наблюдение", "Финансы", "Общение и границы", "Новые партнёры и меняющиеся семьи", "Отношения ребёнка с обоими родителями", "Конфликты и внешняя поддержка", "Если обстоятельства изменятся"], "sampleQuestions": ["Почему мы рассматриваем совместное родительство?", "Что заставило бы нас отказаться от этой идеи?", "Чего каждый из нас ожидает от другого как от родителя?"], "disclaimer": "Этот шаблон - инструмент для разговора, а не юридический документ. Его заполнение не создаёт и не гарантирует юридическое родительство, родительскую ответственность, опеку или финансовые права. Прежде чем полагаться на то, о чём вы здесь договоритесь, проверьте законодательство, применимое к вашей семье."},
    es: {"title": "Plantilla de planificación de co-crianza", "description": "Habla sobre crianza, finanzas, convivencia y límites antes de avanzar.", "sections": ["Nuestras intenciones", "El hogar del niño y la vida cotidiana", "Valores y decisiones de crianza", "Embarazo, concepción y atención médica", "Finanzas", "Comunicación y límites", "Nuevas parejas y familias cambiantes", "La relación del niño con ambos padres", "Conflictos y apoyo externo", "Si las circunstancias cambian"], "sampleQuestions": ["¿Por qué estamos considerando la co-crianza?", "¿Qué nos haría decidir no seguir adelante?", "¿Qué esperamos cada uno del otro como madre o padre?"], "disclaimer": "Esta plantilla es una herramienta de conversación, no un documento legal. Completarla no crea ni garantiza la paternidad o maternidad legal, la patria potestad, la custodia ni los derechos económicos. Comprueba la legislación aplicable a tu familia antes de basarte en cualquier acuerdo alcanzado aquí."},
    pt: {"title": "Modelo de planeamento de coparentalidade", "description": "Fala sobre educação, finanças, condições de vida e limites antes de avançar.", "sections": ["As nossas intenções", "A casa da criança e o dia a dia", "Valores e decisões de educação", "Gravidez, conceção e cuidados médicos", "Finanças", "Comunicação e limites", "Novos parceiros e famílias em mudança", "A relação da criança com ambos os pais", "Conflitos e apoio externo", "Se as circunstâncias mudarem"], "sampleQuestions": ["Porque é que estamos a considerar a coparentalidade?", "O que nos faria decidir não avançar?", "O que é que cada um espera do outro como pai ou mãe?"], "disclaimer": "Este modelo é uma ferramenta de conversa, não um documento legal. Preenchê-lo não cria nem garante a parentalidade legal, as responsabilidades parentais, a guarda ou os direitos financeiros. Verifica a lei aplicável à tua família antes de te basares em qualquer coisa que acordes aqui."},
    fr: {"title": "Modèle de planification de coparentalité", "description": "Discutez de l'éducation, des finances, du mode de vie et des limites avant d'aller plus loin.", "sections": ["Nos intentions", "Le foyer de l'enfant et la vie quotidienne", "Valeurs éducatives et décisions", "Grossesse, conception et suivi médical", "Finances", "Communication et limites", "Nouveaux partenaires et familles qui évoluent", "La relation de l'enfant avec les deux parents", "Conflits et soutien extérieur", "Si la situation change"], "sampleQuestions": ["Pourquoi envisageons-nous la coparentalité ?", "Qu'est-ce qui nous ferait renoncer à ce projet ?", "Qu'attendons-nous chacun de l'autre en tant que parent ?"], "disclaimer": "Ce modèle est un outil de discussion, pas un document juridique. Le remplir ne crée ni ne garantit la parentalité légale, l'autorité parentale, la garde ou des droits financiers. Vérifiez la législation applicable à votre famille avant de vous appuyer sur ce que vous convenez ici."},
    de: {"title": "Vorlage zur Co-Elternschaftsplanung", "description": "Sprecht über Erziehung, Finanzen, Wohnsituation und Grenzen, bevor ihr weitermacht.", "sections": ["Unsere Absichten", "Zuhause und Alltag des Kindes", "Erziehungswerte und Entscheidungen", "Schwangerschaft, Zeugung und medizinische Betreuung", "Finanzen", "Kommunikation und Grenzen", "Neue Partner und sich verändernde Familien", "Die Beziehung des Kindes zu beiden Elternteilen", "Konflikte und externe Unterstützung", "Wenn sich die Umstände ändern"], "sampleQuestions": ["Warum ziehen wir Co-Elternschaft in Betracht?", "Was würde uns dazu bringen, nicht weiterzumachen?", "Was erwarten wir jeweils voneinander als Elternteil?"], "disclaimer": "Diese Vorlage ist ein Gesprächswerkzeug, kein Rechtsdokument. Das Ausfüllen begründet oder garantiert keine rechtliche Elternschaft, elterliche Sorge, kein Sorgerecht und keine finanziellen Ansprüche. Prüfe das für deine Familie geltende Recht, bevor du dich auf hier vereinbarte Punkte verlässt."},
    it: {"title": "Modello di pianificazione della co-genitorialità", "description": "Parlate di educazione, finanze, convivenza e confini prima di andare avanti.", "sections": ["Le nostre intenzioni", "La casa del bambino e la vita quotidiana", "Valori educativi e decisioni", "Gravidanza, concepimento e assistenza medica", "Finanze", "Comunicazione e confini", "Nuovi partner e famiglie che cambiano", "La relazione del bambino con entrambi i genitori", "Conflitti e supporto esterno", "Se le circostanze cambiano"], "sampleQuestions": ["Perché stiamo considerando la co-genitorialità?", "Cosa ci farebbe decidere di non andare avanti?", "Cosa ci aspettiamo l'uno dall'altro come genitori?"], "disclaimer": "Questo modello è uno strumento di conversazione, non un documento legale. Compilarlo non crea né garantisce la genitorialità legale, la responsabilità genitoriale, l'affidamento o i diritti finanziari. Verifichi la legge applicabile alla propria famiglia prima di fare affidamento su quanto concordato qui."},
    pl: {"title": "Szablon planowania współrodzicielstwa", "description": "Porozmawiajcie o wychowaniu, finansach, warunkach mieszkaniowych i granicach, zanim pójdziecie dalej.", "sections": ["Nasze intencje", "Dom dziecka i codzienne życie", "Wartości i decyzje wychowawcze", "Ciąża, poczęcie i opieka medyczna", "Finanse", "Komunikacja i granice", "Nowi partnerzy i zmieniające się rodziny", "Relacja dziecka z obojgiem rodziców", "Konflikty i wsparcie z zewnątrz", "Jeśli okoliczności się zmienią"], "sampleQuestions": ["Dlaczego rozważamy współrodzicielstwo?", "Co sprawiłoby, że zrezygnowalibyśmy z tego pomysłu?", "Czego każde z nas oczekuje od drugiej osoby jako rodzica?"], "disclaimer": "Ten szablon jest narzędziem do rozmowy, a nie dokumentem prawnym. Jego wypełnienie nie tworzy ani nie gwarantuje prawnego rodzicielstwa, odpowiedzialności rodzicielskiej, opieki ani praw finansowych. Sprawdź przepisy prawa obowiązujące Twoją rodzinę, zanim oprzesz się na czymkolwiek, co tu ustalicie."},
  },
  "co-parenting/questions-to-ask": {
    ru: {"title": "Вопросы потенциальному со-родителю", "description": "Практический список вопросов о воспитании, деньгах, общении и повседневной жизни.", "sections": ["Почему родительство?", "Повседневная жизнь", "Ценности в воспитании", "Деньги", "Отношения и границы", "Сложные ситуации", "Перед тем как двигаться дальше"], "sampleQuestions": ["Почему вы хотите стать родителем?", "Почему вы рассматриваете совместное родительство?", "Что для вас значит быть вовлечённым родителем?"], "disclaimer": "Этот ресурс предназначен для планирования и обсуждения. Это не юридическая, медицинская, психологическая или финансовая консультация. Правила и рекомендации специалистов различаются в зависимости от страны и индивидуальных обстоятельств."},
    es: {"title": "Preguntas para un posible co-padre o co-madre", "description": "Una lista práctica de preguntas sobre crianza, dinero, comunicación y vida cotidiana.", "sections": ["¿Por qué ser madre o padre?", "Vida cotidiana", "Valores de crianza", "Dinero", "Relaciones y límites", "Situaciones difíciles", "Antes de avanzar"], "sampleQuestions": ["¿Por qué quieres ser madre o padre?", "¿Por qué estás considerando la co-crianza?", "¿Qué significa para ti ser un progenitor implicado?"], "disclaimer": "Este recurso tiene fines de planificación y debate. No constituye asesoramiento legal, médico, psicológico ni financiero. Las normas y las recomendaciones profesionales varían según el país y las circunstancias individuales."},
    pt: {"title": "Perguntas a fazer a um potencial coparente", "description": "Uma lista prática de perguntas sobre educação, dinheiro, comunicação e vida quotidiana.", "sections": ["Porquê ser pai ou mãe?", "Vida quotidiana", "Valores de educação", "Dinheiro", "Relações e limites", "Situações difíceis", "Antes de avançar"], "sampleQuestions": ["Porque é que queres ser pai ou mãe?", "Porque é que estás a considerar a coparentalidade?", "O que significa para ti ser um pai ou mãe presente?"], "disclaimer": "Este recurso destina-se a fins de planeamento e discussão. Não constitui aconselhamento legal, médico, psicológico ou financeiro. As regras e as recomendações profissionais variam consoante o país e as circunstâncias individuais."},
    fr: {"title": "Questions à poser à un coparent potentiel", "description": "Une liste pratique de questions sur l'éducation, l'argent, la communication et la vie quotidienne.", "sections": ["Pourquoi devenir parent ?", "Vie quotidienne", "Valeurs éducatives", "Argent", "Relations et limites", "Situations difficiles", "Avant d'aller plus loin"], "sampleQuestions": ["Pourquoi voulez-vous devenir parent ?", "Pourquoi envisagez-vous la coparentalité ?", "Qu'est-ce qu'être un parent impliqué signifie pour vous ?"], "disclaimer": "Cette ressource est destinée à la planification et à la discussion. Elle ne constitue pas un conseil juridique, médical, psychologique ou financier. Les règles et les recommandations professionnelles varient selon le pays et la situation individuelle."},
    de: {"title": "Fragen an eine mögliche Co-Eltern-Person", "description": "Eine praktische Liste mit Fragen zu Erziehung, Geld, Kommunikation und Alltag.", "sections": ["Warum Elternschaft?", "Alltag", "Erziehungswerte", "Geld", "Beziehungen und Grenzen", "Schwierige Situationen", "Bevor es weitergeht"], "sampleQuestions": ["Warum möchtest du Elternteil werden?", "Warum ziehst du Co-Elternschaft in Betracht?", "Was bedeutet es für dich, ein aktiver Elternteil zu sein?"], "disclaimer": "Diese Ressource dient der Planung und Orientierung im Gespräch. Sie stellt keine rechtliche, medizinische, psychologische oder finanzielle Beratung dar. Regeln und fachliche Empfehlungen unterscheiden sich je nach Land und individueller Situation."},
    it: {"title": "Domande da fare a un potenziale co-genitore", "description": "Un elenco pratico di domande su educazione, denaro, comunicazione e vita quotidiana.", "sections": ["Perché la genitorialità?", "Vita quotidiana", "Valori educativi", "Denaro", "Relazioni e confini", "Situazioni difficili", "Prima di andare avanti"], "sampleQuestions": ["Perché desidera diventare genitore?", "Perché sta considerando la co-genitorialità?", "Cosa significa per Lei essere un genitore presente?"], "disclaimer": "Questa risorsa ha finalità di pianificazione e discussione. Non costituisce una consulenza legale, medica, psicologica o finanziaria. Le norme e le raccomandazioni professionali variano in base al Paese e alle circostanze individuali."},
    pl: {"title": "Pytania do potencjalnego współrodzica", "description": "Praktyczna lista pytań o wychowanie, pieniądze, komunikację i codzienne życie.", "sections": ["Dlaczego rodzicielstwo?", "Codzienne życie", "Wartości wychowawcze", "Pieniądze", "Relacje i granice", "Trudne sytuacje", "Zanim pójdziecie dalej"], "sampleQuestions": ["Dlaczego chcesz zostać rodzicem?", "Dlaczego rozważasz współrodzicielstwo?", "Co oznacza dla Ciebie bycie zaangażowanym rodzicem?"], "disclaimer": "Ten zasób służy do planowania i rozmowy. Nie stanowi porady prawnej, medycznej, psychologicznej ani finansowej. Zasady i zalecenia specjalistów różnią się w zależności od kraju i indywidualnej sytuacji."},
  },
  "co-parenting/first-meeting": {
    ru: {"title": "Первая встреча с потенциальным со-родителем", "description": "Что обсудить и на что обратить внимание при первой личной встрече.", "sections": ["Перед встречей", "Начните с общей картины", "Обратите внимание на свои ощущения", "Не обязательно решать всё сразу", "После встречи"], "sampleQuestions": ["Почему вы оба рассматриваете совместное родительство?", "Что для каждого из вас значит родительство?", "Какую семью вы надеетесь построить?"], "disclaimer": "Этот ресурс предназначен для планирования и обсуждения. Это не юридическая, медицинская, психологическая или финансовая консультация. Правила и рекомендации специалистов различаются в зависимости от страны и индивидуальных обстоятельств."},
    es: {"title": "Primer encuentro con un posible co-padre o co-madre", "description": "Qué tratar y qué observar en el primer encuentro en persona.", "sections": ["Antes del encuentro", "Empieza por el panorama general", "Fíjate en cómo te sientes", "No hace falta decidirlo todo", "Después del encuentro"], "sampleQuestions": ["¿Por qué se plantean la co-crianza?", "¿Qué significa la paternidad o maternidad para cada uno de ustedes?", "¿Qué tipo de familia esperan construir?"], "disclaimer": "Este recurso tiene fines de planificación y debate. No constituye asesoramiento legal, médico, psicológico ni financiero. Las normas y las recomendaciones profesionales varían según el país y las circunstancias individuales."},
    pt: {"title": "Primeiro encontro com um potencial coparente", "description": "O que abordar e a que prestar atenção no primeiro encontro presencial.", "sections": ["Antes do encontro", "Começa pelo panorama geral", "Repara em como te sentes", "Não precisas de decidir tudo", "Depois do encontro"], "sampleQuestions": ["Porque é que ambos estão a considerar a coparentalidade?", "O que significa a parentalidade para cada um de vocês?", "Que tipo de família esperam construir?"], "disclaimer": "Este recurso destina-se a fins de planeamento e discussão. Não constitui aconselhamento legal, médico, psicológico ou financeiro. As regras e as recomendações profissionais variam consoante o país e as circunstâncias individuais."},
    fr: {"title": "Première rencontre avec un coparent potentiel", "description": "Ce qu'il faut aborder et à quoi faire attention lors du premier rendez-vous en personne.", "sections": ["Avant la rencontre", "Commencez par la vue d'ensemble", "Soyez attentif à ce que vous ressentez", "Vous n'avez pas besoin de tout décider", "Après la rencontre"], "sampleQuestions": ["Pourquoi envisagez-vous tous les deux la coparentalité ?", "Que signifie la parentalité pour chacun de vous ?", "Quel type de famille espérez-vous construire ?"], "disclaimer": "Cette ressource est destinée à la planification et à la discussion. Elle ne constitue pas un conseil juridique, médical, psychologique ou financier. Les règles et les recommandations professionnelles varient selon le pays et la situation individuelle."},
    de: {"title": "Erstes Treffen mit einer möglichen Co-Eltern-Person", "description": "Worauf es beim ersten persönlichen Treffen ankommt und was ihr besprechen solltet.", "sections": ["Vor dem Treffen", "Beginne mit dem großen Ganzen", "Achte darauf, wie es sich anfühlt", "Du musst nicht alles entscheiden", "Nach dem Treffen"], "sampleQuestions": ["Warum zieht ihr beide Co-Elternschaft in Betracht?", "Was bedeutet Elternschaft für jeden von euch?", "Was für eine Familie möchtet ihr aufbauen?"], "disclaimer": "Diese Ressource dient der Planung und Orientierung im Gespräch. Sie stellt keine rechtliche, medizinische, psychologische oder finanzielle Beratung dar. Regeln und fachliche Empfehlungen unterscheiden sich je nach Land und individueller Situation."},
    it: {"title": "Primo incontro con un potenziale co-genitore", "description": "Cosa affrontare e a cosa prestare attenzione al primo incontro di persona.", "sections": ["Prima dell'incontro", "Inizi dal quadro generale", "Presti attenzione a come si sente", "Non deve decidere tutto subito", "Dopo l'incontro"], "sampleQuestions": ["Perché entrambi state considerando la co-genitorialità?", "Cosa significa la genitorialità per ciascuno di voi?", "Che tipo di famiglia sperate di costruire?"], "disclaimer": "Questa risorsa ha finalità di pianificazione e discussione. Non costituisce una consulenza legale, medica, psicologica o finanziaria. Le norme e le raccomandazioni professionali variano in base al Paese e alle circostanze individuali."},
    pl: {"title": "Pierwsze spotkanie z potencjalnym współrodzicem", "description": "Co poruszyć i na co zwrócić uwagę podczas pierwszego spotkania na żywo.", "sections": ["Przed spotkaniem", "Zacznij od ogólnego obrazu", "Zwróć uwagę na swoje odczucia", "Nie musisz wszystkiego decydować od razu", "Po spotkaniu"], "sampleQuestions": ["Dlaczego oboje rozważacie współrodzicielstwo?", "Co rodzicielstwo oznacza dla każdego z Was?", "Jaką rodzinę chcecie zbudować?"], "disclaimer": "Ten zasób służy do planowania i rozmowy. Nie stanowi porady prawnej, medycznej, psychologicznej ani finansowej. Zasady i zalecenia specjalistów różnią się w zależności od kraju i indywidualnej sytuacji."},
  },
  "co-parenting/red-flags-checklist": {
    ru: {"title": "Чек-лист тревожных сигналов в совместном родительстве", "description": "Признаки, на которые стоит обратить внимание, прежде чем решиться на совместное родительство с кем-то.", "sections": ["Давление", "Границы", "Общение", "Деньги", "Ответственность", "Безопасность", "Если что-то настораживает"], "sampleQuestions": ["Они подталкивают вас к быстрым важным решениям.", "Они давят на вас, используя возраст, сроки фертильности или страх упустить момент.", "Они игнорируют чёткое «нет»."], "disclaimer": "Этот ресурс предназначен для планирования и обсуждения. Это не юридическая, медицинская, психологическая или финансовая консультация. Правила и рекомендации специалистов различаются в зависимости от страны и индивидуальных обстоятельств."},
    es: {"title": "Checklist de señales de alerta en la co-crianza", "description": "Señales a las que merece la pena prestar atención antes de comprometerte a la co-crianza con alguien.", "sections": ["Presión", "Límites", "Comunicación", "Dinero", "Responsabilidad", "Seguridad", "Si algo no te cuadra"], "sampleQuestions": ["Te presiona para tomar decisiones importantes rápidamente.", "Usa la edad, los plazos de fertilidad o el miedo a quedarte sin tiempo para presionarte.", "Ignora un no claro."], "disclaimer": "Este recurso tiene fines de planificación y debate. No constituye asesoramiento legal, médico, psicológico ni financiero. Las normas y las recomendaciones profesionales varían según el país y las circunstancias individuales."},
    pt: {"title": "Checklist de sinais de alerta na coparentalidade", "description": "Sinais a que vale a pena prestar atenção antes de te comprometeres com a coparentalidade com alguém.", "sections": ["Pressão", "Limites", "Comunicação", "Dinheiro", "Responsabilidade", "Segurança", "Se algo parecer errado"], "sampleQuestions": ["Pressiona-te a tomar decisões importantes rapidamente.", "Usa a idade, os prazos de fertilidade ou o medo de ficar para trás para te pressionar.", "Ignora um não claro."], "disclaimer": "Este recurso destina-se a fins de planeamento e discussão. Não constitui aconselhamento legal, médico, psicológico ou financeiro. As regras e as recomendações profissionais variam consoante o país e as circunstâncias individuais."},
    fr: {"title": "Liste des signaux d'alerte en coparentalité", "description": "Des signes à surveiller avant de vous engager dans une coparentalité avec quelqu'un.", "sections": ["Pression", "Limites", "Communication", "Argent", "Responsabilité", "Sécurité", "Si quelque chose vous semble anormal"], "sampleQuestions": ["On vous pousse à prendre rapidement des décisions importantes.", "On utilise l'âge, les délais de fertilité ou la peur de rater sa chance pour vous mettre la pression.", "On ignore un refus clair."], "disclaimer": "Cette ressource est destinée à la planification et à la discussion. Elle ne constitue pas un conseil juridique, médical, psychologique ou financier. Les règles et les recommandations professionnelles varient selon le pays et la situation individuelle."},
    de: {"title": "Checkliste: Warnsignale bei der Co-Elternschaft", "description": "Anzeichen, auf die du achten solltest, bevor du dich mit jemandem auf eine Co-Elternschaft einlässt.", "sections": ["Druck", "Grenzen", "Kommunikation", "Geld", "Verantwortung", "Sicherheit", "Wenn sich etwas falsch anfühlt"], "sampleQuestions": ["Er oder sie drängt dich, wichtige Entscheidungen schnell zu treffen.", "Er oder sie nutzt Alter, den biologischen Zeitdruck oder die Angst, etwas zu verpassen, um dich unter Druck zu setzen.", "Er oder sie ignoriert ein klares Nein."], "disclaimer": "Diese Ressource dient der Planung und Orientierung im Gespräch. Sie stellt keine rechtliche, medizinische, psychologische oder finanzielle Beratung dar. Regeln und fachliche Empfehlungen unterscheiden sich je nach Land und individueller Situation."},
    it: {"title": "Checklist dei segnali d'allarme nella co-genitorialità", "description": "Segnali a cui prestare attenzione prima di impegnarsi nella co-genitorialità con qualcuno.", "sections": ["Pressione", "Confini", "Comunicazione", "Denaro", "Responsabilità", "Sicurezza", "Se qualcosa non convince"], "sampleQuestions": ["La spinge a prendere decisioni importanti in fretta.", "Usa l'età, i tempi della fertilità o la paura di perdere l'occasione per farLe pressione.", "Ignora un no chiaro."], "disclaimer": "Questa risorsa ha finalità di pianificazione e discussione. Non costituisce una consulenza legale, medica, psicologica o finanziaria. Le norme e le raccomandazioni professionali variano in base al Paese e alle circostanze individuali."},
    pl: {"title": "Lista ostrzegawczych sygnałów we współrodzicielstwie", "description": "Sygnały, na które warto zwrócić uwagę, zanim zdecydujesz się na współrodzicielstwo z kimś.", "sections": ["Presja", "Granice", "Komunikacja", "Pieniądze", "Odpowiedzialność", "Bezpieczeństwo", "Jeśli coś wydaje się nie tak"], "sampleQuestions": ["Naciska na Ciebie, żebyś szybko podejmował(a) ważne decyzje.", "Wykorzystuje wiek, czas na dziecko lub strach przed przegapieniem szansy, żeby wywrzeć na Tobie presję.", "Ignoruje wyraźne „nie”."], "disclaimer": "Ten zasób służy do planowania i rozmowy. Nie stanowi porady prawnej, medycznej, psychologicznej ani finansowej. Zasady i zalecenia specjalistów różnią się w zależności od kraju i indywidualnej sytuacji."},
  },
  "co-parenting/compatibility-scorecard": {
    ru: {"title": "Оценочная карта совместимости со-родителей", "description": "Простой способ отметить, в чём есть совпадения, а в чём нет, после первой встречи.", "sections": ["Оценка 1-5", "Вопросы, которые стоит задать себе", "Перед следующим шагом"], "sampleQuestions": ["Общение", "Уважение границ", "Ценности в воспитании"], "disclaimer": "Этот ресурс предназначен для планирования и обсуждения. Это не юридическая, медицинская, психологическая или финансовая консультация. Правила и рекомендации специалистов различаются в зависимости от страны и индивидуальных обстоятельств."},
    es: {"title": "Ficha de compatibilidad de co-crianza", "description": "Una forma sencilla de anotar en qué hay coincidencias y en qué no, después del primer encuentro.", "sections": ["Puntuación 1-5", "Preguntas para hacerte a ti mismo/a", "Antes de dar otro paso"], "sampleQuestions": ["Comunicación", "Respeto de los límites", "Valores de crianza"], "disclaimer": "Este recurso tiene fines de planificación y debate. No constituye asesoramiento legal, médico, psicológico ni financiero. Las normas y las recomendaciones profesionales varían según el país y las circunstancias individuales."},
    pt: {"title": "Ficha de compatibilidade de coparentalidade", "description": "Uma forma simples de registar onde há coincidências e onde não há, depois do primeiro encontro.", "sections": ["Pontuação 1-5", "Perguntas para te fazeres", "Antes de dares outro passo"], "sampleQuestions": ["Comunicação", "Respeito pelos limites", "Valores de educação"], "disclaimer": "Este recurso destina-se a fins de planeamento e discussão. Não constitui aconselhamento legal, médico, psicológico ou financeiro. As regras e as recomendações profissionais variam consoante o país e as circunstâncias individuais."},
    fr: {"title": "Fiche de compatibilité de coparentalité", "description": "Un moyen simple de noter les points d'accord et de désaccord après votre première rencontre.", "sections": ["Notation 1-5", "Questions à vous poser", "Avant d'aller plus loin"], "sampleQuestions": ["Communication", "Respect des limites", "Valeurs éducatives"], "disclaimer": "Cette ressource est destinée à la planification et à la discussion. Elle ne constitue pas un conseil juridique, médical, psychologique ou financier. Les règles et les recommandations professionnelles varient selon le pays et la situation individuelle."},
    de: {"title": "Kompatibilitäts-Scorecard für die Co-Elternschaft", "description": "Eine einfache Möglichkeit festzuhalten, wo ihr übereinstimmt und wo nicht, nach eurem ersten Treffen.", "sections": ["Bewertung 1-5", "Fragen an dich selbst", "Vor dem nächsten Schritt"], "sampleQuestions": ["Kommunikation", "Respekt für Grenzen", "Erziehungswerte"], "disclaimer": "Diese Ressource dient der Planung und Orientierung im Gespräch. Sie stellt keine rechtliche, medizinische, psychologische oder finanzielle Beratung dar. Regeln und fachliche Empfehlungen unterscheiden sich je nach Land und individueller Situation."},
    it: {"title": "Scheda di compatibilità per la co-genitorialità", "description": "Un modo semplice per annotare dove c'è sintonia e dove no, dopo il primo incontro.", "sections": ["Valutazione 1-5", "Domande da porsi", "Prima di un altro passo"], "sampleQuestions": ["Comunicazione", "Rispetto dei confini", "Valori educativi"], "disclaimer": "Questa risorsa ha finalità di pianificazione e discussione. Non costituisce una consulenza legale, medica, psicologica o finanziaria. Le norme e le raccomandazioni professionali variano in base al Paese e alle circostanze individuali."},
    pl: {"title": "Karta kompatybilności ze współrodzicem", "description": "Prosty sposób na zanotowanie, w czym się zgadzacie, a w czym nie, po pierwszym spotkaniu.", "sections": ["Ocena 1-5", "Pytania, które warto sobie zadać", "Przed kolejnym krokiem"], "sampleQuestions": ["Komunikacja", "Szacunek dla granic", "Wartości wychowawcze"], "disclaimer": "Ten zasób służy do planowania i rozmowy. Nie stanowi porady prawnej, medycznej, psychologicznej ani finansowej. Zasady i zalecenia specjalistów różnią się w zależności od kraju i indywidualnej sytuacji."},
  },
  "co-parenting/parenting-values-worksheet": {
    ru: {"title": "Рабочий лист родительских ценностей", "description": "Определите собственные родительские ценности, прежде чем сравнивать их с чужими.", "sections": ["Что важнее всего", "Повседневное воспитание", "Образование и идентичность", "Деньги и семья", "Когда мы не согласны"], "sampleQuestions": ["Три вещи, которые я больше всего хочу дать своему ребёнку:", "Ценности, которые я хочу показывать своим примером:", "Каким родителем я надеюсь быть:"], "disclaimer": "Этот ресурс предназначен для планирования и обсуждения. Это не юридическая, медицинская, психологическая или финансовая консультация. Правила и рекомендации специалистов различаются в зависимости от страны и индивидуальных обстоятельств."},
    es: {"title": "Hoja de trabajo de valores de crianza", "description": "Aclara tus propios valores de crianza antes de compararlos con los de otra persona.", "sections": ["Lo que más importa", "Crianza cotidiana", "Educación e identidad", "Dinero y familia", "Cuando no estamos de acuerdo"], "sampleQuestions": ["Las tres cosas que más quiero que mi hijo o hija experimente son:", "Los valores que quiero transmitir con el ejemplo son:", "El tipo de madre o padre que espero ser es:"], "disclaimer": "Este recurso tiene fines de planificación y debate. No constituye asesoramiento legal, médico, psicológico ni financiero. Las normas y las recomendaciones profesionales varían según el país y las circunstancias individuales."},
    pt: {"title": "Folha de trabalho de valores de educação", "description": "Esclarece os teus próprios valores de educação antes de os comparares com os de outra pessoa.", "sections": ["O que importa mais", "Parentalidade do dia a dia", "Educação e identidade", "Dinheiro e família", "Quando discordamos"], "sampleQuestions": ["As três coisas que mais quero que o meu filho ou filha viva são:", "Os valores que quero transmitir pelo exemplo são:", "O tipo de pai ou mãe que espero ser é:"], "disclaimer": "Este recurso destina-se a fins de planeamento e discussão. Não constitui aconselhamento legal, médico, psicológico ou financeiro. As regras e as recomendações profissionais variam consoante o país e as circunstâncias individuais."},
    fr: {"title": "Fiche de travail sur les valeurs éducatives", "description": "Clarifiez vos propres valeurs éducatives avant de les comparer à celles de quelqu'un d'autre.", "sections": ["Ce qui compte le plus", "La parentalité au quotidien", "Éducation et identité", "Argent et famille", "Quand nous ne sommes pas d'accord"], "sampleQuestions": ["Les trois choses que je veux le plus que mon enfant vive sont :", "Les valeurs que je veux transmettre par l'exemple sont :", "Le type de parent que j'espère être est :"], "disclaimer": "Cette ressource est destinée à la planification et à la discussion. Elle ne constitue pas un conseil juridique, médical, psychologique ou financier. Les règles et les recommandations professionnelles varient selon le pays et la situation individuelle."},
    de: {"title": "Arbeitsblatt zu Erziehungswerten", "description": "Kläre deine eigenen Erziehungswerte, bevor du sie mit denen einer anderen Person vergleichst.", "sections": ["Was am wichtigsten ist", "Erziehung im Alltag", "Bildung und Identität", "Geld und Familie", "Wenn wir unterschiedlicher Meinung sind"], "sampleQuestions": ["Die drei Dinge, die mein Kind am meisten erleben soll, sind:", "Die Werte, die ich vorleben möchte, sind:", "Die Art von Elternteil, die ich sein möchte, ist:"], "disclaimer": "Diese Ressource dient der Planung und Orientierung im Gespräch. Sie stellt keine rechtliche, medizinische, psychologische oder finanzielle Beratung dar. Regeln und fachliche Empfehlungen unterscheiden sich je nach Land und individueller Situation."},
    it: {"title": "Scheda di lavoro sui valori educativi", "description": "Chiarisca i propri valori educativi prima di confrontarli con quelli di qualcun altro.", "sections": ["Ciò che conta di più", "Genitorialità quotidiana", "Istruzione e identità", "Denaro e famiglia", "Quando non siamo d'accordo"], "sampleQuestions": ["Le tre cose che desidero di più far vivere a mio figlio o mia figlia sono:", "I valori che voglio trasmettere con l'esempio sono:", "Il tipo di genitore che spero di essere è:"], "disclaimer": "Questa risorsa ha finalità di pianificazione e discussione. Non costituisce una consulenza legale, medica, psicologica o finanziaria. Le norme e le raccomandazioni professionali variano in base al Paese e alle circostanze individuali."},
    pl: {"title": "Arkusz wartości wychowawczych", "description": "Określ swoje własne wartości wychowawcze, zanim porównasz je z wartościami kogoś innego.", "sections": ["Co jest najważniejsze", "Codzienne rodzicielstwo", "Edukacja i tożsamość", "Pieniądze i rodzina", "Gdy się nie zgadzamy"], "sampleQuestions": ["Trzy rzeczy, których najbardziej chcę, by doświadczyło moje dziecko, to:", "Wartości, które chcę przekazywać własnym przykładem, to:", "Rodzicem, jakim mam nadzieję być, jest:"], "disclaimer": "Ten zasób służy do planowania i rozmowy. Nie stanowi porady prawnej, medycznej, psychologicznej ani finansowej. Zasady i zalecenia specjalistów różnią się w zależności od kraju i indywidualnej sytuacji."},
  },
  "fertility-donor/fertility-consultation-questions": {
    ru: {"title": "Вопросы для консультации по фертильности", "description": "Вопросы, которые стоит задать на первой консультации в клинике репродуктивной медицины.", "sections": ["Понимание своих вариантов", "Успех и ожидания", "Риски и медикаменты", "Стоимость", "Если лечение не сработает", "Поддержка", "Донорское зачатие"], "sampleQuestions": ["Почему вы рекомендуете именно это лечение?", "Какие есть альтернативы?", "Какие факторы моей истории повлияли на эту рекомендацию?"], "disclaimer": "Этот ресурс предназначен для планирования и обсуждения. Это не юридическая, медицинская, психологическая или финансовая консультация. Правила и рекомендации специалистов различаются в зависимости от страны и индивидуальных обстоятельств."},
    es: {"title": "Preguntas para la consulta de fertilidad", "description": "Preguntas que vale la pena llevar a tu primera consulta con una clínica de fertilidad.", "sections": ["Entender tus opciones", "Éxito y expectativas", "Riesgos y medicación", "Coste", "Si el tratamiento no funciona", "Apoyo", "Concepción con donante"], "sampleQuestions": ["¿Por qué recomienda este tratamiento?", "¿Qué alternativas hay disponibles?", "¿Qué factores de mi historial influyen en la recomendación?"], "disclaimer": "Este recurso tiene fines de planificación y debate. No constituye asesoramiento legal, médico, psicológico ni financiero. Las normas y las recomendaciones profesionales varían según el país y las circunstancias individuales."},
    pt: {"title": "Perguntas para a consulta de fertilidade", "description": "Perguntas que vale a pena levar à tua primeira consulta numa clínica de fertilidade.", "sections": ["Compreender as tuas opções", "Sucesso e expectativas", "Riscos e medicação", "Custo", "Se o tratamento não resultar", "Apoio", "Conceção com dador"], "sampleQuestions": ["Porque é que recomenda este tratamento?", "Que alternativas existem?", "Que fatores do meu historial influenciam esta recomendação?"], "disclaimer": "Este recurso destina-se a fins de planeamento e discussão. Não constitui aconselhamento legal, médico, psicológico ou financeiro. As regras e as recomendações profissionais variam consoante o país e as circunstâncias individuais."},
    fr: {"title": "Questions pour la consultation de fertilité", "description": "Des questions à poser lors de votre première consultation dans une clinique de fertilité.", "sections": ["Comprendre vos options", "Réussite et attentes", "Risques et médicaments", "Coût", "Si le traitement ne fonctionne pas", "Soutien", "Conception avec don de gamètes"], "sampleQuestions": ["Pourquoi recommandez-vous ce traitement ?", "Quelles alternatives existent ?", "Quels éléments de mes antécédents influencent cette recommandation ?"], "disclaimer": "Cette ressource est destinée à la planification et à la discussion. Elle ne constitue pas un conseil juridique, médical, psychologique ou financier. Les règles et les recommandations professionnelles varient selon le pays et la situation individuelle."},
    de: {"title": "Fragen für die Kinderwunschberatung", "description": "Fragen, die sich für die erste Beratung in einer Kinderwunschklinik lohnen.", "sections": ["Deine Optionen verstehen", "Erfolg und Erwartungen", "Risiken und Medikamente", "Kosten", "Wenn die Behandlung nicht wirkt", "Unterstützung", "Samen-/Eizellspende"], "sampleQuestions": ["Warum empfehlen Sie diese Behandlung?", "Welche Alternativen gibt es?", "Welche Faktoren in meiner Vorgeschichte beeinflussen die Empfehlung?"], "disclaimer": "Diese Ressource dient der Planung und Orientierung im Gespräch. Sie stellt keine rechtliche, medizinische, psychologische oder finanzielle Beratung dar. Regeln und fachliche Empfehlungen unterscheiden sich je nach Land und individueller Situation."},
    it: {"title": "Domande per la consulenza sulla fertilità", "description": "Domande da portare al primo colloquio con una clinica della fertilità.", "sections": ["Comprendere le proprie opzioni", "Successo e aspettative", "Rischi e farmaci", "Costo", "Se il trattamento non funziona", "Supporto", "Fecondazione da donatore"], "sampleQuestions": ["Perché consiglia questo trattamento?", "Quali alternative sono disponibili?", "Quali fattori della mia storia influenzano questa raccomandazione?"], "disclaimer": "Questa risorsa ha finalità di pianificazione e discussione. Non costituisce una consulenza legale, medica, psicologica o finanziaria. Le norme e le raccomandazioni professionali variano in base al Paese e alle circostanze individuali."},
    pl: {"title": "Pytania na konsultację dotyczącą płodności", "description": "Pytania, które warto zabrać na pierwszą konsultację w klinice leczenia niepłodności.", "sections": ["Poznanie swoich opcji", "Skuteczność i oczekiwania", "Ryzyko i leki", "Koszt", "Jeśli leczenie nie zadziała", "Wsparcie", "Poczęcie z dawstwa"], "sampleQuestions": ["Dlaczego zaleca Pan/Pani to leczenie?", "Jakie są dostępne alternatywy?", "Jakie czynniki z mojej historii wpływają na tę rekomendację?"], "disclaimer": "Ten zasób służy do planowania i rozmowy. Nie stanowi porady prawnej, medycznej, psychologicznej ani finansowej. Zasady i zalecenia specjalistów różnią się w zależności od kraju i indywidualnej sytuacji."},
  },
  "fertility-donor/donor-conception-questions": {
    ru: {"title": "Чек-лист вопросов о донорском зачатии", "description": "Что стоит спросить и обдумать, прежде чем выбрать донорское зачатие.", "sections": ["О доноре", "Клиника и лечение", "Известный донор", "Разговор с ребёнком", "Юридические вопросы и вопросы на будущее"], "sampleQuestions": ["Какая информация доступна?", "Какие медицинские и генетические обследования были проведены?", "К какой информации сможет получить доступ будущий ребёнок?"], "disclaimer": "Этот ресурс предназначен для планирования и обсуждения. Это не юридическая, медицинская, психологическая или финансовая консультация. Правила и рекомендации специалистов различаются в зависимости от страны и индивидуальных обстоятельств."},
    es: {"title": "Checklist de preguntas sobre la concepción con donante", "description": "Qué preguntar y qué pensar antes de elegir la concepción con donante.", "sections": ["Sobre el donante", "Clínica y tratamiento", "Donante conocido", "Hablar con tu hijo o hija", "Preguntas legales y de futuro"], "sampleQuestions": ["¿Qué información hay disponible?", "¿Qué pruebas médicas y genéticas se han realizado?", "¿A qué información podrá acceder el futuro hijo o hija?"], "disclaimer": "Este recurso tiene fines de planificación y debate. No constituye asesoramiento legal, médico, psicológico ni financiero. Las normas y las recomendaciones profesionales varían según el país y las circunstancias individuales."},
    pt: {"title": "Checklist de perguntas sobre conceção com dador", "description": "O que perguntar e pensar antes de escolher a conceção com dador.", "sections": ["Sobre o dador", "Clínica e tratamento", "Dador conhecido", "Falar com o teu filho ou filha", "Questões legais e futuras"], "sampleQuestions": ["Que informação está disponível?", "Que rastreios médicos e genéticos foram realizados?", "A que informação pode aceder o futuro filho ou filha?"], "disclaimer": "Este recurso destina-se a fins de planeamento e discussão. Não constitui aconselhamento legal, médico, psicológico ou financeiro. As regras e as recomendações profissionais variam consoante o país e as circunstâncias individuais."},
    fr: {"title": "Liste de questions sur la conception avec don de gamètes", "description": "Ce qu'il faut demander et réfléchir avant de choisir la conception avec don de gamètes.", "sections": ["À propos du donneur", "Clinique et traitement", "Donneur connu", "Parler à votre enfant", "Questions juridiques et futures"], "sampleQuestions": ["Quelles informations sont disponibles ?", "Quels dépistages médicaux et génétiques ont été réalisés ?", "À quelles informations le futur enfant pourra-t-il accéder ?"], "disclaimer": "Cette ressource est destinée à la planification et à la discussion. Elle ne constitue pas un conseil juridique, médical, psychologique ou financier. Les règles et les recommandations professionnelles varient selon le pays et la situation individuelle."},
    de: {"title": "Checkliste: Fragen zur Samen-/Eizellspende", "description": "Was du fragen und bedenken solltest, bevor du dich für eine Samen-/Eizellspende entscheidest.", "sections": ["Über den Spender", "Klinik und Behandlung", "Bekannter Spender", "Mit deinem Kind sprechen", "Rechtliche und zukünftige Fragen"], "sampleQuestions": ["Welche Informationen sind verfügbar?", "Welche medizinischen und genetischen Untersuchungen wurden durchgeführt?", "Auf welche Informationen kann das zukünftige Kind zugreifen?"], "disclaimer": "Diese Ressource dient der Planung und Orientierung im Gespräch. Sie stellt keine rechtliche, medizinische, psychologische oder finanzielle Beratung dar. Regeln und fachliche Empfehlungen unterscheiden sich je nach Land und individueller Situation."},
    it: {"title": "Checklist di domande sulla fecondazione da donatore", "description": "Cosa chiedere e su cosa riflettere prima di scegliere la fecondazione da donatore.", "sections": ["Informazioni sul donatore", "Clinica e trattamento", "Donatore conosciuto", "Parlare con il proprio figlio o la propria figlia", "Questioni legali e future"], "sampleQuestions": ["Quali informazioni sono disponibili?", "Quali controlli medici e genetici sono stati effettuati?", "A quali informazioni potrà accedere il futuro figlio o la futura figlia?"], "disclaimer": "Questa risorsa ha finalità di pianificazione e discussione. Non costituisce una consulenza legale, medica, psicologica o finanziaria. Le norme e le raccomandazioni professionali variano in base al Paese e alle circostanze individuali."},
    pl: {"title": "Lista pytań o poczęcie z dawstwa", "description": "O co zapytać i nad czym się zastanowić przed wyborem poczęcia z dawstwa.", "sections": ["O dawcy", "Klinika i leczenie", "Znany dawca", "Rozmowa z dzieckiem", "Kwestie prawne i przyszłe pytania"], "sampleQuestions": ["Jakie informacje są dostępne?", "Jakie badania medyczne i genetyczne zostały wykonane?", "Do jakich informacji będzie mogło mieć dostęp przyszłe dziecko?"], "disclaimer": "Ten zasób służy do planowania i rozmowy. Nie stanowi porady prawnej, medycznej, psychologicznej ani finansowej. Zasady i zalecenia specjalistów różnią się w zależności od kraju i indywidualnej sytuacji."},
  },
  "fertility-donor/fertility-clinic-checklist": {
    ru: {"title": "Чек-лист выбора клиники репродуктивной медицины", "description": "Что сравнивать при выборе между клиниками репродуктивной медицины.", "sections": ["Регулирование и безопасность", "Лечение и доказательная база", "Стоимость", "Поддержка", "Лечение за границей"], "sampleQuestions": ["Правильно ли регулируется деятельность клиники?", "Какие стандарты качества и безопасности применяются?", "Как организованы лаборатории и хранение?"], "disclaimer": "Этот ресурс предназначен для планирования и обсуждения. Это не юридическая, медицинская, психологическая или финансовая консультация. Правила и рекомендации специалистов различаются в зависимости от страны и индивидуальных обстоятельств."},
    es: {"title": "Checklist para elegir una clínica de fertilidad", "description": "Qué comparar cuando estás decidiendo entre clínicas de fertilidad.", "sections": ["Regulación y seguridad", "Tratamiento y evidencia", "Costes", "Apoyo", "Tratamiento en el extranjero"], "sampleQuestions": ["¿Está la clínica debidamente regulada?", "¿Qué estándares de calidad y seguridad se aplican?", "¿Cómo se gestionan los laboratorios y el almacenamiento?"], "disclaimer": "Este recurso tiene fines de planificación y debate. No constituye asesoramiento legal, médico, psicológico ni financiero. Las normas y las recomendaciones profesionales varían según el país y las circunstancias individuales."},
    pt: {"title": "Checklist para escolher uma clínica de fertilidade", "description": "O que comparar quando estás a decidir entre clínicas de fertilidade.", "sections": ["Regulação e segurança", "Tratamento e evidência", "Custos", "Apoio", "Tratamento no estrangeiro"], "sampleQuestions": ["A clínica está devidamente regulada?", "Que padrões de qualidade e segurança se aplicam?", "Como são geridos os laboratórios e o armazenamento?"], "disclaimer": "Este recurso destina-se a fins de planeamento e discussão. Não constitui aconselhamento legal, médico, psicológico ou financeiro. As regras e as recomendações profissionais variam consoante o país e as circunstâncias individuais."},
    fr: {"title": "Liste de contrôle pour choisir une clinique de fertilité", "description": "Ce qu'il faut comparer lorsque vous choisissez entre plusieurs cliniques de fertilité.", "sections": ["Réglementation et sécurité", "Traitement et données probantes", "Coûts", "Soutien", "Traitement à l'étranger"], "sampleQuestions": ["La clinique est-elle correctement réglementée ?", "Quelles normes de qualité et de sécurité s'appliquent ?", "Comment les laboratoires et le stockage sont-ils gérés ?"], "disclaimer": "Cette ressource est destinée à la planification et à la discussion. Elle ne constitue pas un conseil juridique, médical, psychologique ou financier. Les règles et les recommandations professionnelles varient selon le pays et la situation individuelle."},
    de: {"title": "Checkliste zur Wahl einer Kinderwunschklinik", "description": "Was du vergleichen solltest, wenn du dich zwischen Kinderwunschkliniken entscheidest.", "sections": ["Regulierung und Sicherheit", "Behandlung und Evidenz", "Kosten", "Unterstützung", "Behandlung im Ausland"], "sampleQuestions": ["Ist die Klinik ordnungsgemäß reguliert?", "Welche Qualitäts- und Sicherheitsstandards gelten?", "Wie werden Labore und Lagerung verwaltet?"], "disclaimer": "Diese Ressource dient der Planung und Orientierung im Gespräch. Sie stellt keine rechtliche, medizinische, psychologische oder finanzielle Beratung dar. Regeln und fachliche Empfehlungen unterscheiden sich je nach Land und individueller Situation."},
    it: {"title": "Checklist per scegliere una clinica della fertilità", "description": "Cosa confrontare quando si sceglie tra diverse cliniche della fertilità.", "sections": ["Regolamentazione e sicurezza", "Trattamento ed evidenze", "Costi", "Supporto", "Trattamento all'estero"], "sampleQuestions": ["La clinica è regolamentata correttamente?", "Quali standard di qualità e sicurezza si applicano?", "Come vengono gestiti i laboratori e la conservazione?"], "disclaimer": "Questa risorsa ha finalità di pianificazione e discussione. Non costituisce una consulenza legale, medica, psicologica o finanziaria. Le norme e le raccomandazioni professionali variano in base al Paese e alle circostanze individuali."},
    pl: {"title": "Lista kontrolna wyboru kliniki leczenia niepłodności", "description": "Co porównać, decydując się między klinikami leczenia niepłodności.", "sections": ["Regulacje i bezpieczeństwo", "Leczenie i dowody naukowe", "Koszty", "Wsparcie", "Leczenie za granicą"], "sampleQuestions": ["Czy klinika jest odpowiednio regulowana?", "Jakie standardy jakości i bezpieczeństwa obowiązują?", "Jak zarządza się laboratoriami i przechowywaniem?"], "disclaimer": "Ten zasób służy do planowania i rozmowy. Nie stanowi porady prawnej, medycznej, psychologicznej ani finansowej. Zasady i zalecenia specjalistów różnią się w zależności od kraju i indywidualnej sytuacji."},
  },
  "parenthood-planning/financial-planning": {
    ru: {"title": "Финансовое планирование для будущих родителей", "description": "Рабочий лист, который поможет продумать расходы на создание и воспитание семьи.", "sections": ["До беременности или лечения", "Беременность и роды", "Первый год", "Общие расходы", "Финансовые изменения"], "sampleQuestions": ["Какие расходы стоит делить поровну?", "Какие расходы стоит делить пропорционально доходу?", "Что произойдёт, если доход изменится?"], "disclaimer": "Этот ресурс предназначен для планирования и обсуждения. Это не юридическая, медицинская, психологическая или финансовая консультация. Правила и рекомендации специалистов различаются в зависимости от страны и индивидуальных обстоятельств."},
    es: {"title": "Planificación financiera para futuros padres y madres", "description": "Una hoja de trabajo para pensar en el coste de formar y criar una familia.", "sections": ["Antes del embarazo o el tratamiento", "Embarazo y parto", "Primer año", "Gastos compartidos", "Cambios financieros"], "sampleQuestions": ["¿Qué costes deberían repartirse a partes iguales?", "¿Qué costes deberían dividirse según los ingresos?", "¿Qué pasa si cambian los ingresos?"], "disclaimer": "Este recurso tiene fines de planificación y debate. No constituye asesoramiento legal, médico, psicológico ni financiero. Las normas y las recomendaciones profesionales varían según el país y las circunstancias individuales."},
    pt: {"title": "Planeamento financeiro para futuros pais", "description": "Uma folha de trabalho para pensares no custo de construir e criar uma família.", "sections": ["Antes da gravidez ou do tratamento", "Gravidez e parto", "Primeiro ano", "Despesas partilhadas", "Alterações financeiras"], "sampleQuestions": ["Que custos devem ser divididos igualmente?", "Que custos devem ser divididos consoante o rendimento?", "O que acontece se o rendimento mudar?"], "disclaimer": "Este recurso destina-se a fins de planeamento e discussão. Não constitui aconselhamento legal, médico, psicológico ou financeiro. As regras e as recomendações profissionais variam consoante o país e as circunstâncias individuais."},
    fr: {"title": "Planification financière pour futurs parents", "description": "Une fiche de travail pour réfléchir au coût de la construction et de l'éducation d'une famille.", "sections": ["Avant la grossesse ou le traitement", "Grossesse et naissance", "Première année", "Dépenses partagées", "Changements financiers"], "sampleQuestions": ["Quels coûts doivent être partagés à parts égales ?", "Quels coûts doivent être répartis selon les revenus ?", "Que se passe-t-il si les revenus changent ?"], "disclaimer": "Cette ressource est destinée à la planification et à la discussion. Elle ne constitue pas un conseil juridique, médical, psychologique ou financier. Les règles et les recommandations professionnelles varient selon le pays et la situation individuelle."},
    de: {"title": "Finanzplanung für zukünftige Eltern", "description": "Ein Arbeitsblatt, um die Kosten für den Aufbau und die Erziehung einer Familie durchzudenken.", "sections": ["Vor Schwangerschaft oder Behandlung", "Schwangerschaft und Geburt", "Erstes Jahr", "Gemeinsame Ausgaben", "Finanzielle Veränderungen"], "sampleQuestions": ["Welche Kosten sollten gleich aufgeteilt werden?", "Welche Kosten sollten nach Einkommen aufgeteilt werden?", "Was passiert, wenn sich das Einkommen ändert?"], "disclaimer": "Diese Ressource dient der Planung und Orientierung im Gespräch. Sie stellt keine rechtliche, medizinische, psychologische oder finanzielle Beratung dar. Regeln und fachliche Empfehlungen unterscheiden sich je nach Land und individueller Situation."},
    it: {"title": "Pianificazione finanziaria per futuri genitori", "description": "Una scheda di lavoro per riflettere sul costo di costruire e crescere una famiglia.", "sections": ["Prima della gravidanza o del trattamento", "Gravidanza e parto", "Primo anno", "Spese condivise", "Cambiamenti finanziari"], "sampleQuestions": ["Quali costi dovrebbero essere condivisi in parti uguali?", "Quali costi dovrebbero essere suddivisi in base al reddito?", "Cosa succede se il reddito cambia?"], "disclaimer": "Questa risorsa ha finalità di pianificazione e discussione. Non costituisce una consulenza legale, medica, psicologica o finanziaria. Le norme e le raccomandazioni professionali variano in base al Paese e alle circostanze individuali."},
    pl: {"title": "Planowanie finansowe dla przyszłych rodziców", "description": "Arkusz do przemyślenia kosztów założenia i wychowania rodziny.", "sections": ["Przed ciążą lub leczeniem", "Ciąża i poród", "Pierwszy rok", "Wspólne wydatki", "Zmiany finansowe"], "sampleQuestions": ["Które koszty powinny być dzielone po równo?", "Które koszty powinny być dzielone proporcjonalnie do dochodów?", "Co się stanie, jeśli dochody się zmienią?"], "disclaimer": "Ten zasób służy do planowania i rozmowy. Nie stanowi porady prawnej, medycznej, psychologicznej ani finansowej. Zasady i zalecenia specjalistów różnią się w zależności od kraju i indywidualnej sytuacji."},
  },
  "parenthood-planning/parenting-values-worksheet": {
    ru: {"title": "Рабочий лист родительских ценностей", "description": "Определите собственные родительские ценности, прежде чем сравнивать их с чужими.", "sections": ["Что важнее всего", "Повседневное воспитание", "Образование и идентичность", "Деньги и семья", "Когда мы не согласны"], "sampleQuestions": ["Три вещи, которые я больше всего хочу дать своему ребёнку:", "Ценности, которые я хочу показывать своим примером:", "Каким родителем я надеюсь быть:"], "disclaimer": "Этот ресурс предназначен для планирования и обсуждения. Это не юридическая, медицинская, психологическая или финансовая консультация. Правила и рекомендации специалистов различаются в зависимости от страны и индивидуальных обстоятельств."},
    es: {"title": "Hoja de trabajo de valores de crianza", "description": "Aclara tus propios valores de crianza antes de compararlos con los de otra persona.", "sections": ["Lo que más importa", "Crianza cotidiana", "Educación e identidad", "Dinero y familia", "Cuando no estamos de acuerdo"], "sampleQuestions": ["Las tres cosas que más quiero que mi hijo o hija experimente son:", "Los valores que quiero transmitir con el ejemplo son:", "El tipo de madre o padre que espero ser es:"], "disclaimer": "Este recurso tiene fines de planificación y debate. No constituye asesoramiento legal, médico, psicológico ni financiero. Las normas y las recomendaciones profesionales varían según el país y las circunstancias individuales."},
    pt: {"title": "Folha de trabalho de valores de educação", "description": "Esclarece os teus próprios valores de educação antes de os comparares com os de outra pessoa.", "sections": ["O que importa mais", "Parentalidade do dia a dia", "Educação e identidade", "Dinheiro e família", "Quando discordamos"], "sampleQuestions": ["As três coisas que mais quero que o meu filho ou filha viva são:", "Os valores que quero transmitir pelo exemplo são:", "O tipo de pai ou mãe que espero ser é:"], "disclaimer": "Este recurso destina-se a fins de planeamento e discussão. Não constitui aconselhamento legal, médico, psicológico ou financeiro. As regras e as recomendações profissionais variam consoante o país e as circunstâncias individuais."},
    fr: {"title": "Fiche de travail sur les valeurs éducatives", "description": "Clarifiez vos propres valeurs éducatives avant de les comparer à celles de quelqu'un d'autre.", "sections": ["Ce qui compte le plus", "La parentalité au quotidien", "Éducation et identité", "Argent et famille", "Quand nous ne sommes pas d'accord"], "sampleQuestions": ["Les trois choses que je veux le plus que mon enfant vive sont :", "Les valeurs que je veux transmettre par l'exemple sont :", "Le type de parent que j'espère être est :"], "disclaimer": "Cette ressource est destinée à la planification et à la discussion. Elle ne constitue pas un conseil juridique, médical, psychologique ou financier. Les règles et les recommandations professionnelles varient selon le pays et la situation individuelle."},
    de: {"title": "Arbeitsblatt zu Erziehungswerten", "description": "Kläre deine eigenen Erziehungswerte, bevor du sie mit denen einer anderen Person vergleichst.", "sections": ["Was am wichtigsten ist", "Erziehung im Alltag", "Bildung und Identität", "Geld und Familie", "Wenn wir unterschiedlicher Meinung sind"], "sampleQuestions": ["Die drei Dinge, die mein Kind am meisten erleben soll, sind:", "Die Werte, die ich vorleben möchte, sind:", "Die Art von Elternteil, die ich sein möchte, ist:"], "disclaimer": "Diese Ressource dient der Planung und Orientierung im Gespräch. Sie stellt keine rechtliche, medizinische, psychologische oder finanzielle Beratung dar. Regeln und fachliche Empfehlungen unterscheiden sich je nach Land und individueller Situation."},
    it: {"title": "Scheda di lavoro sui valori educativi", "description": "Chiarisca i propri valori educativi prima di confrontarli con quelli di qualcun altro.", "sections": ["Ciò che conta di più", "Genitorialità quotidiana", "Istruzione e identità", "Denaro e famiglia", "Quando non siamo d'accordo"], "sampleQuestions": ["Le tre cose che desidero di più far vivere a mio figlio o mia figlia sono:", "I valori che voglio trasmettere con l'esempio sono:", "Il tipo di genitore che spero di essere è:"], "disclaimer": "Questa risorsa ha finalità di pianificazione e discussione. Non costituisce una consulenza legale, medica, psicologica o finanziaria. Le norme e le raccomandazioni professionali variano in base al Paese e alle circostanze individuali."},
    pl: {"title": "Arkusz wartości wychowawczych", "description": "Określ swoje własne wartości wychowawcze, zanim porównasz je z wartościami kogoś innego.", "sections": ["Co jest najważniejsze", "Codzienne rodzicielstwo", "Edukacja i tożsamość", "Pieniądze i rodzina", "Gdy się nie zgadzamy"], "sampleQuestions": ["Trzy rzeczy, których najbardziej chcę, by doświadczyło moje dziecko, to:", "Wartości, które chcę przekazywać własnym przykładem, to:", "Rodzicem, jakim mam nadzieję być, jest:"], "disclaimer": "Ten zasób służy do planowania i rozmowy. Nie stanowi porady prawnej, medycznej, psychologicznej ani finansowej. Zasady i zalecenia specjalistów różnią się w zależności od kraju i indywidualnej sytuacji."},
  },
};

export function localizedCategory(cat: ResourceCategoryData, locale: Locale): ResourceCategoryData {
  const t = RESOURCES_CATEGORIES_I18N[cat.slug]?.[locale];
  if (!t) return cat;
  return { ...cat, eyebrow: t.eyebrow, title: t.title, description: t.description, disclaimer: t.disclaimer ?? cat.disclaimer };
}

export function localizedDownloadUrl(downloadUrl: string | undefined, locale: Locale): string | undefined {
  if (!downloadUrl || locale === "en") return downloadUrl;
  const marker = "/web-static/resources/";
  const index = downloadUrl.indexOf(marker);
  if (index === -1) return downloadUrl;
  return `${downloadUrl.slice(0, index + marker.length)}${locale}/${downloadUrl.slice(index + marker.length)}`;
}

export function localizedTool(cat: ResourceCategoryData, tool: ResourceTool, locale: Locale): ResourceTool {
  const t = RESOURCES_TOOLS_I18N[`${cat.slug}/${tool.slug}`]?.[locale];
  const downloadUrl = localizedDownloadUrl(t?.downloadUrl ?? tool.downloadUrl, locale);
  if (!t) return downloadUrl === tool.downloadUrl ? tool : { ...tool, downloadUrl };
  return { ...tool, title: t.title, description: t.description, sections: t.sections ?? tool.sections, sampleQuestions: t.sampleQuestions ?? tool.sampleQuestions, disclaimer: t.disclaimer ?? tool.disclaimer, downloadUrl };
}

// tool.format was previously a hardcoded English string like ".docx · 10 sections · free";
// it's always exactly derivable from sections.length, so it's computed per-locale here instead
// of being stored as a 5th translated field per tool (which would have needed a plural
// form per tool per language, since the count is baked in - this keeps one small pluralization
// helper instead of ~440 extra translated strings).
export function resourceSectionsWord(count: number, locale: Locale): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  switch (locale) {
    case "ru":
      if (mod10 === 1 && mod100 !== 11) return "раздел";
      if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "раздела";
      return "разделов";
    case "pl":
      if (count === 1) return "sekcja";
      if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "sekcje";
      return "sekcji";
    case "es": return count === 1 ? "sección" : "secciones";
    case "pt": return count === 1 ? "secção" : "secções";
    case "fr": return count === 1 ? "section" : "sections";
    case "de": return count === 1 ? "Abschnitt" : "Abschnitte";
    case "it": return count === 1 ? "sezione" : "sezioni";
    default: return count === 1 ? "section" : "sections";
  }
}

export function resourceFormatLabel(count: number, locale: Locale, freeWord: string): string {
  return `.docx · ${count} ${resourceSectionsWord(count, locale)} · ${freeWord}`;
}

// Website's `text.freeWord` per locale (frontend/src/ui.tsx's per-locale
// `text` dictionaries) - mobile has no equivalent shared UI-text table for
// this one word, so it's ported here directly rather than adding a whole
// new i18n key for a single word already used verbatim above.
export const RESOURCE_FREE_WORD: Record<Locale, string> = {
  en: "free",
  ru: "бесплатно",
  es: "gratis",
  pt: "grátis",
  fr: "gratuit",
  de: "kostenlos",
  it: "gratuito",
  pl: "za darmo",
};

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
//
// UPDATE (Sept 2026, cont'd): QUIZ_CONTENT_PT/FR/DE/IT/PL added the same
// way - original translations of the same 26 questions/copy (machine
// translated, same as the app's main translations.ts batch for these 5
// languages), not ported from the site. Same caveat: flag for native-speaker
// review before shipping, alongside the rest of the pt/fr/de/it/pl batch.

export type QuizLocale = "en" | "ru" | "es" | "pt" | "fr" | "de" | "it" | "pl";

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

const QUIZ_CONTENT_PT: QuizContent = {
  sections: ["Porquê ser pai/mãe?", "Parentalidade", "Vida quotidiana", "Dinheiro", "Comunicação", "Limites", "Futuro", "Perguntas importantes"],
  questions: [
    { section: 1, type: "select", prompt: "Porque quer tornar-se pai/mãe?", options: ["Sempre quis criar um filho", "Quero constituir família antes que seja tarde demais para mim", "Quero dar a uma criança um lar cheio de amor, seja qual for a forma que isso tome", "Sinceramente, ainda estou a tentar perceber porquê"] },
    { section: 1, type: "select", prompt: "Como descreveria o tipo de pai/mãe que espera ser?", options: ["Presente e envolvido(a) nos detalhes do dia a dia", "Presente, mas dando independência ao meu filho", "Guiado(a) pela estrutura e pela rotina", "Ainda estou a descobrir isso"] },
    { section: 1, type: "select", prompt: "O que é mais importante para si neste momento em relação a tornar-se pai/mãe?", options: ["O timing - não quero esperar muito mais", "Encontrar a situação certa, seja quando for", "Fazê-lo de uma forma que pareça estável e preparada", "Ainda não tenho a certeza, estou a explorar as minhas opções"] },
    { section: 2, type: "select", prompt: "Como gostaria idealmente de partilhar as responsabilidades parentais?", options: ["O mais equitativamente possível", "Com base nos horários", "Com base no rendimento", "Decidir em conjunto", "Ainda não tenho a certeza"] },
    { section: 2, type: "select", prompt: "Qual é a sua visão sobre disciplina?", options: ["Regras claras e consequências consistentes", "Orientação suave, conversando sobre as coisas", "Depende da situação", "Algo que teríamos de acordar em conjunto"] },
    { section: 2, type: "select", prompt: "Até que ponto gostaria que o outro progenitor estivesse envolvido nas decisões do dia a dia?", options: ["Envolvido em tudo, sempre", "Envolvido nas grandes decisões, autónomo nas pequenas", "Maioritariamente autónomo, com atualizações ocasionais", "Ainda estou a resolver isso"] },
    { section: 2, type: "select", prompt: "Como se sente em relação ao envolvimento da família alargada na educação da criança?", options: ["Muito envolvida - avós e família por perto", "Envolvida às vezes, mas somos nós que definimos os limites", "Envolvimento mínimo, criaríamos a criança sobretudo sozinhos", "Depende inteiramente da família, teria de pensar bem nisso"] },
    { section: 3, type: "select", prompt: "Onde gostaria idealmente que o seu filho crescesse?", options: ["Perto de onde vivo atualmente", "Aberto(a) a mudar-me para outro sítio", "Perto da família, onde quer que esteja", "Ainda não pensei nisso"] },
    { section: 3, type: "select", prompt: "Como dividiria as rotinas diárias, como levar à escola, refeições e a hora de deitar?", options: ["Divididas de forma igual por defeito", "Consoante o horário de cada um nesse dia", "Um de nós assume a liderança, o outro apoia", "Iríamos descobrindo à medida que avançássemos"] },
    { section: 3, type: "select", prompt: "Quanta flexibilidade deseja na sua rotina parental do dia a dia?", options: ["Uma rotina clara e consistente é o que mais me convém", "Gosto de flexibilidade e de me adaptar conforme necessário", "Uma mistura das duas coisas", "Ainda não tenho a certeza"] },
    { section: 4, type: "select", prompt: "Como se sente em relação à divisão dos custos relacionados com a criança?", options: ["Igualmente, independentemente do que cada um ganha", "Proporcionalmente ao que cada um ganha", "Um de nós assume uma parte maior financeiramente", "Teríamos de falar sobre isso"] },
    { section: 4, type: "select", prompt: "Como lidaria com uma despesa grande e inesperada com o seu filho?", options: ["Dividi-la imediatamente, sem necessidade de discussão", "Falar sobre o assunto e decidir em conjunto primeiro", "Quem tiver possibilidades cobre-a, por agora", "Sinceramente, ainda não tenho a certeza"] },
    { section: 4, type: "select", prompt: "Até que ponto se sente confortável a falar de dinheiro com um coparente antes de se comprometer com algo?", options: ["Muito confortável - gostaria de resolver isto cedo", "Confortável, mas iria abordando o assunto aos poucos", "Um pouco incomodado(a), mas sei que é necessário", "Tenho tendência a evitar conversas sobre dinheiro"] },
    { section: 5, type: "select", prompt: "Com que frequência espera comunicar com um coparente sobre o seu filho?", options: ["Atualizações diárias, mesmo para pequenas coisas", "Regularmente, para tudo o que for importante", "Apenas quando for preciso tomar uma decisão", "Ainda não sei o que é realista"] },
    { section: 5, type: "select", prompt: "Qual é a sua forma preferida de lidar com um desacordo?", options: ["Falar sobre isso imediatamente, pessoalmente se possível", "Reservar algum tempo para pensar e depois falar", "Escrever primeiro para conseguir ser claro(a)", "Tenho tendência a evitar o conflito quando posso"] },
    { section: 5, type: "select", prompt: "Como se sente em relação a receber perguntas difíceis logo no início?", options: ["Prefiro saber tudo desde o início", "Não me importo assim que existir alguma confiança", "Preferia abordar os temas mais profundos aos poucos", "Isso deixa-me um pouco desconfortável"] },
    { section: 6, type: "select", prompt: "Como se sente em relação a um coparente namorar outras pessoas?", options: ["Completamente à vontade, desde que seja feito com respeito", "Tudo bem, mas gostaria de ter alguns limites definidos", "Gostaria de discutir isto antes de acontecer", "Ainda não pensei bem nisso"] },
    { section: 6, type: "select", prompt: "Que informação pessoal se sente confortável a partilhar logo no início de uma conversa sobre coparentalidade?", options: ["Praticamente tudo o que for relevante", "O essencial, mais à medida que a confiança se constrói", "Apenas o que estiver diretamente relacionado com a parentalidade", "Sou naturalmente reservado(a) sobre a maioria das coisas"] },
    { section: 6, type: "select", prompt: "Como se sente se um coparente definir limites quanto ao seu envolvimento?", options: ["Perfeitamente justo, cada um deveria poder definir limites", "Depende de qual seja o limite", "Gostaria de estar o mais envolvido(a) possível, sempre", "Ainda não pensei nisso"] },
    { section: 7, type: "select", prompt: "Como imagina a sua família daqui a cinco anos?", options: ["Uma rotina clara e estável em que já estaríamos instalados", "Ainda a adaptar-nos à medida que as coisas mudam", "Depende muito do rumo que a vida nos der", "Sinceramente, ainda não a imaginei"] },
    { section: 7, type: "select", prompt: "O que acontece se um de vocês quiser mudar-se de cidade ou país algum dia?", options: ["Teríamos de chegar a acordo sobre isto antes de começar", "Resolveríamos isso em conjunto quando surgisse", "Gostaria de ter a flexibilidade de me mudar se necessário", "Não sei ao certo como lidaria com isto"] },
    { section: 7, type: "select", prompt: "Como se sente em relação ao facto de o acordo mudar à medida que o seu filho cresce?", options: ["Espero que evolua, e sinto-me confortável com isso", "Gostaria de manter as coisas o mais consistentes possível", "Um pouco das duas coisas, consoante o que for necessário", "Ainda não pensei tão à frente"] },
    { section: 8, type: "select", prompt: "O que o(a) levaria a decidir não avançar com um potencial coparente?", options: ["Uma incompatibilidade de valores fundamentais sobre a parentalidade", "Sentir-se pressionado(a) ou apressado(a) a tomar decisões", "Preocupações quanto à fiabilidade ou ao cumprimento de compromissos", "Eu saberia quando sentisse isso"] },
    { section: 8, type: "text", prompt: "O que mais gostaria que um potencial coparente compreendesse sobre si antes de avançarem juntos?" },
    { section: 8, type: "text", prompt: "Qual é a pergunta que tem receio de fazer, mas sabe que devia?" },
    { section: 8, type: "text", prompt: "Há mais alguma coisa sobre a sua situação ou as suas expectativas que gostaria de partilhar?" },
  ],
  strengthCopy: {
    1: { title: "Porquê ser pai/mãe?", copy: "Parece ter clareza sobre porque quer tornar-se pai/mãe - essa clareza vale a pena ser dita em voz alta logo no início de uma conversa." },
    2: { title: "Parentalidade", copy: "Parece ter uma noção bem definida de como gostaria de coparentar no dia a dia." },
    3: { title: "Vida quotidiana", copy: "Tem uma ideia bastante clara de como poderiam ser a vida quotidiana e as rotinas." },
    4: { title: "Dinheiro", copy: "Parece sentir-se confortável e decidido(a) quanto à forma como o dinheiro e os custos seriam geridos." },
    5: { title: "Comunicação", copy: "Parece sentir-se confortável a discutir temas difíceis e a procurar soluções em conjunto." },
    6: { title: "Limites", copy: "Tem uma noção clara dos limites que são importantes para si." },
    7: { title: "Futuro", copy: "Parece ter refletido sobre como as coisas poderão mudar à medida que a sua família cresce." },
    8: { title: "Perguntas importantes", copy: "Tem uma noção clara do que funcionaria - e do que não funcionaria - para si." },
  },
  discussCopy: {
    1: { title: "Porquê ser pai/mãe?", copy: "As suas respostas sugerem que as suas razões para ser pai/mãe ainda estão a tomar forma - vale a pena colocá-las em palavras antes de avançar muito mais." },
    2: { title: "Parentalidade", copy: "A forma como as responsabilidades parentais do dia a dia seriam efetivamente divididas parece ser uma área que merece uma conversa mais aprofundada." },
    3: { title: "Vida quotidiana", copy: "Condições de vida e rotinas diárias - as suas respostas mostram uma área em que poderá valer a pena uma conversa mais aprofundada." },
    4: { title: "Dinheiro", copy: "A forma como os custos seriam partilhados parece menos definida para si - um bom assunto para abordar cedo, não depois de acontecer." },
    5: { title: "Comunicação", copy: "A forma como comunicariam no dia a dia, especialmente durante desacordos, vale a pena ser discutida explicitamente." },
    6: { title: "Limites", copy: "Onde se situam os seus limites ainda não está totalmente definido - vale a pena esclarecer isso primeiro consigo mesmo(a), depois com um potencial coparente." },
    7: { title: "Futuro", copy: "A forma como as coisas poderão mudar ao longo dos anos ainda é incerta para si - vale a pena revisitar este tema à medida que a relação se desenvolve." },
    8: { title: "Perguntas importantes", copy: "Algumas das perguntas mais difíceis ainda estão em aberto para si - vale a pena refletir sobre elas antes de se comprometer com algo." },
  },
  prompts: {
    1: ["Porque é que ambos estão a considerar isto agora, especificamente?", "O que faria com que, em retrospetiva, isto parecesse a decisão errada?"],
    2: ["Como dividiriam as decisões sobre a escola, os cuidados de saúde e a disciplina?", "O que acontece se discordarem numa decisão parental?"],
    3: ["Onde é que cada um gostaria idealmente de viver, e a que distância um do outro?", "Como seria efetivamente dividida uma semana típica?"],
    4: ["Como dividiriam os custos se um de vocês ganhar significativamente mais?", "Quem cobriria uma despesa maior e não planeada?"],
    5: ["Com que frequência esperam falar um com o outro?", "O que é, para cada um de vocês, uma forma justa de discordar?"],
    6: ["O que gostariam de saber sobre as outras relações um do outro?", "Que informação cada um de vocês considera privada?"],
    7: ["O que fariam se um de vocês quisesse mudar-se para longe?", "Como imaginam que este acordo evoluirá ao longo de mais de 10 anos?"],
    8: ["O que seria um ponto de rutura para cada um de vocês?", "Há algo que hesitem em abordar neste momento?"],
  },
};

const QUIZ_CONTENT_FR: QuizContent = {
  sections: ["Pourquoi devenir parent ?", "Parentalité", "Vie quotidienne", "Argent", "Communication", "Limites", "Avenir", "Questions importantes"],
  questions: [
    { section: 1, type: "select", prompt: "Pourquoi voulez-vous devenir parent ?", options: ["J'ai toujours voulu élever un enfant", "Je veux fonder une famille avant qu'il ne soit trop tard pour moi", "Je veux offrir à un enfant un foyer aimant, quelle qu'en soit la forme", "Honnêtement, je cherche encore à comprendre pourquoi"] },
    { section: 1, type: "select", prompt: "Comment décririez-vous le type de parent que vous espérez être ?", options: ["Impliqué(e) au quotidien, dans les moindres détails", "Présent(e), tout en laissant de l'indépendance à mon enfant", "Guidé(e) par la structure et la routine", "Je suis encore en train d'y réfléchir"] },
    { section: 1, type: "select", prompt: "Qu'est-ce qui compte le plus pour vous en ce moment dans votre projet de devenir parent ?", options: ["Le timing - je ne veux pas attendre beaucoup plus longtemps", "Trouver la bonne situation, quel que soit le moment", "Le faire d'une manière qui me semble stable et réfléchie", "Je ne suis pas encore sûr(e), j'explore mes options"] },
    { section: 2, type: "select", prompt: "Dans l'idéal, comment souhaiteriez-vous répartir les responsabilités parentales ?", options: ["Le plus équitablement possible", "En fonction des emplois du temps", "En fonction des revenus", "En décider ensemble", "Je ne suis pas encore sûr(e)"] },
    { section: 2, type: "select", prompt: "Quelle est votre vision de la discipline ?", options: ["Des règles claires et des conséquences cohérentes", "Un accompagnement bienveillant, en discutant des choses", "Cela dépend de la situation", "Quelque chose que nous devrions décider ensemble"] },
    { section: 2, type: "select", prompt: "À quel point souhaitez-vous que l'autre parent soit impliqué dans les décisions du quotidien ?", options: ["Impliqué en tout, toujours", "Impliqué dans les grandes décisions, autonome pour les petites", "Plutôt autonome, avec un point de temps en temps", "Je suis encore en train d'y réfléchir"] },
    { section: 2, type: "select", prompt: "Que pensez-vous de l'implication de la famille élargie dans l'éducation de l'enfant ?", options: ["Très impliquée - grands-parents et famille à proximité", "Impliquée parfois, mais c'est nous qui fixons les limites", "Une implication minimale, nous élèverions l'enfant principalement nous-mêmes", "Cela dépend entièrement de la famille, il faudrait que j'y réfléchisse"] },
    { section: 3, type: "select", prompt: "Où souhaiteriez-vous idéalement que votre enfant grandisse ?", options: ["Près de l'endroit où je vis actuellement", "Ouvert(e) à déménager ailleurs", "Près de la famille, où qu'elle se trouve", "Je n'y ai pas encore réfléchi"] },
    { section: 3, type: "select", prompt: "Comment répartiriez-vous les tâches quotidiennes comme les trajets à l'école, les repas et le coucher ?", options: ["Réparties équitablement par défaut", "Selon l'emploi du temps de chacun ce jour-là", "L'un(e) de nous prend les devants, l'autre soutient", "Nous verrions cela au fur et à mesure"] },
    { section: 3, type: "select", prompt: "Quel degré de flexibilité souhaitez-vous dans votre emploi du temps parental quotidien ?", options: ["Une routine claire et cohérente me convient le mieux", "J'aime la flexibilité et m'adapter selon les besoins", "Un mélange des deux", "Pas encore sûr(e)"] },
    { section: 4, type: "select", prompt: "Que pensez-vous du partage des coûts liés à l'enfant ?", options: ["À parts égales, quels que soient nos revenus respectifs", "Proportionnellement à ce que chacun gagne", "L'un(e) de nous en assume une plus grande part financièrement", "Nous devrions en discuter"] },
    { section: 4, type: "select", prompt: "Comment géreriez-vous une dépense importante et imprévue pour votre enfant ?", options: ["La partager immédiatement, sans discussion nécessaire", "En parler et décider ensemble d'abord", "Celui ou celle qui en a les moyens la couvre, pour l'instant", "Honnêtement, pas encore sûr(e)"] },
    { section: 4, type: "select", prompt: "À quel point êtes-vous à l'aise pour parler d'argent avec un coparent avant de vous engager ?", options: ["Très à l'aise - je voudrais que ce soit réglé tôt", "À l'aise, mais j'y viendrais progressivement", "Un peu mal à l'aise, mais je sais que c'est nécessaire", "J'ai tendance à éviter les conversations sur l'argent"] },
    { section: 5, type: "select", prompt: "À quelle fréquence pensez-vous communiquer avec un coparent au sujet de votre enfant ?", options: ["Des nouvelles quotidiennes, même pour de petites choses", "Régulièrement, pour tout ce qui compte", "Seulement quand une décision doit être prise", "Je ne sais pas encore ce qui serait réaliste"] },
    { section: 5, type: "select", prompt: "Quelle est votre façon préférée de gérer un désaccord ?", options: ["En parler immédiatement, en personne si possible", "Prendre le temps d'y réfléchir, puis en parler", "L'écrire d'abord pour être clair(e)", "J'ai tendance à éviter le conflit quand je le peux"] },
    { section: 5, type: "select", prompt: "Que ressentez-vous à l'idée qu'on vous pose des questions difficiles dès le début ?", options: ["Je préfère tout savoir dès le départ", "Cela me convient une fois qu'une certaine confiance s'est installée", "Je préfère aborder les sujets plus profonds progressivement", "Cela me met un peu mal à l'aise"] },
    { section: 6, type: "select", prompt: "Que ressentez-vous à l'idée qu'un coparent fréquente d'autres personnes ?", options: ["Tout à fait à l'aise, tant que c'est fait avec respect", "À l'aise, mais je voudrais fixer certaines limites", "Je voudrais en discuter avant que cela n'arrive", "Je n'y ai pas encore réfléchi"] },
    { section: 6, type: "select", prompt: "Quelles informations personnelles êtes-vous à l'aise de partager tôt dans une conversation de coparentalité ?", options: ["À peu près tout ce qui est pertinent", "Les bases, puis davantage à mesure que la confiance s'installe", "Seulement ce qui concerne directement la parentalité", "Je suis naturellement discret(ète) sur la plupart des sujets"] },
    { section: 6, type: "select", prompt: "Que ressentez-vous si un coparent fixe des limites à votre implication ?", options: ["Tout à fait juste, chacun devrait pouvoir fixer des limites", "Cela dépend de la limite en question", "Je voudrais être impliqué(e) autant que possible, toujours", "Je n'y ai pas encore réfléchi"] },
    { section: 7, type: "select", prompt: "Comment imaginez-vous votre famille dans cinq ans ?", options: ["Une routine claire et stable dans laquelle nous nous serions installés", "Toujours en train de s'adapter aux changements", "Cela dépend beaucoup de ce que la vie nous réserve", "Honnêtement, je ne me la suis pas encore imaginée"] },
    { section: 7, type: "select", prompt: "Que se passe-t-il si l'un(e) de vous souhaite un jour déménager ?", options: ["Il faudrait se mettre d'accord là-dessus avant de commencer", "Nous trouverions une solution ensemble le moment venu", "Je voudrais avoir la flexibilité de déménager si nécessaire", "Je ne sais pas comment je gérerais cela"] },
    { section: 7, type: "select", prompt: "Que ressentez-vous à l'idée que l'arrangement évolue à mesure que votre enfant grandit ?", options: ["Je m'attends à ce qu'il évolue, et cela me convient", "Je voudrais garder les choses aussi stables que possible", "Un peu des deux, selon les besoins", "Je n'y ai pas réfléchi aussi loin"] },
    { section: 8, type: "select", prompt: "Qu'est-ce qui vous amènerait à décider de ne pas poursuivre avec un coparent potentiel ?", options: ["Un décalage dans les valeurs fondamentales autour de la parentalité", "Le sentiment d'être poussé(e) ou précipité(e) dans des décisions", "Des doutes sur la fiabilité ou la capacité à tenir ses engagements", "Je le saurais en le ressentant"] },
    { section: 8, type: "text", prompt: "Qu'aimeriez-vous le plus qu'un coparent potentiel comprenne à votre sujet avant d'avancer ensemble ?" },
    { section: 8, type: "text", prompt: "Quelle est une question que vous avez peur de poser, mais que vous savez devoir poser ?" },
    { section: 8, type: "text", prompt: "Y a-t-il autre chose concernant votre situation ou vos attentes que vous aimeriez partager ?" },
  ],
  strengthCopy: {
    1: { title: "Pourquoi devenir parent ?", copy: "Vous semblez avoir une idée claire des raisons pour lesquelles vous voulez devenir parent - cette clarté mérite d'être exprimée dès le début d'une conversation." },
    2: { title: "Parentalité", copy: "Vous semblez avoir une vision bien établie de la façon dont vous souhaiteriez coparent au quotidien." },
    3: { title: "Vie quotidienne", copy: "Vous avez une image assez claire de ce à quoi pourraient ressembler la vie quotidienne et les routines." },
    4: { title: "Argent", copy: "Vous semblez à l'aise et déterminé(e) quant à la façon dont l'argent et les coûts seraient gérés." },
    5: { title: "Communication", copy: "Vous semblez à l'aise pour aborder des sujets difficiles et chercher des solutions ensemble." },
    6: { title: "Limites", copy: "Vous avez une idée claire des limites qui comptent pour vous." },
    7: { title: "Avenir", copy: "Vous semblez avoir réfléchi à la façon dont les choses pourraient évoluer à mesure que votre famille grandit." },
    8: { title: "Questions importantes", copy: "Vous avez une idée claire de ce qui fonctionnerait - et ne fonctionnerait pas - pour vous." },
  },
  discussCopy: {
    1: { title: "Pourquoi devenir parent ?", copy: "Vos réponses suggèrent que vos raisons de devenir parent sont encore en train de se préciser - cela vaut la peine de les mettre en mots avant d'aller plus loin." },
    2: { title: "Parentalité", copy: "La façon dont les responsabilités parentales quotidiennes seraient réellement réparties semble être un sujet qui mérite une conversation plus approfondie." },
    3: { title: "Vie quotidienne", copy: "Le mode de vie et les routines quotidiennes - vos réponses montrent un domaine où une conversation plus approfondie pourrait être utile." },
    4: { title: "Argent", copy: "La façon dont les coûts seraient partagés semble moins établie pour vous - un bon sujet à aborder tôt, pas après coup." },
    5: { title: "Communication", copy: "La façon dont vous communiqueriez au quotidien, en particulier lors des désaccords, mérite d'être abordée explicitement." },
    6: { title: "Limites", copy: "L'endroit où se situent vos limites n'est pas encore totalement clair - cela vaut la peine de le clarifier pour vous-même, puis avec un coparent potentiel." },
    7: { title: "Avenir", copy: "La façon dont les choses pourraient évoluer au fil des ans reste incertaine pour vous - à revisiter à mesure que la relation évolue." },
    8: { title: "Questions importantes", copy: "Certaines des questions les plus difficiles restent encore ouvertes pour vous - elles méritent d'être approfondies avant de vous engager." },
  },
  prompts: {
    1: ["Pourquoi envisagez-vous tous les deux cela maintenant, spécifiquement ?", "Qu'est-ce qui, avec le recul, donnerait l'impression que c'était la mauvaise décision ?"],
    2: ["Comment répartiriez-vous les décisions concernant la scolarité, la santé et la discipline ?", "Que se passe-t-il si vous n'êtes pas d'accord sur une décision parentale ?"],
    3: ["Où souhaiteriez-vous idéalement vivre chacun(e), et à quelle distance l'un de l'autre ?", "Comment une semaine type serait-elle réellement répartie ?"],
    4: ["Comment répartiriez-vous les coûts si l'un(e) de vous gagne nettement plus ?", "Qui prendrait en charge une dépense imprévue et importante ?"],
    5: ["À quelle fréquence pensez-vous prendre des nouvelles l'un de l'autre ?", "À quoi ressemble, pour chacun(e) de vous, une façon équitable d'être en désaccord ?"],
    6: ["Que voudriez-vous savoir sur les autres relations de chacun(e) ?", "Quelles informations chacun(e) de vous considère-t-il/elle comme privées ?"],
    7: ["Que feriez-vous si l'un(e) de vous voulait déménager loin ?", "Comment imaginez-vous cet arrangement évoluer sur plus de 10 ans ?"],
    8: ["Qu'est-ce qui serait un point de rupture pour chacun(e) de vous ?", "Y a-t-il quelque chose que vous hésitez à aborder en ce moment ?"],
  },
};

const QUIZ_CONTENT_DE: QuizContent = {
  sections: ["Warum Elternteil werden?", "Elternschaft", "Alltag", "Geld", "Kommunikation", "Grenzen", "Zukunft", "Wichtige Fragen"],
  questions: [
    { section: 1, type: "select", prompt: "Warum möchten Sie Elternteil werden?", options: ["Ich wollte schon immer ein Kind großziehen", "Ich möchte eine Familie gründen, bevor es für mich zu spät ist", "Ich möchte einem Kind ein liebevolles Zuhause geben, in welcher Form auch immer", "Ehrlich gesagt suche ich noch nach dem Warum"] },
    { section: 1, type: "select", prompt: "Wie würden Sie die Art von Elternteil beschreiben, die Sie sein möchten?", options: ["Hands-on und in die täglichen Details involviert", "Präsent, aber meinem Kind Unabhängigkeit gebend", "Von Struktur und Routine geleitet", "Das finde ich noch heraus"] },
    { section: 1, type: "select", prompt: "Was ist Ihnen im Moment am wichtigsten in Bezug auf Ihren Wunsch, Elternteil zu werden?", options: ["Das Timing - ich möchte nicht mehr viel länger warten", "Die richtige Situation zu finden, wann immer das geschieht", "Es auf eine Weise zu tun, die sich stabil und vorbereitet anfühlt", "Ich bin mir noch nicht sicher, ich erkunde meine Möglichkeiten"] },
    { section: 2, type: "select", prompt: "Wie würden Sie im Idealfall die Erziehungsverantwortung aufteilen?", options: ["So gleichmäßig wie möglich", "Nach Zeitplänen", "Nach Einkommen", "Gemeinsam entscheiden", "Ich bin mir noch nicht sicher"] },
    { section: 2, type: "select", prompt: "Wie stehen Sie zum Thema Erziehung und Disziplin?", options: ["Klare Regeln und konsequente Folgen", "Sanfte Anleitung, Dinge gemeinsam besprechen", "Kommt auf die Situation an", "Etwas, das wir gemeinsam vereinbaren müssten"] },
    { section: 2, type: "select", prompt: "Wie stark soll der andere Elternteil in alltägliche Entscheidungen eingebunden sein?", options: ["Immer in alles eingebunden", "In die großen Entscheidungen eingebunden, bei kleinen eigenständig", "Meist eigenständig, gelegentlich Rücksprache", "Das arbeite ich noch aus"] },
    { section: 2, type: "select", prompt: "Wie stehen Sie dazu, dass die Großfamilie in die Erziehung eingebunden wird?", options: ["Sehr eingebunden - Großeltern und Familie in der Nähe", "Manchmal eingebunden, aber wir setzen die Grenzen", "Minimale Einbindung, wir würden das Kind größtenteils selbst großziehen", "Kommt ganz auf die Familie an, das müsste ich mir überlegen"] },
    { section: 3, type: "select", prompt: "Wo sollte Ihr Kind idealerweise aufwachsen?", options: ["In der Nähe meines jetzigen Wohnorts", "Offen dafür, irgendwohin neu zu ziehen", "In der Nähe der Familie, wo auch immer sie ist", "Darüber habe ich noch nicht nachgedacht"] },
    { section: 3, type: "select", prompt: "Wie würden Sie alltägliche Routinen wie Schulweg, Mahlzeiten und Schlafenszeit aufteilen?", options: ["Standardmäßig gleichmäßig aufgeteilt", "Je nachdem, wessen Zeitplan es an diesem Tag zulässt", "Eine(r) von uns übernimmt die Führung, der/die andere unterstützt", "Das würden wir im Laufe der Zeit herausfinden"] },
    { section: 3, type: "select", prompt: "Wie viel Flexibilität wünschen Sie sich in Ihrem täglichen Erziehungsalltag?", options: ["Eine klare, gleichbleibende Routine passt am besten zu mir", "Ich mag Flexibilität und mich nach Bedarf anzupassen", "Eine Mischung aus beidem", "Noch nicht sicher"] },
    { section: 4, type: "select", prompt: "Wie stehen Sie zur Aufteilung kindbezogener Kosten?", options: ["Gleichmäßig, unabhängig davon, was jede(r) von uns verdient", "Proportional zu dem, was jede(r) von uns verdient", "Eine(r) von uns übernimmt finanziell mehr", "Das müssten wir besprechen"] },
    { section: 4, type: "select", prompt: "Wie würden Sie mit einer großen, unerwarteten Ausgabe für Ihr Kind umgehen?", options: ["Sofort aufteilen, keine Diskussion nötig", "Erst besprechen und gemeinsam entscheiden", "Wer gerade die Mittel dafür hat, übernimmt es vorerst", "Ehrlich gesagt, noch nicht sicher"] },
    { section: 4, type: "select", prompt: "Wie wohl fühlen Sie sich dabei, mit einem Co-Elternteil über Geld zu sprechen, bevor Sie sich auf etwas festlegen?", options: ["Sehr wohl - ich würde das gerne frühzeitig klären", "Wohl, aber ich würde mich langsam herantasten", "Etwas unwohl, aber ich weiß, dass es notwendig ist", "Ich neige dazu, Gespräche über Geld zu vermeiden"] },
    { section: 5, type: "select", prompt: "Wie oft erwarten Sie, mit einem Co-Elternteil über Ihr Kind zu kommunizieren?", options: ["Tägliche Updates, auch bei Kleinigkeiten", "Regelmäßig, bei allem, was wichtig ist", "Nur wenn eine Entscheidung getroffen werden muss", "Ich weiß noch nicht, was realistisch ist"] },
    { section: 5, type: "select", prompt: "Wie gehen Sie am liebsten mit Meinungsverschiedenheiten um?", options: ["Sofort darüber sprechen, wenn möglich persönlich", "Sich etwas Zeit zum Nachdenken nehmen, dann sprechen", "Es zuerst aufschreiben, um klar zu sein", "Ich neige dazu, Konflikte zu vermeiden, wenn ich kann"] },
    { section: 5, type: "select", prompt: "Wie fühlen Sie sich dabei, schon früh schwierige Fragen gestellt zu bekommen?", options: ["Ich möchte lieber alles von Anfang an wissen", "Das ist für mich in Ordnung, sobald etwas Vertrauen besteht", "Ich würde tiefere Themen lieber schrittweise angehen", "Das macht mich etwas unwohl"] },
    { section: 6, type: "select", prompt: "Wie fühlen Sie sich dabei, wenn ein Co-Elternteil andere Menschen datet?", options: ["Völlig in Ordnung, solange es respektvoll geschieht", "In Ordnung, aber ich würde gerne gewisse Grenzen setzen", "Ich würde das gerne besprechen, bevor es passiert", "Darüber habe ich noch nicht nachgedacht"] },
    { section: 6, type: "select", prompt: "Welche persönlichen Informationen teilen Sie zu Beginn eines Gesprächs über Co-Elternschaft gerne mit?", options: ["So ziemlich alles Relevante", "Das Wesentliche, mehr mit wachsendem Vertrauen", "Nur das, was direkt mit der Erziehung zu tun hat", "Ich bin von Natur aus zurückhaltend bei den meisten Dingen"] },
    { section: 6, type: "select", prompt: "Wie fühlen Sie sich dabei, wenn ein Co-Elternteil Grenzen für Ihre Einbindung setzt?", options: ["Völlig fair, jede(r) sollte Grenzen setzen können", "Kommt darauf an, worum es bei der Grenze geht", "Ich möchte immer so eingebunden wie möglich sein", "Darüber habe ich noch nicht nachgedacht"] },
    { section: 7, type: "select", prompt: "Wie stellen Sie sich Ihre Familie in fünf Jahren vor?", options: ["Eine klare, stabile Routine, in der wir uns eingelebt haben", "Immer noch in Anpassung an Veränderungen", "Hängt stark davon ab, wohin das Leben uns führt", "Ehrlich gesagt habe ich mir das noch nicht vorgestellt"] },
    { section: 7, type: "select", prompt: "Was passiert, wenn einer von Ihnen beiden eines Tages umziehen möchte?", options: ["Darauf müssten wir uns einigen, bevor wir starten", "Wir würden das gemeinsam klären, wenn es so weit ist", "Ich hätte gerne die Flexibilität umzuziehen, falls nötig", "Nicht sicher, wie ich damit umgehen würde"] },
    { section: 7, type: "select", prompt: "Wie fühlen Sie sich dabei, dass sich die Vereinbarung ändert, wenn Ihr Kind älter wird?", options: ["Ich erwarte, dass sie sich weiterentwickelt, und das ist für mich in Ordnung", "Ich möchte die Dinge so beständig wie möglich halten", "Etwas von beidem, je nach Bedarf", "So weit habe ich noch nicht gedacht"] },
    { section: 8, type: "select", prompt: "Was würde Sie dazu bringen, sich gegen einen möglichen Co-Elternteil zu entscheiden?", options: ["Eine Diskrepanz bei grundlegenden Werten rund um die Erziehung", "Das Gefühl, zu Entscheidungen gedrängt oder gehetzt zu werden", "Bedenken hinsichtlich Zuverlässigkeit oder Konsequenz", "Ich würde es spüren, wenn es so weit ist"] },
    { section: 8, type: "text", prompt: "Was möchten Sie am meisten, dass ein möglicher Co-Elternteil über Sie versteht, bevor Sie gemeinsam weitergehen?" },
    { section: 8, type: "text", prompt: "Welche Frage haben Sie Angst zu stellen, obwohl Sie wissen, dass Sie es sollten?" },
    { section: 8, type: "text", prompt: "Gibt es noch etwas zu Ihrer Situation oder Ihren Erwartungen, das Sie mitteilen möchten?" },
  ],
  strengthCopy: {
    1: { title: "Warum Elternteil werden?", copy: "Sie scheinen sich darüber im Klaren zu sein, warum Sie Elternteil werden möchten - diese Klarheit lohnt es sich, früh in einem Gespräch auszusprechen." },
    2: { title: "Elternschaft", copy: "Sie scheinen ein gefestigtes Gefühl dafür zu haben, wie Sie sich die gemeinsame Erziehung im Alltag vorstellen." },
    3: { title: "Alltag", copy: "Sie haben ein recht klares Bild davon, wie der Alltag und die Routinen aussehen könnten." },
    4: { title: "Geld", copy: "Sie wirken entspannt und entschlossen, wenn es darum geht, wie Geld und Kosten gehandhabt würden." },
    5: { title: "Kommunikation", copy: "Sie scheinen sich wohl dabei zu fühlen, schwierige Themen zu besprechen und gemeinsam nach Lösungen zu suchen." },
    6: { title: "Grenzen", copy: "Sie haben ein klares Gefühl dafür, welche Grenzen Ihnen wichtig sind." },
    7: { title: "Zukunft", copy: "Sie scheinen darüber nachgedacht zu haben, wie sich die Dinge verändern könnten, während Ihre Familie wächst." },
    8: { title: "Wichtige Fragen", copy: "Sie haben ein klares Gefühl dafür, was für Sie funktionieren würde - und was nicht." },
  },
  discussCopy: {
    1: { title: "Warum Elternteil werden?", copy: "Ihre Antworten deuten darauf hin, dass sich Ihre Gründe für die Elternschaft noch formen - es lohnt sich, diese in Worte zu fassen, bevor Sie weitergehen." },
    2: { title: "Elternschaft", copy: "Wie die alltäglichen Erziehungsaufgaben tatsächlich aufgeteilt würden, scheint ein Bereich zu sein, der ein tieferes Gespräch verdient." },
    3: { title: "Alltag", copy: "Wohnsituation und Alltagsroutinen - Ihre Antworten zeigen einen Bereich, in dem ein tieferes Gespräch sinnvoll sein könnte." },
    4: { title: "Geld", copy: "Wie die Kosten aufgeteilt würden, scheint bei Ihnen weniger festzustehen - ein Thema, das man besser früh anspricht als nachträglich." },
    5: { title: "Kommunikation", copy: "Wie Sie im Alltag kommunizieren würden, besonders bei Meinungsverschiedenheiten, lohnt sich, ausdrücklich zu besprechen." },
    6: { title: "Grenzen", copy: "Wo Ihre Grenzen liegen, ist noch nicht ganz geklärt - es lohnt sich, das zunächst für sich selbst zu klären und dann mit einem möglichen Co-Elternteil." },
    7: { title: "Zukunft", copy: "Wie sich die Dinge im Laufe der Jahre verändern könnten, ist für Sie noch ungewiss - ein Thema, das man mit der Zeit erneut aufgreifen sollte." },
    8: { title: "Wichtige Fragen", copy: "Einige der schwierigeren Fragen sind für Sie noch offen - es lohnt sich, sich damit auseinanderzusetzen, bevor Sie sich festlegen." },
  },
  prompts: {
    1: ["Warum ziehen Sie beide das gerade jetzt in Betracht, ganz konkret?", "Was würde im Nachhinein das Gefühl geben, dass es die falsche Entscheidung war?"],
    2: ["Wie würden Sie Entscheidungen zu Schule, Gesundheitsversorgung und Erziehung aufteilen?", "Was passiert, wenn Sie bei einer Erziehungsentscheidung nicht einer Meinung sind?"],
    3: ["Wo würden Sie beide idealerweise leben wollen, und wie nah beieinander?", "Wie würde eine typische Woche tatsächlich aufgeteilt?"],
    4: ["Wie würden Sie die Kosten aufteilen, wenn einer von Ihnen deutlich mehr verdient?", "Wer würde eine ungeplante, größere Ausgabe übernehmen?"],
    5: ["Wie oft erwarten Sie, sich gegenseitig auf dem Laufenden zu halten?", "Wie sieht für jede(n) von Ihnen eine faire Art aus, anderer Meinung zu sein?"],
    6: ["Was möchten Sie über die anderen Beziehungen des jeweils anderen wissen?", "Welche Informationen betrachtet jede(r) von Ihnen als privat?"],
    7: ["Was würden Sie tun, wenn einer von Ihnen wegziehen wollte?", "Wie stellen Sie sich vor, dass sich diese Vereinbarung über mehr als 10 Jahre entwickelt?"],
    8: ["Was wäre für jede(n) von Ihnen ein Ausschlusskriterium?", "Gibt es etwas, das Sie im Moment zögern anzusprechen?"],
  },
};

const QUIZ_CONTENT_IT: QuizContent = {
  sections: ["Perché diventare genitore?", "Genitorialità", "Vita quotidiana", "Denaro", "Comunicazione", "Limiti", "Futuro", "Domande importanti"],
  questions: [
    { section: 1, type: "select", prompt: "Perché desidera diventare genitore?", options: ["Ho sempre desiderato crescere un figlio", "Voglio costruire una famiglia prima che sia troppo tardi per me", "Voglio dare a un bambino una casa piena d'amore, in qualunque forma essa sia", "Onestamente, sto ancora cercando di capire il perché"] },
    { section: 1, type: "select", prompt: "Come descriverebbe il tipo di genitore che spera di essere?", options: ["Presente e coinvolto nei dettagli quotidiani", "Presente, ma lasciando indipendenza a mio figlio", "Guidato/a da struttura e routine", "Lo sto ancora capendo"] },
    { section: 1, type: "select", prompt: "Cosa conta di più per Lei in questo momento riguardo al diventare genitore?", options: ["Il tempismo - non voglio aspettare ancora molto", "Trovare la situazione giusta, qualunque momento sia", "Farlo in un modo che risulti stabile e ponderato", "Non sono ancora sicuro/a, sto esplorando le mie opzioni"] },
    { section: 2, type: "select", prompt: "Come vorrebbe idealmente condividere le responsabilità genitoriali?", options: ["Nel modo più paritario possibile", "In base agli orari", "In base al reddito", "Deciderlo insieme", "Non sono ancora sicuro/a"] },
    { section: 2, type: "select", prompt: "Qual è la Sua idea di disciplina?", options: ["Regole chiare e conseguenze coerenti", "Guida gentile, parlandone insieme", "Dipende dalla situazione", "Qualcosa da concordare insieme"] },
    { section: 2, type: "select", prompt: "Quanto vorrebbe che l'altro genitore fosse coinvolto nelle decisioni quotidiane?", options: ["Coinvolto in tutto, sempre", "Coinvolto nelle grandi decisioni, autonomo per quelle piccole", "Perlopiù autonomo, con aggiornamenti occasionali", "Lo sto ancora definendo"] },
    { section: 2, type: "select", prompt: "Cosa pensa del coinvolgimento della famiglia allargata nella crescita di un figlio?", options: ["Molto coinvolta - nonni e famiglia vicini", "Coinvolta a volte, ma i limiti li fissiamo noi", "Coinvolgimento minimo, cresceremmo il bambino soprattutto da soli", "Dipende interamente dalla famiglia, dovrei rifletterci"] },
    { section: 3, type: "select", prompt: "Dove vorrebbe idealmente che Suo figlio crescesse?", options: ["Vicino a dove vivo ora", "Aperto/a a trasferirmi altrove", "Vicino alla famiglia, ovunque essa sia", "Non ci ho ancora pensato"] },
    { section: 3, type: "select", prompt: "Come dividerebbe le routine quotidiane come accompagnare a scuola, i pasti e l'ora di andare a letto?", options: ["Divise equamente per impostazione predefinita", "In base a chi ha l'orario libero quel giorno", "Uno di noi guida, l'altro supporta", "Lo capiremmo strada facendo"] },
    { section: 3, type: "select", prompt: "Quanta flessibilità desidera nella Sua routine genitoriale quotidiana?", options: ["Una routine chiara e costante mi si addice di più", "Mi piace la flessibilità e adattarmi secondo necessità", "Un misto di entrambe", "Non ancora sicuro/a"] },
    { section: 4, type: "select", prompt: "Cosa pensa della suddivisione delle spese legate al bambino?", options: ["In parti uguali, indipendentemente da quanto guadagniamo ciascuno", "In proporzione a quanto guadagniamo ciascuno", "Uno di noi si assume una parte maggiore economicamente", "Dovremmo parlarne"] },
    { section: 4, type: "select", prompt: "Come gestirebbe una spesa importante e imprevista per Suo figlio?", options: ["Dividerla subito, senza bisogno di discuterne", "Parlarne e decidere insieme prima", "Chi ha i mezzi la copre, per ora", "Onestamente, non ancora sicuro/a"] },
    { section: 4, type: "select", prompt: "Quanto si sente a proprio agio a parlare di soldi con un co-genitore prima di impegnarsi in qualcosa?", options: ["Molto a mio agio - vorrei chiarirlo presto", "A mio agio, ma ci arriverei gradualmente", "Un po' a disagio, ma so che è necessario", "Tendo a evitare le conversazioni sui soldi"] },
    { section: 5, type: "select", prompt: "Con quale frequenza si aspetta di comunicare con un co-genitore riguardo a Suo figlio?", options: ["Aggiornamenti quotidiani, anche per piccole cose", "Regolarmente, per tutto ciò che conta", "Solo quando bisogna prendere una decisione", "Non so ancora cosa sia realistico"] },
    { section: 5, type: "select", prompt: "Qual è il Suo modo preferito di gestire un disaccordo?", options: ["Parlarne subito, di persona se possibile", "Prendersi del tempo per riflettere, poi parlarne", "Scriverlo prima per essere chiaro/a", "Tendo a evitare il conflitto quando posso"] },
    { section: 5, type: "select", prompt: "Cosa prova all'idea di ricevere domande difficili fin dall'inizio?", options: ["Preferisco sapere tutto fin da subito", "Mi va bene una volta stabilita una certa fiducia", "Preferirei avvicinarmi gradualmente ai temi più profondi", "Mi mette un po' a disagio"] },
    { section: 6, type: "select", prompt: "Cosa prova all'idea che un co-genitore frequenti altre persone?", options: ["Completamente a mio agio, purché avvenga con rispetto", "Va bene, ma vorrei fissare alcuni limiti", "Vorrei discuterne prima che accada", "Non ci ho ancora riflettuto"] },
    { section: 6, type: "select", prompt: "Quali informazioni personali si sente a proprio agio a condividere all'inizio di una conversazione sulla co-genitorialità?", options: ["Praticamente tutto ciò che è rilevante", "Le basi, di più man mano che la fiducia cresce", "Solo ciò che riguarda direttamente la genitorialità", "Sono naturalmente riservato/a sulla maggior parte delle cose"] },
    { section: 6, type: "select", prompt: "Cosa prova se un co-genitore stabilisce dei limiti a quanto Lei è coinvolto/a?", options: ["Completamente giusto, ognuno dovrebbe poter fissare dei limiti", "Dipende da quale sia il limite", "Vorrei essere coinvolto/a il più possibile, sempre", "Non ci ho ancora riflettuto"] },
    { section: 7, type: "select", prompt: "Come immagina la Sua famiglia tra cinque anni?", options: ["Una routine chiara e stabile in cui ci siamo assestati", "Ancora in fase di adattamento ai cambiamenti", "Dipende molto da dove ci porterà la vita", "Onestamente, non me la sono ancora immaginata"] },
    { section: 7, type: "select", prompt: "Cosa succede se uno di voi due desidera trasferirsi un giorno?", options: ["Dovremmo essere d'accordo su questo prima di iniziare", "Lo capiremmo insieme quando si presenterà", "Vorrei avere la flessibilità di trasferirmi se necessario", "Non sono sicuro/a di come lo gestirei"] },
    { section: 7, type: "select", prompt: "Cosa prova all'idea che l'accordo cambi man mano che Suo figlio cresce?", options: ["Mi aspetto che si evolva, e questo mi va bene", "Vorrei mantenere le cose il più costanti possibile", "Un po' di entrambe le cose, a seconda delle necessità", "Non ci ho pensato così in là"] },
    { section: 8, type: "select", prompt: "Cosa La porterebbe a decidere di non proseguire con un potenziale co-genitore?", options: ["Una discrepanza nei valori fondamentali sulla genitorialità", "Sentirsi sotto pressione o spinto/a verso decisioni affrettate", "Preoccupazioni sull'affidabilità o sulla capacità di mantenere gli impegni", "Lo saprei nel momento in cui lo sentissi"] },
    { section: 8, type: "text", prompt: "Cosa vorrebbe di più che un potenziale co-genitore capisse di Lei prima di andare avanti insieme?" },
    { section: 8, type: "text", prompt: "Qual è una domanda che ha paura di fare, ma sa che dovrebbe?" },
    { section: 8, type: "text", prompt: "C'è qualcos'altro sulla Sua situazione o sulle Sue aspettative che vorrebbe condividere?" },
  ],
  strengthCopy: {
    1: { title: "Perché diventare genitore?", copy: "Sembra avere le idee chiare sul perché desidera diventare genitore - questa chiarezza vale la pena di essere espressa apertamente fin dall'inizio di una conversazione." },
    2: { title: "Genitorialità", copy: "Sembra avere un'idea consolidata di come vorrebbe gestire la co-genitorialità giorno per giorno." },
    3: { title: "Vita quotidiana", copy: "Ha un'immagine abbastanza chiara di come potrebbero essere la vita quotidiana e le routine." },
    4: { title: "Denaro", copy: "Sembra a proprio agio e deciso/a su come verrebbero gestiti il denaro e le spese." },
    5: { title: "Comunicazione", copy: "Sembra a proprio agio nell'affrontare argomenti difficili e nel cercare soluzioni insieme." },
    6: { title: "Limiti", copy: "Ha un'idea chiara dei limiti che contano per Lei." },
    7: { title: "Futuro", copy: "Sembra aver riflettuto su come le cose potrebbero cambiare man mano che la Sua famiglia cresce." },
    8: { title: "Domande importanti", copy: "Ha un'idea chiara di ciò che funzionerebbe - e ciò che non funzionerebbe - per Lei." },
  },
  discussCopy: {
    1: { title: "Perché diventare genitore?", copy: "Le Sue risposte suggeriscono che le ragioni per cui desidera diventare genitore sono ancora in fase di definizione - vale la pena metterle in parole prima di andare oltre." },
    2: { title: "Genitorialità", copy: "Come verrebbero effettivamente suddivise le responsabilità genitoriali quotidiane sembra un'area che merita una conversazione più approfondita." },
    3: { title: "Vita quotidiana", copy: "Sistemazione abitativa e routine quotidiane - le Sue risposte mostrano un'area in cui potrebbe essere utile una conversazione più approfondita." },
    4: { title: "Denaro", copy: "Come verrebbero condivise le spese sembra meno definito per Lei - un buon argomento da sollevare presto, non dopo il fatto." },
    5: { title: "Comunicazione", copy: "Come comunicherebbe giorno per giorno, specialmente durante i disaccordi, merita di essere discusso esplicitamente." },
    6: { title: "Limiti", copy: "Dove si collocano i Suoi limiti non è ancora del tutto definito - vale la pena chiarirlo prima con Se stesso/a, poi con un potenziale co-genitore." },
    7: { title: "Futuro", copy: "Come le cose potrebbero cambiare nel corso degli anni resta incerto per Lei - un tema da rivisitare man mano che la relazione si sviluppa." },
    8: { title: "Domande importanti", copy: "Alcune delle domande più difficili sono ancora aperte per Lei - vale la pena rifletterci prima di impegnarsi in qualcosa." },
  },
  prompts: {
    1: ["Perché state considerando entrambi questa scelta proprio ora, nello specifico?", "Cosa, col senno di poi, darebbe la sensazione che sia stata la decisione sbagliata?"],
    2: ["Come dividereste le decisioni su istruzione, salute e disciplina?", "Cosa succede se siete in disaccordo su una decisione genitoriale?"],
    3: ["Dove vorreste idealmente vivere ciascuno, e quanto vicini l'uno all'altro?", "Come sarebbe effettivamente divisa una settimana tipo?"],
    4: ["Come dividereste le spese se uno di voi guadagna significativamente di più?", "Chi coprirebbe una spesa importante e non pianificata?"],
    5: ["Con quale frequenza vi aspettate di sentirvi l'un l'altro?", "Come appare, per ciascuno di voi, un modo equo di essere in disaccordo?"],
    6: ["Cosa vorreste sapere sulle altre relazioni di ciascuno?", "Quali informazioni ciascuno di voi considera private?"],
    7: ["Cosa fareste se uno di voi volesse trasferirsi lontano?", "Come immaginate che questo accordo si evolva nell'arco di oltre 10 anni?"],
    8: ["Cosa sarebbe un punto di rottura per ciascuno di voi?", "C'è qualcosa che esitate a sollevare in questo momento?"],
  },
};

const QUIZ_CONTENT_PL: QuizContent = {
  sections: ["Dlaczego rodzicielstwo?", "Rodzicielstwo", "Życie codzienne", "Pieniądze", "Komunikacja", "Granice", "Przyszłość", "Ważne pytania"],
  questions: [
    { section: 1, type: "select", prompt: "Dlaczego chcesz zostać rodzicem?", options: ["Zawsze chciałem/chciałam wychować dziecko", "Chcę założyć rodzinę, zanim będzie dla mnie za późno", "Chcę dać dziecku kochający dom, niezależnie od tego, jak będzie wyglądał", "Szczerze mówiąc, wciąż zastanawiam się dlaczego"] },
    { section: 1, type: "select", prompt: "Jak opisałbyś/opisałabyś rodzica, jakim chciałbyś/chciałabyś być?", options: ["Zaangażowany/zaangażowana w codzienne szczegóły", "Obecny/obecna, ale dający/dająca dziecku niezależność", "Kierujący/kierująca się strukturą i rutyną", "Wciąż to sobie ustalam"] },
    { section: 1, type: "select", prompt: "Co jest dla Ciebie teraz najważniejsze w kwestii zostania rodzicem?", options: ["Czas - nie chcę czekać dużo dłużej", "Znalezienie odpowiedniej sytuacji, niezależnie od tego, kiedy to nastąpi", "Zrobienie tego w sposób, który wydaje się stabilny i przemyślany", "Jeszcze nie jestem pewny/pewna, rozważam różne opcje"] },
    { section: 2, type: "select", prompt: "Jak idealnie chciałbyś/chciałabyś dzielić obowiązki rodzicielskie?", options: ["Jak najbardziej równo", "Na podstawie grafików", "Na podstawie dochodów", "Decydować razem", "Jeszcze nie jestem pewny/pewna"] },
    { section: 2, type: "select", prompt: "Jak zapatrujesz się na dyscyplinę?", options: ["Jasne zasady i konsekwentne konsekwencje", "Łagodne prowadzenie, rozmowa o sprawach", "Zależy od sytuacji", "Coś, co musielibyśmy wspólnie ustalić"] },
    { section: 2, type: "select", prompt: "Jak bardzo chciałbyś/chciałabyś, żeby drugi rodzic był zaangażowany w codzienne decyzje?", options: ["Zaangażowany we wszystko, zawsze", "Zaangażowany w ważne decyzje, samodzielny w drobnych", "W większości samodzielny, z okazjonalnym kontaktem", "Wciąż to sobie ustalam"] },
    { section: 2, type: "select", prompt: "Co sądzisz o zaangażowaniu dalszej rodziny w wychowanie dziecka?", options: ["Bardzo zaangażowana - dziadkowie i rodzina blisko", "Czasem zaangażowana, ale to my wyznaczamy granice", "Minimalne zaangażowanie, sami wychowywalibyśmy dziecko", "Zależy całkowicie od rodziny, musiałbym/musiałabym się nad tym zastanowić"] },
    { section: 3, type: "select", prompt: "Gdzie idealnie chciałbyś/chciałabyś, żeby Twoje dziecko dorastało?", options: ["Blisko miejsca, w którym teraz mieszkam", "Jestem otwarty/otwarta na przeprowadzkę gdzie indziej", "Blisko rodziny, gdziekolwiek by nie była", "Jeszcze o tym nie myślałem/myślałam"] },
    { section: 3, type: "select", prompt: "Jak podzieliłbyś/podzieliłabyś codzienne obowiązki, takie jak odwożenie do szkoły, posiłki i kładzenie spać?", options: ["Domyślnie po równo", "W zależności od tego, kto ma tego dnia czas", "Jedno z nas przejmuje prowadzenie, drugie wspiera", "Ustalilibyśmy to na bieżąco"] },
    { section: 3, type: "select", prompt: "Ile elastyczności chcesz mieć w swoim codziennym harmonogramie rodzicielskim?", options: ["Jasna, stała rutyna sprawdza się u mnie najlepiej", "Lubię elastyczność i dostosowywanie się w razie potrzeby", "Trochę jednego i drugiego", "Jeszcze nie jestem pewny/pewna"] },
    { section: 4, type: "select", prompt: "Co sądzisz o podziale kosztów związanych z dzieckiem?", options: ["Po równo, niezależnie od tego, ile każde z nas zarabia", "Proporcjonalnie do tego, ile każde z nas zarabia", "Jedno z nas bierze na siebie więcej finansowo", "Musielibyśmy o tym porozmawiać"] },
    { section: 4, type: "select", prompt: "Jak poradziłbyś/poradziłabyś sobie z dużym, nieoczekiwanym wydatkiem na dziecko?", options: ["Podzielić go od razu, bez potrzeby dyskusji", "Najpierw porozmawiać i wspólnie zdecydować", "Na razie pokrywa go to z nas, które ma taką możliwość", "Szczerze mówiąc, jeszcze nie jestem pewny/pewna"] },
    { section: 4, type: "select", prompt: "Na ile czujesz się komfortowo, rozmawiając o pieniądzach ze współrodzicem, zanim się na coś zdecydujesz?", options: ["Bardzo komfortowo - chciałbym/chciałabym to ustalić wcześnie", "Komfortowo, ale podchodziłbym/podchodziłabym do tego stopniowo", "Trochę niekomfortowo, ale wiem, że to konieczne", "Mam tendencję do unikania rozmów o pieniądzach"] },
    { section: 5, type: "select", prompt: "Jak często spodziewasz się kontaktować ze współrodzicem w sprawach dotyczących dziecka?", options: ["Codzienne aktualizacje, nawet w drobnych sprawach", "Regularnie, w każdej ważnej sprawie", "Tylko wtedy, gdy trzeba podjąć decyzję", "Jeszcze nie wiem, co będzie realistyczne"] },
    { section: 5, type: "select", prompt: "Jaki jest Twój preferowany sposób radzenia sobie z niezgodą?", options: ["Porozmawiać o tym od razu, najlepiej osobiście", "Poświęcić trochę czasu na przemyślenie, a potem porozmawiać", "Najpierw to zapisać, żeby móc jasno się wyrazić", "Mam tendencję do unikania konfliktów, kiedy tylko mogę"] },
    { section: 5, type: "select", prompt: "Co czujesz na myśl o tym, że ktoś zadaje Ci trudne pytania na wczesnym etapie?", options: ["Wolę wiedzieć wszystko od razu", "Jest mi z tym dobrze, gdy pojawi się już trochę zaufania", "Wolałbym/wolałabym stopniowo przechodzić do głębszych tematów", "Czuję się z tym trochę niekomfortowo"] },
    { section: 6, type: "select", prompt: "Co czujesz na myśl o tym, że współrodzic spotyka się z innymi osobami?", options: ["Całkowicie w porządku, o ile jest to robione z szacunkiem", "W porządku, ale chciałbym/chciałabym ustalić pewne granice", "Chciałbym/chciałabym to omówić, zanim to się wydarzy", "Jeszcze się nad tym nie zastanawiałem/zastanawiałam"] },
    { section: 6, type: "select", prompt: "Jakimi informacjami osobistymi czujesz się komfortowo dzielić na wczesnym etapie rozmowy o współrodzicielstwie?", options: ["Praktycznie wszystkim, co istotne", "Podstawami, a więcej w miarę budowania zaufania", "Tylko tym, co bezpośrednio dotyczy rodzicielstwa", "Z natury jestem dyskretny/dyskretna w większości spraw"] },
    { section: 6, type: "select", prompt: "Co czujesz, gdy współrodzic ustala granice tego, jak bardzo jesteś zaangażowany/zaangażowana?", options: ["Całkowicie uczciwe, każde z nas powinno móc ustalać granice", "Zależy, jaka to granica", "Zawsze chciałbym/chciałabym być zaangażowany/zaangażowana najbardziej, jak to możliwe", "Jeszcze się nad tym nie zastanawiałem/zastanawiałam"] },
    { section: 7, type: "select", prompt: "Jak wyobrażasz sobie swoją rodzinę za pięć lat?", options: ["Jasna, stabilna rutyna, w którą już weszliśmy", "Wciąż dostosowujemy się do zmian", "Bardzo zależy od tego, dokąd zaprowadzi nas życie", "Szczerze mówiąc, jeszcze sobie tego nie wyobraziłem/wyobraziłam"] },
    { section: 7, type: "select", prompt: "Co się stanie, jeśli jedno z was zechce pewnego dnia się przeprowadzić?", options: ["Musielibyśmy uzgodnić to przed rozpoczęciem", "Ustalilibyśmy to razem, gdy sprawa się pojawi", "Chciałbym/chciałabym mieć elastyczność, by się przeprowadzić w razie potrzeby", "Nie jestem pewny/pewna, jak bym sobie z tym poradził/poradziła"] },
    { section: 7, type: "select", prompt: "Co czujesz na myśl o tym, że ustalenia będą się zmieniać w miarę dorastania dziecka?", options: ["Spodziewam się, że będą ewoluować, i jest mi z tym dobrze", "Chciałbym/chciałabym, żeby rzeczy pozostały jak najbardziej stałe", "Trochę jedno i drugie, zależnie od potrzeb", "Jeszcze nie myślałem/myślałam tak daleko naprzód"] },
    { section: 8, type: "select", prompt: "Co sprawiłoby, że zdecydowałbyś/zdecydowałabyś się nie kontynuować relacji z potencjalnym współrodzicem?", options: ["Niezgodność w podstawowych wartościach dotyczących rodzicielstwa", "Poczucie presji lub pospieszania do podejmowania decyzji", "Obawy dotyczące wiarygodności lub dotrzymywania zobowiązań", "Poznałbym/poznałabym to po tym, co bym poczuł/poczuła"] },
    { section: 8, type: "text", prompt: "Co najbardziej chciałbyś/chciałabyś, żeby potencjalny współrodzic zrozumiał na Twój temat, zanim ruszycie razem dalej?" },
    { section: 8, type: "text", prompt: "Jakie jest jedno pytanie, które boisz się zadać, ale wiesz, że powinieneś/powinnaś?" },
    { section: 8, type: "text", prompt: "Czy jest coś jeszcze na temat Twojej sytuacji lub oczekiwań, czym chciałbyś/chciałabyś się podzielić?" },
  ],
  strengthCopy: {
    1: { title: "Dlaczego rodzicielstwo?", copy: "Wydajesz się mieć jasność co do tego, dlaczego chcesz zostać rodzicem - warto nazwać to na głos na wczesnym etapie rozmowy." },
    2: { title: "Rodzicielstwo", copy: "Wydaje się, że masz ugruntowane wyobrażenie o tym, jak chciałbyś/chciałabyś dzielić się rodzicielstwem na co dzień." },
    3: { title: "Życie codzienne", copy: "Masz dość jasny obraz tego, jak mogłoby wyglądać codzienne życie i rutyna." },
    4: { title: "Pieniądze", copy: "Wydajesz się komfortowo i zdecydowanie podchodzić do tego, jak byłyby zarządzane pieniądze i koszty." },
    5: { title: "Komunikacja", copy: "Wydaje się, że dobrze radzisz sobie z omawianiem trudnych tematów i wspólnym szukaniem rozwiązań." },
    6: { title: "Granice", copy: "Masz jasne poczucie granic, które są dla Ciebie ważne." },
    7: { title: "Przyszłość", copy: "Wydaje się, że przemyślałeś/przemyślałaś, jak sprawy mogą się zmieniać w miarę rozwoju Twojej rodziny." },
    8: { title: "Ważne pytania", copy: "Masz jasne poczucie tego, co by się sprawdziło - a co nie - w Twoim przypadku." },
  },
  discussCopy: {
    1: { title: "Dlaczego rodzicielstwo?", copy: "Twoje odpowiedzi sugerują, że Twoje powody, by zostać rodzicem, wciąż się kształtują - warto ubrać je w słowa, zanim pójdziesz dalej." },
    2: { title: "Rodzicielstwo", copy: "Sposób, w jaki codzienne obowiązki rodzicielskie byłyby faktycznie podzielone, wydaje się tematem wartym głębszej rozmowy." },
    3: { title: "Życie codzienne", copy: "Warunki życia i codzienna rutyna - Twoje odpowiedzi pokazują obszar, w którym warto przeprowadzić głębszą rozmowę." },
    4: { title: "Pieniądze", copy: "Sposób podziału kosztów wydaje się u Ciebie mniej ustalony - dobrze poruszyć ten temat wcześnie, a nie po fakcie." },
    5: { title: "Komunikacja", copy: "Sposób, w jaki komunikowałbyś/komunikowałabyś się na co dzień, zwłaszcza podczas niezgody, warto wyraźnie omówić." },
    6: { title: "Granice", copy: "Twoje granice nie są jeszcze w pełni ustalone - warto to najpierw wyjaśnić sobie, a potem z potencjalnym współrodzicem." },
    7: { title: "Przyszłość", copy: "To, jak sprawy mogą się zmieniać na przestrzeni lat, wciąż jest dla Ciebie niepewne - warto do tego wracać w miarę rozwoju relacji." },
    8: { title: "Ważne pytania", copy: "Niektóre z trudniejszych pytań wciąż pozostają dla Ciebie otwarte - warto się z nimi zmierzyć, zanim się na coś zdecydujesz." },
  },
  prompts: {
    1: ["Dlaczego oboje rozważacie to właśnie teraz - konkretnie?", "Co sprawiłoby, że z perspektywy czasu wydawałoby się to złą decyzją?"],
    2: ["Jak podzielilibyście decyzje dotyczące edukacji, opieki zdrowotnej i dyscypliny?", "Co się stanie, jeśli nie zgodzicie się co do decyzji rodzicielskiej?"],
    3: ["Gdzie każde z Was idealnie chciałoby mieszkać i jak blisko siebie?", "Jak faktycznie wyglądałby podział typowego tygodnia?"],
    4: ["Jak podzielilibyście koszty, gdyby jedno z Was zarabiało znacznie więcej?", "Kto pokryłby nieplanowany, większy wydatek?"],
    5: ["Jak często spodziewacie się kontaktować ze sobą?", "Jak wygląda dla każdego z Was uczciwy sposób na wyrażanie niezgody?"],
    6: ["Co chcielibyście wiedzieć o innych relacjach drugiej osoby?", "Jakie informacje każde z Was uważa za prywatne?"],
    7: ["Co zrobilibyście, gdyby jedno z Was chciało się przeprowadzić daleko?", "Jak wyobrażacie sobie rozwój tego układu na przestrzeni ponad 10 lat?"],
    8: ["Co byłoby dla każdego z Was warunkiem nie do przyjęcia?", "Czy jest coś, o czym wahacie się teraz powiedzieć?"],
  },
};

export const QUIZ_CONTENT: Record<QuizLocale, QuizContent> = {
  en: QUIZ_CONTENT_EN,
  ru: QUIZ_CONTENT_RU,
  es: QUIZ_CONTENT_ES,
  pt: QUIZ_CONTENT_PT,
  fr: QUIZ_CONTENT_FR,
  de: QUIZ_CONTENT_DE,
  it: QUIZ_CONTENT_IT,
  pl: QUIZ_CONTENT_PL,
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
