'use client';
import { useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { provisionDevelopmentExecutionAction } from '../server/provisioning.actions';
const key = 'uply:development-domain-execution:provision:1';
const subscribe = () => () => {};
const alreadySubmitted = () => { try { return sessionStorage.getItem(key) !== null; } catch { return true; } };
export function ProvisioningForm({ state }: { state: 'READY' | 'EXISTING' | 'BLOCKED' }) {
  const previous = useSyncExternalStore(subscribe, alreadySubmitted, () => true);
  const [started, setStarted] = useState(false), [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition(); const inFlight = useRef(false);
  const disabled = state !== 'READY' || previous || started || pending;
  function create() {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    try { sessionStorage.setItem(key, 'VERIFY_REQUIRED'); } catch { setMessage('无法保护本次操作，请停止并核查。'); return; }
    setStarted(true);
    startTransition(async () => {
      try {
        const r = await provisionDevelopmentExecutionAction();
        setMessage(r.status === 'CREATED' || r.status === 'EXISTING' ? '身份状态已确认，执行范围仍关闭。请完成独立核查。' : '已停止操作，请先独立核查，不要重复创建。');
      } catch { setMessage('结果不明确，请独立核查实际状态，不要重复创建。'); }
    });
  }
  const status = message || (state === 'EXISTING' ? '已有完整身份绑定，无需再次创建。' : state === 'BLOCKED' ? '预检未通过或入口未启用，已停止创建。' : previous ? '已有提交记录，请先独立核查。' : '预检通过，可以创建开发执行身份。');
  return <section className="space-y-4" aria-busy={pending}>
    <p role="status" aria-live="polite">{status}</p>
    <Button type="button" className="min-h-11" disabled={disabled} onClick={create}>{pending ? '正在创建…' : '创建开发执行身份'}</Button>
  </section>;
}
