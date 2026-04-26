import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type MetadataType = 'subject' | 'chapter' | 'topic' | 'exam_code' | 'year' | 'tag' | 'readymade_topic' | 'readymade_category' | 'readymade_sub_chapter';

export const useGlobalMetadata = (type?: MetadataType) => {
    return useQuery({
        queryKey: ["global-metadata", type],
        queryFn: async () => {
            let query = supabase.from("global_metadata").select("type, value");
            if (type) {
                query = query.eq("type", type);
            }
            const { data, error } = await query;
            if (error) throw error;

            // Group by type if not filtered
            if (!type) {
                const grouped: Record<string, { label: string; value: string }[]> = {
                    subject: [],
                    chapter: [],
                    topic: [],
                    exam_code: [],
                    year: [],
                    tag: [],
                    readymade_topic: [],
                    readymade_category: [],
                    readymade_sub_chapter: [],
                };
                data.forEach(item => {
                    if (grouped[item.type]) {
                        grouped[item.type].push({ label: item.value, value: item.value });
                    }
                });
                // Sort
                Object.keys(grouped).forEach(k => {
                    grouped[k].sort((a, b) => a.label.localeCompare(b.label));
                });
                return grouped;
            }

            return data.map(item => ({ label: item.value, value: item.value })).sort((a, b) => a.label.localeCompare(b.label));
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useAddGlobalMetadata = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ type, value }: { type: MetadataType; value: string }) => {
            const { error } = await supabase.from("global_metadata").insert({ type, value });
            if (error) {
                // Ignore duplicate errors silently or log them, as it means it exists
                if (error.code === '23505') return; // Unique violation
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["global-metadata"] });
        },
        onError: (err) => {
            console.error("Failed to add metadata:", err);
            toast({ title: "Error adding metadata", description: err.message, variant: "destructive" });
        }
    });
};
