# Agents

Two AI agents work on this project. Their sessions don't share memory, so the repository is the shared ground truth.

| Agent | Role |
|---|---|
| **Claude** | Main orchestrator: code, structure, integration, reviews, merges. Decides where new work and assets go. |
| **ChatGPT** | Mainly asset creation: artwork, pose designs, layered PSD/PNG files, image-model output. |

## Every session

1. **Start from the latest work.**
   ```
   git fetch --all --prune
   git checkout main
   git pull
   ```
   If work is in progress on another branch, check that branch out and pull it instead of `main`.
2. **Create a new branch for your work** wherever possible, instead of committing to `main`:
   ```
   git checkout -b <agent>/<short-topic>     # e.g. chatgpt/off-pose-v2, claude/tune-presets
   ```
3. **Commit and push often**, with clear messages, so the other agent can pick up from there.
4. **Merge into `main` through a pull request.** Claude reviews and merges.

## Where things go

- `assets/source/`: raw artwork from ChatGPT (the inputs). Add new files here, don't overwrite the built files directly.
- `assets/`: built artwork, produced by `python tools/build_poses.py` from `assets/source/`.
- `src/rosie/`: the avatar (animation, shaders, particles). `src/ui/`: the menus and Tune panel. `styles/`: CSS.
- `chatgpt/`: ChatGPT's own earlier version, kept for reference.
- `archive/`: older single-file versions. Don't edit.

See [README.md](README.md) for the full layout and how to run it.

## Handing off

- When ChatGPT delivers assets, note in the commit or PR what each file is (pose or state, layer, size) so Claude can wire it in.
- Leave anything unfinished or open in the PR description, not just in the chat, so the next session can see it.
