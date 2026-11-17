// لقطات شاشات دليل المستخدم: يفتح الشاشة في iframe مخفي، يصورها بـ html2canvas،
// يكتب الشرح المرقّم على الصورة، ثم يرفعها للخادم لحفظها كـ PNG.
window.ubpManual = (function () {
    'use strict';

    const panelWidth = 430;
    const headerHeight = 82;
    const pad = 26;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const norm = (value) => (value || '').replace(/\s+/g, ' ').trim();

    function findTarget(doc, text) {
        text = norm(text);
        if (!text) return null;
        const selector = 'button, a, h1, h2, h3, h4, label, th, td, input, textarea, select, ' +
            '.mud-input-label, .mud-input, .mud-input-control, .mud-select, .mud-chip, ' +
            '.mud-button-root, .mud-table-cell';
        const nodes = doc.querySelectorAll(selector);
        let partial = null;
        for (const node of nodes) {
            if (node.offsetParent === null) continue;
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

    function wrap(context, text, maxWidth) {
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

    function marker(context, x, y, number) {
        context.beginPath();
        context.arc(x, y, 16, 0, Math.PI * 2);
        context.fillStyle = 'rgba(15,118,110,0.94)';
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = '#FFFFFF';
        context.stroke();
        context.fillStyle = '#FFFFFF';
        context.font = 'bold 15px Cairo, Segoe UI, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(String(number), x, y + 1);
    }

    function compose(shot, annotations, points, title, route) {
        const measure = document.createElement('canvas').getContext('2d');
        measure.font = '15px Cairo, Segoe UI, sans-serif';
        const legend = [];
        let legendHeight = 78;
        annotations.forEach((annotation, index) => {
            const lines = wrap(measure, annotation.text, panelWidth - pad * 2 - 46);
            legend.push(lines);
            legendHeight += lines.length * 22 + 18;
        });

        const canvas = document.createElement('canvas');
        canvas.width = shot.width + panelWidth;
        canvas.height = Math.max(shot.height + headerHeight + pad, headerHeight + legendHeight + pad);
        const context = canvas.getContext('2d');
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(shot, 0, headerHeight);
        context.strokeStyle = '#E2E8F0';
        context.strokeRect(0.5, headerHeight + 0.5, shot.width - 1, shot.height - 1);

        context.fillStyle = '#0F766E';
        context.fillRect(0, 0, canvas.width, headerHeight);
        context.direction = 'rtl';
        context.textAlign = 'right';
        context.textBaseline = 'middle';
        context.fillStyle = '#FFFFFF';
        context.font = 'bold 22px Cairo, Segoe UI, sans-serif';
        context.fillText(title || '', canvas.width - pad, 30);
        context.fillStyle = '#CCFBF1';
        context.font = '14px Cairo, Segoe UI, sans-serif';
        context.direction = 'ltr';
        context.fillText(route || '', canvas.width - pad, 58);
        context.direction = 'rtl';

        context.fillStyle = '#F8FAFC';
        context.fillRect(shot.width, headerHeight, panelWidth, canvas.height - headerHeight);
        context.beginPath();
        context.moveTo(shot.width + 0.5, headerHeight);
        context.lineTo(shot.width + 0.5, canvas.height);
        context.strokeStyle = '#E2E8F0';
        context.stroke();

        context.textAlign = 'right';
        context.textBaseline = 'middle';
        context.direction = 'rtl';
        context.fillStyle = '#0F766E';
        context.font = 'bold 17px Cairo, Segoe UI, sans-serif';
        context.fillText('الشرح المكتوب على الصورة',
            shot.width + panelWidth - pad, headerHeight + 28);
        context.fillStyle = '#64748B';
        context.font = '12px Cairo, Segoe UI, sans-serif';
        context.fillText('كل رقم يشير إلى الجزء الموضح',
            shot.width + panelWidth - pad, headerHeight + 50);

        let y = headerHeight + 72;
        legend.forEach((lines, index) => {
            const badgeX = shot.width + panelWidth - pad - 15;
            marker(context, badgeX, y + 9, index + 1);
            context.textAlign = 'right';
            context.textBaseline = 'middle';
            context.fillStyle = '#0F172A';
            context.font = '15px Cairo, Segoe UI, sans-serif';
            lines.forEach((line, lineIndex) => {
                context.fillText(line, shot.width + panelWidth - pad - 38, y + 10 + lineIndex * 22);
            });

            const point = points[index];
            if (point) {
                const px = Math.max(20, Math.min(shot.width - 20, point.x));
                const py = Math.max(headerHeight + 20, Math.min(headerHeight + shot.height - 20,
                    point.y + headerHeight));
                context.strokeStyle = 'rgba(15,118,110,0.55)';
                context.lineWidth = 1.5;
                context.beginPath();
                context.moveTo(px + 18, py);
                context.lineTo(shot.width + panelWidth - pad - 32, y + 9);
                context.stroke();
                marker(context, px, py, index + 1);
            }
            y += lines.length * 22 + 18;
        });

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
            return compose(shot, annotations, points, options.title || '', options.route || route);
        } finally {
            iframe.remove();
        }
    }

    async function captureAndSave(code, route, options) {
        try {
            if (typeof html2canvas !== 'function') throw new Error('html2canvas_missing');
            const dataUrl = await capture(route, options);
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

    return { capture: capture, captureAndSave: captureAndSave, remove: remove };
})();
