import { build } from 'esbuild';
import { readdir, readFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const files = (await readdir('public',{recursive:true,withFileTypes:true})).filter(entry=>entry.isFile());
const assets = Object.fromEntries(await Promise.all(files.map(async entry=>{
  const file=resolve(entry.parentPath,entry.name);
  const route=file.slice(resolve('public').length).replaceAll('\\','/');
  return [route,(await readFile(file)).toString('base64')];
})));
await build({
  entryPoints:['server/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',target:'es2022',
  plugins:[{name:'reclass-assets',setup(builder) {
    builder.onResolve({filter:/^reclass:assets$/},()=>({path:'assets',namespace:'reclass'}));
    builder.onLoad({filter:/.*/,namespace:'reclass'},()=>({contents:'export const assets='+JSON.stringify(assets)}));
  }}]
});
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
