import { useEffect, useRef, useState } from 'react';
import type { Room, Track } from 'livekit-client';
import { createApiClient } from './api';
import { Overlay } from './member-profile';
import { UserAvatar } from './user-avatar';
import { ChatIcon } from './member-chat';
import { CHAT_COPY } from './member-chat-reference';
import { type ChatLocale, type ChatRow, chatText, chatMediaUrl } from './member-chat-model';

const api=createApiClient();
const terminal=new Set(['CANCELLED','DECLINED','ENDED','MISSED']);
export function MemberChatCalls({session,locale}:{session:{user:ChatRow}|null;locale:ChatLocale}){
  const c=CHAT_COPY[locale].call;
  const [incoming,setIncoming]=useState<ChatRow|null>(null),[active,setActive]=useState<ChatRow|null>(null),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[mic,setMic]=useState(false),[camera,setCamera]=useState(false),[connected,setConnected]=useState(false);
  const activeRef=useRef<ChatRow|null>(null),roomRef=useRef<Room|null>(null),remote=useRef<HTMLDivElement>(null),local=useRef<HTMLDivElement>(null),audio=useRef<HTMLDivElement>(null),action=useRef(false),alive=useRef(true);
  activeRef.current=active;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{if(!session){setIncoming(null);setActive(null);return;}let stopped=false,pending=false;const poll=async()=>{if(stopped||pending||activeRef.current||document.hidden)return;pending=true;try{const result=await api.get<{items:ChatRow[]}>('/member/calls/incoming');if(!stopped&&!activeRef.current)setIncoming(result.items?.[0]||null);}catch{/* Retry when service becomes available. */}finally{pending=false;}};void poll();const timer=setInterval(()=>void poll(),4000);return()=>{stopped=true;clearInterval(timer);};},[session]);
  useEffect(()=>{const start=(event:Event)=>{const call=(event as CustomEvent<ChatRow>).detail;if(!call?.id)return;if(activeRef.current){if(chatText(activeRef.current.id)===chatText(call.id))return;void api.post(`/member/calls/${encodeURIComponent(chatText(call.id))}/end`).catch(()=>{});return;}setIncoming(null);setActive(call);};window.addEventListener('lbp-call-start',start);return()=>window.removeEventListener('lbp-call-start',start);},[]);
  useEffect(()=>{
    if(!active)return;const call=active;let cancelled=false,room:Room|undefined,timer:ReturnType<typeof setInterval>|undefined,statusPending=false;
    setError('');setMic(false);setCamera(false);setConnected(false);setStatus(c.connecting);
    const attach=(track:Track,target:HTMLDivElement|null)=>{if(cancelled)return;const element=track.attach();element.autoplay=true;if(element instanceof HTMLVideoElement)element.playsInline=true;if(track.kind==='video')target?.replaceChildren(element);else audio.current?.append(element);};
    const finishRemote=()=>{if(!cancelled){setActive(null);window.dispatchEvent(new Event('lbp-chat-refresh'));}};
    void (async()=>{try{
      const library=await import('livekit-client');if(cancelled)return;
      room=new library.Room({adaptiveStream:true,dynacast:true});roomRef.current=room;
      room.on(library.RoomEvent.TrackSubscribed,track=>attach(track,remote.current));
      room.on(library.RoomEvent.TrackUnsubscribed,track=>track.detach().forEach(element=>element.remove()));
      room.on(library.RoomEvent.ParticipantConnected,()=>{if(!cancelled)setStatus(c.connected);});
      room.on(library.RoomEvent.Disconnected,finishRemote);
      if(!navigator.mediaDevices?.getUserMedia)throw new Error(c.microphoneUnavailable);
      setStatus(c.requestingMicrophone);
      try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(track=>track.stop());}catch{throw new Error(c.microphoneUnavailable);}
      if(cancelled)return;
      const serverUrl=chatText(call.serverUrl),token=chatText(call.token);if(!serverUrl||!token)throw new Error(c.unavailable);
      setStatus(c.connecting);await room.connect(serverUrl,token);if(cancelled){await room.disconnect();return;}
      await room.localParticipant.setMicrophoneEnabled(true);if(cancelled)return;setMic(true);setConnected(true);setStatus(room.remoteParticipants.size?c.connected:c.calling);
      if(chatText(call.callType)==='VIDEO'){
        try{await room.localParticipant.setCameraEnabled(true);if(cancelled)return;setCamera(true);const track=room.localParticipant.getTrackPublication(library.Track.Source.Camera)?.track;if(track)attach(track,local.current);}catch{if(!cancelled)setError(c.cameraUnavailable);}
      }
      timer=setInterval(()=>{if(statusPending||cancelled)return;statusPending=true;void api.get<{call:ChatRow}>(`/member/calls/${encodeURIComponent(chatText(call.id))}`).then(result=>{if(terminal.has(chatText(result.call?.status)))finishRemote();}).catch(()=>{}).finally(()=>{statusPending=false;});},2500);
    }catch(failure){if(cancelled)return;setError(failure instanceof Error&&[c.microphoneUnavailable,c.unavailable].includes(failure.message as never)?failure.message:c.connectionFailed);setStatus(c.connectionFailed);setConnected(false);room?.removeAllListeners();void room?.disconnect();void api.post(`/member/calls/${encodeURIComponent(chatText(call.id))}/end`).catch(()=>{});}})();
    return()=>{cancelled=true;if(timer)clearInterval(timer);room?.removeAllListeners();void room?.disconnect();if(roomRef.current===room)roomRef.current=null;remote.current?.replaceChildren();local.current?.replaceChildren();audio.current?.replaceChildren();};
  },[active,locale]);
  const perform=async(task:()=>Promise<void>)=>{if(action.current)return;action.current=true;setBusy(true);setError('');try{await task();}catch{if(alive.current)setError(c.unavailable);}finally{action.current=false;if(alive.current)setBusy(false);}};
  const end=()=>void perform(async()=>{const call=activeRef.current;if(!call)return;roomRef.current?.removeAllListeners();void roomRef.current?.disconnect();if(alive.current){setActive(null);window.dispatchEvent(new Event('lbp-chat-refresh'));}await api.post(`/member/calls/${encodeURIComponent(chatText(call.id))}/end`);});
  const accept=()=>void perform(async()=>{if(!incoming)return;const result=await api.post<{call:ChatRow}>(`/member/calls/${encodeURIComponent(chatText(incoming.id))}/accept`);if(alive.current){setIncoming(null);setActive(result.call);}});
  const decline=()=>void perform(async()=>{if(!incoming)return;await api.post(`/member/calls/${encodeURIComponent(chatText(incoming.id))}/decline`);if(alive.current)setIncoming(null);});
  const toggle=(kind:'microphone'|'camera')=>void perform(async()=>{const room=roomRef.current;if(!room)return;try{if(kind==='microphone'){await room.localParticipant.setMicrophoneEnabled(!mic);setMic(room.localParticipant.isMicrophoneEnabled);}else{await room.localParticipant.setCameraEnabled(!camera);setCamera(room.localParticipant.isCameraEnabled);if(room.localParticipant.isCameraEnabled){const {Track}=await import('livekit-client');const track=room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;if(track){const element=track.attach();element.muted=true;element.autoplay=true;if(element instanceof HTMLVideoElement)element.playsInline=true;local.current?.replaceChildren(element);}}else local.current?.replaceChildren();}}catch{setError(kind==='microphone'?c.microphoneUnavailable:c.cameraUnavailable);}});
  const avatar=(call:ChatRow)=><span className="chat-call-avatar"><UserAvatar src={chatMediaUrl(call.peerAvatarUrl)} name={chatText(call.peerName)} fallbackClassName="chat-avatar-fallback"/></span>;
  return <>{incoming&&!active&&<Overlay className="chat-call-modal incoming" label={chatText(incoming.peerName)} close={decline} busy={busy}><section className="chat-call-dialog incoming">{avatar(incoming)}<strong>{chatText(incoming.peerName)}</strong><span>{incoming.callType==='VIDEO'?c.incomingVideo:c.incomingVoice}</span>{error&&<p role="alert" className="chat-call-error">{error}</p>}<div className="chat-call-incoming-actions"><button className="decline" disabled={busy} onClick={decline}><ChatIcon name="phoneIcon"/><span>{c.decline}</span></button><button className="accept" disabled={busy} onClick={accept}><ChatIcon name={incoming.callType==='VIDEO'?'videoIcon':'phoneIcon'}/><span>{c.accept}</span></button></div></section></Overlay>}
  {active&&<Overlay className={`chat-call-modal${active.callType==='VIDEO'?' is-video':''}`} label={chatText(active.peerName)} close={end} busy={busy}><section className="chat-call-dialog"><div className="chat-call-stage"><div className="chat-call-remote" ref={remote}/><div className="chat-call-local" ref={local}/><div className="chat-call-identity">{avatar(active)}<strong>{chatText(active.peerName)}</strong><span role="status">{status}</span></div></div>{error&&<p role="alert" className="chat-call-error">{error}</p>}<div ref={audio}/><div className="chat-call-controls"><button className={mic?'':'is-off'} disabled={busy||!connected} aria-label={c.microphone} aria-pressed={mic} onClick={()=>toggle('microphone')}><ChatIcon name="microphoneIcon"/></button>{active.callType==='VIDEO'&&<button className={camera?'':'is-off'} disabled={busy||!connected} aria-label={c.camera} aria-pressed={camera} onClick={()=>toggle('camera')}><ChatIcon name="videoIcon"/></button>}<button className="hangup" disabled={busy} aria-label={c.end} onClick={end}><ChatIcon name="phoneIcon"/></button></div></section></Overlay>}</>;
}
