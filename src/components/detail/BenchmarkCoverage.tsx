import { useT } from '@/i18n';
import { benchmarkCoverage, benchmarkQuestionCount } from '@/lib/benchmarkQuestions';
import { num } from '@/utils/format';

export function BenchmarkCoverage({ score, tested, questions }: { score: number; tested: number | null; questions: unknown }) {
  const { t } = useT();
  const coverage = benchmarkCoverage(tested, questions);
  const key = { declared: 'detail.ov.accuracy_line', measured: 'detail.ov.accuracy_line_measured', unknown: 'detail.ov.accuracy_line_unknown' }[coverage];
  return <span data-testid="benchmark-coverage" data-coverage={coverage}>{t(key, { score: `${score}%`, tested: num(tested), facts: num(benchmarkQuestionCount(questions)) })}</span>;
}
