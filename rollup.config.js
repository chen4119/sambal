import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import pkg from './package.json';

export default {
    input: './src/index.js',
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
        babel({
            // exclude: 'node_modules/**' // only transpile our source code
        })
    ]
}
