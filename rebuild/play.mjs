import { SpellTimeline } from './core/timeline.mjs';
import { toContractEvent } from './core/event-envelope.mjs';
import { sweepCircle, moveCircle } from './core/spatial.mjs';
import { renderArcane } from './fx/arcane-renderer.mjs';
import { Locomotion, RUDEUS_LOCOMOTION_ASSETS as actorAssets } from './core/locomotion.mjs';
import { town } from './world/town-layout.mjs';
import { createLighting } from './render/lighting.mjs';
import { createActorRig, RUDEUS_CAST_POSE_META as castMeta } from './render/actor-rig.mjs';
import { SPELL_PLANE, spellAim, createSpellProjection, spellVisualPoint } from './core/spell-projection.mjs';
import { COPY } from './copy.mjs';
import { WaterSpearRenderer, preloadWaterSpear } from './fx/water-spear-renderer.mjs';
import { WindPressureRenderer } from './fx/wind-pressure-14.mjs';
import { createMinimap } from './ui/minimap.mjs';
import { MajorSpellRenderer, preloadMajorSeal } from './fx/major-spell-renderer.mjs';
import { createRuntimeAudio } from './realm/runtime-audio.mjs';
import { preloadMeowaActor10, createMeowaActor10 } from './render/meowa-actor-10.mjs';
import { createActorLighting } from './render/actor-lighting-11.mjs';
import { runtimePerformance, loaderPercent, releaseRecoveryMs, yieldToBrowser, clearTransientGraphics, compactWaterAudit } from './core/runtime-performance.mjs';

const $ = s => document.querySelector(s);
const P = window.Phaser;
const meowaRequested=new URLSearchParams(location.search).get('actor')!=='legacy';
const mobileRenderer=matchMedia('(pointer:coarse)').matches;
const AUDIT_VERSION='pressure14-curves';
const runtimeBudget=runtimePerformance({mobile:mobileRenderer,dpr:window.devicePixelRatio});
function loadingProgress(value){const percent=Math.max(0,Math.min(100,Math.round(value)));$('#loading-progress').style.width=percent+'%';$('#loading-percent').textContent=percent+'%';$('.loading-track').setAttribute('aria-valuenow',String(percent));}
const legacyText = {
  zh: {name:'鲁迪',area:'魔大陆 · 商旅市集',objective:'调查水井 · 走访市集',menu:'旅途暂歇',resume:'返回旅途',language:'语言',volume:'音量',touch:'触控',research:'制作样片 · 衣装待核证 · 音效为研究用合成音色',water:'水弹',dodge:'闪避',interact:'交互',well:'集水井',tent:'市集商棚',exit:'东侧商路',speaker:'商旅留下的字条',wellLine:'井水只够这支商队再等一天。东边的野兽堵住了装水的路。先清出一条安全的通道，营棚里还有备用水囊。',tentLine:'营棚下面放着药草和水囊。商旅们已经把空桶搬到井边，等道路安全后再出发。',blocked:'商路仍有野兽。也可以沿南侧岩坡绕开它们。',cleared:'商队可以出发了。远方的旅途尚未制作。',loot:'拾取药草 · 生命恢复',dry:'魔力不足，去营棚休息',rest:'在营棚补充了水与药草',hurt:'稳住脚步',defeat:'商旅把你带回营棚。此处为样片救援，不是死亡回归。',fallback:'新资产尚未齐备，当前为临时轮廓。'},
  ja: {name:'ルディ',area:'魔大陸 · 旅商人の市',objective:'井戸と市場の伝言',menu:'旅のひと休み',resume:'旅へ戻る',language:'言語',volume:'音量',touch:'タッチ操作',research:'制作サンプル · 衣装は確認中 · 音は研究用の合成音',water:'ウォーターボール',dodge:'回避',interact:'調べる',well:'集水井戸',tent:'市場の天幕',exit:'東の街道',speaker:'旅商人の書き置き',wellLine:'この水で待てるのは、あと一日。東の獣が水運びの道を塞いでいる。安全な道を開いてほしい。天幕には予備の水袋がある。',tentLine:'天幕には薬草と水袋。商人たちは空の桶を井戸に運び、道が安全になるのを待っている。',blocked:'街道にはまだ獣がいる。南の岩沿いを回ることもできる。',cleared:'商隊は出発できる。この先の旅はまだ制作されていない。',loot:'薬草を拾った · 体力回復',dry:'魔力が足りない。天幕で休もう',rest:'天幕で水と薬草を補充した',hurt:'足元に気をつけて',defeat:'商人に天幕へ運ばれた。サンプルの救助であり、死に戻りではない。',fallback:'新素材は準備中。現在は仮の輪郭。'}
};
const text = COPY;
let lang='zh', volume=.35, paused=false, scene, audio, lightsEnabled=true, chantEnabled=false;
const keys=new Set(), moveTouch={x:0,y:0}, aimTouch={x:1,y:0};
const padCancels=new Set();
function cancelPads(reason){for(const cancel of padCancels)cancel(reason);}
const touchMedia=matchMedia('(pointer:coarse)'),touchSettingKey='mushoku-rebuild-touch';
let touchOverride=null;
try{const stored=localStorage.getItem(touchSettingKey);if(stored==='true'||stored==='false')touchOverride=stored==='true';}catch{}
let touchAim=false,touchEnabled=touchOverride??(touchMedia.matches||innerWidth<=600);
const t=k=>text[lang][k];
const normalize=(x,y)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const houndArt=Object.freeze({sourceRect:[22,295,1214,725],root:[733,951],scale:42/719,candidate:true,singlePose:true});
const idleStaffTips=[[210,237],[215,244],[403,241],[413,236]];
function notify(k){$('#message').textContent=t(k);$('#message').classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#message').classList.remove('visible'),3200);}
function localize(){document.documentElement.lang=lang==='zh'?'zh-CN':'ja';for(const [id,k] of [['name','name'],['area','area'],['objective','objective'],['menu-title','menu'],['resume','resume'],['language-label','language'],['volume-label','volume'],['touch-label','touch'],['spell-name','water'],['dodge','dodge'],['touch-e','interact'],['dialog-close','resume']])($('#'+id).querySelector('[data-label]')||$('#'+id)).textContent=t(k);$('#light-label').textContent=lang==='zh'?'照明':'照明';$('#charging-label').textContent=lang==='zh'?'塑形':'成形';$('#menu').setAttribute('aria-label',lang==='zh'?'菜单':'メニュー');$('#menu').title=lang==='zh'?'菜单':'メニュー';$('#game').setAttribute('aria-label',t('area'));$('#stick').setAttribute('aria-label',lang==='zh'?'移动':'移動');$('#aim-pad').setAttribute('aria-label',lang==='zh'?'拖曳瞄准并施法':'ドラッグで照準・水弾');if(!$('#dialog').hidden&&scene?.dialogKey)$('#line').textContent=t(scene.dialogKey);$('#speaker').textContent=t('speaker');}
function sound(kind){if(!volume)return;try{audio||=new AudioContext();audio.resume();const now=audio.currentTime;const o=audio.createOscillator(),g=audio.createGain();const f={gather:260,release:520,wall:150,flesh:85,dodge:300,loot:720,step:70}[kind]||200;o.type=kind==='wall'||kind==='flesh'?'triangle':'sine';o.frequency.setValueAtTime(f,now);o.frequency.exponentialRampToValueAtTime(Math.max(30,f*.35),now+.16);g.gain.setValueAtTime(volume*(kind==='step'?.025:.13),now);g.gain.exponentialRampToValueAtTime(.001,now+.22);o.connect(g).connect(audio.destination);o.start();o.stop(now+.23);if(['release','wall','flesh'].includes(kind)){const b=audio.createBuffer(1,audio.sampleRate*.2,audio.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length)**2;const n=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();n.buffer=b;filter.type='lowpass';filter.frequency.value=kind==='flesh'?650:1800;gain.gain.value=volume*.17;n.connect(filter).connect(gain).connect(audio.destination);n.start();}}catch{}}
function pause(value){paused=value;document.body.dataset.paused=String(value);keys.clear();if(value)cancelPads('pause');moveTouch.x=moveTouch.y=0;touchAim=false;if(value)scene?.cancelChannel('pause');scene?.sim.setPaused(value);scene?.eventsFromSim();if(value)audio?.suspend();else audio?.resume();}
function menu(){if(!$('#dialog').hidden){$('#dialog').hidden=true;pause(false);return;}const open=$('#overlay').hidden;$('#overlay').hidden=!open;pause(open);if(open)$('#resume').focus();}
$('#menu').onclick=menu;$('#resume').onclick=menu;$('#language').onchange=e=>{lang=e.target.value;localize();};$('#volume').oninput=e=>{volume=Number(e.target.value);scene?.realAudio?.setVolume(volume);};
$('#water-cast').onclick=()=>{if(scene?.channel?.source==='toggle')scene.releaseChannel('toggle');else scene?.beginChannel('toggle');};
$('#chant-toggle').onchange=e=>{chantEnabled=e.target.checked;if(!chantEnabled)scene?.realAudio?.stopChant();};
$('#language').addEventListener('change',()=>{$('#chant-label').textContent=lang==='ja'?'オリジナル詠唱演出':'原创咏唱演出';});
function touchUI(){if(!touchEnabled)cancelPads('touch-disabled');document.body.dataset.touch=String(touchEnabled);$('#touch').hidden=!touchEnabled;$('#touch-toggle').checked=touchEnabled;}
function touchObservations(){const coarse=touchMedia.matches,narrow=innerWidth<=600;return {actual:touchEnabled,requested:touchOverride??(coarse||narrow),manualOverride:touchOverride,source:touchOverride===null?'default':'manual',defaultSource:coarse?(narrow?'coarse+narrow':'coarse'):narrow?'narrow':'fine-wide'};}
function auditMessages(value){const items=Array.isArray(value)?value.slice(0,8):value==null?[]:[value],messages=[];for(const item of items){const message=typeof item==='string'?item:typeof item?.code==='string'?item.code:typeof item?.message==='string'?item.message:'wind-diagnostic';const short=message.replace(/\s+/g,' ').trim().slice(0,160);if(short&&!messages.includes(short))messages.push(short);}return messages.slice(0,4);}
function windBudgetObservation(budget){if(!budget)return null;const out={};for(const key of ['graphicsLimit','graphics','imageLimit','decodedBytes','points','pointLimit','streams','segments','tracers','textureLimitBytes','exceedsTextureBudget','scope']){const value=budget[key];if(typeof value==='boolean'||Number.isFinite(value))out[key]=value;else if(typeof value==='string')out[key]=value.slice(0,96);}return out;}
$('#touch-toggle').onchange=e=>{touchOverride=!!e.target.checked;touchEnabled=touchOverride;try{localStorage.setItem(touchSettingKey,String(touchOverride));}catch{}touchUI();};
function followTouchDefault(){touchEnabled=touchOverride??(touchMedia.matches||innerWidth<=600);touchUI();}
addEventListener('resize',followTouchDefault);
if(touchMedia.addEventListener)touchMedia.addEventListener('change',followTouchDefault);else touchMedia.addListener(followTouchDefault);
$('#light-toggle').onchange=e=>{lightsEnabled=e.target.checked;scene?.lighting?.setEnabled(lightsEnabled);if(scene){scene.dynamicLighting?.forEach(e=>e.rig.setEnabled(lightsEnabled&&e.active));scene.lightDirty=true;}};
function dialogue(key){scene.dialogKey=key;$('#speaker').textContent=t('speaker');$('#line').textContent=t(key);$('#dialog').hidden=false;pause(true);$('#dialog-close').focus();}
$('#dialog-close').onclick=()=>{$('#dialog').hidden=true;pause(false);};
$('#interact').onclick=()=>scene?.interact();$('#touch-e').onclick=()=>scene?.interact();$('#dodge').onpointerdown=e=>{e.preventDefault();scene?.dodge();};
const textInput=()=>/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)||document.activeElement?.isContentEditable;
addEventListener('keydown',e=>{if(e.code==='Space'&&document.activeElement?.tagName==='BUTTON')e.stopImmediatePropagation();},true);
addEventListener('keydown',e=>{if(e.code==='Escape'&&!e.repeat){menu();return;}if(paused||textInput())return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(!e.repeat){if(e.code==='ShiftLeft'||e.code==='ShiftRight')scene?.dodge();if(e.code==='KeyE')scene?.interact();if(e.code==='Digit1'){scene?.cancelChannel('instant');scene?.cast();}if(e.code==='Space')scene?.beginChannel('key:Space');}});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space'){if(textInput())scene?.cancelChannel('focus');else scene?.releaseChannel('key:Space');}});addEventListener('blur',()=>{if(scene&&!paused){$('#overlay').hidden=false;pause(true);}});document.addEventListener('visibilitychange',()=>{if(document.hidden&&scene&&!paused){$('#overlay').hidden=false;pause(true);}});
function bindPad(id,aim){
  const el=$(id);let pointer=null;
  const reset=()=>{if(aim)touchAim=false;else{moveTouch.x=moveTouch.y=0;el.querySelector('i').style.transform='';}};
  const finish=(release,reason)=>{
    const captured=pointer;pointer=null;reset();
    // Clear ownership before releasing capture: lostpointercapture must not cancel a normal release.
    if(captured!==null){try{if(el.hasPointerCapture(captured))el.releasePointerCapture(captured);}catch{}
      if(aim){const source='touch:'+captured;if(release)scene?.releaseChannel(source);else if(scene?.channel?.source===source)scene.cancelChannel(reason);}}
  };
  const cancel=reason=>finish(false,reason);padCancels.add(cancel);
  const update=e=>{const r=el.getBoundingClientRect(),dx=e.clientX-r.x-r.width/2,dy=e.clientY-r.y-r.height/2;if(aim){if(Math.hypot(dx,dy)>8){Object.assign(aimTouch,normalize(dx,dy));touchAim=true;scene?.setAim(aimTouch);}}else{moveTouch.x=clamp(dx/38,-1,1);moveTouch.y=clamp(dy/38,-1,1);el.querySelector('i').style.transform=`translate(${moveTouch.x*26}px,${moveTouch.y*26}px)`;}};
  el.onpointerdown=e=>{if(paused||!touchEnabled||pointer!==null)return;e.preventDefault();pointer=e.pointerId;el.setPointerCapture(pointer);update(e);if(aim)scene?.beginChannel('touch:'+pointer);};
  el.onpointermove=e=>{if(paused||!touchEnabled){cancel(paused?'pause':'touch-disabled');return;}if(e.pointerId===pointer)update(e);};
  const end=e=>{if(e.pointerId!==pointer)return;finish(e.type==='pointerup'&&!paused&&touchEnabled,'pointer');};
  el.onpointerup=el.onpointercancel=el.onlostpointercapture=end;
}
bindPad('#stick',false);bindPad('#aim-pad',true);localize();touchUI();window.lucide?.createIcons();
const minimap=createMinimap($('#minimap-canvas'),town);
function localizeHudTools(){document.querySelectorAll('[data-ui-zh]').forEach(button=>{const label=button.dataset[lang==='ja'?'uiJa':'uiZh'];button.title=label;button.setAttribute('aria-label',label);});$('#minimap').setAttribute('aria-label',lang==='ja'?'ミニマップ':'小地图');}
$('#language').addEventListener('change',localizeHudTools);localizeHudTools();

const objects=town.props.map(p=>({...p}));
const ridges=town.ridges;
function inPoly(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
class Camp extends P.Scene {
  constructor(){super('camp');}
  preload(){this.missing=[];this.load.on('progress',value=>loadingProgress(loaderPercent(value)));this.load.on('loaderror',f=>this.missing.push(f.key));preloadWaterSpear(this);preloadMajorSeal(this);if(meowaRequested)this.actor10Manifest=preloadMeowaActor10(this);this.load.image('kitRaw','assets/world-kit.png');if(!meowaRequested){this.load.image('idleRaw',actorAssets.idle.path);this.load.image('castRaw',castMeta.path);}this.load.image('groundRaw','assets/ground-kit.png');this.load.image('villageRaw','assets/village-buildings-10.png');this.load.image('pavingRaw','assets/town-paving-v3.png');this.load.image('houndRaw','assets/demon-hound-v3.png');}
  async cutAtlas(source,key,cols,rows){
    if(!this.textures.exists(source))return;
    const im=this.textures.get(source).getSourceImage();
    if(key==='rudy'||key==='idle'||key==='cast'){for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const left=Math.floor(x*im.width/cols),top=Math.floor(y*im.height/rows),w=Math.floor((x+1)*im.width/cols)-left,h=Math.floor((y+1)*im.height/rows)-top,cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');ctx.drawImage(im,left,top,w,h,0,0,w,h);const pixels=ctx.getImageData(0,0,w,h);
      if(key==='idle'||key==='cast'){const seen=new Uint8Array(w*h);let largest=[];for(let i=0;i<w*h;i++){if(seen[i]||pixels.data[i*4+3]<16)continue;const part=[i];seen[i]=1;for(let j=0;j<part.length;j++){const v=part[j],xx=v%w,yy=Math.floor(v/w);for(const n of [xx>0?v-1:-1,xx<w-1?v+1:-1,yy>0?v-w:-1,yy<h-1?v+w:-1])if(n>=0&&!seen[n]&&pixels.data[n*4+3]>=16){seen[n]=1;part.push(n);}}if(part.length>largest.length)largest=part;}const keep=new Uint8Array(w*h);for(const i of largest)keep[i]=1;for(let i=0;i<w*h;i++)if(!keep[i])pixels.data[i*4+3]=0;}
      else for(let i=0;i<w*h;i++)if(pixels.data[i*4+3]<16)pixels.data[i*4+3]=0;
      ctx.putImageData(pixels,0,0);this.textures.addCanvas(key+':'+(y*cols+x),cv);await this.loadingStage(94);
    }return;}
    const boxes=[[16,25,317,333],[340,53,627,336],[655,13,973,347],[988,94,1236,345],[20,372,315,646],[367,415,612,643],[637,458,960,651],[991,443,1226,635],[28,657,303,887],[360,729,620,884],[709,691,908,876],[991,708,1213,884],[20,923,351,1216],[409,919,606,1222],[700,968,884,1209],[965,914,1228,1225]];
    // Measured component rectangles supersede the generated sheet's nominal grid.
    for(let index=0;index<boxes.length;index++){
      const [x0,y0,x1,y1]=boxes[index],left=Math.max(0,x0-2),top=Math.max(0,y0-2),w=Math.min(im.width,x1+2)-left,h=Math.min(im.height,y1+2)-top;
      if(im.width!==1254||im.height!==1254){this.missing.push('kit-layout-version');return;}
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');ctx.drawImage(im,left,top,w,h,0,0,w,h);const pixels=ctx.getImageData(0,0,w,h),seen=new Uint8Array(w*h);let best=[];
      for(let i=0;i<w*h;i++){if(seen[i]||pixels.data[i*4+3]<40)continue;const component=[i];seen[i]=1;for(let q=0;q<component.length;q++){const v=component[q],x=v%w,y=Math.floor(v/w);for(const n of [x>0?v-1:-1,x<w-1?v+1:-1,y>0?v-w:-1,y<h-1?v+w:-1])if(n>=0&&!seen[n]&&pixels.data[n*4+3]>=40){seen[n]=1;component.push(n);}}if(component.length>best.length)best=component;}
      if(!best.length)continue;const mask=new Uint8Array(w*h);for(const i of best)mask[i]=1;if(index!==9){for(let i=0;i<mask.length;i++)if(!mask[i])pixels.data[i*4+3]=0;ctx.putImageData(pixels,0,0);}this.textures.addCanvas(key+index,cv);await this.loadingStage(90+4*(index+1)/boxes.length);
    }
  }
  create(){
    this.initializing=true;this.initializationStopped=false;
    this.events.once('shutdown',()=>{this.initializationStopped=true;if(scene===this)scene=null;});
    this.initializeScene().catch(error=>{if(this.initializationStopped)return;this.initializationError=String(error);console.error('Camp initialization failed',error);});
  }
  async loadingStage(percent){loadingProgress(percent);await yieldToBrowser();if(this.initializationStopped)throw new Error('Scene initialization cancelled');}
  async initializeScene(){this.timeMs=0;this.player={x:town.spawn.x,y:town.spawn.y,hp:100,aim:{x:1,y:0},inv:0,dodge:0,dodgeReady:0,row:2};this.sim=new SpellTimeline({mana:70,skills:[{id:'water',cost:7,windupTicks:0,cooldownTicks:30}]});this.eventsLog=[];this.shots=[];this.splashes=[];this.drops=[];this.releases=0;this.impacts={wall:0,flesh:0};this.frameTimes=[];this.castStart=-1000;this.releaseTime=-1000;this.renderObjects=[];this.enemyList=[{x:1210,y:650,hp:45,phase:'idle',until:0},{x:1310,y:650,hp:45,phase:'idle',until:0}];
    await this.loadingStage(90);await this.cutAtlas('kitRaw','kit',4,4);this.cutTown();if(!meowaRequested){await this.cutAtlas('idleRaw','idle',2,2);await this.cutAtlas('castRaw','cast',2,2);}await this.loadingStage(95);this.locomotion=new Locomotion({facingRow:2});this.ground=this.add.graphics().setDepth(-100);this.makeTerrain();await this.loadingStage(96);this.buildColliders();this.makeFallbacks();this.cutHound();this.propShadows=this.add.graphics().setDepth(-1);
    for(const o of objects){const key=(o.asset==='town'?'town':'kit')+o.i,has=this.textures.exists(key),frame=has?this.textures.getFrame(key,o.frame):null;if(frame)o.h=o.w*frame.cutHeight/frame.cutWidth;const origin=o.origin||[.5,frame?(frame.cutHeight-2)/frame.cutHeight:252/256];this.propShadows.fillStyle(0x263035,.2).fillEllipse(o.x,o.y,o.w*.3,5);const sprite=this.add.image(o.x,o.y,has?key:'traveler',o.frame).setOrigin(...origin).setDisplaySize(o.w,o.h).setDepth(o.layer==='ground'?-2:o.y);this.renderObjects.push({o,sprite});}
    await this.loadingStage(97);this.makeLighting();await this.loadingStage(98);this.initOcclusion();this.actor=this.add.sprite(this.player.x,this.player.y,'traveler').setOrigin(.5,58/64).setDisplaySize(52,52);this.rig=meowaRequested?null:createActorRig(this,{idleKeys:[0,1,2,3].map(i=>'idle:'+i),assetMeta:actorAssets.idle,phaseMode:'stylized',strideDistance:78,supportedRows:[0,1,2,3],castKeys:[0,1,2,3].map(i=>'cast:'+i),castMeta});this.actor.setVisible(false);if(meowaRequested)this.initMeowa();this.events.once('shutdown',()=>this.rig?.destroy());this.applyPose(this.locomotion.snapshot());this.actorShadow=this.add.ellipse(0,0,18,5,0x18262c,.3);this.enemyList.forEach(e=>{const hound=this.textures.exists('demonHound');e.sprite=this.add.image(e.x,e.y,hound?'demonHound':'beast');if(hound)e.sprite.setOrigin((houndArt.root[0]-houndArt.sourceRect[0])/houndArt.sourceRect[2],(houndArt.root[1]-houndArt.sourceRect[1])/houndArt.sourceRect[3]).setScale(houndArt.scale);else e.sprite.setOrigin(.5,.85).setDisplaySize(46,46);e.shadow=this.add.ellipse(e.x,e.y,hound?48:32,8,0x17252a,.35);});
    this.groundFX=this.add.graphics().setDepth(-.5);this.fx=this.add.graphics();this.threat=this.add.graphics().setDepth(2000);this.target=this.add.graphics().setDepth(2001);const c=this.cameras.main;c.setBounds(0,0,town.width,town.height);c.setBackgroundColor('#65756a');c.startFollow(this.actor,true,.12,.12);c.setRoundPixels(true);const resize=()=>{const w=this.scale.width,h=this.scale.height;const z=Math.min(3,w<h?w/360:w/900);c.setSize(w,h);c.setZoom(z);c.setFollowOffset(0,120/z);c.setBounds(0,0,town.width,town.height);c.centerOn(this.player.x,this.player.y-120/z);};resize();this.scale.on('resize',resize);this.events.once('shutdown',()=>this.scale.off('resize',resize));
    this.input.on('pointermove',p=>{if(paused||p.pointerType==='touch'||touchEnabled)return;this.aimAt(c.getWorldPoint(p.x,p.y));});this.input.on('pointerdown',p=>{if(!paused&&!touchEnabled&&p.leftButtonDown()){this.aimAt(c.getWorldPoint(p.x,p.y));this.beginChannel('mouse');}});this.input.on('pointerup',p=>{if(!paused&&!touchEnabled&&p.button===0)this.releaseChannel('mouse');});this.input.on('gameout',()=>{if(this.channel?.source==='mouse')this.cancelChannel('pointer');});this.input.mouse.disableContextMenu();await this.loadingStage(99);
    this.player.bodyRow=2;this.player.bodyFacing={x:1,y:0};this.poseFrame=0;this.walking=false;
    this.waterFX=new WaterSpearRenderer(this);
    try{this.windFX=new WindPressureRenderer(this);this.windOutput=this.windFX.update({holding:false});}catch(error){this.windError=String(error);this.missing.push('wind14-curves');}
    this.sealFX=new MajorSpellRenderer(this);
    this.realAudio=createRuntimeAudio({volume});
    this.events.once('shutdown',()=>{this.windFX?.hide();this.windFX?.destroy();this.waterFX.destroy();this.sealFX.destroy();this.realAudio.destroy();});
    this.auditOutput=document.createElement('output');this.auditOutput.id='rebuild-audit';this.auditOutput.hidden=true;document.body.append(this.auditOutput);
    this.events.once('shutdown',()=>this.auditOutput.remove());
    if(!window.__audit)Object.defineProperty(window,'__audit',{configurable:false,value:Object.freeze({snapshot:()=>scene?scene.audit(scene.cameras.main):Object.freeze({ready:false})})});
    if(meowaRequested){this.meowaOutput=document.createElement('output');this.meowaOutput.id='actor-experiment-audit';this.meowaOutput.hidden=true;document.body.append(this.meowaOutput);this.syncMeowaAudit();this.events.once('shutdown',()=>this.meowaOutput.remove());}
    await this.loadingStage(100);this.sim.setPaused(paused);this.initializing=false;scene=this;$('#loading').hidden=true;if(this.missing.length)notify('fallback');
  }


  hideWind(reason){
    this.windFX?.hide();
    if(this.windFX)this.windOutput=this.windFX.update({holding:false,paused:reason==='pause',cancelled:reason!=='release',released:reason==='release'});
    this.windInput=null;this.windHiddenReason=reason;
  }
  renderWind(channel){
    // Only the actually rendered water cone owns this tip. Never invent it from the staff.
    const tip=this.waterOutput?.anchors?.tip,holding=!paused&&channel.shaping&&channel.elapsed>=6000&&!!this.waterOutput?.byStage?.formation&&!!tip;
    if(!this.windFX)return;
    const input={timeMs:this.timeMs,ageMs:Math.max(0,channel.elapsed-6000),holding,
      tip:tip?{...tip}:null,aim:{...this.player.aim},progress:clamp((channel.elapsed-6000)/6000,0,1),
      depth:{back:this.player.y-.1,front:this.player.y+.3},paused};
    this.windInput=input;this.windOutput=this.windFX.update(input);
    this.windHiddenReason=holding?null:'outside-cone-hold';
  }
  windObservations(){const out=this.windOutput;return {status:this.windError?'error':!this.windFX?'unavailable':out?.active?'active':'hidden',mode:out?.mode??null,
    stage:out?.stage??null,frame:out?.frame??null,phase:out?.phase??0,active:out?.active??0,allocated:out?.allocated??0,
    input:this.windInput?{source:'waterOutput.anchors.tip',tip:this.windInput.tip?{...this.windInput.tip}:null,aim:{...this.windInput.aim},progress:this.windInput.progress,ageMs:this.windInput.ageMs,holding:this.windInput.holding}:null,
    missing:auditMessages(out?.missingTextures),diagnostics:auditMessages(this.windError??out?.diagnostics),
    hiddenReason:this.windHiddenReason??null,budget:windBudgetObservation(out?.budget),legacyPressureFlow:false,bitmapWind:false};}
  syncMeowaAudit(){if(this.meowaOutput)this.meowaOutput.textContent=JSON.stringify({version:'meowa-four-direction-10',loaded:!!this.actor10,actor:this.actor10?.debug??null,position:{x:this.player.x,y:this.player.y},action:this.action||'idle',paused});}
  initMeowa(){
    this.actor10=createMeowaActor10(this,{manifest:this.actor10Manifest,row:2,foot:this.player});
    this.rig?.container.setVisible(false);
    this.actorLight=createActorLighting(this);
    this.events.once('shutdown',()=>this.actorLight.destroy());
    this.events.once('shutdown',()=>this.actor10.destroy());
    return;
    const anchors=this.cache.json.get('meowaAnchors'),walk=this.textures.exists('meowaWalkRaw')?this.textures.get('meowaWalkRaw').getSourceImage():null,idle=this.textures.exists('meowaIdleRaw')?this.textures.get('meowaIdleRaw').getSourceImage():null;
    if(!walk||!idle||walk.width!==2560||walk.height!==1920||idle.width!==1254||idle.height!==1254||anchors?.normalization?.bodyHeightSourcePx!==534||anchors.frames?.length!==12||anchors.frames.some((f,i)=>f.frame!==i||!Number.isFinite(f.pelvisX)||!Number.isFinite(f.supportY))){this.meowaFailure='asset-or-anchor-contract';return;}
    const owned=[];for(let i=0;i<12;i++){const cv=document.createElement('canvas');cv.width=cv.height=640;const ctx=cv.getContext('2d');ctx.drawImage(walk,(i%4)*640,Math.floor(i/4)*640,640,640,0,0,640,640);const pixels=ctx.getImageData(0,0,640,640);for(let p=3;p<pixels.data.length;p+=4)if(pixels.data[p]<16)pixels.data[p]=0;ctx.putImageData(pixels,0,0);const key='meowa:walk:'+i;this.textures.addCanvas(key,cv).setFilter(P.Textures.FilterMode.LINEAR);owned.push(key);}
    this.textures.get('meowaIdleRaw').setFilter(P.Textures.FilterMode.LINEAR);
    const container=this.add.container(this.player.x,this.player.y),walkImage=this.add.image(0,0,'meowa:walk:0').setScale(48/534),idleImage=this.add.image(0,0,'meowaIdleRaw').setScale(48/1119);container.add([walkImage,idleImage]);this.meowa={container,walkImage,idleImage,anchors,phase:0,frame:0,row:2,active:false,moving:false,startTime:null,startAlpha:0,stopStart:null,stopAlpha:0};container.setVisible(false);
    this.events.once('shutdown',()=>{container.destroy();for(const key of owned)this.textures.remove(key);});
  }
  updateMeowa(pose,traveled){
    const m=this.meowa;if(!m)return;const p=this.player,side=pose.facingRow===1||pose.facingRow===2,eligible=side&&!['cast','dodge'].includes(pose.state);
    m.active=eligible;m.container.setVisible(eligible).setPosition(p.x,p.y).setDepth(p.y).setAlpha(this.actor.alpha);this.rig?.container.setVisible(!eligible);
    if(!eligible){m.moving=false;m.startTime=null;m.stopStart=null;m.walkImage.setAlpha(0).setVisible(false);m.idleImage.setAlpha(1).setVisible(true);return;}
    const moving=traveled>1e-6,flip=pose.facingRow===1;if(moving){if(!m.moving||m.row!==pose.facingRow){m.phase=0;m.startTime=this.timeMs;m.startAlpha=m.walkImage.alpha;}m.phase=(m.phase+traveled/35.0562)%1;m.frame=Math.min(11,Math.floor(m.phase*12));m.stopStart=null;const t=clamp((this.timeMs-m.startTime)/90,0,1),blend=t*t*(3-2*t);const alpha=m.startAlpha+(1-m.startAlpha)*blend;m.walkImage.setAlpha(alpha);m.idleImage.setAlpha(1-alpha);}
    else{if(m.moving){m.stopStart=this.timeMs;m.stopAlpha=m.walkImage.alpha;}const t=m.stopStart===null?1:clamp((this.timeMs-m.stopStart)/120,0,1),blend=t*t*(3-2*t);m.walkImage.setAlpha(m.stopAlpha*(1-blend));m.idleImage.setAlpha(1-m.walkImage.alpha);if(t===1){m.phase=0;m.frame=0;m.startTime=null;m.stopStart=null;m.stopAlpha=0;}}
    m.row=pose.facingRow;m.moving=moving;const anchor=m.anchors.frames[m.frame];m.walkImage.setTexture('meowa:walk:'+m.frame).setOrigin(flip?1-anchor.pelvisX/640:anchor.pelvisX/640,anchor.supportY/640).setFlipX(flip).setVisible(m.walkImage.alpha>0);m.idleImage.setOrigin(flip?1-650/1254:650/1254,1179/1254).setFlipX(flip).setVisible(m.idleImage.alpha>0);
  }
  meowaObservations(){return {requested:meowaRequested,loaded:!!this.actor10,mode:meowaRequested?'meowa-four-direction-12':'legacy',supportedRows:[0,1,2,3],contactUnverified:true,actor:this.actor10?.debug??null,receivesDynamicLight:false};}

  initOcclusion(){this.alphaCache=new Map();this.occlusionStates=new Map();this.occlusionSamples=[];this.occlusionLastTime=this.timeMs;this.occlusionCpu=[];}
  sourceAlpha(sprite){const key=sprite.texture.key;if(this.alphaCache.has(key))return this.alphaCache.get(key);const source=sprite.texture.getSourceImage(),cv=document.createElement('canvas');cv.width=source.width;cv.height=source.height;const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);const rgba=ctx.getImageData(0,0,cv.width,cv.height).data,alpha=new Uint8Array(cv.width*cv.height);for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];const cached={width:cv.width,height:cv.height,alpha};this.alphaCache.set(key,cached);return cached;}
  alphaAt(sprite,point){const dx=point.x-sprite.x,dy=point.y-sprite.y,c=Math.cos(sprite.rotation),s=Math.sin(sprite.rotation),frame=sprite.frame;let x=(dx*c+dy*s)/sprite.scaleX+sprite.displayOriginX,y=(-dx*s+dy*c)/sprite.scaleY+sprite.displayOriginY;if(x<0||y<0||x>=frame.cutWidth||y>=frame.cutHeight)return 0;x=Math.floor(x);y=Math.floor(y);if(sprite.flipX)x=frame.cutWidth-1-x;if(sprite.flipY)y=frame.cutHeight-1-y;const data=this.sourceAlpha(sprite),px=x+frame.cutX,py=y+frame.cutY;return data.alpha[py*data.width+px]||0;}
  updateOcclusion(){
    const started=performance.now(),p=this.player,points=[{x:p.x,y:p.y-39},{x:p.x-5,y:p.y-29},{x:p.x+5,y:p.y-29},{x:p.x-4,y:p.y-20},{x:p.x+4,y:p.y-20}],observations=[],tested=[];
    const apply=(id,sprite,minimum,base=1)=>{
      let hits=0,values=[];const bounds=sprite.getBounds(),eligible=sprite.visible&&sprite.depth>p.y&&points.some(q=>bounds.contains(q.x,q.y));
      if(eligible){values=points.map(q=>this.alphaAt(sprite,q));hits=values.filter(a=>a>=96).length;tested.push({id,hits,sourceAlpha:values});}
      const blocked=hits>=2,target=blocked?minimum:base;let state=this.occlusionStates.get(id);
      if(!state){state={alpha:base,target:base,from:base,start:this.timeMs,duration:140};this.occlusionStates.set(id,state);}
      if(state.target!==target){state.from=state.alpha;state.target=target;state.start=this.timeMs;state.duration=id.startsWith('enemy:')&&blocked?40:140;}
      const t=clamp((this.timeMs-state.start)/state.duration,0,1);state.alpha=state.from+(state.target-state.from)*t*t*(3-2*t);sprite.setAlpha(state.alpha);
      if(id.startsWith('prop:')){const surfaceId=id.slice(5);this.lighting?.setSurfaceOpacity(surfaceId,state.alpha);this.dynamicLighting?.get(surfaceId)?.rig.setSurfaceOpacity(surfaceId,state.alpha);}
      if(blocked||state.alpha<base-.001)observations.push({id,depth:sprite.depth,alpha:sprite.alpha,target,durationMs:state.duration,blocked,hits,sourceAlpha:values,staticOpacity:id.startsWith('prop:')?this.lighting?.debug.entries.find(e=>e.id===id.slice(5))?.opacity:null,dynamicOpacity:id.startsWith('prop:')?this.dynamicLighting?.get(id.slice(5))?.rig.debug.entries[0]?.opacity:null});
    };
    for(const {o,sprite} of this.renderObjects)if(o.layer!=='ground')apply('prop:'+o.id,sprite,.45);
    this.enemyList.forEach((e,i)=>{if(e.hp>0)apply('enemy:'+i,e.sprite,.4);else{e.sprite.setAlpha(.25);this.occlusionStates.delete('enemy:'+i);}});
    this.occlusionSamples=observations;this.occlusionTested=tested;this.occlusionPoints=points;this.occlusionCpu.push(performance.now()-started);if(this.occlusionCpu.length>360)this.occlusionCpu.shift();
  }
  updatePlayerFeedback(){const hit=this.timeMs-(this.playerHitTime??-1000)<160;for(const piece of this.rig?.container.list||[]){if(hit&&piece.visible&&(!meowaRequested||this.rig.container.visible))piece.setTint?.(0xffd6a0);else piece.clearTint?.();}if(this.meowa)for(const piece of [this.meowa.walkImage,this.meowa.idleImage]){if(hit&&this.meowa.active&&piece.visible)piece.setTint(0xffd6a0);else piece.clearTint();}}
  trackedOcclusion(){return [...this.renderObjects.filter(({o})=>o.layer!=='ground').map(({o,sprite})=>({id:'prop:'+o.id,alpha:sprite.alpha,target:this.occlusionStates.get('prop:'+o.id)?.target??1,depth:sprite.depth})),...this.enemyList.map((e,i)=>({id:'enemy:'+i,alpha:e.sprite.alpha,target:e.hp<=0?.25:this.occlusionStates.get('enemy:'+i)?.target??1,depth:e.sprite.depth,alive:e.hp>0}))];}
  occlusionObservations(){return {mode:'whole-object-local-source-alpha',propEnterMs:140,propExitMs:140,enemyEnterMs:40,enemyExitMs:140,threshold:96,minimumHits:2,propMinimum:.45,enemyMinimum:.4,cachedTextures:this.alphaCache?.size||0,probes:this.occlusionPoints||[],tested:this.occlusionTested||[],active:this.occlusionSamples||[],tracked:this.trackedOcclusion(),player:{alpha:this.actor.alpha,rigAlpha:this.rig?.container.alpha,hitTintRemaining:Math.max(0,160-(this.timeMs-(this.playerHitTime??-1000))),pieces:(this.rig?.container.list||[]).filter(piece=>piece.texture).map(piece=>({key:piece.texture.key,visible:piece.visible,tinted:piece.isTinted,tint:piece.tintTopLeft}))},cpuP95:this.occlusionCpu?.length?[...this.occlusionCpu].sort((a,b)=>a-b)[Math.floor(this.occlusionCpu.length*.95)]:0};}

  rigObservations(){const container=this.rig?.container;if(!container)return null;return {pieceCoordinateSpace:'container-local',visible:container.visible,alpha:container.alpha,x:container.x,y:container.y,rotation:container.rotation,scaleX:container.scaleX,scaleY:container.scaleY,depth:container.depth,totalChildren:container.list.length,visiblePieces:container.list.filter(piece=>piece.visible).map(piece=>({key:piece.texture?.key??null,x:piece.x,y:piece.y,scaleX:piece.scaleX,scaleY:piece.scaleY,rotation:piece.rotation,originX:piece.originX,originY:piece.originY,alpha:piece.alpha,visible:piece.visible}))};}
  audit(c){
    const p=this.player,freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
    return freeze({ready:true,version:AUDIT_VERSION,touch:touchObservations(),actorExperiment:this.meowaObservations(),wind:this.windObservations(),occlusion:this.occlusionObservations(),rendererType:this.game.renderer.type,runtimeBudget:{...runtimeBudget},textureCount:Object.keys(this.textures.list).length,lighting:this.lighting?{...this.lighting.debug,updateHz:runtimeBudget.lightingHz,startupMs:this.lightStartupMs,dynamicSurfaces:this.dynamicLighting.size,dynamicDroppedSurfaces:this.lightDroppedSurfaces||0,updateP95:this.lightSamples.length?[...this.lightSamples].sort((a,b)=>a-b)[Math.floor(this.lightSamples.length*.95)]:0,lastUpdate:this.lastLightTime,lightCount:(this.fxLights?.length||0)+(this.environmentSlots||0),environmentCachedSlots:this.environmentCachedSlots,environmentLights:this.environmentLights.slice(0,this.environmentSlots).map(l=>({...l}))}:null,rigObservations:this.rigObservations(),effectObservations:(this.effectObservations||[]).map(e=>({...e})),paused,language:lang,position:{x:p.x,y:p.y},effects:this.splashes.length+this.shots.length,bodyRow:p.bodyRow,frame:this.poseFrame,walking:this.walking,aim:{...p.aim},reticle:this.reticle?{...this.reticle}:null,action:this.action||'idle',walkDistance:this.walkDistance||0,channel:this.channelState(),staffAnchor:this.actualStaffAnchor(),releaseAnchor:this.releaseOrigin?{...this.releaseOrigin,direction:{...this.releaseAim}}:null,releaseProjection:this.releaseProjection?{...this.releaseProjection}:null,spellPlane:{...SPELL_PLANE,collisionCoordinates:'ground',cursorCoordinates:'projected-flight',lightCoordinates:'projected-display-world'},cooldownTicks:this.cooldownTicks(),lightingEnabled:lightsEnabled,world:{width:town.width,height:town.height,spawn:{...town.spawn},colliders:town.colliders.map(c=>({...c}))},
      assets:{kit:this.textures.exists('kit0'),rudy:this.textures.exists('rudy:0'),idle:this.textures.exists('idle:0'),cast:this.textures.exists('cast:0'),rigEnabled:!!this.rig,rigCandidate:this.rigPose?{candidate:true,visualAccepted:false,approval:'ART03-improvement-only',footLock:this.rigPose.footLock,expectedStanceSlip:this.rigPose.expectedStanceSlip,phase:this.rigPose.phase,fallback:this.rigPose.fallback}:null,paving:this.textures.exists('pavingRaw'),enemyArt:this.textures.exists('demonHound')?{key:'demonHound',...houndArt,rootMethod:'approximate-four-claw-ground-centroid',animationComplete:false}:null,missing:[...this.missing]},pose:{texture:this.actor.texture.key.startsWith('cast:')?'cast':this.pose?.texture,state:this.pose?.state,progress:this.pose?.progress,key:this.actor.texture.key,origin:{x:this.actor.originX,y:this.actor.originY},scale:this.actor.scaleX},player:{x:p.x,y:p.y,hp:p.hp,mana:this.sim.mana,aim:{...p.aim},bodyRow:p.bodyRow,bodyFacing:{...p.bodyFacing},frame:this.poseFrame,walking:this.walking},
      camera:{x:c.worldView.x,y:c.worldView.y,zoom:c.zoom,width:c.width,height:c.height},frames:this.renderObjects.map(({sprite})=>({key:sprite.texture.key,cutX:sprite.frame.cutX,cutY:sprite.frame.cutY,cutWidth:sprite.frame.cutWidth,sourceWidth:sprite.texture.source[0].width,sourceHeight:sprite.texture.source[0].height})),
      enemies:this.enemyList.map(e=>({x:e.x,y:e.y,hp:e.hp,phase:e.phase,visual:{key:e.sprite.texture.key,x:e.sprite.x,y:e.sprite.y,scaleX:e.sprite.scaleX,scaleY:e.sprite.scaleY,originX:e.sprite.originX,originY:e.sprite.originY,flipX:e.sprite.flipX,depth:e.sprite.depth,rotation:e.sprite.rotation}})),releases:this.releases,impacts:{...this.impacts},tick:this.sim.tick,projectileState:this.shots.map(shot=>({ground:{x:shot.x,y:shot.y},visual:spellVisualPoint(shot,shot.projection,shot.life),age:shot.life,direction:{x:shot.dx,y:shot.dy},projection:{...shot.projection}})),projectiles:this.shots.length,particles:this.splashes.length,loot:this.drops.length,events:this.eventsLog.slice(-20).map(e=>({...e})),frameP95:this.frameTimes.length?[...this.frameTimes].sort((a,b)=>a-b)[Math.floor(this.frameTimes.length*.95)]:0});
  }
  makeFallbacks(){if(!this.textures.exists('kit0')){const cv=document.createElement('canvas');cv.width=cv.height=1024;const ctx=cv.getContext('2d');for(let i=0;i<16;i++){ctx.save();ctx.translate(i%4*256,Math.floor(i/4)*256);ctx.fillStyle=i===2||i===7||i===8?'#526e59':'#83928a';ctx.strokeStyle='#263e43';ctx.lineWidth=7;ctx.beginPath();if([0,12,4].includes(i)){ctx.moveTo(30,210);ctx.lineTo(30,100);ctx.lineTo(126,38);ctx.lineTo(224,100);ctx.lineTo(224,210);ctx.closePath();}else{ctx.moveTo(42,214);ctx.lineTo(22,147);ctx.lineTo(76,68);ctx.lineTo(159,45);ctx.lineTo(231,137);ctx.lineTo(208,216);ctx.closePath();}ctx.fill();ctx.stroke();ctx.fillStyle='#c6d0ae';ctx.fillRect(100,144,42,68);ctx.restore();}this.textures.addSpriteSheet('fallback',cv,{frameWidth:256,frameHeight:256});}
    const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');x.fillStyle='#5a4238';x.fillRect(25,9,15,14);x.fillStyle='#dfbc92';x.fillRect(27,15,12,12);x.fillStyle='#8a9c91';x.fillRect(22,28,21,22);x.fillStyle='#33444b';x.fillRect(24,49,7,9);x.fillRect(36,49,7,9);x.fillStyle='#c4caae';x.fillRect(46,22,3,34);this.textures.addCanvas('traveler',cv);
    const b=document.createElement('canvas');b.width=b.height=64;const q=b.getContext('2d');q.fillStyle='#526879';q.beginPath();q.moveTo(6,42);q.lineTo(14,24);q.lineTo(23,31);q.lineTo(42,26);q.lineTo(52,12);q.lineTo(58,39);q.lineTo(49,48);q.lineTo(14,50);q.closePath();q.fill();q.fillStyle='#dce3c0';q.fillRect(45,29,6,3);q.fillStyle='#2a3f47';q.fillRect(14,47,6,9);q.fillRect(40,45,6,11);this.textures.addCanvas('beast',b);
  }
  makeTerrain(){
    const canvas=document.createElement('canvas');canvas.width=town.width;canvas.height=town.height;const ctx=canvas.getContext('2d'),materials=town.ground.materials,patterns={};
    if(this.textures.exists('groundRaw')){const im=this.textures.get('groundRaw').getSourceImage();for(const [name,m] of Object.entries(materials).filter(([,material])=>material.sourceRect)){
      const cv=document.createElement('canvas');cv.width=cv.height=160;const c=cv.getContext('2d');const [x,y,w,h]=m.sourceRect;c.drawImage(im,x,y,w,h,0,0,160,160);
      // Match opposite edges in RGB, preserving the interior instead of repeating a cut border.
      const pixels=c.getImageData(0,0,160,160),original=new Uint8ClampedArray(pixels.data),band=24;
      for(let yy=0;yy<160;yy++)for(let xx=0;xx<160;xx++)for(let k=0;k<3;k++){
        let value=original[(yy*160+xx)*4+k];const edge=Math.min(xx,159-xx);
        if(edge<band){const other=original[(yy*160+159-xx)*4+k];value+=(other-value)*.5*(1-edge/band);}
        pixels.data[(yy*160+xx)*4+k]=value;
      }
      const horizontal=new Uint8ClampedArray(pixels.data);
      for(let yy=0;yy<160;yy++)for(let xx=0;xx<160;xx++)for(let k=0;k<3;k++){const edge=Math.min(yy,159-yy),i=(yy*160+xx)*4+k;if(edge<band)pixels.data[i]=horizontal[i]+(horizontal[((159-yy)*160+xx)*4+k]-horizontal[i])*.5*(1-edge/band);}
      c.putImageData(pixels,0,0);patterns[name]=ctx.createPattern(cv,'repeat');
    }}
    patterns['ridge-rock']=patterns['mineral-rock'];
    if(this.textures.exists('pavingRaw')){const cv=document.createElement('canvas');cv.width=cv.height=448;const c=cv.getContext('2d'),im=this.textures.get('pavingRaw').getSourceImage();for(let y=0;y<2;y++)for(let x=0;x<2;x++){c.save();c.translate(x*224+(x?224:0),y*224+(y?224:0));c.scale(x?-1:1,y?-1:1);c.drawImage(im,0,0,224,224);c.restore();}patterns['packed-stone']=patterns['door-stone']=ctx.createPattern(cv,'repeat');}
    const polygon=points=>{const p=new Path2D(),last=points.at(-1),first=points[0];p.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];p.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);}p.closePath();return p;};
    const line=points=>{const p=new Path2D();p.moveTo(...points[0]);for(let i=1;i<points.length-1;i++){const a=points[i],b=points[i+1];p.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);}p.lineTo(...points.at(-1));return p;};
    const layer=document.createElement('canvas'),mask=document.createElement('canvas');layer.width=mask.width=town.width;layer.height=mask.height=town.height;const lc=layer.getContext('2d'),mc=mask.getContext('2d');
    const paint=(name,path,width=0,feather=10,opacity=.8,textureAlpha=materials[name]?.alpha??.18)=>{
      const m=materials[name]||materials[town.ground.base];lc.clearRect(0,0,layer.width,layer.height);mc.clearRect(0,0,mask.width,mask.height);
      lc.fillStyle=m.color;lc.fillRect(0,0,layer.width,layer.height);if(patterns[name]){lc.globalAlpha=textureAlpha;lc.fillStyle=patterns[name];lc.fillRect(0,0,layer.width,layer.height);lc.globalAlpha=1;}
      mc.filter='blur('+feather+'px)';mc.fillStyle=mc.strokeStyle='#fff';mc.lineJoin=mc.lineCap='round';mc.lineWidth=width;width?mc.stroke(path):mc.fill(path);mc.filter='none';
      lc.globalCompositeOperation='destination-in';lc.drawImage(mask,0,0);lc.globalCompositeOperation='source-over';ctx.globalAlpha=opacity;ctx.drawImage(layer,0,0);ctx.globalAlpha=1;
    };
    ctx.fillStyle=materials[town.ground.base].color;ctx.fillRect(0,0,canvas.width,canvas.height);if(patterns[town.ground.base]){ctx.globalAlpha=materials[town.ground.base].alpha??.18;ctx.fillStyle=patterns[town.ground.base];ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=1;}
    for(const river of town.rivers||[]){const path=polygon(river.points);ctx.save();ctx.clip(path);ctx.fillStyle='#347d88';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#aadbd2';ctx.globalAlpha=.3;ctx.lineWidth=2;for(let y=140;y<town.height;y+=23){ctx.beginPath();ctx.moveTo(120+Math.sin(y*.018)*10,y);ctx.bezierCurveTo(170,y+6,220,y-5,280,y+3);ctx.stroke();}ctx.restore();}
    for(const plaza of town.plazas)if(plaza.material!=='shallow-water')paint(plaza.material,polygon(plaza.points),0,plaza.feather??14,plaza.opacity??.82,plaza.textureAlpha??.18);
    for(const name of new Set(town.routes.map(r=>r.material))){const routes=town.routes.filter(r=>r.material===name);for(const route of routes)paint(name,line(route.points),route.width,route.feather??12,route.opacity??.7);}
    for(const plaza of town.plazas)if(plaza.drain){ctx.lineWidth=3;ctx.strokeStyle='#676d70';ctx.globalAlpha=.4;ctx.stroke(line(plaza.drain));ctx.globalAlpha=1;}
    for(const ridge of ridges){ctx.save();ctx.shadowColor='#26323a';ctx.shadowBlur=8;ctx.shadowOffsetX=8;ctx.shadowOffsetY=12;ctx.fillStyle='#89818f';ctx.fill(polygon(ridge));ctx.restore();paint('ridge-rock',polygon(ridge),0,5,.88);}
    this.textures.addCanvas('terrain',canvas);this.add.image(0,0,'terrain').setOrigin(0).setDepth(-100);
  }
  buildColliders(){
    this.staticColliders=town.colliders.map(c=>({...c}));
    for(let x=0;x<town.width;x+=12){let start=null;for(let y=0;y<=town.height;y+=8){const solid=y<town.height&&ridges.some(p=>inPoly(x+6,y+4,p));if(solid&&start===null)start=y;if(!solid&&start!==null){this.staticColliders.push({id:`ridge:${x}:${start}`,kind:'wall',shape:'aabb',x,y:start,width:12,height:y-start});start=null;}}}
    const b=town.bounds;this.staticColliders.push(...[{x:b.x-30,y:0,width:30,height:town.height},{x:b.x+b.width,y:0,width:30,height:town.height},{x:0,y:b.y-30,width:town.width,height:30},{x:0,y:b.y+b.height,width:town.width,height:30}].map((r,i)=>({id:'edge:'+i,kind:'wall',shape:'aabb',...r})));
  }
  cutTown(){
    if(this.textures.exists('villageRaw')){
      const image=this.textures.get('villageRaw').getSourceImage();
      const boxes=[[48,83,981,1005],[1040,184,1985,1010],[44,1103,1021,1913],[1094,1096,2003,1899]];
      const roots=[[650,995],[1634,1000],[640,1900],[1487,1886]];
      boxes.forEach(([x0,y0,x1,y1],i)=>{
        const width=x1-x0,height=y1-y0,key='town'+i;
        const texture=this.textures.addImage(key,image);
        texture.setFilter(P.Textures.FilterMode.LINEAR);
        texture.add('building',0,x0,y0,width,height);
        // Physical door axes, rather than sheet-cell centers, anchor each facade.
        const origin=[(roots[i][0]-x0)/width,(roots[i][1]-y0)/height];
        for(const object of objects.filter(o=>o.asset==='town'&&o.i===i)){
          object.origin=origin;object.sourceRect=[x0,y0,width,height];object.frame='building';
        }
      });
      return;
    }
    if(!this.textures.exists('townRaw'))return;const im=this.textures.get('townRaw').getSourceImage();
    for(const frame of town.townFrames){const [x,y,w,h]=frame.sourceRect;if(x<0||y<0||x+w>im.width||y+h>im.height){this.missing.push('town-frame:'+frame.i);continue;}const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');ctx.drawImage(im,x,y,w,h,0,0,w,h);const pixels=ctx.getImageData(0,0,w,h);for(let i=0;i<w*h;i++)if(pixels.data[i*4+3]<32)pixels.data[i*4+3]=0;ctx.putImageData(pixels,0,0);this.textures.addCanvas('town'+frame.i,cv);}
  }
  cutHound(){if(!this.textures.exists('houndRaw'))return;const image=this.textures.get('houndRaw').getSourceImage(),[x,y,w,h]=houndArt.sourceRect;if(image.width!==1254||image.height!==1254){this.missing.push('hound-layout-version');return;}const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(image,x,y,w,h,0,0,w,h);const pixels=ctx.getImageData(0,0,w,h);for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]<32)pixels.data[i]=0;ctx.putImageData(pixels,0,0);this.textures.addCanvas('demonHound',canvas);}
  faceEnemy(e,flipped){const sprite=e.sprite;sprite.setFlipX(flipped);if(sprite.texture.key==='demonHound'){const root=(houndArt.root[0]-houndArt.sourceRect[0])/houndArt.sourceRect[2];sprite.setOrigin(flipped?1-root:root,(houndArt.root[1]-houndArt.sourceRect[1])/houndArt.sourceRect[3]);}}
  makeLighting(){
    const surfaces=[{id:'terrain',x:0,y:0,width:town.width,height:town.height,depth:-100,key:'terrain',sampleStep:16,reflectance:.7},...this.renderObjects.map(({o,sprite})=>({id:o.id,x:sprite.x-sprite.displayWidth*sprite.originX,y:sprite.y-sprite.displayHeight*sprite.originY,width:sprite.displayWidth,height:sprite.displayHeight,depth:sprite.depth,key:sprite.texture.key,frame:sprite.frame.name,sampleStep:o.asset==='town'?8:4,reflectance:o.i===3&&o.asset==='kit'?.9:.65}))];
    const physicalOccluders=town.colliders.filter(c=>c.surface!=='water');
    const occluders=physicalOccluders.map(c=>({...c,heightScale:.8,castsShadow:false}));for(const c of physicalOccluders){if(c.shape==='circle'){occluders.push({...c,id:c.id+':shadow',blocksLight:false,castsShadow:true,heightScale:.8});continue;}const {x,y,width:w,height:h}=c,b=Math.min(8,w*.24,h*.24);occluders.push({id:c.id+':shadow',shape:'polygon',x,y,width:w,height:h,points:[[x+b,y],[x+w-b,y],[x+w,y+b],[x+w,y+h-b],[x+w-b,y+h],[x+b,y+h],[x,y+h-b],[x,y+b]],heightScale:.8,blocksLight:false,castsShadow:true});}
    // Candidate eave/canopy silhouettes are separate from physical foot collision, not a height map.
    // Roof strips are not foot silhouettes; physical blockers remain separate.
    const tree=objects.find(o=>o.i===2&&o.asset==='kit');if(tree)occluders.push({id:tree.id+':foot-shadow',shape:'circle',x:tree.x,y:tree.y-3,radius:tree.w*.18,heightScale:1.1,blocksLight:false,castsShadow:true});
    this.lighting=createLighting(this,{width:town.width,height:town.height,surfaces,occluders});this.lighting.setEnabled(lightsEnabled);
    for(const key of this.lighting.debug.textureKeys)this.textures.get(key).setFilter(P.Textures.FilterMode.LINEAR);
    this.lightSurfaces=surfaces;this.lightOccluders=occluders;this.dynamicLighting=new Map();this.lightSamples=[];this.lightDirty=true;this.lastLightTime=-Infinity;this.lastLightActive=false;
    const gate=this.renderObjects.find(({o})=>o.asset==='town'&&o.i===4);this.environmentLights=gate?[[729.29,870.77],[922.93,870.43]].map(([sx,sy],i)=>({id:'gate-lamp:'+i,x:gate.sprite.x+(sx-gate.o.sourceRect[0]-gate.o.sourceRect[2]*gate.sprite.originX)*gate.sprite.scaleX,y:gate.sprite.y+(sy-gate.o.sourceRect[1]-gate.o.sourceRect[3]*gate.sprite.originY)*gate.sprite.scaleY,radius:88,intensity:.65,color:0xffcf86})):[];
    this.lightAmbient={color:0xf8f2df,intensity:.12,shadow:.06,directional:{x:town.lighting.shadowDirection[0],y:town.lighting.shadowDirection[1],strength:.32,length:48}};this.environmentSlots=this.environmentLights.length;
    const started=performance.now();this.lighting.update({timeMs:0,lights:this.environmentLights,ambient:this.lightAmbient});this.lightStartupMs=performance.now()-started;this.finishLightTextures(this.lighting);this.environmentCachedSlots=lightsEnabled?this.environmentSlots:0;
    this.events.once('shutdown',()=>{this.lighting.destroy();this.dynamicLighting.forEach(e=>e.rig.destroy());this.dynamicLighting.clear();});
  }
  finishLightTextures(rig){for(const key of rig.debug.textureKeys){const texture=this.textures.get(key);texture.setFilter(P.Textures.FilterMode.LINEAR);if(!key.includes(':shadow:'))continue;const canvas=texture.getSourceImage(),copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.filter='blur(0.7px)';ctx.drawImage(copy,0,0);ctx.filter='none';texture.refresh();texture.setFilter(P.Textures.FilterMode.LINEAR);}}
  updateLighting(){
    this.actorLight?.update({actor:this.actor10,lights:this.fxLights||[],timeMs:this.timeMs,enabled:false,paused});
    if(!this.lighting)return;const active=!!this.fxLights?.length;if(!this.lightDirty&&!active&&!this.lastLightActive)return;if(!this.lightDirty&&this.timeMs-this.lastLightTime<runtimeBudget.lightingIntervalMs)return;
    const started=performance.now(),lights=this.fxLights||[],requests=new Map(),intersects=(r,l)=>Math.hypot(clamp(l.x,r.x,r.x+r.width)-l.x,clamp(l.y,r.y,r.y+r.height)-l.y)<l.radius,slots=Math.min(this.environmentLights.length,Math.max(0,6-lights.length));
    if(slots!==this.environmentSlots||this.lightDirty){this.environmentSlots=slots;this.lighting.update({timeMs:0,lights:this.environmentLights.slice(0,slots),ambient:this.lightAmbient});this.finishLightTextures(this.lighting);if(lightsEnabled)this.environmentCachedSlots=slots;}
    for(const light of lights){const size=160;for(let y=Math.max(0,Math.floor((light.y-light.radius)/size)*size);y<Math.min(town.height,light.y+light.radius);y+=size)for(let x=Math.max(0,Math.floor((light.x-light.radius)/size)*size);x<Math.min(town.width,light.x+light.radius);x+=size){const surface={id:`ground:${x}:${y}`,x,y,width:Math.min(size,town.width-x),height:Math.min(size,town.height-y),source:this.textures.get('terrain').getSourceImage(),sourceX:x,sourceY:y,sourceWidth:Math.min(size,town.width-x),sourceHeight:Math.min(size,town.height-y),depth:-99.96,sampleStep:8,reflectance:.7};if(intersects(surface,light))requests.set(surface.id,surface);}for(const surface of this.lightSurfaces.slice(1))if(intersects(surface,light))requests.set(surface.id,{...surface,depth:surface.depth+.04});}
    const selected=new Set([...requests.keys()].slice(0,16));this.dynamicLighting.forEach((entry,id)=>{entry.active=selected.has(id);entry.rig.setEnabled(lightsEnabled&&entry.active);});this.lightDroppedSurfaces=Math.max(0,requests.size-16);
    for(const id of selected){const surface=requests.get(id);let entry=this.dynamicLighting.get(id);if(!entry){if(this.dynamicLighting.size>=16){const stale=[...this.dynamicLighting.entries()].filter(([,e])=>!e.active).sort((a,b)=>a[1].lastUsed-b[1].lastUsed)[0];if(!stale)continue;stale[1].rig.destroy();this.dynamicLighting.delete(stale[0]);}const occluders=this.lightOccluders.filter(o=>{const r=o.shape==='circle'?{x:o.x-o.radius,y:o.y-o.radius,width:o.radius*2,height:o.radius*2}:o;return r.x+r.width>=surface.x-128&&r.x<=surface.x+surface.width+128&&r.y+r.height>=surface.y-128&&r.y<=surface.y+surface.height+128;});entry={rig:createLighting(this,{width:town.width,height:town.height,surfaces:[surface],occluders}),active:true,lastUsed:this.timeMs};this.dynamicLighting.set(id,entry);for(const key of entry.rig.debug.textureKeys)this.textures.get(key).setFilter(P.Textures.FilterMode.LINEAR);}entry.lastUsed=this.timeMs;entry.active=true;entry.rig.setEnabled(lightsEnabled);entry.rig.update({timeMs:this.timeMs,lights:lights.filter(l=>intersects(surface,l)),ambient:{intensity:0,shadow:0}});this.finishLightTextures(entry.rig);}
    this.lightSamples.push(performance.now()-started);if(this.lightSamples.length>360)this.lightSamples.shift();this.lastLightTime=this.timeMs;this.lastLightActive=active;this.lightDirty=false;
  }
  nearby(x,y,dx=0,dy=0,r=12){return this.staticColliders.filter(c=>{const x0=c.shape==='circle'?c.x-c.radius:c.x,y0=c.shape==='circle'?c.y-c.radius:c.y,x1=c.shape==='circle'?c.x+c.radius:c.x+c.width,y1=c.shape==='circle'?c.y+c.radius:c.y+c.height;return x1>=Math.min(x,x+dx)-r&&x0<=Math.max(x,x+dx)+r&&y1>=Math.min(y,y+dy)-r&&y0<=Math.max(y,y+dy)+r;});}
  blocked(x,y,r=9){return !!sweepCircle({x,y,radius:r},{x:0,y:0},this.nearby(x,y,0,0,r));}
  move(actor,dx,dy){const result=moveCircle({x:actor.x,y:actor.y,radius:9},{x:dx,y:dy},this.nearby(actor.x,actor.y,dx,dy));actor.x=result.x;actor.y=result.y;}
  facingRow(a){return Math.abs(a.x)>Math.abs(a.y)?a.x<0?1:2:a.y<0?3:0;}
  applyPose(pose,dtMs=0,traveled=0){this.pose=pose;if(this.actor10){const held=this.channelState().elapsed||this.preparedRelease?.heldMs||this.pendingReleaseHeldMs||this.releaseHeldMs||0,age=Number.isFinite(this.releaseTime)?Math.max(0,this.timeMs-this.releaseTime):240,releasing=!this.channel&&this.releaseHeldMs>=1800&&age<240;const state=releasing&&!traveled?'release':pose.state==='cast'&&held<1800?'idle':pose.state;this.actor10Pose=this.actor10.update({row:pose.facingRow,traveled,timeMs:this.timeMs,foot:this.player,state,chargeElapsedMs:held,aim:releasing?this.releaseAim:this.player.aim,releaseAgeMs:age,chargedRelease:releasing});this.rig?.container.setVisible(false);return;}const casting=pose.state==='cast'&&this.textures.exists('cast:0'),idle=!!this.rig||pose.texture==='idle',meta=casting?castMeta:idle?actorAssets.idle:actorAssets.walk,key=(casting?'cast':idle?'idle':'rudy')+':'+(casting||this.rig?pose.facingRow:pose.frame);if(!this.textures.exists(key))return;this.actor.setTexture(key).setOrigin(meta.rootX[pose.facingRow]/meta.cellSize,meta.rootY[pose.facingRow]/meta.cellSize).setScale(meta.scale);if(this.rig){this.rig.container.setAngle(this.actor.angle);this.rigPose=this.rig.update({x:this.player.x,y:this.player.y,row:pose.facingRow,state:pose.state,progress:pose.progress,timeMs:this.timeMs,dtMs,distance:traveled});}}
  setAim(a){this.player.aim={...a};}
  hand(row=this.facingRow(this.player.aim)){const p=this.player,meta=this.textures.exists('cast:0')?castMeta:actorAssets.idle;
    // Pose metadata is visual-only; authoritative projection is frozen separately on release.
    const tip=meta===castMeta?castMeta.staffTips[row]:idleStaffTips[row];return {x:p.x+(tip[0]-meta.rootX[row])*meta.scale,y:p.y+(tip[1]-meta.rootY[row])*meta.scale};}
  actualStaffAnchor(){if(this.actor10)return this.actor10.staffAnchor();if(this.meowa?.active)return null;const pose=this.pose;const isCast=this.actor.texture.key.startsWith('cast:');if(this.rigPose?.rig&&!isCast)return null;if(!pose||(!isCast&&!this.actor.texture.key.startsWith('idle:')))return null;const row=pose.facingRow,tip=isCast?castMeta.staffTips[row]:idleStaffTips[row],sprite=this.actor,dx=(tip[0]-sprite.displayOriginX)*sprite.scaleX,dy=(tip[1]-sprite.displayOriginY)*sprite.scaleY,c=Math.cos(sprite.rotation),s=Math.sin(sprite.rotation);return {x:sprite.x+dx*c-dy*s,y:sprite.y+dx*s+dy*c,row,texture:sprite.texture.key,frame:pose.frame,source:isCast?'ANIMATION-03-cast-staff-bulb':'inspected-idle-staff-estimate',verified:isCast};}
  cooldownTicks(){return Math.max(0,30-(this.sim.tick-(this.lastReleaseTick??-30)));}
  aimAt(target){this.setAim(spellAim(this.player,target,this.player.aim));}
  beginChannel(source){if(this.initializing||paused||this.channel||this.timeMs<this.player.dodge)return false;if(this.cooldownTicks()>0){this.eventsLog.push({type:'ChannelRejected',reason:'cooldown',tick:this.sim.tick});const bar=$('#ready');bar.getAnimations().forEach(a=>a.cancel());bar.animate([{opacity:1},{opacity:.15},{opacity:1}],{duration:220});return false;}if(this.sim.mana<7){notify('dry');return false;}this.channel={source,start:this.timeMs};this.realAudio?.unlock();$('#water-cast')?.setAttribute('aria-pressed','true');return true;}
  syncPreparationAudio(channel){
    if(paused||!channel.shaping||!this.channel)return;
    const intent=this.channel;intent.sealPlayed??=new Set();
    for(const seal of this.sealOutput?.sealLayers||[]){
      if(seal.visible&&!intent.sealPlayed.has(seal.index)&&this.realAudio?.playSeal?.(seal.index,{castId:'water-shaping:'+intent.start}))intent.sealPlayed.add(seal.index);
    }
    if(channel.elapsed>=6000&&this.waterOutput?.byStage?.formation>0&&this.waterOutput?.anchors?.tip){
      if(!intent.windStarted)intent.windStarted=!!this.realAudio?.play('charge',{elapsedSeconds:channel.elapsed/1000});
      if(intent.windStarted)this.realAudio?.setChargePressure(clamp(channel.elapsed/12000,0,1));
    }
  }
  channelState(){const elapsed=this.channel?Math.max(0,this.timeMs-this.channel.start):0;return {held:!!this.channel,shaping:!!this.channel&&elapsed>=160,elapsed,power:1+clamp((elapsed-160)/1000,0,1)};}
  releaseChannel(source){if(!this.channel||this.channel.source!==source)return;this.hideWind('release');const elapsed=this.timeMs-this.channel.start,power=elapsed<6000?1:1.41+.59*clamp((elapsed-6000)/6000,0,1);const staff=this.actualStaffAnchor()||this.hand();this.pendingReleaseHeldMs=elapsed;this.preparedRelease=elapsed>=6000?{heldMs:elapsed,staff:{...staff},direction:{...this.player.aim},tip:{x:staff.x+this.player.aim.x*115,y:staff.y+this.player.aim.y*115}}:null;this.channel=null;this.realAudio?.stopCharge();$('#water-cast')?.setAttribute('aria-pressed','false');if(!paused)this.cast(power);else{this.pendingReleaseHeldMs=0;this.preparedRelease=null;}}
  cancelChannel(reason){this.hideWind(reason);if(this.channel)this.eventsLog.push({type:'ChannelCancelled',reason,tick:this.sim.tick});this.channel=null;this.preparedRelease=null;this.releaseHeldMs=0;this.pendingReleaseHeldMs=0;this.releaseOrigin=null;this.lastWaterRelease=null;if(reason==='pause')this.realAudio?.play('pause');else this.realAudio?.stopCharge();if(this.waterFX)this.waterOutput=this.waterFX.update({timeMs:this.timeMs,paused:true});clearTransientGraphics(this);if(this.sealFX)this.sealOutput=this.sealFX.update({timeMs:this.timeMs,caster:this.player,spell:null});this.updateLighting();$('#charging').hidden=true;$('#water-cast')?.setAttribute('aria-pressed','false');this.flushRuntimeAudit(true);}
  cast(power=1){if(this.initializing||paused||this.timeMs<this.player.dodge){this.preparedRelease=null;this.pendingReleaseHeldMs=0;return;}if(this.sim.begin('water',clamp(power,1,2))){sound('gather');this.eventsFromSim();}else{this.preparedRelease=null;this.pendingReleaseHeldMs=0;if(this.sim.mana<7)notify('dry');}}
  eventsFromSim(){
    for(const event of this.sim.drainEvents()){
      const charged=(event.power||1)>1.4;
      if(event.type==='CastStarted'||event.type==='CastReleased'){
        const row=this.facingRow(this.player.aim);
        this.actor.setPosition(this.player.x,this.player.y).setAngle(0);
        this.player.bodyRow=row;
        this.applyPose({state:'cast',texture:'idle',facingRow:row,frame:row,progress:0});
      }
      const prepared=charged?this.preparedRelease:null;
      const staff=prepared?.staff||this.actualStaffAnchor()||this.hand(),direction=prepared?.direction||this.player.aim;
      const tipDistance=charged?115:30;
      const projection=createSpellProjection({foot:this.player,direction,speed:charged?1250:440,visualOrigin:prepared?.tip||{x:staff.x+direction.x*tipDistance,y:staff.y+direction.y*tipDistance},colliders:this.nearby(this.player.x,this.player.y,direction.x*SPELL_PLANE.muzzleDistance,direction.y*SPELL_PLANE.muzzleDistance,3)});
      const contract=toContractEvent(event,{runId:'camp:1',timelineId:'sample:1',actorId:'rudeus',actionTimelineId:'water.sample',origin:projection.groundOrigin,direction:projection.direction});
      this.eventsLog.push({type:contract.type,tick:contract.tick,power:event.power??null,cost:event.cost??null});
      if(event.type==='CastStarted'){this.castStart=this.timeMs;this.casting=true;}
      if(event.type==='CastCancelled'){this.casting=false;this.preparedRelease=null;this.releaseHeldMs=0;this.pendingReleaseHeldMs=0;if(event.reason==='mana'||event.reason==='resources')notify('dry');}
      if(event.type==='CastReleased'){
        this.hideWind('release');this.casting=false;this.releaseTime=this.timeMs;this.releases++;
        const h=projection.visualOrigin,a=projection.direction;
        this.castRow=this.facingRow(a);this.releaseAim={...a};this.releaseOrigin={...h};this.releaseProjection=projection;
        this.releaseGroundOrigin={...projection.groundOrigin};this.releaseFoot={x:this.player.x,y:this.player.y};
        this.releasePower=event.power;this.lastReleaseTick=event.tick;this.player.bodyRow=this.castRow;
        this.releaseHeldMs=prepared?.heldMs||this.pendingReleaseHeldMs||0;this.pendingReleaseHeldMs=0;this.preparedRelease=null;
        this.applyPose({state:'cast',texture:'idle',facingRow:this.castRow,frame:this.castRow,progress:0});
        this.lastWaterRelease={castId:event.castId,charged,x:h.x,y:h.y,direction:{...a},startMs:this.timeMs};
        const formationScale=prepared ? .35+.65*clamp((prepared.heldMs-6000)/6000,0,1) : 1;
        this.shots.push({x:projection.groundOrigin.x,y:projection.groundOrigin.y,projection,dx:a.x,dy:a.y,power:event.power,charged,formationScale,damage:Math.round(23*event.power),life:0,trail:[],castId:event.castId});
        this.realAudio?.play(charged?'chargedRelease':'release');
      }
    }
    if(this.eventsLog.length>100)this.eventsLog.splice(0,50);
  }
  dodge(){if(paused||this.timeMs<this.player.dodgeReady)return;this.cancelChannel('dodge');this.sim.cancel('input');this.eventsFromSim();const m=this.movement();this.player.dodgeDir=Math.hypot(m.x,m.y)>.1?normalize(m.x,m.y):{...this.player.aim};this.player.dodge=this.timeMs+190;this.player.inv=this.timeMs+250;this.player.dodgeReady=this.timeMs+750;sound('dodge');}
  movement(){return {x:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+moveTouch.x,y:(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+moveTouch.y};}
  nearbyInteraction(){return objects.filter(o=>o.interact&&distance(this.player,o)<(o.asset==='town'?95:80)).sort((a,b)=>distance(this.player,a)-distance(this.player,b))[0];}
  interactionLabel(o){const names={well:['集水井','集水井戸'],market:['市集商棚','市場の天幕'],freight:['货运柜台','荷運びの窓口'],arrival:['南侧城门','南の城門'],lodging:['旅人客栈','旅人の宿'],apothecary:['药店','薬屋'],workshop:['工坊','工房'],trade:['商铺','商店'],residence:['民居','民家'],clocktower:['钟楼','時計塔'],notice:['市集告示','市場の掲示']};return names[o?.interact]?.[lang==='zh'?0:1]||t('exit');}
  interact(){if(paused)return;const p=this.player,o=this.nearbyInteraction();if(o){if(o.interact==='well'||o.interact==='notice'){this.visitedWell=true;dialogue('wellLine');}else if(['market','freight','lodging','apothecary'].includes(o.interact)){this.visitedMarket=true;p.hp=100;this.sim.mana=70;dialogue('tentLine');}else dialogue('townLine');return;}const exit=town.connections.find(c=>c.id==='east-freight-route');if(distance(p,exit)<85)notify(this.enemyList.every(e=>e.hp<=0)?'cleared':'blocked');}
  splash(x,y,a,kind,normal,groundPoint){
    if(a.charged){this.impacts[kind]++;this.splashes.push({id:'water-contact:'+this.releases+':'+this.impacts[kind]+':'+kind,x,y,charged:true,crown:true,age:0,life:650,groundY:groundPoint.y,groundPoint:{...groundPoint},normal:{...normal},direction:{x:a.dx,y:a.dy},kind});this.realAudio?.play('chargedImpact');this.cameras.main.shake(100,.002);return;}
    this.impacts[kind]++;const direction=kind==='wall'?normal:{x:a.dx,y:a.dy},base=Math.atan2(direction.y,direction.x);this.splashes.push({id:'water-contact:'+this.releases+':'+this.impacts[kind]+':'+kind,x,y,charged:!!a.charged,age:0,life:kind==='wall'?260:340,crown:true,groundY:groundPoint.y,groundPoint:{...groundPoint},normal:{...normal},direction:{...direction},kind});
    for(let i=0;i<18;i++){const angle=base+(i/17-.5)*(kind==='wall'?2.9:2),speed=kind==='wall'?42+(i%5)*15:65+(i%5)*20;this.splashes.push({x:x+normal.x*2,y:y+normal.y*2,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-25,groundX:groundPoint.x+normal.x*2,groundY:groundPoint.y+normal.y*2,groundVX:Math.cos(angle)*speed,groundVY:Math.sin(angle)*speed,age:0,life:430+(i%6)*65,kind});}
    this.splashes.push({x:groundPoint.x,y:groundPoint.y,groundPoint:{...groundPoint},groundY:groundPoint.y,vx:0,vy:0,age:0,life:1400,puddle:true,kind});this.realAudio?.play('impact');
  }
  hurt(e){const p=this.player;if(p.inv>this.timeMs)return;p.hp=Math.max(0,p.hp-13);this.playerHitTime=this.timeMs;p.inv=this.timeMs+900;this.cancelChannel('interrupt');this.sim.cancel('interrupt');this.eventsFromSim();const n=normalize(p.x-e.x,p.y-e.y);this.move(p,n.x*18,n.y*18);this.cameras.main.shake(100,.003);sound('flesh');if(!p.hp){p.x=town.spawn.x;p.y=town.spawn.y;p.hp=100;this.sim.mana=70;notify('defeat');}}
  update(_time,delta){
    if(this.initializing||!scene||!Number.isFinite(delta)||delta<0)return;this.frameTimes.push(delta);if(this.frameTimes.length>runtimeBudget.frameSampleLimit)this.frameTimes.shift();if(paused){this.frameAccumulator=0;if(meowaRequested)this.syncMeowaAudit();return;}
    // Ordinary slow frames retain elapsed time; suspension pauses instead of slowing the world.
    if(delta>500){this.frameAccumulator=0;$('#overlay').hidden=false;pause(true);return;}
    const stepMs=1000/60;this.frameAccumulator=(this.frameAccumulator||0)+delta;let steps=0;
    while(this.frameAccumulator+1e-9>=stepMs&&steps<32){this.step(_time,stepMs);this.frameAccumulator=Math.max(0,this.frameAccumulator-stepMs);steps++;}
    this.renderFrame();
  }
  step(_time,delta){const dt=delta/1000;this.timeMs+=dt*1000;const p=this.player,m=this.movement(),n=normalize(m.x,m.y),dodging=p.dodge>this.timeMs,dir=dodging?p.dodgeDir:n,old={x:p.x,y:p.y},recover=this.releaseTime+releaseRecoveryMs(this.releaseHeldMs)>this.timeMs,shaping=this.channelState().shaping,speed=dodging?340:recover||shaping?0:meowaRequested?55:122;this.move(p,dir.x*speed*dt,dir.y*speed*dt);const traveled=distance(old,p),before=this.walkDistance||0;this.walkDistance=before+(!dodging?traveled:0);if(touchAim)this.setAim(aimTouch);this.sim.advance(dt*1000);this.eventsFromSim();if(Math.floor(this.timeMs/1800)!==Math.floor((this.timeMs-dt*1000)/1800))this.sim.mana=Math.min(70,this.sim.mana+1);
    const posing=recover||shaping,actualMove={x:p.x-old.x,y:p.y-old.y},pose=this.locomotion.step({dtMs:dt*1000,distance:traveled,move:actualMove,aim:recover?this.releaseAim:p.aim,casting:posing,dodging});
    p.bodyRow=pose.facingRow;if(traveled>.05&&!posing)p.bodyFacing=normalize(actualMove.x,actualMove.y);this.poseFrame=pose.frame;this.walking=pose.state==='walk';this.action=pose.state;this.applyPose(pose,delta,traveled);
    this.actor.setPosition(p.x,p.y).setDepth(p.y);this.actorShadow.setPosition(p.x,p.y-1).setDepth(p.y-1);this.actor.setAlpha(1);this.actor.setAngle(dodging?(dir.x>0?-12:12):0);this.rig?.container.setAlpha(this.actor.alpha).setAngle(this.actor.angle);if(this.meowa)this.meowa.container.setAlpha(this.actor.alpha);if(this.walking&&Math.floor(this.walkDistance/26)!==Math.floor(before/26))sound('step');
    this.threat.clear();for(const e of this.enemyList){if(e.hp<=0)continue;const d=distance(e,p);if(e.knock>this.timeMs){this.move(e,e.knockDir.x*150*dt,e.knockDir.y*150*dt);}else if(e.phase==='idle'&&d<190){e.phase='chase';}else if(e.phase==='chase'){if(d<90){e.phase='windup';e.until=this.timeMs+700;e.direction=normalize(p.x-e.x,p.y-e.y);}else if(d<300){const a=normalize(p.x-e.x,p.y-e.y);this.move(e,a.x*55*dt,a.y*55*dt);}else e.phase='idle';}else if(e.phase==='windup'){const a=e.direction,side={x:-a.y,y:a.x};this.threat.fillStyle(0xdd795b,.25).lineStyle(1.5,0xffdfa2,1);const points=[{x:e.x+side.x*17,y:e.y+side.y*17},{x:e.x+a.x*110+side.x*24,y:e.y+a.y*110+side.y*24},{x:e.x+a.x*110-side.x*24,y:e.y+a.y*110-side.y*24},{x:e.x-side.x*17,y:e.y-side.y*17}];this.threat.fillPoints(points,true).strokePoints(points,true);this.threat.lineStyle(3,0xffeeb7,1).lineBetween(e.x,e.y,e.x+a.x*110*(1-(e.until-this.timeMs)/700),e.y+a.y*110*(1-(e.until-this.timeMs)/700));if(this.timeMs>=e.until){e.phase='dash';e.until=this.timeMs+330;}}else if(e.phase==='dash'){this.move(e,e.direction.x*285*dt,e.direction.y*285*dt);if(distance(e,p)<29)this.hurt(e);if(this.timeMs>=e.until){e.phase='recover';e.until=this.timeMs+900;}}else if(e.phase==='recover'&&this.timeMs>=e.until)e.phase='chase';this.faceEnemy(e,p.x<e.x);e.sprite.setPosition(e.x,e.y).setDepth(e.y).setAngle(e.phase==='windup'?8:0);e.shadow.setPosition(e.x,e.y).setDepth(e.y-1);if(e.hitUntil>this.timeMs)e.sprite.setTint(0xa4ecf0);else e.sprite.clearTint();this.threat.fillStyle(0x25373b).fillRect(e.x-17,e.y-44,34,3).fillStyle(0xe3ba8e).fillRect(e.x-17,e.y-44,34*e.hp/45,3);}
    this.shots=this.shots.filter(s=>{
      s.life+=dt*1000;s.trail.push({x:s.x,y:s.y,age:s.life-dt*1000});if(s.trail.length>8)s.trail.shift();const speed=s.projection.speed,delta={x:s.dx*speed*dt,y:s.dy*speed*dt},walls=this.nearby(s.x,s.y,delta.x,delta.y,4),targets=this.enemyList.flatMap((e,i)=>e.hp>0?[{id:'enemy:'+i,kind:'enemy',shape:'circle',x:e.x,y:e.y+1,radius:20}]:[]);
      const hit=sweepCircle({x:s.x,y:s.y,radius:3},delta,[...walls,...targets]);
      if(hit){s.x=hit.center.x;s.y=hit.center.y;const visualPoint=spellVisualPoint(hit.point,s.projection,s.life);this.splash(visualPoint.x,visualPoint.y,s,hit.kind==='wall'?'wall':'flesh',hit.normal,hit.point);this.eventsLog.push({type:'HitResolved',material:hit.kind,normal:{...hit.normal},point:{...hit.point},contactPoint:{...hit.point},groundPoint:{...hit.point},visualPoint:{...visualPoint},tick:this.sim.tick});if(hit.kind==='enemy'){const e=this.enemyList[Number(hit.colliderId.split(':')[1])];e.hp=Math.max(0,e.hp-s.damage);e.knock=this.timeMs+180;e.knockDir={x:s.dx,y:s.dy};e.hitUntil=this.timeMs+240;e.phase='recover';e.until=this.timeMs+600;this.cameras.main.shake(70,.0015);if(!e.hp){e.sprite.setAlpha(.25).setAngle(80);this.drops.push({x:e.x,y:e.y});}}return false;}
      s.x+=delta.x;s.y+=delta.y;return s.life<1500;
    });
    this.splashes=this.splashes.filter(s=>{s.age+=dt*1000;if(!s.puddle&&!s.crown){s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=150*dt;s.groundX+=s.groundVX*dt;s.groundY+=s.groundVY*dt;}return s.age<s.life;});this.drops=this.drops.filter(d=>{if(distance(d,p)<25){p.hp=Math.min(100,p.hp+12);sound('loot');notify('loot');return false;}return true;});
  }
  renderFrame(){const p=this.player;minimap.update(p,this.timeMs);this.drawFX();this.updateLighting();this.updateOcclusion();this.updatePlayerFeedback();if(meowaRequested)this.syncMeowaAudit();
    const near=this.nearbyInteraction(),atExit=distance(p,town.connections.find(c=>c.id==='east-freight-route'))<85;$('#prompt').hidden=(!near&&!atExit)||this.channelState().shaping;$('#interact').textContent=(touchEnabled?'': 'E · ')+this.interactionLabel(near);$('#hp').style.width=p.hp+'%';$('#mp').style.width=this.sim.mana/70*100+'%';$('#hp-text').textContent=p.hp+' / 100';$('#ready').style.width=(55*clamp((this.sim.tick-(this.lastReleaseTick??-30))/30,0,1))+'px';$('#ready').style.opacity=this.sim.mana<7?'.35':'1';const channel=this.channelState();$('#charging').hidden=!channel.shaping;$('#charging-progress').style.width=clamp((channel.elapsed-160)/11840,0,1)*100+'%';$('#hud').dataset.mode=channel.shaping||this.shots.length||this.enemyList.some(e=>e.hp>0&&e.phase!=='idle')?'combat':'explore';
  }
  flushRuntimeAudit(force=false){
    if(!this.auditOutput||(!force&&this.auditLast!==undefined&&this.timeMs-this.auditLast<=200))return;
    const p=this.player,channel=this.channelState(),audioObs=this.realAudio?.diagnostics,wind=this.windObservations();this.auditLast=this.timeMs;
    this.auditOutput.setAttribute('data-wind-stage',this.windOutput?.stage??'hidden');
    this.auditOutput.setAttribute('data-pressure-phase',audioObs?.pressurePhase??'silent');
    this.auditOutput.textContent=JSON.stringify({version:AUDIT_VERSION,touch:touchObservations(),paused,position:{x:p.x,y:p.y},walking:this.walking,bodyRow:p.bodyRow,mana:this.sim.mana,channel,audio:audioObs,water:compactWaterAudit(this.waterOutput),wind,seal:{beat:this.sealOutput?.beat,cameraPush:this.sealOutput?.cameraPush,active:this.sealOutput?.active,layers:this.sealOutput?.sealLayers||[],missingAssets:this.sealOutput?.missingAssets},missing:this.missing,events:this.eventsLog.slice(-8),frameP95:this.frameTimes.length?[...this.frameTimes].sort((a,b)=>a-b)[Math.floor(this.frameTimes.length*.95)]:0});
  }
  drawFX(){
    const g=this.fx;g.clear();this.groundFX.clear();const p=this.player,h=this.hand(),a=p.aim,age=this.timeMs-this.releaseTime,channel=this.channelState();
    const release=age>=0&&age<320&&this.releaseOrigin?{...this.releaseOrigin,dx:this.releaseAim.x,dy:this.releaseAim.y,age,scale:1+(this.releasePower-1)*.5}:undefined;
    g.setDepth(release?this.releaseFoot.y+1:p.y+1);
    const staff=this.actualStaffAnchor()||h;
    const coneForming=channel.shaping&&channel.elapsed>=6000;
    const longShape=channel.shaping&&channel.elapsed>1800;
    if(channel.shaping&&chantEnabled&&channel.elapsed>=1800&&!this.channel.chantPlayed){this.channel.chantPlayed=true;this.realAudio?.play('chant');}
    const detached={x:staff.x+a.x*30,y:staff.y+a.y*30};
    const {lights}=renderArcane(this.groundFX,g,{bitmapWater:release?this.releasePower>1.4:longShape,suppressRising:longShape,timeMs:this.timeMs,caster:release?this.releaseFoot:{x:p.x,y:p.y},channel:channel.shaping?{progress:channel.power-1,origin:staff,waterOrigin:detached,direction:a}:undefined,release});
    const explicitRelease=this.lastWaterRelease?.charged&&this.timeMs-this.lastWaterRelease.startMs<1100?[{...this.lastWaterRelease,ageMs:this.timeMs-this.lastWaterRelease.startMs}]:[];
    this.waterOutput=this.waterFX.update({timeMs:this.timeMs,caster:{...p,staff},channel:coneForming?{startMs:this.channel.start+6000,stageElapsedMs:channel.elapsed-6000,origin:staff,direction:a,progress:clamp((channel.elapsed-6000)/6000,0,1)}:null,shots:this.shots.filter(s=>s.charged).map(s=>({...s,...spellVisualPoint(s,s.projection,s.life),groundY:s.y})),splashes:this.splashes.filter(s=>s.crown&&s.charged),releases:explicitRelease});
    this.renderWind(channel);
    this.sealOutput=this.sealFX.update({timeMs:this.timeMs,caster:{...p,staff},camera:this.cameras.main,spell:longShape?{id:'water-shaping',castId:'water-shaping:'+this.channel.start,phase:channel.elapsed>=12000?'ready':'prepare',prepareStartMs:this.channel.start,phaseStartMs:this.channel.start,x:p.x+a.x*110,y:p.y+a.y*110,radius:100}:null,events:[]});
    this.syncPreparationAudio(channel);
    const camera=this.cameras.main,baseZoom=Math.min(3,this.scale.width<this.scale.height?this.scale.width/360:this.scale.width/900);
    const desiredZoom=this.sealOutput.cameraPush?.factor||1,zoomDt=Math.max(0,this.timeMs-(this.lastZoomTime??this.timeMs));
    this.chargeZoom??=1;this.chargeZoom+=(desiredZoom-this.chargeZoom)*(1-Math.exp(-zoomDt/180));this.lastZoomTime=this.timeMs;
    camera.setZoom(baseZoom*this.chargeZoom);
    lights.push(...this.waterOutput.lights,...(this.sealOutput.lights||[]));
    this.effectLayers||=Array.from({length:8},()=>this.add.graphics());this.effectLayers.forEach(layer=>layer.clear());
    const budget=8-(channel.shaping?1:0)-(release?1:0),items=[...this.shots.slice().reverse().map(s=>({s:{...s,...spellVisualPoint(s,s.projection,s.life),groundY:s.y,trail:s.trail.map(p=>spellVisualPoint(p,s.projection,p.age))},kind:'shot'})),...this.splashes.filter(s=>s.crown).reverse().map(s=>({s,kind:'splash'})),...this.splashes.filter(s=>s.puddle).reverse().map(s=>({s,kind:'splash'})),...this.splashes.filter(s=>!s.puddle&&!s.crown).reverse().map(s=>({s,kind:'splash'}))].slice(0,budget);
    this.effectObservations=[];items.forEach(({s,kind},i)=>{const layer=this.effectLayers[i];layer.setDepth((s.groundY??s.y+SPELL_PLANE.visualHeight)+.1);this.effectObservations.push({kind,material:s.kind??null,crown:!!s.crown,puddle:!!s.puddle,x:s.x,y:s.y,groundY:s.groundY,depth:layer.depth});const result=renderArcane(this.groundFX,layer,{bitmapWater:!!s.charged,timeMs:this.timeMs,shots:kind==='shot'?[s]:[],splashes:kind==='splash'?[s]:[]});lights.push(...result.lights);});this.fxLights=lights.slice(0,6);
    for(const d of this.drops){g.fillStyle(0xdbe1a3).fillTriangle(d.x,d.y-9,d.x-5,d.y,d.x+5,d.y);g.lineStyle(1,0xfaffd3,.8).strokeCircle(d.x,d.y-3,9);}this.target.clear();this.target.lineStyle(1,0xc7fcf3,.7);const tx=p.x+a.x*(SPELL_PLANE.muzzleDistance+80),ty=p.y+a.y*(SPELL_PLANE.muzzleDistance+80)-SPELL_PLANE.visualHeight;this.reticle={x:tx,y:ty};this.target.lineBetween(tx-5,ty,tx+5,ty).lineBetween(tx,ty-5,tx,ty+5);
    this.flushRuntimeAudit();
  }
}
if(!P){$('#loading').textContent='Phaser 未加载，请通过本地 HTTP 服务打开。';}else new P.Game({type:P.AUTO,parent:'game',width:innerWidth,height:innerHeight,backgroundColor:'#65756a',pixelArt:true,roundPixels:true,scale:{mode:P.Scale.RESIZE,autoCenter:P.Scale.CENTER_BOTH},scene:[Camp],input:{activePointers:3}});
