'use client';

import { ClipboardCopy, LoaderCircle, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

type Provider = 'breaks' | 'ocado';
type Ingredient = { id: string; listId: string; provider: Provider; name: string; unit: string; quantity: string; checked: boolean; position: number };
const savedListKey = 'mi-lista-ingredientes-online';
const listIdPattern = /^[a-f0-9-]{36}$/i;
const providerLabels: Record<Provider, string> = { breaks: 'Breaks', ocado: 'Ocado' };

export function ShoppingList() {
  const [listId, setListId] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [provider, setProvider] = useState<Provider>('breaks');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const started = useRef(false);

  async function initialiseList() {
    let id = new URLSearchParams(window.location.search).get('lista') ?? '';
    if (!listIdPattern.test(id)) id = window.localStorage.getItem(savedListKey) ?? '';
    try {
      if (!listIdPattern.test(id)) {
        const response = await fetch('/api/lists', { method: 'POST' });
        const data = await response.json() as { listId: string };
        id = data.listId;
        setNotice('Your online list is ready. Save the private link to open it on any phone.');
      }
      window.localStorage.setItem(savedListKey, id);
      window.history.replaceState(null, '', `?lista=${id}`);
      setListId(id);
      await refreshIngredients(id, 'breaks');
    } catch { setNotice('We could not connect to your list. Please try again in a moment.'); }
    finally { setLoading(false); }
  }

  async function refreshIngredients(id = listId, selectedProvider = provider) {
    const response = await fetch(`/api/lists/${id}/ingredients?provider=${selectedProvider}`);
    if (!response.ok) throw new Error('Could not read ingredients');
    const data = await response.json() as { ingredients: Ingredient[] };
    setIngredients(data.ingredients);
  }

  async function addIngredient(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !listId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/lists/${listId}/ingredients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmedName, unit: unit.trim(), provider }) });
      if (!response.ok) throw new Error('Could not add ingredient');
      const data = await response.json() as { ingredient: Ingredient };
      setIngredients((current) => [...current, data.ingredient]);
      setName(''); setUnit(''); setNotice(`${data.ingredient.name} has been saved.`);
    } catch { setNotice('Could not save it. Please try again.'); }
    finally { setSaving(false); }
  }

  async function changeIngredient(id: string, changes: Partial<Ingredient>) {
    const before = ingredients;
    setIngredients((current) => current.map((ingredient) => ingredient.id === id ? { ...ingredient, ...changes } : ingredient));
    try {
      const response = await fetch(`/api/lists/${listId}/ingredients/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) });
      if (!response.ok) throw new Error('Could not update ingredient');
      const data = await response.json() as { ingredient: Ingredient };
      setIngredients((current) => current.map((ingredient) => ingredient.id === id ? data.ingredient : ingredient));
    } catch { setIngredients(before); setNotice('Could not save that change.'); }
  }

  async function editIngredient(ingredient: Ingredient) {
    const nextName = window.prompt('Ingredient name:', ingredient.name);
    if (nextName === null) return;
    const cleanName = nextName.trim();
    if (!cleanName) { setNotice('An ingredient needs a name.'); return; }
    const nextUnit = window.prompt('Unit (add or change it):', ingredient.unit);
    if (nextUnit === null) return;
    const nextProvider = window.prompt('Supplier: Breaks or Ocado', providerLabels[ingredient.provider]);
    if (nextProvider === null) return;
    const providerValue: Provider = nextProvider.trim().toLowerCase() === 'ocado' ? 'ocado' : 'breaks';
    await changeIngredient(ingredient.id, { name: cleanName, unit: nextUnit.trim(), provider: providerValue });
    if (providerValue !== provider) setIngredients((current) => current.filter((item) => item.id !== ingredient.id));
  }

  async function removeIngredient(ingredient: Ingredient) {
    if (!window.confirm(`Delete “${ingredient.name}”?`)) return;
    const before = ingredients;
    setIngredients((current) => current.filter((item) => item.id !== ingredient.id));
    try {
      const response = await fetch(`/api/lists/${listId}/ingredients/${ingredient.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete ingredient');
      setNotice('Ingredient deleted.');
    } catch { setIngredients(before); setNotice('Could not delete the ingredient.'); }
  }

  async function clearQuantities() {
    const selected = ingredients.filter((ingredient) => hasQuantity(ingredient.quantity));
    if (!selected.length || !window.confirm('Only quantities will be cleared. Your ingredients will remain.')) return;
    await Promise.all(selected.map((ingredient) => changeIngredient(ingredient.id, { quantity: '', checked: false })));
    setNotice('Your list is ready for your next shop.');
  }

  async function copyShareLink() {
    try { await navigator.clipboard.writeText(window.location.href); setNotice('Private link copied. Open it on any phone to see this same list.'); }
    catch { setNotice('Copy the address shown in your browser.'); }
  }

  async function copyShoppingList() {
    const text = selectedIngredients.map((ingredient) => `• ${formatQuantity(ingredient.quantity, ingredient.unit)} · ${ingredient.name}`).join('\n');
    if (!text) return;
    try { await navigator.clipboard.writeText(`Shopping list · ${providerLabels[provider]}\n\n${text}`); setNotice('Shopping list copied.'); }
    catch { setNotice('Could not copy the shopping list.'); }
  }

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void initialiseList();
    }
  }, []);

  useEffect(() => {
    if (listId) void refreshIngredients(listId, provider).catch(() => setNotice('Could not load that list.'));
  }, [listId, provider]);

  const selectedIngredients = ingredients.filter((ingredient) => hasQuantity(ingredient.quantity));

  return <main className="min-h-screen bg-[radial-gradient(circle_at_90%_5%,rgba(254,190,75,.32),transparent_24rem),radial-gradient(circle_at_4%_42%,rgba(20,112,100,.12),transparent_27rem),#f7f1e7] px-3 py-4 text-[#202724] sm:px-6 sm:py-8"><div className="mx-auto w-full max-w-6xl">
    <header className="mb-5 border-b border-[#dfd6c5] pb-5 text-center"><h1 className="text-4xl leading-[.95] font-bold tracking-[-.06em] sm:text-6xl">My ingredient list</h1></header>
    <section className="mb-5 rounded-2xl border border-[#dfd6c5] bg-[#fffdf9] p-3" aria-label="Choose supplier"><p className="mb-2 px-1 font-mono text-[0.66rem] font-medium tracking-[.14em] text-[#68706a]">CHOOSE SUPPLIER</p><div className="grid grid-cols-2 gap-2"><Button type="button" onClick={() => setProvider('breaks')} className={provider === 'breaks' ? 'h-12 bg-[#1e625a] text-white hover:bg-[#174e47]' : 'h-12 bg-[#f2ede3] text-[#4b514d] hover:bg-[#e5ded1]'}>Breaks</Button><Button type="button" onClick={() => setProvider('ocado')} className={provider === 'ocado' ? 'h-12 bg-[#1e625a] text-white hover:bg-[#174e47]' : 'h-12 bg-[#f2ede3] text-[#4b514d] hover:bg-[#e5ded1]'}>Ocado</Button></div></section>
    {notice && <output className="mb-4 block rounded-xl bg-[#1e625a] px-4 py-3 text-sm font-medium text-white">{notice}</output>}
    {loading ? <div className="grid min-h-72 place-items-center rounded-3xl border border-[#dfd6c5] bg-[#fffdf9] shadow-[0_18px_50px_rgba(65,48,26,.11)]"><LoaderCircle className="size-7 animate-spin text-[#e9622d]" aria-label="Loading your list" /></div> : <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(330px,.8fr)] lg:items-start">
      <section className="rounded-3xl border border-[#dfd6c5] bg-[#fffdf9] p-5 shadow-[0_18px_50px_rgba(65,48,26,.11)] sm:p-8" aria-labelledby="ingredients-title"><div className="flex items-start justify-between gap-4"><div><p className="mb-2 font-mono text-[0.66rem] font-medium tracking-[.14em] text-[#22746a]">{providerLabels[provider].toUpperCase()} LIST</p><h2 id="ingredients-title" className="text-2xl font-bold tracking-[-.045em]">Ingredients</h2></div><span className="rounded-full bg-[#f1ece2] px-2.5 py-1 font-mono text-[0.66rem] text-[#69645d]">{ingredients.length} saved</span></div>
      <form onSubmit={addIngredient} className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(110px,.38fr)_auto]"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="E.g. Eggs" maxLength={60} required aria-label="Ingredient name" className="h-11 border-[#ded6c9] bg-[#fffefa]" /><Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit (e.g. kg)" maxLength={24} aria-label="Ingredient unit" className="h-11 border-[#ded6c9] bg-[#fffefa]" /><Button type="submit" disabled={saving} className="h-11 bg-[#e9622d] px-5 text-white hover:bg-[#c94a1d]">{saving ? <LoaderCircle className="animate-spin" /> : <Plus />} Add to {providerLabels[provider]}</Button></form>
      <div className="mt-5 grid gap-2">{ingredients.length === 0 ? <EmptyIngredients provider={provider} /> : ingredients.map((ingredient) => <article key={ingredient.id} className="grid grid-cols-[minmax(0,1fr)_90px_62px] items-center gap-2 rounded-xl border border-[#ebe4d9] bg-[#fffefa] p-2 pl-3 sm:grid-cols-[minmax(0,1fr)_118px_72px]"><div className="min-w-0"><p className="truncate font-semibold">{ingredient.name}</p><p className="mt-0.5 text-xs text-[#6e716c]">{ingredient.unit || 'No unit'}</p></div><Input type="number" min="0" step="any" inputMode="decimal" value={ingredient.quantity} onChange={(event) => setIngredients((current) => current.map((item) => item.id === ingredient.id ? { ...item, quantity: event.target.value } : item))} onBlur={(event) => void changeIngredient(ingredient.id, { quantity: event.target.value })} placeholder="—" aria-label={`Quantity of ${ingredient.name}`} className="h-10 border-[#ded6c9] bg-white text-center font-mono" /><div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" type="button" onClick={() => void editIngredient(ingredient)} aria-label={`Edit ${ingredient.name}`}><Pencil /></Button><Button variant="ghost" size="icon-sm" type="button" onClick={() => void removeIngredient(ingredient)} aria-label={`Delete ${ingredient.name}`} className="text-[#ad5131] hover:bg-[#fff0ed] hover:text-[#ad5131]"><Trash2 /></Button></div></article>)}</div>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3"><Button variant="link" type="button" onClick={() => void clearQuantities()} className="h-auto px-0 text-[#22746a]">Clear quantities only</Button><Button variant="link" type="button" onClick={() => void copyShareLink()} className="h-auto px-0 text-[#22746a]"><Share2 /> Copy private link</Button></div></section>
      <aside className="rounded-3xl border border-[#dfd6c5] bg-[#fffdf9] p-5 shadow-[0_18px_50px_rgba(65,48,26,.11)] lg:sticky lg:top-5 sm:p-7" aria-labelledby="shopping-title"><div className="flex items-start justify-between gap-3"><div><p className="mb-2 font-mono text-[0.66rem] font-medium tracking-[.14em] text-[#22746a]">SHOPPING FOR {providerLabels[provider].toUpperCase()}</p><h2 id="shopping-title" className="text-2xl font-bold tracking-[-.045em]">Shopping list</h2></div><Button type="button" onClick={() => void copyShoppingList()} disabled={!selectedIngredients.length} className="bg-[#e9622d] text-white hover:bg-[#c94a1d]"><ClipboardCopy /> Copy</Button></div><div className="mt-6 grid gap-1">{selectedIngredients.length === 0 ? <EmptyShopping /> : selectedIngredients.map((ingredient) => <label key={ingredient.id} className={`flex cursor-pointer items-start gap-3 border-b border-[#e9e3da] py-3 last:border-0 ${ingredient.checked ? 'text-[#8a908b] line-through' : ''}`}><Checkbox checked={ingredient.checked} onCheckedChange={(checked) => void changeIngredient(ingredient.id, { checked: Boolean(checked) })} aria-label={`Mark ${ingredient.name} as bought`} className="mt-0.5" /><span className="text-sm leading-5"><strong className="font-mono font-medium text-[#22746a]">{formatQuantity(ingredient.quantity, ingredient.unit)}</strong> · {ingredient.name}</span></label>)}</div><p className="mt-5 border-t border-[#dfd6c5] pt-4 text-xs leading-5 text-[#6e716c]">{selectedIngredients.length ? `${selectedIngredients.filter((item) => item.checked).length} of ${selectedIngredients.length} marked as bought.` : `Add a quantity to the ${providerLabels[provider]} list.`}</p></aside>
    </div>}
  </div></main>;
}

function EmptyIngredients({ provider }: { provider: Provider }) { return <div className="rounded-xl border border-dashed border-[#cfc5b4] px-6 py-12 text-center"><span className="mx-auto grid size-9 place-items-center rounded-full bg-[#e5f2ed] text-xl text-[#22746a]">+</span><h3 className="mt-3 font-semibold">Add your first {providerLabels[provider]} ingredient</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-5 text-[#6e716c]">You can add as many ingredients as you need. They will only appear in this list.</p></div>; }
function EmptyShopping() { return <div className="py-14 text-center"><p className="text-3xl text-[#f0c24b]">⌁</p><p className="mt-3 font-semibold">Your shopping list will appear here.</p><p className="mt-2 text-sm text-[#6e716c]">Only ingredients with a quantity are shown.</p></div>; }
function hasQuantity(value: string) { return Number(value) > 0; }
function formatQuantity(quantity: string, unit: string) { const formatted = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 }).format(Number(quantity)); return unit ? `${formatted} ${unit}` : formatted; }
