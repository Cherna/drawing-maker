#!/usr/bin/env node

/**
 * Cleanup script to kill processes using ports 3000 (API) and 5173 (Vite)
 * Works on Windows
 */

const { execSync } = require('child_process');

const PORTS = [3000, 5173];

console.log('🧹 Cleaning up development server ports...\n');

function killProcessOnPort(port) {
    try {
        // Windows-specific command to find process using the port
        const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });

        if (!output.trim()) {
            console.log(`✓ Port ${port} is already free`);
            return;
        }

        // Extract PIDs from netstat output
        const lines = output.trim().split('\n');
        const pids = new Set();

        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
                pids.add(pid);
            }
        });

        if (pids.size === 0) {
            console.log(`✓ Port ${port} is already free`);
            return;
        }

        // Kill each process
        pids.forEach(pid => {
            try {
                execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                console.log(`✓ Killed process ${pid} on port ${port}`);
            } catch (err) {
                console.log(`⚠ Could not kill process ${pid} (may have already exited)`);
            }
        });
    } catch (err) {
        // If netstat finds nothing, the port is free
        if (err.status === 1) {
            console.log(`✓ Port ${port} is already free`);
        } else {
            console.error(`⚠ Error checking port ${port}:`, err.message);
        }
    }
}

// Clean up each port
PORTS.forEach(port => killProcessOnPort(port));

console.log('\n✨ Cleanup complete!\n');
