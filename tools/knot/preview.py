"""One command for the whole knot preview: collision pass, Blender renders (front + side), preview videos.
usage: python tools/knot/preview.py [NFRAMES=48] [SIZE=627]
env BLENDER  path to blender.exe (default: Blender 5.2 in Program Files)
env KNOT_COLOR=1  orange/blue lapels instead of two blues
Outputs in tools/knot/out/: frames.npz, front/, side/, preview.mp4 (front|side, real time),
closeup_quarter_speed.mp4."""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out')
NF = sys.argv[1] if len(sys.argv) > 1 else '48'
SIZE = sys.argv[2] if len(sys.argv) > 2 else '627'
BLENDER = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
os.makedirs(OUT, exist_ok=True)


def run(cmd, **kw):
    print('>', ' '.join(cmd), flush=True); subprocess.run(cmd, check=True, **kw)


run([sys.executable, os.path.join(HERE, 'sim.py'), NF, '4'])
env = dict(os.environ, KNOT_NPZ=os.path.join(OUT, 'frames.npz'))
for name, yaw in (('front', '0'), ('side', '-55')):
    run([BLENDER, '-b', '-P', os.path.join(HERE, 'render_blocking.py'), '--', os.path.join(OUT, name), NF, SIZE, yaw],
        env=env, stdout=subprocess.DEVNULL)
s = int(SIZE) & ~1
pad = 'tpad=start_mode=clone:start_duration=0.6:stop_mode=clone:stop_duration=1.2'
run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', os.path.join(OUT, 'front', 'f_%03d.png'),
     '-framerate', '30', '-i', os.path.join(OUT, 'side', 'f_%03d.png'),
     '-filter_complex', f'[0][1]hstack=inputs=2,scale={2*s}:{s},{pad}[v]', '-map', '[v]',
     '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', os.path.join(OUT, 'preview.mp4')])
c = int(int(SIZE)*0.64) & ~1; x, y = int(int(SIZE)*0.16), int(int(SIZE)*0.27)   # around the knot
run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', os.path.join(OUT, 'front', 'f_%03d.png'),
     '-vf', f'crop={c}:{c}:{x}:{y},scale=626:626,tpad=start_mode=clone:start_duration=0.4:stop_mode=clone:stop_duration=1,setpts=4*PTS',
     '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', os.path.join(OUT, 'closeup_quarter_speed.mp4')])
print('done:', OUT)
