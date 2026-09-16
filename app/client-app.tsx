'use client';

/**
 * The existing application, loaded in the browser only.
 *
 * `ssr: false` needs a client component to live in — Next refuses it in a server one, and rightly: the choice
 * is about where a subtree runs, and a server component cannot make it for code it never executes.
 */
import dynamic from 'next/dynamic';
import { CenterProgress } from '@/components/ui/Misc';

const App = dynamic(() => import('@/App'), { ssr: false, loading: () => <CenterProgress /> });

export default function ClientApp() {
  return <App />;
}
