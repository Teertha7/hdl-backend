const express = require('express');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;
const cors = require("cors");


app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

app.post('/run', (req, res) => {
    const { design, testbench } = req.body;

    // 1. Kill any existing simulation processes to prevent file locking
    try {
        if (process.platform === "win32") {
            execSync('taskkill /F /IM vvp.exe /T 2>NUL || exit 0');
        } else {
            execSync('killall -9 vvp 2>/dev/null || true');
        }
    } catch (e) { /* No process found, ignore */ }

    const designPath = path.join(__dirname, 'design.v');
    const tbPath = path.join(__dirname, 'testbench.v');
    const vcdPath = path.join(__dirname, 'dump.vcd');
    const vvpPath = path.join(__dirname, 'sim.vvp');

    // Remove old VCD if it exists
    if (fs.existsSync(vcdPath)) fs.unlinkSync(vcdPath);

    // 2. Write the code from the editor to files
    fs.writeFileSync(designPath, design);
    fs.writeFileSync(tbPath, testbench);

    // 3. Compile and Run using Icarus Verilog
    const cmd = `iverilog -o "${vvpPath}" "${designPath}" "${tbPath}" && vvp "${vvpPath}"`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
        let log = stdout + (stderr || "");
        let vcdData = null;

        if (error && error.killed) {
            log += "\n[SYSTEM ERROR]: Simulation timed out. Check for infinite loops or missing $finish.";
        }

        if (fs.existsSync(vcdPath)) {
            vcdData = fs.readFileSync(vcdPath, 'utf8');
        }

        res.json({ log: log, vcd: vcdData });
    });
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});