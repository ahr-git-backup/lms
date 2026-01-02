
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log("--- Debugging Resources Constraint ---");
    const typesToTry = ["PDF", "pdf", "Pdf", "VIDEO", "video", "Link", "link"];

    // We need a valid course ID first? No, course_id is nullable in schema?
    // Schema says: course_id string | null.

    for (const type of typesToTry) {
        console.log(`Trying to insert resource with type: '${type}'`);
        const { data, error } = await supabase.from("resources").insert({
            title: `Test Resource ${type}`,
            url: "https://example.com",
            resource_type: type
        }).select();

        if (error) {
            console.error(`Failed: ${error.message}`);
        } else {
            console.log(`Success! ID: ${data[0].id}`);
            // Clean up
            await supabase.from("resources").delete().eq("id", data[0].id);
        }
    }

    console.log("\n--- Debugging Courses ---");
    const { data: courses, error: courseError } = await supabase.from("courses").select("*");
    if (courseError) {
        console.error("Error fetching courses:", courseError);
    } else {
        console.log(`Found ${courses.length} courses.`);
        courses.forEach(c => {
            console.log(`- [${c.id}] ${c.name} (Active: ${c.is_active})`);
        });
    }
}

debug();
