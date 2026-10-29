#!/usr/bin/env python3
"""Explicit isolated setup from pinned public bytes; runtime itself has no network."""
import argparse,hashlib,json,subprocess,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];DOCS=ROOT/'docs/p5/acoustic-provider'
def download(url,path,digest,size):
 if path.exists():
  assert path.stat().st_size==size and hashlib.file_digest(path.open('rb'),'sha256').hexdigest()==digest;return
 path.parent.mkdir(parents=True,exist_ok=True);partial=path.with_suffix(path.suffix+'.part')
 with urllib.request.urlopen(url,timeout=120) as response,partial.open('xb') as target:
  while chunk:=response.read(1024*1024):target.write(chunk)
 assert partial.stat().st_size==size and hashlib.file_digest(partial.open('rb'),'sha256').hexdigest()==digest;partial.rename(path)
def main():
 p=argparse.ArgumentParser();p.add_argument('--destination',type=Path,required=True);args=p.parse_args();dest=args.destination.resolve()
 assert not dest.is_relative_to(ROOT),'Native environment/model must stay outside the repository'
 model=json.loads((DOCS/'model.lock.json').read_text());tooling=json.loads((DOCS/'tooling.lock.json').read_text())
 for item in tooling['packages']:
  name=urllib.parse.unquote(urllib.parse.urlparse(item['url']).path.rsplit('/',1)[1]);assert name.endswith('.whl')
  download(item['url']+'?lingvessa_verified=20261014',dest/'wheels'/name,item['sha256'],item['bytes'])
 for item in model['files']:
  url='https://huggingface.co/'+model['repository']+'/resolve/'+model['revision']+'/'+item['path']
  download(url+'?download=true',dest/'model'/item['path'],item['sha256'],item['bytes'])
 subprocess.run(['python3','-m','venv',str(dest/'env')],check=True)
 subprocess.run([str(dest/'env/bin/python'),'-m','pip','install','--no-index','--find-links',str(dest/'wheels'),'--require-hashes','--no-deps','-r',str(DOCS/'requirements-locked.txt')],check=True)
 subprocess.run([str(dest/'env/bin/python'),'-m','pip','check'],check=True)
 print(json.dumps({'status':'PASS','mode':'local_acoustic_candidate','test_only':True,'production_policy_approved':False}))
if __name__=='__main__':main()
