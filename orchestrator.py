#!/usr/bin/env python3
import os
import subprocess
import sys
from typing import List, Tuple

# ======================
# Config
# ======================

AUTO_MAX_ITERS = int(os.getenv("AUTO_MAX_ITERS", "5"))

PROJECT_ROOT = os.getcwd()
AUTOPIPE_DIR = os.path.join(PROJECT_ROOT, ".autopipe")
os.makedirs(AUTOPIPE_DIR, exist_ok=True)

TEST_LOG = os.path.join(AUTOPIPE_DIR, "TEST.log")
CLAUDE_LOG = os.path.join(AUTOPIPE_DIR, "CLAUDE.log")

TEST_COMMANDS: List[List[str]] = [
    ["npm", "test"],
]

# ======================
# Utils
# ======================

def run(cmd: List[str], cwd: str = PROJECT_ROOT, check: bool = False) -> Tuple[int, str]:
    p = subprocess.run(
        cmd,
        cwd=cwd,
        text=True,
        capture_output=True,
    )
    out = (p.stdout or "") + (p.stderr or "")
    if check and p.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{out}")
    return p.returncode, out


def write_file(path: str, content: str):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


# ======================
# Main loop
# ======================

def main():
    for iteration in range(1, AUTO_MAX_ITERS + 1):
        print(f"\n=== ITERATION {iteration}/{AUTO_MAX_ITERS} ===")

        # ------------------
        # Run tests
        # ------------------
        logs = []
        tests_ok = True

        for cmd in TEST_COMMANDS:
            code, out = run(cmd)
            logs.append(f"$ {' '.join(cmd)}\n{out}\n(exit={code})")
            if code != 0:
                tests_ok = False

        write_file(TEST_LOG, "\n".join(logs))

        # ------------------
        # PASS condition (pragmatic)
        # ------------------
        if tests_ok:
            print("Tests PASS. Finalizing.")

            # Ensure gitignore sanity
            gitignore_path = os.path.join(PROJECT_ROOT, ".gitignore")
            if os.path.exists(gitignore_path):
                with open(gitignore_path, "r", encoding="utf-8") as f:
                    gi = f.read()
            else:
                gi = ""

            additions = []
            for line in ["node_modules/", ".autopipe/", "run_orchestrator.log"]:
                if line not in gi:
                    additions.append(line)

            if additions:
                with open(gitignore_path, "a", encoding="utf-8") as f:
                    for line in additions:
                        f.write(line + "\n")

            # Commit result
            run(["git", "add", "-A"], check=True)
            run(
                ["git", "commit", "-m", "PASS: Pokemon Azul core logic + tests"],
                check=False,
            )

            print("PASS. Changes committed.")
            return

        # ------------------
        # FAIL path
        # ------------------
        print("Tests FAIL. See .autopipe/TEST.log")

    raise RuntimeError("Max iterations reached without PASS")


if __name__ == "__main__":
    main()
