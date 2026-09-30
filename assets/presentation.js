/* Time-based, layered spell animation; effects are separate from damage rules. */
window.installSpellPresentation=function(World,api){
 const {state,sfx,saveGame,questToast,tr}=api;
 const tau=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v));
 const baseCreate=World.prototype.create,baseUpdate=World.prototype.update;
 World.prototype.create=function(){
  baseCreate.call(this);this.effects=[];this.spellShots=[];this.damageSequence=0;
  if(!this.textures.exists('spell-light')){
   const tex=this.textures.createCanvas('spell-light',128,128),ctx=tex.context;
   const glow=ctx.createRadialGradient(64,64,0,64,64,64);glow.addColorStop(0,'rgba(255,255,255,.55)');glow.addColorStop(.35,'rgba(255,255,255,.18)');glow.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,128,128);tex.refresh();
  }
 };
 World.prototype.fx=function(kind,x,y,angle=0,color=0xb9f5ff,duration=600){
  if(!state.settings.effects&&kind!=='slash')return;
  if(this.effects.length>45){const old=this.effects.shift();old.g.destroy();old.light.destroy();}
  const g=this.add.graphics().setPosition(x,y).setDepth(2010);
  const light=this.add.image(x,y,'spell-light').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(1890);
  this.effects.push({g,light,kind,x,y,angle,color,duration,age:0});
 };
 function poly(g,points,color,alpha=1){g.fillStyle(color,alpha);g.fillPoints(points.map(([x,y])=>({x,y})),true);}
 World.prototype.animateEffects=function(dt){
  for(let i=this.effects.length-1;i>=0;i--){
   const e=this.effects[i];e.age+=dt;const t=clamp(e.age/e.duration),fade=1-t,g=e.g;g.clear();g.setAlpha(Math.min(1,fade*3));
   e.light.setAlpha(fade*.65).setDisplaySize(100+Math.sin(t*Math.PI)*200,75+Math.sin(t*Math.PI)*140);
   const c=e.color;
   if(e.kind==='charge'){
    const r=16+22*t;g.lineStyle(2,c,.9).strokeEllipse(0,18,r*2,r*.9);
    g.lineStyle(1,0xffffff,.8).strokeEllipse(0,18,r*1.5,r*.65);
    for(let j=0;j<6;j++){const a=j*tau/6+t*2;g.lineStyle(2,c).lineBetween(Math.cos(a)*r,18+Math.sin(a)*r*.45,Math.cos(a)*(r+7),18+Math.sin(a)*(r+7)*.45);}
    for(let j=0;j<8;j++){const a=j*tau/8+t;g.fillStyle(c).fillRect(Math.cos(a)*(40-35*t),Math.sin(a)*(32-28*t)-10,3,3);}
   }else if(e.kind==='slash'){
    g.setRotation(e.angle);const angle=-1.2+t*2.6;
    g.lineStyle(14*(1-t)+2,0xe3b772,.25).beginPath().arc(0,0,65,angle-.9,angle+.25).strokePath();
    g.lineStyle(7*(1-t)+1,c,.95).beginPath().arc(0,0,64,angle-.8,angle+.16).strokePath();
    g.lineStyle(2,0xffffff,1).beginPath().arc(0,0,68,angle-.65,angle+.16).strokePath();
    for(let j=0;j<5;j++){const a=angle-j*.13;g.lineStyle(2,c,fade).lineBetween(Math.cos(a)*72,Math.sin(a)*72,Math.cos(a)*(92+j*3),Math.sin(a)*(92+j*3));}
   }else if(e.kind==='nova'){
    const r=35+145*(1-Math.pow(1-t,3));g.lineStyle(5*(1-t),c,.85).strokeEllipse(0,0,r*2,r*1.12);
    g.lineStyle(2,0xffffff,.7).strokeEllipse(0,0,r*1.85,r);
    for(let j=0;j<14;j++){
     const a=j*tau/14,rr=35+j%3*29,xx=Math.cos(a)*rr,yy=Math.sin(a)*rr*.68,h=(34+j%4*12)*Math.sin(Math.min(1,t*2)*Math.PI/2);
     poly(g,[[xx-10,yy],[xx-5,yy-h*.65],[xx+2,yy-h],[xx+12,yy-h*.28],[xx+9,yy+4]],j%2?0x86cce2:0xc6f9ff,fade);
     poly(g,[[xx+2,yy-h],[xx+3,yy],[xx+9,yy+4],[xx+12,yy-h*.28]],0x3b7eae,fade*.8);
     g.lineStyle(2,0xffffff,fade).lineBetween(xx+2,yy-h,xx-5,yy-h*.65);
    }
    for(let j=0;j<20;j++){const a=j*2.4,rr=30+t*160;g.fillStyle(c,fade).fillRect(Math.cos(a)*rr,Math.sin(a)*rr*.65-t*35,2+j%3,2+j%3);}
   }else if(e.kind==='stone'){
    const rise=Math.sin(Math.min(1,t*3)*Math.PI/2),r=35+100*t;
    g.lineStyle(3,c,fade).strokeEllipse(0,8,r*2,r*.9);
    for(let j=0;j<7;j++){const a=j*tau/7,xx=Math.cos(a)*55,yy=Math.sin(a)*30,h=(50+j%3*18)*rise;
     poly(g,[[xx-15,yy],[xx-12,yy-h*.55],[xx+1,yy-h],[xx+18,yy-h*.4],[xx+12,yy+8]],0xb89769,fade);
     poly(g,[[xx+1,yy-h],[xx+3,yy],[xx+12,yy+8],[xx+18,yy-h*.4]],0x66514e,fade);
     g.lineStyle(2,0xf0d7a7,fade).lineBetween(xx-12,yy-h*.55,xx+1,yy-h);
    }
    for(let j=0;j<17;j++){const a=j*2.3,rr=30+t*115;g.fillStyle(j%2?0xe6d0a0:0x7f7165,fade).fillRect(Math.cos(a)*rr,Math.sin(a)*rr*.55-t*(1-t)*140,4+j%5,3+j%4);}
   }else{
    const radius=12+Math.pow(t,.45)*70;
    g.lineStyle(4*fade,c,.7).strokeEllipse(0,0,radius*2,radius*1.1);
    for(let j=0;j<12;j++){
     const a=j*tau/12+e.angle,len=(24+j%4*10)*fade;
     g.lineStyle(j%3===0?4:2,j%2?c:0xffffff,fade).lineBetween(Math.cos(a)*radius*.35,Math.sin(a)*radius*.35,Math.cos(a)*(radius*.35+len),Math.sin(a)*(radius*.35+len));
    }
    if(t<.35){const points=[];for(let j=0;j<16;j++){const a=j*tau/16,r=j%2?9:32*(1-t);points.push([Math.cos(a)*r,Math.sin(a)*r]);}poly(g,points,0xf4ffff,1-t*2);}
    for(let j=0;j<12;j++){const a=j*2.4,rr=t*110;g.fillStyle(c,fade).fillRect(Math.cos(a)*rr,Math.sin(a)*rr*.65-15*Math.sin(t*Math.PI),3,5);}
   }
   if(t>=1){g.destroy();e.light.destroy();this.effects.splice(i,1);}
  }
 };
 World.prototype.update=function(time,delta){
  baseUpdate.call(this,time,delta);
  if(!api.getStarted()||state.paused||state.dialogOpen||!this.effects)return;
  const dt=Math.min(delta,50);this.animateEffects(dt);
  for(let i=this.spellShots.length-1;i>=0;i--){
   const s=this.spellShots[i],step=dt*s.speed/1000;s.x+=s.dx*step;s.y+=s.dy*step;s.distance+=step;s.trail.unshift({x:s.x,y:s.y});if(s.trail.length>10)s.trail.pop();
   const g=s.g;g.clear();
   for(let j=s.trail.length-1;j>0;j--){g.lineStyle((10-j)*1.5,s.color,(1-j/10)*.65).lineBetween(s.trail[j].x,s.trail[j].y,s.trail[j-1].x,s.trail[j-1].y);}
   const px=-s.dy,py=s.dx;
   const point=(along,side)=>[s.x+s.dx*along+px*side,s.y+s.dy*along+py*side];
   if(s.earth){poly(g,[point(26,0),point(8,11),point(-18,7),point(-25,-3),point(1,-12)],0x9f8263);poly(g,[point(26,0),point(1,-12),point(-18,-2)],0xf0d7a1);}
   else{poly(g,[point(34,0),point(5,9),point(-34,5),point(-58,0),point(-34,-6),point(7,-10)],s.color,.9);poly(g,[point(34,0),point(-24,3),point(-37,0),point(0,-4)],0xf7ffff);}
   s.light.setPosition(s.x,s.y).setDisplaySize(95,65);
   let hit=null;this.enemies?.getChildren().some(e=>{if(!e.getData('dead')&&Math.hypot(s.x-e.x,s.y-(e.y-22))<(e.getData('boss')?48:30)){hit=e;return true;}return false;});
   if(hit||s.distance>620||!this.walkable(s.x,s.y+16)){
    this.fx(s.earth?'stone':'impact',s.x,s.y,s.angle,s.color,s.earth?420:370);
    if(hit){this.hitEnemy(hit,s.earth?4:3);if(!s.earth)hit.setData('wetUntil',this.time.now+5000);}
    g.destroy();s.light.destroy();this.spellShots.splice(i,1);
   }
  }
 };
 World.prototype.castMagic=function(){
  if(state.aptitude==='sword'){if(this.ready('castMagic',900)){this.dodge();this.melee();}return;}
  const cost=8;if(state.mp<cost||!this.ready('castMagic',700))return;
  state.mp-=cost;
  const origin={x:this.player.x,y:this.player.y},damageSequence=this.damageSequence;
  const [dx,dy]=this.direction(),earth=state.aptitude==='earth',color=earth?0xeac184:state.aptitude==='sword'?0xffe6a3:0x6ddaff;
  this.fx('charge',this.player.x,this.player.y-18,0,color,240);sfx('cast',earth?260:730);
  this.time.delayedCall(300,()=>{
   if(this.damageSequence!==damageSequence||Math.hypot(this.player.x-origin.x,this.player.y-origin.y)>36){questToast(state.lang==='ja'?'詠唱が途切れた':'咏唱中断');return;}
   state.magicCasts++;
   if(state.quests.roxy==='active'&&state.magicCasts>=3){state.quests.roxy='done';questToast(tr('roxyQuest'));saveGame();}
   const x=this.player.x+dx*25,y=this.player.y-19+dy*25;
   const g=this.add.graphics().setDepth(2000),light=this.add.image(x,y,'spell-light').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(1890);
   this.spellShots.push({x,y,dx,dy,angle:Math.atan2(dy,dx),earth,color,g,light,speed:earth?560:740,distance:0,trail:[]});
   if(state.settings.shake)this.cameras.main.shake(65,.0013);
  });
 };
 World.prototype.melee=function(){
  if(!this.ready('melee',350))return;
  const [dx,dy]=this.direction(),angle=Math.atan2(dy,dx);this.combo=this.time.now-(this.lastSwing||0)<800?(this.combo+1)%3:0;this.lastSwing=this.time.now;
  this.fx('slash',this.player.x,this.player.y-20,angle,this.combo===2?0xffffff:0xffe6b6,230);
  this.time.delayedCall(70,()=>{
   const x=this.player.x+dx*42,y=this.player.y+dy*42;
   this.enemies?.getChildren().forEach(e=>{if(!e.getData('dead')&&Math.hypot(e.x-x,e.y-y)<78){this.fx('impact',e.x,e.y-23,angle,0xffe2ab,280);this.hitEnemy(e,(this.combo===2?5:2)+(state.nature==='bold'?1:0));}});
  });
  if(this.area==='village'&&Math.hypot(this.player.x-1410,this.player.y-440)<130&&state.quests.training==='active'){
   state.progress.training++;if(state.progress.training>=6){state.quests.training='done';state.inventory.gold+=12;questToast(state.lang==='ja'?'基礎訓練完了 · 報酬 12':'基础训练完成 · 报酬 12');saveGame();}
  }sfx('swing');
 };
 World.prototype.nova=function(){
  if(state.mp<24||!this.ready('nova',6500))return;state.mp-=24;
  const x=this.player.x,y=this.player.y;this.fx('charge',x,y-15,0,0xc4f3ff,300);
  this.time.delayedCall(220,()=>{
   this.fx('nova',x,y,0,0xb5f3ff,1050);sfx('cast',980);
   this.enemies?.getChildren().forEach(e=>{if(!e.getData('dead')&&Math.hypot(e.x-x,e.y-y)<170){const wet=e.getData('wetUntil')>this.time.now;this.hitEnemy(e,wet?7:3);e.setData('stun',this.time.now+(wet?2200:650));e.setVelocity(0);if(wet)this.fx('impact',e.x,e.y-20,0,0xffffff,500);}});
   if(state.settings.shake)this.cameras.main.shake(160,.003);
  });
 };
 World.prototype.stoneRain=function(){
  if(state.mp<18||!this.ready('stoneRain',3600))return;state.mp-=18;
  const [dx,dy]=this.direction(),x=this.player.x+dx*150,y=this.player.y+dy*150;
  if(!this.walkable(x,y)){state.mp+=18;this.cd.stoneRain=0;return;}
  this.fx('charge',x,y,0,0xe6ca99,450);
  this.time.delayedCall(390,()=>{this.fx('stone',x,y,0,0xe6ca99,850);this.enemies?.getChildren().forEach(e=>{if(!e.getData('dead')&&Math.hypot(e.x-x,e.y-y)<110){this.hitEnemy(e,6);e.setData('stun',this.time.now+700);}});sfx('hit');if(state.settings.shake)this.cameras.main.shake(150,.004);});
 };
};
