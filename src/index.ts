import path from "path";
import { updateArtifactRegistry } from "./registers/updateArtifact";

async function run() {
    const inputPath = path.join(process.cwd(), "input");
    const outputPath = path.join(process.cwd(), "output");
    await updateArtifactRegistry(inputPath, outputPath);
}

void run();
