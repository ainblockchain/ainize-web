import {useEffect,useState} from 'react';
import styled from 'styled-components';
import {useProjectOperationsQuery,useSaveProjectOperationsMutation} from '@/api/api';
import {editableOperations,emptyOperations,type OperationsRecord} from '@/api/projectOperations';
import {projectApiErrorOf,type Project} from '@/api/projects';
import {useT} from '@/i18n';
import {Button} from './ui/Button';
import {Input,Select,Alert} from './ui/Form';
const Section=styled.section`margin:20px 0;padding:20px;border:1px solid #ddd;border-radius:8px;h3{margin-top:0}label{display:block;margin:8px 0}input,select{max-width:100%}`;
const Row=styled.div`display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center;input{flex:1;min-width:150px}`;
const Text=styled.textarea`width:100%;min-height:70px;box-sizing:border-box;`;
/** Mounted with a project-id key: stale responses cannot initialize another project's form. */
export default function ProjectOperations({project}:{project:Project}) {
  const {locale}=useT();const text=(ko:string,en:string)=>locale==='ko'?ko:en;
  const q=useProjectOperationsQuery(project.id,{skip:!project.canOperate,refetchOnMountOrArgChange:true});
  const [save,{isLoading:saving}]=useSaveProjectOperationsMutation();
  const [draft,setDraft]=useState<OperationsRecord>(emptyOperations);
  const [revision,setRevision]=useState(0);const [dirty,setDirty]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);
  useEffect(()=>{if(q.currentData && !dirty && (q.currentData.record?.revision??0)>=revision){setDraft(editableOperations(q.currentData.record));setRevision(q.currentData.record?.revision??0);}},[q.currentData,dirty,revision]);
  const change=(next:OperationsRecord)=>{setDraft(next);setDirty(true);setSaved(false);};
  const editable=!!project.canManage&&!saving;
  const submit=async()=>{setError('');setSaved(false);try{const result=await save({id:project.id,expectedRevision:revision,record:{...draft,maintainers:draft.maintainers.map(s=>s.trim()).filter(Boolean)}}).unwrap();setDraft(editableOperations(result.record));setRevision(result.record!.revision);setDirty(false);setSaved(true);}catch(e){setError(projectApiErrorOf(e).message??text('저장하지 못했습니다. 입력을 보존했습니다.','Save failed. Your draft is preserved.'));}};
  if(q.isLoading)return <Section>{text('운영 기록을 읽고 있습니다.','Loading operational record…')}</Section>;
  if(q.error)return <Section><Alert $tone="error">{projectApiErrorOf(q.error).message??text('운영 기록을 읽지 못했습니다.','Unable to read the operational record.')}</Alert><Button onClick={()=>q.refetch()}>{text('다시 시도','Retry')}</Button></Section>;
  return <Section>
    <h2>{text('운영 인수인계','Operations handoff')}</h2>
    <p>{text('이전 원본, 담당자, 운영 절차와 검증 근거를 함께 관리합니다.','Keep migration origins, maintainers, procedures and verification evidence together.')}</p>
    <dl><dt>{text('소스 / 실행 커밋','Source / active commit')}</dt><dd>{q.currentData?.source.sourceCommit??'—'} / {q.currentData?.source.activeCommit??'—'}</dd><dt>{text('브랜치 / 빌드 폴더','Branch / build directory')}</dt><dd>{project.branch} / {q.currentData?.source.sourcePath||'/'}</dd></dl>
    <p>{text('검증 결과는 담당자가 등록한 기록입니다. 배포 상태와 별도로 확인하세요. 24시간이 지난 성공 기록은 재확인 대상으로 표시됩니다.','Results are recorded by maintainers, independently of deployment status. Successful results older than 24 hours are marked for rechecking.')}</p>
    {!!q.currentData?.verification.stale.length&&<Alert $tone="warning">{text('재확인 필요: ','Recheck: ')}{q.currentData.verification.stale.join(', ')}</Alert>}
    {!!q.currentData?.verification.pending.length&&<Alert $tone="warning">{text('미완료 필수 검사: ','Required checks outstanding: ')}{q.currentData.verification.pending.join(', ')}</Alert>}
    <fieldset disabled={!editable} style={{border:0,padding:0}}>
      <Section><h3>{text('이전 원본','Migration origins')}</h3>{draft.origins.map((o,i)=><Row key={i}>
        <Select aria-label={text('원본 서비스','Source provider')} value={o.provider} onChange={e=>change({...draft,origins:draft.origins.map((v,n)=>n===i?{...v,provider:e.target.value as typeof o.provider}:v)})}>{['gcp','firebase','aws','azure','onprem','other'].map(v=><option key={v}>{v}</option>)}</Select>
        <Input aria-label={text('원본 프로젝트 ID','Original project ID')} placeholder="Project ID" value={o.projectId} onChange={e=>change({...draft,origins:draft.origins.map((v,n)=>n===i?{...v,projectId:e.target.value}:v)})}/>
        <Input aria-label={text('원본 자원','Original resource')} placeholder={text('서비스 / 자원','Service / resource')} value={o.resource??''} onChange={e=>change({...draft,origins:draft.origins.map((v,n)=>n===i?{...v,resource:e.target.value||undefined}:v)})}/>
        <Button onClick={()=>change({...draft,origins:draft.origins.filter((_,n)=>n!==i)})}>{text('삭제','Remove')}</Button>
      </Row>)}<Button onClick={()=>change({...draft,origins:[...draft.origins,{provider:'gcp',projectId:''}]})}>{text('원본 추가','Add origin')}</Button></Section>
      <Section><h3>{text('운영 담당자','Maintainers')}</h3><label>{text('한 줄에 한 명씩 입력','One maintainer per line')}<Text value={draft.maintainers.join('\n')} onChange={e=>change({...draft,maintainers:e.target.value.split('\n')})}/></label></Section>
      <Section><h3>{text('운영 문서','Runbooks')}</h3>{(['deploy','rollback','backup','restore','logs','access','knowledgeRefresh'] as const).map(key=><label key={key}>{({deploy:text('배포','Deployment'),rollback:text('롤백','Rollback'),backup:text('백업','Backup'),restore:text('복구','Restore'),logs:text('로그','Logs'),access:text('접근 권한','Access'),knowledgeRefresh:text('지식 갱신','Knowledge refresh')})[key]}<Input type="url" placeholder="https://…" value={draft.runbooks[key]??''} onChange={e=>change({...draft,runbooks:{...draft.runbooks,[key]:e.target.value||undefined}})}/></label>)}</Section>
      <Section><h3>{text('의존 서비스','Dependencies')}</h3>{draft.dependencies.map((d,i)=><Row key={i}>
        <Input aria-label={text('의존 서비스 이름','Dependency name')} value={d.name} onChange={e=>change({...draft,dependencies:draft.dependencies.map((v,n)=>n===i?{...v,name:e.target.value}:v)})}/>
        <Select aria-label={text('전환 상태','Disposition')} value={d.disposition} onChange={e=>change({...draft,dependencies:draft.dependencies.map((v,n)=>n===i?{...v,disposition:e.target.value as typeof d.disposition}:v)})}>{(['unknown','retained','migrated','retired'] as const).map(v=><option key={v} value={v}>{({unknown:text('미확인','Unknown'),retained:text('유지','Retained'),migrated:text('이전','Migrated'),retired:text('종료','Retired')})[v]}</option>)}</Select>
        <Button onClick={()=>change({...draft,dependencies:draft.dependencies.filter((_,n)=>n!==i)})}>{text('삭제','Remove')}</Button>
      </Row>)}<Button onClick={()=>change({...draft,dependencies:[...draft.dependencies,{name:'',disposition:'unknown'}]})}>{text('의존 서비스 추가','Add dependency')}</Button></Section>
      <Section><h3>{text('비밀값 보관 위치','Secret locations')}</h3><p>{text('값 대신 환경변수 이름과 보관 위치만 입력하세요.','Enter environment variable names and storage locations, not secret values.')}</p>{draft.secretReferences.map((r,i)=><Row key={i}>
        <Input aria-label={text('환경변수 이름','Environment variable name')} value={r.name} onChange={e=>change({...draft,secretReferences:draft.secretReferences.map((v,n)=>n===i?{...v,name:e.target.value}:v)})}/>
        <Input aria-label={text('보관 위치','Storage location')} value={r.location} onChange={e=>change({...draft,secretReferences:draft.secretReferences.map((v,n)=>n===i?{...v,location:e.target.value}:v)})}/>
        <Button onClick={()=>change({...draft,secretReferences:draft.secretReferences.filter((_,n)=>n!==i)})}>{text('삭제','Remove')}</Button>
      </Row>)}<Button onClick={()=>change({...draft,secretReferences:[...draft.secretReferences,{name:'',location:''}]})}>{text('참조 추가','Add reference')}</Button></Section>
      <Section><h3>{text('검증 기록','Verification evidence')}</h3>{draft.checks.map((c,i)=>{
        const update=(fields:Partial<typeof c>)=>change({...draft,checks:draft.checks.map((v,n)=>n===i?{...v,...fields}:v)});
        return <Section key={i}><Row><Input aria-label={text('검사 ID','Check ID')} value={c.id} onChange={e=>update({id:e.target.value})}/><Input aria-label={text('검사 설명','Check description')} value={c.label} onChange={e=>update({label:e.target.value})}/></Row>
          <Row><Select aria-label={text('검사 유형','Check type')} value={c.kind} onChange={e=>update({kind:e.target.value as typeof c.kind})}>{['http','auth','data','restore','manual'].map(v=><option key={v}>{v}</option>)}</Select><label><input type="checkbox" checked={c.required} onChange={e=>update({required:e.target.checked})}/>{text('필수','Required')}</label><Select aria-label={text('검증 결과','Verification result')} value={c.status} onChange={e=>update({status:e.target.value as typeof c.status})}>{(['pending','passed','failed'] as const).map(v=><option value={v} key={v}>{({pending:text('미완료','Pending'),passed:text('성공','Passed'),failed:text('실패','Failed')})[v]}</option>)}</Select></Row>
          <label>{text('검증 근거 링크','Evidence link')}<Input type="url" value={c.evidence??''} onChange={e=>update({evidence:e.target.value||undefined})}/></label>
          <label>{text('검증 시각 (UTC, ISO 8601)','Verification time (UTC, ISO 8601)')}<Input placeholder="2026-11-03T12:00:00Z" value={c.verifiedAt??''} onChange={e=>update({verifiedAt:e.target.value||undefined})}/></label>
          <Button onClick={()=>change({...draft,checks:draft.checks.filter((_,n)=>n!==i)})}>{text('검사 삭제','Remove check')}</Button></Section>;
      })}<Button onClick={()=>change({...draft,checks:[...draft.checks,{id:'',label:'',kind:'manual',required:true,status:'pending'}]})}>{text('검사 추가','Add check')}</Button></Section>
    </fieldset>
    {error&&<Alert $tone="error">{error}</Alert>}{saved&&<Alert $tone="info">{text('저장했습니다.','Saved.')}</Alert>}
    {project.canManage&&<Row><Button variant="contained" loading={saving} disabled={!dirty} onClick={submit}>{text('운영 기록 저장','Save operational record')}</Button><Button disabled={!dirty||saving} onClick={()=>{if(window.confirm(text('저장하지 않은 변경을 버릴까요?','Discard unsaved changes?'))){setDirty(false);setError('');q.refetch();}}}>{text('변경 취소','Discard changes')}</Button></Row>}
  </Section>;
}
