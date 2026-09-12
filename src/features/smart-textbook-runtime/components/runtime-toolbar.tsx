'use client';
import {useEffect,useState,type RefObject,type ReactNode} from 'react';
import {courseReturnHref} from '../core/course-return';

export function RuntimeToolbar({container,title,position,total,locale,children,backHref}:{container:RefObject<HTMLDivElement|null>;title:string;position:number;total:number;locale:'zh-CN'|'ko-KR';children:ReactNode;backHref?:string}){
  const [fullscreen,setFullscreen]=useState(false),[available,setAvailable]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const ko=locale==='ko-KR';
  const back=courseReturnHref(backHref);
  useEffect(()=>{
    let live=true;
    const sync=()=>{if(live){setFullscreen(document.fullscreenElement===container.current);setAvailable(Boolean(document.fullscreenEnabled&&container.current?.requestFullscreen));}};
    sync();document.addEventListener('fullscreenchange',sync);
    const element=container.current;
    return()=>{live=false;document.removeEventListener('fullscreenchange',sync);if(element&&document.fullscreenElement===element)void document.exitFullscreen().catch(()=>{});};
  },[container]);
  const toggle=async()=>{
    if(busy)return;setBusy(true);setError('');
    try{if(document.fullscreenElement===container.current)await document.exitFullscreen();else await container.current?.requestFullscreen();}
    catch{setError(ko?'전체 화면을 사용할 수 없습니다. 일반 화면에서 계속 학습할 수 있습니다.':'暂时无法进入全屏，可以继续在当前窗口学习。');}
    finally{setBusy(false);}
  };
  return <header className="runtime-toolbar">
    <div className="runtime-toolbar-actions">
      <span className="runtime-language" aria-label={ko?'현재 인터페이스 언어':'当前界面语言'}>{ko?'한국어':'中文'}</span>
      {available&&<button type="button" disabled={busy} aria-pressed={fullscreen} onClick={()=>void toggle()}>{ko?(fullscreen?'전체 화면 종료':'전체 화면'):(fullscreen?'退出全屏':'全屏')}</button>}
      {children}
    </div>
    <div className="runtime-chapter-location"><strong>{title}</strong><span aria-label={ko?`학습 단계 ${position}/${total}`:`学习步骤 ${position}/${total}`}>{position} / {total}</span></div>
    {back&&<a className="runtime-course-return" href={back}>{ko?'강좌로 돌아가기':'返回课程'}</a>}
    {error&&<p className="runtime-toolbar-error" role="status">{error}</p>}
  </header>;
}
