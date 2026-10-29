#!/usr/bin/env python3
"""Package unchanged audition WAVs with an offline human-review worksheet."""
import argparse
import base64
import hashlib
import html
import json
from pathlib import Path
import subprocess
import wave

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'docs/p5/voice-audition'
TITLE = 'Lingvessa_Czech_Listening_Review_2026-10-11.html'
BATCHES = ['pocket-case-20261010', 'pocket-case-holdout-20261010']


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def clip(row, label, clip_id):
    path = ROOT / row['path']
    data = path.read_bytes()
    if digest(data) != row['sha256']:
        raise ValueError(f'Audio hash mismatch: {path}')
    with wave.open(str(path)) as audio:
        if audio.getsampwidth() != 2 or audio.getnchannels() != 1:
            raise ValueError('Expected retained mono PCM16')
        duration = audio.getnframes() / audio.getframerate()
    binding = {'id': clip_id, 'path': row['path'], 'sha256': row['sha256'],
               'duration_seconds': duration, 'candidate_id': row['candidate_id'],
               'pace': row['pace'], 'variant': row.get('variant', 'anchor')}
    player = (f'<div class="clip"><h4>{html.escape(label)}</h4>'
              f'<audio id="{clip_id}" controls preload="none" aria-label="{html.escape(label)}" '
              f'src="data:audio/wav;base64,{base64.b64encode(data).decode()}">'
              'Ваш браузер не підтримує аудіо.</audio></div>')
    return binding, player


def build(destination):
    destination.mkdir(parents=True, exist_ok=True)
    pairs, anchors, sections = [], [], []
    for batch_index, batch in enumerate(BATCHES):
        rows = read(BASE / batch / 'results.json')['outputs']
        cards = []
        for candidate, voice in [('cs-B-pocket-A', 'B'), ('cs-C-pocket-C', 'C')]:
            for pace, pace_label in [('normal', 'Звичайний темп'), ('slow', 'Повільний темп')]:
                number = len(pairs) + 1
                pair_id = f'pair-{number}'
                title = f'{number:02d} · Голос {voice} · {pace_label.lower()}'
                # Fixed counterbalanced order, not a randomized or secure blinded study.
                variants = ['control', 'lowercase'] if number % 2 else ['lowercase', 'control']
                bindings, players = [], []
                for side, variant in zip(['X', 'Y'], variants):
                    row = next(r for r in rows if r['candidate_id'] == candidate and r['pace'] == pace and r['variant'] == variant)
                    binding, player = clip(row, f'{title} · Варіант {side}', f'{pair_id}-{side}')
                    bindings.append(binding)
                    players.append(player)
                pairs.append({'id': pair_id, 'batch': batch, 'title': title, 'clips': bindings})
                cards.append(f'''<article class="pair" id="{pair_id}"><h3>{title}</h3><div class="clips">{''.join(players)}</div>
<div class="response"><label for="{pair_id}-choice">Який варіант звучить краще?</label>
<select id="{pair_id}-choice" data-field="choice"><option value="pending">Ще не обрано</option><option value="X">Варіант X</option><option value="Y">Варіант Y</option><option value="tie">Не чую переваги</option><option value="neither">Обидва потребують виправлення</option><option value="unsure">Не можу оцінити</option></select>
<label class="check"><input type="checkbox" id="{pair_id}-listened" data-field="listened">Прослухав/ла обидва записи повністю</label>
<label for="{pair_id}-notes">Зауваження до слів і звучання</label><textarea id="{pair_id}-notes" data-field="notes" rows="3" maxlength="2000" placeholder="Наприклад: X — слово …, час 0:04; Y — надто довга пауза …"></textarea></div></article>''')
        title = 'Початковий уривок' if batch_index == 0 else 'Нові фрази'
        sections.append(f'<section id="batch-{batch_index + 1}"><div class="section-head"><span>Набір {batch_index + 1} / 2</span><h2>{title}</h2></div><blockquote lang="cs">{html.escape(rows[0]["text"])}</blockquote>{"".join(cards)}</section>')
    anchor_players = []
    for row in read(BASE / 'results.json')['outputs']:
        if row['language'] == 'cs':
            label = 'Голос A · ' + ('звичайний темп' if row['pace'] == 'normal' else 'повільний темп')
            binding, player = clip(row, label, f'anchor-{row["pace"]}')
            anchors.append(binding)
            anchor_players.append(player)
    source_sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=normal'], cwd=ROOT, text=True).strip())
    review_set = {'schema_version': 1, 'pairs': pairs, 'anchors': anchors}
    review_set_sha = digest(json.dumps(review_set, sort_keys=True, ensure_ascii=False).encode())
    template_path = ROOT / 'tools/p5/listening-review.html'
    manifest = {**review_set, 'review_set_sha256': review_set_sha, 'source_sha': source_sha,
                'working_tree_dirty': dirty, 'audio_source_sha': '6cdc635b55da0a8d38cd94a9b14d48f80640942e',
                'builder_sha256': digest(Path(__file__).read_bytes()), 'template_sha256': digest(template_path.read_bytes()),
                'human_review': 'PENDING', 'publication_ready': False, 'p5_milestone': 'NOT_READY', 'p6_authorized': False}
    document = template_path.read_text(encoding='utf-8')
    replacements = {'__SECTIONS__': ''.join(sections), '__ANCHORS__': ''.join(anchor_players),
                    '__MANIFEST__': json.dumps(manifest, ensure_ascii=False).replace('<', '\\u003c')}
    for token, value in replacements.items():
        if document.count(token) != 1:
            raise ValueError(f'Expected one template marker: {token}')
        document = document.replace(token, value)
    page = destination / TITLE
    page.write_text(document, encoding='utf-8')
    manifest['html_file'] = TITLE
    manifest['html_sha256'] = digest(page.read_bytes())
    (destination / 'listening-review-manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({'html': str(page), 'sha256': manifest['html_sha256'], 'audio_players': 18,
                      'comparisons': len(pairs), 'source_sha': source_sha, 'working_tree_dirty': dirty}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'artifacts/p5')
    build(parser.parse_args().output_dir.resolve())
