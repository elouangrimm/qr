(() => {
    // State
    let cellSize = 20;
    let qrData = null;
    let qrModuleCount = 0;
    let qrVersion = 0;
    let showRegions = false;
    let showCrosshair = true;
    let hoverRow = -1;
    let hoverCol = -1;
    let isFullscreen = false;

    // DOM
    const app = document.getElementById('app');
    const inputEl = document.getElementById('qr-input');
    const ecSelect = document.getElementById('ec-level');
    const generateBtn = document.getElementById('generate-btn');
    const canvas = document.getElementById('qr-canvas');
    const ctx = canvas.getContext('2d');
    const infoBar = document.getElementById('info-bar');
    const toolbar = document.getElementById('toolbar');
    const emptyState = document.getElementById('empty-state');
    const qrWrapper = document.getElementById('qr-wrapper');
    const coordDisplay = document.getElementById('coord-display');
    const legend = document.getElementById('legend');
    const legendGrid = document.getElementById('legend-grid');

    // Region colors
    const regionColors = {
        'finder-tl':  { dark: '#c026d3', light: '#f0abfc' },
        'finder-tr':  { dark: '#c026d3', light: '#f0abfc' },
        'finder-bl':  { dark: '#c026d3', light: '#f0abfc' },
        'timing':     { dark: '#0ea5e9', light: '#7dd3fc' },
        'alignment':  { dark: '#f59e0b', light: '#fcd34d' },
        'format':     { dark: '#10b981', light: '#6ee7b7' },
        'version':    { dark: '#ef4444', light: '#fca5a5' },
        'data':       { dark: '#1c1917', light: '#fafaf9' },
    };

    const regionLabels = {
        'finder-tl': 'Finder Pattern',
        'finder-tr': 'Finder Pattern',
        'finder-bl': 'Finder Pattern',
        'timing': 'Timing Pattern',
        'alignment': 'Alignment Pattern',
        'format': 'Format Info',
        'version': 'Version Info',
        'data': 'Data / EC',
    };

    // Alignment pattern positions per QR version
    const alignmentTable = {
        2: [6,18], 3: [6,22], 4: [6,26], 5: [6,30], 6: [6,34],
        7: [6,22,38], 8: [6,24,42], 9: [6,26,46], 10: [6,28,50],
        11: [6,30,54], 12: [6,32,58], 13: [6,34,62], 14: [6,26,46,66],
        15: [6,26,48,70], 16: [6,26,50,74], 17: [6,30,54,78],
        18: [6,30,56,82], 19: [6,30,58,86], 20: [6,34,62,90],
        21: [6,28,50,72,94], 22: [6,26,50,74,98], 23: [6,30,54,78,102],
        24: [6,28,54,80,106], 25: [6,32,58,84,110], 26: [6,30,58,86,114],
        27: [6,34,62,90,118], 28: [6,26,50,74,98,122],
        29: [6,30,54,78,102,126], 30: [6,26,52,78,104,130],
        31: [6,30,56,82,108,134], 32: [6,34,60,86,112,138],
        33: [6,30,58,86,114,142], 34: [6,34,62,90,118,146],
        35: [6,30,54,78,102,126,150], 36: [6,24,50,76,102,128,154],
        37: [6,28,54,80,106,132,158], 38: [6,32,58,84,110,136,162],
        39: [6,26,54,82,110,138,166], 40: [6,30,58,86,114,142,170],
    };

    // Region detection
    function getRegion(row, col) {
        const n = qrModuleCount;

        if (row < 9 && col < 9) return 'finder-tl';
        if (row < 9 && col >= n - 8) return 'finder-tr';
        if (row >= n - 8 && col < 9) return 'finder-bl';

        if (row === 6 || col === 6) return 'timing';

        if (qrVersion >= 2) {
            const positions = alignmentTable[qrVersion] || [];
            for (const ar of positions) {
                for (const ac of positions) {
                    if (ar < 9 && ac < 9) continue;
                    if (ar < 9 && ac >= n - 8) continue;
                    if (ar >= n - 8 && ac < 9) continue;
                    if (Math.abs(row - ar) <= 2 && Math.abs(col - ac) <= 2) {
                        return 'alignment';
                    }
                }
            }
        }

        if (row === 8 && (col < 9 || col >= n - 8)) return 'format';
        if (col === 8 && (row < 9 || row >= n - 7)) return 'format';

        if (qrVersion >= 7) {
            if (row < 6 && col >= n - 11 && col < n - 8) return 'version';
            if (col < 6 && row >= n - 11 && row < n - 8) return 'version';
        }

        return 'data';
    }

    // QR generation
    function generateQR() {
        const text = inputEl.value.trim();
        if (!text) return;

        const ecLevel = ecSelect.value;

        try {
            const qr = qrcode(0, ecLevel);
            qr.addData(text);
            qr.make();

            qrModuleCount = qr.getModuleCount();
            qrVersion = Math.max(1, Math.round((qrModuleCount - 21) / 4) + 1);

            qrData = [];
            let darkCount = 0;
            for (let r = 0; r < qrModuleCount; r++) {
                qrData[r] = [];
                for (let c = 0; c < qrModuleCount; c++) {
                    const isDark = qr.isDark(r, c);
                    qrData[r][c] = isDark;
                    if (isDark) darkCount++;
                }
            }

            const total = qrModuleCount * qrModuleCount;
            document.getElementById('info-size').textContent = `${qrModuleCount} × ${qrModuleCount}`;
            document.getElementById('info-modules').textContent = total.toLocaleString();
            document.getElementById('info-version').textContent = qrVersion;
            document.getElementById('info-ec').textContent = { L: 'Low', M: 'Medium', Q: 'Quartile', H: 'High' }[ecLevel];
            document.getElementById('info-dark').textContent = `${darkCount} (${Math.round(darkCount / total * 100)}%)`;
            document.getElementById('info-light').textContent = `${total - darkCount} (${Math.round((total - darkCount) / total * 100)}%)`;

            infoBar.classList.remove('hidden');
            toolbar.classList.remove('hidden');
            emptyState.classList.add('hidden');
            canvas.classList.remove('hidden');
            legend.classList.remove('hidden');

            renderLegend();
            draw();
        } catch (e) {
            alert('Error generating QR code: ' + e.message);
        }
    }

    // Legend
    function renderLegend() {
        legendGrid.innerHTML = '';

        const items = [
            { key: 'finder-tl', label: 'Finder Pattern' },
            { key: 'timing', label: 'Timing Pattern' },
            { key: 'alignment', label: 'Alignment Pattern' },
            { key: 'format', label: 'Format Info' },
            { key: 'version', label: 'Version Info' },
            { key: 'data', label: 'Data / Error Correction' },
        ];

        items.forEach(item => {
            if (item.key === 'alignment' && qrVersion < 2) return;
            if (item.key === 'version' && qrVersion < 7) return;

            const el = document.createElement('div');
            el.className = 'legend-item';

            const swatch = document.createElement('div');
            swatch.className = 'legend-swatch';
            swatch.style.backgroundColor = regionColors[item.key].dark;
            el.appendChild(swatch);

            const lbl = document.createElement('span');
            lbl.textContent = item.label;
            el.appendChild(lbl);

            legendGrid.appendChild(el);
        });

        [
            { color: '#1c1917', label: 'Dark Module (fill in)' },
            { color: '#fafaf9', label: 'Light Module (leave empty)' },
        ].forEach(item => {
            const el = document.createElement('div');
            el.className = 'legend-item';

            const swatch = document.createElement('div');
            swatch.className = 'legend-swatch';
            swatch.style.backgroundColor = item.color;
            el.appendChild(swatch);

            const lbl = document.createElement('span');
            lbl.textContent = item.label;
            el.appendChild(lbl);

            legendGrid.appendChild(el);
        });
    }

    // Drawing
    function draw() {
        if (!qrData) return;

        const n = qrModuleCount;
        const labelSize = Math.max(20, cellSize);
        const totalW = labelSize + n * cellSize;
        const totalH = labelSize + n * cellSize;

        canvas.width = totalW;
        canvas.height = totalH;

        ctx.clearRect(0, 0, totalW, totalH);

        // QR area background
        ctx.fillStyle = '#fafaf9';
        ctx.fillRect(labelSize, labelSize, n * cellSize, n * cellSize);

        // Crosshair background highlight
        if (showCrosshair && hoverRow >= 0 && hoverCol >= 0) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
            ctx.fillRect(labelSize, labelSize + hoverRow * cellSize, n * cellSize, cellSize);
            ctx.fillRect(labelSize + hoverCol * cellSize, labelSize, cellSize, n * cellSize);
        }

        // Modules
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const x = labelSize + c * cellSize;
                const y = labelSize + r * cellSize;
                const isDark = qrData[r][c];

                if (showRegions) {
                    const region = getRegion(r, c);
                    const colors = regionColors[region];
                    ctx.fillStyle = isDark ? colors.dark : colors.light;
                } else {
                    ctx.fillStyle = isDark ? '#1c1917' : '#fafaf9';
                }

                ctx.fillRect(x, y, cellSize, cellSize);
            }
        }

        // Thin grid
        ctx.strokeStyle = showRegions ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
            const x = labelSize + i * cellSize + 0.5;
            ctx.moveTo(x, labelSize);
            ctx.lineTo(x, labelSize + n * cellSize);

            const y = labelSize + i * cellSize + 0.5;
            ctx.moveTo(labelSize, y);
            ctx.lineTo(labelSize + n * cellSize, y);
        }
        ctx.stroke();

        // Major grid every 5 cells
        ctx.strokeStyle = showRegions ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= n; i += 5) {
            const x = labelSize + i * cellSize + 0.5;
            ctx.moveTo(x, labelSize);
            ctx.lineTo(x, labelSize + n * cellSize);

            const y = labelSize + i * cellSize + 0.5;
            ctx.moveTo(labelSize, y);
            ctx.lineTo(labelSize + n * cellSize, y);
        }
        ctx.stroke();

        // Outer border
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 2;
        ctx.strokeRect(labelSize, labelSize, n * cellSize, n * cellSize);

        // Crosshair border lines
        if (showCrosshair && hoverRow >= 0 && hoverCol >= 0) {
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
            ctx.lineWidth = 2;

            const hy = labelSize + hoverRow * cellSize + 0.5;
            ctx.beginPath();
            ctx.moveTo(labelSize, hy);
            ctx.lineTo(labelSize + n * cellSize, hy);
            ctx.moveTo(labelSize, hy + cellSize);
            ctx.lineTo(labelSize + n * cellSize, hy + cellSize);
            ctx.stroke();

            const hx = labelSize + hoverCol * cellSize + 0.5;
            ctx.beginPath();
            ctx.moveTo(hx, labelSize);
            ctx.lineTo(hx, labelSize + n * cellSize);
            ctx.moveTo(hx + cellSize, labelSize);
            ctx.lineTo(hx + cellSize, labelSize + n * cellSize);
            ctx.stroke();
        }

        // Row & column numbers
        const fontSize = Math.max(9, Math.min(cellSize * 0.55, 14));
        const monoFont = getComputedStyle(document.documentElement)
            .getPropertyValue('--font-mono').trim().split(',')[0].replace(/"/g, '');

        ctx.font = `600 ${fontSize}px ${monoFont}, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < n; i++) {
            const cx = labelSize + i * cellSize + cellSize / 2;
            ctx.fillStyle = (showCrosshair && i === hoverCol) ? '#3b82f6' : '#78716c';
            ctx.fillText(i, cx, labelSize / 2);

            const ry = labelSize + i * cellSize + cellSize / 2;
            ctx.fillStyle = (showCrosshair && i === hoverRow) ? '#3b82f6' : '#78716c';
            ctx.fillText(i, labelSize / 2, ry);
        }

        // Bold every-5 numbers
        ctx.font = `700 ${fontSize}px ${monoFont}, monospace`;
        for (let i = 0; i < n; i += 5) {
            const cx = labelSize + i * cellSize + cellSize / 2;
            ctx.fillStyle = (showCrosshair && i === hoverCol) ? '#3b82f6' : '#44403c';
            ctx.fillText(i, cx, labelSize / 2);

            const ry = labelSize + i * cellSize + cellSize / 2;
            ctx.fillStyle = (showCrosshair && i === hoverRow) ? '#3b82f6' : '#44403c';
            ctx.fillText(i, labelSize / 2, ry);
        }
    }

    // Mouse tracking
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        const labelSize = Math.max(20, cellSize);
        const col = Math.floor((mx - labelSize) / cellSize);
        const row = Math.floor((my - labelSize) / cellSize);

        if (row >= 0 && row < qrModuleCount && col >= 0 && col < qrModuleCount) {
            hoverRow = row;
            hoverCol = col;
            const isDark = qrData[row][col];
            const region = getRegion(row, col);
            const regionLabel = regionLabels[region] || region;
            coordDisplay.innerHTML = `<span class="coord-val">R${row} C${col}</span> · ${isDark ? '■' : '□'} · ${regionLabel}`;
        } else {
            hoverRow = -1;
            hoverCol = -1;
            coordDisplay.innerHTML = '<span class="coord-val">—</span>';
        }
        draw();
    });

    canvas.addEventListener('mouseleave', () => {
        hoverRow = -1;
        hoverCol = -1;
        coordDisplay.innerHTML = '<span class="coord-val">—</span>';
        draw();
    });

    // Zoom
    function setZoom(newSize) {
        cellSize = Math.max(8, Math.min(60, newSize));
        document.getElementById('zoom-level').textContent = cellSize + 'px';
        draw();
    }

    document.getElementById('zoom-in').addEventListener('click', () => setZoom(cellSize + 2));
    document.getElementById('zoom-out').addEventListener('click', () => setZoom(cellSize - 2));

    // Toggles
    document.getElementById('crosshair-toggle').addEventListener('change', (e) => {
        showCrosshair = e.target.checked;
        draw();
    });

    document.getElementById('region-toggle').addEventListener('change', (e) => {
        showRegions = e.target.checked;
        draw();
    });

    // Fullscreen
    function toggleFullscreen() {
        isFullscreen = !isFullscreen;
        app.classList.toggle('fullscreen', isFullscreen);
        document.getElementById('fullscreen-btn').textContent = isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
        if (qrData) draw();
    }

    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);

    // Generate
    generateBtn.addEventListener('click', generateQR);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') generateQR();
    });

    // Export
    document.getElementById('export-btn').addEventListener('click', () => {
        if (!qrData) return;
        const prevRow = hoverRow, prevCol = hoverCol;
        hoverRow = -1; hoverCol = -1;
        draw();

        const link = document.createElement('a');
        link.download = `qr-grid-${qrModuleCount}x${qrModuleCount}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        hoverRow = prevRow; hoverCol = prevCol;
        draw();
    });

    document.getElementById('print-btn').addEventListener('click', () => {
        if (!qrData) return;
        const prevRow = hoverRow, prevCol = hoverCol;
        hoverRow = -1; hoverCol = -1;
        draw();
        window.print();
        hoverRow = prevRow; hoverCol = prevCol;
        draw();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        switch (e.key) {
            case '+': case '=':
                e.preventDefault();
                setZoom(cellSize + 2);
                break;
            case '-': case '_':
                e.preventDefault();
                setZoom(cellSize - 2);
                break;
            case 'r': case 'R': {
                e.preventDefault();
                const el = document.getElementById('region-toggle');
                el.checked = !el.checked;
                el.dispatchEvent(new Event('change'));
                break;
            }
            case 'c': case 'C': {
                e.preventDefault();
                const el = document.getElementById('crosshair-toggle');
                el.checked = !el.checked;
                el.dispatchEvent(new Event('change'));
                break;
            }
            case 'f': case 'F':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'p': case 'P':
                e.preventDefault();
                document.getElementById('print-btn').click();
                break;
            case 'e': case 'E':
                e.preventDefault();
                document.getElementById('export-btn').click();
                break;
            case 'Escape':
                if (isFullscreen) {
                    e.preventDefault();
                    toggleFullscreen();
                }
                break;
        }
    });
})();
