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

    function esc(value) {
        return String(value || '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    async function compose(shot, annotations, points, title, route, options) {
        const scale = options.scale || 0.72;
        const totalWidth = shot.width + panelWidth;
        const container = document.createElement('div');
        container.dir = 'rtl';
        container.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + totalWidth +
            'px;background:#FFFFFF;font-family:Cairo,"Segoe UI",Tahoma,sans-serif;';

        const header = document.createElement('div');
        header.style.cssText = 'height:' + headerHeight + 'px;background:#0F766E;color:#FFFFFF;' +
            'padding:12px 26px;box-sizing:border-box;display:flex;align-items:center;' +
            'justify-content:space-between;gap:18px;';
        header.innerHTML =
            '<div style="font-size:22px;font-weight:700;line-height:1.3">' + esc(title) + '</div>' +
            '<div dir="ltr" style="font-size:14px;color:#CCFBF1;white-space:nowrap">' +
            esc(route) + '</div>';

        const body = document.createElement('div');
        body.style.cssText = 'display:flex;align-items:flex-start;';
        const panel = document.createElement('div');
        panel.style.cssText = 'width:' + panelWidth + 'px;flex:none;padding:16px 20px;' +
            'box-sizing:border-box;background:#F8FAFC;border-left:1px solid #E2E8F0;direction:rtl;';
        panel.innerHTML =
            '<div style="font-size:17px;font-weight:700;color:#0F766E">الشرح المكتوب على الصورة</div>' +
            '<div style="font-size:12px;color:#64748B;margin:4px 0 12px">كل رقم يشير إلى الجزء الموضح</div>' +
            annotations.map((annotation, index) =>
                '<div data-note="' + index + '" style="display:flex;gap:8px;align-items:flex-start;' +
                'padding:5px 0;font-size:14px;line-height:1.65;color:#0F172A">' +
                '<span style="flex:none;width:26px;height:26px;border-radius:50%;background:#0F766E;' +
                'color:#FFFFFF;font-weight:700;font-size:13px;display:flex;align-items:center;' +
                'justify-content:center">' + (index + 1) + '</span><span>' +
                esc(annotation.text) + '</span></div>').join('');

        const shotWrap = document.createElement('div');
        shotWrap.style.cssText = 'position:relative;flex:none;width:' + shot.width +
            'px;background:#FFFFFF;';
        const image = document.createElement('img');
        image.src = shot.toDataURL('image/png');
        image.width = shot.width;
        image.height = shot.height;
        image.style.cssText = 'display:block;width:' + shot.width + 'px;height:' + shot.height + 'px;';
        shotWrap.appendChild(image);

        points.forEach((point, index) => {
            if (!point) return;
            const px = Math.max(18, Math.min(shot.width - 18, point.x));
            const py = Math.max(18, Math.min(shot.height - 18, point.y));
            const badge = document.createElement('span');
            badge.textContent = String(index + 1);
            badge.style.cssText = 'position:absolute;left:' + (px - 16) + 'px;top:' + (py - 16) +
                'px;width:32px;height:32px;border-radius:50%;background:rgba(15,118,110,0.94);' +
                'color:#FFFFFF;font-weight:700;font-size:15px;display:flex;align-items:center;' +
                'justify-content:center;border:2px solid #FFFFFF;box-sizing:border-box;z-index:2;';
            shotWrap.appendChild(badge);
        });

        body.appendChild(panel);
        body.appendChild(shotWrap);
        container.appendChild(header);
        container.appendChild(body);
        document.body.appendChild(container);

        try {
            await image.decode().catch(() => { });
            await sleep(30);
            const base = container.getBoundingClientRect();
            const shotRect = shotWrap.getBoundingClientRect();
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', String(totalWidth));
            svg.setAttribute('height', String(container.offsetHeight));
            svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:1;';
            points.forEach((point, index) => {
                if (!point) return;
                const note = panel.querySelector('[data-note="' + index + '"]');
                if (!note) return;
                const noteRect = note.getBoundingClientRect();
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', String(shotRect.left - base.left + point.x));
                line.setAttribute('y1', String(shotRect.top - base.top + point.y));
                line.setAttribute('x2', String(noteRect.left - base.left + 13));
                line.setAttribute('y2', String(noteRect.top - base.top + 13));
                line.setAttribute('stroke', 'rgba(15,118,110,0.45)');
                line.setAttribute('stroke-width', '1.5');
                svg.appendChild(line);
            });
            container.insertBefore(svg, container.firstChild);

            const canvas = await html2canvas(container, {
                backgroundColor: '#FFFFFF',
                scale: scale,
                logging: false,
                useCORS: true,
                width: totalWidth,
                height: container.offsetHeight,
                windowWidth: totalWidth,
                windowHeight: container.offsetHeight
            });
            return canvas.toDataURL('image/png');
        } finally {
            container.remove();
        }
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
