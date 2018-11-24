import typescript from 'rollup-plugin-typescript';
import resolve from 'rollup-plugin-node-resolve';
import pkg from './package.json';

export default {
    input: './src/index.ts',
    output: [
        {
          file: pkg.main,
          format: 'cjs',
        },
        {
          file: pkg.module,
          format: 'esm',
        },
    ],
    external: [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
    ],
    plugins: [
        resolve(),
        typescript({module: "es2015"})
    ]
}
