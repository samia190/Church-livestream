import { motion } from "framer-motion";
import { BookHeart, Lock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

const moods = ["grateful", "hopeful", "burdened", "peaceful", "seeking"] as const;

export default function FaithJournal() {
  const { isAuthenticated, loading } = useAuth();
  const { data: entries = [], isLoading } = trpc.journal.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();
  const createEntry = trpc.journal.create.useMutation({ onSuccess: () => { utils.journal.list.invalidate(); setTitle(""); setContent(""); setScriptureReference(""); setMood(undefined); toast.success("Your reflection was saved privately."); } });
  const removeEntry = trpc.journal.remove.useMutation({ onSuccess: () => utils.journal.list.invalidate() });
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scriptureReference, setScriptureReference] = useState("");
  const [mood, setMood] = useState<typeof moods[number]>();

  if (!loading && !isAuthenticated) return <div className="min-h-screen text-foreground"><Navigation /><main className="pt-32 px-4"><Card className="max-w-xl mx-auto p-8 text-center glass-panel border-0"><Lock className="w-10 h-10 text-ember mx-auto mb-4" /><h1 className="text-3xl font-bold mb-3">Your private faith journal</h1><p className="text-muted-foreground mb-6">Sign in to keep your prayers, reflections, and Scripture insights private and available across your devices.</p><Button onClick={() => window.location.assign(getLoginUrl())} className="bg-ember hover:bg-ember/90 text-ember-foreground">Sign in to continue</Button></Card></main></div>;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    createEntry.mutate({ title: title.trim() || undefined, content: content.trim(), mood, scriptureReference: scriptureReference.trim() || undefined });
  };

  return <div className="min-h-screen text-foreground"><Navigation /><main className="pt-28 pb-20 px-4"><div className="max-w-5xl mx-auto"><motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10"><p className="label-eyebrow mb-3">A quiet place to remember</p><h1 className="text-4xl md:text-5xl font-bold mb-4">Faith Journal</h1><p className="text-lg text-muted-foreground max-w-2xl">Write honestly before God. Your entries are private by default and belong to you.</p><Badge variant="outline" className="mt-4"><Lock className="w-3 h-3 mr-2" />Private to you</Badge></motion.div>
    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start"><Card className="p-6 glass-panel border-0 lg:sticky lg:top-24"><div className="flex items-center gap-3 mb-5"><BookHeart className="w-6 h-6 text-ember" /><h2 className="text-xl font-bold">Write a reflection</h2></div><form onSubmit={submit} className="space-y-4"><Input value={title} onChange={event => setTitle(event.target.value)} placeholder="A title (optional)" maxLength={160} /><Input value={scriptureReference} onChange={event => setScriptureReference(event.target.value)} placeholder="Scripture reference (optional)" maxLength={160} /><div className="flex flex-wrap gap-2">{moods.map(item => <button type="button" key={item} onClick={() => setMood(mood === item ? undefined : item)} className={`rounded-full px-3 py-1 text-xs border capitalize ${mood === item ? "border-ember bg-ember/10 text-ember" : "border-border text-muted-foreground"}`}>{item}</button>)}</div><Textarea value={content} onChange={event => setContent(event.target.value)} placeholder="What is God bringing to your heart today?" rows={8} maxLength={12000} required /><Button type="submit" disabled={createEntry.isPending || !content.trim()} className="w-full bg-ember hover:bg-ember/90 text-ember-foreground"><Plus className="w-4 h-4 mr-2" />{createEntry.isPending ? "Saving…" : "Save privately"}</Button></form></Card><section>{isLoading ? <Card className="p-8 text-center text-muted-foreground">Opening your journal…</Card> : entries.length === 0 ? <Card className="p-8 text-center glass-panel border-0"><BookHeart className="w-10 h-10 text-ember mx-auto mb-4" /><h2 className="text-xl font-bold mb-2">Your journal is waiting</h2><p className="text-muted-foreground">Your first entry could be a prayer, a question, a gratitude, or a Scripture that stayed with you.</p></Card> : <div className="space-y-4">{entries.map(entry => <Card key={String(entry._id)} className="p-6 border-border"><div className="flex justify-between gap-4"><div><p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p><h2 className="text-xl font-bold mt-1">{entry.title || "Untitled reflection"}</h2></div><Button variant="ghost" size="icon" aria-label="Delete journal entry" onClick={() => { if (window.confirm("Delete this private journal entry?")) removeEntry.mutate({ id: String(entry._id) }); }}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>{entry.scriptureReference && <p className="text-sm text-ember mt-4">{entry.scriptureReference}</p>}<p className="whitespace-pre-wrap leading-relaxed text-muted-foreground mt-4">{entry.content}</p>{entry.mood && <Badge variant="secondary" className="mt-4 capitalize">{entry.mood}</Badge>}</Card>)}</div>}</section></div></div></main></div>;
}
