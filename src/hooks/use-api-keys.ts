"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { type ApiKeys, type Provider, getApiKeys, remembersKeys, saveApiKeys } from "@/lib/api-keys";
function subscribe(listener: () => void) {
  window.addEventListener("modelLens:keys-updated",listener); window.addEventListener("storage",listener);
  return () => { window.removeEventListener("modelLens:keys-updated",listener); window.removeEventListener("storage",listener); };
}
function snapshot(): string { return JSON.stringify({keys:getApiKeys(),remember:remembersKeys()}); }
export function useApiKeys() {
  const raw = useSyncExternalStore(subscribe,snapshot,()=>null);
  const state = useMemo<{keys:ApiKeys;remember:boolean}>(()=> raw ? JSON.parse(raw) : {keys:{},remember:false},[raw]);
  const updateKeys = useCallback((next:ApiKeys)=>{saveApiKeys(next);window.dispatchEvent(new Event("modelLens:keys-updated"));},[]);
  const setRemember = useCallback((remember:boolean)=>{saveApiKeys(getApiKeys(),remember);window.dispatchEvent(new Event("modelLens:keys-updated"));},[]);
  const isConnected = useCallback((provider:Provider)=>Boolean(state.keys[provider]?.trim()),[state.keys]);
  return {keys:state.keys,remember:state.remember,setRemember,loaded:raw!==null,updateKeys,isConnected};
}
