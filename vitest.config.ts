import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

/**
 * إعداد الاختبارات — يورّث إعداد Vite (المسارات المختصرة وغيرها)
 * حتى تعمل الاختبارات بنفس طريقة البناء الفعلي.
 */
export default mergeConfig(
  viteConfig({ command: 'build', mode: 'test' }),
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      reporters: ['default'],
    },
  })
);
