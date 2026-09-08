import { TOOLS_FIELD_TRANSLATIONS, TOOLS_TRANSLATIONS, TOOLS_OPTIONS, TOOLS_LANGUAGES } from './member-tools-reference';
export type Locale = 'en' | 'ru' | 'es';
export type Row = Record<string, unknown>;
export const row = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
export const text = (v: unknown) => typeof v === 'string' || typeof v === 'number' ? String(v) : '';
export const list = (v: unknown): string[] => Array.isArray(v) ? v.map(x => text(typeof x === 'object' ? row(x).code || row(x).name : x)).filter(Boolean) : [];
export const flag = (v: unknown) => v === true || /^(true|1|yes|approved)$/i.test(text(v));
export function fieldLabel(locale: Locale, key: string, value: string) {
 const fields = TOOLS_FIELD_TRANSLATIONS as Record<string, Record<string, Record<string,string>>>;
 const all = TOOLS_TRANSLATIONS as Record<string, Record<string,string>>;
 const options = TOOLS_OPTIONS as Record<string,string[][]>;
 return fields[locale]?.[key]?.[value] || all[locale]?.[value] || options[key]?.find(x=>x[0]===value)?.[1] || value;
}
export function countryLabel(value: string, locale: Locale) {
 try { return /^[a-z]{2}$/i.test(value) ? new Intl.DisplayNames([locale],{type:'region'}).of(value.toUpperCase()) || value : value; } catch { return value; }
}
export function languageLabel(value: string, locale: Locale) {
 try { return TOOLS_LANGUAGES.includes(value) ? new Intl.DisplayNames([locale],{type:'language'}).of(value) || value : value; } catch { return value; }
}
export const languageCode = (value: string) => TOOLS_LANGUAGES.find(code=>code===value.toLowerCase() || (['en','ru','es'] as Locale[]).some(l=>languageLabel(code,l).toLowerCase()===value.toLowerCase())) || value;
export type Matching = {profileType:string;lookingFor:string[];donorType:string[];desiredDonorContact:string};
export type Flow = Matching & {goal:string};
export const needsContact = (a: Matching) => a.donorType.length>0 || a.profileType!=='SINGLE_MAN' && a.lookingFor.some(v=>v==='SPERM_DONOR'||v==='EGG_DONOR');
export const matchingComplete = (a: Matching) => Boolean(a.profileType && (a.donorType.length || a.lookingFor.length) && (!needsContact(a)||a.desiredDonorContact));
export const selectionStep = (a: Flow) => a.goal==='parent' && ['SINGLE_WOMAN','LESBIAN_COUPLE','HETERO_COUPLE'].includes(a.profileType) || a.goal==='donor' && a.profileType==='HETERO_COUPLE';
export const totalSteps = (a: Flow) => !a.profileType || !a.goal ? 2 : 2 + Number(selectionStep(a)) + Number(['donor','both'].includes(a.goal)||needsContact(a));
export const flowKind = (a: Flow, step:number) => step===1 ? 'who' : step===2 ? 'goal' : needsContact(a) && step===(selectionStep(a)?4:3) ? 'contact' : a.profileType==='HETERO_COUPLE' ? a.goal==='donor' ? 'heteroDonor' : 'heteroParent' : 'parent';
export const stepComplete = (a: Flow, step:number) => { const kind=flowKind(a,step); return kind==='who' ? !!a.profileType : kind==='goal' ? !!a.goal : kind==='contact' ? !!a.desiredDonorContact : kind==='heteroDonor' ? !!a.donorType.length : !!a.lookingFor.length; };
export function chooseFlow(a: Flow, step:number, value:string): Flow {
 const next={...a,lookingFor:[...a.lookingFor],donorType:[...a.donorType]};
 const kind=flowKind(a,step);
 if(kind==='who') return a.profileType===value ? a : {profileType:value,goal:'',lookingFor:[],donorType:[],desiredDonorContact:''};
 if(kind==='goal') {
  next.goal=value;next.lookingFor=[];next.donorType=[];next.desiredDonorContact='';
  if(['SINGLE_MAN','GAY_COUPLE'].includes(a.profileType)) { if(value!=='parent')next.donorType=['SPERM'];if(value!=='donor')next.lookingFor=['CO_PARENTING_PARTNER']; }
  else if(['SINGLE_WOMAN','LESBIAN_COUPLE'].includes(a.profileType)&&value==='donor')next.donorType=['EGG'];
 } else if(kind==='contact')next.desiredDonorContact=value;
 else if(kind==='heteroDonor')next.donorType=value==='BOTH'?['SPERM','EGG']:[value];
 else if(kind==='heteroParent')next.lookingFor=[value];
 else {next.lookingFor=value==='coparent'?['CO_PARENTING_PARTNER']:value==='both'?['SPERM_DONOR','CO_PARENTING_PARTNER']:['SPERM_DONOR'];if(!needsContact(next))next.desiredDonorContact='';}
 return next;
}
export function flowDraft(a:Matching):Flow {return {...a,lookingFor:[...a.lookingFor],donorType:[...a.donorType],goal:a.lookingFor.length&&a.donorType.length?'both':a.donorType.length?'donor':a.lookingFor.length?'parent':'',desiredDonorContact:a.desiredDonorContact==='CONTACT_BY_AGREEMENT'?'LIMITED_CONTACT':a.desiredDonorContact};}
export type Photo = {id:string;publicUrl:string;avatarUrl:string;position:number;status:string;moderationStatus:string};
export function photosOf(value:unknown): Photo[] {
 const source=Array.isArray(value)?value:[];
 return source.map(v=>{const p=row(v);return {id:text(p.id),publicUrl:text(p.publicUrl||p.publicurl||p.url),avatarUrl:text(p.avatarUrl||p.avatarurl),position:Number(p.position)||0,status:text(p.status||'ACTIVE').toUpperCase(),moderationStatus:text(p.moderationStatus||p.moderationstatus||'APPROVED').toUpperCase()};}).filter(p=>p.id&&['ACTIVE','PENDING','REJECTED'].includes(p.status));
}
export function managedPhotos(photos:Photo[]) {
 const rank:Record<string,number>={ACTIVE:0,PENDING:1,REJECTED:2};const map=new Map<number,Photo>();
 [...photos].sort((a,b)=>a.position-b.position||(rank[a.status]??9)-(rank[b.status]??9)||Number(b.id)-Number(a.id)).forEach(p=>{if(!map.has(p.position))map.set(p.position,p);});return [...map.values()];
}
export const primaryPhoto = (photos:Photo[]) => photos.filter(p=>p.position===0&&p.status==='ACTIVE'&&p.moderationStatus==='APPROVED').sort((a,b)=>Number(b.id)-Number(a.id))[0] || managedPhotos(photos).find(p=>p.position===0);
export function validPhoto(file:Pick<File,'type'|'size'>):'photoInvalid'|'photoEmpty'|'photoTooLarge'|null {return !['image/jpeg','image/png','image/webp'].includes(file.type)?'photoInvalid':file.size===0?'photoEmpty':file.size>10*1024*1024?'photoTooLarge':null;}
export function hostedVerificationUrl(value:unknown) {try {const u=new URL(text(value));return u.protocol==='https:'&&(u.hostname==='didit.me'||u.hostname.endsWith('.didit.me'))?u.href:'';}catch{return '';}}
export function completedDate(value:unknown) {const d=new Date(text(value));return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(d);}
export function imperialHeight(value:number) {const total=Math.round(value/2.54);return {feet:Math.floor(total/12),inches:total%12};}
export function cropGeometry(naturalWidth:number,naturalHeight:number,stageWidth:number,stageHeight:number,zoom:number,x:number,y:number) {
 const fit=Math.min(stageWidth/naturalWidth,stageHeight/naturalHeight),width=naturalWidth*fit,height=naturalHeight*fit,size=Math.min(width,height);
 const panX=Math.max(-(width*zoom-size)/2,Math.min((width*zoom-size)/2,x)),panY=Math.max(-(height*zoom-size)/2,Math.min((height*zoom-size)/2,y));
 const scale=fit*zoom,sourceSize=size/scale;
 return {width,height,size,x:panX,y:panY,sourceSize,sx:Math.max(0,Math.min(naturalWidth-sourceSize,naturalWidth/2-panX/scale-sourceSize/2)),sy:Math.max(0,Math.min(naturalHeight-sourceSize,naturalHeight/2-panY/scale-sourceSize/2))};
}
