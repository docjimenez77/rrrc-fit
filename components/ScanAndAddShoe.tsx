import { useEffect, useRef } from 'react';

type ScanProps = {
  onAddShoe: (shoe: any) => void;
  focusOnMount?: boolean;
};

export default function ScanAndAddShoe({ onAddShoe, focusOnMount = true }: ScanProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (focusOnMount && inputRef.current) inputRef.current.focus();
  }, [focusOnMount]);

  async function lookupUpc(upc: string) {
    const res = await fetch('/api/upc/' + upc);
    if (!res.ok) {
      const text = await res.text().catch(()=>res.statusText);
      const err = new Error(text || ('status ' + res.status));
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  async function handleEnter(raw: string) {
    const upc = String(raw || '').replace(/\D/g, '');
    if (!upc) return;
    try {
      const data = await lookupUpc(upc);
      const shoe = {
        id: 'tmp-' + Date.now(),
        upc: data.upc,
        shoeModelId: data.shoeModelId || null,
        modelName: data.modelName || data.description || '',
        brand: data.brand || null,
        size: data.size || '',
        width: data.width || '',
        rating: 4,
        notes: '',
        selected: false,
      };
      onAddShoe(shoe);
      if (inputRef.current) {
        inputRef.current.style.background = '#d1fae5';
        setTimeout(()=>{ if(inputRef.current) inputRef.current.style.background=''; }, 300);
      }
    } catch (err) {
      if ((err as any).status === 404) {
        alert('UPC not found — please add shoe manually.');
      } else {
        console.error('UPC lookup error', err);
        alert('UPC lookup failed — see console');
      }
    }
  }

  return (
    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
      <input
        ref={inputRef}
        aria-label="Scan UPC"
        placeholder="Scan UPC here"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleEnter(e.target.value);
            e.target.value = '';
          }
        }}
        style={{
          padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb',
          width: 320, fontSize: 14
        }}
      />
      <div style={{fontSize:13,color:'#6b7280'}}>Scan a UPC to auto-fill a shoe</div>
    </div>
  );
}
