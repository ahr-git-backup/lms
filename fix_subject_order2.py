import re

files = ["src/pages/dashboard/CourseView.tsx", "src/pages/dashboard/Archive.tsx", "src/pages/dashboard/Readymade.tsx"]

for filename in files:
    with open(filename, "r") as f:
        content = f.read()

    # Generic replace for all of them
    pattern = r"return Array\.from\(unique\)\.sort\(\);"
    new_pattern = """const { data: settingsData } = await supabase.from("app_settings").select("value").eq("key", "subject_order_global").maybeSingle();
            const savedOrder: string[] = settingsData?.value ? (settingsData.value as string[]) : [];

            return Array.from(unique).sort((a, b) => {
                const idxA = savedOrder.indexOf(a);
                const idxB = savedOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });"""
    content = re.sub(pattern, new_pattern, content)

    with open(filename, "w") as f:
        f.write(content)

print("Applied custom sort to subjects")
