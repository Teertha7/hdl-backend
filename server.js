const express = require('express');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

app.post('/run', (req, res) => {
    const { design, testbench } = req.body;

    // 1. Kill previous hanging processes
    try {
        if (process.platform === "win32") {
            execSync('taskkill /F /IM vvp.exe /T 2>NUL || exit 0');
        } else {
            execSync('killall -9 vvp 2>/dev/null || true');
        }
    } catch (e) {}

    // 2. Clean up ALL old VCD files in the directory
    const files = fs.readdirSync(__dirname);
    files.forEach(file => {
        if (file.endsWith('.vcd')) fs.unlinkSync(path.join(__dirname, file));
    });

    const designPath = path.join(__dirname, 'design.v');
    const tbPath = path.join(__dirname, 'testbench.v');
    const vvpPath = path.join(__dirname, 'sim.vvp');

    fs.writeFileSync(designPath, design);
    fs.writeFileSync(tbPath, testbench);

    const cmd = `iverilog -o "${vvpPath}" "${designPath}" "${tbPath}" && vvp "${vvpPath}"`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
        let log = stdout + (stderr || "");
        let vcdData = null;

        // 3. AUTO-DETECT: Find any VCD file that was generated
        const updatedFiles = fs.readdirSync(__dirname);
        const generatedVcd = updatedFiles.find(f => f.endsWith('.vcd'));

        if (generatedVcd) {
            vcdData = fs.readFileSync(path.join(__dirname, generatedVcd), 'utf8');
            log += `\n[SERVER]: Detected and loaded ${generatedVcd}`;
        }

        res.json({ log: log, vcd: vcdData });
    });
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
