import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ArrowLeft, BookOpen, FileText, Layers, Hash, Calendar, Download, Plus, Edit } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Types
interface NoteMetadata {
  id: string;
  title: string;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  created_at: string;
}

interface NoteContent extends NoteMetadata {
  content: string | null;
  notes_url: string | null;
  course: {
    name: string;
  };
}

const FreeClass = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Free Classes – Atlas";
  }, []);

  // State for navigation
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Fetch Metadata of all free notes
  const { data: notesMetadata, isLoading } = useQuery({
    queryKey: ["public-free-notes-metadata"],
    queryFn: async () => {
      // Fetch notes linked to public courses OR courses with price 0
      // Since we can't do complex OR across relations easily, we'll stick to is_public for now as per plan
      const { data, error } = await supabase
        .from("class_notes")
        .select("id, title, subject, chapter, topic, created_at, courses!inner(is_public)")
        .eq("courses.is_public", true);

      if (error) throw error;
      return data as NoteMetadata[];
    },
  });

  // Fetch Content of a single note when selected
  const { data: noteContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ["public-note-content", selectedNoteId],
    queryFn: async () => {
      if (!selectedNoteId) return null;
      const { data, error } = await supabase
        .from("class_notes")
        .select("*, course:courses(name)")
        .eq("id", selectedNoteId)
        .single();

      if (error) throw error;
      return data as NoteContent;
    },
    enabled: !!selectedNoteId,
  });

  // Helper to extract unique values
  const getUniqueValues = (data: NoteMetadata[] | undefined, key: keyof NoteMetadata) => {
    if (!data || !Array.isArray(data)) return [];
    const values = data.map(item => item[key]).filter(Boolean) as string[];
    return Array.from(new Set(values)).sort();
  };

  // Filter logic
  const filteredNotes = (Array.isArray(notesMetadata) ? notesMetadata : [])?.filter(note => {
    if (selectedSubject && note.subject !== selectedSubject) return false;
    if (selectedChapter && note.chapter !== selectedChapter) return false;
    if (selectedTopic && note.topic !== selectedTopic) return false;
    return true;
  }) || [];

  // View Logic
  const handleBack = () => {
    if (selectedNoteId) {
      setSelectedNoteId(null);
    } else if (selectedTopic) {
      setSelectedTopic(null);
    } else if (selectedChapter) {
      setSelectedChapter(null);
    } else if (selectedSubject) {
      setSelectedSubject(null);
    }
  };

  // Level 1: Subjects
  if (!selectedSubject) {
    const subjects = getUniqueValues(notesMetadata, "subject");
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <PublicHeader />
        <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        <div className="mb-8 text-center relative">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Free Classes</h1>
            <p className="text-muted-foreground">Select a subject to explore free resources.</p>
            {isAdmin && (
                <Button
                    className="absolute top-0 right-0"
                    onClick={() => navigate("/dashboard/admin/notes")}
                >
                    <Plus className="mr-2 h-4 w-4" /> Add Note
                </Button>
            )}
        </div>

        {isLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
             </div>
        ) : subjects.length === 0 ? (
            <div className="text-center py-20 bg-muted/30 rounded-lg">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
                <h3 className="text-lg font-medium">No free classes available at the moment.</h3>
                <p className="text-sm text-muted-foreground">Please check back later.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {subjects.map(subject => (
                    <Card
                        key={subject}
                        className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group"
                        onClick={() => setSelectedSubject(subject)}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Subject</CardTitle>
                            <BookOpen className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-primary mb-1">{subject}</div>
                            <p className="text-xs text-muted-foreground">
                                {notesMetadata?.filter(n => n.subject === subject).length} resources
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}
        </main>
      </div>
    );
  }

  // Level 2: Chapters
  if (!selectedChapter) {
    const chapters = getUniqueValues(filteredNotes, "chapter");
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <PublicHeader />
        <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent" onClick={handleBack}>
             <ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects
        </Button>

        <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-primary">{selectedSubject}</h2>
            <p className="text-muted-foreground">Select a chapter.</p>
        </div>

        {chapters.length === 0 ? (
             <div className="text-center py-12 border rounded-lg">
                <p>No chapters found for this subject.</p>
             </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {chapters.map(chapter => (
                    <Card
                        key={chapter}
                        className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group"
                        onClick={() => setSelectedChapter(chapter)}
                    >
                        <CardHeader className="pb-2">
                             <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                <Layers className="h-5 w-5 text-primary" />
                             </div>
                             <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">{chapter}</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <p className="text-xs text-muted-foreground">
                                {filteredNotes.filter(n => n.chapter === chapter).length} topics
                             </p>
                        </CardContent>
                        <CardFooter className="pt-0">
                            <div className="text-xs text-primary font-medium flex items-center mt-auto">
                                Explore Topics <ChevronRight className="h-3 w-3 ml-1" />
                            </div>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        )}
        </main>
      </div>
    );
  }

  // Level 3: Topics (Class Types)
  // If we have topics, show them. If not, list notes directly?
  // The user requirement: Subject -> Chapter -> Class Types -> Content
  // If a note has no topic, we group it under "General" or similar, or just show it.
  if (!selectedTopic && !selectedNoteId) {
    const topics = getUniqueValues(filteredNotes, "topic");

    // If there are no topics defined, or only empty topics, we skip this level and show list of notes?
    // But user asked for "Class types". If topics exist, we show them.
    // If filteredNotes has items with empty topic, handle them.

    const hasTopics = topics.length > 0;

    if (!hasTopics) {
        // Skip to listing notes if no topics
        // But for consistency with the requested flow, maybe we treat individual notes as the "Content" level directly.
        // Let's render the list of notes here directly if no topics found.
    }

    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <PublicHeader />
        <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent" onClick={handleBack}>
             <ArrowLeft className="mr-2 h-4 w-4" /> Back to Chapters
        </Button>

        <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span>{selectedSubject}</span>
                <ChevronRight className="h-3 w-3" />
                <span>{selectedChapter}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Select Class Type</h2>
        </div>

        {hasTopics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {topics.map(topic => (
                    <Card
                        key={topic}
                        className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group"
                        onClick={() => setSelectedTopic(topic)}
                    >
                         <CardHeader className="pb-2">
                             <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center mb-2">
                                <Hash className="h-5 w-5 text-foreground" />
                             </div>
                             <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">{topic}</CardTitle>
                        </CardHeader>
                         <CardContent>
                             <p className="text-xs text-muted-foreground">
                                {filteredNotes.filter(n => n.topic === topic).length} items
                             </p>
                        </CardContent>
                         <CardFooter className="pt-0">
                            <div className="text-xs text-primary font-medium flex items-center mt-auto">
                                View Content <ChevronRight className="h-3 w-3 ml-1" />
                            </div>
                        </CardFooter>
                    </Card>
                ))}
                {/* Handle notes without topic if any */}
                {filteredNotes.some(n => !n.topic) && (
                     <Card
                        className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group border-dashed"
                        onClick={() => setSelectedTopic("General")} // Special handling needed?
                    >
                         <CardHeader className="pb-2">
                             <CardTitle className="text-lg">General / Other</CardTitle>
                        </CardHeader>
                         <CardContent>
                             <p className="text-xs text-muted-foreground">
                                {filteredNotes.filter(n => !n.topic).length} items
                             </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        ) : (
            // No topics found, list notes directly
             <div className="grid grid-cols-1 gap-4">
                 {filteredNotes.map(note => (
                     <Card
                        key={note.id}
                        className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-sm"
                        onClick={() => setSelectedNoteId(note.id)}
                     >
                         <CardHeader className="flex flex-row items-center gap-4 py-4">
                             <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                 <FileText className="h-5 w-5" />
                             </div>
                             <div>
                                 <CardTitle className="text-base">{note.title}</CardTitle>
                                 <CardDescription className="text-xs mt-1">
                                     {new Date(note.created_at).toLocaleDateString()}
                                 </CardDescription>
                             </div>
                         </CardHeader>
                     </Card>
                 ))}
             </div>
        )}
        </main>
      </div>
    );
  }

  // Level 3.5: List of Notes in a Topic (if we selected a topic)
  if (selectedTopic && !selectedNoteId) {
      // Filter notes by topic
      // Handle "General" case if we implemented it
      const notesInTopic = filteredNotes.filter(n => n.topic === selectedTopic);

      // If only one note, maybe auto-select? Let's keep it manual for clarity.

      return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <PublicHeader />
            <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
            <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Topics
            </Button>

            <div className="mb-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <span>{selectedSubject}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{selectedChapter}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{selectedTopic}</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Available Content</h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
                 {notesInTopic.map(note => (
                     <Card
                        key={note.id}
                        className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-sm"
                        onClick={() => setSelectedNoteId(note.id)}
                     >
                         <CardHeader className="flex flex-row items-center gap-4 py-4">
                             <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                 <FileText className="h-5 w-5" />
                             </div>
                             <div>
                                 <CardTitle className="text-base">{note.title}</CardTitle>
                                 <CardDescription className="text-xs mt-1 flex items-center gap-2">
                                     <Calendar className="h-3 w-3" />
                                     {new Date(note.created_at).toLocaleDateString()}
                                 </CardDescription>
                             </div>
                             <div className="ml-auto flex items-center gap-2">
                                 {isAdmin && (
                                     <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/dashboard/admin/notes?editId=${note.id}`);
                                        }}
                                     >
                                         <Edit className="h-4 w-4" />
                                     </Button>
                                 )}
                                 <Button variant="ghost" size="sm">View</Button>
                             </div>
                         </CardHeader>
                     </Card>
                 ))}
             </div>
            </main>
        </div>
      );
  }

  // Level 4: Note Content
  if (selectedNoteId) {
      return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <PublicHeader />
            <main className="container mx-auto px-4 py-8 max-w-4xl flex-1">
            <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>

            {isLoadingContent ? (
                <div className="space-y-4 animate-pulse">
                    <div className="h-8 bg-muted w-3/4 rounded"></div>
                    <div className="h-4 bg-muted w-1/2 rounded"></div>
                    <div className="h-[400px] bg-muted rounded"></div>
                </div>
            ) : !noteContent ? (
                <div className="text-center py-10">Note not found.</div>
            ) : (
                <div className="space-y-6">
                    <div>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground items-center mb-2">
                             <span className="font-semibold text-primary">{noteContent.course?.name}</span>
                             <span>•</span>
                             <span>{noteContent.subject}</span>
                             {noteContent.chapter && (
                                <>
                                    <span>•</span>
                                    <span>{noteContent.chapter}</span>
                                </>
                             )}
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">{noteContent.title}</h1>
                        <div className="flex gap-2 mt-4">
                             {noteContent.topic && <Badge variant="secondary">{noteContent.topic}</Badge>}
                        </div>
                    </div>

                    <Card className="min-h-[50vh] border-none shadow-sm bg-card/50">
                        <CardContent className="p-6 md:p-10">
                            {noteContent.content ? (
                                <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-m-20 prose-headings:tracking-tight prose-a:text-primary hover:prose-a:underline prose-img:rounded-xl">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {noteContent.content}
                                    </ReactMarkdown>
                                </article>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
                                    <FileText className="h-16 w-16 mb-4" />
                                    <p>This note has no text content.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {noteContent.notes_url && (
                        <div className="flex justify-end">
                            <Button size="lg" className="shadow-lg rounded-full" asChild>
                                <a href={noteContent.notes_url} target="_blank" rel="noopener noreferrer">
                                    <Download className="mr-2 h-4 w-4" /> Download PDF
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            )}
            </main>
        </div>
      );
  }

  return null;
};

export default FreeClass;
