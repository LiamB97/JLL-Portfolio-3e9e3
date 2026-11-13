import {useState} from 'react';
import {Play,ExternalLink} from 'lucide-react';
import {useLocale} from './i18n';
import {videoSource,videoThumbnails} from './video-source';

export default function DevelopmentVideo({url,name,index,poster}:{url:string;name:string;index:number;poster?:string}){
 const {t} = useLocale();
 const source = videoSource(url);
 const [showPlayer,setShowPlayer] = useState(false);
 const [failed,setFailed] = useState(false);
 const [thumbnail,setThumbnail] = useState(0);
 const thumbnails = videoThumbnails(url,poster);
 const title = t('{name} video {number}',{name,number:index+1});
 const watchLabel = t('Watch Video');
 let hasOriginalVideo = false;
 try { hasOriginalVideo = new URL(url).protocol === 'https:'; } catch {}

 return <section className="development-video" aria-label={title}>
  {source && !failed && <div className="video-stage">
   {!showPlayer
    ? <button type="button" className="video-play" onClick={()=>setShowPlayer(true)}>
       <img className="video-thumbnail" src={thumbnails[thumbnail]} alt="" loading="lazy"
        onError={()=>setThumbnail(n=>Math.min(n+1,thumbnails.length-1))}/>
       <span><Play size={26} aria-hidden="true"/></span><strong>{watchLabel}</strong>
      </button>
    : source.kind === 'file'
      ? <video controls playsInline preload="metadata" poster={poster} src={source.src} aria-label={title} onError={()=>setFailed(true)}/>
      : <iframe src={source.src} title={title} allow="fullscreen; encrypted-media; picture-in-picture" allowFullScreen
         referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" onError={()=>setFailed(true)}/>}
  </div>}
  {hasOriginalVideo && (!source || failed || showPlayer) && <a className="video-original" href={url} target="_blank" rel="noopener noreferrer">
   {watchLabel} <ExternalLink size={12} aria-hidden="true"/>
  </a>}
  {!hasOriginalVideo && <p>{t('Video unavailable')}</p>}
 </section>;
}
