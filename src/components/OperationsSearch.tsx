import {useState} from 'react';
import {useOperationsSearchQuery} from '@/api/api';
import {projectApiErrorOf} from '@/api/projects';
import {projectPath} from '@/lib/reservedRoutes';
import {useT} from '@/i18n';
import {Input,Alert} from './ui/Form';
import {Button} from './ui/Button';
import {StyledLink} from './ui/Misc';
export default function OperationsSearch(){
 const {locale}=useT();const ko=locale==='ko';const [input,setInput]=useState('');const [query,setQuery]=useState('');
 const result=useOperationsSearchQuery(query,{skip:!query});
 return <section style={{margin:'20px 0'}}><form onSubmit={e=>{e.preventDefault();setQuery(input.trim());}}>
  <label>{ko?'이전 원본 프로젝트로 찾기':'Find by original project'}<Input value={input} maxLength={200} placeholder={ko?'GCP / Firebase 프로젝트 ID 또는 저장소':'GCP / Firebase project ID or repository'} onChange={e=>setInput(e.target.value)}/></label>
  <Button type="submit" disabled={!input.trim()}>{ko?'운영 기록 검색':'Search operations'}</Button>
 </form>{query&&<div aria-live="polite">
  {result.isFetching?<p>{ko?'검색 중…':'Searching…'}</p>:result.error?<Alert $tone="error">{projectApiErrorOf(result.error).message??(ko?'검색하지 못했습니다.':'Search failed.')} <Button onClick={()=>result.refetch()}>{ko?'다시 시도':'Retry'}</Button></Alert>:result.currentData?.projects.length?<ul>{result.currentData.projects.map(p=><li key={p.projectId}><StyledLink to={projectPath(p)}>{p.name} · {p.org}/{p.repoName}{p.sourcePath?` / ${p.sourcePath}`:''}</StyledLink> — {p.record?.origins.map(o=>`${o.provider}: ${o.projectId}`).join(', ')}</li>)}</ul>:<p>{ko?'접근 가능한 운영 기록이 없습니다.':'No accessible operational records found.'}</p>}
 </div>}</section>;
}
