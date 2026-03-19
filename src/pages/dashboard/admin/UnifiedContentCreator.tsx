import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminClasses from "./AdminClasses";
import AdminExams from "./AdminExams";
import AdminFreeContent from "./AdminFreeContent";
import AdminArchiveManager from "./ArchiveManager";
import { Card, CardContent } from "@/components/ui/card";

export default function UnifiedContentCreator() {
  const [activeType, setActiveType] = useState("classes");
  
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Content Creator Hub</h1>
        <p className="text-sm text-muted-foreground">Manage all types of educational content from a single interface.</p>
      </header>
      
      <Tabs value={activeType} onValueChange={setActiveType} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent border-b pb-1 w-full justify-start">
          <TabsTrigger value="classes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-xs sm:text-sm">Live Classes / Recordings</TabsTrigger>
          <TabsTrigger value="exams" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-xs sm:text-sm">Exams</TabsTrigger>
          <TabsTrigger value="readymade" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-xs sm:text-sm">Readymade / Free Content</TabsTrigger>
          <TabsTrigger value="archive" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-xs sm:text-sm">Archive Manager</TabsTrigger>
        </TabsList>
        
        <div className="mt-4">
          <TabsContent value="classes" className="mt-0">
              <div className="[&>div>header]:hidden">
                  <AdminClasses />
              </div>
          </TabsContent>

          <TabsContent value="exams" className="mt-0">
              <div className="[&>section>header]:hidden">
                  <AdminExams />
              </div>
          </TabsContent>

          <TabsContent value="readymade" className="mt-0">
              <div className="[&>div>header]:hidden">
                  <AdminFreeContent />
              </div>
          </TabsContent>

          <TabsContent value="archive" className="mt-0">
              <div className="[&>div>header]:hidden">
                  <AdminArchiveManager />
              </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
