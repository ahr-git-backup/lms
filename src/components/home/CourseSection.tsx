import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Configuration: Add category names here to restrict the buttons shown on the landing page.
// Example: ["HSC 25", "HSC 26", "Engineering"]
// If empty, all categories from active courses will be shown.
const FEATURED_CATEGORIES: string[] = [];

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

    // Extract unique categories and subcategories flattened from arrays
    let categories = Array.from(new Set(
        courses?.flatMap((c: any) =>
            Array.isArray(c.category) ? c.category : (c.category ? [c.category] : [])
        ) || []
    )).sort() as string[];

    // Filter categories if configuration is set
    if (FEATURED_CATEGORIES.length > 0) {
        categories = categories.filter(c => FEATURED_CATEGORIES.includes(c));
    }

    // Filter courses based on selection
    const filteredCourses = courses?.filter((course: any) => {
        const courseCats = Array.isArray(course.category)
            ? course.category
            : (course.category ? [course.category] : []);

        const courseSubs = Array.isArray(course.sub_category)
            ? course.sub_category
            : (course.sub_category ? [course.sub_category] : []);

        if (selectedCategory !== "all" && !courseCats.includes(selectedCategory)) return false;
        if (selectedSubCategory !== "all" && !courseSubs.includes(selectedSubCategory)) return false;
        return true;
    });

    // Get subcategories for the selected category (or all if no category selected)
    const availableSubCategories = Array.from(new Set(
        courses
            ?.filter((c: any) => {
                 const courseCats = Array.isArray(c.category)
                    ? c.category
                    : (c.category ? [c.category] : []);
                return selectedCategory === "all" || courseCats.includes(selectedCategory);
            })
            .flatMap((c: any) =>
                Array.isArray(c.sub_category) ? c.sub_category : (c.sub_category ? [c.sub_category] : [])
            )
            .filter(Boolean) || []
    )).sort() as string[];

    // Reset subcategory when category changes if it's no longer valid
    useEffect(() => {
        if (selectedCategory !== "all" && selectedSubCategory !== "all") {
             // Check if any course has BOTH selectedCategory AND selectedSubCategory
             const isValid = courses?.some((c: any) => {
                 const courseCats = Array.isArray(c.category) ? c.category : [c.category];
                 const courseSubs = Array.isArray(c.sub_category) ? c.sub_category : [c.sub_category];
                 return courseCats.includes(selectedCategory) && courseSubs.includes(selectedSubCategory);
             });

             if (!isValid) setSelectedSubCategory("all");
        }
    }, [selectedCategory, courses]);

    return (
        <section id="courses" className="space-y-6 w-[1px] min-w-full">
            <div className="flex flex-col gap-6">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">চলমান কোর্সসমূহ</h2>
                        <p className="text-sm text-muted-foreground">
                            আপনার সফলতার জন্য বিশেষভাবে ডিজাইন করা প্রিমিয়াম প্রোগ্রাম।
                        </p>
                    </div>
                </div>

                {/* Filters using Visible Buttons */}
                <div className="space-y-4 w-full">
                    <div className="flex flex-col gap-3">
                         {/* Header for Filter Section */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                            <Filter className="h-4 w-4" />
                            <span>কোর্স ফিল্টার করুন</span>
                        </div>

                        {/* Category Buttons */}
                        <div className="w-full">
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant={selectedCategory === "all" ? "default" : "outline"}
                                    onClick={() => setSelectedCategory("all")}
                                    className={`rounded-full px-4 h-8 text-xs border transition-all ${
                                        selectedCategory === "all"
                                        ? "bg-green-600 hover:bg-green-700 text-white border-green-600 shadow-md"
                                        : "bg-transparent hover:bg-green-50 text-foreground border-border hover:border-green-200"
                                    }`}
                                >
                                    সব
                                </Button>
                                {categories.map((cat: string) => (
                                    <Button
                                        key={cat}
                                        variant={selectedCategory === cat ? "default" : "outline"}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`rounded-full px-4 h-8 text-xs border transition-all ${
                                            selectedCategory === cat
                                            ? "bg-green-600 hover:bg-green-700 text-white border-green-600 shadow-md"
                                            : "bg-transparent hover:bg-green-50 text-foreground border-border hover:border-green-200"
                                        }`}
                                    >
                                        {cat}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Sub Category Buttons (Secondary Filter) */}
                        {availableSubCategories.length > 0 && (
                            <div className="w-full pt-2 border-t border-dashed border-border/50">
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant={selectedSubCategory === "all" ? "secondary" : "ghost"}
                                        onClick={() => setSelectedSubCategory("all")}
                                        className={`rounded-full border px-4 h-8 text-xs transition-colors ${
                                            selectedSubCategory === "all"
                                            ? "bg-secondary font-semibold border-secondary-foreground/20"
                                            : "bg-transparent border-transparent hover:bg-muted hover:border-border"
                                        }`}
                                    >
                                        সব টাইপ
                                    </Button>
                                    {availableSubCategories.map((sub: string) => (
                                        <Button
                                            key={sub}
                                            variant={selectedSubCategory === sub ? "secondary" : "ghost"}
                                            onClick={() => setSelectedSubCategory(sub)}
                                            className={`rounded-full border px-4 h-8 text-xs transition-colors ${
                                                selectedSubCategory === sub
                                                ? "bg-secondary font-semibold border-secondary-foreground/20"
                                                : "bg-transparent border-transparent hover:bg-muted hover:border-border"
                                            }`}
                                        >
                                            {sub}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
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

                        // Handle array or string display
                        const categoryBadges = Array.isArray(course.category)
                            ? course.category
                            : (course.category ? [course.category] : []);

                        return (
                            <Card key={course.id} className="overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col h-full min-w-0 w-full max-w-full">
                                {/* Course Image */}
                                <div className="w-full aspect-video relative">
                                    <img
                                        src={image}
                                        alt={`${course.name} cover`}
                                        className="absolute inset-0 h-full w-full object-cover"
                                    />
                                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                                        {categoryBadges.map((cat: string) => (
                                            <Badge key={cat} className="bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white border-0">
                                                {cat}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                {/* Content */}
                                <div className="flex-1 p-5 flex flex-col justify-between gap-4">
                                    <div>
                                        <div className="flex justify-between items-start gap-2">
                                             <h3 className="text-lg font-bold mb-2 leading-tight">{course.name}</h3>
                                        </div>

                                        <p className="text-muted-foreground text-xs mb-4 line-clamp-3">{description}</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> প্রিমিয়াম গাইডলাইন</div>
                                            <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> লিডারবোর্ড</div>
                                            <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> ইউনিক কন্টেন্ট</div>
                                            <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> ওয়ান টু ওয়ান মেন্টরিং</div>
                                            <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> র‍্যাপিড ফায়ার</div>
                                            <div className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> স্ট্যান্ডার্ড এক্সাম</div>
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
