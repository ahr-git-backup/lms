const fs = require('fs');

const path = 'src/pages/CourseDetails.tsx';
let content = fs.readFileSync(path, 'utf8');

// Need to inject lucide-react imports if they aren't there. Send/MessageCircle are good alternatives if Telegram/WhatsApp aren't available, but lucide-react has them. Wait, lucide-react does NOT have WhatsApp/Telegram.
// Let's use simple SVG or external links with MessageCircle / Send for now, or just MessageCircle.
// Let's check imports
const importMatch = content.match(/import\s+{([^}]+)}\s+from\s+"lucide-react";/);
if (importMatch) {
    let imports = importMatch[1];
    if (!imports.includes('MessageCircle')) imports += ', MessageCircle';
    if (!imports.includes('Send')) imports += ', Send';
    content = content.replace(importMatch[0], `import {${imports}} from "lucide-react";`);
}

const buttonsHtml = `
            {/* Need Help Section */}
            <div className="mt-6 flex flex-col gap-3">
                <p className="text-sm font-semibold text-center text-muted-foreground">Need Help? Contact Support</p>
                <div className="flex gap-3 justify-center">
                    <Button variant="outline" asChild className="flex-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#075E54] dark:text-[#25D366]">
                        <a href="https://wa.me/8801999681290" target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            WhatsApp
                        </a>
                    </Button>
                    <Button variant="outline" asChild className="flex-1 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border-[#0088cc]/30 text-[#0088cc] dark:text-[#33aaff]">
                        <a href="https://t.me/rafi_somc" target="_blank" rel="noopener noreferrer">
                            <Send className="w-4 h-4 mr-2" />
                            Telegram
                        </a>
                    </Button>
                </div>
            </div>
`;

// Insert 1: Below Routine Button in main column
const routineHtml = `                            Download Routine
                        </a>
                    </Button>
                </div>
            )}`;

content = content.replace(routineHtml, routineHtml + '\n' + buttonsHtml);

// Insert 2: Below Enrollment Card in the sticky sidebar
const enrollmentCardHtml = `                             <div className="flex items-center gap-2">
                                 <CheckCircle2 className="w-4 h-4 text-green-500" />
                                 <span>Premium Support</span>
                             </div>
                        </div>
                    </CardContent>
                </Card>`;

content = content.replace(enrollmentCardHtml, enrollmentCardHtml + '\n' + buttonsHtml);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched CourseDetails.tsx");
