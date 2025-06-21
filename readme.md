# Music Theory Charts for Piano: Interactive Visualizer for Practicing Music Theory

## Intro
A small webapp to streamline piano practice. The reactive interface displays scales for all 12 standard notes found in Western music. Features two separate views:
- Scale view: Choose a scale and view it starting from all 12 notes, side by side.
- Key view: Choose a starting note and view all available scales next to each other.

[Click here](https://markmitrani.github.io/MusicTheoryCharts/index.html) to visit the website.

## Installation
The core logic is written in TypeScript under ```/src```. These files can be compiled into JavaScript using ```tsc```.
It is possible to run the project using ```live-server```. To install ```live-server``` using npm, run ```npm install -g live-server```.

## Usage
Navigate to the repository directory and run ```live-server``` on the command line. If everything went well, you should see a line like this in your terminal:

```Serving ".../MusicTheoryCharts" at [IP_ADDRESS]```

If the interface hasn't opened automatically, navigate to ```IP_ADDRESS``` on your favorite browser.

## Planned Developments
- Add more views (e.g for visualizing harmonies)
- Custom themes (variable accent colors, either key-based or user-selected)

## Acknowledgements
The [Rakkas](https://fonts.google.com/specimen/Rakkas) font, designed by Zeynep Akay, was used to style headings.
Landing page photo by [Kelly Sikkema on Unsplash](https://unsplash.com/@kellysikkema).
