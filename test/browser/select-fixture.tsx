/** Standalone interactive fixture. Bundle into a local HTML file; no application server or API calls. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import { SelectBox } from '../../src/components/ui/Misc';
import { LocaleProvider } from '../../src/i18n';
import { theme } from '../../src/theme/theme';

function Fixture() {
  const [value, setValue] = useState('all'), [changes, setChanges] = useState(0), [submits, setSubmits] = useState(0);
  const [removed, setRemoved] = useState(false);
  const options = [{ value: 'all', label: 'All records' }, { value: 'blocked', label: 'Disabled choice', disabled: true },
    { value: 'price', label: 'Price change' }, { value: 'payout', label: 'Payout' },
    { value: 'long', label: 'A very long filter label with enough words to test a narrow mobile viewport' }];
  return <main style={{ maxWidth: 640, padding: 16, boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
    <h1>Filter interaction check</h1>
    <form onSubmit={e => { e.preventDefault(); setSubmits(n => n + 1); }}>
      <button type="button">Before filter</button>
      <div style={{ margin: '16px 0' }}><SelectBox label="Record kind" prefix="Kind" value={value}
        options={removed ? options.filter(o => o.value !== value) : options}
        onChange={next => { setValue(next); setChanges(n => n + 1); setRemoved(false); }} /></div>
      <button type="button">After filter</button>
    </form>
    <p role="status">Selected: {value}; changes: {changes}; form submits: {submits}</p>
    <button type="button" onClick={() => setRemoved(true)}>Remove selected option</button>
    <p><SelectBox label="Empty filter" options={[]} value="" onChange={() => { throw new Error('Empty filter changed'); }} /></p>
    <p><SelectBox label="Unavailable filter" options={[options[1]]} value="blocked" onChange={() => { throw new Error('Disabled filter changed'); }} /></p>
  </main>;
}

createRoot(document.getElementById('root')!).render(<ThemeProvider theme={theme}><LocaleProvider><Fixture /></LocaleProvider></ThemeProvider>);
