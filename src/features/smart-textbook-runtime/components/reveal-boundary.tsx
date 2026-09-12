'use client';
import { createContext, useContext, type ReactNode } from 'react';
const RevealContext=createContext<()=>void>(()=>{});
export const useRevealBoundary=()=>useContext(RevealContext);
/** Scoped controlled containers open via React state, never DOM selectors. */
export function RevealBoundary({reveal,children}:{reveal:()=>void;children:ReactNode}){
  return <RevealContext.Provider value={reveal}>{children}</RevealContext.Provider>;
}
