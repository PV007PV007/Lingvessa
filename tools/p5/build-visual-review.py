#!/usr/bin/env python3
"""Package 30 unchanged SVG drafts with their exact metadata and offline review notes."""
import base64
import hashlib
import html
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/p5'
TITLE = 'Lingvessa_M01_Visual_Review_2026-10-19.html'
sha = lambda data: hashlib.sha256(data).hexdigest()


def build():
    source = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    if os.environ.get('GITHUB_HEAD_SHA') not in (None, source):
        raise ValueError('Exact hosted source required')
    plan = json.loads((OUT / 'm01-publication-bindings.json').read_text())
    if plan['source_sha'] != source or plan['resolved_assets'] != 450 or plan['publication_ready']:
        raise ValueError('Invalid preparatory publication bindings')
    registry_path = ROOT / 'assets/media/m01/registry.json'
    registry = json.loads(registry_path.read_text())
    group, = [g for g in registry['batches'] if g['approval_status'] == 'PENDING_VISUAL_REVIEW']
    items, cards = [], []
    labels = {'image': 'Сцена', 'avatar': 'Персонаж', 'vector': 'Піктограма / прапор'}
    for record in group['records']:
        data = (ROOT / record['path']).read_bytes()
        if sha(data) != record['sha256']:
            raise ValueError('Immutable visual record hash mismatch')
        rows = json.loads(data)
        if len(rows) != record['count']:
            raise ValueError('Visual record count mismatch')
        for row in rows:
            m = row['metadata']
            raw = (ROOT / row['file']).read_bytes()
            if sha(raw) != m['checksum'] or len(raw) != m['byte_length'] or row['human_review'] != 'PENDING':
                raise ValueError('Visual bytes or review state changed')
            binding, = [b for b in plan['bindings'] if b['asset_id'] == m['asset_id']]
            for field in ['asset_version', 'checksum', 'stable_code']:
                if binding[field] != m[field]:
                    raise ValueError('Publication binding mismatch')
            number = len(items) + 1
            ident = f'visual-{number}'
            observation = 'Перевірте відповідність навчальному контексту, опису та джерелу.'
            if m['stable_code'] == 'IMG_ENG_M01_MORNING_01':
                observation = 'Опис говорить про низьке сонце. На зображенні цей сигнал неочевидний: перевірте, чи сцена однозначно передає ранок.'
            elif 'UNCLEAR' in m['stable_code']:
                observation = 'Дві бульбашки можуть читатися як звичайна розмова. Перевірте, чи зрозуміле значення «Не зрозуміло» разом із текстовою міткою.'
            elif 'FLAG' in m['stable_code']:
                observation = 'Це прапор країни. Перевірте геометрію, пропорції й контекст використання; заява upstream про права не є затвердженням проєкту.'
            item = {'id': ident, 'file': row['file'], 'metadata': m, 'record_path': record['path'],
                    'record_sha256': record['sha256'], 'assistant_observation': observation}
            items.append(item)
            controls = ''
            for field, label in [('quality', 'Зміст і вигляд'), ('accessibility', 'Опис і зрозумілість'), ('rights', 'Походження та права')]:
                controls += f'''<label for="{ident}-{field}">{label}</label><select id="{ident}-{field}" data-field="{field}"><option value="pending">Ще не переглянуто</option><option value="looks_ok">Зауважень немає</option><option value="change">Потрібне уточнення / зміна</option><option value="unsure">Не можу оцінити</option></select>'''
            esc = html.escape
            cards.append(f'''<article class="card" id="{ident}" data-language="{m['scope']['language']}">
<div class="eyebrow">{number:02d} / 30 · {m['scope']['language'].upper()} · {labels[m['kind']]}</div><h2>{esc(m['stable_code'])}</h2>
<div class="picture"><img src="data:image/svg+xml;base64,{base64.b64encode(raw).decode()}" alt="{esc(m['alt_text'], quote=True)}" width="{m['width']}" height="{m['height']}"></div>
<p class="alt"><strong>Опис:</strong> {esc(m['alt_text'])}</p><p class="observation">{esc(observation)}</p>
<details><summary>Джерело й точна версія</summary><p>{esc(m['rights']['licence'])}</p><p>{esc(m['rights']['provenance'])}</p><p>Версія {m['asset_version']} · {esc(m['version_code'])}</p><code>{m['checksum']}</code><p class="path">{esc(row['file'])}</p></details>
<div class="fields">{controls}<label for="{ident}-notes">Зауваження</label><textarea id="{ident}-notes" data-field="notes" maxlength="2000" rows="3" placeholder="Що саме варто уточнити або змінити?"></textarea></div></article>''')
    if len(items) != 30:
        raise ValueError('Expected exactly 30 visual drafts')
    template_path = ROOT / 'tools/p5/visual-review.html'
    bindings = [{'id': x['id'], 'asset_id': x['metadata']['asset_id'], 'asset_version': x['metadata']['asset_version'],
                 'checksum': x['metadata']['checksum'], 'record_sha256': x['record_sha256']} for x in items]
    review_set = {'schema_version': 1, 'source_sha': source, 'items': items}
    manifest = {**review_set, 'bindings': bindings,
                'review_set_sha256': sha(json.dumps(review_set, sort_keys=True, ensure_ascii=False).encode()),
                'working_tree_dirty': bool(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=normal'], cwd=ROOT, text=True).strip()),
                'code_bindings': {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [Path(__file__), template_path, registry_path]},
                'human_review': 'PENDING', 'rights_approval': 'PENDING', 'publication_ready': False, 'p6_authorized': False}
    document = template_path.read_text()
    for key, value in {'__CARDS__': ''.join(cards), '__MANIFEST__': json.dumps(manifest, ensure_ascii=False).replace('<', '\\u003c')}.items():
        if document.count(key) != 1:
            raise ValueError('Template marker mismatch')
        document = document.replace(key, value)
    OUT.mkdir(parents=True, exist_ok=True)
    page = OUT / TITLE
    page.write_text(document)
    manifest.update(html_file=TITLE, html_sha256=sha(page.read_bytes()))
    (OUT / 'visual-review-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'source_sha': source, 'visuals': len(items), 'html_sha256': manifest['html_sha256'], 'human_review': 'PENDING'}))


if __name__ == '__main__':
    build()
