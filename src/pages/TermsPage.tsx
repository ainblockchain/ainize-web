import styled from 'styled-components';
import { PageWrapper, Title } from '@/components/ui/Misc';

/** Layout ported from ainize-web TermsAndPolicyPage.js, content adapted to a P2P knowledge marketplace. */
const Section = styled.section`
  margin-top: 40px;
  h2 { margin: 0 0 12px; font-size: 20px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  h3 { margin: 20px 0 8px; font-size: 15px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p, li { font-size: 14px; line-height: 1.7; color: ${(p) => p.theme.color.DARK_GREY}; max-width: 78ch; }
  ul { padding-left: 22px; margin: 8px 0; }
`;
const Updated = styled.p`
  margin: 12px 0 0; font-size: 12px; color: ${(p) => p.theme.color.GREY};
`;

export default function TermsPage() {
  return (
    <PageWrapper>
      <Title>Terms and Policies</Title>
      <Updated>Last updated: August 31, 2026</Updated>

      <Section>
        <h2>1. What this service is</h2>
        <p>
          Knowledge Market is peer-to-peer software. Every participant runs their own node. A node publishes, verifies,
          serves, buys and applies <b>knowledge patches</b> — sets of rows (address, value-before, value-after) of a language
          model's n-gram conditional-memory table together with a benchmark that describes what the rows are supposed to
          make the model know. There is no central operator, no hosted account and no custody of funds: the web console you
          are looking at is served by one node and only speaks for that node.
        </p>
      </Section>

      <Section>
        <h2>2. Terms of use</h2>
        <h3>2.1 Node identity</h3>
        <p>
          A node is identified by an AI Network (AIN) key pair. The operator of a node is solely responsible for keeping the
          private key safe. Signatures made with the key — ledger records, attestations, payment intents, blob requests —
          are binding for that node.
        </p>
        <h3>2.2 Patches are software artifacts</h3>
        <p>
          A patch is a data artifact, not advice. Publishing a patch means asserting that it was produced from the recipe and
          benchmark attached to its anchor. Buying a patch grants a license to apply its rows to the identified model on your
          own infrastructure under the license stated in the anchor (default: use on the identified model, no resale of the
          raw rows). Derived patches inherit the lineage recorded on the ledger; royalties are split along that lineage.
        </p>
        <h3>2.3 Verification is best-effort</h3>
        <p>
          Attestations are published by independent verifier nodes that stake a bond. An attestation records the engine it
          was measured on (<code>verified_on</code>). Attestations marked <code>hash-only</code> only confirm integrity of the
          body (sha256, row count) — they do <b>not</b> confirm benchmark scores. Quorum listing does not guarantee that a
          patch is correct, safe or free of side effects on unrelated inputs; buyers should re-verify with their own
          benchmark before applying to production serving.
        </p>
        <h3>2.4 Payments</h3>
        <p>
          Trades use HTTP 402 (x402). On the AIN ledger a payment is an on-chain AIN transfer and is final once executed;
          on the local ledger "credits" are development money with no value. The seller node settles a trade only after
          it can verify the payment; refunds are at the seller's discretion and are not mediated by the protocol.
        </p>
        <h3>2.5 Prohibited use</h3>
        <ul>
          <li>Publishing patches whose rows were extracted from someone else's patch without lineage (plagiarism is detectable via address-set sketches and may be challenged).</li>
          <li>Publishing benchmarks whose sealed answers do not match the revealed answers.</li>
          <li>Attesting scores that were not measured.</li>
          <li>Using the network to distribute content that is unlawful in your jurisdiction.</li>
        </ul>
        <h3>2.6 No warranty</h3>
        <p>
          The software is provided "as is", without warranty of any kind. Node operators, verifiers and authors are
          independent parties; none of them is liable to the others for indirect or consequential damages arising from the
          use of a patch.
        </p>
      </Section>

      <Section>
        <h2>3. Privacy policy</h2>
        <h3>3.1 What a node stores about you</h3>
        <p>
          This node does not collect names, e-mail addresses or analytics identifiers. What it stores is what the protocol
          needs: node addresses (public keys), endpoints, signed ledger records, payment proofs (AIN transaction hashes or
          signed credit intents) and download tokens. All of it is pseudonymous and most of it is public by design — it is
          replicated to peers and, on the AIN ledger, written to a blockchain that cannot be edited afterwards.
        </p>
        <h3>3.2 Operator console</h3>
        <p>
          Signing in to the operator console sets a session cookie on this node only. The operator password is stored as a
          scrypt hash in the node's configuration file. No third-party cookies are used.
        </p>
        <h3>3.3 Files and change history</h3>
        <p>
          When the operator connects the node's folder to an aindrive drive, files under that folder (manifests, benchmarks,
          change logs and patch bodies) become accessible according to the sharing rules the operator configures there.
          aindrive's own terms apply to that service.
        </p>
        <h3>3.4 Your rights</h3>
        <p>
          You can stop your node at any time and delete its data directory. Records that were already replicated to peers or
          anchored on a blockchain cannot be recalled; that is a property of the protocol, not a choice of any operator.
        </p>
      </Section>

      <Section>
        <h2>4. Contact</h2>
        <p>Questions about these terms: <a href="mailto:support@ainize.ai?subject=[Knowledge Market] ">support@ainize.ai</a>.</p>
      </Section>
    </PageWrapper>
  );
}
