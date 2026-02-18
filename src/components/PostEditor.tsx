import React, { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { toast } from "sonner";
import {
  Bold, Italic, Code,
  Image as ImageIcon, Layout, Info, AlertTriangle, CheckCircle, XCircle,
  Star, Gift, BarChart2, MessageSquare,
  Trash2, ArrowUp, ArrowDown, Plus, Eye, Edit2, GripVertical, MoreVertical
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PostEditorProps {
  initialValue?: string;
  onChange: (value: string) => void;
  minHeight?: string;
}

interface Block {
  id: string;
  type: string;
  content: string;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// Standalone SnippetMenu Component
interface SnippetMenuProps {
  onInsert: (snippet: string, typeLabel?: string) => void;
  isMobile?: boolean;
}

const SnippetMenu: React.FC<SnippetMenuProps> = React.memo(({ onInsert, isMobile = false }) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", isMobile ? "w-full justify-center" : "")}>
          <Plus className="h-4 w-4" /> <span className={cn(isMobile ? "inline" : "hidden sm:inline")}>Insert Feature</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 z-50" align="start" sideOffset={5}>
        <DropdownMenuLabel>Formatting</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onInsert("# ")}>H1 Heading</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onInsert("## ")}>H2 Heading</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onInsert("**bold**")}>Bold</DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger><ImageIcon className="mr-2 h-4 w-4" /> Media</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => onInsert('<img src="..." class="img-medium" />', "image")}>Image (Standard)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onInsert('<div class="video-wrapper">\n  <iframe src="https://www.youtube.com/embed/VIDEO_ID" title="Video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>\n</div>', "video")}>Video Embed</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Layout className="mr-2 h-4 w-4" /> Callouts</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
             <DropdownMenuItem onSelect={() => onInsert('<div class="callout callout-info">\n  <strong>💡 Pro Tip:</strong> ...\n</div>', "callout")}>
               <Info className="mr-2 h-4 w-4 text-blue-500" /> Info
             </DropdownMenuItem>
             <DropdownMenuItem onSelect={() => onInsert('<div class="callout callout-warning">\n  <strong>⚠️ Warning:</strong> ...\n</div>', "callout")}>
               <AlertTriangle className="mr-2 h-4 w-4 text-yellow-500" /> Warning
             </DropdownMenuItem>
             <DropdownMenuItem onSelect={() => onInsert('<div class="callout callout-success">\n  <strong>✅ Success:</strong> ...\n</div>', "callout")}>
               <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Success
             </DropdownMenuItem>
             <DropdownMenuItem onSelect={() => onInsert('<div class="callout callout-error">\n  <strong>❌ Error:</strong> ...\n</div>', "callout")}>
               <XCircle className="mr-2 h-4 w-4 text-red-500" /> Error
             </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Star className="mr-2 h-4 w-4" /> Marketing</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
             <DropdownMenuItem onSelect={() => onInsert('<div class="feature-card">\n  <div class="feature-icon">🚀</div>\n  <h3>Title</h3>\n  <p>Desc...</p>\n</div>', "feature")}>Feature Card</DropdownMenuItem>
             <DropdownMenuItem onSelect={() => onInsert('<div class="promo-banner">\n  <div class="promo-content">\n    <span class="promo-badge">NEW</span>\n    <h3>Offer!</h3>\n    <p>...</p>\n  </div>\n  <a href="#" class="promo-cta">Get it</a>\n</div>', "promo")}>Promo Banner</DropdownMenuItem>
             <DropdownMenuItem onSelect={() => onInsert('<div class="stats-grid">\n  <div class="stat-card">\n    <div class="stat-number">100+</div>\n    <div class="stat-label">Users</div>\n  </div>\n</div>', "stats")}>Stats Grid</DropdownMenuItem>
             <DropdownMenuItem onSelect={() => onInsert('<div class="testimonial-card">\n  <p class="testimonial-text">"..."</p>\n  <div class="testimonial-author">\n    <strong>Name</strong>\n  </div>\n</div>', "testimonial")}>Testimonial</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Layout className="mr-2 h-4 w-4" /> Layouts</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => onInsert('<div class="two-column">\n  <div class="column">Left</div>\n  <div class="column">Right</div>\n</div>', "layout")}>Two Columns</DropdownMenuItem>
             <DropdownMenuItem onSelect={() => onInsert('<details class="accordion">\n  <summary>Q?</summary>\n  <div class="accordion-content">A...</div>\n</details>', "accordion")}>Accordion</DropdownMenuItem>
             <DropdownMenuItem onSelect={() => onInsert('<a href="#" class="btn btn-primary">Button</a>', "button")}>Button</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onInsert("```javascript\n\n```", "code")}><Code className="mr-2 h-4 w-4" /> Code Block</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
SnippetMenu.displayName = "SnippetMenu";

export const PostEditor: React.FC<PostEditorProps> = ({ initialValue = "", onChange, minHeight = "400px" }) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      if (initialValue) {
        // Simple splitting logic: split by double newlines to try and reconstruct blocks
        // This is a best-effort approach to load existing content
        const splitContent = initialValue.split(/\n\n+/);
        if (splitContent.length > 0) {
             setBlocks(splitContent.map(content => ({ id: generateId(), type: 'markdown', content })));
        } else {
             setBlocks([{ id: generateId(), type: 'markdown', content: initialValue }]);
        }
      } else {
        setBlocks([{ id: generateId(), type: 'markdown', content: "" }]);
      }
      setInitialized(true);
    }
  }, [initialValue, initialized]);

  useEffect(() => {
    if (initialized) {
      const fullContent = blocks.map(b => b.content).join("\n\n");
      onChange(fullContent);
    }
  }, [blocks, onChange, initialized]);

  const updateBlock = (id: string, content: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
  };

  const addBlock = (index: number) => {
    const newBlock = { id: generateId(), type: 'markdown', content: "" };
    setBlocks(prev => {
      const newBlocks = [...prev];
      newBlocks.splice(index + 1, 0, newBlock);
      return newBlocks;
    });
  };

  const deleteBlock = (index: number) => {
    if (blocks.length <= 1) {
      updateBlock(blocks[0].id, "");
      toast.info("Cleared the last block.");
      return;
    }
    setBlocks(prev => prev.filter((_, i) => i !== index));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;

    setBlocks(prev => {
      const newBlocks = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
      return newBlocks;
    });
  };

  // Stable callback for insertion
  const handleInsertSnippet = useCallback((blockId: string) => (snippet: string, typeLabel: string = "markdown") => {
    setBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        const newContent = b.content ? `${b.content}\n${snippet}` : snippet;
        return { ...b, content: newContent, type: typeLabel };
      }
      return b;
    }));
    toast.success(`Inserted ${typeLabel}`);
  }, []);

  const fullContent = blocks.map(b => b.content).join("\n\n");

  return (
    <div className="flex flex-col gap-4 w-full animate-in fade-in duration-300">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2">
           <Badge variant="secondary" className="font-mono text-xs">
             {blocks.length} Blocks
           </Badge>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
          <Button
            variant={!isPreviewMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPreviewMode(false)}
            className="h-7 text-xs px-3"
          >
            <Edit2 className="mr-2 h-3 w-3" /> Edit
          </Button>
          <Button
            variant={isPreviewMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPreviewMode(true)}
             className="h-7 text-xs px-3"
          >
            <Eye className="mr-2 h-3 w-3" /> Preview
          </Button>
        </div>
      </div>

      {isPreviewMode ? (
        <Card style={{ minHeight }} className="border-2 border-primary/10 shadow-inner bg-muted/5">
          <CardContent className="p-6 prose dark:prose-invert max-w-none prose-img:rounded-xl prose-img:shadow-lg">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
                 img: ({node, ...props}: any) => <img {...props} className="rounded-lg max-w-full mx-auto" loading="lazy" />
              }}
            >
              {fullContent || "_No content_"}
            </ReactMarkdown>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6 pb-20">
          {blocks.map((block, index) => (
            <div key={block.id} className="group relative">

               {/* Block Card */}
               <Card className="border shadow-sm hover:shadow-md transition-all duration-200 overflow-visible group-hover:border-primary/30">

                 {/* Mobile-Friendly Control Bar (Top) */}
                 <div className="flex items-center justify-between p-2 border-b bg-muted/20 rounded-t-lg">
                    <div className="flex items-center gap-2">
                       <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
                       <span className="text-[10px] font-mono text-muted-foreground">#{index + 1}</span>
                       <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal bg-background/50 border-0">
                          {block.type}
                       </Badge>
                    </div>

                    {/* Controls Actions */}
                    <div className="flex items-center gap-1">
                       <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => moveBlock(index, 'up')} disabled={index === 0}>
                         <ArrowUp className="h-3 w-3" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1}>
                         <ArrowDown className="h-3 w-3" />
                       </Button>
                       <div className="h-4 w-px bg-border mx-1"></div>
                       <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 text-destructive hover:bg-destructive/10" onClick={() => deleteBlock(index)}>
                         <Trash2 className="h-3 w-3" />
                       </Button>
                    </div>
                 </div>

                 <CardContent className="p-0">
                    <Textarea
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, e.target.value)}
                      className="min-h-[150px] font-mono text-sm resize-y border-0 rounded-none focus-visible:ring-0 p-4 shadow-none bg-transparent leading-relaxed"
                      placeholder="Type Markdown or HTML snippets here..."
                    />
                 </CardContent>

                 {/* Bottom Actions for Block */}
                 <div className="p-2 border-t bg-muted/10 rounded-b-lg flex justify-between items-center gap-2">
                    <SnippetMenu onInsert={handleInsertSnippet(block.id)} />
                    <Button variant="secondary" size="sm" onClick={() => addBlock(index)} className="gap-2">
                       <Plus className="h-3 w-3" /> <span className="hidden sm:inline">Add Below</span>
                    </Button>
                 </div>
               </Card>

               {/* Center Add Button Visual Aid */}
               <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="outline" className="h-6 w-6 rounded-full shadow-sm bg-background" onClick={() => addBlock(index)}>
                    <Plus className="h-3 w-3" />
                  </Button>
               </div>
            </div>
          ))}

          <Button variant="outline" className="w-full py-8 border-dashed border-2 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => addBlock(blocks.length - 1)}>
            <Plus className="h-6 w-6 mr-2" /> Add New Block at End
          </Button>
        </div>
      )}
    </div>
  );
};
