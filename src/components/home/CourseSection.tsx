import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const CourseSection = () => {
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all");

    const { data: courses, isLoading } = useQuery({
        queryKey: ["public-courses"],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("courses")
            .select("id, name, short_description, price, original_price, image_url, slug, is_active, category, sub_category, priority")
            .eq("is_public", true)
            .order("priority", { ascending: true })
            .order("created_at", { ascending: false });
          if (error) throw error;
          return data || [];
        },
    });

    // Extract unique categories and subcategories
    const categories = Array.from(new Set(courses?.map((c: any) => c.category).filter(Boolean) || [])).sort();

    // Filter courses based on selection
    const filteredCourses = courses?.filter((course: any) => {
        if (selectedCategory !== "all" && course.category !== selectedCategory) return false;
        if (selectedSubCategory !== "all" && course.sub_category !== selectedSubCategory) return false;
        return true;
    });

    // Get subcategories for the selected category (or all if no category selected)
    const availableSubCategories = Array.from(new Set(
        courses
            ?.filter((c: any) => selectedCategory === "all" || c.category === selectedCategory)
            .map((c: any) => c.sub_category)
            .filter(Boolean) || []
    )).sort();

    // Reset subcategory when category changes if it's no longer valid
    useEffect(() => {
        if (selectedCategory !== "all" && selectedSubCategory !== "all") {
             const isValid = courses?.some((c: any) => c.category === selectedCategory && c.sub_category === selectedSubCategory);
             if (!isValid) setSelectedSubCategory("all");
        }
    }, [selectedCategory, courses]);

    return (
        <section id="courses" className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">চলমান কোর্সসমূহ</h2>
                        <p className="text-sm text-muted-foreground">
                            আপনার সফলতার জন্য বিশেষভাবে ডিজাইন করা প্রিমিয়াম প্রোগ্রাম।
                        </p>
                    </div>
                </div>

                {/* Filters using Select (Dropdowns) */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-muted/20 p-4 rounded-lg border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-fit">
                        <Filter className="h-4 w-4" />
                        <span className="font-medium">ফিল্টার:</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full sm:w-auto flex-1">
                        {/* Category Filter */}
                        <div className="w-full">
                             <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="w-full bg-background">
                                    <SelectValue placeholder="All Batches" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Batches</SelectItem>
                                    {categories.map((cat: any) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Sub Category Filter */}
                        <div className="w-full">
                            <Select
                                value={selectedSubCategory}
                                onValueChange={setSelectedSubCategory}
                                disabled={availableSubCategories.length === 0}
                            >
                                <SelectTrigger className="w-full bg-background">
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {availableSubCategories.map((sub: any) => (
                                        <SelectItem key={sub} value={sub}>
                                            {sub}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {isLoading ? (
                    <p className="text-sm text-muted-foreground col-span-full">লোড হচ্ছে...</p>
                ) : !filteredCourses || filteredCourses.length === 0 ? (
                    <p className="text-sm text-muted-foreground col-span-full">
                        {courses && courses.length > 0 ? "এই ক্যাটাগরিতে কোনো কোর্স নেই।" : "বর্তমানে কোনো কোর্স চালু নেই।"}
                    </p>
                ) : (
                    filteredCourses.map((course: any) => {
                        const image = course.image_url || "/placeholder.svg";
                        const description = course.short_description || "";
                        const idOrSlug = course.slug || course.id;

                        return (
                            <Card key={course.id} className="overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col h-full min-w-0 w-full max-w-full">
                                {/* Course Image */}
                                <div className="w-full aspect-video relative">
                                    <img
                                        src={image}
                                        alt={`${course.name} cover`}
                                        className="absolute inset-0 h-full w-full object-cover"
                                    />
                                    {course.category && (
                                        <Badge className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white border-0">
                                            {course.category}
                                        </Badge>
                                    )}
                                </div>
                                {/* Content */}
                                <div className="flex-1 p-5 flex flex-col justify-between gap-4">
                                    <div>
                                        <div className="flex justify-between items-start gap-2">
                                             <h3 className="text-lg font-bold mb-2 leading-tight">{course.name}</h3>
                                        </div>

                                        <p className="text-muted-foreground text-xs mb-4 line-clamp-3">{description}</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> লাইভ ক্লাস</div>
                                            <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> লেকচার নোট</div>
                                            <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> স্ট্যান্ডার্ড এক্সাম</div>
                                            <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> সলভ শিট</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 mt-auto pt-4 border-t border-dashed">
                                        <div className="flex flex-col items-start">
                                            {course.original_price != null && Number(course.original_price) > Number(course.price) && (
                                                <span className="text-[10px] text-muted-foreground line-through">
                                                    ৳{Number(course.original_price).toLocaleString("en-BD")}
                                                </span>
                                            )}
                                            <div className="text-base font-bold text-primary">
                                                {course.price != null ? `৳${Number(course.price).toLocaleString("en-BD")}` : "যোগাযোগ করুন"}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button asChild variant="outline" size="sm" className="h-8 px-2 text-xs">
                                                <a href={`/courses/${idOrSlug}`}>বিস্তারিত</a>
                                            </Button>
                                            <Button asChild size="sm" className="h-8 px-2 text-xs">
                                                <a href={`/courses/${idOrSlug}/buy`}>ভর্তি হন</a>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })
                )}
            </div>
        </section>
    );
};
