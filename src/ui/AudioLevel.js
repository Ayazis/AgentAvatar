// The audio level slider: feeds Rosie a 0…1 level.
export class AudioLevel {
  constructor(rosie, root = document) {
    const slider = root.querySelector('#level'), output = root.querySelector('output[for=level]');
    slider.addEventListener('input', () => {
      rosie.setLevel(slider.valueAsNumber/100);
      output.value = slider.value + '%';
    });
  }
}
