import styled from 'styled-components';
import { useT, useLocale } from '@/i18n';

/**
 * The four accepted shapes of the same three questions, side by side and always visible (design §5.3) — the fastest
 * way to see that they are the same data. Field names are the canonical ones (§D8); the aliases line says what else
 * the parser accepts.
 */
const EXAMPLES = {
  en: [
    { prompt: 'Who founded Ainize?', answer: 'Comcom', alt: 'Which company is behind Ainize?' },
    { prompt: 'When did Ainize start?', answer: '2020' },
    { prompt: 'What does a lesson produce?', answer: 'A knowledge file' },
  ],
  ko: [
    { prompt: 'Ainize를 만든 곳은?', answer: 'Comcom', alt: 'Ainize는 어느 회사가 만들었나요?' },
    { prompt: 'Ainize는 언제 시작했나요?', answer: '2020' },
    { prompt: '수업이 만드는 것은?', answer: '지식 파일' },
  ],
};

const Grid = styled.div`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;
`;
const Box = styled.div`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px; background: #fff; overflow: hidden;
  h4 { margin: 0; padding: 8px 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${(p) => p.theme.color.PRIMARY}; background: ${(p) => p.theme.color.PALE_GREY}; }
  p { margin: 0; padding: 8px 12px; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; }
  pre { margin: 0; padding: 10px 12px; overflow-x: auto; font-family: ${(p) => p.theme.font.mono}; font-size: 11.5px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; background: #fafafa; }
`;
const Aliases = styled.p`margin: 10px 0 0; font-size: 12px; line-height: 1.55; color: ${(p) => p.theme.color.GREY};`;

export function FormatHelp() {
  const { t } = useT();
  const { locale } = useLocale();
  const rows = EXAMPLES[locale === 'ko' ? 'ko' : 'en'];
  const jsonl = rows.map((r) => JSON.stringify({ prompt: r.prompt, answer: r.answer, ...(r.alt ? { alt_prompt: r.alt } : {}) })).join('\n');
  const csv = ['prompt,answer,alt_prompt', ...rows.map((r) => `${r.prompt},${r.answer},${r.alt ?? ''}`)].join('\n');
  const tsv = rows.map((r) => [r.prompt, r.answer, r.alt ?? ''].join('\t')).join('\n');
  const txt = rows.map((r) => `Q: ${r.prompt}\nA: ${r.answer}`).join('\n\n');
  const blocks: { name: string; help: string; body: string }[] = [
    { name: '.jsonl', help: t('teach.up.help_jsonl'), body: jsonl },
    { name: '.csv', help: t('teach.up.help_csv'), body: csv },
    { name: '.tsv', help: t('teach.up.help_tsv'), body: tsv },
    { name: '.txt', help: t('teach.up.help_txt'), body: txt },
  ];
  return (
    <section aria-label={t('teach.up.help_title')} data-testid="format-help">
      <Grid>
        {blocks.map((b) => (
          <Box key={b.name}>
            <h4>{b.name}</h4>
            <p>{b.help}</p>
            <pre>{b.body}</pre>
          </Box>
        ))}
      </Grid>
      <Aliases>{t('teach.up.help_columns')}</Aliases>
    </section>
  );
}
