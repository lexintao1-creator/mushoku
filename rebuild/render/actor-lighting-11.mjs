let serial = 0;

export function actorLightSamples(foot, lights) {
  return lights.filter(l => [l.x,l.y,l.radius,l.intensity].every(Number.isFinite) && l.radius>0 && l.intensity>0)
    .filter(l => Math.hypot(l.x-foot.x,l.y-(foot.y-24)) < l.radius+36)
    .slice(0,6).map(l => ({...l,x:l.x-foot.x+48,y:l.y-foot.y+80}));
}

// One small source-RGBA surface follows the currently visible Meowa frame.
export function createActorLighting(scene) {
  const key='actor-light-11-'+(++serial),texture=scene.textures.createCanvas(key,96,96);
  texture.setFilter(0);
  const image=scene.add.image(0,0,key).setOrigin(.5,80/96).setVisible(false);
  let last=-Infinity,signature='',destroyed=false;
  const update=({actor,lights=[],timeMs=0,enabled=true,paused=false})=>{
    if(destroyed)return;
    const container=actor?.container;
    const piece=container?.visible?Object.values(actor.pieces).flatMap(p=>[p.walk,p.idle]).find(p=>p.visible&&p.alpha>0):null;
    const foot=container?{x:container.x,y:container.y}:null;
    const samples=foot?actorLightSamples(foot,lights):[];
    if(!enabled||paused||!piece||!samples.length){image.setVisible(false);return;}
    image.setPosition(foot.x,foot.y).setDepth(container.depth+.02).setAlpha(container.alpha);
    const next=[piece.texture.key,piece.frame.name,piece.flipX,piece.scaleX,piece.scaleY,piece.originX,piece.originY].join(':');
    if(next===signature&&timeMs-last<33){image.setVisible(true);return;}
    const ctx=texture.getContext(),frame=piece.frame;
    const w=frame.cutWidth*Math.abs(piece.scaleX),h=frame.cutHeight*Math.abs(piece.scaleY);
    const x=48+piece.x-piece.displayOriginX*Math.abs(piece.scaleX),y=80+piece.y-piece.displayOriginY*Math.abs(piece.scaleY);
    ctx.clearRect(0,0,96,96);ctx.save();
    ctx.translate(piece.flipX?x+w:x,y);if(piece.flipX)ctx.scale(-1,1);
    ctx.drawImage(piece.texture.getSourceImage(),frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,w,h);
    ctx.restore();ctx.globalCompositeOperation='source-atop';
    for(const l of samples){
      const c=l.color??0x98eaff,r=(c>>16)&255,g=(c>>8)&255,b=c&255;
      const gradient=ctx.createRadialGradient(l.x,l.y,0,l.x,l.y,l.radius);
      gradient.addColorStop(0,`rgba(${r},${g},${b},${Math.min(.55,l.intensity*.7)})`);
      gradient.addColorStop(1,`rgba(${r},${g},${b},0)`);
      ctx.fillStyle=gradient;ctx.fillRect(0,0,96,96);
    }
    ctx.globalCompositeOperation='source-over';texture.refresh();image.setVisible(true);
    last=timeMs;signature=next;
  };
  const destroy=()=>{if(destroyed)return;destroyed=true;image.destroy();scene.textures.remove(key);};
  return {update,destroy};
}
