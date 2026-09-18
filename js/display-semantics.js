// Presentation-only decisions: these never grant control or clear an emergency latch.
export function stopStatus({replaying,local,device,stale,delivery}) {
  if(replaying)return 'replay';
  if(device&&!stale)return 'device-reported';
  if(local||device)return delivery==='sent'?'awaiting-device':'local-only';
  return 'none';
}

export function ppgTimestamp(sourceTs,receivedTs,replayOffset=0) {
  const source=Number.isFinite(sourceTs)?sourceTs+replayOffset:NaN;
  // Firmware epoch is established by ping. Zero, future, or unrelated epochs are not sample clocks.
  const valid=Number.isFinite(sourceTs)&&sourceTs>0&&source<=receivedTs+1000&&source>=receivedTs-60000;
  return {time:valid?source:receivedTs,receivedTs,sourceTs:Number.isFinite(sourceTs)?sourceTs:null,
    basis:valid?'source-batch':'arrival-estimate'};
}
