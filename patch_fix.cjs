const fs = require('fs');

// Fix Register.tsx
let regPath = 'src/pages/Register.tsx';
let regContent = fs.readFileSync(regPath, 'utf8');
if (!regContent.includes('import { Checkbox }')) {
    regContent = regContent.replace('import { Button } from "@/components/ui/button";', 'import { Button } from "@/components/ui/button";\nimport { Checkbox } from "@/components/ui/checkbox";');
    fs.writeFileSync(regPath, regContent, 'utf8');
}

// Fix AdminDashboardHome.tsx
let adminPath = 'src/pages/dashboard/admin/AdminDashboardHome.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');
if (!adminContent.includes('Flag')) {
    adminContent = adminContent.replace('Megaphone, BookOpen, PenTool }', 'Megaphone, BookOpen, PenTool, Flag }');
    if (!adminContent.includes('Flag }')) {
        adminContent = adminContent.replace('Megaphone,', 'Megaphone, Flag,');
    }
    fs.writeFileSync(adminPath, adminContent, 'utf8');
}

console.log("Fixed missing imports");
