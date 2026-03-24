import React, { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import {
  Play, Pause, Info, Search, X, ChevronRight, ChevronLeft, Clock, Bookmark,
  Settings, Monitor, Tv, Film, ArrowLeft, Trash2, LayoutGrid, Star, Shuffle,
  User, Layers, Filter, Dribbble, Users, Server, ChevronDown, Calendar,
  Sparkles, Send, Maximize, Minimize, VolumeX, Volume2, Plus, Edit3, Check,
  Subtitles, Sidebar, PictureInPicture, RefreshCw, Square, LogOut, Zap,
  Globe, Shield, Palette, Sliders, Bell, ChevronUp, MoreHorizontal, AlertCircle
} from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DEFAULT_TMDB_KEY  = "9517f4751d84886b184cb4a4849e9f91";
const BASE_URL          = "https://api.themoviedb.org/3";
const IMG               = "https://image.tmdb.org/t/p/";
const INTRODB           = "https://api.theintrodb.org/v2";

const BRAND = '#1a5fa8';

const PROFILE_EMOJIS = ['🎬','🎭','🎮','⚡','🌙','🎵','🌈','🏆','🦁','🌊','🔥','❄️','🌸','🎪','🦋'];
const PROFILE_COLORS = ['#1a5fa8','#7c3aed','#dc2626','#d97706','#059669','#0891b2','#db2777','#9333ea','#ea580c','#16a34a'];

const DEFAULT_CC = {
  size:'1.125rem', bg:'rgba(0,0,0,0.8)', color:'#ffffff',
  font:'system-ui,-apple-system,sans-serif',
  edgeStyle:'dropshadow', animation:'fade', offset:-5.0
};
const DEFAULT_VIDPLUS = {
  icons:'lucide', autoNext:true, episodeList:true, serverIcon:true,
  subtitleFont:'Inter', subtitleFontSize:20, subtitleOpacity:0.5,
};
const DEFAULT_SKIP = {
  enabled:true, showIntro:true, showRecap:true, showCredits:true, showPreview:false,
  autoSkip:false, buttonDuration:6, minConfidence:0.3,
};
const DEFAULT_SETTINGS = {
  apiKey:DEFAULT_TMDB_KEY, omdbApiKey:'93a6d7d6', sourceKey:'vidplus', geminiApiKey:'',
  algoPrefs:{excluded:[],boosted:[]}, ccSettings:DEFAULT_CC,
  vidplusSettings:DEFAULT_VIDPLUS, skipSettings:DEFAULT_SKIP,
};
const DEFAULT_PROFILE = (idx=0) => ({
  id: `profile_${Date.now()}_${idx}`,
  name: idx===0?'Main':idx===1?'Profile 2':'Profile 3',
  emoji: PROFILE_EMOJIS[idx*3]||'🎬',
  color: PROFILE_COLORS[idx]||BRAND,
});

const SOURCES = {
  vidplus:   {name:'VidPlus',   type:'Primary'},
  autoembed: {name:'AutoEmbed', type:'Fast'},
  vidlink:   {name:'VidLink',   type:'Backup 1'},
  vidsrc:    {name:'VidSrc',    type:'Backup 2'},
  embedsu:   {name:'Embed.su',  type:'Backup 3'},
  vidsrcicu: {name:'VidSrc ICU',type:'Backup 4'},
};

const GENRES = {
  movie:[
    {id:28,name:'Action'},{id:12,name:'Adventure'},{id:16,name:'Animation'},
    {id:35,name:'Comedy'},{id:80,name:'Crime'},{id:99,name:'Documentary'},
    {id:18,name:'Drama'},{id:10751,name:'Family'},{id:14,name:'Fantasy'},
    {id:27,name:'Horror'},{id:878,name:'Sci-Fi'},{id:53,name:'Thriller'},
  ],
  tv:[
    {id:10759,name:'Action & Adventure'},{id:16,name:'Animation'},{id:35,name:'Comedy'},
    {id:80,name:'Crime'},{id:99,name:'Documentary'},{id:18,name:'Drama'},
    {id:10765,name:'Sci-Fi & Fantasy'},{id:10768,name:'War & Politics'},
  ],
};

const ALL_GENRES = [];
[...GENRES.movie,...GENRES.tv].forEach(g=>{if(!ALL_GENRES.some(u=>u.name===g.name))ALL_GENRES.push(g);});
ALL_GENRES.sort((a,b)=>a.name.localeCompare(b.name));

const LIVE_CHANNELS = [
  {id:'l_cnn',  isLive:true,name:'CNN',       category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/b/b1/CNN.svg',url:'https://turnerlive.warnermediacdn.com/hls/live/586495/cnngo/cnn_slate/VIDEO_0_3564000.m3u8',type:'m3u8'},
  {id:'l_cbs',  isLive:true,name:'CBS News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/2/2e/CBS_News_2020_%28Stacked_II%29.svg',url:'https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8',type:'m3u8'},
  {id:'l_fox',  isLive:true,name:'Fox News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/6/67/Fox_News_Channel_logo.svg',url:'https://stream.livenewsplay.com:9555/hls/foxnewssd/index.m3u8',type:'m3u8'},
  {id:'l_nbc',  isLive:true,name:'NBC News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/NBC_logo.svg/1280px-NBC_logo.svg.png',url:'https://d1bl6tskrpq9ze.cloudfront.net/hls/master.m3u8',type:'m3u8'},
  {id:'l_abc',  isLive:true,name:'ABC News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/ABC_News_logo_2021.svg/1280px-ABC_News_logo_2021.svg.png',url:'https://aegis-cloudfront-1.tubi.video/d6cbb0de-68e4-4f3b-82f9-bf5d526e0bde/index.m3u8',type:'m3u8'},
  {id:'l_bbc',  isLive:true,name:'BBC News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/BBC_News_2022_%28Alt%29.svg/1280px-BBC_News_2022_%28Alt%29.svg.png',url:'https://dash2.antik.sk/live/test_bbc_world/playlist.m3u8',type:'m3u8'},
  {id:'l_cnbc', isLive:true,name:'CNBC',      category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/e/e3/CNBC_logo.svg',url:'https://stream.livenewsplay.com:9443/hls/cnbc/cnbcsd.m3u8',type:'m3u8'},
  {id:'l_bloom',isLive:true,name:'Bloomberg', category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/5/5d/New_Bloomberg_Logo.svg',url:'https://cdn4.skygo.mn/live/disk1/Bloomberg/HLSv3-FTA/Bloomberg.m3u8',type:'m3u8'},
  {id:'l_reu',  isLive:true,name:'Reuters',   category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Reuters_logo_2024.svg/1280px-Reuters_logo_2024.svg.png',url:'https://amg00453-reuters-amg00453c1-plex-us-2106.playouts.now.amagi.tv/playlist/amg00453-reuters-reuters-plexus/playlist.m3u8',type:'m3u8'},
  {id:'l_cbc',  isLive:true,name:'CBC News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/CBC_News_Logo.svg/960px-CBC_News_Logo.svg.png',url:'https://amg00788-cbc-amg00788c4-xumo-us-3045.playouts.now.amagi.tv/master.m3u8',type:'m3u8'},
];

// ─── UTILS ────────────────────────────────────────────────────────────────────
const apiCache = new Map();
const pendingFetches = new Map();
const CACHE_TTL = 300000;

const fetchWithCache = async (url) => {
  const hit = apiCache.get(url);
  if (hit && Date.now()-hit.ts < CACHE_TTL) return hit.data;
  if (pendingFetches.has(url)) return pendingFetches.get(url);
  const p = fetch(url).then(r=>r.json()).then(data=>{
    if(apiCache.size>500) apiCache.delete(apiCache.keys().next().value);
    apiCache.set(url,{data,ts:Date.now()});
    pendingFetches.delete(url);
    return data;
  }).catch(e=>{pendingFetches.delete(url);throw e;});
  pendingFetches.set(url,p);
  return p;
};

const initHls = (video,src,isMain,cb) => {
  if (!window.Hls) return null;
  if (window.Hls.isSupported()) {
    const hls = new window.Hls({
      maxMaxBufferLength:isMain?30:10, maxBufferSize:isMain?60e6:15e6,
      liveSyncDurationCount:3, capLevelToPlayerSize:true,
      autoLevelCapping:isMain?-1:0, enableWorker:true,
    });
    hls.loadSource(src); hls.attachMedia(video);
    if (cb.onParsed)  hls.on(window.Hls.Events.MANIFEST_PARSED, cb.onParsed);
    if (cb.onError)   hls.on(window.Hls.Events.ERROR,           cb.onError);
    return hls;
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
    if (cb.onParsed) video.addEventListener('loadedmetadata', cb.onParsed);
  }
  return null;
};

const loadHlsScript = (cb) => {
  if (window.Hls) { cb(); return; }
  const s = document.createElement('script');
  s.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
  s.async = true; s.onload = cb;
  document.body.appendChild(s);
};

let scrollLocks = 0;
const lockScroll   = () => { scrollLocks++; document.body.style.overflow='hidden'; };
const unlockScroll = () => { scrollLocks=Math.max(scrollLocks-1,0); if(!scrollLocks) document.body.style.overflow=''; };
const cn = (...c) => c.filter(Boolean).join(' ');
const isTouchDev = () => 'ontouchstart' in window || navigator.maxTouchPoints>0;
const formatDate = d => d ? new Date(d).toLocaleDateString('en-US',{year:'numeric'}) : '';
const formatDT   = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : '';
const ratingColor = r => ({color:r?`hsl(${Math.max(0,Math.min(120,(r-3)*15))},80%,50%)`:'#9ca3af'});
const getTextShadow = s => ({
  dropshadow:'0px 2px 6px rgba(0,0,0,0.9),0px 4px 12px rgba(0,0,0,0.6)',
  raised:'-1px -1px 0 rgba(255,255,255,0.2),1px 1px 0 rgba(0,0,0,0.8)',
  depressed:'1px 1px 0 rgba(255,255,255,0.3),-1px -1px 0 rgba(0,0,0,0.8)',
  outline:'-1.5px -1.5px 0 #000,1.5px -1.5px 0 #000,-1.5px 1.5px 0 #000,1.5px 1.5px 0 #000',
}[s]||'none');

const parseEpDate = ds => {
  if(!ds) return {text:'Unknown date',isNew:false,isFuture:false};
  const d=new Date(ds), now=new Date(); now.setHours(0,0,0,0);
  const diff=Math.floor((now-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/86400000);
  const fmt=d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  if(diff<0)   return {text:`Airs ${fmt}`,isNew:false,isFuture:true};
  if(diff<=14) return {text:`${diff===0?'Today':diff===1?'1 day ago':diff+' days ago'} · ${fmt}`,isNew:true,isFuture:false};
  return {text:fmt,isNew:false,isFuture:false};
};

// ─── PROFILE CONTEXT ──────────────────────────────────────────────────────────
const ProfileCtx = createContext(null);

// ─── HOOKS ────────────────────────────────────────────────────────────────────
const useLocalStorage = (key,init) => {
  const [v,setV]=useState(()=>{try{const i=localStorage.getItem(key);return i?JSON.parse(i):init;}catch{return init;}});
  const set=val=>{try{const s=val instanceof Function?val(v):val;setV(s);localStorage.setItem(key,JSON.stringify(s));}catch(e){console.error(e);}};
  return [v,set];
};

const useDebounce = (val,delay) => {
  const [d,setD]=useState(val);
  useEffect(()=>{const h=setTimeout(()=>setD(val),delay);return()=>clearTimeout(h);},[val,delay]);
  return d;
};

// ─── PROFILE DATA HOOK ────────────────────────────────────────────────────────
const useProfileData = (uid, profileId) => {
  const isGuest = profileId === 'guest';
  const pfx = `p_${profileId}`;

  const [settings,setS] = useState(()=>{
    if(isGuest) return DEFAULT_SETTINGS;
    try{const v=localStorage.getItem(`${pfx}_settings`);return v?{...DEFAULT_SETTINGS,...JSON.parse(v)}:DEFAULT_SETTINGS;}
    catch{return DEFAULT_SETTINGS;}
  });
  const [history,setH] = useState(()=>{
    const store=isGuest?sessionStorage:localStorage;
    try{const v=store.getItem(`${pfx}_history`);return v?JSON.parse(v):[];}catch{return[];}
  });
  const [watchlist,setW] = useState(()=>{
    const store=isGuest?sessionStorage:localStorage;
    try{const v=store.getItem(`${pfx}_watchlist`);return v?JSON.parse(v):[];}catch{return[];}
  });
  const [loaded,setLoaded]=useState(false);
  const latS=useRef(settings),latH=useRef(history),latW=useRef(watchlist);
  useEffect(()=>{latS.current=settings;},[settings]);
  useEffect(()=>{latH.current=history;},[history]);
  useEffect(()=>{latW.current=watchlist;},[watchlist]);
  const timers=useRef({});

  useEffect(()=>{
    if(!uid||isGuest){setLoaded(true);return;}
    let ok=true;
    (async()=>{
      try{
        const[ss,hs,ws]=await Promise.all([
          getDoc(doc(db,'users',uid,'profiles',profileId,'data','settings')),
          getDoc(doc(db,'users',uid,'profiles',profileId,'data','history')),
          getDoc(doc(db,'users',uid,'profiles',profileId,'data','watchlist')),
        ]);
        if(!ok)return;
        if(ss.exists()){const v={...DEFAULT_SETTINGS,...ss.data()};setS(v);localStorage.setItem(`${pfx}_settings`,JSON.stringify(v));}
        if(hs.exists()){const v=hs.data().items||[];setH(v);localStorage.setItem(`${pfx}_history`,JSON.stringify(v));}
        if(ws.exists()){const v=ws.data().items||[];setW(v);localStorage.setItem(`${pfx}_watchlist`,JSON.stringify(v));}
      }catch(e){console.error('Profile load:',e);}
      if(ok) setLoaded(true);
    })();
    return()=>{ok=false;};
  },[uid,profileId,isGuest,pfx]);

  const save = useCallback((docKey,getData)=>{
    if(!uid||isGuest) return;
    clearTimeout(timers.current[docKey]);
    timers.current[docKey]=setTimeout(async()=>{
      try{
        const v=getData();
        await setDoc(doc(db,'users',uid,'profiles',profileId,'data',docKey),
          docKey==='settings'?v:{items:v});
      }catch(e){console.error('Save:',e);}
    },1500);
  },[uid,profileId,isGuest]);

  const saveSettings=useCallback(val=>{
    const n=typeof val==='function'?val(latS.current):val;
    setS(n);
    if(isGuest) return;
    localStorage.setItem(`${pfx}_settings`,JSON.stringify(n));
    save('settings',()=>latS.current);
  },[save,isGuest,pfx]);

  const saveHistory=useCallback(val=>{
    const n=typeof val==='function'?val(latH.current):val;
    setH(n);
    const store=isGuest?sessionStorage:localStorage;
    store.setItem(`${pfx}_history`,JSON.stringify(n));
    if(!isGuest) save('history',()=>latH.current);
  },[save,isGuest,pfx]);

  const saveWatchlist=useCallback(val=>{
    const n=typeof val==='function'?val(latW.current):val;
    setW(n);
    const store=isGuest?sessionStorage:localStorage;
    store.setItem(`${pfx}_watchlist`,JSON.stringify(n));
    if(!isGuest) save('watchlist',()=>latW.current);
  },[save,isGuest,pfx]);

  return{settings,saveSettings,history,saveHistory,watchlist,saveWatchlist,loaded};
};

// ─── PROFILES MANAGER HOOK ───────────────────────────────────────────────────
const useProfiles = (uid) => {
  const [profiles,setProfiles]=useLocalStorage('onyx_profiles_v2',[DEFAULT_PROFILE(0)]);
  const timers=useRef({});

  const saveToCloud=useCallback((pList)=>{
    if(!uid) return;
    clearTimeout(timers.current.profiles);
    timers.current.profiles=setTimeout(()=>{
      setDoc(doc(db,'users',uid,'data','profiles_config'),{profiles:pList}).catch(console.error);
    },1500);
  },[uid]);

  useEffect(()=>{
    if(!uid) return;
    let ok=true;
    getDoc(doc(db,'users',uid,'data','profiles_config')).then(snap=>{
      if(!ok||!snap.exists()) return;
      const data=snap.data().profiles||[];
      if(data.length) setProfiles(data);
    }).catch(console.error);
    return()=>{ok=false;};
  },[uid]);

  const addProfile=useCallback((profile)=>{
    const updated=[...profiles,profile].slice(0,3);
    setProfiles(updated);saveToCloud(updated);
  },[profiles,setProfiles,saveToCloud]);

  const updateProfile=useCallback((id,changes)=>{
    const updated=profiles.map(p=>p.id===id?{...p,...changes}:p);
    setProfiles(updated);saveToCloud(updated);
  },[profiles,setProfiles,saveToCloud]);

  const deleteProfile=useCallback((id)=>{
    const updated=profiles.filter(p=>p.id!==id);
    setProfiles(updated);saveToCloud(updated);
  },[profiles,setProfiles,saveToCloud]);

  return{profiles,addProfile,updateProfile,deleteProfile};
};

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    ::-webkit-scrollbar{display:none}*{-ms-overflow-style:none;scrollbar-width:none}
    .gpu{transform:translateZ(0);will-change:transform,opacity}
    :fullscreen,:-webkit-full-screen{width:100vw!important;height:100vh!important;border:none!important;border-radius:0!important}
    .fade-r{-webkit-mask-image:linear-gradient(to right,black 85%,transparent 100%);mask-image:linear-gradient(to right,black 85%,transparent 100%)}
    .spoil{filter:blur(8px);cursor:pointer;transition:filter .4s}.spoil:hover{filter:blur(4px)}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes scaleIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes pulse2{0%,100%{opacity:1}50%{opacity:.4}}
    .anim-up{animation:fadeUp .5s cubic-bezier(.16,1,.3,1) both}
    .anim-scale{animation:scaleIn .4s cubic-bezier(.16,1,.3,1) both}
    .skeleton{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
    .live-pulse{animation:pulse2 1.5s ease-in-out infinite}
    .custom-select{appearance:none;background-image:url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");background-repeat:no-repeat;background-position:right 1rem center;background-size:1em}
    .glass{background:rgba(255,255,255,0.04);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}
    .glass-dark{background:rgba(0,0,0,0.5);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}
    input[type=range]{-webkit-appearance:none;appearance:none;height:3px;border-radius:99px;background:rgba(255,255,255,0.15);outline:none}
    input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.5)}
  `}</style>
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const LoginScreen = () => {
  const [email,setEmail]=useState('');
  const [pw,setPw]=useState('');
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);

  const handle=async e=>{
    e.preventDefault();setLoading(true);setErr('');
    try{await signInWithEmailAndPassword(auth,email,pw);}
    catch{setErr('Invalid email or password.');}
    setLoading(false);
  };

  return(
    <div className="min-h-screen bg-black flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-[160px]"
          style={{background:`radial-gradient(circle, rgba(26,95,168,0.18) 0%, transparent 70%)`}}/>
      </div>
      <div className="w-full max-w-[360px] relative z-10">
        <div className="flex justify-center mb-12">
          <div className="w-16 h-16 bg-white rounded-[20px] flex items-center justify-center shadow-2xl">
            <Play className="text-black w-7 h-7 fill-black ml-0.5"/>
          </div>
        </div>
        <h1 className="text-[2.4rem] font-bold text-white text-center mb-1.5 tracking-tight">Sign in</h1>
        <p className="text-white/35 text-center mb-10 text-sm">Private streaming, just for you.</p>
        <form onSubmit={handle} className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/[0.08] text-white px-5 py-4 rounded-2xl outline-none focus:border-white/20 focus:bg-white/[0.09] placeholder:text-white/25 text-[15px] transition-all"
            required autoComplete="email"/>
          <input type="password" placeholder="Password" value={pw} onChange={e=>setPw(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/[0.08] text-white px-5 py-4 rounded-2xl outline-none focus:border-white/20 focus:bg-white/[0.09] placeholder:text-white/25 text-[15px] transition-all"
            required autoComplete="current-password"/>
          {err&&<p className="text-red-400 text-[13px] text-center py-2.5 bg-red-500/8 rounded-xl border border-red-500/10">{err}</p>}
          <div className="pt-1">
            <button type="submit" disabled={loading}
              className="w-full bg-white text-black font-semibold text-[15px] py-4 rounded-2xl hover:bg-white/93 active:scale-[0.985] transition-all disabled:opacity-40 flex items-center justify-center">
              {loading?<div className="w-5 h-5 border-2 border-black/15 border-t-black rounded-full animate-spin"/>:'Continue'}
            </button>
          </div>
        </form>
        <p className="text-white/18 text-xs text-center mt-10">Private access only</p>
      </div>
    </div>
  );
};

// ─── PROFILE EDIT MODAL ───────────────────────────────────────────────────────
const ProfileEditModal = ({profile, onSave, onDelete, onClose, isNew}) => {
  const [name,setName]=useState(profile?.name||'');
  const [emoji,setEmoji]=useState(profile?.emoji||'🎬');
  const [color,setColor]=useState(profile?.color||BRAND);

  return(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={onClose}/>
      <div className="relative bg-[#0f0f0f] border border-white/10 rounded-3xl p-8 w-full max-w-md anim-scale shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-6">{isNew?'Add Profile':'Edit Profile'}</h2>
        <div className="mb-5">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Avatar</p>
          <div className="grid grid-cols-5 gap-2">
            {PROFILE_EMOJIS.map(e=>(
              <button key={e} onClick={()=>setEmoji(e)}
                className={cn("w-full aspect-square rounded-2xl text-2xl flex items-center justify-center transition-all outline-none border-2",
                  emoji===e?'border-white bg-white/10':'border-transparent bg-white/5 hover:bg-white/10')}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-5">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Color</p>
          <div className="flex gap-2 flex-wrap">
            {PROFILE_COLORS.map(c=>(
              <button key={c} onClick={()=>setColor(c)}
                className={cn("w-9 h-9 rounded-full transition-all outline-none border-2",color===c?'border-white scale-110':'border-transparent hover:scale-105')}
                style={{backgroundColor:c}}/>
            ))}
          </div>
        </div>
        <div className="mb-7">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Name</p>
          <input value={name} onChange={e=>setName(e.target.value)} maxLength={20}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-white/30 text-sm font-semibold transition-all"
            placeholder="Profile name"/>
        </div>
        <div className="flex justify-center mb-7">
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-[1.25rem] flex items-center justify-center text-4xl shadow-xl border-2 border-white/10"
              style={{background:`linear-gradient(135deg, ${color}88, ${color}44)`}}>
              {emoji}
            </div>
            <span className="text-white/70 text-sm font-medium">{name||'Profile'}</span>
          </div>
        </div>
        <div className="flex gap-3">
          {!isNew&&onDelete&&<button onClick={onDelete} className="px-5 py-3 rounded-2xl text-red-400 bg-red-500/10 border border-red-500/20 font-semibold text-sm hover:bg-red-500/20 transition-all outline-none">Delete</button>}
          <button onClick={onClose} className="flex-1 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-semibold text-sm hover:bg-white/10 transition-all outline-none">Cancel</button>
          <button onClick={()=>name.trim()&&onSave({name:name.trim(),emoji,color})}
            disabled={!name.trim()}
            className="flex-1 px-5 py-3 rounded-2xl bg-white text-black font-bold text-sm hover:bg-white/92 disabled:opacity-40 transition-all outline-none">
            {isNew?'Add':'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── WHO'S WATCHING ───────────────────────────────────────────────────────────
const WhoWatching = ({profiles, onSelect, user}) => {
  const [editingProfile,setEditingProfile]=useState(null);
  const [addingProfile,setAddingProfile]=useState(false);
  const {addProfile,updateProfile,deleteProfile}=useProfiles(user?.uid);

  const allCards=[
    ...profiles,
    ...(profiles.length<3?[{id:'__add',name:'Add Profile',emoji:'+',color:'rgba(255,255,255,0.08)'}]:[]),
    {id:'guest',name:'Guest',emoji:'👤',color:'rgba(255,255,255,0.05)'},
  ];

  return(
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full blur-[180px]"
          style={{background:`radial-gradient(circle, rgba(26,95,168,0.12) 0%, transparent 70%)`}}/>
      </div>
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-lg">
          <Play className="text-black w-4 h-4 fill-black ml-0.5"/>
        </div>
      </div>
      <div className="relative z-10 text-center max-w-2xl w-full">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 tracking-tight">Who's watching?</h1>
        <p className="text-white/35 mb-14 text-sm md:text-base">Your watch history is saved per profile.</p>
        <div className="flex flex-wrap items-start justify-center gap-6 md:gap-10">
          {allCards.map((profile,i)=>{
            const isAdd=profile.id==='__add';
            const isGuest=profile.id==='guest';
            const isReal=!isAdd&&!isGuest;
            return(
              <div key={profile.id} className="flex flex-col items-center gap-3 group" style={{animationDelay:`${i*60}ms`}}>
                <div className="relative">
                  <button
                    onClick={()=>{if(isAdd)setAddingProfile(true);else onSelect(profile.id);}}
                    className="w-28 h-28 md:w-32 md:h-32 rounded-[1.75rem] flex items-center justify-center transition-all duration-300 border-2 border-transparent group-hover:border-white/30 group-hover:scale-105 outline-none shadow-xl"
                    style={{background:isAdd?'rgba(255,255,255,0.05)':isGuest?'rgba(255,255,255,0.04)':`linear-gradient(135deg, ${profile.color}99, ${profile.color}44)`}}>
                    <span className={cn("transition-transform",isAdd?"text-3xl text-white/40":"text-4xl md:text-5xl")}>{profile.emoji}</span>
                  </button>
                  {isReal&&(
                    <button onClick={e=>{e.stopPropagation();setEditingProfile(profile);}}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#1a1a1a] border border-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-white hover:text-black text-white/70 outline-none">
                      <Edit3 className="w-3 h-3"/>
                    </button>
                  )}
                </div>
                <span className="text-white/50 text-sm font-medium group-hover:text-white transition-colors max-w-[120px] truncate">{profile.name}</span>
              </div>
            );
          })}
        </div>
      </div>
      {editingProfile&&(
        <ProfileEditModal profile={editingProfile} isNew={false}
          onSave={changes=>{updateProfile(editingProfile.id,changes);setEditingProfile(null);}}
          onDelete={()=>{deleteProfile(editingProfile.id);setEditingProfile(null);}}
          onClose={()=>setEditingProfile(null)}/>
      )}
      {addingProfile&&(
        <ProfileEditModal profile={null} isNew
          onSave={data=>{addProfile({...DEFAULT_PROFILE(profiles.length),...data});setAddingProfile(false);}}
          onClose={()=>setAddingProfile(false)}/>
      )}
    </div>
  );
};

// ─── TOP NAVIGATION ───────────────────────────────────────────────────────────
const TopNavigation = React.memo(({activeTab,setActiveTab,selectedGenre,setSelectedGenre,focusMode,activeProfile,profiles,onSwitchProfile})=>{
  const [scrolled,setScrolled]=useState(false);
  const [profileMenu,setProfileMenu]=useState(false);
  const menuRef=useRef(null);

  useEffect(()=>{
    let t=false;
    const h=()=>{if(!t){requestAnimationFrame(()=>{setScrolled(window.scrollY>30);t=false;});t=true;}};
    window.addEventListener('scroll',h,{passive:true});
    return()=>window.removeEventListener('scroll',h);
  },[]);

  useEffect(()=>{
    const h=e=>{if(menuRef.current&&!menuRef.current.contains(e.target))setProfileMenu(false);};
    document.addEventListener('mousedown',h);
    return()=>document.removeEventListener('mousedown',h);
  },[]);

  const mainTabs=[{id:'home',l:'Home'},{id:'movies',l:'Movies'},{id:'tv',l:'Series'},{id:'live',l:'Live News'},{id:'sports',l:'Sports'}];
  const utilTabs=[{id:'search',I:Search},{id:'watchlist',I:Bookmark},{id:'history',I:Clock},{id:'settings',I:Settings}];
  const showSub=activeTab==='movies'||activeTab==='tv';
  const genres=activeTab==='movies'?GENRES.movie:GENRES.tv;
  const profile=profiles?.find(p=>p.id===activeProfile);

  return(
    <header className={cn(
      "fixed top-0 left-0 w-full z-[70] transition-all duration-500 flex flex-col items-center gpu",
      focusMode?"-translate-y-full opacity-0 pointer-events-none":"translate-y-0 opacity-100",
      scrolled?"bg-black/85 backdrop-blur-3xl border-b border-white/[0.05]":"bg-gradient-to-b from-black/70 to-transparent"
    )}>
      <nav className="w-full flex items-center justify-between px-4 md:px-8 lg:px-14 h-[68px] max-w-[1800px] pointer-events-auto">
        <div className="flex items-center gap-6 md:gap-10">
          <button onClick={()=>setActiveTab('home')} className="w-9 h-9 bg-white rounded-[11px] flex items-center justify-center shrink-0 hover:scale-105 transition-transform shadow-lg outline-none">
            <Play className="text-black w-4 h-4 fill-black ml-0.5"/>
          </button>
          <div className="hidden md:flex items-center gap-7">
            {mainTabs.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                className={cn("text-sm transition-all tracking-wide outline-none relative py-1",
                  activeTab===t.id?"text-white font-bold":"text-white/45 font-semibold hover:text-white/75")}>
                {t.l}
                {activeTab===t.id&&<div className="absolute -bottom-px left-0 w-full h-[2px] bg-white rounded-full"/>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="md:hidden flex items-center overflow-x-auto gap-5 mr-2 max-w-[40vw] fade-r">
            {mainTabs.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                className={cn("text-[12px] transition-all whitespace-nowrap py-1.5 outline-none relative shrink-0",
                  activeTab===t.id?"text-white font-bold":"text-white/45 font-semibold")}>
                {t.l}
                {activeTab===t.id&&<div className="absolute -bottom-px left-0 w-full h-[2px] bg-white rounded-full"/>}
              </button>
            ))}
          </div>
          {utilTabs.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              className={cn("p-2.5 rounded-full flex items-center justify-center transition-all outline-none",
                activeTab===t.id?"bg-[#1a5fa8]/80 text-white":"text-white/50 hover:text-white hover:bg-white/8")}>
              <t.I className="w-[18px] h-[18px]"/>
            </button>
          ))}
          {profiles&&profiles.length>0&&(
            <div className="relative" ref={menuRef}>
              <button onClick={()=>setProfileMenu(v=>!v)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-all border-2 border-transparent hover:border-white/30 outline-none"
                style={{background:profile?`linear-gradient(135deg, ${profile.color}99, ${profile.color}44)`:'rgba(255,255,255,0.08)'}}>
                {profile?.emoji||'👤'}
              </button>
              {profileMenu&&(
                <div className="absolute right-0 top-12 w-52 glass-dark border border-white/10 rounded-2xl p-2 shadow-2xl anim-scale z-[200]">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-3 py-1.5">Switch profile</p>
                  {profiles.map(p=>(
                    <button key={p.id} onClick={()=>{onSwitchProfile(p.id);setProfileMenu(false);}}
                      className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left outline-none hover:bg-white/8",p.id===activeProfile?"bg-white/10":"")}>
                      <span className="w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{background:`linear-gradient(135deg, ${p.color}88, ${p.color}33)`}}>
                        {p.emoji}
                      </span>
                      <span className="text-sm font-semibold text-white/80">{p.name}</span>
                      {p.id===activeProfile&&<Check className="w-4 h-4 text-white/60 ml-auto"/>}
                    </button>
                  ))}
                  <div className="border-t border-white/8 mt-1 pt-1">
                    <button onClick={()=>{onSwitchProfile('guest');setProfileMenu(false);}}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left outline-none hover:bg-white/8">
                      <span className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 bg-white/5">👤</span>
                      <span className="text-sm font-semibold text-white/60">Guest</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
      <div className={cn(
        "w-full overflow-hidden transition-all duration-300 flex justify-center max-w-[1800px]",
        showSub&&!focusMode?"max-h-12 opacity-100 pb-3 pointer-events-auto":"max-h-0 opacity-0 pb-0 pointer-events-none"
      )}>
        <div className="flex items-center overflow-x-auto gap-6 px-4 md:px-8 lg:px-14 w-full fade-r">
          <button onClick={()=>setSelectedGenre('All')}
            className={cn("py-1 text-[12px] font-semibold transition-all whitespace-nowrap outline-none relative shrink-0",
              selectedGenre==='All'?"text-white":"text-white/40 hover:text-white/70")}>
            All{selectedGenre==='All'&&<div className="absolute -bottom-0.5 left-0 w-full h-[2px] bg-white rounded-full"/>}
          </button>
          {genres.map(g=>(
            <button key={g.id} onClick={()=>setSelectedGenre(g.id)}
              className={cn("py-1 text-[12px] font-semibold transition-all whitespace-nowrap outline-none relative shrink-0",
                selectedGenre===g.id?"text-white":"text-white/40 hover:text-white/70")}>
              {g.name}{selectedGenre===g.id&&<div className="absolute -bottom-0.5 left-0 w-full h-[2px] bg-white rounded-full"/>}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
});

// ─── MEDIA CARD ───────────────────────────────────────────────────────────────
const MediaCard = React.memo(({media,onClick,size="normal",showRank=null})=>{
  const img=media.poster_path?`${IMG}w500${media.poster_path}`:'https://via.placeholder.com/500x750?text=No+Image';
  const w=size==="large"?"w-36 md:w-56":size==="grid"?"w-full":"w-28 md:w-40";
  return(
    <div onClick={()=>onClick(media)}
      className={cn("relative group cursor-pointer flex-shrink-0 transition-all duration-300 z-10 hover:z-50 outline-none focus:z-50 rounded-xl select-none snap-start",w)}
      tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onClick(media);}}>
      {showRank!=null&&(
        <div className="absolute -left-3 md:-left-5 bottom-2 text-5xl md:text-7xl font-black z-30 tracking-tighter pointer-events-none text-transparent" style={{WebkitTextStroke:'1.5px rgba(255,255,255,0.25)'}}>
          {showRank}
        </div>
      )}
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 transition-all duration-300 group-hover:shadow-[0_15px_35px_rgba(0,0,0,0.7)] border border-transparent group-hover:border-white/20 relative z-20 gpu">
        <img src={img} alt={media.title||media.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none" loading="lazy" decoding="async" draggable="false"
          onError={e=>{e.target.onerror=null;e.target.src='https://via.placeholder.com/500x750?text=No+Image';}}/>
        {media.progress!=null&&<div className="absolute bottom-0 left-0 w-full h-1 bg-black/60 z-30"><div className="h-full bg-[#1a5fa8]" style={{width:`${media.progress}%`}}/></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 z-20 pointer-events-none">
          <h4 className="text-white font-semibold text-xs line-clamp-2 leading-tight mb-1.5">{media.title||media.name}</h4>
          <div className="flex items-center gap-2 text-[10px] text-white/60">
            {!media.isLive&&media.vote_average>0&&<span className="flex items-center gap-1 font-bold text-yellow-400"><Star className="w-2.5 h-2.5 fill-current"/>{media.vote_average?.toFixed(1)}</span>}
            <span>{formatDate(media.release_date||media.first_air_date)}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── CONTENT ROW ─────────────────────────────────────────────────────────────
const ContentRow = React.memo(({title,fetchUrl,onMediaClick,apiKey,isLarge=false,customData=null,showRanking=false})=>{
  const [movies,setMovies]=useState([]);
  const [fetched,setFetched]=useState(false);
  const [visible,setVisible]=useState(false);
  const scrollRef=useRef(null),rowRef=useRef(null),obsRef=useRef(null);
  const down=useRef(false),startX=useRef(0),scrollLeft=useRef(0),dragging=useRef(false),stRef=useRef(null);
  const loop=movies.length>=7&&!showRanking;
  const display=loop?[...movies,...movies,...movies]:movies;

  const setRow=useCallback(node=>{
    if(obsRef.current)obsRef.current.disconnect();
    obsRef.current=new IntersectionObserver(e=>{if(e[0].isIntersecting){setVisible(true);obsRef.current?.disconnect();}},{rootMargin:'500px'});
    if(node){rowRef.current=node;obsRef.current.observe(node);}
  },[]);

  useEffect(()=>{
    if(customData){setMovies(customData);setFetched(true);return;}
    if(!apiKey||!fetchUrl||!visible||fetched)return;
    let ok=true;
    (async()=>{
      try{
        const sep=fetchUrl.includes('?')?'&':'?';
        const[d1,d2]=await Promise.all([
          fetchWithCache(`${BASE_URL}${fetchUrl}${sep}api_key=${apiKey}&page=1`),
          fetchWithCache(`${BASE_URL}${fetchUrl}${sep}api_key=${apiKey}&page=2`),
        ]);
        if(!ok)return;
        const combined=[...(d1.results||[]),...(d2.results||[])].filter(i=>i.poster_path);
        setMovies(Array.from(new Map(combined.map(i=>[i.id,i])).values()));
        setFetched(true);
      }catch(e){console.error(e);}
    })();
    return()=>{ok=false;};
  },[fetchUrl,apiKey,customData,visible,fetched]);

  const getBlock=useCallback(()=>{
    if(!scrollRef.current||!movies.length||!loop)return 0;
    const ch=scrollRef.current.children;
    if(ch.length>=movies.length*3&&ch[0]&&ch[movies.length])return ch[movies.length].offsetLeft-ch[0].offsetLeft;
    return 0;
  },[movies.length,loop]);

  useEffect(()=>{
    if(fetched&&scrollRef.current&&loop){
      const t=setTimeout(()=>{
        if(scrollRef.current){scrollRef.current.style.scrollBehavior='auto';scrollRef.current.scrollLeft=getBlock();setTimeout(()=>{if(scrollRef.current)scrollRef.current.style.scrollBehavior='smooth';},50);}
      },50);
      return()=>clearTimeout(t);
    }
  },[fetched,loop,getBlock]);

  const snapLoop=useCallback(()=>{
    if(!loop||dragging.current||down.current||!scrollRef.current)return;
    const bw=getBlock();if(!bw)return;
    if(scrollRef.current.scrollLeft<bw*.5){scrollRef.current.style.scrollBehavior='auto';scrollRef.current.scrollLeft+=bw;setTimeout(()=>{if(scrollRef.current)scrollRef.current.style.scrollBehavior='smooth';},50);}
    else if(scrollRef.current.scrollLeft>bw*1.5){scrollRef.current.style.scrollBehavior='auto';scrollRef.current.scrollLeft-=bw;setTimeout(()=>{if(scrollRef.current)scrollRef.current.style.scrollBehavior='smooth';},50);}
  },[loop,getBlock]);

  const onScroll=useCallback(()=>{clearTimeout(stRef.current);stRef.current=setTimeout(snapLoop,150);},[snapLoop]);
  const scroll=useCallback(dir=>{if(scrollRef.current)scrollRef.current.scrollBy({left:dir==='right'?scrollRef.current.clientWidth*.8:-scrollRef.current.clientWidth*.8,behavior:'smooth'});},[]);

  const mDown=e=>{down.current=true;dragging.current=false;startX.current=e.pageX-scrollRef.current.offsetLeft;scrollLeft.current=scrollRef.current.scrollLeft;scrollRef.current.style.scrollBehavior='auto';};
  const mLeave=()=>{down.current=false;if(scrollRef.current)scrollRef.current.style.scrollBehavior='smooth';};
  const mUp=()=>{down.current=false;if(scrollRef.current){scrollRef.current.style.scrollBehavior='smooth';snapLoop();}};
  const mMove=e=>{
    if(!down.current)return;e.preventDefault();
    const walk=(e.pageX-scrollRef.current.offsetLeft-startX.current)*1.5;
    if(Math.abs(walk)>5)dragging.current=true;
    let nl=scrollLeft.current-walk;
    if(loop){const bw=getBlock();if(bw>0){if(nl<10){nl+=bw;scrollLeft.current+=bw;}else if(nl>scrollRef.current.scrollWidth-scrollRef.current.clientWidth-10){nl-=bw;scrollLeft.current-=bw;}}}
    scrollRef.current.scrollLeft=nl;
  };
  const cardClick=useCallback(m=>{if(!dragging.current&&onMediaClick)onMediaClick(m);},[onMediaClick]);

  if(!customData&&!fetched) return <div ref={setRow} className="h-44 md:h-56 mb-10 w-full"/>;
  if(!movies.length) return null;

  return(
    <div ref={setRow} className="mb-10 md:mb-12 relative group/row">
      <div className="flex items-center mb-4 px-4 md:px-8 lg:px-14 max-w-[1800px] mx-auto">
        <h2 className="text-[17px] md:text-xl font-bold text-white/85 tracking-tight">{title}</h2>
        <ChevronRight className="w-5 h-5 text-white/20 ml-2 transition-all group-hover/row:text-white/50"/>
      </div>
      <div className="relative group/nav max-w-[1800px] mx-auto">
        <button onClick={()=>scroll('left')} className="absolute left-0 top-0 bottom-8 w-14 md:w-20 bg-gradient-to-r from-black via-black/70 to-transparent z-30 hidden md:flex items-center justify-start pl-3 opacity-0 group-hover/nav:opacity-100 transition-all outline-none">
          <div className="w-10 h-10 rounded-full glass-dark border border-white/15 flex items-center justify-center text-white hover:bg-[#1a5fa8] transition-colors shadow-xl"><ChevronLeft className="w-5 h-5"/></div>
        </button>
        <div ref={scrollRef} onScroll={onScroll} onMouseDown={mDown} onMouseLeave={mLeave} onMouseUp={mUp} onMouseMove={mMove}
          className={cn("flex gap-3 md:gap-4 overflow-x-auto pb-6 pt-2 px-4 md:px-8 lg:px-14 cursor-grab active:cursor-grabbing gpu snap-x snap-mandatory",showRanking&&"pl-6 md:pl-16")}
          style={{scrollBehavior:'smooth'}}>
          {display.map((m,i)=><MediaCard key={`${m.id}_${i}`} media={m} onClick={cardClick} size={isLarge?"large":"normal"} showRank={showRanking?i+1:null}/>)}
        </div>
        <button onClick={()=>scroll('right')} className="absolute right-0 top-0 bottom-8 w-14 md:w-20 bg-gradient-to-l from-black via-black/70 to-transparent z-30 hidden md:flex items-center justify-end pr-3 opacity-0 group-hover/nav:opacity-100 transition-all outline-none">
          <div className="w-10 h-10 rounded-full glass-dark border border-white/15 flex items-center justify-center text-white hover:bg-[#1a5fa8] transition-colors shadow-xl"><ChevronRight className="w-5 h-5"/></div>
        </button>
      </div>
    </div>
  );
});

// ─── HERO ─────────────────────────────────────────────────────────────────────
const Hero = React.memo(({onPlay,onMoreInfo,apiKey,type='all'})=>{
  const [movie,setMovie]=useState(null),[imgErr,setImgErr]=useState(false);
  const rand=useCallback(async()=>{
    setImgErr(false);
    try{
      const ep=type==='all'?'/trending/all/day':type==='movie'?'/trending/movie/day':'/trending/tv/day';
      const[d1,d2]=await Promise.all([
        fetchWithCache(`${BASE_URL}${ep}?api_key=${apiKey}&page=1`),
        fetchWithCache(`${BASE_URL}${ep}?api_key=${apiKey}&page=2`),
      ]);
      const v=[...(d1.results||[]),...(d2.results||[])].filter(i=>i.backdrop_path&&!i.adult);
      setMovie(v[Math.floor(Math.random()*v.length)]);
    }catch(e){console.error(e);}
  },[apiKey,type]);
  useEffect(()=>{if(apiKey)rand();},[apiKey,rand]);
  if(!movie)return <div className="h-[78vh] w-full" style={{background:'linear-gradient(to bottom, #111 0%, #000 100%)'}}/>;
  const bg=imgErr?`${IMG}w1280${movie.poster_path}`:`${IMG}w1280${movie.backdrop_path}`;
  const isTv=movie.media_type==='tv'||type==='tv';
  return(
    <div className="relative w-full overflow-hidden mb-10 flex flex-col justify-end min-h-[78vh] bg-black">
      <div className="absolute inset-0">
        <img src={bg} alt="" className="w-full h-full object-cover object-top opacity-75 pointer-events-none gpu" decoding="async" onError={()=>setImgErr(true)} draggable="false"/>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent pointer-events-none"/>
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-transparent pointer-events-none hidden md:block"/>
      <div className="relative px-5 md:px-14 pt-32 pb-20 md:pb-32 z-10 max-w-[1800px] mx-auto w-full">
        <div className="max-w-3xl anim-up gpu">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] border border-white/15 px-3 py-1 rounded-md">{isTv?'Series':'Film'}</span>
            {movie.vote_average>0&&<span className="flex items-center gap-1 text-[11px] font-bold text-yellow-400 bg-yellow-400/10 px-2.5 py-1 rounded-md"><Star className="w-3 h-3 fill-current"/>{movie.vote_average.toFixed(1)}</span>}
          </div>
          <h1 className="text-3xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.05] mb-4 drop-shadow-2xl">{movie.title||movie.name}</h1>
          <p className="text-white/65 text-sm md:text-base max-w-2xl line-clamp-2 md:line-clamp-3 font-normal leading-relaxed mb-8">{movie.overview}</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={()=>onPlay(movie)} className="flex items-center gap-2.5 bg-white text-black px-7 py-3.5 rounded-full font-bold text-[15px] hover:bg-white/92 transition-all hover:scale-[1.03] outline-none shadow-xl"><Play className="w-5 h-5 fill-black"/>Watch Now</button>
            <button onClick={()=>onMoreInfo(movie)} className="flex items-center gap-2 glass border border-white/12 hover:bg-white/15 text-white px-7 py-3.5 rounded-full font-semibold text-[15px] transition-all outline-none hover:scale-[1.03]"><Info className="w-5 h-5"/>Details</button>
            <button onClick={rand} className="w-12 h-12 glass border border-white/12 hover:bg-white/15 text-white rounded-full flex items-center justify-center transition-all outline-none hover:scale-[1.03]" title="Shuffle"><Shuffle className="w-5 h-5"/></button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── HOME VIEW ────────────────────────────────────────────────────────────────
const HomeView = React.memo(({apiKey,history,watchlist,algoPrefs,onPlay,onMoreInfo})=>{
  const[dynRows,setDynRows]=useState([]);
  const[hasMore,setHasMore]=useState(true);
  const obs=useRef(null);
  const used=useRef(new Set(['top10','now_playing','on_air','top_movies','top_tv','action','adventure']));

  const staticRows=useMemo(()=>[
    {id:'top10',title:'Top 10 Today',url:'/trending/all/day',isLarge:true,rank:true},
    {id:'now_playing',title:'New in Theatres',url:'/movie/now_playing'},
    {id:'on_air',title:'Currently Airing',url:'/tv/on_the_air'},
    {id:'top_movies',title:'Highest Rated Movies',url:'/movie/top_rated'},
    {id:'top_tv',title:'Highest Rated Series',url:'/tv/top_rated'},
    {id:'action',title:'Action & Thrills',url:'/discover/movie?with_genres=28&sort_by=popularity.desc'},
    {id:'adventure',title:'Epic Adventures',url:'/discover/movie?with_genres=12&sort_by=popularity.desc'},
  ],[]);

  const genRow=useCallback(()=>{
    for(const s of [...history,...watchlist].sort(()=>.5-Math.random())){
      const k=`rec_${s.id}`;
      if(!used.current.has(k)){used.current.add(k);const t=s.media_type||'movie';return{id:k,title:`Because you ${history.some(h=>h.id===s.id)?'watched':'saved'} ${(s.title||s.name||'').slice(0,30)}`,url:`/${t}/${s.id}/recommendations`};}
    }
    for(const g of ALL_GENRES.filter(g=>!algoPrefs.excluded.includes(g.id)).sort(()=>.5-Math.random())){
      const km=`gm_${g.id}`;if(!used.current.has(km)){used.current.add(km);return{id:km,title:`${g.name} Movies`,url:`/discover/movie?with_genres=${g.id}&sort_by=popularity.desc`};}
      const kt=`gt_${g.id}`;if(!used.current.has(kt)){used.current.add(kt);return{id:kt,title:`${g.name} Series`,url:`/discover/tv?with_genres=${g.id}&sort_by=popularity.desc`};}
    }
    return null;
  },[algoPrefs,history,watchlist]);

  const lastRef=useCallback(node=>{
    if(obs.current)obs.current.disconnect();
    obs.current=new IntersectionObserver(e=>{
      if(e[0].isIntersecting&&hasMore){
        setDynRows(prev=>{const nr=[];for(let i=0;i<3;i++){const r=genRow();if(r)nr.push(r);}if(!nr.length)setHasMore(false);return[...prev,...nr];});
      }
    },{rootMargin:'600px'});
    if(node)obs.current.observe(node);
  },[hasMore,genRow]);

  const contWatching=useMemo(()=>history.filter(i=>i.progress>0&&i.progress<95).slice(0,10),[history]);

  return(
    <div className="pb-28 bg-black min-h-screen">
      <Hero onPlay={onPlay} onMoreInfo={onMoreInfo} apiKey={apiKey}/>
      <div className="relative z-20 -mt-20 md:-mt-28">
        {contWatching.length>0&&<ContentRow key="cont" title="Continue Watching" customData={contWatching} onMediaClick={onMoreInfo}/>}
        {staticRows.map(r=><ContentRow key={r.id} title={r.title} fetchUrl={r.url} onMediaClick={onMoreInfo} apiKey={apiKey} isLarge={r.isLarge} showRanking={r.rank}/>)}
        {dynRows.map(r=><ContentRow key={r.id} title={r.title} fetchUrl={r.url} onMediaClick={onMoreInfo} apiKey={apiKey}/>)}
        {hasMore&&<div ref={lastRef} className="h-16 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#1a5fa8]/40 border-t-[#1a5fa8] rounded-full animate-spin"/></div>}
      </div>
    </div>
  );
});

// ─── GENRE GRID ───────────────────────────────────────────────────────────────
const GenreGridView = React.memo(({apiKey,type,genreId,onMediaClick})=>{
  const[results,setResults]=useState([]),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(true),[loading,setLoading]=useState(false);
  const obs=useRef();
  const gObj=[...GENRES.movie,...GENRES.tv].find(g=>g.id===genreId);
  useEffect(()=>{setResults([]);setPage(1);setHasMore(true);},[genreId,type]);
  useEffect(()=>{
    let ok=true;setLoading(true);
    (async()=>{
      try{
        let url=`${BASE_URL}/discover/${type}?api_key=${apiKey}&sort_by=popularity.desc&page=${page}`;
        if(gObj)url+=`&with_genres=${gObj.id}`;
        const d=await fetchWithCache(url);
        if(!ok)return;
        if(d.results?.length){setResults(prev=>Array.from(new Map([...prev,...d.results.filter(i=>i.poster_path)].map(i=>[i.id,i])).values()));if(page>=d.total_pages||page>=50)setHasMore(false);}else setHasMore(false);
      }catch(e){console.error(e);}
      if(ok)setLoading(false);
    })();
    return()=>{ok=false;};
  },[apiKey,type,genreId,page,gObj]);
  const lastRef=useCallback(node=>{
    if(loading)return;
    if(obs.current)obs.current.disconnect();
    obs.current=new IntersectionObserver(e=>{if(e[0].isIntersecting&&hasMore)setPage(p=>p+1);},{rootMargin:'600px'});
    if(node)obs.current.observe(node);
  },[loading,hasMore]);
  return(
    <div className="pt-24 md:pt-32 px-4 md:px-8 lg:px-14 min-h-screen bg-black max-w-[1800px] mx-auto anim-up pb-28">
      <h2 className="text-2xl md:text-3xl font-bold mb-8 text-white">{gObj?.name} {type==='movie'?'Movies':'Series'}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 md:gap-5 pb-10">
        {results.map(i=><MediaCard key={i.id} media={i} onClick={onMediaClick} size="grid"/>)}
      </div>
      {hasMore&&<div ref={lastRef} className="py-12 flex justify-center"><div className="w-7 h-7 border-2 border-[#1a5fa8]/40 border-t-[#1a5fa8] rounded-full animate-spin"/></div>}
    </div>
  );
});

// ─── LIVE STREAM TILE ─────────────────────────────────────────────────────────
const MiniLiveStream = React.memo(({channel,isMain,onSetFocus,hasAudio,onReqAudio,volume,onVolume,ccSettings})=>{
  const vRef=useRef(null),hlsRef=useRef(null),cRef=useRef(null);
  const[hasVideo,setHasVideo]=useState(false),[error,setError]=useState(false),[inView,setInView]=useState(false);
  const[playing,setPlaying]=useState(true);

  useEffect(()=>{const o=new IntersectionObserver(([e])=>setInView(e.isIntersecting),{threshold:.1});if(cRef.current)o.observe(cRef.current);return()=>o.disconnect();},[]);

  const load=useCallback(()=>{
    setError(false);setHasVideo(false);const v=vRef.current;if(!v)return null;
    return initHls(v,channel.url,isMain,{
      onParsed:()=>v.play().then(()=>{setHasVideo(true);setPlaying(true);}).catch(()=>setError(true)),
      onError:(e,d)=>{if(d.fatal){if(d.type===window.Hls?.ErrorTypes?.NETWORK_ERROR&&hlsRef.current)hlsRef.current.startLoad();else if(d.type===window.Hls?.ErrorTypes?.MEDIA_ERROR&&hlsRef.current)hlsRef.current.recoverMediaError();else{if(hlsRef.current)hlsRef.current.destroy();setError(true);}}}
    });
  },[channel.url,isMain]);

  useEffect(()=>{
    if(!inView||channel.type!=='m3u8')return;
    let inst;
    loadHlsScript(()=>{inst=load();hlsRef.current=inst;});
    return()=>{if(inst)inst.destroy();if(vRef.current){vRef.current.pause();vRef.current.removeAttribute('src');vRef.current.load();}};
  },[channel,inView,load]);

  useEffect(()=>{if(vRef.current){vRef.current.muted=!hasAudio;vRef.current.volume=volume;}},[hasAudio,volume]);

  const refresh=e=>{e.stopPropagation();if(hlsRef.current)hlsRef.current.destroy();load();};
  const togglePlay=e=>{e.stopPropagation();if(vRef.current){playing?vRef.current.pause():vRef.current.play().catch(()=>{});setPlaying(!playing);}};

  if(error||channel.type!=='m3u8') return(
    <div ref={cRef} className="flex flex-col bg-[#0a0a0a] h-full w-full cursor-pointer rounded-xl border border-white/5 overflow-hidden" onClick={e=>{e.stopPropagation();if(onSetFocus)onSetFocus();}}>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 p-2">
            <img src={channel.logo} className="w-full h-full object-contain" alt="" onError={e=>{e.target.style.display='none';}}/>
          </div>
          {isMain&&<button onClick={refresh} className="text-xs text-white/50 hover:text-white flex items-center gap-1 mx-auto"><RefreshCw className="w-3 h-3"/>Retry</button>}
        </div>
      </div>
    </div>
  );

  return(
    <div ref={cRef}
      className={cn("relative flex flex-col bg-black overflow-hidden transition-all duration-300 group cursor-pointer w-full h-full rounded-xl md:rounded-2xl",
        hasAudio&&!isMain?"ring-2 ring-[#1a5fa8]":"border border-white/8 hover:border-white/20")}
      onClick={e=>{e.stopPropagation();if(onSetFocus&&!isMain)onSetFocus();}}>
      <video ref={vRef} muted={!hasAudio} playsInline className={cn("absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-700",hasVideo?"opacity-100":"opacity-0")}/>
      {!hasVideo&&<div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#1a5fa8]/50 border-t-[#1a5fa8] rounded-full animate-spin"/></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"/>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 opacity-0 group-hover:opacity-100">
        <button type="button" onMouseDown={e=>e.stopPropagation()} onClick={togglePlay}
          className={cn("glass-dark text-white rounded-full pointer-events-auto hover:bg-white hover:text-black border border-white/10 outline-none flex items-center justify-center transition-all",isMain?"p-3 w-12 h-12":"p-2 w-9 h-9")}>
          {playing?<Pause className={cn("fill-current",isMain?"w-5 h-5":"w-3.5 h-3.5")}/>:<Play className={cn("fill-current ml-0.5",isMain?"w-5 h-5":"w-3.5 h-3.5")}/>}
        </button>
      </div>
      <div className={cn("absolute z-30 opacity-0 group-hover:opacity-100 pointer-events-none",isMain?"bottom-4 left-4":"top-2 left-2")}>
        <div className="flex items-center gap-2 glass-dark border border-white/10 p-1.5 rounded-lg shadow-lg pointer-events-auto">
          <div className="bg-white rounded p-1 shrink-0"><img src={channel.logo} className={cn("object-contain",isMain?"w-8 h-4":"w-5 h-3")} alt=""/></div>
          {isMain&&<span className="font-semibold text-white text-xs pr-2 max-w-[120px] truncate">{channel.name}</span>}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 flex items-center gap-1 z-30 pointer-events-auto glass-dark p-1 rounded-full border border-white/8 opacity-0 group-hover:opacity-100">
        <button type="button" onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();if(onReqAudio)onReqAudio();}}
          className={cn("p-1.5 rounded-full transition-colors outline-none",hasAudio?"bg-[#1a5fa8] text-white":"text-white hover:bg-white/15")}>
          {hasAudio?<Volume2 className="w-3 h-3"/>:<VolumeX className="w-3 h-3"/>}
        </button>
        {hasAudio&&isMain&&<input type="range" min="0" max="1" step=".05" value={volume} onMouseDown={e=>e.stopPropagation()} onChange={e=>onVolume(parseFloat(e.target.value))} className="w-16 cursor-pointer hidden sm:block"/>}
        <button type="button" onMouseDown={e=>e.stopPropagation()} onClick={refresh} className="p-1.5 rounded-full text-white hover:bg-white/15 outline-none"><RefreshCw className="w-3 h-3"/></button>
      </div>
    </div>
  );
});

// ─── LIVE TV VIEW ─────────────────────────────────────────────────────────────
const LiveTvView = React.memo(({focusMode,setFocusMode,ccSettings})=>{
  const[viewMode,setViewMode]=useLocalStorage('onyx_livetv_mode','grid');
  const[gridCols,setGridCols]=useLocalStorage('onyx_livetv_cols',3);
  const[focusedId,setFocusedId]=useState(LIVE_CHANNELS[0].id);
  const[audioIds,setAudioIds]=useState([LIVE_CHANNELS[0].id]);
  const[vol,setVol]=useLocalStorage('onyx_livetv_vol',1);

  const reqAudio=useCallback(id=>setAudioIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]),[]);
  const setFocus=useCallback(id=>{setFocusedId(id);setAudioIds([id]);if(viewMode==='grid')setViewMode('sidebar');},[viewMode,setViewMode]);
  const main=useMemo(()=>LIVE_CHANNELS.find(c=>c.id===focusedId)||LIVE_CHANNELS[0],[focusedId]);
  const others=useMemo(()=>LIVE_CHANNELS.filter(c=>c.id!==focusedId),[focusedId]);
  const colsClass=gridCols===1?'grid-cols-1 max-w-2xl mx-auto':gridCols===2?'grid-cols-2':gridCols===3?'grid-cols-2 md:grid-cols-3':gridCols===4?'grid-cols-2 md:grid-cols-4':'grid-cols-3 md:grid-cols-5';

  return(
    <div className={cn("bg-black flex flex-col px-4 md:px-8 lg:px-14 max-w-[1800px] mx-auto transition-all",focusMode?"pt-4":"pt-[72px]",(viewMode==='sidebar'||viewMode==='single')?"h-screen overflow-hidden pb-4":"min-h-screen pb-28")}>
      <div className={cn("flex items-center justify-end gap-3 w-full shrink-0 py-3",focusMode?"mb-3":"mb-5 mt-3")}>
        {viewMode==='grid'&&(
          <div className="flex items-center gap-2 glass border border-white/10 px-4 py-2 rounded-full">
            <span className="text-[11px] font-semibold text-white/40 hidden sm:block">Cols</span>
            <input type="range" min="1" max="5" value={gridCols} onChange={e=>setGridCols(parseInt(e.target.value))} className="w-14 cursor-pointer"/>
            <span className="text-xs font-bold text-white w-4 text-center">{gridCols}</span>
          </div>
        )}
        <div className="glass border border-white/10 p-1 rounded-full flex gap-1">
          {[['grid',<LayoutGrid key="g" className="w-4 h-4"/>,'Grid'],['sidebar',<Sidebar key="s" className="w-4 h-4"/>,'Sidebar'],['single',<Square key="sq" className="w-4 h-4"/>,'Single']].map(([mode,icon,lbl])=>(
            <button key={mode} onClick={()=>setViewMode(mode)} className={cn("px-4 py-2 rounded-full text-xs font-semibold transition-all outline-none flex items-center gap-1.5",viewMode===mode?"bg-white text-black shadow":"text-white/50 hover:text-white hover:bg-white/10")}>
              {icon}<span className="hidden sm:inline">{lbl}</span>
            </button>
          ))}
          <div className="w-px bg-white/15 mx-0.5 self-stretch hidden sm:block"/>
          <button onClick={e=>{e.preventDefault();e.stopPropagation();setFocusMode(v=>!v);}} className={cn("px-4 py-2 rounded-full text-xs font-semibold transition-all outline-none flex items-center gap-1.5",focusMode?"bg-[#1a5fa8] text-white":"text-white/50 hover:text-white hover:bg-white/10")}>
            {focusMode?<Minimize className="w-4 h-4"/>:<Maximize className="w-4 h-4"/>}<span className="hidden sm:inline">Focus</span>
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0 w-full">
        {viewMode==='sidebar'&&(
          <div className="flex flex-col lg:flex-row gap-3 h-full min-h-0">
            <div className="flex-1 rounded-2xl overflow-hidden min-h-0">
              <MiniLiveStream channel={main} isMain hasAudio={audioIds.includes(main.id)} onReqAudio={()=>reqAudio(main.id)} volume={vol} onVolume={setVol} ccSettings={ccSettings}/>
            </div>
            <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 overflow-y-auto flex flex-row lg:flex-col gap-3 pb-3 lg:pb-0 min-h-[140px] lg:min-h-0">
              {others.map(ch=>(
                <div key={ch.id} className="h-28 md:h-32 lg:h-auto lg:aspect-video w-48 lg:w-full flex-shrink-0">
                  <MiniLiveStream channel={ch} isMain={false} onSetFocus={()=>setFocus(ch.id)} hasAudio={audioIds.includes(ch.id)} onReqAudio={()=>reqAudio(ch.id)} volume={vol} onVolume={setVol} ccSettings={ccSettings}/>
                </div>
              ))}
            </div>
          </div>
        )}
        {viewMode==='single'&&(
          <div className="flex-1 min-h-0 w-full relative group rounded-2xl overflow-hidden">
            <div className="absolute top-4 left-4 z-50 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
              <select value={main.id} onChange={e=>setFocus(e.target.value)} className="custom-select glass-dark text-white border border-white/15 rounded-full px-5 py-2.5 outline-none cursor-pointer text-sm font-semibold pr-10">
                {LIVE_CHANNELS.map(c=><option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}
              </select>
            </div>
            <MiniLiveStream channel={main} isMain hasAudio={audioIds.includes(main.id)} onReqAudio={()=>reqAudio(main.id)} volume={vol} onVolume={setVol} ccSettings={ccSettings}/>
          </div>
        )}
        {viewMode==='grid'&&(
          <div className={cn("grid gap-3 md:gap-4 overflow-y-auto pb-28 pt-1 px-1 h-full min-h-0 w-full",colsClass)}>
            {LIVE_CHANNELS.map(ch=>(
              <div key={ch.id} className="aspect-video">
                <MiniLiveStream channel={ch} isMain={ch.id===focusedId} onSetFocus={()=>setFocus(ch.id)} hasAudio={audioIds.includes(ch.id)} onReqAudio={()=>reqAudio(ch.id)} volume={vol} onVolume={setVol} ccSettings={ccSettings}/>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ─── SPORTS VIEW ──────────────────────────────────────────────────────────────
const fmtSportName = n => {if(!n)return'';const m={football:'Soccer','american-football':'NFL',basketball:'NBA',baseball:'MLB',hockey:'NHL',tennis:'Tennis',mma:'MMA',boxing:'Boxing',cricket:'Cricket',rugby:'Rugby','motor-sports':'Motorsport'};return m[n.toLowerCase()]||n.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');};
const rScore = s => {if(s==null)return'';if(typeof s==='object')return String(s.current||s.display||s.total||'');return String(s);};

const SportCard = React.memo(({match,isLive,fmtTime,onPlay,isLoading})=>(
  <div onClick={()=>onPlay(match)}
    className="bg-white/[0.04] hover:bg-white/[0.08] rounded-2xl p-5 cursor-pointer transition-all duration-200 flex flex-col relative group border border-white/[0.06] hover:border-white/15 outline-none"
    tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onPlay(match);}}>
    <div className="flex justify-between items-center mb-4">
      <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{fmtSportName(match.category)}</span>
      {isLive
        ?<div className="flex items-center gap-1.5 bg-red-500/15 text-red-400 border border-red-500/25 px-2.5 py-1 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse"/><span className="text-[10px] font-bold uppercase">Live</span></div>
        :<span className="text-[11px] text-white/40 font-medium">{fmtTime(match.date)}</span>
      }
    </div>
    {match.teams?.home&&match.teams?.away?(
      <div className="flex flex-col gap-3">
        {[match.teams.away,match.teams.home].map((t,i)=>(
          <div key={i} className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 shrink-0 bg-white/8 rounded-full flex items-center justify-center p-1.5 border border-white/5">
                {t.badge?<img src={`https://streamed.pk/api/images/badge/${t.badge}.webp`} className="w-full h-full object-contain" alt="" onError={e=>{e.target.style.display='none';}}/>:null}
                <span className="text-[10px] font-bold text-white/40">{t.name?.charAt(0)||'?'}</span>
              </div>
              <span className="text-white/85 font-semibold text-sm md:text-base line-clamp-1">{t.name}</span>
            </div>
            <span className="text-white/90 font-bold text-lg tabular-nums ml-3">{match.score?rScore(i===0?match.score.away:match.score.home):''}</span>
          </div>
        ))}
      </div>
    ):<h3 className="text-white/85 font-semibold text-base line-clamp-2 mt-1">{String(match.title||match.name)}</h3>}
    {isLoading&&<div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-2xl"><div className="w-8 h-8 border-2 border-[#1a5fa8]/50 border-t-[#1a5fa8] rounded-full animate-spin"/></div>}
  </div>
));

const LiveSportsView = React.memo(({onPlaySport})=>{
  const[all,setAll]=useState([]),[loading,setLoading]=useState(true),[loadingId,setLoadingId]=useState(null),[cat,setCat]=useState('All');
  const isLive=useCallback(d=>{const n=Date.now(),m=new Date(d).getTime();return n>=m&&n<=m+10800000;},[]);
  const fmtTime=useCallback(d=>{const dt=new Date(d),t=new Date(),tmr=new Date(t);tmr.setDate(tmr.getDate()+1);const ts=dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(dt.toDateString()===t.toDateString())return`Today ${ts}`;if(dt.toDateString()===tmr.toDateString())return`Tomorrow ${ts}`;return`${dt.toLocaleDateString([],{month:'short',day:'numeric'})} ${ts}`;},[]);

  useEffect(()=>{
    let ok=true;
    (async()=>{
      try{
        const data=await fetchWithCache('https://streamed.pk/api/matches/all');if(!ok)return;
        let md=[];if(Array.isArray(data))md=data;else Object.values(data).forEach(v=>{if(Array.isArray(v))md.push(...v);});
        const um=new Map();
        md.forEach(m=>{
          const k=m.teams?.home&&m.teams?.away?[m.teams.home.name,m.teams.away.name].sort().join('vs'):(m.title||m.id||'').trim();
          if(!k)return;
          const ex=um.get(k);
          if(!ex||(m.teams?.home?.badge&&!ex.teams?.home?.badge))um.set(k,m);
        });
        if(ok)setAll(Array.from(um.values()));
      }catch(e){console.error(e);}
      if(ok)setLoading(false);
    })();
    return()=>{ok=false;};
  },[]);

  const sports=useMemo(()=>{
    const r=new Set(all.map(m=>fmtSportName(m.category)).filter(Boolean));
    const priority=['NBA','NFL','MLB','NHL','Soccer','Tennis'];
    return['All',...Array.from(r).sort((a,b)=>{const ia=priority.indexOf(a),ib=priority.indexOf(b);if(ia!==-1&&ib!==-1)return ia-ib;if(ia!==-1)return-1;if(ib!==-1)return 1;return a.localeCompare(b);})];
  },[all]);

  const sorted=useMemo(()=>(cat==='All'?all:all.filter(m=>fmtSportName(m.category)===cat)).sort((a,b)=>{const al=isLive(a.date),bl=isLive(b.date);if(al&&!bl)return-1;if(!al&&bl)return 1;return new Date(a.date)-new Date(b.date);}),[all,cat,isLive]);

  const handlePlay=useCallback(async m=>{setLoadingId(m.id);await onPlaySport(m);setLoadingId(null);},[onPlaySport]);

  return(
    <div className="pt-24 md:pt-32 px-4 md:px-8 lg:px-14 min-h-screen bg-black max-w-[1800px] mx-auto pb-28 anim-up">
      <div className="flex gap-2 overflow-x-auto pb-2 fade-r mb-8">
        {sports.map(s=>(
          <button key={s} onClick={()=>setCat(s)}
            className={cn("px-5 py-2 rounded-full font-semibold text-[13px] transition-all whitespace-nowrap outline-none border",
              cat===s?"bg-white text-black border-white":"glass border-white/10 text-white/55 hover:text-white hover:border-white/20")}>
            {s}
          </button>
        ))}
      </div>
      {loading?(
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {[...Array(8)].map((_,i)=><div key={i} className="h-40 skeleton rounded-2xl"/>)}
        </div>
      ):sorted.length>0?(
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {sorted.map(m=><SportCard key={m.id} match={m} isLive={isLive(m.date)} fmtTime={fmtTime} onPlay={handlePlay} isLoading={loadingId===m.id}/>)}
        </div>
      ):(
        <div className="flex flex-col items-center justify-center py-24 text-white/30">
          <Dribbble className="w-14 h-14 mb-4 opacity-30"/>
          <p className="text-lg font-medium">No matches right now</p>
        </div>
      )}
    </div>
  );
});

// ─── SKIP TIMESTAMPS BUTTON ───────────────────────────────────────────────────
// FIX: Correct API endpoint + normalize multiple response formats
const SKIP_LABELS = {intro:'Skip Intro',recap:'Skip Recap',credits:'Skip Credits',preview:'Skip Preview',outro:'Skip Outro',opening:'Skip Intro',ending:'Skip Credits'};

const SkipButton = React.memo(({mediaId,isTv,season,episode,elapsed,onSkip,settings})=>{
  const[timestamps,setTimestamps]=useState(null);
  const[activeSegment,setActiveSegment]=useState(null);
  const[visible,setVisible]=useState(false);
  const[autoSkipped,setAutoSkipped]=useState({});
  const dismissed=useRef({});
  const hideTimer=useRef(null);
  const prevKey=useRef(null);

  // FIX: TheIntroDB correct endpoints + multiple response format handling
  useEffect(()=>{
    if(!settings?.enabled||!mediaId)return;
    let ok=true;
    (async()=>{
      try{
        let url,data;
        if(isTv&&season&&episode){
          url=`${INTRODB}/show/${mediaId}/season/${season}/episode/${episode}`;
          const r=await fetch(url,{signal:AbortSignal.timeout(8000)});
          if(r.ok)data=await r.json();
        }else if(!isTv){
          url=`${INTRODB}/movie/${mediaId}`;
          const r=await fetch(url,{signal:AbortSignal.timeout(8000)});
          if(r.ok)data=await r.json();
        }
        if(!ok||!data)return;

        // Normalize into: { [type]: {startMs, endMs} }
        const norm={};
        const toMs=v=>v>10000?v:v*1000; // >10000 = already ms, else seconds

        // Format A: { timestamps: [{type,start,end},...] }
        if(Array.isArray(data?.timestamps)){
          data.timestamps.forEach(ts=>{
            if(ts.type&&(ts.start!=null||ts.startTime!=null)){
              norm[ts.type]={startMs:toMs(ts.start??ts.startTime??0),endMs:toMs(ts.end??ts.endTime??0)};
            }
          });
        }

        // Format B: { intro: {start:N,end:N}, recap: {...}, ... }
        // Format C: { intro: {start_ms:N,end_ms:N}, ... }
        if(Object.keys(norm).length===0){
          ['intro','recap','credits','preview','outro','opening','ending'].forEach(k=>{
            const seg=data[k]||(Array.isArray(data[k+'s'])?data[k+'s'][0]:null);
            if(!seg)return;
            const sm=seg.start_ms!=null?seg.start_ms:toMs(seg.startTime??seg.start??0);
            const em=seg.end_ms!=null?seg.end_ms:toMs(seg.endTime??seg.end??0);
            if(em>sm)norm[k]={startMs:sm,endMs:em};
          });
        }

        if(ok&&Object.keys(norm).length>0)setTimestamps(norm);
      }catch(e){/* silently ignore */}
    })();
    return()=>{ok=false;};
  },[mediaId,isTv,season,episode,settings?.enabled]);

  useEffect(()=>{
    setTimestamps(null);setActiveSegment(null);setVisible(false);
    setAutoSkipped({});dismissed.current={};clearTimeout(hideTimer.current);prevKey.current=null;
  },[mediaId,season,episode]);

  useEffect(()=>{
    if(!timestamps||!settings?.enabled)return;
    const elMs=elapsed*1000;
    const typeMap=[['intro',settings.showIntro],['recap',settings.showRecap],['credits',settings.showCredits],['preview',settings.showPreview],['outro',settings.showCredits],['opening',settings.showIntro],['ending',settings.showCredits]];
    let found=null;
    for(const[type,enabled]of typeMap){
      if(!enabled)continue;
      const seg=timestamps[type];if(!seg)continue;
      const key=`${type}_${seg.startMs}`;
      if(dismissed.current[key])continue;
      if(elMs>=seg.startMs&&elMs<=seg.endMs){found={type,key,...seg};break;}
    }
    if(found?.key!==prevKey.current){
      prevKey.current=found?.key||null;
      setActiveSegment(found);
      if(found){
        if(settings.autoSkip&&!autoSkipped[found.key]){
          setAutoSkipped(p=>({...p,[found.key]:true}));
          dismissed.current[found.key]=true;
          onSkip(Math.floor(found.endMs/1000));
        }else{
          setVisible(true);clearTimeout(hideTimer.current);
          hideTimer.current=setTimeout(()=>setVisible(false),(settings.buttonDuration||6)*1000);
        }
      }else{setVisible(false);}
    }
  },[elapsed,timestamps,settings,autoSkipped,onSkip]);

  const handleSkip=()=>{
    if(!activeSegment)return;
    dismissed.current[activeSegment.key]=true;
    setVisible(false);setActiveSegment(null);prevKey.current=null;
    clearTimeout(hideTimer.current);
    onSkip(Math.floor(activeSegment.endMs/1000));
  };

  if(!visible||!activeSegment||!settings?.enabled)return null;
  return(
    <div className="absolute bottom-16 md:bottom-20 right-4 md:right-8 z-50" style={{animation:'fadeUp .3s cubic-bezier(.16,1,.3,1) both'}}>
      <button onClick={handleSkip}
        className="flex items-center gap-2.5 glass-dark border border-white/25 hover:bg-white hover:text-black text-white px-6 py-3 rounded-full font-semibold text-sm transition-all shadow-2xl outline-none group">
        <span>{SKIP_LABELS[activeSegment.type]||'Skip'}</span>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"/>
      </button>
    </div>
  );
});

// ─── PLAYER OVERLAY ───────────────────────────────────────────────────────────
// FIX: 15s load timeout fallback, better error UX, ESC to close, source cycling
const PlayerOverlay = ({media,config,onClose,sourceKey,vidplusSettings,skipSettings})=>{
  const[loading,setLoading]=useState(true);
  const[loadErr,setLoadErr]=useState(false);
  const[showCtrl,setShowCtrl]=useState(true);
  const[activeSource,setActiveSource]=useState(sourceKey||'vidplus');
  const[src,setSrc]=useState('');
  const[iframeKey,setIframeKey]=useState(0);
  const[elapsed,setElapsed]=useState(0);
  const[skipTime,setSkipTime]=useState(0);
  const vRef=useRef(null),ctrlTimer=useRef(null),mounted=useRef(true);
  const elTimer=useRef(null),elOrigin=useRef(null),loadTimeout=useRef(null);
  const vp={...DEFAULT_VIDPLUS,...(vidplusSettings||{})};

  const isLive=media.isLive;
  const isTv=!isLive&&(media.media_type==='tv'||(!media.release_date&&media.name));
  const cfg=config||{season:1,episode:1};
  const sourceKeys=Object.keys(SOURCES);
  const curIdx=sourceKeys.indexOf(activeSource);

  useEffect(()=>{mounted.current=true;lockScroll();return()=>{mounted.current=false;unlockScroll();};},[]);

  // ESC to close
  useEffect(()=>{
    const h=e=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  },[onClose]);

  const getSrc=useCallback((sk,startAt=0)=>{
    if(isLive)return media.url||'';
    const id=media.id;if(!id)return'';
    const s=cfg.season||1,e=cfg.episode||1;
    switch(sk){
      case 'vidplus':{
        const p=new URLSearchParams({
          primarycolor:'1a5fa8',secondarycolor:'0d1f30',iconcolor:'FFFFFF',
          icons:vp.icons||'lucide',poster:'true',title:'true',autoplay:'true',
          autoNext:isTv?String(vp.autoNext!==false):'false',
          nextButton:isTv?'true':'false',
          episodelist:isTv?String(vp.episodeList!==false):'false',
          servericon:String(vp.serverIcon!==false),pip:'true',download:'false',
          font:vp.subtitleFont||'Inter',fontsize:String(vp.subtitleFontSize||20),
          opacity:String(vp.subtitleOpacity??0.5),
          ...(startAt>0&&{progress:String(Math.floor(startAt))}),
        }).toString();
        return isTv?`https://player.vidplus.to/embed/tv/${id}/${s}/${e}?${p}`:`https://player.vidplus.to/embed/movie/${id}?${p}`;
      }
      case 'autoembed': return isTv?`https://autoembed.cc/tv/tmdb/${id}-${s}-${e}`:`https://autoembed.cc/movie/tmdb/${id}`;
      case 'vidlink':{
        const p=new URLSearchParams({primaryColor:'1a5fa8',secondaryColor:'111',iconColor:'fff',autoplay:'true',nextbutton:isTv?'true':'false'}).toString();
        return isTv?`https://vidlink.pro/tv/${id}/${s}/${e}?${p}`:`https://vidlink.pro/movie/${id}?${p}`;
      }
      case 'vidsrc': return isTv?`https://vidsrc.net/embed/tv?tmdb=${id}&season=${s}&episode=${e}`:`https://vidsrc.net/embed/movie?tmdb=${id}`;
      case 'embedsu': return isTv?`https://embed.su/embed/tv/${id}/${s}/${e}`:`https://embed.su/embed/movie/${id}`;
      case 'vidsrcicu': return isTv?`https://vidsrc.icu/embed/tv/${id}/${s}/${e}`:`https://vidsrc.icu/embed/movie/${id}`;
      default: return isTv?`https://player.vidplus.to/embed/tv/${id}/${s}/${e}`:`https://player.vidplus.to/embed/movie/${id}`;
    }
  },[isLive,isTv,media,cfg,vp]);

  // Rebuild on source change
  useEffect(()=>{
    setLoading(true);setLoadErr(false);
    setSrc(getSrc(activeSource,0));setSkipTime(0);setElapsed(0);
    clearInterval(elTimer.current);clearTimeout(loadTimeout.current);
    // FIX: 15s auto-clear - iframes don't always fire onLoad
    loadTimeout.current=setTimeout(()=>{if(mounted.current)setLoading(false);},15000);
  },[activeSource,getSrc]);

  const startElapsed=useCallback((from=0)=>{
    clearInterval(elTimer.current);
    elOrigin.current=Date.now()-from*1000;
    elTimer.current=setInterval(()=>{if(mounted.current)setElapsed(Math.floor((Date.now()-elOrigin.current)/1000));},500);
  },[]);

  useEffect(()=>()=>{clearInterval(elTimer.current);clearTimeout(loadTimeout.current);},[]);

  const handleSkip=useCallback(endSec=>{
    if(!mounted.current)return;
    setSrc(getSrc(activeSource,endSec));setSkipTime(endSec);setIframeKey(k=>k+1);
    setLoading(true);setLoadErr(false);
    clearTimeout(loadTimeout.current);
    loadTimeout.current=setTimeout(()=>{if(mounted.current)setLoading(false);},15000);
    startElapsed(endSec);setElapsed(endSec);
  },[activeSource,getSrc,startElapsed]);

  const onIframeLoad=useCallback(()=>{
    if(!mounted.current)return;
    clearTimeout(loadTimeout.current);
    setLoading(false);setLoadErr(false);
    startElapsed(skipTime);
  },[skipTime,startElapsed]);

  // HLS for live
  useEffect(()=>{
    if(!isLive||!src?.includes?.('.m3u8'))return;
    let hls;
    const load=()=>{
      setLoading(false);const v=vRef.current;if(!v)return;
      hls=initHls(v,src,true,{
        onParsed:()=>v.play().catch(()=>{}),
        onError:(e,d)=>{if(d.fatal){if(d.type===window.Hls?.ErrorTypes?.NETWORK_ERROR&&hls)hls.startLoad();else if(d.type===window.Hls?.ErrorTypes?.MEDIA_ERROR&&hls)hls.recoverMediaError();else if(hls){hls.destroy();setLoadErr(true);}}}
      });
    };
    loadHlsScript(load);
    return()=>{if(hls)hls.destroy();};
  },[isLive,src]);

  // Auto-hide controls
  const mMove=useCallback(()=>{
    setShowCtrl(true);clearTimeout(ctrlTimer.current);
    ctrlTimer.current=setTimeout(()=>{if(mounted.current)setShowCtrl(false);},3500);
  },[]);
  useEffect(()=>{
    window.addEventListener('mousemove',mMove);window.addEventListener('touchstart',mMove,{passive:true});
    mMove();
    return()=>{window.removeEventListener('mousemove',mMove);window.removeEventListener('touchstart',mMove);clearTimeout(ctrlTimer.current);};
  },[mMove]);

  return(
    <div className="fixed inset-0 z-[100] bg-black flex flex-col font-sans gpu" style={{animation:'fadeUp .3s ease both'}}>
      {loading&&!isLive&&(
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 pointer-events-none">
          <div className="w-10 h-10 border-2 border-[#1a5fa8]/40 border-t-[#1a5fa8] rounded-full animate-spin mb-4"/>
          <p className="text-white/30 text-sm">Loading {SOURCES[activeSource]?.name||'player'}…</p>
        </div>
      )}
      <div className={cn("absolute top-0 left-0 w-full h-28 bg-gradient-to-b from-black/90 to-transparent z-40 pointer-events-none transition-opacity duration-400",showCtrl?"opacity-100":"opacity-0")}/>
      <div className={cn("absolute top-0 left-0 w-full p-4 md:p-6 flex items-center justify-between z-50 transition-opacity duration-400",showCtrl?"opacity-100 pointer-events-auto":"opacity-0 pointer-events-none")}>
        <button onClick={onClose} className="flex items-center gap-2 glass-dark border border-white/15 text-white hover:bg-white hover:text-black px-5 py-2.5 rounded-full font-semibold text-sm transition-all shadow-xl outline-none group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"/><span>Back</span>
        </button>
        {!isLive&&(
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {Object.entries(SOURCES).map(([k,v])=>(
              <button key={k} onClick={()=>setActiveSource(k)}
                className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold transition-all outline-none border whitespace-nowrap",
                  activeSource===k?"bg-white text-black border-white shadow":"glass-dark text-white/50 border-white/15 hover:border-white/35 hover:text-white")}>
                {v.name}
              </button>
            ))}
          </div>
        )}
        {isLive&&<div className="flex items-center gap-2 glass-dark border border-white/10 px-4 py-2 rounded-full"><div className="w-2 h-2 rounded-full bg-red-500 live-pulse"/><span className="text-xs font-semibold text-white">{String(media.name||'Live')}</span></div>}
      </div>
      <div className="flex-1 w-full h-full relative bg-black">
        {isLive&&media.type==='iframe'&&<iframe src={src} className="w-full h-full border-0 bg-black" allowFullScreen allow="autoplay;encrypted-media;fullscreen" onLoad={()=>{if(mounted.current)setLoading(false);}}/>}
        {isLive&&src?.includes?.('.m3u8')&&<video ref={vRef} controls autoPlay playsInline className="w-full h-full bg-black outline-none"/>}
        {!isLive&&(
          <iframe key={iframeKey} src={src} className="w-full h-full border-0 bg-black" allowFullScreen
            allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;fullscreen"
            title="Player" onLoad={onIframeLoad} onError={()=>{if(mounted.current)setLoadErr(true);}}/>
        )}
        {loadErr&&!isLive&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30">
            <AlertCircle className="w-12 h-12 text-white/20 mb-4"/>
            <p className="text-white/60 text-base font-semibold mb-2">Stream unavailable</p>
            <p className="text-white/30 text-sm mb-6">This source may be down</p>
            <div className="flex gap-3">
              <button onClick={()=>setActiveSource(sourceKeys[(curIdx+1)%sourceKeys.length])} className="px-6 py-3 bg-white text-black rounded-full font-semibold text-sm hover:bg-white/92 outline-none">Try Next Source</button>
              <button onClick={()=>{setLoadErr(false);setIframeKey(k=>k+1);}} className="px-6 py-3 glass border border-white/15 text-white rounded-full font-semibold text-sm hover:bg-white/10 outline-none">Retry</button>
            </div>
          </div>
        )}
      </div>
      {!isLive&&skipSettings?.enabled&&(
        <SkipButton mediaId={media.id} isTv={isTv} season={cfg.season} episode={cfg.episode}
          elapsed={elapsed} onSkip={handleSkip} settings={skipSettings}/>
      )}
    </div>
  );
};

// ─── SEARCH VIEW ──────────────────────────────────────────────────────────────
const SearchView = React.memo(({apiKey,geminiApiKey,history,onMediaClick})=>{
  const[mode,setMode]=useState('standard');
  const[q,setQ]=useState('');
  const dq=useDebounce(q,500);
  const[results,setResults]=useState([]),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(true),[isLoading,setIsLoading]=useState(false);
  const[fType,setFType]=useState('all'),[fSort,setFSort]=useState('popularity.desc');
  const[aiP,setAiP]=useState(''),[aiLoad,setAiLoad]=useState(false),[aiResp,setAiResp]=useState(null),[aiErr,setAiErr]=useState('');
  const obs=useRef();

  useEffect(()=>{setResults([]);setPage(1);setHasMore(true);},[dq,fType,fSort,mode]);
  useEffect(()=>{
    let ok=true;if(mode!=='standard')return;
    const run=async()=>{
      setIsLoading(true);
      try{
        let nr=[],tp=1;
        if(!dq){
          const types=fType==='all'?['movie','tv']:[fType];
          const urls=[];types.forEach(t=>{urls.push(`${BASE_URL}/discover/${t}?api_key=${apiKey}&sort_by=${fSort}&page=${page}`);urls.push(`${BASE_URL}/discover/${t}?api_key=${apiKey}&sort_by=${fSort}&page=${page+1}`);});
          const rs=await Promise.all(urls.map(u=>fetchWithCache(u)));if(!ok)return;
          rs.forEach(d=>{if(d.results)nr.push(...d.results.filter(i=>i.poster_path).map(i=>({...i,media_type:i.media_type||(fType==='all'?'movie':fType)})));tp=Math.max(tp,d.total_pages||1);});
        }else{
          const cq=dq.toLowerCase().replace(/ movies?| films?| shows?| series/g,'').trim();
          const rs=await Promise.all([1,2,3].map(n=>fetchWithCache(`${BASE_URL}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(cq)}&page=${page+n-1}`)));if(!ok)return;
          rs.forEach(d=>{if(d.results){let v=d.results.filter(i=>(i.media_type==='movie'||i.media_type==='tv')&&i.poster_path);if(fType!=='all')v=v.filter(i=>i.media_type===fType);nr.push(...v);tp=Math.max(tp,d.total_pages||1);}});
        }
        const deduped=Array.from(new Map(nr.map(i=>[i.id,i])).values()).sort((a,b)=>fSort==='vote_average.desc'?(b.vote_average||0)-(a.vote_average||0):(b.popularity||0)-(a.popularity||0));
        setResults(prev=>page===1?deduped:[...prev,...deduped.filter(i=>!prev.some(p=>p.id===i.id))]);
        if(page>=tp||page>=40)setHasMore(false);
      }catch(e){console.error(e);}finally{if(ok)setIsLoading(false);}
    };
    run();return()=>{ok=false;};
  },[dq,apiKey,fType,fSort,page,mode]);

  const lastRef=useCallback(node=>{
    if(isLoading||mode!=='standard')return;
    if(obs.current)obs.current.disconnect();
    obs.current=new IntersectionObserver(e=>{if(e[0].isIntersecting&&hasMore)setPage(p=>p+(dq?3:2));},{rootMargin:'600px'});
    if(node)obs.current.observe(node);
  },[isLoading,hasMore,dq,mode]);

  // FIX: Use gemini-1.5-flash-8b (generous free tier) instead of 2.0-flash
  const handleAi=async e=>{
    e.preventDefault();if(!aiP.trim()||aiLoad)return;
    if(!geminiApiKey){setAiErr('Add your Gemini API key in Settings → API Keys.');return;}
    setAiLoad(true);setAiErr('');setAiResp(null);
    try{
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${geminiApiKey}`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          contents:[{parts:[{text:`User: "${aiP}"\nWatch history: ${history.slice(0,10).map(h=>h.title||h.name).join(', ')||'none'}\n\nReturn JSON with text_response (string) and items array (each: {type:"movie"|"tv", search_query:string, reason:string}).`}]}],
          generationConfig:{responseMimeType:'application/json',maxOutputTokens:1000},
        })
      });
      if(!r.ok){const err=await r.json();throw new Error(err?.error?.message||`API error ${r.status}`);}
      const txt=(await r.json()).candidates?.[0]?.content?.parts?.[0]?.text;
      if(!txt)throw new Error('No response');
      const j=JSON.parse(txt.replace(/```json|```/g,'').trim());
      const cards=[];
      for(const rec of(j.items||[]).slice(0,6)){
        try{
          const sr=await fetchWithCache(`${BASE_URL}/search/${rec.type==='tv'?'tv':'movie'}?api_key=${apiKey}&query=${encodeURIComponent(rec.search_query)}`);
          const m=sr.results?.find(x=>x.poster_path);
          if(m)cards.push({type:rec.type,media:m,reason:rec.reason,key:`ai_${m.id}`});
        }catch{}
      }
      setAiResp({text:(j.text_response||'').replace(/\*/g,''),cards});
    }catch(err){
      const msg=err.message||'';
      if(msg.includes('quota')||msg.includes('QUOTA')||msg.includes('429')){
        setAiErr('Gemini quota exceeded. Wait a minute and retry, or upgrade at ai.dev.');
      }else{setAiErr(`Error: ${msg||'Failed to get response'}`);}
    }
    setAiLoad(false);
  };

  return(
    <div className="pt-24 md:pt-32 px-4 md:px-8 lg:px-14 min-h-screen bg-black max-w-[1800px] mx-auto pb-28 anim-up">
      <div className="flex justify-center mb-7">
        <div className="glass border border-white/10 p-1 rounded-full flex gap-1">
          <button onClick={()=>setMode('standard')} className={cn("px-5 py-2 rounded-full text-[13px] font-semibold transition-all outline-none flex items-center gap-2",mode==='standard'?"bg-white text-black shadow":"text-white/50 hover:text-white")}>
            <Search className="w-4 h-4"/>Search
          </button>
          <button onClick={()=>setMode('ai')} className={cn("px-5 py-2 rounded-full text-[13px] font-semibold transition-all outline-none flex items-center gap-2",mode==='ai'?"bg-[#1a5fa8] text-white shadow":"text-white/50 hover:text-white")}>
            <Sparkles className="w-4 h-4"/>Ask AI
          </button>
        </div>
      </div>
      {mode==='standard'&&(<>
        <div className="sticky top-[64px] bg-black/90 backdrop-blur-2xl pt-3 pb-4 z-40 mb-6">
          <div className="relative mb-3 max-w-3xl mx-auto">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30"/>
            <input type="text" placeholder="Search movies, series…" value={q} onChange={e=>setQ(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/[0.08] text-white text-base py-4 pl-14 pr-12 rounded-2xl outline-none placeholder:text-white/25 focus:bg-white/[0.09] focus:border-white/20 transition-all" autoFocus/>
            {q&&<button onClick={()=>setQ('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white outline-none p-1"><X className="w-4 h-4"/></button>}
          </div>
          <div className="flex items-center justify-center gap-2 max-w-3xl mx-auto">
            {[[fSort,setFSort,[['popularity.desc','Popular'],['vote_average.desc','Top Rated'],['primary_release_date.desc','Newest']]],[fType,setFType,[['all','All'],['movie','Movies'],['tv','Series']]]].map(([val,setter,opts],i)=>(
              <select key={i} value={val} onChange={e=>setter(e.target.value)} className="custom-select glass border border-white/10 text-white/70 rounded-full px-5 py-2 outline-none cursor-pointer text-[13px] font-semibold">
                {opts.map(([v,l])=><option key={v} value={v} className="bg-black">{l}</option>)}
              </select>
            ))}
          </div>
        </div>
        {results.length>0?(<>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 md:gap-5 pb-8">
            {results.map(i=><MediaCard key={i.id} media={i} onClick={onMediaClick} size="grid"/>)}
          </div>
          {hasMore&&<div ref={lastRef} className="py-10 flex justify-center"><div className="w-7 h-7 border-2 border-[#1a5fa8]/40 border-t-[#1a5fa8] rounded-full animate-spin"/></div>}
          {!hasMore&&<div className="py-8 text-center text-white/25 text-sm">End of results</div>}
        </>):isLoading?(<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">{[...Array(12)].map((_,i)=><div key={i} className="aspect-[2/3] skeleton rounded-xl"/>)}</div>):(
          <div className="text-center py-28 text-white/25"><Search className="w-12 h-12 mx-auto mb-4 opacity-20"/><p className="text-base">No results yet</p></div>
        )}
      </>)}
      {mode==='ai'&&(
        <div className="max-w-3xl mx-auto pb-28">
          {!geminiApiKey&&(
            <div className="mb-8 p-5 bg-[#1a5fa8]/10 border border-[#1a5fa8]/25 rounded-2xl text-center">
              <Sparkles className="w-7 h-7 text-[#1a5fa8] mx-auto mb-2"/>
              <p className="text-white/75 font-semibold mb-1 text-sm">Gemini API key required</p>
              <p className="text-white/40 text-xs">Add your free key in Settings → API Keys</p>
            </div>
          )}
          <form onSubmit={handleAi} className="relative mb-10">
            <input type="text" placeholder="e.g. Mind-bending sci-fi like Interstellar…"
              className="w-full glass border border-white/10 text-white text-base py-5 pl-7 pr-16 rounded-2xl outline-none placeholder:text-white/25 focus:border-white/20 transition-all shadow-xl"
              value={aiP} onChange={e=>setAiP(e.target.value)} disabled={aiLoad} autoFocus/>
            <button type="submit" disabled={aiLoad||!aiP.trim()||!geminiApiKey}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-2xl bg-[#1a5fa8] hover:bg-[#133250] transition-all disabled:opacity-40 text-white outline-none">
              {aiLoad?<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Send className="w-5 h-5"/>}
            </button>
          </form>
          {aiErr&&<div className="text-red-400/80 text-sm mb-8 p-4 bg-red-500/8 rounded-2xl border border-red-500/15">{aiErr}</div>}
          {aiResp&&(
            <div className="glass border border-white/10 rounded-2xl p-6 md:p-8 anim-up shadow-2xl">
              <p className="text-white/80 text-base leading-relaxed mb-8">{aiResp.text}</p>
              {aiResp.cards?.length>0&&(
                <div className="space-y-3 border-t border-white/8 pt-6">
                  {aiResp.cards.map(item=>(
                    <div key={item.key} onClick={()=>onMediaClick(item.media)}
                      className="flex gap-4 p-4 glass border border-white/8 hover:border-white/20 rounded-2xl transition-all cursor-pointer group">
                      <img src={`${IMG}w200${item.media.poster_path}`} className="w-20 rounded-xl shadow-lg object-cover aspect-[2/3] flex-shrink-0" alt="" onError={e=>{e.target.src='https://via.placeholder.com/200x300';}}/>
                      <div className="flex-1">
                        <span className="inline-block bg-[#1a5fa8]/20 text-[#4a8fd4] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md mb-2">{item.type==='tv'?'Series':'Movie'}</span>
                        <h4 className="text-white font-bold text-base mb-1.5 group-hover:text-white/90">{item.media.title||item.media.name}</h4>
                        <p className="text-white/45 text-sm line-clamp-2">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ─── PERSON MODAL ─────────────────────────────────────────────────────────────
const PersonModal = ({personId,apiKey,onClose,onMediaClick})=>{
  const[det,setDet]=useState(null),[cred,setCred]=useState([]);
  useEffect(()=>{lockScroll();return()=>unlockScroll();},[]);
  useEffect(()=>{
    if(!personId||!apiKey)return;let ok=true;
    (async()=>{
      try{
        const[d,c]=await Promise.all([
          fetchWithCache(`${BASE_URL}/person/${personId}?api_key=${apiKey}`),
          fetchWithCache(`${BASE_URL}/person/${personId}/combined_credits?api_key=${apiKey}`),
        ]);
        if(!ok)return;setDet(d);
        setCred(Array.from(new Map((c.cast?.filter(x=>x.poster_path).sort((a,b)=>(b.popularity||0)-(a.popularity||0))||[]).map(i=>[i.id,i])).values()));
      }catch(e){console.error(e);}
    })();
    return()=>{ok=false;};
  },[personId,apiKey]);

  if(!det)return<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-2xl"><div className="w-8 h-8 border-2 border-[#1a5fa8]/40 border-t-[#1a5fa8] rounded-full animate-spin"/></div>;

  return(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-10 anim-up gpu">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-3xl" onClick={onClose}/>
      <div className="relative bg-[#0c0c0c] border border-white/[0.08] w-full h-full md:h-auto md:max-w-5xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:max-h-[88vh] anim-scale">
        <button onClick={onClose} className="absolute top-5 right-5 md:top-7 md:right-7 p-3 glass rounded-full text-white z-50 hover:bg-white hover:text-black transition-all shadow-xl outline-none"><X className="w-5 h-5"/></button>
        <div className="p-6 pt-16 md:p-12 flex flex-col md:flex-row gap-8 md:gap-14 overflow-y-auto">
          <div className="shrink-0 flex flex-col items-center md:items-start w-full md:w-64">
            <div className="w-36 h-36 md:w-56 md:h-56 rounded-2xl overflow-hidden border border-white/10 shadow-2xl mb-5 bg-white/5">
              {det.profile_path?<img src={`${IMG}w500${det.profile_path}`} className="w-full h-full object-cover" alt="" decoding="async"/>:<div className="w-full h-full flex items-center justify-center"><User className="w-16 h-16 text-white/20"/></div>}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white text-center md:text-left">{det.name}</h2>
            {det.known_for_department&&<p className="text-white/40 text-sm mt-1">{det.known_for_department}</p>}
            {det.birthday&&<p className="text-white/30 text-xs mt-1">Born {formatDate(det.birthday)}</p>}
          </div>
          <div className="flex-1 space-y-8">
            {det.biography&&<div><h3 className="text-lg font-bold text-white mb-3">Biography</h3><p className="text-white/55 text-sm leading-relaxed line-clamp-5 hover:line-clamp-none cursor-pointer">{det.biography}</p></div>}
            <div>
              <h3 className="text-lg font-bold text-white mb-5">Known For</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {cred.slice(0,15).map(m=><MediaCard key={m.id} media={m} onClick={onMediaClick} size="grid"/>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────
const Modal = ({media,onClose,onPlay,isOpen,toggleWatchlist,isInWatchlist,apiKey,omdbApiKey,onCastClick,onMediaClick})=>{
  const[det,setDet]=useState(null),[omdb,setOmdb]=useState(null),[trailer,setTrailer]=useState(null),[season,setSeason]=useState(1);
  const[eps,setEps]=useState([]),[similar,setSimilar]=useState([]),[loading,setLoading]=useState(true);
  const[showTr,setShowTr]=useState(false),[spoilers,setSpoilers]=useState({}),[tab,setTab]=useState('overview'),[epsLoad,setEpsLoad]=useState(true);

  useEffect(()=>{if(isOpen)lockScroll();else unlockScroll();return()=>unlockScroll();},[isOpen]);
  useEffect(()=>{
    if(!isOpen||!media||!apiKey||media.isLive)return;
    setLoading(true);setDet(null);setOmdb(null);setTrailer(null);setEps([]);setSpoilers({});setShowTr(false);setTab('overview');
    const saved=JSON.parse(localStorage.getItem('cloud_history')||'[]').find(i=>i.id===media.id);
    setSeason(saved?.config?.season||1);
    let ok=true;
    (async()=>{
      try{
        const t=media.media_type==='tv'||(!media.release_date&&media.name)?'tv':'movie';
        const d=await fetchWithCache(`${BASE_URL}/${t}/${media.id}?api_key=${apiKey}&append_to_response=credits,similar,videos,external_ids`);
        if(!ok)return;setDet(d);
        const vt=d.videos?.results?.find(v=>v.type==='Trailer'&&v.site==='YouTube'&&v.official)||d.videos?.results?.find(v=>v.type==='Trailer'&&v.site==='YouTube');
        if(vt&&ok)setTrailer(vt.key);
        const imdb=d.imdb_id||d.external_ids?.imdb_id;
        if(omdbApiKey&&imdb){const o=await fetchWithCache(`https://www.omdbapi.com/?i=${imdb}&apikey=${omdbApiKey}`);if(ok&&o&&!o.Error)setOmdb(o);}
        setSimilar(Array.from(new Map((d.similar?.results?.filter(i=>i.poster_path)||[]).map(i=>[i.id,i])).values()).slice(0,12));
      }catch(e){console.error(e);}
      if(ok)setLoading(false);
    })();
    return()=>{ok=false;};
  },[isOpen,media,apiKey,omdbApiKey]);

  useEffect(()=>{
    const isTvM=media?.media_type==='tv'||(!media?.release_date&&media?.name);
    if(!isTvM||media?.isLive||!apiKey||!season||!det||tab!=='episodes')return;
    let ok=true;setEpsLoad(true);
    (async()=>{
      try{const d=await fetchWithCache(`${BASE_URL}/tv/${media.id}/season/${season}?api_key=${apiKey}`);if(ok)setEps(d.episodes||[]);}
      catch{if(ok)setEps([]);}
      finally{if(ok)setEpsLoad(false);}
    })();
    return()=>{ok=false;};
  },[season,media,apiKey,det,tab]);

  if(!isOpen||!media||media.isLive)return null;
  const isTv=media.media_type==='tv'||(!media.release_date&&media.name);
  const bg=`${IMG}w1280${media.backdrop_path||media.poster_path}`;
  const cast=Array.from(new Map(det?.credits?.cast?.map(p=>[p.id,p])||[]).values()).slice(0,12);
  const hasImdb=omdb?.imdbRating&&omdb.imdbRating!=='N/A';
  const rtRating=omdb?.Ratings?.find(r=>r.Source==='Rotten Tomatoes');

  return(
    <div className="fixed inset-0 z-[100] bg-black overflow-hidden font-sans gpu" style={{animation:'fadeUp .35s ease both'}}>
      {!showTr&&<button onClick={onClose} className="fixed top-5 right-5 md:top-8 md:right-8 p-3.5 glass-dark hover:bg-white hover:text-black border border-white/10 rounded-full text-white z-[180] shadow-2xl cursor-pointer outline-none transition-all"><X className="w-5 h-5"/></button>}
      {showTr&&trailer&&(
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-3xl flex items-center justify-center" style={{animation:'scaleIn .3s ease both'}}>
          <button onClick={()=>setShowTr(false)} className="absolute top-5 right-5 p-4 glass rounded-full text-white hover:bg-white hover:text-black z-[200] outline-none transition-all"><X className="w-5 h-5"/></button>
          <div className="w-full max-w-5xl px-4 md:px-10">
            <div style={{height:0,overflow:'hidden',paddingTop:'56.25%',position:'relative',width:'100%',borderRadius:'1rem'}}>
              <iframe style={{position:'absolute',top:0,left:0,width:'100%',height:'100%'}} src={`https://tube.rvere.com/embed?v=${trailer}&autoplay=1&rel=0`} className="border border-white/10 shadow-2xl" title="Trailer" allowFullScreen allow="autoplay;fullscreen"/>
            </div>
          </div>
        </div>
      )}
      <div className="absolute inset-0 z-0 gpu pointer-events-none">
        <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 scale-[1.02] blur-sm" decoding="async" onError={e=>{e.target.src='https://via.placeholder.com/1280x720';}}/>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/20"/>
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent hidden md:block"/>
      </div>
      <div className="relative z-10 w-full h-full overflow-y-auto">
        <div className="min-h-screen flex flex-col justify-start pt-20 md:pt-32 px-5 md:px-12 lg:px-16 pb-28">
          <div className="flex flex-col md:flex-row gap-8 md:gap-16 max-w-[1800px] mx-auto w-full">
            <div className="w-36 md:w-72 shrink-0 mx-auto md:mx-0 mt-2">
              <img src={`${IMG}w500${media.poster_path}`} className="w-full rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.8)] border border-white/8 object-cover aspect-[2/3]" alt="" decoding="async" onError={e=>{e.target.src='https://via.placeholder.com/500x750';}}/>
            </div>
            <div className="flex-1 space-y-6 text-center md:text-left md:mt-8">
              <div>
                <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                  {isTv&&<span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] border border-white/15 px-3 py-1 rounded-md">Series</span>}
                  {det?.status&&<span className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">{det.status}</span>}
                </div>
                <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold text-white tracking-tight leading-[1.05] drop-shadow-2xl">{media.title||media.name}</h1>
                {det?.tagline&&<p className="text-base md:text-xl text-white/40 font-medium italic mt-2">{det.tagline}</p>}
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs font-semibold">
                {hasImdb&&<div className="flex items-center gap-1.5 bg-[#f5c518] text-black px-3 py-1.5 rounded-lg shadow"><span className="font-black text-xs">IMDb</span><span className="font-bold">{omdb.imdbRating}</span></div>}
                {!hasImdb&&<div className="flex items-center gap-1.5 glass border border-white/10 px-3 py-1.5 rounded-lg text-white"><span className="font-bold text-xs">TMDB</span><span className="font-bold" style={ratingColor(media.vote_average)}>{media.vote_average?.toFixed(1)}</span></div>}
                {rtRating&&<div className="flex items-center gap-1.5 bg-[#fa320a]/15 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg"><span className="font-bold text-xs">RT</span><span>{rtRating.Value}</span></div>}
                <span className="text-white/40">{det?.release_date?.split('-')[0]||det?.first_air_date?.split('-')[0]}</span>
                <span className="text-white/20">·</span>
                <span className="text-white/40">{det?.runtime?`${Math.floor(det.runtime/60)}h ${det.runtime%60}m`:det?.number_of_seasons?`${det.number_of_seasons} Season${det.number_of_seasons>1?'s':''}`:''}</span>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <button onClick={()=>onPlay(media,isTv?{season,episode:1}:null)} className="flex items-center gap-2.5 bg-white text-black px-8 py-3.5 rounded-full font-bold text-[15px] hover:bg-white/92 transition-all hover:scale-[1.02] shadow-lg outline-none"><Play className="w-5 h-5 fill-black"/>Play</button>
                {trailer&&<button onClick={()=>setShowTr(true)} className="flex items-center gap-2 glass border border-white/12 hover:bg-white/12 text-white px-6 py-3.5 rounded-full font-semibold text-[15px] transition-all outline-none hover:scale-[1.02]"><Film className="w-5 h-5"/>Trailer</button>}
                <button onClick={()=>toggleWatchlist(media)} className={cn("flex items-center gap-2 glass border text-white px-6 py-3.5 rounded-full font-semibold text-[15px] transition-all outline-none hover:scale-[1.02]",isInWatchlist?"bg-white/15 border-white/30":"border-white/12 hover:bg-white/12")}>
                  <Bookmark className="w-5 h-5" fill={isInWatchlist?"currentColor":"none"}/>{isInWatchlist?'Saved':'Save'}
                </button>
              </div>
              <p className="text-white/55 text-sm md:text-base leading-relaxed max-w-2xl mx-auto md:mx-0">{media.overview}</p>
            </div>
          </div>
          <div className="max-w-[1800px] mx-auto w-full mt-14">
            <div className="flex items-center gap-8 border-b border-white/8 pb-3 mb-8 overflow-x-auto fade-r">
              {['overview',isTv?'episodes':null,'similar'].filter(Boolean).map(t=>(
                <button key={t} onClick={()=>setTab(t)} className={cn("text-base font-bold capitalize transition-all relative pb-2 shrink-0 outline-none",tab===t?"text-white":"text-white/40 hover:text-white/70")}>
                  {t}{tab===t&&<div className="absolute -bottom-[3px] left-0 w-full h-0.5 bg-white rounded-full"/>}
                </button>
              ))}
            </div>
            {tab==='overview'&&(
              <div className="grid md:grid-cols-[2fr_1fr] gap-10 lg:gap-20" style={{animation:'fadeUp .4s ease both'}}>
                <div>
                  <h3 className="text-white font-bold text-xl mb-4">Cast</h3>
                  <div className="flex flex-wrap gap-3">
                    {cast.map(p=>(
                      <button key={p.id} onClick={()=>onCastClick(p.id)}
                        className="flex items-center gap-3 glass hover:bg-white/10 pr-5 rounded-full border border-white/5 hover:border-white/15 transition-all cursor-pointer outline-none group">
                        {p.profile_path?<img src={`${IMG}w200${p.profile_path}`} className="w-11 h-11 rounded-full object-cover" alt="" decoding="async"/>:<div className="w-11 h-11 rounded-full bg-white/8 flex items-center justify-center"><User className="w-5 h-5 text-white/30"/></div>}
                        <div className="flex flex-col py-2">
                          <span className="text-sm font-semibold text-white/80 group-hover:text-white text-left">{p.name}</span>
                          <span className="text-xs text-white/35 text-left line-clamp-1">{p.character?.split('/')[0]}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="glass border border-white/8 p-6 rounded-2xl h-fit">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-5">Details</p>
                  <div className="space-y-4 text-sm">
                    {[['Status',det?.status],['Language',(det?.original_language||'').toUpperCase()],['Budget',det?.budget?`$${(det.budget/1e6).toFixed(1)}M`:'—'],['Revenue',det?.revenue?`$${(det.revenue/1e6).toFixed(1)}M`:'—']].filter(([,v])=>v&&v!=='—').map(([l,v])=>(
                      <div key={l} className="flex justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0"><span className="text-white/40">{l}</span><span className="text-white/80 font-medium">{v}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {tab==='episodes'&&isTv&&(
              <div style={{animation:'fadeUp .4s ease both'}} className="space-y-6">
                <div className="flex gap-2 overflow-x-auto pb-2 fade-r">
                  {det?.seasons?.filter(s=>s.season_number>0&&s.episode_count>0).map(s=>(
                    <button key={s.id} onClick={()=>setSeason(s.season_number)}
                      className={cn("px-5 py-2.5 text-sm rounded-full transition-all whitespace-nowrap font-semibold border shrink-0 outline-none",
                        season===s.season_number?"bg-white text-black border-white":"glass border-white/10 text-white/55 hover:text-white hover:border-white/25")}>
                      Season {s.season_number}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {epsLoad?<div className="col-span-full py-14 text-center text-white/30 text-sm">Loading episodes…</div>
                  :eps.map(ep=>{
                    const rev=spoilers[ep.id],di=parseEpDate(ep.air_date);
                    return(
                      <div key={ep.id} className="group flex flex-col gap-3 p-4 glass border border-white/8 hover:border-white/18 rounded-2xl transition-all">
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/40">
                          <img src={ep.still_path?`${IMG}w500${ep.still_path}`:bg} className="w-full h-full object-cover opacity-75 group-hover:opacity-95 transition-opacity" alt=""/>
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                            <button onClick={()=>onPlay(media,{season,episode:ep.episode_number})} className="bg-white text-black p-3.5 rounded-full hover:scale-110 transition-transform shadow-2xl outline-none"><Play className="w-5 h-5 fill-current"/></button>
                          </div>
                          {isTouchDev()&&<button onClick={()=>onPlay(media,{season,episode:ep.episode_number})} className="absolute bottom-2 right-2 bg-white/15 backdrop-blur-xl text-white p-2.5 rounded-full shadow-lg z-10 outline-none"><Play className="w-4 h-4 fill-current"/></button>}
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-[#1a5fa8] flex items-center gap-1.5">EP {ep.episode_number}{di.isNew&&<span className="bg-[#1a5fa8] text-white px-1.5 py-px rounded text-[9px] uppercase">New</span>}</span>
                            {ep.runtime&&<span className="text-[11px] text-white/30 font-mono">{ep.runtime}m</span>}
                          </div>
                          <h4 className="text-white font-bold text-sm mb-1.5 line-clamp-2">{String(ep.name||`Episode ${ep.episode_number}`)}</h4>
                          <p className="text-[11px] text-white/35 mb-2">{di.text}</p>
                          {ep.overview&&<p className={cn("text-xs text-white/40 line-clamp-3 leading-relaxed",!rev&&"spoil")} onClick={()=>setSpoilers(p=>({...p,[ep.id]:true}))}>{ep.overview}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {tab==='similar'&&(
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5" style={{animation:'fadeUp .4s ease both'}}>
                {similar.map(i=><MediaCard key={i.id} media={i} onClick={m=>{setTab('overview');onMediaClick?.(m);}} size="grid"/>)}
                {!similar.length&&!loading&&<div className="col-span-full text-center py-14 text-white/30 text-sm">Nothing found</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SETTINGS VIEW ────────────────────────────────────────────────────────────
const SettingsView = ({settings,saveSettings,profiles,user,onSignOut,addProfile,updateProfile,deleteProfile}) => {
  const[section,setSection]=useState('playback');
  const[editingProfile,setEditingProfile]=useState(null);
  const[addingProfile,setAddingProfile]=useState(false);

  const set=useCallback((key,val)=>saveSettings(s=>({...s,[key]:typeof val==='function'?val(s[key]):val})),[saveSettings]);
  const setNested=(k,sk,v)=>set(k,prev=>({...(prev||{}),[sk]:v}));

  const s=settings;
  const vp={...DEFAULT_VIDPLUS,...(s.vidplusSettings||{})};
  const sk={...DEFAULT_SKIP,...(s.skipSettings||{})};
  const cc={...DEFAULT_CC,...(s.ccSettings||{})};

  const sections=[
    {id:'playback',label:'Playback',   icon:Play},
    {id:'display', label:'Display',    icon:Monitor},
    {id:'discover',label:'Discover',   icon:Sparkles},
    {id:'profiles',label:'Profiles',   icon:Users},
    {id:'api',     label:'API Keys',   icon:Server},
    {id:'account', label:'Account',    icon:User},
  ];

  const Toggle=({val,onToggle})=>(
    <button onClick={onToggle} className={cn("w-12 h-6 rounded-full transition-colors relative shrink-0 outline-none",val?"bg-[#1a5fa8]":"bg-white/15")}>
      <div className={cn("w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow",val?"translate-x-6":"translate-x-0.5")}/>
    </button>
  );
  const Row=({label,sub,children})=>(
    <div className="flex items-center justify-between py-5 border-b border-white/[0.06] last:border-0 gap-4">
      <div><p className="text-white/85 font-semibold text-[15px]">{label}</p>{sub&&<p className="text-white/35 text-xs mt-0.5">{sub}</p>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  return(
    <div className="pt-24 md:pt-32 px-4 md:px-8 lg:px-14 min-h-screen bg-black max-w-6xl mx-auto pb-28">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background:`linear-gradient(135deg, ${BRAND}66, ${BRAND}22)`}}>
          <Settings className="w-6 h-6 text-white/70"/>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Settings</h1>
      </div>
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Sidebar nav */}
        <div className="md:w-52 shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 fade-r md:fade-none">
            {sections.map(({id,label,icon:Icon})=>(
              <button key={id} onClick={()=>setSection(id)}
                className={cn("flex items-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-[13px] transition-all whitespace-nowrap outline-none text-left shrink-0 md:w-full border",
                  section===id?"bg-white/10 text-white border-white/10":"text-white/40 hover:text-white hover:bg-white/5 border-transparent")}>
                <Icon className="w-4 h-4 shrink-0"/>{label}
              </button>
            ))}
          </div>
        </div>
        {/* Content panel */}
        <div className="flex-1 min-w-0">
          <div className="glass border border-white/8 rounded-2xl divide-y divide-white/[0.06] overflow-hidden" key={section}>

            {section==='playback'&&(<>
              <div className="p-6 pb-2">
                <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">Default Source</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.entries(SOURCES).map(([k,v])=>(
                    <button key={k} onClick={()=>set('sourceKey',k)}
                      className={cn("px-4 py-3 rounded-xl border transition-all text-left flex items-center justify-between outline-none",
                        s.sourceKey===k?"bg-white/10 border-white/25 text-white":"border-white/8 text-white/45 hover:border-white/20 hover:text-white/70")}>
                      <span className="font-bold text-sm">{v.name}</span>
                      <span className={cn("text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md",s.sourceKey===k?"bg-[#1a5fa8] text-white":"bg-white/5 text-white/25")}>{v.type}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-6">
                <Row label="VidPlus Icon Style" sub="Player button style">
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {['vid','netflix','vidstack','lucide','tabler'].map(ic=>(
                      <button key={ic} onClick={()=>setNested('vidplusSettings','icons',ic)}
                        className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold capitalize border transition-all outline-none",vp.icons===ic?"bg-white text-black border-white":"glass border-white/10 text-white/45 hover:text-white")}>{ic}</button>
                    ))}
                  </div>
                </Row>
                <Row label="Auto-next episode"><Toggle val={vp.autoNext!==false} onToggle={()=>setNested('vidplusSettings','autoNext',!(vp.autoNext!==false))}/></Row>
                <Row label="Episode list"><Toggle val={vp.episodeList!==false} onToggle={()=>setNested('vidplusSettings','episodeList',!(vp.episodeList!==false))}/></Row>
                <Row label="Server selector"><Toggle val={vp.serverIcon!==false} onToggle={()=>setNested('vidplusSettings','serverIcon',!(vp.serverIcon!==false))}/></Row>
              </div>
              <div className="px-6 pb-2">
                <div className="flex items-center justify-between pt-5 mb-4">
                  <div><p className="text-white/85 font-semibold text-[15px]">Skip Timestamps</p><p className="text-white/35 text-xs mt-0.5">Powered by TheIntroDB</p></div>
                  <Toggle val={sk.enabled} onToggle={()=>set('skipSettings',p=>({...p,enabled:!p.enabled}))}/>
                </div>
                {sk.enabled&&(
                  <div className="space-y-4 pb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[['Intro','showIntro'],['Recap','showRecap'],['Credits','showCredits'],['Preview','showPreview']].map(([l,k])=>(
                        <button key={k} onClick={()=>set('skipSettings',p=>({...p,[k]:!p[k]}))}
                          className={cn("py-2.5 rounded-xl text-sm font-semibold border transition-all outline-none",sk[k]?"bg-white text-black border-white shadow":"glass border-white/10 text-white/45 hover:text-white")}>{l}</button>
                      ))}
                    </div>
                    <Row label="Auto-skip"><Toggle val={sk.autoSkip} onToggle={()=>set('skipSettings',p=>({...p,autoSkip:!p.autoSkip}))}/></Row>
                    {!sk.autoSkip&&<Row label={`Button visible: ${sk.buttonDuration||6}s`}><input type="range" min="3" max="15" value={sk.buttonDuration||6} onChange={e=>set('skipSettings',p=>({...p,buttonDuration:parseInt(e.target.value)}))} className="w-24 cursor-pointer"/></Row>}
                    <Row label={`Min confidence: ${Math.round((sk.minConfidence??0.3)*100)}%`} sub="Higher = fewer but more accurate skips"><input type="range" min="0" max="0.9" step="0.05" value={sk.minConfidence??0.3} onChange={e=>set('skipSettings',p=>({...p,minConfidence:parseFloat(e.target.value)}))} className="w-24 cursor-pointer"/></Row>
                  </div>
                )}
              </div>
            </>)}

            {section==='display'&&(
              <div className="px-6">
                <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest pt-6 mb-3">Subtitles & CC</p>
                <div className="w-full aspect-[16/6] bg-black/40 rounded-2xl mb-5 relative overflow-hidden flex flex-col justify-end pb-4 items-center border border-white/8">
                  <img src="https://image.tmdb.org/t/p/w1280/8Y43POKjjKDGI9MH89NW0NAzzp8.jpg" className="absolute inset-0 w-full h-full object-cover opacity-40" alt=""/>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"/>
                  <div className="relative z-10 text-center" style={{fontFamily:cc.font,fontSize:cc.size,color:cc.color}}>
                    {['Subtitle preview line one.','Second line of subtitles here.'].map((l,i)=>(
                      <div key={i} className="inline-block px-3 py-1 rounded-xl mx-1 mb-1 block text-center" style={{backgroundColor:cc.bg,textShadow:getTextShadow(cc.edgeStyle),fontWeight:600,lineHeight:1.5}}>{l}</div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-6">
                  {[
                    [cc.font,v=>setNested('ccSettings','font',v),[['system-ui,-apple-system,sans-serif','System'],['Georgia,serif','Serif'],['monospace','Mono'],["'Comic Sans MS',sans-serif",'Casual'],['Impact,fantasy','Display']]],
                    [cc.size,v=>setNested('ccSettings','size',v),[['0.85rem','Small'],['1.125rem','Medium'],['1.5rem','Large'],['2rem','X-Large']]],
                    [cc.color,v=>setNested('ccSettings','color',v),[['#ffffff','White'],['#fcd34d','Yellow'],['#4ade80','Green'],['#22d3ee','Cyan'],['#f87171','Red']]],
                    [cc.bg,v=>setNested('ccSettings','bg',v),[['rgba(0,0,0,0.8)','Dark'],['rgba(0,0,0,1)','Black'],['rgba(255,255,255,0.15)','Light'],['transparent','None']]],
                    [cc.edgeStyle,v=>setNested('ccSettings','edgeStyle',v),[['dropshadow','Shadow'],['raised','Raised'],['outline','Outline'],['none','None']]],
                    [cc.animation,v=>setNested('ccSettings','animation',v),[['fade','Fade'],['slideUp','Slide'],['pop','Pop'],['none','None']]],
                  ].map(([val,setter,opts],i)=>(
                    <select key={i} value={val} onChange={e=>setter(e.target.value)} className="custom-select bg-black/30 text-white/70 border border-white/10 rounded-xl px-4 py-3 outline-none cursor-pointer text-[13px] font-semibold">
                      {opts.map(([v,l])=><option key={v} value={v} className="bg-black text-white">{l}</option>)}
                    </select>
                  ))}
                </div>
              </div>
            )}

            {section==='discover'&&(
              <div className="px-6 pb-6">
                <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest pt-6 mb-2">Genre Preferences</p>
                <p className="text-white/35 text-xs mb-5">Tap to cycle: Default → Boosted → Hidden</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_GENRES.map(g=>{
                    const boosted=s.algoPrefs.boosted.includes(g.id);
                    const excluded=s.algoPrefs.excluded.includes(g.id);
                    return(
                      <button key={g.id} onClick={()=>set('algoPrefs',p=>{
                        if(p.boosted.includes(g.id))return{boosted:p.boosted.filter(x=>x!==g.id),excluded:[...p.excluded,g.id]};
                        if(p.excluded.includes(g.id))return{boosted:p.boosted,excluded:p.excluded.filter(x=>x!==g.id)};
                        return{boosted:[...p.boosted,g.id],excluded:p.excluded};
                      })}
                        className={cn("px-4 py-2 rounded-full text-[12px] font-semibold transition-all border outline-none",
                          excluded?"bg-red-500/10 text-red-400 border-red-500/25":boosted?"bg-white text-black border-white":"glass text-white/45 border-white/8 hover:text-white hover:border-white/18")}>
                        {g.name}{boosted?' ✦':''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {section==='profiles'&&(
              <div className="p-6">
                <Row label="Show profile selector on startup" sub="'Who's watching' screen at launch">
                  <Toggle val={s.requireProfile} onToggle={()=>set('requireProfile',!s.requireProfile)}/>
                </Row>
                <div className="mt-6 space-y-3">
                  {profiles.map(p=>(
                    <div key={p.id} className="flex items-center gap-4 p-4 glass border border-white/8 rounded-2xl">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{background:`linear-gradient(135deg, ${p.color}88, ${p.color}33)`}}>{p.emoji}</div>
                      <div className="flex-1"><p className="text-white font-semibold">{p.name}</p><p className="text-white/35 text-xs">Profile</p></div>
                      <button onClick={()=>setEditingProfile(p)} className="p-2.5 glass border border-white/10 rounded-xl text-white/50 hover:text-white transition-all outline-none"><Edit3 className="w-4 h-4"/></button>
                    </div>
                  ))}
                  {profiles.length<3&&(
                    <button onClick={()=>setAddingProfile(true)} className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl border border-dashed border-white/15 text-white/35 hover:text-white hover:border-white/30 transition-all text-sm font-semibold outline-none">
                      <Plus className="w-4 h-4"/>Add Profile
                    </button>
                  )}
                </div>
                {editingProfile&&(
                  <ProfileEditModal profile={editingProfile} isNew={false}
                    onSave={changes=>{updateProfile(editingProfile.id,changes);setEditingProfile(null);}}
                    onDelete={()=>{deleteProfile(editingProfile.id);setEditingProfile(null);}}
                    onClose={()=>setEditingProfile(null)}/>
                )}
                {addingProfile&&(
                  <ProfileEditModal profile={null} isNew
                    onSave={data=>{addProfile({...DEFAULT_PROFILE(profiles.length),...data});setAddingProfile(false);}}
                    onClose={()=>setAddingProfile(false)}/>
                )}
              </div>
            )}

            {section==='api'&&(
              <div className="px-6 pb-6">
                {[
                  {label:'TMDB API Key',sub:'Required for all metadata',key:'apiKey',type:'text',ph:'API key…',link:{text:'themoviedb.org',url:'https://www.themoviedb.org/settings/api'}},
                  {label:'OMDb API Key',sub:'IMDb & Rotten Tomatoes ratings',key:'omdbApiKey',type:'text',ph:'e.g. 8a7b6c5d',link:{text:'omdbapi.com',url:'https://www.omdbapi.com/apikey.aspx'}},
                  {label:'Gemini API Key',sub:'For AI search — uses gemini-1.5-flash-8b',key:'geminiApiKey',type:'password',ph:'AIza…',link:{text:'Google AI Studio',url:'https://aistudio.google.com/app/apikey'}},
                ].map(({label,sub,key,type,ph,link})=>(
                  <div key={key} className="pt-5 pb-4 border-b border-white/[0.06] last:border-0">
                    <div className="flex items-start justify-between mb-3">
                      <div><p className="text-white/85 font-semibold text-[15px]">{label}</p><p className="text-white/30 text-xs mt-0.5">{sub} · <a href={link.url} target="_blank" rel="noreferrer" className="text-white/50 hover:text-white underline">{link.text}</a></p></div>
                    </div>
                    <input type={type} value={s[key]||''} onChange={e=>set(key,e.target.value)} placeholder={ph}
                      className="w-full bg-black/30 border border-white/8 rounded-xl px-4 py-3 font-mono text-sm text-white/80 focus:border-white/20 focus:bg-black/50 outline-none transition-all" spellCheck="false"/>
                  </div>
                ))}
              </div>
            )}

            {section==='account'&&(
              <div className="px-6 pb-6">
                <div className="pt-6 flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/8 flex items-center justify-center text-2xl font-bold text-white/60 border border-white/8">
                    {user?.email?.charAt(0)?.toUpperCase()||'?'}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{user?.email}</p>
                    <p className="text-white/30 text-xs mt-0.5">Signed in</p>
                  </div>
                </div>
                <button onClick={onSignOut}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/18 font-semibold transition-all outline-none">
                  <LogOut className="w-4 h-4"/>Sign out
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const[mounted,setMounted]=useState(false);
  const[user,setUser]=useState(undefined);
  const[activeProfileId,setActiveProfileId]=useLocalStorage('onyx_active_profile','');
  const[profileChosen,setProfileChosen]=useState(false);
  const[activeTab,setActiveTabRaw]=useState('home');
  const[selGenre,setSelGenre]=useState('All');
  const[focusMode,setFocusMode]=useState(false);
  const[selMedia,setSelMedia]=useState(null);
  const[selPerson,setSelPerson]=useState(null);
  const[playMedia,setPlayMedia]=useState(null);
  const[playCfg,setPlayCfg]=useState(null);
  const[expHistory,setExpHistory]=useState({});

  const{profiles,addProfile,updateProfile,deleteProfile}=useProfiles(user?.uid||null);

  const resolvedProfileId=useMemo(()=>{
    if(activeProfileId==='guest')return 'guest';
    if(profiles.find(p=>p.id===activeProfileId))return activeProfileId;
    return profiles[0]?.id||'guest';
  },[activeProfileId,profiles]);

  const{settings,saveSettings,history,saveHistory,watchlist,saveWatchlist,loaded}=useProfileData(user?.uid||null,resolvedProfileId);

  const apiKey=settings.apiKey;
  const omdbApiKey=settings.omdbApiKey;
  const sourceKey=settings.sourceKey;
  const geminiApiKey=settings.geminiApiKey;
  const ccSettings={...DEFAULT_CC,...(settings.ccSettings||{})};
  const vidplusSettings={...DEFAULT_VIDPLUS,...(settings.vidplusSettings||{})};
  const skipSettings={...DEFAULT_SKIP,...(settings.skipSettings||{})};
  const algoPrefs=settings.algoPrefs||{excluded:[],boosted:[]};

  const histRef=useRef(history),wlRef=useRef(watchlist);
  useEffect(()=>{histRef.current=history;},[history]);
  useEffect(()=>{wlRef.current=watchlist;},[watchlist]);

  useEffect(()=>{const unsub=onAuthStateChanged(auth,u=>{setUser(u||null);setMounted(true);});return unsub;},[]);
  useEffect(()=>{if(!settings.requireProfile)setProfileChosen(true);},[settings.requireProfile]);
  useEffect(()=>{if(!user){setProfileChosen(false);}else if(!settings.requireProfile){setProfileChosen(true);}},[user,settings.requireProfile]);

  const setActiveTab=useCallback(tab=>{setActiveTabRaw(tab);if(tab!=='live')setFocusMode(false);setSelGenre('All');},[]);

  const handlePlay=useCallback((media,config=null)=>{
    if(media.isLive){setPlayMedia(media);setPlayCfg(null);setSelMedia(null);return;}
    const ex=histRef.current.find(h=>h.id===media.id);
    const fc=config||ex?.config||{season:1,episode:1};
    setPlayMedia(media);setPlayCfg(fc);setSelMedia(null);
    const now=new Date().toISOString();
    saveHistory(p=>[{...media,watchedAt:now,config:fc,progress:ex?.progress||0},...p.filter(h=>h.id!==media.id)].slice(0,100));
  },[saveHistory]);

  // FIX: Sports stream - use streamed.pk watch page (most reliable) with source API fallback
  const handlePlaySport=useCallback(match=>new Promise(async resolve=>{
    if(!match){resolve();return;}
    let url='',isIfr=true;

    // Try individual sources first for potentially better quality
    if(match.sources?.length){
      for(const src of match.sources){
        try{
          const r=await fetch(`https://streamed.pk/api/stream/${src.source}/${src.id}`,{signal:AbortSignal.timeout(5000)});
          if(!r.ok)continue;
          const ss=await r.json();
          const streams=Array.isArray(ss)?ss:(typeof ss==='object'&&ss?Object.values(ss).flat():[]);
          const best=streams.find(s=>s.hd)||streams[0];
          if(best){
            const streamUrl=best.embedUrl||best.streamUrl||best.url||best.stream_url;
            if(streamUrl){url=streamUrl;isIfr=!streamUrl.includes('.m3u8');break;}
          }
        }catch{}
      }
    }

    // Fallback: streamed.pk watch page embed
    if(!url&&match.id){
      url=`https://streamed.pk/watch/${match.id}`;isIfr=true;
    }

    if(url){
      setPlayMedia({isLive:true,type:isIfr?'iframe':'m3u8',name:String(match.title||match.name||'Live Sport'),url});
    }
    resolve();
  }),[]);

  const toggleWatchlist=useCallback(media=>saveWatchlist(p=>p.find(m=>m.id===media.id)?p.filter(m=>m.id!==media.id):[media,...p]),[saveWatchlist]);
  const removeHistory=useCallback(id=>saveHistory(p=>p.filter(h=>h.id!==id)),[saveHistory]);

  if(!mounted||user===undefined)return<div className="min-h-screen bg-black flex items-center justify-center"><div className="w-10 h-10 border-2 border-white/15 border-t-white rounded-full animate-spin"/></div>;
  if(!user)return<><GlobalStyles/><LoginScreen/></>;
  if(!loaded)return<div className="min-h-screen bg-black flex items-center justify-center"><div className="w-10 h-10 border-2 border-[#1a5fa8]/40 border-t-[#1a5fa8] rounded-full animate-spin"/></div>;

  if(settings.requireProfile&&!profileChosen){
    return(
      <>
        <GlobalStyles/>
        <WhoWatching profiles={profiles} onSelect={pid=>{setActiveProfileId(pid);setProfileChosen(true);}} user={user}/>
      </>
    );
  }

  return(
    <ProfileCtx.Provider value={{profileId:resolvedProfileId,profiles}}>
      <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden selection:bg-[#1a5fa8]/60">
        <GlobalStyles/>
        <TopNavigation
          activeTab={activeTab} setActiveTab={setActiveTab}
          selectedGenre={selGenre} setSelectedGenre={setSelGenre}
          focusMode={focusMode}
          activeProfile={resolvedProfileId}
          profiles={profiles}
          onSwitchProfile={pid=>setActiveProfileId(pid)}
        />
        <main>
          {activeTab==='home'&&<HomeView apiKey={apiKey} history={history} watchlist={watchlist} algoPrefs={algoPrefs} onPlay={handlePlay} onMoreInfo={setSelMedia}/>}
          {activeTab==='live'&&<LiveTvView ccSettings={ccSettings} focusMode={focusMode} setFocusMode={setFocusMode}/>}
          {activeTab==='sports'&&<LiveSportsView onPlaySport={handlePlaySport}/>}
          {activeTab==='movies'&&(
            <div className="pb-28 bg-black min-h-screen">
              {selGenre==='All'?(<>
                <Hero onPlay={handlePlay} onMoreInfo={setSelMedia} apiKey={apiKey} type="movie"/>
                <div className="relative z-20 -mt-20 md:-mt-28">
                  <ContentRow title="Trending Movies" fetchUrl="/trending/movie/day" onMediaClick={setSelMedia} apiKey={apiKey} isLarge/>
                  <ContentRow title="In Theatres Now" fetchUrl="/movie/now_playing" onMediaClick={setSelMedia} apiKey={apiKey}/>
                  <ContentRow title="All-Time Greats" fetchUrl="/movie/top_rated" onMediaClick={setSelMedia} apiKey={apiKey}/>
                  {GENRES.movie.map(g=><ContentRow key={g.id} title={g.name} fetchUrl={`/discover/movie?with_genres=${g.id}&sort_by=popularity.desc`} onMediaClick={setSelMedia} apiKey={apiKey}/>)}
                </div>
              </>):<GenreGridView apiKey={apiKey} type="movie" genreId={selGenre} onMediaClick={setSelMedia}/>}
            </div>
          )}
          {activeTab==='tv'&&(
            <div className="pb-28 bg-black min-h-screen">
              {selGenre==='All'?(<>
                <Hero onPlay={handlePlay} onMoreInfo={setSelMedia} apiKey={apiKey} type="tv"/>
                <div className="relative z-20 -mt-20 md:-mt-28">
                  <ContentRow title="Trending Series" fetchUrl="/trending/tv/day" onMediaClick={setSelMedia} apiKey={apiKey} isLarge/>
                  <ContentRow title="On Air Now" fetchUrl="/tv/on_the_air" onMediaClick={setSelMedia} apiKey={apiKey}/>
                  <ContentRow title="Critically Acclaimed" fetchUrl="/tv/top_rated" onMediaClick={setSelMedia} apiKey={apiKey}/>
                  {GENRES.tv.map(g=><ContentRow key={g.id} title={g.name} fetchUrl={`/discover/tv?with_genres=${g.id}&sort_by=popularity.desc`} onMediaClick={setSelMedia} apiKey={apiKey}/>)}
                </div>
              </>):<GenreGridView apiKey={apiKey} type="tv" genreId={selGenre} onMediaClick={setSelMedia}/>}
            </div>
          )}
          {activeTab==='search'&&<SearchView apiKey={apiKey} geminiApiKey={geminiApiKey} history={history} onMediaClick={setSelMedia}/>}
          {activeTab==='watchlist'&&(
            <div className="px-4 md:px-8 lg:px-14 min-h-screen bg-black max-w-[1800px] mx-auto anim-up pt-24 md:pt-32">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background:`linear-gradient(135deg, ${BRAND}66, ${BRAND}22)`}}><Bookmark className="w-6 h-6 text-white/70"/></div>
                <h2 className="text-3xl md:text-4xl font-bold text-white">Your Library</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 md:gap-5 pb-28">
                {watchlist.map(i=><MediaCard key={i.id} media={i} onClick={setSelMedia} size="grid"/>)}
              </div>
              {!watchlist.length&&<div className="flex flex-col items-center justify-center py-28 text-white/20"><Bookmark className="w-16 h-16 mb-5 opacity-20"/><p className="text-lg font-medium">Library is empty</p><p className="text-sm mt-1 text-white/15">Save movies and series here</p></div>}
            </div>
          )}
          {activeTab==='history'&&(
            <div className="px-4 md:px-8 lg:px-14 min-h-screen bg-black max-w-[1800px] mx-auto anim-up pt-24 md:pt-32">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background:`linear-gradient(135deg, ${BRAND}66, ${BRAND}22)`}}><Clock className="w-6 h-6 text-white/70"/></div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white">History</h2>
                </div>
                {history.length>0&&<button onClick={()=>saveHistory([])} className="text-sm text-red-400/70 hover:text-red-400 flex items-center gap-1.5 px-4 py-2.5 rounded-xl hover:bg-red-500/8 font-semibold outline-none transition-all"><Trash2 className="w-4 h-4"/>Clear all</button>}
              </div>
              <div className="flex flex-col gap-3 pb-28">
                {history.map(item=>{
                  const isExp=expHistory[item.id];
                  const hasEps=item.watchedEpisodes?.length>0;
                  return(
                    <div key={item.id} className="glass border border-white/8 hover:border-white/15 rounded-2xl overflow-hidden transition-all group">
                      <div className="flex gap-4 md:gap-6 p-4 items-center">
                        <img src={`${IMG}w200${item.poster_path}`} className="w-14 md:w-20 rounded-xl shadow-lg object-cover aspect-[2/3] flex-shrink-0" alt="" onError={e=>{e.target.src='https://via.placeholder.com/200x300';}}/>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-base md:text-lg text-white truncate">{item.title||item.name}</h4>
                          <div className="flex items-center gap-2 flex-wrap mt-1.5 mb-2">
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-wider border border-white/12 px-2 py-0.5 rounded-md">{(item.media_type==='tv'||item.name)?'Series':'Movie'}</span>
                            {item.config&&<span className="text-[10px] font-bold text-black bg-white/80 px-2 py-0.5 rounded-md">S{item.config.season} E{item.config.episode}</span>}
                          </div>
                          <p className="text-xs text-white/30 flex items-center gap-1"><Clock className="w-3 h-3"/>{formatDT(item.watchedAt)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={()=>handlePlay(item,item.config)} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 shadow-lg outline-none opacity-0 group-hover:opacity-100 transition-all"><Play className="w-4 h-4 fill-current"/></button>
                          <button onClick={()=>removeHistory(item.id)} className="p-2.5 text-white/25 hover:text-white/70 hover:bg-white/8 rounded-full transition-all outline-none opacity-0 group-hover:opacity-100"><X className="w-4 h-4"/></button>
                        </div>
                      </div>
                      {hasEps&&(
                        <div className="border-t border-white/[0.06]">
                          <button onClick={()=>setExpHistory(p=>({...p,[item.id]:!p[item.id]}))} className="w-full py-2.5 text-[11px] font-semibold text-white/30 hover:text-white/60 flex items-center justify-center gap-1.5 outline-none transition-all">
                            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform",isExp&&"rotate-180")}/>{isExp?'Hide':'Show'} {item.watchedEpisodes.length} episode{item.watchedEpisodes.length>1?'s':''}
                          </button>
                          {isExp&&(
                            <div className="px-5 pb-4 flex flex-col gap-2">
                              {item.watchedEpisodes.map(ep=>(
                                <div key={`${ep.season}-${ep.episode}`} className="flex items-center justify-between py-2 border-t border-white/[0.05]">
                                  <div>
                                    <span className="text-sm font-semibold text-white/60">S{ep.season} E{ep.episode}</span>
                                    <span className="text-xs text-white/25 ml-3">{formatDT(ep.watchedAt)}</span>
                                  </div>
                                  <button onClick={()=>handlePlay(item,{season:ep.season,episode:ep.episode})} className="w-8 h-8 rounded-full bg-white/8 text-white flex items-center justify-center hover:bg-[#1a5fa8] outline-none transition-all"><Play className="w-3 h-3 fill-current ml-0.5"/></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!history.length&&<div className="flex flex-col items-center justify-center py-28 text-white/20"><Clock className="w-16 h-16 mb-5 opacity-20"/><p className="text-lg font-medium">No watch history</p></div>}
              </div>
            </div>
          )}
          {activeTab==='settings'&&(
            <SettingsView
              settings={settings} saveSettings={saveSettings}
              profiles={profiles} user={user}
              onSignOut={()=>firebaseSignOut(auth)}
              addProfile={addProfile} updateProfile={updateProfile} deleteProfile={deleteProfile}
            />
          )}
        </main>

        {/* Modals */}
        <Modal
          isOpen={!!selMedia} media={selMedia} onClose={()=>setSelMedia(null)}
          onPlay={handlePlay} toggleWatchlist={toggleWatchlist}
          isInWatchlist={selMedia?wlRef.current.some(m=>m.id===selMedia.id):false}
          apiKey={apiKey} omdbApiKey={omdbApiKey}
          onCastClick={setSelPerson} onMediaClick={setSelMedia}
        />
        {selPerson&&<PersonModal personId={selPerson} apiKey={apiKey} onClose={()=>setSelPerson(null)} onMediaClick={m=>{setSelPerson(null);setSelMedia(m);}}/>}
        {playMedia&&<PlayerOverlay media={playMedia} config={playCfg} onClose={()=>setPlayMedia(null)} sourceKey={sourceKey} vidplusSettings={vidplusSettings} skipSettings={skipSettings}/>}
      </div>
    </ProfileCtx.Provider>
  );
}
