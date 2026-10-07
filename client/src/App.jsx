import { useEffect, useState } from 'react';
const api = (p, o = {}) => fetch('/api' + p, { ...o, headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then(r => r.status === 204 ? null : r.json());
const S = ['New', 'Contacted', 'Showing', 'Offer', 'Closed', 'Lost'];
const usd = n => n == null ? '-' : '$' + Number(n).toLocaleString('en-US');
const when = d => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function App() {
  const [tab, setTab] = useState('Dashboard');
 const [d, setD] = useState({
  dash: { byStatus: [] },
  enq: [],
  cus: [],
  fu: [],
  properties: []
});
  const load = async () => {
  const [dash, enq, cus, fu, properties] = await Promise.all([
    api('/dashboard'),
    api('/enquiries'),
    api('/customers'),
    api('/followups'),
    api('/properties')
  ]);

  setD({ dash, enq, cus, fu, properties });
};
  useEffect(() => { load(); }, []);
  const P = { ...d, load };
  return <div className="app">
    <nav><h1>🏡 HomeBase CRM</h1>{['Dashboard', 'Properties', 'Leads', 'Customers', 'Follow-ups', 'Assistant'].map(t =>
      <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
    <main>
  {tab === 'Dashboard' && <Dash {...P} />}
  {tab === 'Properties' && <Properties {...P} />}
  {tab === 'Leads' && <Leads {...P} />}
  {tab === 'Customers' && <Customers {...P} />}
  {tab === 'Follow-ups' && <Followups {...P} />}
  {tab === 'Assistant' && <Assistant />}
</main>
  </div>;
}

function Dash({ dash, fu }) {
  const cnt = s => dash.byStatus.find(x => x.status === s)?.n || 0, max = Math.max(1, ...dash.byStatus.map(x => x.n));
  const stats = [['New leads', cnt('New')], ['Active listings', dash.listings], ['Pipeline value', usd(dash.pipeline)], ['Overdue follow-ups', dash.overdue]];
  return <><h2>Dashboard</h2>
    <div className="grid">{stats.map(([l, v]) => <div key={l} className="card stat"><b>{v ?? '-'}</b><span>{l}</span></div>)}</div>
    <div className="card"><h3>Lead pipeline</h3>{S.map(s => <div className="bar" key={s}><span style={{ width: 80 }}>{s}</span><i style={{ width: cnt(s) / max * 60 + '%' }} />{cnt(s)}</div>)}</div>
    <div className="card"><h3>Upcoming follow-ups</h3>{fu.filter(f => !f.done).slice(0, 5).map(f => <p key={f.id}>
      <b>{f.customer}</b> - {f.note} <span className={new Date(f.due_at) < new Date() ? 'late' : ''}>({when(f.due_at)})</span></p>)}</div></>;
}

function Leads({ enq, load }) {
  const set = async (id, status) => { await api(`/enquiries/${id}/status`, { method: 'PATCH', body: { status } }); load(); };
  return <><h2>Property enquiries & lead status</h2><div className="card"><table>
    <thead><tr><th>Customer</th><th>Property</th><th>Message</th><th>Received</th><th>Status</th></tr></thead>
    <tbody>{enq.map(e => <tr key={e.id}><td>{e.customer}</td><td>{e.address}<br /><small>{e.city} · {usd(e.price)}</small></td><td>{e.message}</td><td>{when(e.created_at)}</td>
      <td><select value={e.status} onChange={x => set(e.id, x.target.value)}>{S.map(s => <option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table></div></>;
}

function Customers({ cus, load }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', type: 'Buyer', budget: '' });
  const add = async e => { e.preventDefault(); await api('/customers', { method: 'POST', body: f }); setF({ name: '', email: '', phone: '', type: 'Buyer', budget: '' }); load(); };
  const del = async id => { if (confirm('Delete this customer?')) { await api('/customers/' + id, { method: 'DELETE' }); load(); } };
  const inp = (k, ph, t = 'text') => <input type={t} placeholder={ph} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} required={k === 'name'} />;
  return <><h2>Customers</h2>
    <form className="card row" onSubmit={add}>{inp('name', 'Full name')}{inp('email', 'Email', 'email')}{inp('phone', 'Phone')}
      <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>{['Buyer', 'Seller', 'Renter'].map(t => <option key={t}>{t}</option>)}</select>
      {inp('budget', 'Budget', 'number')}<button className="pri">Add customer</button></form>
    <div className="card"><table><thead><tr><th>Name</th><th>Contact</th><th>Type</th><th>Budget</th><th /></tr></thead>
      <tbody>{cus.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.email}<br /><small>{c.phone}</small></td><td><span className="tag">{c.type}</span></td><td>{usd(c.budget)}</td>
        <td><button onClick={() => del(c.id)}>✕</button></td></tr>)}</tbody></table></div></>;
}

function Followups({ fu, cus, load }) {
  const [f, setF] = useState({ customer_id: '', note: '', due_at: '' });
  const add = async e => { e.preventDefault(); await api('/followups', { method: 'POST', body: { ...f, due_at: new Date(f.due_at).toISOString() } }); setF({ customer_id: '', note: '', due_at: '' }); load(); };
  return <><h2>Follow-up reminders</h2>
    <form className="card row" onSubmit={add}>
      <select required value={f.customer_id} onChange={e => setF({ ...f, customer_id: e.target.value })}><option value="">Customer…</option>{cus.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input required placeholder="Reminder note" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
      <input required type="datetime-local" value={f.due_at} onChange={e => setF({ ...f, due_at: e.target.value })} />
      <button className="pri">Add reminder</button></form>
    <div className="card">{fu.map(x => <p key={x.id} style={{ opacity: x.done ? .5 : 1 }}>
      <input type="checkbox" checked={x.done} onChange={async () => { await api(`/followups/${x.id}/toggle`, { method: 'PATCH' }); load(); }} />{' '}
      <b>{x.customer}</b> - {x.note} <span className={!x.done && new Date(x.due_at) < new Date() ? 'late' : ''}>({when(x.due_at)})</span></p>)}</div></>;
}

function Assistant() {
  const [m, setM] = useState([{ r: 'a', t: 'Hi! I can help with listings, pricing and scheduling showings. What are you looking for?' }]);
  const [t, setT] = useState(''), [busy, setBusy] = useState(false);
  const send = async e => { e.preventDefault(); if (!t.trim()) return; const msg = t; setT(''); setBusy(true); setM(x => [...x, { r: 'u', t: msg }]);
    const { reply } = await api('/assistant', { method: 'POST', body: { message: msg } }); setM(x => [...x, { r: 'a', t: reply }]); setBusy(false); };
  return <><h2>AI support assistant</h2><div className="card chat"><div className="msgs">{m.map((x, i) => <div key={i} className={'m ' + x.r}>{x.t}</div>)}{busy && <div className="m a">Typing…</div>}</div>
    <form className="row" onSubmit={send}><input style={{ flex: 1 }} placeholder="e.g. 3 bedroom homes in Austin" value={t} onChange={e => setT(e.target.value)} /><button className="pri">Send</button></form></div></>;
}

function Properties({ properties, load }) {
  const empty = {
    address: '',
    city: '',
    state: '',
    price: '',
    beds: '',
    baths: '',
    sqft: '',
    status: 'Active'
  };

  const [f, setF] = useState(empty);
  const [editing, setEditing] = useState(null);

  const change = (key, value) => {
    setF(prev => ({ ...prev, [key]: value }));
  };

  const save = async e => {
    e.preventDefault();

    const body = {
      ...f,
      price: Number(f.price),
      beds: Number(f.beds),
      baths: Number(f.baths),
      sqft: Number(f.sqft)
    };

    if (editing !== null) {
      await api(`/properties/${editing}`, {
        method: 'PUT',
        body
      });
    } else {
      await api('/properties', {
        method: 'POST',
        body
      });
    }

    setF(empty);
    setEditing(null);
    await load();
  };

  const edit = p => {
    setEditing(p.id);
    setF({
      address: p.address || '',
      city: p.city || '',
      state: p.state || '',
      price: p.price ?? '',
      beds: p.beds ?? '',
      baths: p.baths ?? '',
      sqft: p.sqft ?? '',
      status: p.status || 'Active'
    });
  };

  const del = async id => {
    if (confirm('Are you sure you want to delete this property?')) {
      await api(`/properties/${id}`, { method: 'DELETE' });
      await load();
    }
  };

  const inp = (key, placeholder, type = 'text') => (
    <input
      type={type}
      placeholder={placeholder}
      value={f[key]}
      onChange={e => change(key, e.target.value)}
      required
    />
  );

  return (
    <>
      <h2>Properties</h2>

      <form className="card row" onSubmit={save}>
        {inp('address', 'Property address')}
        {inp('city', 'City')}
        {inp('state', 'State')}
        {inp('price', 'Price', 'number')}
        {inp('beds', 'Bedrooms', 'number')}
        {inp('baths', 'Bathrooms', 'number')}
        {inp('sqft', 'Area (sqft)', 'number')}

        <select
          value={f.status}
          onChange={e => change('status', e.target.value)}
        >
          {['Active', 'Pending', 'Sold'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button className="pri" type="submit">
          {editing !== null ? 'Update property' : 'Add property'}
        </button>

        {editing !== null && (
          <button
            type="button"
            onClick={() => {
              setF(empty);
              setEditing(null);
            }}
          >
            Cancel
          </button>
        )}
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Address</th>
              <th>City</th>
              <th>Price</th>
              <th>Beds</th>
              <th>Baths</th>
              <th>Area</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {properties.map(p => (
              <tr key={p.id}>
                <td>{p.address}</td>
                <td>{p.city}</td>
                <td>{usd(p.price)}</td>
                <td>{p.beds}</td>
                <td>{p.baths}</td>
                <td>{p.sqft} sqft</td>
                <td><span className="tag">{p.status}</span></td>
                <td>
                  <button type="button" onClick={() => edit(p)}>
                    Edit
                  </button>
                  {' '}
                  <button type="button" onClick={() => del(p.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {properties.length === 0 && <p>No properties found.</p>}
      </div>
    </>
  );
}