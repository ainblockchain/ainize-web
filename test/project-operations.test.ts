import {test} from 'node:test';import assert from 'node:assert/strict';
import {editableOperations,emptyOperations} from '../src/api/projectOperations.ts';
test('editable records omit server-managed metadata and do not mutate query cache',()=>{
 const source={...emptyOperations(),origins:[{provider:'gcp' as const,projectId:'legacy'}],revision:4,updatedAt:123,updatedBy:'owner'};
 const draft=editableOperations(source);draft.origins[0]!.projectId='new';assert.equal(source.origins[0]!.projectId,'legacy');assert.equal('revision' in draft,false);assert.equal('updatedBy' in draft,false);
 assert.deepEqual(editableOperations(null),emptyOperations());
});
