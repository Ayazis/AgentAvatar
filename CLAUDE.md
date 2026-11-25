# Claude

Claude is the main orchestrator on this project, and ChatGPT mainly creates assets. The shared rules are in AGENTS.md:

@AGENTS.md

## For Claude in particular

- Start every session with `git fetch --all --prune` and `git pull` on the branch you'll work from, and check for new branches or commits from ChatGPT.
- Work on a new `claude/<topic>` branch and merge into `main` through a pull request.
- When ChatGPT has added assets in `assets/source/`, rebuild with `python tools/build_poses.py` and wire them in.
