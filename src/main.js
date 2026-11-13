'use strict';
// Browser entry + wiring (not loaded headlessly). reset() rebuilds the world from the
// current PARAMETERS; a scenario (scenarios.js, applied in ui.js) only changes PARAMETERS.
var gameEngine, world, dataManager, observer, db, paused = false;

function reset() {
  gameEngine.clear();
  world = new World();
  observer = new Observer(world, worldColors());
  const cv = gameEngine.ctx.canvas, h = observer.height();
  if (cv.height !== h) cv.height = h;   // the road's rows set the canvas height
  db = createDB(PARAMETERS.db);
  dataManager = new DataManager(world, db);
  gameEngine.add(world);
  gameEngine.add(observer);
  gameEngine.add(dataManager);
  gameEngine.add(new UiPump(world, observer, dataManager));
  wireCharts(dataManager);
  describeScenario();
  if (paused) gameEngine.draw();   // show the fresh road even while paused
}

function togglePause() {
  paused = !paused;
  if (paused) gameEngine.stop(); else gameEngine.start();
}

window.onload = function () {
  $('picker').appendChild(CB.theme.picker());
  gameEngine = new GameEngine();
  gameEngine.init($('gameWorld').getContext('2d'));
  applyScenario(UI.scenario);
  buildControls();
  updateLegend();
  reset();
  gameEngine.start();
};
