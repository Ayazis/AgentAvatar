// The intensity slider: how lively Rosie is, fed to her as 0…1.
export class IntensitySlider {
  constructor(rosie, root = document) {
    const slider = root.querySelector('#intensity'), output = root.querySelector('output[for=intensity]');
    slider.addEventListener('input', () => {
      rosie.setIntensity(slider.valueAsNumber/100);
      output.value = slider.value + '%';
    });
  }
}
