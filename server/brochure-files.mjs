import {getStore} from '@netlify/blobs';
export function brochureFileRepository(store=getStore({name:'jll-brochure-files',consistency:'strong'})){
 return {put:async(key,bytes,type)=>store.set(key,bytes,{metadata:{type}}),get:async key=>{const row=await store.getWithMetadata(key,{type:'arrayBuffer',consistency:'strong'});return row?{bytes:new Uint8Array(row.data),type:row.metadata.type}:null;},remove:async key=>store.delete(key)};
}
