/* All terrain, occlusion and foot collisions originate in this scene description. */
window.WorldBook = (() => {
  const TILE=32, W=56,H=40;
  const names={village:['菲托亚 · 风铃村落','フィットア · 風鈴の村'],forest:['月叶森林','月葉の森'],ruins:['旧石门遗迹','古い石門の遺跡'],red:['魔大陆 · 赤岩商路','魔大陸 · 赤岩の商路'],city:['利卡里斯 · 外城街区','リカリス · 外城街'],vault:['无名者的旧水道','名なき者の古い水路']};
  function make(id){
    const tile=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>x<2||y<2||x>=W-2||y>=H-2?5:(id==='red'?4:id==='vault'?5:0)));
    const props=[],events=[],mobs=[],surfaces=[];
    const rect=(x,y,w,h,t)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(tile[j]?.[i]!==undefined)tile[j][i]=t;};
    const path=(x,y,w,h)=>rect(x,y,w,h,id==='vault'?3:1);
    const ribbon=(points,width,kind)=>{
      const samples=[];
      for(let i=0;i<points.length-1;i++)for(let step=0;step<16;step++){
        const t=step/16,a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
        const interp=k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t);
        samples.push({x:interp(0)*TILE,y:interp(1)*TILE,r:width*TILE/2*(1+.12*Math.sin((i+t)*2.1))});
      }
      const last=points.at(-1);samples.push({x:last[0]*TILE,y:last[1]*TILE,r:width*TILE/2});
      surfaces.push({kind,samples});
      for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++)if(samples.some(p=>Math.hypot(p.x-(x+.5)*TILE,p.y-(y+.5)*TILE)<p.r))tile[y][x]=kind;
    };
    const prop=(kind,x,y,scale=1,solid=true)=>props.push({kind,x:x*TILE,y:y*TILE,scale,solid});
    const event=(id,type,x,y,extra={})=>events.push({id,type,x:x*TILE,y:y*TILE,...extra});
    const mob=(kind,x,y,id)=>mobs.push({kind,x:x*TILE,y:y*TILE,id});
    const portal=(to,x,y,spawn,stage=0)=>event('to-'+to,'portal',x,y,{to,spawn,stage});
    let seed=id.split('').reduce((v,c)=>v+c.charCodeAt(0),93);const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    if(id==='village'){
      ribbon([[3,25],[12,25],[21,26],[29,25],[39,24],[52,25]],3.8,1);
      ribbon([[27,7],[28,15],[27,23],[28,29],[31,35]],3,1);
      ribbon([[25,24],[28,25],[32,25]],5,3);
      [[12,20],[19,13],[38,15],[41,30],[13,32]].forEach(([x,y])=>{path(x-3,y-1,6,5);prop('house',x,y,1.05);});
      prop('guild',29,14,1.2);prop('well',31,25,.65);prop('stall',37,26,.7);prop('crates',42,26,.55);
      [[6,10],[8,8],[14,6],[23,7],[35,7],[45,9],[50,12],[5,18],[6,33],[11,37],[20,36],[36,37],[46,34],[51,32]].forEach(([x,y],i)=>prop('tree',x,y,i%3===0?1: .9));
      event('roxy','npc',27,24);event('paul','npc',40,23);event('sylphy','npc',20,25);event('inn','npc',12,22);event('bed','rest',12,24);
      event('village-note','lore',29,17,{text:['村里的告示仍在招募送信的人。最下面一行写着：请记得带回收信人的回答。','村の掲示板は配達人を募っている。最後の一行には「返事を持ち帰ること」。']});
      portal('forest',51,25,[5,25],1);
    }
    if(id==='forest'){
      ribbon([[33,2],[31,9],[34,16],[33.5,25],[36,31],[35,38]],3.4,2);
      ribbon([[3,25],[12,24],[22,26],[29,25],[37,25],[45,23],[50,25]],3.3,1);
      ribbon([[25,32],[26,24],[24,18],[25,12],[27,8]],2.6,1);
      ribbon([[40,26],[41,19],[40,14],[42,8]],2.6,1);
      rect(31,23,6,4,1);prop('bridge',33.5,26,.95,false);
      ribbon([[24,14],[25,12],[27,12]],4,1);prop('fire',25,12,.45,false);prop('crates',28,11,.4);event('courier','npc',24,14);
      prop('arch',42,8,.85);portal('ruins',42,10,[27,34],2);portal('village',4,25,[49,25]);
      event('letter-box','chest',28,14,{reward:'letter'});event('forest-cache','chest',45,31,{reward:'supplies'});
      [[30,18],[37,16],[29,30],[38,32],[13,21]].forEach(([x,y],i)=>{prop('shrub',x,y,.45,false);event('herb'+i,'herb',x,y);});
      [[7,8],[10,10],[15,7],[19,10],[7,17],[14,17],[19,19],[6,31],[11,34],[17,31],[21,36],[29,36],[39,36],[46,35],[50,30],[49,19],[46,14],[49,9],[38,6],[34,7],[19,5]].forEach(([x,y],i)=>{if(tile[y][x]===0)prop(i%4===0?'pine':'tree',x,y,.9);});
      mob('wolf',18,25,'f-w1');mob('wolf',27,28,'f-w2');mob('wisp',38,23,'f-m1');mob('wolf',43,18,'f-w3');mob('wisp',44,31,'f-m2');
    }
    if(id==='ruins'){
      rect(8,5,40,30,3);rect(20,16,16,4,2);path(26,17,4,5);
      for(let x=10;x<48;x+=7){prop('rock',x,7,.8);prop('arch',x,15,.65);}
      for(let y=23;y<34;y+=7){prop('rock',10,y,.7);prop('rock',46,y,.7);}
      prop('crystal',28,10,.8);event('registry','objective',28,13);event('inscription','lore',15,12,{flag:'inscription',text:['碑文：守门者不认佩剑，只认归还。留下名字，放下武器，门为仍活着的人打开。','碑文：門番は剣でなく帰還を知る。名を残し、武器を置け。生きている人のために門は開く。']});
      event('ruin-box','chest',42,29,{reward:'ore'});portal('forest',27,34,[42,12]);mob('guardian',28,25,'ruin-guard');mob('wisp',18,23,'r-m1');mob('wisp',38,25,'r-m2');
    }
    if(id==='red'){
      path(3,23,49,4);path(20,8,4,28);path(40,14,4,15);rect(14,24,13,9,1);
      prop('stall',17,27,.8);prop('fire',22,29,.55,false);prop('crates',25,29,.6);prop('rock',34,22,1);prop('rock',37,16,1.1);prop('crystal',46,12,.65);
      for(let i=0;i<30;i++){const x=4+Math.floor(rand()*47),y=4+Math.floor(rand()*32);if(tile[y][x]===4&&Math.abs(y-25)>3)prop('rock',x,y,.4+rand()*.65);}
      event('caravan','npc',21,28);event('scout','npc',25,25);event('merchant','npc',17,29);event('camp','rest',22,31);
      event('rock-proof','lore',31,21,{flag:'rockProof',text:['石缝里夹着今天才断裂的绳头，支撑木已经被人锯开。岩壁下面还留着搬水人的脚印。这不是旧裂痕。','岩の裂け目に切れたばかりの縄。支えの木は鋸で切られている。下には水運びの足跡。古い亀裂ではない。']});
      event('red-names','lore',20,10,{flag:'namesRed',text:['水桶旁的小石片上刻着：梅菈、阿伦、伊丝。不是墓碑，是有人约好回来。','水桶のそばの小石に、メラ、アレン、イスと刻まれている。墓ではない。帰る約束の印だ。']});
      event('rescue','objective',42,17);event('red-cache','chest',47,30,{reward:'ore'});portal('city',51,25,[5,25],5);mob('wolf',30,27,'d-w1');mob('bandit',40,22,'d-b1');mob('bandit',43,15,'d-b2');mob('wisp',46,30,'d-m1');
    }
    if(id==='city'){
      rect(3,3,50,34,3);path(3,23,50,4);path(26,5,4,30);
      prop('guild',29,19,1.45);[[11,17],[43,16],[13,32],[43,32]].forEach(([x,y])=>prop('house',x,y,1.15));
      prop('stall',17,24,.85);prop('well',37,27,.65);prop('arch',29,6,.75);prop('crates',7,31,.65);
      event('guild','npc',29,22);event('merchant','npc',17,26);event('bed','rest',13,34);portal('red',4,25,[49,25]);portal('vault',29,8,[27,34],7);
      event('scout','npc',22,28,{requires:'scoutSaved'});
      event('city-names','lore',39,26,{flag:'namesCity',text:['旧告示上：寻找阿伦与伊丝，同行者梅菈。认得的人，请到公会留言。没有一个名字被划去。','古い掲示：アレン、イスを捜す。同行者はメラ。情報はギルドへ。どの名前も消されていない。']});
      event('armorer','upgrade',42,25);event('city-box','chest',8,32,{reward:'supplies'});
    }
    if(id==='vault'){
      rect(8,25,40,11,3);rect(23,9,10,20,3);rect(9,5,38,13,3);rect(14,19,6,5,2);rect(35,20,8,4,2);
      for(let y=10;y<35;y+=6){prop('arch',9,y,.7);prop('rock',46,y,.65);}
      prop('crystal',28,8,1.1);prop('fire',12,30,.35,false);event('vault-names','lore',16,10,{flag:'namesVault',text:['墙上三个名字后面多了一句话：不要让别人忘了我们曾在这里活过。','壁の三つの名前の下に「ここで生きていたことを、忘れないで」。']});
      event('rune','lore',40,12,{flag:'rune',text:['刻纹与森林遗迹一模一样。名字、归还、放下武器。你终于读懂了“守门”是什么意思。','森の遺跡と同じ紋様。名前、帰還、武器を置く。「守る」の意味がようやく分かった。']});
      event('final-core','objective',28,11);event('survivor','npc',38,10);portal('city',27,34,[29,10]);mob('guardian',28,18,'final-guard');mob('wisp',19,29,'v-m1');mob('bandit',36,30,'v-b1');mob('wisp',29,24,'v-m2');
    }
    const surfaceAt=(x,y)=>{
      if(id!=='forest'||x<2*TILE||y<2*TILE||x>=(W-2)*TILE||y>=(H-2)*TILE)return tile[Math.floor(y/TILE)]?.[Math.floor(x/TILE)];
      if(x>=31*TILE&&x<37*TILE&&y>=24.1*TILE&&y<25.85*TILE)return 1;
      const water=surfaces.find(s=>s.kind===2);
      return water.samples.some(p=>Math.hypot(p.x-x,p.y-y)<p.r)?2:0;
    };
    return {id,name:names[id],tile,props,events,mobs,surfaces,surfaceAt,width:W*TILE,height:H*TILE,spawn:id==='village'?[24*TILE,25*TILE]:[27*TILE,34*TILE],rand};
  }
  return {make,TILE,W,H,names,propFrames:{tree:0,pine:1,house:2,guild:3,well:4,fence:5,rock:6,crates:7,crystal:8,arch:9,stall:10,fire:11,shrub:12,grass:13,bridge:14,stairs:15}};
})();
