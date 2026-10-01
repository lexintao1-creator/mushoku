window.buildWorldScene = function(A){
  const M=window.WorldBook,B=window.Book,T=32,TAU=Math.PI*2;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const colors={water:0x7deaff,stone:0xe2bd8c,frost:0xc5edff,fire:0xffba76};
  const rgb=n=>'#'+n.toString(16).padStart(6,'0');
  class World extends Phaser.Scene{
    constructor(){super('world');}
    init(data){this.dataIn=data;}
    create(){
      A.register(this);window.bookScene=this;this.map=M.make(this.dataIn.area||'village');this.clock=0;this.ready=true;this.cooldowns={water:0,stone:0,frost:0,fire:0};this.effects=[];this.projectiles=[];this.enemies=[];this.eventSprites=[];this.props=[];this.cast=null;this.face={x:0,y:1};this.aim={x:0,y:1};this.dodgeUntil=0;this.invincible=0;this.slashUntil=0;this.slashCombo=0;this.frame=0;this.ice=[];this.ambushClock=0;this.loot=[];
      this.physics.world.setBounds(0,0,this.map.width,this.map.height);this.walls=this.physics.add.staticGroup();this.nav=this.map.tile.map((row,y)=>row.map((t,x)=>t!==5&&this.map.surfaceAt((x+.5)*T,(y+.5)*T)!==2));
      this.map.events=this.map.events.filter(e=>!e.requires||A.state.flags[e.requires]);
      this.buildGround();this.buildWalls();this.buildProps();this.buildActors();
      this.player=this.physics.add.sprite(this.dataIn.x??A.state.x,this.dataIn.y??A.state.y,'player0').setOrigin(.5,1).setScale(.6);this.player.body.setSize(22,14).setOffset(53,109);this.player.setCollideWorldBounds(true);this.physics.add.collider(this.player,this.walls);
      if(!this.walkable(this.player.x,this.player.y)){this.player.setPosition(...this.map.spawn);}
      this.shadow=this.add.ellipse(this.player.x,this.player.y-2,30,11,0x0a1d20,.32);this.physics.add.collider(this.enemies.map(e=>e.sprite),this.walls);
      this.fxg=this.add.graphics().setDepth(5000);this.markers=this.add.graphics().setDepth(4800);this.waterg=this.add.graphics().setDepth(1);this.castg=this.add.graphics();this.ambient=this.add.graphics().setDepth(4700);this.healthg=this.add.graphics().setDepth(4900);
      this.materialFx=[];this.castSprite=this.add.image(0,0,'waterfx0').setVisible(false);
      const camera=this.cameras.main;camera.setBounds(0,0,this.map.width,this.map.height);camera.setZoom(this.scale.width<850?1:2);camera.centerOn(this.player.x,this.player.y);camera.startFollow(this.player,true,.09,.09);camera.setRoundPixels(true);
      this.onResize=size=>{camera.setSize(size.width,size.height);camera.setZoom(size.width<850?1:2);camera.centerOn(this.player.x,this.player.y);};this.scale.on('resize',this.onResize);
      this.input.on('pointermove',p=>{if(!A.paused){const target=this.cameras.main.getWorldPoint(p.x,p.y),dx=target.x-this.player.x,dy=target.y-(this.player.y-35),n=Math.hypot(dx,dy);if(n>8){this.aim={x:dx/n,y:dy/n};const hand=this.handAnchor(),hx=target.x-hand.x,hy=target.y-hand.y,len=Math.hypot(hx,hy);if(len>8)this.aim={x:hx/len,y:hy/len};}this.lastPointer=this.clock;}});
      this.input.on('pointerdown',p=>{if(!A.started||A.paused)return;if(p.rightButtonDown())this.beginCast(this.selected||'water');else this.slash();});
      this.input.mouse.disableContextMenu();A.state.flags['visited-'+this.map.id]=true;this.refreshEvents();if(this.dataIn.newAnchor)A.anchor();if(!A.started||A.paused)this.physics.pause();
      this.events.once('shutdown',()=>{this.scale.off('resize',this.onResize);});A.hud();
    }
    buildGround(){
      if(this.map.surfaces.length)return this.buildOrganicGround();
      const key='ground-'+this.map.id;if(this.textures.exists(key))this.textures.remove(key);const tex=this.textures.createCanvas(key,this.map.width,this.map.height),c=tex.context;c.imageSmoothingEnabled=false;
      const palettes={0:['#526f43','#597748','#4c6841','#5f7b49'],1:['#b5aa76','#b2a373','#baae7f','#ada172'],2:['#2e6573','#326d7c','#295e70','#377584'],3:['#77867c','#818e83','#718078','#879388'],4:['#a8786b','#b38471','#aa7b6d','#b58a77'],5:[this.map.id==='vault'?'#232d36':'#344d3b']};
      const random=(x,y,n)=>{const z=Math.sin(x*12.9898+y*78.233+n*37.1)*43758.5453;return z-Math.floor(z);};const terrain=this.textures.get('groundRaw').getSourceImage(),tw=terrain.width/4,th=terrain.height/2;
      for(let y=0;y<M.H;y++)for(let x=0;x<M.W;x++){
        const kind=this.map.tile[y][x],p=palettes[kind],sx=x*T,sy=y*T;c.fillStyle=p[0];c.fillRect(sx,sy,T,T);if(kind!==5){let tileIndex=({0:this.map.id==='forest'?4:0,1:1,2:5,3:this.map.id==='vault'?6:this.map.id==='city'?7:2,4:3})[kind];c.globalAlpha=kind===0?.52:kind===3?.7:.6;c.drawImage(terrain,(tileIndex%4)*tw+(x%8)*tw/8,Math.floor(tileIndex/4)*th+(y%8)*th/8,tw/8,th/8,sx,sy,T,T);c.globalAlpha=1;}
        if(kind===0||kind===4){for(let i=0;i<7;i++){c.fillStyle=kind===0?(i%2?'#72905760':'#324b3c50'):(i%2?'#d5aa8750':'#73574940');const dx=Math.floor(random(x,y,i+1)*14)*2,dy=Math.floor(random(x,y,i+10)*14)*2;c.fillRect(sx+dx,sy+dy,2+i%2*2,2);if(kind===0&&i<3)c.fillRect(sx+dx,sy+dy-3,2,3);} }
        if(kind===1){for(let i=0;i<4;i++){c.fillStyle='#746d5835';c.fillRect(sx+Math.floor(random(x,y,i+3)*25),sy+Math.floor(random(x,y,i+6)*25),3,2);}for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]])if(this.map.tile[y+dy]?.[x+dx]===0){c.fillStyle='#788454';c.fillRect(sx+(dx>0?28:0),sy+(dy>0?28:0),dx?4:32,dy?4:32);}}
        if(kind===3&&this.map.id==='ruins'){c.fillStyle='#adba9c20';c.fillRect(sx+4,sy+3,15,2);}
        if(kind===2){c.fillStyle='#8abcd345';c.fillRect(sx+4,sy+12+(x%3)*3,14,2);if(this.map.tile[y]?.[x-1]!==2){c.fillStyle='#234752';c.fillRect(sx,sy,4,32);}if(this.map.tile[y-1]?.[x]!==2){c.fillStyle='#bbe2c26a';c.fillRect(sx,sy,32,3);}}
        if(kind===5&&this.map.id==='vault'){c.fillStyle='#19222d';c.fillRect(sx+3,sy+3,27,27);}
      }
      tex.refresh();this.add.image(0,0,key).setOrigin(0).setDepth(-10);
      // Static light pools and grass patches are independent, not part of the background art.
      this.light=this.add.graphics().setDepth(4600).setBlendMode(Phaser.BlendModes.ADD);this.map.props.filter(p=>['fire','crystal'].includes(p.kind)).forEach(p=>{const col=p.kind==='fire'?0xffaa62:0x5aeeee;for(let r=110;r>0;r-=12)this.light.fillStyle(col,.012).fillEllipse(p.x,p.y-12,r*2,r);});
    }
    buildOrganicGround(){
      const key='ground-'+this.map.id;if(this.textures.exists(key))this.textures.remove(key);
      const tex=this.textures.createCanvas(key,this.map.width,this.map.height),c=tex.context;c.imageSmoothingEnabled=false;
      c.fillStyle=this.map.id==='forest'?'#486a51':'#607956';c.fillRect(0,0,this.map.width,this.map.height);
      const terrain=this.textures.get('groundRaw').getSourceImage(),tw=terrain.width/4,th=terrain.height/2;
      const texture=(index,alpha)=>{c.globalAlpha=alpha;for(let y=0;y<this.map.height;y+=256)for(let x=0;x<this.map.width;x+=256)c.drawImage(terrain,index%4*tw,Math.floor(index/4)*th,tw,th,x,y,256,256);c.globalAlpha=1;};
      texture(this.map.id==='forest'?4:0,.28);
      const paint=(surface,extra,color)=>{c.fillStyle=color;for(const p of surface.samples){c.beginPath();c.arc(p.x,p.y,p.r+extra,0,TAU);c.fill();}};
      for(const s of this.map.surfaces){
        if(s.kind===2){paint(s,10,'#294b49');paint(s,5,'#8caa83');paint(s,0,'#35788a');paint(s,-8,'#306b7d');}
        else{paint(s,5,'#6c7951');paint(s,2,'#9b9d71');paint(s,-2,s.kind===3?'#a3afa0':'#b9b286');}
        c.save();c.beginPath();for(const p of s.samples){c.moveTo(p.x+p.r-3,p.y);c.arc(p.x,p.y,p.r-3,0,TAU);}c.clip();texture(s.kind===2?5:s.kind===3?2:1,s.kind===2?.24:s.kind===3?.2:.28);c.restore();
      }
      if(this.map.id==='forest'){
        c.save();c.beginPath();for(let y=2*T;y<(M.H-2)*T;y+=4)for(let x=27*T;x<40*T;x+=4)if(this.map.surfaceAt(x+2,y+2)===2)c.rect(x,y,4,4);c.clip();c.fillStyle='#35788a';c.fillRect(0,0,this.map.width,this.map.height);texture(5,.24);c.restore();
      }
      for(const p of this.map.props.filter(p=>['house','guild'].includes(p.kind))){c.fillStyle='#9ca176';c.beginPath();c.ellipse(p.x,p.y+30,100,62,0,0,TAU);c.fill();}
      // Sparse authored-scale marks leave the travel corridor visually quiet.
      for(let i=0;i<1600;i++){
        const x=Math.floor(this.map.rand()*this.map.width/2)*2,y=Math.floor(this.map.rand()*this.map.height/2)*2;
        if(this.map.surfaceAt(x,y)===2)continue;
        const road=this.map.surfaces.some(s=>s.kind!==2&&s.samples.some(p=>Math.hypot(x-p.x,y-p.y)<p.r+8));
        c.fillStyle=road?'#817e6128':i%3?'#37553e40':'#99ae7340';c.fillRect(x,y,road?4:2,2);
      }
      for(let y=0;y<M.H;y++)for(let x=0;x<M.W;x++)if(this.map.tile[y][x]===5){c.fillStyle='#344d40';c.fillRect(x*T,y*T,T,T);}
      tex.refresh();this.add.image(0,0,key).setOrigin(0).setDepth(-10);
      this.light=this.add.graphics().setDepth(2);
    }
    wall(x,y,w,h){const r=this.add.rectangle(x,y,w,h,0,0);this.walls.add(r);r.body.setSize(w,h);return r;}
    buildWalls(){
      // Merge blocked tiles into row spans. The same cells feed navigation and minimaps.
      for(let y=0;y<M.H;y++){let start=-1;for(let x=0;x<=M.W;x++){const blocked=x<M.W&&(this.map.tile[y][x]===5||(this.map.id!=='forest'&&this.map.tile[y][x]===2));if(blocked&&start<0)start=x;if(!blocked&&start>=0){const w=this.wall((start+x)*T/2,y*T+T/2,(x-start)*T,T);if(this.map.tile[y][start]===2)w.setData('water',true);start=-1;}}}
      if(this.map.id==='forest')this.buildRiverCollision();
    }
    buildRiverCollision(){
      const step=8;for(let y=2*T;y<(M.H-2)*T;y+=step){let start=-1;
        for(let x=27*T;x<=40*T;x+=step){const water=x<40*T&&this.map.surfaceAt(x+4,y+4)===2&&!this.ice.some(p=>p.until>this.clock&&Math.hypot(p.x-x-4,p.y-y-4)<p.r);
          if(water&&start<0)start=x;if(!water&&start>=0){this.wall((start+x)/2,y+4,x-start,step).setData('water',true);start=-1;}}
      }
    }
    buildProps(){
      const sizes={tree:155,pine:165,house:220,guild:265,well:112,fence:115,rock:112,crates:92,crystal:120,arch:140,stall:160,fire:75,shrub:66,grass:52,bridge:166,stairs:130};
      for(const p of this.map.props){const size=sizes[p.kind]*p.scale,shadow=this.add.ellipse(p.x,p.y-7,size*.62,size*.2,0x102826,.22).setDepth(p.y-1),sprite=this.add.image(p.x,p.y,'prop'+M.propFrames[p.kind]).setOrigin(.5,1).setDisplaySize(size,size).setDepth(p.y);this.props.push({sprite,shadow,p});
        if(p.kind==='bridge'){sprite.setDepth(2);shadow.setDepth(1);}
        if(!p.solid||['bridge','shrub','grass','fire'].includes(p.kind))continue;
        let w=size*.45,h=size*.19,cy=p.y-h/2-6;
        if(['tree','pine'].includes(p.kind)){w=size*.18;h=size*.15;cy=p.y-14;}
        if(['house','guild','stall'].includes(p.kind)){w=size*.72;h=size*.33;cy=p.y-h/2-6;}
        if(p.kind==='arch'){this.wall(p.x-size*.35,p.y-12,22,24);this.wall(p.x+size*.35,p.y-12,22,24);continue;}
        this.wall(p.x,cy,w,h);for(let y=Math.floor((cy-h/2)/T);y<=Math.floor((cy+h/2)/T);y++)for(let x=Math.floor((p.x-w/2)/T);x<=Math.floor((p.x+w/2)/T);x++)if(this.nav[y]?.[x]!==undefined)this.nav[y][x]=false;
      }
    }
    buildActors(){
      const frames={roxy:'npcw0',paul:'npcw4',sylphy:'npcw8',caravan:'npcw12',inn:'civil0',courier:'civil1',scout:'civil2',merchant:'civil3',guild:'civil4',survivor:'civil5'};
      this.map.events.forEach(e=>{if(e.type==='npc'){const s=this.add.sprite(e.x,e.y,frames[e.id]).setOrigin(.5,1).setScale(e.id==='sylphy'?.52:.58).setDepth(e.y);const row=['roxy','paul','sylphy','caravan'].indexOf(e.id);if(row>=0)s.play('npc-idle-'+row);const sh=this.add.ellipse(e.x,e.y-2,26,9,0x0b2020,.3).setDepth(e.y-1);this.eventSprites.push({sprite:s,shadow:sh,event:e});}else if(e.type==='chest'){this.eventSprites.push({sprite:this.add.image(e.x,e.y,'prop7').setDisplaySize(50,50).setOrigin(.5,1).setDepth(e.y),event:e});}});
      this.map.events.filter(e=>e.type==='npc').forEach(e=>{this.wall(e.x,e.y-5,20,12);});
      const stats={wolf:{hp:48,speed:100,damage:14,range:70,frame:4},wisp:{hp:38,speed:60,damage:12,range:210,frame:5},bandit:{hp:70,speed:85,damage:18,range:90,frame:6},guardian:{hp:this.map.id==='vault'?260:155,speed:45,damage:24,range:155,frame:7}};
      this.map.mobs.forEach(m=>{if(A.state.kills.includes(m.id))return;const st=stats[m.kind],sprite=this.physics.add.sprite(m.x,m.y,m.kind==='wolf'?'wolf0':'npc'+st.frame).setOrigin(.5,1).setScale(m.kind==='guardian'?1.15:.6);sprite.body.setSize(m.kind==='guardian'?40:28,18).setOffset(m.kind==='guardian'?44:50,105);const shadow=this.add.ellipse(m.x,m.y-3,m.kind==='guardian'?62:28,12,0x082027,.34);this.enemies.push({...m,...st,maxHp:st.hp,sprite,shadow,phase:'idle',until:0,wet:0,freeze:0,burn:0,burnTick:0,armor:m.kind==='guardian'?2:0,dead:false,peace:false,home:{x:m.x,y:m.y},notice:0,route:[],nextPath:0});});
    }
    refreshEvents(){this.eventSprites.forEach(e=>{if(e.event.type==='chest')e.sprite.setAlpha(A.state.opened.includes(e.event.id)?.4:1);if(e.event.id==='scout')e.sprite.setVisible(!A.state.flags.scoutDead);});}
    walkable(x,y){const gx=Math.floor(x/T),gy=Math.floor(y/T);return (this.map.surfaceAt(x,y)!==2&&this.nav[gy]?.[gx])||this.ice.some(p=>p.until>this.clock&&Math.hypot(p.x-x,p.y-y)<p.r);}
    terrainBlocked(x,y){const type=this.map.tile[Math.floor(y/T)]?.[Math.floor(x/T)];return type===5||type===undefined;}
    pathTo(from,to){
      const sx=Math.floor(from.x/T),sy=Math.floor(from.y/T),tx=Math.floor(to.x/T),ty=Math.floor(to.y/T),queue=[[sx,sy]],visited=new Map([[sy*M.W+sx,null]]);let found;
      for(let i=0;i<queue.length&&i<1800;i++){const [x,y]=queue[i];if(x===tx&&y===ty){found=y*M.W+x;break;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=ny*M.W+nx;if(this.nav[ny]?.[nx]&&!visited.has(k)){visited.set(k,y*M.W+x);queue.push([nx,ny]);}}}
      if(found===undefined)return [];const route=[];for(let k=found;visited.get(k)!==null;k=visited.get(k)){route.unshift({x:(k%M.W+.5)*T,y:(Math.floor(k/M.W)+.5)*T});}return route;
    }
    fx(kind,x,y,color=0xb5edff,amount=1){
      const n=Math.round((kind==='hit'?17:kind==='nova'?48:24)*amount);if(this.effects.length>80)this.effects.splice(0,this.effects.length-65);
      this.effects.push({kind,x,y,color,start:this.clock,duration:kind==='nova'?850:kind==='taboo'?1200:500,particles:Array.from({length:n},(_,i)=>{const a=i/n*TAU+Math.random()*.2;return {a,speed:40+Math.random()*160,size:2+Math.random()*5};})});
    }
    number(x,y,value,color='#fff1d1'){const text=this.add.text(x,y-55,String(value),{fontSize:'17px',fontFamily:'Georgia',color,stroke:'#14212b',strokeThickness:3}).setOrigin(.5).setDepth(5100);this.tweens.add({targets:text,y:y-83,alpha:0,duration:750,onComplete:()=>text.destroy()});}
    slash(){
      if(!A.started||A.paused||this.clock<this.slashUntil||this.clock<this.tabooUntil||this.cast)return;
      this.slashCombo=this.clock-this.lastSlash<800?(this.slashCombo+1)%3:0;this.lastSlash=this.clock;this.slashUntil=this.clock+(this.slashCombo===2?550:310);const a=Math.atan2(this.aim.y,this.aim.x);this.effects.push({kind:'slash',x:this.player.x,y:this.player.y-22,color:this.slashCombo===2?0xf6e7bb:0xd5f1ee,a,start:this.clock,duration:220,particles:[]});A.sound('slash');
      this.enemies.forEach(e=>{if(e.dead||e.peace)return;const dx=e.sprite.x-this.player.x,dy=e.sprite.y-this.player.y;const angle=Math.atan2(dy,dx),delta=Phaser.Math.Angle.Wrap(angle-a);if(Math.hypot(dx,dy)<90&&Math.abs(delta)<1.3){this.damage(e,15+A.state.sword+this.slashCombo*5,'sword',this.aim);if(this.slashCombo===2)e.freeze=this.clock+600;}});
    }
    dodge(){
      if(!A.started||A.paused||this.clock<this.dodgeReady||this.clock<this.tabooUntil)return;if(this.cast)this.cancelCast();this.dodgeReady=this.clock+900;this.dodgeUntil=this.clock+210;this.invincible=this.clock+260;this.dodgeDir=this.move?.length()?{x:this.move.x,y:this.move.y}:this.face;A.sound('dodge');this.fx('dash',this.player.x,this.player.y,0xd4eff3,.5);
    }
    heal(){if(A.state.potions<=0||A.state.hp>=A.state.maxHp)return;A.state.potions--;A.state.hp=Math.min(A.state.maxHp,A.state.hp+48);this.fx('nova',this.player.x,this.player.y-10,0x8ceec2,.6);A.sound('heal');A.toast(['治疗药 · 恢复 48','回復薬 · 48回復']);A.save();}
    beginCast(id,key){
      const skill=B.skills.find(s=>s.id===id);if(!skill||A.paused||!A.started||this.cast||this.clock<this.cooldowns[id]||this.clock<this.slashUntil||this.clock<this.tabooUntil)return;
      if(A.state.stage<skill.unlock)return A.toast(['还未理解这个术式。','まだこの術式を理解していない。']);
      if(A.state.mp<skill.mp)return A.toast(['魔力不足，寻找营火休息。','魔力が足りない。焚き火で休もう。']);
      this.selected=id;this.lastDir=this.castDirection();this.cast={skill,start:this.clock,origin:{x:this.player.x,y:this.player.y},key,released:!key,power:1};A.sound('gather');
    }
    releaseCast(key){if(this.cast?.key===key)this.cast.released=true;}
    cancelCast(){if(!this.cast)return;this.cooldowns[this.cast.skill.id]=this.clock+300;this.cast=null;A.toast(['咏唱中断','詠唱が途切れた']);}
    finishCast(){
      const cast=this.cast;if(!cast)return;const s=cast.skill,power=cast.power;this.cast=null;this.releaseUntil=this.clock+240;this.releaseDir=this.castDirection();A.state.mp-=Math.ceil(s.mp*(power>1.4?1.25:1));this.cooldowns[s.id]=this.clock+s.cd;A.sound(s.id);const hand=this.handAnchor(),x=hand.x,y=hand.y;
      if(s.id==='frost'){
        const cx=this.player.x+this.aim.x*85,cy=this.player.y+this.aim.y*85;this.fx('nova',cx,cy,colors.frost,power);this.enemies.forEach(e=>{if(!e.dead&&!e.peace&&Math.hypot(e.sprite.x-cx,e.sprite.y-cy)<145){const wet=e.wet>this.clock;this.damage(e,Math.round(s.damage*power*(wet?1.8:1)),s.id,this.aim);e.freeze=this.clock+(wet?2600:950);e.wet=0;}});this.ice.push({x:cx,y:cy,r:130,until:this.clock+9000});
        // Replace water bodies intersecting ice with short-lived row segments to preserve collision rules.
        this.rebuildWaterCollision();return;
      }
      const orb=this.add.graphics().setDepth(this.player.y+1),sprite=s.id==='water'?this.add.image(x,y,'waterfx4').setDisplaySize(88,58).setDepth(this.player.y+1):s.id==='stone'?this.add.image(x,y,'prop6').setDisplaySize(38,38).setDepth(this.player.y+1):null;
      this.projectiles.push({x:x+this.aim.x*8,y:y+this.aim.y*8,origin:{x,y},vx:this.aim.x*s.speed,vy:this.aim.y*s.speed,life:1300,skill:s,power,orb,sprite,trail:[],born:this.clock});if(s.id!=='water')this.fx('cast',x,y,colors[s.id],.4);
    }
    castDirection(){return Math.abs(this.aim.x)>Math.abs(this.aim.y)?this.aim.x<0?'left':'right':this.aim.y<0?'up':'down';}
    handAnchor(){const d=this.castDirection(),offset={down:[-15,-35],left:[-31,-39],right:[31,-39],up:[22,-45]}[d];return {x:this.player.x+offset[0],y:this.player.y+offset[1]};}
    waterImpact(x,y){
      const splash=this.add.image(x,y,'waterfx8').setDisplaySize(100,76).setOrigin(.5,.75).setDepth(y+24);
      const puddle=this.add.image(x,y+20,'waterfx12').setDisplaySize(104,55).setDepth(1);
      this.materialFx.push({splash,puddle,x,y,start:this.clock,duration:1100});A.sound('splash');
    }
    stoneImpact(x,y){
      const fragments=Array.from({length:7},(_,i)=>{const a=i*TAU/7;return {sprite:this.add.image(x,y,'prop6').setDisplaySize(10+i%3*3,10+i%3*3).setDepth(y+24),vx:Math.cos(a)*(35+i*9),vy:-80-i*12};});
      const dust=this.add.graphics().setDepth(y+22);this.materialFx.push({kind:'stone',fragments,dust,x,y,start:this.clock,duration:900});A.sound('stone');
    }
    rebuildWaterCollision(){
      // Ice only opens shallow-water grid cells; structural and prop walls never disappear.
      this.walls.getChildren().filter(w=>w.getData('water')).forEach(w=>w.destroy());
      if(this.map.id==='forest'){this.buildRiverCollision();return;}
      if(!this.waterSeparated){this.walls.clear(true,true);this.buildWallsWithoutWater();this.waterSeparated=true;}
      for(let y=0;y<M.H;y++)for(let x=0;x<M.W;x++)if(this.map.tile[y][x]===2&&!this.ice.some(p=>p.until>this.clock&&Math.hypot(p.x-(x+.5)*T,p.y-(y+.5)*T)<p.r))this.wall((x+.5)*T,(y+.5)*T,T,T).setData('water',true);
    }
    buildWallsWithoutWater(){
      for(let y=0;y<M.H;y++)for(let x=0;x<M.W;x++)if(this.map.tile[y][x]===5)this.wall((x+.5)*T,(y+.5)*T,T,T);
      // Reapply prop collision rectangles by iterating the same scene description.
      this.props.forEach(o=>{const p=o.p,size=o.sprite.displayWidth;if(!p.solid||['bridge','shrub','grass','fire'].includes(p.kind))return;let w=size*.45,h=size*.19,cy=p.y-h/2-6;if(['tree','pine'].includes(p.kind)){w=size*.18;h=size*.15;cy=p.y-14;}if(['house','guild','stall'].includes(p.kind)){w=size*.72;h=size*.33;cy=p.y-h/2-6;}if(p.kind==='arch'){this.wall(p.x-size*.35,p.y-12,22,24);this.wall(p.x+size*.35,p.y-12,22,24);}else this.wall(p.x,cy,w,h);});this.map.events.filter(e=>e.type==='npc').forEach(e=>this.wall(e.x,e.y-5,20,12));
    }
    damage(e,value,kind,dir){
      if(e.dead||e.peace)return;if(kind==='stone'){e.armor=Math.max(0,e.armor-1);e.freeze=this.clock+550;e.phase='recover';e.until=this.clock+950;}
      let amount=Math.max(1,Math.round(value*(e.armor? .65:1)));if(kind==='fire'&&e.wet>this.clock){amount=Math.round(amount*.65);e.freeze=this.clock+850;e.wet=0;this.fx('steam',e.sprite.x,e.sprite.y-30,0xd5e9e6);}else if(kind==='fire'){e.burn=this.clock+3500;}
      if(kind==='water')e.wet=this.clock+4500;e.hp-=amount;e.notice=1;e.sprite.setTint(kind==='water'?0xb5ecff:0xffcdb5);e.hitUntil=this.clock+180;this.time.delayedCall(75,()=>{if(e.sprite.active)e.sprite.clearTint();});this.number(e.sprite.x,e.sprite.y,amount,kind==='fire'?'#ffd5a6':'#dcf8ff');if(kind!=='water')this.fx('hit',e.sprite.x,e.sprite.y-25,colors[kind]||0xf0dfb0);A.sound('hit');if(A.settings.shake)this.cameras.main.shake(80,.002);e.sprite.setVelocity(dir.x*150,dir.y*150);e.knockUntil=this.clock+140;
      if(e.hp<=0){e.dead=true;e.sprite.setVelocity(0);A.state.kills.push(e.id);if(kind==='sword')A.state.swordKills++;A.state.xp+=e.kind==='guardian'?65:20;const drop={x:e.sprite.x,y:e.sprite.y,value:e.kind==='guardian'?3:1,sprite:this.add.image(e.sprite.x,e.sprite.y,'prop8').setDisplaySize(22,22).setDepth(e.sprite.y)};this.loot.push(drop);this.tweens.add({targets:[e.sprite,e.shadow],alpha:0,duration:350,onComplete:()=>{e.sprite.destroy();e.shadow.destroy();}});if(A.state.xp>=A.state.level*55){A.state.xp-=A.state.level*55;A.state.level++;A.state.maxHp+=8;A.state.maxMp+=5;A.state.hp=Math.min(A.state.maxHp,A.state.hp+25);A.toast(['成长 · 等级 '+A.state.level,'成長 · レベル '+A.state.level]);}A.save();}
    }
    hurt(amount,angle=0,taboo=false){
      if(!taboo&&this.clock<this.invincible)return;A.state.hp=Math.max(0,A.state.hp-amount);if(this.cast)this.cancelCast();this.invincible=this.clock+850;this.number(this.player.x,this.player.y,amount,'#ffaea8');A.sound('hit');this.fx('hit',this.player.x,this.player.y-20,0xff988c);this.player.setTintFill(0xffd0c8);this.time.delayedCall(110,()=>this.player.active&&this.player.clearTint());if(A.settings.shake)this.cameras.main.shake(150,.005);this.knock={x:Math.cos(angle)*160,y:Math.sin(angle)*160,until:this.clock+120};if(A.state.hp<=0)A.die();
    }
    update(time,delta){
      if(!this.ready||!A.started||A.paused)return;const dt=Math.min(delta,40)/1000;this.clock+=dt*1000;const k=A.keys,p=A.pressed;this.move=new Phaser.Math.Vector2((k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0),(k.has('KeyS')||k.has('ArrowDown')?1:0)-(k.has('KeyW')||k.has('ArrowUp')?1:0)).normalize();
      if(p.has('KeyE'))A.interact(this.near);if(p.has('Space'))this.dodge();if(p.has('KeyH'))this.heal();if(p.has('KeyJ'))this.slash();if(p.has('KeyM'))A.openPanel('map');if(p.has('KeyI'))A.openPanel('bag');if(p.has('Tab'))A.openPanel('journal');
      B.skills.forEach((s,i)=>{const key='Digit'+(i+1);if(p.has(key))this.beginCast(s.id,key);});p.clear();if(A.paused)return;
      if((this.move.length()&&this.clock-this.lastPointer>1500)||this.lastPointer===undefined){if(this.move.length())this.aim={x:this.move.x,y:this.move.y};}
      if(this.clock<this.tabooUntil){this.move.set(0,0);this.player.setVelocity(0);}else if(this.clock<this.dodgeUntil)this.player.setVelocity(this.dodgeDir.x*390,this.dodgeDir.y*390);else if(this.knock&&this.clock<this.knock.until)this.player.setVelocity(this.knock.x,this.knock.y);else this.player.setVelocity(this.move.x*(this.cast?0:155),this.move.y*(this.cast?0:155));
      if(this.cast||this.clock<this.releaseUntil){this.player.anims.stop();const dir=this.cast?this.castDirection():this.releaseDir,row={down:0,left:4,right:8,up:12}[dir],phase=this.cast?(this.clock-this.cast.start<this.cast.skill.cast*.38?0:1):(this.releaseUntil-this.clock>110?2:3);this.player.setTexture('casting'+(row+phase));}
      else if(this.move.length()){this.face={x:this.move.x,y:this.move.y};const dir=Math.abs(this.move.x)>Math.abs(this.move.y)?this.move.x<0?'left':'right':this.move.y<0?'up':'down';this.player.play('walk-'+dir,true);this.lastDir=dir;}else{this.player.anims.stop();this.player.setTexture('player'+({down:0,left:4,right:8,up:12}[this.lastDir||'down']));}
      this.player.setDepth(this.player.y);this.shadow.setPosition(this.player.x,this.player.y-3).setDepth(this.player.y-1);this.player.setAlpha(this.clock<this.invincible?.65+Math.sin(this.clock/55)*.25:1);
      if(this.cast){if(dist(this.cast.origin,this.player)>30)this.cancelCast();else{const elapsed=this.clock-this.cast.start;this.cast.power=1+Math.min(.7,Math.max(0,(elapsed-this.cast.skill.cast)/1100));if(elapsed>=this.cast.skill.cast&&(this.cast.released||elapsed>this.cast.skill.cast+1300||!k.has(this.cast.key)))this.finishCast();}}
      if(this.clock>this.mpTick){A.state.mp=Math.min(A.state.maxMp,A.state.mp+1);this.mpTick=this.clock+950;}if(this.mpTick===undefined)this.mpTick=this.clock+950;
      this.updateEnemies(dt);this.updateShots(dt);this.updateEffects();this.drawCast();this.updateAmbient();
      this.near=this.map.events.filter(e=>dist(this.player,e)<70&&!(e.type==='herb'&&A.state.opened.includes(e.id))&&!(e.id==='scout'&&A.state.flags.scoutDead)).sort((a,b)=>dist(this.player,a)-dist(this.player,b))[0];
      this.loot=this.loot.filter(l=>{if(dist(this.player,l)<40){A.state.ore+=l.value;A.state.gold+=l.value*5;l.sprite.destroy();A.sound('loot');A.save();return false;}l.sprite.y=l.y+Math.sin(this.clock/250)*3;return true;});
      if(this.ice.some(i=>i.until<=this.clock)){this.ice=this.ice.filter(i=>i.until>this.clock);if(this.map.tile[Math.floor(this.player.y/T)]?.[Math.floor(this.player.x/T)]===2){const safe=this.map.events.find(e=>e.type==='portal');this.player.setPosition(safe.x+48,safe.y);A.toast(['冰面融化，你退回了岸边。','氷が溶け、岸へ戻った。']);}this.rebuildWaterCollision();}
      this.updateAmbush(dt);if(++this.frame%5===0)A.hud();if(this.frame%600===0)A.save();
    }
    updateEnemies(dt){
      this.markers.clear();this.healthg.clear();for(const e of this.enemies){if(e.dead)continue;const s=e.sprite,d=dist(s,this.player);s.setDepth(s.y);e.shadow.setPosition(s.x,s.y-2).setDepth(s.y-1);if(e.kind==='wolf'){const angle=e.phase==='windup'||e.phase==='strike'?e.attack.angle:Math.atan2(this.player.y-s.y,this.player.x-s.x),row=Math.abs(Math.cos(angle))>Math.abs(Math.sin(angle))?Math.cos(angle)<0?4:8:Math.sin(angle)<0?12:0,frame=e.phase==='windup'||e.phase==='strike'?3:e.phase==='chase'&&e.freeze<=this.clock?1+Math.floor(this.clock/115)%2:0;s.setTexture('wolf'+(row+frame));}if(e.peace){s.setVelocity(0);continue;}
        if(e.burn>this.clock&&this.clock>e.burnTick){e.burnTick=this.clock+650;this.damage(e,4,'burn',{x:0,y:0});if(e.dead)continue;}
        if(d<380){const width=e.kind==='guardian'?72:38;this.healthg.fillStyle(0x132333,.8).fillRect(s.x-width/2,s.y-s.displayHeight-8,width,4);this.healthg.fillStyle(e.freeze>this.clock?0xbbf3ff:0xe7aaa1,1).fillRect(s.x-width/2,s.y-s.displayHeight-8,width*Math.max(0,e.hp/e.maxHp),4);if(e.wet>this.clock)this.healthg.fillStyle(0x79daff,.9).fillCircle(s.x+20,s.y-28,3);}
        if(e.freeze>this.clock){s.setVelocity(0);s.setTint(0xafe6ff);continue;}if(e.knockUntil>this.clock)continue;s.clearTint();
        if(d>430){e.phase='idle';e.notice=0;s.setVelocity(0);continue;}
        if(e.phase==='idle'||e.phase==='chase'){
          e.phase='chase';if(d<e.range){e.phase='windup';e.until=this.clock+(e.kind==='guardian'?1000:e.kind==='wisp'?850:650);e.attack={x:this.player.x,y:this.player.y,angle:Math.atan2(this.player.y-s.y,this.player.x-s.x)};s.setVelocity(0);}
          else{if(this.clock>e.nextPath){e.route=this.pathTo(s,this.player);e.nextPath=this.clock+750;}while(e.route.length&&dist(s,e.route[0])<15)e.route.shift();const target=e.route[0]||this.player;const a=Math.atan2(target.y-s.y,target.x-s.x);s.setVelocity(Math.cos(a)*e.speed,Math.sin(a)*e.speed);}
        }
        if(e.phase==='windup'){
          s.setVelocity(0);const progress=1-(e.until-this.clock)/(e.kind==='guardian'?1000:e.kind==='wisp'?850:650);this.markers.lineStyle(2,0xffb7a4,.9).fillStyle(0xf67f73,.12+progress*.16);
          if(e.kind==='guardian'){this.markers.fillCircle(s.x,s.y,155);this.markers.strokeCircle(s.x,s.y,155*progress);this.markers.lineStyle(1,0xffccac,.8).strokeCircle(s.x,s.y,155);}
          else if(e.kind==='wisp'){this.markers.strokeCircle(e.attack.x,e.attack.y,25);this.markers.lineBetween(s.x,s.y-25,e.attack.x,e.attack.y);}
          else{const a=e.attack.angle,reach=e.kind==='wolf'?120:100;const points=[{x:s.x,y:s.y},{x:s.x+Math.cos(a-.4)*reach,y:s.y+Math.sin(a-.4)*reach},{x:s.x+Math.cos(a+.4)*reach,y:s.y+Math.sin(a+.4)*reach}];this.markers.fillPoints(points,true);this.markers.strokePoints(points,true);}
          if(this.clock>=e.until){e.phase='strike';e.until=this.clock+(e.kind==='wolf'?230:150);const a=e.attack.angle;if(e.kind==='wisp'){const orb=this.add.graphics().setDepth(4950);this.projectiles.push({x:s.x,y:s.y-25,vx:Math.cos(a)*255,vy:Math.sin(a)*255,life:1700,enemy:true,damage:e.damage,orb,trail:[],skill:{id:'enemy'},power:1});}else if(e.kind==='guardian'){this.fx('nova',s.x,s.y,0xfab5a2,1.1);if(d<155)this.hurt(e.damage,Math.atan2(this.player.y-s.y,this.player.x-s.x));}else{s.setVelocity(Math.cos(a)*320,Math.sin(a)*320);}}
        }
        if(e.phase==='strike'){
          if(['wolf','bandit'].includes(e.kind)&&dist(s,this.player)<42)this.hurt(e.damage,e.attack.angle);
          if(this.clock>=e.until){e.phase='recover';e.until=this.clock+(e.kind==='guardian'?1300:850);s.setVelocity(0);}
        }
        if(e.phase==='recover'){s.setVelocity(0);if(this.clock>=e.until)e.phase='chase';}
      }
    }
    updateShots(dt){
      this.projectiles=this.projectiles.filter(p=>{p.life-=dt*1000;const oldX=p.x,oldY=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.trail.push({x:p.x,y:p.y});if(p.trail.length>12)p.trail.shift();const g=p.orb;g.clear();const col=p.enemy?0xec8a9b:colors[p.skill.id];g.setDepth(p.y+24);
        if(p.sprite){p.sprite.setPosition(p.x,p.y).setDepth(p.y+24);if(p.skill.id==='water')p.sprite.setTexture('waterfx'+(4+Math.floor((this.clock-p.born)/65)%4)).setRotation(Math.atan2(p.vy,p.vx));else p.sprite.setRotation((this.clock-p.born)/120);}
        else{p.trail.forEach((v,i)=>g.fillStyle(col,i/p.trail.length*.55).fillCircle(v.x,v.y,(p.skill.id==='stone'?5:10)*i/p.trail.length));g.fillStyle(col,.28).fillCircle(p.x,p.y,18*p.power);g.fillStyle(col,1);
        if(p.skill.id==='stone'){const a=Math.atan2(p.vy,p.vx);g.fillTriangle(p.x+Math.cos(a)*16,p.y+Math.sin(a)*16,p.x+Math.cos(a+2.3)*10,p.y+Math.sin(a+2.3)*10,p.x+Math.cos(a-2.3)*10,p.y+Math.sin(a-2.3)*10);}else g.fillCircle(p.x,p.y,6*p.power);g.fillStyle(0xffffff,.9).fillCircle(p.x-2,p.y-2,3);}
        // Sweep walls before targets so a fast projectile cannot damage through an obstacle.
        const steps=Math.max(1,Math.ceil(Math.hypot(p.x-oldX,p.y-oldY)/4));let wallHit=false;
        for(let i=1;i<=steps;i++){const x=oldX+(p.x-oldX)*i/steps,y=oldY+(p.y-oldY)*i/steps;if(this.terrainBlocked(x,y)||this.walls.getChildren().some(w=>!w.getData('water')&&w.body&&x>w.body.x&&x<w.body.right&&y+22>w.body.y&&y+22<w.body.bottom)){p.x=x;p.y=y;wallHit=true;break;}}
        if(wallHit){if(p.skill.id==='water')this.waterImpact(p.x,p.y);else if(p.skill.id==='stone')this.stoneImpact(p.x,p.y);else this.fx('hit',p.x,p.y,col,p.power);p.sprite?.destroy();g.destroy();return false;}
        let hit=false;if(p.enemy){if(Math.hypot(p.x-this.player.x,p.y-(this.player.y-22))<23){this.hurt(p.damage,Math.atan2(p.vy,p.vx));hit=true;}}
        else for(const e of this.enemies){if(e.dead||e.peace)continue;if(Math.hypot(p.x-e.sprite.x,p.y-(e.sprite.y-25))<(e.kind==='guardian'?44:24)){this.damage(e,Math.round(p.skill.damage*p.power),p.skill.id,{x:p.vx/Math.hypot(p.vx,p.vy),y:p.vy/Math.hypot(p.vx,p.vy)});hit=true;if(p.skill.id==='fire'){this.fx('nova',p.x,p.y,col,1);this.enemies.filter(other=>other!==e&&!other.dead&&dist(other.sprite,p)<90).forEach(other=>this.damage(other,Math.round(p.skill.damage*.55),'fire',{x:0,y:0}));}break;}}
        if(hit||p.life<0){if(p.sprite){if(hit){if(p.skill.id==='water')this.waterImpact(p.x,p.y);else this.stoneImpact(p.x,p.y);}p.sprite.destroy();}else this.fx('hit',p.x,p.y,col,p.power);g.destroy();return false;}return true;
      });
    }
    updateEffects(){
      this.materialFx=this.materialFx.filter(e=>{const elapsed=this.clock-e.start;if(e.kind==='stone'){if(elapsed>=e.duration){e.fragments.forEach(p=>p.sprite.destroy());e.dust.destroy();return false;}const t=elapsed/1000;e.fragments.forEach(p=>p.sprite.setPosition(e.x+p.vx*t,e.y+p.vy*t+220*t*t).setRotation(t*5).setAlpha(Math.min(1,(900-elapsed)/250)));e.dust.clear().fillStyle(0xc8b69b,(1-t)*.18).fillEllipse(e.x,e.y+20,30+t*100,14+t*35);return true;}if(elapsed>=e.duration){e.splash.destroy();e.puddle.destroy();return false;}e.splash.setVisible(elapsed<320).setTexture('waterfx'+(8+Math.min(3,Math.floor(elapsed/80))));e.puddle.setTexture('waterfx'+(12+Math.min(3,Math.floor(elapsed/275)))).setAlpha(Math.min(1,(1100-elapsed)/400));return true;});
      const g=this.fxg;g.clear();this.effects=this.effects.filter(e=>this.clock-e.start<e.duration);for(const e of this.effects){const p=(this.clock-e.start)/e.duration,fade=1-p;
        if(e.kind==='slash'){g.lineStyle(8,e.color,fade);g.beginPath();g.arc(e.x,e.y,48,e.a-1.4+p*.7,e.a+1.1+p*.7,false);g.strokePath();g.lineStyle(2,0xffffff,fade).beginPath();g.arc(e.x,e.y,59,e.a-1.2+p*.7,e.a+1+p*.7,false);g.strokePath();continue;}
        if(e.kind==='nova'){for(let i=0;i<3;i++){g.lineStyle(2+i,e.color,fade*(1-i*.2));g.strokeEllipse(e.x,e.y,(p*210+i*20),p*130+i*12);}g.fillStyle(e.color,fade*.08).fillEllipse(e.x,e.y,210,140);}
        if(e.color===colors.water){for(let i=0;i<3;i++){g.lineStyle(2-i*.4,0xb0f5ff,fade*.7).strokeEllipse(e.x,e.y+15,(p*80+i*16),(p*36+i*6));}}
        if(e.color===colors.stone){g.lineStyle(2,0x72614f,fade*.8);for(let i=0;i<7;i++){const a=i*TAU/7,r=15+p*25;g.lineBetween(e.x,e.y+12,e.x+Math.cos(a)*r,e.y+12+Math.sin(a)*r*.45);}g.fillStyle(0xbda48b,fade*.2).fillEllipse(e.x,e.y+8,80*p,44*p);}
        if(e.color===colors.fire){g.fillStyle(0xff8052,fade*.25).fillCircle(e.x,e.y,75*p);g.fillStyle(0xffecc1,fade*.5).fillCircle(e.x,e.y,24*fade);for(let i=0;i<9;i++){const a=i*TAU/9,x=e.x+Math.cos(a)*55*p,y=e.y+Math.sin(a)*35*p;g.fillStyle(i%2?0xffd184:0xff9163,fade*.8).fillTriangle(x,y-14*fade,x-8*fade,y+5,x+8*fade,y+5);}}
        if(e.color===colors.frost&&e.kind==='nova'){g.lineStyle(1,0xedffff,fade*.8);for(let i=0;i<6;i++){const a=i*TAU/6;g.lineBetween(e.x,e.y,e.x+Math.cos(a)*100*p,e.y+Math.sin(a)*65*p);const x=e.x+Math.cos(a)*90,y=e.y+Math.sin(a)*55;g.fillStyle(0xc3f2ff,fade*.7).fillTriangle(x,y-35*fade,x-9,y+12,x+9,y+12);}}
        if(e.kind==='taboo'){g.lineStyle(5,e.color,fade).strokeCircle(e.x,e.y-25,25+Math.sin(p*20)*6);}
        for(const part of e.particles){const r=part.speed*p,px=e.x+Math.cos(part.a)*r,py=e.y+Math.sin(part.a)*r*.7-(e.kind==='steam'?p*50:0);g.fillStyle(e.color,fade*.85);if(e.color===colors.frost||e.color===colors.stone){g.fillTriangle(px,py-part.size*2,px-part.size,py+part.size,px+part.size,py+part.size);}else if(e.color===colors.water){g.fillEllipse(px,py,part.size*fade,part.size*fade*2);g.lineStyle(1,e.color,fade*.5).lineBetween(px,py,px-Math.cos(part.a)*7,py-Math.sin(part.a)*5);}else g.fillCircle(px,py,part.size*fade+(e.kind==='steam'?p*8:0));}
      }
      this.ice.forEach(i=>{g.fillStyle(0xa7eaff,.14).fillCircle(i.x,i.y,i.r);g.lineStyle(1,0xddfaff,.4).strokeCircle(i.x,i.y,i.r);});
    }
    drawCast(){const g=this.castg;g.clear();this.castSprite.setVisible(false);if(!this.cast)return;const c=this.cast,elapsed=this.clock-c.start,growth=Math.min(1,elapsed/c.skill.cast),hand=this.handAnchor();
      if(c.skill.id==='water'){this.castSprite.setVisible(true).setTexture('waterfx'+Math.min(3,Math.floor(growth*4))).setDisplaySize(48+growth*22,44+growth*20).setPosition(hand.x,hand.y).setDepth(this.player.y+1);return;}
      g.setDepth(this.player.y+1).lineStyle(2,colors[c.skill.id],.7);for(let i=0;i<6;i++){const a=this.clock/500+i*TAU/6,px=hand.x+Math.cos(a)*14,py=hand.y+Math.sin(a)*10;g.fillStyle(colors[c.skill.id],.8).fillCircle(px,py,2+growth);}}
    updateAmbient(){
      const g=this.ambient,w=this.waterg;g.clear();w.clear();if(A.settings.effects){for(let i=0;i<25;i++){const x=(i*137+this.clock*.01)%this.map.width,y=(i*83+Math.sin(this.clock/1600+i)*18)%this.map.height;g.fillStyle(this.map.id==='red'?0xf8c7a3:0xe9e8a5,.12+Math.sin(this.clock/1000+i)*.08).fillCircle(x,y,1.3);}
      for(let y=2;y<M.H-2;y+=3)for(let x=2;x<M.W-2;x++)if(this.map.surfaceAt(x*T,y*T)===2){const dx=Math.sin(this.clock/1400+y)*5;w.lineStyle(1,0xb8e3e5,.25).lineBetween(x*T+4+dx,y*T+12,x*T+23+dx,y*T+12);}}
      const view=this.cameras.main.worldView;this.props.forEach(o=>{const visible=o.p.x>view.x-280&&o.p.x<view.right+280&&o.p.y>view.y-60&&o.p.y<view.bottom+280;o.sprite.setVisible(visible);o.shadow.setVisible(visible);const behind=['tree','pine','house','guild'].includes(o.p.kind)&&this.player.y<o.p.y&&this.player.y>o.p.y-o.sprite.displayHeight&&Math.abs(this.player.x-o.p.x)<o.sprite.displayWidth*.38;o.sprite.setAlpha(behind?.48:1);});
    }
    updateAmbush(dt){
      if(this.map.id!=='red'||!A.state.flags.caravan||A.state.flags.scoutSaved||A.state.flags.scoutDead)return;
      this.ambushClock+=dt;if(this.ambushClock>45){A.state.flags.scoutDead=true;A.memory.ambush=true;A.remember();this.refreshEvents();this.fx('nova',34*T,24*T,0xe3b39d);A.toast(['东面的石路传来巨响。斥候再也没有回来。','東の石道から轟音。斥候は戻らなかった。']);A.save();}
    }
    drawMap(canvas,full=false){
      const c=canvas.getContext('2d'),sx=canvas.width/M.W,sy=canvas.height/M.H;c.clearRect(0,0,canvas.width,canvas.height);const palette=['#536c49','#b2a274','#367082','#829188','#b78b77','#24352f'];for(let y=0;y<M.H;y++)for(let x=0;x<M.W;x++){c.fillStyle=palette[this.map.tile[y][x]];c.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));}
      this.props.forEach(o=>{if(['tree','pine','house','guild','rock'].includes(o.p.kind)){c.fillStyle=['tree','pine'].includes(o.p.kind)?'#2b4d36':'#60636b';c.fillRect(o.p.x/T*sx-2,o.p.y/T*sy-3,4,4);}});
      this.map.events.forEach(e=>{if(e.type==='portal'){c.fillStyle='#87e2de';c.fillRect(e.x/T*sx-3,e.y/T*sy-3,6,6);if(full){c.font='12px "Microsoft YaHei UI"';c.fillText(A.tr(M.names[e.to]).split('·').pop(),e.x/T*sx-48,e.y/T*sy-8);}}else if(full&&['npc','objective'].includes(e.type)){c.fillStyle=e.type==='npc'?'#f3deac':'#fcba88';c.beginPath();c.arc(e.x/T*sx,e.y/T*sy,3,0,TAU);c.fill();}});
      c.fillStyle='#fff0a3';c.beginPath();c.arc(this.player.x/T*sx,this.player.y/T*sy,full?5:3,0,TAU);c.fill();
    }
  }
  window.BookWorld=World;
};
