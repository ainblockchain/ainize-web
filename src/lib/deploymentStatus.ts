const revision=(value:unknown):string|null=>typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value)?value.toLowerCase():null;
/** Public build metadata only. Node addresses, account data and upstream errors never escape. */
export async function deploymentStatus(webRevision:unknown,nodeBase:string,fetchImpl:typeof fetch=fetch){
 const web=revision(webRevision);
 let node:{status:'running'|'unknown_revision'|'unavailable';revision:string|null}={status:'unavailable',revision:null};
 try{
  const response=await fetchImpl(nodeBase.replace(/\/$/,'')+'/healthz',{headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(3000)});
  if(response.ok){
   const body=await response.json();
   if(body?.ok===true){const sha=revision(body.commit);node={status:sha?'running':'unknown_revision',revision:sha};}
  }
 }catch{/* A generic state is sufficient; network exceptions can expose private addresses. */}
 return {service:'ainize',web:{status:web?'running':'unknown_revision',revision:web},node};
}
