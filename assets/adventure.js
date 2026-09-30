/* Scene extension: deterministic navigation, combat, and persistent exploration. */
window.installAdventure = function (World, api) {
  const { state, tr, saveGame, questToast, sfx, openDialogue, getStarted, I18N, DIALOGUE } = api;
  Object.assign(I18N.zh,{newGame:'开始冒险',water:'水魔术',nature:'旅行风格',kind:'守护',bold:'进攻',curious:'探索',who:'为旅途写下你的名字',trainingQuestDesc:'在东侧训练场，向保罗请教并完成六次挥剑。'});
  Object.assign(I18N.ja,{newGame:'冒険を始める',water:'水魔術',nature:'旅のスタイル',kind:'守護',bold:'攻撃',curious:'探索',who:'旅人の名を記そう',trainingQuestDesc:'東の訓練場でパウロに教わり、六回剣を振る。'});
  DIALOGUE.paul.zh.choices[0][1]='先稳住脚步。在这片训练场完成六次挥剑，再试着把最后一击连贯地打出去。';
  DIALOGUE.paul.ja.choices[0][1]='まず足を安定させろ。この訓練場で六回振ってみろ。最後の一撃まで流れを止めるな。';
  DIALOGUE.roxy.zh.text='先别急着追求更大的魔术。水的形状、速度与温度，都取决于魔力的控制。森林调查之前，先把基础练稳。';
  DIALOGUE.roxy.ja.text='大きな魔術を急ぐ必要はありません。水の形、速さ、温度は魔力の制御次第です。森の調査の前に、基礎を固めましょう。';
  DIALOGUE.roxy.zh.choices[0][1]='我教你冻结的基础。先让水球命中，再降低水的温度，更容易限制敌人的行动。咏唱时要保持稳定，受击会打断它。别把无咏唱当成谁都能做到的事。';
  DIALOGUE.roxy.ja.choices[0][1]='凍結の基礎を教えます。水球を当ててから温度を下げれば、動きを止めやすくなります。詠唱中は姿勢を保って。無詠唱は誰にでもできることではありません。';
  Object.assign(I18N.zh,{roxyQuest:'魔力控制练习',roxyQuestDesc:'成功完成三次基础施法，练习保持咏唱与姿势稳定。',roxyAdviceWater:DIALOGUE.roxy.zh.choices[0][1],roxyAdviceEarth:'土魔术要控制形状与发射速度，而不只是做出更大的石块。先站稳完成咏唱，再瞄准敌人露出的破绽。',roxyAdviceSword:'剑术先练脚步与出剑。向保罗请教基础，接近敌人时留意它的起手。你还不能把斗气当成远程魔术使用。'});
  Object.assign(I18N.ja,{roxyQuest:'魔力制御の稽古',roxyQuestDesc:'姿勢と詠唱を保ち、基礎魔術を三回成功させる。',roxyAdviceWater:DIALOGUE.roxy.ja.choices[0][1],roxyAdviceEarth:'土魔術では形と射出速度を制御します。大きくするだけではありません。足を止めて詠唱し、敵の隙を狙って。',roxyAdviceSword:'まず足運びと剣の振り方をパウロに教わってください。敵の構えを見て。闘気を遠距離魔術のように使うことはできません。'});
  DIALOGUE.sylphy.zh.text='准备去森林了吗？我带了些药。魔力不是用不完的，受伤时别只想着硬撑。';
  DIALOGUE.sylphy.ja.text='森へ行くの？薬を持ってきたよ。魔力にも限りがあるから、怪我をしてまで無理しないでね。';
  DIALOGUE.crystal.zh.text='结晶表面留着反复凿击的裂痕。散落的工具、被魔物踩乱的营地……这里曾有人试图开采魔石。';
  DIALOGUE.crystal.ja.text='結晶には何度も削られた跡がある。散らばった道具と魔物に荒らされた野営地。誰かが魔石を採ろうとしていたらしい。';
  DIALOGUE.crystal.zh.choices=[['记录魔力的流动。','你记下了异常的脉动与开采痕迹。这些线索应该交给洛琪希。'],['检查附近的遗留物。','破损的工具上沾着晶屑。带上调查记录，回去向洛琪希报告。']];
  DIALOGUE.crystal.ja.choices=[['魔力の流れを記録する。','異常な脈動と採掘跡を書き留めた。ロキシーに報告しよう。'],['残された道具を調べる。','壊れた道具に結晶の粉が付いている。調査記録を持ち帰り、ロキシーに報告しよう。']];
  DIALOGUE.sylphy.zh.choices[0]=['能给我一些治疗药吗？','当然。带上这些，别逞强。下次受伤了，也可以回来找我。'];
  DIALOGUE.sylphy.ja.choices[0]=['回復薬を分けてくれる？','もちろん。これを持っていって。無理はしないでね。'];
  Object.assign(I18N.zh,{subtitle:'菲托亚的风，吹向旅途的另一端。',demon:'魔大陆 · 赤岩荒原',demonSub:'旅途第二章 · 遥远的营火',chapter:'序章 · 风起之地'});
  Object.assign(I18N.ja,{subtitle:'フィットアの風が、旅の向こうへと誘う。',demon:'魔大陸 · 赤岩の荒野',demonSub:'第二章 · 遠い焚き火',chapter:'序章 · 風の始まる場所'});
  DIALOGUE.caravan={
    zh:{name:'远行商队',text:'车轮已经修好。漫长的海路之后，是魔大陆的赤岩与陌生的星空。森林的事情告一段落了吗？',choices:[['随商队远行。','你把村庄的风收进记忆。数周后，红色岩壁出现在地平线上。'],['暂时留在村里。','还有想见的人，就去见吧。旅途从来不只向远方延伸。']]},
    ja:{name:'旅の商隊',text:'車輪は直った。長い船旅の先には、魔大陸の赤い岩と見知らぬ星空がある。森の調査は終わったか？',choices:[['商隊と旅立つ。','村の風を心にしまう。数週間後、赤い岩壁が地平線に現れた。'],['今は村に残る。','会いたい人がいるなら、会っておいで。旅は遠くへ進むだけじゃない。']]}
  };
  DIALOGUE.scout={
    zh:{name:'商队的斥候',text:'东面的石门被一尊旧时代的守卫占据了。先观察地面的裂光。它砸下石刃之后，才是你出手的机会。',choices:[['我会清理商路。','这不是比谁更勇敢。活着回到营火边，才算完成委托。'],['先补充物资。','三枚魔石可以换两瓶治疗药。荒原上，活下去的准备永远不嫌多。']]},
    ja:{name:'商隊の斥候',text:'東の石門を古い守護者が塞いでいる。地面の光を見ろ。石の刃を振り下ろした後が、反撃の好機だ。',choices:[['街道を開こう。','勇気を競う仕事じゃない。生きて焚き火に戻ってこそ、依頼の完了だ。'],['物資を補充したい。','魔石三つで回復薬二本だ。荒野では備えが命を守る。']]}
  };
  let destination=null;
  window.adventureDialogueChoice=(id,index)=>{
    if(id==='sylphy'&&index===0&&!state.flags.sylphyGift){state.flags.sylphyGift=true;state.inventory.potions+=2;questToast(text('希露菲的心意 · 治疗药 ×2','シルフィの贈り物 · 回復薬 ×2'));}
    if(id==='roxy'&&state.quests.forest==='done'&&!state.flags.chapterReward){state.flags.chapterReward=true;state.inventory.gold+=25;questToast(text('调查完成 · 村北商队已准备出发','調査完了 · 村の北で商隊が待っている'));}
    if(id==='caravan'&&index===0){if(state.quests.forest==='done'){destination='demon';}else $('#dialogue-text').textContent=text('先把森林调查的结果交给洛琪希，再安心出发吧。','まず森の調査をロキシーに報告してこよう。');}
    if(id==='scout'&&index===1){if(state.inventory.shards>=3){state.inventory.shards-=3;state.inventory.potions+=2;$('#dialogue-text').textContent=text('交易完成。治疗药 ×2。','取引成立。回復薬 ×2。');}else $('#dialogue-text').textContent=text('魔石不足。需要三枚。','魔石が足りない。三つ必要だ。');}
  };
  window.adventureDialogueClosed=()=>{if(destination){state.flags.demonVisited=true;state.day+=21;window.currentWorld.travel(destination,{x:640,y:590});destination=null;}};
  const $ = s => document.querySelector(s);
  const text = (zh, ja) => state.lang === 'ja' ? ja : zh;
  const signTranslations=[['通往森林','森へ'],['远行商队','旅の商隊'],['旅人的住处','旅人の宿'],['旧营地','古い野営地'],['商队斥候','商隊の斥候']];
  const base = Object.fromEntries(['create','updateHud','addNpc','travel','updateInteraction'].map(k => [k, World.prototype[k]]));
  const icons = {sword:'sword',water:'droplet',wind:'wind',heal:'flask-round',burst:'snowflake'};
  const hud = $('#hud');
  document.body.insertAdjacentHTML('beforeend','<section id="adventure-panel" role="dialog" aria-modal="true" hidden><div class="adventure-panel-inner"><header><h2></h2><button class="icon-btn" id="adventure-close" aria-label="关闭 / 閉じる">×</button></header><div id="adventure-content"></div></div></section>');
  const closePanel=()=>{if(!$('#adventure-panel').hidden){$('#adventure-panel').hidden=true;state.paused=false;window.currentWorld?.physics.resume();document.body.focus();}};
  const openPanel=mode=>{
    if(!getStarted()||state.dialogOpen||state.paused)return;
    state.paused=true;window.currentWorld?.physics.pause();$('#adventure-panel').hidden=false;
    $('#adventure-panel h2').textContent=mode==='map'?tr(state.area):text('旅行行囊','旅の持ち物');
    const content=$('#adventure-content');content.replaceChildren();
    if(mode==='map'){
      const map=document.createElement('div');map.className='large-map';
      const img=document.createElement('img');img.src=state.area==='forest'?'assets/forest-v3.png':'assets/'+state.area+'-map.png';img.alt=tr(state.area);map.appendChild(img);
      const dot=document.createElement('span');dot.className='map-you';const s=window.currentWorld;dot.style.left=s.player.x/1920*100+'%';dot.style.top=s.player.y/1080*100+'%';map.appendChild(dot);
      s.interactables.filter(it=>it.kind!=='herb').forEach(it=>{const marker=document.createElement('span');marker.className='map-location';marker.style.left=it.x/1920*100+'%';marker.style.top=it.y/1080*100+'%';marker.textContent=it.kind==='npc'?DIALOGUE[it.id]?.[state.lang]?.name||tr(it.id):it.label;map.appendChild(marker);});content.appendChild(map);
    }else{
      const inv=state.inventory,rank=state.progress.weaponRank||0;
      const rows=[[text('铜币','銅貨'),inv.gold],[text('治疗药','回復薬'),inv.potions],[text('药草','薬草'),inv.herbs],[text('魔石','魔石'),inv.shards],[text('武器强化','武器強化'),'+'+rank]];
      rows.forEach(([label,n])=>{const row=document.createElement('div');row.className='inventory-row';const name=document.createElement('span'),value=document.createElement('strong');name.textContent=label;value.textContent=n;row.append(name,value);content.appendChild(row);});
      const memory=window.returnMemory?.();if(memory){const note=document.createElement('div');note.className='memory-entry';note.textContent=text('固有权能 · 死亡回归。无法主动发动，归还之处无法选择。只有记忆随你回来。','固有権能 · 死に戻り。自ら発動できず、戻る場所も選べない。持ち帰れるのは記憶だけ。')+(memory.deaths?text(' 你记得的终点：',' 覚えている終わり：')+memory.deaths:'');content.appendChild(note);}
      const upgrade=document.createElement('button');upgrade.className='primary';upgrade.textContent=rank>=3?text('已达到强化上限','強化上限に到達'):text('强化武器 · ','武器強化 · ')+(20*(rank+1))+text(' 铜币',' 銅貨');upgrade.disabled=rank>=3||inv.gold<20*(rank+1);upgrade.onclick=()=>{if(rank>=3||inv.gold<20*(rank+1))return;inv.gold-=20*(rank+1);state.progress.weaponRank=rank+1;saveGame();sfx('ui');closePanel();openPanel('bag');};content.appendChild(upgrade);
    }
    $('#adventure-close').focus();
  };
  $('#adventure-close').onclick=closePanel;
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#adventure-panel').hidden){e.preventDefault();e.stopImmediatePropagation();closePanel();}},true);
  [['map','map','区域地图 / 地図'],['bag','backpack','行囊 / 持ち物']].forEach(([mode,icon,label])=>{const b=document.createElement('button');b.className='icon-btn';b.innerHTML='<i data-lucide="'+icon+'"></i>';b.title=label;b.setAttribute('aria-label',label);b.onclick=()=>openPanel(mode);$('.hud-actions').prepend(b);});
  hud.insertAdjacentHTML('beforeend', '<div id="boss-status"><span></span><div class="boss-track"><div id="boss-health"></div></div></div><div id="chapter-notice"></div><div class="adventure-status"></div><div class="action-dock"></div><div class="touch-move"><button data-dir="up">↑</button><button data-dir="left">←</button><button data-dir="down">↓</button><button data-dir="right">→</button></div>');
  const actions = [['melee','F','sword','剑术 · 三段连击','剣術 · 三連撃'],['castMagic','Q','water','水球 / 岩炮弹','ウォーターボール / ストーンキャノン'],['nova','R','burst','水魔术 · 冻结','水魔術 · 凍結'],['dodge','Space','wind','闪避','回避'],['heal','1','heal','治疗药','回復薬'],['stoneRain','T','burst','土魔术 · 石柱','土魔術 · 石柱']];
  actions.forEach(([method,key,icon,zh,ja]) => {
    const b = document.createElement('button'); b.dataset.action = method; b.title = zh + ' / ' + ja; b.setAttribute('aria-label', b.title);
    b.innerHTML = '<span class="skill-art"></span><i data-lucide="'+icons[icon]+'"></i><span class="cooldown"></span><kbd>' + key + '</kbd>';
    b.onclick = () => { if (getStarted() && !state.paused && !state.dialogOpen) window.currentWorld?.[method](); b.blur(); };
    $('.action-dock').appendChild(b);
  });
  [['journal-button','book-open'],['pause-button','settings'],['lang-button','languages'],['sound-button','volume-2']].forEach(([id,icon])=>$('#'+id).innerHTML='<i data-lucide="'+icon+'"></i>');
  window.lucide?.createIcons();
  hud.insertAdjacentHTML('beforeend','<div class="hero-medallion" aria-hidden="true"></div>');
  $('#sound-button').addEventListener('click',()=>{$('#sound-button').innerHTML='<i data-lucide="'+(state.sound?'volume-2':'volume-x')+'"></i>';window.lucide?.createIcons();});
  const held = new Set();
  document.querySelectorAll('[data-dir]').forEach(b => {
    b.onpointerdown = e => { b.setPointerCapture(e.pointerId); held.add(b.dataset.dir); e.preventDefault(); };
    b.onpointerup = b.onpointercancel = () => held.delete(b.dataset.dir);
  });
  window.addEventListener('blur', () => { held.clear(); window.currentWorld?.input.keyboard.resetKeys(); });

  // The ground corridors are in world coordinates and follow the painted paths.
  const paths = {
    village: [[960,100,960,580,58],[690,355,1170,355,45],[960,580,890,615,45],[890,615,1030,620,43],[710,500,900,570,34],[340,545,710,545,31],[700,530,700,840,30],[700,840,1030,940,38],[1030,940,1135,865,38],[1135,865,1180,725,31],[1180,725,1170,580,30],[1170,580,1420,545,34],[1420,545,1740,390,38],[1740,390,1770,370,40],[1170,390,1170,545,32],[1170,420,1480,420,65],[1480,420,1480,485,50],[620,355,620,480,54],[400,410,620,480,55],[720,335,960,355,42],[960,560,1170,580,45],[1420,545,1530,680,35],[1530,680,1530,760,35]],
    forest: [[90,455,280,515,33],[280,515,510,520,28],[510,520,680,520,20],[680,520,835,570,34],[960,510,1270,600,185],[1050,660,1370,675,135],[1060,360,1110,460,75],[1380,520,1555,445,40],[1555,445,1640,305,31],[1640,305,1740,240,64]],
    demon:[[250,570,780,620,78],[740,615,1510,595,175],[970,395,1500,395,80],[1480,555,1770,570,72],[680,590,570,565,50],[940,730,1190,820,74],[400,650,650,735,58]]
  };
  function segmentDistance(x,y,p) {
    const [ax,ay,bx,by] = p, vx=bx-ax, vy=by-ay;
    const t=Math.max(0,Math.min(1,((x-ax)*vx+(y-ay)*vy)/(vx*vx+vy*vy||1)));
    return Math.hypot(x-ax-vx*t,y-ay-vy*t);
  }
  paths.village.push([1035,350,1050,535,45],[930,345,1050,345,45],[960,530,1050,535,45]);
  const solids={village:[[950,423,48],[1050,614,35]],forest:[[1345,575,31],[1115,365,23],[928,772,35]],demon:[[880,551,34],[1270,369,28],[830,684,45]]};
  World.prototype.walkable = function(x,y) { return paths[this.area].some(p => segmentDistance(x,y,p) < p[4]) && !(solids[this.area]||[]).some(([cx,cy,r])=>Math.hypot(x-cx,y-cy)<r); };
  World.prototype.createOcclusionLayers = function() {
    if(this.area==='village')this.addOcclusionLayer([{type:'circle',x:946,y:384,radius:43}],423);
  };
  World.prototype.createBlockers = function() {};
  World.prototype.setCameraZoom = function() {
    this.cameras.main.setZoom(Math.max(1.12,Math.min(1.7,this.scale.height/620)));
  };
  World.prototype.create = function() {
    state.inventory={gold:0,potions:3,herbs:0,shards:0,...state.inventory};
    state.progress={kills:0,training:0,harvests:[],boss:false,...state.progress};
    delete this.lockedAt;
    this.enemies=null;this.nearby=null;this.signs=[];
    base.create.call(this);
    this.player.setScale(.205).setOrigin(.5,.94);
    this.player.body.setSize(76,46).setOffset(126,232);
    const validSaved = this.walkable(this.player.x,this.player.y);
    if (!validSaved) this.player.setPosition(this.area === 'village' ? 960:this.area==='demon'?290:145,this.area === 'village' ? 525:this.area==='demon'?590:468);
    this.lastValid = {x:this.player.x,y:this.player.y};
    this.playerShadow = this.add.ellipse(this.player.x,this.player.y,30,11,0x10221d,.3);
    this.cd = {}; this.dashUntil=0; this.stunUntil=0; this.invulnerableUntil=0; this.combo=0;
    state.inventory ||= {gold:0,potions:3,herbs:0,shards:0};
    state.progress ||= {kills:0,training:0,harvests:[],boss:false};
    this.input.mouse.disableContextMenu();
    this.pointerAttack = pointer => {
      if (!getStarted() || state.paused || state.dialogOpen || pointer.y < 70 || pointer.y > this.scale.height-90) return;
      const p=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
      this.aim={x:p.x-this.player.x,y:p.y-this.player.y};
      if(pointer.rightButtonDown()) this.melee(); else this.castMagic();
    };
    this.input.on('pointerdown',this.pointerAttack);
    this.extraKey = e => {
      if(!getStarted()||state.paused||state.dialogOpen||e.repeat) return;
      if(e.code==='Space') { e.preventDefault(); this.dodge(); }
      if(e.code==='KeyR') this.nova();
      if(e.code==='KeyT') this.stoneRain();
      if(e.code==='Digit1') this.heal();
      if(e.code==='KeyI')openPanel('bag');
      if(e.code==='KeyM')openPanel('map');
    };
    this.input.keyboard.on('keydown',this.extraKey);
    this.events.once('shutdown',()=>{this.input.off('pointerdown',this.pointerAttack);this.input.keyboard.off('keydown',this.extraKey);$('#boss-status').style.display='none';});
    this.createGathering();
    let beat=0;
    this.time.addEvent({delay:650,loop:true,callback:()=>{
      if(!getStarted()||state.paused||state.dialogOpen)return;
      const ctx=api.getAudio();if(!ctx)return;
      const notes=this.area==='demon'?[146.83,220,293.66,329.63,261.63,220,196,220]:[196,293.66,392,440,329.63,293.66,246.94,293.66];
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=notes[beat++%notes.length];
      gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.025*(state.settings.volume||.7),ctx.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+1.3);osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+1.4);
    }});
    this.time.delayedCall(600,()=>{const n=$('#chapter-notice');n.textContent=this.area==='demon'?text('第二章 · 遥远的营火','第二章 · 遠い焚き火'):this.area==='forest'?text('林间的回响','森に残る響き'):text('序章 · 风起之地','序章 · 風の始まる場所');n.classList.add('visible');this.time.delayedCall(2300,()=>n.classList.remove('visible'));});
    this.cameras.main.fadeIn(450,12,22,23);
  };
  World.prototype.addNpc = function(id,x,y,row) {
    base.addNpc.call(this,id,x,y,row);
    const n=this.interactables[this.interactables.length-1];
    const texture=this.textures.get('cast'),frames=[[0,443],[443,485],[950,320],[1310,464]];
    const [left,width]=frames[row];if(!texture.has(id))texture.add(id,0,left,0,width,887);
    n.sprite.setTexture('cast',id).setScale(.079).setOrigin(.5,.98); n.sprite.body.setSize(180,65).setOffset(width/2-90,795);
    n.marker.setY(y-66); this.tweens.killTweensOf(n.marker);
    this.add.ellipse(x,y,30,10,0x13281e,.28).setDepth(y-.5);
    n.nameLabel=this.add.text(x,y+13,tr(id),{fontFamily:'Arial,"Microsoft YaHei",sans-serif',fontSize:'12px',color:'#faf2da',stroke:'#172620',strokeThickness:2}).setOrigin(.5).setDepth(y+1);
  };
  World.prototype.createWorldActors = function() {
    if(this.area==='village') {
      this.addNpc('roxy',620,440,1); this.addNpc('paul',1410,440,0);
      this.addNpc('sylphy',810,565,2); this.addNpc('ghislaine',1530,730,3);
      this.interactables.push({id:'forestGate',kind:'gate',x:1760,y:380,label:tr('travel')});
      this.addSign(1735,357,text('通往森林','森へ'));
      this.interactables.push({id:'caravan',kind:'npc',x:960,y:135,label:text('远行商队','旅の商隊')});
      this.addSign(960,118,text('远行商队','旅の商隊'));
      this.interactables.push({id:'rest',kind:'rest',x:1010,y:897,label:text('回家休息','家で休む')});
      this.addSign(1010,878,text('旅人的住处','旅人の宿'));
    } else if(this.area==='forest') {
      this.interactables.push({id:'villageGate',kind:'gate',x:100,y:455,label:tr('returnVillage')});
      this.interactables.push({id:'crystal',kind:'object',x:1740,y:220,label:tr('inspect')+' · '+tr('crystal')});
      this.interactables.push({id:'rest',kind:'rest',x:1090,y:350,label:text('篝火休息','焚き火で休む')});
      this.addSign(1090,325,text('旧营地','古い野営地'));
      this.createSpirits();
    } else {
      this.interactables.push({id:'villageGate',kind:'gate',x:260,y:565,label:text('返回村庄','村へ戻る')});
      this.interactables.push({id:'rest',kind:'rest',x:640,y:555,label:text('营火休息','焚き火で休む')});
      this.interactables.push({id:'scout',kind:'npc',x:735,y:575,label:text('商队斥候','商隊の斥候')});
      this.add.sprite(735,575,'npcs',0).setScale(.19).setOrigin(.5,.94).setTint(0xd1d6c5).setDepth(575);
      this.addSign(735,511,text('商队斥候','商隊の斥候'));
      this.interactables.push({id:'finish',kind:'finish',x:1770,y:560,label:text('查看石门','石門を調べる')});
      this.createSpirits();
    }
  };
  World.prototype.addSign=function(x,y,label){const sign=this.add.text(x,y,label,{fontFamily:'Arial,"Microsoft YaHei",sans-serif',fontSize:'12px',color:'#f8e7b9',stroke:'#15281f',strokeThickness:2}).setOrigin(.5).setDepth(2300);this.signs.push({sign,pair:signTranslations.find(pair=>pair.includes(label))});};
  World.prototype.createGathering=function(){
    const points=this.area==='village'?[[715,780],[1090,887],[665,383]]:this.area==='forest'?[[880,580],[1050,740],[1270,430],[1470,480]]:[[920,415],[1130,790],[1460,410]];
    points.forEach(([x,y],i)=>{
      const id=this.area+'-herb-'+i;
      if(state.progress.harvests.includes(id))return;
      const item=this.add.container(x,y).setDepth(y);
      const stem=this.add.graphics().lineStyle(2,0xb6d48c).lineBetween(0,0,-3,-13).lineBetween(-2,-7,6,-12);
      item.add([stem,this.add.ellipse(-5,-12,9,5,0x9ccd8a).setAngle(35),this.add.ellipse(5,-12,9,5,0xcee3a2).setAngle(-35)]);
      const sparkle=this.add.star(0,-23,4,2,5,0xf5e7a7,.9);item.add(sparkle);
      this.tweens.add({targets:sparkle,alpha:.2,y:-27,duration:1100,yoyo:true,repeat:-1});
      this.interactables.push({id,kind:'herb',x,y,sprite:item,label:text('采集药草','薬草を採る')});
    });
  };
  World.prototype.createSpirits=function(){
    this.enemies=this.physics.add.group();
    const demon=this.area==='demon';
    const positions=demon?[[1020,625],[1330,420],[1330,750]]:[[1000,675],[1260,565],[1420,485]];
    if(!(demon?state.progress?.demonBoss:state.progress?.boss))positions.push(demon?[1570,565]:[1665,285]);
    positions.forEach(([x,y],i)=>{
      const boss=i===3, e=this.physics.add.sprite(x,y,'spirit',0).setOrigin(.5,.85).setScale(boss?.16:.085).setDepth(y);
      e.body.setSize(170,110).setOffset(185,480);
      e.setData({hp:boss?(demon?60:36):7,maxHp:boss?(demon?60:36):7,homeX:x,homeY:y,boss,phase:'idle',until:0,stun:0});
      if(demon)e.setTint(boss?0xffb2a0:0xa9e3e6);
      if(demon){e.setTexture('guardian').setDisplaySize(boss?132:66,boss?145:73).setOrigin(.5,.94).clearTint();e.body.setSize(e.width*.45,e.height*.2).setOffset(e.width*.275,e.height*.72);if(!boss)e.setTint(0xc7c5ba);}
      e.health=this.add.graphics().setDepth(y+1); this.enemies.add(e);
      e.shadow=this.add.ellipse(x,y,boss?64:32,boss?20:10,0x102020,.33).setDepth(y-1);
    });
  };
  World.prototype.direction=function(){
    if(this.aim){const d=Math.hypot(this.aim.x,this.aim.y)||1;return [this.aim.x/d,this.aim.y/d];}
    return {down:[0,1],up:[0,-1],left:[-1,0],right:[1,0]}[this.facing];
  };
  World.prototype.ready=function(name,ms){if(!getStarted()||state.paused||state.dialogOpen||(this.cd[name]||0)>this.time.now)return false;this.cd[name]=this.time.now+ms;return true;};
  World.prototype.update=function(_,delta){
    if(!this.player)return;
    const locked=!getStarted()||state.paused||state.dialogOpen;
    this.time.paused=locked;this.tweens.timeScale=locked?0:1;
    if(locked){this.lockedAt??=this.time.now;this.player.setVelocity(0);return;}
    if(this.lockedAt!==undefined){
      const lost=this.time.now-this.lockedAt;
      Object.keys(this.cd).forEach(k=>this.cd[k]+=lost);
      this.dashUntil+=lost;this.stunUntil+=lost;this.invulnerableUntil+=lost;
      this.enemies?.getChildren().forEach(e=>e.setData({until:e.getData('until')+lost,stun:e.getData('stun')+lost,wetUntil:(e.getData('wetUntil')||0)+lost}));
      delete this.lockedAt;
    }
    const dt=Math.min(delta,50),p=this.player;
    if(!this.walkable(p.x,p.y)){
      if(this.walkable(p.x,this.lastValid.y))p.y=this.lastValid.y;
      else if(this.walkable(this.lastValid.x,p.y))p.x=this.lastValid.x;
      else p.setPosition(this.lastValid.x,this.lastValid.y);
      p.body.reset(p.x,p.y);
    }
    this.lastValid={x:p.x,y:p.y};
    let dx=+(this.keys.right.isDown||this.keys.right2.isDown||held.has('right'))-+(this.keys.left.isDown||this.keys.left2.isDown||held.has('left'));
    let dy=+(this.keys.down.isDown||this.keys.down2.isDown||held.has('down'))-+(this.keys.up.isDown||this.keys.up2.isDown||held.has('up'));
    const moving=dx||dy,run=this.keys.run.isDown&&state.stamina>3;
    if(this.time.now>this.dashUntil&&this.time.now>this.stunUntil){
      if(moving){
        const length=Math.hypot(dx,dy);dx/=length;dy/=length;this.aim=null;
        this.facing=Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'up':'down';
        p.setVelocity(dx*(run?235:155),dy*(run?235:155));
        // Ping-pong traversal avoids the discontinuous last-to-first frame jump.
        const sequence=[0,1,2,3,2,1],row={down:0,left:4,right:8,up:12}[this.facing];
        p.setFrame(row+sequence[Math.floor(this.time.now/(run?78:110))%6]);
        if(this.time.now>this.nextStepAt){sfx('step');this.nextStepAt=this.time.now+(run?230:320);}
        if(run)state.stamina=Math.max(0,state.stamina-dt*.016);
      }else{p.setVelocity(0);p.setFrame({down:0,left:4,right:8,up:12}[this.facing]);}
    }
    if(!run)state.stamina=Math.min(100,state.stamina+dt*.018);
    p.setDepth(p.y);this.playerShadow.setPosition(p.x,p.y).setDepth(p.y-.5);
    state.minute+=dt*.0008;state.mp=Math.min(100,state.mp+dt*.005);
    this.updateEnemies();this.updateInteraction();
    state.positions[this.area]={x:Math.round(p.x),y:Math.round(p.y)};
    if(this.time.now>this.nextHudAt){this.updateHud();this.nextHudAt=this.time.now+80;}
  };
  World.prototype.updateEnemies=function(){
    if(!this.enemies)return;
    this.enemies.getChildren().forEach(e=>{
      if(!e.active||e.getData('dead'))return;
      const now=this.time.now,boss=e.getData('boss'),d=Phaser.Math.Distance.Between(e.x,e.y,this.player.x,this.player.y);
      e.setDepth(e.y); e.shadow.setPosition(e.x,e.y).setDepth(e.y-1);
      const barY=e.y-(boss&&this.area==='demon'?148:62);
      e.health.clear().fillStyle(0x112124,.8).fillRoundedRect(e.x-20,barY,40,4,2).fillStyle(boss?0xe3927e:0xc9daaa).fillRoundedRect(e.x-20,barY,40*Math.max(0,e.getData('hp'))/e.getData('maxHp'),4,2).setDepth(e.y+1);
      if(now<e.getData('stun'))return;
      if(e.getData('phase')==='windup'){
        e.setVelocity(0);
        if(now>e.getData('until')){
          const aim=e.getData('target'),r=boss?105:58;
          e.warning?.destroy();this.impactRing(aim.x,aim.y,boss?0xf8a27c:0x9ae4ee,r/2);sfx('swing');
          this.tweens.add({targets:e,angle:8,duration:85,yoyo:true,onComplete:()=>e.active&&e.setAngle(0)});
          if(Math.hypot(this.player.x-aim.x,this.player.y-aim.y)<r)this.hurtPlayer(e);
          (e.extraWarnings||[]).forEach(w=>{this.impactRing(w.x,w.y,0xf8a27c,35);if(Math.hypot(this.player.x-w.x,this.player.y-w.y)<70)this.hurtPlayer(e);w.destroy();});e.extraWarnings=[];
          e.setData({phase:'recover',until:now+(boss?950:1200)});
        }return;
      }
      if(e.getData('phase')==='recover'&&now<e.getData('until')){e.setVelocity(0);return;}
      if(d<(boss?this.area==='demon'?305:215:140)){
        const aim={x:this.player.x,y:this.player.y};e.setVelocity(0).setData({phase:'windup',until:now+(boss?1000:800),target:aim});
        e.warning=this.add.circle(aim.x,aim.y,boss?105:58,0xe9775c,.18).setStrokeStyle(2,0xffb18c,.85).setDepth(1900);
        this.tweens.add({targets:e.warning,alpha:.48,duration:200,yoyo:true,repeat:3});
        if(boss&&this.area==='demon'&&e.getData('hp')<=30){
          e.extraWarnings=[-1,1].map(side=>this.add.circle(aim.x+side*125,aim.y,70,0xe9775c,.15).setStrokeStyle(2,0xffb18c,.8).setDepth(1900));
        }
      }else if(d<(boss?350:285))this.physics.moveToObject(e,this.player,boss?43:48);
      else{
        const h=Math.hypot(e.x-e.getData('homeX'),e.y-e.getData('homeY'));
        if(h>8)this.physics.moveTo(e,e.getData('homeX'),e.getData('homeY'),30);else e.setVelocity(0);
      }
      if(!this.walkable(e.x,e.y)) {e.setPosition(e.getData('homeX'),e.getData('homeY'));e.setVelocity(0);}
    });
  };
  World.prototype.castMagic=function(){
    const cost=state.aptitude==='sword'?6:8;
    if(state.mp<cost||!this.ready('castMagic',480))return;
    state.mp-=cost;state.magicCasts++;
    const [dx,dy]=this.direction(),x=this.player.x+dx*20,y=this.player.y-16+dy*20;
    const earth=state.aptitude==='earth',sword=state.aptitude==='sword',color=earth?0xe5c989:sword?0xffefc1:0x9ce9ff;
    const shot=sword?this.add.arc(x,y,25,-65,65,false,color,.16).setStrokeStyle(4,color).setRotation(Math.atan2(dy,dx)).setDepth(1900):this.add.ellipse(x,y,earth?19:12,earth?22:36,color).setStrokeStyle(2,0xf3ffff).setRotation(Math.atan2(dy,dx)+Math.PI/2).setDepth(1900);
    const ring=this.add.image(this.player.x,this.player.y,'magicCircle').setDisplaySize(66,66).setAlpha(.6).setDepth(this.player.y-.1);
    this.tweens.add({targets:ring,angle:100,alpha:0,scaleX:ring.scaleX*1.4,scaleY:ring.scaleY*1.4,duration:450,onComplete:()=>ring.destroy()});
    let traveled=0;
    const tick=this.time.addEvent({delay:16,loop:true,callback:()=>{
      if(state.paused||state.dialogOpen)return;
      if(!shot.active){tick.remove();return;}
      const step=10;shot.x+=dx*step;shot.y+=dy*step;traveled+=step;
      if(traveled>560||!this.walkable(shot.x,shot.y+16)){this.burst(shot.x,shot.y,color,5);shot.destroy();tick.remove();return;}
      if(state.settings.effects&&Math.floor(traveled/step)%2===0){const trail=this.add.circle(shot.x,shot.y,4,color,.6).setDepth(1899);this.tweens.add({targets:trail,alpha:0,scale:.1,duration:180,onComplete:()=>trail.destroy()});}
      this.enemies?.getChildren().some(e=>{if(!e.active||e.getData('dead'))return false;if(Math.hypot(shot.x-e.x,shot.y-(e.y-20))<(e.getData('boss')?43:29)){this.impactRing(shot.x,shot.y,color);this.hitEnemy(e,earth?4:3);shot.destroy();tick.remove();return true;}return false;});
    }});
    sfx('cast',earth?330:690);
    if(state.quests.roxy==='active'&&state.magicCasts>=3){state.quests.roxy='done';questToast(tr('roxyQuest'));saveGame();}
  };
  World.prototype.melee=function(){
    if(!this.ready('melee',340))return;
    const [dx,dy]=this.direction(),angle=Math.atan2(dy,dx),x=this.player.x+dx*32,y=this.player.y-15+dy*32;
    this.combo=this.time.now-(this.lastSwing||0)<800?(this.combo+1)%3:0;this.lastSwing=this.time.now;
    const arc=this.add.arc(x,y,48,-70,70,false,0xfff1ce,.14).setStrokeStyle(this.combo===2?7:4,0xfff1ce).setRotation(angle).setDepth(2000);
    this.tweens.add({targets:arc,rotation:angle+.7,alpha:0,scale:1.3,duration:190,onComplete:()=>arc.destroy()});
    this.enemies?.getChildren().forEach(e=>{if(!e.getData('dead')&&Math.hypot(e.x-x,e.y-15-y)<73)this.hitEnemy(e,(this.combo===2?5:2)+(state.nature==='bold'?1:0));});
    if(this.area==='village'&&Math.hypot(this.player.x-1410,this.player.y-440)<130&&state.quests.training==='active'){
      state.progress.training++;if(state.progress.training>=6){state.quests.training='done';state.inventory.gold+=12;questToast(text('基础训练完成 · 报酬 12','基礎訓練完了 · 報酬 12'));saveGame();}
    }sfx('swing');
  };
  World.prototype.dodge=function(){
    if(state.stamina<24||!this.ready('dodge',850))return;
    state.stamina-=24;const [dx,dy]=this.direction();this.player.setVelocity(dx*430,dy*430);
    this.dashUntil=this.time.now+190;this.invulnerableUntil=this.time.now+260;
    if(state.settings.effects)for(let i=0;i<4;i++)this.time.delayedCall(i*35,()=>{const ghost=this.add.image(this.player.x,this.player.y,'player',this.player.frame.name).setScale(.205).setOrigin(.5,.94).setTint(0xb9efff).setAlpha(.3).setDepth(this.player.y-1);this.tweens.add({targets:ghost,alpha:0,duration:180,onComplete:()=>ghost.destroy()});});
    sfx('swing');
  };
  World.prototype.nova=function(){
    if(state.mp<24||!this.ready('nova',6500))return;state.mp-=24;
    const x=this.player.x,y=this.player.y;this.impactRing(x,y,0xc9f7ff,60);this.burst(x,y,0xb2e9ff,24);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;const shard=this.add.triangle(x+Math.cos(a)*75,y+Math.sin(a)*75,0,12,5,-18,10,12,0xd0f5ff,.9).setRotation(a+Math.PI/2).setDepth(1900);this.tweens.add({targets:shard,x:x+Math.cos(a)*145,y:y+Math.sin(a)*145,alpha:0,duration:450,onComplete:()=>shard.destroy()});}
    this.enemies?.getChildren().forEach(e=>{if(!e.getData('dead')&&Math.hypot(e.x-x,e.y-y)<160){this.hitEnemy(e,5);e.setData('stun',this.time.now+1800);e.setVelocity(0);}});sfx('cast',420);
  };
  World.prototype.heal=function(){if(state.hp>=100||state.inventory.potions<1||!this.ready('heal',1800))return;state.inventory.potions--;state.hp=Math.min(100,state.hp+(state.nature==='kind'?60:45));this.impactRing(this.player.x,this.player.y,0xc4eeb3,20);sfx('ui');saveGame();};
  World.prototype.hitEnemy=function(e,damage){
    if(!e.active||e.getData('dead'))return;
    damage+=state.progress.weaponRank||0;
    const hp=e.getData('hp')-damage;e.setData({hp,stun:this.time.now+200});e.setTintFill(0xffffff);
    this.time.delayedCall(85,()=>e.active&&e.clearTint());
    e.setVelocity((e.x-this.player.x)*1.3,(e.y-this.player.y)*1.3);
    this.damageNumber(e.x,e.y-50,damage);this.burst(e.x,e.y-20,0xbcefff,8);sfx('hit');
    if(state.settings.shake)this.cameras.main.shake(75,.002);
    if(hp<=0){
      e.setData('dead',true);e.setVelocity(0);e.warning?.destroy();(e.extraWarnings||[]).forEach(w=>w.destroy());e.health.destroy();e.shadow.destroy();
      const boss=e.getData('boss');state.progress.kills++;state.inventory.shards+=boss?5:1;state.inventory.gold+=boss?30:state.nature==='curious'?6:4;
      if(boss){state.progress[this.area==='demon'?'demonBoss':'boss']=true;questToast(this.area==='demon'?text('荒原商路重新畅通','荒野の街道が開かれた'):text('遗迹重新归于寂静 · 魔石 ×5','遺跡に静寂が戻った · 魔石 ×5'));}
      this.damageNumber(e.x,e.y-65,boss?'+30':'+4','#eed59b');
      this.tweens.add({targets:e,alpha:0,y:e.y-18,duration:300,onComplete:()=>e.destroy()});sfx('defeat');saveGame();
    }
  };
  World.prototype.hurtPlayer=function(e){
    if(this.time.now<this.invulnerableUntil)return;
    this.damageSequence=(this.damageSequence||0)+1;
    this.invulnerableUntil=this.time.now+850;this.stunUntil=this.time.now+180;
    const damage=e.getData('boss')?18:9;state.hp=Math.max(0,state.hp-damage);
    const a=Math.atan2(this.player.y-e.y,this.player.x-e.x);this.player.setVelocity(Math.cos(a)*200,Math.sin(a)*200).setTint(0xffb4a2);
    this.time.delayedCall(150,()=>this.player.clearTint());this.damageNumber(this.player.x,this.player.y-45,damage,'#ffb49e');sfx('hurt');
    if(state.settings.shake)this.cameras.main.shake(130,.004);
    if(state.hp<=0)this.returnByDeath(e);
  };
  World.prototype.updateInteraction=function(){
    base.updateInteraction.call(this);
    const n=this.nearby;
    if(n){
      if(n.kind==='herb')$('#interaction span:last-child').textContent=text('采集药草','薬草を採る');
      else if(n.kind==='rest')$('#interaction span:last-child').textContent=text('休息 · 调制药剂','休息 · 薬を調合');
      else if(n.kind==='finish')$('#interaction span:last-child').textContent=text('查看石门','石門を調べる');
      else if(['caravan','scout'].includes(n.id))$('#interaction span:last-child').textContent=DIALOGUE[n.id][state.lang].name;
    }
  };
  World.prototype.interact=function(){
    const it=this.nearby;if(!it)return;
    if(it.kind==='herb'){state.inventory.herbs++;state.progress.harvests.push(it.id);it.sprite.destroy();this.interactables=this.interactables.filter(v=>v!==it);this.nearby=null;sfx('ui');questToast(text('药草 +1','薬草 +1'));saveGame();}
    else if(it.kind==='rest'){
      if(this.enemies?.getChildren().some(e=>!e.getData('dead')&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<230)){questToast(text('附近还有危险','近くに危険がある'));return;}
      state.hp=100;state.mp=100;state.stamina=100;state.minute+=60;
      const made=Math.floor(state.inventory.herbs/2);state.inventory.potions+=made;state.inventory.herbs%=2;
      this.cameras.main.fadeIn(650,0,0,0);questToast(text('休息完毕','休息を終えた')+(made?text(' · 制成治疗药 ×',' · 回復薬 ×')+made:''));sfx('ui');saveGame();
    }else if(it.id==='crystal'){
      if(!state.progress.boss){questToast(text('魔力乱流尚未平息','魔力の乱れはまだ収まらない'));return;}openDialogue('crystal');
    }else if(it.kind==='finish'){
      if(!state.progress.demonBoss){questToast(text('守卫仍在阻挡去路','守護者が道を塞いでいる'));return;}
      state.flags.chapterComplete=true;questToast(text('第二章完成 · 前路，仍有新的故事','第二章完了 · 道の先には新たな物語'));saveGame();
      openPanel('bag');$('#adventure-panel h2').textContent=text('第二章 · 营火之外','第二章 · 焚き火の向こう');
      $('#adventure-content').replaceChildren();
      const ending=document.createElement('p');ending.className='chapter-ending';ending.textContent=text('石门之后，商队的车轮再次转动。你没有改变世界，却让几个人能够平安回家。今夜的营火旁，会有人记得你的名字。','石門の先で、商隊の車輪が再び動き出す。世界は変わらなくても、家に帰れる人がいる。今夜、焚き火のそばで誰かがあなたの名を覚えている。');$('#adventure-content').appendChild(ending);
      const resume=document.createElement('button');resume.className='primary';resume.textContent=text('继续探索','探索を続ける');resume.onclick=closePanel;$('#adventure-content').appendChild(resume);
    }else if(it.kind==='npc')openDialogue(it.id);
    else if(it.id==='forestGate')this.travel('forest',{x:145,y:468});
    else this.travel('village',this.area==='demon'?{x:960,y:200}:{x:1720,y:392});
  };
  World.prototype.updateHud=function(){
    base.updateHud.call(this);
    this.interactables.forEach(it=>it.nameLabel?.setText(tr(it.id)));
    this.signs.forEach(({sign,pair})=>pair&&sign.setText(text(...pair)));
    const inv=state.inventory;$('.adventure-status').textContent=text('铜币 ','銅貨 ')+inv.gold+'  ·  '+text('药草 ','薬草 ')+inv.herbs+'  ·  '+text('治疗药 ','回復薬 ')+inv.potions;
    const max={melee:350,castMagic:state.aptitude==='sword'?900:700,nova:6500,dodge:850,heal:1800,stoneRain:3600};
    actions.forEach(([method])=>{$('[data-action="'+method+'"] .cooldown').style.transform='scaleY('+Math.max(0,((this.cd[method]||0)-this.time.now)/max[method])+')';});
    const primary=$('[data-action="castMagic"]');primary.title=state.aptitude==='sword'?text('踏步斩 · 近身突进','踏み込み斬り · 接近'):state.aptitude==='earth'?text('岩炮弹 · 咏唱 / 魔力 8','ストーンキャノン · 詠唱 / MP 8'):text('水球 · 咏唱 / 魔力 8 / 打湿','ウォーターボール · 詠唱 / MP 8 / 濡れ');primary.setAttribute('aria-label',primary.title);
    let target,desc;
    if(!state.quests.forest){target=this.area==='village'?[620,440]:[100,455];desc=text('拜访洛琪希，了解村外的异变','ロキシーに森の異変を聞く');}
    else if(state.quests.forest==='return'){target=this.area==='forest'?[100,455]:[620,440];desc=text('把调查结果带给洛琪希','ロキシーに調査結果を伝える');}
    else if(state.quests.forest==='done'){target=this.area==='village'?[960,135]:[100,455];desc=text('前往村北商队，启程魔大陆','村の北の商隊と魔大陸へ');}
    else if(this.area==='village'){target=[1760,380];desc=text('沿村东小径进入森林','村の東から森へ向かう');}
    else {target=[1740,220];desc=state.progress.boss?text('调查遗迹中的水晶','遺跡の水晶を調べる'):text('探索旧营地以东的遗迹','野営地の東にある遺跡を探索');}
    if(this.area==='demon'){target=state.progress.demonBoss?[1770,560]:[1570,565];desc=state.flags.chapterComplete?text('商路已畅通 · 休整与自由探索','街道は開かれた · 自由探索'):state.progress.demonBoss?text('前往东侧石门，确认商路','東の石門で街道を確かめる'):text('讨伐石门守卫，打通荒原商路','石門の守護者を倒し、街道を開く');}
    $('#objective-text').textContent=desc;
    $('#minimap').style.backgroundImage='url("assets/'+(this.area==='forest'?'forest-v3.png':this.area+'-map.png')+'")';
    if(target)$('#objective-arrow').style.transform='rotate('+(Math.atan2(target[1]-this.player.y,target[0]-this.player.x)*180/Math.PI+90)+'deg)';
    const boss=this.enemies?.getChildren().find(e=>e.getData('boss')&&!e.getData('dead'));
    const show=boss&&Math.hypot(boss.x-this.player.x,boss.y-this.player.y)<440;
    $('#boss-status').style.display=show?'block':'none';
    if(show){$('#boss-status span').textContent=this.area==='demon'?text('赤岩守卫 · 断刃','赤岩の守護者 · 断刃'):text('遗迹守望者','遺跡の守り手');$('#boss-health').style.width=100*boss.getData('hp')/boss.getData('maxHp')+'%';}
  };
  window.installSpellPresentation(World,api);
  window.installReturnByDeath(World,api);
};
