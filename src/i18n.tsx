import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import dictionary from './locales.json';
export type Language='en'|'ar'|'zh-CN'|'tr';
export type Theme='light'|'dark'|'system';
export const languages:{value:Language;label:string}[]=[{value:'en',label:'English'},{value:'ar',label:'العربية'},{value:'zh-CN',label:'简体中文'},{value:'tr',label:'Türkçe'}];
const stored=(key:string,fallback:string)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
const save=(key:string,value:string)=>{try{localStorage.setItem(key,value);}catch{}};
const Locale=createContext({language:'en' as Language,theme:'system' as Theme,dark:false,setLanguage:(_v:Language)=>{},setTheme:(_v:Theme)=>{},t:(key:string,values?:Record<string,string|number>)=>key.replace(/\{(\w+)\}/g,(_,k)=>String(values?.[k]??''))});
export function PreferencesProvider({children,themeOverride}:{children:ReactNode;themeOverride?:'light'|'dark'}){
 const [language,setLanguage]=useState<Language>(()=>{const v=stored('jll-language-v1','en');return languages.some(x=>x.value===v)?v as Language:'en';});
 const [theme,setTheme]=useState<Theme>(()=>{const v=stored('jll-theme-v1','system');return ['light','dark','system'].includes(v)?v as Theme:'system';});
 const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches);const appearance=themeOverride??theme;const dark=appearance==='dark'||appearance==='system'&&systemDark;
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)'),change=()=>setSystemDark(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';document.querySelector('meta[name=theme-color]')?.setAttribute('content',dark?'#131E29':'#003E51');document.documentElement.style.colorScheme=dark?'dark':'light';save('jll-theme-v1',theme);},[dark,theme]);
 useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';save('jll-language-v1',language);},[language]);
 const t=(key:string,values?:Record<string,string|number>)=>((language==='en'?key:(dictionary as Record<string,Record<string,string>>)[language]?.[key]||key)).replace(/\{(\w+)\}/g,(_,k)=>String(values?.[k]??''));
 return <Locale.Provider value={{language,theme,dark,setLanguage,setTheme,t}}>{children}</Locale.Provider>;
}
export const useLocale=()=>useContext(Locale);
