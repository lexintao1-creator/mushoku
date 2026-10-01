/* Independent remake: no runtime dependency on the earlier prototype. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s), B=window.Book, M=window.WorldBook;
  const STORE='mushoku-return-book-v1',MEMORY='mushoku-return-book-memory-v1';
  const parse=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d;}catch{return d;}};
  let settings=parse(STORE+'-settings',{lang:'zh',volume:.45,shake:true,effects:true,touch:matchMedia('(pointer:coarse)').matches});
  let memory=parse(MEMORY,{deaths:0,ambush:false,trauma:0});
  const fresh=()=>({stage:0,chapter:0,area:'village',x:768,y:800,hp:100,maxHp:100,mp:90,maxMp:90,gold:20,potions:4,ore:0,herbs:0,xp:0,level:1,sword:0,swordKills:0,flags:{},quests:{},kills:[],opened:[],log:[],anchor:null});
  let state=fresh(),scene,started=false,paused=false,dialogDone=null,currentPanel=null,toastTimer,transitionTimer;const panelStack=[];
  let audio;const keys=new Set(),pressed=new Set(),held=new Map(),virtual=new Set();
  const tr=v=>Array.isArray(v)?v[settings.lang==='ja'?1:0]:v;
  const t=(zh,ja)=>settings.lang==='ja'?ja:zh;
  function sound(kind){
    if(settings.volume===0)return;
    try{audio||=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const now=audio.currentTime;
      const patterns={ui:[620,850],gather:[220,330],splash:[150,95,65],water:[340,580,210],stone:[120,70],fire:[95,180,60],frost:[1100,1500,900],slash:[320,130],hit:[90,42],loot:[480,720,960],death:[130,88,55],dodge:[270,440],heal:[330,490,660]};
      (patterns[kind]||patterns.ui).forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.type=['hit','stone','fire'].includes(kind)?'triangle':'sine';o.frequency.setValueAtTime(f,now+i*.055);o.frequency.exponentialRampToValueAtTime(Math.max(25,f*.55),now+i*.055+.12);g.gain.setValueAtTime(settings.volume*.095,now+i*.055);g.gain.exponentialRampToValueAtTime(.001,now+i*.055+.19);o.connect(g).connect(audio.destination);o.start(now+i*.055);o.stop(now+i*.055+.21);});
      if(['hit','slash','fire','stone','water','splash'].includes(kind)){const duration=kind==='splash'?.38:.13,len=Math.floor(audio.sampleRate*duration),buffer=audio.createBuffer(1,len,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*(1-i/len);const n=audio.createBufferSource(),filter=audio.createBiquadFilter(),g=audio.createGain();n.buffer=buffer;filter.type='lowpass';filter.frequency.value=['water','splash'].includes(kind)?2000:750;g.gain.value=settings.volume*.14;n.connect(filter).connect(g).connect(audio.destination);n.start();}
    }catch{}
  }
  function toast(msg){$('#toast').textContent=tr(msg);$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
  function icons(){window.lucide?.createIcons();}
  function setPaused(value){paused=value;document.body.dataset.paused=String(value);keys.clear();pressed.clear();held.clear();virtual.clear();if(scene){scene.player?.setVelocity(0);scene.enemies?.forEach(e=>e.sprite.setVelocity(0));value?scene.physics.pause():scene.physics.resume();value?scene.anims.pauseAll():scene.anims.resumeAll();}}
  function save(){if(!started||state.hp<=0)return;state.x=scene.player.x;state.y=scene.player.y;localStorage.setItem(STORE,JSON.stringify(state));}
  function remember(){localStorage.setItem(MEMORY,JSON.stringify(memory));}
  function anchor(){state.anchor=null;state.anchor=JSON.parse(JSON.stringify({...state,x:scene.player.x,y:scene.player.y}));save();}
  function setStage(n){state.stage=n;state.chapter=n<1?0:n<4?1:n<6?2:n<9?3:4;const o=B.objectives[n];state.log.push({title:tr(B.chapters[state.chapter]),text:tr(o[0])});save();hud();}
  function doneQuest(id){state.quests[id]='done';toast([tr(B.quests.find(q=>q.id===id).name)+' · '+t('完成','完了'),tr(B.quests.find(q=>q.id===id).name)+' · '+t('完成','完了')]);save();}
  function hud(){
    if(!scene||!started)return;
    const combat=!!scene.cast||scene.projectiles.length>0||scene.enemies.some(e=>!e.dead&&!e.peace&&Math.hypot(e.sprite.x-scene.player.x,e.sprite.y-scene.player.y)<330);
    $('#hud').dataset.mode=combat?'combat':'explore';document.body.dataset.touch=String(settings.touch);
    $('#touch').hidden=!settings.touch;
    $('#hp').style.width=Math.max(0,state.hp/state.maxHp*100)+'%';$('#mp').style.width=state.mp/state.maxMp*100+'%';$('#health-value').textContent=Math.ceil(state.hp)+' / '+state.maxHp;
    $('#player-name').textContent=t('旅人 · 赛伊','旅人 · セイ')+'  Lv.'+state.level;$('#rank').textContent=t('初级 · 咏唱魔术师','初級 · 詠唱魔術師');$('#chapter').textContent=tr(B.chapters[state.chapter]);$('#objective').textContent=tr(B.objectives[state.stage].slice(0,2));$('#objective-sub').textContent=tr(B.objectives[state.stage].slice(2));
    B.skills.forEach((s,i)=>{const el=$('#skill-'+s.id),locked=state.stage<s.unlock;el.disabled=locked;el.title=tr(s.name)+' · '+tr(s.desc)+' · MP '+s.mp;el.querySelector('.cooldown').hidden=!locked&&scene.cooldowns[s.id]<=scene.clock;el.querySelector('.cooldown').textContent=locked?'—':Math.max(0,(scene.cooldowns[s.id]-scene.clock)/1000).toFixed(1);});
    const near=scene.near;$('#prompt').hidden=!near||paused;$('#prompt').innerHTML=near?'<kbd>'+ (settings.touch?t('触碰','タップ'):'E')+'</kbd>'+eventName(near):'';
    if(scene.cast){$('#castbar').hidden=false;$('#castbar span').textContent=tr(scene.cast.skill.name)+' · '+t('咏唱','詠唱');$('#castbar i').style.width=Math.min(100,(scene.clock-scene.cast.start)/scene.cast.skill.cast*100)+'%';}else $('#castbar').hidden=true;
    scene.drawMap($('#minimap'));$('#area-label').textContent=tr(scene.map.name);
  }
  function eventName(e){const names={rest:t('休息','休む'),herb:t('采集月叶草','月葉草を採る'),chest:t('查看遗留物','残された物を調べる'),lore:t('阅读记录','記録を読む'),upgrade:t('整备武器','武器を整える'),objective:t('调查','調べる')};return e.type==='npc'?tr(B.talks[e.id]?.name):e.type==='portal'?t('前往 · ','向かう · ')+tr(M.names[e.to]):names[e.type];}
  function dialogue(name,lines,choices=[],art=-1){
    setPaused(true);$('#dialog').hidden=false;$('#speaker').textContent=tr(name);$('.dialog-art').style.display=art<0?'none':'block';$('#dialog').style.gridTemplateColumns=art<0?'1fr':'';$('.dialog-art').style.backgroundPosition=(art/3*100)+'% 50%';
    const portrait=art>=4?window.CivilPortraits?.[art-4]:window.BookPortraits?.[art];$('.dialog-art').style.backgroundImage=art>=0?'url("'+portrait+'")':'none';$('.dialog-art').style.backgroundSize='contain';$('.dialog-art').style.backgroundPosition='center bottom';
    let index=0;const render=()=>{const text=tr(lines[index]);$('#line').textContent=text;$('#choices').replaceChildren();const actions=index<lines.length-1?[[t('继续','続ける'),()=>{index++;render();}]]:choices.length?choices:[[t('离开','離れる'),closeDialogue]];actions.forEach(([label,fn])=>{const button=document.createElement('button');button.textContent=tr(label);button.onclick=()=>{sound('ui');fn();};$('#choices').appendChild(button);});$('#choices button').focus();};render();
  }
  function closeDialogue(){if($('#dialog').hidden)return;$('#dialog').hidden=true;setPaused(false);const fn=dialogDone;dialogDone=null;fn?.();save();}
  const choice=(label,fn)=>[label,()=>{closeDialogue();fn?.();}];
  function talk(id){
    const c=B.talks[id];let lines=[...c.lines],choices=[];c.art=({roxy:0,paul:1,sylphy:2,caravan:3,inn:4,courier:5,scout:6,merchant:7,guild:8,survivor:9})[id]??-1;
    if(memory.trauma>0){const reactions={roxy:['先把杖放下来。你的手一直在抖。刚才发生什么了吗？','杖を置いて。手が震えています。何かありましたか？'],paul:['喂，别硬撑。你一直盯着那条路，是看见什么了？','おい、無理するな。あの道に何か見たのか？'],sylphy:['你抓得好紧……我就在这里，没事的。','手、強く握りすぎだよ……ここにいるから、大丈夫。'],scout:['你为什么突然拦住我？我还没说要去东边。','なぜ急に止める？東へ行くとはまだ言ってない。']};lines.unshift(reactions[id]||['旅人，你脸色很差。先喝点水，我们可以等你缓一缓。','旅人さん、顔色が悪い。水を飲んで。少しなら待てる。']);memory.trauma--;remember();}
    if(id==='roxy'){
      if(state.stage===0)choices=[choice(['我去找那位信使。','配達人を捜します。'],()=>{setStage(1);state.quests.relic='active';anchor();}),choice(['再练习一下魔术。','もう少し魔術を練習する。'])];
      else if(state.stage===3){lines=[['名册上都是在这里失去联系的人。结晶的流动越来越不稳定……等等，先离开水边！','名簿には行方不明の人々が。結晶の流れが不安定に……待って、水から離れて！']];choices=[choice(['把名册交给她。','名簿を渡す。'],()=>{setStage(4);state.flags.registry=true;travel('red',[20,28],['第二章 · 赤土上的名字','第二章 · 赤土の名前'],['白光之后，村庄和熟悉的声音都消失了。你手里还握着那本湿透的名册。','白い光の後、村も声も消えた。手には濡れた名簿だけが残っていた。'],true);})];}
      else lines=[['想把术式省略掉，先把形状、速度与魔力的流动理解清楚。现在练习稳定的咏唱，比模仿别人更有用。','詠唱を省く前に、形、速度、魔力の流れを理解しましょう。今は安定した詠唱の練習です。']];
    }
    if(id==='paul'){
      if(state.quests.sword==='active'&&state.swordKills>=3){lines=[['这次你真的看着对手出剑了。收下吧，下次记得把脚步也带上。','相手を見て斬れるようになったな。受け取れ。次も足を忘れるな。']];choices=[choice(['结束练习。','稽古を終える。'],()=>{state.sword+=5;state.gold+=30;doneQuest('sword');})];}
      else if(!state.quests.sword)choices=[choice(['接受实战练习。','実戦の稽古を受ける。'],()=>{state.quests.sword='active';toast(B.quests[1].text);})];
    }
    if(id==='sylphy'){
      if(state.quests.herbs==='active'&&state.herbs>=3){lines=[['这些就够了！药给你一半。你也得照顾好自己啊。','これで十分！薬を半分あげる。自分のことも大事にしてね。']];choices=[choice(['交付药草。','薬草を渡す。'],()=>{state.herbs-=3;state.potions+=3;state.maxMp+=10;doneQuest('herbs');})];}
      else if(!state.quests.herbs)choices=[choice(['我会带回来。','持って帰るよ。'],()=>{state.quests.herbs='active';toast(B.quests[0].text);})];
    }
    if(id==='inn'){
      if(state.flags.letter&&state.quests.letter!=='done'){lines=[['他写的不是求救，是给母亲的一封信。谢谢你。至少这一次，信到家了。','救いを求める手紙じゃない。母親への手紙だ。ありがとう。今度は、手紙が家に着いた。']];choices=[choice(['递出信封。','封筒を渡す。'],()=>{state.gold+=45;doneQuest('letter');})];}
      else if(!state.quests.letter)choices=[choice(['我去找找他的信。','手紙を探してくる。'],()=>state.quests.letter='active')];
    }
    if(id==='courier'&&state.stage===1)choices=[choice(['我会找回那些名字。','名簿を取り戻す。'],()=>{setStage(2);toast(['霜域已领悟 · 水边的魔力令你理解了降温','霜域を習得 · 水辺の魔力から冷却を理解した']);})];
    if(id==='caravan'){
      if(state.stage===4)choices=[choice(['我去找搬水的人。','水を運ぶ人を捜す。'],()=>{state.quests.names='active';state.quests.ore='active';state.flags.caravan=true;anchor();})];
      else if(state.stage===5)lines=[['城门就在前面。谢谢你没把他们落下。到了公会，先登记这些人的名字。','門はすぐそこ。置いていかずにいてくれてありがとう。ギルドで皆の名前を登録して。']];
    }
    if(id==='scout'){
      if(state.area==='city'){lines=[['我去看了那根支撑木。你说得对。公会本来不认识你，我已经替你作了担保。','支えの木を見た。君が正しかった。ギルドには君の身元を保証しておいた。']];choices=[choice(['你活着回来就好。','戻ってきてよかった。'])];}
      else if(state.flags.scoutDead)lines=[['石路边只剩一截断掉的绳子。你来晚了。','石道には切れた縄だけが残る。遅すぎた。']];
      else choices=[choice(['别走东面的石路，岩石会坠落。','東の石道へ行くな。岩が落ちる。'],()=>{if(state.flags.rockProof){state.flags.scoutSaved=true;state.flags.caravanCredit=true;scene.refreshEvents();toast(['你指出被锯断的支撑木。他收回了出发的水袋，决定跟商队一起走。','切られた支えを指すと、彼は水袋を置き、商隊と同行することにした。']);}else toast(memory.ambush?['你记得岩石如何落下，但他没有见过。去检查石路北侧的支撑木。','落石を覚えている。でも彼は知らない。石道の北の支えを調べよう。']:['他需要的是证据，不是预感。石路北侧能看见岩壁的支撑木。','予感ではなく証拠が要る。石道の北から岩の支えが見える。']);}),choice(['一路小心。','気をつけて。'])];
    }
    if(id==='merchant'){
      const price=state.flags.caravanCredit?9:12;choices=[choice([`购买治疗药 · ${price} 铜币`,`回復薬を買う · 銅貨${price}`],()=>{if(state.gold>=price){state.gold-=price;state.potions++;toast(['治疗药 +1','回復薬 +1']);}else toast(['铜币不足','銅貨が足りない']);})];if(state.flags.caravanCredit)lines.unshift(['护卫替你担保了。这批药给你商队的价格。','護衛が保証してくれた。薬は商隊向けの値段にしよう。']);
      if(state.area==='red'&&state.quests.ore!=='done')choices.unshift(choice(['交付两块魔石','魔石二個を渡す'],()=>{if(state.ore>=2){state.ore-=2;state.potions+=2;state.flags.supplies=true;doneQuest('ore');}else toast(['还需要两块魔石。','魔石が二個必要。']);}));
    }
    if(id==='guild'){
      if(state.stage===5){setStage(6);anchor();}
      if(state.stage===6)choices=[choice(['救援优先。那些名字值得回来。','救援を優先する。彼らは帰るべきだ。'],()=>{state.flags.route='rescue';setStage(7);anchor();}),choice(['取出魔石，先保证我们活下去。','魔石を取る。まず自分たちが生きる。'],()=>{state.flags.route='profit';setStage(7);anchor();})];
      else if(state.stage===8){lines=[['门已经打开了。现在，把你亲眼看见的事情告诉我吧。','扉は開いた。自分の目で見たことを教えて。']];choices=[choice(['交付调查结果。','調査結果を報告する。'],ending)];}
      else if(state.stage===9){lines=[['我们会继续寻找名册上剩下的人。你也一样，对吗？','名簿に残る人を捜し続ける。あなたも、そうでしょう？']];choices=[choice(['看看这一卷的结尾。','この巻の結末を見る。'],()=>showEnding())];}
    }
    if(id==='survivor'){
      if(state.flags.route==='profit'){lines=[['你也来拿那些会发光的石头吗？那我们呢？','あなたも光る石を取りに来たの？私たちは？']];}
      else choices=[choice(['名册在这里。跟我出去。','名簿はここにある。一緒に出よう。'],()=>{if(scene.enemies.some(e=>e.id==='final-guard'&&!e.dead&&!e.peace))toast(['先让守门者停下来。','先に門番を止めよう。']);else{state.flags.survivors=true;toast(['你读出了三个名字。终于有人回应了。','三つの名を読む。ようやく返事があった。']);}})];
    }
    if(memory.deaths>0)choices.push(choice(['告诉他死亡回归的事……','死に戻りを話そうとする……'],()=>{sound('death');scene.fx('taboo',scene.player.x,scene.player.y,0x8b426e);scene.tabooUntil=scene.clock+1600;memory.trauma=Math.max(memory.trauma,1);remember();toast(['话堵在喉咙里。心脏被无形的手握住，旁人只看见你突然捂住胸口。','言葉が詰まる。見えない手が心臓を掴む。相手には胸を押さえる姿しか見えない。']);}));
    dialogue(c.name,lines,choices,c.art);
  }
  function interact(e){
    if(!e||paused)return;sound('ui');
    if(e.type==='npc')return talk(e.id);
    if(e.type==='portal'){if(e.to==='vault'&&state.flags.coreTaken)return toast(['失去魔石支撑的入口已经坍塌。','魔石を失った入口は崩れた。']);if(state.stage<e.stage)return toast(['这里还有没完成的事情。','ここでまだやることがある。']);return travel(e.to,e.spawn);}
    if(e.type==='rest'){state.hp=state.maxHp;state.mp=state.maxMp;save();sound('heal');toast(['火光暖起来，你睡了一会儿。','火が温まり、少し眠った。']);return;}
    if(e.type==='herb'){if(state.opened.includes(e.id))return;state.opened.push(e.id);state.herbs++;scene.refreshEvents();sound('loot');toast(['月叶草 +1','月葉草 +1']);save();return;}
    if(e.type==='chest'){if(state.opened.includes(e.id))return;state.opened.push(e.id);if(e.reward==='letter'){state.flags.letter=true;state.quests.letter||='active';toast(['获得未寄出的信','届かなかった手紙を入手']);}else if(e.reward==='ore'){state.ore+=2;toast(['魔石 +2','魔石 +2']);}else{state.potions+=2;state.gold+=20;toast(['治疗药 +2 · 铜币 +20','回復薬 +2 · 銅貨 +20']);}scene.refreshEvents();sound('loot');save();return;}
    if(e.type==='lore'){if(e.flag)state.flags[e.flag]=true;if(state.flags.namesRed&&state.flags.namesCity&&state.flags.namesVault&&state.quests.names!=='done')doneQuest('names');if(e.flag==='rune'&&state.flags.inscription){state.quests.relic='active';scene.peaceAvailable=true;}dialogue([eventName(e),eventName(e)],[e.text]);save();return;}
    if(e.type==='upgrade')return openPanel('bag');
    if(e.id==='registry'){
      if(scene.enemies.some(e=>e.id==='ruin-guard'&&!e.dead))return toast(['守卫还在，先找出它的破绽。','守衛がまだいる。隙を探そう。']);
      if(state.stage===2){state.flags.registry=true;state.ore++;setStage(3);toast(['找回名册与结晶 · 返回村落','名簿と結晶を取り戻した · 村へ']);}return;
    }
    if(e.id==='rescue'){
      if(!state.flags.caravan)return toast(['先和营地的护卫交谈。','先に野営地の護衛と話そう。']);
      if(scene.enemies.some(e=>e.kind==='bandit'&&!e.dead))return toast(['袭击者仍然挡住了归路。','襲撃者が帰路を塞いでいる。']);
      if(state.stage===4){state.flags.waterPeople=true;setStage(5);toast(['你带回两位搬水的人 · 城门已开放','水を運ぶ二人を救出 · 町への道が開いた']);}return;
    }
    if(e.id==='final-core'){
      const guard=scene.enemies.find(e=>e.id==='final-guard');
      if(guard&&!guard.dead&&!guard.peace){
        if(state.flags.inscription&&state.flags.rune&&state.flags.route==='rescue')dialogue(['碑文之门','碑文の扉'],[['你念出名册上的名字，把剑放在石阶上。守门者的手停在了半空。','名簿の名を読み、剣を石段に置く。門番の手が空中で止まる。']],[choice(['“我们是来带他们回家的。”','「迎えに来たんだ。」'],()=>{guard.peace=true;guard.sprite.setVelocity(0).setTint(0x88bbbd);doneQuest('relic');toast(['守门者让出了通路。','門番が道を譲った。']);})]);
        else toast(['守门者仍在封锁通道。','門番が通路を塞いでいる。']);return;
      }
      if(state.stage===7){
        if(state.flags.route==='rescue'&&!state.flags.survivors)return toast(['先到东侧找到幸存者，不要留下他们。','東の生存者を迎えよう。置いていかないで。']);
        if(state.flags.route==='profit'){state.gold+=160;state.flags.coreTaken=true;}
        setStage(8);toast(['调查完成 · 回到公会','調査完了 · ギルドへ']);
      }
    }
  }
  function travel(area,spawn,heading,body,newAnchor=false){
    setPaused(true);$('#transition small').textContent='THE BOOK OF RETURN';$('#transition h2').textContent=tr(heading||M.names[area]);$('#transition p').textContent=tr(body||['每一条路，都有人走过。','どの道にも、誰かの足跡がある。']);$('#transition').classList.add('show');
    clearTimeout(transitionTimer);transitionTimer=setTimeout(()=>{state.area=area;state.x=spawn[0]*32;state.y=spawn[1]*32;scene.scene.restart({area,x:state.x,y:state.y,newAnchor});setTimeout(()=>{$('#transition').classList.remove('show');setPaused(false);save();},350);},550);
  }
  function die(){
    if(paused||state.hp>0)return;memory.deaths++;memory.trauma=3;remember();localStorage.setItem(STORE,JSON.stringify({...state,deathPending:true}));sound('death');setPaused(true);$('#transition small').textContent=t('你记得的第 '+memory.deaths+' 次终点','覚えている '+memory.deaths+' 回目の終わり');$('#transition h2').textContent=t('呼吸，又一次回来了。','もう一度、息が戻る。');$('#transition p').textContent=t('那些人不记得。那份疼痛却还在。','誰も覚えていない。その痛みだけが残る。');$('#transition').classList.add('show');
    setTimeout(()=>{const a=state.anchor||fresh();state=JSON.parse(JSON.stringify(a));state.anchor=JSON.parse(JSON.stringify(a));state.hp=Math.max(40,state.hp);scene.scene.restart({area:state.area,x:state.x,y:state.y});setTimeout(()=>{$('#transition').classList.remove('show');setPaused(false);toast(['营火还没熄灭。一切都像刚才一样，只有你知道发生过什么。','焚き火はまだ消えない。すべて元のまま。起きたことを知るのは自分だけ。']);save();},500);},2300);
  }
  function ending(){setStage(9);state.flags.finished=true;state.gold+=state.flags.route==='rescue'?60:0;save();showEnding();}
  function showEnding(){openPanel('ending');}
  function closePanel(){if($('#panel').hidden)return;const previous=panelStack.pop();currentPanel=null;if(previous){openPanel(previous);return;}$('#panel').hidden=true;setPaused(false);if(!started)setPaused(true);}
  function openPanel(mode){
    if(!$('#dialog').hidden)return;if(currentPanel&&currentPanel!==mode)panelStack.push(currentPanel);currentPanel=mode;setPaused(true);$('#panel').hidden=false;const content=$('#panel-content');content.replaceChildren();$('#panel h2').textContent=({journal:t('旅途手记','旅の手記'),bag:t('行囊与研习','持ち物と研鑽'),map:t('这一路的地图','旅路の地図'),settings:t('设置','設定'),pause:t('旅途暂歇','旅の休憩'),ending:t('归途之书 · 卷末','帰路の書 · 巻末')})[mode];
    const entry=(title,text,extra='')=>{const d=document.createElement('div');d.className='entry';const h=document.createElement('h3'),p=document.createElement('p'),s=document.createElement('small');h.textContent=tr(title);p.textContent=tr(text);s.textContent=extra;d.append(h,p,s);content.appendChild(d);};
    const button=(label,fn)=>{const b=document.createElement('button');b.textContent=tr(label);b.onclick=fn;return b;};
    if(mode==='journal'){
      entry(B.chapters[state.chapter],B.objectives[state.stage].slice(0,2));B.quests.filter(q=>state.quests[q.id]).forEach(q=>entry(q.name,q.text,(state.quests[q.id]==='done'?t('已完成 · ','完了 · '):t('进行中 · ','進行中 · '))+tr(q.reward)));
      if(memory.deaths){const d=document.createElement('div');d.className='memory';d.textContent=t('只有我记得：','自分だけが覚えている：')+memory.deaths+t(' 次终点。归还的时刻无法选择。','回の終わり。戻る時は選べない。')+(memory.ambush?t(' 东面的斜岩会杀死斥候。','東の傾いた岩で斥候が死ぬ。'):'');content.appendChild(d);}
      state.log.slice(-6).forEach(l=>entry(l.title,l.text));
    }
    if(mode==='bag'){
      entry([`铜币 ${state.gold} · 治疗药 ${state.potions} · 魔石 ${state.ore} · 月叶草 ${state.herbs}`,`銅貨 ${state.gold} · 回復薬 ${state.potions} · 魔石 ${state.ore} · 月葉草 ${state.herbs}`],[`等级 ${state.level} · 经验 ${state.xp} / ${state.level*55} · 剑术伤害 ${15+state.sword}`,`レベル ${state.level} · 経験 ${state.xp} / ${state.level*55} · 剣の威力 ${15+state.sword}`]);
      B.skills.forEach(s=>entry(s.name,s.desc,t('魔力消耗 ','魔力消費 ')+s.mp));
      const b=button(['整备武器 · 35 铜币 / +3 剑伤害','武器整備 · 銅貨35 / 剣威力 +3'],()=>{if(state.gold<35||state.sword>=20)return;state.gold-=35;state.sword+=3;save();openPanel('bag');});b.disabled=state.gold<35||state.sword>=20;content.appendChild(b);
    }
    if(mode==='map'){
      const canvas=document.createElement('canvas');canvas.width=560;canvas.height=400;canvas.className='map-view';scene.drawMap(canvas,true);content.appendChild(canvas);entry(scene.map.name,[t('金色：你所在的位置。青色：通向其他地区的道路。','金色：現在地。青色：他の地域への道。'),t('金色：你所在的位置。青色：通向其他地区的道路。','金色：現在地。青色：他の地域への道。')]);
      Object.entries(M.names).forEach(([id,name])=>{if(state.flags['visited-'+id]||id===state.area)entry(name,[id===state.area?t('现在所在','現在地'):t('已经抵达','訪問済み'),id===state.area?t('现在所在','現在地'):t('已经抵达','訪問済み')]);});
    }
    if(mode==='settings'){
      const row=(label,el)=>{const d=document.createElement('label');d.className='stat-line';d.append(document.createTextNode(label),el);content.appendChild(d);};
      const lang=document.createElement('select');[['zh','中文'],['ja','日本語']].forEach(([v,label])=>{const o=document.createElement('option');o.value=v;o.textContent=label;lang.appendChild(o);});lang.value=settings.lang;lang.onchange=()=>{settings.lang=lang.value;localize();openPanel('settings');};row(t('语言','言語'),lang);
      const volume=document.createElement('input');volume.type='range';volume.min=0;volume.max=1;volume.step=.05;volume.value=settings.volume;volume.oninput=()=>{settings.volume=Number(volume.value);saveSettings();sound('ui');};row(t('音量','音量'),volume);
      [['shake',t('镜头震动','カメラの揺れ')],['effects',t('环境与粒子特效','環境と粒子効果')],['touch',t('触屏操作','タッチ操作')]].forEach(([id,label])=>{const input=document.createElement('input');input.type='checkbox';input.checked=settings[id];input.onchange=()=>{settings[id]=input.checked;saveSettings();$('#touch').hidden=!settings.touch||!started;};row(label,input);});
    }
    if(mode==='pause'){entry([t('旅人 · 赛伊','旅人 · セイ'),t('旅人 · 赛伊','旅人 · セイ')],scene.map.name);const nav=document.createElement('div');nav.className='panel-buttons';[['journal',['旅途手记','旅の手記']],['bag',['行囊','荷物']],['map',['地图','地図']],['settings',['设置','設定']]].forEach(([id,label])=>nav.append(button(label,()=>openPanel(id))));content.append(nav);}
    if(['pause','settings'].includes(mode)){const d=document.createElement('div');d.className='panel-buttons';d.append(button(['返回','戻る'],closePanel));if(started)d.append(button(['保存并返回标题','保存してタイトルへ'],()=>{save();panelStack.length=0;closePanel();started=false;setPaused(true);$('#hud').hidden=true;$('#touch').hidden=true;$('#title').hidden=false;$('#continue').disabled=false;}));content.appendChild(d);}
    if(mode==='ending'){
      const rescue=state.flags.route==='rescue';entry(rescue?['名字被念出的那一天','名前が呼ばれた日']:['足够买一张船票','船の切符を買えるだけの金'],rescue?['公会的纸上，三个名字被重新写下。梅菈替同伴签了字。你没有把失散者变成一句“已完成的委托”。','ギルドの紙に三つの名が書かれた。メラが仲間の署名をした。離散者を「完了した依頼」の一言にしなかった。']:['你交出了发光的魔石。铜币在袋子里很沉，足够继续走下去。水道的门却再也没有打开。诺娅登记了你的报酬，没有划去那些失踪的名字。','光る魔石を渡した。袋の銅貨は重く、旅を続けられる。水路の扉は二度と開かない。ノアは報酬を記録し、行方不明者の名を消さなかった。']);
      entry(['留在旅途里的事','旅に残るもの'],[`${state.flags.scoutSaved?'斥候活着抵达了城门。':state.flags.scoutDead?'斥候没有走出那条石路。':'斥候仍守在营地。'}${state.quests.letter==='done'?'伊恩的信到了家。':'未寄出的信仍在等待。'}${state.quests.names==='done'?'三位失散者的身世被记录下来。':''}${state.quests.relic==='done'?'守门者从未被摧毁。':''} 你独自记得 ${memory.deaths} 次终点。`,`${state.flags.scoutSaved?'斥候は町へ辿り着いた。':state.flags.scoutDead?'斥候は石道から戻らなかった。':'斥候は野営地に残った。'}${state.quests.letter==='done'?'イアンの手紙は家に着いた。':'手紙は待ち続けている。'}${state.quests.names==='done'?'三人の来歴が記録された。':''}${state.quests.relic==='done'?'門番は壊されなかった。':''} 自分だけが ${memory.deaths} 回の終わりを覚えている。`]);
      content.appendChild(button(['继续探索这一卷','この巻の探索を続ける'],closePanel));
    }
    icons();$('#close-panel').focus();
  }
  function saveSettings(){localStorage.setItem(STORE+'-settings',JSON.stringify(settings));}
  function localize(){document.documentElement.lang=settings.lang==='ja'?'ja':'zh-CN';document.querySelectorAll('[data-zh]').forEach(el=>el.textContent=el.dataset[settings.lang]);$('#loading').textContent=t('正在准备旅途…','旅の支度中…');saveSettings();if(started)hud();}
  function makeSkillbar(){const ids=['sword','water','stone','frost','fire','dodge'];const names=[t('剑击','剣撃'),...B.skills.map(s=>tr(s.name)),t('闪避','回避')],hotkeys=['↖','1','2','3','4','Space'],symbols=['sword',...B.skills.map(s=>s.icon),'footprints'];$('#skillbar').replaceChildren();ids.forEach((id,i)=>{const b=document.createElement('button');b.id='skill-'+id;b.className='skill';b.style.setProperty('--color',i>0&&i<5?B.skills[i-1].color:'#e9d49d');b.innerHTML='<kbd>'+hotkeys[i]+'</kbd><i data-lucide="'+symbols[i]+'"></i><span>'+names[i]+'</span><div class="cooldown" hidden></div>';b.onclick=()=>{if(!paused){if(id==='sword')scene.slash();else if(id==='dodge')scene.dodge();else scene.beginCast(id);}};$('#skillbar').appendChild(b);});icons();}
  function start(load){
    if(!scene?.ready)return;state=load?parse(STORE,fresh()):fresh();if(load&&state.deathPending){const a=state.anchor||fresh();state=JSON.parse(JSON.stringify(a));state.anchor=JSON.parse(JSON.stringify(a));state.hp=Math.max(40,state.hp);}if(!load){memory={deaths:0,ambush:false,trauma:0};remember();}
    started=true;$('#title').hidden=true;$('#hud').hidden=false;$('#touch').hidden=!settings.touch;$('.portrait-mini').style.backgroundImage='url("'+window.BookPlayerPortrait+'")';$('.portrait-mini').style.backgroundSize='contain';$('.portrait-mini').style.backgroundRepeat='no-repeat';makeSkillbar();[['water','waterfx2'],['stone','prop6'],['frost','prop8'],['fire','prop11']].forEach(([id,key])=>{const el=$('#skill-'+id),img=document.createElement('img');img.src=scene.textures.get(key).getSourceImage().toDataURL();img.alt='';el.classList.add('has-art');el.append(img);});scene.scene.restart({area:state.area,x:state.x,y:state.y,newAnchor:!state.anchor});setPaused(false);
    if(!load)setTimeout(()=>dialogue(['旅人 · 赛伊','旅人 · セイ'],[['我原以为，找回故乡需要一张地图。后来才明白，还需要有人记住回去的名字。','故郷へ帰るには地図が必要だと思っていた。後に知った。帰る人の名前を覚えている誰かも必要なのだ。'],['村里的井水突然泛起蓝光。送信的人还没有回来。洛琪希正在井边等你。','井戸の水が青く光った。配達人はまだ帰らない。ロキシーが井戸のそばで待っている。']]),450);
  }
  const isInput=()=>['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
  addEventListener('keydown',e=>{if($('#transition').classList.contains('show'))return;if(e.code==='Escape'){if(!$('#dialog').hidden)return closeDialogue();if(!$('#panel').hidden)return closePanel();if(started)return openPanel('pause');}if(isInput())return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(!started||paused)return;if(!keys.has(e.code)){pressed.add(e.code);held.set(e.code,performance.now());}keys.add(e.code);});
  addEventListener('keyup',e=>{keys.delete(e.code);held.delete(e.code);scene?.releaseCast(e.code);});
  addEventListener('blur',()=>{if(started&&!paused)openPanel('pause');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!paused)openPanel('pause');});
  ['KeyJ','KeyH','Digit3','Digit4'].forEach(key=>{const b=document.createElement('button');b.dataset.key=key;$('.touch-actions').append(b);});
  document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);pressed.add(b.dataset.key);virtual.add(b.dataset.key);};b.onpointerup=b.onpointercancel=()=>{keys.delete(b.dataset.key);virtual.delete(b.dataset.key);scene?.releaseCast(b.dataset.key);};});
  const menuButton=$('.hud-actions button:last-child');menuButton.dataset.panel='pause';menuButton.title=t('旅途菜单','旅のメニュー');menuButton.innerHTML='<i data-lucide="menu"></i>';$('#prompt').onclick=()=>interact(scene?.near);
  document.querySelectorAll('.touch-actions button').forEach((b,i)=>{b.dataset.zh=['交互','闪避','水弹','岩炮','剑击','治疗','霜域','火弹'][i];b.dataset.ja=['調べる','回避','水弾','岩砲','剣撃','回復','霜域','火弾'][i];});
  document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>openPanel(b.dataset.panel));document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{settings.lang=b.dataset.lang;localize();});$('#close-panel').onclick=closePanel;$('#new').onclick=()=>{if(parse(STORE,null))dialogue(['新的旅途','新たな旅'],[['这会替换当前旅途与回归记忆。要开始吗？','現在の旅と帰還の記憶を置き換える。始めますか？']],[choice(['开始新的旅途','新たな旅を始める'],()=>start(false)),choice(['返回','戻る'])]);else start(false);};$('#continue').onclick=()=>start(true);$('#title-settings').onclick=()=>openPanel('settings');$('#continue').disabled=!parse(STORE,null);localize();icons();
  const API={get state(){return state;},get settings(){return settings;},get memory(){return memory;},get started(){return started;},get paused(){return paused;},tr,t,keys,pressed,held,virtual,sound,toast,hud,save,anchor,setStage,die,interact,openPanel,remember,register:s=>scene=s};
  window.ReturnBook=API;$('#new').disabled=true;$('#continue').disabled=true;
  class Boot extends Phaser.Scene{
    constructor(){super('boot');}
    preload(){this.load.image('environment','assets/environment.png');this.load.image('groundRaw','assets/terrain.png');this.load.image('playerRaw','assets/traveler.png');this.load.image('npcsRaw','assets/cast.png');this.load.image('civilRaw','assets/civilians.png');this.load.image('castingRaw','assets/traveler-cast-v2.png');this.load.image('waterFxRaw','assets/water-fx-key.png');this.load.image('npcWorldRaw','assets/npc-world-v2.png');this.load.image('wolfRaw','assets/wolf-world-v2.png');}
    create(){
      // Normalize opaque foot bounds instead of centering each generated pose independently.
      const slice=(source,prefix,cols,rows,out=128,chroma=false)=>{const im=this.textures.get(source).getSourceImage(),cw=im.width/cols;
        const rowBounds={prop:[0,.2855,.501,.7424,1],npcw:[0,.26,.505,.722,1],wolf:[0,.28,.5,.72,1],casting:[0,.24,.48,.715,1]};
        for(let n=0;n<cols*rows;n++){const row=Math.floor(n/cols),bounds=rowBounds[prefix]||Array.from({length:rows+1},(_,i)=>i/rows),top=bounds[row]*im.height,ch=(bounds[row+1]-bounds[row])*im.height;const src=document.createElement('canvas');src.width=Math.ceil(cw);src.height=Math.ceil(ch);const cx=src.getContext('2d',{willReadFrequently:true});cx.drawImage(im,(n%cols)*cw,top,cw,ch,0,0,cw,ch);const pix=cx.getImageData(0,0,src.width,src.height),d=pix.data;let x0=src.width,y0=src.height,x1=0,y1=0;
          for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){const i=(y*src.width+x)*4;if(chroma&&d[i]>85&&d[i+2]>80&&Math.min(d[i],d[i+2])-d[i+1]>45)d[i+3]=0;if(d[i+3]>80){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
          cx.putImageData(pix,0,0);const dst=this.textures.createCanvas(prefix+n,out,out),dc=dst.context;dc.imageSmoothingEnabled=false;const width=x1-x0+1,height=y1-y0+1;
          const factor=(out-12)/(prefix==='prop'?Math.max(width,height):im.height/rows*.93);dc.drawImage(src,x0,y0,width,height,Math.round((out-width*factor)/2),Math.round(out-5-height*factor),Math.round(width*factor),Math.round(height*factor));dst.refresh();if(prefix==='npc'&&n<4){window.BookPortraits||=[];window.BookPortraits[n]=src.toDataURL();}if(prefix==='civil'){window.CivilPortraits||=[];window.CivilPortraits[n]=src.toDataURL();}if(prefix==='player'&&n===0)window.BookPlayerPortrait=src.toDataURL();}}
      slice('environment','prop',4,4,256,true);slice('playerRaw','player',4,4,128,true);slice('npcsRaw','npc',4,2,128,true);slice('civilRaw','civil',4,2,128,true);slice('castingRaw','casting',4,4,128,true);slice('npcWorldRaw','npcw',4,4,128,true);slice('wolfRaw','wolf',4,4,128,true);
      for(let row=0;row<4;row++)this.anims.create({key:'npc-idle-'+row,frames:[{key:'npcw'+row*4,duration:950},{key:'npcw'+(row*4+1),duration:750}],repeat:-1});
      const im=this.textures.get('waterFxRaw').getSourceImage();for(let i=0;i<16;i++){const tex=this.textures.createCanvas('waterfx'+i,192,128),c=tex.context;c.imageSmoothingEnabled=false;c.drawImage(im,i%4*im.width/4,Math.floor(i/4)*im.height/4,im.width/4,im.height/4,0,0,192,128);const pixels=c.getImageData(0,0,192,128);for(let n=0;n<pixels.data.length;n+=4){const d=pixels.data;if(d[n]>110&&d[n+2]>100&&Math.min(d[n],d[n+2])-d[n+1]>55)d[n+3]=0;}c.putImageData(pixels,0,0);tex.refresh();}
      ['down','left','right','up'].forEach((dir,row)=>this.anims.create({key:'walk-'+dir,frames:Array.from({length:4},(_,i)=>({key:'player'+(row*4+i)})),frameRate:9,repeat:-1}));$('#loading').hidden=true;$('#new').disabled=false;$('#continue').disabled=!parse(STORE,null);this.scene.start('world',{area:'village',x:768,y:800});
    }
  }
  window.buildWorldScene(API);
  new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#1c352f',pixelArt:true,antialias:false,scale:{mode:Phaser.Scale.RESIZE,width:innerWidth,height:innerHeight},physics:{default:'arcade',arcade:{debug:false}},scene:[Boot,window.BookWorld],render:{roundPixels:true},input:{keyboard:false}});
})();
