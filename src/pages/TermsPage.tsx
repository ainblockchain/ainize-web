import styled from 'styled-components';
import { PageWrapper, Title } from '@/components/ui/Misc';
import { useT } from '@/i18n';

/** Layout ported from ainize-web TermsAndPolicyPage.js; content in plain language via i18n (see i18n/pages/public.ts). */
const Section = styled.section`
  margin-top: 40px;
  h2 { margin: 0 0 12px; font-size: 20px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  h3 { margin: 20px 0 8px; font-size: 15px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p, li { font-size: 14px; line-height: 1.7; color: ${(p) => p.theme.color.DARK_GREY}; max-width: 78ch; word-break: keep-all; }
  p { margin: 0 0 10px; }
  ul { padding-left: 22px; margin: 8px 0; }
  a { color: ${(p) => p.theme.color.PRIMARY}; }
`;
const Updated = styled.p`
  margin: 12px 0 0; font-size: 12px; color: ${(p) => p.theme.color.GREY};
`;

/** Renders a dictionary value that may contain '\n' as several paragraphs. */
function Paragraphs({ text }: { text: string }) {
  return <>{text.split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}</>;
}

export default function TermsPage() {
  const { t } = useT();
  return (
    <PageWrapper>
      <Title>{t('terms.title')}</Title>
      <Updated>{t('terms.updated')}</Updated>

      <Section>
        <h2>{t('terms.s1.title')}</h2>
        <Paragraphs text={t('terms.s1.p1')} />
      </Section>

      <Section>
        <h2>{t('terms.s2.title')}</h2>
        <h3>{t('terms.s2.h1')}</h3>
        <Paragraphs text={t('terms.s2.p1')} />
        <h3>{t('terms.s2.h2')}</h3>
        <Paragraphs text={t('terms.s2.p2')} />
        <h3>{t('terms.s2.h3')}</h3>
        <Paragraphs text={t('terms.s2.p3')} />
        <h3>{t('terms.s2.h4')}</h3>
        <Paragraphs text={t('terms.s2.p4')} />
        <h3>{t('terms.s2.h5')}</h3>
        <ul>
          {t('terms.s2.list').split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
        </ul>
        <h3>{t('terms.s2.h6')}</h3>
        <Paragraphs text={t('terms.s2.p6')} />
      </Section>

      <Section>
        <h2>{t('terms.s3.title')}</h2>
        <h3>{t('terms.s3.h1')}</h3>
        <Paragraphs text={t('terms.s3.p1')} />
        <h3>{t('terms.s3.h2')}</h3>
        <Paragraphs text={t('terms.s3.p2')} />
        <h3>{t('terms.s3.h3')}</h3>
        <Paragraphs text={t('terms.s3.p3')} />
        <h3>{t('terms.s3.h4')}</h3>
        <Paragraphs text={t('terms.s3.p4')} />
      </Section>

      <Section>
        <h2>{t('terms.s4.title')}</h2>
        <p>{t('terms.s4.p1')} <a href="mailto:support@ainize.ai?subject=[Ainize] ">support@ainize.ai</a></p>
      </Section>
    </PageWrapper>
  );
}
