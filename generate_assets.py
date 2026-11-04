from pathlib import Path
p=Path(__file__).parent/'public/assets';p.mkdir(exist_ok=True)
items=['coast','garage','marina','downtown','palms','cliff','harbor','bay','villa','loft','marina-home','beach','palms-home','harbor-home']
for i,name in enumerate(items):
    W,H=(1920,1080) if name=='coast' else (900,650)
    skyline=''.join(f'<rect x="{j*95-40}" y="{H*.35+(j*71+i*43)%170}" width="{55+(j*17)%45}" height="{H}" fill="{["#d9d5c5","#e5dfcc","#c7d4cd","#e9e3d5"][j%4]}"/><rect x="{j*95-25}" y="{H*.39+(j*71+i*43)%170}" width="9" height="18" fill="#7caaaf" opacity=".65"/>' for j in range(25))
    palms=''.join(f'<path d="M {x} {H*.85} q 15 -100 0 -200" stroke="#6a7560" stroke-width="12" fill="none"/><path d="M {x} {H*.85-200} q -70 -65 -110 -20 M {x} {H*.85-200} q 80 -65 115 -10 M {x} {H*.85-200} q -20 -90 -65 -95 M {x} {H*.85-200} q 20 -90 65 -95" stroke="#416f62" stroke-width="16" stroke-linecap="round" fill="none"/>' for x in [W*.14,W*.86])
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#5e9eb3"/><stop offset=".55" stop-color="#a9d3d2"/><stop offset="1" stop-color="#e5d9b8"/></linearGradient><linearGradient id="sea" x2="0" y2="1"><stop stop-color="#5bafba"/><stop offset="1" stop-color="#2c7c8e"/></linearGradient></defs><rect width="{W}" height="{H}" fill="url(#sky)"/><circle cx="{W*.76}" cy="{H*.22}" r="{H*.105}" fill="#fff0c5" opacity=".87"/><path d="M 0 {H*.6} Q {W*.35} {H*.52} {W} {H*.62} V {H} H 0" fill="url(#sea)"/><g opacity=".95">{skyline}</g><path d="M 0 {H*.75} Q {W*.3} {H*.65} {W*.52} {H*.83} L {W} {H*.88} L {W} {H} H 0" fill="#e8d8b7"/><path d="M 0 {H*.88} L {W} {H*.88}" stroke="#f9efdc" stroke-width="14"/>{palms}<text x="{W*.045}" y="{H*.95}" font-family="Arial" font-size="{H*.035}" letter-spacing="6" fill="#ffffff" opacity=".7">AZURE COAST / {name.upper()}</text></svg>'''
    (p/f'{name}.svg').write_text(svg)
print('generated',len(items),'local SVG illustrations')
