export interface BrochureMapPoint {id:string;x:number;y:number}
export interface BrochureMapArea {name:string;x:number;y:number;major?:boolean}
export interface BrochureMapImage {image:string;points:BrochureMapPoint[];areas:BrochureMapArea[];attribution:string}
export interface LabelledMapPoint extends BrochureMapPoint {width:number;height:number}
interface Rect {x:number;y:number;width:number;height:number}
const overlap=(a:Rect,b:Rect,gap=1)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

// Work in PDF millimetres so callouts have the same readable size at any export resolution.
// Crowded pins move a little, with a leader back to their true geographic anchor.
export function layoutBrochureMap(points:LabelledMapPoint[],width:number,height:number){
 const pins:Rect[]=[],labels:Rect[]=[];
 const placed=points.map(point=>{
  const anchor={x:point.x*width,y:point.y*height};let pin={x:anchor.x,y:anchor.y};
  outer:for(let radius=0;radius<=50;radius+=6)for(let angle=0;angle<360;angle+=30){
   const x=clamp(anchor.x+radius*Math.cos(angle*Math.PI/180),6,width-6),y=clamp(anchor.y+radius*Math.sin(angle*Math.PI/180),12,height-7);
   if(!pins.some(r=>overlap(r,{x:x-4,y:y-9,width:8,height:10},1))){pin={x,y};break outer;}
  }
  pins.push({x:pin.x-4,y:pin.y-9,width:8,height:10});return {...point,anchor,pin};
 });
 return placed.map(point=>{
  const {pin}=point,candidates:Rect[]=[];
  for(const distance of [0,8,18,32,50,72,100])for(const sign of [1,-1])for(const dy of [0,-12,12,-24,24,-40,40,-60,60]){
   candidates.push({x:clamp(sign===1?pin.x+6+distance:pin.x-6-distance-point.width,4,width-point.width-4),y:clamp(pin.y-8+dy,4,height-point.height-7),width:point.width,height:point.height});
  }
  // A dense group can exhaust the near-pin choices. Search the whole band
  // before accepting an overlap, including for twenty long name cards.
  for(let y=4;y<=height-point.height-7;y+=4)for(let x=4;x<=width-point.width-4;x+=4)candidates.push({x,y,width:point.width,height:point.height});
  const score=(r:Rect)=>labels.filter(b=>overlap(r,b,2)).length*1000000+pins.filter(b=>overlap(r,b,1)).length*10000+Math.hypot(r.x+r.width/2-pin.x,r.y+r.height/2-pin.y);
  let label=candidates[0],best=score(label);for(const candidate of candidates){const value=score(candidate);if(value<best){label=candidate;best=value;}}labels.push(label);return {...point,label};
 });
}
