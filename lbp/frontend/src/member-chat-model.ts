import { CHAT_COPY } from './member-chat-reference';
export type ChatRow = Record<string, unknown>;
export type ChatLocale = keyof typeof CHAT_COPY;
export const chatText = (...values: unknown[]) => {
  for (const value of values) if ((typeof value === 'string' || typeof value === 'number') && String(value).trim() && !['null','undefined','—'].includes(String(value))) return String(value).trim();
  return '';
};
export const chatRow = (value: unknown): ChatRow => value && typeof value === 'object' && !Array.isArray(value) ? value as ChatRow : {};
export const chatName = (item: ChatRow, locale: ChatLocale) => chatText(item.otherDisplayName,item.peerDisplayName,item.displayName,item.title) || CHAT_COPY[locale].member;
export const chatPeer = (item: ChatRow) => chatText(item.otherProfileId,item.other_profile_id);
export const chatSupport = (item: ChatRow) => chatText(item.otherRole,item.other_role).toUpperCase() === 'SUPPORT' || /support|поддерж/i.test(chatName(item,'en'));
export const chatInitials = (name: unknown) => (chatText(name) || 'LB').normalize('NFC').split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]).join('').toLocaleUpperCase();
export const chatPath = (locale: string, id?: unknown) => `/${locale}/chat${chatText(id) ? '/'+encodeURIComponent(chatText(id)) : ''}`;
export function legacyChatPath(pathname: string, search = '', hash = '') {
  const parts=pathname.split('/').filter(Boolean),locale=['en','ru','es'].includes(parts[0]) ? parts.shift()! : 'en';
  parts.shift();
  const params=new URLSearchParams(search),id=parts[0] || params.get('conversation') || '';
  params.delete('conversation');
  let decoded=id;try { decoded=decodeURIComponent(id); } catch { /* Keep malformed IDs as an unavailable route. */ }
  return chatPath(locale,decoded)+(params.size?'?'+params.toString():'')+hash;
}
export function chatDate(value: unknown) {
  let raw=chatText(value);if(!raw)return null;
  if(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?$/.test(raw))raw=raw.replace(' ','T')+'Z';
  const date=new Date(raw);return Number.isNaN(date.getTime())?null:date;
}
export const chatDayKey=(date:Date|null)=>date?`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`:'';
export const chatTime=(value:unknown,locale:ChatLocale)=>chatDate(value)?.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'})||'';
export function chatDay(value:unknown,locale:ChatLocale,now=new Date()) {const date=chatDate(value);return !date?'':chatDayKey(date)===chatDayKey(now)?CHAT_COPY[locale].today:date.toLocaleDateString(locale,{day:'numeric',month:'long',year:date.getFullYear()===now.getFullYear()?undefined:'numeric'});}
export function chatListTime(item:ChatRow,locale:ChatLocale,now=new Date()) {const raw=item.lastMessageTime||item.lastMessageAt||item.updatedAt||item.updated_at;if(/^\d{1,2}:\d{2}$/.test(chatText(raw)))return chatText(raw);const date=chatDate(raw);return !date?'':chatDayKey(date)===chatDayKey(now)?chatTime(date.toISOString(),locale):date.toLocaleDateString(locale,{day:'numeric',month:'short',year:date.getFullYear()===now.getFullYear()?undefined:'numeric'});}
export const chatOnline=(item:ChatRow,now=Date.now())=>{const d=chatDate(item.otherLastSeenAt||item.other_last_seen_at);return !!d&&now-d.getTime()>=-60000&&now-d.getTime()<=120000;};
export function chatActivity(item:ChatRow,locale:ChatLocale,now=new Date()) {
  if(chatSupport(item))return CHAT_COPY[locale].support;
  const date=chatDate(item.otherLastSeenAt||item.other_last_seen_at);
  if(!date)return [item.otherCity,item.otherCountry].filter(Boolean).join(', ');
  if(chatOnline(item,now.getTime()))return {en:'Online',ru:'В сети',es:'En línea'}[locale];
  const language={en:'en-GB',ru:'ru-RU',es:'es-ES'}[locale];
  const time=date.toLocaleTimeString(language,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const dayDifference=Math.round((new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()-new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime())/86400000);
  const formattedDate=date.toLocaleDateString(language,{day:'2-digit',month:'2-digit',year:'numeric'});
  return {en:dayDifference===0?`Last seen today at ${time}`:dayDifference===1?`Last seen yesterday at ${time}`:`Last seen ${formattedDate} at ${time}`,ru:dayDifference===0?`Был(а) сегодня в ${time}`:dayDifference===1?`Был(а) вчера в ${time}`:`Был(а) ${formattedDate} в ${time}`,es:dayDifference===0?`Última vez hoy a las ${time}`:dayDifference===1?`Última vez ayer a las ${time}`:`Última vez el ${formattedDate} a las ${time}`}[locale];
}
export const chatFileSize=(size:number)=>size<1024?`${size} B`:size<1024*1024?`${(size/1024).toFixed(1)} KB`:`${(size/(1024*1024)).toFixed(1)} MB`;
export function chatMediaUrl(value:unknown) {const url=chatText(value);if(!url)return '';if(url.startsWith('/')&&!url.startsWith('//'))return url;try{const parsed=new URL(url);return ['https:','http:'].includes(parsed.protocol)?url:'';}catch{return '';}}
export const chatImage=(value:unknown)=>/\.(?:jpe?g|png|webp|gif)(?:[?#]|$)/i.test(chatText(value));
export function chatPreview(item:ChatRow,profileId:unknown,locale:ChatLocale){const c=CHAT_COPY[locale],own=!!chatText(profileId)&&chatText(item.lastMessageSenderProfileId)===chatText(profileId);return (own?c.you+': ':'')+(chatImage(item.lastMessageMediaUrl)?'📷 '+c.photo:chatText(item.lastMessage,item.lastMessageBody)||c.noMessages);}
export function chatSearch(items:ChatRow[],query:string,profileId:unknown,locale:ChatLocale){const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return items.filter(item=>{const tokens=(chatName(item,locale)+' '+chatPreview(item,profileId,locale)).toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u);return words.every(word=>tokens.some(token=>token.startsWith(word)));});}
export const chatDelivery=(message:ChatRow)=>message.readAt||message.read_at?'read':message.deliveredAt||message.delivered_at?'delivered':'sent';
export function mergeChatMessages(previous:ChatRow[],incoming:ChatRow[]){const items=new Map(previous.map(m=>[chatText(m.id),m]));for(const m of incoming)items.set(chatText(m.id),m);return [...items.values()].sort((a,b)=>(chatDate(a.created_at||a.createdAt)?.getTime()||0)-(chatDate(b.created_at||b.createdAt)?.getTime()||0)||chatText(a.id).localeCompare(chatText(b.id),undefined,{numeric:true}));}
export function chatAttachmentError(file:Pick<File,'type'|'size'>,locale:ChatLocale){if(file.size>10*1024*1024)return CHAT_COPY[locale].attachmentTooLarge;if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))return {en:'Only JPEG, PNG, WebP images and PDF files are supported.',ru:'Поддерживаются JPEG, PNG, WebP и PDF.',es:'Se admiten imágenes JPEG, PNG, WebP y archivos PDF.'}[locale];return '';}
export const CHAT_REPORT_REASONS={en:['Spam','Harassment','Inappropriate Content','Fake Profile','Scam','Other'],ru:['Спам','Домогательства','Недопустимый контент','Фейковый профиль','Мошенничество','Другое'],es:['Spam','Acoso','Contenido inapropiado','Perfil falso','Estafa','Otro']};
