import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useLoginMutation, useMeQuery, useSetupMutation } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { Alert, Checkbox, TextField } from '@/components/ui/Form';
import { CopyButton, Description, KeyValue, Mono, PageWrapper, Title } from '@/components/ui/Misc';
import { Stack } from '@/components/operator/common';

/** ainize SigningPage: 32px title, description, options block, 196px purple confirm button. */
const OptionContainer = styled.div`margin-top: 40px; max-width: 420px;`;
const CheckOption = styled.div`display: flex; align-items: center; margin-top: 8px;`;
const StyledLink = styled(Link)`color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { border-bottom: 1px solid #8b3eeb; }`;
const ConfirmButton = styled.button`
  width: 196px; height: 44px; margin-top: 32px; border: 0; border-radius: 4px; background: ${(p) => p.theme.color.PRIMARY}; color: #fff;
  font-size: 16px; font-weight: 500; cursor: pointer; transition: background 0.2s ease;
  &:hover { background: ${(p) => p.theme.color.HOVER}; } &:disabled { background: ${(p) => p.theme.color.PRESSED}; cursor: not-allowed; }
`;
const NodeBox = styled.div`
  margin-top: 40px; padding: 16px 20px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fafafa; max-width: 560px;
`;

export default function SigningPage() {
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
    if (password.length < 4) return setLocalError('Password must be at least 4 characters.');
    if (password !== confirm) return setLocalError('Passwords do not match.');
    if (!terms) return setLocalError('Please agree to the Terms and Policies.');
    try { await setup({ password }).unwrap(); auth.refresh(); navigate(next, { replace: true }); } catch { /* shown below */ }
  };
  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try { await login({ password }).unwrap(); auth.refresh(); navigate(next, { replace: true }); } catch { /* shown below */ }
  };

  const busy = setupState.isLoading || loginState.isLoading;
  const err = localError ?? (setupState.error ? errorMessage(setupState.error) : loginState.error ? errorMessage(loginState.error) : null);

  return (
    <PageWrapper>
      {auth.needsSetup ? (
        <form onSubmit={onSetup}>
          <Title>Set operator password</Title>
          <Description>
            This node has no operator password yet. The operator console lets you publish patches, verify, buy and manage branches on behalf of this node&apos;s identity.
            One node = one operator identity (an AIN address); the password only protects this web console.
          </Description>
          <OptionContainer>
            <Stack $gap={18}>
              <TextField type="password" label="Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <TextField type="password" label="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Stack>
            <CheckOption>
              <Checkbox checked={terms} onChange={(e) => setTerms(e.target.checked)} label={<span>I agree to the <StyledLink to="/terms">Terms and Policies</StyledLink> (Required)</span>} />
            </CheckOption>
            {err && <Alert $tone="error" style={{ marginTop: 16 }}>{err}</Alert>}
            <ConfirmButton type="submit" disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</ConfirmButton>
          </OptionContainer>
        </form>
      ) : (
        <form onSubmit={onLogin}>
          <Title>Sign in to your node</Title>
          <Description>
            Enter the operator password of this node. Signing in unlocks the dashboard: publishing knowledge patches, running verifications, buying with x402, and branch subscriptions.
          </Description>
          <OptionContainer>
            <TextField type="password" label="Operator password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
            {err && <Alert $tone="error" style={{ marginTop: 16 }}>{err}</Alert>}
            <ConfirmButton type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</ConfirmButton>
          </OptionContainer>
        </form>
      )}

      {me && (
        <NodeBox>
          <strong style={{ fontSize: 14 }}>This node</strong>
          <KeyValue>
            <dt>Name</dt><dd>{me.name}</dd>
            <dt>Identity</dt><dd><Mono>{me.address}</Mono> <CopyButton text={me.address} label="Copy" /></dd>
            <dt>Roles</dt><dd>{me.roles.join(', ')}</dd>
          </KeyValue>
          <Description style={{ marginTop: 12 }}>
            The identity is a secp256k1 key pair — the same account type as the AI Network blockchain. Every ledger record, attestation and x402 payment this node makes is signed with it.
          </Description>
        </NodeBox>
      )}
    </PageWrapper>
  );
}
