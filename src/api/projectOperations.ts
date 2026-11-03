export type OperationsRecord = {
  origins: {provider:'gcp'|'firebase'|'aws'|'azure'|'onprem'|'other';projectId:string;resource?:string}[];
  maintainers:string[];
  inventory?:{name:string;location:string;process?:string;runtime?:string;resources?:string;configLocation?:string;adminUrl?:string}[];
  dependencies:{name:string;reference?:string;disposition:'retained'|'migrated'|'retired'|'unknown'}[];
  runbooks:Partial<Record<'deploy'|'rollback'|'backup'|'restore'|'logs'|'access'|'knowledgeRefresh',string>>;
  secretReferences:{name:string;location:string;expiresAt?:string;rotation?:string;purpose?:'authentication'|'encryption'|'restore'}[];
  checks:{id:string;label:string;kind:'http'|'auth'|'data'|'restore'|'manual';required:boolean;status:'pending'|'passed'|'failed';evidence?:string;verifiedAt?:string}[];
};
export type OperationsView = {
  projectId:string;name:string;org:string;repoName:string;sourcePath:string; source:{repo:string;upstreamRepo:string|null;branch:string;sourcePath:string;sourceCommit:string|null;activeCommit:string|null};
  deploymentStatus:string;observedAt:number;
  record:(OperationsRecord & {revision:number;updatedAt:number;updatedBy:string})|null;
  verification:{expiredSecrets?:string[];mode:string;required:number;pending:string[];stale:string[];unknownDependencies:string[]};
};
export const emptyOperations = ():OperationsRecord => ({origins:[],maintainers:[],dependencies:[],runbooks:{},secretReferences:[],checks:[]});
export function editableOperations(record:OperationsView['record']):OperationsRecord {
  if(!record)return emptyOperations();
  const {origins,maintainers,dependencies,runbooks,secretReferences,checks,inventory}=record;
  return structuredClone({origins,maintainers,dependencies,runbooks,secretReferences,checks,...(inventory?{inventory}: {})});
}
