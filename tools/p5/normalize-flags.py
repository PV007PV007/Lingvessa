#!/usr/bin/env python3
"""Reproducible build of static, resource-free SVG drafts from pinned flag sources.

This does not change the runtime SVG allowlist or confer publication approval.
No runtime downloader or dependency on the upstream package is introduced.
"""
import copy
import hashlib
import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path('assets/specs/p5/flags')
SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)


def intersection(subject, clip):
    """Sutherland-Hodgman intersection for the four convex UK clip triangles."""
    area = sum(clip[i][0]*clip[(i+1) % len(clip)][1]-clip[(i+1) % len(clip)][0]*clip[i][1] for i in range(len(clip)))
    direction = 1 if area > 0 else -1
    for i, a in enumerate(clip):
        b = clip[(i+1) % len(clip)]
        def side(p):
            return direction*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))
        output = []
        if not subject:
            break
        previous = subject[-1]
        for point in subject:
            sp, sq = side(previous), side(point)
            if (sp >= -1e-9) != (sq >= -1e-9):
                t = sp/(sp-sq)
                output.append((previous[0]+t*(point[0]-previous[0]), previous[1]+t*(point[1]-previous[1])))
            if sq >= -1e-9:
                output.append(point)
            previous = point
        subject = output
    return subject


def strip(a, b, radius):
    dx, dy = b[0]-a[0], b[1]-a[1]
    length = math.hypot(dx, dy)
    nx, ny = -dy/length*radius, dx/length*radius
    return [(a[0]+nx, a[1]+ny), (b[0]+nx, b[1]+ny), (b[0]-nx, b[1]-ny), (a[0]-nx, a[1]-ny)]


def uk_static():
    root = ET.Element('{%s}svg' % SVG, {'viewBox': '0 0 60 30'})
    def element(tag, **attrs):
        return ET.SubElement(root, '{%s}%s' % (SVG, tag), {k.replace('_', '-'): str(v) for k, v in attrs.items()})
    element('rect', width=60, height=30, fill='#012169')
    element('path', d='M0 0L60 30M0 30L60 0', stroke='#fff', stroke_width=6)
    clips = [[(30,15),(60,15),(60,30)],[(30,15),(30,30),(0,30)],[(30,15),(0,15),(0,0)],[(30,15),(30,0),(60,0)]]
    for a, b in [((0,0),(60,30)),((0,30),(60,0))]:
        for clip in clips:
            points = intersection(strip(a,b,2),clip)
            if len(points) >= 3:
                element('polygon', points=' '.join(f'{x:.9f},{y:.9f}' for x,y in points), fill='#C8102E')
    element('path', d='M30 0V30M0 15H60', stroke='#fff', stroke_width=10)
    element('path', d='M30 0V30M0 15H60', stroke='#C8102E', stroke_width=6)
    return root


def expand_local_use(root):
    identities = {e.attrib['id']:e for e in root.iter() if 'id' in e.attrib}
    def expand(e, seen=()):
        if e.tag == '{%s}use' % SVG:
            href = e.attrib.get('{http://www.w3.org/1999/xlink}href', e.attrib.get('href',''))
            if not href.startswith('#') or href[1:] not in identities or href in seen or len(seen)>20:
                raise ValueError('Invalid/cyclic/external flag reference')
            result = ET.Element('{%s}g' % SVG)
            attrs = {k:v for k,v in e.attrib.items() if k not in ('x','y','href','{http://www.w3.org/1999/xlink}href','id','transform')}
            attrs['transform'] = f"{e.attrib.get('transform','')} translate({e.attrib.get('x','0')} {e.attrib.get('y','0')})".strip()
            result.attrib.update(attrs)
            result.append(expand(identities[href[1:]], seen+(href,)))
            return result
        result = copy.copy(e)
        result.attrib = {k:v for k,v in e.attrib.items() if k!='id'}
        result[:] = [expand(child,seen) for child in e]
        return result
    return expand(root)


provenance = json.loads((ROOT/'provenance.json').read_text())
for name, expected in provenance['source_sha256'].items():
    raw = (ROOT/'source'/name).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=expected or b'<!DOCTYPE' in raw or b'<!ENTITY' in raw:
        raise ValueError('Flag source mismatch or unsafe XML')
    root = uk_static() if name=='gb.svg' else expand_local_use(ET.fromstring(raw))
    for child in list(root):
        if child.tag in ('{%s}title' % SVG,'{%s}desc' % SVG):
            root.remove(child)
    x,y,w,h = map(float,root.attrib['viewBox'].split())
    if x!=0 or y!=0 or w<=0 or h<=0:
        raise ValueError('Unsupported viewport')
    root.attrib['width']=str(round(600*w/h));root.attrib['height']='600'
    text = ET.tostring(root, encoding='unicode',short_empty_elements=True)
    if any(marker in text for marker in ('href=', 'clip-path=', 'url(', '<use', '<clipPath', '<defs')):
        raise ValueError('Unflattened active resource')
    target = ROOT/'normalized'/name
    if '--write' in sys.argv:
        target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text)
    elif target.read_text()!=text:
        raise ValueError('Normalized flag drift: '+name)
print('PASS: seven pinned static flag drafts, native proportions; human QA pending')
