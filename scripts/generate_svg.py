import base64

def generate_svgs():
    files = [
        ('frontend/public/logo-light.png', 'frontend/public/logo.svg'),
        ('frontend/public/logo-light.png', 'frontend/public/logo-light.svg'),
        ('frontend/public/logo-dark.png', 'frontend/public/logo-dark.svg'),
        ('frontend/public/logo-light.png', 'frontend/src/assets/logo.svg'),
        ('frontend/public/logo-dark.png', 'frontend/src/assets/logo-dark.svg')
    ]
    for png_path, svg_path in files:
        with open(png_path, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('utf-8')
        svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 961 335" width="100%" height="100%">
  <image href="data:image/png;base64,{b64}" width="961" height="335" />
</svg>'''
        with open(svg_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)
        print(f"Generated {svg_path}")

if __name__ == '__main__':
    generate_svgs()
