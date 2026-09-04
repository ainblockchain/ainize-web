import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useLoginMutation, useMeQuery, useSetupMutation } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Alert, Checkbox, TextField } from '@/components/ui/Form';
import { CopyButton, Description, KeyValue, Mono, PageWrapper, Title } from '@/components/ui/Misc';
import { Muted, Stack, Tip } from '@/components/operator/common';

/** ainize SigningPage: 32px title, description, options block, 196px purple confirm button. */
const OptionContainer = styled.div`margin-top: 40px; max-width: 420px;`;
const CheckOption = styled.div`display: flex; align-items: center; margin-top: 8px;`;
const StyledLink = styled(Link)`color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { border-bottom: 1px solid #8b3eeb; }`;
const ConfirmButton = styled.button`
  width: 196px; height: 44px; margin-top: 32px; border: 0; border-radius: 4px; background: ${(p) => p.theme.color.PRIMARY}; color: #fff;
  font-size: 16px; font-weight: 500; cursor: pointer; transition: background 0.2s ease;
  &:hover { background: ${(p) => p.theme.color.HOVER}; } &:disabled { background: ${(p) => p.theme.color.PRESSED}; cursor: not-allowed; }
`;
/** Visitors land here by mistake (old bookmarks, the operator link on the landing page): tell them teaching / testing needs no sign-in (spec §5.2). */
const VisitorNotice = styled.div`
  margin-top: 28px; padding: 14px 18px; max-width: 560px; border: 1px solid #e4ddff; border-radius: 6px; background: #faf7ff; font-size: 14px; line-height: 1.6; color: #333; word-break: keep-all;
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px;
`;
const VisitorCta = styled(Link)`
  font-weight: 700; color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; white-space: nowrap; &:hover { text-decoration: underline; }
`;
const SubTitleText = styled.p`margin: 6px 0 0; font-size: 14px; color: #8d8d8f;`;
/** Finding 71: the invited person could not fill this field because nothing said where the password comes from. */
const Hint = styled.p`
  margin: 12px 0 0; font-size: 13px; line-height: 1.7; color: ${(p) => p.theme.color.GREY}; word-break: keep-all;
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 12.5px; background: #f4f4f5; border-radius: 3px; padding: 1px 5px; color: ${(p) => p.theme.color.BLACK}; }
`;
const NodeBox = styled.div`
  margin-top: 40px; padding: 16px 20px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fafafa; max-width: 560px;
`;

export default function SigningPage() {
  const { t, tech, locale } = useT();
  useTitle(t('nav.signin'));
  const auth = useAuth();
  const { data: me } = useMeQuery();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next') || '/dashboard';
  const [setup, setupState] = useSetupMutation();
  const [login, loginState] = useLoginMutation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => { if (!auth.loading && auth.isSignedIn) navigate(next, { replace: true }); }, [auth.loading, auth.isSignedIn, navigate, next]);

  const onSetup = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (password.length < 4) return setLocalError(t('op.sign.err.short'));
    if (password !== confirm) return setLocalError(t('op.sign.err.mismatch'));
    if (!terms) return setLocalError(t('op.sign.err.terms'));
    try { await setup({ password }).unwrap(); auth.refresh(); navigate(next, { replace: true }); } catch { /* shown below */ }
  };
  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try { await login({ password }).unwrap(); auth.refresh(); navigate(next, { replace: true }); } catch { /* shown below */ }
  };

  const busy = setupState.isLoading || loginState.isLoading;
  /*
   * Finding 89: the node answers a bad password with `HttpError(401, 'wrong password')`, and this page used to print
   * that string verbatim — lowercase, English even for a Korean reader, and with no way out for somebody who has
   * genuinely forgotten it. 401 is the one status this form can explain better than the server can, so it gets the
   * translated sentence and the command that actually recovers the node (`ainize password --reset`); anything else
   * still shows what the server said, which is the only honest thing to do with an error nobody anticipated.
   */
  const signInError = (e: unknown): string =>
    ((e as { status?: number | string } | null | undefined)?.status === 401 ? t('op.sign.err.wrong') : errorMessage(e));
  const err = localError ?? (setupState.error ? signInError(setupState.error) : loginState.error ? signInError(loginState.error) : null);
  // The Korean docs slugify their own headings, so the anchor differs by language: `## 5. Log in` → `#5-log-in`,
  // `## 5. 로그인` → `#5-로그인` (components/docs/markdown.ts, slugify keeps \p{L}).
  const loginDocs = locale === 'ko' ? '/docs/ko/get-started/quickstart#5-로그인' : '/docs/get-started/quickstart#5-log-in';
  const roleLabel = (r: string) => { const k = `op.role.${r}`; const v = t(k); return v === k ? r : v; };
  // Korean puts the particle straight onto the command (`ainize login`을) where English needs a space after it, so
  // the sentence carries the command as a placeholder and is split around it — the same trick as op.sign.agree below.
  const [whereBefore, whereAfter] = t('op.sign.login.where', { cmd: '|' }).split('|');
  // "{terms}에 동의합니다 (필수)" → split around the placeholder so the link stays a real <Link>.
  const [agreeBefore, agreeAfter] = t('op.sign.agree', { terms: '|' }).split('|');

  return (
    <PageWrapper>
      {auth.needsSetup ? (
        <form onSubmit={onSetup}>
          <Title>{t('op.sign.setup.title')}</Title>
          <Description>{t('op.sign.setup.desc')}</Description>
          <OptionContainer>
            <Stack $gap={18}>
              <TextField type="password" label={t('op.sign.password')} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <TextField type="password" label={t('op.sign.confirm')} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Stack>
            <CheckOption>
              <Checkbox checked={terms} onChange={(e) => setTerms(e.target.checked)} label={<span>{agreeBefore}<StyledLink to="/terms">{t('op.sign.terms')}</StyledLink>{agreeAfter}</span>} />
            </CheckOption>
            {err && <Alert $tone="error" style={{ marginTop: 16 }}>{err}</Alert>}
            <ConfirmButton type="submit" disabled={busy}>{busy ? t('op.saving') : t('common.confirm')}</ConfirmButton>
          </OptionContainer>
        </form>
      ) : (
        <form onSubmit={onLogin}>
          <Title>{t('op.sign.login.title')}</Title>
          <SubTitleText data-testid="sign-subtitle">{t('op.sign.login.subtitle')}</SubTitleText>
          <Description>{t('op.sign.login.desc')}</Description>
          <OptionContainer>
            <TextField type="password" label={t('op.sign.login.password')} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
            <Hint data-testid="password-origin">
              {whereBefore}<code>ainize login</code>{whereAfter}{' '}
              <StyledLink to={loginDocs}>{t('op.sign.login.where_link')} →</StyledLink>
            </Hint>
            {err && <Alert $tone="error" role="alert" style={{ marginTop: 16 }}>{err}</Alert>}
            <ConfirmButton type="submit" disabled={busy}>{busy ? t('op.sign.login.busy') : t('op.sign.login.button')}</ConfirmButton>
          </OptionContainer>
        </form>
      )}

      <VisitorNotice role="note" data-testid="visitor-notice">
        <span>{t('op.sign.visitor_notice')}</span>
        <VisitorCta to="/chat">{t('op.sign.visitor_cta')} →</VisitorCta>
      </VisitorNotice>

      {me && (
        <NodeBox>
          <strong style={{ fontSize: 14 }}>{t('op.sign.node.title')}</strong>
          <KeyValue>
            <dt>{t('op.name')}</dt><dd>{me.name}</dd>
            <dt><Tip tech={tech('node')}>{t('op.address')}</Tip></dt><dd><Mono>{me.address}</Mono> <CopyButton text={me.address} label={t('common.copy')} /></dd>
            <dt>{t('op.roles')}</dt><dd>{me.roles.map(roleLabel).join(', ')}</dd>
          </KeyValue>
          <Muted style={{ display: 'block', marginTop: 12 }} title={t('op.tech.keypair')}>{t('op.sign.node.identity_note')}</Muted>
        </NodeBox>
      )}
    </PageWrapper>
  );
}
