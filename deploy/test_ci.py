import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('ci.sh').resolve()

class GateTests(unittest.TestCase):
    def test_failure_blocks_build_and_a_corrective_commit_has_fresh_status(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / 'source'; source.mkdir()
            (source / 'deploy').mkdir()
            for name in ('verify-release.mjs','verify-release.test.mjs'):
                (source / 'deploy' / name).write_bytes(SCRIPT.with_name(name).read_bytes())
            (source / 'dist').mkdir(); (source / 'dist/bin.js').write_text('test fixture')
            bin_dir = root / 'bin'; bin_dir.mkdir()
            npm = bin_dir / 'npm'
            npm.write_text('#!/bin/sh\necho "$*" >> "$TEST_CALLS"\nif [ "$FAIL_TEST" = 1 ] && [ "$1 $2" = "run test" ]; then echo test-failure; exit 9; fi\n')
            npm.chmod(0o755)
            env = {**os.environ, 'PATH': str(bin_dir) + ':' + os.environ['PATH'], 'AINIZE_CI_STATE_DIR': str(root / 'state'),
                   'TEST_CALLS': str(root / 'calls'), 'FAIL_TEST': '1'}
            events = root / 'run-stages.jsonl'
            reporter = root / 'reporter.py'
            reporter.write_text("import json, os, sys\nwith open(os.environ['TEST_STAGE_EVENTS'],'a') as out: print(json.dumps(sys.argv[1:]),file=out)\n")
            env.update(AINIZE_CI_RUN_ID='run_'+'1'*16, AINIZE_HOST_RELEASE_STAGE_REPORTER=str(reporter), TEST_STAGE_EVENTS=str(events))
            result = subprocess.run(['bash', str(SCRIPT), str(source), 'a' * 40], env=env)
            self.assertEqual(result.returncode, 9)
            record = json.loads((root / 'state/status.json').read_text())
            self.assertEqual((record['sha'], record['stage'], record['status']), ('a' * 40, 'test', 'failed'))
            self.assertNotIn('run build', (root / 'calls').read_text())
            self.assertIn('test-failure', (root / 'state' / ('a' * 40 + '.log')).read_text())
            stages = [json.loads(line) for line in events.read_text().splitlines()]
            self.assertEqual(stages[-1][:4], [env['AINIZE_CI_RUN_ID'], 'a'*40, 'test', 'failed'])
            self.assertEqual(stages[-1][-1], str(result.returncode))
            self.assertTrue(any(row[2:4] == ['typecheck','success'] for row in stages))
            env['FAIL_TEST'] = '0'
            result = subprocess.run(['bash', str(SCRIPT), str(source), 'b' * 40], env=env)
            self.assertEqual(result.returncode, 0)
            record = json.loads((root / 'state/status.json').read_text())
            self.assertEqual((record['sha'], record['stage'], record['status']), ('b' * 40, 'complete', 'success'))
            self.assertTrue((root / 'state' / ('a' * 40 + '.log')).exists())

if __name__ == '__main__':
    unittest.main()
