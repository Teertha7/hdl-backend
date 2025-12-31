const express = require("express");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "200kb" })); // soft safety
app.use(cors());

app.post("/run", (req, res) => {
    const { design, testbench } = req.body;

    // ---- STEP 1A: Create isolated temp directory ----
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "hdl-"));

    const designPath = path.join(workDir, "design.v");
    const tbPath = path.join(workDir, "testbench.v");
    const vvpPath = path.join(workDir, "sim.vvp");

    fs.writeFileSync(designPath, design);
    fs.writeFileSync(tbPath, testbench);

    let log = "";
    let vcdData = null;

    // ---- STEP 1B: Compile safely (NO shell) ----
    const compile = spawn("iverilog", [
        "-o",
        vvpPath,
        designPath,
        tbPath
    ]);

    compile.stdout.on("data", d => log += d.toString());
    compile.stderr.on("data", d => log += d.toString());

    compile.on("close", code => {
        if (code !== 0) {
            cleanup();
            return res.json({ log, vcd: null });
        }

        // ---- STEP 1C: Run simulation safely ----
        const run = spawn("vvp", [vvpPath], {
            cwd: workDir,
            timeout: 5000
        });

        run.stdout.on("data", d => log += d.toString());
        run.stderr.on("data", d => log += d.toString());

        run.on("close", () => {
            // ---- STEP 1D: Find generated VCD ----
            const files = fs.readdirSync(workDir);
            const vcdFile = files.find(f => f.endsWith(".vcd"));

            if (vcdFile) {
                vcdData = fs.readFileSync(
                    path.join(workDir, vcdFile),
                    "utf8"
                );
                log += `\n[SERVER]: Loaded ${vcdFile}`;
            }

            cleanup();
            res.json({ log, vcd: vcdData });
        });
    });

    // ---- Cleanup helper ----
    function cleanup() {
        fs.rmSync(workDir, { recursive: true, force: true });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});
