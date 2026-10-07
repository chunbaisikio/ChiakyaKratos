import { useState, useSyncExternalStore } from 'react';
import { useAppStore } from '../store';
import { beforeResync, downloadPendingBackup, getSyncState, subscribeSync } from '../utils/workspaceStorage';

export default function SyncBanner() {
  const state = useSyncExternalStore(subscribeSync, getSyncState);
  const [refreshing, setRefreshing] = useState(false);
  if (state.kind !== 'conflict' && state.kind !== 'offline') return null;
  async function resync() { setRefreshing(true); try { await beforeResync(); await useAppStore.persist.rehydrate(); } finally { setRefreshing(false); } }
  return <div className="sync-banner" role="alert"><div><strong>{state.kind === 'conflict' ? '工作区有新修改' : '工作区暂未同步'}</strong><p>{state.message} 本地备份会保留，重新同步后展示服务端的数据。</p></div><div><button onClick={downloadPendingBackup}>下载本地备份</button><button onClick={resync} disabled={refreshing}>{refreshing ? '同步中…' : '重新同步'}</button></div></div>;
}
