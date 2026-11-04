const wrap=(s:string)=>s.match(/.{1,76}/g)?.join('\r\n')||'';
export function outlookDraft(subject:string,body:string,filename:string,pdfBase64:string){
 const boundary='jll-'+crypto.randomUUID(),safe=filename.replace(/[^a-z0-9._-]/gi,'_');
 const encode=(value:string)=>{const bytes=new TextEncoder().encode(value);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);};
 return ['X-Unsent: 1','MIME-Version: 1.0','Subject: =?UTF-8?B?'+encode(subject.replace(/[\r\n]/g,' '))+'?=','Content-Type: multipart/mixed; boundary="'+boundary+'"','','--'+boundary,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',wrap(encode(body)),'--'+boundary,'Content-Type: application/pdf; name="'+safe+'"','Content-Disposition: attachment; filename="'+safe+'"','Content-Transfer-Encoding: base64','',wrap(pdfBase64),'--'+boundary+'--',''].join('\r\n');
}
