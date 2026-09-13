import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FreeClass from "./FreeClass";
import FreeExam from "./FreeExam";

const Free = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "exams" ? "exams" : "class";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    document.title = "Free – Atlas";
  }, []);

  const onTabChange = (value: string) => {
    setTab(value);
    setSearchParams(value === "exams" ? { tab: "exams" } : {}, { replace: true });
  };

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="w-full">
      <TabsList className="fixed top-16 left-1/2 -translate-x-1/2 z-40 grid w-[min(92vw,360px)] grid-cols-2 shadow-md">
        <TabsTrigger value="class">Free Class</TabsTrigger>
        <TabsTrigger value="exams">Free Exams</TabsTrigger>
      </TabsList>
      <TabsContent value="class" className="mt-0">
        <FreeClass />
      </TabsContent>
      <TabsContent value="exams" className="mt-0">
        <FreeExam />
      </TabsContent>
    </Tabs>
  );
};

export default Free;
