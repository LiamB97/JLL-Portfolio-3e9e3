export interface BrochureMapPoint {id:string;x:number;y:number}
export interface BrochureMapArea {name:string;x:number;y:number;major?:boolean}
export interface BrochureMapImage {image:string;points:BrochureMapPoint[];areas:BrochureMapArea[];attribution:string}
interface Rect {x:number;y:number;width:number;height:number}
const overlap=(a:Rect,b:Rect,gap=1)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

// Work in PDF millimetres so numbered pins stay readable at print resolution.
// Crowded pins move a little, with a leader back to their true geographic anchor.
export function layoutBrochurePins(points:BrochureMapPoint[],width:number,height:number){
 const pins:Rect[]=[];
 return points.map(point=>{
  const anchor={x:point.x*width,y:point.y*height};let pin={x:anchor.x,y:anchor.y};
  outer:for(let radius=0;radius<=50;radius+=6)for(let angle=0;angle<360;angle+=30){
   const x=clamp(anchor.x+radius*Math.cos(angle*Math.PI/180),6,width-6),y=clamp(anchor.y+radius*Math.sin(angle*Math.PI/180),12,height-7);
   if(!pins.some(r=>overlap(r,{x:x-4,y:y-9,width:8,height:10},1))){pin={x,y};break outer;}
  }
  pins.push({x:pin.x-4,y:pin.y-9,width:8,height:10});return {...point,anchor,pin};
 });
}
