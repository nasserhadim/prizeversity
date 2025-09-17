//new file added 9/16 retaj
///this code below is read only for now, just to test it out: 
import { useEffect, useState } from 'react';

export default function Shops() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/shops');          // goes to backend via Vite proxy
        if (!res.ok) throw new Error('Failed to load shops');
        const json = await res.json();                  // our API returns { data, total, page, limit }
        setShops(json.data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{padding:16}}>Loading…</p>;
  if (error)   return <p style={{padding:16, color:'red'}}>{error}</p>;

  return (
    <div style={{maxWidth: 720, margin:'24px auto', padding:12}}>
      <h1>Shops</h1>
      <button
        style={{margin:'12px 0'}}
        onClick={() => alert('TODO: Add Shop form (next step)')}
      >
        + Add Shop
      </button>

      {shops.length === 0 ? (
        <p>No shops yet.</p>
      ) : (
        <ul style={{listStyle:'none', padding:0}}>
          {shops.map(s => (
            <li key={s._id}
                style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #eee'}}>
              <div>
                <strong>{s.name}</strong>
                {s.description ? <div>{s.description}</div> : null}
              </div>
              <div>
                <button style={{marginRight:8}} onClick={() => alert('TODO edit ' + s._id)}>Edit</button>
                <button onClick={() => alert('TODO delete ' + s._id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
