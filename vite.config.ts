import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: process.env.GITHUB_PAGES === 'true' ? '/Universal-Business-Platform/' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/.vs/**', '**/.git/**', '**/dist/**'],
      },
    },
    build: {
      // كان البناء ينتج ملفاً واحداً بحجم 3.8 ميجابايت يتحمّل كاملاً قبل ظهور
      // أي شاشة. التقسيم أدناه يفصل المكتبات الكبيرة عن كود التطبيق حتى
      // يستطيع المتصفح تخزينها مؤقتاً وتحميلها بالتوازي.
      chunkSizeWarningLimit: 900,
      // manifest: لقياس حجم حزمة كل شاشة بدقة (screen-budget.json)
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('docx')) return 'vendor-docx';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('@neondatabase')) return 'vendor-neon';
            if (id.includes('motion')) return 'vendor-motion';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            return 'vendor-misc';
          },
        },
      },
    },
  };
});
