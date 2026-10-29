#!/usr/bin/env python3
"""Build the portable, offline Czech case-trial listening document and archive."""
import argparse
import base64
import hashlib
import html
import json
from pathlib import Path
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'docs/p5/voice-audition'
BATCHES = ['pocket-case-20261010', 'pocket-case-holdout-20261010']
TITLE = 'Lingvessa_Czech_Comparison_2026-10-10.html'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def player(row, label):
    data = (ROOT / row['path']).read_bytes()
    if hashlib.sha256(data).hexdigest() != row['sha256']:
        raise ValueError('Audio hash mismatch')
    encoded = base64.b64encode(data).decode('ascii')
    return (f'<label>{html.escape(label)}</label><audio controls preload="none" '
            f'aria-label="{html.escape(label)}" src="data:audio/wav;base64,{encoded}">'
            'Ваш браузер не підтримує аудіопрогравач.</audio>')


def build(destination):
    destination.mkdir(parents=True, exist_ok=True)
    package = destination / 'package'
    package.mkdir(exist_ok=True)
    sections = []
    for index, batch in enumerate(BATCHES):
        folder = BASE / batch
        result, screen = read(folder / 'results.json'), read(folder / 'asr-screen.json')
        title = '01 · Початкові фрази' if index == 0 else '02 · Інші фрази для перевірки'
        intro = ('На цьому уривку варіант із малими літерами має менше розбіжностей у розпізнаванні.'
                 if index == 0 else 'На цих п’яти нових фразах обидва варіанти мають однаковий результат. Стійку перевагу не підтверджено.')
        cards = []
        score_rows = []
        for candidate, name in [('cs-B-pocket-A', 'Голос B'), ('cs-C-pocket-C', 'Голос C')]:
            for variant, label in [('control', 'Початковий текст'), ('lowercase', 'Текст малими літерами')]:
                clips = [r for r in result['outputs'] if r['candidate_id'] == candidate and r['variant'] == variant]
                audio = ''.join(player(r, f'{name} · {label} · ' + ('Звичайний темп' if r['pace'] == 'normal' else 'Повільний темп · 0,8×')) for r in clips)
                cards.append(f'<article class="card"><span class="voice">{name}</span><h3>{label}</h3>{audio}</article>')
            for pace, pace_name in [('normal', 'Звичайний'), ('slow', 'Повільний')]:
                rows = [next(r for r in screen['outputs'] if r['candidate_id'] == candidate and r['variant'] == v and r['pace'] == pace) for v in ['control', 'lowercase']]
                score_rows.append(f'<tr><th>{name} · {pace_name}</th><td>{rows[0]["word_edits"]} / {rows[0]["reference_words"]}</td><td>{rows[1]["word_edits"]} / {rows[1]["reference_words"]}</td></tr>')
        transcripts = ''.join(f'<p><strong>{"B" if r["candidate_id"] == "cs-B-pocket-A" else "C"} · {"початковий" if r["variant"] == "control" else "малі літери"} · {"звичайний" if r["pace"] == "normal" else "повільний"}</strong><br><span lang="cs">{html.escape(r["transcript"])}</span></p>' for r in screen['outputs'] if r['variant'] != 'historical')
        sections.append(f'<section><h2>{title}</h2><p>{intro}</p><blockquote lang="cs">{html.escape(result["outputs"][0]["text"])}</blockquote><div class="grid">{"".join(cards)}</div><details><summary>Показати автоматичне порівняння з текстом</summary><div class="table-wrap"><table><thead><tr><th>Голос і темп</th><th>Початковий</th><th>Малі літери</th></tr></thead><tbody>{"".join(score_rows)}</tbody></table></div><p class="muted">Кількість розбіжностей / кількість очікуваних слів. Розпізнавач може помилятися; це не оцінка вимови носієм мови.</p><details class="transcripts"><summary>Тексти, які розпізнала модель</summary>{transcripts}</details></details></section>')
    anchors = [r for r in read(BASE / 'results.json')['outputs'] if r['language'] == 'cs']
    anchor_audio = ''.join(player(r, 'Голос A · ' + ('Звичайний темп' if r['pace'] == 'normal' else 'Повільний темп')) for r in anchors)
    document = '''<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'"><title>Lingvessa · Чеські голоси · 10.10.2026</title><style>
    :root{color-scheme:light;--ink:#14352b;--muted:#506a60;--line:#cdded5;--accent:#176947}*{box-sizing:border-box}body{margin:0;background:#f4f7f3;color:var(--ink);font:16px/1.6 system-ui,-apple-system,sans-serif}main{max-width:1100px;margin:auto;padding:40px 24px 72px}.brand{letter-spacing:.14em;font-size:13px;font-weight:750;text-transform:uppercase;color:var(--accent)}header{max-width:880px;margin-bottom:36px}h1{font-size:clamp(30px,5vw,49px);line-height:1.12;letter-spacing:-.03em;margin:18px 0}h2{font-size:26px;line-height:1.3;margin:0 0 10px}h3{font-size:19px;line-height:1.3;margin:4px 0 20px}p{margin:10px 0}.lead{font-size:19px;max-width:820px}.status{display:inline-block;background:#e6edcc;border:1px solid #cedbae;border-radius:30px;padding:5px 13px;font-size:13px;font-weight:650}.note{padding:16px 20px;background:#e8f0e8;border-left:4px solid var(--accent);border-radius:6px;margin-top:22px}section{padding:30px 0;border-top:1px solid var(--line)}blockquote{font-size:19px;padding:17px 21px;margin:20px 0;background:#fff;border-left:3px solid #91b29e;border-radius:5px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{background:white;border:1px solid var(--line);border-radius:13px;padding:22px;min-width:0}.voice{color:var(--accent);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.08em}label{display:block;font-size:13px;color:var(--muted);margin:14px 0 6px}audio{display:block;width:100%;height:42px}details{margin-top:20px;padding:15px 18px;border:1px solid var(--line);border-radius:10px}summary{cursor:pointer;font-weight:650;min-height:28px}summary:focus-visible,audio:focus-visible{outline:3px solid #287954;outline-offset:4px}table{width:100%;border-collapse:collapse;font-size:14px;margin-top:14px}th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line)}thead{background:#e8f0e8}.table-wrap{overflow:auto}.muted,footer{color:var(--muted);font-size:14px}.transcripts{background:#fff}.anchor{max-width:530px}footer{padding-top:20px;border-top:1px solid var(--line)}@media(max-width:660px){main{padding:26px 16px 44px}.grid{grid-template-columns:1fr}.card{padding:18px}h2{font-size:22px}blockquote{font-size:17px}th,td{padding:8px}header{margin-bottom:26px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
    </style></head><body><main><header><div class="brand">Lingvessa / голосова майстерня / 10.10.2026</div><h1>Чеські голоси.<br>Порівняння двох варіантів.</h1><span class="status">Потрібне прослуховування</span><p class="lead">Малі літери допомогли на початковому уривку, але на інших фразах перевага не повторилася. Обидва голоси залишаються кандидатами.</p><div class="note">Прослухайте B і C у звичайному та повільному темпі. Перевірте точність слів, природність і комфорт звучання. Напишіть, який голос варто залишити, та назвіть фрази, що звучать невдало.</div></header>'''
    document += ''.join(sections)
    document += f'<section><h2>03 · Голос A для порівняння</h2><p>Попередній чеський варіант Jirka; аудіо не змінено. Текст — із першого уривка.</p><div class="card anchor">{anchor_audio}</div></section>'
    document += '<footer><p>Усі записи вбудовані у файл. Відкрийте його в браузері — інтернет для прослуховування не потрібен.</p><p>Голоси синтезовані. B/C — Pocket TTS Czech із синтетичними референсами Piper; A — Piper Jirka. Тексти написані для Lingvessa. Нове порівняння не затверджує голоси для навчальних матеріалів. P5: NOT_READY.</p><details><summary>Походження й обмеження</summary><p>Pocket TTS Czech: Václav Volhejn, ваги CC BY 4.0; навчальні дані ParCzech4Speech — автори корпусу ÚFAL, Карлів університет. Рушій Pocket TTS — Kyutai, MIT. Синтетичні референси походять із попереднього тесту Piper; повні картки моделей, ліцензійні заяви й контрольні суми збережено в супровідному архіві.</p><p>Малі літери — єдина навмисна зміна тексту; автоматичну капіталізацію для цього варіанта вимкнено. Параметри генерації та випадкові зерна однакові всередині кожної пари. Результат автоматичного розпізнавання не замінює перевірку людиною.</p></details></footer></main><script>document.querySelectorAll("audio").forEach(audio=>audio.addEventListener("play",()=>{document.querySelectorAll("audio").forEach(other=>{if(other!==audio)other.pause()})}));</script></body></html>'
    page = package / TITLE
    page.write_text(document, encoding='utf-8')
    shutil.copy2(page, destination / TITLE)
    included = set()
    for batch in BATCHES:
        for path in (BASE / batch).rglob('*'):
            if path.is_file():
                included.add(path)
    for name in ['pocket-case-trial.py', 'pocket-case-holdout.py', 'build-case-listening.py']:
        included.add(ROOT / 'tools/p5' / name)
    for batch in ['pocket-20261009', '']:
        for name in ['models.lock.json', 'tooling-lock.json', 'requirements-local.txt', 'MODEL_CARD.md', 'asr-model.lock.json', 'results.json', 'authorization.json']:
            path = BASE / batch / name
            if path.exists():
                included.add(path)
    included.add(ROOT / 'assets/specs/p5/reference-media.source.json')
    for row in read(BASE / 'pocket-20261009/results.json')['outputs'] + anchors:
        included.add(ROOT / row['path'])
    for row in read(BASE / 'pocket-case-20261010/plan.json')['candidates']:
        included.add(ROOT / row['reference_path'])
    for path in sorted(included):
        target = package / path.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
    records = [{'path': str(p.relative_to(package)), 'bytes': p.stat().st_size,
                'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in sorted(package.rglob('*')) if p.is_file() and p.name != 'SHA256SUMS.json']
    (package / 'SHA256SUMS.json').write_text(json.dumps(records, indent=2) + '\n')
    archive = destination / 'Lingvessa_Czech_Trial_2026-10-10.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for p in sorted(package.rglob('*')):
            if p.is_file():
                bundle.write(p, p.relative_to(package))
    with zipfile.ZipFile(archive) as bundle:
        if bundle.testzip() is not None:
            raise ValueError('Archive integrity failure')
        for row in records:
            data = bundle.read(row['path'])
            if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
                raise ValueError('Archive entry mismatch')
    print(json.dumps({'html': str(destination / TITLE), 'archive': str(archive),
                      'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                      'verified_entries': len(records), 'audio_players': document.count('<audio ')}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True, type=Path)
    args = parser.parse_args()
    if not args.output_dir.is_absolute():
        raise ValueError('Use an absolute output directory')
    build(args.output_dir)
