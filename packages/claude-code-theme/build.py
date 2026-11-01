import json, os, re, zipfile, subprocess, sys
root = os.path.dirname(os.path.abspath(__file__))
os.chdir(root)
subprocess.run(['tsc', '-p', '.'], check=True)
manifest = json.load(open('manifest.json', encoding='utf-8'))
meta = {'market': 'Operit', 'toolpkgId': manifest['toolpkg_id'], 'version': manifest['version'], 'author': ['liuenmin']}
payload = json.dumps(meta, ensure_ascii=False, separators=(',', ':'))
arr = [ord(c) ^ 90 for c in payload]
main = open('dist/main.js', encoding='utf-8').read()
main = re.sub(r'\n*ToolPkg\._m\(\[[^\]]*\],\s*90\);\s*$', '', main)
main = main.rstrip('\n') + '\nToolPkg._m([' + ', '.join(str(n) for n in arr) + '],90);\n'
open('dist/main.js', 'w', encoding='utf-8').write(main)
out = os.path.join('..', 'out')
os.makedirs(out, exist_ok=True)
name = '%s-v%s.toolpkg' % (manifest['toolpkg_id'].replace('.', '-').replace('_', '-'), manifest['version'])
target = os.path.join(out, name)
skip = {'build.py', 'tsconfig.json', 'README.md.bak'}
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '__pycache__')]
        for f in files:
            p = os.path.normpath(os.path.join(base, f))
            if p in skip or p.endswith('.toolpkg') or f.endswith('.hwbk') or f.startswith('.'):
                continue
            # Superseded by the per-greeting art under resources/empty/.
            if p in ('resources/empty-light.png', 'resources/empty-dark.png'):
                continue
            z.write(p, p)
print('built', os.path.abspath(target), os.path.getsize(target), 'bytes')
print('trailer:', payload)

# Hook callbacks cannot resolve toolpkg resources ("runtime target is empty"),
# so mirror the background art to a fixed external path that the plugin reads
# directly when switching the empty-state background.
import shutil
# Derived from the manifest so renaming the package id cannot leave the mirror
# pointing at a stale directory that no longer matches the installed package.
res_dir = '/sdcard/Download/Operit/plugins/%s/resources' % manifest['toolpkg_id']
os.makedirs(res_dir, exist_ok=True)

# Carry over art generated before an id change, so the plugin keeps working
# without having to regenerate every image.
legacy_dir = '/sdcard/Download/Operit/plugins/local.operit.claude_code_theme/resources'
if manifest['toolpkg_id'] != 'local.operit.claude_code_theme' and os.path.isdir(legacy_dir):
    for base, dirs, files in os.walk(legacy_dir):
        rel = os.path.relpath(base, legacy_dir)
        dst_base = res_dir if rel == '.' else os.path.join(res_dir, rel)
        os.makedirs(dst_base, exist_ok=True)
        for f in files:
            dst = os.path.join(dst_base, f)
            if os.path.exists(dst):
                continue
            try:
                shutil.copyfile(os.path.join(base, f), dst)
            except OSError as error:
                print('carry-over failed:', f, error)

# Mirror the plain backgrounds at the top level.
for name in ('background-light.png', 'background.png'):
    src = os.path.join('resources', name)
    if os.path.isfile(src):
        shutil.copyfile(src, os.path.join(res_dir, name))

# Mirror the empty-state art, keeping the per-greeting subdirectory.
# Files are overwritten in place: the directory may be in use elsewhere, and
# deleting it first fails with EBUSY / EIO.
empty_src = os.path.join('resources', 'empty3')
empty_dst = os.path.join(res_dir, 'empty3')
os.makedirs(empty_dst, exist_ok=True)

count = 0
for name in sorted(os.listdir(empty_src)):
    if not name.endswith('.png'):
        continue
    dst = os.path.join(empty_dst, name)
    try:
        shutil.copyfile(os.path.join(empty_src, name), dst)
        count += 1
    except OSError as error:
        print('mirror failed:', name, error)
print('resources mirrored ->', empty_dst, '(%d empty-state images)' % count)
