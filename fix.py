import glob
files = glob.glob('.github/workflows/apm02_*.yml')
for f in files:
    content = open(f, 'r', encoding='utf-8').read()
    content = content.replace('gh release view "apm02-active-snapshot"', 'gh release view "apm02-active-snapshot" --repo ${{ github.repository }}')
    content = content.replace('gh release create "apm02-active-snapshot"', 'gh release create "apm02-active-snapshot" --repo ${{ github.repository }}')
    content = content.replace('gh release edit "apm02-active-snapshot"', 'gh release edit "apm02-active-snapshot" --repo ${{ github.repository }}')
    content = content.replace('gh release delete "apm02-active-snapshot"', 'gh release delete "apm02-active-snapshot" --repo ${{ github.repository }}')
    open(f, 'w', encoding='utf-8').write(content)
# dummy commit for testing
