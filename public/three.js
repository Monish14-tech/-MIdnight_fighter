// three.js — re-export real Three.js from the importmap (see index.html)
// This file exists so legacy relative imports like `import { ... } from './three.js'`
// continue to resolve. The importmap ensures 'three' points to the real CDN build.
export * from 'three';
export { default } from 'three';
