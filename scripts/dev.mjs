import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const build=spawnSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'});
if (build.status) process.exit(build.status);
const worker=(await import('../dist/server/index.js')).default;
await mkdir('.local',{recursive:true});
const sqlite=new DatabaseSync('.local/dev.db',{enableForeignKeyConstraints:true});
sqlite.exec('CREATE TABLE IF NOT EXISTS _local_schema (migration TEXT PRIMARY KEY)');
const {entries:migrations}=JSON.parse(await readFile('drizzle/meta/_journal.json','utf8'));
for (const {tag:migration} of migrations) {
  const statements=await readFile('drizzle/'+migration+'.sql','utf8');
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    if (!sqlite.prepare('SELECT migration FROM _local_schema WHERE migration=?').get(migration)) {
      sqlite.exec(statements);
      sqlite.prepare('INSERT INTO _local_schema VALUES (?)').run(migration);
    }
    sqlite.exec('COMMIT');
  } catch (error) {
    sqlite.exec('ROLLBACK');
    throw error;
  }
}
function prepare(query) {
  const compiled=sqlite.prepare(query);
  return {bind:(...values)=>({
    first:async()=>compiled.get(...values)??null,
    all:async()=>({results:compiled.all(...values)}),
    run:()=>({meta:{changes:Number(compiled.run(...values).changes)}})
  })};
}
const DB={prepare,async batch(commands){
  sqlite.exec('BEGIN');
  try { const results=commands.map(statement=>statement.run()); sqlite.exec('COMMIT'); return results; }
  catch(error){sqlite.exec('ROLLBACK');throw error;}
}};
const BUCKET={
  async get(key) { const path=resolve('.local/photos',key); try {await stat(path);return {body:Readable.toWeb(createReadStream(path))};}catch(err){if(err.code==='ENOENT')return null;throw err;} },
  async put(key,bytes) {const path=resolve('.local/photos',key);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);},
  async delete(key) {await rm(resolve('.local/photos',key),{force:true});}
};
const names={seller:'Người bán thử', buyer:'Người mua thử',moderator:'Kiểm duyệt thử'};
for (const [id,name] of Object.entries(names)) {
  sqlite.prepare('INSERT OR IGNORE INTO profiles (id,name,shop,school,verified,moderator) VALUES (?,?,?,?,?,?)').run(id,name,'Gian hàng '+name,'THPT Chuyên Trần Đại Nghĩa',Number(id==='seller'),Number(id==='moderator'));
}
let MODERATOR_CODE='local-moderator';
try { MODERATOR_CODE=(await readFile('.local/moderator-code.txt','utf8')).trim(); } catch(error){ if(error.code!=='ENOENT') throw error; }
const port=Number(process.env.RECLASS_PORT||process.argv[2]||4173);
const origin='http://127.0.0.1:'+port;
createServer(async (req,res)=>{
  const url=new URL(req.url,origin);
  const headers=new Headers(req.headers);
  headers.delete('oai-authenticated-user-id');
  if (url.pathname==='/dev/account'&&req.method==='POST'&&headers.get('Origin')===origin) {
    const account=url.searchParams.get('as');
    const active=Object.hasOwn(names,account)?'reclass-demo='+account+'; Path=/; SameSite=Strict; HttpOnly':'reclass-demo=; Path=/; SameSite=Strict; HttpOnly; Max-Age=0';
    res.writeHead(200,{'Set-Cookie':active,'Content-Type':'application/json'});
    res.end('{"ok":true}');
    return;
  }
  const account=/(?:^|;\s*)reclass-demo=(seller|buyer|moderator)(?:;|$)/.exec(headers.get('cookie')||'')?.[1];
  if (account) headers.set('oai-authenticated-user-id',account);
  try {
    const hasBody=!['GET','HEAD'].includes(req.method);
    const request=new Request(url,{method:req.method,headers,...(hasBody&&{body:Readable.toWeb(req),duplex:'half'})});
    const response=await worker.fetch(request,{DB,BUCKET,LOCAL:true,MODERATOR_CODE});
    res.writeHead(response.status,Object.fromEntries(response.headers));
    if(response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
  }catch(error){console.error(error);res.writeHead(500).end('Lỗi thử nghiệm.');}
}).listen(port,'127.0.0.1',()=>console.log('Local '+origin));
