// Real cover-photo URLs for the Knowledge Hub, keyed by article slug.
//
// IMPORTANT CONTEXT (Sept 2026, "и где фото?)"): the live articles Alena's
// app actually shows (IVF / Co-parenting / Sperm donor / Fertility / LGBTQ
// categories - see CATEGORIES in KnowledgeHubScreen.tsx) all previously
// pointed at "/photos/articles/<hash>.jpg". That path is not served by
// anything: grepped backend/main.py for app.mount/StaticFiles - no route
// for "/photos/articles" exists at all, and the frontend's static build has
// no such folder either. Fixed the prefix below to "/web-static/articles/",
// which IS a real, confirmed route (frontend/public/web-static/articles/ -
// same origin as SITE_BASE_URL) - but the exact files for these specific
// (older) articles are NOT present in the local working copy of that
// folder, only 9 much newer files are (see the last block below). This
// environment has no network access to the real deployed site to check
// whether those files exist there but not in the local copy, so this is a
// best-effort fix, not a confirmed one for the entries above the newer
// block - if the book-icon placeholder still shows for these after
// `eas update`, the real fix has to happen server-side (upload the actual
// photo files, or fill in a real cover_url per article in the DB - the API
// already returns a cover_url field per article, this map is only a
// fallback for when that's empty).
export const REFERENCE_ARTICLE_COVERS: Record<string, string> = {
  "fertility-by-age-real-chances-of-getting-pregnant-over-time": "/web-static/articles/1774393203144-e400da38.jpg",
  "sperm-donor-agreement-what-you-need-without-overcomplicating-it": "/web-static/articles/1774393182385-41ecda37.jpg",
  "egg-freezing-when-it-makes-sense-and-when-it-doesnt": "/web-static/articles/1774392995580-6893243c.jpg",
  "iui-vs-ivf-which-fertility-treatment-makes-sense-for-you": "/web-static/articles/1774392855065-8e1d4682.jpg",
  "how-to-find-lgbtq-friendly-donors-or-co-parents-without-guesswork": "/web-static/articles/1774392436032-380594a8.jpg",
  "lgbtq-parenting-laws-what-changes-depending-on-where-you-live": "/web-static/articles/1774392254982-db7d8f9c.jpg",
  "reciprocal-ivf-how-it-works-and-why-couples-choose-it": "/web-static/articles/1774392054218-617b606c.jpg",
  "surrogacy-for-gay-couples-costs-process-and-real-challenges": "/web-static/articles/1774391949354-8ca0b849.jpg",
  "lgbtq-co-parenting-how-it-works-and-why-more-people-are-choosing-it": "/web-static/articles/1774391763892-7443b325.jpg",
  "how-lesbian-couples-have-babies-options-costs-success-rates": "/web-static/articles/1774392135649-ff7da9c5.jpg",
  "lgbtq-parenting-options-how-to-have-a-baby-as-a-same-sex-couple": "/web-static/articles/1774391351131-6679e233.jpg",
  "co-parenting-how-it-works-and-how-to-find-the-right-partner": "/web-static/articles/1774390311217-07f08066.jpg",
  "ivf-success-rates-by-age-real-data-you-should-know-in-2026": "/web-static/articles/1774390511619-32203ba2.jpg",
  "having-a-baby-without-a-partner-options-costs-real-paths-2026": "/web-static/articles/1774390552510-a25cac4b.jpg",
  "how-to-find-a-sperm-donor-without-a-clinic-safe-real-options": "/web-static/articles/1774390859207-01600ec8.jpg",
  "male-infertility-causes-statistics-and-what-you-can-do": "/web-static/articles/1774390946761-2a35121c.jpg",
  "how-much-does-ivf-cost-in-2026-real-numbers-hidden-costs": "/web-static/articles/1774390981491-6f62ad8e.jpg",
  "why-ivf-fails-statistics-reasons-and-what-to-do-next": "/web-static/articles/1774391062651-dce3a377.jpg",
  "known-vs-anonymous-donor-pros-cons-and-long-term-impact": "/web-static/articles/1774390796421-01af0bdb.jpg",
  "using-a-donor-what-are-your-chances-of-success": "/web-static/articles/1774390768680-a1fb49d8.jpg",
  "ivf-success-rates-what-your-real-chances-look-like": "/web-static/articles/1774390742503-152f1e2f.jpg",
  "co-parenting-what-its-actually-like-not-just-the-idea": "/web-static/articles/1774390357832-c41522f5.jpg",
  "known-vs-anonymous-donor-what-people-realize-too-late": "/web-static/articles/1774390724815-9618731f.jpg",
  "how-to-choose-a-sperm-donor-without-overthinking-it": "/web-static/articles/1774388770030-fea04edb.jpg",
  "having-a-baby-without-a-partner-what-it-actually-looks-like": "/web-static/articles/1774365153529-66466037.jpg",
  "how-to-find-a-sperm-donor-without-a-clinic": "/web-static/articles/1774365007387-35d0ec0f.jpg",
  "choosing-the-right-sperm-donor-what-really-matters": "/web-static/articles/1773832110431-b6fa9753.jpg",
  "how-digital-tools-can-make-co-parenting-easier-and-more-peaceful": "/web-static/articles/1773831990892-b01f61ef.jpg",
  "building-a-healthy-and-lasting-connection-with-your-co-parent": "/web-static/articles/1773831702811-4805b1a1.jpg",
  "a-gentle-guide-to-talking-with-your-child-about-donor-conception": "/web-static/articles/1773831536203-c98054b1.jpg",
  "how-many-eggs-does-a-woman-have": "/web-static/articles/1773831334606-58b98bc2.jpg",
  "sperm-donation-laws-around-the-world-what-you-need-to-know-2026": "/web-static/articles/1772535647056-4ikn91uhb5s.jpg",
  "sperm-donation-everything-you-need-to-know-before-donating": "/web-static/articles/1772534528318-q5tiex5wqnj.jpg",
  "how-many-eggs-does-a-woman-have-a-detailed-guide-to-ovarian-reserve-fertility-age": "/web-static/articles/1772534027805-jiy9wptys6.jpg",
  "what-is-reciprocal-ivf-ropa": "/web-static/articles/1772532752697-l86qbo55k9h.jpg",
  "how-can-lesbian-couples-get-pregnant": "/web-static/articles/1772532464778-ysilrdpuzwj.jpg",
  "how-to-find-a-sperm-donor-for-free": "/web-static/articles/1773757555160-b056f394.jpg",
  "how-to-find-a-co-parent-match": "/web-static/articles/1773757730399-9b80ac2f.jpg",
  "finding-a-co-parent-online": "/web-static/articles/1773757711796-4baf9576.jpg",
  "co-parenting": "/web-static/articles/1773757642969-befca583.jpg",

  // These 9 are the ones actually confirmed present in the local
  // frontend/public/web-static/articles/ folder right now (a newer,
  // separate "Co-parenting/Parenthood" batch, from frontend/src/ui.tsx's
  // latestKnowledgeArticles array) - guaranteed to load if the DB ever
  // serves these slugs, unlike the block above.
  "co-parenting-red-flags-when-you-should-walk-away": "/web-static/articles/1786801192887-d7333d16.jpg",
  "can-co-parenting-work-without-a-romantic-relationship": "/web-static/articles/1786800884924-51087667.jpg",
  "co-parenting-agreement-what-to-discuss-before-having-a-child": "/web-static/articles/1786800288283-2bb1dadc.jpg",
  "questions-to-ask-a-potential-co-parent-before-you-move-forward": "/web-static/articles/1786799902679-855ba763.jpg",
  "how-to-find-a-co-parent-where-to-start-and-what-to-look-for": "/web-static/articles/1786799585487-49cb88e4.jpg",
  "what-is-co-parenting-how-to-know-if-it-could-be-right-for-you": "/web-static/articles/1786799400356-2c5b1877.jpg",
  "how-to-choose-your-path-to-parenthood-questions-to-consider": "/web-static/articles/1786799040979-03f84347.jpg",
  "different-ways-to-become-a-parent-your-options-explained": "/web-static/articles/1786715854481-9e2ad679.jpg",
  "am-i-ready-to-become-a-parent-how-to-know-when-to-start": "/web-static/articles/1786715655186-9f49a617.jpg",
};
