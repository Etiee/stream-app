import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, Info, Search, X, ChevronRight, ChevronLeft, Clock, Bookmark,
  Settings, Monitor, Tv, Film, ArrowLeft, Trash2, LayoutGrid, Star, Shuffle,
  User, Layers, Filter, Dribbble, Users, Server, ChevronDown, Calendar,
  Sparkles, Send, Maximize, Minimize, VolumeX, Volume2,
  Subtitles, Sidebar, PictureInPicture, RefreshCw, Square, LogOut, Zap
} from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const DEFAULT_TMDB_API_KEY = "9517f4751d84886b184cb4a4849e9f91";
const BASE_URL        = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL  = "https://image.tmdb.org/t/p/";
const POSTER_SIZE     = "w500";
const BACKDROP_SIZE   = "w1280";
const STILL_SIZE      = "w500";

const DEFAULT_CC = {
  size:'1.125rem', bg:'rgba(0,0,0,0.75)', color:'#ffffff',
  font:'ui-sans-serif,system-ui,-apple-system,sans-serif',
  edgeStyle:'dropshadow', animation:'fade', offset:-5.0
};

const DEFAULT_VIDPLUS = {
  icons: 'lucide',
  autoNext: true,
  episodeList: true,
  serverIcon: true,
  subtitleFont: 'Inter',
  subtitleFontSize: 20,
  subtitleOpacity: 0.5,
};

const DEFAULT_SKIP = {
  enabled: true,
  showIntro: true,
  showRecap: true,
  showCredits: true,
  showPreview: false,
  autoSkip: false,
  buttonDuration: 6,
  minConfidence: 0.3,
};

const DEFAULT_SETTINGS = {
  apiKey: DEFAULT_TMDB_API_KEY,
  omdbApiKey: '93a6d7d6',
  sourceKey: 'vidplus',
  geminiApiKey: '',
  requireProfile: false,
  algoPrefs: {excluded:[],boosted:[]},
  ccSettings: DEFAULT_CC,
  vidplusSettings: DEFAULT_VIDPLUS,
  skipSettings: DEFAULT_SKIP,
};

const INTRODB_BASE = "https://api.theintrodb.org/v2";

const getTrailerUrl = (id) =>
  `https://tube.rvere.com/embed?v=${id}&autoplay=1&fs=1&modestbranding=1&color=white&rel=0&iv_load_policy=3`;

const getTextShadow = (s) => ({
  dropshadow:'0px 2px 6px rgba(0,0,0,0.9),0px 4px 12px rgba(0,0,0,0.6)',
  raised:'-1px -1px 0 rgba(255,255,255,0.2),1px 1px 0 rgba(0,0,0,0.8)',
  depressed:'1px 1px 0 rgba(255,255,255,0.3),-1px -1px 0 rgba(0,0,0,0.8)',
  outline:'-1.5px -1.5px 0 #000,1.5px -1.5px 0 #000,-1.5px 1.5px 0 #000,1.5px 1.5px 0 #000'
}[s] || 'none');

// FIX: VidPlus as primary source, others as fallbacks
const SOURCES = {
  vidplus:    { name:"VidPlus",    type:"Primary"  },
  autoembed:  { name:"AutoEmbed",  type:"Fast"     },
  vidlink:    { name:"VidLink",    type:"Backup 1" },
  vidsrc:     { name:"VidSrc",     type:"Backup 2" },
  embedsu:    { name:"Embed.su",   type:"Backup 3" },
  vidsrcicu:  { name:"VidSrc ICU", type:"Backup 4" },
};

const GENRES = {
  movie:[
    {id:28,name:"Action"},{id:12,name:"Adventure"},{id:16,name:"Animation"},
    {id:35,name:"Comedy",exclude:"16"},{id:80,name:"Crime"},{id:99,name:"Documentary"},
    {id:18,name:"Drama"},{id:10751,name:"Family"},{id:14,name:"Fantasy"},
    {id:27,name:"Horror"},{id:878,name:"Sci-Fi"},{id:53,name:"Thriller"}
  ],
  tv:[
    {id:"10759_act",realId:10759,name:"Action",keywords:"9715|83|207317"},
    {id:"10759_adv",realId:10759,name:"Adventure",keywords:"9717|2095"},
    {id:16,name:"Animation"},{id:35,name:"Comedy",exclude:"16"},{id:80,name:"Crime"},
    {id:99,name:"Documentary"},{id:18,name:"Drama"},
    {id:"10765_sci",realId:10765,name:"Sci-Fi",keywords:"9882|33643|4344"},
    {id:"10765_fan",realId:10765,name:"Fantasy",keywords:"1422|2095|13084"},
    {id:10768,name:"War & Politics"}
  ],
};

const ALL_UNIQUE_GENRES = [];
[...GENRES.movie,...GENRES.tv].forEach(g=>{
  if(!ALL_UNIQUE_GENRES.some(u=>u.name===g.name))
    ALL_UNIQUE_GENRES.push({id:g.realId||g.id,name:g.name});
});
ALL_UNIQUE_GENRES.sort((a,b)=>a.name.localeCompare(b.name));

const LIVE_CHANNELS = [
  {id:'l_cnn',  isLive:true,name:'CNN',       category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/b/b1/CNN.svg',url:'https://turnerlive.warnermediacdn.com/hls/live/586495/cnngo/cnn_slate/VIDEO_0_3564000.m3u8',type:'m3u8'},
  {id:'l_cbs',  isLive:true,name:'CBS News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/2/2e/CBS_News_2020_%28Stacked_II%29.svg',url:'https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8',type:'m3u8'},
  {id:'l_fox',  isLive:true,name:'Fox News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/6/67/Fox_News_Channel_logo.svg',url:'https://stream.livenewsplay.com:9555/hls/foxnewssd/index.m3u8?token=438097d01370fd77d1f642d0c9492f41&expires=1772883456&sig=f85beda0fcbbca7bd35ff9bef12a5f77a395d18ccc89d4cf7b3576e616443c2c',type:'m3u8'},
  {id:'l_nbc',  isLive:true,name:'NBC News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/NBC_logo.svg/1280px-NBC_logo.svg.png',url:'https://d1bl6tskrpq9ze.cloudfront.net/hls/master.m3u8?ads.xumo_channelId=99984003',type:'m3u8'},
  {id:'l_abc',  isLive:true,name:'ABC News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/ABC_News_logo_2021.svg/1280px-ABC_News_logo_2021.svg.png',url:'https://aegis-cloudfront-1.tubi.video/d6cbb0de-68e4-4f3b-82f9-bf5d526e0bde/index.m3u8',type:'m3u8'},
  {id:'l_global',isLive:true,name:'Global News',category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Global_News.svg/1280px-Global_News.svg.png',url:'https://live.corusdigitaldev.com/groupd/live/49a91e7f-1023-430f-8d66-561055f3d0f7/live.isml/.m3u8',type:'m3u8'},
  {id:'l_cpac', isLive:true,name:'CPAC',      category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/1/17/CPAC_logo_black_color.png',url:'https://www.livehdtv.com/embed/cpac-english/',type:'livehdtv'},
  {id:'l_cbc_1',isLive:true,name:'CBC News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/CBC_News_Logo.svg/960px-CBC_News_Logo.svg.png',url:'https://amg00788-cbc-amg00788c4-xumo-us-3045.playouts.now.amagi.tv/master.m3u8',type:'m3u8'},
  {id:'l_cbc_2',isLive:true,name:'CBC The National',category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/CBC_News_Logo.svg/960px-CBC_News_Logo.svg.png',url:'https://cbcrclinear-tor.akamaized.net/hls/live/2042769/geo_allow_ca/CBCRCLINEAR_TOR_15/master5.m3u8',type:'m3u8'},
  {id:'l_city', isLive:true,name:'CityNews',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/CityNews_logo.svg/960px-CityNews_logo.svg.png',url:'https://citynewsregional.akamaized.net/hls/live/1024052/Regional_Live_7/master.m3u8',type:'m3u8'},
  {id:'l_ms',   isLive:true,name:'MS NOW',    category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/MS_NOW_logo.svg/500px-MS_NOW_logo.svg.png',url:'https://cdn.livenewsplayer.com/hls/msnbcsd/msnbcsd/chunklist_w200304347_tkbmV3enN0YXJ0dGltZT0xNzcyODYxODU1Jm5ld3plbmR0aW1lPTE3NzI4NjkwNTUmbmV3emhhc2g9SGVGRFQtR2FlQTZuekJSUDNjbmVUM0hZOElfQnhWVUF2eEVHUnF0amJGb2duMXZJWEt2aWs1ZTVXR2dYS0pOVV9tZXVFbGVjbFZnNFQtSlNqbzlzYlE9PQ==.m3u8',type:'m3u8'},
  {id:'l_bbc',  isLive:true,name:'BBC News',  category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/BBC_News_2022_%28Alt%29.svg/1280px-BBC_News_2022_%28Alt%29.svg.png',url:'https://dash2.antik.sk/live/test_bbc_world/playlist.m3u8',type:'m3u8'},
  {id:'l_cnbc', isLive:true,name:'CNBC',      category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/e/e3/CNBC_logo.svg',url:'https://stream.livenewsplay.com:9443/hls/cnbc/cnbcsd.m3u8',type:'m3u8'},
  {id:'l_bloom',isLive:true,name:'Bloomberg', category:'News',logo:'https://i.logos-download.com/1946/458-777a40eed550e4c773f6362e45260a11.png/Bloomberg_Logo_2015.png',url:'https://cdn4.skygo.mn/live/disk1/Bloomberg/HLSv3-FTA/Bloomberg.m3u8',type:'m3u8'},
  {id:'l_reu',  isLive:true,name:'Reuters',   category:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Reuters_logo_2024.svg/1280px-Reuters_logo_2024.svg.png',url:'https://amg00453-reuters-amg00453c1-plex-us-2106.playouts.now.amagi.tv/playlist/amg00453-reuters-reuters-plexus/playlist.m3u8',type:'m3u8'},
];

// ─── UTILS ───────────────────────────────────────────────────────────────────
const apiCache = new Map();
const CACHE_TTL = 300000;
const fetchWithCache = async (url) => {
  const hit = apiCache.get(url);
  if (hit && Date.now()-hit.timestamp < CACHE_TTL) return hit.data;
  const data = await (await fetch(url)).json();
  if (apiCache.size>500) apiCache.delete(apiCache.keys().next().value);
  apiCache.set(url,{data,timestamp:Date.now()});
  return data;
};

const initHls = (video,src,isMain,cb) => {
  if (!window.Hls) return null;
  if (window.Hls.isSupported()) {
    const hls = new window.Hls({
      maxMaxBufferLength:isMain?30:10, maxBufferSize:isMain?60e6:15e6,
      liveSyncDurationCount:3, capLevelToPlayerSize:true,
      autoLevelCapping:isMain?-1:0, enableWorker:true,
      renderTextTracksNatively:true, enableCEA708Captions:true, enableWebVTT:true
    });
    hls.loadSource(src); hls.attachMedia(video);
    if (cb.onParsed)    hls.on(window.Hls.Events.MANIFEST_PARSED,         cb.onParsed);
    if (cb.onSubtitles) hls.on(window.Hls.Events.SUBTITLE_TRACKS_UPDATED, cb.onSubtitles);
    if (cb.onError)     hls.on(window.Hls.Events.ERROR,                   cb.onError);
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
  s.async = true;
  s.onload = cb;
  document.body.appendChild(s);
};

const lockScroll   = () => { window.scrollLocks=(window.scrollLocks||0)+1; document.body.style.overflow='hidden'; };
const unlockScroll = () => { window.scrollLocks=Math.max((window.scrollLocks||1)-1,0); if(!window.scrollLocks)document.body.style.overflow=''; };
const cn = (...c) => c.filter(Boolean).join(' ');
const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints>0;
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US',{year:'numeric'}) : '';
const formatHistoryDate = (d) => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : '';
const getRatingColor = (r) => ({color:r?`hsl(${Math.max(0,Math.min(120,(r-3)*15))},80%,50%)`:'#9ca3af'});

const parseEpisodeDate = (ds) => {
  if (!ds) return {text:"Release date unknown",isNew:false,isFuture:false};
  const epDate=new Date(ds), nowM=new Date(); nowM.setHours(0,0,0,0);
  const diff=Math.floor((nowM-(new Date(epDate.getFullYear(),epDate.getMonth(),epDate.getDate())))/86400000);
  const fmt=epDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  if (diff<0)  return {text:`Airs on ${fmt}`,isNew:false,isFuture:true};
  if (diff<=14) return {text:`${diff===0?"Today":diff===1?"1 day ago":diff+" days ago"} (${fmt})`,isNew:true,isFuture:false};
  return {text:fmt,isNew:false,isFuture:false};
};

// ─── HOOKS ────────────────────────────────────────────────────────────────
const useLocalStorage = (key,init) => {
  const [v,setV] = useState(()=>{ try{const i=localStorage.getItem(key);return i?JSON.parse(i):init;}catch{return init;} });
  const set = val => { try{const s=val instanceof Function?val(v):val;setV(s);localStorage.setItem(key,JSON.stringify(s));}catch(e){console.error(e);} };
  return [v,set];
};

const useDebounce = (val,delay) => {
  const [d,setD]=useState(val);
  useEffect(()=>{const h=setTimeout(()=>setD(val),delay);return()=>clearTimeout(h);},[val,delay]);
  return d;
};

// ─── FIRESTORE SYNC ────────────────────────────────────────────────────────
const safeLS = {
  get:(k,fb)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
};
const LEGACY_MAP = {
  apiKey:'onyx_tmdb_key_v3', omdbApiKey:'onyx_omdb_key_v1',
  sourceKey:'onyx_source_v7', requireProfile:'onyx_require_profile',
  algoPrefs:'onyx_algo_v1', ccSettings:'onyx_cc_settings',
  geminiApiKey:'onyx_gemini_key', vidplusSettings:'onyx_vidplus_v1',
  skipSettings:'onyx_skip_v1'
};

const useFirestoreData = (uid) => {
  const [settings,setS]  = useState(()=>safeLS.get('cloud_settings',DEFAULT_SETTINGS));
  const [history, setH]  = useState(()=>safeLS.get('cloud_history',[]));
  const [watchlist,setW] = useState(()=>safeLS.get('cloud_watchlist',[]));
  const [loaded, setLoaded] = useState(false);
  const latS=useRef(settings), latH=useRef(history), latW=useRef(watchlist), timers=useRef({});
  useEffect(()=>{latS.current=settings;},[settings]);
  useEffect(()=>{latH.current=history;},[history]);
  useEffect(()=>{latW.current=watchlist;},[watchlist]);

  useEffect(()=>{
    if (!uid){setLoaded(true);return;}
    let ok=true;
    (async()=>{
      try {
        const [ss,hs,ws]=await Promise.all([
          getDoc(doc(db,'users',uid,'data','settings')),
          getDoc(doc(db,'users',uid,'data','history')),
          getDoc(doc(db,'users',uid,'data','watchlist'))
        ]);
        if (!ok) return;
        if (ss.exists()){const v={...DEFAULT_SETTINGS,...ss.data()};setS(v);safeLS.set('cloud_settings',v);}
        else {
          const m={...DEFAULT_SETTINGS}; let did=false;
          Object.entries(LEGACY_MAP).forEach(([sk,lk])=>{const v=safeLS.get(lk,null);if(v!==null){m[sk]=v;did=true;}});
          setS(m); safeLS.set('cloud_settings',m);
          if(did) setDoc(doc(db,'users',uid,'data','settings'),m).catch(console.error);
        }
        if (hs.exists()){const v=hs.data().items||[];setH(v);safeLS.set('cloud_history',v);}
        else{const v=safeLS.get('onyx_history_v3',[]);setH(v);safeLS.set('cloud_history',v);if(v.length)setDoc(doc(db,'users',uid,'data','history'),{items:v}).catch(console.error);}
        if (ws.exists()){const v=ws.data().items||[];setW(v);safeLS.set('cloud_watchlist',v);}
        else{const v=safeLS.get('onyx_watchlist_v3',[]);setW(v);safeLS.set('cloud_watchlist',v);if(v.length)setDoc(doc(db,'users',uid,'data','watchlist'),{items:v}).catch(console.error);}
      }catch(e){console.error('Firestore load:',e);}
      if(ok)setLoaded(true);
    })();
    return()=>{ok=false;};
  },[uid]);

  const save = useCallback((docId,getVal)=>{
    if(!uid)return;
    clearTimeout(timers.current[docId]);
    timers.current[docId]=setTimeout(async()=>{
      try{const v=getVal();await setDoc(doc(db,'users',uid,'data',docId),docId==='settings'?v:{items:v});}
      catch(e){console.error('Firestore save:',e);}
    },1500);
  },[uid]);

  const saveSettings  = useCallback(val=>{const n=typeof val==='function'?val(latS.current):val;setS(n);safeLS.set('cloud_settings',n);save('settings',()=>latS.current);},[save]);
  const saveHistory   = useCallback(val=>{const n=typeof val==='function'?val(latH.current):val;setH(n);safeLS.set('cloud_history',n);save('history',()=>latH.current);},[save]);
  const saveWatchlist = useCallback(val=>{const n=typeof val==='function'?val(latW.current):val;setW(n);safeLS.set('cloud_watchlist',n);save('watchlist',()=>latW.current);},[save]);

  return {settings,saveSettings,history,saveHistory,watchlist,saveWatchlist,loaded};
};

// ─── GLOBAL STYLES ──────────────────────────────────────────────────────────
const GlobalStyles = ()=>(
  <style>{`
    ::-webkit-scrollbar{display:none}*{-ms-overflow-style:none;scrollbar-width:none}
    .hardware-accel{transform:translateZ(0);will-change:transform,opacity}
    body.css-fullscreen-active header{display:none!important}
    body.css-fullscreen-active .hardware-accel,body.css-fullscreen-active .animate-in{transform:none!important;animation:none!important}
    :fullscreen,:-webkit-full-screen{width:100vw!important;height:100vh!important;border:none!important;border-radius:0!important;padding:0!important;margin:0!important}
    .optimize-row{content-visibility:auto;contain-intrinsic-size:350px}
    .fade-edge-right{mask-image:linear-gradient(to right,black 85%,transparent 100%);-webkit-mask-image:linear-gradient(to right,black 85%,transparent 100%)}
    .spoiler-blur{filter:blur(8px);cursor:pointer;transition:filter .4s ease}.spoiler-blur:hover{filter:blur(4px)}
    .view-enter{animation:scale-up .4s cubic-bezier(.16,1,.3,1)}
    @keyframes scale-up{from{transform:scale(.97) translateY(10px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
    .modal-overlay-enter{animation:fade-in .4s ease-out}
    @keyframes fade-in{from{opacity:0}to{opacity:1}}
    @keyframes cc-fade{from{opacity:0}to{opacity:1}}
    @keyframes cc-slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes cc-pop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
    .cc-anim-fade{animation:cc-fade .3s ease-out forwards}
    .cc-anim-slideUp{animation:cc-slideUp .3s cubic-bezier(.16,1,.3,1) forwards}
    .cc-anim-pop{animation:cc-pop .3s cubic-bezier(.175,.885,.32,1.275) forwards}
    .number-shadow{-webkit-text-stroke:1px rgba(255,255,255,.3);color:transparent}
    .custom-select{appearance:none;background-image:url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.7)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");background-repeat:no-repeat;background-position:right 1rem center;background-size:1em}
  `}</style>
);

// ─── LOGIN SCREEN (FIX: Apple TV–style) ────────────────────────────────────
const LoginScreen = () => {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  const handle = async(e)=>{
    e.preventDefault(); setLoading(true); setError('');
    try{ await signInWithEmailAndPassword(auth,email,password); }
    catch{ setError('Invalid email or password.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-sans px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#19446C]/20 rounded-full blur-[140px]"/>
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-white/[0.02] rounded-full blur-[100px]"/>
      </div>
      <div className="w-full max-w-[360px] relative z-10">
        <div className="flex justify-center mb-14">
          <div className="w-[72px] h-[72px] bg-white rounded-[22px] flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.10),0_20px_40px_rgba(0,0,0,0.5)]">
            <Play className="text-black w-8 h-8 fill-black ml-1"/>
          </div>
        </div>
        <h1 className="text-[2.6rem] font-bold text-white text-center mb-2 tracking-tight leading-none">Sign in</h1>
        <p className="text-white/35 text-center mb-10 text-[15px]">Your private stream awaits.</p>
        <form onSubmit={handle} className="space-y-3">
          <input type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}
            className="w-full bg-white/[0.07] border border-white/[0.09] text-white px-5 py-[15px] rounded-2xl outline-none focus:border-white/25 focus:bg-white/10 placeholder:text-white/30 text-[15px] transition-all"
            required autoComplete="email"/>
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}
            className="w-full bg-white/[0.07] border border-white/[0.09] text-white px-5 py-[15px] rounded-2xl outline-none focus:border-white/25 focus:bg-white/10 placeholder:text-white/30 text-[15px] transition-all"
            required autoComplete="current-password"/>
          {error && <div className="text-red-400 text-[13px] text-center py-3 px-4 bg-red-500/8 rounded-xl border border-red-500/12">{error}</div>}
          <div className="pt-2">
            <button type="submit" disabled={loading}
              className="w-full bg-white text-black font-semibold text-[15px] py-[15px] rounded-2xl hover:bg-white/92 active:scale-[0.985] transition-all disabled:opacity-40 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.08)]">
              {loading ? <div className="w-5 h-5 border-[2.5px] border-black/15 border-t-black rounded-full animate-spin"/> : 'Continue'}
            </button>
          </div>
        </form>
        <p className="text-white/20 text-xs text-center mt-10">Private access only</p>
      </div>
    </div>
  );
};

// ─── TOP NAV (FIX: sign-out removed, focus-mode pointer-events fixed) ───────
const TopNavigation = React.memo(({activeTab,setActiveTab,selectedGenre,setSelectedGenre,focusMode})=>{
  const [scrolled,setScrolled]=useState(false);
  useEffect(()=>{
    let t=false;
    const h=()=>{if(!t){window.requestAnimationFrame(()=>{setScrolled(window.scrollY>20);t=false;});t=true;}};
    window.addEventListener('scroll',h,{passive:true});
    return()=>window.removeEventListener('scroll',h);
  },[]);

  const mainTabs=[{id:'home',label:'Home'},{id:'movies',label:'Movies'},{id:'tv',label:'Series'},{id:'live',label:'Live News'},{id:'sports',label:'Live Sports'}];
  const utilTabs=[{id:'search',icon:Search,label:'Search'},{id:'watchlist',icon:Bookmark,label:'Library'},{id:'history',icon:Clock,label:'History'},{id:'settings',icon:Settings,label:'Settings'}];
  const showSub=activeTab==='movies'||activeTab==='tv';
  const genres=activeTab==='movies'?GENRES.movie:GENRES.tv;

  return (
    <header className={cn(
      "fixed top-0 left-0 w-full z-[70] transition-all duration-500 flex flex-col items-center hardware-accel",
      focusMode?"-translate-y-full opacity-0 pointer-events-none":"translate-y-0 opacity-100 pointer-events-none",
      scrolled&&!focusMode?"bg-black/80 backdrop-blur-3xl border-b border-white/5":"bg-gradient-to-b from-black/80 via-black/30 to-transparent"
    )}>
      <nav className="w-full flex items-center justify-between px-4 md:px-8 lg:px-12 xl:px-16 h-20 pointer-events-auto max-w-[1800px]">
        <div className="flex items-center gap-6 md:gap-10">
          <div onClick={()=>setActiveTab('home')} className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center cursor-pointer shrink-0 hover:scale-105 transition-transform shadow-lg">
            <Play className="text-black w-5 h-5 fill-black ml-0.5"/>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {mainTabs.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                className={cn("text-[15px] transition-all tracking-wide outline-none rounded-md px-2 py-1 relative",
                  activeTab===t.id?"text-white font-bold drop-shadow-lg":"text-white/50 font-semibold hover:text-white/80")}>
                {t.label}
                {activeTab===t.id&&<div className="absolute -bottom-1 left-0 w-full h-[2.5px] bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"/>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-4 shrink-0 overflow-hidden">
          <div className="md:hidden flex items-center overflow-x-auto gap-5 mr-4 max-w-[50vw] fade-edge-right">
            {mainTabs.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                className={cn("text-[13px] transition-all whitespace-nowrap px-2 py-2 outline-none rounded-md relative",
                  activeTab===t.id?"text-white font-bold":"text-white/50 font-semibold hover:text-white/80")}>
                {t.label}
                {activeTab===t.id&&<div className="absolute bottom-0 left-0 w-full h-[2.5px] bg-white rounded-full"/>}
              </button>
            ))}
          </div>
          <div className="flex gap-1 md:gap-2">
            {utilTabs.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                className={cn("p-2.5 rounded-full flex items-center justify-center transition-all shrink-0 outline-none",
                  activeTab===t.id?"bg-[#19446C] text-white shadow-lg":"text-white/70 hover:text-white hover:bg-white/10")}
                title={t.label}>
                <t.icon className="w-4 h-4 md:w-5 md:h-5"/>
              </button>
            ))}
          </div>
        </div>
      </nav>
      <div className={cn(
        "w-full overflow-hidden transition-all duration-300 flex justify-center max-w-[1800px]",
        showSub&&!focusMode?"max-h-16 opacity-100 pb-4 pointer-events-auto":"max-h-0 opacity-0 pb-0 pointer-events-none"
      )}>
        <div className="flex items-center overflow-x-auto gap-6 md:gap-8 px-4 md:px-8 lg:px-12 xl:px-16 w-full fade-edge-right">
          <button onClick={()=>setSelectedGenre('All')} className={cn("py-1.5 px-2 text-[13px] font-semibold transition-all whitespace-nowrap outline-none rounded-md relative",selectedGenre==='All'?"text-white":"text-white/50 hover:text-white/80")}>
            All{selectedGenre==='All'&&<div className="absolute -bottom-0.5 left-0 w-full h-[2px] bg-white rounded-full"/>}
          </button>
          {genres.map(g=>(
            <button key={g.id} onClick={()=>setSelectedGenre(g.id)}
              className={cn("py-1.5 px-2 text-[13px] font-semibold transition-all whitespace-nowrap outline-none rounded-md relative",
                selectedGenre===g.id?"text-white":"text-white/50 hover:text-white/80")}>
              {g.name}{selectedGenre===g.id&&<div className="absolute -bottom-0.5 left-0 w-full h-[2px] bg-white rounded-full"/>}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
});

// ─── MEDIA CARD ─────────────────────────────────────────────────────────────
const MediaCard = React.memo(({media,onClick,size="normal",showRank=null})=>{
  const img = media.poster_path
    ? `${IMAGE_BASE_URL}${POSTER_SIZE}${media.poster_path}`
    : 'https://via.placeholder.com/500x750?text=No+Image';
  const w = size==="large"?"w-40 md:w-60":size==="grid"?"w-full":"w-32 md:w-44";
  return (
    <div onClick={()=>onClick(media)}
      className={cn("relative group cursor-pointer flex-shrink-0 transition-all duration-300 z-10 hover:z-50 outline-none focus:z-50 rounded-2xl md:rounded-[1.25rem] select-none snap-start scroll-ml-4 md:scroll-ml-8 lg:scroll-ml-12 xl:scroll-ml-16",w)}
      tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onClick(media);}}>
      {showRank&&<div className="absolute -left-4 md:-left-8 bottom-4 md:bottom-8 text-7xl md:text-9xl font-black z-30 number-shadow tracking-tighter group-hover:text-white transition-colors pointer-events-none">{showRank}</div>}
      <div className="aspect-[2/3] rounded-2xl md:rounded-[1.25rem] overflow-hidden bg-white/5 transition-all duration-300 ease-out group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)] border border-transparent group-hover:border-white/30 group-focus:border-white/60 relative z-20 hardware-accel">
        <img src={img} alt={media.title||media.name} className="w-full h-full object-cover transition-transform duration-700 pointer-events-none" loading="lazy" decoding="async" draggable="false"
          onError={e=>{e.target.onerror=null;e.target.src='https://via.placeholder.com/500x750?text=No+Image';}}/>
        {media.progress&&<div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/60 z-30 pointer-events-none"><div className="h-full bg-[#19446C]" style={{width:`${media.progress}%`}}/></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 md:p-4 z-20 pointer-events-none">
          <h4 className="text-white font-semibold text-xs md:text-sm line-clamp-2 leading-tight mb-1">{media.title||media.name}</h4>
          <div className="flex items-center gap-2 text-[10px] md:text-xs text-white/70 mt-1">
            {!media.isLive&&<div className="flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded-md"><Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500"/><span className="font-semibold text-white">{media.vote_average?.toFixed(1)}</span></div>}
            <span>{formatDate(media.release_date||media.first_air_date)}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── CONTENT ROW ────────────────────────────────────────────────────────────
const ContentRow = React.memo(({title,fetchUrl,onMediaClick,apiKey,isLarge=false,customData=null,showRanking=false})=>{
  const [movies,setMovies]=useState([]);
  const [fetched,setFetched]=useState(false);
  const [intersecting,setIntersecting]=useState(false);
  const scrollRef=useRef(null),rowRef=useRef(null),obsRef=useRef(null);
  const down=useRef(false),startX=useRef(0),scrollLeft=useRef(0),dragging=useRef(false),stRef=useRef(null);
  const loop=movies.length>=7&&!showRanking;
  const display=loop?[...movies,...movies,...movies]:movies;

  const setRow=useCallback(node=>{
    if(obsRef.current)obsRef.current.disconnect();
    obsRef.current=new IntersectionObserver(e=>{if(e[0].isIntersecting){setIntersecting(true);obsRef.current.disconnect();}},{rootMargin:'400px'});
    if(node){rowRef.current=node;obsRef.current.observe(node);}
  },[]);

  useEffect(()=>{
    if(customData){setMovies(customData);setFetched(true);return;}
    if(!apiKey||!fetchUrl||!intersecting||fetched)return;
    let ok=true;
    (async()=>{
      try{
        const sep=fetchUrl.includes('?')?'&':'?';
        const [d1,d2]=await Promise.all([
          fetchWithCache(`${BASE_URL}${fetchUrl}${sep}api_key=${apiKey}&page=1`),
          fetchWithCache(`${BASE_URL}${fetchUrl}${sep}api_key=${apiKey}&page=2`)
        ]);
        if(!ok)return;
        setMovies(Array.from(new Map([...(d1.results||[]),...(d2.results||[])].filter(i=>i.poster_path).map(i=>[i.id,i])).values()));
        setFetched(true);
      }catch(e){console.error(e);}
    })();
    return()=>{ok=false;};
  },[fetchUrl,apiKey,customData,intersecting,fetched]);

  const getBlock=useCallback(()=>{
    if(!scrollRef.current||!movies.length||!loop)return 0;
    const ch=scrollRef.current.children;
    if(ch.length>=movies.length*3&&ch[0]&&ch[movies.length])return ch[movies.length].offsetLeft-ch[0].offsetLeft;
    return 0;
  },[movies.length,loop]);

  useEffect(()=>{
    if(fetched&&scrollRef.current&&loop){
      const t=setTimeout(()=>{
        if(scrollRef.current){
          scrollRef.current.style.scrollBehavior='auto';
          scrollRef.current.scrollLeft=getBlock();
          setTimeout(()=>{if(scrollRef.current)scrollRef.current.style.scrollBehavior='smooth';},50);
        }
      },50);
      return()=>clearTimeout(t);
    }
  },[fetched,loop,getBlock]);

  const snapLoop=useCallback(()=>{
    if(!loop||dragging.current||down.current||!scrollRef.current)return;
    const bw=getBlock(); if(!bw)return;
    if(scrollRef.current.scrollLeft<bw*.5){
      scrollRef.current.style.scrollBehavior='auto';scrollRef.current.scrollLeft+=bw;
      setTimeout(()=>{if(scrollRef.current)scrollRef.current.style.scrollBehavior='smooth';},50);
    } else if(scrollRef.current.scrollLeft>bw*1.5){
      scrollRef.current.style.scrollBehavior='auto';scrollRef.current.scrollLeft-=bw;
      setTimeout(()=>{if(scrollRef.current)scrollRef.current.style.scrollBehavior='smooth';},50);
    }
  },[loop,getBlock]);

  const onScroll=useCallback(()=>{clearTimeout(stRef.current);stRef.current=setTimeout(snapLoop,150);},[snapLoop]);
  const scroll=useCallback(dir=>{if(scrollRef.current)scrollRef.current.scrollBy({left:dir==='right'?scrollRef.current.clientWidth*.8:-scrollRef.current.clientWidth*.8,behavior:'smooth'});},[]);

  const mDown=e=>{down.current=true;dragging.current=false;startX.current=e.pageX-scrollRef.current.offsetLeft;scrollLeft.current=scrollRef.current.scrollLeft;scrollRef.current.style.scrollBehavior='auto';};
  const mLeave=()=>{down.current=false;if(scrollRef.current)scrollRef.current.style.scrollBehavior='smooth';};
  const mUp=()=>{down.current=false;if(scrollRef.current){scrollRef.current.style.scrollBehavior='smooth';snapLoop();}};
  const mMove=e=>{
    if(!down.current)return; e.preventDefault();
    const walk=(e.pageX-scrollRef.current.offsetLeft-startX.current)*1.5;
    if(Math.abs(walk)>5)dragging.current=true;
    let nl=scrollLeft.current-walk;
    if(loop){const bw=getBlock();if(bw>0){if(nl<10){nl+=bw;scrollLeft.current+=bw;}else if(nl>scrollRef.current.scrollWidth-scrollRef.current.clientWidth-10){nl-=bw;scrollLeft.current-=bw;}}}
    scrollRef.current.scrollLeft=nl;
  };
  const cardClick=useCallback(m=>{if(!dragging.current&&onMediaClick)onMediaClick(m);},[onMediaClick]);

  if(!customData&&!fetched)return <div ref={setRow} className="h-48 md:h-64 mb-8 md:mb-12 w-full optimize-row"/>;
  if(!movies.length)return null;

  return (
    <div ref={setRow} className="mb-10 md:mb-14 relative group/row animate-in fade-in slide-in-from-bottom-4 duration-700 optimize-row">
      <div className="flex items-center justify-between mb-4 md:mb-5 px-4 md:px-8 lg:px-12 xl:px-16 max-w-[1800px] mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white/90 tracking-tight select-none">{title}</h2>
      </div>
      <div className="relative group/nav max-w-[1800px] mx-auto">
        <button onClick={()=>scroll('left')} className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-black via-black/80 to-transparent z-30 hidden md:flex items-center justify-start pl-4 opacity-0 group-hover/nav:opacity-100 transition-all outline-none pointer-events-auto">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center hover:bg-[#19446C] hover:text-white text-white shadow-xl"><ChevronLeft className="w-5 h-5 md:w-8 md:h-8"/></div>
        </button>
        <div ref={scrollRef} onScroll={onScroll} onMouseDown={mDown} onMouseLeave={mLeave} onMouseUp={mUp} onMouseMove={mMove}
          className={cn("flex gap-4 md:gap-6 overflow-x-auto pb-8 pt-4 px-4 md:px-8 lg:px-12 xl:px-16 cursor-grab active:cursor-grabbing hardware-accel snap-x snap-mandatory",showRanking&&"pl-8 md:pl-20")}
          style={{scrollBehavior:'smooth'}}>
          {display.map((m,i)=><MediaCard key={`${m.id}_${i}`} media={m} onClick={cardClick} size={isLarge?"large":"normal"} showRank={showRanking?i+1:null}/>)}
        </div>
        <button onClick={()=>scroll('right')} className="absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-l from-black via-black/80 to-transparent z-30 hidden md:flex items-center justify-end pr-4 opacity-0 group-hover/nav:opacity-100 transition-all outline-none pointer-events-auto">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center hover:bg-[#19446C] hover:text-white text-white shadow-xl"><ChevronRight className="w-5 h-5 md:w-8 md:h-8"/></div>
        </button>
      </div>
    </div>
  );
});

// ─── HERO ────────────────────────────────────────────────────────────────────
const Hero = React.memo(({onPlay,onMoreInfo,apiKey,type='all'})=>{
  const [movie,setMovie]=useState(null),[imgFailed,setImgFailed]=useState(false);
  const rand=useCallback(async()=>{
    setImgFailed(false);
    try{
      const ep=type==='all'?'/trending/all/day':type==='movie'?'/trending/movie/day':'/trending/tv/day';
      const [d1,d2]=await Promise.all([
        fetchWithCache(`${BASE_URL}${ep}?api_key=${apiKey}&page=1`),
        fetchWithCache(`${BASE_URL}${ep}?api_key=${apiKey}&page=2`)
      ]);
      const v=[...(d1.results||[]),...(d2.results||[])].filter(i=>i.backdrop_path&&!i.adult);
      setMovie(v[Math.floor(Math.random()*v.length)]);
    }catch(e){console.error(e);}
  },[apiKey,type]);
  useEffect(()=>{if(apiKey)rand();},[apiKey,rand]);
  if(!movie)return <div className="h-[80vh] w-full bg-black animate-pulse"/>;
  const bg=imgFailed?(movie.poster_path?`${IMAGE_BASE_URL}w1280${movie.poster_path}`:'https://via.placeholder.com/1280x720'):`${IMAGE_BASE_URL}${BACKDROP_SIZE}${movie.backdrop_path}`;
  return (
    <div className="relative w-full overflow-hidden mb-12 flex flex-col justify-end min-h-[85vh] bg-black">
      <div className="absolute inset-0 bg-black">
        <img src={bg} alt="" className="w-full h-full object-cover object-top hardware-accel opacity-80 pointer-events-none" decoding="async" onError={()=>setImgFailed(true)} draggable="false"/>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10 pointer-events-none hardware-accel"/>
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-transparent z-10 pointer-events-none hidden md:block"/>
      <div className="relative px-6 md:px-12 lg:px-16 pt-32 md:pt-52 pb-24 md:pb-40 flex flex-col justify-end z-20 w-full flex-1 pointer-events-none max-w-[1800px] mx-auto">
        <div className="max-w-4xl space-y-5 animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-200 pointer-events-auto hardware-accel">
          <div className="flex items-center gap-3">
            <div className="bg-[#19446C] text-white border border-[#19446C]/50 px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.2em]">
              {(movie.media_type==='tv'||type==='tv')?'Series':'Feature Film'}
            </div>
          </div>
          <h1 className="text-4xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight drop-shadow-2xl max-w-full leading-[1.05] select-none">{movie.title||movie.name}</h1>
          <div className="flex items-center gap-4 text-xs md:text-sm font-medium text-white/70 select-none">
            <div className="flex items-center gap-1 font-semibold text-white bg-white/20 px-2.5 py-1 rounded-md backdrop-blur-md">
              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500"/>
              <span style={getRatingColor(movie.vote_average)}>{movie.vote_average?.toFixed(1)}</span>
            </div>
            <span>{formatDate(movie.release_date||movie.first_air_date)}</span>
            <span className="px-2 py-1 border border-white/20 rounded-md text-[10px] text-white/70 flex items-center gap-1 font-semibold"><Tv className="w-3 h-3"/>4K HDR</span>
          </div>
          <p className="text-white/80 text-sm md:text-lg max-w-3xl line-clamp-3 md:line-clamp-4 font-normal leading-relaxed select-none">{movie.overview}</p>
          <div className="flex flex-wrap gap-4 pt-4">
            <button onClick={()=>onPlay(movie)} className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-white text-black hover:bg-white/90 px-8 py-3.5 rounded-full font-bold text-lg transition-transform hover:scale-105 outline-none shadow-lg"><Play className="w-6 h-6 fill-black"/>Watch Now</button>
            <button onClick={()=>onMoreInfo(movie)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/15 backdrop-blur-xl hover:bg-white/25 text-white px-8 py-3.5 rounded-full font-semibold transition-all border border-white/10 text-lg outline-none hover:scale-[1.03]"><Info className="w-6 h-6"/>Details</button>
            <button onClick={rand} className="flex items-center justify-center w-14 h-14 bg-white/15 backdrop-blur-xl hover:bg-white/25 text-white rounded-full transition-all border border-white/10 shrink-0 outline-none hover:scale-[1.03]" title="Surprise Me"><Shuffle className="w-6 h-6"/></button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
const HomeView = React.memo(({apiKey,history,watchlist,algoPrefs,onPlay,onMoreInfo})=>{
  const [dynRows,setDynRows]=useState([]);
  const [hasMore,setHasMore]=useState(true);
  const obs=useRef(null);
  const used=useRef(new Set(['top_10','now_playing','on_the_air','tmdb_top_movies','tmdb_top_tv','latest_action','latest_adventure','sci_fi','fantasy']));

  const staticRows=useMemo(()=>[
    {id:'top_10',title:'Top 10 Today',url:'/trending/all/day',isLarge:true,showRanking:true},
    {id:'now_playing',title:'New In Theatres',url:'/movie/now_playing'},
    {id:'on_the_air',title:'Currently Airing',url:'/tv/on_the_air'},
    {id:'tmdb_top_movies',title:'Highest Rated Movies',url:'/movie/top_rated'},
    {id:'tmdb_top_tv',title:'Highest Rated Series',url:'/tv/top_rated'},
    {id:'latest_action',title:'Latest Action',url:'/discover/movie?with_genres=28&sort_by=popularity.desc'},
    {id:'latest_adventure',title:'Epic Adventures',url:'/discover/movie?with_genres=12&sort_by=popularity.desc'},
    {id:'sci_fi',title:'Sci-Fi Explorations',url:'/discover/movie?with_genres=878'},
    {id:'fantasy',title:'Magical Fantasy',url:'/discover/movie?with_genres=14'},
  ],[]);

  const genRow=useCallback(()=>{
    const src=[...history,...watchlist].sort(()=>.5-Math.random());
    for(const s of src){
      const k=`rec_${s.id}`;
      if(!used.current.has(k)){
        used.current.add(k);
        const t=s.media_type||(s.name?'tv':'movie');
        return{id:k,title:`${history.some(h=>h.id===s.id)?'Because you watched':'Because you saved'} ${s.title||s.name}`,url:`/${t}/${s.id}/recommendations`};
      }
    }
    const pool=ALL_UNIQUE_GENRES.filter(g=>!algoPrefs.excluded.includes(g.id)).sort((a,b)=>(algoPrefs.boosted.includes(b.id)?1:0)-(algoPrefs.boosted.includes(a.id)?1:0)||.5-Math.random());
    for(const g of pool){
      const mk=`genre_movie_${g.id}`,mg=GENRES.movie.find(x=>(x.realId||x.id)===g.id);
      if(!used.current.has(mk)&&mg){used.current.add(mk);return{id:mk,title:`${g.name} Movies`,url:`/discover/movie?with_genres=${mg.realId||mg.id}${mg.exclude?`&without_genres=${mg.exclude}`:''}&sort_by=popularity.desc`};}
      const tk=`genre_tv_${g.id}`,tg=GENRES.tv.find(x=>(x.realId||x.id)===g.id);
      if(!used.current.has(tk)&&tg){used.current.add(tk);return{id:tk,title:`${g.name} Series`,url:`/discover/tv?with_genres=${tg.realId||tg.id}${tg.exclude?`&without_genres=${tg.exclude}`:''}${tg.keywords?`&with_keywords=${tg.keywords}`:''}&sort_by=popularity.desc`};}
    }
    return null;
  },[algoPrefs,history,watchlist]);

  const lastRef=useCallback(node=>{
    if(obs.current)obs.current.disconnect();
    obs.current=new IntersectionObserver(e=>{
      if(e[0].isIntersecting&&hasMore){
        setDynRows(prev=>{
          const nr=[];
          for(let i=0;i<3;i++){const r=genRow();if(r)nr.push(r);}
          if(!nr.length)setHasMore(false);
          return[...prev,...nr];
        });
      }
    },{rootMargin:'800px'});
    if(node)obs.current.observe(node);
  },[hasMore,genRow]);

  const histItems=useMemo(()=>history.slice(0,10),[history]);

  return (
    <div className="pb-32 bg-black min-h-screen w-full">
      <Hero onPlay={onPlay} onMoreInfo={onMoreInfo} apiKey={apiKey}/>
      <div className="relative z-20 -mt-24 md:-mt-32">
        {histItems.length>0&&<ContentRow key="history_row" title="Continue Watching" customData={histItems} onMediaClick={onMoreInfo}/>}
        {staticRows.map(r=><ContentRow key={r.id} title={r.title} fetchUrl={r.url} onMediaClick={onMoreInfo} apiKey={apiKey} isLarge={r.isLarge} showRanking={r.showRanking}/>)}
        {dynRows.map(r=><ContentRow key={r.id} title={r.title} fetchUrl={r.url} onMediaClick={onMoreInfo} apiKey={apiKey}/>)}
        {hasMore&&<div ref={lastRef} className="h-20 w-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#19446C]/50 border-t-[#19446C] rounded-full animate-spin"/></div>}
      </div>
    </div>
  );
});

// ─── GENRE GRID ──────────────────────────────────────────────────────────────
const GenreGridView = React.memo(({apiKey,type,genreId,onMediaClick})=>{
  const [results,setResults]=useState([]),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(true),[loading,setLoading]=useState(false);
  const obs=useRef();
  const gObj=type==='movie'?GENRES.movie.find(g=>g.id===genreId):GENRES.tv.find(g=>g.id===genreId);
  useEffect(()=>{setResults([]);setPage(1);setHasMore(true);},[genreId,type]);
  useEffect(()=>{
    let ok=true; setLoading(true);
    (async()=>{
      try{
        let url=`${BASE_URL}/discover/${type}?api_key=${apiKey}&sort_by=popularity.desc&page=${page}`;
        if(gObj)url+=`&with_genres=${gObj.realId||gObj.id}${gObj.exclude?`&without_genres=${gObj.exclude}`:''}${gObj.keywords?`&with_keywords=${gObj.keywords}`:''}`;
        const d=await fetchWithCache(url);
        if(!ok)return;
        if(d.results?.length){
          setResults(prev=>Array.from(new Map([...prev,...d.results.filter(i=>i.poster_path)].map(i=>[i.id,i])).values()));
          if(page>=d.total_pages||page>=50)setHasMore(false);
        }else setHasMore(false);
      }catch(e){console.error(e);}
      if(ok)setLoading(false);
    })();
    return()=>{ok=false;};
  },[apiKey,type,genreId,page,gObj]);
  const lastRef=useCallback(node=>{
    if(loading)return;
    if(obs.current)obs.current.disconnect();
    obs.current=new IntersectionObserver(e=>{if(e[0].isIntersecting&&hasMore)setPage(p=>p+1);},{rootMargin:'800px'});
    if(node)obs.current.observe(node);
  },[loading,hasMore]);
  return (
    <div className="pt-28 md:pt-36 px-4 md:px-8 lg:px-12 xl:px-16 min-h-screen bg-black mx-auto max-w-[1800px] animate-in fade-in duration-500">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-white">{gObj?.name} {type==='movie'?'Movies':'Series'}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-6 lg:gap-8 pb-10">
        {results.map(i=><MediaCard key={i.id} media={i} onClick={onMediaClick} size="grid"/>)}
      </div>
      {hasMore&&<div ref={lastRef} className="py-12 flex justify-center w-full"><div className="w-8 h-8 border-4 border-[#19446C]/50 border-t-[#19446C] rounded-full animate-spin"/></div>}
    </div>
  );
});

// ─── MINI LIVE STREAM ────────────────────────────────────────────────────────
const MiniLiveStream = React.memo(({channel,isMain,isFocused,onSetFocus,onFullscreen,hasAudio,onRequestAudio,volume,onVolumeChange,showFullscreenButton,ccSettings})=>{
  const vRef=useRef(null),hlsRef=useRef(null),cRef=useRef(null);
  const [hasVideo,setHasVideo]=useState(false),[error,setError]=useState(false),[inView,setInView]=useState(false);
  const [subAvail,setSubAvail]=useState(false),[subOn,setSubOn]=useState(false),[playing,setPlaying]=useState(true);
  const [cssFS,setCssFS]=useState(false),[cues,setCues]=useState([]);
  const cuesRef=useRef([]); const offset=ccSettings?.offset||-5;

  useEffect(()=>{const o=new IntersectionObserver(([e])=>setInView(e.isIntersecting),{threshold:.1});if(cRef.current)o.observe(cRef.current);return()=>o.disconnect();},[]);
  const load=useCallback(()=>{
    setError(false);setHasVideo(false);const v=vRef.current;if(!v)return null;
    return initHls(v,channel.url,isMain,{
      onParsed:()=>v.play().then(()=>{setHasVideo(true);setPlaying(true);}).catch(()=>setError(true)),
      onSubtitles:(e,d)=>{if(d.subtitleTracks?.length>0)setSubAvail(true);},
      onError:(e,d)=>{if(d.fatal){if(d.type===window.Hls?.ErrorTypes?.NETWORK_ERROR&&hlsRef.current)hlsRef.current.startLoad();else if(d.type===window.Hls?.ErrorTypes?.MEDIA_ERROR&&hlsRef.current)hlsRef.current.recoverMediaError();else{if(hlsRef.current)hlsRef.current.destroy();setError(true);}}}
    });
  },[channel.url,isMain]);

  useEffect(()=>{
    if(!inView||error||channel.type!=='m3u8')return;
    let inst;
    loadHlsScript(()=>{inst=load();hlsRef.current=inst;});
    return()=>{if(inst)inst.destroy();if(vRef.current){vRef.current.pause();vRef.current.removeAttribute('src');vRef.current.load();}};
  },[channel,inView,error,load]);

  useEffect(()=>{if(vRef.current){vRef.current.muted=!hasAudio;vRef.current.volume=volume;}},[hasAudio,volume]);
  useEffect(()=>{
    const v=vRef.current;if(!v)return;
    const upd=()=>{const ts=Array.from(v.textTracks);if(ts.length){if(!subAvail)setSubAvail(true);ts.forEach(t=>{if(t.mode!=='hidden')t.mode='hidden';});}};
    const id=setInterval(upd,1000);v.textTracks.addEventListener('addtrack',upd);
    return()=>{clearInterval(id);v.textTracks.removeEventListener('addtrack',upd);};
  },[subAvail]);
  useEffect(()=>{
    const v=vRef.current;if(!v)return;
    const h=()=>{
      if(!subOn){if(cuesRef.current.length){cuesRef.current=[];setCues([]);}return;}
      const t=v.currentTime-offset;let cur=[];
      for(let i=0;i<v.textTracks.length;i++){const tr=v.textTracks[i];if(tr.cues)for(let j=0;j<tr.cues.length;j++)if(t>=tr.cues[j].startTime&&t<=tr.cues[j].endTime)cur.push(tr.cues[j].text);}
      const s=cur.join('|');if(s!==cuesRef.current.join('|')){cuesRef.current=cur;setCues(cur);}
    };
    v.addEventListener('timeupdate',h);return()=>v.removeEventListener('timeupdate',h);
  },[subOn,offset]);
  useEffect(()=>{
    const h=()=>setCssFS(!!(document.fullscreenElement||document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange',h);document.addEventListener('webkitfullscreenchange',h);
    return()=>{document.removeEventListener('fullscreenchange',h);document.removeEventListener('webkitfullscreenchange',h);};
  },[]);
  useEffect(()=>{if(cssFS)document.body.classList.add('css-fullscreen-active');else document.body.classList.remove('css-fullscreen-active');return()=>document.body.classList.remove('css-fullscreen-active');},[cssFS]);

  const toggleCC=e=>{e.stopPropagation();setSubOn(!subOn);};
  const togglePlay=e=>{e.stopPropagation();if(vRef.current){playing?vRef.current.pause():vRef.current.play().catch(()=>{});setPlaying(!playing);}};
  const triggerFS=async e=>{e.stopPropagation();try{if(document.fullscreenElement)await document.exitFullscreen();else if(cRef.current?.requestFullscreen)await cRef.current.requestFullscreen();else if(vRef.current?.webkitEnterFullscreen)vRef.current.webkitEnterFullscreen();else setCssFS(!cssFS);}catch{setCssFS(!cssFS);}if(onFullscreen)onFullscreen();};
  const triggerPiP=async e=>{e.stopPropagation();try{if(vRef.current&&document.pictureInPictureEnabled)document.pictureInPictureElement?await document.exitPictureInPicture():await vRef.current.requestPictureInPicture();}catch{}};
  const refresh=e=>{e.stopPropagation();if(hlsRef.current)hlsRef.current.destroy();load();};

  if(error||channel.type!=='m3u8')return(
    <div ref={cRef} className={cn("flex flex-col bg-[#0a0a0a] overflow-hidden shadow-xl border h-full w-full cursor-pointer rounded-xl md:rounded-2xl",isFocused?"border-[#19446C] ring-2 ring-[#19446C]/50":"border-white/5")} onClick={e=>{e.stopPropagation();if(onSetFocus)onSetFocus(channel.id);}}>
      <div className="relative flex-1 flex items-center justify-center bg-[#111] p-2 md:p-4 overflow-hidden">
        <div className={cn("bg-white rounded-xl shadow-2xl flex items-center justify-center flex-col z-20",isMain?"p-4 md:p-5 gap-3":"p-2 md:p-3 gap-1.5")}>
          <img src={channel.logo} className={cn("object-contain",isMain?"w-12 h-12 md:w-16 md:h-16":"w-8 h-8")} alt={channel.name}/>
          {isMain&&<button onMouseDown={e=>e.stopPropagation()} onClick={refresh} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-black rounded-lg font-bold text-xs flex items-center gap-2"><RefreshCw className="w-3 h-3"/>Retry</button>}
        </div>
        {isMain&&<span className="absolute bottom-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest pointer-events-none z-10">Stream Unavailable</span>}
      </div>
    </div>
  );
  return (
    <div ref={cRef} className={cn("relative flex flex-col bg-black overflow-hidden transition-all duration-300 group cursor-pointer",cssFS?"!fixed !inset-0 !z-[99999] !w-[100vw] !h-[100vh] !rounded-none !m-0 !p-0":"w-full h-full rounded-2xl md:rounded-3xl",hasAudio&&!cssFS&&!isMain?"ring-2 ring-[#19446C] border-[#19446C] z-50":"border border-white/10 hover:border-white/30")} onClick={e=>{e.stopPropagation();if(onSetFocus&&!isMain)onSetFocus(channel.id);}}>
      <video ref={vRef} muted={!hasAudio} playsInline className={cn("absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-1000",hasVideo?"opacity-100":"opacity-0")}/>
      {!hasVideo&&<div className="absolute inset-0 flex items-center justify-center bg-black"><div className="w-8 h-8 border-4 border-[#19446C]/50 border-t-[#19446C] rounded-full animate-spin"/></div>}
      {subOn&&cues.length>0&&(
        <div className="absolute inset-x-0 z-[45] flex flex-col items-center justify-end pointer-events-none px-4 md:px-12 text-center bottom-8 md:bottom-12" style={{fontFamily:ccSettings?.font,fontSize:ccSettings?.size,color:ccSettings?.color}}>
          {cues.map((t,i)=>(
            <div key={t+i} className={cn("flex flex-col items-center gap-1",ccSettings?.animation!=='none'?`cc-anim-${ccSettings.animation}`:"")}>
              {t.replace(/<[^>]+>/g,'').split('\n').map((l,j)=>(
                <span key={j} className="inline-block px-4 py-1.5 md:px-5 md:py-2 rounded-xl md:rounded-2xl max-w-[90%]" style={{backgroundColor:ccSettings?.bg,backdropFilter:ccSettings?.bg!=='transparent'?'blur(12px)':'none',textShadow:getTextShadow(ccSettings?.edgeStyle),fontWeight:600,lineHeight:1.4,marginTop:j>0?'4px':'0'}}>{l}</span>
              ))}
            </div>
          ))}
        </div>
      )}
      {!isMain&&<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"/>}
      {isMain&&<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none z-10 opacity-0 group-hover:opacity-100"/>}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 opacity-0 group-hover:opacity-100">
        <button type="button" onMouseDown={e=>e.stopPropagation()} onClick={togglePlay} className={cn("bg-black/60 backdrop-blur-xl text-white rounded-full pointer-events-auto hover:bg-white hover:text-black shadow-2xl border border-white/10 outline-none flex items-center justify-center",isMain?"p-3 md:p-4 w-12 h-12 md:w-16 md:h-16":"p-2 w-8 h-8 md:w-10 md:h-10")}>{playing?<Pause className={cn("fill-current",isMain?"w-5 h-5 md:w-8 md:h-8":"w-4 h-4")}/>:<Play className={cn("fill-current",isMain?"w-5 h-5 md:w-8 md:h-8 ml-1":"w-4 h-4 ml-0.5")}/>}</button>
      </div>
      {isMain&&(
        <div className="absolute top-4 right-4 flex items-center gap-2 z-30 pointer-events-auto opacity-0 group-hover:opacity-100">
          {document.pictureInPictureEnabled&&<button type="button" onMouseDown={e=>e.stopPropagation()} onClick={triggerPiP} className="p-2 bg-black/60 backdrop-blur-xl hover:bg-[#19446C] rounded-full text-white transition-all border border-white/10 outline-none"><PictureInPicture className="w-4 h-4 md:w-5 md:h-5"/></button>}
          {showFullscreenButton&&<button type="button" onMouseDown={e=>e.stopPropagation()} onClick={triggerFS} className="p-2 bg-black/60 backdrop-blur-xl hover:bg-[#19446C] rounded-full text-white transition-all border border-white/10 outline-none">{cssFS?<Minimize className="w-4 h-4 md:w-5 md:h-5"/>:<Maximize className="w-4 h-4 md:w-5 md:h-5"/>}</button>}
        </div>
      )}
      <div className={cn("absolute z-30 pointer-events-none opacity-0 group-hover:opacity-100",isMain?"bottom-2 md:bottom-4 left-2 md:left-4":"top-2 left-2")}>
        <div className="flex items-center pointer-events-auto">
          <div className="flex items-center gap-1.5 md:gap-2 bg-black/60 backdrop-blur-xl p-1 md:p-1.5 rounded-lg border border-white/10 shadow-lg">
            <div className="bg-white/95 p-1 rounded shrink-0 flex items-center justify-center"><img src={channel.logo} className={cn("object-contain",isMain?"w-8 h-4 md:w-10 md:h-5":"w-5 h-3 md:w-6 md:h-4")} alt=""/></div>
            {isMain&&<span className="font-bold text-white truncate text-[10px] md:text-xs pr-1 md:pr-2">{channel.name}</span>}
          </div>
        </div>
      </div>
      <div className="absolute bottom-2 md:bottom-4 right-2 md:right-4 flex items-center gap-0.5 md:gap-1 z-30 pointer-events-auto bg-black/60 backdrop-blur-xl p-1 rounded-full border border-white/10 opacity-0 group-hover:opacity-100">
        <button type="button" onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();if(onRequestAudio)onRequestAudio(channel.id);}} className={cn("p-1.5 rounded-full transition-colors outline-none",hasAudio?"bg-[#19446C] text-white":"text-white hover:bg-white/20")}>{hasAudio?<Volume2 className="w-3 h-3 md:w-4 md:h-4"/>:<VolumeX className="w-3 h-3 md:w-4 md:h-4"/>}</button>
        {hasAudio&&isMain&&<div className="w-16 md:w-20 px-1.5 hidden sm:flex items-center"><input type="range" min="0" max="1" step=".05" value={volume} onMouseDown={e=>e.stopPropagation()} onChange={e=>onVolumeChange(parseFloat(e.target.value))} className="w-full accent-white cursor-pointer"/></div>}
        {subAvail&&isMain&&<button type="button" onMouseDown={e=>e.stopPropagation()} onClick={toggleCC} className={cn("p-1.5 rounded-full outline-none",subOn?"bg-[#19446C] text-white":"text-white hover:bg-white/20")}><Subtitles className="w-3 h-3 md:w-4 md:h-4"/></button>}
        <button type="button" onMouseDown={e=>e.stopPropagation()} onClick={refresh} className="p-1.5 rounded-full text-white hover:bg-white/20 outline-none"><RefreshCw className="w-3 h-3 md:w-4 md:h-4"/></button>
      </div>
    </div>
  );
});

// ─── LIVE TV VIEW (FIX: focus mode button fixed) ─────────────────────────────
const LiveTvView = React.memo(({focusMode,setFocusMode,ccSettings})=>{
  const [viewMode,setViewMode]=useLocalStorage('onyx_livetv_mode','grid');
  const [gridCols,setGridCols]=useLocalStorage('onyx_livetv_cols',3);
  const [focusedId,setFocusedId]=useState(LIVE_CHANNELS[0].id);
  const [audioIds,setAudioIds]=useState([LIVE_CHANNELS[0].id]);
  const [vol,setVol]=useLocalStorage('onyx_livetv_vol',1);
  const [order,setOrder]=useLocalStorage('onyx_livetv_order',LIVE_CHANNELS.map(c=>c.id));
  const [dragIdx,setDragIdx]=useState(null),[overIdx,setOverIdx]=useState(null),[dragPos,setDragPos]=useState(null);

  useEffect(()=>{const cur=LIVE_CHANNELS.map(c=>c.id),valid=order.filter(id=>cur.includes(id)),miss=cur.filter(id=>!valid.includes(id));if(miss.length||valid.length!==order.length)setOrder([...valid,...miss]);},[]);
  const reqAudio=useCallback(id=>setAudioIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]),[]);
  const setFocus=useCallback(id=>{setFocusedId(id);setAudioIds([id]);if(viewMode==='grid')setViewMode('sidebar');},[viewMode,setViewMode]);
  const dStart=(e,i)=>{setDragIdx(i);e.dataTransfer.effectAllowed="move";};
  const dOver=(e,i)=>{e.preventDefault();const r=e.currentTarget.getBoundingClientRect(),p=(e.clientX-r.left)<r.width/2?'left':'right';if(overIdx!==i||dragPos!==p){setOverIdx(i);setDragPos(p);}};
  const dDrop=(e,di)=>{e.preventDefault();const p=dragPos;setOverIdx(null);setDragPos(null);if(dragIdx===null||dragIdx===di)return;const nc=[...order],it=nc.splice(dragIdx,1)[0];let ti=di;if(dragIdx<di&&p==='left')ti=di-1;if(dragIdx>di&&p==='right')ti=di+1;nc.splice(ti,0,it);setOrder(nc);setDragIdx(null);};
  const main=useMemo(()=>LIVE_CHANNELS.find(c=>c.id===focusedId)||LIVE_CHANNELS[0],[focusedId]);

  const grid=()=>order.map((cid,i)=>{
    const ch=LIVE_CHANNELS.find(c=>c.id===cid);
    if(!ch||(viewMode==='sidebar'&&ch.id===focusedId))return null;
    return(
      <div key={ch.id} draggable onDragStart={e=>dStart(e,i)} onDragOver={e=>dOver(e,i)} onDragLeave={()=>{setOverIdx(null);setDragPos(null);}} onDrop={e=>dDrop(e,i)} className={cn("h-full w-full aspect-video relative transition-all duration-300",i===dragIdx&&"opacity-40 scale-95")}>
        {overIdx===i&&dragPos==='left'&&<div className="absolute -left-2 md:-left-3 top-0 bottom-0 w-1.5 md:w-2 bg-[#19446C] z-50 rounded-full shadow-[0_0_15px_#19446C]"/>}
        {overIdx===i&&dragPos==='right'&&<div className="absolute -right-2 md:-right-3 top-0 bottom-0 w-1.5 md:w-2 bg-[#19446C] z-50 rounded-full shadow-[0_0_15px_#19446C]"/>}
        <MiniLiveStream channel={ch} isMain={false} isFocused={ch.id===focusedId} onSetFocus={setFocus} hasAudio={audioIds.includes(ch.id)} onRequestAudio={reqAudio} volume={vol} onVolumeChange={setVol} showFullscreenButton={false} ccSettings={ccSettings}/>
      </div>
    );
  });

  return (
    <div className={cn("bg-black animate-in fade-in duration-700 flex flex-col transition-all ease-out px-4 md:px-8 lg:px-12 xl:px-16 max-w-[1800px] mx-auto",focusMode?"pt-4 md:pt-6":"pt-24 md:pt-32",(viewMode==='sidebar'||viewMode==='single')?"h-screen overflow-hidden pb-4":"min-h-screen pb-32")}>
      <div className={cn("flex items-center justify-end gap-3 md:gap-4 w-full shrink-0 py-1",focusMode?"mb-4":"mb-6 md:mb-8 mt-2")}>
        {viewMode==='grid'&&(
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-2xl px-4 py-2.5 rounded-full border border-white/10 shadow-lg">
            <span className="text-[11px] font-semibold text-white/70 uppercase tracking-widest hidden sm:block">Cols</span>
            <input type="range" min="1" max="6" value={gridCols} onChange={e=>setGridCols(parseInt(e.target.value))} className="w-16 md:w-20 accent-white cursor-pointer"/>
            <span className="text-xs font-bold text-white w-5 text-center">{gridCols}</span>
          </div>
        )}
        <div className="bg-white/10 backdrop-blur-2xl p-1.5 rounded-full flex gap-2 border border-white/10 shadow-lg">
          {[['grid',<LayoutGrid key="g" className="w-4 h-4"/>,'Grid'],['sidebar',<Sidebar key="s" className="w-4 h-4"/>,'Presenter'],['single',<Square key="sq" className="w-4 h-4"/>,'Single']].map(([mode,icon,label])=>(
            <button key={mode} onClick={()=>setViewMode(mode)} className={cn("px-5 py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all outline-none flex items-center gap-2 whitespace-nowrap",viewMode===mode?"bg-white text-black shadow-md":"text-white/70 hover:text-white hover:bg-white/20")}>{icon}{label}</button>
          ))}
          <div className="w-px h-6 bg-white/20 mx-1 self-center hidden sm:block"/>
          {/* FIX: stopPropagation prevents settings tab from activating */}
          <button onClick={e=>{e.preventDefault();e.stopPropagation();setFocusMode(v=>!v);}} className={cn("px-5 py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all outline-none flex items-center gap-2 whitespace-nowrap",focusMode?"bg-[#19446C] text-white shadow-md":"text-white/70 hover:text-white hover:bg-white/20")}>
            {focusMode?<Minimize className="w-4 h-4"/>:<Maximize className="w-4 h-4"/>}Focus
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0 w-full relative z-10">
        {viewMode==='sidebar'&&(
          <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0">
            <div className="flex-1 flex flex-col relative min-h-0 rounded-3xl overflow-hidden shadow-2xl">
              <MiniLiveStream channel={main} isMain={true} isFocused={true} hasAudio={audioIds.includes(main.id)} onRequestAudio={reqAudio} volume={vol} onVolumeChange={setVol} showFullscreenButton={false} ccSettings={ccSettings}/>
            </div>
            <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 overflow-y-auto flex flex-row lg:flex-col gap-4 pb-4 lg:pb-0 px-1 pt-1 min-h-[160px] lg:min-h-0">{grid()}</div>
          </div>
        )}
        {viewMode==='single'&&(
          <div className="flex flex-col flex-1 min-h-0 w-full relative group bg-black overflow-hidden shadow-2xl rounded-3xl">
            <div className="absolute top-6 left-6 z-50 pointer-events-auto opacity-0 group-hover:opacity-100">
              <select value={main.id} onChange={e=>setFocus(e.target.value)} className="custom-select bg-black/60 text-white backdrop-blur-3xl border border-white/20 rounded-full px-6 py-3 outline-none cursor-pointer text-sm font-semibold pr-12">
                {LIVE_CHANNELS.map(c=><option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}
              </select>
            </div>
            <MiniLiveStream channel={main} isMain={true} isFocused={true} hasAudio={audioIds.includes(main.id)} onRequestAudio={reqAudio} volume={vol} onVolumeChange={setVol} showFullscreenButton={true} ccSettings={ccSettings}/>
          </div>
        )}
        {viewMode==='grid'&&(
          <div className={cn("grid gap-4 lg:gap-6 overflow-y-auto pb-32 pt-2 px-1 h-full min-h-0 place-items-center w-full",gridCols===1?"grid-cols-1 w-full md:w-3/4 lg:w-2/3 xl:w-1/2 mx-auto":gridCols===2?"grid-cols-2":gridCols===3?"grid-cols-2 md:grid-cols-3":gridCols===4?"grid-cols-2 md:grid-cols-4":gridCols===5?"grid-cols-3 md:grid-cols-5":"grid-cols-3 md:grid-cols-6 lg:grid-cols-8")}>{grid()}</div>
        )}
      </div>
    </div>
  );
});

// ─── LIVE SPORTS ─────────────────────────────────────────────────────────────
const fmtSport=n=>{if(!n)return'';const m={football:'Soccer','american-football':'American Football',basketball:'Basketball',baseball:'Baseball',hockey:'Hockey',tennis:'Tennis',mma:'MMA',boxing:'Boxing',cricket:'Cricket',rugby:'Rugby','motor-sports':'Motorsports',darts:'Darts',snooker:'Snooker',golf:'Golf'};return m[n.toLowerCase()]||n.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');};
const rScore=s=>{if(s==null)return'';if(typeof s==='object')return String(s.current||s.display||s.total||'');return String(s);};

const SportsMatchCard=React.memo(({match,isLive,fmtTime,onPlay,playingId,mounted})=>(
  <div onClick={()=>{onPlay(match).finally(()=>{if(mounted.current)onPlay(null);});}} className="bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-3xl p-6 cursor-pointer transition-all duration-300 flex flex-col min-h-[170px] relative group border border-white/10 hover:border-white/30 shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-[#19446C]" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onPlay(match);}}>
    <div className="flex justify-between items-center mb-4">
      <span className="text-[12px] font-semibold text-white/60 uppercase tracking-widest">{fmtSport(match.category)}</span>
      {isLive?<div className="flex items-center gap-1.5 bg-red-500 text-white px-2.5 py-1 rounded-md"><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/><span className="text-[10px] font-bold tracking-widest uppercase">Live</span></div>:<span className="text-[11px] font-semibold text-white/60">{fmtTime(match.date)}</span>}
    </div>
    {match.teams?.home&&match.teams?.away?(
      <div className="flex flex-col gap-3">
        {[match.teams.away,match.teams.home].map((t,i)=>(
          <div key={i} className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 shrink-0 bg-white/10 rounded-full flex items-center justify-center p-1.5 border border-white/5">
                {t.badge?<img src={`https://streamed.pk/api/images/badge/${t.badge}.webp`} className="w-full h-full object-contain" alt={t.name} onError={e=>{e.target.style.display='none';if(e.target.nextSibling)e.target.nextSibling.style.display='block';}}/>:null}
                <span className="text-xs font-bold text-white/50" style={{display:t.badge?'none':'block'}}>{t.name?.charAt(0)||'?'}</span>
              </div>
              <span className="text-white font-semibold text-lg md:text-xl tracking-tight line-clamp-1">{t.name}</span>
            </div>
            <span className="text-white/90 font-bold text-xl md:text-2xl tabular-nums ml-4">{match.score?rScore(i===0?match.score.away:match.score.home):''}</span>
          </div>
        ))}
      </div>
    ):<div className="flex flex-1 items-center mt-2"><h3 className="text-white font-semibold text-lg md:text-xl line-clamp-2">{String(match.title||match.name)}</h3></div>}
    {playingId===match.id&&<div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-xl flex items-center justify-center rounded-3xl"><div className="w-10 h-10 border-4 border-[#19446C]/50 border-t-[#19446C] rounded-full animate-spin"/></div>}
  </div>
));

const LiveSportsView=React.memo(({onPlaySport})=>{
  const [all,setAll]=useState([]),[loading,setLoading]=useState(true),[playingId,setPlayingId]=useState(null),[cat,setCat]=useState('All');
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const fmtTime=useCallback(d=>{const dt=new Date(d),t=new Date(),tmr=new Date(t);tmr.setDate(tmr.getDate()+1);const ts=dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(dt.toDateString()===t.toDateString())return`Today, ${ts}`;if(dt.toDateString()===tmr.toDateString())return`Tomorrow, ${ts}`;return`${dt.toLocaleDateString([],{month:'short',day:'numeric'})}, ${ts}`;},[]);
  const isLive=useCallback(d=>{const n=Date.now(),m=new Date(d).getTime();return n>=m&&n<=m+10800000;},[]);
  const score=useCallback(m=>{let s=0;const t=`${m.title} ${m.teams?.home?.name} ${m.teams?.away?.name}`.toLowerCase();if(t.match(/(maple leafs|raptors|blue jays|toronto fc|argonauts|toronto)/))s+=1000;else if(t.match(/(canadiens|canucks|oilers|flames|senators|jets|montreal|vancouver|edmonton|calgary|ottawa|winnipeg)/))s+=500;return s;},[]);
  useEffect(()=>{
    let ok=true; setLoading(true);
    (async()=>{
      try{
        const data=await fetchWithCache('https://streamed.pk/api/matches/all');if(!ok)return;
        let md=[];if(Array.isArray(data))md=data;else Object.values(data).forEach(v=>{if(Array.isArray(v))md.push(...v);});
        const um=new Map();
        md.forEach(m=>{let k=(m.teams?.home?.name&&m.teams?.away?.name)?[m.teams.home.name.toLowerCase().trim(),m.teams.away.name.toLowerCase().trim()].sort().join('-vs-'):(m.title||m.name||'').toLowerCase().trim();if(!k)return;const ex=um.get(k),hb=!!(m.teams?.home?.badge||m.teams?.away?.badge),ehb=!!(ex?.teams?.home?.badge||ex?.teams?.away?.badge);if(!ex||(hb&&!ehb)||(hb&&ehb&&m.poster&&!ex.poster))um.set(k,m);});
        setAll(Array.from(um.values()));
      }catch(e){console.error(e);}
      if(ok)setLoading(false);
    })();
    return()=>{ok=false;};
  },[]);
  const sports=useMemo(()=>{const r=new Set(all.map(m=>m.category).filter(Boolean)),p=['Basketball','Baseball','Hockey','Soccer','American Football','Football','Tennis'];return['All',...Array.from(new Set(Array.from(r).map(fmtSport))).sort((a,b)=>{const ia=p.indexOf(a),ib=p.indexOf(b);if(ia!==-1&&ib!==-1)return ia-ib;if(ia!==-1)return-1;if(ib!==-1)return 1;return a.localeCompare(b);})]},[all]);
  const sorted=useMemo(()=>(cat==='All'?all:all.filter(m=>fmtSport(m.category)===cat)).sort((a,b)=>{const al=isLive(a.date),bl=isLive(b.date);if(al&&!bl)return-1;if(!al&&bl)return 1;const sa=score(a),sb=score(b);if(sa!==sb)return sb-sa;return new Date(a.date)-new Date(b.date);}),[all,cat,isLive,score]);
  const play=m=>{if(!m){setPlayingId(null);return Promise.resolve();}setPlayingId(m.id);return onPlaySport(m);};
  return (
    <div className="pt-24 md:pt-32 px-4 md:px-8 lg:px-12 xl:px-16 min-h-screen w-full bg-black animate-in fade-in duration-700 max-w-[1800px] mx-auto pb-32">
      <div className="flex gap-3 overflow-x-auto pb-2 fade-edge-right mb-8 mt-2">
        {sports.map(s=><button key={s} onClick={()=>setCat(s)} className={cn("px-6 py-2.5 rounded-full font-semibold text-sm transition-all whitespace-nowrap outline-none",cat===s?"bg-white text-black shadow-md":"bg-white/10 text-white/70 hover:bg-white/20 hover:text-white border border-white/5")}>{s}</button>)}
      </div>
      {loading?<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">{[...Array(8)].map((_,i)=><div key={i} className="h-48 bg-white/5 rounded-3xl animate-pulse border border-white/5"/>)}</div>
      :sorted.length>0?<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">{sorted.map(m=><SportsMatchCard key={m.id} match={m} isLive={isLive(m.date)} fmtTime={fmtTime} onPlay={play} playingId={playingId} mounted={mounted}/>)}</div>
      :<div className="flex flex-col items-center justify-center py-24 text-white/50 bg-white/5 rounded-3xl border border-white/10"><Dribbble className="w-16 h-16 mb-6 opacity-30"/><p className="text-xl font-medium">No matches available right now.</p></div>}
    </div>
  );
});

// ─── SKIP BUTTON (TheIntroDB) ────────────────────────────────────────────────
// Uses an independent JS timer (started on iframe load) to approximate playback
// position — unavoidable with cross-origin iframes. Clicking "skip" reloads the
// player from the segment end time using VidPlus ?progress= parameter.
const SKIP_LABELS = { intro:'Skip Intro', recap:'Skip Recap', credits:'Skip Credits', preview:'Skip Preview' };

const SkipButton = React.memo(({ mediaId, isTv, season, episode, elapsed, onSkip, settings }) => {
  const [timestamps, setTimestamps] = useState(null);
  const [activeSegment, setActiveSegment] = useState(null);
  const [visible, setVisible] = useState(false);
  const [autoSkipped, setAutoSkipped] = useState({});
  const dismissed = useRef({});
  const hideTimer = useRef(null);

  // Fetch timestamps from TheIntroDB
  useEffect(() => {
    if (!settings?.enabled || !mediaId) return;
    let ok = true;
    (async () => {
      try {
        let url = `${INTRODB_BASE}/media?tmdb_id=${mediaId}`;
        if (isTv && season && episode) url += `&season=${season}&episode=${episode}`;
        const d = await fetch(url).then(r => r.json());
        if (ok && d && !d.error) setTimestamps(d);
      } catch (e) { /* silently ignore — no timestamps is fine */ }
    })();
    return () => { ok = false; };
  }, [mediaId, isTv, season, episode, settings?.enabled]);

  // Watch elapsed time and show button when in a segment range
  useEffect(() => {
    if (!timestamps || !settings?.enabled) return;
    const elapsedMs = elapsed * 1000;
    const minConf = settings.minConfidence ?? 0.3;

    const typeMap = [
      ['intro',   settings.showIntro],
      ['recap',   settings.showRecap],
      ['credits', settings.showCredits],
      ['preview', settings.showPreview],
    ];

    let found = null;
    for (const [type, enabled] of typeMap) {
      if (!enabled) continue;
      const segs = timestamps[type];
      if (!segs?.length) continue;
      for (const seg of segs) {
        if ((seg.confidence ?? 1) < minConf) continue;
        const startMs = seg.start_ms ?? 0;
        const endMs   = seg.end_ms;
        if (!endMs) continue; // skip segments with no known end
        const key = `${type}_${startMs}_${endMs}`;
        if (dismissed.current[key]) continue;
        if (elapsedMs >= startMs && elapsedMs <= endMs) {
          found = { type, startMs, endMs, key };
          break;
        }
      }
      if (found) break;
    }

    if (found?.key !== activeSegment?.key) {
      setActiveSegment(found);
      if (found) {
        if (settings.autoSkip && !autoSkipped[found.key]) {
          // Auto-skip: fire immediately
          setAutoSkipped(p => ({ ...p, [found.key]: true }));
          dismissed.current[found.key] = true;
          onSkip(Math.floor(found.endMs / 1000));
        } else {
          setVisible(true);
          clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => setVisible(false), (settings.buttonDuration || 6) * 1000);
        }
      } else {
        setVisible(false);
        clearTimeout(hideTimer.current);
      }
    }
  }, [elapsed, timestamps, settings, activeSegment, autoSkipped, onSkip]);

  // Reset on media change
  useEffect(() => {
    setTimestamps(null);
    setActiveSegment(null);
    setVisible(false);
    setAutoSkipped({});
    dismissed.current = {};
    clearTimeout(hideTimer.current);
  }, [mediaId, season, episode]);

  const handleSkip = () => {
    if (!activeSegment) return;
    dismissed.current[activeSegment.key] = true;
    setVisible(false);
    setActiveSegment(null);
    clearTimeout(hideTimer.current);
    onSkip(Math.floor(activeSegment.endMs / 1000));
  };

  if (!visible || !activeSegment || !settings?.enabled) return null;

  return (
    <div className="absolute bottom-16 md:bottom-20 right-5 md:right-10 z-50 animate-in slide-in-from-right-4 fade-in duration-300">
      <button onClick={handleSkip}
        className="group flex items-center gap-3 bg-black/50 hover:bg-white backdrop-blur-2xl text-white hover:text-black border border-white/30 hover:border-white px-6 py-3 md:px-8 md:py-4 rounded-full font-semibold text-sm md:text-base transition-all shadow-2xl outline-none">
        <span>{SKIP_LABELS[activeSegment.type] || 'Skip'}</span>
        <ChevronRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-0.5 transition-transform"/>
      </button>
    </div>
  );
});

// ─── PLAYER OVERLAY ──────────────────────────────────────────────────────────
// FIX: Back button always visible on hover, VidPlus primary source, TheIntroDB skip,
//      TMDB IDs used directly, ESC to close, source switcher while watching
const PlayerOverlay=({media,config,onClose,sourceKey,vidplusSettings,skipSettings})=>{
  const [loading,setLoading]=useState(true);
  const [showCtrl,setShowCtrl]=useState(true);
  const [activeSource,setActiveSource]=useState(sourceKey);
  const [src,setSrc]=useState('');
  const [skipTime,setSkipTime]=useState(0);     // seconds to start from (for skip)
  const [iframeKey,setIframeKey]=useState(0);   // force iframe remount on skip
  const [elapsed,setElapsed]=useState(0);       // seconds since iframe loaded
  const vRef=useRef(null),ctrlTimer=useRef(null),mounted=useRef(true);
  const elapsedTimer=useRef(null),timerOrigin=useRef(null);

  const isLiveMedia = media.isLive;
  const isTv = !isLiveMedia && (media.media_type==='tv' || (!media.release_date && media.name));
  const cfg = config || {season:1,episode:1};
  const vp = vidplusSettings || DEFAULT_VIDPLUS;

  useEffect(()=>{mounted.current=true;lockScroll();return()=>{mounted.current=false;unlockScroll();};},[]);

  // ESC key closes player
  useEffect(()=>{
    const h=(e)=>{ if(e.key==='Escape')onClose(); };
    window.addEventListener('keydown',h);
    return()=>window.removeEventListener('keydown',h);
  },[onClose]);

  // Build src URL — VidPlus uses vidplusSettings for full customization
  const getSrc = useCallback((sk, startAt=0) => {
    if (isLiveMedia) return media.url || '';
    const id = media.id;
    if (!id) return '';
    const s = cfg.season||1, e = cfg.episode||1;
    switch(sk) {
      case 'vidplus': {
        const p = new URLSearchParams({
          primarycolor:   '19446C',
          secondarycolor: '0d1f30',
          iconcolor:      'FFFFFF',
          icons:          vp.icons || 'lucide',
          poster:         'true',
          title:          'true',
          autoplay:       'true',
          autoNext:       isTv ? String(vp.autoNext !== false) : 'false',
          nextButton:     isTv ? 'true' : 'false',
          episodelist:    isTv ? String(vp.episodeList !== false) : 'false',
          servericon:     String(vp.serverIcon !== false),
          pip:            'true',
          download:       'false',
          watchparty:     'false',
          font:           vp.subtitleFont || 'Inter',
          fontsize:       String(vp.subtitleFontSize || 20),
          opacity:        String(vp.subtitleOpacity ?? 0.5),
          ...(startAt > 0 && { progress: String(Math.floor(startAt)) }),
        }).toString();
        return isTv
          ? `https://player.vidplus.to/embed/tv/${id}/${s}/${e}?${p}`
          : `https://player.vidplus.to/embed/movie/${id}?${p}`;
      }
      case 'autoembed':
        return isTv ? `https://autoembed.cc/tv/tmdb/${id}-${s}-${e}` : `https://autoembed.cc/movie/tmdb/${id}`;
      case 'vidlink': {
        const p = new URLSearchParams({primaryColor:'19446C',secondaryColor:'111111',iconColor:'ffffff',icons:'vid',title:'false',poster:'true',autoplay:'true',nextbutton:isTv?'true':'false'}).toString();
        return isTv ? `https://vidlink.pro/tv/${id}/${s}/${e}?${p}` : `https://vidlink.pro/movie/${id}?${p}`;
      }
      case 'vidsrc':
        return isTv ? `https://vidsrc.net/embed/tv?tmdb=${id}&season=${s}&episode=${e}` : `https://vidsrc.net/embed/movie?tmdb=${id}`;
      case 'embedsu':
        return isTv ? `https://embed.su/embed/tv/${id}/${s}/${e}` : `https://embed.su/embed/movie/${id}`;
      case 'vidsrcicu':
        return isTv ? `https://vidsrc.icu/embed/tv/${id}/${s}/${e}` : `https://vidsrc.icu/embed/movie/${id}`;
      default:
        return isTv
          ? `https://player.vidplus.to/embed/tv/${id}/${s}/${e}`
          : `https://player.vidplus.to/embed/movie/${id}`;
    }
  },[isLiveMedia,isTv,media,cfg,vp]);

  // Rebuild src when source changes (reset skip/timer)
  useEffect(()=>{
    setSrc(getSrc(activeSource, 0));
    setSkipTime(0);
    setLoading(true);
    setElapsed(0);
    clearInterval(elapsedTimer.current);
  },[activeSource,getSrc]);

  // Elapsed timer — starts (or restarts) when iframe loads
  const startElapsedTimer = useCallback((fromSeconds=0) => {
    clearInterval(elapsedTimer.current);
    timerOrigin.current = Date.now() - fromSeconds * 1000;
    elapsedTimer.current = setInterval(() => {
      if (mounted.current) setElapsed(Math.floor((Date.now() - timerOrigin.current) / 1000));
    }, 500);
  },[]);
  useEffect(()=>()=>clearInterval(elapsedTimer.current),[]);

  // Handle skip: reload iframe from end of segment
  const handleSkip = useCallback((endSeconds) => {
    if (!mounted.current) return;
    setSkipTime(endSeconds);
    setSrc(getSrc(activeSource, endSeconds));
    setIframeKey(k => k + 1);
    setLoading(true);
    startElapsedTimer(endSeconds);
    setElapsed(endSeconds);
  },[activeSource,getSrc,startElapsedTimer]);

  // Auto-hide spinner after 8s (iframes don't fire onLoad reliably for all sources)
  useEffect(()=>{
    const t = setTimeout(()=>{ if(mounted.current) setLoading(false); }, 8000);
    return ()=>clearTimeout(t);
  },[src]);

  // HLS for live streams
  useEffect(()=>{
    if(!isLiveMedia||!src?.includes?.('.m3u8'))return;
    let hls;
    const load=()=>{
      if(mounted.current)setLoading(false);
      const v=vRef.current; if(!v)return;
      hls=initHls(v,src,true,{
        onParsed:()=>v.play().catch(()=>{}),
        onError:(e,d)=>{if(d.fatal){if(d.type===window.Hls?.ErrorTypes?.NETWORK_ERROR&&hls)hls.startLoad();else if(d.type===window.Hls?.ErrorTypes?.MEDIA_ERROR&&hls)hls.recoverMediaError();else if(hls)hls.destroy();}}
      });
    };
    loadHlsScript(load);
    return()=>{ if(hls)hls.destroy(); };
  },[isLiveMedia,src]);

  // Auto-hide controls
  const mMove=useCallback(()=>{
    if(mounted.current)setShowCtrl(true);
    clearTimeout(ctrlTimer.current);
    ctrlTimer.current=setTimeout(()=>{ if(mounted.current)setShowCtrl(false); },3500);
  },[]);
  useEffect(()=>{
    window.addEventListener('mousemove',mMove);
    window.addEventListener('touchstart',mMove);
    ctrlTimer.current=setTimeout(()=>{ if(mounted.current)setShowCtrl(false); },3500);
    return()=>{ window.removeEventListener('mousemove',mMove); window.removeEventListener('touchstart',mMove); clearTimeout(ctrlTimer.current); };
  },[mMove]);

  const isSportStream = isLiveMedia && media.type === 'iframe';
  const showSkip = !isLiveMedia && skipSettings?.enabled;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-500 font-sans hardware-accel">
      {/* Loading spinner */}
      {loading&&(
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20 pointer-events-none">
          <div className="w-12 h-12 border-4 border-[#19446C]/50 border-t-[#19446C] rounded-full animate-spin"/>
        </div>
      )}

      {/* Top gradient */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/90 to-transparent z-40 pointer-events-none transition-opacity duration-500" style={{opacity:showCtrl?1:0}}/>

      {/* Controls bar */}
      <div className={cn("absolute top-0 left-0 w-full p-4 md:p-8 flex items-start justify-between z-50 transition-opacity duration-300 pointer-events-none",showCtrl?"opacity-100 pointer-events-auto":"opacity-0")}>
        <button onClick={onClose}
          className="flex items-center gap-2 text-white bg-white/10 hover:bg-white px-6 py-3 rounded-full backdrop-blur-2xl transition-all border border-white/20 shadow-2xl group outline-none hover:text-black">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform"/>
          <span className="text-sm font-semibold">Back</span>
        </button>

        {isLiveMedia&&(
          <div className="absolute left-1/2 -translate-x-1/2 top-6 flex items-center gap-2 bg-black/60 backdrop-blur-2xl border border-white/10 px-4 py-2 rounded-full">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"/>
            <span className="text-xs font-semibold text-white uppercase tracking-widest">{String(media.name||'Live')}</span>
          </div>
        )}

        {!isLiveMedia&&(
          <div className="flex items-center gap-2 flex-wrap justify-end max-w-xs">
            {Object.entries(SOURCES).map(([k,v])=>(
              <button key={k} onClick={()=>setActiveSource(k)}
                className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold transition-all outline-none border whitespace-nowrap",
                  activeSource===k?"bg-white text-black border-white shadow-lg":"bg-black/50 text-white/60 border-white/20 hover:border-white/50 hover:text-white backdrop-blur-xl")}>
                {v.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Video area */}
      <div className="flex-1 w-full h-full relative bg-black">
        {isSportStream&&(
          <iframe src={src} className="w-full h-full border-0 relative z-10 bg-black" allowFullScreen
            allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;fullscreen"
            onLoad={()=>{ if(mounted.current)setLoading(false); }}/>
        )}
        {isLiveMedia&&media.type==='livehdtv'&&(
          <iframe src={src} className="w-full h-full border-0 relative z-10 bg-black" allowFullScreen
            allow="autoplay;encrypted-media;gyroscope;picture-in-picture;fullscreen"
            onLoad={()=>{ if(mounted.current)setLoading(false); }}/>
        )}
        {isLiveMedia&&src?.includes?.('.m3u8')&&(
          <video ref={vRef} controls autoPlay playsInline className="w-full h-full border-0 relative z-10 bg-black outline-none"/>
        )}
        {!isLiveMedia&&(
          <iframe key={iframeKey} src={src} className="w-full h-full border-0 relative z-10 bg-black" allowFullScreen
            allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;fullscreen"
            title="Video Player"
            onLoad={()=>{ if(mounted.current){ setLoading(false); startElapsedTimer(skipTime); } }}/>
        )}
      </div>

      {/* Skip button overlay */}
      {showSkip&&(
        <SkipButton
          mediaId={media.id}
          isTv={isTv}
          season={cfg.season}
          episode={cfg.episode}
          elapsed={elapsed}
          onSkip={handleSkip}
          settings={skipSettings}
        />
      )}
    </div>
  );
};

// ─── SEARCH VIEW ─────────────────────────────────────────────────────────────
const SearchView=React.memo(({apiKey,geminiApiKey,history,onMediaClick,onPlaySport,onPlay})=>{
  const [mode,setMode]=useState('standard');
  const [q,setQ]=useState('');
  const dq=useDebounce(q,500);
  const [results,setResults]=useState([]),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(true),[isLoading,setIsLoading]=useState(true),[init,setInit]=useState(true);
  const [fType,setFType]=useState('all'),[fGenre,setFGenre]=useState('all'),[fYear,setFYear]=useState('all'),[fRating,setFRating]=useState('all'),[fSort,setFSort]=useState('popularity.desc');
  const [aiP,setAiP]=useState(''),[aiLoad,setAiLoad]=useState(false),[aiResp,setAiResp]=useState(null),[aiErr,setAiErr]=useState('');
  const obs=useRef();

  useEffect(()=>{if(mode!=='standard')return;setResults([]);setPage(1);setHasMore(true);setInit(true);},[dq,fType,fGenre,fYear,fRating,fSort,mode]);
  useEffect(()=>{
    let ok=true;if(mode!=='standard')return;
    const run=async()=>{
      setIsLoading(true);
      try{
        let nr=[],tp=1;
        if(!dq){
          const build=(t,pg)=>{let u=`${BASE_URL}/discover/${t}?api_key=${apiKey}&sort_by=${fSort}&page=${pg}`;if(fGenre!=='all')u+=`&with_genres=${fGenre}`;if(fRating!=='all')u+=`&vote_average.gte=${fRating}`;if(fYear!=='all'){const[s,e]=fYear.split('-');u+=t==='movie'?`&primary_release_date.gte=${s}-01-01&primary_release_date.lte=${e}-12-31`:`&first_air_date.gte=${s}-01-01&first_air_date.lte=${e}-12-31`;}return u;};
          const urls=[];if(fType==='all'||fType==='movie'){urls.push({url:build('movie',page),type:'movie'},{url:build('movie',page+1),type:'movie'});}if(fType==='all'||fType==='tv'){urls.push({url:build('tv',page),type:'tv'},{url:build('tv',page+1),type:'tv'});}
          const rs=await Promise.all(urls.map(u=>fetchWithCache(u.url).then(d=>({d,type:u.type}))));if(!ok)return;
          rs.forEach(r=>{if(r.d.results){nr.push(...r.d.results.map(i=>({...i,media_type:i.media_type||r.type})).filter(i=>i.poster_path));tp=Math.max(tp,r.d.total_pages||1);}});
        }else{
          const cq=dq.toLowerCase().replace(/ movies?| films?| shows?| series/g,'').trim();
          const rs=await Promise.all([1,2,3].map(n=>fetchWithCache(`${BASE_URL}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(cq)}&include_adult=false&page=${page+n-1}`)));if(!ok)return;
          rs.forEach(d=>{if(d.results){let v=d.results.filter(i=>(i.media_type==='movie'||i.media_type==='tv')&&i.poster_path);if(fType!=='all')v=v.filter(i=>i.media_type===fType);if(fGenre!=='all')v=v.filter(i=>i.genre_ids?.includes(parseInt(fGenre)));if(fRating!=='all')v=v.filter(i=>i.vote_average>=parseFloat(fRating));if(fYear!=='all'){const[s,e]=fYear.split('-');v=v.filter(i=>{const y=parseInt((i.release_date||i.first_air_date||'0').split('-')[0]);return y>=parseInt(s)&&y<=parseInt(e);});}nr.push(...v);tp=Math.max(tp,d.total_pages||1);}});
        }
        setResults(prev=>{const c=page===1?nr:[...prev,...nr];return Array.from(new Map(c.map(i=>[i.id,i])).values()).sort((a,b)=>fSort==='vote_average.desc'?(b.vote_average||0)-(a.vote_average||0):fSort==='primary_release_date.desc'?new Date(b.release_date||b.first_air_date||'1970').getTime()-new Date(a.release_date||a.first_air_date||'1970').getTime():(b.popularity||0)-(a.popularity||0));});
        if(page+(dq?3:2)-1>=tp||page>=40)setHasMore(false);
      }catch(e){console.error(e);}finally{if(ok){setIsLoading(false);setInit(false);}}
    };
    run(); return()=>{ok=false;};
  },[dq,apiKey,fType,fGenre,fYear,fRating,fSort,page,mode]);

  const lastRef=useCallback(node=>{
    if(isLoading||mode!=='standard')return;
    if(obs.current)obs.current.disconnect();
    obs.current=new IntersectionObserver(e=>{if(e[0].isIntersecting&&hasMore)setPage(p=>p+(dq?3:2));},{rootMargin:'800px'});
    if(node)obs.current.observe(node);
  },[isLoading,hasMore,dq,mode]);

  const hasF=fType!=='all'||fGenre!=='all'||fYear!=='all'||fRating!=='all'||fSort!=='popularity.desc';

  // FIX: AI search using Gemini 2.0 Flash API
  const handleAiSubmit = async(e) => {
    e.preventDefault();
    if(!aiP.trim()||aiLoad)return;
    setAiLoad(true);setAiErr('');setAiResp(null);
    const key = geminiApiKey || 'AIzaSyDemo'; // user-supplied key
    if(!geminiApiKey){
      setAiErr('Please add your Gemini API key in Settings to use AI Search.');
      setAiLoad(false);
      return;
    }
    try{
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          contents:[{parts:[{text:`User request: "${aiP}"\nRecent watch history: ${history.slice(0,15).map(h=>h.title||h.name).join(', ')||'none'}\n\nRespond with JSON only. Return up to 6 relevant recommendations. For each item include: type ("movie" or "tv"), search_query (title to search), and literal_reason (1 sentence why).`}]}],
          systemInstruction:{parts:[{text:`You are a streaming media recommendation assistant. Always output valid JSON with a "text_response" string and "items" array. Today is ${new Date().toLocaleDateString()}.`}]},
          generationConfig:{responseMimeType:"application/json",responseSchema:{type:"OBJECT",properties:{text_response:{type:"STRING"},items:{type:"ARRAY",items:{type:"OBJECT",properties:{type:{type:"STRING"},search_query:{type:"STRING"},literal_reason:{type:"STRING"}},required:["type","search_query","literal_reason"]}}},required:["text_response","items"]}}
        })
      });
      if(!r.ok){const err=await r.json();throw new Error(err?.error?.message||'API error');}
      const txt=(await r.json()).candidates?.[0]?.content?.parts?.[0]?.text;
      if(txt){
        const j=JSON.parse(txt);
        const cards=[];
        for(const rec of(j.items||[])){
          try{
            const sr=await fetchWithCache(`${BASE_URL}/search/${rec.type==='tv'?'tv':'movie'}?api_key=${apiKey}&query=${encodeURIComponent(rec.search_query)}&include_adult=false`);
            const m=sr.results?.find(x=>x.poster_path);
            if(m)cards.push({ai_type:rec.type,media:m,reason:rec.literal_reason,id:`m-${m.id}`});
          }catch{}
        }
        setAiResp({text:(j.text_response||'').replace(/\*/g,''),cards});
      }
    }catch(err){
      setAiErr(`AI Error: ${err.message||'Failed to generate response. Check your Gemini API key in Settings.'}`);
    }
    setAiLoad(false);
  };

  return(
    <div className="pt-24 md:pt-32 px-4 md:px-8 lg:px-12 xl:px-16 min-h-screen w-full bg-black animate-in fade-in duration-500 max-w-[1800px] mx-auto pb-32">
      <div className="w-full relative z-30">
        <div className="flex justify-center mb-8 z-40 relative">
          <div className="bg-white/10 backdrop-blur-2xl p-1.5 rounded-full flex gap-2 border border-white/10 shadow-lg">
            <button onClick={()=>setMode('standard')} className={cn("px-6 py-2.5 rounded-full text-sm font-semibold transition-all outline-none",mode==='standard'?"bg-white text-black shadow-md":"text-white/70 hover:text-white")}><Search className="w-4 h-4 inline-block md:mr-2 -mt-0.5"/>Standard</button>
            <button onClick={()=>setMode('ai')} className={cn("px-6 py-2.5 rounded-full text-sm font-semibold transition-all outline-none",mode==='ai'?"bg-[#19446C] text-white shadow-md":"text-white/70 hover:text-white")}><Sparkles className="w-4 h-4 inline-block md:mr-2 -mt-0.5"/>Ask AI</button>
          </div>
        </div>

        {mode==='standard'&&(
          <>
            <div className="sticky top-[72px] md:top-20 bg-black/80 backdrop-blur-2xl pt-4 pb-4 z-40 border-b border-transparent shadow-[0_20px_30px_-15px_rgba(0,0,0,0.8)] mb-8">
              <div className="relative mb-4 max-w-4xl mx-auto">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-white/50"/>
                <input type="text" placeholder="Search movies, TV shows..." className="w-full bg-white/10 border border-white/10 text-white text-lg py-4 pl-16 pr-16 rounded-2xl outline-none placeholder:text-white/40 focus:bg-white/15 focus:border-white/30 focus-visible:ring-4 focus-visible:ring-[#19446C] transition-all shadow-lg" value={q} onChange={e=>setQ(e.target.value)} autoFocus/>
                {q&&<button onClick={()=>setQ('')} className="absolute right-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white outline-none p-1"><X className="w-5 h-5"/></button>}
              </div>
              <div className="flex items-center justify-center gap-3 overflow-x-auto max-w-5xl mx-auto px-4 py-1 fade-edge-right">
                <div className="flex items-center gap-2 bg-white/5 rounded-full p-1.5 border border-white/10 shrink-0"><Filter className="w-4 h-4 ml-3 text-white/50"/><span className="text-sm font-semibold text-white/50 mr-2 pr-1">Filters</span></div>
                {[[fSort,setFSort,[['popularity.desc','Sort: Popular'],['vote_average.desc','Sort: Top Rated'],['primary_release_date.desc','Sort: Newest']]],[fType,setFType,[['all','All Media'],['movie','Movies Only'],['tv','Series Only']]],[fGenre,setFGenre,[['all','Any Genre'],...ALL_UNIQUE_GENRES.map(g=>[g.id,g.name])]],[fYear,setFYear,[['all','Any Decade'],['2020-2029','2020s'],['2010-2019','2010s'],['2000-2009','2000s'],['1990-1999','1990s'],['1900-1989','1980s & Older']]],[fRating,setFRating,[['all','Any Rating'],['8','8.0+ (Excellent)'],['7','7.0+ (Good)'],['6','6.0+ (Average)']]]].map(([val,setter,opts],i)=>(
                  <select key={i} value={val} onChange={e=>setter(e.target.value)} className="custom-select bg-white/5 text-white/80 border border-white/10 hover:border-white/30 rounded-full px-5 py-2 outline-none focus:bg-white/10 text-sm font-semibold shrink-0 cursor-pointer appearance-none text-center">{opts.map(([v,l])=><option key={v} value={v} className="bg-black text-white">{l}</option>)}</select>
                ))}
              </div>
            </div>
            <div className="relative z-10">
              {!dq&&!init&&<h3 className="text-2xl font-bold text-white mb-6 pl-2">{hasF?"Filtered Results":"Popular Recommendations"}</h3>}
              {init?<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-6 lg:gap-8">{[...Array(16)].map((_,i)=><div key={i} className="aspect-[2/3] bg-white/5 rounded-2xl animate-pulse"/>)}</div>
              :results.length>0?(<>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-6 lg:gap-8 pb-10">{results.map(i=><MediaCard key={i.id} media={i} onClick={onMediaClick} size="grid"/>)}</div>
                {hasMore&&<div ref={lastRef} className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#19446C]/50 border-t-[#19446C] rounded-full animate-spin"/></div>}
                {!hasMore&&<div className="py-12 text-center text-white/50 text-sm font-semibold">End of results</div>}
              </>):<div className="text-center py-32 text-white/50"><Search className="w-16 h-16 mx-auto mb-4 opacity-30"/><p className="text-xl">No results found.</p></div>}
            </div>
          </>
        )}

        {mode==='ai'&&(
          <div className="max-w-4xl mx-auto pb-32">
            {!geminiApiKey&&(
              <div className="mb-8 p-5 bg-[#19446C]/20 border border-[#19446C]/40 rounded-3xl text-center">
                <Sparkles className="w-8 h-8 text-[#19446C] mx-auto mb-3"/>
                <p className="text-white font-semibold mb-1">Gemini API Key Required</p>
                <p className="text-white/60 text-sm">Add your free Gemini API key in <button onClick={()=>{}} className="text-white underline">Settings</button> to use AI Search.</p>
              </div>
            )}
            <form onSubmit={handleAiSubmit} className="relative mb-12">
              <input type="text" placeholder="Ask for recommendations, e.g. 'sci-fi thrillers like Interstellar'..." className="w-full bg-white/10 backdrop-blur-2xl border border-white/10 text-white text-lg py-5 pl-8 pr-16 rounded-3xl focus:bg-white/15 outline-none placeholder:text-white/40 focus:border-white/30 focus-visible:ring-4 focus-visible:ring-[#19446C] shadow-xl transition-all" value={aiP} onChange={e=>setAiP(e.target.value)} disabled={aiLoad} autoFocus/>
              <button type="submit" disabled={aiLoad||!aiP.trim()||!geminiApiKey} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 text-white rounded-2xl bg-[#19446C] hover:bg-[#133250] transition-all disabled:opacity-50 outline-none">{aiLoad?<div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"/>:<Send className="w-5 h-5"/>}</button>
            </form>
            {aiErr&&<div className="text-red-400 text-center mb-8 p-4 bg-red-500/10 rounded-3xl border border-red-500/20">{aiErr}</div>}
            {aiResp&&(
              <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-8 md:p-12 border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4">
                <div className="text-lg md:text-xl text-white/90 leading-relaxed mb-10">{aiResp.text}</div>
                {aiResp.cards?.length>0&&(
                  <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-8">
                    {aiResp.cards.map(item=>(
                      <div key={item.id} className="flex flex-row gap-4 md:gap-6 p-4 md:p-6 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 hover:border-white/30 transition-all group items-center shadow-lg cursor-pointer" onClick={()=>onMediaClick(item.media)}>
                        <div className="w-24 md:w-32 shrink-0">
                          <img src={`${IMAGE_BASE_URL}w200${item.media.poster_path}`} className="w-full rounded-2xl shadow-lg object-cover aspect-[2/3]" alt="" onError={e=>{e.target.src='https://via.placeholder.com/200x300?text=No+Image';}}/>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2"><span className="bg-[#19446C] text-white px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-widest">{item.ai_type==='tv'?'Series':'Movie'}</span></div>
                          <h4 className="text-xl font-bold text-white mb-2">{item.media.title||item.media.name}</h4>
                          <p className="text-white/60 text-sm line-clamp-2">{(item.reason||'').replace(/\*/g,'')}</p>
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
    </div>
  );
});

// ─── PERSON MODAL (FIX: renders on top of detail modal) ─────────────────────
const PersonModal=({personId,apiKey,onClose,onMediaClick})=>{
  const [det,setDet]=useState(null),[cred,setCred]=useState([]);
  useEffect(()=>{ lockScroll(); return()=>unlockScroll(); },[]);
  useEffect(()=>{
    if(!personId||!apiKey)return;
    let ok=true;
    (async()=>{
      try{
        const[d,c]=await Promise.all([
          fetchWithCache(`${BASE_URL}/person/${personId}?api_key=${apiKey}`),
          fetchWithCache(`${BASE_URL}/person/${personId}/combined_credits?api_key=${apiKey}`)
        ]);
        if(!ok)return;
        setDet(d);
        setCred(Array.from(new Map((c.cast?.filter(x=>x.poster_path).sort((a,b)=>(b.popularity||0)-(a.popularity||0))||[]).map(i=>[i.id,i])).values()));
      }catch(e){console.error(e);}
    })();
    return()=>{ok=false;};
  },[personId,apiKey]);

  if(!det)return(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xl">
      <div className="w-10 h-10 border-4 border-[#19446C]/50 border-t-[#19446C] rounded-full animate-spin"/>
    </div>
  );

  return(
    // FIX: z-[200] so it renders above the detail modal (z-[100])
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-12 animate-in fade-in duration-300 hardware-accel">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-3xl" onClick={onClose}/>
      <div className="relative bg-[#0d0d0d] border border-white/10 w-full h-full md:h-auto md:max-w-6xl md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:max-h-[90vh] animate-in zoom-in-95 duration-300">
        <button onClick={onClose} className="absolute top-6 right-6 md:top-8 md:right-8 p-3 bg-white/10 rounded-full text-white z-50 hover:bg-white hover:text-black transition-all shadow-xl outline-none"><X className="w-6 h-6"/></button>
        <div className="p-6 pt-20 md:p-16 flex flex-col md:flex-row gap-10 md:gap-16 overflow-y-auto">
          <div className="shrink-0 flex flex-col items-center md:items-start text-center md:text-left w-full md:w-80">
            <div className="w-48 h-48 md:w-72 md:h-72 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl mb-6 bg-white/5">
              {det.profile_path?<img src={`${IMAGE_BASE_URL}w500${det.profile_path}`} className="w-full h-full object-cover" alt={det.name} decoding="async"/>:<div className="w-full h-full flex items-center justify-center"><User className="w-20 h-20 text-white/30"/></div>}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">{det.name}</h2>
            {det.place_of_birth&&<p className="text-white/60 text-sm mt-3">{det.place_of_birth}</p>}
            {det.birthday&&<p className="text-white/50 text-xs mt-1">Born: {formatDate(det.birthday)}</p>}
          </div>
          <div className="flex-1 space-y-10 md:space-y-14">
            {det.biography&&<div><h3 className="text-xl font-bold text-white mb-4">Biography</h3><p className="text-white/70 text-base md:text-lg leading-relaxed line-clamp-6 hover:line-clamp-none cursor-pointer">{det.biography}</p></div>}
            <div>
              <h3 className="text-xl font-bold text-white mb-6">Known For</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 sm:gap-6">
                {cred.slice(0,16).map(m=><MediaCard key={m.id} media={m} onClick={onMediaClick} size="grid"/>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── DETAIL MODAL ────────────────────────────────────────────────────────────
const Modal=({media,onClose,onPlay,isOpen,toggleWatchlist,isInWatchlist,apiKey,omdbApiKey,onCastClick,onMediaClick})=>{
  const [det,setDet]=useState(null),[omdb,setOmdb]=useState(null),[trailer,setTrailer]=useState(null),[season,setSeason]=useState(1);
  const [eps,setEps]=useState([]),[similar,setSimilar]=useState([]),[loading,setLoading]=useState(true);
  const [showTr,setShowTr]=useState(false),[spoilers,setSpoilers]=useState({}),[tab,setTab]=useState('overview'),[epsLoad,setEpsLoad]=useState(true);

  useEffect(()=>{ if(isOpen)lockScroll(); else unlockScroll(); return()=>unlockScroll(); },[isOpen]);

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
        if(!ok)return; setDet(d);
        const vt=d.videos?.results?.find(v=>v.type==="Trailer"&&v.site==="YouTube"&&v.official)||d.videos?.results?.find(v=>v.type==="Trailer"&&v.site==="YouTube")||d.videos?.results?.find(v=>v.site==="YouTube");
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
    const isTvMedia = media?.media_type==='tv'||(!media?.release_date&&media?.name);
    if(!isTvMedia||media?.isLive||!apiKey||!season||!det||tab!=='episodes')return;
    let ok=true; setEpsLoad(true);
    (async()=>{
      try{const d=await fetchWithCache(`${BASE_URL}/tv/${media.id}/season/${season}?api_key=${apiKey}`);if(ok)setEps(d.episodes||[]);}
      catch{if(ok)setEps([]);}
      finally{if(ok)setEpsLoad(false);}
    })();
    return()=>{ok=false;};
  },[season,media,apiKey,det,tab]);

  if(!isOpen||!media||media.isLive)return null;
  const isTv=media.media_type==='tv'||(!media.release_date&&media.name);
  const bg=`${IMAGE_BASE_URL}${BACKDROP_SIZE}${media.backdrop_path||media.poster_path}`;
  const cast=Array.from(new Map(det?.credits?.cast?.map(p=>[p.id,p])||[]).values()).slice(0,10);
  const hasImdb=omdb?.imdbRating&&omdb.imdbRating!=='N/A';

  return(
    <div className="fixed inset-0 z-[100] bg-black view-enter overflow-hidden font-sans modal-overlay-enter hardware-accel">
      {!showTr&&<button onClick={onClose} className="fixed top-6 right-6 md:top-10 md:right-10 p-4 bg-white/10 hover:bg-white hover:text-black backdrop-blur-2xl rounded-full text-white transition-all border border-white/10 z-[190] shadow-2xl cursor-pointer outline-none"><X className="w-6 h-6"/></button>}
      {showTr&&trailer&&(
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-3xl flex items-center justify-center animate-in fade-in zoom-in-95 duration-300">
          <button onClick={()=>setShowTr(false)} className="absolute top-6 right-6 md:top-10 md:right-10 p-4 bg-white/10 rounded-full text-white hover:bg-white hover:text-black transition-all z-[200] shadow-2xl outline-none"><X className="w-6 h-6"/></button>
          <div className="w-full max-w-6xl px-4 md:px-12"><div style={{height:'0px',overflow:'hidden',paddingTop:'56.25%',position:'relative',width:'100%',borderRadius:'1rem'}}><iframe style={{position:'absolute',top:0,left:0,width:'100%',height:'100%'}} src={getTrailerUrl(trailer)} className="border border-white/10 shadow-2xl" title="Trailer" frameBorder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;fullscreen" allowFullScreen/></div></div>
        </div>
      )}
      <div className="absolute inset-0 z-0 hardware-accel pointer-events-none">
        <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 scale-[1.02] blur-sm" decoding="async" onError={e=>{e.target.src='https://via.placeholder.com/1280x720';}}/>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/20"/>
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent hidden md:block"/>
      </div>
      <div className="relative z-10 w-full h-full overflow-y-auto">
        <div className="min-h-screen flex flex-col justify-start pt-24 md:pt-40 px-6 md:px-12 lg:px-20 pb-32">
          <div className="flex flex-col md:flex-row gap-10 md:gap-20 max-w-[1800px] mx-auto w-full">
            <div className="w-48 md:w-[22rem] shrink-0 mx-auto md:mx-0">
              <img src={`${IMAGE_BASE_URL}${POSTER_SIZE}${media.poster_path}`} className="w-full rounded-2xl md:rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-white/10 object-cover aspect-[2/3]" alt="" decoding="async" onError={e=>{e.target.src='https://via.placeholder.com/500x750';}}/>
            </div>
            <div className="flex-1 space-y-8 animate-in slide-in-from-right-10 fade-in duration-700 text-center md:text-left mt-4 md:mt-10">
              <div className="space-y-4">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  {isTv&&<span className="px-3 py-1 bg-[#19446C] rounded-md text-[10px] font-bold uppercase tracking-widest text-white">Series</span>}
                  {det?.status&&<span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">{det.status}</span>}
                </div>
                <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold text-white tracking-tight leading-[1.05] drop-shadow-2xl">{media.title||media.name}</h1>
                {det?.tagline&&<p className="text-lg md:text-2xl text-white/50 font-medium italic">{det.tagline}</p>}
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs md:text-sm font-semibold text-white/70">
                {hasImdb&&<div className="flex items-center gap-2 bg-[#f5c518] text-black px-3 py-1.5 rounded-lg shadow-lg"><span className="font-black text-xs">IMDb</span><span className="font-bold text-sm">{omdb.imdbRating}</span>{omdb.imdbVotes&&omdb.imdbVotes!=='N/A'&&<span className="text-black/60 text-xs border-l border-black/20 pl-2 ml-1">{omdb.imdbVotes}</span>}</div>}
                {!hasImdb&&<div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-white shadow-lg"><span className="font-bold text-xs">TMDB</span><span className="font-bold text-sm" style={getRatingColor(media.vote_average)}>{media.vote_average?.toFixed(1)}</span>{det?.vote_count>0&&<span className="text-white/60 text-xs border-l border-white/20 pl-2 ml-1">{det.vote_count.toLocaleString()}</span>}</div>}
                {omdb?.Ratings?.find(r=>r.Source==='Rotten Tomatoes')&&<div className="flex items-center gap-1.5 bg-[#fa320a] text-white px-3 py-1.5 rounded-lg shadow-lg"><span className="font-bold text-xs">RT</span><span className="font-bold text-sm">{omdb.Ratings.find(r=>r.Source==='Rotten Tomatoes').Value}</span></div>}
                <span className="ml-2">{det?.release_date?.split('-')[0]||det?.first_air_date?.split('-')[0]}</span>
                <span className="w-1.5 h-1.5 bg-white/30 rounded-full"/>
                <span>{det?.runtime?`${Math.floor(det.runtime/60)}h ${det.runtime%60}m`:(det?.number_of_seasons?`${det.number_of_seasons} Seasons`:'N/A')}</span>
                <span className="w-1.5 h-1.5 bg-white/30 rounded-full"/>
                <span className="border border-white/30 px-2 py-0.5 rounded-md text-[10px]">4K HDR</span>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-4">
                <button onClick={()=>onPlay(media,isTv?{season,episode:1}:null)} className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-white text-black px-10 py-4 rounded-full font-bold text-lg hover:bg-white/90 transition-all hover:scale-[1.03] shadow-lg w-full sm:w-auto outline-none"><Play className="w-6 h-6 fill-current"/>Play</button>
                {trailer&&<button onClick={()=>setShowTr(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/10 backdrop-blur-xl hover:bg-white/20 text-white px-8 py-4 rounded-full font-bold text-lg transition-all border border-white/10 hover:scale-[1.03] outline-none"><Film className="w-6 h-6"/>Trailer</button>}
                <button onClick={()=>toggleWatchlist(media)} className={cn("flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/10 backdrop-blur-xl hover:bg-white/20 text-white px-8 py-4 rounded-full font-bold text-lg transition-all border border-white/10 hover:scale-[1.03] whitespace-nowrap outline-none",isInWatchlist&&"bg-white/30 border-white/30")}><Bookmark className="w-6 h-6" fill={isInWatchlist?"currentColor":"none"}/>{isInWatchlist?'Saved':'Save'}</button>
              </div>
            </div>
          </div>
          <div className="max-w-[1800px] mx-auto w-full mt-20">
            <div className="flex items-center justify-center md:justify-start gap-10 border-b border-white/10 pb-4 mb-10 overflow-x-auto fade-edge-right">
              {['overview',isTv?'episodes':null,'similar'].filter(Boolean).map(t=>(
                <button key={t} onClick={()=>setTab(t)} className={cn("text-lg font-bold capitalize transition-all relative pb-2 shrink-0 outline-none",tab===t?"text-white":"text-white/50 hover:text-white/80")}>
                  {t}{tab===t&&<div className="absolute -bottom-[3px] md:-bottom-[5px] left-0 w-full h-1 bg-white rounded-t-full"/>}
                </button>
              ))}
            </div>
            <div className="min-h-[40vh]">
              {tab==='overview'&&(
                <div className="grid md:grid-cols-[2fr_1fr] gap-12 lg:gap-24 animate-in fade-in slide-in-from-bottom-4">
                  <div className="space-y-12">
                    <div><h3 className="text-white font-bold text-2xl mb-4">Synopsis</h3><p className="text-lg text-white/70 leading-relaxed font-light">{media.overview}</p></div>
                    <div>
                      <h3 className="text-white font-bold text-2xl mb-6">Top Cast</h3>
                      <div className="flex flex-wrap gap-4">
                        {cast.map(p=>(
                          // FIX: onCastClick opens PersonModal on top of this detail modal
                          <button key={p.id} onClick={()=>onCastClick(p.id)}
                            className="flex items-center gap-3 bg-white/5 hover:bg-white/10 backdrop-blur-md pr-6 rounded-full border border-white/5 transition-all group cursor-pointer outline-none hover:border-white/20 shadow-sm">
                            {p.profile_path
                              ? <img src={`${IMAGE_BASE_URL}w200${p.profile_path}`} className="w-14 h-14 rounded-full object-cover" alt="" decoding="async"/>
                              : <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><User className="w-6 h-6 text-white/50"/></div>}
                            <div className="flex flex-col items-start py-2">
                              <span className="text-sm font-semibold text-white/90 group-hover:text-white text-left">{p.name}</span>
                              <span className="text-xs text-white/50 text-left line-clamp-1">{p.character?.split('/')[0]}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-xl h-fit">
                    <span className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-6">Information</span>
                    <div className="space-y-5 text-sm">
                      {[['Status',det?.status],['Language',(det?.original_language||'').toUpperCase()],['Budget',det?.budget?`$${(det.budget/1e6).toFixed(1)}M`:'N/A'],['Revenue',det?.revenue?`$${(det.revenue/1e6).toFixed(1)}M`:'N/A']].map(([l,v])=>(
                        <div key={l} className="flex justify-between border-b border-white/10 pb-3 last:border-0 last:pb-0"><span className="text-white/60">{l}</span><span className="text-white font-medium">{v}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {tab==='episodes'&&isTv&&(
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
                  <div className="flex gap-3 overflow-x-auto pb-2 fade-edge-right">
                    {det?.seasons?.filter(s=>s.season_number>0&&s.episode_count>0).map(s=>(
                      <button key={s.id} onClick={()=>setSeason(s.season_number)} className={cn("px-6 py-3 text-sm rounded-full transition-all whitespace-nowrap font-semibold border shrink-0 outline-none",season===s.season_number?"bg-white text-black border-white shadow-lg":"bg-white/10 text-white/70 border-white/10 hover:text-white hover:bg-white/20")}>{s.name}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {epsLoad?<div className="col-span-full py-16 text-center text-white/50">Loading episodes...</div>
                    :eps.length>0?eps.map(ep=>{
                      const rev=spoilers[ep.id], di=parseEpisodeDate(ep.air_date);
                      return(
                        <div key={ep.id} className="group flex flex-col gap-4 p-4 bg-white/5 rounded-3xl hover:bg-white/10 backdrop-blur-lg transition-all border border-white/10 shadow-sm">
                          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/50">
                            <img src={ep.still_path?`${IMAGE_BASE_URL}${STILL_SIZE}${ep.still_path}`:bg} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" onError={e=>{e.target.src='https://via.placeholder.com/500x280';}}/>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                              <button onClick={()=>onPlay(media,{season,episode:ep.episode_number})} className="bg-white text-black p-4 rounded-full hover:scale-110 transition-transform shadow-2xl outline-none"><Play className="w-6 h-6 fill-current"/></button>
                            </div>
                            {isTouchDevice()&&<button onClick={()=>onPlay(media,{season,episode:ep.episode_number})} className="absolute bottom-3 right-3 bg-white/20 backdrop-blur-xl text-white p-3 rounded-full shadow-lg z-10 outline-none"><Play className="w-5 h-5 fill-current"/></button>}
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs text-[#19446C] font-bold tracking-wider flex items-center gap-2">EP {ep.episode_number}{di.isNew&&<span className="bg-[#19446C] text-white px-1.5 py-0.5 rounded-sm text-[9px] uppercase tracking-widest">New</span>}</span>
                              <span className="text-xs text-white/50 font-mono">{ep.runtime?`${ep.runtime}m`:''}</span>
                            </div>
                            <h4 className="text-white font-bold text-base md:text-lg mb-2">{String(ep.name||`Episode ${ep.episode_number}`)}</h4>
                            <div className="text-xs text-white/60 mb-3 font-medium flex items-center gap-1.5 bg-black/40 w-fit px-3 py-1 rounded-lg border border-white/10"><Calendar className="w-3.5 h-3.5"/>{di.text}</div>
                            <p className={cn("text-xs md:text-sm text-white/50 line-clamp-3 leading-relaxed",!rev&&"spoiler-blur")} onClick={()=>setSpoilers(p=>({...p,[ep.id]:true}))}>{rev||!ep.overview?"No description available.":ep.overview}</p>
                          </div>
                        </div>
                      );
                    }):<div className="col-span-full py-16 text-center text-white/50">No episodes available.</div>}
                  </div>
                </div>
              )}
              {tab==='similar'&&(
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-4">
                  {similar.map(i=><MediaCard key={i.id} media={i} onClick={m=>{setTab('overview');if(onMediaClick)onMediaClick(m);}} size="grid"/>)}
                  {!similar.length&&!loading&&<div className="col-span-full text-center py-16 text-white/50">No similar content found.</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ROOT APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [mounted,setMounted]=useState(false);
  const [user,setUser]=useState(undefined);
  // FIX: "Who's watching?" stored per-session, reset on sign-out
  const [profileChosen,setProfileChosen]=useState(false);
  const [activeTab,setActiveTabRaw]=useState('home');
  const [selGenre,setSelGenre]=useState('All');
  const [expHistory,setExpHistory]=useState({});
  const [focusMode,setFocusMode]=useState(false);
  const [selMedia,setSelMedia]=useState(null);
  const [selPerson,setSelPerson]=useState(null);
  const [playMedia,setPlayMedia]=useState(null);
  const [playCfg,setPlayCfg]=useState(null);

  const {settings,saveSettings,history,saveHistory,watchlist,saveWatchlist,loaded}=useFirestoreData(user?.uid||null);

  const apiKey        = settings.apiKey;
  const omdbApiKey    = settings.omdbApiKey;
  const sourceKey     = settings.sourceKey;
  const geminiApiKey  = settings.geminiApiKey;
  const requireProfile= settings.requireProfile;
  const algoPrefs     = settings.algoPrefs;
  const ccSettings    = settings.ccSettings;
  const vidplusSettings = { ...DEFAULT_VIDPLUS, ...(settings.vidplusSettings||{}) };
  const skipSettings    = { ...DEFAULT_SKIP,    ...(settings.skipSettings||{}) };

  const setApiKey           = v => saveSettings(s=>({...s,apiKey:v}));
  const setOmdbApiKey       = v => saveSettings(s=>({...s,omdbApiKey:v}));
  const setSourceKey        = v => saveSettings(s=>({...s,sourceKey:v}));
  const setGeminiApiKey     = v => saveSettings(s=>({...s,geminiApiKey:v}));
  const setRequireProfile   = v => saveSettings(s=>({...s,requireProfile:v}));
  const setAlgoPrefs        = v => saveSettings(s=>({...s,algoPrefs:typeof v==='function'?v(s.algoPrefs):v}));
  const setCcSettings       = v => saveSettings(s=>({...s,ccSettings:typeof v==='function'?v(s.ccSettings):v}));
  const setVidplusSettings  = v => saveSettings(s=>({...s,vidplusSettings:{...(s.vidplusSettings||DEFAULT_VIDPLUS),...(typeof v==='function'?v(s.vidplusSettings||DEFAULT_VIDPLUS):v)}}));
  const setSkipSettings     = v => saveSettings(s=>({...s,skipSettings:{...(s.skipSettings||DEFAULT_SKIP),...(typeof v==='function'?v(s.skipSettings||DEFAULT_SKIP):v)}}));

  const histRef=useRef(history), wlRef=useRef(watchlist);
  useEffect(()=>{histRef.current=history;},[history]);
  useEffect(()=>{wlRef.current=watchlist;},[watchlist]);

  useEffect(()=>{ const unsub=onAuthStateChanged(auth,u=>{setUser(u||null);setMounted(true);}); return unsub; },[]);

  // FIX: Reset profileChosen when user signs out or requireProfile changes off
  useEffect(()=>{ if(!requireProfile)setProfileChosen(true); },[requireProfile]);
  useEffect(()=>{ if(!user)setProfileChosen(false); },[user]);

  // FIX: Tab setter — never let focus-mode button trigger settings
  const setActiveTab = useCallback((tab) => {
    setActiveTabRaw(tab);
    if(tab!=='live')setFocusMode(false);
    setSelGenre('All');
  },[]);

  const autoBoosted=useMemo(()=>{
    if(!history.length)return[];
    const c={};
    history.forEach(i=>(i.genre_ids||(i.genres?i.genres.map(g=>g.id):[])).forEach(id=>{const k=(id===28||id===12)?"28|12":id;c[k]=(c[k]||0)+1;}));
    return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,4).map(e=>String(e[0]).includes('|')?e[0]:parseInt(e[0],10));
  },[history]);

  const effAlgo=useMemo(()=>({
    boosted:[...new Set([...algoPrefs.boosted,...autoBoosted])].filter(id=>!algoPrefs.excluded.includes(id)),
    excluded:algoPrefs.excluded
  }),[algoPrefs,autoBoosted]);

  const toggleAlgo=useCallback(id=>setAlgoPrefs(p=>{
    if(p.boosted.includes(id))return{boosted:p.boosted.filter(x=>x!==id),excluded:[...new Set([...p.excluded,id])]};
    if(p.excluded.includes(id))return{boosted:p.boosted,excluded:p.excluded.filter(x=>x!==id)};
    return{boosted:[...new Set([...p.boosted,id])],excluded:p.excluded};
  }),[setAlgoPrefs]);

  const handlePlay=useCallback((media,config=null)=>{
    if(media.isLive){setPlayMedia(media);setPlayCfg(null);setSelMedia(null);setSelPerson(null);return;}
    const ex=histRef.current.find(h=>h.id===media.id);
    const fc=config||ex?.config||{season:1,episode:1};
    setPlayMedia(media);setPlayCfg(fc);setSelMedia(null);setSelPerson(null);
    const now=new Date().toISOString(); let we=ex?.watchedEpisodes?[...ex.watchedEpisodes]:[];
    if(media.media_type==='tv'||(!media.release_date&&media.name)){
      if(we.length===0&&ex?.config&&(ex.config.season!==fc.season||ex.config.episode!==fc.episode))we.push({season:ex.config.season,episode:ex.config.episode,watchedAt:ex.watchedAt});
      const idx=we.findIndex(e=>e.season===fc.season&&e.episode===fc.episode);
      if(idx>=0){we[idx].watchedAt=now;const[e]=we.splice(idx,1);we.unshift(e);}else we.unshift({season:fc.season,episode:fc.episode,watchedAt:now});
    }
    saveHistory(p=>[{...media,watchedAt:now,config:fc,watchedEpisodes:we},...p.filter(h=>h.id!==media.id)].slice(0,100));
  },[saveHistory]);

  const handlePlaySport=useCallback(match=>new Promise(async resolve=>{
    if(!match||!match.sources?.length){resolve();return;}
    let url='',isIfr=false;
    const daddy=match.sources.find(s=>s.source==='daddyhd'||s.source==='daddy');
    if(daddy){url=`https://dlstreams.top/stream/stream-${daddy.id}.php`;isIfr=true;}
    if(!url){
      for(const src of match.sources){
        if(src.source==='daddyhd'||src.source==='daddy')continue;
        try{
          const r=await fetch(`https://streamed.pk/api/stream/${src.source}/${src.id}`);
          if(!r.ok)continue;
          const ss=await r.json();
          const v=Array.isArray(ss)?ss:(typeof ss==='object'&&ss?Object.values(ss):[]);
          if(v.length){
            const b=v.find(s=>s.language==='English'&&s.hd)||v[0];
            if(b.embedUrl){url=b.embedUrl;isIfr=true;break;}
            else if(b.streamUrl||b.url){url=b.streamUrl||b.url;isIfr=!url.includes('.m3u8');break;}
          }
        }catch{}
      }
    }
    if(url)setPlayMedia({isLive:true,type:isIfr?'iframe':'m3u8',name:match.title||match.name||'Live Sport',url});
    resolve();
  }),[]);

  const toggleWatchlist=useCallback(media=>saveWatchlist(p=>p.find(m=>m.id===media.id)?p.filter(m=>m.id!==media.id):[media,...p]),[saveWatchlist]);
  const removeHistory=useCallback(id=>saveHistory(p=>p.filter(h=>h.id!==id)),[saveHistory]);

  // Loading states
  if(!mounted||user===undefined)return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"/></div>;
  if(!user)return <><GlobalStyles/><LoginScreen/></>;
  if(!loaded)return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#19446C]/50 border-t-[#19446C] rounded-full animate-spin"/></div>;

  // FIX: "Who's watching?" — only shown once per session, works with actual user data
  if(requireProfile&&!profileChosen){
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center font-sans px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#19446C]/15 rounded-full blur-[140px]"/>
        </div>
        <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center mb-14 shadow-lg">
          <Play className="text-black w-5 h-5 fill-black ml-0.5"/>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">Who's watching?</h1>
        <p className="text-white/40 mb-16 text-base">Select a profile to continue</p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {[
            {name:'Main', color:'bg-gradient-to-br from-[#1a3a5c] to-[#0d1f30]', initials: user?.email?.charAt(0)?.toUpperCase()||'M'},
            {name:'Guest', color:'bg-white/8 backdrop-blur-xl', initials:'G'},
          ].map((profile)=>(
            <button key={profile.name} onClick={()=>setProfileChosen(true)}
              className="flex flex-col items-center gap-5 cursor-pointer group outline-none">
              <div className={cn(
                "w-32 h-32 md:w-36 md:h-36 rounded-[2rem] flex items-center justify-center transition-all duration-300 border-2 border-transparent group-hover:border-white/40 group-focus:border-white shadow-xl",
                profile.color
              )}>
                <span className="text-4xl font-bold text-white/80 group-hover:text-white transition-colors">{profile.initials}</span>
              </div>
              <span className="text-white/50 font-semibold text-lg group-hover:text-white transition-colors">{profile.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#19446C] selection:text-white overflow-x-hidden">
      <GlobalStyles/>
      <TopNavigation activeTab={activeTab} setActiveTab={setActiveTab} selectedGenre={selGenre} setSelectedGenre={setSelGenre} focusMode={focusMode}/>
      <main className="transition-all duration-700 ease-out">
        {activeTab==='home'&&<HomeView apiKey={apiKey} history={history} watchlist={watchlist} algoPrefs={effAlgo} onPlay={handlePlay} onMoreInfo={setSelMedia}/>}
        {activeTab==='live'&&<LiveTvView ccSettings={ccSettings} focusMode={focusMode} setFocusMode={setFocusMode}/>}
        {activeTab==='sports'&&<LiveSportsView onPlaySport={handlePlaySport}/>}
        {activeTab==='movies'&&(
          <div className="pb-32 bg-black min-h-screen">
            {selGenre==='All'?(<>
              <Hero onPlay={handlePlay} onMoreInfo={setSelMedia} apiKey={apiKey} type="movie"/>
              <div className="relative z-20 -mt-24 md:-mt-32">
                <ContentRow title="Trending Movies" fetchUrl="/trending/movie/day" onMediaClick={setSelMedia} apiKey={apiKey} isLarge/>
                <ContentRow title="New In Theatres" fetchUrl="/movie/now_playing" onMediaClick={setSelMedia} apiKey={apiKey}/>
                <ContentRow title="Highest Rated of All Time" fetchUrl="/movie/top_rated" onMediaClick={setSelMedia} apiKey={apiKey}/>
                <ContentRow title="Epic Blockbusters" fetchUrl="/discover/movie?sort_by=revenue.desc" onMediaClick={setSelMedia} apiKey={apiKey}/>
                {GENRES.movie.map(g=><ContentRow key={g.id} title={g.name} fetchUrl={`/discover/movie?with_genres=${g.realId||g.id}${g.exclude?`&without_genres=${g.exclude}`:''}`} onMediaClick={setSelMedia} apiKey={apiKey}/>)}
              </div>
            </>)
            :<GenreGridView apiKey={apiKey} type="movie" genreId={selGenre} onMediaClick={setSelMedia}/>}
          </div>
        )}
        {activeTab==='tv'&&(
          <div className="pb-32 bg-black min-h-screen">
            {selGenre==='All'?(<>
              <Hero onPlay={handlePlay} onMoreInfo={setSelMedia} apiKey={apiKey} type="tv"/>
              <div className="relative z-20 -mt-24 md:-mt-32">
                <ContentRow title="Trending TV Shows" fetchUrl="/trending/tv/day" onMediaClick={setSelMedia} apiKey={apiKey} isLarge/>
                <ContentRow title="Currently Airing" fetchUrl="/tv/on_the_air" onMediaClick={setSelMedia} apiKey={apiKey}/>
                <ContentRow title="Highest Rated Series" fetchUrl="/tv/top_rated" onMediaClick={setSelMedia} apiKey={apiKey}/>
                {GENRES.tv.map(g=><ContentRow key={g.id} title={g.name} fetchUrl={`/discover/tv?with_genres=${g.realId||g.id}${g.exclude?`&without_genres=${g.exclude}`:''}${g.keywords?`&with_keywords=${g.keywords}`:''}`} onMediaClick={setSelMedia} apiKey={apiKey}/>)}
              </div>
            </>)
            :<GenreGridView apiKey={apiKey} type="tv" genreId={selGenre} onMediaClick={setSelMedia}/>}
          </div>
        )}
        {activeTab==='search'&&<SearchView apiKey={apiKey} geminiApiKey={geminiApiKey} history={history} onMediaClick={setSelMedia} onPlay={handlePlay} onPlaySport={handlePlaySport}/>}
        {activeTab==='watchlist'&&(
          <div className="px-4 md:px-8 lg:px-12 xl:px-16 min-h-screen bg-black max-w-[1800px] mx-auto animate-in fade-in duration-500 pt-24 md:pt-40">
            <div className="flex items-center gap-4 mb-10"><div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#19446C] flex items-center justify-center"><Bookmark className="w-6 h-6 text-white"/></div><h2 className="text-3xl md:text-5xl font-bold text-white">Your Library</h2></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-6 lg:gap-8">
              {watchlist.map(i=><MediaCard key={i.id} media={i} onClick={setSelMedia} size="grid"/>)}
            </div>
            {!watchlist.length&&<div className="flex flex-col items-center justify-center py-32 text-white/50"><Bookmark className="w-20 h-20 mb-6 opacity-30"/><p className="text-xl font-medium">Your library is empty.</p></div>}
          </div>
        )}
        {activeTab==='history'&&(
          <div className="px-4 md:px-8 lg:px-12 xl:px-16 min-h-screen bg-black max-w-[1800px] mx-auto animate-in fade-in duration-500 pt-24 md:pt-32">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-6">
              <div className="flex items-center gap-4"><div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#19446C] flex items-center justify-center"><Clock className="w-6 h-6 text-white"/></div><h2 className="text-3xl md:text-5xl font-bold text-white">Watch History</h2></div>
              {history.length>0&&<button onClick={()=>saveHistory([])} className="text-sm text-red-400 hover:text-red-300 flex items-center gap-2 px-5 py-3 rounded-xl hover:bg-red-500/10 font-semibold w-max outline-none"><Trash2 className="w-4 h-4"/>Clear History</button>}
            </div>
            <div className="grid grid-cols-1 gap-4 md:gap-6 pb-32">
              {history.map(item=>{
                const hasEps=item.watchedEpisodes?.length>0, isExp=expHistory[item.id];
                return(
                  <div key={item.id} className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 hover:border-[#19446C]/50 transition-all group shadow-lg overflow-hidden flex flex-col hardware-accel">
                    <div className="flex gap-4 md:gap-8 p-4 md:p-6 items-start">
                      <img src={`${IMAGE_BASE_URL}w200${item.poster_path}`} className="w-20 md:w-28 rounded-xl shadow-lg object-cover aspect-[2/3]" alt="" onError={e=>{e.target.src='https://via.placeholder.com/200x300';}}/>
                      <div className="flex-1 py-1 min-w-0 flex flex-col h-full justify-between">
                        <div><h4 className="font-bold text-lg md:text-2xl text-white mb-2 truncate">{item.title||item.name}</h4><p className="text-sm text-white/60 line-clamp-2 mb-3 leading-relaxed hidden sm:block">{item.overview}</p></div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold text-white bg-[#19446C] border border-[#19446C]/50 px-2.5 py-1 rounded-md uppercase">{(item.media_type==='tv'||item.name)?'Series':'Movie'}</span>
                            {item.config&&<span className="text-[10px] font-bold text-black bg-white px-2.5 py-1 rounded-md uppercase">S{item.config.season} E{item.config.episode}</span>}
                          </div>
                          <span className="text-xs text-white/50 flex items-center gap-1.5 mt-1"><Clock className="w-3.5 h-3.5"/>Watched on {formatHistoryDate(item.watchedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-4 px-2 shrink-0 h-full pt-2">
                        <button onClick={()=>handlePlay(item,item.config)} className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white text-black flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-all hover:scale-105 shadow-xl outline-none"><Play className="w-5 h-5 fill-current"/></button>
                        <button onClick={()=>removeHistory(item.id)} className="p-3 md:p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all opacity-100 md:opacity-0 group-hover:opacity-100 outline-none"><X className="w-5 h-5"/></button>
                      </div>
                    </div>
                    {hasEps&&(
                      <div className="border-t border-white/10 bg-black/20">
                        <button onClick={()=>setExpHistory(p=>({...p,[item.id]:!p[item.id]}))} className="w-full py-3 text-xs font-semibold text-white/50 hover:text-white flex items-center justify-center gap-2 outline-none">
                          <ChevronDown className={cn("w-4 h-4 transition-transform",isExp&&"rotate-180")}/>{isExp?'Hide Episodes':`View Episode History (${item.watchedEpisodes.length})`}
                        </button>
                        {isExp&&<div className="flex flex-col pb-4 px-6">{item.watchedEpisodes.map(ep=>(
                          <div key={`${ep.season}-${ep.episode}`} className="flex items-center justify-between py-3 border-t border-white/5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                              <span className="text-sm font-semibold text-white/80">Season {ep.season} Episode {ep.episode}</span>
                              <span className="text-xs text-white/40">{formatHistoryDate(ep.watchedAt)}</span>
                            </div>
                            <button onClick={()=>handlePlay(item,{season:ep.season,episode:ep.episode})} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-[#19446C] outline-none"><Play className="w-3.5 h-3.5 fill-current ml-0.5"/></button>
                          </div>
                        ))}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
              {!history.length&&<div className="flex flex-col items-center justify-center py-32 text-white/50"><Clock className="w-20 h-20 mb-6 opacity-30"/><p className="text-xl font-medium">No watch history available.</p></div>}
            </div>
          </div>
        )}
        {activeTab==='settings'&&(
          <div className="px-4 md:px-8 lg:px-12 xl:px-16 min-h-screen max-w-5xl mx-auto animate-in fade-in duration-500 pt-24 md:pt-32">
            <div className="flex items-center gap-4 mb-10"><div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#19446C] flex items-center justify-center"><Settings className="w-6 h-6 text-white"/></div><h2 className="text-3xl md:text-5xl font-bold text-white">Settings</h2></div>
            <div className="grid gap-6 md:gap-8 pb-32">
              {/* Profile Selection */}
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:border-[#19446C]/50 shadow-lg">
                <div><h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3 mb-2"><Users className="w-5 h-5 text-[#19446C]"/>Profile Selection</h3><p className="text-sm text-white/60">Show "Who's watching?" on startup.</p></div>
                <button onClick={()=>setRequireProfile(!requireProfile)} className={cn("w-14 h-8 rounded-full transition-colors relative shrink-0 outline-none",requireProfile?"bg-[#19446C]":"bg-white/20")}>
                  <div className={cn("w-6 h-6 bg-white rounded-full absolute top-1 transition-transform shadow-sm",requireProfile?"translate-x-7":"translate-x-1")}/>
                </button>
              </div>
              {/* CC Settings */}
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl hover:border-[#19446C]/50 shadow-lg">
                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3 mb-2"><Subtitles className="w-5 h-5 text-[#19446C]"/>Subtitle Appearance</h3>
                <p className="text-sm text-white/60 mb-6">Customize closed captions for live streams.</p>
                <div className="w-full aspect-video sm:aspect-[21/9] bg-black/50 rounded-2xl mb-8 relative overflow-hidden flex flex-col justify-end pb-6 sm:pb-10 items-center border border-white/10 select-none pointer-events-none">
                  <img src="https://image.tmdb.org/t/p/w1280/8Y43POKjjKDGI9MH89NW0NAzzp8.jpg" className="absolute inset-0 w-full h-full object-cover opacity-60" alt=""/>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"/>
                  <div className={cn("relative z-10 text-center flex flex-col items-center gap-1",ccSettings.animation!=='none'?`cc-anim-${ccSettings.animation}`:"")} key={JSON.stringify(ccSettings)} style={{fontFamily:ccSettings.font,fontSize:ccSettings.size,color:ccSettings.color}}>
                    {["This is a preview of your subtitles.","Adjust the settings to see changes immediately."].map((l,i)=>(
                      <span key={i} className="inline-block px-4 py-1.5 rounded-xl max-w-[90%]" style={{backgroundColor:ccSettings.bg,backdropFilter:ccSettings.bg!=='transparent'?'blur(12px)':'none',textShadow:getTextShadow(ccSettings.edgeStyle),fontWeight:600,lineHeight:1.4,marginTop:i>0?'4px':'0'}}>{l}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[
                    [ccSettings.font,v=>setCcSettings(s=>({...s,font:v})),[['ui-sans-serif,system-ui,-apple-system,sans-serif','Standard'],['ui-serif,Georgia,serif','Classic'],['ui-monospace,monospace','Typewriter'],["'Comic Sans MS',sans-serif",'Casual'],['Impact,fantasy','Display']]],
                    [ccSettings.size,v=>setCcSettings(s=>({...s,size:v})),[['0.85rem','Small'],['1.125rem','Medium'],['1.5rem','Large'],['2rem','X-Large']]],
                    [ccSettings.color,v=>setCcSettings(s=>({...s,color:v})),[['#ffffff','White'],['#fcd34d','Yellow'],['#4ade80','Green'],['#22d3ee','Cyan'],['#f87171','Red']]],
                    [ccSettings.bg,v=>setCcSettings(s=>({...s,bg:v})),[['rgba(0,0,0,0.75)','Dark Translucent'],['rgba(0,0,0,1)','Solid Black'],['rgba(255,255,255,0.2)','Light Translucent'],['transparent','None']]],
                    [ccSettings.edgeStyle,v=>setCcSettings(s=>({...s,edgeStyle:v})),[['dropshadow','Drop Shadow'],['raised','Raised'],['depressed','Depressed'],['outline','Outline'],['none','None']]],
                    [ccSettings.animation,v=>setCcSettings(s=>({...s,animation:v})),[['fade','Fade In'],['slideUp','Slide Up'],['pop','Pop'],['none','None']]],
                  ].map(([val,setter,opts],i)=>(
                    <select key={i} value={val} onChange={e=>setter(e.target.value)} className="custom-select bg-black/40 text-white border border-white/10 rounded-2xl px-5 py-4 outline-none focus-visible:border-[#19446C] cursor-pointer text-sm font-semibold">
                      {opts.map(([v,l])=><option key={v} value={v} className="bg-black text-white">{l}</option>)}
                    </select>
                  ))}
                </div>
              </div>
              {/* Algorithm Prefs */}
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl hover:border-[#19446C]/50 shadow-lg">
                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3 mb-2"><Layers className="w-5 h-5 text-[#19446C]"/>Algorithm Preferences</h3>
                <p className="text-sm text-white/60 mb-6">Click to cycle: <strong className="text-white">Default</strong> → <strong className="text-white">Boosted</strong> → <strong className="text-red-400">Excluded</strong></p>
                <div className="flex flex-wrap gap-3">
                  {ALL_UNIQUE_GENRES.map(g=>{
                    const mB=algoPrefs.boosted.includes(g.id),aB=autoBoosted.includes(g.id),ex=algoPrefs.excluded.includes(g.id);
                    const st=ex?'excluded':mB?'manual':aB?'auto':'default';
                    return <button key={g.id} onClick={()=>toggleAlgo(g.id)} className={cn("px-4 py-2 rounded-full text-xs font-semibold transition-all border outline-none hardware-accel",st==='manual'?"bg-white text-black border-white":st==='auto'?"bg-[#19446C] text-white border-[#19446C]":st==='excluded'?"bg-red-500/20 text-red-400 border-red-500/50":"bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white")}>{g.name}{st==='auto'&&' ✨'}</button>;
                  })}
                </div>
              </div>
              {/* ── VidPlus Player Settings ── */}
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl hover:border-[#19446C]/50 shadow-lg">
                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3 mb-2">
                  <Play className="w-5 h-5 text-[#19446C]"/>VidPlus Player
                </h3>
                <p className="text-sm text-white/60 mb-8">Customise the look and behaviour of the VidPlus player.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Icon style */}
                  <div>
                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-3">Icon Style</label>
                    <div className="flex flex-wrap gap-2">
                      {['vid','netflix','vidstack','lucide','tabler'].map(s=>(
                        <button key={s} onClick={()=>setVidplusSettings({icons:s})}
                          className={cn("px-4 py-2 rounded-full text-xs font-semibold capitalize border transition-all outline-none",
                            vidplusSettings.icons===s?"bg-white text-black border-white shadow":"bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white")}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Subtitle font */}
                  <div>
                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-3">Subtitle Font</label>
                    <select value={vidplusSettings.subtitleFont} onChange={e=>setVidplusSettings({subtitleFont:e.target.value})}
                      className="custom-select bg-black/40 text-white border border-white/10 rounded-2xl px-5 py-3 outline-none cursor-pointer text-sm font-semibold w-full">
                      {['Inter','Roboto','Poppins','Arial','Georgia','Courier New'].map(f=><option key={f} value={f} className="bg-black">{f}</option>)}
                    </select>
                  </div>
                  {/* Font size */}
                  <div>
                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-3">Subtitle Size: {vidplusSettings.subtitleFontSize}px</label>
                    <input type="range" min="14" max="32" value={vidplusSettings.subtitleFontSize}
                      onChange={e=>setVidplusSettings({subtitleFontSize:parseInt(e.target.value)})}
                      className="w-full accent-white cursor-pointer"/>
                  </div>
                  {/* Subtitle bg opacity */}
                  <div>
                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-3">Subtitle Background: {Math.round((vidplusSettings.subtitleOpacity??0.5)*100)}%</label>
                    <input type="range" min="0" max="1" step="0.05" value={vidplusSettings.subtitleOpacity??0.5}
                      onChange={e=>setVidplusSettings({subtitleOpacity:parseFloat(e.target.value)})}
                      className="w-full accent-white cursor-pointer"/>
                  </div>
                </div>
                {/* Toggle options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                  {[
                    ['Auto-next episode (TV)',     'autoNext',    vidplusSettings.autoNext!==false],
                    ['Episode list button (TV)',   'episodeList', vidplusSettings.episodeList!==false],
                    ['Server selector',            'serverIcon',  vidplusSettings.serverIcon!==false],
                  ].map(([label,key,val])=>(
                    <div key={key} className="flex items-center justify-between bg-black/30 rounded-2xl px-5 py-4 border border-white/5">
                      <span className="text-sm font-semibold text-white/80">{label}</span>
                      <button onClick={()=>setVidplusSettings({[key]:!val})}
                        className={cn("w-12 h-6 rounded-full relative shrink-0 outline-none transition-colors",val?"bg-[#19446C]":"bg-white/20")}>
                        <div className={cn("w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm",val?"translate-x-6":"translate-x-0.5")}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Skip Timestamps ── */}
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl hover:border-[#19446C]/50 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3">
                    <ChevronRight className="w-5 h-5 text-[#19446C]"/>Skip Timestamps
                  </h3>
                  <button onClick={()=>setSkipSettings({enabled:!skipSettings.enabled})}
                    className={cn("w-14 h-8 rounded-full transition-colors relative shrink-0 outline-none",skipSettings.enabled?"bg-[#19446C]":"bg-white/20")}>
                    <div className={cn("w-6 h-6 bg-white rounded-full absolute top-1 transition-transform shadow-sm",skipSettings.enabled?"translate-x-7":"translate-x-1")}/>
                  </button>
                </div>
                <p className="text-sm text-white/60 mb-8">Powered by <a href="https://github.com/TheIntroDB" target="_blank" rel="noreferrer" className="text-white underline hover:text-white/80">TheIntroDB</a>. A skip button appears when detected — only for movies and series, not live streams.</p>

                <div className={cn("space-y-8 transition-opacity duration-300",!skipSettings.enabled&&"opacity-40 pointer-events-none")}>
                  {/* Segment toggles */}
                  <div>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Show skip button for</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[['Intro','showIntro'],['Recap','showRecap'],['Credits','showCredits'],['Preview','showPreview']].map(([label,key])=>(
                        <button key={key} onClick={()=>setSkipSettings({[key]:!skipSettings[key]})}
                          className={cn("px-4 py-3 rounded-2xl text-sm font-semibold border transition-all outline-none",
                            skipSettings[key]?"bg-white text-black border-white shadow":"bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white")}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto-skip toggle */}
                  <div className="flex items-center justify-between bg-black/30 rounded-2xl px-5 py-4 border border-white/5">
                    <div>
                      <p className="text-sm font-semibold text-white/90">Auto-Skip</p>
                      <p className="text-xs text-white/50 mt-0.5">Automatically skip segments without showing a button</p>
                    </div>
                    <button onClick={()=>setSkipSettings({autoSkip:!skipSettings.autoSkip})}
                      className={cn("w-14 h-8 rounded-full transition-colors relative shrink-0 outline-none ml-6",skipSettings.autoSkip?"bg-[#19446C]":"bg-white/20")}>
                      <div className={cn("w-6 h-6 bg-white rounded-full absolute top-1 transition-transform shadow-sm",skipSettings.autoSkip?"translate-x-7":"translate-x-1")}/>
                    </button>
                  </div>

                  {/* Button duration */}
                  {!skipSettings.autoSkip&&(
                    <div>
                      <label className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-3">
                        Button visible for: {skipSettings.buttonDuration||6}s
                      </label>
                      <input type="range" min="3" max="15" value={skipSettings.buttonDuration||6}
                        onChange={e=>setSkipSettings({buttonDuration:parseInt(e.target.value)})}
                        className="w-full accent-white cursor-pointer max-w-xs"/>
                    </div>
                  )}

                  {/* Confidence threshold */}
                  <div>
                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-3">
                      Minimum confidence: {Math.round((skipSettings.minConfidence??0.3)*100)}%
                      <span className="text-white/30 font-normal ml-2">(higher = more reliable, fewer buttons)</span>
                    </label>
                    <input type="range" min="0" max="0.9" step="0.05" value={skipSettings.minConfidence??0.3}
                      onChange={e=>setSkipSettings({minConfidence:parseFloat(e.target.value)})}
                      className="w-full accent-white cursor-pointer max-w-xs"/>
                  </div>
                </div>
              </div>

              {/* Default Stream Source */}
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl hover:border-[#19446C]/50 shadow-lg">
                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3 mb-2"><Server className="w-5 h-5 text-[#19446C]"/>Default Stream Source</h3>
                <p className="text-sm text-white/60 mb-6">VidPlus is the recommended source. You can switch sources while watching using the buttons at the top of the player.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Object.entries(SOURCES).map(([k,v])=>(
                    <button key={k} onClick={()=>setSourceKey(k)} className={cn("px-5 py-4 rounded-2xl text-left border transition-all flex items-center justify-between group outline-none",sourceKey===k?"bg-white text-black border-white shadow-lg":"bg-black/40 border-white/10 text-white/60 hover:border-[#19446C]/50 hover:text-white")}>
                      <span className="font-bold text-base">{v.name}</span>
                      <span className={cn("text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded-md",sourceKey===k?"bg-black/10 text-black":"bg-white/10 text-white/50")}>{v.type}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* TMDB key */}
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl hover:border-[#19446C]/50 shadow-lg">
                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3 mb-2"><Monitor className="w-5 h-5 text-[#19446C]"/>TMDB API Key</h3>
                <p className="text-sm text-white/60 mb-6">Required for metadata and catalogs.</p>
                <input type="text" value={apiKey} onChange={e=>setApiKey(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 font-mono text-sm text-white focus-visible:border-[#19446C] focus-visible:ring-2 focus-visible:ring-[#19446C]/50 outline-none transition-all" spellCheck="false"/>
              </div>
              {/* OMDb key */}
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl hover:border-[#19446C]/50 shadow-lg">
                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3 mb-2"><Star className="w-5 h-5 text-yellow-400"/>OMDb API Key (Optional)</h3>
                <p className="text-sm text-white/60 mb-6">Free key from <a href="https://www.omdbapi.com" target="_blank" rel="noreferrer" className="text-white underline hover:text-white/80">omdbapi.com</a> for IMDb, RT, and Metacritic ratings.</p>
                <input type="text" value={omdbApiKey} onChange={e=>setOmdbApiKey(e.target.value)} placeholder="e.g. 8a7b6c5d" className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 font-mono text-sm text-white focus-visible:border-[#19446C] focus-visible:ring-2 focus-visible:ring-[#19446C]/50 outline-none transition-all" spellCheck="false"/>
              </div>
              {/* Gemini API key — FIX: new field */}
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl hover:border-[#19446C]/50 shadow-lg">
                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3 mb-2"><Sparkles className="w-5 h-5 text-[#19446C]"/>Gemini API Key (AI Search)</h3>
                <p className="text-sm text-white/60 mb-2">Required for the AI Search feature. Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-white underline hover:text-white/80">Google AI Studio</a>.</p>
                <p className="text-xs text-white/40 mb-6">Free tier: up to 1,500 requests/day. No credit card needed.</p>
                <input type="password" value={geminiApiKey} onChange={e=>setGeminiApiKey(e.target.value)} placeholder="AIza..." className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 font-mono text-sm text-white focus-visible:border-[#19446C] focus-visible:ring-2 focus-visible:ring-[#19446C]/50 outline-none transition-all" spellCheck="false"/>
              </div>
              {/* FIX: Sign out moved exclusively to settings */}
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl flex items-center justify-between hover:border-red-500/30 shadow-lg">
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3 mb-1"><LogOut className="w-5 h-5 text-red-400"/>Sign Out</h3>
                  <p className="text-sm text-white/60">Signed in as <span className="text-white">{user.email}</span></p>
                </div>
                <button onClick={()=>firebaseSignOut(auth)} className="px-6 py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl font-semibold hover:bg-red-500/30 transition-all outline-none">Sign Out</button>
              </div>
            </div>
          </div>
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
      {/* FIX: PersonModal renders at z-[200] on top of detail modal */}
      {selPerson&&(
        <PersonModal personId={selPerson} apiKey={apiKey}
          onClose={()=>setSelPerson(null)}
          onMediaClick={m=>{setSelPerson(null);setSelMedia(m);}}
        />
      )}
      {playMedia&&(
        <PlayerOverlay media={playMedia} config={playCfg}
          onClose={()=>setPlayMedia(null)}
          sourceKey={sourceKey}
          vidplusSettings={vidplusSettings}
          skipSettings={skipSettings}
        />
      )}
    </div>
  );
}
