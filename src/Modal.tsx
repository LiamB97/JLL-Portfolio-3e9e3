import {useEffect,useId,useRef,type ReactNode} from 'react';
import {useLocale} from './i18n';
import {X} from 'lucide-react';
// Native modal dialogs live above map/search stacking contexts and make the
// background inert. Keep only the body scrollable so Close is always reachable.
export default function Modal({title,close,children,footer,doneLabel,className=''}:{title:string;close:()=>void;children:ReactNode;footer?:ReactNode;doneLabel?:string|null;className?:string}){
 const {t,language}=useLocale();
 const ref=useRef<HTMLDialogElement>(null),id=useId();
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';return()=>{dialog.close();document.body.style.overflow=overflow;previous?.focus();};},[]);
 return <dialog ref={ref} lang={language} dir={language==='ar'?'rtl':'ltr'} className={'workspace-dialog '+className} aria-labelledby={id} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget){const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)close();}}}><div className="workspace-dialog-heading"><h2 id={id}>{title}</h2><button autoFocus aria-label={t('Close {name}',{name:title})} onClick={close}><X size={20}/></button></div><div className="workspace-dialog-body">{children}</div><div className="workspace-dialog-footer">{footer}{doneLabel!==null&&<button className="primary" onClick={close}>{doneLabel||t('Done')}</button>}</div></dialog>;
}
