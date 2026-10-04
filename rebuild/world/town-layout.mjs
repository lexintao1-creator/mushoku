// Measured ASSET-SPEC-02 components with the same 2px margin as the existing loader.
const componentBounds = [
  [16,25,317,333],[340,53,627,336],[655,13,973,347],[988,94,1236,345],
  [20,372,315,646],[367,415,612,643],[637,458,960,651],[991,443,1226,635],
  [28,657,303,887],[360,729,620,884],[709,691,908,876],[991,708,1213,884],
  [20,923,351,1216],[409,919,606,1222],[700,968,884,1209],[965,914,1228,1225]
];

const frames = componentBounds.map(([x0,y0,x1,y1], i) => ({
  i, sourceRect:[x0-2,y0-2,x1-x0+4,y1-y0+4],
  origin:[.5,(y1-y0+2)/(y1-y0+4)]
}));

// Verified alpha>=100 bounds supplied for the actual 1536x1024 sheet; never split at 512px.
const buildingBounds = [[50,47,517,482],[576,58,1029,483],[1071,37,1502,484],
  [41,586,528,966],[560,552,1101,960],[1152,495,1485,979]];
const doorwayAxes = [223,778,1282,286,832,1307];
export const townFrames = buildingBounds.map(([x0,y0,x1,y1],i) => ({
  i,asset:'town',sourceRect:[x0-3,y0-3,x1-x0+6,y1-y0+6],
  origin:[(doorwayAxes[i]-x0+3)/(x1-x0+6),(y1-y0+3)/(y1-y0+6)],
  root:[doorwayAxes[i]-x0+3,y1-y0+3]
}));

const props = [];
const colliders = [];
const doors = [];
function place(id,i,x,y,w,rx=0,ry=0,extra={}) {
  const asset=extra.asset||'kit',frame = asset==='town'?townFrames[i]:frames[i];
  const h = w*frame.sourceRect[3]/frame.sourceRect[2];
  const p = {id,asset,i,x,y,w,h,rx,ry,sourceRect:frame.sourceRect,origin:frame.origin,...extra};
  props.push(p);
  return p;
}
function box(id,x,y,width,height) {
  const b = {id,kind:'wall',shape:'aabb',x,y,width,height};
  colliders.push(b);
  return b;
}
function house(id,i,x,y,w,use,face) {
  const p = place(id,i,x,y,w,w*.34,14,{asset:'town',interact:use,district:use==='lodging'?'residential':'shopfront',face});
  p.placement={anchor:'door-foot',targetDoorHeight:[56,72],actorBodyHeight:48,level:0,
    replacement:'measure-new-frame-door-axis-and-alpha-bounds; do-not-reuse-legacy-origin'};
  p.blockedBody = box(id+':body',x-w*.34,y-30,w*.68,30);
  p.collisionIds = [id+':body'];
  p.doorId = id+':door';
  doors.push({id:p.doorId,propId:id,x,y:y+18,normal:[0,1],width:48,
    access:{x:x-32,y:y+8,width:64,height:76},
    trigger:{x:x-24,y:y+10,width:48,height:28},interact:use,interior:null,
    visualClearance:{height:[178/933,180/945,205/977,182/909][i]*w,
      status:'village-buildings-10-door-image-estimate-needs-character-overlay'}});
}

house('west-inn',0,510,475,300,'lodging',{tint:0xe7ded1,blend:.03});
house('north-apothecary',1,920,420,300,'apothecary',{tint:0xc1cfd0,blend:.02});
house('north-workshop',3,1250,510,290,'workshop',{tint:0xe2d4c7,blend:.02});
house('west-residence',2,540,920,280,'residence',{tint:0xd4cddc,blend:.04});
house('east-residence',0,1060,885,300,'residence',{tint:0xe7ded1,blend:.03});

function canopy(id,x,y,w,interact) {
  const p = place(id,12,x,y,w,0,0,{interact,district:'market',occlusion:{split:.52,alpha:.35}});
  // This measured candidate contains goods and a counter: the back counter is solid.
  p.collisionIds = [id+':counter',id+':left-post',id+':right-post'];
  box(id+':counter',x-w*.29,y-42,w*.58,22);
  box(id+':left-post',x-w*.43-5,y-17,10,17);
  box(id+':right-post',x+w*.42-5,y-17,10,17);
  p.access = {x:x-w*.27,y:y+12,width:w*.54,height:50};
}
canopy('market-west',665,595,142,'market');
canopy('market-east',990,590,136,'market');
canopy('freight-desk',1365,865,122,'freight');

const well = place('public-well',3,820,510,88,31,13,{interact:'well',district:'market'});
well.collisionIds = ['public-well:body'];
box('public-well:body',789,484,62,26);
place('market-sign',13,905,765,30,3,3,{interact:'notice',district:'market'});
box('market-sign:body',902,756,6,9);

const gate = place('south-gate',4,800,1005,148,0,0,{interact:'arrival',district:'gate'});
gate.collisionIds = ['south-gate:left','south-gate:right'];
box('south-gate:left',800-gate.w*.47,977,gate.w*.24,28);
box('south-gate:right',800+gate.w*.23,977,gate.w*.24,28);
gate.access = {x:772,y:978,width:56,height:68};

// Cargo is grouped at unloading fronts, rather than scattered over the travel corridor.
for (const [id,x,y,w] of [
  ['east-cargo-a',1460,895,52],['east-cargo-b',1490,950,45],
  ['east-cargo-c',1420,975,48],['west-storeroom',375,960,49],
  ['workshop-crates',1355,525,42],['market-crates',1095,435,39]
]) {
  const p = place(id,5,x,y,w,w*.32,8,{district:'service'});
  p.collisionIds = [id+':body'];
  box(id+':body',x-w*.32,y-16,w*.64,16);
}
for (const [id,x,y,w] of [
  ['well-barrel-west',759,531,25],['well-barrel-east',878,525,25],
  ['freight-barrel',1465,988,27],['residence-water',1175,881,26]
]) {
  const p = place(id,14,x,y,w,w*.3,5);
  p.collisionIds = [id+':body'];
  box(id+':body',x-w*.3,y-10,w*.6,10);
}
for (const [id,x,y,w] of [
  ['water-jars',890,535,28],['potter-display',1320,563,27],['yard-jars',435,1005,27]
]) {
  const p = place(id,10,x,y,w,w*.28,5);
  p.collisionIds = [id+':body'];
  box(id+':body',x-w*.28,y-10,w*.56,10);
}
// The new facades already include steps; do not draw kit slabs over their entrances.
for (const [id,i,x,y,w] of [
  ['residential-shade-tree',2,375,865,105],['shore-tree',2,310,440,112],
  ['north-edge-tree',2,1175,235,125],['east-edge-tree',2,1490,420,128],
  ['south-edge-tree',2,1320,1040,108],['shore-rock-north',6,315,300,104],
  ['shore-rock-south',6,310,900,113],['north-ridge-rock',1,710,225,100],
  ['east-ridge-rock',6,1510,745,91],['shore-reeds',8,294,545,53],
  ['lower-shore-reeds',8,301,795,48],['court-shrub',7,405,1005,58],
  ['shore-tree-upper',2,346,359,128],['shore-shrub',7,333,486,68],
  ['court-tree-west',2,365,785,128],['court-tree-lower',2,348,945,116],
  ['court-shrub-inner',7,403,924,58],['court-tree-inner',2,930,810,134],
  ['court-grass-inner',8,914,864,54],['north-tree-inner',2,1080,305,125],
  ['north-tree-middle',2,1140,276,113],['north-shrub',7,1070,354,62],
  ['east-tree-upper',2,1442,340,136],['east-tree-lower',2,1493,535,120],
  ['east-shrub',7,1450,487,64],['court-grass-west',8,383,834,58]
]) {
  const p=place(id,i,x,y,w,0,0,{district:'natural-edge'});
  const radius=(i===2||i===15)?9:w*.18;
  const c={id:id+':foot',kind:'wall',shape:'circle',x,y:y-5,radius};
  colliders.push(c);p.collisionIds=[c.id];
}

// This is a shallow crossing, not a bridge/height system. Individual kit stones stay ground props.
for (const [i,x,y,w] of [[0,167,642,65],[1,223,655,62],[2,278,646,64]])
  place('crossing-stone-'+i,9,x,y,w,0,0,{layer:'ground',district:'water-edge'});

const routes = [
  {id:'cross-street',points:[[150,650],[295,650],[425,675],[610,705],[800,710],[1035,680],[1210,650],[1340,620],[1450,650]],width:88,material:'worn-earth'},
  {id:'entry-brick-verge',points:[[800,1040],[800,945],[850,865],[830,780],[800,710]],width:90,material:'road-verge'},
  {id:'market-brick-verge',points:[[610,705],[800,710],[1035,680],[1210,650]],width:82,material:'road-verge'},
  {id:'arrival-street',points:[[800,1040],[800,945],[850,865],[830,780],[800,710]],width:76,material:'packed-stone'},
  {id:'market-brick-spine',points:[[610,705],[800,710],[1035,680],[1210,650]],width:68,material:'packed-stone'},
  {id:'court-loop-west',points:[[425,675],[440,770],[460,850],[605,870],[725,835],[830,780]],width:76,material:'worn-earth'},
  {id:'court-loop-east',points:[[1035,680],[1130,745],[1220,820],[1235,925],[1370,925]],width:80,material:'worn-earth'},
  {id:'market-loop',points:[[610,705],[570,650],[555,560],[620,525],[720,515],[730,452],[815,452],[895,470],[1070,480],[1150,575],[1035,680]],width:66,material:'worn-earth'},
  {id:'well-access',points:[[820,532],[840,580],[830,640],[800,710]],width:64,material:'door-stone'},
  {id:'inn-door',points:[[510,499],[515,535],[555,560]],width:66,material:'door-stone'},
  {id:'apothecary-door',points:[[920,444],[918,465],[895,470]],width:66,material:'door-stone'},
  {id:'workshop-door',points:[[1250,534],[1225,570],[1150,575]],width:68,material:'door-stone'},
  {id:'west-residence-door',points:[[540,944],[610,972],[650,1032],[710,1040],[800,1040]],width:64,material:'door-stone'},
  {id:'east-residence-door',points:[[1060,909],[1150,936],[1235,925]],width:64,material:'door-stone'},
  {id:'freight-access',points:[[1370,925],[1365,889]],width:62,material:'worn-earth'},
  {id:'training-access',points:[[1340,620],[1400,690],[1395,755]],width:84,material:'worn-earth'}
];

const water = {
  id:'west-channel',points:[[125,130],[233,155],[260,340],[242,490],[266,610],
    [258,765],[239,925],[275,1080],[157,1080],[145,915],[171,745],[154,580],[162,385],[139,245]],
  material:'shallow-water',level:0,flow:[0,1],depth:0.35,
  crossing:{id:'stone-ford',x:100,y:610,width:210,height:80,level:0},
  rendererStatus:'base-material-visible; flow-and-bank-receiver-adaptation-pending'
};

// Match play.makeTerrain's midpoint quadratic boundary before rasterizing water occupancy.
function curvedBoundary(points) {
  const out=[];
  for(let i=0;i<points.length;i++) {
    const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];
    for(let n=0;n<24;n++) {
      const t=n/24,u=1-t;
      out.push([u*u*(a[0]+b[0])/2+2*u*t*b[0]+t*t*(b[0]+c[0])/2,
        u*u*(a[1]+b[1])/2+2*u*t*b[1]+t*t*(b[1]+c[1])/2]);
    }
  }
  return out;
}
function inside(x,y,points) {
  let hit=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
water.boundary=curvedBoundary(water.points);
for(let x=120;x<280;x+=8) {
  let start=null;
  for(let y=120;y<=1088;y+=8) {
    const crossing=y>=water.crossing.y&&y<water.crossing.y+water.crossing.height;
    const solid=y<1088&&!crossing&&inside(x+4,y+4,water.boundary);
    if(solid&&start===null)start=y;
    if(!solid&&start!==null) {
      box(`water:${x}:${start}`,x,start,8,y-start).surface='water';
      start=null;
    }
  }
}

const plazas = [
  {id:'shore-bank',points:[[115,155],[280,175],[301,390],[288,600],[315,790],[284,1045],
    [130,1060],[110,865],[128,630],[115,390]],material:'bank-gravel',textureAlpha:.12},
  {id:'upper-shore-grass',points:[[270,255],[348,238],[400,320],[382,460],[345,550],[277,533],[270,421]],material:'edge-grass',textureAlpha:0,role:'vegetation-patch'},
  {id:'shore-root-moss',points:[[285,382],[323,364],[367,421],[348,493],[297,481]],material:'shade-moss',textureAlpha:0,role:'vegetation-patch'},
  {id:'north-garden-edge',points:[[375,250],[602,253],[712,310],[671,380],[487,407],[382,359]],material:'dry-grass',role:'vegetation-patch'},
  {id:'north-tree-bed',points:[[1020,260],[1140,230],[1255,275],[1255,370],[1120,438],[1030,380]],material:'edge-grass',role:'vegetation-patch'},
  {id:'east-tree-bed',points:[[1400,251],[1538,268],[1552,425],[1523,581],[1450,577],[1390,464]],material:'edge-grass',textureAlpha:0,role:'vegetation-patch'},
  {id:'east-root-moss',points:[[1444,417],[1522,411],[1526,537],[1480,568],[1427,499]],material:'shade-moss',textureAlpha:0,role:'vegetation-patch'},
  {id:'court-west-grass',points:[[284,735],[359,708],[409,759],[414,840],[395,961],[329,987],[271,900]],material:'edge-grass',textureAlpha:0,role:'vegetation-patch'},
  {id:'court-tree-moss',points:[[322,782],[372,765],[411,842],[381,909],[328,892]],material:'shade-moss',textureAlpha:0,role:'vegetation-patch'},
  {id:'inner-court-green',points:[[891,745],[1030,745],[1085,790],[1115,862],[1028,915],[925,900],[893,826]],material:'edge-grass',role:'vegetation-patch'},
  {id:'lower-yard-grass',points:[[1218,988],[1328,978],[1428,1010],[1420,1048],[1282,1058],[1208,1038]],material:'dry-grass',textureAlpha:0,role:'vegetation-patch'},
  {id:'market-garden-grass',points:[[375,515],[475,510],[535,553],[529,622],[613,659],[595,680],[445,655],[386,595]],material:'edge-grass',role:'vegetation-patch'},
  {id:water.id,points:water.points,material:water.material,textureAlpha:0,edge:{material:'bank-gravel',width:12}},
  {id:'stone-ford',points:[[105,620],[200,614],[310,625],[310,684],[202,684],[105,676]],material:'packed-stone',textureAlpha:.12},
  {id:'well-market',points:[[720,515],[770,475],[875,470],[920,530],[895,620],[805,650],[730,605],[704,550]],material:'packed-stone',textureAlpha:.5,
    edge:{material:'worn-earth',width:9},quietZone:{x:770,y:568,width:120,height:105},drain:[[910,612],[935,644],[965,691]]},
  {id:'residential-court',points:[[423,758],[580,774],[680,804],[710,854],[656,900],[490,904],[428,846]],material:'edge-grass',
    edge:{material:'mineral-rock',width:6},openSky:{x:500,y:790,width:150,height:88}},
  {id:'freight-yard',points:[[1250,815],[1435,820],[1510,899],[1508,1005],[1320,1017],[1230,925]],material:'worn-earth',textureAlpha:.12},
  {id:'training-clearing',points:[[1320,702],[1430,703],[1474,745],[1458,787],[1365,804],[1315,758]],material:'bank-gravel',textureAlpha:.1}
];

// Local edge widths are renderer inputs, not large blurred color masks.
const groundBlends = {
  'edge-grass':{feather:3,opacity:.78,textureAlpha:.25},
  'shade-moss':{feather:2,opacity:.65,textureAlpha:.25},
  'dry-grass':{feather:4,opacity:.72,textureAlpha:.25},
  'shallow-water':{feather:1,opacity:.95,textureAlpha:0},
  'packed-stone':{feather:3,opacity:.85},
  'worn-earth':{feather:5,opacity:.8},
  'bank-gravel':{feather:4,opacity:.78}
};
for(const plaza of plazas)Object.assign(plaza,groundBlends[plaza.material]);
for(const route of routes) {
  const stone=route.material==='packed-stone'||route.material==='door-stone';
  route.feather=stone?4:route.material==='road-verge'?5:4;
  route.opacity=stone?.85:route.material==='road-verge'?.35:.86;
}

// Polygon arrays keep the old inPoly(x,y,points) / oldpoly adapter usable.
const ridges = [
  [[0,0],[1600,0],[1600,155],[1490,168],[1430,135],[1280,181],[1180,146],[1100,162],[980,124],[710,151],[610,135],[425,187],[340,170],[300,130],[0,120]],
  [[0,120],[75,155],[88,330],[63,480],[99,580],[72,715],[90,900],[65,1040],[0,1100]],
  [[0,1100],[0,1056],[158,1064],[360,1064],[525,1072],[665,1064],[735,1072],[735,1100]],
  [[865,1100],[865,1072],[1030,1064],[1195,1072],[1440,1064],[1600,1056],[1600,1100]]
];

export const town = {
  id:'town-layout-review-10',name:['聚落街区 · 地域待核','集落街区 · 地域確認待ち'],canon:false,
  width:1600,height:1100,spawn:{x:800,y:710},props,routes,plazas,townFrames,
  assetSources:{kit:'assets/world-kit.png',town:'assets/town-buildings-v3.png',village:'assets/village-buildings-10.png'},
  districts:[
    {id:'gate',points:[[655,900],[945,900],[945,1060],[655,1060]],purpose:'arrival-and-onward-travel'},
    {id:'shopfront',points:[[350,270],[1420,270],[1420,580],[350,580]],purpose:'street-facing-trade'},
    {id:'market',points:plazas.find(p=>p.id==='well-market').points,purpose:'public-water-and-market',light:{openSky:true,contrast:.14}},
    {id:'residential',points:plazas.find(p=>p.id==='residential-court').points,purpose:'lodging-and-shared-court',light:{openSky:true,shadeProp:'residential-shade-tree'}},
    {id:'service',points:plazas.find(p=>p.id==='freight-yard').points,purpose:'storage'},
    {id:'water-edge',points:plazas[0].points,purpose:'water-edge-and-crossing'},
    {id:'training',points:plazas.find(p=>p.id==='training-clearing').points,purpose:'ordinary-practice-only',largeWeatherSafe:false}
  ],
  bounds:{x:24,y:24,width:1552,height:1052},ridges,colliders,doors,
  ground:{image:'assets/ground-kit.png',sourceSize:[1254,1254],base:'worn-earth',
    materials:{
      'mineral-rock':{sourceRect:[0,0,627,627],color:'#827b83',alpha:.16},
      'worn-earth':{sourceRect:[627,0,627,627],color:'#807154',alpha:.06},
      'road-verge':{color:'#807154',alpha:0,texture:false},
      'packed-stone':{sourceRect:[627,627,627,627],color:'#bab4a4',alpha:.78},
      'door-stone':{sourceRect:[627,627,627,627],color:'#c7beaa',alpha:.82},
      'bank-gravel':{sourceRect:[0,0,627,627],color:'#787e7a',alpha:.1},
      'shallow-water':{color:'#477d88',alpha:0,texture:false,receiver:'water'},
      'edge-grass':{sourceRect:[0,0,627,627],color:'#3f623d',alpha:.25,texture:true,content:'sparse-grass-on-rock-and-earth'},
      'shade-moss':{sourceRect:[0,627,627,627],color:'#34533c',alpha:.25,texture:true,content:'moss-between-rocks'},
      'dry-grass':{sourceRect:[0,0,627,627],color:'#667448',alpha:.25,texture:true,content:'sparse-grass-on-rock-and-earth'}
    },
    drawing:{routeJoin:'round',routeCap:'round',curve:'quadratic-midpoints',textureScale:.5,worldAnchored:true,noise:false}
  },
  lighting:{direction:[-.65,-.76],shadowDirection:[.65,.76],shadowAlpha:.18,contactAlpha:.24,
    skyWindows:[{x:770,y:568,width:120,height:105},{x:500,y:790,width:150,height:88}],
    roofShadow:{offset:[14,10],alpha:.12}},
  connections:[
    {id:'arrival',x:800,y:1040,chapterRole:null,target:null},
    {id:'west-water-route',x:150,y:650,chapterRole:null,target:null},
    {id:'east-freight-route',x:1450,y:650,chapterRole:null,target:null}
  ],
  water:[water],
  vegetationGroups:[
    {id:'upper-shore',propIds:['shore-tree','shore-tree-upper','shore-shrub','shore-rock-north','shore-reeds'],role:'irregular-bank-edge'},
    {id:'lower-shore',propIds:['shore-rock-south','lower-shore-reeds'],role:'bank-edge-not-route-fill'},
    {id:'court-edge',propIds:['residential-shade-tree','court-shrub','court-tree-west','court-tree-lower','court-shrub-inner','court-tree-inner','court-grass-inner','court-grass-west'],role:'court-shade-and-enclosure'},
    {id:'outer-edge',propIds:['north-edge-tree','east-edge-tree','south-edge-tree','north-ridge-rock','east-ridge-rock','north-tree-inner','north-tree-middle','north-shrub','east-tree-upper','east-tree-lower','east-shrub'],role:'broken-perimeter'}
  ],
  rivers:[{id:'west-channel',waterId:water.id,points:water.points,boundary:water.boundary,
    flow:water.flow,bankPlazaId:'shore-bank',crossingIds:['stone-ford'],regionStatus:'pending'}],
  bridges:[{id:'stone-ford',type:'shallow-stone-crossing',waterId:water.id,
    ...water.crossing,clearWidth:80,axis:[1,0],deckPlazaId:'stone-ford',
    propIds:['crossing-stone-0','crossing-stone-1','crossing-stone-2'],
    endpoints:[[150,650],[295,650]],height:0,occlusion:'ground',assetStatus:'kit-stones-not-a-bridge-asset'}],
  geography:{status:'pending-canon-review',region:null,period:null,reference:'composition-only',quests:[]},
  scale:{currentCollisionRadius:9,clearanceTestRadius:18,bodyHeightTarget:48,doorHeightTarget:[56,72],status:'new-four-grid-character-overlay-pending'},
  implementation:{chapterComplete:false,interiorsImplemented:false,collisionAuthority:'colliders-plus-ridges-plus-bounds',
    legacyFootprint:'rx/ry compatibility only; do not duplicate explicit collisionIds',assetStatus:'measured-candidate',
    writeSet:['rebuild/world/town-layout.mjs','rebuild/world/town-layout.test.mjs'],
    clientHandoff:[
      'makeTerrain: pass plaza.feather/opacity/textureAlpha and route.feather/opacity; do not replace them with fixed 14/.82 and 12/.7',
      'grass sourceRect uses observed ground-kit top-left sparse grass rock; moss uses bottom-left moss rock, not a lawn or verified seamless texture',
      'paint river before ford/deck and crossing stones: current river redraw after all plazas/routes erases the dry ford surface',
      'new town0..3: override prop origin/sourceRect from measured alpha bbox and door axes as well as h/w; townFrames stay legacy candidates',
      'render water[] flow/bank edge locally; colliders with surface=water block movement/projectiles but must not cast masonry shadows',
      'consume skyWindows for both courts; add canopy shadows for all trees, not only the first kit2',
      'retain source-alpha occlusion; keep actor48 scale and target new-pack doorway height56..72, source-ratio facades width280..300',
      'UI area/title and hardcoded interactions still belong to client/canon; do not restore discarded quests',
      'core/town-layout.test.mjs has two obsolete straight-alley and old-post-coordinate assertions; replace with new curve/relative-post tests'
    ]}
};

export default town;
