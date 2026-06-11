import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

const useLocalhost = process.env.USE_LOCALHOST === 'true';

const replaceValues = {
  __USE_LOCALHOST__: JSON.stringify(useLocalhost),
  __API_BASE_URL__: JSON.stringify(
    useLocalhost ? 'http://localhost:4000' : 'https://api.contentcredits.com'
  ),
  __ACCOUNTS_URL__: JSON.stringify(
    useLocalhost ? 'http://localhost:3000' : 'https://accounts.contentcredits.com'
  ),
  __VERSION__: JSON.stringify(process.env.npm_package_version || '2.0.0'),
  preventAssignment: true,
};

const sharedPlugins = [
  resolve({ browser: true }),
  replace(replaceValues),
  typescript({ tsconfig: './tsconfig.json', sourceMap: true }),
];

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/content-credits.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: sharedPlugins,
  },

  // CJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/content-credits.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins: sharedPlugins,
  },

  // UMD build — minified, CDN-ready
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/content-credits.umd.min.js',
      format: 'umd',
      name: 'ContentCreditsSDK',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      ...sharedPlugins,
      terser({
        compress: { passes: 2 },
        format: { comments: false },
      }),
    ],
  },

  // TypeScript declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/content-credits.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
];
