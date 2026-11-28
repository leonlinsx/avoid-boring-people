"""Native source-led type: whole sentences, measured word timing, no inference."""
from __future__ import annotations
import math
import re

VERSION = 'ABP-SOURCE-TYPE-1'
MIN_FONT = 38


def plan(item, alignment, duration):
    """Never excerpt across a qualification or estimate speech timing.

    The compiler verifies complete owned paragraphs. This renderer retains each
    entire source sentence, including its negations/conditions, as one panel.
    """
    paragraph=' '.join(re.sub(r'[*_`]', '', item['source_anchor']).split())
    if ' '.join(item.get('source_sentences',[])) != paragraph:
        raise ValueError('source type must retain the complete source paragraph')
    words = alignment['words']
    if ' '.join(w['word'] for w in words) != item['text']:
        raise ValueError('source type requires exact aligned narration')
    for i, word in enumerate(words):
        start, end = word['start'], word['end']
        if not (math.isfinite(start) and math.isfinite(end) and 0 <= start < end <= duration):
            raise ValueError('source type invalid word time')
        if i and start < words[i-1]['start']:
            raise ValueError('source type unordered words')
    sentences = item.get('source_sentences', [])
    if not sentences:
        raise ValueError('source type requires complete source sentences')
    cursor = 0
    panels = []
    for sentence in sentences:
        tokens = sentence.split()
        match = next((i for i in range(cursor, len(words)-len(tokens)+1)
                      if [w['word'] for w in words[i:i+len(tokens)]] == tokens), None)
        if match is None:
            raise ValueError('source type source sentence missing from narration')
        segment = words[match:match+len(tokens)]
        span = segment[-1]['end'] - segment[0]['start']
        if len(tokens)/span > 5.5:
            raise ValueError('source type exceeds reading pace')
        dependent=re.match(r"(?i)^(?:it(?:'s)?|this|that|these|those|they|their|the person's|if|but|so|for example|with luck|in the short term|from there|once)\b",sentence)
        if panels and dependent:
            panels[-1]['text']+=' '+sentence
            panels[-1]['words']+=segment
            panels[-1]['end']=segment[-1]['end']
        else:
            panels.append({'text':sentence, 'words':segment,
                           'start':segment[0]['start'], 'end':segment[-1]['end']})
        cursor = match + len(tokens)
    if any(len(p['words'])/(p['end']-p['start'])>5.5 for p in panels):
        raise ValueError('source type exceeds reading pace')
    return {'version':VERSION, 'sentences':panels}


def layout(panel, measure):
    """Fit an entire sentence before encoding; never shrink indefinitely or clip."""
    for size in range(64, MIN_FONT-1, -2):
        lines = []; line = []
        for word in panel['words']:
            candidate = line + [word]
            if line and measure(' '.join(w['word'] for w in candidate), size) > 760:
                lines.append(line); line = [word]
            else:
                line = candidate
        if line:lines.append(line)
        if (len(lines)*size*1.2 <= 500 and
                all(measure(' '.join(w['word'] for w in line),size) <= 760 for line in lines)):
            return {'font_size':size, 'lines':lines}
    raise ValueError('source type whole sentence exceeds readable layout')


def draw(renderer, canvas, treatment, t):
    renderer.text(canvas,'LEON LIN’S PERSPECTIVE',120,645,26,renderer.MUTED)
    panels = treatment['sentences']
    index = max((i for i,p in enumerate(panels) if p['start'] <= t), default=0)
    panel = panels[index]; fitted = panel['layout']; size = fitted['font_size']
    # Complete sentence is visible from entry, so an animated fragment never
    # stands alone as an unqualified claim. Only position/emphasis change.
    elapsed = max(0,t-panel['start'])
    offset = int(12*(1-renderer.ease(elapsed/.25))) if t >= panel['start'] else 0
    for row,line in enumerate(fitted['lines']):
        x = 120; y = 690 + row*size*1.2 + offset
        for word in line:
            active = word['start'] <= t < word['end']
            renderer.text(canvas,word['word'],x,y,size,renderer.GREEN if active else renderer.WHITE)
            x += canvas.textlength(word['word']+' ',font=renderer.font(size))
    # Discrete sentence position is narrative structure, not a data chart.
    for i in range(len(panels)):
        x = 125 + i*34
        canvas.ellipse((x,1220,x+10,1230),fill=renderer.GREEN if i==index else renderer.MUTED)
