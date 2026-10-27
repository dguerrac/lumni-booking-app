import { useEffect, useState } from 'react';

// Step 0 placeholder: proves the web -> API proxy works.
export function App() {
  const [apiStatus, setApiStatus] = useState('checking…');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((body: { status: string }) => setApiStatus(body.status))
      .catch(() => setApiStatus('unreachable'));
  }, []);

  return (
    <main>
      <h1>Lumni Coworking · Reservas</h1>
      <p>API: {apiStatus}</p>
    </main>
  );
}
