import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, createApiClient } from "./api";
import { LIKES_COPY } from "./member-account-reference";
import {
  AccountDialog,
  AccountIcon,
  AccountPremium,
  MemberError,
  MemberLoading,
  memberBoolean,
  memberRow,
  memberText as text,
  notifyMemberChanged,
  useMemberResource,
  type MemberLocale,
  type MemberRow,
} from "./member-account";
import {
  Icon,
  profileAge,
  profileCountry,
  profileList,
} from "./member-profile";
import { PROFILE_COPY } from "./member-profile-reference";
import { UserAvatar } from "./user-avatar";

const api = createApiClient("/api");
export const LIKE_TABS = [
  "likesYou",
  "matches",
  "myLikes",
  "visitors",
  "clinics",
  "lawyers",
] as const;
type Tab = (typeof LIKE_TABS)[number];
type CardProps = {
  item: MemberRow;
  locale: MemberLocale;
  onLike: (item: MemberRow) => void;
  onMessage: (item: MemberRow) => void;
};
const COPY = {
  en: {
    error: "This action could not be completed. Please try again.",
    premium: "Upgrade to Premium",
    remove: "Remove from favorites",
    website: "Website",
    noMatches: "No matches yet. Keep browsing profiles!",
    myLikesEmpty: "You haven't liked anyone yet. Start browsing profiles!",
  },
  ru: {
    error: "Не удалось выполнить действие. Попробуйте ещё раз.",
    premium: "Перейти на Premium",
    remove: "Удалить из избранного",
    website: "Сайт",
    noMatches: "Совпадений пока нет. Продолжайте смотреть анкеты!",
    myLikesEmpty: "Вы пока никого не лайкнули. Начните просмотр анкет!",
  },
  es: {
    error: "No se pudo completar la acción. Inténtalo de nuevo.",
    premium: "Mejorar a Premium",
    remove: "Quitar de favoritos",
    website: "Sitio web",
    noMatches: "Aún no hay coincidencias. ¡Sigue explorando perfiles!",
    myLikesEmpty: "Aún no te ha gustado nadie. ¡Empieza a explorar perfiles!",
  },
};
export function likesProfile(item: MemberRow): MemberRow {
  const data = memberRow(item.data);
  return {
    ...item,
    id: text(item.profileId, item.id, data.id),
    age: profileAge(item),
    countryName: profileCountry(item.country ?? data.country, "en"),
  };
}
export function likedRows(value: unknown): MemberRow[] {
  return Array.isArray(value) ? value.map(memberRow) : [];
}
export function initialLikesTab(value: string | null): Tab {
  return LIKE_TABS.includes(value as Tab) ? (value as Tab) : "likesYou";
}
export function safeExternalWebsite(value: unknown) {
  const url = text(value);
  return /^https?:\/\//i.test(url) ? url : "";
}

function Favourite({
  item,
  kind,
  locale,
  pending,
  remove,
}: {
  item: MemberRow;
  kind: "clinics" | "lawyers";
  locale: MemberLocale;
  pending: boolean;
  remove: () => void;
}) {
  const data = memberRow(item.data),
    c = COPY[locale];
  const name = text(item.name, data.name),
    id = text(item.id),
    slug = text(item.slug, data.slug, id);
  const image = text(
    item.logoUrl,
    item.photoUrl,
    item.imageUrl,
    item.avatarUrl,
    data.logoUrl,
    data.photoUrl,
    data.imageUrl,
    memberRow(data.logo).url,
    memberRow(data.photo).url,
  );
  const location =
    text(data.location, data.address) ||
    [
      text(item.city, data.city),
      profileCountry(item.country ?? data.country, locale),
    ]
      .filter(Boolean)
      .join(", ");
  const candidates =
    kind === "clinics"
      ? [
          item.services,
          data.services,
          data.serviceCategories,
          data.treatments,
          data.specialties,
        ]
      : [
          item.practiceAreas,
          data.practiceAreas,
          data.practice_areas,
          data.specialties,
          data.services,
        ];
  const tags = [
    ...new Set(
      (candidates.map(profileList).find((list) => list.length) || [])
        .map((value) =>
          typeof value === "string"
            ? value
            : text(
                memberRow(value).name,
                memberRow(value).label,
                memberRow(value).title,
                memberRow(value).value,
              ),
        )
        .filter(Boolean),
    ),
  ].slice(0, 12);
  const description = text(
    item.description,
    item.about,
    item.aboutHtml,
    data.description,
    data.shortDescription,
    data.about,
    data.aboutHtml,
  );
  const plain = description
    ? new DOMParser().parseFromString(description, "text/html").body
        .textContent || ""
    : "";
  const website = safeExternalWebsite(
    item.websiteUrl ??
      item.website ??
      data.websiteUrl ??
      data.website ??
      data.url,
  );
  const href = `/${locale}/${kind}/${encodeURIComponent(slug)}`;
  return (
    <article className="likes-saved-card">
      <Link className="likes-saved-media" to={href} aria-label={name}>
        <UserAvatar src={image} name={name} />
      </Link>
      <div className="likes-saved-copy">
        <Link className="likes-saved-title" to={href}>
          {name}
        </Link>
        <div className="likes-saved-meta">
          {location && (
            <span>
              <Icon name="locationIcon" />
              {location}
            </span>
          )}
          {kind === "lawyers" && website && (
            <a href={website} target="_blank" rel="noopener noreferrer">
              <AccountIcon name="globeIcon" />
              {c.website}
            </a>
          )}
        </div>
        {tags.length > 0 && (
          <div className="likes-saved-tags">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
        {plain && <p>{plain}</p>}
      </div>
      <button
        className="likes-saved-remove"
        type="button"
        aria-label={`${c.remove}: ${name}`}
        aria-busy={pending}
        disabled={pending}
        onClick={remove}
      >
        <AccountIcon name="savedFavouriteIcon" />
        {LIKES_COPY[locale].saved}
      </button>
    </article>
  );
}

export function MemberLikes({
  session,
  locale,
  renderProfileCard,
}: {
  session: { user: MemberRow } | null;
  locale: MemberLocale;
  renderProfileCard: (props: CardProps) => ReactNode;
}) {
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  return (
    <LikesContent
      key={`${session.user.id}:${locale}`}
      session={session}
      locale={locale}
      renderProfileCard={renderProfileCard}
    />
  );
}

function LikesContent({
  session,
  locale,
  renderProfileCard,
}: {
  session: { user: MemberRow };
  locale: MemberLocale;
  renderProfileCard: (props: CardProps) => ReactNode;
}) {
  const [search, setSearch] = useSearchParams();
  const tab = initialLikesTab(search.get("tab"));
  const likes = useMemberResource<MemberRow>("/member/likes", true);
  const visitors = useMemberResource<MemberRow>(
    "/member/profile-views",
    tab === "visitors",
  );
  const favourites = useMemberResource<MemberRow>(
    "/member/favourites",
    tab === "clinics" || tab === "lawyers",
  );
  const [dialog, setDialog] = useState<"premium" | "verification" | null>(null);
  const [error, setError] = useState(false),
    [pendingId, setPendingId] = useState("");
  const inFlight = useRef(false),
    alive = useRef(true),
    readThrough = useRef(0);
  const navigate = useNavigate(),
    c = LIKES_COPY[locale],
    copy = COPY[locale],
    common = PROFILE_COPY[locale];
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setError(false);
  }, [tab]);
  useEffect(() => {
    const id = Number(likes.data?.readThroughId);
    if (
      tab !== "likesYou" ||
      !Number.isSafeInteger(id) ||
      id <= readThrough.current
    )
      return;
    readThrough.current = id;
    void api
      .post("/member/notifications/likes/read", { readThroughId: id })
      .then(() => {
        if (alive.current) notifyMemberChanged();
      })
      .catch(() => {
        if (alive.current) readThrough.current = 0;
      });
  }, [tab, likes.data?.readThroughId]);
  const select = (next: Tab) => {
    setSearch(
      (current) => {
        const params = new URLSearchParams(current);
        params.set("tab", next);
        return params;
      },
      { replace: true },
    );
  };
  const act = async (kind: "like" | "message", item: MemberRow) => {
    const id = text(item.profileId, item.id);
    if (
      inFlight.current ||
      !id ||
      (kind === "like" &&
        (memberBoolean(item.likedByViewer) || memberBoolean(item.likeReadOnly)))
    )
      return;
    if (session.user.profileVerified === false) {
      setDialog("verification");
      return;
    }
    inFlight.current = true;
    setPendingId(id);
    setError(false);
    try {
      if (kind === "like") {
        await api.post(`/member/likes/${encodeURIComponent(id)}`);
        const data = await api.get<MemberRow>("/member/likes");
        if (alive.current) {
          likes.replace(data);
          if (visitors.data)
            visitors.replace({
              ...visitors.data,
              items: likedRows(visitors.data.items).map((row) =>
                text(row.profileId, row.id) === id
                  ? { ...row, likedByViewer: true }
                  : row,
              ),
            });
          notifyMemberChanged();
        }
      } else {
        const result = await api.post<MemberRow>("/member/conversations", {
          targetProfileId: id,
        });
        const conversation = text(result.conversationId);
        if (!conversation) throw new Error("Missing conversation");
        if (alive.current)
          navigate(
            `/${locale}/chat/${encodeURIComponent(conversation)}`,
          );
      }
    } catch (failure) {
      if (alive.current) {
        if (failure instanceof ApiError && failure.status === 401)
          navigate(`/${locale}/auth/login`);
        else if (failure instanceof ApiError && failure.status === 402)
          setDialog("premium");
        else setError(true);
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setPendingId("");
    }
  };
  const remove = async (kind: "clinics" | "lawyers", item: MemberRow) => {
    const id = text(item.id);
    if (!id || inFlight.current) return;
    inFlight.current = true;
    setPendingId(`${kind}:${id}`);
    setError(false);
    try {
      await api.delete(`/member/favourites/${kind}/${encodeURIComponent(id)}`);
      const result = await api.get<MemberRow>("/member/favourites");
      if (alive.current) favourites.replace(result);
    } catch {
      if (alive.current) setError(true);
    } finally {
      inFlight.current = false;
      if (alive.current) setPendingId("");
    }
  };
  const source =
    tab === "visitors"
      ? visitors
      : tab === "clinics" || tab === "lawyers"
        ? favourites
        : likes;
  const isDirectory = tab === "clinics" || tab === "lawyers";
  const rows = likedRows(
    tab === "visitors" ? source.data?.items : source.data?.[tab],
  );
  const locked =
    (tab === "likesYou" && memberBoolean(source.data?.likesYouLocked)) ||
    (tab === "visitors" && memberBoolean(source.data?.locked));
  const total =
    Number(
      tab === "visitors" ? source.data?.total : source.data?.likesYouCount,
    ) || 0;
  const empty = {
    likesYou: c.noLikes,
    matches: copy.noMatches,
    myLikes: copy.myLikesEmpty,
    visitors: c.noViews,
    clinics: c.savedClinics,
    lawyers: c.savedLawyers,
  }[tab];
  return (
    <section className="member-account-surface member-likes">
      <h1>{c.likesTitle}</h1>
      <div className="member-likes-tabs-scroll">
        <div
          className="member-likes-tabs"
          role="tablist"
          aria-label={c.likesTitle}
        >
          {LIKE_TABS.map((key, index) => (
            <button
              type="button"
              key={key}
              id={`likes-tab-${key}`}
              role="tab"
              aria-selected={tab === key}
              aria-controls="likes-panel"
              tabIndex={tab === key ? 0 : -1}
              onClick={() => select(key)}
              onKeyDown={(event) => {
                let next: number | undefined;
                if (event.key === "ArrowRight")
                  next = (index + 1) % LIKE_TABS.length;
                if (event.key === "ArrowLeft")
                  next = (index + LIKE_TABS.length - 1) % LIKE_TABS.length;
                if (event.key === "Home") next = 0;
                if (event.key === "End") next = LIKE_TABS.length - 1;
                if (next === undefined) return;
                event.preventDefault();
                select(LIKE_TABS[next]);
                document
                  .getElementById(`likes-tab-${LIKE_TABS[next]}`)
                  ?.focus();
              }}
            >
              {c[key]}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="account-error" role="alert">
          {copy.error}
        </p>
      )}
      <div
        id="likes-panel"
        key={tab}
        className="member-likes-panel"
        role="tabpanel"
        aria-labelledby={`likes-tab-${tab}`}
        aria-busy={!source.data && source.error === undefined}
      >
        {source.error !== undefined ? (
          <MemberError
            locale={locale}
            status={source.error}
            retry={source.retry}
          />
        ) : !source.data ? (
          <MemberLoading locale={locale} />
        ) : locked && total > 0 ? (
          <div className="member-likes-paywall">
            {tab === "visitors" ? (
              <AccountIcon name="eyeIcon" />
            ) : (
              <Icon name="thumbsUpIcon" />
            )}
            <h2>
              {total} {tab === "visitors" ? c.peopleViewed : c.peopleLiked}
            </h2>
            <p>{tab === "visitors" ? c.viewsPremium : c.likesPremium}</p>
            <button
              className="account-primary"
              onClick={() => setDialog("premium")}
            >
              <AccountIcon name="lockIcon" />
              {copy.premium}
            </button>
          </div>
        ) : !rows.length ? (
          <p className="member-likes-empty">{empty}</p>
        ) : isDirectory ? (
          <div className="likes-saved-grid">
            {rows.map((item) => (
              <Favourite
                key={text(item.id)}
                item={item}
                kind={tab as "clinics" | "lawyers"}
                locale={locale}
                pending={pendingId === `${tab}:${text(item.id)}`}
                remove={() => void remove(tab as "clinics" | "lawyers", item)}
              />
            ))}
          </div>
        ) : (
          <div className="member-likes-grid">
            {rows.map((item) => {
              const normalized = likesProfile(item);
              normalized.countryName = profileCountry(
                item.country ?? memberRow(item.data).country,
                locale,
              );
              if (tab === "myLikes" || tab === "matches")
                normalized.likedByViewer = true;
              return (
                <fieldset
                  key={text(normalized.id)}
                  disabled={pendingId === text(normalized.id)}
                  aria-busy={pendingId === text(normalized.id)}
                >
                  {renderProfileCard({
                    item: normalized,
                    locale,
                    onLike: (value) => void act("like", value),
                    onMessage: (value) => void act("message", value),
                  })}
                </fieldset>
              );
            })}
          </div>
        )}
      </div>
      {dialog === "premium" && (
        <AccountPremium locale={locale} close={() => setDialog(null)} />
      )}
      {dialog === "verification" && (
        <AccountDialog
          title={common.verifyProfile}
          locale={locale}
          close={() => setDialog(null)}
        >
          <p>{common.verifyBody}</p>
          <div className="account-dialog-actions">
            <button
              className="account-secondary"
              onClick={() => setDialog(null)}
            >
              {common.notNow}
            </button>
            <Link
              className="account-primary"
              to={`/${locale}/profile/verification`}
            >
              {common.verifyNow}
            </Link>
          </div>
        </AccountDialog>
      )}
    </section>
  );
}
