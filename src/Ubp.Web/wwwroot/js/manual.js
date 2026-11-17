// لقطات شاشات دليل المستخدم: يفتح الشاشة في iframe مخفي، يصورها بـ html2canvas،
// يكتب الشرح المرقّم على الصورة، ثم يرفعها للخادم لحفظها كـ PNG.
window.ubpManual = (function () {
    'use strict';

    const panelWidth = 430;
    const headerHeight = 82;
    const pad = 26;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const norm = (value) => (value || '').replace(/\s+/g, ' ').trim();

    function visible(el) {
        if (!el || !el.isConnected) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const style = getComputedStyle(el);
        return style.visibility !== 'hidden' && style.display !== 'none';
    }

    function findTarget(doc, text) {
        text = norm(text);
        if (!text) return null;
        const selector = 'button, a, h1, h2, h3, h4, label, th, td, input, textarea, select, ' +
            '.mud-input-label, .mud-input, .mud-input-control, .mud-select, .mud-chip, ' +
            '.mud-button-root, .mud-table-cell';
        const nodes = doc.querySelectorAll(selector);
        let partial = null;
        for (const node of nodes) {
            if (!visible(node)) continue;
            const value = norm(node.innerText || node.textContent);
            if (value === text) return node;
            if (!partial && value && value.indexOf(text) >= 0) partial = node;
            const labels = ['placeholder', 'aria-label', 'title']
                .map((name) => norm(node.getAttribute ? node.getAttribute(name) : ''));
            if (labels.some((label) => label === text)) return node;
            if (!partial && labels.some((label) => label && label.indexOf(text) >= 0)) partial = node;
        }
        return partial;
    }

    async function waitForPage(doc) {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            const page = doc.querySelector('.ubp-page');
            const busy = doc.querySelector('.ubp-loading') ||
                doc.querySelector('.mud-progress-circular');
            if (page && norm(page.innerText).length > 0 && !busy) return page;
            await sleep(300);
        }
        return doc.querySelector('.ubp-page') || doc.body;
    }

    function esc(value) {
        return String(value || '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function svgText(x, y, text, size, color, weight, anchor) {
        if (!text) return '';
        const actual = anchor === 'right' ? 'start' : anchor === 'left' ? 'end' : 'middle';
        return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + color +
            '" font-family="Cairo,Segoe UI,Tahoma,Arial,sans-serif" direction="rtl" ' +
            'text-anchor="' + actual + '"' + (weight ? ' font-weight="' + weight + '"' : '') +
            '>' + esc(text) + '</text>';
    }

    function svgCode(x, y, text, size, color) {
        if (!text) return '';
        return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + color +
            '" font-family="Segoe UI,Tahoma,Arial,sans-serif" direction="ltr" ' +
            'text-anchor="end">' + esc(text) + '</text>';
    }

    function wrapLines(context, text, maxWidth) {
        const words = String(text || '').split(/\s+/);
        const lines = [];
        let line = '';
        for (const word of words) {
            const candidate = line ? line + ' ' + word : word;
            if (context.measureText(candidate).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        }
        if (line) lines.push(line);
        return lines.length ? lines : [''];
    }

    function svgMarker(x, y, number) {
        return '<circle cx="' + x + '" cy="' + y + '" r="14" fill="#0F766E" ' +
            'stroke="#FFFFFF" stroke-width="2"/>' +
            '<text x="' + x + '" y="' + (y + 5) + '" font-size="14" fill="#FFFFFF" ' +
            'font-family="Segoe UI,Tahoma,Arial,sans-serif" font-weight="700" ' +
            'direction="ltr" text-anchor="middle">' + number + '</text>';
    }

    async function compose(shot, annotations, points, title, route, options) {
        const scale = options.scale || 0.72;
        const totalWidth = shot.width + panelWidth;
        const measure = document.createElement('canvas').getContext('2d');
        measure.font = '14px Cairo, "Segoe UI", Tahoma, sans-serif';
        const legend = annotations.map((annotation) =>
            wrapLines(measure, annotation.text, panelWidth - 76));
        let legendHeight = 78;
        legend.forEach((lines) => { legendHeight += 20 + lines.length * 20; });
        const height = Math.max(shot.height + headerHeight + 26,
            headerHeight + legendHeight + 20);

        let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + totalWidth +
            '" height="' + height + '" viewBox="0 0 ' + totalWidth + ' ' + height + '">';
        svg += '<rect width="' + totalWidth + '" height="' + height + '" fill="#FFFFFF"/>';
        svg += '<image href="' + shot.toDataURL('image/png') + '" x="0" y="' + headerHeight +
            '" width="' + shot.width + '" height="' + shot.height + '"/>';
        svg += '<rect x="0.5" y="' + (headerHeight + 0.5) + '" width="' + (shot.width - 1) +
            '" height="' + (shot.height - 1) + '" fill="none" stroke="#E2E8F0"/>';
        svg += '<rect width="' + totalWidth + '" height="' + headerHeight + '" fill="#0F766E"/>';
        svg += svgText(totalWidth - 24, 32, title, 22, '#FFFFFF', 'bold', 'right');
        svg += svgCode(totalWidth - 24, 58, route, 14, '#CCFBF1');
        svg += '<rect x="' + shot.width + '" y="' + headerHeight + '" width="' + panelWidth +
            '" height="' + (height - headerHeight) + '" fill="#F8FAFC"/>';
        svg += '<line x1="' + (shot.width + 0.5) + '" y1="' + headerHeight + '" x2="' +
            (shot.width + 0.5) + '" y2="' + height + '" stroke="#E2E8F0"/>';
        svg += svgText(totalWidth - 22, headerHeight + 30, 'الشرح المكتوب على الصورة',
            17, '#0F766E', 'bold', 'right');
        svg += svgText(totalWidth - 22, headerHeight + 52, 'كل رقم يشير إلى الجزء الموضح',
            12, '#64748B', null, 'right');

        let y = headerHeight + 80;
        annotations.forEach((annotation, index) => {
            const lines = legend[index];
            if (points[index]) {
                const px = Math.max(18, Math.min(shot.width - 18, points[index].x));
                const py = headerHeight + Math.max(18,
                    Math.min(shot.height - 18, points[index].y));
                svg += '<line x1="' + px + '" y1="' + py + '" x2="' + (totalWidth - 42) +
                    '" y2="' + (y + 9) + '" stroke="rgba(15,118,110,0.45)" stroke-width="1.5"/>';
            }
            svg += svgMarker(totalWidth - 30, y + 9, index + 1);
            lines.forEach((line, lineIndex) => {
                svg += svgText(totalWidth - 50, y + 14 + lineIndex * 20, line, 14,
                    '#0F172A', null, 'right');
            });
            y += 20 + lines.length * 20;
        });

        points.forEach((point, index) => {
            if (!point) return;
            const px = Math.max(18, Math.min(shot.width - 18, point.x));
            const py = headerHeight + Math.max(18, Math.min(shot.height - 18, point.y));
            svg += svgMarker(px, py, index + 1);
        });
        svg += '</svg>';

        const image = new Image();
        const svgUrl = URL.createObjectURL(new Blob([svg],
            { type: 'image/svg+xml;charset=utf-8' }));
        try {
            image.src = svgUrl;
            await image.decode();
        } finally {
            URL.revokeObjectURL(svgUrl);
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(totalWidth * scale);
        canvas.height = Math.round(height * scale);
        const context = canvas.getContext('2d');
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png');
    }

    async function capture(route, options) {
        options = options || {};
        const width = options.width || 1440;
        const height = options.height || 1100;
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + width +
            'px;height:' + height + 'px;border:0;visibility:hidden;';
        iframe.src = route + (route.indexOf('?') >= 0 ? '&' : '?') + 'ubp-shot=' + Date.now();
        document.body.appendChild(iframe);
        try {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('iframe_timeout')), 20000);
                iframe.onload = () => {
                    clearTimeout(timer);
                    resolve();
                };
            });
            await sleep(1200);
            const doc = iframe.contentDocument;
            const target = await waitForPage(doc);
            await sleep(700);
            const shot = await html2canvas(target, {
                backgroundColor: options.background || '#F3F6F8',
                scale: 1,
                logging: false,
                useCORS: true,
                width: Math.min(target.scrollWidth, 1600),
                height: Math.min(target.scrollHeight, 3600),
                windowWidth: width,
                windowHeight: height,
                scrollX: 0,
                scrollY: 0
            });

            const annotations = options.annotations || [];
            const targetRect = target.getBoundingClientRect();
            const points = annotations.map((annotation) => {
                const element = findTarget(doc, annotation.target || '');
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                return {
                    x: rect.left - targetRect.left + rect.width / 2,
                    y: rect.top - targetRect.top + rect.height / 2
                };
            });
            return compose(shot, annotations, points, options.title || '', options.route || route,
                options);
        } finally {
            iframe.remove();
        }
    }

    async function waitForDialog(doc) {
        const deadline = Date.now() + 12000;
        while (Date.now() < deadline) {
            const dialog = doc.querySelector('.mud-dialog, .mud-dialog-content, [role="dialog"]');
            if (dialog && visible(dialog) && norm(dialog.innerText).length > 0)
                return dialog;
            await sleep(250);
        }
        return null;
    }

    async function openDialog(doc, triggerLabel) {
        let trigger = findTarget(doc, triggerLabel);
        if (trigger && visible(trigger)) {
            trigger.click();
            return true;
        }
        const activators = doc.querySelectorAll('.mud-menu-activator');
        for (const activator of activators) {
            if (!visible(activator)) continue;
            activator.click();
            await sleep(280);
            trigger = findTarget(doc, triggerLabel);
            if (trigger && visible(trigger)) {
                trigger.click();
                return true;
            }
        }
        return false;
    }

    async function captureDialog(route, triggerLabel, options) {
        options = options || {};
        const width = 1440;
        const height = 1100;
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + width +
            'px;height:' + height + 'px;border:0;visibility:hidden;';
        iframe.src = route + (route.indexOf('?') >= 0 ? '&' : '?') + 'ubp-dialog=' + Date.now();
        document.body.appendChild(iframe);
        try {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('iframe_timeout')), 20000);
                iframe.onload = () => {
                    clearTimeout(timer);
                    resolve();
                };
            });
            await sleep(1000);
            const doc = iframe.contentDocument;
            await waitForPage(doc);
            await sleep(400);
            if (!await openDialog(doc, triggerLabel)) throw new Error('trigger_not_found');
            const dialogEl = await waitForDialog(doc);
            if (!dialogEl) throw new Error('dialog_not_found');
            await sleep(600);
            const shot = await html2canvas(dialogEl, {
                backgroundColor: '#FFFFFF',
                scale: 1,
                logging: false,
                useCORS: true,
                width: Math.min(dialogEl.scrollWidth, 1200),
                height: Math.min(dialogEl.scrollHeight, 1600),
                windowWidth: width,
                windowHeight: height
            });
            const annotations = options.annotations || [];
            const rect = dialogEl.getBoundingClientRect();
            const points = annotations.map((annotation) => {
                const element = findTarget(dialogEl, annotation.target || '');
                if (!element) return null;
                const box = element.getBoundingClientRect();
                return {
                    x: box.left - rect.left + box.width / 2,
                    y: box.top - rect.top + box.height / 2
                };
            });
            return compose(shot, annotations, points, options.title || '', options.route || route,
                options);
        } finally {
            iframe.remove();
        }
    }

    async function upload(code, dataUrl) {
        const blob = await (await fetch(dataUrl)).blob();
        if (blob.size > 11 * 1024 * 1024) throw new Error('image_too_large');
        const response = await fetch('/api/v1/manual/screenshots/' + encodeURIComponent(code), {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'image/png',
                'X-Ubp-Manual': '1'
            },
            body: blob
        });
        if (!response.ok) throw new Error('save_failed_' + response.status);
        const data = await response.json();
        return { ok: true, url: data.url || '' };
    }

    async function captureAndSave(code, route, options) {
        try {
            if (typeof html2canvas !== 'function') throw new Error('html2canvas_missing');
            return await upload(code, await capture(route, options));
        } catch (error) {
            return { ok: false, error: String((error && error.message) || error) };
        }
    }

    async function captureDialogAndSave(code, route, triggerLabel, options) {
        try {
            if (typeof html2canvas !== 'function') throw new Error('html2canvas_missing');
            return await upload(code, await captureDialog(route, triggerLabel, options));
        } catch (error) {
            return { ok: false, error: String((error && error.message) || error) };
        }
    }

    async function remove(code) {
        try {
            const response = await fetch('/api/v1/manual/screenshots/' + encodeURIComponent(code), {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { 'X-Ubp-Manual': '1' }
            });
            return { ok: response.ok };
        } catch (error) {
            return { ok: false, error: String((error && error.message) || error) };
        }
    }

    return {
        capture: capture,
        captureDialog: captureDialog,
        captureAndSave: captureAndSave,
        captureDialogAndSave: captureDialogAndSave,
        remove: remove
    };
})();
