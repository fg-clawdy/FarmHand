from pathlib import Path
import tarfile
import shutil

REPO = Path(r"C:\Users\theha\Documents\GIT\FarmHand")
TGZ = REPO / "tmp" / "farmhand-jobboard-ux-dropin.tgz"
DROP = REPO / "tmp" / "dropin"

# Extract
if DROP.exists():
    shutil.rmtree(DROP)
with tarfile.open(TGZ, "r:gz") as tf:
    tf.extractall(REPO / "tmp")
assert DROP.exists(), "dropin missing after extract"

# --- jobBoard.ts ---
jb_path = REPO / "apps/player/src/pixi/jobBoard.ts"
jb = jb_path.read_text(encoding="utf-8")
if "getCurrentJob(" not in jb:
    needle = "  debugHit("
    if needle not in jb:
        raise SystemExit("debugHit not found")
    block = (
        "  /** Chore currently shown on the Wanted flyer (Farm stake tap target). */\n"
        "  getCurrentJob(): WantedJob | null {\n"
        "    return this.jobs[this.index] ?? null;\n"
        "  }\n\n"
        "  debugHit("
    )
    jb = jb.replace(needle, block, 1)
    jb_path.write_text(jb, encoding="utf-8")
    print("INSERTED getCurrentJob")
else:
    print("SKIP getCurrentJob")

# --- FarmScene.ts ---
fs_path = REPO / "apps/player/src/pixi/FarmScene.ts"
fs = fs_path.read_text(encoding="utf-8")
if "getCurrentWantedJob(" not in fs:
    # Find setWantedJobs method end
    import re
    m = re.search(r"setWantedJobs\([^\)]*\)\s*\{[^}]*\}", fs)
    if not m:
        raise SystemExit("setWantedJobs not found")
    insert = (
        "\n\n  /** Wanted flyer chore currently displayed on the Farm Job Board stake. */\n"
        "  getCurrentWantedJob() {\n"
        "    return this.jobBoard.getCurrentJob();\n"
        "  }"
    )
    fs = fs[: m.end()] + insert + fs[m.end() :]
    fs_path.write_text(fs, encoding="utf-8")
    print("INSERTED getCurrentWantedJob")
else:
    print("SKIP getCurrentWantedJob")

# --- Copy FarmChoreClaim + JobBoard ---
for rel in [
    "apps/player/src/components/FarmChoreClaim.tsx",
    "apps/player/src/components/JobBoard.tsx",
]:
    src = DROP / rel
    dst = REPO / rel
    shutil.copy2(src, dst)
    print(f"COPIED {rel}")

# --- FarmDashboard: surgical merge preserving PIN pause + useCallback ---
fd_path = REPO / "apps/player/src/screens/FarmDashboard.tsx"
fd = fd_path.read_text(encoding="utf-8")

if "FarmChoreClaim" not in fd:
    fd = fd.replace(
        'import FarmJobFlow from "../components/FarmJobFlow";\n',
        'import FarmChoreClaim from "../components/FarmChoreClaim";\n'
        'import FarmJobFlow from "../components/FarmJobFlow";\n',
        1,
    )

if "claimJob" not in fd:
    fd = fd.replace(
        "  const [jobsOpen, setJobsOpen] = useState(false);\n",
        "  const [jobsOpen, setJobsOpen] = useState(false);\n"
        "  const [claimJob, setClaimJob] = useState<FamilyJob | null>(null);\n",
        1,
    )

old_handler = "    onJobBoard: () => setJobsOpen(true),"
new_handler = """    onJobBoard: () => {
      // Open the chore currently shown on the Wanted flyer (not the full family board).
      const current = sceneRef.current?.getCurrentWantedJob() ?? null;
      if (current) {
        const match = jobs.find((j) => j.id === current.id);
        if (match) {
          setClaimJob(match);
          return;
        }
        setClaimJob({
          id: current.id,
          slug: current.slug ?? current.id,
          title: current.title,
          emoji: current.emoji,
          description: "",
          priority: "NORMAL",
          assignmentMode: "ANY",
          requiresSelfie: false,
          flyerUrl: current.flyerUrl ?? undefined,
        });
        return;
      }
      setJobsOpen(true);
    },"""

if "getCurrentWantedJob" not in fd:
    if old_handler not in fd:
        raise SystemExit("onJobBoard handler not found for patch")
    fd = fd.replace(old_handler, new_handler, 1)

# Insert claim modal + handleClaimed before jobsOpen render
if "{claimJob &&" not in fd:
    claim_block = """      {claimJob && (
        <FarmChoreClaim
          job={claimJob}
          players={players}
          onClose={() => setClaimJob(null)}
          onClaimed={(name) => {
            setToast(`Waiting seed planted in ${name}'s garden.`);
            window.setTimeout(() => setToast(""), 3200);
            void load();
          }}
        />
      )}
"""
    marker = "      {jobsOpen && config && ("
    if marker not in fd:
        raise SystemExit("jobsOpen render marker missing")
    fd = fd.replace(marker, claim_block + marker, 1)

fd_path.write_text(fd, encoding="utf-8")
print("PATCHED FarmDashboard.tsx")
print("DONE")
