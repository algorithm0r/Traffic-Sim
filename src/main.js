'use strict';
// Browser entry + wiring (not loaded headlessly). reset() rebuilds the world from the
// current PARAMETERS.
var gameEngine, world, dataManager, db;

function reset() {
  gameEngine.clear();
  world = new World();
  const cv = gameEngine.ctx.canvas;
  const speed = new LineGraph(20, cv.height - 160, 330, 140, 'mean speed (mph)');
  const fd = new ScatterGraph(380, cv.height - 160, 330, 140,
                              'flow (veh/h/ln) vs density (veh/km/ln)', 0, 80, 0, 2600);
  const near = new LineGraph(740, cv.height - 160, 390, 140, 'near-crashes per minute');
  db = createDB(PARAMETERS.db);
  dataManager = new DataManager(world, db, { speed, fd, near });
  const safety = new SafetyPanel(20, cv.height - 320, 1110, 150, dataManager);
  gameEngine.add(world);
  gameEngine.add(new Observer(world));
  gameEngine.add(dataManager);
  gameEngine.add(speed);
  gameEngine.add(fd);
  gameEngine.add(near);
  gameEngine.add(safety);
}

function toggleColor() {
  const modes = ['speed', 'type', 'safety'];
  PARAMETERS.colorMode = modes[(modes.indexOf(PARAMETERS.colorMode) + 1) % modes.length];
  const b = document.getElementById('colorBtn');
  if (b) b.textContent = 'Color: ' + PARAMETERS.colorMode;
}

function toggleDrivers() {
  PARAMETERS.idealDrivers = !PARAMETERS.idealDrivers;
  const b = document.getElementById('driversBtn');
  if (b) b.textContent = 'Drivers: ' + (PARAMETERS.idealDrivers ? 'ideal' : 'human');
  reset();
}

function toggleBody() {
  PARAMETERS.bodyModel = PARAMETERS.bodyModel === 'lane' ? 'bicycle' : 'lane';
  const b = document.getElementById('bodyBtn');
  if (b) b.textContent = 'Body: ' + PARAMETERS.bodyModel;
  reset();
}

window.onload = function () {
  const canvas = document.getElementById('gameWorld');
  gameEngine = new GameEngine();
  gameEngine.init(canvas.getContext('2d'));
  buildControls();
  reset();
  gameEngine.start();
  setInterval(function () {
    if (!world) return;
    const m = world.metrics();
    setStatus('t ' + (world.time / 60).toFixed(1) + ' min | ' + m.count + ' veh | ' +
              (m.meanV * MS2MPH).toFixed(0) + ' mph | ' +
              m.density.toFixed(1) + ' veh/km/ln | queue ' + m.queueTotal +
              ' | exited ' + m.stats.exited + ' | near ' + m.stats.nearCrashes +
              ' | crashes ' + (m.stats.crashes / 2 | 0));
  }, 500);
};
