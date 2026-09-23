from pathlib import Path
p = Path(r"C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\screens\Garden.tsx")
t = p.read_text(encoding="utf-8")
old = "        setChores(data.chores);"
new = "        setChores(data.chores);\n        setChoreTimezone(data.timezone || \"America/Chicago\");"
if "setChoreTimezone(data.timezone" in t:
    print("already")
elif old not in t:
    raise SystemExit("setChores line missing")
else:
    p.write_text(t.replace(old, new, 1), encoding="utf-8")
    print("fixed")
