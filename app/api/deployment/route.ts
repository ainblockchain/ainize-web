import {NextResponse} from 'next/server';
import {NODE_URL} from '../../../src/lib/node-url';
import {deploymentStatus} from '../../../src/lib/deploymentStatus';
export const dynamic='force-dynamic';
export async function GET(){
 return NextResponse.json(await deploymentStatus(process.env.AINIZE_WEB_COMMIT,NODE_URL),{headers:{'cache-control':'no-store'}});
}
