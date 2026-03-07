import re

with open('src/components/admin/QuestionEditor.tsx', 'r') as f:
    content = f.read()

# I will write the replacement code in a python script to avoid git merge diff syntax errors if any.
new_imports = """import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, Save, Image as ImageIcon, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormulaEditorDialog } from "@/components/ui/formula-editor-dialog";
import { CreatableSelect } from "@/components/ui/creatable-select";
import { MultiSelect } from "@/components/ui/multi-select";
import { useGlobalMetadata, useAddGlobalMetadata } from "@/hooks/useGlobalMetadata";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
"""

content = re.sub(r'import React,.*?import Cropper from "react-cropper";\n', new_imports, content, flags=re.DOTALL)

# Delete base64ToBlob
content = re.sub(r'// Helper to convert base64 to Blob\nconst base64ToBlob =.*?};\n\n', '', content, flags=re.DOTALL)

# Update QuestionData interface
old_interface = """export interface QuestionData {
    id?: string;
    question: string;
    options: { [key: string]: string };
    correct_answer: string;
    explanation: string;
}"""

new_interface = """export interface QuestionData {
    id?: string;
    question: string;
    options: { [key: string]: string };
    correct_answer: string;
    explanation: string;
    subject?: string;
    chapter?: string;
    topic?: string;
    exam_code?: string;
    year?: string;
    difficulty?: string;
    tags?: string[];
}"""

content = content.replace(old_interface, new_interface)

# Update Component Body
old_body_start = """export const QuestionEditor = ({ data, onChange, onSave, onCancel }: QuestionEditorProps) => {
    // Formula Editor State
    const [formulaState, setFormulaState] = useState<{ isOpen: boolean; targetQuill: any | null }>({
        isOpen: false,
        targetQuill: null
    });

    // Image Cropper State
    const [showCropModal, setShowCropModal] = useState(false);
    const [cropImage, setCropImage] = useState<string>("");
    const [currentQuillRef, setCurrentQuillRef] = useState<any>(null);
    const [cropper, setCropper] = useState<any>();"""

new_body_start = """export const QuestionEditor = ({ data, onChange, onSave, onCancel }: QuestionEditorProps) => {
    // Formula Editor State
    const [formulaState, setFormulaState] = useState<{ isOpen: boolean; targetId: string | null }>({
        isOpen: false,
        targetId: null
    });

    // Global Metadata Hook
    const { data: globalMeta } = useGlobalMetadata() as any;
    const addMetadata = useAddGlobalMetadata();

    const { data: distinctMetadata } = useQuery({
        queryKey: ["question-bank-metadata"],
        queryFn: async () => {
            const { data } = await supabase.from("question_bank").select("subject, chapter, topic");
            return data || [];
        }
    });

    const subjectOptions = React.useMemo(() => {
        const set = new Set<string>();
        globalMeta?.subject?.forEach((s: any) => set.add(s.value));
        distinctMetadata?.forEach((item: any) => {
             if (item.subject) set.add(item.subject);
        });
        return Array.from(set).sort().map(s => ({ label: s, value: s }));
    }, [globalMeta, distinctMetadata]);

    const chapterOptions = React.useMemo(() => {
        const set = new Set<string>();
        globalMeta?.chapter?.forEach((c: any) => set.add(c.value));
        distinctMetadata?.forEach((item: any) => {
            if (!item.chapter) return;
            if (data.subject && item.subject !== data.subject) return;
            set.add(item.chapter);
        });
        return Array.from(set).sort().map(c => ({ label: c, value: c }));
    }, [globalMeta, distinctMetadata, data.subject]);

    const topicOptions = React.useMemo(() => {
        const set = new Set<string>();
        globalMeta?.topic?.forEach((t: any) => set.add(t.value));
        distinctMetadata?.forEach((item: any) => {
            if (!item.topic) return;
            if (data.chapter && item.chapter !== data.chapter) return;
            set.add(item.topic);
        });
        return Array.from(set).sort().map(t => ({ label: t, value: t }));
    }, [globalMeta, distinctMetadata, data.chapter]);

    const handleCreateMeta = (type: 'subject' | 'chapter' | 'topic' | 'exam_code' | 'year' | 'tag', value: string) => {
        addMetadata.mutate({ type, value });
        if (type === 'tag') {
            onChange({ ...data, tags: [...(data.tags || []), value] });
        } else {
            onChange({ ...data, [type]: value });
        }
    };
"""

content = content.replace(old_body_start, new_body_start)

# Replace image upload and formula logic
logic_to_replace = """    // Image Upload Handler
    const handleImageUpload = useCallback((quillRef: any) => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();
        input.onchange = async () => {
            const file = input.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e: any) => {
                    setCropImage(e.target.result);
                    setCurrentQuillRef(quillRef);
                    setShowCropModal(true);
                };
                reader.readAsDataURL(file);
            }
        };
    }, []);

    const insertCroppedImage = () => {
        if (typeof cropper !== "undefined" && currentQuillRef) {
            const editor = currentQuillRef.getEditor();
            const range = editor.getSelection(true);
            const index = range ? range.index : editor.getLength();

            editor.insertEmbed(index, "image", cropper.getCroppedCanvas().toDataURL());
            setShowCropModal(false);
            setCropImage("");
        }
    };

    // Formula Handlers
    const handleOpenFormula = useCallback((quillRef: any) => {
        setFormulaState({ isOpen: true, targetQuill: quillRef });
    }, []);

    const handleFormulaInsert = (latex: string) => {
        if (formulaState.targetQuill) {
            const editor = formulaState.targetQuill.getEditor();
            const range = editor.getSelection(true);
            const index = range ? range.index : editor.getLength();

            editor.insertText(index, `$${latex}$ `);

            // Move cursor after the inserted formula and space
            // FIX: Increased timeout to 100ms to ensure editor regains focus after dialog close
            setTimeout(() => {
                editor.setSelection(index + latex.length + 3);
                editor.focus();
            }, 100);
        }
        setFormulaState({ isOpen: false, targetQuill: null });
    };

    const modules = useCallback((quillRef: any) => ({
        toolbar: {
            container: [
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'script': 'sub'}, { 'script': 'super' }],
                ['formula'],
                ['link', 'image', 'clean']
            ],
            handlers: {
                image: () => handleImageUpload(quillRef),
                formula: () => handleOpenFormula(quillRef)
            }
        }
    }), [handleImageUpload, handleOpenFormula]);"""

new_logic = """    const handleOpenFormula = (id: string) => {
        setFormulaState({ isOpen: true, targetId: id });
    };

    const handleFormulaInsert = (latex: string) => {
        if (formulaState.targetId) {
            const id = formulaState.targetId;
            const insertText = `$${latex}$ `;

            if (id === 'question') {
                onChange({ ...data, question: data.question + insertText });
            } else if (id === 'explanation') {
                onChange({ ...data, explanation: data.explanation + insertText });
            } else if (id.startsWith('option_')) {
                const opt = id.split('_')[1];
                onChange({ ...data, options: { ...data.options, [opt]: data.options[opt] + insertText } });
            }
        }
        setFormulaState({ isOpen: false, targetId: null });
    };"""

content = content.replace(logic_to_replace, new_logic)

# Re-write the return block
return_block_pattern = r'return \(\n        <div className="space-y-8">.*?\);'

new_return_block = """return (
        <div className="space-y-6">
            <div className="space-y-2 border rounded-[20px] p-6 bg-card shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-semibold">প্রশ্ন (Question) *</Label>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenFormula('question')} className="text-xs h-8 bg-secondary/50 hover:bg-secondary text-foreground">
                        Insert Math Formula
                    </Button>
                </div>
                <Textarea
                    value={data.question}
                    onChange={(e) => update('question', e.target.value)}
                    placeholder="Enter the question text (LaTeX allowed)..."
                    className="min-h-[120px] rounded-[15px] resize-y"
                />
            </div>

            <div className="border rounded-[20px] p-6 bg-card shadow-sm space-y-4">
                <Label className="text-base font-semibold block mb-4">অপশনসমূহ (Options)</Label>
                {['A', 'B', 'C', 'D'].map((opt) => (
                    <div key={opt} className="flex items-center gap-4">
                        <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary/50 font-bold text-sm border">
                            {opt}
                        </div>
                        <Input
                            value={data.options[opt]}
                            onChange={(e) => updateOption(opt, e.target.value)}
                            placeholder={`Option ${opt}`}
                            className="rounded-[12px] flex-1"
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleOpenFormula(`option_${opt}`)} className="text-xs shrink-0 text-muted-foreground">
                           <ImageIcon className="h-4 w-4" /> {/* Math icon equivalent maybe */}
                        </Button>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2 border rounded-[20px] p-6 bg-card shadow-sm">
                    <Label className="text-base font-semibold text-green-600 block mb-2">সঠিক উত্তর *</Label>
                    <Input
                        value={data.correct_answer}
                        onChange={(e) => update('correct_answer', e.target.value)}
                        placeholder="e.g., A, B or 1, 2"
                        className="rounded-[12px]"
                    />
                </div>

                <div className="space-y-2 border rounded-[20px] p-6 bg-card shadow-sm">
                     <div className="flex items-center justify-between mb-2">
                        <Label className="text-base font-semibold">ব্যাখ্যা (Explanation)</Label>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenFormula('explanation')} className="text-xs h-8 bg-secondary/50 hover:bg-secondary text-foreground">
                            Math
                        </Button>
                    </div>
                    <Textarea
                        value={data.explanation}
                        onChange={(e) => update('explanation', e.target.value)}
                        placeholder="Provide explanation..."
                        className="min-h-[60px] rounded-[12px] resize-y"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border rounded-[20px] p-6 bg-card shadow-sm">
                 <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <CreatableSelect
                        options={subjectOptions}
                        value={data.subject || ""}
                        onChange={(val) => update('subject', val)}
                        onCreate={(val) => handleCreateMeta('subject', val)}
                        placeholder="e.g., Physics"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Chapter</Label>
                    <CreatableSelect
                        options={chapterOptions}
                        value={data.chapter || ""}
                        onChange={(val) => update('chapter', val)}
                        onCreate={(val) => handleCreateMeta('chapter', val)}
                        placeholder="e.g., 5"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Topic</Label>
                    <CreatableSelect
                        options={topicOptions}
                        value={data.topic || ""}
                        onChange={(val) => update('topic', val)}
                        onCreate={(val) => handleCreateMeta('topic', val)}
                        placeholder="Select Topic"
                    />
                </div>
                 <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Exam Code</Label>
                    <CreatableSelect
                        options={globalMeta?.exam_code || []}
                        value={data.exam_code || ""}
                        onChange={(val) => update('exam_code', val)}
                        onCreate={(val) => handleCreateMeta('exam_code', val)}
                        placeholder="e.g., DU"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Year</Label>
                    <CreatableSelect
                        options={globalMeta?.year || []}
                        value={data.year || ""}
                        onChange={(val) => update('year', val)}
                        onCreate={(val) => handleCreateMeta('year', val)}
                        placeholder="Select Year"
                    />
                </div>
                <div className="space-y-2 lg:col-span-3">
                    <Label className="text-xs text-muted-foreground">Tags</Label>
                    <MultiSelect
                        options={globalMeta?.tag || []}
                        selected={data.tags || []}
                        onChange={(val) => update('tags', val)}
                        onCreate={(val) => handleCreateMeta('tag', val)}
                        placeholder="Select Tags"
                    />
                </div>
            </div>

            <div className="flex gap-4 pt-4 justify-center md:justify-end">
                <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto rounded-[10px] min-w-[120px]">
                    Cancel
                </Button>
                <Button onClick={onSave} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white rounded-[10px] min-w-[150px] shadow-md">
                    <Save className="mr-2 h-4 w-4" /> Update
                </Button>
            </div>

            <FormulaEditorDialog
                isOpen={formulaState.isOpen}
                onClose={() => setFormulaState({ isOpen: false, targetId: null })}
                onInsert={handleFormulaInsert}
            />
        </div>
    );"""

content = re.sub(return_block_pattern, new_return_block, content, flags=re.DOTALL)

with open('src/components/admin/QuestionEditor.tsx', 'w') as f:
    f.write(content)
