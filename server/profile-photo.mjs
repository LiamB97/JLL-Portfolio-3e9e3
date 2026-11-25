export function profileJpegSize(value){
 if(typeof value!=='string'||value.length>180000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return null;
 const raw=value.slice(23),bytes=Buffer.from(raw,'base64');
 if(bytes.toString('base64')!==raw||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return null;
 let offset=2;
 while(offset+4<bytes.length){
  if(bytes[offset]!==255)break;const marker=bytes[offset+1];if(marker===218||marker===217)break;
  const length=bytes.readUInt16BE(offset+2);if(length<2||offset+2+length>bytes.length)break;
  if([192,193,194].includes(marker)&&length>=8)return {height:bytes.readUInt16BE(offset+5),width:bytes.readUInt16BE(offset+7)};
  offset+=2+length;
 }
 return null;
}
// The circular crop is saved as a square image.
export function profilePhoto(value){
 if(value==='')return '';
 const size=profileJpegSize(value);
 if(!size||size.width<64||size.width>512||size.width!==size.height)throw Error('Choose a JPEG, PNG or WebP photo and save its circular crop.');
 return value;
}
