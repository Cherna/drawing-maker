const http = require('http');

const payload = JSON.stringify({
    canvas: { width: 100, height: 100, margin: 10 },
    params: {
        steps: [
            { tool: "concentric", params: { lines: 2 } }
        ],
        seed: 123
    },
    gcode: {
        enableFilling: true,
        fillAngle: 45,
        fillSpacing: 2
    }
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/preview',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        if (res.statusCode === 200) {
            const response = JSON.parse(data);
            if (response.svg && response.svg.includes('solid_fill')) {
                console.log('SUCCESS: Solid filling model found in SVG response.');
                // Also check if hatching lines are present?
                if (response.svg.includes('hatch_')) {
                    console.log('SUCCESS: Hatching paths found.');
                } else {
                    console.log('WARNING: solid_fill group found but no hatch paths?');
                    console.log('SVG Preview snippet:', response.svg.substring(0, 500));
                }
            } else {
                console.log('FAILURE: Solid filling not found in SVG.');
                console.log(JSON.stringify(response.stats, null, 2));
            }
        } else {
            console.log('Error:', data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(payload);
req.end();
