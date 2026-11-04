import {randomBytes} from 'node:crypto';
import {AccessError} from './access.mjs';
const MAX_PDF=3500000;
export function memoryBrochureFiles(){const files=new Map();return {put:async(key,bytes,type)=>files.set(key,{bytes,type}),get:async key=>files.get(key)||null,remove:async key=>{files.delete(key);}};}
export function brochureService(repository,files){
 const own=(state,id,check)=>{const actor=check(state),row=(state.brochures||[]).find(b=>b.id===id&&b.ownerId===actor.id);if(!row)throw new AccessError('Saved brochure not found.',404);return row;};
 function config(body,state,actor){const input=body.config;if(!input||typeof input!=='object'||Array.isArray(input))throw new AccessError('A brochure needs its saved settings.');
  const text=(v,max)=>{if(typeof v!=='string'||v.length>max)throw new AccessError('Check the brochure text lengths.');return v;};
  const ids=input.developmentIds;if(!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(id=>typeof id!=='string'||!state.developments.some(d=>d.id===id)))throw new AccessError('Choose 1–20 published developments.');
  const result={title:text(input.title,100).trim(),intro:text(input.intro||'',1600),brokerTitle:text(input.brokerTitle||'',100),developmentIds:[...new Set(ids)],notes:{},collection:String(input.collection||''),cover:{kind:'default'}};
  if(!result.title)throw new AccessError('Give the brochure a title.');
  if(result.collection&&!state.collections?.some(c=>c.slug===result.collection&&c.ownerId===actor.id))throw new AccessError('Choose one of your own collections.',403);
  for(const id of ids)if(input.notes?.[id])result.notes[id]=text(input.notes[id],1600);
  if(input.cover?.kind==='development'){const d=state.developments.find(d=>d.id===input.cover.developmentId&&ids.includes(d.id));if(!d||!d.images.includes(input.cover.imageUrl))throw new AccessError('Choose a cover image from a selected development.');result.cover={kind:'development',developmentId:d.id,imageUrl:input.cover.imageUrl};}
  return result;
 }
 return {
  async list(check){const s=await repository.read(),actor=check(s);return (s.brochures||[]).filter(b=>b.ownerId===actor.id).map(({fileKey,...b})=>({...b,hasPdf:Boolean(fileKey)})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
  async save(body,check){const s=await repository.read(),actor=check(s);config(body,s,actor);let bytes=null,key=null;
   if(body.pdfBase64!==undefined){if(typeof body.pdfBase64!=='string'||body.pdfBase64.length>Math.ceil(MAX_PDF/3)*4+4||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.pdfBase64))throw new AccessError('Saved PDFs must be no larger than 3.5MB.',413);bytes=Buffer.from(body.pdfBase64,'base64');if(bytes.toString('base64')!==body.pdfBase64)throw new AccessError('The PDF encoding is invalid.');if(bytes.length>MAX_PDF||bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(-1024).toString().includes('%%EOF'))throw new AccessError('This file is not a complete PDF.');key='pdf/'+randomBytes(20).toString('hex');await files.put(key,bytes,'application/pdf');}
   let previousKey;try{const row=await repository.update(state=>{const current=check(state),fresh=config(body,state,current);state.brochures||=[];let existing=body.id?own(state,body.id,check):null;
    if(existing&&existing.version!==body.version)throw new AccessError('A newer version of this brochure was saved. Reopen it before saving.',409);
    const mine=state.brochures.filter(b=>b.ownerId===current.id);if(!existing&&mine.length>=50)throw new AccessError('Remove an old saved brochure before adding another (50 per broker).');
    if(mine.reduce((n,b)=>n+(b.id===existing?.id?0:b.size||0),0)+(bytes?.length||0)>100000000)throw new AccessError('Saved brochures have reached the 100MB allowance for this account. Remove old PDFs first.');
    if(!existing){existing={id:randomBytes(12).toString('hex'),ownerId:current.id,createdAt:new Date().toISOString(),version:0};state.brochures.push(existing);}
    const same=JSON.stringify(existing.config)===JSON.stringify(fresh);previousKey=existing.fileKey;
    existing.config=fresh;existing.title=fresh.title;existing.updatedAt=new Date().toISOString();existing.version++;
    if(key||!same||body.clearPdf===true){existing.fileKey=key;existing.size=bytes?.length||0;existing.generatedAt=key?existing.updatedAt:null;existing.filename=key?fresh.title.normalize('NFKD').replace(/[^a-z0-9]+/gi,'-').slice(0,70)+'.pdf':null;}
    return structuredClone(existing);});if(previousKey&&previousKey!==row.fileKey)await files.remove(previousKey).catch(()=>{});const {fileKey,...safe}=row;return {...safe,hasPdf:Boolean(fileKey)};
   }catch(e){if(key)await files.remove(key).catch(()=>{});throw e;}
  },
  async pdf(id,check){const row=own(await repository.read(),id,check);if(!row.fileKey)throw new AccessError('Generate and save this brochure first.',404);const file=await files.get(row.fileKey);check(await repository.read());if(!file)throw new AccessError('The saved PDF is unavailable. Reopen the draft and regenerate it.',404);return {...file,filename:row.filename};},
  async remove(id,check){const key=await repository.update(state=>{const row=own(state,id,check);state.brochures=state.brochures.filter(b=>b.id!==id);return row.fileKey;});if(key)await files.remove(key).catch(()=>{});return {ok:true};},
  async cover(check){const state=await repository.read();check(state);const key=state.brochureCover?.key;if(!key)return null;return files.get(key);},
  async saveCover(photo,check){const s=await repository.read(),actor=check(s);if(actor.role!=='admin')throw new AccessError('Only an Admin can replace the default cover.',403);
   if(typeof photo!=='string'||photo.length>1500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))throw new AccessError('Choose a JPG, PNG or WebP using the cover upload.');const bytes=Buffer.from(photo.slice(23),'base64');if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new AccessError('The cover is not a JPEG.');const key='cover/'+randomBytes(20).toString('hex');await files.put(key,bytes,'image/jpeg');
   try{const old=await repository.update(state=>{if(check(state).role!=='admin')throw new AccessError('Only an Admin can replace the default cover.',403);const old=state.brochureCover?.key;state.brochureCover={key,updatedAt:new Date().toISOString(),updatedBy:actor.id};return old;});if(old)await files.remove(old).catch(()=>{});return {ok:true};}catch(e){await files.remove(key).catch(()=>{});throw e;}
  }
 };
}
