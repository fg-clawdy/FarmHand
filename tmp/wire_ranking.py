from pathlib import Path
import re

repo = Path(r"C:\Users\theha\Documents\GIT\FarmHand")

idx = repo / "packages/shared/src/index.ts"
t = idx.read_text(encoding="utf-8")
if "choreSuggest" not in t:
    if not t.endswith("\n"):
        t += "\n"
    t += 'export * from "./choreSuggest.js";\n'
    idx.write_text(t, encoding="utf-8")
    print("index ok")
else:
    print("index skip")

pkg = repo / "packages/shared/package.json"
p = pkg.read_text(encoding="utf-8")
old = "src/choreCatalog.test.ts src/chores.test.ts"
new = "src/choreCatalog.test.ts src/choreSuggest.test.ts src/chores.test.ts"
if "choreSuggest.test.ts" not in p and old in p:
    pkg.write_text(p.replace(old, new, 1), encoding="utf-8")
    print("package.json ok")
else:
    print("package.json skip")

cat = repo / "packages/shared/src/choreCatalog.ts"
c = cat.read_text(encoding="utf-8")
m = re.search(
    r'(slug: "brush-teeth-bedtime",[\s\S]*?timeOfDay: ")([A-Z]+)(")',
    c,
)
if m and m.group(2) != "EVENING":
    c = c[: m.start(2)] + "EVENING" + c[m.end(2) :]
    cat.write_text(c, encoding="utf-8")
    print("bedtime EVENING ok")
else:
    print("bedtime", m.group(2) if m else "missing")

css = repo / "apps/player/src/styles.css"
cs = css.read_text(encoding="utf-8")
snip = (repo / "tmp/jobboard_ranking.css").read_text(encoding="utf-8")
if "JOB_BOARD_RIGHT_NOW_V1" not in cs:
    css.write_text(cs.rstrip() + "\n" + snip + "\n", encoding="utf-8")
    print("css ok")
else:
    print("css skip")

gpath = repo / "apps/player/src/screens/Garden.tsx"
g = gpath.read_text(encoding="utf-8")
changed = False
if "choreTimezone" not in g:
    g2, n = re.subn(
        r"const \[chores, setChores\] = useState<PublicChore\[\]>\(\[\]\);",
        'const [chores, setChores] = useState<PublicChore[]>([]);\n  const [choreTimezone, setChoreTimezone] = useState("America/Chicago");',
        g,
        count=1,
    )
    if n != 1:
        raise SystemExit("chores state not found")
    g = g2
    changed = True
    print("garden state ok")

if "setChoreTimezone" not in g:
    g2, n = re.subn(
        r"setChores\(data\.chores\);",
        'setChores(data.chores);\n        setChoreTimezone(data.timezone || "America/Chicago");',
        g,
        count=1,
    )
    if n != 1:
        raise SystemExit("setChores not found")
    g = g2
    changed = True
    print("garden load ok")

if "timezone={choreTimezone}" not in g:
    g2, n = re.subn(
        r"<JobBoard\r?\n\s*chores=\{chores\}",
        "<JobBoard\n          chores={chores}\n          timezone={choreTimezone}",
        g,
        count=1,
    )
    if n != 1:
        raise SystemExit("JobBoard JSX not found")
    g = g2
    changed = True
    print("garden prop ok")

if changed:
    gpath.write_text(g, encoding="utf-8")
print("DONE")
