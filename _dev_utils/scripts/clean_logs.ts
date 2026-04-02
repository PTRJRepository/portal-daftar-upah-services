import { glob } from "glob";
import { readFileSync, writeFileSync } from "fs";

const files = await glob("backend/src/**/*.ts");

for (const file of files) {
    let content = readFileSync(file, "utf8");
    let changed = false;

    if (content.includes("console.log") || content.includes("console.error") || content.includes("console.warn")) {
        // Skip some files if needed
        if (file.includes("utils/logger.ts")) continue;

        console.log(`Processing ${file}...`);

        // Add import if not present
        if (!content.includes("../utils/logger") && !content.includes("./utils/logger")) {
            // Find a good place for import
            const lastImport = content.lastIndexOf("import ");
            if (lastImport !== -1) {
                const endOfLine = content.indexOf("\n", lastImport);
                const pathDepth = file.split("/").length - 2;
                const importPath = "../".repeat(pathDepth) + "utils/logger";
                content = content.slice(0, endOfLine + 1) + `import { debug, info, warn, error as logError } from "${importPath}";\n` + content.slice(endOfLine + 1);
            }
        }

        // Add CATEGORY if not present
        if (!content.includes("const CATEGORY =")) {
            const fileName = file.split("/").pop()?.replace(".ts", "") || "App";
            const categoryName = fileName.charAt(0).toUpperCase() + fileName.slice(1);
            const firstExport = content.indexOf("export ");
            if (firstExport !== -1) {
                content = content.slice(0, firstExport) + `const CATEGORY = "${categoryName}";\n\n` + content.slice(firstExport);
            }
        }

        // Replace console calls
        content = content.replace(/console\.log\((.*?)\)/g, 'debug(CATEGORY, $1)');
        content = content.replace(/console\.error\((.*?)\)/g, 'logError(CATEGORY, $1)');
        content = content.replace(/console\.warn\((.*?)\)/g, 'warn(CATEGORY, $1)');
        
        changed = true;
    }

    if (changed) {
        writeFileSync(file, content, "utf8");
    }
}
