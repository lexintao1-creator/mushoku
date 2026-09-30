/* Checkpoints belong to the world; recollections belong only to the protagonist. */
window.installReturnByDeath=function(World,api){
 const {state,saveGame,openDialogue,sfx}=api;
 const $=s=>document.querySelector(s),t=(zh,ja)=>state.lang==='ja'?ja:zh;
 const clone=v=>JSON.parse(JSON.stringify(v));
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
 let echo=read('sixworld-echo',{deaths:0,witnessed:[],unsettled:false,confessions:0}),anchor=read('sixworld-anchor',null);
 let returning=false,activeReaction=null,timeout;
 const persist=()=>{localStorage.setItem('sixworld-echo',JSON.stringify(echo));if(anchor)localStorage.setItem('sixworld-anchor',JSON.stringify(anchor));};
 window.resetReturnByDeath=()=>{clearTimeout(timeout);returning=false;activeReaction=null;echo={deaths:0,witnessed:[],unsettled:false,confessions:0};anchor=null;localStorage.removeItem('sixworld-anchor');persist();};
 document.body.insertAdjacentHTML('beforeend','<div id="return-veil" aria-live="assertive"><div class="return-line"></div><div class="return-subline"></div></div><div id="taboo-veil"></div>');
 const mark=event=>{if(!echo.witnessed.includes(event)){echo.witnessed.push(event);persist();}};
 function seal(scene,id){
  const snapshot=clone(state);snapshot.paused=false;snapshot.dialogOpen=false;delete snapshot.flags.nextSpawn;delete snapshot.flags.resumePosition;
  snapshot.positions={...snapshot.positions,[scene.area]:{x:scene.player.x,y:scene.player.y}};
  anchor={id,area:scene.area,position:{x:scene.player.x,y:scene.player.y},world:snapshot};persist();
 }
 window.returnSaveOverride=()=>returning&&anchor?{...clone(anchor.world),lang:state.lang,sound:state.sound,settings:state.settings}:null;
 const originalChoice=window.adventureDialogueChoice;
 window.adventureDialogueChoice=(id,index)=>{
  originalChoice?.(id,index);
  if(id==='roxy'&&state.quests.forest==='active'&&anchor?.id==='arrival')seal(window.currentWorld,'before-forest');
 };
 const create=World.prototype.create,update=World.prototype.update;
 World.prototype.create=function(){
  create.call(this);this.courier=null;this.courierWarning=null;this.courierAge=0;
  if(this.area==='demon'&&!state.flags.courierDead){
   this.courier=this.add.sprite(850,620,'npcs',0).setScale(.18).setOrigin(.5,.94).setDepth(620).setTint(0xc4d6aa);
   this.courierLabel=this.add.text(850,635,t('商队车夫','商隊の御者'),{fontFamily:'Arial',fontSize:'11px',color:'#eee6ca',stroke:'#172522',strokeThickness:2}).setOrigin(.5).setDepth(621);
  }
 };
 World.prototype.update=function(time,delta){
  update.call(this,time,delta);
  if(!api.getStarted()||state.paused||state.dialogOpen||returning)return;
  if(!anchor)seal(this,'arrival');
  if(this.area==='demon'&&anchor.id!=='red-camp'&&!state.flags.chapterComplete)seal(this,'red-camp');
  if(this.courier?.active){
   const boss=this.enemies?.getChildren().find(e=>e.getData('boss')&&!e.getData('dead'));
   if(state.flags.caravanWarned||!boss){this.courierLabel.setText(t('车夫 · 安全','御者 · 無事'));return;}
   if(this.player.x>1080)state.flags.courierDeparted=true;
   if(state.flags.courierDeparted){
    this.courier.x=Math.min(1270,this.courier.x+Math.min(delta,50)*.025);this.courierLabel.setPosition(this.courier.x,635);
    if(this.courier.x>=1265){
     if(!this.courierWarning){this.courierWarning=this.add.circle(this.courier.x,620,65,0xd56757,.2).setStrokeStyle(2,0xf49e85).setDepth(1900);this.courierAge=0;}
     this.courierAge+=delta;
     if(this.courierAge>1100){
      this.fx('stone',this.courier.x,620,0,0xe8b986,800);this.courierWarning.destroy();this.courierWarning=null;
      this.courier.setTint(0x6e5d60).setAngle(-75).setAlpha(.65);this.courierLabel.setText(t('没有回应','返事がない'));
      state.flags.courierDead=true;mark('courier');this.courier.active=false;
      api.questToast(t('石刃落下，车夫没能回来。','石刃が落ちた。御者は戻らなかった。'));saveGame();
     }
    }
   }
  }
 };
 function heartbeat(){
  const ctx=api.getAudio();if(!ctx)return;
  [0,.18,.72,.9].forEach(offset=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.setValueAtTime(62,ctx.currentTime+offset);osc.frequency.exponentialRampToValueAtTime(30,ctx.currentTime+offset+.16);gain.gain.setValueAtTime(.0001,ctx.currentTime+offset);gain.gain.exponentialRampToValueAtTime(.12*(state.settings.volume||.7),ctx.currentTime+offset+.025);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+offset+.22);osc.connect(gain).connect(ctx.destination);osc.start(ctx.currentTime+offset);osc.stop(ctx.currentTime+offset+.25);});
 }
 World.prototype.returnByDeath=function(enemy){
  if(returning)return;
  if(!anchor)seal(this,'arrival');
  returning=true;echo.deaths++;echo.unsettled=true;mark(enemy?.getData('boss')?'guardian':'ambush');persist();
  state.paused=true;this.physics.pause();this.player.setVelocity(0);
  const veil=$('#return-veil');$('.return-line').textContent=t('呼吸，停在了这里。','息は、ここで途切れた。');$('.return-subline').textContent='';veil.classList.add('visible');heartbeat();
  timeout=setTimeout(()=>{
   $('.return-line').textContent=t('……风声，又响了一次。','……また、同じ風の音。');
   $('.return-subline').textContent=t('刚才的痛，还在记忆里。','さっきの痛みだけが、記憶に残っている。');
   const language=state.lang,sound=state.sound,settings=state.settings;
   Object.keys(state).forEach(key=>delete state[key]);Object.assign(state,clone(anchor.world),{lang:language,sound,settings,paused:true,dialogOpen:false});
   state.flags.nextSpawn=clone(anchor.position);state.flags.returned=true;
   state.area=anchor.area;saveGame();this.scene.restart({area:anchor.area});
   timeout=setTimeout(()=>{
    returning=false;state.paused=false;window.currentWorld?.physics.resume();veil.classList.remove('visible');
    const scene=window.currentWorld;scene.updateHud();$('#chapter-notice').classList.remove('visible');
    const near=scene.interactables.filter(it=>it.kind==='npc'&&it.id!=='caravan').find(it=>Math.hypot(it.x-scene.player.x,it.y-scene.player.y)<185);
    if(near)openDialogue(near.id);
   },1000);
  },1300);
 };
 const concern={
  roxy:['脸色怎么突然这么差？先别握着魔杖了。看着我，慢慢呼吸。','急に顔色が悪くなりましたね。杖を置いて。私を見て、ゆっくり息をしてください。'],
  sylphy:['你的手好冷……明明刚才还好好的。你在害怕什么？','手が冷たい……さっきまで平気だったのに。何が怖いの？'],
  paul:['喂，站稳。你刚刚那眼神，可不像只做了个噩梦。','おい、しっかりしろ。その目、ただの悪い夢じゃなさそうだな。'],
  ghislaine:['呼吸乱了。手在发抖。现在握剑，只会伤到自己。','呼吸が乱れている。手も震えている。今剣を握れば、自分を傷つける。'],
  scout:['你怎么突然没了血色？营火还热着。刚才那句话，你是不是没听见？','急に真っ青になったな。火はまだ温かいぞ。今の話、聞いていたか？']
 };
 window.returnDialogue=id=>{
  if(!concern[id])return null;
  if(!echo.unsettled&&!(id==='scout'&&echo.witnessed.includes('courier')&&!state.flags.caravanWarned))return null;
  activeReaction=id;
  const memory=id==='scout'&&echo.witnessed.includes('courier')&&!state.flags.courierDead;
  return {name:api.DIALOGUE[id][state.lang].name,text:echo.unsettled?t(...concern[id]):t('你一直盯着车夫。有什么话要说吗？','ずっと御者を見ているな。何か言いたいのか？'),choices:[
   [t('让我缓一下。','少し、落ち着かせて。'),t('没有人追问。有人把水递到你手里。','誰も問い詰めない。水が手渡される。')],
   [memory?t('先让车夫留下。东门的石刃会扫过商路。','御者を待たせて。東門の石刃が街道を薙ぐ。'):t('接下来的危险，我想先确认一下。','この先の危険を、先に確かめたい。'),memory?t('你还没走到东门，怎么……算了，我让他先留在营地。','まだ東門へ行っていないのに、なぜ……いや、まず御者をここに残そう。'):t('好。先观察，再行动。你不用一个人硬撑。','そうだな。まず見てから動こう。一人で無理をするな。')],
   [t('其实，我刚才已经死过一次……','実は、さっき一度死んで……'),t('话音被截断。胸口像被无形的手攥住。你说不下去。','言葉が途切れる。見えない手が胸を握る。声が出ない。')]
  ]};
 };
 window.resolveReturnDialogue=(id,index)=>{
  if(activeReaction!==id)return false;
  const entry=window.returnDialogue(id);if(!entry)return false;
  $('#dialogue-text').textContent=entry.choices[index][1];$('#choices').replaceChildren();$('#continue').hidden=false;
  if(index===1&&id==='scout'&&echo.witnessed.includes('courier')&&!state.flags.courierDead){state.flags.caravanWarned=true;mark('saved-courier');}
  if(index===2){echo.confessions++;$('#taboo-veil').classList.add('visible');heartbeat();setTimeout(()=>$('#taboo-veil').classList.remove('visible'),1400);}
  echo.unsettled=false;activeReaction=null;persist();saveGame();$('#continue').focus();return true;
 };
 window.returnMemory=()=>({deaths:echo.deaths,unsettled:echo.unsettled,witnessed:[...echo.witnessed]});
};
