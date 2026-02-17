import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { toast } from "sonner";
import {
  Bold, Italic, Strikethrough, Code, Highlighter,
  Image as ImageIcon, Video, Quote, List, ListOrdered, CheckSquare, Minus,
  Table as TableIcon, Layout, Info, AlertTriangle, CheckCircle, XCircle,
  Star, Gift, BarChart2, MessageSquare, Link as LinkIcon, HelpCircle,
  MoreVertical, Trash2, ArrowUp, ArrowDown, Plus, Eye, Edit2, GripVertical
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface PostEditorProps {
  initialValue?: string;
  onChange: (value: string) => void;
  minHeight?: string;
}

interface Block {
  id: string;
  type: string; // 'markdown', 'html', or specific component types for badge display
  content: string;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const PostEditor: React.FC<PostEditorProps> = ({ initialValue = "", onChange, minHeight = "400px" }) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize blocks from initialValue
  useEffect(() => {
    if (!initialized) {
      if (initialValue) {
        // Try to split by double newline to create blocks, but be careful not to break code blocks
        // For safety, we'll start with one big block to preserve existing content structure perfectly
        // User can split it manually if they want
        setBlocks([{ id: generateId(), type: 'markdown', content: initialValue }]);
      } else {
        setBlocks([{ id: generateId(), type: 'markdown', content: "" }]);
      }
      setInitialized(true);
    }
  }, [initialValue, initialized]);

  // Update parent when blocks change
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
      // Don't delete the last block, just clear it
      updateBlock(blocks[0].id, "");
      toast.info("Cleared the last block instead of deleting it.");
      return;
    }
    setBlocks(prev => prev.filter((_, i) => i !== index));
    toast.success("Block deleted");
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

  const insertSnippet = (blockId: string, snippet: string, typeLabel: string = "markdown") => {
    setBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        // If block is empty, just replace. If not, append.
        const newContent = b.content ? `${b.content}\n${snippet}` : snippet;
        return { ...b, content: newContent, type: typeLabel };
      }
      return b;
    }));
    toast.success(`Inserted ${typeLabel}`);
  };

  const SnippetMenu = ({ blockId }: { blockId: string }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <Plus className="h-4 w-4" /> Insert
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>Formatting</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => insertSnippet(blockId, "# ")}>
           H1 Heading
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => insertSnippet(blockId, "## ")}>
           H2 Heading
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => insertSnippet(blockId, "**bold**")}>
          <Bold className="mr-2 h-4 w-4" /> Bold
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => insertSnippet(blockId, "*italic*")}>
          <Italic className="mr-2 h-4 w-4" /> Italic
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ImageIcon className="mr-2 h-4 w-4" /> Media
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => insertSnippet(blockId, '<img src="..." class="img-small" />', "image")}>
              Small Image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertSnippet(blockId, '![Alt text](...)', "image")}>
              Medium Image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertSnippet(blockId, '<img src="..." class="img-large" />', "image")}>
              Large Image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertSnippet(blockId, '<figure class="img-medium">\n  <img src="..." alt="..." />\n  <figcaption>Caption text</figcaption>\n</figure>', "image")}>
              Image + Caption
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertSnippet(blockId, '<div class="video-wrapper">\n  <iframe src="..."></iframe>\n</div>', "video")}>
              Video Embed
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Layout className="mr-2 h-4 w-4" /> Components
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
             <DropdownMenuItem onClick={() => insertSnippet(blockId, '<div class="callout callout-info">\n  <strong>💡 Pro Tip:</strong> Your message here\n</div>', "callout")}>
               <Info className="mr-2 h-4 w-4 text-blue-500" /> Info Box
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => insertSnippet(blockId, '<div class="callout callout-warning">\n  <strong>⚠️ Warning:</strong> Your message here\n</div>', "callout")}>
               <AlertTriangle className="mr-2 h-4 w-4 text-yellow-500" /> Warning Box
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => insertSnippet(blockId, '<div class="callout callout-success">\n  <strong>✅ Success:</strong> Your message here\n</div>', "callout")}>
               <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Success Box
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => insertSnippet(blockId, '<div class="callout callout-error">\n  <strong>❌ Error:</strong> Your message here\n</div>', "callout")}>
               <XCircle className="mr-2 h-4 w-4 text-red-500" /> Error Box
             </DropdownMenuItem>
             <DropdownMenuSeparator />
             <DropdownMenuItem onClick={() => insertSnippet(blockId, '<div class="feature-card">\n  <div class="feature-icon">🚀</div>\n  <h3>Feature Title</h3>\n  <p>Description...</p>\n</div>', "feature")}>
               <Star className="mr-2 h-4 w-4" /> Feature Card
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => insertSnippet(blockId, '<div class="promo-banner">\n  <div class="promo-content">\n    <span class="promo-badge">NEW</span>\n    <h3>Limited Time Offer!</h3>\n    <p>Details...</p>\n  </div>\n  <a href="#" class="promo-cta">Claim Now →</a>\n</div>', "promo")}>
               <Gift className="mr-2 h-4 w-4" /> Promo Banner
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => insertSnippet(blockId, '<div class="stats-grid">\n  <div class="stat-card">\n    <div class="stat-number">500+</div>\n    <div class="stat-label">Students</div>\n  </div>\n</div>', "stats")}>
               <BarChart2 className="mr-2 h-4 w-4" /> Stats Grid
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => insertSnippet(blockId, '<div class="testimonial-card">\n  <p class="testimonial-text">"Quote..."</p>\n  <div class="testimonial-author">\n    <strong>Name</strong>\n    <span>Title</span>\n  </div>\n</div>', "testimonial")}>
               <MessageSquare className="mr-2 h-4 w-4" /> Testimonial
             </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
             <Layout className="mr-2 h-4 w-4" /> Layouts
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => insertSnippet(blockId, '<div class="two-column">\n  <div class="column">Left content</div>\n  <div class="column">Right content</div>\n</div>', "layout")}>
              Two Columns
            </DropdownMenuItem>
             <DropdownMenuItem onClick={() => insertSnippet(blockId, '<details class="accordion">\n  <summary>Question?</summary>\n  <div class="accordion-content">Answer...</div>\n</details>', "accordion")}>
              Accordion / FAQ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertSnippet(blockId, '<div class="steps">\n  <div class="step">\n    <div class="step-number">1</div>\n    <div class="step-content">\n      <h4>Step Title</h4>\n      <p>Description</p>\n    </div>\n  </div>\n</div>', "steps")}>
              Step Guide
            </DropdownMenuItem>
             <DropdownMenuItem onClick={() => insertSnippet(blockId, '<a href="#" class="btn btn-primary">Button</a>', "button")}>
              Primary Button
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => insertSnippet(blockId, "```javascript\n\n```", "code")}>
          <Code className="mr-2 h-4 w-4" /> Code Block
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => insertSnippet(blockId, "> ", "quote")}>
          <Quote className="mr-2 h-4 w-4" /> Quote
        </DropdownMenuItem>
         <DropdownMenuItem onClick={() => insertSnippet(blockId, "| Header | Header |\n| --- | --- |\n| Cell | Cell |", "table")}>
          <TableIcon className="mr-2 h-4 w-4" /> Table
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const fullContent = blocks.map(b => b.content).join("\n\n");

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg border">
        <div className="flex items-center gap-2">
           <Badge variant="outline" className="bg-background">
             {blocks.length} Blocks
           </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isPreviewMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIsPreviewMode(false)}
            className="h-8"
          >
            <Edit2 className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button
            variant={isPreviewMode ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setIsPreviewMode(true)}
             className="h-8"
          >
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
        </div>
      </div>

      {isPreviewMode ? (
        <Card style={{ minHeight }}>
          <CardContent className="p-6 prose dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                 img: ({node, ...props}) => <img {...props} className="rounded-lg max-w-full" style={{ maxHeight: '500px' }} />
              }}
            >
              {fullContent || "_No content_"}
            </ReactMarkdown>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {blocks.map((block, index) => (
            <div key={block.id} className="group flex gap-2 items-start animate-in fade-in duration-300">
               {/* Drag/Controls Handle (Visual only for now unless using dnd-kit) */}
               <div className="flex flex-col gap-1 mt-2 text-muted-foreground/50">
                  <div className="p-1 cursor-grab hover:text-foreground">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="text-[10px] text-center font-mono opacity-50">{index + 1}</div>
               </div>

               <Card className="flex-1 border-muted-foreground/20 shadow-sm group-hover:shadow-md transition-all group-hover:border-primary/20">
                 <div className="flex items-center justify-between p-2 border-b bg-muted/10 rounded-t-xl">
                    <div className="flex items-center gap-2">
                       <Badge variant="secondary" className="text-xs font-normal h-6">
                          {block.type}
                       </Badge>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveBlock(index, 'up')} disabled={index === 0}>
                         <ArrowUp className="h-3 w-3" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1}>
                         <ArrowDown className="h-3 w-3" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteBlock(index)}>
                         <Trash2 className="h-3 w-3" />
                       </Button>
                    </div>
                 </div>
                 <CardContent className="p-3">
                    <Textarea
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, e.target.value)}
                      className="min-h-[120px] font-mono text-sm resize-y border-0 focus-visible:ring-0 p-0 shadow-none"
                      placeholder="Type markdown or HTML here..."
                    />
                 </CardContent>
                 <div className="p-2 border-t bg-muted/5 flex justify-between items-center rounded-b-xl">
                    <SnippetMenu blockId={block.id} />
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => addBlock(index)}>
                      <Plus className="h-3 w-3 mr-1" /> Add Block Below
                    </Button>
                 </div>
               </Card>
            </div>
          ))}

          <Button variant="outline" className="border-dashed w-full py-8 text-muted-foreground hover:text-primary" onClick={() => addBlock(blocks.length - 1)}>
            <Plus className="h-5 w-5 mr-2" /> Add New Block
          </Button>
        </div>
      )}
    </div>
  );
};
