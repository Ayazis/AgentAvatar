import { Muse, type MuseState } from './muse.js';

const canvas=document.querySelector<HTMLCanvasElement>('#presence')!;
const muse=new Muse(canvas);
const states: MuseState[]=['off','idle','working'];
const buttons=document.querySelectorAll<HTMLButtonElement>('[data-state]');
const status=document.querySelector<HTMLElement>('#status')!;
function select(state:MuseState){
  muse.setState(state);
  status.textContent=state==='off'?'Standby':state==='idle'?'Idle':'Working';
  document.body.dataset.state=state;
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.state===state)));
}
buttons.forEach(button=>button.addEventListener('click',()=>select(button.dataset.state as MuseState)));
window.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  const state=states[Number(event.key)-1];if(state)select(state);
});
const slider=document.querySelector<HTMLInputElement>('#level')!;
const output=document.querySelector<HTMLOutputElement>('output')!;
slider.addEventListener('input',()=>{
  muse.setLevel(slider.valueAsNumber/100);
  output.value=slider.value+'%';
  slider.style.setProperty('--level',slider.value+'%');
});
select('idle');
