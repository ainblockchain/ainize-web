/**
 * The hero diagram's geometry — every node, every edge, and nothing else.
 *
 * It is split from `HeroGraph.tsx` so it imports no styled-components and no theme: a pure function of nothing,
 * which is what lets `test/heroGraph.test.ts` render it under plain node and count what is actually drawn
 * rather than pattern-match the source. Both hero instances (wide, and the phone's crop) render THIS, so there
 * is exactly one geometry and the two can never disagree.
 *
 * The rules every stroke here is under are in HeroGraph.tsx's header. Read them before moving anything.
 */
/* ── palette: five inks, every one already on this page ─────────────────────────────────────────────── */
const WORK = '#ffffff';      // files, people, model outlines, delivery, apply
const EDGE = '#b6b6c0';      // a declared source, row ticks, hatch, padlock
const MONEY = '#8c6cff';     // the buy arc, the payouts, the sale ring — same purple as the primary button
const KEPT = '#e4ddff';      // what the seller keeps
const PASS = '#44a45f';      // a check that passed
const ASK = '#7fd4e8';       // a question running through the row layer — never money, never a check

const FILE_W = 40;
const FILE_H = 50;

/** One knowledge: a 40×50 file with a dog-ear and three interior rows (addrs / before / after in the .npz). */
function KnowledgeFile({ x, y, dashed = false }: { x: number; y: number; dashed?: boolean }) {
  return (
    <g opacity={dashed ? 0.55 : 1}>
      <path
        d={`M${x} ${y}h28l12 12v34a4 4 0 0 1-4 4H${x + 4}a4 4 0 0 1-4-4V${y + 4}a4 4 0 0 1 4-4Z`}
        fill="none" stroke={WORK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        {...(dashed ? { strokeDasharray: '5 4' } : {})}
      />
      <path d={`M${x + 28} ${y}v12h12`} fill="none" stroke={WORK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${x + 9} ${y + 22}h20M${x + 9} ${y + 30}h20M${x + 9} ${y + 38}h12`}
        stroke={EDGE} strokeWidth={1.2} opacity={0.6} strokeLinecap="round" />
    </g>
  );
}

/** Two ticks above a file: the quorum, which is two — and counted over model servers, not addresses. */
function Stamps({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={PASS} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.75}>
      <path d={`M${x} ${y} l2.2 2.6 l4.6 -5.4`} />
      <path d={`M${x + 9} ${y + 1} l2 2.4 l4.3 -5`} />
    </g>
  );
}

/**
 * A person. The buyer gets exactly this mark too — no size privilege, no colour privilege: a buyer here is a
 * node operator, and today's buyer is tomorrow's author.
 */
function Person({ x, y, r = 6 }: { x: number; y: number; r?: number }) {
  return (
    <g stroke={WORK} strokeWidth={2.6} fill="none" strokeLinecap="round">
      <circle cx={x} cy={y} r={r} />
      <path d={`M${x - 12} ${y + 20} a12 12 0 0 1 24 0`} />
    </g>
  );
}

/** The hairline from a person to the file they authored. No arrowhead: authorship is a claim, not a flow. */
function Authored({ from, to }: { from: [number, number]; to: [number, number] }) {
  return <path d={`M${from[0]} ${from[1]} L${to[0]} ${to[1]}`} stroke={WORK} strokeWidth={1.2} opacity={0.28} />;
}

/**
 * "Names that one as its source" — solid, grey, and ending in an open ring ON the parent. The ring is the
 * whole point: nothing travels down this edge, so it must not end in an arrowhead.
 */
function Declares({ d, socket }: { d: string; socket: [number, number] }) {
  return (
    <g>
      <path d={d} fill="none" stroke={EDGE} strokeWidth={2} strokeLinecap="round" />
      <circle cx={socket[0]} cy={socket[1]} r={4} fill="#333333" stroke={EDGE} strokeWidth={2} />
    </g>
  );
}

/** The scene. Both the wide and the compact hero render THIS — one geometry, two windows onto it. */
export function HeroScene() {
  return (
    <>
      <defs>
        {/* the writable layer: one memory row per tick, and the strip runs off the frame in both models */}
        <pattern id="hg-rows" width={9} height={74} patternUnits="userSpaceOnUse">
          <path d="M0 4V70" stroke={EDGE} strokeWidth={1} opacity={0.18} />
        </pattern>
        {/* the base checkpoint: hatched, locked, and permanently empty */}
        <pattern id="hg-hatch" width={8} height={8} patternUnits="userSpaceOnUse">
          <path d="M-2 6 L6 -2 M0 10 L10 0" stroke={EDGE} strokeWidth={1} opacity={0.2} />
        </pattern>
        <marker id="hg-paid" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
          <path d="M0 1 L9 5 L0 9 z" fill={MONEY} />
        </marker>
        <marker id="hg-owed" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
          <path d="M1 1.5 L8.5 5 L1 8.5" fill="none" stroke={MONEY} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <marker id="hg-deliver" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
          <path d="M1 1.5 L8.5 5 L1 8.5" fill="none" stroke={WORK} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {/* ── the two serving models. Both bleed off the frame: one model per node, each bigger than the picture,
             and there is no single global brain anywhere in this product. */}
      <g>
        <path d="M-40 412 H388 a12 12 0 0 1 12 12 V494 a12 12 0 0 1-12 12 H-40" fill="none" stroke={WORK} strokeWidth={1.6} opacity={0.55} />
        <rect x={-40} y={412} width={440} height={52} fill="url(#hg-rows)" shapeRendering="crispEdges" />
        <path d="M-40 464 H400" stroke={WORK} strokeWidth={1.4} opacity={0.45} />
        <rect x={-40} y={464} width={440} height={30} fill="url(#hg-hatch)" />
        {/* the padlock on the base: nothing in this product ever writes here */}
        <g stroke={EDGE} strokeWidth={1.4} fill="none" opacity={0.6}>
          <rect x={52} y={472} width={12} height={10} rx={2} />
          <path d="M55 472v-3a3 3 0 0 1 6 0v3" />
        </g>
        {/*
          Three people's rows, in three places.
          A knowledge is a list of ROW ADDRESSES (`addrs: int64[N]` in the .npz) plus what those rows should hold.
          So a patch does not tint the model — it owns particular rows, and a different author owns different ones.
          Drawing them as three separate clusters rather than one lit band is the whole point of the pass below:
          when an answer uses them, you can see WHOSE rows it used.
        */}
        <g stroke={WORK} strokeLinecap="round" className="hg-rows-a">
          <path d="M172 422V456" strokeWidth={2.2} />
          <path d="M180 422V456" strokeWidth={1.6} opacity={0.75} />
        </g>
        <g stroke={WORK} strokeLinecap="round" className="hg-rows-b">
          <path d="M284 422V456" strokeWidth={2.2} />
          <path d="M292 422V456" strokeWidth={1.6} opacity={0.75} />
        </g>
        <g stroke={WORK} strokeLinecap="round" className="hg-rows-c">
          <path d="M368 422V456" strokeWidth={2.2} />
          <path d="M376 422V456" strokeWidth={1.6} opacity={0.75} />
        </g>
        {/*
          The question sweeping the table, and the answer leaving with it.
          It runs along the ROW layer and never enters the slab below: the checkpoint is frozen, and an answer
          that used three people's knowledge used their ROWS, not their weights. The sweep is the only thing in
          the drawing that says "this is running right now" — everything else is a still diagram.
        */}
        <g className="hg-ask">
          <path d="M-30 439 H380" stroke={ASK} strokeWidth={1.6} opacity={0.9} strokeLinecap="round" />
          <circle cx={380} cy={439} r={3.4} fill={ASK} />
        </g>
      </g>
      <g>
        <path d="M940 412 H604 a12 12 0 0 0-12 12 V494 a12 12 0 0 0 12 12 H940" fill="none" stroke={WORK} strokeWidth={1.6} opacity={0.55} />
        <rect x={592} y={412} width={348} height={52} fill="url(#hg-rows)" shapeRendering="crispEdges" />
        <path d="M592 464 H940" stroke={WORK} strokeWidth={1.4} opacity={0.45} />
        <rect x={592} y={464} width={348} height={30} fill="url(#hg-hatch)" />
        <g stroke={EDGE} strokeWidth={1.4} fill="none" opacity={0.6}>
          <rect x={866} y={472} width={12} height={10} rx={2} />
          <path d="M869 472v-3a3 3 0 0 1 6 0v3" />
        </g>
        {/* the same knowledge, now on the buyer's own model: the two strips are different machines */}
        <g stroke={WORK} strokeWidth={2.2} opacity={0.9} strokeLinecap="round">
          <path d="M749 422V456" />
          <path d="M758 422V456" />
        </g>
      </g>

      {/* ── who names whom. KA has TWO children: one knowledge, two people taking it different ways. */}
      <Declares d="M196 158 C168 168 140 180 112 192" socket={[108, 194]} />
      <Declares d="M196 300 C168 288 138 268 112 244" socket={[108, 242]} />
      <Declares d="M332 156 C300 156 272 156 244 156" socket={[240, 156]} />
      <Declares d="M468 108 C432 118 404 132 380 142" socket={[376, 144]} />

      {/* ── combining two knowledges. Built, off by default: dashed, unstamped, and its thread never lands. */}
      <g opacity={0.45}>
        <path d="M232 186 C248 212 258 228 266 240" fill="none" stroke={EDGE} strokeWidth={1.6} strokeDasharray="5 4" strokeLinecap="round" />
        <path d="M340 186 C320 212 300 232 288 242" fill="none" stroke={EDGE} strokeWidth={1.6} strokeDasharray="5 4" strokeLinecap="round" />
        {/* the gate: a person decides, and nothing flows through — a question two parents answer differently
            is refused until a human picks one of them */}
        <path d="M277 246 L287 256 L277 266 L267 256 Z" fill="#333333" stroke={WORK} strokeWidth={1.8} strokeLinejoin="round" />
        <g stroke={WORK} strokeWidth={2.2} fill="none" strokeLinecap="round">
          <circle cx={277} cy={222} r={5} />
          <path d="M267 238 a10 10 0 0 1 20 0" />
        </g>
        <path d="M289 258 C306 264 322 268 340 272" fill="none" stroke={EDGE} strokeWidth={1.6} strokeDasharray="5 4" strokeLinecap="round" />
        <KnowledgeFile x={344} y={252} dashed />
        {/* …and it stops short of the table, with no arrowhead. Nothing combined has landed on a default node. */}
        <path d="M364 302 V382" fill="none" stroke={WORK} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.7} />
      </g>

      {/* ── the knowledges and the people who made them */}
      <Authored from={[60, 170]} to={[72, 192]} />
      <Authored from={[196, 100]} to={[208, 122]} />
      <Authored from={[332, 100]} to={[344, 122]} />
      <Authored from={[468, 52]} to={[480, 74]} />
      <Authored from={[196, 312]} to={[208, 334]} />

      <g className="hg-file-a"><KnowledgeFile x={68} y={190} /></g>
      <KnowledgeFile x={204} y={120} />
      <KnowledgeFile x={204} y={332} />
      <g className="hg-file-b"><KnowledgeFile x={340} y={120} /></g>
      <g className="hg-file-c"><KnowledgeFile x={476} y={72} /></g>

      <Stamps x={102} y={182} />
      <Stamps x={238} y={112} />
      <Stamps x={238} y={324} />
      <Stamps x={374} y={112} />
      <Stamps x={510} y={64} />

      <Person x={60} y={170} />
      <Person x={196} y={100} />
      <Person x={332} y={100} />
      <Person x={468} y={52} />
      <Person x={196} y={312} />

      {/* ── applying: reversible, so no arrowheads. Two knowledges are live on the seller's own model. */}
      <g stroke={WORK} strokeWidth={1.2} opacity={0.5}>
        <path d="M108 240 C132 300 156 360 176 412" fill="none" className="hg-apply-a" />
        <path d="M356 170 C344 260 300 350 288 412" fill="none" className="hg-apply-b" />
        <path d="M496 122 C492 220 420 340 372 412" fill="none" className="hg-apply-c" />
      </g>

      {/* ── the sale. One payment, full price, one recipient — and only this arrow has a filled head. */}
      <path d="M516 120 L556 146" stroke={MONEY} strokeWidth={1.4} opacity={0.7} />
      <circle cx={562} cy={150} r={7} fill="#333333" stroke={MONEY} strokeWidth={2} />
      <circle cx={562} cy={150} r={3} fill={KEPT} />

      <g className="hg-buy">
        <path d="M740 176 C680 194 612 176 576 158" fill="none" stroke={MONEY} strokeWidth={3.2}
          markerEnd="url(#hg-paid)" strokeLinecap="round" />
      </g>

      {/* the body goes the other way, and it is work, not money */}
      <g className="hg-deliver">
        <path d="M518 88 C592 98 664 116 724 134" fill="none" stroke={WORK} strokeWidth={1.8}
          markerEnd="url(#hg-deliver)" strokeLinecap="round" opacity={0.9} />
      </g>

      {/* ── and afterwards, the seller sends a share to every knowledge its own names as a source. Equal
             weight, one origin, open heads: a promise on the record, paid out by a job that retries. */}
      <g className="hg-payouts" fill="none" stroke={MONEY} strokeWidth={1.3} markerEnd="url(#hg-owed)" strokeLinecap="round" opacity={0.55}>
        <path d="M558 158 C520 200 452 196 390 170" />
        <path d="M557 159 C500 246 330 236 254 188" />
        <path d="M556 160 C470 300 190 272 116 226" />
      </g>

      {/* the buyer: the same mark as every author, with a wallet beside them */}
      <Person x={760} y={154} />
      <g stroke={MONEY} strokeWidth={2} fill="none" opacity={0.9}>
        <circle cx={716} cy={200} r={9} />
        <path d="M712 200 a4 4 0 0 1 8 0" opacity={0.7} />
      </g>
      <path d="M746 172 L724 193" stroke={EDGE} strokeWidth={1.2} opacity={0.5} />

      {/* what the buyer paid for, now on the buyer's own model */}
      <path d="M756 180 C752 280 750 356 749 412" fill="none" stroke={WORK} strokeWidth={1.2} opacity={0.5} />
    </>
  );
}

