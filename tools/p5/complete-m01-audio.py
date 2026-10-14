#!/usr/bin/env python3
"""Complete and retain the separately reconstructed M01 draft; never approve publication."""
import argparse
import base64
from collections import Counter
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import zipfile

def module(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj

c = module('continuation', 'continue-m01-audio.py')
m = c.m
b = module('review', 'build-m01-review.py')
BATCH = m.ROOT / 'docs/p5/m01-completion-20261014'

def checked_assembly(output, audio_root, continuation_root, recover_marker=False):
    marker = output / 'INCOMPLETE.json'
    checkpoint = output / 'assembly-checkpoint.json'
    if marker.exists() and checkpoint.exists():
        proof = m.read(checkpoint)
        m.need(proof['kind']=='VERIFIED_ASSEMBLY_CHECKPOINT' and proof['marker_sha256']==m.sha(marker)
               and proof['assembly_sha256']==m.sha(output/'assembly.json')
               and proof['script_sha256']==m.sha(Path(__file__)) and proof['all_420_pcm_and_cues_verified'] is True
               and proof['synthesis_repeated'] is False, 'Assembly checkpoint changed')
    else:
        m.need(recover_marker or not marker.exists(), 'Assembly incomplete')
    selection, old, completed, plan, registry, cast = c.load_parent(audio_root)
    new, provenance = c.validate_continuation(continuation_root, selection, plan, cast)
    assembly = m.read(output / 'assembly.json')
    m.need(assembly['continuation'] == provenance, 'Assembly journal binding changed')
    m.need(assembly['asr_pending_asset_ids'] == selection['pending_asset_ids'], 'ASR selection changed')
    roots = {key: audio_root for key in completed}
    roots.update({key: continuation_root for key in new})
    completed.update(new)
    previous = {a['asset_id']: a for a in old['assets'] if a['status'] == 'GENERATED_UNREVIEWED'}
    assets = assembly['assets']
    m.need(len(assets) == 420, 'Incomplete inventory')
    for asset, source in zip(assets, registry['audio'], strict=True):
        m.need(asset['asset_id'] == source['asset_id'], 'Assembly order changed')
        path = c.checked_record(output, asset, True)
        if asset['asset_id'] in previous:
            m.need(asset == previous[asset['asset_id']], 'Retained metadata changed')
        pcm, timing = c.asset_pcm(source, completed, roots, plan)
        m.need(m.pcm(path) == pcm and asset['timing'] == timing, 'PCM or measured cues changed')
    if marker.exists() and not checkpoint.exists():
        c.exclusive_json(output / 'retained-assembly-marker.json', m.read(marker))
        c.exclusive_json(output / 'assembly-checkpoint.json', {
            'kind':'VERIFIED_ASSEMBLY_CHECKPOINT','script_sha256':m.sha(Path(__file__)),
            'marker_sha256':m.sha(marker),'assembly_sha256':m.sha(output/'assembly.json'),
            'all_420_pcm_and_cues_verified':True,'synthesis_repeated':False,
            'explanation':'Original incomplete marker retained separately after exact comparison of every final PCM stream and cue with the validated sources. No completion timestamp invented.'})
    return assets, old, list(new.values()), selection, assembly

def screen(args):
    m.offline()
    assets, old, new, selection, assembly = checked_assembly(args.output, args.audio_root, args.continuation_root, args.recover_assembly_marker)
    pending = set(selection['pending_asset_ids'])
    c.exclusive_json(args.output / 'assets.json', {
        'plan_sha256': selection['plan_sha256'], 'constraints': selection['constraints'],
        'assembler_sha256': m.sha(Path(__file__)),
        'assets': [a for a in assets if a['asset_id'] in pending]})
    m.screen(args.output, args.models)

def validate_data(assets, screens, turns):
    selection, old, completed, plan, registry, cast = c.load_parent()
    pending = selection['pending_turns']
    m.need(len(turns) == 97 and len(assets) == len(screens) == 204, 'Completion inventory changed')
    model = m.read(m.ROOT / 'docs/p5/voice-audition/pocket-20261009/models.lock.json')
    for row, expected in zip(turns, pending, strict=True):
        m.need(all(row.get(k) == v for k, v in expected.items()), 'Turn identity/text/seed changed')
        m.need(row['status'] == 'GENERATED_UNREVIEWED' and row['engine'] == 'pocket', 'Turn incomplete')
        m.need(row['plan_sha256'] == selection['plan_sha256'] and row['generator_sha256'] == selection['generator_sha256'], 'Turn provenance changed')
        m.need(row['continuation_plan_sha256'] is None and row['infrastructure_retry'] is False, 'Generator scope changed')
        engine = row['engine_result']
        m.need(engine['model_sha256'] == model['files']['model.safetensors']['sha256'] and
               engine['reference_sha256'] == cast[row['voice_code']]['reference_sha256'], 'Voice/model changed')
        m.need(engine['prepared_text'] and engine['token_ids'], 'Tokenizer provenance missing')
        for speed in ['normal', 'slow']:
            v = row[speed]['metrics']
            m.need(v['sample_rate'] == 24000 and v['channels'] == 1 and v['sample_width'] == 2 and
                   v['clipped_samples'] == 0 and v['frames'] > 0 and v['duration_seconds'] == v['frames']/24000,
                   'Invalid turn metrics')
        m.need(row['slow']['metrics']['frames'] > row['normal']['metrics']['frames'], 'Invalid pace')
        completed[row['turn_id']] = row
    ids = selection['pending_asset_ids']
    m.need([a['asset_id'] for a in assets] == ids and [s['asset_id'] for s in screens] == ids, 'Missing/extra/reordered assets or screens')
    original = {a['asset_id']: a for a in registry['audio']}
    for a, s in zip(assets, screens, strict=True):
        src = original[a['asset_id']]
        for key in ['asset_id','stable_code','language','speed','normal_asset_id','script_id','script_hash','transcript']:
            m.need(a[key] == src[key], 'Asset identity/text changed')
        m.need(a['turn_ids'] == [t['turn_id'] for t in src['turns']], 'Turn order changed')
        m.need(a['status'] == 'GENERATED_UNREVIEWED' and a['path'] == f"audio/{a['language']}/{a['stable_code']}.wav", 'Invalid asset state/path')
        cursor = 0
        m.need(len(a['timing']) == len(src['turns']), 'Missing cue')
        for i, (cue, turn) in enumerate(zip(a['timing'],src['turns'],strict=True)):
            record = completed[turn['turn_id']]
            clip = record[a['speed']]
            if i: cursor += plan['processing']['normal_gap_frames' if a['speed']=='normal' else 'slow_gap_frames']
            end = cursor + clip['metrics']['frames']
            expected_cue = {'turn_id':turn['turn_id'],'voice_id':turn['voice_id'],'character_id':turn.get('character_id'),
                'candidate_id':record['candidate_id'],'text':turn['text'],'start_frame':cursor,'end_frame':end,
                'start_ms':cursor/24,'end_ms':end/24,'turn_sha256':clip['sha256']}
            m.need(cue == expected_cue, 'Cue/source binding changed')
            cursor = end
        metric = a['metrics']
        m.need(metric['frames'] == cursor and metric['duration_seconds'] == cursor/24000 and
               metric['sample_rate'] == 24000 and metric['channels'] == 1 and metric['sample_width'] == 2 and
               metric['clipped_samples'] == 0 and metric['peak_dbfs'] < 0, 'Invalid asset metrics')
        m.need(s['status'] == 'SCREENED' and s['audio_sha256'] == a['sha256'] and s['expected'] == a['transcript']
               and s['language'] == a['language'], 'ASR binding changed')
        actual = ''.join(seg['text'] for seg in s['segments']).strip()
        edits = m.distance(m.words(a['transcript']), m.words(actual))
        count = len(m.words(a['transcript']))
        m.need(s['transcript'] == actual and s['word_edits'] == edits and s['reference_words'] == count and
               s['diagnostic_wer'] == edits/count and s['review_flag'] == ('ASR_DISCREPANCY' if edits else 'NO_ASR_DISCREPANCY'), 'ASR bookkeeping changed')
        m.need(s['human_review'] == 'PENDING' and s['pronunciation_quality_asserted'] is False, 'Unsubstantiated approval')
    new = {a['asset_id']: a for a in assets}
    merged = [new.get(a['asset_id'], a) for a in old['assets']]
    all_screens = {s['asset_id']:s for s in old['screens'] + screens}
    m.need(len(all_screens) == 420 and all(a['status']=='GENERATED_UNREVIEWED' for a in merged), 'Missing final asset')
    return merged, all_screens

def counts(assets, screens):
    return {'available_assets':len(assets),'missing_assets':0,'new_assets':204,'retained_assets':216,
        'new_turns':97,'asr_screened_assets':len(screens),'asr_discrepancy_assets':sum(s['word_edits']>0 for s in screens.values()),
        'languages':dict(Counter(a['language'] for a in assets)), 'quality_retries':0}

def retain(args):
    m.need(not (BATCH/'results.json').exists(), 'Completion already retained')
    assets, old, turns, selection, assembly = checked_assembly(args.output,args.audio_root,args.continuation_root)
    pending = selection['pending_asset_ids']
    new = [a for a in assets if a['asset_id'] in set(pending)]
    screens = [m.read(args.output/'asr'/f'{key}.json') for key in pending]
    merged, all_screens = validate_data(new,screens,turns)
    asr = m.read(args.output/'asr-run.json')
    m.need(asr['status']=='COMPLETE' and asr['outputs']==pending, 'ASR run incomplete')
    records = []
    for role, rows in [('assets',new),('screens',screens),('turns',turns)]:
        for i in range(0,len(rows),30):
            path=BATCH/'records'/f'{role}-{i//30:02}.json'
            m.write(path,rows[i:i+30])
            records.append({'role':role,'path':str(path.relative_to(m.ROOT)),'sha256':m.sha(path),'count':len(rows[i:i+30])})
    evidence=[]
    for source,name in [(args.continuation_root/'generation-pocket.json','generation.json'),
                         (args.output/'asr-run.json','asr-run.json'),(args.output/'assets.json','screen-selection.json'),
                         (args.run_root/'availability.json','availability.json')]:
        dest=BATCH/name
        m.need(not dest.exists(), 'Evidence output exists')
        shutil.copyfile(source,dest)
        evidence.append({'path':str(dest.relative_to(m.ROOT)),'sha256':m.sha(dest)})
    for name in ['reconstruction-plan.json']:
        path=BATCH/name
        evidence.append({'path':str(path.relative_to(m.ROOT)),'sha256':m.sha(path)})
    for source in [args.continuation_root/'processing-recovery.json',args.output/'retained-assembly-marker.json',args.output/'assembly-checkpoint.json']:
        if source.exists():
            dest=BATCH/source.name
            shutil.copyfile(source,dest)
            evidence.append({'path':str(dest.relative_to(m.ROOT)),'sha256':m.sha(dest)})
    tools=['m01-audio-draft.py','continue-m01-audio.py','authoring_offline.py','complete-m01-audio.py','build-m01-review.py','recover-m01-pocket-journal.py']
    result={'schema_version':1,'scope':'M01_COMPLETE_DRAFT','source_base_sha':'378d8cbed3f7724ffb5e05a14106d83c4fbec0cb',
        'parent_results_sha256':selection['parent_results_sha256'],'plan_sha256':selection['plan_sha256'],
        'records':records,'evidence':evidence,
        'tools':{str(Path(__file__).resolve().with_name(name).relative_to(m.ROOT)):m.sha(Path(__file__).with_name(name)) for name in tools},
        'counts':counts(merged,all_screens),'constraints':selection['constraints'],
        'local_byte_verification':{'parent_wavs':532,'continuation_wavs':291,'final_wavs':420,'all_final_pcm_and_cues_matched':True},
        'technical_status':'COMPLETE_AUTOMATED_SCREENING','human_review':'PENDING','publication_ready':False,
        'p5_milestone':'NOT_READY','p6_authorized':False}
    c.exclusive_json(BATCH/'results.json',result)
    print(json.dumps(result['counts']))

def load():
    result=m.read(BATCH/'results.json')
    groups={key:[] for key in ['assets','screens','turns']}
    for entry in result['records']:
        path=m.ROOT/entry['path']
        m.need(path.resolve().is_relative_to(BATCH) and m.sha(path)==entry['sha256'],'Record checksum/path changed')
        rows=m.read(path)
        m.need(len(rows)==entry['count'],'Record count changed')
        groups[entry['role']].extend(rows)
    for entry in result['evidence']:
        m.need(m.sha(m.ROOT/entry['path'])==entry['sha256'],'Evidence changed')
    for path, digest in result['tools'].items():
        m.need(m.sha(m.ROOT/path)==digest,'Bound tool changed')
    merged,screens=validate_data(groups['assets'],groups['screens'],groups['turns'])
    plan=m.inputs()[0]
    m.need(result['constraints']==plan['constraints'] and result['counts']==counts(merged,screens),'Counts or constraints changed')
    m.need(result['parent_results_sha256']==m.sha(m.BATCH/'results.json') and result['plan_sha256']==m.sha(m.BATCH/'plan.json'),'Parent changed')
    m.need(result['human_review']=='PENDING' and result['publication_ready'] is False and result['p5_milestone']=='NOT_READY' and result['p6_authorized'] is False,'Approval changed')
    job=m.read(BATCH/'generation.json'); asr=m.read(BATCH/'asr-run.json')
    lock=m.read(m.ROOT/'docs/p5/voice-audition/pocket-20261009/tooling-lock.json')
    versions={p['name']:p['version'] for p in lock['packages']}
    m.need(job['status']=='COMPLETE' and job['attempts']==[t['turn_id'] for t in groups['turns']] and job['versions']==versions,'Generation journal changed')
    m.need(asr['status']=='COMPLETE' and asr['outputs']==[a['asset_id'] for a in groups['assets']] and
           asr['versions']=={k:v for k,v in versions.items() if k not in ('torch','pocket-tts')},'ASR journal changed')
    m.need(asr['parameters']==plan['asr'] and asr['pronunciation_quality_asserted'] is False and asr['onnx_telemetry_disabled'] is True,'ASR parameters changed')
    for journal in [job,asr]:
        m.need(journal['constraints']==plan['constraints'] and journal['network_guard']['native_socket_probe']=='EPERM' and
               journal['network_guard']['inherited_by_children'] is True,'Offline/constraint evidence changed')
    m.need(asr['assets_sha256']==m.sha(BATCH/'screen-selection.json'),'ASR selection binding changed')
    return result,merged,screens,groups

def catalog():
    result,assets,screens,_=load()
    cast={row['candidate_id']:row['name'] for row in m.inputs()[0]['cast']}
    slow={a['normal_asset_id']:a for a in assets if a['speed']=='slow'}
    pairs=[]
    for normal in [a for a in assets if a['speed']=='normal']:
        slots=[]
        for a in [normal,slow[normal['asset_id']]]:
            s=screens[a['asset_id']]
            slots.append({'id':a['asset_id'],'code':a['stable_code'],'pace':a['speed'],'available':True,
                'sha256':a['sha256'],'path':a['path'],'duration':a['metrics']['duration_seconds'],
                'cues':[{'speaker':cast[t['candidate_id']],'text':t['text'],'start':t['start_ms']/1000,'end':t['end_ms']/1000} for t in a['timing']],
                'asr':{'transcript':s['transcript'],'word_edits':s['word_edits'],'flagged':s['word_edits']>0}})
        code=normal['stable_code']
        pairs.append({'id':normal['asset_id'],'language':normal['language'],'kind':'turn' if '_TURN_' in code else 'dialogue' if '_DIALOGUES_' in code else 'word',
            'text':normal['transcript'],'slots':slots,'speakers':sorted({cue['speaker'] for s in slots for cue in s['cues']})})
    b.AUDIO_SOURCE=result['source_base_sha']
    return b.finalize(pairs,'M01_COMPLETE_DRAFT',m.sha(BATCH/'results.json')),assets,result

def metadata(args):
    manifest,assets,result=catalog()
    report={'status':'PASS','scope':'COMPLETION_METADATA_ONLY_AUDIO_EXTERNAL',**b.source_state(),
        'counts':result['counts'],'catalog_counts':manifest['counts'],'dataset_sha256':manifest['dataset_sha256'],
        'results_sha256':m.sha(BATCH/'results.json'),'tool_sha256':m.sha(Path(__file__)),
        'audio_bytes_verified':False,'wav_files_verified':0,'human_review':'PENDING','publication_ready':False,'p5_milestone':'NOT_READY','p6_authorized':False}
    if args.report: m.write(args.report,report)
    print(json.dumps(report))

def deliver(args):
    manifest,assets,result=catalog()
    verified,_,_,_,_=checked_assembly(args.output,args.audio_root,args.continuation_root)
    m.need(assets==verified,'Delivery assembly mismatch')
    destination=c.destination_for(args.destination,args.output,args.audio_root,args.continuation_root,m.ROOT)
    destination.mkdir(mode=0o700)
    shutil.copytree(args.output/'audio',destination/'audio')
    for rel in ['raw','turns','recovery/raw','recovery/turns']:
        shutil.copytree(args.audio_root/rel,destination/'parent'/rel)
    for rel in ['raw','turns','attempts']:
        shutil.copytree(args.continuation_root/rel,destination/'pocket'/rel)
    shutil.copytree(BATCH,destination/'provenance')
    for name in ['m01-completion-attribution.md']:
        shutil.copyfile(m.ROOT/'docs/p5'/name,destination/name)
    m.write(destination/'catalog.json',manifest)
    m.write(destination/'all-assets.json',assets)
    _,_,screens,_=load()
    m.write(destination/'all-asr-screens.json',list(screens.values()))
    (destination/'README_UA.md').write_text('# Lingvessa M01: повна робоча чернетка\n\n420 WAV: 210 англійських і 210 чеських. 216 попередніх файлів збережені побайтово. Усі 204 додаткові файли перевірені сліпим ASR.\n\nASR-прапорці є підказками для перевірки, а не підтвердженням помилки вимови. Людське прослуховування, остаточне затвердження голосів і прав та публікація ще не виконані.\n\n'+json.dumps(result['counts'],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    files=[m.file_record(p,destination) for p in sorted(destination.rglob('*')) if p.is_file()]
    m.need(sum(p['path'].endswith('.wav') for p in files)==1027,'Delivery WAV inventory mismatch')
    m.write(destination/'SHA256SUMS.json',files)
    archive=destination.with_suffix('.zip')
    with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(destination.rglob('*')):
            if p.is_file(): z.write(p,p.relative_to(destination).as_posix())
    encoded={a['asset_id']:base64.b64encode((args.output/a['path']).read_bytes()).decode() for a in assets}
    page=b.write_page(manifest,encoded,destination.parent,'Lingvessa_M01_Complete_Listening_Review_2026-10-14.html')
    html=destination.parent/page['html_file']
    document=html.read_text()
    document=document.replace('0 / 216','0 / 420').replace('max="216"','max="420"')
    document=document.replace('id="ready-count">216','id="ready-count">420').replace('id="missing-count">204','id="missing-count">0')
    document=document.replace('Авторські тексти Lingvessa, синтетичні голоси Piper. Робочі англійські голоси: Maya, Daniel, Alex; доступний чеський — Adam. Англійська модель VCTK і чеська Jirka;',
        'Авторські тексти Lingvessa, синтетичні голоси Piper та Pocket TTS Czech. Англійські голоси: Maya, Daniel, Alex; чеські: Klára, Adam, Oksana. Моделі VCTK, Jirka та Pocket TTS Czech;')
    document=document.replace('204 чеські записи ще не створено через недоступність зафіксованої залежності синтезу. Вони показані окремо та не мають оцінок.',
        'Доступні всі 420 записів. 204 чеські файли додано після відновлення зафіксованого середовища; попередні 216 файлів збережені без змін.')
    html.write_text(document,encoding='utf-8')
    delivery={'zip':m.file_record(archive,destination.parent),'html':m.file_record(html,destination.parent),
        'dataset_sha256':manifest['dataset_sha256'],'embedded_wavs':420,'payload_wavs':1027}
    c.exclusive_json(BATCH/'delivery.json',delivery)
    print(json.dumps(delivery))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['screen','retain','metadata','deliver'])
    parser.add_argument('--recover-assembly-marker',action='store_true')
    for key in ['output','audio-root','continuation-root','models','run-root','destination','report']:
        parser.add_argument('--'+key,type=Path)
    args=parser.parse_args()
    for key,value in vars(args).items():
        if isinstance(value,Path): setattr(args,key,value.resolve())
    globals()[args.command](args)

if __name__=='__main__': main()
