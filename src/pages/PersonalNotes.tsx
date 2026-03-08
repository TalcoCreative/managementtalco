import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, StickyNote, Clock, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { RichBriefEditor, BriefData, migrateLegacyData } from "@/components/tasks/RichBriefEditor";

interface PersonalNote {
  id: string;
  user_id: string;
  title: string;
  content: any;
  created_at: string;
  updated_at: string;
}

export default function PersonalNotes() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<PersonalNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState<BriefData | null>(null);
  const [deleteNote, setDeleteNote] = useState<PersonalNote | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["personal-notes"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];
      const { data, error } = await supabase
        .from("personal_notes")
        .select("*")
        .eq("user_id", session.session.user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PersonalNote[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("personal_notes")
        .insert({ user_id: session.session.user.id, title: "Untitled Note", content: null })
        .select()
        .single();
      if (error) throw error;
      return data as PersonalNote;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["personal-notes"] });
      setSelectedNote(note);
      setEditTitle(note.title);
      setEditContent(null);
      setIsEditing(true);
      setIsCreating(false);
      toast.success("Note created");
    },
    onError: () => toast.error("Failed to create note"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title: string; content: any }) => {
      const { error } = await supabase
        .from("personal_notes")
        .update({ title, content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-notes"] });
      toast.success("Note saved");
    },
    onError: () => toast.error("Failed to save note"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("personal_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-notes"] });
      if (selectedNote && deleteNote && selectedNote.id === deleteNote.id) {
        setSelectedNote(null);
        setIsEditing(false);
      }
      setDeleteNote(null);
      toast.success("Note deleted");
    },
    onError: () => toast.error("Failed to delete note"),
  });

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase())
  );

  const openNote = (note: PersonalNote) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(migrateLegacyData(note.content));
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!selectedNote) return;
    updateMutation.mutate({ id: selectedNote.id, title: editTitle || "Untitled Note", content: editContent });
  };

  const getContentPreview = (content: any): string => {
    if (!content) return "No content";
    const data = migrateLegacyData(content);
    if (!data) return "No content";
    for (const block of data.blocks) {
      if (block.type === "text" && block.content?.trim()) {
        return block.content.slice(0, 100) + (block.content.length > 100 ? "..." : "");
      }
      if (block.type === "table") return "📊 Table";
    }
    return "No content";
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <StickyNote className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Personal Notes</h1>
              <p className="text-xs text-muted-foreground">{notes.length} notes</p>
            </div>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Note
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: Note List */}
          <div className="w-full md:w-80 border-r flex flex-col bg-muted/20" style={{ display: isEditing && window.innerWidth < 768 ? "none" : "flex" }}>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {isLoading ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No notes found</p>
                  </div>
                ) : (
                  filtered.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => openNote(note)}
                      className={`p-3 rounded-xl cursor-pointer transition-all duration-150 group ${
                        selectedNote?.id === note.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/60 border border-transparent"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-foreground truncate">
                            {note.title || "Untitled Note"}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {getContentPreview(note.content)}
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/60">
                            <Clock className="h-3 w-3" />
                            {format(new Date(note.updated_at), "dd MMM yyyy, HH:mm")}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteNote(note);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Editor Panel */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ display: !isEditing && window.innerWidth < 768 ? "none" : "flex" }}>
            {selectedNote && isEditing ? (
              <>
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-background/80">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden h-8 text-xs"
                    onClick={() => setIsEditing(false)}
                  >
                    ← Back
                  </Button>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Note title..."
                    className="border-0 bg-transparent text-lg font-semibold focus-visible:ring-0 px-0 h-auto"
                  />
                  <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-4 md:p-6">
                  <div className="max-w-3xl mx-auto">
                    <RichBriefEditor
                      data={editContent}
                      onChange={setEditContent}
                    />
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <StickyNote className="h-16 w-16 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Select a note or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteNote} onOpenChange={(open) => !open && setDeleteNote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteNote?.title || "Untitled Note"}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteNote && deleteMutation.mutate(deleteNote.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
