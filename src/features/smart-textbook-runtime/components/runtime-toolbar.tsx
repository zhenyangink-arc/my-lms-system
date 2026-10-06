'use client';
import {useEffect,useState,type RefObject,type ReactNode} from 'react';
import {courseReturnHref} from '../core/course-return';

export function RuntimeToolbar({container,title,position,total,locale,children,backHref,onLocaleChange}:{container:RefObject<HTMLDivElement|null>;title:string;position:number;total:number;locale:'zh-CN'|'ko-KR';children:ReactNode;backHref?:string;onLocaleChange?:(locale:'zh-CN'|'ko-KR')=>Promise<void>}){
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
      {onLocaleChange?<label className="runtime-language">{ko?'언어':'语言'} <select aria-label={ko?'언어':'语言'} value={locale} disabled={busy} onChange={event=>{
        const value=event.target.value;if(value===locale||!['zh-CN','ko-KR'].includes(value))return;
        if(!window.confirm(ko?'언어를 변경하면 교재를 다시 엽니다. 제출하지 않은 입력은 사라집니다. 계속하시겠습니까?':'切换语言将重新进入教材，未提交的输入不会保留。是否继续？'))return;
        setBusy(true);void onLocaleChange(value as 'zh-CN'|'ko-KR').catch(()=>{setError(ko?'언어를 변경하지 못했습니다. 다시 시도해 주세요.':'语言切换失败，请重试。');setBusy(false);});
      }}><option value="zh-CN">中文</option><option value="ko-KR">한국어</option></select></label>:<span className="runtime-language" aria-label={ko?'현재 인터페이스 언어':'当前界面语言'}>{ko?'한국어':'中文'}</span>}
      {available&&<button type="button" disabled={busy} aria-pressed={fullscreen} onClick={()=>void toggle()}>{ko?(fullscreen?'전체 화면 종료':'전체 화면'):(fullscreen?'退出全屏':'全屏')}</button>}
      {children}
    </div>
    <div className="runtime-chapter-location"><strong>{title}</strong><span aria-label={ko?`학습 단계 ${position}/${total}`:`学习步骤 ${position}/${total}`}>{position} / {total}</span></div>
    {back&&<a className="runtime-course-return" href={back}>{ko?'강좌로 돌아가기':'返回课程'}</a>}
    {error&&<p className="runtime-toolbar-error" role="status">{error}</p>}
  </header>;
}
