#!/usr/bin/env python3
"""Prove processing of retained raw audio; never synthesize or alter original journals."""
import argparse
import importlib.util
from pathlib import Path
import tempfile
spec=importlib.util.spec_from_file_location('m01',Path(__file__).with_name('m01-audio-draft.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def recover(output,models):
    m.offline()
    plan,registry,turns,cast=m.inputs()
    versions=m.environment('docs/p5/voice-audition/pocket-20261009/tooling-lock.json')
    job=m.read(output/'generation-pocket.json')
    m.need(job['status']=='COMPLETE' and job['versions']==versions,'Generation did not complete')
    target=output/'processing-recovery.json'
    m.need(not target.exists(),'Recovery already recorded')
    lock=m.read(m.ROOT/'docs/p5/voice-audition/pocket-20261009/models.lock.json')
    for name,row in lock['files'].items():m.need(m.sha(models/name)==row['sha256'],'Model changed')
    import yaml
    import torch
    from pocket_tts import TTSModel
    from pocket_tts.models.text_chunking import prepare_text_prompt,split_into_best_sentences
    torch.set_num_threads(2);torch.set_num_interop_threads(1);torch.manual_seed(20261009)
    cfg=yaml.safe_load((models/'czech.yaml').read_text())
    cfg['weights_path']=str(models/'model.safetensors')
    cfg['flow_lm']['lookup_table']['tokenizer_path']=str(models/'tokenizer.model')
    p=plan['generation']['pocket'];proofs=[]
    with tempfile.TemporaryDirectory() as temp:
        temp=Path(temp);config=temp/'czech.yaml';config.write_text(yaml.safe_dump(cfg))
        model=TTSModel.load_model(config=config,temp=p['temperature'],sampler_decode_steps=p['sampler_decode_steps'],
                                 noise_clamp=p['noise_clamp'],eos_threshold=p['eos_threshold'])
        model.capitalize_first_letter=p['capitalize_first_letter']
        for key in job['attempts']:
            path=output/'attempts'/f'{key}.json';row=m.read(path)
            if row['status']!='STARTED':continue
            candidate=cast[row['voice_code']]
            m.need(all(row.get(k)==v for k,v in turns[key].items()),'Turn source changed')
            chunks=split_into_best_sentences(model.flow_lm.conditioner.tokenizer,row['text'],p['max_tokens'],
                model.pad_with_spaces_for_short_inputs,model.remove_semicolons,model.append_terminal_punctuation,
                model.capitalize_first_letter,model.replace_characters)
            m.need(len(chunks)==1,'Unexpected text split')
            prepared,_=prepare_text_prompt(chunks[0],model.pad_with_spaces_for_short_inputs,model.remove_semicolons,
                model.append_terminal_punctuation,model.capitalize_first_letter,model.replace_characters)
            raw=output/'raw'/f'{key}.wav';normal=output/'turns'/f'{key}.wav';slow=output/'turns'/f'{key}-slow.wav'
            n=temp/f'{key}.wav';s=temp/f'{key}-slow.wav'
            processing=m.normalize(raw,n,s,plan)
            m.need(m.sha(n)==m.sha(normal) and m.sha(s)==m.sha(slow),'Processing bytes differ')
            derived=dict(row,status='GENERATED_UNREVIEWED',normalization=processing,raw=m.file_record(raw,output),
                normal=m.file_record(normal,output,True),slow=m.file_record(slow,output,True),
                engine_result={'model_sha256':lock['files']['model.safetensors']['sha256'],'reference_sha256':candidate['reference_sha256'],
                    'prepared_text':prepared,'token_ids':model.flow_lm.conditioner.tokenizer(prepared)[0].tolist()})
            proofs.append({'original_record_sha256':m.sha(path),'normal_and_slow_byte_identical_to_rederived':True,'turn':derived})
    m.need(proofs,'No stale journal to recover')
    result={'kind':'VERIFIED_PROCESSING_CHECKPOINT','script_sha256':m.sha(Path(__file__)),'journal_sha256':m.sha(output/'generation-pocket.json'),
        'synthesis_repeated':False,'explanation':'Original STARTED journals retained. Exact re-derivation of both processed WAVs from retained raw bytes. Token preparation independently reconstructed from locked model. No elapsed/completion time invented.',
        'turns':proofs}
    m.write(target,result)
    print(__import__('json').dumps({'status':'PASS','recovered_without_synthesis':len(proofs)}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--models',type=Path,required=True)
    args=parser.parse_args();recover(args.output.resolve(),args.models.resolve())
