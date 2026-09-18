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
import { SlidingTabs } from "./sliding-tabs";

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
const COPY_BASE = {
  en: {
    error: "This action could not be completed. Please try again.",
    likeLimit: "You have reached today's like limit. You can like more profiles tomorrow.",
    chatLimit: "You have reached today's new chat limit. You can start more chats tomorrow.",
    profileUnavailable: "This profile is no longer available.",
    chatUnavailable: "This conversation cannot be opened right now.",
    premium: "Upgrade to Premium",
    remove: "Remove from favorites",
    website: "Website",
    noMatches: "No matches yet. Keep browsing profiles!",
    myLikesEmpty: "You haven't liked anyone yet. Start browsing profiles!",
  },
  ru: {
    error: "Не удалось выполнить действие. Попробуйте ещё раз.",
    likeLimit: "Дневной лимит лайков исчерпан. Новые лайки будут доступны завтра.",
    chatLimit: "Дневной лимит новых чатов исчерпан. Новые диалоги будут доступны завтра.",
    profileUnavailable: "Этот профиль больше недоступен.",
    chatUnavailable: "Сейчас не удалось открыть этот диалог.",
    premium: "Перейти на Premium",
    remove: "Удалить из избранного",
    website: "Сайт",
    noMatches: "Совпадений пока нет. Продолжайте смотреть анкеты!",
    myLikesEmpty: "Вы пока никого не лайкнули. Начните просмотр анкет!",
  },
  es: {
    error: "No se pudo completar la acción. Inténtalo de nuevo.",
    likeLimit: "Has alcanzado el límite diario de Me gusta. Podrás indicar más perfiles mañana.",
    chatLimit: "Has alcanzado el límite diario de chats nuevos. Podrás iniciar más chats mañana.",
    profileUnavailable: "Este perfil ya no está disponible.",
    chatUnavailable: "No se puede abrir esta conversación ahora mismo.",
    premium: "Mejorar a Premium",
    remove: "Quitar de favoritos",
    website: "Sitio web",
    noMatches: "Aún no hay coincidencias. ¡Sigue explorando perfiles!",
    myLikesEmpty: "Aún no te ha gustado nadie. ¡Empieza a explorar perfiles!",
  },
};
const COPY = {
  ...COPY_BASE,
  pt: { error: "Não foi possível concluir esta ação. Tenta novamente.", likeLimit: "Atingiste o limite diário de gostos. Podes gostar de mais perfis amanhã.", chatLimit: "Atingiste o limite diário de novas conversas. Podes iniciar mais conversas amanhã.", profileUnavailable: "Este perfil já não está disponível.", chatUnavailable: "Não é possível abrir esta conversa neste momento.", premium: "Atualizar para Premium", remove: "Remover dos favoritos", website: "Website", noMatches: "Ainda não há correspondências. Continua a explorar perfis!", myLikesEmpty: "Ainda não gostaste de ninguém. Começa a explorar perfis!" },
  fr: { error: "Cette action n'a pas pu être effectuée. Veuillez réessayer.", likeLimit: "Vous avez atteint la limite quotidienne de J'aime. Vous pourrez aimer d'autres profils demain.", chatLimit: "Vous avez atteint la limite quotidienne de nouvelles discussions. Vous pourrez démarrer d'autres discussions demain.", profileUnavailable: "Ce profil n'est plus disponible.", chatUnavailable: "Cette conversation ne peut pas être ouverte pour le moment.", premium: "Passer à Premium", remove: "Retirer des favoris", website: "Site web", noMatches: "Pas encore de matchs. Continuez à parcourir les profils !", myLikesEmpty: "Vous n'avez encore aimé personne. Commencez à parcourir les profils !" },
  de: { error: "Diese Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.", likeLimit: "Du hast das heutige Like-Limit erreicht. Morgen kannst du wieder mehr Profile liken.", chatLimit: "Du hast das heutige Limit für neue Chats erreicht. Morgen kannst du wieder mehr Chats starten.", profileUnavailable: "Dieses Profil ist nicht mehr verfügbar.", chatUnavailable: "Diese Unterhaltung kann gerade nicht geöffnet werden.", premium: "Auf Premium upgraden", remove: "Aus Favoriten entfernen", website: "Website", noMatches: "Noch keine Matches. Schau dir weiter Profile an!", myLikesEmpty: "Du hast noch niemandem ein Like gegeben. Schau dir Profile an!" },
  it: { error: "Non è stato possibile completare questa azione. Riprova.", likeLimit: "Hai raggiunto il limite giornaliero di Mi piace. Potrai mettere altri Mi piace domani.", chatLimit: "Hai raggiunto il limite giornaliero di nuove chat. Potrai avviare altre chat domani.", profileUnavailable: "Questo profilo non è più disponibile.", chatUnavailable: "Al momento non è possibile aprire questa conversazione.", premium: "Passa a Premium", remove: "Rimuovi dai preferiti", website: "Sito web", noMatches: "Ancora nessun match. Continua a sfogliare i profili!", myLikesEmpty: "Non hai ancora messo Mi piace a nessuno. Inizia a sfogliare i profili!" },
  pl: { error: "Nie udało się wykonać tej czynności. Spróbuj ponownie.", likeLimit: "Osiągnięto dzienny limit polubień. Jutro będziesz mógł(-a) polubić kolejne profile.", chatLimit: "Osiągnięto dzienny limit nowych czatów. Jutro będziesz mógł(-a) rozpocząć kolejne czaty.", profileUnavailable: "Ten profil nie jest już dostępny.", chatUnavailable: "Nie można teraz otworzyć tej rozmowy.", premium: "Przejdź na Premium", remove: "Usuń z ulubionych", website: "Strona internetowa", noMatches: "Brak dopasowań. Przeglądaj dalej profile!", myLikesEmpty: "Nikogo jeszcze nie polubiłeś(-aś). Zacznij przeglądać profile!" },
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
  const [error, setError] = useState(""),
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
    setError("");
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
    inFlight.current = true;
    setPendingId(id);
    setError("");
    try {
      if (kind === "like") {
        const result = await api.post<MemberRow>(
          `/member/likes/${encodeURIComponent(id)}`,
        );
        const matchedConversation = memberBoolean(result.matched)
          ? text(result.conversationId)
          : "";
        if (matchedConversation && alive.current) {
          notifyMemberChanged();
          navigate(
            `/${locale}/chat/${encodeURIComponent(matchedConversation)}`,
          );
          return;
        }
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
        else if (
          failure instanceof ApiError &&
          failure.status === 403 &&
          /verif/i.test(failure.message)
        )
          setDialog("verification");
        else if (failure instanceof ApiError && failure.status === 429)
          setError(kind === "like" ? copy.likeLimit : copy.chatLimit);
        else if (
          failure instanceof ApiError &&
          [403, 404, 409, 422].includes(failure.status)
        )
          setError(kind === "like" ? copy.profileUnavailable : copy.chatUnavailable);
        else setError(copy.error);
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
    setError("");
    try {
      await api.delete(`/member/favourites/${kind}/${encodeURIComponent(id)}`);
      const result = await api.get<MemberRow>("/member/favourites");
      if (alive.current) favourites.replace(result);
    } catch {
      if (alive.current) setError(copy.error);
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
        <SlidingTabs
          className="member-likes-tabs"
          label={c.likesTitle}
          value={tab}
          onChange={select}
          options={LIKE_TABS.map((key) => ({
            value: key,
            label: c[key],
            id: `likes-tab-${key}`,
            controls: "likes-panel",
          }))}
        />
      </div>
      {error && (
        <p className="account-error" role="alert">
          {error}
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
